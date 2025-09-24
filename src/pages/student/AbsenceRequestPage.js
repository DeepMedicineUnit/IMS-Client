import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Form, Alert, Container, Row, Col, Modal, Badge, Table, Spinner } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { Calendar, Clock, MapPin, FileText, Send, Eye, CheckCircle, AlertTriangle } from 'lucide-react';
import '../../../src/styles/modern-ui.css';

const AbsenceRequestPage = () => {
  const { api } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sessions, setSessions] = useState([]);
  const [requests, setRequests] = useState([]);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [formData, setFormData] = useState({
    session_id: '',
    request_type: 'full_session',
    reason: ''
  });

  // Auto-refresh states
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const autoRefreshIntervalRef = useRef(null);

  // Fetch available sessions for absence request
  const fetchAvailableSessions = async () => {
    try {
      console.log('Fetching available sessions...');
      const response = await api.get('/sessions/student/dashboard?status=all');
      console.log('Sessions response:', response.data);
      if (response.data.success) {
        setSessions(response.data.data);
        console.log('Sessions set:', response.data.data);
        console.log('Sessions count:', response.data.data.length);
      } else {
        console.error('API returned success: false', response.data);
        setSessions([]);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
      console.error('Error details:', error.response?.data);
      setSessions([]);
    }
  };

  // Fetch student's absence requests
  const fetchAbsenceRequests = async () => {
    try {
      console.log('Fetching absence requests...');
      const response = await api.get('/absence-requests/student');
      console.log('Absence requests response:', response.data);
      if (response.data.success) {
        setRequests(response.data.data.requests);
        console.log('Absence requests set:', response.data.data.requests);
        console.log('Absence requests count:', response.data.data.requests.length);
      } else {
        console.error('Absence requests API returned success: false', response.data);
        setRequests([]);
      }
    } catch (error) {
      console.error('Error fetching absence requests:', error);
      console.error('Error details:', error.response?.data);
      setRequests([]);
    }
  };

  // Fetch available sessions silently (without loading state)
  const fetchAvailableSessionsSilently = async () => {
    try {
      setIsAutoRefreshing(true);
      const response = await api.get('/sessions/student/dashboard?status=all');
      if (response.data.success) {
        setSessions(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching sessions silently:', error);
    } finally {
      setIsAutoRefreshing(false);
    }
  };

  // Fetch absence requests silently (without loading state)
  const fetchAbsenceRequestsSilently = async () => {
    try {
      const response = await api.get('/absence-requests/student');
      if (response.data.success) {
        setRequests(response.data.data.requests);
      }
    } catch (error) {
      console.error('Error fetching absence requests silently:', error);
    }
  };

  // Initial data fetch
  useEffect(() => {
    const fetchData = async () => {
      console.log('Starting data fetch...');
      setLoading(true);
      try {
        await Promise.all([
          fetchAvailableSessions(),
          fetchAbsenceRequests()
        ]);
        console.log('Data fetch completed successfully');
        console.log('Final state - sessions:', sessions.length, 'requests:', requests.length);
      } catch (error) {
        console.error('Error in data fetch:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Auto-refresh data every 30 seconds
  useEffect(() => {
    // Start auto-refresh interval
    autoRefreshIntervalRef.current = setInterval(() => {
      fetchAvailableSessionsSilently();
      fetchAbsenceRequestsSilently();
    }, 30000); // 30 seconds

    // Clean up interval on unmount
    return () => {
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current);
        autoRefreshIntervalRef.current = null;
      }
    };
  }, []);

  // Debug effect to log state changes
  useEffect(() => {
    console.log('State changed - sessions:', sessions.length, 'requests:', requests.length, 'loading:', loading);
    if (sessions.length > 0) {
      console.log('Sessions data:', sessions);
    }
  }, [sessions, requests, loading]);

  // Debug effect to log component render
  useEffect(() => {
    console.log('Component rendered with sessions:', sessions.length, 'loading:', loading);
  });

  // Debug effect to log sessions changes
  useEffect(() => {
    console.log('Sessions changed:', sessions);
    console.log('Sessions length:', sessions.length);
    console.log('Sessions type:', typeof sessions);
    console.log('Sessions is array:', Array.isArray(sessions));
    if (sessions && sessions.length > 0) {
      console.log('First session:', sessions[0]);
      console.log('All sessions:', sessions);
    } else {
      console.log('No sessions available');
    }
  }, [sessions]);

  // Debug effect to log loading changes
  useEffect(() => {
    console.log('Loading changed:', loading);
  }, [loading]);

  // Debug effect to log requests changes
  useEffect(() => {
    console.log('Requests changed:', requests);
    console.log('Requests length:', requests.length);
  }, [requests]);

  // Debug effect to log form data changes
  useEffect(() => {
    console.log('Form data changed:', formData);
  }, [formData]);

  // Debug effect to log selected session changes
  useEffect(() => {
    console.log('Selected session changed:', selectedSession);
  }, [selectedSession]);

  // Debug effect to log show request modal changes
  useEffect(() => {
    console.log('Show request modal changed:', showRequestModal);
  }, [showRequestModal]);

  // Debug effect to log submitting changes
  useEffect(() => {
    console.log('Submitting changed:', submitting);
  }, [submitting]);

  // Debug effect to log error changes
  useEffect(() => {
    console.log('Error changed:', error);
  }, [error]);

  // Debug effect to log success changes
  useEffect(() => {
    console.log('Success changed:', success);
  }, [success]);

  // Debug effect to log all state changes
  useEffect(() => {
    console.log('All state:', {
      sessions: sessions.length,
      requests: requests.length,
      loading,
      error,
      success,
      submitting,
      showRequestModal,
      selectedSession: selectedSession?.id,
      formData
    });
  });

  // Debug effect to log component mount
  useEffect(() => {
    console.log('Component mounted');
    return () => {
      console.log('Component unmounted');
    };
  }, []);

  // Debug effect to log component update
  useEffect(() => {
    console.log('Component updated');
  });

  // Debug effect to log render
  console.log('Rendering AbsenceRequestPage with sessions:', sessions.length, 'loading:', loading);
  console.log('Sessions data in render:', sessions);
  console.log('Loading state in render:', loading);
  console.log('Error state in render:', error);
  console.log('Success state in render:', success);
  console.log('Requests data in render:', requests);
  console.log('Form data in render:', formData);
  console.log('Selected session in render:', selectedSession);
  console.log('Show request modal in render:', showRequestModal);
  console.log('Submitting in render:', submitting);
  console.log('All state in render:', {
    sessions: sessions.length,
    requests: requests.length,
    loading,
    error,
    success,
    submitting,
    showRequestModal,
    selectedSession: selectedSession?.id,
    formData
  });
  console.log('Sessions type check:', typeof sessions, Array.isArray(sessions));
  console.log('Sessions length check:', sessions?.length);
  console.log('Sessions truthy check:', !!sessions);
  console.log('Sessions null check:', sessions === null);
  console.log('Sessions undefined check:', sessions === undefined);
  console.log('Sessions empty check:', sessions?.length === 0);
  console.log('Sessions falsy check:', !sessions);
  console.log('Sessions nullish check:', sessions == null);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle session selection
  const handleSessionSelect = (session) => {
    console.log('Session selected:', session);
    setSelectedSession(session);
    setFormData(prev => ({
      ...prev,
      session_id: session.id
    }));
    setShowRequestModal(true);
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    console.log('Form data:', formData);

    if (!formData.session_id || !formData.request_type || !formData.reason.trim()) {
      setError('Vui lòng điền đầy đủ thông tin');
      return;
    }

    try {
      setSubmitting(true);
      console.log('Submitting absence request:', formData);
      const response = await api.post('/absence-requests', formData);
      console.log('Absence request response:', response.data);
      
      if (response.data.success) {
        setSuccess('Yêu cầu xin phép vắng học đã được gửi thành công');
        toast.success('Yêu cầu xin phép vắng học đã được gửi thành công');
        setShowRequestModal(false);
        setFormData({
          session_id: '',
          request_type: 'full_session',
          reason: ''
        });
        setSelectedSession(null);
        // Refresh requests list silently
        await fetchAbsenceRequestsSilently();
      }
    } catch (error) {
      console.error('Error submitting absence request:', error);
      console.error('Error details:', error.response?.data);
      const errorMessage = error.response?.data?.message || 'Có lỗi xảy ra khi gửi yêu cầu';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // Get status badge
  const getStatusBadge = (status) => {
    console.log('Getting status badge for:', status);
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

  // Get request type text
  const getRequestTypeText = (type) => {
    console.log('Getting request type text for:', type);
    switch (type) {
      case 'full_session':
        return 'Vắng cả buổi học';
      case 'before_session':
        return 'Vắng điểm danh trước buổi học';
      case 'during_session':
        return 'Vắng điểm danh trong buổi học';
      case 'after_session':
        return 'Vắng điểm danh sau buổi học';
      default:
        return type;
    }
  };

  // Calculate session status
  const calculateSessionStatus = (session) => {
    console.log('Calculating status for session:', session);
    const now = new Date();
    const sessionDate = new Date(session.date);
    
    // Set year, month, day from session date
    const currentDate = new Date();
    currentDate.setFullYear(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate());

    // Parse start and end times
    const [startHours, startMinutes] = session.start_time.split(':').map(Number);
    const [endHours, endMinutes] = session.end_time.split(':').map(Number);
    
    const sessionStartTime = new Date(currentDate);
    sessionStartTime.setHours(startHours, startMinutes, 0, 0);
    
    const sessionEndTime = new Date(currentDate);
    sessionEndTime.setHours(endHours, endMinutes, 0, 0);
    
    // Handle sessions that span across midnight
    if (sessionEndTime < sessionStartTime) {
      sessionEndTime.setDate(sessionEndTime.getDate() + 1);
    }

    let status;
    if (now < sessionStartTime) {
      status = 'scheduled';
    } else if (now >= sessionStartTime && now <= sessionEndTime) {
      status = 'active';
    } else {
      status = 'ended';
    }
    
    console.log('Session status calculated:', status, 'for session:', session.title);
    return status;
  };

  // Get session status badge
  const getSessionStatusBadge = (session) => {
    const status = calculateSessionStatus(session);
    console.log('Getting session status badge for:', session.title, 'status:', status);
    switch (status) {
      case 'scheduled':
        return <Badge bg="info">Sắp diễn ra</Badge>;
      case 'active':
        return <Badge bg="success">Đang diễn ra</Badge>;
      case 'ended':
        return <Badge bg="secondary">Đã kết thúc</Badge>;
      default:
        return <Badge bg="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '50vh' }}>
        <div className="text-center">
          <div className="rounded-circle bg-primary bg-opacity-10 d-inline-flex align-items-center justify-content-center mb-3" style={{width: '80px', height: '80px'}}>
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
          <p className="text-gray-600">Đang tải dữ liệu...</p>
        </div>
      </Container>
    );
  }

  return (
    <Container className="mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div className="d-flex align-items-center">
          <div className="rounded-circle bg-primary bg-opacity-10 p-2 me-3">
            <FileText size={24} className="text-primary" />
          </div>
          <h2 className="mb-0">Xin phép vắng học</h2>
        </div>
        {isAutoRefreshing && (
          <div className="auto-refresh-indicator">
            <div className="spinner-border spinner-border-sm text-primary" role="status">
              <span className="visually-hidden">Đang cập nhật...</span>
            </div>
            <span className="ms-2 small text-muted">Đang cập nhật...</span>
          </div>
        )}
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

      <Row>
        {/* Available Sessions */}
        <Col lg={6} className="mb-4">
          <div className="modern-card h-100">
            <div className="card-header bg-white border-0">
              <div className="d-flex align-items-center">
                <div className="rounded-circle bg-primary bg-opacity-10 p-2 me-2">
                  <Calendar size={18} className="text-primary" />
                </div>
                <h5 className="mb-0 fw-bold">Buổi học có thể xin phép vắng</h5>
              </div>
            </div>
            <div className="card-body p-0">
              {sessions.length > 0 ? (
                <div className="modern-list-group">
                  {sessions.map(session => {
                    const status = calculateSessionStatus(session);
                    const canRequest = ['scheduled', 'active', 'ended'].includes(status);
                    const hasExistingRequest = requests.some(req => 
                      req.session_id === session.id && req.status === 'pending'
                    );

                    return (
                      <div key={session.id} className="modern-list-group-item p-3">
                        <div className="d-flex justify-content-between align-items-start">
                          <div className="flex-grow-1">
                            <h6 className="mb-2 fw-bold">{session.title}</h6>
                            <div className="d-flex flex-wrap gap-3 mb-2 text-muted small">
                              <div className="d-flex align-items-center">
                                <Calendar size={14} className="me-1" />
                                <span>{format(new Date(session.date), 'dd/MM/yyyy')}</span>
                              </div>
                              <div className="d-flex align-items-center">
                                <Clock size={14} className="me-1" />
                                <span>{session.start_time} - {session.end_time}</span>
                              </div>
                              {session.location && (
                                <div className="d-flex align-items-center">
                                  <MapPin size={14} className="me-1" />
                                  <span>{session.location}</span>
                                </div>
                              )}
                            </div>
                            <div className="d-flex gap-2">
                              <div className="modern-badge modern-badge-primary">
                                {(() => {
                                  switch (status) {
                                    case 'scheduled':
                                      return <><i className="fas fa-clock me-1"></i>Sắp diễn ra</>;
                                    case 'active':
                                      return <><i className="fas fa-play-circle me-1"></i>Đang diễn ra</>;
                                    case 'ended':
                                      return <><i className="fas fa-check-circle me-1"></i>Đã kết thúc</>;
                                    default:
                                      return <><i className="fas fa-info-circle me-1"></i>{status}</>;
                                  }
                                })()}
                              </div>
                              {hasExistingRequest && (
                                <div className="modern-badge modern-badge-warning">
                                  <i className="fas fa-hourglass-half me-1"></i>
                                  Có yêu cầu chờ duyệt
                                </div>
                              )}
                            </div>
                          </div>
                          <div>
                            <button
                              className={`btn-modern ${hasExistingRequest ? 'opacity-50' : ''}`}
                              onClick={() => handleSessionSelect(session)}
                              disabled={!canRequest || hasExistingRequest}
                              style={{ 
                                backgroundColor: hasExistingRequest ? '#6b7280' : '#256176',
                                padding: '0.5rem 1rem'
                              }}
                            >
                              {hasExistingRequest ? (
                                <><i className="fas fa-check me-1"></i>Đã gửi yêu cầu</>
                              ) : (
                                <><i className="fas fa-calendar-times me-1"></i>Xin phép vắng</>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center text-muted py-5">
                  <div className="rounded-circle bg-light d-inline-flex align-items-center justify-content-center mb-3" style={{width: '80px', height: '80px'}}>
                    <Calendar size={32} className="text-muted" />
                  </div>
                  <p>Không có buổi học nào để xin phép vắng</p>
                </div>
              )}
            </div>
          </div>
        </Col>

        {/* Absence Requests History */}
        <Col lg={6} className="mb-4">
          <div className="modern-card h-100">
            <div className="card-header bg-white border-0">
              <div className="d-flex align-items-center">
                <div className="rounded-circle bg-info bg-opacity-10 p-2 me-2">
                  <i className="fas fa-history text-info"></i>
                </div>
                <h5 className="mb-0 fw-bold">Lịch sử yêu cầu xin phép vắng</h5>
              </div>
            </div>
            <div className="card-body p-0">
              {requests.length > 0 ? (
                <div className="table-responsive">
                  <table className="modern-table modern-table-hover w-100">
                    <thead>
                      <tr>
                        <th>Buổi học</th>
                        <th>Loại vắng</th>
                        <th>Trạng thái</th>
                        <th>Ngày tạo</th>
                        <th>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requests.map(request => (
                        <tr key={request.id}>
                          <td>
                            <div>
                              <div className="fw-bold">{request.session_title}</div>
                              <div className="d-flex align-items-center text-muted small mt-1">
                                <Calendar size={12} className="me-1" />
                                <span>{format(new Date(request.session_date), 'dd/MM/yyyy')}</span>
                                <Clock size={12} className="ms-2 me-1" />
                                <span>{request.start_time}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="modern-badge modern-badge-info">
                              {(() => {
                                switch(request.request_type) {
                                  case 'full_session':
                                    return <>Cả buổi</>;
                                  case 'before_session':
                                    return <>Trước buổi</>;
                                  case 'during_session':
                                    return <>Trong buổi</>;
                                  case 'after_session':
                                    return <>Sau buổi</>;
                                  default:
                                    return getRequestTypeText(request.request_type);
                                }
                              })()}
                            </div>
                          </td>
                          <td>
                            <div className={`modern-badge ${(() => {
                              switch(request.status) {
                                case 'pending': return 'modern-badge-warning';
                                case 'approved': return 'modern-badge-success';
                                case 'rejected': return 'modern-badge-danger';
                                case 'cancelled': return 'modern-badge-secondary';
                                default: return 'modern-badge-secondary';
                              }
                            })()}`}>
                              {(() => {
                                switch(request.status) {
                                  case 'pending': return <i className="fas fa-hourglass-half me-1"></i>;
                                  case 'approved': return <i className="fas fa-check-circle me-1"></i>;
                                  case 'rejected': return <i className="fas fa-times-circle me-1"></i>;
                                  case 'cancelled': return <i className="fas fa-ban me-1"></i>;
                                  default: return <>{request.status}</>;
                                }
                              })()}
                            </div>
                          </td>
                          <td>
                            <div className="d-flex align-items-center text-muted small">
                              <i className="fas fa-calendar-alt me-1"></i>
                              {format(new Date(request.created_at), 'dd/MM/yyyy HH:mm')}
                            </div>
                          </td>
                          <td>
                            <button
                              className="btn-modern"
                              onClick={() => window.open(`/student/absence-requests/${request.id}/preview`, '_blank')}
                              title="Xem trước đơn xác nhận"
                              style={{ backgroundColor: '#3b82f6', padding: '0.5rem 1rem' }}
                            >
                              <Eye size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center text-muted py-5">
                  <div className="rounded-circle bg-light d-inline-flex align-items-center justify-content-center mb-3" style={{width: '80px', height: '80px'}}>
                    <i className="fas fa-inbox fa-2x text-muted"></i>
                  </div>
                  <p>Chưa có yêu cầu xin phép vắng nào</p>
                </div>
              )}
            </div>
          </div>
        </Col>
      </Row>

      {/* Request Modal */}
      <Modal show={showRequestModal} onHide={() => setShowRequestModal(false)} size="lg" centered>
        <Modal.Header closeButton className="border-0 pb-0">
          <div className="d-flex align-items-center">
            <div className="rounded-circle bg-primary bg-opacity-10 p-2 me-2">
              <FileText size={20} className="text-primary" />
            </div>
            <Modal.Title className="fw-bold">Xin phép vắng học</Modal.Title>
          </div>
        </Modal.Header>
        <Modal.Body className="pt-2">
          {selectedSession && (
            <div className="mb-4">
              <div className="d-flex align-items-center mb-3">
                <div className="rounded-circle bg-info bg-opacity-10 p-2 me-2">
                  <i className="fas fa-info-circle text-info"></i>
                </div>
                <h6 className="mb-0 fw-bold">Thông tin buổi học</h6>
              </div>
              <div className="bg-light p-4 rounded-lg shadow-sm">
                <div className="row g-3">
                  <div className="col-md-12">
                    <h6 className="fw-bold mb-0">{selectedSession.title}</h6>
                  </div>
                  <div className="col-md-6">
                    <div className="d-flex align-items-center">
                      <Calendar size={16} className="text-primary me-2" />
                      <span>{format(new Date(selectedSession.date), 'dd/MM/yyyy')}</span>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="d-flex align-items-center">
                      <Clock size={16} className="text-primary me-2" />
                      <span>{selectedSession.start_time} - {selectedSession.end_time}</span>
                    </div>
                  </div>
                  {selectedSession.location && (
                    <div className="col-md-12">
                      <div className="d-flex align-items-center">
                        <MapPin size={16} className="text-primary me-2" />
                        <span>{selectedSession.location}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-4">
              <Form.Label className="fw-medium">Loại vắng học <span className="text-danger">*</span></Form.Label>
              <div className="input-group">
                <div className="input-group-text bg-light">
                  <i className="fas fa-calendar-times"></i>
                </div>
                <Form.Select
                  name="request_type"
                  value={formData.request_type}
                  onChange={handleInputChange}
                  required
                  className="modern-form-control"
                >
                  <option value="full_session">Vắng cả buổi học</option>
                  <option value="before_session">Vắng điểm danh trước buổi học</option>
                  <option value="during_session">Vắng điểm danh trong buổi học</option>
                  <option value="after_session">Vắng điểm danh sau buổi học</option>
                </Form.Select>
              </div>
              <Form.Text className="text-muted">
                Chọn loại vắng học phù hợp với tình huống của bạn
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Label className="fw-medium">Lý do xin phép vắng <span className="text-danger">*</span></Form.Label>
              <div className="input-group">
                <div className="input-group-text bg-light">
                  <i className="fas fa-comment-alt"></i>
                </div>
                <Form.Control
                  as="textarea"
                  rows={4}
                  name="reason"
                  value={formData.reason}
                  onChange={handleInputChange}
                  placeholder="Vui lòng mô tả chi tiết lý do xin phép vắng học..."
                  required
                  className="modern-form-control"
                />
              </div>
              <Form.Text className="text-muted">
                Lý do càng chi tiết càng giúp giảng viên đánh giá chính xác
              </Form.Text>
            </Form.Group>

            <div className="d-flex justify-content-end gap-2">
              <button
                className="btn-modern"
                onClick={() => setShowRequestModal(false)}
                disabled={submitting}
                style={{ backgroundColor: '#6b7280' }}
              >
                Hủy
              </button>
              <button
                type="submit"
                className="btn-modern"
                disabled={submitting}
                style={{ backgroundColor: '#256176' }}
              >
                {submitting ? (
                  <div className="d-flex align-items-center gap-2">
                    <div className="spinner-border spinner-border-sm" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <span>Đang gửi...</span>
                  </div>
                ) : (
                  <div className="d-flex align-items-center gap-2">
                    <Send size={16} />
                    <span>Gửi yêu cầu</span>
                  </div>
                )}
              </button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </Container>
  );
};

export default AbsenceRequestPage;
