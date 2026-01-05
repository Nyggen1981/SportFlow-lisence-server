import { NextRequest, NextResponse } from "next/server";
import { testSmtpConnection, sendInvoiceEmail } from "@/lib/email";

// POST /api/email/test - Test SMTP-tilkobling og send test-e-post
export async function POST(request: NextRequest) {
  try {
    const adminSecret = request.headers.get("x-admin-secret");
    const storedPassword = process.env.LICENSE_ADMIN_PASSWORD;

    if (!adminSecret || adminSecret !== storedPassword) {
      return NextResponse.json({ error: "Uautorisert" }, { status: 401 });
    }

    const body = await request.json();
    const { testEmail } = body;

    // Sjekk miljøvariabler
    const config = {
      SMTP_HOST: process.env.SMTP_HOST || "(ikke satt)",
      SMTP_PORT: process.env.SMTP_PORT || "(ikke satt)",
      SMTP_USER: process.env.SMTP_USER || "(ikke satt)",
      SMTP_PASS: process.env.SMTP_PASS ? "***satt***" : "(IKKE SATT!)",
      SMTP_FROM: process.env.SMTP_FROM || process.env.SMTP_USER || "(ikke satt)",
    };

    // Test SMTP-tilkobling
    const connectionTest = await testSmtpConnection();

    if (!connectionTest.success) {
      return NextResponse.json({
        success: false,
        step: "connection",
        error: connectionTest.error,
        config,
        hint: "Sjekk at SMTP-innstillingene er korrekte i Vercel Environment Variables"
      });
    }

    // Hvis test-e-post er oppgitt, send den
    if (testEmail) {
      const emailResult = await sendInvoiceEmail({
        to: testEmail,
        customerName: "Test Bruker",
        invoiceNumber: "TEST-001",
        amount: 999,
        dueDate: new Date().toLocaleDateString("nb-NO"),
        periodMonth: "januar",
        periodYear: 2026,
      });

      if (!emailResult.success) {
        return NextResponse.json({
          success: false,
          step: "sending",
          error: emailResult.error,
          config,
          connectionOk: true,
        });
      }

      return NextResponse.json({
        success: true,
        message: `Test-e-post sendt til ${testEmail}`,
        config,
      });
    }

    return NextResponse.json({
      success: true,
      message: "SMTP-tilkobling OK",
      config,
      hint: "Legg til 'testEmail' i request body for å sende en test-e-post"
    });
  } catch (error) {
    console.error("Email test error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Ukjent feil",
    }, { status: 500 });
  }
}

// GET - Vis SMTP-konfigurasjon (uten passord)
export async function GET(request: NextRequest) {
  const adminSecret = request.headers.get("x-admin-secret");
  const storedPassword = process.env.LICENSE_ADMIN_PASSWORD;

  if (!adminSecret || adminSecret !== storedPassword) {
    return NextResponse.json({ error: "Uautorisert" }, { status: 401 });
  }

  return NextResponse.json({
    config: {
      SMTP_HOST: process.env.SMTP_HOST || "(ikke satt)",
      SMTP_PORT: process.env.SMTP_PORT || "(ikke satt)",
      SMTP_USER: process.env.SMTP_USER || "(ikke satt)",
      SMTP_PASS: process.env.SMTP_PASS ? "***konfigurert***" : "❌ IKKE SATT",
      SMTP_FROM: process.env.SMTP_FROM || "(bruker SMTP_USER)",
    }
  });
}

