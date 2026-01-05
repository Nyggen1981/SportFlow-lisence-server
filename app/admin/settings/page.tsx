"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [editingSettings, setEditingSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState<Partial<CompanySettings>>({});
  const [uploadingLogo, setUploadingLogo] = useState(false);

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
        await loadCompanySettings(storedPassword);
      }
      setLoading(false);
    } catch {
      router.push("/admin/login");
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

  if (loading) {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.loadingSpinner} />
        <p>Laster...</p>
      </div>
    );
  }

  if (!companySettings) {
    return (
      <div style={styles.container}>
        <p>Kunne ikke laste innstillinger</p>
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
          <button style={styles.navItem} onClick={() => router.push("/admin/invoices")}>
            <span>📄</span> Fakturaer
          </button>
          <button style={styles.navItem} onClick={() => router.push("/admin/prices")}>
            <span>💰</span> Priser
          </button>
          <button style={styles.navItemActive}>
            <span>⚙️</span> Innstillinger
          </button>
        </nav>

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
        <header style={styles.header}>
          <div>
            <h1 style={styles.pageTitle}>Innstillinger</h1>
            <p style={styles.pageSubtitle}>Administrer bedriftsinformasjon og faktura-innstillinger</p>
          </div>
          {!editingSettings && (
            <button onClick={() => setEditingSettings(true)} style={styles.editButton}>
              Rediger
            </button>
          )}
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

        {/* Settings Content */}
        <div style={styles.content}>
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
      </main>
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
  sidebar: {
    width: "240px",
    background: "#111",
    borderRight: "1px solid #222",
    display: "flex",
    flexDirection: "column",
    padding: "1.5rem 1rem",
  },
  sidebarHeader: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    marginBottom: "2rem",
    paddingBottom: "1.5rem",
    borderBottom: "1px solid #222",
  },
  logo: {
    height: "32px",
    width: "auto",
  },
  logoText: {
    fontSize: "1.1rem",
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
    padding: "0.75rem 1rem",
    background: "transparent",
    border: "none",
    borderRadius: "8px",
    color: "#888",
    fontSize: "0.9rem",
    cursor: "pointer",
    textAlign: "left",
  },
  navItemActive: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "0.75rem 1rem",
    background: "rgba(59,130,246,0.15)",
    border: "none",
    borderRadius: "8px",
    color: "#3b82f6",
    fontSize: "0.9rem",
    cursor: "pointer",
    textAlign: "left",
    fontWeight: "500",
  },
  logoutBtn: {
    padding: "0.75rem",
    background: "transparent",
    border: "1px solid #333",
    borderRadius: "8px",
    color: "#666",
    cursor: "pointer",
    fontSize: "0.85rem",
  },
  main: {
    flex: 1,
    padding: "2rem",
    overflowY: "auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "2rem",
  },
  pageTitle: {
    fontSize: "1.75rem",
    fontWeight: "700",
    margin: 0,
  },
  pageSubtitle: {
    fontSize: "0.9rem",
    color: "#666",
    margin: "0.25rem 0 0 0",
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
  errorMsg: {
    display: "flex",
    justifyContent: "space-between",
    padding: "1rem",
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: "8px",
    color: "#f87171",
    marginBottom: "1rem",
  },
  successMsg: {
    display: "flex",
    justifyContent: "space-between",
    padding: "1rem",
    background: "rgba(34,197,94,0.1)",
    border: "1px solid rgba(34,197,94,0.3)",
    borderRadius: "8px",
    color: "#4ade80",
    marginBottom: "1rem",
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "inherit",
    fontSize: "1.25rem",
    cursor: "pointer",
  },
  content: {
    background: "#111",
    borderRadius: "12px",
    border: "1px solid #222",
    padding: "1.5rem",
  },
  settingsForm: {
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem",
  },
  settingsSection: {
    background: "#0a0a0a",
    borderRadius: "8px",
    padding: "1.5rem",
    border: "1px solid #222",
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
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  label: {
    fontSize: "0.85rem",
    color: "#a3a3a3",
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
  formActions: {
    display: "flex",
    gap: "0.75rem",
    marginTop: "1rem",
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
  settingsView: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "1rem",
  },
  settingsCard: {
    background: "#0a0a0a",
    borderRadius: "8px",
    padding: "1.25rem",
    border: "1px solid #222",
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
};

