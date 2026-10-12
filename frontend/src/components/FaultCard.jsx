import React, { useEffect, useState } from "react";
import { ShieldCheck, AlertTriangle, Database } from "lucide-react";
import { getHistorianStats } from "../api/simulationApi";

const MUTED = "#94a3b8";
export const LEVEL_STYLE = {
  normal: { color: "#34d399", label: "NORMAL" },
  alerte: { color: "#f59e0b", label: "ALERTE" },
  alarme: { color: "#ef4444", label: "ALARME" },
};

function formatValue(value, unit) {
  if (value == null) return "";
  const digits = Math.abs(value) >= 100 ? 0 : 1;
  return `${value.toFixed(digits)} ${unit}`;
}

/**
 * Carte flottante du synoptique : état du diagnostic (normal / alerte /
 * alarme), défauts actifs avec la mesure en cause et l'action conseillée,
 * et nombre de mesures enregistrées par l'historien.
 */
export default function FaultCard({ data }) {
  const [historian, setHistorian] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const stats = await getHistorianStats();
        if (!cancelled) setHistorian(stats);
      } catch {
        if (!cancelled) setHistorian(null);
      }
    };
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (!data || !data.available) return null;
  const overall = LEVEL_STYLE[data.status] || LEVEL_STYLE.normal;
  const faults = data.faults || [];

  return (
    <div
      style={{
        position: "absolute",
        top: "2.4rem",
        left: "0.6rem",
        zIndex: 20,
        width: "300px",
        background: "rgba(10, 15, 26, 0.94)",
        backdropFilter: "blur(10px)",
        border: `1px solid ${overall.color}`,
        borderRadius: "10px",
        padding: "0.6rem 0.75rem",
        boxShadow: "0 6px 20px rgba(0,0,0,0.6)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
        <span style={{ color: "#e2e8f0", fontWeight: 800, fontSize: "0.7rem", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "0.35rem" }}>
          {data.status === "normal" ? <ShieldCheck size={14} color={overall.color} /> : <AlertTriangle size={14} color={overall.color} />}
          DIAGNOSTIC DES DÉFAUTS
        </span>
        <span
          style={{
            color: "#0f172a",
            background: overall.color,
            borderRadius: "4px",
            padding: "0.05rem 0.4rem",
            fontSize: "0.62rem",
            fontWeight: 800,
          }}
        >
          {overall.label}
        </span>
      </div>

      {data.injected && (
        <div style={{ color: "#c4b5fd", fontSize: "0.62rem", marginBottom: "0.35rem" }}>
          Défaut injecté pour la démonstration : <b>{data.injected.name}</b>
        </div>
      )}

      {faults.length === 0 ? (
        <div style={{ color: MUTED, fontSize: "0.68rem" }}>Aucun défaut détecté : toutes les mesures sont dans leur plage normale.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", maxHeight: "260px", overflowY: "auto" }}>
          {faults.map((f) => {
            const style = LEVEL_STYLE[f.level];
            return (
              <div key={f.id} style={{ borderLeft: `3px solid ${style.color}`, paddingLeft: "0.45rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.4rem" }}>
                  <span style={{ color: "#e2e8f0", fontSize: "0.7rem", fontWeight: 700 }}>
                    {f.equipment_name} · {f.fault}
                  </span>
                  <span style={{ color: style.color, fontSize: "0.58rem", fontWeight: 800, whiteSpace: "nowrap" }}>{style.label}</span>
                </div>
                <div style={{ color: MUTED, fontSize: "0.6rem" }}>
                  Mesure : <b style={{ color: "#e2e8f0" }}>{formatValue(f.value, f.unit)}</b> — règle : {f.condition}
                </div>
                <div style={{ color: "#cbd5e1", fontSize: "0.62rem" }}>→ {f.action}</div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.45rem", fontSize: "0.58rem", color: MUTED }}>
        <span>{data.simulation_time}</span>
        <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <Database size={10} />
          {historian ? `${historian.rows.toLocaleString("fr-FR")} mesures` : "historien —"}
        </span>
      </div>
    </div>
  );
}
