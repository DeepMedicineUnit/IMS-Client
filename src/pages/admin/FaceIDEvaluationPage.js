import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, Spinner, Alert, Table, Badge, Modal, Tabs, Tab } from 'react-bootstrap';
import AdminNavbar from '../../components/Navbar';
import api from '../../utils/api';
import usePageTitle from '../../hooks/usePageTitle';
import Pagination from '../../components/Pagination';
import AlertToast from '../../components/AlertToast';
import '../../styles/user.css';

// CSS to disable modal and card animations completely
const modalNoAnimationStyles = `
  .student-detail-modal.fade {
    transition: none !important;
  }
  .student-detail-modal.fade .modal-dialog {
    transition: none !important;
    transform: none !important;
    animation: none !important;
    -webkit-transition: none !important;
    -moz-transition: none !important;
    -o-transition: none !important;
  }
  .student-detail-modal.show .modal-dialog {
    transform: none !important;
    animation: none !important;
  }
  .student-detail-modal.fade .modal-backdrop {
    transition: none !important;
    animation: none !important;
    -webkit-transition: none !important;
    -moz-transition: none !important;
    -o-transition: none !important;
  }
  .student-detail-modal.show .modal-backdrop {
    opacity: 0.5 !important;
    animation: none !important;
  }
  .modal.fade {
    transition: none !important;
    -webkit-transition: none !important;
    -moz-transition: none !important;
    -o-transition: none !important;
  }
  .modal.show {
    display: block !important;
  }
  .modal-backdrop.fade {
    transition: none !important;
    animation: none !important;
    -webkit-transition: none !important;
    -moz-transition: none !important;
    -o-transition: none !important;
  }
  .modal-backdrop.show {
    opacity: 0.5 !important;
    animation: none !important;
  }
  .modal-dialog {
    transition: none !important;
    transform: none !important;
    animation: none !important;
    -webkit-transition: none !important;
    -moz-transition: none !important;
    -o-transition: none !important;
  }
  .modal-content {
    transition: none !important;
    animation: none !important;
    -webkit-transition: none !important;
    -moz-transition: none !important;
    -o-transition: none !important;
  }
  /* Disable animations for stat-card and session-card */
  .stat-card,
  .stat-card * {
    transition: none !important;
    animation: none !important;
    transform: none !important;
    -webkit-transition: none !important;
    -moz-transition: none !important;
    -o-transition: none !important;
  }
  .stat-card:hover,
  .stat-card:hover * {
    transition: none !important;
    transform: none !important;
    -webkit-transition: none !important;
    -moz-transition: none !important;
    -o-transition: none !important;
  }
  .session-card,
  .session-card * {
    transition: none !important;
    animation: none !important;
    transform: none !important;
    -webkit-transition: none !important;
    -moz-transition: none !important;
    -o-transition: none !important;
  }
  .session-card:hover,
  .session-card:hover * {
    transition: none !important;
    transform: none !important;
    -webkit-transition: none !important;
    -moz-transition: none !important;
    -o-transition: none !important;
  }
  .card-body-modern,
  .card-body-modern * {
    transition: none !important;
    animation: none !important;
    -webkit-transition: none !important;
    -moz-transition: none !important;
    -o-transition: none !important;
  }
  /* Disable all animations when modal is open */
  body.modal-open *,
  body.modal-open *:hover,
  body.modal-open *:focus,
  body.modal-open *:active {
    transition: none !important;
    animation: none !important;
    transform: none !important;
    -webkit-transition: none !important;
    -moz-transition: none !important;
    -o-transition: none !important;
    -webkit-animation: none !important;
    -moz-animation: none !important;
    -o-animation: none !important;
  }
  /* Specifically target cards and containers */
  body.modal-open .row,
  body.modal-open .col,
  body.modal-open [class*="col-"],
  body.modal-open .stat-card,
  body.modal-open .session-card,
  body.modal-open .card-body-modern,
  body.modal-open .Container,
  body.modal-open .container {
    transition: none !important;
    animation: none !important;
    transform: none !important;
    -webkit-transition: none !important;
    -moz-transition: none !important;
    -o-transition: none !important;
  }
`;

