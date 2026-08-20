import { useState, useEffect, useRef } from "react";
import { Menu, Activity, Radio, Bot, Sparkles, LogOut, UserCheck, Columns, Split, SlidersHorizontal } from "lucide-react";
import { useAuth } from "./context/AuthContext";
import Flowsheet from "./pages/Flowsheet";
import ThreeDView from "./pages/ThreeDView";
import MaintenancePage from "./pages/MaintenancePage";
import KnowledgeGraphPage from "./pages/KnowledgeGraphPage";
import NavigationSidebar from "./components/NavigationSidebar";
import GraphRagDrawer from "./components/GraphRagDrawer";
import TelemetryPopoutDrawer from "./components/TelemetryPopoutDrawer";
import {
  getSimulationStatus,
  startSimulation,
  pauseSimulation,
  resumeSimulation,
  stopSimulation,
  restartSimulation,
  setSimulationSpeed,
  getNoderedTags,
} from "./api/simulationApi";
import { API_BASE as API } from "./config/api.config";
import "./styles/App.css";

const DISPLAY_METRIC_NAMES = {
  // Raw CSV Telemetry
  "Feed Solid Flow": "Solid Flow",
  "Feed BPL": "Grade",
  "Feed P80": "P80",
  "Feed Solid Fraction": "Solid Frac",
  "Process Water Solid Flow": "Solid Flow",
  "Process Water Solid Fraction": "Solid Frac",
  "Cyclone Feed Solid Flow": "Solid Flow",
  "Cyclone Feed BPL": "Grade",
  "Cyclone Feed P80": "P80",
  "Cyclone Feed Solid Fraction": "Solid Frac",
  "Cyclone Underflow Solid Flow": "Solid Flow",
  "Cyclone Underflow BPL": "Grade",
  "Cyclone Underflow P80": "P80",
  "Cyclone Underflow Solid Fraction": "Solid Frac",
  "Ball Mill Discharge Solid Flow": "Solid Flow",
  "Ball Mill Discharge BPL": "Grade",
  "Ball Mill Discharge P80": "P80",
  "Ball Mill Discharge Solid Fraction": "Solid Frac",
  "Output Slurry Solid Flow": "Solid Flow",
  "Output Slurry BPL": "Grade",
  "Output Slurry P80": "P80",
  "Output Slurry Solid Fraction": "Solid Frac",
  "Ambient_Temp_C": "Ambient Temp",
  "PB001_Level_pct": "Sump Level",
  "PB001_Sump_Temp_C": "Sump Temp",
  "SP001_Motor_Current_A": "Current",
  "SP001_Motor_Power_kW": "Power",
  "SP001_Discharge_Pressure_kPa": "Disch Press",
  "SP001_Speed_RPM": "Speed",
  "SP001_Bearing_Temp_C": "Bearing Temp",
  "SP001_Vibration_mms": "Vibration",
  "BM001_Power_Draw_kW": "Power Draw",
  "BM001_Motor_Current_A": "Motor Current",
  "BM001_Mill_Speed_pctCritical": "Speed",
  "BM001_Bearing_DE_Temp_C": "Drive Bearing",
  "BM001_Bearing_NDE_Temp_C": "Non-Drive Bearing",
  "BM001_Vibration_mms": "Vibration RMS",
  "BM001_Sound_Level_dB": "Acoustic",
  "CY001_Inlet_Pressure_kPa": "Inlet Press",
  "CY001_Vortex_DP_kPa": "Vortex DP",
  "CY001_Apex_Wear_Index_pct": "Apex Wear",
  "CY001_Cyclones_Online": "Cyclones Online",
  "Circulating_Load_Ratio_pct": "Circulating Load",
  "Mill_Reduction_Ratio": "Reduction Ratio",

  // Derived Engineering Metrics
  "delta_p80": "Size Reduction",
  "input_flow": "Input Flow",
  "output_flow": "Output Flow",
  "flow_difference": "Flow Variance",
  "feed_flow": "Feed Flow",
  "underflow_flow": "Underflow Flow",
  "overflow_flow": "Overflow Flow",
  "underflow_pct": "Underflow Ratio",
  "overflow_pct": "Overflow Ratio",
  "total_inflow": "Total Inflow",
  "outflow": "Outflow",
  "flow_balance": "Flow Balance",
  "suction_flow": "Suction Flow",
  "discharge_flow": "Discharge Flow",
};

