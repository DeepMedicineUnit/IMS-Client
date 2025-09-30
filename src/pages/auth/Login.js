import React, { useState } from 'react';
import { Form, Button, Card, Container, Row, Col, Alert } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { GoogleLogin } from '@react-oauth/google';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();

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
          <Card className="auth-form">
            <Card.Body>
              <div className="auth-logo">
                <h2>PCTU Clinical</h2>
              </div>
              
              <h4 className="auth-heading">Đăng nhập</h4>
              
              {error && <Alert variant="danger">{error}</Alert>}
              
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3" controlId="formUsername">
                  <Form.Label>Tên đăng nhập</Form.Label>
                  <Form.Control 
                    type="text" 
                    placeholder="Nhập tên đăng nhập" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-3" controlId="formPassword">
                  <Form.Label>Mật khẩu</Form.Label>
                  <div className="input-group">
                  <Form.Control 
                    type={showConfirmPassword ? "text" : "password"} 
                    placeholder="Nhập mật khẩu" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                    <Button 
                      variant="outline-secondary"
                      onClick={toggleShowConfirmPassword}
                    >
                    <i className={showConfirmPassword ? "fas fa-eye-slash" : "fas fa-eye"}></i>
                    </Button>
                </div>
                </Form.Group>

                <Button 
                  variant="primary" 
                  type="submit" 
                  className="w-100 mt-3" 
                  disabled={loading}
                >
                  {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                </Button>
                
                <div className="text-center mt-3">
                  <Link to="/forgot-password">Quên mật khẩu?</Link>
                </div>
              </Form>
              
              <div className="d-flex align-items-center my-4">
                <hr className="flex-grow-1" />
                <span className="mx-3 text-muted">hoặc</span>
                <hr className="flex-grow-1" />
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
                  shape="rectangular"
                  logo_alignment="center"
                  locale="vi"
                />
              </div>
              
              <div className="auth-footer mt-4">
                Chưa có tài khoản? <Link to="/register">Đăng ký</Link>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Login;
 