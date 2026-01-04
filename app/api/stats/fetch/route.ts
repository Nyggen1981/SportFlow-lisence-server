import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/stats/fetch - Hent statistikk fra SportFlow-app
export async function POST(request: NextRequest) {
  try {
    const adminSecret = request.headers.get("x-admin-secret");
    const storedPassword = process.env.LICENSE_ADMIN_PASSWORD;

    if (!adminSecret || adminSecret !== storedPassword) {
      return NextResponse.json(
        { error: "Uautorisert" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { organizationId } = body;

    if (!organizationId) {
      return NextResponse.json(
        { error: "Mangler organizationId" },
        { status: 400 }
      );
    }

    // Finn organisasjonen
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organisasjon ikke funnet" },
        { status: 404 }
      );
    }

    if (!organization.appUrl) {
      return NextResponse.json(
        { error: "Ingen app-URL konfigurert for denne organisasjonen" },
        { status: 400 }
      );
    }

    // Kall SportFlow-appen for å hente statistikk
    const statsUrl = `${organization.appUrl}/api/license/stats`;
    
    try {
      const response = await fetch(statsUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          licenseKey: organization.licenseKey,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return NextResponse.json(
          { error: `SportFlow-appen svarte med feil: ${response.status} - ${errorText}` },
          { status: 502 }
        );
      }

      const statsData = await response.json();

      // Lagre statistikken
      await prisma.$executeRaw`
        INSERT INTO "OrganizationStats" (
          "id", "organizationId", "totalUsers", "activeUsers", "lastUserLogin",
          "totalFacilities", "totalCategories", "totalBookings", "bookingsThisMonth",
          "pendingBookings", "totalRoles", "lastUpdated"
        ) VALUES (
          gen_random_uuid(), ${organizationId}, ${statsData.totalUsers || 0}, ${statsData.activeUsers || 0},
          ${statsData.lastUserLogin ? new Date(statsData.lastUserLogin) : null},
          ${statsData.totalFacilities || 0}, ${statsData.totalCategories || 0},
          ${statsData.totalBookings || 0}, ${statsData.bookingsThisMonth || 0},
          ${statsData.pendingBookings || 0}, ${statsData.totalRoles || 0}, NOW()
        )
        ON CONFLICT ("organizationId") DO UPDATE SET
          "totalUsers" = ${statsData.totalUsers || 0},
          "activeUsers" = ${statsData.activeUsers || 0},
          "lastUserLogin" = ${statsData.lastUserLogin ? new Date(statsData.lastUserLogin) : null},
          "totalFacilities" = ${statsData.totalFacilities || 0},
          "totalCategories" = ${statsData.totalCategories || 0},
          "totalBookings" = ${statsData.totalBookings || 0},
          "bookingsThisMonth" = ${statsData.bookingsThisMonth || 0},
          "pendingBookings" = ${statsData.pendingBookings || 0},
          "totalRoles" = ${statsData.totalRoles || 0},
          "lastUpdated" = NOW()
      `;

      // Oppdater også heartbeat
      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          lastHeartbeat: new Date(),
          totalUsers: statsData.totalUsers || 0,
          totalBookings: statsData.totalBookings || 0,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Statistikk hentet og oppdatert",
        stats: statsData,
      });
    } catch (fetchError) {
      console.error("Fetch error:", fetchError);
      return NextResponse.json(
        { error: `Kunne ikke kontakte SportFlow-appen: ${(fetchError as Error).message}` },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("Stats fetch error:", error);
    return NextResponse.json(
      { error: "Intern serverfeil" },
      { status: 500 }
    );
  }
}

