/**
 * LMS Live Class - Webex Integration
 * Admin/Staff: Hiển thị rooms Webex, gán sinh viên, tạo cuộc họp
 * Student: Hiển thị rooms được gán
 */
import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Button, Badge, Spinner, Alert, Modal, Form, Table, ListGroup, Nav } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import usePageTitle from '../../hooks/usePageTitle';
import { WebexMeetingsWidget } from '@webex/widgets';
import '@webex/widgets/dist/css/webex-widgets.css';
import '../../styles/dashboard.css';
import '../../styles/user.css';

const API = '/lms';

const isStaff = (user) => {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'superadmin') return true;
  const roles = user.module_roles || [];
  return Array.isArray(roles) && (
    roles.includes('lms_admin') || roles.includes('lms_qa') ||
    roles.includes('lms_mod') || roles.includes('lms_staff')
  );
};

const LiveClass = () => {
  usePageTitle('Lớp học trực tuyến - Webex');
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState({ show: false, message: '', variant: 'info' });
  const [webexConnected, setWebexConnected] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [myRooms, setMyRooms] = useState([]);
  const [students, setStudents] = useState([]);
  const [assignModal, setAssignModal] = useState({ show: false, room: null });
  const [selectedStudent, setSelectedStudent] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [roomAssignments, setRoomAssignments] = useState({});
  const [createMeetingModal, setCreateMeetingModal] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingStart, setMeetingStart] = useState('');
  const [meetingEnd, setMeetingEnd] = useState('');
  const [creatingMeeting, setCreatingMeeting] = useState(false);
  const [createdMeeting, setCreatedMeeting] = useState(null);
  const [activeTab, setActiveTab] = useState('rooms'); // 'rooms' | 'meetings'
  const [meetings, setMeetings] = useState([]);
  const [meetingsLoading, setMeetingsLoading] = useState(false);
  const [createRoomModal, setCreateRoomModal] = useState(false);
  const [newRoomTitle, setNewRoomTitle] = useState('');
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [editRoomModal, setEditRoomModal] = useState({ show: false, room: null, title: '' });
  const [updatingRoom, setUpdatingRoom] = useState(false);
  // Admin / org-wide
  const [adminRecordings, setAdminRecordings] = useState([]);
  const [auditEvents, setAuditEvents] = useState([]);
  const [adminRecordingsLoading, setAdminRecordingsLoading] = useState(false);
  const [auditEventsLoading, setAuditEventsLoading] = useState(false);
  const [joiningMeetingId, setJoiningMeetingId] = useState(null);
  const [embedMeeting, setEmbedMeeting] = useState(null);
  const [embedToken, setEmbedToken] = useState(null);
  const [embedTokenError, setEmbedTokenError] = useState(false);

  const staff = isStaff(currentUser);

  const showAlert = (message, variant = 'info') => {
    setAlert({ show: true, message, variant });
    setTimeout(() => setAlert({ show: false, message: '', variant }), 5000);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('webex_connected') === '1') {
      showAlert('Đã kết nối Webex thành công!', 'success');
      window.history.replaceState({}, '', '/lms/live');
    }
    if (params.get('webex_error')) {
      const err = params.get('webex_error');
      const messages = {
        no_code: 'Thiếu mã xác thực từ Webex.',
        config: 'Webex chưa được cấu hình (WEBEX_CLIENT_ID, WEBEX_CLIENT_SECRET).',
        session_expired: 'Phiên OAuth đã hết hạn. Vui lòng thử lại.',
        token_failed: 'Không thể lấy token từ Webex.',
        callback: 'Lỗi xử lý callback Webex.'
      };
      showAlert(messages[err] || 'Lỗi kết nối Webex.', 'danger');
      window.history.replaceState({}, '', '/lms/live');
    }
  }, []);

  useEffect(() => {
    if (staff) {
      fetchStaffData();
    } else {
      fetchMyRooms();
    }
  }, [staff]);

  const fetchStaffData = async () => {
    setLoading(true);
    try {
      const [statusRes, roomsRes] = await Promise.all([
        api.get(`${API}/webex/status`),
        api.get(`${API}/webex/rooms`).catch(() => ({ data: { success: false } }))
      ]);
      setWebexConnected(!!(statusRes.data?.connected));
      if (roomsRes.data?.success) {
        setRooms(roomsRes.data.data || []);
      } else {
        setRooms([]);
      }
    } catch (e) {
      setWebexConnected(false);
      setRooms([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyRooms = async () => {
    setLoading(true);
    try {
      const res = await api.get(`${API}/webex/my-rooms`);
      if (res.data?.success) {
        setMyRooms(res.data.data || []);
      }
    } catch (e) {
      setMyRooms([]);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectWebex = async () => {
    try {
      const res = await api.get(`${API}/webex/auth-url`);
      if (res.data?.success && res.data.authUrl) {
        window.location.href = res.data.authUrl;
      } else {
        showAlert(res.data?.message || 'Không thể lấy URL kết nối Webex.', 'danger');
      }
    } catch (e) {
      showAlert(e.response?.data?.message || 'Lỗi kết nối Webex.', 'danger');
    }
  };

  const fetchRoomAssignments = async (roomId) => {
    try {
      const res = await api.get(`${API}/webex/rooms/${roomId}/assignments`);
      if (res.data?.success) {
        setRoomAssignments(prev => ({ ...prev, [roomId]: res.data.data || [] }));
      }
    } catch (e) {
      setRoomAssignments(prev => ({ ...prev, [roomId]: [] }));
    }
  };

  const openAssignModal = (room) => {
    setAssignModal({ show: true, room });
    setSelectedStudent('');
    fetchRoomAssignments(room.id);
    fetchStudents();
  };

  const fetchStudents = async (search = '') => {
    try {
      const res = await api.get(`${API}/webex/students?search=${encodeURIComponent(search)}`);
      if (res.data?.success) {
        setStudents(res.data.data || []);
      }
    } catch (e) {
      setStudents([]);
    }
  };

  const handleAssign = async () => {
    if (!assignModal.room || !selectedStudent) return;
    setAssigning(true);
    try {
      await api.post(`${API}/webex/rooms/${assignModal.room.id}/assign`, {
        user_id: parseInt(selectedStudent, 10)
      });
      showAlert('Đã gán sinh viên vào phòng.', 'success');
      fetchRoomAssignments(assignModal.room.id);
      setAssignModal(prev => ({ ...prev, show: false }));
    } catch (e) {
      showAlert(e.response?.data?.message || 'Không thể gán sinh viên.', 'danger');
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassign = async (roomId, userId) => {
    try {
      await api.delete(`${API}/webex/rooms/${roomId}/assign/${userId}`);
      showAlert('Đã bỏ gán sinh viên.', 'success');
      fetchRoomAssignments(roomId);
    } catch (e) {
      showAlert(e.response?.data?.message || 'Không thể bỏ gán.', 'danger');
    }
  };

  const handleCreateMeeting = async () => {
    setCreatingMeeting(true);
    try {
      const res = await api.post(`${API}/webex/meetings`, {
        title: meetingTitle || 'Cuộc họp LMS',
        start: meetingStart || new Date().toISOString(),
        end: meetingEnd || new Date(Date.now() + 3600000).toISOString()
      });
      if (res.data?.success && res.data.data) {
        setCreatedMeeting(res.data.data);
        showAlert('Đã tạo cuộc họp Webex!', 'success');
      }
    } catch (e) {
      const msg = e.response?.data?.message || e.response?.data?.detail || 'Không thể tạo cuộc họp.';
      showAlert(typeof msg === 'string' ? msg : 'Không thể tạo cuộc họp.', 'danger');
    } finally {
      setCreatingMeeting(false);
    }
  };

  const fetchMeetings = async () => {
    setMeetingsLoading(true);
    try {
      const from = new Date().toISOString();
      const to = new Date(Date.now() + 30 * 24 * 3600000).toISOString();
      const res = await api.get(`${API}/webex/meetings?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      if (res.data?.success) {
        setMeetings(res.data.data || []);
      } else {
        setMeetings([]);
      }
    } catch (e) {
      setMeetings([]);
    } finally {
      setMeetingsLoading(false);
    }
  };

  const handleJoinMeeting = async (m) => {
    let joinUrl = m.joinUrl;
    let meetingNumber = m.meetingNumber;
    if (!joinUrl) {
      setJoiningMeetingId(m.id);
      try {
        const res = await api.get(`${API}/webex/meetings/${m.id}`);
        if (res.data?.success && res.data.data) {
          joinUrl = res.data.data.joinUrl;
          meetingNumber = meetingNumber || res.data.data.meetingNumber;
          setMeetings(prev => prev.map(x => x.id === m.id ? { ...x, joinUrl, meetingNumber } : x));
        }
      } catch (e) {
        showAlert(e.response?.data?.message || 'Không thể lấy link tham gia.', 'danger');
        setJoiningMeetingId(null);
        return;
      } finally {
        setJoiningMeetingId(null);
      }
    }
    if (joinUrl || meetingNumber) {
      setEmbedToken(null);
      setEmbedTokenError(false);
      setEmbedMeeting({
        joinUrl: joinUrl || '',
        meetingNumber: meetingNumber ? String(meetingNumber).replace(/\s/g, '') : '',
        title: m.title || 'Cuộc họp'
      });
    } else {
      showAlert('Không lấy được link tham gia từ Webex.', 'warning');
    }
  };

  const handleCreateRoom = async () => {
    if (!newRoomTitle.trim()) return;
    setCreatingRoom(true);
    try {
      const res = await api.post(`${API}/webex/rooms`, { title: newRoomTitle.trim() });
      if (res.data?.success && res.data.data) {
        setRooms(prev => [res.data.data, ...prev]);
        setCreateRoomModal(false);
        setNewRoomTitle('');
        showAlert('Đã tạo phòng Webex!', 'success');
      }
    } catch (e) {
      showAlert(e.response?.data?.message || 'Không thể tạo phòng.', 'danger');
    } finally {
      setCreatingRoom(false);
    }
  };

  const handleUpdateRoom = async () => {
    if (!editRoomModal.room || !editRoomModal.title.trim()) return;
    setUpdatingRoom(true);
    try {
      const res = await api.put(`${API}/webex/rooms/${editRoomModal.room.id}`, { title: editRoomModal.title.trim() });
      if (res.data?.success && res.data.data) {
        setRooms(prev => prev.map(r => r.id === editRoomModal.room.id ? { ...r, title: editRoomModal.title.trim() } : r));
        setEditRoomModal({ show: false, room: null, title: '' });
        showAlert('Đã cập nhật phòng.', 'success');
      }
    } catch (e) {
      showAlert(e.response?.data?.message || 'Không thể cập nhật phòng.', 'danger');
    } finally {
      setUpdatingRoom(false);
    }
  };

  useEffect(() => {
    if (staff && webexConnected && activeTab === 'meetings') {
      fetchMeetings();
    }
  }, [staff, webexConnected, activeTab]);

  const fetchAdminRecordings = async () => {
    setAdminRecordingsLoading(true);
    try {
      const res = await api.get(`${API}/webex/admin/recordings?max=50`);
      if (res.data?.success) {
        setAdminRecordings(res.data.data || []);
      } else {
        setAdminRecordings([]);
      }
    } catch (e) {
      setAdminRecordings([]);
    } finally {
      setAdminRecordingsLoading(false);
    }
  };

  const fetchAuditEvents = async () => {
    setAuditEventsLoading(true);
    try {
      const res = await api.get(`${API}/webex/audit/events?max=50`);
      if (res.data?.success) {
        setAuditEvents(res.data.data || []);
      } else {
        setAuditEvents([]);
      }
    } catch (e) {
      setAuditEvents([]);
    } finally {
      setAuditEventsLoading(false);
    }
  };

  useEffect(() => {
    if (!staff || !webexConnected) return;
    if (activeTab === 'recordings') fetchAdminRecordings();
    else if (activeTab === 'audit') fetchAuditEvents();
  }, [staff, webexConnected, activeTab]);

  useEffect(() => {
    if (!embedMeeting || !staff || !webexConnected) return;
    let cancelled = false;
    setEmbedTokenError(false);
    api.get(`${API}/webex/embed-token`)
      .then((res) => {
        if (!cancelled && res.data?.success && res.data.accessToken) {
          setEmbedToken(res.data.accessToken);
        } else if (!cancelled) {
          setEmbedTokenError(true);
        }
      })
      .catch(() => {
        if (!cancelled) setEmbedTokenError(true);
      });
    return () => { cancelled = true; };
  }, [embedMeeting, staff, webexConnected]);

  if (loading && !rooms.length && !myRooms.length) {
    return (
      <div className="container-fluid py-4">
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: 200 }}>
          <Spinner animation="border" />
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      <div className="session-header mb-4">
        <h1 className="mb-1">
          <i className="fas fa-video me-2" />
          Lớp học trực tuyến
        </h1>
        <p className="text-muted mb-0">
          {staff ? 'Quản lý phòng Webex và gán sinh viên' : 'Phòng Webex của bạn'}
        </p>
      </div>

      {alert.show && (
        <Alert variant={alert.variant} dismissible onClose={() => setAlert({ show: false })}>
          {alert.message}
        </Alert>
      )}

      {staff ? (
        <>
          {!webexConnected ? (
            <Card className="mb-4">
              <Card.Body className="text-center py-5">
                <i className="fas fa-plug fa-3x text-muted mb-3" />
                <h5>Kết nối Webex</h5>
                <p className="text-muted mb-3">
                  Để quản lý phòng và gán sinh viên, vui lòng kết nối tài khoản Webex của bạn.
                </p>
                <Button variant="primary" onClick={handleConnectWebex}>
                  <i className="fas fa-external-link-alt me-2" />
                  Kết nối Webex
                </Button>
              </Card.Body>
            </Card>
          ) : (
            <>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <Badge bg="success">Đã kết nối Webex</Badge>
                <div>
                  <Button variant="outline-secondary" size="sm" className="me-2" onClick={handleConnectWebex} title="Kết nối lại với tài khoản Webex khác">
                    <i className="fas fa-link me-1" /> Kết nối lại
                  </Button>
                  <Button variant="outline-primary" size="sm" className="me-2" onClick={() => {
                    if (activeTab === 'rooms') fetchStaffData();
                    else if (activeTab === 'meetings') fetchMeetings();
                    else if (activeTab === 'recordings') fetchAdminRecordings();
                    else if (activeTab === 'audit') fetchAuditEvents();
                  }}>
                    <i className="fas fa-sync-alt me-1" /> Làm mới
                  </Button>
                  {activeTab === 'rooms' ? (
                    <Button variant="outline-success" size="sm" className="me-2" onClick={() => setCreateRoomModal(true)}>
                      <i className="fas fa-door-open me-1" /> Tạo phòng
                    </Button>
                  ) : null}
                  <Button variant="primary" size="sm" onClick={() => setCreateMeetingModal(true)}>
                    <i className="fas fa-plus me-1" /> Tạo cuộc họp
                  </Button>
                </div>
              </div>

              <Nav variant="tabs" className="mb-3 flex-wrap">
                <Nav.Item>
                  <Nav.Link active={activeTab === 'rooms'} onClick={() => setActiveTab('rooms')}>
                    <i className="fas fa-door-open me-1" /> Phòng ({rooms.length})
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link active={activeTab === 'meetings'} onClick={() => setActiveTab('meetings')}>
                    <i className="fas fa-calendar-alt me-1" /> Lịch họp
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link active={activeTab === 'recordings'} onClick={() => setActiveTab('recordings')}>
                    <i className="fas fa-play-circle me-1" /> Recording
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link active={activeTab === 'audit'} onClick={() => setActiveTab('audit')}>
                    <i className="fas fa-history me-1" /> Audit
                  </Nav.Link>
                </Nav.Item>
              </Nav>

              {activeTab === 'recordings' ? (
                <div className="admin-tab">
                  {adminRecordingsLoading ? (
                    <div className="text-center py-5"><Spinner animation="border" /></div>
                  ) : adminRecordings.length === 0 ? (
                    <Alert variant="info">
                      Không có recording hoặc thiếu scope <code>meeting:admin_recordings_read</code>.
                    </Alert>
                  ) : (
                    <Table responsive size="sm">
                      <thead>
                        <tr>
                          <th>Chủ đề</th>
                          <th>Thời gian</th>
                          <th>Thời lượng</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminRecordings.map((r) => (
                          <tr key={r.id}>
                            <td>{r.topic || r.id}</td>
                            <td>{r.createTime ? new Date(r.createTime).toLocaleString('vi-VN') : '-'}</td>
                            <td>{r.durationSeconds != null ? `${Math.floor(r.durationSeconds / 60)} phút` : '-'}</td>
                            <td>
                              {r.playUrl && <a href={r.playUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-primary me-1">Xem</a>}
                              {r.downloadUrl && <a href={r.downloadUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-secondary">Tải</a>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  )}
                </div>
              ) : activeTab === 'audit' ? (
                <div className="admin-tab">
                  {auditEventsLoading ? (
                    <div className="text-center py-5"><Spinner animation="border" /></div>
                  ) : auditEvents.length === 0 ? (
                    <Alert variant="info">
                      Không có sự kiện audit hoặc thiếu scope <code>audit:events_read</code>.
                    </Alert>
                  ) : (
                    <Table responsive size="sm">
                      <thead>
                        <tr>
                          <th>Thời gian</th>
                          <th>Action</th>
                          <th>Actor</th>
                          <th>Resource</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditEvents.map((ev, idx) => (
                          <tr key={ev.id || idx}>
                            <td>{ev.created ? new Date(ev.created).toLocaleString('vi-VN') : '-'}</td>
                            <td>{ev.action || ev.eventType || '-'}</td>
                            <td>{ev.actorName || ev.actorId || '-'}</td>
                            <td>{ev.resource || ev.targetId || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  )}
                </div>
              ) : activeTab === 'meetings' ? (
                <div className="meetings-tab">
                  {meetingsLoading ? (
                    <div className="text-center py-5"><Spinner animation="border" /></div>
                  ) : meetings.length === 0 ? (
                    <Alert variant="info">
                      Chưa có cuộc họp nào trong 30 ngày tới. Nhấn <strong>Tạo cuộc họp</strong> để tạo mới.
                    </Alert>
                  ) : (
                    <Row>
                      {meetings.map((m) => (
                        <Col key={m.id} md={6} lg={4} className="mb-3">
                          <Card>
                            <Card.Body>
                              <h6 className="card-title">{m.title || 'Cuộc họp'}</h6>
                              <p className="text-muted small mb-1">
                                {m.start ? new Date(m.start).toLocaleString('vi-VN') : ''} – {m.end ? new Date(m.end).toLocaleString('vi-VN') : ''}
                              </p>
                              {m.meetingNumber && <p className="text-muted small mb-2">Số phòng: {m.meetingNumber}</p>}
                              <Button
                                variant="primary"
                                onClick={() => handleJoinMeeting(m)}
                                disabled={joiningMeetingId === m.id}
                              >
                                {joiningMeetingId === m.id ? (
                                  <><Spinner animation="border" size="sm" className="me-1" /> Đang lấy link...</>
                                ) : (
                                  <><i className="fas fa-video me-1" /> Tham gia trực tiếp</>
                                )}
                              </Button>
                            </Card.Body>
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  )}
                </div>
              ) : (
              <>
              <Row>
                {rooms.map((room) => (
                  <Col key={room.id} md={6} lg={4} className="mb-3">
                    <Card>
                      <Card.Header className="d-flex justify-content-between align-items-center">
                        <span className="fw-bold text-truncate" title={room.title}>
                          {room.title}
                        </span>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => openAssignModal(room)}
                        >
                          <i className="fas fa-user-plus me-1" /> Gán SV
                        </Button>
                      </Card.Header>
                      <Card.Body>
                        <small className="text-muted">ID: {room.id}</small>
                        <div className="mt-2">
                          <a
                            href={`https://webex.com/meet/${room.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm btn-outline-secondary"
                          >
                            Mở trong Webex
                          </a>
                        </div>
                        {roomAssignments[room.id]?.length > 0 && (
                          <ListGroup variant="flush" className="mt-2">
                            {roomAssignments[room.id].slice(0, 3).map((a) => (
                              <ListGroup.Item key={a.user_id} className="py-1 px-0 d-flex justify-content-between">
                                <small>{a.full_name}</small>
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="text-danger p-0"
                                  onClick={() => handleUnassign(room.id, a.user_id)}
                                >
                                  <i className="fas fa-times" />
                                </Button>
                              </ListGroup.Item>
                            ))}
                            {roomAssignments[room.id].length > 3 && (
                              <ListGroup.Item className="py-1 text-muted">
                                <small>+{roomAssignments[room.id].length - 3} khác</small>
                              </ListGroup.Item>
                            )}
                          </ListGroup>
                        )}
                      </Card.Body>
                    </Card>
                  </Col>
                ))}
              </Row>

              {rooms.length === 0 && webexConnected && (
                <Alert variant="info">
                  <strong>Phòng</strong> dùng để gán sinh viên. Nhấn <strong>Tạo phòng</strong> để tạo mới.
                  <br />
                  <small className="text-muted">Cuộc họp đã tạo nằm ở tab <strong>Lịch cuộc họp</strong>.</small>
                </Alert>
              )}
              </>
              )}
            </>
          )}
        </>
      ) : (
        <Row>
          {myRooms.length === 0 ? (
            <Col>
              <Alert variant="info">
                Bạn chưa được gán vào phòng Webex nào. Vui lòng liên hệ giảng viên hoặc quản trị viên.
              </Alert>
            </Col>
          ) : (
            myRooms.map((r) => (
              <Col key={r.roomId} md={6} lg={4} className="mb-3">
                <Card>
                  <Card.Body>
                    <h6 className="card-title">{r.title}</h6>
                    <p className="text-muted small mb-2">
                      Gán từ {r.assignedAt ? new Date(r.assignedAt).toLocaleDateString('vi-VN') : ''}
                    </p>
                    <a
                      href={r.webexUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary"
                    >
                      <i className="fas fa-external-link-alt me-2" />
                      Mở phòng trong Webex
                    </a>
                  </Card.Body>
                </Card>
              </Col>
            ))
          )}
        </Row>
      )}

      {/* Modal tạo phòng */}
      <Modal show={createRoomModal} onHide={() => { setCreateRoomModal(false); setNewRoomTitle(''); }}>
        <Modal.Header closeButton>
          <Modal.Title>Tạo phòng Webex</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label>Tiêu đề phòng</Form.Label>
            <Form.Control
              value={newRoomTitle}
              onChange={(e) => setNewRoomTitle(e.target.value)}
              placeholder="VD: Lớp Toán A1"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => { setCreateRoomModal(false); setNewRoomTitle(''); }}>Hủy</Button>
          <Button variant="primary" onClick={handleCreateRoom} disabled={!newRoomTitle.trim() || creatingRoom}>
            {creatingRoom ? <Spinner animation="border" size="sm" /> : 'Tạo phòng'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal nhúng cuộc họp Webex bằng Meetings Widget (tránh bị Webex chặn iframe) */}
      <Modal
        show={!!embedMeeting}
        onHide={() => { setEmbedMeeting(null); setEmbedToken(null); setEmbedTokenError(false); }}
        size="xl"
        fullscreen="md-down"
        centered
        className="webex-embed-modal"
      >
        <Modal.Header closeButton className="py-2">
          <Modal.Title className="small">Tham gia cuộc họp Webex</Modal.Title>
          {embedMeeting?.joinUrl && (
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => window.open(embedMeeting.joinUrl, '_blank')}
              className="ms-2"
            >
              Mở trong tab mới
            </Button>
          )}
        </Modal.Header>
        <Modal.Body className="p-0 d-flex flex-column" style={{ minHeight: '70vh' }}>
          <Alert variant="info" className="m-2 mb-0 py-2 small">
            <strong>Nếu gặp lỗi 403:</strong>
            <ul className="mb-0 mt-1 ps-3">
              <li>Integration trong <a href="https://developer.webex.com" target="_blank" rel="noopener noreferrer">Developer Portal</a> phải có scope <strong>spark:all</strong> (Full access). Sau đó nhấn <strong>Kết nối lại</strong> Webex trên trang này.</li>
              <li>Trong <strong>Control Hub</strong> (admin.webex.com): bật CORS và thêm domain <strong>{typeof window !== 'undefined' ? window.location.origin : ''}</strong> vào trusted domains (Meeting → Sites → Site Options).</li>
              <li>Hoặc dùng nút <strong>Mở trong tab mới</strong> ở góc phải để vào phòng không cần widget.</li>
            </ul>
          </Alert>
          {embedTokenError && (
            <Alert variant="warning" className="m-3 mb-0">
              Không thể tải widget. Bạn có thể{' '}
              <Button variant="link" className="p-0" onClick={() => embedMeeting?.joinUrl && window.open(embedMeeting.joinUrl, '_blank')}>
                mở cuộc họp trong tab mới
              </Button>.
            </Alert>
          )}
          {embedMeeting && !embedTokenError && (
            <>
              {!embedToken ? (
                <div className="d-flex justify-content-center align-items-center flex-grow-1" style={{ minHeight: '60vh' }}>
                  <Spinner animation="border" />
                </div>
              ) : (
                <div style={{ width: '100%', flex: 1, minHeight: '60vh' }}>
                  <WebexMeetingsWidget
                    accessToken={embedToken}
                    meetingDestination={embedMeeting.meetingNumber || embedMeeting.joinUrl || ''}
                    style={{ width: '100%', height: '100%', minHeight: '60vh' }}
                  />
                </div>
              )}
            </>
          )}
        </Modal.Body>
      </Modal>

      {/* Modal gán sinh viên */}
      <Modal show={assignModal.show} onHide={() => setAssignModal({ show: false, room: null })}>
        <Modal.Header closeButton>
          <Modal.Title>Gán sinh viên vào phòng: {assignModal.room?.title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Chọn sinh viên</Form.Label>
            <Form.Select
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
            >
              <option value="">-- Chọn sinh viên --</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} ({s.email})
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          {roomAssignments[assignModal.room?.id]?.length > 0 && (
            <>
              <hr />
              <h6>Đã gán:</h6>
              <Table size="sm">
                <tbody>
                  {roomAssignments[assignModal.room?.id].map((a) => (
                    <tr key={a.user_id}>
                      <td>{a.full_name}</td>
                      <td>{a.email}</td>
                      <td>
                        <Button
                          variant="link"
                          size="sm"
                          className="text-danger"
                          onClick={() => handleUnassign(assignModal.room.id, a.user_id)}
                        >
                          Bỏ gán
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setAssignModal({ show: false, room: null })}>
            Đóng
          </Button>
          <Button
            variant="primary"
            onClick={handleAssign}
            disabled={!selectedStudent || assigning}
          >
            {assigning ? <Spinner animation="border" size="sm" /> : 'Gán'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal tạo phòng */}
      <Modal show={createRoomModal} onHide={() => { setCreateRoomModal(false); setNewRoomTitle(''); }}>
        <Modal.Header closeButton>
          <Modal.Title>Tạo phòng Webex</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label>Tiêu đề phòng</Form.Label>
            <Form.Control
              value={newRoomTitle}
              onChange={(e) => setNewRoomTitle(e.target.value)}
              placeholder="VD: Lớp Toán A1"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => { setCreateRoomModal(false); setNewRoomTitle(''); }}>Hủy</Button>
          <Button variant="primary" onClick={handleCreateRoom} disabled={!newRoomTitle.trim() || creatingRoom}>
            {creatingRoom ? <Spinner animation="border" size="sm" /> : 'Tạo phòng'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal tạo phòng */}
      <Modal show={createRoomModal} onHide={() => { setCreateRoomModal(false); setNewRoomTitle(''); }}>
        <Modal.Header closeButton>
          <Modal.Title>Tạo phòng Webex</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label>Tiêu đề phòng</Form.Label>
            <Form.Control
              value={newRoomTitle}
              onChange={(e) => setNewRoomTitle(e.target.value)}
              placeholder="VD: Lớp Toán 1 - K24"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setCreateRoomModal(false)}>Hủy</Button>
          <Button variant="primary" onClick={handleCreateRoom} disabled={!newRoomTitle.trim() || creatingRoom}>
            {creatingRoom ? <Spinner animation="border" size="sm" /> : 'Tạo phòng'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal tạo cuộc họp */}
      <Modal show={createMeetingModal} onHide={() => { setCreateMeetingModal(false); setCreatedMeeting(null); }}>
        <Modal.Header closeButton>
          <Modal.Title>Tạo cuộc họp Webex</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {createdMeeting ? (
            <Alert variant="success">
              <h6>Đã tạo cuộc họp!</h6>
              <p className="mb-1"><strong>{createdMeeting.title}</strong></p>
              <a href={createdMeeting.joinUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-primary mt-2">
                Mở cuộc họp
              </a>
            </Alert>
          ) : (
            <>
              <Form.Group className="mb-3">
                <Form.Label>Tiêu đề</Form.Label>
                <Form.Control
                  value={meetingTitle}
                  onChange={(e) => setMeetingTitle(e.target.value)}
                  placeholder="Cuộc họp LMS"
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Bắt đầu</Form.Label>
                <Form.Control
                  type="datetime-local"
                  value={meetingStart}
                  onChange={(e) => setMeetingStart(e.target.value)}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Kết thúc</Form.Label>
                <Form.Control
                  type="datetime-local"
                  value={meetingEnd}
                  onChange={(e) => setMeetingEnd(e.target.value)}
                />
              </Form.Group>
            </>
          )}
        </Modal.Body>
        {!createdMeeting && (
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setCreateMeetingModal(false)}>Hủy</Button>
            <Button variant="primary" onClick={handleCreateMeeting} disabled={creatingMeeting}>
              {creatingMeeting ? <Spinner animation="border" size="sm" /> : 'Tạo cuộc họp'}
            </Button>
          </Modal.Footer>
        )}
      </Modal>
    </div>
  );
};

export default LiveClass;
