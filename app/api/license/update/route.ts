import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LICENSE_TYPES } from "@/lib/license-config";

type UpdateBody = {
  slug?: string;
  name?: string;
  contactEmail?: string;
  contactName?: string;
  contactPhone?: string;
  licenseType?: string;
  isActive?: boolean;
  isSuspended?: boolean;
  suspendReason?: string;
  expiresAt?: string | null;
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

  let body: UpdateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { slug, ...updates } = body;

  if (!slug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }

  // Bygg data-objekt for oppdatering
  const data: any = {};

  if (updates.name !== undefined) data.name = updates.name;
  if (updates.contactEmail !== undefined) data.contactEmail = updates.contactEmail;
  if (updates.contactName !== undefined) data.contactName = updates.contactName;
  if (updates.contactPhone !== undefined) data.contactPhone = updates.contactPhone;
  if (updates.notes !== undefined) data.notes = updates.notes;
  
  if (typeof updates.isActive === "boolean") data.isActive = updates.isActive;
  if (typeof updates.isSuspended === "boolean") data.isSuspended = updates.isSuspended;
  if (updates.suspendReason !== undefined) data.suspendReason = updates.suspendReason;

  if (typeof updates.maxUsers === "number" || updates.maxUsers === null) {
    data.maxUsers = updates.maxUsers;
  }
  if (typeof updates.maxResources === "number" || updates.maxResources === null) {
    data.maxResources = updates.maxResources;
  }

  // Valider og sett lisenstype
  if (updates.licenseType !== undefined) {
    if (!Object.keys(LICENSE_TYPES).includes(updates.licenseType)) {
      return NextResponse.json(
        { error: `licenseType must be one of: ${Object.keys(LICENSE_TYPES).join(", ")}` },
        { status: 400 }
      );
    }
    data.licenseType = updates.licenseType;
  }

  // Håndter expiresAt
  if (updates.expiresAt === null) {
    // Kan ikke sette expiresAt til null - det er required
    return NextResponse.json(
      { error: "expiresAt cannot be null" },
      { status: 400 }
    );
  } else if (typeof updates.expiresAt === "string") {
    const parsed = new Date(updates.expiresAt);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json(
        { error: "expiresAt must be a valid ISO date string" },
        { status: 400 }
      );
    }
    data.expiresAt = parsed;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    const org = await prisma.organization.update({
      where: { slug },
      data
    });

    return NextResponse.json({
      success: true,
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        licenseType: org.licenseType,
        isActive: org.isActive,
        isSuspended: org.isSuspended,
        expiresAt: org.expiresAt.toISOString()
      }
    });
  } catch (error: any) {
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }
    console.error("Update organization error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
