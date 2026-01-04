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

  try {
    const organizations = await prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        contactEmail: true,
        contactName: true,
        licenseKey: true,
        licenseType: true,
        createdAt: true,
        activatedAt: true,
        expiresAt: true,
        graceEndsAt: true,
        isActive: true,
        isSuspended: true,
        lastHeartbeat: true,
        appVersion: true,
        totalUsers: true,
        totalBookings: true,
        _count: {
          select: { validations: true }
        }
      }
    });

    return NextResponse.json({
      organizations: organizations.map(org => ({
        ...org,
        validationCount: org._count.validations,
        _count: undefined
      }))
    });
  } catch (error) {
    console.error("List organizations error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}




