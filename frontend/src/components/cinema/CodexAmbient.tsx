import { Canvas } from '@react-three/fiber';
import { ParticleField } from './ParticleField';
import { useReducedMotion } from './useReducedMotion';

/**
 * Static-color ambient particle field for the codex pages. Lower density
 * than the cinema landing, fixed forest-cyan-to-sacred-green palette
 * (no scroll mutation), camera pushed back so close particles don't
 * dominate. Reuses the same shader/component as the cinema canvas.
 *
 * Mounted via client:only="react" in CodexLayout — must not SSR (R3F
 * needs the DOM).
 */
export function CodexAmbient() {
  const reduced = useReducedMotion();
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
      </Canvas>
    </div>
  );
}
