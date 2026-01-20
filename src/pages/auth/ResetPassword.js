import React, { useState, useEffect } from 'react';
import { Form, Button, Container, Row, Col, Alert, InputGroup, ProgressBar } from 'react-bootstrap';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/auth.css';

const ResetPassword = () => {
  usePageTitle('Đặt lại mật khẩu');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [token, setToken] = useState('');
  const [tokenExpired, setTokenExpired] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Thêm state cho việc kiểm tra mật khẩu
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    hasMinLength: false,
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    hasSpecialChar: false
  });
  
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setMounted(true);
    // Add auth-page class to body
    document.body.classList.add('auth-page');
    
    // Get token from URL query parameters
    const params = new URLSearchParams(location.search);
    const tokenFromUrl = params.get('token');
    
    if (!tokenFromUrl) {
      setError('Token không hợp lệ hoặc đã hết hạn');
      setTokenExpired(true);
      return;
    }
    
    setToken(tokenFromUrl);
    
    // Validate token format (basic check)
    if (!tokenFromUrl || tokenFromUrl.split('.').length !== 3) {
      setError('Token không hợp lệ');
      setTokenExpired(true);
    }
    
    return () => {
      setMounted(false);
      // Remove auth-page class from body
      document.body.classList.remove('auth-page');
    };
  }, [location]);
  
  // Thêm hàm kiểm tra độ mạnh mật khẩu
  const checkPasswordStrength = (password) => {
    const result = {
      score: 0,
      hasMinLength: password.length >= 6,
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    };
    
    // Tính điểm
    if (result.hasMinLength) result.score += 1;
    if (result.hasUpperCase) result.score += 1;
    if (result.hasLowerCase) result.score += 1;
    if (result.hasNumber) result.score += 1;
    if (result.hasSpecialChar) result.score += 1;
    
    return result;
  };
  
  // Lấy màu cho thanh tiến trình mật khẩu
  const getPasswordStrengthColor = (score) => {
    if (score <= 1) return 'danger';
    if (score <= 2) return 'warning';
    if (score <= 3) return 'info';
    return 'success';
  };
  
  // Lấy label cho độ mạnh mật khẩu
  const getPasswordStrengthLabel = (score) => {
    if (score <= 1) return 'Yếu';
    if (score <= 2) return 'Trung bình';
    if (score <= 3) return 'Khá';
    if (score === 4) return 'Mạnh';
    return 'Rất mạnh';
  };
  
  const handlePasswordChange = (e) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    setPasswordStrength(checkPasswordStrength(newPassword));
  };
  
  const isFormValid = () => {
    // Kiểm tra các trường cơ bản
    const basicFieldsValid = password && confirmPassword;
    
    // Kiểm tra mật khẩu khớp
    const passwordsMatch = password === confirmPassword;
    
    // Kiểm tra độ mạnh mật khẩu
    const passwordStrengthValid = passwordStrength.score >= 3;
    
    return basicFieldsValid && passwordsMatch && passwordStrengthValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    // Validate passwords
    if (!password) {
      setError('Vui lòng nhập mật khẩu mới');
      return;
    }
    
    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }
    
    // Kiểm tra độ mạnh mật khẩu
    if (passwordStrength.score < 3) {
      setError('Mật khẩu không đủ mạnh. Vui lòng tạo mật khẩu mạnh hơn.');
      return;
    }

    try {
      setLoading(true);
      const response = await resetPassword(token, password);
      setSuccess(response.message || 'Đặt lại mật khẩu thành công');
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error) {
      console.error('Reset password error:', error);
      setError(error.response?.data?.message || 'Không thể đặt lại mật khẩu. Token có thể đã hết hạn.');
      setTokenExpired(true);
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
              <div className="auth-logo">
                <h2>PCTU IMS</h2>
                <div className="university-badge">
                  <i className="fas fa-graduation-cap medical-icon"></i>
                  Trường Đại học Phan Châu Trinh
                </div>
              </div>
              
              <h4 className="auth-heading">
                <i className="fas fa-lock medical-icon"></i>
                Đặt lại mật khẩu
              </h4>
              
              {error && <Alert variant="danger">{error}</Alert>}
              {success && <Alert variant="success">{success}</Alert>}
              
              {!tokenExpired ? (
                <Form onSubmit={handleSubmit}>
                  <div className="step-icon">
                    <i className="fas fa-lock"></i>
                  </div>
                  <p className="step-description text-center mb-4">
                    Vui lòng nhập mật khẩu mới cho tài khoản của bạn.
                  </p>
                  
                  <Form.Group className="mb-3" controlId="formPassword">
                    <Form.Label>
                      <i className="fas fa-lock medical-icon"></i>
                      Mật khẩu mới
                    </Form.Label>
                    <InputGroup>
                      <InputGroup.Text>
                        <i className="fas fa-lock"></i>
                      </InputGroup.Text>
                      <Form.Control 
                        type={showPassword ? "text" : "password"} 
                        placeholder="Nhập mật khẩu mới" 
                        value={password}
                        onChange={handlePasswordChange}
                        required
                        minLength="6"
                      />
                      <Button 
                        variant="outline-secondary"
                        onClick={toggleShowPassword}
                      >
                        <i className={showPassword ? "fas fa-eye-slash" : "fas fa-eye"}></i>
                      </Button>
                    </InputGroup>
                    
                    <div className="password-strength-bar mt-2">
                      <ProgressBar 
                        now={passwordStrength.score * 20} 
                        variant={getPasswordStrengthColor(passwordStrength.score)} 
                        label={getPasswordStrengthLabel(passwordStrength.score)}
                      />
                    </div>
                    
                    <div className="password-requirements mt-2">
                      <small className={`d-block ${passwordStrength.hasMinLength ? 'text-success' : 'text-muted'}`}>
                        <i className={`fas ${passwordStrength.hasMinLength ? 'fa-check-circle' : 'fa-circle'} me-1`}></i>
                        Ít nhất 6 ký tự
                      </small>
                      <small className={`d-block ${passwordStrength.hasUpperCase ? 'text-success' : 'text-muted'}`}>
                        <i className={`fas ${passwordStrength.hasUpperCase ? 'fa-check-circle' : 'fa-circle'} me-1`}></i>
                        Ít nhất 1 chữ cái viết hoa (A-Z)
                      </small>
                      <small className={`d-block ${passwordStrength.hasLowerCase ? 'text-success' : 'text-muted'}`}>
                        <i className={`fas ${passwordStrength.hasLowerCase ? 'fa-check-circle' : 'fa-circle'} me-1`}></i>
                        Ít nhất 1 chữ cái viết thường (a-z)
                      </small>
                      <small className={`d-block ${passwordStrength.hasNumber ? 'text-success' : 'text-muted'}`}>
                        <i className={`fas ${passwordStrength.hasNumber ? 'fa-check-circle' : 'fa-circle'} me-1`}></i>
                        Ít nhất 1 chữ số (0-9)
                      </small>
                      <small className={`d-block ${passwordStrength.hasSpecialChar ? 'text-success' : 'text-muted'}`}>
                        <i className={`fas ${passwordStrength.hasSpecialChar ? 'fa-check-circle' : 'fa-circle'} me-1`}></i>
                        Ít nhất 1 ký tự đặc biệt (!@#$%^&*...)
                      </small>
                    </div>
                  </Form.Group>
                  
                  <Form.Group className="mb-3" controlId="formConfirmPassword">
                    <Form.Label>
                      <i className="fas fa-lock medical-icon"></i>
                      Xác nhận mật khẩu
                    </Form.Label>
                    <InputGroup>
                      <InputGroup.Text>
                        <i className="fas fa-lock"></i>
                      </InputGroup.Text>
                      <Form.Control 
                        type={showConfirmPassword ? "text" : "password"} 
                        placeholder="Nhập lại mật khẩu mới" 
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength="6"
                      />
                      <Button 
                        variant="outline-secondary"
                        onClick={toggleShowConfirmPassword}
                      >
                        <i className={showConfirmPassword ? "fas fa-eye-slash" : "fas fa-eye"}></i>
                      </Button>
                    </InputGroup>
                    {confirmPassword && (
                      <small className={`mt-1 d-block ${password === confirmPassword ? 'text-success' : 'text-danger'}`}>
                        <i className={`fas ${password === confirmPassword ? 'fa-check-circle' : 'fa-times-circle'} me-1`}></i>
                        {password === confirmPassword ? 'Mật khẩu khớp' : 'Mật khẩu không khớp'}
                      </small>
                    )}
                  </Form.Group>

                  <Button 
                    variant="primary" 
                    type="submit" 
                    className="w-100 mt-4" 
                    disabled={loading || success || !isFormValid()}
                    style={{
                      borderRadius: '25px',
                      padding: '14px 32px',
                      fontWeight: '500',
                      fontSize: '16px',
                      letterSpacing: '-0.01em',
                      border: 'none',
                      background: (loading || success || !isFormValid()) ? '#314691' : '#314691',
                      color: (loading || success || !isFormValid()) ? '#8E8E93' : '#ffffff',
                      boxShadow: (loading || success || !isFormValid()) ? 'none' : '0 2px 8px rgba(0, 122, 255, 0.2)',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      cursor: (loading || success || !isFormValid()) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Đang xử lý...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-check-double me-2"></i>
                        Đặt lại mật khẩu
                      </>
                    )}
                  </Button>
                </Form>
              ) : (
                <div className="text-center">
                  <div className="step-icon mb-3">
                    <i className="fas fa-exclamation-triangle"></i>
                  </div>
                  <p className="mb-4" style={{color: '#dc2626', fontWeight: '600'}}>
                    Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.
                  </p>
                  <p className="mb-4" style={{color: '#64748b'}}>
                    Vui lòng yêu cầu đặt lại mật khẩu mới.
                  </p>
                  <Button 
                    as={Link} 
                    to="/forgot-password" 
                    variant="primary"
                    className="w-100"
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
                      textDecoration: 'none',
                      display: 'block'
                    }}
                  >
                    <i className="fas fa-arrow-repeat me-2"></i>
                    Yêu cầu đặt lại mật khẩu
                  </Button>
                </div>
              )}
              
              <div className="auth-footer mt-4">
                <Link to="/login">
                  <i className="fas fa-arrow-left me-1"></i>
                  Quay lại đăng nhập
                </Link>
              </div>
            </div>
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default ResetPassword;