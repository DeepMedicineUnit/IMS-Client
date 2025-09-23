import React, { useState, useEffect } from 'react';
import { Form, Button, Container, Row, Col, Alert, InputGroup, ProgressBar, Tab, Tabs } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import { User, Mail, Lock, Eye, EyeOff, CheckCircle, AlertTriangle, Save, Bell, FileText, Shield, Upload, RotateCcw, MapPin, Phone, Building, RefreshCcw } from 'lucide-react';
import '../../styles/auth.css';
import '../../styles/modern-ui.css';

const ProfilePage = () => {
  const { currentUser, api } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('account');
  const [profilePicture, setProfilePicture] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  
  // Thêm state cho việc kiểm tra mật khẩu
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    hasMinLength: false,
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    hasSpecialChar: false
  });

  useEffect(() => {
    setMounted(true);
    if (currentUser) {
      setFormData(prev => ({
        ...prev,
        fullName: currentUser.full_name || '',
        email: currentUser.email || ''
      }));
    }
    return () => setMounted(false);
  }, [currentUser]);

  // Function to get user's current location
  const getUserLocation = async () => {
    if (!navigator.geolocation) {
      setError('Trình duyệt không hỗ trợ định vị');
      return;
    }

    setLocationLoading(true);
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        });
      });

      const { latitude, longitude } = position.coords;
      
      // Reverse geocoding to get address
      try {
        const response = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=vi`
        );
        const data = await response.json();
        
        if (data.city && data.principalSubdivision) {
          setUserLocation({
            address: `${data.locality || data.city}, ${data.principalSubdivision}, ${data.countryName}`,
            coordinates: { latitude, longitude }
          });
        } else {
          setUserLocation({
            address: `Vị trí: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
            coordinates: { latitude, longitude }
          });
        }
      } catch (geocodeError) {
        console.error('Reverse geocoding error:', geocodeError);
        setUserLocation({
          address: `Vị trí: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          coordinates: { latitude, longitude }
        });
      }
    } catch (error) {
      console.error('Location error:', error);
      setError('Không thể lấy vị trí hiện tại');
    } finally {
      setLocationLoading(false);
    }
  };

  // Get location on component mount
  useEffect(() => {
    getUserLocation();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Nếu là mật khẩu mới thì kiểm tra độ mạnh
    if (name === 'newPassword') {
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
  
  const isPasswordValid = () => {
    // Kiểm tra các trường cơ bản
    const basicFieldsValid = formData.currentPassword && formData.newPassword && formData.confirmPassword;
    
    // Kiểm tra mật khẩu khớp
    const passwordsMatch = formData.newPassword === formData.confirmPassword;
    
    // Kiểm tra độ mạnh mật khẩu
    const passwordStrengthValid = passwordStrength.score >= 3;
    
    return basicFieldsValid && passwordsMatch && passwordStrengthValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validate form
    if (showPasswordFields) {
      if (!formData.currentPassword) {
        return setError('Vui lòng nhập mật khẩu hiện tại');
      }

      if (formData.newPassword !== formData.confirmPassword) {
        return setError('Mật khẩu mới và xác nhận mật khẩu không khớp');
      }

      if (formData.newPassword && formData.newPassword.length < 6) {
        return setError('Mật khẩu mới phải có ít nhất 6 ký tự');
      }
      
      // Kiểm tra độ mạnh mật khẩu
      if (passwordStrength.score < 3) {
        return setError('Mật khẩu không đủ mạnh. Vui lòng tạo mật khẩu mạnh hơn.');
      }
    }

    try {
      setLoading(true);
      
      const updateData = {
        fullName: formData.fullName,
        email: formData.email
      };

      if (showPasswordFields && formData.newPassword) {
        updateData.currentPassword = formData.currentPassword;
        updateData.newPassword = formData.newPassword;
      }

      const response = await api.put('/profile', updateData);

      if (response.data.success) {
        setSuccess('Cập nhật thông tin thành công!');
        
        // Reset password fields
        if (showPasswordFields) {
          setFormData(prev => ({
            ...prev,
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
          }));
          setPasswordStrength({
            score: 0,
            hasMinLength: false,
            hasUpperCase: false,
            hasLowerCase: false,
            hasNumber: false,
            hasSpecialChar: false
          });
          setShowPasswordFields(false);
        }
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setError(error.response?.data?.message || 'Không thể cập nhật thông tin. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  const toggleShowCurrentPassword = () => {
    setShowCurrentPassword(!showCurrentPassword);
  };

  const toggleShowNewPassword = () => {
    setShowNewPassword(!showNewPassword);
  };

  const toggleShowConfirmPassword = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  const handleProfilePictureUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 800 * 1024) { // 800KB limit
        setError('File size must be less than 800KB');
        return;
      }
      if (!file.type.match(/^image\/(jpeg|jpg|gif|png)$/)) {
        setError('Only JPG, GIF, or PNG files are allowed');
        return;
      }
      setProfilePicture(file);
      setError('');
    }
  };

  const handleProfilePictureReset = () => {
    setProfilePicture(null);
    setError('');
  };

  // Helper function to get display name for roles
  const getRoleDisplayName = (role) => {
    switch (role) {
      case 'superadmin': return 'Super Admin';
      case 'admin': return 'Quản trị viên';
      case 'staff': return 'Nhân viên';
      case 'student': return 'Sinh viên';
      default: return role;
    }
  };

  return (
    <div className="bg-light min-vh-100">
      <Container className="py-4">
        {/* Navigation Tabs */}
        <div className="modern-card mb-4">
          <div className="d-flex border-bottom">
            <button
              className={`nav-tab ${activeTab === 'account' ? 'active' : ''}`}
              onClick={() => setActiveTab('account')}
            >
              <User size={20} />
              <span>Tài khoản</span>
            </button>
            <button
              className={`nav-tab ${activeTab === 'notifications' ? 'active' : ''}`}
              onClick={() => setActiveTab('notifications')}
            >
              <Bell size={20} />
              <span>Thông báo</span>
            </button>
            <button
              className={`nav-tab ${activeTab === 'security' ? 'active' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              <Shield size={20} />
              <span>Bảo mật</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="modern-alert modern-alert-danger mb-4">
            <div className="d-flex align-items-center">
              <AlertTriangle size={20} className="me-2 text-danger" />
              <div>{error}</div>
            </div>
          </div>
        )}
        
        {success && (
          <div className="modern-alert modern-alert-success mb-4">
            <div className="d-flex align-items-center">
              <CheckCircle size={20} className="me-2 text-success" />
              <div>{success}</div>
            </div>
          </div>
        )}

        <Form onSubmit={handleSubmit}>
          <Row className="g-4 mb-4">
            {/* Change Profile Card */}
            <Col md={6}>
              <div className="modern-card h-100">
                <div className="p-4">
                  <h5 className="fw-bold mb-2">Thay đổi ảnh đại diện</h5>
                  <p className="text-muted small mb-4">Thay đổi ảnh đại diện của bạn từ đây</p>
                  
                  <div className="text-center">
                    <div className="profile-picture-container mb-3">
                      {profilePicture ? (
                        <img
                          src={URL.createObjectURL(profilePicture)}
                          alt="Profile"
                          className="profile-picture"
                        />
                      ) : (
                        <div className="profile-picture-placeholder">
                          <User size={48} className="text-muted" />
                        </div>
                      )}
                    </div>
                    
                    <div className="d-flex gap-2 justify-content-center mb-3">
                      <label className="btn-modern" style={{ backgroundColor: '#256176' }}>
                        <Upload size={16} />
                        <span>Tải lên</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/jpg,image/gif,image/png"
                          onChange={handleProfilePictureUpload}
                          style={{ display: 'none' }}
                        />
                      </label>
                      <button
                        type="button"
                        className="btn-modern"
                        onClick={handleProfilePictureReset}
                        style={{ backgroundColor: '#6b7280' }}
                      >
                        <RotateCcw size={16} />
                        <span>Đặt lại</span>
                      </button>
                    </div>
                    
                    <p className="text-muted small mb-0">
                      Cho phép JPG, GIF hoặc PNG. Kích thước tối đa 800KB
                    </p>
                  </div>
                </div>
              </div>
            </Col>

            {/* Change Password Card */}
            <Col md={6}>
              <div className="modern-card h-100">
                <div className="p-4">
                  <h5 className="fw-bold mb-2">Thay đổi mật khẩu</h5>
                  <p className="text-muted small mb-4">Để thay đổi mật khẩu, vui lòng xác nhận tại đây</p>
                  
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <span className="fw-medium">Bật thay đổi mật khẩu</span>
                    <Form.Check
                      type="switch"
                      id="change-password"
                      checked={showPasswordFields}
                      onChange={() => setShowPasswordFields(!showPasswordFields)}
                    />
                  </div>
                  
                  {showPasswordFields && (
                    <div className="space-y-3">
                      <Form.Group>
                        <Form.Label className="fw-medium">Mật khẩu hiện tại</Form.Label>
                        <InputGroup>
                          <InputGroup.Text className="bg-light">
                            <Lock size={16} />
                          </InputGroup.Text>
                          <Form.Control
                            type={showCurrentPassword ? "text" : "password"}
                            name="currentPassword"
                            value={formData.currentPassword}
                            onChange={handleChange}
                            placeholder="Nhập mật khẩu hiện tại"
                            className="modern-form-control"
                          />
                          <button 
                            type="button"
                            className="btn-modern"
                            onClick={toggleShowCurrentPassword}
                            style={{ backgroundColor: '#6b7280', padding: '8px 12px' }}
                          >
                            {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </InputGroup>
                      </Form.Group>
                      
                      <Form.Group>
                        <Form.Label className="fw-medium">Mật khẩu mới</Form.Label>
                        <InputGroup>
                          <InputGroup.Text className="bg-light">
                            <Lock size={16} />
                          </InputGroup.Text>
                          <Form.Control
                            type={showNewPassword ? "text" : "password"}
                            name="newPassword"
                            value={formData.newPassword}
                            onChange={handleChange}
                            placeholder="Nhập mật khẩu mới"
                            minLength="6"
                            className="modern-form-control"
                          />
                          <button 
                            type="button"
                            className="btn-modern"
                            onClick={toggleShowNewPassword}
                            style={{ backgroundColor: '#6b7280', padding: '8px 12px' }}
                          >
                            {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
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
                      
                      <Form.Group>
                        <Form.Label className="fw-medium">Xác nhận mật khẩu mới</Form.Label>
                        <InputGroup>
                          <InputGroup.Text className="bg-light">
                            <Lock size={16} />
                          </InputGroup.Text>
                          <Form.Control
                            type={showConfirmPassword ? "text" : "password"}
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            placeholder="Nhập lại mật khẩu mới"
                            minLength="6"
                            className="modern-form-control"
                          />
                          <button 
                            type="button"
                            className="btn-modern"
                            onClick={toggleShowConfirmPassword}
                            style={{ backgroundColor: '#6b7280', padding: '8px 12px' }}
                          >
                            {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </InputGroup>
                      </Form.Group>
                    </div>
                  )}
                </div>
              </div>
            </Col>
          </Row>

          {/* Personal Details Card */}
          <div className="modern-card mb-4">
            <div className="p-4">
              <h5 className="fw-bold mb-2">Thông tin cá nhân</h5>
              <p className="text-muted small mb-4">Để thay đổi thông tin cá nhân, chỉnh sửa và lưu từ đây</p>
              
              <Row className="g-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="fw-medium">Họ và tên</Form.Label>
                    <InputGroup>
                      <InputGroup.Text className="bg-light">
                        <User size={16} />
                      </InputGroup.Text>
                      <Form.Control
                        type="text"
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleChange}
                        required
                        className="modern-form-control"
                      />
                    </InputGroup>
                  </Form.Group>
                </Col>
                
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="fw-medium">Vị trí hiện tại</Form.Label>
                    <InputGroup>
                      <InputGroup.Text className="bg-light">
                        <MapPin size={16} />
                      </InputGroup.Text>
                      <Form.Control
                        type="text"
                        value={userLocation ? userLocation.address : (locationLoading ? 'Đang lấy vị trí...' : 'Chưa xác định')}
                        disabled
                        className="modern-form-control bg-light"
                      />
                      <button
                        type="button"
                        className="btn-modern"
                        onClick={getUserLocation}
                        disabled={locationLoading}
                        style={{ backgroundColor: '#256176', padding: '8px 12px' }}
                        title="Cập nhật vị trí"
                      >
                        {locationLoading ? (
                          <div className="spinner-border spinner-border-sm" role="status">
                            <span className="visually-hidden">Loading...</span>
                          </div>
                        ) : (
                          <RefreshCcw size={16} />
                        )}
                      </button>
                    </InputGroup>
                  </Form.Group>
                </Col>
                
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="fw-medium">Email</Form.Label>
                    <InputGroup>
                      <InputGroup.Text className="bg-light">
                        <Mail size={16} />
                      </InputGroup.Text>
                      <Form.Control
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className="modern-form-control"
                      />
                    </InputGroup>
                  </Form.Group>
                </Col>
                
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="fw-medium">Số điện thoại</Form.Label>
                    <InputGroup>
                      <InputGroup.Text className="bg-light">
                        <Phone size={16} />
                      </InputGroup.Text>
                      <Form.Control
                        type="tel"
                        placeholder="Nhập số điện thoại"
                        className="modern-form-control"
                      />
                    </InputGroup>
                  </Form.Group>
                </Col>
                
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="fw-medium">Tên đăng nhập</Form.Label>
                    <InputGroup>
                      <InputGroup.Text className="bg-light">
                        <User size={16} />
                      </InputGroup.Text>
                      <Form.Control
                        type="text"
                        value={currentUser?.username || ''}
                        disabled
                        className="modern-form-control bg-light"
                      />
                    </InputGroup>
                    <Form.Text className="text-muted">
                      Tên đăng nhập không thể thay đổi
                    </Form.Text>
                  </Form.Group>
                </Col>
                
                <Col md={6}>
                  <Form.Group>
                    <Form.Label className="fw-medium">Vai trò</Form.Label>
                    <InputGroup>
                      <InputGroup.Text className="bg-light">
                        <Building size={16} />
                      </InputGroup.Text>
                      <Form.Control
                        type="text"
                        value={currentUser?.role ? getRoleDisplayName(currentUser.role) : ''}
                        disabled
                        className="modern-form-control bg-light"
                      />
                    </InputGroup>
                  </Form.Group>
                </Col>
              </Row>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="d-flex justify-content-end gap-3">
            <button 
              type="button"
              className="btn-modern"
              style={{ backgroundColor: '#dc3545' }}
            >
              Hủy
            </button>
            <button 
              className="btn-modern"
              type="submit" 
              disabled={loading || (showPasswordFields && !isPasswordValid())}
            >
              {loading ? (
                <div className="d-flex align-items-center gap-2">
                  <div className="spinner-border spinner-border-sm" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <span>Đang xử lý...</span>
                </div>
              ) : (
                <div className="d-flex align-items-center gap-2">
                  <Save size={18} />
                  <span>Lưu thay đổi</span>
                </div>
              )}
            </button>
          </div>
        </Form>
      </Container>
    </div>
  );
};

export default ProfilePage;