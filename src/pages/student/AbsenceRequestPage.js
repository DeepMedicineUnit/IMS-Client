import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Form, Alert, Container, Row, Col, Modal, Badge, Table, Spinner } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Calendar, Clock, MapPin, FileText, Send, Eye, CheckCircle, AlertTriangle } from 'lucide-react';
import '../../../src/styles/modern-ui.css';
import usePageTitle from '../../hooks/usePageTitle';

const AbsenceRequestPage = () => {
  const { t } = useTranslation();
  usePageTitle(t('absenceRequest.title'));
  const { showAlert } = useAlert();
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
    reason: '',
    makeup_date: '',
    makeup_notes: ''
  });
  const [evidenceFile, setEvidenceFile] = useState(null);

  // Auto-refresh states
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const autoRefreshIntervalRef = useRef(null);

  // Fetch available sessions for absence request
  const fetchAvailableSessions = async () => {
    try {
      console.log('Fetching available sessions...');
      const response = await api.get('/sessions/student/attendance?status=all');
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
      const response = await api.get('/sessions/student/attendance?status=all');
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

  }, [loading]);

  // Debug effect to log requests changes
  useEffect(() => {
  }, [requests]);

  // Debug effect to log form data changes
  useEffect(() => {
  }, [formData]);

  // Debug effect to log selected session changes
  useEffect(() => {
  }, [selectedSession]);

  // Debug effect to log show request modal changes
  useEffect(() => {
  }, [showRequestModal]);

  // Debug effect to log submitting changes
  useEffect(() => {
  }, [submitting]);

  // Debug effect to log error changes
  useEffect(() => {
    console.log('Error changed:', error);
  }, [error]);

  // Debug effect to log success changes
  useEffect(() => {
  }, [success]);

  // Debug effect to log all state changes
  useEffect(() => {

  });

  // Debug effect to log component mount
  useEffect(() => {
    return () => {
    };
  }, []);

  // Debug effect to log component update
  useEffect(() => {
  });


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

  // Handle file change
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        setError(t('absenceRequest.errors.fileSizeExceeded'));
        return;
      }
      
      // Validate file type
      const allowedTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        setError(t('absenceRequest.errors.fileTypeNotSupported'));
        return;
      }
      
      setEvidenceFile(file);
      setError('');
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    console.log('Form data:', formData);

    if (!formData.session_id || !formData.request_type || !formData.reason.trim()) {
      setError(t('absenceRequest.errors.fillAllFields'));
      return;
    }

    // Validate makeup date if provided
    if (formData.makeup_date) {
      const makeupDate = new Date(formData.makeup_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (makeupDate < today) {
        setError(t('absenceRequest.errors.makeupDatePast'));
        return;
      }
    }

    // Kiểm tra duplicate request
    const existingProcessedRequests = requests.filter(req => 
      req.session_id === formData.session_id && 
      ['approved', 'rejected'].includes(req.status)
    );
    
    const hasFullSessionRequest = existingProcessedRequests.some(req => 
      req.request_type === 'full_session'
    );
    
    const hasBeforeRequest = existingProcessedRequests.some(req => 
      req.request_type === 'before_session'
    );
    
    const hasDuringRequest = existingProcessedRequests.some(req => 
      req.request_type === 'during_session'
    );
    
    const hasAfterRequest = existingProcessedRequests.some(req => 
      req.request_type === 'after_session'
    );
    
    // Kiểm tra xem có thể tạo request với loại đã chọn không
    if (formData.request_type === 'full_session' && hasFullSessionRequest) {
      setError(t('absenceRequest.errors.duplicateFullSession'));
      return;
    }
    
    // Chỉ ngăn chặn khi đã có request cụ thể đó
    if (formData.request_type === 'before_session' && hasBeforeRequest) {
      setError(t('absenceRequest.errors.duplicateBefore'));
      return;
    }
    
    if (formData.request_type === 'during_session' && hasDuringRequest) {
      setError(t('absenceRequest.errors.duplicateDuring'));
      return;
    }
    
    if (formData.request_type === 'after_session' && hasAfterRequest) {
      setError(t('absenceRequest.errors.duplicateAfter'));
      return;
    }

    try {
      setSubmitting(true);
      console.log('Submitting absence request:', formData);
      
      // Create FormData for file upload
      const submitData = new FormData();
      submitData.append('session_id', formData.session_id);
      submitData.append('request_type', formData.request_type);
      submitData.append('reason', formData.reason);
      
      if (formData.makeup_date) {
        submitData.append('makeup_date', formData.makeup_date);
      }
      
      if (formData.makeup_notes) {
        submitData.append('makeup_notes', formData.makeup_notes);
      }
      
      if (evidenceFile) {
        submitData.append('evidence_file', evidenceFile);
      }
      
      const response = await api.post('/absence-requests', submitData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      console.log('Absence request response:', response.data);
      
      if (response.data.success) {
        setSuccess(t('absenceRequest.success.requestSubmitted'));
        showAlert(t('absenceRequest.success.requestSubmitted'), 'success');
        setShowRequestModal(false);
        setFormData({
          session_id: '',
          request_type: 'full_session',
          reason: '',
          makeup_date: '',
          makeup_notes: ''
        });
        setSelectedSession(null);
        setEvidenceFile(null);
        // Refresh requests list silently
        await fetchAbsenceRequestsSilently();
      }
    } catch (error) {
      console.error('Error submitting absence request:', error);
      console.error('Error details:', error.response?.data);
      const errorMessage = error.response?.data?.message || t('absenceRequest.errors.submitError');
      setError(errorMessage);
      showAlert(errorMessage, 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  // Get status badge
  const getStatusBadge = (status) => {
    console.log('Getting status badge for:', status);
    switch (status) {
      case 'pending':
        return <Badge bg="warning">{t('absenceRequest.status.pending')}</Badge>;
      case 'approved':
        return <Badge bg="success">{t('absenceRequest.status.approved')}</Badge>;
      case 'rejected':
        return <Badge bg="danger">{t('absenceRequest.status.rejected')}</Badge>;
      case 'cancelled':
        return <Badge bg="secondary">{t('absenceRequest.status.cancelled')}</Badge>;
      default:
        return <Badge bg="secondary">{status}</Badge>;
    }
  };

  // Get request type text
  const getRequestTypeText = (type) => {
    console.log('Getting request type text for:', type);
    switch (type) {
      case 'full_session':
        return t('absenceRequest.requestTypes.fullSession');
      case 'before_session':
        return t('absenceRequest.requestTypes.beforeSession');
      case 'during_session':
        return t('absenceRequest.requestTypes.duringSession');
      case 'after_session':
        return t('absenceRequest.requestTypes.afterSession');
      default:
        return type;
    }
  };

  // Calculate session status
  const calculateSessionStatus = (session) => {
    console.log('Calculating status for session:', session);
    const now = new Date();
    const sessionStartDate = new Date(session.date);
    const sessionEndDate = session.end_date ? new Date(session.end_date) : sessionStartDate;
    
    // Normalize dates for comparison (only date part)
    const currentDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sessionStartDateOnly = new Date(sessionStartDate.getFullYear(), sessionStartDate.getMonth(), sessionStartDate.getDate());
    const sessionEndDateOnly = new Date(sessionEndDate.getFullYear(), sessionEndDate.getMonth(), sessionEndDate.getDate());

    // Check if session is cancelled
    if (session.status === 'cancelled') {
      return 'cancelled';
    }

    // Session in the future (not started yet)
    if (sessionStartDateOnly > currentDateOnly) {
      return 'scheduled';
    }

    // Session ended (after end date)
    if (sessionEndDateOnly < currentDateOnly) {
      return 'ended';
    }

    // Session is ongoing (within date range)
    if ((sessionStartDateOnly <= currentDateOnly) && (sessionEndDateOnly >= currentDateOnly)) {
      // If it's the start date, check start time
      if (sessionStartDateOnly.getTime() === currentDateOnly.getTime()) {
        const [startHours, startMinutes] = session.start_time.split(':').map(Number);
        const sessionStartTime = new Date(now);
        sessionStartTime.setHours(startHours, startMinutes, 0, 0);
        
        if (now < sessionStartTime) {
          return 'scheduled';
        }
      }

      // If it's the end date, check end time
      if (sessionEndDateOnly.getTime() === currentDateOnly.getTime()) {
        const [endHours, endMinutes] = session.end_time.split(':').map(Number);
        const sessionEndTime = new Date(now);
        sessionEndTime.setHours(endHours, endMinutes, 0, 0);
        
        if (now > sessionEndTime) {
          return 'ended';
        }
      }

      // Within the session period
      return 'active';
    }

    // Default fallback
    console.log('Session status calculated: scheduled (fallback) for session:', session.title);
    return 'scheduled';
  };

  // Get session status badge
  const getSessionStatusBadge = (session) => {
    const status = calculateSessionStatus(session);
    console.log('Getting session status badge for:', session.title, 'status:', status);
    switch (status) {
      case 'scheduled':
        return <Badge bg="info">{t('absenceRequest.sessionStatus.scheduled')}</Badge>;
      case 'active':
        return <Badge bg="success">{t('absenceRequest.sessionStatus.active')}</Badge>;
      case 'ended':
        return <Badge bg="secondary">{t('absenceRequest.sessionStatus.ended')}</Badge>;
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
          <p className="text-gray-600">{t('absenceRequest.loading')}</p>
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
          <h2 className="mb-0">{t('absenceRequest.pageTitle')}</h2>
        </div>
        {isAutoRefreshing && (
          <div className="auto-refresh-indicator">
            <div className="spinner-border spinner-border-sm text-primary" role="status">
              <span className="visually-hidden">{t('absenceRequest.updating')}</span>
            </div>
            <span className="ms-2 small text-muted">{t('absenceRequest.updating')}</span>
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
                <h5 className="mb-0 fw-bold">{t('absenceRequest.availableSessions')}</h5>
              </div>
            </div>
            <div className="card-body p-0">
              {sessions.length > 0 ? (
                <div className="modern-list-group" style={{ maxHeight: sessions.length > 10 ? '600px' : 'auto', overflowY: sessions.length > 10 ? 'auto' : 'visible' }}>
                  {sessions.map(session => {
                    const status = calculateSessionStatus(session);
                    const canRequest = ['scheduled', 'active', 'ended'].includes(status);
                    
                    // Kiểm tra các request đã được duyệt/từ chối cho session này
                    const existingProcessedRequests = requests.filter(req => 
                      req.session_id === session.id && 
                      ['approved', 'rejected'].includes(req.status)
                    );
                    
                    // Kiểm tra có request "Cả buổi" đã được duyệt/từ chối không
                    const hasFullSessionRequest = existingProcessedRequests.some(req => 
                      req.request_type === 'full_session'
                    );
                    
                    // Kiểm tra có request "Trước" đã được duyệt/từ chối không
                    const hasBeforeRequest = existingProcessedRequests.some(req => 
                      req.request_type === 'before_session'
                    );
                    
                    // Kiểm tra có request "Trong" đã được duyệt/từ chối không
                    const hasDuringRequest = existingProcessedRequests.some(req => 
                      req.request_type === 'during_session'
                    );
                    
                    // Kiểm tra có request "Sau" đã được duyệt/từ chối không
                    const hasAfterRequest = existingProcessedRequests.some(req => 
                      req.request_type === 'after_session'
                    );
                    
                    // Kiểm tra có request đang chờ duyệt không
                    const hasPendingRequest = requests.some(req => 
                      req.session_id === session.id && req.status === 'pending'
                    );
                    
                    // Chỉ disable button khi:
                    // 1. Có request đang chờ duyệt
                    // 2. Có request "Cả buổi" đã được duyệt/từ chối
                    // 3. Có cả 3 loại "Trước/Trong/Sau" đã được duyệt/từ chối
                    const hasAllPartialRequests = hasBeforeRequest && hasDuringRequest && hasAfterRequest;
                    const hasExistingRequest = hasPendingRequest || hasFullSessionRequest || hasAllPartialRequests;

                    return (
                      <div key={session.id} className="modern-list-group-item p-3">
                        <div className="d-flex justify-content-between align-items-start">
                          <div className="flex-grow-1">
                            <h6 className="fw-bold mb-0 text-dark session-title-truncated">{session.title}</h6>
                            <div className="d-flex flex-wrap gap-3 mb-2 text-muted small">
                              <div className="d-flex align-items-center">
                                <Calendar size={14} className="me-1" />
                                <span>{session.end_date && session.end_date !== session.date ? 
                                  `${format(new Date(session.date), 'dd/MM/yyyy')} - ${format(new Date(session.end_date), 'dd/MM/yyyy')}` :
                                  format(new Date(session.date), 'dd/MM/yyyy')}</span>
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
                                      return <><i className="fas fa-clock me-1"></i>{t('absenceRequest.sessionStatus.scheduled')}</>;
                                    case 'active':
                                      return <><i className="fas fa-play-circle me-1"></i>{t('absenceRequest.sessionStatus.active')}</>;
                                    case 'ended':
                                      return <><i className="fas fa-check-circle me-1"></i>{t('absenceRequest.sessionStatus.ended')}</>;
                                    default:
                                      return <><i className="fas fa-info-circle me-1"></i>{status}</>;
                                  }
                                })()}
                              </div>
                              {hasPendingRequest && (
                                <div className="modern-badge modern-badge-warning">
                                  <i className="fas fa-hourglass-half me-1"></i>
                                </div>
                              )}
                              {hasFullSessionRequest && (
                                <div className="modern-badge modern-badge-danger">
                                  <i className="fas fa-ban me-1"></i>
                                  {t('absenceRequest.alreadyRequestedAll')}
                                </div>
                              )}
                              {hasAllPartialRequests && (
                                <div className="modern-badge modern-badge-danger">
                                  <i className="fas fa-ban me-1"></i>
                                  {t('absenceRequest.alreadyRequestedPartialFull')}
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
                              {hasPendingRequest ? (
                                <><i className="fas fa-hourglass-half me-1"></i>{t('absenceRequest.waiting')}</>
                              ) : hasFullSessionRequest ? (
                                <><i className="fas fa-ban me-1"></i>{t('absenceRequest.alreadyRequestedAll')}</>
                              ) : hasAllPartialRequests ? (
                                <><i className="fas fa-ban me-1"></i>{t('absenceRequest.alreadyRequestedPartial')}</>
                              ) : (
                                <><i className="fas fa-calendar-times me-1"></i></>
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
                  <p>{t('absenceRequest.noSessionsAvailable')}</p>
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
                <h5 className="mb-0 fw-bold">{t('absenceRequest.requestHistory')}</h5>
              </div>
            </div>
            <div className="card-body p-0">
              {requests.length > 0 ? (
                <div className="table-responsive">
                  <table className="modern-table modern-table-hover w-100">
                    <thead>
                      <tr>
                        <th>{t('absenceRequest.tableHeaders.session')}</th>
                        <th>{t('absenceRequest.tableHeaders.type')}</th>
                        <th>{t('absenceRequest.tableHeaders.status')}</th>
                        <th>{t('absenceRequest.tableHeaders.makeupDate')}</th>
                        <th>{t('absenceRequest.tableHeaders.evidence')}</th>
                        <th>{t('absenceRequest.tableHeaders.createdAt')}</th>
                        <th>{t('absenceRequest.tableHeaders.actions')}</th>
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
                                <span>{request.session_end_date && request.session_end_date !== request.session_date ? 
                                  `${format(new Date(request.session_date), 'dd/MM/yyyy')} - ${format(new Date(request.session_end_date), 'dd/MM/yyyy')}` :
                                  format(new Date(request.session_date), 'dd/MM/yyyy')}</span>
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
                                    return <>{t('absenceRequest.requestTypeLabels.all')}</>;
                                  case 'before_session':
                                    return <>{t('absenceRequest.requestTypeLabels.before')}</>;
                                  case 'during_session':
                                    return <>{t('absenceRequest.requestTypeLabels.during')}</>;
                                  case 'after_session':
                                    return <>{t('absenceRequest.requestTypeLabels.after')}</>;
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
                            {request.makeup_date ? (
                              <div className="d-flex align-items-center text-primary small">
                                {format(new Date(request.makeup_date), 'dd/MM/yyyy')}
                              </div>
                            ) : (
                              <span className="text-muted small">{t('absenceRequest.noMakeupDate')}</span>
                            )}
                          </td>
                          <td>
                            {request.evidence_file ? (
                              <button
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => window.open(`/api/absence-requests/${request.id}/evidence`, '_blank')}
                                title={t('absenceRequest.downloadEvidence')}
                              >
                                <i className="fas fa-download me-1"></i>
                              </button>
                            ) : (
                              <span className="text-muted small">{t('absenceRequest.noEvidence')}</span>
                            )}
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
                              title={t('absenceRequest.previewConfirmation')}
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
                  <p>{t('absenceRequest.noRequests')}</p>
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
            <Modal.Title className="fw-bold">{t('absenceRequest.pageTitle')}</Modal.Title>
          </div>
        </Modal.Header>
        <Modal.Body className="pt-2">
          {selectedSession && (
            <div className="mb-4">
              <div className="d-flex align-items-center mb-3">
                <div className="rounded-circle bg-info bg-opacity-10 p-2 me-2">
                  <i className="fas fa-info-circle text-info"></i>
                </div>
                <h6 className="mb-0 fw-bold">{t('absenceRequest.sessionInfo')}</h6>
              </div>
              <div className="bg-light p-4 rounded-lg shadow-sm">
                <div className="row g-3">
                  <div className="col-md-12">
                    <h6 className="fw-bold mb-0 session-title-wrap">{selectedSession.title}</h6>
                  </div>
                  <div className="col-md-6">
                    <div className="d-flex align-items-center">
                      <Calendar size={16} className="text-primary me-2" />
                      <span>{selectedSession.end_date && selectedSession.end_date !== selectedSession.date ? 
                                  `${format(new Date(selectedSession.date), 'dd/MM/yyyy')} - ${format(new Date(selectedSession.end_date), 'dd/MM/yyyy')}` :
                                  format(new Date(selectedSession.date), 'dd/MM/yyyy')}</span>
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
              <Form.Label className="fw-medium">{t('absenceRequest.requestTypeRequired')}</Form.Label>
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
                  {(() => {
                    if (!selectedSession) return null;
                    
                    // Kiểm tra các request đã được duyệt/từ chối cho session này
                    const existingProcessedRequests = requests.filter(req => 
                      req.session_id === selectedSession.id && 
                      ['approved', 'rejected'].includes(req.status)
                    );
                    
                    const hasFullSessionRequest = existingProcessedRequests.some(req => 
                      req.request_type === 'full_session'
                    );
                    
                    const hasBeforeRequest = existingProcessedRequests.some(req => 
                      req.request_type === 'before_session'
                    );
                    
                    const hasDuringRequest = existingProcessedRequests.some(req => 
                      req.request_type === 'during_session'
                    );
                    
                    const hasAfterRequest = existingProcessedRequests.some(req => 
                      req.request_type === 'after_session'
                    );
                    
                    // Chỉ disable khi có tất cả 3 loại partial requests
                    const hasAllPartialRequests = hasBeforeRequest && hasDuringRequest && hasAfterRequest;
                    
                    return (
                      <>
                        <option 
                          value="full_session" 
                          disabled={hasFullSessionRequest}
                        >
                          {t('absenceRequest.requestTypes.fullSession')} {hasFullSessionRequest ? t('absenceRequest.requestTypes.alreadyRequested') : ''}
                        </option>
                        <option 
                          value="before_session" 
                          disabled={hasBeforeRequest}
                        >
                          {t('absenceRequest.requestTypes.beforeSession')} {hasBeforeRequest ? t('absenceRequest.requestTypes.alreadyRequested') : ''}
                        </option>
                        <option 
                          value="during_session" 
                          disabled={hasDuringRequest}
                        >
                          {t('absenceRequest.requestTypes.duringSession')} {hasDuringRequest ? t('absenceRequest.requestTypes.alreadyRequested') : ''}
                        </option>
                        <option 
                          value="after_session" 
                          disabled={hasAfterRequest}
                        >
                          {t('absenceRequest.requestTypes.afterSession')} {hasAfterRequest ? t('absenceRequest.requestTypes.alreadyRequested') : ''}
                        </option>
                      </>
                    );
                  })()}
                </Form.Select>
              </div>
              <Form.Text className="text-muted">
                {t('absenceRequest.requestTypeHelp')}
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Label className="fw-medium">{t('absenceRequest.reasonRequired')}</Form.Label>
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
                  placeholder={t('absenceRequest.reasonPlaceholder')}
                  required
                  className="modern-form-control"
                />
              </div>
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Label className="fw-medium">{t('absenceRequest.makeupDate')}</Form.Label>
              <div className="input-group">
                <div className="input-group-text bg-light">
                  <i className="fas fa-calendar-plus"></i>
                </div>
                <Form.Control
                  type="date"
                  name="makeup_date"
                  value={formData.makeup_date}
                  onChange={handleInputChange}
                  min={new Date().toISOString().split('T')[0]}
                  className="modern-form-control"
                />
              </div>
              <Form.Text className="text-muted">
                {t('absenceRequest.makeupDateHelp')}
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Label className="fw-medium">{t('absenceRequest.makeupNotes')}</Form.Label>
              <div className="input-group">
                <div className="input-group-text bg-light">
                  <i className="fas fa-sticky-note"></i>
                </div>
                <Form.Control
                  as="textarea"
                  rows={2}
                  name="makeup_notes"
                  value={formData.makeup_notes}
                  onChange={handleInputChange}
                  placeholder={t('absenceRequest.makeupNotesPlaceholder')}
                  className="modern-form-control"
                />
              </div>
              <Form.Text className="text-muted">
                {t('absenceRequest.makeupNotesHelp')}
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Label className="fw-medium">{t('absenceRequest.evidence')}</Form.Label>
              <div className="input-group">
                <div className="input-group-text bg-light">
                  <i className="fas fa-paperclip"></i>
                </div>
                <Form.Control
                  type="file"
                  onChange={handleFileChange}
                  accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.txt"
                  className="modern-form-control"
                />
              </div>
              <Form.Text className="text-muted">
                {t('absenceRequest.evidenceHelp')}
              </Form.Text>
              {evidenceFile && (
                <div className="mt-2">
                  <div className="d-flex align-items-center gap-2 p-2 bg-light rounded">
                    <i className="fas fa-file text-primary"></i>
                    <span className="small">{evidenceFile.name}</span>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger ms-auto"
                      onClick={() => setEvidenceFile(null)}
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                </div>
              )}
            </Form.Group>

            <div className="d-flex justify-content-end gap-2">
              <button
                className="btn-modern"
                onClick={() => setShowRequestModal(false)}
                disabled={submitting}
                style={{ backgroundColor: '#6b7280' }}
              >
                {t('absenceRequest.cancel')}
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
                      <span className="visually-hidden">{t('common.loading')}</span>
                    </div>
                    <span>{t('absenceRequest.submitting')}</span>
                  </div>
                ) : (
                  <div className="d-flex align-items-center gap-2">
                    <Send size={16} />
                    <span>{t('absenceRequest.submit')}</span>
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
