import React, { useState, useEffect, useRef } from "react";
import {
  Activity,
  Radio,
  X,
  Minimize2,
  Maximize2,
  TrendingUp,
  GripHorizontal,
  Info,
} from "lucide-react";

/**
 * Clean Metric Card Component (Strict ISA-101 Slate Theme)
 */
const PopoutMetricCard = ({ label, value, unit }) => {
  const formattedVal = typeof value === "number" ? value.toFixed(2) : String(value ?? "N/A");

  return (
    <div
      style={{
        background: "#161f30",
        border: "1px solid #2a384e",
        borderRadius: "6px",
        padding: "0.45rem 0.65rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.2rem",
      }}
    >
      <div
        style={{
          color: "#94a3b8",
          fontSize: "0.68rem",
          fontWeight: "700",
          textTransform: "uppercase",
          letterSpacing: "0.4px",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
        title={label}
      >
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.35rem" }}>
        <span
          style={{
            color: "#f8fafc",
            fontSize: "1.05rem",
            fontWeight: "800",
            fontFamily: "Inter, monospace, system-ui",
          }}
        >
          {formattedVal}
        </span>
        {unit && (
          <span
            style={{
              color: "#cbd5e1",
              fontSize: "0.72rem",
              fontWeight: "700",
            }}
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * Modern Draggable Glassmorphism Telemetry Drawer Component (ISA-101 Compliant)
 */
/**
 * "SolidFlow" -> "Solid Flow", "BearingDETemp" -> "Bearing DE Temp"
 */
function formatNoderedLabel(param) {
  return String(param)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\./g, " ")
    .trim();
}

export default function TelemetryPopoutDrawer({
  displayAsset,
  error,
  isOpen,
  selectionSource = "flowsheet",
  onClose,
  getDisplayMetricName,
  getMetricUnit,
  renderSourceDestValue,
  noderedMetrics = {},
}) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: null, y: null });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 });

  // Automatically position the drawer on the opposite side of the screen from the selected viewport
  // so it NEVER overlays/blocks the selected machine or node!
  useEffect(() => {
    if (displayAsset?.tag && isOpen) {
      const windowWidth = typeof window !== "undefined" ? window.innerWidth : 1200;
      if (selectionSource === "graph") {
        // Selected on Right Viewport (Knowledge Graph) -> position popout on Far Left
        setPosition({ x: 24, y: 75 });
      } else {
        // Selected on Left Viewport (Flowsheet) -> position popout on Far Right
        setPosition({ x: Math.max(20, windowWidth - 410), y: 75 });
      }
    }
  }, [displayAsset?.tag, selectionSource, isOpen]);

  // Reset position when drawer closes so it never re-opens at a stale dragged position
  useEffect(() => {
    if (!isOpen) {
      setPosition({ x: null, y: null });
    }
  }, [isOpen]);

  const handleMouseDown = (e) => {
    if (e.target.closest("button") || e.target.closest("input")) return;

    setIsDragging(true);
    const windowWidth = window.innerWidth;
    const initialLeft = position.x !== null ? position.x : (selectionSource === "graph" ? 24 : Math.max(20, windowWidth - 410));
    const initialTop = position.y !== null ? position.y : 75;

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: initialLeft,
      initialY: initialTop,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      const newX = Math.max(10, Math.min(window.innerWidth - 390, dragRef.current.initialX + dx));
      const newY = Math.max(10, Math.min(window.innerHeight - 100, dragRef.current.initialY + dy));
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  if (!isOpen || !displayAsset) return null;

  const hasLiveMetrics = Boolean(displayAsset?.live_metrics && Object.keys(displayAsset.live_metrics).length > 0);
  const hasIncomingStreams = Boolean(displayAsset?.incoming_streams && Object.keys(displayAsset.incoming_streams).length > 0);
  const hasOutgoingStreams = Boolean(displayAsset?.outgoing_streams && Object.keys(displayAsset.outgoing_streams).length > 0);
  const hasDerivedMetrics = Boolean(displayAsset?.derived_metrics && Object.keys(displayAsset.derived_metrics).length > 0);

  if (isMinimized) {
    return (
      <div
        style={{
          position: "fixed",
          bottom: "24px",
          right: "85px",
          zIndex: 9000,
          background: "#161f30",
          border: "1px solid #2a384e",
          borderRadius: "30px",
          padding: "0.55rem 1.1rem",
          display: "flex",
          alignItems: "center",
          gap: "0.65rem",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.6)",
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
        onClick={() => setIsMinimized(false)}
        title="Expand Telemetry Inspection"
      >
        <span className="pulse-dot"></span>
        <Activity size={16} color="#cbd5e1" />
        <span style={{ color: "#f8fafc", fontSize: "0.82rem", fontWeight: "800" }}>
          Telemetry • <span style={{ color: "#cbd5e1" }}>{displayAsset.tag}</span>
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsMinimized(false);
          }}
          style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 0 }}
        >
          <Maximize2 size={14} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 0 }}
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        left: position.x !== null ? `${position.x}px` : "auto",
        top: position.y !== null ? `${position.y}px` : "auto",
        bottom: position.y === null ? "24px" : "auto",
        right: position.x === null ? "85px" : "auto",
        zIndex: 9000,
        width: "380px",
        maxHeight: "calc(100vh - 80px)",
        background: "#0e1420",
        border: "1px solid #2a384e",
        borderRadius: "12px",
        boxShadow: "0 16px 48px rgba(0, 0, 0, 0.7), inset 0 0 2px rgba(255, 255, 255, 0.05)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {/* Draggable Header Bar */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          padding: "0.75rem 0.95rem",
          background: "#161f30",
          borderBottom: "1px solid #2a384e",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          userSelect: "none",
          cursor: isDragging ? "grabbing" : "grab",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
          <GripHorizontal size={16} color="#64748b" style={{ cursor: "grab" }} />
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "8px",
              background: "#1e293b",
              border: "1px solid #334155",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#cbd5e1",
            }}
          >
            <Activity size={15} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "1.08rem", fontWeight: "900", color: "#f8fafc", letterSpacing: "0.5px" }}>
                {displayAsset.tag}
              </span>
              <span
                style={{
                  fontSize: "0.64rem",
                  padding: "0.12rem 0.45rem",
                  borderRadius: "4px",
                  background: "#1e293b",
                  border: "1px solid #334155",
                  color: displayAsset?.mqtt?.active ? "#34d399" : "#cbd5e1",
                  fontWeight: "700",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
              >
                <Radio size={10} color={displayAsset?.mqtt?.active ? "#34d399" : "#64748b"} /> {displayAsset?.mqtt?.active ? "LIVE MQTT" : "SIM ENGINE"}
              </span>
            </div>
            <div style={{ fontSize: "0.74rem", color: "#94a3b8", fontWeight: "600" }}>
              {displayAsset.asset_type}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <button
            onClick={() => setIsMinimized(true)}
            style={{
              background: "#0e1420",
              border: "1px solid #2a384e",
              color: "#94a3b8",
              borderRadius: "6px",
              padding: "0.32rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s ease",
            }}
            title="Minimize drawer"
          >
            <Minimize2 size={14} />
          </button>
          <button
            onClick={onClose}
            style={{
              background: "#1e293b",
              border: "1px solid #334155",
              color: "#94a3b8",
              borderRadius: "6px",
              padding: "0.32rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s ease",
            }}
            title="Close inspection drawer"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Content Body (ISA-101 Compliant) */}
      <div
        style={{
          padding: "0.85rem 0.95rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          overflowY: "auto",
          maxHeight: "calc(100vh - 140px)",
          scrollbarWidth: "none",
          boxSizing: "border-box",
        }}
      >
        {error && (
          <div style={{ background: "#161f30", border: "1px solid #ef4444", color: "#fca5a5", padding: "0.5rem", borderRadius: "6px", fontSize: "0.75rem" }}>
            {error}
          </div>
        )}

        {/* Metadata Summary Pill */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.4rem" }}>
          <div style={{ background: "#161f30", border: "1px solid #2a384e", borderRadius: "6px", padding: "0.4rem 0.5rem" }}>
            <div style={{ color: "#94a3b8", fontSize: "0.62rem", fontWeight: "700", textTransform: "uppercase" }}>Material</div>
            <div style={{ color: "#f8fafc", fontSize: "0.78rem", fontWeight: "700", marginTop: "0.1rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {displayAsset.material || "N/A"}
            </div>
          </div>
          <div style={{ background: "#161f30", border: "1px solid #2a384e", borderRadius: "6px", padding: "0.4rem 0.5rem" }}>
            <div style={{ color: "#94a3b8", fontSize: "0.62rem", fontWeight: "700", textTransform: "uppercase" }}>Source</div>
            <div style={{ color: "#cbd5e1", fontSize: "0.78rem", fontWeight: "600", marginTop: "0.1rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {renderSourceDestValue ? renderSourceDestValue(displayAsset.source) : String(displayAsset.source || "N/A")}
            </div>
          </div>
          <div style={{ background: "#161f30", border: "1px solid #2a384e", borderRadius: "6px", padding: "0.4rem 0.5rem" }}>
            <div style={{ color: "#94a3b8", fontSize: "0.62rem", fontWeight: "700", textTransform: "uppercase" }}>Destination</div>
            <div style={{ color: "#cbd5e1", fontSize: "0.78rem", fontWeight: "600", marginTop: "0.1rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {renderSourceDestValue ? renderSourceDestValue(displayAsset.destination) : String(displayAsset.destination || "N/A")}
            </div>
          </div>
        </div>

        {/* Live Metrics Section */}
        <div>
          <div style={{ fontSize: "0.72rem", color: "#cbd5e1", marginBottom: "0.45rem", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: "800", display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <Activity size={13} color="#64748b" /> {hasLiveMetrics ? "LIVE TELEMETRY METRICS" : "STREAM TELEMETRY"}
          </div>

          {hasLiveMetrics && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.4rem" }}>
              {Object.entries(displayAsset.live_metrics).map(([key, val]) => (
                <PopoutMetricCard key={key} label={getDisplayMetricName ? getDisplayMetricName(key) : key} value={val} unit={getMetricUnit ? getMetricUnit(key) : ""} />
              ))}
            </div>
          )}

          {/* Derived Engineering KPIs */}
          {hasDerivedMetrics && (
            <div style={{ marginTop: "0.75rem" }}>
              <div style={{ fontSize: "0.72rem", color: "#cbd5e1", marginBottom: "0.45rem", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: "800", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <TrendingUp size={13} color="#64748b" /> DERIVED ENGINEERING KPIS
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.4rem" }}>
                {Object.entries(displayAsset.derived_metrics).map(([key, val]) => (
                  <PopoutMetricCard key={key} label={getDisplayMetricName ? getDisplayMetricName(key) : key} value={val} unit={getMetricUnit ? getMetricUnit(key) : ""} />
                ))}
              </div>
            </div>
          )}

          {/* Node-RED / OPC UA Live Section */}
          {Object.keys(noderedMetrics).length > 0 && (
            <div style={{ marginTop: "0.75rem" }}>
              <div style={{ fontSize: "0.72rem", color: "#cbd5e1", marginBottom: "0.45rem", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: "800", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <Radio size={13} color="#34d399" /> NODE-RED · OPC UA (LIVE)
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.4rem" }}>
                {Object.entries(noderedMetrics).map(([param, payload]) => (
                  <PopoutMetricCard key={param} label={formatNoderedLabel(param)} value={payload?.value} unit={payload?.unit} />
                ))}
              </div>
            </div>
          )}

          {/* Stream Telemetry fallback */}
          {!hasLiveMetrics && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "0.4rem" }}>
              {hasIncomingStreams && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <div style={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: "800", textTransform: "uppercase" }}>
                    Incoming Streams
                  </div>
                  {Object.entries(displayAsset.incoming_streams).map(([streamTag, metricsDict]) => (
                    <div key={streamTag} style={{ background: "#161f30", border: "1px solid #2a384e", padding: "0.45rem", borderRadius: "6px" }}>
                      <div style={{ color: "#cbd5e1", fontSize: "0.72rem", fontWeight: "800", marginBottom: "0.3rem" }}>
                        Stream {streamTag}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.35rem" }}>
                        {Object.entries(metricsDict).map(([colKey, val]) => (
                          <PopoutMetricCard key={colKey} label={getDisplayMetricName ? getDisplayMetricName(colKey) : colKey} value={val} unit={getMetricUnit ? getMetricUnit(colKey) : ""} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {hasOutgoingStreams && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                  <div style={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: "800", textTransform: "uppercase" }}>
                    Outgoing Streams
                  </div>
                  {Object.entries(displayAsset.outgoing_streams).map(([streamTag, metricsDict]) => (
                    <div key={streamTag} style={{ background: "#161f30", border: "1px solid #2a384e", padding: "0.45rem", borderRadius: "6px" }}>
                      <div style={{ color: "#cbd5e1", fontSize: "0.72rem", fontWeight: "800", marginBottom: "0.3rem" }}>
                        Stream {streamTag}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.35rem" }}>
                        {Object.entries(metricsDict).map(([colKey, val]) => (
                          <PopoutMetricCard key={colKey} label={getDisplayMetricName ? getDisplayMetricName(colKey) : colKey} value={val} unit={getMetricUnit ? getMetricUnit(colKey) : ""} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
