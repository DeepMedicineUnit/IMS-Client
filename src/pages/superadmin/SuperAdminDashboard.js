import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Row, Col, Spinner, Alert, Table, Badge, Form } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import StatisticsCard from '../../components/StatisticsCard';
import StatisticsList from '../../components/StatisticsList';
import PieChart from '../../components/charts/PieChart';
import BarChart from '../../components/charts/BarChart';
import LineChart from '../../components/charts/LineChart';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/dashboard.css';

// ==================== CACHE CONFIGURATION ====================
const DASHBOARD_CACHE_KEY = 'superadmin_dashboard_cache';
const DASHBOARD_CACHE_TTL = 5 * 60 * 1000; // 5 phút
const PROGRESSIVE_DELAY = 200; // 200ms giữa mỗi item

// Cache helper functions
const getCacheKey = (dateFilter, admin, classFilter, location) => {
  return `${DASHBOARD_CACHE_KEY}_${dateFilter}_${admin || 'all'}_${classFilter || 'all'}_${location || 'all'}`;
};

const getDashboardFromCache = (dateFilter, admin, classFilter, location) => {
  try {
    const key = getCacheKey(dateFilter, admin, classFilter, location);
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    const isExpired = Date.now() - timestamp > DASHBOARD_CACHE_TTL;
    
    return { data, timestamp, isExpired };
  } catch (error) {
    console.error('Error reading dashboard cache:', error);
    return null;
  }
};

const saveDashboardToCache = (stats, dateFilter, admin, classFilter, location) => {
  try {
    const key = getCacheKey(dateFilter, admin, classFilter, location);
    const cacheData = {
      data: stats,
      timestamp: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(cacheData));
    console.log('💾 SuperAdmin Dashboard saved to cache');
  } catch (error) {
    console.error('Error saving dashboard cache:', error);
  }
};

const pastelColors = [
  '#4e73df', '#36b9cc', '#1cc88a', '#f6c23e', '#e74a3b', '#858796'
];

