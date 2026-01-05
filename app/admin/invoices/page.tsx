"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LICENSE_TYPES, calculateMonthlyPrice, getLicensePrice, LicenseType } from "@/lib/license-config";

type Organization = {
  id: string;
  name: string;
  slug: string;
  contactEmail: string;
  contactName: string | null;
  licenseType: string;
  isActive: boolean;
  expiresAt: string;
};

type Invoice = {
  id: string;
  invoiceNumber: string;
  organizationId: string;
  organization: Organization;
  periodMonth: number;
  periodYear: number;
  amount: number;
  basePrice: number;
  modulePrice: number;
  vatAmount: number;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
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
  iban: string | null;
  swift: string | null;
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
  
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);
  
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [selectedOrgForInvoice, setSelectedOrgForInvoice] = useState<string | null>(null);
  const [invoicePeriod, setInvoicePeriod] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });
  
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
    } catch (err) {
      console.error("Kunne ikke laste organisasjoner:", err);
    }
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
    } catch (err) {
      console.error("Kunne ikke laste bedriftsinnstillinger:", err);
    }
  };

  const updateOrgStatus = async (org: Organization, status: string, expiresAt?: string) => {
    try {
      const response = await fetch("/api/license/update", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": password },
        body: JSON.stringify({
          slug: org.slug,
          isActive: status !== "inactive",
          licenseType: status === "inactive" ? org.licenseType : status,
          ...(expiresAt && { expiresAt })
        })
      });
      if (response.ok) {
        await loadOrganizations(password);
        setSuccess("Status oppdatert");
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch {
      setError("Kunne ikke oppdatere status");
    }
  };

  const createInvoice = async () => {
    if (!selectedOrgForInvoice) return;
    
    try {
      const response = await fetch("/api/invoices/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": password
        },
        body: JSON.stringify({
          organizationId: selectedOrgForInvoice,
          periodMonth: invoicePeriod.month,
          periodYear: invoicePeriod.year
        })
      });

      if (response.ok) {
        await loadInvoices(password);
        setShowCreateInvoice(false);
        setSelectedOrgForInvoice(null);
        setSuccess("Faktura opprettet");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        const data = await response.json();
        setError(data.error || "Kunne ikke opprette faktura");
      }
    } catch {
      setError("Nettverksfeil");
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
        body: JSON.stringify({
          status,
          paidDate: paidDate || null
        })
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
    if (!confirm("Er du sikker på at du vil slette denne fakturaen? Dette kan ikke angres.")) {
      return;
    }

    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: "DELETE",
        headers: {
          "x-admin-secret": password
        }
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
    return new Date(date).toLocaleDateString("nb-NO", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  };

  const getMonthName = (month: number) => {
    return new Date(2000, month - 1).toLocaleDateString("nb-NO", { month: "long" });
  };

  const getFilteredInvoices = () => {
    if (selectedStatus === "all") return invoices;
    return invoices.filter(inv => inv.status === selectedStatus);
  };

  const getOrgInvoices = (orgId: string) => {
    return invoices.filter(inv => inv.organizationId === orgId);
  };

  const getOrgOutstanding = (orgId: string) => {
    return invoices
      .filter(inv => inv.organizationId === orgId && (inv.status === "sent" || inv.status === "overdue"))
      .reduce((sum, inv) => sum + inv.amount, 0);
  };

  const statusColors: Record<string, { color: string; bg: string }> = {
    draft: { color: "#6b7280", bg: "rgba(107, 114, 128, 0.15)" },
    sent: { color: "#3b82f6", bg: "rgba(59, 130, 246, 0.15)" },
    paid: { color: "#22c55e", bg: "rgba(34, 197, 94, 0.15)" },
    overdue: { color: "#ef4444", bg: "rgba(239, 68, 68, 0.15)" },
    cancelled: { color: "#6b7280", bg: "rgba(107, 114, 128, 0.15)" }
  };

  const statusLabels: Record<string, string> = {
    draft: "Kladd",
    sent: "Sendt",
    paid: "Betalt",
    overdue: "Forfalt",
    cancelled: "Kansellert"
  };

  const licenseColors: Record<string, { color: string; bg: string }> = {
    inactive: { color: "#6b7280", bg: "rgba(107,114,128,0.15)" },
    pilot: { color: "#a855f7", bg: "rgba(168,85,247,0.15)" },
    free: { color: "#22c55e", bg: "rgba(34,197,94,0.15)" },
    standard: { color: "#3b82f6", bg: "rgba(59,130,246,0.15)" }
  };

  const licenseLabels: Record<string, string> = {
    inactive: "Inaktiv",
    pilot: "Pilot",
    free: "Prøve",
    standard: "Standard"
  };

  // Statistikk
  const totalOutstanding = invoices
    .filter(inv => inv.status === "sent" || inv.status === "overdue")
    .reduce((sum, inv) => sum + inv.amount, 0);
  
  const totalPaidThisMonth = invoices
    .filter(inv => {
      if (inv.status !== "paid" || !inv.paidDate) return false;
      const paidDate = new Date(inv.paidDate);
      const now = new Date();
      return paidDate.getMonth() === now.getMonth() && paidDate.getFullYear() === now.getFullYear();
    })
    .reduce((sum, inv) => sum + inv.amount, 0);

  const overdueCount = invoices.filter(inv => inv.status === "overdue").length;
  const activeCustomers = organizations.filter(o => o.isActive).length;

  if (loading) {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.loadingSpinner} />
        <p>Laster...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <img src="/sportflow-logo-dark.png" alt="SportFlow" style={styles.logo} />
          <span style={styles.logoText}>Admin</span>
        </div>
        
        <nav style={styles.nav}>
          <button style={styles.navItem} onClick={() => router.push("/admin")}>
            <span>🏢</span> Kunder
          </button>
          <button style={styles.navItemActive}>
            <span>📄</span> Fakturaer
          </button>
          <button style={styles.navItem} onClick={() => router.push("/admin/prices")}>
            <span>💰</span> Priser
          </button>
          <button style={styles.navItem} onClick={() => router.push("/admin/settings")}>
            <span>⚙️</span> Innstillinger
          </button>
        </nav>

        <div style={styles.sidebarStats}>
          <div style={styles.sidebarStatItem}>
            <span style={styles.sidebarStatLabel}>Utestående</span>
            <span style={{ ...styles.sidebarStatValue, color: "#ef4444" }}>{totalOutstanding.toLocaleString()} kr</span>
          </div>
          <div style={styles.sidebarStatItem}>
            <span style={styles.sidebarStatLabel}>Betalt mnd</span>
            <span style={{ ...styles.sidebarStatValue, color: "#22c55e" }}>{totalPaidThisMonth.toLocaleString()} kr</span>
          </div>
          <div style={styles.sidebarStatItem}>
            <span style={styles.sidebarStatLabel}>Forfalt</span>
            <span style={{ ...styles.sidebarStatValue, color: overdueCount > 0 ? "#ef4444" : "#666" }}>{overdueCount}</span>
          </div>
          <div style={styles.sidebarStatItem}>
            <span style={styles.sidebarStatLabel}>Aktive</span>
            <span style={styles.sidebarStatValue}>{activeCustomers}</span>
          </div>
        </div>

        <button style={styles.logoutBtn} onClick={() => {
          sessionStorage.removeItem("adminPassword");
          document.cookie = "admin-auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
          router.push("/admin/login");
        }}>
          Logg ut
        </button>
      </aside>

      {/* Main Content */}
      <main style={styles.main}>
        {/* Header */}
        <header style={styles.header}>
          <div>
            <h1 style={styles.pageTitle}>Fakturaer & Kunder</h1>
            <p style={styles.pageSubtitle}>Administrer fakturaer, betalinger og kundestatus</p>
          </div>
          <div style={styles.headerActions}>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={styles.filterSelect}
            >
              <option value="all">Alle statuser</option>
              <option value="draft">Kladd</option>
              <option value="sent">Sendt</option>
              <option value="paid">Betalt</option>
              <option value="overdue">Forfalt</option>
              <option value="cancelled">Kansellert</option>
            </select>
            <button style={styles.primaryBtn} onClick={() => setShowCreateInvoice(true)}>
              + Ny faktura
            </button>
          </div>
        </header>

        {/* Messages */}
        {error && (
          <div style={styles.errorMsg}>
            {error}
            <button onClick={() => setError("")} style={styles.closeBtn}>×</button>
          </div>
        )}
        {success && (
          <div style={styles.successMsg}>
            {success}
            <button onClick={() => setSuccess("")} style={styles.closeBtn}>×</button>
          </div>
        )}

        {/* Create Invoice Form */}
        {showCreateInvoice && (
          <div style={styles.createForm}>
            <h3 style={styles.formTitle}>Opprett ny faktura</h3>
            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Kunde</label>
                <select
                  value={selectedOrgForInvoice || ""}
                  onChange={(e) => setSelectedOrgForInvoice(e.target.value)}
                  style={styles.select}
                >
                  <option value="">Velg kunde</option>
                  {organizations
                    .filter(org => org.isActive)
                    .map(org => (
                      <option key={org.id} value={org.id}>
                        {org.name} ({licenseLabels[org.licenseType] || org.licenseType})
                      </option>
                    ))}
                </select>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Måned</label>
                <select
                  value={invoicePeriod.month}
                  onChange={(e) => setInvoicePeriod({ ...invoicePeriod, month: parseInt(e.target.value) })}
                  style={styles.select}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                    <option key={month} value={month}>{getMonthName(month)}</option>
                  ))}
                </select>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>År</label>
                <select
                  value={invoicePeriod.year}
                  onChange={(e) => setInvoicePeriod({ ...invoicePeriod, year: parseInt(e.target.value) })}
                  style={styles.select}
                >
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              <div style={styles.formActions}>
                <button
                  onClick={createInvoice}
                  style={styles.primaryBtn}
                  disabled={!selectedOrgForInvoice}
                >
                  Opprett
                </button>
                <button
                  onClick={() => {
                    setShowCreateInvoice(false);
                    setSelectedOrgForInvoice(null);
                  }}
                  style={styles.cancelBtn}
                >
                  Avbryt
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Customer Cards with Invoices */}
        <div style={styles.customerGrid}>
          {organizations.map(org => {
            const orgInvoices = getOrgInvoices(org.id);
            const filteredInvoices = selectedStatus === "all" 
              ? orgInvoices 
              : orgInvoices.filter(inv => inv.status === selectedStatus);
            const outstanding = getOrgOutstanding(org.id);
            const isExpanded = expandedOrg === org.id;
            const currentLicense = org.isActive ? org.licenseType : "inactive";
            const licenseInfo = licenseColors[currentLicense] || licenseColors.inactive;

            // Skip if filter active and no matching invoices (unless showing all)
            if (selectedStatus !== "all" && filteredInvoices.length === 0) return null;

            return (
              <div key={org.id} style={styles.customerCard}>
                {/* Card Header */}
                <div style={styles.cardHeader} onClick={() => setExpandedOrg(isExpanded ? null : org.id)}>
                  <div style={styles.cardHeaderLeft}>
                    <div style={styles.customerAvatar}>
                      {org.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={styles.customerInfo}>
                      <h3 style={styles.customerName}>{org.name}</h3>
                      <p style={styles.customerMeta}>{org.contactEmail}</p>
                    </div>
                  </div>
                  <div style={styles.cardHeaderCenter}>
                    <span style={{ 
                      ...styles.licenseBadge, 
                      color: licenseInfo.color, 
                      background: licenseInfo.bg 
                    }}>
                      {licenseLabels[currentLicense] || currentLicense}
                    </span>
                  </div>
                  <div style={styles.cardHeaderRight}>
                    {outstanding > 0 ? (
                      <span style={styles.outstandingBadge}>{outstanding.toLocaleString()} kr</span>
                    ) : (
                      <span style={styles.paidUpBadge}>✓ Ajour</span>
                    )}
                    <span style={styles.invoiceCount}>{orgInvoices.length} fakturaer</span>
                    <span style={styles.expandIcon}>{isExpanded ? "▲" : "▼"}</span>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div style={styles.cardBody}>
                    {/* License Type Selector */}
                    <div style={styles.licenseSection}>
                      <label style={styles.sectionLabel}>Kundestatus</label>
                      <div style={styles.licenseGrid}>
                        {["inactive", "pilot", "free", "standard"].map(s => {
                          const isSelected = currentLicense === s;
                          const colors = licenseColors[s];
                          return (
                            <button
                              key={s}
                              style={{
                                ...styles.licenseOption,
                                borderColor: isSelected ? colors.color : "#333",
                                background: isSelected ? colors.bg : "transparent",
                                color: isSelected ? colors.color : "#888"
                              }}
                              onClick={() => {
                                if (s === "inactive") {
                                  updateOrgStatus(org, "inactive");
                                } else {
                                  const newExpiry = new Date();
                                  newExpiry.setMonth(newExpiry.getMonth() + 1);
                                  updateOrgStatus(org, s, newExpiry.toISOString());
                                }
                              }}
                            >
                              {licenseLabels[s]}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Invoice List */}
                    <div style={styles.invoiceSection}>
                      <div style={styles.invoiceSectionHeader}>
                        <label style={styles.sectionLabel}>Fakturaer</label>
                        <button 
                          style={styles.smallBtn}
                          onClick={() => {
                            setSelectedOrgForInvoice(org.id);
                            setShowCreateInvoice(true);
                          }}
                        >
                          + Ny
                        </button>
                      </div>
                      
                      {filteredInvoices.length === 0 ? (
                        <p style={styles.noInvoices}>Ingen fakturaer</p>
                      ) : (
                        <div style={styles.invoiceList}>
                          {filteredInvoices.map(invoice => {
                            const statusInfo = statusColors[invoice.status];
                            const isOverdue = new Date(invoice.dueDate) < new Date() && invoice.status === "sent";
                            
                            return (
                              <div key={invoice.id} style={styles.invoiceItem}>
                                <div style={styles.invoiceItemLeft}>
                                  <span style={styles.invoiceNum}>{invoice.invoiceNumber}</span>
                                  <span style={styles.invoicePeriod}>
                                    {getMonthName(invoice.periodMonth)} {invoice.periodYear}
                                  </span>
                                </div>
                                <div style={styles.invoiceItemCenter}>
                                  <span style={styles.invoiceAmount}>{invoice.amount.toLocaleString()} kr</span>
                                  <span style={{ 
                                    ...styles.invoiceDue, 
                                    color: isOverdue ? "#ef4444" : "#666" 
                                  }}>
                                    Forfall: {formatDate(invoice.dueDate)}
                                  </span>
                                </div>
                                <div style={styles.invoiceItemRight}>
                                  <span style={{
                                    ...styles.statusBadge,
                                    color: statusInfo.color,
                                    background: statusInfo.bg
                                  }}>
                                    {statusLabels[invoice.status]}
                                  </span>
                                  <div style={styles.invoiceActions}>
                                    <button
                                      onClick={() => setPreviewInvoice(invoice)}
                                      style={styles.iconBtn}
                                      title="Vis faktura"
                                    >
                                      👁
                                    </button>
                                    {(invoice.status === "draft" || invoice.status === "sent") && (
                                      <button
                                        onClick={() => sendInvoiceByEmail(invoice)}
                                        disabled={sendingEmail === invoice.id}
                                        style={styles.iconBtn}
                                        title="Send e-post"
                                      >
                                        {sendingEmail === invoice.id ? "..." : "📧"}
                                      </button>
                                    )}
                                    {invoice.status === "draft" && (
                                      <button
                                        onClick={() => updateInvoiceStatus(invoice.id, "sent")}
                                        style={styles.iconBtn}
                                        title="Marker sendt"
                                      >
                                        📤
                                      </button>
                                    )}
                                    {(invoice.status === "sent" || invoice.status === "overdue") && (
                                      <button
                                        onClick={() => updateInvoiceStatus(invoice.id, "paid", new Date().toISOString())}
                                        style={{ ...styles.iconBtn, color: "#22c55e" }}
                                        title="Marker betalt"
                                      >
                                        ✓
                                      </button>
                                    )}
                                    {invoice.status !== "cancelled" && invoice.status !== "paid" && (
                                      <button
                                        onClick={() => updateInvoiceStatus(invoice.id, "cancelled")}
                                        style={{ ...styles.iconBtn, color: "#ef4444" }}
                                        title="Kanseller"
                                      >
                                        ✕
                                      </button>
                                    )}
                                    {invoice.status === "cancelled" && (
                                      <button
                                        onClick={() => deleteInvoice(invoice.id)}
                                        style={{ ...styles.iconBtn, color: "#7f1d1d" }}
                                        title="Slett"
                                      >
                                        🗑️
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Empty state */}
        {organizations.length === 0 && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📄</div>
            <h3>Ingen kunder</h3>
            <p>Opprett kunder fra Kunder-siden først</p>
          </div>
        )}
      </main>

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
                      const opt = {
                        margin: 10,
                        filename: `Faktura-${previewInvoice.invoiceNumber}.pdf`,
                        image: { type: "jpeg" as const, quality: 0.98 },
                        html2canvas: { scale: 2, useCORS: true },
                        jsPDF: { unit: "mm" as const, format: "a4" as const, orientation: "portrait" as const }
                      };
                      html2pdf().set(opt).from(invoiceEl).save();
                    }
                  }}
                  style={styles.downloadButton}
                >
                  📄 PDF
                </button>
                <button 
                  onClick={() => {
                    const invoiceEl = document.getElementById("invoice-document");
                    if (invoiceEl) {
                      const printWindow = window.open("", "_blank");
                      if (printWindow) {
                        printWindow.document.write(`
                          <!DOCTYPE html>
                          <html>
                          <head>
                            <title>Faktura ${previewInvoice.invoiceNumber}</title>
                            <style>
                              * { margin: 0; padding: 0; box-sizing: border-box; }
                              body { font-family: 'Segoe UI', sans-serif; font-size: 11px; padding: 20px; }
                              @media print { body { padding: 0; } @page { margin: 15mm; } }
                            </style>
                          </head>
                          <body>${invoiceEl.outerHTML}</body>
                          </html>
                        `);
                        printWindow.document.close();
                        setTimeout(() => printWindow.print(), 250);
                      }
                    }
                  }}
                  style={styles.printButton}
                >
                  🖨️
                </button>
                <button onClick={() => setPreviewInvoice(null)} style={styles.modalCloseBtn}>×</button>
              </div>
            </div>
            
            <div style={styles.invoicePreview}>
              <div id="invoice-document" style={styles.invoiceDocument}>
                {/* Header */}
                <div style={styles.invHeader}>
                  <div style={styles.invLogoSection}>
                    {companySettings.logoUrl ? (
                      <img src={companySettings.logoUrl} alt="Logo" style={styles.invLogo} />
                    ) : (
                      <div style={styles.invLogoPlaceholder}>
                        {companySettings.companyName?.charAt(0) || "S"}
                      </div>
                    )}
                  </div>
                  <div style={styles.invCompanySection}>
                    <div style={styles.invFakturaTitle}>FAKTURA</div>
                    <div style={styles.invCompanyInfo}>
                      <p style={styles.invCompanyName}>{companySettings.companyName}</p>
                      {companySettings.address && <p style={styles.invCompanyLine}>{companySettings.address}</p>}
                      {(companySettings.postalCode || companySettings.city) && (
                        <p style={styles.invCompanyLine}>{companySettings.postalCode} {companySettings.city}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div style={styles.invDetailsRow}>
                  <div style={styles.invRecipient}>
                    <p style={styles.invRecipientName}>{previewInvoice.organization.name}</p>
                    {previewInvoice.organization.contactName && (
                      <p style={styles.invRecipientLine}>v/ {previewInvoice.organization.contactName}</p>
                    )}
                    <p style={styles.invRecipientLine}>{previewInvoice.organization.contactEmail}</p>
                  </div>
                  <div style={styles.invMeta}>
                    <div style={styles.invMetaItem}>
                      <span style={styles.invMetaLabel}>Fakturadato:</span>
                      <span style={styles.invMetaValue}>{formatDate(previewInvoice.invoiceDate)}</span>
                    </div>
                    <div style={styles.invMetaItem}>
                      <span style={styles.invMetaLabel}>Fakturanr:</span>
                      <span style={styles.invMetaValue}>{previewInvoice.invoiceNumber.replace("INV-", "")}</span>
                    </div>
                    <div style={styles.invMetaItem}>
                      <span style={styles.invMetaLabel}>Forfallsdato:</span>
                      <span style={styles.invMetaValueRed}>{formatDate(previewInvoice.dueDate)}</span>
                    </div>
                  </div>
                </div>

                {/* Period */}
                <div style={styles.invPeriodRow}>
                  <span style={styles.invPeriodLabel}>Periode:</span>
                  <span style={styles.invPeriodValue}>{getMonthName(previewInvoice.periodMonth)} {previewInvoice.periodYear}</span>
                </div>

                {/* Table */}
                <div style={styles.invTable}>
                  <div style={styles.invTableHeader}>
                    <span style={styles.invColDesc}>BESKRIVELSE</span>
                    <span style={styles.invColPrice}>PRIS</span>
                    <span style={styles.invColQty}>ANT</span>
                    <span style={styles.invColAmount}>BELØP</span>
                  </div>
                  
                  <div style={styles.invTableRow}>
                    <span style={styles.invColDesc}>SportFlow Booking - {previewInvoice.licenseTypeName}</span>
                    <span style={styles.invColPrice}>{previewInvoice.basePrice.toLocaleString()}</span>
                    <span style={styles.invColQty}>1</span>
                    <span style={styles.invColAmount}>{previewInvoice.basePrice.toLocaleString()}</span>
                  </div>

                  {previewInvoice.modules && (() => {
                    try {
                      const modules = JSON.parse(previewInvoice.modules);
                      return modules.map((mod: { key: string; name: string; price: number }) => (
                        <div key={mod.key} style={styles.invTableRow}>
                          <span style={styles.invColDesc}>Tilleggsmodul: {mod.name}</span>
                          <span style={styles.invColPrice}>{mod.price.toLocaleString()}</span>
                          <span style={styles.invColQty}>1</span>
                          <span style={styles.invColAmount}>{mod.price.toLocaleString()}</span>
                        </div>
                      ));
                    } catch { return null; }
                  })()}
                </div>

                {/* Totals */}
                <div style={styles.invTotalsSection}>
                  {previewInvoice.vatAmount > 0 && (
                    <div style={styles.invSubtotalRow}>
                      <span>Netto:</span>
                      <span>{(previewInvoice.basePrice + previewInvoice.modulePrice).toLocaleString()} kr</span>
                    </div>
                  )}
                  {previewInvoice.vatAmount > 0 && (
                    <div style={styles.invSubtotalRow}>
                      <span>MVA ({companySettings.vatRate}%):</span>
                      <span>{previewInvoice.vatAmount.toLocaleString()} kr</span>
                    </div>
                  )}
                  <div style={styles.invGrandTotal}>
                    <span style={styles.invGrandTotalLabel}>Å BETALE</span>
                    <span style={styles.invGrandTotalValue}>{previewInvoice.amount.toLocaleString("nb-NO", { minimumFractionDigits: 2 })} kr</span>
                  </div>
                </div>

                {/* Payment */}
                <div style={styles.invPaymentSection}>
                  <div style={styles.invPaymentHeader}>
                    <span style={styles.invPaymentTitle}>BETALINGSINFORMASJON</span>
                    <div style={styles.invPaymentStripe}></div>
                  </div>
                  <div style={styles.invPaymentGrid}>
                    <div>
                      <p style={styles.invPaymentLabel}>Fakturanummer:</p>
                      <p style={styles.invPaymentValue}>{previewInvoice.invoiceNumber.replace("INV-", "")}</p>
                    </div>
                    {companySettings.bankAccount && (
                      <div>
                        <p style={styles.invPaymentLabel}>Bankkonto:</p>
                        <p style={styles.invPaymentValue}>{companySettings.bankAccount}</p>
                      </div>
                    )}
                  </div>
                  <p style={styles.invPaymentNotice}>Husk å merke betalingen med fakturanummer!</p>
                </div>

                {/* Footer */}
                <div style={styles.invFooter}>
                  <p><strong>{companySettings.companyName}</strong>
                    {companySettings.orgNumber && ` • Org.nr: ${companySettings.orgNumber}`}
                    {companySettings.email && ` • ${companySettings.email}`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: "flex",
    minHeight: "100vh",
    background: "#0a0a0a",
    color: "#fff",
  },
  loadingScreen: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    background: "#0a0a0a",
    color: "#fff",
    gap: "1rem",
  },
  loadingSpinner: {
    width: "40px",
    height: "40px",
    border: "3px solid #333",
    borderTopColor: "#3b82f6",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  
  // Sidebar
  sidebar: {
    width: "220px",
    background: "#111",
    borderRight: "1px solid #222",
    display: "flex",
    flexDirection: "column",
    padding: "1.25rem 1rem",
    flexShrink: 0,
  },
  sidebarHeader: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    marginBottom: "1.5rem",
    paddingBottom: "1rem",
    borderBottom: "1px solid #222",
  },
  logo: {
    height: "28px",
    width: "auto",
  },
  logoText: {
    fontSize: "1rem",
    fontWeight: "600",
    color: "#fff",
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
    flex: 1,
  },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "0.7rem 0.9rem",
    background: "transparent",
    border: "none",
    borderRadius: "6px",
    color: "#888",
    fontSize: "0.85rem",
    cursor: "pointer",
    textAlign: "left",
  },
  navItemActive: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "0.7rem 0.9rem",
    background: "rgba(59,130,246,0.15)",
    border: "none",
    borderRadius: "6px",
    color: "#3b82f6",
    fontSize: "0.85rem",
    cursor: "pointer",
    textAlign: "left",
    fontWeight: "500",
  },
  sidebarStats: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    padding: "0.75rem",
    background: "#1a1a1a",
    borderRadius: "8px",
    marginBottom: "1rem",
  },
  sidebarStatItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sidebarStatValue: {
    fontSize: "0.9rem",
    fontWeight: "600",
    color: "#fff",
  },
  sidebarStatLabel: {
    fontSize: "0.75rem",
    color: "#666",
  },
  logoutBtn: {
    padding: "0.6rem",
    background: "transparent",
    border: "1px solid #333",
    borderRadius: "6px",
    color: "#666",
    cursor: "pointer",
    fontSize: "0.8rem",
  },

  // Main
  main: {
    flex: 1,
    padding: "1.5rem 2rem",
    overflowY: "auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1.5rem",
  },
  pageTitle: {
    fontSize: "1.5rem",
    fontWeight: "700",
    margin: 0,
  },
  pageSubtitle: {
    fontSize: "0.85rem",
    color: "#666",
    margin: "0.25rem 0 0 0",
  },
  headerActions: {
    display: "flex",
    gap: "0.75rem",
    alignItems: "center",
  },
  filterSelect: {
    padding: "0.6rem 1rem",
    background: "#1a1a1a",
    border: "1px solid #333",
    borderRadius: "6px",
    color: "#fff",
    fontSize: "0.85rem",
  },
  primaryBtn: {
    padding: "0.6rem 1.25rem",
    background: "#3b82f6",
    border: "none",
    borderRadius: "6px",
    color: "#fff",
    fontSize: "0.85rem",
    fontWeight: "500",
    cursor: "pointer",
  },
  cancelBtn: {
    padding: "0.6rem 1.25rem",
    background: "transparent",
    border: "1px solid #333",
    borderRadius: "6px",
    color: "#888",
    fontSize: "0.85rem",
    cursor: "pointer",
  },
  smallBtn: {
    padding: "0.35rem 0.75rem",
    background: "#262626",
    border: "none",
    borderRadius: "4px",
    color: "#fff",
    fontSize: "0.75rem",
    cursor: "pointer",
  },

  // Messages
  errorMsg: {
    display: "flex",
    justifyContent: "space-between",
    padding: "0.75rem 1rem",
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: "6px",
    color: "#f87171",
    marginBottom: "1rem",
    fontSize: "0.85rem",
  },
  successMsg: {
    display: "flex",
    justifyContent: "space-between",
    padding: "0.75rem 1rem",
    background: "rgba(34,197,94,0.1)",
    border: "1px solid rgba(34,197,94,0.3)",
    borderRadius: "6px",
    color: "#4ade80",
    marginBottom: "1rem",
    fontSize: "0.85rem",
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "inherit",
    fontSize: "1.1rem",
    cursor: "pointer",
  },

  // Create Form
  createForm: {
    background: "#111",
    borderRadius: "8px",
    padding: "1.25rem",
    marginBottom: "1.5rem",
    border: "1px solid #222",
  },
  formTitle: {
    fontSize: "0.95rem",
    fontWeight: "600",
    margin: "0 0 1rem 0",
  },
  formRow: {
    display: "flex",
    gap: "1rem",
    alignItems: "flex-end",
    flexWrap: "wrap",
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "0.4rem",
    minWidth: "150px",
    flex: 1,
  },
  label: {
    fontSize: "0.75rem",
    color: "#888",
  },
  select: {
    padding: "0.6rem",
    background: "#1a1a1a",
    border: "1px solid #333",
    borderRadius: "6px",
    color: "#fff",
    fontSize: "0.85rem",
  },
  formActions: {
    display: "flex",
    gap: "0.5rem",
    alignItems: "center",
  },

  // Customer Grid
  customerGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  customerCard: {
    background: "#111",
    borderRadius: "10px",
    border: "1px solid #222",
    overflow: "hidden",
  },
  cardHeader: {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    padding: "1rem 1.25rem",
    cursor: "pointer",
    gap: "1rem",
  },
  cardHeaderLeft: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
  },
  customerAvatar: {
    width: "40px",
    height: "40px",
    borderRadius: "8px",
    background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "1rem",
    fontWeight: "600",
    color: "#fff",
    flexShrink: 0,
  },
  customerInfo: {
    minWidth: 0,
  },
  customerName: {
    fontSize: "0.95rem",
    fontWeight: "600",
    margin: 0,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  customerMeta: {
    fontSize: "0.75rem",
    color: "#666",
    margin: "0.15rem 0 0 0",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  cardHeaderCenter: {
    display: "flex",
    justifyContent: "center",
  },
  licenseBadge: {
    padding: "0.35rem 0.75rem",
    borderRadius: "6px",
    fontSize: "0.75rem",
    fontWeight: "500",
  },
  cardHeaderRight: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "1rem",
  },
  outstandingBadge: {
    padding: "0.3rem 0.6rem",
    background: "rgba(239,68,68,0.15)",
    color: "#ef4444",
    borderRadius: "4px",
    fontSize: "0.75rem",
    fontWeight: "600",
  },
  paidUpBadge: {
    padding: "0.3rem 0.6rem",
    background: "rgba(34,197,94,0.15)",
    color: "#22c55e",
    borderRadius: "4px",
    fontSize: "0.75rem",
  },
  invoiceCount: {
    fontSize: "0.75rem",
    color: "#666",
  },
  expandIcon: {
    fontSize: "0.65rem",
    color: "#666",
  },

  // Card Body
  cardBody: {
    borderTop: "1px solid #222",
    padding: "1.25rem",
  },
  licenseSection: {
    marginBottom: "1.25rem",
  },
  sectionLabel: {
    fontSize: "0.7rem",
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: "0.5rem",
    display: "block",
  },
  licenseGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "0.5rem",
  },
  licenseOption: {
    padding: "0.5rem",
    background: "transparent",
    border: "1px solid #333",
    borderRadius: "6px",
    color: "#888",
    fontSize: "0.8rem",
    cursor: "pointer",
    transition: "all 0.15s",
  },
  invoiceSection: {},
  invoiceSectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "0.75rem",
  },
  noInvoices: {
    fontSize: "0.85rem",
    color: "#666",
    textAlign: "center",
    padding: "1rem",
  },
  invoiceList: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  invoiceItem: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    alignItems: "center",
    padding: "0.75rem 1rem",
    background: "#0a0a0a",
    borderRadius: "6px",
    gap: "1rem",
  },
  invoiceItemLeft: {
    display: "flex",
    flexDirection: "column",
    gap: "0.15rem",
  },
  invoiceNum: {
    fontSize: "0.85rem",
    fontWeight: "500",
  },
  invoicePeriod: {
    fontSize: "0.7rem",
    color: "#666",
  },
  invoiceItemCenter: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.15rem",
  },
  invoiceAmount: {
    fontSize: "0.9rem",
    fontWeight: "600",
  },
  invoiceDue: {
    fontSize: "0.7rem",
  },
  invoiceItemRight: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "0.75rem",
  },
  statusBadge: {
    padding: "0.25rem 0.5rem",
    borderRadius: "4px",
    fontSize: "0.7rem",
    fontWeight: "500",
  },
  invoiceActions: {
    display: "flex",
    gap: "0.25rem",
  },
  iconBtn: {
    padding: "0.35rem 0.5rem",
    background: "#222",
    border: "none",
    borderRadius: "4px",
    color: "#fff",
    cursor: "pointer",
    fontSize: "0.75rem",
  },

  // Empty State
  emptyState: {
    textAlign: "center",
    padding: "4rem 2rem",
    background: "#111",
    borderRadius: "12px",
    border: "1px solid #222",
  },
  emptyIcon: {
    fontSize: "3rem",
    marginBottom: "1rem",
  },

  // Modal
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0, 0, 0, 0.85)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "2rem",
  },
  previewModal: {
    background: "#111",
    borderRadius: "12px",
    maxWidth: "750px",
    width: "100%",
    maxHeight: "90vh",
    overflow: "auto",
    border: "1px solid #222",
  },
  previewHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "1rem 1.25rem",
    borderBottom: "1px solid #222",
    position: "sticky",
    top: 0,
    background: "#111",
  },
  previewTitle: {
    fontSize: "1rem",
    fontWeight: "600",
    margin: 0,
  },
  previewActions: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  downloadButton: {
    padding: "0.4rem 0.75rem",
    background: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    fontSize: "0.8rem",
  },
  printButton: {
    padding: "0.4rem 0.6rem",
    background: "#333",
    color: "#fff",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    fontSize: "0.8rem",
  },
  modalCloseBtn: {
    padding: "0.4rem 0.6rem",
    background: "none",
    border: "none",
    color: "#888",
    fontSize: "1.25rem",
    cursor: "pointer",
  },
  invoicePreview: {
    padding: "1.25rem",
  },
  invoiceDocument: {
    background: "#fff",
    color: "#1a1a1a",
    borderRadius: "4px",
    fontFamily: "'Segoe UI', sans-serif",
    fontSize: "11px",
    lineHeight: "1.4",
    padding: "35px",
  },
  
  // Invoice Document Styles
  invHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "25px",
  },
  invLogoSection: {},
  invLogo: {
    maxWidth: "180px",
    maxHeight: "60px",
    objectFit: "contain",
  },
  invLogoPlaceholder: {
    width: "60px",
    height: "60px",
    background: "#3b82f6",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontSize: "24px",
    fontWeight: "700",
    borderRadius: "8px",
  },
  invCompanySection: {
    textAlign: "right",
  },
  invFakturaTitle: {
    fontSize: "24px",
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: "8px",
    letterSpacing: "2px",
  },
  invCompanyInfo: {},
  invCompanyName: {
    fontSize: "12px",
    fontWeight: "600",
    margin: "0 0 2px 0",
  },
  invCompanyLine: {
    fontSize: "10px",
    color: "#666",
    margin: "2px 0",
  },
  invDetailsRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "20px",
    paddingBottom: "15px",
    borderBottom: "1px solid #e5e7eb",
  },
  invRecipient: {},
  invRecipientName: {
    fontSize: "12px",
    fontWeight: "600",
    margin: "0 0 4px 0",
  },
  invRecipientLine: {
    fontSize: "10px",
    color: "#666",
    margin: "2px 0",
  },
  invMeta: {
    textAlign: "right",
  },
  invMetaItem: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    marginBottom: "3px",
  },
  invMetaLabel: {
    fontSize: "10px",
    color: "#666",
  },
  invMetaValue: {
    fontSize: "10px",
    fontWeight: "600",
    minWidth: "70px",
    textAlign: "right",
  },
  invMetaValueRed: {
    fontSize: "10px",
    fontWeight: "700",
    color: "#dc2626",
    minWidth: "70px",
    textAlign: "right",
  },
  invPeriodRow: {
    marginBottom: "15px",
    fontSize: "10px",
  },
  invPeriodLabel: {
    color: "#666",
    marginRight: "6px",
  },
  invPeriodValue: {
    fontWeight: "600",
  },
  invTable: {
    marginBottom: "15px",
  },
  invTableHeader: {
    display: "grid",
    gridTemplateColumns: "1fr 70px 40px 80px",
    gap: "8px",
    padding: "6px 0",
    borderBottom: "1px solid #d1d5db",
    fontSize: "9px",
    fontWeight: "600",
    color: "#666",
    textTransform: "uppercase",
  },
  invTableRow: {
    display: "grid",
    gridTemplateColumns: "1fr 70px 40px 80px",
    gap: "8px",
    padding: "10px 0",
    borderBottom: "1px solid #f3f4f6",
    fontSize: "10px",
  },
  invColDesc: {},
  invColPrice: { textAlign: "right" },
  invColQty: { textAlign: "center" },
  invColAmount: { textAlign: "right", fontWeight: "500" },
  invTotalsSection: {
    marginBottom: "20px",
  },
  invSubtotalRow: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "30px",
    fontSize: "10px",
    color: "#666",
    padding: "4px 0",
  },
  invGrandTotal: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 0",
    borderTop: "2px solid #1a1a1a",
    marginTop: "8px",
  },
  invGrandTotalLabel: {
    fontSize: "12px",
    fontWeight: "700",
  },
  invGrandTotalValue: {
    fontSize: "16px",
    fontWeight: "700",
  },
  invPaymentSection: {
    marginTop: "20px",
    paddingTop: "15px",
    borderTop: "1px solid #e5e7eb",
  },
  invPaymentHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "12px",
  },
  invPaymentTitle: {
    fontSize: "10px",
    fontWeight: "700",
    letterSpacing: "1px",
    whiteSpace: "nowrap",
  },
  invPaymentStripe: {
    flex: 1,
    height: "3px",
    background: "linear-gradient(90deg, #fbbf24, #f59e0b)",
    borderRadius: "2px",
  },
  invPaymentGrid: {
    display: "flex",
    gap: "40px",
    fontSize: "10px",
    marginBottom: "10px",
  },
  invPaymentLabel: {
    color: "#666",
    margin: "0 0 2px 0",
  },
  invPaymentValue: {
    fontWeight: "600",
    margin: "0 0 8px 0",
  },
  invPaymentNotice: {
    fontSize: "9px",
    color: "#666",
    fontStyle: "italic",
  },
  invFooter: {
    marginTop: "25px",
    paddingTop: "12px",
    borderTop: "1px solid #e5e7eb",
    fontSize: "8px",
    color: "#999",
    textAlign: "center",
  },
};
