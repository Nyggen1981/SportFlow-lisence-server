"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is authenticated
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/admin/check");
        const data = await response.json();
        
        if (!data.authenticated) {
          router.push("/admin/login");
          return;
        }
        setLoading(false);
      } catch (error) {
        console.error("Auth check failed:", error);
        router.push("/admin/login");
      }
    };

    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgb(5, 5, 5)",
          color: "rgb(255, 255, 255)",
        }}
      >
        <p>Laster...</p>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "rgb(5, 5, 5)",
        color: "rgb(255, 255, 255)",
        padding: "2rem",
      }}
    >
      <h1 style={{ marginBottom: "2rem", fontSize: "2rem" }}>
        Arena License Admin Dashboard
      </h1>

      <div style={{ maxWidth: "800px" }}>
        <p style={{ marginBottom: "2rem", color: "rgb(200, 200, 200)" }}>
          Velkommen til admin-dashboardet. Her kan du administrere lisenser.
        </p>

        <div
          style={{
            padding: "1.5rem",
            background: "rgb(20, 20, 20)",
            borderRadius: "8px",
            border: "1px solid rgb(40, 40, 40)",
            marginBottom: "1rem",
          }}
        >
          <h2 style={{ marginBottom: "1rem", fontSize: "1.25rem" }}>
            API Endepunkter
          </h2>
          <ul style={{ listStyle: "none", padding: 0 }}>
            <li style={{ marginBottom: "0.5rem" }}>
              <code style={{ color: "rgb(100, 200, 255)" }}>
                POST /api/license/create
              </code>
              <span style={{ color: "rgb(150, 150, 150)", marginLeft: "1rem" }}>
                - Opprett ny lisens
              </span>
            </li>
            <li style={{ marginBottom: "0.5rem" }}>
              <code style={{ color: "rgb(100, 200, 255)" }}>
                POST /api/license/update
              </code>
              <span style={{ color: "rgb(150, 150, 150)", marginLeft: "1rem" }}>
                - Oppdater eksisterende lisens
              </span>
            </li>
            <li style={{ marginBottom: "0.5rem" }}>
              <code style={{ color: "rgb(100, 200, 255)" }}>
                POST /api/license/validate
              </code>
              <span style={{ color: "rgb(150, 150, 150)", marginLeft: "1rem" }}>
                - Valider lisens
              </span>
            </li>
          </ul>
          <p
            style={{
              marginTop: "1rem",
              fontSize: "0.9rem",
              color: "rgb(150, 150, 150)",
            }}
          >
            <strong>Merk:</strong> Alle endepunkter krever{" "}
            <code>x-admin-secret</code> header med admin-passordet.
          </p>
        </div>

        <button
          onClick={() => {
            document.cookie = "admin-auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            router.push("/admin/login");
          }}
          style={{
            padding: "0.75rem 1.5rem",
            background: "rgb(220, 38, 38)",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "1rem",
          }}
        >
          Logg ut
        </button>
      </div>
    </div>
  );
}

