export const LICENSE_TYPES = {
  free: {
    name: "Free",
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
  trial: {
    name: "Trial",
    maxUsers: 25,
    maxResources: 5,
    gracePeriodDays: 7,
    trialDays: 30,
    features: {
      emailNotifications: true,
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
  },
  premium: {
    name: "Premium",
    maxUsers: null,      // Ubegrenset
    maxResources: null,  // Ubegrenset
    gracePeriodDays: 30,
    features: {
      emailNotifications: true,
      customBranding: true,
      prioritySupport: true
    },
    price: 599  // kr/mnd
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


