import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { Card, Table, Badge, Tabs, Tab, Spinner, Button, Image, Modal, Alert, Row, Col } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import { format, parseISO } from 'date-fns';
import { useAlert } from '../../contexts/AlertContext';
import { Calendar, Clock, MapPin, Users, FileText, ArrowLeft, Info, CheckCircle, AlertTriangle, XCircle, UserCheck, UserX, Camera, Mic, FileDown, Activity, Play, Download, ExternalLink } from 'lucide-react';
import usePageTitle from '../../hooks/usePageTitle';

const SessionHistory = () => {
  usePageTitle('Lịch sử buổi học');
  const { id } = useParams();
  const location = useLocation();
  const { api } = useAuth();
  const { showAlert } = useAlert();
  const [session, setSession] = useState(null);
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [activeTab, setActiveTab] = useState('attendance');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Auto-refresh indicator
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  
  // Debounce timer
  const debounceTimerRef = useRef(null);
  
  // Modal states
  const [showWebcamModal, setShowWebcamModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  
  // Function to refresh all data (session + history)
  const refreshAllData = useCallback(async () => {
    try {
      setIsAutoRefreshing(true);
      
      // Fetch both session and history data in parallel
      const [sessionResponse, historyResponse] = await Promise.all([
        api.get(`/sessions/${id}`),
        api.get(`/history/sessions/${id}`)
      ]);
      
      // Update session data if changed
      if (sessionResponse.data.success) {
        const newSessionData = sessionResponse.data.data;
        setSession(prevSession => {
          if (JSON.stringify(prevSession) !== JSON.stringify(newSessionData)) {
            return newSessionData;
          }
          return prevSession;
        });
      }
      
      // Update history data if changed
      if (historyResponse.data.success) {
        const newStudentsData = historyResponse.data.data;
        
        setStudents(prevStudents => {
          if (JSON.stringify(prevStudents) !== JSON.stringify(newStudentsData)) {
            return newStudentsData;
          }
          return prevStudents;
        });
        
        // Update selected student data if one is already selected
        if (selectedStudent) {
          const updatedSelectedStudent = newStudentsData.find(student => student.id === selectedStudent.id);
          if (updatedSelectedStudent && JSON.stringify(updatedSelectedStudent) !== JSON.stringify(selectedStudent)) {
            setSelectedStudent(updatedSelectedStudent);
          }
        }
      }
    } catch (error) {
      // Error refreshing all data
    } finally {
      setIsAutoRefreshing(false);
    }
  }, [api, id, selectedStudent]);

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
    setLoading(true);
    fetchSessionHistory();
  }, [id, api]);

  // Auto-refresh data every 10 seconds with debounce
  useEffect(() => {
    if (session) {
      // Clear any existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      // Start auto-refresh interval
      const refreshInterval = setInterval(() => {
        // Debounce the refresh to avoid rapid successive calls
        debounceTimerRef.current = setTimeout(() => {
          refreshAllData();
        }, 1000); // 1 second debounce
      }, 10000); // 10 seconds

      // Clean up intervals on unmount
      return () => {
        clearInterval(refreshInterval);
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
      };
    }
  }, [session, id, refreshAllData]);

  // Handle hash navigation to specific file
  useEffect(() => {
    if (location.hash && students.length > 0) {
      const fileId = location.hash.replace('#file-', '');
      
      // Find the student who has this file
      const studentWithFile = students.find(student => 
        student.files && student.files.some(file => file.id == fileId)
      );
      
      if (studentWithFile) {
        setSelectedStudent(studentWithFile);
        setActiveTab('files');
        
        // Scroll to the file after a short delay to ensure DOM is updated
        setTimeout(() => {
          const fileElement = document.getElementById(`file-${fileId}`);
          if (fileElement) {
            fileElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            fileElement.classList.add('highlight-file');
            
            // Remove highlight after 3 seconds
            setTimeout(() => {
              fileElement.classList.remove('highlight-file');
            }, 3000);
          }
        }, 500);
      }
    }
  }, [location.hash, students]);
  
  // Format date
  const formatDate = useCallback((dateString) => {
    try {
      if (!dateString) return '';
      const date = parseISO(dateString);
      return format(date, 'dd/MM/yyyy');
    } catch (error) {
      return dateString;
    }
  }, []);
  
  // Format time
  const formatTime = useCallback((timeString) => {
    if (!timeString) return '';
    return timeString;
  }, []);
  
  // Format datetime
  const formatDateTime = useCallback((dateTimeString) => {
    try {
      if (!dateTimeString) return '';
      
      // Handle different date formats
      let date;
      if (typeof dateTimeString === 'string') {
        // Try parsing as ISO string first
        date = new Date(dateTimeString);
        
        // Check if date is valid
        if (isNaN(date.getTime())) {
          console.warn('Invalid date string:', dateTimeString);
          return dateTimeString; // Return original string if parsing fails
        }
      } else if (dateTimeString instanceof Date) {
        date = dateTimeString;
      } else {
        console.warn('Unsupported date type:', typeof dateTimeString, dateTimeString);
        return String(dateTimeString);
      }
      
      return format(date, 'dd/MM/yyyy HH:mm:ss');
    } catch (error) {
      console.error('Error formatting datetime:', error, 'Input:', dateTimeString);
      return String(dateTimeString || '');
    }
  }, []);
  
  // Handle student selection
  const handleSelectStudent = useCallback((student) => {
    setSelectedStudent(student);
  }, []);
  
  // Handle webcam image click
  const handleWebcamClick = useCallback((image) => {
    setSelectedImage(image);
    setShowWebcamModal(true);
  }, []);
  
  // Memoized computed values to prevent unnecessary re-renders
  const memoizedStudents = useMemo(() => students, [students]);
  const memoizedSelectedStudent = useMemo(() => selectedStudent, [selectedStudent]);
  const memoizedSession = useMemo(() => session, [session]);
  
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
        
        // Check for missing attendance types based on session requirements
        // This is a simplified check - in a real scenario, you'd need session monitoring options
        const hasBeforeAttendance = usedAttendanceTypes.has('before') || usedAttendanceTypes.has('early');
        const hasDuringAttendance = usedAttendanceTypes.has('during');
        const hasAfterAttendance = usedAttendanceTypes.has('after') || usedAttendanceTypes.has('late_leave');
        
        // Add missing attendance types if applicable
        // Note: This is a simplified implementation. In practice, you'd need to check
        // the session's monitoring_options to determine which attendance types are required
        if (hasBeforeAttendance && hasDuringAttendance && !hasAfterAttendance) {
          usedAttendanceTypes.add('missing_after');
        }
        if (hasBeforeAttendance && hasAfterAttendance && !hasDuringAttendance) {
          usedAttendanceTypes.add('missing_during');
        }
        if (hasDuringAttendance && hasAfterAttendance && !hasBeforeAttendance) {
          usedAttendanceTypes.add('missing_before');
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
      
      // Thêm các badge thiếu điểm danh
      if (usedAttendanceTypes.has('missing_before')) 
        explanations.push({ badge: <Badge bg="danger">Thiếu Trước</Badge>, text: "Sinh viên thiếu điểm danh trước buổi học" });
      
      if (usedAttendanceTypes.has('missing_during')) 
        explanations.push({ badge: <Badge bg="danger">Thiếu Trong</Badge>, text: "Sinh viên thiếu điểm danh trong buổi học" });
      
      if (usedAttendanceTypes.has('missing_after')) 
        explanations.push({ badge: <Badge bg="danger">Thiếu Sau</Badge>, text: "Sinh viên thiếu điểm danh sau buổi học" });
      
      // Thêm các badge vắng có phép
      if (usedAttendanceTypes.has('absent_perm')) 
        explanations.push({ badge: <Badge bg="danger">Phép cả buổi</Badge>, text: "Sinh viên vắng cả buổi học có phép" });
      
      if (usedAttendanceTypes.has('absent_before_perm')) 
        explanations.push({ badge: <Badge bg="info">Phép trước buổi</Badge>, text: "Sinh viên vắng điểm danh trước buổi học có phép" });
      
      if (usedAttendanceTypes.has('absent_during_perm')) 
        explanations.push({ badge: <Badge bg="warning">Phép trong buổi</Badge>, text: "Sinh viên vắng điểm danh trong buổi học có phép" });
      
      if (usedAttendanceTypes.has('absent_after_perm')) 
        explanations.push({ badge: <Badge bg="secondary">Phép sau buổi</Badge>, text: "Sinh viên vắng điểm danh sau buổi học có phép" });
      
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
        case 'missing_before':
          return <Badge bg="danger">Thiếu Trước</Badge>;
        case 'missing_during':
          return <Badge bg="danger">Thiếu Trong</Badge>;
        case 'missing_after':
          return <Badge bg="danger">Thiếu Sau</Badge>;
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
  
  // Render webcam history - memoized to prevent unnecessary re-renders
  const renderWebcamHistory = useMemo(() => {
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
    const processedPaths = new Set(); // Track processed image paths to avoid duplicates
    
    // Get attendance info once
    const attendanceInfo = selectedStudent.attendance ? {
      attendance_type: selectedStudent.attendance.attendance_type || 'default',
      minutes_early: selectedStudent.attendance.minutes_early,
      minutes_late: selectedStudent.attendance.minutes_late,
      profile_image: selectedStudent.attendance.profile_image,
      timestamp: selectedStudent.attendance.timestamp || selectedStudent.attendance.created_at
    } : null;
    
    // Add regular webcam images first
    if (hasWebcamData) {
      selectedStudent.webcam.forEach(image => {
        // Skip if already processed
        if (processedPaths.has(image.data_path)) {
          return;
        }
        
        const enhancedImage = { ...image };
        
        // Check if this is the profile image
        const isProfileImage = attendanceInfo && 
                              attendanceInfo.profile_image && 
                              image.data_path === attendanceInfo.profile_image;
        
        if (isProfileImage) {
          // This is the profile image - use attendance info
          enhancedImage.is_profile = true;
          enhancedImage.attendance_type = attendanceInfo.attendance_type;
          enhancedImage.minutes_early = attendanceInfo.minutes_early;
          enhancedImage.minutes_late = attendanceInfo.minutes_late;
        } else {
          // This is a regular webcam image - determine type based on timing
          if (session && image.created_at) {
            const imageTime = new Date(image.created_at);
            const sessionStart = new Date(session.start_time);
            const sessionEnd = new Date(session.end_time);
            
            // Calculate time differences in minutes
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
          enhancedImage.minutes_early = null;
          enhancedImage.minutes_late = null;
        }
        
        // Debug logging
        console.log('Processed webcam image:', {
          imageId: image.id,
          dataPath: image.data_path,
          createdAt: image.created_at,
          isProfile: isProfileImage,
          attendanceType: enhancedImage.attendance_type,
          minutesEarly: enhancedImage.minutes_early,
          minutesLate: enhancedImage.minutes_late,
          sessionStart: session?.start_time,
          sessionEnd: session?.end_time
        });
        
        allImages.push(enhancedImage);
        processedPaths.add(image.data_path);
      });
    }
    
    // Add profile image if it exists and wasn't already added from webcam data
    if (hasProfileImage && !processedPaths.has(attendanceInfo.profile_image)) {
      allImages.push({
        data_path: attendanceInfo.profile_image,
        created_at: attendanceInfo.timestamp,
        is_profile: true,
        attendance_type: attendanceInfo.attendance_type,
        minutes_early: attendanceInfo.minutes_early,
        minutes_late: attendanceInfo.minutes_late
      });
      
      console.log('Added standalone profile image with attendance type:', attendanceInfo.attendance_type);
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
              <img 
                src={(() => {
                  // Priority 1: Use data_path if available (most reliable)
                  if (item.data_path) {
                    const path = item.data_path.startsWith('/') ? item.data_path : `/${item.data_path}`;
                    return `/api${path.startsWith('/uploads/') ? path : `/uploads/${path.split('/').pop()}`}`;
                  }
                  
                  // Priority 2: Use monitoring endpoint only if item.id is valid (> 0)
                  if (item.id && item.id > 0) {
                    return `/api/monitoring/data/${id}/${selectedStudent.id}/webcam?image=${item.id}`;
                  }
                  
                  // Priority 3: Fallback to placeholder
                  return 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2RkZGRkZCI+PC9yZWN0Pjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBhbGlnbm1lbnQtYmFzZWxpbmU9Im1pZGRsZSIgZmlsbD0iIzk5OTk5OSI+Tm8gaW1hZ2U8L3RleHQ+PC9zdmc+';
                })()}
                alt={`Webcam image ${index + 1}`}
                style={item.is_profile ? { border: '3px solid #28a745' } : {}}
                onError={(e) => {
                  // Only log error if not already a fallback image
                  if (!e.target.src.includes('data:image/svg+xml')) {
                    console.error(`Error loading image: ${e.target.src}`, {
                      imageId: item.id,
                      isProfile: item.is_profile,
                      dataPath: item.data_path,
                      sessionId: id,
                      studentId: selectedStudent.id
                    });
                    
                    // Add error class to parent for styling
                    if (e.target.parentElement) {
                      e.target.parentElement.classList.add('image-load-error');
                    }
                    
                    // Use data URI fallback directly (no server request)
                    e.target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2RkZGRkZCI+PC9yZWN0Pjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBhbGlnbm1lbnQtYmFzZWxpbmU9Im1pZGRsZSIgZmlsbD0iIzk5OTk5OSI+TG9hZCBlcnJvcjwvdGV4dD48L3N2Zz4=';
                    if (e.target && e.target.style) {
                      e.target.style.opacity = '0.7';
                    }
                    if (e.target) {
                      e.target.onerror = null; // Remove this handler to prevent infinite loop
                    }
                  }
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
                {item.attendance_type === 'missing_before' && <span className="badge bg-danger ms-2">Thiếu điểm danh trước</span>}
                {item.attendance_type === 'missing_during' && <span className="badge bg-danger ms-2">Thiếu điểm danh trong</span>}
                {item.attendance_type === 'missing_after' && <span className="badge bg-danger ms-2">Thiếu điểm danh sau</span>}
                {!item.attendance_type && <span className="badge bg-success ms-2">Có mặt</span>}
              </>
            </div>
          </div>
        ))}
        
        <style jsx="true">{`
          .webcam-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
            gap: 15px;
          }
          .webcam-item {
            cursor: pointer;
            transition: transform 0.2s;
            display: flex;
            flex-direction: column;
          }
          .webcam-item:hover {
            transform: scale(1.05);
          }
          .webcam-thumbnail {
            position: relative;
            width: 100%;
            aspect-ratio: auto; /* Let the image determine its own aspect ratio */
            overflow: hidden;
            border-radius: 8px;
            background-color: #f8f9fa;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 120px; /* Minimum height to prevent too small images */
          }
          .webcam-thumbnail img {
            max-width: 100%;
            max-height: 100%;
            width: auto;
            height: auto;
            object-fit: contain; /* Show full image without cropping */
            border-radius: 8px;
          }
          .webcam-info {
            text-align: center;
            margin-top: 8px;
            padding: 0 4px;
          }
          .webcam-info small {
            display: block;
            margin-bottom: 4px;
            font-size: 0.75rem;
            color: #6c757d;
          }
          .webcam-info .badge {
            font-size: 0.7rem;
            padding: 0.25em 0.5em;
          }
          .image-load-error {
            position: relative;
            background-color: #f8d7da;
            border-radius: 8px;
            overflow: hidden;
          }
          .image-load-error::after {
            content: "⚠️";
            position: absolute;
            top: 5px;
            right: 5px;
            font-size: 16px;
            color: #721c24;
            z-index: 1;
          }
          img.image-load-error {
            border: 1px solid #f5c6cb !important;
          }
          
          /* Responsive adjustments */
          @media (max-width: 768px) {
            .webcam-grid {
              grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
              gap: 10px;
            }
            .webcam-thumbnail {
              padding-bottom: 75%; /* Keep 4:3 ratio on mobile */
            }
          }
          
          @media (max-width: 480px) {
            .webcam-grid {
              grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
              gap: 8px;
            }
          }
          
          /* Modal image styles */
          .modal-image-container {
            max-width: 100%;
            margin: 0 auto;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          }
          .modal-image {
            width: 100%;
            height: auto;
            max-height: 70vh;
            object-fit: contain; /* Show full image without cropping */
            border-radius: 12px;
          }
        `}</style>
      </div>
    );
  }, [selectedStudent, session, id, handleWebcamClick]);
  
  
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
              <tr key={index} id={`file-${file.id}`} className={file.is_recalled ? 'file-recalled' : ''}>
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
        <div className="d-flex align-items-center">
          <h2 className="mb-0 fw-bold">Lịch sử hoạt động buổi học</h2>
          {isAutoRefreshing && (
            <div className="auto-refresh-indicator ms-3">
              <div className="spinner-border spinner-border-sm text-primary" role="status">
                <span className="visually-hidden">Đang cập nhật...</span>
              </div>
              <span className="ms-2 small text-muted">Đang cập nhật...</span>
            </div>
          )}
        </div>
        <button 
          className="btn-modern" 
          style={{ backgroundColor: '#6c757d' }}
          onClick={() => window.location.href = '/admin/sessions'}
        >
          <ArrowLeft size={16} className="me-2" />
          Quay lại danh sách
        </button>
        
        <style jsx="true">{`
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
                    <span className="ms-2">{session.end_date && session.end_date !== session.date ? 
                      `${formatDate(session.date)} - ${formatDate(session.end_date)}` : 
                      formatDate(session.date)}</span>
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
                    <span className="ms-2">{session.group_names}</span>
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
                <div className="mt-4 pt-3 border-top">
                  <h6 className="fw-bold text-primary mb-3">
                    <Users className="me-2" size={18} />
                    Sinh viên ra ca trực giữa giờ
                  </h6>
                  <div className="row">
                    {dutyStudents.map((student, index) => (
                      <div key={index} className="col-md-6 col-lg-4 mb-2">
                        <div className="d-flex align-items-center p-2 border rounded" style={{ backgroundColor: '#f8f9fa' }}>
                          <div className="me-2">
                            <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style={{ width: '32px', height: '32px', fontSize: '0.8rem' }}>
                              <span className="fw-bold">{student.name ? student.name.charAt(0).toUpperCase() : 'S'}</span>
                            </div>
                          </div>
                          <div>
                            <div className="fw-bold small">{student.name || student.full_name || 'Sinh viên'}</div>
                            <small className="text-muted">MSSV: {student.id || student.student_id || 'N/A'}</small>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}
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
                  {students.map((student) => {
                    // Kiểm tra xem sinh viên có phải là sinh viên ra ca trực không
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
                      className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center ${selectedStudent && selectedStudent.id === student.id ? 'active' : ''}`}
                      onClick={() => handleSelectStudent(student)}
                    >
                      <div>
                        <div className="fw-bold d-flex align-items-center">
                          <span>{student.full_name}</span>
                          {isDutyStudent && (
                            <Badge bg="info" className="ms-2 modern-badge" style={{ fontSize: '0.6rem' }}>
                              <Users size={10} className="me-1" />
                              Ra ca trực giữa giờ 
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
                    {renderWebcamHistory}
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
              <div className="modal-image-container">
                <img 
                  src={(() => {
                    // Priority 1: Use data_path if available (most reliable)
                    if (selectedImage.data_path) {
                      const path = selectedImage.data_path.startsWith('/') ? selectedImage.data_path : `/${selectedImage.data_path}`;
                      return `/api${path.startsWith('/uploads/') ? path : `/uploads/${path.split('/').pop()}`}`;
                    }
                    
                    // Priority 2: Use monitoring endpoint only if selectedImage.id is valid (> 0)
                    if (selectedImage.id && selectedImage.id > 0) {
                      return `/api/monitoring/data/${id}/${selectedStudent.id}/webcam?image=${selectedImage.id}`;
                    }
                    
                    // Priority 3: Fallback to placeholder
                    return 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2RkZGRkZCI+PC9yZWN0Pjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBhbGlnbm1lbnQtYmFzZWxpbmU9Im1pZGRsZSIgZmlsbD0iIzk5OTk5OSI+Tm8gaW1hZ2U8L3RleHQ+PC9zdmc+';
                  })()}
                  alt="Webcam image"
                  className="modal-image"
                  onError={(e) => {
                    // Only log error if not already a fallback image
                    if (!e.target.src.includes('data:image/svg+xml')) {
                      console.error(`Error loading image in modal: ${e.target.src}`, {
                        imageId: selectedImage.id,
                        isProfile: selectedImage.is_profile,
                        dataPath: selectedImage.data_path,
                        sessionId: id,
                        studentId: selectedStudent.id
                      });
                      
                      // Add error class for styling
                      e.target.classList.add('image-load-error');
                      
                      // Use data URI fallback directly (no server request)
                      e.target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2RkZGRkZCI+PC9yZWN0Pjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBhbGlnbm1lbnQtYmFzZWxpbmU9Im1pZGRsZSIgZmlsbD0iIzk5OTk5OSI+TG9hZCBlcnJvcjwvdGV4dD48L3N2Zz4=';
                      if (e.target && e.target.style) {
                        e.target.style.opacity = '0.7';
                      }
                      if (e.target) {
                        e.target.onerror = null; // Remove this handler to prevent infinite loop
                      }
                    }
                  }}
                />
              </div>
              <div className="modal-image-info mt-3">
                <p className="mb-1"><strong>Thời gian:</strong> {formatDateTime(selectedImage.created_at)}</p>
                {selectedImage.is_profile && (
                  <Badge bg="success">Ảnh điểm danh</Badge>
                )}
                {selectedImage.attendance_type && (
                  <>
                    {selectedImage.attendance_type === 'before' && <Badge bg="info" className="ms-2">Điểm danh trước buổi học</Badge>}
                    {selectedImage.attendance_type === 'during' && <Badge bg="info" className="ms-2">Điểm danh trong buổi học</Badge>}
                    {selectedImage.attendance_type === 'after' && <Badge bg="info" className="ms-2">Điểm danh sau buổi học</Badge>}
                  </>
                )}
              </div>
            </>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default SessionHistory;

// Add CSS for recalled files and highlight effect
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
`;
document.head.appendChild(style);
