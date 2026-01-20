import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, Modal, Badge, Spinner, Alert, Tabs, Tab, Nav } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const PersonalProfile = () => {
  usePageTitle('Hồ sơ nhân sự');
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [profileData, setProfileData] = useState({
    user: null,
    profile: null,
    certificates: [],
    healthRecords: [],
    contracts: [],
    workHistory: []
  });
  const [activeTab, setActiveTab] = useState('info');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);
  const [showWorkHistoryModal, setShowWorkHistoryModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    idNumber: ''
  });
  const [certificateData, setCertificateData] = useState({
    certificate_name: '',
    certificate_number: '',
    issuing_organization: '',
    issue_date: '',
    expiry_date: '',
    status: 'valid',
    notes: ''
  });
  const [healthData, setHealthData] = useState({
    record_type: 'health_check',
    record_date: '',
    hospital_clinic: '',
    doctor_name: '',
    diagnosis: '',
    treatment: '',
    next_check_date: '',
    status: 'healthy',
    notes: ''
  });
  const [contractData, setContractData] = useState({
    contract_number: '',
    contract_type: 'full_time',
    position: '',
    department: '',
    start_date: '',
    end_date: '',
    salary: '',
    benefits: '',
    terms: '',
    status: 'active',
    signed_date: '',
    notes: ''
  });
  const [workHistoryData, setWorkHistoryData] = useState({
    organization: '',
    position: '',
    department: '',
    start_date: '',
    end_date: '',
    description: '',
    achievements: ''
  });

  // Fetch profile data
  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await api.get('/hr-profiles/me');
      
      if (response.data.success) {
        setProfileData(response.data.data);
        
        // Set form data from user
        if (response.data.data.user) {
          setFormData({
            fullName: response.data.data.user.full_name || '',
            email: response.data.data.user.email || '',
            phone: response.data.data.user.phone || '',
            address: response.data.data.user.address || '',
            idNumber: response.data.data.user.id_number || ''
          });
        }
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Không thể tải thông tin hồ sơ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchProfile();
    }
  }, [currentUser]);

  // Handle form input change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle certificate form change
  const handleCertificateChange = (e) => {
    const { name, value } = e.target;
    setCertificateData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle health form change
  const handleHealthChange = (e) => {
    const { name, value } = e.target;
    setHealthData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Format number with dots for thousands separator
  const formatNumberInput = (value) => {
    if (!value) return '';
    const numericValue = value.toString().replace(/\D/g, '');
    if (!numericValue) return '';
    return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  // Parse number from formatted string (remove dots and currency units)
  const parseNumberInput = (value) => {
    if (!value) return '';
    return value.toString()
      .replace(/\./g, '')
      .replace(/\s+/g, '')
      .replace(/vnd/gi, '')
      .replace(/vnđ/gi, '')
      .replace(/đ/g, '');
  };

  // Handle contract form change
  const handleContractChange = (e) => {
    const { name, value } = e.target;
    
    // Special handling for salary field - format with dots for display
    if (name === 'salary') {
      const numericValue = parseNumberInput(value);
      setContractData(prev => ({
        ...prev,
        [name]: numericValue || ''
      }));
      return;
    }
    
    setContractData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle work history form change
  const handleWorkHistoryChange = (e) => {
    const { name, value } = e.target;
    setWorkHistoryData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Update profile
  const handleUpdateProfile = async () => {
    try {
      const response = await api.put('/hr-profiles/me', formData);
      
      if (response.data.success) {
        setSuccess('Cập nhật thông tin thành công');
        setShowEditModal(false);
        fetchProfile();
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err.response?.data?.message || 'Không thể cập nhật thông tin');
    }
  };

  // Add/Update Certificate
  const handleSaveCertificate = async () => {
    try {
      if (!certificateData.certificate_name) {
        setError('Vui lòng nhập tên chứng chỉ');
        return;
      }

      let response;
      if (editingItem) {
        response = await api.put(`/hr-profiles/certificates/${editingItem.id}`, certificateData);
      } else {
        response = await api.post('/hr-profiles/certificates', certificateData);
      }

      if (response.data.success) {
        setSuccess(editingItem ? 'Cập nhật chứng chỉ thành công' : 'Thêm chứng chỉ thành công');
        setShowCertificateModal(false);
        setEditingItem(null);
        setCertificateData({
          certificate_name: '',
          certificate_number: '',
          issuing_organization: '',
          issue_date: '',
          expiry_date: '',
          status: 'valid',
          notes: ''
        });
        fetchProfile();
      }
    } catch (err) {
      console.error('Error saving certificate:', err);
      setError(err.response?.data?.message || 'Không thể lưu chứng chỉ');
    }
  };

  // Delete Certificate
  const handleDeleteCertificate = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa chứng chỉ này?')) return;

    try {
      const response = await api.delete(`/hr-profiles/certificates/${id}`);
      if (response.data.success) {
        setSuccess('Xóa chứng chỉ thành công');
        fetchProfile();
      }
    } catch (err) {
      console.error('Error deleting certificate:', err);
      setError(err.response?.data?.message || 'Không thể xóa chứng chỉ');
    }
  };

  // Add/Update Health Record
  const handleSaveHealth = async () => {
    try {
      if (!healthData.record_type || !healthData.record_date) {
        setError('Vui lòng nhập loại hồ sơ và ngày khám');
        return;
      }

      let response;
      if (editingItem) {
        response = await api.put(`/hr-profiles/health/${editingItem.id}`, healthData);
      } else {
        response = await api.post('/hr-profiles/health', healthData);
      }

      if (response.data.success) {
        setSuccess(editingItem ? 'Cập nhật hồ sơ sức khỏe thành công' : 'Thêm hồ sơ sức khỏe thành công');
        setShowHealthModal(false);
        setEditingItem(null);
        setHealthData({
          record_type: 'health_check',
          record_date: '',
          hospital_clinic: '',
          doctor_name: '',
          diagnosis: '',
          treatment: '',
          next_check_date: '',
          status: 'healthy',
          notes: ''
        });
        fetchProfile();
      }
    } catch (err) {
      console.error('Error saving health record:', err);
      setError(err.response?.data?.message || 'Không thể lưu hồ sơ sức khỏe');
    }
  };

  // Delete Health Record
  const handleDeleteHealth = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa hồ sơ sức khỏe này?')) return;

    try {
      const response = await api.delete(`/hr-profiles/health/${id}`);
      if (response.data.success) {
        setSuccess('Xóa hồ sơ sức khỏe thành công');
        fetchProfile();
      }
    } catch (err) {
      console.error('Error deleting health record:', err);
      setError(err.response?.data?.message || 'Không thể xóa hồ sơ sức khỏe');
    }
  };

  // Add/Update Contract
  const handleSaveContract = async () => {
    try {
      if (!contractData.contract_type || !contractData.start_date) {
        setError('Vui lòng nhập loại hợp đồng và ngày bắt đầu');
        return;
      }

      // Parse salary - remove dots if it's a string
      const submitData = {
        ...contractData,
        salary: contractData.salary ? (typeof contractData.salary === 'string' ? parseFloat(parseNumberInput(contractData.salary)) || 0 : parseFloat(contractData.salary) || 0) : 0
      };

      let response;
      if (editingItem) {
        response = await api.put(`/hr-profiles/contracts/${editingItem.id}`, submitData);
      } else {
        response = await api.post('/hr-profiles/contracts', submitData);
      }

      if (response.data.success) {
        setSuccess(editingItem ? 'Cập nhật hợp đồng thành công' : 'Thêm hợp đồng thành công');
        setShowContractModal(false);
        setEditingItem(null);
        setContractData({
          contract_number: '',
          contract_type: 'full_time',
          position: '',
          department: '',
          start_date: '',
          end_date: '',
          salary: '',
          benefits: '',
          terms: '',
          status: 'active',
          signed_date: '',
          notes: ''
        });
        fetchProfile();
      }
    } catch (err) {
      console.error('Error saving contract:', err);
      setError(err.response?.data?.message || 'Không thể lưu hợp đồng');
    }
  };

  // Delete Contract
  const handleDeleteContract = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa hợp đồng này?')) return;

    try {
      const response = await api.delete(`/hr-profiles/contracts/${id}`);
      if (response.data.success) {
        setSuccess('Xóa hợp đồng thành công');
        fetchProfile();
      }
    } catch (err) {
      console.error('Error deleting contract:', err);
      setError(err.response?.data?.message || 'Không thể xóa hợp đồng');
    }
  };

  // Add/Update Work History
  const handleSaveWorkHistory = async () => {
    try {
      if (!workHistoryData.organization || !workHistoryData.start_date) {
        setError('Vui lòng nhập tổ chức và ngày bắt đầu');
        return;
      }

      let response;
      if (editingItem) {
        response = await api.put(`/hr-profiles/work-history/${editingItem.id}`, workHistoryData);
      } else {
        response = await api.post('/hr-profiles/work-history', workHistoryData);
      }

      if (response.data.success) {
        setSuccess(editingItem ? 'Cập nhật lịch sử làm việc thành công' : 'Thêm lịch sử làm việc thành công');
        setShowWorkHistoryModal(false);
        setEditingItem(null);
        setWorkHistoryData({
          organization: '',
          position: '',
          department: '',
          start_date: '',
          end_date: '',
          description: '',
          achievements: ''
        });
        fetchProfile();
      }
    } catch (err) {
      console.error('Error saving work history:', err);
      setError(err.response?.data?.message || 'Không thể lưu lịch sử làm việc');
    }
  };

  // Delete Work History
  const handleDeleteWorkHistory = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa lịch sử làm việc này?')) return;

    try {
      const response = await api.delete(`/hr-profiles/work-history/${id}`);
      if (response.data.success) {
        setSuccess('Xóa lịch sử làm việc thành công');
        fetchProfile();
      }
    } catch (err) {
      console.error('Error deleting work history:', err);
      setError(err.response?.data?.message || 'Không thể xóa lịch sử làm việc');
    }
  };

  // Open edit modal
  const handleEdit = () => {
    setShowEditModal(true);
  };

  // Open add certificate modal
  const handleAddCertificate = () => {
    setEditingItem(null);
    setCertificateData({
      certificate_name: '',
      certificate_number: '',
      issuing_organization: '',
      issue_date: '',
      expiry_date: '',
      status: 'valid',
      notes: ''
    });
    setShowCertificateModal(true);
  };

  // Open edit certificate modal
  const handleEditCertificate = (certificate) => {
    setEditingItem(certificate);
    setCertificateData({
      certificate_name: certificate.certificate_name || '',
      certificate_number: certificate.certificate_number || '',
      issuing_organization: certificate.issuing_organization || '',
      issue_date: certificate.issue_date ? certificate.issue_date.split('T')[0] : '',
      expiry_date: certificate.expiry_date ? certificate.expiry_date.split('T')[0] : '',
      status: certificate.status || 'valid',
      notes: certificate.notes || ''
    });
    setShowCertificateModal(true);
  };

  // Open add health modal
  const handleAddHealth = () => {
    setEditingItem(null);
    setHealthData({
      record_type: 'health_check',
      record_date: '',
      hospital_clinic: '',
      doctor_name: '',
      diagnosis: '',
      treatment: '',
      next_check_date: '',
      status: 'healthy',
      notes: ''
    });
    setShowHealthModal(true);
  };

  // Open edit health modal
  const handleEditHealth = (record) => {
    setEditingItem(record);
    setHealthData({
      record_type: record.record_type || 'health_check',
      record_date: record.record_date ? record.record_date.split('T')[0] : '',
      hospital_clinic: record.hospital_clinic || '',
      doctor_name: record.doctor_name || '',
      diagnosis: record.diagnosis || '',
      treatment: record.treatment || '',
      next_check_date: record.next_check_date ? record.next_check_date.split('T')[0] : '',
      status: record.status || 'healthy',
      notes: record.notes || ''
    });
    setShowHealthModal(true);
  };

  // Open add contract modal
  const handleAddContract = () => {
    setEditingItem(null);
    setContractData({
      contract_number: '',
      contract_type: 'full_time',
      position: '',
      department: '',
      start_date: '',
      end_date: '',
      salary: '',
      benefits: '',
      terms: '',
      status: 'active',
      signed_date: '',
      notes: ''
    });
    setShowContractModal(true);
  };

  // Open edit contract modal
  const handleEditContract = (contract) => {
    setEditingItem(contract);
    // Ensure salary is properly formatted for display
    let salaryValue = contract.salary || '';
    if (salaryValue) {
      const numSalary = parseFloat(salaryValue) || 0;
      salaryValue = numSalary.toString();
    }
    
    setContractData({
      contract_number: contract.contract_number || '',
      contract_type: contract.contract_type || 'full_time',
      position: contract.position || '',
      department: contract.department || '',
      start_date: contract.start_date ? contract.start_date.split('T')[0] : '',
      end_date: contract.end_date ? contract.end_date.split('T')[0] : '',
      salary: salaryValue,
      benefits: contract.benefits || '',
      terms: contract.terms || '',
      status: contract.status || 'active',
      signed_date: contract.signed_date ? contract.signed_date.split('T')[0] : '',
      notes: contract.notes || ''
    });
    setShowContractModal(true);
  };

  // Open add work history modal
  const handleAddWorkHistory = () => {
    setEditingItem(null);
    setWorkHistoryData({
      organization: '',
      position: '',
      department: '',
      start_date: '',
      end_date: '',
      description: '',
      achievements: ''
    });
    setShowWorkHistoryModal(true);
  };

  // Open edit work history modal
  const handleEditWorkHistory = (history) => {
    setEditingItem(history);
    setWorkHistoryData({
      organization: history.organization || '',
      position: history.position || '',
      department: history.department || '',
      start_date: history.start_date ? history.start_date.split('T')[0] : '',
      end_date: history.end_date ? history.end_date.split('T')[0] : '',
      description: history.description || '',
      achievements: history.achievements || ''
    });
    setShowWorkHistoryModal(true);
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('vi-VN');
  };

  // Check certificate expiry
  const getCertificateStatus = (certificate) => {
    if (!certificate.expiry_date) return { label: 'Không có hạn', color: 'secondary' };
    
    const expiryDate = new Date(certificate.expiry_date);
    const now = new Date();
    const diffTime = expiryDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { label: 'Đã hết hạn', color: 'danger' };
    } else if (diffDays <= 30) {
      return { label: 'Sắp hết hạn', color: 'warning' };
    } else {
      return { label: 'Còn hạn', color: 'success' };
    }
  };

  // Get contract status
  const getContractStatus = (contract) => {
    if (!contract.end_date) return { label: 'Không có hạn', color: 'info' };
    
    const endDate = new Date(contract.end_date);
    const now = new Date();
    const diffTime = endDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { label: 'Đã hết hạn', color: 'danger' };
    } else if (diffDays <= 30) {
      return { label: 'Sắp hết hạn', color: 'warning' };
    } else {
      return { label: 'Đang hiệu lực', color: 'success' };
    }
  };

  // Get record type label
  const getRecordTypeLabel = (type) => {
    switch (type) {
      case 'health_check': return 'Khám sức khỏe';
      case 'vaccination': return 'Tiêm chủng';
      case 'medical_exam': return 'Khám bệnh';
      case 'disease_history': return 'Tiền sử bệnh';
      default: return type;
    }
  };

  // Get contract type label
  const getContractTypeLabel = (type) => {
    switch (type) {
      case 'full_time': return 'Toàn thời gian';
      case 'part_time': return 'Bán thời gian';
      case 'contract': return 'Hợp đồng';
      case 'temporary': return 'Tạm thời';
      case 'internship': return 'Thực tập';
      default: return type;
    }
  };

  // Get employment status label
  const getEmploymentStatusLabel = (status) => {
    switch (status) {
      case 'active': return 'Đang làm việc';
      case 'probation': return 'Thử việc';
      case 'on_leave': return 'Nghỉ phép';
      case 'terminated': return 'Đã nghỉ việc';
      case 'retired': return 'Đã nghỉ hưu';
      default: return status;
    }
  };

  // Get status badge color
  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'probation': return 'warning';
      case 'on_leave': return 'info';
      case 'terminated': return 'danger';
      case 'retired': return 'secondary';
      default: return 'secondary';
    }
  };

  if (loading) {
  return (
      <Container fluid className="session-main-container">
        <div className="text-center py-5">
          <Spinner animation="border" />
          <p className="mt-3">Đang tải thông tin hồ sơ...</p>
        </div>
      </Container>
    );
  }

  return (
    <Container fluid className="session-main-container">
      {error && (
        <Alert variant="danger" className="mb-3" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" className="mb-3" dismissible onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Header */}
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Hồ sơ cá nhân</h1>
            <p className="header-subtitle">Thông tin cá nhân, chuyên môn, lịch sử làm việc</p>
          </div>
          <div className="header-actions">
            <Button variant="outline-light" className="create-session-btn" onClick={handleEdit}>
              <i className="fas fa-edit me-2"></i>
              Chỉnh sửa
            </Button>
          </div>
        </div>
      </div>

      {/* Profile Info */}
      {profileData.user && (
        <Row className="g-3 mb-4">
          <Col md={4}>
            <div className="statistics-card">
              <div className="statistics-icon text-primary">
                <i className="fas fa-user"></i>
              </div>
              <div className="statistics-content">
                <h3>{profileData.user.full_name || 'N/A'}</h3>
                <p>{profileData.user.username || 'N/A'}</p>
              </div>
            </div>
          </Col>
          <Col md={4}>
            <div className="statistics-card">
              <div className="statistics-icon text-info">
                <i className="fas fa-envelope"></i>
              </div>
              <div className="statistics-content">
                <h3>{profileData.user.email || 'N/A'}</h3>
                <p>Email</p>
              </div>
            </div>
          </Col>
          <Col md={4}>
            <div className="statistics-card">
              <div className="statistics-icon text-success">
                <i className="fas fa-phone"></i>
              </div>
              <div className="statistics-content">
                <h3>{profileData.user.phone || 'N/A'}</h3>
                <p>Điện thoại</p>
              </div>
            </div>
          </Col>
        </Row>
      )}

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k)}>
          <Nav variant="tabs" className="custom-tabs">
            <Nav.Item>
              <Nav.Link eventKey="info">
                <span className="tab-title">
                  <i className="fas fa-info-circle me-2"></i>
                  Thông tin cơ bản
                </span>
              </Nav.Link>
            </Nav.Item>
            {profileData.user && profileData.user.role !== 'student' && (
              <>
                <Nav.Item>
                  <Nav.Link eventKey="certificates">
                    <span className="tab-title">
                      <i className="fas fa-certificate me-2"></i>
                      Chứng chỉ ({profileData.certificates.length})
                    </span>
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link eventKey="health">
                    <span className="tab-title">
                      <i className="fas fa-heartbeat me-2"></i>
                      Sức khỏe ({profileData.healthRecords.length})
                    </span>
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link eventKey="contracts">
                    <span className="tab-title">
                      <i className="fas fa-file-contract me-2"></i>
                      Hợp đồng ({profileData.contracts.length})
                    </span>
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link eventKey="work-history">
                    <span className="tab-title">
                      <i className="fas fa-briefcase me-2"></i>
                      Lịch sử làm việc ({profileData.workHistory.length})
                    </span>
                  </Nav.Link>
                </Nav.Item>
              </>
            )}
          </Nav>

          <Tab.Content>
            {/* Basic Info Tab - Combined with HR Profile */}
            <Tab.Pane eventKey="info">
      <div className="session-table-container">
                <div style={{ padding: '20px' }}>
                  <Row className="g-3">
                    {/* Personal Information */}
                    <Col md={profileData.user && profileData.user.role !== 'student' ? 6 : 12}>
                      <div className="session-card">
                        <div className="card-header-modern">
                          <div className="header-icon">
                            <i className="fas fa-user"></i>
              </div>
                          <h6 className="mb-0">Thông tin cá nhân</h6>
            </div>
                        <div className="card-body-modern">
                          <div className="info-item-inline">
                            <div className="info-label">
                              <i className="fas fa-id-card"></i>
                              Họ và tên
          </div>
                            <div className="info-value">{profileData.user?.full_name || 'N/A'}</div>
              </div>
                          <div className="info-item-inline">
                            <div className="info-label">
                              <i className="fas fa-user"></i>
                              Tên đăng nhập
            </div>
                            <div className="info-value">{profileData.user?.username || 'N/A'}</div>
          </div>
                          <div className="info-item-inline">
                            <div className="info-label">
                              <i className="fas fa-envelope"></i>
                              Email
        </div>
                            <div className="info-value">{profileData.user?.email || 'N/A'}</div>
      </div>
                          <div className="info-item-inline">
                            <div className="info-label">
                              <i className="fas fa-phone"></i>
                              Điện thoại
    </div>
                            <div className="info-value">{profileData.user?.phone || 'N/A'}</div>
                          </div>
                          <div className="info-item-inline">
                            <div className="info-label">
                              <i className="fas fa-map-marker-alt"></i>
                              Địa chỉ
                            </div>
                            <div className="info-value">{profileData.user?.address || 'N/A'}</div>
                          </div>
                          <div className="info-item-inline">
                            <div className="info-label">
                              <i className="fas fa-id-badge"></i>
                              CMND/CCCD
                            </div>
                            <div className="info-value">{profileData.user?.id_number || 'N/A'}</div>
                          </div>
                          <div className="info-item-inline">
                            <div className="info-label">
                              <i className="fas fa-shield-alt"></i>
                              Vai trò
                            </div>
                            <div className="info-value">
                              {profileData.user?.role === 'superadmin' ? 'Siêu quản trị viên' :
                               profileData.user?.role === 'admin' ? 'Quản trị viên' :
                               profileData.user?.role === 'staff' ? 'Nhân viên' :
                               profileData.user?.role === 'student' ? 'Sinh viên' : 'N/A'}
                            </div>
                          </div>
                          <div className="info-item-inline">
                            <div className="info-label">
                              <i className="fas fa-calendar"></i>
                              Ngày tạo tài khoản
                            </div>
                            <div className="info-value">
                              {profileData.user?.created_at ? formatDate(profileData.user.created_at) : 'N/A'}
                            </div>
                          </div>
                          {profileData.user?.last_login && (
                            <div className="info-item-inline">
                              <div className="info-label">
                                <i className="fas fa-sign-in-alt"></i>
                                Lần đăng nhập cuối
                              </div>
                              <div className="info-value">
                                {formatDate(profileData.user.last_login)}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </Col>

                    {/* HR Profile (only for staff) */}
                    {profileData.user && profileData.user.role !== 'student' && (
                      <Col md={6}>
                        {profileData.profile ? (
                          <div className="session-card">
                            <div className="card-header-modern">
                              <div className="header-icon">
                                <i className="fas fa-id-card"></i>
                              </div>
                              <h6 className="mb-0">Thông tin nhân sự</h6>
                            </div>
                            <div className="card-body-modern">
                              <div className="info-item-inline">
                                <div className="info-label">
                                  <i className="fas fa-hashtag"></i>
                                  Mã nhân viên
                                </div>
                                <div className="info-value">{profileData.profile.employee_code || 'N/A'}</div>
                              </div>
                              <div className="info-item-inline">
                                <div className="info-label">
                                  <i className="fas fa-briefcase"></i>
                                  Chức danh
                                </div>
                                <div className="info-value">{profileData.profile.position || 'N/A'}</div>
                              </div>
                              <div className="info-item-inline">
                                <div className="info-label">
                                  <i className="fas fa-building"></i>
                                  Khoa/Phòng ban
                                </div>
                                <div className="info-value">{profileData.profile.department || 'N/A'}</div>
                              </div>
                              <div className="info-item-inline">
                                <div className="info-label">
                                  <i className="fas fa-user-tie"></i>
                                  Chức vụ
                                </div>
                                <div className="info-value">{profileData.profile.title || 'N/A'}</div>
                              </div>
                              <div className="info-item-inline">
                                <div className="info-label">
                                  <i className="fas fa-graduation-cap"></i>
                                  Trình độ học vấn
                                </div>
                                <div className="info-value">{profileData.profile.education_level || 'N/A'}</div>
                              </div>
                              <div className="info-item-inline">
                                <div className="info-label">
                                  <i className="fas fa-university"></i>
                                  Bằng cấp
                                </div>
                                <div className="info-value">{profileData.profile.degree || 'N/A'}</div>
                              </div>
                              <div className="info-item-inline">
                                <div className="info-label">
                                  <i className="fas fa-calendar-check"></i>
                                  Ngày bắt đầu làm việc
                                </div>
                                <div className="info-value">
                                  {profileData.profile.start_date ? formatDate(profileData.profile.start_date) : 'N/A'}
                                </div>
                              </div>
                              <div className="info-item-inline">
                                <div className="info-label">
                                  <i className="fas fa-clock"></i>
                                  Kinh nghiệm làm việc
                                </div>
                                <div className="info-value">
                                  {profileData.profile.work_experience ? `${profileData.profile.work_experience} năm` : 'N/A'}
                                </div>
                              </div>
                              <div className="info-item-inline">
                                <div className="info-label">
                                  <i className="fas fa-file-contract"></i>
                                  Loại hợp đồng
                                </div>
                                <div className="info-value">
                                  {profileData.profile.contract_type ? getContractTypeLabel(profileData.profile.contract_type) : 'N/A'}
                                </div>
                              </div>
                              <div className="info-item-inline">
                                <div className="info-label">
                                  <i className="fas fa-money-bill-wave"></i>
                                  Lương thỏa thuận (HĐ)
                                </div>
                                <div className="info-value fw-bold text-primary">
                                  {profileData.profile.salary ? `${parseFloat(profileData.profile.salary).toLocaleString('vi-VN')} VNĐ` : 'N/A'}
                                </div>
                              </div>
                              <div className="info-item-inline">
                                <div className="info-label">
                                  <i className="fas fa-money-bill-wave"></i>
                                  Lương cơ bản
                                </div>
                                <div className="info-value fw-bold text-primary">
                                  {profileData.profile.base_salary ? `${parseFloat(profileData.profile.base_salary).toLocaleString('vi-VN')} VNĐ` : 'N/A'}
                                </div>
                              </div>
                              <div className="info-item-inline">
                                <div className="info-label">
                                  <i className="fas fa-info-circle"></i>
                                  Trạng thái
                                </div>
                                <div className="info-value">
                                  <Badge bg={getStatusColor(profileData.profile.employment_status)}>
                                    {getEmploymentStatusLabel(profileData.profile.employment_status)}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="session-card">
                            <div className="card-header-modern">
                              <div className="header-icon">
                                <i className="fas fa-id-card"></i>
                              </div>
                              <h6 className="mb-0">Thông tin nhân sự</h6>
                            </div>
                            <div className="card-body-modern">
                              <div className="text-center py-3">
                                <i className="fas fa-id-card fa-3x text-muted mb-3"></i>
                                <h6>Chưa có thông tin hồ sơ nhân sự</h6>
                                <p className="text-muted mb-0">Vui lòng liên hệ HR để cập nhật thông tin</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </Col>
                    )}
                  </Row>
                </div>
              </div>
            </Tab.Pane>

            {/* Certificates Tab */}
            {profileData.user && profileData.user.role !== 'student' && (
              <Tab.Pane eventKey="certificates">
                <div className="session-table-container">
                  <div style={{ padding: '20px' }}>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h5>Chứng chỉ hành nghề</h5>
                      <Button variant="primary" size="sm" onClick={handleAddCertificate}>
                        <i className="fas fa-plus me-2"></i>
                        Thêm chứng chỉ
                      </Button>
                    </div>
                    {profileData.certificates.length === 0 ? (
                      <div className="text-center py-5">
                        <i className="fas fa-certificate fa-4x text-muted mb-3"></i>
                        <h5>Chưa có chứng chỉ nào</h5>
                        <p className="text-muted">Thêm chứng chỉ để quản lý</p>
                      </div>
                    ) : (
                      <div className="row g-3">
                        {profileData.certificates.map(cert => {
                          const certStatus = getCertificateStatus(cert);
                          return (
                            <Col md={6} key={cert.id}>
                              <div className="session-card">
                                <div className="card-body-modern">
                                  <div className="d-flex justify-content-between align-items-start mb-2">
                                    <h6 className="mb-0">{cert.certificate_name}</h6>
                                    <Badge bg={certStatus.color}>{certStatus.label}</Badge>
                                  </div>
                                  <div className="info-item">
                                    <div className="info-label">Số chứng chỉ</div>
                                    <div className="info-value">{cert.certificate_number || 'N/A'}</div>
                                  </div>
                                  <div className="info-item">
                                    <div className="info-label">Tổ chức cấp</div>
                                    <div className="info-value">{cert.issuing_organization || 'N/A'}</div>
                                  </div>
                                  <div className="info-item">
                                    <div className="info-label">Ngày cấp</div>
                                    <div className="info-value">{cert.issue_date ? formatDate(cert.issue_date) : 'N/A'}</div>
                                  </div>
                                  <div className="info-item">
                                    <div className="info-label">Ngày hết hạn</div>
                                    <div className="info-value">{cert.expiry_date ? formatDate(cert.expiry_date) : 'Không có hạn'}</div>
                                  </div>
                                  {cert.notes && (
                                    <div className="info-item">
                                      <div className="info-label">Ghi chú</div>
                                      <div className="info-value">{cert.notes}</div>
                                    </div>
                                  )}
                                  <div className="d-flex gap-2 mt-3">
                                    <Button variant="outline-primary" size="sm" onClick={() => handleEditCertificate(cert)}>
                                      <i className="fas fa-edit"></i>
                                    </Button>
                                    <Button variant="outline-danger" size="sm" onClick={() => handleDeleteCertificate(cert.id)}>
                                      <i className="fas fa-trash"></i>
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </Col>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </Tab.Pane>
            )}

            {/* Health Records Tab */}
            {profileData.user && profileData.user.role !== 'student' && (
              <Tab.Pane eventKey="health">
                <div className="session-table-container">
                  <div style={{ padding: '20px' }}>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h5>Hồ sơ sức khỏe</h5>
                      <Button variant="primary" size="sm" onClick={handleAddHealth}>
                        <i className="fas fa-plus me-2"></i>
                        Thêm hồ sơ sức khỏe
                      </Button>
                    </div>
                    {profileData.healthRecords.length === 0 ? (
                      <div className="text-center py-5">
                        <i className="fas fa-heartbeat fa-4x text-muted mb-3"></i>
                        <h5>Chưa có hồ sơ sức khỏe nào</h5>
                        <p className="text-muted">Thêm hồ sơ sức khỏe để quản lý</p>
                      </div>
                    ) : (
                      <div className="row g-3">
                        {profileData.healthRecords.map(record => (
                          <Col md={6} key={record.id}>
                            <div className="session-card">
                              <div className="card-body-modern">
                                <div className="d-flex justify-content-between align-items-start mb-2">
                                  <h6 className="mb-0">{getRecordTypeLabel(record.record_type)}</h6>
                                  <Badge bg={record.status === 'healthy' ? 'success' : 'warning'}>
                                    {record.status === 'healthy' ? 'Khỏe mạnh' : 'Đang điều trị'}
                                  </Badge>
                                </div>
                                <div className="info-item">
                                  <div className="info-label">Ngày khám</div>
                                  <div className="info-value">{formatDate(record.record_date)}</div>
                                </div>
                                {record.hospital_clinic && (
                                  <div className="info-item">
                                    <div className="info-label">Bệnh viện/Phòng khám</div>
                                    <div className="info-value">{record.hospital_clinic}</div>
                                  </div>
                                )}
                                {record.doctor_name && (
                                  <div className="info-item">
                                    <div className="info-label">Bác sĩ</div>
                                    <div className="info-value">{record.doctor_name}</div>
                                  </div>
                                )}
                                {record.diagnosis && (
                                  <div className="info-item">
                                    <div className="info-label">Chẩn đoán</div>
                                    <div className="info-value">{record.diagnosis}</div>
                                  </div>
                                )}
                                {record.next_check_date && (
                                  <div className="info-item">
                                    <div className="info-label">Lần khám tiếp theo</div>
                                    <div className="info-value">{formatDate(record.next_check_date)}</div>
                                  </div>
                                )}
                                <div className="d-flex gap-2 mt-3">
                                  <Button variant="outline-primary" size="sm" onClick={() => handleEditHealth(record)}>
                                    <i className="fas fa-edit"></i>
                                  </Button>
                                  <Button variant="outline-danger" size="sm" onClick={() => handleDeleteHealth(record.id)}>
                                    <i className="fas fa-trash"></i>
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </Col>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Tab.Pane>
            )}

            {/* Contracts Tab */}
            {profileData.user && profileData.user.role !== 'student' && (
              <Tab.Pane eventKey="contracts">
                <div className="session-table-container">
                  <div style={{ padding: '20px' }}>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h5>Hợp đồng lao động</h5>
                      <Button variant="primary" size="sm" onClick={handleAddContract}>
                        <i className="fas fa-plus me-2"></i>
                        Thêm hợp đồng
                      </Button>
                    </div>
                    {profileData.contracts.length === 0 ? (
                      <div className="text-center py-5">
                        <i className="fas fa-file-contract fa-4x text-muted mb-3"></i>
                        <h5>Chưa có hợp đồng nào</h5>
                        <p className="text-muted">Thêm hợp đồng để quản lý</p>
                      </div>
                    ) : (
                      <div className="row g-3">
                        {profileData.contracts.map(contract => {
                          const contractStatus = getContractStatus(contract);
                          return (
                            <Col md={6} key={contract.id}>
                              <div className="session-card">
                                <div className="card-body-modern">
                                  <div className="d-flex justify-content-between align-items-start mb-2">
                                    <h6 className="mb-0">{contract.contract_number || 'Hợp đồng'}</h6>
                                    <Badge bg={contractStatus.color}>{contractStatus.label}</Badge>
                                  </div>
                                  <div className="info-item">
                                    <div className="info-label">Loại hợp đồng</div>
                                    <div className="info-value">{getContractTypeLabel(contract.contract_type)}</div>
                                  </div>
                                  {contract.position && (
                                    <div className="info-item">
                                      <div className="info-label">Chức danh</div>
                                      <div className="info-value">{contract.position}</div>
                                    </div>
                                  )}
                                  {contract.department && (
                                    <div className="info-item">
                                      <div className="info-label">Khoa/Phòng ban</div>
                                      <div className="info-value">{contract.department}</div>
                                    </div>
                                  )}
                                  <div className="info-item">
                                    <div className="info-label">Ngày bắt đầu</div>
                                    <div className="info-value">{formatDate(contract.start_date)}</div>
                                  </div>
                                  {contract.end_date && (
                                    <div className="info-item">
                                      <div className="info-label">Ngày kết thúc</div>
                                      <div className="info-value">{formatDate(contract.end_date)}</div>
                                    </div>
                                  )}
                                  {contract.salary && (
                                    <div className="info-item">
                                      <div className="info-label">Lương</div>
                                      <div className="info-value">{parseFloat(contract.salary).toLocaleString('vi-VN')} VNĐ</div>
                                    </div>
                                  )}
                                  <div className="d-flex gap-2 mt-3">
                                    <Button variant="outline-primary" size="sm" onClick={() => handleEditContract(contract)}>
                                      <i className="fas fa-edit"></i>
                                    </Button>
                                    <Button variant="outline-danger" size="sm" onClick={() => handleDeleteContract(contract.id)}>
                                      <i className="fas fa-trash"></i>
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </Col>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </Tab.Pane>
            )}

            {/* Work History Tab */}
            {profileData.user && profileData.user.role !== 'student' && (
              <Tab.Pane eventKey="work-history">
                <div className="session-table-container">
                  <div style={{ padding: '20px' }}>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h5>Lịch sử làm việc</h5>
                      <Button variant="primary" size="sm" onClick={handleAddWorkHistory}>
                        <i className="fas fa-plus me-2"></i>
                        Thêm lịch sử
                      </Button>
                    </div>
                    {profileData.workHistory.length === 0 ? (
                      <div className="text-center py-5">
                        <i className="fas fa-briefcase fa-4x text-muted mb-3"></i>
                        <h5>Chưa có lịch sử làm việc nào</h5>
                        <p className="text-muted">Thêm lịch sử làm việc để quản lý</p>
                      </div>
                    ) : (
                      <div className="row g-3">
                        {profileData.workHistory.map(history => (
                          <Col md={6} key={history.id}>
                            <div className="session-card">
                              <div className="card-body-modern">
                                <h6 className="mb-2">{history.organization}</h6>
                                {history.position && (
                                  <div className="info-item">
                                    <div className="info-label">Chức danh</div>
                                    <div className="info-value">{history.position}</div>
                                  </div>
                                )}
                                {history.department && (
                                  <div className="info-item">
                                    <div className="info-label">Phòng ban</div>
                                    <div className="info-value">{history.department}</div>
                                  </div>
                                )}
                                <div className="info-item">
                                  <div className="info-label">Từ ngày</div>
                                  <div className="info-value">{formatDate(history.start_date)}</div>
                                </div>
                                {history.end_date && (
                                  <div className="info-item">
                                    <div className="info-label">Đến ngày</div>
                                    <div className="info-value">{formatDate(history.end_date)}</div>
                                  </div>
                                )}
                                {history.description && (
                                  <div className="info-item">
                                    <div className="info-label">Mô tả</div>
                                    <div className="info-value">{history.description}</div>
                                  </div>
                                )}
                                {history.achievements && (
                                  <div className="info-item">
                                    <div className="info-label">Thành tích</div>
                                    <div className="info-value">{history.achievements}</div>
                                  </div>
                                )}
                                <div className="d-flex gap-2 mt-3">
                                  <Button variant="outline-primary" size="sm" onClick={() => handleEditWorkHistory(history)}>
                                    <i className="fas fa-edit"></i>
                                  </Button>
                                  <Button variant="outline-danger" size="sm" onClick={() => handleDeleteWorkHistory(history.id)}>
                                    <i className="fas fa-trash"></i>
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </Col>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Tab.Pane>
            )}
          </Tab.Content>
        </Tab.Container>
      </div>

      {/* Edit Profile Modal */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Chỉnh sửa thông tin cá nhân</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Họ và tên</Form.Label>
              <Form.Control
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleInputChange}
                className="form-control-modern"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="form-control-modern"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Điện thoại</Form.Label>
              <Form.Control
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="form-control-modern"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Địa chỉ</Form.Label>
              <Form.Control
                type="text"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                className="form-control-modern"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>CMND/CCCD</Form.Label>
              <Form.Control
                type="text"
                name="idNumber"
                value={formData.idNumber}
                onChange={handleInputChange}
                className="form-control-modern"
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEditModal(false)}>
            Hủy
          </Button>
          <Button variant="primary" onClick={handleUpdateProfile}>
            Lưu
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Certificate Modal */}
      <Modal show={showCertificateModal} onHide={() => {
        setShowCertificateModal(false);
        setEditingItem(null);
      }} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{editingItem ? 'Chỉnh sửa chứng chỉ' : 'Thêm chứng chỉ'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Tên chứng chỉ <span className="text-danger">*</span></Form.Label>
              <Form.Control
                type="text"
                name="certificate_name"
                value={certificateData.certificate_name}
                onChange={handleCertificateChange}
                className="form-control-modern"
                required
              />
            </Form.Group>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Số chứng chỉ</Form.Label>
                  <Form.Control
                    type="text"
                    name="certificate_number"
                    value={certificateData.certificate_number}
                    onChange={handleCertificateChange}
                    className="form-control-modern"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Tổ chức cấp</Form.Label>
                  <Form.Control
                    type="text"
                    name="issuing_organization"
                    value={certificateData.issuing_organization}
                    onChange={handleCertificateChange}
                    className="form-control-modern"
                  />
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Ngày cấp</Form.Label>
                  <Form.Control
                    type="date"
                    name="issue_date"
                    value={certificateData.issue_date}
                    onChange={handleCertificateChange}
                    className="form-control-modern"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Ngày hết hạn</Form.Label>
                  <Form.Control
                    type="date"
                    name="expiry_date"
                    value={certificateData.expiry_date}
                    onChange={handleCertificateChange}
                    className="form-control-modern"
                  />
                </Form.Group>
              </Col>
            </Row>
            <Form.Group className="mb-3">
              <Form.Label>Trạng thái</Form.Label>
              <Form.Select
                name="status"
                value={certificateData.status}
                onChange={handleCertificateChange}
                className="form-control-modern"
              >
                <option value="valid">Còn hiệu lực</option>
                <option value="expired">Đã hết hạn</option>
                <option value="expiring_soon">Sắp hết hạn</option>
                <option value="renewed">Đã gia hạn</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Ghi chú</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                name="notes"
                value={certificateData.notes}
                onChange={handleCertificateChange}
                className="form-control-modern"
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => {
            setShowCertificateModal(false);
            setEditingItem(null);
          }}>
            Hủy
          </Button>
          <Button variant="primary" onClick={handleSaveCertificate}>
            {editingItem ? 'Cập nhật' : 'Thêm'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Health Record Modal */}
      <Modal show={showHealthModal} onHide={() => {
        setShowHealthModal(false);
        setEditingItem(null);
      }} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{editingItem ? 'Chỉnh sửa hồ sơ sức khỏe' : 'Thêm hồ sơ sức khỏe'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Loại hồ sơ <span className="text-danger">*</span></Form.Label>
                  <Form.Select
                    name="record_type"
                    value={healthData.record_type}
                    onChange={handleHealthChange}
                    className="form-control-modern"
                    required
                  >
                    <option value="health_check">Khám sức khỏe</option>
                    <option value="vaccination">Tiêm chủng</option>
                    <option value="medical_exam">Khám bệnh</option>
                    <option value="disease_history">Tiền sử bệnh</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Ngày khám <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    type="date"
                    name="record_date"
                    value={healthData.record_date}
                    onChange={handleHealthChange}
                    className="form-control-modern"
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Bệnh viện/Phòng khám</Form.Label>
                  <Form.Control
                    type="text"
                    name="hospital_clinic"
                    value={healthData.hospital_clinic}
                    onChange={handleHealthChange}
                    className="form-control-modern"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Bác sĩ</Form.Label>
                  <Form.Control
                    type="text"
                    name="doctor_name"
                    value={healthData.doctor_name}
                    onChange={handleHealthChange}
                    className="form-control-modern"
                  />
                </Form.Group>
              </Col>
            </Row>
            <Form.Group className="mb-3">
              <Form.Label>Chẩn đoán</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                name="diagnosis"
                value={healthData.diagnosis}
                onChange={handleHealthChange}
                className="form-control-modern"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Điều trị</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                name="treatment"
                value={healthData.treatment}
                onChange={handleHealthChange}
                className="form-control-modern"
              />
            </Form.Group>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Lần khám tiếp theo</Form.Label>
                  <Form.Control
                    type="date"
                    name="next_check_date"
                    value={healthData.next_check_date}
                    onChange={handleHealthChange}
                    className="form-control-modern"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Trạng thái</Form.Label>
                  <Form.Select
                    name="status"
                    value={healthData.status}
                    onChange={handleHealthChange}
                    className="form-control-modern"
                  >
                    <option value="healthy">Khỏe mạnh</option>
                    <option value="treating">Đang điều trị</option>
                    <option value="recovered">Đã khỏi</option>
                    <option value="chronic">Bệnh mãn tính</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
            <Form.Group className="mb-3">
              <Form.Label>Ghi chú</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                name="notes"
                value={healthData.notes}
                onChange={handleHealthChange}
                className="form-control-modern"
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => {
            setShowHealthModal(false);
            setEditingItem(null);
          }}>
            Hủy
          </Button>
          <Button variant="primary" onClick={handleSaveHealth}>
            {editingItem ? 'Cập nhật' : 'Thêm'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Contract Modal */}
      <Modal show={showContractModal} onHide={() => {
        setShowContractModal(false);
        setEditingItem(null);
      }} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{editingItem ? 'Chỉnh sửa hợp đồng' : 'Thêm hợp đồng'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Số hợp đồng</Form.Label>
                  <Form.Control
                    type="text"
                    name="contract_number"
                    value={contractData.contract_number}
                    onChange={handleContractChange}
                    className="form-control-modern"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Loại hợp đồng <span className="text-danger">*</span></Form.Label>
                  <Form.Select
                    name="contract_type"
                    value={contractData.contract_type}
                    onChange={handleContractChange}
                    className="form-control-modern"
                    required
                  >
                    <option value="full_time">Toàn thời gian</option>
                    <option value="part_time">Bán thời gian</option>
                    <option value="contract">Hợp đồng</option>
                    <option value="temporary">Tạm thời</option>
                    <option value="internship">Thực tập</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Chức danh</Form.Label>
                  <Form.Control
                    type="text"
                    name="position"
                    value={contractData.position}
                    onChange={handleContractChange}
                    className="form-control-modern"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Khoa/Phòng ban</Form.Label>
                  <Form.Control
                    type="text"
                    name="department"
                    value={contractData.department}
                    onChange={handleContractChange}
                    className="form-control-modern"
                  />
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Ngày bắt đầu <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    type="date"
                    name="start_date"
                    value={contractData.start_date}
                    onChange={handleContractChange}
                    className="form-control-modern"
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Ngày kết thúc</Form.Label>
                  <Form.Control
                    type="date"
                    name="end_date"
                    value={contractData.end_date}
                    onChange={handleContractChange}
                    className="form-control-modern"
                  />
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Lương</Form.Label>
                  <div className="position-relative">
                    <Form.Control
                      type="text"
                      name="salary"
                      value={contractData.salary ? formatNumberInput(contractData.salary) : ''}
                      onChange={handleContractChange}
                      className="form-control-modern"
                      placeholder="0"
                      style={{ paddingRight: '60px' }}
                    />
                    <span 
                      className="position-absolute"
                      style={{
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#6c757d',
                        pointerEvents: 'none'
                      }}
                    >
                      VNĐ
                    </span>
                  </div>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Ngày ký</Form.Label>
                  <Form.Control
                    type="date"
                    name="signed_date"
                    value={contractData.signed_date}
                    onChange={handleContractChange}
                    className="form-control-modern"
                  />
                </Form.Group>
              </Col>
            </Row>
            <Form.Group className="mb-3">
              <Form.Label>Phúc lợi</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                name="benefits"
                value={contractData.benefits}
                onChange={handleContractChange}
                className="form-control-modern"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Điều khoản</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                name="terms"
                value={contractData.terms}
                onChange={handleContractChange}
                className="form-control-modern"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Trạng thái</Form.Label>
              <Form.Select
                name="status"
                value={contractData.status}
                onChange={handleContractChange}
                className="form-control-modern"
              >
                <option value="draft">Bản nháp</option>
                <option value="active">Đang hiệu lực</option>
                <option value="expired">Đã hết hạn</option>
                <option value="terminated">Đã chấm dứt</option>
                <option value="renewed">Đã gia hạn</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Ghi chú</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                name="notes"
                value={contractData.notes}
                onChange={handleContractChange}
                className="form-control-modern"
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => {
            setShowContractModal(false);
            setEditingItem(null);
          }}>
            Hủy
          </Button>
          <Button variant="primary" onClick={handleSaveContract}>
            {editingItem ? 'Cập nhật' : 'Thêm'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Work History Modal */}
      <Modal show={showWorkHistoryModal} onHide={() => {
        setShowWorkHistoryModal(false);
        setEditingItem(null);
      }} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{editingItem ? 'Chỉnh sửa lịch sử làm việc' : 'Thêm lịch sử làm việc'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Tổ chức <span className="text-danger">*</span></Form.Label>
              <Form.Control
                type="text"
                name="organization"
                value={workHistoryData.organization}
                onChange={handleWorkHistoryChange}
                className="form-control-modern"
                required
              />
            </Form.Group>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Chức danh</Form.Label>
                  <Form.Control
                    type="text"
                    name="position"
                    value={workHistoryData.position}
                    onChange={handleWorkHistoryChange}
                    className="form-control-modern"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Phòng ban</Form.Label>
                  <Form.Control
                    type="text"
                    name="department"
                    value={workHistoryData.department}
                    onChange={handleWorkHistoryChange}
                    className="form-control-modern"
                  />
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Từ ngày <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    type="date"
                    name="start_date"
                    value={workHistoryData.start_date}
                    onChange={handleWorkHistoryChange}
                    className="form-control-modern"
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Đến ngày</Form.Label>
                  <Form.Control
                    type="date"
                    name="end_date"
                    value={workHistoryData.end_date}
                    onChange={handleWorkHistoryChange}
                    className="form-control-modern"
                  />
                </Form.Group>
              </Col>
            </Row>
            <Form.Group className="mb-3">
              <Form.Label>Mô tả</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                name="description"
                value={workHistoryData.description}
                onChange={handleWorkHistoryChange}
                className="form-control-modern"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Thành tích</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                name="achievements"
                value={workHistoryData.achievements}
                onChange={handleWorkHistoryChange}
                className="form-control-modern"
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => {
            setShowWorkHistoryModal(false);
            setEditingItem(null);
          }}>
            Hủy
          </Button>
          <Button variant="primary" onClick={handleSaveWorkHistory}>
            {editingItem ? 'Cập nhật' : 'Thêm'}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default PersonalProfile;
