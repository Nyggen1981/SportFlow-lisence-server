import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function isAuthorized(request: Request): boolean {
  const adminSecretHeader = request.headers.get("x-admin-secret") ?? "";
  const expected = process.env.LICENSE_ADMIN_PASSWORD ?? "";
  return expected.length > 0 && adminSecretHeader === expected;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get("organizationId");
  const status = searchParams.get("status");
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  try {
    const where: any = {};
    
    if (organizationId) {
      where.organizationId = organizationId;
    }
    
    if (status) {
      where.status = status;
    }
    
    if (year) {
      where.periodYear = parseInt(year);
    }
    
    if (month) {
      where.periodMonth = parseInt(month);
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            contactEmail: true,
            contactName: true
          }
        }
      },
      orderBy: [
        { periodYear: "desc" },
        { periodMonth: "desc" },
        { invoiceDate: "desc" }
      ]
    });

    return NextResponse.json({ invoices });
  } catch (error) {
    console.error("List invoices error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

