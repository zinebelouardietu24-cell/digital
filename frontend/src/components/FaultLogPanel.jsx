import React, { useEffect, useState } from "react";
import { ListChecks } from "lucide-react";
import { getFaultEvents } from "../api/simulationApi";
import { LEVEL_STYLE } from "./FaultCard";

/** Journal des défauts apparus pendant la simulation, le plus récent en premier. */
export default function FaultLogPanel() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const data = await getFaultEvents();
        if (!cancelled) setEvents(data);
      } catch {
        if (!cancelled) setEvents([]);
      }
    };
    refresh();
    const timer = setInterval(refresh, 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <div style={{ background: "#162032", border: "1px solid #1e293b", borderRadius: "8px", padding: "0.65rem 0.85rem" }}>
      <div style={{ color: "#00f0ff", fontWeight: 800, fontSize: "0.8rem", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.45rem" }}>
        <ListChecks size={15} /> JOURNAL DES DÉFAUTS DÉTECTÉS
      </div>
      {events.length === 0 ? (
        <div style={{ color: "#94a3b8", fontSize: "0.7rem" }}>Aucun défaut détecté depuis le démarrage de la simulation.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", maxHeight: "180px", overflowY: "auto" }}>
          {events.map((e, i) => {
            const style = LEVEL_STYLE[e.level] || LEVEL_STYLE.alerte;
            return (
              <div key={`${e.time}-${e.fault}-${i}`} style={{ display: "flex", gap: "0.6rem", alignItems: "center", fontSize: "0.68rem" }}>
                <span style={{ color: "#94a3b8", whiteSpace: "nowrap" }}>{e.time}</span>
                <span style={{ color: style.color, fontWeight: 800, width: "3.6rem" }}>{style.label}</span>
                <span style={{ color: "#e2e8f0" }}>
                  {e.equipment_name} · {e.fault}
                </span>
                {e.injected && <span style={{ color: "#c4b5fd", fontSize: "0.6rem" }}>(défaut injecté)</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
