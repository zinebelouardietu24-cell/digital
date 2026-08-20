import React, { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import EquipmentLabel from "./EquipmentLabel";

function wearColor(wearPct) {
  if (wearPct >= 25) return "#f87171";
  if (wearPct >= 12) return "#f59e0b";
  return "#94a3b8";
}

/**
 * A single cyclone cone unit: cylindrical top section, tapered cone body,
 * vortex finder pipe on top, apex spigot at the bottom.
 */
function CycloneCone({ offsetX, online, wearPct, swirlIntensity, isRunning, label }) {
  const swirlRef = useRef();
  const dimmed = !online;

  useFrame((_, delta) => {
    if (swirlRef.current && isRunning && online) {
      swirlRef.current.rotation.y += delta * (2 + swirlIntensity * 4);
    }
  });

  const bodyColor = dimmed ? "#334155" : "#3a4356";
  const apexColor = dimmed ? "#334155" : wearColor(wearPct);

  return (
    <group position={[offsetX, 0, 0]}>
      {/* Vortex finder */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, 0.3, 16]} />
        <meshStandardMaterial color="#5b6b82" metalness={0.75} roughness={0.35} />
      </mesh>

      {/* Cylindrical top section */}
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.32, 0.32, 0.4, 24]} />
        <meshPhysicalMaterial color={bodyColor} metalness={0.72} roughness={0.32} clearcoat={0.3} clearcoatRoughness={0.3} />
      </mesh>

      {/* Feed inlet nozzle connecting the manifold down into the top section */}
      <mesh position={[0, 0.5, 0.15]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.07, 0.35, 12]} />
        <meshStandardMaterial color="#5b6b82" metalness={0.75} roughness={0.35} />
      </mesh>

      {/* Tapered cone body — rotated so the narrow apex points down (ConeGeometry's apex faces +Y by default) */}
      <mesh position={[0, -0.35, 0]} rotation={[Math.PI, 0, 0]} castShadow receiveShadow>
        <coneGeometry args={[0.32, 0.9, 24]} />
        <meshPhysicalMaterial color={bodyColor} metalness={0.72} roughness={0.32} clearcoat={0.3} clearcoatRoughness={0.3} />
      </mesh>

      {/* Apex spigot — worn/discolored based on real wear index */}
      <mesh position={[0, -0.88, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.06, 0.16, 12]} />
        <meshStandardMaterial color={apexColor} metalness={0.5} roughness={0.55} emissive={apexColor} emissiveIntensity={dimmed ? 0 : 0.1} />
      </mesh>

      {/* Swirling vortex indicator inside the cone (visual only, driven by real flow) */}
      {isRunning && online && (
        <mesh ref={swirlRef} position={[0, -0.1, 0]}>
          <torusGeometry args={[0.14, 0.015, 6, 20]} />
          <meshBasicMaterial color="#00f0ff" transparent opacity={0.55} />
        </mesh>
      )}
    </group>
  );
}

/**
 * Hydrocyclone Cluster (CY_001) — 3 parallel cone units on a shared feed
 * manifold, matching the 2D flowsheet's A/B/C cluster. Cones dim/inactive
 * when CY001_Cyclones_Online drops below 3, matching the real signal.
 */
export default function Hydrocyclone3D({
  position,
  isSelected,
  isRunning,
  feedFlow = 0,
  cyclonesOnline = 3,
  apexWearPct = 0,
  onSelect,
}) {
  const [hovered, setHovered] = useState(false);
  const rootGroup = useRef();
  const swirlIntensity = Math.min(1, feedFlow / 1500);

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
        {/* Shared feed manifold header — rim-lit cyan when selected/hovered */}
        <mesh position={[0, 0.85, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
          <cylinderGeometry args={[0.14, 0.14, 1.7, 16]} />
          <meshPhysicalMaterial
            color="#5b6b82"
            metalness={0.78}
            roughness={0.3}
            clearcoat={0.35}
            clearcoatRoughness={0.25}
            emissive={isSelected || hovered ? "#00f0ff" : "#000000"}
            emissiveIntensity={isSelected ? 0.12 : hovered ? 0.06 : 0}
          />
        </mesh>

        {/* Support frame */}
        <mesh position={[0, -1.2, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.9, 0.12, 0.6]} />
          <meshStandardMaterial color="#1e293b" metalness={0.4} roughness={0.7} />
        </mesh>
        {[-0.75, 0, 0.75].map((x) => (
          <mesh key={x} position={[x, -0.75, 0]} castShadow>
            <boxGeometry args={[0.08, 0.9, 0.08]} />
            <meshStandardMaterial color="#1e293b" metalness={0.4} roughness={0.7} />
          </mesh>
        ))}

        <CycloneCone offsetX={-0.75} online={cyclonesOnline >= 1} wearPct={apexWearPct} swirlIntensity={swirlIntensity} isRunning={isRunning} label="A" />
        <CycloneCone offsetX={0} online={cyclonesOnline >= 2} wearPct={apexWearPct} swirlIntensity={swirlIntensity} isRunning={isRunning} label="B" />
        <CycloneCone offsetX={0.75} online={cyclonesOnline >= 3} wearPct={apexWearPct} swirlIntensity={swirlIntensity} isRunning={isRunning} label="C" />

        <mesh visible={false}>
          <boxGeometry args={[2.4, 2.4, 1.2]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      </group>

      <EquipmentLabel tag="CY_001" y={1.5} value={feedFlow} unit="t/h" isGood={isRunning} />
    </group>
  );
}
