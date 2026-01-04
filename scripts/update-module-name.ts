import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Oppdater modulnavnet fra "Pris & Betaling" til "Betalingsmodul"
  const result = await prisma.module.updateMany({
    where: {
      OR: [
        { name: "Pris & Betaling" },
        { key: "pricing" }
      ]
    },
    data: {
      name: "Betalingsmodul",
      description: "Betalingshåndtering for bookingene"
    }
  });

  console.log(`Oppdaterte ${result.count} modul(er)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


