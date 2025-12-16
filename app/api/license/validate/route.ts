import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  LICENSE_TYPES,
  LicenseType,
  getLicenseLimits,
  getLicenseFeatures,
  getGracePeriodDays,
  getDaysUntilExpiry,
  isInGracePeriod,
  getGraceDaysLeft
} from "@/lib/license-config";

type ValidateBody = {
  licenseKey?: string;
  appVersion?: string;
  stats?: {
    userCount?: number;
    bookingCount?: number;
  };
};

export async function POST(request: Request) {
  const now = new Date();

  // Hent IP-adresse og User-Agent
  const ipAddress = request.headers.get("x-forwarded-for") || 
                    request.headers.get("x-real-ip") || 
                    "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";

  let body: ValidateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { valid: false, status: "invalid", error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const { licenseKey, appVersion, stats } = body;

  if (!licenseKey) {
    return NextResponse.json(
      { valid: false, status: "invalid", error: "licenseKey is required" },
      { status: 400 }
    );
  }

  // Finn organisasjonen basert på lisensnøkkel
  const org = await prisma.organization.findUnique({
    where: { licenseKey }
  });

  // Ugyldig lisensnøkkel
  if (!org) {
    return NextResponse.json(
      { valid: false, status: "invalid", error: "Invalid license key" },
      { status: 200 }
    );
  }

  // Oppdater statistikk og heartbeat
  await prisma.organization.update({
    where: { id: org.id },
    data: {
      lastHeartbeat: now,
      appVersion: appVersion || org.appVersion,
      totalUsers: stats?.userCount ?? org.totalUsers,
      totalBookings: stats?.bookingCount ?? org.totalBookings,
      // Sett activatedAt ved første validering
      activatedAt: org.activatedAt ?? now
    }
  });

  const licenseType = org.licenseType as LicenseType;
  const limits = getLicenseLimits(licenseType, org);
  const features = getLicenseFeatures(licenseType);
  const gracePeriodDays = getGracePeriodDays(licenseType);

  // Beregn grace end date hvis ikke satt
  let graceEndsAt = org.graceEndsAt;
  if (!graceEndsAt && org.expiresAt && gracePeriodDays > 0) {
    graceEndsAt = new Date(org.expiresAt.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000);
  }

  // Sjekk status
  let status: "active" | "grace" | "expired" | "suspended" | "invalid";
  let valid = true;
  let message: string | undefined;

  // Sjekk suspendert
  if (org.isSuspended) {
    status = "suspended";
    valid = false;
    message = org.suspendReason || "Lisensen er suspendert. Kontakt support.";
  }
  // Sjekk inaktiv
  else if (!org.isActive) {
    status = "suspended";
    valid = false;
    message = "Lisensen er deaktivert. Kontakt support.";
  }
  // Sjekk utløpt
  else if (org.expiresAt < now) {
    // Sjekk om vi er i grace period
    if (graceEndsAt && now <= graceEndsAt) {
      status = "grace";
      valid = true;
      message = `Abonnementet har utløpt. ${getGraceDaysLeft(graceEndsAt)} dager igjen av grace period.`;
    } else {
      status = "expired";
      valid = false;
      message = "Lisensen har utløpt. Kontakt support for å fornye.";
    }
  }
  // Aktiv lisens
  else {
    status = "active";
    valid = true;
  }

  // Logg valideringen
  await prisma.licenseValidation.create({
    data: {
      organizationId: org.id,
      status,
      ipAddress,
      userAgent,
      appVersion,
      userCount: stats?.userCount,
      bookingCount: stats?.bookingCount
    }
  });

  // Bygg respons basert på status
  if (status === "suspended" || (status === "expired" && !valid)) {
    return NextResponse.json({
      valid: false,
      status,
      message
    });
  }

  if (status === "grace") {
    return NextResponse.json({
      valid: true,
      status: "grace",
      organization: org.name,
      graceMode: true,
      daysLeft: getGraceDaysLeft(graceEndsAt),
      message,
      restrictions: {
        readOnly: false,
        showWarning: true,
        canCreateBookings: true,
        canCreateUsers: false
      }
    });
  }

  // Aktiv lisens
  const daysUntilExpiry = getDaysUntilExpiry(org.expiresAt);
  const showRenewalWarning = daysUntilExpiry <= 30;

  return NextResponse.json({
    valid: true,
    status: "active",
    organization: org.name,
    licenseType: org.licenseType,
    expiresAt: org.expiresAt.toISOString(),
    daysUntilExpiry,
    limits: {
      maxUsers: limits.maxUsers,
      maxResources: limits.maxResources
    },
    features,
    showRenewalWarning
  });
}
