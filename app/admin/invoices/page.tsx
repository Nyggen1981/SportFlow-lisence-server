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

type CustomerSummary = {
  organization: Organization;
  totalOutstanding: number;
  unpaidCount: number;
  lastInvoice: Invoice | null;
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
  
  const [activeTab, setActiveTab] = useState<"overview" | "invoices" | "settings">("overview");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [selectedOrgForInvoice, setSelectedOrgForInvoice] = useState<string | null>(null);
  const [invoicePeriod, setInvoicePeriod] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });
  
  const [editingSettings, setEditingSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState<Partial<CompanySettings>>({});
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);

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
        setSettingsForm(data.settings);
      }
    } catch (err) {
      console.error("Kunne ikke laste bedriftsinnstillinger:", err);
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
    } catch (err) {
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
    } catch (err) {
      setError("Nettverksfeil");
    }
  };

  const saveCompanySettings = async () => {
    try {
      const response = await fetch("/api/settings/company", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": password
        },
        body: JSON.stringify(settingsForm)
      });

      if (response.ok) {
        const data = await response.json();
        setCompanySettings(data.settings);
        setEditingSettings(false);
        setSuccess("Innstillinger lagret");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError("Kunne ikke lagre innstillinger");
      }
    } catch (err) {
      setError("Nettverksfeil");
    }
  };

  const uploadLogo = async (file: File) => {
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("logo", file);

      const response = await fetch("/api/settings/logo", {
        method: "POST",
        headers: {
          "x-admin-secret": password
        },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        setCompanySettings(prev => prev ? { ...prev, logoUrl: data.logoUrl } : null);
        setSettingsForm(prev => ({ ...prev, logoUrl: data.logoUrl }));
        setSuccess("Logo lastet opp");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        const data = await response.json();
        setError(data.error || "Kunne ikke laste opp logo");
      }
    } catch (err) {
      setError("Nettverksfeil");
    } finally {
      setUploadingLogo(false);
    }
  };

  const deleteLogo = async () => {
    try {
      const response = await fetch("/api/settings/logo", {
        method: "DELETE",
        headers: {
          "x-admin-secret": password
        }
      });

      if (response.ok) {
        setCompanySettings(prev => prev ? { ...prev, logoUrl: null } : null);
        setSettingsForm(prev => ({ ...prev, logoUrl: null }));
        setSuccess("Logo fjernet");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError("Kunne ikke fjerne logo");
      }
    } catch (err) {
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

  // Beregn kundeoversikt med utestående betalinger
  const getCustomerSummaries = (): CustomerSummary[] => {
    const summaries: CustomerSummary[] = [];
    
    organizations.forEach(org => {
      const orgInvoices = invoices.filter(inv => inv.organizationId === org.id);
      const unpaidInvoices = orgInvoices.filter(inv => 
        inv.status === "sent" || inv.status === "overdue"
      );
      
      const totalOutstanding = unpaidInvoices.reduce((sum, inv) => sum + inv.amount, 0);
      const lastInvoice = orgInvoices.length > 0 ? orgInvoices[0] : null;
      
      if (org.licenseType !== "inactive") {
        summaries.push({
          organization: org,
          totalOutstanding,
          unpaidCount: unpaidInvoices.length,
          lastInvoice
        });
      }
    });
    
    // Sorter etter utestående beløp (høyest først)
    return summaries.sort((a, b) => b.totalOutstanding - a.totalOutstanding);
  };

  const getFilteredInvoices = () => {
    if (selectedStatus === "all") return invoices;
    return invoices.filter(inv => inv.status === selectedStatus);
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

  if (loading) {
    return (
      <div style={styles.loading}>
        <p>Laster...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <img src="/sportflow-logo-dark.png" alt="SportFlow" style={styles.headerLogo} />
          <div>
            <h1 style={styles.title}>Fakturering</h1>
            <p style={styles.subtitle}>Administrer fakturaer og betalinger</p>
          </div>
        </div>
        <div style={styles.headerActions}>
          <button onClick={() => router.push("/admin")} style={styles.backButton}>
            ← Tilbake
          </button>
        </div>
      </header>

      {/* Messages */}
      {error && (
        <div style={styles.errorBox}>
          {error}
          <button onClick={() => setError("")} style={styles.closeButton}>×</button>
        </div>
      )}
      {success && (
        <div style={styles.successBox}>
          {success}
        </div>
      )}

      {/* Stats Cards */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <p style={styles.statLabel}>Utestående</p>
          <p style={{ ...styles.statValue, color: "#ef4444" }}>{totalOutstanding.toLocaleString()} kr</p>
        </div>
        <div style={styles.statCard}>
          <p style={styles.statLabel}>Betalt denne mnd</p>
          <p style={{ ...styles.statValue, color: "#22c55e" }}>{totalPaidThisMonth.toLocaleString()} kr</p>
        </div>
        <div style={styles.statCard}>
          <p style={styles.statLabel}>Forfalt</p>
          <p style={{ ...styles.statValue, color: overdueCount > 0 ? "#ef4444" : "#a3a3a3" }}>{overdueCount} fakturaer</p>
        </div>
        <div style={styles.statCard}>
          <p style={styles.statLabel}>Totalt fakturaer</p>
          <p style={styles.statValue}>{invoices.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        <button
          onClick={() => setActiveTab("overview")}
          style={activeTab === "overview" ? styles.tabActive : styles.tab}
        >
          Kundeoversikt
        </button>
        <button
          onClick={() => setActiveTab("invoices")}
          style={activeTab === "invoices" ? styles.tabActive : styles.tab}
        >
          Alle fakturaer
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          style={activeTab === "settings" ? styles.tabActive : styles.tab}
        >
          ⚙️ Innstillinger
        </button>
      </div>

      {/* Tab Content */}
      <div style={styles.content}>
        {/* Kundeoversikt */}
        {activeTab === "overview" && (
          <div>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Kunder med utestående betalinger</h2>
              <button onClick={() => setShowCreateInvoice(true)} style={styles.addButton}>
                + Opprett faktura
              </button>
            </div>

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
                        .filter(org => org.licenseType !== "inactive")
                        .map(org => (
                          <option key={org.id} value={org.id}>
                            {org.name} ({org.licenseType})
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
                </div>
                <div style={styles.formActions}>
                  <button
                    onClick={createInvoice}
                    style={styles.primaryButton}
                    disabled={!selectedOrgForInvoice}
                  >
                    Opprett faktura
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateInvoice(false);
                      setSelectedOrgForInvoice(null);
                    }}
                    style={styles.cancelButton}
                  >
                    Avbryt
                  </button>
                </div>
              </div>
            )}

            <div style={styles.customerList}>
              {getCustomerSummaries().map(summary => (
                <div key={summary.organization.id} style={styles.customerCard}>
                  <div style={styles.customerHeader}>
                    <div>
                      <h3 style={styles.customerName}>{summary.organization.name}</h3>
                      <p style={styles.customerEmail}>{summary.organization.contactEmail}</p>
                    </div>
                    <div style={styles.customerRight}>
                      {summary.totalOutstanding > 0 ? (
                        <p style={styles.outstandingAmount}>{summary.totalOutstanding.toLocaleString()} kr utestående</p>
                      ) : (
                        <p style={styles.paidUp}>✓ Ingen utestående</p>
                      )}
                      {summary.unpaidCount > 0 && (
                        <span style={styles.unpaidBadge}>{summary.unpaidCount} ubetalt</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Vis siste fakturaer for denne kunden */}
                  {invoices
                    .filter(inv => inv.organizationId === summary.organization.id)
                    .slice(0, 3)
                    .map(invoice => {
                      const statusInfo = statusColors[invoice.status];
                      return (
                        <div key={invoice.id} style={styles.invoiceRow}>
                          <div style={styles.invoiceRowLeft}>
                            <span style={styles.invoiceNum}>{invoice.invoiceNumber}</span>
                            <span style={styles.invoicePeriod}>
                              {getMonthName(invoice.periodMonth)} {invoice.periodYear}
                            </span>
                          </div>
                          <div style={styles.invoiceRowRight}>
                            <span style={{
                              ...styles.statusBadge,
                              color: statusInfo.color,
                              background: statusInfo.bg
                            }}>
                              {statusLabels[invoice.status]}
                            </span>
                            <span style={styles.invoiceAmount}>{invoice.amount} kr</span>
                            {(invoice.status === "sent" || invoice.status === "overdue") && (
                              <button
                                onClick={() => updateInvoiceStatus(invoice.id, "paid", new Date().toISOString())}
                                style={styles.markPaidButton}
                              >
                                ✓ Marker betalt
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Alle fakturaer */}
        {activeTab === "invoices" && (
          <div>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Fakturaer</h2>
              <div style={styles.filterRow}>
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
                <button onClick={() => setShowCreateInvoice(true)} style={styles.addButton}>
                  + Ny faktura
                </button>
              </div>
            </div>

            <div style={styles.invoiceTable}>
              <div style={styles.tableHeader}>
                <span style={styles.colNum}>Fakturanr</span>
                <span style={styles.colCustomer}>Kunde</span>
                <span style={styles.colPeriod}>Periode</span>
                <span style={styles.colAmount}>Beløp</span>
                <span style={styles.colDue}>Forfaller</span>
                <span style={styles.colStatus}>Status</span>
                <span style={styles.colActions}>Handlinger</span>
              </div>
              
              {getFilteredInvoices().map(invoice => {
                const statusInfo = statusColors[invoice.status];
                const isOverdue = new Date(invoice.dueDate) < new Date() && invoice.status === "sent";
                
                return (
                  <div key={invoice.id} style={styles.tableRow}>
                    <span style={styles.colNum}>{invoice.invoiceNumber}</span>
                    <span style={styles.colCustomer}>{invoice.organization.name}</span>
                    <span style={styles.colPeriod}>
                      {getMonthName(invoice.periodMonth)} {invoice.periodYear}
                    </span>
                    <span style={styles.colAmount}>{invoice.amount.toLocaleString()} kr</span>
                    <span style={{ ...styles.colDue, color: isOverdue ? "#ef4444" : "#a3a3a3" }}>
                      {formatDate(invoice.dueDate)}
                    </span>
                    <span style={styles.colStatus}>
                      <span style={{
                        ...styles.statusBadge,
                        color: statusInfo.color,
                        background: statusInfo.bg
                      }}>
                        {statusLabels[invoice.status]}
                      </span>
                    </span>
                    <span style={styles.colActions}>
                      <button
                        onClick={() => setPreviewInvoice(invoice)}
                        style={{ ...styles.actionButton, background: "#6366f1" }}
                      >
                        👁 Vis
                      </button>
                      {invoice.status === "draft" && (
                        <button
                          onClick={() => updateInvoiceStatus(invoice.id, "sent")}
                          style={styles.actionButton}
                        >
                          Send
                        </button>
                      )}
                      {(invoice.status === "sent" || invoice.status === "overdue") && (
                        <button
                          onClick={() => updateInvoiceStatus(invoice.id, "paid", new Date().toISOString())}
                          style={{ ...styles.actionButton, background: "#22c55e" }}
                        >
                          Betalt
                        </button>
                      )}
                      {invoice.status !== "cancelled" && invoice.status !== "paid" && (
                        <button
                          onClick={() => updateInvoiceStatus(invoice.id, "cancelled")}
                          style={{ ...styles.actionButton, background: "#ef4444" }}
                        >
                          Kanseller
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Innstillinger */}
        {activeTab === "settings" && companySettings && (
          <div>
            <div style={styles.sectionHeader}>
              <h2 style={styles.sectionTitle}>Bedriftsinformasjon</h2>
              {!editingSettings && (
                <button onClick={() => setEditingSettings(true)} style={styles.editButton}>
                  Rediger
                </button>
              )}
            </div>

            {editingSettings ? (
              <div style={styles.settingsForm}>
                <div style={styles.settingsSection}>
                  <h3 style={styles.settingsSectionTitle}>Bedrift</h3>
                  <div style={styles.settingsGrid}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Bedriftsnavn *</label>
                      <input
                        type="text"
                        value={settingsForm.companyName || ""}
                        onChange={(e) => setSettingsForm({ ...settingsForm, companyName: e.target.value })}
                        style={styles.input}
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Org.nummer</label>
                      <input
                        type="text"
                        value={settingsForm.orgNumber || ""}
                        onChange={(e) => setSettingsForm({ ...settingsForm, orgNumber: e.target.value })}
                        style={styles.input}
                        placeholder="999 888 777"
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>MVA-nummer</label>
                      <input
                        type="text"
                        value={settingsForm.vatNumber || ""}
                        onChange={(e) => setSettingsForm({ ...settingsForm, vatNumber: e.target.value })}
                        style={styles.input}
                      />
                    </div>
                  </div>
                </div>

                <div style={styles.settingsSection}>
                  <h3 style={styles.settingsSectionTitle}>Kontakt</h3>
                  <div style={styles.settingsGrid}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>E-post</label>
                      <input
                        type="email"
                        value={settingsForm.email || ""}
                        onChange={(e) => setSettingsForm({ ...settingsForm, email: e.target.value })}
                        style={styles.input}
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Telefon</label>
                      <input
                        type="text"
                        value={settingsForm.phone || ""}
                        onChange={(e) => setSettingsForm({ ...settingsForm, phone: e.target.value })}
                        style={styles.input}
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Nettside</label>
                      <input
                        type="text"
                        value={settingsForm.website || ""}
                        onChange={(e) => setSettingsForm({ ...settingsForm, website: e.target.value })}
                        style={styles.input}
                      />
                    </div>
                  </div>
                </div>

                <div style={styles.settingsSection}>
                  <h3 style={styles.settingsSectionTitle}>Adresse</h3>
                  <div style={styles.settingsGrid}>
                    <div style={{ ...styles.formGroup, gridColumn: "span 2" }}>
                      <label style={styles.label}>Adresse</label>
                      <input
                        type="text"
                        value={settingsForm.address || ""}
                        onChange={(e) => setSettingsForm({ ...settingsForm, address: e.target.value })}
                        style={styles.input}
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Postnummer</label>
                      <input
                        type="text"
                        value={settingsForm.postalCode || ""}
                        onChange={(e) => setSettingsForm({ ...settingsForm, postalCode: e.target.value })}
                        style={styles.input}
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>By</label>
                      <input
                        type="text"
                        value={settingsForm.city || ""}
                        onChange={(e) => setSettingsForm({ ...settingsForm, city: e.target.value })}
                        style={styles.input}
                      />
                    </div>
                  </div>
                </div>

                <div style={styles.settingsSection}>
                  <h3 style={styles.settingsSectionTitle}>Bank</h3>
                  <div style={styles.settingsGrid}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Kontonummer</label>
                      <input
                        type="text"
                        value={settingsForm.bankAccount || ""}
                        onChange={(e) => setSettingsForm({ ...settingsForm, bankAccount: e.target.value })}
                        style={styles.input}
                        placeholder="1234 56 78901"
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Bank</label>
                      <input
                        type="text"
                        value={settingsForm.bankName || ""}
                        onChange={(e) => setSettingsForm({ ...settingsForm, bankName: e.target.value })}
                        style={styles.input}
                      />
                    </div>
                  </div>
                </div>

                <div style={styles.settingsSection}>
                  <h3 style={styles.settingsSectionTitle}>Faktura-innstillinger</h3>
                  <div style={styles.settingsGrid}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Faktura-prefix</label>
                      <input
                        type="text"
                        value={settingsForm.invoicePrefix || ""}
                        onChange={(e) => setSettingsForm({ ...settingsForm, invoicePrefix: e.target.value })}
                        style={styles.input}
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Standard forfallsdager</label>
                      <input
                        type="number"
                        value={settingsForm.defaultDueDays || 14}
                        onChange={(e) => setSettingsForm({ ...settingsForm, defaultDueDays: parseInt(e.target.value) })}
                        style={styles.input}
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>MVA-sats (%)</label>
                      <input
                        type="number"
                        value={settingsForm.vatRate || 0}
                        onChange={(e) => setSettingsForm({ ...settingsForm, vatRate: parseInt(e.target.value) })}
                        style={styles.input}
                      />
                    </div>
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Logo</label>
                    <div style={styles.logoUploadSection}>
                      {settingsForm.logoUrl && (
                        <div style={styles.logoPreview}>
                          <img 
                            src={settingsForm.logoUrl} 
                            alt="Logo" 
                            style={styles.logoImage}
                          />
                          <button
                            onClick={deleteLogo}
                            style={styles.deleteLogoButton}
                            type="button"
                          >
                            ✕ Fjern
                          </button>
                        </div>
                      )}
                      <div style={styles.uploadArea}>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/svg+xml,image/webp"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadLogo(file);
                          }}
                          style={styles.fileInput}
                          id="logo-upload"
                          disabled={uploadingLogo}
                        />
                        <label htmlFor="logo-upload" style={styles.uploadLabel}>
                          {uploadingLogo ? "Laster opp..." : "📤 Last opp logo"}
                        </label>
                        <p style={styles.uploadHint}>PNG, JPEG, SVG eller WebP. Maks 2MB.</p>
                      </div>
                    </div>
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Notat på fakturaer</label>
                    <textarea
                      value={settingsForm.invoiceNote || ""}
                      onChange={(e) => setSettingsForm({ ...settingsForm, invoiceNote: e.target.value })}
                      style={styles.textarea}
                      rows={3}
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Betalingsbetingelser</label>
                    <textarea
                      value={settingsForm.paymentTerms || ""}
                      onChange={(e) => setSettingsForm({ ...settingsForm, paymentTerms: e.target.value })}
                      style={styles.textarea}
                      rows={2}
                    />
                  </div>
                </div>

                <div style={styles.formActions}>
                  <button onClick={saveCompanySettings} style={styles.primaryButton}>
                    Lagre innstillinger
                  </button>
                  <button
                    onClick={() => {
                      setEditingSettings(false);
                      setSettingsForm(companySettings);
                    }}
                    style={styles.cancelButton}
                  >
                    Avbryt
                  </button>
                </div>
              </div>
            ) : (
              <div style={styles.settingsView}>
                <div style={styles.settingsCard}>
                  <h4 style={styles.cardTitle}>Bedriftsinformasjon</h4>
                  <div style={styles.infoGrid}>
                    <div>
                      <p style={styles.infoLabel}>Bedriftsnavn</p>
                      <p style={styles.infoValue}>{companySettings.companyName}</p>
                    </div>
                    <div>
                      <p style={styles.infoLabel}>Org.nummer</p>
                      <p style={styles.infoValue}>{companySettings.orgNumber || "-"}</p>
                    </div>
                    <div>
                      <p style={styles.infoLabel}>E-post</p>
                      <p style={styles.infoValue}>{companySettings.email || "-"}</p>
                    </div>
                    <div>
                      <p style={styles.infoLabel}>Telefon</p>
                      <p style={styles.infoValue}>{companySettings.phone || "-"}</p>
                    </div>
                  </div>
                </div>

                <div style={styles.settingsCard}>
                  <h4 style={styles.cardTitle}>Adresse</h4>
                  <p style={styles.infoValue}>
                    {companySettings.address || "-"}<br />
                    {companySettings.postalCode} {companySettings.city}<br />
                    {companySettings.country}
                  </p>
                </div>

                <div style={styles.settingsCard}>
                  <h4 style={styles.cardTitle}>Bankinformasjon</h4>
                  <div style={styles.infoGrid}>
                    <div>
                      <p style={styles.infoLabel}>Kontonummer</p>
                      <p style={styles.infoValue}>{companySettings.bankAccount || "-"}</p>
                    </div>
                    <div>
                      <p style={styles.infoLabel}>Bank</p>
                      <p style={styles.infoValue}>{companySettings.bankName || "-"}</p>
                    </div>
                  </div>
                </div>

                <div style={styles.settingsCard}>
                  <h4 style={styles.cardTitle}>Faktura-innstillinger</h4>
                  <div style={styles.infoGrid}>
                    <div>
                      <p style={styles.infoLabel}>Prefix</p>
                      <p style={styles.infoValue}>{companySettings.invoicePrefix}</p>
                    </div>
                    <div>
                      <p style={styles.infoLabel}>Forfallsdager</p>
                      <p style={styles.infoValue}>{companySettings.defaultDueDays} dager</p>
                    </div>
                    <div>
                      <p style={styles.infoLabel}>MVA-sats</p>
                      <p style={styles.infoValue}>{companySettings.vatRate}%</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Faktura forhåndsvisning modal */}
      {previewInvoice && companySettings && (
        <div style={styles.modalOverlay} onClick={() => setPreviewInvoice(null)}>
          <div style={styles.previewModal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.previewHeader}>
              <h2 style={styles.previewTitle}>Forhåndsvisning av faktura</h2>
              <button onClick={() => setPreviewInvoice(null)} style={styles.closeButton}>×</button>
            </div>
            
            <div style={styles.invoicePreview}>
              {/* Faktura-dokument - Conta-stil */}
              <div style={styles.invoiceDocument}>
                
                {/* Topp-seksjon med logo og bedriftsinfo */}
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

                {/* Mottaker og faktura-detaljer */}
                <div style={styles.invDetailsRow}>
                  <div style={styles.invRecipient}>
                    <p style={styles.invRecipientName}>{previewInvoice.organization.name}</p>
                    {previewInvoice.organization.contactName && (
                      <p style={styles.invRecipientLine}>v/ {previewInvoice.organization.contactName}</p>
                    )}
                    <p style={styles.invRecipientLine}>{previewInvoice.organization.contactEmail}</p>
                  </div>
                  <div style={styles.invMeta}>
                    <div style={styles.invMetaRow}>
                      <span style={styles.invMetaLabel}>Fakturadato:</span>
                      <span style={styles.invMetaValue}>{formatDate(previewInvoice.invoiceDate)}</span>
                      <span style={styles.invMetaLabel}>Fakturanr.:</span>
                      <span style={styles.invMetaValue}>{previewInvoice.invoiceNumber.replace("INV-", "")}</span>
                    </div>
                    <div style={styles.invMetaRow}>
                      <span style={styles.invMetaLabel}>Forfallsdato:</span>
                      <span style={styles.invMetaValueRed}>{formatDate(previewInvoice.dueDate)}</span>
                    </div>
                  </div>
                </div>

                {/* Periode-info */}
                <div style={styles.invPeriodRow}>
                  <span style={styles.invPeriodLabel}>Periode:</span>
                  <span style={styles.invPeriodValue}>{getMonthName(previewInvoice.periodMonth)} {previewInvoice.periodYear}</span>
                </div>

                {/* Faktura-tabell */}
                <div style={styles.invTable}>
                  <div style={styles.invTableHeader}>
                    <span style={styles.invColDesc}>BESKRIVELSE</span>
                    <span style={styles.invColPrice}>PRIS</span>
                    <span style={styles.invColQty}>ANTALL</span>
                    <span style={styles.invColAmount}>BELØP</span>
                  </div>
                  
                  {/* SportFlow lisens */}
                  <div style={styles.invTableRow}>
                    <span style={styles.invColDesc}>
                      SportFlow Booking - {previewInvoice.licenseTypeName}
                    </span>
                    <span style={styles.invColPrice}>{previewInvoice.basePrice.toLocaleString()}</span>
                    <span style={styles.invColQty}>1</span>
                    <span style={styles.invColAmount}>{previewInvoice.basePrice.toLocaleString()}</span>
                  </div>

                  {/* Vis ALLE moduler (inkl. 0 kr for pilotkunder) */}
                  {previewInvoice.modules && (() => {
                    try {
                      const modules = JSON.parse(previewInvoice.modules);
                      return modules.map((mod: { key: string; name: string; price: number }) => (
                        <div key={mod.key} style={styles.invTableRow}>
                          <span style={styles.invColDesc}>
                            Tilleggsmodul: {mod.name}
                          </span>
                          <span style={styles.invColPrice}>{mod.price.toLocaleString()}</span>
                          <span style={styles.invColQty}>1</span>
                          <span style={styles.invColAmount}>{mod.price.toLocaleString()}</span>
                        </div>
                      ));
                    } catch {
                      return null;
                    }
                  })()}
                </div>

                {/* MVA og total-seksjon */}
                <div style={styles.invTotalsSection}>
                  {previewInvoice.vatAmount > 0 && (
                    <div style={styles.invVatRow}>
                      <div style={styles.invVatInfo}>
                        <span style={styles.invVatLabel}>MVA-sats</span>
                        <span style={styles.invVatLabel}>Grunnlag</span>
                        <span style={styles.invVatLabel}>MVA</span>
                      </div>
                      <div style={styles.invVatValues}>
                        <span>{companySettings.vatRate} %</span>
                        <span>{(previewInvoice.basePrice + previewInvoice.modulePrice).toLocaleString()}</span>
                        <span>{previewInvoice.vatAmount.toLocaleString()}</span>
                      </div>
                      <div style={styles.invVatTotals}>
                        <span>Nettobeløp</span>
                        <span>Merverdiavgift</span>
                      </div>
                      <div style={styles.invVatAmounts}>
                        <span>{(previewInvoice.basePrice + previewInvoice.modulePrice).toLocaleString()}</span>
                        <span>{previewInvoice.vatAmount.toLocaleString()}</span>
                      </div>
                    </div>
                  )}

                  <div style={styles.invGrandTotal}>
                    <span style={styles.invGrandTotalLabel}>Å BETALE</span>
                    <span style={styles.invGrandTotalValue}>{previewInvoice.amount.toLocaleString("nb-NO", { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                {/* Betalingsinformasjon med gul stripe */}
                <div style={styles.invPaymentSection}>
                  <div style={styles.invPaymentWarning}>
                    {companySettings.paymentTerms || "Ved betaling etter forfall kan det påløpe renter og gebyr."}
                  </div>
                  
                  <div style={styles.invPaymentHeader}>
                    <span style={styles.invPaymentTitle}>BETALINGSINFORMASJON</span>
                    <div style={styles.invPaymentStripe}></div>
                  </div>
                  
                  <div style={styles.invPaymentGrid}>
                    <div style={styles.invPaymentCol}>
                      <p style={styles.invPaymentLabel}>Fakturanummer:</p>
                      <p style={styles.invPaymentValue}>{previewInvoice.invoiceNumber.replace("INV-", "")}</p>
                      <p style={styles.invPaymentLabel}>Sum å betale:</p>
                      <p style={styles.invPaymentValue}>{previewInvoice.amount.toLocaleString("nb-NO", { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div style={styles.invPaymentCol}>
                      <p style={styles.invPaymentNotice}>Husk å merke betalingen med fakturanummer!</p>
                      {companySettings.bankAccount && (
                        <>
                          <p style={styles.invPaymentLabel}>Bankkonto:</p>
                          <p style={styles.invPaymentValue}>{companySettings.bankAccount}</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Notat */}
                {companySettings.invoiceNote && (
                  <div style={styles.invNote}>
                    <p style={styles.invNoteText}>{companySettings.invoiceNote}</p>
                  </div>
                )}

                {/* Footer */}
                <div style={styles.invFooter}>
                  <p style={styles.invFooterLine}>
                    <strong>{companySettings.companyName}</strong>
                    {companySettings.orgNumber && ` // Org.nr: ${companySettings.orgNumber}`}
                    {companySettings.phone && ` // TELEFON: ${companySettings.phone}`}
                    {companySettings.email && ` // E-POST: ${companySettings.email}`}
                  </p>
                  {companySettings.website && (
                    <p style={styles.invFooterLine}>{companySettings.website}</p>
                  )}
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
    minHeight: "100vh",
    background: "#0a0a0a",
    color: "#fff",
    padding: "1.5rem",
  },
  loading: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0a0a0a",
    color: "#fff",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1.5rem",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
  },
  headerLogo: {
    height: "50px",
    width: "auto",
  },
  title: {
    fontSize: "1.5rem",
    fontWeight: "700",
    margin: 0,
  },
  subtitle: {
    fontSize: "0.9rem",
    color: "#737373",
    margin: "0.25rem 0 0 0",
  },
  headerActions: {
    display: "flex",
    gap: "0.75rem",
  },
  backButton: {
    padding: "0.5rem 1rem",
    background: "#262626",
    border: "none",
    borderRadius: "6px",
    color: "#fff",
    cursor: "pointer",
    fontSize: "0.9rem",
  },
  errorBox: {
    background: "rgba(239, 68, 68, 0.1)",
    border: "1px solid #ef4444",
    color: "#ef4444",
    padding: "0.75rem 1rem",
    borderRadius: "6px",
    marginBottom: "1rem",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  successBox: {
    background: "rgba(34, 197, 94, 0.1)",
    border: "1px solid #22c55e",
    color: "#22c55e",
    padding: "0.75rem 1rem",
    borderRadius: "6px",
    marginBottom: "1rem",
  },
  closeButton: {
    background: "none",
    border: "none",
    color: "inherit",
    fontSize: "1.25rem",
    cursor: "pointer",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "1rem",
    marginBottom: "1.5rem",
  },
  statCard: {
    background: "#171717",
    borderRadius: "8px",
    padding: "1rem",
    border: "1px solid #262626",
  },
  statLabel: {
    fontSize: "0.85rem",
    color: "#a3a3a3",
    margin: "0 0 0.5rem 0",
  },
  statValue: {
    fontSize: "1.5rem",
    fontWeight: "600",
    margin: 0,
    color: "#fff",
  },
  tabs: {
    display: "flex",
    gap: "0.5rem",
    marginBottom: "1.5rem",
    borderBottom: "1px solid #262626",
    paddingBottom: "0.5rem",
  },
  tab: {
    padding: "0.75rem 1.5rem",
    background: "transparent",
    border: "none",
    color: "#a3a3a3",
    cursor: "pointer",
    fontSize: "0.95rem",
    borderRadius: "6px 6px 0 0",
  },
  tabActive: {
    padding: "0.75rem 1.5rem",
    background: "#262626",
    border: "none",
    color: "#fff",
    cursor: "pointer",
    fontSize: "0.95rem",
    borderRadius: "6px 6px 0 0",
    fontWeight: "500",
  },
  content: {
    background: "#171717",
    borderRadius: "8px",
    padding: "1.5rem",
    border: "1px solid #262626",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1.5rem",
  },
  sectionTitle: {
    fontSize: "1.1rem",
    fontWeight: "600",
    margin: 0,
  },
  addButton: {
    padding: "0.5rem 1rem",
    background: "#3b82f6",
    border: "none",
    borderRadius: "6px",
    color: "#fff",
    cursor: "pointer",
    fontSize: "0.9rem",
  },
  createForm: {
    background: "#1a1a1a",
    borderRadius: "8px",
    padding: "1.5rem",
    marginBottom: "1.5rem",
    border: "1px solid #262626",
  },
  formTitle: {
    fontSize: "1rem",
    fontWeight: "600",
    margin: "0 0 1rem 0",
  },
  formRow: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr",
    gap: "1rem",
    marginBottom: "1rem",
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  label: {
    fontSize: "0.85rem",
    color: "#a3a3a3",
  },
  select: {
    padding: "0.75rem",
    background: "#262626",
    border: "1px solid #404040",
    borderRadius: "6px",
    color: "#fff",
    fontSize: "0.9rem",
  },
  input: {
    padding: "0.75rem",
    background: "#262626",
    border: "1px solid #404040",
    borderRadius: "6px",
    color: "#fff",
    fontSize: "0.9rem",
  },
  textarea: {
    padding: "0.75rem",
    background: "#262626",
    border: "1px solid #404040",
    borderRadius: "6px",
    color: "#fff",
    fontSize: "0.9rem",
    resize: "vertical",
  },
  formActions: {
    display: "flex",
    gap: "0.75rem",
  },
  primaryButton: {
    padding: "0.75rem 1.5rem",
    background: "#3b82f6",
    border: "none",
    borderRadius: "6px",
    color: "#fff",
    cursor: "pointer",
    fontSize: "0.9rem",
    fontWeight: "500",
  },
  cancelButton: {
    padding: "0.75rem 1.5rem",
    background: "#404040",
    border: "none",
    borderRadius: "6px",
    color: "#fff",
    cursor: "pointer",
    fontSize: "0.9rem",
  },
  customerList: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  customerCard: {
    background: "#1a1a1a",
    borderRadius: "8px",
    padding: "1rem",
    border: "1px solid #262626",
  },
  customerHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "1rem",
  },
  customerName: {
    fontSize: "1rem",
    fontWeight: "600",
    margin: "0 0 0.25rem 0",
  },
  customerEmail: {
    fontSize: "0.85rem",
    color: "#a3a3a3",
    margin: 0,
  },
  customerRight: {
    textAlign: "right",
  },
  outstandingAmount: {
    fontSize: "1rem",
    fontWeight: "600",
    color: "#ef4444",
    margin: "0 0 0.25rem 0",
  },
  paidUp: {
    fontSize: "0.9rem",
    color: "#22c55e",
    margin: 0,
  },
  unpaidBadge: {
    display: "inline-block",
    padding: "0.25rem 0.5rem",
    background: "rgba(239, 68, 68, 0.15)",
    color: "#ef4444",
    borderRadius: "4px",
    fontSize: "0.75rem",
  },
  invoiceRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.75rem 0",
    borderTop: "1px solid #262626",
  },
  invoiceRowLeft: {
    display: "flex",
    gap: "1rem",
    alignItems: "center",
  },
  invoiceRowRight: {
    display: "flex",
    gap: "0.75rem",
    alignItems: "center",
  },
  invoiceNum: {
    fontSize: "0.9rem",
    fontWeight: "500",
  },
  invoicePeriod: {
    fontSize: "0.85rem",
    color: "#a3a3a3",
  },
  invoiceAmount: {
    fontSize: "0.9rem",
    fontWeight: "500",
  },
  statusBadge: {
    display: "inline-block",
    padding: "0.25rem 0.5rem",
    borderRadius: "4px",
    fontSize: "0.75rem",
    fontWeight: "500",
  },
  markPaidButton: {
    padding: "0.25rem 0.75rem",
    background: "#22c55e",
    border: "none",
    borderRadius: "4px",
    color: "#fff",
    cursor: "pointer",
    fontSize: "0.8rem",
  },
  filterRow: {
    display: "flex",
    gap: "0.75rem",
    alignItems: "center",
  },
  filterSelect: {
    padding: "0.5rem 1rem",
    background: "#262626",
    border: "1px solid #404040",
    borderRadius: "6px",
    color: "#fff",
    fontSize: "0.9rem",
  },
  invoiceTable: {
    display: "flex",
    flexDirection: "column",
  },
  tableHeader: {
    display: "grid",
    gridTemplateColumns: "120px 1fr 120px 100px 100px 100px 150px",
    gap: "1rem",
    padding: "0.75rem 0",
    borderBottom: "1px solid #404040",
    fontSize: "0.8rem",
    color: "#a3a3a3",
    textTransform: "uppercase",
    fontWeight: "500",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "120px 1fr 120px 100px 100px 100px 150px",
    gap: "1rem",
    padding: "0.75rem 0",
    borderBottom: "1px solid #262626",
    alignItems: "center",
  },
  colNum: { fontSize: "0.9rem", fontWeight: "500" },
  colCustomer: { fontSize: "0.9rem" },
  colPeriod: { fontSize: "0.85rem", color: "#a3a3a3" },
  colAmount: { fontSize: "0.9rem", fontWeight: "500" },
  colDue: { fontSize: "0.85rem" },
  colStatus: {},
  colActions: { display: "flex", gap: "0.5rem" },
  actionButton: {
    padding: "0.25rem 0.5rem",
    background: "#262626",
    border: "none",
    borderRadius: "4px",
    color: "#fff",
    cursor: "pointer",
    fontSize: "0.75rem",
  },
  editButton: {
    padding: "0.5rem 1rem",
    background: "#262626",
    border: "none",
    borderRadius: "6px",
    color: "#fff",
    cursor: "pointer",
    fontSize: "0.9rem",
  },
  settingsForm: {
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem",
  },
  settingsSection: {
    background: "#1a1a1a",
    borderRadius: "8px",
    padding: "1.5rem",
    border: "1px solid #262626",
  },
  settingsSectionTitle: {
    fontSize: "1rem",
    fontWeight: "600",
    margin: "0 0 1rem 0",
    color: "#a3a3a3",
  },
  settingsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "1rem",
  },
  settingsView: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "1rem",
  },
  settingsCard: {
    background: "#1a1a1a",
    borderRadius: "8px",
    padding: "1.25rem",
    border: "1px solid #262626",
  },
  cardTitle: {
    fontSize: "0.9rem",
    fontWeight: "600",
    margin: "0 0 1rem 0",
    color: "#a3a3a3",
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "1rem",
  },
  infoLabel: {
    fontSize: "0.75rem",
    color: "#737373",
    margin: "0 0 0.25rem 0",
  },
  infoValue: {
    fontSize: "0.9rem",
    margin: 0,
    color: "#fff",
  },
  // Logo upload styles
  logoUploadSection: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  logoPreview: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    padding: "1rem",
    background: "#262626",
    borderRadius: "8px",
  },
  logoImage: {
    maxWidth: "150px",
    maxHeight: "60px",
    objectFit: "contain",
  },
  deleteLogoButton: {
    padding: "0.5rem 1rem",
    background: "#ef4444",
    border: "none",
    borderRadius: "6px",
    color: "#fff",
    cursor: "pointer",
    fontSize: "0.85rem",
  },
  uploadArea: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  fileInput: {
    display: "none",
  },
  uploadLabel: {
    display: "inline-block",
    padding: "0.75rem 1.5rem",
    background: "#262626",
    border: "1px dashed #404040",
    borderRadius: "8px",
    color: "#a3a3a3",
    cursor: "pointer",
    textAlign: "center",
    fontSize: "0.9rem",
  },
  uploadHint: {
    fontSize: "0.75rem",
    color: "#737373",
    margin: 0,
  },
  // Modal and preview styles
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0, 0, 0, 0.8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "2rem",
  },
  previewModal: {
    background: "#171717",
    borderRadius: "12px",
    maxWidth: "800px",
    width: "100%",
    maxHeight: "90vh",
    overflow: "auto",
    border: "1px solid #262626",
  },
  previewHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "1rem 1.5rem",
    borderBottom: "1px solid #262626",
  },
  previewTitle: {
    fontSize: "1.1rem",
    fontWeight: "600",
    margin: 0,
  },
  invoicePreview: {
    padding: "1.5rem",
    maxHeight: "80vh",
    overflowY: "auto",
  },
  invoiceDocument: {
    background: "#fff",
    color: "#1a1a1a",
    borderRadius: "4px",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    fontSize: "11px",
    lineHeight: "1.4",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    padding: "40px",
  },
  // Conta-stil
  invHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "30px",
  },
  invLogoSection: {},
  invLogo: {
    maxWidth: "400px",
    maxHeight: "150px",
    objectFit: "contain",
  },
  invLogoPlaceholder: {
    width: "80px",
    height: "80px",
    background: "#3b82f6",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontSize: "32px",
    fontWeight: "700",
    borderRadius: "8px",
  },
  invCompanySection: {
    textAlign: "right",
  },
  invFakturaTitle: {
    fontSize: "28px",
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: "10px",
    letterSpacing: "2px",
  },
  invCompanyInfo: {},
  invCompanyName: {
    fontSize: "13px",
    fontWeight: "600",
    margin: "0 0 2px 0",
    color: "#1a1a1a",
  },
  invCompanyLine: {
    fontSize: "11px",
    color: "#6b7280",
    margin: "2px 0",
  },
  invDetailsRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "20px",
    paddingBottom: "15px",
    borderBottom: "1px solid #e5e7eb",
  },
  invRecipient: {},
  invRecipientName: {
    fontSize: "13px",
    fontWeight: "600",
    margin: "0 0 4px 0",
    color: "#1a1a1a",
  },
  invRecipientLine: {
    fontSize: "11px",
    color: "#6b7280",
    margin: "2px 0",
  },
  invMeta: {
    textAlign: "right",
  },
  invMetaRow: {
    display: "flex",
    gap: "15px",
    justifyContent: "flex-end",
    marginBottom: "4px",
  },
  invMetaLabel: {
    fontSize: "11px",
    color: "#6b7280",
  },
  invMetaValue: {
    fontSize: "11px",
    fontWeight: "600",
    color: "#1a1a1a",
    minWidth: "60px",
  },
  invMetaValueRed: {
    fontSize: "11px",
    fontWeight: "700",
    color: "#dc2626",
    minWidth: "60px",
  },
  invPeriodRow: {
    marginBottom: "20px",
    fontSize: "11px",
  },
  invPeriodLabel: {
    color: "#6b7280",
    marginRight: "8px",
  },
  invPeriodValue: {
    fontWeight: "600",
    color: "#1a1a1a",
  },
  invTable: {
    marginBottom: "20px",
  },
  invTableHeader: {
    display: "grid",
    gridTemplateColumns: "1fr 80px 60px 90px",
    gap: "10px",
    padding: "8px 0",
    borderBottom: "1px solid #d1d5db",
    fontSize: "10px",
    fontWeight: "600",
    color: "#6b7280",
    textTransform: "uppercase",
  },
  invTableRow: {
    display: "grid",
    gridTemplateColumns: "1fr 80px 60px 90px",
    gap: "10px",
    padding: "12px 0",
    borderBottom: "1px solid #f3f4f6",
    fontSize: "11px",
    alignItems: "center",
  },
  invColDesc: {},
  invColPrice: {
    textAlign: "right",
  },
  invColQty: {
    textAlign: "center",
  },
  invColAmount: {
    textAlign: "right",
    fontWeight: "500",
  },
  invTotalsSection: {
    marginBottom: "30px",
  },
  invVatRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr 1fr",
    gap: "20px",
    padding: "15px 0",
    borderTop: "1px solid #e5e7eb",
    fontSize: "11px",
  },
  invVatInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  invVatValues: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    textAlign: "right",
  },
  invVatTotals: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    textAlign: "right",
    color: "#6b7280",
  },
  invVatAmounts: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    textAlign: "right",
    fontWeight: "500",
  },
  invVatLabel: {
    color: "#6b7280",
  },
  invGrandTotal: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "15px 0",
    borderTop: "2px solid #1a1a1a",
    marginTop: "10px",
  },
  invGrandTotalLabel: {
    fontSize: "14px",
    fontWeight: "700",
    color: "#1a1a1a",
  },
  invGrandTotalValue: {
    fontSize: "20px",
    fontWeight: "700",
    color: "#1a1a1a",
  },
  invPaymentSection: {
    marginTop: "30px",
    paddingTop: "20px",
    borderTop: "1px solid #e5e7eb",
  },
  invPaymentWarning: {
    fontSize: "10px",
    color: "#6b7280",
    fontStyle: "italic",
    marginBottom: "20px",
  },
  invPaymentHeader: {
    display: "flex",
    alignItems: "center",
    gap: "15px",
    marginBottom: "15px",
  },
  invPaymentTitle: {
    fontSize: "12px",
    fontWeight: "700",
    color: "#1a1a1a",
    letterSpacing: "1px",
    whiteSpace: "nowrap",
  },
  invPaymentStripe: {
    flex: 1,
    height: "4px",
    background: "linear-gradient(90deg, #fbbf24, #f59e0b)",
    borderRadius: "2px",
  },
  invPaymentGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "30px",
    fontSize: "11px",
  },
  invPaymentCol: {},
  invPaymentLabel: {
    color: "#6b7280",
    margin: "0 0 2px 0",
  },
  invPaymentValue: {
    fontWeight: "600",
    color: "#1a1a1a",
    margin: "0 0 10px 0",
  },
  invPaymentNotice: {
    fontWeight: "600",
    color: "#1a1a1a",
    margin: "0 0 15px 0",
  },
  invNote: {
    marginTop: "20px",
    padding: "12px 15px",
    background: "#fef3c7",
    borderRadius: "6px",
    borderLeft: "4px solid #f59e0b",
  },
  invNoteText: {
    fontSize: "11px",
    color: "#92400e",
    margin: 0,
    lineHeight: "1.5",
  },
  invFooter: {
    marginTop: "30px",
    paddingTop: "15px",
    borderTop: "1px solid #e5e7eb",
    fontSize: "9px",
    color: "#9ca3af",
    textAlign: "center",
  },
  invFooterLine: {
    margin: "2px 0",
  },
};

