import { useState, useEffect } from 'react';
import { apiFetch } from './api';

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
  localStorage.removeItem('user_role');
  localStorage.removeItem('user');
  localStorage.removeItem('noir_user_projects');
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
 * Decodes a JWT token payload.
 */
function decodeJwt(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    // Replace characters to make it base64-compatible from base64url
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(base64);
    return JSON.parse(decoded);
  } catch (error) {
    return null;
  }
}

/**
 * Checks if a JWT token is expired.
 * Includes a safety buffer of 10 seconds.
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeJwt(token);
  if (!payload || typeof payload.exp !== 'number') {
    return true;
  }
  const currentTime = Math.floor(Date.now() / 1000);
  // Add a 10 second safety buffer
  return payload.exp - 10 < currentTime;
}

// Single-flight promise reference to prevent multiple concurrent token refresh requests
let refreshPromise: Promise<string | null> | null = null;

/**
 * Reusable function that checks if the access token is expired/missing.
 * If expired, it uses the refresh token to get new tokens from the backend.
 * Returns the valid access token, or null if unauthorized/error.
 */
export async function checkAndRefreshToken(): Promise<string | null> {
  const accessToken = getAccessToken();
  const refreshToken = getRefreshToken();

  // If we have an access token and it is not expired, return it immediately.
  if (accessToken && !isTokenExpired(accessToken)) {
    return accessToken;
  }

  // If there's no refresh token, we cannot perform a refresh.
  // If the access token was expired/invalid, clean up the auth state.
  if (!refreshToken) {
    if (accessToken) {
      clearAuthTokens();
    }
    return null;
  }

  // If a refresh request is already in progress, await the existing promise.
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const response = await apiFetch(`${baseUrl}/api/accounts/token/refresh/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh: refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.access) {
          setAuthTokens(data.access, data.refresh);
          return data.access;
        }
      }

      // If the backend rejects the refresh token, wipe credentials.
      clearAuthTokens();
      return null;
    } catch (error) {
      console.error('Error refreshing token:', error);
      // We don't wipe tokens on network failures to allow retries later.
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
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
      await apiFetch(`${baseUrl}/api/accounts/logout/`, {
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

/**
 * Retrieves the user's role from localStorage, or falls back to decoding the access token.
 */
export function getUserRole(): string | null {
  const localRole = localStorage.getItem('user_role');
  if (localRole) return localRole;

  const token = getAccessToken();
  if (token) {
    const payload = decodeJwt(token);
    if (payload) {
      if (payload.role) return payload.role;
      if (payload.is_superuser || payload.is_staff) return 'admin';
    }
  }
  return null;
}

