import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Button, Form, Modal, Badge, Spinner, Alert, Table } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import Pagination from '../../components/Pagination';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Profiles = () => {
  usePageTitle('Hồ sơ nhân sự');
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [profiles, setProfiles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [jobTitles, setJobTitles] = useState([]);
  const [filters, setFilters] = useState({
    search: '',
    department: 'all',
    position: 'all',
    employment_status: 'all',
    contract_type: 'all'
  });
  const [sortBy, setSortBy] = useState('full_name');
  const [sortOrder, setSortOrder] = useState('ASC');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    totalItems: 0,
    totalPages: 0
  });
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [profileDetail, setProfileDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    employee_code: '',
    position: '',
    department: '',
    title: '',
    specialization: '',
    education_level: '',
    degree: '',
    university: '',
    graduation_year: '',
    work_experience: 0,
    start_date: '',
    contract_type: 'full_time',
    contract_start_date: '',
    contract_end_date: '',
    employment_status: 'active',
    salary: '',
    base_salary: '',
    notes: ''
  });

  // Fetch profiles
  const fetchProfiles = async () => {
    try {
      setLoading(true);
      setError('');

      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        search: filters.search,
        department: filters.department,
        position: filters.position,
        employment_status: filters.employment_status,
        contract_type: filters.contract_type,
        sortBy: sortBy,
        sortOrder: sortOrder
      });

      const response = await api.get(`/hr-profiles/staff?${params}`);

      if (response.data.success) {
        setProfiles(response.data.data);
        setPagination(response.data.pagination);
      }
    } catch (err) {
      console.error('Error fetching profiles:', err);
      setError('Không thể tải danh sách hồ sơ nhân sự');
    } finally {
      setLoading(false);
    }
  };

  // Fetch departments, positions and job titles
  const fetchDepartmentsAndPositions = async () => {
    try {
      const [deptResponse, posResponse, jobTitlesResponse] = await Promise.all([
        api.get('/hr-profiles/departments'),
        api.get('/hr-profiles/positions'),
        api.get('/hr-profiles/job-titles')
      ]);

      if (deptResponse.data.success) {
        setDepartments(deptResponse.data.data);
      }

      if (posResponse.data.success) {
        setPositions(posResponse.data.data);
      }

      if (jobTitlesResponse.data.success) {
        setJobTitles(jobTitlesResponse.data.data);
      }
    } catch (err) {
      console.error('Error fetching departments/positions/job-titles:', err);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchProfiles();
      fetchDepartmentsAndPositions();
    }
  }, [currentUser, filters, sortBy, sortOrder, pagination.page]);

  // Handle filter change
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Handle sort change
  const handleSortChange = (e) => {
    const [field, order] = e.target.value.split('_');
    setSortBy(field);
    setSortOrder(order);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Clear filters
  const handleClearFilters = () => {
    setFilters({
      search: '',
      department: 'all',
      position: 'all',
      employment_status: 'all',
      contract_type: 'all'
    });
    setSortBy('full_name');
    setSortOrder('ASC');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // View profile detail
  const handleViewProfile = async (userId) => {
    try {
      setLoadingDetail(true);
      setError('');

      const response = await api.get(`/hr-profiles/staff/${userId}`);

      if (response.data.success) {
        setProfileDetail(response.data.data);
        setSelectedProfile(userId);
        setShowProfileModal(true);
      }
    } catch (err) {
      console.error('Error fetching profile detail:', err);
      setError('Không thể tải chi tiết hồ sơ');
    } finally {
      setLoadingDetail(false);
    }
  };

  // Open edit modal
  const handleEditProfile = async (profile) => {
    const userId = profile.user_id || profile.id || profile.user?.id;
    
    if (!userId) {
      console.error('Cannot edit profile: user_id or id is missing', profile);
      setError('Không thể chỉnh sửa: thiếu thông tin user_id');
      return;
    }
    
    setSelectedProfile(userId);
    
    // Fetch full profile data to ensure all fields are loaded
    try {
      const response = await api.get(`/hr-profiles/staff/${userId}`);
      if (response.data.success && response.data.data.profile) {
        const fullProfile = response.data.data.profile;
        // Ensure salary is properly formatted for display
        let salaryValue = fullProfile.salary || '';
        if (salaryValue) {
          const numSalary = parseFloat(salaryValue) || 0;
          salaryValue = numSalary.toString();
        }
        
        setEditFormData({
          employee_code: fullProfile.employee_code || '',
          position: fullProfile.position || '',
          department: fullProfile.department || '',
          title: fullProfile.title || '',
          specialization: fullProfile.specialization || '',
          education_level: fullProfile.education_level || '',
          degree: fullProfile.degree || '',
          university: fullProfile.university || '',
          graduation_year: fullProfile.graduation_year || '',
          work_experience: fullProfile.work_experience || 0,
          start_date: fullProfile.start_date ? fullProfile.start_date.split('T')[0] : '',
          contract_type: fullProfile.contract_type || 'full_time',
          contract_start_date: fullProfile.contract_start_date ? fullProfile.contract_start_date.split('T')[0] : '',
          contract_end_date: fullProfile.contract_end_date ? fullProfile.contract_end_date.split('T')[0] : '',
          employment_status: fullProfile.employment_status || 'active',
          salary: salaryValue,
          base_salary: fullProfile.base_salary ? (() => {
            const numBaseSalary = parseFloat(fullProfile.base_salary) || 0;
            return numBaseSalary.toString();
          })() : '',
          notes: fullProfile.notes || ''
        });
      } else {
        // Fallback to profile data from list if API fails
        // Ensure salary is properly formatted for display
        let salaryValue = profile.salary || '';
        if (salaryValue) {
          const numSalary = parseFloat(salaryValue) || 0;
          salaryValue = numSalary.toString();
        }
        
        setEditFormData({
          employee_code: profile.employee_code || '',
          position: profile.position || '',
          department: profile.department || '',
          title: profile.title || '',
          specialization: profile.specialization || '',
          education_level: profile.education_level || '',
          degree: profile.degree || '',
          university: profile.university || '',
          graduation_year: profile.graduation_year || '',
          work_experience: profile.work_experience || 0,
          start_date: profile.start_date ? profile.start_date.split('T')[0] : '',
          contract_type: profile.contract_type || 'full_time',
          contract_start_date: profile.contract_start_date ? profile.contract_start_date.split('T')[0] : '',
          contract_end_date: profile.contract_end_date ? profile.contract_end_date.split('T')[0] : '',
          employment_status: profile.employment_status || 'active',
          salary: salaryValue,
          base_salary: profile.base_salary ? (() => {
            const numBaseSalary = parseFloat(profile.base_salary) || 0;
            return numBaseSalary.toString();
          })() : '',
          notes: profile.notes || ''
        });
      }
    } catch (err) {
      console.error('Error fetching profile for edit:', err);
      // Fallback to profile data from list
      // Ensure salary is properly formatted for display
      let salaryValue = profile.salary || '';
      if (salaryValue) {
        const numSalary = parseFloat(salaryValue) || 0;
        salaryValue = numSalary.toString();
      }
      
      setEditFormData({
        employee_code: profile.employee_code || '',
        position: profile.position || '',
        department: profile.department || '',
        title: profile.title || '',
        specialization: profile.specialization || '',
        education_level: profile.education_level || '',
        degree: profile.degree || '',
        university: profile.university || '',
        graduation_year: profile.graduation_year || '',
        work_experience: profile.work_experience || 0,
        start_date: profile.start_date ? profile.start_date.split('T')[0] : '',
        contract_type: profile.contract_type || 'full_time',
        contract_start_date: profile.contract_start_date ? profile.contract_start_date.split('T')[0] : '',
        contract_end_date: profile.contract_end_date ? profile.contract_end_date.split('T')[0] : '',
        employment_status: profile.employment_status || 'active',
        salary: salaryValue,
        notes: profile.notes || ''
      });
    }
    
    setShowEditModal(true);
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

  // Handle edit form change
  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    
    // Special handling for salary and base_salary fields - format with dots for display
    if (name === 'salary' || name === 'base_salary') {
      const numericValue = parseNumberInput(value);
      setEditFormData(prev => ({
        ...prev,
        [name]: numericValue || ''
      }));
      return;
    }
    
    setEditFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Save profile
  const handleSaveProfile = async () => {
    try {
      // Parse salary and base_salary - remove dots if it's a string
      const submitData = {
        ...editFormData,
        salary: editFormData.salary ? (typeof editFormData.salary === 'string' ? parseFloat(parseNumberInput(editFormData.salary)) || 0 : parseFloat(editFormData.salary) || 0) : 0,
        base_salary: editFormData.base_salary ? (typeof editFormData.base_salary === 'string' ? parseFloat(parseNumberInput(editFormData.base_salary)) || 0 : parseFloat(editFormData.base_salary) || 0) : null
      };
      
      const response = await api.put(`/hr-profiles/staff/${selectedProfile}`, submitData);

      if (response.data.success) {
        setSuccess('Cập nhật hồ sơ nhân sự thành công');
        setShowEditModal(false);
        fetchProfiles();
        if (showProfileModal && selectedProfile) {
          handleViewProfile(selectedProfile); // Refresh profile detail
        }
      }
    } catch (err) {
      console.error('Error saving profile:', err);
      setError(err.response?.data?.message || 'Không thể cập nhật hồ sơ');
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('vi-VN');
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

  // Get employment status color
  const getEmploymentStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'probation': return 'warning';
      case 'on_leave': return 'info';
      case 'terminated': return 'danger';
      case 'retired': return 'secondary';
      default: return 'secondary';
    }
  };

  // Get contract type label
  const getContractTypeLabel = (type) => {
    switch (type) {
      case 'full_time': return 'Toàn thời gian';
      case 'part_time': return 'Bán thời gian';
      case 'contract': return 'Hợp đồng';
      case 'temporary': return 'Tạm thời';
      default: return type;
    }
  };

  // Navigate to personal profile
  const handleNavigateToProfile = (userId) => {
    navigate(`/personal/profile?userId=${userId}`);
  };

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
            <h1>Hồ sơ nhân sự</h1>
            <p className="header-subtitle">Quản lý hồ sơ, chứng chỉ hành nghề, sức khỏe, hợp đồng</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="session1-list-controls mb-4">
        <div className="search1-controls">
          <Row className="g-2">
            <Col md={3}>
              <div className="mb-3">
                <Form.Label>Tìm kiếm</Form.Label>
                <input
                  type="text"
                  className="search-input"
                  placeholder="Tìm theo tên, mã NV, email..."
                  name="search"
                  value={filters.search}
                  onChange={handleFilterChange}
                />
              </div>
            </Col>
            <Col md={2}>
              <div className="mb-3">
                <Form.Label>Khoa/Phòng ban</Form.Label>
                <select
                  className="filter-select"
                  name="department"
                  value={filters.department}
                  onChange={handleFilterChange}
                >
                  <option value="all">Tất cả</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
            </Col>
            <Col md={2}>
              <div className="mb-3">
                <Form.Label>Chức danh</Form.Label>
                <select
                  className="filter-select"
                  name="position"
                  value={filters.position}
                  onChange={handleFilterChange}
                >
                  <option value="all">Tất cả</option>
                  {positions.map(pos => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                </select>
              </div>
            </Col>
            <Col md={2}>
              <div className="mb-3">
                <Form.Label>Trạng thái</Form.Label>
                <select
                  className="filter-select"
                  name="employment_status"
                  value={filters.employment_status}
                  onChange={handleFilterChange}
                >
                  <option value="all">Tất cả</option>
                  <option value="active">Đang làm việc</option>
                  <option value="probation">Thử việc</option>
                  <option value="on_leave">Nghỉ phép</option>
                  <option value="terminated">Đã nghỉ việc</option>
                  <option value="retired">Đã nghỉ hưu</option>
                </select>
              </div>
            </Col>
            <Col md={2}>
              <div className="mb-3">
                <Form.Label>Loại hợp đồng</Form.Label>
                <select
                  className="filter-select"
                  name="contract_type"
                  value={filters.contract_type}
                  onChange={handleFilterChange}
                >
                  <option value="all">Tất cả</option>
                  <option value="full_time">Toàn thời gian</option>
                  <option value="part_time">Bán thời gian</option>
                  <option value="contract">Hợp đồng</option>
                  <option value="temporary">Tạm thời</option>
                </select>
              </div>
            </Col>
            <Col md={1}>
              <div className="d-flex justify-content-end align-items-center mb-3">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={handleClearFilters}
                >
                  <i className="fas fa-times me-1"></i>
                  Xóa bộ lọc
                </Button>
              </div>
            </Col>
          </Row>
          <Row className="g-2">
            <Col md={2}>
              <div className="mb-3">
                <Form.Label>Sắp xếp</Form.Label>
                <select
                  className="filter-select"
                  value={`${sortBy}_${sortOrder}`}
                  onChange={handleSortChange}
                >
                  <option value="full_name_ASC">Họ tên (A-Z)</option>
                  <option value="full_name_DESC">Họ tên (Z-A)</option>
                  <option value="employee_code_ASC">Mã NV (Tăng dần)</option>
                  <option value="employee_code_DESC">Mã NV (Giảm dần)</option>
                  <option value="department_ASC">Khoa (A-Z)</option>
                  <option value="department_DESC">Khoa (Z-A)</option>
                  <option value="created_at_DESC">Mới nhất</option>
                  <option value="created_at_ASC">Cũ nhất</option>
                </select>
              </div>
            </Col>
          </Row>
        </div>
      </div>

      {/* Profiles Table */}
      <div className="session-table-container">
        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" />
            <p className="mt-3">Đang tải danh sách hồ sơ...</p>
          </div>
        ) : profiles.length === 0 ? (
          <div className="text-center py-5">
            <i className="fas fa-users fa-4x text-muted mb-3"></i>
            <h5>Chưa có hồ sơ nhân sự nào</h5>
            <p className="text-muted">Không tìm thấy hồ sơ nhân sự phù hợp với bộ lọc</p>
          </div>
        ) : (
          <>
            <div className="table-responsive-mobile">
              <table className="session-table">
                <thead>
                  <tr>
                    <th>Mã NV</th>
                    <th>Họ và tên</th>
                    <th>Chức danh</th>
                    <th>Khoa/Phòng ban</th>
                    <th>Chứng chỉ HN</th>
                    <th>Hợp đồng</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map(profile => {
                    const certificateStatus = profile.expiring_certificates > 0 
                      ? { label: `Sắp hết (${profile.expiring_certificates})`, color: 'warning' }
                      : profile.valid_certificates > 0
                      ? { label: `Còn hạn (${profile.valid_certificates})`, color: 'success' }
                      : { label: 'Không có', color: 'secondary' };

                    return (
                      <tr 
                        key={profile.id || profile.user_id}
                        onClick={() => handleViewProfile(profile.id || profile.user_id)}
                        style={{ cursor: 'pointer' }}
                        className="table-row-clickable"
                      >
                        <td>{profile.employee_code || 'N/A'}</td>
                        <td>
                          <span className="text-primary">
                            {profile.full_name || 'N/A'}
                          </span>
                        </td>
                        <td>{profile.position || 'N/A'}</td>
                        <td>{profile.department || 'N/A'}</td>
                        <td>
                          <Badge bg={certificateStatus.color}>
                            {certificateStatus.label}
                          </Badge>
                        </td>
                        <td>
                          {profile.active_contracts > 0 ? (
                            <Badge bg="success">Có ({profile.active_contracts})</Badge>
                          ) : (
                            <Badge bg="secondary">Không có</Badge>
                          )}
                        </td>
                        <td>
                          <Badge bg={getEmploymentStatusColor(profile.employment_status || 'active')}>
                            {getEmploymentStatusLabel(profile.employment_status || 'active')}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="mt-3">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  onPageChange={(page) => setPagination(prev => ({ ...prev, page }))}
                  maxVisiblePages={5}
                  showFirstLast={true}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Profile Detail Modal */}
      <Modal show={showProfileModal} onHide={() => setShowProfileModal(false)} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>Chi tiết hồ sơ nhân sự</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadingDetail ? (
            <div className="text-center py-5">
              <Spinner animation="border" />
              <p className="mt-3">Đang tải thông tin...</p>
            </div>
          ) : profileDetail ? (
            <div>
              <Row className="g-3 mb-4">
                <Col md={6}>
                  <div className="session-card">
                    <div className="card-header-modern">
                      <div className="header-icon">
                        <i className="fas fa-user"></i>
                      </div>
                      <h6 className="mb-0">Thông tin cơ bản</h6>
                    </div>
                    <div className="card-body-modern">
                      <div className="info-item-inline">
                        <div className="info-label">Họ và tên:</div>
                        <div className="info-value">{profileDetail.user?.full_name || 'N/A'}</div>
                      </div>
                      <div className="info-item-inline">
                        <div className="info-label">Email:</div>
                        <div className="info-value">{profileDetail.user?.email || 'N/A'}</div>
                      </div>
                      <div className="info-item-inline">
                        <div className="info-label">Điện thoại:</div>
                        <div className="info-value">{profileDetail.user?.phone || 'N/A'}</div>
                      </div>
                      <div className="info-item-inline">
                        <div className="info-label">Mã nhân viên:</div>
                        <div className="info-value">{profileDetail.profile?.employee_code || 'N/A'}</div>
                      </div>
                      <div className="info-item-inline">
                        <div className="info-label">Chức danh:</div>
                        <div className="info-value">{profileDetail.profile?.position || 'N/A'}</div>
                      </div>
                      <div className="info-item-inline">
                        <div className="info-label">Khoa/Phòng ban:</div>
                        <div className="info-value">{profileDetail.profile?.department || 'N/A'}</div>
                      </div>
                    </div>
                  </div>
                </Col>
                <Col md={6}>
                  <div className="session-card">
                    <div className="card-header-modern">
                      <div className="header-icon">
                        <i className="fas fa-id-card"></i>
                      </div>
                      <h6 className="mb-0">Thông tin nhân sự</h6>
                    </div>
                    <div className="card-body-modern">
                      <div className="info-item-inline">
                        <div className="info-label">Trạng thái:</div>
                        <div className="info-value">
                          <Badge bg={getEmploymentStatusColor(profileDetail.profile?.employment_status || 'active')}>
                            {getEmploymentStatusLabel(profileDetail.profile?.employment_status || 'active')}
                          </Badge>
                        </div>
                      </div>
                      <div className="info-item-inline">
                        <div className="info-label">Loại hợp đồng:</div>
                        <div className="info-value">{profileDetail.profile?.contract_type ? getContractTypeLabel(profileDetail.profile.contract_type) : 'N/A'}</div>
                      </div>
                      <div className="info-item-inline">
                        <div className="info-label">Ngày bắt đầu làm việc:</div>
                        <div className="info-value">{profileDetail.profile?.start_date ? formatDate(profileDetail.profile.start_date) : 'N/A'}</div>
                      </div>
                      <div className="info-item-inline">
                        <div className="info-label">Kinh nghiệm:</div>
                        <div className="info-value">{profileDetail.profile?.work_experience ? `${profileDetail.profile.work_experience} năm` : 'N/A'}</div>
                      </div>
                      <div className="info-item-inline">
                        <div className="info-label">Chứng chỉ:</div>
                        <div className="info-value">
                          <Badge bg="info">{profileDetail.certificates?.length || 0} chứng chỉ</Badge>
                        </div>
                      </div>
                      <div className="info-item-inline">
                        <div className="info-label">Hợp đồng:</div>
                        <div className="info-value">
                          <Badge bg="info">{profileDetail.contracts?.length || 0} hợp đồng</Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </Col>
              </Row>

              {/* Certificates */}
              {profileDetail.certificates && profileDetail.certificates.length > 0 && (
                <div className="session-card mb-3">
                  <div className="card-header-modern">
                    <div className="header-icon">
                      <i className="fas fa-certificate"></i>
                    </div>
                    <h6 className="mb-0">Chứng chỉ hành nghề</h6>
                  </div>
                  <div className="card-body-modern">
                    <div className="row g-3">
                      {profileDetail.certificates.map(cert => (
                        <Col md={6} key={cert.id}>
                          <div className="border rounded p-3">
                            <h6>{cert.certificate_name}</h6>
                            <small className="text-muted">
                              {cert.issuing_organization} - {cert.expiry_date ? formatDate(cert.expiry_date) : 'Không có hạn'}
                            </small>
                          </div>
                        </Col>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Contracts */}
              {profileDetail.contracts && profileDetail.contracts.length > 0 && (
                <div className="session-card mb-3">
                  <div className="card-header-modern">
                    <div className="header-icon">
                      <i className="fas fa-file-contract"></i>
                    </div>
                    <h6 className="mb-0">Hợp đồng lao động</h6>
                  </div>
                  <div className="card-body-modern">
                    <div className="row g-3">
                      {profileDetail.contracts.map(contract => (
                        <Col md={6} key={contract.id}>
                          <div className="border rounded p-3">
                            <h6>{contract.contract_number || 'Hợp đồng'}</h6>
                            <small className="text-muted">
                              {getContractTypeLabel(contract.contract_type)} - {formatDate(contract.start_date)}
                              {contract.end_date && ` đến ${formatDate(contract.end_date)}`}
                            </small>
                          </div>
                        </Col>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-5">
              <p className="text-muted">Không tìm thấy thông tin hồ sơ</p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowProfileModal(false)}>
            Đóng
          </Button>
          {profileDetail && (
            <Button variant="primary" onClick={() => {
              setShowProfileModal(false);
              // Get user_id from profileDetail structure
              const profileToEdit = profileDetail.profile || profileDetail;
              const userId = profileToEdit.user_id || profileDetail.user_id || profileDetail.user?.id || profileToEdit.id;
              if (userId) {
                handleEditProfile({ ...profileToEdit, user_id: userId, id: userId });
              } else {
                setError('Không thể chỉnh sửa: thiếu thông tin user_id');
              }
            }}>
              <i className="fas fa-edit me-2"></i>
              Chỉnh sửa
            </Button>
          )}
        </Modal.Footer>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Chỉnh sửa hồ sơ nhân sự</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Mã nhân viên</Form.Label>
                  <Form.Control
                    type="text"
                    name="employee_code"
                    value={editFormData.employee_code}
                    onChange={handleEditFormChange}
                    className="form-control-modern"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Chức danh</Form.Label>
                  <Form.Control
                    type="text"
                    name="position"
                    value={editFormData.position}
                    onChange={handleEditFormChange}
                    className="form-control-modern"
                  />
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Khoa/Phòng ban</Form.Label>
                  <Form.Control
                    type="text"
                    name="department"
                    value={editFormData.department}
                    onChange={handleEditFormChange}
                    className="form-control-modern"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Chức vụ</Form.Label>
                  <Form.Select
                    name="title"
                    value={editFormData.title}
                    onChange={handleEditFormChange}
                    className="form-control-modern"
                  >
                    <option value="">-- Chọn chức vụ --</option>
                    {jobTitles.map((jobTitle, index) => (
                      <option key={index} value={jobTitle}>
                        {jobTitle}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Trình độ học vấn</Form.Label>
                  <Form.Control
                    type="text"
                    name="education_level"
                    value={editFormData.education_level}
                    onChange={handleEditFormChange}
                    className="form-control-modern"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Bằng cấp</Form.Label>
                  <Form.Control
                    type="text"
                    name="degree"
                    value={editFormData.degree}
                    onChange={handleEditFormChange}
                    className="form-control-modern"
                  />
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Trường đại học</Form.Label>
                  <Form.Control
                    type="text"
                    name="university"
                    value={editFormData.university}
                    onChange={handleEditFormChange}
                    className="form-control-modern"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Năm tốt nghiệp</Form.Label>
                  <Form.Control
                    type="number"
                    name="graduation_year"
                    value={editFormData.graduation_year}
                    onChange={handleEditFormChange}
                    className="form-control-modern"
                  />
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Kinh nghiệm làm việc (năm)</Form.Label>
                  <Form.Control
                    type="number"
                    name="work_experience"
                    value={editFormData.work_experience}
                    onChange={handleEditFormChange}
                    className="form-control-modern"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Ngày bắt đầu làm việc</Form.Label>
                  <Form.Control
                    type="date"
                    name="start_date"
                    value={editFormData.start_date}
                    onChange={handleEditFormChange}
                    className="form-control-modern"
                  />
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Loại hợp đồng</Form.Label>
                  <Form.Select
                    name="contract_type"
                    value={editFormData.contract_type}
                    onChange={handleEditFormChange}
                    className="form-control-modern"
                  >
                    <option value="full_time">Toàn thời gian</option>
                    <option value="part_time">Bán thời gian</option>
                    <option value="contract">Hợp đồng</option>
                    <option value="temporary">Tạm thời</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Ngày bắt đầu hợp đồng</Form.Label>
                  <Form.Control
                    type="date"
                    name="contract_start_date"
                    value={editFormData.contract_start_date}
                    onChange={handleEditFormChange}
                    className="form-control-modern"
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Ngày kết thúc hợp đồng</Form.Label>
                  <Form.Control
                    type="date"
                    name="contract_end_date"
                    value={editFormData.contract_end_date}
                    onChange={handleEditFormChange}
                    className="form-control-modern"
                  />
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Trạng thái</Form.Label>
                  <Form.Select
                    name="employment_status"
                    value={editFormData.employment_status}
                    onChange={handleEditFormChange}
                    className="form-control-modern"
                  >
                    <option value="active">Đang làm việc</option>
                    <option value="probation">Thử việc</option>
                    <option value="on_leave">Nghỉ phép</option>
                    <option value="terminated">Đã nghỉ việc</option>
                    <option value="retired">Đã nghỉ hưu</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Lương thỏa thuận (HĐ)</Form.Label>
                  <div className="position-relative">
                    <Form.Control
                      type="text"
                      name="salary"
                      value={editFormData.salary ? formatNumberInput(editFormData.salary) : ''}
                      onChange={handleEditFormChange}
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
                  <Form.Label>Lương cơ bản</Form.Label>
                  <div className="position-relative">
                    <Form.Control
                      type="text"
                      name="base_salary"
                      value={editFormData.base_salary ? formatNumberInput(editFormData.base_salary) : ''}
                      onChange={handleEditFormChange}
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
            </Row>
            <Form.Group className="mb-3">
              <Form.Label>Chuyên môn</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                name="specialization"
                value={editFormData.specialization}
                onChange={handleEditFormChange}
                className="form-control-modern"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Ghi chú</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                name="notes"
                value={editFormData.notes}
                onChange={handleEditFormChange}
                className="form-control-modern"
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEditModal(false)}>
            Hủy
          </Button>
          <Button variant="primary" onClick={handleSaveProfile}>
            Lưu
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default Profiles;
