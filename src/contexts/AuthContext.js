import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { getDeviceFingerprint } from '../utils/deviceFingerprint';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Set up axios defaults
  const api = axios.create({
    baseURL: '/api', // This will be proxied to http://localhost:5000/api
    headers: {
      'Content-Type': 'application/json'
    },
    withCredentials: true // Include cookies in requests
  });

  // Add token to requests
  api.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers['x-auth-token'] = token;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Handle 401 responses
  api.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response && error.response.status === 401) {
        // Only logout if it's not an attendance request (to avoid logout during attendance)
        const isAttendanceRequest = error.config?.url?.includes('/attend');
        if (!isAttendanceRequest) {
          // Unauthorized, log out user
          logout();
          toast.error('Phiên làm việc đã hết hạn, vui lòng đăng nhập lại');
        }
      }
      return Promise.reject(error);
    }
  );

  // Load user data when component mounts
  useEffect(() => {
    const loadUser = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setLoading(false);
          return;
        }

        const response = await api.get('/auth/me');
        if (response.data.success) {
          setCurrentUser(response.data.data);
          setIsLoggedIn(true);
        }
      } catch (error) {
        console.error('Failed to load user', error);
        localStorage.removeItem('token');
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

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
      console.log('Device MAC for login:', deviceMac);
      
      const response = await api.post('/auth/login', { 
        username, 
        password,
        deviceMac // Gửi mã định danh thiết bị lên server
      });
      
      if (response.data.success) {
        localStorage.setItem('token', response.data.token);
        setCurrentUser(response.data.user);
        setIsLoggedIn(true);
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
        toast.success('Đăng nhập bằng Google thành công');
        return response.data;
      }
    } catch (error) {
      let message = error.response?.data?.message || 'Đăng nhập bằng Google thất bại';
      toast.error(message);
      throw error;
    }
  };

  // Logout user
  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Error during logout', error);
    } finally {
      localStorage.removeItem('token');
      setCurrentUser(null);
      setIsLoggedIn(false);
      toast.info('Đã đăng xuất');
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
  };

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
    api
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
 