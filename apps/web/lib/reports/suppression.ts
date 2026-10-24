/**
 * Web-side entry point for the shared suppression helpers (Objective 5).
 * Kept as a re-export so report code imports a local path while the tested
 * implementation lives in `@dorsu/shared-services`.
 */
export { MIN_CELL, isSuppressed, suppressCount, suppressCohorts } from "@dorsu/shared-services";
