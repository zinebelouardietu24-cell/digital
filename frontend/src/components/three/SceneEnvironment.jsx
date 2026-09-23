import React, { useMemo } from "react";
import * as THREE from "three";
import { Environment, ContactShadows } from "@react-three/drei";

// Procedural concrete-slab floor texture (tiled expansion-joint pattern) —
// a flat-colored plane read as an empty void; this gives the ground actual
// surface detail without needing an external texture asset.
function useFloorTexture() {
  return useMemo(() => {
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#161c28";
    ctx.fillRect(0, 0, size, size);

    // Subtle per-tile mottling
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = Math.random() * 1.6;
      ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.05)";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Expansion-joint grid lines (concrete slab seams)
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 2;
    const tiles = 8;
    for (let i = 0; i <= tiles; i++) {
      const p = (i / tiles) * size;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(6, 6);
    texture.anisotropy = 4;
    return texture;
  }, []);
}

/**
 * Shared lighting rig, ground, and image-based reflections for the 3D
 * digital twin scene. Mirrors the app's ISA-101 dark-slate visual language
 * (cool key light, cyan rim accent) instead of generic demo lighting.
 */
export default function SceneEnvironment() {
  const floorTexture = useFloorTexture();

  return (
    <>
      <color attach="background" args={["#0a0e17"]} />
      {/* Fog pushed well past the camera's actual working distance (~13-16
          units for this scene) so it only softens the far background instead
          of hazing over the equipment itself. */}
      <fog attach="fog" args={["#0a0e17", 24, 60]} />

      {/* Key light: cool-white, slightly angled, brighter for clear readability */}
      <directionalLight
        position={[8, 14, 6]}
        intensity={2.4}
        color="#e8f1ff"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      {/* Fill light: dim blue-ish, opposite side */}
      <directionalLight position={[-10, 6, -8]} intensity={0.6} color="#3b82f6" />

      {/* Cyan rim/accent light, matches the app's #00f0ff live-data accent */}
      <pointLight position={[0, 6, 0]} intensity={0.5} color="#00f0ff" distance={30} decay={2} />

      <ambientLight intensity={0.4} />

      {/* Realistic metal reflections via image-based lighting — kept modest:
          the "warehouse" HDRI has bright white light panels that, at full
          intensity on the equipment's high-metalness/clearcoat materials,
          read as an unrealistic white rim/streak around every curved edge. */}
      <Environment preset="warehouse" environmentIntensity={0.35} />

      {/* Cheap, convincing grounded-shadow instead of full shadow maps */}
      <ContactShadows position={[0, -0.02, 0]} opacity={0.55} scale={24} blur={2.2} far={8} color="#000000" />

      {/* Ground plane — procedural concrete-slab texture instead of flat color */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} receiveShadow>
        <planeGeometry args={[36, 36]} />
        <meshStandardMaterial map={floorTexture} roughness={0.92} metalness={0.06} />
      </mesh>

      {/* Faint grid overlay to match the flowsheet's CAD-blueprint grid */}
      <gridHelper args={[36, 36, "#2a384e", "#1a2233"]} position={[0, -0.02, 0]} />
    </>
  );
}
