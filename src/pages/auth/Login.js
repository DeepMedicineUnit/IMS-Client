import React, { useState, useEffect } from 'react';
import { Form, Button, Card, Container, Row, Col, Alert } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { GoogleLogin } from '@react-oauth/google';
import usePageTitle from '../../hooks/usePageTitle';

const Login = () => {
  usePageTitle('Đăng nhập');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  
  const { login, googleLogin, currentUser, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in (but only if we're not in the process of logging out)
  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) {
      return;
    }
    
    // Check if there's a valid token - if not, don't redirect even if currentUser exists temporarily
    const token = localStorage.getItem('token');
    
    // Only redirect if we have both a currentUser AND a valid token
    // This prevents redirect after logout when currentUser might still be set temporarily
    if (currentUser && token) {
      // Verify token is not expired before redirecting
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const exp = payload.exp * 1000;
        if (Date.now() < exp) {
          // Token is valid, redirect to dashboard
          const getDashboardRoute = () => {
            // Only superadmin goes to IMS dashboard
            if (currentUser.role === 'superadmin') {
              return '/ims/dashboard';
            }
            // Students go to student dashboard
            if (currentUser.role === 'student') {
              return '/student/attendance';
            }
            // All other users (admin, staff, clinical_admin, clinical_mod, clinical_staff, etc.) go to personal dashboard
            return '/personal/dashboard';
          };
          navigate(getDashboardRoute(), { replace: true });
        } else {
          // Token is expired, clear it and don't redirect
          localStorage.removeItem('token');
        }
      } catch (e) {
        // Invalid token, clear it and don't redirect
        localStorage.removeItem('token');
      }
    }
  }, [currentUser, authLoading, navigate]);

  // Load saved credentials if remember me was checked
  // Only load if user is not currently logged in (no token)
  useEffect(() => {
    // Don't auto-fill if user just logged out (check if token exists)
    const token = localStorage.getItem('token');
    if (token) {
      // User is logged in, don't auto-fill credentials
      return;
    }
    
    const savedRememberMe = localStorage.getItem('rememberMe') === 'true';
    if (savedRememberMe) {
      const savedUsername = localStorage.getItem('savedUsername');
      const savedPassword = localStorage.getItem('savedPassword');
      
      if (savedUsername) {
        setUsername(savedUsername);
        setRememberMe(true);
      }
      
      if (savedPassword) {
        try {
          // Decode base64 password
          const decodedPassword = atob(savedPassword);
          setPassword(decodedPassword);
        } catch (e) {
          console.error('Error decoding saved password:', e);
        }
      }
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    // Add auth-page class to body
    document.body.classList.add('auth-page');
    
    return () => {
      setMounted(false);
      // Remove auth-page class from body
      document.body.classList.remove('auth-page');
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Validate form
    if (!username || !password) {
      setError('Vui lòng nhập đầy đủ thông tin đăng nhập');
      return;
    }

    try {
      setLoading(true);
      await login(username, password);
      
      // Handle remember me
      if (rememberMe) {
        localStorage.setItem('rememberMe', 'true');
        localStorage.setItem('savedUsername', username);
        // Encode password in base64 (not secure, but obfuscated)
        const encodedPassword = btoa(password);
        localStorage.setItem('savedPassword', encodedPassword);
      } else {
        // Clear saved credentials if remember me is unchecked
        localStorage.removeItem('rememberMe');
        localStorage.removeItem('savedUsername');
        localStorage.removeItem('savedPassword');
      }
      
      // Check if there's a redirect URL stored in localStorage
      const redirectUrl = localStorage.getItem('redirectUrl');
      if (redirectUrl) {
        // Clear the redirect URL from localStorage
        localStorage.removeItem('redirectUrl');
        // Navigate to the stored URL
        navigate(redirectUrl);
      } else {
        // Default redirect based on user role
        navigate('/');
      }
    } catch (error) {
      // Error handling is done in AuthContext
      setError(error.response?.data?.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };
  const toggleShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const toggleShowConfirmPassword = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  return (
    <Container>
      <Row className="justify-content-center">
        <Col md={6}>
          <div className={`auth-form-container ${mounted ? 'fade-in' : ''}`}>
            <div className="auth-form">
              <Card.Body>
              <div className="auth-logo">
                <h2>PCTU IMS</h2>
                <div className="university-badge">
                  <i className="fas fa-graduation-cap medical-icon"></i>
                  Trường Đại học Phan Châu Trinh
                </div>
              </div>
              
              <h4 className="auth-heading">
                <i className="fas fa-sign-in-alt medical-icon"></i>
                Đăng nhập
              </h4>
              
              {error && <Alert variant="danger">{error}</Alert>}
              
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-4" controlId="formUsername">
                  <div className="floating-label-group" style={{ position: 'relative', marginBottom: '8px' }}>
                    <Form.Control 
                      type="text" 
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      onFocus={() => setFocusedField('username')}
                      onBlur={() => setFocusedField(null)}
                      required
                      className="floating-input"
                      style={{
                        paddingTop: username || focusedField === 'username' ? '24px' : '16px',
                        paddingBottom: username || focusedField === 'username' ? '8px' : '16px',
                        paddingLeft: '16px',
                        paddingRight: '16px',
                        fontSize: '16px',
                        height: 'auto',
                        minHeight: '56px',
                        border: username || focusedField === 'username' ? '2px solid #6c757d' : '1.5px solid #dee2e6',
                        borderRadius: '10px',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        backgroundColor: focusedField === 'username' ? '#f8f9fa' : '#fff',
                        boxShadow: focusedField === 'username' ? '0 0 0 3px rgba(108, 117, 125, 0.1)' : 'none'
                      }}
                    />
                    <label
                      className="floating-label"
                      htmlFor="formUsername"
                      style={{
                        position: 'absolute',
                        left: '16px',
                        top: username || focusedField === 'username' ? '6px' : '50%',
                        transform: username || focusedField === 'username' ? 'translateY(0) scale(0.85)' : 'translateY(-50%) scale(1)',
                        fontSize: username || focusedField === 'username' ? '12px' : '16px',
                        color: username || focusedField === 'username' ? '#495057' : '#6c757d',
                        pointerEvents: 'none',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        paddingLeft: username || focusedField === 'username' ? '4px' : '0',
                        paddingRight: username || focusedField === 'username' ? '4px' : '0',
                        fontWeight: username || focusedField === 'username' ? '600' : '400',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        lineHeight: '1',
                        whiteSpace: 'nowrap',
                        transformOrigin: 'left center'
                      }}
                    >
                      <i className="fas fa-user" style={{ fontSize: username || focusedField === 'username' ? '12px' : '14px', transition: 'font-size 0.3s ease' }}></i>
                      <span>Tên đăng nhập</span>
                    </label>
                  </div>
                </Form.Group>

                <Form.Group className="mb-3" controlId="formPassword">
                  <div className="floating-label-group" style={{ position: 'relative', marginBottom: '8px' }}>
                    <Form.Control 
                      type={showConfirmPassword ? "text" : "password"} 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      required
                      className="floating-input"
                      style={{
                        paddingTop: password || focusedField === 'password' ? '24px' : '16px',
                        paddingBottom: password || focusedField === 'password' ? '8px' : '16px',
                        paddingLeft: '16px',
                        paddingRight: '48px',
                        fontSize: '16px',
                        height: 'auto',
                        minHeight: '56px',
                        border: password || focusedField === 'password' ? '2px solid #6c757d' : '1.5px solid #dee2e6',
                        borderRadius: '10px',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        backgroundColor: focusedField === 'password' ? '#f8f9fa' : '#fff',
                        boxShadow: focusedField === 'password' ? '0 0 0 3px rgba(108, 117, 125, 0.1)' : 'none'
                      }}
                    />
                    <label
                      className="floating-label"
                      htmlFor="formPassword"
                      style={{
                        position: 'absolute',
                        left: '16px',
                        top: password || focusedField === 'password' ? '6px' : '50%',
                        transform: password || focusedField === 'password' ? 'translateY(0) scale(0.85)' : 'translateY(-50%) scale(1)',
                        fontSize: password || focusedField === 'password' ? '12px' : '16px',
                        color: password || focusedField === 'password' ? '#495057' : '#6c757d',
                        pointerEvents: 'none',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        paddingLeft: password || focusedField === 'password' ? '4px' : '0',
                        paddingRight: password || focusedField === 'password' ? '4px' : '0',
                        fontWeight: password || focusedField === 'password' ? '600' : '400',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        lineHeight: '1',
                        whiteSpace: 'nowrap',
                        transformOrigin: 'left center'
                      }}
                    >
                      <i className="fas fa-lock" style={{ fontSize: password || focusedField === 'password' ? '12px' : '14px', transition: 'font-size 0.3s ease' }}></i>
                      <span>Mật khẩu</span>
                    </label>
                    <button
                      type="button"
                      onClick={toggleShowConfirmPassword}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        padding: '8px',
                        cursor: 'pointer',
                        color: password || focusedField === 'password' ? '#495057' : '#6c757d',
                        zIndex: 10,
                        outline: 'none',
                        transition: 'all 0.3s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '6px'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#343a40';
                        e.currentTarget.style.backgroundColor = 'rgba(108, 117, 125, 0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = password || focusedField === 'password' ? '#495057' : '#6c757d';
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <i className={showConfirmPassword ? "fas fa-eye-slash" : "fas fa-eye"} style={{ fontSize: '18px' }}></i>
                    </button>
                  </div>
                  <div className="d-flex justify-content-between align-items-center mt-3">
                    <Form.Check
                      type="checkbox"
                      id="rememberMe"
                      label="Ghi nhớ tài khoản"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      style={{ fontSize: '0.9rem', margin: 0 }}
                    />
                    <Link to="/forgot-password" style={{fontSize: '0.9rem', color: '#243571', textDecoration: 'none', fontWeight: '500'}}>
                      Quên mật khẩu?
                    </Link>
                  </div>
                </Form.Group>

                <Button 
                  variant="primary" 
                  type="submit" 
                  className="w-100 mt-6" 
                  disabled={loading}
                  style={{
                    borderRadius: '25px',
                    padding: '14px 32px',
                    fontWeight: '500',
                    fontSize: '16px',
                    letterSpacing: '-0.01em',
                    border: 'none',
                    background: loading ? '#314691' : '#314691',
                    color: loading ? '#8E8E93' : '#ffffff',
                    boxShadow: loading ? 'none' : '0 2px 8px rgba(0, 122, 255, 0.2)',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Đang đăng nhập...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-sign-in-alt me-2"></i>
                      Đăng nhập
                    </>
                  )}
                </Button>
                
              </Form>
              
              <div className="d-flex align-items-center my-4">
                <hr className="flex-grow-1" style={{borderColor: 'rgba(36, 53, 113, 0.2)'}} />
                <span className="mx-3" style={{color: '#64748b', fontWeight: '600'}}>
                  hoặc
                </span>
                <hr className="flex-grow-1" style={{borderColor: 'rgba(36, 53, 113, 0.2)'}} />
              </div>
              
              <div className="d-flex justify-content-center">
                <GoogleLogin
                  onSuccess={async (credentialResponse) => {
                    try {
                      setLoading(true);
                      await googleLogin(credentialResponse);
                      
                      // Check if there's a redirect URL stored in localStorage
                      const redirectUrl = localStorage.getItem('redirectUrl');
                      if (redirectUrl) {
                        // Clear the redirect URL from localStorage
                        localStorage.removeItem('redirectUrl');
                        // Navigate to the stored URL
                        navigate(redirectUrl);
                      } else {
                        // Default redirect based on user role
                        navigate('/');
                      }
                    } catch (error) {
                      setError('Đăng nhập bằng Google thất bại');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  onError={() => {
                    setError('Đăng nhập bằng Google thất bại');
                  }}
                  size="large"
                  width="300"
                  text="signin_with"
                  shape="pill"
                  logo_alignment="center"
                  locale="vi"
                />
              </div>
              
              <div className="auth-footer mt-4">
                <div className="text-center">
                  Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link>
                </div>
              </div>
              </Card.Body>
            </div>
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default Login;
 