"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Lagre passord for API-kall (brukes av dashboard)
        sessionStorage.setItem("adminPassword", password);
        // Redirect to admin dashboard
        router.push("/admin");
        router.refresh();
      } else {
        setError(data.error || "Feil passord");
      }
    } catch (error: any) {
      setError("Nettverksfeil: " + error.message);
    } finally {
      setLoading(false);
    }
  };

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
      <form
        onSubmit={handleLogin}
        style={{
          padding: "2rem",
          borderRadius: "8px",
          background: "rgb(20, 20, 20)",
          border: "1px solid rgb(40, 40, 40)",
          minWidth: "300px",
        }}
      >
        <h1
          style={{
            marginBottom: "1.5rem",
            fontSize: "1.5rem",
            fontWeight: "600",
          }}
        >
          Arena License Admin
        </h1>

        <div style={{ marginBottom: "1rem" }}>
          <label
            htmlFor="password"
            style={{
              display: "block",
              marginBottom: "0.5rem",
              fontSize: "0.9rem",
              color: "rgb(200, 200, 200)",
            }}
          >
            Admin-passord
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            autoFocus
            style={{
              width: "100%",
              padding: "0.75rem",
              fontSize: "1rem",
              background: "rgb(10, 10, 10)",
              border: "1px solid rgb(40, 40, 40)",
              borderRadius: "4px",
              color: "rgb(255, 255, 255)",
              outline: "none",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "rgb(100, 100, 100)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "rgb(40, 40, 40)";
            }}
          />
        </div>

        {error && (
          <div
            style={{
              marginBottom: "1rem",
              padding: "0.75rem",
              background: "rgba(220, 38, 38, 0.1)",
              border: "1px solid rgba(220, 38, 38, 0.3)",
              borderRadius: "4px",
              color: "rgb(248, 113, 113)",
              fontSize: "0.9rem",
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !password}
          style={{
            width: "100%",
            padding: "0.75rem",
            fontSize: "1rem",
            fontWeight: "500",
            background: loading ? "rgb(60, 60, 60)" : "rgb(0, 112, 243)",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: loading || !password ? "not-allowed" : "pointer",
            transition: "background 0.2s",
          }}
          onMouseEnter={(e) => {
            if (!loading && password) {
              e.currentTarget.style.background = "rgb(0, 90, 200)";
            }
          }}
          onMouseLeave={(e) => {
            if (!loading && password) {
              e.currentTarget.style.background = "rgb(0, 112, 243)";
            }
          }}
        >
          {loading ? "Logger inn..." : "Logg inn"}
        </button>
      </form>
    </div>
  );
}
