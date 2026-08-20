import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";

/**
 * Ground-level pulsing ring under the currently selected equipment —
 * gives a clear, unambiguous selection cue without flooding the model's
 * own material with emissive color (which read as flat/cartoonish).
 */
export default function SelectionRing({ position, radius = 1.3 }) {
  const ringRef = useRef();

  useFrame((state) => {
    if (ringRef.current) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 2.2) * 0.06;
      ringRef.current.scale.set(pulse, pulse, 1);
    }
  });

  return (
    <mesh ref={ringRef} position={[position[0], 0.02, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius * 0.85, radius, 48]} />
      <meshBasicMaterial color="#00f0ff" transparent opacity={0.65} />
    </mesh>
  );
}
