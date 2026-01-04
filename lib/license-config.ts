export const LICENSE_TYPES = {
  inactive: {
    name: "Inaktiv",
    maxUsers: 0,
    maxResources: 0,
    gracePeriodDays: 0,
    features: {
      emailNotifications: false,
      customBranding: false,
      prioritySupport: false
    },
    price: 0
  },
  pilot: {
    name: "Pilotkunde",
    maxUsers: 100,
    maxResources: 20,
    gracePeriodDays: 14,
    features: {
      emailNotifications: true,
      customBranding: true,
      prioritySupport: true
    },
    price: 0  // Gratis for pilotkunder
  },
  free: {
    name: "Prøveperiode",
    maxUsers: 10,
    maxResources: 2,
    gracePeriodDays: 0,
    features: {
      emailNotifications: false,
      customBranding: false,
      prioritySupport: false
    },
    price: 0
  },
  standard: {
    name: "Standard",
    maxUsers: 50,
    maxResources: 10,
    gracePeriodDays: 14,
    features: {
      emailNotifications: true,
      customBranding: true,
      prioritySupport: false
    },
    price: 299  // kr/mnd
  }
} as const;

export type LicenseType = keyof typeof LICENSE_TYPES;

// Hjelpefunksjon for å få limits
export function getLicenseLimits(
  licenseType: LicenseType,
  org?: { maxUsers?: number | null; maxResources?: number | null }
) {
  const defaults = LICENSE_TYPES[licenseType];
  return {
    maxUsers: org?.maxUsers ?? defaults.maxUsers,
    maxResources: org?.maxResources ?? defaults.maxResources
  };
}

// Hjelpefunksjon for å få features
export function getLicenseFeatures(licenseType: LicenseType) {
  return LICENSE_TYPES[licenseType].features;
}

// Hjelpefunksjon for å få grace period
export function getGracePeriodDays(licenseType: LicenseType) {
  return LICENSE_TYPES[licenseType].gracePeriodDays;
}

// Beregn dager til utløp
export function getDaysUntilExpiry(expiresAt: Date): number {
  const now = new Date();
  const diffTime = expiresAt.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Sjekk om lisensen er i grace period
export function isInGracePeriod(expiresAt: Date, graceEndsAt: Date | null): boolean {
  const now = new Date();
  return now > expiresAt && graceEndsAt !== null && now <= graceEndsAt;
}

// Beregn dager igjen av grace period
export function getGraceDaysLeft(graceEndsAt: Date | null): number {
  if (!graceEndsAt) return 0;
  const now = new Date();
  const diffTime = graceEndsAt.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
}

// Hjelpefunksjon for å bygge modul-objekt fra aktivere moduler
export function buildModulesObject(activeModules: Array<{ module: { key: string } }>): Record<string, boolean> {
  const modules: Record<string, boolean> = {};
  activeModules.forEach(({ module }) => {
    modules[module.key] = true;
  });
  return modules;
}

// Hjelpefunksjon for å få pris for lisens-type
// Denne funksjonen kan ta en pris-override fra databasen
export function getLicensePrice(licenseType: LicenseType, overridePrice?: number | null): number {
  return overridePrice ?? LICENSE_TYPES[licenseType].price;
}

// Beregn total månedspris for en organisasjon
export function calculateMonthlyPrice(
  licenseType: LicenseType,
  activeModules: Array<{ module: { price: number | null } }> | undefined,
  basePriceOverride?: number
): number {
  // Base-pris fra lisens-type (eller override)
  const basePrice = basePriceOverride ?? getLicensePrice(licenseType);
  
  // Pilotkunder får gratis tilleggsmoduler
  if (licenseType === "pilot") {
    return basePrice;
  }
  
  if (!activeModules || activeModules.length === 0) {
    return basePrice;
  }
  
  // Legg til pris for aktive moduler (kun moduler med pris)
  const modulePrice = activeModules.reduce((sum, orgModule) => {
    const price = orgModule.module.price;
    return sum + (price ?? 0);
  }, 0);
  
  return basePrice + modulePrice;
}

// Beregn modulpris (returnerer 0 for pilotkunder)
export function calculateModulePrice(
  licenseType: LicenseType,
  activeModules: Array<{ module: { price: number | null } }> | undefined
): number {
  // Pilotkunder får gratis tilleggsmoduler
  if (licenseType === "pilot") {
    return 0;
  }
  
  if (!activeModules || activeModules.length === 0) {
    return 0;
  }
  
  return activeModules.reduce((sum, orgModule) => {
    const price = orgModule.module.price;
    return sum + (price ?? 0);
  }, 0);
}




