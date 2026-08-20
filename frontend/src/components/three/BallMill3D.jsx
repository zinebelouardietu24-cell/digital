import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import EquipmentLabel from "./EquipmentLabel";

const MANWAY_ANGLE = 0.6;
const manwayQuat = new THREE.Quaternion().setFromUnitVectors(
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, Math.sin(MANWAY_ANGLE), Math.cos(MANWAY_ANGLE))
);

const MILL_LENGTH = 2.6;
const MILL_RADIUS = 0.95;

function tempColor(tempC) {
  if (tempC >= 80) return "#f87171";
  if (tempC >= 65) return "#f59e0b";
  return "#38bdf8";
}

/**
 * Ball Mill (BM_001) — horizontal rotating drum on two trunnion bearings,
 * girth gear + pinion drive, lifter-rib shell, motor/reducer block.
 * Rotation rate is driven by the real BM001_Mill_Speed_pctCritical signal.
 */
export default function BallMill3D({
  position,
  isSelected,
  isRunning,
  speedPctCritical = 0,
  powerDrawKw = 0,
  bearingDeTemp = 40,
  bearingNdeTemp = 40,
  vibrationMms = 0,
  onSelect,
}) {
  const [hovered, setHovered] = React.useState(false);
  const shellGroup = useRef();
  const rootGroup = useRef();

  const girthTeeth = useMemo(
    () => Array.from({ length: 28 }, (_, i) => (i / 28) * Math.PI * 2),
    []
  );
  const lifterRibs = useMemo(() => Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2), []);
  const endPlateBolts = useMemo(() => Array.from({ length: 16 }, (_, i) => (i / 16) * Math.PI * 2), []);

  const emissive = isSelected || hovered ? "#00f0ff" : "#000000";
  const emissiveIntensity = isSelected ? 0.1 : hovered ? 0.05 : 0;

  useFrame((state, delta) => {
    const rpsAtCritical = 0.35; // approximate real mill rotation rate at 100% critical speed
    const speed = isRunning ? (speedPctCritical / 100) * rpsAtCritical * Math.PI * 2 : 0;
    if (shellGroup.current) shellGroup.current.rotation.x -= speed * delta;

    if (rootGroup.current) {
      const jitter = isRunning ? Math.min(0.012, vibrationMms * 0.002) : 0;
      rootGroup.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 22) * jitter;
    }
  });

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
        {/* Support frame / saddles */}
        <mesh position={[-MILL_LENGTH / 2 - 0.15, -0.55, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.5, 0.9, 1.4]} />
          <meshStandardMaterial color="#1e293b" metalness={0.4} roughness={0.7} />
        </mesh>
        <mesh position={[MILL_LENGTH / 2 + 0.15, -0.55, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.5, 0.9, 1.4]} />
          <meshStandardMaterial color="#1e293b" metalness={0.4} roughness={0.7} />
        </mesh>

        {/* Trunnion bearing housings — stationary, temperature-tinted */}
        <mesh position={[-MILL_LENGTH / 2 - 0.15, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.32, 0.32, 0.55, 16]} />
          <meshStandardMaterial color={tempColor(bearingNdeTemp)} metalness={0.5} roughness={0.4} emissive={tempColor(bearingNdeTemp)} emissiveIntensity={0.15} />
        </mesh>
        <mesh position={[MILL_LENGTH / 2 + 0.15, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.32, 0.32, 0.55, 16]} />
          <meshStandardMaterial color={tempColor(bearingDeTemp)} metalness={0.5} roughness={0.4} emissive={tempColor(bearingDeTemp)} emissiveIntensity={0.15} />
        </mesh>

        {/* Motor + reducer block, offset to one side (does not rotate) */}
        <group position={[MILL_LENGTH / 2 + 0.75, -0.3, 0.9]}>
          <mesh castShadow>
            <boxGeometry args={[0.6, 0.5, 0.5]} />
            <meshStandardMaterial color="#1e293b" metalness={0.55} roughness={0.45} />
          </mesh>
          <mesh position={[0, 0, -0.55]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.22, 0.22, 0.55, 20]} />
            <meshStandardMaterial color="#0f172a" metalness={0.6} roughness={0.35} />
          </mesh>
          {/* Rating nameplate */}
          <mesh position={[0.31, 0.05, 0]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[0.22, 0.14]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.3} roughness={0.5} />
          </mesh>
        </group>

        {/* Rotating shell assembly */}
        <group ref={shellGroup}>
          <mesh castShadow receiveShadow rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[MILL_RADIUS, MILL_RADIUS, MILL_LENGTH, 32]} />
            <meshPhysicalMaterial
              color="#3a4356"
              metalness={0.7}
              roughness={0.38}
              clearcoat={0.3}
              clearcoatRoughness={0.3}
              emissive={emissive}
              emissiveIntensity={emissiveIntensity}
            />
          </mesh>

          {/* Manway inspection hatch — rotates with the shell */}
          <group position={[0.3, Math.sin(MANWAY_ANGLE) * (MILL_RADIUS + 0.01), Math.cos(MANWAY_ANGLE) * (MILL_RADIUS + 0.01)]} quaternion={manwayQuat}>
            <mesh rotation-x={Math.PI / 2} castShadow>
              <cylinderGeometry args={[0.22, 0.22, 0.03, 20]} />
              <meshStandardMaterial color="#20263a" metalness={0.6} roughness={0.45} />
            </mesh>
            {Array.from({ length: 8 }, (_, b) => {
              const a = (b / 8) * Math.PI * 2;
              return (
                <mesh key={b} position={[Math.cos(a) * 0.19, Math.sin(a) * 0.19, 0.02]} rotation-x={Math.PI / 2} castShadow>
                  <cylinderGeometry args={[0.02, 0.02, 0.04, 6]} />
                  <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.3} />
                </mesh>
              );
            })}
          </group>

          {/* Flanged end plates with bolt rings */}
          {[-MILL_LENGTH / 2, MILL_LENGTH / 2].map((ex) => (
            <group key={ex}>
              <mesh position={[ex, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
                <cylinderGeometry args={[MILL_RADIUS + 0.06, MILL_RADIUS + 0.06, 0.08, 32]} />
                <meshStandardMaterial color="#293145" metalness={0.6} roughness={0.5} />
              </mesh>
              {endPlateBolts.map((angle, i) => (
                <mesh
                  key={i}
                  position={[ex, Math.sin(angle) * (MILL_RADIUS - 0.08), Math.cos(angle) * (MILL_RADIUS - 0.08)]}
                  rotation={[0, 0, Math.PI / 2]}
                  castShadow
                >
                  <cylinderGeometry args={[0.025, 0.025, 0.1, 6]} />
                  <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.25} />
                </mesh>
              ))}
            </group>
          ))}

          {/* Girth gear ring near the drive end */}
          <mesh position={[MILL_LENGTH / 2 - 0.3, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <torusGeometry args={[MILL_RADIUS + 0.14, 0.09, 10, 32]} />
            <meshStandardMaterial
              color={isRunning ? "#f59e0b" : "#475569"}
              metalness={0.7}
              roughness={0.35}
              emissive={isRunning ? "#f59e0b" : "#000000"}
              emissiveIntensity={isRunning ? Math.min(0.5, powerDrawKw / 4000) : 0}
            />
          </mesh>
          {girthTeeth.map((angle, i) => (
            <mesh
              key={i}
              position={[
                MILL_LENGTH / 2 - 0.3,
                Math.sin(angle) * (MILL_RADIUS + 0.22),
                Math.cos(angle) * (MILL_RADIUS + 0.22),
              ]}
              rotation={[angle, 0, 0]}
              castShadow
            >
              <boxGeometry args={[0.07, 0.09, 0.06]} />
              <meshStandardMaterial color="#64748b" metalness={0.7} roughness={0.4} />
            </mesh>
          ))}

          {/* Lifter ribs along the shell */}
          {lifterRibs.map((angle, i) => (
            <mesh
              key={i}
              position={[0, Math.sin(angle) * (MILL_RADIUS + 0.02), Math.cos(angle) * (MILL_RADIUS + 0.02)]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <boxGeometry args={[MILL_LENGTH * 0.92, 0.05, 0.05]} />
              <meshStandardMaterial color="#20263a" metalness={0.5} roughness={0.6} />
            </mesh>
          ))}
        </group>

        <mesh visible={false}>
          {/* invisible larger hitbox for easier selection */}
          <boxGeometry args={[MILL_LENGTH + 1.6, MILL_RADIUS * 2.4, MILL_RADIUS * 2.4]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      </group>

      <EquipmentLabel tag="BM_001" y={MILL_RADIUS + 0.6} value={powerDrawKw} unit="kW" isGood={isRunning} />
    </group>
  );
}
