export const STATUS_PAGE_URL = 'https://statusims.pctu.edu.vn/';

// Legacy addresses redirect to the single status root; API /api/status is unchanged.
export function getStatusPageRedirect(location, standalone = false) {
  const statusHost = location.hostname === 'statusims.pctu.edu.vn';
  const statusPort = location.port === '3001';
  if (standalone || statusHost || statusPort) return location.pathname === '/' ? null : '/';
  return /^\/status\/?$/.test(location.pathname) ? STATUS_PAGE_URL : null;
}
