import React, { useState, useEffect } from 'react';
import { Form, Button, Container, Row, Col, Alert, InputGroup } from 'react-bootstrap';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import '../../styles/auth.css';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const navigate = useNavigate();
  
  const { forgotPassword } = useAuth();

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
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
                <h2>PCTU Clinical</h2>
              </div>
              
              <h4 className="auth-heading">Quên mật khẩu</h4>
              <p className="text-center mb-3">Nhập email để nhận liên kết đặt lại mật khẩu</p>
              
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
                
                <Form.Group className="mb-3" controlId="formEmail">
                  <Form.Label>Email</Form.Label>
                  <InputGroup>
                    <InputGroup.Text>
                      <i className="fas fa-envelope"></i>
                    </InputGroup.Text>
                    <Form.Control
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="Nhập địa chỉ email"
                    />
                  </InputGroup>
                </Form.Group>
                
                <Button 
                  variant="primary" 
                  type="submit" 
                  className="w-100" 
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Đang xử lý...
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
                    <i className="fas fa-arrow-left me-1"></i> Quay lại đăng nhập
                  </Link>
                </div>
              </Form>
              
              {success && resendCooldown > 0 && (
                <div className="text-center mt-3">
                  <Button 
                    variant="outline-primary" 
                    type="button" 
                    className="w-100 mb-2" 
                    disabled={loading || resendCooldown > 0}
                  >
                    <i className="fas fa-redo me-2"></i>
                    {`Gửi lại sau (${resendCooldown}s)`}
                  </Button>
                </div>
              )}
              
              {success && resendCooldown === 0 && (
                <div className="text-center mt-3">
                  <Button 
                    variant="outline-primary" 
                    type="button" 
                    className="w-100 mb-2" 
                    disabled={loading}
                    onClick={resendResetLink}
                  >
                    <i className="fas fa-redo me-2"></i>
                    Gửi lại liên kết
                  </Button>
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