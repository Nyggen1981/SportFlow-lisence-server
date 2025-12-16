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
  validationCount: number;
};

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/admin/check");
        const data = await response.json();
        
        if (!data.authenticated) {
          router.push("/admin/login");
          return;
        }
        
        // Hent passord fra sessionStorage for API-kall
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
        headers: {
          "x-admin-secret": adminPassword
        }
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

  const getStatusBadge = (org: Organization) => {
    if (org.isSuspended) {
      return { text: "Suspendert", color: "#f87171", bg: "rgba(248, 113, 113, 0.1)" };
    }
    if (!org.isActive) {
      return { text: "Inaktiv", color: "#94a3b8", bg: "rgba(148, 163, 184, 0.1)" };
    }
    const now = new Date();
    const expiresAt = new Date(org.expiresAt);
    if (expiresAt < now) {
      return { text: "Utløpt", color: "#f87171", bg: "rgba(248, 113, 113, 0.1)" };
    }
    const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 30) {
      return { text: `${daysLeft}d igjen`, color: "#fbbf24", bg: "rgba(251, 191, 36, 0.1)" };
    }
    return { text: "Aktiv", color: "#4ade80", bg: "rgba(74, 222, 128, 0.1)" };
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("nb-NO", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "Aldri";
    return new Date(dateString).toLocaleString("nb-NO", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <p>Laster...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Arena License Admin</h1>
          <p style={styles.subtitle}>{organizations.length} organisasjoner registrert</p>
        </div>
        <button onClick={handleLogout} style={styles.logoutButton}>
          Logg ut
        </button>
      </header>

      {error && (
        <div style={styles.errorBox}>
          {error}
        </div>
      )}

      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Organisasjon</th>
              <th style={styles.th}>Lisenstype</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Utløper</th>
              <th style={styles.th}>Siste aktivitet</th>
              <th style={styles.th}>Brukere</th>
              <th style={styles.th}>Bookinger</th>
            </tr>
          </thead>
          <tbody>
            {organizations.map((org) => {
              const status = getStatusBadge(org);
              return (
                <tr key={org.id} style={styles.tr}>
                  <td style={styles.td}>
                    <div>
                      <div style={styles.orgName}>{org.name}</div>
                      <div style={styles.orgSlug}>{org.slug}</div>
                    </div>
                  </td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.badge,
                      background: org.licenseType === "premium" ? "rgba(139, 92, 246, 0.2)" :
                                  org.licenseType === "standard" ? "rgba(59, 130, 246, 0.2)" :
                                  org.licenseType === "trial" ? "rgba(251, 191, 36, 0.2)" :
                                  "rgba(148, 163, 184, 0.2)",
                      color: org.licenseType === "premium" ? "#a78bfa" :
                             org.licenseType === "standard" ? "#60a5fa" :
                             org.licenseType === "trial" ? "#fbbf24" :
                             "#94a3b8"
                    }}>
                      {org.licenseType}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.badge,
                      background: status.bg,
                      color: status.color
                    }}>
                      {status.text}
                    </span>
                  </td>
                  <td style={styles.td}>{formatDate(org.expiresAt)}</td>
                  <td style={styles.td}>
                    <div style={styles.activityCell}>
                      <div>{formatDateTime(org.lastHeartbeat)}</div>
                      {org.appVersion && (
                        <div style={styles.version}>v{org.appVersion}</div>
                      )}
                    </div>
                  </td>
                  <td style={styles.tdCenter}>{org.totalUsers}</td>
                  <td style={styles.tdCenter}>{org.totalBookings}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {organizations.length === 0 && !error && (
          <div style={styles.emptyState}>
            <p>Ingen organisasjoner registrert ennå.</p>
            <p style={styles.emptyHint}>
              Bruk API-et eller kjør seed-scriptet for å legge til organisasjoner.
            </p>
          </div>
        )}
      </div>

      <div style={styles.apiInfo}>
        <h2 style={styles.apiTitle}>API Endepunkter</h2>
        <div style={styles.apiGrid}>
          <div style={styles.apiCard}>
            <code style={styles.apiMethod}>POST</code>
            <code style={styles.apiPath}>/api/license/create</code>
            <span style={styles.apiDesc}>Opprett ny organisasjon</span>
          </div>
          <div style={styles.apiCard}>
            <code style={styles.apiMethod}>POST</code>
            <code style={styles.apiPath}>/api/license/update</code>
            <span style={styles.apiDesc}>Oppdater organisasjon</span>
          </div>
          <div style={styles.apiCard}>
            <code style={styles.apiMethodGet}>GET</code>
            <code style={styles.apiPath}>/api/license/list</code>
            <span style={styles.apiDesc}>List alle organisasjoner</span>
          </div>
          <div style={styles.apiCard}>
            <code style={styles.apiMethodPublic}>POST</code>
            <code style={styles.apiPath}>/api/license/validate</code>
            <span style={styles.apiDesc}>Valider lisens (offentlig)</span>
          </div>
        </div>
        <p style={styles.apiNote}>
          <strong>Merk:</strong> Admin-endepunkter krever <code>x-admin-secret</code> header.
        </p>
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: "100vh",
    background: "#0a0a0a",
    color: "#fff",
    padding: "2rem",
  },
  loadingContainer: {
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
    marginBottom: "2rem",
    paddingBottom: "1rem",
    borderBottom: "1px solid #262626",
  },
  title: {
    fontSize: "1.75rem",
    fontWeight: "600",
    margin: 0,
  },
  subtitle: {
    color: "#a3a3a3",
    margin: "0.25rem 0 0 0",
    fontSize: "0.9rem",
  },
  logoutButton: {
    padding: "0.5rem 1rem",
    background: "#dc2626",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "0.9rem",
  },
  errorBox: {
    padding: "1rem",
    background: "rgba(220, 38, 38, 0.1)",
    border: "1px solid rgba(220, 38, 38, 0.3)",
    borderRadius: "8px",
    color: "#f87171",
    marginBottom: "1rem",
  },
  tableContainer: {
    background: "#141414",
    borderRadius: "12px",
    border: "1px solid #262626",
    overflow: "hidden",
    marginBottom: "2rem",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left" as const,
    padding: "1rem",
    background: "#1a1a1a",
    color: "#a3a3a3",
    fontSize: "0.8rem",
    fontWeight: "500",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    borderBottom: "1px solid #262626",
  },
  tr: {
    borderBottom: "1px solid #1f1f1f",
  },
  td: {
    padding: "1rem",
    verticalAlign: "middle" as const,
  },
  tdCenter: {
    padding: "1rem",
    textAlign: "center" as const,
    verticalAlign: "middle" as const,
  },
  orgName: {
    fontWeight: "500",
  },
  orgSlug: {
    fontSize: "0.8rem",
    color: "#737373",
  },
  badge: {
    display: "inline-block",
    padding: "0.25rem 0.5rem",
    borderRadius: "4px",
    fontSize: "0.75rem",
    fontWeight: "500",
    textTransform: "capitalize" as const,
  },
  activityCell: {
    fontSize: "0.9rem",
  },
  version: {
    fontSize: "0.75rem",
    color: "#737373",
  },
  emptyState: {
    padding: "3rem",
    textAlign: "center" as const,
    color: "#737373",
  },
  emptyHint: {
    fontSize: "0.9rem",
    marginTop: "0.5rem",
  },
  apiInfo: {
    background: "#141414",
    borderRadius: "12px",
    border: "1px solid #262626",
    padding: "1.5rem",
  },
  apiTitle: {
    fontSize: "1rem",
    fontWeight: "600",
    marginBottom: "1rem",
  },
  apiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "0.75rem",
  },
  apiCard: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "0.75rem",
    background: "#1a1a1a",
    borderRadius: "6px",
  },
  apiMethod: {
    background: "#0ea5e9",
    color: "#fff",
    padding: "0.25rem 0.5rem",
    borderRadius: "4px",
    fontSize: "0.7rem",
    fontWeight: "600",
  },
  apiMethodGet: {
    background: "#22c55e",
    color: "#fff",
    padding: "0.25rem 0.5rem",
    borderRadius: "4px",
    fontSize: "0.7rem",
    fontWeight: "600",
  },
  apiMethodPublic: {
    background: "#8b5cf6",
    color: "#fff",
    padding: "0.25rem 0.5rem",
    borderRadius: "4px",
    fontSize: "0.7rem",
    fontWeight: "600",
  },
  apiPath: {
    color: "#60a5fa",
    fontSize: "0.85rem",
  },
  apiDesc: {
    color: "#737373",
    fontSize: "0.8rem",
  },
  apiNote: {
    marginTop: "1rem",
    fontSize: "0.85rem",
    color: "#a3a3a3",
  },
};
