import React, { createContext, useState, useContext, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { getDeviceFingerprint } from '../utils/deviceFingerprint';
import { trackLogin, trackLogout, initializeAnalytics, trackError } from '../utils/analytics';

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    // Note: AuthContext is a Provider, so we use toast from react-toastify
    // Components can use useAlert from AlertContext instead
    const isLoggingOutRef = useRef(false);
    const hasLoadedUserRef = useRef(false); // Track if user has been loaded once
    const logoutRef = useRef(null); // Ref to store logout function for interceptors
    const loadingUserPromiseRef = useRef(null); // Track ongoing loadUser promise to prevent concurrent calls

    // CSRF token management
    const csrfTokenRef = useRef(null);
    const csrfTokenPromiseRef = useRef(null);

    // Function to fetch CSRF token
    const fetchCSRFToken = async () => {
        try {
            const response = await axios.get('/api/csrf-token', {
                withCredentials: true
            });
            if (response.data.success && response.data.csrfToken) {
                csrfTokenRef.current = response.data.csrfToken;
                return csrfTokenRef.current;
            }
        } catch (error) {
            console.error('Error fetching CSRF token:', error);
            return null;
        }
    };

    // Get CSRF token (with caching to avoid multiple simultaneous requests)
    const getCSRFToken = async () => {
        if (csrfTokenRef.current) {
            return csrfTokenRef.current;
        }
        
        // If a request is already in progress, wait for it
        if (csrfTokenPromiseRef.current) {
            return csrfTokenPromiseRef.current;
        }
        
        // Start fetching token
        csrfTokenPromiseRef.current = fetchCSRFToken();
        const token = await csrfTokenPromiseRef.current;
        csrfTokenPromiseRef.current = null;
        return token;
    };

    // Set up axios defaults - use useRef to keep the same instance across renders
    const apiRef = useRef(
        axios.create({
            baseURL: '/api', // This will be proxied to http://localhost:5000/api
            headers: {
                'Content-Type': 'application/json'
            },
            withCredentials: true // Include cookies in requests
        })
    );

    const api = apiRef.current;

    // Set up interceptors - these need to be set up before useEffect
    // Add token and CSRF token to requests
    api.interceptors.request.use(
        async (config) => {
            // Add auth token
            const token = localStorage.getItem('token');
            if (token) {
                config.headers['x-auth-token'] = token;
            }
            
            // Add CSRF token for non-GET requests
            if (!['GET', 'HEAD', 'OPTIONS'].includes(config.method?.toUpperCase())) {
                const csrf = await getCSRFToken();
                if (csrf) {
                    config.headers['x-csrf-token'] = csrf;
                } else {
                    // If token fetch failed, try one more time
                    console.warn('CSRF token not available, attempting to fetch...');
                    const retryToken = await fetchCSRFToken();
                    if (retryToken) {
                        config.headers['x-csrf-token'] = retryToken;
                    } else {
                        console.error('Failed to get CSRF token for request:', config.method, config.url);
                    }
                }
            }
            
            return config;
        },
        (error) => Promise.reject(error)
    );

    // Load user data when component mounts
    useEffect(() => {
        // Helper function to decode JWT token and check expiry
        const isTokenExpired = (token) => {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                const exp = payload.exp * 1000; // Convert to milliseconds
                return Date.now() >= exp;
            } catch (error) {
                return true; // If token is invalid, consider it expired
            }
        };

        // Refresh token if expired
        const refreshTokenIfNeeded = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) return false;

                // Check if token is expired or will expire in the next 5 minutes
                const payload = JSON.parse(atob(token.split('.')[1]));
                const exp = payload.exp * 1000;
                const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000;

                if (exp < fiveMinutesFromNow) {
                    // Try to refresh token
                    try {
                        const response = await api.post('/auth/refresh-token');
                        if (response.data.success && response.data.token) {
                            localStorage.setItem('token', response.data.token);
                            return true;
                        }
                    } catch (refreshError) {
                        // If refresh fails, token might be invalid
                        console.error('Failed to refresh token:', refreshError);
                        return false;
                    }
                }
                return true;
            } catch (error) {
                console.error('Error checking token expiry:', error);
                return false;
            }
        };

        const loadUser = async () => {
            // Don't load user if we're in the process of logging out
            if (isLoggingOutRef.current) {
                setLoading(false);
                return;
            }

            // If there's already a loadUser in progress, wait for it instead of starting a new one
            if (loadingUserPromiseRef.current) {
                try {
                    await loadingUserPromiseRef.current;
                } catch (err) {
                    // Ignore errors from previous load attempt
                }
                return;
            }

            // Create a promise for this load attempt
            const loadPromise = (async () => {
                try {
                    const token = localStorage.getItem('token');
                    if (!token) {
                        setLoading(false);
                        // Ensure user state is cleared if no token
                        setCurrentUser(null);
                        setIsLoggedIn(false);
                        hasLoadedUserRef.current = false;
                        return;
                    }

                    // Don't load user if we're logging out (double check)
                    if (isLoggingOutRef.current) {
                        setLoading(false);
                        return;
                    }

                    // Check if token is expired
                    if (isTokenExpired(token)) {
                        // Try to refresh token
                        const refreshed = await refreshTokenIfNeeded();
                        if (!refreshed) {
                            localStorage.removeItem('token');
                            setCurrentUser(null);
                            setIsLoggedIn(false);
                            setLoading(false);
                            hasLoadedUserRef.current = false;
                            return;
                        }
                    }

                    // Final check before making API call
                    if (isLoggingOutRef.current) {
                        setLoading(false);
                        return;
                    }

                    const response = await api.get('/auth/me');
                    if (response.data.success && response.data.data) {
                        // Final check before setting user
                        if (!isLoggingOutRef.current) {
                            setCurrentUser(response.data.data);
                            setIsLoggedIn(true);
                            hasLoadedUserRef.current = true;
                            
                            // Load user's preferred language from database
                            if (response.data.data.preferred_language) {
                                try {
                                    // Set language in localStorage first
                                    localStorage.setItem('i18nextLng', response.data.data.preferred_language);
                                    // Trigger language change event for i18n
                                    window.dispatchEvent(new CustomEvent('languageChanged', { 
                                        detail: { language: response.data.data.preferred_language } 
                                    }));
                                } catch (i18nError) {
                                    console.error('Error setting language from database:', i18nError);
                                }
                            }
                            
                            // Refresh CSRF token when user is loaded
                            try {
                                await fetchCSRFToken();
                            } catch (csrfError) {
                                console.error('Failed to refresh CSRF token after loading user:', csrfError);
                            }
                        }
                    } else {
                        // If response is not successful, clear state
                        setCurrentUser(null);
                        setIsLoggedIn(false);
                        localStorage.removeItem('token');
                        hasLoadedUserRef.current = false;
                    }
                } catch (error) {
                    // Handle 401/403 errors silently - these are expected when user is not logged in
                    if (error.response?.status === 401 || error.response?.status === 403) {
                        // Clear state on auth error (unless we're logging out)
                        if (!isLoggingOutRef.current) {
                            setCurrentUser(null);
                            setIsLoggedIn(false);
                            hasLoadedUserRef.current = false;
                            localStorage.removeItem('token');
                        }
                        // Don't log or throw 401/403 errors - they're expected when not logged in
                        return;
                    }
                    // For other errors, log but don't throw to prevent uncaught errors
                    console.error('Failed to load user', error);
                    // Clear state on any error (unless we're logging out)
                    if (!isLoggingOutRef.current) {
                        setCurrentUser(null);
                        setIsLoggedIn(false);
                        hasLoadedUserRef.current = false;
                    }
                } finally {
                    setLoading(false);
                }
            })();

            // Store the promise so concurrent calls can wait for it
            loadingUserPromiseRef.current = loadPromise;
            
            try {
                await loadPromise;
            } finally {
                // Clear the promise reference after completion
                loadingUserPromiseRef.current = null;
            }
        };

        // Load user on mount
        loadUser();

        // Set up interval to check token expiry every 5 minutes
        // Only check if not logging out
        const tokenCheckInterval = setInterval(async () => {
            if (isLoggingOutRef.current) {
                return;
            }
            const token = localStorage.getItem('token');
            if (token && !isTokenExpired(token)) {
                await refreshTokenIfNeeded();
            }
        }, 5 * 60 * 1000); // Check every 5 minutes

        return () => clearInterval(tokenCheckInterval);
    }, []); // Empty dependency array - only run on mount

    // Register new user
    const register = async (userData) => {
        try {
            const response = await api.post('/auth/register', userData);
            if (response.data.success) {
                toast.success(response.data.message);
                return response.data;
            }
        } catch (error) {
            const message = error.response?.data?.message || 'Đăng ký thất bại';
            toast.error(message);
            throw error;
        }
    };

    // Login user
    const login = async (username, password) => {
        try {
            // Lấy mã định danh thiết bị (thay thế cho MAC address)
            const deviceMac = await getDeviceFingerprint();

            const response = await api.post('/auth/login', {
                username,
                password,
                deviceMac // Gửi mã định danh thiết bị lên server
            });

            if (response.data.success) {
                localStorage.setItem('token', response.data.token);
                setCurrentUser(response.data.user);
                setIsLoggedIn(true);
                hasLoadedUserRef.current = true; // Mark as loaded

                // Refresh CSRF token after successful login
                try {
                    await fetchCSRFToken();
                } catch (csrfError) {
                    console.error('Failed to refresh CSRF token after login:', csrfError);
                }

                // Track login event
                trackLogin('email');
                initializeAnalytics(response.data.user);

                toast.success('Đăng nhập thành công');
                return response.data;
            }
        } catch (error) {
            let message = error.response?.data?.message || 'Đăng nhập thất bại';

            // Add more specific error messages
            if (error.response?.status === 401) {
                if (error.response?.data?.message === 'Thông tin đăng nhập không chính xác') {
                    message = 'Tên đăng nhập hoặc mật khẩu không chính xác';
                } else if (error.response?.data?.message === 'Tài khoản chưa được phê duyệt') {
                    message = 'Tài khoản của bạn chưa được phê duyệt bởi quản trị viên';
                } else {
                    message = 'Phiên làm việc đã hết hạn, vui lòng đăng nhập lại';
                }
            } else if (error.response?.status === 403) {
                if (error.response?.data?.message.includes('thiết bị khác')) {
                    message = 'Tài khoản này đã được liên kết với một thiết bị khác. Vui lòng liên hệ quản trị viên để được hỗ trợ.';
                }
            }

            // Track login error
            trackError('login_error', message);

            toast.error(message);
            throw error;
        }
    };

    // Google login
    const googleLogin = async (credentialResponse) => {
        try {
            const response = await api.post('/auth/google-login', {
                credential: credentialResponse.credential
            });

            if (response.data.success) {
                localStorage.setItem('token', response.data.token);
                setCurrentUser(response.data.user);
                setIsLoggedIn(true);
                hasLoadedUserRef.current = true; // Mark as loaded

                // Track Google login event
                trackLogin('google');
                initializeAnalytics(response.data.user);

                toast.success('Đăng nhập bằng Google thành công');
                return response.data;
            }
        } catch (error) {
            let message = error.response?.data?.message || 'Đăng nhập bằng Google thất bại';

            // Track Google login error
            trackError('google_login_error', message);

            toast.error(message);
            throw error;
        }
    };

    // Logout user
    const logout = async () => {
        try {
            // Set logging out flag to prevent auto-loading user (using ref to avoid re-renders)
            isLoggingOutRef.current = true;
            hasLoadedUserRef.current = false; // Reset loaded flag
            
            // Track logout event before logout
            trackLogout();

            // Clear user state FIRST to prevent any auto-login attempts
            setCurrentUser(null);
            setIsLoggedIn(false);
            
            // Remove token immediately BEFORE API call to prevent race conditions
            localStorage.removeItem('token');

            // Call logout API (but don't wait for it if it fails)
            try {
                await api.post('/auth/logout');
            } catch (apiError) {
                // If API call fails, that's okay - we've already cleared local state
                console.error('Logout API error (non-critical):', apiError);
            }
        } catch (error) {
            console.error('Error during logout', error);
            // Track logout error
            trackError('logout_error', error.message);
        } finally {
            // Ensure state is cleared even if something goes wrong
            setCurrentUser(null);
            setIsLoggedIn(false);
            localStorage.removeItem('token');
            hasLoadedUserRef.current = false;
            
            toast.info('Đã đăng xuất');
            
            // Reset logging out flag after navigation completes
            // Use a delay to ensure navigation and component unmount/remount completes
            setTimeout(() => {
                isLoggingOutRef.current = false;
            }, 3000);
        }
    };

    // Request password reset
    const forgotPassword = async (email) => {
        try {
            const response = await api.post('/auth/forgot-password', { email });
            if (response.data.success) {
                toast.success(response.data.message);
                return response.data;
            }
        } catch (error) {
            const message = error.response?.data?.message || 'Không thể yêu cầu khôi phục mật khẩu';
            toast.error(message);
            throw error;
        }
    };

    // Reset password
    const resetPassword = async (token, password) => {
        try {
            const response = await api.post('/auth/reset-password', { token, password });
            if (response.data.success) {
                toast.success(response.data.message);
                return response.data;
            }
        } catch (error) {
            const message = error.response?.data?.message || 'Không thể đặt lại mật khẩu';
            toast.error(message);
            throw error;
        }
    };

    // Verify password for sensitive operations
    const verifyPassword = async (password) => {
        try {
            const response = await api.post('/auth/verify-password', { password });
            return response.data.success;
        } catch (error) {
            const message = error.response?.data?.message || 'Xác thực mật khẩu thất bại';
            toast.error(message);
            return false;
        }
    };

    // Helper function to update user state after QR login
    const updateUserState = (user, token) => {
        localStorage.setItem('token', token);
        setCurrentUser(user);
        setIsLoggedIn(true);
        hasLoadedUserRef.current = true; // Mark as loaded
    };

    // Update logout ref whenever logout function changes
    React.useEffect(() => {
        logoutRef.current = logout;
    }, [logout]);

    React.useEffect(() => {
        let logoutTimeoutRef = null;
        let pendingLogoutRef = false; // Track if logout is already pending

        const responseInterceptor = api.interceptors.response.use(
            (response) => response,
            async (error) => {
                const originalRequest = error.config;
                
                // Handle CSRF token errors (403)
                if (error.response?.status === 403) {
                    const errorMessage = error.response?.data?.message || '';
                    const isCSRFError = errorMessage.includes('CSRF') || 
                                       errorMessage.includes('csrf') ||
                                       errorMessage.includes('CSRF token') ||
                                       errorMessage.includes('không được cung cấp') ||
                                       errorMessage.includes('không hợp lệ');
                    
                    if (isCSRFError && !originalRequest._retry) {
                        originalRequest._retry = true;
                        
                        // Clear old token and fetch new one
                        csrfTokenRef.current = null;
                        csrfTokenPromiseRef.current = null;
                        
                        const newToken = await fetchCSRFToken();
                        if (newToken) {
                            // Update header and retry
                            originalRequest.headers['x-csrf-token'] = newToken;
                            return api(originalRequest);
                        }
                    }
                }
                
                if (error.response && error.response.status === 401) {
                    // Only logout if it's not an attendance request (to avoid logout during attendance)
                    const isAttendanceRequest = error.config?.url?.includes('/attend');
                    const isAuthRequest = error.config?.url?.includes('/auth/');
                    
                    // Don't logout on auth endpoints (login, register, etc.)
                    if (!isAttendanceRequest && !isAuthRequest && !isLoggingOutRef.current && !pendingLogoutRef) {
                        // Use debouncing to prevent multiple simultaneous logout calls
                        if (logoutTimeoutRef) {
                            clearTimeout(logoutTimeoutRef);
                        }
                        
                        pendingLogoutRef = true;
                        logoutTimeoutRef = setTimeout(() => {
                            // Unauthorized, log out user using ref to avoid dependency
                            if (logoutRef.current && !isLoggingOutRef.current) {
                                logoutRef.current();
                                toast.error('Phiên làm việc đã hết hạn, vui lòng đăng nhập lại');
                            }
                            pendingLogoutRef = false;
                        }, 100); // Small delay to batch multiple 401 errors
                    }
                }
                return Promise.reject(error);
            }
        );

        return () => {
            if (logoutTimeoutRef) {
                clearTimeout(logoutTimeoutRef);
            }
            api.interceptors.response.eject(responseInterceptor);
        };
    }, []); // Empty dependency array - only set up once

    // Function to refresh current user data (for silent background updates)
    // Only updates state if there are actual changes to module_roles, role, or updated_at
    const refreshUser = useCallback(async () => {
        if (!isLoggedIn || isLoggingOutRef.current) return false;
        
        try {
            const token = localStorage.getItem('token');
            if (!token) return false;
            
            const response = await api.get('/auth/me');
            if (response.data.success && response.data.data) {
                const newUser = response.data.data;
                
                // Use functional update to get latest currentUser state and compare
                // This ensures we always compare against the most recent state
                let hasChanges = false;
                setCurrentUser(prevUser => {
                    if (!prevUser) {
                        // If no previous user, definitely update
                        hasChanges = true;
                        return newUser;
                    }
                    
                    // Compare critical fields that affect UI (module_roles, role, updated_at)
                    const currentUserStr = JSON.stringify({
                        id: prevUser.id,
                        module_roles: prevUser.module_roles || [],
                        role: prevUser.role,
                        updated_at: prevUser.updated_at
                    });
                    const newUserStr = JSON.stringify({
                        id: newUser.id,
                        module_roles: newUser.module_roles || [],
                        role: newUser.role,
                        updated_at: newUser.updated_at
                    });
                    
                    // Only update if there are actual changes
                    if (currentUserStr !== newUserStr) {
                        hasChanges = true;
                        return newUser;
                    }
                    return prevUser; // No changes, return previous state
                });
                
                // hasChanges is set synchronously within the setState callback
                // before setState returns, so it accurately reflects if we detected changes
                return hasChanges;
            }
            return false;
        } catch (error) {
            // Silently fail - don't interrupt user experience
            // Only log in development
            if (process.env.NODE_ENV === 'development') {
                console.debug('Refresh user failed:', error);
            }
            return false;
        }
    }, [isLoggedIn, api]);

    const value = {
        currentUser,
        loading,
        isLoggedIn,
        register,
        login,
        googleLogin,
        logout,
        forgotPassword,
        resetPassword,
        verifyPassword,
        updateUserState,
        refreshUser,
        api
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}
