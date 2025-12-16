import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function isAuthorized(request: Request): boolean {
  const adminSecretHeader = request.headers.get("x-admin-secret") ?? "";
  const expected = process.env.LICENSE_ADMIN_PASSWORD ?? "";
  return expected.length > 0 && adminSecretHeader === expected;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;

  try {
    const org = await prisma.organization.findUnique({
      where: { slug },
      include: {
        validations: {
          orderBy: { timestamp: "desc" },
          take: 50
        }
      }
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    return NextResponse.json({ organization: org });
  } catch (error) {
    console.error("Get organization error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;

  try {
    await prisma.organization.delete({
      where: { slug }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }
    console.error("Delete organization error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


