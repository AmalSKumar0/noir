import { useState, useEffect } from 'react';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const AUTH_EVENT_NAME = 'noir_auth_state_change';

/**
 * Stores JWT tokens and triggers a global auth state change event.
 */
export function setAuthTokens(access: string, refresh?: string): void {
  if (access) {
    localStorage.setItem(ACCESS_TOKEN_KEY, access);
  }
  if (refresh) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  }
  window.dispatchEvent(new Event(AUTH_EVENT_NAME));
}

/**
 * Clears JWT tokens and triggers a global auth state change event.
 */
export function clearAuthTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.dispatchEvent(new Event(AUTH_EVENT_NAME));
}

/**
 * Returns current access token.
 */
export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

/**
 * Returns current refresh token.
 */
export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * Checks if user is authenticated (valid access token exists).
 */
export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

/**
 * Performs an instant, secure logout:
 * 1. Instantly clears client-side tokens and notifies reactive listeners.
 * 2. Navigates user immediately to /login.
 * 3. Asynchronously invalidates refresh token on backend.
 */
export async function logout(navigate?: (path: string, options?: any) => void): Promise<void> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
  const refreshToken = getRefreshToken();
  const accessToken = getAccessToken();

  // Instant local wipe and immediate navigation for zero UX latency
  clearAuthTokens();
  if (navigate) {
    navigate('/login', { replace: true });
  }

  if (refreshToken) {
    try {
      await fetch(`${baseUrl}/api/accounts/logout/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({ refresh: refreshToken }),
      });
    } catch (error) {
      // Ignore background fetch errors during logout
    }
  }
}

/**
 * Custom React hook to reactively track authentication status.
 */
export function useAuthState(): boolean {
  const [authed, setAuthed] = useState<boolean>(() => isAuthenticated());

  useEffect(() => {
    const handleAuthChange = () => {
      setAuthed(isAuthenticated());
    };

    window.addEventListener(AUTH_EVENT_NAME, handleAuthChange);
    window.addEventListener('storage', handleAuthChange);

    return () => {
      window.removeEventListener(AUTH_EVENT_NAME, handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
    };
  }, []);

  return authed;
}
