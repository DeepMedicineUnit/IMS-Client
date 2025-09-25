import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, Table, Badge, Tabs, Tab, Spinner, Button, Image, Modal, Alert, Row, Col } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import { format, parseISO } from 'date-fns';
import { toast } from 'react-toastify';
import io from 'socket.io-client';
import { Calendar, Clock, MapPin, Users, FileText, ArrowLeft, RefreshCw, Info, CheckCircle, AlertTriangle, XCircle, UserCheck, UserX, Camera, Mic, FileDown, Activity, Play, Download, ExternalLink, Wifi, WifiOff, RotateCcw } from 'lucide-react';

const SessionHistory = () => {
  const { id } = useParams();
  const { api } = useAuth();
  const [session, setSession] = useState(null);
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [activeTab, setActiveTab] = useState('attendance');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [socketConnected, setSocketConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const socketRef = useRef(null);
  
  // Modal states
  const [showWebcamModal, setShowWebcamModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  
  const fetchSessionHistory = async (showLoadingState = true) => {
    try {
      if (showLoadingState) {
        setLoading(true);
      }
      setError('');
      
      // Fetch session details
      const sessionResponse = await api.get(`/sessions/${id}`);
      if (!sessionResponse.data.success) {
        throw new Error(sessionResponse.data.message || 'Không thể tải thông tin buổi học');
      }
      
      setSession(sessionResponse.data.data);
      
      // Fetch student history data
      const historyResponse = await api.get(`/history/sessions/${id}`);
      if (!historyResponse.data.success) {
        throw new Error(historyResponse.data.message || 'Không thể tải lịch sử hoạt động');
      }
      
      const newStudentsData = historyResponse.data.data;
      setStudents(newStudentsData);
      
      // Update selected student data if one is already selected
      if (selectedStudent) {
        const updatedSelectedStudent = newStudentsData.find(student => student.id === selectedStudent.id);
        if (updatedSelectedStudent) {
          setSelectedStudent(updatedSelectedStudent);
        }
      } 
      // Set first student as selected if available and none selected yet
      else if (newStudentsData.length > 0 && !selectedStudent) {
        setSelectedStudent(newStudentsData[0]);
      }
      
      // Update last update time
      setLastUpdate(new Date());
      
    } catch (error) {
      console.error('Error fetching session history:', error);
      setError(error.response?.data?.message || 'Đã xảy ra lỗi khi tải dữ liệu. Vui lòng thử lại sau.');
    } finally {
      if (showLoadingState) {
        setLoading(false);
      }
    }
  };
  
  // Initial data fetch
  useEffect(() => {
    fetchSessionHistory();
  }, [id, api]);
  
  // Set up socket connection for real-time updates
  useEffect(() => {
    // Socket connection options with reconnection settings
    const socketOptions = {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    };
    
    // Create socket connection
    const socket = io(
      process.env.NODE_ENV === 'production' ? 'https://clinical.pctu.edu.vn' : 'http://localhost:5000',
      socketOptions
    );
    
    socketRef.current = socket;
    
    // Connection events
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
    
    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setSocketConnected(false);
    });
    
    socket.on('reconnect', (attemptNumber) => {
      console.log(`Socket reconnected after ${attemptNumber} attempts`);
      setSocketConnected(true);
      
      // Re-join session room after reconnection
      socket.emit('join_session', id);
      
      // Refresh data after reconnection
      fetchSessionHistory(false);
    });
    
    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`Socket reconnection attempt #${attemptNumber}`);
    });
    
    socket.on('reconnect_error', (error) => {
      console.error('Socket reconnection error:', error);
    });
    
    socket.on('reconnect_failed', () => {
      console.error('Socket reconnection failed');
      toast.error('Không thể kết nối lại với máy chủ. Vui lòng làm mới trang.');
    });
    
    // Data update events
    socket.on('monitoring_update', (data) => {
      console.log('Received monitoring update:', data);
      
      // Check if update is for the current session
      if (data.sessionId === id || data.session_id === id) {
        console.log('Updating session history data due to monitoring update');
        toast.info('Đang cập nhật dữ liệu mới...', { autoClose: 1000 });
        fetchSessionHistory(false); // Don't show loading state for auto updates
      }
    });
    
    socket.on('history_update', (data) => {
      console.log('Received history update:', data);
      
      // Check if update is for the current session
      if (data.sessionId === id || data.session_id === id) {
        console.log('Updating session history data due to history update');
        
        // If the update is for the currently selected student, show a notification
        if (selectedStudent && (data.studentId === selectedStudent.id || data.student_id === selectedStudent.id)) {
          toast.info(`Dữ liệu mới từ ${data.studentName || 'sinh viên'}: ${data.type}`, { autoClose: 1500 });
        }
        
        // Refresh data without showing loading state
        fetchSessionHistory(false);
      }
    });
    
    socket.on('session_update', (data) => {
      console.log('Received session update:', data);
      if (data.sessionId === id || data.session_id === id) {
        fetchSessionHistory(false);
      }
    });
    
    // Clean up on unmount
    return () => {
      if (socket) {
        try {
          socket.emit('leave_session', id);
          socket.disconnect();
        } catch (error) {
          console.error('Error during socket cleanup:', error);
        }
      }
    };
  }, [id, selectedStudent]);
  
  // Format date
  const formatDate = (dateString) => {
    try {
      if (!dateString) return '';
      const date = parseISO(dateString);
      return format(date, 'dd/MM/yyyy');
    } catch (error) {
      return dateString;
    }
  };
  
  // Format time
  const formatTime = (timeString) => {
    if (!timeString) return '';
    return timeString;
  };
  
  // Format datetime
  const formatDateTime = (dateTimeString) => {
    try {
      if (!dateTimeString) return '';
      const date = new Date(dateTimeString);
      return format(date, 'dd/MM/yyyy HH:mm:ss');
    } catch (error) {
      return dateTimeString;
    }
  };
  
  // Handle student selection
  const handleSelectStudent = (student) => {
    setSelectedStudent(student);
  };
  
  // Handle webcam image click
  const handleWebcamClick = (image) => {
    setSelectedImage(image);
    setShowWebcamModal(true);
  };
  
  
  // Render attendance history
  const renderAttendanceHistory = () => {
    if (!selectedStudent || (!selectedStudent.attendance && (!selectedStudent.attendanceHistory || selectedStudent.attendanceHistory.length === 0))) {
      return (
        <div className="modern-alert modern-alert-info">
          <Info className="me-2" size={18} />
          Không có dữ liệu điểm danh cho sinh viên này
        </div>
      );
    }
    
    // Hiển thị ghi chú về các trạng thái điểm danh
    const renderAttendanceNote = () => {
      // Determine which attendance types are actually used in the records
      const usedAttendanceTypes = new Set();
      
      // Check records for the selected student
      if (selectedStudent) {
        // Add current attendance type if exists
        if (selectedStudent.attendance?.attendance_type) {
          usedAttendanceTypes.add(selectedStudent.attendance.attendance_type);
        } else if (selectedStudent.attendance) {
          // If attendance exists but no specific type, add generic "present"
          usedAttendanceTypes.add('present');
        }
        
        // Add history attendance types
        if (selectedStudent.attendanceHistory && selectedStudent.attendanceHistory.length > 0) {
          selectedStudent.attendanceHistory.forEach(record => {
            if (record.attendance_type) {
              usedAttendanceTypes.add(record.attendance_type);
            } else {
              // If record exists but no specific type, add generic "present"
              usedAttendanceTypes.add('present');
            }
          });
        }
        
        // If no records at all, mark as "absent"
        if (usedAttendanceTypes.size === 0 && !selectedStudent.attendance) {
          usedAttendanceTypes.add('absent');
        }
      }
      
      // Create explanations array for only the used attendance types
      const explanations = [];
      
      if (usedAttendanceTypes.has('before')) 
        explanations.push({ badge: <Badge bg="success">Có mặt trước</Badge>, text: "Sinh viên điểm danh trước buổi học" });
      
      if (usedAttendanceTypes.has('during')) 
        explanations.push({ badge: <Badge bg="success">Có mặt trong</Badge>, text: "Sinh viên điểm danh trong buổi học" });
      
      if (usedAttendanceTypes.has('after')) 
        explanations.push({ badge: <Badge bg="success">Có mặt sau</Badge>, text: "Sinh viên điểm danh sau buổi học" });
      
      if (usedAttendanceTypes.has('present')) 
        explanations.push({ badge: <Badge bg="success">Có mặt</Badge>, text: "Sinh viên đã điểm danh (không xác định thời điểm)" });
      
      if (usedAttendanceTypes.has('early')) 
        explanations.push({ badge: <Badge bg="info">Đi trước</Badge>, text: "Sinh viên điểm danh sớm hơn thời gian cho phép" });
      
      if (usedAttendanceTypes.has('late')) 
        explanations.push({ badge: <Badge bg="warning">Đi trễ</Badge>, text: "Sinh viên điểm danh muộn so với giờ bắt đầu" });
      
      if (usedAttendanceTypes.has('late_leave')) 
        explanations.push({ badge: <Badge bg="warning">Về trễ</Badge>, text: "Sinh viên điểm danh muộn sau khi buổi học kết thúc" });
      
      if (usedAttendanceTypes.has('absent')) 
        explanations.push({ badge: <Badge bg="danger">Vắng mặt</Badge>, text: "Sinh viên chưa điểm danh" });
      
      // Function to chunk the explanations into columns
      const chunkExplanations = (arr, size) => {
        const result = [];
        for (let i = 0; i < arr.length; i += size) {
          result.push(arr.slice(i, i + size));
        }
        return result;
      };
      
      // Calculate number of items per column (try to balance)
      const chunks = chunkExplanations(explanations, Math.ceil(explanations.length / 3));
      
      return (
        <div className="modern-alert modern-alert-info mb-3">
          <h6 className="mb-2 fw-bold">
            <Info className="me-2" size={18} />
            Giải thích trạng thái điểm danh:
          </h6>
          <Row>
            {chunks.map((chunk, idx) => (
              <Col md={4} key={idx}>
                {chunk.map((item, i) => (
                  <p className="mb-1" key={i}>{item.badge} - {item.text}</p>
                ))}
              </Col>
            ))}
          </Row>
        </div>
      );
    };
    
    // Lấy tất cả các bản ghi điểm danh (hiện tại và lịch sử)
    const allAttendanceRecords = [];
    
    // Thêm bản ghi hiện tại nếu có
    if (selectedStudent.attendance) {
      allAttendanceRecords.push({
        ...selectedStudent.attendance,
        isCurrent: true
      });
    }
    
    // Thêm các bản ghi lịch sử nếu có
    if (selectedStudent.attendanceHistory && selectedStudent.attendanceHistory.length > 0) {
      selectedStudent.attendanceHistory.forEach(record => {
        allAttendanceRecords.push({
          ...record,
          isCurrent: false
        });
      });
    }
    
    // Sắp xếp theo thời gian (mới nhất lên đầu)
    allAttendanceRecords.sort((a, b) => {
      const timeA = new Date(a.timestamp || a.created_at);
      const timeB = new Date(b.timestamp || b.created_at);
      return timeB - timeA;
    });
    
    // Hiển thị badge theo loại điểm danh
    const getAttendanceBadge = (record) => {
      if (!record.attendance_type) return <Badge bg="success">Có mặt</Badge>;
      
      switch (record.attendance_type) {
        case 'before':
          return <Badge bg="success">Có mặt trước</Badge>;
        case 'during':
          return <Badge bg="success">Có mặt trong</Badge>;
        case 'after':
          return <Badge bg="success">Có mặt sau</Badge>;
        case 'early':
          return <Badge bg="info">Đi trước {record.minutes_early || ''} phút</Badge>;
        case 'late':
          return <Badge bg="warning">Đi trễ {record.minutes_late || ''} phút</Badge>;
        case 'late_leave':
          return <Badge bg="warning">Về trễ {record.minutes_late || ''} phút</Badge>;
        case 'absent_perm':
          return <Badge bg="danger">Phép cả buổi</Badge>;
        case 'absent_before_perm':
          return <Badge bg="info">Phép trước buổi</Badge>;
        case 'absent_during_perm':
          return <Badge bg="warning">Phép trong buổi</Badge>;
        case 'absent_after_perm':
          return <Badge bg="secondary">Phép sau buổi</Badge>;
        default:
          return <Badge bg="success">Có mặt</Badge>;
      }
    };
    
    return (
      <>
        {renderAttendanceNote()}
        
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
                    {getAttendanceBadge(record)}
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
      </>
    );
  };
  
  // Render webcam history
  const renderWebcamHistory = () => {
    // Check first for profile image from attendance
    const hasProfileImage = selectedStudent?.attendance?.profile_image;
    
    // Check for regular webcam data
    const hasWebcamData = selectedStudent?.webcam && selectedStudent.webcam.length > 0;
    
    if (!hasProfileImage && !hasWebcamData) {
      return (
        <div className="modern-alert modern-alert-info">
          <Camera className="me-2" size={18} />
          Không có dữ liệu webcam cho sinh viên này
        </div>
      );
    }
    
    // Combine profile image and regular webcam images
    const allImages = [];
    
    // Add regular webcam images first with attendance type from attendance record
    if (hasWebcamData) {
      // Add attendance type information to all webcam images
      const webcamWithAttendanceType = selectedStudent.webcam.map(image => {
        // Clone the image object to avoid modifying the original
        const enhancedImage = { ...image };
        
        // If attendance record exists, assign its type to all images
        if (selectedStudent.attendance) {
          enhancedImage.attendance_type = selectedStudent.attendance.attendance_type;
          enhancedImage.minutes_early = selectedStudent.attendance.minutes_early;
          enhancedImage.minutes_late = selectedStudent.attendance.minutes_late;
        }
        
        // Identify profile image
        const isProfileImage = selectedStudent.attendance && 
                              selectedStudent.attendance.profile_image && 
                              image.data_path === selectedStudent.attendance.profile_image;
        
        // Mark as profile image if matched
        if (isProfileImage) {
          enhancedImage.is_profile = true;
        }
        
        // Add debug log
        console.log('Processed webcam image with attendance type:', enhancedImage.attendance_type);
        
        return enhancedImage;
      });
      
      allImages.push(...webcamWithAttendanceType);
    }
    
    // Add profile image if exists and not already in the webcam data
    if (hasProfileImage) {
      // Check if profile image already exists in webcam data
      const isDuplicate = allImages.some(image => 
        image.data_path === selectedStudent.attendance.profile_image
      );
      
      if (!isDuplicate) {
        // Make sure attendance type and related information is explicitly set
        const attendanceType = selectedStudent.attendance.attendance_type || 'default';
        const minutesEarly = selectedStudent.attendance.minutes_early;
        const minutesLate = selectedStudent.attendance.minutes_late;
        
        allImages.push({
          data_path: selectedStudent.attendance.profile_image,
          created_at: selectedStudent.attendance.timestamp || selectedStudent.attendance.created_at,
          is_profile: true,
          attendance_type: attendanceType,
          minutes_early: minutesEarly,
          minutes_late: minutesLate
        });
        
        console.log('Added profile image with attendance type:', attendanceType);
      } else {
        // Mark the existing image as profile image
        const existingImage = allImages.find(image => 
          image.data_path === selectedStudent.attendance.profile_image
        );
        if (existingImage) {
          // Make sure attendance type and related information is explicitly set
          const attendanceType = selectedStudent.attendance.attendance_type || 'default';
          const minutesEarly = selectedStudent.attendance.minutes_early;
          const minutesLate = selectedStudent.attendance.minutes_late;
          
          existingImage.is_profile = true;
          existingImage.attendance_type = attendanceType;
          existingImage.minutes_early = minutesEarly;
          existingImage.minutes_late = minutesLate;
          
          console.log('Updated existing image as profile with attendance type:', attendanceType);
        }
      }
    }
    
    // Sort by creation time (newest first)
    allImages.sort((a, b) => {
      const timeA = new Date(a.created_at);
      const timeB = new Date(b.created_at);
      return timeB - timeA;
    });
    
    return (
      <div className="webcam-grid">
        {allImages.map((item, index) => (
          <div key={index} className="webcam-item" onClick={() => handleWebcamClick(item)}>
            <div className="webcam-thumbnail">
              <Image 
                src={item.is_profile ? 
                  (item.data_path ? `/api${item.data_path.startsWith('/') ? '' : '/'}${item.data_path.startsWith('/uploads/') ? item.data_path : `/uploads/${item.data_path.split('/').pop()}`}` : '/api/uploads/placeholder.jpg') : 
                  `/api/monitoring/data/${id}/${selectedStudent.id}/webcam?image=${item.id}`
                } 
                thumbnail 
                style={item.is_profile ? { border: '3px solid #28a745' } : {}}
                onError={(e) => {
                  // Log error with source information
                  console.error(`Error loading image: ${e.target.src}`, {
                    imageId: item.id,
                    isProfile: item.is_profile,
                    dataPath: item.data_path,
                    sessionId: id,
                    studentId: selectedStudent.id
                  });
                  
                  // Try to load placeholder image from server
                  e.target.src = '/api/uploads/placeholder.jpg';
                  
                  // Add error class to parent for styling
                  if (e.target.parentElement) {
                    e.target.parentElement.classList.add('image-load-error');
                  }
                  
                  // Add onerror handler to placeholder image in case that fails too
                  e.target.onerror = () => {
                    // If placeholder also fails, use data URI for a simple colored box
                    e.target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2RkZGRkZCI+PC9yZWN0Pjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBhbGlnbm1lbnQtYmFzZWxpbmU9Im1pZGRsZSIgZmlsbD0iIzk5OTk5OSI+TG9hZCBlcnJvcjwvdGV4dD48L3N2Zz4=';
                    e.target.style.opacity = '0.7';
                    e.target.onerror = null; // Remove this handler to prevent infinite loop
                  };
                }}
              />
            </div>
            <div className="webcam-info">
              <small>{formatDateTime(item.created_at)}</small>
              <>
                {item.attendance_type === 'before' && <span className="badge bg-success ms-2">Điểm danh trước buổi học</span>}
                {item.attendance_type === 'during' && <span className="badge bg-success ms-2">Điểm danh trong buổi học</span>}
                {item.attendance_type === 'after' && <span className="badge bg-success ms-2">Điểm danh sau buổi học</span>}
                {item.attendance_type === 'early' && <span className="badge bg-info ms-2">Điểm danh sớm {item.minutes_early} phút</span>}
                {item.attendance_type === 'late' && <span className="badge bg-warning ms-2">Điểm danh trễ {item.minutes_late} phút</span>}
                {item.attendance_type === 'late_leave' && <span className="badge bg-warning ms-2">Điểm danh về trễ {item.minutes_late} phút</span>}
                {!item.attendance_type && <span className="badge bg-success ms-2">Có mặt</span>}
              </>
            </div>
          </div>
        ))}
        
        <style jsx="true">{`
          .webcam-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 15px;
          }
          .webcam-item {
            cursor: pointer;
            transition: transform 0.2s;
          }
          .webcam-item:hover {
            transform: scale(1.05);
          }
          .webcam-info {
            text-align: center;
            margin-top: 5px;
          }
          .image-load-error {
            position: relative;
            background-color: #f8d7da;
            border-radius: 5px;
            overflow: hidden;
          }
          .image-load-error::after {
            content: "⚠️";
            position: absolute;
            top: 5px;
            right: 5px;
            font-size: 16px;
            color: #721c24;
          }
          img.image-load-error {
            border: 1px solid #f5c6cb !important;
          }
        `}</style>
      </div>
    );
  };
  
  
  // Render file history
  const renderFileHistory = () => {
    if (!selectedStudent || !selectedStudent.files || selectedStudent.files.length === 0) {
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
              <th style={{ width: '150px' }}>Thời gian</th>
              <th style={{ width: '200px' }}>Tên tệp</th>
              <th style={{ width: '120px' }}>Loại tệp</th>
              <th style={{ width: '100px' }}>Kích thước</th>
              <th style={{ width: '300px' }}>Ghi chú</th>
              <th style={{ width: '120px' }}>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {selectedStudent.files.map((file, index) => (
              <tr key={index} className={file.is_recalled ? 'file-recalled' : ''}>
                <td style={{ width: '150px' }}>{formatDateTime(file.uploaded_at)}</td>
                <td style={{ width: '200px' }}>
                  <div className={file.is_recalled ? 'text-muted' : ''}>
                    {file.file_name}
                    {file.is_recalled && <span className="badge bg-secondary ms-2">Đã thu hồi</span>}
                  </div>
                </td>
                <td style={{ width: '120px' }} className={file.is_recalled ? 'text-muted' : ''}>{file.file_type || 'Không xác định'}</td>
                <td style={{ width: '100px' }} className={file.is_recalled ? 'text-muted' : ''}>{formatFileSize(file.file_size)}</td>
                <td style={{ width: '300px' }}>
                  {file.note ? (
                    <div className={`${file.is_recalled ? 'text-muted' : 'text-info'}`}>
                      <i className="fas fa-sticky-note me-1"></i>
                      {file.note}
                    </div>
                  ) : (
                    <span className="text-muted">Không có ghi chú</span>
                  )}
                </td>
                <td style={{ width: '120px' }}>
                  {file.is_recalled ? (
                    <div className="text-muted">
                      <i className="fas fa-ban me-1"></i>
                      Không thể tải xuống
                    </div>
                  ) : (
                    <button 
                      className="btn-modern" 
                      style={{ backgroundColor: '#256176', padding: '6px 12px', fontSize: '0.875rem' }}
                      onClick={async () => {
                      try {
                        // Lấy token xác thực
                        const token = localStorage.getItem('token');
                        
                        // Tạo URL đầy đủ cho đường dẫn file trực tiếp từ uploads
                        const fileUrl = `/api/uploads/${file.file_path.split('/').pop()}`;
                        
                        console.log('Đang tải file từ URL:', fileUrl);
                        
                        // Sử dụng fetch với token trong header để lấy file
                        const response = await fetch(fileUrl, {
                          headers: {
                            'x-auth-token': token
                          }
                        });
                        
                        if (!response.ok) {
                          throw new Error('Không thể tải file');
                        }
                        
                        // Chuyển đổi response thành blob
                        const blob = await response.blob();
                        
                        // Tạo URL cho blob
                        const blobUrl = URL.createObjectURL(blob);
                        
                        // Tạo thẻ a tạm thời để tải xuống
                        const link = document.createElement('a');
                        link.href = blobUrl;
                        link.download = file.file_name || `file-${file.id}`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        
                        // Giải phóng URL blob sau khi tải xuống
                        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
                      } catch (error) {
                        console.error('Lỗi khi tải file:', error);
                        toast.error('Không thể tải xuống file. Vui lòng thử lại sau.');
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
  
  // Render activity history
  const renderActivityHistory = () => {
    if (!selectedStudent || !selectedStudent.activity || selectedStudent.activity.length === 0) {
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
            {selectedStudent.activity.map((item, index) => (
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
  
  // Helper function to format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return 'Không xác định';
    
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Byte';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
  };
  
  // Helper function to get activity type name
  const getActivityTypeName = (activity) => {
    if (!activity || !activity.data_type) return 'Không xác định';
    
    switch (activity.data_type) {
      case 'webcam':
        return 'Webcam';
      case 'location':
        return 'Vị trí';
      case 'activity':
        return 'Hoạt động';
      default:
        return activity.data_type;
    }
  };
  
  if (loading) {
    return (
      <div className="text-center my-5">
        <div className="modern-card">
          <div className="card-body text-center py-5">
            <div className="spinner-border text-primary mb-3" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mb-0">Đang tải dữ liệu...</p>
          </div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="modern-card">
        <div className="card-header">
          <div className="d-flex align-items-center">
            <XCircle className="me-2 text-danger" size={24} />
            <h5 className="mb-0 fw-bold">Đã xảy ra lỗi!</h5>
          </div>
        </div>
        <div className="card-body">
          <p className="mb-3">{error}</p>
          <button 
            className="btn-modern" 
            onClick={() => window.location.href = '/admin/sessions'}
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
        <div>
          <h2 className="fw-bold">Lịch sử hoạt động buổi học</h2>
          <div className="d-flex align-items-center mt-2">
            <div className={`connection-status ${socketConnected ? 'connected' : 'disconnected'}`}>
              {socketConnected ? <Wifi className="me-2 text-success" size={16} /> : <WifiOff className="me-2 text-danger" size={16} />}
              <small className="fw-medium">{socketConnected ? 'Đang kết nối trực tuyến' : 'Mất kết nối'}</small>
            </div>
            {lastUpdate && (
              <small className="text-muted ms-3">
                Cập nhật lần cuối: {format(lastUpdate, 'HH:mm:ss')}
              </small>
            )}
            <button 
              className="btn-modern ms-2" 
              style={{ backgroundColor: '#6c757d', padding: '8px 12px' }}
              onClick={() => {
                toast.info('Đang tải lại dữ liệu...');
                fetchSessionHistory(false);
              }}
              title="Làm mới dữ liệu"
            >
              <RotateCcw size={16} />
            </button>
          </div>
          <style jsx="true">{`
            .connection-status {
              display: flex;
              align-items: center;
              font-size: 0.8rem;
            }
            .status-dot {
              width: 8px;
              height: 8px;
              border-radius: 50%;
              margin-right: 5px;
            }
            .connected .status-dot {
              background-color: #28a745;
              box-shadow: 0 0 5px #28a745;
            }
            .disconnected .status-dot {
              background-color: #dc3545;
              box-shadow: 0 0 5px #dc3545;
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
          `}</style>
        </div>
        <button 
          className="btn-modern" 
          style={{ backgroundColor: '#6c757d' }}
          onClick={() => window.location.href = '/admin/sessions'}
        >
          <ArrowLeft size={16} className="me-2" />
          Quay lại danh sách
        </button>
      </div>
      
      {session && (
        <div className="modern-card mb-4">
          <div className="card-header">
            <h5 className="mb-0 fw-bold">{session.title}</h5>
          </div>
          <div className="card-body">
            <Row>
              <Col md={6}>
                <div className="space-y-3">
                  <div className="d-flex align-items-center">
                    <Calendar className="me-2 text-primary" size={18} />
                    <span className="fw-medium">Ngày:</span>
                    <span className="ms-2">{formatDate(session.date)}</span>
                  </div>
                  <div className="d-flex align-items-center">
                    <Clock className="me-2 text-primary" size={18} />
                    <span className="fw-medium">Thời gian:</span>
                    <span className="ms-2">{formatTime(session.start_time)} - {formatTime(session.end_time)}</span>
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
                    <span className="fw-medium">Nhóm:</span>
                    <span className="ms-2">{session.group_name}</span>
                  </div>
                  <div className="d-flex align-items-center">
                    <Users className="me-2 text-primary" size={18} />
                    <span className="fw-medium">Số sinh viên:</span>
                    <span className="ms-2">{session.student_count || 0}</span>
                  </div>
                  <div className="d-flex align-items-center">
                    <span className="fw-medium">Trạng thái:</span>
                    <span className="ms-2">
                      {session.status === 'active' && <Badge bg="success" className="modern-badge">Đang diễn ra</Badge>}
                      {session.status === 'scheduled' && <Badge bg="primary" className="modern-badge">Sắp diễn ra</Badge>}
                      {session.status === 'ended' && <Badge bg="secondary" className="modern-badge">Đã kết thúc</Badge>}
                      {session.status === 'cancelled' && <Badge bg="danger" className="modern-badge">Đã hủy</Badge>}
                    </span>
                  </div>
                </div>
              </Col>
            </Row>
          </div>
        </div>
      )}
      
      <div className="row">
        <div className="col-md-4">
          <div className="modern-card mb-4">
            <div className="card-header">
              <h5 className="mb-0 fw-bold">
                <Users className="me-2" size={20} />
                Danh sách sinh viên
                {students.length > 10 && (
                  <small className="text-muted ms-2">
                    ({students.length} sinh viên - cuộn để xem thêm)
                  </small>
                )}
              </h5>
            </div>
            <div className="card-body">
              {students.length === 0 ? (
                <div className="modern-alert modern-alert-info">
                  <Info className="me-2" size={18} />
                  Không có sinh viên nào trong buổi học này
                </div>
              ) : (
                <div 
                  className="list-group" 
                  style={{ 
                    maxHeight: students.length > 10 ? '400px' : 'auto',
                    overflowY: students.length > 10 ? 'auto' : 'visible'
                  }}
                >
                  {students.map((student) => (
                    <button
                      key={student.id}
                      className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${selectedStudent && selectedStudent.id === student.id ? 'active' : ''}`}
                      onClick={() => handleSelectStudent(student)}
                    >
                      <div>
                        <div className="fw-bold">{student.full_name}</div>
                        <small>{student.username}</small>
                      </div>
                      {student.attendance && (
                        <Badge bg="success" className="modern-badge" pill>
                          <CheckCircle size={14} />
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="col-md-8">
          {selectedStudent ? (
            <div className="modern-card">
              <div className="card-header">
                <div className="d-flex justify-content-between align-items-center">
                  <h5 className="mb-0 fw-bold">{selectedStudent.full_name}</h5>
                  <small className="text-muted">{selectedStudent.username}</small>
                </div>
              </div>
              <div className="card-body">
                <Tabs
                  activeKey={activeTab}
                  onSelect={(k) => setActiveTab(k)}
                  className="mb-3 custom-tabs"
                >
                  <Tab eventKey="attendance" title={
                    <span className="tab-title">
                      <CheckCircle size={16} />
                      <span>Điểm danh</span>
                    </span>
                  }>
                    {renderAttendanceHistory()}
                  </Tab>
                  <Tab eventKey="webcam" title={
                    <span className="tab-title">
                      <Camera size={16} />
                      <span>Hình ảnh</span>
                    </span>
                  }>
                    {renderWebcamHistory()}
                  </Tab>
                  <Tab eventKey="files" title={
                    <span className="tab-title">
                      <FileDown size={16} />
                      <span>Tệp tin</span>
                    </span>
                  }>
                    {renderFileHistory()}
                  </Tab>
                  <Tab eventKey="activity" title={
                    <span className="tab-title">
                      <Activity size={16} />
                      <span>Hoạt động</span>
                    </span>
                  }>
                    {renderActivityHistory()}
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
              <Image 
                src={selectedImage.is_profile ? 
                  (selectedImage.data_path ? `/api${selectedImage.data_path.startsWith('/') ? '' : '/'}${selectedImage.data_path.startsWith('/uploads/') ? selectedImage.data_path : `/uploads/${selectedImage.data_path.split('/').pop()}`}` : '/api/uploads/placeholder.jpg') : 
                  `/api/monitoring/data/${id}/${selectedStudent.id}/webcam?image=${selectedImage.id}`
                }
                fluid 
                onError={(e) => {
                  // Log error with source information
                  console.error(`Error loading image in modal: ${e.target.src}`, {
                    imageId: selectedImage.id,
                    isProfile: selectedImage.is_profile,
                    dataPath: selectedImage.data_path,
                    sessionId: id,
                    studentId: selectedStudent.id
                  });
                  
                  // Try to load placeholder image from server
                  e.target.src = '/api/uploads/placeholder.jpg';
                  
                  // Add error class for styling
                  e.target.classList.add('image-load-error');
                  
                  // Add onerror handler to placeholder image in case that fails too
                  e.target.onerror = () => {
                    // If placeholder also fails, use data URI for a simple colored box
                    e.target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMjAwIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2RkZGRkZCI+PC9yZWN0Pjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBhbGlnbm1lbnQtYmFzZWxpbmU9Im1pZGRsZSIgZmlsbD0iIzk5OTk5OSI+S2jDtG5nIHRo4buDIHThuqNpIGjDrG5oIOG6o25oPC90ZXh0Pjwvc3ZnPg==';
                    e.target.style.opacity = '0.7';
                    e.target.onerror = null; // Remove this handler to prevent infinite loop
                  };
                }}
              />
              <div className="mt-3">
              <h3><Badge bg="success">Ảnh điểm danh</Badge></h3>
                <p><strong>Thời gian:</strong> {formatDateTime(selectedImage.created_at)}</p>
                <div className="mt-2">
                  <p>
                    <strong>Loại điểm danh:</strong>{' '}
                    {selectedImage.attendance_type === 'before' && <Badge bg="success">Trước buổi học</Badge>}
                    {selectedImage.attendance_type === 'during' && <Badge bg="success">Trong buổi học</Badge>}
                    {selectedImage.attendance_type === 'after' && <Badge bg="success">Sau buổi học</Badge>}
                    {selectedImage.attendance_type === 'early' && <Badge bg="info">Sớm {selectedImage.minutes_early} phút</Badge>}
                    {selectedImage.attendance_type === 'late' && <Badge bg="warning">Trễ {selectedImage.minutes_late} phút</Badge>}
                    {selectedImage.attendance_type === 'late_leave' && <Badge bg="warning">Về trễ {selectedImage.minutes_late} phút</Badge>}
                    {!selectedImage.attendance_type && <Badge bg="success">Có mặt</Badge>}
                  </p>
                  {(selectedImage.attendance_type === 'early' || selectedImage.attendance_type === 'late' || selectedImage.attendance_type === 'late_leave') && (
                    <p>
                      <strong>Thời gian {selectedImage.attendance_type === 'early' ? 'sớm' : 'trễ'}:</strong>{' '}
                      {selectedImage.attendance_type === 'early' ? selectedImage.minutes_early : selectedImage.minutes_late} phút
                    </p>
                  )}
                </div>
                <p className="mt-2">
                  <button 
                    className="btn-modern" 
                    style={{ backgroundColor: '#256176', padding: '6px 12px', fontSize: '0.875rem' }}
                    onClick={async () => {
                    try {
                      // Tạo URL đầy đủ - sử dụng API endpoint
                      const imageUrl = selectedImage.is_profile ? 
                        (selectedImage.data_path ? `/api${selectedImage.data_path.startsWith('/') ? '' : '/'}${selectedImage.data_path.startsWith('/uploads/') ? selectedImage.data_path : `/uploads/${selectedImage.data_path.split('/').pop()}`}` : '/api/uploads/placeholder.jpg') : 
                        `/api/monitoring/data/${id}/${selectedStudent.id}/webcam?image=${selectedImage.id}`;
                      const token = localStorage.getItem('token');
                      
                      // Sử dụng fetch với token trong header để lấy hình ảnh
                      const response = await fetch(imageUrl, {
                        headers: {
                          'x-auth-token': token
                        }
                      });
                      
                      if (!response.ok) {
                        throw new Error('Không thể tải hình ảnh');
                      }
                      
                      // Chuyển đổi response thành blob
                      const blob = await response.blob();
                      
                      // Tạo URL cho blob
                      const blobUrl = URL.createObjectURL(blob);
                      
                      // Mở URL trong tab mới
                      window.open(blobUrl, '_blank');
                    } catch (error) {
                      console.error('Lỗi khi tải hình ảnh:', error);
                      toast.error('Không thể tải hình ảnh. Vui lòng thử lại sau.');
                    }
                  }}>
                    <ExternalLink size={14} className="me-1" />
                    Xem ảnh đầy đủ
                  </button>
                </p>
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <button 
            className="btn-modern" 
            style={{ backgroundColor: '#6c757d' }}
            onClick={() => setShowWebcamModal(false)}
          >
            Đóng
          </button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default SessionHistory;

// Add CSS for recalled files
const style = document.createElement('style');
style.textContent = `
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
`;
document.head.appendChild(style);
