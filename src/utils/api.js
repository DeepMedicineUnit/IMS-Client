import axios from 'axios';

// Determine API base URL
// Production: Client (ims/statusims) và API (apiims) khác subdomain → phải gọi đúng domain API.
// Development: Use relative URL for proxy.
const getApiBaseURL = () => {
    if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined') {
        // Ưu tiên env nếu là URL công khai (https://apiims...). Bỏ qua nếu rỗng hoặc URL nội bộ (http://status:5009, http://gateway:5000).
        const envUrl = (process.env.REACT_APP_API_URL || '').trim();
        const isInternalUrl = /^https?:\/\/[^/.:]+:\d+/.test(envUrl); // host không có dấu chấm + port = Docker nội bộ
        if (envUrl && envUrl.startsWith('http') && !isInternalUrl) {
            const url = envUrl.replace(/\/+$/, '');
            return url.includes('/api') ? url : `${url}/api`;
        }
        const hostname = window.location.hostname;
        const protocol = window.location.protocol;
        // Production: API luôn ở apiims.pctu.edu.vn (không cùng host với ims/statusims)
        if (hostname === 'ims.pctu.edu.vn' || hostname === 'www.ims.pctu.edu.vn' ||
            hostname === 'statusims.pctu.edu.vn') {
            return `${protocol}//apiims.pctu.edu.vn/api`;
        }
        // Same-host (localhost / IP): dùng port 8043
        return `${protocol}//${hostname}:8043/api`;
    }
    return '/api';
};

// CSRF token management
let csrfToken = null;
let csrfTokenPromise = null;

// Function to fetch CSRF token
const fetchCSRFToken = async () => {
    try {
        const apiBaseURL = getApiBaseURL();
        const response = await axios.get(`${apiBaseURL}/csrf-token`, {
            withCredentials: true
        });
        if (response.data.success && response.data.csrfToken) {
            csrfToken = response.data.csrfToken;
            return csrfToken;
        }
    } catch (error) {
        console.error('Error fetching CSRF token:', error);
        return null;
    }
};

// Get CSRF token (with caching to avoid multiple simultaneous requests)
const getCSRFToken = async () => {
    if (csrfToken) {
        return csrfToken;
    }
    
    // If a request is already in progress, wait for it
    if (csrfTokenPromise) {
        return csrfTokenPromise;
    }
    
    // Start fetching token
    csrfTokenPromise = fetchCSRFToken();
    const token = await csrfTokenPromise;
    csrfTokenPromise = null;
    return token;
};

// Pre-fetch CSRF token if user is logged in (bỏ qua trên trang công khai để tránh gọi API khi chưa cần)
const preFetchCSRFToken = () => {
    if (typeof window !== 'undefined' && window.location.pathname === '/dat-phong-cong-khai') {
        return;
    }
    const token = localStorage.getItem('token');
    if (token && !csrfToken && !csrfTokenPromise) {
        // Fetch token in background
        fetchCSRFToken().catch(err => {
            console.error('Failed to pre-fetch CSRF token:', err);
        });
    }
};

// Pre-fetch CSRF token on module load if user is logged in
preFetchCSRFToken();

// --- Lightweight response cache (browser only) ----------------------------
const CACHE_PREFIX = 'api-cache:';
const CACHE_INDEX_KEY = `${CACHE_PREFIX}__index__`;
const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes - keep data warm between sessions
const MAX_CACHE_ITEMS = 200; // soft limit to avoid unbounded growth
const CACHE_VERSION = 'v1'; // bump to invalidate old schema if needed

const isLocalStorageAvailable = () => {
    try {
        const testKey = '__api_cache_test__';
        localStorage.setItem(testKey, '1');
        localStorage.removeItem(testKey);
        return true;
    } catch (error) {
        console.warn('LocalStorage not available, skip caching.', error);
        return false;
    }
};

const localStorageEnabled = isLocalStorageAvailable();

