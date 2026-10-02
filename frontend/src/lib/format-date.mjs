/**
 * L20 — mise en forme UNIQUE des dates en français (reprise d'evatosorus) : Nouveautés,
 * séparateur « Déjà vu lors de ta visite du … », Plan de travail. Le premier du mois
 * s'écrit « 1er » (« 1er octobre 2026 »), ce que Intl ne fait pas. Module pur, testé par
 * node --test (scripts/format-date.test.mjs) ; en .mjs, importable tel quel par node --test
 * depuis les modules .ts.
 */
/** @type {Intl.DateTimeFormatOptions} */
const LONG = { day: 'numeric', month: 'long', year: 'numeric' };

/**
 * Date longue d'un instant dans un fuseau (par défaut celui du navigateur).
 * @param {Date} date @param {string} [timeZone] @returns {string}
 */
export function formatLongDate(date, timeZone) {
  const parts = new Intl.DateTimeFormat('fr-FR', { ...LONG, ...(timeZone ? { timeZone } : {}) }).formatToParts(date);
  return parts.map((p) => (p.type === 'day' && p.value === '1' ? '1er' : p.value)).join('');
}

/**
 * Jour calendaire « YYYY-MM-DD » (sans fuseau : midi UTC, jamais la veille).
 * @param {string} day @returns {string}
 */
export function formatDay(day) {
  return formatLongDate(new Date(`${day}T12:00:00Z`), 'UTC');
}

/**
 * Heure à la française « 20 h 42 », « 8 h 05 » (espaces insécables), d'un instant, dans un
 * fuseau (par défaut celui du navigateur). Revue UX L20 : « 20:42 » est une notation
 * d'horloge numérique, pas celle d'un texte.
 * @param {Date} date @param {string} [timeZone] @returns {string}
 */
export function formatTime(date, timeZone) {
  const parts = new Intl.DateTimeFormat('fr-FR', { hour: 'numeric', minute: '2-digit', hourCycle: 'h23', ...(timeZone ? { timeZone } : {}) }).formatToParts(date);
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '';
  return `${Number(hour)}\u00a0h\u00a0${minute}`;
}
