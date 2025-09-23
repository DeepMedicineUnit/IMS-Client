import React, { useState, useEffect } from 'react';
import { Form, Button, Container, Row, Col, Alert, ProgressBar } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import '../../styles/auth.css';

const Register = () => {
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
    return () => setMounted(false);
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
                <h2>PCTU Clinical</h2>
              </div>
              
              <h4 className="auth-heading">Đăng ký tài khoản</h4>
              
              {error && <Alert variant="danger">{error}</Alert>}
              {success && <Alert variant="success">{success}</Alert>}
              
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3" controlId="formUsername">
                  <Form.Label>Tên đăng nhập</Form.Label>
                  <div className="input-group">
                    <span className="input-group-text">
                      <i className="fas fa-user"></i>
                    </span>
                    <Form.Control
                      type="text"
                      name="username"
                      value={formData.username}
                      onChange={handleChange}
                      required
                      placeholder="Nhập tên đăng nhập"
                    />
                  </div>
                </Form.Group>
                
                <Form.Group className="mb-3" controlId="formEmail">
                  <Form.Label>Email</Form.Label>
                  <div className="input-group">
                    <span className="input-group-text">
                      <i className="fas fa-envelope"></i>
                    </span>
                    <Form.Control
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      placeholder="Nhập email"
                    />
                  </div>
                </Form.Group>
                
                <Form.Group className="mb-3" controlId="formFullName">
                  <Form.Label>Họ và tên</Form.Label>
                  <div className="input-group">
                    <span className="input-group-text">
                      <i className="fas fa-id-card"></i>
                    </span>
                    <Form.Control
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      required
                      placeholder="Nhập họ và tên"
                    />
                  </div>
                </Form.Group>
                
                <Form.Group className="mb-3" controlId="formPassword">
                  <Form.Label>Mật khẩu</Form.Label>
                  <div className="input-group">
                    <span className="input-group-text">
                      <i className="fas fa-lock"></i>
                    </span>
                    <Form.Control
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      placeholder="Nhập mật khẩu"
                      minLength="6"
                    />
                    <Button 
                      variant="outline-secondary"
                      onClick={toggleShowPassword}
                    >
                      <i className={showPassword ? "fas fa-eye-slash" : "fas fa-eye"}></i>
                    </Button>
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
                  <Form.Label>Xác nhận mật khẩu</Form.Label>
                  <div className="input-group">
                    <span className="input-group-text">
                      <i className="fas fa-lock"></i>
                    </span>
                    <Form.Control
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      required
                      placeholder="Nhập lại mật khẩu"
                      minLength="6"
                    />
                    <Button 
                      variant="outline-secondary"
                      onClick={toggleShowConfirmPassword}
                    >
                      <i className={showConfirmPassword ? "fas fa-eye-slash" : "fas fa-eye"}></i>
                    </Button>
                  </div>
                  {formData.confirmPassword && (
                    <small className={`mt-1 d-block ${formData.password === formData.confirmPassword ? 'text-success' : 'text-danger'}`}>
                      <i className={`fas ${formData.password === formData.confirmPassword ? 'fa-check-circle' : 'fa-times-circle'} me-1`}></i>
                      {formData.password === formData.confirmPassword ? 'Mật khẩu khớp' : 'Mật khẩu không khớp'}
                    </small>
                  )}
                </Form.Group>
                
                <Form.Group className="mb-3" controlId="formRole">
                  <Form.Label>Vai trò</Form.Label>
                  <div className="input-group">
                    <span className="input-group-text">
                      <i className="fas fa-id-badge"></i>
                    </span>
                    <Form.Select
                      name="role"
                      value={formData.role}
                      onChange={handleChange}
                    >
                      <option value="staff">Nhân viên</option>
                      <option value="admin">Quản trị viên</option>
                    </Form.Select>
                  </div>
                  <Form.Text className="text-muted">
                    Tài khoản cần được quản trị viên phê duyệt trước khi sử dụng.
                  </Form.Text>
                </Form.Group>
                
                <Button 
                  variant="primary" 
                  type="submit" 
                  className="w-100 mt-3" 
                  disabled={loading || success || !isFormValid()}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Đang xử lý...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-user-plus me-2"></i>
                      Đăng ký
                    </>
                  )}
                </Button>
              </Form>
              
              <div className="auth-footer mt-4">
                <div className="text-center">
                  Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
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