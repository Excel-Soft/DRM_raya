/**
 * DEPRECATED ALIAS — kept only so the legacy route `/drm/delay-projects-new`
 * keeps working. The canonical Delay Projects screen is
 * `client/src/pages/drm/delay-project.tsx` (route `/drm/delay-project`), which is
 * backed by the single data source GET /api/hod/projects/delayed.
 *
 * Stage 7: the old hardcoded-mock variant was removed and this file now re-exports
 * the canonical page so both routes render one component + one backend source.
 */
export { default } from "./delay-project";
