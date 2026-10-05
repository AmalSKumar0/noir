import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearAuthTokens, getAccessToken, getRefreshToken } from '../utils/auth';
import { apiFetch, getApiBaseUrl } from '../utils/api';

export default function Logout() {
  const navigate = useNavigate();

  useEffect(() => {
    const baseUrl = getApiBaseUrl();
    const refreshToken = getRefreshToken();
    const accessToken = getAccessToken();

    // Fire background API call to invalidate token on server
    if (refreshToken) {
      apiFetch(`${baseUrl}/api/accounts/logout/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({ refresh: refreshToken }),
      }).catch(() => {});
    }

    // Instantly wipe auth tokens and redirect without buffering
    clearAuthTokens();
    navigate('/login', { replace: true });
  }, [navigate]);

  return null;
}
