import React, { useState, useEffect, useRef } from 'react';
import { Button, Form, Dropdown } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import Pagination from '../../components/Pagination';
import * as XLSX from 'xlsx';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';
import '../../styles/modern-ui.css';

const PersonalAttendance = () => {
  usePageTitle('Chấm công cá nhân');
  const { api } = useAuth();
  const { showAlert } = useAlert();
  const [todayStatus, setTodayStatus] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // 'checkin' | 'checkout' | null
  
  // Refs to prevent multiple simultaneous requests (synchronous check)
  const isProcessingCheckInRef = useRef(false);
  const isProcessingCheckOutRef = useRef(false);
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [workSchedule, setWorkSchedule] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalItems: 0,
    totalPages: 0
  });
  
  // Update pagination when attendanceRecords change
  useEffect(() => {
    const totalItems = attendanceRecords.length;
    const totalPages = Math.ceil(totalItems / pagination.limit);
    setPagination(prev => ({
      ...prev,
      totalItems,
      totalPages,
      page: prev.page > totalPages && totalPages > 0 ? totalPages : prev.page
    }));
  }, [attendanceRecords, pagination.limit]);
  
  // Animation states
  const [animatingTime, setAnimatingTime] = useState(null);
  const [animationType, setAnimationType] = useState(null); // 'checkin' or 'checkout'
  
  // CAPTCHA states
  const [captchaData, setCaptchaData] = useState(null);
  const [recaptchaToken, setRecaptchaToken] = useState('');
  const [recaptchaId, setRecaptchaId] = useState(`g-recaptcha-attendance-${Date.now()}`);
  const [simpleCaptchaAnswer, setSimpleCaptchaAnswer] = useState('');
  
  // Advanced device detection using hardware characteristics that cannot be easily faked
  // This function collects multiple hardware/behavioral signals that are difficult to spoof
  const detectRealDeviceType = async () => {
    try {
      const signals = {
        // Hardware characteristics
        hardwareConcurrency: navigator.hardwareConcurrency || 0, // CPU cores
        deviceMemory: navigator.deviceMemory || 0, // RAM in GB (if available)
        platform: navigator.platform || '',
        
        // Screen properties (actual screen vs viewport)
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        screenAvailWidth: window.screen.availWidth,
        screenAvailHeight: window.screen.availHeight,
        windowInnerWidth: window.innerWidth,
        windowInnerHeight: window.innerHeight,
        
        // Touch/Mouse capabilities
        maxTouchPoints: navigator.maxTouchPoints || 0,
        hasTouchSupport: 'ontouchstart' in window,
        hasCoarsePointer: window.matchMedia && window.matchMedia('(pointer: coarse)').matches,
        hasFinePointer: window.matchMedia && window.matchMedia('(pointer: fine)').matches,
        
        // Mobile-specific APIs
        hasBatteryAPI: 'getBattery' in navigator,
        hasConnectionAPI: 'connection' in navigator || 'mozConnection' in navigator || 'webkitConnection' in navigator,
        hasOrientationAPI: 'orientation' in window || 'DeviceOrientationEvent' in window,
        hasDeviceMotion: 'DeviceMotionEvent' in window,
        
        // User agent (can be faked, but we check consistency)
        userAgent: navigator.userAgent,
        
        // WebGL renderer (GPU info - harder to fake)
        webGLRenderer: null,
        
        // Battery info (if available)
        hasBattery: false,
        batteryLevel: null,
        
        // Connection info (if available)
        connectionType: null,
        isCellular: false
      };
      
      // Try to get battery info (mobile devices usually have battery)
      // Use timeout to avoid blocking
      try {
        if (navigator.getBattery) {
          const batteryPromise = navigator.getBattery();
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Battery API timeout')), 500)
          );
          const battery = await Promise.race([batteryPromise, timeoutPromise]);
          signals.hasBattery = true;
          signals.batteryLevel = battery.level;
        }
      } catch (e) {
        // Battery API not available, denied, or timeout
      }
      
      // Try to get connection info (mobile often has cellular)
      try {
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (connection) {
          signals.connectionType = connection.effectiveType || connection.type;
          signals.isCellular = connection.type === 'cellular' || 
            connection.type === '2g' || 
            connection.type === '3g' || 
            connection.type === '4g';
        }
      } catch (e) {
        // Connection API not available
      }
      
      // Try to get WebGL renderer info (GPU - harder to fake)
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
          if (debugInfo) {
            signals.webGLRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
          }
        }
      } catch (e) {
        // WebGL not available
      }
      
      // Analysis logic
      let mobileScore = 0;
      let tabletScore = 0;
      let desktopScore = 0;
      
      // Hardware concurrency: Mobile usually 2-8 cores, Desktop 4-16+
      if (signals.hardwareConcurrency > 0) {
        if (signals.hardwareConcurrency <= 8) {
          mobileScore += 2;
          tabletScore += 1;
        } else {
          desktopScore += 2;
        }
      }
      
      // Device memory: Mobile usually 2-8GB, Desktop 8GB+
      if (signals.deviceMemory > 0) {
        if (signals.deviceMemory <= 4) {
          mobileScore += 2;
        } else if (signals.deviceMemory <= 8) {
          mobileScore += 1;
          tabletScore += 1;
        } else {
          desktopScore += 2;
        }
      }
      
      // Screen size vs viewport mismatch (emulation indicator)
      // CRITICAL: Real mobile devices have screen size = viewport size (or very close)
      const screenSize = Math.min(signals.screenWidth, signals.screenHeight);
      const viewportSize = Math.min(signals.windowInnerWidth, signals.windowInnerHeight);
      const sizeMismatch = Math.abs(screenSize - viewportSize) > 50; // Stricter: 50px instead of 100px
      
      // Additional check: Screen width vs height ratio (mobile is usually portrait)
      const screenRatio = Math.max(signals.screenWidth, signals.screenHeight) / Math.min(signals.screenWidth, signals.screenHeight);
      const isPortraitOrientation = signals.screenHeight > signals.screenWidth;
      
      if (sizeMismatch) {
        // Large mismatch suggests emulation (PC resizing window)
        desktopScore += 5; // Increased penalty for emulation
        mobileScore -= 3; // Strong penalty
        tabletScore -= 2;
      } else {
        // Screen size analysis
        if (screenSize < 600) {
          mobileScore += 3;
          // Real mobile devices in portrait mode
          if (isPortraitOrientation && screenRatio > 1.5) {
            mobileScore += 2; // Bonus for portrait mobile
          }
        } else if (screenSize < 1024) {
          tabletScore += 2;
          mobileScore += 1;
        } else {
          desktopScore += 2;
        }
      }
      
      // Touch capabilities
      if (signals.hasCoarsePointer) {
        if (screenSize < 768) {
          mobileScore += 3;
        } else {
          tabletScore += 3;
        }
      } else if (signals.hasFinePointer && !signals.hasCoarsePointer) {
        desktopScore += 3;
      }
      
      if (signals.maxTouchPoints > 0) {
        if (screenSize < 768) {
          mobileScore += 2;
        } else {
          tabletScore += 2;
        }
      } else {
        desktopScore += 2;
      }
      
      // Battery API (mobile/tablet usually have battery)
      // CRITICAL: Real mobile devices ALWAYS have battery API
      // If frontend claims mobile but NO battery API, it's suspicious
      if (signals.hasBattery) {
        mobileScore += 3; // Increased weight
        tabletScore += 3;
        // Real mobile devices have battery level between 0-1
        if (signals.batteryLevel !== null && signals.batteryLevel >= 0 && signals.batteryLevel <= 1) {
          mobileScore += 1; // Bonus for valid battery level
        }
      } else {
        // No battery API - could be desktop or very old mobile
        // If claiming mobile but no battery, penalize
        if (screenSize < 600) {
          // Small screen but no battery = suspicious
          desktopScore += 2;
        } else {
          desktopScore += 1;
        }
      }
      
      // Connection type (cellular = mobile)
      // CRITICAL: Real mobile devices often have cellular connection
      if (signals.isCellular) {
        mobileScore += 4; // Increased weight - very strong mobile indicator
      } else {
        // No cellular - could be WiFi-only mobile or desktop
        // If small screen but no cellular, slightly suspicious but not definitive
        if (screenSize < 600 && !signals.hasBattery) {
          desktopScore += 1; // Suspicious but not definitive
        }
      }
      
      // Orientation API (mobile/tablet specific)
      if (signals.hasOrientationAPI || signals.hasDeviceMotion) {
        mobileScore += 1;
        tabletScore += 1;
      }
      
      // Platform consistency check
      const platform = signals.platform.toLowerCase();
      const ua = signals.userAgent.toLowerCase();
      const isWindows = platform.includes('win');
      const isMac = platform.includes('mac');
      const isLinux = platform.includes('linux');
      const isAndroid = platform.includes('android') || ua.includes('android');
      const isIOS = platform.includes('iphone') || platform.includes('ipad') || ua.includes('iphone') || ua.includes('ipad');
      
      // Check for inconsistency (e.g., Windows platform but mobile UA = emulation)
      // CRITICAL: Real mobile devices have mobile platform, not Windows/Mac/Linux
      if ((isWindows || isMac || isLinux) && (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone'))) {
        // Platform says desktop but UA says mobile = likely emulation
        desktopScore += 8; // Increased penalty - very strong emulation indicator
        mobileScore -= 5; // Strong penalty
        tabletScore -= 5;
      }
      
      // Additional check: If platform is Windows/Mac/Linux but screen is small
      // This is very suspicious (PC emulating mobile)
      if ((isWindows || isMac || isLinux) && screenSize < 600) {
        desktopScore += 3; // Additional penalty
      }
      
      if (isAndroid || isIOS) {
        if (screenSize < 768) {
          mobileScore += 2;
        } else {
          tabletScore += 2;
        }
      }
      
      // WebGL renderer check (mobile GPUs have specific names)
      if (signals.webGLRenderer) {
        const renderer = signals.webGLRenderer.toLowerCase();
        if (renderer.includes('adreno') || renderer.includes('mali') || renderer.includes('powervr') || 
            renderer.includes('apple gpu') || renderer.includes('apple m')) {
          if (screenSize < 768) {
            mobileScore += 2;
          } else {
            tabletScore += 2;
          }
        } else if (renderer.includes('nvidia') || renderer.includes('amd') || renderer.includes('intel')) {
          desktopScore += 1; // Desktop GPUs
        }
      }
      
      // Final decision
      const maxScore = Math.max(mobileScore, tabletScore, desktopScore);
      
      if (maxScore === mobileScore && mobileScore > 0) {
        return 'mobile';
      } else if (maxScore === tabletScore && tabletScore > 0) {
        return 'tablet';
      } else if (maxScore === desktopScore && desktopScore > 0) {
        return 'pc';
      }
      
      // Fallback: use screen size
      if (screenSize < 600) {
        return 'mobile';
      } else if (screenSize < 1024) {
        return 'tablet';
      } else {
        return 'pc';
      }
    } catch (error) {
      console.error('Error detecting device type:', error);
      // Fallback to basic detection
      const screenSize = Math.min(window.screen.width, window.screen.height);
      if (screenSize < 600) {
        return 'mobile';
      } else if (screenSize < 1024) {
        return 'tablet';
      }
      return 'pc';
    }
  };
  
  // Refs for animation
  const checkInButtonRef = useRef(null);
  const checkOutButtonRef = useRef(null);
  const statusCardRef = useRef(null);
  const checkInFieldRef = useRef(null);
  const checkOutFieldRef = useRef(null);
  
  // Filter states - default to current month
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [filterType, setFilterType] = useState('month'); // 'day', 'month', 'year'
  const [filterValue, setFilterValue] = useState(currentMonth); // Format: YYYY-MM-DD for day, YYYY-MM for month, YYYY for year

  // Get user's current location
  const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Trình duyệt không hỗ trợ định vị'));
        return;
      }

      // First try with high accuracy
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => {
          // If high accuracy fails, try with lower accuracy as fallback
          navigator.geolocation.getCurrentPosition(
            (position) => {
              resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
              });
            },
            (fallbackError) => {
              let errorMessage = 'Không thể lấy vị trí';
              switch (fallbackError.code) {
                case fallbackError.PERMISSION_DENIED:
                  errorMessage = 'Bị từ chối quyền truy cập vị trí. Vui lòng cấp quyền truy cập vị trí trong cài đặt trình duyệt.';
                  break;
                case fallbackError.POSITION_UNAVAILABLE:
                  errorMessage = 'Thông tin vị trí không khả dụng. Vui lòng kiểm tra kết nối GPS hoặc mạng.';
                  break;
                case fallbackError.TIMEOUT:
                  errorMessage = 'Hết thời gian chờ lấy vị trí. Vui lòng thử lại.';
                  break;
                default:
                  errorMessage = 'Không thể lấy vị trí. Vui lòng kiểm tra cài đặt vị trí của thiết bị.';
              }
              reject(new Error(errorMessage));
            },
            {
              enableHighAccuracy: false,
              timeout: 15000,
              maximumAge: 60000 // Accept location up to 1 minute old
            }
          );
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        }
      );
    });
  };

  // Fetch today's status
  const fetchTodayStatus = async () => {
    try {
      const response = await api.get('/employee-attendance/today');
      if (response.data.success) {
        const statusData = response.data.data;
        setTodayStatus(statusData);
      } else {
        console.warn('[fetchTodayStatus] API returned unsuccessful:', response.data);
        setTodayStatus(null);
      }
    } catch (error) {
      console.error('[fetchTodayStatus] Error fetching today status:', error);
      console.error('[fetchTodayStatus] Error details:', error.response?.data || error.message);
      setTodayStatus(null);
    }
  };

  // Fetch work schedule
  const fetchWorkSchedule = async () => {
    try {
      const response = await api.get('/employee-attendance/my-work-schedule');
      if (response.data.success && response.data.data) {
        setWorkSchedule(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching work schedule:', error);
    }
  };

  // Calculate date range based on filter
  const getDateRange = () => {
    let startDate, endDate;
    
    if (filterType === 'day') {
      startDate = filterValue;
      endDate = filterValue;
    } else if (filterType === 'month') {
      // YYYY-MM format
      const [year, month] = filterValue.split('-');
      startDate = `${year}-${month}-01`;
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    } else if (filterType === 'year') {
      // YYYY format
      startDate = `${filterValue}-01-01`;
      endDate = `${filterValue}-12-31`;
    }
    
    return { startDate, endDate };
  };

  // Fetch attendance records
  const fetchAttendanceRecords = async () => {
    try {
      setLoading(true);
      const { startDate, endDate } = getDateRange();

      const response = await api.get(
        `/employee-attendance/records?startDate=${startDate}&endDate=${endDate}`
      );
      if (response.data.success) {
        setAttendanceRecords(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching attendance records:', error);
      showAlert('Không thể tải dữ liệu chấm công', 'danger', 'Lỗi');
    } finally {
      setLoading(false);
    }
  };

  // Fetch CAPTCHA config
  const fetchCaptchaConfig = async () => {
    try {
      const response = await api.get('/employee-attendance/captcha-config');
      if (response.data.captchaRequired) {
        setCaptchaData(response.data);
        // Reset answers when fetching new CAPTCHA
        if (response.data.captchaType === 'simple') {
          setSimpleCaptchaAnswer('');
        } else if (response.data.captchaType === 'recaptcha') {
          setRecaptchaToken('');
        }
      } else {
        setCaptchaData(null);
        setSimpleCaptchaAnswer('');
        setRecaptchaToken('');
      }
    } catch (error) {
      console.error('Error fetching CAPTCHA config:', error);
      setCaptchaData(null);
      setSimpleCaptchaAnswer('');
      setRecaptchaToken('');
    }
  };

  // Load reCAPTCHA script when needed
  useEffect(() => {
    if (captchaData?.captchaType === 'recaptcha' && captchaData?.siteKey) {
      // Check if script already exists
      if (document.getElementById('recaptcha-script-attendance')) {
        return; // Script already loaded
      }
      
      // Load Google reCAPTCHA script
      const script = document.createElement('script');
      script.id = 'recaptcha-script-attendance';
      script.src = 'https://www.google.com/recaptcha/api.js?onload=onRecaptchaAttendanceLoaded&render=explicit&hl=vi';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
      
      // Callback when script is loaded
      window.onRecaptchaAttendanceLoaded = () => {
        // Script loaded, but wait for DOM element to exist before rendering
        if (pendingAction && document.getElementById(recaptchaId)) {
          renderRecaptcha();
        }
      };
      
      // Cleanup
      return () => {
        if (document.getElementById('recaptcha-script-attendance')) {
          document.getElementById('recaptcha-script-attendance').remove();
        }
        delete window.onRecaptchaAttendanceLoaded;
        // Reset reCAPTCHA widget
        if (window.grecaptcha && document.getElementById(recaptchaId)) {
          try {
            window.grecaptcha.reset();
          } catch (e) {
            // Widget might not be rendered yet
          }
        }
      };
    }
  }, [captchaData]);

  // Render reCAPTCHA widget when DOM element is available
  useEffect(() => {
    // Only render when:
    // 1. reCAPTCHA is required
    // 2. pendingAction is set (confirmation card is visible)
    // 3. Script is loaded
    // 4. DOM element exists
    if (
      captchaData?.captchaType === 'recaptcha' && 
      captchaData?.siteKey &&
      pendingAction &&
      window.grecaptcha &&
      document.getElementById(recaptchaId)
    ) {
      // Use setTimeout to ensure DOM is fully ready
      const timer = setTimeout(() => {
        renderRecaptcha();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [pendingAction, captchaData, recaptchaId]);

  // Render reCAPTCHA widget
  const renderRecaptcha = () => {
    const container = document.getElementById(recaptchaId);
    if (container && window.grecaptcha && captchaData?.siteKey) {
      // Check if already rendered to avoid duplicate renders
      if (container.hasChildNodes() && container.querySelector('.g-recaptcha')) {
        return; // Already rendered
      }
      
      // Clear container first
      container.innerHTML = '';
      
      try {
        window.grecaptcha.render(recaptchaId, {
          'sitekey': captchaData.siteKey,
          'callback': (token) => {
            // Save token when user completes challenge
            setRecaptchaToken(token);
          },
          'expired-callback': () => {
            // Auto reload when token expires
            setRecaptchaToken('');
            if (window.grecaptcha && document.getElementById(recaptchaId)) {
              window.grecaptcha.reset();
            }
          },
          'error-callback': (error) => {
            // Handle error
            console.error('reCAPTCHA error:', error);
            setRecaptchaToken('');
            if (window.grecaptcha && document.getElementById(recaptchaId)) {
              window.grecaptcha.reset();
            }
          }
        });
      } catch (error) {
        console.error('Error rendering reCAPTCHA:', error);
      }
    }
  };

  // Reload reCAPTCHA
  const reloadRecaptcha = () => {
    if (window.grecaptcha && document.getElementById(recaptchaId)) {
      window.grecaptcha.reset();
      setRecaptchaToken('');
    }
  };

  useEffect(() => {
    fetchTodayStatus();
    fetchAttendanceRecords();
    fetchWorkSchedule();
    fetchCaptchaConfig();
    
    // Update current time every second
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(timeInterval);
  }, []);

  // Refetch when filter changes
  useEffect(() => {
    fetchAttendanceRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, filterValue]);

  // Handle check-in click - show confirmation
  const handleCheckIn = async () => {
    if (!canCheckIn || checkingIn || checkingOut || pendingAction) {
      return;
    }
    // Fetch CAPTCHA config if needed (to get fresh CAPTCHA for simple type)
    if (captchaData?.captchaType === 'simple') {
      await fetchCaptchaConfig();
    }
    setPendingAction('checkin');
  };

  // Actually perform check-in
  const confirmCheckIn = async () => {
    // Check CAPTCHA if required
    if (captchaData?.captchaRequired) {
      if (captchaData.captchaType === 'recaptcha' && !recaptchaToken) {
        showAlert('Vui lòng xác nhận bạn không phải là robot bằng cách hoàn thành reCAPTCHA', 'warning', 'Cảnh báo');
        return;
      }
      if (captchaData.captchaType === 'simple' && !simpleCaptchaAnswer) {
        showAlert('Vui lòng nhập kết quả phép tính', 'warning', 'Cảnh báo');
        return;
      }
    }
    
    // Prevent multiple simultaneous requests
    if (isProcessingCheckInRef.current || isProcessingCheckOutRef.current) {
      console.warn('Check-in request ignored: Already processing another request');
      return;
    }
    
    // Set processing flag immediately (synchronous)
    isProcessingCheckInRef.current = true;
    setPendingAction(null); // Clear pending action
    const captchaId = captchaData?.captchaId || null;
    const captchaAnswer = captchaData?.captchaType === 'simple' ? simpleCaptchaAnswer : null;
    const recaptchaTokenValue = captchaData?.captchaType === 'recaptcha' ? recaptchaToken : null;
    setRecaptchaToken(''); // Clear token after use
    setSimpleCaptchaAnswer(''); // Clear answer after use
    
    let currentLocation = null;
    let realDeviceType = 'pc'; // Default fallback
    
    try {
      setCheckingIn(true);
      setLocationError(null);

      // Get location - try to get with retry, but don't block API call if fails
      let locationRetries = 0;
      const maxLocationRetries = 2;
      let locationSuccess = false;
      
      while (locationRetries <= maxLocationRetries && !locationSuccess) {
        try {
          const location = await getCurrentLocation();
          if (location && location.latitude && location.longitude) {
            currentLocation = location;
            setLocation(currentLocation);
            setLocationError(null);
            locationSuccess = true;
            break; // Success, exit retry loop
          } else {
            throw new Error('Location data không hợp lệ');
          }
        } catch (locationError) {
          locationRetries++;
          console.error(`Error getting location (attempt ${locationRetries}/${maxLocationRetries + 1}):`, locationError);
          
          if (locationRetries > maxLocationRetries) {
            // All retries failed
            setLocationError(locationError.message);
            // Show warning but continue - API will handle missing location
            showAlert('Cảnh báo: ' + (locationError.message || 'Không thể lấy vị trí sau nhiều lần thử. Vẫn tiếp tục check-in...'), 'warning', 'Cảnh báo');
            // Use null location - backend will handle validation
            currentLocation = { latitude: null, longitude: null };
            locationSuccess = true; // Exit loop even though failed
          } else {
            // Wait a bit before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      // Detect real device type - use fallback if fails
      try {
        realDeviceType = await detectRealDeviceType();
      } catch (deviceError) {
        console.warn('Error detecting device type, using fallback:', deviceError);
        // Continue with fallback - don't block API call
        realDeviceType = 'pc';
      }

      // CRITICAL: Always call API when OK is clicked
      // This ensures API is always called regardless of location/device detection status
      console.log('Calling check-in API with:', {
        latitude: currentLocation?.latitude,
        longitude: currentLocation?.longitude,
        deviceType: realDeviceType
      });
      
      // API call - ALWAYS executed when OK is clicked
      const response = await api.post('/employee-attendance/check-in', {
        latitude: currentLocation?.latitude || null,
        longitude: currentLocation?.longitude || null,
        deviceType: realDeviceType,
        recaptchaToken: recaptchaTokenValue || null,
        captchaId: captchaId || null,
        captchaAnswer: captchaAnswer || null
      });
      
      // Reset CAPTCHA after successful API call
      if (captchaData?.captchaType === 'recaptcha') {
        reloadRecaptcha();
      } else if (captchaData?.captchaType === 'simple') {
        // Reload simple CAPTCHA
        fetchCaptchaConfig();
      }

      if (response.data.success) {
        showAlert('Check-in thành công!', 'success', 'Thành công');
        
        // Trigger animation
        const timeStr = formatTimeDisplay(new Date());
        
        // Use setTimeout to ensure DOM is ready
        setTimeout(() => {
          if (checkInButtonRef.current) {
            const buttonRect = checkInButtonRef.current.getBoundingClientRect();
            let endX, endY;
            
            // Try to get exact position of check-in field
            if (checkInFieldRef.current) {
              const fieldRect = checkInFieldRef.current.getBoundingClientRect();
              endX = fieldRect.left + fieldRect.width / 2;
              endY = fieldRect.top + fieldRect.height / 2;
            } else if (statusCardRef.current) {
              // Fallback: approximate position
              const cardRect = statusCardRef.current.getBoundingClientRect();
              endX = cardRect.left + 150;
              endY = cardRect.top + 180;
            } else {
              // No card yet, use button position
              endX = buttonRect.left;
              endY = buttonRect.top + 200;
            }
            
            setAnimatingTime({
              text: timeStr,
              startX: buttonRect.left + buttonRect.width / 2,
              startY: buttonRect.top + buttonRect.height / 2,
              endX: endX,
              endY: endY
            });
            setAnimationType('checkin');
          } else {
            setAnimatingTime({ text: timeStr });
            setAnimationType('checkin');
          }
        }, 50);
        
        // Update todayStatus immediately from response data
        if (response.data.data) {
          console.log('[handleCheckIn] Updating todayStatus from response:', {
            check_in_time: response.data.data.check_in_time,
            check_out_time: response.data.data.check_out_time,
            status_code: response.data.data.status_code
          });
          
          // Delay update to allow animation
          setTimeout(() => {
            setTodayStatus(response.data.data);
            setAnimatingTime(null);
            setAnimationType(null);
          }, 1000);
        }
        
        // Then sync with server
        await fetchTodayStatus();
        await fetchAttendanceRecords();
      } else {
        showAlert(response.data.message || 'Check-in thất bại', 'danger', 'Lỗi');
      }
    } catch (error) {
      console.error('Error checking in:', error);
      if (error.message && error.message.includes('vị trí')) {
        setLocationError(error.message);
        showAlert(error.message, 'danger', 'Lỗi');
      } else if (error.response?.data?.message) {
        showAlert(error.response.data.message, 'danger', 'Lỗi');
      } else {
        showAlert('Lỗi khi check-in. Vui lòng thử lại.', 'danger', 'Lỗi');
      }
    } finally {
      setCheckingIn(false);
      isProcessingCheckInRef.current = false; // Reset processing flag
    }
  };

  // Handle check-out click - show confirmation
  const handleCheckOut = async () => {
    if (!canCheckOut || checkingIn || checkingOut || pendingAction) {
      return;
    }
    // Fetch CAPTCHA config if needed (to get fresh CAPTCHA for simple type)
    if (captchaData?.captchaType === 'simple') {
      await fetchCaptchaConfig();
    }
    setPendingAction('checkout');
  };

  // Actually perform check-out
  const confirmCheckOut = async () => {
    // Check CAPTCHA if required
    if (captchaData?.captchaRequired) {
      if (captchaData.captchaType === 'recaptcha' && !recaptchaToken) {
        showAlert('Vui lòng xác nhận bạn không phải là robot bằng cách hoàn thành reCAPTCHA', 'warning', 'Cảnh báo');
        return;
      }
      if (captchaData.captchaType === 'simple' && !simpleCaptchaAnswer) {
        showAlert('Vui lòng nhập kết quả phép tính', 'warning', 'Cảnh báo');
        return;
      }
    }
    
    // Prevent multiple simultaneous requests
    if (isProcessingCheckInRef.current || isProcessingCheckOutRef.current) {
      console.warn('Check-out request ignored: Already processing another request');
      return;
    }
    
    // Set processing flag immediately (synchronous)
    isProcessingCheckOutRef.current = true;
    setPendingAction(null); // Clear pending action
    const captchaId = captchaData?.captchaId || null;
    const captchaAnswer = captchaData?.captchaType === 'simple' ? simpleCaptchaAnswer : null;
    const recaptchaTokenValue = captchaData?.captchaType === 'recaptcha' ? recaptchaToken : null;
    setRecaptchaToken(''); // Clear token after use
    setSimpleCaptchaAnswer(''); // Clear answer after use
    
    let currentLocation = null;
    let realDeviceType = 'pc'; // Default fallback
    
    try {
      setCheckingOut(true);
      setLocationError(null);

      // Get location - try to get with retry, but don't block API call if fails
      let locationRetries = 0;
      const maxLocationRetries = 2;
      let locationSuccess = false;
      
      while (locationRetries <= maxLocationRetries && !locationSuccess) {
        try {
          const location = await getCurrentLocation();
          if (location && location.latitude && location.longitude) {
            currentLocation = location;
            setLocation(currentLocation);
            setLocationError(null);
            locationSuccess = true;
            break; // Success, exit retry loop
          } else {
            throw new Error('Location data không hợp lệ');
          }
        } catch (locationError) {
          locationRetries++;
          console.error(`Error getting location (attempt ${locationRetries}/${maxLocationRetries + 1}):`, locationError);
          
          if (locationRetries > maxLocationRetries) {
            // All retries failed
            setLocationError(locationError.message);
            // Show warning but continue - API will handle missing location
            showAlert('Cảnh báo: ' + (locationError.message || 'Không thể lấy vị trí sau nhiều lần thử. Vẫn tiếp tục check-out...'), 'warning', 'Cảnh báo');
            // Use null location - backend will handle validation
            currentLocation = { latitude: null, longitude: null };
            locationSuccess = true; // Exit loop even though failed
          } else {
            // Wait a bit before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      // Detect real device type - use fallback if fails
      try {
        realDeviceType = await detectRealDeviceType();
      } catch (deviceError) {
        console.warn('Error detecting device type, using fallback:', deviceError);
        // Continue with fallback - don't block API call
        realDeviceType = 'pc';
      }

      // CRITICAL: Always call API when OK is clicked
      // This ensures API is always called regardless of location/device detection status
      console.log('Calling check-out API with:', {
        latitude: currentLocation?.latitude,
        longitude: currentLocation?.longitude,
        deviceType: realDeviceType
      });
      
      // CRITICAL: Always call API when OK is clicked
      // This ensures API is always called regardless of location/device detection status
      console.log('Calling check-out API with:', {
        latitude: currentLocation?.latitude,
        longitude: currentLocation?.longitude,
        deviceType: realDeviceType,
        recaptchaToken: recaptchaTokenValue,
        captchaId: captchaId,
        captchaAnswer: captchaAnswer,
        captchaData: captchaData
      });
      
      // API call - ALWAYS executed when OK is clicked
      const response = await api.post('/employee-attendance/check-out', {
        latitude: currentLocation?.latitude || null,
        longitude: currentLocation?.longitude || null,
        deviceType: realDeviceType,
        recaptchaToken: recaptchaTokenValue || null,
        captchaId: captchaId || null,
        captchaAnswer: captchaAnswer || null
      });
      
      // Reset CAPTCHA after successful API call
      if (captchaData?.captchaType === 'recaptcha') {
        reloadRecaptcha();
      } else if (captchaData?.captchaType === 'simple') {
        // Reload simple CAPTCHA
        fetchCaptchaConfig();
      }

      if (response.data.success) {
        showAlert('Check-out thành công!', 'success', 'Thành công');
        
        // Trigger animation
        const timeStr = formatTimeDisplay(new Date());
        
        // Use setTimeout to ensure DOM is ready
        setTimeout(() => {
          if (checkOutButtonRef.current) {
            const buttonRect = checkOutButtonRef.current.getBoundingClientRect();
            let endX, endY;
            
            // Try to get exact position of check-out field
            if (checkOutFieldRef.current) {
              const fieldRect = checkOutFieldRef.current.getBoundingClientRect();
              endX = fieldRect.left + fieldRect.width / 2;
              endY = fieldRect.top + fieldRect.height / 2;
            } else if (statusCardRef.current) {
              // Fallback: approximate position
              const cardRect = statusCardRef.current.getBoundingClientRect();
              endX = cardRect.left + cardRect.width - 150;
              endY = cardRect.top + 180;
            } else {
              // No card yet, use button position
              endX = buttonRect.left;
              endY = buttonRect.top + 200;
            }
            
            setAnimatingTime({
              text: timeStr,
              startX: buttonRect.left + buttonRect.width / 2,
              startY: buttonRect.top + buttonRect.height / 2,
              endX: endX,
              endY: endY
            });
            setAnimationType('checkout');
          } else {
            setAnimatingTime({ text: timeStr });
            setAnimationType('checkout');
          }
        }, 50);
        
        // Update todayStatus immediately from response data
        if (response.data.data) {
          console.log('[handleCheckOut] Updating todayStatus from response:', {
            check_in_time: response.data.data.check_in_time,
            check_out_time: response.data.data.check_out_time,
            status_code: response.data.data.status_code,
            total_hours: response.data.data.total_hours
          });
          
          // Delay update to allow animation
          setTimeout(() => {
            setTodayStatus(response.data.data);
            setAnimatingTime(null);
            setAnimationType(null);
          }, 1000);
        }
        
        // Then sync with server
        await fetchTodayStatus();
        await fetchAttendanceRecords();
      } else {
        showAlert(response.data.message || 'Check-out thất bại', 'danger', 'Lỗi');
      }
    } catch (error) {
      console.error('Error checking out:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        requestData: {
          latitude: currentLocation?.latitude,
          longitude: currentLocation?.longitude,
          deviceType: realDeviceType,
          recaptchaToken: recaptchaTokenValue,
          captchaId: captchaId,
          captchaAnswer: captchaAnswer
        }
      });
      
      if (error.message && error.message.includes('vị trí')) {
        setLocationError(error.message);
        showAlert(error.message, 'danger', 'Lỗi');
      } else if (error.response?.data?.message) {
        showAlert(error.response.data.message, 'danger', 'Lỗi');
      } else {
        showAlert('Lỗi khi check-out. Vui lòng thử lại.', 'danger', 'Lỗi');
      }
    } finally {
      setCheckingOut(false);
      isProcessingCheckOutRef.current = false; // Reset processing flag
    }
  };

  // Format time
  const formatTime = (timeString) => {
    if (!timeString) return '-';
    const date = new Date(timeString);
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Format hours
  const formatHours = (hours) => {
    if (!hours && hours !== 0) return '-';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h === 0 && m === 0) return '-';
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  // Get status badge class and text
  const getStatusBadge = (statusCode) => {
    // Handle half-day status codes (e.g., "X/2", "CNX/2")
    const isHalfDay = statusCode && statusCode.includes('/2');
    const baseCode = isHalfDay ? statusCode.split('/')[0] : statusCode;
    
    const statusMap = {
      'X': { class: 'active', text: 'Làm offline' },
      'CNX': { class: 'active', text: 'Làm offline CN' },
      'XP': { class: 'ended', text: 'Nửa ngày' },
      'O': { class: 'active', text: 'Làm online' },
      'LX': { class: 'active', text: 'Làm offline Lễ' },
      'KL': { class: 'ended', text: 'Nghỉ không lương' },
      'P': { class: 'scheduled', text: 'Nghỉ phép' },
      'CNO': { class: 'active', text: 'Làm online CN' },
      'ML': { class: 'scheduled', text: 'Nghỉ cưới' },
      'L': { class: 'scheduled', text: 'Nghỉ lễ' },
      'LO': { class: 'active', text: 'Làm online Lễ' },
      'NO': { class: 'scheduled', text: 'Nghỉ ốm' },
      'CP': { class: 'ended', text: 'Thiếu giờ ra hoặc giờ vào' },
      'XNC': { class: 'ended', text: 'Dữ liệu công thiếu cần xác nhận công' },
      'CT': { class: 'active', text: 'Công tác' }
    };

    const status = statusMap[baseCode] || { class: 'ended', text: baseCode || 'Chưa xác định' };
    
    // Add "/2" suffix for half-day statuses
    if (isHalfDay && status.text) {
      status.text = status.text + '/2';
    }
    
    return status;
  };

  // Format time for display
  const formatTimeDisplay = (date) => {
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // Parse time string to minutes (e.g., "07:30" -> 450)
  const parseTimeToMinutes = (timeString) => {
    if (!timeString) return 0;
    const parts = timeString.split(':');
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    return hours * 60 + minutes;
  };

  // Check if today is a working day
  const isWorkingDay = () => {
    if (!workSchedule || !workSchedule.work_days) return true;
    const dayOfWeek = currentTime.getDay(); // 0 = Sunday, 1 = Monday, etc.
    return workSchedule.work_days.includes(dayOfWeek);
  };

  // Get current time in minutes
  const getCurrentTimeInMinutes = () => {
    return currentTime.getHours() * 60 + currentTime.getMinutes();
  };

  // Determine button availability based on schedule and current time
  const getButtonAvailability = () => {
    // Ensure todayStatus exists and check_in_time/check_out_time are properly handled
    // Always return boolean values
    const hasCheckIn = Boolean(todayStatus?.check_in_time);
    const hasCheckOut = Boolean(todayStatus?.check_out_time);
    
    
    // If no schedule, use simple logic
    if (!workSchedule || !workSchedule.start_time || !workSchedule.end_time) {
      const result = {
        canCheckIn: !hasCheckIn,
        canCheckOut: hasCheckIn && !hasCheckOut
      };
      return result;
    }

    const startMinutes = parseTimeToMinutes(workSchedule.start_time);
    const endMinutes = parseTimeToMinutes(workSchedule.end_time);
    const currentMinutes = getCurrentTimeInMinutes();
    const isWorking = isWorkingDay();


    // If not a working day, still allow check-in/out if already started
    if (!isWorking) {
      const result = {
        canCheckIn: !hasCheckIn, // Can check-in even on non-working day if not yet checked in
        canCheckOut: hasCheckIn && !hasCheckOut // Can check-out if already checked in
      };
      console.log('[getButtonAvailability] Final result (non-working day):', result);
      return result;
    }

    // After work hours: allow check-out (even if not checked in, to record missing check-in)
    // But not allow check-in
    if (currentMinutes >= endMinutes) {
      const result = {
        canCheckIn: false, // Cannot check-in after work hours
        canCheckOut: !hasCheckOut // Can check-out if not yet checked out (even if not checked in - to record missing check-in)
      };
      return result;
    }

    // Before work hours: allow check-in, but not check-out
    if (currentMinutes < startMinutes) {
      const result = {
        canCheckIn: !hasCheckIn, // Can check-in before work hours
        canCheckOut: false // Cannot check-out before work hours
      };
      console.log('[getButtonAvailability] Final result (before work hours):', {
        ...result,
        currentMinutes,
        startMinutes
      });
      return result;
    }

    // During work hours (after start time, before end time): allow check-in (even if late) and check-out
    // Note: Check-in sau giờ bắt đầu vẫn được phép (check-in trễ)
    const result = {
      canCheckIn: !hasCheckIn, // Can check-in anytime during work hours (even if late)
      canCheckOut: hasCheckIn && !hasCheckOut
    };
    
    
    return result;
  };

  // Recalculate button availability when schedule, status, or time changes
  const buttonAvailability = React.useMemo(() => {
    return getButtonAvailability();
  }, [workSchedule, todayStatus, currentTime]);

  const canCheckIn = buttonAvailability.canCheckIn;
  const canCheckOut = buttonAvailability.canCheckOut;

  // Export to Excel
  const handleExportExcel = () => {
    try {
      const { startDate, endDate } = getDateRange();
      
      // Create Excel data
      const excelData = [
        ['Ngày', 'Check-in', 'Check-out', 'Số giờ', 'Trạng thái']
      ];
      
      attendanceRecords.forEach((record) => {
        const status = getStatusBadge(record.status_code);
        excelData.push([
          formatDate(record.work_date),
          formatTime(record.check_in_time) || '-',
          formatTime(record.check_out_time) || '-',
          formatHours(record.total_hours) || '-',
          status.text
        ]);
      });
      
      // Create worksheet
      const worksheet = XLSX.utils.aoa_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Chấm công');
      
      // Set column widths
      worksheet['!cols'] = [
        { wch: 15 },  // Ngày
        { wch: 12 },  // Check-in
        { wch: 12 },  // Check-out
        { wch: 10 },  // Số giờ
        { wch: 25 }   // Trạng thái
      ];
      
      // Generate filename based on filter
      let filename = 'cham_cong';
      if (filterType === 'day') {
        filename = `cham_cong_${filterValue}`;
      } else if (filterType === 'month') {
        filename = `cham_cong_${filterValue}`;
      } else if (filterType === 'year') {
        filename = `cham_cong_${filterValue}`;
      }
      
      XLSX.writeFile(workbook, `${filename}.xlsx`);
      showAlert('Xuất file Excel thành công!', 'success', 'Thành công');
    } catch (error) {
      console.error('Error exporting Excel:', error);
      showAlert('Lỗi khi xuất file Excel', 'danger', 'Lỗi');
    }
  };

  // Handle filter type change
  const handleFilterTypeChange = (type) => {
    setFilterType(type);
    const now = new Date();
    
    if (type === 'day') {
      setFilterValue(now.toISOString().split('T')[0]);
    } else if (type === 'month') {
      setFilterValue(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    } else if (type === 'year') {
      setFilterValue(String(now.getFullYear()));
    }
  };

  // Handle filter value change
  const handleFilterValueChange = (e) => {
    setFilterValue(e.target.value);
  };

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Chấm công</h1>
            <p className="header-subtitle">Theo dõi giờ làm việc, ca trực, nghỉ phép</p>
          </div>
          <div className="header-actions attendance-header-actions">
            {/* Filter Card */}
            <div className="attendance-filter-card">
              <div className="filter-card-body">
                <Dropdown>
                  <Dropdown.Toggle 
                    variant="outline-light" 
                    id="filter-type-dropdown" 
                    className="attendance-filter-toggle-modern"
                  >
                    <span className="filter-text">
                      {filterType === 'day' ? 'Ngày hôm nay' : filterType === 'month' ? 'Tháng hiện tại' : 'Năm hiện tại'}
                    </span>
                  </Dropdown.Toggle>
                  <Dropdown.Menu className="attendance-filter-menu-modern">
                    <Dropdown.Item 
                      onClick={() => handleFilterTypeChange('day')}
                      active={filterType === 'day'}
                      className="filter-menu-item"
                    >
                      <span>Ngày hôm nay</span>
                    </Dropdown.Item>
                    <Dropdown.Item 
                      onClick={() => handleFilterTypeChange('month')}
                      active={filterType === 'month'}
                      className="filter-menu-item"
                    >
                      <span>Theo tháng</span>
                    </Dropdown.Item>
                    <Dropdown.Item 
                      onClick={() => handleFilterTypeChange('year')}
                      active={filterType === 'year'}
                      className="filter-menu-item"
                    >
                      <span>Theo năm</span>
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
                
                <div className="filter-input-wrapper">
                  {filterType === 'day' && (
                    <div className="filter-input-group">
                      <i className="fas fa-calendar-day filter-input-icon"></i>
                      <Form.Control
                        type="date"
                        value={filterValue}
                        onChange={handleFilterValueChange}
                        className="attendance-filter-input-modern"
                      />
                    </div>
                  )}
                  {filterType === 'month' && (
                    <div className="filter-input-group">
                      <i className="fas fa-calendar-alt filter-input-icon"></i>
                      <Form.Control
                        type="month"
                        value={filterValue}
                        onChange={handleFilterValueChange}
                        className="attendance-filter-input-modern"
                      />
                    </div>
                  )}
                  {filterType === 'year' && (
                    <div className="filter-input-group">
                      <i className="fas fa-calendar filter-input-icon"></i>
                      <Form.Control
                        type="number"
                        min="2020"
                        max="2100"
                        value={filterValue}
                        onChange={handleFilterValueChange}
                        placeholder="Nhập năm"
                        className="attendance-filter-input-modern attendance-filter-year-modern"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Export Button Card */}
            <div className="attendance-export-card">
              <Button
                variant="outline-light"
                onClick={handleExportExcel}
                disabled={attendanceRecords.length === 0}
                className="attendance-export-btn-modern"
              >
                <div className="export-btn-content">
                  <i className="fas fa-file-excel"></i>
                  <span>Xuất Excel</span>
                </div>
                {attendanceRecords.length > 0 && (
                  <div className="export-badge">{attendanceRecords.length}</div>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Check-in/Check-out Buttons */}
      <div className="container-fluid" style={{ padding: '20px', marginBottom: '20px' }}>
        <div className="row justify-content-center">
          <div className="col-md-6 col-lg-4 mb-3">
            <button
              ref={checkInButtonRef}
              className="btn-skew-arrow"
              onClick={handleCheckIn}
              disabled={!canCheckIn || checkingIn || checkingOut || pendingAction}
              style={{
                opacity: (!canCheckIn || checkingIn || checkingOut || pendingAction) ? 0.6 : 1,
                cursor: (!canCheckIn || checkingIn || checkingOut || pendingAction) ? 'not-allowed' : 'pointer',
                width: '100%'
              }}
            >
              {checkingIn ? (
                <div className="d-flex align-items-center justify-content-center gap-2">
                  <i className="fas fa-spinner fa-spin"></i>
                  <span>Đang xử lý...</span>
                </div>
              ) : (
                <>
                  <span className="text">
                    <div>Check-In</div>
                    {workSchedule && (
                      <div style={{ fontSize: '12px', marginTop: '0px', opacity: 0.9 }}>
                        <div>{formatTimeDisplay(currentTime)}</div>
                      </div>
                    )}
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
                </>
              )}
            </button>
          </div>
          <div className="col-md-6 col-lg-4 mb-3">
            <button
              ref={checkOutButtonRef}
              className="btn-skew-arrow"
              onClick={handleCheckOut}
              disabled={!canCheckOut || checkingIn || checkingOut || pendingAction}
              style={{
                opacity: (!canCheckOut || checkingIn || checkingOut || pendingAction) ? 0.6 : 1,
                cursor: (!canCheckOut || checkingIn || checkingOut || pendingAction) ? 'not-allowed' : 'pointer',
                width: '100%',
                backgroundColor: '#dc3545'
              }}
            >
              {checkingOut ? (
                <div className="d-flex align-items-center justify-content-center gap-2">
                  <i className="fas fa-spinner fa-spin"></i>
                  <span>Đang xử lý...</span>
                </div>
              ) : (
                <>
                  <span className="text">
                    <div>Check-Out</div>
                    {workSchedule && (
                      <div style={{ fontSize: '12px', marginTop: '0px', opacity: 0.9 }}>
                        <div>{formatTimeDisplay(currentTime)}</div>
                      </div>
                    )}
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
                </>
              )}
            </button>
          </div>
        </div>

        {/* Confirmation Card */}
        {pendingAction && (
          <div className="row justify-content-center mt-3">
            <div className="col-md-10 col-lg-8">
              <div className="confirmation-card">
                <div className="confirmation-content">
                  {/* reCAPTCHA */}
                  {captchaData?.captchaType === 'recaptcha' && (
                    <div className="text-center">
                      <div className="recaptcha-container">
                        <div id={recaptchaId}></div>
                      </div>
                    </div>
                  )}
                  
                  {/* Simple CAPTCHA */}
                  {captchaData?.captchaType === 'simple' && (
                    <div className="text-center">
                      <div className="simple-captcha-container">
                        <div className="captcha-question">
                          {captchaData.captchaQuestion} =
                        </div>
                        <Form.Control
                          type="number"
                          placeholder="Kết quả"
                          value={simpleCaptchaAnswer}
                          onChange={(e) => setSimpleCaptchaAnswer(e.target.value)}
                          autoComplete="off"
                        />
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => fetchCaptchaConfig()}
                        >
                          <i className="fas fa-redo me-1"></i>
                          Làm mới
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  <div className="confirmation-actions">
                    <button
                      className="btn-confirm-ok"
                      onClick={pendingAction === 'checkin' ? confirmCheckIn : confirmCheckOut}
                      disabled={
                        checkingIn || 
                        checkingOut || 
                        (captchaData?.captchaRequired && captchaData.captchaType === 'recaptcha' && !recaptchaToken) ||
                        (captchaData?.captchaRequired && captchaData.captchaType === 'simple' && !simpleCaptchaAnswer)
                      }
                    >
                      <i className="fas fa-check"></i>
                      <span>OK</span>
                    </button>
                    <button
                      className="btn-confirm-cancel"
                      onClick={() => {
                        setPendingAction(null);
                        if (captchaData?.captchaType === 'recaptcha') {
                          reloadRecaptcha();
                        } else if (captchaData?.captchaType === 'simple') {
                          setSimpleCaptchaAnswer('');
                          fetchCaptchaConfig();
                        }
                      }}
                      disabled={checkingIn || checkingOut}
                    >
                      <i className="fas fa-times"></i>
                      <span>Hủy</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {locationError && (
          <div className="alert alert-danger mt-3" role="alert">
            <i className="fas fa-exclamation-triangle"></i> {locationError}
          </div>
        )}

        {/* Animated Time Element */}
        {animatingTime && (
          <div 
            className={`time-animation-element ${animationType === 'checkin' ? 'from-checkin' : 'from-checkout'}`}
            key={animatingTime.text || animatingTime}
            style={animatingTime.startX ? {
              '--start-x': `${animatingTime.startX}px`,
              '--start-y': `${animatingTime.startY}px`,
              '--end-x': `${animatingTime.endX}px`,
              '--end-y': `${animatingTime.endY}px`
            } : {}}
          >
            {animatingTime.text || animatingTime}
          </div>
        )}

        {/* Today Status Card */}
        <div className="row justify-content-center mt-3" ref={statusCardRef}>
          <div className="col-md-10 col-lg-8">
            <div className={`attendance-status-card ${animatingTime ? 'receiving-time' : ''}`}>
              <div className="status-card-header">
                <div className="status-card-icon">
                  <i className="fas fa-calendar-check"></i>
                </div>
                <h5 className="status-card-title">Trạng thái hôm nay</h5> 
              </div>
              <div className="status-card-body">
                <div className="status-info-grid">
                  <div 
                    ref={checkInFieldRef}
                    className={`status-info-item ${todayStatus?.check_in_time ? 'has-value' : ''} ${animationType === 'checkin' && animatingTime ? 'animating' : ''}`}
                  >
                    <div className="status-info-icon checkin-icon">
                      <i className="fas fa-sign-in-alt"></i>
                    </div>
                    <div className="status-info-content">
                      <div className="status-info-value">
                        {todayStatus?.check_in_time ? formatTime(todayStatus.check_in_time) : 'Chưa check-in'}
                      </div>
                    </div>
                  </div>
                  
                  <div 
                    ref={checkOutFieldRef}
                    className={`status-info-item ${todayStatus?.check_out_time ? 'has-value' : ''} ${animationType === 'checkout' && animatingTime ? 'animating' : ''}`}
                  >
                    <div className="status-info-icon checkout-icon">
                      <i className="fas fa-sign-out-alt"></i>
                    </div>
                    <div className="status-info-content">
                      <div className="status-info-value">
                        {todayStatus?.check_out_time ? formatTime(todayStatus.check_out_time) : 'Chưa check-out'}
                      </div>
                    </div>
                  </div>
                  
                  
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="session-table-container">
        <div className="table-responsive-mobile">
          {loading ? (
            <div className="text-center p-4">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Đang tải...</span>
              </div>
            </div>
          ) : attendanceRecords.length === 0 ? (
            <div className="text-center p-4">
              <p>Chưa có dữ liệu chấm công</p>
            </div>
          ) : (
            <table className="session-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Ngày</th>
                  <th>Check-in</th>
                  <th>Check-out</th>
                  <th>Số giờ</th>
                  <th>Trạng thái</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {attendanceRecords
                  .slice((pagination.page - 1) * pagination.limit, pagination.page * pagination.limit)
                  .map((record) => {
                  const status = getStatusBadge(record.status_code);
                  return (
                    <tr key={record.id}>
                      <td>{record.id || '-'}</td>
                      <td>{formatDate(record.work_date)}</td>
                      <td>{formatTime(record.check_in_time)}</td>
                      <td>{formatTime(record.check_out_time)}</td>
                      <td>{formatHours(record.total_hours)}</td>
                      <td>
                        <span className={`status-badge ${status.class}`}>
                          {status.text}
                        </span>
                      </td>
                      <td>{record.status_note || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        
        {/* Pagination */}
        {attendanceRecords.length > 0 && pagination.totalPages > 1 && (
          <div className="mt-3">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={(page) => setPagination(prev => ({ ...prev, page }))}
              maxVisiblePages={5}
              showFirstLast={true}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default PersonalAttendance;
