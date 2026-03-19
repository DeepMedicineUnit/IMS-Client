import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Container, Row, Col, Card, Button, Table, Form, Spinner, Alert, Badge, Modal } from 'react-bootstrap';
import Pagination from '../../components/Pagination';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import usePageTitle from '../../hooks/usePageTitle';
import io from 'socket.io-client';
import { getSocketUrl } from '../../utils/api';
import '../../styles/user.css';

// Reuse small subset of SystemPage activity styles (if needed we can inline or rely on global css)

const LMSActivityLogsPage = () => {
  usePageTitle('Nhật ký hoạt động LMS');
  const { api, currentUser } = useAuth();
  const { showAlert } = useAlert();

  // Only lms_admin & lms_qa can access
  const hasLmsActivityAccess = () => {
    const moduleRoles = currentUser?.module_roles || [];
    return moduleRoles.includes('lms_admin') || moduleRoles.includes('lms_qa');
  };

  const [activityLogs, setActivityLogs] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState('');
  const [activityPagination, setActivityPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  });
  const [activityFilters, setActivityFilters] = useState({
    event_context: '',
    event_type: '',
    component: '',
    username: '',
    start_date: '',
    end_date: '',
    start_date_only: '',
    start_time: '',
    end_date_only: '',
    end_time: '',
    search: ''
  });
  const [activityStats, setActivityStats] = useState(null);
  const [showActivityFilters, setShowActivityFilters] = useState(false);
  const [selectedActivityLog, setSelectedActivityLog] = useState(null);
  const [showActivityDetailModal, setShowActivityDetailModal] = useState(false);

  // Socket & auto-refresh refs (simplified from SystemPage)
  const activitySocketRef = useRef(null);
  const lastLogIdRef = useRef(null);
  const fetchActivityLogsRef = useRef(null);
  const fetchActivityLogsSilentlyRef = useRef(null);
  const activityPageRef = useRef(1);
  const activitySocketDebounceRef = useRef(null);
  const activityFallbackIntervalRef = useRef(null);

  // Helper formatters (reuse subset)
  const formatEventContext = (context) => {
    const contextMap = {
      'authentication': 'Xác thực',
      'navigation': 'Điều hướng',
      'interaction': 'Tương tác',
      'api_call': 'Gọi API',
      'custom': 'Tùy chỉnh'
    };
    return contextMap[context] || context;
  };

  const formatEventType = (type) => {
    const typeMap = {
      'login': 'Đăng nhập',
      'logout': 'Đăng xuất',
      'click': 'Click',
      'page_view': 'Xem trang',
      'api_call': 'Gọi API'
    };
    return typeMap[type] || type;
  };

  const formatUserRole = (role) => {
    const roleMap = {
      'superadmin': 'Quản trị viên cấp cao',
      'admin': 'Quản trị viên',
      'staff': 'Nhân viên',
      'student': 'Sinh viên',
      'guest': 'Khách'
    };
    return roleMap[role] || role;
  };

  const fetchActivityLogs = async (page = 1, silent = false, onlyUpdateIfPage1 = false) => {
    if (!hasLmsActivityAccess()) return;
    try {
      if (!silent) {
        setActivityLoading(true);
        setActivityError('');
      }

      const filterParams = Object.fromEntries(
        Object.entries(activityFilters).filter(([key, value]) =>
          value !== '' &&
          !['start_date_only', 'start_time', 'end_date_only', 'end_time'].includes(key)
        )
      );

      const params = new URLSearchParams({
        page: page.toString(),
        limit: activityPagination.limit.toString(),
        sort_by: 'created_at',
        sort_order: 'DESC',
        ...filterParams
      });

      const response = await api.get(`/lms/activity/logs?${params.toString()}`);

      if (response.data.success) {
        if (onlyUpdateIfPage1 && activityPageRef.current !== 1) {
          return;
        }
        const logs = response.data.data || [];
        setActivityLogs(logs);
        setActivityPagination(prev => ({
          ...prev,
          ...response.data.pagination,
          page
        }));
        if (logs.length > 0 && logs[0].id) {
          lastLogIdRef.current = logs[0].id;
        }
      } else {
        setActivityError(response.data.message || 'Không thể tải nhật ký hoạt động');
      }
    } catch (err) {
      console.error('Error fetching LMS activity logs:', err);
      setActivityError(err.response?.data?.message || 'Không thể tải nhật ký hoạt động');
    } finally {
      if (!silent) {
        setActivityLoading(false);
      }
    }
  };
  fetchActivityLogsRef.current = fetchActivityLogs;
  activityPageRef.current = activityPagination.page;

  const fetchActivityLogsSilentlyRefFn = useCallback(() => {
    fetchActivityLogsRef.current?.(1, true, true);
  }, []);
  fetchActivityLogsSilentlyRef.current = fetchActivityLogsSilentlyRefFn;

  const fetchActivityStats = async () => {
    if (!hasLmsActivityAccess()) return;
    try {
      const params = new URLSearchParams({
        ...Object.fromEntries(
          Object.entries(activityFilters)
            .filter(([key, value]) => ['start_date', 'end_date'].includes(key) && value !== '')
        )
      });

      const response = await api.get(`/lms/activity/logs/stats?${params.toString()}`);

      if (response.data.success) {
        setActivityStats(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching LMS activity stats:', err);
    }
  };

  const exportActivityLogs = async (format = 'csv') => {
    if (!hasLmsActivityAccess()) return;
    try {
      const filterParams = Object.fromEntries(
        Object.entries(activityFilters).filter(([key, value]) =>
          value !== '' &&
          !['start_date_only', 'start_time', 'end_date_only', 'end_time'].includes(key)
        )
      );

      const params = new URLSearchParams({
        format,
        ...filterParams
      });

      const response = await api.get(`/lms/activity/logs/export?${params.toString()}`, {
        responseType: format === 'csv' ? 'blob' : 'json'
      });

      if (format === 'csv') {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `activity_logs_lms_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        showAlert('Đã export nhật ký hoạt động LMS thành công', 'success');
      } else {
        return response.data;
      }
    } catch (err) {
      console.error('Error exporting LMS activity logs:', err);
      showAlert('Không thể export nhật ký hoạt động LMS', 'danger');
    }
  };

  useEffect(() => {
    if (!hasLmsActivityAccess()) return;
    fetchActivityLogs(1, true);
    fetchActivityStats();
  }, []);

  // Socket.IO cho LMS activity logs (dùng chung channel, chỉ refetch khi có log mới)
  useEffect(() => {
    if (!hasLmsActivityAccess()) return;

    const socketUrl = getSocketUrl();
    const socket = io(socketUrl, {
      transports: ['websocket'],
      withCredentials: true
    });

    activitySocketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('activity_logs:join');
    });

    const debouncedFetch = () => {
      if (activitySocketDebounceRef.current) {
        clearTimeout(activitySocketDebounceRef.current);
      }
      activitySocketDebounceRef.current = setTimeout(() => {
        fetchActivityLogsSilentlyRef.current?.();
      }, 300);
    };

    socket.on('activity_log:new', debouncedFetch);
    socket.on('activity_log:new_batch', debouncedFetch);

    const fallbackInterval = setInterval(() => {
      if (document.visibilityState !== 'visible' || activityPageRef.current !== 1) return;
      fetchActivityLogsSilentlyRef.current?.();
    }, 30000);
    activityFallbackIntervalRef.current = fallbackInterval;

    return () => {
      if (activityFallbackIntervalRef.current) {
        clearInterval(activityFallbackIntervalRef.current);
        activityFallbackIntervalRef.current = null;
      }
      if (activitySocketDebounceRef.current) {
        clearTimeout(activitySocketDebounceRef.current);
        activitySocketDebounceRef.current = null;
      }
      if (socket) {
        socket.emit('activity_logs:leave');
        socket.removeAllListeners();
        socket.disconnect();
        activitySocketRef.current = null;
      }
    };
  }, []);

  const handleChangeFilter = (field, value) => {
    setActivityFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleApplyFilters = () => {
    fetchActivityLogs(1);
    fetchActivityStats();
  };

  const handleClearFilters = () => {
    setActivityFilters({
      event_context: '',
      event_type: '',
      component: '',
      username: '',
      start_date: '',
      end_date: '',
      start_date_only: '',
      start_time: '',
      end_date_only: '',
      end_time: '',
      search: ''
    });
    fetchActivityLogs(1);
    fetchActivityStats();
  };

  const handleChangePage = (page) => {
    if (page < 1 || page > (activityPagination.totalPages || 1)) return;
    fetchActivityLogs(page);
  };

  if (!hasLmsActivityAccess()) {
    return (
      <Container className="mt-4">
        <Alert variant="danger">Bạn không có quyền xem trang này.</Alert>
      </Container>
    );
  }

  return (
    <Container fluid className="mt-4">
      <Row className="mb-3">
        <Col>
          <h1>Nhật ký hoạt động LMS</h1>
          <p className="text-muted mb-0">
            Giám sát hoạt động người dùng trong module LMS (chỉ dành cho lms_admin và lms_qa).
          </p>
        </Col>
      </Row>

      {activityError && (
        <Alert variant="danger" onClose={() => setActivityError('')} dismissible>
          {activityError}
        </Alert>
      )}

      <Row className="mb-3">
        <Col md={8}>
          {activityStats && activityStats.total && (
            <Row>
              <Col md={3}>
                <Card className="modern-card mb-3">
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <h6 className="text-muted mb-2">Tổng hoạt động</h6>
                        <h3>{activityStats.total.total_activities?.toLocaleString()}</h3>
                      </div>
                      <div className="stat-icon bg-primary">
                        <i className="fas fa-chart-line"></i>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card className="modern-card mb-3">
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <h6 className="text-muted mb-2">Người dùng</h6>
                        <h3>{activityStats.total.unique_users}</h3>
                      </div>
                      <div className="stat-icon bg-success">
                        <i className="fas fa-users"></i>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card className="modern-card mb-3">
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <h6 className="text-muted mb-2">Phiên làm việc</h6>
                        <h3>{activityStats.total.unique_sessions}</h3>
                      </div>
                      <div className="stat-icon bg-info">
                        <i className="fas fa-desktop"></i>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3}>
                <Card className="modern-card mb-3">
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <h6 className="text-muted mb-2">Ngày hoạt động</h6>
                        <h3>{activityStats.total.active_days}</h3>
                      </div>
                      <div className="stat-icon bg-warning">
                        <i className="fas fa-calendar"></i>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          )}
        </Col>
        <Col md={4} className="text-md-end">
          <Button
            variant={showActivityFilters ? 'secondary' : 'outline-secondary'}
            className="mb-2 me-2"
            onClick={() => setShowActivityFilters(prev => !prev)}
          >
            <i className="fas fa-filter me-2" />
            {showActivityFilters ? 'Ẩn bộ lọc' : 'Hiện bộ lọc'}
          </Button>
          <Button
            variant="success"
            className="mb-2"
            onClick={() => exportActivityLogs('csv')}
          >
            <i className="fas fa-download me-2" />
            Export CSV
          </Button>
        </Col>
      </Row>

      {showActivityFilters && (
        <Card className="modern-card mb-3">
          <Card.Body>
            <Row className="g-3">
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Bối cảnh</Form.Label>
                  <Form.Select
                    value={activityFilters.event_context}
                    onChange={(e) => handleChangeFilter('event_context', e.target.value)}
                  >
                    <option value="">Tất cả</option>
                    <option value="authentication">Xác thực</option>
                    <option value="navigation">Điều hướng</option>
                    <option value="interaction">Tương tác</option>
                    <option value="api_call">Gọi API</option>
                    <option value="custom">Tùy chỉnh</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Loại sự kiện</Form.Label>
                  <Form.Select
                    value={activityFilters.event_type}
                    onChange={(e) => handleChangeFilter('event_type', e.target.value)}
                  >
                    <option value="">Tất cả</option>
                    <option value="login">Đăng nhập</option>
                    <option value="logout">Đăng xuất</option>
                    <option value="page_view">Xem trang</option>
                    <option value="api_call">Gọi API</option>
                    <option value="click">Click</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Component</Form.Label>
                  <Form.Control
                    type="text"
                    value={activityFilters.component}
                    onChange={(e) => handleChangeFilter('component', e.target.value)}
                    placeholder="VD: lms/LMSDashboard"
                  />
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Tên đăng nhập</Form.Label>
                  <Form.Control
                    type="text"
                    value={activityFilters.username}
                    onChange={(e) => handleChangeFilter('username', e.target.value)}
                    placeholder="username"
                  />
                </Form.Group>
              </Col>
            </Row>
            <Row className="g-3 mt-2">
              <Col md={12}>
                <hr className="my-3" />
                <h6 className="mb-3">
                  <i className="fas fa-calendar-alt me-2"></i>
                  Lọc theo thời gian
                </h6>
              </Col>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Ngày bắt đầu</Form.Label>
                  <Form.Control
                    type="date"
                    value={activityFilters.start_date_only}
                    onChange={(e) => {
                      const newFilters = { ...activityFilters, start_date_only: e.target.value };
                      if (e.target.value && activityFilters.start_time) {
                        newFilters.start_date = `${e.target.value}T${activityFilters.start_time}`;
                      } else if (e.target.value) {
                        newFilters.start_date = `${e.target.value}T00:00:00`;
                      } else {
                        newFilters.start_date = '';
                      }
                      setActivityFilters(newFilters);
                    }}
                  />
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Thời gian bắt đầu (HH:mm:ss)</Form.Label>
                  <Form.Control
                    type="time"
                    step="1"
                    value={activityFilters.start_time}
                    onChange={(e) => {
                      const newFilters = { ...activityFilters, start_time: e.target.value };
                      if (activityFilters.start_date_only && e.target.value) {
                        newFilters.start_date = `${activityFilters.start_date_only}T${e.target.value}`;
                      } else if (activityFilters.start_date_only) {
                        newFilters.start_date = `${activityFilters.start_date_only}T00:00:00`;
                      } else {
                        newFilters.start_date = '';
                      }
                      setActivityFilters(newFilters);
                    }}
                  />
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Ngày kết thúc</Form.Label>
                  <Form.Control
                    type="date"
                    value={activityFilters.end_date_only}
                    onChange={(e) => {
                      const newFilters = { ...activityFilters, end_date_only: e.target.value };
                      if (e.target.value && activityFilters.end_time) {
                        newFilters.end_date = `${e.target.value}T${activityFilters.end_time}`;
                      } else if (e.target.value) {
                        newFilters.end_date = `${e.target.value}T23:59:59`;
                      } else {
                        newFilters.end_date = '';
                      }
                      setActivityFilters(newFilters);
                    }}
                  />
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Thời gian kết thúc (HH:mm:ss)</Form.Label>
                  <Form.Control
                    type="time"
                    step="1"
                    value={activityFilters.end_time}
                    onChange={(e) => {
                      const newFilters = { ...activityFilters, end_time: e.target.value };
                      if (activityFilters.end_date_only && e.target.value) {
                        newFilters.end_date = `${activityFilters.end_date_only}T${e.target.value}`;
                      } else if (activityFilters.end_date_only) {
                        newFilters.end_date = `${activityFilters.end_date_only}T23:59:59`;
                      } else {
                        newFilters.end_date = '';
                      }
                      setActivityFilters(newFilters);
                    }}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mt-2">
                  <Form.Label>Từ khóa</Form.Label>
                  <Form.Control
                    type="text"
                    value={activityFilters.search}
                    onChange={(e) => handleChangeFilter('search', e.target.value)}
                    placeholder="Tìm trong mô tả, IP, user..."
                  />
                </Form.Group>
              </Col>
              <Col md={6} className="d-flex align-items-end justify-content-md-end">
                <div className="d-flex gap-2 w-100 justify-content-md-end">
                  <Button variant="primary" onClick={handleApplyFilters} className="flex-grow-1 flex-md-grow-0">
                    <i className="fas fa-search me-2" />
                    Áp dụng bộ lọc
                  </Button>
                  <Button variant="outline-secondary" onClick={handleClearFilters} className="flex-grow-1 flex-md-grow-0">
                    <i className="fas fa-times me-2" />
                    Xóa bộ lọc
                  </Button>
                </div>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      )}

      <Card>
        <Card.Body>

            <Table className="session-table" responsive hover>
              <thead>
                <tr>
                  <th style={{ minWidth: '150px' }}>Thời gian</th>
                  <th style={{ minWidth: '120px' }}>Tên người dùng</th>
                  <th style={{ minWidth: '150px' }}>Người bị ảnh hưởng</th>
                  <th style={{ minWidth: '120px' }}>Bối cảnh</th>
                  <th style={{ minWidth: '120px' }}>Component</th>
                  <th style={{ minWidth: '150px' }}>Tên sự kiện</th>
                  <th style={{ minWidth: '250px' }}>Mô tả</th>
                  <th style={{ minWidth: '150px' }}>Nguồn gốc</th>
                  <th style={{ minWidth: '120px' }}>Địa chỉ IP</th>
                </tr>
              </thead>
              <tbody>
                {activityLoading && activityLogs.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center py-4">
                      <Spinner animation="border" size="sm" className="me-2" />
                      Đang tải nhật ký hoạt động...
                    </td>
                  </tr>
                ) : activityLogs.length > 0 ? (
                  activityLogs.map((log) => (
                    <tr 
                      key={log.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        setSelectedActivityLog(log);
                        setShowActivityDetailModal(true);
                      }}
                      className="activity-log-row"
                    >
                      <td>
                        <div className="text-nowrap">
                          {new Date(log.created_at).toLocaleString('vi-VN')}
                        </div>
                        <small className="text-muted">
                          {log.time_category === 'just_now' && '(Vừa xong)'}
                          {log.time_category === 'recent' && '(Gần đây)'}
                          {log.time_category === 'today' && '(Hôm nay)'}
                        </small>
                      </td>
                      <td>
                        <div>
                          <strong>{log.username || 'Ẩn danh'}</strong>
                          {log.user_email && (
                            <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                              {log.user_email}
                            </div>
                          )}
                        </div>
                        <Badge bg={
                          log.user_role === 'superadmin' || log.user_role === 'Quản trị viên cấp cao' ? 'danger' :
                          log.user_role === 'admin' || log.user_role === 'Quản trị viên' ? 'warning' :
                          log.user_role === 'staff' || log.user_role === 'Nhân viên' ? 'info' : 'secondary'
                        } className="mt-1">
                          {formatUserRole(log.user_role)}
                        </Badge>
                      </td>
                      <td>
                        <div>
                          <span>{log.affected_username || '—'}</span>
                          {log.affected_user_role && (
                            <div className="text-muted small">
                              {formatUserRole(log.affected_user_role)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <Badge bg={
                          log.event_context === 'authentication' ? 'success' :
                          log.event_context === 'navigation' ? 'primary' :
                          log.event_context === 'interaction' ? 'info' :
                          log.event_context === 'api_call' ? 'warning' : 'secondary'
                        }>
                          {formatEventContext(log.event_context)}
                        </Badge>
                      </td>
                      <td>{log.component || '—'}</td>
                      <td>{formatEventType(log.event_type)}</td>
                      <td className="text-truncate" style={{ maxWidth: '260px' }}>
                        {log.description || '—'}
                      </td>
                      <td className="text-truncate" style={{ maxWidth: '200px' }}>
                        {log.origin || log.page_url || '—'}
                      </td>
                      <td><code>{log.ip_address || '—'}</code></td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" className="text-center text-muted py-4">
                      Không có nhật ký hoạt động nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>

          {activityPagination.totalPages > 1 && (
            <div className="mt-3">
              <Pagination
                currentPage={activityPagination.page}
                totalPages={activityPagination.totalPages}
                onPageChange={(page) => fetchActivityLogs(page)}
                maxVisiblePages={5}
                showFirstLast={true}
              />
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Modal chi tiết nhật ký hoạt động (giống SystemPage nhưng dành cho LMS) */}
      <Modal
        show={showActivityDetailModal}
        onHide={() => setShowActivityDetailModal(false)}
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="fas fa-info-circle me-2"></i>
            Chi tiết Nhật ký Hoạt động LMS
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedActivityLog && (
            <div>
              <Card className="mb-3">
                <Card.Header className="bg-primary text-white">
                  <h6 className="mb-0">
                    <i className="fas fa-user me-2"></i>
                    Thông tin Người dùng
                  </h6>
                </Card.Header>
                <Card.Body>
                  <Row>
                    <Col md={6}>
                      <div className="mb-2">
                        <strong>Tên người dùng:</strong>
                        <div>
                          {selectedActivityLog.username || 'Ẩn danh'}
                          {selectedActivityLog.user_email && (
                            <div className="text-muted" style={{ fontSize: '0.85rem', marginTop: '2px' }}>
                              {selectedActivityLog.user_email}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mb-2">
                        <strong>Vai trò:</strong>
                        <div>
                          <Badge bg={
                            selectedActivityLog.user_role === 'superadmin' || selectedActivityLog.user_role === 'Quản trị viên cấp cao' ? 'danger' :
                            selectedActivityLog.user_role === 'admin' || selectedActivityLog.user_role === 'Quản trị viên' ? 'warning' :
                            selectedActivityLog.user_role === 'staff' || selectedActivityLog.user_role === 'Nhân viên' ? 'info' : 'secondary'
                          }>
                            {formatUserRole(selectedActivityLog.user_role)}
                          </Badge>
                        </div>
                      </div>
                      {selectedActivityLog.user_id && (
                        <div className="mb-2">
                          <strong>User ID:</strong>
                          <div><code>{selectedActivityLog.user_id}</code></div>
                        </div>
                      )}
                    </Col>
                    <Col md={6}>
                      {selectedActivityLog.affected_username && (
                        <>
                          <div className="mb-2">
                            <strong>Người bị ảnh hưởng:</strong>
                            <div>{selectedActivityLog.affected_username}</div>
                          </div>
                          <div className="mb-2">
                            <strong>Affected User ID:</strong>
                            <div><code>{selectedActivityLog.affected_user_id}</code></div>
                          </div>
                        </>
                      )}
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              <Card className="mb-3">
                <Card.Header className="bg-info text-white">
                  <h6 className="mb-0">
                    <i className="fas fa-calendar-alt me-2"></i>
                    Thông tin Sự kiện
                  </h6>
                </Card.Header>
                <Card.Body>
                  <Row>
                    <Col md={6}>
                      <div className="mb-2">
                        <strong>Thời gian:</strong>
                        <div>{new Date(selectedActivityLog.created_at).toLocaleString('vi-VN')}</div>
                      </div>
                      <div className="mb-2">
                        <strong>Bối cảnh:</strong>
                        <div>
                          <Badge bg={
                            selectedActivityLog.event_context === 'authentication' ? 'success' :
                            selectedActivityLog.event_context === 'navigation' ? 'primary' :
                            selectedActivityLog.event_context === 'interaction' ? 'info' :
                            selectedActivityLog.event_context === 'api_call' ? 'warning' : 'secondary'
                          }>
                            {formatEventContext(selectedActivityLog.event_context)}
                          </Badge>
                        </div>
                      </div>
                      <div className="mb-2">
                        <strong>Loại sự kiện:</strong>
                        <div>
                          <Badge bg="light" text="dark">
                            {formatEventType(selectedActivityLog.event_type)}
                          </Badge>
                        </div>
                      </div>
                      <div className="mb-2">
                        <strong>Tên sự kiện:</strong>
                        <div><code>{selectedActivityLog.event_name}</code></div>
                      </div>
                    </Col>
                    <Col md={6}>
                      <div className="mb-2">
                        <strong>Component:</strong>
                        <div><code>{selectedActivityLog.component || '-'}</code></div>
                      </div>
                      <div className="mb-2">
                        <strong>Mô tả:</strong>
                        <div>{selectedActivityLog.description || '-'}</div>
                      </div>
                      {selectedActivityLog.target_element && (
                        <div className="mb-2">
                          <strong>Element:</strong>
                          <div><code>{selectedActivityLog.target_element}</code></div>
                        </div>
                      )}
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              <Card className="mb-3">
                <Card.Header className="bg-secondary text-white">
                  <h6 className="mb-0">
                    <i className="fas fa-server me-2"></i>
                    Thông tin Kỹ thuật
                  </h6>
                </Card.Header>
                <Card.Body>
                  <Row>
                    <Col md={6}>
                      <div className="mb-2">
                        <strong>Địa chỉ IP:</strong>
                        <div><code className="text-info">{selectedActivityLog.ip_address}</code></div>
                      </div>
                      <div className="mb-2">
                        <strong>Nguồn gốc:</strong>
                        <div className="text-truncate" title={selectedActivityLog.origin}>
                          {selectedActivityLog.origin || selectedActivityLog.page_url || '-'}
                        </div>
                      </div>
                      <div className="mb-2">
                        <strong>Page URL:</strong>
                        <div className="text-truncate" title={selectedActivityLog.page_url}>
                          {selectedActivityLog.page_url || '-'}
                        </div>
                      </div>
                      {selectedActivityLog.session_id && (
                        <div className="mb-2">
                          <strong>Session ID:</strong>
                          <div><code className="small">{selectedActivityLog.session_id}</code></div>
                        </div>
                      )}
                    </Col>
                    <Col md={6}>
                      {selectedActivityLog.device_info && (
                        <>
                          <div className="mb-2">
                            <strong>User Agent:</strong>
                            <div className="small text-muted">
                              {typeof selectedActivityLog.device_info === 'object' 
                                ? selectedActivityLog.device_info.userAgent 
                                : selectedActivityLog.device_info}
                            </div>
                          </div>
                          {typeof selectedActivityLog.device_info === 'object' && (
                            <>
                              <div className="mb-2">
                                <strong>Platform:</strong>
                                <div>{selectedActivityLog.device_info.platform || '-'}</div>
                              </div>
                              <div className="mb-2">
                                <strong>Mobile:</strong>
                                <div>{selectedActivityLog.device_info.mobile ? 'Có' : 'Không'}</div>
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            </div>
          )}
        </Modal.Body>
      </Modal>
    </Container>
  );
};

export default LMSActivityLogsPage;

