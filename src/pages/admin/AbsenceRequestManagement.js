import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Form, Alert, Container, Row, Col, Modal, Badge, Table, Spinner } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import '../../styles/calendar.css';
import * as XLSX from 'xlsx';

const AbsenceRequestManagement = () => {
  const { api } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [requests, setRequests] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });
  const [filters, setFilters] = useState({
    status: '',
    student_id: '',
    session_id: ''
  });
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [processData, setProcessData] = useState({
    action: 'approve',
    rejection_reason: ''
  });
  const [stats, setStats] = useState({});
  const [exporting, setExporting] = useState(false);
  
  // Notification settings states
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationEmails, setNotificationEmails] = useState([]);
  const [newEmail, setNewEmail] = useState({ email: '', name: '' });
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  
  // Auto-refresh states
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const autoRefreshIntervalRef = useRef(null);

  // Fetch absence requests
  const fetchAbsenceRequests = async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        ...filters
      });

      const response = await api.get(`/absence-requests/admin?${params}`);
      if (response.data.success) {
        setRequests(response.data.data.requests);
        setPagination(response.data.data.pagination);
      }
    } catch (error) {
      console.error('Error fetching absence requests:', error);
      setError('Có lỗi xảy ra khi tải danh sách yêu cầu xin phép vắng học');
    } finally {
      setLoading(false);
    }
  };

  // Fetch absence requests silently (without loading state)
  const fetchAbsenceRequestsSilently = async () => {
    try {
      setIsAutoRefreshing(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...filters
      });

      const response = await api.get(`/absence-requests/admin?${params}`);
      if (response.data.success) {
        setRequests(response.data.data.requests);
        setPagination(response.data.data.pagination);
      }
    } catch (error) {
      console.error('Error fetching absence requests silently:', error);
    } finally {
      setIsAutoRefreshing(false);
    }
  };

  // Fetch statistics
  const fetchStats = async () => {
    try {
      const response = await api.get('/absence-requests/stats');
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  // Fetch statistics silently
  const fetchStatsSilently = async () => {
    try {
      const response = await api.get('/absence-requests/stats');
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching stats silently:', error);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchAbsenceRequests();
    fetchStats();
    fetchNotificationSettings();
  }, []);

  // Auto-refresh data every 30 seconds
  useEffect(() => {
    // Start auto-refresh interval
    autoRefreshIntervalRef.current = setInterval(() => {
      fetchAbsenceRequestsSilently();
      fetchStatsSilently();
    }, 30000); // 30 seconds

    // Clean up interval on unmount
    return () => {
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current);
        autoRefreshIntervalRef.current = null;
      }
    };
  }, [pagination.page, filters]);

  // Handle filter changes
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Apply filters
  const applyFilters = () => {
    fetchAbsenceRequests(1);
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({
      status: '',
      student_id: '',
      session_id: ''
    });
    fetchAbsenceRequests(1);
  };

  // Export report
  const exportReport = async () => {
    try {
      setExporting(true);
      
      // Fetch all requests for export (without pagination)
      const params = new URLSearchParams({
        page: '1',
        limit: '1000', // Large limit to get all data
        ...filters
      });

      const response = await api.get(`/absence-requests/admin?${params}`);
      
      if (response.data.success) {
        const allRequests = response.data.data.requests;
        
        // Download Excel file
        downloadExcel(allRequests, 'bao-cao-xin-phep-vang-hoc.xlsx');
        
        toast.success('Xuất báo cáo thành công!');
      } else {
        toast.error('Không thể tải dữ liệu để xuất báo cáo');
      }
    } catch (error) {
      console.error('Error exporting report:', error);
      toast.error('Có lỗi xảy ra khi xuất báo cáo');
    } finally {
      setExporting(false);
    }
  };

  // Create CSV content
  const createCSVContent = (requests) => {
    const headers = [
      'STT',
      'Tên sinh viên',
      'Email sinh viên',
      'Số điện thoại',
      'Tên buổi học',
      'Ngày buổi học',
      'Thời gian bắt đầu',
      'Thời gian kết thúc',
      'Địa điểm',
      'Loại vắng',
      'Lý do',
      'Trạng thái',
      'Người duyệt',
      'Ngày tạo',
      'Ngày duyệt'
    ];

    // Helper function to escape CSV values
    const escapeCSV = (value) => {
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return '"' + stringValue.replace(/"/g, '""') + '"';
      }
      return stringValue;
    };

    const csvRows = [headers.map(escapeCSV).join(',')];

    requests.forEach((request, index) => {
      const row = [
        index + 1,
        request.student_name || '',
        request.student_email || '',
        request.student_phone || '',
        request.session_title || '',
        request.session_date ? format(new Date(request.session_date), 'dd/MM/yyyy') : '',
        request.start_time || '',
        request.end_time || '',
        request.location || '',
        getRequestTypeText(request.request_type),
        request.reason || '',
        getStatusText(request.status),
        request.approver_name || '',
        request.created_at ? format(new Date(request.created_at), 'dd/MM/yyyy HH:mm') : '',
        request.approved_at ? format(new Date(request.approved_at), 'dd/MM/yyyy HH:mm') : ''
      ];
      csvRows.push(row.map(escapeCSV).join(','));
    });

    return csvRows.join('\r\n');
  };

  // Get request type text
  const getRequestTypeText = (type) => {
    const types = {
      'full_session': 'Cả buổi học',
      'before_session': 'Trước buổi học',
      'during_session': 'Trong buổi học',
      'after_session': 'Sau buổi học'
    };
    return types[type] || type;
  };

  // Get status text
  const getStatusText = (status) => {
    const statuses = {
      'pending': 'Chờ duyệt',
      'approved': 'Đã duyệt',
      'rejected': 'Từ chối',
      'cancelled': 'Đã hủy'
    };
    return statuses[status] || status;
  };

  // Create Excel content
  const createExcelContent = (requests) => {
    const headers = [
      'STT',
      'Tên sinh viên',
      'Email sinh viên',
      'Số điện thoại',
      'Tên buổi học',
      'Ngày buổi học',
      'Thời gian bắt đầu',
      'Thời gian kết thúc',
      'Địa điểm',
      'Loại vắng',
      'Lý do',
      'Trạng thái',
      'Người duyệt',
      'Ngày tạo',
      'Ngày duyệt'
    ];

    const data = requests.map((request, index) => [
      index + 1,
      request.student_name || '',
      request.student_email || '',
      request.student_phone || '',
      request.session_title || '',
      request.session_date ? format(new Date(request.session_date), 'dd/MM/yyyy') : '',
      request.start_time || '',
      request.end_time || '',
      request.location || '',
      getRequestTypeText(request.request_type),
      request.reason || '',
      getStatusText(request.status),
      request.approver_name || '',
      request.created_at ? format(new Date(request.created_at), 'dd/MM/yyyy HH:mm') : '',
      request.approved_at ? format(new Date(request.approved_at), 'dd/MM/yyyy HH:mm') : ''
    ]);

    return [headers, ...data];
  };

  // Download Excel file
  const downloadExcel = (requests, filename) => {
    const worksheet = XLSX.utils.aoa_to_sheet(createExcelContent(requests));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Báo cáo xin phép vắng học');
    
    // Set column widths
    const colWidths = [
      { wch: 5 },   // STT
      { wch: 20 },  // Tên sinh viên
      { wch: 25 },  // Email sinh viên
      { wch: 15 },  // Số điện thoại
      { wch: 25 },  // Tên buổi học
      { wch: 12 },  // Ngày buổi học
      { wch: 12 },  // Thời gian bắt đầu
      { wch: 12 },  // Thời gian kết thúc
      { wch: 20 },  // Địa điểm
      { wch: 15 },  // Loại vắng
      { wch: 30 },  // Lý do
      { wch: 12 },  // Trạng thái
      { wch: 20 },  // Người duyệt
      { wch: 18 },  // Ngày tạo
      { wch: 18 }   // Ngày duyệt
    ];
    worksheet['!cols'] = colWidths;
    
    XLSX.writeFile(workbook, filename);
  };

  // Download CSV file (fallback)
  const downloadCSV = (content, filename) => {
    // Add BOM for proper UTF-8 encoding
    const BOM = '\uFEFF';
    const csvContent = BOM + content;
    
    const blob = new Blob([csvContent], { 
      type: 'text/csv;charset=utf-8;' 
    });
    
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the URL object
    URL.revokeObjectURL(url);
  };

  // Handle process request
  const handleProcessRequest = (request) => {
    setSelectedRequest(request);
    setProcessData({
      action: 'approve',
      rejection_reason: ''
    });
    setShowProcessModal(true);
  };

  // Handle process form submission
  const handleProcessSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (processData.action === 'reject' && !processData.rejection_reason.trim()) {
      setError('Vui lòng nhập lý do từ chối');
      return;
    }

    try {
      setSubmitting(true);
      const response = await api.put(`/absence-requests/${selectedRequest.id}/process`, {
        action: processData.action,
        rejection_reason: processData.action === 'reject' ? processData.rejection_reason : null
      });

      if (response.data.success) {
        setSuccess(response.data.message);
        // Silent success - no toast notification
        setShowProcessModal(false);
        setSelectedRequest(null);
        // Refresh data silently
        fetchAbsenceRequestsSilently();
        fetchStatsSilently();
      }
    } catch (error) {
      console.error('Error processing request:', error);
      const errorMessage = error.response?.data?.message || 'Có lỗi xảy ra khi xử lý yêu cầu';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // Get status badge
  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <Badge bg="warning">Chờ duyệt</Badge>;
      case 'approved':
        return <Badge bg="success">Đã duyệt</Badge>;
      case 'rejected':
        return <Badge bg="danger">Từ chối</Badge>;
      case 'cancelled':
        return <Badge bg="secondary">Đã hủy</Badge>;
      default:
        return <Badge bg="secondary">{status}</Badge>;
    }
  };


  // Get request type badge color
  const getRequestTypeBadgeColor = (type) => {
    switch (type) {
      case 'full_session':
        return 'danger';
      case 'before_session':
        return 'info';
      case 'during_session':
        return 'warning';
      case 'after_session':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  // Fetch notification settings
  const fetchNotificationSettings = async () => {
    try {
      setLoadingNotifications(true);
      const response = await api.get('/absence-requests/notifications/settings');
      if (response.data.success) {
        setNotificationEmails(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching notification settings:', error);
      toast.error('Lỗi khi tải cài đặt thông báo');
    } finally {
      setLoadingNotifications(false);
    }
  };

  // Add notification email
  const addNotificationEmail = async () => {
    try {
      if (!newEmail.email || !newEmail.name) {
        toast.error('Vui lòng điền đầy đủ thông tin');
        return;
      }

      const response = await api.post('/absence-requests/notifications/emails', newEmail);
      if (response.data.success) {
        // Silent success - no toast notification
        setNewEmail({ email: '', name: '' });
        fetchNotificationSettings();
      }
    } catch (error) {
      console.error('Error adding notification email:', error);
      toast.error(error.response?.data?.message || 'Lỗi khi thêm email nhận thông báo');
    }
  };

  // Remove notification email
  const removeNotificationEmail = async (email) => {
    try {
      if (window.confirm(`Bạn có chắc chắn muốn xóa email ${email} khỏi danh sách nhận thông báo?`)) {
        const response = await api.delete(`/absence-requests/notifications/emails/${email}`);
        if (response.data.success) {
          // Silent success - no toast notification
          fetchNotificationSettings();
        }
      }
    } catch (error) {
      console.error('Error removing notification email:', error);
      toast.error('Lỗi khi xóa email nhận thông báo');
    }
  };

  // Toggle notification email status
  const toggleNotificationEmailStatus = async (email, isActive) => {
    try {
      const response = await api.put(`/absence-requests/notifications/emails/${email}/status`, {
        is_active: !isActive
      });
      if (response.data.success) {
        // Silent success - no toast notification
        fetchNotificationSettings();
      }
    } catch (error) {
      console.error('Error toggling notification email status:', error);
      toast.error('Lỗi khi cập nhật trạng thái email nhận thông báo');
    }
  };

  if (loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '50vh' }}>
        <div className="text-center">
          <Spinner animation="border" variant="primary" />
          <p className="mt-3">Đang tải dữ liệu...</p>
        </div>
      </Container>
    );
  }

  return (
    <div>
      {/* Header Section */}
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <div className="d-flex align-items-center">
              <h1 className="me-3">Quản lý yêu cầu xin phép vắng học</h1>
              {isAutoRefreshing && (
                <div className="auto-refresh-indicator">
                  <div className="spinner-border spinner-border-sm text-white" role="status">
                    <span className="visually-hidden">Đang cập nhật...</span>
                  </div>
                  <span className="ms-2 small">Đang cập nhật...</span>
                </div>
              )}
            </div>
            <p className="header-subtitle">Theo dõi và xử lý các yêu cầu xin phép vắng học của sinh viên</p>
          </div>
          <div className="header-actions">
            <Button 
              variant="outline-light" 
              className="create-session-btn me-2"
              onClick={() => setShowNotificationModal(true)}
            >
              <i className="fas fa-cog"></i>
              Cài đặt thông báo
            </Button>
            <Button 
              variant="outline-light" 
              className="create-session-btn"
              onClick={exportReport}
              disabled={exporting}
            >
              {exporting ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Đang xuất...
                </>
              ) : (
                <>
                  <i className="fas fa-download"></i>
                  Xuất báo cáo
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
      <div className="session-list-container">
              <div className="row g-4">
                <div className="col-lg-3 col-md-6">
                  <div className="statistics-card">
                    <div className="statistics-icon">
                      <i className="fas fa-calendar-times text-primary"></i>
                    </div>
                    <div className="statistics-content">
                      <h3>{stats.total_requests || 0}</h3>
                      <p>Tổng yêu cầu</p>
                    </div>
                  </div>
                </div>
                <div className="col-lg-3 col-md-6">
                  <div className="statistics-card">
                    <div className="statistics-icon">
                      <i className="fas fa-clock text-warning"></i>
                    </div>
                    <div className="statistics-content">
                      <h3>{stats.pending_requests || 0}</h3>
                      <p>Chờ duyệt</p>
                    </div>
                  </div>
                </div>
                <div className="col-lg-3 col-md-6">
                  <div className="statistics-card">
                    <div className="statistics-icon">
                      <i className="fas fa-check-circle text-success"></i>
                    </div>
                    <div className="statistics-content">
                      <h3>{stats.approved_requests || 0}</h3>
                      <p>Đã duyệt</p>
                    </div>
                  </div>
                </div>
                <div className="col-lg-3 col-md-6">
                  <div className="statistics-card">
                    <div className="statistics-icon">
                      <i className="fas fa-times-circle text-danger"></i>
                    </div>
                    <div className="statistics-content">
                      <h3>{stats.rejected_requests || 0}</h3>
                      <p>Từ chối</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

            {/* Search and Filter Controls */}
            <div className="session-list-controls">
              <div className="search-controls">
                  <i className="fas fa-search"></i>
                  <input
                    type="text"
                    placeholder="Tìm kiếm theo tên sinh viên hoặc mã buổi học..."
                    value={filters.student_id || filters.session_id || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFilters(prev => ({
                        ...prev,
                        student_id: value,
                        session_id: value
                      }));
                    }}
                    className="search-input"
                  />

                <select
                  className="filter-select"
                  value={filters.status}
                  onChange={handleFilterChange}
                  name="status"
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="pending">Chờ duyệt</option>
                  <option value="approved">Đã duyệt</option>
                  <option value="rejected">Từ chối</option>
                  <option value="cancelled">Đã hủy</option>
                </select>
                <Button variant="primary" onClick={applyFilters} className="filter-btn">
                  Lọc
                </Button>
                <Button variant="outline-secondary" onClick={clearFilters} className="filter-btn">
                  Xóa
                </Button>
              </div>
            </div>

            {/* Requests Table */}
            <div className="session-table-container">
              {requests.length > 0 ? (
                <table className="session-table">
                <thead>
                  <tr>
                    <th>Thông tin sinh viên</th>
                    <th>Buổi học</th>
                    <th>Loại vắng</th>
                    <th>Lý do</th>
                    <th>Trạng thái</th>
                    <th>Ngày tạo</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request, index) => (
                    <tr key={`${request.id}-${index}`}>
                      <td style={{ width: '310px' }}>
                        <div>
                          <div className="d-flex align-items-center gap-2 mb-1">
                            <div className="fw-bold">{request.student_name}</div>
                            {request.class_name && (
                              <div className="badge bg-info bg-opacity-10 text-info">
                                <i className="fas fa-graduation-cap me-1"></i>
                                {request.class_name}
                              </div>
                            )}
                          </div>
                          <small className="text-muted d-block">{request.student_email}</small>
                          {request.student_phone && (
                            <div>
                              <small className="text-muted">
                                <i className="fas fa-phone me-1"></i>
                                {request.student_phone}
                              </small>
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ width: '350px' }}>
                        <div>
                          <div className="fw-bold">{request.session_title}</div>
                          <small className="text-muted">
                            {format(new Date(request.session_date), 'dd/MM/yyyy')} - ({request.start_time} → {request.end_time})
                          </small>
                          {request.location && (
                            <div>
                              <small className="text-muted">
                                <i className="fas fa-map-marker-alt me-1"></i>
                                {request.location}
                              </small>
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ width: '150px' }}>
                        <Badge bg={getRequestTypeBadgeColor(request.request_type)}>
                          {getRequestTypeText(request.request_type)}
                        </Badge>
                      </td>
                      <td style={{ width: '500px' }}>
                        <div style={{ 
                          maxWidth: '350px', 
                          wordWrap: 'break-word',
                          lineHeight: '1.3',
                          fontSize: '0.85rem'
                        }}>
                          {request.reason}
                        </div>
                      </td>
                      <td>{getStatusBadge(request.status)}</td>
                      <td>
                        <small>{format(new Date(request.created_at), 'dd/MM/yyyy HH:mm')}</small>
                      </td>
                      <td>
                        <div className="d-flex gap-1">
                          <Button
                            variant="outline-info"
                            size="sm"
                            onClick={() => window.open(`/student/absence-requests/${request.id}/preview`, '_blank')}
                            title="Xem trước đơn xác nhận"
                          >
                            <i className="fas fa-eye"></i>
                          </Button>
                          {request.status === 'pending' ? (
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => handleProcessRequest(request)}
                              title="Xử lý yêu cầu"
                            >
                              <i className="fas fa-cog"></i>
                            </Button>
                          ) : (
                            <div className="small text-muted">
                              <div>
                                {request.approver_name && `Bởi: ${request.approver_name}`}
                              </div>
                              <div>
                                {request.approved_at && format(new Date(request.approved_at), 'dd/MM/yyyy HH:mm')}
                              </div>
                              {request.rejection_reason && (
                                <div className="text-danger mt-1">
                                  Lý do: {request.rejection_reason}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                </table>
              ) : (
                <div className="text-center text-muted py-4">
                  <i className="fas fa-inbox fa-3x mb-3"></i>
                  <p>Không có yêu cầu xin phép vắng học nào</p>
                </div>
              )}
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="d-flex justify-content-center mt-4">
                <nav>
                  <ul className="pagination">
                    <li className={`page-item ${pagination.page === 1 ? 'disabled' : ''}`}>
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => fetchAbsenceRequests(pagination.page - 1)}
                        disabled={pagination.page === 1}
                      >
                        Trước
                      </Button>
                    </li>
                    <li className="page-item active">
                      <span className="page-link">
                        {pagination.page} / {pagination.pages}
                      </span>
                    </li>
                    <li className={`page-item ${pagination.page === pagination.pages ? 'disabled' : ''}`}>
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => fetchAbsenceRequests(pagination.page + 1)}
                        disabled={pagination.page === pagination.pages}
                      >
                        Sau
                      </Button>
                    </li>
                  </ul>
                </nav>
              </div>
            )}

      {/* Process Request Modal */}
      <Modal show={showProcessModal} onHide={() => setShowProcessModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="fas fa-cog me-2"></i>
            Xử lý yêu cầu xin phép vắng học
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedRequest && (
            <div className="mb-4">
              <h6>Thông tin yêu cầu:</h6>
              <div className="bg-light p-3 rounded">
                <div className="row">
                  <div className="col-md-6">
                    <strong>Sinh viên:</strong> {selectedRequest.student_name}
                  </div>
                  <div className="col-md-6">
                    <strong>Email:</strong> {selectedRequest.student_email}
                  </div>
                  <div className="col-md-6">
                    <strong>Buổi học:</strong> {selectedRequest.session_title}
                  </div>
                  <div className="col-md-6">
                    <strong>Ngày:</strong> {format(new Date(selectedRequest.session_date), 'dd/MM/yyyy')}
                  </div>
                  <div className="col-md-6">
                    <strong>Thời gian:</strong> {selectedRequest.start_time} - {selectedRequest.end_time}
                  </div>
                  <div className="col-md-6">
                    <strong>Loại vắng:</strong> {getRequestTypeText(selectedRequest.request_type)}
                  </div>
                  <div className="col-12 mt-2">
                    <strong>Lý do:</strong>
                    <div className="mt-1 p-2 bg-white rounded border">
                      {selectedRequest.reason}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <Form onSubmit={handleProcessSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Quyết định <span className="text-danger">*</span></Form.Label>
              <Form.Select
                name="action"
                value={processData.action}
                onChange={(e) => setProcessData(prev => ({
                  ...prev,
                  action: e.target.value
                }))}
                required
              >
                <option value="approve">Duyệt yêu cầu</option>
                <option value="reject">Từ chối yêu cầu</option>
              </Form.Select>
            </Form.Group>

            {processData.action === 'reject' && (
              <Form.Group className="mb-3">
                <Form.Label>Lý do từ chối <span className="text-danger">*</span></Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  name="rejection_reason"
                  value={processData.rejection_reason}
                  onChange={(e) => setProcessData(prev => ({
                    ...prev,
                    rejection_reason: e.target.value
                  }))}
                  placeholder="Vui lòng nhập lý do từ chối yêu cầu..."
                  required
                />
              </Form.Group>
            )}

            <div className="d-flex justify-content-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setShowProcessModal(false)}
                disabled={submitting}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                variant={processData.action === 'approve' ? 'success' : 'danger'}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    <i className={`fas fa-${processData.action === 'approve' ? 'check' : 'times'} me-2`}></i>
                    {processData.action === 'approve' ? 'Duyệt yêu cầu' : 'Từ chối yêu cầu'}
                  </>
                )}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Notification Settings Modal */}
      <Modal show={showNotificationModal} onHide={() => setShowNotificationModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="fas fa-bell me-2"></i>
            Cài đặt thông báo email
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-4">
            <h5>Danh sách email nhận thông báo</h5>
            <p className="text-muted">Khi có yêu cầu xin phép vắng học mới, hệ thống sẽ gửi email thông báo đến các địa chỉ dưới đây.</p>
            
            {loadingNotifications ? (
              <div className="text-center py-3">
                <Spinner animation="border" size="sm" />
                <span className="ms-2">Đang tải...</span>
              </div>
            ) : (
              <div className="table-responsive">
                <Table striped hover>
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Tên</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notificationEmails.map((email, index) => (
                      <tr key={index}>
                        <td>{email.email}</td>
                        <td>{email.name}</td>
                        <td>
                          <Badge bg={email.is_active ? 'success' : 'secondary'}>
                            {email.is_active ? 'Hoạt động' : 'Tạm dừng'}
                          </Badge>
                        </td>
                        <td>
                          <Button
                            variant="outline-primary"
                            size="sm"
                            className="me-2"
                            onClick={() => toggleNotificationEmailStatus(email.email, email.is_active)}
                          >
                            <i className={`fas fa-${email.is_active ? 'pause' : 'play'}`}></i>
                          </Button>
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => removeNotificationEmail(email.email)}
                          >
                            <i className="fas fa-trash"></i>
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {notificationEmails.length === 0 && (
                      <tr>
                        <td colSpan="4" className="text-center text-muted">
                          Chưa có email nào được cài đặt
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>
            )}
          </div>

          <hr />

          <div>
            <h5>Thêm email nhận thông báo</h5>
            <Form onSubmit={(e) => { e.preventDefault(); addNotificationEmail(); }}>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Email</Form.Label>
                    <Form.Control
                      type="email"
                      placeholder="Nhập địa chỉ email"
                      value={newEmail.email}
                      onChange={(e) => setNewEmail({ ...newEmail, email: e.target.value })}
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Tên</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Nhập tên người nhận"
                      value={newEmail.name}
                      onChange={(e) => setNewEmail({ ...newEmail, name: e.target.value })}
                      required
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Button type="submit" variant="primary">
                <i className="fas fa-plus me-2"></i>
                Thêm email
              </Button>
            </Form>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowNotificationModal(false)}>
            Đóng
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AbsenceRequestManagement;
