import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL || "admin@sportflow-booking.no";
  const password = process.env.ADMIN_PASSWORD || "admin123";

  console.log("Seeding database...");

  // Opprett admin-bruker
  const hashedPassword = await bcrypt.hash(password, 10);

  const admin = await prisma.adminUser.upsert({
    where: { email },
    update: {},
    create: {
      email,
      password: hashedPassword,
      name: "Super Admin",
      role: "super"
    }
  });

  console.log("✅ Admin user created:", admin.email);

  // Opprett en test-organisasjon
  const testOrg = await prisma.organization.upsert({
    where: { slug: "test-klubb" },
    update: {},
    create: {
      name: "Test Klubb",
      slug: "test-klubb",
      contactEmail: "test@example.com",
      licenseType: "free",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 dager
    }
  });

  console.log("✅ Test organization created:");
  console.log("   Name:", testOrg.name);
  console.log("   License Key:", testOrg.licenseKey);
  console.log("   Expires:", testOrg.expiresAt.toISOString());

  // Opprett Haugesund IL som eksempel
  const haugesundOrg = await prisma.organization.upsert({
    where: { slug: "haugesund-il" },
    update: {},
    create: {
      name: "Haugesund IL",
      slug: "haugesund-il",
      contactEmail: "post@haugesundil.no",
      contactName: "Admin Haugesund",
      licenseType: "standard",
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 år
    }
  });

  console.log("✅ Haugesund IL created:");
  console.log("   Name:", haugesundOrg.name);
  console.log("   License Key:", haugesundOrg.licenseKey);
  console.log("   Expires:", haugesundOrg.expiresAt.toISOString());

  // Opprett moduler (booking er kjernefunksjonalitet, ikke en modul)
  const pricingModule = await prisma.module.upsert({
    where: { key: "pricing" },
    update: {},
    create: {
      key: "pricing",
      name: "Betalingsmodul",
      description: "Betalingshåndtering for bookingene",
      isStandard: false,
      isActive: true,
      price: 99 // kr/mnd ekstra
    }
  });

  console.log("✅ Pricing module created:", pricingModule.name);

  // Kampoppsett-modul for kampplanlegging og -administrasjon
  const matchSetupModule = await prisma.module.upsert({
    where: { key: "match-setup" },
    update: {},
    create: {
      key: "match-setup",
      name: "Kampoppsett",
      description: "Kampplanlegging, lagoppsett og kamprapportering",
      isStandard: false,
      isActive: true,
      price: 149 // kr/mnd ekstra
    }
  });

  console.log("✅ Match setup module created:", matchSetupModule.name);

  // Anleggsregister-modul for administrasjon av idrettsanlegg
  const facilityRegistryModule = await prisma.module.upsert({
    where: { key: "facility-registry" },
    update: {},
    create: {
      key: "facility-registry",
      name: "Anleggsregister",
      description: "Oversikt og administrasjon av idrettsanlegg",
      isStandard: false,
      isActive: true,
      price: 99 // kr/mnd ekstra
    }
  });

  console.log("✅ Facility registry module created:", facilityRegistryModule.name);

  console.log("\n🎉 Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });




