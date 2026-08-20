import React, { useState, useEffect } from "react";
import SimulationControlModal from "./SimulationControlModal";
import { getMqttStatus, getMqttTags, getHistoricalTags } from "./simulationApi";

/**
 * Groups a flat { tagId: payload } map into { "EQUIP.CONTEXT": [payload, ...] }
 * buckets, sorted by equipment then context, for a readable drawer layout.
 */
function groupTagsForDrawer(tags) {
  const groups = {};
  Object.entries(tags).forEach(([tagId, payload]) => {
    const [equip, context] = tagId.split(".");
    const key = `${equip || "?"}.${context || "?"}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push({ tagId, ...payload });
  });
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}

/**
 * Ultra-Clean Header Control Bar.
 * Holds three pop-up launchers:
 * 1. "🎮 Simulation Controls & Data" -> opens SimulationControlModal pop-up.
 * 2. "📡 Live Feed" -> opens live MQTT stream drawer (data coming from Node-RED/KEPServerEX).
 * 3. "🗂️ Données CSV" -> opens the original replay-dataset drawer (data already had).
 */
export default function SimulationControlBar({ status, onStatusUpdate }) {
  const [mqttStatus, setMqttStatus] = useState(null);
  const [showMqttDrawer, setShowMqttDrawer] = useState(false);
  const [showHistoricalDrawer, setShowHistoricalDrawer] = useState(false);
  const [showControlModal, setShowControlModal] = useState(false);
  const [mqttTags, setMqttTags] = useState({});
  const [historicalTags, setHistoricalTags] = useState({});

  // Poll MQTT status periodically
  useEffect(() => {
    const fetchMqtt = async () => {
      try {
        const data = await getMqttStatus();
        setMqttStatus(data);
      } catch (e) {
        console.error("MQTT status fetch failed:", e);
      }
    };
    fetchMqtt();
    const timer = setInterval(fetchMqtt, 1000);
    return () => clearInterval(timer);
  }, []);

  // Poll live MQTT tags when drawer is open
  useEffect(() => {
    if (!showMqttDrawer) return;
    const fetchTags = async () => {
      try {
        const data = await getMqttTags();
        setMqttTags(data);
      } catch (e) {
        console.error(e);
      }
    };
    fetchTags();
    const timer = setInterval(fetchTags, 800);
    return () => clearInterval(timer);
  }, [showMqttDrawer]);

  // Poll historical (CSV replay) tags when that drawer is open
  useEffect(() => {
    if (!showHistoricalDrawer) return;
    const fetchHistorical = async () => {
      try {
        const data = await getHistoricalTags();
        setHistoricalTags(data);
      } catch (e) {
        console.error(e);
      }
    };
    fetchHistorical();
    const timer = setInterval(fetchHistorical, 1000);
    return () => clearInterval(timer);
  }, [showHistoricalDrawer]);

  const totalTags = mqttStatus?.total_live_tags || status?.mqtt?.total_live_tags || 51;
  const liveTagCount = Object.keys(mqttTags).length > 0 ? Object.keys(mqttTags).length : totalTags;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
      {/* 1. Simulation Controls & Data Pop-up Launcher Button */}
      <button
        onClick={() => setShowControlModal(true)}
        style={{
          background: "#0284c7",
          color: "#ffffff",
          border: "1px solid #00f0ff",
          borderRadius: "6px",
          padding: "0.32rem 0.75rem",
          fontSize: "0.78rem",
          fontWeight: "700",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: "0.4rem",
          transition: "all 0.2s ease",
          boxShadow: "0 0 10px rgba(0, 240, 255, 0.25)",
        }}
        title="Click to open Simulation Controller & Live Data Pop-up"
      >
        🎮 Simulation Controls & Data
      </button>

      {/* 2. Live Feed MQTT Drawer Button */}
      <button
        onClick={() => setShowMqttDrawer(!showMqttDrawer)}
        style={{
          background: showMqttDrawer ? "#0284c7" : "#1e293b",
          color: "#38bdf8",
          border: "1px solid #0284c7",
          borderRadius: "6px",
          padding: "0.32rem 0.75rem",
          fontSize: "0.78rem",
          fontWeight: "700",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: "0.4rem",
          transition: "all 0.2s ease",
        }}
        title="Click to open Live MQTT Stream Feed"
      >
        📡 Live Feed ({liveTagCount} topics)
      </button>

      {/* 3. Historical (CSV replay) Data Drawer Button */}
      <button
        onClick={() => setShowHistoricalDrawer(!showHistoricalDrawer)}
        style={{
          background: showHistoricalDrawer ? "#7c3aed" : "#1e293b",
          color: "#c4b5fd",
          border: "1px solid #7c3aed",
          borderRadius: "6px",
          padding: "0.32rem 0.75rem",
          fontSize: "0.78rem",
          fontWeight: "700",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: "0.4rem",
          transition: "all 0.2s ease",
        }}
        title="Voir les données du jeu de données CSV original (independant du flux MQTT live)"
      >
        🗂️ Données CSV ({Object.keys(historicalTags).length || "..."})
      </button>

      {/* Pop-up Simulation Controller & Live Data Modal */}
      <SimulationControlModal
        isOpen={showControlModal}
        onClose={() => setShowControlModal(false)}
        status={status}
        onStatusUpdate={onStatusUpdate}
      />

      {/* Live MQTT Stream Drawer Modal */}
      {showMqttDrawer && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            zIndex: 9999,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <div
            onClick={() => setShowMqttDrawer(false)}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              background: "rgba(0, 0, 0, 0.5)",
              backdropFilter: "blur(2px)",
              cursor: "pointer",
            }}
          />

          <div
            style={{
              position: "relative",
              width: "420px",
              height: "100%",
              background: "#0f172a",
              borderLeft: "1px solid #1e293b",
              boxShadow: "-5px 0 25px rgba(0,0,0,0.5)",
              display: "flex",
              flexDirection: "column",
              padding: "1rem",
              boxSizing: "border-box",
              zIndex: 10000,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", borderBottom: "1px solid #1e293b", paddingBottom: "0.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.2rem" }}>📡</span>
                <span style={{ color: "#00f0ff", fontWeight: "700", fontSize: "0.9rem" }}>
                  MQTT Broker Live Feed
                </span>
              </div>
              <button
                onClick={() => setShowMqttDrawer(false)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: "1.2rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {Object.keys(mqttTags).length === 0 ? (
                <div style={{ color: "#64748b", textAlign: "center", padding: "2rem 0", fontSize: "0.8rem" }}>
                  Waiting for active MQTT topic payloads...
                </div>
              ) : (
                Object.entries(mqttTags).map(([topic, payload]) => (
                  <div key={topic} style={{ background: "#162032", border: "1px solid #1e293b", borderRadius: "6px", padding: "0.6rem", fontSize: "0.72rem" }}>
                    <div style={{ color: "#38bdf8", fontWeight: "700", fontFamily: "monospace", marginBottom: "0.2rem" }}>
                      {topic}
                    </div>
                    <pre style={{ margin: 0, color: "#a7f3d0", fontFamily: "monospace", fontSize: "0.68rem", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                      {JSON.stringify(payload, null, 2)}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Historical (CSV replay) Data Drawer Modal */}
      {showHistoricalDrawer && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            zIndex: 9999,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <div
            onClick={() => setShowHistoricalDrawer(false)}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              background: "rgba(0, 0, 0, 0.5)",
              backdropFilter: "blur(2px)",
              cursor: "pointer",
            }}
          />

          <div
            style={{
              position: "relative",
              width: "420px",
              height: "100%",
              background: "#0f172a",
              borderLeft: "1px solid #1e293b",
              boxShadow: "-5px 0 25px rgba(0,0,0,0.5)",
              display: "flex",
              flexDirection: "column",
              padding: "1rem",
              boxSizing: "border-box",
              zIndex: 10000,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", borderBottom: "1px solid #1e293b", paddingBottom: "0.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.2rem" }}>🗂️</span>
                <span style={{ color: "#c4b5fd", fontWeight: "700", fontSize: "0.9rem" }}>
                  Données CSV (jeu de données original)
                </span>
              </div>
              <button
                onClick={() => setShowHistoricalDrawer(false)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: "1.2rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ color: "#64748b", fontSize: "0.7rem", marginBottom: "0.75rem", lineHeight: 1.4 }}>
              Valeurs issues directement de process_flow_timeseries.csv / machine_health_timeseries.csv,
              indépendamment de ce qui arrive en direct via MQTT/Node-RED.
            </div>

            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.7rem" }}>
              {Object.keys(historicalTags).length === 0 ? (
                <div style={{ color: "#64748b", textAlign: "center", padding: "2rem 0", fontSize: "0.8rem" }}>
                  Aucune donnée historique chargée...
                </div>
              ) : (
                groupTagsForDrawer(historicalTags).map(([groupKey, items]) => {
                  const [equip, context] = groupKey.split(".");
                  return (
                    <div key={groupKey}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: "0.4rem", marginBottom: "0.3rem" }}>
                        <span style={{ color: "#c4b5fd", fontWeight: "800", fontSize: "0.74rem", fontFamily: "monospace" }}>{equip}</span>
                        <span style={{ color: "#64748b", fontWeight: "700", fontSize: "0.64rem", letterSpacing: "0.5px", textTransform: "uppercase" }}>{context}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                        {items.map((item) => {
                          const isGood = item.quality === "Good" || item.quality === "SIM";
                          const param = item.tagId.split(".").slice(2).join(".");
                          return (
                            <div
                              key={item.tagId}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                background: "#1e1b3a",
                                border: "1px solid #4c1d95",
                                borderRadius: "5px",
                                padding: "0.35rem 0.55rem",
                                fontSize: "0.72rem",
                              }}
                            >
                              <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "#a78bfa", fontFamily: "monospace" }}>
                                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: isGood ? "#34d399" : "#f87171", flexShrink: 0 }} />
                                {param}
                              </span>
                              <span style={{ color: "#ddd6fe", fontFamily: "monospace", fontWeight: "700" }}>
                                {typeof item.value === "number" ? item.value.toFixed(2) : item.value} {item.unit}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
