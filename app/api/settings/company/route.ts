import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function isAuthorized(request: Request): boolean {
  const adminSecretHeader = request.headers.get("x-admin-secret") ?? "";
  const expected = process.env.LICENSE_ADMIN_PASSWORD ?? "";
  return expected.length > 0 && adminSecretHeader === expected;
}

// GET: Hent bedriftsinnstillinger
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Hent første (og eneste) bedriftsinnstilling
    let settings = await prisma.companySettings.findFirst();

    // Opprett standard innstillinger hvis ingen finnes
    if (!settings) {
      settings = await prisma.companySettings.create({
        data: {
          companyName: "SportFlow AS",
          invoicePrefix: "INV",
          defaultDueDays: 14,
          vatRate: 0,
          country: "Norge"
        }
      });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Get company settings error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: Oppdater bedriftsinnstillinger
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    companyName?: string;
    orgNumber?: string | null;
    vatNumber?: string | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    address?: string | null;
    postalCode?: string | null;
    city?: string | null;
    country?: string;
    bankAccount?: string | null;
    bankName?: string | null;
    iban?: string | null;
    swift?: string | null;
    logoUrl?: string | null;
    invoicePrefix?: string;
    defaultDueDays?: number;
    vatRate?: number;
    invoiceNote?: string | null;
    paymentTerms?: string | null;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    // Finn eksisterende innstillinger
    let settings = await prisma.companySettings.findFirst();

    if (settings) {
      // Oppdater eksisterende
      settings = await prisma.companySettings.update({
        where: { id: settings.id },
        data: {
          companyName: body.companyName ?? settings.companyName,
          orgNumber: body.orgNumber !== undefined ? body.orgNumber : settings.orgNumber,
          vatNumber: body.vatNumber !== undefined ? body.vatNumber : settings.vatNumber,
          email: body.email !== undefined ? body.email : settings.email,
          phone: body.phone !== undefined ? body.phone : settings.phone,
          website: body.website !== undefined ? body.website : settings.website,
          address: body.address !== undefined ? body.address : settings.address,
          postalCode: body.postalCode !== undefined ? body.postalCode : settings.postalCode,
          city: body.city !== undefined ? body.city : settings.city,
          country: body.country ?? settings.country,
          bankAccount: body.bankAccount !== undefined ? body.bankAccount : settings.bankAccount,
          bankName: body.bankName !== undefined ? body.bankName : settings.bankName,
          iban: body.iban !== undefined ? body.iban : settings.iban,
          swift: body.swift !== undefined ? body.swift : settings.swift,
          logoUrl: body.logoUrl !== undefined ? body.logoUrl : settings.logoUrl,
          invoicePrefix: body.invoicePrefix ?? settings.invoicePrefix,
          defaultDueDays: body.defaultDueDays ?? settings.defaultDueDays,
          vatRate: body.vatRate ?? settings.vatRate,
          invoiceNote: body.invoiceNote !== undefined ? body.invoiceNote : settings.invoiceNote,
          paymentTerms: body.paymentTerms !== undefined ? body.paymentTerms : settings.paymentTerms
        }
      });
    } else {
      // Opprett ny
      settings = await prisma.companySettings.create({
        data: {
          companyName: body.companyName ?? "SportFlow AS",
          orgNumber: body.orgNumber ?? null,
          vatNumber: body.vatNumber ?? null,
          email: body.email ?? null,
          phone: body.phone ?? null,
          website: body.website ?? null,
          address: body.address ?? null,
          postalCode: body.postalCode ?? null,
          city: body.city ?? null,
          country: body.country ?? "Norge",
          bankAccount: body.bankAccount ?? null,
          bankName: body.bankName ?? null,
          iban: body.iban ?? null,
          swift: body.swift ?? null,
          logoUrl: body.logoUrl ?? null,
          invoicePrefix: body.invoicePrefix ?? "INV",
          defaultDueDays: body.defaultDueDays ?? 14,
          vatRate: body.vatRate ?? 0,
          invoiceNote: body.invoiceNote ?? null,
          paymentTerms: body.paymentTerms ?? null
        }
      });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Update company settings error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

