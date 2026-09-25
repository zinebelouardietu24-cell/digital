import React, { useEffect, useState } from "react";
import { LineChart, Line, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Cpu, Database } from "lucide-react";
import { getSoftSensorP80, getHistorianStats } from "../api/simulationApi";

const ACCENT = "#00f0ff";
const MUTED = "#94a3b8";

/**
 * Floating card on the flowsheet: P80 estimated online by the XGBoost soft
 * sensor vs the measured value, a sparkline of recent estimates, and the
 * number of messages stored by the telemetry historian.
 */
export default function SoftSensorCard() {
  const [p80, setP80] = useState(null);
  const [historian, setHistorian] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const data = await getSoftSensorP80(24);
        if (!cancelled) setP80(data);
      } catch {
        if (!cancelled) setP80(null);
      }
      try {
        const stats = await getHistorianStats();
        if (!cancelled) setHistorian(stats);
      } catch {
        if (!cancelled) setHistorian(null);
      }
    };
    refresh();
    const timer = setInterval(refresh, 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (!p80 || !p80.available) return null;

  const err = p80.error_um;
  const errColor = Math.abs(err) <= 1.5 ? "#34d399" : "#fbbf24";
  const metrics = p80.test_metrics || {};

  return (
    <div
      style={{
        position: "absolute",
        top: "2.4rem",
        left: "0.6rem",
        zIndex: 20,
        width: "270px",
        background: "rgba(10, 15, 26, 0.92)",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(0, 240, 255, 0.35)",
        borderRadius: "10px",
        padding: "0.6rem 0.75rem",
        boxShadow: "0 6px 20px rgba(0,0,0,0.6)",
        fontFamily: "inherit",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.4rem" }}>
        <Cpu size={14} color={ACCENT} />
        <span style={{ color: ACCENT, fontWeight: 800, fontSize: "0.7rem", letterSpacing: "0.5px" }}>
          CAPTEUR VIRTUEL P80 · XGBOOST
        </span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ color: MUTED, fontSize: "0.62rem" }}>P80 estimé (surverse)</div>
          <div style={{ color: "#e2e8f0", fontWeight: 800, fontSize: "1.35rem", lineHeight: 1.1 }}>
            {p80.estimated_p80_um.toFixed(1)} <span style={{ fontSize: "0.7rem", color: MUTED }}>µm</span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: MUTED, fontSize: "0.62rem" }}>Mesuré : {p80.measured_p80_um.toFixed(1)} µm</div>
          <div style={{ color: errColor, fontSize: "0.7rem", fontWeight: 700 }}>
            écart {err >= 0 ? "+" : ""}{err.toFixed(2)} µm
          </div>
        </div>
      </div>

      {p80.history && p80.history.length > 1 && (
        <div style={{ height: 58, marginTop: "0.35rem" }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={p80.history} margin={{ top: 4, right: 2, bottom: 0, left: 2 }}>
              <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid #334155", fontSize: "0.65rem" }}
                labelFormatter={(i) => p80.history[i]?.timestamp || ""}
                formatter={(v, name) => [`${v} µm`, name === "measured" ? "Mesuré" : "Estimé"]}
              />
              <Line type="monotone" dataKey="measured" stroke="#64748b" strokeWidth={1.2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="estimated" stroke={ACCENT} strokeWidth={1.6} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.3rem", fontSize: "0.6rem", color: MUTED }}>
        <span>
          Test : R² {metrics.R2 != null ? metrics.R2.toFixed(3) : "–"} · MAE{" "}
          {metrics.MAE != null ? metrics.MAE.toFixed(2) : "–"} µm
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <Database size={10} />
          {historian ? `${historian.rows.toLocaleString("fr-FR")} mesures` : "historien —"}
        </span>
      </div>
    </div>
  );
}
