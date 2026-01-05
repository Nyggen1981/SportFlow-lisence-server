"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LICENSE_TYPES } from "@/lib/license-config";
import AdminLayout, { sharedStyles } from "../components/AdminLayout";

type Module = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isStandard: boolean;
  isActive: boolean;
  price: number | null;
};

export default function PricesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [modules, setModules] = useState<Module[]>([]);
  const [licenseTypePrices, setLicenseTypePrices] = useState<Record<string, { price: number; isOverride: boolean }>>({});
  const [editingPrice, setEditingPrice] = useState<{ type: "license" | "module"; id: string } | null>(null);
  const [priceInputValue, setPriceInputValue] = useState("");

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
          loadModules(storedPassword),
          loadLicenseTypePrices(storedPassword)
        ]);
      }
      setLoading(false);
    } catch {
      router.push("/admin/login");
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

  const updateLicenseTypePrice = async (licenseType: string, price: number) => {
    try {
      const response = await fetch(`/api/license-types/${licenseType}/price`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": password },
        body: JSON.stringify({ price })
      });
      if (response.ok) {
        await loadLicenseTypePrices(password);
        setEditingPrice(null);
        setSuccess("Pris oppdatert");
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch {
      setError("Kunne ikke oppdatere pris");
    }
  };

  const updateModulePrice = async (moduleId: string, price: number | null) => {
    try {
      const response = await fetch(`/api/modules/${moduleId}/price`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": password },
        body: JSON.stringify({ price })
      });
      if (response.ok) {
        await loadModules(password);
        setEditingPrice(null);
        setSuccess("Modulpris oppdatert");
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch {
      setError("Kunne ikke oppdatere pris");
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

  return (
    <AdminLayout>
      <header style={sharedStyles.pageHeader}>
        <div>
          <h1 style={sharedStyles.pageTitle}>Prisadministrasjon</h1>
          <p style={sharedStyles.pageSubtitle}>Administrer priser for lisensstyper og moduler</p>
        </div>
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

      {/* Pricing Content */}
      <div style={styles.content}>
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Lisenstyper</h2>
          <p style={styles.hint}>Klikk på en pris for å endre den.</p>
          <div style={styles.pricingList}>
            {Object.entries(LICENSE_TYPES).map(([key, val]) => {
              const currentPrice = licenseTypePrices[key]?.price ?? val.price;
              const isEditing = editingPrice?.type === "license" && editingPrice.id === key;
              
              return (
                <div key={key} style={styles.pricingListItem}>
                  <span style={styles.pricingItemName}>
                    {val.name}
                    {licenseTypePrices[key]?.isOverride && (
                      <span style={styles.overrideTag}>Tilpasset</span>
                    )}
                  </span>
                  {isEditing ? (
                    <div style={styles.priceEditRow}>
                      <input
                        type="number"
                        min="0"
                        value={priceInputValue}
                        onChange={e => setPriceInputValue(e.target.value)}
                        style={styles.priceInput}
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            updateLicenseTypePrice(key, parseInt(priceInputValue) || 0);
                          } else if (e.key === "Escape") {
                            setEditingPrice(null);
                          }
                        }}
                      />
                      <button 
                        style={styles.priceSaveBtn}
                        onClick={() => updateLicenseTypePrice(key, parseInt(priceInputValue) || 0)}
                      >
                        ✓
                      </button>
                      <button 
                        style={styles.priceCancelBtn}
                        onClick={() => setEditingPrice(null)}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button 
                      style={styles.priceButton}
                      onClick={() => {
                        setEditingPrice({ type: "license", id: key });
                        setPriceInputValue(String(currentPrice));
                      }}
                    >
                      {currentPrice} kr/mnd
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Tilleggsmoduler</h2>
          <p style={styles.hint}>Pilotkunder får disse gratis. Klikk på en pris for å endre den.</p>
          <div style={styles.pricingList}>
            {modules.filter(m => m.key !== "booking").map(m => {
              const isEditing = editingPrice?.type === "module" && editingPrice.id === m.id;
              
              return (
                <div key={m.id} style={styles.pricingListItem}>
                  <div>
                    <span style={styles.moduleName}>{m.name}</span>
                    {m.description && (
                      <p style={styles.moduleDesc}>{m.description}</p>
                    )}
                  </div>
                  {isEditing ? (
                    <div style={styles.priceEditRow}>
                      <input
                        type="number"
                        min="0"
                        value={priceInputValue}
                        onChange={e => setPriceInputValue(e.target.value)}
                        style={styles.priceInput}
                        autoFocus
                        placeholder="0 = gratis"
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            const val = parseInt(priceInputValue);
                            updateModulePrice(m.id, isNaN(val) || val === 0 ? null : val);
                          } else if (e.key === "Escape") {
                            setEditingPrice(null);
                          }
                        }}
                      />
                      <button 
                        style={styles.priceSaveBtn}
                        onClick={() => {
                          const val = parseInt(priceInputValue);
                          updateModulePrice(m.id, isNaN(val) || val === 0 ? null : val);
                        }}
                      >
                        ✓
                      </button>
                      <button 
                        style={styles.priceCancelBtn}
                        onClick={() => setEditingPrice(null)}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button 
                      style={styles.priceButton}
                      onClick={() => {
                        setEditingPrice({ type: "module", id: m.id });
                        setPriceInputValue(String(m.price || 0));
                      }}
                    >
                      {m.price ? `+${m.price} kr/mnd` : "Gratis"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  content: {
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem",
  },
  section: {
    background: "#111",
    borderRadius: "10px",
    border: "1px solid #222",
    padding: "1.25rem",
  },
  sectionTitle: {
    fontSize: "0.95rem",
    fontWeight: "600",
    margin: "0 0 0.4rem 0",
  },
  hint: {
    fontSize: "0.75rem",
    color: "#666",
    margin: "0 0 1rem 0",
  },
  pricingList: {
    background: "#0a0a0a",
    borderRadius: "6px",
    overflow: "hidden",
  },
  pricingListItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.65rem 0.85rem",
    borderBottom: "1px solid #222",
    fontSize: "0.85rem",
  },
  pricingItemName: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  overrideTag: {
    fontSize: "0.6rem",
    padding: "0.12rem 0.35rem",
    background: "rgba(245,158,11,0.2)",
    color: "#f59e0b",
    borderRadius: "4px",
  },
  moduleName: {
    fontWeight: "500",
  },
  moduleDesc: {
    fontSize: "0.75rem",
    color: "#666",
    margin: "0.2rem 0 0 0",
  },
  priceButton: {
    background: "transparent",
    border: "1px solid #333",
    borderRadius: "4px",
    padding: "0.3rem 0.6rem",
    color: "#22c55e",
    fontWeight: "500",
    cursor: "pointer",
    fontSize: "0.8rem",
  },
  priceEditRow: {
    display: "flex",
    gap: "0.25rem",
    alignItems: "center",
  },
  priceInput: {
    width: "70px",
    padding: "0.3rem 0.4rem",
    background: "#111",
    border: "1px solid #3b82f6",
    borderRadius: "4px",
    color: "#fff",
    fontSize: "0.8rem",
    textAlign: "right",
  },
  priceSaveBtn: {
    padding: "0.3rem 0.4rem",
    background: "#22c55e",
    border: "none",
    borderRadius: "4px",
    color: "#fff",
    cursor: "pointer",
    fontSize: "0.75rem",
  },
  priceCancelBtn: {
    padding: "0.3rem 0.4rem",
    background: "#333",
    border: "none",
    borderRadius: "4px",
    color: "#888",
    cursor: "pointer",
    fontSize: "0.75rem",
  },
};
