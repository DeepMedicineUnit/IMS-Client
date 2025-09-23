import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Card, Row, Col, Button, Table, Badge, Tab, Tabs, Alert, Spinner } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import Loader from '../../components/Loader';
import { format, parseISO, isAfter, isBefore, isEqual } from 'date-fns';
import { toast } from 'react-toastify';
import io from 'socket.io-client';
import { Calendar, Clock, MapPin, Users, FileText, QrCode, ArrowLeft, RefreshCw, Info, CheckCircle, AlertTriangle, XCircle, UserCheck, UserX, Hospital, ExternalLink, Map, Upload, Clock as ClockIcon, Timer, TimerOff } from 'lucide-react';

const SessionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { api } = useAuth();
  const [session, setSession] = useState(null);
  const [attendanceStats, setAttendanceStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef(null);
  
  // Predefined hospital locations
  const predefinedLocations = [
    { name: "Bệnh viện Tâm Trí Đà Nẵng", latitude: 16.022910377179983, longitude: 108.21418877313431 },
    { name: "Bệnh viện Tâm Trí Quảng Nam", latitude: 15.83878188925367, longitude: 108.28529005010874 },
    { name: "Bệnh viện Tâm Trí Sài Gòn", latitude: 10.831702813877188, longitude: 106.62179071788216 },
    { name: "Bệnh viện Tâm Trí Nha Trang", latitude: 12.212506709091144, longitude: 109.19488283420932 },
    { name: "Bệnh viện Tâm Trí Đồng Tháp", latitude: 10.476168701979864, longitude: 105.61251450982436 },
    { name: "Bệnh viện Tâm Trí Hồng Ngự", latitude: 10.808029003252175, longitude: 105.34998297903213 },
    { name: "Bệnh viện Tâm Trí Cao Lãnh", latitude: 10.465413477175426, longitude: 105.62900633746764 },
    { name: "Bệnh viện ĐH Y Khoa Phan Châu Trinh", latitude: 15.96252601077044, longitude: 108.25985382432913 },
    { name: "Bệnh viện TEST", latitude: 15.962683045139078, longitude: 108.25037464216163 }
  ];
  
  // Lấy thời gian hiện tại thực
  const getMockCurrentDate = () => {
    return new Date();
  };
  
  // Find hospital name by coordinates
  const findHospitalByCoordinates = (latitude, longitude) => {
    if (!latitude || !longitude) return null;
    
    // Use a small epsilon for floating point comparison
    const epsilon = 0.0001;
    
    return predefinedLocations.find(location => 
      Math.abs(location.latitude - latitude) < epsilon && 
      Math.abs(location.longitude - longitude) < epsilon
    );
  };
  
  // Tính toán trạng thái dựa trên ngày và thời gian
  const calculateSessionStatus = (session) => {
    try {
      // Sử dụng thời gian hiện tại thực
      const currentDate = getMockCurrentDate();
      const sessionDate = parseISO(session.date);
      
      // Chuẩn hóa ngày hiện tại để so sánh chỉ ngày
      const currentDateOnly = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
      const sessionDateOnly = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate());
      
      // Kiểm tra nếu buổi học bị hủy
      if (session.status === 'cancelled') {
        return 'cancelled';
      }
      
      // Buổi học trong tương lai
      if (isAfter(sessionDateOnly, currentDateOnly)) {
        return 'scheduled';
      }
      
      // Buổi học trong quá khứ
      if (isBefore(sessionDateOnly, currentDateOnly)) {
        return 'ended';
      }
      
      // Buổi học ngày hôm nay - cần kiểm tra thời gian
      if (isEqual(sessionDateOnly, currentDateOnly)) {
        // Chuyển đổi thời gian thành đối tượng Date để so sánh
        const startTimeParts = session.start_time.split(':');
        const endTimeParts = session.end_time.split(':');
        
        // Tạo đối tượng Date cho thời gian bắt đầu và kết thúc
        const startTime = new Date(currentDate);
        startTime.setHours(parseInt(startTimeParts[0]), parseInt(startTimeParts[1]), 0);
        
        const endTime = new Date(currentDate);
        endTime.setHours(parseInt(endTimeParts[0]), parseInt(endTimeParts[1]), 0);
        
        // Xử lý trường hợp thời gian kết thúc nhỏ hơn thời gian bắt đầu (qua ngày)
        if (parseInt(endTimeParts[0]) < parseInt(startTimeParts[0]) || 
            (parseInt(endTimeParts[0]) === parseInt(startTimeParts[0]) && 
             parseInt(endTimeParts[1]) < parseInt(startTimeParts[1]))) {
          endTime.setDate(endTime.getDate() + 1); // Tăng thêm 1 ngày cho thời gian kết thúc
        }
        
        // Đang diễn ra
        if (currentDate >= startTime && currentDate <= endTime) {
          return 'active';
        }
        
        // Đã kết thúc
        if (currentDate > endTime) {
          return 'ended';
        }
        
        // Sắp diễn ra
        if (currentDate < startTime) {
          return 'scheduled';
        }
      }
      
      // Mặc định giữ nguyên trạng thái
      return session.status;
    } catch (error) {
      console.error('Error calculating session status:', error);
      return session.status;
    }
  };

  // Function to fetch session data
  const fetchSessionData = async () => {
    try {
      setError('');
      
      // Fetch session details
      const sessionResponse = await api.get(`/sessions/${id}`);
      
      if (sessionResponse.data.success) {
        const sessionData = sessionResponse.data.data;
        // Calculate the session status
        const calculatedStatus = calculateSessionStatus(sessionData);
        setSession({
          ...sessionData,
          calculatedStatus: calculatedStatus
        });
        
        // Fetch attendance stats
        try {
          const statsResponse = await api.get(`/sessions/${id}/attendance/stats`);
          if (statsResponse.data.success) {
            setAttendanceStats(statsResponse.data.data);
          }
        } catch (statsError) {
          console.error('Error fetching attendance stats:', statsError);
          // Don't set error for stats, as the session data is still valid
        }
      } else {
        setError('Không thể tải thông tin buổi học');
      }
    } catch (err) {
      console.error('Error fetching session details:', err);
      setError('Đã xảy ra lỗi khi tải thông tin buổi học');
    } finally {
      setLoading(false);
    }
  };
  
  // Initial data fetch
  useEffect(() => {
    setLoading(true);
    fetchSessionData();
  }, [id]);
  
  // Set up socket connection
  useEffect(() => {
    // Create socket connection
    const socket = io(process.env.NODE_ENV === 'production' 
      ? window.location.origin 
      : 'http://localhost:5000');
    
    socketRef.current = socket;
    
    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      setSocketConnected(true);
      
      // Join session room
      socket.emit('join_session', id);
    });
    
    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setSocketConnected(false);
    });
    
    socket.on('monitoring_update', (data) => {
      console.log('Received monitoring update:', data);
      // Refresh data when attendance is marked
      if (data.type === 'attendance' || data.dataType === 'attendance') {
        console.log('Attendance update detected, refreshing data');
        fetchSessionData();
      }
    });
    
    socket.on('session_update', (data) => {
      console.log('Received session update:', data);
      // Refresh data when session is updated
      fetchSessionData();
    });
    
    // Clean up on unmount
    return () => {
      if (socket) {
        socket.emit('leave_session', id);
        socket.disconnect();
      }
    };
  }, [id]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <Badge bg="success">Đang diễn ra</Badge>;
      case 'scheduled':
        return <Badge bg="primary">Sắp diễn ra</Badge>;
      case 'ended':
        return <Badge bg="secondary">Đã kết thúc</Badge>;
      case 'cancelled':
        return <Badge bg="danger">Đã hủy</Badge>;
      default:
        return <Badge bg="info">{status}</Badge>;
    }
  };

  const formatDate = (dateString) => {
    try {
      if (!dateString) return '';
      
      // The date is in YYYY-MM-DD format from the server
      // Parse it and convert to DD/MM/YYYY format
      const parts = dateString.split('-');
      if (parts.length !== 3) {
        console.error('Invalid date format:', dateString);
        return dateString;
      }
      
      const year = parts[0];
      const month = parts[1];
      const day = parts[2];
      
      return `${day}/${month}/${year}`;
    } catch (error) {
      console.error('Error formatting date:', error);
      return dateString;
    }
  };

  if (loading) {
    return <Loader text="Đang tải thông tin buổi học..." />;
  }

  if (error) {
    return (
      <div className="modern-card">
        <div className="card-header">
          <div className="d-flex align-items-center">
            <XCircle className="me-2 text-danger" size={24} />
            <h5 className="mb-0 fw-bold">Lỗi</h5>
          </div>
        </div>
        <div className="card-body">
          <p className="mb-3">{error}</p>
          <button 
            className="btn-modern" 
            onClick={() => navigate('/admin/sessions')}
            style={{ backgroundColor: '#dc3545' }}
          >
            <ArrowLeft size={16} className="me-2" />
            Quay lại danh sách buổi học
          </button>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="modern-card">
        <div className="card-header">
          <div className="d-flex align-items-center">
            <AlertTriangle className="me-2 text-warning" size={24} />
            <h5 className="mb-0 fw-bold">Không tìm thấy buổi học</h5>
          </div>
        </div>
        <div className="card-body">
          <p className="mb-3">Không thể tìm thấy thông tin buổi học với ID: {id}</p>
          <button 
            className="btn-modern" 
            onClick={() => navigate('/admin/sessions')}
          >
            <ArrowLeft size={16} className="me-2" />
            Quay lại danh sách buổi học
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div className="d-flex align-items-center">
          <h2 className="mb-0 fw-bold">Chi tiết buổi học</h2>
          <div className="ms-3 d-flex align-items-center">
            {!socketConnected && (
              <button 
                className="btn-modern" 
                style={{ backgroundColor: '#6c757d', padding: '8px 16px' }}
                onClick={() => {
                  if (socketRef.current) {
                    socketRef.current.connect();
                  }
                  toast.info('Đang kết nối lại...');
                }}
              >
                <RefreshCw size={16} className="me-2" />
                Kết nối lại
              </button>
            )}
          </div>
        </div>
        <div className="d-flex gap-2">
          {(session.status === 'active' || session.status === 'scheduled') && (
            <>
              <button 
                className="btn-modern" 
                style={{ backgroundColor: '#198754' }}
                onClick={() => navigate(`/admin/sessions/${id}/qr-code`)}
              >
                <QrCode size={16} className="me-2" />
                Mã QR
              </button>
            </>
          )}
          
          <button 
            className="btn-modern" 
            onClick={() => navigate('/admin/sessions')}
          >
            <ArrowLeft size={16} className="me-2" />
            Quay lại
          </button>
        </div>
      </div>
      
      <Tabs defaultActiveKey="info" className="mb-4 custom-tabs">
        <Tab eventKey="info" title={
          <span className="tab-title">
            <Info size={16} />
            <span>Thông tin buổi học</span>
          </span>
        }>
          <div className="modern-card">
            <div className="card-body">
              <Row>
                <Col md={6}>
                  <div className="space-y-3">
                    <div className="d-flex align-items-center">
                      <FileText className="me-2 text-primary" size={18} />
                      <span className="fw-medium">Tên buổi học:</span>
                      <span className="ms-2">{session.title}</span>
                    </div>
                    <div className="d-flex align-items-center">
                      <Calendar className="me-2 text-primary" size={18} />
                      <span className="fw-medium">Ngày:</span>
                      <span className="ms-2">{formatDate(session.date)}</span>
                    </div>
                    <div className="d-flex align-items-center">
                      <Clock className="me-2 text-primary" size={18} />
                      <span className="fw-medium">Thời gian:</span>
                      <span className="ms-2">{session.start_time} - {session.end_time}</span>
                    </div>
                    <div className="d-flex align-items-center">
                      <MapPin className="me-2 text-primary" size={18} />
                      <span className="fw-medium">Địa điểm:</span>
                      <span className="ms-2">{session.location}</span>
                    </div>
                  </div>
                </Col>
                <Col md={6}>
                  <div className="space-y-3">
                    <div className="d-flex align-items-center">
                      <Users className="me-2 text-primary" size={18} />
                      <span className="fw-medium">Nhóm sinh viên:</span>
                      <span className="ms-2">{session.group_name || 'Không có thông tin'}</span>
                    </div>
                    <div className="d-flex align-items-center">
                      <Users className="me-2 text-primary" size={18} />
                      <span className="fw-medium">Số lượng sinh viên:</span>
                      <span className="ms-2">{attendanceStats?.stats?.totalStudents || 'Không có thông tin'}</span>
                    </div>
                    <div className="d-flex align-items-center">
                      <span className="fw-medium">Trạng thái:</span>
                      <span className="ms-2">{getStatusBadge(session.calculatedStatus || session.status)}</span>
                    </div>
                    {attendanceStats && (
                      <div className="d-flex align-items-center">
                        <UserCheck className="me-2 text-primary" size={18} />
                        <span className="fw-medium">Điểm danh:</span>
                        <span className="ms-2">{attendanceStats.stats.presentStudents}/{attendanceStats.stats.totalStudents} sinh viên
                        {' '}({attendanceStats.stats.attendanceRate}%)</span>
                      </div>
                    )}
                  </div>
                </Col>
              </Row>
              
              <div className="mt-4">
                <h5 className="fw-bold text-primary">
                  <FileText className="me-2" size={20} />
                  Mô tả
                </h5>
                <div className="modern-card">
                  <div className="card-body">
                    <p className="mb-0">{session.description || 'Không có mô tả.'}</p>
                  </div>
                </div>
              </div>
              
              {/* Monitoring Options Section */}
              {/* Attendance Windows Information */}
              {session.monitoring_options?.attendance && (
                <div className="mt-4">
                  <h5 className="fw-bold text-primary">
                    <ClockIcon className="me-2" size={20} />
                    Thông tin điểm danh
                  </h5>
                  <div className="ms-3 mt-2">
                    <Row>
                      {session.monitoring_options.attendance.before_session?.enabled && (
                        <Col md={4} className="mb-3">
                          <div className="modern-card border-info h-100">
                            <div className="card-header bg-info text-white">
                              <Timer className="me-2" size={18} />
                              Điểm danh trước buổi học
                            </div>
                            <div className="card-body">
                              {(() => {
                                // Calculate actual time window for before session attendance
                                const sessionDate = new Date(session.date);
                                const [startHours, startMinutes] = session.start_time.split(':').map(Number);
                                
                                // Set session start time
                                const sessionStartTime = new Date(sessionDate);
                                sessionStartTime.setHours(startHours, startMinutes, 0, 0);
                                
                                // Calculate before session start time
                                const beforeStart = new Date(sessionStartTime);
                                beforeStart.setMinutes(beforeStart.getMinutes() - session.monitoring_options.attendance.before_session.minutes_before);
                                
                                // Format times
                                const beforeStartFormatted = `${beforeStart.getHours().toString().padStart(2, '0')}:${beforeStart.getMinutes().toString().padStart(2, '0')}`;
                                const sessionStartFormatted = `${sessionStartTime.getHours().toString().padStart(2, '0')}:${sessionStartTime.getMinutes().toString().padStart(2, '0')}`;
                                
                                return (
                                  <>
                                    <p className="mb-1"><strong>Thời gian:</strong> {beforeStartFormatted} - {sessionStartFormatted}</p>
                                    <p className="mb-1"><strong>Trước giờ bắt đầu:</strong> {session.monitoring_options.attendance.before_session.minutes_before} phút</p>
                                    <p className="mb-0"><strong>Thời lượng:</strong> {session.monitoring_options.attendance.before_session.duration} phút</p>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        </Col>
                      )}
                      
                      {session.monitoring_options.attendance.during_session?.enabled && (
                        <Col md={4} className="mb-3">
                          <div className="modern-card border-success h-100">
                            <div className="card-header bg-success text-white">
                              <Clock className="me-2" size={18} />
                              Điểm danh trong buổi học
                            </div>
                            <div className="card-body">
                              {(() => {
                                // Calculate actual time window for during session attendance
                                const sessionDate = new Date(session.date);
                                const [startHours, startMinutes] = session.start_time.split(':').map(Number);
                                const [endHours, endMinutes] = session.end_time.split(':').map(Number);
                                
                                // Set session start and end times
                                const sessionStartTime = new Date(sessionDate);
                                sessionStartTime.setHours(startHours, startMinutes, 0, 0);
                                
                                const sessionEndTime = new Date(sessionDate);
                                sessionEndTime.setHours(endHours, endMinutes, 0, 0);
                                
                                // Handle sessions that span across midnight
                                if (sessionEndTime < sessionStartTime) {
                                  sessionEndTime.setDate(sessionEndTime.getDate() + 1);
                                }
                                
                                // Calculate during session window
                                const duringStart = new Date(sessionStartTime);
                                duringStart.setMinutes(duringStart.getMinutes() + session.monitoring_options.attendance.during_session.minutes_after_start);
                                
                                const duringEnd = new Date(sessionEndTime);
                                duringEnd.setMinutes(duringEnd.getMinutes() - session.monitoring_options.attendance.during_session.minutes_before_end);
                                
                                // Format times
                                const duringStartFormatted = `${duringStart.getHours().toString().padStart(2, '0')}:${duringStart.getMinutes().toString().padStart(2, '0')}`;
                                const duringEndFormatted = `${duringEnd.getHours().toString().padStart(2, '0')}:${duringEnd.getMinutes().toString().padStart(2, '0')}`;
                                
                                return (
                                  <>
                                    <p className="mb-1"><strong>Thời gian:</strong> {duringStartFormatted} - {duringEndFormatted}</p>
                                    <p className="mb-1"><strong>Sau giờ bắt đầu:</strong> {session.monitoring_options.attendance.during_session.minutes_after_start} phút</p>
                                    <p className="mb-0"><strong>Trước giờ kết thúc:</strong> {session.monitoring_options.attendance.during_session.minutes_before_end} phút</p>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        </Col>
                      )}
                      
                      {session.monitoring_options.attendance.after_session?.enabled && (
                        <Col md={4} className="mb-3">
                          <div className="modern-card border-warning h-100">
                            <div className="card-header bg-warning text-dark">
                              <TimerOff className="me-2" size={18} />
                              Điểm danh sau buổi học
                            </div>
                            <div className="card-body">
                              {(() => {
                                // Calculate actual time window for after session attendance
                                const sessionDate = new Date(session.date);
                                const [endHours, endMinutes] = session.end_time.split(':').map(Number);
                                
                                // Set session end time
                                const sessionEndTime = new Date(sessionDate);
                                sessionEndTime.setHours(endHours, endMinutes, 0, 0);
                                
                                // Calculate after session window
                                const afterStart = new Date(sessionEndTime);
                                afterStart.setMinutes(afterStart.getMinutes() + session.monitoring_options.attendance.after_session.minutes_after);
                                
                                const afterEnd = new Date(afterStart);
                                afterEnd.setMinutes(afterEnd.getMinutes() + session.monitoring_options.attendance.after_session.duration);
                                
                                // Format times
                                const afterStartFormatted = `${afterStart.getHours().toString().padStart(2, '0')}:${afterStart.getMinutes().toString().padStart(2, '0')}`;
                                const afterEndFormatted = `${afterEnd.getHours().toString().padStart(2, '0')}:${afterEnd.getMinutes().toString().padStart(2, '0')}`;
                                
                                return (
                                  <>
                                    <p className="mb-1"><strong>Thời gian:</strong> {afterStartFormatted} - {afterEndFormatted}</p>
                                    <p className="mb-1"><strong>Sau giờ kết thúc:</strong> {session.monitoring_options.attendance.after_session.minutes_after} phút</p>
                                    <p className="mb-0"><strong>Thời lượng:</strong> {session.monitoring_options.attendance.after_session.duration} phút</p>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        </Col>
                      )}
                    </Row>
                  </div>
                </div>
              )}
              
              <div className="mt-4">
                <h5 className="fw-bold text-primary">
                  <CheckCircle className="me-2" size={20} />
                  Tùy chọn giám sát
                </h5>
                <Row className="mt-3">
                  <Col md={3} className="mb-3">
                    <div className="modern-card">
                      <div className="card-body">
                        <div className="d-flex align-items-center">
                          <MapPin className={`me-2 ${session.monitoring_options?.location?.enabled ? 'text-success' : 'text-muted'}`} size={18} />
                          <span className="fw-medium">Theo dõi vị trí</span>
                          {session.monitoring_options?.location?.enabled && session.monitoring_options?.location?.required && 
                            <Badge bg="danger" className="ms-2 modern-badge" style={{fontSize: '0.7rem'}}>Bắt buộc</Badge>
                          }
                        </div>
                      </div>
                    </div>
                  </Col>
                  <Col md={3} className="mb-3">
                    <div className="modern-card">
                      <div className="card-body">
                        <div className="d-flex align-items-center">
                          <Upload className={`me-2 ${session.monitoring_options?.file_upload?.enabled ? 'text-success' : 'text-muted'}`} size={18} />
                          <span className="fw-medium">Tải lên tệp tin</span>
                          {session.monitoring_options?.file_upload?.enabled && session.monitoring_options?.file_upload?.required && 
                            <Badge bg="danger" className="ms-2 modern-badge" style={{fontSize: '0.7rem'}}>Bắt buộc</Badge>
                          }
                        </div>
                      </div>
                    </div>
                  </Col>
                </Row>
                
                {/* Geofence Information */}
                {session.monitoring_options?.location?.enabled && session.monitoring_options?.location?.geofence?.enabled && (
                  <div className="mt-4">
                    <h6 className="fw-bold text-primary">
                      <Map className="me-2" size={18} />
                      Giới hạn vị trí (Geofence)
                    </h6>
                    <div className="ms-3 mt-2">
                      <Row>
                        <Col md={4}>
                          <p><strong>Bán kính:</strong> {session.monitoring_options.location.geofence.radius} mét</p>
                        </Col>
                        <Col md={8}>
                          <p>
                            <strong>Tọa độ trung tâm:</strong>{' '}
                            {session.monitoring_options.location.geofence.coordinates?.latitude && 
                             session.monitoring_options.location.geofence.coordinates?.longitude ? (
                              <>
                                {session.monitoring_options.location.geofence.coordinates.latitude}, {session.monitoring_options.location.geofence.coordinates.longitude}
                                <button 
                                  className="btn-modern" 
                                  style={{ backgroundColor: '#6c757d', padding: '4px 8px', fontSize: '0.8rem' }}
                                  onClick={() => {
                                    const { latitude, longitude } = session.monitoring_options.location.geofence.coordinates;
                                    window.open(`https://www.google.com/maps?q=${latitude},${longitude}`, '_blank');
                                  }}
                                >
                                  <ExternalLink size={14} className="me-1" />
                                  Xem bản đồ
                                </button>
                                {(() => {
                                  const hospital = findHospitalByCoordinates(
                                    session.monitoring_options.location.geofence.coordinates.latitude,
                                    session.monitoring_options.location.geofence.coordinates.longitude
                                  );
                                  return hospital ? (
                                    <div className="mt-2">
                                      <Badge bg="info" className="modern-badge">
                                        <Hospital size={14} className="me-1" />
                                        {hospital.name}
                                      </Badge>
                                    </div>
                                  ) : null;
                                })()}
                              </>
                            ) : (
                              <span className="text-muted">Chưa thiết lập</span>
                            )}
                          </p>
                        </Col>
                      </Row>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Tab>
        
        <Tab eventKey="students" title={
          <span className="tab-title">
            <Users size={16} />
            <span>Danh sách sinh viên</span>
          </span>
        }>
          <div className="modern-card">
            <div className="card-body">
              <div className="mb-4">
                <div className="modern-alert modern-alert-info">
                  <h6 className="mb-3 fw-bold">
                    <Info className="me-2" size={18} />
                    Giải thích trạng thái điểm danh:
                  </h6>
                  {(() => {
                    // Collect all unique attendance types used in student records
                    const usedAttendanceTypes = new Set();
                    const usedBadges = {
                      full: false,       // Đầy đủ
                      before: false,     // Có mặt trước
                      during: false,     // Có mặt trong
                      after: false,      // Có mặt sau
                      present: false,    // Có mặt
                      early: false,      // Đi trước
                      late: false,       // Đi trễ
                      late_leave: false, // Về trễ
                      absent: false      // Vắng mặt
                    };

                    // Check which badges are actually used in the attendanceStats
                    if (attendanceStats?.students) {
                      attendanceStats.students.forEach(student => {
                        // Check if student is absent
                        if (!student.present) {
                          usedBadges.absent = true;
                          return;
                        }

                        // Get all attendance types from current record and history
                        const attendanceTypes = new Set();
                        
                        // Add current attendance record type
                        if (student.attendanceRecord?.attendance_type) {
                          attendanceTypes.add(student.attendanceRecord.attendance_type);
                        }
                        
                        // Add types from history if available
                        if (student.attendanceHistory && student.attendanceHistory.length > 0) {
                          student.attendanceHistory.forEach(record => {
                            if (record.attendance_type) {
                              attendanceTypes.add(record.attendance_type);
                            }
                          });
                        }
                        
                        // Check required attendance types
                        const requiredAttendanceTypes = [];
                        if (session.monitoring_options?.attendance?.before_session?.enabled) requiredAttendanceTypes.push('before');
                        if (session.monitoring_options?.attendance?.during_session?.enabled) requiredAttendanceTypes.push('during');
                        if (session.monitoring_options?.attendance?.after_session?.enabled) requiredAttendanceTypes.push('after');
                        
                        const hasBeforeAttendance = attendanceTypes.has('before');
                        const hasDuringAttendance = attendanceTypes.has('during');
                        const hasAfterAttendance = attendanceTypes.has('after');
                        const hasLateAttendance = attendanceTypes.has('late');
                        const hasEarlyAttendance = attendanceTypes.has('early');
                        const hasLateLeaveAttendance = attendanceTypes.has('late_leave');
                        
                        const hasAllRequiredAttendances = 
                          requiredAttendanceTypes.length >= 1 && 
                          requiredAttendanceTypes.every(type => attendanceTypes.has(type));
                        
                        // Check if full attendance is displayed
                        if ((hasAllRequiredAttendances && 
                            ((hasBeforeAttendance && hasDuringAttendance && (hasAfterAttendance || hasLateLeaveAttendance)) ||
                             (hasEarlyAttendance && hasDuringAttendance && (hasAfterAttendance || hasLateLeaveAttendance)))) ||
                            (hasAllRequiredAttendances && hasLateAttendance && hasDuringAttendance && 
                                (hasAfterAttendance || hasLateLeaveAttendance)) ||
                            (hasAllRequiredAttendances && (hasEarlyAttendance || hasBeforeAttendance) && 
                                hasDuringAttendance && hasAfterAttendance) ||
                            (hasLateAttendance && hasDuringAttendance && hasLateLeaveAttendance)) {
                          usedBadges.full = true;
                          
                          // Also mark late if it appears with full
                          if (hasLateAttendance) {
                            usedBadges.late = true;
                          }
                        } else {
                          // Individual statuses
                          if (hasBeforeAttendance) usedBadges.before = true;
                          if (hasDuringAttendance) usedBadges.during = true;
                          if (hasAfterAttendance) usedBadges.after = true;
                          if (hasLateAttendance) usedBadges.late = true;
                          if (hasEarlyAttendance) usedBadges.early = true;
                          if (hasLateLeaveAttendance) usedBadges.late_leave = true;
                          
                          // Check for absence with permission types
                          if (attendanceTypes.has('absent_perm')) usedBadges.absent_perm = true;
                          if (attendanceTypes.has('absent_before_perm')) usedBadges.absent_before_perm = true;
                          if (attendanceTypes.has('absent_during_perm')) usedBadges.absent_during_perm = true;
                          if (attendanceTypes.has('absent_after_perm')) usedBadges.absent_after_perm = true;
                          
                          // Generic present badge
                          if (!attendanceTypes.size) {
                            usedBadges.present = true;
                          }
                        }
                      });
                    }

                    // Return explanation for only used badges
                    const explanations = [];
                    
                    if (usedBadges.full) explanations.push({ badge: <Badge bg="success" className="modern-badge">Đầy đủ</Badge>, text: "Sinh viên đã điểm danh đủ các khung giờ yêu cầu" });
                    if (usedBadges.before) explanations.push({ badge: <Badge bg="success" className="modern-badge">Có mặt trước</Badge>, text: "Sinh viên điểm danh trước buổi học" });
                    if (usedBadges.during) explanations.push({ badge: <Badge bg="success" className="modern-badge">Có mặt trong</Badge>, text: "Sinh viên điểm danh trong buổi học" });
                    if (usedBadges.after) explanations.push({ badge: <Badge bg="success" className="modern-badge">Có mặt sau</Badge>, text: "Sinh viên điểm danh sau buổi học" });
                    if (usedBadges.present) explanations.push({ badge: <Badge bg="success" className="modern-badge">Có mặt</Badge>, text: "Sinh viên đã điểm danh (không xác định thời điểm)" });
                    if (usedBadges.early) explanations.push({ badge: <Badge bg="info" className="modern-badge">Đi trước</Badge>, text: "Sinh viên điểm danh sớm hơn thời gian cho phép" });
                    if (usedBadges.late) explanations.push({ badge: <Badge bg="warning" className="modern-badge">Đi trễ</Badge>, text: "Sinh viên điểm danh muộn so với giờ bắt đầu" });
                    if (usedBadges.late_leave) explanations.push({ badge: <Badge bg="warning" className="modern-badge">Về trễ</Badge>, text: "Sinh viên điểm danh muộn sau khi buổi học kết thúc" });
                    if (usedBadges.absent) explanations.push({ badge: <Badge bg="danger" className="modern-badge">Vắng mặt</Badge>, text: "Sinh viên chưa điểm danh" });
                    
                    // Thêm các badge vắng có phép
                    if (usedBadges.absent_perm) explanations.push({ badge: <Badge bg="danger" className="modern-badge">Phép cả buổi</Badge>, text: "Sinh viên vắng cả buổi học có phép" });
                    if (usedBadges.absent_before_perm) explanations.push({ badge: <Badge bg="info" className="modern-badge">Phép trước buổi</Badge>, text: "Sinh viên vắng điểm danh trước buổi học có phép" });
                    if (usedBadges.absent_during_perm) explanations.push({ badge: <Badge bg="warning" className="modern-badge">Phép trong buổi</Badge>, text: "Sinh viên vắng điểm danh trong buổi học có phép" });
                    if (usedBadges.absent_after_perm) explanations.push({ badge: <Badge bg="secondary" className="modern-badge">Phép sau buổi</Badge>, text: "Sinh viên vắng điểm danh sau buổi học có phép" });
                    
                    // If we're showing combination badges, also show the combinations
                    const showCombinations = usedBadges.full && (usedBadges.before || usedBadges.during || usedBadges.after || usedBadges.late || usedBadges.late_leave);
                    
                    const chunkExplanations = (arr, size) => {
                      const result = [];
                      for (let i = 0; i < arr.length; i += size) {
                        result.push(arr.slice(i, i + size));
                      }
                      return result;
                    };
                    
                    const chunks = chunkExplanations(explanations, Math.ceil(explanations.length / 3));

                    return (
                      <>
                        <Row>
                          {chunks.map((chunk, idx) => (
                            <Col md={4} key={idx}>
                              {chunk.map((item, i) => (
                                <p className="mb-1" key={i}>{item.badge} - {item.text}</p>
                              ))}
                            </Col>
                          ))}
                        </Row>
                        
                        {showCombinations && (
                          <>
                            <hr />
                            <h6 className="mb-2 fw-bold"><FileText className="me-2" size={16} />Ghi chú về hiển thị trạng thái:</h6>
                            <Row>
                              {usedBadges.full && usedBadges.before && usedBadges.during && usedBadges.after && (
                                <Col md={6}>
                                  <p className="mb-1"><strong>Trường hợp 1:</strong> <Badge bg="success" size="sm" className="modern-badge">Có mặt trước</Badge> + <Badge bg="success" size="sm" className="modern-badge">Có mặt trong</Badge> + <Badge bg="success" size="sm" className="modern-badge">Có mặt sau</Badge> (hoặc <Badge bg="warning" size="sm" className="modern-badge">Về trễ</Badge>) → Chỉ hiển thị <Badge bg="success" className="modern-badge">Đầy đủ</Badge></p>
                                </Col>
                              )}
                              
                              {usedBadges.full && usedBadges.late && usedBadges.during && usedBadges.after && (
                                <Col md={6}>
                                  <p className="mb-1"><strong>Trường hợp 2:</strong> <Badge bg="warning" size="sm" className="modern-badge">Đi trễ</Badge> + <Badge bg="success" size="sm" className="modern-badge">Có mặt trong</Badge> + <Badge bg="success" size="sm" className="modern-badge">Có mặt sau</Badge> → Hiển thị <Badge bg="success" className="modern-badge">Đầy đủ</Badge> và <Badge bg="warning" className="modern-badge">Đi trễ</Badge></p>
                                </Col>
                              )}
                              
                              {usedBadges.full && usedBadges.late && usedBadges.during && usedBadges.late_leave && (
                                <Col md={6}>
                                  <p className="mb-1"><strong>Trường hợp 3:</strong> <Badge bg="warning" size="sm" className="modern-badge">Đi trễ</Badge> + <Badge bg="success" size="sm" className="modern-badge">Có mặt trong</Badge> + <Badge bg="warning" size="sm" className="modern-badge">Về trễ</Badge> → Hiển thị <Badge bg="success" className="modern-badge">Đầy đủ</Badge> và <Badge bg="warning" className="modern-badge">Đi trễ</Badge></p>
                                </Col>
                              )}
                              
                              {usedBadges.full && (usedBadges.early || usedBadges.before) && usedBadges.during && usedBadges.after && (
                                <Col md={6}>
                                  <p className="mb-1"><strong>Trường hợp 4:</strong> <Badge bg="info" size="sm" className="modern-badge">Đi trước</Badge> (hoặc <Badge bg="success" size="sm" className="modern-badge">Có mặt trước</Badge>) + <Badge bg="success" size="sm" className="modern-badge">Có mặt trong</Badge> + <Badge bg="success" size="sm" className="modern-badge">Có mặt sau</Badge> → Chỉ hiển thị <Badge bg="success" className="modern-badge">Đầy đủ</Badge></p>
                                </Col>
                              )}
                              
                              {/* Thêm các trường hợp vắng có phép */}
                              {(usedBadges.absent_perm || usedBadges.absent_before_perm || usedBadges.absent_during_perm || usedBadges.absent_after_perm) && (
                                <Col md={12}>
                                  <hr />
                                  <h6 className="mb-2 fw-bold"><UserX className="me-2" size={16} />Trạng thái vắng có phép:</h6>
                                  <Row>
                                    {usedBadges.absent_perm && (
                                      <Col md={6}>
                                        <p className="mb-1"><strong>Vắng cả buổi:</strong> <Badge bg="danger" size="sm" className="modern-badge">Phép cả buổi</Badge> → Sinh viên vắng toàn bộ buổi học với lý do chính đáng</p>
                                      </Col>
                                    )}
                                    {usedBadges.absent_before_perm && (
                                      <Col md={6}>
                                        <p className="mb-1"><strong>Vắng trước buổi:</strong> <Badge bg="info" size="sm" className="modern-badge">Phép trước buổi</Badge> → Sinh viên vắng điểm danh trước buổi học với lý do chính đáng</p>
                                      </Col>
                                    )}
                                    {usedBadges.absent_during_perm && (
                                      <Col md={6}>
                                        <p className="mb-1"><strong>Vắng trong buổi:</strong> <Badge bg="warning" size="sm" className="modern-badge">Phép trong buổi</Badge> → Sinh viên vắng điểm danh trong buổi học với lý do chính đáng</p>
                                      </Col>
                                    )}
                                    {usedBadges.absent_after_perm && (
                                      <Col md={6}>
                                        <p className="mb-1"><strong>Vắng sau buổi:</strong> <Badge bg="secondary" size="sm" className="modern-badge">Phép sau buổi</Badge> → Sinh viên vắng điểm danh sau buổi học với lý do chính đáng</p>
                                      </Col>
                                    )}
                                  </Row>
                                </Col>
                              )}
                            </Row>
                            <p className="mb-0 mt-2 small fst-italic">Các trạng thái không quan trọng như "Có mặt", "Đi trước", "Về trễ" sẽ không hiển thị khi đã có trạng thái "Đầy đủ". Các trạng thái vắng có phép sẽ hiển thị riêng biệt và không bị ảnh hưởng bởi logic "Đầy đủ".</p>
                          </>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
              
              {attendanceStats?.students?.length > 0 ? (
                <div className="table-responsive">
                  <Table className="modern-table" striped hover responsive>
                  <thead>
                    <tr>
                      <th>Mã sinh viên</th>
                      <th>Tên sinh viên</th>
                      <th>Lớp</th>
                      <th>Email</th>
                      <th>Điểm danh</th>
                      <th>Thời gian điểm danh</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...attendanceStats.students]
                      // Sắp xếp sinh viên đã điểm danh lên đầu
                      .sort((a, b) => {
                        // Hàm xác định ưu tiên điểm danh
                        const getAttendancePriority = (student) => {
                          if (!student.present) return 0; // Chưa điểm danh
                          
                          // Kiểm tra loại điểm danh hiện tại
                          const currentType = student.attendanceRecord?.attendance_type || '';
                          
                          // Kiểm tra các loại điểm danh trong lịch sử
                          const historyTypes = student.attendanceHistory?.map(r => r.attendance_type) || [];
                          
                          // Tất cả các loại điểm danh (hiện tại + lịch sử)
                          const allTypes = [currentType, ...historyTypes];
                          
                          // Ưu tiên theo loại điểm danh
                          if (allTypes.includes('during')) return 4; // Điểm danh thường - ưu tiên cao nhất
                          if (allTypes.includes('before') || allTypes.includes('early')) return 3; // Điểm danh sớm
                          if (allTypes.includes('after')) return 2; // Điểm danh sau
                          if (allTypes.includes('late') || allTypes.includes('late_leave')) return 1; // Điểm danh trễ
                          
                          return 0; // Mặc định
                        };
                        
                        // So sánh ưu tiên điểm danh
                        const priorityA = getAttendancePriority(a);
                        const priorityB = getAttendancePriority(b);
                        
                        // Nếu ưu tiên khác nhau, sắp xếp theo ưu tiên giảm dần
                        if (priorityA !== priorityB) return priorityB - priorityA;
                        
                        // Nếu cùng ưu tiên, sắp xếp theo thời gian điểm danh (nếu có)
                        if (a.attendanceRecord && b.attendanceRecord) {
                          return new Date(a.attendanceRecord.timestamp) - new Date(b.attendanceRecord.timestamp);
                        }
                        
                        // Nếu không có thông tin thời gian, sắp xếp theo tên
                        return a.fullName.localeCompare(b.fullName);
                      })
                      .map(student => (
                      <tr 
                        key={student.id}
                        className={student.present ? 'table-success' : 'table-light'}
                      >
                        <td>{student.student_id}</td>
                        <td>{student.fullName}</td>
                        <td>{student.class_name}</td>
                        <td>{student.email}</td>
                        <td>
                          {student.present ? (
                            student.attendanceRecord?.attendance_type ? (
                              <div className="d-flex flex-column gap-1">
                                {(() => {
                                  // Get all attendance types from current record and history
                                  const attendanceTypes = new Set();
                                  const badges = [];
                                  
                                  // Add current attendance record type
                                  if (student.attendanceRecord.attendance_type) {
                                    attendanceTypes.add(student.attendanceRecord.attendance_type);
                                  }
                                  
                                  // Add types from history if available
                                  if (student.attendanceHistory && student.attendanceHistory.length > 0) {
                                    student.attendanceHistory.forEach(record => {
                                      if (record.attendance_type) {
                                        attendanceTypes.add(record.attendance_type);
                                      }
                                    });
                                  }
                                  
                                  // Check if student has all required attendance types
                                  const requiredAttendanceTypes = [];
                                  if (session.monitoring_options?.attendance?.before_session?.enabled) requiredAttendanceTypes.push('before');
                                  if (session.monitoring_options?.attendance?.during_session?.enabled) requiredAttendanceTypes.push('during');
                                  if (session.monitoring_options?.attendance?.after_session?.enabled) requiredAttendanceTypes.push('after');
                                  
                                  const hasBeforeAttendance = attendanceTypes.has('before');
                                  const hasDuringAttendance = attendanceTypes.has('during');
                                  const hasAfterAttendance = attendanceTypes.has('after');
                                  
                                  const hasAllRequiredAttendances = 
                                    requiredAttendanceTypes.length >= 1 && 
                                    requiredAttendanceTypes.every(type => attendanceTypes.has(type));
                                  
                                  // Xác định trạng thái điểm danh theo yêu cầu
                                  const hasLateAttendance = attendanceTypes.has('late');
                                  const hasEarlyAttendance = attendanceTypes.has('early');
                                  const hasLateLeaveAttendance = attendanceTypes.has('late_leave');
                                  
                                  // Tìm bản ghi đi trễ nếu có
                                  const lateRecord = student.attendanceHistory?.find(r => r.attendance_type === 'late') || 
                                                    (student.attendanceRecord.attendance_type === 'late' ? student.attendanceRecord : null);
                                  
                                  // Trường hợp 1: Có mặt trước, trong, sau hoặc về trễ -> Đầy đủ
                                  if (hasAllRequiredAttendances && 
                                      ((hasBeforeAttendance && hasDuringAttendance && (hasAfterAttendance || hasLateLeaveAttendance)) ||
                                       (hasEarlyAttendance && hasDuringAttendance && (hasAfterAttendance || hasLateLeaveAttendance)))) {
                                    badges.push(<Badge key="full" bg="success" className="mb-1">Đầy đủ</Badge>);
                                  }
                                  // Trường hợp 2 & 3: Đi trễ, có mặt trong, có mặt sau -> Đầy đủ và Đi trễ
                                  else if (hasAllRequiredAttendances && hasLateAttendance && hasDuringAttendance && 
                                          (hasAfterAttendance || hasLateLeaveAttendance)) {
                                    badges.push(<Badge key="full" bg="success" className="mb-1">Đầy đủ</Badge>);
                                    if (lateRecord) {
                                      badges.push(
                                        <Badge key="late" bg="warning" className="mb-1">
                                          Đi trễ {lateRecord.minutes_late} phút
                                        </Badge>
                                      );
                                    }
                                  }
                                  // Trường hợp 4: Đi trước hoặc có mặt trước, có mặt trong, có mặt sau -> Đầy đủ
                                  else if (hasAllRequiredAttendances && (hasEarlyAttendance || hasBeforeAttendance) && 
                                          hasDuringAttendance && hasAfterAttendance) {
                                    badges.push(<Badge key="full" bg="success" className="mb-1">Đầy đủ</Badge>);
                                  }
                                  // Trường hợp 3: Đi trễ + Có mặt trong + Về trễ -> Đầy đủ và Đi trễ
                                  else if (hasLateAttendance && hasDuringAttendance && hasLateLeaveAttendance && lateRecord) {
                                    console.log(`Case 3: Full attendance with late + during + late_leave`);
                                    badges.push(<Badge key="full" bg="success" className="mb-1">Đầy đủ</Badge>);
                                    badges.push(
                                      <Badge key="late" bg="warning" className="mb-1">
                                        Đi trễ {lateRecord.minutes_late} phút
                                      </Badge>
                                    );
                                  }
                                  // Trường hợp 5: Có mặt trong, Có mặt sau, Đi trễ -> Đầy đủ và Đi trễ
                                  else if (hasDuringAttendance && hasAfterAttendance && hasLateAttendance && lateRecord) {
                                    console.log(`Case 5: Full attendance with late + during + after`);
                                    badges.push(<Badge key="full" bg="success" className="mb-1">Đầy đủ</Badge>);
                                    badges.push(
                                      <Badge key="late" bg="warning" className="mb-1">
                                        Đi trễ {lateRecord.minutes_late} phút
                                      </Badge>
                                    );
                                  }
                                  // Các trường hợp khác: hiển thị từng trạng thái riêng biệt
                                  else {
                                    // Kiểm tra các loại vắng có phép
                                    const hasAbsentPerm = attendanceTypes.has('absent_perm');
                                    const hasAbsentBeforePerm = attendanceTypes.has('absent_before_perm');
                                    const hasAbsentDuringPerm = attendanceTypes.has('absent_during_perm');
                                    const hasAbsentAfterPerm = attendanceTypes.has('absent_after_perm');
                                    
                                    if (hasAbsentPerm) {
                                      badges.push(<Badge key="absent_perm" bg="danger" className="mb-1">Phép cả buổi</Badge>);
                                    } else if (hasAbsentBeforePerm) {
                                      badges.push(<Badge key="absent_before_perm" bg="info" className="mb-1">Phép trước buổi</Badge>);
                                    } else if (hasAbsentDuringPerm) {
                                      badges.push(<Badge key="absent_during_perm" bg="warning" className="mb-1">Phép trong buổi</Badge>);
                                    } else if (hasAbsentAfterPerm) {
                                      badges.push(<Badge key="absent_after_perm" bg="secondary" className="mb-1">Phép sau buổi</Badge>);
                                    } else {
                                      // Nếu không có vắng có phép, hiển thị trạng thái điểm danh bình thường
                                      if (hasBeforeAttendance) {
                                        badges.push(<Badge key="before" bg="success" className="mb-1">Có mặt trước</Badge>);
                                      }
                                      
                                      if (hasDuringAttendance) {
                                        badges.push(<Badge key="during" bg="success" className="mb-1">Có mặt trong</Badge>);
                                      }
                                      
                                      if (hasAfterAttendance) {
                                        badges.push(<Badge key="after" bg="success" className="mb-1">Có mặt sau</Badge>);
                                      }
                                    }
                                    
                                    // Hiển thị trạng thái đi trễ nếu có
                                    if (hasLateAttendance && lateRecord) {
                                      badges.push(
                                        <Badge key="late" bg="warning" className="mb-1">
                                          Đi trễ {lateRecord.minutes_late} phút
                                        </Badge>
                                      );
                                    }
                                    
                                    // Không hiển thị các trạng thái không quan trọng: Có mặt, Đi trước, Về trễ
                                  }
                                  
                                  // If no specific type, show generic present badge
                                  if (!badges.length) {
                                    badges.push(<Badge key="default" bg="success" className="mb-1">Có mặt</Badge>);
                                  }
                                  
                                  return badges;
                                })()}
                              </div>
                            ) : (
                              <Badge bg="success">Có mặt</Badge>
                            )
                          ) : (
                            <Badge bg="danger">Vắng mặt</Badge>
                          )}
                        </td>
                        <td>
                          {student.present ? (
                            <div className="d-flex flex-column gap-1">
                              {/* Show current attendance record timestamp */}
                              {student.attendanceRecord?.timestamp && (
                                <small>
                                  {student.attendanceRecord.attendance_type && (
                                    <span className="fw-bold">
                                      {student.attendanceRecord.attendance_type === 'before' && 'Trước: '}
                                      {student.attendanceRecord.attendance_type === 'during' && 'Trong: '}
                                      {student.attendanceRecord.attendance_type === 'after' && 'Sau: '}
                                      {student.attendanceRecord.attendance_type === 'early' && 'Sớm: '}
                                      {student.attendanceRecord.attendance_type === 'late' && 'Trễ: '}
                                      {student.attendanceRecord.attendance_type === 'late_leave' && 'Về trễ: '}
                                      {student.attendanceRecord.attendance_type === 'absent_perm' && 'Phép cả buổi: '}
                                      {student.attendanceRecord.attendance_type === 'absent_before_perm' && 'Phép trước: '}
                                      {student.attendanceRecord.attendance_type === 'absent_during_perm' && 'Phép trong: '}
                                      {student.attendanceRecord.attendance_type === 'absent_after_perm' && 'Phép sau: '}
                                      {!['before', 'during', 'after', 'early', 'late', 'late_leave', 'absent_perm', 'absent_before_perm', 'absent_during_perm', 'absent_after_perm'].includes(student.attendanceRecord.attendance_type) && 'Lúc: '}
                                    </span>
                                  )}
                                  {format(new Date(student.attendanceRecord.timestamp), 'HH:mm:ss')}
                                </small>
                              )}
                              
                              {/* Show history records timestamps - only latest for each type, excluding current record type */}
                              {(() => {
                                if (!student.attendanceHistory || student.attendanceHistory.length === 0) return null;
                                
                                // Get current record type to exclude from history
                                const currentRecordType = student.attendanceRecord?.attendance_type;
                                
                                // Group records by attendance_type and get the latest timestamp for each type
                                const groupedRecords = {};
                                student.attendanceHistory.forEach(record => {
                                  if (record.attendance_type && record.attendance_type !== currentRecordType) {
                                    const timestamp = record.timestamp || record.created_at;
                                    if (!groupedRecords[record.attendance_type] || new Date(timestamp) > new Date(groupedRecords[record.attendance_type])) {
                                      groupedRecords[record.attendance_type] = timestamp;
                                    }
                                  }
                                });
                                
                                // Display only the latest record for each type (excluding current record type)
                                return Object.entries(groupedRecords).map(([attendanceType, timestamp], index) => (
                                  <small key={index}>
                                    <span className="fw-bold">
                                      {attendanceType === 'before' && 'Trước: '}
                                      {attendanceType === 'during' && 'Trong: '}
                                      {attendanceType === 'after' && 'Sau: '}
                                      {attendanceType === 'early' && 'Sớm: '}
                                      {attendanceType === 'late' && 'Trễ: '}
                                      {attendanceType === 'late_leave' && 'Về trễ: '}
                                      {attendanceType === 'absent_perm' && 'Phép cả buổi: '}
                                      {attendanceType === 'absent_before_perm' && 'Phép trước: '}
                                      {attendanceType === 'absent_during_perm' && 'Phép trong: '}
                                      {attendanceType === 'absent_after_perm' && 'Phép sau: '}
                                      {!['before', 'during', 'after', 'early', 'late', 'late_leave', 'absent_perm', 'absent_before_perm', 'absent_during_perm', 'absent_after_perm'].includes(attendanceType) && 'Lúc: '}
                                    </span>
                                    {format(new Date(timestamp), 'HH:mm:ss')}
                                  </small>
                                ));
                              })()}
                            </div>
                          ) : (
                            'Chưa điểm danh'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                </div>
              ) : (
                <div className="text-center py-5">
                  <UserX size={48} className="text-muted mb-3" />
                  <p className="mb-0 text-muted">Không có sinh viên nào trong nhóm này hoặc chưa có dữ liệu điểm danh.</p>
                </div>
              )}
            </div>
          </div>
        </Tab>
      </Tabs>
    </div>
  );
};

export default SessionDetail;