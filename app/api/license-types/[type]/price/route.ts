import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LICENSE_TYPES, LicenseType } from "@/lib/license-config";

function isAuthorized(request: Request): boolean {
  const adminSecretHeader = request.headers.get("x-admin-secret") ?? "";
  const expected = process.env.LICENSE_ADMIN_PASSWORD ?? "";
  return expected.length > 0 && adminSecretHeader === expected;
}

// GET: Hent pris for en lisens-type
export async function GET(
  request: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { type } = await params;

  if (!Object.keys(LICENSE_TYPES).includes(type)) {
    return NextResponse.json(
      { error: "Invalid license type" },
      { status: 400 }
    );
  }

  try {
    // Sjekk om det finnes en pris i databasen (override)
    const dbPrice = await prisma.licenseTypePrice.findUnique({
      where: { licenseType: type }
    });

    // Hvis ikke, bruk default fra config
    const defaultPrice = LICENSE_TYPES[type as LicenseType].price;
    const price = dbPrice?.price ?? defaultPrice;

    return NextResponse.json({
      licenseType: type,
      licenseTypeName: LICENSE_TYPES[type as LicenseType].name,
      price,
      isOverride: dbPrice !== null
    });
  } catch (error) {
    console.error("Get license type price error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: Oppdater pris for en lisens-type
export async function POST(
  request: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { type } = await params;

  if (!Object.keys(LICENSE_TYPES).includes(type)) {
    return NextResponse.json(
      { error: "Invalid license type" },
      { status: 400 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { price } = body;

  if (typeof price !== "number" || price < 0) {
    return NextResponse.json(
      { error: "price must be a non-negative number" },
      { status: 400 }
    );
  }

  try {
    const licenseTypePrice = await prisma.licenseTypePrice.upsert({
      where: { licenseType: type },
      update: { price: Math.round(price) },
      create: {
        licenseType: type,
        price: Math.round(price)
      }
    });

    return NextResponse.json({
      success: true,
      licenseType: licenseTypePrice.licenseType,
      price: licenseTypePrice.price
    });
  } catch (error) {
    console.error("Update license type price error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


