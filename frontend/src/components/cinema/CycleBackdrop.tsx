import { useEffect, useRef } from 'react';
import { useReducedMotion } from './useReducedMotion';
import { CYCLE_MS, BACKDROP_PEAK_WIDTH, BACKDROP_MAX_OPACITY } from './config';

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


export function CycleBackdrop() {
  const reduced = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduced || !containerRef.current) return;
    const imgs = containerRef.current.querySelectorAll<HTMLImageElement>('.cycle-img');
    if (imgs.length === 0) return;

    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const elapsed = (performance.now() - start) % CYCLE_MS;
      const p = elapsed / CYCLE_MS;
      SCENES.forEach((scene, i) => {
        // Wrap-around distance — the cycle is circular so a scene at 0.00
        // is just as close to progress 0.95 as it is to 0.05.
        const raw = Math.abs(p - scene.at);
        const dist = Math.min(raw, 1 - raw);
        const t = dist / BACKDROP_PEAK_WIDTH;
        const opacity = Math.max(0, (1 - t * t)) * BACKDROP_MAX_OPACITY;
        const el = imgs[i];
        if (el) el.style.opacity = opacity.toFixed(3);
      });
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  if (reduced) return null;

  return (
    <div ref={containerRef} className="cycle-backdrop">
      {SCENES.map((scene, i) => (
        <img
          key={i}
          src={`/api/wiki-image?q=${encodeURIComponent(scene.query)}`}
          alt=""
          aria-hidden="true"
          className="cycle-img"
          loading={i === 0 ? 'eager' : 'lazy'}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      ))}
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
