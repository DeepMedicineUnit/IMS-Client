import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, Row, Col, Button, Table, Badge, Tab, Tabs, Alert, Spinner, Modal } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import Loader from '../../components/Loader';
import { format, parseISO, isAfter, isBefore, isEqual } from 'date-fns';
import { Calendar, Clock, MapPin, Users, FileText, QrCode, ArrowLeft, Info, CheckCircle, AlertTriangle, XCircle, UserCheck, UserX, Hospital, ExternalLink, Map, Upload, Clock as ClockIcon, Timer, TimerOff, User, Shield, Settings, Key, Database, Eye, EyeOff, CircleUser, Camera, FileDown, Activity, Download, History } from 'lucide-react';
import { useHospitalLocations, findHospitalByCoordinates } from '../../hooks/useHospitalLocations';
import usePageTitle from '../../hooks/usePageTitle';

const SessionDetail = () => {
  usePageTitle('Chi tiết buổi học');
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { api } = useAuth();
  const { showAlert } = useAlert();
  const { hospitalLocations } = useHospitalLocations();
  const [session, setSession] = useState(null);
  const [attendanceStats, setAttendanceStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Auto-refresh intervals
  const sessionDataIntervalRef = useRef(null);
  const attendanceStatsIntervalRef = useRef(null);
  
  // Auto-refresh indicator
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  
  // History tab state variables
  const [mainActiveTab, setMainActiveTab] = useState('info');
  const [historyStudents, setHistoryStudents] = useState([]);
  const [selectedHistoryStudent, setSelectedHistoryStudent] = useState(null);
  const [historyActiveTab, setHistoryActiveTab] = useState('attendance');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyDataLoaded, setHistoryDataLoaded] = useState(false);
  const [showWebcamModal, setShowWebcamModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  
  // State để track xem hash đã được xử lý chưa (tránh re-process liên tục)
  const [hashProcessed, setHashProcessed] = useState(false);
  const processedHashRef = useRef(null);
  
  // Lấy thời gian hiện tại thực
  const getMockCurrentDate = () => {
    return new Date();
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

  // Function to fetch session data silently (without loading state)
  const fetchSessionDataSilently = async () => {
    try {
      setIsAutoRefreshing(true);
      const sessionResponse = await api.get(`/sessions/${id}`);
      
      if (sessionResponse.data.success) {
        const sessionData = sessionResponse.data.data;
        // Calculate the session status
        const calculatedStatus = calculateSessionStatus(sessionData);
        setSession({
          ...sessionData,
          calculatedStatus: calculatedStatus
        });
      }
    } catch (error) {
      console.error('Error fetching session data silently:', error);
    } finally {
      setIsAutoRefreshing(false);
    }
  };

  // Function to fetch attendance stats silently
  const fetchAttendanceStatsSilently = async () => {
    try {
      const statsResponse = await api.get(`/sessions/${id}/attendance/stats`);
      if (statsResponse.data.success) {
        setAttendanceStats(statsResponse.data.data);
      }
    } catch (error) {
      console.error('Error fetching attendance stats silently:', error);
    }
  };

  // History tab functions
  const fetchHistoryData = useCallback(async (showLoadingState = true) => {
    try {
      if (showLoadingState) {
        setHistoryLoading(true);
      }
      
      const historyResponse = await api.get(`/history/sessions/${id}`);
      if (historyResponse.data.success) {
        const newStudentsData = historyResponse.data.data;
        setHistoryStudents(newStudentsData);
        setHistoryDataLoaded(true);
        
        // Update selected student data if one is already selected
        if (selectedHistoryStudent) {
          const updatedSelectedStudent = newStudentsData.find(student => student.id === selectedHistoryStudent.id);
          if (updatedSelectedStudent) {
            setSelectedHistoryStudent(updatedSelectedStudent);
          }
        } else if (newStudentsData.length > 0) {
          // Kiểm tra nếu có file hash trong URL, không set default student
          // để useEffect xử lý hash có thể set đúng student
          const currentHash = window.location.hash;
          if (currentHash && currentHash.startsWith('#file-')) {
            // Không set default student, để useEffect xử lý hash tự set
            // Tìm student có file tương ứng và set luôn
            const fileId = currentHash.replace('#file-', '');
            const studentWithFile = newStudentsData.find(student => 
              student.files && student.files.some(file => file.id == fileId)
            );
            if (studentWithFile) {
              setSelectedHistoryStudent(studentWithFile);
            } else {
              // Không tìm thấy student với file, set default
              setSelectedHistoryStudent(newStudentsData[0]);
            }
          } else {
            setSelectedHistoryStudent(newStudentsData[0]);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching history data:', error);
    } finally {
      if (showLoadingState) {
        setHistoryLoading(false);
      }
    }
  }, [api, id, selectedHistoryStudent]);

  // Handle main tab selection
  const handleMainTabSelect = (key) => {
    setMainActiveTab(key);
    if (key === 'history' && !historyDataLoaded) {
      fetchHistoryData();
    }
  };

  const refreshHistoryData = useCallback(async () => {
    try {
      const historyResponse = await api.get(`/history/sessions/${id}`);
      if (historyResponse.data.success) {
        const newStudentsData = historyResponse.data.data;
        
        setHistoryStudents(prevStudents => {
          if (JSON.stringify(prevStudents) !== JSON.stringify(newStudentsData)) {
            return newStudentsData;
          }
          return prevStudents;
        });
        
        if (selectedHistoryStudent) {
          const updatedSelectedStudent = newStudentsData.find(student => student.id === selectedHistoryStudent.id);
          if (updatedSelectedStudent && JSON.stringify(updatedSelectedStudent) !== JSON.stringify(selectedHistoryStudent)) {
            setSelectedHistoryStudent(updatedSelectedStudent);
          }
        }
      }
    } catch (error) {
      console.error('Error refreshing history data:', error);
    }
  }, [api, id, selectedHistoryStudent]);

  const handleSelectHistoryStudent = useCallback((student) => {
    setSelectedHistoryStudent(student);
  }, []);

  const handleWebcamClick = useCallback((image) => {
    setSelectedImage(image);
    setShowWebcamModal(true);
  }, []);

  const formatDateTime = useCallback((dateTimeString) => {
    try {
      if (!dateTimeString) return '';
      
      let date;
      if (typeof dateTimeString === 'string') {
        date = new Date(dateTimeString);
        if (isNaN(date.getTime())) {
          return dateTimeString;
        }
      } else if (dateTimeString instanceof Date) {
        date = dateTimeString;
      } else {
        return String(dateTimeString);
      }
      
      return format(date, 'dd/MM/yyyy HH:mm:ss');
    } catch (error) {
      return String(dateTimeString || '');
    }
  }, []);

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Không xác định';
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Byte';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
  };

  const getActivityTypeName = (activity) => {
    if (!activity || !activity.data_type) return 'Không xác định';
    switch (activity.data_type) {
      case 'webcam': return 'Webcam';
      case 'location': return 'Vị trí';
      case 'activity': return 'Hoạt động';
      default: return activity.data_type;
    }
  };

  const getHistoryAttendanceBadge = (record) => {
    if (!record.attendance_type) return <Badge bg="success">Có mặt</Badge>;
    
    switch (record.attendance_type) {
      case 'before': return <Badge bg="success">Có mặt trước</Badge>;
      case 'during': return <Badge bg="success">Có mặt trong</Badge>;
      case 'after': return <Badge bg="success">Có mặt sau</Badge>;
      case 'early': return <Badge bg="info">Đi trước {record.minutes_early || ''} phút</Badge>;
      case 'late': return <Badge bg="warning">Đi trễ {record.minutes_late || ''} phút</Badge>;
      case 'late_leave': return <Badge bg="warning">Về trễ {record.minutes_late || ''} phút</Badge>;
      case 'missing_before': return <Badge bg="danger">Thiếu Trước</Badge>;
      case 'missing_during': return <Badge bg="danger">Thiếu Trong</Badge>;
      case 'missing_after': return <Badge bg="danger">Thiếu Sau</Badge>;
      case 'absent_perm': return <Badge bg="danger">Phép cả buổi</Badge>;
      case 'absent_before_perm': return <Badge bg="info">Phép trước buổi</Badge>;
      case 'absent_during_perm': return <Badge bg="warning">Phép trong buổi</Badge>;
      case 'absent_after_perm': return <Badge bg="secondary">Phép sau buổi</Badge>;
      default: return <Badge bg="success">Có mặt</Badge>;
    }
  };

  // Render attendance history for History tab
  const renderHistoryAttendance = () => {
    if (!selectedHistoryStudent || (!selectedHistoryStudent.attendance && (!selectedHistoryStudent.attendanceHistory || selectedHistoryStudent.attendanceHistory.length === 0))) {
      return (
        <div className="modern-alert modern-alert-info">
          <Info className="me-2" size={18} />
          Không có dữ liệu điểm danh cho sinh viên này
        </div>
      );
    }
    
    const allAttendanceRecords = [];
    
    if (selectedHistoryStudent.attendance) {
      allAttendanceRecords.push({
        ...selectedHistoryStudent.attendance,
        isCurrent: true
      });
    }
    
    if (selectedHistoryStudent.attendanceHistory && selectedHistoryStudent.attendanceHistory.length > 0) {
      selectedHistoryStudent.attendanceHistory.forEach(record => {
        allAttendanceRecords.push({
          ...record,
          isCurrent: false
        });
      });
    }
    
    allAttendanceRecords.sort((a, b) => {
      const timeA = new Date(a.timestamp || a.created_at);
      const timeB = new Date(b.timestamp || b.created_at);
      return timeB - timeA;
    });
    
    return (
      <div className="table-responsive">
        <Table className="modern-table" striped hover responsive>
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Trạng thái</th>
              <th>Vị trí</th>
              <th>IP</th>
              <th>Thiết bị</th>
              <th>MAC</th>
            </tr>
          </thead>
          <tbody>
            {allAttendanceRecords.map((record, index) => (
              <tr key={index} className={record.isCurrent ? 'table-active' : ''}>
                <td>{formatDateTime(record.timestamp || record.created_at)}</td>
                <td>
                  <div className="d-flex align-items-center">
                    {getHistoryAttendanceBadge(record)}
                    {record.isCurrent && (
                      <Badge bg="primary" className="ms-2" pill>Hiện tại</Badge>
                    )}
                  </div>
                </td>
                <td>
                  {record.location_latitude && record.location_longitude ? (
                    <a 
                      href={`https://www.google.com/maps?q=${record.location_latitude},${record.location_longitude}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      {record.location_latitude}, {record.location_longitude}
                    </a>
                  ) : 'Không có'}
                </td>
                <td>{record.ip_address || 'Không có'}</td>
                <td>{record.user_agent || 'Không có'}</td>
                <td>{record.device_mac || 'Không có'}</td>
              </tr>
            ))}
            {allAttendanceRecords.length === 0 && (
              <tr>
                <td colSpan="6" className="text-center">Không có dữ liệu điểm danh</td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>
    );
  };

  // Render webcam history for History tab
  const renderHistoryWebcam = useMemo(() => {
    const hasProfileImage = selectedHistoryStudent?.attendance?.profile_image;
    const hasWebcamData = selectedHistoryStudent?.webcam && selectedHistoryStudent.webcam.length > 0;
    
    if (!hasProfileImage && !hasWebcamData) {
      return (
        <div className="modern-alert modern-alert-info">
          <Camera className="me-2" size={18} />
          Không có dữ liệu webcam cho sinh viên này
        </div>
      );
    }
    
    const allImages = [];
    const processedPaths = new Set();
    
    const attendanceInfo = selectedHistoryStudent.attendance ? {
      attendance_type: selectedHistoryStudent.attendance.attendance_type || 'default',
      minutes_early: selectedHistoryStudent.attendance.minutes_early,
      minutes_late: selectedHistoryStudent.attendance.minutes_late,
      profile_image: selectedHistoryStudent.attendance.profile_image,
      timestamp: selectedHistoryStudent.attendance.timestamp || selectedHistoryStudent.attendance.created_at
    } : null;
    
    if (hasWebcamData) {
      selectedHistoryStudent.webcam.forEach(image => {
        if (processedPaths.has(image.data_path)) return;
        
        const enhancedImage = { ...image };
        const isProfileImage = attendanceInfo && attendanceInfo.profile_image && image.data_path === attendanceInfo.profile_image;
        
        if (isProfileImage) {
          enhancedImage.is_profile = true;
          enhancedImage.attendance_type = attendanceInfo.attendance_type;
          enhancedImage.minutes_early = attendanceInfo.minutes_early;
          enhancedImage.minutes_late = attendanceInfo.minutes_late;
        } else {
          if (session && image.created_at) {
            const imageTime = new Date(image.created_at);
            const sessionStart = new Date(session.start_time);
            const sessionEnd = new Date(session.end_time);
            const minutesBeforeStart = (sessionStart - imageTime) / (1000 * 60);
            const minutesAfterEnd = (imageTime - sessionEnd) / (1000 * 60);
            
            if (minutesBeforeStart > 0) {
              enhancedImage.attendance_type = 'before';
              enhancedImage.minutes_early = Math.round(minutesBeforeStart);
            } else if (minutesAfterEnd > 0) {
              enhancedImage.attendance_type = 'after';
            } else {
              enhancedImage.attendance_type = 'during';
            }
          } else {
            enhancedImage.attendance_type = 'during';
          }
        }
        
        allImages.push(enhancedImage);
        processedPaths.add(image.data_path);
      });
    }
    
    if (hasProfileImage && !processedPaths.has(attendanceInfo.profile_image)) {
      allImages.push({
        data_path: attendanceInfo.profile_image,
        created_at: attendanceInfo.timestamp,
        is_profile: true,
        attendance_type: attendanceInfo.attendance_type,
        minutes_early: attendanceInfo.minutes_early,
        minutes_late: attendanceInfo.minutes_late
      });
    }
    
    allImages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    return (
      <div className="webcam-grid">
        {allImages.map((item, index) => (
          <div key={index} className="webcam-item" onClick={() => handleWebcamClick(item)}>
            <div className="webcam-thumbnail">
              <img 
                src={item.data_path ? `/api${item.data_path.startsWith('/uploads/') ? item.data_path : `/uploads/${item.data_path.split('/').pop()}`}` : 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2RkZGRkZCI+PC9yZWN0Pjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBhbGlnbm1lbnQtYmFzZWxpbmU9Im1pZGRsZSIgZmlsbD0iIzk5OTk5OSI+Tm8gaW1hZ2U8L3RleHQ+PC9zdmc+'}
                alt={`Webcam image ${index + 1}`}
                style={item.is_profile ? { border: '3px solid #28a745' } : {}}
                onError={(e) => {
                  if (!e.target.src.includes('data:image/svg+xml')) {
                    e.target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2RkZGRkZCI+PC9yZWN0Pjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBhbGlnbm1lbnQtYmFzZWxpbmU9Im1pZGRsZSIgZmlsbD0iIzk5OTk5OSI+TG9hZCBlcnJvcjwvdGV4dD48L3N2Zz4=';
                    e.target.onerror = null;
                  }
                }}
              />
            </div>
            <div className="webcam-info">
              <small>{formatDateTime(item.created_at)}</small>
              {item.attendance_type === 'before' && <span className="badge bg-success ms-2">Trước buổi học</span>}
              {item.attendance_type === 'during' && <span className="badge bg-success ms-2">Trong buổi học</span>}
              {item.attendance_type === 'after' && <span className="badge bg-success ms-2">Sau buổi học</span>}
              {item.attendance_type === 'early' && <span className="badge bg-info ms-2">Sớm {item.minutes_early} phút</span>}
              {item.attendance_type === 'late' && <span className="badge bg-warning ms-2">Trễ {item.minutes_late} phút</span>}
            </div>
          </div>
        ))}
        
        <style jsx="true">{`
          .webcam-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 15px; }
          .webcam-item { cursor: pointer; transition: transform 0.2s; display: flex; flex-direction: column; }
          .webcam-item:hover { transform: scale(1.05); }
          .webcam-thumbnail { position: relative; width: 100%; overflow: hidden; border-radius: 8px; background-color: #f8f9fa; display: flex; align-items: center; justify-content: center; min-height: 120px; }
          .webcam-thumbnail img { max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain; border-radius: 8px; }
          .webcam-info { text-align: center; margin-top: 8px; padding: 0 4px; }
          .webcam-info small { display: block; margin-bottom: 4px; font-size: 0.75rem; color: #6c757d; }
          .webcam-info .badge { font-size: 0.7rem; padding: 0.25em 0.5em; }
        `}</style>
      </div>
    );
  }, [selectedHistoryStudent, session, handleWebcamClick, formatDateTime]);

  // Render file history for History tab
  const renderHistoryFiles = () => {
    if (!selectedHistoryStudent || !selectedHistoryStudent.files || selectedHistoryStudent.files.length === 0) {
      return (
        <div className="modern-alert modern-alert-info">
          <FileDown className="me-2" size={18} />
          Không có tệp tin nào được tải lên bởi sinh viên này
        </div>
      );
    }
    
    return (
      <div className="table-responsive">
        <Table className="modern-table" striped hover responsive>
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Tên tệp</th>
              <th>Loại tệp</th>
              <th>Kích thước</th>
              <th>Ghi chú</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {selectedHistoryStudent.files.map((file, index) => (
              <tr key={index} id={`file-${file.id}`} className={file.is_recalled ? 'file-recalled' : ''}>
                <td>{formatDateTime(file.uploaded_at)}</td>
                <td>
                  <div className={file.is_recalled ? 'text-muted' : ''}>
                    {file.file_name}
                    {file.is_recalled && <span className="badge bg-secondary ms-2">Đã thu hồi</span>}
                  </div>
                </td>
                <td className={file.is_recalled ? 'text-muted' : ''}>{file.file_type || 'Không xác định'}</td>
                <td className={file.is_recalled ? 'text-muted' : ''}>{formatFileSize(file.file_size)}</td>
                <td>{file.note ? <div className={file.is_recalled ? 'text-muted' : 'text-info'}>{file.note}</div> : <span className="text-muted">Không có ghi chú</span>}</td>
                <td>
                  {file.is_recalled ? (
                    <div className="text-muted"><i className="fas fa-ban me-1"></i></div>
                  ) : (
                    <button 
                      className="btn-modern" 
                      style={{ backgroundColor: '#256176', padding: '6px 12px', fontSize: '0.875rem' }}
                      onClick={async () => {
                        try {
                          const token = localStorage.getItem('token');
                          const fileUrl = `/api/uploads/${file.file_path.split('/').pop()}`;
                          const response = await fetch(fileUrl, { headers: { 'x-auth-token': token } });
                          if (!response.ok) throw new Error('Không thể tải file');
                          const blob = await response.blob();
                          const blobUrl = URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.href = blobUrl;
                          link.download = file.file_name || `file-${file.id}`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
                        } catch (error) {
                          console.error('Lỗi khi tải file:', error);
                          showAlert('Không thể tải xuống file. Vui lòng thử lại sau.', 'danger');
                        }
                      }}
                    >
                      <Download size={14} className="me-1" />
                      Tải xuống
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    );
  };

  // Render activity history for History tab
  const renderHistoryActivity = () => {
    if (!selectedHistoryStudent || !selectedHistoryStudent.activity || selectedHistoryStudent.activity.length === 0) {
      return (
        <div className="modern-alert modern-alert-info">
          <Activity className="me-2" size={18} />
          Không có dữ liệu hoạt động cho sinh viên này
        </div>
      );
    }
    
    return (
      <div className="table-responsive">
        <Table className="modern-table" striped hover responsive>
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Loại hoạt động</th>
              <th>Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {selectedHistoryStudent.activity.map((item, index) => (
              <tr key={index}>
                <td>{formatDateTime(item.created_at)}</td>
                <td>{getActivityTypeName(item)}</td>
                <td>{item.data_content || 'Không có chi tiết'}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    );
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

  // Auto-refresh data every 10 seconds
  useEffect(() => {
    if (session) {
      // Start auto-refresh intervals
      sessionDataIntervalRef.current = setInterval(() => {
        fetchSessionDataSilently();
      }, 10000); // 10 seconds

      attendanceStatsIntervalRef.current = setInterval(() => {
        fetchAttendanceStatsSilently();
      }, 10000); // 10 seconds

      // Clean up intervals on unmount
      return () => {
        if (sessionDataIntervalRef.current) {
          clearInterval(sessionDataIntervalRef.current);
          sessionDataIntervalRef.current = null;
        }
        if (attendanceStatsIntervalRef.current) {
          clearInterval(attendanceStatsIntervalRef.current);
          attendanceStatsIntervalRef.current = null;
        }
      };
    }
  }, [session, id]);

  // Handle hash navigation to specific file in history tab
  useEffect(() => {
    if (location.hash && location.hash.startsWith('#file-')) {
      const currentHash = location.hash;
      
      // Nếu hash này đã được xử lý rồi, không xử lý lại
      if (processedHashRef.current === currentHash) {
        return;
      }
      
      // If there's a file hash but no history data loaded, fetch it
      if (!historyDataLoaded && !historyLoading) {
        setMainActiveTab('history');
        setHistoryActiveTab('files'); // Set files tab sớm
        fetchHistoryData();
        return;
      }
      
      // Once history data is loaded, find and navigate to the file
      if (historyDataLoaded && historyStudents.length > 0) {
        const fileId = location.hash.replace('#file-', '');
        
        const studentWithFile = historyStudents.find(student => 
          student.files && student.files.some(file => file.id == fileId)
        );
        
        if (studentWithFile) {
          setMainActiveTab('history');
          setSelectedHistoryStudent(studentWithFile);
          setHistoryActiveTab('files');
          
          // Đánh dấu hash đã được xử lý
          processedHashRef.current = currentHash;
          setHashProcessed(true);
          
          // Scroll đến file sau khi DOM render xong
          setTimeout(() => {
            const fileElement = document.getElementById(`file-${fileId}`);
            if (fileElement) {
              fileElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
              fileElement.classList.add('highlight-file');
              
              setTimeout(() => {
                fileElement.classList.remove('highlight-file');
              }, 3000);
            }
          }, 500);
        } else {
          // Không tìm thấy file, đánh dấu là đã xử lý để tránh loop
          processedHashRef.current = currentHash;
          setHashProcessed(true);
        }
      }
    } else {
      // Reset khi hash thay đổi thành không phải file hash
      if (processedHashRef.current) {
        processedHashRef.current = null;
        setHashProcessed(false);
      }
    }
  }, [location.hash, historyStudents, historyDataLoaded, historyLoading, fetchHistoryData]);

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
          {isAutoRefreshing && (
            <div className="auto-refresh-indicator ms-3">
              <div className="spinner-border spinner-border-sm text-primary" role="status">
                <span className="visually-hidden">Đang cập nhật...</span>
              </div>
              <span className="ms-2 small text-muted">Đang cập nhật...</span>
            </div>
          )}
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
      
      <Tabs activeKey={mainActiveTab} onSelect={handleMainTabSelect} className="mb-4 custom-tabs">
        <Tab eventKey="info" title={
          <span className="tab-title">
            <Info size={16} />
            <span>Thông tin buổi học</span>
          </span>
        }>
          <div className="modern-card">
            <div className="card-body">
              {/* Thông tin cơ bản */}
              <div className="mb-4">
                <h5 className="fw-bold text-primary mb-3">
                  <FileText className="me-2" size={20} />
                  Thông tin cơ bản
                </h5>
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
                      <span className="ms-2">{session.end_date && session.end_date !== session.date ? 
                        `${formatDate(session.date)} - ${formatDate(session.end_date)}` : 
                        formatDate(session.date)}</span>
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
                    <div className="d-flex align-items-center">
                      <FileText className="me-2 text-primary" size={18} />
                      <span className="fw-medium">Mô tả:</span>
                      <span className="ms-2">{session.description || 'Không có mô tả.'}</span>
                    </div>
                  </div>
                </Col>
                <Col md={6}>
                  <div className="space-y-3">
                  <div className="d-flex align-items-center">
                      <Users className="me-2 text-primary" size={18} />
                      <span className="fw-medium">Lớp học:</span>
                      <span className="ms-2">{session.class_names || 'Không có thông tin'}</span>
                    </div>  
                    <div className="d-flex align-items-center">
                      <Users className="me-2 text-primary" size={18} />
                      <span className="fw-medium">Nhóm sinh viên:</span>
                      <span className="ms-2">{session.group_names || 'Không có thông tin'}</span>
                    </div>
                    <div className="d-flex align-items-center">
                      <Users className="me-2 text-primary" size={18} />
                      <span className="fw-medium">Số lượng sinh viên:</span>
                        <span className="ms-2">{attendanceStats?.stats?.totalStudents || session.student_count || 'Không có thông tin'}</span>
                    </div>
                    <div className="d-flex align-items-center">
                      <CircleUser className="me-2 text-primary" size={18} />
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
              </div>
              </div>
              </div>

              {/* Thông tin người tạo và quản lý */}
              <div className="mb-4">
                <h5 className="fw-bold text-primary mb-3">
                  <User className="me-2" size={20} />
                  Thông tin quản lý
                </h5>
                <div className="modern-card">
                <div className="card-body">
                <Row>
                  <Col md={6}>
                    <div className="space-y-3">
                      <div className="d-flex align-items-center">
                        <User className="me-2 text-primary" size={18} />
                        <span className="fw-medium">Người tạo:</span>
                        <span className="ms-2">{session.created_by_full_name || session.created_by_username || 'Không có thông tin'}</span>
                      </div>
                      <div className="d-flex align-items-center">
                        <Calendar className="me-2 text-primary" size={18} />
                        <span className="fw-medium">Ngày tạo:</span>
                        <span className="ms-2">{session.created_at ? format(new Date(session.created_at), 'dd/MM/yyyy HH:mm') : 'Không có thông tin'}</span>
                      </div>
                    </div>
                  </Col>
                  <Col md={6}>
                    <div className="space-y-3">
                      <div className="d-flex align-items-center">
                        <Calendar className="me-2 text-primary" size={18} />
                        <span className="fw-medium">Cập nhật lần cuối:</span>
                        <span className="ms-2">{session.updated_at ? format(new Date(session.updated_at), 'dd/MM/yyyy HH:mm') : 'Không có thông tin'}</span>
                      </div>
                      <div className="d-flex align-items-center">
                        <Database className="me-2 text-primary" size={18} />
                        <span className="fw-medium">ID buổi học:</span>
                        <span className="ms-2 font-monospace">{session.id}</span>
                      </div>
                    </div>
                  </Col>
                </Row>
                </div>
                </div>
              </div>


              {/* Thông tin bảo mật */}
              <div className="mb-4">
                
                <h5 className="fw-bold text-primary mb-3">
                  <Shield className="me-2" size={20} />
                  Thông tin bảo mật
                </h5>
                <div className="modern-card">
                  <div className="card-body">
                <Row>
                  <Col md={6}>
                    <div className="space-y-3">
                      <div className="d-flex align-items-center">
                        <Key className="me-2 text-primary" size={18} />
                        <span className="fw-medium">Mật khẩu:</span>
                        <span className="ms-2">
                          {session.password ? (
                            <Badge bg="success" className="modern-badge">
                              <Eye size={14} className="me-1" />
                              Đã thiết lập
                            </Badge>
                          ) : (
                            <Badge bg="secondary" className="modern-badge">
                              <EyeOff size={14} className="me-1" />
                              Không có
                            </Badge>
                          )}
                        </span>
                      </div>
                      {session.password_expires_at && (
                        <div className="d-flex align-items-center">
                          <Clock className="me-2 text-primary" size={18} />
                          <span className="fw-medium">Mật khẩu hết hạn:</span>
                          <span className="ms-2">{format(new Date(session.password_expires_at), 'dd/MM/yyyy HH:mm')}</span>
                        </div>
                      )}
                    </div>
                  </Col>
                  <Col md={6}>
                    <div className="space-y-3">
                      <div className="d-flex align-items-center">
                        <QrCode className="me-2 text-primary" size={18} />
                        <span className="fw-medium">Mã QR:</span>
                        <span className="ms-2">
                          {session.qrCode ? (
                            <Badge bg="success" className="modern-badge">
                              <Eye size={14} className="me-1" />
                              Đã tạo
                            </Badge>
                          ) : (
                            <Badge bg="secondary" className="modern-badge">
                              <EyeOff size={14} className="me-1" />
                              Chưa tạo
                            </Badge>
                          )}
                        </span>
                      </div>
                    </div>
                    </Col>
                  </Row>
                </div>
                </div>
              </div>

              {/* Cấu hình điểm danh */}
              {session.attendance_config && (
                <div className="mb-4">
                  <h5 className="fw-bold text-primary mb-3">
                    <Settings className="me-2" size={20} />
                    Cấu hình điểm danh
                  </h5>
                  <div className="modern-card">
                    <div className="card-body">
                      <pre className="mb-0" style={{ fontSize: '0.9rem', backgroundColor: '#f8f9fa', padding: '1rem', borderRadius: '0.375rem' }}>
                        {JSON.stringify(session.attendance_config, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {/* Sinh viên ra ca trực */}
              {(() => {
                let dutyStudents = [];
                try {
                  if (session.monitoring_options) {
                    const config = typeof session.monitoring_options === 'string' 
                      ? JSON.parse(session.monitoring_options) 
                      : session.monitoring_options;
                    
                    if (config?.attendance?.during_session?.duty_students) {
                      dutyStudents = config.attendance.during_session.duty_students;
                    }
                  }
                } catch (error) {
                  console.error('Error parsing monitoring_options for duty students:', error);
                }
                
                return dutyStudents.length > 0 ? (
                  <div className="mb-4">
                    <h5 className="fw-bold text-primary mb-3">
                      <Users className="me-2" size={20} />
                      Sinh viên ra ca trực giữa giờ
                    </h5>
                    <div className="modern-card">
                      <div className="card-body">
                        <div className="row">
                          {dutyStudents.map((student, index) => (
                            <div key={index} className="col-md-6 col-lg-4 mb-3">
                              <div className="d-flex align-items-center p-3 border rounded" style={{ backgroundColor: '#f8f9fa' }}>
                                <div className="me-3">
                                  <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px' }}>
                                    <span className="fw-bold">{student.name ? student.name.charAt(0).toUpperCase() : 'S'}</span>
                                  </div>
                                </div>
                                <div>
                                  <div className="fw-bold">{student.name || student.full_name || 'Sinh viên'}</div>
                                  <small className="text-muted">MSSV: {student.id || student.student_id || 'N/A'}</small>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null;
              })()}


              
              {/* Monitoring Options Section */}
              {/* Attendance Windows Information */}
              {(() => {
                // Debug: Log monitoring options
                console.log('Session monitoring_options:', session.monitoring_options);
                console.log('Session monitoring_options type:', typeof session.monitoring_options);
                
                // Parse monitoring_options if it's a string
                let monitoringOptions = session.monitoring_options;
                if (typeof monitoringOptions === 'string') {
                  try {
                    monitoringOptions = JSON.parse(monitoringOptions);
                    console.log('Parsed monitoring_options:', monitoringOptions);
                  } catch (error) {
                    console.error('Error parsing monitoring_options:', error);
                    return null;
                  }
                }
                
                return monitoringOptions?.attendance ? (
                  <div className="mb-4">
                    <h5 className="fw-bold text-primary mb-3">
                      <ClockIcon className="me-2" size={20} />
                      Khung giờ điểm danh
                    </h5>
                    
                    {/* Tóm tắt khung giờ */}
                    <div className="mb-4">
                      <div className="modern-card">
                        <div className="card-body">
                          <div className="row">
                            <div className="col-md-6">
                              <p className="mb-1">
                                <strong>Buổi học:</strong> {session.start_time} - {session.end_time}
                              </p>
                              <p className="mb-1">
                                <strong>Ngày:</strong> {formatDate(session.date)}
                                {session.end_date && session.end_date !== session.date && ` - ${formatDate(session.end_date)}`}
                              </p>
                            </div>
                            <div className="col-md-6">
                              <p className="mb-1">
                                <strong>Tổng số khung giờ:</strong> 
                                <Badge bg="primary" className="ms-1">
                                  {[
                                    monitoringOptions.attendance.before_session?.enabled,
                                    monitoringOptions.attendance.during_session?.enabled,
                                    monitoringOptions.attendance.after_session?.enabled
                                  ].filter(Boolean).length} khung
                                </Badge>
                              </p>
                              <p className="mb-0">
                                <strong>Trạng thái:</strong> 
                                <Badge bg="success" className="ms-1">
                                  Đã kích hoạt
                                </Badge>
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="modern-card">
                      <div className="card-body">
                        <Row>
                        {monitoringOptions.attendance.before_session?.enabled && (
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
                                beforeStart.setMinutes(beforeStart.getMinutes() - monitoringOptions.attendance.before_session.minutes_before);
                                
                                // Format times
                                const beforeStartFormatted = `${beforeStart.getHours().toString().padStart(2, '0')}:${beforeStart.getMinutes().toString().padStart(2, '0')}`;
                                const sessionStartFormatted = `${sessionStartTime.getHours().toString().padStart(2, '0')}:${sessionStartTime.getMinutes().toString().padStart(2, '0')}`;
                                
                                // Calculate statistics for before session
                                const totalStudents = attendanceStats?.stats?.totalStudents || 0;
                                let beforeCount = 0;
                                let lateCount = 0;
                                
                                if (attendanceStats?.students) {
                                  attendanceStats.students.forEach(student => {
                                    if (!student.present) return;
                                    
                                    const attendanceTypes = new Set();
                                    if (student.attendanceRecord?.attendance_type) {
                                      attendanceTypes.add(student.attendanceRecord.attendance_type);
                                    }
                                    if (student.attendanceHistory) {
                                      student.attendanceHistory.forEach(record => {
                                        if (record.attendance_type) attendanceTypes.add(record.attendance_type);
                                      });
                                    }
                                    
                                    if (attendanceTypes.has('before') || attendanceTypes.has('early')) {
                                      beforeCount++;
                                    } else if (attendanceTypes.has('late') || attendanceTypes.has('late_before')) {
                                      lateCount++;
                                    }
                                  });
                                }
                                
                                const beforePercentage = totalStudents > 0 ? Math.round((beforeCount / totalStudents) * 100) : 0;
                                
                                return (
                                  <>
                                      <div className="mb-2">
                                        <strong className="text-dark">Khung giờ: {beforeStartFormatted} - {sessionStartFormatted}</strong>
                                      </div>
                                      <div className="mb-2">
                                        <strong className="text-dark">Trước giờ bắt đầu:</strong>
                                        <Badge bg="info" className="ms-1">
                                          {monitoringOptions.attendance.before_session.minutes_before} phút
                                        </Badge>
                                      </div>
                                      <div className="mb-2">
                                        <strong className="text-dark">Thời lượng:</strong>
                                        <Badge bg="secondary" className="ms-1">
                                          {monitoringOptions.attendance.before_session.duration} phút
                                        </Badge>
                                      </div>
                                      <hr className="my-2" />
                                      <div className="attendance-stats">
                                        <div className="d-flex justify-content-between align-items-center mb-1">
                                          <span className="text-dark"><UserCheck size={14} className="me-1" />Đúng giờ:</span>
                                          <Badge bg="success">{beforeCount}/{totalStudents}</Badge>
                                        </div>
                                        <div className="d-flex justify-content-between align-items-center mb-1">
                                          <span className="text-dark"><AlertTriangle size={14} className="me-1" />Đi trễ:</span>
                                          <Badge bg="warning">{lateCount}</Badge>
                                        </div>
                                        <div className="progress mt-2" style={{ height: '8px' }}>
                                          <div 
                                            className="progress-bar bg-success" 
                                            role="progressbar" 
                                            style={{ width: `${beforePercentage}%` }}
                                            aria-valuenow={beforePercentage} 
                                            aria-valuemin="0" 
                                            aria-valuemax="100"
                                          ></div>
                                        </div>
                                        <small className="text-muted">{beforePercentage}% điểm danh đúng giờ</small>
                                      </div>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        </Col>
                      )}
                      
                        {monitoringOptions.attendance.during_session?.enabled && (
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
                                  duringStart.setMinutes(duringStart.getMinutes() + monitoringOptions.attendance.during_session.minutes_after_start);
                                  
                                  const duringEnd = new Date(sessionEndTime);
                                  duringEnd.setMinutes(duringEnd.getMinutes() - monitoringOptions.attendance.during_session.minutes_before_end);
                                
                                // Format times
                                const duringStartFormatted = `${duringStart.getHours().toString().padStart(2, '0')}:${duringStart.getMinutes().toString().padStart(2, '0')}`;
                                const duringEndFormatted = `${duringEnd.getHours().toString().padStart(2, '0')}:${duringEnd.getMinutes().toString().padStart(2, '0')}`;
                                
                                // Calculate statistics for during session
                                const totalStudents = attendanceStats?.stats?.totalStudents || 0;
                                let duringCount = 0;
                                let missingDuringCount = 0;
                                
                                if (attendanceStats?.students) {
                                  attendanceStats.students.forEach(student => {
                                    if (!student.present) {
                                      missingDuringCount++;
                                      return;
                                    }
                                    
                                    const attendanceTypes = new Set();
                                    if (student.attendanceRecord?.attendance_type) {
                                      attendanceTypes.add(student.attendanceRecord.attendance_type);
                                    }
                                    if (student.attendanceHistory) {
                                      student.attendanceHistory.forEach(record => {
                                        if (record.attendance_type) attendanceTypes.add(record.attendance_type);
                                      });
                                    }
                                    
                                    if (attendanceTypes.has('during')) {
                                      duringCount++;
                                    } else {
                                      missingDuringCount++;
                                    }
                                  });
                                }
                                
                                const duringPercentage = totalStudents > 0 ? Math.round((duringCount / totalStudents) * 100) : 0;
                                
                                return (
                                  <>
                                      <div className="mb-2">
                                        <strong className="text-dark">Khung giờ: {duringStartFormatted} - {duringEndFormatted}</strong>
                                      </div>
                                      <div className="mb-2">
                                        <strong className="text-dark">Sau giờ bắt đầu:</strong>
                                        <Badge bg="success" className="ms-1">
                                          {monitoringOptions.attendance.during_session.minutes_after_start} phút
                                        </Badge>
                                      </div>
                                      <div className="mb-2">
                                        <strong className="text-dark">Trước giờ kết thúc:</strong>
                                        <Badge bg="warning" className="ms-1">
                                          {monitoringOptions.attendance.during_session.minutes_before_end} phút
                                        </Badge>
                                      </div>
                                      <hr className="my-2" />
                                      <div className="attendance-stats">
                                        <div className="d-flex justify-content-between align-items-center mb-1">
                                          <span className="text-dark"><UserCheck size={14} className="me-1" />Đã điểm danh:</span>
                                          <Badge bg="success">{duringCount}/{totalStudents}</Badge>
                                        </div>
                                        <div className="d-flex justify-content-between align-items-center mb-1">
                                          <span className="text-dark"><UserX size={14} className="me-1" />Chưa điểm danh:</span>
                                          <Badge bg="danger">{missingDuringCount}</Badge>
                                        </div>
                                        <div className="progress mt-2" style={{ height: '8px' }}>
                                          <div 
                                            className="progress-bar bg-success" 
                                            role="progressbar" 
                                            style={{ width: `${duringPercentage}%` }}
                                            aria-valuenow={duringPercentage} 
                                            aria-valuemin="0" 
                                            aria-valuemax="100"
                                          ></div>
                                        </div>
                                        <small className="text-muted">{duringPercentage}% đã điểm danh</small>
                                      </div>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        </Col>
                      )}
                      
                        {monitoringOptions.attendance.after_session?.enabled && (
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
                                  afterStart.setMinutes(afterStart.getMinutes() + monitoringOptions.attendance.after_session.minutes_after);
                                  
                                  const afterEnd = new Date(afterStart);
                                  afterEnd.setMinutes(afterEnd.getMinutes() + monitoringOptions.attendance.after_session.duration);
                                
                                // Format times
                                const afterStartFormatted = `${afterStart.getHours().toString().padStart(2, '0')}:${afterStart.getMinutes().toString().padStart(2, '0')}`;
                                const afterEndFormatted = `${afterEnd.getHours().toString().padStart(2, '0')}:${afterEnd.getMinutes().toString().padStart(2, '0')}`;
                                
                                // Calculate statistics for after session
                                const totalStudents = attendanceStats?.stats?.totalStudents || 0;
                                let afterCount = 0;
                                let lateLeaveCount = 0;
                                let dutyStudentCount = 0;
                                let missingAfterCount = 0;
                                
                                // Get duty students list
                                const dutyStudents = monitoringOptions.attendance?.during_session?.duty_students || [];
                                
                                if (attendanceStats?.students) {
                                  attendanceStats.students.forEach(student => {
                                    // Check if student is a duty student
                                    const isDutyStudent = dutyStudents.some(ds => 
                                      ds.id === student.id || ds.student_id === student.student_id
                                    );
                                    
                                    if (isDutyStudent) {
                                      dutyStudentCount++;
                                      return; // Duty students don't need after attendance
                                    }
                                    
                                    if (!student.present) {
                                      missingAfterCount++;
                                      return;
                                    }
                                    
                                    const attendanceTypes = new Set();
                                    if (student.attendanceRecord?.attendance_type) {
                                      attendanceTypes.add(student.attendanceRecord.attendance_type);
                                    }
                                    if (student.attendanceHistory) {
                                      student.attendanceHistory.forEach(record => {
                                        if (record.attendance_type) attendanceTypes.add(record.attendance_type);
                                      });
                                    }
                                    
                                    if (attendanceTypes.has('after')) {
                                      afterCount++;
                                    } else if (attendanceTypes.has('late_leave')) {
                                      lateLeaveCount++;
                                    } else {
                                      missingAfterCount++;
                                    }
                                  });
                                }
                                
                                const effectiveTotal = totalStudents - dutyStudentCount;
                                const afterPercentage = effectiveTotal > 0 ? Math.round(((afterCount + lateLeaveCount) / effectiveTotal) * 100) : 0;
                                
                                return (
                                  <>
                                      <div className="mb-2">
                                        <strong className="text-dark">Khung giờ: {afterStartFormatted} - {afterEndFormatted}</strong>
                                      </div>
                                      <div className="mb-2">
                                        <strong className="text-dark">Sau giờ kết thúc:</strong>
                                        <Badge bg="warning" className="ms-1">
                                          {monitoringOptions.attendance.after_session.minutes_after} phút
                                        </Badge>
                                      </div>
                                      <div className="mb-2">
                                        <strong className="text-dark">Thời lượng:</strong>
                                        <Badge bg="secondary" className="ms-1">
                                          {monitoringOptions.attendance.after_session.duration} phút
                                        </Badge>
                                      </div>
                                      <hr className="my-2" />
                                      <div className="attendance-stats">
                                        <div className="d-flex justify-content-between align-items-center mb-1">
                                          <span className="text-dark"><UserCheck size={14} className="me-1" />Đúng giờ:</span>
                                          <Badge bg="success">{afterCount}/{effectiveTotal}</Badge>
                                        </div>
                                        <div className="d-flex justify-content-between align-items-center mb-1">
                                          <span className="text-dark"><AlertTriangle size={14} className="me-1" />Về trễ:</span>
                                          <Badge bg="warning">{lateLeaveCount}</Badge>
                                        </div>
                                        {dutyStudentCount > 0 && (
                                          <div className="d-flex justify-content-between align-items-center mb-1">
                                            <span className="text-dark"><Users size={14} className="me-1" />Ra ca trực:</span>
                                            <Badge bg="info">{dutyStudentCount}</Badge>
                                          </div>
                                        )}
                                        <div className="d-flex justify-content-between align-items-center mb-1">
                                          <span className="text-dark"><UserX size={14} className="me-1" />Chưa điểm danh:</span>
                                          <Badge bg="danger">{missingAfterCount}</Badge>
                                        </div>
                                        <div className="progress mt-2" style={{ height: '8px' }}>
                                          <div 
                                            className="progress-bar bg-success" 
                                            role="progressbar" 
                                            style={{ width: `${afterPercentage}%` }}
                                            aria-valuenow={afterPercentage} 
                                            aria-valuemin="0" 
                                            aria-valuemax="100"
                                          ></div>
                                        </div>
                                        <small className="text-muted">{afterPercentage}% đã điểm danh{dutyStudentCount > 0 ? ` (trừ ${dutyStudentCount} SV ra ca trực)` : ''}</small>
                                      </div>
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
                </div>
              ) : null;
              })()}
              
              {/* Thông tin vị trí và bản đồ */}
              {(() => {
                // Parse monitoring_options if it's a string
                let monitoringOptions = session.monitoring_options;
                if (typeof monitoringOptions === 'string') {
                  try {
                    monitoringOptions = JSON.parse(monitoringOptions);
                  } catch (error) {
                    console.error('Error parsing monitoring_options for location:', error);
                    return null;
                  }
                }
                
                return monitoringOptions?.location?.geofence?.enabled ? (
                <div className="mb-4">
                  <h5 className="fw-bold text-primary mb-3">
                    <Map className="me-2" size={20} />
                    Thông tin vị trí và bản đồ
                  </h5>
                  <div className="modern-card">
                    <div className="card-body">
                      <Row>
                        <Col md={6}>
                          <div className="mb-3">
                            <h6 className="fw-bold text-primary">
                              <MapPin className="me-2" size={16} />
                              Thông tin vị trí
                            </h6>
                            <div className="space-y-2">
                              <div className="d-flex align-items-center mb-2">
                                <span className="fw-medium me-2">Bán kính:</span>
                                <Badge bg="info" className="modern-badge">
                                  {monitoringOptions.location.geofence.radius} mét
                                </Badge>
                              </div>
                              {monitoringOptions.location.geofence.coordinates?.latitude && 
                               monitoringOptions.location.geofence.coordinates?.longitude && (
                                <div className="d-flex align-items-center mb-2">
                                  <span className="fw-medium me-2">Tọa độ:</span>
                                  <span className="font-monospace small">
                                    {monitoringOptions.location.geofence.coordinates.latitude}, {monitoringOptions.location.geofence.coordinates.longitude}
                                  </span>
                                </div>
                              )}
                              {(() => {
                                const hospital = findHospitalByCoordinates(
                                  monitoringOptions.location.geofence.coordinates.latitude,
                                  monitoringOptions.location.geofence.coordinates.longitude,
                                  hospitalLocations
                                );
                                return hospital ? (
                                  <div className="d-flex align-items-center mb-2">
                                    <span className="fw-medium me-2">Địa điểm:</span>
                                    <Badge bg="info" className="modern-badge">
                                      <Hospital size={14} className="me-1" />
                                      {hospital}
                                    </Badge>
                                  </div>
                                ) : null;
                              })()}
                              <div className="d-flex align-items-center mb-2">
                                <span className="fw-medium me-2">Geofence:</span>
                                <Badge bg="success" className="modern-badge">
                                  Đã kích hoạt
                                </Badge>
                              </div>
                              <div className="d-flex align-items-center mb-2">
                                <span className="fw-medium me-2">Bắt buộc:</span>
                                <Badge bg={monitoringOptions.location.required ? "danger" : "secondary"} className="modern-badge">
                                  {monitoringOptions.location.required ? "Bắt buộc" : "Tùy chọn"}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </Col>
                        <Col md={6}>
                          <div className="mb-3">
                            <h6 className="fw-bold text-primary">
                              <ExternalLink className="me-2" size={16} />
                              Xem bản đồ
                            </h6>
                            {monitoringOptions.location.geofence.coordinates?.latitude && 
                             monitoringOptions.location.geofence.coordinates?.longitude ? (
                              <div className="d-grid gap-2">
                                <button 
                                  className="btn btn-outline-primary btn-sm"
                                  onClick={() => {
                                    const { latitude, longitude } = monitoringOptions.location.geofence.coordinates;
                                    window.open(`https://www.google.com/maps?q=${latitude},${longitude}`, '_blank');
                                  }}
                                >
                                  <ExternalLink size={14} className="me-1" />
                                  Mở Google Maps
                                </button>
                                <button 
                                  className="btn btn-outline-secondary btn-sm"
                                  onClick={() => {
                                    const { latitude, longitude } = monitoringOptions.location.geofence.coordinates;
                                    window.open(`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}&zoom=15`, '_blank');
                                  }}
                                >
                                  <Map size={14} className="me-1" />
                                  Mở OpenStreetMap
                                </button>
                                <button 
                                  className="btn btn-outline-info btn-sm"
                                  onClick={() => {
                                    const { latitude, longitude } = monitoringOptions.location.geofence.coordinates;
                                    window.open(`https://maps.apple.com/?q=${latitude},${longitude}`, '_blank');
                                  }}
                                >
                                  <Map size={14} className="me-1" />
                                  Mở Apple Maps
                                </button>
                              </div>
                            ) : (
                              <p className="text-muted small mb-0">Chưa thiết lập tọa độ</p>
                            )}
                          </div>
                        </Col>
                      </Row>
                    </div>
                  </div>
                </div>
              ) : null;
              })()}
              
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
                    Giải thích trạng thái điểm danhs:
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
                      absent: false,     // Vắng mặt
                      missing_before: false,  // Thiếu trước
                      missing_during: false, // Thiếu trong
                      missing_after: false    // Thiếu sau
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
                        
                        // Kiểm tra xem sinh viên có phải là sinh viên ra ca trực không
                        const isDutyStudent = (() => {
                          try {
                            if (session.monitoring_options) {
                              const config = typeof session.monitoring_options === 'string' 
                                ? JSON.parse(session.monitoring_options) 
                                : session.monitoring_options;
                              
                              if (config?.attendance?.during_session?.duty_students) {
                                return config.attendance.during_session.duty_students.some(dutyStudent => 
                                  dutyStudent.id === student.id || dutyStudent.student_id === student.student_id
                                );
                              }
                            }
                          } catch (error) {
                            console.error('Error checking duty student:', error);
                          }
                          return false;
                        })();

                        // Kiểm tra các trường hợp thiếu điểm danh
                        const missingBefore = requiredAttendanceTypes.includes('before') && !hasBeforeAttendance && !hasEarlyAttendance;
                        const missingDuring = requiredAttendanceTypes.includes('during') && !hasDuringAttendance;
                        // Sinh viên ra ca trực không cần điểm danh sau buổi học
                        const missingAfter = requiredAttendanceTypes.includes('after') && !hasAfterAttendance && !hasLateLeaveAttendance && !isDutyStudent;
                        
                        // Trường hợp 1: Trước - Trong -> Chỉ hiển thị Thiếu Sau (trừ duty students)
                        if (hasBeforeAttendance && hasDuringAttendance && !hasAfterAttendance && !hasLateLeaveAttendance && missingAfter) {
                          if (!isDutyStudent) {
                            usedBadges.missing_after = true;
                          } else {
                            // Duty student với trước + trong = đầy đủ
                            usedBadges.full = true;
                          }
                        }
                        // Trường hợp 2: Trước - Sau -> Chỉ hiển thị Thiếu Trong
                        else if (hasBeforeAttendance && hasAfterAttendance && !hasDuringAttendance && missingDuring) {
                          usedBadges.missing_during = true;
                        }
                        // Trường hợp 3: Đi trễ - Trong -> Chỉ hiển thị Thiếu Sau + Đi trễ (trừ duty students)
                        else if (hasLateAttendance && hasDuringAttendance && !hasAfterAttendance && !hasLateLeaveAttendance && missingAfter) {
                          if (!isDutyStudent) {
                            usedBadges.missing_after = true;
                          } else {
                            // Duty student với đi trễ + trong = đầy đủ + đi trễ
                            usedBadges.full = true;
                          }
                          usedBadges.late = true;
                        }
                        // Trường hợp 4: Đi trễ - Sau -> Chỉ hiển thị Thiếu Trong + Đi trễ
                        else if (hasLateAttendance && hasAfterAttendance && !hasDuringAttendance && missingDuring) {
                          usedBadges.missing_during = true;
                          usedBadges.late = true;
                        }
                        // Trường hợp 5: Trong - Sau -> Chỉ hiển thị Thiếu Trước
                        else if (hasDuringAttendance && hasAfterAttendance && !hasBeforeAttendance && !hasEarlyAttendance && missingBefore) {
                          usedBadges.missing_before = true;
                        }
                        // Trường hợp 6: Trước - Trong - Sau -> Chỉ hiển thị Đầy đủ
                        else if (hasBeforeAttendance && hasDuringAttendance && (hasAfterAttendance || hasLateLeaveAttendance)) {
                          usedBadges.full = true;
                        }
                        // Trường hợp 7: Đi trễ - Trong - Sau -> Chỉ hiển thị Đầy đủ + Đi trễ
                        else if (hasLateAttendance && hasDuringAttendance && (hasAfterAttendance || hasLateLeaveAttendance)) {
                          usedBadges.full = true;
                          usedBadges.late = true;
                        }
                        // Trường hợp đặc biệt: Duty student chỉ có trước hoặc đi trễ + trong = đầy đủ
                        else if (isDutyStudent && (hasBeforeAttendance || hasLateAttendance) && hasDuringAttendance && !hasAfterAttendance && !hasLateLeaveAttendance) {
                          usedBadges.full = true;
                          if (hasLateAttendance) {
                            usedBadges.late = true;
                          }
                        }
                        // Các trường hợp khác: hiển thị từng trạng thái riêng biệt
                        else {
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
                        
                        // Đánh dấu các badge thiếu điểm danh nếu chưa được đánh dấu
                        if (missingBefore && !usedBadges.missing_before) usedBadges.missing_before = true;
                        if (missingDuring && !usedBadges.missing_during) usedBadges.missing_during = true;
                        if (missingAfter && !usedBadges.missing_after) usedBadges.missing_after = true;
                        
                        // Đánh dấu badge "Đầy đủ" nếu sinh viên có đầy đủ điểm danh nhưng chưa được đánh dấu
                        if (!usedBadges.full && hasBeforeAttendance && hasDuringAttendance && (hasAfterAttendance || hasLateLeaveAttendance)) {
                          usedBadges.full = true;
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
                    if (usedBadges.late) explanations.push({ badge: <Badge bg="warning" className="modern-badge">Đi trễ</Badge>, text: "Sinh viên điểm danh đi trễ so với giờ bắt đầu" });
                    if (usedBadges.late_leave) explanations.push({ badge: <Badge bg="warning" className="modern-badge">Về trễ</Badge>, text: "Sinh viên điểm danh về trễ sau khi buổi học kết thúc" });
                    if (usedBadges.absent) explanations.push({ badge: <Badge bg="danger" className="modern-badge">Vắng mặt</Badge>, text: "Sinh viên chưa điểm danh" });
                    
                    // Thêm các badge thiếu điểm danh
                    if (usedBadges.missing_before) explanations.push({ badge: <Badge bg="danger" className="modern-badge">Thiếu Trước</Badge>, text: "Sinh viên thiếu điểm danh trước buổi học" });
                    if (usedBadges.missing_during) explanations.push({ badge: <Badge bg="danger" className="modern-badge">Thiếu Trong</Badge>, text: "Sinh viên thiếu điểm danh trong buổi học" });
                    if (usedBadges.missing_after) explanations.push({ badge: <Badge bg="danger" className="modern-badge">Thiếu Sau</Badge>, text: "Sinh viên thiếu điểm danh sau buổi học" });
                    
                    // Thêm các badge vắng có phép
                    if (usedBadges.absent_perm) explanations.push({ badge: <Badge bg="danger" className="modern-badge">Phép cả buổi</Badge>, text: "Sinh viên vắng cả buổi học có phép" });
                    if (usedBadges.absent_before_perm) explanations.push({ badge: <Badge bg="info" className="modern-badge">Phép trước buổi</Badge>, text: "Sinh viên vắng điểm danh trước buổi học có phép" });
                    if (usedBadges.absent_during_perm) explanations.push({ badge: <Badge bg="warning" className="modern-badge">Phép trong buổi</Badge>, text: "Sinh viên vắng điểm danh trong buổi học có phép" });
                    if (usedBadges.absent_after_perm) explanations.push({ badge: <Badge bg="secondary" className="modern-badge">Phép sau buổi</Badge>, text: "Sinh viên vắng điểm danh sau buổi học có phép" });
                    
                    // Show combinations if we have any special cases (missing, full, or late combinations)
                    const showCombinations = usedBadges.missing_before || usedBadges.missing_during || usedBadges.missing_after || 
                                            usedBadges.full || usedBadges.late;
                    
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
                              <Col md={6}>
                                <p className="mb-1"><strong>Trường hợp 1:</strong> <Badge bg="success" size="sm" className="modern-badge">Có mặt trước</Badge> + <Badge bg="success" size="sm" className="modern-badge">Có mặt trong</Badge> → Chỉ hiển thị <Badge bg="danger" className="modern-badge">Thiếu Sau</Badge></p>
                              </Col>
                              
                              <Col md={6}>
                                <p className="mb-1"><strong>Trường hợp 2:</strong> <Badge bg="success" size="sm" className="modern-badge">Có mặt trước</Badge> + <Badge bg="success" size="sm" className="modern-badge">Có mặt sau</Badge> → Chỉ hiển thị <Badge bg="danger" className="modern-badge">Thiếu Trong</Badge></p>
                              </Col>
                              
                              <Col md={6}>
                                <p className="mb-1"><strong>Trường hợp 3:</strong> <Badge bg="warning" size="sm" className="modern-badge">Đi trễ</Badge> + <Badge bg="success" size="sm" className="modern-badge">Có mặt trong</Badge> → Hiển thị <Badge bg="danger" className="modern-badge">Thiếu Sau</Badge> + <Badge bg="warning" className="modern-badge">Đi trễ</Badge></p>
                              </Col>
                              
                              <Col md={6}>
                                <p className="mb-1"><strong>Trường hợp 4:</strong> <Badge bg="warning" size="sm" className="modern-badge">Đi trễ</Badge> + <Badge bg="success" size="sm" className="modern-badge">Có mặt sau</Badge> → Hiển thị <Badge bg="danger" className="modern-badge">Thiếu Trong</Badge> + <Badge bg="warning" className="modern-badge">Đi trễ</Badge></p>
                              </Col>
                              
                              <Col md={6}>
                                <p className="mb-1"><strong>Trường hợp 5:</strong> <Badge bg="success" size="sm" className="modern-badge">Có mặt trong</Badge> + <Badge bg="success" size="sm" className="modern-badge">Có mặt sau</Badge> → Chỉ hiển thị <Badge bg="danger" className="modern-badge">Thiếu Trước</Badge></p>
                              </Col>
                              
                              <Col md={6}>
                                <p className="mb-1"><strong>Trường hợp 6:</strong> <Badge bg="success" size="sm" className="modern-badge">Có mặt trước</Badge> + <Badge bg="success" size="sm" className="modern-badge">Có mặt trong</Badge> + <Badge bg="success" size="sm" className="modern-badge">Có mặt sau</Badge> → Chỉ hiển thị <Badge bg="success" className="modern-badge">Đầy đủ</Badge></p>
                              </Col>
                              
                              <Col md={6}>
                                <p className="mb-1"><strong>Trường hợp 7:</strong> <Badge bg="warning" size="sm" className="modern-badge">Đi trễ</Badge> + <Badge bg="success" size="sm" className="modern-badge">Có mặt trong</Badge> + <Badge bg="success" size="sm" className="modern-badge">Có mặt sau</Badge> → Hiển thị <Badge bg="success" className="modern-badge">Đầy đủ</Badge> + <Badge bg="warning" className="modern-badge">Đi trễ</Badge></p>
                              </Col>
                              
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
                            <p className="mb-0 mt-2 small fst-italic">Hệ thống sẽ ưu tiên hiển thị các trạng thái thiếu điểm danh và đầy đủ trước các trạng thái riêng lẻ. Các trạng thái vắng có phép sẽ hiển thị riêng biệt và không bị ảnh hưởng bởi logic trên.</p>
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
                      .map(student => {
                        // Kiểm tra xem sinh viên có phải là sinh viên ra ca trực không
                        const isDutyStudent = (() => {
                          try {
                            if (session.monitoring_options) {
                              const config = typeof session.monitoring_options === 'string' 
                                ? JSON.parse(session.monitoring_options) 
                                : session.monitoring_options;
                              
                              if (config?.attendance?.during_session?.duty_students) {
                                return config.attendance.during_session.duty_students.some(dutyStudent => 
                                  dutyStudent.id === student.id || dutyStudent.student_id === student.student_id
                                );
                              }
                            }
                          } catch (error) {
                            console.error('Error checking duty student:', error);
                          }
                          return false;
                        })();

                        return (
                          <tr 
                            key={student.id}
                            className={student.present ? 'table-success' : 'table-light'}
                          >
                            <td>{student.student_id}</td>
                            <td>
                              <div className="d-flex align-items-center">
                                <span>{student.fullName}</span>
                                {isDutyStudent && (
                                  <Badge bg="info" className="ms-2 modern-badge" style={{ fontSize: '0.7rem' }}>
                                    <Users size={12} className="me-1" />
                                    Ra ca trực giữa giờ
                                  </Badge>
                                )}
                              </div>
                            </td>
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
                                  const hasLateAttendance = attendanceTypes.has('late') || attendanceTypes.has('late_before');
                                  const hasEarlyAttendance = attendanceTypes.has('early');
                                  const hasLateLeaveAttendance = attendanceTypes.has('late_leave');
                                  
                                  // Tìm bản ghi đi trễ nếu có
                                  const lateRecord = student.attendanceHistory?.find(r => r.attendance_type === 'late' || r.attendance_type === 'late_before') || 
                                                    ((student.attendanceRecord.attendance_type === 'late' || student.attendanceRecord.attendance_type === 'late_before') ? student.attendanceRecord : null);
                                  
                                  // Kiểm tra xem sinh viên có phải là sinh viên ra ca trực không
                                  const isDutyStudentInTable = (() => {
                                    try {
                                      if (session.monitoring_options) {
                                        const config = typeof session.monitoring_options === 'string' 
                                          ? JSON.parse(session.monitoring_options) 
                                          : session.monitoring_options;
                                        
                                        if (config?.attendance?.during_session?.duty_students) {
                                          return config.attendance.during_session.duty_students.some(dutyStudent => 
                                            dutyStudent.id === student.id || dutyStudent.student_id === student.student_id
                                          );
                                        }
                                      }
                                    } catch (error) {
                                      console.error('Error checking duty student in table:', error);
                                    }
                                    return false;
                                  })();

                                  // Kiểm tra các trường hợp thiếu điểm danh
                                  const missingBefore = requiredAttendanceTypes.includes('before') && !hasBeforeAttendance && !hasEarlyAttendance;
                                  const missingDuring = requiredAttendanceTypes.includes('during') && !hasDuringAttendance;
                                  // Sinh viên ra ca trực không cần điểm danh sau buổi học
                                  const missingAfter = requiredAttendanceTypes.includes('after') && !hasAfterAttendance && !hasLateLeaveAttendance && !isDutyStudentInTable;
                                  
                                  // Trường hợp 1: Trước - Trong -> Chỉ hiển thị Thiếu Sau (trừ duty students)
                                  if (hasBeforeAttendance && hasDuringAttendance && !hasAfterAttendance && !hasLateLeaveAttendance && missingAfter) {
                                    if (!isDutyStudentInTable) {
                                      badges.push(<Badge key="missing_after" bg="danger" className="mb-1">Thiếu Sau</Badge>);
                                    } else {
                                      // Duty student với trước + trong = đầy đủ
                                      badges.push(<Badge key="full" bg="success" className="mb-1">Đầy đủ</Badge>);
                                    }
                                  }
                                  // Trường hợp 2: Trước - Sau -> Chỉ hiển thị Thiếu Trong
                                  else if (hasBeforeAttendance && hasAfterAttendance && !hasDuringAttendance && missingDuring) {
                                    badges.push(<Badge key="missing_during" bg="danger" className="mb-1">Thiếu Trong</Badge>);
                                  }
                                  // Trường hợp 3: Đi trễ - Trong -> Chỉ hiển thị Thiếu Sau + Đi trễ (trừ duty students)
                                  else if (hasLateAttendance && hasDuringAttendance && !hasAfterAttendance && !hasLateLeaveAttendance && missingAfter) {
                                    if (!isDutyStudentInTable) {
                                      badges.push(<Badge key="missing_after" bg="danger" className="mb-1">Thiếu Sau</Badge>);
                                    } else {
                                      // Duty student với đi trễ + trong = đầy đủ
                                      badges.push(<Badge key="full" bg="success" className="mb-1">Đầy đủ</Badge>);
                                    }
                                    if (lateRecord) {
                                      badges.push(
                                        <Badge key="late" bg="warning" className="mb-1">
                                          Đi trễ {lateRecord.minutes_late} phút
                                        </Badge>
                                      );
                                    }
                                  }
                                  // Trường hợp 4: Đi trễ - Sau -> Chỉ hiển thị Thiếu Trong + Đi trễ
                                  else if (hasLateAttendance && hasAfterAttendance && !hasDuringAttendance && missingDuring) {
                                    badges.push(<Badge key="missing_during" bg="danger" className="mb-1">Thiếu Trong</Badge>);
                                    if (lateRecord) {
                                      badges.push(
                                        <Badge key="late" bg="warning" className="mb-1">
                                          Đi trễ {lateRecord.minutes_late} phút
                                        </Badge>
                                      );
                                    }
                                  }
                                  // Trường hợp 5: Trong - Sau -> Chỉ hiển thị Thiếu Trước
                                  else if (hasDuringAttendance && hasAfterAttendance && !hasBeforeAttendance && !hasEarlyAttendance && missingBefore) {
                                    badges.push(<Badge key="missing_before" bg="danger" className="mb-1">Thiếu Trước</Badge>);
                                  }
                                  // Trường hợp 6: Trước - Trong - Sau -> Chỉ hiển thị Đầy đủ
                                  else if (hasBeforeAttendance && hasDuringAttendance && (hasAfterAttendance || hasLateLeaveAttendance)) {
                                    badges.push(<Badge key="full" bg="success" className="mb-1">Đầy đủ</Badge>);
                                  }
                                  // Trường hợp 7: Đi trễ - Trong - Sau -> Chỉ hiển thị Đầy đủ + Đi trễ
                                  else if (hasLateAttendance && hasDuringAttendance && (hasAfterAttendance || hasLateLeaveAttendance)) {
                                    badges.push(<Badge key="full" bg="success" className="mb-1">Đầy đủ</Badge>);
                                    if (lateRecord) {
                                      badges.push(
                                        <Badge key="late" bg="warning" className="mb-1">
                                          Đi trễ {lateRecord.minutes_late} phút
                                        </Badge>
                                      );
                                    }
                                  }
                                  // Trường hợp đặc biệt: Duty student chỉ có trước hoặc đi trễ + trong = đầy đủ
                                  else if (isDutyStudentInTable && (hasBeforeAttendance || hasLateAttendance) && hasDuringAttendance && !hasAfterAttendance && !hasLateLeaveAttendance) {
                                    badges.push(<Badge key="full" bg="success" className="mb-1">Đầy đủ</Badge>);
                                    if (hasLateAttendance && lateRecord) {
                                      badges.push(
                                        <Badge key="late" bg="warning" className="mb-1">
                                          Đi trễ {lateRecord.minutes_late} phút
                                        </Badge>
                                      );
                                    }
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
                                      {(student.attendanceRecord.attendance_type === 'late' || student.attendanceRecord.attendance_type === 'late_before') && 'Đi trễ: '}
                                      {student.attendanceRecord.attendance_type === 'late_leave' && 'Về trễ: '}
                                      {student.attendanceRecord.attendance_type === 'absent_perm' && 'Phép cả buổi: '}
                                      {student.attendanceRecord.attendance_type === 'absent_before_perm' && 'Phép trước: '}
                                      {student.attendanceRecord.attendance_type === 'absent_during_perm' && 'Phép trong: '}
                                      {student.attendanceRecord.attendance_type === 'absent_after_perm' && 'Phép sau: '}
                                      {!['before', 'during', 'after', 'early', 'late', 'late_before', 'late_leave', 'absent_perm', 'absent_before_perm', 'absent_during_perm', 'absent_after_perm'].includes(student.attendanceRecord.attendance_type) && 'Lúc: '}
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
                                      {(attendanceType === 'late' || attendanceType === 'late_before') && 'Đi trễ: '}
                                      {attendanceType === 'late_leave' && 'Về trễ: '}
                                      {attendanceType === 'absent_perm' && 'Phép cả buổi: '}
                                      {attendanceType === 'absent_before_perm' && 'Phép trước: '}
                                      {attendanceType === 'absent_during_perm' && 'Phép trong: '}
                                      {attendanceType === 'absent_after_perm' && 'Phép sau: '}
                                      {!['before', 'during', 'after', 'early', 'late', 'late_before', 'late_leave', 'absent_perm', 'absent_before_perm', 'absent_during_perm', 'absent_after_perm'].includes(attendanceType) && 'Lúc: '}
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
                        );
                      })}
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
        
        <Tab eventKey="history" title={
          <span className="tab-title">
            <History size={16} />
            <span>Lịch sử hoạt động</span>
          </span>
        }>
          <div className="row">
            <div className="col-md-4">
              <div className="modern-card mb-4">
                <div className="card-header">
                  <h5 className="mb-0 fw-bold">
                    <Users className="me-2" size={20} />
                    Danh sách sinh viên
                    {historyStudents.length > 10 && (
                      <small className="text-muted ms-2">
                        ({historyStudents.length} sinh viên)
                      </small>
                    )}
                  </h5>
                </div>
                <div className="card-body">
                  {historyLoading ? (
                    <div className="text-center py-3">
                      <Spinner animation="border" size="sm" className="me-2" />
                      <span>Đang tải...</span>
                    </div>
                  ) : historyStudents.length === 0 ? (
                    <div className="modern-alert modern-alert-info">
                      <Info className="me-2" size={18} />
                      Không có sinh viên nào trong buổi học này
                    </div>
                  ) : (
                    <div 
                      className="list-group" 
                      style={{ 
                        maxHeight: historyStudents.length > 10 ? '400px' : 'auto',
                        overflowY: historyStudents.length > 10 ? 'auto' : 'visible'
                      }}
                    >
                      {historyStudents.map((student) => {
                        const isDutyStudent = (() => {
                          try {
                            if (session.monitoring_options) {
                              const config = typeof session.monitoring_options === 'string' 
                                ? JSON.parse(session.monitoring_options) 
                                : session.monitoring_options;
                              
                              if (config?.attendance?.during_session?.duty_students) {
                                return config.attendance.during_session.duty_students.some(dutyStudent => 
                                  dutyStudent.id === student.id || dutyStudent.student_id === student.username
                                );
                              }
                            }
                          } catch (error) {
                            console.error('Error checking duty student:', error);
                          }
                          return false;
                        })();

                        return (
                          <button
                            key={student.id}
                            className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${selectedHistoryStudent && selectedHistoryStudent.id === student.id ? 'active' : ''}`}
                            onClick={() => handleSelectHistoryStudent(student)}
                          >
                            <div>
                              <div className="fw-bold d-flex align-items-center">
                                <span>{student.full_name}</span>
                                {isDutyStudent && (
                                  <Badge bg="info" className="ms-2 modern-badge" style={{ fontSize: '0.6rem' }}>
                                    <Users size={10} className="me-1" />
                                    Ra ca trực
                                  </Badge>
                                )}
                              </div>
                              <small>{student.username}</small>
                            </div>
                            {student.attendance && (
                              <Badge bg="success" className="modern-badge" pill>
                                <CheckCircle size={14} />
                              </Badge>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="col-md-8">
              {selectedHistoryStudent ? (
                <div className="modern-card">
                  <div className="card-header">
                    <div className="d-flex justify-content-between align-items-center">
                      <h5 className="mb-0 fw-bold">{selectedHistoryStudent.full_name}</h5>
                      <small className="text-muted">{selectedHistoryStudent.username}</small>
                    </div>
                  </div>
                  <div className="card-body">
                    <Tabs
                      activeKey={historyActiveTab}
                      onSelect={(k) => setHistoryActiveTab(k)}
                      className="mb-3 custom-tabs"
                    >
                      <Tab eventKey="attendance" title={
                        <span className="tab-title">
                          <CheckCircle size={16} />
                          <span>Điểm danh</span>
                        </span>
                      }>
                        {renderHistoryAttendance()}
                      </Tab>
                      <Tab eventKey="webcam" title={
                        <span className="tab-title">
                          <Camera size={16} />
                          <span>Hình ảnh</span>
                        </span>
                      }>
                        {renderHistoryWebcam}
                      </Tab>
                      <Tab eventKey="files" title={
                        <span className="tab-title">
                          <FileDown size={16} />
                          <span>Tệp tin</span>
                        </span>
                      }>
                        {renderHistoryFiles()}
                      </Tab>
                      <Tab eventKey="activity" title={
                        <span className="tab-title">
                          <Activity size={16} />
                          <span>Hoạt động</span>
                        </span>
                      }>
                        {renderHistoryActivity()}
                      </Tab>
                    </Tabs>
                  </div>
                </div>
              ) : (
                <div className="modern-alert modern-alert-info">
                  <Info className="me-2" size={18} />
                  Vui lòng chọn một sinh viên để xem lịch sử hoạt động
                </div>
              )}
            </div>
          </div>
          
          {/* Webcam Image Modal */}
          <Modal show={showWebcamModal} onHide={() => setShowWebcamModal(false)} size="lg">
            <Modal.Header closeButton>
              <Modal.Title>Hình ảnh webcam</Modal.Title>
            </Modal.Header>
            <Modal.Body className="text-center">
              {selectedImage && (
                <>
                  <div className="modal-image-container">
                    <img 
                      src={selectedImage.data_path ? `/api${selectedImage.data_path.startsWith('/uploads/') ? selectedImage.data_path : `/uploads/${selectedImage.data_path.split('/').pop()}`}` : 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2RkZGRkZCI+PC9yZWN0Pjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBhbGlnbm1lbnQtYmFzZWxpbmU9Im1pZGRsZSIgZmlsbD0iIzk5OTk5OSI+Tm8gaW1hZ2U8L3RleHQ+PC9zdmc+'}
                      alt="Webcam image"
                      className="modal-image"
                      style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: '12px' }}
                      onError={(e) => {
                        if (!e.target.src.includes('data:image/svg+xml')) {
                          e.target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2RkZGRkZCI+PC9yZWN0Pjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBhbGlnbm1lbnQtYmFzZWxpbmU9Im1pZGRsZSIgZmlsbD0iIzk5OTk5OSI+TG9hZCBlcnJvcjwvdGV4dD48L3N2Zz4=';
                          e.target.onerror = null;
                        }
                      }}
                    />
                  </div>
                  <div className="modal-image-info mt-3">
                    <p className="mb-1"><strong>Thời gian:</strong> {formatDateTime(selectedImage.created_at)}</p>
                    {selectedImage.is_profile && <Badge bg="success">Ảnh điểm danh</Badge>}
                    {selectedImage.attendance_type === 'before' && <Badge bg="info" className="ms-2">Trước buổi học</Badge>}
                    {selectedImage.attendance_type === 'during' && <Badge bg="info" className="ms-2">Trong buổi học</Badge>}
                    {selectedImage.attendance_type === 'after' && <Badge bg="info" className="ms-2">Sau buổi học</Badge>}
                  </div>
                </>
              )}
            </Modal.Body>
          </Modal>
        </Tab>
      </Tabs>
    </div>
  );
};

export default SessionDetail;

// Add CSS for recalled files and history styles
const historyStyle = document.createElement('style');
historyStyle.textContent = `
  .file-recalled {
    opacity: 0.6;
    background-color: #f8f9fa !important;
    border-left: 4px solid #6c757d !important;
  }
  
  .file-recalled .fw-bold {
    text-decoration: line-through;
  }
  
  .file-recalled td {
    text-decoration: line-through;
  }
  
  .highlight-file {
    background-color: #fff3cd !important;
    border: 2px solid #ffc107 !important;
    animation: highlight-pulse 0.5s ease-in-out 3;
  }
  
  @keyframes highlight-pulse {
    0% { background-color: #fff3cd; }
    50% { background-color: #ffeaa7; }
    100% { background-color: #fff3cd; }
  }
  
  /* Custom scrollbar for student list */
  .list-group::-webkit-scrollbar {
    width: 6px;
  }
  .list-group::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 3px;
  }
  .list-group::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 3px;
  }
  .list-group::-webkit-scrollbar-thumb:hover {
    background: #a8a8a8;
  }
`;
document.head.appendChild(historyStyle);