function getDisplayMetricName(key) {
  if (!key) return "";
  if (DISPLAY_METRIC_NAMES[key]) return DISPLAY_METRIC_NAMES[key];

  let cleanName = String(key);
  if (cleanName.includes("Solid Flow")) return "Flow";
  if (cleanName.includes("Solid Fraction")) return "Solid Frac";
  if (cleanName.includes("BPL")) return "Grade";
  if (cleanName.includes("P80")) return "P80";

  return cleanName
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\s*\([^)]*\)/g, "")
    .trim();
}

function getMetricUnit(key) {
  if (!key) return "";
  const k = String(key).toLowerCase();

  if (k.includes("p80") || k.includes("delta_p80")) return "µm";
  if (k.includes("bpl")) return "% BPL";
  if (k.includes("pct") || k.includes("fraction") || k.includes("level") || k.includes("wear") || k.includes("_pct")) return "%";
  if (k.includes("flow") || k.includes("inflow") || k.includes("outflow")) return "t/h";
  if (k.includes("temp")) return "°C";
  if (k.includes("pressure") || k.includes("kpa") || k.includes("vortex_dp")) return "kPa";
  if (k.includes("kw") || k.includes("power")) return "kW";
  if (k.includes("current") || k.endsWith("_a")) return "A";
  if (k.includes("rpm") || k.includes("speed")) return "RPM";
  if (k.includes("vibration") || k.includes("mms")) return "mm/s";
  if (k.includes("sound") || k.includes("db")) return "dB";
  if (k.includes("online") || k.includes("num_")) return "units";

  return "";
}

function renderSourceDestValue(val) {
  if (!val) return <span style={{ color: "#64748b" }}>N/A</span>;
  const items = Array.isArray(val) ? val : [val];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginTop: "0.2rem" }}>
      {items.map((item, idx) => {
        const match = item.match(/^(.*?)\s*\(([^)]+)\)$/);
        if (match) {
          return (
            <div key={idx} style={{ lineHeight: "1.3" }}>
              <div style={{ color: "#f8fafc", fontWeight: "600" }}>{match[1]}</div>
              <div style={{ color: "#38bdf8", fontSize: "0.75rem", fontWeight: "700" }}>({match[2]})</div>
            </div>
          );
        }
        return (
          <div key={idx} style={{ color: "#38bdf8", fontWeight: "600", wordBreak: "break-word", whiteSpace: "normal" }}>
            {item}
          </div>
        );
      })}
    </div>
  );
}

