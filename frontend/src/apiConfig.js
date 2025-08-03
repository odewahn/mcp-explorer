/**
 * Central API base URL for front-end fetch calls.
 * Override by setting VITE_API_BASE_URL in the environment.
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://0.0.0.0:8000";