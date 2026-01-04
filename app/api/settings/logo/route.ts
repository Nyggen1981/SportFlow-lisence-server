import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function isAuthorized(request: Request): boolean {
  const adminSecretHeader = request.headers.get("x-admin-secret") ?? "";
  const expected = process.env.LICENSE_ADMIN_PASSWORD ?? "";
  return expected.length > 0 && adminSecretHeader === expected;
}

// POST: Last opp logo som base64
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("logo") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Sjekk filtype
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: PNG, JPEG, SVG, WebP" },
        { status: 400 }
      );
    }

    // Sjekk filstørrelse (maks 2MB)
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large. Max size: 2MB" },
        { status: 400 }
      );
    }

    // Konverter til base64
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    // Finn eksisterende innstillinger og oppdater
    let settings = await prisma.companySettings.findFirst();

    if (settings) {
      settings = await prisma.companySettings.update({
        where: { id: settings.id },
        data: { logoUrl: dataUrl }
      });
    } else {
      settings = await prisma.companySettings.create({
        data: {
          companyName: "SportFlow AS",
          logoUrl: dataUrl
        }
      });
    }

    return NextResponse.json({
      success: true,
      logoUrl: dataUrl
    });
  } catch (error) {
    console.error("Upload logo error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE: Slett logo
export async function DELETE(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await prisma.companySettings.findFirst();

    if (settings) {
      await prisma.companySettings.update({
        where: { id: settings.id },
        data: { logoUrl: null }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete logo error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


