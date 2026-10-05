import { getApiBaseUrl } from './api';

/**
 * Utility function to initiate GitHub OAuth authentication flow.
 */
export function initiateGithubOAuth() {
  const baseUrl = getApiBaseUrl();
  window.location.href = `${baseUrl}/api/accounts/github/login?client=frontend`;
}

/**
 * Utility function to initiate Google OAuth authentication flow.
 */
export function initiateGoogleOAuth() {
  const baseUrl = getApiBaseUrl();
  window.location.href = `${baseUrl}/api/accounts/google/login?client=frontend`;
}

