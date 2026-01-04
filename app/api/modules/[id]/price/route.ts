import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function isAuthorized(request: Request): boolean {
  const adminSecretHeader = request.headers.get("x-admin-secret") ?? "";
  const expected = process.env.LICENSE_ADMIN_PASSWORD ?? "";
  return expected.length > 0 && adminSecretHeader === expected;
}

// POST: Oppdater pris for en modul
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { price } = body;

  if (price !== null && (typeof price !== "number" || price < 0)) {
    return NextResponse.json(
      { error: "price must be a non-negative number or null" },
      { status: 400 }
    );
  }

  try {
    const module = await prisma.module.update({
      where: { id },
      data: { price: price === null ? null : Math.round(price) }
    });

    return NextResponse.json({
      success: true,
      module: {
        id: module.id,
        key: module.key,
        name: module.name,
        price: module.price
      }
    });
  } catch (error: any) {
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }
    console.error("Update module price error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}



