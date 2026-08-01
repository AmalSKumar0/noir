/**
 * Utility function to initiate GitHub OAuth authentication flow.
 */
export function initiateGithubOAuth() {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
  window.location.href = `${baseUrl}/api/accounts/github/login?client=frontend`;
}

/**
 * Utility function to initiate Google OAuth authentication flow.
 */
export function initiateGoogleOAuth() {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
  window.location.href = `${baseUrl}/api/accounts/google/login?client=frontend`;
}
