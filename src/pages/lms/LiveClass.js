import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert, Badge, Card, Table, InputGroup } from 'react-bootstrap';
import axios from 'axios';
import Pagination from '../../components/Pagination';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const LiveClass = () => {
  usePageTitle('Lớp học trực tuyến');
  const [loading, setLoading] = useState(false);
  const [liveSessions, setLiveSessions] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [alert, setAlert] = useState({ show: false, message: '', variant: '' });

  // Filters
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    provider: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalItems: 0,
    totalPages: 0
  });

  // Form data
  const [sessionForm, setSessionForm] = useState({
    session_title: '',
    session_description: '',
    course_id: null,
    class_id: null,
    provider: 'bigbluebutton',
    scheduled_start: '',
    scheduled_end: '',
    max_participants: 50,
    record_session: true,
    moderator_password: '',
    attendee_password: '',
    allow_guests: false
  });

  useEffect(() => {
    fetchLiveSessions();
  }, [filters]);

  // Update pagination when liveSessions change
  useEffect(() => {
    const totalItems = liveSessions.length;
    const totalPages = Math.ceil(totalItems / pagination.limit);
    setPagination(prev => ({
      ...prev,
      totalItems,
      totalPages,
      page: prev.page > totalPages && totalPages > 0 ? totalPages : prev.page
    }));
  }, [liveSessions, pagination.limit]);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  const fetchLiveSessions = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Mock data for now (replace with real API call)
      const mockSessions = [
        {
          session_id: 1,
          session_title: 'Lớp Tim mạch - Buổi 1',
          course_name: 'Tim mạch lâm sàng',
          class_name: 'CARD-301-K65',
          provider: 'bigbluebutton',
          scheduled_start: '2024-11-10T08:00:00',
          scheduled_end: '2024-11-10T10:00:00',
          status: 'scheduled',
          join_url: 'https://bbb.example.com/join/abc123',
          moderator_url: 'https://bbb.example.com/join/abc123?moderator',
          record_url: null,
          participants_count: 0,
          max_participants: 50
        },
        {
          session_id: 2,
          session_title: 'OSCE Thực hành - Case Study',
          course_name: 'OSCE Kỹ năng lâm sàng',
          class_name: 'OSCE-101-K65',
          provider: 'zoom',
          scheduled_start: '2024-11-10T14:00:00',
          scheduled_end: '2024-11-10T16:00:00',
          status: 'live',
          join_url: 'https://zoom.us/j/123456789',
          moderator_url: 'https://zoom.us/j/123456789?pwd=xxx',
          record_url: 'https://zoom.us/rec/share/xxx',
          participants_count: 28,
          max_participants: 50
        }
      ];

      setLiveSessions(mockSessions);
    } catch (error) {
      console.error('Error fetching live sessions:', error);
      showAlert('Lỗi khi tải danh sách lớp học trực tuyến', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSession = () => {
    setSessionForm({
      session_title: '',
      session_description: '',
      course_id: null,
      class_id: null,
      provider: 'bigbluebutton',
      scheduled_start: '',
      scheduled_end: '',
      max_participants: 50,
      record_session: true,
      moderator_password: '',
      attendee_password: '',
      allow_guests: false
    });
    setShowCreateModal(true);
  };

  const handleSubmitSession = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('token');
      
      // In production, create session via API
      // const response = await axios.post(`${API_BASE_URL}/lms/live-sessions`, sessionForm, {
      //   headers: { Authorization: `Bearer ${token}` }
      // });

      showAlert('Tạo lớp học trực tuyến thành công', 'success');
      setShowCreateModal(false);
      fetchLiveSessions();
    } catch (error) {
      console.error('Error creating session:', error);
      showAlert('Lỗi khi tạo lớp học trực tuyến', 'danger');
    }
  };

  const handleJoinSession = (session) => {
    setSelectedSession(session);
    setShowJoinModal(true);
  };

  const handleStartSession = async (sessionId) => {
    try {
      const token = localStorage.getItem('token');
      
      // In production, start session via API
      // const response = await axios.post(`${API_BASE_URL}/lms/live-sessions/${sessionId}/start`, {}, {
      //   headers: { Authorization: `Bearer ${token}` }
      // });

      showAlert('Bắt đầu lớp học thành công', 'success');
      fetchLiveSessions();
    } catch (error) {
      console.error('Error starting session:', error);
      showAlert('Lỗi khi bắt đầu lớp học', 'danger');
    }
  };

  const handleEndSession = async (sessionId) => {
    if (!window.confirm('Bạn có chắc chắn muốn kết thúc lớp học này?')) return;

    try {
      const token = localStorage.getItem('token');
      
      // In production, end session via API
      // await axios.post(`${API_BASE_URL}/lms/live-sessions/${sessionId}/end`, {}, {
      //   headers: { Authorization: `Bearer ${token}` }
      // });

      showAlert('Kết thúc lớp học thành công', 'success');
      fetchLiveSessions();
    } catch (error) {
      console.error('Error ending session:', error);
      showAlert('Lỗi khi kết thúc lớp học', 'danger');
    }
  };

  const showAlert = (message, variant) => {
    setAlert({ show: true, message, variant });
    setTimeout(() => setAlert({ show: false, message: '', variant: '' }), 5000);
  };

  const getStatusBadge = (status) => {
    const config = {
      scheduled: { bg: 'secondary', text: 'Đã lên lịch' },
      live: { bg: 'danger', text: 'Đang diễn ra' },
      ended: { bg: 'dark', text: 'Đã kết thúc' },
      cancelled: { bg: 'warning', text: 'Đã hủy' }
    };
    const c = config[status] || config.scheduled;
    return <Badge bg={c.bg}>{c.text}</Badge>;
  };

  const getProviderBadge = (provider) => {
    const config = {
      bigbluebutton: { bg: 'primary', text: 'BigBlueButton', icon: 'video' },
      zoom: { bg: 'info', text: 'Zoom', icon: 'video' },
      teams: { bg: 'success', text: 'Teams', icon: 'microsoft' }
    };
    const c = config[provider] || config.bigbluebutton;
    return <Badge bg={c.bg}><i className={`fab fa-${c.icon} me-1`}></i>{c.text}</Badge>;
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="container-fluid session-main-container">
      {/* Header */}
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Lớp học Trực tuyến</h1>
            <p className="header-subtitle">Quản lý lớp học trực tuyến, tích hợp BigBlueButton/Zoom/Teams, ghi hình & điểm danh</p>
          </div>
          <div className="header-actions">
            <Button variant="light" className="create-session-btn" onClick={handleCreateSession}>
              <i className="fas fa-plus me-2"></i>Tạo lớp học mới
            </Button>
          </div>
        </div>
      </div>

      {/* Alert */}
      {alert.show && (
        <Alert variant={alert.variant} dismissible onClose={() => setAlert({ ...alert, show: false })}>
          {alert.message}
        </Alert>
      )}

      {/* Filters */}
      <div className="session-list-controls">
        <div className="search-controls">
          <div className="search-input">
            <input
              type="text"
              placeholder="Tìm theo tên lớp học..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>

          <select
            className="filter-select"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="scheduled">Đã lên lịch</option>
            <option value="live">Đang diễn ra</option>
            <option value="ended">Đã kết thúc</option>
            <option value="cancelled">Đã hủy</option>
          </select>

          <select
            className="filter-select"
            value={filters.provider}
            onChange={(e) => setFilters({ ...filters, provider: e.target.value })}
          >
            <option value="">Tất cả nền tảng</option>
            <option value="bigbluebutton">BigBlueButton</option>
            <option value="zoom">Zoom</option>
            <option value="teams">Microsoft Teams</option>
          </select>

          <Button variant="outline-primary" onClick={fetchLiveSessions}>
            <i className="fas fa-sync me-2"></i>Tải lại
          </Button>
        </div>
      </div>

      {/* Live Sessions Table */}
      <div className="session-table-container">
        {loading ? (
          <div className="text-center p-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Đang tải...</span>
            </div>
          </div>
        ) : (
          <>
            <div className="table-responsive-mobile">
              <table className="session-table">
                <thead>
                  <tr>
                    <th>Tên lớp học</th>
                    <th>Khóa học</th>
                    <th>Nền tảng</th>
                    <th>Thời gian</th>
                    <th>Tham gia</th>
                    <th>Trạng thái</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {liveSessions.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center p-4">
                        <i className="fas fa-inbox fa-3x text-muted mb-3"></i>
                        <p className="text-muted">Chưa có lớp học trực tuyến nào. Nhấn "Tạo lớp học mới" để bắt đầu.</p>
                      </td>
                    </tr>
                  ) : (
                    liveSessions
                      .slice((pagination.page - 1) * pagination.limit, pagination.page * pagination.limit)
                      .map((session) => (
                      <tr key={session.session_id}>
                        <td>
                          <strong>{session.session_title}</strong>
                          {session.session_description && (
                            <div className="text-muted small">{session.session_description.substring(0, 60)}...</div>
                          )}
                        </td>
                        <td>
                          <Badge bg="info">{session.course_name}</Badge>
                          <div className="text-muted small">{session.class_name}</div>
                        </td>
                        <td>{getProviderBadge(session.provider)}</td>
                        <td>
                          <div><strong>Bắt đầu:</strong> {formatDateTime(session.scheduled_start)}</div>
                          <div><strong>Kết thúc:</strong> {formatDateTime(session.scheduled_end)}</div>
                        </td>
                        <td>
                          <Badge bg="primary">
                            {session.participants_count || 0} / {session.max_participants}
                          </Badge>
                        </td>
                        <td>{getStatusBadge(session.status)}</td>
                        <td>
                          <div className="action-buttons">
                            {session.status === 'scheduled' && (
                              <Button
                                size="sm"
                                variant="outline-success"
                                onClick={() => handleStartSession(session.session_id)}
                                title="Bắt đầu"
                              >
                                <i className="fas fa-play"></i>
                              </Button>
                            )}
                            {session.status === 'live' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline-primary"
                                  onClick={() => handleJoinSession(session)}
                                  title="Tham gia"
                                >
                                  <i className="fas fa-video"></i>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline-danger"
                                  onClick={() => handleEndSession(session.session_id)}
                                  title="Kết thúc"
                                >
                                  <i className="fas fa-stop"></i>
                                </Button>
                              </>
                            )}
                            {session.record_url && (
                              <Button
                                size="sm"
                                variant="outline-info"
                                href={session.record_url}
                                target="_blank"
                                title="Xem ghi hình"
                              >
                                <i className="fas fa-film"></i>
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {liveSessions.length > 0 && pagination.totalPages > 1 && (
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

      {/* Create Session Modal */}
      <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Tạo Lớp học Trực tuyến</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmitSession}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Tên lớp học *</Form.Label>
              <Form.Control
                type="text"
                value={sessionForm.session_title}
                onChange={(e) => setSessionForm({ ...sessionForm, session_title: e.target.value })}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Mô tả</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={sessionForm.session_description}
                onChange={(e) => setSessionForm({ ...sessionForm, session_description: e.target.value })}
              />
            </Form.Group>

            <div className="row">
              <div className="col-md-6">
                <Form.Group className="mb-3">
                  <Form.Label>Nền tảng *</Form.Label>
                  <Form.Select
                    value={sessionForm.provider}
                    onChange={(e) => setSessionForm({ ...sessionForm, provider: e.target.value })}
                    required
                  >
                    <option value="bigbluebutton">BigBlueButton</option>
                    <option value="zoom">Zoom</option>
                    <option value="teams">Microsoft Teams</option>
                  </Form.Select>
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group className="mb-3">
                  <Form.Label>Số người tham gia tối đa</Form.Label>
                  <Form.Control
                    type="number"
                    value={sessionForm.max_participants}
                    onChange={(e) => setSessionForm({ ...sessionForm, max_participants: parseInt(e.target.value) })}
                  />
                </Form.Group>
              </div>
            </div>

            <div className="row">
              <div className="col-md-6">
                <Form.Group className="mb-3">
                  <Form.Label>Thời gian bắt đầu *</Form.Label>
                  <Form.Control
                    type="datetime-local"
                    value={sessionForm.scheduled_start}
                    onChange={(e) => setSessionForm({ ...sessionForm, scheduled_start: e.target.value })}
                    required
                  />
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group className="mb-3">
                  <Form.Label>Thời gian kết thúc *</Form.Label>
                  <Form.Control
                    type="datetime-local"
                    value={sessionForm.scheduled_end}
                    onChange={(e) => setSessionForm({ ...sessionForm, scheduled_end: e.target.value })}
                    required
                  />
                </Form.Group>
              </div>
            </div>

            <Form.Check
              type="checkbox"
              label="Ghi hình lớp học"
              checked={sessionForm.record_session}
              onChange={(e) => setSessionForm({ ...sessionForm, record_session: e.target.checked })}
              className="mb-3"
            />

            <Form.Check
              type="checkbox"
              label="Cho phép khách tham gia"
              checked={sessionForm.allow_guests}
              onChange={(e) => setSessionForm({ ...sessionForm, allow_guests: e.target.checked })}
              className="mb-3"
            />

            {sessionForm.provider === 'bigbluebutton' && (
              <div className="row">
                <div className="col-md-6">
                  <Form.Group className="mb-3">
                    <Form.Label>Mật khẩu Moderator</Form.Label>
                    <Form.Control
                      type="text"
                      value={sessionForm.moderator_password}
                      onChange={(e) => setSessionForm({ ...sessionForm, moderator_password: e.target.value })}
                      placeholder="Để trống để tự động tạo"
                    />
                  </Form.Group>
                </div>
                <div className="col-md-6">
                  <Form.Group className="mb-3">
                    <Form.Label>Mật khẩu Attendee</Form.Label>
                    <Form.Control
                      type="text"
                      value={sessionForm.attendee_password}
                      onChange={(e) => setSessionForm({ ...sessionForm, attendee_password: e.target.value })}
                      placeholder="Để trống để tự động tạo"
                    />
                  </Form.Group>
                </div>
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              Hủy
            </Button>
            <Button variant="primary" type="submit">
              <i className="fas fa-save me-2"></i>Tạo lớp học
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Join Session Modal */}
      <Modal show={showJoinModal} onHide={() => setShowJoinModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Tham gia Lớp học</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedSession && (
            <>
              <Alert variant="info">
                <strong>{selectedSession.session_title}</strong>
                <div className="mt-2">
                  <div><strong>Nền tảng:</strong> {getProviderBadge(selectedSession.provider)}</div>
                  <div><strong>Thời gian:</strong> {formatDateTime(selectedSession.scheduled_start)}</div>
                </div>
              </Alert>

              <div className="d-grid gap-2">
                <Button
                  variant="primary"
                  size="lg"
                  href={selectedSession.join_url}
                  target="_blank"
                >
                  <i className="fas fa-video me-2"></i>Tham gia như Học viên
                </Button>

                {selectedSession.moderator_url && (
                  <Button
                    variant="warning"
                    size="lg"
                    href={selectedSession.moderator_url}
                    target="_blank"
                  >
                    <i className="fas fa-user-shield me-2"></i>Tham gia như Giảng viên
                  </Button>
                )}

                {selectedSession.record_url && (
                  <Button
                    variant="info"
                    size="lg"
                    href={selectedSession.record_url}
                    target="_blank"
                  >
                    <i className="fas fa-film me-2"></i>Xem Ghi hình
                  </Button>
                )}
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowJoinModal(false)}>
            Đóng
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default LiveClass;
