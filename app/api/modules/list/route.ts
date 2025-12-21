import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function isAuthorized(request: Request): boolean {
  const adminSecretHeader = request.headers.get("x-admin-secret") ?? "";
  const expected = process.env.LICENSE_ADMIN_PASSWORD ?? "";
  return expected.length > 0 && adminSecretHeader === expected;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const modules = await prisma.module.findMany({
      orderBy: [
        { isStandard: "desc" },
        { name: "asc" }
      ]
    });

    return NextResponse.json({ modules });
  } catch (error) {
    console.error("List modules error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

