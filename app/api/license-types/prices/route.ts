import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LICENSE_TYPES, LicenseType } from "@/lib/license-config";

function isAuthorized(request: Request): boolean {
  const adminSecretHeader = request.headers.get("x-admin-secret") ?? "";
  const expected = process.env.LICENSE_ADMIN_PASSWORD ?? "";
  return expected.length > 0 && adminSecretHeader === expected;
}

// GET: Hent alle lisens-type priser
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Hent alle pris-overrides fra databasen
    const dbPrices = await prisma.licenseTypePrice.findMany();
    const priceMap = new Map(dbPrices.map(p => [p.licenseType, p.price]));

    // Bygg liste med alle lisens-typer og deres priser
    const prices = Object.keys(LICENSE_TYPES).map(type => {
      const licenseType = type as LicenseType;
      const dbPrice = priceMap.get(type);
      const defaultPrice = LICENSE_TYPES[licenseType].price;
      
      return {
        licenseType: type,
        licenseTypeName: LICENSE_TYPES[licenseType].name,
        price: dbPrice ?? defaultPrice,
        isOverride: dbPrice !== undefined
      };
    });

    return NextResponse.json({ prices });
  } catch (error) {
    console.error("Get license type prices error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


