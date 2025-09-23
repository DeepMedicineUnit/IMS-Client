import React, { useState, useEffect, useRef } from 'react';
import { Card, Row, Col, Button, Alert, Table, Modal, Spinner } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import { Calendar, Clock, MapPin, RefreshCcw, ArrowRight, CheckCircle, AlertTriangle, Info, User, List, Eye } from 'lucide-react';
import '../../styles/modern-ui.css';

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
      
      // Get active sessions the student is part of (through groups)
      const sessionsResponse = await api.get('/sessions/student/dashboard?status=active');
      if (sessionsResponse.data.success) {
        console.log('Active sessions:', sessionsResponse.data.data);
        setUpcomingSessions(sessionsResponse.data.data);
      }
      
      // Get attendance history
      const attendanceResponse = await api.get('/sessions/student/dashboard?attended=true');
      if (attendanceResponse.data.success) {
        setAttendedSessions(attendanceResponse.data.data);
      }
      
      // Get all sessions for the list tab
      const allSessionsResponse = await api.get('/sessions/student/dashboard?all=true');
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
      setError('Không thể tải dữ liệu. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  // Initial data fetch
  useEffect(() => {
    fetchDashboardData();
  }, [api]); // eslint-disable-line react-hooks/exhaustive-deps
  
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

    // Check if current time is within session time
    return now >= sessionStartTime && now <= sessionEndTime;
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
          toast.error('Vui lòng cấp quyền truy cập vị trí để tham gia buổi học.');
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
          toast.error('Không thể tạo token điểm danh. Vui lòng liên hệ quản trị viên.');
        }
      }
    } catch (error) {
      console.error('Error joining session:', error);
      toast.error('Không thể tham gia buổi học. Vui lòng thử lại sau.');
    } finally {
      setCheckingGeofence(false);
      setSelectedSession(null);
    }
  };

  // Function to handle accessing monitoring page
  const handleAccessMonitoring = (session) => {
    navigate(`/session/${session.id}/monitor`);
  };

  // Function to get session status
  const getSessionStatus = (session) => {
    if (isSessionActive(session)) {
      return { status: 'active', text: 'Đang diễn ra', color: 'success' };
    } else if (isSessionEnded(session)) {
      return { status: 'ended', text: 'Đã kết thúc', color: 'secondary' };
    } else {
      return { status: 'upcoming', text: 'Sắp diễn ra', color: 'info' };
    }
  };

  // Function to render session card
  const renderSessionCard = (session, showActions = true) => {
    const sessionStatus = getSessionStatus(session);
    
    return (
      <div key={session.id} className="bg-white rounded-lg p-4 mb-3 shadow-sm border">
        <div className="d-flex justify-content-between align-items-start mb-3">
          <h6 className="fw-bold mb-0">{session.title}</h6>
          <span className={`badge bg-${sessionStatus.color}`}>
            {sessionStatus.text}
          </span>
        </div>
        
        <div className="d-flex flex-wrap gap-3 mb-3 text-muted small">
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
        
         {showActions && (
           <div className="d-flex gap-2">
             {(sessionStatus.status === 'active' || sessionStatus.status === 'ended') && (
               <button
                 className="btn-modern btn-modern-outline"
                 onClick={() => handleAccessMonitoring(session)}
                 style={{ 
                   padding: '0.5rem 1rem',
                   fontSize: '0.875rem',
                   minWidth: '120px'
                 }}
               >
                 <Eye size={14} className="me-1" />
                 Xem chi tiết
               </button>
             )}
             


             {sessionStatus.status === 'active' && (
               <button
                 className="btn-modern"
                 onClick={() => handleJoinSession(session)}
                 disabled={checkingGeofence && selectedSession?.id === session.id}
                 style={{ 
                   padding: '0.5rem 1rem',
                   fontSize: '0.875rem',
                   minWidth: '120px',
                   backgroundColor: '#256176'
                 }}
               >
                 {checkingGeofence && selectedSession?.id === session.id ? (
                   <>
                     <div className="spinner-border spinner-border-sm me-1" role="status">
                       <span className="visually-hidden">Loading...</span>
                     </div>
                     <span>Đang kiểm tra...</span>
                   </>
                 ) : (
                   <>
                     <ArrowRight size={14} className="me-1" />
                     <span>Tham gia điểm danh</span>
                   </>
                 )}
               </button>




             )}
           </div>
         )}
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
            <p className="mb-0">Đang tải thông tin buổi học...</p>
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
            <h5 className="mb-0 fw-bold">Không thể tải thông tin</h5>
          </div>
        </div>
        <div className="card-body">
          <p className="mb-3">{error || 'Có lỗi xảy ra. Vui lòng thử lại sau.'}</p>
          <div className="d-flex justify-content-end">
            <button 
              className="btn-modern" 
              style={{ backgroundColor: '#dc3545' }}
              onClick={() => window.location.reload()}
            >
              <i className="fas fa-refresh me-2"></i>
              Tải lại trang
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
              <div className="rounded-circle bg-primary bg-opacity-10 p-3 me-3">
                <User size={28} className="text-primary" />
              </div>
              <div>
                <h2 className="mb-1 fw-bold">Xin chào, {currentUser?.full_name || currentUser?.username}</h2>
                <div className="d-flex align-items-center">
                  <span className="badge modern-badge-primary me-2">Sinh viên</span>
                  <span className="text-muted small">
                    Cập nhật lần cuối: {format(lastRefreshTime, 'HH:mm:ss')}
                  </span>
                </div>
              </div>
            </div>
          </Col>
          <Col md={5}>
            <div className="d-flex justify-content-end align-items-center h-100 gap-2">
              <button 
                className="btn-modern"
                onClick={() => navigate('/student/absence-requests')}
                style={{ backgroundColor: '#f59e0b' }}
              >
                <i className="fas fa-calendar-times"></i>
                <span>Xin phép vắng học</span>
              </button>
              
              <button 
                className="btn-modern"
                onClick={() => fetchDashboardData(true)}
                disabled={refreshing}
              >
                {refreshing ? (
                  <div className="spinner-border spinner-border-sm" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                ) : (
                  <RefreshCcw size={16} />
                )}
                <span>{refreshing ? 'Đang cập nhật...' : 'Cập nhật'}</span>
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
            <Modal.Title className="fw-bold">Không thể tham gia buổi học</Modal.Title>
          </div>
        </Modal.Header>
        <Modal.Body className="pt-0">
          <div className="text-center mb-4">
            <div className="rounded-circle bg-danger bg-opacity-10 d-inline-flex align-items-center justify-content-center mb-3" style={{width: '80px', height: '80px'}}>
              <MapPin size={32} className="text-danger" />
            </div>
            <h5 className="fw-bold mb-2">Ngoài phạm vi cho phép</h5>
            <p className="text-muted">Bạn đang ở ngoài phạm vi cho phép của buổi học này. Vui lòng di chuyển đến địa điểm buổi học để tham gia.</p>
          </div>
          
          {selectedSession && selectedSession.monitoring_options?.location?.geofence && (
            <div className="modern-alert modern-alert-info mb-4">
              <div className="d-flex align-items-center">
                <Info size={20} className="me-2 text-info" />
                <div>
                  <strong>Bán kính cho phép:</strong> {selectedSession.monitoring_options.location.geofence.radius} mét từ vị trí buổi học.
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
            Đóng
          </button>
          </div>
        </Modal.Body>
      </Modal>
      
      {/* Main Content Layout */}
      <Row className="mb-4">
        {/* Buổi học đang diễn ra */}
        <Col md={6} className="mb-4">
          <div className="modern-card h-100 shadow-sm">
            <div className="card-header bg-white border-0">
              <div className="d-flex align-items-center">
                <div className="rounded-circle bg-primary bg-opacity-10 p-2 me-2">
                  <Calendar size={18} className="text-primary" />
                </div>
                <h5 className="mb-0 fw-bold">Buổi học đang diễn ra</h5>
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
                      <p>Không có buổi học nào đang diễn ra</p>
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
                  <p>Không có buổi học nào đang diễn ra</p>
                </div>
              )}
            </div>
          </div>
        </Col>
        
        {/* Danh sách buổi học */}
        <Col md={6} className="mb-4">
          <div className="modern-card h-100 shadow-sm">
            <div className="card-header bg-white border-0">
              <div className="d-flex align-items-center">
                <div className="rounded-circle bg-info bg-opacity-10 p-2 me-2">
                  <List size={18} className="text-info" />
                </div>
                <h5 className="mb-0 fw-bold">Danh sách buổi học</h5>
                {allSessions.length > 0 && (
                  <span className="badge bg-info ms-2">{allSessions.length}</span>
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
              ) : allSessions.length > 0 ? (
                <div 
                  className="modern-list-group"
                  style={{
                    maxHeight: '400px',
                    overflowY: 'auto',
                    paddingRight: '8px'
                  }}
                >
                  {allSessions.map(session => renderSessionCard(session))}
                    </div>
              ) : (
                <div className="text-center text-muted py-5">
                  <div className="rounded-circle bg-light d-inline-flex align-items-center justify-content-center mb-3" style={{width: '80px', height: '80px'}}>
                    <List size={32} className="text-muted" />
                  </div>
                  <p>Không có buổi học nào</p>
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
                <h5 className="mb-0 fw-bold">Lịch sử buổi học</h5>
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
                <div className="table-responsive">
                  <table className="modern-table modern-table-hover w-100">
                    <thead>
                      <tr>
                        <th>Tên buổi học</th>
                        <th>Ngày</th>
                        <th>Thời gian</th>
                        <th>Điểm danh</th>
                        <th>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendedSessions.map(session => (
                        <tr key={session.id}>
                          <td>
                            <div className="fw-medium">{session.title}</div>
                          </td>
                          <td>
                            <div className="d-flex align-items-center">
                              <Calendar size={14} className="me-1 text-primary" />
                              <span>{format(new Date(session.date), 'dd/MM/yyyy')}</span>
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
                                if (!record.attendance_type) return (
                                  <div className="modern-badge modern-badge-success">
                                    <CheckCircle size={12} className="me-1" />
                                    <span>Đã điểm danh</span>
                                  </div>
                                );
                                
                                switch (record.attendance_type) {
                                  case 'before':
                                    return (
                                      <div className="modern-badge modern-badge-success">
                                        <i className="fas fa-hourglass-start me-1"></i>
                                        <span>Điểm danh trước</span>
                                      </div>
                                    );
                                  case 'during':
                                    return (
                                      <div className="modern-badge modern-badge-success">
                                        <i className="fas fa-clock me-1"></i>
                                        <span>Điểm danh trong</span>
                                      </div>
                                    );
                                  case 'after':
                                    return (
                                      <div className="modern-badge modern-badge-success">
                                        <i className="fas fa-hourglass-end me-1"></i>
                                        <span>Điểm danh sau</span>
                                      </div>
                                    );
                                  case 'early':
                                    return (
                                      <div className="modern-badge modern-badge-info">
                                        <i className="fas fa-running me-1"></i>
                                        <span>Đi trước {record.minutes_early}p</span>
                                      </div>
                                    );
                                  case 'late':
                                    return (
                                      <div className="modern-badge modern-badge-warning">
                                        <i className="fas fa-user-clock me-1"></i>
                                        <span>Đi trễ {record.minutes_late}p</span>
                                      </div>
                                    );
                                  case 'late_leave':
                                    return (
                                      <div className="modern-badge modern-badge-warning">
                                        <i className="fas fa-sign-out-alt me-1"></i>
                                        <span>Về trễ {record.minutes_late}p</span>
                                      </div>
                                    );
                                  case 'absent_perm':
                                    return (
                                      <div className="modern-badge modern-badge-danger">
                                        <i className="fas fa-user-times me-1"></i>
                                        <span>Phép cả buổi</span>
                                      </div>
                                    );
                                  case 'absent_before_perm':
                                    return (
                                      <div className="modern-badge modern-badge-info">
                                        <i className="fas fa-user-times me-1"></i>
                                        <span>Phép trước buổi</span>
                                      </div>
                                    );
                                  case 'absent_during_perm':
                                    return (
                                      <div className="modern-badge modern-badge-warning">
                                        <i className="fas fa-user-times me-1"></i>
                                        <span>Phép trong buổi</span>
                                      </div>
                                    );
                                  case 'absent_after_perm':
                                    return (
                                      <div className="modern-badge modern-badge-secondary">
                                        <i className="fas fa-user-times me-1"></i>
                                        <span>Phép sau buổi</span>
                                      </div>
                                    );
                                  default:
                                    return (
                                      <div className="modern-badge modern-badge-success">
                                        <CheckCircle size={12} className="me-1" />
                                        <span>Đã điểm danh</span>
                                      </div>
                                    );
                                }
                              };
                              
                              // Nếu không có bản ghi nào
                              if (allAttendanceRecords.length === 0) {
                                return (
                                  <div className="modern-badge modern-badge-success">
                                    <CheckCircle size={12} className="me-1" />
                                    <span>Đã điểm danh</span>
                                  </div>
                                );
                              }
                              
                              // Hiển thị bản ghi mới nhất
                              const latestRecord = allAttendanceRecords[0];
                              return (
                                <div className="d-flex align-items-center gap-2">
                                  {getAttendanceBadge(latestRecord)}
                                  {latestRecord.isCurrent && (
                                    <div className="modern-badge modern-badge-primary">Hiện tại</div>
                                  )}
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
                                   Xem chi tiết điểm danh
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
                  <p>Chưa có lịch sử buổi học</p>
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
                <h5 className="mb-0 fw-bold">Hướng dẫn sử dụng và Quy định</h5>
              </div>
            </div>
            <div className="card-body">
              <Row>
                {/* Hướng dẫn sử dụng */}
                <Col md={6} className="mb-4">
                  <h6 className="fw-bold mb-3">
                    <i className="fas fa-book me-2"></i>
                    Hướng dẫn sử dụng
                  </h6>
                  <div className="modern-list-group">
                    <div className="modern-list-item">
                      <div className="d-flex align-items-start">
                        <div className="rounded-circle bg-light p-1 me-3 mt-1">
                          <i className="fas fa-qrcode text-muted" style={{fontSize: '12px'}}></i>
                        </div>
                        <div>
                          <strong>Điểm danh bằng QR Code:</strong>
                          <p className="mb-1 small text-muted">Quét mã QR được cung cấp bởi giảng viên để điểm danh tham gia buổi học. (nếu có)</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="modern-list-item">
                      <div className="d-flex align-items-start">
                        <div className="rounded-circle bg-light p-1 me-3 mt-1">
                          <i className="fas fa-map-marker-alt text-muted" style={{fontSize: '12px'}}></i>
                        </div>
                        <div>
                          <strong>Xác nhận vị trí:</strong>
                          <p className="mb-1 small text-muted">Cấp quyền truy cập vị trí để hệ thống xác nhận bạn đang ở đúng địa điểm buổi học.</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="modern-list-item">
                      <div className="d-flex align-items-start">
                        <div className="rounded-circle bg-light p-1 me-3 mt-1">
                          <i className="fas fa-video text-muted" style={{fontSize: '12px'}}></i>
                        </div>
                        <div>
                          <strong>Giám sát webcam:</strong>
                          <p className="mb-1 small text-muted">Cho phép webcam để giảng viên có thể giám sát quá trình học tập (nếu được yêu cầu).</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="modern-list-item">
                      <div className="d-flex align-items-start">
                        <div className="rounded-circle bg-light p-1 me-3 mt-1">
                          <i className="fas fa-clock text-muted" style={{fontSize: '12px'}}></i>
                        </div>
                        <div>
                          <strong>Thời gian điểm danh:</strong>
                          <p className="mb-1 small text-muted">Điểm danh đúng giờ theo khung thời gian được quy định cho từng buổi học.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Col>
                
                {/* Các loại điểm danh */}
                <Col md={6} className="mb-4">
                  <h6 className="fw-bold mb-3">
                    <i className="fas fa-check-circle me-2"></i>
                    Các loại điểm danh
                  </h6>
                  <div className="modern-list-group">
                    <div className="modern-list-item">
                      <div className="d-flex align-items-center mb-2">
                        <span className="badge bg-light text-dark me-2">Điểm danh trước</span>
                        <small className="text-muted">Trước khi buổi học bắt đầu</small>
                      </div>
                    </div>
                    
                    <div className="modern-list-item">
                      <div className="d-flex align-items-center mb-2">
                        <span className="badge bg-light text-dark me-2">Điểm danh trong</span>
                        <small className="text-muted">Trong thời gian buổi học diễn ra</small>
                      </div>
                    </div>
                    
                    <div className="modern-list-item">
                      <div className="d-flex align-items-center mb-2">
                        <span className="badge bg-light text-dark me-2">Điểm danh sau</span>
                        <small className="text-muted">Sau khi buổi học kết thúc</small>
                      </div>
                    </div>
                    
                    <div className="modern-list-item">
                      <div className="d-flex align-items-center mb-2">
                        <span className="badge bg-light text-dark me-2">Đi trễ</span>
                        <small className="text-muted">Đến muộn so với giờ bắt đầu</small>
                      </div>
                    </div>
                    
                    <div className="modern-list-item">
                      <div className="d-flex align-items-center mb-2">
                        <span className="badge bg-light text-dark me-2">Về trễ</span>
                        <small className="text-muted">Rời khỏi buổi học trễ sau giờ kết thúc</small>
                      </div>
                    </div>
                  </div>
                </Col>
              </Row>
              
              {/* Định nghĩa vi phạm */}
              <div className="mt-4">
                <h6 className="fw-bold mb-3">
                  <i className="fas fa-exclamation-triangle me-2"></i>
                  Định nghĩa các hành vi vi phạm
                </h6>
                <div className="alert alert-warning mb-3">
                  <div className="d-flex align-items-start">
                    <i className="fas fa-exclamation-triangle me-2 mt-1"></i>
                    <div>
                      <strong>Lưu ý quan trọng:</strong> Các hành vi dưới đây được coi là vi phạm và có thể dẫn đến việc bị đánh dấu vắng học hoặc học lại.
                    </div>
                  </div>
                </div>
                
                <Row>
                  <Col md={6}>
                    <div className="modern-list-group">
                      <div className="modern-list-item border-start border-dark border-3 ps-3">
                        <h6 className="fw-bold mb-2">
                          <i className="fas fa-times-circle me-2"></i>
                          Vi phạm về thời gian
                        </h6>
                        <ul className="list-unstyled small mb-0">
                          <li className="mb-1">• <strong>Đi trễ quá 5 phút:</strong> Đến muộn hơn 5 phút so với giờ bắt đầu buổi học</li>
                          <li className="mb-1">• <strong>Về sớm không có lý do:</strong> Rời khỏi buổi học trước giờ kết thúc mà không có phép</li>
                          <li className="mb-1">• <strong>Không điểm danh:</strong> Hoàn toàn không thực hiện điểm danh trong suốt buổi học</li>
                          <li className="mb-1">• <strong>Điểm danh giả:</strong> Sử dụng mã QR hoặc thông tin của người khác để điểm danh</li>
                        </ul>
                      </div>
                      
                      <div className="modern-list-item border-start border-dark border-3 ps-3 mt-3">
                        <h6 className="fw-bold mb-2">
                          <i className="fas fa-map-marker-alt me-2"></i>
                          Vi phạm về vị trí
                        </h6>
                        <ul className="list-unstyled small mb-0">
                          <li className="mb-1">• <strong>Không ở đúng địa điểm:</strong> Điểm danh khi không có mặt tại địa điểm buổi học</li>
                          <li className="mb-1">• <strong>Rời khỏi khu vực:</strong> Rời khỏi phạm vi khi đã điểm danh xong</li>
                          <li className="mb-1">• <strong>Gian lận vị trí:</strong> Sử dụng công nghệ để giả mạo vị trí GPS</li>
                        </ul>
                      </div>
                    </div>
                  </Col>
                  
                  <Col md={6}>
                    <div className="modern-list-group">
                      <div className="modern-list-item border-start border-dark border-3 ps-3">
                        <h6 className="fw-bold mb-2">
                          <i className="fas fa-video me-2"></i>
                          Vi phạm về giám sát
                        </h6>
                        <ul className="list-unstyled small mb-0">
                          <li className="mb-1">• <strong>Tắt webcam:</strong> Tắt camera khi được yêu cầu giám sát</li>
                          <li className="mb-1">• <strong>Che camera:</strong> Che hoặc chặn tầm nhìn của camera</li>
                          <li className="mb-1">• <strong>Không có mặt trước camera:</strong> Để người khác thay thế trong khung hình</li>
                          <li className="mb-1">• <strong>Làm gián đoạn giám sát:</strong> Cố tình làm gián đoạn quá trình giám sát</li>
                        </ul>
                      </div>
                      
                      <div className="modern-list-item border-start border-dark border-3 ps-3 mt-3">
                        <h6 className="fw-bold mb-2">
                          <i className="fas fa-user-times me-2"></i>
                          Vi phạm về tham gia
                        </h6>
                        <ul className="list-unstyled small mb-0">
                          <li className="mb-1">• <strong>Vắng không phép:</strong> Không tham gia buổi học mà không có đơn xin phép vắng</li>
                          <li className="mb-1">• <strong>Tham gia giả:</strong> Chỉ điểm danh mà không thực sự tham gia học tập</li>
                          <li className="mb-1">• <strong>Gian lận danh tính:</strong> Để người khác tham gia thay thế</li>
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
                        <h6 className="fw-bold mb-2">Hậu quả của vi phạm:</h6>
                        <ul className="list-unstyled small mb-0">
                          <li className="mb-1">• <strong>Vi phạm nhẹ:</strong> Cảnh báo và ghi nhận vào hồ sơ</li>
                          <li className="mb-1">• <strong>Vi phạm trung bình:</strong> Đánh dấu vắng học, ảnh hưởng đến điểm số và có thể học lại</li>
                          <li className="mb-1">• <strong>Vi phạm nghiêm trọng:</strong> Xử lý kỷ luật theo quy định của trường</li>
                          <li className="mb-1">• <strong>Gian lận:</strong> Có thể bị đình chỉ học tập hoặc hủy kết quả buổi học</li>
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
                        <strong>Cần hỗ trợ?</strong> Liên hệ với giảng viên phụ trách hoặc quản trị viên hệ thống qua email: 
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
 