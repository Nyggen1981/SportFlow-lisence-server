import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type ValidateBody = {
  licenseKey?: string;
  orgSlug?: string;
};

export async function POST(request: Request) {
  const now = new Date();

  let body: ValidateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { licenseKey, orgSlug } = body;

  if (!licenseKey || !orgSlug) {
    return NextResponse.json(
      { error: "licenseKey and orgSlug are required" },
      { status: 400 }
    );
  }

  const license = await prisma.license.findUnique({
    where: { key: licenseKey }
  });

  if (!license || license.orgSlug !== orgSlug) {
    return NextResponse.json(
      {
        valid: false,
        plan: license?.plan ?? null,
        reason: "mismatch"
      },
      { status: 200 }
    );
  }

  let valid = true;
  let reason: "expired" | "inactive" | null = null;

  if (!license.isActive || license.validFrom > now) {
    valid = false;
    reason = "inactive";
  } else if (license.validUntil && license.validUntil < now) {
    valid = false;
    reason = "expired";
  }

  await prisma.licenseEvent.create({
    data: {
      licenseId: license.id,
      type: "validated",
      meta: { orgSlug, valid, reason }
    }
  });

  return NextResponse.json(
    {
      valid,
      plan: license.plan,
      reason: valid ? null : reason,
      validUntil: license.validUntil ? license.validUntil.toISOString() : null
    },
    { status: 200 }
  );
}
