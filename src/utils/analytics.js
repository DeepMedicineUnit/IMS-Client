// Google Analytics utility functions
// This file provides helper functions for tracking events and page views

// Get Google Analytics tracking ID from environment
const GA_TRACKING_ID = process.env.REACT_APP_GA_TRACKING_ID || 'G-XN18S34SWC';

// Check if gtag is available
const isGtagAvailable = () => {
  return typeof window !== 'undefined' && typeof window.gtag === 'function';
};

// Track page view
export const trackPageView = (pageName, pageTitle) => {
  if (isGtagAvailable()) {
    window.gtag('config', GA_TRACKING_ID, {
      page_title: pageTitle || pageName,
      page_location: window.location.href,
      page_path: window.location.pathname
    });
  }
};

// Track custom events
export const trackEvent = (action, category, label, value) => {
  if (isGtagAvailable()) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value
    });
  }
};

// Track user login
export const trackLogin = (method = 'email') => {
  trackEvent('login', 'authentication', method);
};

// Track user logout
export const trackLogout = () => {
  trackEvent('logout', 'authentication');
};

// Track attendance
export const trackAttendance = (sessionId, attendanceType = 'normal') => {
  trackEvent('attendance', 'student_activity', attendanceType, sessionId);
};

// Track absence request
export const trackAbsenceRequest = (requestType) => {
  trackEvent('absence_request', 'student_activity', requestType);
};

// Track session creation (admin)
export const trackSessionCreation = (sessionType = 'single') => {
  trackEvent('session_creation', 'admin_activity', sessionType);
};

// Track report generation
export const trackReportGeneration = (reportType) => {
  trackEvent('report_generation', 'admin_activity', reportType);
};

// Track file upload
export const trackFileUpload = (fileType, fileSize) => {
  trackEvent('file_upload', 'user_activity', fileType, fileSize);
};

// Track error
export const trackError = (errorType, errorMessage) => {
  trackEvent('error', 'system', errorType, errorMessage);
};

// Track user role
export const trackUserRole = (role) => {
  if (isGtagAvailable()) {
    window.gtag('config', 'G-XN18S34SWC', {
      custom_map: {
        'custom_parameter_1': 'user_role'
      }
    });
    
    window.gtag('event', 'user_role', {
      user_role: role
    });
  }
};

// Track session duration
export const trackSessionDuration = (sessionId, duration) => {
  trackEvent('session_duration', 'student_activity', sessionId, duration);
};

// Track monitoring activity
export const trackMonitoringActivity = (activityType) => {
  trackEvent('monitoring_activity', 'student_activity', activityType);
};

// Track geofence violation
export const trackGeofenceViolation = (sessionId) => {
  trackEvent('geofence_violation', 'student_activity', sessionId);
};

// Track QR code scan
export const trackQRCodeScan = (scanType = 'attendance') => {
  trackEvent('qr_code_scan', 'student_activity', scanType);
};

// Track admin approval
export const trackAdminApproval = (approvalType) => {
  trackEvent('admin_approval', 'admin_activity', approvalType);
};

// Track search
export const trackSearch = (searchTerm, searchCategory) => {
  trackEvent('search', 'user_activity', searchCategory, searchTerm);
};

// Track export action
export const trackExport = (exportType, recordCount) => {
  trackEvent('export', 'admin_activity', exportType, recordCount);
};

// Track import action
export const trackImport = (importType, recordCount) => {
  trackEvent('import', 'admin_activity', importType, recordCount);
};

// Track device type
export const trackDeviceType = (deviceType) => {
  if (isGtagAvailable()) {
    window.gtag('event', 'device_type', {
      device_type: deviceType
    });
  }
};

// Track browser type
export const trackBrowserType = (browserType) => {
  if (isGtagAvailable()) {
    window.gtag('event', 'browser_type', {
      browser_type: browserType
    });
  }
};

// Initialize analytics with user info
export const initializeAnalytics = (user) => {
  if (isGtagAvailable() && user) {
    // Set user properties
    window.gtag('config', GA_TRACKING_ID, {
      user_id: user.id,
      custom_map: {
        'custom_parameter_1': 'user_role',
        'custom_parameter_2': 'user_class'
      }
    });
    
    // Track user role
    trackUserRole(user.role);
    
    // Track device type
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    trackDeviceType(isMobile ? 'mobile' : 'desktop');
    
    // Track browser type
    const browserType = getBrowserType();
    trackBrowserType(browserType);
  }
};

// Get browser type
const getBrowserType = () => {
  const userAgent = navigator.userAgent;
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Safari')) return 'Safari';
  if (userAgent.includes('Edge')) return 'Edge';
  if (userAgent.includes('Opera')) return 'Opera';
  return 'Unknown';
};

// Track performance metrics
export const trackPerformance = (metricName, value) => {
  if (isGtagAvailable()) {
    window.gtag('event', 'timing_complete', {
      name: metricName,
      value: value
    });
  }
};

// Track conversion events
export const trackConversion = (conversionType, value) => {
  trackEvent('conversion', 'business', conversionType, value);
};

// Track engagement
export const trackEngagement = (engagementType, duration) => {
  trackEvent('engagement', 'user_activity', engagementType, duration);
};

export default {
  trackPageView,
  trackEvent,
  trackLogin,
  trackLogout,
  trackAttendance,
  trackAbsenceRequest,
  trackSessionCreation,
  trackReportGeneration,
  trackFileUpload,
  trackError,
  trackUserRole,
  trackSessionDuration,
  trackMonitoringActivity,
  trackGeofenceViolation,
  trackQRCodeScan,
  trackAdminApproval,
  trackSearch,
  trackExport,
  trackImport,
  trackDeviceType,
  trackBrowserType,
  initializeAnalytics,
  trackPerformance,
  trackConversion,
  trackEngagement
};
