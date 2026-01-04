# SportFlow Statistikk-integrasjon

## Oversikt

Det er to måter å hente statistikk fra SportFlow-appen til lisensserveren:

1. **Push-metode**: SportFlow-appen sender statistikk automatisk (f.eks. en gang i døgnet)
2. **Pull-metode**: Lisensserveren ber om statistikk manuelt via admin-panelet

---

## Metode 1: Push fra SportFlow (automatisk)

### API-endepunkt på lisensserveren

**URL:** `POST https://din-lisensserver.vercel.app/api/stats/report`

### Autentisering

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

## Implementeringseksempel (Next.js)

Legg til en cron-jobb eller scheduled task som kjører daglig:

```typescript
// lib/stats-reporter.ts
export async function reportStatsToLicenseServer() {
  const licenseKey = process.env.LICENSE_KEY;
  const licenseServerUrl = process.env.LICENSE_SERVER_URL;
  
  if (!licenseKey || !licenseServerUrl) {
    console.log("Stats reporting not configured");
    return;
  }

  try {
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
        where: {
          lastLoginAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      }),
      prisma.user.findFirst({
        orderBy: { lastLoginAt: "desc" },
        select: { lastLoginAt: true }
      }),
      prisma.facility.count(),
      prisma.category.count(),
      prisma.booking.count(),
      prisma.booking.count({
        where: {
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
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
      console.log("Stats reported successfully");
    } else {
      console.error("Stats report failed:", await response.text());
    }
  } catch (error) {
    console.error("Stats report error:", error);
  }
}
```

### Vercel Cron Job

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

Og opprett API-ruten:

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

## Miljøvariabler for SportFlow-appen

Legg til i `.env.local`:

```env
LICENSE_KEY=din-lisensnokkel-her
LICENSE_SERVER_URL=https://din-lisensserver.vercel.app
CRON_SECRET=en-hemmelig-streng
```

## Frekvensvurdering

Vi anbefaler å sende statistikk **en gang i døgnet** (f.eks. kl. 03:00). Dette gir:
- Oppdatert oversikt uten å overbelaste serveren
- Lavere kostnad for API-kall
- Tilstrekkelig innsikt for fakturering og kundeoppfølging

---

## Metode 2: Pull fra lisensserver (manuell oppdatering)

Lisensserveren kan be om statistikk fra SportFlow-appen via admin-panelet. For at dette skal fungere, må SportFlow-appen ha et endepunkt som returnerer statistikk.

### Oppsett i admin-panelet

1. Gå til organisasjonens kort i admin-panelet
2. Sett **App-URL** til SportFlow-appens base-URL (f.eks. `https://minapp.vercel.app`)
3. Klikk **"🔄 Oppdater"** for å hente statistikk

### API-endepunkt i SportFlow-appen

**URL:** `POST /api/license/stats`

Lisensserveren vil kalle dette endepunktet med lisensnøkkelen.

### Request fra lisensserveren

```json
{
  "licenseKey": "clxxxxxxxxxxxxxxxxxx"
}
```

### Forventet response fra SportFlow

```json
{
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
```

### Implementeringseksempel for SportFlow

```typescript
// app/api/license/stats/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { licenseKey } = body;

    // Valider at dette er riktig lisensnøkkel for denne appen
    const expectedKey = process.env.LICENSE_KEY;
    if (!licenseKey || licenseKey !== expectedKey) {
      return NextResponse.json(
        { error: "Ugyldig lisensnøkkel" },
        { status: 401 }
      );
    }

    // Hent statistikk
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalUsers,
      activeUsers,
      lastLogin,
      totalFacilities,
      totalCategories,
      totalBookings,
      bookingsThisMonth,
      pendingBookings,
      totalRoles
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
      prisma.booking.count({
        where: { status: "PENDING" }
      }),
      prisma.role.count()
    ]);

    return NextResponse.json({
      totalUsers,
      activeUsers,
      lastUserLogin: lastLogin?.lastLoginAt?.toISOString() || null,
      totalFacilities,
      totalCategories,
      totalBookings,
      bookingsThisMonth,
      pendingBookings,
      totalRoles
    });
  } catch (error) {
    console.error("Stats error:", error);
    return NextResponse.json(
      { error: "Intern serverfeil" },
      { status: 500 }
    );
  }
}
```

---

## Sikkerhet

- Lisensnøkkelen brukes som autentisering
- Statistikken inneholder kun aggregerte tall, ingen persondata
- Kommunikasjon skjer over HTTPS

