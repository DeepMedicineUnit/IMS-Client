import React, { useState, useEffect } from 'react';
import { Form, Button, Container, Row, Col, Alert, ProgressBar } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/auth.css';

const Register = () => {
  usePageTitle('Đăng ký');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    fullName: '',
    password: '',
    confirmPassword: '',
    role: 'staff' // Default role is staff
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  
  // Thêm state cho việc kiểm tra mật khẩu
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    hasMinLength: false,
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    hasSpecialChar: false
  });
  
  const { register } = useAuth();
  const navigate = useNavigate();

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

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Nếu là password thì kiểm tra độ mạnh
    if (name === 'password') {
      setPasswordStrength(checkPasswordStrength(value));
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

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

  const isFormValid = () => {
    // Kiểm tra các trường cơ bản
    const basicFieldsValid = formData.username && formData.email && formData.fullName && formData.password && formData.confirmPassword;
    
    // Kiểm tra mật khẩu khớp
    const passwordsMatch = formData.password === formData.confirmPassword;
    
    // Kiểm tra độ mạnh mật khẩu
    const passwordStrengthValid = passwordStrength.score >= 3;
    
    return basicFieldsValid && passwordsMatch && passwordStrengthValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    // Validate form
    if (!formData.username || !formData.email || !formData.fullName || !formData.password || !formData.confirmPassword) {
      setError('Vui lòng nhập đầy đủ thông tin');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
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
      const response = await register({
        username: formData.username,
        email: formData.email,
        fullName: formData.fullName,
        password: formData.password,
        role: formData.role
      });
      
      setSuccess(response.message || 'Đăng ký thành công! Vui lòng chờ quản trị viên phê duyệt tài khoản.');
      
      // If account is automatically approved (like superadmin), redirect to login
      if (response.approved) {
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Đăng ký thất bại');
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
                <i className="fas fa-user-plus medical-icon"></i>
                Đăng ký tài khoản
              </h4>
              
              {error && <Alert variant="danger">{error}</Alert>}
              {success && <Alert variant="success">{success}</Alert>}
              
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-4" controlId="formUsername">
                  <div className="floating-label-group" style={{ position: 'relative', marginBottom: '8px' }}>
                    <Form.Control
                      type="text"
                      name="username"
                      value={formData.username}
                      onChange={handleChange}
                      onFocus={() => setFocusedField('username')}
                      onBlur={() => setFocusedField(null)}
                      required
                      className="floating-input"
                      style={{
                        paddingTop: formData.username || focusedField === 'username' ? '24px' : '16px',
                        paddingBottom: formData.username || focusedField === 'username' ? '8px' : '16px',
                        paddingLeft: '16px',
                        paddingRight: '16px',
                        fontSize: '16px',
                        height: 'auto',
                        minHeight: '56px',
                        border: formData.username || focusedField === 'username' ? '2px solid #6c757d' : '1.5px solid #dee2e6',
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
                        top: formData.username || focusedField === 'username' ? '6px' : '50%',
                        transform: formData.username || focusedField === 'username' ? 'translateY(0) scale(0.85)' : 'translateY(-50%) scale(1)',
                        fontSize: formData.username || focusedField === 'username' ? '12px' : '16px',
                        color: formData.username || focusedField === 'username' ? '#495057' : '#6c757d',
                        pointerEvents: 'none',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        paddingLeft: formData.username || focusedField === 'username' ? '4px' : '0',
                        paddingRight: formData.username || focusedField === 'username' ? '4px' : '0',
                        fontWeight: formData.username || focusedField === 'username' ? '600' : '400',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        lineHeight: '1',
                        whiteSpace: 'nowrap',
                        transformOrigin: 'left center'
                      }}
                    >
                      <i className="fas fa-user" style={{ fontSize: formData.username || focusedField === 'username' ? '12px' : '14px', transition: 'font-size 0.3s ease' }}></i>
                      <span>Tên đăng nhập</span>
                    </label>
                  </div>
                </Form.Group>
                
                <Form.Group className="mb-4" controlId="formEmail">
                  <div className="floating-label-group" style={{ position: 'relative', marginBottom: '8px' }}>
                    <Form.Control
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      required
                      className="floating-input"
                      style={{
                        paddingTop: formData.email || focusedField === 'email' ? '24px' : '16px',
                        paddingBottom: formData.email || focusedField === 'email' ? '8px' : '16px',
                        paddingLeft: '16px',
                        paddingRight: '16px',
                        fontSize: '16px',
                        height: 'auto',
                        minHeight: '56px',
                        border: formData.email || focusedField === 'email' ? '2px solid #6c757d' : '1.5px solid #dee2e6',
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
                        top: formData.email || focusedField === 'email' ? '6px' : '50%',
                        transform: formData.email || focusedField === 'email' ? 'translateY(0) scale(0.85)' : 'translateY(-50%) scale(1)',
                        fontSize: formData.email || focusedField === 'email' ? '12px' : '16px',
                        color: formData.email || focusedField === 'email' ? '#495057' : '#6c757d',
                        pointerEvents: 'none',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        paddingLeft: formData.email || focusedField === 'email' ? '4px' : '0',
                        paddingRight: formData.email || focusedField === 'email' ? '4px' : '0',
                        fontWeight: formData.email || focusedField === 'email' ? '600' : '400',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        lineHeight: '1',
                        whiteSpace: 'nowrap',
                        transformOrigin: 'left center'
                      }}
                    >
                      <i className="fas fa-envelope" style={{ fontSize: formData.email || focusedField === 'email' ? '12px' : '14px', transition: 'font-size 0.3s ease' }}></i>
                      <span>Email</span>
                    </label>
                  </div>
                </Form.Group>
                
                <Form.Group className="mb-4" controlId="formFullName">
                  <div className="floating-label-group" style={{ position: 'relative', marginBottom: '8px' }}>
                    <Form.Control
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      onFocus={() => setFocusedField('fullName')}
                      onBlur={() => setFocusedField(null)}
                      required
                      className="floating-input"
                      style={{
                        paddingTop: formData.fullName || focusedField === 'fullName' ? '24px' : '16px',
                        paddingBottom: formData.fullName || focusedField === 'fullName' ? '8px' : '16px',
                        paddingLeft: '16px',
                        paddingRight: '16px',
                        fontSize: '16px',
                        height: 'auto',
                        minHeight: '56px',
                        border: formData.fullName || focusedField === 'fullName' ? '2px solid #6c757d' : '1.5px solid #dee2e6',
                        borderRadius: '10px',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        backgroundColor: focusedField === 'fullName' ? '#f8f9fa' : '#fff',
                        boxShadow: focusedField === 'fullName' ? '0 0 0 3px rgba(108, 117, 125, 0.1)' : 'none'
                      }}
                    />
                    <label
                      className="floating-label"
                      htmlFor="formFullName"
                      style={{
                        position: 'absolute',
                        left: '16px',
                        top: formData.fullName || focusedField === 'fullName' ? '6px' : '50%',
                        transform: formData.fullName || focusedField === 'fullName' ? 'translateY(0) scale(0.85)' : 'translateY(-50%) scale(1)',
                        fontSize: formData.fullName || focusedField === 'fullName' ? '12px' : '16px',
                        color: formData.fullName || focusedField === 'fullName' ? '#495057' : '#6c757d',
                        pointerEvents: 'none',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        paddingLeft: formData.fullName || focusedField === 'fullName' ? '4px' : '0',
                        paddingRight: formData.fullName || focusedField === 'fullName' ? '4px' : '0',
                        fontWeight: formData.fullName || focusedField === 'fullName' ? '600' : '400',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        lineHeight: '1',
                        whiteSpace: 'nowrap',
                        transformOrigin: 'left center'
                      }}
                    >
                      <i className="fas fa-id-card" style={{ fontSize: formData.fullName || focusedField === 'fullName' ? '12px' : '14px', transition: 'font-size 0.3s ease' }}></i>
                      <span>Họ và tên</span>
                    </label>
                  </div>
                </Form.Group>
                
                <Form.Group className="mb-3" controlId="formPassword">
                  <div className="floating-label-group" style={{ position: 'relative', marginBottom: '8px' }}>
                    <Form.Control
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      required
                      className="floating-input"
                      minLength="6"
                      style={{
                        paddingTop: formData.password || focusedField === 'password' ? '24px' : '16px',
                        paddingBottom: formData.password || focusedField === 'password' ? '8px' : '16px',
                        paddingLeft: '16px',
                        paddingRight: '48px',
                        fontSize: '16px',
                        height: 'auto',
                        minHeight: '56px',
                        border: formData.password || focusedField === 'password' ? '2px solid #6c757d' : '1.5px solid #dee2e6',
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
                        top: formData.password || focusedField === 'password' ? '6px' : '50%',
                        transform: formData.password || focusedField === 'password' ? 'translateY(0) scale(0.85)' : 'translateY(-50%) scale(1)',
                        fontSize: formData.password || focusedField === 'password' ? '12px' : '16px',
                        color: formData.password || focusedField === 'password' ? '#495057' : '#6c757d',
                        pointerEvents: 'none',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        paddingLeft: formData.password || focusedField === 'password' ? '4px' : '0',
                        paddingRight: formData.password || focusedField === 'password' ? '4px' : '0',
                        fontWeight: formData.password || focusedField === 'password' ? '600' : '400',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        lineHeight: '1',
                        whiteSpace: 'nowrap',
                        transformOrigin: 'left center'
                      }}
                    >
                      <i className="fas fa-lock" style={{ fontSize: formData.password || focusedField === 'password' ? '12px' : '14px', transition: 'font-size 0.3s ease' }}></i>
                      <span>Mật khẩu</span>
                    </label>
                    <button
                      type="button"
                      onClick={toggleShowPassword}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        padding: '8px',
                        cursor: 'pointer',
                        color: formData.password || focusedField === 'password' ? '#495057' : '#6c757d',
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
                        e.currentTarget.style.color = formData.password || focusedField === 'password' ? '#495057' : '#6c757d';
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <i className={showPassword ? "fas fa-eye-slash" : "fas fa-eye"} style={{ fontSize: '18px' }}></i>
                    </button>
                  </div>
                  
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
                  <div className="floating-label-group" style={{ position: 'relative', marginBottom: '8px' }}>
                    <Form.Control
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      onFocus={() => setFocusedField('confirmPassword')}
                      onBlur={() => setFocusedField(null)}
                      required
                      className="floating-input"
                      minLength="6"
                      style={{
                        paddingTop: formData.confirmPassword || focusedField === 'confirmPassword' ? '24px' : '16px',
                        paddingBottom: formData.confirmPassword || focusedField === 'confirmPassword' ? '8px' : '16px',
                        paddingLeft: '16px',
                        paddingRight: '48px',
                        fontSize: '16px',
                        height: 'auto',
                        minHeight: '56px',
                        border: formData.confirmPassword || focusedField === 'confirmPassword' ? '2px solid #6c757d' : '1.5px solid #dee2e6',
                        borderRadius: '10px',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        backgroundColor: focusedField === 'confirmPassword' ? '#f8f9fa' : '#fff',
                        boxShadow: focusedField === 'confirmPassword' ? '0 0 0 3px rgba(108, 117, 125, 0.1)' : 'none'
                      }}
                    />
                    <label
                      className="floating-label"
                      htmlFor="formConfirmPassword"
                      style={{
                        position: 'absolute',
                        left: '16px',
                        top: formData.confirmPassword || focusedField === 'confirmPassword' ? '6px' : '50%',
                        transform: formData.confirmPassword || focusedField === 'confirmPassword' ? 'translateY(0) scale(0.85)' : 'translateY(-50%) scale(1)',
                        fontSize: formData.confirmPassword || focusedField === 'confirmPassword' ? '12px' : '16px',
                        color: formData.confirmPassword || focusedField === 'confirmPassword' ? '#495057' : '#6c757d',
                        pointerEvents: 'none',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        paddingLeft: formData.confirmPassword || focusedField === 'confirmPassword' ? '4px' : '0',
                        paddingRight: formData.confirmPassword || focusedField === 'confirmPassword' ? '4px' : '0',
                        fontWeight: formData.confirmPassword || focusedField === 'confirmPassword' ? '600' : '400',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        lineHeight: '1',
                        whiteSpace: 'nowrap',
                        transformOrigin: 'left center'
                      }}
                    >
                      <i className="fas fa-lock" style={{ fontSize: formData.confirmPassword || focusedField === 'confirmPassword' ? '12px' : '14px', transition: 'font-size 0.3s ease' }}></i>
                      <span>Xác nhận mật khẩu</span>
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
                        color: formData.confirmPassword || focusedField === 'confirmPassword' ? '#495057' : '#6c757d',
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
                        e.currentTarget.style.color = formData.confirmPassword || focusedField === 'confirmPassword' ? '#495057' : '#6c757d';
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <i className={showConfirmPassword ? "fas fa-eye-slash" : "fas fa-eye"} style={{ fontSize: '18px' }}></i>
                    </button>
                  </div>
                  {formData.confirmPassword && (
                    <small className={`mt-2 d-block ${formData.password === formData.confirmPassword ? 'text-success' : 'text-danger'}`} style={{ paddingLeft: '4px' }}>
                      <i className={`fas ${formData.password === formData.confirmPassword ? 'fa-check-circle' : 'fa-times-circle'} me-1`}></i>
                      {formData.password === formData.confirmPassword ? 'Mật khẩu khớp' : 'Mật khẩu không khớp'}
                    </small>
                  )}
                </Form.Group>
                
                <Form.Group className="mb-4" controlId="formRole">
                  <div className="floating-label-group" style={{ position: 'relative', marginBottom: '8px' }}>
                    <Form.Select
                      name="role"
                      value={formData.role}
                      onChange={handleChange}
                      onFocus={() => setFocusedField('role')}
                      onBlur={() => setFocusedField(null)}
                      className="floating-input"
                      style={{
                        paddingTop: formData.role || focusedField === 'role' ? '24px' : '16px',
                        paddingBottom: formData.role || focusedField === 'role' ? '8px' : '16px',
                        paddingLeft: '16px',
                        paddingRight: '40px',
                        fontSize: '16px',
                        height: 'auto',
                        minHeight: '56px',
                        border: formData.role || focusedField === 'role' ? '2px solid #6c757d' : '1.5px solid #dee2e6',
                        borderRadius: '10px',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        backgroundColor: focusedField === 'role' ? '#f8f9fa' : '#fff',
                        boxShadow: focusedField === 'role' ? '0 0 0 3px rgba(108, 117, 125, 0.1)' : 'none',
                        cursor: 'pointer',
                        appearance: 'none',
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23495057' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 16px center',
                        backgroundSize: '12px'
                      }}
                    >
                      <option value="staff">Nhân viên</option>
                      <option value="admin">Quản trị viên</option>
                    </Form.Select>
                    <label
                      className="floating-label"
                      htmlFor="formRole"
                      style={{
                        position: 'absolute',
                        left: '16px',
                        top: formData.role || focusedField === 'role' ? '6px' : '50%',
                        transform: formData.role || focusedField === 'role' ? 'translateY(0) scale(0.85)' : 'translateY(-50%) scale(1)',
                        fontSize: formData.role || focusedField === 'role' ? '12px' : '16px',
                        color: formData.role || focusedField === 'role' ? '#495057' : '#6c757d',
                        pointerEvents: 'none',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        paddingLeft: formData.role || focusedField === 'role' ? '4px' : '0',
                        paddingRight: formData.role || focusedField === 'role' ? '4px' : '0',
                        fontWeight: formData.role || focusedField === 'role' ? '600' : '400',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        lineHeight: '1',
                        whiteSpace: 'nowrap',
                        transformOrigin: 'left center'
                      }}
                    >
                      <i className="fas fa-user-tag" style={{ fontSize: formData.role || focusedField === 'role' ? '12px' : '14px', transition: 'font-size 0.3s ease' }}></i>
                      <span>Vai trò</span>
                    </label>
                  </div>
                  <div style={{ 
                    marginTop: '8px', 
                    padding: '12px 16px', 
                    backgroundColor: '#f8f9fa', 
                    borderRadius: '8px',
                    borderLeft: '3px solid #6c757d'
                  }}>
                    <small className="text-muted" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', lineHeight: '1.5', fontSize: '13px' }}>
                      <i className="fas fa-info-circle mt-1" style={{ fontSize: '14px', color: '#6c757d', flexShrink: 0 }}></i>
                      <span>
                        {formData.role === 'staff' && 'Tài khoản cần được quản trị viên phê duyệt trước khi sử dụng.'}
                        {formData.role === 'admin' && 'Tài khoản cần được Super Admin phê duyệt trước khi sử dụng.'}
                      </span>
                    </small>
                  </div>
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
                      <i className="fas fa-user-plus me-2"></i>
                      Đăng ký tài khoản
                    </>
                  )}
                </Button>
              </Form>
              
              <div className="auth-footer mt-4">
                <div className="text-center">
                  <i className="fas fa-sign-in-alt me-1"></i>
                  Đã có tài khoản? <Link to="/login">Đăng nhập ngay</Link>
                </div>
              </div>
            </div>
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default Register;