import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendInvoiceEmail } from "@/lib/email";

// POST /api/invoices/[id]/send - Send faktura på e-post
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminSecret = request.headers.get("x-admin-secret");
    const storedPassword = process.env.LICENSE_ADMIN_PASSWORD;

    if (!adminSecret || adminSecret !== storedPassword) {
      return NextResponse.json({ error: "Uautorisert" }, { status: 401 });
    }

    const { id } = await params;

    // Hent fakturaen med organisasjonsinformasjon
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        organization: {
          select: {
            name: true,
            contactEmail: true,
            contactName: true,
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Faktura ikke funnet" }, { status: 404 });
    }

    // Hent bedriftsinformasjon for fakturaen
    const companySettings = await prisma.companySettings.findFirst();

    // Formater datoer
    const monthNames = [
      "januar", "februar", "mars", "april", "mai", "juni",
      "juli", "august", "september", "oktober", "november", "desember"
    ];
    const periodMonth = monthNames[invoice.periodMonth - 1];
    const dueDate = new Date(invoice.dueDate).toLocaleDateString("nb-NO", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    // Parse body for eventuell PDF-data
    let pdfBuffer: Buffer | undefined;
    try {
      const body = await request.json();
      if (body.pdfBase64) {
        pdfBuffer = Buffer.from(body.pdfBase64, "base64");
      }
    } catch {
      // Ingen body, fortsett uten PDF
    }

    // Send e-post
    const result = await sendInvoiceEmail({
      to: invoice.organization.contactEmail,
      customerName: invoice.organization.contactName || invoice.organization.name,
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.amount,
      dueDate,
      periodMonth,
      periodYear: invoice.periodYear,
      pdfBuffer,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Kunne ikke sende e-post" },
        { status: 500 }
      );
    }

    // Oppdater fakturastatus til "sent" hvis den var "draft"
    if (invoice.status === "draft") {
      await prisma.invoice.update({
        where: { id },
        data: { status: "sent" },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Faktura sendt til ${invoice.organization.contactEmail}`,
      sentTo: invoice.organization.contactEmail,
    });
  } catch (error) {
    console.error("Send invoice error:", error);
    return NextResponse.json(
      { error: "Intern serverfeil" },
      { status: 500 }
    );
  }
}

