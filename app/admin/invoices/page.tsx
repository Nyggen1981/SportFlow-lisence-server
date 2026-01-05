"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { calculateMonthlyPrice, getLicensePrice, LicenseType } from "@/lib/license-config";
import AdminLayout, { sharedStyles } from "../components/AdminLayout";

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

type Module = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isStandard: boolean;
  isActive: boolean;
  price: number | null;
};

type OrganizationModule = {
  id: string;
  moduleId: string;
  isActive: boolean;
  module: Module;
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
  const [modules, setModules] = useState<Module[]>([]);
  const [orgModules, setOrgModules] = useState<Record<string, OrganizationModule[]>>({});
  const [loadingModules, setLoadingModules] = useState<Record<string, boolean>>({});
  const [licenseTypePrices, setLicenseTypePrices] = useState<Record<string, { price: number; isOverride: boolean }>>({});
  
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [activeTab, setActiveTab] = useState<"info" | "invoices" | "modules">("info");
  
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
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
            loadCompanySettings(storedPassword),
            loadModules(storedPassword),
            loadLicenseTypePrices(storedPassword)
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
        for (const org of data.organizations || []) {
          await loadOrgModules(org.id, adminPassword);
        }
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

  const loadModules = async (adminPassword: string) => {
    try {
      const response = await fetch("/api/modules/list", {
        headers: { "x-admin-secret": adminPassword }
      });
      if (response.ok) {
        const data = await response.json();
        setModules(data.modules || []);
      }
    } catch {}
  };

  const loadOrgModules = async (orgId: string, adminPassword: string) => {
    try {
      const response = await fetch(`/api/organizations/${orgId}/modules`, {
        headers: { "x-admin-secret": adminPassword }
      });
      if (response.ok) {
        const data = await response.json();
        setOrgModules(prev => ({ ...prev, [orgId]: data.modules || [] }));
      }
    } catch {}
  };

  const loadLicenseTypePrices = async (adminPassword: string) => {
    try {
      const response = await fetch("/api/license-types/prices", {
        headers: { "x-admin-secret": adminPassword }
      });
      if (response.ok) {
        const data = await response.json();
        const priceMap: Record<string, { price: number; isOverride: boolean }> = {};
        data.prices.forEach((p: { licenseType: string; price: number; isOverride: boolean }) => {
          priceMap[p.licenseType] = { price: p.price, isOverride: p.isOverride };
        });
        setLicenseTypePrices(priceMap);
      }
    } catch {}
  };

  const toggleModule = async (orgId: string, moduleId: string, isActive: boolean) => {
    setLoadingModules(prev => ({ ...prev, [`${orgId}-${moduleId}`]: true }));
    try {
      const response = await fetch(`/api/organizations/${orgId}/modules`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": password },
        body: JSON.stringify({ moduleId, isActive })
      });
      if (response.ok) {
        await loadOrgModules(orgId, password);
        setSuccess("Modul oppdatert");
        setTimeout(() => setSuccess(""), 2000);
      }
    } catch {}
    setLoadingModules(prev => ({ ...prev, [`${orgId}-${moduleId}`]: false }));
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
        // Update selected org if it was changed
        if (selectedOrg?.id === org.id) {
          const updatedOrg = organizations.find(o => o.id === org.id);
          if (updatedOrg) setSelectedOrg(updatedOrg);
        }
        setSuccess("Status oppdatert");
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch {
      setError("Kunne ikke oppdatere status");
    }
  };

  const createInvoice = async () => {
    if (!selectedOrg) return;
    
    try {
      const response = await fetch("/api/invoices/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": password
        },
        body: JSON.stringify({
          organizationId: selectedOrg.id,
          periodMonth: invoicePeriod.month,
          periodYear: invoicePeriod.year
        })
      });

      if (response.ok) {
        await loadInvoices(password);
        setShowCreateInvoice(false);
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
    if (!confirm("Er du sikker på at du vil slette denne fakturaen?")) return;

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

  const getOrgInvoices = (orgId: string) => invoices.filter(inv => inv.organizationId === orgId);

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
    draft: "Kladd", sent: "Sendt", paid: "Betalt", overdue: "Forfalt", cancelled: "Kansellert"
  };

  const licenseColors: Record<string, { color: string; bg: string }> = {
    inactive: { color: "#6b7280", bg: "rgba(107,114,128,0.15)" },
    pilot: { color: "#a855f7", bg: "rgba(168,85,247,0.15)" },
    free: { color: "#22c55e", bg: "rgba(34,197,94,0.15)" },
    standard: { color: "#3b82f6", bg: "rgba(59,130,246,0.15)" }
  };

  const licenseLabels: Record<string, string> = {
    inactive: "Inaktiv", pilot: "Pilot", free: "Prøve", standard: "Standard"
  };

  // Stats
  const totalOutstanding = invoices.filter(inv => inv.status === "sent" || inv.status === "overdue").reduce((sum, inv) => sum + inv.amount, 0);
  const overdueCount = invoices.filter(inv => inv.status === "overdue").length;

  if (loading) {
    return (
      <div style={sharedStyles.loadingScreen}>
        <div style={sharedStyles.loadingSpinner} />
        <p>Laster...</p>
      </div>
    );
  }

  const currentLicense = selectedOrg ? (selectedOrg.isActive ? selectedOrg.licenseType : "inactive") : null;
  const selectedOrgModules = selectedOrg ? orgModules[selectedOrg.id] || [] : [];
  const selectedOrgInvoices = selectedOrg ? getOrgInvoices(selectedOrg.id) : [];
  const monthlyPrice = selectedOrg ? calculateMonthlyPrice(
    selectedOrg.licenseType as LicenseType,
    selectedOrgModules.filter(om => om.isActive),
    licenseTypePrices[selectedOrg.licenseType]?.price
  ) : 0;

  return (
    <AdminLayout stats={[
      { label: "utestående", value: `${totalOutstanding.toLocaleString()} kr`, color: "#ef4444" }
    ]}>
      {/* Main Content - Two Column Layout */}
        <div style={styles.twoColumnLayout}>
          {/* Left Panel - Customer List */}
          <div style={styles.leftPanel}>
            <div style={styles.panelHeader}>
              <h2 style={styles.panelTitle}>Kunder</h2>
            </div>
            <div style={styles.customerList}>
              {organizations.map(org => {
                const isSelected = selectedOrg?.id === org.id;
                const outstanding = getOrgOutstanding(org.id);
                const license = org.isActive ? org.licenseType : "inactive";
                const licenseInfo = licenseColors[license] || licenseColors.inactive;
                
                return (
                  <div
                    key={org.id}
                    style={{
                      ...styles.customerItem,
                      background: isSelected ? "#1a1a1a" : "transparent",
                      borderColor: isSelected ? "#3b82f6" : "transparent"
                    }}
                    onClick={() => {
                      setSelectedOrg(org);
                      setActiveTab("info");
                    }}
                  >
                    <div style={styles.customerItemTop}>
                      <span style={styles.customerItemName}>{org.name}</span>
                      <span style={{ ...styles.licenseBadge, color: licenseInfo.color, background: licenseInfo.bg }}>
                        {licenseLabels[license]}
                      </span>
                    </div>
                    <div style={styles.customerItemBottom}>
                      <span style={styles.customerItemEmail}>{org.contactEmail}</span>
                      {outstanding > 0 && (
                        <span style={styles.outstandingSmall}>{outstanding.toLocaleString()} kr</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Panel - Details */}
          <div style={styles.rightPanel}>
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
              </div>
            )}

            {selectedOrg ? (
              <>
                {/* Customer Header */}
                <div style={styles.detailHeader}>
                  <div style={styles.detailHeaderLeft}>
                    <div style={styles.customerAvatar}>
                      {selectedOrg.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h2 style={styles.detailTitle}>{selectedOrg.name}</h2>
                      <p style={styles.detailSubtitle}>{selectedOrg.contactEmail}</p>
                    </div>
                  </div>
                  <div style={styles.detailHeaderRight}>
                    <span style={styles.priceDisplay}>{monthlyPrice} kr/mnd</span>
                  </div>
                </div>

                {/* Tabs */}
                <div style={styles.tabs}>
                  <button
                    style={activeTab === "info" ? styles.tabActive : styles.tab}
                    onClick={() => setActiveTab("info")}
                  >
                    Lisens
                  </button>
                  <button
                    style={activeTab === "modules" ? styles.tabActive : styles.tab}
                    onClick={() => setActiveTab("modules")}
                  >
                    Moduler
                  </button>
                  <button
                    style={activeTab === "invoices" ? styles.tabActive : styles.tab}
                    onClick={() => setActiveTab("invoices")}
                  >
                    Fakturaer ({selectedOrgInvoices.length})
                  </button>
                </div>

                {/* Tab Content */}
                <div style={styles.tabContent}>
                  {/* Lisens Tab */}
                  {activeTab === "info" && (
                    <div style={styles.infoTab}>
                      <div style={styles.section}>
                        <label style={styles.sectionLabel}>Lisenstype</label>
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
                                    updateOrgStatus(selectedOrg, "inactive");
                                  } else {
                                    const newExpiry = new Date();
                                    newExpiry.setMonth(newExpiry.getMonth() + 1);
                                    updateOrgStatus(selectedOrg, s, newExpiry.toISOString());
                                  }
                                }}
                              >
                                {licenseLabels[s]}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div style={styles.section}>
                        <label style={styles.sectionLabel}>Prissammendrag</label>
                        <div style={styles.priceSummary}>
                          <div style={styles.priceRow}>
                            <span>Basislisens ({licenseLabels[selectedOrg.licenseType]})</span>
                            <span>{getLicensePrice(selectedOrg.licenseType as LicenseType, licenseTypePrices[selectedOrg.licenseType]?.price)} kr</span>
                          </div>
                          {selectedOrgModules.filter(om => om.isActive && om.module.price).map(om => (
                            <div key={om.id} style={styles.priceRow}>
                              <span>{om.module.name}</span>
                              <span>{selectedOrg.licenseType === "pilot" ? "0 kr (pilot)" : `${om.module.price} kr`}</span>
                            </div>
                          ))}
                          <div style={styles.priceTotal}>
                            <span>Totalt</span>
                            <span>{monthlyPrice} kr/mnd</span>
                          </div>
                        </div>
                      </div>

                      {selectedOrg.isActive && (
                        <div style={styles.section}>
                          <label style={styles.sectionLabel}>Utløpsdato</label>
                          <input
                            type="date"
                            value={selectedOrg.expiresAt.split("T")[0]}
                            onChange={async (e) => {
                              const newDate = new Date(e.target.value);
                              newDate.setHours(23, 59, 59, 999);
                              await updateOrgStatus(selectedOrg, selectedOrg.licenseType, newDate.toISOString());
                            }}
                            style={styles.dateInput}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Moduler Tab */}
                  {activeTab === "modules" && (
                    <div style={styles.modulesTab}>
                      {selectedOrg.licenseType === "pilot" && (
                        <div style={styles.pilotNote}>✨ Pilotkunde - alle moduler er gratis</div>
                      )}
                      
                      {modules.filter(m => m.key !== "booking").length === 0 ? (
                        <p style={styles.emptyText}>Ingen tilleggsmoduler tilgjengelig</p>
                      ) : (
                        modules.filter(m => m.key !== "booking").map(module => {
                          const orgModule = selectedOrgModules.find(om => om.moduleId === module.id);
                          const isActive = orgModule?.isActive ?? module.isStandard;
                          const isLoading = loadingModules[`${selectedOrg.id}-${module.id}`];
                          const isPilot = selectedOrg.licenseType === "pilot";

                          return (
                            <div key={module.id} style={styles.moduleItem}>
                              <div style={styles.moduleInfo}>
                                <h4 style={styles.moduleName}>
                                  {module.name}
                                  {module.isStandard && <span style={styles.standardTag}>Standard</span>}
                                </h4>
                                {module.description && <p style={styles.moduleDesc}>{module.description}</p>}
                                {module.price && (
                                  <p style={styles.modulePrice}>
                                    {isPilot ? "Gratis (pilot)" : `+${module.price} kr/mnd`}
                                  </p>
                                )}
                              </div>
                              <label style={styles.toggle}>
                                <input
                                  type="checkbox"
                                  checked={isActive}
                                  disabled={module.isStandard || isLoading}
                                  onChange={e => toggleModule(selectedOrg.id, module.id, e.target.checked)}
                                  style={styles.toggleInput}
                                />
                                <span style={{
                                  ...styles.toggleTrack,
                                  background: isActive ? "#3b82f6" : "#333"
                                }}>
                                  <span style={{
                                    ...styles.toggleThumb,
                                    transform: isActive ? "translateX(20px)" : "translateX(0)"
                                  }} />
                                </span>
                              </label>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* Fakturaer Tab */}
                  {activeTab === "invoices" && (
                    <div style={styles.invoicesTab}>
                      <div style={styles.invoicesHeader}>
                        <span style={styles.invoicesCount}>{selectedOrgInvoices.length} fakturaer</span>
                        <button style={styles.addBtn} onClick={() => setShowCreateInvoice(true)}>
                          + Ny faktura
                        </button>
                      </div>

                      {showCreateInvoice && (
                        <div style={styles.createForm}>
                          <div style={styles.createFormRow}>
                            <select
                              value={invoicePeriod.month}
                              onChange={(e) => setInvoicePeriod({ ...invoicePeriod, month: parseInt(e.target.value) })}
                              style={styles.select}
                            >
                              {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                                <option key={month} value={month}>{getMonthName(month)}</option>
                              ))}
                            </select>
                            <select
                              value={invoicePeriod.year}
                              onChange={(e) => setInvoicePeriod({ ...invoicePeriod, year: parseInt(e.target.value) })}
                              style={styles.select}
                            >
                              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                                <option key={year} value={year}>{year}</option>
                              ))}
                            </select>
                            <button onClick={createInvoice} style={styles.primaryBtn}>Opprett</button>
                            <button onClick={() => setShowCreateInvoice(false)} style={styles.cancelBtn}>Avbryt</button>
                          </div>
                        </div>
                      )}

                      {selectedOrgInvoices.length === 0 ? (
                        <p style={styles.emptyText}>Ingen fakturaer ennå</p>
                      ) : (
                        <div style={styles.invoiceList}>
                          {selectedOrgInvoices.map(invoice => {
                            const statusInfo = statusColors[invoice.status];
                            const isOverdue = new Date(invoice.dueDate) < new Date() && invoice.status === "sent";
                            
                            return (
                              <div key={invoice.id} style={styles.invoiceItem}>
                                <div style={styles.invoiceMain}>
                                  <div style={styles.invoiceLeft}>
                                    <span style={styles.invoiceNum}>{invoice.invoiceNumber}</span>
                                    <span style={styles.invoicePeriod}>
                                      {getMonthName(invoice.periodMonth)} {invoice.periodYear}
                                    </span>
                                  </div>
                                  <div style={styles.invoiceCenter}>
                                    <span style={styles.invoiceAmount}>{invoice.amount.toLocaleString()} kr</span>
                                    <span style={{ ...styles.invoiceDue, color: isOverdue ? "#ef4444" : "#666" }}>
                                      {formatDate(invoice.dueDate)}
                                    </span>
                                  </div>
                                  <div style={styles.invoiceRight}>
                                    <span style={{ ...styles.statusBadge, color: statusInfo.color, background: statusInfo.bg }}>
                                      {statusLabels[invoice.status]}
                                    </span>
                                  </div>
                                </div>
                                <div style={styles.invoiceActions}>
                                  <button onClick={() => setPreviewInvoice(invoice)} style={styles.actionBtn}>Vis</button>
                                  {(invoice.status === "draft" || invoice.status === "sent") && (
                                    <button
                                      onClick={() => sendInvoiceByEmail(invoice)}
                                      disabled={sendingEmail === invoice.id}
                                      style={styles.actionBtn}
                                    >
                                      {sendingEmail === invoice.id ? "..." : "Send"}
                                    </button>
                                  )}
                                  {invoice.status === "draft" && (
                                    <button onClick={() => updateInvoiceStatus(invoice.id, "sent")} style={styles.actionBtn}>
                                      Marker sendt
                                    </button>
                                  )}
                                  {(invoice.status === "sent" || invoice.status === "overdue") && (
                                    <button
                                      onClick={() => updateInvoiceStatus(invoice.id, "paid", new Date().toISOString())}
                                      style={{ ...styles.actionBtn, color: "#22c55e" }}
                                    >
                                      Betalt
                                    </button>
                                  )}
                                  {invoice.status !== "paid" && invoice.status !== "cancelled" && (
                                    <button
                                      onClick={() => updateInvoiceStatus(invoice.id, "cancelled")}
                                      style={{ ...styles.actionBtn, color: "#ef4444" }}
                                    >
                                      Kanseller
                                    </button>
                                  )}
                                  {invoice.status === "cancelled" && (
                                    <button onClick={() => deleteInvoice(invoice.id)} style={{ ...styles.actionBtn, color: "#7f1d1d" }}>
                                      Slett
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={styles.emptyState}>
                <div style={styles.emptyIcon}>👈</div>
                <h3>Velg en kunde</h3>
                <p>Velg en kunde fra listen til venstre for å se detaljer</p>
              </div>
            )}
          </div>
        </div>

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
                  style={styles.downloadButton}
                >
                  📄 PDF
                </button>
                <button onClick={() => setPreviewInvoice(null)} style={styles.modalCloseBtn}>×</button>
              </div>
            </div>
            
            <div style={styles.invoicePreview}>
              <div id="invoice-document" style={styles.invoiceDocument}>
                <div style={styles.invHeader}>
                  <div>
                    {companySettings.logoUrl ? (
                      <img src={companySettings.logoUrl} alt="Logo" style={styles.invLogo} />
                    ) : (
                      <div style={styles.invLogoPlaceholder}>{companySettings.companyName?.charAt(0) || "S"}</div>
                    )}
                  </div>
                  <div style={styles.invCompanySection}>
                    <div style={styles.invFakturaTitle}>FAKTURA</div>
                    <p style={styles.invCompanyName}>{companySettings.companyName}</p>
                    {companySettings.address && <p style={styles.invCompanyLine}>{companySettings.address}</p>}
                    {(companySettings.postalCode || companySettings.city) && (
                      <p style={styles.invCompanyLine}>{companySettings.postalCode} {companySettings.city}</p>
                    )}
                  </div>
                </div>

                <div style={styles.invDetailsRow}>
                  <div>
                    <p style={styles.invRecipientName}>{previewInvoice.organization.name}</p>
                    {previewInvoice.organization.contactName && (
                      <p style={styles.invRecipientLine}>v/ {previewInvoice.organization.contactName}</p>
                    )}
                    <p style={styles.invRecipientLine}>{previewInvoice.organization.contactEmail}</p>
                  </div>
                  <div style={styles.invMeta}>
                    <p>Fakturadato: <strong>{formatDate(previewInvoice.invoiceDate)}</strong></p>
                    <p>Fakturanr: <strong>{previewInvoice.invoiceNumber.replace("INV-", "")}</strong></p>
                    <p>Forfallsdato: <strong style={{ color: "#dc2626" }}>{formatDate(previewInvoice.dueDate)}</strong></p>
                  </div>
                </div>

                <div style={styles.invTable}>
                  <div style={styles.invTableHeader}>
                    <span style={{ flex: 1 }}>BESKRIVELSE</span>
                    <span style={{ width: 80, textAlign: "right" }}>BELØP</span>
                  </div>
                  <div style={styles.invTableRow}>
                    <span style={{ flex: 1 }}>SportFlow Booking - {previewInvoice.licenseTypeName}</span>
                    <span style={{ width: 80, textAlign: "right" }}>{previewInvoice.basePrice.toLocaleString()} kr</span>
                  </div>
                  {previewInvoice.modules && (() => {
                    try {
                      return JSON.parse(previewInvoice.modules).map((mod: { key: string; name: string; price: number }) => (
                        <div key={mod.key} style={styles.invTableRow}>
                          <span style={{ flex: 1 }}>Tilleggsmodul: {mod.name}</span>
                          <span style={{ width: 80, textAlign: "right" }}>{mod.price.toLocaleString()} kr</span>
                        </div>
                      ));
                    } catch { return null; }
                  })()}
                </div>

                <div style={styles.invGrandTotal}>
                  <span>Å BETALE</span>
                  <span>{previewInvoice.amount.toLocaleString("nb-NO", { minimumFractionDigits: 2 })} kr</span>
                </div>

                <div style={styles.invPaymentSection}>
                  <p><strong>Bankkonto:</strong> {companySettings.bankAccount}</p>
                  <p><strong>Merk betaling med:</strong> {previewInvoice.invoiceNumber.replace("INV-", "")}</p>
                </div>

                <div style={styles.invFooter}>
                  <p>{companySettings.companyName} {companySettings.orgNumber && `• Org.nr: ${companySettings.orgNumber}`}</p>
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
  // Two Column Layout
  twoColumnLayout: {
    display: "grid",
    gridTemplateColumns: "240px 1fr",
    gap: "1rem",
    height: "calc(100vh - 120px)",
  },

  // Left Panel
  leftPanel: {
    background: "#111",
    borderRadius: "10px",
    border: "1px solid #222",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  panelHeader: {
    padding: "1rem",
    borderBottom: "1px solid #222",
  },
  panelTitle: {
    fontSize: "0.9rem",
    fontWeight: "600",
    margin: 0,
  },
  customerList: {
    flex: 1,
    overflowY: "auto",
    padding: "0.5rem",
  },
  customerItem: {
    padding: "0.75rem",
    borderRadius: "6px",
    cursor: "pointer",
    border: "1px solid transparent",
    marginBottom: "0.25rem",
  },
  customerItemTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "0.25rem",
  },
  customerItemName: {
    fontSize: "0.85rem",
    fontWeight: "500",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "140px",
  },
  customerItemBottom: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  customerItemEmail: {
    fontSize: "0.7rem",
    color: "#666",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "140px",
  },
  licenseBadge: {
    padding: "0.2rem 0.4rem",
    borderRadius: "4px",
    fontSize: "0.65rem",
    fontWeight: "500",
  },
  outstandingSmall: {
    fontSize: "0.7rem",
    color: "#ef4444",
    fontWeight: "500",
  },

  // Right Panel
  rightPanel: {
    background: "#111",
    borderRadius: "10px",
    border: "1px solid #222",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  errorMsg: {
    display: "flex",
    justifyContent: "space-between",
    padding: "0.6rem 0.75rem",
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    color: "#f87171",
    fontSize: "0.8rem",
    margin: "0.75rem",
    borderRadius: "6px",
  },
  successMsg: {
    padding: "0.6rem 0.75rem",
    background: "rgba(34,197,94,0.1)",
    border: "1px solid rgba(34,197,94,0.3)",
    color: "#4ade80",
    fontSize: "0.8rem",
    margin: "0.75rem",
    borderRadius: "6px",
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "inherit",
    cursor: "pointer",
    fontSize: "1rem",
  },
  detailHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "1rem 1.25rem",
    borderBottom: "1px solid #222",
  },
  detailHeaderLeft: {
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
  },
  detailTitle: {
    fontSize: "1rem",
    fontWeight: "600",
    margin: 0,
  },
  detailSubtitle: {
    fontSize: "0.75rem",
    color: "#666",
    margin: "0.15rem 0 0 0",
  },
  detailHeaderRight: {},
  priceDisplay: {
    fontSize: "1rem",
    fontWeight: "600",
    color: "#22c55e",
  },

  // Tabs
  tabs: {
    display: "flex",
    borderBottom: "1px solid #222",
    padding: "0 1rem",
  },
  tab: {
    padding: "0.75rem 1rem",
    background: "transparent",
    border: "none",
    borderBottom: "2px solid transparent",
    color: "#666",
    fontSize: "0.8rem",
    cursor: "pointer",
  },
  tabActive: {
    padding: "0.75rem 1rem",
    background: "transparent",
    border: "none",
    borderBottom: "2px solid #3b82f6",
    color: "#3b82f6",
    fontSize: "0.8rem",
    cursor: "pointer",
    fontWeight: "500",
  },
  tabContent: {
    flex: 1,
    overflowY: "auto",
    padding: "1rem 1.25rem",
  },

  // Info Tab
  infoTab: {
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
  },
  section: {},
  sectionLabel: {
    display: "block",
    fontSize: "0.7rem",
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: "0.5rem",
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
    fontSize: "0.75rem",
    cursor: "pointer",
  },
  priceSummary: {
    background: "#0a0a0a",
    borderRadius: "6px",
    padding: "0.75rem",
  },
  priceRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "0.8rem",
    color: "#888",
    padding: "0.3rem 0",
  },
  priceTotal: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "0.85rem",
    color: "#22c55e",
    fontWeight: "600",
    paddingTop: "0.5rem",
    marginTop: "0.5rem",
    borderTop: "1px solid #222",
  },
  infoValue: {
    fontSize: "0.85rem",
    color: "#fff",
    margin: 0,
  },
  dateInput: {
    padding: "0.5rem 0.75rem",
    background: "#0a0a0a",
    border: "1px solid #333",
    borderRadius: "6px",
    color: "#fff",
    fontSize: "0.85rem",
    cursor: "pointer",
    width: "100%",
  },
  // Modules Tab
  modulesTab: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  pilotNote: {
    fontSize: "0.8rem",
    color: "#a855f7",
    background: "rgba(168,85,247,0.1)",
    padding: "0.6rem 0.75rem",
    borderRadius: "6px",
    marginBottom: "0.5rem",
    textAlign: "center",
  },
  emptyText: {
    color: "#666",
    fontSize: "0.85rem",
    textAlign: "center",
    padding: "2rem",
  },
  moduleItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.75rem",
    background: "#0a0a0a",
    borderRadius: "6px",
  },
  moduleInfo: {},
  moduleName: {
    fontSize: "0.85rem",
    fontWeight: "500",
    margin: 0,
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
  },
  standardTag: {
    fontSize: "0.6rem",
    padding: "0.15rem 0.3rem",
    background: "rgba(59,130,246,0.2)",
    color: "#60a5fa",
    borderRadius: "3px",
  },
  moduleDesc: {
    fontSize: "0.75rem",
    color: "#666",
    margin: "0.2rem 0 0 0",
  },
  modulePrice: {
    fontSize: "0.75rem",
    color: "#22c55e",
    margin: "0.2rem 0 0 0",
  },
  toggle: {
    position: "relative",
    cursor: "pointer",
  },
  toggleInput: {
    opacity: 0,
    width: 0,
    height: 0,
    position: "absolute",
  },
  toggleTrack: {
    display: "block",
    width: "40px",
    height: "22px",
    borderRadius: "11px",
    position: "relative",
    transition: "background 0.2s",
  },
  toggleThumb: {
    position: "absolute",
    top: "2px",
    left: "2px",
    width: "18px",
    height: "18px",
    background: "#fff",
    borderRadius: "50%",
    transition: "transform 0.2s",
  },

  // Invoices Tab
  invoicesTab: {},
  invoicesHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1rem",
  },
  invoicesCount: {
    fontSize: "0.8rem",
    color: "#666",
  },
  addBtn: {
    padding: "0.4rem 0.75rem",
    background: "#3b82f6",
    border: "none",
    borderRadius: "5px",
    color: "#fff",
    fontSize: "0.75rem",
    cursor: "pointer",
  },
  createForm: {
    background: "#0a0a0a",
    borderRadius: "6px",
    padding: "0.75rem",
    marginBottom: "1rem",
  },
  createFormRow: {
    display: "flex",
    gap: "0.5rem",
    alignItems: "center",
    flexWrap: "wrap",
  },
  select: {
    padding: "0.5rem",
    background: "#1a1a1a",
    border: "1px solid #333",
    borderRadius: "5px",
    color: "#fff",
    fontSize: "0.8rem",
  },
  primaryBtn: {
    padding: "0.5rem 0.75rem",
    background: "#3b82f6",
    border: "none",
    borderRadius: "5px",
    color: "#fff",
    fontSize: "0.8rem",
    cursor: "pointer",
  },
  cancelBtn: {
    padding: "0.5rem 0.75rem",
    background: "transparent",
    border: "1px solid #333",
    borderRadius: "5px",
    color: "#888",
    fontSize: "0.8rem",
    cursor: "pointer",
  },
  invoiceList: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  invoiceItem: {
    background: "#0a0a0a",
    borderRadius: "6px",
    padding: "0.75rem",
  },
  invoiceMain: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "0.5rem",
  },
  invoiceLeft: {
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
  invoiceCenter: {
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
  invoiceRight: {},
  statusBadge: {
    padding: "0.2rem 0.5rem",
    borderRadius: "4px",
    fontSize: "0.7rem",
    fontWeight: "500",
  },
  invoiceActions: {
    display: "flex",
    gap: "0.4rem",
    flexWrap: "wrap",
  },
  actionBtn: {
    padding: "0.3rem 0.5rem",
    background: "#222",
    border: "none",
    borderRadius: "4px",
    color: "#fff",
    fontSize: "0.7rem",
    cursor: "pointer",
  },

  // Empty State
  emptyState: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: "#666",
  },
  emptyIcon: {
    fontSize: "2.5rem",
    marginBottom: "0.75rem",
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
    borderRadius: "10px",
    maxWidth: "700px",
    width: "100%",
    maxHeight: "90vh",
    overflow: "auto",
    border: "1px solid #222",
  },
  previewHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.75rem 1rem",
    borderBottom: "1px solid #222",
    position: "sticky",
    top: 0,
    background: "#111",
  },
  previewTitle: {
    fontSize: "0.95rem",
    fontWeight: "600",
    margin: 0,
  },
  previewActions: {
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
  },
  downloadButton: {
    padding: "0.35rem 0.6rem",
    background: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "0.75rem",
  },
  modalCloseBtn: {
    padding: "0.35rem 0.5rem",
    background: "none",
    border: "none",
    color: "#888",
    fontSize: "1.1rem",
    cursor: "pointer",
  },
  invoicePreview: {
    padding: "1rem",
  },
  invoiceDocument: {
    background: "#fff",
    color: "#1a1a1a",
    borderRadius: "4px",
    fontFamily: "'Segoe UI', sans-serif",
    fontSize: "10px",
    lineHeight: "1.4",
    padding: "30px",
  },
  invHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "20px",
  },
  invLogo: {
    maxWidth: "150px",
    maxHeight: "50px",
    objectFit: "contain",
  },
  invLogoPlaceholder: {
    width: "50px",
    height: "50px",
    background: "#3b82f6",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontSize: "20px",
    fontWeight: "700",
    borderRadius: "6px",
  },
  invCompanySection: {
    textAlign: "right",
  },
  invFakturaTitle: {
    fontSize: "20px",
    fontWeight: "700",
    marginBottom: "6px",
    letterSpacing: "1px",
  },
  invCompanyName: {
    fontSize: "11px",
    fontWeight: "600",
    margin: "0 0 2px 0",
  },
  invCompanyLine: {
    fontSize: "9px",
    color: "#666",
    margin: "1px 0",
  },
  invDetailsRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "15px",
    paddingBottom: "12px",
    borderBottom: "1px solid #e5e7eb",
  },
  invRecipientName: {
    fontSize: "11px",
    fontWeight: "600",
    margin: "0 0 3px 0",
  },
  invRecipientLine: {
    fontSize: "9px",
    color: "#666",
    margin: "1px 0",
  },
  invMeta: {
    textAlign: "right",
    fontSize: "9px",
  },
  invTable: {
    marginBottom: "12px",
  },
  invTableHeader: {
    display: "flex",
    padding: "5px 0",
    borderBottom: "1px solid #d1d5db",
    fontSize: "8px",
    fontWeight: "600",
    color: "#666",
    textTransform: "uppercase",
  },
  invTableRow: {
    display: "flex",
    padding: "8px 0",
    borderBottom: "1px solid #f3f4f6",
    fontSize: "9px",
  },
  invGrandTotal: {
    display: "flex",
    justifyContent: "space-between",
    padding: "10px 0",
    borderTop: "2px solid #1a1a1a",
    fontSize: "13px",
    fontWeight: "700",
    marginTop: "6px",
  },
  invPaymentSection: {
    marginTop: "15px",
    paddingTop: "12px",
    borderTop: "1px solid #e5e7eb",
    fontSize: "9px",
  },
  invFooter: {
    marginTop: "20px",
    paddingTop: "10px",
    borderTop: "1px solid #e5e7eb",
    fontSize: "8px",
    color: "#999",
    textAlign: "center",
  },
};
