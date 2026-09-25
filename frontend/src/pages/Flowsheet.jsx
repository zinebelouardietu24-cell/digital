import React, { useState, useEffect } from "react";
import { Play, Pause, RotateCcw, Square, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { getHistoricalTags, getNoderedTags } from "../api/simulationApi";
import WhatIfPanel from "../components/WhatIfPanel";
import SoftSensorCard from "../components/SoftSensorCard";

/**
 * Centralized Layout Grid Configuration (1120 x 580 canvas)
 * Ensures perfect alignment, equal component spacing, and clean pipe routing.
 */
export const LAYOUT = {
  canvas: { width: 1120, height: 580 },

  // Stream Nodes (Feed Inputs & Discharge Outputs)
  nodes: {
    Slurry_In: { x: 60, y: 310, label: "Slurry In", tag: "P_001" },
    Process_Water: { x: 60, y: 450, label: "Process Water", tag: "P_101" },
    Slurry_Out: { x: 1060, y: 86, label: "Slurry Out", tag: "P_006" },
  },

  // Primary Equipment Components (Generously Spaced Out Across Canvas)
  equipment: {
    PB_001: { x: 260, y: 380, label: "PUMP BOX", sublabel: "PB_001" },
    SP_001: { x: 500, y: 440, label: "SLURRY PUMP", sublabel: "SP_001" },
    CY_001: { x: 640, y: 120, label: "HYDROCYCLONES", sublabel: "CY_001" },
    BM_001: { x: 880, y: 380, label: "BALL MILL", sublabel: "BM_001" },
  },

  // Process Piping Interconnects (Exact Polyline Coordinates & Flow Directions)
  pipes: {
    P_001: {
      tag: "P_001",
      name: "Feed Slurry Line",
      color: "#475569",
      points: [
        [108, 310],
        [195, 310],
        [195, 345],
        [224, 345],
      ],
      labelPos: { x: 150, y: 310 },
    },
    P_101: {
      tag: "P_101",
      name: "Process Water Line",
      color: "#475569",
      points: [
        [108, 450],
        [195, 450],
        [195, 375],
        [222, 375],
      ],
      labelPos: { x: 150, y: 450 },
    },
    P_002: {
      tag: "P_002",
      name: "Pump Suction Line",
      color: "#475569",
      points: [
        [260, 430],
        [260, 475],
        [415, 475],
        [415, 440],
        [464, 440],
      ],
      labelPos: { x: 375, y: 475 },
    },
    P_003: {
      tag: "P_003",
      name: "Cyclone Riser Feed",
      color: "#475569",
      points: [
        [500, 404],
        [500, 108],
        [600, 108],
      ],
      labelPos: { x: 500, y: 250 },
    },
    P_006: {
      tag: "P_006",
      name: "Overflow Discharge",
      color: "#475569",
      points: [
        [688, 86],
        [1012, 86],
      ],
      labelPos: { x: 840, y: 86 },
    },
    P_004: {
      tag: "P_004",
      name: "Underflow Line",
      color: "#475569",
      points: [
        [640, 186],
        [640, 380],
        [784, 380],
      ],
      labelPos: { x: 640, y: 283 },
    },
    P_005: {
      tag: "P_005",
      name: "Mill Return Recycle",
      color: "#475569",
      points: [
        [977, 380],
        [1060, 380],
        [1060, 535],
        [320, 535],
        [320, 345],
        [296, 345],
      ],
      labelPos: { x: 710, y: 535 },
    },
  },
};

// Styling System Tokens (ISA-101 High Performance HMI Restraint)
const SELECTION_CYAN = "#cbd5e1";
const BASE_STROKE = "#475569";
const BASE_FILL = "#0f172a";
const CARD_BG = "#162032";
const TEXT_PRIMARY = "#f8fafc";

// ISA-101 Low-Contrast Selection Filters
const HOVER_GLOW_FILTER = "drop-shadow(0 2px 8px rgba(0, 0, 0, 0.6))";
const SELECTED_GLOW_FILTER = "drop-shadow(0 0 8px rgba(203, 213, 225, 0.4))";

/**
 * Standardized SVG Smooth Rounded Corner Path Generator
 */
function buildRoundedPath(points, radius = 12) {
  if (!points || points.length === 0) return "";
  if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`;
  if (points.length === 2) {
    return `M ${points[0][0]} ${points[0][1]} L ${points[1][0]} ${points[1][1]}`;
  }

  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    const dx1 = curr[0] - prev[0];
    const dy1 = curr[1] - prev[1];
    const len1 = Math.hypot(dx1, dy1);

    const dx2 = next[0] - curr[0];
    const dy2 = next[1] - curr[1];
    const len2 = Math.hypot(dx2, dy2);

    const r = Math.min(radius, len1 / 2, len2 / 2);

    const startX = curr[0] - (dx1 / len1) * r;
    const startY = curr[1] - (dy1 / len1) * r;

    const endX = curr[0] + (dx2 / len2) * r;
    const endY = curr[1] + (dy2 / len2) * r;

    d += ` L ${startX} ${startY} Q ${curr[0]} ${curr[1]} ${endX} ${endY}`;
  }
  d += ` L ${points[points.length - 1][0]} ${points[points.length - 1][1]}`;
  return d;
}

/**
 * Helper to calculate exactly ONE single directional flow arrow per pipe tag.
 */
function getSinglePipeArrow(tag, points) {
  if (!points || points.length < 2) return null;

  if (tag === "P_001") {
    return { x: 210, y: 345, angle: 0 };
  }
  if (tag === "P_101") {
    return { x: 210, y: 375, angle: 0 };
  }
  if (tag === "P_002") {
    return { x: 442, y: 440, angle: 0 };
  }
  if (tag === "P_003") {
    return { x: 500, y: 150, angle: -90 };
  }
  if (tag === "P_006") {
    return { x: 940, y: 86, angle: 0 };
  }
  if (tag === "P_004") {
    return { x: 640, y: 345, angle: 90 };
  }
  if (tag === "P_005") {
    return { x: 520, y: 535, angle: 180 };
  }

  const p1 = points[0];
  const p2 = points[1];
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  return {
    x: (p1[0] + p2[0]) / 2,
    y: (p1[1] + p2[1]) / 2,
    angle: (Math.atan2(dy, dx) * 180) / Math.PI,
  };
}

/**
 * Flowsheet Pipe Component with Sequential Step-by-Step Flow Animation
 */
const PipeLine = ({ tag, points, color, isRunning, isStepActive, selected, onSelect }) => {
  const [isHovered, setIsHovered] = useState(false);
  const isSelected = selected === tag;

  const pathD = buildRoundedPath(points, 12);
  const arrow = getSinglePipeArrow(tag, points);

  // Pipe turns white (#ffffff) when clicked; gray (#475569) when normal; light slate (#94a3b8) on hover
  const strokeColor = isSelected ? "#ffffff" : isHovered ? "#94a3b8" : (color || "#475569");

  return (
    <g
      className="flowsheet-pipe"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        if (onSelect) onSelect(selected === tag ? null : tag);
      }}
      style={{ cursor: "pointer" }}
    >
      {/* Invisible thick hit-area for easy clicking */}
      <path d={pathD} fill="none" stroke="transparent" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />

      {/* Main Pipe Line (Clean single 3.5px line - turns pure white on click, no thick contour) */}
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transition: "stroke 0.2s ease" }}
      />

      {/* Animated Dash Stream Layer when simulation is running */}
      {isRunning && isStepActive && (
        <path
          d={pathD}
          fill="none"
          stroke="#ffffff"
          strokeWidth="3.5"
          strokeDasharray="8 6"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            animation: "flowDash 0.8s linear infinite",
            strokeOpacity: isSelected ? 0.9 : 0.6,
          }}
        />
      )}

      {/* Directional Flow Arrow (Restored) */}
      {arrow && (
        <polygon
          points="-6,-3.5 6,0 -6,3.5"
          fill={strokeColor}
          transform={`translate(${arrow.x}, ${arrow.y}) rotate(${arrow.angle})`}
          style={{ transition: "fill 0.2s ease" }}
        />
      )}
    </g>
  );
};

/**
 * Pipe Tag Badge Component
 */
const PipeLabel = ({ tag, labelPos, color, selected, onSelect }) => {
  if (!labelPos) return null;
  const isSelected = selected === tag;
  const badgeColor = color || "#475569";

  return (
    <g
      transform={`translate(${labelPos.x}, ${labelPos.y})`}
      onClick={(e) => {
        e.stopPropagation();
        if (onSelect) onSelect(selected === tag ? null : tag);
      }}
      style={{ cursor: "pointer" }}
    >
      <rect
        x="-25"
        y="-10"
        width="50"
        height="20"
        rx="4"
        fill={isSelected ? "#162032" : CARD_BG}
        stroke={isSelected ? "#ffffff" : badgeColor}
        strokeWidth="1.5"
        style={{ transition: "stroke 0.2s ease, fill 0.2s ease" }}
      />
      <text
        x="0"
        y="3.5"
        textAnchor="middle"
        fill={isSelected ? "#ffffff" : TEXT_PRIMARY}
        fontSize="11"
        fontWeight="800"
        fontFamily="Inter, system-ui, sans-serif"
      >
        {tag}
      </text>
    </g>
  );
};

/**
 * Equipment Tag Badge Component (Mounted Above Equipment)
 */
const TagBadge = ({ tag, isSelected }) => (
  <g transform="translate(0, -56)">
    <rect
      x="-32"
      y="-10"
      width="64"
      height="20"
      rx="4"
      fill={isSelected ? SELECTION_CYAN : CARD_BG}
      stroke={isSelected ? "#ffffff" : BASE_STROKE}
      strokeWidth="1.5"
      style={{ transition: "all 0.25s ease" }}
    />
    <text
      x="0"
      y="3.5"
      textAnchor="middle"
      fill={isSelected ? "#0f172a" : "#38bdf8"}
      fontSize="11"
      fontWeight="800"
      fontFamily="Inter, system-ui, sans-serif"
      letterSpacing="0.5px"
    >
      {tag}
    </text>
  </g>
);

/**
 * Common Equipment Subtitle Component with Styled Pill Box Container
 */
const EquipmentTitle = ({ title, y, isSelected }) => (
  <g transform={`translate(0, ${y})`}>
    <rect
      x="-56"
      y="-10"
      width="112"
      height="20"
      rx="5"
      fill={isSelected ? "#1e293b" : "#0f172a"}
      stroke={isSelected ? SELECTION_CYAN : "#334155"}
      strokeWidth="1.5"
      style={{ transition: "all 0.25s ease" }}
    />
    <text
      x="0"
      y="3.5"
      textAnchor="middle"
      fill={isSelected ? SELECTION_CYAN : "#94a3b8"}
      fontSize="10"
      fontWeight="800"
      fontFamily="Inter, system-ui, sans-serif"
      letterSpacing="0.8px"
    >
      {title}
    </text>
  </g>
);

/**
 * Pump Box Component (PB_001) - Clean Original Geometry with Wavering Slurry Surface
 */
const PumpBox = ({ tag, x, y, selected, onSelect, isRunning, isStepActive, liveReadout }) => {
  const isSelected = selected === tag;
  const strokeColor = isSelected ? SELECTION_CYAN : BASE_STROKE;
  const fillColor = isSelected ? "#1e293b" : BASE_FILL;
  const active = isRunning && isStepActive;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(selected === tag ? null : tag);
      }}
      className="flowsheet-equipment"
      style={{ cursor: "pointer" }}
    >
      <g style={{ filter: isSelected ? SELECTED_GLOW_FILTER : active ? "drop-shadow(0 0 14px rgba(0, 240, 255, 0.75))" : "none", transition: "all 0.25s" }}>
        <TagBadge tag={tag} isSelected={isSelected} />

        {/* Top Rim Flange */}
        <rect x="-42" y="-38" width="84" height="6" rx="2" fill="#334155" stroke={strokeColor} strokeWidth="1.5" />

        {/* Left Side Inlet Nozzle Flange for Process Water (P_101) */}
        <rect x="-40" y="-9" width="16" height="8" rx="1" fill="#334155" stroke={strokeColor} strokeWidth="1.5" />

        {/* Tank Body Hopper */}
        <polygon
          points="-38,-32 38,-32 22,34 -22,34"
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={isSelected ? 3 : 2}
        />

        {/* Animated Wavering Slurry Surface Lines */}
        <path
          d="M -28,-14 Q -14,-17 0,-14 T 28,-14"
          fill="none"
          stroke="#06b6d4"
          strokeWidth="2"
          strokeDasharray="3 2"
          opacity={active ? "1" : "0.8"}
          style={{ animation: active ? "waveLiquid 1.5s ease-in-out infinite" : "none" }}
        />
        <path
          d="M -24,-3 Q -12,-6 0,-3 T 24,-3"
          fill="none"
          stroke="#0284c7"
          strokeWidth="2"
          opacity={active ? "0.9" : "0.6"}
          style={{ animation: active ? "waveLiquid 2.0s ease-in-out infinite 0.3s" : "none" }}
        />

        {/* Bottom Spout Outlet */}
        <rect x="-12" y="34" width="24" height="15" fill="#334155" stroke={strokeColor} strokeWidth="1.5" />

        <EquipmentTitle title="PUMP BOX" y={64} isSelected={isSelected} />
        {liveReadout && <LiveReadout y={84} value={liveReadout.value} unit={liveReadout.unit} quality={liveReadout.quality} />}
      </g>
    </g>
  );
};

/**
 * Centrifugal Slurry Pump Component (SP_001) - Clean Original Geometry with Spinning Impeller
 */
const Pump = ({ tag, x, y, selected, onSelect, isRunning, isStepActive, liveReadout }) => {
  const isSelected = selected === tag;
  const strokeColor = isSelected ? SELECTION_CYAN : BASE_STROKE;
  const fillColor = isSelected ? "#1e293b" : BASE_FILL;
  const active = isRunning && isStepActive;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(selected === tag ? null : tag);
      }}
      className="flowsheet-equipment"
      style={{ cursor: "pointer" }}
    >
      <g style={{ filter: isSelected ? SELECTED_GLOW_FILTER : active ? "drop-shadow(0 0 14px rgba(0, 240, 255, 0.75))" : "none", transition: "all 0.25s" }}>
        <TagBadge tag={tag} isSelected={isSelected} />

        <rect x="-24" y="24" width="48" height="8" rx="2" fill="#334155" stroke="#475569" strokeWidth="1.5" />

        <rect x="-36" y="-6" width="10" height="12" fill="#334155" stroke={strokeColor} strokeWidth="1.5" />

        <path d="M -6,-24 L -6,-34 L 6,-34 L 6,-20 Z" fill={fillColor} stroke={strokeColor} strokeWidth="1.5" />
        <rect x="-8" y="-36" width="16" height="5" rx="1" fill="#334155" stroke={strokeColor} strokeWidth="1.5" />

        <circle cx="0" cy="0" r="25" fill={fillColor} stroke={strokeColor} strokeWidth={isSelected ? 3 : 2} />

        <g style={{ transformOrigin: "0px 0px", animation: active ? "spinImpeller 1.2s linear infinite" : "none" }}>
          <polygon
            points="0,-20 18,12 -18,12"
            fill={isSelected || active ? "#00f0ff" : "#38bdf8"}
            fillOpacity={isSelected || active ? "0.9" : "0.35"}
            stroke={isSelected || active ? "#ffffff" : "#0284c7"}
            strokeWidth="1.5"
          />
        </g>

        <circle cx="0" cy="0" r="5" fill="#f8fafc" stroke="#0f172a" strokeWidth="1.5" />

        <EquipmentTitle title="SLURRY PUMP" y={48} isSelected={isSelected} />
        {liveReadout && <LiveReadout y={68} value={liveReadout.value} unit={liveReadout.unit} quality={liveReadout.quality} />}
      </g>
    </g>
  );
};

/**
 * Hydrocyclone Cluster Component (CY_001) - Clean Original Geometry with Swirling Vortex Lines
 */
const Hydrocyclone = ({ tag, x, y, selected, onSelect, isRunning, isStepActive, liveReadout }) => {
  const isSelected = selected === tag || (selected && selected.startsWith("CY_001"));
  const strokeColor = isSelected ? SELECTION_CYAN : BASE_STROKE;
  const fillColor = isSelected ? "#1e293b" : BASE_FILL;
  const active = isRunning && isStepActive;

  const renderSingleCone = (offsetX, label, subTag) => {
    const isSubSelected = selected === subTag;
    return (
      <g transform={`translate(${offsetX}, 0)`} key={offsetX}>
        <rect x="-6" y="-30" width="12" height="12" fill="#334155" stroke={strokeColor} strokeWidth="1.5" />
        <rect x="-14" y="-18" width="28" height="22" fill={fillColor} stroke={strokeColor} strokeWidth="1.5" />

        {/* Tiny, soft unit tag badge (A, B, C) */}
        <g
          onClick={(e) => {
            e.stopPropagation();
            onSelect(selected === subTag ? null : subTag);
          }}
          style={{ cursor: "pointer" }}
        >
          <rect
            x="-7"
            y="-13"
            width="14"
            height="12"
            rx="3"
            fill={isSubSelected ? "#0284c7" : "rgba(15, 23, 42, 0.95)"}
            stroke={isSubSelected ? "#ffffff" : "#38bdf8"}
            strokeWidth="1"
            style={{ transition: "all 0.2s ease" }}
          />
          <text
            x="0"
            y="-4"
            textAnchor="middle"
            fill={isSubSelected ? "#ffffff" : "#38bdf8"}
            fontSize="8"
            fontWeight="800"
            fontFamily="Inter, system-ui, sans-serif"
          >
            {label}
          </text>
        </g>

        <polygon points="-14,4 14,4 4,48 -4,48" fill={fillColor} stroke={strokeColor} strokeWidth="1.5" />
        <rect x="-5" y="48" width="10" height="8" fill="#334155" stroke={strokeColor} strokeWidth="1.5" />

        {active && (
          <line
            x1="0"
            y1="-30"
            x2="0"
            y2="48"
            stroke="#00f0ff"
            strokeWidth="2"
            strokeDasharray="4 3"
            style={{ animation: "vortexCyclone 0.8s ease-in-out infinite" }}
          />
        )}
      </g>
    );
  };

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(selected === tag ? null : tag);
      }}
      className="flowsheet-equipment"
      style={{ cursor: "pointer" }}
    >
      <g style={{ filter: isSelected ? SELECTED_GLOW_FILTER : active ? "drop-shadow(0 0 14px rgba(0, 240, 255, 0.75))" : "none", transition: "all 0.25s" }}>
        <TagBadge tag={tag} isSelected={isSelected} />

        <rect x="-48" y="-40" width="96" height="12" rx="3" fill="#334155" stroke={strokeColor} strokeWidth="2" />

        {renderSingleCone(-26, "A", "CY_001_A")}
        {renderSingleCone(0, "B", "CY_001_B")}
        {renderSingleCone(26, "C", "CY_001_C")}

        <rect x="-38" y="56" width="76" height="10" rx="2" fill="#334155" stroke={strokeColor} strokeWidth="1.5" />

        <EquipmentTitle title="HYDROCYCLONES" y={82} isSelected={isSelected} />
        {liveReadout && <LiveReadout y={102} value={liveReadout.value} unit={liveReadout.unit} quality={liveReadout.quality} />}
      </g>
    </g>
  );
};

/**
 * Ball Mill Component (BM_001) - Clean Original Geometry with Pulsing Girth Gear & Rotating Lifter Ribs
 */
const BallMill = ({ tag, x, y, selected, onSelect, isRunning, isStepActive, liveReadout }) => {
  const isSelected = selected === tag;
  const strokeColor = isSelected ? SELECTION_CYAN : BASE_STROKE;
  const fillColor = isSelected ? "#1e293b" : BASE_FILL;
  const active = isRunning && isStepActive;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(selected === tag ? null : tag);
      }}
      className="flowsheet-equipment"
      style={{ cursor: "pointer" }}
    >
      <g style={{ filter: isSelected ? SELECTED_GLOW_FILTER : active ? "drop-shadow(0 0 14px rgba(245, 158, 11, 0.75))" : "none", transition: "all 0.25s" }}>
        <TagBadge tag={tag} isSelected={isSelected} />

        <path d="M -78,25 L -88,54 L -62,54 L -68,25 Z M 68,25 L 62,54 L 88,54 L 78,25 Z" fill="#334155" stroke="#475569" strokeWidth="1.5" />

        <polygon points="-65,-30 -85,-12 -85,12 -65,30" fill="#334155" stroke={strokeColor} strokeWidth="1.5" />
        <rect x="-96" y="-12" width="12" height="24" rx="2" fill="#1e293b" stroke={strokeColor} strokeWidth="1.5" />

        <polygon points="65,-30 85,-12 85,12 65,30" fill="#334155" stroke={strokeColor} strokeWidth="1.5" />
        <rect x="85" y="-12" width="12" height="24" rx="2" fill="#1e293b" stroke={strokeColor} strokeWidth="1.5" />

        <rect x="-65" y="-38" width="130" height="76" rx="4" fill={fillColor} stroke={strokeColor} strokeWidth={isSelected ? 3 : 2} />

        {/* Central Girth Gear Drive Ring */}
        <rect
          x="-8"
          y="-43"
          width="16"
          height="86"
          rx="2"
          fill="#475569"
          stroke={active ? "#00f0ff" : isSelected ? SELECTION_CYAN : "#f59e0b"}
          strokeWidth="1.5"
          style={{ animation: active ? "pulseGirthGear 1.5s ease-in-out infinite" : "none" }}
        />
        <line x1="-8" y1="-22" x2="8" y2="-22" stroke="#f59e0b" strokeWidth="1.5" />
        <line x1="-8" y1="0" x2="8" y2="0" stroke="#f59e0b" strokeWidth="1.5" />
        <line x1="-8" y1="22" x2="8" y2="22" stroke="#f59e0b" strokeWidth="1.5" />

        {/* Rotating Shell Lifter Ribs */}
        <g opacity={active ? "0.9" : "0.6"}>
          <line x1="-52" y1="-24" x2="-22" y2="-24" stroke={active ? "#00f0ff" : "#334155"} strokeWidth="2" style={{ animation: active ? "rotateShellLines 1.4s linear infinite" : "none" }} />
          <line x1="-52" y1="0" x2="-22" y2="0" stroke={active ? "#38bdf8" : "#334155"} strokeWidth="2" style={{ animation: active ? "rotateShellLines 1.4s linear infinite 0.4s" : "none" }} />
          <line x1="-52" y1="24" x2="-22" y2="24" stroke={active ? "#f59e0b" : "#334155"} strokeWidth="2" style={{ animation: active ? "rotateShellLines 1.4s linear infinite 0.8s" : "none" }} />

          <line x1="22" y1="-24" x2="52" y2="-24" stroke={active ? "#00f0ff" : "#334155"} strokeWidth="2" style={{ animation: active ? "rotateShellLines 1.4s linear infinite" : "none" }} />
          <line x1="22" y1="0" x2="52" y2="0" stroke={active ? "#38bdf8" : "#334155"} strokeWidth="2" style={{ animation: active ? "rotateShellLines 1.4s linear infinite 0.4s" : "none" }} />
          <line x1="22" y1="24" x2="52" y2="24" stroke={active ? "#f59e0b" : "#334155"} strokeWidth="2" style={{ animation: active ? "rotateShellLines 1.4s linear infinite 0.8s" : "none" }} />
        </g>

        <EquipmentTitle title="BALL MILL" y={68} isSelected={isSelected} />
        {liveReadout && <LiveReadout y={88} value={liveReadout.value} unit={liveReadout.unit} quality={liveReadout.quality} />}
      </g>
    </g>
  );
};

/**
 * Stream Node Component: Feed Inputs & Outputs
 */
const StreamNode = ({ label, tag, x, y, color, type = "input", selected, onSelect }) => {
  const isSelected = selected === tag;
  const nodeColor = color || (tag === "P_101" ? "#3b82f6" : tag === "P_006" ? "#10b981" : "#06b6d4");

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={(e) => {
        e.stopPropagation();
        if (onSelect) onSelect(selected === tag ? null : tag);
      }}
      style={{ cursor: "pointer" }}
    >
      <g
        style={{
          filter: isSelected
            ? `drop-shadow(0 0 16px ${nodeColor}) drop-shadow(0 0 6px ${nodeColor})`
            : `drop-shadow(0 0 10px ${nodeColor})`,
          transition: "all 0.25s ease",
        }}
      >
        {/* Circumference lit with stream's own color; interior fill remains dark/unlit */}
        <rect
          x="-57"
          y="-15"
          width="114"
          height="30"
          rx="6"
          fill="#0f172a"
          stroke={nodeColor}
          strokeWidth={isSelected ? "2.5" : "2.0"}
          style={{ transition: "all 0.25s ease" }}
        />

        <text
          x="0"
          y="4"
          textAnchor="middle"
          fill={nodeColor}
          fontSize="11"
          fontWeight="800"
          fontFamily="Inter, system-ui, sans-serif"
        >
          {label}
        </text>
      </g>
    </g>
  );
};

/**
 * Compact Live Value Readout — mounted under an equipment's title to show
 * one representative real-time Node-RED/OPC UA tag directly on the flowsheet.
 */
const LiveReadout = ({ y, value, unit, quality }) => {
  const hasData = value !== undefined && value !== null && !Number.isNaN(value);
  const isGood = quality === "Good" || quality === "SIM";
  const dotColor = !hasData ? "#475569" : isGood ? "#34d399" : "#f87171";

  return (
    <g transform={`translate(0, ${y})`} opacity={hasData ? 1 : 0.55} style={{ transition: "opacity 0.3s ease" }}>
      <rect x="-38" y="-9" width="76" height="18" rx="9" fill={CARD_BG} stroke={BASE_STROKE} strokeWidth="1.2" />
      <circle cx="-27" cy="0" r="2.5" fill={dotColor} style={{ animation: hasData && isGood ? "livePulse 1.8s ease-in-out infinite" : "none" }} />
      <text x="-19" y="3" textAnchor="start" fill="#38bdf8" fontSize="9.5" fontWeight="700" fontFamily="Inter, system-ui, sans-serif" letterSpacing="0.2px">
        {hasData ? Number(value).toFixed(1) : "—"}
        <tspan fill="#64748b" fontSize="7.5" dx="2.5">{hasData ? unit : ""}</tspan>
      </text>
    </g>
  );
};

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

const STEP_LABELS = {
  1: "STARTUP STEP 1/5 • FEED INLETS ACTIVATED",
  2: "STARTUP STEP 2/5 • SUMP & SLURRY PUMP ON",
  3: "STARTUP STEP 3/5 • HYDROCYCLONES FEEDING",
  4: "STARTUP STEP 4/5 • OVERFLOW & BALL MILL ON",
  5: "STEADY STATE • CLOSED-CIRCUIT RECYCLE ACTIVE",
};

/**
 * Main Flowsheet Component with Sequential Step-by-Step Simulation Activation & Pristine Symbology
 */
export default function Flowsheet({
  onSelect,
  selected,
  isRunning,
  onSimStepChange,
  onStartToggle,
  onRestart,
  onStop,
  isSimActive,
  simStatus,
  onSpeedChange,
  hideControls = false,
}) {
  const [simStep, setSimStep] = useState(0);
  const [isBoxOpen, setIsBoxOpen] = useState(false);
  const [showHistoricalDrawer, setShowHistoricalDrawer] = useState(false);
  const [historicalTags, setHistoricalTags] = useState({});
  const [showNoderedDrawer, setShowNoderedDrawer] = useState(false);
  const [noderedTags, setNoderedTags] = useState({});
  const [showWhatIfDrawer, setShowWhatIfDrawer] = useState(false);

  // "CY_001" (flowsheet tag) -> "CY001" (MQTT tag_id prefix, no underscore)
  const equipmentPrefix = selected ? selected.replace(/_/g, "").split(".")[0] : null;
  const filterBySelection = (tags) => {
    const entries = Object.entries(tags);
    if (!equipmentPrefix) return entries;
    return entries.filter(([tagId]) => tagId.toUpperCase().startsWith(equipmentPrefix.toUpperCase() + "."));
  };

  useEffect(() => {
    if (!showHistoricalDrawer) return;
    const fetchHistorical = async () => {
      try {
        const data = await getHistoricalTags();
        setHistoricalTags(data);
      } catch (e) {
        console.error("CSV->MQTT publisher tags fetch failed:", e);
      }
    };
    fetchHistorical();
    const timer = setInterval(fetchHistorical, 1000);
    return () => clearInterval(timer);
  }, [showHistoricalDrawer]);

  // Polled continuously (not just while the drawer is open) so the live
  // readouts on the equipment icons themselves stay up to date.
  useEffect(() => {
    const fetchNodered = async () => {
      try {
        const data = await getNoderedTags();
        setNoderedTags(data);
      } catch (e) {
        console.error("Node-RED tags fetch failed:", e);
      }
    };
    fetchNodered();
    const timer = setInterval(fetchNodered, 2000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isRunning) {
      setSimStep(0);
      if (onSimStepChange) onSimStepChange(0);
      return;
    }

    setSimStep(1);
    if (onSimStepChange) onSimStepChange(1);

    const t1 = setTimeout(() => { setSimStep(2); if (onSimStepChange) onSimStepChange(2); }, 1400);
    const t2 = setTimeout(() => { setSimStep(3); if (onSimStepChange) onSimStepChange(3); }, 2800);
    const t3 = setTimeout(() => { setSimStep(4); if (onSimStepChange) onSimStepChange(4); }, 4200);
    const t4 = setTimeout(() => { setSimStep(5); if (onSimStepChange) onSimStepChange(5); }, 5600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [isRunning]);

  const isPipeActive = (tag) => {
    if (!isRunning) return false;
    if (tag === "P_001" || tag === "P_101") return simStep >= 1;
    if (tag === "P_002") return simStep >= 2;
    if (tag === "P_003") return simStep >= 3;
    if (tag === "P_006" || tag === "P_004") return simStep >= 4;
    if (tag === "P_005") return simStep >= 5;
    return false;
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: "#090d16",
        border: "1px solid #1e293b",
        borderRadius: "10px",
        padding: "0.6rem",
        overflow: "hidden",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* CAD Blueprint Background Grid Overlay */}
      <svg
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          opacity: 0.12,
        }}
      >
        <defs>
          <pattern id="cadGrid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#475569" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#cadGrid)" />
      </svg>

      {/* Header Info Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem", flexShrink: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
          <span style={{ color: "#00f0ff", fontWeight: "700", fontSize: "0.8rem", letterSpacing: "1px", textTransform: "uppercase" }}>
            Phosphate Grinding Circuit
          </span>
          {!hideControls && isRunning && (
            <span
              style={{
                background: simStep < 5 ? "rgba(245, 158, 11, 0.18)" : "rgba(16, 185, 129, 0.18)",
                border: simStep < 5 ? "1px solid #f59e0b" : "1px solid #10b981",
                padding: "0.15rem 0.6rem",
                borderRadius: "12px",
                color: simStep < 5 ? "#fbbf24" : "#34d399",
                fontSize: "0.72rem",
                fontWeight: "800",
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                boxShadow: simStep < 5 ? "0 0 12px rgba(245, 158, 11, 0.4)" : "0 0 14px rgba(16, 185, 129, 0.45)",
                transition: "all 0.3s ease",
              }}
            >
              <span className="pulse-dot" /> {STEP_LABELS[simStep] || "SIMULATION ACTIVE"}
            </span>
          )}
        </div>
      </div>

      {/* Capteur virtuel XGBoost du P80 + compteur de l'historien */}
      {!hideControls && <SoftSensorCard />}

      {/* Cool Futuristic HUD Replay Drawer (Expanding Horizontally to the Left) */}
      {!hideControls && (
        <div
          style={{
            position: "absolute",
            bottom: "0.85rem",
            right: "0.85rem",
            zIndex: 30,
            display: "flex",
            flexDirection: "row-reverse",
            alignItems: "center",
            gap: "0.55rem",
          }}
        >
          {/* Main Round Play / Pause Button in the Corner */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              setIsBoxOpen((prev) => !prev);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              background: "rgba(10, 15, 26, 0.92)",
              backdropFilter: "blur(10px)",
              border: `1.5px solid ${isBoxOpen ? "#00f0ff" : "rgba(0, 240, 255, 0.35)"}`,
              borderRadius: "28px",
              padding: "0.25rem 0.5rem 0.25rem 0.25rem",
              cursor: "pointer",
              boxShadow: isBoxOpen
                ? "0 0 16px rgba(0, 240, 255, 0.4), 0 6px 20px rgba(0,0,0,0.6)"
                : "0 6px 20px rgba(0,0,0,0.6)",
              transition: "all 0.25s ease",
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onStartToggle) onStartToggle();
              }}
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: isRunning ? "rgba(245, 158, 11, 0.35)" : "rgba(16, 185, 129, 0.35)",
                border: `2px solid ${isRunning ? "#f59e0b" : "#10b981"}`,
                color: isRunning ? "#fbbf24" : "#34d399",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: isRunning ? "0 0 14px rgba(245, 158, 11, 0.5)" : "0 0 14px rgba(16, 185, 129, 0.5)",
              }}
              title={isRunning ? "Pause Simulation" : "Start Simulation"}
            >
              {isRunning ? <Pause size={17} /> : <Play size={17} style={{ marginLeft: "2px" }} />}
            </button>

            <SlidersHorizontal size={15} style={{ color: isBoxOpen ? "#00f0ff" : "#94a3b8" }} />
            {isBoxOpen ? <ChevronRight size={14} style={{ color: "#00f0ff" }} /> : <ChevronLeft size={14} style={{ color: "#64748b" }} />}
          </div>

          {/* Horizontal Sliding Panel (Expands to the Left) */}
          {isBoxOpen && (
            <div
              style={{
                background: "rgba(10, 15, 26, 0.96)",
                backdropFilter: "blur(14px)",
                border: "1.5px solid rgba(0, 240, 255, 0.45)",
                borderRadius: "24px",
                padding: "0.35rem 0.85rem",
                boxShadow: "0 10px 30px rgba(0, 0, 0, 0.8), 0 0 18px rgba(0, 240, 255, 0.25)",
                display: "flex",
                alignItems: "center",
                gap: "0.85rem",
                whiteSpace: "nowrap",
                boxSizing: "border-box",
                animation: "slideInLeft 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}
            >
              {/* Action Buttons: Restart & Stop */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onRestart) onRestart();
                  }}
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: "rgba(0, 240, 255, 0.18)",
                    border: "1.5px solid #00f0ff",
                    color: "#00f0ff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    boxShadow: "0 0 8px rgba(0, 240, 255, 0.35)",
                  }}
                  title="Restart"
                >
                  <RotateCcw size={13} />
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onStop) onStop();
                  }}
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: "rgba(239, 68, 68, 0.2)",
                    border: "1.5px solid #ef4444",
                    color: "#fca5a5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    boxShadow: "0 0 8px rgba(239, 68, 68, 0.35)",
                  }}
                  title="Stop"
                >
                  <Square size={12} fill="#ef4444" />
                </button>
              </div>

              {/* Speed Multipliers */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                {[1, 10, 60, 600].map((spd) => {
                  const currentSpeed = simStatus?.speed ?? simStatus?.speed_multiplier ?? 1;
                  const isCurrentSpeed = Math.round(currentSpeed) === spd;
                  return (
                    <button
                      key={spd}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onSpeedChange) onSpeedChange(spd);
                      }}
                      style={{
                        background: isCurrentSpeed ? "#00f0ff" : "#162032",
                        color: isCurrentSpeed ? "#0f172a" : "#94a3b8",
                        border: `1px solid ${isCurrentSpeed ? "#00f0ff" : "#334155"}`,
                        borderRadius: "4px",
                        padding: "0.15rem 0.35rem",
                        fontSize: "0.66rem",
                        fontWeight: "800",
                        cursor: "pointer",
                        boxShadow: isCurrentSpeed ? "0 0 8px rgba(0, 240, 255, 0.4)" : "none",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {spd}×
                    </button>
                  );
                })}
              </div>

              {/* Sci-Fi Telemetry Stats */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                  <span style={{ fontSize: "0.52rem", color: "#64748b", fontWeight: "800", letterSpacing: "0.5px" }}>TIME</span>
                  <span style={{ fontSize: "0.68rem", color: "#38bdf8", fontWeight: "800", fontFamily: "monospace" }}>
                    {simStatus?.timestamp || simStatus?.simulation_time || "2026-07-01 00:00:00"}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                  <span style={{ fontSize: "0.52rem", color: "#64748b", fontWeight: "800", letterSpacing: "0.5px" }}>REC</span>
                  <span style={{ fontSize: "0.68rem", color: "#f8fafc", fontWeight: "800", fontFamily: "monospace" }}>
                    {simStatus?.current_record ?? simStatus?.record_index ?? 0} / {simStatus?.total_records ?? 43200}
                  </span>
                </div>

                <div
                  style={{
                    background: "#162032",
                    border: "1px solid #1e293b",
                    borderRadius: "5px",
                    padding: "0.2rem 0.45rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                    fontSize: "0.68rem",
                    color: "#34d399",
                    fontWeight: "800",
                  }}
                >
                  <span className="pulse-dot" /> {simStatus?.mqtt?.total_live_tags ?? 0} Tags
                </div>

                <button
                  onClick={() => setShowHistoricalDrawer((v) => !v)}
                  style={{
                    background: showHistoricalDrawer ? "#7c3aed" : "#162032",
                    border: "1px solid #7c3aed",
                    borderRadius: "5px",
                    padding: "0.2rem 0.5rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.3rem",
                    fontSize: "0.68rem",
                    color: "#c4b5fd",
                    fontWeight: "800",
                    cursor: "pointer",
                  }}
                  title="Donnees publiees par le script Python (mqtt-publisher) qui lit les CSV et les envoie via le broker MQTT"
                >
                  🐍 CSV → MQTT (Python)
                </button>

                <button
                  onClick={() => setShowNoderedDrawer((v) => !v)}
                  style={{
                    background: showNoderedDrawer ? "#0284c7" : "#162032",
                    border: "1px solid #0284c7",
                    borderRadius: "5px",
                    padding: "0.2rem 0.5rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.3rem",
                    fontSize: "0.68rem",
                    color: "#7dd3fc",
                    fontWeight: "800",
                    cursor: "pointer",
                  }}
                  title="Donnees publiees par Node-RED depuis KEPServerEX (OPC UA) via le broker MQTT"
                >
                  🔌 Node-RED (OPC UA)
                </button>

                <button
                  onClick={() => setShowWhatIfDrawer((v) => !v)}
                  style={{
                    background: showWhatIfDrawer ? "#10b981" : "#162032",
                    border: "1px solid #10b981",
                    borderRadius: "5px",
                    padding: "0.2rem 0.5rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.3rem",
                    fontSize: "0.68rem",
                    color: showWhatIfDrawer ? "#0f172a" : "#6ee7b7",
                    fontWeight: "800",
                    cursor: "pointer",
                  }}
                  title="Simulateur what-if base sur un modele ML entraine sur l'historique reel du circuit"
                >
                  🧪 What-If (ML)
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CSV -> MQTT Python Publisher Drawer */}
      {showHistoricalDrawer && (
        <div
          style={{
            position: "fixed", top: 0, right: 0, width: "380px", height: "100vh",
            background: "#0f172a", borderLeft: "1px solid #7c3aed",
            boxShadow: "-5px 0 25px rgba(0,0,0,0.5)", zIndex: 10000,
            display: "flex", flexDirection: "column", padding: "1rem", boxSizing: "border-box",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", borderBottom: "1px solid #1e293b", paddingBottom: "0.5rem" }}>
            <span style={{ color: "#c4b5fd", fontWeight: "800", fontSize: "0.85rem" }}>🐍 Publisher Python (CSV → MQTT)</span>
            <button onClick={() => setShowHistoricalDrawer(false)} style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: "1.1rem", cursor: "pointer" }}>✕</button>
          </div>
          <div style={{ color: "#64748b", fontSize: "0.68rem", marginBottom: "0.4rem" }}>
            Données publiées par le conteneur mqtt-publisher (lecture directe des CSV, envoi via le broker MQTT).
          </div>
          {equipmentPrefix && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.6rem", background: "#2e1065", border: "1px solid #7c3aed", borderRadius: "5px", padding: "0.35rem 0.6rem" }}>
              <span style={{ color: "#e9d5ff", fontSize: "0.72rem", fontWeight: "700" }}>Filtré sur : {equipmentPrefix}</span>
              <button onClick={() => onSelect && onSelect(null)} style={{ marginLeft: "auto", background: "transparent", border: "none", color: "#c4b5fd", fontSize: "0.68rem", cursor: "pointer", textDecoration: "underline" }}>
                Tout afficher
              </button>
            </div>
          )}
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.45rem" }}>
            {filterBySelection(historicalTags).length === 0 ? (
              <div style={{ color: "#64748b", textAlign: "center", padding: "2rem 0", fontSize: "0.78rem" }}>
                {Object.keys(historicalTags).length === 0
                  ? "Aucune donnée reçue — vérifie que le conteneur mqtt-publisher tourne (docker compose up mqtt-publisher)."
                  : `Aucun tag pour ${equipmentPrefix}.`}
              </div>
            ) : (
              filterBySelection(historicalTags).map(([tagId, payload]) => (
                <div key={tagId} style={{ background: "#1e1b3a", border: "1px solid #7c3aed", borderRadius: "6px", padding: "0.5rem", fontSize: "0.7rem" }}>
                  <div style={{ color: "#c4b5fd", fontWeight: "700", fontFamily: "monospace" }}>{tagId}</div>
                  <div style={{ color: "#ddd6fe", fontFamily: "monospace", fontSize: "0.68rem" }}>
                    {payload.value?.toFixed?.(2) ?? payload.value} {payload.unit}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Node-RED / KEPServerEX OPC UA Drawer */}
      {showNoderedDrawer && (
        <div
          style={{
            position: "fixed", top: 0, right: 0, width: "380px", height: "100vh",
            background: "#0f172a", borderLeft: "1px solid #0284c7",
            boxShadow: "-5px 0 25px rgba(0,0,0,0.5)", zIndex: 10000,
            display: "flex", flexDirection: "column", padding: "1rem", boxSizing: "border-box",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", borderBottom: "1px solid #1e293b", paddingBottom: "0.5rem" }}>
            <span style={{ color: "#7dd3fc", fontWeight: "800", fontSize: "0.85rem" }}>🔌 Node-RED (KEPServerEX / OPC UA)</span>
            <button onClick={() => setShowNoderedDrawer(false)} style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: "1.1rem", cursor: "pointer" }}>✕</button>
          </div>
          <div style={{ color: "#64748b", fontSize: "0.68rem", marginBottom: "0.4rem" }}>
            Données publiées par le flow Node-RED, abonné en OPC UA à KEPServerEX, republiées via le broker MQTT.
          </div>
          {equipmentPrefix && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.6rem", background: "#0c2b47", border: "1px solid #0284c7", borderRadius: "5px", padding: "0.35rem 0.6rem" }}>
              <span style={{ color: "#bae6fd", fontSize: "0.72rem", fontWeight: "700" }}>Filtré sur : {equipmentPrefix}</span>
              <button onClick={() => onSelect && onSelect(null)} style={{ marginLeft: "auto", background: "transparent", border: "none", color: "#7dd3fc", fontSize: "0.68rem", cursor: "pointer", textDecoration: "underline" }}>
                Tout afficher
              </button>
            </div>
          )}
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.7rem" }}>
            {(() => {
              const filteredEntries = filterBySelection(noderedTags);
              if (filteredEntries.length === 0) {
                return (
                  <div style={{ color: "#64748b", textAlign: "center", padding: "2rem 0", fontSize: "0.78rem" }}>
                    {Object.keys(noderedTags).length === 0
                      ? "Aucune donnée reçue — vérifie que Node-RED est déployé et connecté au broker."
                      : `Aucun tag pour ${equipmentPrefix}.`}
                  </div>
                );
              }
              const filteredMap = Object.fromEntries(filteredEntries);
              return groupTagsForDrawer(filteredMap).map(([groupKey, items]) => {
                const [equip, context] = groupKey.split(".");
                return (
                  <div key={groupKey}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "0.4rem", marginBottom: "0.3rem" }}>
                      <span style={{ color: "#7dd3fc", fontWeight: "800", fontSize: "0.74rem", fontFamily: "monospace" }}>{equip}</span>
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
                              background: "#0c2338",
                              border: "1px solid #164e63",
                              borderRadius: "5px",
                              padding: "0.35rem 0.55rem",
                              fontSize: "0.72rem",
                            }}
                          >
                            <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "#94a3b8", fontFamily: "monospace" }}>
                              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: isGood ? "#34d399" : "#f87171", flexShrink: 0 }} />
                              {param}
                            </span>
                            <span style={{ color: "#bae6fd", fontFamily: "monospace", fontWeight: "700" }}>
                              {typeof item.value === "number" ? item.value.toFixed(2) : item.value} {item.unit}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      <WhatIfPanel isOpen={showWhatIfDrawer} onClose={() => setShowWhatIfDrawer(false)} />

      {/* Main Process Flow Diagram SVG */}
      <svg
        viewBox={`0 0 ${LAYOUT.canvas.width} ${LAYOUT.canvas.height}`}
        preserveAspectRatio="xMidYMid meet"
        onClick={(e) => {
          if (e.target.tagName === "svg" || e.target.id === "cadGrid") {
            if (onSelect) onSelect(null);
          }
        }}
        style={{ width: "100%", height: "100%", flex: 1, display: "block" }}
      >
        <style>{`
          @keyframes flowDash {
            0% { stroke-dashoffset: 24; }
            100% { stroke-dashoffset: 0; }
          }
          @keyframes spinImpeller {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes pulseGirthGear {
            0% { stroke: #f59e0b; filter: drop-shadow(0 0 2px #f59e0b); }
            50% { stroke: #00f0ff; filter: drop-shadow(0 0 10px #00f0ff); }
            100% { stroke: #f59e0b; filter: drop-shadow(0 0 2px #f59e0b); }
          }
          @keyframes waveLiquid {
            0% { transform: translateY(0px); }
            50% { transform: translateY(-3px); }
            100% { transform: translateY(0px); }
          }
          @keyframes vortexCyclone {
            0% { stroke-opacity: 0.3; }
            50% { stroke-opacity: 1; }
            100% { stroke-opacity: 0.3; }
          }
          @keyframes rotateShellLines {
            0% { transform: translateY(-16px); opacity: 0.3; }
            50% { opacity: 1; }
            100% { transform: translateY(16px); opacity: 0.3; }
          }
          @keyframes livePulse {
            0% { opacity: 0.5; r: 2.5; }
            50% { opacity: 1; r: 3; }
            100% { opacity: 0.5; r: 2.5; }
          }
          .flowsheet-equipment {
            transition: transform 0.25s ease, filter 0.25s ease;
          }
          .flowsheet-equipment:hover {
            filter: ${HOVER_GLOW_FILTER} !important;
          }
          .flowsheet-pipe {
            transition: filter 0.25s ease;
          }
        `}</style>

        {/* 1. PIPES LAYER (Rendered underneath equipment & labels) */}
        {Object.entries(LAYOUT.pipes).map(([key, p]) => (
          <PipeLine
            key={key}
            tag={p.tag}
            points={p.points}
            color={p.color}
            selected={selected}
            onSelect={onSelect}
            isRunning={isRunning}
            isStepActive={isPipeActive(p.tag)}
          />
        ))}

        {/* 2. FEED INPUTS & DISCHARGE OUTPUTS LAYER */}
        <StreamNode
          label={LAYOUT.nodes.Slurry_In.label}
          tag={LAYOUT.nodes.Slurry_In.tag}
          x={LAYOUT.nodes.Slurry_In.x}
          y={LAYOUT.nodes.Slurry_In.y}
          color="#10b981"
          type="input"
          selected={selected}
          onSelect={onSelect}
        />
        <StreamNode
          label={LAYOUT.nodes.Process_Water.label}
          tag={LAYOUT.nodes.Process_Water.tag}
          x={LAYOUT.nodes.Process_Water.x}
          y={LAYOUT.nodes.Process_Water.y}
          color="#3b82f6"
          type="input"
          selected={selected}
          onSelect={onSelect}
        />
        <StreamNode
          label={LAYOUT.nodes.Slurry_Out.label}
          tag={LAYOUT.nodes.Slurry_Out.tag}
          x={LAYOUT.nodes.Slurry_Out.x}
          y={LAYOUT.nodes.Slurry_Out.y}
          color="#10b981"
          type="output"
          selected={selected}
          onSelect={onSelect}
        />

        {/* 3. PRIMARY INDUSTRIAL EQUIPMENT LAYER */}
        <PumpBox
          tag="PB_001"
          x={LAYOUT.equipment.PB_001.x}
          y={LAYOUT.equipment.PB_001.y}
          selected={selected}
          onSelect={onSelect}
          isRunning={isRunning}
          isStepActive={simStep >= 2}
          liveReadout={noderedTags["PB001.IN.SolidFlow"]}
        />
        <Pump
          tag="SP_001"
          x={LAYOUT.equipment.SP_001.x}
          y={LAYOUT.equipment.SP_001.y}
          selected={selected}
          onSelect={onSelect}
          isRunning={isRunning}
          isStepActive={simStep >= 2}
          liveReadout={noderedTags["SP001.HEALTH.MotorCurrent"]}
        />
        <Hydrocyclone
          tag="CY_001"
          x={LAYOUT.equipment.CY_001.x}
          y={LAYOUT.equipment.CY_001.y}
          selected={selected}
          onSelect={onSelect}
          isRunning={isRunning}
          isStepActive={simStep >= 3}
          liveReadout={noderedTags["CY001.FEED.SolidFlow"]}
        />
        <BallMill
          tag="BM_001"
          x={LAYOUT.equipment.BM_001.x}
          y={LAYOUT.equipment.BM_001.y}
          selected={selected}
          onSelect={onSelect}
          isRunning={isRunning}
          isStepActive={simStep >= 4}
          liveReadout={noderedTags["BM001.HEALTH.PowerDraw"]}
        />

        {/* 4. PIPE TAG LABELS LAYER */}
        {Object.entries(LAYOUT.pipes).map(([key, p]) => (
          <PipeLabel
            key={key}
            tag={p.tag}
            labelPos={p.labelPos}
            color={p.color}
            selected={selected}
            onSelect={onSelect}
          />
        ))}

        {/* 5. HYDROCYCLONE OVERFLOW & UNDERFLOW CLASSIFIER STREAM BADGES */}
        <StreamClassifierBadge
          label="OVERFLOW"
          tag="P_006"
          x={840}
          y={52}
          selected={selected}
          onSelect={onSelect}
        />
        <StreamClassifierBadge
          label="UNDERFLOW"
          tag="P_004"
          x={640}
          y={236}
          selected={selected}
          onSelect={onSelect}
        />
      </svg>
    </div>
  );
}

/**
 * Visual Stream Classifier Badge for Hydrocyclone OVERFLOW & UNDERFLOW streams.
 * Uses exact same visual colors and styling as machine titles (EquipmentTitle).
 */
function StreamClassifierBadge({ label, tag, x, y, selected, onSelect }) {
  const isSelected = selected === tag;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onClick={(e) => {
        e.stopPropagation();
        if (onSelect) onSelect(tag);
      }}
      style={{ cursor: "pointer" }}
    >
      <rect
        x="-52"
        y="-10"
        width="104"
        height="20"
        rx="5"
        fill={isSelected ? "#1e293b" : "#0f172a"}
        stroke={isSelected ? "#ffffff" : "#334155"}
        strokeWidth="1.5"
        style={{ transition: "stroke 0.2s ease, fill 0.2s ease" }}
      />
      <text
        x="0"
        y="3.5"
        textAnchor="middle"
        fill={isSelected ? "#ffffff" : "#94a3b8"}
        fontSize="10"
        fontWeight="800"
        fontFamily="Inter, system-ui, sans-serif"
        letterSpacing="0.8px"
      >
        {label}
      </text>
    </g>
  );
}
