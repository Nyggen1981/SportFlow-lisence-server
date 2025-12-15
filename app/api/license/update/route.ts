import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type UpdateBody = {
  orgSlug?: string;
  isActive?: boolean;
  validUntil?: string | null;
  plan?: string;
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

  const { orgSlug, isActive, validUntil, plan } = body;

  if (!orgSlug) {
    return NextResponse.json({ error: "orgSlug is required" }, { status: 400 });
  }

  const data: any = {};

  if (typeof isActive === "boolean") {
    data.isActive = isActive;
  }

  if (typeof plan === "string") {
    data.plan = plan;
  }

  if (validUntil === null) {
    data.validUntil = null;
  } else if (typeof validUntil === "string") {
    const parsed = new Date(validUntil);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json(
        { error: "validUntil must be an ISO date string or null" },
        { status: 400 }
      );
    }
    data.validUntil = parsed;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    const license = await prisma.license.update({
      where: { orgSlug },
      data
    });

    await prisma.licenseEvent.create({
      data: {
        licenseId: license.id,
        type: !license.isActive ? "deactivated" : "extended",
        meta: data
      }
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    if (error.code === "P2025") {
      return NextResponse.json({ error: "License not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}