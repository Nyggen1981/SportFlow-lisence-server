import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function isAuthorized(request: Request): boolean {
  const adminSecretHeader = request.headers.get("x-admin-secret") ?? "";
  const expected = process.env.LICENSE_ADMIN_PASSWORD ?? "";
  return expected.length > 0 && adminSecretHeader === expected;
}

// GET: Hent moduler for en organisasjon
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const org = await prisma.organization.findUnique({
      where: { id },
      include: {
        modules: {
          include: {
            module: true
          }
        }
      }
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    return NextResponse.json({ modules: org.modules });
  } catch (error) {
    console.error("Get organization modules error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: Aktiver/deaktiver modul for organisasjon
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { moduleId, isActive } = body;

  if (!moduleId || typeof isActive !== "boolean") {
    return NextResponse.json(
      { error: "moduleId and isActive are required" },
      { status: 400 }
    );
  }

  try {
    // Sjekk om organisasjon og modul eksisterer
    const org = await prisma.organization.findUnique({ where: { id } });
    const module = await prisma.module.findUnique({ where: { id: moduleId } });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    if (!module) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    // Hvis modulen er standard, må den alltid være aktivert
    // (Note: Booking er ikke lenger en modul, men kjernefunksjonalitet)
    if (module.isStandard && !isActive) {
      return NextResponse.json(
        { error: "Standard modules cannot be deactivated" },
        { status: 400 }
      );
    }

    // Opprett eller oppdater OrganizationModule
    const orgModule = await prisma.organizationModule.upsert({
      where: {
        organizationId_moduleId: {
          organizationId: id,
          moduleId: moduleId
        }
      },
      update: {
        isActive,
        activatedAt: isActive ? new Date() : undefined
      },
      create: {
        organizationId: id,
        moduleId: moduleId,
        isActive,
        activatedAt: new Date()
      }
    });

    return NextResponse.json({ 
      success: true,
      organizationModule: orgModule
    });
  } catch (error: any) {
    console.error("Update organization module error:", error);
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Module already exists for this organization" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

