"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminLayout, { sharedStyles } from "../components/AdminLayout";

type Organization = {
  id: string;
  name: string;
  slug: string;
  contactEmail: string;
  contactName: string | null;
  licenseType: string;
  isActive: boolean;
};

type Invoice = {
  id: string;
  invoiceNumber: string;
  organizationId: string;
  organization: Organization;
  periodMonth: number;
  periodYear: number;
  periodMonths: number;
  amount: number;
  basePrice: number;
  modulePrice: number;
  vatAmount: number;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled" | "refunded";
  invoiceDate: string;
  dueDate: string;
  paidDate: string | null;
  licenseType: string;
  licenseTypeName: string;
  modules: string | null;
  notes: string | null;
};

type CompanySettings = {
  id: string;
  companyName: string;
  orgNumber: string | null;
  vatNumber: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  country: string;
  bankAccount: string | null;
  bankName: string | null;
  logoUrl: string | null;
  invoicePrefix: string;
  defaultDueDays: number;
  vatRate: number;
  invoiceNote: string | null;
  paymentTerms: string | null;
};

export default function InvoicesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  
  // Filters
  const [filterOrg, setFilterOrg] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createOrgId, setCreateOrgId] = useState<string>("");
  const [createPeriod, setCreatePeriod] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });
  const [createPeriodMonths, setCreatePeriodMonths] = useState<number>(1);
  const [creating, setCreating] = useState(false);
  
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/admin/check");
        const data = await response.json();
        
        if (!data.authenticated) {
          router.push("/admin/login");
          return;
        }
        
        const storedPassword = sessionStorage.getItem("adminPassword");
        if (storedPassword) {
          setPassword(storedPassword);
          await Promise.all([
            loadInvoices(storedPassword),
            loadOrganizations(storedPassword),
            loadCompanySettings(storedPassword)
          ]);
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Auth check failed:", error);
        router.push("/admin/login");
      }
    };

    checkAuth();
  }, [router]);

  const loadInvoices = async (adminPassword: string) => {
    try {
      const response = await fetch("/api/invoices/list", {
        headers: { "x-admin-secret": adminPassword }
      });
      if (response.ok) {
        const data = await response.json();
        setInvoices(data.invoices || []);
      }
    } catch (err) {
      console.error("Kunne ikke laste fakturaer:", err);
    }
  };

  const loadOrganizations = async (adminPassword: string) => {
    try {
      const response = await fetch("/api/license/list", {
        headers: { "x-admin-secret": adminPassword }
      });
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data.organizations || []);
      }
    } catch {}
  };

  const loadCompanySettings = async (adminPassword: string) => {
    try {
      const response = await fetch("/api/settings/company", {
        headers: { "x-admin-secret": adminPassword }
      });
      if (response.ok) {
        const data = await response.json();
        setCompanySettings(data.settings);
      }
    } catch {}
  };

  const createInvoice = async () => {
    if (!createOrgId) {
      setError("Velg en kunde");
      return;
    }
    
    setCreating(true);
    try {
      const response = await fetch("/api/invoices/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": password
        },
        body: JSON.stringify({
          organizationId: createOrgId,
          periodMonth: createPeriod.month,
          periodYear: createPeriod.year,
          periodMonths: createPeriodMonths
        })
      });

      if (response.ok) {
        await loadInvoices(password);
        setShowCreateModal(false);
        setCreateOrgId("");
        setCreatePeriodMonths(1);
        setSuccess("Faktura opprettet");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        const data = await response.json();
        setError(data.error || "Kunne ikke opprette faktura");
      }
    } catch {
      setError("Nettverksfeil");
    } finally {
      setCreating(false);
    }
  };

  const updateInvoiceStatus = async (invoiceId: string, status: string, paidDate?: string | null) => {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": password
        },
        body: JSON.stringify({ status, paidDate: paidDate || null })
      });

      if (response.ok) {
        await loadInvoices(password);
        setSuccess("Faktura oppdatert");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError("Kunne ikke oppdatere faktura");
      }
    } catch {
      setError("Nettverksfeil");
    }
  };

  const sendInvoiceByEmail = async (invoice: Invoice) => {
    setSendingEmail(invoice.id);
    setError("");
    
    try {
      const response = await fetch(`/api/invoices/${invoice.id}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": password
        }
      });

      const data = await response.json();

      if (response.ok) {
        await loadInvoices(password);
        setSuccess(`Faktura sendt til ${data.sentTo}`);
        setTimeout(() => setSuccess(""), 5000);
      } else {
        setError(data.error || "Kunne ikke sende e-post");
      }
    } catch {
      setError("Nettverksfeil ved sending av e-post");
    } finally {
      setSendingEmail(null);
    }
  };

  const deleteInvoice = async (invoiceId: string) => {
    const invoice = invoices.find(i => i.id === invoiceId);
    if (!invoice) return;
    
    let message = "Er du sikker på at du vil slette denne fakturaen?";
    if (invoice.status === "paid") {
      message = "⚠️ ADVARSEL: Denne fakturaen er BETALT. Er du helt sikker på at du vil slette den permanent?";
    } else if (invoice.status === "sent" || invoice.status === "overdue") {
      message = "⚠️ Denne fakturaen er sendt til kunden. Er du sikker på at du vil slette den?";
    }
    
    if (!confirm(message)) return;

    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: "DELETE",
        headers: { "x-admin-secret": password }
      });

      if (response.ok) {
        await loadInvoices(password);
        setSuccess("Faktura slettet");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        const data = await response.json();
        setError(data.error || "Kunne ikke slette faktura");
      }
    } catch {
      setError("Nettverksfeil");
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("nb-NO", { day: "numeric", month: "short", year: "numeric" });
  };

  const getMonthName = (month: number) => {
    return new Date(2000, month - 1).toLocaleDateString("nb-NO", { month: "long" });
  };

  const formatPeriod = (startMonth: number, startYear: number, months: number = 1) => {
    if (months === 1) {
      return `${getMonthName(startMonth)} ${startYear}`;
    }
    if (months === 12) {
      return `${startYear} (helår)`;
    }
    const endMonth = ((startMonth - 1 + months - 1) % 12) + 1;
    const endYear = startYear + Math.floor((startMonth - 1 + months - 1) / 12);
    return `${getMonthName(startMonth)} – ${getMonthName(endMonth)} ${endYear}`;
  };

  const statusColors: Record<string, { color: string; bg: string }> = {
    draft: { color: "#6b7280", bg: "rgba(107, 114, 128, 0.15)" },
    sent: { color: "#3b82f6", bg: "rgba(59, 130, 246, 0.15)" },
    paid: { color: "#22c55e", bg: "rgba(34, 197, 94, 0.15)" },
    overdue: { color: "#ef4444", bg: "rgba(239, 68, 68, 0.15)" },
    cancelled: { color: "#6b7280", bg: "rgba(107, 114, 128, 0.15)" },
    refunded: { color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)" }
  };

  const statusLabels: Record<string, string> = {
    draft: "Kladd", sent: "Sendt", paid: "Betalt", overdue: "Forfalt", cancelled: "Kansellert", refunded: "Refundert"
  };

  // Filter invoices
  const filteredInvoices = invoices.filter(inv => {
    if (filterOrg !== "all" && inv.organizationId !== filterOrg) return false;
    if (filterStatus !== "all" && inv.status !== filterStatus) return false;
    return true;
  }).sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());

  // Stats
  const totalOutstanding = invoices
    .filter(inv => inv.status === "sent" || inv.status === "overdue")
    .reduce((sum, inv) => sum + inv.amount, 0);
  const overdueCount = invoices.filter(inv => inv.status === "overdue").length;
  const paidThisMonth = invoices
    .filter(inv => {
      if (inv.status !== "paid" || !inv.paidDate) return false;
      const paid = new Date(inv.paidDate);
      const now = new Date();
      return paid.getMonth() === now.getMonth() && paid.getFullYear() === now.getFullYear();
    })
    .reduce((sum, inv) => sum + inv.amount, 0);

  if (loading) {
    return (
      <div style={sharedStyles.loadingScreen}>
        <div style={sharedStyles.loadingSpinner} />
        <p>Laster...</p>
      </div>
    );
  }

  return (
    <AdminLayout stats={[
      { label: "utestående", value: `${totalOutstanding.toLocaleString()} kr`, color: overdueCount > 0 ? "#ef4444" : "#3b82f6" },
      { label: "betalt denne mnd", value: `${paidThisMonth.toLocaleString()} kr`, color: "#22c55e" }
    ]}>
      {/* Header */}
      <header style={sharedStyles.pageHeader}>
        <div>
          <h1 style={sharedStyles.pageTitle}>Fakturaer</h1>
          <p style={sharedStyles.pageSubtitle}>{invoices.length} fakturaer totalt</p>
        </div>
        <button style={sharedStyles.primaryBtn} onClick={() => setShowCreateModal(true)}>
          + Ny faktura
        </button>
      </header>

      {/* Messages */}
      {error && (
        <div style={sharedStyles.errorMsg}>
          {error}
          <button onClick={() => setError("")} style={sharedStyles.closeBtn}>×</button>
        </div>
      )}
      {success && (
        <div style={sharedStyles.successMsg}>
          {success}
          <button onClick={() => setSuccess("")} style={sharedStyles.closeBtn}>×</button>
        </div>
      )}

      {/* Filters */}
      <div style={styles.filters}>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Kunde</label>
          <select 
            value={filterOrg} 
            onChange={e => setFilterOrg(e.target.value)}
            style={styles.filterSelect}
          >
            <option value="all">Alle kunder</option>
            {organizations.map(org => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Status</label>
          <select 
            value={filterStatus} 
            onChange={e => setFilterStatus(e.target.value)}
            style={styles.filterSelect}
          >
            <option value="all">Alle statuser</option>
            <option value="draft">Kladd</option>
            <option value="sent">Sendt</option>
            <option value="paid">Betalt</option>
            <option value="overdue">Forfalt</option>
            <option value="cancelled">Kansellert</option>
            <option value="refunded">Refundert</option>
          </select>
        </div>
        {(filterOrg !== "all" || filterStatus !== "all") && (
          <button 
            style={styles.clearFilters}
            onClick={() => { setFilterOrg("all"); setFilterStatus("all"); }}
          >
            Nullstill filter
          </button>
        )}
      </div>

      {/* Invoice List */}
      <div style={styles.invoiceList}>
        {filteredInvoices.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📄</div>
            <h3>Ingen fakturaer</h3>
            <p>{invoices.length === 0 ? "Opprett din første faktura" : "Ingen fakturaer matcher filteret"}</p>
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div style={styles.tableHeader}>
              <span style={styles.colNumber}>Fakturanr</span>
              <span style={styles.colCustomer}>Kunde</span>
              <span style={styles.colPeriod}>Periode</span>
              <span style={styles.colAmount}>Beløp</span>
              <span style={styles.colStatus}>Status</span>
              <span style={styles.colActions}>Handlinger</span>
            </div>

            {/* Invoice Rows */}
            {filteredInvoices.map(invoice => {
              const statusStyle = statusColors[invoice.status] || statusColors.draft;
              
              return (
                <div key={invoice.id} style={styles.invoiceRow}>
                  <span style={styles.colNumber}>
                    <button 
                      style={styles.invoiceLink}
                      onClick={() => setPreviewInvoice(invoice)}
                    >
                      {invoice.invoiceNumber}
                    </button>
                  </span>
                  <span style={styles.colCustomer}>
                    <span style={styles.customerName}>{invoice.organization.name}</span>
                  </span>
                  <span style={styles.colPeriod}>
                    {formatPeriod(invoice.periodMonth, invoice.periodYear, invoice.periodMonths || 1)}
                  </span>
                  <span style={styles.colAmount}>
                    {invoice.amount.toLocaleString()} kr
                  </span>
                  <span style={styles.colStatus}>
                    <span style={{ ...styles.statusBadge, color: statusStyle.color, background: statusStyle.bg }}>
                      {statusLabels[invoice.status]}
                    </span>
                  </span>
                  <span style={styles.colActions}>
                    {invoice.status === "draft" && (
                      <>
                        <button
                          style={styles.actionBtn}
                          onClick={() => sendInvoiceByEmail(invoice)}
                          disabled={sendingEmail === invoice.id}
                          title="Send på e-post"
                        >
                          {sendingEmail === invoice.id ? "..." : "📧"}
                        </button>
                        <button
                          style={styles.actionBtn}
                          onClick={() => updateInvoiceStatus(invoice.id, "sent")}
                          title="Marker som sendt"
                        >
                          ✓
                        </button>
                      </>
                    )}
                    {(invoice.status === "sent" || invoice.status === "overdue") && (
                      <>
                        <button
                          style={{ ...styles.actionBtn, color: "#22c55e" }}
                          onClick={() => updateInvoiceStatus(invoice.id, "paid", new Date().toISOString())}
                          title="Marker som betalt"
                        >
                          💰
                        </button>
                        <button
                          style={{ ...styles.actionBtn, color: "#f59e0b" }}
                          onClick={() => {
                            if (confirm("Vil du kansellere denne fakturaen?")) {
                              updateInvoiceStatus(invoice.id, "cancelled");
                            }
                          }}
                          title="Kanseller"
                        >
                          ✕
                        </button>
                      </>
                    )}
                    {invoice.status === "paid" && (
                      <button
                        style={{ ...styles.actionBtn, color: "#f59e0b" }}
                        onClick={() => {
                          if (confirm("Vil du refundere denne fakturaen? Statusen endres til 'Refundert'.")) {
                            updateInvoiceStatus(invoice.id, "refunded");
                          }
                        }}
                        title="Refunder"
                      >
                        ↩️
                      </button>
                    )}
                    <button
                      style={styles.actionBtn}
                      onClick={() => setPreviewInvoice(invoice)}
                      title="Vis faktura"
                    >
                      👁
                    </button>
                    <button
                      style={{ ...styles.actionBtn, color: "#ef4444" }}
                      onClick={() => deleteInvoice(invoice.id)}
                      title="Slett"
                    >
                      🗑
                    </button>
                  </span>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Create Invoice Modal */}
      {showCreateModal && (
        <div style={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Ny faktura</h2>
            
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Kunde *</label>
              <select
                value={createOrgId}
                onChange={e => setCreateOrgId(e.target.value)}
                style={styles.formSelect}
              >
                <option value="">Velg kunde...</option>
                {organizations.filter(o => o.isActive).map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Faktureres for</label>
              <div style={styles.periodButtons}>
                {[
                  { value: 1, label: "1 mnd" },
                  { value: 3, label: "3 mnd" },
                  { value: 6, label: "6 mnd" },
                  { value: 12, label: "1 år" }
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    style={{
                      ...styles.periodBtn,
                      ...(createPeriodMonths === opt.value ? styles.periodBtnActive : {})
                    }}
                    onClick={() => setCreatePeriodMonths(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Fra måned</label>
                <select
                  value={createPeriod.month}
                  onChange={e => setCreatePeriod({ ...createPeriod, month: parseInt(e.target.value) })}
                  style={styles.formSelect}
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>{getMonthName(i + 1)}</option>
                  ))}
                </select>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>År</label>
                <select
                  value={createPeriod.year}
                  onChange={e => setCreatePeriod({ ...createPeriod, year: parseInt(e.target.value) })}
                  style={styles.formSelect}
                >
                  {[2024, 2025, 2026, 2027].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            {createPeriodMonths > 1 && (
              <p style={styles.periodHint}>
                Periode: {getMonthName(createPeriod.month)} {createPeriod.year} – {
                  (() => {
                    const endMonth = ((createPeriod.month - 1 + createPeriodMonths - 1) % 12) + 1;
                    const endYear = createPeriod.year + Math.floor((createPeriod.month - 1 + createPeriodMonths - 1) / 12);
                    return `${getMonthName(endMonth)} ${endYear}`;
                  })()
                }
              </p>
            )}

            <div style={styles.modalActions}>
              <button style={styles.cancelBtn} onClick={() => setShowCreateModal(false)}>
                Avbryt
              </button>
              <button 
                style={sharedStyles.primaryBtn} 
                onClick={createInvoice}
                disabled={creating || !createOrgId}
              >
                {creating ? "Oppretter..." : "Opprett faktura"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Preview Modal */}
      {previewInvoice && companySettings && (
        <div style={styles.modalOverlay} onClick={() => setPreviewInvoice(null)}>
          <div style={styles.previewModal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.previewHeader}>
              <h2 style={styles.previewTitle}>Faktura {previewInvoice.invoiceNumber}</h2>
              <div style={styles.previewActions}>
                <button 
                  onClick={async () => {
                    const invoiceEl = document.getElementById("invoice-document");
                    if (invoiceEl) {
                      const html2pdf = (await import("html2pdf.js")).default;
                      html2pdf().set({
                        margin: 10,
                        filename: `Faktura-${previewInvoice.invoiceNumber}.pdf`,
                        image: { type: "jpeg" as const, quality: 0.98 },
                        html2canvas: { scale: 2, useCORS: true },
                        jsPDF: { unit: "mm" as const, format: "a4" as const, orientation: "portrait" as const }
                      }).from(invoiceEl).save();
                    }
                  }}
                  style={styles.downloadBtn}
                >
                  📄 PDF
                </button>
                <button onClick={() => setPreviewInvoice(null)} style={styles.modalCloseBtn}>×</button>
              </div>
            </div>
            
            <div style={styles.invoicePreview}>
              <div id="invoice-document" style={styles.invoiceDocument}>
                {/* Main content area */}
                <div style={styles.invMainContent}>
                  {/* Header: Logo left, FAKTURA + company right */}
                  <div style={styles.invHeader}>
                    <div style={styles.invLogoSection}>
                      {companySettings.logoUrl ? (
                        <img src={companySettings.logoUrl} alt="Logo" style={styles.invLogo} />
                      ) : (
                        <div style={styles.invLogoPlaceholder}>{companySettings.companyName?.charAt(0) || "S"}</div>
                      )}
                    </div>
                    <div style={styles.invHeaderRight}>
                      <h1 style={styles.invTitle}>FAKTURA</h1>
                      <p style={styles.invCompanyName}>{companySettings.companyName}</p>
                      {companySettings.address && <p style={styles.invCompanyInfo}>{companySettings.address}</p>}
                      {companySettings.postalCode && <p style={styles.invCompanyInfo}>{companySettings.postalCode} {companySettings.city}</p>}
                    </div>
                  </div>

                  {/* Customer info left, dates right */}
                  <div style={styles.invInfoRow}>
                    <div style={styles.invCustomer}>
                      <p style={styles.invCustomerName}>{previewInvoice.organization.name}</p>
                      {previewInvoice.organization.contactName && (
                        <p style={styles.invCustomerDetail}>v/ {previewInvoice.organization.contactName}</p>
                      )}
                      <p style={styles.invCustomerDetail}>{previewInvoice.organization.contactEmail}</p>
                    </div>
                    <div style={styles.invDates}>
                      <div style={styles.invDateRow}>
                        <span style={styles.invDateLabel}>Fakturadato:</span>
                        <span style={styles.invDateValue}>{formatDate(previewInvoice.invoiceDate)}</span>
                        <span style={styles.invDateLabel}>Fakturanr.:</span>
                        <span style={styles.invDateValueBold}>{previewInvoice.invoiceNumber}</span>
                      </div>
                      <div style={styles.invDateRow}>
                        <span style={styles.invDateLabel}></span>
                        <span style={styles.invDateValue}></span>
                        <span style={styles.invDateLabel}>Forfallsdato:</span>
                        <span style={{ ...styles.invDateValueBold, color: "#c00" }}>{formatDate(previewInvoice.dueDate)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Period */}
                  <div style={styles.invPeriod}>
                    <span style={styles.invPeriodLabel}>Periode:</span>
                    <span style={styles.invPeriodValue}>{formatPeriod(previewInvoice.periodMonth, previewInvoice.periodYear, previewInvoice.periodMonths || 1)}</span>
                  </div>

                  {/* Table */}
                  <div style={styles.invTable}>
                    <div style={styles.invTableHeader}>
                      <span style={styles.invColDesc}>BESKRIVELSE</span>
                      <span style={styles.invColPrice}>PRIS</span>
                      <span style={styles.invColQty}>ANTALL</span>
                      <span style={styles.invColAmount}>BELØP</span>
                    </div>
                    <div style={styles.invTableRow}>
                      <span style={styles.invColDesc}>SportFlow Booking - {previewInvoice.licenseTypeName}</span>
                      <span style={styles.invColPrice}>{Math.round(previewInvoice.basePrice / (previewInvoice.periodMonths || 1))}</span>
                      <span style={styles.invColQty}>{previewInvoice.periodMonths || 1}</span>
                      <span style={styles.invColAmount}>{previewInvoice.basePrice}</span>
                    </div>
                    {previewInvoice.modules && JSON.parse(previewInvoice.modules).map((mod: { name: string; price: number }, i: number) => (
                      <div key={i} style={styles.invTableRow}>
                        <span style={styles.invColDesc}>Tilleggsmodul: {mod.name}</span>
                        <span style={styles.invColPrice}>{Math.round(mod.price / (previewInvoice.periodMonths || 1))}</span>
                        <span style={styles.invColQty}>{previewInvoice.periodMonths || 1}</span>
                        <span style={styles.invColAmount}>{mod.price}</span>
                      </div>
                    ))}
                  </div>

                  {/* Total */}
                  <div style={styles.invTotalSection}>
                    <div style={styles.invTotalRow}>
                      <span style={styles.invTotalLabel}>Å BETALE</span>
                      <span style={styles.invTotalValue}>{previewInvoice.amount.toLocaleString("nb-NO", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom section - pushed to bottom */}
                <div style={styles.invBottomSection}>
                  {/* Payment terms */}
                  <p style={styles.invTerms}>
                    <em>Betalingsfrist: 14 dager fra fakturadato. Ta kontakt dersom fakturaen ikke stemmer.</em>
                  </p>

                  {/* Payment info */}
                  <div style={styles.invPaymentSection}>
                    <div style={styles.invPaymentHeader}>
                      <span>BETALINGSINFORMASJON</span>
                      <div style={styles.invPaymentLine}></div>
                    </div>
                    <div style={styles.invPaymentContent}>
                      <div style={styles.invPaymentLeft}>
                        <p style={styles.invPaymentLabel}>Fakturanummer:</p>
                        <p style={styles.invPaymentValue}>{previewInvoice.invoiceNumber}</p>
                        <p style={styles.invPaymentLabel}>Sum å betale:</p>
                        <p style={styles.invPaymentValue}>{previewInvoice.amount.toLocaleString("nb-NO", { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div style={styles.invPaymentRight}>
                        <p style={styles.invPaymentHighlight}>Husk å merke betalingen med fakturanummer!</p>
                        <p style={styles.invPaymentLabel}>Bankkonto:</p>
                        <p style={styles.invPaymentValue}>{companySettings.bankAccount}</p>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div style={styles.invFooter}>
                    <span style={styles.invFooterCompany}>{companySettings.companyName}</span>
                    {companySettings.orgNumber && <span> // Org.nr: {companySettings.orgNumber}</span>}
                    {companySettings.phone && <span> // TELEFON: {companySettings.phone}</span>}
                    {companySettings.email && <span> // E-POST: {companySettings.email}</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  // Filters
  filters: {
    display: "flex",
    gap: "1rem",
    alignItems: "flex-end",
    marginBottom: "1.5rem",
    flexWrap: "wrap",
  },
  filterGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "0.4rem",
  },
  filterLabel: {
    fontSize: "0.7rem",
    color: "#666",
    textTransform: "uppercase",
  },
  filterSelect: {
    padding: "0.5rem 0.75rem",
    background: "#111",
    border: "1px solid #333",
    borderRadius: "6px",
    color: "#fff",
    fontSize: "0.85rem",
    minWidth: "160px",
  },
  clearFilters: {
    padding: "0.5rem 0.75rem",
    background: "transparent",
    border: "1px solid #333",
    borderRadius: "6px",
    color: "#888",
    fontSize: "0.8rem",
    cursor: "pointer",
  },

  // Invoice List
  invoiceList: {
    background: "#111",
    borderRadius: "10px",
    border: "1px solid #222",
    overflow: "hidden",
  },
  emptyState: {
    textAlign: "center",
    padding: "3rem 2rem",
    color: "#666",
  },
  emptyIcon: {
    fontSize: "2.5rem",
    marginBottom: "1rem",
  },
  tableHeader: {
    display: "grid",
    gridTemplateColumns: "120px 1fr 140px 100px 100px 140px",
    gap: "0.5rem",
    padding: "0.75rem 1rem",
    background: "#0a0a0a",
    borderBottom: "1px solid #222",
    fontSize: "0.7rem",
    color: "#666",
    textTransform: "uppercase",
    fontWeight: "600",
  },
  invoiceRow: {
    display: "grid",
    gridTemplateColumns: "120px 1fr 140px 100px 100px 140px",
    gap: "0.5rem",
    padding: "0.85rem 1rem",
    borderBottom: "1px solid #1a1a1a",
    alignItems: "center",
    fontSize: "0.85rem",
  },
  colNumber: {},
  colCustomer: {},
  colPeriod: { color: "#888" },
  colAmount: { fontWeight: "500" },
  colStatus: {},
  colActions: {
    display: "flex",
    gap: "0.25rem",
  },
  invoiceLink: {
    background: "none",
    border: "none",
    color: "#3b82f6",
    cursor: "pointer",
    fontSize: "0.85rem",
    fontWeight: "500",
  },
  customerName: {
    fontWeight: "500",
  },
  statusBadge: {
    padding: "0.25rem 0.5rem",
    borderRadius: "4px",
    fontSize: "0.75rem",
    fontWeight: "500",
  },
  actionBtn: {
    padding: "0.35rem 0.5rem",
    background: "#1a1a1a",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "0.8rem",
  },

  // Modal
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
    padding: "1rem",
  },
  modal: {
    background: "#111",
    borderRadius: "12px",
    border: "1px solid #222",
    padding: "1.5rem",
    width: "100%",
    maxWidth: "400px",
  },
  modalTitle: {
    fontSize: "1.1rem",
    fontWeight: "600",
    margin: "0 0 1.25rem 0",
  },
  formGroup: {
    marginBottom: "1rem",
    flex: 1,
  },
  formRow: {
    display: "flex",
    gap: "1rem",
  },
  formLabel: {
    display: "block",
    marginBottom: "0.4rem",
    fontSize: "0.8rem",
    color: "#888",
  },
  formSelect: {
    width: "100%",
    padding: "0.6rem 0.75rem",
    background: "#0a0a0a",
    border: "1px solid #333",
    borderRadius: "6px",
    color: "#fff",
    fontSize: "0.85rem",
  },
  periodButtons: {
    display: "flex",
    gap: "0.5rem",
  },
  periodBtn: {
    flex: 1,
    padding: "0.6rem",
    background: "#0a0a0a",
    border: "1px solid #333",
    borderRadius: "6px",
    color: "#888",
    cursor: "pointer",
    fontSize: "0.85rem",
    fontWeight: "500",
  },
  periodBtnActive: {
    background: "rgba(59,130,246,0.15)",
    borderColor: "#3b82f6",
    color: "#3b82f6",
  },
  periodHint: {
    fontSize: "0.8rem",
    color: "#22c55e",
    margin: "0 0 1rem 0",
    padding: "0.5rem 0.75rem",
    background: "rgba(34,197,94,0.1)",
    borderRadius: "6px",
  },
  modalActions: {
    display: "flex",
    gap: "0.75rem",
    marginTop: "1.5rem",
    justifyContent: "flex-end",
  },
  cancelBtn: {
    padding: "0.6rem 1rem",
    background: "transparent",
    border: "1px solid #333",
    borderRadius: "6px",
    color: "#888",
    cursor: "pointer",
    fontSize: "0.85rem",
  },

  // Preview Modal
  previewModal: {
    background: "#111",
    borderRadius: "12px",
    border: "1px solid #222",
    width: "100%",
    maxWidth: "700px",
    maxHeight: "90vh",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  previewHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "1rem 1.25rem",
    borderBottom: "1px solid #222",
  },
  previewTitle: {
    fontSize: "1rem",
    fontWeight: "600",
    margin: 0,
  },
  previewActions: {
    display: "flex",
    gap: "0.5rem",
  },
  downloadBtn: {
    padding: "0.4rem 0.75rem",
    background: "#3b82f6",
    border: "none",
    borderRadius: "5px",
    color: "#fff",
    cursor: "pointer",
    fontSize: "0.8rem",
  },
  modalCloseBtn: {
    padding: "0.4rem 0.6rem",
    background: "#222",
    border: "none",
    borderRadius: "5px",
    color: "#888",
    cursor: "pointer",
    fontSize: "1rem",
  },
  invoicePreview: {
    padding: "1rem",
    overflowY: "auto",
    flex: 1,
    background: "#e5e5e5",
  },
  invoiceDocument: {
    background: "#fff",
    color: "#000",
    padding: "3rem",
    borderRadius: "0",
    fontSize: "13px",
    lineHeight: 1.6,
    fontFamily: "Arial, sans-serif",
    boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
    display: "flex",
    flexDirection: "column",
    minHeight: "297mm", // A4 height
  },
  invMainContent: {
    flex: 1,
  },
  invBottomSection: {
    marginTop: "auto",
  },
  invHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "2.5rem",
  },
  invLogoSection: {},
  invLogo: {
    maxWidth: "180px",
    maxHeight: "70px",
  },
  invLogoPlaceholder: {
    width: "70px",
    height: "70px",
    background: "#333",
    color: "#fff",
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "28px",
    fontWeight: "bold",
  },
  invHeaderRight: {
    textAlign: "right",
  },
  invTitle: {
    fontSize: "32px",
    fontWeight: "bold",
    margin: 0,
    color: "#000",
    letterSpacing: "2px",
  },
  invCompanyName: {
    fontSize: "14px",
    fontWeight: "600",
    margin: "0.5rem 0 0 0",
  },
  invCompanyInfo: {
    fontSize: "12px",
    color: "#666",
    margin: "0.1rem 0 0 0",
  },
  invInfoRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "2rem",
  },
  invCustomer: {},
  invCustomerName: {
    fontSize: "16px",
    fontWeight: "600",
    margin: 0,
  },
  invCustomerDetail: {
    fontSize: "13px",
    color: "#444",
    margin: "0.2rem 0 0 0",
  },
  invDates: {},
  invDateRow: {
    display: "flex",
    gap: "0.5rem",
    marginBottom: "0.25rem",
  },
  invDateLabel: {
    fontSize: "12px",
    color: "#888",
    minWidth: "80px",
  },
  invDateValue: {
    fontSize: "12px",
    minWidth: "80px",
  },
  invDateValueBold: {
    fontSize: "12px",
    fontWeight: "600",
    minWidth: "80px",
  },
  invPeriod: {
    marginBottom: "1.5rem",
    fontSize: "13px",
  },
  invPeriodLabel: {
    color: "#888",
  },
  invPeriodValue: {
    fontWeight: "600",
    marginLeft: "0.5rem",
  },
  invTable: {
    marginBottom: "1.5rem",
    borderTop: "1px solid #ddd",
  },
  invTableHeader: {
    display: "flex",
    padding: "0.6rem 0",
    borderBottom: "1px solid #ddd",
    fontSize: "11px",
    color: "#888",
    textTransform: "uppercase",
  },
  invTableRow: {
    display: "flex",
    padding: "0.75rem 0",
    borderBottom: "1px solid #eee",
    fontSize: "13px",
  },
  invColDesc: { flex: 3 },
  invColPrice: { width: "70px", textAlign: "right" },
  invColQty: { width: "70px", textAlign: "center" },
  invColAmount: { width: "80px", textAlign: "right" },
  invTotalSection: {
    borderTop: "1px solid #ddd",
    paddingTop: "1rem",
    marginBottom: "1.5rem",
  },
  invTotalRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  invTotalLabel: {
    fontSize: "14px",
    fontWeight: "600",
  },
  invTotalValue: {
    fontSize: "18px",
    fontWeight: "600",
  },
  invTerms: {
    fontSize: "11px",
    color: "#888",
    marginBottom: "1.5rem",
  },
  invPaymentSection: {
    marginBottom: "1.5rem",
  },
  invPaymentHeader: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    marginBottom: "1rem",
    fontSize: "11px",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: "0.3px",
  },
  invPaymentLine: {
    flex: 1,
    height: "2px",
    background: "linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)",
  },
  invPaymentContent: {
    display: "flex",
    gap: "4rem",
  },
  invPaymentLeft: {},
  invPaymentRight: {},
  invPaymentLabel: {
    fontSize: "11px",
    color: "#888",
    margin: "0.5rem 0 0.15rem 0",
  },
  invPaymentValue: {
    fontSize: "13px",
    fontWeight: "500",
    margin: 0,
  },
  invPaymentHighlight: {
    fontSize: "12px",
    fontWeight: "600",
    color: "#222",
    marginBottom: "0.75rem",
  },
  invFooter: {
    textAlign: "center",
    color: "#888",
    fontSize: "11px",
    paddingTop: "1.5rem",
    marginTop: "1.5rem",
    borderTop: "1px solid #eee",
  },
  invFooterCompany: {
    fontWeight: "600",
    fontStyle: "italic",
  },
};
