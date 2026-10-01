import { useEffect, useState } from 'react';

/**
 * Horloge partagée de l'ambiance de l'accueil (boucle de 75 s).
 *
 * CycleBackdrop (images) et CinemaCanvas (particules) lisent la MÊME horloge,
 * pour rester synchrones et pour qu'un seul bouton (AtmospherePause.astro) les
 * fige ensemble — WCAG 2.2.2 : une animation de plus de 5 s doit pouvoir être
 * mise en pause. Le choix est mémorisé dans localStorage, comme l'audio.
 *
 * Singleton posé sur window : les îlots React et le script du bouton sont des
 * modules distincts, et l'horloge doit survivre aux navigations du ClientRouter.
 */

export const ATMOSPHERE_STORAGE_KEY = 'eywa-atmosphere-paused';
export const ATMOSPHERE_EVENT = 'eywa:atmosphere';
/** Classe posée sur <html> quand l'ambiance est en pause (fige aussi les animations CSS). */
export const ATMOSPHERE_PAUSED_CLASS = 'eywa-atmo-paused';

export interface AtmosphereClock {
  /** Temps écoulé de l'ambiance en ms, pauses exclues. */
  now(): number;
  paused(): boolean;
  setPaused(paused: boolean): void;
}

declare global {
  interface Window {
    __eywaAtmo?: AtmosphereClock;
  }
}

function readStored(): boolean {
  try {
    return localStorage.getItem(ATMOSPHERE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function syncPausedClass(paused: boolean): void {
  document.documentElement.classList.toggle(ATMOSPHERE_PAUSED_CLASS, paused);
}

export function atmosphereClock(): AtmosphereClock {
  if (window.__eywaAtmo) return window.__eywaAtmo;

  const start = performance.now();
  let base = start;
  let pausedAt: number | null = readStored() ? start : null;

  const clock: AtmosphereClock = {
    now: () => (pausedAt ?? performance.now()) - base,
    paused: () => pausedAt !== null,
    setPaused(paused) {
      if (paused === clock.paused()) return;
      const t = performance.now();
      if (paused) {
        pausedAt = t;
      } else {
        base += t - (pausedAt as number);
        pausedAt = null;
      }
      try {
        localStorage.setItem(ATMOSPHERE_STORAGE_KEY, String(paused));
      } catch {
        /* stockage indisponible : la pause vaut pour la page seulement */
      }
      syncPausedClass(paused);
      window.dispatchEvent(new CustomEvent(ATMOSPHERE_EVENT, { detail: { paused } }));
    },
  };
  syncPausedClass(clock.paused());
  window.__eywaAtmo = clock;
  return clock;
}

/** État pause de l'ambiance, mis à jour quand le bouton le change. */
export function useAtmospherePaused(): boolean {
  const [paused, setPaused] = useState(() =>
    typeof window === 'undefined' ? false : atmosphereClock().paused(),
  );
  useEffect(() => {
    const onChange = () => setPaused(atmosphereClock().paused());
    window.addEventListener(ATMOSPHERE_EVENT, onChange);
    onChange();
    return () => window.removeEventListener(ATMOSPHERE_EVENT, onChange);
  }, []);
  return paused;
}
