import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ParticleField } from './ParticleField';
import { SceneState, sampleScene } from './scene-timeline';
import { useReducedMotion } from './useReducedMotion';

gsap.registerPlugin(ScrollTrigger);

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
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduced || !sentinelRef.current) return;
    const trigger = ScrollTrigger.create({
      trigger: sentinelRef.current,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.6,
      onUpdate: (self) => {
        progressRef.current = self.progress;
      },
    });
    return () => trigger.kill();
  }, [reduced]);

  if (reduced) {
    // Static fallback: render nothing fancy. The parent landing shows the V1-style logo + CTA.
    return null;
  }

  return (
    <>
      {/* Fixed full-page canvas behind page content */}
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
      {/* Sentinel: long scroll area that drives the timeline. Filled by HTML overlays in parent. */}
      <div ref={sentinelRef} className="relative">
        {/* slot for typographic overlays, rendered in index.astro */}
      </div>
    </>
  );
}
