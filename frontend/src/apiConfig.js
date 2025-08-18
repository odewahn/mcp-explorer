/**
 * Central API base URL for front-end fetch calls.
 * Override by setting VITE_API_BASE_URL in the environment.
 */
// Base URL for the back-end API; in production this will be same-origin
// In production this will resolve to '/api/...'; override with VITE_API_BASE_URL if needed
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";