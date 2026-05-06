import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import * as THREE from 'three';
import { ParticleField } from './ParticleField';
import { useReducedMotion } from './useReducedMotion';

// Same shape as CinemaCanvas — but here uMouse is the only thing the
// driver mutates (colors / density stay at the ParticleField initials).
interface MouseAttractor {
  target: { x: number; y: number; strength: number };
  current: { x: number; y: number; strength: number };
}

/**
 * Drives the uMouse / uMouseStrength uniforms on the codex ParticleField
 * so the cursor attracts particles exactly like on the landing — but
 * without touching colors / density (atmosphere stays the static
 * forest-cyan / sacred-green wash).
 */
function CodexMouseDriver({
  mouseRef,
}: {
  mouseRef: MutableRefObject<MouseAttractor>;
}) {
  const { scene } = useThree();
  const matRef = useRef<THREE.ShaderMaterial | null>(null);

  useEffect(() => {
    scene.traverse((obj) => {
      if (
        obj instanceof THREE.Points &&
        obj.material instanceof THREE.ShaderMaterial
      ) {
        matRef.current = obj.material;
      }
    });
  }, [scene]);

  useMemo(() => {
    const tick = () => {
      const m = mouseRef.current;
      m.current.x += (m.target.x - m.current.x) * 0.12;
      m.current.y += (m.target.y - m.current.y) * 0.12;
      m.current.strength += (m.target.strength - m.current.strength) * 0.08;

      if (matRef.current) {
        const u = matRef.current.uniforms;
        (u.uMouse.value as THREE.Vector2).set(m.current.x, m.current.y);
        u.uMouseStrength.value = m.current.strength;
      }
      requestAnimationFrame(tick);
    };
    if (typeof window !== 'undefined') tick();
  }, [mouseRef]);

  return null;
}

/**
 * Static-color ambient particle field for the codex pages. Lower density
 * than the cinema landing, fixed forest-cyan-to-sacred-green palette
 * (no scroll mutation), camera pushed back so close particles don't
 * dominate. Reuses the same shader/component as the cinema canvas.
 *
 * Mouse-reactive : the cursor pulls particles toward it and lights them
 * up in bioluminescent halo — same effect as on the landing, scaled
 * down so it never competes with the codex prose.
 *
 * Mounted via client:only="react" in CodexLayout — must not SSR (R3F
 * needs the DOM).
 */
export function CodexAmbient() {
  const reduced = useReducedMotion();
  const mouseRef = useRef<MouseAttractor>({
    target: { x: 0, y: 0, strength: 0 },
    current: { x: 0, y: 0, strength: 0 },
  });

  useEffect(() => {
    if (reduced || typeof window === 'undefined') return;

    const onMove = (e: PointerEvent) => {
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

  if (reduced) return null;

  const isMobile =
    typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      <Canvas
        camera={{ position: [0, 0, 14], fov: 60 }}
        dpr={[1, 1.5]}
        gl={{
          antialias: false,
          alpha: true,
          powerPreference: 'low-power',
        }}
      >
        <ParticleField
          count={isMobile ? 700 : 1400}
          spread={32}
          initialColorA="#5fffe6"
          initialColorB="#7fff8f"
          initialDensity={0.45}
          size={6.0}
        />
        <CodexMouseDriver mouseRef={mouseRef} />
      </Canvas>
    </div>
  );
}
