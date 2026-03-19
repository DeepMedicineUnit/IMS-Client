import React, { useState, useEffect, useRef } from 'react';
import { Card, Row, Col, Button, Alert, Table, Modal, Spinner } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { format, parseISO } from 'date-fns';
import { useAlert } from '../../contexts/AlertContext';
import { useTranslation } from 'react-i18next';
import { Calendar, Clock, MapPin, RefreshCcw, ArrowRight, CheckCircle, AlertTriangle, Info, User, List, Eye, Search, X } from 'lucide-react';
import '../../styles/modern-ui.css';
import usePageTitle from '../../hooks/usePageTitle';

// Custom CSS for refresh overlay
const refreshOverlayStyle = {
  position: 'relative',
  minHeight: '50px',
};

const spinnerOverlayStyle = {
  position: 'absolute',
  top: '10px',
  right: '10px',
  zIndex: 1000,
};

// Custom hook for polling at intervals
const useInterval = (callback, delay) => {
  const savedCallback = useRef();

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval
  useEffect(() => {
    function tick() {
      savedCallback.current();
    }
    if (delay !== null) {
      const id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);

};

const StudentDashboard = () => {
  const { t } = useTranslation();
  usePageTitle(t('studentDashboard.title'));
  const { showAlert } = useAlert();
  const { currentUser, api } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [attendedSessions, setAttendedSessions] = useState([]);
  const [locationData, setLocationData] = useState(null);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [checkingGeofence, setCheckingGeofence] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [showGeofenceModal, setShowGeofenceModal] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState(new Date());
  const [allSessions, setAllSessions] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filter sessions based on search term
  const filteredSessions = allSessions.filter(session => 
    session.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    session.location?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Function to calculate distance between two coordinates in meters
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  };

  // Check if user is within geofence
  const isWithinGeofence = (userLocation, geofence) => {
    if (!userLocation || !geofence || !geofence.enabled || 
        !geofence.coordinates || !geofence.coordinates.latitude || 
        !geofence.coordinates.longitude) {
      // If geofence is not properly configured, return true (don't restrict)
      return true;
    }

    const distance = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      geofence.coordinates.latitude,
      geofence.coordinates.longitude
    );

    // Return true if within radius
    return distance <= geofence.radius;
  };
  
  // Function to fetch dashboard data
  const fetchDashboardData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      // Get active sessions and sessions ended today the student is part of (through groups)
      const sessionsResponse = await api.get('/sessions/student/attendance?status=active');
      if (sessionsResponse.data.success) {
        
        // Also get sessions that ended today
        const todayEndedResponse = await api.get('/sessions/student/attendance?status=ended&today=true');
        let todayEndedSessions = [];
        if (todayEndedResponse.data.success) {
          todayEndedSessions = todayEndedResponse.data.data;
        }
        
        // Combine active sessions and today's ended sessions, removing duplicates
        const activeSessionIds = new Set(sessionsResponse.data.data.map(s => s.id));
        const uniqueTodayEndedSessions = todayEndedSessions.filter(s => !activeSessionIds.has(s.id));
        const combinedSessions = [...sessionsResponse.data.data, ...uniqueTodayEndedSessions];
        setUpcomingSessions(combinedSessions);
      }
      
      // Get attendance history
      const attendanceResponse = await api.get('/sessions/student/attendance?attended=true');
      if (attendanceResponse.data.success) {
        setAttendedSessions(attendanceResponse.data.data);
      }
      
      // Get all sessions for the list tab
      const allSessionsResponse = await api.get('/sessions/student/attendance?all=true');
      if (allSessionsResponse.data.success) {
        setAllSessions(allSessionsResponse.data.data);
      }
      
      // Request location permission (only on initial load, not during refresh)
      if (!isRefresh && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setLocationData({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            });
            setHasLocationPermission(true);
          },
          (error) => {
            console.error('Error getting location:', error);
            setHasLocationPermission(false);
          }
        );
      }
      
      // Update last refresh time
      setLastRefreshTime(new Date());
      setError('');
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError(t('studentDashboard.errors.cannotLoadData'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  // Initial data fetch - only run once on mount
  useEffect(() => {
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only fetch on mount
  
  // Set up auto-refresh interval (every 30 seconds)
  useInterval(() => {
    fetchDashboardData(true);
  }, 30000); // 30 seconds
  
  // Function to check if the current time is within the allowed attendance window
  const checkAttendanceWindow = (session) => {
    const now = new Date();
    const sessionDate = new Date(session.date);
    
    // Set year, month, day from session date
    const currentDate = new Date();
    currentDate.setFullYear(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate());

    // Set session start and end times
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

    // Allow attendance 30 minutes before session starts and until session ends
    const attendanceStartTime = new Date(sessionStartTime);
    attendanceStartTime.setMinutes(attendanceStartTime.getMinutes() - 30);

    // Check if current time is within attendance window (30 min before start to end)
    return now >= attendanceStartTime && now <= sessionEndTime;
  };

  // Function to check if session is currently active (within time window)
  const isSessionActive = (session) => {
    return checkAttendanceWindow(session);
  };

  // Function to check if session has ended
  const isSessionEnded = (session) => {
    const now = new Date();
    const sessionDate = new Date(session.date);
    
    // Set year, month, day from session date
    const currentDate = new Date();
    currentDate.setFullYear(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate());
    
    // Set session end time
    const [endHours, endMinutes] = session.end_time.split(':').map(Number);
    const sessionEndTime = new Date(currentDate);
    sessionEndTime.setHours(endHours, endMinutes, 0, 0);
    
    // Handle sessions that span across midnight
    if (sessionEndTime < new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 12, 0, 0)) {
      sessionEndTime.setDate(sessionEndTime.getDate() + 1);
    }
    
    return now > sessionEndTime;
  };

  // Function to handle joining a session
  const handleJoinSession = async (session) => {
    try {
      setCheckingGeofence(true);
      setSelectedSession(session);
      
      // Check geofence if location monitoring is enabled
      if (session.monitoring_options?.location?.enabled && 
          session.monitoring_options?.location?.geofence?.enabled) {
        
        if (!hasLocationPermission) {
          showAlert(t('studentDashboard.errors.locationPermissionRequired'), 'danger');
          return;
        }
        
        const withinGeofence = isWithinGeofence(
          locationData, 
          session.monitoring_options.location.geofence
        );
        
        if (!withinGeofence) {
          setShowGeofenceModal(true);
          return;
        }
      }
      
      // Check if session has shared QR code
      if (session.shared_qr_code) {
        // Navigate to shared attendance page
        navigate(`/session/${session.id}/attend-shared?token=${session.shared_qr_code}`);
      } else {
        // Generate temporary token for attendance
        try {
          const tokenResponse = await api.post(`/sessions/${session.id}/generate-token`);
          if (tokenResponse.data.success) {
            navigate(`/session/${session.id}/attend?token=${tokenResponse.data.token}`);
          } else {
            throw new Error('Failed to generate token');
          }
        } catch (tokenError) {
          console.error('Error generating token:', tokenError);
          showAlert(t('studentDashboard.errors.cannotGenerateToken'), 'danger');
        }
      }
    } catch (error) {
      console.error('Error joining session:', error);
      showAlert(t('studentDashboard.errors.cannotJoinSession'), 'danger');
    } finally {
      setCheckingGeofence(false);
      setSelectedSession(null);
    }
  };

  // Function to handle accessing monitoring page
  const handleAccessMonitoring = (session) => {
    navigate(`/session/${session.id}/monitor`);
  };

  // Function to check if a date is today
  const isToday = (dateString) => {
    const today = new Date();
    const sessionDate = parseISO(dateString);
    
    return today.getFullYear() === sessionDate.getFullYear() &&
           today.getMonth() === sessionDate.getMonth() &&
           today.getDate() === sessionDate.getDate();
  };

  // Format date range for multi-day sessions
  const formatDateRange = (startDate, endDate) => {
    const start = format(parseISO(startDate), 'dd/MM/yyyy');
    if (!endDate || startDate === endDate) {
      return start;
    }
    const end = format(parseISO(endDate), 'dd/MM/yyyy');
    return `${start} - ${end}`;
  };

  // Function to get session status
  const getSessionStatus = (session) => {
    const now = new Date();
    const sessionDate = new Date(session.date);
    
    // Set year, month, day from session date
    const currentDate = new Date();
    currentDate.setFullYear(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate());

    // Set session start and end times
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

    // Allow attendance 30 minutes before session starts
    const attendanceStartTime = new Date(sessionStartTime);
    attendanceStartTime.setMinutes(attendanceStartTime.getMinutes() - 30);

    if (now < attendanceStartTime) {
      return { status: 'upcoming', text: t('studentDashboard.sessionStatus.upcoming'), color: 'info' };
    } else if (now >= attendanceStartTime && now < sessionStartTime) {
      return { status: 'upcoming', text: t('studentDashboard.sessionStatus.canAttend'), color: 'warning' };
    } else if (now >= sessionStartTime && now <= sessionEndTime) {
      return { status: 'active', text: t('studentDashboard.sessionStatus.active'), color: 'success' };
    } else {
      return { status: 'ended', text: t('studentDashboard.sessionStatus.ended'), color: 'secondary' };
    }
  };

  // Function to render session card
  const renderSessionCard = (session, showActions = true) => {
    const sessionStatus = getSessionStatus(session);
    
    return (
      <div key={session.id} className="bg-white rounded-lg p-4 mb-3 shadow-sm border">
        <div className="d-flex justify-content-between align-items-start mb-3">
          <h6 className="fw-bold mb-0 text-dark session-title-truncated">{session.title}</h6>
          <span className={`badge bg-${sessionStatus.color} ${sessionStatus.status === 'active' ? 'badge-live-status' : ''} ${sessionStatus.text === 'Có thể điểm danh' ? 'badge-live-status' : ''}`}>
            {sessionStatus.text}
          </span>
        </div>
        
        <div className="d-flex flex-wrap gap-3 mb-3 text-muted small">
          <div className="d-flex align-items-center">
            <Calendar size={14} className="me-1" />
            <span>{formatDateRange(session.date, session.end_date)}</span>
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
        
         {showActions && (
           <div className="d-flex gap-2">
             {(sessionStatus.status === 'active' || sessionStatus.status === 'ended') && (
               <button
                 className="btn-modern btn-modern-outline"
                 onClick={() => handleAccessMonitoring(session)}
                 title={t('studentDashboard.viewDetails')}
                 style={{ 
                   padding: '0.5rem 0.5rem',
                   fontSize: '1.875rem',
                   minWidth: '50px'
                 }}
               >
                 <Eye size={14} className="me-1" />
               </button>
             )}
             


             {(sessionStatus.status === 'upcoming' || sessionStatus.status === 'active' || 
               (sessionStatus.status === 'ended' && isToday(session.date))) && (
               <button
                 className="btn-modern"
                 onClick={() => handleJoinSession(session)}
                 title={t('studentDashboard.joinSession')}
                 disabled={checkingGeofence && selectedSession?.id === session.id}
                 style={{ 
                   padding: '0.5rem 1rem',
                   fontSize: '0.875rem',
                   minWidth: '120px',
                   backgroundColor: sessionStatus.status === 'ended' ? '#dc3545' : '#256176' // Red for ended sessions
                 }}
               >
                 {checkingGeofence && selectedSession?.id === session.id ? (
                   <>
                     <div className="spinner-border spinner-border-sm me-1" role="status">
                       <span className="visually-hidden">{t('common.loading')}</span>
                     </div>
                     <span>{t('studentDashboard.checking')}</span>
                   </>
                 ) : (
                   <>
                     <ArrowRight size={19} className="me-1 arrow-bounce" />
                     <span>{t('studentDashboard.joinAttendance')}</span>
                   </>
                 )}
               </button>
             )}
           </div>
         )}
      </div>
    );
  };

  // Function to render session list item (for the session list tab)
  const renderSessionListItem = (session) => {
    const sessionStatus = getSessionStatus(session);
    
    return (
      <div key={session.id} className="session-list-item">
        <div className="d-flex align-items-center">
          <div className="flex-grow-1">
            <div className="d-flex align-items-start mb-2">
              <h6 className="fw-bold mb-0 text-dark session-title-truncated me-3">{session.title}</h6>
              <span className={`badge bg-${sessionStatus.color} ${sessionStatus.status === 'active' ? 'badge-live-status' : ''} ${sessionStatus.text === 'Có thể điểm danh' ? 'badge-live-status' : ''}`}>
                {sessionStatus.text}
              </span>
            </div>
            <div className="session-info-compact">
              <span className="text-muted small">{formatDateRange(session.date, session.end_date)}</span>
              <span className="text-muted small mx-2">|</span>
              <span className="text-muted small">{session.start_time} - {session.end_time}</span>
              {session.location && (
                <>
                  <span className="text-muted small mx-1">•</span>
                  <span className="text-muted small">{session.location}</span>
                </>
              )}
            </div>
          </div>
          <div className="session-actions-compact">
            {(sessionStatus.status === 'active' || sessionStatus.status === 'ended') && (
              <button
                className="btn-modern btn-modern-outline"
                onClick={() => handleAccessMonitoring(session)}
                title={t('studentDashboard.viewDetails')}
                style={{ 
                  padding: '0.5rem 0.5rem',
                  fontSize: '0.6rem',
                  minWidth: '30px'
                }}
              >
                <Eye size={12} className="me-1" />
              </button>
            )}
            {(sessionStatus.status === 'upcoming' || sessionStatus.status === 'active' || 
              (sessionStatus.status === 'ended' && isToday(session.date))) && (
              <button
                className="btn-modern"
                onClick={() => handleJoinSession(session)}
                title={t('studentDashboard.joinSession')}
                disabled={checkingGeofence && selectedSession?.id === session.id}
                style={{ 
                  padding: '0.5rem 0.5rem',
                  fontSize: '0.6rem',
                  minWidth: '30px',
                  backgroundColor: sessionStatus.status === 'ended' ? '#dc3545' : '#256176' // Red for ended sessions
                }}
              >
                {checkingGeofence && selectedSession?.id === session.id ? (
                  <div className="spinner-border spinner-border-sm" role="status">
                    <span className="visually-hidden">{t('common.loading')}</span>
                  </div>
                ) : (
                  <>
                    <ArrowRight size={14} className="me-1" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Main render
  if (loading) {
    return (
      <div className="text-center p-5">
        <div className="modern-card">
          <div className="card-body text-center py-5">
            <div className="spinner-border text-primary mb-3" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mb-0">{t('studentDashboard.loadingSessions')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !currentUser) {
    return (
      <div className="modern-card">
        <div className="card-header">
          <div className="d-flex align-items-center">
            <i className="fas fa-exclamation-triangle me-2 text-danger"></i>
            <h5 className="mb-0 fw-bold">{t('studentDashboard.cannotLoadData')}</h5>
          </div>
        </div>
        <div className="card-body">
          <p className="mb-3">{error || t('studentDashboard.errorOccurred')}</p>
          <div className="d-flex justify-content-end">
            <button 
              className="btn-modern" 
              style={{ backgroundColor: '#dc3545' }}
              onClick={() => window.location.reload()}
            >
              <i className="fas fa-refresh me-2"></i>
              {t('studentDashboard.reloadPage')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="modern-card shadow-sm p-4 mb-4">
        <Row>
          <Col md={7}>
            <div className="d-flex align-items-center">
              <div>
                <h2 className="mb-1 fw-bold">{t('studentDashboard.hello')}, {currentUser?.full_name || currentUser?.username}</h2>
                <div className="d-flex align-items-center">
                  <span className="badge modern-badge-primary me-2">{t('studentDashboard.student')}</span>
                </div>
              </div>
            </div>
          </Col>
          <Col md={5}>
            <div className="d-flex justify-content-end align-items-center h-100 gap-2">
              <button 
                className="btn-modern"
                onClick={() => navigate('/student/schedule')}
                title="Thời khóa biểu"
                style={{ backgroundColor: '#256176' }}
              >
                <i className="fas fa-calendar-alt"></i>
              </button>
              
              <button 
                className="btn-modern"
                onClick={() => navigate('/student/performance')}
                title="Hiệu suất"
                style={{ backgroundColor: '#10b981' }}
              >
                <i className="fas fa-chart-line"></i>
              </button>
              
              <button 
                className="btn-modern"
                onClick={() => navigate('/student/absence-requests')}
                title={t('studentDashboard.absenceRequests')}
                style={{ backgroundColor: '#f59e0b' }}
              >
                <i className="fas fa-calendar-times"></i>
              </button>
              
              <button 
                className="btn-modern"
                onClick={() => fetchDashboardData(true)}
                disabled={refreshing}
                title={t('studentDashboard.update')}
              >
                {refreshing ? (
                  <div className="spinner-border spinner-border-sm" role="status">
                    <span className="visually-hidden">{t('common.loading')}</span>
                  </div>
                ) : (
                  <RefreshCcw size={16} />
                )}
              </button>
            </div>
          </Col>
        </Row>
      </div>
      
      {error && (
        <div className="modern-alert modern-alert-danger mb-4">
          <div className="d-flex align-items-center">
            <AlertTriangle size={20} className="me-2 text-danger" />
            <div>{error}</div>
          </div>
        </div>
      )}
      
      {/* Geofence Error Modal */}
      <Modal show={showGeofenceModal} onHide={() => setShowGeofenceModal(false)} centered>
        <Modal.Header closeButton className="border-0">
          <div className="d-flex align-items-center">
            <div className="rounded-circle bg-danger bg-opacity-10 p-2 me-2">
              <MapPin size={20} className="text-danger" />
            </div>
            <Modal.Title className="fw-bold">{t('studentDashboard.geofenceModal.title')}</Modal.Title>
          </div>
        </Modal.Header>
        <Modal.Body className="pt-0">
          <div className="text-center mb-4">
            <div className="rounded-circle bg-danger bg-opacity-10 d-inline-flex align-items-center justify-content-center mb-3" style={{width: '80px', height: '80px'}}>
              <MapPin size={32} className="text-danger" />
            </div>
            <h5 className="fw-bold mb-2">{t('studentDashboard.geofenceModal.outOfRange')}</h5>
            <p className="text-muted">{t('studentDashboard.geofenceModal.outOfRangeDesc')}</p>
          </div>
          
          {selectedSession && selectedSession.monitoring_options?.location?.geofence && (
            <div className="modern-alert modern-alert-info mb-4">
              <div className="d-flex align-items-center">
                <Info size={20} className="me-2 text-info" />
                <div>
                  <strong>{t('studentDashboard.geofenceModal.allowedRadius')}:</strong> {selectedSession.monitoring_options.location.geofence.radius} {t('studentDashboard.geofenceModal.metersFromLocation')}
                </div>
              </div>
            </div>
          )}

          <div className="d-flex justify-content-end gap-2">
          <button 
            className="btn-modern"
            onClick={() => setShowGeofenceModal(false)}
            style={{ backgroundColor: '#6b7280' }}
          >
            {t('studentDashboard.geofenceModal.close')}
          </button>
          </div>
        </Modal.Body>
      </Modal>
      
      {/* Main Content Layout */}
      <Row className="mb-4">
        {/* Buổi học hôm nay */}
        <Col md={6} className="mb-4">
          <div className="modern-card h-100 shadow-sm">
            <div className="card-header bg-white border-0">
              <div className="d-flex align-items-center">
                <div className="rounded-circle bg-primary bg-opacity-10 p-2 me-2">
                  <Calendar size={18} className="text-primary" />
                </div>
                <h5 className="mb-0 fw-bold">{t('studentDashboard.todaySessions')}</h5>
                {upcomingSessions.length > 0 && (
                  <span className="badge bg-primary ms-2">{upcomingSessions.length}</span>
                )}
              </div>
            </div>
            <div className="card-body">
              {loading ? (
                <div className="text-center p-4">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Đang tải...</span>
                  </div>
                </div>
              ) : refreshing ? (
                <div style={refreshOverlayStyle}>
                  <div style={spinnerOverlayStyle}>
                    <div className="spinner-border spinner-border-sm text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </div>
                  {upcomingSessions.length > 0 ? (
                    <div className="modern-list-group">
                      {upcomingSessions.map(session => renderSessionCard(session))}
                    </div>
                  ) : (
                    <div className="text-center text-muted py-5">
                      <div className="rounded-circle bg-light d-inline-flex align-items-center justify-content-center mb-3" style={{width: '80px', height: '80px'}}>
                        <Calendar size={32} className="text-muted" />
                      </div>
                      <p>{t('studentDashboard.noSessionsToday')}</p>
                    </div>
                  )}
                </div>
              ) : upcomingSessions.length > 0 ? (
                <div className="modern-list-group">
                  {upcomingSessions.map(session => renderSessionCard(session))}
                </div>
              ) : (
                <div className="text-center text-muted py-5">
                  <div className="rounded-circle bg-light d-inline-flex align-items-center justify-content-center mb-3" style={{width: '80px', height: '80px'}}>
                    <Calendar size={32} className="text-muted" />
                  </div>
                  <p>{t('studentDashboard.noSessionsToday')}</p>
                </div>
              )}
            </div>
          </div>
        </Col>
        
        {/* Danh sách buổi học */}
        <Col md={6} className="mb-4">
          <div className="modern-card h-100 shadow-sm">
            <div className="card-header bg-white border-0 position-relative">
              {!showSearch ? (
                <div className="d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center">
                    <div className="rounded-circle bg-info bg-opacity-10 p-2 me-2">
                      <List size={18} className="text-info" />
                    </div>
                    <h5 className="mb-0 fw-bold">{t('studentDashboard.sessionList')}</h5>
                    {allSessions.length > 0 && (
                      <span className="badge bg-info ms-2">{allSessions.length}</span>
                    )}
                  </div>
                  <button
                    className="btn btn-sm btn-outline-info"
                    onClick={() => setShowSearch(true)}
                    title={t('studentDashboard.searchSessions')}
                  >
                    <Search size={16} />
                  </button>
                </div>
              ) : (
                <div className="search-header-overlay">
                  <div className="input-group">
                    <input
                      type="text"
                      className="form-control"
                      placeholder={t('studentDashboard.searchPlaceholder')}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      autoFocus
                    />
                    <button
                      className="btn btn-outline-secondary"
                      onClick={() => {
                        setShowSearch(false);
                        setSearchTerm('');
                      }}
                      title={t('studentDashboard.closeSearch')}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="card-body">
              {loading ? (
                <div className="text-center p-4">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Đang tải...</span>
                  </div>
                </div>
              ) : (showSearch ? filteredSessions : allSessions).length > 0 ? (
                <div 
                  className="modern-list-group"
                  style={{
                    maxHeight: '600px',
                    overflowY: 'auto',
                    paddingRight: '8px'
                  }}
                >
                  {(showSearch ? filteredSessions : allSessions).map(session => renderSessionListItem(session))}
                </div>
              ) : (
                <div className="text-center text-muted py-5">
                  <div className="rounded-circle bg-light d-inline-flex align-items-center justify-content-center mb-3" style={{width: '80px', height: '80px'}}>
                    <List size={32} className="text-muted" />
                  </div>
                  <p>{showSearch && searchTerm ? t('studentDashboard.noSessionsFound') : t('studentDashboard.noSessions')}</p>
                </div>
              )}
            </div>
          </div>
        </Col>
      </Row>
      
      {/* Lịch sử buổi học */}
      <Row>
        <Col>
          <div className="modern-card shadow-sm mb-4">
            <div className="card-header bg-white border-0">
              <div className="d-flex align-items-center">
                <div className="rounded-circle bg-success bg-opacity-10 p-2 me-2">
                  <i className="fas fa-history text-success"></i>
                                          </div>
                <h5 className="mb-0 fw-bold">{t('studentDashboard.attendanceHistory')}</h5>
                {attendedSessions.length > 0 && (
                  <span className="badge bg-success ms-2">{attendedSessions.length}</span>
                                      )}
                                    </div>
                                    </div>
            <div className="card-body p-0">
              {loading ? (
                <div className="text-center p-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Đang tải...</span>
                  </div>
                </div>
              ) : attendedSessions.length > 0 ? (
                <div 
                className="table-responsive"
                style={{ maxHeight: '400px', overflowY: 'auto' }}
                >
                  <table className="modern-table modern-table-hover w-100 col-custom">
                    <thead>
                      <tr>
                        <th>{t('studentDashboard.sessionName')}</th>
                        <th>{t('studentDashboard.date')}</th>
                        <th>{t('studentDashboard.time')}</th>
                        <th>{t('studentDashboard.attendance')}</th>
                        <th>{t('studentDashboard.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendedSessions.map(session => (
                        <tr key={session.id}>
                          <td>
                            <div className="fw-bold mb-0 text-dark session-title-truncated">{session.title}</div>
                          </td>
                          <td>
                            <div className="d-flex align-items-center">
                              <Calendar size={14} className="me-1 text-primary" />
                              <span>{formatDateRange(session.date, session.end_date)}</span>
                            </div>
                          </td>
                          <td>
                            <div className="d-flex align-items-center">
                              <Clock size={14} className="me-1 text-primary" />
                              <span>{session.start_time} - {session.end_time}</span>
                            </div>
                          </td>
                          <td>
                            {(() => {
                              // Lấy tất cả các bản ghi điểm danh (hiện tại và lịch sử)
                              const allAttendanceRecords = [];
                              
                              // Thêm bản ghi hiện tại nếu có
                              if (session.attendance_type) {
                                allAttendanceRecords.push({
                                  attendance_type: session.attendance_type,
                                  minutes_early: session.minutes_early,
                                  minutes_late: session.minutes_late,
                                  timestamp: session.attendance_timestamp,
                                  isCurrent: true
                                });
                              }
                              
                              // Thêm các bản ghi lịch sử nếu có
                              if (session.attendance_history && Array.isArray(session.attendance_history)) {
                                session.attendance_history.forEach(record => {
                                  allAttendanceRecords.push({
                                    ...record,
                                    isCurrent: false
                                  });
                                });
                              }
                              
                              // Sắp xếp theo thời gian (mới nhất lên đầu)
                              allAttendanceRecords.sort((a, b) => {
                                const timeA = new Date(a.timestamp);
                                const timeB = new Date(b.timestamp);
                                return timeB - timeA;
                              });
                              
                              // Hiển thị badge theo loại điểm danh
                              const getAttendanceBadge = (record) => {
                                const formatTime = (timestamp) => {
                                  if (!timestamp) return '';
                                  try {
                                    return format(new Date(timestamp), 'HH:mm');
                                  } catch {
                                    return '';
                                  }
                                };
                                
                                if (!record.attendance_type) return (
                                  <div className="modern-badge modern-badge-success" title={`${t('studentDashboard.time')}: ${formatTime(record.timestamp)}`}>
                                    <span>{t('studentDashboard.attendanceTypes.present')}</span>
                                    {formatTime(record.timestamp) && <small className="ms-1">({formatTime(record.timestamp)})</small>}
                                  </div>
                                );
                                
                                switch (record.attendance_type) {
                                  case 'before':
                                    return (
                                      <div className="modern-badge modern-badge-success" title={`${t('studentDashboard.time')}: ${formatTime(record.timestamp)}`}>
                                        <span>{t('studentDashboard.attendanceTypes.before')}</span>
                                        {formatTime(record.timestamp) && <small className="ms-1">({formatTime(record.timestamp)})</small>}
                                      </div>
                                    );
                                  case 'during':
                                    return (
                                      <div className="modern-badge modern-badge-success" title={`${t('studentDashboard.time')}: ${formatTime(record.timestamp)}`}>
                                        <span>{t('studentDashboard.attendanceTypes.during')}</span>
                                        {formatTime(record.timestamp) && <small className="ms-1">({formatTime(record.timestamp)})</small>}
                                      </div>
                                    );
                                  case 'after':
                                    return (
                                      <div className="modern-badge modern-badge-success" title={`${t('studentDashboard.time')}: ${formatTime(record.timestamp)}`}>
                                        <span>{t('studentDashboard.attendanceTypes.after')}</span>
                                        {formatTime(record.timestamp) && <small className="ms-1">({formatTime(record.timestamp)})</small>}
                                      </div>
                                    );
                                  case 'early':
                                    return (
                                      <div className="modern-badge modern-badge-info" title={`${t('studentDashboard.time')}: ${formatTime(record.timestamp)}`}>
                                        <span>{t('studentDashboard.attendanceTypes.early', { minutes: record.minutes_early })}</span>
                                        {formatTime(record.timestamp) && <small className="ms-1">({formatTime(record.timestamp)})</small>}
                                      </div>
                                    );
                                  case 'late':
                                  case 'late_before':
                                    return (
                                      <div className="modern-badge modern-badge-warning" title={`${t('studentDashboard.time')}: ${formatTime(record.timestamp)}`}>
                                        <span>{t('studentDashboard.attendanceTypes.late', { minutes: record.minutes_late })}</span>
                                        {formatTime(record.timestamp) && <small className="ms-1">({formatTime(record.timestamp)})</small>}
                                      </div>
                                    );
                                  case 'late_leave':
                                    return (
                                      <div className="modern-badge modern-badge-warning" title={`${t('studentDashboard.time')}: ${formatTime(record.timestamp)}`}>
                                        <span>{t('studentDashboard.attendanceTypes.late', { minutes: record.minutes_late })}</span>
                                        {formatTime(record.timestamp) && <small className="ms-1">({formatTime(record.timestamp)})</small>}
                                      </div>
                                    );
                                  case 'absent_perm':
                                    return (
                                      <div className="modern-badge modern-badge-danger" title={`${t('studentDashboard.time')}: ${formatTime(record.timestamp)}`}>
                                        <span>{t('studentDashboard.attendanceTypes.absentPerm')}</span>
                                        {formatTime(record.timestamp) && <small className="ms-1">({formatTime(record.timestamp)})</small>}
                                      </div>
                                    );
                                  case 'absent_before_perm':
                                    return (
                                      <div className="modern-badge modern-badge-info" title={`${t('studentDashboard.time')}: ${formatTime(record.timestamp)}`}>
                                        <span>{t('studentDashboard.attendanceTypes.absentBeforePerm')}</span>
                                        {formatTime(record.timestamp) && <small className="ms-1">({formatTime(record.timestamp)})</small>}
                                      </div>
                                    );
                                  case 'absent_during_perm':
                                    return (
                                      <div className="modern-badge modern-badge-warning" title={`${t('studentDashboard.time')}: ${formatTime(record.timestamp)}`}>
                                        <span>{t('studentDashboard.attendanceTypes.absentDuringPerm')}</span>
                                        {formatTime(record.timestamp) && <small className="ms-1">({formatTime(record.timestamp)})</small>}
                                      </div>
                                    );
                                  case 'absent_after_perm':
                                    return (
                                      <div className="modern-badge modern-badge-secondary" title={`${t('studentDashboard.time')}: ${formatTime(record.timestamp)}`}>
                                        <span>{t('studentDashboard.attendanceTypes.absentAfterPerm')}</span>
                                        {formatTime(record.timestamp) && <small className="ms-1">({formatTime(record.timestamp)})</small>}
                                      </div>
                                    );
                                  default:
                                    return (
                                      <div className="modern-badge modern-badge-success">
                                        <CheckCircle size={12} className="me-1" />
                                        <span>{t('studentDashboard.attendanceTypes.present')}</span>
                                      </div>
                                    );
                                }
                              };
                              
                              // Nếu không có bản ghi nào
                              if (allAttendanceRecords.length === 0) {
                                return (
                                  <div className="modern-badge modern-badge-success">
                                    <CheckCircle size={12} className="me-1" />
                                  </div>
                                );
                              }
                              
                              // Hiển thị tất cả bản ghi điểm danh
                              return (
                                <div className="d-flex flex-wrap align-items-center gap-1">
                                  {allAttendanceRecords.map((record, index) => (
                                    <div key={index} className="d-flex align-items-center">
                                      {getAttendanceBadge(record)}
                                      {record.isCurrent && (
                                        <small className="text-success ms-1" title={t('studentDashboard.attendanceTypes.currentRecord')}>
                                        </small>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}
                          </td>
                          <td>
                               <div className="d-flex gap-2">


                            <button 
                                   className="btn-modern btn-modern-outline"
                                   onClick={() => handleAccessMonitoring(session)}
                                   style={{ 
                                     padding: '0.375rem 0.75rem',
                                     fontSize: '0.8rem',
                                     minWidth: '100px'
                                   }}
                                 >
                                   <Eye size={12} className="me-1" />
                            </button>



                               </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center text-muted py-5">
                  <div className="rounded-circle bg-light d-inline-flex align-items-center justify-content-center mb-3" style={{width: '80px', height: '80px'}}>
                    <i className="fas fa-history fa-2x text-muted"></i>
                  </div>
                  <p>{t('studentDashboard.noAttendanceHistory')}</p>
                </div>
              )}
            </div>
          </div>
        </Col>
      </Row>
      
      {/* Hướng dẫn và Quy định */}
      <Row className="mt-4">
        <Col>
          <div className="modern-card shadow-sm">
            <div className="card-header bg-white border-0">
              <div className="d-flex align-items-center">
                <div className="rounded-circle bg-info bg-opacity-10 p-2 me-2">
                  <i className="fas fa-info-circle text-info"></i>
                </div>
                <h5 className="mb-0 fw-bold">{t('studentDashboard.guidelines.title')}</h5>
              </div>
            </div>
            <div className="card-body">
              <Row>
                {/* Hướng dẫn sử dụng */}
                <Col md={6} className="mb-4">
                  <h6 className="fw-bold mb-3">
                    <i className="fas fa-book me-2"></i>
                    {t('studentDashboard.guidelines.usageGuide')}
                  </h6>
                  <div className="modern-list-group">
                    <div className="modern-list-item">
                      <div className="d-flex align-items-start">
                        <div className="rounded-circle bg-light p-1 me-3 mt-1">
                          <i className="fas fa-qrcode text-muted" style={{fontSize: '12px'}}></i>
                        </div>
                        <div>
                          <strong>{t('studentDashboard.guidelines.qrCodeAttendance.title')}</strong>
                          <p className="mb-1 small text-muted">{t('studentDashboard.guidelines.qrCodeAttendance.desc')}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="modern-list-item">
                      <div className="d-flex align-items-start">
                        <div className="rounded-circle bg-light p-1 me-3 mt-1">
                          <i className="fas fa-map-marker-alt text-muted" style={{fontSize: '12px'}}></i>
                        </div>
                        <div>
                          <strong>{t('studentDashboard.guidelines.locationConfirmation.title')}</strong>
                          <p className="mb-1 small text-muted">{t('studentDashboard.guidelines.locationConfirmation.desc')}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="modern-list-item">
                      <div className="d-flex align-items-start">
                        <div className="rounded-circle bg-light p-1 me-3 mt-1">
                          <i className="fas fa-video text-muted" style={{fontSize: '12px'}}></i>
                        </div>
                        <div>
                          <strong>{t('studentDashboard.guidelines.webcamMonitoring.title')}</strong>
                          <p className="mb-1 small text-muted">{t('studentDashboard.guidelines.webcamMonitoring.desc')}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="modern-list-item">
                      <div className="d-flex align-items-start">
                        <div className="rounded-circle bg-light p-1 me-3 mt-1">
                          <i className="fas fa-clock text-muted" style={{fontSize: '12px'}}></i>
                        </div>
                        <div>
                          <strong>{t('studentDashboard.guidelines.attendanceTime.title')}</strong>
                          <p className="mb-1 small text-muted">{t('studentDashboard.guidelines.attendanceTime.desc')}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Col>
                
                {/* Các loại điểm danh */}
                <Col md={6} className="mb-4">
                  <h6 className="fw-bold mb-3">
                    <i className="fas fa-check-circle me-2"></i>
                    {t('studentDashboard.guidelines.attendanceTypes')}
                  </h6>
                  <div className="modern-list-group">
                    <div className="modern-list-item">
                      <div className="d-flex align-items-center mb-2">
                        <span className="badge bg-light text-dark me-2">{t('studentDashboard.guidelines.attendanceTypeBefore.label')}</span>
                        <small className="text-muted">{t('studentDashboard.guidelines.attendanceTypeBefore.desc')}</small>
                      </div>
                    </div>
                    
                    <div className="modern-list-item">
                      <div className="d-flex align-items-center mb-2">
                        <span className="badge bg-light text-dark me-2">{t('studentDashboard.guidelines.attendanceTypeDuring.label')}</span>
                        <small className="text-muted">{t('studentDashboard.guidelines.attendanceTypeDuring.desc')}</small>
                      </div>
                    </div>
                    
                    <div className="modern-list-item">
                      <div className="d-flex align-items-center mb-2">
                        <span className="badge bg-light text-dark me-2">{t('studentDashboard.guidelines.attendanceTypeAfter.label')}</span>
                        <small className="text-muted">{t('studentDashboard.guidelines.attendanceTypeAfter.desc')}</small>
                      </div>
                    </div>
                    
                    <div className="modern-list-item">
                      <div className="d-flex align-items-center mb-2">
                        <span className="badge bg-light text-dark me-2">{t('studentDashboard.guidelines.attendanceTypeLate.label')}</span>
                        <small className="text-muted">{t('studentDashboard.guidelines.attendanceTypeLate.desc')}</small>
                      </div>
                    </div>
                    
                    <div className="modern-list-item">
                      <div className="d-flex align-items-center mb-2">
                        <span className="badge bg-light text-dark me-2">{t('studentDashboard.guidelines.attendanceTypeLateLeave.label')}</span>
                        <small className="text-muted">{t('studentDashboard.guidelines.attendanceTypeLateLeave.desc')}</small>
                      </div>
                    </div>
                  </div>
                </Col>
              </Row>
              
              {/* Định nghĩa vi phạm */}
              <div className="mt-4">
                <h6 className="fw-bold mb-3">
                  <i className="fas fa-exclamation-triangle me-2"></i>
                  {t('studentDashboard.guidelines.violationDefinitions')}
                </h6>
                <div className="alert alert-warning mb-3">
                  <div className="d-flex align-items-start">
                    <i className="fas fa-exclamation-triangle me-2 mt-1"></i>
                    <div>
                      <strong>{t('studentDashboard.guidelines.importantNote')}:</strong> {t('studentDashboard.guidelines.importantNoteDesc')}
                    </div>
                  </div>
                </div>
                
                <Row>
                  <Col md={6}>
                    <div className="modern-list-group">
                      <div className="modern-list-item border-start border-dark border-3 ps-3">
                        <h6 className="fw-bold mb-2">
                          <i className="fas fa-times-circle me-2"></i>
                          {t('studentDashboard.guidelines.timeViolations.title')}
                        </h6>
                        <ul className="list-unstyled small mb-0">
                          <li className="mb-1">• <strong>{t('studentDashboard.guidelines.timeViolations.lateOver5Min')}</strong></li>
                          <li className="mb-1">• <strong>{t('studentDashboard.guidelines.timeViolations.earlyLeaveNoReason')}</strong></li>
                          <li className="mb-1">• <strong>{t('studentDashboard.guidelines.timeViolations.noAttendance')}</strong></li>
                          <li className="mb-1">• <strong>{t('studentDashboard.guidelines.timeViolations.fakeAttendance')}</strong></li>
                        </ul>
                      </div>
                      
                      <div className="modern-list-item border-start border-dark border-3 ps-3 mt-3">
                        <h6 className="fw-bold mb-2">
                          <i className="fas fa-map-marker-alt me-2"></i>
                          {t('studentDashboard.guidelines.locationViolations.title')}
                        </h6>
                        <ul className="list-unstyled small mb-0">
                          <li className="mb-1">• <strong>{t('studentDashboard.guidelines.locationViolations.wrongLocation')}</strong></li>
                          <li className="mb-1">• <strong>{t('studentDashboard.guidelines.locationViolations.leaveArea')}</strong></li>
                          <li className="mb-1">• <strong>{t('studentDashboard.guidelines.locationViolations.locationFraud')}</strong></li>
                        </ul>
                      </div>
                    </div>
                  </Col>
                  
                  <Col md={6}>
                    <div className="modern-list-group">
                      <div className="modern-list-item border-start border-dark border-3 ps-3">
                        <h6 className="fw-bold mb-2">
                          <i className="fas fa-video me-2"></i>
                          {t('studentDashboard.guidelines.monitoringViolations.title')}
                        </h6>
                        <ul className="list-unstyled small mb-0">
                          <li className="mb-1">• <strong>{t('studentDashboard.guidelines.monitoringViolations.turnOffWebcam')}</strong></li>
                          <li className="mb-1">• <strong>{t('studentDashboard.guidelines.monitoringViolations.coverCamera')}</strong></li>
                          <li className="mb-1">• <strong>{t('studentDashboard.guidelines.monitoringViolations.notInFrame')}</strong></li>
                          <li className="mb-1">• <strong>{t('studentDashboard.guidelines.monitoringViolations.interruptMonitoring')}</strong></li>
                        </ul>
                      </div>
                      
                      <div className="modern-list-item border-start border-dark border-3 ps-3 mt-3">
                        <h6 className="fw-bold mb-2">
                          <i className="fas fa-user-times me-2"></i>
                          {t('studentDashboard.guidelines.participationViolations.title')}
                        </h6>
                        <ul className="list-unstyled small mb-0">
                          <li className="mb-1">• <strong>{t('studentDashboard.guidelines.participationViolations.absentNoPermit')}</strong></li>
                          <li className="mb-1">• <strong>{t('studentDashboard.guidelines.participationViolations.fakeParticipation')}</strong></li>
                          <li className="mb-1">• <strong>{t('studentDashboard.guidelines.participationViolations.identityFraud')}</strong></li>
                        </ul>
                      </div>
                    </div>
                  </Col>
                </Row>
                
                {/* Hậu quả của vi phạm */}
                <div className="mt-4">
                  <div className="alert alert-danger">
                    <div className="d-flex align-items-start">
                      <i className="fas fa-gavel me-2 mt-1"></i>
                      <div>
                        <h6 className="fw-bold mb-2">{t('studentDashboard.guidelines.violationConsequences.title')}</h6>
                        <ul className="list-unstyled small mb-0">
                          <li className="mb-1">• <strong>{t('studentDashboard.guidelines.violationConsequences.minor')}</strong></li>
                          <li className="mb-1">• <strong>{t('studentDashboard.guidelines.violationConsequences.moderate')}</strong></li>
                          <li className="mb-1">• <strong>{t('studentDashboard.guidelines.violationConsequences.severe')}</strong></li>
                          <li className="mb-1">• <strong>{t('studentDashboard.guidelines.violationConsequences.fraud')}</strong></li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Chính sách thiết bị */}
                <div className="mt-4">
                  <h6 className="fw-bold mb-3">
                    <i className="fas fa-shield-alt me-2"></i>
                    {t('studentDashboard.guidelines.devicePolicy')}
                  </h6>
                  <div className="alert alert-warning mb-3">
                    <div className="d-flex align-items-start">
                      <i className="fas fa-shield-alt me-2 mt-1"></i>
                      <div>
                        <strong>{t('studentDashboard.guidelines.devicePolicyTitle')}:</strong>
                        <ul className="list-unstyled small mb-0 mt-2">
                          <li className="mb-1">• <strong>{t('studentDashboard.guidelines.devicePolicyRule1')}</strong></li>
                          <li className="mb-1">• <strong>{t('studentDashboard.guidelines.devicePolicyRule2')}</strong></li>
                        </ul>
                        <p className="small mb-0 mt-2">
                          <strong>{t('studentDashboard.guidelines.devicePolicyNote')}:</strong> {t('studentDashboard.guidelines.devicePolicyNoteDesc')}
                        </p>
                        <ul className="list-unstyled small mb-0 mt-1">
                          <li>📞 {t('studentDashboard.guidelines.contactTraining')}</li>
                          <li>📧 {t('studentDashboard.guidelines.contactEmail')}: <a href="mailto:system@pctu.edu.vn" className="text-decoration-none">system@pctu.edu.vn</a></li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Liên hệ hỗ trợ */}
                <div className="mt-4 text-center">
                  <div className="alert alert-info">
                    <div className="d-flex align-items-center justify-content-center">
                      <i className="fas fa-question-circle me-2"></i>
                      <div>
                        <strong>{t('studentDashboard.guidelines.support')}</strong> {t('studentDashboard.guidelines.supportDesc')}: 
                        <a href="mailto:system@pctu.edu.vn" className="text-decoration-none ms-1">system@pctu.edu.vn</a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default StudentDashboard;
 