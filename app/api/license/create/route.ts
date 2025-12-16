import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LICENSE_TYPES, LicenseType } from "@/lib/license-config";

type CreateBody = {
  name?: string;
  slug?: string;
  contactEmail?: string;
  contactName?: string;
  contactPhone?: string;
  licenseType?: string;
  expiresAt?: string;
  maxUsers?: number | null;
  maxResources?: number | null;
  notes?: string;
};

function isAuthorized(request: Request): boolean {
  const adminSecretHeader = request.headers.get("x-admin-secret") ?? "";
  const expected = process.env.LICENSE_ADMIN_PASSWORD ?? "";
  return expected.length > 0 && adminSecretHeader === expected;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CreateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { 
    name, 
    slug, 
    contactEmail, 
    contactName,
    contactPhone,
    licenseType = "trial", 
    expiresAt,
    maxUsers,
    maxResources,
    notes
  } = body;

  // Validering
  if (!name || !slug || !contactEmail) {
    return NextResponse.json(
      { error: "name, slug, and contactEmail are required" },
      { status: 400 }
    );
  }

  // Valider lisenstype
  if (!Object.keys(LICENSE_TYPES).includes(licenseType)) {
    return NextResponse.json(
      { error: `licenseType must be one of: ${Object.keys(LICENSE_TYPES).join(", ")}` },
      { status: 400 }
    );
  }

  // Beregn utløpsdato
  let expiresAtDate: Date;
  if (expiresAt) {
    const parsed = new Date(expiresAt);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json(
        { error: "expiresAt must be a valid ISO date string" },
        { status: 400 }
      );
    }
    expiresAtDate = parsed;
  } else {
    // Default: 30 dager for trial, 365 dager for andre
    const days = licenseType === "trial" ? 30 : 365;
    expiresAtDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  try {
    const org = await prisma.organization.create({
      data: {
        name,
        slug,
        contactEmail,
        contactName,
        contactPhone,
        licenseType,
        expiresAt: expiresAtDate,
        maxUsers,
        maxResources,
        notes
      }
    });

    return NextResponse.json(
      {
        id: org.id,
        licenseKey: org.licenseKey,
        name: org.name,
        slug: org.slug,
        licenseType: org.licenseType,
        expiresAt: org.expiresAt.toISOString()
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Organization with this slug already exists" },
        { status: 409 }
      );
    }
    console.error("Create organization error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
