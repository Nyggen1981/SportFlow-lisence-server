"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LICENSE_TYPES, calculateMonthlyPrice, getLicensePrice, LicenseType } from "@/lib/license-config";
import AdminLayout, { sharedStyles } from "./components/AdminLayout";

// Types
type OrganizationStats = {
  id: string;
  organizationId: string;
  totalUsers: number;
  activeUsers: number;
  lastUserLogin: string | null;
  totalFacilities: number;
  totalCategories: number;
  totalBookings: number;
  bookingsThisMonth: number;
  pendingBookings: number;
  totalRoles: number;
  lastUpdated: string;
};

type Organization = {
  id: string;
  name: string;
  slug: string;
  contactEmail: string;
  contactName: string | null;
  licenseKey: string;
  licenseType: string;
  createdAt: string;
  activatedAt: string | null;
  expiresAt: string;
  graceEndsAt: string | null;
  isActive: boolean;
  isSuspended: boolean;
  lastHeartbeat: string | null;
  appVersion: string | null;
  totalUsers: number;
  totalBookings: number;
  stats?: OrganizationStats | null;
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

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [password, setPassword] = useState("");
  const [modules, setModules] = useState<Module[]>([]);
  const [orgModules, setOrgModules] = useState<Record<string, OrganizationModule[]>>({});
  const [loadingModules, setLoadingModules] = useState<Record<string, boolean>>({});
  const [licenseTypePrices, setLicenseTypePrices] = useState<Record<string, { price: number; isOverride: boolean }>>({});
  
  // UI State
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"info" | "modules" | "stats">("info");
  const [showAddModal, setShowAddModal] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  
  // Form state
  const [newOrg, setNewOrg] = useState({ name: "", slug: "", contactEmail: "", contactName: "" });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

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
          loadOrganizations(storedPassword),
          loadModules(storedPassword),
          loadLicenseTypePrices(storedPassword)
        ]);
      }
      setLoading(false);
    } catch {
      router.push("/admin/login");
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
      setError("Kunne ikke laste organisasjoner");
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

  const handleLogout = () => {
    sessionStorage.removeItem("adminPassword");
    document.cookie = "admin-auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    router.push("/admin/login");
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[æ]/g, "ae")
      .replace(/[ø]/g, "o")
      .replace(/[å]/g, "a")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError("");

    try {
      const response = await fetch("/api/license/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": password },
        body: JSON.stringify({
          ...newOrg,
          contactName: newOrg.contactName || null,
          licenseType: "free",
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        })
      });

      const data = await response.json();
      if (response.ok) {
        setSuccess(`"${newOrg.name}" opprettet!`);
        setNewOrg({ name: "", slug: "", contactEmail: "", contactName: "" });
        setShowAddModal(false);
        await loadOrganizations(password);
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.error || "Kunne ikke opprette organisasjon");
      }
    } catch {
      setError("Nettverksfeil");
    } finally {
      setCreating(false);
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
      }
    } catch {}
    setLoadingModules(prev => ({ ...prev, [`${orgId}-${moduleId}`]: false }));
  };


  const copyToClipboard = async (key: string) => {
    await navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("nb-NO", {
      day: "numeric", month: "short", year: "numeric"
    });
  };

  const getStatusInfo = (org: Organization): { label: string; color: string; bg: string; daysLeft?: number } => {
    if (!org.isActive) return { label: "Inaktiv", color: "#6b7280", bg: "rgba(107,114,128,0.15)" };
    const daysLeft = Math.ceil((new Date(org.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return { label: "Utløpt", color: "#ef4444", bg: "rgba(239,68,68,0.15)" };
    
    const colors: Record<string, { color: string; bg: string }> = {
      pilot: { color: "#a855f7", bg: "rgba(168,85,247,0.15)" },
      free: { color: "#22c55e", bg: "rgba(34,197,94,0.15)" },
      standard: { color: "#3b82f6", bg: "rgba(59,130,246,0.15)" }
    };
    const names: Record<string, string> = { pilot: "Pilot", free: "Prøve", standard: "Standard" };
    const c = colors[org.licenseType] || colors.free;
    return { label: names[org.licenseType] || org.licenseType, ...c, daysLeft };
  };

  // Stats summary
  const activeCount = organizations.filter(o => o.isActive).length;
  const totalRevenue = organizations.filter(o => o.isActive).reduce((sum, org) => {
    return sum + calculateMonthlyPrice(
      org.licenseType as LicenseType,
      orgModules[org.id]?.filter(om => om.isActive) || [],
      licenseTypePrices[org.licenseType]?.price
    );
  }, 0);

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
      { label: "kunder", value: String(organizations.length) },
      { label: "MRR", value: `${totalRevenue.toLocaleString()} kr`, color: "#22c55e" }
    ]}>
      {/* Header */}
      <header style={sharedStyles.pageHeader}>
        <div>
          <h1 style={sharedStyles.pageTitle}>Kunder</h1>
          <p style={sharedStyles.pageSubtitle}>Administrer organisasjoner og lisenser</p>
        </div>
        <button style={sharedStyles.primaryBtn} onClick={() => setShowAddModal(true)}>
          + Ny kunde
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

        {/* Customer List */}
        <div style={styles.customerList}>
          {organizations.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>🏢</div>
              <h3>Ingen kunder ennå</h3>
              <p>Legg til din første kunde for å komme i gang</p>
              <button style={styles.primaryBtn} onClick={() => setShowAddModal(true)}>
                + Legg til kunde
              </button>
            </div>
          ) : (
            organizations.map(org => {
              const status = getStatusInfo(org);
              const isExpanded = expandedOrg === org.id;
              const monthlyPrice = calculateMonthlyPrice(
                org.licenseType as LicenseType,
                orgModules[org.id]?.filter(om => om.isActive) || [],
                licenseTypePrices[org.licenseType]?.price
              );

              return (
                <div key={org.id} style={styles.customerCard}>
                  {/* Card Header - Always visible */}
                  <div 
                    style={styles.cardHeader}
                    onClick={() => setExpandedOrg(isExpanded ? null : org.id)}
                  >
                    <div style={styles.cardHeaderLeft}>
                      <div style={styles.customerAvatar}>
                        {org.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 style={styles.customerName}>{org.name}</h3>
                        <p style={styles.customerMeta}>
                          {org.contactEmail}
                          {org.contactName && ` • ${org.contactName}`}
                        </p>
                      </div>
                    </div>
                    <div style={styles.cardHeaderRight}>
                      <span style={{ ...styles.statusBadge, color: status.color, background: status.bg }}>
                        {status.label}
                        {status.daysLeft !== undefined && status.daysLeft <= 30 && status.daysLeft > 0 && (
                          <span style={styles.daysLeft}>{status.daysLeft}d</span>
                        )}
                      </span>
                      <span style={styles.priceTag}>{monthlyPrice} kr/mnd</span>
                      <span style={styles.expandIcon}>{isExpanded ? "▲" : "▼"}</span>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div style={styles.cardBody}>
                      {/* Tabs */}
                      <div style={styles.tabs}>
                        <button 
                          style={activeTab === "info" ? styles.tabActive : styles.tab}
                          onClick={() => setActiveTab("info")}
                        >
                          Info
                        </button>
                        <button 
                          style={activeTab === "modules" ? styles.tabActive : styles.tab}
                          onClick={() => setActiveTab("modules")}
                        >
                          Moduler
                        </button>
                        <button 
                          style={activeTab === "stats" ? styles.tabActive : styles.tab}
                          onClick={() => setActiveTab("stats")}
                        >
                          Statistikk
                        </button>
                      </div>

                      {/* Tab Content */}
                      <div style={styles.tabContent}>
                        {activeTab === "info" && (
                          <div style={styles.infoTab}>
                            {/* License Key */}
                            <div style={styles.infoSection}>
                              <label style={styles.infoLabel}>Lisensnøkkel</label>
                              <div style={styles.keyRow}>
                                <code style={styles.keyCode}>{org.licenseKey}</code>
                                <button 
                                  style={styles.copyBtn}
                                  onClick={() => copyToClipboard(org.licenseKey)}
                                >
                                  {copiedKey === org.licenseKey ? "✓" : "📋"}
                                </button>
                              </div>
                            </div>

                            {/* Status Selection */}
                            <div style={styles.infoSection}>
                              <label style={styles.infoLabel}>Lisenstype</label>
                              <div style={styles.statusGrid}>
                                {["inactive", "pilot", "free", "standard"].map(s => {
                                  const isSelected = (!org.isActive && s === "inactive") || 
                                    (org.isActive && org.licenseType === s);
                                  const colors: Record<string, string> = {
                                    inactive: "#6b7280", pilot: "#a855f7", free: "#22c55e", standard: "#3b82f6"
                                  };
                                  const labels: Record<string, string> = {
                                    inactive: "Inaktiv", pilot: "Pilot", free: "Prøve", standard: "Standard"
                                  };
                                  return (
                                    <button
                                      key={s}
                                      style={{
                                        ...styles.statusOption,
                                        borderColor: isSelected ? colors[s] : "#333",
                                        background: isSelected ? `${colors[s]}20` : "transparent",
                                        color: isSelected ? colors[s] : "#888"
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
                                      {labels[s]}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Expiry Date */}
                            {org.isActive && (
                              <div style={styles.infoSection}>
                                <label style={styles.infoLabel}>Utløpsdato</label>
                                <input
                                  type="date"
                                  value={org.expiresAt.split("T")[0]}
                                  onChange={async (e) => {
                                    const newDate = new Date(e.target.value);
                                    newDate.setHours(23, 59, 59, 999);
                                    await updateOrgStatus(org, org.licenseType, newDate.toISOString());
                                  }}
                                  style={styles.dateInput}
                                />
                              </div>
                            )}

                            {/* Pricing Summary */}
                            <div style={styles.pricingSummary}>
                              <div style={styles.pricingRow}>
                                <span>Basislisens</span>
                                <span>{getLicensePrice(org.licenseType as LicenseType, licenseTypePrices[org.licenseType]?.price)} kr</span>
                              </div>
                              {orgModules[org.id]?.filter(om => om.isActive && om.module.price).map(om => (
                                <div key={om.id} style={styles.pricingRow}>
                                  <span>{om.module.name}</span>
                                  <span>
                                    {org.licenseType === "pilot" ? (
                                      <span style={{ color: "#a855f7" }}>0 kr (pilot)</span>
                                    ) : (
                                      `${om.module.price} kr`
                                    )}
                                  </span>
                                </div>
                              ))}
                              <div style={styles.pricingTotal}>
                                <span>Totalt</span>
                                <span>{monthlyPrice} kr/mnd</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {activeTab === "modules" && (
                          <div style={styles.modulesTab}>
                            {org.licenseType === "pilot" && (
                              <p style={styles.pilotNote}>✨ Pilotkunde - alle moduler er gratis</p>
                            )}
                            {modules.filter(m => m.key !== "booking").map(module => {
                              const orgModule = orgModules[org.id]?.find(om => om.moduleId === module.id);
                              const isActive = orgModule?.isActive ?? module.isStandard;
                              const isLoading = loadingModules[`${org.id}-${module.id}`];
                              const isPilot = org.licenseType === "pilot";

                              return (
                                <div key={module.id} style={styles.moduleItem}>
                                  <div>
                                    <h4 style={styles.moduleName}>
                                      {module.name}
                                      {module.isStandard && <span style={styles.standardTag}>Standard</span>}
                                    </h4>
                                    {module.description && (
                                      <p style={styles.moduleDesc}>{module.description}</p>
                                    )}
                                    {module.price && (
                                      <p style={styles.modulePrice}>
                                        {isPilot ? (
                                          <span style={{ color: "#a855f7" }}>Gratis (pilot)</span>
                                        ) : (
                                          `+${module.price} kr/mnd`
                                        )}
                                      </p>
                                    )}
                                  </div>
                                  <label style={styles.toggle}>
                                    <input
                                      type="checkbox"
                                      checked={isActive}
                                      disabled={module.isStandard || isLoading}
                                      onChange={e => toggleModule(org.id, module.id, e.target.checked)}
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
                            })}
                            {modules.filter(m => m.key !== "booking").length === 0 && (
                              <p style={styles.emptyText}>Ingen tilleggsmoduler tilgjengelig</p>
                            )}
                          </div>
                        )}

                        {activeTab === "stats" && (
                          <div style={styles.statsTab}>
                            {org.stats ? (
                              <>
                                <div style={styles.statsGrid}>
                                  <div style={styles.statCard}>
                                    <span style={styles.statCardValue}>{org.stats.totalUsers}</span>
                                    <span style={styles.statCardLabel}>Brukere</span>
                                  </div>
                                  <div style={styles.statCard}>
                                    <span style={styles.statCardValue}>{org.stats.activeUsers}</span>
                                    <span style={styles.statCardLabel}>Aktive (30d)</span>
                                  </div>
                                  <div style={styles.statCard}>
                                    <span style={styles.statCardValue}>{org.stats.totalFacilities}</span>
                                    <span style={styles.statCardLabel}>Fasiliteter</span>
                                  </div>
                                  <div style={styles.statCard}>
                                    <span style={styles.statCardValue}>{org.stats.totalCategories}</span>
                                    <span style={styles.statCardLabel}>Kategorier</span>
                                  </div>
                                  <div style={styles.statCard}>
                                    <span style={styles.statCardValue}>{org.stats.totalBookings}</span>
                                    <span style={styles.statCardLabel}>Bookinger</span>
                                  </div>
                                  <div style={styles.statCard}>
                                    <span style={styles.statCardValue}>{org.stats.bookingsThisMonth}</span>
                                    <span style={styles.statCardLabel}>Denne mnd</span>
                                  </div>
                                  <div style={styles.statCard}>
                                    <span style={styles.statCardValue}>{org.stats.totalRoles}</span>
                                    <span style={styles.statCardLabel}>Roller</span>
                                  </div>
                                  <div style={styles.statCard}>
                                    <span style={styles.statCardValue}>{org.stats.pendingBookings}</span>
                                    <span style={styles.statCardLabel}>Ventende</span>
                                  </div>
                                </div>
                                <p style={styles.statsUpdated}>
                                  Sist oppdatert: {formatDate(org.stats.lastUpdated)}
                                </p>
                              </>
                            ) : (
                              <div style={styles.noStats}>
                                <span style={styles.noStatsIcon}>📊</span>
                                <p>Ingen statistikk mottatt ennå</p>
                                <p style={styles.noStatsHint}>
                                  SportFlow-appen sender automatisk statistikk daglig
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

      {/* Add Customer Modal */}
      {showAddModal && (
        <div style={styles.modalOverlay} onClick={() => setShowAddModal(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Ny kunde</h2>
            <form onSubmit={handleCreateOrg}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Navn *</label>
                <input
                  type="text"
                  value={newOrg.name}
                  onChange={e => setNewOrg({ ...newOrg, name: e.target.value, slug: generateSlug(e.target.value) })}
                  placeholder="F.eks. Haugesund IL"
                  style={styles.formInput}
                  required
                  autoFocus
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Slug</label>
                <input
                  type="text"
                  value={newOrg.slug}
                  onChange={e => setNewOrg({ ...newOrg, slug: e.target.value })}
                  style={styles.formInput}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>E-post *</label>
                <input
                  type="email"
                  value={newOrg.contactEmail}
                  onChange={e => setNewOrg({ ...newOrg, contactEmail: e.target.value })}
                  placeholder="admin@klubb.no"
                  style={styles.formInput}
                  required
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Kontaktperson</label>
                <input
                  type="text"
                  value={newOrg.contactName}
                  onChange={e => setNewOrg({ ...newOrg, contactName: e.target.value })}
                  placeholder="Ola Nordmann"
                  style={styles.formInput}
                />
              </div>
              <div style={styles.modalActions}>
                <button type="button" style={styles.cancelBtn} onClick={() => setShowAddModal(false)}>
                  Avbryt
                </button>
                <button type="submit" style={styles.primaryBtn} disabled={creating}>
                  {creating ? "Oppretter..." : "Opprett kunde"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

// Styles
const styles: { [key: string]: React.CSSProperties } = {
  // Customer List
  customerList: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
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
  emptyText: {
    color: "#666",
    textAlign: "center",
    padding: "2rem",
  },

  // Customer Card
  customerCard: {
    background: "#111",
    borderRadius: "12px",
    border: "1px solid #222",
    overflow: "hidden",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "1rem 1.25rem",
    cursor: "pointer",
  },
  cardHeaderLeft: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
  },
  customerAvatar: {
    width: "44px",
    height: "44px",
    borderRadius: "10px",
    background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "1.1rem",
    fontWeight: "600",
    color: "#fff",
  },
  customerName: {
    fontSize: "1rem",
    fontWeight: "600",
    margin: 0,
  },
  customerMeta: {
    fontSize: "0.8rem",
    color: "#666",
    margin: "0.25rem 0 0 0",
  },
  cardHeaderRight: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
  },
  statusBadge: {
    padding: "0.35rem 0.75rem",
    borderRadius: "6px",
    fontSize: "0.8rem",
    fontWeight: "500",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  daysLeft: {
    fontSize: "0.7rem",
    opacity: 0.8,
  },
  priceTag: {
    fontSize: "0.85rem",
    color: "#22c55e",
    fontWeight: "500",
  },
  expandIcon: {
    fontSize: "0.7rem",
    color: "#666",
  },

  // Card Body
  cardBody: {
    borderTop: "1px solid #222",
  },
  tabs: {
    display: "flex",
    borderBottom: "1px solid #222",
  },
  tab: {
    padding: "0.75rem 1.25rem",
    background: "transparent",
    border: "none",
    borderBottom: "2px solid transparent",
    color: "#666",
    fontSize: "0.85rem",
    cursor: "pointer",
  },
  tabActive: {
    padding: "0.75rem 1.25rem",
    background: "transparent",
    border: "none",
    borderBottom: "2px solid #3b82f6",
    color: "#3b82f6",
    fontSize: "0.85rem",
    cursor: "pointer",
    fontWeight: "500",
  },
  tabContent: {
    padding: "1.25rem",
  },

  // Info Tab
  infoTab: {
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
  },
  infoSection: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  infoLabel: {
    fontSize: "0.75rem",
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  infoValue: {
    fontSize: "0.9rem",
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
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "1rem",
  },
  keyRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    background: "#0a0a0a",
    padding: "0.75rem",
    borderRadius: "6px",
  },
  keyCode: {
    flex: 1,
    fontSize: "0.8rem",
    color: "#22c55e",
    fontFamily: "monospace",
    wordBreak: "break-all",
  },
  copyBtn: {
    padding: "0.5rem",
    background: "#222",
    border: "none",
    borderRadius: "4px",
    color: "#fff",
    cursor: "pointer",
  },
  statusGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "0.5rem",
  },
  statusOption: {
    padding: "0.6rem",
    background: "transparent",
    border: "1px solid #333",
    borderRadius: "6px",
    color: "#888",
    fontSize: "0.85rem",
    cursor: "pointer",
    transition: "all 0.15s",
  },
  pricingSummary: {
    background: "#0a0a0a",
    padding: "1rem",
    borderRadius: "8px",
  },
  pricingRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "0.85rem",
    color: "#888",
    padding: "0.35rem 0",
  },
  pricingTotal: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "0.95rem",
    color: "#22c55e",
    fontWeight: "600",
    paddingTop: "0.75rem",
    marginTop: "0.5rem",
    borderTop: "1px solid #222",
  },

  // Modules Tab
  modulesTab: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  pilotNote: {
    fontSize: "0.85rem",
    color: "#a855f7",
    background: "rgba(168,85,247,0.1)",
    padding: "0.75rem 1rem",
    borderRadius: "6px",
    margin: "0 0 0.5rem 0",
    textAlign: "center",
  },
  moduleItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "1rem",
    background: "#0a0a0a",
    borderRadius: "8px",
  },
  moduleName: {
    fontSize: "0.9rem",
    fontWeight: "500",
    margin: 0,
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  standardTag: {
    fontSize: "0.65rem",
    padding: "0.2rem 0.4rem",
    background: "rgba(59,130,246,0.2)",
    color: "#60a5fa",
    borderRadius: "4px",
  },
  moduleDesc: {
    fontSize: "0.8rem",
    color: "#666",
    margin: "0.25rem 0 0 0",
  },
  modulePrice: {
    fontSize: "0.8rem",
    color: "#22c55e",
    margin: "0.25rem 0 0 0",
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
    width: "44px",
    height: "24px",
    borderRadius: "12px",
    position: "relative",
    transition: "background 0.2s",
  },
  toggleThumb: {
    position: "absolute",
    top: "2px",
    left: "2px",
    width: "20px",
    height: "20px",
    background: "#fff",
    borderRadius: "50%",
    transition: "transform 0.2s",
  },

  // Stats Tab
  statsTab: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "0.75rem",
  },
  statCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "1rem",
    background: "#0a0a0a",
    borderRadius: "8px",
  },
  statCardValue: {
    fontSize: "1.5rem",
    fontWeight: "700",
    color: "#fff",
  },
  statCardLabel: {
    fontSize: "0.75rem",
    color: "#666",
    marginTop: "0.25rem",
  },
  statsUpdated: {
    fontSize: "0.8rem",
    color: "#666",
    textAlign: "center",
  },
  noStats: {
    textAlign: "center",
    padding: "2rem",
    color: "#666",
  },
  noStatsIcon: {
    fontSize: "2.5rem",
    display: "block",
    marginBottom: "0.75rem",
  },
  noStatsHint: {
    fontSize: "0.8rem",
    color: "#555",
    marginTop: "0.5rem",
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
    maxWidth: "420px",
    maxHeight: "90vh",
    overflowY: "auto",
  },
  modalTitle: {
    fontSize: "1.25rem",
    fontWeight: "600",
    margin: "0 0 1.5rem 0",
  },
  modalActions: {
    display: "flex",
    gap: "0.75rem",
    marginTop: "1.5rem",
    justifyContent: "flex-end",
  },

  // Form
  formGroup: {
    marginBottom: "1rem",
  },
  formLabel: {
    display: "block",
    marginBottom: "0.5rem",
    fontSize: "0.85rem",
    color: "#888",
  },
  formInput: {
    width: "100%",
    padding: "0.75rem",
    background: "#0a0a0a",
    border: "1px solid #333",
    borderRadius: "6px",
    color: "#fff",
    fontSize: "0.9rem",
  },

};
