import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';
import { CYCLE_MS, BACKDROP_PEAK_WIDTH, BACKDROP_MAX_OPACITY } from './config';
import { atmosphereClock, useAtmospherePaused } from './atmosphere-clock';

/**
 * Time-cycled image backdrop for the homepage. Cross-fades through 6
 * Pandora locations on the same 75-second loop the CinemaCanvas
 * particles use, so atmosphere and image stay in sync : forêt → Hometree
 * → Hallelujah → Metkayina → Fire & Ash → reveal → loop.
 *
 * No scroll dependency — the visitor sits on the landing and Pandora
 * transforms around them.
 */

const SCENES = [
  { at: 0.00, query: 'Pandora' },              // reveal — globe + floating mountains
  { at: 0.18, query: 'Banshee' },              // forêt — flying creature in jungle
  { at: 0.36, query: 'Hometree' },             // Hometree
  { at: 0.54, query: 'Hallelujah Mountains' }, // mountains
  { at: 0.72, query: 'Metkayina' },            // ocean clan
  { at: 0.88, query: 'Ash People' },           // Fire & Ash volcano
];


/**
 * Images are fetched on demand : a scene's image is requested only when the
 * clock gets within LOAD_AHEAD of the moment it starts fading in (about
 * 4.5 s ahead), instead of all six at once on arrival. At progress 0 that
 * is the reveal plus its two neighbours, both already partly visible.
 */
const LOAD_AHEAD = 0.06;

/** Circular distance between progress p and a scene peak (the loop wraps). */
function circularDistance(p: number, at: number): number {
  const raw = Math.abs(p - at);
  return Math.min(raw, 1 - raw);
}

export function CycleBackdrop() {
  const reduced = useReducedMotion();
  const paused = useAtmospherePaused();
  const imgRefs = useRef<(HTMLImageElement | null)[]>([]);
  const [wanted, setWanted] = useState<ReadonlySet<number>>(() => new Set());

  useEffect(() => {
    if (reduced) return;

    // Shared atmosphere clock (same as the particles) : when paused, one
    // tick paints the frozen state and the loop stops.
    const clock = atmosphereClock();
    // Re-run when `wanted` grows so freshly mounted images get their
    // opacity painted even while the atmosphere is paused.
    const requested = new Set<number>(wanted);
    let raf = 0;
    const tick = () => {
      const elapsed = clock.now() % CYCLE_MS;
      const p = elapsed / CYCLE_MS;
      let grew = false;
      SCENES.forEach((scene, i) => {
        const dist = circularDistance(p, scene.at);
        if (dist < BACKDROP_PEAK_WIDTH + LOAD_AHEAD && !requested.has(i)) {
          requested.add(i);
          grew = true;
        }
        const t = dist / BACKDROP_PEAK_WIDTH;
        const opacity = Math.max(0, (1 - t * t)) * BACKDROP_MAX_OPACITY;
        const el = imgRefs.current[i];
        if (el) el.style.opacity = opacity.toFixed(3);
      });
      if (grew) setWanted(new Set(requested));
      if (!paused) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [reduced, paused, wanted]);

  if (reduced) return null;

  return (
    <div className="cycle-backdrop">
      {SCENES.map((scene, i) =>
        wanted.has(i) ? (
          <img
            key={i}
            ref={(el) => {
              imgRefs.current[i] = el;
            }}
            src={`/api/wiki-image?q=${encodeURIComponent(scene.query)}`}
            alt=""
            aria-hidden="true"
            className="cycle-img"
            decoding="async"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : null,
      )}
      <style>{`
        .cycle-backdrop {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background: var(--color-eywa-bg);
        }
        .cycle-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: 0;
          transition: opacity 200ms linear;
          filter: saturate(1.1);
        }
      `}</style>
    </div>
  );
}
