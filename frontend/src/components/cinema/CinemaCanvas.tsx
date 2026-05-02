import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import * as THREE from 'three';
import { ParticleField } from './ParticleField';
import { SceneState, sampleScene } from './scene-timeline';
import { useReducedMotion } from './useReducedMotion';

// Inner scene drives uniforms + camera every frame from a shared progress ref.
function SceneDriver({ progressRef }: { progressRef: MutableRefObject<number> }) {
  const { camera, scene } = useThree();
  const stateRef = useRef<SceneState>({
    colorA: new THREE.Color('#000000'),
    colorB: new THREE.Color('#000000'),
    density: 0,
    cameraZ: 8,
  });

  // Find the ShaderMaterial under <points> traversal-style.
  const matRef = useRef<THREE.ShaderMaterial | null>(null);
  useEffect(() => {
    scene.traverse((obj) => {
      if (obj instanceof THREE.Points && obj.material instanceof THREE.ShaderMaterial) {
        matRef.current = obj.material;
      }
    });
  }, [scene]);

  // Drive each frame from the shared progress.
  useMemo(() => {
    const tick = () => {
      const s = sampleScene(progressRef.current, stateRef.current);
      if (matRef.current) {
        const u = matRef.current.uniforms;
        (u.uColorA.value as THREE.Color).copy(s.colorA);
        (u.uColorB.value as THREE.Color).copy(s.colorB);
        u.uDensity.value = s.density;
      }
      camera.position.z = s.cameraZ;
      requestAnimationFrame(tick);
    };
    if (typeof window !== 'undefined') tick();
  }, [camera, progressRef]);

  return null;
}

export function CinemaCanvas() {
  const reduced = useReducedMotion();
  const progressRef = useRef(0);

  // Direct scroll listener — drives progressRef from window.scrollY / total scrollable height.
  // Replaces the GSAP ScrollTrigger sentinel pattern (which was watching an empty div in the
  // wrong scope and never produced motion). This matches the same math as the overlay fades.
  useEffect(() => {
    if (reduced || typeof window === 'undefined') return;
    const handler = () => {
      const total = document.body.scrollHeight - window.innerHeight;
      progressRef.current =
        total > 0 ? Math.max(0, Math.min(1, window.scrollY / total)) : 0;
    };
    window.addEventListener('scroll', handler, { passive: true });
    window.addEventListener('resize', handler, { passive: true });
    handler();
    return () => {
      window.removeEventListener('scroll', handler);
      window.removeEventListener('resize', handler);
    };
  }, [reduced]);

  if (reduced) {
    // No canvas rendered when motion is reduced — overlay text in the parent
    // landing still shows because its fade script is opacity-based, not animated.
    return null;
  }

  return (
    <div className="fixed inset-0 -z-10 bg-eywa-bg pointer-events-none">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 60 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <ParticleField count={typeof window !== 'undefined' && window.innerWidth < 768 ? 1500 : 3500} />
        <SceneDriver progressRef={progressRef} />
      </Canvas>
    </div>
  );
}
