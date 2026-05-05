/**
 * Re-export of the User-Agent constant from the shared strategy module.
 *
 * Kept as a module-level re-export so existing imports
 * (e.g. `wiki-image.controller.ts`) don't need to know where the
 * canonical definition lives. Source of truth :
 * `shared/wiki-image-strategy.ts`.
 */
export { WIKI_USER_AGENT } from '../_shared/wiki-image-strategy';
