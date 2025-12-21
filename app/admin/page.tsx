"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
  isActive: boolean;
  isSuspended: boolean;
  lastHeartbeat: string | null;
  appVersion: string | null;
  totalUsers: number;
  totalBookings: number;
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
        <div>
          <h1 style={styles.title}>🎫 Lisensadmin</h1>
          <p style={styles.subtitle}>{organizations.length} organisasjoner</p>
        </div>
        <div style={styles.headerActions}>
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
                    <h3 style={styles.orgName}>{org.name}</h3>
                    <p style={styles.orgSlug}>{org.slug} • {org.contactEmail}</p>
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

                  {/* Modules Section */}
                  <div style={styles.modulesSection}>
                    <h4 style={styles.modulesTitle}>Moduler</h4>
                    <div style={styles.modulesList}>
                      {modules.map(module => {
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
                      {modules.length === 0 && (
                        <p style={styles.noModules}>Ingen moduler tilgjengelig</p>
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
                  )}
                </div>

                {/* Stats */}
                {org.lastHeartbeat && (
                  <div style={styles.statsRow}>
                    <span style={styles.stat}>👥 {org.totalUsers} brukere</span>
                    <span style={styles.stat}>📅 {org.totalBookings} bookinger</span>
                    <span style={styles.stat}>
                      🕐 Sist aktiv: {new Date(org.lastHeartbeat).toLocaleDateString("nb-NO")}
                    </span>
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
    margin: "0 0 0.75rem 0",
    color: "#a3a3a3",
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
  statsRow: {
    display: "flex",
    gap: "1rem",
    paddingTop: "0.75rem",
    borderTop: "1px solid #1f1f1f",
    flexWrap: "wrap",
  },
  stat: {
    fontSize: "0.8rem",
    color: "#525252",
  },
};
