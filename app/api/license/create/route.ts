import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

type CreateBody = {
  orgName?: string;
  orgSlug?: string;
  plan?: string;
  validUntil?: string | null;
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

  const { orgName, orgSlug, plan = "paid", validUntil } = body;

  if (!orgName || !orgSlug) {
    return NextResponse.json(
      { error: "orgName and orgSlug are required" },
      { status: 400 }
    );
  }

  let validUntilDate: Date | null = null;
  if (validUntil) {
    const parsed = new Date(validUntil);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json(
        { error: "validUntil must be an ISO date string" },
        { status: 400 }
      );
    }
    validUntilDate = parsed;
  }

  const key = randomUUID();

  try {
    const license = await prisma.license.create({
      data: {
        orgName,
        orgSlug,
        plan,
        key,
        validUntil: validUntilDate
      }
    });

    await prisma.licenseEvent.create({
      data: {
        licenseId: license.id,
        type: "created",
        meta: { orgName, orgSlug, plan, validUntil }
      }
    });

    return NextResponse.json(
      {
        id: license.id,
        key
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "License for orgSlug or key already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}