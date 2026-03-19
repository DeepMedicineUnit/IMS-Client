import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Table, Button, Badge, Form, InputGroup, Modal, Spinner, Tabs, Tab, Card, Row, Col, Alert } from 'react-bootstrap';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import { format, parseISO, isAfter, isBefore, isEqual, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameDay, isSameMonth, isSameWeek } from 'date-fns';
import { useHospitalLocations } from '../../hooks/useHospitalLocations';
import usePageTitle from '../../hooks/usePageTitle';
import { vi } from 'date-fns/locale';
import Pagination from '../../components/Pagination';
import MapPreview from '../../components/MapPreview';
import '../../styles/user.css';
import Loader from '../../components/Loader';

// Add custom styles for batch sessions
const batchSessionStyles = `
  /* Batch Session Row Styles */
  .batch-session-row {
    background-color: #f8f9fa !important;
    border-left: 4px solid #17a2b8 !important;
  }
  
  .batch-session-row:hover {
    background-color: #e9ecef !important;
  }
  
  .batch-id {
    font-weight: bold;
    color: #17a2b8;
  }
  
  .batch-date-range {
    font-weight: bold;
    color: #17a2b8;
  }
  
  /* Batch Modal Styles */
  .batch-sessions-modal .modal-dialog {
    max-width: 1200px;
  }
  
  .batch-modal-header {
    background: linear-gradient(135deg, #0d6efd 0%, #0d6efd 100%);
    color: white;
    border-bottom: none;
    padding: 1.5rem;
  }
  
  .batch-modal-header .close {
    color: white;
    opacity: 0.8;
  }
  
  .batch-modal-header .close:hover {
    opacity: 1;
  }
  
  .batch-icon {
    width: 50px;
    height: 50px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
  }
  
  .batch-modal-body {
    padding: 2rem;
    max-height: 70vh;
    overflow-y: auto;
  }
  
  /* Batch Info Card */
  .batch-info-card {
    border: none;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    border-radius: 12px;
    background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  }
  
  .batch-title {
    color: #2c3e50;
    font-weight: 600;
  }
  
  .batch-details .detail-row {
    display: flex;
    align-items: center;
    margin-bottom: 0.75rem;
  }
  
  .detail-label {
    font-weight: 600;
    color: #495057;
    min-width: 140px;
  }
  
  .detail-value {
    color: #6c757d;
    font-weight: 500;
  }
  
  /* Stats Grid */
  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 1rem;
    max-width: 100%;
  }
  
  .batch-stats {
    padding-left: 1rem;
  }
  
  .stat-item {
    display: flex;
    align-items: center;
    padding: 0.75rem;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .stat-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 0.75rem;
    font-size: 1.2rem;
  }
  
  .stat-icon.active {
    background: #d4edda;
    color: #155724;
  }
  
  .stat-icon.scheduled {
    background: #cce5ff;
    color: #004085;
  }
  
  .stat-icon.ended {
    background: #e2e3e5;
    color: #383d41;
  }
  
  .stat-icon.cancelled {
    background: #f8d7da;
    color: #721c24;
  }
  
  .stat-number {
    font-size: 1.5rem;
    font-weight: bold;
    color: #2c3e50;
  }
  
  .stat-label {
    font-size: 0.875rem;
    color: #6c757d;
  }
  
  /* Sessions Table */
  .batch-sessions-table {
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .table-header {
    background: linear-gradient(135deg, #0d6efd 0%, #0d6efd 100%);
    color: white;
  }
  
  .table-header th {
    border: none;
    padding: 1rem 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 0.875rem;
    letter-spacing: 0.5px;
  }
  
  .session-row {
    transition: all 0.3s ease;
  }
  
  .session-row:hover {
    background-color: #f8f9fa;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  
  .active-row {
    background-color: #d4edda !important;
    border-left: 4px solid #28a745;
  }
  
  .session-id-wrapper {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }
  
  .session-id {
    font-weight: bold;
    color: #495057;
  }
  
  .session-order {
    font-size: 0.75rem;
    color: #6c757d;
    background: #e9ecef;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    margin-top: 0.25rem;
  }
  
  .date-info, .time-info {
    display: flex;
    flex-direction: column;
  }
  
  .date-main, .time-main {
    font-weight: 600;
    color: #495057;
  }
  
  .date-day, .time-duration {
    font-size: 0.875rem;
    color: #6c757d;
  }
  
  .status-wrapper {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }
  
  
  @keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.5; }
    100% { opacity: 1; }
  }
  
  .students-info {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }
  
  .students-count {
    font-weight: 600;
    color: #495057;
  }
  
  .students-class {
    font-size: 0.875rem;
    color: #6c757d;
  }
  
  .action-buttons {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
  }
  
  .action-btn {
    padding: 0.375rem 0.5rem;
    border-radius: 6px;
    transition: all 0.3s ease;
  }
  
  .action-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }
  
  /* Section Header */
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 1rem;
    border-bottom: 2px solid #e9ecef;
  }
  
  .section-title {
    color: #2c3e50;
    font-weight: 600;
    margin: 0;
  }
  
  .section-actions {
    display: flex;
    gap: 0.5rem;
  }
  
  /* Modal Footer */
  .batch-modal-footer {
    background: #f8f9fa;
    border-top: 1px solid #dee2e6;
    padding: 1rem 2rem;
  }
  
  .footer-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  /* Batch Delete Modal Styles */
  .batch-delete-info {
    background-color: #f8f9fa;
    padding: 15px;
    border-radius: 8px;
    border: 1px solid #dee2e6;
  }
  
  .batch-delete-info h6 {
    color: #495057;
    font-weight: 600;
  }
  
  .batch-delete-info p {
    margin-bottom: 0.5rem;
  }
  
  /* Responsive */
  @media (max-width: 768px) {
    .batch-modal-body {
      padding: 1rem;
    }
    
    .stats-grid {
      grid-template-columns: 1fr 1fr 1fr;
      gap: 0.5rem;
    }
    
    .stat-item {
      padding: 0.5rem;
      flex-direction: column;
      text-align: center;
    }
    
    .stat-icon {
      margin-right: 0;
      margin-bottom: 0.5rem;
    }
    
    .stat-number {
      font-size: 1.25rem;
    }
    
    .stat-label {
      font-size: 0.75rem;
    }
    
    .section-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }
    
    .action-buttons {
      justify-content: center;
    }
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = batchSessionStyles;
  document.head.appendChild(styleSheet);
}

// Phân trang: chỉ tải từng trang từ server, không lưu toàn bộ trên trình duyệt
const SESSIONS_PER_PAGE = 10; // Số buổi học mỗi trang

const SessionList = () => {
  usePageTitle('Danh sách buổi học');
  const { showAlert } = useAlert();
  const { currentUser, api } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Use hospital locations from API
  const { hospitalLocations, loading: locationsLoading } = useHospitalLocations();
  const predefinedLocations = hospitalLocations;
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [allDataLoaded, setAllDataLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [studentSearch, setStudentSearch] = useState(''); // Tìm theo tên sinh viên
  const [studentSearchSessionIds, setStudentSearchSessionIds] = useState(null); // Session IDs matching student search
  const [isSearchingStudent, setIsSearchingStudent] = useState(false); // Loading state for student search
  const [locationFilter, setLocationFilter] = useState(''); // Lọc theo địa điểm
  const [classFilter, setClassFilter] = useState(''); // Lọc theo lớp
  const [groupFilter, setGroupFilter] = useState(''); // Lọc theo nhóm
  const [filter, setFilter] = useState('all');
  const [filterOptions, setFilterOptions] = useState({ locations: [], classes: [], groups: [] }); // Từ API filter-options
  const [pagination, setPagination] = useState({
    page: 1,
    limit: SESSIONS_PER_PAGE,
    totalItems: 0,
    totalPages: 0
  });

  // Calendar state
  const [activeTab, setActiveTab] = useState(() => {
    const savedTab = localStorage.getItem('sessionListActiveTab');
    return savedTab || 'list';
  });
  const [calendarView, setCalendarView] = useState(() => {
    const savedView = localStorage.getItem('sessionListCalendarView');
    return savedView || 'month';
  }); // month, week, day
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [showSessionDetailModal, setShowSessionDetailModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);

  // Modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState(null);
  const [sessionNameConfirm, setSessionNameConfirm] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Batch sessions modal state
  const [showBatchSessionsModal, setShowBatchSessionsModal] = useState(false);
  const [batchSessions, setBatchSessions] = useState([]);
  const [batchGroupInfo, setBatchGroupInfo] = useState(null);

  // Batch edit modal state
  const [showBatchEditModal, setShowBatchEditModal] = useState(false);
  const [batchEditData, setBatchEditData] = useState({
    title: '',
    location: '',
    startTime: '',
    endTime: '',
    description: '',
    nightShift: false, // For night shift sessions (2 days)
    endDate: '', // End date for multi-day sessions
    studentSelection: 'class', // 'class' or 'group'
    selectedClass: '',
    selectedGroup: '',
    monitoringOptions: {
      location: {
        enabled: false,
        interval: 120,
        accuracy: "high",
        required: true,
        enforcement: 'immediate',
        geofence: {
          enabled: true,
          radius: 100,
          coordinates: {
            latitude: null,
            longitude: null
          },
          alertOnExit: true,
          alertEmail: 'daotao1@pctu.edu.vn'
        }
      },
      file_upload: {
        enabled: false,
        max_size: 50,
        allowed_types: ["image/*", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
        required: true,
        min_files: 1
      },
      attendance: {
        before_session: {
          enabled: false,
          minutes_before: 30,
          duration: 30,
          max_late_minutes: 30
        },
        during_session: {
          enabled: false,
          minutes_after_start: 120,
          minutes_before_end: 120,
          duty_students: []
        },
        after_session: {
          enabled: false,
          minutes_after: 0,
          duration: 30
        }
      }
    }
  });
  const [batchEditLoading, setBatchEditLoading] = useState(false);
  const [batchEditError, setBatchEditError] = useState('');
  const [selectedBatchLocationIndex, setSelectedBatchLocationIndex] = useState(0); // Index của địa điểm đã chọn trong Geofence

  // State for managing duty students' dates in batch edit mode
  const [dutyStudentDates, setDutyStudentDates] = useState({}); // {studentId: [date1, date2, ...]}

  // Helper functions for managing duty student dates
  const handleDutyStudentDateChange = (studentId, date, isSelected) => {
    setDutyStudentDates(prev => {
      const currentDates = prev[studentId] || [];
      if (isSelected) {
        // Chỉ thêm nếu ngày chưa tồn tại
        if (!currentDates.includes(date)) {
          return {
            ...prev,
            [studentId]: [...currentDates, date]
          };
        }
        return prev; // Không thay đổi gì nếu ngày đã tồn tại
      } else {
        return {
          ...prev,
          [studentId]: currentDates.filter(d => d !== date)
        };
      }
    });
  };

  const getDutyStudentDates = (studentId) => {
    return dutyStudentDates[studentId] || [];
  };

  // Student selection data for batch edit
  const [classes, setClasses] = useState([]);
  const [studentGroups, setStudentGroups] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Batch delete modal state
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState('');
  const [batchDeleteLoading, setBatchDeleteLoading] = useState(false);
  const [showStudentSelectionModal, setShowStudentSelectionModal] = useState(false);
  const [batchDeleteError, setBatchDeleteError] = useState('');

  // Định dạng ngày tháng
  const formatDate = (dateString) => {
    try {
      if (!dateString) return '';

      // The date is in YYYY-MM-DD format from the server
      // Parse it and convert to DD/MM/YYYY format
      const parts = dateString.split('-');
      if (parts.length !== 3) {
        console.error('Invalid date format:', dateString);
        return dateString;
      }

      const year = parts[0];
      const month = parts[1];
      const day = parts[2];

      return `${day}/${month}/${year}`;
    } catch (error) {
      console.error('Error formatting date:', error);
      return dateString;
    }
  };


  // Format date range for multi-day sessions
  const formatDateRange = (startDate, endDate) => {
    try {
      const start = formatDate(startDate);
      if (!endDate || startDate === endDate) {
        return start;
      }
      const end = formatDate(endDate);
      return `${start} - ${end}`;
    } catch (error) {
      console.error('Error formatting date range:', error);
      return startDate;
    }
  };

  // Lấy thời gian hiện tại thực
  const getMockCurrentDate = () => {
    // Sử dụng thời gian thực tế, không còn giả lập
    return new Date();
  };

  // Tính toán trạng thái dựa trên ngày và thời gian (hỗ trợ multi-day sessions)
  const calculateSessionStatus = (session) => {
    try {
      // Sử dụng thời gian hiện tại thực
      const currentDate = getMockCurrentDate();
      const sessionStartDate = parseISO(session.date);
      const sessionEndDate = session.end_date ? parseISO(session.end_date) : sessionStartDate;

      // Chuẩn hóa ngày hiện tại để so sánh chỉ ngày
      const currentDateOnly = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
      const sessionStartDateOnly = new Date(sessionStartDate.getFullYear(), sessionStartDate.getMonth(), sessionStartDate.getDate());
      const sessionEndDateOnly = new Date(sessionEndDate.getFullYear(), sessionEndDate.getMonth(), sessionEndDate.getDate());

      // Kiểm tra nếu buổi học bị hủy
      if (session.status === 'cancelled') {
        return 'cancelled';
      }

      // Buổi học trong tương lai (chưa bắt đầu)
      if (isAfter(sessionStartDateOnly, currentDateOnly)) {
        return 'scheduled';
      }

      // Buổi học đã kết thúc (sau ngày kết thúc)
      if (isBefore(sessionEndDateOnly, currentDateOnly)) {
        return 'ended';
      }

      // Buổi học đang diễn ra (trong khoảng thời gian từ ngày bắt đầu đến ngày kết thúc)
      if ((isEqual(sessionStartDateOnly, currentDateOnly) || isAfter(currentDateOnly, sessionStartDateOnly)) &&
        (isEqual(sessionEndDateOnly, currentDateOnly) || isBefore(currentDateOnly, sessionEndDateOnly))) {

        // Nếu là ngày bắt đầu, kiểm tra thời gian bắt đầu
        if (isEqual(sessionStartDateOnly, currentDateOnly)) {
          const startTimeParts = session.start_time.split(':');
          const startTime = new Date(currentDate);
          startTime.setHours(parseInt(startTimeParts[0]), parseInt(startTimeParts[1]), 0);

          // Nếu chưa đến giờ bắt đầu
          if (currentDate < startTime) {
            return 'scheduled';
          }
        }

        // Nếu là ngày kết thúc, kiểm tra thời gian kết thúc
        if (isEqual(sessionEndDateOnly, currentDateOnly)) {
          const endTimeParts = session.end_time.split(':');
          const endTime = new Date(currentDate);
          endTime.setHours(parseInt(endTimeParts[0]), parseInt(endTimeParts[1]), 0);

          // Nếu đã qua giờ kết thúc
          if (currentDate > endTime) {
            return 'ended';
          }
        }

        // Nếu đang trong khoảng thời gian của session (đã bắt đầu và chưa kết thúc)
        return 'active';
      }

      // Mặc định giữ nguyên trạng thái
      return session.status;
    } catch (error) {
      console.error('Error calculating session status:', error);
      return session.status;
    }
  };

  // Helper function để parse và update session data
  const processSessionData = (sessionsData) => {
    return sessionsData.map(session => {
      let parsedMonitoringOptions = session.monitoring_options;
      if (typeof session.monitoring_options === 'string') {
        try {
          parsedMonitoringOptions = JSON.parse(session.monitoring_options);
        } catch (error) {
          console.error('Error parsing monitoring_options for session', session.id, ':', error);
          parsedMonitoringOptions = null;
        }
      }
      return {
        ...session,
        monitoring_options: parsedMonitoringOptions,
        calculatedStatus: calculateSessionStatus(session)
      };
    });
  };

  // Xử lý dữ liệu trả về từ API grouped=1: mỗi phần tử là 1 session đơn hoặc 1 batch (isBatch, batchSessions)
  const processDisplayRows = (rows) => {
    if (!Array.isArray(rows)) return [];
    return rows.map(row => {
      if (row.isBatch && Array.isArray(row.batchSessions)) {
        const processedBatch = processSessionData(row.batchSessions);
        let parsedMonitoringOptions = row.monitoring_options;
        if (typeof row.monitoring_options === 'string') {
          try {
            parsedMonitoringOptions = JSON.parse(row.monitoring_options);
          } catch (e) {
            parsedMonitoringOptions = null;
          }
        }
        const statuses = processedBatch.map(s => s.calculatedStatus || calculateSessionStatus(s));
        const calculatedStatus = statuses.includes('active') ? 'active' : statuses.includes('scheduled') ? 'scheduled' : statuses.includes('ended') ? 'ended' : statuses.includes('cancelled') ? 'cancelled' : 'scheduled';
        return {
          ...row,
          monitoring_options: parsedMonitoringOptions,
          calculatedStatus: row.calculatedStatus ?? calculatedStatus,
          batchSessions: processedBatch
        };
      }
      return processSessionData([row])[0];
    });
  };

  // Fetch một trang sessions từ API (phân trang phía server, không lưu toàn bộ trên trình duyệt)
  const fetchSessions = async (page = 1, opts = {}) => {
    const limit = opts.limit ?? SESSIONS_PER_PAGE;
    const search = opts.search !== undefined ? opts.search : searchTerm;
    const location = opts.location !== undefined ? opts.location : locationFilter;
    const classF = opts.class !== undefined ? opts.class : classFilter;
    const groupF = opts.group !== undefined ? opts.group : groupFilter;
    const status = opts.status !== undefined ? opts.status : filter;
    const studentName = opts.studentName !== undefined ? opts.studentName : studentSearch;
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      params.set('grouped', '1'); // Phân trang theo dòng hiển thị (sau khi gộp batch), mỗi trang đúng limit dòng
      if (search && search.trim()) params.set('search', search.trim());
      if (location) params.set('location', location);
      if (classF) params.set('class', classF);
      if (groupF) params.set('group', groupF);
      if (status && status !== 'all') params.set('status', status);
      if (studentName && studentName.trim().length >= 2) params.set('studentName', studentName.trim());
      const response = await api.get(`/sessions?${params.toString()}`);
      if (response.data.success) {
        const serverRows = response.data.data || [];
        const paginationData = response.data.pagination || {};
        const processedRows = processDisplayRows(serverRows);
        setSessions(processedRows);
        setPagination(prev => ({
          ...prev,
          page: paginationData.page ?? page,
          limit: paginationData.limit ?? limit,
          totalItems: paginationData.totalItems ?? 0,
          totalPages: paginationData.totalPages ?? 0
        }));
        console.log(`✅ Loaded page ${paginationData?.page ?? page}/${paginationData?.totalPages ?? 1} (${processedRows.length} dòng hiển thị, total: ${paginationData?.totalItems ?? 0})`);
        return processedRows;
      }
      showAlert('Không thể tải danh sách buổi học', 'danger');
      return [];
    } catch (error) {
      console.error('Error fetching sessions:', error);
      showAlert('Đã xảy ra lỗi khi tải danh sách buổi học', 'danger');
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Load filter options (locations, classes, groups) và trang đầu khi vào trang
  useEffect(() => {
    let isMounted = true;
    const loadFilterOptions = async () => {
      try {
        const res = await api.get('/sessions/filter-options');
        if (res.data?.success && res.data?.data && isMounted) {
          setFilterOptions(res.data.data);
        }
      } catch (e) {
        console.error('Error loading session filter options:', e);
      }
    };
    loadFilterOptions();
    return () => { isMounted = false; };
  }, [api]);

  // Khi vào trang hoặc khi thay đổi bộ lọc: load trang 1 (phân trang phía server)
  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchSessions(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, searchTerm, locationFilter, classFilter, groupFilter, filter, studentSearch]);

  // Cập nhật trạng thái calculatedStatus mỗi 10 giây cho trang hiện tại
  useEffect(() => {
    const intervalId = setInterval(() => {
      setSessions(currentSessions =>
        currentSessions.map(session => {
          if (session.isBatch && session.batchSessions?.length) {
            const statuses = session.batchSessions.map(s => calculateSessionStatus(s));
            const calculatedStatus = statuses.includes('active') ? 'active' : statuses.includes('scheduled') ? 'scheduled' : statuses.includes('ended') ? 'ended' : statuses.includes('cancelled') ? 'cancelled' : 'scheduled';
            return { ...session, calculatedStatus };
          }
          return { ...session, calculatedStatus: calculateSessionStatus(session) };
        })
      );
    }, 10000);
    return () => clearInterval(intervalId);
  }, []);

  // Tự động refresh khi quay lại từ CreateSession
  useEffect(() => {
    if (location.state?.refresh) {
      console.log('🔄 Refreshing sessions after creating new session...');
      fetchSessions(1).then(() => {
        navigate(location.pathname, { replace: true, state: {} });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, navigate]);

  // Lưu trạng thái tab khi thay đổi
  useEffect(() => {
    localStorage.setItem('sessionListActiveTab', activeTab);
  }, [activeTab]);

  // Lưu trạng thái calendar view khi thay đổi
  useEffect(() => {
    localStorage.setItem('sessionListCalendarView', calendarView);
  }, [calendarView]);

  // Search sessions by student name (debounced)
  useEffect(() => {
    if (!studentSearch || studentSearch.trim().length < 2) {
      setStudentSearchSessionIds(null);
      setIsSearchingStudent(false);
      return;
    }

    const debounceTimer = setTimeout(async () => {
      try {
        setIsSearchingStudent(true);
        console.log('🔍 Searching sessions by student:', studentSearch);
        
        const response = await api.get(`/sessions?studentName=${encodeURIComponent(studentSearch.trim())}&page=1&limit=100`);
        
        if (response.data.success) {
          const matchingSessionIds = new Set((response.data.data || []).map(s => s.id));
          setStudentSearchSessionIds(matchingSessionIds);
          console.log(`✅ Found ${matchingSessionIds.size} sessions with student matching "${studentSearch}"`);
        } else {
          setStudentSearchSessionIds(new Set());
        }
      } catch (error) {
        console.error('Error searching by student:', error);
        setStudentSearchSessionIds(new Set());
      } finally {
        setIsSearchingStudent(false);
      }
    }, 500); // Debounce 500ms

    return () => clearTimeout(debounceTimer);
  }, [studentSearch, api]);

  // Ref cho Modal.Body để lưu vị trí cuộn
  const batchModalBodyRef = useRef(null);
  const [pendingScrollPosition, setPendingScrollPosition] = useState(null);

  // Function để lưu trạng thái batch modal vào sessionStorage
  const saveBatchModalState = () => {
    if (batchGroupInfo && batchSessions.length > 0) {
      // Lấy vị trí cuộn hiện tại của modal body
      const scrollPosition = batchModalBodyRef.current ? batchModalBodyRef.current.scrollTop : 0;
      const batchModalState = {
        batchGroupInfo,
        batchSessions,
        scrollPosition
      };
      sessionStorage.setItem('batchModalState', JSON.stringify(batchModalState));
    }
  };

  // Function để xóa trạng thái batch modal từ sessionStorage
  const clearBatchModalState = () => {
    sessionStorage.removeItem('batchModalState');
  };

  // Khôi phục trạng thái batch modal khi component mount
  useEffect(() => {
    const savedBatchModalState = sessionStorage.getItem('batchModalState');
    if (savedBatchModalState) {
      try {
        const { batchGroupInfo: savedBatchGroupInfo, batchSessions: savedBatchSessions, scrollPosition } = JSON.parse(savedBatchModalState);
        if (savedBatchGroupInfo && savedBatchSessions && savedBatchSessions.length > 0) {
          setBatchGroupInfo(savedBatchGroupInfo);
          setBatchSessions(savedBatchSessions);
          setShowBatchSessionsModal(true);
          // Lưu vị trí cuộn để khôi phục sau khi modal mở
          if (scrollPosition) {
            setPendingScrollPosition(scrollPosition);
          }
          // Xóa trạng thái đã lưu sau khi khôi phục
          clearBatchModalState();
        }
      } catch (error) {
        console.error('Error restoring batch modal state:', error);
        clearBatchModalState();
      }
    }
  }, []);

  // Khôi phục vị trí cuộn khi modal được mở và có pending scroll position
  useEffect(() => {
    if (showBatchSessionsModal && pendingScrollPosition !== null) {
      // Delay để đảm bảo modal đã render xong và DOM đã update
      const timeoutId = setTimeout(() => {
        if (batchModalBodyRef.current) {
          batchModalBodyRef.current.scrollTop = pendingScrollPosition;
          setPendingScrollPosition(null);
        }
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [showBatchSessionsModal, pendingScrollPosition]);

  // Fetch classes and student groups for batch edit
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        // Fetch classes
        const filterResponse = await api.get('/users/filter-options');
        if (filterResponse.data.success) {
          setClasses(filterResponse.data.classes.map(c => c.name));
        }

        // Fetch student groups
        const groupsResponse = await api.get('/student-groups');
        if (groupsResponse.data && groupsResponse.data.success) {
          setStudentGroups(groupsResponse.data.data || []);
        }
      } catch (error) {
        console.error('Error fetching filter options:', error);
      }
    };

    fetchFilterOptions();
  }, [api]);

  // Fetch students when class or group selection changes
  useEffect(() => {
    const fetchStudents = async () => {
      if (!batchEditData.selectedClass && !batchEditData.selectedGroup) {
        setSelectedStudents([]);
        return;
      }

      setLoadingStudents(true);
      try {
        if (batchEditData.studentSelection === 'class' && batchEditData.selectedClass) {
          // Fetch students by class
          const response = await api.get(`/users?role=student&class_name=${encodeURIComponent(batchEditData.selectedClass)}&limit=99999`);
          if (response.data.success) {
            setSelectedStudents(response.data.data || []);
          }
        } else if (batchEditData.studentSelection === 'group' && batchEditData.selectedGroup) {
          // Find group ID and fetch students
          const selectedGroup = studentGroups.find(group => group.group_name === batchEditData.selectedGroup);
          if (selectedGroup) {
            const response = await api.get(`/student-groups/${selectedGroup.id}`);
            if (response.data && response.data.success) {
              setSelectedStudents(response.data.data.students || []);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching students:', error);
        setSelectedStudents([]);
      } finally {
        setLoadingStudents(false);
      }
    };

    fetchStudents();
  }, [api, batchEditData.selectedClass, batchEditData.selectedGroup, batchEditData.studentSelection, studentGroups]);

  // Handle delete session
  const handleDeleteClick = (session) => {
    setSessionToDelete(session);
    setSessionNameConfirm('');
    setDeleteError('');
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    const sessionName = sessionToDelete?.title || sessionToDelete?.name;
    if (!sessionNameConfirm) {
      setDeleteError('Vui lòng nhập tên buổi học để xác nhận');
      return;
    }

    if (sessionNameConfirm !== sessionName) {
      setDeleteError('Tên buổi học không khớp. Vui lòng nhập lại chính xác.');
      return;
    }

    try {
      setDeleteLoading(true);
      setDeleteError('');

      const response = await api.delete(`/sessions/${sessionToDelete.id}`, {
        data: { sessionName: sessionNameConfirm }
      });

      if (response.data.success) {
        showAlert('Xóa buổi học thành công', 'success');
        setShowDeleteModal(false);
        setSessionNameConfirm('');
        // Tải lại trang hiện tại từ server (phân trang phía server)
        fetchSessions(pagination.page);
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      setDeleteError(error.response?.data?.message || 'Không thể xóa buổi học. Vui lòng thử lại sau.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <Badge bg="success">Đang diễn ra</Badge>;
      case 'scheduled':
        return <Badge bg="primary">Sắp diễn ra</Badge>;
      case 'ended':
        return <Badge bg="secondary">Đã kết thúc</Badge>;
      default:
        return <Badge bg="info">{status}</Badge>;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'active':
        return 'Đang diễn ra';
      case 'scheduled':
        return 'Sắp diễn ra';
      case 'ended':
        return 'Đã kết thúc';
      case 'cancelled':
        return 'Đã hủy';
      default:
        return status;
    }
  };

  // Calendar functions
  const getSessionsForDate = (date) => {
    return sessions.filter(session => {
      const sessionStartDate = parseISO(session.date);
      const sessionEndDate = session.end_date ? parseISO(session.end_date) : sessionStartDate;

      // Check if the date falls within the session's date range
      return (isSameDay(sessionStartDate, date) ||
        isSameDay(sessionEndDate, date) ||
        (isAfter(date, sessionStartDate) && isBefore(date, sessionEndDate)));
    });
  };

  const handleDateClick = (date) => {
    setSelectedDate(date);
    const dateStr = format(date, 'yyyy-MM-dd');
    navigate(`/admin/sessions/create?date=${dateStr}`);
  };

  const handleSessionClick = (session) => {
    setSelectedSession(session);
    setShowSessionDetailModal(true);
  };

  const handleBatchSessionClick = (batchSession) => {
    // Sắp xếp danh sách buổi học để các buổi "Đang diễn ra" hiển thị ở trên cùng
    const sortedBatchSessions = [...batchSession.batchSessions].sort((a, b) => {
      const statusA = a.calculatedStatus || a.status;
      const statusB = b.calculatedStatus || b.status;

      // Ưu tiên sắp xếp theo trạng thái: active > scheduled > ended > cancelled
      const statusPriority = {
        'active': 1,
        'scheduled': 2,
        'ended': 3,
        'cancelled': 4
      };

      const priorityA = statusPriority[statusA] || 5;
      const priorityB = statusPriority[statusB] || 5;

      // Nếu cùng trạng thái, sắp xếp theo ngày (mới nhất trước)
      if (priorityA === priorityB) {
        return new Date(b.date) - new Date(a.date);
      }

      return priorityA - priorityB;
    });

    setBatchSessions(sortedBatchSessions);
    setBatchGroupInfo({
      title: batchSession.title,
      dateRange: batchSession.dateRange,
      idRange: batchSession.idRange,
      totalSessions: batchSession.batchSessions.length
    });
    setShowBatchSessionsModal(true);
  };

  const handleBatchEditClick = () => {
    console.log('Debug - handleBatchEditClick called with:', {
      batchGroupInfo,
      batchSessionsCount: batchSessions.length,
      batchSessions: batchSessions.map(s => ({ id: s.id, date: s.date, title: s.title }))
    });

    // Initialize edit data with current batch info
    if (batchGroupInfo && batchSessions.length > 0) {
      const firstSession = batchSessions[0];

      // Debug log để kiểm tra giá trị end_date để xác định trực đêm
      console.log('Debug - First session end_date:', firstSession.end_date, typeof firstSession.end_date);
      console.log('Debug - First session date:', firstSession.date, typeof firstSession.date);
      console.log('Debug - Full firstSession object:', firstSession);

      // Parse monitoring options from first session
      let sessionMonitoringOptions = firstSession.monitoring_options || {};
      if (typeof sessionMonitoringOptions === 'string') {
        try {
          sessionMonitoringOptions = JSON.parse(sessionMonitoringOptions);
        } catch (error) {
          console.error('Error parsing monitoring_options:', error);
          sessionMonitoringOptions = {};
        }
      }

      // Initialize duty student dates from existing sessions
      const initialDutyStudentDates = {};

      // Collect all unique duty students from all sessions in the batch
      const allDutyStudents = new Map(); // Use Map to avoid duplicates

      batchSessions.forEach(session => {
        const sessionMonitoring = session.monitoring_options || {};
        let parsedMonitoring = sessionMonitoring;
        if (typeof sessionMonitoring === 'string') {
          try {
            parsedMonitoring = JSON.parse(sessionMonitoring);
          } catch (error) {
            console.error('Error parsing monitoring options for session', session.id, ':', error);
            return;
          }
        }

        if (parsedMonitoring.attendance?.during_session?.duty_students) {
          parsedMonitoring.attendance.during_session.duty_students.forEach(student => {
            // Store student info if not already stored
            if (!allDutyStudents.has(student.id)) {
              allDutyStudents.set(student.id, student);
            }

            // Add this session's date to the student's dates
            if (!initialDutyStudentDates[student.id]) {
              initialDutyStudentDates[student.id] = [];
            }

            if (!initialDutyStudentDates[student.id].includes(session.date)) {
              initialDutyStudentDates[student.id].push(session.date);
            }
          });
        }
      });

      // Update batchEditData with all duty students found
      const allDutyStudentsArray = Array.from(allDutyStudents.values());

      console.log('Debug - Found duty students:', allDutyStudentsArray);
      console.log('Debug - Initial duty student dates:', initialDutyStudentDates);
      console.log('Debug - All batch session dates:', batchSessions.map(s => s.date));

      setDutyStudentDates(initialDutyStudentDates);

      const batchData = {
        title: batchGroupInfo.title || '',
        location: firstSession.location || '',
        startTime: firstSession.start_time || '',
        endTime: firstSession.end_time || '',
        description: firstSession.description || '',
        nightShift: Boolean(firstSession.end_date && firstSession.end_date !== firstSession.date),
        endDate: firstSession.end_date || '',
        studentSelection: firstSession.group_names ? 'group' : 'class',
        selectedClass: firstSession.class_names || '',
        selectedGroup: firstSession.group_names || '',
        monitoringOptions: {
          location: {
            enabled: sessionMonitoringOptions.location?.enabled ?? false,
            interval: sessionMonitoringOptions.location?.interval ?? 120,
            accuracy: sessionMonitoringOptions.location?.accuracy ?? "high",
            required: sessionMonitoringOptions.location?.required ?? true,
            enforcement: sessionMonitoringOptions.location?.enforcement ?? 'immediate',
            geofence: {
              enabled: sessionMonitoringOptions.location?.geofence?.enabled ?? true,
              radius: sessionMonitoringOptions.location?.geofence?.radius ?? 100,
              coordinates: {
                latitude: sessionMonitoringOptions.location?.geofence?.coordinates?.latitude ?? null,
                longitude: sessionMonitoringOptions.location?.geofence?.coordinates?.longitude ?? null
              },
              alertOnExit: sessionMonitoringOptions.location?.geofence?.alertOnExit ?? true,
              alertEmail: sessionMonitoringOptions.location?.geofence?.alertEmail ?? 'daotao1@pctu.edu.vn'
            }
          },
          file_upload: {
            enabled: sessionMonitoringOptions.file_upload?.enabled ?? false,
            max_size: sessionMonitoringOptions.file_upload?.max_size ?? 50,
            allowed_types: sessionMonitoringOptions.file_upload?.allowed_types ?? ["image/*", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
            required: sessionMonitoringOptions.file_upload?.required ?? true,
            min_files: sessionMonitoringOptions.file_upload?.min_files ?? 1
          },
          attendance: {
            before_session: {
              enabled: sessionMonitoringOptions.attendance?.before_session?.enabled ?? false,
              minutes_before: sessionMonitoringOptions.attendance?.before_session?.minutes_before ?? 30,
              duration: sessionMonitoringOptions.attendance?.before_session?.duration ?? 30,
              max_late_minutes: sessionMonitoringOptions.attendance?.before_session?.max_late_minutes ?? 30
            },
            during_session: {
              enabled: sessionMonitoringOptions.attendance?.during_session?.enabled ?? false,
              minutes_after_start: sessionMonitoringOptions.attendance?.during_session?.minutes_after_start ?? 120,
              minutes_before_end: sessionMonitoringOptions.attendance?.during_session?.minutes_before_end ?? 120,
              duty_students: allDutyStudentsArray // Use all duty students found across all sessions
            },
            after_session: {
              enabled: sessionMonitoringOptions.attendance?.after_session?.enabled ?? false,
              minutes_after: sessionMonitoringOptions.attendance?.after_session?.minutes_after ?? 0,
              duration: sessionMonitoringOptions.attendance?.after_session?.duration ?? 30
            }
          }
        }
      };

      // Debug log để kiểm tra giá trị nightShift được set
      console.log('Debug - Setting batchEditData with nightShift:', batchData.nightShift);
      console.log('Debug - Full batchData object:', batchData);

      setBatchEditData(batchData);

      // Set selectedBatchLocationIndex based on location
      const locationIndex = predefinedLocations.findIndex(loc => loc.name === firstSession.location);
      if (locationIndex !== -1) {
        setSelectedBatchLocationIndex(locationIndex);
      } else {
        // Check if coordinates match any predefined hospital
        const coordsIndex = predefinedLocations.findIndex(loc =>
          loc.latitude &&
          loc.longitude &&
          sessionMonitoringOptions.location?.geofence?.coordinates?.latitude &&
          sessionMonitoringOptions.location?.geofence?.coordinates?.longitude &&
          Math.abs(loc.latitude - sessionMonitoringOptions.location.geofence.coordinates.latitude) < 0.0001 &&
          Math.abs(loc.longitude - sessionMonitoringOptions.location.geofence.coordinates.longitude) < 0.0001
        );
        setSelectedBatchLocationIndex(coordsIndex !== -1 ? coordsIndex : 0);
      }
    }
    setBatchEditError('');
    setShowBatchEditModal(true);
  };

  const handleBatchDeleteClick = () => {
    setBatchDeleteConfirm('');
    setBatchDeleteError('');
    setShowBatchDeleteModal(true);
  };

  const handleBatchEditConfirm = async () => {
    try {
      setBatchEditLoading(true);
      setBatchEditError('');

      // Validate required fields
      if (!batchEditData.title.trim()) {
        setBatchEditError('Vui lòng nhập tên buổi học');
        return;
      }

      if (!batchEditData.startTime || !batchEditData.endTime) {
        setBatchEditError('Vui lòng nhập thời gian bắt đầu và kết thúc');
        return;
      }

      // Lấy danh sách ID của tất cả buổi học trong batch
      const sessionIds = batchSessions.map(session => session.id);

      // Prepare monitoring options with duty student dates for each session
      const sessionsWithMonitoringOptions = batchSessions.map(session => {
        const baseMonitoringOptions = batchEditData.monitoringOptions;

        // Compute end_date per session based on nightShift toggle
        const computeNextDay = (dateStr) => {
          try {
            const d = new Date(dateStr);
            // Ensure we treat dateStr as UTC-less date
            const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
            const yyyy = next.getFullYear();
            const mm = String(next.getMonth() + 1).padStart(2, '0');
            const dd = String(next.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
          } catch (_) {
            return null;
          }
        };
        const endDateForSession = batchEditData.nightShift ? computeNextDay(session.date) : null;

        // Xử lý sinh viên ra ca trực cho ngày cụ thể này
        if (baseMonitoringOptions?.attendance?.during_session?.duty_students &&
          baseMonitoringOptions.attendance.during_session.duty_students.length > 0) {

          // Lọc sinh viên ra ca trực chỉ cho ngày này
          const dutyStudentsForThisDate = baseMonitoringOptions.attendance.during_session.duty_students.filter(student => {
            const studentDates = getDutyStudentDates(student.id);
            return studentDates.includes(session.date);
          });

          return {
            sessionId: session.id,
            // Include basic info along with monitoring options
            title: batchEditData.title.trim(),
            location: batchEditData.location.trim(),
            start_time: batchEditData.startTime,
            end_time: batchEditData.endTime,
            description: batchEditData.description.trim(),
            end_date: endDateForSession,
            monitoringOptions: {
              ...baseMonitoringOptions,
              attendance: {
                ...baseMonitoringOptions.attendance,
                during_session: {
                  ...baseMonitoringOptions.attendance.during_session,
                  duty_students: dutyStudentsForThisDate
                }
              }
            }
          };
        }

        return {
          sessionId: session.id,
          // Include basic info along with monitoring options
          title: batchEditData.title.trim(),
          location: batchEditData.location.trim(),
          start_time: batchEditData.startTime,
          end_time: batchEditData.endTime,
          description: batchEditData.description.trim(),
          end_date: endDateForSession,
          monitoringOptions: baseMonitoringOptions
        };
      });

      // Debug log để kiểm tra dữ liệu được gửi
      console.log('Debug - Batch edit data being sent:', {
        sessionIds,
        updateData: {
          title: batchEditData.title.trim(),
          location: batchEditData.location.trim(),
          start_time: batchEditData.startTime,
          end_time: batchEditData.endTime,
          description: batchEditData.description.trim(),
          sessionsWithMonitoringOptions: sessionsWithMonitoringOptions
        }
      });

      // Gọi API để cập nhật tất cả buổi học
      const response = await api.put('/sessions/batch', {
        sessionIds: sessionIds,
        updateData: {
          title: batchEditData.title.trim(),
          location: batchEditData.location.trim(),
          start_time: batchEditData.startTime,
          end_time: batchEditData.endTime,
          description: batchEditData.description.trim(),
          nightShift: batchEditData.nightShift,
          monitoring_options: batchEditData.monitoringOptions,
          studentSelection: batchEditData.studentSelection,
          selectedClass: batchEditData.selectedClass,
          selectedGroup: batchEditData.selectedGroup,
          sessionsWithMonitoringOptions: sessionsWithMonitoringOptions // Thêm dữ liệu ngày cụ thể
        }
      });

      if (response.data.success) {
        showAlert(`Đã cập nhật thành công ${sessionIds.length} buổi học hàng loạt`, 'success');

        // Show additional info if student data was updated
        if (batchEditData.studentSelection && (batchEditData.selectedClass || batchEditData.selectedGroup)) {
          const selectionType = batchEditData.studentSelection === 'class' ? 'lớp' : 'nhóm';
          const selectionValue = batchEditData.selectedClass || batchEditData.selectedGroup;
          showAlert(`Đã cập nhật danh sách sinh viên theo ${selectionType}: ${selectionValue}`, 'info');
        }

        setShowBatchEditModal(false);
        setShowBatchSessionsModal(false);

        // Reset duty student dates state
        setDutyStudentDates({});

        // Refresh sessions list by refetching trang 1
        const refreshSessions = async () => {
          try {
            showAlert('Đang cập nhật danh sách buổi học...', 'info');
            await fetchSessions(1);
            showAlert('Danh sách buổi học đã được cập nhật', 'success');
          } catch (error) {
            console.error('Error refreshing sessions:', error);
            showAlert('Có lỗi khi cập nhật danh sách buổi học', 'danger');
          } finally {
            setLoading(false);
          }
        };

        refreshSessions();
      }
    } catch (error) {
      console.error('Error updating batch sessions:', error);
      setBatchEditError(error.response?.data?.message || 'Không thể cập nhật buổi học hàng loạt. Vui lòng thử lại sau.');
    } finally {
      setBatchEditLoading(false);
    }
  };

  const handleBatchDeleteConfirm = async () => {
    const sessionTitle = batchGroupInfo?.title;
    if (!batchDeleteConfirm) {
      setBatchDeleteError('Vui lòng nhập tên buổi học để xác nhận');
      return;
    }

    if (batchDeleteConfirm !== sessionTitle) {
      setBatchDeleteError('Tên buổi học không khớp. Vui lòng nhập lại chính xác.');
      return;
    }

    try {
      setBatchDeleteLoading(true);
      setBatchDeleteError('');

      // Lấy danh sách ID của tất cả buổi học trong batch
      const sessionIds = batchSessions.map(session => session.id);

      // Gọi API để xóa tất cả buổi học
      const response = await api.delete('/sessions/batch', {
        data: {
          sessionIds: sessionIds,
          sessionName: batchDeleteConfirm
        }
      });

      if (response.data.success) {
        showAlert(`Đã xóa thành công ${sessionIds.length} buổi học hàng loạt`, 'success');
        setShowBatchDeleteModal(false);
        setShowBatchSessionsModal(false);
        setBatchDeleteConfirm('');
        // Tải lại trang hiện tại từ server (phân trang phía server)
        fetchSessions(pagination.page);
      }
    } catch (error) {
      console.error('Error deleting batch sessions:', error);
      setBatchDeleteError(error.response?.data?.message || 'Không thể xóa buổi học hàng loạt. Vui lòng thử lại sau.');
    } finally {
      setBatchDeleteLoading(false);
    }
  };

  const navigateCalendar = (direction) => {
    if (calendarView === 'month') {
      setCurrentDate(addMonths(currentDate, direction));
    } else if (calendarView === 'week') {
      setCurrentDate(addDays(currentDate, direction * 7));
    } else if (calendarView === 'day') {
      setCurrentDate(addDays(currentDate, direction));
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return <i className="fas fa-play-circle text-success" title="Đang diễn ra"></i>;
      case 'scheduled':
        return <i className="fas fa-clock text-primary" title="Sắp diễn ra"></i>;
      case 'ended':
        return <i className="fas fa-check-circle" style={{ color: '#6c757d' }} title="Đã kết thúc"></i>;
      case 'cancelled':
        return <i className="fas fa-times-circle text-danger" title="Đã hủy"></i>;
      default:
        return <i className="fas fa-question-circle text-info" title={status}></i>;
    }
  };

  // Calendar View Component
  const CalendarView = () => {
    const renderMonthView = () => {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
      const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

      const days = [];
      let day = startDate;

      while (day <= endDate) {
        days.push(day);
        day = addDays(day, 1);
      }

      return (
        <div className="calendar-month">
          <div className="calendar-header">
            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(day => (
              <div key={day} className="calendar-day-header">{day}</div>
            ))}
          </div>
          <div className="calendar-body">
            {days.map((day, index) => {
              const daySessions = getSessionsForDate(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={index}
                  className={`calendar-day ${!isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}`}
                  onClick={() => handleDateClick(day)}
                >
                  <div className="day-number">{format(day, 'd')}</div>
                  <div className="day-sessions">
                    {daySessions.map((session, index) => (
                      <div
                        key={session.id}
                        className="session-preview"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSessionClick(session);
                        }}
                      >
                        <div className="session-status-overlay">
                          {getStatusIcon(session.calculatedStatus || session.status)}
                        </div>
                        <div className="session-content">
                          <div className="session-main-info">
                            <div className="session-title">{session.title || session.name}</div>
                            <div className="session-class">{session.class_names || '-'}</div>
                          </div>
                          <div className="session-details">
                            <div className="session-detail-item">
                              <i className="fas fa-clock"></i>
                              <span>{session.start_time}</span>
                            </div>
                            <div className="session-detail-item">
                              <i className="fas fa-map-marker-alt"></i>
                              <span>{session.location}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    const renderWeekView = () => {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const days = [];

      for (let i = 0; i < 7; i++) {
        days.push(addDays(weekStart, i));
      }

      return (
        <div className="calendar-week">
          <div className="week-header">
            {days.map((day, index) => (
              <div key={index} className="week-day-header">
                <div className="day-name">{format(day, 'EEE', { locale: vi })}</div>
                <div className="day-number">{format(day, 'd')}</div>
              </div>
            ))}
          </div>
          <div className="week-body">
            {days.map((day, index) => {
              const daySessions = getSessionsForDate(day);
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={index}
                  className={`week-day ${isToday ? 'today' : ''}`}
                  onClick={() => handleDateClick(day)}
                >
                  <div className="day-sessions">
                    {daySessions.map((session, index) => (
                      <div
                        key={session.id}
                        className="session-preview"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSessionClick(session);
                        }}
                      >
                        <div className="session-status-overlay">
                          {getStatusIcon(session.calculatedStatus || session.status)}
                        </div>
                        <div className="session-content">
                          <div className="session-main-info">
                            <div className="session-title">{session.title || session.name}</div>
                            <div className="session-class">{session.class_names || '-'}</div>
                          </div>
                          <div className="session-details">
                            <div className="session-detail-item">
                              <i className="fas fa-clock"></i>
                              <span>{session.start_time}</span>
                            </div>
                            <div className="session-detail-item">
                              <i className="fas fa-map-marker-alt"></i>
                              <span>{session.location}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    const renderDayView = () => {
      const daySessions = getSessionsForDate(currentDate);

      return (
        <div className="calendar-day-view">
          <div className="day-header">
            <h4>{format(currentDate, 'EEEE, dd/MM/yyyy', { locale: vi })}</h4>
            <Button variant="outline-primary" onClick={() => handleDateClick(currentDate)}>
              <i className="fas fa-plus me-1"></i>Tạo buổi học mới
            </Button>
          </div>
          <div className="day-sessions">
            {daySessions.length > 0 ? (
              daySessions.map(session => (
                <Card key={session.id} className="mb-3 session-card" onClick={() => handleSessionClick(session)}>
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <h6 className="mb-2">{session.title || session.name}</h6>
                        <div className="session-details1">
                          <div className="mb-1">
                            <i className="fas fa-clock me-2 text-primary"></i>
                            {session.start_time} - {session.end_time}
                          </div>
                          <div className="mb-1">
                            <i className="fas fa-map-marker-alt me-2 text-success"></i>
                            {session.location}
                          </div>
                          <div className="mb-1">
                            <i className="fas fa-users me-2 text-info"></i>
                            {session.class_names || '-'}
                          </div>
                        </div>
                      </div>
                      <div className="session-status">
                        {getStatusIcon(session.calculatedStatus || session.status)}
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              ))
            ) : (
              <div className="text-center text-muted py-4">
                <i className="fas fa-calendar-times fa-3x mb-3"></i>
                <p>Không có buổi học nào trong ngày này</p>
                <Button variant="primary" onClick={() => handleDateClick(currentDate)}>
                  <i className="fas fa-plus me-1"></i>Tạo buổi học mới
                </Button>
              </div>
            )}
          </div>
        </div>
      );
    };

    return (
      <div className="calendar-container">
        <div className="calendar-controls">
          <div className="calendar-nav">
            <button className="calendar-nav-btn" onClick={() => setCurrentDate(new Date())}>
              <i className="fas fa-home"></i>
              <span className="nav-text">Hôm nay</span>
            </button>
            <button className="calendar-nav-btn" onClick={() => navigateCalendar(-1)}>
              <i className="fas fa-chevron-left"></i>
            </button>
            <button className="calendar-nav-btn" onClick={() => navigateCalendar(1)}>
              <i className="fas fa-chevron-right"></i>
            </button>
          </div>

          <div className="calendar-title">
            {calendarView === 'month' && format(currentDate, 'MMMM yyyy', { locale: vi })}
            {calendarView === 'week' && `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'dd/MM')} - ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'dd/MM/yyyy')}`}
            {calendarView === 'day' && format(currentDate, 'dd/MM/yyyy')}
          </div>

          <div className="calendar-view-buttons">
            <button
              className={`view-btn ${calendarView === 'month' ? 'active' : ''}`}
              onClick={() => setCalendarView('month')}
            >
              <i className="fas fa-calendar-alt"></i>
              <span className="view-text">Tháng</span>
            </button>
            <button
              className={`view-btn ${calendarView === 'week' ? 'active' : ''}`}
              onClick={() => setCalendarView('week')}
            >
              <i className="fas fa-calendar-week"></i>
              <span className="view-text">Tuần</span>
            </button>
            <button
              className={`view-btn ${calendarView === 'day' ? 'active' : ''}`}
              onClick={() => setCalendarView('day')}
            >
              <i className="fas fa-calendar-day"></i>
              <span className="view-text">Ngày</span>
            </button>
          </div>
        </div>

        {calendarView === 'month' && renderMonthView()}
        {calendarView === 'week' && renderWeekView()}
        {calendarView === 'day' && renderDayView()}
      </div>
    );
  };

  // Function to group batch sessions with smart criteria
  const groupBatchSessions = (sessions) => {
    console.log('🔍 Debug - Original sessions:', sessions);

    // Helper function to normalize time strings for comparison
    const normalizeTime = (timeStr) => {
      if (!timeStr) return '';
      // Remove seconds and milliseconds for comparison
      return timeStr.substring(0, 5); // HH:MM format
    };

    // Helper function to normalize student groups/classes for comparison
    const normalizeStudentSelection = (session) => {
      const groups = session.group_names || '';
      const classes = session.class_names || '';
      return `${groups}_${classes}`.trim();
    };

    // Helper function to normalize monitoring options for comparison
    const normalizeMonitoringOptions = (options) => {
      if (!options) return '';

      try {
        // Deep clone the options to avoid modifying original
        const clonedOptions = JSON.parse(JSON.stringify(options));

        // Remove duty_students from comparison as they can be different for each session
        if (clonedOptions.attendance?.during_session?.duty_students) {
          delete clonedOptions.attendance.during_session.duty_students;
        }

        // Convert to string and sort for consistent comparison
        return JSON.stringify(clonedOptions).split('').sort().join('');
      } catch (error) {
        console.warn('Error normalizing monitoring options:', error);
        return '';
      }
    };

    // Helper function to check if sessions are truly similar
    const areSessionsSimilar = (session1, session2) => {
      return (
        (session1.title || session1.name) === (session2.title || session2.name) &&
        normalizeTime(session1.start_time) === normalizeTime(session2.start_time) &&
        normalizeTime(session1.end_time) === normalizeTime(session2.end_time) &&
        (session1.location || '') === (session2.location || '') &&
        normalizeStudentSelection(session1) === normalizeStudentSelection(session2) &&
        normalizeMonitoringOptions(session1.monitoring_options) === normalizeMonitoringOptions(session2.monitoring_options)
      );
    };

    // Helper function to check if sessions were created within 10 seconds
    const areSessionsCreatedWithin10Seconds = (session1, session2) => {
      const timeDiff = Math.abs(new Date(session1.created_at) - new Date(session2.created_at));
      return timeDiff <= 10000; // 10 seconds in milliseconds
    };

    // Group sessions by smart criteria
    const sessionGroups = new Map();

    sessions.forEach(session => {
      const title = session.title || session.name;
      const startTime = normalizeTime(session.start_time);
      const endTime = normalizeTime(session.end_time);
      const location = session.location || '';
      const studentSelection = normalizeStudentSelection(session);
      const monitoringOptions = normalizeMonitoringOptions(session.monitoring_options);

      // Create a comprehensive key based on all criteria
      const key = `${title}_${startTime}_${endTime}_${location}_${studentSelection}_${monitoringOptions}`;

      console.log(`🔍 Processing session ${session.id}:`, {
        title: title,
        start_time: startTime,
        end_time: endTime,
        location: location,
        student_selection: studentSelection,
        monitoring_options: monitoringOptions,
        key: key
      });

      if (!sessionGroups.has(key)) {
        sessionGroups.set(key, []);
      }
      sessionGroups.get(key).push(session);
    });

    console.log('🔍 Session groups after smart grouping:', sessionGroups);

    const result = [];

    // Process each group with improved logic
    sessionGroups.forEach((groupSessions, key) => {
      console.log(`🔍 Processing group ${key} with ${groupSessions.length} sessions`);

      if (groupSessions.length > 1) {
        // Sort sessions by creation time
        const sortedGroup = groupSessions.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        // Find all possible batch groups within this session group
        const batchGroups = [];
        let currentBatch = [sortedGroup[0]];

        for (let i = 1; i < sortedGroup.length; i++) {
          const currentSession = sortedGroup[i];
          const lastSessionInBatch = currentBatch[currentBatch.length - 1];

          // Check if current session can be added to current batch
          if (areSessionsSimilar(currentSession, lastSessionInBatch) &&
            areSessionsCreatedWithin10Seconds(currentSession, lastSessionInBatch)) {
            currentBatch.push(currentSession);
          } else {
            // Start a new batch
            if (currentBatch.length > 1) {
              batchGroups.push([...currentBatch]);
            }
            currentBatch = [currentSession];
          }
        }

        // Add the last batch if it has more than 1 session
        if (currentBatch.length > 1) {
          batchGroups.push(currentBatch);
        }

        console.log(`🔍 Found ${batchGroups.length} batch groups for key ${key}`);

        // Process each batch group
        const processedSessions = new Set();

        batchGroups.forEach((batchSessions, batchIndex) => {
          console.log(`🔍 Processing batch ${batchIndex + 1} with ${batchSessions.length} sessions`);

          // Mark sessions as processed
          batchSessions.forEach(session => processedSessions.add(session.id));

          // Create batch session object
          const firstSession = batchSessions[0];
          const lastSession = batchSessions[batchSessions.length - 1];

          // Calculate batch status based on all sessions in the batch
          const calculateBatchStatus = (sessions) => {
            const statuses = sessions.map(session => calculateSessionStatus(session));

            // Priority order: active > scheduled > ended > cancelled
            if (statuses.includes('active')) return 'active';
            if (statuses.includes('scheduled')) return 'scheduled';
            if (statuses.includes('ended')) return 'ended';
            if (statuses.includes('cancelled')) return 'cancelled';

            return 'scheduled'; // Default fallback
          };

          // Tìm ngày bắt đầu sớm nhất và ngày kết thúc muộn nhất từ tất cả các buổi học
          let earliestStartDate = null;
          let latestEndDate = null;

          batchSessions.forEach(session => {
            const sessionStartDate = new Date(session.date);
            const sessionEndDate = new Date(session.end_date || session.date);

            if (!earliestStartDate || sessionStartDate < earliestStartDate) {
              earliestStartDate = sessionStartDate;
            }

            if (!latestEndDate || sessionEndDate > latestEndDate) {
              latestEndDate = sessionEndDate;
            }
          });

          // Chuyển về định dạng string (YYYY-MM-DD)
          const formatDateToString = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          };

          const batchSession = {
            id: `batch_${firstSession.id}_${lastSession.id}`,
            title: firstSession.title || firstSession.name,
            description: firstSession.description,
            group_id: firstSession.group_id,
            group_name: firstSession.group_name,
            class_names: firstSession.class_names,
            group_names: firstSession.group_names,
            location: firstSession.location,
            start_time: firstSession.start_time,
            end_time: firstSession.end_time,
            student_count: firstSession.student_count,
            created_by: firstSession.created_by,
            created_by_username: firstSession.created_by_username,
            created_by_full_name: firstSession.created_by_full_name,
            monitoring_options: firstSession.monitoring_options,
            calculatedStatus: calculateBatchStatus(batchSessions),
            isBatch: true,
            batchSessions: batchSessions,
            dateRange: {
              start: formatDateToString(earliestStartDate),
              end: formatDateToString(latestEndDate)
            },
            idRange: {
              start: batchSessions[0].id,
              end: batchSessions[batchSessions.length - 1].id
            }
          };

          console.log(`✅ Created smart batch session:`, batchSession);
          result.push(batchSession);
        });

        // Add individual sessions that weren't part of any batch
        sortedGroup.forEach(session => {
          if (!processedSessions.has(session.id)) {
            console.log(`✅ Added individual session:`, session);
            result.push(session);
          }
        });

      } else {
        // This is an individual session
        console.log(`✅ Added individual session:`, groupSessions[0]);
        result.push(groupSessions[0]);
      }
    });

    console.log('🔍 Final smart grouped sessions:', result);

    return result;
  };

  // Filter dropdowns lấy từ API filter-options (không phụ thuộc dữ liệu trang hiện tại)
  const uniqueLocations = filterOptions.locations || [];
  const uniqueClasses = filterOptions.classes || [];
  const uniqueGroups = filterOptions.groups || [];

  // Server đã trả về dữ liệu đã gộp batch và đã lọc theo bộ lọc; chỉ lọc thêm theo studentSearchSessionIds nếu có (badge tìm SV)
  const filteredSessions = sessions.filter(session => {
      if (studentSearch && studentSearch.trim().length >= 2 && studentSearchSessionIds !== null) {
        const sessionMatch = studentSearchSessionIds.has(session.id);
        const batchMatch = session.isBatch && session.batchSessions?.some(s => studentSearchSessionIds.has(s.id));
        if (!sessionMatch && !batchMatch) return false;
      }
      return true;
    });

  // Pagination được cập nhật từ server trong fetchSessions, không tính từ filteredSessions

  if (loading) {
    return <Loader text="Đang tải danh sách buổi học..." />;
  }

  return (
    <div>
      {/* Header Section */}
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Danh sách buổi học</h1>
            <p className="header-subtitle">Quản lý và theo dõi các buổi học</p>
          </div>
          <div className="header-actions">
            <Button as={Link} to="/admin/sessions/create" variant="outline-light" className="create-session-btn">
              <i className="fas fa-plus"></i>
              Tạo buổi học mới
            </Button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="custom-tabs">
          <Tab eventKey="list" title={
            <span className="tab-title">
              <i className="fas fa-list"></i>
              Danh sách
            </span>
          }>
            <div className="session-list-container">
              <div className="session-list-controls">
                <div className="search-controls" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                  <Form.Control
                    type="text"
                    placeholder="Tìm kiếm theo tên..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                    style={{ minWidth: '150px', flex: '1 1 150px' }}
                  />
                  
                  <div style={{ position: 'relative', minWidth: '180px', flex: '1 1 180px' }}>
                    <Form.Control
                      type="text"
                      placeholder="Tìm theo tên sinh viên..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="search-input"
                      style={{ paddingRight: isSearchingStudent ? '35px' : undefined }}
                    />
                    {isSearchingStudent && (
                      <Spinner 
                        animation="border" 
                        size="sm" 
                        style={{ 
                          position: 'absolute', 
                          right: '10px', 
                          top: '50%', 
                          transform: 'translateY(-50%)',
                          width: '16px',
                          height: '16px'
                        }} 
                      />
                    )}
                    {studentSearch && studentSearch.trim().length >= 2 && studentSearchSessionIds !== null && !isSearchingStudent && (
                      <Badge 
                        bg={studentSearchSessionIds.size > 0 ? "success" : "secondary"}
                        style={{ 
                          position: 'absolute', 
                          right: '10px', 
                          top: '50%', 
                          transform: 'translateY(-50%)',
                          fontSize: '10px'
                        }}
                      >
                        {studentSearchSessionIds.size}
                      </Badge>
                    )}
                  </div>

                  <Form.Select
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    className="filter-select"
                    style={{ minWidth: '130px', flex: '1 1 130px' }}
                  >
                    <option value="">Tất cả địa điểm</option>
                    {uniqueLocations.map(location => (
                      <option key={location} value={location}>{location}</option>
                    ))}
                  </Form.Select>

                  <Form.Select
                    value={classFilter}
                    onChange={(e) => setClassFilter(e.target.value)}
                    className="filter-select"
                    style={{ minWidth: '120px', flex: '1 1 120px' }}
                  >
                    <option value="">Tất cả lớp</option>
                    {uniqueClasses.map(cls => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </Form.Select>

                  <Form.Select
                    value={groupFilter}
                    onChange={(e) => setGroupFilter(e.target.value)}
                    className="filter-select"
                    style={{ minWidth: '120px', flex: '1 1 120px' }}
                  >
                    <option value="">Tất cả nhóm</option>
                    {uniqueGroups.map(group => (
                      <option key={group} value={group}>{group}</option>
                    ))}
                  </Form.Select>

                  <Form.Select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="filter-select"
                    style={{ minWidth: '130px', flex: '1 1 130px' }}
                  >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="active">Đang diễn ra</option>
                    <option value="scheduled">Sắp diễn ra</option>
                    <option value="ended">Đã kết thúc</option>
                    <option value="cancelled">Đã hủy</option>
                  </Form.Select>

                  {(searchTerm || studentSearch || locationFilter || classFilter || groupFilter || filter !== 'active') && (
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => {
                        setSearchTerm('');
                        setStudentSearch('');
                        setStudentSearchSessionIds(null);
                        setLocationFilter('');
                        setClassFilter('');
                        setGroupFilter('');
                        setFilter('active');
                      }}
                      title="Xóa tất cả bộ lọc"
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      <i className="fas fa-times me-1"></i>
                      Xóa lọc
                    </Button>
                  )}
                </div>
              </div>

              <div className="session-table-container">
                <div className="table-responsive-mobile">
                  <table className="session-table">
                    <thead>
                      <tr>
                        <th className="mobile-essential">ID</th>
                        <th className="mobile-essential">Tên buổi học</th>
                        <th className="mobile-essential">Ngày</th>
                        <th className="mobile-essential">Thời gian</th>
                        <th className="mobile-essential">Địa điểm</th>
                        <th className="mobile-essential">Lớp</th>
                        <th className="mobile-essential">Nhóm</th>
                        <th className="mobile-essential">Số sinh viên</th>
                        <th className="mobile-essential">Trạng thái</th>
                        <th className="mobile-essential">Hành động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSessions
                        .map(session => (
                        <tr
                          key={session.id}
                          className={`${session.calculatedStatus === 'active' ? 'active-session-row' : ''} ${session.isBatch ? 'batch-session-row' : ''}`}
                          onClick={() => session.isBatch ? handleBatchSessionClick(session) : handleSessionClick(session)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td className="mobile-essential">
                            <span className="session-id">
                              {session.isBatch ? (
                                <span className="batch-id">
                                  {session.idRange.end} - {session.idRange.start}
                                </span>
                              ) : (
                                session.id
                              )}
                            </span>
                          </td>
                          <td className="mobile-essential">
                            <span className="session-title-cell">
                              {session.title || session.name}
                              {session.isBatch && (
                                <Badge bg="info" className="ms-2" title={`${session.batchSessions.length} buổi học`}>
                                  {session.batchSessions.length} buổi
                                </Badge>
                              )}
                            </span>
                          </td>
                          <td className="mobile-essential">
                            <span className="session-date">
                              {session.isBatch ? (
                                <span className="batch-date-range">
                                  {formatDateRange(session.dateRange.start, session.dateRange.end)}
                                </span>
                              ) : (
                                formatDateRange(session.end_date, session.date)
                              )}
                            </span>
                          </td>
                          <td className="mobile-essential">
                            <span className="session-time">
                              {session.start_time && session.end_time ?
                                `${session.start_time} - ${session.end_time}` :
                                session.time}
                            </span>
                          </td>
                          <td className="mobile-essential"><span className="session-location">{session.location}</span></td>
                          <td className="mobile-essential"><span className="session-class">{session.class_names || '-'}</span></td>
                          <td className="mobile-essential"><span className="session-group">{session.group_names || '-'}</span></td>
                          <td className="mobile-essential"><span className="session-student-count">{session.student_count || session.studentCount || '-'}</span></td>
                          <td className="mobile-essential">
                            <span className={`status-badge ${session.calculatedStatus || session.status}`}>
                              {getStatusText(session.calculatedStatus || session.status)}
                            </span>
                          </td>
                          <td className="mobile-essential">
                            <div className="action-buttons" onClick={(e) => e.stopPropagation()}>
                              {session.isBatch ? (
                                <button
                                  className="action-btn btn-outline-info"
                                  onClick={() => handleBatchSessionClick(session)}
                                  title="Xem chi tiết các buổi học"
                                >
                                  <i className="fas fa-list"></i>
                                </button>
                              ) : (
                                <>
                                  <Link
                                    to={`/admin/sessions/${session.id}`}
                                    className="action-btn btn-outline-primary"
                                    title="Xem chi tiết buổi học"
                                  >
                                    <i className="fas fa-eye"></i>
                                  </Link>

                                  <Link
                                    to={`/admin/sessions/${session.id}/edit`}
                                    className="action-btn btn-outline-warning"
                                    title="Chỉnh sửa buổi học"
                                  >
                                    <i className="fas fa-edit"></i>
                                  </Link>

                                  {session.calculatedStatus !== 'cancelled' && session.calculatedStatus !== 'ended' && (
                                    <Link
                                      to={`/admin/sessions/${session.id}/qr-code`}
                                      className="action-btn btn-outline-success"
                                      title="Xem mã QR Code"
                                    >
                                      <i className="fas fa-qrcode"></i>
                                    </Link>
                                  )}

                                  <button
                                    className="action-btn btn-outline-danger"
                                    onClick={() => handleDeleteClick(session)}
                                    title="Xóa buổi học"
                                  >
                                    <i className="fas fa-trash"></i>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {filteredSessions.length > 0 && pagination.totalPages > 1 && (
                  <div className="mt-3">
                    <Pagination
                      currentPage={pagination.page}
                      totalPages={pagination.totalPages}
                      onPageChange={(page) => fetchSessions(page)}
                      maxVisiblePages={5}
                      showFirstLast={true}
                    />
                  </div>
                )}
              </div>
            </div>
          </Tab>

          <Tab eventKey="calendar" title={
            <span className="tab-title">
              <i className="fas fa-calendar-alt"></i>
              Lịch
            </span>
          }>
            <CalendarView />
          </Tab>
        </Tabs>
      </div>

      {/* Session Detail Modal */}
      <Modal
        show={showSessionDetailModal}
        onHide={() => setShowSessionDetailModal(false)}
        size="xl"
        className="student-detail-modal"
        centered
      >
        <Modal.Header closeButton className="student-detail-header">
          <Modal.Title className="student-detail-title">
            <div className="student-avatar">
              <i className="fas fa-calendar-alt"></i>
            </div>
            <div>
              <h4 className="mb-0">Chi tiết buổi học</h4>
              <p className="mb-0 student-subtitle">{selectedSession?.title || selectedSession?.name || 'Buổi học'}</p>
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="student-detail-body">
          {selectedSession && (
            <div className="student-detail-container">
              <Row>
                <Col md={6}>
                  <div className="session-card">
                    <div className="card-header-modern">
                      <div className="header-icon">
                        <i className="fas fa-calendar"></i>
                      </div>
                      <h6 className="mb-0">Thông tin cơ bản</h6>
                    </div>
                    <div className="card-body-modern">
                      <div className="info-item">
                        <div className="info-label">
                          <i className="fas fa-graduation-cap me-2"></i>
                          Tên buổi học
                        </div>
                        <div className="info-value">{selectedSession.title || selectedSession.name}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label">
                          <i className="fas fa-calendar-alt me-2"></i>
                          Ngày
                        </div>
                        <div className="info-value">{formatDateRange(selectedSession.date, selectedSession.end_date)}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label">
                          <i className="fas fa-clock me-2"></i>
                          Thời gian
                        </div>
                        <div className="info-value">{selectedSession.start_time} - {selectedSession.end_time}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label">
                          <i className="fas fa-map-marker-alt me-2"></i>
                          Địa điểm
                        </div>
                        <div className="info-value">{selectedSession.location}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label">
                          <i className="fas fa-users me-2"></i>
                          Lớp
                        </div>
                        <div className="info-value">{selectedSession.class_names || '-'}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label">
                          <i className="fas fa-layer-group me-2"></i>
                          Nhóm
                        </div>
                        <div className="info-value">{selectedSession.group_names || '-'}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label">
                          <i className="fas fa-user-graduate me-2"></i>
                          Số sinh viên
                        </div>
                        <div className="info-value">{selectedSession.student_count || selectedSession.studentCount || '-'}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label">
                          <i className="fas fa-info-circle me-2"></i>
                          Trạng thái
                        </div>
                        <div className="info-value">{getStatusBadge(selectedSession.calculatedStatus || selectedSession.status)}</div>
                      </div>
                    </div>
                  </div>
                </Col>
                <Col md={6}>
                  <div className="session-card">
                    <div className="card-header-modern">
                      <div className="header-icon">
                        <i className="fas fa-cog"></i>
                      </div>
                      <h6 className="mb-0">Tùy chọn giám sát</h6>
                    </div>
                    <div className="card-body-modern">
                      {selectedSession.monitoring_options?.location?.enabled && (
                        <div className="info-item">
                          <div className="info-label">
                            <i className="fas fa-map-marker-alt text-success me-2"></i>
                            Theo dõi vị trí
                          </div>
                          <div className="info-value">
                            {selectedSession.monitoring_options.location.geofence?.enabled ? (
                              <span className="text-muted">Giới hạn: {selectedSession.monitoring_options.location.geofence.radius}m</span>
                            ) : (
                              <span className="text-success">Đã bật</span>
                            )}
                          </div>
                        </div>
                      )}
                      {selectedSession.monitoring_options?.file_upload?.enabled && (
                        <div className="info-item">
                          <div className="info-label">
                            <i className="fas fa-file-upload text-success me-2"></i>
                            Tải lên tệp tin
                          </div>
                          <div className="info-value"><span className="text-success">Đã bật</span></div>
                        </div>
                      )}
                      {selectedSession.monitoring_options?.webcam?.enabled && (
                        <div className="info-item">
                          <div className="info-label">
                            <i className="fas fa-video text-success me-2"></i>
                            Theo dõi webcam
                          </div>
                          <div className="info-value"><span className="text-success">Đã bật</span></div>
                        </div>
                      )}
                      {selectedSession.monitoring_options?.audio?.enabled && (
                        <div className="info-item">
                          <div className="info-label">
                            <i className="fas fa-microphone text-success me-2"></i>
                            Theo dõi âm thanh
                          </div>
                          <div className="info-value"><span className="text-success">Đã bật</span></div>
                        </div>
                      )}
                      {!selectedSession.monitoring_options?.webcam?.enabled &&
                        !selectedSession.monitoring_options?.audio?.enabled &&
                        !selectedSession.monitoring_options?.location?.enabled &&
                        !selectedSession.monitoring_options?.file_upload?.enabled && (
                          <div className="text-muted text-center py-3">Không có tùy chọn giám sát</div>
                        )}
                    </div>
                  </div>

                  {selectedSession.description && (
                    <div className="session-card mt-3">
                      <div className="card-header-modern">
                        <div className="header-icon">
                          <i className="fas fa-align-left"></i>
                        </div>
                        <h6 className="mb-0">Mô tả</h6>
                      </div>
                      <div className="card-body-modern">
                        <div className="info-value">{selectedSession.description}</div>
                      </div>
                    </div>
                  )}
                </Col>
              </Row>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="student-detail-footer">
          <Button variant="outline-secondary" onClick={() => setShowSessionDetailModal(false)} className="btn-cancel">
            <i className="fas fa-times me-2"></i>
            Đóng
          </Button>
          <Button
            as={Link}
            to={`/admin/sessions/${selectedSession?.id}`}
            variant="primary"
            onClick={() => setShowSessionDetailModal(false)}
            className="btn-edit"
          >
            <i className="fas fa-eye me-2"></i>
            Xem chi tiết đầy đủ
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Batch Sessions Modal */}
      <Modal
        show={showBatchSessionsModal}
        onHide={() => {
          setShowBatchSessionsModal(false);
          clearBatchModalState();
        }}
        size="xl"
        className="student-detail-modal"
        centered
      >
        <Modal.Header closeButton className="student-detail-header">
          <Modal.Title className="student-detail-title">
            <div className="student-avatar">
              <i className="fas fa-layer-group"></i>
            </div>
            <div>
              <h4 className="mb-0">Chi tiết buổi học hàng loạt</h4>
              <p className="mb-0 student-subtitle">Quản lý và theo dõi các buổi học trong nhóm</p>
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="student-detail-body" style={{ padding: 0, overflow: 'hidden' }}>
          <div 
            ref={batchModalBodyRef} 
            style={{ 
              maxHeight: '70vh', 
              overflowY: 'auto', 
              padding: '24px'
            }}
          >
          {batchGroupInfo && (
            <div className="student-detail-container">
              {/* Header Info Card */}
              <div className="session-card mb-4">
                <div className="card-header-modern">
                  <div className="header-icon">
                    <i className="fas fa-graduation-cap"></i>
                  </div>
                  <h6 className="mb-0">Thông tin nhóm buổi học</h6>
                </div>
                <div className="card-body-modern">
                  <Row>
                    <Col md={4}>
                      <div className="info-item">
                        <div className="info-label">
                          <i className="fas fa-graduation-cap me-2"></i>
                          Tên buổi học
                        </div>
                        <div className="info-value">{batchGroupInfo.title}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label">
                          <i className="fas fa-calendar-alt me-2"></i>
                          Khoảng thời gian
                        </div>
                        <div className="info-value">{formatDateRange(batchGroupInfo.dateRange.start, batchGroupInfo.dateRange.end)}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label">
                          <i className="fas fa-hashtag me-2"></i>
                          ID từ
                        </div>
                        <div className="info-value">{batchGroupInfo.idRange.end} <i className="fas fa-arrow-right mx-2 text-muted"></i> {batchGroupInfo.idRange.start}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label">
                          <i className="fas fa-list-ol me-2"></i>
                          Tổng số buổi học
                        </div>
                        <div className="info-value">
                          <Badge bg="primary" className="fs-6">{batchGroupInfo.totalSessions}</Badge>
                        </div>
                      </div>
                    </Col>
                    <Col md={8}>
                      <div className="batch-stats">
                        <h6 className="stats-title mb-3">
                          <i className="fas fa-chart-pie me-2"></i>
                          Thống kê trạng thái
                        </h6>
                        <div className="stats-grid">
                          <div className="stat-item">
                            <div className="stat-icon active">
                              <i className="fas fa-play-circle"></i>
                            </div>
                            <div className="stat-info">
                              <div className="stat-number">{batchSessions.filter(s => s.calculatedStatus === 'active').length}</div>
                              <div className="stat-label">Đang diễn ra</div>
                            </div>
                          </div>
                          <div className="stat-item">
                            <div className="stat-icon scheduled">
                              <i className="fas fa-clock"></i>
                            </div>
                            <div className="stat-info">
                              <div className="stat-number">{batchSessions.filter(s => s.calculatedStatus === 'scheduled').length}</div>
                              <div className="stat-label">Sắp diễn ra</div>
                            </div>
                          </div>
                          <div className="stat-item">
                            <div className="stat-icon ended">
                              <i className="fas fa-check-circle"></i>
                            </div>
                            <div className="stat-info">
                              <div className="stat-number">{batchSessions.filter(s => s.calculatedStatus === 'ended').length}</div>
                              <div className="stat-label">Đã kết thúc</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Col>
                  </Row>
                </div>
              </div>

              {/* Sessions List */}
              <div className="session-card mt-4">
                <div className="card-header-modern">
                  <div className="header-icon">
                    <i className="fas fa-list"></i>
                  </div>
                  <h6 className="mb-0">Danh sách buổi học chi tiết</h6>
                  <div className="ms-auto d-flex gap-2">
                    <button
                      className="btn-modern"
                      style={{ backgroundColor: '#0d6efd' }}
                      onClick={handleBatchEditClick}
                      title="Chỉnh sửa tất cả buổi học trong nhóm"
                    >
                      <i className="fas fa-edit me-1"></i>
                      Chỉnh sửa tất cả
                    </button>
                    <button
                      className="btn-modern"
                      style={{ backgroundColor: '#dc3545' }}
                      onClick={handleBatchDeleteClick}
                      title="Xóa tất cả buổi học trong nhóm"
                    >
                      <i className="fas fa-trash-alt me-1"></i>
                      Xóa tất cả
                    </button>
                  </div>
                </div>
                <div className="card-body-modern">
                  <div className="sessions-table-container">
                    <div className="table-responsive">
                      <table className="table table-hover batch-sessions-table">
                      <thead className="table-header">
                        <tr>
                          <th className="session-id-col">
                            <i className="fas fa-hashtag me-1"></i>
                            ID
                          </th>
                          <th className="session-date-col">
                            <i className="fas fa-calendar me-1"></i>
                            Ngày
                          </th>
                          <th className="session-time-col">
                            <i className="fas fa-clock me-1"></i>
                            Thời gian
                          </th>
                          <th className="session-status-col">
                            <i className="fas fa-info-circle me-1"></i>
                            Trạng thái
                          </th>
                          <th className="session-students-col">
                            <i className="fas fa-users me-1"></i>
                            Sinh viên
                          </th>
                          <th className="session-actions-col">
                            <i className="fas fa-cogs me-1"></i>
                            Hành động
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {batchSessions.map((session, index) => (
                          <tr key={session.id} className={`session-row ${session.calculatedStatus === 'active' ? 'active-row' : ''}`}>
                            <td className="session-id-cell">
                              <div className="session-id-wrapper">
                                <span className="session-id">{session.id}</span>
                                <span className="session-order">#{index + 1}</span>
                              </div>
                            </td>
                            <td className="session-date-cell">
                              <div className="date-info">
                                <div className="date-main">{formatDateRange(session.date, session.end_date)}</div>
                                <div className="date-day">{new Date(session.date).toLocaleDateString('vi-VN', { weekday: 'long' })}</div>
                              </div>
                            </td>
                            <td className="session-time-cell">
                              <div className="time-info">
                                <div className="time-main">{session.start_time} - {session.end_time}</div>
                                <div className="time-duration">
                                  {(() => {
                                    const start = new Date(`2000-01-01 ${session.start_time}`);
                                    const end = new Date(`2000-01-01 ${session.end_time}`);
                                    const diff = end - start;
                                    const hours = Math.floor(diff / (1000 * 60 * 60));
                                    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                    return `${hours}h ${minutes}m`;
                                  })()}
                                </div>
                              </div>
                            </td>
                            <td className="session-status-cell">
                              <div className="status-wrapper">
                                <Badge
                                  bg={
                                    session.calculatedStatus === 'active' ? 'success' :
                                      session.calculatedStatus === 'scheduled' ? 'primary' :
                                        session.calculatedStatus === 'ended' ? 'secondary' :
                                          session.calculatedStatus === 'cancelled' ? 'danger' : 'info'
                                  }
                                  className="status-badge"
                                >
                                  {getStatusText(session.calculatedStatus || session.status)}
                                </Badge>
                              </div>
                            </td>
                            <td className="session-students-cell">
                              <div className="students-info">
                                <div className="students-count">
                                  <i className="fas fa-user-graduate me-1"></i>
                                  {session.student_count || session.studentCount || 0}
                                </div>
                                <div className="students-class">
                                  {session.class_names || '-'}
                                </div>
                              </div>
                            </td>
                            <td className="session-actions-cell">
                              <div className="action-buttons">
                                <Link
                                  to={`/admin/sessions/${session.id}`}
                                  className="btn btn-outline-primary btn-sm action-btn"
                                  title="Xem chi tiết buổi học"
                                  onClick={saveBatchModalState}
                                >
                                  <i className="fas fa-eye"></i>
                                </Link>

                                <Link
                                  to={`/admin/sessions/${session.id}/edit`}
                                  className="btn btn-outline-warning btn-sm action-btn"
                                  title="Chỉnh sửa buổi học"
                                  onClick={saveBatchModalState}
                                >
                                  <i className="fas fa-edit"></i>
                                </Link>

                                {session.calculatedStatus !== 'cancelled' && session.calculatedStatus !== 'ended' && (
                                  <Link
                                    to={`/admin/sessions/${session.id}/qr-code`}
                                    className="btn btn-outline-success btn-sm action-btn"
                                    title="Xem mã QR Code"
                                    onClick={saveBatchModalState}
                                  >
                                    <i className="fas fa-qrcode"></i>
                                  </Link>
                                )}

                                <button
                                  className="btn btn-outline-danger btn-sm action-btn"
                                  onClick={() => {
                                    setShowBatchSessionsModal(false);
                                    handleDeleteClick(session);
                                  }}
                                  title="Xóa buổi học"
                                >
                                  <i className="fas fa-trash"></i>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          </div>
        </Modal.Body>
        <Modal.Footer className="student-detail-footer">
          <Button variant="outline-secondary" onClick={() => {
            setShowBatchSessionsModal(false);
            clearBatchModalState();
          }} className="btn-cancel">
            <i className="fas fa-times me-2"></i>
            Đóng
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Batch Edit Modal */}
      <Modal show={showBatchEditModal} onHide={() => setShowBatchEditModal(false)} size="xl" className="student-detail-modal">
        <Modal.Header closeButton className="student-detail-header">
          <Modal.Title className="student-detail-title">
            <div className="student-avatar">
              <i className="fas fa-edit"></i>
            </div>
            <div>
              <h4 className="mb-0">Chỉnh sửa tất cả buổi học hàng loạt</h4>
              <p className="mb-0 student-subtitle">Cập nhật thông tin cho {batchSessions.length} buổi học</p>
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="student-detail-body">
          <div className="student-detail-container">
          {batchGroupInfo && (
            <>
              <Alert variant="info" className="mb-4">
                <div className="d-flex align-items-center">
                  <i className="fas fa-info-circle me-3"></i>
                  <div>
                    <strong>Thông tin:</strong> Bạn đang chỉnh sửa <strong>{batchSessions.length}</strong> buổi học cùng lúc.
                  </div>
                </div>
              </Alert>

              <Tabs defaultActiveKey="basic" id="batch-edit-tabs" className="custom-tabs mb-3">
                <Tab eventKey="basic" title={<span className="tab-title"><i className="fas fa-info-circle"></i> Thông tin cơ bản</span>}>
                  <Card className="shadow-sm">
                    <Card.Body className="card-body-modern">
                      <Row>
                        <Col md={6}>
                          <Form.Group className="mb-3">
                            <Form.Label>
                              <i className="fas fa-graduation-cap me-1"></i>
                              Tên buổi học *
                            </Form.Label>
                            <InputGroup>
                              <InputGroup.Text><i className="fas fa-chalkboard-teacher"></i></InputGroup.Text>
                              <Form.Control
                                type="text"
                                placeholder="Nhập tên buổi học"
                                value={batchEditData.title}
                                onChange={(e) => setBatchEditData({ ...batchEditData, title: e.target.value })}
                                isInvalid={!!batchEditError && !batchEditData.title.trim()}
                                required
                              />
                            </InputGroup>
                            <Form.Control.Feedback type="invalid">
                              Vui lòng nhập tên buổi học.
                            </Form.Control.Feedback>
                          </Form.Group>

                          <Form.Group className="mb-3">
                            <Form.Label>
                              <i className="fas fa-map-marker-alt me-1"></i>
                              Địa điểm
                            </Form.Label>
                            <InputGroup>
                              <InputGroup.Text><i className="fas fa-map-marker-alt"></i></InputGroup.Text>
                              <Form.Select
                                value={predefinedLocations.some(loc => loc.name === batchEditData.location) ? batchEditData.location : "custom"}
                                onChange={(e) => {
                                  const selectedValue = e.target.value;

                                  if (selectedValue === "custom") {
                                    setBatchEditData({
                                      ...batchEditData,
                                      location: ""
                                    });
                                    setSelectedBatchLocationIndex(0);
                                  } else {
                                    // Tìm location trong predefinedLocations
                                    const selectedLocation = predefinedLocations.find(loc => loc.name === selectedValue);
                                    const locationIndex = predefinedLocations.findIndex(loc => loc.name === selectedValue);
                                    
                                    if (selectedLocation && selectedLocation.latitude && selectedLocation.longitude) {
                                      // Cập nhật cả địa điểm và geofence coordinates
                                      setBatchEditData({
                                        ...batchEditData,
                                        location: selectedValue,
                                        monitoringOptions: {
                                          ...batchEditData.monitoringOptions,
                                          location: {
                                            ...batchEditData.monitoringOptions.location,
                                            geofence: {
                                              ...batchEditData.monitoringOptions.location.geofence,
                                              coordinates: {
                                                latitude: selectedLocation.latitude,
                                                longitude: selectedLocation.longitude
                                              }
                                            }
                                          }
                                        }
                                      });
                                      setSelectedBatchLocationIndex(locationIndex !== -1 ? locationIndex : 0);
                                    } else {
                                      setBatchEditData({
                                        ...batchEditData,
                                        location: selectedValue
                                      });
                                    }
                                  }
                                }}
                              >
                                <option value="">-- Chọn địa điểm --</option>
                                {predefinedLocations.slice(1).map((location, index) => (
                                  <option key={index} value={location.name}>{location.name}</option>
                                ))}
                                <option value="custom">Địa điểm khác</option>
                              </Form.Select>
                            </InputGroup>

                            {(!predefinedLocations.some(loc => loc.name === batchEditData.location) || batchEditData.location === "" || batchEditData.location === "custom") && (
                              <Form.Control
                                type="text"
                                placeholder="Nhập địa điểm tùy chỉnh"
                                value={batchEditData.location}
                                onChange={(e) => setBatchEditData({ ...batchEditData, location: e.target.value })}
                                className="mt-2"
                              />
                            )}
                          </Form.Group>

                          <Form.Group className="mb-3">
                            <Form.Label>
                              <i className="fas fa-align-left me-1"></i>
                              Mô tả
                            </Form.Label>
                            <Form.Control
                              as="textarea"
                              rows={3}
                              placeholder="Nhập mô tả buổi học (không bắt buộc)"
                              value={batchEditData.description}
                              onChange={(e) => setBatchEditData({ ...batchEditData, description: e.target.value })}
                            />
                          </Form.Group>
                        </Col>

                        <Col md={6}>
                          <Row>
                            <Col md={6}>
                              <Form.Group className="mb-3">
                                <Form.Label>
                                  <i className="fas fa-clock me-1"></i>
                                  Thời gian bắt đầu *
                                </Form.Label>
                                <InputGroup>
                                  <InputGroup.Text><i className="fas fa-clock"></i></InputGroup.Text>
                                  <Form.Control
                                    type="time"
                                    value={batchEditData.startTime}
                                    onChange={(e) => setBatchEditData({ ...batchEditData, startTime: e.target.value })}
                                    isInvalid={!!batchEditError && !batchEditData.startTime}
                                    required
                                  />
                                </InputGroup>
                                <Form.Control.Feedback type="invalid">
                                  Vui lòng chọn giờ bắt đầu.
                                </Form.Control.Feedback>
                              </Form.Group>
                            </Col>

                            <Col md={6}>
                              <Form.Group className="mb-3">
                                <Form.Label>
                                  <i className="fas fa-clock me-1"></i>
                                  Thời gian kết thúc *
                                </Form.Label>
                                <InputGroup>
                                  <InputGroup.Text><i className="fas fa-clock"></i></InputGroup.Text>
                                  <Form.Control
                                    type="time"
                                    value={batchEditData.endTime}
                                    onChange={(e) => setBatchEditData({ ...batchEditData, endTime: e.target.value })}
                                    isInvalid={!!batchEditError && !batchEditData.endTime}
                                    required
                                  />
                                </InputGroup>
                                <Form.Control.Feedback type="invalid">
                                  Vui lòng chọn giờ kết thúc.
                                </Form.Control.Feedback>
                              </Form.Group>
                            </Col>
                          </Row>

                          {/* Checkbox Trực đêm */}
                          <Row>
                            <Col md={12}>
                              {/* Debug log để kiểm tra giá trị nightShift khi render */}
                              {console.log('Debug - Rendering checkbox with nightShift:', batchEditData.nightShift)}
                              <Form.Group className="mb-3">
                                <Form.Check
                                  type="checkbox"
                                  id="nightShift"
                                  label={
                                    <span>
                                      <i className="fas fa-moon me-1"></i>
                                      Trực đêm (Buổi học kéo dài 2 ngày)
                                    </span>
                                  }
                                  checked={batchEditData.nightShift}
                                  onChange={(e) => setBatchEditData({
                                    ...batchEditData,
                                    nightShift: e.target.checked
                                  })}
                                />
                                <Form.Text className="text-muted">
                                  Nếu chọn trực đêm, buổi học sẽ kéo dài từ ngày bắt đầu đến ngày kế tiếp
                                </Form.Text>
                              </Form.Group>
                            </Col>
                          </Row>
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>
                </Tab>

                <Tab eventKey="students" title={<span className="tab-title"><i className="fas fa-users"></i> Sinh viên</span>}>
                  <Card className="shadow-sm">
                    <Card.Body className="card-body-modern">
                      <Row>
                        <Col md={6}>
                          <Form.Group className="mb-3">
                            <Form.Label>
                              <i className="fas fa-layer-group me-1"></i>
                              Chọn sinh viên theo
                            </Form.Label>
                            <Form.Select
                              value={batchEditData.studentSelection}
                              onChange={(e) => setBatchEditData({
                                ...batchEditData,
                                studentSelection: e.target.value,
                                selectedClass: e.target.value === 'class' ? batchEditData.selectedClass : '',
                                selectedGroup: e.target.value === 'group' ? batchEditData.selectedGroup : ''
                              })}
                            >
                              <option value="class">Lớp</option>
                              <option value="group">Nhóm</option>
                            </Form.Select>
                          </Form.Group>
                        </Col>

                        <Col md={6}>
                          {batchEditData.studentSelection === 'class' ? (
                            <Form.Group className="mb-3">
                              <Form.Label>
                                <i className="fas fa-graduation-cap me-1"></i>
                                Chọn lớp
                              </Form.Label>
                              <Form.Select
                                value={batchEditData.selectedClass}
                                onChange={(e) => setBatchEditData({
                                  ...batchEditData,
                                  selectedClass: e.target.value
                                })}
                              >
                                <option value="">-- Chọn lớp --</option>
                                {classes.map((className, index) => (
                                  <option key={index} value={className}>{className}</option>
                                ))}
                              </Form.Select>
                            </Form.Group>
                          ) : (
                            <Form.Group className="mb-3">
                              <Form.Label>
                                <i className="fas fa-layer-group me-1"></i>
                                Chọn nhóm sinh viên
                              </Form.Label>
                              <Form.Select
                                value={batchEditData.selectedGroup}
                                onChange={(e) => setBatchEditData({
                                  ...batchEditData,
                                  selectedGroup: e.target.value
                                })}
                              >
                                <option value="">-- Chọn nhóm sinh viên --</option>
                                {studentGroups.map((group) => (
                                  <option key={group.id} value={group.group_name}>
                                    {group.group_name} ({group.student_count || 0} sinh viên)
                                  </option>
                                ))}
                              </Form.Select>
                            </Form.Group>
                          )}
                        </Col>
                      </Row>

                      <Alert variant="info" className="mb-0">
                        <i className="fas fa-info-circle me-2"></i>
                        <small>
                          <strong>Thông tin:</strong> Bạn có thể cập nhật danh sách sinh viên hàng loạt bằng cách chọn lớp hoặc nhóm ở trên.
                          Hệ thống sẽ tự động cập nhật tất cả buổi học trong batch với danh sách sinh viên mới.
                        </small>
                      </Alert>

                      {/* Student List Display */}
                      {(batchEditData.selectedClass || batchEditData.selectedGroup) && (
                        <div className="mt-4">
                          <h6 className="mb-3">
                            <i className="fas fa-users me-2"></i>
                            Danh sách sinh viên
                            {batchEditData.studentSelection === 'class' ? ` lớp ${batchEditData.selectedClass}` : ` nhóm ${batchEditData.selectedGroup}`}
                            <Badge bg="primary" className="ms-2">{selectedStudents.length}</Badge>
                          </h6>

                          {loadingStudents ? (
                            <div className="text-center py-3">
                              <Spinner animation="border" size="sm" variant="primary" />
                              <span className="ms-2">Đang tải danh sách sinh viên...</span>
                            </div>
                          ) : selectedStudents.length > 0 ? (
                            <div className="table-responsive border rounded" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                              <Table striped hover size="sm" className="mb-0">
                                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', zIndex: 1 }}>
                                  <tr>
                                    <th>Mã SV</th>
                                    <th>Họ và tên</th>
                                    <th>Email</th>
                                    <th>Lớp</th>
                                    <th>Khoa</th>
                                    <th>Ngành</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {selectedStudents.map(student => (
                                    <tr key={student.id}>
                                      <td>{student.student_id || student.username}</td>
                                      <td>{student.full_name}</td>
                                      <td>{student.email}</td>
                                      <td>{student.class_name}</td>
                                      <td>{student.faculty_name}</td>
                                      <td>{student.major_name}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </Table>
                            </div>
                          ) : (
                            <div className="text-center py-3 text-muted">
                              <i className="fas fa-users me-2"></i>
                              Không có sinh viên nào
                            </div>
                          )}
                        </div>
                      )}
                    </Card.Body>
                  </Card>
                </Tab>

                <Tab eventKey="monitoring" title={<span className="tab-title"><i className="fas fa-video"></i> Tùy chọn giám sát</span>}>
                  <Card className="shadow-sm">
                    <Card.Body className="card-body-modern">
                      <Tabs defaultActiveKey="location" id="monitoring-tabs" className="custom-tabs mb-3">

                        <Tab eventKey="location" title={<span className="tab-title"><i className="fas fa-map-marker-alt"></i> Vị trí</span>}>
                          <Card className="border-0 shadow-sm">
                            <Card.Body className="card-body-modern">
                              <div className="d-flex justify-content-between align-items-center mb-3">
                                <h5 className="mb-0">Theo dõi vị trí</h5>
                                <Form.Check
                                  type="switch"
                                  id="batch_monitoring_location"
                                  checked={batchEditData.monitoringOptions.location.enabled}
                                  onChange={(e) => setBatchEditData({
                                    ...batchEditData,
                                    monitoringOptions: {
                                      ...batchEditData.monitoringOptions,
                                      location: {
                                        ...batchEditData.monitoringOptions.location,
                                        enabled: e.target.checked
                                      }
                                    }
                                  })}
                                  className="mb-0"
                                  label={batchEditData.monitoringOptions.location.enabled ? "Đã bật" : "Đã tắt"}
                                />
                              </div>

                              <div className={batchEditData.monitoringOptions.location.enabled ? '' : 'opacity-50'}>
                                <Row className="mb-3">
                                  <Col md={6}>
                                    <Form.Group>
                                      <Form.Label>Kiểm tra vị trí mỗi (giây)</Form.Label>
                                      <InputGroup>
                                        <InputGroup.Text><i className="fas fa-stopwatch"></i></InputGroup.Text>
                                        <Form.Control
                                          type="number"
                                          min="30"
                                          max="600"
                                          value={batchEditData.monitoringOptions.location.interval}
                                          onChange={(e) => setBatchEditData({
                                            ...batchEditData,
                                            monitoringOptions: {
                                              ...batchEditData.monitoringOptions,
                                              location: {
                                                ...batchEditData.monitoringOptions.location,
                                                interval: parseInt(e.target.value) || 120
                                              }
                                            }
                                          })}
                                          disabled={!batchEditData.monitoringOptions.location.enabled}
                                        />
                                      </InputGroup>
                                    </Form.Group>
                                  </Col>
                                  <Col md={6}>
                                    <Form.Group>
                                      <Form.Label>Độ chính xác</Form.Label>
                                      <InputGroup>
                                        <InputGroup.Text><i className="fas fa-bullseye"></i></InputGroup.Text>
                                        <Form.Select
                                          value={batchEditData.monitoringOptions.location.accuracy}
                                          onChange={(e) => setBatchEditData({
                                            ...batchEditData,
                                            monitoringOptions: {
                                              ...batchEditData.monitoringOptions,
                                              location: {
                                                ...batchEditData.monitoringOptions.location,
                                                accuracy: e.target.value
                                              }
                                            }
                                          })}
                                          disabled={!batchEditData.monitoringOptions.location.enabled}
                                        >
                                          <option value="high">Cao</option>
                                          <option value="medium">Trung bình</option>
                                          <option value="low">Thấp</option>
                                        </Form.Select>
                                      </InputGroup>
                                    </Form.Group>
                                  </Col>
                                </Row>

                                <div className="d-flex justify-content-between align-items-center mt-4 mb-3">
                                  <h6 className="mb-0">Giới hạn vị trí (Geofence)</h6>
                                  <Form.Check
                                    type="switch"
                                    id="batch_monitoring_location_geofence_enabled"
                                    checked={batchEditData.monitoringOptions.location.geofence?.enabled}
                                    onChange={(e) => setBatchEditData({
                                      ...batchEditData,
                                      monitoringOptions: {
                                        ...batchEditData.monitoringOptions,
                                        location: {
                                          ...batchEditData.monitoringOptions.location,
                                          geofence: {
                                            ...batchEditData.monitoringOptions.location.geofence,
                                            enabled: e.target.checked
                                          }
                                        }
                                      }
                                    })}
                                    disabled={!batchEditData.monitoringOptions.location.enabled}
                                    label={batchEditData.monitoringOptions.location.geofence?.enabled ? "Đã bật" : "Đã tắt"}
                                  />
                                </div>

                                {batchEditData.monitoringOptions.location.geofence?.enabled && (
                                  <div className="border rounded p-3 mt-3 mb-3 bg-light">
                                    <Row className="mb-3">
                                      <Col md={6}>
                                        <Form.Group className="mb-3">
                                          <Form.Label>Chọn vị trí có sẵn</Form.Label>
                                          <InputGroup>
                                            <InputGroup.Text><i className="fas fa-hospital"></i></InputGroup.Text>
                                            <Form.Select
                                              value={selectedBatchLocationIndex}
                                              onChange={(e) => {
                                                const index = parseInt(e.target.value);
                                                setSelectedBatchLocationIndex(index);
                                                const selectedLocation = predefinedLocations[index];
                                                if (selectedLocation) {
                                                  if (index > 0) {
                                                    setBatchEditData({
                                                      ...batchEditData,
                                                      location: selectedLocation.name,
                                                      monitoringOptions: {
                                                        ...batchEditData.monitoringOptions,
                                                        location: {
                                                          ...batchEditData.monitoringOptions.location,
                                                          geofence: {
                                                            ...batchEditData.monitoringOptions.location.geofence,
                                                            enabled: true,
                                                            coordinates: {
                                                              latitude: selectedLocation.latitude,
                                                              longitude: selectedLocation.longitude
                                                            }
                                                          }
                                                        }
                                                      }
                                                    });
                                                  } else {
                                                    setBatchEditData({
                                                      ...batchEditData,
                                                      monitoringOptions: {
                                                        ...batchEditData.monitoringOptions,
                                                        location: {
                                                          ...batchEditData.monitoringOptions.location,
                                                          geofence: {
                                                            ...batchEditData.monitoringOptions.location.geofence,
                                                            coordinates: {
                                                              latitude: selectedLocation.latitude,
                                                              longitude: selectedLocation.longitude
                                                            }
                                                          }
                                                        }
                                                      }
                                                    });
                                                  }
                                                }
                                              }}
                                              disabled={locationsLoading || predefinedLocations.length === 0}
                                            >
                                              {locationsLoading ? (
                                                <option>Đang tải địa điểm...</option>
                                              ) : predefinedLocations.length === 0 ? (
                                                <option>Không có địa điểm nào</option>
                                              ) : (
                                                predefinedLocations.map((location, index) => (
                                                  <option key={index} value={index}>{location.name}</option>
                                                ))
                                              )}
                                            </Form.Select>
                                          </InputGroup>
                                          <Form.Text className="text-muted">
                                            Chọn một địa điểm có sẵn hoặc nhập tọa độ thủ công bên dưới
                                          </Form.Text>
                                        </Form.Group>
                                      </Col>
                                      <Col md={6}>
                                        <Form.Group className="mb-3">
                                          <Form.Label>Bán kính (mét)</Form.Label>
                                          <InputGroup>
                                            <InputGroup.Text><i className="fas fa-circle-notch"></i></InputGroup.Text>
                                            <Form.Control
                                              type="number"
                                              min="10"
                                              max="1000"
                                              value={batchEditData.monitoringOptions.location.geofence.radius}
                                              onChange={(e) => setBatchEditData({
                                                ...batchEditData,
                                                monitoringOptions: {
                                                  ...batchEditData.monitoringOptions,
                                                  location: {
                                                    ...batchEditData.monitoringOptions.location,
                                                    geofence: {
                                                      ...batchEditData.monitoringOptions.location.geofence,
                                                      radius: parseInt(e.target.value) || 100
                                                    }
                                                  }
                                                }
                                              })}
                                            />
                                          </InputGroup>
                                          <Form.Text className="text-muted">
                                            Khoảng cách tối đa từ vị trí chỉ định (10-1000 mét)
                                          </Form.Text>
                                        </Form.Group>
                                      </Col>
                                    </Row>

                                    <Row>
                                      <Col md={6}>
                                        <Form.Group className="mb-3">
                                          <Form.Label>Vĩ độ (Latitude)</Form.Label>
                                          <InputGroup>
                                            <InputGroup.Text><i className="fas fa-map-pin"></i></InputGroup.Text>
                                            <Form.Control
                                              type="number"
                                              step="0.000001"
                                              value={batchEditData.monitoringOptions.location.geofence.coordinates?.latitude || ''}
                                              onChange={(e) => {
                                                const newLatitude = parseFloat(e.target.value) || null;
                                                setBatchEditData({
                                                  ...batchEditData,
                                                  monitoringOptions: {
                                                    ...batchEditData.monitoringOptions,
                                                    location: {
                                                      ...batchEditData.monitoringOptions.location,
                                                      geofence: {
                                                        ...batchEditData.monitoringOptions.location.geofence,
                                                        coordinates: {
                                                          ...batchEditData.monitoringOptions.location.geofence.coordinates,
                                                          latitude: newLatitude
                                                        }
                                                      }
                                                    }
                                                  }
                                                });
                                                if (selectedBatchLocationIndex !== 0) {
                                                  setSelectedBatchLocationIndex(0);
                                                }
                                              }}
                                              placeholder="Ví dụ: 10.762622"
                                            />
                                          </InputGroup>
                                        </Form.Group>
                                      </Col>
                                      <Col md={6}>
                                        <Form.Group className="mb-3">
                                          <Form.Label>Kinh độ (Longitude)</Form.Label>
                                          <InputGroup>
                                            <InputGroup.Text><i className="fas fa-map-pin"></i></InputGroup.Text>
                                            <Form.Control
                                              type="number"
                                              step="0.000001"
                                              value={batchEditData.monitoringOptions.location.geofence.coordinates?.longitude || ''}
                                              onChange={(e) => {
                                                const newLongitude = parseFloat(e.target.value) || null;
                                                setBatchEditData({
                                                  ...batchEditData,
                                                  monitoringOptions: {
                                                    ...batchEditData.monitoringOptions,
                                                    location: {
                                                      ...batchEditData.monitoringOptions.location,
                                                      geofence: {
                                                        ...batchEditData.monitoringOptions.location.geofence,
                                                        coordinates: {
                                                          ...batchEditData.monitoringOptions.location.geofence.coordinates,
                                                          longitude: newLongitude
                                                        }
                                                      }
                                                    }
                                                  }
                                                });
                                                if (selectedBatchLocationIndex !== 0) {
                                                  setSelectedBatchLocationIndex(0);
                                                }
                                              }}
                                              placeholder="Ví dụ: 106.660172"
                                            />
                                          </InputGroup>
                                        </Form.Group>
                                      </Col>
                                    </Row>

                                    {/* Map Preview */}
                                    <div className="mb-3 border rounded overflow-hidden" style={{ height: '400px' }}>
                                      <MapPreview
                                        latitude={batchEditData.monitoringOptions.location.geofence.coordinates?.latitude}
                                        longitude={batchEditData.monitoringOptions.location.geofence.coordinates?.longitude}
                                        radius={batchEditData.monitoringOptions.location.geofence.radius}
                                      />
                                    </div>
                                    <small className="text-muted d-block mb-3">
                                      <i className="fas fa-info-circle me-1"></i>
                                      Bản đồ sẽ hiển thị sau khi bạn nhập tọa độ hoặc chọn vị trí có sẵn.
                                    </small>

                                    <div className="d-flex align-items-center">
                                      <Form.Check
                                        type="switch"
                                        id="batch_monitoring_location_geofence_alertOnExit"
                                        label="Cảnh báo khi rời khỏi vùng"
                                        checked={batchEditData.monitoringOptions.location.geofence.alertOnExit}
                                        onChange={(e) => setBatchEditData({
                                          ...batchEditData,
                                          monitoringOptions: {
                                            ...batchEditData.monitoringOptions,
                                            location: {
                                              ...batchEditData.monitoringOptions.location,
                                              geofence: {
                                                ...batchEditData.monitoringOptions.location.geofence,
                                                alertOnExit: e.target.checked
                                              }
                                            }
                                          }
                                        })}
                                      />
                                    </div>

                                    {batchEditData.monitoringOptions.location.geofence.alertOnExit && (
                                      <Form.Group className="mt-3">
                                        <Form.Label>Email nhận thông báo</Form.Label>
                                        <InputGroup>
                                          <InputGroup.Text><i className="fas fa-envelope"></i></InputGroup.Text>
                                          <Form.Control
                                            type="email"
                                            value={batchEditData.monitoringOptions.location.geofence.alertEmail}
                                            onChange={(e) => setBatchEditData({
                                              ...batchEditData,
                                              monitoringOptions: {
                                                ...batchEditData.monitoringOptions,
                                                location: {
                                                  ...batchEditData.monitoringOptions.location,
                                                  geofence: {
                                                    ...batchEditData.monitoringOptions.location.geofence,
                                                    alertEmail: e.target.value
                                                  }
                                                }
                                              }
                                            })}
                                            placeholder="Nhập email để nhận thông báo"
                                          />
                                        </InputGroup>
                                        <Form.Text className="text-muted">
                                          Hệ thống sẽ gửi email thông báo khi sinh viên rời khỏi vị trí quy định
                                        </Form.Text>
                                      </Form.Group>
                                    )}
                                  </div>
                                )}

                                <hr />

                                <div className="d-flex align-items-center mb-3">
                                  <Form.Check
                                    type="checkbox"
                                    id="batch_monitoring_location_required"
                                    label="Bắt buộc"
                                    checked={batchEditData.monitoringOptions.location.required}
                                    onChange={(e) => setBatchEditData({
                                      ...batchEditData,
                                      monitoringOptions: {
                                        ...batchEditData.monitoringOptions,
                                        location: {
                                          ...batchEditData.monitoringOptions.location,
                                          required: e.target.checked
                                        }
                                      }
                                    })}
                                    disabled={!batchEditData.monitoringOptions.location.enabled}
                                    className="me-3"
                                  />

                                  {batchEditData.monitoringOptions.location.required && (
                                    <Form.Group style={{ minWidth: '250px' }}>
                                      <Form.Label className="mb-0">Thời điểm áp dụng:</Form.Label>
                                      <Form.Select
                                        size="sm"
                                        value={batchEditData.monitoringOptions.location.enforcement}
                                        onChange={(e) => setBatchEditData({
                                          ...batchEditData,
                                          monitoringOptions: {
                                            ...batchEditData.monitoringOptions,
                                            location: {
                                              ...batchEditData.monitoringOptions.location,
                                              enforcement: e.target.value
                                            }
                                          }
                                        })}
                                        disabled={!batchEditData.monitoringOptions.location.enabled || !batchEditData.monitoringOptions.location.required}
                                        className="ms-2"
                                      >
                                        <option value="immediate">Ngay lập tức (từ chối điểm danh)</option>
                                        <option value="delayed">Sau khi điểm danh (cho phép 5 phút)</option>
                                        <option value="end-of-session">Cuối buổi học</option>
                                      </Form.Select>
                                    </Form.Group>
                                  )}
                                </div>
                              </div>
                            </Card.Body>
                          </Card>
                        </Tab>

                        <Tab eventKey="files" title={<span className="tab-title"><i className="fas fa-file-upload"></i> Tệp tin</span>}>
                          <Card className="border-0 shadow-sm">
                            <Card.Body className="card-body-modern">
                              <div className="d-flex justify-content-between align-items-center mb-3">
                                <h5 className="mb-0">Cho phép tải lên tệp tin</h5>
                                <Form.Check
                                  type="switch"
                                  id="batch_monitoring_file"
                                  checked={batchEditData.monitoringOptions.file_upload.enabled}
                                  onChange={(e) => setBatchEditData({
                                    ...batchEditData,
                                    monitoringOptions: {
                                      ...batchEditData.monitoringOptions,
                                      file_upload: {
                                        ...batchEditData.monitoringOptions.file_upload,
                                        enabled: e.target.checked
                                      }
                                    }
                                  })}
                                  className="mb-0"
                                  label={batchEditData.monitoringOptions.file_upload.enabled ? "Đã bật" : "Đã tắt"}
                                />
                              </div>

                              <div className={batchEditData.monitoringOptions.file_upload.enabled ? '' : 'opacity-50'}>
                                <Row className="mb-3">
                                  <Col md={6}>
                                    <Form.Group>
                                      <Form.Label>Kích thước tối đa (MB)</Form.Label>
                                      <InputGroup>
                                        <InputGroup.Text><i className="fas fa-weight"></i></InputGroup.Text>
                                        <Form.Control
                                          type="number"
                                          min="1"
                                          max="100"
                                          value={batchEditData.monitoringOptions.file_upload.max_size}
                                          onChange={(e) => setBatchEditData({
                                            ...batchEditData,
                                            monitoringOptions: {
                                              ...batchEditData.monitoringOptions,
                                              file_upload: {
                                                ...batchEditData.monitoringOptions.file_upload,
                                                max_size: parseInt(e.target.value) || 50
                                              }
                                            }
                                          })}
                                          disabled={!batchEditData.monitoringOptions.file_upload.enabled}
                                        />
                                      </InputGroup>
                                    </Form.Group>
                                  </Col>

                                  <Col md={6}>
                                    <div className="d-flex align-items-center h-100">
                                      <Form.Check
                                        type="checkbox"
                                        id="batch_monitoring_file_upload_required"
                                        label="Bắt buộc tải lên tệp tin"
                                        checked={batchEditData.monitoringOptions.file_upload.required}
                                        onChange={(e) => setBatchEditData({
                                          ...batchEditData,
                                          monitoringOptions: {
                                            ...batchEditData.monitoringOptions,
                                            file_upload: {
                                              ...batchEditData.monitoringOptions.file_upload,
                                              required: e.target.checked
                                            }
                                          }
                                        })}
                                        disabled={!batchEditData.monitoringOptions.file_upload.enabled}
                                      />
                                    </div>
                                  </Col>
                                </Row>

                                {batchEditData.monitoringOptions.file_upload.required && (
                                  <Form.Group className="mb-4">
                                    <Form.Label>Số lượng tệp tin tối thiểu</Form.Label>
                                    <InputGroup>
                                      <InputGroup.Text><i className="fas fa-list-ol"></i></InputGroup.Text>
                                      <Form.Control
                                        type="number"
                                        min="1"
                                        max="10"
                                        value={batchEditData.monitoringOptions.file_upload.min_files || 1}
                                        onChange={(e) => setBatchEditData({
                                          ...batchEditData,
                                          monitoringOptions: {
                                            ...batchEditData.monitoringOptions,
                                            file_upload: {
                                              ...batchEditData.monitoringOptions.file_upload,
                                              min_files: parseInt(e.target.value) || 1
                                            }
                                          }
                                        })}
                                        disabled={!batchEditData.monitoringOptions.file_upload.enabled || !batchEditData.monitoringOptions.file_upload.required}
                                      />
                                    </InputGroup>
                                    <Form.Text className="text-muted">
                                      Sinh viên phải tải lên ít nhất số lượng tệp tin này để hoàn thành buổi học
                                    </Form.Text>
                                  </Form.Group>
                                )}

                                <Form.Group>
                                  <Form.Label>Loại tệp tin cho phép</Form.Label>
                                  <Card className="border p-3">
                                    <div className="d-flex flex-wrap gap-4">
                                      <Form.Check
                                        type="switch"
                                        id="file_type_images"
                                        label={<span><i className="fas fa-image me-2"></i>Hình ảnh (JPG, PNG, GIF...)</span>}
                                        checked={batchEditData.monitoringOptions.file_upload.allowed_types.includes("image/*")}
                                        onChange={(e) => {
                                          const types = [...batchEditData.monitoringOptions.file_upload.allowed_types];
                                          if (e.target.checked) {
                                            if (!types.includes("image/*")) types.push("image/*");
                                          } else {
                                            const index = types.indexOf("image/*");
                                            if (index > -1) types.splice(index, 1);
                                          }
                                          setBatchEditData({
                                            ...batchEditData,
                                            monitoringOptions: {
                                              ...batchEditData.monitoringOptions,
                                              file_upload: {
                                                ...batchEditData.monitoringOptions.file_upload,
                                                allowed_types: types
                                              }
                                            }
                                          });
                                        }}
                                        disabled={!batchEditData.monitoringOptions.file_upload.enabled}
                                      />

                                      <Form.Check
                                        type="switch"
                                        id="file_type_pdf"
                                        label={<span><i className="fas fa-file-pdf me-2"></i>PDF</span>}
                                        checked={batchEditData.monitoringOptions.file_upload.allowed_types.includes("application/pdf")}
                                        onChange={(e) => {
                                          const types = [...batchEditData.monitoringOptions.file_upload.allowed_types];
                                          if (e.target.checked) {
                                            if (!types.includes("application/pdf")) types.push("application/pdf");
                                          } else {
                                            const index = types.indexOf("application/pdf");
                                            if (index > -1) types.splice(index, 1);
                                          }
                                          setBatchEditData({
                                            ...batchEditData,
                                            monitoringOptions: {
                                              ...batchEditData.monitoringOptions,
                                              file_upload: {
                                                ...batchEditData.monitoringOptions.file_upload,
                                                allowed_types: types
                                              }
                                            }
                                          });
                                        }}
                                        disabled={!batchEditData.monitoringOptions.file_upload.enabled}
                                      />

                                      <Form.Check
                                        type="switch"
                                        id="file_type_word"
                                        label={<span><i className="fas fa-file-word me-2"></i>Word (DOC, DOCX)</span>}
                                        checked={batchEditData.monitoringOptions.file_upload.allowed_types.some(type =>
                                          type.includes("msword") || type.includes("wordprocessingml")
                                        )}
                                        onChange={(e) => {
                                          const types = [...batchEditData.monitoringOptions.file_upload.allowed_types];
                                          const wordTypes = ["application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];

                                          if (e.target.checked) {
                                            wordTypes.forEach(type => {
                                              if (!types.includes(type)) types.push(type);
                                            });
                                          } else {
                                            wordTypes.forEach(type => {
                                              const index = types.indexOf(type);
                                              if (index > -1) types.splice(index, 1);
                                            });
                                          }

                                          setBatchEditData({
                                            ...batchEditData,
                                            monitoringOptions: {
                                              ...batchEditData.monitoringOptions,
                                              file_upload: {
                                                ...batchEditData.monitoringOptions.file_upload,
                                                allowed_types: types
                                              }
                                            }
                                          });
                                        }}
                                        disabled={!batchEditData.monitoringOptions.file_upload.enabled}
                                      />
                                    </div>
                                  </Card>
                                </Form.Group>
                              </div>
                            </Card.Body>
                          </Card>
                        </Tab>

                        <Tab eventKey="attendance" title={<span className="tab-title"><i className="fas fa-calendar-check"></i> Điểm danh</span>}>
                          <Card className="border-0 shadow-sm">
                            <Card.Body className="card-body-modern">
                              <h5 className="mb-3">Tùy chọn điểm danh nhiều lần</h5>

                              <div className="mb-4">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                  <div>
                                    <h6 className="mb-0">Điểm danh trước buổi học</h6>
                                    <small className="text-muted">Điểm danh trước giờ bắt đầu</small>
                                  </div>
                                  <Form.Check
                                    type="switch"
                                    id="attendance_before_session"
                                    checked={batchEditData.monitoringOptions.attendance.before_session.enabled}
                                    onChange={(e) => setBatchEditData({
                                      ...batchEditData,
                                      monitoringOptions: {
                                        ...batchEditData.monitoringOptions,
                                        attendance: {
                                          ...batchEditData.monitoringOptions.attendance,
                                          before_session: {
                                            ...batchEditData.monitoringOptions.attendance.before_session,
                                            enabled: e.target.checked
                                          }
                                        }
                                      }
                                    })}
                                    label={batchEditData.monitoringOptions.attendance.before_session.enabled ? "Đã bật" : "Đã tắt"}
                                  />
                                </div>

                                {batchEditData.monitoringOptions.attendance.before_session.enabled && (
                                  <Card className="bg-light border mb-4">
                                    <Card.Body>
                                      <Row>
                                        <Col md={6}>
                                          <Form.Group className="mb-3">
                                            <Form.Label>Bắt đầu trước giờ học (phút)</Form.Label>
                                            <InputGroup>
                                              <InputGroup.Text><i className="fas fa-hourglass-start"></i></InputGroup.Text>
                                              <Form.Control
                                                type="number"
                                                min="5"
                                                max="120"
                                                value={batchEditData.monitoringOptions.attendance.before_session.minutes_before}
                                                onChange={(e) => setBatchEditData({
                                                  ...batchEditData,
                                                  monitoringOptions: {
                                                    ...batchEditData.monitoringOptions,
                                                    attendance: {
                                                      ...batchEditData.monitoringOptions.attendance,
                                                      before_session: {
                                                        ...batchEditData.monitoringOptions.attendance.before_session,
                                                        minutes_before: parseInt(e.target.value) || 30
                                                      }
                                                    }
                                                  }
                                                })}
                                              />
                                            </InputGroup>
                                            <Form.Text className="text-muted">
                                              Mặc định: 30 phút trước giờ bắt đầu
                                            </Form.Text>
                                          </Form.Group>
                                        </Col>
                                        <Col md={6}>
                                          <Form.Group className="mb-3">
                                            <Form.Label>Thời gian cho phép điểm danh (phút)</Form.Label>
                                            <InputGroup>
                                              <InputGroup.Text><i className="fas fa-clock"></i></InputGroup.Text>
                                              <Form.Control
                                                type="number"
                                                min="5"
                                                max="120"
                                                value={batchEditData.monitoringOptions.attendance.before_session.duration}
                                                onChange={(e) => setBatchEditData({
                                                  ...batchEditData,
                                                  monitoringOptions: {
                                                    ...batchEditData.monitoringOptions,
                                                    attendance: {
                                                      ...batchEditData.monitoringOptions.attendance,
                                                      before_session: {
                                                        ...batchEditData.monitoringOptions.attendance.before_session,
                                                        duration: parseInt(e.target.value) || 30
                                                      }
                                                    }
                                                  }
                                                })}
                                              />
                                            </InputGroup>
                                            <Form.Text className="text-muted">
                                              Mặc định: 30 phút
                                            </Form.Text>
                                          </Form.Group>
                                        </Col>
                                      </Row>
                                      <Row>
                                        <Col md={6}>
                                          <Form.Group className="mb-3">
                                            <Form.Label>Cho phép đi trễ tối đa (phút)</Form.Label>
                                            <InputGroup>
                                              <InputGroup.Text><i className="fas fa-exclamation-triangle"></i></InputGroup.Text>
                                              <Form.Control
                                                type="number"
                                                min="0"
                                                max="60"
                                                value={batchEditData.monitoringOptions.attendance.before_session.max_late_minutes}
                                                onChange={(e) => setBatchEditData({
                                                  ...batchEditData,
                                                  monitoringOptions: {
                                                    ...batchEditData.monitoringOptions,
                                                    attendance: {
                                                      ...batchEditData.monitoringOptions.attendance,
                                                      before_session: {
                                                        ...batchEditData.monitoringOptions.attendance.before_session,
                                                        max_late_minutes: parseInt(e.target.value) || 30
                                                      }
                                                    }
                                                  }
                                                })}
                                              />
                                            </InputGroup>
                                            <Form.Text className="text-muted">
                                              Mặc định: 30 phút (sinh viên có thể điểm danh đi trễ tối đa 30 phút)
                                            </Form.Text>
                                          </Form.Group>
                                        </Col>
                                      </Row>
                                      <Alert variant="info" className="mb-0">
                                        <i className="fas fa-info-circle me-2"></i>
                                        <small>Ví dụ: Nếu giờ bắt đầu buổi học là 16:00, cấu hình trên sẽ cho phép điểm danh từ 15:30 - 16:00</small>
                                      </Alert>
                                    </Card.Body>
                                  </Card>
                                )}
                              </div>

                              <div className="mb-4">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                  <div>
                                    <h6 className="mb-0">Điểm danh trong buổi học</h6>
                                    <small className="text-muted">Điểm danh giữa giờ bắt đầu và giờ kết thúc</small>
                                  </div>
                                  <Form.Check
                                    type="switch"
                                    id="attendance_during_session"
                                    checked={batchEditData.monitoringOptions.attendance.during_session.enabled}
                                    onChange={(e) => setBatchEditData({
                                      ...batchEditData,
                                      monitoringOptions: {
                                        ...batchEditData.monitoringOptions,
                                        attendance: {
                                          ...batchEditData.monitoringOptions.attendance,
                                          during_session: {
                                            ...batchEditData.monitoringOptions.attendance.during_session,
                                            enabled: e.target.checked
                                          }
                                        }
                                      }
                                    })}
                                    label={batchEditData.monitoringOptions.attendance.during_session.enabled ? "Đã bật" : "Đã tắt"}
                                  />
                                </div>

                                {batchEditData.monitoringOptions.attendance.during_session.enabled && (
                                  <Card className="bg-light border mb-4">
                                    <Card.Body>
                                      <Row>
                                        <Col md={6}>
                                          <Form.Group className="mb-3">
                                            <Form.Label>Bắt đầu sau giờ bắt đầu (phút)</Form.Label>
                                            <InputGroup>
                                              <InputGroup.Text><i className="fas fa-hourglass-half"></i></InputGroup.Text>
                                              <Form.Control
                                                type="number"
                                                min="0"
                                                max="300"
                                                value={batchEditData.monitoringOptions.attendance.during_session.minutes_after_start}
                                                onChange={(e) => setBatchEditData({
                                                  ...batchEditData,
                                                  monitoringOptions: {
                                                    ...batchEditData.monitoringOptions,
                                                    attendance: {
                                                      ...batchEditData.monitoringOptions.attendance,
                                                      during_session: {
                                                        ...batchEditData.monitoringOptions.attendance.during_session,
                                                        minutes_after_start: parseInt(e.target.value) || 120
                                                      }
                                                    }
                                                  }
                                                })}
                                              />
                                            </InputGroup>
                                            <Form.Text className="text-muted">
                                              Mặc định: 120 phút sau giờ bắt đầu
                                            </Form.Text>
                                          </Form.Group>
                                        </Col>
                                        <Col md={6}>
                                          <Form.Group className="mb-3">
                                            <Form.Label>Kết thúc trước giờ kết thúc (phút)</Form.Label>
                                            <InputGroup>
                                              <InputGroup.Text><i className="fas fa-hourglass-end"></i></InputGroup.Text>
                                              <Form.Control
                                                type="number"
                                                min="0"
                                                max="300"
                                                value={batchEditData.monitoringOptions.attendance.during_session.minutes_before_end}
                                                onChange={(e) => setBatchEditData({
                                                  ...batchEditData,
                                                  monitoringOptions: {
                                                    ...batchEditData.monitoringOptions,
                                                    attendance: {
                                                      ...batchEditData.monitoringOptions.attendance,
                                                      during_session: {
                                                        ...batchEditData.monitoringOptions.attendance.during_session,
                                                        minutes_before_end: parseInt(e.target.value) || 120
                                                      }
                                                    }
                                                  }
                                                })}
                                              />
                                            </InputGroup>
                                            <Form.Text className="text-muted">
                                              Mặc định: 120 phút trước giờ kết thúc
                                            </Form.Text>
                                          </Form.Group>
                                        </Col>

                                        <Alert variant="info" className="mb-0">
                                          <i className="fas fa-info-circle me-2"></i>
                                          <small>Ví dụ: Nếu giờ bắt đầu buổi học là 07:00 và giờ kết thúc là 17:00, cấu hình trên sẽ cho phép điểm danh từ 09:00 - 15:00</small>
                                        </Alert>
                                      </Row>
                                      {/* Quản lý sinh viên ra ca trực */}
                                      <div className="mt-4">
                                        <div className="d-flex justify-content-between align-items-center mb-3">
                                          <div>
                                            <h6 className="mb-0">Sinh viên ra ca trực</h6>
                                            <small className="text-muted">Những sinh viên này sẽ được miễn điểm danh sau buổi học</small>
                                          </div>
                                          <Button
                                            variant="outline-primary"
                                            size="sm"
                                            onClick={() => {
                                              setShowStudentSelectionModal(true);
                                            }}
                                          >
                                            <i className="fas fa-plus me-1"></i>
                                            Thêm sinh viên
                                          </Button>
                                        </div>

                                        {batchEditData.monitoringOptions.attendance.during_session.duty_students && batchEditData.monitoringOptions.attendance.during_session.duty_students.length > 0 && (
                                          <div className="duty-students-list">
                                            {/* Header với nút chọn tất cả */}
                                            <div className="d-flex gap-2 mb-3">
                                              <Button
                                                variant="outline-success"
                                                size="sm"
                                                onClick={() => {
                                                  // Chọn tất cả ngày cho tất cả sinh viên
                                                  batchEditData.monitoringOptions.attendance.during_session.duty_students.forEach(student => {
                                                    batchSessions.forEach(session => {
                                                      handleDutyStudentDateChange(student.id, session.date, true);
                                                    });
                                                  });
                                                }}
                                                title="Chọn tất cả ngày cho tất cả sinh viên"
                                              >
                                                <i className="fas fa-check-double me-1"></i>
                                                Tất cả
                                              </Button>
                                              <Button
                                                variant="outline-danger"
                                                size="sm"
                                                onClick={() => {
                                                  // Bỏ chọn tất cả ngày cho tất cả sinh viên
                                                  batchEditData.monitoringOptions.attendance.during_session.duty_students.forEach(student => {
                                                    batchSessions.forEach(session => {
                                                      handleDutyStudentDateChange(student.id, session.date, false);
                                                    });
                                                  });
                                                }}
                                                title="Bỏ chọn tất cả ngày cho tất cả sinh viên"
                                              >
                                                <i className="fas fa-times-circle me-1"></i>
                                                Bỏ chọn
                                              </Button>
                                            </div>

                                            {batchEditData.monitoringOptions.attendance.during_session.duty_students.map((student, index) => {
                                              const studentDates = getDutyStudentDates(student.id);
                                              console.log('Debug - Student', student.id, 'dates:', studentDates);
                                              return (
                                                <div key={`duty-${student.id}-${index}`} className="duty-student-item p-3 mb-3 bg-white border rounded">
                                                  <div className="d-flex justify-content-between align-items-start mb-2">
                                                    <div className="d-flex align-items-center flex-grow-1">
                                                      <div>
                                                        <div className="fw-medium">{student.full_name || 'N/A'}</div>
                                                        <small className="text-muted">{student.username || 'N/A'}</small>
                                                      </div>
                                                    </div>
                                                    <Button
                                                      variant="outline-danger"
                                                      size="sm"
                                                      onClick={() => {
                                                        const updatedDutyStudents = batchEditData.monitoringOptions.attendance.during_session.duty_students.filter((_, i) => i !== index);
                                                        setBatchEditData({
                                                          ...batchEditData,
                                                          monitoringOptions: {
                                                            ...batchEditData.monitoringOptions,
                                                            attendance: {
                                                              ...batchEditData.monitoringOptions.attendance,
                                                              during_session: {
                                                                ...batchEditData.monitoringOptions.attendance.during_session,
                                                                duty_students: updatedDutyStudents
                                                              }
                                                            }
                                                          }
                                                        });
                                                      }}
                                                    >
                                                      <i className="fas fa-times"></i>
                                                    </Button>
                                                  </div>

                                                  {/* Chọn ngày ra ca trực */}
                                                  <div className="mt-3">
                                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                                      <h6 className="mb-0">Chọn ngày ra ca trực</h6>
                                                      <div className="d-flex gap-2">
                                                        <Button
                                                          variant="outline-success"
                                                          size="sm"
                                                          onClick={() => {
                                                            batchSessions.forEach(session => {
                                                              handleDutyStudentDateChange(student.id, session.date, true);
                                                            });
                                                          }}
                                                        >
                                                          <i className="fas fa-check-circle me-1"></i>
                                                          Tất cả
                                                        </Button>
                                                        <Button
                                                          variant="outline-danger"
                                                          size="sm"
                                                          onClick={() => {
                                                            batchSessions.forEach(session => {
                                                              handleDutyStudentDateChange(student.id, session.date, false);
                                                            });
                                                          }}
                                                        >
                                                          <i className="fas fa-times-circle me-1"></i>
                                                          Bỏ chọn
                                                        </Button>
                                                      </div>
                                                    </div>

                                                    <div className="d-flex flex-wrap" style={{ gap: '4px' }}>
                                                      {console.log('Debug - Rendering dates for student', student.id, 'batchSessions:', batchSessions.map(s => ({ id: s.id, date: s.date })))}
                                                      {batchSessions.map(session => {
                                                        const isSelected = studentDates.includes(session.date);
                                                        return (
                                                          <div
                                                            key={`date-${session.id}`}
                                                            className={`date-box p-2 border rounded text-center ${isSelected ? 'bg-success text-white' : 'bg-light'}`}
                                                            style={{
                                                              minWidth: '80px',
                                                              cursor: 'pointer',
                                                              transition: 'all 0.2s ease'
                                                            }}
                                                            onClick={() => handleDutyStudentDateChange(student.id, session.date, !isSelected)}
                                                            onMouseEnter={(e) => {
                                                              if (!isSelected) {
                                                                e.currentTarget.style.backgroundColor = '#e9ecef';
                                                              }
                                                            }}
                                                            onMouseLeave={(e) => {
                                                              if (!isSelected) {
                                                                e.currentTarget.style.backgroundColor = '#f8f9fa';
                                                              }
                                                            }}
                                                          >
                                                            <div className="fw-medium">{formatDate(session.date)}</div>
                                                            <div className="small">{new Date(session.date).toLocaleDateString('vi-VN', { weekday: 'short' })}</div>
                                                          </div>
                                                        );
                                                      })}
                                                    </div>
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}

                                        {(!batchEditData.monitoringOptions.attendance.during_session.duty_students || batchEditData.monitoringOptions.attendance.during_session.duty_students.length === 0) && (
                                          <div className="text-center py-3 text-muted">
                                            <i className="fas fa-user-clock fa-2x mb-2"></i>
                                            <p className="mb-0">Chưa có sinh viên nào được chọn ra ca trực</p>
                                            <small>Nhấn "Thêm sinh viên" để chọn những sinh viên sẽ ra ca trực</small>
                                          </div>
                                        )}
                                      </div>
                                    </Card.Body>
                                  </Card>
                                )}
                              </div>

                              <div>
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                  <div>
                                    <h6 className="mb-0">Điểm danh sau buổi học</h6>
                                    <small className="text-muted">Điểm danh sau giờ kết thúc</small>
                                  </div>
                                  <Form.Check
                                    type="switch"
                                    id="attendance_after_session"
                                    checked={batchEditData.monitoringOptions.attendance.after_session.enabled}
                                    onChange={(e) => setBatchEditData({
                                      ...batchEditData,
                                      monitoringOptions: {
                                        ...batchEditData.monitoringOptions,
                                        attendance: {
                                          ...batchEditData.monitoringOptions.attendance,
                                          after_session: {
                                            ...batchEditData.monitoringOptions.attendance.after_session,
                                            enabled: e.target.checked
                                          }
                                        }
                                      }
                                    })}
                                    label={batchEditData.monitoringOptions.attendance.after_session.enabled ? "Đã bật" : "Đã tắt"}
                                  />
                                </div>

                                {batchEditData.monitoringOptions.attendance.after_session.enabled && (
                                  <Card className="bg-light border">
                                    <Card.Body>
                                      <Row>
                                        <Col md={6}>
                                          <Form.Group className="mb-3">
                                            <Form.Label>Bắt đầu sau giờ kết thúc (phút)</Form.Label>
                                            <InputGroup>
                                              <InputGroup.Text><i className="fas fa-hourglass-end"></i></InputGroup.Text>
                                              <Form.Control
                                                type="number"
                                                min="0"
                                                max="120"
                                                value={batchEditData.monitoringOptions.attendance.after_session.minutes_after}
                                                onChange={(e) => setBatchEditData({
                                                  ...batchEditData,
                                                  monitoringOptions: {
                                                    ...batchEditData.monitoringOptions,
                                                    attendance: {
                                                      ...batchEditData.monitoringOptions.attendance,
                                                      after_session: {
                                                        ...batchEditData.monitoringOptions.attendance.after_session,
                                                        minutes_after: parseInt(e.target.value) || 0
                                                      }
                                                    }
                                                  }
                                                })}
                                              />
                                            </InputGroup>
                                            <Form.Text className="text-muted">
                                              Mặc định: 0 phút (ngay sau giờ kết thúc)
                                            </Form.Text>
                                          </Form.Group>
                                        </Col>
                                        <Col md={6}>
                                          <Form.Group className="mb-3">
                                            <Form.Label>Thời gian cho phép điểm danh (phút)</Form.Label>
                                            <InputGroup>
                                              <InputGroup.Text><i className="fas fa-clock"></i></InputGroup.Text>
                                              <Form.Control
                                                type="number"
                                                min="5"
                                                max="120"
                                                value={batchEditData.monitoringOptions.attendance.after_session.duration}
                                                onChange={(e) => setBatchEditData({
                                                  ...batchEditData,
                                                  monitoringOptions: {
                                                    ...batchEditData.monitoringOptions,
                                                    attendance: {
                                                      ...batchEditData.monitoringOptions.attendance,
                                                      after_session: {
                                                        ...batchEditData.monitoringOptions.attendance.after_session,
                                                        duration: parseInt(e.target.value) || 30
                                                      }
                                                    }
                                                  }
                                                })}
                                              />
                                            </InputGroup>
                                            <Form.Text className="text-muted">
                                              Mặc định: 60 phút
                                            </Form.Text>
                                          </Form.Group>
                                        </Col>
                                      </Row>
                                      <Alert variant="info" className="mb-0">
                                        <i className="fas fa-info-circle me-2"></i>
                                        <small>Ví dụ: Nếu giờ kết thúc buổi học là 19:00, cấu hình trên sẽ cho phép điểm danh từ 19:00 - 20:00</small>
                                      </Alert>
                                    </Card.Body>
                                  </Card>
                                )}
                              </div>
                            </Card.Body>
                          </Card>
                        </Tab>
                      </Tabs>
                    </Card.Body>
                  </Card>
                </Tab>
              </Tabs>

              {batchEditError && (
                <Alert variant="danger" className="mb-0">
                  <i className="fas fa-exclamation-triangle me-2"></i>
                  {batchEditError}
                </Alert>
              )}
            </>
          )}
          </div>
        </Modal.Body>
        <Modal.Footer className="student-detail-footer">
          <Button variant="outline-secondary" onClick={() => setShowBatchEditModal(false)} className="btn-cancel">
            <i className="fas fa-times me-2"></i>
            Hủy
          </Button>
          <Button
            variant="primary"
            onClick={handleBatchEditConfirm}
            disabled={batchEditLoading}
            className="btn-edit"
          >
            {batchEditLoading ? (
              <>
                <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                Đang cập nhật...
              </>
            ) : (
              <>
                <i className="fas fa-save me-2"></i>
                Cập nhật tất cả ({batchSessions.length} buổi học)
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Batch Delete Confirmation Modal */}
      <Modal show={showBatchDeleteModal} onHide={() => setShowBatchDeleteModal(false)} size="lg" className="student-detail-modal">
        <Modal.Header closeButton className="student-detail-header">
          <Modal.Title className="student-detail-title">
            <div className="student-avatar">
              <i className="fas fa-exclamation-triangle"></i>
            </div>
            <div>
              <h4 className="mb-0">Xác nhận xóa tất cả buổi học hàng loạt</h4>
              <p className="mb-0 student-subtitle">Xóa {batchSessions.length} buổi học khỏi hệ thống</p>
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="student-detail-body">
          {batchGroupInfo && (
            <div className="student-detail-container">
              <Alert variant="danger" className="mb-4">
                <div className="d-flex align-items-center">
                  <i className="fas fa-exclamation-triangle me-3"></i>
                  <div>
                    <strong>Cảnh báo:</strong> Bạn sắp xóa <strong>{batchSessions.length}</strong> buổi học cùng lúc!
                  </div>
                </div>
              </Alert>

              <div className="session-card mb-4">
                <div className="card-header-modern">
                  <div className="header-icon">
                    <i className="fas fa-info-circle"></i>
                  </div>
                  <h6 className="mb-0">Thông tin nhóm sẽ bị xóa</h6>
                </div>
                <div className="card-body-modern">
                  <div className="info-item">
                    <div className="info-label">
                      <i className="fas fa-graduation-cap me-2"></i>
                      Tên buổi học
                    </div>
                    <div className="info-value">{batchGroupInfo.title}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">
                      <i className="fas fa-calendar-alt me-2"></i>
                      Khoảng thời gian
                    </div>
                    <div className="info-value">{formatDateRange(batchGroupInfo.dateRange.start, batchGroupInfo.dateRange.end)}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">
                      <i className="fas fa-list-ol me-2"></i>
                      Số buổi học
                    </div>
                    <div className="info-value">
                      <Badge bg="primary" className="fs-6">{batchGroupInfo.totalSessions}</Badge>
                    </div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">
                      <i className="fas fa-hashtag me-2"></i>
                      ID từ
                    </div>
                    <div className="info-value">{batchGroupInfo.idRange.start} <strong>đến</strong> {batchGroupInfo.idRange.end}</div>
                  </div>
                </div>
              </div>

              <Alert variant="warning" className="mb-4">
                <div className="d-flex align-items-center">
                  <i className="fas fa-exclamation-triangle me-3"></i>
                  <div>
                    <strong>Lưu ý:</strong> Hành động này không thể khôi phục. Tất cả dữ liệu liên quan đến các buổi học này sẽ bị xóa vĩnh viễn.
                  </div>
                </div>
              </Alert>

              <Form.Group className="mb-3">
                <Form.Label className="info-label">
                  <i className="fas fa-key me-2"></i>
                  Nhập tên buổi học để xác nhận
                </Form.Label>
                <Form.Control
                  type="text"
                  placeholder={`Nhập "${batchGroupInfo.title}" để xác nhận xóa`}
                  value={batchDeleteConfirm}
                  onChange={(e) => setBatchDeleteConfirm(e.target.value)}
                  isInvalid={!!batchDeleteError}
                  className="form-control-modern"
                />
                <Form.Control.Feedback type="invalid">
                  {batchDeleteError}
                </Form.Control.Feedback>
                <Form.Text className="text-muted">
                  Bạn phải nhập chính xác tên buổi học để có thể xóa.
                </Form.Text>
              </Form.Group>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="student-detail-footer">
          <Button variant="outline-secondary" onClick={() => setShowBatchDeleteModal(false)} className="btn-cancel">
            <i className="fas fa-times me-2"></i>
            Hủy
          </Button>
          <Button
            variant="danger"
            onClick={handleBatchDeleteConfirm}
            disabled={batchDeleteLoading || !batchDeleteConfirm}
            className="btn-delete"
          >
            {batchDeleteLoading ? (
              <>
                <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                Đang xóa...
              </>
            ) : (
              <>
                <i className="fas fa-trash me-2"></i>
                Xóa tất cả ({batchSessions.length} buổi học)
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} size="lg" className="student-detail-modal">
        <Modal.Header closeButton className="student-detail-header">
          <Modal.Title className="student-detail-title">
            <div className="student-avatar">
              <i className="fas fa-exclamation-triangle"></i>
            </div>
            <div>
              <h4 className="mb-0">Xác nhận xóa buổi học</h4>
              <p className="mb-0 student-subtitle">Xóa buổi học khỏi hệ thống</p>
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="student-detail-body">
          {sessionToDelete && (
            <div className="student-detail-container">
              <div className="session-card mb-4">
                <div className="card-header-modern">
                  <div className="header-icon">
                    <i className="fas fa-calendar-alt"></i>
                  </div>
                  <h6 className="mb-0">Thông tin buổi học sẽ bị xóa</h6>
                </div>
                <div className="card-body-modern">
                  <div className="info-item">
                    <div className="info-label">
                      <i className="fas fa-graduation-cap me-2"></i>
                      Tên buổi học
                    </div>
                    <div className="info-value">{sessionToDelete.title || sessionToDelete.name}</div>
                  </div>
                </div>
              </div>

              <Alert variant="danger" className="mb-4">
                <div className="d-flex align-items-center">
                  <i className="fas fa-exclamation-triangle me-3"></i>
                  <div>
                    <strong>Cảnh báo:</strong> Hành động này không thể hoàn tác. Tất cả dữ liệu liên quan đến buổi học này sẽ bị xóa vĩnh viễn.
                  </div>
                </div>
              </Alert>

              <Form.Group className="mb-3">
                <Form.Label className="info-label">
                  <i className="fas fa-key me-2"></i>
                  Nhập tên buổi học để xác nhận
                </Form.Label>
                <Form.Control
                  type="text"
                  placeholder={`Nhập "${sessionToDelete.title || sessionToDelete.name}" để xác nhận`}
                  value={sessionNameConfirm}
                  onChange={(e) => setSessionNameConfirm(e.target.value)}
                  isInvalid={!!deleteError}
                  className="form-control-modern"
                />
                <Form.Control.Feedback type="invalid">
                  {deleteError}
                </Form.Control.Feedback>
                <Form.Text className="text-muted">
                  Bạn phải nhập chính xác tên buổi học để có thể xóa.
                </Form.Text>
              </Form.Group>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="student-detail-footer">
          <Button variant="outline-secondary" onClick={() => setShowDeleteModal(false)} className="btn-cancel">
            <i className="fas fa-times me-2"></i>
            Hủy
          </Button>
          <Button
            variant="danger"
            onClick={handleDeleteConfirm}
            disabled={deleteLoading}
            className="btn-delete"
          >
            {deleteLoading ? (
              <>
                <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                Đang xử lý...
              </>
            ) : (
              <>
                <i className="fas fa-trash me-2"></i>
                Xác nhận xóa
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal chọn sinh viên ra ca trực */}
      <Modal show={showStudentSelectionModal} onHide={() => setShowStudentSelectionModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Chọn sinh viên ra ca trực</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-3">
            <Form.Control
              type="text"
              placeholder="Tìm kiếm sinh viên..."
              onChange={(e) => {
                // Logic tìm kiếm sinh viên
              }}
            />
          </div>
          <div className="student-selection-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {selectedStudents.filter(student =>
              !batchEditData.monitoringOptions.attendance.during_session.duty_students?.some(dutyStudent => dutyStudent.id === student.id)
            ).map(student => (
              <div key={student.id} className="student-item d-flex justify-content-between align-items-center p-2 mb-2 border rounded">
                <div className="d-flex align-items-center">
                  <div>
                    <div className="fw-medium">{student.full_name || 'N/A'}</div>
                    <small className="text-muted">{student.username || 'N/A'}</small>
                  </div>
                </div>
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={() => {
                    const currentDutyStudents = batchEditData.monitoringOptions.attendance.during_session.duty_students || [];
                    setBatchEditData({
                      ...batchEditData,
                      monitoringOptions: {
                        ...batchEditData.monitoringOptions,
                        attendance: {
                          ...batchEditData.monitoringOptions.attendance,
                          during_session: {
                            ...batchEditData.monitoringOptions.attendance.during_session,
                            duty_students: [...currentDutyStudents, student]
                          }
                        }
                      }
                    });
                  }}
                >
                  <i className="fas fa-plus"></i>
                </Button>
              </div>
            ))}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowStudentSelectionModal(false)}>
            Đóng
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default SessionList;