const getCacheIndex = () => {
    if (!localStorageEnabled) return [];
    try {
        const raw = localStorage.getItem(CACHE_INDEX_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (error) {
        console.warn('Failed to read cache index', error);
        return [];
    }
};

const saveCacheIndex = (index) => {
    if (!localStorageEnabled) return;
    try {
        localStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index));
    } catch (error) {
        console.warn('Failed to persist cache index', error);
    }
};

const pruneCacheIfNeeded = () => {
    const index = getCacheIndex();
    if (index.length <= MAX_CACHE_ITEMS) return;

    // Remove oldest entries beyond soft limit
    const sorted = [...index].sort((a, b) => a.timestamp - b.timestamp);
    const toRemove = sorted.slice(0, index.length - MAX_CACHE_ITEMS);
    toRemove.forEach((item) => localStorage.removeItem(item.key));
    const remainingKeys = sorted.slice(index.length - MAX_CACHE_ITEMS);
    saveCacheIndex(remainingKeys);
};

const buildCacheKey = (url, params = {}) => {
    const paramsString = JSON.stringify(params, Object.keys(params).sort());
    return `${CACHE_PREFIX}${CACHE_VERSION}:${url}|${paramsString}`;
};

const readCache = (key) => {
    if (!localStorageEnabled) return null;
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && parsed.data !== undefined ? parsed : null;
    } catch (error) {
        console.warn('Failed to read cache entry', error);
        return null;
    }
};

const writeCache = (key, data, meta = {}) => {
    if (!localStorageEnabled) return;
    const entry = { 
        data, 
        timestamp: meta.timestamp || Date.now(),
        etag: meta.etag || null,
        lastModified: meta.lastModified || null
    };
    try {
        localStorage.setItem(key, JSON.stringify(entry));
        const index = getCacheIndex();
        const filtered = index.filter((item) => item.key !== key);
        filtered.push({ key, timestamp: entry.timestamp });
        saveCacheIndex(filtered);
        pruneCacheIfNeeded();
    } catch (error) {
        console.warn('Failed to write cache entry', error);
    }
};

const clearCache = (predicate = null) => {
    if (!localStorageEnabled) return;
    try {
        const index = getCacheIndex();
        const keep = [];
        index.forEach((item) => {
            if (predicate && predicate(item.key)) {
                localStorage.removeItem(item.key);
            } else {
                keep.push(item);
            }
        });
        saveCacheIndex(predicate ? keep : []);
        if (!predicate) {
            // Remove stray items without index
            Object.keys(localStorage)
                .filter((key) => key.startsWith(CACHE_PREFIX))
                .forEach((key) => localStorage.removeItem(key));
        }
    } catch (error) {
        console.warn('Failed to clear cache', error);
    }
};

const extractCacheMeta = (response) => {
    if (!response) return {};
    const headers = response.headers || {};
    return {
        etag: headers.etag || headers.ETag || headers['if-none-match'] || null,
        lastModified: headers['last-modified'] || headers['Last-Modified'] || null
    };
};

const buildConditionalHeaders = (cacheEntry) => {
    if (!cacheEntry) return {};
    const headers = {};
    if (cacheEntry.etag) headers['If-None-Match'] = cacheEntry.etag;
    if (cacheEntry.lastModified) headers['If-Modified-Since'] = cacheEntry.lastModified;
    return headers;
};

const refreshCacheInBackground = async (rawGet, url, config, cacheKey, cachedEntry) => {
    const refreshConfig = { 
        ...config, 
        headers: { ...(config?.headers || {}), ...buildConditionalHeaders(cachedEntry) } 
    };
    try {
        const response = await rawGet(url, refreshConfig);
        // 304 means no body, keep old data but refresh timestamp for eviction logic
        if (response.status === 304 && cachedEntry) {
            writeCache(cacheKey, cachedEntry.data, { 
                ...cachedEntry, 
                timestamp: Date.now() 
            });
            return;
        }
        writeCache(cacheKey, response.data, extractCacheMeta(response));
    } catch (error) {
        // Silently ignore background refresh errors
        if (cachedEntry && error?.response?.status === 304) {
            writeCache(cacheKey, cachedEntry.data, { 
                ...cachedEntry, 
                timestamp: Date.now() 
            });
        }
    }
};

