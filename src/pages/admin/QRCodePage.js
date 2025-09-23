import React, { useState, useEffect } from 'react';
import { Card, Button, Row, Col, Alert, Form, Spinner, Modal, Badge } from 'react-bootstrap';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import QRCode from 'qrcode.react';
import { toast } from 'react-toastify';
import { QrCode, ArrowLeft, Download, RefreshCw, Key, Clock, Copy, Info, AlertTriangle, CheckCircle, XCircle, Edit3, Save, X } from 'lucide-react';

const QRCodePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { api } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [session, setSession] = useState(null);
  const [sharedQRCodeData, setSharedQRCodeData] = useState(null);
  
  // Password management
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [expirationValue, setExpirationValue] = useState('24');
  const [expirationUnit, setExpirationUnit] = useState('hours');
  const [updatingPassword, setUpdatingPassword] = useState(false);
  
  // Fetch session details and QR codes
  useEffect(() => {
    const fetchSessionData = async () => {
      try {
        setLoading(true);
        
        // Kiểm tra xem id có hợp lệ không
        if (!id || id === 'undefined') {
          setError('ID buổi học không hợp lệ');
          setLoading(false);
          return;
        }
        
        console.log('Fetching session with ID:', id);
        
        // Get session details
        const sessionResponse = await api.get(`/sessions/${id}`);
        if (!sessionResponse.data.success) {
          throw new Error(sessionResponse.data.message || 'Không thể tải thông tin buổi học');
        }
        
        setSession(sessionResponse.data.data);
        setPassword(sessionResponse.data.data.password || '');
        

        
        // Check if shared QR code exists
        try {
          const sharedQRResponse = await api.get(`/sessions/${id}/shared-qr-code`);
          if (sharedQRResponse.data.success) {
            setSharedQRCodeData(sharedQRResponse.data.data);
          } else {
            // If no QR code exists, generate one automatically
            await generateSharedQRCode();
          }
        } catch (sharedQRError) {
          console.log('No existing shared QR code found, generating new one automatically');
          // Generate QR code automatically if none exists
          await generateSharedQRCode();
        }
        
      } catch (error) {
        console.error('Error fetching session data:', error);
        setError(error.response?.data?.message || 'Không thể tải dữ liệu. Vui lòng thử lại sau.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchSessionData();
  }, [id, api]); // eslint-disable-line react-hooks/exhaustive-deps
  

  
  // Generate shared QR code
  const generateSharedQRCode = async () => {
    try {
      setGenerating(true);
      
      const response = await api.post(`/sessions/${id}/shared-qr-code`);
      
      if (response.data.success) {
        setSharedQRCodeData(response.data.data);
        toast.success('Đã tạo mã QR dùng chung mới thành công');
      }
    } catch (error) {
      console.error('Error generating shared QR code:', error);
      toast.error(error.response?.data?.message || 'Không thể tạo mã QR dùng chung. Vui lòng thử lại sau.');
    } finally {
      setGenerating(false);
    }
  };
  
  // Update session password
  const updatePassword = async () => {
    try {
      setUpdatingPassword(true);
      
      const response = await api.put(`/sessions/${id}`, {
        password,
        passwordExpirationValue: expirationValue,
        passwordExpirationUnit: expirationUnit
      });
      
      if (response.data.success) {
        setSession(prev => ({
          ...prev,
          password,
          passwordExpiresAt: response.data.data.passwordExpiresAt
        }));
        
        setShowPasswordModal(false);
        toast.success('Đã cập nhật mật khẩu thành công');
      }
    } catch (error) {
      console.error('Error updating password:', error);
      toast.error(error.response?.data?.message || 'Không thể cập nhật mật khẩu. Vui lòng thử lại sau.');
    } finally {
      setUpdatingPassword(false);
    }
  };
  
  // Download QR code as image
  const downloadQRCode = (elementId, fileName) => {
    const canvas = document.getElementById(elementId);
    if (!canvas) {
      toast.error('Không thể tải xuống mã QR');
      return;
    }
    
    const pngUrl = canvas
      .toDataURL('image/png')
      .replace('image/png', 'image/octet-stream');
    
    const downloadLink = document.createElement('a');
    downloadLink.href = pngUrl;
    downloadLink.download = `${fileName}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };
  
  // Format expiration time
  const formatExpirationTime = (expiresAt) => {
    if (!expiresAt) return '';
    
    const expires = new Date(expiresAt);
    const now = new Date();
    
    if (expires < now) {
      return 'Đã hết hạn';
    }
    
    const diffMs = expires - now;
    const diffSecs = Math.floor(diffMs / 1000);
    
    if (diffSecs < 60) {
      return `Còn ${diffSecs} giây`;
    }
    
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) {
      return `Còn ${diffMins} phút`;
    }
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
      return `Còn ${diffHours} giờ ${diffMins % 60} phút`;
    }
    
    const diffDays = Math.floor(diffHours / 24);
    return `Còn ${diffDays} ngày ${diffHours % 24} giờ`;
  };
  
  // Go back to session details
  const handleBack = () => {
    navigate(`/admin/sessions/${id}`);
  };
  
  if (loading) {
    return (
      <div className="text-center p-5">
        <div className="modern-card">
          <div className="card-body text-center py-5">
            <div className="spinner-border text-primary mb-3" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mb-0">Đang tải thông tin...</p>
          </div>
        </div>
      </div>
    );
  }
  
  if (error || !session) {
    return (
      <div className="modern-card">
        <div className="card-header">
          <div className="d-flex align-items-center">
            <XCircle className="me-2 text-danger" size={24} />
            <h5 className="mb-0 fw-bold">Không thể tải thông tin buổi học</h5>
          </div>
        </div>
        <div className="card-body">
          <p className="mb-3">{error || 'Có lỗi xảy ra. Vui lòng thử lại sau.'}</p>
          <button 
            className="btn-modern" 
            style={{ backgroundColor: '#dc3545' }}
            onClick={() => navigate('/admin/sessions')}
          >
            <ArrowLeft size={16} className="me-2" />
            Quay lại danh sách buổi học
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="fw-bold">
            <QrCode className="me-2" size={28} />
            Mã QR điểm danh
          </h2>
          <p className="text-muted mt-1">Buổi học: {session.title}</p>
        </div>
        <button 
          className="btn-modern" 
          style={{ backgroundColor: '#6c757d' }}
          onClick={handleBack}
        >
          <ArrowLeft size={16} className="me-2" />
          Quay lại
        </button>
      </div>
      
      <div className="modern-card mb-4">
        <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
          <h5 className="mb-0 fw-bold">
            <Key className="me-2" size={20} />
            Mật khẩu buổi học
          </h5>
          <button 
            className="btn-modern" 
            style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white', padding: '8px 16px' }}
            onClick={() => setShowPasswordModal(true)}
          >
            <Edit3 size={16} className="me-2" />
            Chỉnh sửa mật khẩu
          </button>
        </div>
        <div className="card-body">
          <Row>
            <Col md={6}>
              <div className="space-y-3">
                <div className="d-flex align-items-center">
                  <Key className="me-2 text-primary" size={18} />
                  <span className="fw-medium">Mật khẩu hiện tại:</span>
                </div>
                <div className="mt-2">
                  {session.password ? (
                    <Badge bg="success" className="modern-badge fs-6 px-3 py-2">{session.password}</Badge>
                  ) : (
                    <Badge bg="secondary" className="modern-badge fs-6 px-3 py-2">Không có mật khẩu</Badge>
                  )}
                </div>
              </div>
            </Col>
            <Col md={6}>
              {session.passwordExpiresAt && (
                <div className="space-y-3">
                  <div className="d-flex align-items-center">
                    <Clock className="me-2 text-primary" size={18} />
                    <span className="fw-medium">Thời hạn:</span>
                  </div>
                  <div className="mt-2">
                    <Badge className={`modern-badge fs-6 px-3 py-2 ${new Date(session.passwordExpiresAt) > new Date() ? 'bg-info' : 'bg-danger'}`}>
                      {formatExpirationTime(session.passwordExpiresAt)}
                    </Badge>
                    <div className="small text-muted mt-2">
                      (Hết hạn vào: {new Date(session.passwordExpiresAt).toLocaleString()})
                    </div>
                  </div>
                </div>
              )}
            </Col>
          </Row>
        </div>
      </div>
      
      <div className="modern-card">
        <div className="card-body">
          <Row>
            <Col md={6} className="d-flex flex-column align-items-center">
              {sharedQRCodeData ? (
                <div className="qr-container">
                  <QRCode 
                    id="sharedQRCode"
                    value={sharedQRCodeData.qrUrl}
                    size={250}
                    level="H"
                    renderAs="canvas"
                    includeMargin={true}
                    className="qr-code-image"
                  />
                  <p className="mt-3 text-muted">QR Code ID: {sharedQRCodeData.id}</p>
                  <div className="d-flex gap-2 mt-3">
                    <button 
                      className="btn-modern" 
                      onClick={() => downloadQRCode('sharedQRCode', `qr_shared_${session.title}`)}
                    >
                      <Download size={16} className="me-2" />
                      Tải xuống
                    </button>
                    <button 
                      className="btn-modern" 
                      style={{ backgroundColor: '#6c757d' }}
                      onClick={generateSharedQRCode}
                      disabled={generating}
                    >
                      {generating ? (
                        <>
                          <div className="spinner-border spinner-border-sm me-2" role="status">
                            <span className="visually-hidden">Loading...</span>
                          </div>
                          Đang tạo...
                        </>
                      ) : (
                        <>
                          <RefreshCw size={16} className="me-2" />
                          Tạo mã mới
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center p-5">
                  <div className="spinner-border text-primary mb-3" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mb-0">Đang tạo mã QR tự động...</p>
                </div>
              )}
            </Col>
            
            <Col md={6}>
              <div className="mb-4">
                <h5 className="fw-bold text-primary">
                  <Info className="me-2" size={20} />
                  Hướng dẫn sử dụng
                </h5>
                <div className="modern-card">
                  <div className="card-body">
                    <p className="mb-3">Mã QR dùng chung cho phép nhiều sinh viên sử dụng cùng một mã QR. Sinh viên sẽ nhập thông tin của mình khi quét mã QR.</p>
                    <ul className="list-unstyled">
                      <li className="mb-2">
                        <CheckCircle className="me-2 text-success" size={16} />
                        Tiện lợi khi có nhiều sinh viên cùng điểm danh
                      </li>
                      <li className="mb-2">
                        <CheckCircle className="me-2 text-success" size={16} />
                        Không yêu cầu sinh viên phải đăng nhập
                      </li>
                      <li className="mb-2">
                        <CheckCircle className="me-2 text-success" size={16} />
                        Vẫn có thể đặt mật khẩu để bảo mật
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <div className="modern-alert modern-alert-warning">
                <h6 className="fw-bold mb-2">
                  <AlertTriangle className="me-2" size={18} />
                  Lưu ý
                </h6>
                <p className="mb-0">Khi sử dụng mã QR dùng chung, sinh viên cần nhập thông tin cá nhân (tên, mã số sinh viên, lớp). Vì thế cần kiểm tra thông tin điểm danh sau buổi học.</p>
              </div>
              
              {sharedQRCodeData && sharedQRCodeData.qrUrl && (
                <div className="mt-4">
                  <h6 className="fw-bold">
                    <Copy className="me-2" size={18} />
                    Link QR dùng chung
                  </h6>
                  <div className="input-group">
                    <input 
                      type="text" 
                      className="form-control modern-form-control" 
                      value={sharedQRCodeData.qrUrl} 
                      readOnly
                    />
                    <button 
                      className="btn-modern" 
                      style={{ backgroundColor: '#6c757d' }}
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(sharedQRCodeData.qrUrl);
                        toast.success('Đã sao chép link QR');
                      }}
                      title="Sao chép link"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                </div>
              )}
            </Col>
          </Row>
        </div>
      </div>
      
      {/* Password Modal */}
      <Modal show={showPasswordModal} onHide={() => setShowPasswordModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title className="fw-bold">
            <Key className="me-2" size={20} />
            Cài đặt mật khẩu buổi học
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label className="fw-medium">Mật khẩu</Form.Label>
              <Form.Control
                type="text"
                className="modern-form-control"
                placeholder="Nhập mật khẩu (để trống nếu không yêu cầu)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Form.Text className="text-muted">
                Sinh viên sẽ cần nhập mật khẩu này khi điểm danh
              </Form.Text>
            </Form.Group>
            
            {password && (
              <>
                <Form.Group className="mb-3">
                  <Form.Label className="fw-medium">Thời gian hết hạn</Form.Label>
                  <div className="d-flex gap-2">
                    <Form.Control
                      type="number"
                      className="modern-form-control"
                      min="1"
                      value={expirationValue}
                      onChange={(e) => setExpirationValue(e.target.value)}
                      style={{ width: '100px' }}
                    />
                    <Form.Select
                      className="modern-form-control"
                      value={expirationUnit}
                      onChange={(e) => setExpirationUnit(e.target.value)}
                    >
                      <option value="seconds">Giây</option>
                      <option value="minutes">Phút</option>
                      <option value="hours">Giờ</option>
                      <option value="days">Ngày</option>
                    </Form.Select>
                  </div>
                  <Form.Text className="text-muted">
                    Mật khẩu sẽ hết hạn sau khoảng thời gian này
                  </Form.Text>
                </Form.Group>
                
                <div className="modern-alert modern-alert-info">
                  <Info className="me-2" size={18} />
                  Nếu mật khẩu hết hạn, sinh viên sẽ không thể điểm danh được nữa.
                </div>
              </>
            )}
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <button 
            className="btn-modern" 
            style={{ backgroundColor: '#6c757d' }}
            onClick={() => setShowPasswordModal(false)}
          >
            <X size={16} className="me-2" />
            Hủy
          </button>
          <button 
            className="btn-modern" 
            onClick={updatePassword}
            disabled={updatingPassword}
          >
            {updatingPassword ? (
              <>
                <div className="spinner-border spinner-border-sm me-2" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                Đang cập nhật...
              </>
            ) : (
              <>
                <Save size={16} className="me-2" />
                Cập nhật
              </>
            )}
          </button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default QRCodePage;





