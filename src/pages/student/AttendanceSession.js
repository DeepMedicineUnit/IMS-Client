import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, Button, Form, Alert, Container, Row, Col, Spinner } from 'react-bootstrap';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';
import { format, parseISO, isAfter, isBefore, isEqual } from 'date-fns';
import { Loader2, RefreshCcw, MapPin, Clock, Calendar, User, Lock, CheckCircle } from "lucide-react";
import { GoogleLogin } from '@react-oauth/google';
import '../../styles/modern-ui.css';

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

const AttendanceSession = ({ shared = false }) => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, isLoggedIn, api, googleLogin } = useAuth();
  
  // State for auto-refresh
  const [refreshing, setRefreshing] = useState(false);
  
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
  
  // Function to find hospital name by coordinates
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
      const currentDate = new Date();
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
  
  // Check if the current time is within the allowed attendance window
  const checkAttendanceWindow = (session) => {
    const now = new Date();
    const sessionDate = parseISO(session.date);
    
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

    // Check multiple attendance windows based on session configuration
    const attendanceConfig = session.monitoring_options?.attendance;
    
    if (!attendanceConfig) {
      // If no attendance config, just check if we're in the session time
      const calculatedStatus = calculateSessionStatus(session);
      if (calculatedStatus === 'active') {
        return { allowed: true, type: 'during' };
      } else if (calculatedStatus === 'scheduled') {
        // Calculate minutes until session starts
        const minutesToStart = Math.round((sessionStartTime - now) / (1000 * 60));
        return { 
          allowed: false, 
          message: `Buổi học sẽ bắt đầu lúc ${sessionStartTime.getHours()}:${sessionStartTime.getMinutes().toString().padStart(2, '0')} (còn ${minutesToStart} phút nữa)` 
        };
      } else if (calculatedStatus === 'ended') {
        return { allowed: false, message: 'Buổi học đã kết thúc. Không thể điểm danh.' };
      } else {
        return { allowed: false, message: 'Buổi học đã bị hủy hoặc không khả dụng.' };
      }
    }
    
    // Check before session attendance window
    if (attendanceConfig.before_session?.enabled) {
      const minutesBefore = attendanceConfig.before_session.minutes_before || 30;
      const duration = attendanceConfig.before_session.duration || 30;
      
      const beforeStart = new Date(sessionStartTime);
      beforeStart.setMinutes(beforeStart.getMinutes() - minutesBefore);
      
      const beforeEnd = new Date(sessionStartTime); // Ends at session start
      
      // Check if we're before the attendance window but on the same day
      if (now < beforeStart && now.getDate() === sessionStartTime.getDate()) {
        const minutesToWindow = Math.round((beforeStart - now) / (1000 * 60));
        return {
          allowed: false,
          type: 'too_early',
          message: `Buổi học chưa bắt đầu. Bạn có thể điểm danh trước từ ${beforeStart.getHours()}:${beforeStart.getMinutes().toString().padStart(2, '0')}, còn ${minutesToWindow} phút nữa`
        };
      }
      
      if (now >= beforeStart && now <= beforeEnd) {
        // Within before-session window
        // Check if early (more than the allowed window)
        const minutesEarly = Math.round((beforeEnd - now) / (1000 * 60));
        
        if (minutesEarly > duration) {
          return {
            allowed: true,
            type: 'early',
            minutesEarly: minutesEarly,
            message: `Bạn đến sớm ${minutesEarly} phút`
          };
        }
        
        return { allowed: true, type: 'before', message: 'Bạn đang trong khung giờ điểm danh trước buổi học' };
      }
    }
    
    // Check during session attendance window
    if (attendanceConfig.during_session?.enabled) {
      const minutesAfterStart = attendanceConfig.during_session.minutes_after_start || 120;
      const minutesBeforeEnd = attendanceConfig.during_session.minutes_before_end || 120;
      
      const duringStart = new Date(sessionStartTime);
      duringStart.setMinutes(duringStart.getMinutes() + minutesAfterStart);
      
      const duringEnd = new Date(sessionEndTime);
      duringEnd.setMinutes(duringEnd.getMinutes() - minutesBeforeEnd);
      
      if (now >= duringStart && now <= duringEnd) {
        // Within during-session window
        return { allowed: true, type: 'during', message: 'Bạn đang trong khung giờ điểm danh giữa buổi học' };
      } else if (now > sessionStartTime && now < duringStart) {
        // Between session start and during-session start
        // Allow late attendance if the student hasn't checked in yet
        const minutesLate = Math.round((now - sessionStartTime) / (1000 * 60));
        return {
          allowed: true,
          type: 'late',
          minutesLate: minutesLate,
          message: `Bạn đi trễ ${minutesLate} phút`
        };
      } else if (now > duringEnd && now < sessionEndTime) {
        // Between during-session end and session end
        // Check if after-session attendance is enabled
        if (attendanceConfig.after_session?.enabled) {
          const minutesAfter = attendanceConfig.after_session.minutes_after || 0;
          const afterStart = new Date(sessionEndTime);
          afterStart.setMinutes(afterStart.getMinutes() + minutesAfter);
          
          if (now < afterStart) {
            // Too early for after-session, show when it will be available
            const minutesToAfter = Math.round((afterStart - now) / (1000 * 60));
            return {
              allowed: false,
              message: `Khung giờ điểm danh trong buổi học đã kết thúc. Điểm danh sau buổi học sẽ bắt đầu từ ${afterStart.getHours()}:${afterStart.getMinutes().toString().padStart(2, '0')} (còn ${minutesToAfter} phút nữa)`
            };
          }
        } else {
          // No after-session config, show that during-session window has ended
          return {
            allowed: false,
            message: `Khung giờ điểm danh trong buổi học đã kết thúc (từ ${duringStart.getHours()}:${duringStart.getMinutes().toString().padStart(2, '0')} đến ${duringEnd.getHours()}:${duringEnd.getMinutes().toString().padStart(2, '0')})`
          };
        }
      }
    }
    
    // Check after session attendance window
    if (attendanceConfig.after_session?.enabled) {
      const minutesAfter = attendanceConfig.after_session.minutes_after || 0;
      const duration = attendanceConfig.after_session.duration || 30;
      
      const afterStart = new Date(sessionEndTime);
      afterStart.setMinutes(afterStart.getMinutes() + minutesAfter);
      
      const afterEnd = new Date(afterStart);
      afterEnd.setMinutes(afterEnd.getMinutes() + duration);
      
      if (now >= afterStart && now <= afterEnd) {
        // Within after-session window
        return { allowed: true, type: 'after', message: 'Bạn đang trong khung giờ điểm danh sau buổi học' };
      } else if (now > afterEnd) {
        // Too late for after-session window
        const minutesLate = Math.round((now - afterEnd) / (1000 * 60));
        return {
          allowed: true,
          type: 'late_leave',
          minutesLate: minutesLate,
          message: `Bạn về trễ ${minutesLate} phút sau khung giờ điểm danh`
        };
      } else if (now > sessionEndTime && now < afterStart) {
        // Between session end and after-session start
        return {
          allowed: false,
          message: `Bạn phải điểm danh từ khung giờ ${afterStart.getHours()}:${afterStart.getMinutes().toString().padStart(2, '0')} - ${afterEnd.getHours()}:${afterEnd.getMinutes().toString().padStart(2, '0')}`
        };
      }
    }
    
    // If session has started but not ended, and no during-session config
    if (now >= sessionStartTime && now <= sessionEndTime) {
      // Check if after-session attendance is enabled and we're past the during-session window
      if (attendanceConfig.after_session?.enabled) {
        const minutesAfter = attendanceConfig.after_session.minutes_after || 0;
        const afterStart = new Date(sessionEndTime);
        afterStart.setMinutes(afterStart.getMinutes() + minutesAfter);
        
        if (now < afterStart) {
          // Too early for after-session, show when it will be available
          const minutesToAfter = Math.round((afterStart - now) / (1000 * 60));
          return {
            allowed: false,
            message: `Buổi học đang diễn ra. Điểm danh sau buổi học sẽ bắt đầu từ ${afterStart.getHours()}:${afterStart.getMinutes().toString().padStart(2, '0')} (còn ${minutesToAfter} phút nữa)`
          };
        }
      }
      
      // Check if late
      const minutesLate = Math.round((now - sessionStartTime) / (1000 * 60));
      
      if (minutesLate > 0) {
        return {
          allowed: true,
          type: 'late',
          minutesLate: minutesLate,
          message: `Bạn đi trễ ${minutesLate} phút`
        };
      }
      
      return { allowed: true, type: 'during', message: 'Bạn đang trong giờ học' };
    }
    
    // Default response if none of the above conditions are met
    const calculatedStatus = calculateSessionStatus(session);
    
    // Provide more specific guidance based on attendance windows
    if (calculatedStatus === 'scheduled') {
      // If before-session attendance is enabled, check if we're in that window
      if (attendanceConfig.before_session?.enabled) {
        const beforeStart = new Date(sessionStartTime);
        beforeStart.setMinutes(beforeStart.getMinutes() - (attendanceConfig.before_session.minutes_before || 30));
        
        // If we're already past the before-session start time, we should be able to attend
        if (now >= beforeStart) {
          // This case is already handled by the before_session check above
          // If we get here, it means we're in the window but the specific check didn't catch it
          const minutesEarly = Math.round((sessionStartTime - now) / (1000 * 60));
          return {
            allowed: true,
            type: 'before',
            minutesEarly: minutesEarly,
            message: 'Bạn đang trong khung giờ điểm danh trước buổi học'
          };
        } else {
          // We're before the before-session window
          const minutesToWindow = Math.round((beforeStart - now) / (1000 * 60));
          return { 
            allowed: false, 
            message: `Điểm danh trước buổi học sẽ bắt đầu từ ${beforeStart.getHours()}:${beforeStart.getMinutes().toString().padStart(2, '0')} (còn ${minutesToWindow} phút nữa)` 
          };
        }
      }
      
      // No before-session window, just show when the session starts
      const minutesToStart = Math.round((sessionStartTime - now) / (1000 * 60));
      return { 
        allowed: false, 
        message: `Buổi học sẽ bắt đầu lúc ${sessionStartTime.getHours()}:${sessionStartTime.getMinutes().toString().padStart(2, '0')} (còn ${minutesToStart} phút nữa)` 
      };
    } else if (calculatedStatus === 'ended') {
      if (attendanceConfig.after_session?.enabled) {
        const afterStart = new Date(sessionEndTime);
        afterStart.setMinutes(afterStart.getMinutes() + (attendanceConfig.after_session.minutes_after || 0));
        
        const afterEnd = new Date(afterStart);
        afterEnd.setMinutes(afterEnd.getMinutes() + (attendanceConfig.after_session.duration || 30));
        
        // If after session window is in the future
        if (now < afterStart) {
          const minutesToAfter = Math.round((afterStart - now) / (1000 * 60));
          return { 
            allowed: false, 
            message: `Buổi học đã kết thúc. Điểm danh sau buổi học sẽ bắt đầu từ ${afterStart.getHours()}:${afterStart.getMinutes().toString().padStart(2, '0')} (còn ${minutesToAfter} phút nữa)` 
          };
        }
        // If after session window has passed
        else if (now > afterEnd) {
          return { 
            allowed: false, 
            message: `Tất cả khung giờ điểm danh đã kết thúc. Không thể điểm danh nữa.` 
          };
        }
      } else {
        return { 
          allowed: false, 
          message: 'Buổi học đã kết thúc và không có khung giờ điểm danh sau buổi học' 
        };
      }
    } else {
      return { allowed: false, message: 'Buổi học đã bị hủy' };
    }
  };
  
  // Parse token from URL
  const searchParams = new URLSearchParams(location.search);
  const tokenFromURL = searchParams.get('token');
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [session, setSession] = useState(null);
  const [password, setPassword] = useState('');
  const [token, setToken] = useState(tokenFromURL || '');
  const [locationData, setLocationData] = useState(null);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [currentAttendanceWindow, setCurrentAttendanceWindow] = useState(null);
  
  // Removed student information form fields as login is now required
  
  // Cập nhật khung giờ điểm danh hiện tại mỗi phút
  useEffect(() => {
    if (!session) return;
    
    // Cập nhật khung giờ điểm danh ngay lập tức
    const updateAttendanceWindow = () => {
      const attendanceStatus = checkAttendanceWindow(session);
      setCurrentAttendanceWindow(attendanceStatus);
    };
    
    // Cập nhật ngay lần đầu
    updateAttendanceWindow();
    
    // Cập nhật mỗi phút
    const intervalId = setInterval(updateAttendanceWindow, 60000);
    
    return () => clearInterval(intervalId);
  }, [session]);
  
  // Function to fetch session data
  const fetchSessionData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      // Create an API instance without auth headers for public access
      const publicApi = axios.create({
        baseURL: '/api',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      // Get session details (public endpoint)
      const response = await publicApi.get(`/sessions/${id}/public`);
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Không thể tải thông tin buổi học');
      }
      
      // Tính toán trạng thái chính xác dựa trên ngày và thời gian
      const sessionData = response.data.data;
      const calculatedStatus = calculateSessionStatus(sessionData);
      
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
      
      // Cập nhật session với trạng thái đã tính toán
      setSession({
        ...parsedSessionData,
        calculatedStatus: calculatedStatus
      });
      
      // Instead of checking if session is active, check if attendance is allowed based on windows
      const attendanceStatus = checkAttendanceWindow(parsedSessionData);
      if (!attendanceStatus.allowed) {
        setError(attendanceStatus.message);
      } else {
        // Clear error if attendance is now allowed (might have changed since last check)
        setError('');
      }
      
      // Update the attendance window state
      setCurrentAttendanceWindow(attendanceStatus);
      
      // If no token in URL and user is logged in, try to generate one
      if (!tokenFromURL && isLoggedIn) {
        try {
          console.log('No token in URL, generating temporary token...');
          const tokenResponse = await api.post(`/sessions/${id}/generate-token`);
          
          if (tokenResponse.data.success && tokenResponse.data.token) {
            const newToken = tokenResponse.data.token;
            console.log('Generated temporary token:', newToken);
            setToken(newToken);
            
            // Update URL with token
            const newUrl = `${window.location.pathname}?token=${newToken}`;
            window.history.replaceState({}, '', newUrl);
          }
        } catch (tokenError) {
          console.error('Error generating temporary token:', tokenError);
          // Continue without token - will show error in UI
        }
      }
      
      // Request location permission with high accuracy (only on initial load, not during refresh)
      if (!isRefresh && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setLocationData({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            });
            setHasLocationPermission(true);
            
            // Check geofence immediately if available
            if (response.data.data.monitoring_options?.location?.enabled && 
                response.data.data.monitoring_options?.location?.geofence?.enabled) {
              const geofence = response.data.data.monitoring_options.location.geofence;
              const currentLocation = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
              };
              
              const withinGeofence = isWithinGeofence(currentLocation, geofence);
              if (!withinGeofence) {
                // This was empty in the original code
              }
            }
          },
          (error) => {
            console.error('Error getting location:', error);
            setHasLocationPermission(false);
            
            // Check if location is required and enforcement is immediate
            if (response.data.data.monitoring_options?.location?.required && 
                response.data.data.monitoring_options?.location?.enforcement === 'immediate') {
              setError('Buổi học này yêu cầu quyền truy cập vị trí. Vui lòng cấp quyền và làm mới trang.');
            }
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      } else if (isRefresh && locationData && navigator.geolocation) {
        // During refresh, just update location without showing errors
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setLocationData({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            });
            setHasLocationPermission(true);
          },
          () => {}, // Silent error handling during refresh
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
      }
      
      // Data refresh complete
      
    } catch (error) {
      console.error('Error fetching session data:', error);
      if (!isRefresh) {
        // Only show errors during initial load, not during background refresh
        setError(error.response?.data?.message || 'Không thể tải dữ liệu. Vui lòng thử lại sau.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  // Initial data fetch
  useEffect(() => {
    fetchSessionData();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Set up auto-refresh interval (every 15 seconds)
  useInterval(() => {
    fetchSessionData(true);
  }, 10000); // 10 seconds
  
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

  // Handle attendance submission
  const handleSubmitAttendance = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    try {
      setSubmitting(true);
      
      // Check if location is required but permission is denied
      if (session.monitoring_options?.location?.required && 
          session.monitoring_options?.location?.enforcement === 'immediate' && 
          !hasLocationPermission) {
        setError('Buổi học này yêu cầu quyền truy cập vị trí. Vui lòng cấp quyền và làm mới trang.');
        setSubmitting(false);
        return;
      }
      
      // Get fresh location data before checking geofence
      let currentLocationData = locationData;
      
      if (hasLocationPermission) {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0
            });
          });
          
          currentLocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          
          // Update the state with the latest location data
          setLocationData(currentLocationData);
        } catch (locError) {
          console.error('Error getting updated location:', locError);
          // Continue with existing location data
        }
      }
      
      // Check geofence restriction if enabled - STRICTLY ENFORCE THIS
      if (session.monitoring_options?.location?.enabled && 
          session.monitoring_options?.location?.geofence?.enabled) {
          
        if (!currentLocationData) {
          setError('Không thể xác định vị trí của bạn. Vui lòng cấp quyền truy cập vị trí và thử lại.');
          setSubmitting(false);
          return;
        }
        
        const geofence = session.monitoring_options.location.geofence;
        if (!isWithinGeofence(currentLocationData, geofence)) {
          setError(`Bạn đang ở ngoài phạm vi cho phép (${geofence.radius}m). Vui lòng di chuyển đến địa điểm buổi học để điểm danh.`);
          toast.error('Không thể điểm danh: Bạn đang ở ngoài phạm vi cho phép.');
          setSubmitting(false);
          return;
        }
        
        // Double-check with a second location request to prevent spoofing
        try {
          const secondCheck = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              position => resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
              }),
              error => reject(error),
              { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
            );
          });
          
          if (!isWithinGeofence(secondCheck, geofence)) {
            setError(`Xác minh vị trí thất bại. Bạn đang ở ngoài phạm vi cho phép (${geofence.radius}m).`);
            toast.error('Không thể điểm danh: Xác minh vị trí thất bại.');
            setSubmitting(false);
            return;
          }
          
          // Update current location data with the most recent check
          currentLocationData = secondCheck;
        } catch (locError) {
          console.error('Error during second location check:', locError);
          // Don't continue if we can't verify location with a second check
          setError('Không thể xác minh vị trí của bạn. Vui lòng kiểm tra quyền truy cập vị trí và thử lại.');
          setSubmitting(false);
          return;
        }
      }
      
      // Kiểm tra lại khung giờ điểm danh hiện tại để đảm bảo thông tin mới nhất
      const attendanceStatus = currentAttendanceWindow || checkAttendanceWindow(session);
      
      if (!attendanceStatus.allowed) {
        setError(attendanceStatus.message);
        setSubmitting(false);
        return;
      }
      
      // Automatically capture webcam image silently without notification
      let profileImage = null;
      let imageUploaded = false;
      
      try {
        // Try to access webcam silently
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: 640,
            height: 480,
            facingMode: "user" 
          } 
        });
        
        // Create video element
        const video = document.createElement('video');
        video.srcObject = stream;
        video.play();
        
        // Wait for video to be ready
        await new Promise(resolve => {
          video.onloadedmetadata = () => {
            resolve();
          };
          
          // Also add onloadeddata event as a backup
          video.onloadeddata = () => {
            resolve();
          };
        });
        
        // Additional wait to ensure the video is fully loaded
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Create canvas to capture frame
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Get actual video dimensions
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        
        console.log('Video dimensions:', videoWidth, 'x', videoHeight);
        
        // Set canvas size to match video dimensions to preserve aspect ratio
        canvas.width = videoWidth;
        canvas.height = videoHeight;
        
        // Draw video frame to canvas preserving original aspect ratio
        try {
          ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
        } catch (drawError) {
          console.error('Error drawing video to canvas:', drawError);
          throw new Error('Không thể chụp ảnh từ camera');
        }
        
        // Get image as blob
        try {
          profileImage = await new Promise((resolve, reject) => {
            canvas.toBlob(blob => {
              if (blob) resolve(blob);
              else reject(new Error('Không thể tạo blob từ canvas'));
            }, 'image/jpeg', 0.8);
          });
        } catch (blobError) {
          console.error('Error creating blob:', blobError);
          throw new Error('Không thể tạo ảnh từ camera');
        }
        
        // Stop camera
        stream.getTracks().forEach(track => track.stop());
        
        // Convert to form data
        const formData = new FormData();
        formData.append('file', profileImage, 'profile.jpg');
        formData.append('sessionId', id);
        formData.append('dataType', 'webcam');
        
        // Log form data for debugging
        console.log('Form data prepared:', {
          fileSize: profileImage.size,
          fileType: profileImage.type,
          sessionId: id,
          dataType: 'webcam'
        });
        
        // Upload image with explicit content type header and attendance flag
        const uploadResponse = await api.post('/monitoring/data?attendance=true', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        
        console.log('Profile image upload response:', uploadResponse.data);
        console.log('Profile image captured and uploaded successfully');
        imageUploaded = true;
        
      } catch (webcamError) {
        console.error('Error capturing webcam image:', webcamError);
        // If can't access camera, attendance will fail
        setError('Điểm danh không thành công. Vui lòng cấp quyền truy cập camera và thử lại.');
        setSubmitting(false);
        return;
      }
      
      // Only proceed with attendance if webcam image was captured successfully
      if (!imageUploaded) {
        setError('Không thể chụp ảnh đại diện. Điểm danh không thành công.');
        setSubmitting(false);
        return;
      }
      
      // Lấy mã định danh thiết bị
      let deviceMac = null;
      try {
        // Import động để tránh lỗi khi trang được tải
        const { getDeviceFingerprint } = await import('../../utils/deviceFingerprint');
        deviceMac = await getDeviceFingerprint();
        console.log('Device MAC for attendance:', deviceMac);
      } catch (fingerprintError) {
        console.error('Error getting device fingerprint:', fingerprintError);
      }
      
      // Debug: Log token và request data
      const authToken = localStorage.getItem('token');
      console.log('Attendance token:', authToken ? 'Present' : 'Missing');
      
      const attendanceData = {
        token,
        password,
        location: currentLocationData,
        attendance_type: attendanceStatus.type,
        minutes_early: attendanceStatus.minutesEarly,
        minutes_late: attendanceStatus.minutesLate,
        deviceMac // Thêm mã định danh thiết bị vào dữ liệu điểm danh
      };
      
      console.log('Attendance data:', attendanceData);
      
      // Thử điểm danh tối đa 2 lần nếu lần đầu bị lỗi 400
      let response;
      try {
        response = await api.post(`/sessions/${id}/attend`, attendanceData, {
          timeout: 30000 // Tăng timeout lên 30 giây
        });
      } catch (firstError) {
        // Nếu lỗi 400 (Bad Request), có thể là do đang xử lý xóa bản ghi cũ
        if (firstError.response?.status === 400) {
          console.log('Lần điểm danh đầu tiên bị lỗi 400, thử lại sau 2 giây...');
          // Đợi 2 giây và thử lại
          await new Promise(resolve => setTimeout(resolve, 2000));
          response = await api.post(`/sessions/${id}/attend`, attendanceData, {
            timeout: 30000
          });
        } else {
          // Nếu không phải lỗi 400, ném lỗi để xử lý ở catch bên ngoài
          throw firstError;
        }
      }
      
      if (response.data.success) {
        // We've already verified the user is within the geofence, so we can proceed
        setSuccess(response.data.message || 'Điểm danh thành công!');
        toast.success('Điểm danh thành công!');
        
        // Initialize monitoring data based on session monitoring options
        try {
          // Get session monitoring options
          const monitoringOptions = session.monitoring_options || {};
          console.log('Applying monitoring options:', monitoringOptions);
          
          // Send initial location data if location monitoring is enabled
          if (currentLocationData && monitoringOptions.location?.enabled) {
            await api.post('/monitoring/data/text?attendance=true', {
              sessionId: id,
              dataType: 'location',
              content: JSON.stringify({
                location: `${currentLocationData.latitude}, ${currentLocationData.longitude}`,
                batteryLevel: navigator.getBattery ? (await navigator.getBattery()).level * 100 : null,
                networkStatus: navigator.connection ? navigator.connection.effectiveType : 'unknown'
              })
            });
            console.log('Location data sent successfully');
          }
          
          // Send initial activity data
          await api.post('/monitoring/data/text?attendance=true', {
            sessionId: id,
            dataType: 'activity',
            content: JSON.stringify({
              type: 'attendance',
              status: 'active',
              device: navigator.userAgent
            })
          });
          console.log('Activity data sent successfully');
          
        } catch (monitoringError) {
          console.error('Error initializing monitoring data:', monitoringError);
          // Don't show error to user, just log it
        }
        
        // Navigate to monitoring page after a short delay
        // We've already verified the user is within the geofence above, so we can navigate directly
        setTimeout(() => {
          navigate(`/session/${id}/monitor`);
        }, 1000);
      }
    } catch (error) {
      console.error('Error submitting attendance:', error);
      
      // Log the complete error response for debugging
      console.log('Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          data: error.config?.data
        }
      });
      
      // Show detailed error message from server if available
      let errorMessage = 'Không thể điểm danh. Vui lòng thử lại sau.';
      
      if (error.code === 'ECONNABORTED' || error.response?.status === 504) {
        errorMessage = 'Hệ thống đang xử lý chậm. Vui lòng đợi 10-15 giây và thử lại.';
        toast.warning('Hệ thống đang xử lý chậm. Vui lòng đợi một lát và thử lại.');
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
        
        // Nếu là thông báo đã điểm danh trước đó và có trạng thái duplicate
        if (error.response?.data?.duplicate) {
          setError(errorMessage);
          toast.warning(errorMessage);
          setSubmitting(false);
          return; // Tránh chuyển hướng và hiển thị thành công
        }
      } else if (error.response?.status === 400) {
        errorMessage = 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin.';
      } else if (error.response?.status === 401) {
        errorMessage = 'Không có quyền truy cập. Vui lòng đăng nhập lại.';
      } else if (error.response?.status === 404) {
        errorMessage = 'Không tìm thấy buổi học hoặc đã hết hạn.';
      } else if (error.response?.status === 500) {
        errorMessage = 'Lỗi máy chủ. Vui lòng thử lại sau.';
      }
      
      setError(errorMessage);
      
      // Log additional details for debugging
      if (error.response?.data?.errors) {
        console.error('Validation errors:', error.response.data.errors);
      }
    } finally {
      setSubmitting(false);
    }
  };
  
  // Handle login redirect
  const handleLogin = () => {
    // Store the current URL in localStorage to redirect back after login
    localStorage.setItem('redirectUrl', window.location.pathname + window.location.search);
    navigate('/login');
  };
  
  if (loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '50vh' }}>
        <div className="text-center">
          <div className="mb-3">
            <Loader2 size={40} className="animate-spin text-primary" />
          </div>
          <p className="mt-3 text-gray-600">Đang tải thông tin buổi học...</p>
        </div>
      </Container>
    );
  }
  
  if (!session) {
    return (
      <Container className="mt-5">
        <div className="modern-card">
          <div className="p-5 text-center">
            <div className="rounded-circle bg-danger bg-opacity-10 d-inline-flex align-items-center justify-content-center mb-4" style={{width: '80px', height: '80px'}}>
              <i className="fas fa-exclamation-triangle text-danger fa-2x"></i>
            </div>
            <h4 className="mb-3">Không tìm thấy buổi học</h4>
            <p className="text-gray-600 mb-4">{error || 'Buổi học không tồn tại hoặc đã bị xóa.'}</p>
            <Button 
              className="modern-btn modern-btn-primary"
              onClick={() => navigate('/')}
            >
              Quay lại trang chủ
            </Button>
          </div>
        </div>
      </Container>
    );
  }
  
  // Always require login for attendance
  if (!isLoggedIn) {
    // Store the current URL for redirect after login
    localStorage.setItem('redirectUrl', window.location.pathname + window.location.search);
    
    return (
      <Container className="mt-5">
        <Row className="justify-content-center">
          <Col md={8} lg={6}>
            <div className="modern-card shadow">
              <div className="card-header bg-white border-0 d-flex justify-content-between align-items-center">
                <div></div>
                {refreshing && (
                  <div className="d-flex align-items-center">
                    <Loader2 size={16} className="animate-spin me-1 text-primary" />
                    <small className="text-muted">Đang cập nhật...</small>
                  </div>
                )}
              </div>
              <div className="card-body">
                <div className="text-center mb-4">
                  <h3 className="mb-0 fw-bold">{session.title}</h3>
                </div>
                
                {error && (
                  <div className="modern-alert modern-alert-danger">
                    <div className="d-flex align-items-start">
                      <i className="fas fa-exclamation-circle mt-1 me-2"></i>
                      <div>{error}</div>
                    </div>
                  </div>
                )}
                
                <div className="text-center p-4 my-4 bg-light rounded-lg">
                  <div className="rounded-circle bg-primary bg-opacity-10 d-inline-flex align-items-center justify-content-center mb-4" style={{width: '80px', height: '80px'}}>
                    <Lock size={32} className="text-primary" />
                  </div>
                  <h5 className="mb-3">Vui lòng đăng nhập để điểm danh</h5>
                  <p className="text-muted mb-4">Hệ thống sẽ tự động sử dụng thông tin tài khoản của bạn để điểm danh.</p>
                  <Button 
                    className="modern-btn modern-btn-primary py-2 px-4"
                    onClick={handleLogin}
                    size="lg"
                  >
                    <i className="fas fa-sign-in-alt me-2"></i>
                    Đăng nhập ngay
                  </Button>
                </div>
              </div>
              <div className="card-footer bg-white text-center">
                <small className="text-muted">PCTU Clinical Learning Monitoring System</small>
              </div>
            </div>
          </Col>
        </Row>
      </Container>
    );
  }
  
  // For regular attendance (logged in users)
  return (
    <Container className="mt-1">
      <Row className="justify-content-center">
        <Col md={8} lg={6}>
          <div className="modern-card shadow">
            <div className="card-header bg-white border-0">
              <div className="d-flex justify-content-between align-items-center">
                <div></div>
                {refreshing && (
                  <div className="d-flex align-items-center">
                    <Loader2 size={16} className="animate-spin me-1 text-primary" />
                    <small className="text-muted">Đang cập nhật...</small>
                  </div>
                )}
              </div>
            </div>
            <div className="card-body">
              <div className="text-center mb-4">
                <span className="badge bg-light text-primary px-3 py-2 mb-2">
                  <Calendar size={16} className="me-1" />
                  {format(parseISO(session.date), 'dd/MM/yyyy')}
                </span>
                <h3 className="fw-bold">{session.title}</h3>
                <div className="d-flex justify-content-center align-items-center gap-3 mt-2">
                  <span className="text-muted small">
                    <Clock size={14} className="me-1" />
                    {session.start_time} - {session.end_time}
                  </span>
                </div>
                <div className="d-flex justify-content-center align-items-center gap-3 mt-2">
                    <span className="text-muted small">
                      <MapPin size={14} className="me-1" />
                      {session.location}
                    </span>
                </div>
              </div>
              
              {/* Geofence Status Indicator */}
              {session.monitoring_options?.location?.enabled && 
               session.monitoring_options?.location?.geofence?.enabled &&
               locationData && (
                <div className={`mb-4 p-4 rounded-lg shadow-sm ${isWithinGeofence(locationData, session.monitoring_options.location.geofence) ? 'bg-success bg-opacity-10' : 'bg-danger bg-opacity-10'}`}>
                  <div className="d-flex align-items-center mb-3">
                    <div className={`rounded-circle me-3 ${isWithinGeofence(locationData, session.monitoring_options.location.geofence) ? 'bg-success' : 'bg-danger'}`} style={{width: '12px', height: '12px'}}></div>
                    <span className={`fw-medium ${isWithinGeofence(locationData, session.monitoring_options.location.geofence) ? 'text-success' : 'text-danger'}`}>
                      {(() => {
                        // Find location name based on geofence coordinates
                        const geofenceCoords = session.monitoring_options.location.geofence.coordinates;
                        const locationMatch = findHospitalByCoordinates(
                          geofenceCoords.latitude,
                          geofenceCoords.longitude
                        );
                        
                        const locationName = locationMatch ? locationMatch.name : session.location || 'Địa điểm buổi học';
                        
                        return isWithinGeofence(locationData, session.monitoring_options.location.geofence) 
                          ? `Bạn đang ở trong khu vực ${locationName}` 
                          : `Bạn đang ở ngoài khu vực ${locationName}`;
                      })()}
                    </span>
                  </div>
                  
                  <div className="bg-white rounded-lg p-3">
                    {(() => {
                      // Find location name based on geofence coordinates
                      const geofenceCoords = session.monitoring_options.location.geofence.coordinates;
                      const locationMatch = findHospitalByCoordinates(
                        geofenceCoords.latitude,
                        geofenceCoords.longitude
                      );
                      
                      // Display location details
                      return (
                        <div>
                          <div className="d-flex align-items-center mb-2">
                            <MapPin size={16} className="me-2 text-primary" />
                            <span>
                              <strong>Địa điểm:</strong> {locationMatch ? locationMatch.name : session.location || 'Không xác định'}
                            </span>
                          </div>
                          <div className="d-flex align-items-center">
                            <i className="fas fa-circle-notch me-2 text-primary"></i>
                            <span>
                              <strong>Phạm vi cho phép:</strong> {session.monitoring_options.location.geofence.radius}m
                            </span>
                          </div>
                          {locationData && (
                            <div className="mt-3 text-center">
                              <button 
                                className="btn-modern"
                                onClick={() => {
                                  const { latitude, longitude } = session.monitoring_options.location.geofence.coordinates;
                                  window.open(`https://www.google.com/maps?q=${latitude},${longitude}`, '_blank');
                                }}
                              >
                                <i className="fas fa-map-marker-alt"></i> Xem bản đồ
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
              
              {error && (
                <div className="modern-alert modern-alert-danger mb-4">
                  <div className="d-flex align-items-start">
                    <i className="fas fa-exclamation-circle mt-1 me-2"></i>
                    <div>{error}</div>
                  </div>
                </div>
              )}
              
              {/* Hiển thị khung giờ điểm danh hiện tại */}
              {currentAttendanceWindow && currentAttendanceWindow.allowed && (
                <div className="modern-alert modern-alert-success mb-4">
                  <div className="d-flex align-items-center">
                    <div className="rounded-circle bg-success bg-opacity-10 p-2 me-3">
                      <Clock size={20} className="text-success" />
                    </div>
                    <div>
                      <div className="fw-medium">
                        <strong>Khung giờ hiện tại: </strong>
                        {currentAttendanceWindow.type === 'before' && 'Điểm danh trước buổi học'}
                        {currentAttendanceWindow.type === 'during' && 'Điểm danh trong buổi học'}
                        {currentAttendanceWindow.type === 'after' && 'Điểm danh sau buổi học'}
                        {currentAttendanceWindow.type === 'early' && 'Điểm danh sớm'}
                        {currentAttendanceWindow.type === 'late' && 'Điểm danh trễ'}
                        {currentAttendanceWindow.type === 'late_leave' && 'Điểm danh về trễ'}
                        {!['before', 'during', 'after', 'early', 'late', 'late_leave'].includes(currentAttendanceWindow.type) && 'Điểm danh'}
                      </div>
                      {currentAttendanceWindow.message && (
                        <div className="text-muted mt-1">{currentAttendanceWindow.message}</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Show attendance status information */}
              {session.monitoring_options?.attendance && (
                <div className="bg-light rounded-lg p-4 mb-4 shadow-sm">
                  <div className="d-flex align-items-center mb-3">
                    <div className="rounded-circle bg-info bg-opacity-10 p-2 me-2">
                      <i className="fas fa-info-circle text-info"></i>
                    </div>
                    <h6 className="mb-0 fw-bold">Thông tin điểm danh</h6>
                  </div>
                  
                  <div className="timeline">
                    {session.monitoring_options.attendance.before_session?.enabled && (
                      <div className="timeline-item">
                        <div className="timeline-dot timeline-dot-primary"></div>
                        <div className="timeline-content">
                          <div className="d-flex align-items-center mb-2">
                            <div className="badge modern-badge-primary me-2">
                              <i className="fas fa-hourglass-start me-1"></i>
                              Trước buổi học
                            </div>
                          </div>
                          <div className="text-muted small">
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
                              
                              return `Từ khung giờ: ${beforeStartFormatted} đến ${sessionStartFormatted}`;
                            })()}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {session.monitoring_options.attendance.during_session?.enabled && (
                      <div className="timeline-item">
                        <div className="timeline-dot timeline-dot-success"></div>
                        <div className="timeline-content">
                          <div className="d-flex align-items-center mb-2">
                            <div className="badge modern-badge-success me-2">
                              <i className="fas fa-clock me-1"></i>
                              Trong buổi học
                            </div>
                          </div>
                          <div className="text-muted small">
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
                              
                              return `Từ khung giờ: ${duringStartFormatted} đến ${duringEndFormatted}`;
                            })()}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {session.monitoring_options.attendance.after_session?.enabled && (
                      <div className="timeline-item">
                        <div className="timeline-dot timeline-dot-info"></div>
                        <div className="timeline-content">
                          <div className="d-flex align-items-center mb-2">
                            <div className="badge modern-badge-info me-2">
                              <i className="fas fa-hourglass-end me-1"></i>
                              Sau buổi học
                            </div>
                          </div>
                          <div className="text-muted small">
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
                              
                              return `Từ khung giờ: ${afterStartFormatted} đến ${afterEndFormatted}`;
                            })()}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {success && (
                <div className="modern-alert modern-alert-success mb-4">
                  <div className="d-flex align-items-center">
                    <div className="rounded-circle bg-success bg-opacity-10 p-2 me-3">
                      <CheckCircle size={20} className="text-success" />
                    </div>
                    <div>{success}</div>
                  </div>
                </div>
              )}
              
              {isLoggedIn ? (
                <Form onSubmit={handleSubmitAttendance}>

                  
                  {session.password && (
                    <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
                      <Form.Group controlId="password">
                        <Form.Label className="fw-medium">Mật khẩu buổi học</Form.Label>
                        <div className="input-group">
                          <div className="input-group-text bg-light">
                            <Lock size={16} />
                          </div>
                          <Form.Control 
                            type="password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Nhập mật khẩu"
                            required
                            disabled={!!success}
                            className="modern-form-control"
                          />
                        </div>
                        <Form.Text className="text-muted">
                          Vui lòng nhập mật khẩu do giảng viên cung cấp
                        </Form.Text>
                      </Form.Group>
                    </div>
                  )}
                  
                  <div className="d-grid gap-2 mt-4">
                    <button 
                      type="submit" 
                      className="btn-skew-arrow"
                      disabled={
                        submitting || 
                        !!success || 
                        // Disable button if outside geofence
                        (session.monitoring_options?.location?.enabled && 
                         session.monitoring_options?.location?.geofence?.enabled &&
                         locationData && 
                         !isWithinGeofence(locationData, session.monitoring_options.location.geofence))
                      }
                    >
                      <span className="text">
                        {submitting ? (
                          <div className="d-flex align-items-center justify-content-center gap-2">
                            <Loader2 size={20} className="animate-spin" />
                            <span>Đang xử lý...</span>
                          </div>
                        ) : (() => {
                          // Sử dụng state currentAttendanceWindow đã được cập nhật
                          if (!currentAttendanceWindow) {
                            return (
                              <div className="d-flex align-items-center justify-content-center gap-2">
                                <i className="fas fa-check-circle"></i>
                                <span>Điểm danh</span>
                              </div>
                            );
                          }
                          
                          let icon = 'fas fa-check-circle';
                          let text = 'Điểm danh';
                          
                          switch (currentAttendanceWindow.type) {
                            case 'before':
                              text = 'Điểm danh trước buổi học';
                              icon = 'fas fa-hourglass-start';
                              break;
                            case 'during':
                              text = 'Điểm danh trong buổi học';
                              icon = 'fas fa-clock';
                              break;
                            case 'after':
                              text = 'Điểm danh sau buổi học';
                              icon = 'fas fa-hourglass-end';
                              break;
                            case 'early':
                              text = 'Điểm danh sớm';
                              icon = 'fas fa-running';
                              break;
                            case 'late':
                              text = 'Điểm danh trễ';
                              icon = 'fas fa-user-clock';
                              break;
                            case 'late_leave':
                              text = 'Điểm danh về trễ';
                              icon = 'fas fa-sign-out-alt';
                              break;
                            default:
                              break;
                          }
                          
                          return (
                            <div className="d-flex align-items-center justify-content-center gap-2">
                              <i className={icon}></i>
                              <span>{text}</span>
                            </div>
                          );
                        })()}
                      </span>
                      <span className="arrow">
                        <svg width="50px" height="20px" viewBox="0 0 66 43" version="1" xmlns="http://www.w3.org/2000/svg">
                          <g id="arrow" stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
                            <path className="one" d="M40.1543933,3.89485454 L43.9763149,0.139296592 C44.1708311,-0.0518420739 44.4826329,-0.0518571125 44.6771675,0.139262789 L65.6916134,20.7848311 C66.0855801,21.1718824 66.0911863,21.8050225 65.704135,22.1989893 L44.677098,42.8607841 C44.4825957,43.0519059 44.1708242,43.0519358 43.9762853,42.8608513 L40.1545186,39.1069479 C39.9575152,38.9134427 39.9546793,38.5968729 40.1481845,38.3998695 L56.9937789,21.8567812 C57.1908028,21.6632968 57.193672,21.3467273 57.0001876,21.1497035 L40.1545208,4.60825197 C39.9574869,4.41477773 39.9546013,4.09820839 40.1480756,3.90117456 Z" fill="#FFFFFF"></path>
                            <path className="two" d="M20.1543933,3.89485454 L23.9763149,0.139296592 C24.1708311,-0.0518420739 24.4826329,-0.0518571125 24.6771675,0.139262789 L45.6916134,20.7848311 C46.0855801,21.1718824 46.0911863,21.8050225 45.704135,22.1989893 L24.677098,42.8607841 C24.4825957,43.0519059 24.1708242,43.0519358 23.9762853,42.8608513 L20.1545186,39.1069479 C19.9575152,38.9134427 19.9546793,38.5968729 20.1481845,38.3998695 L36.9937789,21.8567812 C37.1908028,21.6632968 37.193672,21.3467273 37.0001876,21.1497035 L20.1545208,4.60825197 C19.9574869,4.41477773 19.9546013,4.09820839 20.1480756,3.90117456 Z" fill="#FFFFFF"></path>
                            <path className="three" d="M0.154393339,3.89485454 L3.97631488,0.139296592 C4.17083111,-0.0518420739 4.48263286,-0.0518571125 4.67716753,0.139262789 L25.6916134,20.7848311 C26.0855801,21.1718824 26.0911863,21.8050225 25.704135,22.1989893 L4.67709797,42.8607841 C4.48259567,43.0519059 4.17082418,43.0519358 3.97628526,42.8608513 L0.154518591,39.1069479 C-0.0424848215,38.9134427 -0.0453206733,38.5968729 0.148184538,38.3998695 L16.9937789,21.8567812 C17.1908028,21.6632968 17.193672,21.3467273 17.0001876,21.1497035 L0.15452076,4.60825197 C-0.0425130651,4.41477773 -0.0453986756,4.09820839 0.148075568,3.90117456 Z" fill="#FFFFFF"></path>
                          </g>
                        </svg>
                      </span>
                    </button>
                    
                    {/* Show message when button is disabled due to geofence */}
                    {session.monitoring_options?.location?.enabled && 
                     session.monitoring_options?.location?.geofence?.enabled &&
                     locationData && 
                     !isWithinGeofence(locationData, session.monitoring_options.location.geofence) && (
                      <div className="modern-alert modern-alert-danger mt-2 mb-0">
                        <div className="d-flex align-items-center">
                          <i className="fas fa-exclamation-triangle me-2"></i>
                          <div>Bạn phải ở trong phạm vi cho phép để điểm danh</div>
                        </div>
                      </div>
                    )}
                  </div>
                </Form>
              ) : (
                <div className="bg-white rounded-lg p-4 text-center shadow-sm">
                  <div className="rounded-circle bg-primary bg-opacity-10 d-inline-flex align-items-center justify-content-center mb-3" style={{width: '80px', height: '80px'}}>
                    <Lock size={32} className="text-primary" />
                  </div>
                  <h5 className="mb-2">Vui lòng đăng nhập để điểm danh</h5>
                  <p className="text-muted mb-4">Hệ thống sẽ tự động sử dụng thông tin tài khoản của bạn để điểm danh.</p>
                  
                  <Button 
                    className="modern-btn modern-btn-primary py-2 mb-3 w-100"
                    onClick={handleLogin}
                    size="lg"
                  >
                    <i className="fas fa-sign-in-alt me-2"></i>
                    Đăng nhập ngay
                  </Button>
                  
                  <div className="d-flex align-items-center my-3">
                    <hr className="flex-grow-1" />
                    <span className="mx-3 text-muted small">hoặc</span>
                    <hr className="flex-grow-1" />
                  </div>
                  
                  <div className="d-flex justify-content-center">
                    <GoogleLogin
                      onSuccess={async (credentialResponse) => {
                        try {
                          await googleLogin(credentialResponse);
                          // After successful login, the page will refresh and show the attendance form
                        } catch (error) {
                          setError('Đăng nhập bằng Google thất bại');
                        }
                      }}
                      onError={() => {
                        setError('Đăng nhập bằng Google thất bại');
                      }}
                      size="large"
                      width="300"
                      text="signin_with"
                      shape="rectangular"
                      logo_alignment="center"
                      locale="vi"
                    />
                  </div>
                </div>
              )}
              
              {!hasLocationPermission && (
                <div className="modern-alert modern-alert-warning mt-4">
                  <div className="d-flex align-items-center">
                    <div className="rounded-circle bg-warning bg-opacity-10 p-2 me-3">
                      <i className="fas fa-exclamation-triangle text-warning"></i>
                    </div>
                    <div>Vui lòng cho phép truy cập vị trí để có thể điểm danh chính xác hơn</div>
                  </div>
                </div>
              )}
              
            </div>
            <div className="card-footer bg-white text-center border-0">
              <small className="text-muted">PCTU Clinical Learning Monitoring System</small>
            </div>
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default AttendanceSession;