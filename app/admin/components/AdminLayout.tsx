"use client";

import { useRouter, usePathname } from "next/navigation";
import React from "react";

type AdminLayoutProps = {
  children: React.ReactNode;
  stats?: { label: string; value: string; color?: string }[];
};

export default function AdminLayout({ children, stats }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => {
    sessionStorage.removeItem("adminPassword");
    document.cookie = "admin-auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    router.push("/admin/login");
  };

  const navItems = [
    { path: "/admin", label: "Kunder" },
    { path: "/admin/invoices", label: "Fakturaer" },
    { path: "/admin/prices", label: "Priser" },
    { path: "/admin/settings", label: "Innstillinger" },
  ];

  return (
    <div style={styles.container}>
      <div style={styles.wrapper}>
        {/* Top Navigation */}
        <nav style={styles.topNav}>
          <div style={styles.topNavLeft}>
            <img src="/sportflow-logo-dark.png" alt="SportFlow" style={styles.logo} />
            <span style={styles.logoText}>Admin</span>
          </div>
          <div style={styles.topNavCenter}>
            {navItems.map((item) => (
              <button
                key={item.path}
                style={pathname === item.path ? styles.navItemActive : styles.navItem}
                onClick={() => router.push(item.path)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div style={styles.topNavRight}>
            {stats && stats.map((stat, i) => (
              <span key={i} style={styles.statPill}>
                <span style={{ color: stat.color || "#fff", fontWeight: 600 }}>{stat.value}</span>
                {" "}{stat.label}
              </span>
            ))}
            <button style={styles.logoutBtn} onClick={handleLogout}>
              Logg ut
            </button>
          </div>
        </nav>

        {/* Page Content */}
        <main style={styles.main}>
          {children}
        </main>
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: "100vh",
    background: "#0a0a0a",
    color: "#fff",
  },
  wrapper: {
    maxWidth: "900px",
    margin: "0 auto",
    padding: "1rem 1.5rem",
  },
  topNav: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0.75rem 0",
    marginBottom: "1.5rem",
    borderBottom: "1px solid #222",
  },
  topNavLeft: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  topNavCenter: {
    display: "flex",
    gap: "0.25rem",
  },
  topNavRight: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
  },
  logo: {
    height: "22px",
    width: "auto",
  },
  logoText: {
    fontSize: "0.85rem",
    fontWeight: "600",
  },
  navItem: {
    padding: "0.5rem 0.75rem",
    background: "transparent",
    border: "none",
    borderRadius: "5px",
    color: "#888",
    fontSize: "0.8rem",
    cursor: "pointer",
  },
  navItemActive: {
    padding: "0.5rem 0.75rem",
    background: "rgba(59,130,246,0.15)",
    border: "none",
    borderRadius: "5px",
    color: "#3b82f6",
    fontSize: "0.8rem",
    cursor: "pointer",
    fontWeight: "500",
  },
  statPill: {
    fontSize: "0.75rem",
    color: "#888",
    padding: "0.4rem 0.75rem",
    background: "#111",
    borderRadius: "20px",
    border: "1px solid #222",
  },
  logoutBtn: {
    padding: "0.4rem 0.6rem",
    background: "transparent",
    border: "1px solid #333",
    borderRadius: "5px",
    color: "#666",
    cursor: "pointer",
    fontSize: "0.7rem",
  },
  main: {
    minHeight: "calc(100vh - 100px)",
  },
};

// Shared styles that pages can import
export const sharedStyles: { [key: string]: React.CSSProperties } = {
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
  pageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1.5rem",
  },
  pageTitle: {
    fontSize: "1.25rem",
    fontWeight: "700",
    margin: 0,
  },
  pageSubtitle: {
    fontSize: "0.8rem",
    color: "#666",
    margin: "0.25rem 0 0 0",
  },
  errorMsg: {
    display: "flex",
    justifyContent: "space-between",
    padding: "0.6rem 0.75rem",
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: "6px",
    color: "#f87171",
    marginBottom: "1rem",
    fontSize: "0.8rem",
  },
  successMsg: {
    padding: "0.6rem 0.75rem",
    background: "rgba(34,197,94,0.1)",
    border: "1px solid rgba(34,197,94,0.3)",
    borderRadius: "6px",
    color: "#4ade80",
    marginBottom: "1rem",
    fontSize: "0.8rem",
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "inherit",
    cursor: "pointer",
    fontSize: "1rem",
  },
  primaryBtn: {
    padding: "0.5rem 1rem",
    background: "#3b82f6",
    border: "none",
    borderRadius: "6px",
    color: "#fff",
    fontSize: "0.8rem",
    fontWeight: "500",
    cursor: "pointer",
  },
  secondaryBtn: {
    padding: "0.5rem 1rem",
    background: "transparent",
    border: "1px solid #333",
    borderRadius: "6px",
    color: "#888",
    fontSize: "0.8rem",
    cursor: "pointer",
  },
  card: {
    background: "#111",
    borderRadius: "10px",
    border: "1px solid #222",
    padding: "1.25rem",
    marginBottom: "1rem",
  },
  cardTitle: {
    fontSize: "0.9rem",
    fontWeight: "600",
    margin: "0 0 1rem 0",
  },
  formGroup: {
    marginBottom: "1rem",
  },
  label: {
    display: "block",
    fontSize: "0.75rem",
    color: "#888",
    marginBottom: "0.4rem",
  },
  input: {
    width: "100%",
    padding: "0.6rem 0.75rem",
    background: "#0a0a0a",
    border: "1px solid #333",
    borderRadius: "6px",
    color: "#fff",
    fontSize: "0.85rem",
  },
  select: {
    width: "100%",
    padding: "0.6rem 0.75rem",
    background: "#0a0a0a",
    border: "1px solid #333",
    borderRadius: "6px",
    color: "#fff",
    fontSize: "0.85rem",
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "1rem",
  },
  grid3: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "1rem",
  },
};

