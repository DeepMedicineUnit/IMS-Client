import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Button, Form, Badge, Spinner, Alert } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import Pagination from '../../components/Pagination';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const TimeAttendance = () => {
  usePageTitle('Chấm công');
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({
    search: '',
    userId: '',
    startDate: '',
    endDate: '',
    statusCode: '',
    department: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    totalItems: 0,
    totalPages: 0
  });

  // Status code mapping
  const statusCodeMap = {
    'X': 'Làm offline',
    'O': 'Làm online',
    'CNX': 'Làm offline CN',
    'LX': 'Làm offline Lễ',
    'LO': 'Làm online Lễ',
    'CNO': 'Làm online CN',
    'CT': 'Công tác',
    'XP': 'Nửa ngày',
    'P': 'Nghỉ phép',
    'L': 'Nghỉ lễ',
    'NO': 'Nghỉ ốm',
    'KL': 'Nghỉ không lương',
    'CP': 'Thiếu giờ ra hoặc giờ vào',
    'XNC': 'Dữ liệu công thiếu cần xác nhận công',
    'ML': 'Nghỉ cưới'
  };

  // Fetch departments
  const fetchDepartments = async () => {
    try {
      const response = await api.get('/hr-profiles/departments');
      if (response.data.success) {
        setDepartments(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching departments:', err);
    }
  };

  // Fetch users
  const fetchUsers = async () => {
    try {
      const response = await api.get('/hr-profiles/staff?limit=999999');
      if (response.data.success) {
        setUsers(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  // Fetch attendance records
  const fetchAttendanceRecords = async () => {
    try {
      setLoading(true);
      setError('');

      const params = new URLSearchParams();
      params.append('page', pagination.page);
      params.append('limit', pagination.limit);
      if (filters.search) params.append('search', filters.search);
      if (filters.userId) params.append('userId', filters.userId);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.statusCode) params.append('statusCode', filters.statusCode);
      if (filters.department) params.append('department', filters.department);

      const response = await api.get(`/employee-attendance/all?${params}`);
      if (response.data.success) {
        setAttendanceRecords(response.data.data);
        setPagination(prev => ({
          ...prev,
          totalItems: response.data.pagination.totalItems,
          totalPages: response.data.pagination.totalPages
        }));
      }
    } catch (err) {
      console.error('Error fetching attendance records:', err);
      setError(err.response?.data?.message || 'Không thể tải dữ liệu chấm công');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchDepartments();
      fetchUsers();
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      fetchAttendanceRecords();
    }
  }, [currentUser, pagination.page, filters]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleClearFilters = () => {
    setFilters({
      search: '',
      userId: '',
      startDate: '',
      endDate: '',
      statusCode: '',
      department: ''
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const formatDateTime = (dateTime) => {
    if (!dateTime) return '-';
    const date = new Date(dateTime);
    return date.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (date) => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('vi-VN');
  };

  const formatTime = (time) => {
    if (!time) return '-';
    try {
      // Handle timestamp or datetime string
      let date;
      if (typeof time === 'string') {
        // If it's already in HH:mm or HH:mm:ss format, return it
        const timeMatch = time.match(/^(\d{2}:\d{2})(:\d{2})?$/);
        if (timeMatch) {
          return timeMatch[1]; // Return HH:mm
        }
        // Try to parse as date
        date = new Date(time);
      } else {
        date = new Date(time);
      }
      
      if (isNaN(date.getTime())) {
        // If not a valid date, return original value
        return time;
      }
      
      // Format as HH:mm (24-hour format)
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    } catch (err) {
      console.error('Error formatting time:', err, time);
      return time;
    }
  };

  const getStatusBadgeColor = (statusCode) => {
    if (!statusCode) return 'secondary';
    const code = statusCode.toUpperCase();
    if (['X', 'O', 'CNX', 'LX', 'LO', 'CNO', 'CT'].includes(code)) return 'success';
    if (['XP', 'P', 'L', 'NO', 'ML'].includes(code)) return 'warning';
    if (['KL', 'CP', 'XNC'].includes(code)) return 'danger';
    return 'secondary';
  };

  return (
    <Container fluid className="session-main-container">
      {error && (
        <Alert variant="danger" className="mb-3" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Header */}
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Chấm công</h1>
            <p className="header-subtitle">Theo dõi ca trực, nghỉ phép, đồng bộ Payroll</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="session-list-controls mb-4">
        <div className="search-controls">
          <Row className="g-2">
            <Col md={3}>
              <div className="mb-3">
                <Form.Label>Tìm kiếm</Form.Label>
                <Form.Control
                  type="text"
                  name="search"
                  value={filters.search}
                  onChange={handleFilterChange}
                  placeholder="Tên, email, mã NV..."
                />
              </div>
            </Col>
            <Col md={2}>
              <div className="mb-3">
                <Form.Label>Nhân viên</Form.Label>
                <Form.Select
                  name="userId"
                  value={filters.userId}
                  onChange={handleFilterChange}
                >
                  <option value="">Tất cả</option>
                  {users.map(user => (
                    <option key={user.id || user.user_id} value={user.id || user.user_id}>
                      {user.full_name}
                    </option>
                  ))}
                </Form.Select>
              </div>
            </Col>
            <Col md={2}>
              <div className="mb-3">
                <Form.Label>Phòng ban</Form.Label>
                <Form.Select
                  name="department"
                  value={filters.department}
                  onChange={handleFilterChange}
                >
                  <option value="">Tất cả</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </Form.Select>
              </div>
            </Col>
            <Col md={2}>
              <div className="mb-3">
                <Form.Label>Trạng thái</Form.Label>
                <Form.Select
                  name="statusCode"
                  value={filters.statusCode}
                  onChange={handleFilterChange}
                >
                  <option value="">Tất cả</option>
                  {Object.entries(statusCodeMap).map(([code, label]) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </Form.Select>
              </div>
            </Col>
            <Col md={3}>
              <div className="mb-3">
                <Form.Label>Từ ngày</Form.Label>
                <Form.Control
                  type="date"
                  name="startDate"
                  value={filters.startDate}
                  onChange={handleFilterChange}
                />
              </div>
            </Col>
            <Col md={3}>
              <div className="mb-3">
                <Form.Label>Đến ngày</Form.Label>
                <Form.Control
                  type="date"
                  name="endDate"
                  value={filters.endDate}
                  onChange={handleFilterChange}
                />
              </div>
            </Col>
            <Col md={2}>
              <div className="mb-3">
                <Form.Label>&nbsp;</Form.Label>
                <Button
                  variant="outline-secondary"
                  className="w-100"
                  onClick={handleClearFilters}
                >
                  Xóa bộ lọc
                </Button>
              </div>
            </Col>
          </Row>
        </div>
      </div>

      {/* Table */}
      <div className="session-table-container">
        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" />
            <p className="mt-3">Đang tải dữ liệu...</p>
          </div>
        ) : attendanceRecords.length === 0 ? (
          <div className="text-center py-5">
            <i className="fas fa-calendar-check fa-4x text-muted mb-3"></i>
            <h5>Chưa có dữ liệu chấm công</h5>
          </div>
        ) : (
          <>
            <div className="table-responsive-mobile">
              <table className="session-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nhân viên</th>
                    <th>Ngày</th>
                    <th>In</th>
                    <th>Out</th>
                    <th>Tổng</th>
                    <th>Trạng thái</th>
                    <th>Ghi chú</th>
                    <th>In IP</th>
                    <th>Out IP</th>
                    <th>In Location</th>
                    <th>Out Location</th>
                    <th>In D</th>
                    <th>Out D</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceRecords.map(record => (
                    <tr key={record.id}>
                      <td>{record.id}</td>
                      <td>
                        <div>
                          <strong>{record.full_name || '-'}</strong>
                          {record.employee_code && (
                            <div className="text-muted small">{record.employee_code}</div>
                          )}
                        </div>
                      </td>
                      <td>{formatDate(record.work_date)}</td>
                      <td>{formatTime(record.check_in_time)}</td>
                      <td>{formatTime(record.check_out_time)}</td>
                      <td>{record.total_hours || '-'}</td>
                      <td>
                        {record.status_code ? (
                          <Badge bg={getStatusBadgeColor(record.status_code)}>
                            {statusCodeMap[record.status_code] || record.status_code}
                          </Badge>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>{record.status_note || '-'}</td>
                      <td className="small">{record.check_in_ip || '-'}</td>
                      <td className="small">{record.check_out_ip || '-'}</td>
                      <td className="small">
                        {record.check_in_location_lat ? `${record.check_in_location_lat}, ${record.check_in_location_lng || ''}` : '-'}
                      </td>
                      <td className="small">
                        {record.check_out_location_lat ? `${record.check_out_location_lat}, ${record.check_out_location_lng || ''}` : '-'}
                      </td>
                      <td className="small">{record.check_in_device_type || '-'}</td>
                      <td className="small">{record.check_out_device_type || '-'}</td>
                    </tr>
                  ))}
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
    </Container>
  );
};

export default TimeAttendance;
