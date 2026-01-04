"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LICENSE_TYPES, calculateMonthlyPrice, getLicensePrice, LicenseType } from "@/lib/license-config";

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

type Invoice = {
  id: string;
  invoiceNumber: string;
  organizationId: string;
  organization: {
    id: string;
    name: string;
    slug: string;
    contactEmail: string;
    contactName: string | null;
  };
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
  createdAt: string;
  updatedAt: string;
};

type NewOrgForm = {
  name: string;
  slug: string;
  contactEmail: string;
  contactName: string;
};

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [password, setPassword] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [editingOrg, setEditingOrg] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<"inactive" | "pilot" | "free" | "standard" | null>(null);
  const [editingGracePeriod, setEditingGracePeriod] = useState<string | null>(null);
  const [newOrg, setNewOrg] = useState<NewOrgForm>({
    name: "",
    slug: "",
    contactEmail: "",
    contactName: ""
  });
  const [creating, setCreating] = useState(false);
  const [modules, setModules] = useState<Module[]>([]);
  const [orgModules, setOrgModules] = useState<Record<string, OrganizationModule[]>>({});
  const [loadingModules, setLoadingModules] = useState<Record<string, boolean>>({});
  const [showPricingPanel, setShowPricingPanel] = useState(false);
  const [licenseTypePrices, setLicenseTypePrices] = useState<Record<string, { price: number; isOverride: boolean }>>({});
  const [editingPrice, setEditingPrice] = useState<{ type: "module" | "licenseType"; id: string; currentPrice: number | null } | null>(null);
  const [showInvoicesPanel, setShowInvoicesPanel] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [selectedOrgForInvoice, setSelectedOrgForInvoice] = useState<string | null>(null);
  const [invoicePeriod, setInvoicePeriod] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });
  const [editingCustomer, setEditingCustomer] = useState<Organization | null>(null);
  const [customerForm, setCustomerForm] = useState<{
    name: string;
    contactEmail: string;
    contactName: string;
  }>({ name: "", contactEmail: "", contactName: "" });

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
          await loadOrganizations(storedPassword);
          await loadModules(storedPassword);
          await loadLicenseTypePrices(storedPassword);
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Auth check failed:", error);
        router.push("/admin/login");
      }
    };

    checkAuth();
  }, [router]);

  const loadOrganizations = async (adminPassword: string) => {
    try {
      const response = await fetch("/api/license/list", {
        headers: { "x-admin-secret": adminPassword }
      });
      
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data.organizations || []);
        // Last moduler for alle organisasjoner
        for (const org of data.organizations || []) {
          await loadOrgModules(org.id, adminPassword);
        }
      } else {
        setError("Kunne ikke laste organisasjoner");
      }
    } catch (err) {
      setError("Nettverksfeil ved lasting av data");
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
    } catch (err) {
      console.error("Kunne ikke laste moduler:", err);
    }
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
    } catch (err) {
      console.error("Kunne ikke laste organisasjonsmoduler:", err);
    }
  };

  const loadLicenseTypePrices = async (adminPassword: string) => {
    try {
      const response = await fetch("/api/license-types/prices", {
        headers: { "x-admin-secret": adminPassword }
      });
      
      if (response.ok) {
        const data = await response.json();
        const priceMap: Record<string, { price: number; isOverride: boolean }> = {};
        data.prices.forEach((p: any) => {
          priceMap[p.licenseType] = { price: p.price, isOverride: p.isOverride };
        });
        setLicenseTypePrices(priceMap);
      }
    } catch (err) {
      console.error("Kunne ikke laste lisens-type priser:", err);
    }
  };

  const loadInvoices = async (adminPassword: string, organizationId?: string) => {
    setLoadingInvoices(true);
    try {
      const url = organizationId 
        ? `/api/invoices/list?organizationId=${organizationId}`
        : "/api/invoices/list";
      const response = await fetch(url, {
        headers: { "x-admin-secret": adminPassword }
      });
      
      if (response.ok) {
        const data = await response.json();
        setInvoices(data.invoices || []);
      } else {
        setError("Kunne ikke laste fakturaer");
      }
    } catch (err) {
      setError("Nettverksfeil ved lasting av fakturaer");
    } finally {
      setLoadingInvoices(false);
    }
  };

  const createInvoice = async (organizationId: string, month: number, year: number) => {
    try {
      const response = await fetch("/api/invoices/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": password
        },
        body: JSON.stringify({
          organizationId,
          periodMonth: month,
          periodYear: year
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

  const toggleModule = async (orgId: string, moduleId: string, isActive: boolean) => {
    if (!password) return;

    setLoadingModules(prev => ({ ...prev, [`${orgId}-${moduleId}`]: true }));

    try {
      const response = await fetch(`/api/organizations/${orgId}/modules`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": password
        },
        body: JSON.stringify({ moduleId, isActive })
      });

      if (response.ok) {
        await loadOrgModules(orgId, password);
        setSuccess(isActive ? "Modul aktivert" : "Modul deaktivert");
      } else {
        const data = await response.json();
        setError(data.error || "Kunne ikke oppdatere modul");
      }
    } catch (err) {
      setError("Nettverksfeil");
    } finally {
      setLoadingModules(prev => ({ ...prev, [`${orgId}-${moduleId}`]: false }));
    }
  };

  const updateModulePrice = async (moduleId: string, price: number | null) => {
    if (!password) return;

    try {
      const response = await fetch(`/api/modules/${moduleId}/price`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": password
        },
        body: JSON.stringify({ price })
      });

      if (response.ok) {
        await loadModules(password);
        setEditingPrice(null);
        setSuccess("Modulpris oppdatert");
      } else {
        const data = await response.json();
        setError(data.error || "Kunne ikke oppdatere pris");
      }
    } catch (err) {
      setError("Nettverksfeil");
    }
  };

  const updateLicenseTypePrice = async (licenseType: string, price: number) => {
    if (!password) return;

    try {
      const response = await fetch(`/api/license-types/${licenseType}/price`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": password
        },
        body: JSON.stringify({ price })
      });

      if (response.ok) {
        await loadLicenseTypePrices(password);
        setEditingPrice(null);
        setSuccess("Lisens-type pris oppdatert");
      } else {
        const data = await response.json();
        setError(data.error || "Kunne ikke oppdatere pris");
      }
    } catch (err) {
      setError("Nettverksfeil");
    }
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

  const handleNameChange = (name: string) => {
    setNewOrg({
      ...newOrg,
      name,
      slug: generateSlug(name)
    });
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError("");
    setSuccess("");

    try {
      // Opprett med inaktiv status (isActive: false) og en langt frem dato
      const response = await fetch("/api/license/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": password
        },
        body: JSON.stringify({
          name: newOrg.name,
          slug: newOrg.slug,
          contactEmail: newOrg.contactEmail,
          contactName: newOrg.contactName || null,
          licenseType: "free", // Default
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`"${newOrg.name}" opprettet! Lisensnøkkel: ${data.licenseKey}`);
        setNewOrg({ name: "", slug: "", contactEmail: "", contactName: "" });
        setShowAddForm(false);
        await loadOrganizations(password);
        
        // Sett til inaktiv etter opprettelse
        await fetch("/api/license/update", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-secret": password
          },
          body: JSON.stringify({
            slug: data.slug,
            isActive: false
          })
        });
        await loadOrganizations(password);
      } else {
        setError(data.error || "Kunne ikke opprette organisasjon");
      }
    } catch (err) {
      setError("Nettverksfeil");
    } finally {
      setCreating(false);
    }
  };

  const copyToClipboard = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (err) {
      console.error("Kunne ikke kopiere:", err);
    }
  };

  const updateOrgStatus = async (org: Organization, status: "inactive" | "pilot" | "free" | "standard", expiresAt?: string) => {
    try {
      const updates: any = {
        slug: org.slug,
        isActive: status !== "inactive",
        licenseType: status === "inactive" ? org.licenseType : status
      };

      if (expiresAt && status !== "inactive") {
        updates.expiresAt = expiresAt;
      }

      const response = await fetch("/api/license/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": password
        },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        await loadOrganizations(password);
        setEditingOrg(null);
      } else {
        setError("Kunne ikke oppdatere status");
      }
    } catch (err) {
      setError("Nettverksfeil");
    }
  };

  const updateGraceEndsAt = async (org: Organization, graceEndsAt: string | null) => {
    try {
      const updates: any = {
        slug: org.slug,
        graceEndsAt: graceEndsAt || null
      };

      const response = await fetch("/api/license/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": password
        },
        body: JSON.stringify(updates)
      });

      if (response.ok) {
        await loadOrganizations(password);
        setSuccess("Grace period oppdatert");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError("Kunne ikke oppdatere grace period");
      }
    } catch (err) {
      setError("Nettverksfeil");
    }
  };

  const openCustomerEdit = (org: Organization) => {
    setEditingCustomer(org);
    setCustomerForm({
      name: org.name,
      contactEmail: org.contactEmail,
      contactName: org.contactName || ""
    });
  };

  const saveCustomerInfo = async () => {
    if (!editingCustomer) return;

    try {
      const response = await fetch("/api/license/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": password
        },
        body: JSON.stringify({
          slug: editingCustomer.slug,
          name: customerForm.name,
          contactEmail: customerForm.contactEmail,
          contactName: customerForm.contactName || null
        })
      });

      if (response.ok) {
        await loadOrganizations(password);
        setEditingCustomer(null);
        setSuccess("Kundeinformasjon oppdatert");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError("Kunne ikke oppdatere kunde");
      }
    } catch (err) {
      setError("Nettverksfeil");
    }
  };


  const getOrgStatus = (org: Organization): "inactive" | "pilot" | "free" | "standard" => {
    if (!org.isActive) return "inactive";
    const type = org.licenseType.toLowerCase();
    if (type === "pilot") return "pilot";
    if (type === "standard") return "standard";
    if (type === "free") return "free";
    return "inactive";
  };

  const getStatusDisplay = (org: Organization) => {
    const status = getOrgStatus(org);
    if (status === "inactive") {
      return { text: "Inaktiv", color: "#6b7280", bg: "rgba(107, 114, 128, 0.15)" };
    }
    
    const now = new Date();
    const expires = new Date(org.expiresAt);
    const daysLeft = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysLeft < 0) {
      return { text: "Utløpt", color: "#ef4444", bg: "rgba(239, 68, 68, 0.15)" };
    }
    
    const statusNames: Record<string, string> = {
      pilot: "Pilotkunde",
      free: "Prøveperiode",
      standard: "Standard"
    };
    
    const statusColors: Record<string, { color: string; bg: string }> = {
      pilot: { color: "#a855f7", bg: "rgba(168, 85, 247, 0.15)" },
      free: { color: "#22c55e", bg: "rgba(34, 197, 94, 0.15)" },
      standard: { color: "#3b82f6", bg: "rgba(59, 130, 246, 0.15)" }
    };
    
    const colors = statusColors[status] || statusColors.free;
    const name = statusNames[status] || "Ukjent";
    
    return { 
      text: daysLeft <= 30 ? `${name} (${daysLeft}d)` : name, 
      ...colors
    };
  };

  const formatDateForInput = (dateStr: string) => {
    return new Date(dateStr).toISOString().split("T")[0];
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("nb-NO", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  };

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
            <h1 style={styles.title}>Lisensadmin</h1>
            <p style={styles.subtitle}>{organizations.length} organisasjoner</p>
          </div>
        </div>
        <div style={styles.headerActions}>
          <button onClick={() => router.push("/admin/invoices")} style={styles.pricingButton}>
            📄 Fakturaer
          </button>
          <button onClick={() => setShowPricingPanel(true)} style={styles.pricingButton}>
            💰 Priser
          </button>
          <button onClick={() => setShowAddForm(true)} style={styles.addButton}>
            + Ny organisasjon
          </button>
          <button onClick={handleLogout} style={styles.logoutButton}>
            Logg ut
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
          <button onClick={() => setSuccess("")} style={styles.closeButton}>×</button>
        </div>
      )}

      {/* Pricing Administration Panel */}
      {showPricingPanel && (
        <div style={styles.modalOverlay} onClick={() => setShowPricingPanel(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>💰 Prisadministrasjon</h2>
            <p style={styles.modalHint}>
              Endre priser for lisens-typer og moduler. Endringer påvirker alle organisasjoner.
            </p>

            {/* License Type Prices */}
            <div style={styles.pricingAdminSection}>
              <h3 style={styles.pricingSectionTitle}>Lisens-typer</h3>
              <div style={styles.pricingList}>
                {Object.keys(LICENSE_TYPES).map(licenseType => {
                  const type = licenseType as LicenseType;
                  const priceInfo = licenseTypePrices[licenseType] || {
                    price: LICENSE_TYPES[type].price,
                    isOverride: false
                  };
                  const isEditing = editingPrice?.type === "licenseType" && editingPrice.id === licenseType;

                  return (
                    <div key={licenseType} style={styles.pricingItem}>
                      <div style={styles.pricingItemInfo}>
                        <span style={styles.pricingItemName}>
                          {LICENSE_TYPES[type].name}
                          {priceInfo.isOverride && (
                            <span style={styles.overrideBadge}>Overstyrt</span>
                          )}
                        </span>
                        {!isEditing ? (
                          <span style={styles.pricingItemPrice}>
                            {priceInfo.price} kr/mnd
                          </span>
                        ) : (
                          <div style={styles.pricingEditRow}>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              defaultValue={priceInfo.price}
                              style={styles.pricingInput}
                              autoFocus
                              data-price-edit={licenseType}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  const input = e.target as HTMLInputElement;
                                  updateLicenseTypePrice(licenseType, parseInt(input.value) || 0);
                                } else if (e.key === "Escape") {
                                  setEditingPrice(null);
                                }
                              }}
                            />
                            <button
                              onClick={() => {
                                const input = document.querySelector(`input[data-price-edit="${licenseType}"]`) as HTMLInputElement;
                                if (input) {
                                  updateLicenseTypePrice(licenseType, parseInt(input.value) || 0);
                                }
                              }}
                              style={styles.pricingSaveButton}
                            >
                              Lagre
                            </button>
                            <button
                              onClick={() => setEditingPrice(null)}
                              style={styles.pricingCancelButton}
                            >
                              Avbryt
                            </button>
                          </div>
                        )}
                      </div>
                      {!isEditing && (
                        <button
                          onClick={() => setEditingPrice({ type: "licenseType", id: licenseType, currentPrice: priceInfo.price })}
                          style={styles.pricingEditButton}
                        >
                          Rediger
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Module Prices */}
            <div style={styles.pricingAdminSection}>
              <h3 style={styles.pricingSectionTitle}>Moduler</h3>
              <div style={styles.pricingList}>
                {modules
                  .filter(module => module.key !== "booking") // Fjern booking fra listen
                  .map(module => {
                  const isEditing = editingPrice?.type === "module" && editingPrice.id === module.id;

                  return (
                    <div key={module.id} style={styles.pricingItem}>
                      <div style={styles.pricingItemInfo}>
                        <span style={styles.pricingItemName}>
                          {module.name}
                          {module.isStandard && (
                            <span style={styles.standardBadge}>Standard</span>
                          )}
                        </span>
                        {!isEditing ? (
                          <span style={styles.pricingItemPrice}>
                            {module.price !== null ? `${module.price} kr/mnd` : "Gratis"}
                          </span>
                        ) : (
                          <div style={styles.pricingEditRow}>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              defaultValue={module.price ?? 0}
                              placeholder="Gratis"
                              style={styles.pricingInput}
                              autoFocus
                              data-price-edit={module.id}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  const input = e.target as HTMLInputElement;
                                  const price = input.value === "" ? null : parseInt(input.value) || 0;
                                  updateModulePrice(module.id, price);
                                } else if (e.key === "Escape") {
                                  setEditingPrice(null);
                                }
                              }}
                            />
                            <button
                              onClick={() => {
                                const input = document.querySelector(`input[data-price-edit="${module.id}"]`) as HTMLInputElement;
                                if (input) {
                                  const price = input.value === "" ? null : parseInt(input.value) || 0;
                                  updateModulePrice(module.id, price);
                                }
                              }}
                              style={styles.pricingSaveButton}
                            >
                              Lagre
                            </button>
                            <button
                              onClick={() => setEditingPrice(null)}
                              style={styles.pricingCancelButton}
                            >
                              Avbryt
                            </button>
                          </div>
                        )}
                      </div>
                      {!isEditing && (
                        <button
                          onClick={() => setEditingPrice({ type: "module", id: module.id, currentPrice: module.price })}
                          style={styles.pricingEditButton}
                        >
                          Rediger
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={styles.modalActions}>
              <button
                onClick={() => setShowPricingPanel(false)}
                style={styles.cancelButton}
              >
                Lukk
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fakturaer Panel */}
      {showInvoicesPanel && (
        <div style={styles.modalOverlay} onClick={() => setShowInvoicesPanel(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>📄 Fakturaer</h2>
              <button
                onClick={() => setShowInvoicesPanel(false)}
                style={styles.closeButton}
              >
                ×
              </button>
            </div>

            <div style={styles.invoiceSection}>
              <div style={styles.invoiceHeader}>
                <button
                  onClick={() => {
                    setShowCreateInvoice(true);
                    setSelectedOrgForInvoice(null);
                  }}
                  style={styles.addButton}
                >
                  + Opprett faktura
                </button>
                {loadingInvoices && <span style={styles.loadingText}>Laster...</span>}
              </div>

              {showCreateInvoice && (
                <div style={styles.createInvoiceForm}>
                  <h3 style={styles.createInvoiceTitle}>Opprett ny faktura</h3>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Organisasjon</label>
                    <select
                      value={selectedOrgForInvoice || ""}
                      onChange={(e) => setSelectedOrgForInvoice(e.target.value)}
                      style={styles.input}
                      required
                    >
                      <option value="">Velg organisasjon</option>
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
                    <label style={styles.label}>Periode</label>
                    <div style={styles.dateInputRow}>
                      <select
                        value={invoicePeriod.month}
                        onChange={(e) => setInvoicePeriod({ ...invoicePeriod, month: parseInt(e.target.value) })}
                        style={styles.input}
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                          <option key={month} value={month}>
                            {new Date(2000, month - 1).toLocaleDateString("nb-NO", { month: "long" })}
                          </option>
                        ))}
                      </select>
                      <select
                        value={invoicePeriod.year}
                        onChange={(e) => setInvoicePeriod({ ...invoicePeriod, year: parseInt(e.target.value) })}
                        style={styles.input}
                      >
                        {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div style={styles.modalActions}>
                    <button
                      onClick={() => {
                        if (selectedOrgForInvoice) {
                          createInvoice(selectedOrgForInvoice, invoicePeriod.month, invoicePeriod.year);
                        }
                      }}
                      style={styles.addButton}
                      disabled={!selectedOrgForInvoice}
                    >
                      Opprett
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

              <div style={styles.invoiceList}>
                {invoices.length === 0 ? (
                  <p style={styles.emptyText}>Ingen fakturaer funnet</p>
                ) : (
                  invoices.map(invoice => {
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
                    const statusInfo = statusColors[invoice.status] || statusColors.draft;
                    const monthName = new Date(2000, invoice.periodMonth - 1).toLocaleDateString("nb-NO", { month: "long" });

                    return (
                      <div key={invoice.id} style={styles.invoiceCard}>
                        <div style={styles.invoiceCardHeader}>
                          <div>
                            <h4 style={styles.invoiceNumber}>{invoice.invoiceNumber}</h4>
                            <p style={styles.invoiceOrg}>{invoice.organization.name}</p>
                            <p style={styles.invoicePeriod}>
                              {monthName} {invoice.periodYear}
                            </p>
                          </div>
                          <div style={styles.invoiceCardRight}>
                            <span style={{
                              ...styles.statusBadge,
                              color: statusInfo.color,
                              background: statusInfo.bg
                            }}>
                              {statusLabels[invoice.status]}
                            </span>
                            <p style={styles.invoiceAmount}>{invoice.amount} kr</p>
                          </div>
                        </div>
                        <div style={styles.invoiceDetails}>
                          <p style={styles.invoiceDetail}>
                            <strong>Base-pris:</strong> {invoice.basePrice} kr
                          </p>
                          {invoice.modulePrice > 0 && (
                            <p style={styles.invoiceDetail}>
                              <strong>Moduler:</strong> {invoice.modulePrice} kr
                            </p>
                          )}
                          <p style={styles.invoiceDetail}>
                            <strong>Forfallsdato:</strong> {formatDate(invoice.dueDate)}
                          </p>
                          {invoice.paidDate && (
                            <p style={styles.invoiceDetail}>
                              <strong>Betalt:</strong> {formatDate(invoice.paidDate)}
                            </p>
                          )}
                        </div>
                        <div style={styles.invoiceActions}>
                          {invoice.status === "draft" && (
                            <button
                              onClick={() => updateInvoiceStatus(invoice.id, "sent")}
                              style={styles.invoiceActionButton}
                            >
                              Marker som sendt
                            </button>
                          )}
                          {invoice.status !== "paid" && invoice.status !== "cancelled" && (
                            <button
                              onClick={() => updateInvoiceStatus(invoice.id, "paid", new Date().toISOString())}
                              style={{ ...styles.invoiceActionButton, background: "#22c55e" }}
                            >
                              Marker som betalt
                            </button>
                          )}
                          {invoice.status !== "cancelled" && (
                            <button
                              onClick={() => updateInvoiceStatus(invoice.id, "cancelled")}
                              style={{ ...styles.invoiceActionButton, background: "#ef4444" }}
                            >
                              Kanseller
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div style={styles.modalActions}>
              <button
                onClick={() => setShowInvoicesPanel(false)}
                style={styles.cancelButton}
              >
                Lukk
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {editingCustomer && (
        <div style={styles.modalOverlay} onClick={() => setEditingCustomer(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Rediger kundeinformasjon</h2>
            <p style={styles.modalHint}>
              Rediger informasjonen for {editingCustomer.name}
            </p>
            <div style={styles.formGroup}>
              <label style={styles.label}>Navn *</label>
              <input
                type="text"
                value={customerForm.name}
                onChange={e => setCustomerForm({ ...customerForm, name: e.target.value })}
                placeholder="F.eks. Haugesund IL"
                required
                style={styles.input}
                autoFocus
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Kontakt-epost *</label>
              <input
                type="email"
                value={customerForm.contactEmail}
                onChange={e => setCustomerForm({ ...customerForm, contactEmail: e.target.value })}
                placeholder="admin@klubb.no"
                required
                style={styles.input}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Kontaktperson</label>
              <input
                type="text"
                value={customerForm.contactName}
                onChange={e => setCustomerForm({ ...customerForm, contactName: e.target.value })}
                placeholder="Ola Nordmann"
                style={styles.input}
              />
            </div>
            <div style={styles.modalActions}>
              <button
                onClick={() => setEditingCustomer(null)}
                style={styles.cancelButton}
              >
                Avbryt
              </button>
              <button
                onClick={saveCustomerInfo}
                style={styles.addButton}
                disabled={!customerForm.name || !customerForm.contactEmail}
              >
                Lagre endringer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Organization Modal */}
      {showAddForm && (
        <div style={styles.modalOverlay} onClick={() => setShowAddForm(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Ny organisasjon</h2>
            <p style={styles.modalHint}>
              Organisasjonen opprettes som inaktiv. Du kan aktivere og sette utløpsdato etterpå.
            </p>
            <form onSubmit={handleCreateOrg}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Navn *</label>
                <input
                  type="text"
                  value={newOrg.name}
                  onChange={e => handleNameChange(e.target.value)}
                  placeholder="F.eks. Haugesund IL"
                  required
                  style={styles.input}
                  autoFocus
                />
              </div>
              
              <div style={styles.formGroup}>
                <label style={styles.label}>Slug</label>
                <input
                  type="text"
                  value={newOrg.slug}
                  onChange={e => setNewOrg({...newOrg, slug: e.target.value})}
                  placeholder="haugesund-il"
                  required
                  style={styles.input}
                />
                <span style={styles.hint}>Brukes i URL og som identifikator</span>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Kontakt-epost *</label>
                <input
                  type="email"
                  value={newOrg.contactEmail}
                  onChange={e => setNewOrg({...newOrg, contactEmail: e.target.value})}
                  placeholder="admin@klubb.no"
                  required
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Kontaktperson</label>
                <input
                  type="text"
                  value={newOrg.contactName}
                  onChange={e => setNewOrg({...newOrg, contactName: e.target.value})}
                  placeholder="Ola Nordmann"
                  style={styles.input}
                />
              </div>

              <div style={styles.modalActions}>
                <button 
                  type="button" 
                  onClick={() => setShowAddForm(false)} 
                  style={styles.cancelButton}
                >
                  Avbryt
                </button>
                <button 
                  type="submit" 
                  disabled={creating}
                  style={styles.submitButton}
                >
                  {creating ? "Oppretter..." : "Opprett"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Organizations List */}
      <div style={styles.orgList}>
        {organizations.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyIcon}>📋</p>
            <p>Ingen organisasjoner ennå</p>
            <button onClick={() => setShowAddForm(true)} style={styles.emptyButton}>
              Legg til første organisasjon
            </button>
          </div>
        ) : (
          organizations.map(org => {
            const status = getOrgStatus(org);
            const statusDisplay = getStatusDisplay(org);
            const isEditing = editingOrg === org.id;

            return (
              <div key={org.id} style={styles.orgCard}>
                <div style={styles.orgHeader}>
                  <div>
                    <h3 style={styles.orgName}>
                      {org.name}
                      <button
                        onClick={() => openCustomerEdit(org)}
                        style={styles.editCustomerButton}
                        title="Rediger kundeinformasjon"
                      >
                        ✏️
                      </button>
                    </h3>
                    <p style={styles.orgSlug}>
                      {org.slug} • {org.contactEmail}
                      {org.contactName && ` • ${org.contactName}`}
                    </p>
                  </div>
                  <span style={{
                    ...styles.statusBadge,
                    background: statusDisplay.bg,
                    color: statusDisplay.color,
                  }}>
                    {statusDisplay.text}
                  </span>
                </div>

                {/* License Key */}
                <div style={styles.keySection}>
                  <div style={styles.keyRow}>
                    <code style={styles.keyCode}>{org.licenseKey}</code>
                    <button
                      onClick={() => copyToClipboard(org.licenseKey)}
                      style={styles.copyButton}
                    >
                      {copiedKey === org.licenseKey ? "✓ Kopiert!" : "Kopier nøkkel"}
                    </button>
                  </div>
                </div>

                {/* Status Controls */}
                <div style={styles.statusSection}>
                  <div style={styles.statusButtons}>
                    <button
                      onClick={() => {
                        if (status !== "inactive") {
                          updateOrgStatus(org, "inactive");
                        }
                      }}
                      style={{
                        ...styles.statusButton,
                        ...(status === "inactive" ? styles.statusButtonActive : {}),
                        borderColor: status === "inactive" ? "#6b7280" : "#333"
                      }}
                    >
                      Inaktiv
                    </button>
                    <button
                      onClick={() => {
                        if (status === "pilot") return;
                        setEditingOrg(org.id);
                        setPendingStatus("pilot");
                      }}
                      style={{
                        ...styles.statusButton,
                        ...(status === "pilot" ? styles.statusButtonActivePilot : {}),
                        borderColor: status === "pilot" ? "#a855f7" : "#333"
                      }}
                    >
                      Pilotkunde
                    </button>
                    <button
                      onClick={() => {
                        if (status === "free") return;
                        setEditingOrg(org.id);
                        setPendingStatus("free");
                      }}
                      style={{
                        ...styles.statusButton,
                        ...(status === "free" ? styles.statusButtonActiveFree : {}),
                        borderColor: status === "free" ? "#22c55e" : "#333"
                      }}
                    >
                      Prøveperiode
                    </button>
                    <button
                      onClick={() => {
                        if (status === "standard") return;
                        setEditingOrg(org.id);
                        setPendingStatus("standard");
                      }}
                      style={{
                        ...styles.statusButton,
                        ...(status === "standard" ? styles.statusButtonActiveStandard : {}),
                        borderColor: status === "standard" ? "#3b82f6" : "#333"
                      }}
                    >
                      Standard
                    </button>
                  </div>

                  {/* Pricing Summary */}
                  <div style={styles.pricingSection}>
                    <h4 style={styles.pricingTitle}>Prisoversikt</h4>
                    <div style={styles.pricingBreakdown}>
                      <div style={styles.pricingRow}>
                        <span style={styles.pricingLabel}>
                          {LICENSE_TYPES[org.licenseType as LicenseType]?.name || org.licenseType}:
                        </span>
                        <span style={styles.pricingValue}>
                          {getLicensePrice(
                            org.licenseType as LicenseType,
                            licenseTypePrices[org.licenseType]?.price
                          )} kr/mnd
                        </span>
                      </div>
                      {orgModules[org.id]?.filter(om => om.isActive && om.module.price !== null).map(orgModule => {
                        const isPilot = org.licenseType === "pilot";
                        const modulePrice = isPilot ? 0 : (orgModule.module.price ?? 0);
                        return (
                          <div key={orgModule.id} style={styles.pricingRow}>
                            <span style={styles.pricingLabel}>
                              {orgModule.module.name}:
                            </span>
                            <span style={styles.pricingValue}>
                              {modulePrice} kr/mnd
                              {isPilot && <span style={{ color: "#a855f7", marginLeft: "0.5rem", fontSize: "0.7rem" }}>(gratis for pilot)</span>}
                            </span>
                          </div>
                        );
                      })}
                      <div style={styles.pricingTotal}>
                        <span style={styles.pricingTotalLabel}>Totalt per måned:</span>
                        <span style={styles.pricingTotalValue}>
                          {calculateMonthlyPrice(
                            org.licenseType as LicenseType,
                            orgModules[org.id]?.filter(om => om.isActive) || [],
                            licenseTypePrices[org.licenseType]?.price
                          )} kr/mnd
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Modules Section */}
                  <div style={styles.modulesSection}>
                    <h4 style={styles.modulesTitle}>Tilleggsmoduler</h4>
                    <p style={styles.modulesHint}>
                      Booking er alltid inkludert (unntatt inaktiv lisens)
                    </p>
                    <div style={styles.modulesList}>
                      {modules
                        .filter(module => module.key !== "booking") // Fjern booking fra listen
                        .map(module => {
                          const orgModule = orgModules[org.id]?.find(om => om.moduleId === module.id);
                          const isActive = orgModule?.isActive ?? module.isStandard;
                          const isLoading = loadingModules[`${org.id}-${module.id}`] ?? false;

                          return (
                            <div key={module.id} style={styles.moduleItem}>
                              <div style={styles.moduleInfo}>
                                <span style={styles.moduleName}>
                                  {module.name}
                                  {module.isStandard && (
                                    <span style={styles.standardBadge}>Standard</span>
                                  )}
                                </span>
                                {module.description && (
                                  <span style={styles.moduleDescription}>{module.description}</span>
                                )}
                                {module.price !== null && (
                                  <span style={styles.modulePrice}>
                                    {module.price} kr/mnd
                                  </span>
                                )}
                              </div>
                              <label style={{
                                ...styles.toggleSwitch,
                                ...(module.isStandard ? { opacity: 0.5, cursor: "not-allowed" } : {})
                              }}>
                                <input
                                  type="checkbox"
                                  checked={isActive}
                                  disabled={module.isStandard || isLoading}
                                  onChange={(e) => toggleModule(org.id, module.id, e.target.checked)}
                                  style={styles.toggleInput}
                                />
                                <span style={{
                                  ...styles.toggleSlider,
                                  ...(isActive ? styles.toggleSliderActive : {}),
                                  ...(isActive ? { 
                                    boxShadow: "0 0 0 2px #3b82f6 inset",
                                  } : {})
                                }}>
                                  <span style={{
                                    ...styles.toggleSliderKnob,
                                    ...(isActive ? styles.toggleSliderKnobActive : {})
                                  }} />
                                </span>
                              </label>
                            </div>
                          );
                        })}
                      {modules.filter(m => m.key !== "booking").length === 0 && (
                        <p style={styles.noModules}>Ingen tilleggsmoduler tilgjengelig</p>
                      )}
                    </div>
                  </div>

                  {/* Date picker when editing */}
                  {isEditing && pendingStatus && pendingStatus !== "inactive" && (
                    <div style={styles.datePickerRow}>
                      <label style={styles.dateLabel}>Betalt til:</label>
                      <input
                        type="date"
                        defaultValue={formatDateForInput(org.expiresAt)}
                        style={styles.dateInput}
                        id={`date-${org.id}`}
                      />
                      <button
                        onClick={() => {
                          const dateInput = document.getElementById(`date-${org.id}`) as HTMLInputElement;
                          updateOrgStatus(org, pendingStatus, new Date(dateInput.value).toISOString());
                          setPendingStatus(null);
                        }}
                        style={{
                          ...styles.saveDateButton,
                          background: pendingStatus === "pilot" ? "#a855f7" : 
                                     pendingStatus === "free" ? "#22c55e" : 
                                     pendingStatus === "standard" ? "#3b82f6" : "#3b82f6"
                        }}
                      >
                        Lagre som {pendingStatus === "pilot" ? "Pilotkunde" : 
                                  pendingStatus === "free" ? "Prøveperiode" : 
                                  pendingStatus === "standard" ? "Standard" : pendingStatus}
                      </button>
                      <button
                        onClick={() => {
                          setEditingOrg(null);
                          setPendingStatus(null);
                        }}
                        style={styles.cancelDateButton}
                      >
                        Avbryt
                      </button>
                    </div>
                  )}

                  {status !== "inactive" && !isEditing && (
                    <>
                      <p style={styles.expiresText}>
                        Utløper: {formatDate(org.expiresAt)}
                        <button
                          onClick={() => {
                            setEditingOrg(org.id);
                            setPendingStatus(status);
                          }}
                          style={styles.editDateButton}
                        >
                          Endre dato
                        </button>
                      </p>
                      <p style={styles.expiresText}>
                        Grace period: {org.graceEndsAt ? formatDate(org.graceEndsAt) : "Ikke satt"}
                        {editingGracePeriod === org.id ? (
                          <>
                            <input
                              type="date"
                              defaultValue={org.graceEndsAt ? formatDateForInput(org.graceEndsAt) : ""}
                              style={{ ...styles.dateInput, marginLeft: "8px", marginRight: "8px" }}
                              id={`grace-${org.id}`}
                            />
                            <button
                              onClick={() => {
                                const dateInput = document.getElementById(`grace-${org.id}`) as HTMLInputElement;
                                const newDate = dateInput.value ? new Date(dateInput.value).toISOString() : null;
                                updateGraceEndsAt(org, newDate);
                                setEditingGracePeriod(null);
                              }}
                              style={{ ...styles.editDateButton, background: "#10b981", marginRight: "4px" }}
                            >
                              Lagre
                            </button>
                            <button
                              onClick={() => {
                                updateGraceEndsAt(org, null);
                                setEditingGracePeriod(null);
                              }}
                              style={{ ...styles.editDateButton, background: "#ef4444", marginRight: "4px" }}
                            >
                              Fjern
                            </button>
                            <button
                              onClick={() => setEditingGracePeriod(null)}
                              style={styles.editDateButton}
                            >
                              Avbryt
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setEditingGracePeriod(org.id)}
                            style={styles.editDateButton}
                          >
                            {org.graceEndsAt ? "Endre" : "Sett"}
                          </button>
                        )}
                      </p>
                    </>
                  )}
                </div>

                {/* Statistikk-seksjon */}
                {/* Statistikk */}
                {org.isActive && (
                  <div style={styles.statsSection}>
                    <h4 style={styles.statsTitle}>
                      📊 Aktivitetsstatistikk
                      {org.stats && (
                        <span style={styles.statsUpdated}>
                          Oppdatert: {formatDate(org.stats.lastUpdated)}
                        </span>
                      )}
                    </h4>

                    {org.stats ? (
                      <>
                        <div style={styles.statsGrid}>
                          <div style={styles.statItem}>
                            <span style={styles.statValue}>{org.stats.totalUsers}</span>
                            <span style={styles.statLabel}>Brukere</span>
                          </div>
                          <div style={styles.statItem}>
                            <span style={styles.statValue}>{org.stats.activeUsers}</span>
                            <span style={styles.statLabel}>Aktive (30d)</span>
                          </div>
                          <div style={styles.statItem}>
                            <span style={styles.statValue}>{org.stats.totalFacilities}</span>
                            <span style={styles.statLabel}>Fasiliteter</span>
                          </div>
                          <div style={styles.statItem}>
                            <span style={styles.statValue}>{org.stats.totalCategories}</span>
                            <span style={styles.statLabel}>Kategorier</span>
                          </div>
                          <div style={styles.statItem}>
                            <span style={styles.statValue}>{org.stats.totalRoles}</span>
                            <span style={styles.statLabel}>Roller</span>
                          </div>
                          <div style={styles.statItem}>
                            <span style={styles.statValue}>{org.stats.totalBookings}</span>
                            <span style={styles.statLabel}>Bookinger</span>
                          </div>
                          <div style={styles.statItem}>
                            <span style={styles.statValue}>{org.stats.bookingsThisMonth}</span>
                            <span style={styles.statLabel}>Denne mnd</span>
                          </div>
                          <div style={styles.statItem}>
                            <span style={styles.statValue}>{org.stats.pendingBookings}</span>
                            <span style={styles.statLabel}>Ventende</span>
                          </div>
                        </div>
                        {org.stats.lastUserLogin && (
                          <p style={styles.lastLogin}>
                            Siste innlogging: {formatDate(org.stats.lastUserLogin)}
                          </p>
                        )}
                      </>
                    ) : (
                      <p style={styles.noStatsText}>
                        Ingen statistikk mottatt ennå. SportFlow-appen sender automatisk statistikk daglig.
                      </p>
                    )}
                  </div>
                )}

                {!org.isActive && (
                  <div style={styles.noStatsSection}>
                    <p style={styles.noStatsText}>
                      📊 Statistikk er ikke tilgjengelig for inaktive organisasjoner.
                    </p>
                  </div>
                )}

              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: "100vh",
    background: "#0a0a0a",
    color: "#fff",
    padding: "1.5rem",
    maxWidth: "900px",
    margin: "0 auto",
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
    fontWeight: "600",
    margin: 0,
  },
  subtitle: {
    color: "#737373",
    margin: "0.25rem 0 0 0",
    fontSize: "0.9rem",
  },
  headerActions: {
    display: "flex",
    gap: "0.75rem",
  },
  pricingButton: {
    padding: "0.6rem 1.25rem",
    background: "#22c55e",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "0.9rem",
    fontWeight: "500",
  },
  addButton: {
    padding: "0.6rem 1.25rem",
    background: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "0.9rem",
    fontWeight: "500",
  },
  logoutButton: {
    padding: "0.6rem 1rem",
    background: "transparent",
    color: "#737373",
    border: "1px solid #333",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "0.9rem",
  },
  errorBox: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "1rem",
    background: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    borderRadius: "8px",
    color: "#f87171",
    marginBottom: "1rem",
  },
  successBox: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "1rem",
    background: "rgba(34, 197, 94, 0.1)",
    border: "1px solid rgba(34, 197, 94, 0.3)",
    borderRadius: "8px",
    color: "#4ade80",
    marginBottom: "1rem",
  },
  closeButton: {
    background: "none",
    border: "none",
    color: "inherit",
    fontSize: "1.25rem",
    cursor: "pointer",
    padding: "0 0.5rem",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0, 0, 0, 0.8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
    padding: "1rem",
  },
  modal: {
    background: "#141414",
    borderRadius: "12px",
    border: "1px solid #262626",
    padding: "1.5rem",
    width: "100%",
    maxWidth: "450px",
  },
  modalTitle: {
    fontSize: "1.25rem",
    fontWeight: "600",
    marginBottom: "0.5rem",
  },
  modalHint: {
    color: "#737373",
    fontSize: "0.85rem",
    marginBottom: "1.5rem",
  },
  formGroup: {
    marginBottom: "1rem",
  },
  label: {
    display: "block",
    marginBottom: "0.5rem",
    fontSize: "0.85rem",
    color: "#a3a3a3",
  },
  input: {
    width: "100%",
    padding: "0.75rem",
    background: "#0a0a0a",
    border: "1px solid #333",
    borderRadius: "6px",
    color: "#fff",
    fontSize: "0.95rem",
  },
  hint: {
    display: "block",
    marginTop: "0.25rem",
    fontSize: "0.75rem",
    color: "#525252",
  },
  modalActions: {
    display: "flex",
    gap: "0.75rem",
    marginTop: "1.5rem",
  },
  cancelButton: {
    flex: 1,
    padding: "0.75rem",
    background: "transparent",
    border: "1px solid #333",
    borderRadius: "8px",
    color: "#a3a3a3",
    cursor: "pointer",
    fontSize: "0.9rem",
  },
  submitButton: {
    flex: 1,
    padding: "0.75rem",
    background: "#3b82f6",
    border: "none",
    borderRadius: "8px",
    color: "#fff",
    cursor: "pointer",
    fontSize: "0.9rem",
    fontWeight: "500",
  },
  orgList: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  emptyState: {
    textAlign: "center",
    padding: "4rem 2rem",
    background: "#141414",
    borderRadius: "12px",
    border: "1px solid #262626",
  },
  emptyIcon: {
    fontSize: "3rem",
    marginBottom: "1rem",
  },
  emptyButton: {
    marginTop: "1rem",
    padding: "0.75rem 1.5rem",
    background: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "0.9rem",
  },
  orgCard: {
    background: "#141414",
    borderRadius: "12px",
    border: "1px solid #262626",
    padding: "1.25rem",
  },
  orgHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "1rem",
  },
  orgName: {
    fontSize: "1.1rem",
    fontWeight: "600",
    margin: 0,
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  editCustomerButton: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: "0.9rem",
    opacity: 0.6,
    padding: "0.25rem",
    borderRadius: "4px",
  },
  orgSlug: {
    fontSize: "0.8rem",
    color: "#737373",
    margin: "0.25rem 0 0 0",
  },
  statusBadge: {
    padding: "0.35rem 0.75rem",
    borderRadius: "6px",
    fontSize: "0.8rem",
    fontWeight: "500",
  },
  keySection: {
    background: "#0a0a0a",
    borderRadius: "8px",
    padding: "0.75rem 1rem",
    marginBottom: "1rem",
  },
  keyRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "0.75rem",
  },
  keyCode: {
    fontSize: "0.85rem",
    color: "#22c55e",
    fontFamily: "monospace",
    wordBreak: "break-all",
  },
  copyButton: {
    padding: "0.4rem 0.75rem",
    background: "#262626",
    border: "none",
    borderRadius: "4px",
    color: "#a3a3a3",
    cursor: "pointer",
    fontSize: "0.8rem",
    whiteSpace: "nowrap",
  },
  pricingSection: {
    marginTop: "1rem",
    padding: "1rem",
    background: "rgba(34, 197, 94, 0.05)",
    borderRadius: "8px",
    border: "1px solid rgba(34, 197, 94, 0.2)",
  },
  pricingTitle: {
    fontSize: "0.9rem",
    fontWeight: "600",
    margin: "0 0 0.75rem 0",
    color: "#22c55e",
  },
  pricingBreakdown: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  pricingRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "0.85rem",
  },
  pricingLabel: {
    color: "#a3a3a3",
  },
  pricingValue: {
    color: "#fff",
    fontWeight: "500",
  },
  pricingTotal: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: "0.5rem",
    paddingTop: "0.75rem",
    borderTop: "1px solid rgba(34, 197, 94, 0.2)",
  },
  pricingTotalLabel: {
    color: "#22c55e",
    fontWeight: "600",
    fontSize: "0.95rem",
  },
  pricingTotalValue: {
    color: "#22c55e",
    fontWeight: "700",
    fontSize: "1.1rem",
  },
  pricingAdminSection: {
    marginBottom: "1.5rem",
  },
  pricingSectionTitle: {
    fontSize: "1rem",
    fontWeight: "600",
    margin: "0 0 0.75rem 0",
    color: "#fff",
  },
  pricingList: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  pricingItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.75rem",
    background: "#0a0a0a",
    borderRadius: "6px",
    border: "1px solid #262626",
  },
  pricingItemInfo: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flex: 1,
    gap: "1rem",
  },
  pricingItemName: {
    fontSize: "0.9rem",
    color: "#fff",
    fontWeight: "500",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  pricingItemPrice: {
    fontSize: "0.9rem",
    color: "#22c55e",
    fontWeight: "600",
  },
  pricingEditRow: {
    display: "flex",
    gap: "0.5rem",
    alignItems: "center",
  },
  pricingInput: {
    width: "100px",
    padding: "0.5rem",
    background: "#141414",
    border: "1px solid #333",
    borderRadius: "4px",
    color: "#fff",
    fontSize: "0.9rem",
  },
  pricingSaveButton: {
    padding: "0.5rem 0.75rem",
    background: "#22c55e",
    border: "none",
    borderRadius: "4px",
    color: "#fff",
    cursor: "pointer",
    fontSize: "0.85rem",
    fontWeight: "500",
  },
  pricingCancelButton: {
    padding: "0.5rem 0.75rem",
    background: "transparent",
    border: "1px solid #333",
    borderRadius: "4px",
    color: "#737373",
    cursor: "pointer",
    fontSize: "0.85rem",
  },
  pricingEditButton: {
    padding: "0.4rem 0.75rem",
    background: "transparent",
    border: "1px solid #3b82f6",
    borderRadius: "4px",
    color: "#3b82f6",
    cursor: "pointer",
    fontSize: "0.8rem",
  },
  overrideBadge: {
    fontSize: "0.7rem",
    padding: "0.15rem 0.4rem",
    background: "rgba(245, 158, 11, 0.2)",
    color: "#f59e0b",
    borderRadius: "4px",
    fontWeight: "500",
  },
  modulesSection: {
    marginTop: "1rem",
    padding: "1rem",
    background: "#0a0a0a",
    borderRadius: "8px",
    border: "1px solid #262626",
  },
  modulesTitle: {
    fontSize: "0.9rem",
    fontWeight: "600",
    margin: "0 0 0.5rem 0",
    color: "#a3a3a3",
  },
  modulesHint: {
    fontSize: "0.75rem",
    color: "#737373",
    margin: "0 0 0.75rem 0",
    fontStyle: "italic",
  },
  modulesList: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  moduleItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.75rem",
    background: "#141414",
    borderRadius: "6px",
    border: "1px solid #262626",
  },
  moduleInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
    flex: 1,
  },
  moduleName: {
    fontSize: "0.9rem",
    fontWeight: "500",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  standardBadge: {
    fontSize: "0.7rem",
    padding: "0.15rem 0.4rem",
    background: "rgba(59, 130, 246, 0.2)",
    color: "#60a5fa",
    borderRadius: "4px",
    fontWeight: "500",
  },
  moduleDescription: {
    fontSize: "0.75rem",
    color: "#737373",
  },
  modulePrice: {
    fontSize: "0.75rem",
    color: "#22c55e",
    fontWeight: "500",
  },
  noModules: {
    fontSize: "0.85rem",
    color: "#737373",
    textAlign: "center",
    padding: "1rem",
  },
  toggleSwitch: {
    position: "relative",
    display: "inline-block",
    width: "44px",
    height: "24px",
    cursor: "pointer",
  },
  toggleInput: {
    opacity: 0,
    width: 0,
    height: 0,
  },
  toggleSlider: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "#333",
    borderRadius: "24px",
    transition: "0.3s",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
  },
  toggleSliderActive: {
    background: "#3b82f6",
  },
  toggleSliderKnob: {
    position: "absolute",
    height: "18px",
    width: "18px",
    left: "3px",
    background: "#fff",
    borderRadius: "50%",
    transition: "0.3s",
    boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
  },
  toggleSliderKnobActive: {
    left: "23px",
  },
  statusSection: {
    marginBottom: "1rem",
  },
  statusButtons: {
    display: "flex",
    gap: "0.5rem",
    marginBottom: "0.75rem",
  },
  statusButton: {
    flex: 1,
    padding: "0.6rem",
    background: "transparent",
    border: "1px solid #333",
    borderRadius: "6px",
    color: "#737373",
    cursor: "pointer",
    fontSize: "0.85rem",
    transition: "all 0.15s",
  },
  statusButtonActive: {
    background: "rgba(107, 114, 128, 0.15)",
    color: "#9ca3af",
    borderColor: "#6b7280",
  },
  statusButtonActivePilot: {
    background: "rgba(168, 85, 247, 0.15)",
    color: "#a855f7",
    borderColor: "#a855f7",
  },
  statusButtonActiveFree: {
    background: "rgba(34, 197, 94, 0.15)",
    color: "#22c55e",
    borderColor: "#22c55e",
  },
  statusButtonActiveStandard: {
    background: "rgba(59, 130, 246, 0.15)",
    color: "#3b82f6",
    borderColor: "#3b82f6",
  },
  datePickerRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "0.75rem",
    background: "#1a1a1a",
    borderRadius: "6px",
    flexWrap: "wrap",
  },
  dateLabel: {
    fontSize: "0.85rem",
    color: "#a3a3a3",
  },
  dateInput: {
    padding: "0.5rem",
    background: "#0a0a0a",
    border: "1px solid #333",
    borderRadius: "4px",
    color: "#fff",
    fontSize: "0.9rem",
  },
  saveDateButton: {
    padding: "0.5rem 1rem",
    background: "#22c55e",
    border: "none",
    borderRadius: "4px",
    color: "#fff",
    cursor: "pointer",
    fontSize: "0.85rem",
  },
  cancelDateButton: {
    padding: "0.5rem 0.75rem",
    background: "transparent",
    border: "1px solid #333",
    borderRadius: "4px",
    color: "#737373",
    cursor: "pointer",
    fontSize: "0.85rem",
  },
  expiresText: {
    fontSize: "0.85rem",
    color: "#737373",
    margin: 0,
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  editDateButton: {
    padding: "0.25rem 0.5rem",
    background: "transparent",
    border: "none",
    color: "#3b82f6",
    cursor: "pointer",
    fontSize: "0.8rem",
  },
  invoiceSection: {
    maxHeight: "70vh",
    overflowY: "auto",
  },
  invoiceHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1rem",
  },
  loadingText: {
    color: "#a3a3a3",
    fontSize: "0.9rem",
  },
  createInvoiceForm: {
    padding: "1rem",
    background: "#1a1a1a",
    borderRadius: "8px",
    marginBottom: "1rem",
    border: "1px solid #262626",
  },
  createInvoiceTitle: {
    fontSize: "1rem",
    fontWeight: "600",
    margin: "0 0 1rem 0",
    color: "#fff",
  },
  dateInputRow: {
    display: "flex",
    gap: "0.5rem",
  },
  invoiceList: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  emptyText: {
    color: "#737373",
    textAlign: "center",
    padding: "2rem",
  },
  invoiceCard: {
    padding: "1rem",
    background: "#1a1a1a",
    borderRadius: "8px",
    border: "1px solid #262626",
  },
  invoiceCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "0.75rem",
  },
  invoiceCardRight: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "0.5rem",
  },
  invoiceNumber: {
    fontSize: "1rem",
    fontWeight: "600",
    margin: "0 0 0.25rem 0",
    color: "#fff",
  },
  invoiceOrg: {
    fontSize: "0.85rem",
    color: "#a3a3a3",
    margin: "0 0 0.25rem 0",
  },
  invoicePeriod: {
    fontSize: "0.85rem",
    color: "#737373",
    margin: 0,
  },
  invoiceAmount: {
    fontSize: "1.1rem",
    fontWeight: "600",
    color: "#fff",
    margin: 0,
  },
  invoiceDetails: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    marginBottom: "0.75rem",
    paddingTop: "0.75rem",
    borderTop: "1px solid #262626",
  },
  invoiceDetail: {
    fontSize: "0.85rem",
    color: "#a3a3a3",
    margin: 0,
  },
  invoiceActions: {
    display: "flex",
    gap: "0.5rem",
    flexWrap: "wrap",
  },
  invoiceActionButton: {
    padding: "0.5rem 1rem",
    background: "#262626",
    border: "none",
    borderRadius: "4px",
    color: "#fff",
    cursor: "pointer",
    fontSize: "0.85rem",
  },
  statsSection: {
    marginTop: "1rem",
    padding: "1rem",
    background: "rgba(59, 130, 246, 0.05)",
    borderRadius: "8px",
    border: "1px solid rgba(59, 130, 246, 0.2)",
  },
  statsTitle: {
    fontSize: "0.9rem",
    fontWeight: "600",
    margin: "0 0 0.75rem 0",
    color: "#60a5fa",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statsUpdated: {
    fontSize: "0.75rem",
    fontWeight: "normal",
    color: "#737373",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "0.75rem",
  },
  statItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "0.5rem",
    background: "rgba(59, 130, 246, 0.1)",
    borderRadius: "6px",
  },
  statValue: {
    fontSize: "1.25rem",
    fontWeight: "700",
    color: "#fff",
  },
  statLabel: {
    fontSize: "0.7rem",
    color: "#a3a3a3",
    marginTop: "0.25rem",
  },
  lastLogin: {
    fontSize: "0.8rem",
    color: "#737373",
    margin: "0.75rem 0 0 0",
    textAlign: "center",
  },
  noStatsSection: {
    marginTop: "1rem",
    padding: "1rem",
    background: "rgba(107, 114, 128, 0.1)",
    borderRadius: "8px",
    border: "1px dashed rgba(107, 114, 128, 0.3)",
  },
  noStatsText: {
    fontSize: "0.85rem",
    color: "#737373",
    margin: "0.75rem 0 0 0",
    textAlign: "center",
    textAlign: "center",
  },
};
