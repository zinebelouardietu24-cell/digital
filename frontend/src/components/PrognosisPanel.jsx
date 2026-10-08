import React, { useEffect, useState } from "react";
import { TrendingUp, CheckCircle2, AlertTriangle } from "lucide-react";
import { API_BASE as API } from "../config/api.config.js";

const STATUS = {
  alarm: { label: "SEUIL ATTEINT", color: "#ef4444" },
  plan: { label: "À PLANIFIER", color: "#f97316" },
  watch: { label: "À SURVEILLER", color: "#fbbf24" },
  ok: { label: "OK", color: "#34d399" },
  learning: { label: "APPRENTISSAGE", color: "#94a3b8" },
  stable: { label: "STABLE", color: "#34d399" },
};

const EQUIPMENT_NAMES = { SP_001: "Pompe SP_001", BM_001: "Broyeur BM_001", CY_001: "Hydrocyclones CY_001" };

function formatDate(iso) {
  if (!iso) return "–";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function EquipmentCard({ item }) {
  const status = STATUS[item.status] || STATUS.ok;
  const progress = Math.min(100, Math.max(0, (item.current_level / item.threshold) * 100));

  return (
    <div
      style={{
        background: "#162032",
        border: `1px solid ${item.status === "plan" || item.status === "alarm" ? status.color : "#1e293b"}`,
        borderRadius: "8px",
        padding: "0.7rem 0.85rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.45rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
        <div>
          <div style={{ color: "#e2e8f0", fontWeight: 700, fontSize: "0.82rem" }}>{EQUIPMENT_NAMES[item.equipment_id] || item.equipment_id}</div>
          <div style={{ color: "#94a3b8", fontSize: "0.66rem" }}>{item.indicator}</div>
        </div>
        <span
          style={{
            color: status.color,
            border: `1px solid ${status.color}`,
            borderRadius: "4px",
            padding: "0.1rem 0.4rem",
            fontSize: "0.6rem",
            fontWeight: 800,
            letterSpacing: "0.4px",
            whiteSpace: "nowrap",
          }}
        >
          {status.label}
        </span>
      </div>

      {item.rul_days != null && item.status !== "alarm" ? (
        <div>
          <div style={{ color: "#94a3b8", fontSize: "0.62rem" }}>Durée de vie résiduelle</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.35rem" }}>
            <span style={{ color: status.color, fontSize: "1.5rem", fontWeight: 800, lineHeight: 1.1 }}>
              {item.rul_days.toFixed(1)}
            </span>
            <span style={{ color: "#cbd5e1", fontSize: "0.75rem" }}>jours</span>
            {item.rul_interval_days && (
              <span style={{ color: "#94a3b8", fontSize: "0.65rem" }}>
                [{item.rul_interval_days[0]} – {item.rul_interval_days[1]}]
              </span>
            )}
          </div>
          <div style={{ color: "#cbd5e1", fontSize: "0.68rem" }}>
            Intervention prévue le <b>{formatDate(item.forecast_date)}</b>
          </div>
        </div>
      ) : (
        <div style={{ color: "#94a3b8", fontSize: "0.7rem", minHeight: "2.6rem" }}>
          {item.status === "learning"
            ? `Intervention récente : pronostic disponible après 48 h de données (${item.cycle_hours} h).`
            : item.status === "alarm"
              ? "Le seuil d'alarme est atteint : intervention à programmer."
              : "Pas de tendance de dégradation détectée."}
        </div>
      )}

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.62rem", color: "#94a3b8" }}>
          <span>
            Actuel : <b style={{ color: "#e2e8f0" }}>{item.current_level.toFixed(2)} {item.unit}</b>
          </span>
          <span>
            Seuil : {item.threshold} {item.unit}
          </span>
        </div>
        <div style={{ height: "6px", background: "#0f172a", borderRadius: "3px", marginTop: "0.2rem", overflow: "hidden" }}>
          <div style={{ width: `${progress}%`, height: "100%", background: status.color, transition: "width 0.4s ease" }} />
        </div>
        <div style={{ color: "#64748b", fontSize: "0.58rem", marginTop: "0.15rem" }}>
          {item.threshold_source}
          {item.slope_per_day != null && ` · dégradation ${item.slope_per_day > 0 ? "+" : ""}${item.slope_per_day} ${item.unit}/jour`}
        </div>
      </div>

      {item.interventions && item.interventions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
          <div style={{ color: "#94a3b8", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.4px" }}>
            INTERVENTIONS DÉTECTÉES DANS LES SIGNAUX
          </div>
          {item.interventions.map((iv) => (
            <div key={iv.date} style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.64rem" }}>
              {iv.in_cmms ? <CheckCircle2 size={12} color="#34d399" /> : <AlertTriangle size={12} color="#fbbf24" />}
              <span style={{ color: "#cbd5e1" }}>{formatDate(iv.date)}</span>
              <span style={{ color: iv.in_cmms ? "#94a3b8" : "#fbbf24" }}>
                {iv.in_cmms ? iv.work_orders.join(", ") : "absente de la GMAO"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Remaining-useful-life forecast of the critical equipment, recomputed at the
 * simulation's current time by GET /api/maintenance/prognosis.
 */
export default function PrognosisPanel() {
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const res = await fetch(`${API}/api/maintenance/prognosis`);
        if (res.ok && !cancelled) setData(await res.json());
      } catch {
        if (!cancelled) setData(null);
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
  const bt = data.backtest || {};

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "0.4rem" }}>
        <div style={{ color: "#00f0ff", fontWeight: 800, fontSize: "0.8rem", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <TrendingUp size={15} /> PRONOSTIC · DURÉE DE VIE RÉSIDUELLE (RUL)
        </div>
        <div style={{ color: "#94a3b8", fontSize: "0.64rem" }}>
          Au {data.simulation_time} · validé a posteriori : erreur moyenne {bt.mean_error_h?.["3_days_before"]} h à 3 jours
          ({bt.cycles} cycles, {bt.forecasts?.toLocaleString("fr-FR")} pronostics)
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0.75rem" }}>
        {data.equipments.map((item) => (
          <EquipmentCard key={item.equipment_id} item={item} />
        ))}
      </div>
    </div>
  );
}
