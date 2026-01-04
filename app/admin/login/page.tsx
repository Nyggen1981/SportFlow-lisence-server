"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type LoginStep = "password" | "2fa-code" | "2fa-setup";

export default function AdminLoginPage() {
  const [step, setStep] = useState<LoginStep>("password");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const router = useRouter();

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (data.needs2FA) {
        // 2FA er aktivert - be om kode
        setStep("2fa-code");
      } else if (data.needsSetup) {
        // 2FA må settes opp - hent QR-kode
        const setupResponse = await fetch("/api/admin/2fa/setup");
        const setupData = await setupResponse.json();
        
        if (setupResponse.ok) {
          setQrCode(setupData.qrCode);
          setSecret(setupData.secret);
          setStep("2fa-setup");
        } else {
          setError(setupData.error || "Kunne ikke starte 2FA-oppsett");
        }
      } else if (response.ok && data.success) {
        // Direkte innlogging (skal ikke skje med 2FA påkrevd)
        sessionStorage.setItem("adminPassword", password);
        router.push("/admin");
        router.refresh();
      } else {
        setError(data.error || "Feil passord");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Ukjent feil";
      setError("Nettverksfeil: " + message);
    } finally {
      setLoading(false);
    }
  };

  const handleTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const endpoint = step === "2fa-setup" 
      ? "/api/admin/2fa/verify" 
      : "/api/admin/2fa/validate";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: totpCode }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        sessionStorage.setItem("adminPassword", password);
        router.push("/admin");
        router.refresh();
      } else {
        setError(data.error || "Feil kode");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Ukjent feil";
      setError("Nettverksfeil: " + message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "0.75rem",
    fontSize: "1rem",
    background: "rgb(10, 10, 10)",
    border: "1px solid rgb(40, 40, 40)",
    borderRadius: "4px",
    color: "rgb(255, 255, 255)",
    outline: "none",
  };

  const buttonStyle = (disabled: boolean) => ({
    width: "100%",
    padding: "0.75rem",
    fontSize: "1rem",
    fontWeight: "500" as const,
    background: disabled ? "rgb(60, 60, 60)" : "rgb(0, 112, 243)",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "background 0.2s",
  });

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
      <div
        style={{
          padding: "2rem",
          borderRadius: "8px",
          background: "rgb(20, 20, 20)",
          border: "1px solid rgb(40, 40, 40)",
          minWidth: "360px",
          maxWidth: "400px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <img 
            src="/sportflow-logo.png" 
            alt="SportFlow" 
            style={{ height: "45px", marginBottom: "1rem" }}
          />
          <h1
            style={{
              marginBottom: "0.5rem",
              fontSize: "1.25rem",
              fontWeight: "600",
            }}
          >
            Lisensadmin
          </h1>
        </div>

        {/* Steg-indikator */}
        <div style={{ 
          marginBottom: "1.5rem", 
          fontSize: "0.85rem", 
          color: "rgb(150, 150, 150)",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}>
          <span style={{ 
            color: step === "password" ? "rgb(0, 200, 100)" : "rgb(100, 100, 100)",
            fontWeight: step === "password" ? "600" : "400",
          }}>
            1. Passord
          </span>
          <span style={{ color: "rgb(60, 60, 60)" }}>→</span>
          <span style={{ 
            color: step !== "password" ? "rgb(0, 200, 100)" : "rgb(100, 100, 100)",
            fontWeight: step !== "password" ? "600" : "400",
          }}>
            2. 2FA
          </span>
        </div>

        {/* Passord-steg */}
        {step === "password" && (
          <form onSubmit={handlePasswordSubmit}>
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
                style={inputStyle}
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
              style={buttonStyle(loading || !password)}
            >
              {loading ? "Logger inn..." : "Neste"}
            </button>
          </form>
        )}

        {/* 2FA kode-steg (eksisterende bruker) */}
        {step === "2fa-code" && (
          <form onSubmit={handleTotpSubmit}>
            <div style={{ 
              marginBottom: "1rem",
              padding: "1rem",
              background: "rgba(0, 112, 243, 0.1)",
              border: "1px solid rgba(0, 112, 243, 0.2)",
              borderRadius: "4px",
            }}>
              <div style={{ fontSize: "0.9rem", color: "rgb(200, 200, 200)" }}>
                🔐 Åpne Google Authenticator og skriv inn koden
              </div>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label
                htmlFor="totp"
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontSize: "0.9rem",
                  color: "rgb(200, 200, 200)",
                }}
              >
                6-sifret kode
              </label>
              <input
                id="totp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                disabled={loading}
                autoFocus
                placeholder="000000"
                style={{
                  ...inputStyle,
                  textAlign: "center",
                  fontSize: "1.5rem",
                  letterSpacing: "0.5rem",
                  fontFamily: "monospace",
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
              disabled={loading || totpCode.length !== 6}
              style={buttonStyle(loading || totpCode.length !== 6)}
            >
              {loading ? "Verifiserer..." : "Logg inn"}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep("password");
                setTotpCode("");
                setError("");
              }}
              style={{
                width: "100%",
                marginTop: "0.5rem",
                padding: "0.5rem",
                fontSize: "0.85rem",
                background: "transparent",
                color: "rgb(150, 150, 150)",
                border: "none",
                cursor: "pointer",
              }}
            >
              ← Tilbake
            </button>
          </form>
        )}

        {/* 2FA oppsett-steg (første gang) */}
        {step === "2fa-setup" && (
          <form onSubmit={handleTotpSubmit}>
            <div style={{ 
              marginBottom: "1rem",
              padding: "1rem",
              background: "rgba(0, 200, 100, 0.1)",
              border: "1px solid rgba(0, 200, 100, 0.2)",
              borderRadius: "4px",
            }}>
              <div style={{ fontSize: "0.9rem", color: "rgb(200, 200, 200)", marginBottom: "0.5rem" }}>
                🛡️ <strong>Første gangs oppsett</strong>
              </div>
              <div style={{ fontSize: "0.85rem", color: "rgb(150, 150, 150)" }}>
                Skann QR-koden med Google Authenticator for å aktivere 2FA
              </div>
            </div>

            {qrCode && (
              <div style={{ 
                display: "flex", 
                flexDirection: "column", 
                alignItems: "center",
                marginBottom: "1rem",
              }}>
                <img 
                  src={qrCode} 
                  alt="QR-kode for 2FA" 
                  style={{ 
                    borderRadius: "8px",
                    marginBottom: "0.5rem",
                  }}
                />
                {secret && (
                  <details style={{ width: "100%", fontSize: "0.8rem" }}>
                    <summary style={{ 
                      cursor: "pointer", 
                      color: "rgb(150, 150, 150)",
                      textAlign: "center",
                    }}>
                      Kan ikke skanne? Klikk for manuell nøkkel
                    </summary>
                    <code style={{
                      display: "block",
                      marginTop: "0.5rem",
                      padding: "0.5rem",
                      background: "rgb(10, 10, 10)",
                      borderRadius: "4px",
                      fontSize: "0.75rem",
                      wordBreak: "break-all",
                      color: "rgb(0, 200, 100)",
                    }}>
                      {secret}
                    </code>
                  </details>
                )}
              </div>
            )}

            <div style={{ marginBottom: "1rem" }}>
              <label
                htmlFor="totp-setup"
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontSize: "0.9rem",
                  color: "rgb(200, 200, 200)",
                }}
              >
                Skriv inn kode fra appen for å bekrefte
              </label>
              <input
                id="totp-setup"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                disabled={loading}
                placeholder="000000"
                style={{
                  ...inputStyle,
                  textAlign: "center",
                  fontSize: "1.5rem",
                  letterSpacing: "0.5rem",
                  fontFamily: "monospace",
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
              disabled={loading || totpCode.length !== 6}
              style={buttonStyle(loading || totpCode.length !== 6)}
            >
              {loading ? "Aktiverer 2FA..." : "Aktiver 2FA og logg inn"}
            </button>
          </form>
        )}

        {/* Sikkerhetsinfo */}
        <div style={{
          marginTop: "1.5rem",
          padding: "0.75rem",
          background: "rgba(100, 100, 100, 0.1)",
          borderRadius: "4px",
          fontSize: "0.75rem",
          color: "rgb(120, 120, 120)",
        }}>
          🔒 Beskyttet med tofaktor-autentisering (TOTP)
        </div>
      </div>
    </div>
  );
}
