/**
 * Utility function to initiate GitHub OAuth authentication flow.
 */
export function initiateGithubOAuth() {
  const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID || import.meta.env.GITHUB_CLIENT_ID;
  const redirectUri = encodeURIComponent(`${window.location.origin}/github/callback/`);
  const githubUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=read:user%20user:email`;
  window.location.href = githubUrl;
}

/**
 * Utility function to initiate Google OAuth authentication flow.
 */
export function initiateGoogleOAuth() {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
  window.location.href = `${baseUrl}/api/accounts/google/login/`;
}
