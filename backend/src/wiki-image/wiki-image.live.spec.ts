/**
 * LIVE smoke tests — hit the real Fandom + Wikipedia APIs.
 *
 * Why : the existing 7 mocked tests in `wiki-image.service.spec.ts`
 * validate the transformation logic but mock axios. They CANNOT detect
 * upstream breakage : Fandom changing their API shape, Wikipedia
 * blocking our User-Agent, a CDN rewriting the JSON, etc. would all
 * pass green while production silently serves blank cyan cards.
 *
 * See `feedback_tdd_http_mocks_blind_spot.md` (auto-memory) for the
 * angle-mort post-mortem from ol-companion.
 *
 * These tests are SKIPPED by default — they only run with the env var
 * `RUN_LIVE_TESTS=1` so that CI never hammers external APIs without
 * intent. The recommended cadence is :
 *   - manual run before each release
 *   - eventually a weekly CI cron (not yet wired)
 *
 * Each query is chosen to exercise a SPECIFIC branch of the 4-step
 * resolution strategy in `shared/wiki-image-strategy.ts`.
 */
import { describe, it, expect } from 'vitest';
import { resolveWikiImage, WIKI_USER_AGENT, type HttpFetch } from '../_shared/wiki-image-strategy';

const liveDescribe = process.env.RUN_LIVE_TESTS === '1' ? describe : describe.skip;

// Native fetch adapter — no axios, no mocks. Mirrors what the
// Cloudflare Pages Function does at runtime (so this also validates
// the public-prod path).
const httpFetch: HttpFetch = async (url, opts) => {
  const controller =
    opts?.timeoutMs !== undefined ? AbortSignal.timeout(opts.timeoutMs) : undefined;
  const res = await fetch(url, {
    headers: { 'User-Agent': WIKI_USER_AGENT, ...(opts?.headers ?? {}) },
    signal: controller,
  });
  // The shared strategy expects parsed JSON in `data`. Wikipedia/Fandom
  // both reply JSON for the endpoints we hit ; if not, fall through to
  // an empty object so the strategy returns null (same semantics as the
  // axios validateStatus path).
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
};

liveDescribe('wiki-image LIVE smoke tests (real APIs)', () => {
  it('Strategy 1 — Fandom direct hit (Pandora has a dedicated page)', async () => {
    const url = await resolveWikiImage('Pandora', httpFetch);
    expect(url).toBeTruthy();
    expect(url).toMatch(/static\.wikia\.nocookie\.net|wikipedia\.org|wikimedia\.org/);
  }, 15_000);

  it('Strategy 2 — Fandom search fallback (Banshee → Mountain Banshee)', async () => {
    // "Banshee" alone has no exact Fandom page ; the strategy must fall
    // through to the search endpoint and pick "Mountain Banshee" (or
    // equivalent) as the top hit.
    const url = await resolveWikiImage('Banshee', httpFetch);
    expect(url).toBeTruthy();
    expect(url).toMatch(/static\.wikia\.nocookie\.net|wikipedia\.org|wikimedia\.org/);
  }, 15_000);

  it('Strategy 3 — Wikipedia EN fallback (Tom Hanks — no Avatar Fandom page)', async () => {
    // Verified empirically (2026-05-05) :
    //   - Fandom direct → 404 (no "Tom Hanks" page on the Avatar wiki)
    //   - Fandom search → empty array
    //   - Wikipedia EN summary → originalimage hit
    // Avoids picking an actor who later gets a Fandom page (e.g. Sam
    // Worthington, Sigourney Weaver, Kate Winslet — all have Fandom
    // pages because they're in the Avatar cast).
    const url = await resolveWikiImage('Tom Hanks', httpFetch);
    expect(url).toBeTruthy();
    expect(url).toMatch(/wikipedia\.org|wikimedia\.org/);
  }, 15_000);

  it('Strategy 4 — Wikipedia FR last-chance (FR-only article)', async () => {
    // "Le Cinquième Élément" : verified empirically (2026-05-05) to
    // miss Fandom (direct + search empty), miss Wikipedia EN summary
    // (returns an internal-error type with no originalimage), then
    // succeed on Wikipedia FR. This is the only branch that exercises
    // the very last fallback — if Wikipedia FR ever changes its REST
    // contract, this test is what catches it.
    const url = await resolveWikiImage('Le Cinquième Élément', httpFetch);
    expect(url).toBeTruthy();
    expect(url).toMatch(/wikipedia\.org|wikimedia\.org/);
  }, 15_000);
});