function MetricCard({ label, value, unit }) {
  const numVal = typeof value === "number" ? value : parseFloat(value);
  const isValidNum = !isNaN(numVal);
  const displayStr = isValidNum ? numVal.toFixed(2) : (value || "0.00");
  const metricUnit = unit || getMetricUnit(label);

  let alarmLevel = null; // 'P4', 'P3', 'P2', 'P1'
  let color = "#cbd5e1";
  let barColor = "#475569";
  let percent = 50;

  if (label.includes("Temp") || label.includes("Vibration")) {
    if (isValidNum && numVal > 65) {
      alarmLevel = "P4";
      color = "#ef4444";
      barColor = "#ef4444";
    } else if (isValidNum && numVal > 55) {
      alarmLevel = "P3";
      color = "#f59e0b";
      barColor = "#f59e0b";
    } else if (isValidNum && numVal > 48) {
      alarmLevel = "P2";
      color = "#f97316";
      barColor = "#f97316";
    } else {
      barColor = "#0ea5e9";
    }
    percent = isValidNum ? Math.min(100, Math.max(15, (numVal / 100) * 100)) : 50;
  } else if (label.includes("Level") || label.includes("Solid Frac") || label.includes("Wear") || label.includes("%")) {
    if (isValidNum && numVal > 90) {
      alarmLevel = "P4";
      color = "#ef4444";
      barColor = "#ef4444";
    } else if (isValidNum && numVal > 85) {
      alarmLevel = "P3";
      color = "#f59e0b";
      barColor = "#f59e0b";
    } else if (isValidNum && numVal > 80) {
      alarmLevel = "P2";
      color = "#f97316";
      barColor = "#f97316";
    } else {
      barColor = "#0ea5e9";
    }
    percent = isValidNum ? Math.min(100, Math.max(5, numVal)) : 50;
  } else if (label.includes("Flow")) {
    barColor = "#475569";
    percent = isValidNum ? Math.min(100, Math.max(10, (numVal / 1500) * 100)) : 40;
  } else if (label.includes("Power") || label.includes("Current") || label.includes("Pressure")) {
    barColor = "#475569";
    percent = isValidNum ? Math.min(100, Math.max(15, (numVal / 2000) * 100)) : 60;
  }

  const isAlarmP4 = alarmLevel === "P4";
  const isAlarmP3 = alarmLevel === "P3";
  const isAlarmP2 = alarmLevel === "P2";

  return (
    <div
      className={isAlarmP4 ? "isa-alarm-pulsing" : isAlarmP3 || isAlarmP2 ? "isa-warning-alert" : ""}
      style={{
        background: "linear-gradient(135deg, #162032 0%, #0e1420 100%)",
        border: isAlarmP4
          ? "1px solid #ef4444"
          : isAlarmP3
          ? "1px solid #f59e0b"
          : isAlarmP2
          ? "1px solid #f97316"
          : "1px solid #2a384e",
        borderRadius: "8px",
        padding: "0.6rem 0.75rem",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: "80px",
        boxSizing: "border-box",
        transition: "all 0.3s ease",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.25rem" }}>
        <span
          style={{
            color: isAlarmP4 ? "#fca5a5" : isAlarmP3 ? "#fde68a" : isAlarmP2 ? "#fdba74" : "#94a3b8",
            fontSize: "11px",
            fontWeight: "600",
            lineHeight: "1.2",
          }}
          title={label}
        >
          {label}
        </span>
        {alarmLevel === "P4" && <span className="isa-badge-p4">▲ P4</span>}
        {alarmLevel === "P3" && <span className="isa-badge-p3">◆ P3</span>}
        {alarmLevel === "P2" && <span className="isa-badge-p2">■ P2</span>}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", marginTop: "0.25rem", gap: "0.3rem" }}>
        <span
          style={{
            color: color,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "1.25rem",
            fontWeight: "800",
            lineHeight: "1.1",
            transition: "color 0.3s ease",
          }}
        >
          {displayStr}
        </span>
        {metricUnit && (
          <span
            style={{
              color: isAlarmP4 ? "#f87171" : isAlarmP3 ? "#fbbf24" : isAlarmP2 ? "#fb923c" : "#94a3b8",
              fontSize: "0.75rem",
              fontWeight: "700",
              fontFamily: "sans-serif",
            }}
          >
            {metricUnit}
          </span>
        )}
      </div>

      <div
        style={{
          width: "100%",
          height: "4px",
          backgroundColor: "#162032",
          borderRadius: "2px",
          overflow: "hidden",
          marginTop: "0.35rem",
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            height: "100%",
            backgroundColor: barColor,
            borderRadius: "2px",
            boxShadow: isAlarmP4 ? "0 0 8px #ef4444" : isAlarmP3 ? "0 0 8px #f59e0b" : "none",
            transition: "width 0.4s ease, background-color 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}

export default function App() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("flowsheet");

  // Clear any stale hash/localStorage that could cause wrong-tab startup
  useEffect(() => {
    localStorage.removeItem("activeTab");
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRagOpen, setIsRagOpen] = useState(false);
  const [asset, setAsset] = useState(null);
  const [selectedTag, setSelectedTag] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [simStatus, setSimStatus] = useState(null);
  const [selectionSource, setSelectionSource] = useState("flowsheet");

  // Extensible Dual-Viewport Split System State
  const [splitRatio, setSplitRatio] = useState(50); // percentage for flowsheet (0..100)
  const [isResizing, setIsResizing] = useState(false);
  const [showTelemetryDrawer, setShowTelemetryDrawer] = useState(false);
  const [expandedPane, setExpandedPane] = useState(null); // null | "flowsheet" | "graph"

  const selectedTagRef = useRef(selectedTag);
  const [simStep, setSimStep] = useState(0);

  selectedTagRef.current = selectedTag;

  const handleMouseDownSplitter = (e) => {
    e.preventDefault();
    setIsResizing(true);

    const handleMouseMove = (moveEvent) => {
      const totalWidth = window.innerWidth;
      const newRatio = Math.max(15, Math.min(85, (moveEvent.clientX / totalWidth) * 100));
      setSplitRatio(newRatio);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  function getAssetStage(tag) {
    if (tag === "P_001" || tag === "P_101") return 1;
    if (tag === "PB_001" || tag === "SP_001" || tag === "P_002") return 2;
    if (tag === "CY_001" || tag === "P_003") return 3;
    if (tag === "P_006" || tag === "P_004" || tag === "BM_001") return 4;
    if (tag === "P_005") return 5;
    return 1;
  }

  function adjustAssetDataForStartup(data, currentSimStep, state) {
    if (!data || state !== "RUNNING" || currentSimStep >= 5 || currentSimStep === 0) return data;

    const stage = getAssetStage(data.tag);
    if (currentSimStep < stage) {
      const clone = JSON.parse(JSON.stringify(data));
      if (clone.live_metrics) {
        for (const k in clone.live_metrics) clone.live_metrics[k] = 0.0;
      }
      if (clone.derived_metrics) {
        for (const k in clone.derived_metrics) clone.derived_metrics[k] = 0.0;
      }
      if (clone.incoming_streams) {
        for (const s in clone.incoming_streams) {
          for (const k in clone.incoming_streams[s]) clone.incoming_streams[s][k] = 0.0;
        }
      }
      if (clone.outgoing_streams) {
        for (const s in clone.outgoing_streams) {
          for (const k in clone.outgoing_streams[s]) clone.outgoing_streams[s][k] = 0.0;
        }
      }
      return clone;
    }
    return data;
  }

  const loadAsset = async (tag, source = "flowsheet") => {
    setSelectionSource(source);
    selectedTagRef.current = tag || null;
    if (!tag) {
      setAsset(null);
      setSelectedTag(null);
      return;
    }
    setShowTelemetryDrawer(true);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/assets/${tag}`);
      if (!res.ok) {
        throw new Error(`Failed to load asset ${tag}`);
      }
      const data = await res.json();
      setAsset(data);
      setSelectedTag(tag);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchStatusAndTelemetry = async () => {
      try {
        const status = await getSimulationStatus();
        setSimStatus(status);

        const currentTag = selectedTagRef.current;
        if (currentTag) {
          const res = await fetch(`${API}/api/assets/${currentTag}`);
          if (res.ok) {
            setAsset(await res.json());
          }
        } else {
          setAsset(null);
        }
      } catch (err) {
        console.error("Telemetry polling error:", err);
      }
    };

    fetchStatusAndTelemetry();
    const interval = setInterval(fetchStatusAndTelemetry, 600);
    return () => clearInterval(interval);
  }, []);

  // Live Node-RED/OPC UA tags, polled continuously and filtered to whichever
  // equipment is currently selected, so the telemetry drawer can show them
  // alongside the CSV-driven live_metrics without a separate fixed panel.
  const [noderedTags, setNoderedTags] = useState({});
  useEffect(() => {
    const fetchNodered = async () => {
      try {
        setNoderedTags(await getNoderedTags());
      } catch (err) {
        console.error("Node-RED tags fetch failed:", err);
      }
    };
    fetchNodered();
    const interval = setInterval(fetchNodered, 2000);
    return () => clearInterval(interval);
  }, []);

  const displayAsset = adjustAssetDataForStartup(asset, simStep, simStatus?.state);

  const noderedMetrics = {};
  if (selectedTag) {
    const equipPrefix = selectedTag.replace(/_/g, "").split(".")[0].toUpperCase();
    Object.entries(noderedTags).forEach(([tagId, payload]) => {
      if (tagId.toUpperCase().startsWith(`${equipPrefix}.`)) {
        const param = tagId.split(".").slice(2).join(".") || tagId;
        noderedMetrics[param] = payload;
      }
    });
  }

  const hasLiveMetrics = Boolean(displayAsset?.live_metrics && Object.keys(displayAsset.live_metrics).length > 0);
  const hasIncomingStreams = Boolean(displayAsset?.incoming_streams && Object.keys(displayAsset.incoming_streams).length > 0);
  const hasOutgoingStreams = Boolean(displayAsset?.outgoing_streams && Object.keys(displayAsset.outgoing_streams).length > 0);
  const hasDerivedMetrics = Boolean(asset?.derived_metrics && Object.keys(asset.derived_metrics).length > 0);

  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        maxHeight: "100vh",
        maxWidth: "100vw",
        backgroundColor: "#0e1420",
        color: "#f8fafc",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      <NavigationSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onOpen={() => setIsSidebarOpen(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <header
        style={{
          height: "52px",
          flexShrink: 0,
          background: "#0e1420",
          borderBottom: "1px solid #2a384e",
          padding: "0 1.25rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            style={{
              background: "#161f30",
              border: "1px solid #475569",
              color: "#e2e8f0",
              borderRadius: "6px",
              padding: "0.35rem 0.55rem",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s ease",
            }}
            title="Toggle left navigation menu"
          >
            <Menu size={19} />
          </button>

          <h1 style={{ margin: 0, fontSize: "0.95rem", fontWeight: "800", letterSpacing: "0.5px" }}>
            <span style={{ color: "#f8fafc", fontWeight: "900" }}>NEXUS</span> DIGITAL TWIN{" "}
            <span style={{ color: "#475569", fontWeight: "300", margin: "0 0.4rem" }}>|</span>{" "}
            <span style={{ color: "#cbd5e1", fontWeight: "500", fontSize: "0.82rem" }}>
              {activeTab === "flowsheet"
                ? "Process Flowsheet & System Knowledge Graph Dual View"
                : activeTab === "3d"
                ? "Realistic 3D Circuit View with Live Equipment Telemetry"
                : activeTab === "maintenance"
                ? "Level 3 Health • Asset Reliability & Circuit Maintenance"
                : "Level 2 Topology • Knowledge Graph & System Network"}
            </span>
          </h1>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.45rem",
              fontSize: "0.72rem",
              color: "#cbd5e1",
              background: "#161f30",
              border: "1px solid #2a384e",
              padding: "0.25rem 0.65rem",
              borderRadius: "12px",
              userSelect: "none",
            }}
          >
            <span className="pulse-dot"></span>
            <span style={{ fontWeight: "700", color: "#f8fafc", letterSpacing: "0.5px" }}>
              SCADA ONLINE
            </span>
          </div>

          {user && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.45rem",
                fontSize: "0.72rem",
                background: "#161f30",
                border: "1px solid #475569",
                padding: "0.25rem 0.75rem",
                borderRadius: "12px",
              }}
            >
              <UserCheck size={13} color="#94a3b8" />
              <span style={{ fontWeight: "700", color: "#f8fafc" }}>{user.full_name || user.username}</span>
              <span style={{ color: "#475569" }}>•</span>
              <span style={{ color: "#cbd5e1", fontWeight: "600" }}>{user.role}</span>
            </div>
          )}

          <button
            onClick={logout}
            style={{
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              color: "#fca5a5",
              borderRadius: "6px",
              padding: "0.3rem 0.65rem",
              cursor: "pointer",
              fontSize: "0.72rem",
              fontWeight: "600",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              transition: "all 0.15s ease",
            }}
            title="Log out of session"
          >
            <LogOut size={13} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {activeTab === "3d" ? (
        <main
          style={{
            flex: 1,
            height: "calc(100vh - 52px)",
            maxHeight: "calc(100vh - 52px)",
            position: "relative",
            overflow: "hidden",
            background: "#0a0e17",
          }}
        >
          <ThreeDView
            onSelect={(tag) => loadAsset(tag, "3d")}
            selected={asset?.tag}
            isRunning={simStatus?.state === "RUNNING"}
          />

          <TelemetryPopoutDrawer
            displayAsset={displayAsset}
            error={error}
            isOpen={showTelemetryDrawer}
            selectionSource={selectionSource}
            onClose={() => {
              setShowTelemetryDrawer(false);
              loadAsset(null);
            }}
            getDisplayMetricName={getDisplayMetricName}
            getMetricUnit={getMetricUnit}
            renderSourceDestValue={renderSourceDestValue}
            noderedMetrics={noderedMetrics}
          />
        </main>
      ) : activeTab !== "maintenance" ? (
        <main
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: expandedPane === "flowsheet" ? "1fr 0px" : expandedPane === "graph" ? "0px 1fr" : "1fr 1fr",
            height: "calc(100vh - 52px)",
            maxHeight: "calc(100vh - 52px)",
            overflow: "hidden",
            boxSizing: "border-box",
            position: "relative",
            background: "#0e1420",
            transition: "grid-template-columns 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          {/* LEFT CANVASES: PROCESS FLOWSHEET & CONTROL */}
          <section
            style={{
              height: "100%",
              width: "100%",
              minWidth: 0,
              minHeight: 0,
              borderRight: "1px solid #1e293b",
              position: "relative",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden" }}>
              <Flowsheet 
                onSelect={(tag) => loadAsset(tag, "flowsheet")} 
                selected={asset?.tag} 
                isRunning={simStatus?.state === "RUNNING"} 
                onSimStepChange={setSimStep}
                isSimActive={simStatus?.state === "RUNNING" || simStatus?.state === "PAUSED"}
                simStatus={simStatus}
                onStartToggle={async () => {
                  if (simStatus?.state === "RUNNING") {
                    setSimStatus(await pauseSimulation());
                  } else {
                    setSimStatus(await startSimulation());
                  }
                }}
                onRestart={async () => setSimStatus(await restartSimulation())}
                onStop={async () => setSimStatus(await stopSimulation())}
                onSpeedChange={async (spd) => setSimStatus(await setSimulationSpeed(spd))}
              />
            </div>
          </section>

          {/* ═══ CENTER EXPAND TOGGLE BUTTON ═══ */}
          <div
            style={{
              position: "absolute",
              left: expandedPane === "flowsheet" ? "calc(100% - 20px)" : expandedPane === "graph" ? "52px" : "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 20,
              display: isSidebarOpen ? "none" : "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "6px",
              transition: "left 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            {/* Expand Flowsheet button */}
            <button
              onClick={() => setExpandedPane(expandedPane === "flowsheet" ? null : "flowsheet")}
              title={expandedPane === "flowsheet" ? "Restore split view" : "Expand Flowsheet"}
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "8px",
                background: expandedPane === "flowsheet" ? "rgba(0,240,255,0.25)" : "rgba(14,20,32,0.92)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                border: `1px solid ${expandedPane === "flowsheet" ? "#00f0ff" : "#2a384e"}`,
                color: expandedPane === "flowsheet" ? "#00f0ff" : "#64748b",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s ease",
                boxShadow: expandedPane === "flowsheet" ? "0 0 12px rgba(0,240,255,0.3)" : "0 2px 8px rgba(0,0,0,0.5)",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                {expandedPane === "flowsheet"
                  ? <><polyline points="15 18 9 12 15 6"/><polyline points="8 18 14 12 8 6"/></>
                  : <><polyline points="9 18 15 12 9 6"/><line x1="17" y1="6" x2="17" y2="18"/></>}
              </svg>
            </button>

            {/* Vertical divider line */}
            <div style={{ width: "1px", height: "32px", background: "linear-gradient(to bottom, transparent, #2a384e, transparent)" }} />

            {/* Expand Knowledge Graph button */}
            <button
              onClick={() => setExpandedPane(expandedPane === "graph" ? null : "graph")}
              title={expandedPane === "graph" ? "Restore split view" : "Expand Knowledge Graph"}
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "8px",
                background: expandedPane === "graph" ? "rgba(0,240,255,0.25)" : "rgba(14,20,32,0.92)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                border: `1px solid ${expandedPane === "graph" ? "#00f0ff" : "#2a384e"}`,
                color: expandedPane === "graph" ? "#00f0ff" : "#64748b",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s ease",
                boxShadow: expandedPane === "graph" ? "0 0 12px rgba(0,240,255,0.3)" : "0 2px 8px rgba(0,0,0,0.5)",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                {expandedPane === "graph"
                  ? <><polyline points="9 18 15 12 9 6"/><polyline points="16 18 10 12 16 6"/></>
                  : <><polyline points="15 18 9 12 15 6"/><line x1="7" y1="6" x2="7" y2="18"/></>}
              </svg>
            </button>
          </div>


          <section
            style={{
              height: "100%",
              width: "100%",
              minWidth: 0,
              minHeight: 0,
              position: "relative",
              overflow: "hidden",
              background: "#0e1420",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden" }}>
              <KnowledgeGraphPage
                onSelect={(tag) => loadAsset(tag, "graph")}
                externalSelectedId={asset?.tag}
              />
            </div>
          </section>

          {/* FLOATING TELEMETRY INSPECTION DRAWER */}
          <TelemetryPopoutDrawer
            displayAsset={displayAsset}
            error={error}
            isOpen={showTelemetryDrawer}
            selectionSource={selectionSource}
            onClose={() => {
              setShowTelemetryDrawer(false);
              loadAsset(null);
            }}
            getDisplayMetricName={getDisplayMetricName}
            getMetricUnit={getMetricUnit}
            renderSourceDestValue={renderSourceDestValue}
            noderedMetrics={noderedMetrics}
          />
        </main>
      ) : (
        <main
          style={{
            flex: 1,
            height: "calc(100vh - 52px)",
            maxHeight: "calc(100vh - 52px)",
            overflowY: "auto",
            boxSizing: "border-box",
          }}
        >
          <MaintenancePage />
        </main>
      )}

      {/* Floating AI Copilot Trigger Icon on the Right (Strictly Icon Only) */}
      {!isRagOpen && (
        <button
          onClick={() => setIsRagOpen(true)}
          style={{
            position: "fixed",
            bottom: "28px",
            right: "24px",
            zIndex: 999,
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #00f0ff 0%, #3b82f6 100%)",
            border: "1px solid rgba(0, 240, 255, 0.6)",
            boxShadow: "0 0 20px rgba(0, 240, 255, 0.5), 0 8px 25px rgba(0, 0, 0, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
          title="Open Graph RAG AI Copilot"
          onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.1)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1.0)")}
        >
          <Bot size={24} color="#0f172a" />
        </button>
      )}

      <GraphRagDrawer isOpen={isRagOpen} onClose={() => setIsRagOpen(false)} />
    </div>
  );
}
