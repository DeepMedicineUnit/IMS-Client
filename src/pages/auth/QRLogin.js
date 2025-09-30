import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { getDeviceFingerprint } from '../../utils/deviceFingerprint';
import '../../styles/auth.css';

const QRLogin = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { updateUserState } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [deviceMac, setDeviceMac] = useState('');

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setError('Token QR không hợp lệ');
      return;
    }

    // Auto-login if token is provided
    handleQRLogin();
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
        
        // Redirect based on user role
        setTimeout(() => {
          const userRole = response.data.user.role;
          console.log('QR Login successful, user role:', userRole);
          console.log('Current user in AuthContext:', response.data.user);
          console.log('Navigating to:', `/staff/dashboard`);
          
          switch (userRole) {
            case 'superadmin':
              navigate('/superadmin/dashboard');
              break;
            case 'admin':
              navigate('/admin/dashboard');
              break;
            case 'staff':
              navigate('/staff/dashboard');
              break;
            case 'student':
              navigate('/student/dashboard');
              break;
            default:
              navigate('/dashboard');
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
            <h2>Đăng nhập thành công!</h2>
          </div>
          <div className="success-message">
            <div className="success-icon">✅</div>
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
          <h2>Đăng nhập bằng QR Code</h2>
        </div>

        {loading && (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Đang xác thực mã QR...</p>
          </div>
        )}

        {error && (
          <div className="error-container">
            <div className="error-icon">❌</div>
            <p className="error-message">{error}</p>
            <div className="error-actions">
              <button onClick={handleRetry} className="btn btn-primary">
                Thử lại
              </button>
              <button onClick={handleGoToLogin} className="btn btn-secondary">
                Đăng nhập thường
              </button>
            </div>
          </div>
        )}

        {!loading && !error && (
          <div className="info-container">
            <div className="info-icon">📱</div>
            <p>Vui lòng đợi trong giây lát...</p>
          </div>
        )}

        <div className="auth-footer">
          <p>
            <a href="/login">Quay lại trang đăng nhập</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default QRLogin;
