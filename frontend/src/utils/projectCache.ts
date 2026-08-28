import { apiFetch } from './api';
import { checkAndRefreshToken } from './auth';

export interface Project {
  id: string;
  name: string;
  status: 'active' | 'archived' | 'error';
  lastUpdated: string;
  environments: number;
  connectionCode?: string;
}

const STORAGE_KEY = 'noir_user_projects';

// Track single initial fetch per browser session / page load
let hasInitialFetched = false;

export function formatLastUpdated(dateString?: string): string {
  if (!dateString) return 'Just now';
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  return `${Math.floor(diffInSeconds / 86400)} days ago`;
}

/**
 * Get cached projects from temporary device storage (localStorage)
 */
export function getCachedProjects(): Project[] {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (e) {
      console.error('Error reading projects cache:', e);
    }
  }
  return [];
}

/**
 * Save projects to temporary device storage (localStorage)
 */
export function setCachedProjects(projects: Project[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

/**
 * Clear cache (e.g. on logout)
 */
export function clearCachedProjects(): void {
  hasInitialFetched = false;
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Load user projects from device temp storage or backend.
 * Only sends request to backend on initial page load/reload, or when forceRefresh is true (e.g. project created).
 * Prevents redundant API calls on page transitions.
 */
export async function getUserProjects(options?: { forceRefresh?: boolean }): Promise<Project[]> {
  const cached = getCachedProjects();

  // If already fetched during this page session and not forcing refresh, return temp stored projects without API call
  if (hasInitialFetched && !options?.forceRefresh) {
    return cached;
  }

  try {
    const token = await checkAndRefreshToken();
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
    const response = await apiFetch(`${baseUrl}/api/project/my/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.results && Array.isArray(data.results)) {
        const mapped: Project[] = data.results.map((p: any) => ({
          id: String(p.id),
          name: p.title,
          status: p.status === 'active' ? 'active' : p.status === 'error' ? 'error' : 'archived',
          lastUpdated: p.updated_at ? formatLastUpdated(p.updated_at) : 'Just now',
          environments: 1,
          connectionCode: p.connection_code || ''
        }));

        setCachedProjects(mapped);
        hasInitialFetched = true;
        return mapped;
      }
    }
  } catch (err) {
    console.error('Failed to fetch user projects from backend:', err);
  }

  hasInitialFetched = true;
  return cached;
}
