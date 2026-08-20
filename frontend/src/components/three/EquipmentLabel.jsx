import React from "react";
import { Html } from "@react-three/drei";

/**
 * Floating tag + live-value label mounted above 3D equipment, styled to
 * match the 2D flowsheet's TagBadge/LiveReadout pill (dark fill, slate
 * border, cyan text) so the two views read as one consistent app.
 */
export default function EquipmentLabel({ tag, y = 1, value, unit, isGood = true }) {
  const hasData = value !== undefined && value !== null && !Number.isNaN(value);

  return (
    <Html position={[0, y, 0]} center distanceFactor={9} zIndexRange={[10, 0]} occlude={false}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "2px",
          pointerEvents: "none",
          userSelect: "none",
          whiteSpace: "nowrap",
        }}
      >
        <div
          style={{
            background: "#162032",
            border: "1.5px solid #475569",
            borderRadius: "4px",
            padding: "1px 8px",
            color: "#38bdf8",
            fontSize: "11px",
            fontWeight: 800,
            fontFamily: "Inter, system-ui, sans-serif",
            letterSpacing: "0.5px",
          }}
        >
          {tag}
        </div>
        {hasData && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: "9px",
              padding: "1px 8px",
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            <span
              style={{
                width: "5px",
                height: "5px",
                borderRadius: "50%",
                background: isGood ? "#34d399" : "#f87171",
              }}
            />
            <span style={{ color: "#38bdf8", fontSize: "9.5px", fontWeight: 700 }}>
              {typeof value === "number" ? value.toFixed(1) : value}
              <span style={{ color: "#64748b", marginLeft: "3px" }}>{unit}</span>
            </span>
          </div>
        )}
      </div>
    </Html>
  );
}
