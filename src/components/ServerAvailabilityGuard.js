import { useEffect } from 'react';
import api from '../utils/api';
import { STATUS_PAGE_URL } from '../utils/systemStatus';

// Also handles an already-open tab. The independent proxy handles new visits.
export default function ServerAvailabilityGuard() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || window.location.hostname === 'statusims.pctu.edu.vn') return undefined;
    let disposed = false;
    let failures = 0;
    let controller = null;
    let pending = false;
    const check = async () => {
      if (pending || disposed || document.hidden || !navigator.onLine) return;
      pending = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const base = String(api.defaults.baseURL || '/api').replace(/\/+$/, '');
        const response = await fetch(base + '/health', { cache: 'no-store', credentials: 'omit', signal: controller.signal });
        if (response.ok) {
          const data = await response.json();
          // An HTML fallback or misconfigured endpoint is not proof of an outage.
          failures = data && data.success === false ? failures + 1 : 0;
        } else if ([500, 502, 503, 504, 521, 522, 523, 524, 525, 526].includes(response.status)) {
          failures += 1;
        } else {
          failures = 0; // Do not redirect for login errors, 404 or rate limits.
        }
      } catch (error) {
        if (error instanceof SyntaxError) failures = 0;
        else if (navigator.onLine && !disposed) failures += 1;
      } finally {
        clearTimeout(timeout);
        pending = false;
        if (!disposed && navigator.onLine && !document.hidden && failures >= 3) window.location.replace(STATUS_PAGE_URL);
      }
    };
    const resumed = () => { if (!document.hidden) check(); };
    const offline = () => { failures = 0; };
    const interval = setInterval(check, 60000);
    document.addEventListener('visibilitychange', resumed);
    window.addEventListener('online', check);
    window.addEventListener('offline', offline);
    check();
    return () => {
      disposed = true;
      clearInterval(interval);
      if (controller) controller.abort();
      document.removeEventListener('visibilitychange', resumed);
      window.removeEventListener('online', check);
      window.removeEventListener('offline', offline);
    };
  }, []);
  return null;
}