const FaceIDEvaluationPage = () => {
  usePageTitle('Đánh giá - PCTU IMS');

  const [activeTab, setActiveTab] = useState('metrics');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [filterOptions, setFilterOptions] = useState({ classes: [], locations: [] });
  
  // Filters
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [concurrentTimeWindow, setConcurrentTimeWindow] = useState(60); // Default: 60 seconds (1 minute)
  
  // Retention
  const [retentionSettings, setRetentionSettings] = useState([]);
  const [retentionLoading, setRetentionLoading] = useState(false);
  
  // Alerts
  const [alertSettings, setAlertSettings] = useState([]);
  const [alertHistory, setAlertHistory] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  
  // Toast notifications
  const [toasts, setToasts] = useState([]);
  
  // Detail modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailType, setDetailType] = useState(null); // 'completion', 'attendanceScale', 'location', 'error'
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Time window for detail modal (separate from main concurrentTimeWindow)
  const [detailTimeWindow, setDetailTimeWindow] = useState(60);
  
  // Sort state for detail tables
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'
  
  // Errors by IP and User ID
  const [errorsByIP, setErrorsByIP] = useState([]);
  const [errorsByUser, setErrorsByUser] = useState([]);
  const [errorsByIPLoading, setErrorsByIPLoading] = useState(false);
  const [errorsByUserLoading, setErrorsByUserLoading] = useState(false);
  
  // Sort state for error tables (default: Thời gian mới nhất lên đầu)
  const [ipSortColumn, setIPSortColumn] = useState('latestTimestamp');
  const [ipSortDirection, setIPSortDirection] = useState('desc');
  const [userSortColumn, setUserSortColumn] = useState('latestTimestamp');
  const [userSortDirection, setUserSortDirection] = useState('desc');
  const [errorSortColumn, setErrorSortColumn] = useState('latestTimestamp');
  const [errorSortDirection, setErrorSortDirection] = useState('desc');

  // Auto-refresh state
  const [lastMetricsHash, setLastMetricsHash] = useState(null);
  const [lastErrorsByIPHash, setLastErrorsByIPHash] = useState(null);
  const [lastErrorsByUserHash, setLastErrorsByUserHash] = useState(null);
  const [lastRetentionHash, setLastRetentionHash] = useState(null);
  const [lastAlertSettingsHash, setLastAlertSettingsHash] = useState(null);
  const [lastAlertHistoryHash, setLastAlertHistoryHash] = useState(null);
  const [lastDetailDataHash, setLastDetailDataHash] = useState(null);
  const pollingIntervalRef = React.useRef(null);
  const pollingRetentionRef = React.useRef(null);
  const pollingAlertsRef = React.useRef(null);
  const pollingDetailRef = React.useRef(null);

  // Helper function to generate hash of data for comparison
  const generateDataHash = (data) => {
    if (!data) return '';
    try {
      return JSON.stringify(data).split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a; // Convert to 32-bit integer
      }, 0).toString();
    } catch {
      return '';
    }
  };

  // Inject CSS to disable modal animations
  useEffect(() => {
    const styleId = 'modal-no-animation-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = modalNoAnimationStyles;
      document.head.appendChild(style);
    }
    return () => {
      const style = document.getElementById(styleId);
      if (style) {
        style.remove();
      }
    };
  }, []);

  // Load filter options
  useEffect(() => {
    loadFilterOptions();
  }, []);

  // Load metrics when filters change (with debounce for timeWindow)
  useEffect(() => {
    if (activeTab === 'metrics') {
      // Debounce timeWindow changes to avoid too many API calls
      const timeoutId = setTimeout(() => {
        loadMetrics();
      }, concurrentTimeWindow !== 60 ? 500 : 0); // 500ms debounce for non-default values
      
      return () => clearTimeout(timeoutId);
    }
  }, [selectedClass, selectedLocation, startDate, endDate, concurrentTimeWindow, activeTab]);

  // Load errors by IP and User ID when metrics are loaded (initial load)
  useEffect(() => {
    if (activeTab === 'metrics' && metrics && !loading && errorsByIP.length === 0 && errorsByUser.length === 0) {
      // Initial load after metrics are ready
      console.log('[Frontend] useEffect: Loading errors by IP/User (initial load)');
      loadErrorsByIP();
      loadErrorsByUser();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics, activeTab, loading]);

  // Reload errors by IP and User ID when filters change
  useEffect(() => {
    if (activeTab === 'metrics' && metrics && !loading && (errorsByIP.length > 0 || errorsByUser.length > 0)) {
      // Reload when filters change
      console.log('[Frontend] useEffect: Reloading errors by IP/User (filters changed)');
      loadErrorsByIP();
      loadErrorsByUser();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass, selectedLocation, startDate, endDate]);

  // Load retention settings
  useEffect(() => {
    if (activeTab === 'retention') {
      loadRetentionSettings();
    }
  }, [activeTab]);

  // Load alert settings and history
  useEffect(() => {
    if (activeTab === 'alerts') {
      loadAlertSettings();
      loadAlertHistory();
    }
  }, [activeTab]);

  // Auto-refresh metrics when on metrics tab - polling every 5 seconds
  useEffect(() => {
    if (activeTab !== 'metrics') {
      // Stop polling when leaving metrics tab
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    // Start polling when on metrics tab
    const startPolling = async () => {
      pollingIntervalRef.current = setInterval(async () => {
        try {
          // Silently poll for new data without blocking UI
          const params = {};
          if (selectedClass) params.className = selectedClass;
          if (selectedLocation) params.location = selectedLocation;
          if (startDate) params.startDate = startDate;
          if (endDate) params.endDate = endDate;
          params.timeWindow = concurrentTimeWindow;

          const metricsResponse = await api.get('/faceid-evaluation/metrics', { params });
          
          if (metricsResponse.data.success) {
            const newMetricsHash = generateDataHash(metricsResponse.data.data);
            
            // Only update if data has changed
            if (newMetricsHash !== lastMetricsHash) {
              console.log('[Auto-refresh] Metrics updated (new data detected)');
              setMetrics(metricsResponse.data.data);
              setLastMetricsHash(newMetricsHash);
              
              // Also refresh errors by IP and User
              setTimeout(() => {
                pollErrorsByIP(params);
                pollErrorsByUser(params);
              }, 100);
            }
          }
        } catch (err) {
          console.error('[Auto-refresh] Error polling metrics:', err.message);
          // Silently fail - don't show error toast
        }
      }, 5000); // Poll every 5 seconds
    };

    startPolling();

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedClass, selectedLocation, startDate, endDate, concurrentTimeWindow, lastMetricsHash]);

  // Auto-refresh retention settings when on retention tab - polling every 10 seconds
  useEffect(() => {
    if (activeTab !== 'retention') {
      if (pollingRetentionRef.current) {
        clearInterval(pollingRetentionRef.current);
        pollingRetentionRef.current = null;
      }
      return;
    }

    const startRetentionPolling = async () => {
      pollingRetentionRef.current = setInterval(async () => {
        try {
          const response = await api.get('/faceid-evaluation/retention');
          if (response.data.success) {
            const newHash = generateDataHash(response.data.data);
            if (newHash !== lastRetentionHash) {
              console.log('[Auto-refresh] Retention settings updated');
              setRetentionSettings(response.data.data);
              setLastRetentionHash(newHash);
            }
          }
        } catch (err) {
          console.debug('[Auto-refresh] Retention polling failed:', err.message);
        }
      }, 10000); // Poll every 10 seconds
    };

    startRetentionPolling();

    return () => {
      if (pollingRetentionRef.current) {
        clearInterval(pollingRetentionRef.current);
        pollingRetentionRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, lastRetentionHash]);

  // Auto-refresh alerts when on alerts tab - polling every 10 seconds
  useEffect(() => {
    if (activeTab !== 'alerts') {
      if (pollingAlertsRef.current) {
        clearInterval(pollingAlertsRef.current);
        pollingAlertsRef.current = null;
      }
      return;
    }

    const startAlertsPolling = async () => {
      pollingAlertsRef.current = setInterval(async () => {
        try {
          const [settingsResponse, historyResponse] = await Promise.all([
            api.get('/faceid-evaluation/alerts/settings'),
            api.get('/faceid-evaluation/alerts/history')
          ]);

          if (settingsResponse.data.success) {
            const newSettingsHash = generateDataHash(settingsResponse.data.data);
            if (newSettingsHash !== lastAlertSettingsHash) {
              console.log('[Auto-refresh] Alert settings updated');
              setAlertSettings(settingsResponse.data.data);
              setLastAlertSettingsHash(newSettingsHash);
            }
          }

          if (historyResponse.data.success) {
            const newHistoryHash = generateDataHash(historyResponse.data.data);
            if (newHistoryHash !== lastAlertHistoryHash) {
              console.log('[Auto-refresh] Alert history updated');
              setAlertHistory(historyResponse.data.data);
              setLastAlertHistoryHash(newHistoryHash);
            }
          }
        } catch (err) {
          console.debug('[Auto-refresh] Alerts polling failed:', err.message);
        }
      }, 10000); // Poll every 10 seconds
    };

    startAlertsPolling();

    return () => {
      if (pollingAlertsRef.current) {
        clearInterval(pollingAlertsRef.current);
        pollingAlertsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, lastAlertSettingsHash, lastAlertHistoryHash]);

  // Auto-refresh detail modal data when showing modal
  useEffect(() => {
    if (!showDetailModal || !detailType) {
      if (pollingDetailRef.current) {
        clearInterval(pollingDetailRef.current);
        pollingDetailRef.current = null;
      }
      return;
    }

    const startDetailPolling = async () => {
      pollingDetailRef.current = setInterval(async () => {
        try {
          const params = {};
          if (selectedClass) params.className = selectedClass;
          if (selectedLocation) params.location = selectedLocation;
          if (startDate) params.startDate = startDate;
          if (endDate) params.endDate = endDate;
          if (detailType === 'attendanceScale') params.timeWindow = detailTimeWindow;
          if (detailType === 'error' && detailData?.errorAction) params.action = detailData.errorAction;
          if (detailType === 'errorByIP' && detailData?.errorAction) params.ipAddress = detailData.errorAction;
          if (detailType === 'errorByUser' && detailData?.errorAction) params.userId = detailData.errorAction;

          let endpoint = '';
          switch(detailType) {
            case 'accuracy':
              endpoint = '/faceid-evaluation/accuracy/details';
              break;
            case 'faceidTime':
              endpoint = '/faceid-evaluation/processing-time/faceid/details';
              break;
            case 'imsTime':
              endpoint = '/faceid-evaluation/processing-time/ims/details';
              break;
            case 'faceidDistribution':
              endpoint = '/faceid-evaluation/processing-time/faceid/distribution';
              break;
            case 'completion':
              endpoint = '/faceid-evaluation/completion-time/details';
              break;
            case 'attendanceScale':
              endpoint = '/faceid-evaluation/attendance-scale/details';
              break;
            case 'location':
              endpoint = '/faceid-evaluation/location-accuracy/details';
              break;
            case 'error':
              endpoint = '/faceid-evaluation/system-stability/error-details';
              break;
            case 'errorByIP':
              endpoint = '/faceid-evaluation/system-stability/error-details-by-ip';
              break;
            case 'errorByUser':
              endpoint = '/faceid-evaluation/system-stability/error-details-by-user';
              break;
            default:
              return;
          }

          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), 15000)
          );
          
          const apiPromise = api.get(endpoint, { params });
          const response = await Promise.race([apiPromise, timeoutPromise]);

          if (response.data.success) {
            const newHash = generateDataHash(response.data.data);
            if (newHash !== lastDetailDataHash) {
              console.log('[Auto-refresh] Modal detail data updated');
              setDetailData({ ...response.data.data, errorAction: detailData?.errorAction });
              setLastDetailDataHash(newHash);
            }
          }
        } catch (err) {
          console.debug('[Auto-refresh] Detail modal polling failed:', err.message);
        }
      }, 5000); // Poll every 5 seconds for detail modal
    };

    startDetailPolling();

    return () => {
      if (pollingDetailRef.current) {
        clearInterval(pollingDetailRef.current);
        pollingDetailRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDetailModal, detailType, lastDetailDataHash]);

  const loadFilterOptions = async () => {
    try {
      const response = await api.get('/faceid-evaluation/filter-options');
      if (response.data.success) {
        setFilterOptions(response.data.data);
      }
    } catch (err) {
      console.error('Error loading filter options:', err);
      addToast('error', 'Lỗi', 'Không thể tải tùy chọn bộ lọc');
    }
  };

  const loadMetrics = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = {};
      if (selectedClass) params.className = selectedClass;
      if (selectedLocation) params.location = selectedLocation;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      params.timeWindow = concurrentTimeWindow; // Add time window for concurrent attendance calculation

      const response = await api.get('/faceid-evaluation/metrics', { params });
      
      if (response.data.success) {
        setMetrics(response.data.data);
        const hash = generateDataHash(response.data.data);
        setLastMetricsHash(hash);
        // Don't show success toast on initial load
        
        // Load errors by IP and User ID after metrics are loaded
        // Use setTimeout to ensure state is updated first
        console.log('[Frontend] Metrics loaded, calling loadErrorsByIP and loadErrorsByUser');
        setTimeout(() => {
          loadErrorsByIP();
          loadErrorsByUser();
        }, 100);
      } else {
        throw new Error(response.data.message || 'Lỗi không xác định');
      }
    } catch (err) {
      console.error('Error loading metrics:', err);
      setError(err.response?.data?.message || err.message || 'Không thể tải dữ liệu đánh giá');
      addToast('danger', 'Lỗi', 'Không thể tải dữ liệu đánh giá');
    } finally {
      setLoading(false);
    }
  };

  const loadErrorsByIP = async () => {
    console.log('[Frontend] loadErrorsByIP called');
    setErrorsByIPLoading(true);
    try {
      const params = {};
      if (selectedClass) params.className = selectedClass;
      if (selectedLocation) params.location = selectedLocation;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      console.log('[Frontend] Calling API /faceid-evaluation/system-stability/errors-by-ip with params:', params);
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout after 30 seconds')), 30000)
      );
      
      const apiPromise = api.get('/faceid-evaluation/system-stability/errors-by-ip', { params });
      
      console.log('[Frontend] Waiting for API response...');
      const response = await Promise.race([apiPromise, timeoutPromise]);
      
      console.log('[Frontend] Errors by IP API response received!');
      console.log('[Frontend] Response object:', response);
      console.log('[Frontend] Response.data:', response?.data);
      console.log('[Frontend] Response.status:', response?.status);
      
      if (response && response.data && response.data.success) {
        const breakdown = response.data.data?.breakdown || [];
        console.log('[Frontend] Setting errorsByIP with', breakdown.length, 'items');
        setErrorsByIP(breakdown);
      } else {
        console.warn('[Frontend] Errors by IP response not successful:', response?.data);
        setErrorsByIP([]);
      }
    } catch (err) {
      console.error('[Frontend] Error loading errors by IP:', err);
      console.error('[Frontend] Error response:', err.response);
      console.error('[Frontend] Error status:', err.response?.status);
      console.error('[Frontend] Error data:', err.response?.data);
      console.error('[Frontend] Error message:', err.message);
      setErrorsByIP([]);
    } finally {
      console.log('[Frontend] loadErrorsByIP finally - setting loading to false');
      setErrorsByIPLoading(false);
    }
  };

  const loadErrorsByUser = async () => {
    console.log('[Frontend] loadErrorsByUser called');
    setErrorsByUserLoading(true);
    try {
      const params = {};
      if (selectedClass) params.className = selectedClass;
      if (selectedLocation) params.location = selectedLocation;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      console.log('[Frontend] Calling API /faceid-evaluation/system-stability/errors-by-user with params:', params);
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout after 30 seconds')), 30000)
      );
      
      const apiPromise = api.get('/faceid-evaluation/system-stability/errors-by-user', { params });
      
      console.log('[Frontend] Waiting for API response...');
      const response = await Promise.race([apiPromise, timeoutPromise]);
      
      console.log('[Frontend] Errors by User API response received!');
      console.log('[Frontend] Response object:', response);
      console.log('[Frontend] Response.data:', response?.data);
      console.log('[Frontend] Response.status:', response?.status);
      
      if (response && response.data && response.data.success) {
        const breakdown = response.data.data?.breakdown || [];
        console.log('[Frontend] Setting errorsByUser with', breakdown.length, 'items');
        setErrorsByUser(breakdown);
      } else {
        console.warn('[Frontend] Errors by User response not successful:', response?.data);
        setErrorsByUser([]);
      }
    } catch (err) {
      console.error('[Frontend] Error loading errors by User ID:', err);
      console.error('[Frontend] Error response:', err.response);
      console.error('[Frontend] Error status:', err.response?.status);
      console.error('[Frontend] Error data:', err.response?.data);
      console.error('[Frontend] Error message:', err.message);
      setErrorsByUser([]);
    } finally {
      console.log('[Frontend] loadErrorsByUser finally - setting loading to false');
      setErrorsByUserLoading(false);
    }
  };

  // Silent polling functions (no loading state, no error toast)
  const pollErrorsByIP = async (params = {}) => {
    try {
      const finalParams = params || {};
      if (!finalParams.className && selectedClass) finalParams.className = selectedClass;
      if (!finalParams.location && selectedLocation) finalParams.location = selectedLocation;
      if (!finalParams.startDate && startDate) finalParams.startDate = startDate;
      if (!finalParams.endDate && endDate) finalParams.endDate = endDate;

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 15000)
      );
      
      const apiPromise = api.get('/faceid-evaluation/system-stability/errors-by-ip', { params: finalParams });
      const response = await Promise.race([apiPromise, timeoutPromise]);
      
      if (response && response.data && response.data.success) {
        const breakdown = response.data.data?.breakdown || [];
        const newHash = generateDataHash(breakdown);
        
        // Only update if data changed
        if (newHash !== lastErrorsByIPHash) {
          console.log('[Auto-refresh] Errors by IP updated');
          setErrorsByIP(breakdown);
          setLastErrorsByIPHash(newHash);
        }
      }
    } catch (err) {
      // Silently fail for polling
      console.debug('[Auto-refresh] Errors by IP polling failed:', err.message);
    }
  };

  const pollErrorsByUser = async (params = {}) => {
    try {
      const finalParams = params || {};
      if (!finalParams.className && selectedClass) finalParams.className = selectedClass;
      if (!finalParams.location && selectedLocation) finalParams.location = selectedLocation;
      if (!finalParams.startDate && startDate) finalParams.startDate = startDate;
      if (!finalParams.endDate && endDate) finalParams.endDate = endDate;

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 15000)
      );
      
      const apiPromise = api.get('/faceid-evaluation/system-stability/errors-by-user', { params: finalParams });
      const response = await Promise.race([apiPromise, timeoutPromise]);
      
      if (response && response.data && response.data.success) {
        const breakdown = response.data.data?.breakdown || [];
        const newHash = generateDataHash(breakdown);
        
        // Only update if data changed
        if (newHash !== lastErrorsByUserHash) {
          console.log('[Auto-refresh] Errors by User updated');
          setErrorsByUser(breakdown);
          setLastErrorsByUserHash(newHash);
        }
      }
    } catch (err) {
      // Silently fail for polling
      console.debug('[Auto-refresh] Errors by User polling failed:', err.message);
    }
  };

  const addToast = (variant, title, message) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, variant, title, message }]);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // Sort handler for detail tables
  const handleSort = (column) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Sort handler for IP errors table
  const handleIPSort = (column) => {
    if (ipSortColumn === column) {
      setIPSortDirection(ipSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setIPSortColumn(column);
      setIPSortDirection(column === 'latestTimestamp' ? 'desc' : 'asc');
    }
  };

  // Sort handler for User errors table
  const handleUserSort = (column) => {
    if (userSortColumn === column) {
      setUserSortDirection(userSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setUserSortColumn(column);
      setUserSortDirection(column === 'latestTimestamp' ? 'desc' : 'asc');
    }
  };

  // Sort handler for "Phân loại lỗi hệ thống" table
  const handleErrorSort = (column) => {
    if (errorSortColumn === column) {
      setErrorSortDirection(errorSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setErrorSortColumn(column);
      setErrorSortDirection(column === 'latestTimestamp' ? 'desc' : 'asc');
    }
  };

  // Format latest timestamp for display
  const formatLatestTime = (ts) => {
    if (!ts) return '-';
    try {
      const d = new Date(ts);
      return isNaN(d.getTime()) ? '-' : d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '-';
    }
  };

  // Sort data helper for IP errors
  const sortIPData = (data) => {
    if (!data || !Array.isArray(data) || data.length === 0) return data;
    if (!ipSortColumn) return [...data];
    
    return [...data].sort((a, b) => {
      let aVal = a[ipSortColumn];
      let bVal = b[ipSortColumn];
      
      if (ipSortColumn === 'count') {
        aVal = parseInt(aVal || 0);
        bVal = parseInt(bVal || 0);
      } else if (ipSortColumn === 'latestTimestamp') {
        aVal = aVal ? new Date(aVal).getTime() : 0;
        bVal = bVal ? new Date(bVal).getTime() : 0;
      }
      
      if (aVal < bVal) return ipSortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return ipSortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  };

  // Sort data helper for User errors
  const sortUserData = (data) => {
    if (!data || !Array.isArray(data) || data.length === 0) return data;
    if (!userSortColumn) return [...data];
    
    return [...data].sort((a, b) => {
      let aVal = a[userSortColumn];
      let bVal = b[userSortColumn];
      
      if (userSortColumn === 'count' || userSortColumn === 'userId') {
        aVal = parseInt(aVal || 0);
        bVal = parseInt(bVal || 0);
      } else if (userSortColumn === 'latestTimestamp') {
        aVal = aVal ? new Date(aVal).getTime() : 0;
        bVal = bVal ? new Date(bVal).getTime() : 0;
      }
      
      if (aVal < bVal) return userSortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return userSortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  };

  // Sort data helper for "Phân loại lỗi hệ thống"
  const sortErrorBreakdownData = (data) => {
    if (!data || !Array.isArray(data) || data.length === 0) return data;
    if (!errorSortColumn) return [...data];
    
    return [...data].sort((a, b) => {
      let aVal = a[errorSortColumn];
      let bVal = b[errorSortColumn];
      
      if (errorSortColumn === 'count') {
        aVal = parseInt(aVal || 0);
        bVal = parseInt(bVal || 0);
      } else if (errorSortColumn === 'latestTimestamp') {
        aVal = aVal ? new Date(aVal).getTime() : 0;
        bVal = bVal ? new Date(bVal).getTime() : 0;
      } else if (errorSortColumn === 'type') {
        aVal = (aVal || '').toString().toLowerCase();
        bVal = (bVal || '').toString().toLowerCase();
        return errorSortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      
      if (aVal < bVal) return errorSortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return errorSortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  };

  // Sort data helper function
  const sortData = (data, column, direction) => {
    if (!data || !Array.isArray(data) || data.length === 0) return data;
    
    const sorted = [...data].sort((a, b) => {
      let aVal, bVal;
      
      switch (column) {
        case 'student_name':
          aVal = (a.student_name || `ID: ${a.student_id}` || '').toLowerCase();
          bVal = (b.student_name || `ID: ${b.student_id}` || '').toLowerCase();
          break;
        case 'session_name':
          aVal = (a.session_name || `ID: ${a.session_id}` || '').toLowerCase();
          bVal = (b.session_name || `ID: ${b.session_id}` || '').toLowerCase();
          break;
        case 'total_faceid_time_ms':
          aVal = parseFloat(a.total_faceid_time_ms || 0);
          bVal = parseFloat(b.total_faceid_time_ms || 0);
          break;
        case 'request_time_ms':
          aVal = parseFloat(a.request_time_ms || 0);
          bVal = parseFloat(b.request_time_ms || 0);
          break;
        case 'processing_time_ms':
          aVal = parseFloat(a.processing_time_ms || 0);
          bVal = parseFloat(b.processing_time_ms || 0);
          break;
        case 'total_time_ms':
          aVal = parseFloat(a.total_time_ms || 0);
          bVal = parseFloat(b.total_time_ms || 0);
          break;
        case 'login_to_attendance_seconds':
          aVal = parseFloat(a.login_to_attendance_seconds || 0);
          bVal = parseFloat(b.login_to_attendance_seconds || 0);
          break;
        case 'reaccess_to_attendance_seconds':
          aVal = parseFloat(a.reaccess_to_attendance_seconds || 0);
          bVal = parseFloat(b.reaccess_to_attendance_seconds || 0);
          break;
        case 'error':
        case 'distance':
          aVal = parseFloat(a.error || a.distance || 0);
          bVal = parseFloat(b.error || b.distance || 0);
          break;
        case 'created_at':
        case 'timestamp':
          aVal = new Date(a.created_at || a.timestamp || 0).getTime();
          bVal = new Date(b.created_at || b.timestamp || 0).getTime();
          break;
        case 'face_verification_result':
          aVal = (a.face_verification_result || '').toLowerCase();
          bVal = (b.face_verification_result || '').toLowerCase();
          break;
        case 'time_bucket':
        case 'minute':
          aVal = (a.time_bucket || a.minute || '').toLowerCase();
          bVal = (b.time_bucket || b.minute || '').toLowerCase();
          break;
        case 'concurrent_count':
        case 'count':
          aVal = parseFloat(a.concurrent_count || a.count || 0);
          bVal = parseFloat(b.concurrent_count || b.count || 0);
          break;
        case 'faceid_count':
          aVal = parseFloat(a.faceid_count || 0);
          bVal = parseFloat(b.faceid_count || 0);
          break;
        case 'normal_count':
          aVal = parseFloat(a.normal_count || 0);
          bVal = parseFloat(b.normal_count || 0);
          break;
        case 'error_type':
        case 'level':
          aVal = (a.error_type || a.level || '').toLowerCase();
          bVal = (b.error_type || b.level || '').toLowerCase();
          break;
        case 'error_message':
        case 'message':
          aVal = (a.error_message || a.message || '').toLowerCase();
          bVal = (b.error_message || b.message || '').toLowerCase();
          break;
        default:
          return 0;
      }
      
      if (typeof aVal === 'string') {
        return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      } else {
        return direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
    });
    
    return sorted;
  };

  // Get sorted data based on current sort state
  const getSortedData = (data) => {
    if (!sortColumn || !data) return data;
    return sortData(data, sortColumn, sortDirection);
  };

  // Sort icon component
  const SortIcon = ({ column }) => {
    if (sortColumn !== column) {
      return <i className="fas fa-sort text-muted ms-1" style={{ fontSize: '0.8em' }}></i>;
    }
    return sortDirection === 'asc' 
      ? <i className="fas fa-sort-up text-primary ms-1" style={{ fontSize: '0.8em' }}></i>
      : <i className="fas fa-sort-down text-primary ms-1" style={{ fontSize: '0.8em' }}></i>;
  };

  // Sortable header component
  const SortableHeader = ({ column, children, onClick }) => {
    return (
      <th 
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={() => handleSort(column)}
      >
        {children} <SortIcon column={column} />
      </th>
    );
  };

  const handleResetFilters = () => {
    setSelectedClass('');
    setSelectedLocation('');
    setStartDate('');
    setEndDate('');
    setConcurrentTimeWindow(60); // Reset to default 1 minute
  };

  const loadRetentionSettings = async () => {
    setRetentionLoading(true);
    try {
      const response = await api.get('/faceid-evaluation/retention');
      if (response.data.success) {
        setRetentionSettings(response.data.data);
      }
    } catch (err) {
      console.error('Error loading retention settings:', err);
      addToast('danger', 'Lỗi', 'Không thể tải cấu hình retention');
    } finally {
      setRetentionLoading(false);
    }
  };

  const updateRetentionSetting = async (tableName, retentionDays, autoCleanup) => {
    try {
      const response = await api.put('/faceid-evaluation/retention', {
        table_name: tableName,
        retention_days: retentionDays,
        auto_cleanup_enabled: autoCleanup
      });
      if (response.data.success) {
        addToast('success', 'Thành công', 'Đã cập nhật cấu hình retention');
        loadRetentionSettings();
      }
    } catch (err) {
      console.error('Error updating retention setting:', err);
      addToast('danger', 'Lỗi', 'Không thể cập nhật cấu hình retention');
    }
  };

  const runCleanup = async (tableName) => {
    if (!window.confirm(`Bạn có chắc muốn xóa dữ liệu cũ trong bảng ${tableName}?`)) {
      return;
    }
    try {
      const response = await api.post('/faceid-evaluation/retention/cleanup', {
        table_name: tableName
      });
      if (response.data.success) {
        addToast('success', 'Thành công', `Đã xóa ${response.data.deletedCount} bản ghi cũ`);
        loadRetentionSettings();
      }
    } catch (err) {
      console.error('Error running cleanup:', err);
      addToast('danger', 'Lỗi', 'Không thể chạy cleanup');
    }
  };

  const loadAlertSettings = async () => {
    setAlertsLoading(true);
    try {
      const response = await api.get('/faceid-evaluation/alerts/settings');
      if (response.data.success) {
        setAlertSettings(response.data.data);
      }
    } catch (err) {
      console.error('Error loading alert settings:', err);
      addToast('danger', 'Lỗi', 'Không thể tải cấu hình cảnh báo');
    } finally {
      setAlertsLoading(false);
    }
  };

  const updateAlertSetting = async (id, thresholdValue, enabled, notificationChannels) => {
    try {
      const response = await api.put('/faceid-evaluation/alerts/settings', {
        id,
        threshold_value: thresholdValue,
        enabled,
        notification_channels: notificationChannels
      });
      if (response.data.success) {
        addToast('success', 'Thành công', 'Đã cập nhật cấu hình cảnh báo');
        loadAlertSettings();
      }
    } catch (err) {
      console.error('Error updating alert setting:', err);
      addToast('danger', 'Lỗi', 'Không thể cập nhật cấu hình cảnh báo');
    }
  };

  const loadAlertHistory = async () => {
    try {
      const response = await api.get('/faceid-evaluation/alerts/history', {
        params: { limit: 50 }
      });
      if (response.data.success) {
        setAlertHistory(response.data.data);
      }
    } catch (err) {
      console.error('Error loading alert history:', err);
      addToast('danger', 'Lỗi', 'Không thể tải lịch sử cảnh báo');
    }
  };

  const acknowledgeAlert = async (alertId) => {
    try {
      const response = await api.post(`/faceid-evaluation/alerts/${alertId}/acknowledge`);
      if (response.data.success) {
        addToast('success', 'Thành công', 'Đã xác nhận cảnh báo');
        loadAlertHistory();
      }
    } catch (err) {
      console.error('Error acknowledging alert:', err);
      addToast('danger', 'Lỗi', 'Không thể xác nhận cảnh báo');
    }
  };

  const MetricCard = ({ title, value, subtitle, icon, color = 'primary', onClick }) => (
    <div className="stat-card text-center p-3" style={{ cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      <div className={`stat-value text-${color}`}>{value}</div>
      <div className="stat-label">{title}</div>
      {subtitle && <div className="stat-subtitle text-muted small mt-2">{subtitle}</div>}
    </div>
  );

  const loadDetailData = async (type, errorAction = null, timeWindow = null) => {
    setDetailLoading(true);
    setDetailType(type);
    setShowDetailModal(true);
    // Reset sort when opening new modal
    setSortColumn(null);
    setSortDirection('asc');
    
    // Set detailTimeWindow when opening modal
    if (type === 'attendanceScale') {
      setDetailTimeWindow(timeWindow || concurrentTimeWindow);
    }
    
    try {
      const params = {};
      if (selectedClass) params.className = selectedClass;
      if (selectedLocation) params.location = selectedLocation;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (type === 'attendanceScale') params.timeWindow = timeWindow || detailTimeWindow || concurrentTimeWindow;
      if (type === 'error' && errorAction) params.action = errorAction;

      let endpoint = '';
      switch(type) {
        case 'accuracy':
          endpoint = '/faceid-evaluation/accuracy/details';
          break;
        case 'faceidTime':
          endpoint = '/faceid-evaluation/processing-time/faceid/details';
          break;
        case 'imsTime':
          endpoint = '/faceid-evaluation/processing-time/ims/details';
          break;
        case 'faceidDistribution':
          endpoint = '/faceid-evaluation/processing-time/faceid/distribution';
          break;
        case 'completion':
          endpoint = '/faceid-evaluation/completion-time/details';
          break;
        case 'attendanceScale':
          endpoint = '/faceid-evaluation/attendance-scale/details';
          break;
        case 'location':
          endpoint = '/faceid-evaluation/location-accuracy/details';
          break;
        case 'error':
          endpoint = '/faceid-evaluation/system-stability/error-details';
          break;
        case 'errorByIP':
          endpoint = '/faceid-evaluation/system-stability/error-details-by-ip';
          params.ipAddress = errorAction; // errorAction contains IP address in this case
          break;
        case 'errorByUser':
          endpoint = '/faceid-evaluation/system-stability/error-details-by-user';
          params.userId = errorAction; // errorAction contains User ID in this case
          break;
        default:
          return;
      }

      const response = await api.get(endpoint, { params });
      if (response.data.success) {
        setDetailData({ ...response.data.data, errorAction });
        const hash = generateDataHash(response.data.data);
        setLastDetailDataHash(hash);
      } else {
        throw new Error(response.data.message || 'Lỗi không xác định');
      }
    } catch (err) {
      console.error('Error loading detail data:', err);
      addToast('danger', 'Lỗi', 'Không thể tải dữ liệu chi tiết');
      setDetailData(null);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div>
      <AdminNavbar />
      
      {/* Toast Container */}
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        {toasts.map(toast => (
          <AlertToast
            key={toast.id}
            id={toast.id}
            variant={toast.variant}
            title={toast.title}
            message={toast.message}
            onClose={removeToast}
          />
        ))}
      </div>

      {/* Header Section */}
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Đánh giá</h1>
            <p className="header-subtitle">Phân tích và đánh giá hiệu suất hệ thống nhận diện khuôn mặt</p>
          </div>
        </div>
      </div>

      {error && <Alert variant="danger" className="m-4">{error}</Alert>}

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <Tabs 
          activeKey={activeTab} 
          onSelect={(k) => setActiveTab(k)} 
          className="custom-tabs"
        >
          <Tab eventKey="metrics" title={
            <span className="tab-title">
              <i className="fas fa-chart-line me-2"></i>
              Metrics
            </span>
          }>

            <Container fluid className="py-4">
              {/* Filters Card */}
              <div className="session-card mb-4">
                <div className="card-body-modern">
                  <Row>
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label className="info-label">
                          <i className="fas fa-users me-2"></i>
                          Lớp
                        </Form.Label>
                        <Form.Select
                          value={selectedClass}
                          onChange={(e) => setSelectedClass(e.target.value)}
                          className="form-control-modern"
                        >
                          <option value="">Tất cả lớp</option>
                          {filterOptions.classes.map(cls => (
                            <option key={cls.id} value={cls.name}>{cls.name}</option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                    </Col>
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label className="info-label">
                          <i className="fas fa-map-marker-alt me-2"></i>
                          Địa điểm
                        </Form.Label>
                        <Form.Select
                          value={selectedLocation}
                          onChange={(e) => setSelectedLocation(e.target.value)}
                          className="form-control-modern"
                        >
                          <option value="">Tất cả địa điểm</option>
                          {filterOptions.locations.map(loc => (
                            <option key={loc.id} value={loc.name}>{loc.name}</option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                    </Col>
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label className="info-label">
                          <i className="fas fa-calendar-alt me-2"></i>
                          Từ ngày
                        </Form.Label>
                        <Form.Control
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="form-control-modern"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={3}>
                      <Form.Group>
                        <Form.Label className="info-label">
                          <i className="fas fa-calendar-check me-2"></i>
                          Đến ngày
                        </Form.Label>
                        <Form.Control
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="form-control-modern"
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                  <Row className="mt-3">
                    <Col md={12} className="d-flex justify-content-end">
                      <Button variant="outline-secondary" onClick={handleResetFilters}>
                        <i className="fas fa-redo me-2"></i>
                        Đặt lại
                      </Button>
                    </Col>
                  </Row>
                </div>
              </div>

              {/* Loading State */}
              {loading && (
                <div className="text-center py-5">
                  <Spinner animation="border" variant="primary" />
                  <p className="mt-3 text-muted">Đang tải dữ liệu...</p>
                </div>
              )}

              {/* Error State */}
              {error && !loading && (
                <Alert variant="danger" className="mb-4">
                  <Alert.Heading>Lỗi</Alert.Heading>
                  <p>{error}</p>
                  <Button variant="outline-danger" onClick={loadMetrics}>
                    <i className="fas fa-redo me-2"></i>
                    Thử lại
                  </Button>
                </Alert>
              )}

              {/* Metrics Summary Card */}
              {!loading && !error && metrics && (
                <div className="session-card mb-4">
                  <div className="card-body-modern">
                    <Row>
                      <Col md={3}>
                        <MetricCard
                          title="Độ chính xác nhận diện"
                          value={metrics.accuracy?.accuracyPercentage || '0%'}
                          subtitle={`${metrics.accuracy?.successfulStudents || 0} / ${metrics.accuracy?.totalStudents || 0} sinh viên`}
                          color="success"
                          onClick={() => loadDetailData('accuracy')}
                        />
                      </Col>
                      <Col md={3}>
                        <MetricCard
                          title="Thời gian xử lý FaceID (TB)"
                          value={`${(metrics.faceidTime?.averageTime || 0).toFixed(0)} ms`}
                          subtitle={`Min: ${(metrics.faceidTime?.minTime || 0).toFixed(0)}ms | Max: ${(metrics.faceidTime?.maxTime || 0).toFixed(0)}ms`}
                          color="info"
                          onClick={() => loadDetailData('faceidTime')}
                        />
                      </Col>
                      <Col md={3}>
                        <MetricCard
                          title="Thời gian xử lý (TB)"
                          value={`${((metrics.imsTime?.averageTotalTime || 0) / 1000).toFixed(2)} s`}
                          subtitle={`Request: ${((metrics.imsTime?.averageRequestTime || 0) / 1000).toFixed(2)}s | Processing: ${((metrics.imsTime?.averageProcessingTime || 0) / 1000).toFixed(2)}s`}
                          color="primary"
                          onClick={() => loadDetailData('imsTime')}
                        />
                      </Col>
                      <Col md={3}>
                        <div className="stat-card text-center p-3" style={{ cursor: 'pointer' }} onClick={(e) => {
                          // Only trigger if click is not on the select dropdown
                          if (e.target.tagName !== 'SELECT' && e.target.closest('select') === null) {
                            loadDetailData('attendanceScale');
                          }
                        }}>
                          <div className="stat-value text-warning">{metrics.attendanceScale?.maxConcurrent || 0}</div>
                          <div className="stat-label">Quy mô điểm danh</div>
                          <div className="stat-subtitle text-muted small mt-2">
                            FaceID: {metrics.attendanceScale?.maxConcurrentFaceID || 0} | Bình thường: {metrics.attendanceScale?.maxConcurrentNormal || 0}
                          </div>
                          <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                            <Form.Select
                              size="sm"
                              value={concurrentTimeWindow}
                              onChange={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                setConcurrentTimeWindow(parseInt(e.target.value));
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="form-control-modern"
                            >
                              <option value={1}>1 giây</option>
                              <option value={10}>10 giây</option>
                              <option value={15}>15 giây</option>
                              <option value={30}>30 giây</option>
                              <option value={60}>1 phút</option>
                              <option value={300}>5 phút</option>
                              <option value={600}>10 phút</option>
                              <option value={1800}>30 phút</option>
                              <option value={3600}>1 tiếng</option>
                            </Form.Select>
                          </div>
                        </div>
                      </Col>
                    </Row>
                    <Row className="mt-3">
                      <Col md={3}>
                        <MetricCard
                          title="Thời gian hoàn tất (TB)"
                          value={`${(() => {
                            const loginAvg = metrics.completionTime?.loginToAttendance?.average || 0;
                            const reaccessAvg = metrics.completionTime?.reaccessToAttendance?.average || 0;
                            let overallAvg = 0;
                            if (loginAvg > 0 && reaccessAvg > 0) {
                              overallAvg = (loginAvg + reaccessAvg) / 2;
                            } else if (loginAvg > 0) {
                              overallAvg = loginAvg;
                            } else if (reaccessAvg > 0) {
                              overallAvg = reaccessAvg;
                            }
                            return overallAvg.toFixed(1);
                          })()}s`}
                          subtitle={`Login→Attendance: ${(metrics.completionTime?.loginToAttendance?.average || 0).toFixed(1)}s | Re-access→Attendance: ${(metrics.completionTime?.reaccessToAttendance?.average || 0).toFixed(1)}s`}
                          color="secondary"
                          onClick={() => loadDetailData('completion')}
                        />
                      </Col>
                      <Col md={3}>
                        <MetricCard
                          title="Sai số định vị (TB)"
                          value={`${(metrics.locationAccuracy?.averageError || 0).toFixed(2)} m`}
                          subtitle={`Min: ${(metrics.locationAccuracy?.minError || 0).toFixed(2)}m | Max: ${(metrics.locationAccuracy?.maxError || 0).toFixed(2)}m`}
                          color="danger"
                          onClick={() => loadDetailData('location')}
                        />
                      </Col>
                      <Col md={3}>
                        <MetricCard
                          title="Ổn định hệ thống"
                          value={metrics.systemStability?.stabilityPercentage || '100%'}
                          subtitle={`Tỷ lệ lỗi: ${metrics.systemStability?.errorRatePercentage || '0%'}`}
                          color="success"
                        />
                      </Col>
                      <Col md={3}>
                        <div className="stat-card text-center p-3" style={{ cursor: 'pointer' }} onClick={() => loadDetailData('faceidDistribution')}>
                          <div className="stat-value text-info">
                            <i className="fas fa-chart-pie"></i>
                          </div>
                          <div className="stat-label">Phân bố thời gian FaceID</div>
                          <div className="stat-subtitle text-muted small mt-2">
                            &lt; 1s: {metrics.faceidTime?.distribution?.under1s?.percentage || 0}% | &lt; 2s: {metrics.faceidTime?.distribution?.under2s?.percentage || 0}%
                          </div>
                        </div>
                      </Col>
                    </Row>
                  </div>
                </div>
              )}

              {/* Error Breakdown Tables */}
              {!loading && !error && metrics && (
                <Row>
                  <Col md={4}>
                    <div className="session-card mb-4">
                      <div className="card-body-modern">
                        <h6 className="mb-3">Phân loại lỗi hệ thống</h6>
                        {metrics.systemStability?.errorBreakdown?.length > 0 ? (
                          <div className="session-table-container">
                            {metrics.systemStability.errorBreakdownByAction?.length > 0 ? (
                              <div
                                style={{
                                  maxHeight: metrics.systemStability.errorBreakdownByAction.length > 15 ? '600px' : 'none',
                                  overflowY: metrics.systemStability.errorBreakdownByAction.length > 15 ? 'auto' : 'visible',
                                  overflowX: 'auto'
                                }}
                              >
                                <Table responsive className="session-table" striped bordered hover size="sm">
                                  <thead>
                                    <tr>
                                      <th>STT</th>
                                      <th>Hành động</th>
                                      <th>Lần</th>
                                      <th
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => handleErrorSort('latestTimestamp')}
                                      >
                                        Thời gian
                                        {errorSortColumn === 'latestTimestamp' && (
                                          <i className={`fas fa-sort-${errorSortDirection === 'asc' ? 'up' : 'down'} ms-1`}></i>
                                        )}
                                      </th>
                                      <th>Thông tin</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sortErrorBreakdownData(metrics.systemStability.errorBreakdownByAction).map((error, index) => (
                                      <tr 
                                        key={`action-${index}`} 
                                        style={{ cursor: 'pointer' }} 
                                        onClick={() => loadDetailData('error', error.type)}
                                      >
                                        <td>{index + 1}</td>
                                        <td>
                                          <strong>{error.type || 'UNKNOWN'}</strong>
                                        </td>
                                        <td>
                                          <Badge bg="danger">{error.count}</Badge>
                                        </td>
                                        <td className="text-muted small">{formatLatestTime(error.latestTimestamp)}</td>
                                        <td className="text-muted small">
                                          {error.sessionName || error.className ? (
                                            <>
                                              {error.sessionName && <div>{error.sessionName}</div>}
                                              {error.className && <div>Lớp: {error.className}</div>}
                                            </>
                                          ) : (
                                            <span className="text-muted">-</span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </Table>
                              </div>
                            ) : metrics.systemStability.errorBreakdownByLevel?.length > 0 ? (
                              <div
                                style={{
                                  maxHeight: metrics.systemStability.errorBreakdownByLevel.length > 15 ? '600px' : 'none',
                                  overflowY: metrics.systemStability.errorBreakdownByLevel.length > 15 ? 'auto' : 'visible',
                                  overflowX: 'auto'
                                }}
                              >
                                <Table responsive className="session-table" striped bordered hover size="sm">
                                  <thead>
                                    <tr>
                                      <th>STT</th>
                                      <th>Loại lỗi</th>
                                      <th>Số lỗi</th>
                                      <th
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => handleErrorSort('latestTimestamp')}
                                      >
                                        Thời gian
                                        {errorSortColumn === 'latestTimestamp' && (
                                          <i className={`fas fa-sort-${errorSortDirection === 'asc' ? 'up' : 'down'} ms-1`}></i>
                                        )}
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sortErrorBreakdownData(metrics.systemStability.errorBreakdownByLevel).map((error, index) => (
                                      <tr key={`level-${index}`}>
                                        <td>{index + 1}</td>
                                        <td>
                                          <strong>{error.type}</strong>
                                        </td>
                                        <td>
                                          <Badge bg="danger">{error.count}</Badge>
                                        </td>
                                        <td className="text-muted small">{formatLatestTime(error.latestTimestamp)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </Table>
                              </div>
                            ) : (
                              <div
                                style={{
                                  maxHeight: metrics.systemStability.errorBreakdown.length > 15 ? '600px' : 'none',
                                  overflowY: metrics.systemStability.errorBreakdown.length > 15 ? 'auto' : 'visible',
                                  overflowX: 'auto'
                                }}
                              >
                                <Table responsive className="session-table" striped bordered hover size="sm">
                                  <thead>
                                    <tr>
                                      <th>STT</th>
                                      <th>Loại lỗi</th>
                                      <th>Số lỗi</th>
                                      <th
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => handleErrorSort('latestTimestamp')}
                                      >
                                        Thời gian
                                        {errorSortColumn === 'latestTimestamp' && (
                                          <i className={`fas fa-sort-${errorSortDirection === 'asc' ? 'up' : 'down'} ms-1`}></i>
                                        )}
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sortErrorBreakdownData(metrics.systemStability.errorBreakdown).map((error, index) => (
                                      <tr key={index}>
                                        <td>{index + 1}</td>
                                        <td>
                                          <strong>{error.type}</strong>
                                        </td>
                                        <td>
                                          <Badge bg="danger">{error.count}</Badge>
                                        </td>
                                        <td className="text-muted small">{formatLatestTime(error.latestTimestamp)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </Table>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="mb-0 text-muted">Không có lỗi</p>
                        )}
                      </div>
                    </div>
                  </Col>
                  <Col md={4}>
                    <div className="session-card mb-4">
                      <div className="card-body-modern">
                        <h6 className="mb-3">Lỗi hệ thống theo IP</h6>
                        {(() => {
                          console.log('[Frontend Render] ErrorsByIP state:', {
                            loading: errorsByIPLoading,
                            length: errorsByIP.length,
                            data: errorsByIP
                          });
                          return null;
                        })()}
                        {errorsByIPLoading ? (
                          <div className="text-center py-3">
                            <Spinner animation="border" size="sm" variant="primary" />
                          </div>
                        ) : errorsByIP && errorsByIP.length > 0 ? (
                          <div className="session-table-container">
                            <div
                              style={{
                                maxHeight: errorsByIP.length > 15 ? '600px' : 'none',
                                overflowY: errorsByIP.length > 15 ? 'auto' : 'visible',
                                overflowX: 'auto'
                              }}
                            >
                              <Table responsive className="session-table" striped bordered hover size="sm">
                                <thead>
                                  <tr>
                                    <th>STT</th>
                                    <th 
                                      style={{ cursor: 'pointer' }}
                                      onClick={() => handleIPSort('ipAddress')}
                                    >
                                      IP Address
                                      {ipSortColumn === 'ipAddress' && (
                                        <i className={`fas fa-sort-${ipSortDirection === 'asc' ? 'up' : 'down'} ms-1`}></i>
                                      )}
                                    </th>
                                    <th 
                                      style={{ cursor: 'pointer' }}
                                      onClick={() => handleIPSort('count')}
                                    >
                                      Số lỗi
                                      {ipSortColumn === 'count' && (
                                        <i className={`fas fa-sort-${ipSortDirection === 'asc' ? 'up' : 'down'} ms-1`}></i>
                                      )}
                                    </th>
                                    <th 
                                      style={{ cursor: 'pointer' }}
                                      onClick={() => handleIPSort('latestTimestamp')}
                                    >
                                      Thời gian
                                      {ipSortColumn === 'latestTimestamp' && (
                                        <i className={`fas fa-sort-${ipSortDirection === 'asc' ? 'up' : 'down'} ms-1`}></i>
                                      )}
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {sortIPData(errorsByIP).map((error, index) => (
                                    <tr 
                                      key={`ip-${index}`} 
                                      style={{ cursor: 'pointer' }} 
                                      onClick={() => loadDetailData('errorByIP', error.ipAddress)}
                                    >
                                      <td>{index + 1}</td>
                                      <td>
                                        <strong>{error.ipAddress}</strong>
                                      </td>
                                      <td>
                                        <Badge bg="danger">{error.count}</Badge>
                                      </td>
                                      <td className="text-muted small">{formatLatestTime(error.latestTimestamp)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </Table>
                            </div>
                          </div>
                        ) : (
                          <p className="mb-0 text-muted">Không có dữ liệu</p>
                        )}
                      </div>
                    </div>
                  </Col>
                  <Col md={4}>
                    <div className="session-card mb-4">
                      <div className="card-body-modern">
                        <h6 className="mb-3">Lỗi hệ thống theo User ID</h6>
                        {(() => {
                          console.log('[Frontend Render] ErrorsByUser state:', {
                            loading: errorsByUserLoading,
                            length: errorsByUser.length,
                            data: errorsByUser
                          });
                          return null;
                        })()}
                        {errorsByUserLoading ? (
                          <div className="text-center py-3">
                            <Spinner animation="border" size="sm" variant="primary" />
                          </div>
                        ) : errorsByUser && errorsByUser.length > 0 ? (
                          <div className="session-table-container">
                            <div
                              style={{
                                maxHeight: errorsByUser.length > 15 ? '600px' : 'none',
                                overflowY: errorsByUser.length > 15 ? 'auto' : 'visible',
                                overflowX: 'auto'
                              }}
                            >
                              <Table responsive className="session-table" striped bordered hover size="sm">
                                <thead>
                                  <tr>
                                    <th>STT</th>
                                    <th 
                                      style={{ cursor: 'pointer' }}
                                      onClick={() => handleUserSort('userId')}
                                    >
                                      User ID
                                      {userSortColumn === 'userId' && (
                                        <i className={`fas fa-sort-${userSortDirection === 'asc' ? 'up' : 'down'} ms-1`}></i>
                                      )}
                                    </th>
                                    <th 
                                      style={{ cursor: 'pointer' }}
                                      onClick={() => handleUserSort('userName')}
                                    >
                                      Tên
                                      {userSortColumn === 'userName' && (
                                        <i className={`fas fa-sort-${userSortDirection === 'asc' ? 'up' : 'down'} ms-1`}></i>
                                      )}
                                    </th>
                                    <th 
                                      style={{ cursor: 'pointer' }}
                                      onClick={() => handleUserSort('count')}
                                    >
                                      Số lỗi
                                      {userSortColumn === 'count' && (
                                        <i className={`fas fa-sort-${userSortDirection === 'asc' ? 'up' : 'down'} ms-1`}></i>
                                      )}
                                    </th>
                                    <th 
                                      style={{ cursor: 'pointer' }}
                                      onClick={() => handleUserSort('latestTimestamp')}
                                    >
                                      Thời gian
                                      {userSortColumn === 'latestTimestamp' && (
                                        <i className={`fas fa-sort-${userSortDirection === 'asc' ? 'up' : 'down'} ms-1`}></i>
                                      )}
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {sortUserData(errorsByUser).map((error, index) => (
                                    <tr 
                                      key={`user-${index}`} 
                                      style={{ cursor: 'pointer' }} 
                                      onClick={() => loadDetailData('errorByUser', error.userId)}
                                    >
                                      <td>{index + 1}</td>
                                      <td>
                                        <strong>{error.userId}</strong>
                                      </td>
                                      <td>{error.userName}</td>
                                      <td>
                                        <Badge bg="danger">{error.count}</Badge>
                                      </td>
                                      <td className="text-muted small">{formatLatestTime(error.latestTimestamp)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </Table>
                            </div>
                          </div>
                        ) : (
                          <p className="mb-0 text-muted">Không có dữ liệu</p>
                        )}
                      </div>
                    </div>
                  </Col>
                </Row>
              )}
              </Container>
          </Tab>

          <Tab eventKey="retention" title={
            <span className="tab-title">
              <i className="fas fa-database me-2"></i>
              Retention
            </span>
          }>
            <Container fluid className="py-4">
              <div className="session-card mb-4">
                <div className="card-body-modern">
                  <h5 className="mb-4">
                    <i className="fas fa-database me-2"></i>
                    Cấu hình Retention Dữ liệu
                  </h5>
                  <div className="session-table-container">
                    {retentionLoading ? (
                      <div className="text-center py-4">
                        <Spinner animation="border" variant="primary" />
                      </div>
                    ) : (
                      <Table responsive className="session-table">
                      <thead>
                        <tr>
                          <th>Bảng</th>
                          <th>Retention (ngày)</th>
                          <th>Auto Cleanup</th>
                          <th>Lần cleanup cuối</th>
                          <th>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {retentionSettings.map((setting) => (
                          <RetentionRow
                            key={setting.id}
                            setting={setting}
                            onUpdate={updateRetentionSetting}
                            onCleanup={runCleanup}
                          />
                        ))}
                      </tbody>
                    </Table>
                  )}
                  </div>
                </div>
              </div>
            </Container>
          </Tab>

          <Tab eventKey="alerts" title={
            <span className="tab-title">
              <i className="fas fa-bell me-2"></i>
              Alerts
              {alertHistory.filter(a => a.status === 'triggered').length > 0 && (
                <Badge bg="danger" className="ms-2">
                  {alertHistory.filter(a => a.status === 'triggered').length}
                </Badge>
              )}
            </span>
          }>
            <Container fluid className="py-4">
              <div className="session-card mb-4">
                <div className="card-body-modern">
                  <h5 className="mb-4">
                    <i className="fas fa-cog me-2"></i>
                    Cấu hình Cảnh báo
                  </h5>
                  <div className="session-table-container">
                    {alertsLoading ? (
                      <div className="text-center py-4">
                        <Spinner animation="border" variant="primary" />
                      </div>
                    ) : (
                      <Table responsive className="session-table">
                        <thead>
                          <tr>
                            <th>Tên cảnh báo</th>
                            <th>Metric</th>
                            <th>Ngưỡng</th>
                            <th>Trạng thái</th>
                            <th>Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {alertSettings.map((setting) => (
                            <AlertSettingRow
                              key={setting.id}
                              setting={setting}
                              onUpdate={updateAlertSetting}
                            />
                          ))}
                        </tbody>
                      </Table>
                    )}
                  </div>
                </div>
              </div>

              <div className="session-card mb-4">
                <div className="card-body-modern">
                  <h5 className="mb-4">
                    <i className="fas fa-history me-2"></i>
                    Lịch sử Cảnh báo
                  </h5>
                  <div className="session-table-container">
                    <Table responsive className="session-table">
                    <thead>
                      <tr>
                        <th>Thời gian</th>
                        <th>Cảnh báo</th>
                        <th>Metric</th>
                        <th>Giá trị</th>
                        <th>Ngưỡng</th>
                        <th>Trạng thái</th>
                        <th>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alertHistory.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="text-center text-muted py-4">
                            Không có cảnh báo nào
                          </td>
                        </tr>
                      ) : (
                        alertHistory.map((alert) => (
                          <tr key={alert.id}>
                            <td>{new Date(alert.created_at).toLocaleString('vi-VN')}</td>
                            <td>{alert.alert_name}</td>
                            <td>{alert.metric_type}</td>
                            <td>{parseFloat(alert.metric_value).toFixed(2)}</td>
                            <td>{parseFloat(alert.threshold_value).toFixed(2)}</td>
                            <td>
                              <Badge bg={alert.status === 'triggered' ? 'danger' : alert.status === 'acknowledged' ? 'warning' : 'success'}>
                                {alert.status === 'triggered' ? 'Đang kích hoạt' : alert.status === 'acknowledged' ? 'Đã xác nhận' : 'Đã giải quyết'}
                              </Badge>
                            </td>
                            <td>
                              {alert.status === 'triggered' && (
                                <Button
                                  variant="outline-primary"
                                  size="sm"
                                  onClick={() => acknowledgeAlert(alert.id)}
                                >
                                  Xác nhận
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                      </tbody>
                    </Table>
                  </div>
                </div>
              </div>
            </Container>
          </Tab>
        </Tabs>
      </div>

      {/* Detail Modal */}
      <Modal 
        show={showDetailModal} 
        onHide={() => setShowDetailModal(false)} 
        size="lg"
        className="student-detail-modal"
        dialogClassName="modal-dialog-centered modal-dialog-scrollable"
        animation={false}
      >
        <Modal.Header closeButton className="student-detail-header">
          <Modal.Title className="student-detail-title">
            <div className="student-avatar">
              {detailType === 'accuracy' && <i className="fas fa-check-circle"></i>}
              {detailType === 'faceidTime' && <i className="fas fa-clock"></i>}
              {detailType === 'imsTime' && <i className="fas fa-server"></i>}
              {detailType === 'faceidDistribution' && <i className="fas fa-chart-pie"></i>}
              {detailType === 'completion' && <i className="fas fa-hourglass-half"></i>}
              {detailType === 'attendanceScale' && <i className="fas fa-users"></i>}
              {detailType === 'location' && <i className="fas fa-map-marker-alt"></i>}
              {detailType === 'error' && <i className="fas fa-exclamation-triangle"></i>}
              {detailType === 'errorByIP' && <i className="fas fa-network-wired"></i>}
              {detailType === 'errorByUser' && <i className="fas fa-user-times"></i>}
            </div>
            <div>
              <h4 className="mb-0">
                {detailType === 'accuracy' && 'Chi tiết Độ chính xác nhận diện'}
                {detailType === 'faceidTime' && 'Chi tiết Thời gian xử lý FaceID'}
                {detailType === 'imsTime' && 'Chi tiết Thời gian xử lý'}
                {detailType === 'faceidDistribution' && 'Chi tiết Phân bố thời gian FaceID'}
                {detailType === 'completion' && 'Chi tiết Thời gian hoàn tất'}
                {detailType === 'attendanceScale' && 'Chi tiết Quy mô điểm danh'}
                {detailType === 'location' && 'Chi tiết Sai số định vị'}
                {detailType === 'error' && `Chi tiết Lỗi: ${detailData?.errorAction || ''}`}
                {detailType === 'errorByIP' && `Chi tiết Lỗi theo IP: ${detailData?.ipAddress || ''}`}
                {detailType === 'errorByUser' && `Chi tiết Lỗi theo User: ${detailData?.userName || detailData?.userId || ''}`}
              </h4>
              {detailType === 'error' && detailData?.errorAction && (
                <p className="mb-0 student-subtitle">{detailData.errorAction}</p>
              )}
              {detailType === 'errorByIP' && detailData?.ipAddress && (
                <p className="mb-0 student-subtitle">IP: {detailData.ipAddress}</p>
              )}
              {detailType === 'errorByUser' && detailData?.userId && (
                <p className="mb-0 student-subtitle">User ID: {detailData.userId}</p>
              )}
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="student-detail-body">
          {detailLoading ? (
            <div className="text-center py-4">
              <Spinner animation="border" variant="primary" />
              <p className="mt-3 text-muted">Đang tải dữ liệu chi tiết...</p>
            </div>
          ) : detailData ? (
            <>
              {detailType === 'accuracy' && (
                <div>
                  {/* Giải thích */}
                  <Alert variant="info" className="mb-4">
                    <Alert.Heading>
                      <i className="fas fa-info-circle me-2"></i>
                      Giải thích về Độ chính xác nhận diện
                    </Alert.Heading>
                    <p className="mb-2">
                      <strong>Mục đích:</strong> Đo lường hiệu quả của hệ thống nhận diện khuôn mặt trong việc xác thực sinh viên.
                    </p>
                    <p className="mb-2">
                      <strong>Cách tính:</strong>
                    </p>
                    <ul className="mb-2">
                      <li><strong>Tổng số sinh viên:</strong> Số lượng sinh viên có face_embedding và đã thực hiện ít nhất một lần nhận diện trong khoảng thời gian được lọc.</li>
                      <li><strong>Sinh viên nhận diện thành công:</strong> Số lượng sinh viên có ít nhất một lần nhận diện thành công (face_verification_result = 'success').</li>
                      <li><strong>Sinh viên nhận diện thất bại:</strong> Số lượng sinh viên có ít nhất một lần nhận diện thất bại hoặc lỗi FaceID từ system_logs (trong vòng 30 giây, không trùng lặp với attendance_records).</li>
                      <li><strong>Tỷ lệ chính xác:</strong> (Sinh viên thành công / Tổng số sinh viên) × 100%</li>
                    </ul>
                    <p className="mb-0">
                      <strong>Ý nghĩa:</strong> Tỷ lệ càng cao cho thấy hệ thống nhận diện càng chính xác. Dữ liệu được lấy từ bảng attendance_records và system_logs (các lỗi FaceID như "Khuôn mặt không khớp", "Không phát hiện thấy khuôn mặt").
                    </p>
                  </Alert>

                  <h6 className="mb-3">Tổng số sinh viên: {detailData.totalStudents || 0}</h6>
                  <h6 className="mb-2">Sinh viên nhận diện thành công: {detailData.successfulStudents || 0}</h6>
                  <h6 className="mb-2">Sinh viên nhận diện thất bại: {detailData.failedStudents || 0}</h6>
                  <h6 className="mb-2">Tỷ lệ chính xác: {detailData.accuracyPercentage || '0%'}</h6>
                  <Table striped bordered hover size="sm">
                    <thead>
                      <tr>
                        <th>STT</th>
                        <SortableHeader column="student_name">Sinh viên</SortableHeader>
                        <SortableHeader column="session_name">Session</SortableHeader>
                        <SortableHeader column="face_verification_result">Kết quả</SortableHeader>
                        <SortableHeader column="created_at">Thời điểm</SortableHeader>
                      </tr>
                    </thead>
                    <tbody>
                      {getSortedData(detailData.records) && getSortedData(detailData.records).length > 0 ? (
                        getSortedData(detailData.records).map((record, index) => (
                          <tr key={record.id || index}>
                            <td>{index + 1}</td>
                            <td>{record.student_name || `ID: ${record.student_id}`}</td>
                            <td>
                              {record.session_name 
                                ? `${record.session_name} (ID: ${record.session_id || 'N/A'})`
                                : (record.session_id 
                                  ? `ID: ${record.session_id}`
                                  : (record.action 
                                    ? `ID: ${record.action.match(/\/api\/sessions\/(\d+)\//)?.[1] || 'N/A'}`
                                    : 'N/A'))}
                            </td>
                            <td>
                              <Badge bg={record.face_verification_result === 'success' ? 'success' : 'danger'}>
                                {record.face_verification_result === 'success' ? 'Thành công' : 'Thất bại'}
                              </Badge>
                            </td>
                            <td>{new Date(record.created_at).toLocaleString('vi-VN')}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="text-center text-muted">Không có dữ liệu</td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </div>
              )}

              {detailType === 'faceidTime' && (
                <div>
                  {/* Giải thích */}
                  <Alert variant="info" className="mb-4">
                    <Alert.Heading>
                      <i className="fas fa-info-circle me-2"></i>
                      Giải thích về Thời gian xử lý FaceID
                    </Alert.Heading>
                    <p className="mb-2">
                      <strong>Mục đích:</strong> Đo lường hiệu suất xử lý của hệ thống nhận diện khuôn mặt, từ lúc bắt đầu đến khi hoàn tất quá trình nhận diện.
                    </p>
                    <p className="mb-2">
                      <strong>Cách tính:</strong>
                    </p>
                    <ul className="mb-2">
                      <li><strong>Thời gian xử lý FaceID:</strong> Tổng thời gian (ms) từ khi bắt đầu xử lý ảnh khuôn mặt đến khi có kết quả nhận diện, được lưu trong bảng faceid_performance_logs (cột total_faceid_time_ms).</li>
                      <li><strong>Thời gian trung bình:</strong> Tổng thời gian của tất cả records chia cho số lượng records.</li>
                      <li><strong>Thời gian tối thiểu:</strong> Thời gian xử lý nhanh nhất trong khoảng thời gian được lọc.</li>
                      <li><strong>Thời gian tối đa:</strong> Thời gian xử lý chậm nhất trong khoảng thời gian được lọc.</li>
                    </ul>
                    <p className="mb-0">
                      <strong>Ý nghĩa:</strong> Thời gian càng thấp cho thấy hệ thống xử lý càng nhanh, trải nghiệm người dùng càng tốt. Thời gian lý tưởng là dưới 1 giây.
                    </p>
                  </Alert>

                  <h6 className="mb-3">Tổng số records: {detailData.totalRecords || 0}</h6>
                  <h6 className="mb-2">Thời gian trung bình: {detailData.averageTime || 0} ms</h6>
                  <h6 className="mb-2">Thời gian tối thiểu: {detailData.minTime || 0} ms</h6>
                  <h6 className="mb-2">Thời gian tối đa: {detailData.maxTime || 0} ms</h6>
                  <Table striped bordered hover size="sm">
                    <thead>
                      <tr>
                        <th>STT</th>
                        <SortableHeader column="student_name">Sinh viên</SortableHeader>
                        <SortableHeader column="session_name">Session</SortableHeader>
                        <SortableHeader column="total_faceid_time_ms">Thời gian (ms)</SortableHeader>
                        <SortableHeader column="created_at">Thời điểm</SortableHeader>
                      </tr>
                    </thead>
                    <tbody>
                      {getSortedData(detailData.records) && getSortedData(detailData.records).length > 0 ? (
                        getSortedData(detailData.records).map((record, index) => (
                          <tr key={record.id}>
                            <td>{index + 1}</td>
                            <td>{record.student_name || `ID: ${record.student_id}`}</td>
                            <td>
                              {record.session_name 
                                ? `${record.session_name} (ID: ${record.session_id})`
                                : `ID: ${record.session_id || 'N/A'}`}
                            </td>
                            <td>{record.total_faceid_time_ms || 0}</td>
                            <td>{new Date(record.created_at).toLocaleString('vi-VN')}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="text-center text-muted">Không có dữ liệu</td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </div>
              )}

              {detailType === 'imsTime' && (
                <div>
                  {/* Giải thích */}
                  <Alert variant="info" className="mb-4">
                    <Alert.Heading>
                      <i className="fas fa-info-circle me-2"></i>
                      Giải thích về Thời gian xử lý
                    </Alert.Heading>
                    <p className="mb-2">
                      <strong>Mục đích:</strong> Đo lường thời gian từ khi hệ thống nhận dữ liệu đến khi hiển thị kết quả cho người dùng, bao gồm cả thời gian request và xử lý.
                    </p>
                    <p className="mb-2">
                      <strong>Cách tính:</strong>
                    </p>
                    <ul className="mb-2">
                      <li><strong>Thời gian Request:</strong> Thời gian (giây) từ khi client gửi request đến khi server nhận được và bắt đầu xử lý, được lưu trong bảng ims_performance_logs (cột request_time_ms).</li>
                      <li><strong>Thời gian Processing:</strong> Thời gian (giây) server xử lý request (truy vấn database, tính toán, v.v.), được lưu trong bảng ims_performance_logs (cột processing_time_ms).</li>
                      <li><strong>Thời gian tổng:</strong> Tổng thời gian = Request time + Processing time, hoặc sử dụng total_ims_time_ms nếu có. Đây là thời gian từ lúc nhận dữ liệu đến lúc hiển thị dữ liệu.</li>
                      <li><strong>Thời gian trung bình:</strong> Tính trung bình của tất cả records trong khoảng thời gian được lọc.</li>
                    </ul>
                    <p className="mb-0">
                      <strong>Ý nghĩa:</strong> Thời gian càng thấp cho thấy hệ thống phản hồi càng nhanh. Đơn vị hiển thị là giây (s) để dễ đọc hơn so với milliseconds.
                    </p>
                  </Alert>

                  <h6 className="mb-3">Tổng số records: {detailData.totalRecords || 0}</h6>
                  <h6 className="mb-2">Thời gian tổng trung bình: {((detailData.averageTotalTime || 0) / 1000).toFixed(2)} s</h6>
                  <h6 className="mb-2">Thời gian request trung bình: {((detailData.averageRequestTime || 0) / 1000).toFixed(2)} s</h6>
                  <h6 className="mb-2">Thời gian processing trung bình: {((detailData.averageProcessingTime || 0) / 1000).toFixed(2)} s</h6>
                  <Table striped bordered hover size="sm">
                    <thead>
                      <tr>
                        <th>STT</th>
                        <SortableHeader column="student_name">Sinh viên</SortableHeader>
                        <SortableHeader column="session_name">Session</SortableHeader>
                        <SortableHeader column="request_time_ms">Request (s)</SortableHeader>
                        <SortableHeader column="processing_time_ms">Processing (s)</SortableHeader>
                        <SortableHeader column="total_time_ms">Tổng (s)</SortableHeader>
                        <SortableHeader column="created_at">Thời điểm</SortableHeader>
                      </tr>
                    </thead>
                    <tbody>
                      {getSortedData(detailData.records) && getSortedData(detailData.records).length > 0 ? (
                        getSortedData(detailData.records).map((record, index) => (
                          <tr key={record.id}>
                            <td>{index + 1}</td>
                            <td>{record.student_name || `ID: ${record.student_id}`}</td>
                            <td>
                              {record.session_name 
                                ? `${record.session_name} (ID: ${record.session_id})`
                                : `ID: ${record.session_id || 'N/A'}`}
                            </td>
                            <td>{((record.request_time_ms || 0) / 1000).toFixed(2)}</td>
                            <td>{((record.processing_time_ms || 0) / 1000).toFixed(2)}</td>
                            <td>{((record.total_time_ms || 0) / 1000).toFixed(2)}</td>
                            <td>{new Date(record.created_at).toLocaleString('vi-VN')}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="7" className="text-center text-muted">Không có dữ liệu</td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </div>
              )}

              {detailType === 'faceidDistribution' && (
                <div>
                  {/* Giải thích */}
                  <Alert variant="info" className="mb-4">
                    <Alert.Heading>
                      <i className="fas fa-info-circle me-2"></i>
                      Giải thích về Phân bố thời gian FaceID
                    </Alert.Heading>
                    <p className="mb-2">
                      <strong>Mục đích:</strong> Phân tích phân bố thời gian xử lý FaceID để đánh giá hiệu suất và xác định tỷ lệ các request nhanh/chậm.
                    </p>
                    <p className="mb-2">
                      <strong>Cách tính:</strong>
                    </p>
                    <ul className="mb-2">
                      <li><strong>&lt; 1 giây:</strong> Số lượng và tỷ lệ các request có thời gian xử lý dưới 1 giây (1000ms). Đây là mức lý tưởng.</li>
                      <li><strong>&lt; 2 giây:</strong> Số lượng và tỷ lệ các request có thời gian xử lý dưới 2 giây (2000ms). Mức chấp nhận được.</li>
                      <li><strong>&lt; 3 giây:</strong> Số lượng và tỷ lệ các request có thời gian xử lý dưới 3 giây (3000ms). Mức cần cải thiện.</li>
                      <li><strong>&gt;= 3 giây:</strong> Số lượng và tỷ lệ các request có thời gian xử lý từ 3 giây trở lên. Mức cần tối ưu hóa.</li>
                    </ul>
                    <p className="mb-0">
                      <strong>Ý nghĩa:</strong> Tỷ lệ request &lt; 1 giây càng cao cho thấy hệ thống càng nhanh. Dữ liệu được lấy từ bảng faceid_performance_logs (cột total_faceid_time_ms).
                    </p>
                  </Alert>

                  <h6 className="mb-3">Tổng số records: {detailData.totalRecords || 0}</h6>
                  <h6 className="mb-2">Phân bố:</h6>
                  <ul className="mb-3">
                    <li><strong>&lt; 1 giây:</strong> {detailData.distribution?.under1s?.count || 0} ({detailData.distribution?.under1s?.percentage || 0}%)</li>
                    <li><strong>&lt; 2 giây:</strong> {detailData.distribution?.under2s?.count || 0} ({detailData.distribution?.under2s?.percentage || 0}%)</li>
                    <li><strong>&lt; 3 giây:</strong> {detailData.distribution?.under3s?.count || 0} ({detailData.distribution?.under3s?.percentage || 0}%)</li>
                    <li><strong>&gt;= 3 giây:</strong> {detailData.distribution?.over3s?.count || 0} ({detailData.distribution?.over3s?.percentage || 0}%)</li>
                  </ul>
                  <Table striped bordered hover size="sm">
                    <thead>
                      <tr>
                        <th>STT</th>
                        <SortableHeader column="student_name">Sinh viên</SortableHeader>
                        <SortableHeader column="session_name">Session</SortableHeader>
                        <SortableHeader column="total_faceid_time_ms">Thời gian (ms)</SortableHeader>
                        <th>Phân loại</th>
                        <SortableHeader column="created_at">Thời điểm</SortableHeader>
                      </tr>
                    </thead>
                    <tbody>
                      {getSortedData(detailData.records) && getSortedData(detailData.records).length > 0 ? (
                        getSortedData(detailData.records).map((record, index) => (
                          <tr key={record.id}>
                            <td>{index + 1}</td>
                            <td>{record.student_name || `ID: ${record.student_id}`}</td>
                            <td>
                              {record.session_name 
                                ? `${record.session_name} (ID: ${record.session_id})`
                                : `ID: ${record.session_id || 'N/A'}`}
                            </td>
                            <td>{record.total_faceid_time_ms || 0}</td>
                            <td>
                              {record.total_faceid_time_ms < 1000 && <Badge bg="success">&lt; 1s</Badge>}
                              {record.total_faceid_time_ms >= 1000 && record.total_faceid_time_ms < 2000 && <Badge bg="info">&lt; 2s</Badge>}
                              {record.total_faceid_time_ms >= 2000 && record.total_faceid_time_ms < 3000 && <Badge bg="warning">&lt; 3s</Badge>}
                              {record.total_faceid_time_ms >= 3000 && <Badge bg="danger">&gt;= 3s</Badge>}
                            </td>
                            <td>{new Date(record.created_at).toLocaleString('vi-VN')}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" className="text-center text-muted">Không có dữ liệu</td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </div>
              )}

              {detailType === 'completion' && (
                <div>
                  {/* Giải thích */}
                  <Alert variant="info" className="mb-4">
                    <Alert.Heading>
                      <i className="fas fa-info-circle me-2"></i>
                      Giải thích về Thời gian hoàn tất
                    </Alert.Heading>
                    <p className="mb-2">
                      <strong>Mục đích:</strong> Đo lường thời gian từ khi sinh viên đăng nhập hoặc truy cập lại hệ thống đến khi hoàn tất điểm danh thành công.
                    </p>
                    <p className="mb-2">
                      <strong>Cách tính:</strong>
                    </p>
                    <ul className="mb-2">
                      <li><strong>Login → Attendance:</strong> Thời gian (giây) từ lúc sinh viên đăng nhập thành công lần đầu đến lúc điểm danh thành công, được lưu trong bảng attendance_completion_logs (cột login_to_attendance_seconds).</li>
                      <li><strong>Re-access → Attendance:</strong> Thời gian (giây) từ lúc sinh viên truy cập lại hệ thống (sau khi đã đăng nhập trước đó) đến lúc điểm danh thành công, được lưu trong bảng attendance_completion_logs (cột reaccess_to_attendance_seconds).</li>
                      <li><strong>Thời gian trung bình:</strong> Tính trung bình của tất cả records trong khoảng thời gian được lọc.</li>
                    </ul>
                    <p className="mb-0">
                      <strong>Ý nghĩa:</strong> Thời gian càng thấp cho thấy quy trình điểm danh càng nhanh, trải nghiệm người dùng càng tốt. Giúp xác định các điểm nghẽn trong quy trình điểm danh.
                    </p>
                  </Alert>

                  <h6 className="mb-3">Tổng số records: {detailData.totalRecords || 0}</h6>
                  <h6 className="mb-2">Login → Attendance:</h6>
                  <Table striped bordered hover size="sm" className="mb-4">
                    <thead>
                      <tr>
                        <th>STT</th>
                        <SortableHeader column="student_name">Sinh viên</SortableHeader>
                        <SortableHeader column="session_name">Session</SortableHeader>
                        <SortableHeader column="login_to_attendance_seconds">Thời gian (giây)</SortableHeader>
                        <SortableHeader column="created_at">Thời điểm</SortableHeader>
                      </tr>
                    </thead>
                    <tbody>
                      {getSortedData(detailData.loginRecords) && getSortedData(detailData.loginRecords).length > 0 ? (
                        getSortedData(detailData.loginRecords).map((record, index) => (
                          <tr key={record.id}>
                            <td>{index + 1}</td>
                            <td>{record.student_name || `ID: ${record.student_id}`}</td>
                            <td>
                              {record.session_name 
                                ? `${record.session_name} (ID: ${record.session_id})`
                                : `ID: ${record.session_id || 'N/A'}`}
                            </td>
                            <td>{record.login_to_attendance_seconds || 0}</td>
                            <td>{new Date(record.created_at).toLocaleString('vi-VN')}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="text-center text-muted">Không có dữ liệu</td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                  <h6 className="mb-2">Re-access → Attendance:</h6>
                  <Table striped bordered hover size="sm">
                    <thead>
                      <tr>
                        <th>STT</th>
                        <SortableHeader column="student_name">Sinh viên</SortableHeader>
                        <SortableHeader column="session_name">Session</SortableHeader>
                        <SortableHeader column="reaccess_to_attendance_seconds">Thời gian (giây)</SortableHeader>
                        <SortableHeader column="created_at">Thời điểm</SortableHeader>
                      </tr>
                    </thead>
                    <tbody>
                      {getSortedData(detailData.reaccessRecords) && getSortedData(detailData.reaccessRecords).length > 0 ? (
                        getSortedData(detailData.reaccessRecords).map((record, index) => (
                          <tr key={record.id}>
                            <td>{index + 1}</td>
                            <td>{record.student_name || `ID: ${record.student_id}`}</td>
                            <td>
                              {record.session_name 
                                ? `${record.session_name} (ID: ${record.session_id})`
                                : `ID: ${record.session_id || 'N/A'}`}
                            </td>
                            <td>{record.reaccess_to_attendance_seconds || 0}</td>
                            <td>{new Date(record.created_at).toLocaleString('vi-VN')}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="text-center text-muted">Không có dữ liệu</td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </div>
              )}

              {detailType === 'attendanceScale' && (
                <div>
                  {/* Giải thích */}
                  <Alert variant="info" className="mb-4">
                    <Alert.Heading>
                      <i className="fas fa-info-circle me-2"></i>
                      Giải thích về Quy mô điểm danh
                    </Alert.Heading>
                    <p className="mb-2">
                      <strong>Mục đích:</strong> Đo lường số lượng sinh viên điểm danh đồng thời (concurrent) trong một khoảng thời gian nhất định để đánh giá khả năng xử lý tải của hệ thống.
                    </p>
                    <p className="mb-2">
                      <strong>Cách tính:</strong>
                    </p>
                    <ul className="mb-2">
                      <li><strong>Khoảng thời gian:</strong> Khoảng thời gian (giây) được chọn để đếm số lượng điểm danh đồng thời (1s, 10s, 15s, 30s, 1 phút, 5 phút, 10 phút, 30 phút, 1 tiếng).</li>
                      <li><strong>Max Concurrent:</strong> Số lượng sinh viên điểm danh đồng thời tối đa trong một time window (bucket) trong khoảng thời gian được lọc. Được tính bằng cách nhóm các attendance_records theo time bucket và đếm số lượng trong mỗi bucket.</li>
                      <li><strong>FaceID:</strong> Số lượng điểm danh sử dụng FaceID trong time window có số lượng concurrent cao nhất.</li>
                      <li><strong>Bình thường:</strong> Số lượng điểm danh không sử dụng FaceID trong time window có số lượng concurrent cao nhất.</li>
                      <li><strong>Time Windows:</strong> Danh sách các time bucket với số lượng điểm danh trong mỗi bucket, giúp xác định thời điểm có nhiều sinh viên điểm danh nhất.</li>
                    </ul>
                    <p className="mb-0">
                      <strong>Ý nghĩa:</strong> Số lượng concurrent càng cao cho thấy hệ thống có thể xử lý nhiều request đồng thời. Giúp xác định thời điểm cao điểm và khả năng chịu tải của hệ thống. Dữ liệu được lấy từ bảng attendance_records.
                    </p>
                  </Alert>

                  {/* Time window selector in modal */}
                  <div className="mb-3">
                    <Form.Group>
                      <Form.Label className="info-label">
                        <i className="fas fa-clock me-2"></i>
                        Khoảng thời gian (giây)
                      </Form.Label>
                      <Form.Select
                        value={detailTimeWindow}
                        onChange={async (e) => {
                          const newTimeWindow = parseInt(e.target.value);
                          setDetailTimeWindow(newTimeWindow);
                          // Reload data with new time window
                          await loadDetailData('attendanceScale', null, newTimeWindow);
                        }}
                        className="form-control-modern"
                      >
                        <option value={1}>1 giây</option>
                        <option value={10}>10 giây</option>
                        <option value={15}>15 giây</option>
                        <option value={30}>30 giây</option>
                        <option value={60}>1 phút</option>
                        <option value={300}>5 phút</option>
                        <option value={600}>10 phút</option>
                        <option value={1800}>30 phút</option>
                        <option value={3600}>1 tiếng</option>
                      </Form.Select>
                    </Form.Group>
                  </div>

                  <h6 className="mb-2">Max Concurrent: {detailData.maxConcurrent || 0}</h6>
                  <h6 className="mb-2">Max Concurrent: {detailData.maxConcurrent || 0}</h6>
                  <p className="text-muted mb-3">
                    FaceID: {detailData.maxConcurrentFaceID || 0} | Bình thường: {detailData.maxConcurrentNormal || 0}
                  </p>
                  <h6 className="mb-2">Chi tiết các time windows:</h6>
                  <Table striped bordered hover size="sm">
                    <thead>
                      <tr>
                        <th>STT</th>
                        <SortableHeader column="time_bucket">Thời điểm</SortableHeader>
                        <SortableHeader column="concurrent_count">Số lượng</SortableHeader>
                        <SortableHeader column="faceid_count">FaceID</SortableHeader>
                        <SortableHeader column="normal_count">Bình thường</SortableHeader>
                      </tr>
                    </thead>
                    <tbody>
                      {getSortedData(detailData.timeWindows) && getSortedData(detailData.timeWindows).length > 0 ? (
                        getSortedData(detailData.timeWindows).map((window, index) => (
                          <tr key={index}>
                            <td>{index + 1}</td>
                            <td>{window.time_bucket || window.minute}</td>
                            <td>{window.concurrent_count || window.count}</td>
                            <td>{window.faceid_count || 0}</td>
                            <td>{window.normal_count || 0}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="text-center text-muted">Không có dữ liệu</td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </div>
              )}

              {detailType === 'location' && (
                <div>
                  {/* Giải thích */}
                  <Alert variant="info" className="mb-4">
                    <Alert.Heading>
                      <i className="fas fa-info-circle me-2"></i>
                      Giải thích về Sai số định vị
                    </Alert.Heading>
                    <p className="mb-2">
                      <strong>Mục đích:</strong> Đo lường độ chính xác của việc định vị địa điểm sinh viên so với vị trí geofence được cấu hình trong session.
                    </p>
                    <p className="mb-2">
                      <strong>Cách tính:</strong>
                    </p>
                    <ul className="mb-2">
                      <li><strong>Sai số định vị:</strong> Khoảng cách (mét) giữa vị trí GPS của sinh viên khi điểm danh (location_latitude, location_longitude) và tọa độ geofence được cấu hình trong clinical_sessions.monitoring_options.location.geofence.coordinates.</li>
                      <li><strong>Công thức tính:</strong> Sử dụng công thức Haversine để tính khoảng cách giữa hai điểm GPS trên bề mặt Trái Đất.</li>
                      <li><strong>Sai số trung bình:</strong> Tính trung bình của tất cả sai số trong khoảng thời gian được lọc.</li>
                      <li><strong>Sai số tối thiểu/tối đa:</strong> Sai số nhỏ nhất và lớn nhất trong khoảng thời gian được lọc.</li>
                    </ul>
                    <p className="mb-0">
                      <strong>Ý nghĩa:</strong> Sai số càng thấp cho thấy định vị càng chính xác. Giúp đánh giá độ tin cậy của hệ thống GPS và geofencing. Dữ liệu được lấy từ bảng attendance_records (các record có location_latitude và location_longitude) và clinical_sessions (monitoring_options).
                    </p>
                  </Alert>

                  <h6 className="mb-3">Tổng số records: {detailData.totalRecords || 0}</h6>
                  {detailData.displayedRecords !== undefined && detailData.displayedRecords < detailData.totalRecords && (
                    <Alert variant="warning" className="mb-3">
                      <i className="fas fa-exclamation-triangle me-2"></i>
                      Hiển thị {detailData.displayedRecords} / {detailData.totalRecords} records (giới hạn 1000 records để tối ưu hiệu suất)
                    </Alert>
                  )}
                  <h6 className="mb-2">Sai số trung bình: {detailData.averageError || 0}m</h6>
                  <Table striped bordered hover size="sm">
                    <thead>
                      <tr>
                        <th>STT</th>
                        <SortableHeader column="student_name">Sinh viên</SortableHeader>
                        <SortableHeader column="session_name">Session</SortableHeader>
                        <SortableHeader column="error">Sai số (m)</SortableHeader>
                        <SortableHeader column="created_at">Thời điểm</SortableHeader>
                      </tr>
                    </thead>
                    <tbody>
                      {getSortedData(detailData.records) && getSortedData(detailData.records).length > 0 ? (
                        getSortedData(detailData.records).map((record, index) => (
                          <tr key={record.id}>
                            <td>{index + 1}</td>
                            <td>{record.student_name || `ID: ${record.student_id}`}</td>
                            <td>
                              {record.session_name 
                                ? `${record.session_name} (ID: ${record.session_id})`
                                : `ID: ${record.session_id || 'N/A'}`}
                            </td>
                            <td>{record.error || record.distance || 0}</td>
                            <td>{new Date(record.created_at).toLocaleString('vi-VN')}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="text-center text-muted">Không có dữ liệu</td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </div>
              )}

              {detailType === 'error' && (
                <div>
                  {/* Giải thích */}
                  <Alert variant="info" className="mb-4">
                    <Alert.Heading>
                      <i className="fas fa-info-circle me-2"></i>
                      Giải thích về Lỗi hệ thống
                    </Alert.Heading>
                    <p className="mb-2">
                      <strong>Mục đích:</strong> Theo dõi và phân tích các lỗi hệ thống để xác định nguyên nhân và cải thiện độ ổn định.
                    </p>
                    <p className="mb-2">
                      <strong>Cách tính:</strong>
                    </p>
                    <ul className="mb-2">
                      <li><strong>Action:</strong> Endpoint hoặc hành động gây ra lỗi (ví dụ: POST /api/sessions/2505/attend).</li>
                      <li><strong>Tổng số lỗi:</strong> Số lượng lỗi (ERROR hoặc WARNING) được ghi lại trong bảng system_logs cho action cụ thể này, trong khoảng thời gian được lọc.</li>
                      <li><strong>Loại lỗi:</strong> Mức độ lỗi (ERROR hoặc WARNING) được ghi trong system_logs.level.</li>
                      <li><strong>Message:</strong> Nội dung chi tiết của lỗi, giúp xác định nguyên nhân cụ thể.</li>
                      <li><strong>Sinh viên:</strong> Sinh viên gặp lỗi (nếu có user_id trong system_logs).</li>
                    </ul>
                    <p className="mb-0">
                      <strong>Ý nghĩa:</strong> Giúp xác định các endpoint hoặc hành động có nhiều lỗi nhất, từ đó ưu tiên sửa lỗi và cải thiện độ ổn định hệ thống. Dữ liệu được lấy từ bảng system_logs (đã loại bỏ các lỗi liên quan đến /api/health).
                    </p>
                  </Alert>

                  <h6 className="mb-3">Action: {detailData.errorAction || 'N/A'}</h6>
                  <h6 className="mb-2">Tổng số lỗi: {detailData.totalErrors || 0}</h6>
                  <Table striped bordered hover size="sm">
                    <thead>
                      <tr>
                        <th>STT</th>
                        <SortableHeader column="timestamp">Thời điểm</SortableHeader>
                        <SortableHeader column="error_type">Loại lỗi</SortableHeader>
                        <SortableHeader column="error_message">Message</SortableHeader>
                        <SortableHeader column="student_name">Sinh viên</SortableHeader>
                      </tr>
                    </thead>
                    <tbody>
                      {getSortedData(detailData.errors) && getSortedData(detailData.errors).length > 0 ? (
                        getSortedData(detailData.errors).map((error, index) => (
                          <tr key={error.id || index}>
                            <td>{index + 1}</td>
                            <td>{new Date(error.timestamp || error.created_at).toLocaleString('vi-VN')}</td>
                            <td>{error.error_type || error.level}</td>
                            <td>{error.error_message || error.message || 'N/A'}</td>
                            <td>{error.student_name || (error.student_id ? `ID: ${error.student_id}` : 'N/A')}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="text-center text-muted">Không có dữ liệu</td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </div>
              )}

              {detailType === 'errorByIP' && (
                <div>
                  <Alert variant="info" className="mb-4">
                    <Alert.Heading>
                      <i className="fas fa-info-circle me-2"></i>
                      Giải thích về Lỗi hệ thống theo IP
                    </Alert.Heading>
                    <p className="mb-2">
                      <strong>Mục đích:</strong> Xác định các IP address gây ra nhiều lỗi nhất trong hệ thống để có thể chặn hoặc điều tra.
                    </p>
                    <p className="mb-0">
                      <strong>Ý nghĩa:</strong> IP có nhiều lỗi có thể là dấu hiệu của tấn công, bot, hoặc vấn đề mạng. Dữ liệu được lấy từ bảng system_logs (đã loại bỏ các lỗi liên quan đến /api/health).
                    </p>
                  </Alert>

                  <h6 className="mb-3">IP Address: {detailData.ipAddress || 'N/A'}</h6>
                  <h6 className="mb-2">Tổng số lỗi: {detailData.totalErrors || 0}</h6>
                  <Table striped bordered hover size="sm">
                    <thead>
                      <tr>
                        <th>STT</th>
                        <SortableHeader column="timestamp">Thời điểm</SortableHeader>
                        <SortableHeader column="error_type">Loại lỗi</SortableHeader>
                        <SortableHeader column="error_message">Message</SortableHeader>
                        <SortableHeader column="student_name">Sinh viên</SortableHeader>
                      </tr>
                    </thead>
                    <tbody>
                      {getSortedData(detailData.errors) && getSortedData(detailData.errors).length > 0 ? (
                        getSortedData(detailData.errors).map((error, index) => (
                          <tr key={error.id || index}>
                            <td>{index + 1}</td>
                            <td>{new Date(error.timestamp || error.created_at).toLocaleString('vi-VN')}</td>
                            <td>{error.error_type || error.level}</td>
                            <td>{error.error_message || error.message || 'N/A'}</td>
                            <td>{error.student_name || (error.student_id ? `ID: ${error.student_id}` : 'N/A')}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="text-center text-muted">Không có dữ liệu</td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </div>
              )}

              {detailType === 'errorByUser' && (
                <div>
                  <Alert variant="info" className="mb-4">
                    <Alert.Heading>
                      <i className="fas fa-info-circle me-2"></i>
                      Giải thích về Lỗi hệ thống theo User ID
                    </Alert.Heading>
                    <p className="mb-2">
                      <strong>Mục đích:</strong> Xác định các User ID gây ra nhiều lỗi nhất trong hệ thống để có thể hỗ trợ hoặc điều tra.
                    </p>
                    <p className="mb-0">
                      <strong>Ý nghĩa:</strong> User có nhiều lỗi có thể gặp vấn đề về thiết bị, mạng, hoặc cần hỗ trợ kỹ thuật. Dữ liệu được lấy từ bảng system_logs (đã loại bỏ các lỗi liên quan đến /api/health).
                    </p>
                  </Alert>

                  <h6 className="mb-3">User ID: {detailData.userId || 'N/A'}</h6>
                  <h6 className="mb-2">Tên: {detailData.userName || 'N/A'}</h6>
                  <h6 className="mb-2">Tổng số lỗi: {detailData.totalErrors || 0}</h6>
                  <Table striped bordered hover size="sm">
                    <thead>
                      <tr>
                        <th>STT</th>
                        <SortableHeader column="timestamp">Thời điểm</SortableHeader>
                        <SortableHeader column="error_type">Loại lỗi</SortableHeader>
                        <SortableHeader column="error_message">Message</SortableHeader>
                        <SortableHeader column="action">Action</SortableHeader>
                      </tr>
                    </thead>
                    <tbody>
                      {getSortedData(detailData.errors) && getSortedData(detailData.errors).length > 0 ? (
                        getSortedData(detailData.errors).map((error, index) => (
                          <tr key={error.id || index}>
                            <td>{index + 1}</td>
                            <td>{new Date(error.timestamp || error.created_at).toLocaleString('vi-VN')}</td>
                            <td>{error.error_type || error.level}</td>
                            <td>{error.error_message || error.message || 'N/A'}</td>
                            <td>{error.action || 'N/A'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="text-center text-muted">Không có dữ liệu</td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </div>
              )}
            </>
          ) : (
            <p className="text-muted text-center">Không có dữ liệu chi tiết</p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
            Đóng
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

// Retention Row Component
const RetentionRow = ({ setting, onUpdate, onCleanup }) => {
  const [retentionDays, setRetentionDays] = useState(setting.retention_days);
  const [autoCleanup, setAutoCleanup] = useState(setting.auto_cleanup_enabled);

  const handleSave = () => {
    onUpdate(setting.table_name, retentionDays, autoCleanup);
  };

  return (
    <tr>
      <td><code>{setting.table_name}</code></td>
      <td>
        <Form.Control
          type="number"
          value={retentionDays}
          onChange={(e) => setRetentionDays(parseInt(e.target.value))}
          style={{ width: '100px' }}
        />
      </td>
      <td>
        <Form.Check
          type="switch"
          checked={autoCleanup}
          onChange={(e) => setAutoCleanup(e.target.checked)}
        />
      </td>
      <td>
        {setting.last_cleanup_at
          ? new Date(setting.last_cleanup_at).toLocaleString('vi-VN')
          : 'Chưa có'}
      </td>
      <td>
        <Button variant="primary" size="sm" onClick={handleSave} className="me-2">
          Lưu
        </Button>
        <Button variant="warning" size="sm" onClick={() => onCleanup(setting.table_name)}>
          Cleanup ngay
        </Button>
      </td>
    </tr>
  );
};

// Alert Setting Row Component
const AlertSettingRow = ({ setting, onUpdate }) => {
  const [thresholdValue, setThresholdValue] = useState(setting.threshold_value);
  const [enabled, setEnabled] = useState(setting.enabled);
  const [notificationChannels, setNotificationChannels] = useState(
    typeof setting.notification_channels === 'string'
      ? JSON.parse(setting.notification_channels)
      : setting.notification_channels || ['dashboard']
  );

  const handleSave = () => {
    onUpdate(setting.id, thresholdValue, enabled, notificationChannels);
  };

  const toggleChannel = (channel) => {
    if (notificationChannels.includes(channel)) {
      setNotificationChannels(notificationChannels.filter(c => c !== channel));
    } else {
      setNotificationChannels([...notificationChannels, channel]);
    }
  };

  return (
    <tr>
      <td>{setting.alert_name}</td>
      <td>{setting.metric_type}</td>
      <td>
        <Form.Control
          type="number"
          step="0.01"
          value={thresholdValue}
          onChange={(e) => setThresholdValue(parseFloat(e.target.value))}
          style={{ width: '120px' }}
        />
      </td>
      <td>
        <Form.Check
          type="switch"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
      </td>
      <td>
        <div className="d-flex gap-2 mb-2">
          <Form.Check
            type="checkbox"
            label="Dashboard"
            checked={notificationChannels.includes('dashboard')}
            onChange={() => toggleChannel('dashboard')}
          />
          <Form.Check
            type="checkbox"
            label="Email"
            checked={notificationChannels.includes('email')}
            onChange={() => toggleChannel('email')}
          />
        </div>
        <Button variant="primary" size="sm" onClick={handleSave}>
          Lưu
        </Button>
      </td>
    </tr>
  );
};

export default FaceIDEvaluationPage;
