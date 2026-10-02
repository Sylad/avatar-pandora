/**
 * Pastille « Nouveautés » (L14) : combien d'entrées le visiteur n'a pas encore vues depuis
 * sa dernière visite de /nouveautes/. Module pur (testé par scripts/news-seen.test.mjs),
 * repris d'AetherWX puis aligné sur evatosorus après sa revue (L21).
 *
 * On mémorise dans localStorage TOUS les slugs vus (`all: true`), la date de l'entrée la
 * plus récente vue et l'instant de la visite : une entrée est « nouvelle » si son slug n'a
 * jamais été vu, même antidatée. Le format de L14 (sans `all`, slugs de la seule date la
 * plus récente), déjà chez des visiteurs, reste lu avec son ancienne règle : nouvelle si
 * absente des slugs ET pas plus ancienne que cette date. Dates (AAAA-MM-JJ) ou instants
 * UTC (AAAA-MM-JJTHH:MM[:SS]Z) comparés en millisecondes, jamais en chaînes.
 * Premier visiteur : une mémoire de base est posée dès la première page vue, quelle
 * qu'elle soit (rien n'est « nouveau » ce jour-là, tout ce qui est publié ensuite l'est).
 */
import { formatLongDate, formatTime } from './format-date.mjs';

export const NEWS_SEEN_KEY = 'eywa.news.seen-v1';

export interface NewsSeen {
  /** Date ou instant de l'entrée la plus récente vue. */
  date: string;
  /** Slugs vus : tous (`all`), ou ceux de `date` seulement (format L14). */
  slugs: string[];
  /** Instant de la visite (ISO), pour « Déjà vu lors de ta visite du … ». */
  at?: string;
  /** Vrai : `slugs` porte TOUS les slugs vus. */
  all?: true;
}

export interface DatedEntry {
  slug: string;
  date: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const DATE_OR_INSTANT = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?Z)?$/;

/** Millisecondes UTC d'une date ou d'un instant ; NaN si illisible. */
function instant(d: string): number {
  return DATE_OR_INSTANT.test(d) ? Date.parse(d) : NaN;
}

export function readSeen(storage: StorageLike | null): NewsSeen | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(NEWS_SEEN_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { date, slugs, at, all } = parsed as { date?: unknown; slugs?: unknown; at?: unknown; all?: unknown };
    if (typeof date !== 'string' || Number.isNaN(instant(date)) || !Array.isArray(slugs)) return null;
    return {
      date,
      slugs: slugs.filter((s): s is string => typeof s === 'string'),
      ...(typeof at === 'string' && !Number.isNaN(Date.parse(at)) ? { at } : {}),
      ...(all === true ? { all: true as const } : {}),
    };
  } catch {
    return null;
  }
}

function write(storage: StorageLike | null, seen: NewsSeen): boolean {
  if (!storage) return false;
  try {
    storage.setItem(NEWS_SEEN_KEY, JSON.stringify(seen));
    return true;
  } catch {
    return false; /* stockage indisponible : la pastille restera */
  }
}

/** Marque toutes les entrées comme vues ; retourne ce qui a été mémorisé. */
export function markAllSeen(storage: StorageLike | null, entries: readonly DatedEntry[], now: Date = new Date()): NewsSeen | null {
  if (!entries.length) return null;
  const date = entries.reduce((max, e) => (instant(e.date) > instant(max) ? e.date : max), entries[0].date);
  const seen: NewsSeen = { date, slugs: entries.map((e) => e.slug).sort(), at: now.toISOString(), all: true };
  write(storage, seen);
  return seen;
}

/**
 * Mémoire de base : à la toute première page vue — n'importe laquelle — tout ce qui est
 * déjà publié compte comme vu, sans pastille ; les entrées publiées ensuite la lèveront même
 * si le visiteur n'ouvre jamais /nouveautes/. Une mémoire existante (ancien format compris)
 * n'est jamais écrasée. Retourne vrai si une mémoire a été écrite.
 */
export function ensureBaseline(storage: StorageLike | null, entries: readonly DatedEntry[], now: Date = new Date()): boolean {
  if (!storage || readSeen(storage)) return false;
  if (entries.length) return write(storage, markAllSeen(null, entries, now)!);
  return write(storage, { date: '1970-01-01', slugs: [], at: now.toISOString(), all: true });
}

/** Entrée non vue lors de la visite `seen` ; premier visiteur (null) : rien n'est nouveau. */
export function isUnseen(entry: DatedEntry, seen: NewsSeen | null): boolean {
  if (!seen) return false;
  if (seen.slugs.includes(entry.slug)) return false;
  return seen.all === true || instant(entry.date) >= instant(seen.date);
}

export function countUnseen(entries: readonly DatedEntry[], seen: NewsSeen | null): number {
  return entries.filter((e) => isUnseen(e, seen)).length;
}

/**
 * Où poser le séparateur « Déjà vu … » (liste du plus récent au plus ancien) : avant la
 * première entrée vue, seulement si toutes les nouvelles sont au-dessus ; sinon (entrée
 * antidatée plus bas) -1, pas de séparateur trompeur — les marques « Nouveau » suffisent.
 */
export function seenSeparatorIndex(fresh: readonly boolean[]): number {
  const first = fresh.indexOf(false);
  if (first <= 0) return -1;
  return fresh.slice(first).includes(true) ? -1 : first;
}

/** Chiffre de la pastille : « 9+ » au-delà de neuf, rien à zéro. */
export function badgeLabel(count: number): string {
  if (count <= 0) return '';
  return count > 9 ? '9+' : String(count);
}

/** Texte lu par les lecteurs d'écran (lien Nouveautés, bouton du menu) ; vide à zéro. */
export function unseenLabel(count: number): string {
  if (count <= 0) return '';
  return count === 1 ? '1 nouveauté non vue' : `${count} nouveautés non vues`;
}

/** Bandeau de la page Nouveautés ; vide à zéro. */
export function sinceLabel(count: number): string {
  if (count <= 0) return '';
  return count === 1 ? '1 nouveauté depuis ta dernière visite' : `${count} nouveautés depuis ta dernière visite`;
}

/** Texte du séparateur avant la première entrée déjà vue (fuseau du navigateur par défaut). */
export function seenSeparatorLabel(at: string | undefined, timeZone?: string): string {
  if (!at || Number.isNaN(Date.parse(at))) return 'Déjà vu lors d’une visite précédente';
  const d = new Date(at);
  return `Déjà vu lors de ta visite du ${formatLongDate(d, timeZone)} à ${formatTime(d, timeZone)}`;
}
