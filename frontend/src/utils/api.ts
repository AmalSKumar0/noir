export interface ThrottleInfo {
  isThrottled: boolean;
  secondsRemaining: number;
}

type ThrottleListener = (info: ThrottleInfo) => void;
const listeners = new Set<ThrottleListener>();

let currentThrottle: ThrottleInfo = {
  isThrottled: false,
  secondsRemaining: 0
};

export function subscribeToThrottle(listener: ThrottleListener) {
  listeners.add(listener);
  listener(currentThrottle);
  return () => {
    listeners.delete(listener);
  };
}

function notifyThrottle(info: ThrottleInfo) {
  currentThrottle = info;
  listeners.forEach(l => l(info));
}

// In-memory cache for successful GET requests
const responseCache = new Map<string, any>();

/**
 * Centralized fetch helper that intercepts 429 Throttle errors,
 * serves cached GET data instantly during throttle periods,
 * and tracks a global throttle countdown timer.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let urlString = typeof input === 'string' ? input : (input as any).url || input.toString();
  const method = init?.method || 'GET';

  // Base domain host from env (e.g. "http://127.0.0.1:8000")
  let rawBase = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
  let host = rawBase.replace(/\/$/, '');
  if (host.endsWith('/api')) {
    host = host.replace(/\/api$/, '');
  }

  if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) {
    const cleanPath = urlString.replace(/^\//, '');
    if (cleanPath.startsWith('api/')) {
      urlString = `${host}/${cleanPath}`;
    } else {
      urlString = `${host}/api/${cleanPath}`;
    }
  }

  // Deduplicate any accidental /api/api/ pattern
  urlString = urlString.replace(/\/api\/api\//g, '/api/');

  // Auto-inject Authorization header if not already present and token exists
  const headers = new Headers(init?.headers || {});
  if (!headers.has('Authorization') && !headers.has('authorization')) {
    const token = localStorage.getItem('access_token');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const updatedInit: RequestInit = {
    ...init,
    headers,
  };

  // 1. If currently throttled, and it's a GET request, serve from cache if available
  if (currentThrottle.isThrottled && method.toUpperCase() === 'GET') {
    const cachedData = responseCache.get(urlString);
    if (cachedData) {
      console.warn(`[apiFetch] Throttled. Serving cached data for ${urlString}`);
      return new Response(JSON.stringify(cachedData), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'X-From-Cache': 'true'
        }
      });
    }
  }

  // 2. Perform the fetch request
  let response: Response;
  try {
    response = await fetch(urlString, updatedInit);
  } catch (err) {
    // If request failed entirely (network down), fallback to cache for GET
    if (method.toUpperCase() === 'GET') {
      const cachedData = responseCache.get(urlString);
      if (cachedData) {
        console.warn(`[apiFetch] Network error. Serving cached data for ${urlString}`);
        return new Response(JSON.stringify(cachedData), {
          status: 200,
          headers: { 
            'Content-Type': 'application/json',
            'X-From-Cache': 'true'
          }
        });
      }
    }
    throw err;
  }

  // 3. Handle 429 Throttle error response
  if (response.status === 429) {
    const clone = response.clone();
    try {
      const data = await clone.json();
      if (data && data.detail) {
        // Extract retry seconds from detail string (e.g. "Request was throttled. Expected available in 51 seconds.")
        const match = data.detail.match(/in\s+(\d+)\s+seconds/i);
        const waitSeconds = match ? parseInt(match[1], 10) : 60;

        let remaining = waitSeconds;
        notifyThrottle({
          isThrottled: true,
          secondsRemaining: remaining
        });

        const timer = setInterval(() => {
          remaining -= 1;
          if (remaining <= 0) {
            clearInterval(timer);
            notifyThrottle({
              isThrottled: false,
              secondsRemaining: 0
            });
          } else {
            notifyThrottle({
              isThrottled: true,
              secondsRemaining: remaining
            });
          }
        }, 1000);

        // Fallback to cache for GET requests
        if (method.toUpperCase() === 'GET') {
          const cachedData = responseCache.get(urlString);
          if (cachedData) {
            return new Response(JSON.stringify(cachedData), {
              status: 200,
              headers: { 
                'Content-Type': 'application/json',
                'X-From-Cache': 'true'
              }
            });
          }
        }
      }
    } catch (e) {
      console.error("[apiFetch] Error parsing throttle response detail:", e);
    }
  }

  // 4. Cache successful GET responses
  if (response.ok && method.toUpperCase() === 'GET') {
    const clone = response.clone();
    try {
      const data = await clone.json();
      responseCache.set(urlString, data);
    } catch (e) {
      // not JSON or not parseable
    }
  }

  return response;
}
