import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Row, Col, Button, Spinner, Alert, Table, Badge, Form } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import StatisticsCard from '../../components/StatisticsCard';
import StatisticsList from '../../components/StatisticsList';
import PieChart from '../../components/charts/PieChart';
import BarChart from '../../components/charts/BarChart';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/dashboard.css';

// ==================== CACHE CONFIGURATION ====================
const DASHBOARD_CACHE_KEY = 'dashboard_cache';
const DASHBOARD_CACHE_TTL = 5 * 60 * 1000; // 5 phút
const PROGRESSIVE_DELAY = 200; // 200ms giữa mỗi item

// Cache helper functions
const getDashboardFromCache = (dateFilter) => {
  try {
    const cached = localStorage.getItem(`${DASHBOARD_CACHE_KEY}_${dateFilter}`);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    const isExpired = Date.now() - timestamp > DASHBOARD_CACHE_TTL;
    
    return { data, timestamp, isExpired };
  } catch (error) {
    console.error('Error reading dashboard cache:', error);
    return null;
  }
};

const saveDashboardToCache = (stats, dateFilter) => {
  try {
    const cacheData = {
      data: stats,
      timestamp: Date.now()
    };
    localStorage.setItem(`${DASHBOARD_CACHE_KEY}_${dateFilter}`, JSON.stringify(cacheData));
    console.log('💾 Dashboard saved to cache');
  } catch (error) {
    console.error('Error saving dashboard cache:', error);
  }
};

const AdminDashboard = () => {
  usePageTitle('Bảng điều khiển Admin');
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
  const [loadingProgress, setLoadingProgress] = useState(0); // Progress indicator
  const progressiveTimeoutsRef = useRef([]); // Track timeouts for cleanup
  
  const [dateFilter, setDateFilter] = useState(() => {
    return localStorage.getItem('dashboardDateFilter') || 'today';
  });
  const [customDate, setCustomDate] = useState('');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  
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
          endDate: null
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
      // Từ cache: hiển thị ngay lập tức
      setStats(fullData);
      setLoadingProgress(100);
      return;
    }
    
    // Từ server: hiển thị từng phần một
    const listFields = [
      'lateStudents',
      'absentStudents', 
      'missingTimeSlotStudents',
      'multipleLateStudents',
      'incompleteBadgeStudents',
      'uploadedFiles'
    ];
    
    // Bước 1: Hiển thị stats cơ bản ngay lập tức (counts = 0)
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
    
    // Bước 2: Tính tổng số items để progressive loading
    let totalItems = 0;
    listFields.forEach(field => {
      if (fullData[field] && Array.isArray(fullData[field])) {
        totalItems += fullData[field].length;
      }
    });
    
    // Nếu không có items, hiển thị stats counts ngay
    if (totalItems === 0) {
      setStats(fullData);
      setLoadingProgress(100);
      return;
    }
    
    let currentIndex = 0;
    const tempStats = { ...initialStats };
    
    // Bước 3: Progressive loading cho từng item
    listFields.forEach((field, fieldIndex) => {
      const items = fullData[field] || [];
      const countField = field.replace('Students', 'StudentsCount')
                              .replace('lateStudents', 'lateStudentsCount')
                              .replace('absentStudents', 'absentStudentsCount')
                              .replace('missingTimeSlotStudents', 'missingTimeSlotCount')
                              .replace('multipleLateStudents', 'multipleLateCount')
                              .replace('incompleteBadgeStudents', 'incompleteBadgeCount')
                              .replace('uploadedFiles', 'uploadedFilesCount');
      
      items.forEach((item, itemIndex) => {
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
              // Cập nhật count tương ứng
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
    
    // Bước 4: Finalize sau khi tất cả items đã được hiển thị
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
    
    // So sánh các counts quan trọng
    const keysToCompare = [
      'totalStudents', 'totalSessions', 'lateStudentsCount', 
      'absentStudentsCount', 'uploadedFilesCount'
    ];
    
    for (const key of keysToCompare) {
      if (oldData[key] !== newData[key]) return true;
    }
    
    // So sánh độ dài các lists
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
        const cached = getDashboardFromCache(dateFilter);
        
        if (cached && cached.data) {
          console.log('📦 Hiển thị ngay từ cache');
          loadProgressively(cached.data, true);
          setLoading(false);
          setLastUpdate(new Date(cached.timestamp));
          
          // Nếu cache còn hạn → không cần gọi API
          if (!cached.isExpired && !isInitialLoad) {
            console.log('✅ Cache còn hạn, không cần refresh');
            return;
          }
        }
        
        // Bước 2: Gọi API ở background để kiểm tra dữ liệu mới
        if (!cached) {
          // Không có cache → hiển thị loading
          if (isInitialLoad) {
            setLoading(true);
            setLoadingProgress(0);
          }
        } else {
          // Có cache → refresh ở background (không hiển thị loading)
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
        
        console.log('🌐 Kiểm tra dữ liệu mới từ server...');
        const response = await api.get(`/dashboard/stats?${params.toString()}`);
        
        if (response.data.success) {
          const newData = response.data.data;
          
          // Bước 3: So sánh với cache cũ
          if (cached && cached.data && !hasDataChanged(cached.data, newData)) {
            // Dữ liệu giống nhau → chỉ cập nhật timestamp cache
            console.log('✅ Dữ liệu không thay đổi');
            saveDashboardToCache(newData, dateFilter);
            setLastUpdate(new Date());
          } else {
            // Có dữ liệu mới → cập nhật UI
            console.log('🔄 Có dữ liệu mới, đang cập nhật...');
            
            if (!cached) {
              // Lần đầu (không có cache) → progressive loading
              setLoading(false);
              loadProgressively(newData, false);
            } else {
              // Có cache cũ → update ngay (không progressive)
              setStats(newData);
              setLoadingProgress(100);
            }
            
            saveDashboardToCache(newData, dateFilter);
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
        if (!getDashboardFromCache(dateFilter)) {
          setError('Lỗi khi tải dữ liệu thống kê. Vui lòng thử lại sau.');
        }
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    };

    // Initial fetch
    fetchDashboardStats(true);

    // Auto-refresh mỗi 30 giây ở background
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchDashboardStats(false);
      }
    }, 30000);

    // Refresh khi tab trở lại visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchDashboardStats(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearProgressiveTimeouts();
    };
  }, [api, dateFilter, customDate, customStartDate, customEndDate, loadProgressively, clearProgressiveTimeouts, hasDataChanged]);

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
            <h2 className="dashboard-title">Bảng điều khiển Quản trị viên</h2>
          </div>
          <div className="d-flex align-items-center gap-2">
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
          <Row className="mb-4 g-4">
            <Col md={3} xs={12}>
              <StatisticsList
                title="Tất cả sinh viên đi trễ"
                icon="fa-user-clock"
                data={stats.lateStudents}
                bgColor="warning"
                detailPath="/admin/stats/late"
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
                detailPath="/admin/stats/missingTimeSlot"
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
                detailPath="/admin/stats/absent"
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
                detailPath="/admin/stats/incompleteBadge"
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

export default AdminDashboard;
 