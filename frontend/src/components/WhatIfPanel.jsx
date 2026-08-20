import React, { useState, useEffect, useRef, useCallback } from "react";
import { getWhatIfConfig, predictWhatIf } from "../api/simulationApi";

const ACCENT = "#10b981";

/**
 * ML "What-If" process simulator drawer. Lets the operator drag sliders for
 * upstream inputs (feed rate, mill speed, etc.) and see ML-predicted
 * downstream effects (grind size, grade, power draw...) compared against
 * the real current baseline — grounded in the actual historical dataset,
 * not a toy demo.
 */
export default function WhatIfPanel({ isOpen, onClose }) {
  const [config, setConfig] = useState(null);
  const [values, setValues] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!isOpen || config) return;
    (async () => {
      try {
        const cfg = await getWhatIfConfig();
        setConfig(cfg);
        const defaults = {};
        Object.entries(cfg.inputs).forEach(([key, spec]) => {
          defaults[key] = spec.default;
        });
        setValues(defaults);
      } catch (e) {
        setError(e.message);
      }
    })();
  }, [isOpen, config]);

  const runPrediction = useCallback(async (inputValues) => {
    setLoading(true);
    setError(null);
    try {
      const res = await predictWhatIf(inputValues);
      setResult(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!config || Object.keys(values).length === 0) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runPrediction(values), 400);
    return () => clearTimeout(debounceRef.current);
  }, [values, config, runPrediction]);

  if (!isOpen) return null;

  const handleSlider = (key, val) => {
    setValues((prev) => ({ ...prev, [key]: Number(val) }));
  };

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
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.5rem",
          borderBottom: "1px solid #1e293b",
          paddingBottom: "0.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "1.1rem" }}>🧪</span>
          <span style={{ color: ACCENT, fontWeight: "800", fontSize: "0.9rem" }}>What-If Simulator (ML)</span>
        </div>
        <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: "1.2rem", cursor: "pointer" }}>
          ✕
        </button>
      </div>

      <div style={{ color: "#64748b", fontSize: "0.68rem", marginBottom: "0.6rem", lineHeight: 1.4 }}>
        Ajuste les entrées process ci-dessous — un modèle ML (Random Forest) entraîné sur l'historique réel du circuit prédit les effets en aval, comparés à l'état actuel réel.
      </div>

      {error && (
        <div style={{ background: "#2a1215", border: "1px solid #ef4444", color: "#fca5a5", padding: "0.5rem", borderRadius: "6px", fontSize: "0.72rem", marginBottom: "0.6rem" }}>
          {error}
        </div>
      )}

      {!config ? (
        <div style={{ color: "#64748b", textAlign: "center", padding: "2rem 0", fontSize: "0.8rem" }}>Chargement du modèle...</div>
      ) : (
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.9rem" }}>
          {/* Inputs */}
          <div>
            <div style={{ color: "#94a3b8", fontWeight: "800", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "0.5rem" }}>
              Entrées ajustables
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              {Object.entries(config.inputs).map(([key, spec]) => (
                <div key={key}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", marginBottom: "0.2rem" }}>
                    <span style={{ color: "#cbd5e1", fontWeight: "700" }}>{key.replace(/_/g, " ")}</span>
                    <span style={{ color: ACCENT, fontFamily: "monospace", fontWeight: "700" }}>
                      {values[key]?.toFixed?.(1) ?? values[key]} {spec.unit}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={spec.min}
                    max={spec.max}
                    step={(spec.max - spec.min) / 200 || 1}
                    value={values[key] ?? spec.default}
                    onChange={(e) => handleSlider(key, e.target.value)}
                    style={{ width: "100%", accentColor: ACCENT }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Results */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.5rem" }}>
              <span style={{ color: "#94a3b8", fontWeight: "800", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Prédictions vs. état actuel
              </span>
              {loading && <span style={{ color: ACCENT, fontSize: "0.65rem" }}>calcul...</span>}
            </div>

            {!result ? (
              <div style={{ color: "#64748b", textAlign: "center", padding: "1rem 0", fontSize: "0.75rem" }}>
                Ajuste un curseur pour lancer une simulation.
              </div>
            ) : (
              Object.entries(config.output_groups).map(([groupName, cols]) => (
                <div key={groupName} style={{ marginBottom: "0.7rem" }}>
                  <div style={{ color: "#7dd3fc", fontWeight: "700", fontSize: "0.7rem", marginBottom: "0.3rem" }}>{groupName}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    {cols.map((col) => {
                      const value = result.predictions[col];
                      const baseline = result.baseline[col];
                      const delta = result.delta[col];
                      const unit = config.output_units[col] || "";
                      const r2 = result.r2_scores[col];
                      const isUp = delta > 0.001;
                      const isDown = delta < -0.001;
                      return (
                        <div
                          key={col}
                          style={{
                            background: "#131b2e",
                            border: "1px solid #1e293b",
                            borderRadius: "5px",
                            padding: "0.35rem 0.55rem",
                            fontSize: "0.7rem",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.2rem" }}>
                            <span style={{ color: "#94a3b8" }}>{col.replace(/_/g, " ")}</span>
                            {typeof r2 === "number" && (
                              <span
                                title="R² du modèle sur cette variable (fiabilité)"
                                style={{
                                  color: r2 >= 0.7 ? "#34d399" : r2 >= 0.4 ? "#f59e0b" : "#f87171",
                                  fontSize: "0.6rem",
                                  border: "1px solid currentColor",
                                  borderRadius: "3px",
                                  padding: "0 0.2rem",
                                }}
                              >
                                R²{r2.toFixed(2)}
                              </span>
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap" }}>
                            <span style={{ color: "#64748b", fontSize: "0.62rem" }}>Actuel</span>
                            <span style={{ color: "#cbd5e1", fontFamily: "monospace" }}>
                              {typeof baseline === "number" ? baseline.toFixed(2) : baseline} {unit}
                            </span>
                            <span style={{ color: "#475569" }}>→</span>
                            <span style={{ color: "#64748b", fontSize: "0.62rem" }}>Prédit</span>
                            <span style={{ color: "#f8fafc", fontFamily: "monospace", fontWeight: "700" }}>
                              {typeof value === "number" ? value.toFixed(2) : value} {unit}
                            </span>
                            <span style={{ color: isUp ? "#34d399" : isDown ? "#f87171" : "#64748b", fontFamily: "monospace", fontSize: "0.65rem" }}>
                              ({isUp ? "▲" : isDown ? "▼" : "–"} {Math.abs(delta).toFixed(2)})
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
