/**
 * Shared timing/visual constants for the Cinema atmosphere components.
 *
 * Keep these in sync :
 * - `CYCLE_MS` is the loop duration shared by `CinemaCanvas` (particles)
 *   and `CycleBackdrop` (image cross-fade). They MUST match — otherwise
 *   the atmosphere desyncs (particles say "ocean" while the image still
 *   shows "forêt").
 */

/** Full atmospheric loop duration, in milliseconds. ~12 s per scene over 6 scenes. */
export const CYCLE_MS = 75_000;

/** Half-width of the bell curve that fades each backdrop image in/out. */
export const BACKDROP_PEAK_WIDTH = 0.22;

/** Max opacity for the cross-fade backdrop — the image is atmosphere, not foreground. */
export const BACKDROP_MAX_OPACITY = 0.45;
