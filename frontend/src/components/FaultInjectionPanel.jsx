import React, { useEffect, useState } from "react";
import { X, Zap, RotateCcw } from "lucide-react";
import { getFaultScenarios, getFaultRules, injectFault, clearFault } from "../api/simulationApi";

const ACCENT = "#a78bfa";
const EQUIPMENT = { PB_001: "Bac", SP_001: "Pompe", CY_001: "Cyclones", BM_001: "Broyeur" };

/**
 * Tiroir de démonstration : choisir un défaut à injecter dans les mesures,
 * puis observer le jumeau le détecter. Affiche aussi la table des règles.
 */
export default function FaultInjectionPanel({ isOpen, onClose, injected }) {
  const [scenarios, setScenarios] = useState([]);
  const [rules, setRules] = useState([]);
  const [tab, setTab] = useState("inject");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || scenarios.length) return;
    (async () => {
      try {
        setScenarios(await getFaultScenarios());
        setRules(await getFaultRules());
      } catch (e) {
        setError(e.message);
      }
    })();
  }, [isOpen, scenarios.length]);

  if (!isOpen) return null;

  const run = async (fn) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    }
  };

  const tabButton = (id, label) => (
    <button
      onClick={() => setTab(id)}
      style={{
        flex: 1,
        background: tab === id ? ACCENT : "#162032",
        color: tab === id ? "#0f172a" : "#cbd5e1",
        border: `1px solid ${ACCENT}`,
        borderRadius: "5px",
        padding: "0.3rem",
        fontSize: "0.7rem",
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        width: "420px",
        height: "100vh",
        background: "#0f172a",
        borderLeft: `1px solid ${ACCENT}`,
        boxShadow: "-5px 0 25px rgba(0,0,0,0.5)",
        zIndex: 10000,
        display: "flex",
        flexDirection: "column",
        padding: "1rem",
        boxSizing: "border-box",
        gap: "0.7rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: ACCENT, fontWeight: 800, fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <Zap size={16} /> DÉFAUTS : DÉMONSTRATION ET RÈGLES
        </span>
        <button onClick={onClose} aria-label="Fermer" style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ display: "flex", gap: "0.4rem" }}>
        {tabButton("inject", "Injecter un défaut")}
        {tabButton("rules", "Règles de détection")}
      </div>

      {error && <div style={{ color: "#f87171", fontSize: "0.7rem" }}>{error}</div>}

      {tab === "inject" ? (
        <>
          <div style={{ color: "#94a3b8", fontSize: "0.7rem" }}>
            Choisis un défaut : les mesures de l'équipement sont modifiées comme le ferait ce défaut, et le jumeau doit le
            détecter et le nommer. Les données réelles ne contiennent qu'un seul défaut (cyclone hors service le 17/07).
          </div>
          <button
            onClick={() => run(clearFault)}
            disabled={!injected}
            style={{
              background: injected ? "#10b981" : "#162032",
              color: injected ? "#0f172a" : "#64748b",
              border: "1px solid #10b981",
              borderRadius: "6px",
              padding: "0.4rem",
              fontSize: "0.72rem",
              fontWeight: 800,
              cursor: injected ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.35rem",
            }}
          >
            <RotateCcw size={13} /> Retour à la normale
          </button>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", overflowY: "auto" }}>
            {scenarios.map((s) => {
              const active = injected && injected.id === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => run(() => injectFault(s.id))}
                  style={{
                    textAlign: "left",
                    background: active ? "rgba(167, 139, 250, 0.18)" : "#162032",
                    border: `1px solid ${active ? ACCENT : "#1e293b"}`,
                    borderRadius: "6px",
                    padding: "0.45rem 0.6rem",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#e2e8f0", fontSize: "0.74rem", fontWeight: 700 }}>{s.name}</span>
                    <span style={{ color: "#94a3b8", fontSize: "0.62rem" }}>{EQUIPMENT[s.equipment] || s.equipment}</span>
                  </div>
                  <div style={{ color: "#94a3b8", fontSize: "0.64rem", marginTop: "0.15rem" }}>{s.description}</div>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", overflowY: "auto" }}>
          {rules.map((r) => (
            <div key={r.id} style={{ background: "#162032", border: "1px solid #1e293b", borderRadius: "6px", padding: "0.45rem 0.6rem" }}>
              <div style={{ color: "#e2e8f0", fontSize: "0.72rem", fontWeight: 700 }}>
                {r.equipment_name} · {r.fault}
              </div>
              <div style={{ color: "#cbd5e1", fontSize: "0.64rem" }}>SI {r.condition}</div>
              <div style={{ color: "#94a3b8", fontSize: "0.6rem" }}>Source : {r.source}</div>
              <div style={{ color: "#a7f3d0", fontSize: "0.62rem" }}>ALORS → {r.action}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