const toAxiosLikeFromCache = (cachedEntry, url, config, extras = {}) => ({
    data: cachedEntry.data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { ...config, url },
    request: null,
    cached: true,
    stale: extras.stale || false,
    revalidated: extras.revalidated || false,
    offline: extras.offline || false
});

// Create API instance
const api = axios.create({
    baseURL: getApiBaseURL(),
    headers: {
        'Content-Type': 'application/json'
    },
    withCredentials: true
});

// Preserve raw GET for internal use
const rawGet = api.get.bind(api);

// Request interceptor - Add auth token and CSRF token
api.interceptors.request.use(
    async (config) => {
        // FormData: bỏ Content-Type để axios tự set multipart/form-data; boundary=...
        // (default 'application/json' khiến gateway nhận body JSON 12 bytes → 400)
        if (config.data instanceof FormData) {
            delete config.headers['Content-Type'];
            delete config.headers['content-type'];
        }
        // Add auth token
        // Browser client luôn khai báo loại client để server phân biệt với desktop app.
        config.headers['X-Client-Type'] = 'web';
        const token = localStorage.getItem('token');
        if (token) {
            config.headers['x-auth-token'] = token;
        }
        
        // Add CSRF token for non-GET requests
        if (!['GET', 'HEAD', 'OPTIONS'].includes(config.method?.toUpperCase())) {
            // For FormData requests, ensure we can set headers
            // Axios will automatically set Content-Type for FormData, but we can still add custom headers
            try {
                const csrf = await getCSRFToken();
                if (csrf) {
                    // Always set CSRF token header, even for FormData
                    config.headers['x-csrf-token'] = csrf;
                } else {
                    // If token fetch failed, try one more time
                    console.warn('CSRF token not available, attempting to fetch...');
                    const retryToken = await fetchCSRFToken();
                    if (retryToken) {
                        config.headers['x-csrf-token'] = retryToken;
                        csrfToken = retryToken; // Update cached token
                    } else {
                        console.error('Failed to get CSRF token for request:', config.method, config.url);
                    }
                }
            } catch (error) {
                console.error('Error getting CSRF token:', error);
                // Don't block the request, let it fail naturally if CSRF is required
            }
        }
        
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor - Handle CSRF token errors and flush cache on mutation
api.interceptors.response.use(
    (response) => {
        // For non-GET requests, clear cached GET responses to avoid stale data
        const method = response?.config?.method?.toUpperCase();
        if (method && method !== 'GET') {
            clearCache();
        }
        return response;
    },
    async (error) => {
        const originalRequest = error.config;
        
        // If CSRF token error (check for both English and Vietnamese messages)
        if (error.response?.status === 403) {
            const errorMessage = error.response?.data?.message || '';
            const isCSRFError = errorMessage.includes('CSRF') || 
                               errorMessage.includes('csrf') ||
                               errorMessage.includes('CSRF token') ||
                               errorMessage.includes('không được cung cấp') ||
                               errorMessage.includes('không hợp lệ') ||
                               errorMessage.includes('hết hạn');
            
            if (isCSRFError) {
                // Clear old token
                csrfToken = null;
                csrfTokenPromise = null;
                
                // Don't retry if already retried
                if (!originalRequest._retry) {
                    originalRequest._retry = true;
                    
                    // Fetch new CSRF token
                    try {
                        const newToken = await fetchCSRFToken();
                        if (newToken) {
                            // Update header and retry
                            originalRequest.headers['x-csrf-token'] = newToken;
                            csrfToken = newToken; // Update cached token
                            return api(originalRequest);
                        }
                    } catch (retryError) {
                        console.error('Failed to refresh CSRF token on retry:', retryError);
                    }
                }
            }
        }
        
        return Promise.reject(error);
    }
);

// Cached GET helper
const getWithCache = async (url, config = {}, options = {}) => {
    const {
        maxAgeMs = DEFAULT_TTL_MS,
        disableCache = false,
        backgroundRefresh = true,
        forceRefresh = false,
        cacheKey: customKey,
        returnCachedFirst = true
    } = options;

    const finalConfig = { ...config };
    const method = finalConfig.method?.toUpperCase() || 'GET';

    // Bypass cache if not a GET request or explicitly disabled
    if (method !== 'GET' || disableCache || finalConfig.headers?.['x-bypass-cache']) {
        const response = await rawGet(url, finalConfig);
        return { ...response, cached: false };
    }

    const cacheKey = customKey || buildCacheKey(url, finalConfig.params || {});
    const cached = forceRefresh ? null : readCache(cacheKey);
    const isFresh = cached && Date.now() - cached.timestamp < maxAgeMs;
    const shouldServeCached = cached && returnCachedFirst && !forceRefresh;

    if (shouldServeCached && cached.data !== undefined) {
        if (backgroundRefresh) {
            refreshCacheInBackground(rawGet, url, finalConfig, cacheKey, cached);
        }
        return toAxiosLikeFromCache(cached, url, finalConfig, { stale: !isFresh });
    }

    if (cached && !forceRefresh) {
        finalConfig.headers = { ...(finalConfig.headers || {}), ...buildConditionalHeaders(cached) };
    }

    try {
        const response = await rawGet(url, finalConfig);
        if (response.status === 304 && cached) {
            writeCache(cacheKey, cached.data, { ...cached, timestamp: Date.now() });
            return toAxiosLikeFromCache(cached, url, finalConfig, { revalidated: true });
        }
        writeCache(cacheKey, response.data, extractCacheMeta(response));
        return { ...response, cached: false, revalidated: !!cached };
    } catch (error) {
        // If the network fails but we have cached data, fall back to it
        if (cached && !forceRefresh) {
            return toAxiosLikeFromCache(cached, url, finalConfig, { stale: true, offline: true });
        }
        throw error;
    }
};

// Replace default GET with cached version, keep rawGet accessible
api.rawGet = rawGet;
api.getWithCache = getWithCache;
api.get = (url, config) => getWithCache(url, config);
api.clearCache = clearCache;

// Export function to manually refresh CSRF token
export const refreshCSRFToken = async () => {
    csrfToken = null;
    csrfTokenPromise = null;
    return await fetchCSRFToken();
};

// Export function to check if CSRF token is available
export const hasCSRFToken = () => {
    return !!csrfToken;
};

// Socket.IO URL - phải cùng host/port với server xử lý API (gateway hoặc main server)
const getSocketUrl = () => {
    if (process.env.REACT_APP_SOCKET_URL) {
        return process.env.REACT_APP_SOCKET_URL;
    }
    const base = getApiBaseURL();
    if (typeof window !== 'undefined' && base && base.startsWith('http')) {
        return base.replace(/\/api\/?$/, '').replace(/\/$/, '');
    }
    if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined') {
        return `${window.location.protocol}//${window.location.hostname}:8043`;
    }
    return 'http://localhost:5000';
};

// Base URL cho static uploads (avatar, face-samples, session images): gateway phục vụ tại /uploads, không có /api
const getUploadsBaseURL = () => {
    const apiBase = getApiBaseURL();
    if (typeof apiBase === 'string' && apiBase.startsWith('http')) {
        return apiBase.replace(/\/api\/?$/, '').replace(/\/$/, '');
    }
    return typeof window !== 'undefined' ? window.location.origin : '';
};

// Export getApiBaseURL for use in other files
export { getApiBaseURL, getUploadsBaseURL, getSocketUrl };

export default api;
