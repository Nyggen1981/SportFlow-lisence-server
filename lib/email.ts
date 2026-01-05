import nodemailer from "nodemailer";

// SMTP-konfigurasjon fra miljøvariabler
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "sleipner.domene.no",
  port: parseInt(process.env.SMTP_PORT || "465"),
  secure: true, // true for port 465 (SSL)
  auth: {
    user: process.env.SMTP_USER || "faktura@nyggensolutions.no",
    pass: process.env.SMTP_PASS,
  },
});

export type InvoiceEmailData = {
  to: string;
  customerName: string;
  invoiceNumber: string;
  amount: number;
  dueDate: string;
  periodMonth: string;
  periodYear: number;
  pdfBuffer?: Buffer;
  // Custom template fields
  emailSubject?: string | null;
  emailGreeting?: string | null;
  emailBody?: string | null;
  emailFooter?: string | null;
};

// Replace template variables in a string
function replaceTemplateVars(template: string, data: InvoiceEmailData): string {
  return template
    .replace(/\{customerName\}/g, data.customerName)
    .replace(/\{invoiceNumber\}/g, data.invoiceNumber)
    .replace(/\{amount\}/g, data.amount.toLocaleString("nb-NO") + " kr")
    .replace(/\{dueDate\}/g, data.dueDate)
    .replace(/\{period\}/g, `${data.periodMonth} ${data.periodYear}`);
}

export async function sendInvoiceEmail(data: InvoiceEmailData): Promise<{ success: boolean; error?: string }> {
  const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || "faktura@nyggensolutions.no";
  
  if (!process.env.SMTP_PASS) {
    return { success: false, error: "SMTP-passord er ikke konfigurert" };
  }

  // Use custom templates or defaults
  const subject = replaceTemplateVars(
    data.emailSubject || `Faktura {invoiceNumber} - SportFlow`,
    data
  );
  
  const greeting = replaceTemplateVars(
    data.emailGreeting || `Hei {customerName},`,
    data
  );
  
  const bodyText = replaceTemplateVars(
    data.emailBody || `Vedlagt finner du faktura for SportFlow-abonnementet ditt for {period}.\n\nFaktura er vedlagt som PDF. Vennligst betal innen forfallsdato {dueDate}.`,
    data
  );
  
  const footer = replaceTemplateVars(
    data.emailFooter || `Med vennlig hilsen,\nSportFlow`,
    data
  );

  const mailOptions: nodemailer.SendMailOptions = {
    from: `"SportFlow" <${fromEmail}>`,
    to: data.to,
    subject,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { height: 50px; }
          .invoice-box { background: #f9f9f9; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .invoice-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
          .invoice-row:last-child { border-bottom: none; }
          .invoice-total { font-size: 1.2em; font-weight: bold; color: #22c55e; }
          .due-date { background: #fff3cd; padding: 10px; border-radius: 4px; margin-top: 15px; }
          .footer { margin-top: 30px; font-size: 0.85em; color: #666; text-align: center; }
          .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="color: #3b82f6; margin: 0;">SportFlow</h1>
            <p style="color: #666; margin: 5px 0;">Faktura</p>
          </div>
          
          <p>${greeting}</p>
          
          <p>${bodyText.replace(/\n/g, "<br>")}</p>
          
          <div class="invoice-box">
            <div class="invoice-row">
              <span>Fakturanummer:</span>
              <strong>${data.invoiceNumber}</strong>
            </div>
            <div class="invoice-row">
              <span>Periode:</span>
              <span>${data.periodMonth} ${data.periodYear}</span>
            </div>
            <div class="invoice-row invoice-total">
              <span>Beløp:</span>
              <span>${data.amount.toLocaleString("nb-NO")} kr</span>
            </div>
            <div class="due-date">
              <strong>⏰ Forfallsdato:</strong> ${data.dueDate}
            </div>
          </div>
          
          <p>Har du spørsmål? Svar gjerne på denne e-posten.</p>
          
          <div class="footer">
            <p>${footer.replace(/\n/g, "<br>")}</p>
            <p style="color: #999; font-size: 0.8em;">
              Denne e-posten ble sendt fra SportFlow Administration Server.
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
${greeting}

${bodyText}

Fakturanummer: ${data.invoiceNumber}
Periode: ${data.periodMonth} ${data.periodYear}
Beløp: ${data.amount.toLocaleString("nb-NO")} kr
Forfallsdato: ${data.dueDate}

${footer}
    `.trim(),
    attachments: data.pdfBuffer ? [
      {
        filename: `${data.invoiceNumber}.pdf`,
        content: data.pdfBuffer,
        contentType: "application/pdf",
      },
    ] : [],
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("E-post sending feilet:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Ukjent feil ved sending av e-post" 
    };
  }
}

// Test SMTP-tilkobling
export async function testSmtpConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    await transporter.verify();
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Kunne ikke koble til SMTP-server" 
    };
  }
}

