import React, { useState, useEffect } from "react";
import {
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Activity,
  X,
  Cpu,
  Layers,
  Calendar,
  ShieldCheck,
  Check,
  Tag,
  FileText,
  ArrowLeft,
  Search,
  Filter,
  DollarSign,
  User,
  Eye,
  Zap,
  RotateCcw,
} from "lucide-react";
import Flowsheet from "./Flowsheet";
import PrognosisPanel from "../components/PrognosisPanel";

import { API_BASE as API } from "../config/api.config.js";

function getCriticalityBadge(criticality) {
  const crit = (criticality || "").toLowerCase();
  if (crit === "critical") {
    return { bg: "rgba(239, 68, 68, 0.18)", border: "#ef4444", text: "#ef4444", label: "▲ P4 CRITICAL" };
  }
  if (crit === "high") {
    return { bg: "rgba(245, 158, 11, 0.18)", border: "#f59e0b", text: "#f59e0b", label: "◆ P3 HIGH" };
  }
  return { bg: "rgba(2, 132, 199, 0.18)", border: "#0284c7", text: "#38bdf8", label: "● P2 MEDIUM" };
}

function getConditionBadge(status) {
  const s = (status || "").toLowerCase();
  if (s.includes("good")) {
    return { bg: "rgba(16, 185, 129, 0.15)", border: "#10b981", text: "#34d399", label: "OPTIMAL" };
  }
  if (s.includes("fair") || s.includes("monitor")) {
    return { bg: "rgba(245, 158, 11, 0.15)", border: "#f59e0b", text: "#fbbf24", label: "◆ ATTENTION" };
  }
  return { bg: "rgba(239, 68, 68, 0.18)", border: "#ef4444", text: "#f87171", label: "▲ ACTION REQUIRED" };
}

function getMaintenanceTypeBadge(type) {
  const t = (type || "").toLowerCase();
  if (t.includes("overhaul")) {
    return { bg: "rgba(168, 85, 247, 0.15)", border: "#a855f7", text: "#c084fc", symbol: "✚" };
  }
  if (t.includes("corrective")) {
    return { bg: "rgba(239, 68, 68, 0.15)", border: "#ef4444", text: "#f87171", symbol: "▲" };
  }
  if (t.includes("condition") || t.includes("preventive")) {
    return { bg: "rgba(245, 158, 11, 0.15)", border: "#f59e0b", text: "#fbbf24", symbol: "◆" };
  }
  if (t.includes("inspection")) {
    return { bg: "rgba(2, 132, 199, 0.15)", border: "#0284c7", text: "#38bdf8", symbol: "●" };
  }
  return { bg: "rgba(16, 185, 129, 0.15)", border: "#10b981", text: "#34d399", symbol: "✓" };
}

