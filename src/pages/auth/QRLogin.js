import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { getDeviceFingerprint } from '../../utils/deviceFingerprint';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/auth.css';

const QRLogin = () => {
  usePageTitle('Đăng nhập bằng QR');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { updateUserState } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [deviceMac, setDeviceMac] = useState('');

  const token = searchParams.get('token');

  useEffect(() => {
    // Add auth-page class to body
    document.body.classList.add('auth-page');
    
    if (!token) {
      setError('Token QR không hợp lệ');
      return;
    }

    // Auto-login if token is provided
    handleQRLogin();
    
    return () => {
      // Remove auth-page class from body
      document.body.classList.remove('auth-page');
    };
  }, [token]);

  const handleQRLogin = async () => {
    if (!token) {
      setError('Token QR không hợp lệ');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Get device fingerprint/MAC address using the proper utility
      const deviceMac = await getDeviceFingerprint();
      setDeviceMac(deviceMac);

      const response = await axios.post('/api/auth/qr-login', {
        token: token,
        deviceMac: deviceMac
      });

      if (response.data.success) {
        setSuccess(true);
        
        // Update AuthContext using the helper function
        updateUserState(response.data.user, response.data.token);
        
        // Redirect based on user role or module_roles
        setTimeout(() => {
          const userRole = response.data.user.role;
          const moduleRoles = response.data.user.module_roles || [];
          console.log('QR Login successful, user role:', userRole);
          console.log('Module roles:', moduleRoles);
          console.log('Current user in AuthContext:', response.data.user);
          
          // Helper to get effective clinical role
          const getEffectiveClinicalRole = () => {
            if (moduleRoles.includes('clinical_admin')) return 'clinical_admin';
            if (moduleRoles.includes('clinical_mod')) return 'clinical_mod';
            if (moduleRoles.includes('clinical_staff')) return 'clinical_staff';
            return null;
          };
          
          // Only superadmin goes to IMS dashboard
          if (userRole === 'superadmin') {
            console.log('Navigating to:', '/ims/dashboard');
            navigate('/ims/dashboard');
          }
          // Students go to student dashboard
          else if (userRole === 'student') {
            console.log('Navigating to:', '/student/attendance');
            navigate('/student/attendance');
          }
          // All other users (admin, staff, clinical_admin, clinical_mod, clinical_staff, etc.) go to personal dashboard
          else {
            console.log('Navigating to:', '/personal/dashboard');
            navigate('/personal/dashboard');
          }
        }, 2000);
      }
    } catch (error) {
      console.error('QR Login error:', error);
      setError(
        error.response?.data?.message || 
        'Có lỗi xảy ra khi đăng nhập bằng QR code'
      );
    } finally {
      setLoading(false);
    }
  };


  const handleRetry = () => {
    setError('');
    setSuccess(false);
    handleQRLogin();
  };

  const handleGoToLogin = () => {
    navigate('/login');
  };

  if (success) {
    return (
      <div className="auth-container">
        <div className="auth-card">
        <div className="auth-header">
          <h2>PCTU IMS</h2>
        </div>
        <div className="success-message">
          <div className="success-icon">✅</div>
          <p>Đăng nhập thành công!</p>
          <p>Bạn đã đăng nhập thành công bằng QR code.</p>
          <p>Đang chuyển hướng...</p>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h2>PCTU IMS</h2>
          <p>Trường Đại học Phan Châu Trinh</p>
          <div className="university-badge">
            <i className="fas fa-qrcode medical-icon"></i>
            Đăng nhập bằng QR Code
          </div>
        </div>

        {loading && (
          <div className="loading-container">
            <div className="spinner"></div>
            <p style={{color: '#243571', fontWeight: '600'}}>
              <i className="fas fa-qrcode me-2"></i>
              Đang xác thực mã QR...
            </p>
          </div>
        )}

        {error && (
          <div className="error-container">
            <div className="error-icon">❌</div>
            <p className="error-message">{error}</p>
            <div className="error-actions">
              <button 
                onClick={handleRetry} 
                className="btn btn-primary"
                style={{
                  borderRadius: '25px',
                  padding: '14px 32px',
                  fontWeight: '500',
                  fontSize: '16px',
                  letterSpacing: '-0.01em',
                  border: 'none',
                  background: '#314691',
                  color: '#ffffff',
                  boxShadow: '0 2px 8px rgba(0, 122, 255, 0.2)',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  cursor: 'pointer',
                  margin: '0 8px'
                }}
              >
                <i className="fas fa-redo me-2"></i>
                Thử lại
              </button>
              <button 
                onClick={handleGoToLogin} 
                className="btn btn-secondary"
                style={{
                  borderRadius: '25px',
                  padding: '14px 32px',
                  fontWeight: '500',
                  fontSize: '16px',
                  letterSpacing: '-0.01em',
                  border: 'none',
                  background: '#8E8E93',
                  color: '#ffffff',
                  boxShadow: '0 2px 8px rgba(142, 142, 147, 0.2)',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  cursor: 'pointer',
                  margin: '0 8px'
                }}
              >
                <i className="fas fa-sign-in-alt me-2"></i>
                Đăng nhập thường
              </button>
            </div>
          </div>
        )}

        {!loading && !error && (
          <div className="info-container">
            <div className="info-icon">📱</div>
            <p style={{color: '#243571', fontWeight: '600'}}>
              <i className="fas fa-clock me-2"></i>
              Vui lòng đợi trong giây lát...
            </p>
            <div className="medical-badge">
              <i className="fas fa-shield-alt me-1"></i>
              Xác thực an toàn
            </div>
          </div>
        )}

        <div className="auth-footer">
          <p>
            <a href="/login">
              <i className="fas fa-arrow-left me-1"></i>
              Quay lại trang đăng nhập
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default QRLogin;
