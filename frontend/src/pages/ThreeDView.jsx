import React, { useEffect, useState, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { LAYOUT } from "./Flowsheet";
import SceneEnvironment from "../components/three/SceneEnvironment";
import SelectionRing from "../components/three/SelectionRing";
import Pipe3D from "../components/three/Pipe3D";
import PumpBox3D from "../components/three/PumpBox3D";
import Pump3D from "../components/three/Pump3D";
import Hydrocyclone3D from "../components/three/Hydrocyclone3D";
import BallMill3D from "../components/three/BallMill3D";
import { API_BASE } from "../config/api.config";

// Maps the 2D flowsheet canvas (1120x580, from Flowsheet.jsx LAYOUT) onto
// the 3D scene's X/Z plane, so the circuit's spatial arrangement is the
// same one already established in the 2D view — not an arbitrary new layout.
const SCALE = 0.02;
function to3D(x2d, y2d, height) {
  return [(x2d - LAYOUT.canvas.width / 2) * SCALE, height, (y2d - LAYOUT.canvas.height / 2) * SCALE];
}

const EQUIPMENT_HEIGHT = {
  PB_001: 0.75,
  SP_001: 0.65,
  CY_001: 1.9,
  BM_001: 1.0,
};

const PIPE_HEIGHTS = {
  P_001: [0.9, 0.9],
  P_101: [0.55, 0.55],
  P_002: [0.3, 0.5],
  P_003: [1.4, 2.7],
  P_006: [2.9, 2.9],
  P_004: [0.6, 1.0],
  P_005: [1.0, 1.0],
};

function buildPipePoints(tag) {
  const pipe = LAYOUT.pipes[tag];
  const [hStart, hEnd] = PIPE_HEIGHTS[tag] || [1, 1];
  const n = pipe.points.length;
  return pipe.points.map(([x, y], i) => {
    const t = n > 1 ? i / (n - 1) : 0;
    return to3D(x, y, hStart + (hEnd - hStart) * t);
  });
}

const EMPTY_ASSET = { live_metrics: {}, derived_metrics: {} };

/**
 * Realistic, data-driven 3D digital twin of the grinding circuit. Polls all
 * 4 equipment's live/derived metrics continuously (independent of which
 * equipment is selected) so every piece of equipment animates in real time,
 * not just the selected one.
 */
export default function ThreeDView({ onSelect, selected, isRunning }) {
  const [assets, setAssets] = useState({
    PB_001: EMPTY_ASSET,
    SP_001: EMPTY_ASSET,
    CY_001: EMPTY_ASSET,
    BM_001: EMPTY_ASSET,
  });

  useEffect(() => {
    let cancelled = false;
    const fetchAll = async () => {
      const tags = ["PB_001", "SP_001", "CY_001", "BM_001"];
      const results = await Promise.all(
        tags.map(async (tag) => {
          try {
            const res = await fetch(`${API_BASE}/api/assets/${tag}`);
            if (!res.ok) return [tag, EMPTY_ASSET];
            return [tag, await res.json()];
          } catch {
            return [tag, EMPTY_ASSET];
          }
        })
      );
      if (!cancelled) {
        setAssets(Object.fromEntries(results));
      }
    };
    fetchAll();
    const interval = setInterval(fetchAll, 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const pb = assets.PB_001.live_metrics || {};
  const pbDerived = assets.PB_001.derived_metrics || {};
  const sp = assets.SP_001.live_metrics || {};
  const spDerived = assets.SP_001.derived_metrics || {};
  const cy = assets.CY_001.live_metrics || {};
  const cyDerived = assets.CY_001.derived_metrics || {};
  const bm = assets.BM_001.live_metrics || {};
  const bmDerived = assets.BM_001.derived_metrics || {};

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", background: "#0a0e17" }}>
      <div
        style={{
          position: "absolute",
          top: "0.85rem",
          left: "1rem",
          zIndex: 5,
          color: "#38bdf8",
          fontWeight: 700,
          fontSize: "0.8rem",
          letterSpacing: "1px",
          textTransform: "uppercase",
          pointerEvents: "none",
        }}
      >
        3D Digital Twin — Phosphate Grinding Circuit
      </div>

      <Canvas
        shadows
        camera={{ position: [7, 5.2, 9.5], fov: 48 }}
        onPointerMissed={() => onSelect?.(null)}
        style={{ width: "100%", height: "100%" }}
      >
        <Suspense fallback={null}>
          <SceneEnvironment />

          <PumpBox3D
            position={to3D(LAYOUT.equipment.PB_001.x, LAYOUT.equipment.PB_001.y, EQUIPMENT_HEIGHT.PB_001)}
            isSelected={selected === "PB_001"}
            isRunning={isRunning}
            levelPct={pb.PB001_Level_pct ?? 50}
            sumpTempC={pb.PB001_Sump_Temp_C ?? 25}
            onSelect={() => onSelect?.("PB_001")}
          />

          <Pump3D
            position={to3D(LAYOUT.equipment.SP_001.x, LAYOUT.equipment.SP_001.y, EQUIPMENT_HEIGHT.SP_001)}
            isSelected={selected === "SP_001"}
            isRunning={isRunning}
            speedRpm={sp.SP001_Speed_RPM ?? 0}
            dischargePressureKpa={sp.SP001_Discharge_Pressure_kPa ?? 0}
            bearingTempC={sp.SP001_Bearing_Temp_C ?? 40}
            vibrationMms={sp.SP001_Vibration_mms ?? 0}
            onSelect={() => onSelect?.("SP_001")}
          />

          <Hydrocyclone3D
            position={to3D(LAYOUT.equipment.CY_001.x, LAYOUT.equipment.CY_001.y, EQUIPMENT_HEIGHT.CY_001)}
            isSelected={selected === "CY_001"}
            isRunning={isRunning}
            feedFlow={cyDerived.feed_flow ?? 0}
            cyclonesOnline={cy.CY001_Cyclones_Online ?? 3}
            apexWearPct={cy.CY001_Apex_Wear_Index_pct ?? 0}
            onSelect={() => onSelect?.("CY_001")}
          />

          <BallMill3D
            position={to3D(LAYOUT.equipment.BM_001.x, LAYOUT.equipment.BM_001.y, EQUIPMENT_HEIGHT.BM_001)}
            isSelected={selected === "BM_001"}
            isRunning={isRunning}
            speedPctCritical={bm.BM001_Mill_Speed_pctCritical ?? 0}
            powerDrawKw={bm.BM001_Power_Draw_kW ?? 0}
            bearingDeTemp={bm.BM001_Bearing_DE_Temp_C ?? 40}
            bearingNdeTemp={bm.BM001_Bearing_NDE_Temp_C ?? 40}
            vibrationMms={bm.BM001_Vibration_mms ?? 0}
            onSelect={() => onSelect?.("BM_001")}
          />

          <Pipe3D points={buildPipePoints("P_001")} isRunning={isRunning} flowRate={pbDerived.total_inflow ?? 0} />
          <Pipe3D points={buildPipePoints("P_101")} isRunning={isRunning} flowRate={pbDerived.total_inflow ?? 0} />
          <Pipe3D points={buildPipePoints("P_002")} isRunning={isRunning} flowRate={spDerived.suction_flow ?? 0} />
          <Pipe3D points={buildPipePoints("P_003")} isRunning={isRunning} flowRate={spDerived.discharge_flow ?? 0} />
          <Pipe3D points={buildPipePoints("P_004")} isRunning={isRunning} flowRate={cyDerived.underflow_flow ?? 0} />
          <Pipe3D points={buildPipePoints("P_006")} isRunning={isRunning} flowRate={cyDerived.overflow_flow ?? 0} />
          <Pipe3D points={buildPipePoints("P_005")} isRunning={isRunning} flowRate={bmDerived.output_flow ?? 0} />

          {selected && LAYOUT.equipment[selected] && (
            <SelectionRing
              position={to3D(LAYOUT.equipment[selected].x, LAYOUT.equipment[selected].y, 0)}
              radius={selected === "CY_001" ? 1.6 : selected === "BM_001" ? 1.9 : 1.1}
            />
          )}

          <OrbitControls
            makeDefault
            target={[0, 1.2, 0]}
            minDistance={3}
            maxDistance={20}
            maxPolarAngle={Math.PI / 2.05}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