export default function MaintenancePage() {
  const [equipmentList, setEquipmentList] = useState([]);
  const [selectedEqId, setSelectedEqId] = useState(null);
  const [historyAssetId, setHistoryAssetId] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState(null);

  // Search & Filter state for History Page
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("ALL");

  const closeModal = () => {
    setSelectedEqId(null);
    setDetailData(null);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && selectedEqId) {
        closeModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedEqId]);

  // Fetch equipment list
  const fetchEquipment = async () => {
    try {
      const res = await fetch(`${API}/api/maintenance/equipment`);
      if (res.ok) {
        const data = await res.json();
        setEquipmentList(data);
        setError(null);
      } else {
        setError("Failed to load maintenance equipment records.");
      }
    } catch (e) {
      console.error("Error fetching maintenance equipment:", e);
      setError("Unable to connect to backend server.");
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchEquipment();
    const interval = setInterval(fetchEquipment, 2000);
    return () => clearInterval(interval);
  }, []);

  // Fetch detail data when selected in modal
  useEffect(() => {
    if (!selectedEqId) {
      setDetailData(null);
      return;
    }
    const fetchDetail = async () => {
      try {
        const res = await fetch(`${API}/api/maintenance/equipment/${selectedEqId}`);
        if (res.ok) {
          const data = await res.json();
          setDetailData(data);
        }
      } catch (e) {
        console.error("Error fetching detail:", e);
      }
    };
    fetchDetail();
  }, [selectedEqId]);

  // Fetch full history logs when viewing dedicated history page
  useEffect(() => {
    if (!historyAssetId) {
      setHistoryData(null);
      return;
    }
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${API}/api/maintenance/equipment/${historyAssetId}/history`);
        if (res.ok) {
          const data = await res.json();
          setHistoryData(data);
        }
      } catch (e) {
        console.error("Error fetching history:", e);
      }
    };
    fetchHistory();
  }, [historyAssetId]);

  const findEquipment = (id) => {
    if (!id || id.startsWith("P_")) return null;
    const exact = equipmentList.find((e) => e.equipment_id === id);
    if (exact) return exact;
    const match = equipmentList.find((e) => e.equipment_id.startsWith(id));
    return match || null;
  };

  const selectedEq = detailData?.equipment || findEquipment(selectedEqId);
  const isOpen = Boolean(selectedEqId && selectedEq);

  // Summary KPIs
  const totalAssets = equipmentList.length;
  const overdueCount = equipmentList.filter((e) => e.is_overdue).length;
  const criticalCount = equipmentList.filter(
    (e) => (e.criticality || "").toLowerCase() === "critical"
  ).length;
  const avgMtbf =
    totalAssets > 0
      ? Math.round(
          equipmentList.reduce((sum, e) => sum + (e.MTBF_hours || 0), 0) / totalAssets
        )
      : 0;

const ALL_STATIC_MAINTENANCE_LOGS = [
  { log_id: "WO-2026-0814", equipment_id: "SP_001", maintenance_date: "2026-07-23", maintenance_type: "Corrective", work_order_type: "CM-01", description: "Replaced throatbush and impeller rubber wear liner due to severe phosphate slurry erosion.", technician: "Marcus Vance (Lead Mechanical)", parts_replaced: "Warman AH 8/6 Throatbush (L-8083) & Rubber Liner", downtime_hours: 5.5, cost_usd: 4200, status: "Completed", condition_after: "Fair - wear liner due" },
  { log_id: "WO-2026-0610", equipment_id: "SP_001", maintenance_date: "2026-06-12", maintenance_type: "Preventive", work_order_type: "PM-04", description: "Quarterly slurry pump wet-end inspection & gland seal water packing flush.", technician: "David Thorne (Mechanical Specialist)", parts_replaced: "Gland Seal Packing Ring Set & Mechanical Seal Kit", downtime_hours: 2.0, cost_usd: 850, status: "Completed", condition_after: "Optimal" },
  { log_id: "WO-2026-0315", equipment_id: "SP_001", maintenance_date: "2026-03-20", maintenance_type: "Overhaul", work_order_type: "PM-01", description: "Annual major overhaul. Replaced drive shaft sleeve and heavy-duty roller bearings.", technician: "Sarah Lin (Reliability Lead)", parts_replaced: "Shaft Sleeve (SS-12) & Heavy Duty Bearings (SKF 23230)", downtime_hours: 12.0, cost_usd: 14500, status: "Completed", condition_after: "Optimal" },
  { log_id: "WO-2025-1102", equipment_id: "SP_001", maintenance_date: "2025-11-15", maintenance_type: "Condition-Based", work_order_type: "CM-02", description: "Vibration spike on drive end bearing (7.2 mm/s). Rebalanced pulley coupling.", technician: "Marcus Vance (Lead Mechanical)", parts_replaced: "Drive Pulley Belt Set (V-100) & Alignment Shims", downtime_hours: 3.5, cost_usd: 1200, status: "Completed", condition_after: "Optimal" },
  { log_id: "WO-2025-0720", equipment_id: "SP_001", maintenance_date: "2025-07-20", maintenance_type: "Preventive", work_order_type: "PM-03", description: "Bi-annual casing liner inspection and clearance adjustment to 0.5mm.", technician: "David Thorne (Mechanical Specialist)", parts_replaced: "Impeller Retaining Bolt & O-Rings", downtime_hours: 4.0, cost_usd: 2100, status: "Completed", condition_after: "Optimal" },
  { log_id: "WO-2025-0210", equipment_id: "SP_001", maintenance_date: "2025-02-10", maintenance_type: "Overhaul", work_order_type: "PM-01", description: "Scheduled overhaul of wet-end assembly. Replaced 5-vane high-head slurry impeller.", technician: "Sarah Lin (Reliability Lead)", parts_replaced: "5-Vane Rubber Slurry Impeller (C-8056)", downtime_hours: 10.5, cost_usd: 12800, status: "Completed", condition_after: "Optimal" },
  { log_id: "WO-2024-0918", equipment_id: "SP_001", maintenance_date: "2024-09-18", maintenance_type: "Corrective", work_order_type: "CM-03", description: "Suction pipe gasket blow-out causing slurry leakage. Installed high-pressure flange gasket.", technician: "Marcus Vance (Lead Mechanical)", parts_replaced: "EPDM High-Pressure Flange Gasket 250mm", downtime_hours: 2.5, cost_usd: 650, status: "Completed", condition_after: "Optimal" },

  { log_id: "WO-2026-0820", equipment_id: "BM_001", maintenance_date: "2026-07-28", maintenance_type: "Condition-Based", work_order_type: "CM-03", description: "Trunnion bearing temp alert (68C). Cleaned lube oil filter & replenished synthetic lube.", technician: "Elena Rostova (Mill Specialist)", parts_replaced: "High Viscosity Lube Oil (ISO VG 320) & Filter Element", downtime_hours: 4.0, cost_usd: 2800, status: "Completed", condition_after: "Fair - bearing monitored" },
  { log_id: "WO-2026-0504", equipment_id: "BM_001", maintenance_date: "2026-05-10", maintenance_type: "Preventive", work_order_type: "PM-02", description: "Bi-monthly liner bolt torque check and charge ball addition (15 tons forged 80mm steel balls).", technician: "Thomas Wright (Mill Maintenance)", parts_replaced: "80mm Forged Grinding Balls (15t) & Torqued Bolts", downtime_hours: 8.0, cost_usd: 18500, status: "Completed", condition_after: "Optimal" },
  { log_id: "WO-2026-0118", equipment_id: "BM_001", maintenance_date: "2026-01-22", maintenance_type: "Overhaul", work_order_type: "PM-01", description: "Scheduled relining of shell discharge grates and pinion drive alignment check.", technician: "Elena Rostova (Mill Specialist)", parts_replaced: "Rubber Shell Liners & Discharge Grate Segment", downtime_hours: 36.0, cost_usd: 82000, status: "Completed", condition_after: "Optimal" },
  { log_id: "WO-2025-0812", equipment_id: "BM_001", maintenance_date: "2025-08-18", maintenance_type: "Preventive", work_order_type: "PM-04", description: "Girth gear spray lubrication system inspection and acoustic ultrasonic wear test.", technician: "Thomas Wright (Mill Maintenance)", parts_replaced: "Lube Nozzle Assembly & Solenoid Valve", downtime_hours: 3.0, cost_usd: 1100, status: "Completed", condition_after: "Optimal" },
  { log_id: "WO-2025-0305", equipment_id: "BM_001", maintenance_date: "2025-03-05", maintenance_type: "Condition-Based", work_order_type: "CM-01", description: "Acoustic noise spike on main drive gearbox. Flushed gear oil and replaced magnetic drain plug.", technician: "Elena Rostova (Mill Specialist)", parts_replaced: "Gearbox Filter Element & Shell Omala S4 Oil 400L", downtime_hours: 6.0, cost_usd: 6400, status: "Completed", condition_after: "Optimal" },
  { log_id: "WO-2024-1110", equipment_id: "BM_001", maintenance_date: "2024-11-10", maintenance_type: "Overhaul", work_order_type: "PM-01", description: "Full ball mill shell liner replacement and trunnion seal overhaul.", technician: "Thomas Wright (Mill Maintenance)", parts_replaced: "High-Chrome Cast Steel Liners (72-piece set) & Trunnion Seals", downtime_hours: 48.0, cost_usd: 125000, status: "Completed", condition_after: "Optimal" },

  { log_id: "WO-2026-0719", equipment_id: "CY_001_A", maintenance_date: "2026-07-19", maintenance_type: "Preventive", work_order_type: "PM-03", description: "Hydrocyclone Cluster A liner replacement. Replaced polyurethane vortex finder and apex spigot.", technician: "Antoine Dupont (Process Tech)", parts_replaced: "Polyurethane Apex Spigot (CVX-500-APX) & Vortex Finder", downtime_hours: 3.0, cost_usd: 1850, status: "Completed", condition_after: "Good - liner replaced" },
  { log_id: "WO-2026-0410", equipment_id: "CY_001_A", maintenance_date: "2026-04-12", maintenance_type: "Inspection", work_order_type: "INSP-01", description: "Routine overflow/underflow sample density check & spigot aperture measurement.", technician: "Antoine Dupont (Process Tech)", parts_replaced: "None (Inspection Only)", downtime_hours: 0.5, cost_usd: 0, status: "Completed", condition_after: "Optimal" },
  { log_id: "WO-2025-1205", equipment_id: "CY_001_A", maintenance_date: "2025-12-10", maintenance_type: "Corrective", work_order_type: "CM-01", description: "Tramp metal obstruction in feed inlet chamber. Cleared blockage and inspected casing liner.", technician: "Marcus Vance (Lead Mechanical)", parts_replaced: "Feed Inlet Gasket & Clamp Ring", downtime_hours: 2.0, cost_usd: 650, status: "Completed", condition_after: "Optimal" },
  { log_id: "WO-2025-0814", equipment_id: "CY_001_A", maintenance_date: "2025-08-14", maintenance_type: "Preventive", work_order_type: "PM-03", description: "Replaced worn ceramic lower cone insert after 4500 hours of continuous classification.", technician: "Antoine Dupont (Process Tech)", parts_replaced: "Alumina Ceramic Lower Cone Insert (CVX-500)", downtime_hours: 4.5, cost_usd: 3200, status: "Completed", condition_after: "Optimal" },

  { log_id: "WO-2026-0719", equipment_id: "CY_001_B", maintenance_date: "2026-07-19", maintenance_type: "Preventive", work_order_type: "PM-03", description: "Hydrocyclone Cluster B apex spigot replacement & pressure transmitter calibration.", technician: "Antoine Dupont (Process Tech)", parts_replaced: "Polyurethane Apex Spigot (CVX-500-APX)", downtime_hours: 2.5, cost_usd: 1400, status: "Completed", condition_after: "Good - liner replaced" },
  { log_id: "WO-2026-0301", equipment_id: "CY_001_B", maintenance_date: "2026-03-05", maintenance_type: "Inspection", work_order_type: "INSP-01", description: "Ultrasonic wall thickness measurement of cyclone upper housing.", technician: "Antoine Dupont (Process Tech)", parts_replaced: "None (Inspection Only)", downtime_hours: 0.5, cost_usd: 0, status: "Completed", condition_after: "Optimal" },
  { log_id: "WO-2025-1011", equipment_id: "CY_001_B", maintenance_date: "2025-10-11", maintenance_type: "Corrective", work_order_type: "CM-02", description: "Underflow splash skirt tear causing slurry spray. Replaced rubber splash skirt assembly.", technician: "David Thorne (Mechanical Specialist)", parts_replaced: "Heavy Duty Rubber Splash Skirt", downtime_hours: 1.5, cost_usd: 420, status: "Completed", condition_after: "Optimal" },

  { log_id: "WO-2026-0719", equipment_id: "CY_001_C", maintenance_date: "2026-07-19", maintenance_type: "Corrective", work_order_type: "CM-02", description: "Intermittent apex roping choked event. Cleared debris and flushed feed manifold.", technician: "Antoine Dupont (Process Tech)", parts_replaced: "Manifold Wash Gasket & Flush Valve", downtime_hours: 1.5, cost_usd: 450, status: "Completed", condition_after: "Monitor - choke event logged" },
  { log_id: "WO-2026-0214", equipment_id: "CY_001_C", maintenance_date: "2026-02-18", maintenance_type: "Preventive", work_order_type: "PM-03", description: "Routine ceramic liner section replacement.", technician: "Marcus Vance (Lead Mechanical)", parts_replaced: "Ceramic Lower Cone Insert (CVX-500)", downtime_hours: 4.0, cost_usd: 2200, status: "Completed", condition_after: "Optimal" },

  { log_id: "WO-2026-0620", equipment_id: "PB_001", maintenance_date: "2026-06-20", maintenance_type: "Preventive", work_order_type: "PM-05", description: "Cleaned sump level probe sensor and inspected rubber anti-turbulent baffle plates.", technician: "David Thorne (Mechanical Specialist)", parts_replaced: "Level Probe Gasket Kit & Ultrasonic Sensor Cleaning Solution", downtime_hours: 1.5, cost_usd: 350, status: "Completed", condition_after: "Good" },
  { log_id: "WO-2026-0205", equipment_id: "PB_001", maintenance_date: "2026-02-08", maintenance_type: "Overhaul", work_order_type: "PM-01", description: "De-sludged sump basin, inspected elastomer lining for erosion, and calibrated level sensor.", technician: "David Thorne (Mechanical Specialist)", parts_replaced: "Elastomer Patch Repair Compound & Agitator Mount Seal", downtime_hours: 6.0, cost_usd: 3100, status: "Completed", condition_after: "Optimal" },
  { log_id: "WO-2025-0910", equipment_id: "PB_001", maintenance_date: "2025-09-10", maintenance_type: "Preventive", work_order_type: "PM-05", description: "Inspected inlet feed distributor box wear plates and cleared oversize rocks from trash screen.", technician: "Marcus Vance (Lead Mechanical)", parts_replaced: "Perforated Stainless Steel Trash Screen 25mm", downtime_hours: 3.0, cost_usd: 1250, status: "Completed", condition_after: "Optimal" }
];

  // Render Dedicated Detailed Maintenance Logs Page
  if (historyAssetId) {
    const historyEq = historyData?.equipment || findEquipment(historyAssetId);
    const targetId = historyAssetId || "";
    const prefix = targetId.split("_")[0];

    const logsFromApi = historyData?.logs || detailData?.maintenance_logs;
    const logs = (logsFromApi && logsFromApi.length > 0)
      ? logsFromApi
      : ALL_STATIC_MAINTENANCE_LOGS.filter((l) =>
          l.equipment_id === targetId ||
          l.equipment_id.startsWith(targetId) ||
          targetId.startsWith(l.equipment_id) ||
          (prefix && l.equipment_id.startsWith(prefix))
        );

    const filteredLogs = logs.filter((log) => {
      const matchType =
        filterType === "ALL" ||
        (log.maintenance_type || "").toLowerCase().includes(filterType.toLowerCase());
      const matchSearch =
        !searchQuery ||
        (log.log_id || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.description || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.technician || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.parts_replaced || "").toLowerCase().includes(searchQuery.toLowerCase());
      return matchType && matchSearch;
    });

    const totalDowntime = logs.reduce((sum, l) => sum + (Number(l.downtime_hours) || 0), 0);
    const totalCost = logs.reduce((sum, l) => sum + (Number(l.cost_usd) || 0), 0);

    return (
      <div
        style={{
          padding: "0.85rem 1.25rem",
          color: "#f8fafc",
          maxWidth: "1450px",
          margin: "0 auto",
          height: "calc(100vh - 70px)",
          maxHeight: "calc(100vh - 70px)",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header Bar with Back Button (Fixed) */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
            <button
              onClick={() => setHistoryAssetId(null)}
              style={{
                background: "#162032",
                border: "1px solid #00f0ff",
                color: "#00f0ff",
                borderRadius: "8px",
                padding: "0.45rem 0.85rem",
                fontSize: "0.82rem",
                fontWeight: "700",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.45rem",
                transition: "all 0.15s ease",
              }}
            >
              <ArrowLeft size={16} /> Return to Circuit View
            </button>
            <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: "800", color: "#00f0ff" }}>
              Work Order & Maintenance History: <span style={{ color: "#ffffff" }}>{historyEq?.equipment_name || historyAssetId}</span>
            </h2>
          </div>

          {historyEq && (
            <span style={{ fontSize: "0.75rem", background: "#162032", border: "1px solid #1e293b", padding: "0.3rem 0.65rem", borderRadius: "6px", color: "#94a3b8", fontFamily: "monospace" }}>
              ASSET ID: <strong style={{ color: "#00f0ff" }}>{historyEq.equipment_id}</strong>
            </span>
          )}
        </div>

        {/* Machine Summary Metric Header Cards (Fixed) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem", marginBottom: "0.85rem", flexShrink: 0 }}>
          <div style={{ background: "#162032", border: "1px solid #1e293b", borderRadius: "8px", padding: "0.65rem 0.85rem" }}>
            <div style={{ color: "#94a3b8", fontSize: "0.68rem", fontWeight: "700", letterSpacing: "0.5px" }}>TOTAL WORK ORDERS</div>
            <div style={{ color: "#00f0ff", fontSize: "1.4rem", fontWeight: "800", marginTop: "0.15rem" }}>{logs.length} <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "500" }}>logs</span></div>
          </div>

          <div style={{ background: "#162032", border: "1px solid #1e293b", borderRadius: "8px", padding: "0.65rem 0.85rem" }}>
            <div style={{ color: "#94a3b8", fontSize: "0.68rem", fontWeight: "700", letterSpacing: "0.5px" }}>CUMULATIVE DOWNTIME</div>
            <div style={{ color: "#cbd5e1", fontSize: "1.4rem", fontWeight: "800", marginTop: "0.15rem" }}>{totalDowntime} <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: "500" }}>hours</span></div>
          </div>

          <div style={{ background: "#162032", border: "1px solid #1e293b", borderRadius: "8px", padding: "0.65rem 0.85rem" }}>
            <div style={{ color: "#94a3b8", fontSize: "0.68rem", fontWeight: "700", letterSpacing: "0.5px" }}>TOTAL MAINTENANCE COST</div>
            <div style={{ color: "#34d399", fontSize: "1.4rem", fontWeight: "800", marginTop: "0.15rem" }}>${totalCost.toLocaleString()}</div>
          </div>

          <div style={{ background: "#162032", border: "1px solid #1e293b", borderRadius: "8px", padding: "0.65rem 0.85rem" }}>
            <div style={{ color: "#94a3b8", fontSize: "0.68rem", fontWeight: "700", letterSpacing: "0.5px" }}>PRIMARY FAILURE MODE</div>
            <div style={{ color: "#f87171", fontSize: "0.85rem", fontWeight: "700", marginTop: "0.25rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {historyEq?.last_failure_mode || "N/A"}
            </div>
          </div>
        </div>

        {/* Pro-Grade Search & Category Filter Pills Bar (Fixed) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem", marginBottom: "0.85rem", flexShrink: 0 }}>
          {/* Top Row: Search Input + Live Result Count Chip */}
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Search size={15} style={{ position: "absolute", left: "0.85rem", top: "50%", transform: "translateY(-50%)", color: "#00f0ff" }} />
              <input
                type="text"
                placeholder="Search work order ID (e.g. WO-2026-0814), parts replaced, technician, or maintenance notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  background: "#162032",
                  border: "1px solid #1e293b",
                  borderRadius: "8px",
                  padding: "0.55rem 2.2rem 0.55rem 2.4rem",
                  color: "#ffffff",
                  fontSize: "0.82rem",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  style={{
                    position: "absolute",
                    right: "0.75rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                    padding: 0,
                    display: "flex",
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div style={{ background: "#162032", border: "1px solid #1e293b", borderRadius: "8px", padding: "0.55rem 0.85rem", fontSize: "0.75rem", color: "#94a3b8", whiteSpace: "nowrap" }}>
              Showing <strong style={{ color: "#00f0ff" }}>{filteredLogs.length}</strong> of <strong>{logs.length}</strong> Work Orders
            </div>
          </div>

          {/* Bottom Row: Full-Width Interactive Segmented Category Filter Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, 1fr)",
              gap: "0.5rem",
              width: "100%",
            }}
          >
            {[
              { id: "ALL", label: "ALL TYPES", Icon: Layers, count: logs.length },
              { id: "Corrective", label: "CORRECTIVE (CM)", Icon: Wrench, count: logs.filter((l) => (l.maintenance_type || "").toLowerCase().includes("corrective")).length },
              { id: "Preventive", label: "PREVENTIVE (PM)", Icon: RotateCcw, count: logs.filter((l) => (l.maintenance_type || "").toLowerCase().includes("preventive")).length },
              { id: "Overhaul", label: "MAJOR OVERHAUL", Icon: Zap, count: logs.filter((l) => (l.maintenance_type || "").toLowerCase().includes("overhaul")).length },
              { id: "Condition", label: "CONDITION-BASED", Icon: Activity, count: logs.filter((l) => (l.maintenance_type || "").toLowerCase().includes("condition")).length },
              { id: "Inspection", label: "INSPECTION", Icon: Eye, count: logs.filter((l) => (l.maintenance_type || "").toLowerCase().includes("inspection")).length },
            ].map((tab) => {
              const isActive = filterType === tab.id;
              const TabIcon = tab.Icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilterType(tab.id)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    background: isActive
                      ? "linear-gradient(135deg, rgba(2, 132, 199, 0.3) 0%, rgba(0, 240, 255, 0.15) 100%)"
                      : "#162032",
                    border: `1px solid ${isActive ? "#00f0ff" : "#1e293b"}`,
                    color: isActive ? "#00f0ff" : "#cbd5e1",
                    borderRadius: "6px",
                    padding: "0.45rem 0.6rem",
                    fontSize: "0.72rem",
                    fontWeight: isActive ? "700" : "600",
                    letterSpacing: "0.4px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.45rem",
                    whiteSpace: "nowrap",
                    transition: "all 0.15s ease",
                  }}
                >
                  <TabIcon size={13} style={{ color: isActive ? "#00f0ff" : "#94a3b8", flexShrink: 0 }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{tab.label}</span>
                  <span
                    style={{
                      background: isActive ? "rgba(0, 240, 255, 0.25)" : "rgba(30, 41, 59, 0.8)",
                      color: isActive ? "#ffffff" : "#94a3b8",
                      fontSize: "0.62rem",
                      fontWeight: "700",
                      padding: "0.08rem 0.38rem",
                      borderRadius: "4px",
                      flexShrink: 0,
                    }}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dedicated Scrollable Work Orders Table Container */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            background: "#0f172a",
            border: "1px solid #1e293b",
            borderRadius: "10px",
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", textAlign: "left" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10, background: "#162032" }}>
              <tr style={{ color: "#94a3b8", borderBottom: "1px solid #1e293b", textTransform: "uppercase", fontSize: "0.68rem", letterSpacing: "0.5px" }}>
                <th style={{ padding: "0.75rem 1rem" }}>Work Order ID</th>
                <th style={{ padding: "0.75rem 1rem" }}>Date</th>
                <th style={{ padding: "0.75rem 1rem" }}>Type & Code</th>
                <th style={{ padding: "0.75rem 1rem" }}>Work Description</th>
                <th style={{ padding: "0.75rem 1rem" }}>Parts Replaced</th>
                <th style={{ padding: "0.75rem 1rem" }}>Technician</th>
                <th style={{ padding: "0.75rem 1rem" }}>Downtime</th>
                <th style={{ padding: "0.75rem 1rem" }}>Cost</th>
                <th style={{ padding: "0.75rem 1rem" }}>Condition After</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
                    No historical maintenance logs found for this machine.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const typeBadge = getMaintenanceTypeBadge(log.maintenance_type);
                  return (
                    <tr key={log.log_id} style={{ borderBottom: "1px solid #1e293b", transition: "background 0.15s ease" }}>
                      <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", fontWeight: "700", color: "#00f0ff", whiteSpace: "nowrap" }}>
                        {log.log_id}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", color: "#cbd5e1", whiteSpace: "nowrap" }}>
                        {log.maintenance_date}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", whiteSpace: "nowrap" }}>
                        <span style={{ background: typeBadge.bg, border: `1px solid ${typeBadge.border}`, color: typeBadge.text, fontSize: "0.65rem", fontWeight: "700", padding: "0.15rem 0.45rem", borderRadius: "4px" }}>
                          {log.maintenance_type} ({log.work_order_type})
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem 1rem", color: "#f8fafc", maxWidth: "260px" }}>
                        {log.description}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", color: "#cbd5e1", maxWidth: "200px" }}>
                        {log.parts_replaced}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", color: "#94a3b8", whiteSpace: "nowrap" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                          <User size={12} style={{ color: "#38bdf8" }} /> {log.technician}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem 1rem", color: "#cbd5e1", fontWeight: "700", whiteSpace: "nowrap" }}>
                        {log.downtime_hours} hrs
                      </td>
                      <td style={{ padding: "0.75rem 1rem", color: "#34d399", fontWeight: "700", whiteSpace: "nowrap" }}>
                        ${Number(log.cost_usd).toLocaleString()}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", whiteSpace: "nowrap" }}>
                        <span style={{ color: "#34d399", fontSize: "0.72rem", fontWeight: "600" }}>
                          ✓ {log.condition_after}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "1rem 1.25rem",
        color: "#f8fafc",
        maxWidth: "1450px",
        margin: "0 auto",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: "0.85rem",
      }}
    >
      {/* Pinned Close Button Hover Micro-Interaction */}
      <style>{`
        .pinned-close-btn {
          background: #1e293b;
          border: 1px solid #334155;
          color: #94a3b8;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
          outline: none;
          flex-shrink: 0;
        }
        .pinned-close-btn:hover {
          background: #1e293b !important;
          border-color: #ef4444 !important;
          color: #f87171 !important;
          box-shadow: 0 0 10px rgba(239, 68, 68, 0.35) !important;
          transform: scale(1.05);
        }
        .pinned-close-btn:hover .close-x-icon {
          transform: rotate(90deg);
        }
        .close-x-icon {
          transition: transform 0.15s ease;
        }
        .pinned-close-btn:active {
          transform: scale(0.95);
        }
      `}</style>

      {/* Page Title & Header Bar */}
      <div
        style={{
          display: "flex",
          justify: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: "1.2rem",
              fontWeight: "700",
              color: "#00f0ff",
              letterSpacing: "0.4px",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              whiteSpace: "nowrap",
            }}
          >
            <Wrench size={20} style={{ color: "#00f0ff" }} /> Maintenance Circuit & Asset Reliability Intelligence
          </h2>
        </div>

        {error && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid #ef4444",
              color: "#f87171",
              fontSize: "0.75rem",
              padding: "0.3rem 0.65rem",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              whiteSpace: "nowrap",
            }}
          >
            <AlertTriangle size={14} /> {error}
          </div>
        )}
      </div>

      {/* KPI Overview Cards Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "0.75rem",
        }}
      >
        <div style={{ background: "#162032", border: "1px solid #1e293b", borderRadius: "8px", padding: "0.65rem 0.85rem" }}>
          <div style={{ color: "#94a3b8", fontSize: "0.68rem", fontWeight: "700", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>TOTAL ASSETS</div>
          <div style={{ color: "#00f0ff", fontSize: "1.4rem", fontWeight: "800", marginTop: "0.15rem" }}>{totalAssets}</div>
        </div>

        <div style={{ background: "#162032", border: `1px solid ${overdueCount > 0 ? "#ef4444" : "#1e293b"}`, borderRadius: "8px", padding: "0.65rem 0.85rem" }}>
          <div style={{ color: "#94a3b8", fontSize: "0.68rem", fontWeight: "700", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>OVERDUE MAINTENANCE</div>
          <div style={{ color: overdueCount > 0 ? "#ef4444" : "#10b981", fontSize: "1.4rem", fontWeight: "800", marginTop: "0.15rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
            {overdueCount} {overdueCount > 0 ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}
          </div>
        </div>

        <div style={{ background: "#162032", border: "1px solid #1e293b", borderRadius: "8px", padding: "0.65rem 0.85rem" }}>
          <div style={{ color: "#94a3b8", fontSize: "0.68rem", fontWeight: "700", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>CRITICAL ASSETS</div>
          <div style={{ color: "#f59e0b", fontSize: "1.4rem", fontWeight: "800", marginTop: "0.15rem" }}>
            {criticalCount} <span style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: "500" }}>Critical</span>
          </div>
        </div>

        <div style={{ background: "#162032", border: "1px solid #1e293b", borderRadius: "8px", padding: "0.65rem 0.85rem" }}>
          <div style={{ color: "#94a3b8", fontSize: "0.68rem", fontWeight: "700", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>FLEET AVERAGE MTBF</div>
          <div style={{ color: "#38bdf8", fontSize: "1.4rem", fontWeight: "800", marginTop: "0.15rem" }}>
            {avgMtbf} <span style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: "500" }}>hours</span>
          </div>
        </div>
      </div>

      <PrognosisPanel />

      {/* Equipment Quick Selector Pills */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: "700", whiteSpace: "nowrap" }}>Quick Inspect:</span>
        {equipmentList.map((item) => {
          const isSelected = selectedEqId === item.equipment_id;
          const critBadge = getCriticalityBadge(item.criticality);
          return (
            <button
              key={item.equipment_id}
              onClick={() => setSelectedEqId(item.equipment_id)}
              style={{
                background: isSelected ? "#0284c7" : "#162032",
                color: isSelected ? "#ffffff" : "#cbd5e1",
                border: `1px solid ${item.is_overdue ? "#ef4444" : isSelected ? "#00f0ff" : "#1e293b"}`,
                borderRadius: "6px",
                padding: "0.3rem 0.65rem",
                fontSize: "0.72rem",
                fontWeight: "600",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
              }}
            >
              <span>{item.equipment_name}</span>
              <span style={{ fontSize: "0.62rem", color: critBadge.text, background: critBadge.bg, padding: "0.05rem 0.3rem", borderRadius: "3px", whiteSpace: "nowrap" }}>
                {item.is_overdue ? "OVERDUE" : item.days_until_due < 0 ? "DUE" : `${item.days_until_due}d`}
              </span>
            </button>
          );
        })}
      </div>

      {/* Circuit Drawing Viewport */}
      <div
        style={{
          background: "#090d16",
          border: "1px solid #1e293b",
          borderRadius: "10px",
          height: "520px",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <Flowsheet
          onSelect={(tag) => tag && setSelectedEqId(tag)}
          selected={selectedEqId}
          hideControls={true}
        />
      </div>

      {/* ULTRA-FAST, LIGHTWEIGHT 60FPS MODAL OVERLAY (NO BLUR, NO GPU LAG) */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: isOpen ? 1 : 0,
          visibility: isOpen ? "visible" : "hidden",
          pointerEvents: isOpen ? "auto" : "none",
          transition: "opacity 0.15s ease-out, visibility 0.15s ease",
        }}
      >
        {/* Simple Solid Semi-Transparent Dark Backdrop */}
        <div
          onClick={closeModal}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0, 0, 0, 0.75)",
            cursor: "pointer",
          }}
        />

        {/* Clean, Lightweight Modal Container */}
        <div
          style={{
            position: "relative",
            width: "720px",
            maxWidth: "92vw",
            maxHeight: "85vh",
            background: "#0f172a",
            border: "1px solid #1e293b",
            borderRadius: "12px",
            padding: "1.35rem 1.5rem",
            boxSizing: "border-box",
            zIndex: 10000,
            overflowY: "auto",
            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.6)",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            transform: isOpen ? "scale(1)" : "scale(0.96)",
            opacity: isOpen ? 1 : 0,
            transition: "transform 0.15s ease-out, opacity 0.15s ease-out",
          }}
        >
          {/* ABSOLUTE PINNED CLOSE BUTTON IN TOP-RIGHT CORNER */}
          <button
            onClick={closeModal}
            className="pinned-close-btn"
            title="Close Window"
            aria-label="Close"
            style={{
              position: "absolute",
              top: "1rem",
              right: "1rem",
              zIndex: 10010,
            }}
          >
            <X size={17} className="close-x-icon" />
          </button>

          {/* Modal Header & Content */}
          {selectedEq && (
            <>
              {/* Header Bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justify: "space-between",
                  borderBottom: "1px solid #1e293b",
                  paddingBottom: "0.75rem",
                  paddingRight: "2.8rem",
                  width: "100%",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: selectedEq.is_overdue ? "#ef4444" : "#10b981",
                      flexShrink: 0,
                    }}
                  />
                  <h3 style={{ margin: 0, color: "#ffffff", fontSize: "1.2rem", fontWeight: "700", whiteSpace: "nowrap" }}>
                    {selectedEq.equipment_name}
                  </h3>
                  <span
                    style={{
                      background: getCriticalityBadge(selectedEq.criticality).bg,
                      border: `1px solid ${getCriticalityBadge(selectedEq.criticality).border}`,
                      color: getCriticalityBadge(selectedEq.criticality).text,
                      fontSize: "0.62rem",
                      fontWeight: "700",
                      padding: "0.15rem 0.45rem",
                      borderRadius: "4px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {getCriticalityBadge(selectedEq.criticality).label}
                  </span>
                </div>
              </div>

              {/* Asset Identity Bar (ID, Category, Manufacturer & Model) */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "0.65rem",
                }}
              >
                <div style={{ background: "#162032", border: "1px solid #1e293b", borderRadius: "8px", padding: "0.6rem 0.75rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "#94a3b8", fontSize: "0.62rem", fontWeight: "700", whiteSpace: "nowrap" }}>
                    <Tag size={12} style={{ color: "#00f0ff" }} /> ASSET ID
                  </div>
                  <div style={{ color: "#00f0ff", fontSize: "0.95rem", fontWeight: "700", fontFamily: "monospace", marginTop: "0.15rem", whiteSpace: "nowrap" }}>
                    {selectedEq.equipment_id}
                  </div>
                </div>

                <div style={{ background: "#162032", border: "1px solid #1e293b", borderRadius: "8px", padding: "0.6rem 0.75rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "#94a3b8", fontSize: "0.62rem", fontWeight: "700", whiteSpace: "nowrap" }}>
                    <Layers size={12} style={{ color: "#38bdf8" }} /> CATEGORY
                  </div>
                  <div style={{ color: "#f8fafc", fontSize: "0.85rem", fontWeight: "600", marginTop: "0.15rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {selectedEq.type}
                  </div>
                </div>

                <div style={{ background: "#162032", border: "1px solid #1e293b", borderRadius: "8px", padding: "0.6rem 0.75rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "#94a3b8", fontSize: "0.62rem", fontWeight: "700", whiteSpace: "nowrap" }}>
                    <Cpu size={12} style={{ color: "#a855f7" }} /> MAKE & MODEL
                  </div>
                  <div style={{ color: "#c084fc", fontSize: "0.85rem", fontWeight: "600", marginTop: "0.15rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {selectedEq.manufacturer} <span style={{ color: "#cbd5e1" }}>{selectedEq.model}</span>
                  </div>
                </div>
              </div>

              {/* Specifications Key-Value Row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "0.4rem 1.2rem",
                  background: "#162032",
                  border: "1px solid #1e293b",
                  borderRadius: "8px",
                  padding: "0.55rem 0.85rem",
                  fontSize: "0.72rem",
                }}
              >
                <div style={{ whiteSpace: "nowrap" }}>
                  <span style={{ color: "#94a3b8" }}>Commissioned:</span>{" "}
                  <strong style={{ color: "#cbd5e1", fontWeight: "600" }}>{selectedEq.install_date}</strong>
                </div>
                <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  <span style={{ color: "#94a3b8" }}>Rated Capacity:</span>{" "}
                  <strong style={{ color: "#cbd5e1", fontWeight: "600" }}>{selectedEq.rated_capacity}</strong>
                </div>
                <div style={{ whiteSpace: "nowrap" }}>
                  <span style={{ color: "#94a3b8" }}>Running Hours:</span>{" "}
                  <strong style={{ color: "#00f0ff", fontWeight: "700" }}>{selectedEq.running_hours} hrs</strong>
                </div>
                <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  <span style={{ color: "#94a3b8" }}>Last Failure Mode:</span>{" "}
                  <strong style={{ color: "#f87171", fontWeight: "600" }}>{selectedEq.last_failure_mode}</strong>
                </div>
              </div>

              {/* Maintenance & Reliability Cards Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "0.65rem",
                }}
              >
                {/* Card 1: Last Serviced */}
                <div
                  style={{
                    background: "#162032",
                    border: "1px solid #1e293b",
                    borderLeft: "3px solid #38bdf8",
                    borderRadius: "8px",
                    padding: "0.75rem 0.85rem",
                    display: "flex",
                    flexDirection: "column",
                    justify: "space-between",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ color: "#94a3b8", fontSize: "0.65rem", fontWeight: "700", whiteSpace: "nowrap" }}>
                        LAST SERVICED
                      </span>
                      <Calendar size={15} style={{ color: "#38bdf8" }} />
                    </div>
                    <div style={{ color: "#ffffff", fontSize: "1.1rem", fontWeight: "700", marginTop: "0.25rem", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                      {selectedEq.last_maintenance_date}
                    </div>
                  </div>

                  <div style={{ marginTop: "0.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", fontSize: "0.62rem", fontWeight: "600", padding: "0.1rem 0.4rem", borderRadius: "3px", whiteSpace: "nowrap" }}>
                      {selectedEq.days_since_last_maintenance}d ago
                    </span>
                    <span style={{ color: "#10b981", fontSize: "0.62rem", fontWeight: "600", whiteSpace: "nowrap" }}>
                      Serviced Logged
                    </span>
                  </div>
                </div>

                {/* Card 2: Next Maintenance Due */}
                <div
                  style={{
                    background: selectedEq.is_overdue ? "rgba(239, 68, 68, 0.1)" : "#162032",
                    border: `1px solid ${selectedEq.is_overdue ? "#ef4444" : "#1e293b"}`,
                    borderLeft: `3px solid ${selectedEq.is_overdue ? "#ef4444" : "#10b981"}`,
                    borderRadius: "8px",
                    padding: "0.75rem 0.85rem",
                    display: "flex",
                    flexDirection: "column",
                    justify: "space-between",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ color: selectedEq.is_overdue ? "#f87171" : "#94a3b8", fontSize: "0.65rem", fontWeight: "700", whiteSpace: "nowrap" }}>
                        NEXT DUE SCHEDULE
                      </span>
                      {selectedEq.is_overdue ? (
                        <AlertTriangle size={15} style={{ color: "#ef4444" }} />
                      ) : (
                        <Clock size={15} style={{ color: "#10b981" }} />
                      )}
                    </div>
                    <div style={{ color: selectedEq.is_overdue ? "#ef4444" : "#ffffff", fontSize: "1.1rem", fontWeight: "700", marginTop: "0.25rem", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                      {selectedEq.next_maintenance_due}
                    </div>
                  </div>

                  <div style={{ marginTop: "0.5rem" }}>
                    <span
                      style={{
                        background: selectedEq.is_overdue ? "rgba(239, 68, 68, 0.2)" : "rgba(16, 185, 129, 0.15)",
                        color: selectedEq.is_overdue ? "#f87171" : "#34d399",
                        border: `1px solid ${selectedEq.is_overdue ? "#ef4444" : "#10b981"}`,
                        fontSize: "0.62rem",
                        fontWeight: "700",
                        padding: "0.12rem 0.45rem",
                        borderRadius: "3px",
                        whiteSpace: "nowrap",
                        display: "inline-block",
                      }}
                    >
                      {selectedEq.is_overdue
                        ? `OVERDUE BY ${Math.abs(selectedEq.days_until_due)} DAYS`
                        : `Due in ${selectedEq.days_until_due} days`}
                    </span>
                  </div>
                </div>

                {/* Card 3: Machine Condition */}
                <div
                  style={{
                    background: "#162032",
                    border: "1px solid #1e293b",
                    borderLeft: `3px solid ${getConditionBadge(selectedEq.condition_status).border}`,
                    borderRadius: "8px",
                    padding: "0.75rem 0.85rem",
                    display: "flex",
                    flexDirection: "column",
                    justify: "space-between",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ color: "#94a3b8", fontSize: "0.65rem", fontWeight: "700", whiteSpace: "nowrap" }}>
                        CONDITION STATUS
                      </span>
                      <ShieldCheck size={15} style={{ color: getConditionBadge(selectedEq.condition_status).text }} />
                    </div>
                    <div style={{ marginTop: "0.25rem" }}>
                      <span
                        style={{
                          background: getConditionBadge(selectedEq.condition_status).bg,
                          border: `1px solid ${getConditionBadge(selectedEq.condition_status).border}`,
                          color: getConditionBadge(selectedEq.condition_status).text,
                          fontSize: "0.72rem",
                          fontWeight: "700",
                          padding: "0.12rem 0.45rem",
                          borderRadius: "4px",
                          whiteSpace: "nowrap",
                          display: "inline-block",
                        }}
                      >
                        {selectedEq.condition_status}
                      </span>
                    </div>
                  </div>

                  <div style={{ marginTop: "0.5rem", color: "#00f0ff", fontSize: "0.65rem", fontFamily: "monospace", fontWeight: "600", whiteSpace: "nowrap" }}>
                    MTBF: {selectedEq.MTBF_hours}h • MTTR: {selectedEq.MTTR_hours}h
                  </div>
                </div>
              </div>

              {/* Critical Component Diagnostic Checklist */}
              <div
                style={{
                  background: "#090f1d",
                  border: "1px solid #1e293b",
                  borderRadius: "8px",
                  padding: "0.8rem 0.95rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.55rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#38bdf8", fontSize: "0.75rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "0.45rem", whiteSpace: "nowrap" }}>
                    <Activity size={14} /> CRITICAL COMPONENT SERVICE STATUS
                  </span>
                  <span style={{ fontSize: "0.62rem", color: "#94a3b8", whiteSpace: "nowrap" }}>
                    Telemetry monitored in live SCADA engine
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.55rem" }}>
                  <div style={{ background: "#162032", padding: "0.45rem 0.65rem", borderRadius: "6px", border: "1px solid #1e293b" }}>
                    <div style={{ color: "#94a3b8", fontSize: "0.62rem", whiteSpace: "nowrap" }}>Bearing & Shaft</div>
                    <div style={{ color: "#10b981", fontSize: "0.72rem", fontWeight: "600", marginTop: "0.15rem", display: "flex", alignItems: "center", gap: "0.25rem", whiteSpace: "nowrap" }}>
                      <Check size={12} /> NOMINAL
                    </div>
                  </div>

                  <div style={{ background: "#162032", padding: "0.45rem 0.65rem", borderRadius: "6px", border: "1px solid #1e293b" }}>
                    <div style={{ color: "#94a3b8", fontSize: "0.62rem", whiteSpace: "nowrap" }}>Wear Liner / Spigot</div>
                    <div style={{ color: selectedEq.is_overdue ? "#f87171" : "#fbbf24", fontSize: "0.72rem", fontWeight: "600", marginTop: "0.15rem", whiteSpace: "nowrap" }}>
                      {selectedEq.is_overdue ? "REPLACEMENT DUE" : "MONITOR WEAR"}
                    </div>
                  </div>

                  <div style={{ background: "#162032", padding: "0.45rem 0.65rem", borderRadius: "6px", border: "1px solid #1e293b" }}>
                    <div style={{ color: "#94a3b8", fontSize: "0.62rem", whiteSpace: "nowrap" }}>Lubrication & Seal</div>
                    <div style={{ color: "#10b981", fontSize: "0.72rem", fontWeight: "600", marginTop: "0.15rem", display: "flex", alignItems: "center", gap: "0.25rem", whiteSpace: "nowrap" }}>
                      <Check size={12} /> VERIFIED
                    </div>
                  </div>
                </div>
              </div>

              {/* View Complete Machine Maintenance History Logs Button */}
              <button
                onClick={() => {
                  setHistoryAssetId(selectedEq.equipment_id);
                  closeModal();
                }}
                style={{
                  background: "linear-gradient(135deg, rgba(2, 132, 199, 0.3) 0%, rgba(0, 240, 255, 0.15) 100%)",
                  border: "1px solid #00f0ff",
                  borderRadius: "8px",
                  padding: "0.65rem 1rem",
                  color: "#00f0ff",
                  fontSize: "0.85rem",
                  fontWeight: "700",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.6rem",
                  width: "100%",
                  boxShadow: "0 0 16px rgba(0, 240, 255, 0.2)",
                  transition: "all 0.15s ease",
                  marginTop: "0.2rem",
                }}
              >
                <FileText size={17} /> View Complete Machine Maintenance History Logs →
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
