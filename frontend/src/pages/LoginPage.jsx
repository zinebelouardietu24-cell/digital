import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import logoJesa from "../assets/logo_jesa.png";
import logoEnsem from "../assets/logo_ensem.jpg";
import { Lock, User, Eye, EyeOff, ShieldCheck, Cpu, ArrowRight, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const { login, loading, authError } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setErrorMsg("Please enter both username and password.");
      return;
    }
    setErrorMsg("");
    const result = await login(username, password);
    if (!result.success) {
      setErrorMsg(result.error || "Authentication failed.");
    }
  };

  const handleRolePreset = async (presetUser, presetPass) => {
    setUsername(presetUser);
    setPassword(presetPass);
    setErrorMsg("");
    const result = await login(presetUser, presetPass);
    if (!result.success) {
      setErrorMsg(result.error || "Authentication failed.");
    }
  };

  return (
    <div style={styles.container}>
      {/* Background Subtle Animated Gradient Mesh */}
      <div style={styles.bgGradientOverlay} />

      {/* Main Login Card */}
      <div style={styles.card}>
        {/* Top Co-Branding Header */}
        <div style={styles.coBrandingBar}>
          <div style={styles.logoPill}>
            <div style={styles.logoSlot}>
              <img src={logoEnsem} alt="ENSEM Casablanca" style={styles.logoImgEnsem} />
            </div>
            <div style={styles.logoDivider} />
            <div style={styles.logoSlot}>
              <img src={logoJesa} alt="JESA / OCP Group" style={styles.logoImgJesa} />
            </div>
          </div>
          <div style={styles.partnershipSubtitle}>
            End of Studies Project (PFA) • Industrial Telemetry Engine
          </div>
        </div>

        {/* Title Section */}
        <div style={styles.headerSection}>
          <div style={styles.iconBadge}>
            <Cpu size={28} color="#06b6d4" />
          </div>
          <h1 style={styles.title}>Phosphates Grinding Circuit Digital Twin</h1>
          <p style={styles.subtitle}>
            Secure telemetry dashboard & AI-driven industrial analytics portal
          </p>
        </div>

        {/* Quick Role Select Presets */}
        <div style={styles.presetSection}>
          <div style={styles.presetLabel}>Quick Select Demo Credentials:</div>
          <div style={styles.presetGrid}>
            <button
              type="button"
              onClick={() => handleRolePreset("operator", "operator123")}
              style={{
                ...styles.presetBtn,
                borderColor: username === "operator" ? "#06b6d4" : "rgba(255,255,255,0.1)",
                backgroundColor: username === "operator" ? "rgba(6,182,212,0.15)" : "rgba(15,23,42,0.6)",
              }}
            >
              <div style={styles.presetRoleTitle}>Plant Operator</div>
              <div style={styles.presetUserSub}>operator / operator123</div>
            </button>
            <button
              type="button"
              onClick={() => handleRolePreset("engineer", "engineer123")}
              style={{
                ...styles.presetBtn,
                borderColor: username === "engineer" ? "#3b82f6" : "rgba(255,255,255,0.1)",
                backgroundColor: username === "engineer" ? "rgba(59,130,246,0.15)" : "rgba(15,23,42,0.6)",
              }}
            >
              <div style={styles.presetRoleTitle}>Process Engineer</div>
              <div style={styles.presetUserSub}>engineer / engineer123</div>
            </button>
            <button
              type="button"
              onClick={() => handleRolePreset("admin", "admin123")}
              style={{
                ...styles.presetBtn,
                borderColor: username === "admin" ? "#10b981" : "rgba(255,255,255,0.1)",
                backgroundColor: username === "admin" ? "rgba(16,185,129,0.15)" : "rgba(15,23,42,0.6)",
              }}
            >
              <div style={styles.presetRoleTitle}>Plant Director</div>
              <div style={styles.presetUserSub}>admin / admin123</div>
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {(errorMsg || authError) && (
          <div style={styles.errorBanner}>
            <AlertCircle size={18} color="#ef4444" style={{ flexShrink: 0 }} />
            <span>{errorMsg || authError}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Username or Email</label>
            <div style={styles.inputWrapper}>
              <User size={18} color="#94a3b8" style={styles.inputIcon} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username (e.g. engineer)"
                style={styles.input}
                required
              />
            </div>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <div style={styles.inputWrapper}>
              <Lock size={18} color="#94a3b8" style={styles.inputIcon} />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                style={styles.input}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
              >
                {showPassword ? <EyeOff size={18} color="#94a3b8" /> : <Eye size={18} color="#94a3b8" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.submitBtn,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Access Digital Twin</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Footer Trust Indicator */}
        <div style={styles.footer}>
          <ShieldCheck size={14} color="#10b981" />
          <span>Encrypted Session • ENSEM Casablanca & JESA / OCP Group © 2026</span>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    width: "100vw",
    backgroundColor: "#0e1420",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    padding: "20px",
    boxSizing: "border-box",
    overflow: "auto",
  },
  bgGradientOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "radial-gradient(circle at 50% 30%, rgba(42, 56, 78, 0.25) 0%, rgba(14, 20, 32, 0.98) 100%)",
    pointerEvents: "none",
  },
  card: {
    width: "100%",
    maxWidth: "520px",
    backgroundColor: "rgba(22, 31, 48, 0.9)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    borderRadius: "16px",
    border: "1px solid #2a384e",
    boxShadow: "0 20px 50px rgba(0, 0, 0, 0.7)",
    padding: "36px 32px",
    position: "relative",
    zIndex: 2,
  },
  coBrandingBar: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    marginBottom: "24px",
  },
  logoPill: {
    width: "100%",
    maxWidth: "420px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    padding: "10px 16px",
    borderRadius: "40px",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4)",
    border: "1px solid rgba(255, 255, 255, 0.3)",
    boxSizing: "border-box",
  },
  logoSlot: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "60px",
    padding: "0 8px",
    boxSizing: "border-box",
  },
  logoImgEnsem: {
    maxHeight: "58px",
    maxWidth: "100%",
    objectFit: "contain",
  },
  logoDivider: {
    width: "1px",
    height: "44px",
    backgroundColor: "#cbd5e1",
    flexShrink: 0,
  },
  logoImgJesa: {
    maxHeight: "46px",
    maxWidth: "100%",
    objectFit: "contain",
  },
  partnershipSubtitle: {
    fontSize: "12px",
    color: "#94a3b8",
    fontWeight: "500",
    marginTop: "10px",
    letterSpacing: "0.5px",
    textAlign: "center",
  },
  headerSection: {
    textAlign: "center",
    marginBottom: "24px",
  },
  iconBadge: {
    width: "52px",
    height: "52px",
    borderRadius: "50%",
    backgroundColor: "rgba(6, 182, 212, 0.12)",
    border: "1px solid rgba(6, 182, 212, 0.3)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "12px",
  },
  title: {
    margin: "0 0 8px 0",
    fontSize: "20px",
    fontWeight: "700",
    color: "#f8fafc",
    letterSpacing: "-0.3px",
  },
  subtitle: {
    margin: 0,
    fontSize: "13px",
    color: "#94a3b8",
    lineHeight: "1.4",
  },
  presetSection: {
    marginBottom: "20px",
    backgroundColor: "rgba(30, 41, 59, 0.5)",
    padding: "12px",
    borderRadius: "10px",
    border: "1px solid rgba(255, 255, 255, 0.05)",
  },
  presetLabel: {
    fontSize: "11px",
    fontWeight: "600",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: "8px",
  },
  presetGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "8px",
  },
  presetBtn: {
    padding: "8px 6px",
    borderRadius: "8px",
    border: "1px solid",
    color: "#f1f5f9",
    textAlign: "center",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  presetRoleTitle: {
    fontSize: "11px",
    fontWeight: "600",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  presetUserSub: {
    fontSize: "9px",
    color: "#94a3b8",
    marginTop: "2px",
  },
  errorBanner: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    border: "1px solid rgba(239, 68, 68, 0.4)",
    borderRadius: "8px",
    padding: "10px 14px",
    color: "#fca5a5",
    fontSize: "13px",
    marginBottom: "20px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  label: {
    fontSize: "12px",
    fontWeight: "600",
    color: "#cbd5e1",
  },
  inputWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  inputIcon: {
    position: "absolute",
    left: "12px",
    pointerEvents: "none",
  },
  input: {
    width: "100%",
    padding: "12px 14px 12px 40px",
    backgroundColor: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "8px",
    color: "#f8fafc",
    fontSize: "14px",
    outline: "none",
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
    boxSizing: "border-box",
  },
  eyeBtn: {
    position: "absolute",
    right: "12px",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
    display: "flex",
    alignItems: "center",
  },
  submitBtn: {
    marginTop: "8px",
    width: "100%",
    padding: "14px",
    borderRadius: "8px",
    border: "none",
    background: "linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)",
    color: "#ffffff",
    fontWeight: "700",
    fontSize: "14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    boxShadow: "0 4px 14px rgba(6, 182, 212, 0.3)",
    transition: "transform 0.1s ease, box-shadow 0.2s ease",
  },
  footer: {
    marginTop: "24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    color: "#64748b",
    fontSize: "11px",
  },
};
