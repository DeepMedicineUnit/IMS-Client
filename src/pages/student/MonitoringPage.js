import React, { useState, useEffect, useRef } from 'react';
import { Card, Row, Col, Button, Alert, Form, Spinner, Modal } from 'react-bootstrap';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Webcam from 'react-webcam';
import { useAlert } from '../../contexts/AlertContext';
import io from 'socket.io-client';
import axios from 'axios';
import '../../styles/modern-ui.css';
import usePageTitle from '../../hooks/usePageTitle';
import { useTranslation } from 'react-i18next';

const MonitoringPage = () => {
  const { t } = useTranslation();
  usePageTitle(t('monitoringPage.title'));
  const { showAlert } = useAlert();
  const { id } = useParams();
  const { api, currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
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
              showAlert(t('monitoringPage.geofence.outsideRange', { radius: session.monitoring_options.location.geofence.radius }), 'warning');
            }
            
            // If too many violations (3+), force stop monitoring
            if (geofenceViolationCount >= 2) {
              showAlert(t('monitoringPage.geofence.tooLongOutside'), 'danger');
              stopMonitoring();
              navigate('/student/attendance');
            }
          } else {
            // Reset if back within geofence
            if (showGeofenceWarning) {
              setShowGeofenceWarning(false);
              setGeofenceViolationCount(0);
              showAlert(t('monitoringPage.geofence.returnedToArea'), 'success');
            }
          }
        },
        (error) => {
          // Error getting location for geofence check
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
          // Error accessing webcam
          showAlert(t('monitoringPage.monitoring.permissions.cameraRequired'), 'danger');
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
          // Error accessing microphone
          showAlert(t('monitoringPage.monitoring.permissions.microphoneRequired'), 'danger');
        }
      }, 5 * 60 * 1000); // Check after 5 minutes
    }
    
    if (monitoringOptions?.location?.required && monitoringOptions?.location?.enforcement === 'delayed') {
      setTimeout(() => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            () => {},
            (err) => {
              // Error accessing location
              showAlert(t('monitoringPage.monitoring.permissions.locationRequired'), 'danger');
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
  
  // File info display state
  const [showFileInfo, setShowFileInfo] = useState({});
  
  // Toggle file info display
  const toggleFileInfo = (fileId) => {
    setShowFileInfo(prev => ({
      ...prev,
      [fileId]: !prev[fileId]
    }));
  };

  // Helper function to check if current user is a duty student
  const isCurrentUserDutyStudent = () => {
    if (!currentUser || !session?.monitoring_options?.attendance?.during_session?.duty_students) {
      return false;
    }
    
    const dutyStudents = session.monitoring_options.attendance.during_session.duty_students;
    
    // Debug logging
    console.log('Checking duty student status:');
    console.log('Current user:', { id: currentUser.id, student_id: currentUser.student_id, username: currentUser.username });
    console.log('Duty students:', dutyStudents);
    
    const isDuty = dutyStudents.some(dutyStudent => 
      dutyStudent.id === currentUser.id || 
      dutyStudent.student_id === currentUser.id ||
      dutyStudent.student_id === currentUser.student_id || 
      dutyStudent.student_id === currentUser.username ||
      dutyStudent.id === currentUser.student_id
    );
    
    console.log('Is duty student:', isDuty);
    return isDuty;
  };

  // Helper function to check attendance status for each window
  const getAttendanceStatus = (windowType) => {
    if (!attendanceData) {
      return { hasAttended: false, attendanceType: null };
    }

    // API trả về dữ liệu với cấu trúc: { attended: boolean, attendance: record, attendance_history: [...] }
    const currentAttendance = attendanceData.attendance;
    const attendanceHistory = attendanceData.attendance_history || [];
    
    // Tạo array tất cả records (current + history)
    const allRecords = [];
    if (currentAttendance) {
      allRecords.push(currentAttendance);
    }
    allRecords.push(...attendanceHistory);
    
    switch (windowType) {
      case 'before':
        const beforeRecord = allRecords.find(record => 
          record.attendance_type === 'before' || record.attendance_type === 'early' || record.attendance_type === 'late_before'
        );
        return {
          hasAttended: !!beforeRecord,
          attendanceType: beforeRecord?.attendance_type,
          isLate: beforeRecord?.attendance_type === 'late_before',
          minutesLate: beforeRecord?.minutes_late || 0
        };
      
      case 'during':
        return {
          hasAttended: allRecords.some(record => 
            record.attendance_type === 'during'
          ),
          attendanceType: allRecords.find(record => 
            record.attendance_type === 'during'
          )?.attendance_type
        };
      
      case 'after':
        return {
          hasAttended: allRecords.some(record => 
            record.attendance_type === 'after' || record.attendance_type === 'late_leave'
          ),
          attendanceType: allRecords.find(record => 
            record.attendance_type === 'after' || record.attendance_type === 'late_leave'
          )?.attendance_type
        };
      
      default:
        return { hasAttended: false, attendanceType: null };
    }
  };
  
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
            // Error parsing monitoring_options
            parsedSessionData.monitoring_options = null;
          }
        }
        
        // Log duty students for debugging
        if (parsedSessionData.monitoring_options?.attendance?.during_session?.duty_students) {
          console.log('Duty students updated:', parsedSessionData.monitoring_options.attendance.during_session.duty_students);
        }
        
        // Update session state silently - make sure monitoring_options is fully replaced
        setSession(prevSession => ({
          ...prevSession,
          ...parsedSessionData,
          monitoring_options: parsedSessionData.monitoring_options, // Ensure this is replaced, not merged
          students: parsedSessionData.students || prevSession?.students,
          class_students: parsedSessionData.class_students || prevSession?.class_students
        }));
      }
    } catch (error) {
      // Error fetching session data silently
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
      // Error fetching attendance data silently
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
      console.error('Error fetching files data:', error);
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
          throw new Error(sessionResponse.data.message || t('monitoringPage.cannotLoad'));
        }
        
        const sessionData = sessionResponse.data.data;
        
        // Parse monitoring_options if it's a string
        let parsedSessionData = { ...sessionData };
        if (typeof sessionData.monitoring_options === 'string') {
          try {
            parsedSessionData.monitoring_options = JSON.parse(sessionData.monitoring_options);
          } catch (error) {
            // Error parsing monitoring_options
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
              setError(t('monitoringPage.geofence.cannotJoin', { radius: parsedSessionData.monitoring_options.location.geofence.radius }));
              showAlert(t('monitoringPage.geofence.cannotJoinAlert'), 'danger');
              
              // Redirect to dashboard after 3 seconds
              setTimeout(() => {
                navigate('/student/attendance');
              }, 3000);
              
              return; // Exit function early
            }
          } catch (locError) {
            console.error('Error checking geofence:', locError);
            
            // If location error is from the API (403 status), it's a geofence violation
            if (locError.response?.status === 403) {
              setError(locError.response.data.message || t('monitoringPage.geofence.cannotJoinOutside'));
              showAlert(t('monitoringPage.geofence.cannotJoinAlertOutside'), 'danger');
              
              // Redirect to dashboard after 3 seconds
              setTimeout(() => {
                navigate('/student/attendance');
              }, 3000);
              
              return; // Exit function early
            } else {
              // For other errors, just show a warning but allow continuing
              showAlert(t('monitoringPage.geofence.locationPermission'), 'warning');
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
          // Checking attendance for session
        const attendanceResponse = await api.get(`/sessions/${id}/attendance`);
          // Attendance response
          
        if (attendanceResponse.data.success) {
          setIsAttended(attendanceResponse.data.data.attended);
            setAttendanceData(attendanceResponse.data.data);
            // Attendance status
            // Full attendance data
          
          // Automatically start monitoring since the user is already attended
          if (attendanceResponse.data.data.attended) {
            setTimeout(() => {
              startMonitoring();
            }, 500);
          }
          }
        } catch (attendanceError) {
          // Error checking attendance
          // If attendance check fails, assume not attended
          setIsAttended(false);
        }
        
        // Get uploaded files
        const filesResponse = await api.get(`/monitoring/files/${id}`);
        if (filesResponse.data.success) {
          setUploadedFiles(filesResponse.data.data);
        }
        
        // Get all students in the session - try multiple approaches
        // Session data students
        // Session class_id
        // Session group_id
        
        // Try to get students from multiple sources
        let studentsData = [];
        
        // 1. Try session.students first
        if (sessionData.students && sessionData.students.length > 0) {
          studentsData = sessionData.students;
          // Using students from session data
        }
        
        // 2. Try class students if no session students
        if (studentsData.length === 0 && sessionData.class_id) {
          try {
            // Fetching class students for class_id
            const classStudentsResponse = await api.get(`/classes/${sessionData.class_id}/students`);
            if (classStudentsResponse.data.success && classStudentsResponse.data.data) {
              studentsData = classStudentsResponse.data.data;
              // Got class students
            }
          } catch (error) {
            // Error fetching class students
          }
        }
        
        // 3. Try group students if no students yet
        if (studentsData.length === 0 && sessionData.group_id) {
          try {
            // Fetching group students for group_id
            // API URL
            const groupStudentsResponse = await api.get(`/sessions/groups/${sessionData.group_id}/members?sessionId=${id}`);

            if (groupStudentsResponse.data.success && groupStudentsResponse.data.data) {
              studentsData = groupStudentsResponse.data.data;

            } else {

            }
          } catch (error) {
          }
        } else {

        }
        
        // 4. Try to get students from session attendance if still no students
        if (studentsData.length === 0) {
          try {

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

              }
            }
          } catch (error) {

          }
        }
        
        // 5. If still no students, try to get from history API
        if (studentsData.length === 0) {
          try {

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

              }
            }
          } catch (error) {

          }
        }
        
        // 6. If still no students, try to get from session data directly
        if (studentsData.length === 0) {
          try {

            // Try to get session details with students included
            const sessionDetailsResponse = await api.get(`/sessions/${id}`);
            if (sessionDetailsResponse.data.success && sessionDetailsResponse.data.data) {
              const sessionDetails = sessionDetailsResponse.data.data;
              if (sessionDetails.students && Array.isArray(sessionDetails.students)) {
                studentsData = sessionDetails.students;

              }
            }
          } catch (error) {

          }
        }
        
        parsedSessionData.class_students = studentsData;
        
        // Update session data state
        setSession(parsedSessionData);

        
      } catch (error) {
        console.error('Error fetching session data:', error);
        setError(error.response?.data?.message || t('monitoringPage.cannotLoadData'));
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

  // Force reload session data when reload query param changes (from attendance page)
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const reloadParam = searchParams.get('reload');
    
    if (reloadParam && session) {
      // Force reload session data to get updated duty_students list
      console.log('Force reloading session data due to reload parameter');
      fetchSessionDataSilently();
      
      // Clean up the reload parameter from URL
      navigate(`/session/${id}/monitor`, { replace: true });
    }
  }, [location.search]); // eslint-disable-line react-hooks/exhaustive-deps

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
          showAlert(t('monitoringPage.geofence.cannotStart', { radius: session.monitoring_options.location.geofence.radius }), 'danger');
          return; // Exit function if outside geofence
        }
        
        // Set initial geofence status
        setIsWithinGeofence(true);
        setShowGeofenceWarning(false);
        setGeofenceViolationCount(0);
        
      } catch (error) {
        console.error('Error checking geofence before starting monitoring:', error);
        showAlert(t('monitoringPage.geofence.cannotDetermine'), 'danger');
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
        showAlert(t('monitoringPage.monitoring.permissions.cameraRequired'), 'danger');
        
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
        showAlert(t('monitoringPage.monitoring.permissions.microphoneRequired'), 'danger');
        
        if (session.monitoring_options?.audio?.enforcement === 'immediate') {
          canStartMonitoring = false;
        }
      }
    }
    
    // Check location permission if required
    if (monitoringSettings.location && session.monitoring_options?.location?.required) {
      if (!navigator.geolocation) {
        showAlert(t('monitoringPage.monitoring.permissions.locationNotSupported'), 'danger');
        
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
          showAlert(t('monitoringPage.monitoring.permissions.locationRequired'), 'danger');
          
          if (session.monitoring_options?.location?.enforcement === 'immediate') {
            canStartMonitoring = false;
          }
        }
      }
    }
    
    if (!canStartMonitoring) {
      showAlert(t('monitoringPage.monitoring.cannotStart'), 'danger');
      return;
    }
    
    setIsMonitoring(true);
    showAlert(t('monitoringPage.monitoring.started'), 'success');
    
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
      showAlert(t('monitoringPage.monitoring.fileRequired'), 'danger');
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
          showAlert(t('monitoringPage.monitoring.permissions.locationError'), 'danger');
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
  
  // Handle file remove
  const handleFileRemove = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedFile(null);
    setFileNote('');
  };
  
  // Upload file
  const handleFileUpload = async () => {
    if (!selectedFile) {
      showAlert(t('monitoringPage.fileUpload.errors.noFileSelected'), 'danger');
      return;
    }
    
    // Check if session is active and file upload is allowed
    if (!session) {
      showAlert(t('monitoringPage.fileUpload.errors.sessionNotAvailable'), 'danger');
      return;
    }
    
    if (session.status !== 'active') {
      showAlert(t('monitoringPage.fileUpload.errors.sessionNotActive'), 'danger');
      return;
    }
    
    // Check if file upload is allowed - allow if still within the same day
    const now = new Date();
    const sessionDate = new Date(session.date);
    
    // Check if current date is the same as session date (allow upload on the same day)
    const isSameDay = now.toDateString() === sessionDate.toDateString();
    
    if (!isSameDay) {
      showAlert(t('monitoringPage.fileUpload.errors.notSameDay'), 'danger');
      return;
    }
    
    try {
      setUploading(true);
      
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('sessionId', id);
      formData.append('note', fileNote);
      
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
      // Handle specific error cases
      if (error.response?.status === 403) {
        const errorMessage = error.response?.data?.message || '';
        
        if (errorMessage.includes('không thuộc nhóm') || errorMessage.includes('không được phép') || errorMessage.includes('Không có quyền')) {
          showAlert(t('monitoringPage.fileUpload.errors.notInGroup'), 'danger');
        } else if (errorMessage.includes('chưa bắt đầu') || errorMessage.includes('đã kết thúc')) {
          showAlert(t('monitoringPage.fileUpload.errors.sessionEnded'), 'danger');
        } else if (errorMessage.includes('không tìm thấy thông tin sinh viên')) {
          showAlert(t('monitoringPage.fileUpload.errors.studentNotFound'), 'danger');
        } else {
          showAlert(t('monitoringPage.fileUpload.errors.noPermission'), 'danger');
        }
      } else if (error.response?.status === 400) {
        showAlert(error.response?.data?.message || t('monitoringPage.fileUpload.errors.invalidData'), 'danger');
      } else if (error.response?.status === 413) {
        showAlert(t('monitoringPage.fileUpload.errors.fileTooLarge'), 'danger');
      } else {
        showAlert(error.response?.data?.message || t('monitoringPage.fileUpload.errors.uploadFailed'), 'danger');
      }
    } finally {
      setUploading(false);
    }
  };
  
  // Recall file (hide from download but keep in uploads)
  const handleRecallFile = async (fileId) => {
    // Validate fileId
    if (!fileId || fileId === 0 || fileId === null || fileId === undefined) {
      showAlert(t('monitoringPage.fileUpload.recall.invalidId'), 'danger');
      return false;
    }
    
    // Show confirmation dialog
    let confirmed = false;
    try {
      confirmed = window.confirm(t('monitoringPage.fileUpload.recall.confirm'));
    } catch (confirmError) {
      // If confirm fails, show alert and return
      showAlert(t('monitoringPage.fileUpload.recall.confirmError'), 'warning');
      return false;
    }
    
    if (!confirmed) {
      return false;
    }
    
    try {
      const response = await api.put(`/monitoring/file/${fileId}/recall`);
      
      // Check response
      if (response && response.data && response.data.success) {
        showAlert(t('monitoringPage.fileUpload.recall.success'), 'success');
        
        // Update file list to show recalled status using functional update
        setUploadedFiles(prevFiles => {
          if (!Array.isArray(prevFiles)) {
            return prevFiles;
          }
          return prevFiles.map(file => {
            if (file && file.id === fileId) {
              return { ...file, is_recalled: true };
            }
            return file;
          });
        });
        
        return true;
      } else {
        showAlert(t('monitoringPage.fileUpload.recall.invalidResponse'), 'danger');
        return false;
      }
    } catch (error) {
      // Handle different types of errors
      if (error && error.response) {
        const status = error.response.status;
        const message = error.response.data?.message;
        
        if (status === 403) {
          showAlert(message || t('monitoringPage.fileUpload.recall.noPermission'), 'danger');
        } else if (status === 404) {
          showAlert(message || t('monitoringPage.fileUpload.recall.notFound'), 'danger');
        } else if (status === 400) {
          showAlert(message || t('monitoringPage.fileUpload.recall.alreadyRecalled'), 'warning');
        } else {
          showAlert(message || t('monitoringPage.fileUpload.recall.error', { status }), 'danger');
        }
      } else if (error && error.request) {
        showAlert(t('monitoringPage.fileUpload.recall.networkError'), 'danger');
      } else {
        showAlert(t('monitoringPage.fileUpload.recall.genericError'), 'danger');
      }
      
      return false;
    }
  };
  
  // Go back to dashboard
  const handleBackToDashboard = () => {
    if (isMonitoring) {
      if (window.confirm(t('monitoringPage.monitoring.leaveConfirm'))) {
        stopMonitoring();
        navigate('/student/attendance');
      }
    } else {
      navigate('/student/attendance');
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
            <p className="mb-0">{t('monitoringPage.loading')}</p>
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
            <h5 className="mb-0 fw-bold">{t('monitoringPage.cannotLoad')}</h5>
          </div>
        </div>
        <div className="card-body">
          <p className="mb-3">{error || t('monitoringPage.errorOccurred')}</p>
        <div className="d-flex justify-content-end">
            <button 
              className="btn-modern" 
              style={{ backgroundColor: '#dc3545' }}
              onClick={() => navigate('/student/attendance')}
            >
              <i className="fas fa-arrow-left me-2"></i>
            {t('monitoringPage.goBack')}
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
            <h2 className="fw-bold mb-0 text-dark session-title-wrap">{session.title}</h2>
            {isAutoRefreshing && (
              <div className="auto-refresh-indicator">
                <div className="spinner-border spinner-border-sm text-primary" role="status">
                  <span className="visually-hidden">Đang cập nhật...</span>
                </div>
                <span className="ms-2 small text-muted">{t('monitoringPage.updating')}</span>
              </div>
            )}
          </div>
          <button 
            className="btn-modern" 
            style={{ backgroundColor: '#6c757d' }}
            onClick={handleBackToDashboard}
            title={t('monitoringPage.back')}
          >
            <i className="fas fa-arrow-left me-2"></i>
          </button>
        </div>
      </div>

      {!isAttended ? (
        <div className="modern-alert modern-alert-warning">
          <div className="d-flex align-items-start">
            <i className="fas fa-exclamation-triangle mt-1 me-2"></i>
            <div>
              <h6 className="fw-bold mb-2">{t('monitoringPage.notAttended.title')}</h6>
              <p className="mb-0">{t('monitoringPage.notAttended.description')}</p>
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
                    <h5 className="mb-0 fw-bold">{t('monitoringPage.sessionInfo.title')}</h5>
                  </div>
                </div>
                <div className="card-body">
                  <div className="modern-alert modern-alert-success">
                    <div className="d-flex align-items-start">
                      <i className="fas fa-check-circle mt-1 me-2"></i>
                      <div>
                        <h6 className="fw-bold mb-2">{t('monitoringPage.sessionInfo.joinedSuccessfully')}</h6>
                      </div>
                    </div>
                  </div>
                  
                  {/* Thông tin chi tiết buổi học */}
                  <div className="row mt-4">
                    <div className="col-md-6">
                      <div className="info-section mb-4">
                        <h6 className="fw-bold text-primary mb-3">
                          <i className="fas fa-calendar-alt me-2"></i>
                          {t('monitoringPage.sessionInfo.basicInfo')}
                        </h6>
                        <div className="info-item1 mb-2">
                          <strong>{t('monitoringPage.sessionInfo.date')}:</strong> {session.end_date && session.end_date !== session.date ? 
                            `${new Date(session.date).toLocaleDateString('vi-VN')} - ${new Date(session.end_date).toLocaleDateString('vi-VN')}` :
                            new Date(session.date).toLocaleDateString('vi-VN')}
                        </div>
                        <div className="info-item1 mb-2">
                          <strong>{t('monitoringPage.sessionInfo.startTime')}:</strong> {session.start_time}
                        </div>
                        <div className="info-item1 mb-2">
                          <strong>{t('monitoringPage.sessionInfo.endTime')}:</strong> {session.end_time}
                        </div>
                        <div className="info-item1 mb-2">
                          <strong>{t('monitoringPage.sessionInfo.location')}:</strong> {session.location || t('monitoringPage.sessionInfo.notUpdated')}
                        </div>
                        <div className="info-item1 mb-2">
                          <strong>{t('monitoringPage.sessionInfo.class')}:</strong> {session.students && session.students.length > 0 ? session.students[0].class_name || t('monitoringPage.sessionInfo.notUpdated') : t('monitoringPage.sessionInfo.notUpdated')}
                        </div>
                        <div className="info-item1 mb-2">
                          <strong>{t('monitoringPage.sessionInfo.group')}:</strong> {session.group_names || t('monitoringPage.sessionInfo.notUpdated')}
                        </div>
                      </div>
                    </div>
                    
                    <div className="col-md-6">
                      <div className="info-section mb-4">
                        <h6 className="fw-bold text-primary mb-3">
                          <i className="fas fa-clock me-2"></i>
                          {t('monitoringPage.sessionInfo.attendanceWindows')}
                        </h6>
                        
                        {/* Khung giờ hiện tại */}
                        <div className="current-time-section mb-3">
                          <div className="d-flex align-items-center justify-content-between">
                            <span className="fw-bold text-success">{t('monitoringPage.sessionInfo.currentWindow')}</span>
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
                                  return t('monitoringPage.sessionInfo.before');
                                } else if (duringStart && duringEnd && now >= duringStart && now <= duringEnd) {
                                  return t('monitoringPage.sessionInfo.during');
                                } else if (afterStart && afterEnd && now >= afterStart && now <= afterEnd) {
                                  return t('monitoringPage.sessionInfo.after');
                                } else if (now >= sessionStartTime && now < duringStart) {
                                  return t('monitoringPage.sessionInfo.late');
                                } else {
                                  return t('monitoringPage.sessionInfo.outsideWindow');
                                }
                              })()}
                            </span>
                          </div>
                        </div>
                        
                        <div className="attendance-windows">
                          {session.monitoring_options?.attendance?.before_session?.enabled && (() => {
                            const beforeStatus = getAttendanceStatus('before');
                            return (
                              <div className={`attendance-window mb-2 ${beforeStatus.hasAttended ? 'attendance-completed' : 'attendance-pending'}`}>
                                <div className="d-flex align-items-center justify-content-between">
                                  <div className="d-flex align-items-center">
                                    <div className={`badge me-2 ${beforeStatus.hasAttended ? 'bg-success' : 'bg-secondary attendance-pending-badge'}`}>
                                      {beforeStatus.hasAttended ? (
                                        <>
                                          <i className="fas fa-check me-1"></i>
                                          {beforeStatus.isLate ? t('monitoringPage.sessionInfo.lateLabel') : t('monitoringPage.sessionInfo.beforeLabel')}
                                        </>
                                      ) : (
                                        t('monitoringPage.sessionInfo.beforeLabel')
                                      )}
                                    </div>
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
                                  {beforeStatus.hasAttended && (
                                    <div className="attendance-status-icon">
                                      <i className="fas fa-check-circle text-success"></i>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                          
                          {session.monitoring_options?.attendance?.during_session?.enabled && (() => {
                            const duringStatus = getAttendanceStatus('during');
                            return (
                              <div className={`attendance-window mb-2 ${duringStatus.hasAttended ? 'attendance-completed' : 'attendance-pending'}`}>
                                <div className="d-flex align-items-center justify-content-between">
                                  <div className="d-flex align-items-center">
                                    <div className={`badge me-2 ${duringStatus.hasAttended ? 'bg-primary' : 'bg-secondary attendance-pending-badge'}`}>
                                      {duringStatus.hasAttended ? (
                                        <>
                                          <i className="fas fa-check me-1"></i>
                                          {t('monitoringPage.sessionInfo.duringLabel')}
                                        </>
                                      ) : (
                                        t('monitoringPage.sessionInfo.duringLabel')
                                      )}
                                    </div>
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
                                  {duringStatus.hasAttended && (
                                    <div className="attendance-status-icon">
                                      <i className="fas fa-check-circle text-primary"></i>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                          
                          {session.monitoring_options?.attendance?.after_session?.enabled && !isCurrentUserDutyStudent() && (() => {
                            const afterStatus = getAttendanceStatus('after');
                            return (
                              <div className={`attendance-window mb-2 ${afterStatus.hasAttended ? 'attendance-completed' : 'attendance-pending'}`}>
                                <div className="d-flex align-items-center justify-content-between">
                                  <div className="d-flex align-items-center">
                                    <div className={`badge me-2 ${afterStatus.hasAttended ? 'bg-info' : 'bg-secondary attendance-pending-badge'}`}>
                                      {afterStatus.hasAttended ? (
                                        <>
                                          <i className="fas fa-check me-1"></i>
                                          {t('monitoringPage.sessionInfo.afterLabel')}
                                        </>
                                      ) : (
                                        t('monitoringPage.sessionInfo.afterLabel')
                                      )}
                                    </div>
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
                                  {afterStatus.hasAttended && (
                                    <div className="attendance-status-icon">
                                      <i className="fas fa-check-circle text-info"></i>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                          
                          {/* Thông báo cho duty student */}
                          {isCurrentUserDutyStudent() && (
                            <div className="modern-alert modern-alert-info mb-2">
                              <div className="d-flex align-items-start">
                                <i className="fas fa-info-circle mt-1 me-2"></i>
                                <div>
                                  <h6 className="fw-bold mb-2">{t('monitoringPage.dutyStudent.title')}</h6>
                                  <p className="mb-0">{t('monitoringPage.dutyStudent.description')}</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Mã QR điểm danh */}
                  {session.shared_qr_code && (
                    <div className="info-section mb-4">
                      <h6 className="fw-bold text-primary mb-3">
                        <i className="fas fa-qrcode me-2"></i>
                        {t('monitoringPage.sessionInfo.qrCode')}
                      </h6>
                      <div className="qr-section">
                        <div className="qr-code-container">
                          <div className="qr-code-placeholder">
                            <i className="fas fa-qrcode fa-3x text-muted"></i>
                            <div className="mt-2 small text-muted">{t('monitoringPage.sessionInfo.qrCodePlaceholder')}</div>
                          </div>
                        </div>
                        <div className="qr-info">
                          <div className="qr-token">
                            <strong>{t('monitoringPage.sessionInfo.token')}:</strong> {session.shared_qr_code}
                          </div>
                          <div className="qr-url mt-2">
                            <strong>{t('monitoringPage.sessionInfo.url')}:</strong> 
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
                            ? t('monitoringPage.geofence.withinArea')
                            : t('monitoringPage.geofence.outsideArea')}
                          </h6>
                          <p className="mb-2">
                        {isWithinGeofence 
                          ? t('monitoringPage.geofence.allowedRadius', { radius: session.monitoring_options.location.geofence.radius })
                          : t('monitoringPage.geofence.pleaseReturn', { radius: session.monitoring_options.location.geofence.radius })}
                          </p>
                      {!isWithinGeofence && (
                            <div className="mt-2">
                          <strong>{t('common.error')}:</strong> {t('monitoringPage.geofence.warning')}
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
                    <h5 className="mb-0 fw-bold">{t('monitoringPage.fileUpload.title')}</h5>
                  </div>
                </div>
                <div className="card-body">
                  {session.monitoring_options?.file_upload ? (
                    <>
                      <div className="mb-3">
                        <label className="modern-form-label file-upload-label">{t('monitoringPage.fileUpload.uploadLabel')}</label>
                        <div className="file-upload-container">
                          <input 
                            type="file" 
                            id="file-upload"
                            className="file-upload-input" 
                            onChange={handleFileChange}
                            disabled={uploading}
                            accept="*/*"
                          />
                          <label htmlFor="file-upload" className="file-upload-label-custom">
                            <div className="file-upload-icon">
                              <i className="fas fa-cloud-upload-alt"></i>
                            </div>
                            <div className="file-upload-text">
                              <span className="file-upload-title">
                                {selectedFile ? selectedFile.name : t('monitoringPage.fileUpload.selectFile')}
                              </span>
                              <span className="file-upload-subtitle">
                                {selectedFile ? t('monitoringPage.fileUpload.selectAnother') : t('monitoringPage.fileUpload.supportedFormats')}
                              </span>
                            </div>
                            {selectedFile && (
                              <div className="file-upload-remove" onClick={handleFileRemove}>
                                <i className="fas fa-times"></i>
                              </div>
                            )}
                          </label>
                        </div>
                      </div>
                      
                      {/* Ghi chú chỉ hiển thị khi có file được chọn */}
                      {selectedFile && (
                        <div className="mb-3">
                          <textarea 
                            className="modern-form-control file-note-textarea" 
                            rows="3"
                            placeholder={t('monitoringPage.fileUpload.notePlaceholder')}
                            value={fileNote}
                            onChange={handleFileNoteChange}
                            disabled={uploading}
                            style={{
                              resize: 'vertical',
                              minHeight: '80px',
                              maxHeight: '200px'
                            }}
                          />
                          <div className="form-text">
                            <i className="fas fa-info-circle me-1"></i>
                            {t('monitoringPage.fileUpload.noteHelp')}
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
                              {t('monitoringPage.fileUpload.uploading')}
                            </>
                          ) : (
                            <>
                              <i className="fas fa-cloud-upload-alt me-2"></i>
                              {t('monitoringPage.fileUpload.uploadButton')}
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
                          <h6 className="fw-bold mb-2">{t('monitoringPage.fileUpload.disabled.title')}</h6>
                          <p className="mb-0">{t('monitoringPage.fileUpload.disabled.description')}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Header với số lượng file */}
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <h6 className="fw-bold mb-0">
                      <i className="fas fa-folder-open me-2 text-primary"></i>
                      {t('monitoringPage.fileUpload.uploadedFiles')}
                    </h6>
                    <span className="badge bg-primary bg-opacity-10 text-primary px-3 py-2">
                      {uploadedFiles.length === 1 ? t('monitoringPage.fileUpload.filesCount', { count: uploadedFiles.length }) : t('monitoringPage.fileUpload.filesCountPlural', { count: uploadedFiles.length })}
                    </span>
                  </div>
                  
                  {uploadedFiles.length > 0 ? (
                    <div className="file-grid">
                      {uploadedFiles.map(file => {
                        const shouldHideInfo = uploadedFiles.length > 1;
                        const isInfoVisible = showFileInfo[file.id] || !shouldHideInfo;
                        
                        return (
                          <div 
                            key={file.id} 
                            className={`file-card ${file.is_recalled ? 'file-recalled' : ''} ${shouldHideInfo ? 'file-compact' : ''} ${isInfoVisible ? 'file-info-show' : 'file-info-hide'}`}
                            onMouseEnter={shouldHideInfo ? () => setShowFileInfo(prev => ({...prev, [file.id]: true})) : undefined}
                            onMouseLeave={shouldHideInfo ? () => setShowFileInfo(prev => ({...prev, [file.id]: false})) : undefined}
                            onClick={shouldHideInfo ? () => toggleFileInfo(file.id) : undefined}
                            style={{cursor: shouldHideInfo ? 'pointer' : 'default'}}
                          >
                            {/* File header */}
                            <div className="file-header">
                            <div className="file-icon">
                                <i className={`${getFileIcon(file.file_type)} ${file.is_recalled ? 'text-muted' : 'text-white'}`}></i>
                            </div>
                            <div className="file-actions">
                                <button 
                                  className={`btn btn-sm ${file.is_recalled ? 'btn-outline-secondary' : 'btn-outline-primary'}`}
                                onClick={async (e) => {
                                    e.stopPropagation(); // Prevent triggering parent click
                                    if (file.is_recalled) {
                                      showAlert(t('monitoringPage.fileUpload.recall.downloadDisabled'), 'warning');
                                      return;
                                    }
                                    
                                  try {
                                    const token = localStorage.getItem('token');
                                    const response = await fetch(`/api/monitoring/file/${file.id}/download`, {
                                      headers: {
                                        'x-auth-token': token
                                      }
                                    });
                                    
                                    // Check if response is ok
                                    if (!response.ok) {
                                      // Try to parse error message
                                      const contentType = response.headers.get('content-type') || '';
                                      if (contentType.includes('application/json')) {
                                        const errorData = await response.json();
                                        showAlert(errorData.message || t('monitoringPage.fileUpload.download.cannotDownload'), 'danger');
                                      } else {
                                        showAlert(t('monitoringPage.fileUpload.download.cannotDownloadStatus', { status: response.status }), 'danger');
                                      }
                                      return;
                                    }
                                    
                                    // Get blob and download
                                    const blob = await response.blob();
                                    const blobUrl = URL.createObjectURL(blob);
                                    
                                    const link = document.createElement('a');
                                    link.href = blobUrl;
                                    link.download = file.file_name || `file-${file.id}`;
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                    
                                    setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
                                    showAlert(t('monitoringPage.fileUpload.download.success'), 'success');
                                  } catch (error) {
                                    console.error('Lỗi khi tải file:', error);
                                    showAlert(t('monitoringPage.fileUpload.download.downloadFailed'), 'danger');
                                  }
                                }}
                                  title={file.is_recalled ? t('monitoringPage.fileUpload.recall.recalledTitle') : t('monitoringPage.fileUpload.recall.downloadTitle')}
                                  disabled={file.is_recalled}
                              >
                                <i className="fas fa-download"></i>
                                </button>
                                
                                {!file.is_recalled && file.id && (
                                  <button 
                                    className="btn btn-sm btn-outline-warning"
                                    onClick={(e) => {
                                      // Prevent default and stop propagation
                                      if (e) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                      }
                                      
                                      // Get fileId
                                      const fileId = file?.id;
                                      if (!fileId) {
                                        showAlert(t('monitoringPage.fileUpload.recall.fileIdNotFound'), 'danger');
                                        return;
                                      }
                                      
                                      // Call handler
                                      handleRecallFile(fileId).catch((error) => {
                                        // Additional error handling if needed
                                        if (error && !error.response) {
                                          showAlert(t('monitoringPage.fileUpload.recall.unexpectedError'), 'danger');
                                        }
                                      });
                                    }}
                                    title={t('monitoringPage.fileUpload.recall.title')}
                                    type="button"
                                  >
                                    <i className="fas fa-undo"></i>
                                  </button>
                                )}
                              </div>
                            </div>
                            
                            {/* File info - chỉ hiển thị khi cần thiết */}
                            <div className={`file-info-container ${shouldHideInfo ? 'file-info-hidden' : 'file-info-visible'}`}>
                              <div className="file-info">
                                <div className={`file-name ${file.is_recalled ? 'text-muted' : ''}`}>
                                  {file.file_name}
                                  {file.is_recalled && (
                                    <span className="badge bg-secondary ms-2">
                                      <i className="fas fa-ban me-1"></i>
                                      {t('monitoringPage.fileUpload.recall.recalled')}
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
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center text-muted p-4">
                      <div className="rounded-circle bg-light d-inline-flex align-items-center justify-content-center mb-3" style={{width: '60px', height: '60px'}}>
                        <i className="fas fa-file-upload fa-2x text-muted"></i>
                      </div>
                      <p className="mb-0">{t('monitoringPage.fileUpload.noFiles')}</p>
                    </div>
                  )}
                </div>
              </div>
            </Col>
          </Row>
          
          {/* Danh sách tất cả sinh viên trong lớp - Row riêng */}
          <Row className="mb-4">
            <Col>
              <div className="modern-card">
                <div className="card-header bg-success text-white">
                  <div className="d-flex align-items-center justify-content-center">
                    <h5 className="mb-0 fw-bold">{t('monitoringPage.students.title', { count: session.class_students ? session.class_students.length : 0 })}</h5>
                  </div>
                </div>
                <div className="card-body">
                  {session.class_students && session.class_students.length > 0 ? (
                    <div className="students-grid">
                      {session.class_students.map((student, index) => (
                        <div key={index} className={`student-card ${student.attendance || student.has_attended ? 'student-attended' : ''}`}>
                          <div className="student-info">
                            <div className="student-name"> <strong>{student.full_name || student.fullName || student.username}</strong></div>
                            <div className="student-email">{student.email}</div>
                            <div className="student-phone">
                              {student.phone || student.student_code || student.username || t('monitoringPage.sessionInfo.notUpdated')}
                            </div>
                          </div>
                          <div className="student-status">
                            {student.attendance || student.has_attended ? (
                              <span className="badge bg-success" title={t('monitoringPage.students.attended')}>✓</span>
                            ) : (
                              <span className="badge bg-secondary" title={t('monitoringPage.students.notAttended')}>✗</span>
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
                      <p className="mb-0">{t('monitoringPage.students.loading')}</p>
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
  
  .info-item1 {
    display: block;
    padding: 0.5rem 0;
  }
  
  .info-item1 strong {
    color: #495057;
    margin-right: 0rem;
  }
  
  /* Attendance Windows */
  .attendance-windows {
    background: white;
    border-radius: 6px;
    padding: 0.75rem;
    border: 1px solid #e9ecef;
  }
  
  .attendance-window {
    padding: 0.75rem;
    background: #f8f9fa;
    border-radius: 8px;
    border-left: 4px solid #007bff;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
  }
  
  .attendance-window::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%);
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  
  .attendance-window:hover::before {
    opacity: 1;
  }
  
  /* Completed attendance styling */
  .attendance-window.attendance-completed {
    background: linear-gradient(135deg, #e8f5e8 0%, #f0f9f0 100%);
    border-left-color: #28a745;
    box-shadow: 0 2px 8px rgba(40, 167, 69, 0.15);
    transform: translateY(-1px);
  }
  
  .attendance-window.attendance-completed::before {
    background: linear-gradient(135deg, rgba(40, 167, 69, 0.1) 0%, rgba(40, 167, 69, 0.05) 100%);
  }
  
  /* Pending attendance styling */
  .attendance-window.attendance-pending {
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    border-left-color: #6c757d;
    opacity: 0.7;
    filter: grayscale(20%);
  }
  
  .attendance-window.attendance-pending .attendance-pending-badge {
    background: #6c757d !important;
    color: #fff;
    opacity: 0.8;
    position: relative;
    overflow: hidden;
  }
  
  .attendance-window.attendance-pending .attendance-pending-badge::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
    animation: shimmer 2s infinite;
  }
  
  @keyframes shimmer {
    0% { left: -100%; }
    100% { left: 100%; }
  }
  
  /* Attendance status icon */
  .attendance-status-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.9);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    animation: pulse 2s infinite;
  }
  
  @keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
  }
  
  .attendance-status-icon i {
    font-size: 14px;
    animation: bounce 1s ease-in-out;
  }
  
  @keyframes bounce {
    0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
    40% { transform: translateY(-3px); }
    60% { transform: translateY(-1px); }
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
    max-height: 600px;
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
    transform: translateY(-0px);
    box-shadow: 0 8px 25px rgba(0,0,0,0.15);
    border-color: #007bff;
  }
  
  .student-card.student-attended {
    background-color: rgba(40, 167, 70, 0.15);
    border-color: rgba(40, 167, 70, 0.2);
  }
  
  .student-card.student-attended:hover {
    background-color: rgba(40, 167, 69, 0.19);
    border-color: rgba(40, 167, 69, 0.3);
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
    content: "✉️";
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
    content: "📞";
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
  
  /* Compact file card styles */
  .file-card.file-compact {
    min-height: auto;
    padding: 0.75rem;
  }
  
  .file-card.file-compact .file-header {
    margin-bottom: 0;
  }
  
  /* File info animation */
  .file-info-container {
    overflow: hidden;
    transition: all 0.3s ease-in-out;
  }
  
  .file-card.file-info-hide .file-info-container {
    max-height: 0;
    opacity: 0;
    transform: translateY(-10px);
  }
  
  .file-card.file-info-show .file-info-container {
    max-height: 200px;
    opacity: 1;
    transform: translateY(0);
  }
  
  .file-card.file-info-show .file-info {
    animation: slideDownFadeIn 0.3s ease-out;
  }
  
  @keyframes slideDownFadeIn {
    from { 
      opacity: 0;
      transform: translateY(-10px);
    }
    to { 
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  /* File upload responsive */
  .file-upload-label {
    display: block;
    margin-bottom: 0.75rem;
    font-weight: 600;
    color: #495057;
    transition: all 0.2s ease-in-out;
  }
  
  .file-upload-container {
    position: relative;
    width: 100%;
  }
  
  .file-upload-input {
    position: absolute;
    opacity: 0;
    width: 100%;
    height: 100%;
    cursor: pointer;
    z-index: 2;
  }
  
  .file-upload-label-custom {
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 120px;
    padding: 1rem;
    border: 2px dashed #dee2e6;
    border-radius: 12px;
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    cursor: pointer;
    transition: all 0.3s ease-in-out;
    position: relative;
    overflow: hidden;
  }
  
  .file-upload-label-custom::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
    transition: left 0.5s;
  }
  
  .file-upload-label-custom:hover {
    border-color: #007bff;
    background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 123, 255, 0.15);
  }
  
  .file-upload-label-custom:hover::before {
    left: 100%;
  }
  
  .file-upload-label-custom:active {
    transform: translateY(0);
    box-shadow: 0 4px 15px rgba(0, 123, 255, 0.2);
  }
  
  .file-upload-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 60px;
    height: 60px;
    background: linear-gradient(135deg, #007bff, #0056b3);
    border-radius: 50%;
    color: white;
    font-size: 24px;
    margin-right: 1rem;
    flex-shrink: 0;
    transition: all 0.3s ease-in-out;
  }
  
  .file-upload-label-custom:hover .file-upload-icon {
    transform: scale(1.1) rotate(5deg);
    box-shadow: 0 4px 15px rgba(0, 123, 255, 0.3);
  }
  
  .file-upload-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 0;
  }
  
  .file-upload-title {
    font-size: 16px;
    font-weight: 600;
    color: #2c3e50;
    margin-bottom: 0.25rem;
    word-break: break-word;
    transition: all 0.2s ease-in-out;
  }
  
  .file-upload-subtitle {
    font-size: 14px;
    color: #6c757d;
    transition: all 0.2s ease-in-out;
  }
  
  .file-upload-label-custom:hover .file-upload-title {
    color: #007bff;
  }
  
  .file-upload-label-custom:hover .file-upload-subtitle {
    color: #495057;
  }
  
  .file-upload-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: #dc3545;
    border-radius: 50%;
    color: white;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease-in-out;
    flex-shrink: 0;
  }
  
  .file-upload-remove:hover {
    background: #c82333;
    transform: scale(1.1);
  }
  
  .file-upload-input:disabled + .file-upload-label-custom {
    opacity: 0.6;
    cursor: not-allowed;
    background: #e9ecef;
  }
  
  .file-upload-input:disabled + .file-upload-label-custom:hover {
    transform: none;
    box-shadow: none;
  }
  
  /* File note textarea responsive */
  .file-note-textarea {
    width: 100%;
    transition: all 0.2s ease-in-out;
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
    
    /* Mobile: disable hover effects, only use click */
    .file-card.file-compact:hover {
      transform: none;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    
    /* Mobile textarea adjustments */
    .file-note-textarea {
      min-height: 60px;
      font-size: 14px;
    }
    
    /* Mobile file upload adjustments */
    .file-upload-label {
      font-size: 14px;
      margin-bottom: 0.5rem;
    }
    
    .file-upload-label-custom {
      min-height: 100px;
      padding: 1rem;
    }
    
    .file-upload-icon {
      width: 50px;
      height: 50px;
      font-size: 20px;
      margin-right: 0.75rem;
    }
    
    .file-upload-title {
      font-size: 15px;
    }
    
    .file-upload-subtitle {
      font-size: 13px;
    }
  }
  
  @media (max-width: 576px) {
    .file-note-textarea {
      min-height: 50px;
      font-size: 13px;
      padding: 0.5rem;
    }
    
    /* Small mobile file upload adjustments */
    .file-upload-label {
      font-size: 13px;
      margin-bottom: 0.375rem;
    }
    
    .file-upload-label-custom {
      min-height: 80px;
      padding: 0.75rem;
      flex-direction: column;
      text-align: center;
    }
    
    .file-upload-icon {
      width: 40px;
      height: 40px;
      font-size: 18px;
      margin-right: 0;
      margin-bottom: 0.5rem;
    }
    
    .file-upload-text {
      margin-bottom: 0.5rem;
    }
    
    .file-upload-title {
      font-size: 14px;
    }
    
    .file-upload-subtitle {
      font-size: 12px;
    }
    
    .file-upload-remove {
      width: 28px;
      height: 28px;
      font-size: 12px;
    }
  }
`;
document.head.appendChild(style);
 