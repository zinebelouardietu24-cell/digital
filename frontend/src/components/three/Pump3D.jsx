import React, { useRef, useMemo, useState } from "react";
import { useFrame } from "@react-three/fiber";
import EquipmentLabel from "./EquipmentLabel";

function tempColor(tempC) {
  if (tempC >= 70) return "#f87171";
  if (tempC >= 55) return "#f59e0b";
  return "#38bdf8";
}

/**
 * Centrifugal Slurry Pump (SP_001) — volute casing viewed face-on (shaft
 * axis into the scene, matching the 2D flowsheet's front-facing impeller),
 * motor + coupling guard, bolted suction/discharge flanges.
 * Impeller spin rate is driven by the real SP001_Speed_RPM signal — scaled
 * down from the literal RPM for on-screen legibility, but strictly
 * proportional to it (zero RPM -> zero spin, monotonic otherwise).
 */
export default function Pump3D({
  position,
  isSelected,
  isRunning,
  speedRpm = 0,
  dischargePressureKpa = 0,
  bearingTempC = 40,
  vibrationMms = 0,
  onSelect,
}) {
  const [hovered, setHovered] = useState(false);
  const impellerRef = useRef();
  const rootGroup = useRef();

  const boltRing = useMemo(() => Array.from({ length: 10 }, (_, i) => (i / 10) * Math.PI * 2), []);

  useFrame((state, delta) => {
    const visualRadPerSec = isRunning ? (speedRpm / 1500) * 9 : 0;
    if (impellerRef.current) impellerRef.current.rotation.z -= visualRadPerSec * delta;

    if (rootGroup.current) {
      const jitter = isRunning ? Math.min(0.01, vibrationMms * 0.003) : 0;
      rootGroup.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 26) * jitter;
    }
  });

  const bearingColor = tempColor(bearingTempC);

  return (
    <group ref={rootGroup} position={position}>
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
        {/* Base skid */}
        <mesh position={[0, -0.55, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.5, 0.18, 0.9]} />
          <meshStandardMaterial color="#1e293b" metalness={0.4} roughness={0.7} />
        </mesh>

        {/* Volute casing (flattened cylinder, axis toward viewer) */}
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.62, 0.62, 0.5, 32]} />
          <meshPhysicalMaterial
            color="#3a4356"
            metalness={0.75}
            roughness={0.32}
            clearcoat={0.35}
            clearcoatRoughness={0.25}
            emissive={isSelected || hovered ? "#00f0ff" : "#000000"}
            emissiveIntensity={isSelected ? 0.1 : hovered ? 0.05 : 0}
          />
        </mesh>

        {/* Front cover plate with bolt ring — faces viewer, holds visible impeller behind translucent-ish rim */}
        <mesh position={[0, 0, 0.26]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.66, 0.66, 0.05, 32]} />
          <meshStandardMaterial color="#293145" metalness={0.65} roughness={0.4} />
        </mesh>
        {boltRing.map((angle, i) => (
          <mesh key={i} position={[Math.cos(angle) * 0.58, Math.sin(angle) * 0.58, 0.29]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.035, 0.035, 0.06, 8]} />
            <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.3} />
          </mesh>
        ))}

        {/* Impeller (visible through the open face, spins with real speed data) */}
        <group ref={impellerRef} position={[0, 0, 0.1]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.08, 0.12, 16]} />
            <meshStandardMaterial color="#0f172a" metalness={0.6} roughness={0.35} />
          </mesh>
          {[0, 1, 2, 3, 4].map((i) => {
            const angle = (i / 5) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(angle) * 0.3, Math.sin(angle) * 0.3, 0]} rotation={[0, 0, angle]} castShadow>
                <boxGeometry args={[0.42, 0.09, 0.05]} />
                <meshStandardMaterial
                  color={isRunning || isSelected ? "#00c8dc" : "#334155"}
                  metalness={0.6}
                  roughness={0.35}
                  emissive={isRunning ? "#00c8dc" : "#000000"}
                  emissiveIntensity={isRunning ? 0.25 : 0}
                />
              </mesh>
            );
          })}
        </group>

        {/* Discharge nozzle (top) */}
        <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.18, 0.2, 0.5, 16]} />
          <meshStandardMaterial color="#5b6b82" metalness={0.75} roughness={0.4} />
        </mesh>

        {/* Suction nozzle (side) */}
        <mesh position={[-0.75, -0.15, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
          <cylinderGeometry args={[0.17, 0.19, 0.5, 16]} />
          <meshStandardMaterial color="#5b6b82" metalness={0.75} roughness={0.4} />
        </mesh>

        {/* Shaft + coupling guard toward the motor */}
        <mesh position={[0, 0, -0.55]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.06, 0.4, 12]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.25} />
        </mesh>

        {/* Bearing housing — temperature-tinted */}
        <mesh position={[0, 0, -0.78]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.16, 0.16, 0.28, 16]} />
          <meshStandardMaterial color={bearingColor} metalness={0.5} roughness={0.4} emissive={bearingColor} emissiveIntensity={0.15} />
        </mesh>

        {/* Motor block */}
        <mesh position={[0, 0, -1.25]} castShadow receiveShadow>
          <boxGeometry args={[0.75, 0.75, 0.65]} />
          <meshStandardMaterial color="#1e293b" metalness={0.55} roughness={0.45} />
        </mesh>
        <mesh position={[0, 0, -1.65]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.34, 0.34, 0.7, 20]} />
          <meshStandardMaterial color="#161f30" metalness={0.6} roughness={0.35} />
        </mesh>

        <mesh visible={false}>
          <boxGeometry args={[2.6, 1.8, 2.6]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      </group>

      <EquipmentLabel tag="SP_001" y={1.15} value={dischargePressureKpa} unit="kPa" isGood={isRunning} />
    </group>
  );
}
