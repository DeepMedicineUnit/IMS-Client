import React, { useState, useEffect } from 'react';
import { Form, Button, Container, Row, Col, Alert } from 'react-bootstrap';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/auth.css';

const ForgotPassword = () => {
  usePageTitle('Quên mật khẩu');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [focusedField, setFocusedField] = useState(null);
  const navigate = useNavigate();
  
  const { forgotPassword } = useAuth();

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

  useEffect(() => {
    let interval;
    if (resendCooldown > 0) {
      interval = setInterval(() => {
        setResendCooldown(current => current - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const handleRequestReset = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await forgotPassword(email);
      
      setSuccess('Liên kết đặt lại mật khẩu đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư (bao gồm thư mục spam) và nhấp vào liên kết để đặt lại mật khẩu.');
      setResendCooldown(60); // Bắt đầu đếm ngược 60 giây
    } catch (err) {
      if (err.response?.status === 404) {
        setError('Email không tồn tại trong hệ thống. Vui lòng kiểm tra lại.');
      } else {
        setError(
          err.response?.data?.message || 
          'Không thể gửi yêu cầu đặt lại mật khẩu. Vui lòng thử lại sau.'
        );
      }
      console.error('Password reset request error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const resendResetLink = async () => {
    try {
      setLoading(true);
      setError(null);
      
      await forgotPassword(email);
      
      setSuccess('Liên kết đặt lại mật khẩu mới đã được gửi đến email của bạn.');
      setResendCooldown(60); // Bắt đầu đếm ngược 60 giây
    } catch (err) {
      setError(
        err.response?.data?.message || 
        'Không thể gửi lại liên kết đặt lại mật khẩu. Vui lòng thử lại sau.'
      );
      console.error('Resend reset link error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container>
      <Row className="justify-content-center">
        <Col md={6}>
          <div className={`auth-form-container ${mounted ? 'fade-in' : ''}`}>
            <div className="auth-form">
              <div className="auth-logo">
                <h2>PCTU IMS</h2>
                <div className="university-badge">
                  <i className="fas fa-graduation-cap medical-icon"></i>
                  Trường Đại học Phan Châu Trinh
                </div>
              </div>
              
              <h4 className="auth-heading">
                <i className="fas fa-key medical-icon"></i>
                Quên mật khẩu
              </h4>
              <p className="text-center mb-4" style={{color: '#64748b', fontWeight: '500'}}>
                <i className="fas fa-envelope me-2"></i>
                Nhập email để nhận liên kết đặt lại mật khẩu
              </p>
              
              {error && <Alert variant="danger">{error}</Alert>}
              {success && <Alert variant="success">{success}</Alert>}
              
              <Form onSubmit={handleRequestReset}>
                <div className="step-icon">
                  <i className="fas fa-envelope"></i>
                </div>
                <p className="step-description">
                  Vui lòng nhập địa chỉ email bạn đã dùng để đăng ký tài khoản. 
                  Chúng tôi sẽ gửi liên kết đặt lại mật khẩu qua email này.
                </p>
                
                <Form.Group className="mb-4" controlId="formEmail">
                  <div className="floating-label-group" style={{ position: 'relative', marginBottom: '8px' }}>
                    <Form.Control
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      required
                      className="floating-input"
                      style={{
                        paddingTop: email || focusedField === 'email' ? '24px' : '16px',
                        paddingBottom: email || focusedField === 'email' ? '8px' : '16px',
                        paddingLeft: '16px',
                        paddingRight: '16px',
                        fontSize: '16px',
                        height: 'auto',
                        minHeight: '56px',
                        border: email || focusedField === 'email' ? '2px solid #6c757d' : '1.5px solid #dee2e6',
                        borderRadius: '10px',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        backgroundColor: focusedField === 'email' ? '#f8f9fa' : '#fff',
                        boxShadow: focusedField === 'email' ? '0 0 0 3px rgba(108, 117, 125, 0.1)' : 'none'
                      }}
                    />
                    <label
                      className="floating-label"
                      htmlFor="formEmail"
                      style={{
                        position: 'absolute',
                        left: '16px',
                        top: email || focusedField === 'email' ? '6px' : '50%',
                        transform: email || focusedField === 'email' ? 'translateY(0) scale(0.85)' : 'translateY(-50%) scale(1)',
                        fontSize: email || focusedField === 'email' ? '12px' : '16px',
                        color: email || focusedField === 'email' ? '#495057' : '#6c757d',
                        pointerEvents: 'none',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        paddingLeft: email || focusedField === 'email' ? '4px' : '0',
                        paddingRight: email || focusedField === 'email' ? '4px' : '0',
                        fontWeight: email || focusedField === 'email' ? '600' : '400',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        lineHeight: '1',
                        whiteSpace: 'nowrap',
                        transformOrigin: 'left center'
                      }}
                    >
                      <i className="fas fa-envelope" style={{ fontSize: email || focusedField === 'email' ? '12px' : '14px', transition: 'font-size 0.3s ease' }}></i>
                      <span>Email</span>
                    </label>
                  </div>
                </Form.Group>
                
                <Button 
                  variant="primary" 
                  type={success && resendCooldown === 0 ? "button" : "submit"}
                  className="w-100 mt-4" 
                  disabled={loading || (success && resendCooldown > 0)}
                  onClick={success && resendCooldown === 0 ? resendResetLink : undefined}
                  style={{
                    borderRadius: '25px',
                    padding: '14px 32px',
                    fontWeight: '500',
                    fontSize: '16px',
                    letterSpacing: '-0.01em',
                    border: success && resendCooldown > 0 ? '1.5px solid #E5E5EA' : 'none',
                    background: success && resendCooldown > 0 ? 'transparent' : (loading ? '#314691' : '#314691'),
                    color: success && resendCooldown > 0 ? '#8E8E93' : (loading ? '#8E8E93' : '#ffffff'),
                    boxShadow: (loading || (success && resendCooldown > 0)) ? 'none' : '0 2px 8px rgba(0, 122, 255, 0.2)',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    cursor: (loading || (success && resendCooldown > 0)) ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Đang xử lý...
                    </>
                  ) : success && resendCooldown > 0 ? (
                    <>
                      <i className="fas fa-clock me-2"></i>
                      {`Gửi lại sau (${resendCooldown}s)`}
                    </>
                  ) : success && resendCooldown === 0 ? (
                    <>
                      <i className="fas fa-redo me-2"></i>
                      Gửi lại liên kết
                    </>
                  ) : (
                    <>
                      <i className="fas fa-paper-plane me-2"></i>
                      Gửi liên kết đặt lại mật khẩu
                    </>
                  )}
                </Button>
                
                <div className="auth-footer mt-4">
                  <Link to="/login">
                    <i className="fas fa-arrow-left me-1"></i> 
                    Quay lại đăng nhập
                  </Link>
                </div>
              </Form>
              
              {success && (
                <div className="text-center mt-3">
                  <div className="medical-badge">
                    <i className="fas fa-shield-alt me-1"></i>
                    Email đã được gửi an toàn
                  </div>
                </div>
              )}
            </div>
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default ForgotPassword;