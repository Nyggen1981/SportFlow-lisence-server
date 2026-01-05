"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminLayout, { sharedStyles } from "../components/AdminLayout";

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
  emailSubject: string | null;
  emailGreeting: string | null;
  emailBody: string | null;
  emailFooter: string | null;
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
      <div style={sharedStyles.loadingScreen}>
        <div style={sharedStyles.loadingSpinner} />
        <p>Laster...</p>
      </div>
    );
  }

  if (!companySettings) {
    return (
      <AdminLayout>
        <p>Kunne ikke laste innstillinger</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <header style={sharedStyles.pageHeader}>
        <div>
          <h1 style={sharedStyles.pageTitle}>Innstillinger</h1>
          <p style={sharedStyles.pageSubtitle}>Administrer bedriftsinformasjon og faktura-innstillinger</p>
        </div>
        {!editingSettings && (
          <button onClick={() => setEditingSettings(true)} style={styles.editButton}>
            Rediger
          </button>
        )}
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

      {/* Settings Content */}
      <div style={styles.content}>
        {editingSettings ? (
          <div style={styles.settingsForm}>
            <div style={styles.settingsSection}>
              <h3 style={styles.settingsSectionTitle}>Bedrift</h3>
              <div style={styles.settingsGrid}>
                <div style={sharedStyles.formGroup}>
                  <label style={sharedStyles.label}>Bedriftsnavn *</label>
                  <input
                    type="text"
                    value={settingsForm.companyName || ""}
                    onChange={(e) => setSettingsForm({ ...settingsForm, companyName: e.target.value })}
                    style={sharedStyles.input}
                  />
                </div>
                <div style={sharedStyles.formGroup}>
                  <label style={sharedStyles.label}>Org.nummer</label>
                  <input
                    type="text"
                    value={settingsForm.orgNumber || ""}
                    onChange={(e) => setSettingsForm({ ...settingsForm, orgNumber: e.target.value })}
                    style={sharedStyles.input}
                    placeholder="999 888 777"
                  />
                </div>
                <div style={sharedStyles.formGroup}>
                  <label style={sharedStyles.label}>MVA-nummer</label>
                  <input
                    type="text"
                    value={settingsForm.vatNumber || ""}
                    onChange={(e) => setSettingsForm({ ...settingsForm, vatNumber: e.target.value })}
                    style={sharedStyles.input}
                  />
                </div>
              </div>
            </div>

            <div style={styles.settingsSection}>
              <h3 style={styles.settingsSectionTitle}>Kontakt</h3>
              <div style={styles.settingsGrid}>
                <div style={sharedStyles.formGroup}>
                  <label style={sharedStyles.label}>E-post</label>
                  <input
                    type="email"
                    value={settingsForm.email || ""}
                    onChange={(e) => setSettingsForm({ ...settingsForm, email: e.target.value })}
                    style={sharedStyles.input}
                  />
                </div>
                <div style={sharedStyles.formGroup}>
                  <label style={sharedStyles.label}>Telefon</label>
                  <input
                    type="text"
                    value={settingsForm.phone || ""}
                    onChange={(e) => setSettingsForm({ ...settingsForm, phone: e.target.value })}
                    style={sharedStyles.input}
                  />
                </div>
                <div style={sharedStyles.formGroup}>
                  <label style={sharedStyles.label}>Nettside</label>
                  <input
                    type="text"
                    value={settingsForm.website || ""}
                    onChange={(e) => setSettingsForm({ ...settingsForm, website: e.target.value })}
                    style={sharedStyles.input}
                  />
                </div>
              </div>
            </div>

            <div style={styles.settingsSection}>
              <h3 style={styles.settingsSectionTitle}>Adresse</h3>
              <div style={styles.settingsGrid}>
                <div style={{ ...sharedStyles.formGroup, gridColumn: "span 2" }}>
                  <label style={sharedStyles.label}>Adresse</label>
                  <input
                    type="text"
                    value={settingsForm.address || ""}
                    onChange={(e) => setSettingsForm({ ...settingsForm, address: e.target.value })}
                    style={sharedStyles.input}
                  />
                </div>
                <div style={sharedStyles.formGroup}>
                  <label style={sharedStyles.label}>Postnummer</label>
                  <input
                    type="text"
                    value={settingsForm.postalCode || ""}
                    onChange={(e) => setSettingsForm({ ...settingsForm, postalCode: e.target.value })}
                    style={sharedStyles.input}
                  />
                </div>
                <div style={sharedStyles.formGroup}>
                  <label style={sharedStyles.label}>By</label>
                  <input
                    type="text"
                    value={settingsForm.city || ""}
                    onChange={(e) => setSettingsForm({ ...settingsForm, city: e.target.value })}
                    style={sharedStyles.input}
                  />
                </div>
              </div>
            </div>

            <div style={styles.settingsSection}>
              <h3 style={styles.settingsSectionTitle}>Bank</h3>
              <div style={styles.settingsGrid}>
                <div style={sharedStyles.formGroup}>
                  <label style={sharedStyles.label}>Kontonummer</label>
                  <input
                    type="text"
                    value={settingsForm.bankAccount || ""}
                    onChange={(e) => setSettingsForm({ ...settingsForm, bankAccount: e.target.value })}
                    style={sharedStyles.input}
                    placeholder="1234 56 78901"
                  />
                </div>
                <div style={sharedStyles.formGroup}>
                  <label style={sharedStyles.label}>Bank</label>
                  <input
                    type="text"
                    value={settingsForm.bankName || ""}
                    onChange={(e) => setSettingsForm({ ...settingsForm, bankName: e.target.value })}
                    style={sharedStyles.input}
                  />
                </div>
              </div>
            </div>

            <div style={styles.settingsSection}>
              <h3 style={styles.settingsSectionTitle}>Faktura-innstillinger</h3>
              <div style={styles.settingsGrid}>
                <div style={sharedStyles.formGroup}>
                  <label style={sharedStyles.label}>Faktura-prefix</label>
                  <input
                    type="text"
                    value={settingsForm.invoicePrefix || ""}
                    onChange={(e) => setSettingsForm({ ...settingsForm, invoicePrefix: e.target.value })}
                    style={sharedStyles.input}
                  />
                </div>
                <div style={sharedStyles.formGroup}>
                  <label style={sharedStyles.label}>Standard forfallsdager</label>
                  <input
                    type="number"
                    value={settingsForm.defaultDueDays || 14}
                    onChange={(e) => setSettingsForm({ ...settingsForm, defaultDueDays: parseInt(e.target.value) })}
                    style={sharedStyles.input}
                  />
                </div>
                <div style={sharedStyles.formGroup}>
                  <label style={sharedStyles.label}>MVA-sats (%)</label>
                  <input
                    type="number"
                    value={settingsForm.vatRate || 0}
                    onChange={(e) => setSettingsForm({ ...settingsForm, vatRate: parseInt(e.target.value) })}
                    style={sharedStyles.input}
                  />
                </div>
              </div>
              <div style={sharedStyles.formGroup}>
                <label style={sharedStyles.label}>Logo</label>
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
              <div style={sharedStyles.formGroup}>
                <label style={sharedStyles.label}>Notat på fakturaer</label>
                <textarea
                  value={settingsForm.invoiceNote || ""}
                  onChange={(e) => setSettingsForm({ ...settingsForm, invoiceNote: e.target.value })}
                  style={styles.textarea}
                  rows={3}
                />
              </div>
              <div style={sharedStyles.formGroup}>
                <label style={sharedStyles.label}>Betalingsbetingelser</label>
                <textarea
                  value={settingsForm.paymentTerms || ""}
                  onChange={(e) => setSettingsForm({ ...settingsForm, paymentTerms: e.target.value })}
                  style={styles.textarea}
                  rows={2}
                />
              </div>
            </div>

            <div style={styles.settingsSection}>
              <h3 style={styles.settingsSectionTitle}>E-post mal for fakturaer</h3>
              <p style={styles.templateHint}>
                Bruk <code>{"{customerName}"}</code> for kundenavn, <code>{"{invoiceNumber}"}</code> for fakturanummer,
                <code>{"{amount}"}</code> for beløp, <code>{"{dueDate}"}</code> for forfallsdato,
                <code>{"{period}"}</code> for periode.
              </p>
              <div style={sharedStyles.formGroup}>
                <label style={sharedStyles.label}>E-post emne</label>
                <input
                  type="text"
                  value={settingsForm.emailSubject || ""}
                  onChange={(e) => setSettingsForm({ ...settingsForm, emailSubject: e.target.value })}
                  style={sharedStyles.input}
                  placeholder="Faktura {invoiceNumber} - SportFlow"
                />
              </div>
              <div style={sharedStyles.formGroup}>
                <label style={sharedStyles.label}>Hilsen</label>
                <input
                  type="text"
                  value={settingsForm.emailGreeting || ""}
                  onChange={(e) => setSettingsForm({ ...settingsForm, emailGreeting: e.target.value })}
                  style={sharedStyles.input}
                  placeholder="Hei {customerName},"
                />
              </div>
              <div style={sharedStyles.formGroup}>
                <label style={sharedStyles.label}>Hovedtekst</label>
                <textarea
                  value={settingsForm.emailBody || ""}
                  onChange={(e) => setSettingsForm({ ...settingsForm, emailBody: e.target.value })}
                  style={styles.textarea}
                  rows={4}
                  placeholder="Vedlagt finner du faktura for SportFlow-abonnementet ditt for {period}.

Faktura er vedlagt som PDF. Vennligst betal innen forfallsdato {dueDate}."
                />
              </div>
              <div style={sharedStyles.formGroup}>
                <label style={sharedStyles.label}>Signatur/Footer</label>
                <textarea
                  value={settingsForm.emailFooter || ""}
                  onChange={(e) => setSettingsForm({ ...settingsForm, emailFooter: e.target.value })}
                  style={styles.textarea}
                  rows={2}
                  placeholder="Med vennlig hilsen,
SportFlow"
                />
              </div>
            </div>

            <div style={styles.formActions}>
              <button onClick={saveCompanySettings} style={sharedStyles.primaryBtn}>
                Lagre innstillinger
              </button>
              <button
                onClick={() => {
                  setEditingSettings(false);
                  setSettingsForm(companySettings);
                }}
                style={sharedStyles.secondaryBtn}
              >
                Avbryt
              </button>
            </div>
          </div>
        ) : (
          <div style={styles.settingsView}>
            <div style={sharedStyles.card}>
              <h4 style={sharedStyles.cardTitle}>Bedriftsinformasjon</h4>
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

            <div style={sharedStyles.card}>
              <h4 style={sharedStyles.cardTitle}>Adresse</h4>
              <p style={styles.infoValue}>
                {companySettings.address || "-"}<br />
                {companySettings.postalCode} {companySettings.city}<br />
                {companySettings.country}
              </p>
            </div>

            <div style={sharedStyles.card}>
              <h4 style={sharedStyles.cardTitle}>Bankinformasjon</h4>
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

            <div style={sharedStyles.card}>
              <h4 style={sharedStyles.cardTitle}>Faktura-innstillinger</h4>
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

            <div style={{ ...sharedStyles.card, gridColumn: "span 2" }}>
              <h4 style={sharedStyles.cardTitle}>E-post mal</h4>
              <div style={styles.emailTemplatePreview}>
                <div>
                  <p style={styles.infoLabel}>Emne</p>
                  <p style={styles.infoValue}>{companySettings.emailSubject || "Faktura {invoiceNumber} - SportFlow"}</p>
                </div>
                <div>
                  <p style={styles.infoLabel}>Hilsen</p>
                  <p style={styles.infoValue}>{companySettings.emailGreeting || "Hei {customerName},"}</p>
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <p style={styles.infoLabel}>Hovedtekst</p>
                  <p style={styles.infoValue}>{companySettings.emailBody || "Vedlagt finner du faktura for SportFlow-abonnementet ditt."}</p>
                </div>
                <div style={{ gridColumn: "span 2" }}>
                  <p style={styles.infoLabel}>Signatur</p>
                  <p style={styles.infoValue}>{companySettings.emailFooter || "Med vennlig hilsen, SportFlow"}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  editButton: {
    padding: "0.5rem 1rem",
    background: "#262626",
    border: "none",
    borderRadius: "6px",
    color: "#fff",
    cursor: "pointer",
    fontSize: "0.8rem",
  },
  content: {
    background: "#111",
    borderRadius: "10px",
    border: "1px solid #222",
    padding: "1.25rem",
  },
  settingsForm: {
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
  },
  settingsSection: {
    background: "#0a0a0a",
    borderRadius: "8px",
    padding: "1.25rem",
    border: "1px solid #222",
  },
  settingsSectionTitle: {
    fontSize: "0.9rem",
    fontWeight: "600",
    margin: "0 0 1rem 0",
    color: "#a3a3a3",
  },
  settingsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "0.85rem",
  },
  textarea: {
    padding: "0.6rem 0.75rem",
    background: "#0a0a0a",
    border: "1px solid #333",
    borderRadius: "6px",
    color: "#fff",
    fontSize: "0.85rem",
    resize: "vertical",
    width: "100%",
  },
  logoUploadSection: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  logoPreview: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    padding: "0.75rem",
    background: "#262626",
    borderRadius: "6px",
  },
  logoImage: {
    maxWidth: "120px",
    maxHeight: "50px",
    objectFit: "contain",
  },
  deleteLogoButton: {
    padding: "0.4rem 0.75rem",
    background: "#ef4444",
    border: "none",
    borderRadius: "5px",
    color: "#fff",
    cursor: "pointer",
    fontSize: "0.75rem",
  },
  uploadArea: {
    display: "flex",
    flexDirection: "column",
    gap: "0.4rem",
  },
  fileInput: {
    display: "none",
  },
  uploadLabel: {
    display: "inline-block",
    padding: "0.6rem 1rem",
    background: "#262626",
    border: "1px dashed #404040",
    borderRadius: "6px",
    color: "#a3a3a3",
    cursor: "pointer",
    textAlign: "center",
    fontSize: "0.8rem",
  },
  uploadHint: {
    fontSize: "0.7rem",
    color: "#737373",
    margin: 0,
  },
  formActions: {
    display: "flex",
    gap: "0.75rem",
    marginTop: "0.5rem",
  },
  settingsView: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "0.85rem",
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "0.85rem",
  },
  infoLabel: {
    fontSize: "0.7rem",
    color: "#737373",
    margin: "0 0 0.2rem 0",
  },
  infoValue: {
    fontSize: "0.85rem",
    margin: 0,
    color: "#fff",
    whiteSpace: "pre-wrap",
  },
  templateHint: {
    fontSize: "0.75rem",
    color: "#737373",
    marginBottom: "1rem",
    padding: "0.75rem",
    background: "#1a1a1a",
    borderRadius: "6px",
    lineHeight: 1.6,
  },
  emailTemplatePreview: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "0.85rem",
  },
};
