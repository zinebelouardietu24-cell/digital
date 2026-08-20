import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Small procedural striped texture for the animated flow overlay — cheaper
// and more controllable than a dashed-line material for a tube mesh.
function useFlowStripeTexture() {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 8;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "rgba(0,0,0,0)";
    ctx.fillRect(0, 0, 64, 8);
    ctx.fillStyle = "#00f0ff";
    ctx.fillRect(0, 0, 24, 8);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(12, 1);
    return texture;
  }, []);
}

function flangeAt(points, index, dir) {
  const zAxis = new THREE.Vector3(0, 0, 1);
  const quat = new THREE.Quaternion().setFromUnitVectors(zAxis, dir);
  return { position: points[index], quaternion: quat };
}

/**
 * A routed metal pipe segment (matches the 2D flowsheet's polyline pipes,
 * just extruded as a real tube instead of a flat SVG line), with flanged
 * end connections, mid-span support brackets, and an animated flow-stripe
 * overlay whose scroll speed is driven by real flow rate data.
 */
export default function Pipe3D({ points, radius = 0.075, flowRate = 0, isRunning = false, color = "#5b6b82" }) {
  const flowTexture = useFlowStripeTexture();
  const overlayRef = useRef();

  const curve = useMemo(() => {
    const vecPoints = points.map(([x, y, z]) => new THREE.Vector3(x, y, z));
    return new THREE.CatmullRomCurve3(vecPoints, false, "catmullrom", 0.05);
  }, [points]);

  const tubeGeometry = useMemo(() => {
    const segments = Math.max(12, points.length * 8);
    return new THREE.TubeGeometry(curve, segments, radius, 14, false);
  }, [curve, radius, points.length]);

  // Flange rings: at every routing joint AND at both pipe ends, each
  // oriented to the pipe's true local tangent there so they sit flush
  // against bends and equipment connections instead of floating flat.
  const flanges = useMemo(() => {
    const n = points.length;
    const list = [];
    const startDir = new THREE.Vector3(...points[1]).sub(new THREE.Vector3(...points[0])).normalize();
    list.push(flangeAt(points, 0, startDir));
    for (let i = 1; i < n - 1; i++) {
      const prev = new THREE.Vector3(...points[i - 1]);
      const next = new THREE.Vector3(...points[i + 1]);
      list.push(flangeAt(points, i, next.clone().sub(prev).normalize()));
    }
    const endDir = new THREE.Vector3(...points[n - 1]).sub(new THREE.Vector3(...points[n - 2])).normalize();
    list.push(flangeAt(points, n - 1, endDir));
    return list;
  }, [points]);

  // Ground support brackets under long straight-ish runs — sampled along
  // the curve at fixed arc-length spacing, dropped straight down to y=0.
  const supports = useMemo(() => {
    const supportsOut = [];
    const length = curve.getLength();
    const spacing = 1.6;
    const count = Math.floor(length / spacing);
    for (let i = 1; i < count; i++) {
      const t = (i * spacing) / length;
      const pt = curve.getPointAt(Math.min(0.98, t));
      if (pt.y > 0.25) supportsOut.push(pt);
    }
    return supportsOut;
  }, [curve]);

  useFrame((_, delta) => {
    if (!isRunning || flowRate <= 0) return;
    flowTexture.offset.x -= delta * Math.min(2.5, 0.15 + flowRate / 500);
    if (overlayRef.current) overlayRef.current.material.opacity = 0.5;
  });

  return (
    <group>
      <mesh geometry={tubeGeometry} castShadow receiveShadow>
        <meshPhysicalMaterial color={color} metalness={0.8} roughness={0.35} clearcoat={0.35} clearcoatRoughness={0.25} />
      </mesh>

      {flanges.map((f, i) => (
        <group key={i} position={f.position} quaternion={f.quaternion}>
          <mesh rotation-x={Math.PI / 2} castShadow>
            <cylinderGeometry args={[radius * 1.5, radius * 1.5, radius * 0.5, 16]} />
            <meshStandardMaterial color="#293145" metalness={0.65} roughness={0.45} />
          </mesh>
          {Array.from({ length: 8 }, (_, b) => {
            const a = (b / 8) * Math.PI * 2;
            return (
              <mesh key={b} position={[Math.cos(a) * radius * 1.3, Math.sin(a) * radius * 1.3, 0]} rotation-x={Math.PI / 2} castShadow>
                <cylinderGeometry args={[radius * 0.16, radius * 0.16, radius * 0.55, 6]} />
                <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.3} />
              </mesh>
            );
          })}
        </group>
      ))}

      {supports.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]}>
          <mesh position={[0, p.y / 2, 0]} castShadow>
            <boxGeometry args={[0.06, p.y, 0.06]} />
            <meshStandardMaterial color="#1e293b" metalness={0.4} roughness={0.75} />
          </mesh>
          <mesh position={[0, p.y, 0]} castShadow>
            <torusGeometry args={[radius * 1.15, 0.02, 6, 12, Math.PI]} />
            <meshStandardMaterial color="#334155" metalness={0.5} roughness={0.6} />
          </mesh>
        </group>
      ))}

      {isRunning && flowRate > 0 && (
        <mesh ref={overlayRef} geometry={tubeGeometry} scale={1.015}>
          <meshBasicMaterial map={flowTexture} transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}
