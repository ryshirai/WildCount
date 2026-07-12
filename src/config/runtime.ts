/**
 * Runtime feature flags for prod vs dev surfaces.
 *
 * - Production (vite build): online multiplayer only. No local bot demo, no UI mock.
 * - Development (`npm run dev`): local demo, ?mock=1, MockBadge, offline lobby.
 */

/** Vite: true only when running the dev server (not production builds). */
export const isDevBuild = import.meta.env.DEV

/**
 * Local engine / bot game (Home “ローカル対戦”, offline lobby start, /game without online).
 * Disabled in production builds.
 */
export const allowLocalPlay = isDevBuild

/**
 * Fixed UI mock (`?mock=1`, mock data cut-in preview, MockBadge).
 * Disabled in production builds.
 */
export const allowUiMock = isDevBuild
