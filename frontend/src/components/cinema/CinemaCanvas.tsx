import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import * as THREE from 'three';
import { ParticleField } from './ParticleField';
import { SceneState, sampleScene } from './scene-timeline';
import { useReducedMotion } from './useReducedMotion';
import { CYCLE_MS } from './config';

// Shape of the mouse-attractor ref shared with the SceneDriver.
// `target.{x,y}` is the latest pointer NDC ; `current.{x,y}` is the
// damped value pushed to the shader uniform. `strength` ramps to 1
// when the pointer is over the canvas, back to 0 when it leaves.
interface MouseAttractor {
  target: { x: number; y: number; strength: number };
  current: { x: number; y: number; strength: number };
}

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
function SceneDriver({
  progressRef,
  mouseRef,
}: {
  progressRef: MutableRefObject<number>;
  mouseRef: MutableRefObject<MouseAttractor>;
}) {
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
      // Damp the mouse attractor toward its target. ~12% per frame is
      // ~120ms half-life @ 60fps — snappy enough that the field feels
      // responsive, smooth enough that it doesn't jitter on each pixel.
      const m = mouseRef.current;
      m.current.x += (m.target.x - m.current.x) * 0.12;
      m.current.y += (m.target.y - m.current.y) * 0.12;
      m.current.strength += (m.target.strength - m.current.strength) * 0.08;

      if (matRef.current) {
        const u = matRef.current.uniforms;
        (u.uColorA.value as THREE.Color).copy(s.colorA);
        (u.uColorB.value as THREE.Color).copy(s.colorB);
        u.uDensity.value = s.density;
        (u.uMouse.value as THREE.Vector2).set(m.current.x, m.current.y);
        u.uMouseStrength.value = m.current.strength;
      }
      camera.position.z = s.cameraZ;
      requestAnimationFrame(tick);
    };
    if (typeof window !== 'undefined') tick();
  }, [camera, progressRef, mouseRef]);

  return null;
}

export function CinemaCanvas({
  mode = 'scroll',
  cycleMs = CYCLE_MS,
}: Props = {}) {
  const reduced = useReducedMotion();
  const progressRef = useRef(0);
  const mouseRef = useRef<MouseAttractor>({
    target: { x: 0, y: 0, strength: 0 },
    current: { x: 0, y: 0, strength: 0 },
  });

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

  // Pointer attractor — lit by `pointermove` on window (the canvas itself
  // is `pointer-events: none` so events never reach it). Stops feeding
  // input when prefers-reduced-motion is on.
  useEffect(() => {
    if (reduced || typeof window === 'undefined') return;

    const onMove = (e: PointerEvent) => {
      // Convert clientX/Y → NDC (-1..1, y inverted because screen Y grows
      // downward but NDC Y grows upward).
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = -((e.clientY / window.innerHeight) * 2 - 1);
      mouseRef.current.target.x = x;
      mouseRef.current.target.y = y;
      mouseRef.current.target.strength = 1;
    };
    const onLeave = () => {
      mouseRef.current.target.strength = 0;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerleave', onLeave, { passive: true });
    document.addEventListener('mouseleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('mouseleave', onLeave);
    };
  }, [reduced]);

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
        <SceneDriver progressRef={progressRef} mouseRef={mouseRef} />
      </Canvas>
    </div>
  );
}
