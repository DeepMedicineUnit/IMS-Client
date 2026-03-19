import React, { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { Card, Row, Col, Table, Badge, Button, Alert, Spinner, Breadcrumb, Container, Form } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const StatisticsDetail = () => {
  usePageTitle('Chi tiết thống kê');
  const { metricType, studentId } = useParams();
  const { api, currentUser } = useAuth();
  const location = useLocation();
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateFilter, setDateFilter] = useState(() => {
    // Get from localStorage or default to 'today'
    return localStorage.getItem('dashboardDateFilter') || 'today';
  });
  const [customDate, setCustomDate] = useState(() => {
    return localStorage.getItem('dashboardCustomDate') || '';
  });
  const [customStartDate, setCustomStartDate] = useState(() => {
    return localStorage.getItem('dashboardCustomStartDate') || '';
  });
  const [customEndDate, setCustomEndDate] = useState(() => {
    return localStorage.getItem('dashboardCustomEndDate') || '';
  });

  const isSuperAdminPath = location.pathname.startsWith('/superadmin/');
  const statsBasePath = isSuperAdminPath ? '/superadmin/stats' : '/admin/stats';
  const dashboardPath = isSuperAdminPath
    ? '/superadmin/dashboard'
    : currentUser?.role === 'staff'
      ? '/staff/dashboard'
      : currentUser?.role === 'superadmin'
        ? '/superadmin/dashboard'
        : '/admin/dashboard';
  
  const toLocalDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper function to calculate date range based on filter
  const getDateRange = (filter) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (filter) {
      case 'today':
        return { 
          startDate: toLocalDateString(today), 
          endDate: toLocalDateString(today) // Set endDate to same day for "Hôm nay"
        };
      case '2days':
        const twoDaysAgo = new Date(today);
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 1);
        return { startDate: toLocalDateString(twoDaysAgo), endDate: null };
      case '3days':
        const threeDaysAgo = new Date(today);
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 2);
        return { startDate: toLocalDateString(threeDaysAgo), endDate: null };
      case '1week':
        const oneWeekAgo = new Date(today);
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 6);
        return { startDate: toLocalDateString(oneWeekAgo), endDate: null };
      case '1month':
        const oneMonthAgo = new Date(today);
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        return { startDate: toLocalDateString(oneMonthAgo), endDate: null };
      case 'customDate':
        if (customDate) {
          return {
            startDate: customDate,
            endDate: customDate
          };
        }
        return { startDate: null, endDate: null };
      case 'customRange':
        if (customStartDate && customEndDate) {
          return {
            startDate: customStartDate,
            endDate: customEndDate
          };
        }
        return { startDate: null, endDate: null };
      case 'all':
      default:
        return { startDate: null, endDate: null };
    }
  };
  
  // Save date filter to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('dashboardDateFilter', dateFilter);
    if (dateFilter === 'customDate' && customDate) {
      localStorage.setItem('dashboardCustomDate', customDate);
    }
    if (dateFilter === 'customRange') {
      if (customStartDate) localStorage.setItem('dashboardCustomStartDate', customStartDate);
      if (customEndDate) localStorage.setItem('dashboardCustomEndDate', customEndDate);
    }
  }, [dateFilter, customDate, customStartDate, customEndDate]);
  
  useEffect(() => {
    const fetchStatistics = async () => {
      try {
        setLoading(true);
        setError('');
        
        let endpoint = `/dashboard/stats/${metricType}`;
        if (studentId) {
          endpoint += `/${studentId}`;
        }
        
        const dateRange = getDateRange(dateFilter);
        const params = new URLSearchParams();
        if (dateRange.startDate) {
          params.append('startDate', dateRange.startDate);
        }
        if (dateRange.endDate) {
          params.append('endDate', dateRange.endDate);
        }
        
        const queryString = params.toString();
        if (queryString) {
          endpoint += `?${queryString}`;
        }
        
        const response = await api.get(endpoint);
        if (response.data.success) {
          setStats(response.data.data);
        } else {
          setError('Không thể tải dữ liệu thống kê');
        }
      } catch (err) {
        console.error('Error fetching statistics:', err);
        setError('Lỗi khi tải dữ liệu. Vui lòng thử lại sau.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchStatistics();
  }, [api, metricType, studentId, dateFilter, customDate, customStartDate, customEndDate]);
  
  // Format date function
  const formatDate = (dateString) => {
    try {
      if (!dateString) return '';
      const date = new Date(dateString);
      return format(date, 'dd/MM/yyyy');
    } catch (error) {
      console.error('Error formatting date:', error);
      return dateString;
    }
  };
  
  // Format time function
  const formatTime = (timeString) => {
    if (!timeString) return '';
    
    try {
      // If it's an ISO string (from database timestamp), parse it and format
      if (timeString.includes('T') || timeString.includes('Z')) {
        const date = new Date(timeString);
        return format(date, 'HH:mm:ss');
      }
      
      // If it's already in HH:mm:ss format, return as is
      if (timeString.match(/^\d{2}:\d{2}:\d{2}$/)) {
        return timeString;
      }
      
      // If it's in HH:mm format, add seconds
      if (timeString.match(/^\d{2}:\d{2}$/)) {
        return timeString + ':00';
      }
      
      // If it's a timestamp (number), convert to time
      if (typeof timeString === 'number') {
        const date = new Date(timeString);
        return format(date, 'HH:mm:ss');
      }
      
      // Try to parse as Date object
      const date = new Date(timeString);
      if (!isNaN(date.getTime())) {
        return format(date, 'HH:mm:ss');
      }
      
      return timeString;
    } catch (error) {
      console.error('Error formatting time:', error, 'input:', timeString);
      return timeString;
    }
  };
  
  // Get metric title
  const getMetricTitle = () => {
    switch (metricType) {
      case 'late':
        return 'Sinh viên đi trễ';
      case 'absent':
        return 'Sinh viên vắng mặt';
      case 'missingTimeSlot':
        return 'Sinh viên thiếu khung giờ điểm danh';
      case 'multipleLate':
        return 'Sinh viên đi trễ nhiều lần';
      case 'incompleteBadge':
        return 'Yêu cầu vắng học';
      default:
        return 'Thống kê chi tiết';
    }
  };
  
  // Render table content based on metric type
  const renderTableContent = () => {
    if (!stats || stats.length === 0) {
      return (
        <tr>
          <td colSpan="9" className="text-center py-5">
            <div className="d-flex flex-column align-items-center">
              <h5 className="text-muted mb-2">Không có dữ liệu thống kê</h5>
              <p className="text-muted mb-0">Chưa có dữ liệu để hiển thị cho loại thống kê này</p>
            </div>
          </td>
        </tr>
      );
    }
    
    switch (metricType) {
      case 'late':
        return stats.map((item, index) => (
          <tr key={`late-${item.id || index}-${item.session_id}`}>
            <td>{index + 1}</td>
            {!studentId && (
              <td>
                <div className="d-flex align-items-center">
                  <div>
                    <div className="fw-medium">{item.full_name}</div>
                    <small className="text-muted">{item.username}</small>
                  </div>
                </div>
              </td>
            )}
            <td>
              <div className="session-title-cell">
                {item.session_title}
              </div>
            </td>
            <td>
              <div className="session-date">
                {item.session_end_date && item.session_end_date !== item.session_date ? 
                  `${formatDate(item.session_date)} - ${formatDate(item.session_end_date)}` : 
                  formatDate(item.session_date)}
              </div>
            </td>
            <td>
              <div className="session-class text-start">
                {item.class_name || <span className="text-muted">-</span>}
              </div>
            </td>
            <td>
              <div className="session-class text-start">
                {item.clinical_groups || <span className="text-muted">-</span>}
              </div>
            </td>
            <td>
              <div className="session-time">
                {formatTime(item.start_time)}
              </div>
            </td>
            <td>
              <div className="session-time">
                {formatTime(item.check_in_time)}
              </div>
            </td>
            <td>
              <Badge className="status-badge" bg="warning">
                Trễ {Math.round(item.minutes_late)} phút
              </Badge>
            </td>
          </tr>
        ));
        
      case 'absent':
        return stats.map((item, index) => (
          <tr key={`absent-${item.id || index}-${item.session_id}`}>
            <td>{index + 1}</td>
            {!studentId && (
              <td>
                <div className="d-flex align-items-center">
                  <div>
                    <div className="fw-medium">{item.full_name}</div>
                    <small className="text-muted">{item.username}</small>
                  </div>
                </div>
              </td>
            )}
            <td>
              <div className="session-title-cell">
                {item.session_title}
              </div>
            </td>
            <td>
              <div className="session-date">
                {item.session_end_date && item.session_end_date !== item.session_date ? 
                  `${formatDate(item.session_date)} - ${formatDate(item.session_end_date)}` : 
                  formatDate(item.session_date)}
              </div>
            </td>
            <td>
              <div className="session-class text-start">
                {item.class_name || <span className="text-muted">-</span>}
              </div>
            </td>
            <td>
              <div className="session-class text-start">
                {item.clinical_groups || <span className="text-muted">-</span>}
              </div>
            </td>
            <td colSpan="2">
              <Badge className="status-badge" bg="danger">
                Vắng mặt
              </Badge>
            </td>
          </tr>
        ));
        
      case 'missingTimeSlot':
        return stats.map((item, index) => (
          <tr key={`missing-${item.id || index}-${item.session_id}`}>
            <td>{index + 1}</td>
            {!studentId && (
              <td>
                <div className="d-flex align-items-center">
                  <div>
                    <div className="fw-medium">{item.full_name}</div>
                    <small className="text-muted">{item.username}</small>
                  </div>
                </div>
              </td>
            )}
            <td>
              <div className="session-title-cell">
                {item.session_title}
              </div>
            </td>
            <td>
              <div className="session-date">
                {item.session_end_date && item.session_end_date !== item.session_date ? 
                  `${formatDate(item.session_date)} - ${formatDate(item.session_end_date)}` : 
                  formatDate(item.session_date)}
              </div>
            </td>
            <td>
              <div className="session-class text-start">
                {item.class_name || <span className="text-muted">-</span>}
              </div>
            </td>
            <td>
              <div className="session-class text-start">
                {item.clinical_groups || <span className="text-muted">-</span>}
              </div>
            </td>
            <td colSpan="2">
              <Badge className="status-badge" bg="warning">
                {item.missing_type || 'Thiếu khung giờ điểm danh'}
              </Badge>
            </td>
          </tr>
        ));
        
      case 'multipleLate':
        if (studentId) {
          return stats.map((item, index) => (
            <tr key={`multi-late-detail-${index}-${item.session_id}`}>
              <td>{index + 1}</td>
              <td>
                  <div className="session-title-cell">
                    {item.session_title}
                  </div>
              </td>
              <td>
                  <div className="session-date">
                    {item.session_end_date && item.session_end_date !== item.session_date ? 
                      `${formatDate(item.session_date)} - ${formatDate(item.session_end_date)}` : 
                      formatDate(item.session_date)}
                  </div>
              </td>
              <td>
                  <div className="session-class text-start">
                    {item.class_name || <span className="text-muted">-</span>}
                  </div>
              </td>
              <td>
                  <div className="session-class text-start">
                    {item.clinical_groups || <span className="text-muted">-</span>}
                  </div>
              </td>
              <td>
                  <div className="session-time">
                    {formatTime(item.start_time)}
                  </div>
              </td>
              <td>
                  <div className="session-time">
                    {formatTime(item.check_in_time)}
                  </div>
              </td>
              <td>
                  <Badge className="status-badge" bg="warning">
                    Trễ {Math.round(item.minutes_late)} phút
                  </Badge>
              </td>
            </tr>
          ));
        } else {
          return stats.map((item, index) => (
            <tr key={`multi-late-${item.id || index}`}>
              <td>{index + 1}</td>
              <td>
                <div className="d-flex align-items-center">
                  <div>
                    <div className="fw-medium">{item.full_name}</div>
                    <small className="text-muted">{item.username}</small>
                  </div>
                </div>
              </td>
              <td>
                  <div className="session-class text-start">
                    {item.class_name || <span className="text-muted">-</span>}
                  </div>
              </td>
              <td>
                  <div className="session-class text-start">
                    {item.clinical_groups || <span className="text-muted">-</span>}
                  </div>
              </td>
              <td>
              <div className="session-student-count">
                {item.username}
              </div>
              </td>
              <td>
                <Badge className="status-badge" bg="danger">
                  Đi trễ {item.late_count} lần
                </Badge>
              </td>
            </tr>
          ));
        }
        
      case 'incompleteBadge':
        if (studentId) {
          return stats.map((item, index) => (
            <tr key={`absence-detail-${index}-${item.request_id}`}>
              <td>{index + 1}</td>
              <td>
                  <div className="session-title-cell">
                    {item.session_title}
                  </div>
              </td>
              <td>
                  <div className="session-date">
                    {item.session_end_date && item.session_end_date !== item.session_date ? 
                      `${formatDate(item.session_date)} - ${formatDate(item.session_end_date)}` : 
                      formatDate(item.session_date)}
                  </div>
              </td>
              <td>
              <div className="session-time">
                {formatDate(item.request_date)}
              </div>
              </td>
              <td>
                <Badge className="status-badge" bg="warning">
                  Chờ duyệt
                </Badge>
              </td>
            </tr>
          ));
        } else {
          return stats.map((item, index) => (
            <tr key={`absence-${item.id || index}-${item.request_id}`}>
              <td>{index + 1}</td>
              <td>
                <div className="d-flex align-items-center">
                  <div>
                    <div className="fw-medium">{item.full_name}</div>
                    <small className="text-muted">{item.username}</small>
                  </div>
                </div>
              </td>
              <td>
                  <div className="session-title-cell">
                    {item.session_title}
                  </div>
              </td>
              <td>
                  <div className="session-date">
                    {item.session_end_date && item.session_end_date !== item.session_date ? 
                      `${formatDate(item.session_date)} - ${formatDate(item.session_end_date)}` : 
                      formatDate(item.session_date)}
                  </div>
              </td>
              <td>
                  <div className="session-class text-start">
                    {item.class_name || <span className="text-muted">-</span>}
                  </div>
              </td>
              <td>
                  <div className="session-class text-start">
                    {item.clinical_groups || <span className="text-muted">-</span>}
                  </div>
              </td>
              <td>
              <div className="session-time">
                {formatDate(item.request_date)}
              </div>
              </td>
              <td>
                <Badge className="status-badge" bg="warning">
                  Chờ duyệt
                </Badge>
              </td>
            </tr>
          ));
        }
      
      default:
        return (
          <tr>
            <td colSpan="9" className="text-center py-5">
              <div className="d-flex flex-column align-items-center">
                <h5 className="text-muted mb-2">Loại thống kê không hợp lệ</h5>
                <p className="text-muted mb-0">Vui lòng kiểm tra lại đường dẫn</p>
              </div>
            </td>
          </tr>
        );
    }
  };
  
  // Render table headers based on metric type
  const renderTableHeaders = () => {
    if (studentId) {
      // Detail view for a specific student
      switch (metricType) {
        case 'late':
          return (
            <tr>
              <th>#</th>
              <th>Buổi học</th>
              <th>Ngày</th>
              <th>Lớp</th>
              <th>Nhóm</th>
              <th>Giờ bắt đầu</th>
              <th>Giờ điểm danh</th>
              <th>Trạng thái</th>
            </tr>
          );
          
        case 'absent':
          return (
            <tr>
              <th>#</th>
              <th>Buổi học</th>
              <th>Ngày</th>
              <th>Lớp</th>
              <th>Nhóm</th>
              <th colSpan="2">Trạng thái</th>
            </tr>
          );
          
        case 'multipleLate':
          return (
            <tr>
              <th>#</th>
              <th>Buổi học</th>
              <th>Ngày</th>
              <th>Lớp</th>
              <th>Nhóm</th>
              <th>Giờ bắt đầu</th>
              <th>Giờ điểm danh</th>
              <th>Trạng thái</th>
            </tr>
          );
          
        case 'incompleteBadge':
          return (
            <tr>
              <th>#</th>
              <th>Buổi học</th>
              <th>Ngày</th>
              <th>Ngày yêu cầu</th>
              <th>Trạng thái</th>
            </tr>
          );
          
        default:
          return (
            <tr>
              <th>#</th>
              <th>Buổi học</th>
              <th>Ngày</th>
              <th>Thông tin</th>
              <th>Trạng thái</th>
            </tr>
          );
      }
    } else {
      // List view of all students
      switch (metricType) {
        case 'late':
          return (
            <tr>
              <th>#</th>
              <th>Sinh viên</th>
              <th>Buổi học</th>
              <th>Ngày</th>
              <th>Lớp</th>
              <th>Nhóm</th>
              <th>Giờ bắt đầu</th>
              <th>Giờ điểm danh</th>
              <th>Trạng thái</th>
            </tr>
          );
          
        case 'absent':
          return (
            <tr>
              <th>#</th>
              <th>Sinh viên</th>
              <th>Buổi học</th>
              <th>Ngày</th>
              <th>Lớp</th>
              <th>Nhóm</th>
              <th colSpan="2">Trạng thái</th>
            </tr>
          );
          
        case 'missingTimeSlot':
          return (
            <tr>
              <th>#</th>
              <th>Sinh viên</th>
              <th>Buổi học</th>
              <th>Ngày</th>
              <th>Lớp</th>
              <th>Nhóm</th>
              <th>Các khung giờ thiếu</th>
            </tr>
          );
          
        case 'multipleLate':
          return (
            <tr>
              <th>#</th>
              <th>Sinh viên</th>
              <th>Lớp</th>
              <th>Nhóm</th>
              <th>Mã số</th>
              <th>Trạng thái</th>
            </tr>
          );
          
        case 'incompleteBadge':
          return (
            <tr>
              <th>#</th>
              <th>Tên sinh viên</th>
              <th>Buổi học</th>
              <th>Ngày học</th>
              <th>Lớp</th>
              <th>Nhóm</th>
              <th>Ngày yêu cầu</th>
              <th>Trạng thái</th>
            </tr>
          );
          
        default:
          return (
            <tr>
              <th>#</th>
              <th>Sinh viên</th>
              <th>Buổi học</th>
              <th>Ngày</th>
              <th>Thông tin</th>
              <th>Trạng thái</th>
            </tr>
          );
      }
    }
  };
  
  return (
    <Container fluid className="px-4 py-3">
      {/* Header Section */}
      <div className="session-header mb-4">
        <div className="header-content">
          <div className="header-title">
            <h1 className="mb-1">{getMetricTitle()}</h1>
            <p className="header-subtitle mb-0">
              {studentId ? 'Chi tiết thống kê sinh viên' : 'Thống kê tổng quan'}
            </p>
          </div>
          <div className="header-actions">
            <div className="d-flex align-items-center gap-2">
              <Form.Select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                style={{ width: '200px' }}
                className="form-select-modern"
              >
                <option value="today">Hôm nay</option>
                <option value="2days">2 ngày gần nhất</option>
                <option value="3days">3 ngày gần nhất</option>
                <option value="1week">1 tuần</option>
                <option value="1month">1 tháng</option>
                <option value="customDate">Chọn ngày cụ thể</option>
                <option value="customRange">Chọn khoảng thời gian</option>
                <option value="all">Tất cả</option>
              </Form.Select>
              
              {dateFilter === 'customDate' && (
                <Form.Control
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  style={{ width: '180px' }}
                  className="form-control-modern"
                />
              )}
              
              {dateFilter === 'customRange' && (
                <>
                  <Form.Control
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    placeholder="Từ ngày"
                    style={{ width: '180px' }}
                    className="form-control-modern"
                  />
                  <span className="mx-2 text-white">đến</span>
                  <Form.Control
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    placeholder="Đến ngày"
                    style={{ width: '180px' }}
                    className="form-control-modern"
                  />
                </>
              )}
            </div>
            <Button 
              as={Link} 
              to={studentId ? `${statsBasePath}/${metricType}` : dashboardPath} 
              variant="outline-light"
              className="px-3 py-2 ms-2"
              style={{ minWidth: '120px', height: '40px' }}
            >
              <i className="fas fa-arrow-left me-2"></i>
              Quay lại
            </Button>
          </div>
        </div>
      </div>
      

      
      {/* Error Alert */}
      {error && (
        <Alert variant="danger" className="mb-4">
          <i className="fas fa-exclamation-triangle me-2"></i>
          {error}
        </Alert>
      )}
      
      {/* Statistics Card */}
      <Card className="session-card">
        <Card.Body className="card-body-modern p-0">
          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" role="status" className="text-primary">
                <span className="visually-hidden">Đang tải...</span>
              </Spinner>
              <p className="mt-3 text-muted">Đang tải dữ liệu thống kê...</p>
            </div>
          ) : (
            <div className="session-table-container">
              <Table responsive hover className="session-table mb-0">
                <thead>
                  {renderTableHeaders()}
                </thead>
                <tbody>
                  {renderTableContent()}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default StatisticsDetail;
