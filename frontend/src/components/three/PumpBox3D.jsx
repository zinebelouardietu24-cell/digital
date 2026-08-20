import React, { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import EquipmentLabel from "./EquipmentLabel";

/**
 * Pump Box / Sump (PB_001) — open-top hopper tank with inlet flanges and an
 * actual slurry surface plane inside whose height maps to the real
 * PB001_Level_pct sump-level signal (not decorative).
 */
export default function PumpBox3D({
  position,
  isSelected,
  isRunning,
  levelPct = 50,
  sumpTempC = 25,
  onSelect,
}) {
  const [hovered, setHovered] = useState(false);
  const slurryRef = useRef();

  const TANK_HEIGHT = 1.3;
  const TANK_TOP_RADIUS = 0.62;
  const TANK_BOTTOM_RADIUS = 0.4;
  const clampedLevel = Math.max(2, Math.min(98, levelPct));
  const slurryY = -TANK_HEIGHT / 2 + (clampedLevel / 100) * TANK_HEIGHT * 0.85;

  useFrame((state) => {
    if (slurryRef.current) {
      const wave = isRunning ? Math.sin(state.clock.elapsedTime * 1.6) * 0.015 : 0;
      slurryRef.current.position.y = slurryY + wave;
    }
  });

  // Murkier / warmer tint as sump temperature rises
  const slurryColor = sumpTempC >= 35 ? "#6b4a2e" : sumpTempC >= 30 ? "#5a4030" : "#4a3d33";

  return (
    <group position={position}>
      <group
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        {/* Hopper body — tapered tank, open top */}
        <mesh position={[0, 0, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[TANK_TOP_RADIUS, TANK_BOTTOM_RADIUS, TANK_HEIGHT, 24, 1, true]} />
          <meshPhysicalMaterial
            color="#3a4356"
            metalness={0.65}
            roughness={0.45}
            clearcoat={0.25}
            clearcoatRoughness={0.35}
            side={2}
            emissive={isSelected || hovered ? "#00f0ff" : "#000000"}
            emissiveIntensity={isSelected ? 0.09 : hovered ? 0.045 : 0}
          />
        </mesh>

        {/* Access ladder on the exterior wall */}
        <group position={[TANK_TOP_RADIUS * 0.55, 0, TANK_TOP_RADIUS * 0.75]}>
          <mesh position={[-0.14, 0, 0]} castShadow>
            <boxGeometry args={[0.03, TANK_HEIGHT * 0.85, 0.03]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.75} roughness={0.35} />
          </mesh>
          <mesh position={[0.14, 0, 0]} castShadow>
            <boxGeometry args={[0.03, TANK_HEIGHT * 0.85, 0.03]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.75} roughness={0.35} />
          </mesh>
          {Array.from({ length: 5 }, (_, i) => (
            <mesh key={i} position={[0, -TANK_HEIGHT * 0.38 + i * (TANK_HEIGHT * 0.76) / 4, 0]} castShadow>
              <boxGeometry args={[0.3, 0.025, 0.025]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.75} roughness={0.35} />
            </mesh>
          ))}
        </group>

        {/* Top rim flange */}
        <mesh position={[0, TANK_HEIGHT / 2, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[TANK_TOP_RADIUS, 0.035, 8, 32]} />
          <meshStandardMaterial color="#5b6b82" metalness={0.7} roughness={0.35} />
        </mesh>

        {/* Slurry surface inside the tank — real level, not decorative */}
        <mesh ref={slurryRef} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[TANK_TOP_RADIUS * 0.94, 32]} />
          <meshStandardMaterial color={slurryColor} roughness={0.35} metalness={0.1} transparent opacity={0.92} />
        </mesh>

        {/* Bottom spout outlet */}
        <mesh position={[0, -TANK_HEIGHT / 2 - 0.22, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.22, 0.24, 0.4, 16]} />
          <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.5} />
        </mesh>

        {/* Inlet nozzle flange (process water / feed) */}
        <mesh position={[-TANK_TOP_RADIUS - 0.15, 0.3, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.13, 0.14, 0.3, 14]} />
          <meshStandardMaterial color="#5b6b82" metalness={0.7} roughness={0.4} />
        </mesh>

        {/* Support legs */}
        {[-0.4, 0.4].map((x) => (
          <mesh key={x} position={[x, -TANK_HEIGHT / 2 - 0.55, 0.3 * Math.sign(x)]} castShadow>
            <boxGeometry args={[0.1, 0.7, 0.1]} />
            <meshStandardMaterial color="#1e293b" metalness={0.4} roughness={0.7} />
          </mesh>
        ))}

        <mesh visible={false}>
          <boxGeometry args={[1.8, 2.4, 1.8]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      </group>

      <EquipmentLabel tag="PB_001" y={TANK_HEIGHT / 2 + 0.55} value={levelPct} unit="% level" isGood={isRunning} />
    </group>
  );
}