const SuperAdminDashboard = () => {
  usePageTitle('Bảng điều khiển Super Admin');
  const { currentUser, api } = useAuth();
  const navigate = useNavigate();
  
  // Initial empty state
  const initialStats = {
    totalStudents: 0,
    totalSessions: 0,
    activeSessions: 0,
    lateStudentsCount: 0,
    absentStudentsCount: 0,
    missingTimeSlotCount: 0,
    multipleLateCount: 0,
    incompleteBadgeCount: 0,
    uploadedFilesCount: 0,
    lateStudents: [],
    absentStudents: [],
    missingTimeSlotStudents: [],
    multipleLateStudents: [],
    incompleteBadgeStudents: [],
    uploadedFiles: []
  };
  
  const [stats, setStats] = useState(initialStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const progressiveTimeoutsRef = useRef([]);
  
  const [dateFilter, setDateFilter] = useState('today');
  const [customDate, setCustomDate] = useState('');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedAdmin, setSelectedAdmin] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [adminList, setAdminList] = useState([]);
  const [classList, setClassList] = useState([]);
  const [locationList, setLocationList] = useState([]);
  const [loadingFilters, setLoadingFilters] = useState(false);
  
  // Save date filter to localStorage so stats detail pages can use it
  useEffect(() => {
    localStorage.setItem('dashboardDateFilter', dateFilter);
    if (dateFilter === 'customDate' && customDate) {
      localStorage.setItem('dashboardCustomDate', customDate);
    }
    if (dateFilter === 'customRange') {
      if (customStartDate) localStorage.setItem('dashboardCustomStartDate', customStartDate);
      if (customEndDate) localStorage.setItem('dashboardCustomEndDate', customEndDate);
    }
  }, [dateFilter, customDate, customStartDate, customEndDate]);

  // Load custom dates from localStorage on mount
  useEffect(() => {
    const savedCustomDate = localStorage.getItem('dashboardCustomDate');
    const savedStartDate = localStorage.getItem('dashboardCustomStartDate');
    const savedEndDate = localStorage.getItem('dashboardCustomEndDate');
    if (savedCustomDate) setCustomDate(savedCustomDate);
    if (savedStartDate) setCustomStartDate(savedStartDate);
    if (savedEndDate) setCustomEndDate(savedEndDate);
  }, []);

  // Helper function to build filter params for API calls
  const buildFilterParams = (excludeType = null, admin = null, className = null, location = null, dateRange = null) => {
    const params = new URLSearchParams();
    const adminValue = admin !== null ? admin : selectedAdmin;
    const classValue = className !== null ? className : selectedClass;
    const locationValue = location !== null ? location : selectedLocation;
    const range = dateRange || getDateRange(dateFilter);
    
    if (excludeType !== 'admin' && adminValue) {
      params.append('createdBy', adminValue);
    }
    if (excludeType !== 'class' && classValue) {
      params.append('class', classValue);
    }
    if (excludeType !== 'location' && locationValue) {
      params.append('location', locationValue);
    }
    if (range.startDate) {
      params.append('startDate', range.startDate);
    }
    if (range.endDate) {
      params.append('endDate', range.endDate);
    }
    return params.toString();
  };

  // Load filter options with cascading filters
  const loadFilterOptions = async (currentAdmin = null, currentClass = null, currentLocation = null) => {
    try {
      setLoadingFilters(true);
      const dateRange = getDateRange(dateFilter);
      
      // Load admin list (filtered by class, location, date if selected)
      const adminParams = buildFilterParams('admin', currentAdmin, currentClass, currentLocation, dateRange);
      const adminsResponse = await api.get(`/dashboard/filter-options?type=admin&${adminParams}`);
      if (adminsResponse.data.success) {
        setAdminList(adminsResponse.data.data);
      }
      
      // Load class list (filtered by admin, location, date if selected)
      const classParams = buildFilterParams('class', currentAdmin, currentClass, currentLocation, dateRange);
      const classesResponse = await api.get(`/dashboard/filter-options?type=class&${classParams}`);
      if (classesResponse.data.success) {
        setClassList(classesResponse.data.data);
      }
      
      // Load location list (filtered by admin, class, date if selected)
      const locationParams = buildFilterParams('location', currentAdmin, currentClass, currentLocation, dateRange);
      const locationsResponse = await api.get(`/dashboard/filter-options?type=location&${locationParams}`);
      if (locationsResponse.data.success) {
        setLocationList(locationsResponse.data.data);
      }
    } catch (err) {
      console.error('Error loading filter options:', err);
    } finally {
      setLoadingFilters(false);
    }
  };

  // Load filter options on mount
  useEffect(() => {
    loadFilterOptions();
  }, [api]);

  // Handle admin change - reset dependent filters
  const handleAdminChange = (adminId) => {
    setSelectedAdmin(adminId);
    setSelectedClass('');
    setSelectedLocation('');
    loadFilterOptions(adminId, '', '');
  };

  // Handle class change - reset dependent filters
  const handleClassChange = (className) => {
    setSelectedClass(className);
    setSelectedLocation('');
    loadFilterOptions(selectedAdmin, className, '');
  };

  // Handle location change
  const handleLocationChange = (location) => {
    setSelectedLocation(location);
    loadFilterOptions(selectedAdmin, selectedClass, location);
  };

  // Reload filter options when date filter changes
  useEffect(() => {
    loadFilterOptions(selectedAdmin, selectedClass, selectedLocation);
  }, [dateFilter, customDate, customStartDate, customEndDate]);

  const toLocalDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper function to calculate date range based on filter
  const getDateRange = (filter) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (filter) {
      case 'today':
        return {
          startDate: toLocalDateString(today),
          endDate: toLocalDateString(today) // Set endDate to same day for "Hôm nay"
        };
      case '2days':
        const twoDaysAgo = new Date(today);
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 1);
        return {
          startDate: toLocalDateString(twoDaysAgo),
          endDate: null
        };
      case '3days':
        const threeDaysAgo = new Date(today);
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 2);
        return {
          startDate: toLocalDateString(threeDaysAgo),
          endDate: null
        };
      case '1week':
        const oneWeekAgo = new Date(today);
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 6);
        return {
          startDate: toLocalDateString(oneWeekAgo),
          endDate: null
        };
      case '1month':
        const oneMonthAgo = new Date(today);
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        return {
          startDate: toLocalDateString(oneMonthAgo),
          endDate: null
        };
      case 'customDate':
        if (customDate) {
          return {
            startDate: customDate,
            endDate: customDate
          };
        }
        return { startDate: null, endDate: null };
      case 'customRange':
        if (customStartDate && customEndDate) {
          return {
            startDate: customStartDate,
            endDate: customEndDate
          };
        }
        return { startDate: null, endDate: null };
      case 'all':
      default:
        return {
          startDate: null,
          endDate: null
        };
    }
  };

  // Clear all progressive timeouts
  const clearProgressiveTimeouts = useCallback(() => {
    progressiveTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    progressiveTimeoutsRef.current = [];
  }, []);

  // Progressive loading - hiển thị từng phần một
  const loadProgressively = useCallback((fullData, isFromCache = false) => {
    clearProgressiveTimeouts();
    
    if (isFromCache) {
      setStats(fullData);
      setLoadingProgress(100);
      return;
    }
    
    const listFields = [
      'lateStudents',
      'absentStudents', 
      'missingTimeSlotStudents',
      'multipleLateStudents',
      'incompleteBadgeStudents',
      'uploadedFiles'
    ];
    
    setStats({
      ...initialStats,
      totalStudents: 0,
      totalSessions: 0,
      lateStudentsCount: 0,
      absentStudentsCount: 0,
      missingTimeSlotCount: 0,
      multipleLateCount: 0,
      incompleteBadgeCount: 0,
      uploadedFilesCount: 0
    });
    setLoadingProgress(5);
    
    let totalItems = 0;
    listFields.forEach(field => {
      if (fullData[field] && Array.isArray(fullData[field])) {
        totalItems += fullData[field].length;
      }
    });
    
    if (totalItems === 0) {
      setStats(fullData);
      setLoadingProgress(100);
      return;
    }
    
    let currentIndex = 0;
    
    listFields.forEach((field) => {
      const items = fullData[field] || [];
      
      items.forEach((item) => {
        const delay = (currentIndex + 1) * PROGRESSIVE_DELAY;
        currentIndex++;
        
        const timeoutId = setTimeout(() => {
          setStats(prev => {
            const updatedList = [...(prev[field] || []), item];
            const progress = Math.round((currentIndex / totalItems) * 95) + 5;
            setLoadingProgress(progress);
            
            return {
              ...prev,
              [field]: updatedList,
              totalStudents: fullData.totalStudents,
              totalSessions: fullData.totalSessions,
              activeSessions: fullData.activeSessions,
              lateStudentsCount: field === 'lateStudents' ? updatedList.length : prev.lateStudentsCount,
              absentStudentsCount: field === 'absentStudents' ? updatedList.length : prev.absentStudentsCount,
              missingTimeSlotCount: field === 'missingTimeSlotStudents' ? updatedList.length : prev.missingTimeSlotCount,
              multipleLateCount: field === 'multipleLateStudents' ? updatedList.length : prev.multipleLateCount,
              incompleteBadgeCount: field === 'incompleteBadgeStudents' ? updatedList.length : prev.incompleteBadgeCount,
              uploadedFilesCount: field === 'uploadedFiles' ? updatedList.length : prev.uploadedFilesCount
            };
          });
        }, delay);
        
        progressiveTimeoutsRef.current.push(timeoutId);
      });
    });
    
    const finalDelay = (totalItems + 1) * PROGRESSIVE_DELAY;
    const finalTimeoutId = setTimeout(() => {
      setStats(fullData);
      setLoadingProgress(100);
    }, finalDelay);
    progressiveTimeoutsRef.current.push(finalTimeoutId);
    
  }, [clearProgressiveTimeouts]);

  // So sánh 2 objects để kiểm tra có dữ liệu mới không
  const hasDataChanged = useCallback((oldData, newData) => {
    if (!oldData || !newData) return true;
    
    const keysToCompare = [
      'totalStudents', 'totalSessions', 'lateStudentsCount', 
      'absentStudentsCount', 'uploadedFilesCount'
    ];
    
    for (const key of keysToCompare) {
      if (oldData[key] !== newData[key]) return true;
    }
    
    const listKeys = ['lateStudents', 'absentStudents', 'uploadedFiles'];
    for (const key of listKeys) {
      if ((oldData[key]?.length || 0) !== (newData[key]?.length || 0)) return true;
    }
    
    return false;
  }, []);

  useEffect(() => {
    const fetchDashboardStats = async (isInitialLoad = false) => {
      try {
        // Bước 1: LUÔN hiển thị từ cache trước (nếu có)
        const cached = getDashboardFromCache(dateFilter, selectedAdmin, selectedClass, selectedLocation);
        
        if (cached && cached.data) {
          console.log('📦 Hiển thị ngay từ cache');
          loadProgressively(cached.data, true);
          setLoading(false);
          setLastUpdate(new Date(cached.timestamp));
          
          if (!cached.isExpired && !isInitialLoad) {
            console.log('✅ Cache còn hạn, không cần refresh');
            return;
          }
        }
        
        // Bước 2: Gọi API ở background để kiểm tra dữ liệu mới
        if (!cached) {
          if (isInitialLoad) {
            setLoading(true);
            setLoadingProgress(0);
          }
        } else {
          setIsRefreshing(true);
        }
        
        const dateRange = getDateRange(dateFilter);
        const params = new URLSearchParams();
        if (dateRange.startDate) {
          params.append('startDate', dateRange.startDate);
        }
        if (dateRange.endDate) {
          params.append('endDate', dateRange.endDate);
        }
        if (selectedAdmin) {
          params.append('createdBy', selectedAdmin);
        }
        if (selectedClass) {
          params.append('class', selectedClass);
        }
        if (selectedLocation) {
          params.append('location', selectedLocation);
        }
        
        console.log('🌐 Kiểm tra dữ liệu mới từ server...');
        const response = await api.get(`/dashboard/stats?${params.toString()}`);
        
        if (response.data.success) {
          const newData = response.data.data;
          
          if (cached && cached.data && !hasDataChanged(cached.data, newData)) {
            console.log('✅ Dữ liệu không thay đổi');
            saveDashboardToCache(newData, dateFilter, selectedAdmin, selectedClass, selectedLocation);
            setLastUpdate(new Date());
          } else {
            console.log('🔄 Có dữ liệu mới, đang cập nhật...');
            
            if (!cached) {
              setLoading(false);
              loadProgressively(newData, false);
            } else {
              setStats(newData);
              setLoadingProgress(100);
            }
            
            saveDashboardToCache(newData, dateFilter, selectedAdmin, selectedClass, selectedLocation);
            setLastUpdate(new Date());
          }
          
          setError('');
        } else {
          if (!cached) {
            setError('Không thể tải dữ liệu thống kê');
          }
        }
      } catch (err) {
        console.error('Error fetching dashboard:', err);
        if (!getDashboardFromCache(dateFilter, selectedAdmin, selectedClass, selectedLocation)) {
          setError('Lỗi khi tải dữ liệu thống kê. Vui lòng thử lại sau.');
        }
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    };

    fetchDashboardStats(true);

    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchDashboardStats(false);
      }
    }, 30000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchDashboardStats(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearProgressiveTimeouts();
    };
  }, [api, dateFilter, customDate, customStartDate, customEndDate, selectedAdmin, selectedClass, selectedLocation, loadProgressively, clearProgressiveTimeouts, hasDataChanged]);

  // Chart data prep for attendance overview
  const attendanceData = [
    stats.totalStudents - stats.absentStudentsCount - stats.lateStudentsCount,
    stats.lateStudentsCount,
    stats.absentStudentsCount
  ];
  const attendanceLabels = ['Đúng giờ', 'Đi trễ', 'Vắng mặt'];
  const attendanceColors = ['#1cc88a', '#f6c23e', '#e74a3b'];

  // Chart data for multiple late students
  const lateStudentsData = stats.multipleLateStudents
    ? stats.multipleLateStudents.slice(0, 10).map(student => student.late_count)
    : [];
  const lateStudentsLabels = stats.multipleLateStudents
    ? stats.multipleLateStudents.slice(0, 10).map(student => student.full_name)
    : [];

  // Helper function to format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return 'Không xác định';
    
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Byte';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
  };

  // Helper function to format date
  const formatDate = (dateString) => {
    try {
      if (!dateString) return '';
      const date = new Date(dateString);
      return date.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return dateString;
    }
  };

  // Handle file name click to navigate to session detail (history tab)
  const handleFileNameClick = (file) => {
    // Navigate to session detail with file ID as hash
    navigate(`/admin/sessions/${file.session_id}#file-${file.file_id}`);
  };

  return (
    <div className="admin-dashboard-container">
      
      {/* Auto-refresh indicator */}
      <div className="auto-refresh-indicator">
        <i className={`fas ${isRefreshing ? 'fa-sync-alt fa-spin' : 'fa-sync-alt'} me-1`}></i>
        {isRefreshing ? 'Đang cập nhật...' : 'Tự động cập nhật'}
        {loadingProgress > 0 && loadingProgress < 100 && !loading && (
          <span className="ms-2">
            <small className="text-muted">({loadingProgress}%)</small>
          </span>
        )}
      </div>

      <div className="dashboard-header">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h2 className="dashboard-title">Bảng điều khiển</h2>
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <Form.Select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              style={{ width: '200px' }}
              className="form-select-modern"
            >
              <option value="today">Hôm nay</option>
              <option value="2days">2 ngày gần nhất</option>
              <option value="3days">3 ngày gần nhất</option>
              <option value="1week">1 tuần</option>
              <option value="1month">1 tháng</option>
              <option value="customDate">Chọn ngày cụ thể</option>
              <option value="customRange">Chọn khoảng thời gian</option>
              <option value="all">Tất cả</option>
            </Form.Select>
            
            {dateFilter === 'customDate' && (
              <Form.Control
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                style={{ width: '180px' }}
                className="form-control-modern"
              />
            )}
            
            {dateFilter === 'customRange' && (
              <>
                <Form.Control
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  placeholder="Từ ngày"
                  style={{ width: '180px' }}
                  className="form-control-modern"
                />
                <span className="mx-2">đến</span>
                <Form.Control
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  placeholder="Đến ngày"
                  style={{ width: '180px' }}
                  className="form-control-modern"
                />
              </>
            )}

            <Form.Select
              value={selectedAdmin}
              onChange={(e) => handleAdminChange(e.target.value)}
              style={{ width: '200px' }}
              className="form-select-modern"
            >
              <option value="">Tất cả Admin</option>
              {adminList.map((admin) => (
                <option key={admin.id} value={admin.id}>
                  {admin.full_name} ({admin.session_count} buổi)
                </option>
              ))}
            </Form.Select>

            <Form.Select
              value={selectedClass}
              onChange={(e) => handleClassChange(e.target.value)}
              style={{ width: '180px' }}
              className="form-select-modern"
            >
              <option value="">Tất cả lớp</option>
              {classList.map((cls, index) => (
                <option key={index} value={cls.value}>
                  {cls.label}
                </option>
              ))}
            </Form.Select>

            <Form.Select
              value={selectedLocation}
              onChange={(e) => handleLocationChange(e.target.value)}
              style={{ width: '250px' }}
              className="form-select-modern"
            >
              <option value="">Tất cả địa điểm</option>
              {locationList.map((loc, index) => (
                <option key={index} value={loc.value}>
                  {loc.label}
                </option>
              ))}
            </Form.Select>
          </div>
        </div>
      </div>
      {error && <Alert className="error-alert">{error}</Alert>}
      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Đang tải dữ liệu...</p>
          {loadingProgress > 0 && (
            <div style={{ width: '200px', marginTop: '10px' }}>
              <div className="progress" style={{ height: '6px', borderRadius: '3px' }}>
                <div 
                  className="progress-bar bg-primary" 
                  role="progressbar" 
                  style={{ width: `${loadingProgress}%`, transition: 'width 0.2s ease' }}
                  aria-valuenow={loadingProgress} 
                  aria-valuemin="0" 
                  aria-valuemax="100"
                />
              </div>
              <small className="text-muted mt-1 d-block text-center">{loadingProgress}%</small>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Top stats row */}
          <div className="dashboard-stats-grid">
            <Row className="g-4">
              <Col md={3} sm={6} xs={12}>
                <Card className="stat-card">
                  <Card.Body className="stat-card-body">
                    <div className="icon-container" style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}>
                      <i className="fas fa-user-graduate"></i>
                    </div>
                    <div className="stat-content">
                      <div className="stat-label">Sinh viên đi học</div>
                      <div className="stat-value">{stats.totalStudents}</div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3} sm={6} xs={12}>
                <Card className="stat-card">
                  <Card.Body className="stat-card-body">
                    <div className="icon-container" style={{ background: 'linear-gradient(135deg, #f093fb, #f5576c)' }}>
                      <i className="fas fa-user-clock"></i>
                    </div>
                    <div className="stat-content">
                      <div className="stat-label">Sinh viên đi trễ</div>
                      <div className="stat-value">{stats.lateStudentsCount}</div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3} sm={6} xs={12}>
                <Card className="stat-card">
                  <Card.Body className="stat-card-body">
                    <div className="icon-container" style={{ background: 'linear-gradient(135deg, #ff9a9e, #fecfef)' }}>
                      <i className="fas fa-user-slash"></i>
                    </div>
                    <div className="stat-content">
                      <div className="stat-label">Sinh viên vắng mặt</div>
                      <div className="stat-value">{stats.absentStudentsCount}</div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3} sm={6} xs={12}>
                <Card className="stat-card">
                  <Card.Body className="stat-card-body">
                    <div className="icon-container" style={{ background: 'linear-gradient(135deg, #a8edea, #fed6e3)' }}>
                      <i className="fas fa-chalkboard-teacher"></i>
                    </div>
                    <div className="stat-content">
                      <div className="stat-label">Tổng số buổi học</div>
                      <div className="stat-value">{stats.totalSessions}</div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </div>

          {/* Charts row */}
          <Row className="mb-4 g-4">
            <Col md={6} xs={12}>
              <div className="chart-section">
                <div className="chart-title">Tổng quan điểm danh</div>
                <PieChart
                  data={attendanceData}
                  labels={attendanceLabels}
                  colors={attendanceColors}
                  height={220}
                />
              </div>
            </Col>
            <Col md={6} xs={12}>
              <div className="chart-section">
                <div className="chart-title">Sinh viên đi trễ nhiều lần</div>
                <BarChart
                  data={lateStudentsData}
                  labels={lateStudentsLabels}
                  yAxisLabel="Số lần đi trễ"
                  colors={['#e74a3b']}
                  height={220}
                />
              </div>
            </Col>
          </Row>

          {/* Lists row */}
          <Row className="mb-4 g-10">
            <Col md={3} xs={12}>
              <StatisticsList
                title="Tất cả sinh viên đi trễ"
                icon="fa-user-clock"
                data={stats.lateStudents}
                bgColor="warning"
                detailPath="/superadmin/stats/late"
                type="late"
                maxItems={5}
              />
            </Col>
            <Col md={3} xs={12}>
              <StatisticsList
                title="Thiếu khung giờ điểm danh"
                icon="fa-exclamation-triangle"
                data={stats.missingTimeSlotStudents}
                bgColor="warning"
                detailPath="/superadmin/stats/missingTimeSlot"
                type="missingTimeSlot"
                maxItems={5}
              />
            </Col>
            <Col md={3} xs={12}>
              <StatisticsList
                title="Tất cả Sinh viên vắng mặt"
                icon="fa-user-slash"
                data={stats.absentStudents}
                bgColor="danger"
                detailPath="/superadmin/stats/absent"
                type="absent"
                maxItems={5}
              />
            </Col>
            <Col md={3} xs={12}>
              <StatisticsList
                title="Yêu cầu vắng học"
                icon="fa-id-badge"
                data={stats.incompleteBadgeStudents}
                bgColor="danger"
                detailPath="/superadmin/stats/incompleteBadge"
                type="incompleteBadge"
                maxItems={5}
              />
            </Col>
          </Row>

          {/* Files section */}
          <div className="account-info-section">
            <div className="files-header mb-3">
              <h5 className="files-title">
                <i className="fas fa-file-upload me-2"></i>
                Tệp tin đã upload
                <Badge bg="primary" className="ms-2">{stats.uploadedFilesCount}</Badge>
              </h5>
            </div>
            
            {stats.uploadedFiles && stats.uploadedFiles.length > 0 ? (
              <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <Table striped hover responsive>
                  <thead className="table-light sticky-top">
                    <tr>
                      <th>Tên tệp tin</th>
                      <th>Sinh viên</th>
                      <th>Buổi học</th>
                      <th>Ngày upload</th>
                      <th>Kích thước</th>
                      <th>Loại tệp</th>
                      <th>Trạng thái</th>
                      <th>Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.uploadedFiles.map((file, index) => (
                      <tr key={file.file_id}>
                        <td>
                          <div className="d-flex align-items-center">
                            <i className="fas fa-file me-2 text-primary"></i>
                            <span 
                              className={`${file.is_recalled ? 'text-muted text-decoration-line-through' : 'text-primary'} cursor-pointer`}
                              onClick={() => handleFileNameClick(file)}
                              style={{ cursor: 'pointer' }}
                              title="Click để xem trong lịch sử buổi học"
                            >
                              {file.file_name}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div>
                            <div className="fw-bold">{file.student_name}</div>
                            <small className="text-muted">{file.username}</small>
                          </div>
                        </td>
                        <td>
                          <div>
                            <div className="fw-bold">{file.session_title}</div>
                            <small className="text-muted">{formatDate(file.session_date)}</small>
                          </div>
                        </td>
                        <td>{formatDate(file.uploaded_at)}</td>
                        <td>{formatFileSize(file.file_size)}</td>
                        <td>
                          <Badge bg="info" className="text-capitalize">
                            {file.file_type ? file.file_type.split('/')[1] : 'Không xác định'}
                          </Badge>
                        </td>
                        <td>
                          {file.is_recalled ? (
                            <Badge bg="secondary">Đã thu hồi</Badge>
                          ) : (
                            <Badge bg="success">Hoạt động</Badge>
                          )}
                        </td>
                        <td>
                          {file.note ? (
                            <span className="text-info">{file.note}</span>
                          ) : (
                            <span className="text-muted">Không có</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-4">
                <i className="fas fa-file-upload fa-2x text-muted mb-2"></i>
                <h6 className="text-muted">Chưa có tệp tin nào được upload</h6>
                <p className="text-muted mb-0">Sinh viên sẽ upload tệp tin trong các buổi học</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default SuperAdminDashboard;