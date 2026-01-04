import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateMonthlyPrice, calculateModulePrice, getLicensePrice, LICENSE_TYPES, LicenseType } from "@/lib/license-config";

// GET: Hent prisinformasjon for en organisasjon (brukes av booking-appen)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const licenseKey = searchParams.get("licenseKey");

  if (!licenseKey) {
    return NextResponse.json(
      { error: "licenseKey is required" },
      { status: 400 }
    );
  }

  try {
    const org = await prisma.organization.findUnique({
      where: { licenseKey },
      include: {
        modules: {
          where: { isActive: true },
          include: {
            module: true
          }
        }
      }
    });

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    const licenseType = org.licenseType as LicenseType;
    const isPilot = licenseType === "pilot";
    
    // Hent pris-override fra databasen hvis den finnes
    const licenseTypePrice = await prisma.licenseTypePrice.findUnique({
      where: { licenseType: org.licenseType }
    });
    
    const basePrice = getLicensePrice(licenseType, licenseTypePrice?.price);
    // Bruk calculateModulePrice som gir 0 for pilotkunder
    const modulePrice = calculateModulePrice(licenseType, org.modules);
    const totalMonthlyPrice = calculateMonthlyPrice(licenseType, org.modules, basePrice);

    // Bygg detaljert prisoversikt (vis 0 for moduler på pilotkunder)
    const moduleList = org.modules.map(orgModule => ({
      key: orgModule.module.key,
      name: orgModule.module.name,
      price: isPilot ? 0 : (orgModule.module.price ?? 0),
      isStandard: orgModule.module.isStandard
    }));
    
    // Booking er alltid inkludert (unntatt inaktiv)
    if (licenseType !== "inactive") {
      moduleList.unshift({
        key: "booking",
        name: "Booking",
        price: 0,
        isStandard: true
      });
    }
    
    const pricingBreakdown = {
      licenseType: org.licenseType,
      licenseTypeName: LICENSE_TYPES[licenseType]?.name || org.licenseType,
      basePrice,
      modules: moduleList,
      modulePrice,
      totalMonthlyPrice
    };

    return NextResponse.json({
      licenseKey: org.licenseKey,
      organization: org.name,
      pricing: pricingBreakdown
    });
  } catch (error) {
    console.error("Get pricing error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

