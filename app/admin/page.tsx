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

type NewOrgForm = {
  name: string;
  slug: string;
  contactEmail: string;
  contactName: string;
  licenseType: string;
  expiresInDays: number;
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
  const [newOrg, setNewOrg] = useState<NewOrgForm>({
    name: "",
    slug: "",
    contactEmail: "",
    contactName: "",
    licenseType: "trial",
    expiresInDays: 30
  });
  const [creating, setCreating] = useState(false);

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
      } else {
        setError("Kunne ikke laste organisasjoner");
      }
    } catch (err) {
      setError("Nettverksfeil ved lasting av data");
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
      const expiresAt = new Date(Date.now() + newOrg.expiresInDays * 24 * 60 * 60 * 1000);
      
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
          licenseType: newOrg.licenseType,
          expiresAt: expiresAt.toISOString()
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`Organisasjon "${newOrg.name}" opprettet! Lisensnøkkel: ${data.licenseKey}`);
        setNewOrg({
          name: "",
          slug: "",
          contactEmail: "",
          contactName: "",
          licenseType: "trial",
          expiresInDays: 30
        });
        setShowAddForm(false);
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

  const toggleActive = async (org: Organization) => {
    try {
      const response = await fetch("/api/license/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": password
        },
        body: JSON.stringify({
          slug: org.slug,
          isActive: !org.isActive
        })
      });

      if (response.ok) {
        await loadOrganizations(password);
      }
    } catch (err) {
      setError("Kunne ikke oppdatere status");
    }
  };

  const getStatusInfo = (org: Organization) => {
    if (org.isSuspended) return { text: "Suspendert", color: "#ef4444", bg: "rgba(239, 68, 68, 0.1)" };
    if (!org.isActive) return { text: "Inaktiv", color: "#6b7280", bg: "rgba(107, 114, 128, 0.1)" };
    
    const now = new Date();
    const expires = new Date(org.expiresAt);
    const daysLeft = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysLeft < 0) return { text: "Utløpt", color: "#ef4444", bg: "rgba(239, 68, 68, 0.1)" };
    if (daysLeft <= 7) return { text: `${daysLeft}d`, color: "#f59e0b", bg: "rgba(245, 158, 11, 0.1)" };
    if (daysLeft <= 30) return { text: `${daysLeft}d`, color: "#eab308", bg: "rgba(234, 179, 8, 0.1)" };
    return { text: "Aktiv", color: "#22c55e", bg: "rgba(34, 197, 94, 0.1)" };
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
        <div style={styles.spinner}></div>
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
                />
              </div>
              
              <div style={styles.formGroup}>
                <label style={styles.label}>Slug (URL-vennlig)</label>
                <input
                  type="text"
                  value={newOrg.slug}
                  onChange={e => setNewOrg({...newOrg, slug: e.target.value})}
                  placeholder="haugesund-il"
                  required
                  style={styles.input}
                />
              </div>

              <div style={styles.formRow}>
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
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Lisenstype</label>
                  <select
                    value={newOrg.licenseType}
                    onChange={e => setNewOrg({...newOrg, licenseType: e.target.value})}
                    style={styles.select}
                  >
                    <option value="free">Free (10 brukere)</option>
                    <option value="trial">Trial (25 brukere, 30 dager)</option>
                    <option value="standard">Standard (50 brukere)</option>
                    <option value="premium">Premium (ubegrenset)</option>
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Utløper om (dager)</label>
                  <input
                    type="number"
                    value={newOrg.expiresInDays}
                    onChange={e => setNewOrg({...newOrg, expiresInDays: parseInt(e.target.value) || 30})}
                    min="1"
                    style={styles.input}
                  />
                </div>
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
                  {creating ? "Oppretter..." : "Opprett og generer nøkkel"}
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
            const status = getStatusInfo(org);
            return (
              <div key={org.id} style={styles.orgCard}>
                <div style={styles.orgHeader}>
                  <div>
                    <h3 style={styles.orgName}>{org.name}</h3>
                    <p style={styles.orgSlug}>{org.slug}</p>
                  </div>
                  <div style={styles.orgBadges}>
                    <span style={{
                      ...styles.badge,
                      background: org.licenseType === "premium" ? "#8b5cf6" :
                                  org.licenseType === "standard" ? "#3b82f6" :
                                  org.licenseType === "trial" ? "#f59e0b" : "#6b7280",
                    }}>
                      {org.licenseType}
                    </span>
                    <span style={{
                      ...styles.statusBadge,
                      background: status.bg,
                      color: status.color,
                      borderColor: status.color
                    }}>
                      {status.text}
                    </span>
                  </div>
                </div>

                <div style={styles.keySection}>
                  <label style={styles.keyLabel}>Lisensnøkkel</label>
                  <div style={styles.keyRow}>
                    <code style={styles.keyCode}>{org.licenseKey}</code>
                    <button
                      onClick={() => copyToClipboard(org.licenseKey)}
                      style={styles.copyButton}
                    >
                      {copiedKey === org.licenseKey ? "✓ Kopiert!" : "Kopier"}
                    </button>
                  </div>
                </div>

                <div style={styles.orgDetails}>
                  <div style={styles.detailItem}>
                    <span style={styles.detailLabel}>Kontakt</span>
                    <span>{org.contactEmail}</span>
                  </div>
                  <div style={styles.detailItem}>
                    <span style={styles.detailLabel}>Utløper</span>
                    <span>{formatDate(org.expiresAt)}</span>
                  </div>
                  <div style={styles.detailItem}>
                    <span style={styles.detailLabel}>Brukere</span>
                    <span>{org.totalUsers}</span>
                  </div>
                  <div style={styles.detailItem}>
                    <span style={styles.detailLabel}>Bookinger</span>
                    <span>{org.totalBookings}</span>
                  </div>
                </div>

                <div style={styles.orgActions}>
                  <button
                    onClick={() => toggleActive(org)}
                    style={{
                      ...styles.actionButton,
                      background: org.isActive ? "rgba(239, 68, 68, 0.1)" : "rgba(34, 197, 94, 0.1)",
                      color: org.isActive ? "#ef4444" : "#22c55e"
                    }}
                  >
                    {org.isActive ? "Deaktiver" : "Aktiver"}
                  </button>
                </div>
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
  },
  loading: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "#0a0a0a",
    color: "#fff",
    gap: "1rem",
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "3px solid #333",
    borderTopColor: "#3b82f6",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
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
    maxWidth: "500px",
  },
  modalTitle: {
    fontSize: "1.25rem",
    fontWeight: "600",
    marginBottom: "1.5rem",
  },
  formGroup: {
    marginBottom: "1rem",
    flex: 1,
  },
  formRow: {
    display: "flex",
    gap: "1rem",
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
  select: {
    width: "100%",
    padding: "0.75rem",
    background: "#0a0a0a",
    border: "1px solid #333",
    borderRadius: "6px",
    color: "#fff",
    fontSize: "0.95rem",
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
    flex: 2,
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
  orgBadges: {
    display: "flex",
    gap: "0.5rem",
  },
  badge: {
    padding: "0.25rem 0.6rem",
    borderRadius: "4px",
    fontSize: "0.75rem",
    fontWeight: "500",
    color: "#fff",
    textTransform: "capitalize",
  },
  statusBadge: {
    padding: "0.25rem 0.6rem",
    borderRadius: "4px",
    fontSize: "0.75rem",
    fontWeight: "500",
    border: "1px solid",
  },
  keySection: {
    background: "#0a0a0a",
    borderRadius: "8px",
    padding: "0.75rem 1rem",
    marginBottom: "1rem",
  },
  keyLabel: {
    fontSize: "0.75rem",
    color: "#737373",
    display: "block",
    marginBottom: "0.5rem",
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
  orgDetails: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "1rem",
    marginBottom: "1rem",
    paddingBottom: "1rem",
    borderBottom: "1px solid #1f1f1f",
  },
  detailItem: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
  },
  detailLabel: {
    fontSize: "0.75rem",
    color: "#737373",
  },
  orgActions: {
    display: "flex",
    gap: "0.5rem",
  },
  actionButton: {
    padding: "0.5rem 1rem",
    background: "rgba(239, 68, 68, 0.1)",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "0.85rem",
    fontWeight: "500",
  },
};
