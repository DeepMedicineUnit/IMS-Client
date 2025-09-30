import React, { useState, useEffect, useRef } from 'react';
import { Card, Row, Col, Button, Alert, Form, Spinner, Modal } from 'react-bootstrap';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Webcam from 'react-webcam';
import { toast } from 'react-toastify';
import io from 'socket.io-client';
import axios from 'axios';
import '../../styles/modern-ui.css';

const MonitoringPage = () => {
  const { id } = useParams();
  const { api } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [session, setSession] = useState(null);
  const [isAttended, setIsAttended] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [attendanceData, setAttendanceData] = useState(null);
  
  // Refs
  const webcamRef = useRef(null);
  const audioRef = useRef(null);
  const socketRef = useRef(null);
  
  // Geofence state
  const [isWithinGeofence, setIsWithinGeofence] = useState(true);
  const [showGeofenceWarning, setShowGeofenceWarning] = useState(false);
  const [geofenceViolationCount, setGeofenceViolationCount] = useState(0);
  const geofenceIntervalRef = useRef(null);
  
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
  const checkWithinGeofence = (userLocation, geofence) => {
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
  
  // Start geofence monitoring
  const startGeofenceMonitoring = () => {
    // Only start if geofence is enabled
    if (!session?.monitoring_options?.location?.enabled || 
        !session?.monitoring_options?.location?.geofence?.enabled) {
      return;
    }
    
    // Check geofence every minute
    const checkInterval = Math.min(
      (session.monitoring_options?.location?.interval || 120) * 1000,
      60000 // Maximum 1 minute
    );
    
    geofenceIntervalRef.current = setInterval(() => {
      checkGeofenceStatus();
    }, checkInterval);
    
    // Initial check
    checkGeofenceStatus();
  };
  
  // Check geofence status
  const checkGeofenceStatus = () => {
    if (!session?.monitoring_options?.location?.enabled || 
        !session?.monitoring_options?.location?.geofence?.enabled) {
      return;
    }
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          
          const withinGeofence = checkWithinGeofence(
            userLocation, 
            session.monitoring_options.location.geofence
          );
          
          setIsWithinGeofence(withinGeofence);
          
          if (!withinGeofence) {
            // Increment violation count
            setGeofenceViolationCount(prev => prev + 1);
            
            // Show warning after first violation
            if (!showGeofenceWarning) {
              setShowGeofenceWarning(true);
              toast.warning(`Bạn đang ở ngoài phạm vi cho phép (${session.monitoring_options.location.geofence.radius}m). Vui lòng di chuyển trở lại khu vực buổi học.`);
            }
            
            // If too many violations (3+), force stop monitoring
            if (geofenceViolationCount >= 2) {
              toast.error('Bạn đã ở ngoài phạm vi cho phép quá lâu. Buổi học của bạn sẽ bị kết thúc.');
              stopMonitoring();
              navigate('/student/dashboard');
            }
          } else {
            // Reset if back within geofence
            if (showGeofenceWarning) {
              setShowGeofenceWarning(false);
              setGeofenceViolationCount(0);
              toast.success('Bạn đã trở lại khu vực buổi học.');
            }
          }
        },
        (error) => {
          console.error('Error getting location for geofence check:', error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  };

  // Function to check required permissions
  const checkRequiredPermissions = async (monitoringOptions) => {
    // Check for delayed enforcement permissions
    if (monitoringOptions?.webcam?.required && monitoringOptions?.webcam?.enforcement === 'delayed') {
      setTimeout(async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          // We'll use this stream later, so don't stop it now
        } catch (err) {
          console.error('Error accessing webcam:', err);
          toast.error('Không thể truy cập camera. Buổi học này yêu cầu quyền truy cập camera.');
          // For delayed enforcement, we warn but don't force logout yet
        }
      }, 5 * 60 * 1000); // Check after 5 minutes
    }
    
    if (monitoringOptions?.audio?.required && monitoringOptions?.audio?.enforcement === 'delayed') {
      setTimeout(async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(track => track.stop());
        } catch (err) {
          console.error('Error accessing microphone:', err);
          toast.error('Không thể truy cập microphone. Buổi học này yêu cầu quyền ghi âm.');
        }
      }, 5 * 60 * 1000); // Check after 5 minutes
    }
    
    if (monitoringOptions?.location?.required && monitoringOptions?.location?.enforcement === 'delayed') {
      setTimeout(() => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            () => {},
            (err) => {
              console.error('Error accessing location:', err);
              toast.error('Không thể truy cập vị trí. Buổi học này yêu cầu quyền truy cập vị trí.');
            }
          );
        }
      }, 5 * 60 * 1000); // Check after 5 minutes
    }
  };
  
  // File upload
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileNote, setFileNote] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  
  // Modal
  const [showModal, setShowModal] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  
  // Monitoring settings
  const [monitoringSettings, setMonitoringSettings] = useState({
    webcam: true,
    audio: true,
    location: true,
    activity: true
  });
  
  // Monitoring intervals
  const webcamIntervalRef = useRef(null);
  const audioIntervalRef = useRef(null);
  const locationIntervalRef = useRef(null);
  
  // Auto-refresh intervals
  const sessionDataIntervalRef = useRef(null);
  const attendanceDataIntervalRef = useRef(null);
  const filesDataIntervalRef = useRef(null);
  
  // Auto-refresh indicator
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  
  // Function to fetch session data silently (without loading state)
  const fetchSessionDataSilently = async () => {
    try {
      setIsAutoRefreshing(true);
      const sessionResponse = await api.get(`/sessions/${id}`);
      if (sessionResponse.data.success) {
        const sessionData = sessionResponse.data.data;
        
        // Parse monitoring_options if it's a string
        let parsedSessionData = { ...sessionData };
        if (typeof sessionData.monitoring_options === 'string') {
          try {
            parsedSessionData.monitoring_options = JSON.parse(sessionData.monitoring_options);
          } catch (error) {
            console.error('Error parsing monitoring_options:', error);
            parsedSessionData.monitoring_options = null;
          }
        }
        
        // Update session state silently
        setSession(prevSession => ({
          ...prevSession,
          ...parsedSessionData,
          students: parsedSessionData.students || prevSession?.students,
          class_students: parsedSessionData.class_students || prevSession?.class_students
        }));
      }
    } catch (error) {
      console.error('Error fetching session data silently:', error);
    } finally {
      setIsAutoRefreshing(false);
    }
  };

  // Function to fetch attendance data silently
  const fetchAttendanceDataSilently = async () => {
    try {
      const attendanceResponse = await api.get(`/sessions/${id}/attendance`);
      if (attendanceResponse.data.success) {
        setIsAttended(attendanceResponse.data.data.attended);
        setAttendanceData(attendanceResponse.data.data);
      }
    } catch (error) {
      console.error('Error fetching attendance data silently:', error);
    }
  };

  // Function to fetch files data silently
  const fetchFilesDataSilently = async () => {
    try {
      const filesResponse = await api.get(`/monitoring/files/${id}`);
      if (filesResponse.data.success) {
        setUploadedFiles(filesResponse.data.data);
      }
    } catch (error) {
      console.error('Error fetching files data silently:', error);
    }
  };

  // Get session details and check attendance
  useEffect(() => {
    const fetchSessionData = async () => {
      try {
        setLoading(true);
        
        // Get session details
        const sessionResponse = await api.get(`/sessions/${id}`);
        if (!sessionResponse.data.success) {
          throw new Error(sessionResponse.data.message || 'Không thể tải thông tin buổi học');
        }
        
        const sessionData = sessionResponse.data.data;
        
        // Parse monitoring_options if it's a string
        let parsedSessionData = { ...sessionData };
        if (typeof sessionData.monitoring_options === 'string') {
          try {
            parsedSessionData.monitoring_options = JSON.parse(sessionData.monitoring_options);
          } catch (error) {
            console.error('Error parsing monitoring_options:', error);
            parsedSessionData.monitoring_options = null;
          }
        }
        
        setSession(parsedSessionData);
        
        // Check geofence if location monitoring is enabled
        if (parsedSessionData.monitoring_options?.location?.enabled && 
            parsedSessionData.monitoring_options?.location?.geofence?.enabled) {
          
          try {
            // Get current location
            const position = await new Promise((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
              });
            });
            
            const currentLocation = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            };
            
            // Verify geofence with server
            const geofenceResponse = await api.post(`/sessions/${id}/verify-geofence`, {
              location: currentLocation
            });
            
            if (!geofenceResponse.data.success) {
              // If not within geofence, show error and redirect to dashboard
              setError(`Bạn đang ở ngoài phạm vi cho phép (${parsedSessionData.monitoring_options.location.geofence.radius}m). Vui lòng di chuyển đến địa điểm buổi học để tham gia.`);
              toast.error('Không thể tham gia buổi học: Bạn đang ở ngoài phạm vi cho phép.');
              
              // Redirect to dashboard after 3 seconds
              setTimeout(() => {
                navigate('/student/dashboard');
              }, 3000);
              
              return; // Exit function early
            }
          } catch (locError) {
            console.error('Error checking geofence:', locError);
            
            // If location error is from the API (403 status), it's a geofence violation
            if (locError.response?.status === 403) {
              setError(locError.response.data.message || 'Bạn đang ở ngoài phạm vi cho phép của buổi học này.');
              toast.error('Không thể tham gia buổi học: Bạn đang ở ngoài phạm vi cho phép.');
              
              // Redirect to dashboard after 3 seconds
              setTimeout(() => {
                navigate('/student/dashboard');
              }, 3000);
              
              return; // Exit function early
            } else {
              // For other errors, just show a warning but allow continuing
              toast.warning('Không thể xác định vị trí của bạn. Vui lòng cấp quyền truy cập vị trí.');
            }
          }
        }
        
        // Set monitoring settings based on session configuration
        if (parsedSessionData.monitoring_options) {
          // Handle both old format and new detailed format
          if (typeof parsedSessionData.monitoring_options.webcam === 'boolean') {
            // Old format
            setMonitoringSettings({
              webcam: parsedSessionData.monitoring_options.webcam ?? true,
              audio: parsedSessionData.monitoring_options.audio ?? true,
              location: parsedSessionData.monitoring_options.location ?? true,
              activity: true // Always enable activity tracking
            });
          } else {
            // New detailed format
            setMonitoringSettings({
              webcam: parsedSessionData.monitoring_options.webcam?.enabled ?? true,
              audio: parsedSessionData.monitoring_options.audio?.enabled ?? true,
              location: parsedSessionData.monitoring_options.location?.enabled ?? true,
              activity: true // Always enable activity tracking
            });
          }
        }
        
        // Check if already attended
        try {
          console.log('Checking attendance for session:', id);
        const attendanceResponse = await api.get(`/sessions/${id}/attendance`);
          console.log('Attendance response:', attendanceResponse.data);
          
        if (attendanceResponse.data.success) {
          setIsAttended(attendanceResponse.data.data.attended);
            setAttendanceData(attendanceResponse.data.data);
            console.log('Attendance status:', attendanceResponse.data.data.attended);
            console.log('Full attendance data:', JSON.stringify(attendanceResponse.data.data, null, 2));
          
          // Automatically start monitoring since the user is already attended
          if (attendanceResponse.data.data.attended) {
            setTimeout(() => {
              startMonitoring();
            }, 500);
          }
          }
        } catch (attendanceError) {
          console.error('Error checking attendance:', attendanceError);
          // If attendance check fails, assume not attended
          setIsAttended(false);
        }
        
        // Get uploaded files
        const filesResponse = await api.get(`/monitoring/files/${id}`);
        if (filesResponse.data.success) {
          setUploadedFiles(filesResponse.data.data);
        }
        
        // Get all students in the session - try multiple approaches
        console.log('Session data students:', sessionData.students);
        console.log('Session class_id:', sessionData.class_id);
        console.log('Session group_id:', sessionData.group_id);
        
        // Try to get students from multiple sources
        let studentsData = [];
        
        // 1. Try session.students first
        if (sessionData.students && sessionData.students.length > 0) {
          studentsData = sessionData.students;
          console.log('Using students from session data:', studentsData.length);
        }
        
        // 2. Try class students if no session students
        if (studentsData.length === 0 && sessionData.class_id) {
          try {
            console.log('Fetching class students for class_id:', sessionData.class_id);
            const classStudentsResponse = await api.get(`/classes/${sessionData.class_id}/students`);
            if (classStudentsResponse.data.success && classStudentsResponse.data.data) {
              studentsData = classStudentsResponse.data.data;
              console.log('Got class students:', studentsData.length);
            }
          } catch (error) {
            console.error('Error fetching class students:', error);
          }
        }
        
        // 3. Try group students if no students yet
        if (studentsData.length === 0 && sessionData.group_id) {
          try {
            console.log('Fetching group students for group_id:', sessionData.group_id, 'session_id:', id);
            console.log('API URL:', `/sessions/groups/${sessionData.group_id}/members?sessionId=${id}`);
            const groupStudentsResponse = await api.get(`/sessions/groups/${sessionData.group_id}/members?sessionId=${id}`);
            console.log('Group students response:', groupStudentsResponse.data);
            if (groupStudentsResponse.data.success && groupStudentsResponse.data.data) {
              studentsData = groupStudentsResponse.data.data;
              console.log('Got group students with attendance:', studentsData.length);
              console.log('Sample student data:', studentsData[0]);
            } else {
              console.log('No students data in response:', groupStudentsResponse.data);
            }
          } catch (error) {
            console.error('Error fetching group students:', error);
            console.error('Error details:', error.response?.data);
          }
        } else {
          console.log('Skipping group students fetch - studentsData.length:', studentsData.length, 'group_id:', sessionData.group_id);
        }
        
        // 4. Try to get students from session attendance if still no students
        if (studentsData.length === 0) {
          try {
            console.log('Trying to get students from session attendance...');
            const attendanceResponse = await api.get(`/sessions/${id}/attendance`);
            if (attendanceResponse.data.success && attendanceResponse.data.data) {
              // Extract students from attendance data
              const attendanceData = attendanceResponse.data.data;
              if (Array.isArray(attendanceData)) {
                studentsData = attendanceData.map(record => ({
                  id: record.student_id,
                  full_name: record.full_name || record.username,
                  email: record.email,
                  student_id: record.username,
                  class_name: record.class_name,
                  attendance: record.has_attended || false
                }));
                console.log('Got students from session attendance:', studentsData.length);
              }
            }
          } catch (error) {
            console.error('Error fetching session students:', error);
          }
        }
        
        // 5. If still no students, try to get from history API
        if (studentsData.length === 0) {
          try {
            console.log('Trying to get students from history API...');
            // Try to get students from history API (this might work for students)
            const historyResponse = await api.get(`/history/sessions/${id}`);
            if (historyResponse.data.success && historyResponse.data.data) {
              const historyData = historyResponse.data.data;
              if (Array.isArray(historyData)) {
                // Extract unique students from history data
                const studentMap = new Map();
                historyData.forEach(record => {
                  if (record.student_id && !studentMap.has(record.student_id)) {
                    studentMap.set(record.student_id, {
                      id: record.student_id,
                      full_name: record.full_name || record.username,
                      email: record.email,
                      student_id: record.username,
                      class_name: record.class_name,
                      attendance: record.has_attended || false
                    });
                  }
                });
                studentsData = Array.from(studentMap.values());
                console.log('Got students from history API:', studentsData.length);
              }
            }
          } catch (error) {
            console.error('Error fetching history data:', error);
          }
        }
        
        // 6. If still no students, try to get from session data directly
        if (studentsData.length === 0) {
          try {
            console.log('Trying to get students from session data directly...');
            // Try to get session details with students included
            const sessionDetailsResponse = await api.get(`/sessions/${id}`);
            if (sessionDetailsResponse.data.success && sessionDetailsResponse.data.data) {
              const sessionDetails = sessionDetailsResponse.data.data;
              if (sessionDetails.students && Array.isArray(sessionDetails.students)) {
                studentsData = sessionDetails.students;
                console.log('Got students from session details:', studentsData.length);
              }
            }
          } catch (error) {
            console.error('Error fetching session details:', error);
          }
        }
        
        parsedSessionData.class_students = studentsData;
        console.log('Final class_students:', parsedSessionData.class_students);
        console.log('Final studentsData length:', studentsData.length);
        console.log('Setting parsedSessionData.class_students to:', studentsData);
        
        // Update session data state
        setSession(parsedSessionData);
        console.log('Updated session state with class_students:', parsedSessionData.class_students);
        
      } catch (error) {
        console.error('Error fetching session data:', error);
        setError(error.response?.data?.message || 'Không thể tải dữ liệu. Vui lòng thử lại sau.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchSessionData();
    
    // Clean up function
    return () => {
      stopMonitoring();
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh data every 10 seconds
  useEffect(() => {
    if (session && isAttended) {
      // Start auto-refresh intervals
      sessionDataIntervalRef.current = setInterval(() => {
        fetchSessionDataSilently();
      }, 10000); // 10 seconds

      attendanceDataIntervalRef.current = setInterval(() => {
        fetchAttendanceDataSilently();
      }, 10000); // 10 seconds

      filesDataIntervalRef.current = setInterval(() => {
        fetchFilesDataSilently();
      }, 10000); // 10 seconds

      // Clean up intervals on unmount
      return () => {
        if (sessionDataIntervalRef.current) {
          clearInterval(sessionDataIntervalRef.current);
          sessionDataIntervalRef.current = null;
        }
        if (attendanceDataIntervalRef.current) {
          clearInterval(attendanceDataIntervalRef.current);
          attendanceDataIntervalRef.current = null;
        }
        if (filesDataIntervalRef.current) {
          clearInterval(filesDataIntervalRef.current);
          filesDataIntervalRef.current = null;
        }
      };
    }
  }, [session, isAttended, id]);
  
  // Setup socket connection
  useEffect(() => {
    if (session && isAttended && isMonitoring) {
      // Connect to socket
      socketRef.current = io(process.env.REACT_APP_SOCKET_URL || '');
      
      // Join session room
      socketRef.current.emit('join_session', id);
      
      // Clean up on unmount
      return () => {
        if (socketRef.current) {
          socketRef.current.emit('leave_session', id);
          socketRef.current.disconnect();
        }
      };
    }
  }, [session, id, isAttended, isMonitoring]);
  
  // Start monitoring
  const startMonitoring = async () => {
    if (!isAttended) {

      return;
    }
    
    // Check if geofence is enabled and verify location
    if (session.monitoring_options?.location?.enabled && 
        session.monitoring_options?.location?.geofence?.enabled) {
      
      try {
        // Get current location
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          });
        });
        
        const userLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        
        // Check if within geofence
        const withinGeofence = checkWithinGeofence(
          userLocation, 
          session.monitoring_options.location.geofence
        );
        
        if (!withinGeofence) {
          toast.error(`Bạn đang ở ngoài phạm vi cho phép (${session.monitoring_options.location.geofence.radius}m). Không thể bắt đầu giám sát.`);
          return; // Exit function if outside geofence
        }
        
        // Set initial geofence status
        setIsWithinGeofence(true);
        setShowGeofenceWarning(false);
        setGeofenceViolationCount(0);
        
      } catch (error) {
        console.error('Error checking geofence before starting monitoring:', error);
        toast.error('Không thể xác định vị trí của bạn. Vui lòng cấp quyền truy cập vị trí và thử lại.');
        return; // Exit function if can't get location
      }
    }
    
    // Check required permissions
    let canStartMonitoring = true;
    
    // Check webcam permission if required
    if (monitoringSettings.webcam && session.monitoring_options?.webcam?.required) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        // We'll use this stream in webcamRef, so don't stop it
      } catch (err) {
        console.error('Error accessing webcam:', err);
        toast.error('Không thể truy cập camera. Buổi học này yêu cầu quyền truy cập camera.');
        
        if (session.monitoring_options?.webcam?.enforcement === 'immediate') {
          canStartMonitoring = false;
        }
      }
    }
    
    // Check audio permission if required
    if (monitoringSettings.audio && session.monitoring_options?.audio?.required) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Stop the stream as we'll request it again when needed
        stream.getTracks().forEach(track => track.stop());
      } catch (err) {
        console.error('Error accessing microphone:', err);
        toast.error('Không thể truy cập microphone. Buổi học này yêu cầu quyền ghi âm.');
        
        if (session.monitoring_options?.audio?.enforcement === 'immediate') {
          canStartMonitoring = false;
        }
      }
    }
    
    // Check location permission if required
    if (monitoringSettings.location && session.monitoring_options?.location?.required) {
      if (!navigator.geolocation) {
        toast.error('Trình duyệt của bạn không hỗ trợ định vị. Buổi học này yêu cầu quyền truy cập vị trí.');
        
        if (session.monitoring_options?.location?.enforcement === 'immediate') {
          canStartMonitoring = false;
        }
      } else {
        try {
          await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 10000,
              maximumAge: 0
            });
          });
        } catch (err) {
          console.error('Error accessing location:', err);
          toast.error('Không thể truy cập vị trí. Buổi học này yêu cầu quyền truy cập vị trí.');
          
          if (session.monitoring_options?.location?.enforcement === 'immediate') {
            canStartMonitoring = false;
          }
        }
      }
    }
    
    if (!canStartMonitoring) {
      toast.error('Không thể bắt đầu giám sát do thiếu quyền truy cập bắt buộc. Vui lòng cấp quyền và thử lại.');
      return;
    }
    
    setIsMonitoring(true);
    toast.success('Đã bắt đầu giám sát buổi học');
    
    // Start geofence monitoring if location is enabled
    if (monitoringSettings.location && session.monitoring_options?.location?.geofence?.enabled) {
      startGeofenceMonitoring();
    }
    
    // Start webcam capture interval
    if (monitoringSettings.webcam) {
      const webcamInterval = session.monitoring_options?.webcam?.interval 
        ? session.monitoring_options.webcam.interval * 1000 // Convert to milliseconds
        : 30000; // Default: 30 seconds
      
      webcamIntervalRef.current = setInterval(() => {
        captureWebcamImage();
      }, webcamInterval);
      
      // Capture first image immediately
      captureWebcamImage();
      
      // If continuous mode is enabled, setup video streaming
      if (session.monitoring_options?.webcam?.continuous) {
        // In a real implementation, we would setup video streaming here
        console.log('Continuous webcam monitoring enabled');
      }
    }
    
    // Start location tracking
    if (monitoringSettings.location) {
      const locationInterval = session.monitoring_options?.location?.interval 
        ? session.monitoring_options.location.interval * 1000 // Convert to milliseconds
        : 120000; // Default: 2 minutes
      
      sendLocationData();
      locationIntervalRef.current = setInterval(() => {
        sendLocationData();
      }, locationInterval);
    }
    
    // Start activity tracking
    if (monitoringSettings.activity) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('focus', handleWindowFocus);
      window.addEventListener('blur', handleWindowBlur);
    }
  };
  
  // Stop monitoring
  const stopMonitoring = () => {
    setIsMonitoring(false);
    
    // Clear all intervals
    if (webcamIntervalRef.current) {
      clearInterval(webcamIntervalRef.current);
      webcamIntervalRef.current = null;
    }
    
    if (audioIntervalRef.current) {
      clearInterval(audioIntervalRef.current);
      audioIntervalRef.current = null;
    }
    
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
    
    // Clear geofence interval
    if (geofenceIntervalRef.current) {
      clearInterval(geofenceIntervalRef.current);
      geofenceIntervalRef.current = null;
    }
    
    // Clear auto-refresh intervals
    if (sessionDataIntervalRef.current) {
      clearInterval(sessionDataIntervalRef.current);
      sessionDataIntervalRef.current = null;
    }
    
    if (attendanceDataIntervalRef.current) {
      clearInterval(attendanceDataIntervalRef.current);
      attendanceDataIntervalRef.current = null;
    }
    
    if (filesDataIntervalRef.current) {
      clearInterval(filesDataIntervalRef.current);
      filesDataIntervalRef.current = null;
    }
    
    // Remove event listeners
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('focus', handleWindowFocus);
    window.removeEventListener('blur', handleWindowBlur);
    
    // Disconnect socket
    if (socketRef.current) {
      socketRef.current.emit('leave_session', id);
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    // Check for end-of-session required file uploads
    // Only check if session exists and has monitoring options
    if (session && session.monitoring_options?.file_upload?.required && uploadedFiles.length === 0) {
      toast.error('Buổi học này yêu cầu tải lên ít nhất một tệp tin trước khi kết thúc.');
    }
  };
  
  // Capture webcam image
  const captureWebcamImage = async () => {
    if (!webcamRef.current) return;
    
    try {
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) return;
      
      setCapturedImage(imageSrc);
      
      // Convert data URL to blob
      const blob = await fetch(imageSrc).then(r => r.blob());
      const file = new File([blob], `webcam-${Date.now()}.jpg`, { type: 'image/jpeg' });
      
      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sessionId', id);
      formData.append('dataType', 'webcam');
      
      // Upload to server
      await api.post('/monitoring/data', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      // Send to socket for real-time monitoring
      if (socketRef.current) {
        socketRef.current.emit('monitoring_data', {
          sessionId: id,
          type: 'webcam',
          data: imageSrc
        });
      }
      
    } catch (error) {
      console.error('Error capturing webcam image:', error);
    }
  };
  
  // Send location data
  const sendLocationData = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const locationData = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: position.timestamp
            };
            
            await api.post('/monitoring/data/text', {
              sessionId: id,
              dataType: 'location',
              content: JSON.stringify(locationData)
            });
            
            // Send to socket for real-time monitoring
            if (socketRef.current) {
              socketRef.current.emit('monitoring_data', {
                sessionId: id,
                type: 'location',
                data: locationData
              });
            }
            
          } catch (error) {
            console.error('Error sending location data:', error);
          }
        },
        (error) => {
          console.error('Error getting location:', error);
          toast.error('Không thể lấy dữ liệu vị trí. Vui lòng kiểm tra quyền truy cập.');
        }
      );
    }
  };
  
  // Handle visibility change
  const handleVisibilityChange = async () => {
    try {
      await api.post('/monitoring/data/text', {
        sessionId: id,
        dataType: 'activity',
        content: JSON.stringify({
          type: 'visibility',
          state: document.visibilityState,
          timestamp: new Date().toISOString()
        })
      });
      
      // Send to socket for real-time monitoring
      if (socketRef.current) {
        socketRef.current.emit('monitoring_data', {
          sessionId: id,
          type: 'activity',
          data: {
            type: 'visibility',
            state: document.visibilityState,
            timestamp: new Date().toISOString()
          }
        });
      }
    } catch (error) {
      console.error('Error sending visibility data:', error);
    }
  };
  
  // Handle window focus/blur
  const handleWindowFocus = async () => {
    try {
      await api.post('/monitoring/data/text', {
        sessionId: id,
        dataType: 'activity',
        content: JSON.stringify({
          type: 'window',
          state: 'focused',
          timestamp: new Date().toISOString()
        })
      });
    } catch (error) {
      console.error('Error sending window focus data:', error);
    }
  };
  
  const handleWindowBlur = async () => {
    try {
      await api.post('/monitoring/data/text', {
        sessionId: id,
        dataType: 'activity',
        content: JSON.stringify({
          type: 'window',
          state: 'blurred',
          timestamp: new Date().toISOString()
        })
      });
    } catch (error) {
      console.error('Error sending window blur data:', error);
    }
  };
  
  // Handle file selection
  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  // Handle file note change
  const handleFileNoteChange = (e) => {
    setFileNote(e.target.value);
  };
  
  // Upload file
  const handleFileUpload = async () => {
    if (!selectedFile) {
      toast.error('Vui lòng chọn file để tải lên');
      return;
    }
    
    try {
      setUploading(true);
      
      console.log('Uploading file for session ID:', id);
      console.log('Selected file:', selectedFile);
      
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('sessionId', id);
      formData.append('note', fileNote);
      
      // Debug: Log FormData contents
      for (let [key, value] of formData.entries()) {
        console.log('FormData:', key, value);
      }
      
      // Create a separate axios instance for file upload to avoid Content-Type conflicts
      const uploadApi = axios.create({
        baseURL: '/api',
        withCredentials: true
      });
      
      // Add token to the upload request
      const token = localStorage.getItem('token');
      if (token) {
        uploadApi.defaults.headers['x-auth-token'] = token;
      }
      
      const response = await uploadApi.post('/monitoring/file', formData);
      
      if (response.data.success) {
        // Silent success - no toast notification
        setSelectedFile(null);
        setFileNote('');
        
        // Refresh file list silently
        fetchFilesDataSilently();
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error(error.response?.data?.message || 'Không thể tải file lên. Vui lòng thử lại sau.');
    } finally {
      setUploading(false);
    }
  };
  
  // Recall file (hide from download but keep in uploads)
  const handleRecallFile = async (fileId) => {
    if (!window.confirm('Bạn có chắc chắn muốn thu hồi file này? File sẽ không thể tải xuống nữa nhưng vẫn được lưu trữ.')) {
      return;
    }
    
    try {
      const response = await api.put(`/monitoring/file/${fileId}/recall`);
      
      if (response.data.success) {
        // Silent success - no toast notification
        
        // Update file list to show recalled status silently
        setUploadedFiles(uploadedFiles.map(file => 
          file.id === fileId ? { ...file, is_recalled: true } : file
        ));
      }
    } catch (error) {
      console.error('Error recalling file:', error);
      toast.error('Không thể thu hồi file. Vui lòng thử lại sau.');
    }
  };
  
  // Go back to dashboard
  const handleBackToDashboard = () => {
    if (isMonitoring) {
      if (window.confirm('Nếu bạn rời khỏi trang này, quá trình giám sát sẽ bị dừng. Bạn có chắc chắn muốn tiếp tục?')) {
        stopMonitoring();
        navigate('/student/dashboard');
      }
    } else {
      navigate('/student/dashboard');
    }
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

  if (error || !session) {
    return (
      <div className="modern-card">
        <div className="card-header">
          <div className="d-flex align-items-center">
            <i className="fas fa-exclamation-triangle me-2 text-danger"></i>
            <h5 className="mb-0 fw-bold">Không thể tải thông tin buổi học</h5>
          </div>
        </div>
        <div className="card-body">
          <p className="mb-3">{error || 'Có lỗi xảy ra. Vui lòng thử lại sau.'}</p>
        <div className="d-flex justify-content-end">
            <button 
              className="btn-modern" 
              style={{ backgroundColor: '#dc3545' }}
              onClick={() => navigate('/student/dashboard')}
            >
              <i className="fas fa-arrow-left me-2"></i>
            Quay lại Dashboard
            </button>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="modern-card shadow-sm p-4 mb-4">
        <div className="d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center">
            <h2 className="fw-bold mb-1 me-3">Buổi học: {session.title}</h2>
            {isAutoRefreshing && (
              <div className="auto-refresh-indicator">
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
            onClick={handleBackToDashboard}
          >
            <i className="fas fa-arrow-left me-2"></i>
            Quay lại
          </button>
        </div>
      </div>

      {!isAttended ? (
        <div className="modern-alert modern-alert-warning">
          <div className="d-flex align-items-start">
            <i className="fas fa-exclamation-triangle mt-1 me-2"></i>
            <div>
              <h6 className="fw-bold mb-2">Bạn chưa điểm danh cho buổi học này</h6>
              <p className="mb-0">Vui lòng quét mã QR hoặc chọn nút "Điểm danh" để điểm danh trước khi tham gia buổi học.</p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <Row className="mb-4">
            <Col md={8}>
              <div className="modern-card">
                <div className="card-header bg-primary text-white">
                  <div className="d-flex align-items-center">
                    <div className="rounded-circle bg-grey bg-opacity-20 p-2 me-2">
                      <i className="fas fa-info-circle text-grey"></i>
                    </div>
                    <h5 className="mb-0 fw-bold">Thông tin buổi học</h5>
                  </div>
                </div>
                <div className="card-body">
                  <div className="modern-alert modern-alert-success">
                    <div className="d-flex align-items-start">
                      <i className="fas fa-check-circle mt-1 me-2"></i>
                      <div>
                        <h6 className="fw-bold mb-2">Bạn đã tham gia buổi học thành công</h6>
                      </div>
                    </div>
                  </div>
                  
                  {/* Thông tin chi tiết buổi học */}
                  <div className="row mt-4">
                    <div className="col-md-6">
                      <div className="info-section mb-4">
                        <h6 className="fw-bold text-primary mb-3">
                          <i className="fas fa-calendar-alt me-2"></i>
                          Thông tin cơ bản
                        </h6>
                        <div className="info-item mb-2">
                          <strong>Ngày:</strong> {new Date(session.date).toLocaleDateString('vi-VN')}
                        </div>
                        <div className="info-item mb-2">
                          <strong>Giờ bắt đầu:</strong> {session.start_time}
                        </div>
                        <div className="info-item mb-2">
                          <strong>Giờ kết thúc:</strong> {session.end_time}
                        </div>
                        <div className="info-item mb-2">
                          <strong>Địa điểm:</strong> {session.location || 'Chưa cập nhật'}
                        </div>
                        <div className="info-item mb-2">
                          <strong>Lớp:</strong> {session.students && session.students.length > 0 ? session.students[0].class_name || 'Chưa cập nhật' : 'Chưa cập nhật'}
                        </div>
                      </div>
                    </div>
                    
                    <div className="col-md-6">
                      <div className="info-section mb-4">
                        <h6 className="fw-bold text-primary mb-3">
                          <i className="fas fa-clock me-2"></i>
                          Khung giờ điểm danh
                        </h6>
                        
                        {/* Khung giờ hiện tại */}
                        <div className="current-time-section mb-3">
                          <div className="d-flex align-items-center justify-content-between">
                            <span className="fw-bold text-success">Khung giờ điểm danh hiện tại:</span>
                            <span className="badge bg-success">
                              {(() => {
                                const now = new Date();
                                const sessionDate = new Date(session.date);
                                const [startHours, startMinutes] = session.start_time.split(':').map(Number);
                                const [endHours, endMinutes] = session.end_time.split(':').map(Number);
                                
                                const sessionStartTime = new Date(sessionDate);
                                sessionStartTime.setHours(startHours, startMinutes, 0, 0);
                                
                                const sessionEndTime = new Date(sessionDate);
                                sessionEndTime.setHours(endHours, endMinutes, 0, 0);
                                if (sessionEndTime < sessionStartTime) {
                                  sessionEndTime.setDate(sessionEndTime.getDate() + 1);
                                }
                                
                                // Before session window
                                let beforeStart = null;
                                let beforeEnd = null;
                                if (session.monitoring_options?.attendance?.before_session?.enabled) {
                                  beforeStart = new Date(sessionStartTime);
                                  beforeStart.setMinutes(beforeStart.getMinutes() - session.monitoring_options.attendance.before_session.minutes_before);
                                  beforeEnd = new Date(sessionStartTime);
                                }
                                
                                // During session window
                                let duringStart = null;
                                let duringEnd = null;
                                if (session.monitoring_options?.attendance?.during_session?.enabled) {
                                  duringStart = new Date(sessionStartTime);
                                  duringStart.setMinutes(duringStart.getMinutes() + session.monitoring_options.attendance.during_session.minutes_after_start);
                                  duringEnd = new Date(sessionEndTime);
                                  duringEnd.setMinutes(duringEnd.getMinutes() - session.monitoring_options.attendance.during_session.minutes_before_end);
                                }
                                
                                // After session window
                                let afterStart = null;
                                let afterEnd = null;
                                if (session.monitoring_options?.attendance?.after_session?.enabled) {
                                  afterStart = new Date(sessionEndTime);
                                  afterStart.setMinutes(afterStart.getMinutes() + session.monitoring_options.attendance.after_session.minutes_after);
                                  afterEnd = new Date(afterStart);
                                  afterEnd.setMinutes(afterEnd.getMinutes() + session.monitoring_options.attendance.after_session.duration);
                                }
                                
                                // Determine current window
                                if (beforeStart && beforeEnd && now >= beforeStart && now <= beforeEnd) {
                                  return "Trước buổi học";
                                } else if (duringStart && duringEnd && now >= duringStart && now <= duringEnd) {
                                  return "Trong buổi học";
                                } else if (afterStart && afterEnd && now >= afterStart && now <= afterEnd) {
                                  return "Sau buổi học";
                                } else if (now >= sessionStartTime && now < duringStart) {
                                  return "Đi trễ";
                                } else {
                                  return "Ngoài khung giờ";
                                }
                              })()}
                            </span>
                          </div>
                        </div>
                        
                        <div className="attendance-windows">
                          {session.monitoring_options?.attendance?.before_session?.enabled && (
                            <div className="attendance-window mb-2">
                              <div className="d-flex align-items-center justify-content-between">
                                <div className="d-flex align-items-center">
                                  <div className="badge bg-success me-2">Trước</div>
                                  <span className="small">
                                    {(() => {
                                      const sessionDate = new Date(session.date);
                                      const [startHours, startMinutes] = session.start_time.split(':').map(Number);
                                      const sessionStartTime = new Date(sessionDate);
                                      sessionStartTime.setHours(startHours, startMinutes, 0, 0);
                                      const beforeStart = new Date(sessionStartTime);
                                      beforeStart.setMinutes(beforeStart.getMinutes() - session.monitoring_options.attendance.before_session.minutes_before);
                                      return `${beforeStart.getHours().toString().padStart(2, '0')}:${beforeStart.getMinutes().toString().padStart(2, '0')} - ${session.start_time}`;
                                    })()}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                          

                          
                          {session.monitoring_options?.attendance?.during_session?.enabled && (
                            <div className="attendance-window mb-2">
                              <div className="d-flex align-items-center justify-content-between">
                                <div className="d-flex align-items-center">
                                  <div className="badge bg-primary me-2">Trong</div>
                                  <span className="small">
                                    {(() => {
                                      const sessionDate = new Date(session.date);
                                      const [startHours, startMinutes] = session.start_time.split(':').map(Number);
                                      const [endHours, endMinutes] = session.end_time.split(':').map(Number);
                                      const sessionStartTime = new Date(sessionDate);
                                      sessionStartTime.setHours(startHours, startMinutes, 0, 0);
                                      const sessionEndTime = new Date(sessionDate);
                                      sessionEndTime.setHours(endHours, endMinutes, 0, 0);
                                      if (sessionEndTime < sessionStartTime) {
                                        sessionEndTime.setDate(sessionEndTime.getDate() + 1);
                                      }
                                      const duringStart = new Date(sessionStartTime);
                                      duringStart.setMinutes(duringStart.getMinutes() + session.monitoring_options.attendance.during_session.minutes_after_start);
                                      const duringEnd = new Date(sessionEndTime);
                                      duringEnd.setMinutes(duringEnd.getMinutes() - session.monitoring_options.attendance.during_session.minutes_before_end);
                                      return `${duringStart.getHours().toString().padStart(2, '0')}:${duringStart.getMinutes().toString().padStart(2, '0')} - ${duringEnd.getHours().toString().padStart(2, '0')}:${duringEnd.getMinutes().toString().padStart(2, '0')}`;
                                    })()}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {session.monitoring_options?.attendance?.after_session?.enabled && (
                            <div className="attendance-window mb-2">
                              <div className="d-flex align-items-center justify-content-between">
                                <div className="d-flex align-items-center">
                                  <div className="badge bg-info me-2">Sau</div>
                                  <span className="small">
                                    {(() => {
                                      const sessionDate = new Date(session.date);
                                      const [endHours, endMinutes] = session.end_time.split(':').map(Number);
                                      const sessionEndTime = new Date(sessionDate);
                                      sessionEndTime.setHours(endHours, endMinutes, 0, 0);
                                      const afterStart = new Date(sessionEndTime);
                                      afterStart.setMinutes(afterStart.getMinutes() + session.monitoring_options.attendance.after_session.minutes_after);
                                      const afterEnd = new Date(afterStart);
                                      afterEnd.setMinutes(afterEnd.getMinutes() + session.monitoring_options.attendance.after_session.duration);
                                      return `${afterStart.getHours().toString().padStart(2, '0')}:${afterStart.getMinutes().toString().padStart(2, '0')} - ${afterEnd.getHours().toString().padStart(2, '0')}:${afterEnd.getMinutes().toString().padStart(2, '0')}`;
                                    })()}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Danh sách tất cả sinh viên trong lớp */}
                  <div className="info-section mb-4">
                    <h6 className="fw-bold text-primary mb-3">
                      <i className="fas fa-users me-2"></i>
                      Danh sách {session.class_students ? ` (${session.class_students.length})` : ''} sinh viên trong lớp
                    </h6>
                    {(() => {
                      console.log('Render check - session.class_students:', session.class_students);
                      console.log('Render check - length:', session.class_students?.length);
                      return null;
                    })()}
                    {session.class_students && session.class_students.length > 0 ? (
                      <div className="students-grid">
                        {session.class_students.map((student, index) => (
                          <div key={index} className="student-card">
                            <div className="student-avatar">
                              <i className="fas fa-user"></i>
                            </div>
                            <div className="student-info">
                              <div className="student-name">{student.full_name || student.fullName || student.username}</div>
                              <div className="student-email">{student.email}</div>
                              <div className="student-phone">
                                {student.phone || student.student_code || student.username || 'Chưa cập nhật'}
                              </div>
                            </div>
                            <div className="student-status">
                              {student.attendance || student.has_attended ? (
                                <span className="badge bg-success">Đã tham gia</span>
                              ) : (
                                <span className="badge bg-secondary">Chưa tham gia</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center text-muted p-4">
                        <div className="rounded-circle bg-light d-inline-flex align-items-center justify-content-center mb-3" style={{width: '60px', height: '60px'}}>
                          <i className="fas fa-users fa-2x text-muted"></i>
                        </div>
                        <p className="mb-0">Đang tải danh sách sinh viên...</p>
                        <div className="mt-2 small text-info">
                          <p>Debug info:</p>
                          <p>session.class_students: {session.class_students ? 'exists' : 'null'}</p>
                          <p>Length: {session.class_students?.length || 0}</p>
                          <p>session.students: {session.students ? 'exists' : 'null'}</p>
                          <p>session.students length: {session.students?.length || 0}</p>
                          <p>session.class_id: {session.class_id || 'null'}</p>
                          <p>session.group_id: {session.group_id || 'null'}</p>
                          <p>session.group_name: {session.group_name || 'null'}</p>
                          {session.class_students && session.class_students.length > 0 && (
                            <div>
                              <p>Sample student attendance data:</p>
                              <p>First student: {JSON.stringify(session.class_students[0], null, 2)}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Mã QR điểm danh */}
                  {session.shared_qr_code && (
                    <div className="info-section mb-4">
                      <h6 className="fw-bold text-primary mb-3">
                        <i className="fas fa-qrcode me-2"></i>
                        Mã QR điểm danh
                      </h6>
                      <div className="qr-section">
                        <div className="qr-code-container">
                          <div className="qr-code-placeholder">
                            <i className="fas fa-qrcode fa-3x text-muted"></i>
                            <div className="mt-2 small text-muted">QR Code sẽ hiển thị ở đây</div>
                          </div>
                        </div>
                        <div className="qr-info">
                          <div className="qr-token">
                            <strong>Token:</strong> {session.shared_qr_code}
                          </div>
                          <div className="qr-url mt-2">
                            <strong>URL:</strong> 
                            <code className="ms-2 small">
                              {window.location.origin}/session/{session.id}/attend-shared?token={session.shared_qr_code}
                            </code>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Geofence Status Indicator */}
                  {session.monitoring_options?.location?.enabled && 
                   session.monitoring_options?.location?.geofence?.enabled && (
                    <div className={`modern-alert mt-3 ${isWithinGeofence ? 'modern-alert-info' : 'modern-alert-danger'}`}>
                      <div className="d-flex align-items-start">
                        <div className={`rounded-circle me-2 ${isWithinGeofence ? 'bg-info' : 'bg-danger'}`} 
                             style={{width: '12px', height: '12px', marginTop: '4px'}}></div>
                        <div>
                          <h6 className="fw-bold mb-2">
                          {isWithinGeofence 
                            ? 'Bạn đang ở trong khu vực buổi học' 
                            : 'Cảnh báo: Bạn đang ở ngoài khu vực buổi học!'}
                          </h6>
                          <p className="mb-2">
                        {isWithinGeofence 
                          ? `Phạm vi cho phép: ${session.monitoring_options.location.geofence.radius}m` 
                          : `Vui lòng di chuyển trở lại trong phạm vi ${session.monitoring_options.location.geofence.radius}m của buổi học.`}
                          </p>
                      {!isWithinGeofence && (
                            <div className="mt-2">
                          <strong>Cảnh báo:</strong> Nếu bạn tiếp tục ở ngoài khu vực buổi học, hệ thống sẽ tự động kết thúc buổi học của bạn.
                        </div>
                      )}
                        </div>
                      </div>
                    </div>
                  )}
                  </div>
              </div>
            </Col>
            
            <Col md={4}>
              <div className="modern-card">
                <div className="card-header bg-info text-white">
                  <div className="d-flex align-items-center">
                    <div className="rounded-circle bg-grey bg-opacity-20 p-2 me-2">
                      <i className="fas fa-file-upload text-white"></i>
                    </div>
                    <h5 className="mb-0 fw-bold">Tài liệu và file</h5>
                  </div>
                </div>
                <div className="card-body">
                  {session.monitoring_options?.file_upload ? (
                    <>
                      <div className="mb-3">
                        <label className="modern-form-label">Tải lên file (tối đa 50MB)</label>
                        <input 
                          type="file" 
                          className="modern-form-control" 
                          onChange={handleFileChange}
                          disabled={uploading}
                        />
                      </div>
                      
                      {/* Ghi chú chỉ hiển thị khi có file được chọn */}
                      {selectedFile && (
                        <div className="mb-3">
                          <textarea 
                            className="modern-form-control" 
                            rows="3"
                            cols="50"
                            placeholder="Nhập ghi chú cho file này..."
                            value={fileNote}
                            onChange={handleFileNoteChange}
                            disabled={uploading}
                          />
                          <div className="form-text">
                            <i className="fas fa-info-circle me-1"></i>
                            Ghi chú sẽ hiển thị trong lịch sử hoạt động buổi học
                          </div>
                        </div>
                      )}
                      
                      <div className="d-grid mb-4">
                        <button 
                          className="btn-modern" 
                          onClick={handleFileUpload}
                          disabled={!selectedFile || uploading}
                        >
                          {uploading ? (
                            <>
                              <div className="spinner-border spinner-border-sm me-2" role="status">
                                <span className="visually-hidden">Loading...</span>
                              </div>
                              Đang tải lên...
                            </>
                          ) : (
                            <>
                              <i className="fas fa-cloud-upload-alt me-2"></i>
                              Tải lên file
                            </>
                          )}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="modern-alert modern-alert-info mb-4">
                      <div className="d-flex align-items-start">
                        <i className="fas fa-info-circle mt-1 me-2"></i>
                        <div>
                          <h6 className="fw-bold mb-2">Tính năng tải lên tệp tin đã bị tắt</h6>
                          <p className="mb-0">Tính năng tải lên tệp tin đã bị tắt cho buổi học này.</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Header với số lượng file */}
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <h6 className="fw-bold mb-0">
                      <i className="fas fa-folder-open me-2 text-primary"></i>
                      File đã tải lên
                    </h6>
                    <span className="badge bg-primary bg-opacity-10 text-primary px-3 py-2">
                      {uploadedFiles.length} file{uploadedFiles.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  
                  {uploadedFiles.length > 0 ? (
                    <div className="file-grid">
                      {uploadedFiles.map(file => (
                        <div key={file.id} className={`file-card ${file.is_recalled ? 'file-recalled' : ''}`}>
                          {/* File header */}
                          <div className="file-header">
                          <div className="file-icon">
                              <i className={`${getFileIcon(file.file_type)} ${file.is_recalled ? 'text-muted' : 'text-white'}`}></i>
                          </div>
                          <div className="file-actions">
                              <button 
                                className={`btn btn-sm ${file.is_recalled ? 'btn-outline-secondary' : 'btn-outline-primary'}`}
                              onClick={async () => {
                                  if (file.is_recalled) {
                                    toast.warning('File này đã bị thu hồi, không thể tải xuống');
                                    return;
                                  }
                                  
                                try {
                                  const token = localStorage.getItem('token');
                                  const fileUrl = `/api/uploads/${file.file_path.split('/').pop()}`;
                                  
                                  const response = await fetch(fileUrl, {
                                    headers: {
                                      'x-auth-token': token
                                    }
                                  });
                                  
                                  if (!response.ok) {
                                    throw new Error('Không thể tải file');
                                  }
                                  
                                  const blob = await response.blob();
                                  const blobUrl = URL.createObjectURL(blob);
                                  
                                  const link = document.createElement('a');
                                  link.href = blobUrl;
                                  link.download = file.file_name || `file-${file.id}`;
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                  
                                  setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
                                    toast.success('File đã được tải xuống');
                                } catch (error) {
                                  console.error('Lỗi khi tải file:', error);
                                  toast.error('Không thể tải xuống file. Vui lòng thử lại sau.');
                                }
                              }}
                                title={file.is_recalled ? "File đã bị thu hồi" : "Tải xuống file"}
                                disabled={file.is_recalled}
                            >
                              <i className="fas fa-download"></i>
                              </button>
                              
                              {!file.is_recalled && (
                                <button 
                                  className="btn btn-sm btn-outline-warning"
                                  onClick={() => handleRecallFile(file.id)}
                                  title="Thu hồi file"
                                >
                                  <i className="fas fa-undo"></i>
                                </button>
                              )}
                            </div>
                          </div>
                          
                          {/* File info */}
                          <div className="file-info">
                            <div className={`file-name ${file.is_recalled ? 'text-muted' : ''}`}>
                              {file.file_name}
                              {file.is_recalled && (
                                <span className="badge bg-secondary ms-2">
                                  <i className="fas fa-ban me-1"></i>
                                  Đã thu hồi
                                </span>
                              )}
                            </div>
                            
                            <div className="file-meta">
                              <span className="file-size">
                                <i className="fas fa-weight me-1"></i>
                                {formatBytes(file.file_size)}
                              </span>
                              <span className="file-date">
                                <i className="fas fa-clock me-1"></i>
                                {new Date(file.uploaded_at).toLocaleDateString()}
                              </span>
                            </div>
                            
                            {file.note && (
                              <div className="file-note">
                                <i className="fas fa-sticky-note me-2"></i>
                                {file.note}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-muted p-4">
                      <div className="rounded-circle bg-light d-inline-flex align-items-center justify-content-center mb-3" style={{width: '60px', height: '60px'}}>
                        <i className="fas fa-file-upload fa-2x text-muted"></i>
                      </div>
                      <p className="mb-0">Chưa có file nào được tải lên</p>
                    </div>
                  )}
                </div>
              </div>
            </Col>
          </Row>
        </>
      )}
      
      
      {/* Captured image modal (hidden) */}
      <div style={{ display: 'none' }}>
        {capturedImage && <img src={capturedImage} alt="Captured" />}
      </div>
    </div>
  );
};

// Helper function to determine file icon
const getFileIcon = (fileType) => {
  if (!fileType) return 'fas fa-file';
  
  if (fileType.includes('image')) return 'fas fa-file-image';
  if (fileType.includes('pdf')) return 'fas fa-file-pdf';
  if (fileType.includes('word') || fileType.includes('document')) return 'fas fa-file-word';
  if (fileType.includes('excel') || fileType.includes('spreadsheet')) return 'fas fa-file-excel';
  if (fileType.includes('powerpoint') || fileType.includes('presentation')) return 'fas fa-file-powerpoint';
  if (fileType.includes('zip') || fileType.includes('rar') || fileType.includes('tar')) return 'fas fa-file-archive';
  if (fileType.includes('text')) return 'fas fa-file-alt';
  if (fileType.includes('audio')) return 'fas fa-file-audio';
  if (fileType.includes('video')) return 'fas fa-file-video';
  if (fileType.includes('code') || fileType.includes('json') || fileType.includes('xml') || fileType.includes('html')) return 'fas fa-file-code';
  
  return 'fas fa-file';
};

// Helper function to format bytes
const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export default MonitoringPage;

// Add CSS for file grid layout
const style = document.createElement('style');
style.textContent = `
  /* Info Sections */
  .info-section {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 1rem;
    border-left: 4px solid #007bff;
  }
  
  .info-item {
    display: flex;
    align-items: center;
    padding: 0.25rem 0;
  }
  
  .info-item strong {
    min-width: 120px;
    color: #495057;
  }
  
  /* Attendance Windows */
  .attendance-windows {
    background: white;
    border-radius: 6px;
    padding: 0.75rem;
    border: 1px solid #e9ecef;
  }
  
  .attendance-window {
    padding: 0.5rem;
    background: #f8f9fa;
    border-radius: 4px;
    border-left: 3px solid #007bff;
  }
  
  /* Current Time Section */
  .current-time-section {
    background: #e8f5e8;
    border: 1px solid #c3e6c3;
    border-radius: 6px;
    padding: 0.75rem;
  }
  
  /* Attendance Status */
  .attendance-status {
    flex-shrink: 0;
  }
  
  /* Students Grid */
  .students-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
    max-height: 400px;
    overflow-y: auto;
    padding-right: 8px;
  }
  
  .student-card {
    display: flex;
    align-items: center;
    background: white;
    border: 1px solid #e9ecef;
    border-radius: 12px;
    padding: 1rem;
    transition: all 0.3s ease;
    position: relative;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  }
  
  .student-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0,0,0,0.15);
    border-color: #007bff;
  }
  
  .student-avatar {
    width: 45px;
    height: 45px;
    background: linear-gradient(135deg, #007bff, #0056b3);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    margin-right: 1rem;
    flex-shrink: 0;
    font-size: 1.1rem;
  }
  
  .student-info {
    flex: 1;
    min-width: 0;
    padding-right: 0.5rem;
  }
  
  .student-name {
    font-weight: 600;
    color: #2c3e50;
    margin-bottom: 0.25rem;
    font-size: 0.95rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .student-email {
    font-size: 0.85rem;
    color: #6c757d;
    margin-bottom: 0.125rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: flex;
    align-items: center;
  }
  
  .student-email::before {
    content: "📧";
    margin-right: 0.25rem;
    font-size: 0.8rem;
  }
  
  .student-phone {
    font-size: 0.8rem;
    color: #6c757d;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: flex;
    align-items: center;
  }
  
  .student-phone::before {
    content: "📱";
    margin-right: 0.25rem;
    font-size: 0.8rem;
  }
  
  .student-status {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
  }
  
  .student-status .badge {
    font-size: 0.7rem;
    padding: 0.3rem 0.6rem;
    border-radius: 12px;
    font-weight: 500;
  }
  
  .student-status .badge.bg-success {
    background: linear-gradient(135deg, #28a745, #20c997) !important;
  }
  
  .student-status .badge.bg-secondary {
    background: linear-gradient(135deg, #6c757d, #adb5bd) !important;
  }
  
  /* QR Code Section */
  .qr-section {
    display: flex;
    gap: 1rem;
    align-items: flex-start;
  }
  
  .qr-code-container {
    flex-shrink: 0;
  }
  
  .qr-code-placeholder {
    width: 120px;
    height: 120px;
    border: 2px dashed #dee2e6;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #f8f9fa;
  }
  
  .qr-info {
    flex: 1;
    min-width: 0;
  }
  
  .qr-token {
    background: #e9ecef;
    padding: 0.5rem;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.85rem;
    word-break: break-all;
  }
  
  .qr-url code {
    background: #f8f9fa;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.8rem;
    word-break: break-all;
    display: block;
    margin-top: 0.25rem;
  }
  
  /* File Grid Layout */
  .file-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
    margin-bottom: 1rem;
  }
  
  .file-card {
    background: white;
    border: 1px solid #e9ecef;
    border-radius: 12px;
    padding: 1rem;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
  }
  
  .file-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0,0,0,0.1);
    border-color: #007bff;
  }
  
  .file-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }
  
  .file-icon {
    width: 40px;
    height: 40px;
    background: linear-gradient(135deg, #007bff, #0056b3);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 1.2rem;
  }
  
  .file-actions {
    display: flex;
    gap: 0.5rem;
  }
  
  .file-actions .btn {
    width: 32px;
    height: 32px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
  }
  
  .file-info {
    space-y: 0.5rem;
  }
  
  .file-name {
    font-weight: 600;
    font-size: 0.95rem;
    color: #2c3e50;
    margin-bottom: 0.5rem;
    word-break: break-word;
  }
  
  .file-meta {
    display: flex;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }
  
  .file-size, .file-date {
    font-size: 0.8rem;
    color: #6c757d;
    display: flex;
    align-items: center;
  }
  
  .file-note {
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    padding: 0.5rem;
    font-size: 0.85rem;
    color: #495057;
    margin-top: 0.5rem;
  }
  
  /* Recalled file styles */
  .file-card.file-recalled {
    opacity: 0.6;
    background-color: #f8f9fa !important;
    border-color: #6c757d !important;
    position: relative;
  }
  
  .file-card.file-recalled::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: repeating-linear-gradient(
      45deg,
      transparent,
      transparent 10px,
      rgba(108, 117, 125, 0.1) 10px,
      rgba(108, 117, 125, 0.1) 20px
    );
    pointer-events: none;
  }
  
  .file-card.file-recalled .file-icon {
    background: #6c757d;
  }
  
  .file-card.file-recalled .file-name {
    text-decoration: line-through;
    color: #6c757d !important;
  }
  
  .file-card.file-recalled .btn {
    opacity: 0.5;
    cursor: not-allowed !important;
  }
  
  .file-card.file-recalled .btn:hover {
    opacity: 0.5 !important;
  }
  
  .file-card.file-recalled .file-note {
    background-color: #e9ecef !important;
    border-color: #dee2e6 !important;
    color: #6c757d !important;
  }
  
  .file-card.file-recalled:hover {
    transform: none !important;
    box-shadow: none !important;
  }
  
  /* Responsive */
  @media (max-width: 768px) {
    .file-grid {
      grid-template-columns: 1fr;
    }
    
    .file-meta {
      flex-direction: column;
      gap: 0.25rem;
    }
  }
`;
document.head.appendChild(style);
 