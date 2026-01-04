import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/stats/report - Rapporter statistikk fra SportFlow-app
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { licenseKey, stats } = body;

    if (!licenseKey) {
      return NextResponse.json(
        { error: "Mangler licenseKey" },
        { status: 400 }
      );
    }

    if (!stats) {
      return NextResponse.json(
        { error: "Mangler stats-objekt" },
        { status: 400 }
      );
    }

    // Finn organisasjonen basert på lisensnøkkel
    const organization = await prisma.organization.findUnique({
      where: { licenseKey },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Ugyldig lisensnøkkel" },
        { status: 404 }
      );
    }

    // Oppdater eller opprett statistikk
    const updatedStats = await prisma.organizationStats.upsert({
      where: { organizationId: organization.id },
      update: {
        totalUsers: stats.totalUsers ?? 0,
        activeUsers: stats.activeUsers ?? 0,
        lastUserLogin: stats.lastUserLogin ? new Date(stats.lastUserLogin) : null,
        totalFacilities: stats.totalFacilities ?? 0,
        totalCategories: stats.totalCategories ?? 0,
        totalBookings: stats.totalBookings ?? 0,
        bookingsThisMonth: stats.bookingsThisMonth ?? 0,
        pendingBookings: stats.pendingBookings ?? 0,
        totalRoles: stats.totalRoles ?? 0,
        lastUpdated: new Date(),
      },
      create: {
        organizationId: organization.id,
        totalUsers: stats.totalUsers ?? 0,
        activeUsers: stats.activeUsers ?? 0,
        lastUserLogin: stats.lastUserLogin ? new Date(stats.lastUserLogin) : null,
        totalFacilities: stats.totalFacilities ?? 0,
        totalCategories: stats.totalCategories ?? 0,
        totalBookings: stats.totalBookings ?? 0,
        bookingsThisMonth: stats.bookingsThisMonth ?? 0,
        pendingBookings: stats.pendingBookings ?? 0,
        totalRoles: stats.totalRoles ?? 0,
      },
    });

    // Oppdater også heartbeat og summary-statistikk på organisasjonen
    await prisma.organization.update({
      where: { id: organization.id },
      data: {
        lastHeartbeat: new Date(),
        totalUsers: stats.totalUsers ?? 0,
        totalBookings: stats.totalBookings ?? 0,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Statistikk oppdatert",
      lastUpdated: updatedStats.lastUpdated,
    });
  } catch (error) {
    console.error("Stats report error:", error);
    return NextResponse.json(
      { error: "Intern serverfeil" },
      { status: 500 }
    );
  }
}

// GET /api/stats/report - Hent statistikk (krever admin)
export async function GET(request: NextRequest) {
  try {
    const adminSecret = request.headers.get("x-admin-secret");
    const storedPassword = process.env.ADMIN_PASSWORD;

    if (!adminSecret || adminSecret !== storedPassword) {
      return NextResponse.json(
        { error: "Uautorisert" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    if (organizationId) {
      // Hent statistikk for én organisasjon
      const stats = await prisma.organizationStats.findUnique({
        where: { organizationId },
        include: {
          organization: {
            select: {
              name: true,
              slug: true,
            },
          },
        },
      });

      return NextResponse.json({ stats });
    }

    // Hent alle statistikker
    const allStats = await prisma.organizationStats.findMany({
      include: {
        organization: {
          select: {
            name: true,
            slug: true,
            licenseType: true,
            isActive: true,
          },
        },
      },
      orderBy: { lastUpdated: "desc" },
    });

    return NextResponse.json({ stats: allStats });
  } catch (error) {
    console.error("Stats fetch error:", error);
    return NextResponse.json(
      { error: "Intern serverfeil" },
      { status: 500 }
    );
  }
}

