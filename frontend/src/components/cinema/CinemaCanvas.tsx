import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import * as THREE from 'three';
import { ParticleField } from './ParticleField';
import { SceneState, sampleScene } from './scene-timeline';
import { useReducedMotion } from './useReducedMotion';

interface Props {
  /** 'scroll' = drive the timeline by window.scrollY / total (legacy).
   *  'time' = drive by a rAF clock that loops every cycleMs. The
   *  homepage uses 'time' so the atmosphere transforms on its own
   *  without forcing the visitor to scroll. */
  mode?: 'scroll' | 'time';
  /** Full-loop duration in ms. Only used when mode='time'. */
  cycleMs?: number;
}

// Inner scene drives uniforms + camera every frame from a shared progress ref.
function SceneDriver({ progressRef }: { progressRef: MutableRefObject<number> }) {
  const { camera, scene } = useThree();
  const stateRef = useRef<SceneState>({
    colorA: new THREE.Color('#000000'),
    colorB: new THREE.Color('#000000'),
    density: 0,
    cameraZ: 8,
  });

  const matRef = useRef<THREE.ShaderMaterial | null>(null);
  useEffect(() => {
    scene.traverse((obj) => {
      if (obj instanceof THREE.Points && obj.material instanceof THREE.ShaderMaterial) {
        matRef.current = obj.material;
      }
    });
  }, [scene]);

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

export function CinemaCanvas({
  mode = 'scroll',
  cycleMs = 75000,
}: Props = {}) {
  const reduced = useReducedMotion();
  const progressRef = useRef(0);

  // Drive progressRef either from scroll position or from a time clock.
  useEffect(() => {
    if (reduced || typeof window === 'undefined') return;

    if (mode === 'time') {
      // Time mode : loop the timeline indefinitely. Pandora atmospheres
      // shift on their own — forêt → Hometree → montagnes → océan →
      // volcan → reveal → loop. No scroll required.
      const start = performance.now();
      let raf = 0;
      const tick = () => {
        const elapsed = (performance.now() - start) % cycleMs;
        progressRef.current = elapsed / cycleMs;
        raf = requestAnimationFrame(tick);
      };
      tick();
      return () => cancelAnimationFrame(raf);
    }

    // Scroll mode : original behavior.
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
  }, [reduced, mode, cycleMs]);

  if (reduced) {
    // No canvas rendered when motion is reduced — the static landing
    // (logo + CTAs) is already perfectly readable on its own.
    return null;
  }

  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 60 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <ParticleField count={typeof window !== 'undefined' && window.innerWidth < 768 ? 1000 : 2000} />
        <SceneDriver progressRef={progressRef} />
      </Canvas>
    </div>
  );
}
