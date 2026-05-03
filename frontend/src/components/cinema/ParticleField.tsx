import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { particlesVertex, particlesFragment } from './particles.shader';

interface Props {
  count?: number;
  spread?: number;
  /** Initial uniform values. The cinema landing mutates these per scroll;
   *  the codex ambient uses fixed ones. */
  initialColorA?: string;
  initialColorB?: string;
  initialDensity?: number;
  size?: number;
}

export function ParticleField({
  count = 2000,
  spread = 30,
  initialColorA = '#5fffe6',
  initialColorB = '#ff5dc4',
  initialDensity = 1.0,
  size = 7.0,
}: Props) {
  const ref = useRef<THREE.Points>(null!);
  const matRef = useRef<THREE.ShaderMaterial>(null!);

  const { positions, seeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * spread;
      positions[i * 3 + 1] = (Math.random() - 0.5) * spread * 0.6;
      positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
      seeds[i] = Math.random();
    }
    return { positions, seeds };
  }, [count, spread]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSize: { value: size },
      uDensity: { value: initialDensity },
      uColorA: { value: new THREE.Color(initialColorA) },
      uColorB: { value: new THREE.Color(initialColorB) },
    }),
    [],
  );

  useFrame((state) => {
    if (matRef.current) {
      (matRef.current.uniforms.uTime as { value: number }).value =
        state.clock.elapsedTime;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSeed" args={[seeds, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={matRef}
        vertexShader={particlesVertex}
        fragmentShader={particlesFragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// Ref-passing helper so the parent canvas wrapper can mutate uniforms from scroll
export type ParticleUniforms = {
  uColorA: { value: THREE.Color };
  uColorB: { value: THREE.Color };
  uDensity: { value: number };
};
