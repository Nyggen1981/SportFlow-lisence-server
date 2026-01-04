-- CreateTable
CREATE TABLE "CompanySettings" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "orgNumber" TEXT,
    "vatNumber" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "address" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Norge',
    "bankAccount" TEXT,
    "bankName" TEXT,
    "iban" TEXT,
    "swift" TEXT,
    "logoUrl" TEXT,
    "invoicePrefix" TEXT NOT NULL DEFAULT 'INV',
    "defaultDueDays" INTEGER NOT NULL DEFAULT 14,
    "vatRate" INTEGER NOT NULL DEFAULT 0,
    "invoiceNote" TEXT,
    "paymentTerms" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
);
