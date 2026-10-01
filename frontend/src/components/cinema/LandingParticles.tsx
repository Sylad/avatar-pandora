import { lazy, Suspense } from 'react';
import { useReducedMotion } from './useReducedMotion';

// CinemaCanvas pulls three.js + @react-three/fiber (the ParticleField chunk,
// ~850 Ko, ~230 Ko brotli). Import it only when motion is allowed : under
// prefers-reduced-motion the landing shows no particles, so the chunk is
// never requested.
const CinemaCanvas = lazy(() =>
  import('./CinemaCanvas').then((m) => ({ default: m.CinemaCanvas })),
);

export function LandingParticles() {
  const reduced = useReducedMotion();
  if (reduced) return null;
  return (
    <Suspense fallback={null}>
      <CinemaCanvas mode="time" />
    </Suspense>
  );
}
