import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateMonthlyPrice, calculateModulePrice, getLicensePrice, LICENSE_TYPES, LicenseType } from "@/lib/license-config";

function isAuthorized(request: Request): boolean {
  const adminSecretHeader = request.headers.get("x-admin-secret") ?? "";
  const expected = process.env.LICENSE_ADMIN_PASSWORD ?? "";
  return expected.length > 0 && adminSecretHeader === expected;
}

// Generer unikt fakturanummer
async function generateInvoiceNumber(year: number): Promise<string> {
  // Finn høyeste fakturanummer for året
  const lastInvoice = await prisma.invoice.findFirst({
    where: {
      invoiceNumber: {
        startsWith: `INV-${year}-`
      }
    },
    orderBy: {
      invoiceNumber: "desc"
    }
  });

  if (lastInvoice) {
    // Ekstraher nummeret fra "INV-2025-001"
    const match = lastInvoice.invoiceNumber.match(/INV-\d+-(\d+)/);
    if (match) {
      const nextNum = parseInt(match[1]) + 1;
      return `INV-${year}-${String(nextNum).padStart(3, "0")}`;
    }
  }

  // Første faktura for året
  return `INV-${year}-001`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    organizationId: string;
    periodMonth: number;
    periodYear: number;
    periodMonths?: number;
    dueDate?: string;
    notes?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { organizationId, periodMonth, periodYear, periodMonths = 1, dueDate, notes } = body;

  if (!organizationId || !periodMonth || !periodYear) {
    return NextResponse.json(
      { error: "organizationId, periodMonth, and periodYear are required" },
      { status: 400 }
    );
  }

  if (periodMonth < 1 || periodMonth > 12) {
    return NextResponse.json(
      { error: "periodMonth must be between 1 and 12" },
      { status: 400 }
    );
  }

  if (![1, 3, 6, 12].includes(periodMonths)) {
    return NextResponse.json(
      { error: "periodMonths must be 1, 3, 6, or 12" },
      { status: 400 }
    );
  }

  try {
    // Hent organisasjon med aktive moduler
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        modules: {
          where: { isActive: true },
          include: {
            module: true
          }
        }
      }
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Sjekk om faktura allerede eksisterer for denne perioden
    const existingInvoice = await prisma.invoice.findFirst({
      where: {
        organizationId,
        periodMonth,
        periodYear,
        status: {
          not: "cancelled"
        }
      }
    });

    if (existingInvoice) {
      return NextResponse.json(
        { error: "Invoice already exists for this period" },
        { status: 400 }
      );
    }

    // Beregn priser
    const licenseType = org.licenseType as LicenseType;
    const licenseTypePrice = await prisma.licenseTypePrice.findUnique({
      where: { licenseType: org.licenseType }
    });

    const monthlyBasePrice = getLicensePrice(licenseType, licenseTypePrice?.price);
    // Bruk calculateModulePrice som gir 0 for pilotkunder
    const monthlyModulePrice = calculateModulePrice(licenseType, org.modules);
    const monthlyTotal = calculateMonthlyPrice(licenseType, org.modules, monthlyBasePrice);
    
    // Multipliser med antall måneder
    const basePrice = monthlyBasePrice * periodMonths;
    const modulePrice = monthlyModulePrice * periodMonths;
    const totalAmount = monthlyTotal * periodMonths;

    // Lagre modul-informasjon som JSON (vis faktisk pris eller 0 for pilot, multiplisert med måneder)
    const isPilot = licenseType === "pilot";
    const modulesInfo = JSON.stringify(
      org.modules.map(orgModule => ({
        key: orgModule.module.key,
        name: orgModule.module.name,
        price: isPilot ? 0 : ((orgModule.module.price ?? 0) * periodMonths)
      }))
    );
    
    // Beregn sluttmåned/år
    const endMonth = ((periodMonth - 1 + periodMonths - 1) % 12) + 1;
    const endYear = periodYear + Math.floor((periodMonth - 1 + periodMonths - 1) / 12);

    // Generer fakturanummer
    const invoiceNumber = await generateInvoiceNumber(periodYear);

    // Sett forfallsdato (standard 14 dager fra faktura-dato, eller bruk oppgitt dato)
    const invoiceDate = new Date();
    const dueDateObj = dueDate ? new Date(dueDate) : new Date(invoiceDate.getTime() + 14 * 24 * 60 * 60 * 1000);

    // Opprett faktura
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        organizationId,
        periodMonth,
        periodYear,
        periodMonths,
        amount: totalAmount,
        basePrice,
        modulePrice,
        vatAmount: 0, // MVA kan legges til senere hvis nødvendig
        status: "draft",
        invoiceDate,
        dueDate: dueDateObj,
        licenseType: org.licenseType,
        licenseTypeName: LICENSE_TYPES[licenseType]?.name || org.licenseType,
        modules: modulesInfo,
        notes: notes || null
      },
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
      }
    });

    return NextResponse.json({ invoice });
  } catch (error: any) {
    console.error("Create invoice error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

