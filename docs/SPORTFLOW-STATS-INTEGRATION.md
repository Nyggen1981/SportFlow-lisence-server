# SportFlow Statistikk-integrasjon

## Oversikt

SportFlow-appen sender automatisk bruksstatistikk til lisensserveren en gang i døgnet. Dette gir deg som administrator innsikt i hvor aktive kundene er.

## API-endepunkt

**URL:** `POST https://sportflow-license.vercel.app/api/stats/report`

## Autentisering

Bruk organisasjonens lisensnøkkel for autentisering.

## Request-format

```json
{
  "licenseKey": "clxxxxxxxxxxxxxxxxxx",
  "stats": {
    "totalUsers": 45,
    "activeUsers": 32,
    "lastUserLogin": "2026-01-04T14:30:00.000Z",
    "totalFacilities": 8,
    "totalCategories": 5,
    "totalBookings": 1250,
    "bookingsThisMonth": 78,
    "pendingBookings": 12,
    "totalRoles": 4
  }
}
```

## Feltbeskrivelser

| Felt | Type | Beskrivelse |
|------|------|-------------|
| `licenseKey` | string | Organisasjonens unike lisensnøkkel (påkrevd) |
| `stats.totalUsers` | number | Totalt antall brukere i systemet |
| `stats.activeUsers` | number | Brukere som har logget inn siste 30 dager |
| `stats.lastUserLogin` | string (ISO 8601) | Tidspunkt for siste brukerinnlogging |
| `stats.totalFacilities` | number | Antall fasiliteter/ressurser |
| `stats.totalCategories` | number | Antall kategorier |
| `stats.totalBookings` | number | Totalt antall bookinger (alle tider) |
| `stats.bookingsThisMonth` | number | Antall bookinger opprettet denne måneden |
| `stats.pendingBookings` | number | Antall bookinger som venter på godkjenning |
| `stats.totalRoles` | number | Antall roller/brukergrupper |

## Response

### Suksess (200)
```json
{
  "success": true,
  "message": "Statistikk oppdatert",
  "lastUpdated": "2026-01-04T15:00:00.000Z"
}
```

### Feil (400 - Manglende data)
```json
{
  "error": "Mangler licenseKey"
}
```

### Feil (404 - Ugyldig lisensnøkkel)
```json
{
  "error": "Ugyldig lisensnøkkel"
}
```

---

## Implementering i SportFlow

### 1. Opprett stats-reporter funksjon

```typescript
// lib/stats-reporter.ts
import { prisma } from "@/lib/prisma";

export async function reportStatsToLicenseServer() {
  const licenseKey = process.env.LICENSE_KEY;
  const licenseServerUrl = process.env.LICENSE_SERVER_URL || "https://sportflow-license.vercel.app";
  
  if (!licenseKey) {
    console.log("LICENSE_KEY not configured, skipping stats report");
    return;
  }

  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Hent statistikk fra din database
    const [
      totalUsers,
      activeUsers,
      lastLogin,
      facilities,
      categories,
      totalBookings,
      monthlyBookings,
      pendingBookings,
      roles
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: { lastLoginAt: { gte: thirtyDaysAgo } }
      }),
      prisma.user.findFirst({
        orderBy: { lastLoginAt: "desc" },
        select: { lastLoginAt: true }
      }),
      prisma.facility.count(),
      prisma.category.count(),
      prisma.booking.count(),
      prisma.booking.count({
        where: { createdAt: { gte: startOfMonth } }
      }),
      prisma.booking.count({ where: { status: "PENDING" } }),
      prisma.role.count()
    ]);

    // Send til lisensserver
    const response = await fetch(`${licenseServerUrl}/api/stats/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        licenseKey,
        stats: {
          totalUsers,
          activeUsers,
          lastUserLogin: lastLogin?.lastLoginAt?.toISOString() || null,
          totalFacilities: facilities,
          totalCategories: categories,
          totalBookings,
          bookingsThisMonth: monthlyBookings,
          pendingBookings,
          totalRoles: roles
        }
      })
    });

    if (response.ok) {
      console.log("Stats reported to license server successfully");
    } else {
      console.error("Stats report failed:", await response.text());
    }
  } catch (error) {
    console.error("Stats report error:", error);
  }
}
```

### 2. Sett opp Vercel Cron Job

Legg til i `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/report-stats",
      "schedule": "0 3 * * *"
    }
  ]
}
```

### 3. Opprett cron-endepunkt

```typescript
// app/api/cron/report-stats/route.ts
import { NextRequest, NextResponse } from "next/server";
import { reportStatsToLicenseServer } from "@/lib/stats-reporter";

export async function GET(request: NextRequest) {
  // Verifiser at det er en Vercel cron-jobb
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await reportStatsToLicenseServer();
  return NextResponse.json({ success: true });
}
```

---

## Miljøvariabler for SportFlow-appen

Legg til i `.env.local` og i Vercel Environment Variables:

```env
LICENSE_KEY=din-lisensnokkel-her
LICENSE_SERVER_URL=https://sportflow-license.vercel.app
CRON_SECRET=en-hemmelig-streng-for-cron
```

**Viktig:** `CRON_SECRET` må også legges til i Vercel Dashboard under Settings → Environment Variables.

---

## Frekvensvurdering

Statistikken sendes **en gang i døgnet** (kl. 03:00 UTC). Dette gir:
- Oppdatert oversikt uten å overbelaste serveren
- Lavere kostnad for API-kall
- Tilstrekkelig innsikt for fakturering og kundeoppfølging

---

## Sikkerhet

- Lisensnøkkelen brukes som autentisering
- Statistikken inneholder kun aggregerte tall, ingen persondata
- Kommunikasjon skjer over HTTPS
- Cron-endepunktet er beskyttet med `CRON_SECRET`
