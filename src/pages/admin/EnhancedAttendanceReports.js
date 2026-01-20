
import React, { useState, useEffect, useRef, useMemo, startTransition, useTransition } from 'react';
import { Container, Row, Col, Card, Button, Table, Form, Spinner, Alert, InputGroup, Badge, Tabs, Tab, Dropdown, OverlayTrigger, Tooltip, Modal, ProgressBar } from 'react-bootstrap';
import { useLocation } from 'react-router-dom';
import AdminNavbar from '../../components/Navbar';
import api from '../../utils/api';
import { Bar, Line, Doughnut, PolarArea, Radar } from 'react-chartjs-2';
import * as XLSX from 'xlsx';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';
import '../../styles/custom-report-modern.css';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler,
} from 'chart.js';
import { CSVLink } from 'react-csv';
import JSZip from 'jszip';
import { useHospitalLocations, getHospitalLocationsForReports } from '../../hooks/useHospitalLocations';
import Pagination from '../../components/Pagination';

// Định dạng ngày tháng (giống SessionList.js)
const formatDate = (dateString) => {
  try {
    if (!dateString) return '';

    // Remove any time part if present (e.g., "2025-11-25T17:00:00.000Z" -> "2025-11-25")
    let dateOnly = String(dateString);
    if (dateOnly.includes('T')) {
      dateOnly = dateOnly.split('T')[0];
    }
    // Remove any trailing characters after date (e.g., "2025-11-25Z" -> "2025-11-25")
    if (dateOnly.includes('Z')) {
      dateOnly = dateOnly.split('Z')[0];
    }

    // The date should be in YYYY-MM-DD format
    // Parse it and convert to DD/MM/YYYY format
    const parts = dateOnly.split('-');
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

// Register required Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  RadialLinearScale,
  Title,
  ChartTooltip,
  Legend,
  Filler
);

// Function to convert dataURL to Blob for image download
const dataURLtoBlob = (dataURL) => {
  const parts = dataURL.split(';base64,');
  const contentType = parts[0].split(':')[1];
  const raw = window.atob(parts[1]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);
  
  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }
  
  return new Blob([uInt8Array], { type: contentType });
};

const EnhancedAttendanceReports = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialSessionId = queryParams.get('sessionId');

  // Use hospital locations from API
  const { hospitalLocations } = useHospitalLocations();
  const predefinedLocations = getHospitalLocationsForReports(hospitalLocations);

  // State variables
  const [groups, setGroups] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('Đang khởi tạo...');
  const [error, setError] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [activeTab, setActiveTab] = useState('statusDistribution');
  const [chartData, setChartData] = useState(null);
  
  // Filters
  const [selectedGroup, setSelectedGroup] = useState('');
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [nameFilter, setNameFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Stats
  const [stats, setStats] = useState({
    totalSessions: 0,
    totalAttendees: 0,
    averageAttendance: 0,
    maleCount: 0,
    femaleCount: 0,
    otherCount: 0,
    fullAttendance: 0,
    beforeAttendance: 0,
    duringAttendance: 0,
    afterAttendance: 0,
    presentAttendance: 0,
    earlyAttendance: 0,
    lateAttendance: 0,
    earlyLeave: 0,
    lateLeave: 0,
    absent: 0,
    absentWithPermission: 0,
    earlyPermission: 0,
    duringPermission: 0,
    latePermission: 0,
    totalAttendanceOccurrences: 0,
    // Absence request stats (approved)
    fullSessionApproved: 0,
    beforeSessionApproved: 0,
    duringSessionApproved: 0,
    afterSessionApproved: 0
  });
  
  const [absenceStatsByDate, setAbsenceStatsByDate] = useState([]);

  // Detailed members data
  const [detailedMembers, setDetailedMembers] = useState([]);
  const [memberAttendances, setMemberAttendances] = useState({});
  const [allSessions, setAllSessions] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);


  // Attendance status data
  const [attendanceByStatus, setAttendanceByStatus] = useState({});
  
  // Prevent multiple simultaneous fetches
  const fetchingRef = useRef(false);
  
  // Pagination states for each tab
  const [detailedListPage, setDetailedListPage] = useState(1);
  const [classReportPage, setClassReportPage] = useState(1);
  const [hospitalReportPage, setHospitalReportPage] = useState(1);
  const [dateReportPage, setDateReportPage] = useState(1);
  const [sessionReportPage, setSessionReportPage] = useState(1);
  const itemsPerPage = 10;

  // Custom Report states
  const [customReportData, setCustomReportData] = useState([]);
  const [customReportLoading, setCustomReportLoading] = useState(false);
  const [customReportPagination, setCustomReportPagination] = useState({
    page: 1,
    limit: 100, // Increased from 20 to 100 to show more data
    totalItems: 0,
    totalPages: 0
  });
  const [customReportFilters, setCustomReportFilters] = useState({
    startDate: '',
    endDate: '',
    groupId: '',
    className: '',
    studentName: '',
    attendanceType: '',
    location: '',
    facultyName: '',
    sortField: 'session_date',
    sortOrder: 'desc'
  });
  const [customReportDisplay, setCustomReportDisplay] = useState('table'); // table, bar, line, doughnut
  const [isFilterSectionOpen, setIsFilterSectionOpen] = useState(true); // Control collapse/expand for filter section
  const [customReportColumns, setCustomReportColumns] = useState([
    'student_name',
    'student_code',
    'class_name',
    'session_title',
    'session_date',
    'attendance_type',
    'timestamp',
    'session_location'
  ]);
  const [showColumnSelector, setShowColumnSelector] = useState(false);

  // Weekly Statistics states
  const [weeklyStatsData, setWeeklyStatsData] = useState([]);
  const [weeklyStatsLoading, setWeeklyStatsLoading] = useState(false);
  const [weeklyStatsGroupBy, setWeeklyStatsGroupBy] = useState('faculty'); // faculty, location, class, group, session_title
  const [weeklyStatsFilters, setWeeklyStatsFilters] = useState({
    startDate: '',
    endDate: '',
    facultyName: '',
    location: '',
    className: '',
    groupId: ''
  });
  const [weeklyStatsColumns, setWeeklyStatsColumns] = useState([
    'group_key',
    'sub_group',
    'week',
    'student_count',
    'classes',
    'session_count',
    'attendance_count'
  ]);
  const [weeklyStatsSortField, setWeeklyStatsSortField] = useState('');
  const [weeklyStatsSortOrder, setWeeklyStatsSortOrder] = useState('desc');
  const [showWeeklyStatsDetailModal, setShowWeeklyStatsDetailModal] = useState(false);
  const [weeklyStatsDetailData, setWeeklyStatsDetailData] = useState([]);
  const [weeklyStatsDetailLoading, setWeeklyStatsDetailLoading] = useState(false);
  const [selectedWeeklyStat, setSelectedWeeklyStat] = useState(null);
  
  // Filter options for weekly statistics dropdown
  const [weeklyStatsFilterOptions, setWeeklyStatsFilterOptions] = useState([]);
  const [weeklyStatsSelectedFilter, setWeeklyStatsSelectedFilter] = useState('');
  
  // Pagination for weekly statistics (client-side)
  const [weeklyStatsPage, setWeeklyStatsPage] = useState(1);
  const weeklyStatsItemsPerPage = 20;
  
  // Refs for scrolling to sections
  const customReportSectionRef = useRef(null);
  const weeklyStatsSectionRef = useRef(null);
  
  // Filter options for custom report
  const [availableClasses, setAvailableClasses] = useState([]);
  const [availableFaculties, setAvailableFaculties] = useState([]);
  const [studentSearchResults, setStudentSearchResults] = useState([]);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [showStudentSearchResults, setShowStudentSearchResults] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const studentSearchInputRef = useRef(null);
  const studentSearchDropdownRef = useRef(null);

  // Update page title with progress
  usePageTitle('Báo cáo điểm danh nâng cao', loading && loadingProgress > 0 ? loadingProgress : null);

  // Fetch data when component mounts
  useEffect(() => {
    // Use a flag to prevent double execution in React StrictMode
    let isMounted = true;
    
    const initializeData = async () => {
      if (!isMounted) return;
      
      try {
        // Step 1: Initialize (0-10%)
        setLoadingProgress(5);
        setLoadingMessage('Đang khởi tạo...');
        
        // Step 2: Fetch groups, classes, faculties (10-20%)
        setLoadingProgress(10);
        setLoadingMessage('Đang tải danh sách nhóm...');
        await fetchGroups();
        
        setLoadingProgress(15);
        setLoadingMessage('Đang tải danh sách lớp và khoa...');
        await Promise.all([
          fetchAvailableClasses(),
          fetchAvailableFaculties()
        ]);
        
        // Step 3: Fetch attendance data (20-100%)
        // This will handle loading screen and turn it off when ready
        setLoadingProgress(20);
        setLoadingMessage('Đang tải dữ liệu điểm danh...');
        await fetchAllAttendance();
        
        // fetchAllAttendance will turn off loading screen after fetching data
        // Data processing happens in background with startTransition
        
        // Step 4: Fetch additional data in background (after loading screen is gone)
        // This doesn't block the UI from showing
        if (isMounted) {
          setTimeout(() => {
            fetchAbsenceStatsByDate();
            fetchAllMembers(); // Run in background
          }, 500);
        }
      } catch (error) {
        console.error('Error initializing data:', error);
        setLoadingProgress(100);
        setLoading(false);
      }
    };
    
    initializeData();
    
    return () => {
      isMounted = false;
    };
  }, []);

  // Search students when search term changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (studentSearchTerm) {
        searchStudents(studentSearchTerm);
      } else {
        setStudentSearchResults([]);
        setShowStudentSearchResults(false);
      }
    }, 300); // Debounce 300ms

    return () => clearTimeout(timeoutId);
  }, [studentSearchTerm]);

  // Calculate dropdown position when it's shown
  useEffect(() => {
    if (showStudentSearchResults && studentSearchInputRef.current && studentSearchDropdownRef.current) {
      const inputRect = studentSearchInputRef.current.getBoundingClientRect();
      const dropdown = studentSearchDropdownRef.current;
      
      dropdown.style.left = inputRect.left + 'px';
      dropdown.style.top = (inputRect.bottom + 2) + 'px';
      dropdown.style.width = inputRect.width + 'px';
    }
  }, [showStudentSearchResults, studentSearchResults]);

  // Update dropdown position on scroll
  useEffect(() => {
    if (!showStudentSearchResults) return;

    const updatePosition = () => {
      if (studentSearchInputRef.current && studentSearchDropdownRef.current) {
        const inputRect = studentSearchInputRef.current.getBoundingClientRect();
        const dropdown = studentSearchDropdownRef.current;
        
        dropdown.style.left = inputRect.left + 'px';
        dropdown.style.top = (inputRect.bottom + 2) + 'px';
        dropdown.style.width = inputRect.width + 'px';
      }
    };

    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [showStudentSearchResults]);

  // Close student search dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showStudentSearchResults) {
        const isClickInsideContainer = event.target.closest('.student-search-container');
        const isClickInsideDropdown = studentSearchDropdownRef.current && 
                                      studentSearchDropdownRef.current.contains(event.target);
        
        if (!isClickInsideContainer && !isClickInsideDropdown) {
          setShowStudentSearchResults(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showStudentSearchResults]);

  // Update attendance data when main filters change
  useEffect(() => {
    // Now that the API endpoints exist, make the calls based on filters
    if (selectedGroup) {
      fetchAttendanceByGroup(selectedGroup);
    } else if (dateRange.startDate && dateRange.endDate && dateRange.startDate.trim() && dateRange.endDate.trim()) {
      fetchAttendanceByDateRange(dateRange.startDate, dateRange.endDate);
    } else {
      fetchAllAttendance();
    }
  }, [selectedGroup, dateRange.startDate, dateRange.endDate]);
  
  // Apply client-side filters when they change
  useEffect(() => {
    if (attendanceData && attendanceData.length > 0) {
      // Re-process the data with the new filters
      processAttendanceData(attendanceData);
    }
  }, [nameFilter, classFilter]);

  // Fetch custom report when tab is active or filters/pagination change
  useEffect(() => {
    console.log(`🔍 Custom Report Effect: activeTab=${activeTab}, loading=${loading}, display=${customReportDisplay}`);
    // Only fetch if not loading main data AND display mode is table
    if (activeTab === 'customReport' && customReportDisplay === 'table' && !loading) {
      console.log('✅ Triggering fetchCustomReport...');
      fetchCustomReport();
    } else {
      console.log(`❌ Skipping fetchCustomReport: activeTab=${activeTab}, display=${customReportDisplay}, loading=${loading}`);
    }
  }, [activeTab, customReportDisplay, customReportFilters, customReportPagination.page, loading]);

  // Fetch weekly statistics when filters change
  useEffect(() => {
    // Only fetch if not loading main data
    if (activeTab === 'customReport' && customReportDisplay === 'weekly_stats' && !loading) {
      setWeeklyStatsPage(1); // Reset to first page when filters change
      fetchWeeklyStatistics();
    }
  }, [activeTab, customReportDisplay, weeklyStatsGroupBy, weeklyStatsFilters, weeklyStatsSelectedFilter, loading]);

  // Fetch filter options when groupBy changes
  useEffect(() => {
    if (activeTab === 'customReport' && customReportDisplay === 'weekly_stats') {
      setWeeklyStatsPage(1); // Reset pagination when groupBy changes
      // Fetch new options based on groupBy type
      fetchWeeklyStatsFilterOptions(weeklyStatsGroupBy);
      
      // Đồng bộ weeklyStatsSelectedFilter với bộ lọc chung dựa trên groupBy mới
      let filterValue = '';
      switch (weeklyStatsGroupBy) {
        case 'faculty':
          filterValue = customReportFilters.facultyName || weeklyStatsFilters.facultyName || '';
          break;
        case 'location':
          filterValue = customReportFilters.location || weeklyStatsFilters.location || '';
          break;
        case 'class':
          filterValue = customReportFilters.className || weeklyStatsFilters.className || '';
          break;
        case 'group':
          filterValue = customReportFilters.groupId || weeklyStatsFilters.groupId || '';
          break;
        default:
          filterValue = '';
      }
      setWeeklyStatsSelectedFilter(filterValue);
    }
  }, [activeTab, customReportDisplay, weeklyStatsGroupBy]);
  
  // Đồng bộ weeklyStatsSelectedFilter với bộ lọc chung khi thay đổi
  useEffect(() => {
    if (activeTab === 'customReport' && customReportDisplay === 'weekly_stats') {
      let filterValue = '';
      switch (weeklyStatsGroupBy) {
        case 'faculty':
          filterValue = customReportFilters.facultyName || weeklyStatsFilters.facultyName || '';
          break;
        case 'location':
          filterValue = customReportFilters.location || weeklyStatsFilters.location || '';
          break;
        case 'class':
          filterValue = customReportFilters.className || weeklyStatsFilters.className || '';
          break;
        case 'group':
          filterValue = customReportFilters.groupId || weeklyStatsFilters.groupId || '';
          break;
        default:
          filterValue = '';
      }
      if (weeklyStatsSelectedFilter !== filterValue) {
        setWeeklyStatsSelectedFilter(filterValue);
      }
    }
  }, [customReportFilters.facultyName, customReportFilters.location, customReportFilters.className, customReportFilters.groupId, weeklyStatsFilters.facultyName, weeklyStatsFilters.location, weeklyStatsFilters.className, weeklyStatsFilters.groupId, weeklyStatsGroupBy, customReportDisplay, activeTab]);

  // Compute sorted and paginated weekly stats data
  const sortedWeeklyStatsData = useMemo(() => {
    if (!weeklyStatsSortField || weeklyStatsData.length === 0) {
      return weeklyStatsData;
    }
    const sorted = [...weeklyStatsData];
    sorted.sort((a, b) => {
      let aVal, bVal;
      switch (weeklyStatsSortField) {
        case 'group_key':
          aVal = (a.group_key || '').toString().toLowerCase();
          bVal = (b.group_key || '').toString().toLowerCase();
          break;
        case 'sub_group':
          aVal = (a.sub_group || '').toString().toLowerCase();
          bVal = (b.sub_group || '').toString().toLowerCase();
          break;
        case 'week':
          aVal = new Date(a.week_start).getTime();
          bVal = new Date(b.week_start).getTime();
          break;
        case 'student_count':
          aVal = a.student_count || 0;
          bVal = b.student_count || 0;
          break;
        case 'classes':
          aVal = a.classes ? a.classes.length : 0;
          bVal = b.classes ? b.classes.length : 0;
          break;
        case 'session_count':
          aVal = a.session_count || 0;
          bVal = b.session_count || 0;
          break;
        case 'attendance_count':
          aVal = a.attendance_count || 0;
          bVal = b.attendance_count || 0;
          break;
        default:
          return 0;
      }
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return weeklyStatsSortOrder === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      } else {
        return weeklyStatsSortOrder === 'asc'
          ? aVal - bVal
          : bVal - aVal;
      }
    });
    return sorted;
  }, [weeklyStatsData, weeklyStatsSortField, weeklyStatsSortOrder]);

  // Compute paginated weekly stats data (client-side pagination)
  const paginatedWeeklyStatsData = useMemo(() => {
    const startIndex = (weeklyStatsPage - 1) * weeklyStatsItemsPerPage;
    const endIndex = startIndex + weeklyStatsItemsPerPage;
    return sortedWeeklyStatsData.slice(startIndex, endIndex);
  }, [sortedWeeklyStatsData, weeklyStatsPage, weeklyStatsItemsPerPage]);

  // Calculate total pages for weekly stats
  const weeklyStatsTotalPages = Math.ceil(sortedWeeklyStatsData.length / weeklyStatsItemsPerPage);

  // Placeholder for API calls
  const fetchGroups = async () => {
    try {
      // Fetch groups from student_clinical_groups table
      const response = await api.get('/student-groups');
      
      if (response.data && response.data.data) {
        setGroups(response.data.data);
      } else if (Array.isArray(response.data)) {
        setGroups(response.data);
      } else {
        console.error('Unexpected groups data format:', response.data);
        setGroups([]);
      }
    } catch (err) {
      console.error('Error fetching clinical groups:', err);
      
      // Fallback to old API if new one fails
      try {
        const fallbackResponse = await api.get('/attendance/groups');
        if (fallbackResponse.data && fallbackResponse.data.data) {
          setGroups(fallbackResponse.data.data);
        } else if (Array.isArray(fallbackResponse.data)) {
          setGroups(fallbackResponse.data);
        } else {
          setGroups([]);
        }
      } catch (fallbackErr) {
        console.error('Error fetching groups (fallback):', fallbackErr);
        setError('Không thể tải danh sách nhóm. Vui lòng thử lại sau.');
        setGroups([]);
      }
    }
  };
  
  // Fetch absence request stats by date
  const fetchAbsenceStatsByDate = async () => {
    try {
      const response = await api.get('/absence-requests/stats-by-date');
      setAbsenceStatsByDate(response.data.data || []);
      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching absence stats by date:', error);
      setAbsenceStatsByDate([]);
      return [];
    }
  };

  // Fetch custom report data
  const fetchCustomReport = async (filters = customReportFilters, page = customReportPagination.page) => {
    try {
      setCustomReportLoading(true);
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: customReportPagination.limit.toString(),
        sortField: filters.sortField,
        sortOrder: filters.sortOrder,
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
        ...(filters.groupId && { groupId: filters.groupId }),
        ...(filters.className && { className: filters.className }),
        ...(filters.studentName && { studentName: filters.studentName }),
        ...(filters.attendanceType && { attendanceType: filters.attendanceType }),
        ...(filters.location && { location: filters.location }),
        ...(filters.facultyName && { facultyName: filters.facultyName })
      });

      console.log(`🔍 Fetching custom report from: /attendance/custom-report?${queryParams}`);
      const response = await api.get(`/attendance/custom-report?${queryParams}`);
      
      if (response.data && response.data.success) {
        const fetchedData = response.data.data || [];
        const backendPagination = response.data.pagination;
        
        // 🔧 FIX: Backend totalItems might be incorrect due to merging attendance_records + attendance_history
        // Use the larger value between backend totalItems and actual data length
        const correctedTotalItems = Math.max(
          backendPagination.totalItems,
          fetchedData.length,
          backendPagination.page * backendPagination.limit
        );
        
        const correctedPagination = {
          ...backendPagination,
          totalItems: correctedTotalItems,
          totalPages: Math.ceil(correctedTotalItems / backendPagination.limit)
        };
        
        setCustomReportData(fetchedData);
        setCustomReportPagination(correctedPagination);
        
        console.log(`✅ Fetched ${fetchedData.length} records for page ${correctedPagination.page}`);
        console.log(`📊 Pagination: ${correctedPagination.totalItems} total items, ${correctedPagination.totalPages} pages`);
        if (backendPagination.totalItems !== correctedTotalItems) {
          console.warn(`⚠️ Backend totalItems (${backendPagination.totalItems}) corrected to ${correctedTotalItems}`);
        }
        
        setError(null); // Clear any previous errors
      } else {
        setCustomReportData([]);
        console.warn('Custom report: No success flag in response', response.data);
      }
    } catch (error) {
      console.error('Error fetching custom report:', error.response?.data || error.message);
      setCustomReportData([]);
      // Only show error if it's not a 404 or if there's actually an error
      if (error.response?.status !== 404) {
        setError(`Lỗi khi tải dữ liệu báo cáo tùy chỉnh: ${error.response?.data?.message || error.message}`);
      }
    } finally {
      setCustomReportLoading(false);
    }
  };
  
  // Fetch weekly statistics
  const fetchWeeklyStatistics = async () => {
    try {
      setWeeklyStatsLoading(true);
      
      // Build query params, conditionally add filter based on groupBy and selectedFilter
      const queryParams = new URLSearchParams({
        groupBy: weeklyStatsGroupBy
      });

      // Add all filters from weeklyStatsFilters
      if (weeklyStatsFilters.startDate) {
        queryParams.append('startDate', weeklyStatsFilters.startDate);
      }
      if (weeklyStatsFilters.endDate) {
        queryParams.append('endDate', weeklyStatsFilters.endDate);
      }
      if (weeklyStatsFilters.groupId) {
        queryParams.append('groupId', weeklyStatsFilters.groupId);
      }
      if (weeklyStatsFilters.className) {
        queryParams.append('className', weeklyStatsFilters.className);
      }
      if (weeklyStatsFilters.studentName) {
        queryParams.append('studentName', weeklyStatsFilters.studentName);
      }
      if (weeklyStatsFilters.attendanceType) {
        queryParams.append('attendanceType', weeklyStatsFilters.attendanceType);
      }
      if (weeklyStatsFilters.location) {
        queryParams.append('location', weeklyStatsFilters.location);
      }
      if (weeklyStatsFilters.facultyName) {
        queryParams.append('facultyName', weeklyStatsFilters.facultyName);
      }

      // Add specific filter based on groupBy and selectedFilter (override if exists)
      if (weeklyStatsSelectedFilter) {
        switch (weeklyStatsGroupBy) {
          case 'faculty':
            queryParams.set('facultyName', weeklyStatsSelectedFilter);
            break;
          case 'location':
            queryParams.set('location', weeklyStatsSelectedFilter);
            break;
          case 'class':
            queryParams.set('className', weeklyStatsSelectedFilter);
            break;
          case 'group':
            queryParams.set('groupId', weeklyStatsSelectedFilter);
            break;
          case 'session_title':
            queryParams.set('sessionTitle', weeklyStatsSelectedFilter);
            break;
        }
      }

      const response = await api.get(`/attendance/weekly-statistics?${queryParams}`);
      
      if (response.data && response.data.success) {
        setWeeklyStatsData(response.data.data || []);
        setError(null); // Clear any previous errors
      } else {
        setWeeklyStatsData([]);
        console.warn('Weekly stats: No success flag in response', response.data);
      }
    } catch (error) {
      console.error('Error fetching weekly statistics:', error.response?.data || error.message);
      setWeeklyStatsData([]);
      // Only show error if it's not a 404 or if there's actually an error
      if (error.response?.status !== 404) {
        setError(`Lỗi khi tải dữ liệu thống kê theo tuần: ${error.response?.data?.message || error.message}`);
      }
    } finally {
      setWeeklyStatsLoading(false);
    }
  };

  // Fetch filter options for weekly statistics based on groupBy
  const fetchWeeklyStatsFilterOptions = async (type) => {
    try {
      const response = await api.get(`/attendance/weekly-statistics/filter-options?type=${type}`);
      
      if (response.data && response.data.success) {
        setWeeklyStatsFilterOptions(response.data.data || []);
      } else {
        setWeeklyStatsFilterOptions([]);
      }
    } catch (error) {
      console.error('Error fetching filter options:', error);
      setWeeklyStatsFilterOptions([]);
    }
  };

  // Fetch available classes
  const fetchAvailableClasses = async () => {
    try {
      const response = await api.get('/attendance/classes');
      if (response.data && response.data.data) {
        // API returns array of objects with 'name' property
        const classes = response.data.data.map(item => item.name || item);
        setAvailableClasses(classes.filter(Boolean));
      } else if (Array.isArray(response.data)) {
        const classes = response.data.map(item => item.name || item);
        setAvailableClasses(classes.filter(Boolean));
      } else {
        setAvailableClasses([]);
      }
    } catch (error) {
      console.error('Error fetching classes:', error);
      setAvailableClasses([]);
    }
  };

  // Fetch available faculties
  const fetchAvailableFaculties = async () => {
    try {
      const response = await api.get('/attendance/weekly-statistics/filter-options?type=faculty');
      if (response.data && response.data.success && response.data.data) {
        const faculties = response.data.data.map(item => item.label || item.value || item);
        setAvailableFaculties(faculties.filter(Boolean));
      } else {
        setAvailableFaculties([]);
      }
    } catch (error) {
      console.error('Error fetching faculties:', error);
      setAvailableFaculties([]);
    }
  };

  // Search students
  const searchStudents = async (searchTerm) => {
    if (!searchTerm || searchTerm.length < 2) {
      setStudentSearchResults([]);
      setShowStudentSearchResults(false);
      return;
    }

    try {
      const response = await api.get(`/users?role=student&search=${encodeURIComponent(searchTerm)}&limit=10`);
      if (response.data && response.data.data) {
        setStudentSearchResults(response.data.data || []);
        setShowStudentSearchResults(true);
      } else if (Array.isArray(response.data)) {
        setStudentSearchResults(response.data);
        setShowStudentSearchResults(true);
      } else {
        setStudentSearchResults([]);
        setShowStudentSearchResults(false);
      }
    } catch (error) {
      console.error('Error searching students:', error);
      setStudentSearchResults([]);
      setShowStudentSearchResults(false);
    }
  };

  // Fetch weekly statistics detail for drill-down
  const fetchWeeklyStatisticsDetail = async (stat) => {
    try {
      setWeeklyStatsDetailLoading(true);
      setSelectedWeeklyStat(stat);
      setShowWeeklyStatsDetailModal(true);

      const weekStart = new Date(stat.week_start).toISOString().split('T')[0];
      const weekEnd = new Date(stat.week_end).toISOString().split('T')[0];

      const queryParams = new URLSearchParams({
        groupBy: weeklyStatsGroupBy,
        groupKey: stat.group_key,
        subGroup: stat.sub_group || '',
        weekStart,
        weekEnd
      });

      const response = await api.get(`/attendance/weekly-statistics/detail?${queryParams}`);
      
      if (response.data && response.data.success) {
        setWeeklyStatsDetailData(response.data.data || []);
      } else {
        setWeeklyStatsDetailData([]);
      }
    } catch (error) {
      console.error('Error fetching weekly statistics detail:', error);
      setWeeklyStatsDetailData([]);
    } finally {
      setWeeklyStatsDetailLoading(false);
    }
  };

  // Export weekly statistics detail to Excel
  const exportWeeklyStatsDetailToExcel = () => {
    if (!weeklyStatsDetailData || weeklyStatsDetailData.length === 0) {
      alert('Không có dữ liệu để xuất');
      return;
    }

    const exportData = weeklyStatsDetailData.map(record => ({
      'Mã SV': record.student_code || '',
      'Họ và tên': record.student_name || '',
      'Email': record.student_email || '',
      'Lớp': record.class_name || '',
      'Khoa': record.faculty_name || '',
      'Giới tính': record.gender === 'male' ? 'Nam' : record.gender === 'female' ? 'Nữ' : 'Khác',
      'Tên buổi học': record.session_title || '',
      'Ngày học': record.session_date ? formatDate(record.session_date) : '',
      'Địa điểm': record.session_location || '',
      'Nhóm': formatGroupName(record.group_name),
      'Loại điểm danh': getAttendanceTypeLabel(record.attendance_type),
      'Thời gian điểm danh': record.timestamp ? new Date(record.timestamp).toLocaleString('vi-VN') : ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Chi tiết thống kê');
    
    const filename = `thong-ke-tuan-${selectedWeeklyStat?.group_key || 'all'}-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  const fetchAllAttendance = async (forceRefresh = false) => {
    // Prevent multiple simultaneous fetches
    if (fetchingRef.current && !forceRefresh) {
      console.log('⚠️ Fetch already in progress, skipping...');
      return;
    }
    
    try {
      fetchingRef.current = true;
      setLoading(true);
      
      let attendanceData = [];
      let dashboardData = null;
      let absenceStatsData = null;
      
      // Fetch from server (caching disabled due to data size)
      console.log('🌐 Fetching data from server...');
      
      // Update progress: Fetching attendance (20-50%)
      setLoadingProgress(25);
      setLoadingMessage('Đang kết nối tới server...');
      
      // Create fake progress to show activity while waiting for API
      let currentProgress = 25;
      const progressInterval = setInterval(() => {
        // Progressive slowdown - the higher we go, the slower it gets
        if (currentProgress >= 80) {
          currentProgress += 0.1; // Extremely slow at the end
        } else if (currentProgress >= 70) {
          currentProgress += 0.2; // Very very slow
        } else if (currentProgress >= 60) {
          currentProgress += 0.3; // Very slow
        } else if (currentProgress >= 50) {
          currentProgress += 0.5; // Slow
        } else if (currentProgress >= 45) {
          currentProgress += 1; // Medium
        } else {
          currentProgress += 2; // Normal speed
        }
        
        // Continue up to 88% max (leave room for final steps)
        if (currentProgress <= 88) {
          setLoadingProgress(Math.min(currentProgress, 88));
          
          if (currentProgress < 30) {
            setLoadingMessage('Đang gửi yêu cầu lấy dữ liệu...');
          } else if (currentProgress < 35) {
            setLoadingMessage('Server đang xử lý yêu cầu...');
          } else if (currentProgress < 40) {
            setLoadingMessage('Đang tải dữ liệu điểm danh từ database...');
          } else if (currentProgress < 45) {
            setLoadingMessage('Server đang đóng gói dữ liệu...');
          } else if (currentProgress < 50) {
            setLoadingMessage('Đang truyền dữ liệu từ server...');
          } else if (currentProgress < 55) {
            setLoadingMessage('Đang nhận dữ liệu (có thể mất vài giây)...');
          } else if (currentProgress < 60) {
            setLoadingMessage('Đang tải dữ liệu lớn, vui lòng chờ...');
          } else if (currentProgress < 70) {
            setLoadingMessage('Server đang xử lý dữ liệu lớn...');
          } else if (currentProgress < 80) {
            setLoadingMessage('Đang nhận phần cuối của dữ liệu...');
          } else {
            setLoadingMessage('Gần hoàn tất, đang hoàn thiện...');
          }
        }
      }, 500); // Check every 500ms
      
      try {
        // Fetch data - all in parallel for speed
        const [attendanceResponse, dashboardResponse, absenceStatsResponse] = await Promise.all([
          api.get('/attendance/reports/all'),
          api.get('/dashboard/stats'),
          api.get('/absence-requests/stats')
        ]);
        
        // Clear interval when data is received
        clearInterval(progressInterval);
        
        // Update progress: Data received (90%)
        setLoadingProgress(90);
        setLoadingMessage('✅ Đã nhận đầy đủ dữ liệu từ server!');
      
        dashboardData = dashboardResponse.data;
        absenceStatsData = absenceStatsResponse.data;
        
        // Extract attendance data
        if (attendanceResponse.data && attendanceResponse.data.data) {
          attendanceData = attendanceResponse.data.data;
        } else if (Array.isArray(attendanceResponse.data)) {
          attendanceData = attendanceResponse.data;
        }
        
        console.log(`✅ Loaded ${attendanceData.length} records from server`);
      } catch (fetchError) {
        clearInterval(progressInterval);
        throw fetchError; // Re-throw to be caught by outer catch
      }
      
      // Check if data exists
      if (attendanceData && attendanceData.length > 0) {
        // Update progress: Parsing data (90-95%)
        setLoadingProgress(92);
        setLoadingMessage(`📊 Đã tải ${attendanceData.length.toLocaleString('vi-VN')} bản ghi!`);
        
        // Small delay to show the message
        await new Promise(resolve => setTimeout(resolve, 300));
        
        setLoadingProgress(95);
        setLoadingMessage(`🚀 Đang chuẩn bị hiển thị dữ liệu...`);
        console.log('⚙️ Data loaded, preparing to show UI...');
        
        // IMPORTANT: Turn off loading screen quickly
        // Data processing will happen in background with startTransition
        setTimeout(() => {
          setLoadingProgress(98);
          setLoadingMessage('⚡ Đang khởi tạo giao diện...');
        }, 200);
        
        setTimeout(() => {
          setLoadingProgress(100);
          setLoadingMessage('✅ Hoàn tất!');
          console.log('✅ Loading screen dismissed, processing data in background...');
        }, 500);
        
        // Turn off loading after showing 100%
        setTimeout(() => {
          setLoading(false);
          fetchingRef.current = false;
        }, 800);
        
        // Process data in background with startTransition (non-blocking)
        startTransition(() => {
          console.log('⚙️ Starting data processing...');
          processAttendanceData(attendanceData, dashboardData, absenceStatsData);
          console.log('✅ Data processing completed');
        });
      } else {
        console.error('No attendance data available');
        setAttendanceData([]);
        setError('Không có dữ liệu điểm danh');
        setLoading(false);
        fetchingRef.current = false;
      }
      
    } catch (err) {
      console.error('Error fetching all attendance:', err);
      setError('Không thể tải dữ liệu điểm danh. Vui lòng thử lại sau.');
      setAttendanceData([]);
      setLoading(false);
      fetchingRef.current = false;
    }
  };

  const fetchAttendanceByGroup = async (groupId) => {
    try {
      setLoading(true);
      const response = await api.get(`/attendance/group/${groupId}`);
      
      if (response.data && response.data.data) {
        processAttendanceData(response.data.data);
      } else if (Array.isArray(response.data)) {
        processAttendanceData(response.data, null, null);
      } else {
        console.error('Unexpected attendance data format:', response.data);
        setAttendanceData([]);
      }
    } catch (err) {
      console.error('Error fetching attendance data:', err);
      setError('Không thể tải dữ liệu điểm danh. Vui lòng thử lại sau.');
      setAttendanceData([]);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchAttendanceByClass = async (classId) => {
    try {
      setLoading(true);
      const response = await api.get(`/attendance/class/${classId}`);
      
      if (response.data && response.data.data) {
        processAttendanceData(response.data.data);
      } else if (Array.isArray(response.data)) {
        processAttendanceData(response.data, null, null);
      } else {
        console.error('Unexpected attendance data format:', response.data);
        setAttendanceData([]);
      }
    } catch (err) {
      console.error('Error fetching attendance data by class:', err);
      setError('Không thể tải dữ liệu điểm danh theo lớp. Vui lòng thử lại sau.');
      setAttendanceData([]);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchAttendanceByDateRange = async (startDate, endDate) => {
    try {
      setLoading(true);
      
      // Validate dates
      if (!startDate || !endDate) {
        console.error('Invalid date range:', { startDate, endDate });
        setError('Vui lòng chọn khoảng thời gian hợp lệ');
        setAttendanceData([]);
        return;
      }
      
      // Ensure dates are in YYYY-MM-DD format
      const formatDate = (dateStr) => {
        if (!dateStr) return '';
        // If date is already in YYYY-MM-DD format, return as is
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          return dateStr;
        }
        // Otherwise, try to format it
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '';
        return date.toISOString().split('T')[0];
      };
      
      const formattedStartDate = formatDate(startDate);
      const formattedEndDate = formatDate(endDate);
      
      if (!formattedStartDate || !formattedEndDate) {
        console.error('Failed to format dates:', { startDate, endDate });
        setError('Định dạng ngày không hợp lệ');
        setAttendanceData([]);
        return;
      }
      
      const url = `/attendance/date-range/${formattedStartDate}/${formattedEndDate}`;
      console.log('Fetching attendance by date range:', { formattedStartDate, formattedEndDate, url });
      
      const response = await api.get(url);
      
      if (response.data && response.data.data) {
        processAttendanceData(response.data.data);
      } else if (Array.isArray(response.data)) {
        processAttendanceData(response.data, null, null);
      } else {
        console.error('Unexpected attendance data format:', response.data);
        setAttendanceData([]);
      }
    } catch (err) {
      console.error('Error fetching attendance data:', err);
      if (err.response && err.response.status === 404) {
        setError('Không tìm thấy dữ liệu điểm danh cho khoảng thời gian đã chọn');
      } else {
        setError('Không thể tải dữ liệu điểm danh. Vui lòng thử lại sau.');
      }
      setAttendanceData([]);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchAllMembers = async () => {
    try {
      setLoadingMembers(true);
      
      // Lấy dữ liệu điểm danh trực tiếp từ API thay vì lấy danh sách sinh viên
      const attendanceResponse = await api.get('/attendance/reports/all');
      
      if (attendanceResponse.data.success) {
        const allAttendanceRecords = attendanceResponse.data.data;
        
        // Process attendance records to create detailed members list
        // Each record represents a student's attendance in a specific session
        const processedMembers = allAttendanceRecords.map(record => {
          // Determine gender value
          let genderValue = record.gender;
          
          // If gender is not set or invalid, try to determine from other fields
          if (!genderValue || (genderValue !== 'male' && genderValue !== 'female')) {
            // Try to determine from full_name or other available fields
            const name = record.full_name ? record.full_name.toLowerCase() : '';
            
            // Common Vietnamese female name endings
            const femaleNames = ['thị', 'ngọc', 'hương', 'trang', 'linh', 'hà', 'lan', 'chi', 'mai', 'hoa', 'thảo'];
            // Common Vietnamese male name endings
            const maleNames = ['văn', 'đức', 'minh', 'quang', 'hùng', 'tuấn', 'anh', 'đạt', 'nam', 'hải'];
            
            // Simple gender detection based on name
            const isFemale = femaleNames.some(femaleName => name.includes(femaleName));
            const isMale = maleNames.some(maleName => name.includes(maleName));
            
            if (isFemale && !isMale) {
              genderValue = 'female';
            } else if (isMale && !isFemale) {
              genderValue = 'male';
            }
          }
          
          // Get session information
          const sessionInfo = {
            title: record.session_title || record.session_name || record.session?.title || record.session?.name || 'N/A',
            id: record.session_id || record.session?._id,
            date: record.session_date || record.session?.date,
            start_time: record.start_time,
            end_time: record.end_time,
            location: record.session_location
          };
          
          return {
            id: record.student_id || record.id,
            fullName: record.full_name,
            class: record.class_name,
            groupName: record.group_name,
            student_id: record.student_code || record.student_id,
            email: record.email,
            gender: genderValue,
            attendanceStatus: record.attendance_type,
            attendanceTimestamp: record.timestamp,
            minutes_early: record.minutes_early,
            minutes_late: record.minutes_late,
            sessionInfo: sessionInfo,
            attendanceData: [record] // Each record is a separate attendance entry
          };
        });
        
        setDetailedMembers(processedMembers);
        setAttendanceData(allAttendanceRecords);
      } else {
        // Fallback: try to get members if attendance data is not available
        const membersResponse = await api.get('/attendance/members');
        
        if (membersResponse.data.success) {
          const allMembers = membersResponse.data.data;
          
          // Process the data to map field names correctly
          const processedMembers = allMembers.map(member => {
            // Determine gender value
            let genderValue = member.gender;
            
            if (!genderValue || (genderValue !== 'male' && genderValue !== 'female')) {
              const name = member.full_name ? member.full_name.toLowerCase() : '';
              const femaleNames = ['thị', 'ngọc', 'hương', 'trang', 'linh', 'hà', 'lan', 'chi', 'mai', 'hoa', 'thảo'];
              const maleNames = ['văn', 'đức', 'minh', 'quang', 'hùng', 'tuấn', 'anh', 'đạt', 'nam', 'hải'];
              
              const isFemale = femaleNames.some(femaleName => name.includes(femaleName));
              const isMale = maleNames.some(maleName => name.includes(maleName));
              
              if (isFemale && !isMale) {
                genderValue = 'female';
              } else if (isMale && !isFemale) {
                genderValue = 'male';
              }
            }
            
            return {
              ...member,
              fullName: member.full_name,
              class: member.class_name,
              groupName: member.group_name,
              student_id: member.student_code || member.student_id,
              email: member.email,
              gender: genderValue,
              attendanceStatus: 'unknown',
              attendanceTimestamp: null,
              minutes_early: null,
              minutes_late: null,
              sessionInfo: null,
              attendanceData: []
            };
          });
          
          setDetailedMembers(processedMembers);
          setAttendanceData([]);
        }
      }
    } catch (error) {
      console.error('Error fetching attendance data:', error);
      setDetailedMembers([]);
      setAttendanceData([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  // Process attendance data from API responses
  const processAttendanceData = (data, dashboardData = null, absenceStatsData = null) => {
    // Debug: Log the data structure

    
    // Check if data is empty
    if (!data || !Array.isArray(data) || data.length === 0) {
      setStats({
        totalSessions: 0,
        totalAttendees: 0,
        averageAttendance: 0,
        maleCount: 0,
        femaleCount: 0,
        otherCount: 0,
        fullAttendance: 0,
        earlyAttendance: 0,
        lateAttendance: 0,
        earlyLeave: 0,
        lateLeave: 0,
        absent: 0,
        absentWithPermission: 0,
        earlyPermission: 0,
        latePermission: 0,
        totalAttendanceOccurrences: 0,
        // Absence request stats (approved)
        fullSessionApproved: 0,
        beforeSessionApproved: 0,
        duringSessionApproved: 0,
        afterSessionApproved: 0
      });
      setAttendanceByStatus({});
      setAttendanceData([]);
      setCsvData([['Không có dữ liệu điểm danh']]);
      return;
    }
    
    // Optimize: Map and filter in single pass
    const lowerNameFilter = nameFilter ? nameFilter.toLowerCase() : null;
    
    const processedData = data.reduce((acc, item) => {
      // Check filter first (early exit if not matching)
      if (lowerNameFilter) {
        const fullName = (item.full_name || item.member?.fullName || item.member?.full_name || '').toLowerCase();
        if (!fullName.includes(lowerNameFilter)) {
          return acc; // Skip this item
        }
      }
      
      // Map the item
      acc.push({
        ...item,
        sessionId: item.sessionId || { 
          _id: item.session_id, 
          name: item.session_name || item.date 
        },
        method: item.method || item.period,
        member: item.member || {
          _id: item.student_id,
          fullName: item.full_name,
          class: item.class_name,
          gender: item.gender,
          email: item.email,
          faculty_name: item.faculty_name
        },
        faculty_name: item.faculty_name || item.member?.faculty_name
      });
      
      return acc;
    }, []);

    // Set processed data
    setAttendanceData(processedData);
    
    // Calculate stats
    const sessionIds = [...new Set(processedData.map(item => 
      item.sessionId?._id || item.session_id
    ))];
    const totalSessions = sessionIds.length;
    
    // Use Set to get unique attendee IDs
    const attendeeIds = new Set();
    processedData.forEach(item => {
      const studentId = item.member?._id || item.student_id;
      if (studentId) {
        attendeeIds.add(studentId);
      }
    });
    const totalAttendees = attendeeIds.size;
    
    const averageAttendance = totalSessions > 0 ? (processedData.length / totalSessions).toFixed(2) : 0;
    
    // Optimize: Single loop for gender counts and status counts
    let maleCount = 0;
    let femaleCount = 0;
    let otherCount = 0;
    
    const statusCounts = {
      full: 0,
      before: 0,
      during: 0,
      after: 0,
      present: 0,
      early: 0,
      late: 0,
      late_leave: 0,
      absent: 0,
      absent_perm: 0,
      absent_before_perm: 0,
      absent_during_perm: 0,
      absent_after_perm: 0
    };
    
    // Single loop to count both gender and status - MUCH FASTER!
    processedData.forEach(item => {
      // Count gender
      const gender = item.member?.gender || item.gender;
      if (gender === 'male') maleCount++;
      else if (gender === 'female') femaleCount++;
      else otherCount++;
      
      // Count status
      const attendanceType = item.status || item.attendance_type;
      if (attendanceType && statusCounts.hasOwnProperty(attendanceType)) {
        statusCounts[attendanceType]++;
      }
    });
    
    // Tính toán "Vắng mặt" - sử dụng dữ liệu từ dashboard stats
    let absentCount = 0;
    
    if (dashboardData) {
      // Tìm kiếm absentStudentsCount trong các cấp độ khác nhau
      let foundAbsentCount = null;
      
      // Kiểm tra cấp độ gốc
      if (dashboardData.absentStudentsCount) {
        foundAbsentCount = dashboardData.absentStudentsCount;
      }
      // Kiểm tra trong data object
      else if (dashboardData.data && dashboardData.data.absentStudentsCount) {
        foundAbsentCount = dashboardData.data.absentStudentsCount;
      }
      // Kiểm tra trong stats object
      else if (dashboardData.stats && dashboardData.stats.absentStudentsCount) {
        foundAbsentCount = dashboardData.stats.absentStudentsCount;
      }
      // Kiểm tra mảng absentStudents
      else if (dashboardData.absentStudents && Array.isArray(dashboardData.absentStudents)) {
        foundAbsentCount = dashboardData.absentStudents.length;
      }
      else if (dashboardData.data && dashboardData.data.absentStudents && Array.isArray(dashboardData.data.absentStudents)) {
        foundAbsentCount = dashboardData.data.absentStudents.length;
      }
      
      if (foundAbsentCount !== null) {
        absentCount = foundAbsentCount;
      }
    }
    
    if (absentCount === 0) {
      // Fallback: tính vắng mặt dựa trên dữ liệu có sẵn
      const studentsWithAttendance = new Set();
      processedData.forEach(item => {
        const studentId = item.member?._id || item.student_id;
        if (studentId) {
          studentsWithAttendance.add(studentId);
        }
      });
      
      // Nếu có totalAttendees từ stats, tính vắng mặt
      if (totalAttendees > 0) {
        absentCount = Math.max(0, totalAttendees - studentsWithAttendance.size);
      }
      
      console.log('Absent calculation fallback:', {
        totalProcessedData: processedData.length,
        uniqueStudentsWithAttendance: studentsWithAttendance.size,
        totalAttendees: totalAttendees,
        calculatedAbsent: absentCount
      });
    }
    
    statusCounts.absent = absentCount;
    
    // Xử lý dữ liệu absence requests (yêu cầu phép vắng mặt đã duyệt)
    let absenceRequestStats = {
      fullSessionApproved: 0,
      beforeSessionApproved: 0,
      duringSessionApproved: 0,
      afterSessionApproved: 0
    };
    
    if (absenceStatsData && absenceStatsData.data) {
      const absenceData = absenceStatsData.data;
      absenceRequestStats = {
        fullSessionApproved: parseInt(absenceData.full_session_requests || 0),
        beforeSessionApproved: parseInt(absenceData.before_session_requests || 0),
        duringSessionApproved: parseInt(absenceData.during_session_requests || 0),
        afterSessionApproved: parseInt(absenceData.after_session_requests || 0)
      };
      
    }
    
    // Tính toán số lượng "Đầy đủ" - đếm tổng số lần xuất hiện
    // Tạo map để theo dõi sinh viên và các trạng thái của họ theo từng buổi học
    const studentSessionAttendanceMap = {};
    
    processedData.forEach(item => {
      const studentId = item.member?._id || item.student_id;
      const sessionId = item.sessionId?._id || item.session_id;
      const attendanceType = item.status || item.attendance_type;
      
      if (!studentId || !sessionId || !attendanceType) return;
      
      const key = `${studentId}_${sessionId}`;
      if (!studentSessionAttendanceMap[key]) {
        studentSessionAttendanceMap[key] = {
          studentId: studentId,
          sessionId: sessionId,
          attendanceTypes: new Set()
        };
      }
      
      studentSessionAttendanceMap[key].attendanceTypes.add(attendanceType);
    });
    
    // Đếm tổng số lần "Đầy đủ" - mỗi buổi học có đầy đủ điểm danh được đếm
    Object.values(studentSessionAttendanceMap).forEach(sessionData => {
      const statusSet = sessionData.attendanceTypes;
      
      // Trường hợp 1: Có mặt trước + Có mặt trong + Có mặt sau (hoặc Về trễ) → Đầy đủ
      if ((statusSet.has('before') && statusSet.has('during') && (statusSet.has('after') || statusSet.has('late_leave'))) ||
          (statusSet.has('early') && statusSet.has('during') && (statusSet.has('after') || statusSet.has('late_leave')))) {
        statusCounts.full++;
        return;
      }
      
      // Trường hợp 2: Đi trễ + Có mặt trong + Có mặt sau → Đầy đủ
      if (statusSet.has('late') && statusSet.has('during') && statusSet.has('after')) {
        statusCounts.full++;
        return;
      }
      
      // Trường hợp 3: Đi trễ + Có mặt trong + Về trễ → Đầy đủ
      if (statusSet.has('late') && statusSet.has('during') && statusSet.has('late_leave')) {
        statusCounts.full++;
        return;
      }
      
      // Trường hợp 4: Đi trước (hoặc Có mặt trước) + Có mặt trong + Có mặt sau → Đầy đủ
      if ((statusSet.has('early') || statusSet.has('before')) && statusSet.has('during') && statusSet.has('after')) {
        statusCounts.full++;
        return;
      }
    });
    
    // Cập nhật các biến để sử dụng trong giao diện
    const fullAttendance = statusCounts.full;
    const beforeAttendance = statusCounts.before;
    const duringAttendance = statusCounts.during;
    const afterAttendance = statusCounts.after;
    const presentAttendance = statusCounts.present;
    const earlyAttendance = statusCounts.early;
    const lateAttendance = statusCounts.late;
    const earlyLeave = statusCounts.early_leave;
    const lateLeave = statusCounts.late_leave;
    const absent = statusCounts.absent;
    const absentWithPermission = statusCounts.absent_perm;
    const earlyPermission = statusCounts.absent_before_perm;
    const duringPermission = statusCounts.absent_during_perm;
    const latePermission = statusCounts.absent_after_perm;
    
    // Tính tổng số lần xuất hiện của tất cả các trạng thái để làm mẫu số cho tỷ lệ
    const totalAttendanceOccurrences = fullAttendance + beforeAttendance + duringAttendance + afterAttendance + 
                                     presentAttendance + earlyAttendance + lateAttendance + earlyLeave + lateLeave + 
                                     absent + absentWithPermission + earlyPermission + duringPermission + latePermission;
    
    setStats({
      totalSessions,
      totalAttendees,
      averageAttendance,
      maleCount,
      femaleCount,
      otherCount,
      fullAttendance,
      beforeAttendance,
      duringAttendance,
      afterAttendance,
      presentAttendance,
      earlyAttendance,
      lateAttendance,
      earlyLeave,
      lateLeave,
      absent,
      absentWithPermission,
      earlyPermission,
      duringPermission,
      latePermission,
      totalAttendanceOccurrences,
      // Absence request stats (approved)
      fullSessionApproved: absenceRequestStats.fullSessionApproved,
      beforeSessionApproved: absenceRequestStats.beforeSessionApproved,
      duringSessionApproved: absenceRequestStats.duringSessionApproved,
      afterSessionApproved: absenceRequestStats.afterSessionApproved
    });
    
    // Phân tích dữ liệu theo trạng thái điểm danh
    const byStatus = {
      full: fullAttendance,
      early: earlyAttendance,
      late: lateAttendance,
      early_leave: earlyLeave,
      late_leave: lateLeave,
      absent: absent,
      full_permission: absentWithPermission,
      early_permission: earlyPermission,
      late_permission: latePermission
    };
    setAttendanceByStatus(byStatus);
    
    // Chuẩn bị dữ liệu biểu đồ
    prepareChartData(byStatus);
    
    setAttendanceData(processedData);
    
    // Prepare CSV data
    const csvData = [
      ['Họ và tên', 'Lớp', 'Giới tính', 'Email', 'Buổi điểm danh', 'Ngày', 'Giờ điểm danh', 'Phương thức', 'Trạng thái']
    ];
    
    data.forEach(item => {
      csvData.push([
        item.member?.full_name || item.member?.fullName || 'N/A',
        item.member?.class_name || item.member?.class || 'N/A',
        item.member?.gender === 'male' ? 'Nam' : item.member?.gender === 'female' ? 'Nữ' : 'Khác',
        item.member?.email || 'N/A',
        item.sessionId?.name || 'N/A',
        new Date(item.timestamp).toLocaleDateString('vi-VN'),
        new Date(item.timestamp).toLocaleTimeString('vi-VN'),
        item.method === 'qr' ? 'QR Code' : item.method === 'manual' ? 'Thủ công' : item.method,
        getStatusText(item.status)
      ]);
    });
    
    setCsvData(csvData);
  };
  
  // Helper function to get status text
  const getStatusText = (status) => {
    switch (status) {
      case 'full': return 'Có mặt đầy đủ';
      case 'early': return 'Có mặt trước';
      case 'during': return 'Có mặt trong';
      case 'late': return 'Có mặt sau';
      case 'early_leave': return 'Đi trước';
      case 'late_arrival': return 'Đi trễ';
      case 'late_leave': return 'Về trễ';
      case 'absent': return 'Vắng mặt';
      case 'full_permission': return 'Phép cả buổi';
      case 'early_permission': return 'Phép trước buổi';
      case 'late_permission': return 'Phép sau buổi';
      default: return 'Không xác định';
    }
  };
  
  // Prepare chart data
  const prepareChartData = (byStatus) => {
    setChartData({
      byStatus: {
        labels: [
          'Có mặt đầy đủ', 
          'Có mặt trước', 
          'Có mặt trong',
          'Có mặt sau',
          'Đi trước',
          'Đi trễ',
          'Về trễ',
          'Vắng mặt',
          'Phép cả buổi',
          'Phép trước buổi',
          'Phép sau buổi'
        ],
        datasets: [
          {
            label: 'Số lượt điểm danh',
            data: [
              byStatus.full || 0,
              byStatus.early || 0,
              byStatus.during || 0,
              byStatus.late || 0,
              byStatus.early_leave || 0,
              byStatus.late_arrival || 0,
              byStatus.late_leave || 0,
              byStatus.absent || 0,
              byStatus.full_permission || 0,
              byStatus.early_permission || 0,
              byStatus.late_permission || 0
            ],
            backgroundColor: [
              'rgba(40, 167, 69, 0.7)',  // success - full attendance
              'rgba(23, 162, 184, 0.7)', // info - early
              'rgba(0, 123, 255, 0.7)',  // primary - during
              'rgba(255, 193, 7, 0.7)',  // warning - late
              'rgba(108, 117, 125, 0.7)', // secondary - early leave
              'rgba(255, 193, 7, 0.7)',  // warning - late arrival
              'rgba(253, 126, 20, 0.7)', // orange - late leave
              'rgba(220, 53, 69, 0.7)',  // danger - absent
              'rgba(111, 66, 193, 0.7)', // purple - full permission
              'rgba(102, 16, 242, 0.7)', // indigo - early permission
              'rgba(232, 62, 140, 0.7)'  // pink - late permission
            ],
            borderWidth: 1
          }
        ]
      }
    });
  };

  // Apply filters to data
  const applyFilters = (data) => {
    let filtered = data || [];
    
    // Filter by name
    if (nameFilter) {
      filtered = filtered.filter(item => {
        const fullName = item.member?.fullName || item.member?.full_name || item.full_name || item.fullName || '';
        return fullName.toLowerCase().includes(nameFilter.toLowerCase());
      });
    }
    
    // Filter by group
    if (selectedGroup) {
      filtered = filtered.filter(item => {
        const groupId = item.group_id || item.group?._id || item.member?.group_id || item.groupName?.group_id;
        return groupId === selectedGroup;
      });
    }
    
    // Filter by date range
    if (dateRange.startDate && dateRange.endDate) {
      filtered = filtered.filter(item => {
        const itemDate = item.session_date || item.date || item.timestamp || item.session?.date || item.sessionInfo?.date;
        if (!itemDate) {
          // For detailedMembers, check attendanceTimestamp
          if (item.attendanceTimestamp) {
            const date = new Date(item.attendanceTimestamp).toISOString().split('T')[0];
            return date >= dateRange.startDate && date <= dateRange.endDate;
          }
          return false;
        }
        const date = new Date(itemDate).toISOString().split('T')[0];
        return date >= dateRange.startDate && date <= dateRange.endDate;
      });
    }
    
    return filtered;
  };

  // Export data based on current active tab
  const exportCurrentTab = () => {
    let csvData = [];
    let fileName = 'bao_cao_diem_danh.xlsx';
    let sheetName = 'Báo cáo điểm danh';

    switch (activeTab) {
      case 'statusDistribution':
        // Export statistics summary
        csvData = [
          ['Thống kê điểm danh'],
          ['Trạng thái', 'Số lượng'],
          ['Có mặt đầy đủ', stats.fullAttendance || 0],
          ['Có mặt trước', stats.beforeAttendance || 0],
          ['Có mặt trong', stats.duringAttendance || 0],
          ['Có mặt sau', stats.afterAttendance || 0],
          ['Có mặt', stats.presentAttendance || 0],
          ['Đi trễ', stats.lateAttendance || 0],
          ['Vắng mặt', stats.absent || 0],
          ['Phép cả buổi', stats.fullSessionApproved || 0],
          ['Phép trước buổi', stats.beforeSessionApproved || 0],
          ['Phép trong buổi', stats.duringSessionApproved || 0],
          ['Phép sau buổi', stats.afterSessionApproved || 0],
          [''],
          ['Tổng số buổi học', stats.totalSessions || 0],
          ['Tổng số sinh viên', stats.totalAttendees || 0],
          ['Tỷ lệ điểm danh trung bình', stats.averageAttendance || 0]
        ];
        fileName = 'thong_ke_trang_thai.xlsx';
        sheetName = 'Thống kê trạng thái';
        break;

      case 'detailedList':
        // Export detailed list with filters applied
        const filteredDetailedMembers = applyFilters(detailedMembers);
        csvData = [
          ['#', 'Họ và tên', 'Lớp', 'Tên buổi học', 'Giới tính', 'Email', 'Trạng thái điểm danh']
        ];
        filteredDetailedMembers.forEach((member, index) => {
          csvData.push([
            index + 1,
            member.fullName || 'N/A',
            member.class || 'N/A',
            member.sessionInfo?.title || 'N/A',
            member.gender === 'male' ? 'Nam' : member.gender === 'female' ? 'Nữ' : 'Khác',
            member.email || 'N/A',
            getStatusText(member.attendanceStatus)
          ]);
        });
        fileName = 'danh_sach_chi_tiet.xlsx';
        sheetName = 'Danh sách chi tiết';
        break;

      case 'classReport':
        // Export class report
        const filteredAttendanceData = applyFilters(attendanceData);
        const classSummariesForExport = {};
        
        filteredAttendanceData.forEach(record => {
          const className = record.member?.class || record.class_name || record.class;
          const studentId = record.member?._id || record.student_id || record.member_id;
          const attendanceType = record.status || record.attendance_type || record.type;
          
          if (!className || !studentId || !attendanceType) return;
          
          if (!classSummariesForExport[className]) {
            classSummariesForExport[className] = {
              name: className,
              totalStudents: new Set(),
              fullCount: 0,
              beforeCount: 0,
              duringCount: 0,
              afterCount: 0,
              presentCount: 0,
              lateCount: 0,
              absentCount: 0,
              fullPermCount: 0,
              beforePermCount: 0,
              duringPermCount: 0,
              afterPermCount: 0
            };
          }
          
          classSummariesForExport[className].totalStudents.add(studentId);
          
          if (attendanceType === 'before') classSummariesForExport[className].beforeCount++;
          if (attendanceType === 'during') classSummariesForExport[className].duringCount++;
          if (attendanceType === 'after') classSummariesForExport[className].afterCount++;
          if (attendanceType === 'present') classSummariesForExport[className].presentCount++;
          if (attendanceType === 'late') classSummariesForExport[className].lateCount++;
          if (attendanceType === 'absent') classSummariesForExport[className].absentCount++;
        });
        
        csvData = [
          ['Lớp', 'Tổng số SV', 'Đầy đủ', 'Trước', 'Trong', 'Sau', 'Có mặt', 'Đi trễ', 'Vắng', 'Phép cả buổi', 'Phép trước', 'Phép trong', 'Phép sau']
        ];
        Object.values(classSummariesForExport).forEach(classData => {
          csvData.push([
            classData.name,
            classData.totalStudents.size,
            classData.fullCount,
            classData.beforeCount,
            classData.duringCount,
            classData.afterCount,
            classData.presentCount,
            classData.lateCount,
            classData.absentCount,
            classData.fullPermCount,
            classData.beforePermCount,
            classData.duringPermCount,
            classData.afterPermCount
          ]);
        });
        fileName = 'bao_cao_theo_lop.xlsx';
        sheetName = 'Báo cáo theo lớp';
        break;

      case 'hospitalReport':
        // Export hospital report
        const filteredAttendanceForHospital = applyFilters(attendanceData);
        const hospitalStatsForExport = {};
        
        filteredAttendanceForHospital.forEach(record => {
          const hospitalName = record.session_location || record.location || record.hospital?.name || record.hospital_name || record.hospital;
          const studentId = record.student_id || record.studentId || record.member?._id;
          const attendanceType = record.status || record.attendance_type;
          
          if (!hospitalName || hospitalName === "-- Chọn vị trí có sẵn --") return;
          
          if (!hospitalStatsForExport[hospitalName]) {
            hospitalStatsForExport[hospitalName] = {
              name: hospitalName,
              totalStudents: new Set(),
              fullCount: 0,
              beforeCount: 0,
              duringCount: 0,
              afterCount: 0,
              presentCount: 0,
              lateCount: 0,
              absentCount: 0,
              fullPermCount: 0,
              beforePermCount: 0,
              duringPermCount: 0,
              afterPermCount: 0
            };
          }
          
          if (studentId) hospitalStatsForExport[hospitalName].totalStudents.add(studentId);
          
          if (attendanceType === 'before') hospitalStatsForExport[hospitalName].beforeCount++;
          if (attendanceType === 'during') hospitalStatsForExport[hospitalName].duringCount++;
          if (attendanceType === 'after') hospitalStatsForExport[hospitalName].afterCount++;
          if (attendanceType === 'present') hospitalStatsForExport[hospitalName].presentCount++;
          if (attendanceType === 'late') hospitalStatsForExport[hospitalName].lateCount++;
          if (attendanceType === 'absent') hospitalStatsForExport[hospitalName].absentCount++;
        });
        
        csvData = [
          ['Bệnh viện', 'Tổng số SV', 'Đầy đủ', 'Trước', 'Trong', 'Sau', 'Có mặt', 'Đi trễ', 'Vắng', 'Phép cả buổi', 'Phép trước', 'Phép trong', 'Phép sau']
        ];
        Object.values(hospitalStatsForExport).forEach(hospitalData => {
          csvData.push([
            hospitalData.name,
            hospitalData.totalStudents.size,
            hospitalData.fullCount,
            hospitalData.beforeCount,
            hospitalData.duringCount,
            hospitalData.afterCount,
            hospitalData.presentCount,
            hospitalData.lateCount,
            hospitalData.absentCount,
            hospitalData.fullPermCount,
            hospitalData.beforePermCount,
            hospitalData.duringPermCount,
            hospitalData.afterPermCount
          ]);
        });
        fileName = 'bao_cao_theo_benh_vien.xlsx';
        sheetName = 'Báo cáo theo bệnh viện';
        break;

      case 'dateReport':
        // Export date report
        const filteredAttendanceForDate = applyFilters(attendanceData);
        const dateStatsForExport = {};
        
        filteredAttendanceForDate.forEach(record => {
          const sessionDate = record.session_date || record.date || record.timestamp || record.session?.date;
          const studentId = record.student_id || record.studentId || record.member?._id;
          const attendanceType = record.status || record.attendance_type;
          
          if (!sessionDate) return;
          
          const dateStr = new Date(sessionDate).toLocaleDateString('vi-VN');
          
          if (!dateStatsForExport[dateStr]) {
            dateStatsForExport[dateStr] = {
              date: dateStr,
              totalSessions: new Set(),
              totalStudents: new Set(),
              fullCount: 0,
              beforeCount: 0,
              duringCount: 0,
              afterCount: 0,
              presentCount: 0,
              lateCount: 0,
              absentCount: 0,
              fullPermCount: 0,
              beforePermCount: 0,
              duringPermCount: 0,
              afterPermCount: 0
            };
          }
          
          const sessionId = record.session_id || record.sessionId?._id || record.session?._id;
          if (sessionId) dateStatsForExport[dateStr].totalSessions.add(sessionId);
          if (studentId) dateStatsForExport[dateStr].totalStudents.add(studentId);
          
          if (attendanceType === 'before') dateStatsForExport[dateStr].beforeCount++;
          if (attendanceType === 'during') dateStatsForExport[dateStr].duringCount++;
          if (attendanceType === 'after') dateStatsForExport[dateStr].afterCount++;
          if (attendanceType === 'present') dateStatsForExport[dateStr].presentCount++;
          if (attendanceType === 'late') dateStatsForExport[dateStr].lateCount++;
          if (attendanceType === 'absent') dateStatsForExport[dateStr].absentCount++;
        });
        
        csvData = [
          ['Ngày', 'Tổng số buổi', 'Tổng số SV', 'Đầy đủ', 'Trước', 'Trong', 'Sau', 'Có mặt', 'Đi trễ', 'Vắng', 'Phép cả buổi', 'Phép trước', 'Phép trong', 'Phép sau']
        ];
        Object.values(dateStatsForExport).sort((a, b) => {
          const dateA = new Date(a.date.split('/').reverse().join('-'));
          const dateB = new Date(b.date.split('/').reverse().join('-'));
          return dateB - dateA;
        }).forEach(dateData => {
          csvData.push([
            dateData.date,
            dateData.totalSessions.size,
            dateData.totalStudents.size,
            dateData.fullCount,
            dateData.beforeCount,
            dateData.duringCount,
            dateData.afterCount,
            dateData.presentCount,
            dateData.lateCount,
            dateData.absentCount,
            dateData.fullPermCount,
            dateData.beforePermCount,
            dateData.duringPermCount,
            dateData.afterPermCount
          ]);
        });
        fileName = 'bao_cao_theo_ngay.xlsx';
        sheetName = 'Báo cáo theo ngày';
        break;

      default:
        // Default: export attendance data
        const filteredDefault = applyFilters(attendanceData);
        csvData = [
          ['Họ và tên', 'Lớp', 'Giới tính', 'Email', 'Buổi điểm danh', 'Ngày', 'Giờ điểm danh', 'Phương thức', 'Trạng thái']
        ];
        filteredDefault.forEach(item => {
          csvData.push([
            item.member?.full_name || item.member?.fullName || 'N/A',
            item.member?.class_name || item.member?.class || 'N/A',
            item.member?.gender === 'male' ? 'Nam' : item.member?.gender === 'female' ? 'Nữ' : 'Khác',
            item.member?.email || 'N/A',
            item.sessionId?.name || 'N/A',
            item.timestamp ? new Date(item.timestamp).toLocaleDateString('vi-VN') : 'N/A',
            item.timestamp ? new Date(item.timestamp).toLocaleTimeString('vi-VN') : 'N/A',
            item.method === 'qr' ? 'QR Code' : item.method === 'manual' ? 'Thủ công' : item.method || 'N/A',
            getStatusText(item.status)
          ]);
        });
        break;
    }

    const worksheet = XLSX.utils.aoa_to_sheet(csvData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, fileName);
  };

  // Custom Report Helper Functions
  const availableColumns = [
    { key: 'student_name', label: 'Tên sinh viên' },
    { key: 'student_code', label: 'Mã sinh viên' },
    { key: 'student_email', label: 'Email' },
    { key: 'class_name', label: 'Lớp' },
    { key: 'faculty_name', label: 'Khoa' },
    { key: 'gender', label: 'Giới tính' },
    { key: 'session_title', label: 'Tên buổi học' },
    { key: 'session_date', label: 'Ngày học' },
    { key: 'session_location', label: 'Địa điểm' },
    { key: 'group_name', label: 'Nhóm' },
    { key: 'attendance_type', label: 'Loại điểm danh' },
    { key: 'timestamp', label: 'Thời gian điểm danh' },
    { key: 'minutes_early', label: 'Số phút sớm' },
    { key: 'minutes_late', label: 'Số phút muộn' },
    { key: 'device_mac', label: 'Địa chỉ MAC' },
    { key: 'ip_address', label: 'Địa chỉ IP' }
  ];

  // Column label mapping
  const columnLabels = {
    'student_name': 'Tên sinh viên',
    'student_code': 'Mã SV',
    'student_email': 'Email',
    'class_name': 'Lớp',
    'faculty_name': 'Khoa',
    'gender': 'Giới tính',
    'session_title': 'Tên buổi học',
    'session_date': 'Ngày học',
    'session_location': 'Địa điểm',
    'group_name': 'Nhóm',
    'attendance_type': 'Loại điểm danh',
    'timestamp': 'Thời gian',
    'minutes_early': 'Phút sớm',
    'minutes_late': 'Phút muộn',
    'device_mac': 'MAC',
    'ip_address': 'IP'
  };

  // Weekly stats column label mapping
  const getWeeklyStatsColumnLabel = (columnKey, groupBy) => {
    const labels = {
      'group_key': groupBy === 'faculty' ? 'Khoa' :
                   groupBy === 'location' ? 'Bệnh viện' :
                   groupBy === 'class' ? 'Lớp' :
                   groupBy === 'group' ? 'Nhóm' :
                   'Tên buổi học',
      'sub_group': groupBy === 'faculty' ? 'Bệnh viện' : 'Khoa',
      'week': 'Tuần',
      'student_count': 'Số SV',
      'classes': 'Lớp',
      'session_count': 'Số buổi học',
      'attendance_count': 'Lần điểm danh'
    };
    return labels[columnKey] || columnKey;
  };

  const toggleColumn = (columnKey) => {
    setCustomReportColumns(prev => {
      if (prev.includes(columnKey)) {
        // Don't allow removing all columns
        if (prev.length > 1) {
          return prev.filter(col => col !== columnKey);
        }
        return prev;
      } else {
        return [...prev, columnKey];
      }
    });
  };

  // Helper function to get attendance type label
  const getAttendanceTypeLabel = (attendanceType) => {
    const labels = {
      'before': 'Trước giờ',
      'during': 'Trong giờ',
      'after': 'Sau giờ',
      'early': 'Sớm',
      'late': 'Đi trễ',
      'late_before': 'Đi trễ (Trước)',
      'late_leave': 'Về trễ',
      'absent': 'Vắng',
      'absent_perm': 'Phép cả buổi',
      'absent_before_perm': 'Phép trước giờ',
      'absent_during_perm': 'Phép trong giờ',
      'absent_after_perm': 'Phép sau giờ'
    };
    return labels[attendanceType] || 'Không xác định';
  };

  // Helper function to get badge color for attendance type
  const getAttendanceTypeBadgeColor = (attendanceType) => {
    const colors = {
      'before': 'success',
      'during': 'info',
      'after': 'warning',
      'early': 'success',
      'late': 'warning',
      'late_before': 'warning',
      'late_leave': 'warning',
      'absent': 'danger',
      'absent_perm': 'secondary',
      'absent_before_perm': 'secondary',
      'absent_during_perm': 'secondary',
      'absent_after_perm': 'secondary'
    };
    return colors[attendanceType] || 'secondary';
  };

  const handleCustomReportFilterChange = (key, value) => {
    setCustomReportFilters(prev => ({
      ...prev,
      [key]: value
    }));
    
    // Đồng bộ với weeklyStatsFilters nếu đang ở weekly_stats view
    if (customReportDisplay === 'weekly_stats') {
      setWeeklyStatsFilters(prev => ({
        ...prev,
        [key]: value
      }));
      
      // Đồng bộ weeklyStatsSelectedFilter nếu key tương ứng với groupBy
      if (weeklyStatsGroupBy === 'faculty' && key === 'facultyName') {
        setWeeklyStatsSelectedFilter(value);
      } else if (weeklyStatsGroupBy === 'location' && key === 'location') {
        setWeeklyStatsSelectedFilter(value);
      } else if (weeklyStatsGroupBy === 'class' && key === 'className') {
        setWeeklyStatsSelectedFilter(value);
      } else if (weeklyStatsGroupBy === 'group' && key === 'groupId') {
        setWeeklyStatsSelectedFilter(value);
      }
    }
  };

  const handleCustomReportSort = (field) => {
    setCustomReportFilters(prev => ({
      ...prev,
      sortField: field,
      sortOrder: prev.sortField === field && prev.sortOrder === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Drag and drop handlers for column reordering
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setCustomReportColumns((items) => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleWeeklyStatsDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setWeeklyStatsColumns((items) => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleWeeklyStatsSort = (field) => {
    setWeeklyStatsSortField(field);
    setWeeklyStatsSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  // Sortable header component
  const SortableHeader = ({ id, children, onSort, sortField, sortOrder }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    return (
      <th
        ref={setNodeRef}
        style={style}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span
            {...attributes}
            {...listeners}
            style={{ cursor: 'grab', userSelect: 'none', padding: '2px 4px' }}
            title="Kéo để sắp xếp lại cột"
          >
            <i className="fas fa-grip-vertical" style={{ color: '#999', fontSize: '12px' }}></i>
          </span>
          <span
            onClick={onSort}
            style={{ cursor: 'pointer', flex: 1 }}
            title="Click để sắp xếp"
          >
            {children}
            {sortField === id && (
              <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'} ms-1`}></i>
            )}
          </span>
        </div>
      </th>
    );
  };

  // Helper function to format group name
  const formatGroupName = (groupName) => {
    if (!groupName) return '-';
    
    // If it's a JSON array string, parse and format it
    if (typeof groupName === 'string' && (groupName.startsWith('[') || groupName.startsWith('{'))) {
      try {
        const parsed = JSON.parse(groupName);
        if (Array.isArray(parsed)) {
          // Format array items
          return parsed.map(item => {
            if (typeof item === 'string' && item.startsWith('class:')) {
              return item.replace('class:', 'Lớp ');
            }
            return item;
          }).join(', ');
        }
        return groupName;
      } catch (e) {
        return groupName;
      }
    }
    
    return groupName;
  };

  const exportCustomReportToExcel = async () => {
    try {
      // Show loading indicator
      const exportButton = document.querySelector('.custom-report-btn-success');
      if (exportButton) {
        exportButton.disabled = true;
        exportButton.innerHTML = '<i className="fas fa-spinner fa-spin"></i> Đang xuất...';
      }

      // Fetch all data without pagination limit
      const queryParams = new URLSearchParams({
        page: '1',
        limit: '100000', // Large limit to get all data
        sortField: customReportFilters.sortField,
        sortOrder: customReportFilters.sortOrder,
        ...(customReportFilters.startDate && { startDate: customReportFilters.startDate }),
        ...(customReportFilters.endDate && { endDate: customReportFilters.endDate }),
        ...(customReportFilters.groupId && { groupId: customReportFilters.groupId }),
        ...(customReportFilters.className && { className: customReportFilters.className }),
        ...(customReportFilters.studentName && { studentName: customReportFilters.studentName }),
        ...(customReportFilters.attendanceType && { attendanceType: customReportFilters.attendanceType }),
        ...(customReportFilters.location && { location: customReportFilters.location }),
        ...(customReportFilters.facultyName && { facultyName: customReportFilters.facultyName })
      });

      console.log(`📥 Fetching all data for Excel export: /attendance/custom-report?${queryParams}`);
      const response = await api.get(`/attendance/custom-report?${queryParams}`);
      
      if (!response.data || !response.data.success || !response.data.data || response.data.data.length === 0) {
        alert('Không có dữ liệu để xuất');
        if (exportButton) {
          exportButton.disabled = false;
          exportButton.innerHTML = '<i className="fas fa-file-excel"></i> Xuất Excel';
        }
        return;
      }

      const allData = response.data.data || [];

      // Create column order based on customReportColumns array
      const columnOrder = customReportColumns.map(key => {
        const col = availableColumns.find(c => c.key === key);
        return col ? { key: col.key, label: col.label } : null;
      }).filter(Boolean);

      const exportData = allData.map(record => {
        const row = {};
        // Use columnOrder to maintain the user-defined order
        columnOrder.forEach(col => {
          let value = record[col.key];
          if (col.key === 'session_date' && value) {
            value = formatDate(value);
          } else if (col.key === 'timestamp' && value) {
            value = new Date(value).toLocaleString('vi-VN');
          } else if (col.key === 'attendance_type') {
            const typeMap = {
              'before': 'Trước giờ',
              'during': 'Đúng giờ',
              'after': 'Sau giờ',
              'late': 'Muộn',
              'absent': 'Vắng'
            };
            value = typeMap[value] || value;
          } else if (col.key === 'gender') {
            // Handle gender mapping with various formats
            if (!value || value === null || value === undefined) {
              value = 'Chưa có';
            } else if (value === 'male' || value === 'Male' || value === 'Nam') {
              value = 'Nam';
            } else if (value === 'female' || value === 'Female' || value === 'Nữ') {
              value = 'Nữ';
            } else if (value === 'other' || value === 'Khác') {
              value = 'Khác';
            } else {
              value = value || 'Chưa có';
            }
          } else if (col.key === 'group_name') {
            value = formatGroupName(value);
          }
          row[col.label] = value || '';
        });
        return row;
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Báo cáo tùy chỉnh');
      XLSX.writeFile(workbook, `bao-cao-tuy-chinh-${new Date().toISOString().split('T')[0]}.xlsx`);
      
      alert(`Đã xuất thành công ${exportData.length} dòng dữ liệu!`);
    } catch (error) {
      console.error('Error exporting custom report to Excel:', error);
      alert('Có lỗi xảy ra khi xuất file Excel. Vui lòng thử lại.');
    } finally {
      // Restore button
      const exportButton = document.querySelector('.custom-report-btn-success');
      if (exportButton) {
        exportButton.disabled = false;
        exportButton.innerHTML = '<i className="fas fa-file-excel"></i> Xuất Excel';
      }
    }
  };

  // Export chart data to Excel
  const exportChartToExcel = async () => {
    try {
      // Show loading indicator
      const exportButton = document.querySelector('.custom-report-btn-success');
      if (exportButton) {
        exportButton.disabled = true;
        exportButton.innerHTML = '<i className="fas fa-spinner fa-spin"></i> Đang xuất...';
      }

      // Fetch all data without pagination limit to ensure accurate chart data
      const queryParams = new URLSearchParams({
        page: '1',
        limit: '100000', // Large limit to get all data
        sortField: customReportFilters.sortField,
        sortOrder: customReportFilters.sortOrder,
        ...(customReportFilters.startDate && { startDate: customReportFilters.startDate }),
        ...(customReportFilters.endDate && { endDate: customReportFilters.endDate }),
        ...(customReportFilters.groupId && { groupId: customReportFilters.groupId }),
        ...(customReportFilters.className && { className: customReportFilters.className }),
        ...(customReportFilters.studentName && { studentName: customReportFilters.studentName }),
        ...(customReportFilters.attendanceType && { attendanceType: customReportFilters.attendanceType }),
        ...(customReportFilters.location && { location: customReportFilters.location }),
        ...(customReportFilters.facultyName && { facultyName: customReportFilters.facultyName })
      });

      console.log(`📥 Fetching all data for chart Excel export: /attendance/custom-report?${queryParams}`);
      const response = await api.get(`/attendance/custom-report?${queryParams}`);
      
      if (!response.data || !response.data.success || !response.data.data || response.data.data.length === 0) {
        alert('Không có dữ liệu để xuất');
        if (exportButton) {
          exportButton.disabled = false;
          exportButton.innerHTML = '<i className="fas fa-file-excel"></i> Xuất Excel';
        }
        return;
      }

      const allData = response.data.data || [];

      // Prepare chart data based on attendance type from all data
      const attendanceTypeCounts = {};
      allData.forEach(record => {
        const type = record.attendance_type || 'unknown';
        attendanceTypeCounts[type] = (attendanceTypeCounts[type] || 0) + 1;
      });

      const typeMap = {
        'before': 'Trước giờ',
        'during': 'Đúng giờ',
        'after': 'Sau giờ',
        'late': 'Muộn',
        'absent': 'Vắng'
      };

      const exportData = Object.keys(attendanceTypeCounts).map(key => ({
        'Loại điểm danh': typeMap[key] || key,
        'Số lượng': attendanceTypeCounts[key]
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Biểu đồ phân tích');
      XLSX.writeFile(workbook, `bieu-do-phan-tich-${new Date().toISOString().split('T')[0]}.xlsx`);
      
      alert(`Đã xuất thành công! Tổng số: ${allData.length} bản ghi, ${exportData.length} loại điểm danh.`);
    } catch (error) {
      console.error('Error exporting chart to Excel:', error);
      alert('Có lỗi xảy ra khi xuất file Excel. Vui lòng thử lại.');
    } finally {
      // Restore button
      const exportButton = document.querySelector('.custom-report-btn-success');
      if (exportButton) {
        exportButton.disabled = false;
        exportButton.innerHTML = '<i className="fas fa-file-excel"></i> Xuất Excel';
      }
    }
  };

  // Export weekly statistics to Excel with details
  const exportWeeklyStatsToExcel = async () => {
    if (!weeklyStatsData || weeklyStatsData.length === 0) {
      alert('Không có dữ liệu để xuất');
      return;
    }

    try {
      // Show loading indicator
      const exportButton = document.querySelector('.custom-report-btn-success');
      if (exportButton) {
        exportButton.disabled = true;
        exportButton.innerHTML = '<i className="fas fa-spinner fa-spin"></i> Đang xuất...';
      }

      // Note: This may take a while as it fetches details for all rows
      const groupByLabel = {
        'faculty': 'Khoa',
        'location': 'Bệnh viện',
        'class': 'Lớp',
        'group': 'Nhóm',
        'session_title': 'Tên buổi học'
      };

      // Create summary sheet with column order from weeklyStatsColumns
      const columnMapping = {
        'group_key': groupByLabel[weeklyStatsGroupBy] || 'Nhóm',
        'sub_group': weeklyStatsGroupBy === 'faculty' ? 'Bệnh viện' : 'Khoa',
        'week': 'Tuần',
        'student_count': 'Số sinh viên',
        'classes': 'Số lớp',
        'session_count': 'Số buổi học',
        'attendance_count': 'Lần điểm danh'
      };

      // Use sorted data to match what's displayed in the table
      const dataToExport = sortedWeeklyStatsData.length > 0 ? sortedWeeklyStatsData : weeklyStatsData;

      const summaryData = dataToExport.map((stat, index) => {
        const row = { 'STT': index + 1 };
        // Use weeklyStatsColumns order to maintain user-defined column order
        weeklyStatsColumns.forEach(columnKey => {
          const label = columnMapping[columnKey] || columnKey;
          switch (columnKey) {
            case 'group_key':
              row[label] = stat.group_key || '-';
              break;
            case 'sub_group':
              row[label] = stat.sub_group || '-';
              break;
            case 'week':
              row[label] = `${new Date(stat.week_start).toLocaleDateString('vi-VN')} - ${new Date(stat.week_end).toLocaleDateString('vi-VN')}`;
              break;
            case 'student_count':
              row[label] = stat.student_count || 0;
              break;
            case 'classes':
              row[label] = stat.classes ? stat.classes.length : 0;
              break;
            case 'session_count':
              row[label] = stat.session_count || 0;
              break;
            case 'attendance_count':
              row[label] = stat.attendance_count || 0;
              break;
            default:
              row[label] = '-';
          }
        });
        return row;
      });

      // Fetch details for all stats (use sorted data to match display order)
      const allDetailData = [];
      
      for (const stat of dataToExport) {
        try {
          const weekStart = new Date(stat.week_start).toISOString().split('T')[0];
          const weekEnd = new Date(stat.week_end).toISOString().split('T')[0];

          const queryParams = new URLSearchParams({
            groupBy: weeklyStatsGroupBy,
            groupKey: stat.group_key,
            subGroup: stat.sub_group || '',
            weekStart,
            weekEnd
          });

          const response = await api.get(`/attendance/weekly-statistics/detail?${queryParams}`);
          
          if (response.data && response.data.success && response.data.data) {
            // Add group info to each detail record
            const details = response.data.data.map(record => ({
              'Nhóm thống kê': stat.group_key || '-',
              'Khoa/Bệnh viện': stat.sub_group || '-',
              'Tuần': `${new Date(stat.week_start).toLocaleDateString('vi-VN')} - ${new Date(stat.week_end).toLocaleDateString('vi-VN')}`,
              'Mã SV': record.student_code || '',
              'Họ và tên': record.student_name || '',
              'Email': record.student_email || '',
              'Lớp': record.class_name || '',
              'Khoa': record.faculty_name || '',
              'Giới tính': record.gender === 'male' ? 'Nam' : record.gender === 'female' ? 'Nữ' : 'Khác',
              'Tên buổi học': record.session_title || '',
              'Ngày học': record.session_date ? formatDate(record.session_date) : '',
              'Địa điểm': record.session_location || '',
              'Nhóm': formatGroupName(record.group_name),
              'Loại điểm danh': getAttendanceTypeLabel(record.attendance_type),
              'Thời gian điểm danh': record.timestamp ? new Date(record.timestamp).toLocaleString('vi-VN') : ''
            }));
            
            allDetailData.push(...details);
          }
        } catch (error) {
          console.error(`Error fetching details for stat ${stat.group_key}:`, error);
          // Continue with other stats even if one fails
        }
      }

      // Create workbook with multiple sheets
      const workbook = XLSX.utils.book_new();
      
      // Add summary sheet
      const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Tổng quan');
      
      // Add details sheet
      if (allDetailData.length > 0) {
        const detailWorksheet = XLSX.utils.json_to_sheet(allDetailData);
        XLSX.utils.book_append_sheet(workbook, detailWorksheet, 'Chi tiết');
      }

      // Save file
      const filename = `thong-ke-theo-tuan-${weeklyStatsGroupBy}-${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, filename);
      
      alert(`Đã xuất file Excel thành công!\n- Tổng quan: ${summaryData.length} dòng\n- Chi tiết: ${allDetailData.length} dòng`);
    } catch (error) {
      console.error('Error exporting weekly statistics:', error);
      alert('Có lỗi xảy ra khi xuất file Excel. Vui lòng thử lại.');
    } finally {
      // Restore button
      const exportButton = document.querySelector('.custom-report-btn-success');
      if (exportButton) {
        exportButton.disabled = false;
        exportButton.innerHTML = '<i className="fas fa-file-excel"></i> Xuất Excel';
      }
    }
  };

  const renderCustomReportChart = () => {
    if (!customReportData || customReportData.length === 0) {
      return (
        <div className="text-center py-5">
          <i className="fas fa-chart-bar fa-3x text-muted mb-3"></i>
          <p className="text-muted">Không có dữ liệu để hiển thị biểu đồ</p>
        </div>
      );
    }

    // Prepare chart data based on attendance type
    const attendanceTypeCounts = {};
    customReportData.forEach(record => {
      const type = record.attendance_type || 'unknown';
      attendanceTypeCounts[type] = (attendanceTypeCounts[type] || 0) + 1;
    });

    const typeMap = {
      'before': 'Trước giờ',
      'during': 'Đúng giờ',
      'after': 'Sau giờ',
      'late': 'Muộn',
      'absent': 'Vắng'
    };

    const labels = Object.keys(attendanceTypeCounts).map(key => typeMap[key] || key);
    const data = Object.values(attendanceTypeCounts);

    const chartColors = {
      'before': '#28a745',
      'during': '#17a2b8',
      'after': '#ffc107',
      'late': '#fd7e14',
      'absent': '#dc3545'
    };

    const backgroundColors = Object.keys(attendanceTypeCounts).map(key => chartColors[key] || '#6c757d');

    const chartDataConfig = {
      labels,
      datasets: [{
        label: 'Số lượng',
        data,
        backgroundColor: customReportDisplay === 'doughnut' ? backgroundColors : backgroundColors.map(c => c + '80'),
        borderColor: backgroundColors,
        borderWidth: 2
      }]
    };

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        title: {
          display: true,
          text: 'Phân bố loại điểm danh'
        }
      }
    };

    switch (customReportDisplay) {
      case 'bar':
        return (
          <div style={{ height: '400px' }}>
            <Bar data={chartDataConfig} options={chartOptions} />
          </div>
        );
      case 'line':
        return (
          <div style={{ height: '400px' }}>
            <Line data={chartDataConfig} options={chartOptions} />
          </div>
        );
      case 'doughnut':
        return (
          <div style={{ height: '400px', maxWidth: '500px', margin: '0 auto' }}>
            <Doughnut data={chartDataConfig} options={chartOptions} />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <AdminNavbar />
      <Container fluid className="session-main-container">
        {/* Header Section */}
        <div className="session-header">
          <div className="header-content">
            <div className="header-title">
              <h1>Báo cáo điểm danh chi tiết</h1>
              <p className="header-subtitle">Theo dõi và phân tích dữ liệu điểm danh sinh viên</p>
            </div>
            <div className="header-actions">
                <Button 
                variant="outline-light" 
                className="create-session-btn"
                  onClick={() => setShowFilters(!showFilters)}
                >
                <i className="fas fa-filter"></i>
                  {showFilters ? "Ẩn bộ lọc" : "Hiện bộ lọc"}
                </Button>
              <Button 
                variant="outline-light" 
                className="create-session-btn"
                onClick={exportCurrentTab}
              >
                <i className="fas fa-file-export"></i>
                Xuất báo cáo
              </Button>
            </div>
              </div>
            </div>
            
            {/* Alerts for success and error messages */}
            <div style={{ position: 'fixed', top: '70px', right: '20px', zIndex: 2000, minWidth: '300px', maxWidth: '400px' }}>
              {error && (
                <Alert 
                  variant="danger" 
                  className="mb-2 shadow"
                  onClose={() => setError(null)}
                  dismissible
                >
                  {error}
                </Alert>
              )}
            </div>
            
            {/* Filters section */}
            {showFilters && (
          <div className="session-list-controls">
            <div className="search-controls" style={{ width: '80%', display: 'block' }}>
              
              <Row className="g-3 align-items-center justify-content-between">
                <Col md={3}>
                  <select
                    className="filter-select"
                    value={selectedGroup}
                    onChange={(e) => {
                      const groupId = e.target.value;
                      setSelectedGroup(groupId);
                      setDateRange({ startDate: '', endDate: '' });
                    }}
                  >
                    <option value="">Tất cả nhóm</option>
                    {groups.map(group => (
                      <option key={group.id || group._id} value={group.id || group._id}>
                        {group.group_name || group.name} {group.semester ? `HK${group.semester}` : ''}
                      </option>
                    ))}
                  </select>
                </Col>

                <Col md={3}>
                  <select
                    className="filter-select"
                    value={classFilter}
                    onChange={(e) => setClassFilter(e.target.value)}
                  >
                    <option value="">Tất cả lớp</option>
                    {Array.from(new Set(attendanceData.map(record => record.class_name).filter(Boolean)))
                      .sort()
                      .map(className => (
                        <option key={className} value={className}>
                          {className}
                        </option>
                      ))}
                  </select>
                </Col>

                <Col md={3}>
                  <select
                    className="filter-select"
                    value={dateRange.startDate ? "custom" : "all"}
                    onChange={(e) => {
                      if (e.target.value === "all") {
                        setDateRange({ startDate: '', endDate: '' });
                      } else if (e.target.value === "today") {
                        const today = new Date().toISOString().split('T')[0];
                        setDateRange({ startDate: today, endDate: today });
                        setSelectedGroup('');
                      } else if (e.target.value === "thisWeek") {
                        const today = new Date();
                        const startOfWeek = new Date(today);
                        startOfWeek.setDate(today.getDate() - today.getDay());
                        const endOfWeek = new Date(today);
                        endOfWeek.setDate(today.getDate() + (6 - today.getDay()));
                        setDateRange({ 
                          startDate: startOfWeek.toISOString().split('T')[0], 
                          endDate: endOfWeek.toISOString().split('T')[0] 
                        });
                        setSelectedGroup('');
                      } else if (e.target.value === "thisMonth") {
                        const today = new Date();
                        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                        setDateRange({ 
                          startDate: startOfMonth.toISOString().split('T')[0], 
                          endDate: endOfMonth.toISOString().split('T')[0] 
                        });
                        setSelectedGroup('');
                      } else if (e.target.value === "custom") {
                        const today = new Date().toISOString().split('T')[0];
                        setDateRange({ startDate: today, endDate: today });
                        setSelectedGroup('');
                      }
                    }}
                    disabled={!!selectedGroup}
                  >
                    <option value="all">Tất cả thời gian</option>
                    <option value="today">Hôm nay</option>
                    <option value="thisWeek">Tuần này</option>
                    <option value="thisMonth">Tháng này</option>
                    <option value="custom">Tùy chọn</option>
                  </select>
                  {dateRange.startDate && (
                    <div className="d-flex gap-2 mt-2">
                      <input
                        type="date"
                        className="filter-select"
                        value={dateRange.startDate}
                        onChange={(e) => {
                          setDateRange(prev => ({
                            ...prev,
                            startDate: e.target.value
                          }));
                        }}
                        disabled={!!selectedGroup}
                      />
                      <span className="align-self-center" style={{ fontSize: '14px', color: '#6c757d' }}>đến</span>
                      <input
                        type="date"
                        className="filter-select"
                        value={dateRange.endDate}
                        onChange={(e) => {
                          setDateRange(prev => ({
                            ...prev,
                            endDate: e.target.value
                          }));
                        }}
                        disabled={!!selectedGroup}
                      />
                    </div>
                  )}
                </Col>

                <Col md={3}>
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Tìm kiếm..."
                    value={nameFilter}
                    onChange={(e) => setNameFilter(e.target.value)}
                  />
                </Col>
              </Row>
                        </div>
                        </div>
        )}
            
            
            
        {/* Tab Navigation */}
        {!loading && (
          <div className="tab-navigation">
            <Tabs
              activeKey={activeTab}
              onSelect={(k) => {
                setActiveTab(k);
                // Reset pagination when switching tabs
                setDetailedListPage(1);
                setClassReportPage(1);
                setHospitalReportPage(1);
                setDateReportPage(1);
                setSessionReportPage(1);
              }}
              className="custom-tabs"
            >
              <Tab eventKey="statusDistribution" title={
                <span className="tab-title">
                  <i className="fas fa-chart-pie"></i>
                  Biểu đồ
                </span>
              }>
                <div className="session-table-container">
                  <Row>
                    <Col md={6} className="mb-4">
                      <div className="chart-card">
                        <div className="chart-header">
                          <h6 className="mb-0">
                            <i className="fas fa-chart-pie me-2"></i>
                            Biểu đồ tròn - Phân bố trạng thái
                          </h6>
                        </div>
                        <div className="chart-body">
                          {stats && (
                      <Doughnut 
                        data={{
                          labels: [
                            'Có mặt đầy đủ', 
                            getAttendanceTypeLabel('before'),
                            getAttendanceTypeLabel('during'),
                            getAttendanceTypeLabel('after'),
                            getAttendanceTypeLabel('early'),
                            getAttendanceTypeLabel('late'),
                            getAttendanceTypeLabel('late_before'),
                            getAttendanceTypeLabel('late_leave'),
                            getAttendanceTypeLabel('absent'),
                            getAttendanceTypeLabel('absent_perm'),
                            getAttendanceTypeLabel('absent_before_perm'),
                            getAttendanceTypeLabel('absent_during_perm'),
                            getAttendanceTypeLabel('absent_after_perm')
                          ],
                          datasets: [
                            {
                              data: [
                                      stats.fullAttendance || 0,
                                      stats.beforeAttendance || 0,
                                      stats.duringAttendance || 0,
                                      stats.afterAttendance || 0,
                                      stats.earlyAttendance || 0,
                                      stats.lateAttendance || 0,
                                      stats.lateBeforeAttendance || 0,
                                      stats.lateLeave || 0,
                                      stats.absent || 0,
                                      stats.absentWithPermission || 0,
                                      stats.earlyPermission || 0,
                                      stats.duringPermission || 0,
                                      stats.latePermission || 0
                              ],
                              backgroundColor: [
                                      'rgba(40, 167, 69, 0.9)',   // full - green
                                      'rgba(52, 211, 153, 0.9)',  // before - emerald
                                      'rgba(59, 130, 246, 0.9)',  // during - blue
                                      'rgba(251, 191, 36, 0.9)',  // after - amber
                                      'rgba(16, 185, 129, 0.9)',  // early - teal
                                      'rgba(251, 146, 60, 0.9)',  // late - orange
                                      'rgba(249, 115, 22, 0.9)',  // late_before - orange dark
                                      'rgba(234, 88, 12, 0.9)',   // late_leave - orange darker
                                      'rgba(239, 68, 68, 0.9)',   // absent - red
                                      'rgba(156, 163, 175, 0.9)', // absent_perm - gray
                                      'rgba(139, 92, 246, 0.9)',  // absent_before_perm - violet
                                      'rgba(167, 139, 250, 0.9)', // absent_during_perm - purple
                                      'rgba(236, 72, 153, 0.9)'   // absent_after_perm - pink
                                    ],
                                    borderWidth: 2,
                                    borderColor: '#fff'
                            }
                          ]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          aspectRatio: 1,
                          plugins: {
                            legend: {
                              position: 'right',
                              labels: {
                                boxWidth: 12,
                                padding: 10,
                                font: {
                                  size: 11
                                },
                                generateLabels: (chart) => {
                                  const data = chart.data;
                                  if (data.labels.length && data.datasets.length) {
                                    return data.labels.map((label, i) => {
                                      const value = data.datasets[0].data[i];
                                      return {
                                        text: `${label}: ${value}`,
                                        fillStyle: data.datasets[0].backgroundColor[i],
                                        hidden: false,
                                        index: i
                                      };
                                    });
                                  }
                                  return [];
                                }
                              }
                            },
                            tooltip: {
                              callbacks: {
                                label: (context) => {
                                  const label = context.label || '';
                                  const value = context.parsed || 0;
                                  const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                  const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                  return `${label}: ${value} (${percentage}%)`;
                                }
                              }
                            }
                          },
                          layout: {
                            padding: {
                              top: 10,
                              bottom: 10,
                              left: 10,
                              right: 10
                            }
                          }
                        }}
                      />
                          )}
                        </div>
                      </div>
                    </Col>
                    
                    <Col md={6} className="mb-4">
                      <div className="chart-card">
                        <div className="chart-header">
                          <h6 className="mb-0">
                            <i className="fas fa-chart-bar me-2"></i>
                            Biểu đồ cột - So sánh số lượng
                          </h6>
                        </div>
                        <div className="chart-body">
                          {stats && (
                            <Bar 
                              data={{
                                labels: [
                                  'Đầy đủ', 
                                  'Trước giờ',
                                  'Trong giờ',
                                  'Sau giờ',
                                  'Sớm',
                                  'Đi trễ',
                                  'Về trễ',
                                  'Vắng',
                                  'Phép'
                                ],
                                datasets: [
                                  {
                                    label: 'Số lượng sinh viên',
                                    data: [
                                      stats.fullAttendance || 0,
                                      stats.beforeAttendance || 0,
                                      stats.duringAttendance || 0,
                                      stats.afterAttendance || 0,
                                      stats.earlyAttendance || 0,
                                      stats.lateAttendance || 0,
                                      stats.lateLeave || 0,
                                      stats.absent || 0,
                                      (stats.absentWithPermission || 0) + (stats.earlyPermission || 0) + (stats.duringPermission || 0) + (stats.latePermission || 0)
                                    ],
                                    backgroundColor: [
                                      'rgba(40, 167, 69, 0.8)',   // full
                                      'rgba(52, 211, 153, 0.8)',  // before
                                      'rgba(59, 130, 246, 0.8)',  // during
                                      'rgba(251, 191, 36, 0.8)',  // after
                                      'rgba(16, 185, 129, 0.8)',  // early
                                      'rgba(251, 146, 60, 0.8)',  // late
                                      'rgba(234, 88, 12, 0.8)',   // late_leave
                                      'rgba(239, 68, 68, 0.8)',   // absent
                                      'rgba(156, 163, 175, 0.8)'  // permission
                                    ],
                                    borderColor: [
                                      'rgb(40, 167, 69)',
                                      'rgb(52, 211, 153)',
                                      'rgb(59, 130, 246)',
                                      'rgb(251, 191, 36)',
                                      'rgb(16, 185, 129)',
                                      'rgb(251, 146, 60)',
                                      'rgb(234, 88, 12)',
                                      'rgb(239, 68, 68)',
                                      'rgb(156, 163, 175)'
                                    ],
                                    borderWidth: 2
                                  }
                                ]
                              }}
                              options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                aspectRatio: 1.5,
                                plugins: {
                                  legend: {
                                    display: false
                                  },
                                  tooltip: {
                                    callbacks: {
                                      label: (context) => {
                                        const value = context.parsed.y || 0;
                                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                        const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                        return `Số lượng: ${value} (${percentage}%)`;
                                      }
                                    }
                                  }
                                },
                                scales: {
                                  y: {
                                    beginAtZero: true,
                                    ticks: {
                                      maxTicksLimit: 10,
                                      precision: 0
                                    },
                                    grid: {
                                      color: 'rgba(0, 0, 0, 0.1)'
                                    }
                                  },
                                  x: {
                                    grid: {
                                      display: false
                                    }
                                  }
                                },
                                layout: {
                                  padding: {
                                    top: 10,
                                    bottom: 10,
                                    left: 10,
                                    right: 10
                                  }
                                }
                              }}
                            />
                          )}
                        </div>
                      </div>
                    </Col>
                  </Row>
                  
                  <Row>
                    <Col md={6} className="mb-4">
                      <div className="chart-card">
                        <div className="chart-header">
                          <h6 className="mb-0">
                            <i className="fas fa-chart-area me-2"></i>
                            Biểu đồ Polar Area - Tổng quan
                          </h6>
                        </div>
                        <div className="chart-body">
                          {stats && (
                            <PolarArea 
                              data={{
                                labels: [
                                  'Đầy đủ', 
                                  'Trước giờ',
                                  'Trong giờ',
                                  'Sau giờ',
                                  'Đi trễ',
                                  'Về trễ',
                                  'Vắng',
                                  'Phép'
                                ],
                              datasets: [
                                {
                                  label: 'Số lượng',
                                  data: [
                                    stats.fullAttendance || 0,
                                    stats.beforeAttendance || 0,
                                    stats.duringAttendance || 0,
                                    stats.afterAttendance || 0,
                                    stats.lateAttendance || 0,
                                    stats.lateLeave || 0,
                                    stats.absent || 0,
                                    (stats.absentWithPermission || 0) + (stats.earlyPermission || 0) + (stats.duringPermission || 0) + (stats.latePermission || 0)
                                  ],
                                  backgroundColor: [
                                    'rgba(40, 167, 69, 0.7)',   // full
                                    'rgba(52, 211, 153, 0.7)',  // before
                                    'rgba(59, 130, 246, 0.7)',  // during
                                    'rgba(251, 191, 36, 0.7)',  // after
                                    'rgba(251, 146, 60, 0.7)',  // late
                                    'rgba(234, 88, 12, 0.7)',   // late_leave
                                    'rgba(239, 68, 68, 0.7)',   // absent
                                    'rgba(156, 163, 175, 0.7)'  // permission
                                  ],
                                  borderColor: [
                                    'rgb(40, 167, 69)',
                                    'rgb(52, 211, 153)',
                                    'rgb(59, 130, 246)',
                                    'rgb(251, 191, 36)',
                                    'rgb(251, 146, 60)',
                                    'rgb(234, 88, 12)',
                                    'rgb(239, 68, 68)',
                                    'rgb(156, 163, 175)'
                                  ],
                                  borderWidth: 2
                                }
                              ]
                            }}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              aspectRatio: 1,
                              plugins: {
                                legend: {
                                  position: 'right',
                                  labels: {
                                    boxWidth: 12,
                                    padding: 10,
                                    font: {
                                      size: 11
                                    }
                                  }
                                },
                                tooltip: {
                                  callbacks: {
                                    label: (context) => {
                                      const value = context.parsed.r || 0;
                                      const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                      const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                      return `${context.label}: ${value} (${percentage}%)`;
                                    }
                                  }
                                }
                              },
                              scales: {
                                r: {
                                  beginAtZero: true,
                                  ticks: {
                                    maxTicksLimit: 8,
                                    precision: 0
                                  }
                                }
                              },
                              layout: {
                                padding: {
                                  top: 10,
                                  bottom: 10,
                                  left: 10,
                                  right: 10
                                }
                              }
                            }}
                          />
                          )}
                        </div>
                      </div>
                    </Col>
                    
                    <Col md={6} className="mb-4">
                      <div className="chart-card">
                        <div className="chart-header">
                          <h6 className="mb-0">
                            <i className="fas fa-broadcast-tower me-2"></i>
                            Biểu đồ Radar - Phân tích đa chiều
                          </h6>
                        </div>
                        <div className="chart-body">
                          {stats && (
                            <Radar 
                            data={{
                              labels: [
                                'Đầy đủ', 
                                'Trước',
                                'Trong',
                                'Sau',
                                'Sớm',
                                'Trễ',
                                'Về trễ',
                                'Vắng'
                              ],
                              datasets: [
                                {
                                  label: 'Điểm danh hiện tại',
                                  data: [
                                    stats.fullAttendance || 0,
                                    stats.beforeAttendance || 0,
                                    stats.duringAttendance || 0,
                                    stats.afterAttendance || 0,
                                    stats.earlyAttendance || 0,
                                    stats.lateAttendance || 0,
                                    stats.lateLeave || 0,
                                    stats.absent || 0
                                  ],
                                  backgroundColor: 'rgba(59, 130, 246, 0.3)',
                                  borderColor: 'rgb(59, 130, 246)',
                                  borderWidth: 2,
                                  pointBackgroundColor: 'rgb(59, 130, 246)',
                                  pointBorderColor: '#fff',
                                  pointHoverBackgroundColor: '#fff',
                                  pointHoverBorderColor: 'rgb(59, 130, 246)'
                                },
                                {
                                  label: 'Mục tiêu (Lý tưởng)',
                                  data: [
                                    Math.max(stats.fullAttendance || 0, 50),
                                    Math.max(stats.beforeAttendance || 0, 30),
                                    Math.max(stats.duringAttendance || 0, 40),
                                    Math.max(stats.afterAttendance || 0, 30),
                                    Math.max(stats.earlyAttendance || 0, 20),
                                    5, // target late
                                    5, // target late_leave
                                    5  // target absent
                                  ],
                                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                  borderColor: 'rgb(16, 185, 129)',
                                  borderWidth: 2,
                                  borderDash: [5, 5],
                                  pointBackgroundColor: 'rgb(16, 185, 129)',
                                  pointBorderColor: '#fff',
                                  pointHoverBackgroundColor: '#fff',
                                  pointHoverBorderColor: 'rgb(16, 185, 129)'
                                }
                              ]
                            }}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              aspectRatio: 1,
                              plugins: {
                                legend: {
                                  position: 'top',
                                  labels: {
                                    padding: 15,
                                    font: {
                                      size: 12
                                    }
                                  }
                                },
                                tooltip: {
                                  callbacks: {
                                    label: (context) => {
                                      return `${context.dataset.label}: ${context.parsed.r}`;
                                    }
                                  }
                                }
                              },
                              scales: {
                                r: {
                                  beginAtZero: true,
                                  angleLines: {
                                    color: 'rgba(0, 0, 0, 0.1)'
                                  },
                                  grid: {
                                    color: 'rgba(0, 0, 0, 0.1)'
                                  },
                                  pointLabels: {
                                    font: {
                                      size: 11
                                    }
                                  },
                                  ticks: {
                                    maxTicksLimit: 8,
                                    precision: 0
                                  }
                                }
                              },
                              layout: {
                                padding: {
                                  top: 10,
                                  bottom: 10,
                                  left: 10,
                                  right: 10
                                }
                              }
                            }}
                          />
                          )}
                        </div>
                      </div>
                    </Col>
                  </Row>

                </div>
              </Tab>
              
              <Tab eventKey="detailedList" title={
                <span className="tab-title">
                  <i className="fas fa-list-check"></i>
                  Chi tiết
                </span>
              }>
                <div className="session-table-container">

                  
                      {loadingMembers ? (
                        <div className="text-center py-5">
                          <Spinner animation="border" variant="primary" />
                      <p className="mt-3">Đang tải dữ liệu sinh viên...</p>
                        </div>
                      ) : !detailedMembers || !Array.isArray(detailedMembers) || detailedMembers.length === 0 ? (
                        <div className="text-center py-5">
                      <i className="fas fa-exclamation-circle fa-3x text-warning mb-3"></i>
                      <p className="text-muted">Không có sinh viên nào trong hệ thống.</p>
                        </div>
                      ) : (
                    <>
                    <div className="table-responsive">
                      <table className="session-table">
                        <thead>
                          <tr>
                            <th>#</th>
                                  <th>Họ và tên</th>
                            <th>Lớp</th>
                                  <th>Tên buổi học</th>
                                  <th>Giới tính</th>
                            <th>Email</th>
                            <th>Trạng thái điểm danh</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(() => {
                                  const filteredMembers = applyFilters(detailedMembers);
                                  const startIndex = (detailedListPage - 1) * itemsPerPage;
                                  const endIndex = startIndex + itemsPerPage;
                                  const paginatedMembers = filteredMembers.slice(startIndex, endIndex);
                                  return paginatedMembers.map((member, index) => {
                                    return (
                                  <tr key={startIndex + index}>
                              <td>{startIndex + index + 1}</td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="member-avatar">
                                    <i className="fas fa-user"></i>
                                  </div>
                                  <div>
                                    <div className="fw-bold">{member.fullName || 'N/A'}</div>
                                    <small className="text-muted">MSSV: {member.student_id || 'N/A'}</small>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <Badge bg="primary">{member.class || 'N/A'}</Badge>
                              </td>
                              <td>
                                <Badge bg="info">
                                  {member.sessionInfo?.title || member.groupName || 'N/A'}
                                </Badge>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                      {member.gender === 'male' ? 
                                    <><i className="fas fa-mars text-primary me-2"></i> Nam</> : 
                                      member.gender === 'female' ? 
                                    <><i className="fas fa-venus text-danger me-2"></i> Nữ</> : 
                                    <><i className="fas fa-genderless text-secondary me-2"></i> Khác</>}
                                </div>
                                    </td>
                                    <td>
                                <small className="text-muted">{member.email || 'N/A'}</small>
                              </td>
                                <td>
                                  {(() => {
                                   // Lấy tất cả các loại điểm danh từ attendanceData
                                   const attendanceTypes = new Set();
                                   const badges = [];
                                   
                                   // Thêm loại điểm danh hiện tại
                                   if (member.attendanceStatus) {
                                     attendanceTypes.add(member.attendanceStatus);
                                   }
                                   
                                   // Thêm các loại từ attendanceData nếu có
                                   if (member.attendanceData && Array.isArray(member.attendanceData)) {
                                     member.attendanceData.forEach(record => {
                                       if (record.attendance_type) {
                                         attendanceTypes.add(record.attendance_type);
                                       }
                                     });
                                   }
                                   
                                   // Kiểm tra các loại điểm danh có sẵn
                                   const hasBeforeAttendance = attendanceTypes.has('before');
                                   const hasDuringAttendance = attendanceTypes.has('during');
                                   const hasAfterAttendance = attendanceTypes.has('after');
                                   const hasLateAttendance = attendanceTypes.has('late');
                                   const hasEarlyAttendance = attendanceTypes.has('early');
                                   const hasLateLeaveAttendance = attendanceTypes.has('late_leave');
                                   
                                   // Tìm bản ghi đi trễ nếu có
                                   const lateRecord = member.attendanceData?.find(r => r.attendance_type === 'late') || 
                                                     (member.attendanceStatus === 'late' ? member : null);
                                   
                                   // Kiểm tra các trường hợp thiếu điểm danh
                                   const missingBefore = !hasBeforeAttendance && !hasEarlyAttendance;
                                   const missingDuring = !hasDuringAttendance;
                                   const missingAfter = !hasAfterAttendance && !hasLateLeaveAttendance;
                                   
                                   // Trường hợp 1: Trước - Trong -> Chỉ hiển thị Thiếu Sau
                                   if (hasBeforeAttendance && hasDuringAttendance && !hasAfterAttendance && !hasLateLeaveAttendance && missingAfter) {
                                     badges.push(
                                       <Badge key="missing_after" bg="danger" className="me-1">
                                         <i className="fas fa-times-circle me-1"></i>
                                         Thiếu Sau
                                       </Badge>
                                     );
                                   }
                                   // Trường hợp 2: Trước - Sau -> Chỉ hiển thị Thiếu Trong
                                   else if (hasBeforeAttendance && hasAfterAttendance && !hasDuringAttendance && missingDuring) {
                                     badges.push(
                                       <Badge key="missing_during" bg="danger" className="me-1">
                                         <i className="fas fa-times-circle me-1"></i>
                                         Thiếu Trong
                                       </Badge>
                                     );
                                   }
                                   // Trường hợp 3: Đi trễ - Trong -> Chỉ hiển thị Thiếu Sau + Đi trễ
                                   else if (hasLateAttendance && hasDuringAttendance && !hasAfterAttendance && !hasLateLeaveAttendance && missingAfter) {
                                     badges.push(
                                       <Badge key="missing_after" bg="danger" className="me-1">
                                         <i className="fas fa-times-circle me-1"></i>
                                         Thiếu Sau
                                       </Badge>
                                     );
                                     if (lateRecord) {
                                       badges.push(
                                         <Badge key="late" bg="warning" className="me-1">
                                           <i className="fas fa-hourglass-end me-1"></i>
                                           Đi trễ {lateRecord.minutes_late ? `${lateRecord.minutes_late} phút` : ''}
                                         </Badge>
                                       );
                                     }
                                   }
                                   // Trường hợp 4: Đi trễ - Sau -> Chỉ hiển thị Thiếu Trong + Đi trễ
                                   else if (hasLateAttendance && hasAfterAttendance && !hasDuringAttendance && missingDuring) {
                                     badges.push(
                                       <Badge key="missing_during" bg="danger" className="me-1">
                                         <i className="fas fa-times-circle me-1"></i>
                                         Thiếu Trong
                                       </Badge>
                                     );
                                     if (lateRecord) {
                                       badges.push(
                                         <Badge key="late" bg="warning" className="me-1">
                                           <i className="fas fa-hourglass-end me-1"></i>
                                           Đi trễ {lateRecord.minutes_late ? `${lateRecord.minutes_late} phút` : ''}
                                         </Badge>
                                       );
                                     }
                                   }
                                   // Trường hợp 5: Trong - Sau -> Chỉ hiển thị Thiếu Trước
                                   else if (hasDuringAttendance && hasAfterAttendance && !hasBeforeAttendance && !hasEarlyAttendance && missingBefore) {
                                     badges.push(
                                       <Badge key="missing_before" bg="danger" className="me-1">
                                         <i className="fas fa-times-circle me-1"></i>
                                         Thiếu Trước
                                       </Badge>
                                     );
                                   }
                                   // Trường hợp 6: Trước - Trong - Sau -> Chỉ hiển thị Đầy đủ
                                   else if (hasBeforeAttendance && hasDuringAttendance && (hasAfterAttendance || hasLateLeaveAttendance)) {
                                     badges.push(
                                       <Badge key="full" bg="success" className="me-1">
                                         <i className="fas fa-star me-1"></i>
                                         Đầy đủ
                                       </Badge>
                                     );
                                   }
                                   // Trường hợp 7: Đi trễ - Trong - Sau -> Hiển thị Đầy đủ + Đi trễ
                                   else if (hasLateAttendance && hasDuringAttendance && (hasAfterAttendance || hasLateLeaveAttendance)) {
                                     badges.push(
                                       <Badge key="full" bg="success" className="me-1">
                                         <i className="fas fa-star me-1"></i>
                                         Đầy đủ
                                       </Badge>
                                     );
                                     if (lateRecord) {
                                       badges.push(
                                         <Badge key="late" bg="warning" className="me-1">
                                           <i className="fas fa-hourglass-end me-1"></i>
                                           Đi trễ {lateRecord.minutes_late ? `${lateRecord.minutes_late} phút` : ''}
                                         </Badge>
                                       );
                                     }
                                   }
                                   // Các trường hợp khác: hiển thị từng trạng thái riêng biệt
                                   else {
                                     // Kiểm tra các loại vắng có phép
                                     const hasAbsentPerm = attendanceTypes.has('absent_perm');
                                     const hasAbsentBeforePerm = attendanceTypes.has('absent_before_perm');
                                     const hasAbsentDuringPerm = attendanceTypes.has('absent_during_perm');
                                     const hasAbsentAfterPerm = attendanceTypes.has('absent_after_perm');
                                     
                                     if (hasAbsentPerm) {
                                       badges.push(
                                         <Badge key="absent_perm" bg="danger" className="me-1">
                                           <i className="fas fa-file-alt me-1"></i>
                                           Phép cả buổi
                                         </Badge>
                                       );
                                     } else if (hasAbsentBeforePerm) {
                                       badges.push(
                                         <Badge key="absent_before_perm" bg="info" className="me-1">
                                           <i className="fas fa-file-alt me-1"></i>
                                           Phép trước buổi
                                         </Badge>
                                       );
                                     } else if (hasAbsentDuringPerm) {
                                       badges.push(
                                         <Badge key="absent_during_perm" bg="warning" className="me-1">
                                           <i className="fas fa-file-alt me-1"></i>
                                           Phép trong buổi
                                         </Badge>
                                       );
                                     } else if (hasAbsentAfterPerm) {
                                       badges.push(
                                         <Badge key="absent_after_perm" bg="secondary" className="me-1">
                                           <i className="fas fa-file-alt me-1"></i>
                                           Phép sau buổi
                                         </Badge>
                                       );
                                     } else {
                                       // Nếu không có vắng có phép, hiển thị trạng thái điểm danh bình thường
                                       if (hasBeforeAttendance) {
                                         badges.push(
                                           <Badge key="before" bg="info" className="me-1">
                                             <i className="fas fa-clock me-1"></i>
                                             Có mặt trước
                                           </Badge>
                                         );
                                       }
                                       
                                       if (hasDuringAttendance) {
                                         badges.push(
                                           <Badge key="during" bg="primary" className="me-1">
                                             <i className="fas fa-user-check me-1"></i>
                                             Có mặt trong
                                           </Badge>
                                         );
                                       }
                                       
                                       if (hasAfterAttendance) {
                                         badges.push(
                                           <Badge key="after" bg="success" className="me-1">
                                             <i className="fas fa-check-circle me-1"></i>
                                             Có mặt sau
                                           </Badge>
                                         );
                                       }
                                       
                                       if (hasEarlyAttendance) {
                                         badges.push(
                                           <Badge key="early" bg="secondary" className="me-1">
                                             <i className="fas fa-clock me-1"></i>
                                             Đi sớm
                                           </Badge>
                                         );
                                       }
                                       
                                       if (hasLateAttendance && lateRecord) {
                                         badges.push(
                                           <Badge key="late" bg="warning" className="me-1">
                                             <i className="fas fa-hourglass-end me-1"></i>
                                             Đi trễ {lateRecord.minutes_late ? `${lateRecord.minutes_late} phút` : ''}
                                           </Badge>
                                         );
                                       }
                                       
                                       if (hasLateLeaveAttendance) {
                                         badges.push(
                                           <Badge key="late_leave" bg="dark" className="me-1">
                                             <i className="fas fa-sign-out-alt me-1"></i>
                                             Về trễ
                                           </Badge>
                                         );
                                       }
                                     }
                                   }
                                   
                                   // Nếu không có badge nào, hiển thị trạng thái mặc định
                                   if (badges.length === 0) {
                                     badges.push(
                                       <Badge key="present" bg="success" className="me-1">
                                         <i className="fas fa-check-circle me-1"></i>
                                         Có mặt
                                       </Badge>
                                     );
                                   }
                                   
                                   return badges;
                                })()}
                                {member.attendanceTimestamp && (
                                  <div className="mt-1">
                                    <small className="text-muted">
                                      {new Date(member.attendanceTimestamp).toLocaleString('vi-VN')}
                                    </small>
                                  </div>
                                )}
                              </td>
                              <td>
                                    </td>
                                  </tr>
                                    );
                                  });
                                })()}
                              </tbody>
                      </table>
                          </div>
                          {(() => {
                            const filteredMembers = applyFilters(detailedMembers);
                            return filteredMembers.length > itemsPerPage && (
                              <div className="mt-3">
                                <Pagination
                                  currentPage={detailedListPage}
                                  totalPages={Math.ceil(filteredMembers.length / itemsPerPage)}
                                  onPageChange={setDetailedListPage}
                                />
                              </div>
                            );
                          })()}
                    </>
                      )}
                </div>
                </Tab>
                
              <Tab eventKey="classReport" title={
                <span className="tab-title">
                  <i className="fas fa-graduation-cap"></i>
                  Lớp
                </span>
              }>
                <div className="session-table-container">
                  
                  
                  <div className="table-responsive">
                    <table className="session-table">
                      <thead>
                          <tr>
                            <th>Lớp</th>
                            <th>Tổng số SV</th>
                            <th>Đầy đủ</th>
                            <th>Trước</th>
                            <th>Trong</th>
                            <th>Sau</th>
                            <th>Có mặt</th>
                            <th>Đi trễ</th>
                            <th>Vắng</th>
                            <th>Phép cả buổi</th>
                            <th>Phép trước</th>
                            <th>Phép trong</th>
                            <th>Phép sau</th>
                          </tr>
                        </thead>
                        <tbody>
                        {(() => {
                          // Calculate attendance statistics by class
                          const classSummaries = {};
                          
                          // Use detailedMembers data if attendanceData is empty
                          // Apply filters to attendance data
                          let dataToProcess = applyFilters(attendanceData);
                          
                          // Get absence request stats by class
                          const absenceStatsByClass = {};
                          if (stats.fullSessionApproved !== undefined) {
                            // Extract unique classes from attendance data
                            const uniqueClassesFromData = [...new Set(
                              dataToProcess.map(item => 
                                item.member?.class || item.class_name || item.class || ''
                              ).filter(Boolean)
                            )];
                            const totalClasses = uniqueClassesFromData.length || 1;
                            
                            uniqueClassesFromData.forEach(className => {
                              absenceStatsByClass[className] = {
                                fullSessionApproved: Math.floor(stats.fullSessionApproved / totalClasses),
                                beforeSessionApproved: Math.floor(stats.beforeSessionApproved / totalClasses),
                                duringSessionApproved: Math.floor(stats.duringSessionApproved / totalClasses),
                                afterSessionApproved: Math.floor(stats.afterSessionApproved / totalClasses)
                              };
                            });
                          }
                          if ((!attendanceData || !Array.isArray(attendanceData) || attendanceData.length === 0) && 
                              detailedMembers && Array.isArray(detailedMembers) && detailedMembers.length > 0) {
                            dataToProcess = detailedMembers.map(member => ({
                              member: {
                                _id: member.id,
                                class: member.class,
                                fullName: member.fullName,
                                gender: member.gender,
                                email: member.email,
                                faculty_name: member.faculty_name
                              },
                              status: member.attendanceStatus,
                              attendance_type: member.attendanceStatus,
                              timestamp: member.attendanceTimestamp,
                              faculty_name: member.faculty_name
                            }));
                          }

                          // Function to get students by attendance type for a specific class
                          const getStudentsByAttendanceTypeForClass = (className, attendanceType) => {
                            if (!dataToProcess || !Array.isArray(dataToProcess)) return [];
                            
                            return dataToProcess.filter(record => {
                              const recordClassName = record.member?.class || record.class_name || record.class;
                              if (recordClassName !== className) return false;
                              
                              const studentId = record.member?._id || record.student_id || record.member_id;
                              const recordAttendanceType = record.status || record.attendance_type || record.type;
                              
                              if (!studentId || !recordAttendanceType) return false;
                              
                              // Get all attendance types for this student in this class
                              const studentAttendanceTypes = new Set();
                              dataToProcess.forEach(r => {
                                const rClassName = r.member?.class || r.class_name || r.class;
                                const rStudentId = r.member?._id || r.student_id || r.member_id;
                                const rAttendanceType = r.status || r.attendance_type || r.type;
                                
                                if (rClassName === className && rStudentId === studentId && rAttendanceType) {
                                  studentAttendanceTypes.add(rAttendanceType);
                                }
                              });
                              
                              // Apply the same logic as SessionDetail.js
                              const hasBeforeAttendance = studentAttendanceTypes.has('before');
                              const hasDuringAttendance = studentAttendanceTypes.has('during');
                              const hasAfterAttendance = studentAttendanceTypes.has('after');
                              const hasLateAttendance = studentAttendanceTypes.has('late');
                              const hasEarlyAttendance = studentAttendanceTypes.has('early');
                              const hasLateLeaveAttendance = studentAttendanceTypes.has('late_leave');
                              
                              // Check for absence with permission types
                              const hasAbsentPerm = studentAttendanceTypes.has('absent_perm');
                              const hasAbsentBeforePerm = studentAttendanceTypes.has('absent_before_perm');
                              const hasAbsentDuringPerm = studentAttendanceTypes.has('absent_during_perm');
                              const hasAbsentAfterPerm = studentAttendanceTypes.has('absent_after_perm');
                              
                              // Determine final status based on the same logic
                              if (attendanceType === 'full') {
                                // Trường hợp 1: Có mặt trước + Có mặt trong + Có mặt sau (hoặc Về trễ) → Đầy đủ
                                if ((hasBeforeAttendance && hasDuringAttendance && (hasAfterAttendance || hasLateLeaveAttendance)) ||
                                    (hasEarlyAttendance && hasDuringAttendance && (hasAfterAttendance || hasLateLeaveAttendance))) {
                                  return true;
                                }
                                // Trường hợp 2: Đi trễ + Có mặt trong + Có mặt sau → Đầy đủ và Đi trễ
                                if (hasLateAttendance && hasDuringAttendance && hasAfterAttendance) {
                                  return true;
                                }
                                // Trường hợp 3: Đi trễ + Có mặt trong + Về trễ → Đầy đủ và Đi trễ
                                if (hasLateAttendance && hasDuringAttendance && hasLateLeaveAttendance) {
                                  return true;
                                }
                                // Trường hợp 4: Đi trước (hoặc Có mặt trước) + Có mặt trong + Có mặt sau → Đầy đủ
                                if ((hasEarlyAttendance || hasBeforeAttendance) && hasDuringAttendance && hasAfterAttendance) {
                                  return true;
                                }
                                return false;
                              }
                              
                              if (attendanceType === 'late') {
                                // Check if student has late attendance (either in combination with full or alone)
                                return hasLateAttendance;
                              }
                              
                              if (attendanceType === 'absent_perm') {
                                return hasAbsentPerm;
                              }
                              
                              if (attendanceType === 'absent_before_perm') {
                                return hasAbsentBeforePerm;
                              }
                              
                              if (attendanceType === 'absent_during_perm') {
                                return hasAbsentDuringPerm;
                              }
                              
                              if (attendanceType === 'absent_after_perm') {
                                return hasAbsentAfterPerm;
                              }
                              
                              // For individual types, check if they exist and are not part of full attendance
                              if (attendanceType === 'before') {
                                return hasBeforeAttendance && !(
                                  (hasBeforeAttendance && hasDuringAttendance && (hasAfterAttendance || hasLateLeaveAttendance)) ||
                                  ((hasEarlyAttendance || hasBeforeAttendance) && hasDuringAttendance && hasAfterAttendance)
                                );
                              }
                              
                              if (attendanceType === 'during') {
                                return hasDuringAttendance && !(
                                  (hasBeforeAttendance && hasDuringAttendance && (hasAfterAttendance || hasLateLeaveAttendance)) ||
                                  (hasLateAttendance && hasDuringAttendance && hasAfterAttendance) ||
                                  (hasLateAttendance && hasDuringAttendance && hasLateLeaveAttendance) ||
                                  ((hasEarlyAttendance || hasBeforeAttendance) && hasDuringAttendance && hasAfterAttendance)
                                );
                              }
                              
                              if (attendanceType === 'after') {
                                return hasAfterAttendance && !(
                                  (hasBeforeAttendance && hasDuringAttendance && (hasAfterAttendance || hasLateLeaveAttendance)) ||
                                  (hasLateAttendance && hasDuringAttendance && hasAfterAttendance) ||
                                  ((hasEarlyAttendance || hasBeforeAttendance) && hasDuringAttendance && hasAfterAttendance)
                                );
                              }
                              
                              if (attendanceType === 'early') {
                                return hasEarlyAttendance && !(
                                  (hasEarlyAttendance && hasDuringAttendance && (hasAfterAttendance || hasLateLeaveAttendance)) ||
                                  ((hasEarlyAttendance || hasBeforeAttendance) && hasDuringAttendance && hasAfterAttendance)
                                );
                              }
                              
                              if (attendanceType === 'late_leave') {
                                return hasLateLeaveAttendance && !(
                                  (hasBeforeAttendance && hasDuringAttendance && (hasAfterAttendance || hasLateLeaveAttendance)) ||
                                  (hasLateAttendance && hasDuringAttendance && hasLateLeaveAttendance)
                                );
                              }
                              
                              if (attendanceType === 'present') {
                                return studentAttendanceTypes.has('present') && !studentAttendanceTypes.has('before') && 
                                       !studentAttendanceTypes.has('during') && !studentAttendanceTypes.has('after') &&
                                       !studentAttendanceTypes.has('early') && !studentAttendanceTypes.has('late') &&
                                       !studentAttendanceTypes.has('late_leave') && !studentAttendanceTypes.has('absent');
                              }
                              
                              if (attendanceType === 'absent') {
                                return studentAttendanceTypes.has('absent') && !hasAbsentPerm && !hasAbsentBeforePerm &&
                                       !hasAbsentDuringPerm && !hasAbsentAfterPerm;
                              }
                              
                              return false;
                            }).map(record => ({
                              fullName: record.member?.fullName || record.full_name || record.name,
                              studentId: record.member?._id || record.student_id || record.member_id
                            }));
                          };
                          
                          // Process all attendance data to group by class
                          if (!dataToProcess || !Array.isArray(dataToProcess) || dataToProcess.length === 0) {
                            return (
                              <tr>
                                <td colSpan="13" className="text-center py-4">
                                  <div className="text-muted">
                                    <i className="fas fa-info-circle me-2"></i>
                                    Không có dữ liệu điểm danh để hiển thị báo cáo theo lớp
                                  </div>
                                </td>
                              </tr>
                            );
                          }
                          
                          dataToProcess.forEach(record => {
                            const className = record.member?.class || record.class_name || record.class;
                            const studentId = record.member?._id || record.student_id || record.member_id;
                            const attendanceType = record.status || record.attendance_type || record.type;
                            
                            if (!className || !studentId || !attendanceType) {
                              return;
                            }
                            
                            if (!classSummaries[className]) {
                              classSummaries[className] = {
                                name: className,
                                faculty: record.member?.faculty_name || record.faculty_name || '-',
                                students: new Set(),
                                studentAttendance: {},
                                fullCount: 0,
                                beforeCount: 0,
                                duringCount: 0,
                                afterCount: 0,
                                presentCount: 0,
                                earlyCount: 0,
                                lateCount: 0,
                                lateLeaveCount: 0,
                                absentCount: 0,
                                absentPermCount: 0,
                                earlyPermCount: 0,
                                duringPermCount: 0,
                                latePermCount: 0,
                                // Absence request stats (approved)
                                fullSessionApproved: 0,
                                beforeSessionApproved: 0,
                                duringSessionApproved: 0,
                                afterSessionApproved: 0
                              };
                            }
                            
                            // Add student to the class
                            classSummaries[className].students.add(studentId);
                            
                            // Initialize student attendance record if not exists
                            if (!classSummaries[className].studentAttendance[studentId]) {
                              classSummaries[className].studentAttendance[studentId] = new Set();
                            }
                            
                            // Add attendance type to student record
                            classSummaries[className].studentAttendance[studentId].add(attendanceType);
                          });
                          
                            // Assign absence request stats to each class
                            Object.values(classSummaries).forEach(classSummary => {
                              const className = classSummary.name;
                              if (absenceStatsByClass[className]) {
                                classSummary.fullSessionApproved = absenceStatsByClass[className].fullSessionApproved;
                                classSummary.beforeSessionApproved = absenceStatsByClass[className].beforeSessionApproved;
                                classSummary.duringSessionApproved = absenceStatsByClass[className].duringSessionApproved;
                                classSummary.afterSessionApproved = absenceStatsByClass[className].afterSessionApproved;
                              }
                          });
                          
                            // Calculate attendance statistics for each class
                            Object.values(classSummaries).forEach(classSummary => {
                              // Calculate absent students for this class
                              // Use the same logic as tab "Báo cáo trạng thái" - distribute from stats.absent
                              if (stats.absent !== undefined) {
                                const totalClasses = Object.keys(classSummaries).length || 1;
                                classSummary.absentCount = Math.floor(stats.absent / totalClasses);
                              } else {
                                // Fallback: calculate based on available data
                                const totalStudentsInClass = classSummary.students.size;
                                const studentsWithAttendance = Object.keys(classSummary.studentAttendance).length;
                                classSummary.absentCount = Math.max(0, totalStudentsInClass - studentsWithAttendance);
                              }
                              
                              // Calculate late attendance for this class using same logic as tab "Báo cáo trạng thái"
                              // Count actual late attendance occurrences in this class from dataToProcess (filtered)
                              let lateCount = 0;
                              dataToProcess.forEach(record => {
                                const recordClassName = record.member?.class || record.class_name || record.class;
                                const attendanceType = record.status || record.attendance_type;
                                
                                if (recordClassName === classSummary.name && attendanceType === 'late') {
                                  lateCount++;
                                }
                              });
                              classSummary.lateCount = lateCount;
                              
                              // Calculate before attendance for this class using same logic as tab "Báo cáo trạng thái"
                              // Count actual before attendance occurrences in this class from dataToProcess (filtered)
                              let beforeCount = 0;
                              dataToProcess.forEach(record => {
                                const recordClassName = record.member?.class || record.class_name || record.class;
                                const attendanceType = record.status || record.attendance_type;
                                
                                if (recordClassName === classSummary.name && attendanceType === 'before') {
                                  beforeCount++;
                                }
                              });
                              classSummary.beforeCount = beforeCount;
                              
                              // Calculate present attendance for this class using same logic as tab "Báo cáo trạng thái"
                              // Count actual present attendance occurrences in this class from dataToProcess (filtered)
                              let presentCount = 0;
                              dataToProcess.forEach(record => {
                                const recordClassName = record.member?.class || record.class_name || record.class;
                                const attendanceType = record.status || record.attendance_type;
                                
                                if (recordClassName === classSummary.name && attendanceType === 'present') {
                                  presentCount++;
                                }
                              });
                              classSummary.presentCount = presentCount;
                              
                              // Calculate during attendance for this class using same logic as tab "Báo cáo trạng thái"
                              // Count actual during attendance occurrences in this class from dataToProcess (filtered)
                              let duringCount = 0;
                              dataToProcess.forEach(record => {
                                const recordClassName = record.member?.class || record.class_name || record.class;
                                const attendanceType = record.status || record.attendance_type;
                                
                                if (recordClassName === classSummary.name && attendanceType === 'during') {
                                  duringCount++;
                                }
                              });
                              classSummary.duringCount = duringCount;
                              
                              // Calculate after attendance for this class using same logic as tab "Báo cáo trạng thái"
                              // Count actual after attendance occurrences in this class from dataToProcess (filtered)
                              let afterCount = 0;
                              dataToProcess.forEach(record => {
                                const recordClassName = record.member?.class || record.class_name || record.class;
                                const attendanceType = record.status || record.attendance_type;
                                
                                if (recordClassName === classSummary.name && attendanceType === 'after') {
                                  afterCount++;
                                }
                              });
                              classSummary.afterCount = afterCount;
                              
                              // Calculate full attendance for this class using same logic as tab "Báo cáo trạng thái"
                              // Group attendance by student-session for this class from dataToProcess (filtered)
                              const studentSessionAttendance = {};
                              dataToProcess.forEach(record => {
                                const recordClassName = record.member?.class || record.class_name || record.class;
                                const attendanceType = record.status || record.attendance_type;
                                const studentId = record.student_id || record.studentId;
                                const sessionId = record.session_id || record.sessionId;
                                
                                if (recordClassName === classSummary.name) {
                                  const key = `${studentId}-${sessionId}`;
                                  if (!studentSessionAttendance[key]) {
                                    studentSessionAttendance[key] = new Set();
                                  }
                                  studentSessionAttendance[key].add(attendanceType);
                                }
                              });
                              
                              // Check for full attendance combinations for this class
                              let fullCount = 0;
                              Object.values(studentSessionAttendance).forEach(statusSet => {
                                // Trường hợp 1: Có mặt trước + Có mặt trong + Có mặt sau (hoặc Về trễ) → Đầy đủ
                                if ((statusSet.has('before') && statusSet.has('during') && (statusSet.has('after') || statusSet.has('late_leave'))) ||
                                    (statusSet.has('early') && statusSet.has('during') && (statusSet.has('after') || statusSet.has('late_leave')))) {
                                  fullCount++;
                                  return;
                                }
                                
                                // Trường hợp 2: Đi trễ + Có mặt trong + Có mặt sau → Đầy đủ
                                if (statusSet.has('late') && statusSet.has('during') && statusSet.has('after')) {
                                  fullCount++;
                                  return;
                                }
                                
                                // Trường hợp 3: Đi trễ + Có mặt trong + Về trễ → Đầy đủ
                                if (statusSet.has('late') && statusSet.has('during') && statusSet.has('late_leave')) {
                                  fullCount++;
                                  return;
                                }
                                
                                // Trường hợp 4: Đi trước (hoặc Có mặt trước) + Có mặt trong + Có mặt sau → Đầy đủ
                                if ((statusSet.has('early') || statusSet.has('before')) && statusSet.has('during') && statusSet.has('after')) {
                                  fullCount++;
                                  return;
                                }
                              });
                              
                              classSummary.fullCount = fullCount;
                            });
                          
                          // Convert to array and sort by class name
                          const classArray = Object.values(classSummaries).sort((a, b) => 
                            a.name.localeCompare(b.name)
                          );
                          
                          // Pagination for class report
                          const startIndex = (classReportPage - 1) * itemsPerPage;
                          const endIndex = startIndex + itemsPerPage;
                          const paginatedClassArray = classArray.slice(startIndex, endIndex);
                          
                          // Return the class rows
                          return (
                            <>
                              {paginatedClassArray.map((classData, index) => {
                            const totalStudents = classData.students.size;
                          
                          return (
                            <tr key={index}>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="class-icon">
                                    <i className="fas fa-graduation-cap"></i>
                                  </div>
                                  <div>
                                    <div className="fw-bold">{classData.name}</div>
                                    <small className="text-muted">{classData.faculty || '-'}</small>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <Badge bg="primary" className="fs-6">{totalStudents}</Badge>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-success"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-full-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                            <strong>Đầy đủ:</strong><br/>
                                            {classData.fullCount} lần có mặt đầy đủ thời gian
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{classData.fullCount}</strong>
                                  </OverlayTrigger>
                                </div>
                              </td>
                                <td>
                                  <div className="d-flex align-items-center">
                                    <div className="status-indicator bg-success"></div>
                                    <OverlayTrigger
                                      placement="top"
                                      overlay={
                                        <Tooltip id={`tooltip-before-${index}`}>
                                          <div style={{ maxWidth: '300px' }}>
                                            <strong>Có mặt trước:</strong><br/>
                                            {classData.beforeCount} lần điểm danh trước buổi học
                                          </div>
                                        </Tooltip>
                                      }
                                    >
                                      <strong style={{ cursor: 'pointer' }}>{classData.beforeCount}</strong>
                                    </OverlayTrigger>
                                  </div>
                                </td>
                                <td>
                                  <div className="d-flex align-items-center">
                                    <div className="status-indicator bg-success"></div>
                                    <OverlayTrigger
                                      placement="top"
                                      overlay={
                                        <Tooltip id={`tooltip-during-${index}`}>
                                          <div style={{ maxWidth: '300px' }}>
                                            <strong>Có mặt trong:</strong><br/>
                                            {classData.duringCount} lần điểm danh trong buổi học
                                          </div>
                                        </Tooltip>
                                      }
                                    >
                                      <strong style={{ cursor: 'pointer' }}>{classData.duringCount}</strong>
                                    </OverlayTrigger>
                                  </div>
                                </td>
                                <td>
                                  <div className="d-flex align-items-center">
                                    <div className="status-indicator bg-success"></div>
                                    <OverlayTrigger
                                      placement="top"
                                      overlay={
                                        <Tooltip id={`tooltip-after-${index}`}>
                                          <div style={{ maxWidth: '300px' }}>
                                            <strong>Có mặt sau:</strong><br/>
                                            {classData.afterCount} lần điểm danh sau buổi học
                                          </div>
                                        </Tooltip>
                                      }
                                    >
                                      <strong style={{ cursor: 'pointer' }}>{classData.afterCount}</strong>
                                    </OverlayTrigger>
                                  </div>
                                </td>
                                <td>
                                  <div className="d-flex align-items-center">
                                    <div className="status-indicator bg-success"></div>
                                    <OverlayTrigger
                                      placement="top"
                                      overlay={
                                        <Tooltip id={`tooltip-present-${index}`}>
                                          <div style={{ maxWidth: '300px' }}>
                                            <strong>Có mặt:</strong><br/>
                                            {classData.presentCount} lần điểm danh (không xác định thời điểm)
                                          </div>
                                        </Tooltip>
                                      }
                                    >
                                      <strong style={{ cursor: 'pointer' }}>{classData.presentCount}</strong>
                                    </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-warning"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-late-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Đi trễ:</strong><br/>
                                          {classData.lateCount} lần điểm danh đi trễ so với giờ bắt đầu
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{classData.lateCount}</strong>
                                    </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-danger"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-absent-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Sinh viên vắng mặt:</strong><br/>
                                          {classData.absentCount} sinh viên không có bất kỳ bản ghi điểm danh nào
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{classData.absentCount}</strong>
                                  </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                    <div className="status-indicator bg-danger"></div>
                                    <OverlayTrigger
                                      placement="top"
                                      overlay={
                                        <Tooltip id={`tooltip-full-session-approved-${index}`}>
                                          <div style={{ maxWidth: '300px' }}>
                                            <strong>Phép cả buổi đã duyệt:</strong><br/>
                                            {classData.fullSessionApproved} yêu cầu đã được duyệt
                                          </div>
                                        </Tooltip>
                                      }
                                    >
                                      <strong style={{ cursor: 'pointer' }}>{classData.fullSessionApproved || 0}</strong>
                                    </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                  <div className="d-flex align-items-center">
                                    <div className="status-indicator bg-info"></div>
                                    <OverlayTrigger
                                      placement="top"
                                      overlay={
                                        <Tooltip id={`tooltip-before-session-approved-${index}`}>
                                          <div style={{ maxWidth: '300px' }}>
                                            <strong>Phép trước buổi đã duyệt:</strong><br/>
                                            {classData.beforeSessionApproved} yêu cầu đã được duyệt
                                          </div>
                                        </Tooltip>
                                      }
                                    >
                                      <strong style={{ cursor: 'pointer' }}>{classData.beforeSessionApproved || 0}</strong>
                                    </OverlayTrigger>
                                  </div>
                              </td>
                                <td>
                                  <div className="d-flex align-items-center">
                                    <div className="status-indicator bg-warning"></div>
                                    <OverlayTrigger
                                      placement="top"
                                      overlay={
                                        <Tooltip id={`tooltip-during-session-approved-${index}`}>
                                          <div style={{ maxWidth: '300px' }}>
                                            <strong>Phép trong buổi đã duyệt:</strong><br/>
                                            {classData.duringSessionApproved} yêu cầu đã được duyệt
                                          </div>
                                        </Tooltip>
                                      }
                                    >
                                      <strong style={{ cursor: 'pointer' }}>{classData.duringSessionApproved || 0}</strong>
                                    </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                  <div className="d-flex align-items-center">
                                    <div className="status-indicator bg-secondary"></div>
                                    <OverlayTrigger
                                      placement="top"
                                      overlay={
                                        <Tooltip id={`tooltip-after-session-approved-${index}`}>
                                          <div style={{ maxWidth: '300px' }}>
                                            <strong>Phép sau buổi đã duyệt:</strong><br/>
                                            {classData.afterSessionApproved} yêu cầu đã được duyệt
                                          </div>
                                        </Tooltip>
                                      }
                                    >
                                      <strong style={{ cursor: 'pointer' }}>{classData.afterSessionApproved || 0}</strong>
                                    </OverlayTrigger>
                                </div>
                              </td>
                            </tr>
                          );
                          })}
                              {classArray.length > itemsPerPage && (
                                <tr>
                                  <td colSpan="13" className="text-center py-3">
                                    <Pagination
                                      currentPage={classReportPage}
                                      totalPages={Math.ceil(classArray.length / itemsPerPage)}
                                      onPageChange={setClassReportPage}
                                    />
                                  </td>
                                </tr>
                              )}
                            </>
                          );
                        })()}
                        </tbody>
                    </table>
                  </div>
                </div>
                </Tab>
                
              <Tab eventKey="hospitalReport" title={
                <span className="tab-title">
                  <i className="fas fa-hospital"></i>
                  Bệnh viện
                </span>
              }>
                <div className="session-table-container">
                  
                  <div className="table-responsive">
                    <table className="session-table">
                      <thead>
                          <tr>
                            <th>Bệnh viện</th>
                            <th>Tổng số SV</th>
                            <th>Đầy đủ</th>
                            <th>Trước</th>
                            <th>Trong</th>
                            <th>Sau</th>
                            <th>Có mặt</th>
                            <th>Đi trễ</th>
                            <th>Vắng</th>
                            <th>Phép cả buổi</th>
                            <th>Phép trước</th>
                            <th>Phép trong</th>
                            <th>Phép sau</th>
                          </tr>
                        </thead>
                        <tbody>
                        {(() => {
                          // Calculate hospital statistics from real data
                          const hospitalStats = {};
                          
                          // Apply filters to attendance data
                          const filteredAttendanceForHospital = applyFilters(attendanceData);
                          
                          // Initialize hospital stats from actual data
                          const uniqueLocations = new Set();
                          if (filteredAttendanceForHospital && filteredAttendanceForHospital.length > 0) {
                            filteredAttendanceForHospital.forEach(record => {
                              const location = record.session_location || record.location || record.hospital?.name || record.hospital_name || record.hospital;
                              if (location && location !== "-- Chọn vị trí có sẵn --") {
                                uniqueLocations.add(location);
                              }
                            });
                          }
                          
                          // Also include hospitals from the predefined list
                          predefinedLocations.forEach(hospital => {
                            if (hospital.name !== "-- Chọn vị trí có sẵn --") {
                              uniqueLocations.add(hospital.name);
                            }
                          });
                          
                          // Initialize stats for all unique locations
                          uniqueLocations.forEach(location => {
                            hospitalStats[location] = {
                              name: location,
                              totalStudents: 0,
                              fullCount: 0,
                              beforeCount: 0,
                              duringCount: 0,
                              afterCount: 0,
                              presentCount: 0,
                              lateCount: 0,
                              absentCount: 0,
                              fullPermCount: 0,
                              beforePermCount: 0,
                              duringPermCount: 0,
                              afterPermCount: 0
                            };
                          });
                          
                          // Process attendance data for each hospital
                          if (filteredAttendanceForHospital && filteredAttendanceForHospital.length > 0) {
                            
                            // Group attendance by student-session for each hospital
                            const hospitalStudentSessions = {};
                            
                            filteredAttendanceForHospital.forEach(record => {
                              const hospitalName = record.session_location || record.location || record.hospital?.name || record.hospital_name || record.hospital;
                              const studentId = record.student_id || record.studentId;
                              const sessionId = record.session_id || record.sessionId;
                              const attendanceType = record.status || record.attendance_type;
                              
                              if (hospitalName && hospitalStats[hospitalName]) {
                                const key = `${studentId}-${sessionId}`;
                                if (!hospitalStudentSessions[hospitalName]) {
                                  hospitalStudentSessions[hospitalName] = {};
                                }
                                if (!hospitalStudentSessions[hospitalName][key]) {
                                  hospitalStudentSessions[hospitalName][key] = new Set();
                                }
                                hospitalStudentSessions[hospitalName][key].add(attendanceType);
                                
                                // Count individual attendance types
                                if (attendanceType === 'before') hospitalStats[hospitalName].beforeCount++;
                                if (attendanceType === 'during') hospitalStats[hospitalName].duringCount++;
                                if (attendanceType === 'after') hospitalStats[hospitalName].afterCount++;
                                if (attendanceType === 'present') hospitalStats[hospitalName].presentCount++;
                                if (attendanceType === 'late') hospitalStats[hospitalName].lateCount++;
                                if (attendanceType === 'absent') hospitalStats[hospitalName].absentCount++;
                                
                              } else {
                              }
                            });
                            
                            // Calculate full attendance for each hospital
                            Object.keys(hospitalStudentSessions).forEach(hospitalName => {
                              const studentSessions = hospitalStudentSessions[hospitalName];
                              let fullCount = 0;
                              
                              Object.values(studentSessions).forEach(statusSet => {
                                // Trường hợp 1: Có mặt trước + Có mặt trong + Có mặt sau (hoặc Về trễ) → Đầy đủ
                                if ((statusSet.has('before') && statusSet.has('during') && (statusSet.has('after') || statusSet.has('late_leave'))) ||
                                    (statusSet.has('early') && statusSet.has('during') && (statusSet.has('after') || statusSet.has('late_leave')))) {
                                  fullCount++;
                                  return;
                                }
                                
                                // Trường hợp 2: Đi trễ + Có mặt trong + Có mặt sau → Đầy đủ
                                if (statusSet.has('late') && statusSet.has('during') && statusSet.has('after')) {
                                  fullCount++;
                                  return;
                                }
                                
                                // Trường hợp 3: Đi trễ + Có mặt trong + Về trễ → Đầy đủ
                                if (statusSet.has('late') && statusSet.has('during') && statusSet.has('late_leave')) {
                                  fullCount++;
                                  return;
                                }
                                
                                // Trường hợp 4: Đi trước (hoặc Có mặt trước) + Có mặt trong + Có mặt sau → Đầy đủ
                                if ((statusSet.has('early') || statusSet.has('before')) && statusSet.has('during') && statusSet.has('after')) {
                                  fullCount++;
                                  return;
                                }
                              });
                              
                              hospitalStats[hospitalName].fullCount = fullCount;
                              
                              // Count unique students for this hospital
                              const uniqueStudents = new Set();
                              Object.keys(studentSessions).forEach(key => {
                                const studentId = key.split('-')[0];
                                uniqueStudents.add(studentId);
                              });
                              hospitalStats[hospitalName].totalStudents = uniqueStudents.size;
                            });
                          }
                          
                          // Calculate absence request stats for each hospital from actual data
                          // Note: Since we don't have direct absence request data per hospital,
                          // we'll use the same distribution logic as other tabs but based on hospital data
                          const hospitalNames = Object.keys(hospitalStats);
                          if (hospitalNames.length > 0) {
                            // Calculate total attendance occurrences across all hospitals
                            let totalAttendanceOccurrences = 0;
                            hospitalNames.forEach(hospitalName => {
                              const hospital = hospitalStats[hospitalName];
                              totalAttendanceOccurrences += hospital.beforeCount + hospital.duringCount + 
                                                           hospital.afterCount + hospital.presentCount + 
                                                           hospital.lateCount + hospital.absentCount;
                            });
                            
                            // Distribute absence request stats proportionally based on attendance data
                            hospitalNames.forEach(hospitalName => {
                              const hospital = hospitalStats[hospitalName];
                              const hospitalAttendanceOccurrences = hospital.beforeCount + hospital.duringCount + 
                                                                   hospital.afterCount + hospital.presentCount + 
                                                                   hospital.lateCount + hospital.absentCount;
                              
                              if (totalAttendanceOccurrences > 0) {
                                const proportion = hospitalAttendanceOccurrences / totalAttendanceOccurrences;
                                hospital.fullPermCount = Math.round(stats.fullSessionApproved * proportion);
                                hospital.beforePermCount = Math.round(stats.beforeSessionApproved * proportion);
                                hospital.duringPermCount = Math.round(stats.duringSessionApproved * proportion);
                                hospital.afterPermCount = Math.round(stats.afterSessionApproved * proportion);
                              } else {
                                // If no attendance data, distribute evenly
                                hospital.fullPermCount = Math.floor(stats.fullSessionApproved / hospitalNames.length);
                                hospital.beforePermCount = Math.floor(stats.beforeSessionApproved / hospitalNames.length);
                                hospital.duringPermCount = Math.floor(stats.duringSessionApproved / hospitalNames.length);
                                hospital.afterPermCount = Math.floor(stats.afterSessionApproved / hospitalNames.length);
                              }
                              

                            });
                          }
                          
                          const hospitalArray = Object.values(hospitalStats);
                          // Pagination for hospital report
                          const startIndex = (hospitalReportPage - 1) * itemsPerPage;
                          const endIndex = startIndex + itemsPerPage;
                          const paginatedHospitalArray = hospitalArray.slice(startIndex, endIndex);
                          
                          return (
                            <>
                              {paginatedHospitalArray.map((hospitalData, index) => {
                          return (
                            <tr key={index}>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="hospital-icon">
                                    <i className="fas fa-hospital"></i>
                                  </div>
                                  <div>
                                    <div className="fw-bold">{hospitalData.name}</div>
                                    <small className="text-muted">
                                      {hospitalData.name.includes("Đà Nẵng") ? "Đà Nẵng" : 
                                       hospitalData.name.includes("Quảng Nam") ? "Quảng Nam" : 
                                       hospitalData.name.includes("Sài Gòn") ? "TP. Hồ Chí Minh" :
                                       hospitalData.name.includes("Nha Trang") ? "Khánh Hòa" :
                                       hospitalData.name.includes("Đồng Tháp") || hospitalData.name.includes("Cao Lãnh") || hospitalData.name.includes("Hồng Ngự") ? "Đồng Tháp" :
                                       hospitalData.name.includes("Phan Châu Trinh") ? "Đà Nẵng" :
                                       "Việt Nam"}
                                    </small>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <Badge bg="primary" className="fs-6">{hospitalData.totalStudents}</Badge>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-success"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-full-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Đầy đủ:</strong><br/>
                                          {hospitalData.fullCount} lần có mặt đầy đủ thời gian
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{hospitalData.fullCount}</strong>
                                  </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-info"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-before-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Có mặt trước:</strong><br/>
                                          {hospitalData.beforeCount} lần có mặt trước buổi
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{hospitalData.beforeCount}</strong>
                                  </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-primary"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-during-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Có mặt trong:</strong><br/>
                                          {hospitalData.duringCount} lần có mặt trong buổi
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{hospitalData.duringCount}</strong>
                                  </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-secondary"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-after-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Có mặt sau:</strong><br/>
                                          {hospitalData.afterCount} lần có mặt sau buổi
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{hospitalData.afterCount}</strong>
                                  </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-success"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-present-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Có mặt:</strong><br/>
                                          {hospitalData.presentCount} lần có mặt
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{hospitalData.presentCount}</strong>
                                  </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-warning"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-late-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Đi trễ:</strong><br/>
                                          {hospitalData.lateCount} lần đi trễ
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{hospitalData.lateCount}</strong>
                                  </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-danger"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-absent-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Vắng mặt:</strong><br/>
                                          {hospitalData.absentCount} lần vắng mặt
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{hospitalData.absentCount}</strong>
                                  </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-secondary"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-full-perm-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Phép cả buổi:</strong><br/>
                                          {hospitalData.fullPermCount} lần xin phép cả buổi (đã duyệt)
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{hospitalData.fullPermCount}</strong>
                                  </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-info"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-before-perm-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Phép trước buổi:</strong><br/>
                                          {hospitalData.beforePermCount} lần xin phép trước buổi (đã duyệt)
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{hospitalData.beforePermCount}</strong>
                                  </OverlayTrigger>
                                  </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-primary"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-during-perm-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Phép trong buổi:</strong><br/>
                                          {hospitalData.duringPermCount} lần xin phép trong buổi (đã duyệt)
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{hospitalData.duringPermCount}</strong>
                                  </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-secondary"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-after-perm-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Phép sau buổi:</strong><br/>
                                          {hospitalData.afterPermCount} lần xin phép sau buổi (đã duyệt)
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{hospitalData.afterPermCount}</strong>
                                  </OverlayTrigger>
                                </div>
                              </td>
                            </tr>
                          );
                          })}
                              {hospitalArray.length > itemsPerPage && (
                                <tr>
                                  <td colSpan="13" className="text-center py-3">
                                    <Pagination
                                      currentPage={hospitalReportPage}
                                      totalPages={Math.ceil(hospitalArray.length / itemsPerPage)}
                                      onPageChange={setHospitalReportPage}
                                    />
                                  </td>
                                </tr>
                              )}
                            </>
                          );
                        })()}
                        </tbody>
                    </table>
                  </div>
                </div>
                </Tab>
                
              <Tab eventKey="dateReport" title={
                <span className="tab-title">
                  <i className="fas fa-calendar-day"></i>
                  Ngày
                </span>
              }>
                <div className="session-table-container">
                  
                  
                  <div className="table-responsive">
                    <table className="session-table">
                      <thead>
                          <tr>
                            <th>Ngày</th>
                            <th>Tổng số buổi</th>
                            <th>Tổng số SV</th>
                            <th>Đầy đủ</th>
                            <th>Trước</th>
                            <th>Trong</th>
                            <th>Sau</th>
                            <th>Có mặt</th>
                            <th>Đi trễ</th>
                            <th>Vắng</th>
                            <th>Phép cả buổi</th>
                            <th>Phép trước</th>
                            <th>Phép trong</th>
                            <th>Phép sau</th>
                          </tr>
                        </thead>
                        <tbody>
                        {(() => {
                          // Calculate date statistics from real data
                          const dateStats = {};
                          
                          // Apply filters to attendance data
                          const filteredAttendanceForDate = applyFilters(attendanceData);
                          
                          // Initialize date stats from actual data
                          const uniqueDates = new Set();
                          if (filteredAttendanceForDate && filteredAttendanceForDate.length > 0) {
                            filteredAttendanceForDate.forEach(record => {
                              const sessionDate = record.session_date || record.date;
                              if (sessionDate) {
                                const dateStr = new Date(sessionDate).toLocaleDateString('vi-VN');
                                uniqueDates.add(dateStr);
                              }
                            });
                          }
                          
                          // Generate last 5 days if no data
                          if (uniqueDates.size === 0) {
                            for (let i = 0; i < 5; i++) {
                            const date = new Date();
                              date.setDate(date.getDate() - i);
                              uniqueDates.add(date.toLocaleDateString('vi-VN'));
                            }
                          }
                          
                          // Initialize stats for all unique dates
                          uniqueDates.forEach(dateStr => {
                            dateStats[dateStr] = {
                              date: dateStr,
                              totalSessions: 0,
                              totalStudents: 0,
                              fullCount: 0,
                              beforeCount: 0,
                              duringCount: 0,
                              afterCount: 0,
                              presentCount: 0,
                              lateCount: 0,
                              absentCount: 0,
                              fullPermCount: 0,
                              beforePermCount: 0,
                              duringPermCount: 0,
                              afterPermCount: 0
                            };
                          });
                          
                          // Process attendance data for each date
                          if (filteredAttendanceForDate && filteredAttendanceForDate.length > 0) {
                            
                            // Group attendance by student-session for each date
                            const dateStudentSessions = {};
                            
                            filteredAttendanceForDate.forEach(record => {
                              const sessionDate = record.session_date || record.date;
                              const studentId = record.student_id || record.studentId;
                              const sessionId = record.session_id || record.sessionId;
                              const attendanceType = record.status || record.attendance_type;
                              
                              if (sessionDate) {
                                const dateStr = new Date(sessionDate).toLocaleDateString('vi-VN');
                                
                                if (dateStats[dateStr]) {
                                  const key = `${studentId}-${sessionId}`;
                                  if (!dateStudentSessions[dateStr]) {
                                    dateStudentSessions[dateStr] = {};
                                  }
                                  if (!dateStudentSessions[dateStr][key]) {
                                    dateStudentSessions[dateStr][key] = new Set();
                                  }
                                  dateStudentSessions[dateStr][key].add(attendanceType);
                                  
                                  // Count individual attendance types
                                  if (attendanceType === 'before') dateStats[dateStr].beforeCount++;
                                  if (attendanceType === 'during') dateStats[dateStr].duringCount++;
                                  if (attendanceType === 'after') dateStats[dateStr].afterCount++;
                                  if (attendanceType === 'present') dateStats[dateStr].presentCount++;
                                  if (attendanceType === 'late') dateStats[dateStr].lateCount++;
                                  // Note: 'absent' is usually not in attendance records, will calculate separately
                                  
                                }
                              }
                            });
                            
                            // Calculate full attendance for each date
                            Object.keys(dateStudentSessions).forEach(dateStr => {
                              const studentSessions = dateStudentSessions[dateStr];
                              let fullCount = 0;
                              
                              Object.values(studentSessions).forEach(statusSet => {
                                // Trường hợp 1: Có mặt trước + Có mặt trong + Có mặt sau (hoặc Về trễ) → Đầy đủ
                                if ((statusSet.has('before') && statusSet.has('during') && (statusSet.has('after') || statusSet.has('late_leave'))) ||
                                    (statusSet.has('early') && statusSet.has('during') && (statusSet.has('after') || statusSet.has('late_leave')))) {
                                  fullCount++;
                                  return;
                                }
                                
                                // Trường hợp 2: Đi trễ + Có mặt trong + Có mặt sau → Đầy đủ
                                if (statusSet.has('late') && statusSet.has('during') && statusSet.has('after')) {
                                  fullCount++;
                                  return;
                                }
                                
                                // Trường hợp 3: Đi trễ + Có mặt trong + Về trễ → Đầy đủ
                                if (statusSet.has('late') && statusSet.has('during') && statusSet.has('late_leave')) {
                                  fullCount++;
                                  return;
                                }
                                
                                // Trường hợp 4: Đi trước (hoặc Có mặt trước) + Có mặt trong + Có mặt sau → Đầy đủ
                                if ((statusSet.has('early') || statusSet.has('before')) && statusSet.has('during') && statusSet.has('after')) {
                                  fullCount++;
                                  return;
                                }
                              });
                              
                              dateStats[dateStr].fullCount = fullCount;
                              
                              // Count unique students and sessions for this date
                              const uniqueStudents = new Set();
                              const uniqueSessions = new Set();
                              Object.keys(studentSessions).forEach(key => {
                                const studentId = key.split('-')[0];
                                const sessionId = key.split('-')[1];
                                uniqueStudents.add(studentId);
                                uniqueSessions.add(sessionId);
                              });
                              dateStats[dateStr].totalStudents = uniqueStudents.size;
                              dateStats[dateStr].totalSessions = uniqueSessions.size;
                            });
                            
                            // Calculate absent count for each date using dashboard stats
                            const dateNames = Object.keys(dateStats);
                            if (dateNames.length > 0 && stats.absent > 0) {
                              // Distribute absent count proportionally based on attendance data
                              let totalAttendanceOccurrences = 0;
                              dateNames.forEach(dateStr => {
                                const date = dateStats[dateStr];
                                totalAttendanceOccurrences += date.beforeCount + date.duringCount + 
                                                             date.afterCount + date.presentCount + 
                                                             date.lateCount;
                              });
                              
                              if (totalAttendanceOccurrences > 0) {
                                dateNames.forEach(dateStr => {
                                  const date = dateStats[dateStr];
                                  const dateAttendanceOccurrences = date.beforeCount + date.duringCount + 
                                                                   date.afterCount + date.presentCount + 
                                                                   date.lateCount;
                                  const proportion = dateAttendanceOccurrences / totalAttendanceOccurrences;
                                  date.absentCount = Math.round(stats.absent * proportion);
                                });
                              } else {
                                // If no attendance data, distribute evenly
                                dateNames.forEach(dateStr => {
                                  dateStats[dateStr].absentCount = Math.floor(stats.absent / dateNames.length);
                                });
                              }
                            }
                          }
                          
                          // Apply real absence request stats by date
                          const dateNames = Object.keys(dateStats);
                          if (dateNames.length > 0) {
                            // Apply real data from absenceStatsByDate state
                            dateNames.forEach(dateStr => {
                              const date = dateStats[dateStr];
                              const absenceData = absenceStatsByDate.find(item => {
                                // Convert both dates to YYYY-MM-DD format for comparison
                                const itemDate = new Date(item.session_date).toISOString().split('T')[0];
                                const targetDate = new Date(dateStr.split('/').reverse().join('-')).toISOString().split('T')[0];
                                return itemDate === targetDate;
                              });
                              
                              if (absenceData) {
                                date.fullPermCount = absenceData.full_session_requests || 0;
                                date.beforePermCount = absenceData.before_session_requests || 0;
                                date.duringPermCount = absenceData.during_session_requests || 0;
                                date.afterPermCount = absenceData.after_session_requests || 0;
                                
                              } else {
                                // If no data for this date, use proportional distribution as fallback
                                const dateAttendanceOccurrences = date.beforeCount + date.duringCount + 
                                                                 date.afterCount + date.presentCount + 
                                                                 date.lateCount + date.absentCount;
                                
                                // Calculate total attendance occurrences across all dates
                                let totalAttendanceOccurrences = 0;
                                dateNames.forEach(d => {
                                  const dData = dateStats[d];
                                  totalAttendanceOccurrences += dData.beforeCount + dData.duringCount + 
                                                               dData.afterCount + dData.presentCount + 
                                                               dData.lateCount + dData.absentCount;
                                });
                                
                                if (totalAttendanceOccurrences > 0) {
                                  const proportion = dateAttendanceOccurrences / totalAttendanceOccurrences;
                                  date.fullPermCount = Math.round((stats.fullSessionApproved || 0) * proportion);
                                  date.beforePermCount = Math.round((stats.beforeSessionApproved || 0) * proportion);
                                  date.duringPermCount = Math.round((stats.duringSessionApproved || 0) * proportion);
                                  date.afterPermCount = Math.round((stats.afterSessionApproved || 0) * proportion);
                                } else {
                                  // If no attendance data, distribute evenly
                                  date.fullPermCount = Math.floor((stats.fullSessionApproved || 0) / dateNames.length);
                                  date.beforePermCount = Math.floor((stats.beforeSessionApproved || 0) / dateNames.length);
                                  date.duringPermCount = Math.floor((stats.duringSessionApproved || 0) / dateNames.length);
                                  date.afterPermCount = Math.floor((stats.afterSessionApproved || 0) / dateNames.length);
                                }
                                
                              }
                            });
                          }
                          
                          const dateArray = Object.values(dateStats);
                          // Pagination for date report
                          const startIndex = (dateReportPage - 1) * itemsPerPage;
                          const endIndex = startIndex + itemsPerPage;
                          const paginatedDateArray = dateArray.slice(startIndex, endIndex);
                          
                          return (
                            <>
                              {paginatedDateArray.map((dateData, index) => {
                          
                            return (
                              <tr key={index}>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="date-icon">
                                    <i className="fas fa-calendar-day"></i>
                                  </div>
                                  <div>
                                    <div className="fw-bold">{dateData.date}</div>
                                    <small className="text-muted">
                                      {new Date(dateData.date.split('/').reverse().join('-')).toLocaleDateString('en-US', { weekday: 'long' })}
                                    </small>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <Badge bg="info" className="fs-6">{dateData.totalSessions}</Badge>
                              </td>
                              <td>
                                <Badge bg="primary" className="fs-6">{dateData.totalStudents}</Badge>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-success"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-full-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Đầy đủ:</strong><br/>
                                          {dateData.fullCount} lần có mặt đầy đủ thời gian
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{dateData.fullCount}</strong>
                                  </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-info"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-before-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Có mặt trước:</strong><br/>
                                          {dateData.beforeCount} lần có mặt trước buổi
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{dateData.beforeCount}</strong>
                                  </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-primary"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-during-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Có mặt trong:</strong><br/>
                                          {dateData.duringCount} lần có mặt trong buổi
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{dateData.duringCount}</strong>
                                  </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-secondary"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-after-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Có mặt sau:</strong><br/>
                                          {dateData.afterCount} lần có mặt sau buổi
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{dateData.afterCount}</strong>
                                  </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-success"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-present-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Có mặt:</strong><br/>
                                          {dateData.presentCount} lần có mặt
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{dateData.presentCount}</strong>
                                  </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-warning"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-late-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Đi trễ:</strong><br/>
                                          {dateData.lateCount} lần đi trễ
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{dateData.lateCount}</strong>
                                  </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-danger"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-absent-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Vắng mặt:</strong><br/>
                                          {dateData.absentCount} lần vắng mặt
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{dateData.absentCount}</strong>
                                  </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-secondary"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-full-perm-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Phép cả buổi:</strong><br/>
                                          {dateData.fullPermCount} lần xin phép cả buổi (đã duyệt)
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{dateData.fullPermCount}</strong>
                                  </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-info"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-before-perm-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Phép trước buổi:</strong><br/>
                                          {dateData.beforePermCount} lần xin phép trước buổi (đã duyệt)
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{dateData.beforePermCount}</strong>
                                  </OverlayTrigger>
                                  </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-primary"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-during-perm-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Phép trong buổi:</strong><br/>
                                          {dateData.duringPermCount} lần xin phép trong buổi (đã duyệt)
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{dateData.duringPermCount}</strong>
                                  </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-secondary"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-after-perm-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Phép sau buổi:</strong><br/>
                                          {dateData.afterPermCount} lần xin phép sau buổi (đã duyệt)
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{dateData.afterPermCount}</strong>
                                  </OverlayTrigger>
                                </div>
                                </td>
                              </tr>
                            );
                          })}
                              {dateArray.length > itemsPerPage && (
                                <tr>
                                  <td colSpan="14" className="text-center py-3">
                                    <Pagination
                                      currentPage={dateReportPage}
                                      totalPages={Math.ceil(dateArray.length / itemsPerPage)}
                                      onPageChange={setDateReportPage}
                                    />
                                  </td>
                                </tr>
                              )}
                            </>
                          );
                        })()}
                        </tbody>
                    </table>
                      </div>
                </div>
                </Tab>
                
              <Tab eventKey="sessionReport" title={
                <span className="tab-title">
                  <i className="fas fa-book"></i>
                  Tên buổi học
                </span>
              }>
                <div className="session-table-container">
                  
                  
                  <div className="table-responsive">
                    <table className="session-table">
                      <thead>
                          <tr>
                            <th>Tên Buổi học</th>
                            <th>Lớp</th>
                            <th>Khoa</th>
                            <th>Địa điểm</th>
                            <th>Sinh viên</th>
                            <th>Thời gian</th>
                            <th>Đầy đủ</th>
                            <th>Trước</th>
                            <th>Trong</th>
                            <th>Sau</th>
                            <th>Có mặt</th>
                            <th>Đi trễ</th>
                            <th>Vắng</th>
                            <th>Phép cả buổi</th>
                            <th>Phép trước</th>
                            <th>Phép trong</th>
                            <th>Phép sau</th>
                          </tr>
                        </thead>
                        <tbody>
                        {(() => {
                          // Group attendance data by session title
                          const sessionSummaries = {};
                          
                          // Apply filters to attendance data
                          let dataToProcess = applyFilters(attendanceData);
                          
                          // Get absence request stats by session
                          const absenceStatsBySession = {};
                          if (stats.fullSessionApproved !== undefined) {
                            // Extract unique sessions from attendance data
                            const uniqueSessionsFromData = [...new Set(
                              dataToProcess.map(item => 
                                item.session_title || item.session?.title || ''
                              ).filter(Boolean)
                            )];
                            const totalSessions = uniqueSessionsFromData.length || 1;
                            
                            uniqueSessionsFromData.forEach(sessionTitle => {
                              absenceStatsBySession[sessionTitle] = {
                                fullSessionApproved: Math.floor(stats.fullSessionApproved / totalSessions),
                                beforeSessionApproved: Math.floor(stats.beforeSessionApproved / totalSessions),
                                duringSessionApproved: Math.floor(stats.duringSessionApproved / totalSessions),
                                afterSessionApproved: Math.floor(stats.afterSessionApproved / totalSessions)
                              };
                            });
                          }
                          
                          if ((!attendanceData || !Array.isArray(attendanceData) || attendanceData.length === 0) && 
                              detailedMembers && Array.isArray(detailedMembers) && detailedMembers.length > 0) {
                            dataToProcess = detailedMembers.map(member => ({
                              member: {
                                _id: member.id,
                                class: member.class,
                                fullName: member.fullName,
                                gender: member.gender,
                                email: member.email,
                                faculty_name: member.faculty_name
                              },
                              status: member.attendanceStatus,
                              attendance_type: member.attendanceStatus,
                              timestamp: member.attendanceTimestamp,
                              faculty_name: member.faculty_name,
                              session_title: member.sessionInfo?.title || 'N/A'
                            }));
                          }

                          // Process all attendance data to group by session title
                          if (!dataToProcess || !Array.isArray(dataToProcess) || dataToProcess.length === 0) {
                            return (
                              <tr>
                                <td colSpan="17" className="text-center py-4">
                                  <div className="text-muted">
                                    <i className="fas fa-info-circle me-2"></i>
                                    Không có dữ liệu điểm danh để hiển thị báo cáo theo tên buổi học
                                  </div>
                                </td>
                              </tr>
                            );
                          }
                          
                          dataToProcess.forEach(record => {
                            const sessionTitle = record.session_title || record.session?.title || 'N/A';
                            const studentId = record.member?._id || record.student_id || record.member_id;
                            const attendanceType = record.status || record.attendance_type || record.type;
                            const className = record.member?.class || record.class_name || record.class || '-';
                            const facultyName = record.member?.faculty_name || record.faculty_name || '-';
                            const location = record.session_location || record.location || record.session?.location || '-';
                            const sessionDate = record.session_date || record.date;
                            const startTime = record.start_time || record.session?.start_time;
                            const endTime = record.end_time || record.session?.end_time;
                            
                            if (!sessionTitle || sessionTitle === 'N/A' || !studentId || !attendanceType) {
                              return;
                            }
                            
                            if (!sessionSummaries[sessionTitle]) {
                              sessionSummaries[sessionTitle] = {
                                title: sessionTitle,
                                classes: new Set(),
                                faculties: new Set(),
                                facultyCounts: {}, // Track faculty counts for most common
                                location: location,
                                students: new Set(),
                                studentAttendance: {},
                                sessionDate: sessionDate,
                                startTime: startTime,
                                endTime: endTime,
                                fullCount: 0,
                                beforeCount: 0,
                                duringCount: 0,
                                afterCount: 0,
                                presentCount: 0,
                                earlyCount: 0,
                                lateCount: 0,
                                lateLeaveCount: 0,
                                absentCount: 0,
                                absentPermCount: 0,
                                earlyPermCount: 0,
                                duringPermCount: 0,
                                latePermCount: 0,
                                // Absence request stats (approved)
                                fullSessionApproved: 0,
                                beforeSessionApproved: 0,
                                duringSessionApproved: 0,
                                afterSessionApproved: 0
                              };
                            }
                            
                            // Add class and faculty
                            if (className && className !== '-') {
                              sessionSummaries[sessionTitle].classes.add(className);
                            }
                            if (facultyName && facultyName !== '-') {
                              sessionSummaries[sessionTitle].faculties.add(facultyName);
                              // Count faculty occurrences
                              sessionSummaries[sessionTitle].facultyCounts[facultyName] = 
                                (sessionSummaries[sessionTitle].facultyCounts[facultyName] || 0) + 1;
                            }
                            
                            // Add student to the session
                            sessionSummaries[sessionTitle].students.add(studentId);
                            
                            // Initialize student attendance record if not exists
                            if (!sessionSummaries[sessionTitle].studentAttendance[studentId]) {
                              sessionSummaries[sessionTitle].studentAttendance[studentId] = new Set();
                            }
                            
                            // Add attendance type to student record
                            sessionSummaries[sessionTitle].studentAttendance[studentId].add(attendanceType);
                          });
                          
                          // Assign absence request stats to each session
                          Object.values(sessionSummaries).forEach(sessionSummary => {
                            const sessionTitle = sessionSummary.title;
                            if (absenceStatsBySession[sessionTitle]) {
                              sessionSummary.fullSessionApproved = absenceStatsBySession[sessionTitle].fullSessionApproved;
                              sessionSummary.beforeSessionApproved = absenceStatsBySession[sessionTitle].beforeSessionApproved;
                              sessionSummary.duringSessionApproved = absenceStatsBySession[sessionTitle].duringSessionApproved;
                              sessionSummary.afterSessionApproved = absenceStatsBySession[sessionTitle].afterSessionApproved;
                            }
                          });
                          
                          // Calculate attendance statistics for each session
                          Object.values(sessionSummaries).forEach(sessionSummary => {
                            // First, count absent students directly from data for this session
                            const sessionTitle = sessionSummary.title;
                            let absentCountFromData = 0;
                            dataToProcess.forEach(record => {
                              const recordSessionTitle = record.session_title || record.session?.title || 'N/A';
                              const attendanceType = record.status || record.attendance_type || record.type;
                              
                              if (recordSessionTitle === sessionTitle && attendanceType === 'absent') {
                                // Check if it's not an absence with permission
                                const studentId = record.member?._id || record.student_id || record.member_id;
                                if (studentId) {
                                  const studentStatusSet = sessionSummary.studentAttendance[studentId];
                                  if (studentStatusSet) {
                                    const hasAbsentPerm = studentStatusSet.has('absent_perm');
                                    const hasAbsentBeforePerm = studentStatusSet.has('absent_before_perm');
                                    const hasAbsentDuringPerm = studentStatusSet.has('absent_during_perm');
                                    const hasAbsentAfterPerm = studentStatusSet.has('absent_after_perm');
                                    
                                    if (!hasAbsentPerm && !hasAbsentBeforePerm && 
                                        !hasAbsentDuringPerm && !hasAbsentAfterPerm) {
                                      absentCountFromData++;
                                    }
                                  } else {
                                    absentCountFromData++;
                                  }
                                }
                              }
                            });
                            
                            // Use the count from data if available, otherwise use fallback
                            if (absentCountFromData > 0) {
                              sessionSummary.absentCount = absentCountFromData;
                            } else {
                              // Fallback: calculate based on students with attendance vs total
                              // Since we don't have total students in session, use 0 or distribute from stats
                              if (stats.absent !== undefined) {
                                const totalSessions = Object.keys(sessionSummaries).length || 1;
                                sessionSummary.absentCount = Math.floor(stats.absent / totalSessions);
                              }
                            }
                            
                            // Calculate attendance types for each student
                            Object.keys(sessionSummary.studentAttendance).forEach(studentId => {
                              const statusSet = sessionSummary.studentAttendance[studentId];
                              
                              const hasBeforeAttendance = statusSet.has('before');
                              const hasDuringAttendance = statusSet.has('during');
                              const hasAfterAttendance = statusSet.has('after');
                              const hasLateAttendance = statusSet.has('late');
                              const hasEarlyAttendance = statusSet.has('early');
                              const hasLateLeaveAttendance = statusSet.has('late_leave');
                              
                              // Check for absence with permission types
                              const hasAbsentPerm = statusSet.has('absent_perm');
                              const hasAbsentBeforePerm = statusSet.has('absent_before_perm');
                              const hasAbsentDuringPerm = statusSet.has('absent_during_perm');
                              const hasAbsentAfterPerm = statusSet.has('absent_after_perm');
                              
                              // Determine final status based on the same logic as other tabs
                              // Trường hợp 1: Có mặt trước + Có mặt trong + Có mặt sau (hoặc Về trễ) → Đầy đủ
                              if ((hasBeforeAttendance && hasDuringAttendance && (hasAfterAttendance || hasLateLeaveAttendance)) ||
                                  (hasEarlyAttendance && hasDuringAttendance && (hasAfterAttendance || hasLateLeaveAttendance))) {
                                sessionSummary.fullCount++;
                              }
                              // Trường hợp 2: Đi trễ + Có mặt trong + Có mặt sau → Đầy đủ và Đi trễ
                              else if (hasLateAttendance && hasDuringAttendance && hasAfterAttendance) {
                                sessionSummary.fullCount++;
                                sessionSummary.lateCount++;
                              }
                              // Trường hợp 3: Đi trễ + Có mặt trong + Về trễ → Đầy đủ và Đi trễ
                              else if (hasLateAttendance && hasDuringAttendance && hasLateLeaveAttendance) {
                                sessionSummary.fullCount++;
                                sessionSummary.lateCount++;
                              }
                              // Trường hợp 4: Đi trước (hoặc Có mặt trước) + Có mặt trong + Có mặt sau → Đầy đủ
                              else if ((hasEarlyAttendance || hasBeforeAttendance) && hasDuringAttendance && hasAfterAttendance) {
                                sessionSummary.fullCount++;
                              }
                              // Individual types
                              else {
                                if (hasBeforeAttendance && !hasDuringAttendance && !hasAfterAttendance) {
                                  sessionSummary.beforeCount++;
                                }
                                if (hasDuringAttendance && !hasBeforeAttendance && !hasAfterAttendance) {
                                  sessionSummary.duringCount++;
                                }
                                if (hasAfterAttendance && !hasBeforeAttendance && !hasDuringAttendance) {
                                  sessionSummary.afterCount++;
                                }
                                if (hasEarlyAttendance && !hasDuringAttendance && !hasAfterAttendance) {
                                  sessionSummary.earlyCount++;
                                }
                                if (hasLateAttendance) {
                                  sessionSummary.lateCount++;
                                }
                                if (hasLateLeaveAttendance && !hasBeforeAttendance && !hasDuringAttendance) {
                                  sessionSummary.lateLeaveCount++;
                                }
                                if (statusSet.has('present') && !hasBeforeAttendance && !hasDuringAttendance && 
                                    !hasAfterAttendance && !hasEarlyAttendance && !hasLateAttendance && !hasLateLeaveAttendance) {
                                  sessionSummary.presentCount++;
                                }
                              }
                              
                              // Count permission types
                              if (hasAbsentPerm) {
                                sessionSummary.absentPermCount++;
                              }
                              if (hasAbsentBeforePerm) {
                                sessionSummary.earlyPermCount++;
                              }
                              if (hasAbsentDuringPerm) {
                                sessionSummary.duringPermCount++;
                              }
                              if (hasAbsentAfterPerm) {
                                sessionSummary.latePermCount++;
                              }
                            });
                            
                            // Add absence request approved counts
                            sessionSummary.absentPermCount += sessionSummary.fullSessionApproved;
                            sessionSummary.earlyPermCount += sessionSummary.beforeSessionApproved;
                            sessionSummary.duringPermCount += sessionSummary.duringSessionApproved;
                            sessionSummary.latePermCount += sessionSummary.afterSessionApproved;
                          });
                          
                          // Convert to array and sort by session title
                          const sessionArray = Object.values(sessionSummaries).sort((a, b) => {
                            if (a.title < b.title) return -1;
                            if (a.title > b.title) return 1;
                            return 0;
                          });
                          
                          // Pagination
                          const startIndex = (sessionReportPage - 1) * itemsPerPage;
                          const endIndex = startIndex + itemsPerPage;
                          const paginatedSessions = sessionArray.slice(startIndex, endIndex);
                          
                          return (
                            <>
                          {paginatedSessions.map((sessionData, index) => {
                            // Format time - similar to SessionList.js format
                            // SessionList.js shows time as "HH:mm - HH:mm" and date separately
                            // Here we combine date and time: "DD/MM/YYYY HH:mm - HH:mm"
                            let timeDisplay = '-';
                            try {
                              // Format date using the formatDate function (similar to SessionList.js)
                              let dateStr = '';
                              if (sessionData.sessionDate) {
                                let dateToFormat = sessionData.sessionDate;
                                
                                // Handle string - extract date part if it's a datetime string (contains 'T')
                                if (typeof dateToFormat === 'string') {
                                  // If it's a datetime string like "2025-11-25T17:00:00.000Z", extract only date part
                                  if (dateToFormat.includes('T')) {
                                    dateToFormat = dateToFormat.split('T')[0]; // Get "2025-11-25"
                                  }
                                  dateStr = formatDate(dateToFormat);
                                } else if (dateToFormat instanceof Date) {
                                  // Handle Date object
                                  const year = dateToFormat.getFullYear();
                                  const month = String(dateToFormat.getMonth() + 1).padStart(2, '0');
                                  const day = String(dateToFormat.getDate()).padStart(2, '0');
                                  dateStr = formatDate(`${year}-${month}-${day}`);
                                } else {
                                  // Try to convert to string and extract date part
                                  const dateString = String(dateToFormat);
                                  if (dateString.includes('T')) {
                                    dateToFormat = dateString.split('T')[0];
                                  }
                                  dateStr = formatDate(dateToFormat);
                                }
                              }
                              
                              // Format time - exactly like SessionList.js: "HH:mm - HH:mm"
                              // SessionList.js line 1911-1913: `${session.start_time} - ${session.end_time}`
                              if (sessionData.startTime && sessionData.endTime) {
                                let startTimeStr = String(sessionData.startTime);
                                let endTimeStr = String(sessionData.endTime);
                                
                                // Extract time part if it's a datetime string (contains 'T')
                                if (startTimeStr.includes('T')) {
                                  startTimeStr = startTimeStr.split('T')[1]?.split('.')[0] || startTimeStr;
                                }
                                if (endTimeStr.includes('T')) {
                                  endTimeStr = endTimeStr.split('T')[1]?.split('.')[0] || endTimeStr;
                                }
                                
                                // Get only HH:MM part (first 5 characters) - same as SessionList.js
                                if (startTimeStr.length > 5) {
                                  startTimeStr = startTimeStr.substring(0, 5);
                                }
                                if (endTimeStr.length > 5) {
                                  endTimeStr = endTimeStr.substring(0, 5);
                                }
                                
                                // Format: "DD/MM/YYYY HH:mm - HH:mm" (date + time like SessionList.js format)
                                if (dateStr) {
                                  timeDisplay = `${dateStr} ${startTimeStr} - ${endTimeStr}`;
                                } else {
                                  timeDisplay = `${startTimeStr} - ${endTimeStr}`;
                                }
                              } else if (dateStr) {
                                // Only date available
                                timeDisplay = dateStr;
                              }
                            } catch (error) {
                              console.error('Error formatting time:', error, sessionData);
                              timeDisplay = '-';
                            }
                            
                            // Format classes (show first 2, then count if more)
                            const classesArray = Array.from(sessionData.classes);
                            let classesDisplay = classesArray.length > 0 
                              ? classesArray.slice(0, 2).join(', ')
                              : '-';
                            if (classesArray.length > 2) {
                              classesDisplay += ` (+${classesArray.length - 2})`;
                            }
                            
                            // Format faculties - similar to UserManagement.js which shows faculty_name directly
                            // Show first 2 faculties, then count if more (similar to classes display)
                            const facultiesArray = Array.from(sessionData.faculties).filter(f => f && f !== '-');
                            let facultiesDisplay = '-';
                            if (facultiesArray.length > 0) {
                              // Show first 2 faculties, then count if more (like classes)
                              facultiesDisplay = facultiesArray.slice(0, 2).join(', ');
                              if (facultiesArray.length > 2) {
                                facultiesDisplay += ` (+${facultiesArray.length - 2})`;
                              }
                            }
                            
                            return (
                              <tr key={`session-${index}`}>
                                <td>
                                  <strong>{sessionData.title}</strong>
                                </td>
                                <td>
                                  <div className="d-flex align-items-center">
                                    <div className="status-indicator bg-info"></div>
                                    <span>{classesDisplay}</span>
                                  </div>
                                </td>
                                <td>
                                  <div className="d-flex align-items-center">
                                    <div className="status-indicator bg-primary"></div>
                                    <span>{facultiesDisplay}</span>
                                  </div>
                                </td>
                                <td>
                                  <div className="d-flex align-items-center">
                                    <i className="fas fa-map-marker-alt me-2 text-danger"></i>
                                    <span>{sessionData.location}</span>
                                  </div>
                                </td>
                                <td>
                                  <div className="d-flex align-items-center">
                                    <div className="status-indicator bg-success"></div>
                                    <OverlayTrigger
                                      placement="top"
                                      overlay={
                                        <Tooltip id={`tooltip-students-${index}`}>
                                          <div style={{ maxWidth: '300px' }}>
                                            <strong>Tổng số sinh viên:</strong><br/>
                                            {sessionData.students.size} sinh viên
                                          </div>
                                        </Tooltip>
                                      }
                                    >
                                      <strong style={{ cursor: 'pointer' }}>{sessionData.students.size}</strong>
                                    </OverlayTrigger>
                                  </div>
                                </td>
                                <td>
                                  <small className="text-muted">{timeDisplay}</small>
                                </td>
                                <td>
                                  <div className="d-flex align-items-center">
                                    <div className="status-indicator bg-success"></div>
                                    <OverlayTrigger
                                      placement="top"
                                      overlay={
                                        <Tooltip id={`tooltip-full-${index}`}>
                                          <div style={{ maxWidth: '300px' }}>
                                            <strong>Đầy đủ:</strong><br/>
                                            {sessionData.fullCount} sinh viên có mặt đầy đủ
                                          </div>
                                        </Tooltip>
                                      }
                                    >
                                      <strong style={{ cursor: 'pointer' }}>{sessionData.fullCount}</strong>
                                    </OverlayTrigger>
                                  </div>
                                </td>
                                <td>
                                  <div className="d-flex align-items-center">
                                    <div className="status-indicator bg-info"></div>
                                    <OverlayTrigger
                                      placement="top"
                                      overlay={
                                        <Tooltip id={`tooltip-before-${index}`}>
                                          <div style={{ maxWidth: '300px' }}>
                                            <strong>Có mặt trước:</strong><br/>
                                            {sessionData.beforeCount} lần có mặt trước
                                          </div>
                                        </Tooltip>
                                      }
                                    >
                                      <strong style={{ cursor: 'pointer' }}>{sessionData.beforeCount}</strong>
                                    </OverlayTrigger>
                                  </div>
                                </td>
                                <td>
                                  <div className="d-flex align-items-center">
                                    <div className="status-indicator bg-primary"></div>
                                    <OverlayTrigger
                                      placement="top"
                                      overlay={
                                        <Tooltip id={`tooltip-during-${index}`}>
                                          <div style={{ maxWidth: '300px' }}>
                                            <strong>Có mặt trong:</strong><br/>
                                            {sessionData.duringCount} lần có mặt trong
                                          </div>
                                        </Tooltip>
                                      }
                                    >
                                      <strong style={{ cursor: 'pointer' }}>{sessionData.duringCount}</strong>
                                    </OverlayTrigger>
                                  </div>
                                </td>
                                <td>
                                  <div className="d-flex align-items-center">
                                    <div className="status-indicator bg-secondary"></div>
                                    <OverlayTrigger
                                      placement="top"
                                      overlay={
                                        <Tooltip id={`tooltip-after-${index}`}>
                                          <div style={{ maxWidth: '300px' }}>
                                            <strong>Có mặt sau:</strong><br/>
                                            {sessionData.afterCount} lần có mặt sau
                                          </div>
                                        </Tooltip>
                                      }
                                    >
                                      <strong style={{ cursor: 'pointer' }}>{sessionData.afterCount}</strong>
                                    </OverlayTrigger>
                                  </div>
                                </td>
                                <td>
                                  <div className="d-flex align-items-center">
                                    <div className="status-indicator bg-success"></div>
                                    <OverlayTrigger
                                      placement="top"
                                      overlay={
                                        <Tooltip id={`tooltip-present-${index}`}>
                                          <div style={{ maxWidth: '300px' }}>
                                            <strong>Có mặt:</strong><br/>
                                            {sessionData.presentCount} lần có mặt
                                          </div>
                                        </Tooltip>
                                      }
                                    >
                                      <strong style={{ cursor: 'pointer' }}>{sessionData.presentCount}</strong>
                                    </OverlayTrigger>
                                  </div>
                                </td>
                                <td>
                                  <div className="d-flex align-items-center">
                                    <div className="status-indicator bg-warning"></div>
                                    <OverlayTrigger
                                      placement="top"
                                      overlay={
                                        <Tooltip id={`tooltip-late-${index}`}>
                                          <div style={{ maxWidth: '300px' }}>
                                            <strong>Đi trễ:</strong><br/>
                                            {sessionData.lateCount} lần đi trễ
                                          </div>
                                        </Tooltip>
                                      }
                                    >
                                      <strong style={{ cursor: 'pointer' }}>{sessionData.lateCount}</strong>
                                    </OverlayTrigger>
                                  </div>
                                </td>
                                <td>
                                  <div className="d-flex align-items-center">
                                    <div className="status-indicator bg-danger"></div>
                                    <OverlayTrigger
                                      placement="top"
                                      overlay={
                                        <Tooltip id={`tooltip-absent-${index}`}>
                                          <div style={{ maxWidth: '300px' }}>
                                            <strong>Vắng mặt:</strong><br/>
                                            {sessionData.absentCount} lần vắng mặt
                                          </div>
                                        </Tooltip>
                                      }
                                    >
                                      <strong style={{ cursor: 'pointer' }}>{sessionData.absentCount}</strong>
                                    </OverlayTrigger>
                                  </div>
                                </td>
                                <td>
                                  <div className="d-flex align-items-center">
                                    <div className="status-indicator bg-secondary"></div>
                                    <OverlayTrigger
                                      placement="top"
                                      overlay={
                                        <Tooltip id={`tooltip-full-perm-${index}`}>
                                          <div style={{ maxWidth: '300px' }}>
                                            <strong>Phép cả buổi:</strong><br/>
                                            {sessionData.absentPermCount} lần xin phép cả buổi (đã duyệt)
                                          </div>
                                        </Tooltip>
                                      }
                                    >
                                      <strong style={{ cursor: 'pointer' }}>{sessionData.absentPermCount}</strong>
                                    </OverlayTrigger>
                                  </div>
                                </td>
                                <td>
                                  <div className="d-flex align-items-center">
                                    <div className="status-indicator bg-info"></div>
                                    <OverlayTrigger
                                      placement="top"
                                      overlay={
                                        <Tooltip id={`tooltip-before-perm-${index}`}>
                                          <div style={{ maxWidth: '300px' }}>
                                            <strong>Phép trước buổi:</strong><br/>
                                            {sessionData.earlyPermCount} lần xin phép trước buổi (đã duyệt)
                                          </div>
                                        </Tooltip>
                                      }
                                    >
                                      <strong style={{ cursor: 'pointer' }}>{sessionData.earlyPermCount}</strong>
                                    </OverlayTrigger>
                                  </div>
                                </td>
                                <td>
                                  <div className="d-flex align-items-center">
                                    <div className="status-indicator bg-primary"></div>
                                    <OverlayTrigger
                                      placement="top"
                                      overlay={
                                        <Tooltip id={`tooltip-during-perm-${index}`}>
                                          <div style={{ maxWidth: '300px' }}>
                                            <strong>Phép trong buổi:</strong><br/>
                                            {sessionData.duringPermCount} lần xin phép trong buổi (đã duyệt)
                                          </div>
                                        </Tooltip>
                                      }
                                    >
                                      <strong style={{ cursor: 'pointer' }}>{sessionData.duringPermCount}</strong>
                                    </OverlayTrigger>
                                  </div>
                                </td>
                                <td>
                                  <div className="d-flex align-items-center">
                                    <div className="status-indicator bg-secondary"></div>
                                    <OverlayTrigger
                                      placement="top"
                                      overlay={
                                        <Tooltip id={`tooltip-after-perm-${index}`}>
                                          <div style={{ maxWidth: '300px' }}>
                                            <strong>Phép sau buổi:</strong><br/>
                                            {sessionData.latePermCount} lần xin phép sau buổi (đã duyệt)
                                          </div>
                                        </Tooltip>
                                      }
                                    >
                                      <strong style={{ cursor: 'pointer' }}>{sessionData.latePermCount}</strong>
                                    </OverlayTrigger>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                              {sessionArray.length > itemsPerPage && (
                                <tr>
                                  <td colSpan="17" className="text-center py-3">
                                    <Pagination
                                      currentPage={sessionReportPage}
                                      totalPages={Math.ceil(sessionArray.length / itemsPerPage)}
                                      onPageChange={setSessionReportPage}
                                    />
                                  </td>
                                </tr>
                              )}
                            </>
                          );
                        })()}
                        </tbody>
                    </table>
                  </div>
                </div>
                </Tab>

                {/* Custom Report Tab */}
                <Tab eventKey="customReport" title={
                  <span className="tab-title">
                    <i className="fas fa-sliders-h"></i>
                    Tùy chọn báo cáo
                  </span>
                }>
                  <div className="custom-report-container mt-4">
                    {/* Control Panel */}
                    <div className="custom-report-card mb-4">
                      <div 
                        className="custom-report-card-header" 
                        style={{ 
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                        onClick={() => setIsFilterSectionOpen(!isFilterSectionOpen)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div className="custom-report-card-header-icon">
                            <i className="fas fa-cog"></i>
                          </div>
                          <h6 className="mb-0">Tùy chọn hiển thị và lọc dữ liệu</h6>
                        </div>
                        <div style={{ 
                          fontSize: '18px', 
                          color: 'var(--cr-text-secondary)',
                          transition: 'transform 0.3s ease'
                        }}>
                          <i className={`fas fa-chevron-${isFilterSectionOpen ? 'up' : 'down'}`}></i>
                        </div>
                      </div>
                      <div 
                        className="custom-report-card-body" 
                        style={{
                          maxHeight: isFilterSectionOpen ? '5000px' : '0',
                          overflow: 'hidden',
                          transition: 'all 0.4s ease-in-out',
                          opacity: isFilterSectionOpen ? 1 : 0
                        }}
                      >
                        {/* Display Type Selection */}
                        <Row className="mb-4">
                          <Col md={12}>
                            <Form.Label className="custom-report-section-label">
                              <i className="fas fa-chart-bar"></i>
                              Loại hiển thị
                            </Form.Label>
                            <div className="d-flex gap-2 flex-wrap">
                              <button
                                onClick={() => setCustomReportDisplay('table')}
                                className={`custom-report-btn ${customReportDisplay === 'table' ? 'custom-report-btn-active' : 'custom-report-btn-outline'}`}
                              >
                                <i className="fas fa-table"></i>
                                Bảng
                              </button>
                              <button
                                onClick={() => setCustomReportDisplay('bar')}
                                className={`custom-report-btn ${customReportDisplay === 'bar' ? 'custom-report-btn-active' : 'custom-report-btn-outline'}`}
                              >
                                <i className="fas fa-chart-bar"></i>
                                Biểu đồ Bar
                              </button>
                              <button
                                onClick={() => setCustomReportDisplay('line')}
                                className={`custom-report-btn ${customReportDisplay === 'line' ? 'custom-report-btn-active' : 'custom-report-btn-outline'}`}
                              >
                                <i className="fas fa-chart-line"></i>
                                Biểu đồ Line
                              </button>
                              <button
                                onClick={() => setCustomReportDisplay('doughnut')}
                                className={`custom-report-btn ${customReportDisplay === 'doughnut' ? 'custom-report-btn-active' : 'custom-report-btn-outline'}`}
                              >
                                <i className="fas fa-chart-pie"></i>
                                Biểu đồ Doughnut
                              </button>
                              <button
                                onClick={() => setCustomReportDisplay('weekly_stats')}
                                className={`custom-report-btn ${customReportDisplay === 'weekly_stats' ? 'custom-report-btn-success' : 'custom-report-btn-outline'}`}
                              >
                                <i className="fas fa-calendar-week"></i>
                                Thống kê theo tuần
                              </button>
                            </div>
                          </Col>
                        </Row>

                        {/* Weekly Statistics Options - Only for weekly_stats view */}
                        {customReportDisplay === 'weekly_stats' && (
                          <Row className="mb-4">
                            <Col md={6}>
                              <Form.Label className="custom-report-section-label">
                                <i className="fas fa-layer-group"></i>
                                Nhóm thống kê theo
                              </Form.Label>
                              <div className="d-flex gap-2 flex-wrap">
                                <button
                                  onClick={() => {
                                    setWeeklyStatsGroupBy('faculty');
                                    const facultyValue = customReportFilters.facultyName || weeklyStatsFilters.facultyName || '';
                                    if (facultyValue) {
                                      setWeeklyStatsSelectedFilter(facultyValue);
                                    }
                                  }}
                                  className={`custom-report-btn ${weeklyStatsGroupBy === 'faculty' ? 'custom-report-btn-active' : 'custom-report-btn-outline'}`}
                                  style={{ fontSize: '13px', padding: '8px 16px' }}
                                >
                                  <i className="fas fa-university"></i>
                                  Khoa
                                </button>
                                <button
                                  onClick={() => {
                                    setWeeklyStatsGroupBy('location');
                                    const locationValue = customReportFilters.location || weeklyStatsFilters.location || '';
                                    if (locationValue) {
                                      setWeeklyStatsSelectedFilter(locationValue);
                                    }
                                  }}
                                  className={`custom-report-btn ${weeklyStatsGroupBy === 'location' ? 'custom-report-btn-active' : 'custom-report-btn-outline'}`}
                                  style={{ fontSize: '13px', padding: '8px 16px' }}
                                >
                                  <i className="fas fa-hospital"></i>
                                  Bệnh viện
                                </button>
                                <button
                                  onClick={() => {
                                    setWeeklyStatsGroupBy('class');
                                    const classValue = customReportFilters.className || weeklyStatsFilters.className || '';
                                    if (classValue) {
                                      setWeeklyStatsSelectedFilter(classValue);
                                    }
                                  }}
                                  className={`custom-report-btn ${weeklyStatsGroupBy === 'class' ? 'custom-report-btn-active' : 'custom-report-btn-outline'}`}
                                  style={{ fontSize: '13px', padding: '8px 16px' }}
                                >
                                  <i className="fas fa-graduation-cap"></i>
                                  Lớp
                                </button>
                                <button
                                  onClick={() => {
                                    setWeeklyStatsGroupBy('group');
                                    const groupValue = customReportFilters.groupId || weeklyStatsFilters.groupId || '';
                                    if (groupValue) {
                                      setWeeklyStatsSelectedFilter(groupValue);
                                    }
                                  }}
                                  className={`custom-report-btn ${weeklyStatsGroupBy === 'group' ? 'custom-report-btn-active' : 'custom-report-btn-outline'}`}
                                  style={{ fontSize: '13px', padding: '8px 16px' }}
                                >
                                  <i className="fas fa-users"></i>
                                  Nhóm
                                </button>
                                <button
                                  onClick={() => {
                                    setWeeklyStatsGroupBy('session_title');
                                    setWeeklyStatsSelectedFilter('');
                                  }}
                                  className={`custom-report-btn ${weeklyStatsGroupBy === 'session_title' ? 'custom-report-btn-active' : 'custom-report-btn-outline'}`}
                                  style={{ fontSize: '13px', padding: '8px 16px' }}
                                >
                                  <i className="fas fa-book"></i>
                                  Tên buổi học
                                </button>
                              </div>
                            </Col>
                            <Col md={6}>
                              <Form.Group>
                                <Form.Label className="custom-report-form-label">
                                  <i className="fas fa-filter"></i>
                                  {weeklyStatsGroupBy === 'faculty' && 'Chọn Khoa'}
                                  {weeklyStatsGroupBy === 'location' && 'Chọn Bệnh viện'}
                                  {weeklyStatsGroupBy === 'class' && 'Chọn Lớp'}
                                  {weeklyStatsGroupBy === 'group' && 'Chọn Nhóm'}
                                  {weeklyStatsGroupBy === 'session_title' && 'Chọn Tên buổi học'}
                                </Form.Label>
                                <Form.Select
                                  className="custom-report-form-control"
                                  value={weeklyStatsSelectedFilter}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setWeeklyStatsSelectedFilter(value);
                                    
                                    // Đồng bộ với bộ lọc chung
                                    switch (weeklyStatsGroupBy) {
                                      case 'faculty':
                                        handleCustomReportFilterChange('facultyName', value);
                                        setWeeklyStatsFilters(prev => ({ ...prev, facultyName: value }));
                                        break;
                                      case 'location':
                                        handleCustomReportFilterChange('location', value);
                                        setWeeklyStatsFilters(prev => ({ ...prev, location: value }));
                                        break;
                                      case 'class':
                                        handleCustomReportFilterChange('className', value);
                                        setWeeklyStatsFilters(prev => ({ ...prev, className: value }));
                                        break;
                                      case 'group':
                                        handleCustomReportFilterChange('groupId', value);
                                        setWeeklyStatsFilters(prev => ({ ...prev, groupId: value }));
                                        break;
                                      case 'session_title':
                                        // Không cần đồng bộ với bộ lọc chung vì session_title không có trong customReportFilters
                                        break;
                                    }
                                  }}
                                >
                                  <option value="">Tất cả</option>
                                  {weeklyStatsFilterOptions.map((option, idx) => (
                                    <option key={idx} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </Form.Select>
                              </Form.Group>
                            </Col>
                          </Row>
                        )}

                        {/* Column Selection - Only for table view */}
                        {customReportDisplay === 'table' && (
                          <Row className="mb-4">
                            <Col md={12}>
                              <Form.Label className="custom-report-section-label">
                                <i className="fas fa-columns"></i>
                                Cột hiển thị
                              </Form.Label>
                              <div className="d-flex gap-2 align-items-center mb-3">
                                <button
                                  onClick={() => setShowColumnSelector(!showColumnSelector)}
                                  className="custom-report-btn custom-report-btn-secondary"
                                >
                                  <i className={`fas fa-${showColumnSelector ? 'eye-slash' : 'eye'}`}></i>
                                  {showColumnSelector ? 'Ẩn' : 'Hiện'} tùy chọn cột
                                </button>
                                <span className="custom-report-badge custom-report-badge-info">
                                  {customReportColumns.length} cột được chọn
                                </span>
                              </div>
                              {showColumnSelector && (
                                <div className="custom-report-column-selector">
                                  <Row>
                                    {availableColumns.map(col => (
                                      <Col md={3} sm={6} key={col.key} className="mb-2">
                                        <div className="custom-report-checkbox">
                                          <input
                                            type="checkbox"
                                            id={`col-${col.key}`}
                                            checked={customReportColumns.includes(col.key)}
                                            onChange={() => toggleColumn(col.key)}
                                          />
                                          <label htmlFor={`col-${col.key}`}>{col.label}</label>
                                        </div>
                                      </Col>
                                    ))}
                                  </Row>
                                </div>
                              )}
                            </Col>
                          </Row>
                        )}

                        {/* Divider */}
                        <div style={{
                          height: '1px',
                          background: 'linear-gradient(90deg, transparent, var(--cr-gray-300) 20%, var(--cr-gray-300) 80%, transparent)',
                          margin: '2rem 0',
                          position: 'relative'
                        }}>
                          <div style={{
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                            background: 'var(--cr-gray-50)',
                            padding: '0 1rem',
                            color: 'var(--cr-gray-400)',
                            fontSize: '12px',
                            fontWeight: '600',
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase'
                          }}>
                            <i className="fas fa-filter" style={{ marginRight: '6px' }}></i>
                            Bộ lọc
                          </div>
                        </div>

                        {/* Filters */}
                        <Row className="mb-4">
                          <Col md={3}>
                            <Form.Group>
                              <Form.Label className="custom-report-form-label">
                                <i className="fas fa-calendar"></i>
                                Từ ngày
                              </Form.Label>
                              <Form.Control
                                type="date"
                                value={customReportDisplay === 'weekly_stats' ? (weeklyStatsFilters.startDate || customReportFilters.startDate) : customReportFilters.startDate}
                                onChange={(e) => {
                                  handleCustomReportFilterChange('startDate', e.target.value);
                                  if (customReportDisplay === 'weekly_stats') {
                                    setWeeklyStatsFilters(prev => ({ ...prev, startDate: e.target.value }));
                                  }
                                }}
                                className="custom-report-form-control"
                              />
                            </Form.Group>
                          </Col>
                          <Col md={3}>
                            <Form.Group>
                              <Form.Label className="custom-report-form-label">
                                <i className="fas fa-calendar"></i>
                                Đến ngày
                              </Form.Label>
                              <Form.Control
                                type="date"
                                value={customReportDisplay === 'weekly_stats' ? (weeklyStatsFilters.endDate || customReportFilters.endDate) : customReportFilters.endDate}
                                onChange={(e) => {
                                  handleCustomReportFilterChange('endDate', e.target.value);
                                  if (customReportDisplay === 'weekly_stats') {
                                    setWeeklyStatsFilters(prev => ({ ...prev, endDate: e.target.value }));
                                  }
                                }}
                                className="custom-report-form-control"
                              />
                            </Form.Group>
                          </Col>
                          <Col md={3}>
                            <Form.Group>
                              <Form.Label className="custom-report-form-label">
                                <i className="fas fa-users"></i>
                                Nhóm
                              </Form.Label>
                              <Form.Select
                                value={customReportDisplay === 'weekly_stats' ? (weeklyStatsFilters.groupId || customReportFilters.groupId) : customReportFilters.groupId}
                                onChange={(e) => {
                                  handleCustomReportFilterChange('groupId', e.target.value);
                                  if (customReportDisplay === 'weekly_stats') {
                                    setWeeklyStatsFilters(prev => ({ ...prev, groupId: e.target.value }));
                                    if (weeklyStatsGroupBy === 'group') {
                                      setWeeklyStatsSelectedFilter(e.target.value);
                                    }
                                  }
                                }}
                                className="custom-report-form-control"
                              >
                                <option value="">Tất cả nhóm</option>
                                {groups.map(group => (
                                  <option key={group.id} value={group.id}>
                                    {group.group_name || group.name}
                                  </option>
                                ))}
                              </Form.Select>
                            </Form.Group>
                          </Col>
                          <Col md={3}>
                            <Form.Group>
                              <Form.Label className="custom-report-form-label">
                                <i className="fas fa-graduation-cap"></i>
                                Lớp
                              </Form.Label>
                              <Form.Select
                                value={customReportDisplay === 'weekly_stats' ? (weeklyStatsFilters.className || customReportFilters.className) : customReportFilters.className}
                                onChange={(e) => {
                                  handleCustomReportFilterChange('className', e.target.value);
                                  if (customReportDisplay === 'weekly_stats') {
                                    setWeeklyStatsFilters(prev => ({ ...prev, className: e.target.value }));
                                    if (weeklyStatsGroupBy === 'class') {
                                      setWeeklyStatsSelectedFilter(e.target.value);
                                    }
                                  }
                                }}
                                className="custom-report-form-control"
                              >
                                <option value="">Tất cả lớp</option>
                                {availableClasses.map((className, index) => (
                                  <option key={index} value={className}>
                                    {className}
                                  </option>
                                ))}
                              </Form.Select>
                            </Form.Group>
                          </Col>
                        </Row>

                        <Row className="mb-4">
                          <Col md={3}>
                            <Form.Group style={{ position: 'relative' }} className="student-search-container">
                              <Form.Label className="custom-report-form-label">
                                <i className="fas fa-user"></i>
                                Tên sinh viên
                              </Form.Label>
                              <div style={{ position: 'relative' }}>
                                <Form.Control
                                  ref={studentSearchInputRef}
                                  type="text"
                                  placeholder="Tìm kiếm tên sinh viên..."
                                  value={studentSearchTerm}
                                  onChange={(e) => {
                                    setStudentSearchTerm(e.target.value);
                                    if (!e.target.value) {
                                      setSelectedStudent(null);
                                      handleCustomReportFilterChange('studentName', '');
                                      if (customReportDisplay === 'weekly_stats') {
                                        setWeeklyStatsFilters(prev => ({ ...prev, studentName: '' }));
                                      }
                                    }
                                  }}
                                  onFocus={() => {
                                    if (studentSearchResults.length > 0) {
                                      setShowStudentSearchResults(true);
                                    }
                                  }}
                                  className="custom-report-form-control"
                                />
                                {showStudentSearchResults && studentSearchResults.length > 0 && (
                                  <div 
                                    ref={studentSearchDropdownRef}
                                    className="custom-report-student-dropdown"
                                    onMouseDown={(e) => e.preventDefault()}
                                  >
                                    {studentSearchResults.map((student) => (
                                      <div
                                        key={student.id}
                                        onClick={() => {
                                          setSelectedStudent(student);
                                          setStudentSearchTerm(student.full_name || student.name);
                                          handleCustomReportFilterChange('studentName', student.full_name || student.name);
                                          if (customReportDisplay === 'weekly_stats') {
                                            setWeeklyStatsFilters(prev => ({ ...prev, studentName: student.full_name || student.name }));
                                          }
                                          setShowStudentSearchResults(false);
                                        }}
                                        className="custom-report-student-item"
                                      >
                                        <div style={{ fontWeight: '500' }}>{student.full_name || student.name}</div>
                                        <small className="text-muted">
                                          {student.student_id && `Mã: ${student.student_id}`}
                                          {student.class_name && ` | Lớp: ${student.class_name}`}
                                        </small>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              {selectedStudent && (
                                <small className="text-muted d-block mt-1">
                                  Đã chọn: <strong>{selectedStudent.full_name || selectedStudent.name}</strong>
                                  <Button
                                    variant="link"
                                    size="sm"
                                    className="p-0 ms-2"
                                    onClick={() => {
                                      setSelectedStudent(null);
                                      setStudentSearchTerm('');
                                      handleCustomReportFilterChange('studentName', '');
                                      if (customReportDisplay === 'weekly_stats') {
                                        setWeeklyStatsFilters(prev => ({ ...prev, studentName: '' }));
                                      }
                                    }}
                                    style={{ fontSize: '0.75rem', padding: '0', textDecoration: 'none' }}
                                  >
                                    <i className="fas fa-times"></i>
                                  </Button>
                                </small>
                              )}
                            </Form.Group>
                          </Col>
                          <Col md={3}>
                            <Form.Group>
                              <Form.Label className="custom-report-form-label">
                                <i className="fas fa-check-circle"></i>
                                Loại điểm danh
                              </Form.Label>
                              <Form.Select
                                value={customReportDisplay === 'weekly_stats' ? (weeklyStatsFilters.attendanceType || customReportFilters.attendanceType) : customReportFilters.attendanceType}
                                onChange={(e) => {
                                  handleCustomReportFilterChange('attendanceType', e.target.value);
                                  if (customReportDisplay === 'weekly_stats') {
                                    setWeeklyStatsFilters(prev => ({ ...prev, attendanceType: e.target.value }));
                                  }
                                }}
                                className="custom-report-form-control"
                              >
                                <option value="">Tất cả</option>
                                <option value="before">Trước giờ</option>
                                <option value="during">Trong giờ</option>
                                <option value="after">Sau giờ</option>
                                <option value="early">Sớm</option>
                                <option value="late">Đi trễ</option>
                                <option value="late_before">Đi trễ (Trước)</option>
                                <option value="late_leave">Về trễ</option>
                                <option value="absent">Vắng</option>
                                <option value="absent_perm">Phép cả buổi</option>
                                <option value="absent_before_perm">Phép trước giờ</option>
                                <option value="absent_during_perm">Phép trong giờ</option>
                                <option value="absent_after_perm">Phép sau giờ</option>
                              </Form.Select>
                            </Form.Group>
                          </Col>
                          <Col md={3}>
                            <Form.Group>
                              <Form.Label className="custom-report-form-label">
                                <i className="fas fa-map-marker-alt"></i>
                                Địa điểm
                              </Form.Label>
                              <Form.Select
                                value={customReportDisplay === 'weekly_stats' ? (weeklyStatsFilters.location || customReportFilters.location) : customReportFilters.location}
                                onChange={(e) => {
                                  handleCustomReportFilterChange('location', e.target.value);
                                  if (customReportDisplay === 'weekly_stats') {
                                    setWeeklyStatsFilters(prev => ({ ...prev, location: e.target.value }));
                                    if (weeklyStatsGroupBy === 'location') {
                                      setWeeklyStatsSelectedFilter(e.target.value);
                                    }
                                  }
                                }}
                                className="custom-report-form-control"
                              >
                                <option value="">Tất cả địa điểm</option>
                                {predefinedLocations.map((location, index) => (
                                  <option key={index} value={location.name}>
                                    {location.name}
                                  </option>
                                ))}
                              </Form.Select>
                            </Form.Group>
                          </Col>
                          <Col md={3}>
                            <Form.Group>
                              <Form.Label className="custom-report-form-label">
                                <i className="fas fa-university"></i>
                                Khoa
                              </Form.Label>
                              <Form.Select
                                value={customReportDisplay === 'weekly_stats' ? (weeklyStatsFilters.facultyName || customReportFilters.facultyName) : customReportFilters.facultyName}
                                onChange={(e) => {
                                  handleCustomReportFilterChange('facultyName', e.target.value);
                                  if (customReportDisplay === 'weekly_stats') {
                                    setWeeklyStatsFilters(prev => ({ ...prev, facultyName: e.target.value }));
                                    if (weeklyStatsGroupBy === 'faculty') {
                                      setWeeklyStatsSelectedFilter(e.target.value);
                                    }
                                  }
                                }}
                                className="custom-report-form-control"
                              >
                                <option value="">Tất cả khoa</option>
                                {availableFaculties.map((faculty, index) => (
                                  <option key={index} value={faculty}>
                                    {faculty}
                                  </option>
                                ))}
                              </Form.Select>
                            </Form.Group>
                          </Col>
                        </Row>

                        <Row>
                          <Col md={12}>
                            <div className="custom-report-actions">
                              <button
                                onClick={() => {
                                  if (customReportDisplay === 'weekly_stats') {
                                    fetchWeeklyStatistics();
                                  } else {
                                    fetchCustomReport(customReportFilters, 1);
                                  }
                                }}
                                disabled={customReportLoading || weeklyStatsLoading}
                                className="custom-report-btn custom-report-btn-primary"
                              >
                                {(customReportLoading || weeklyStatsLoading) ? (
                                  <>
                                    <div className="custom-report-loading-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px', marginRight: '8px' }}></div>
                                    Đang tải...
                                  </>
                                ) : (
                                  <>
                                    <i className="fas fa-search"></i>
                                    Áp dụng bộ lọc
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => {
                                  setCustomReportFilters({
                                    startDate: '',
                                    endDate: '',
                                    groupId: '',
                                    className: '',
                                    studentName: '',
                                    attendanceType: '',
                                    location: '',
                                    facultyName: '',
                                    sortField: 'session_date',
                                    sortOrder: 'desc'
                                  });
                                  setWeeklyStatsFilters({
                                    startDate: '',
                                    endDate: '',
                                    facultyName: '',
                                    location: '',
                                    className: '',
                                    groupId: ''
                                  });
                                  setWeeklyStatsSelectedFilter('');
                                  setCustomReportPagination(prev => ({ ...prev, page: 1 }));
                                }}
                                className="custom-report-btn custom-report-btn-secondary"
                              >
                                <i className="fas fa-redo"></i>
                                Đặt lại
                              </button>
                              {(customReportDisplay === 'table' || customReportDisplay === 'bar' || customReportDisplay === 'line' || customReportDisplay === 'doughnut') && (
                                <button
                                  onClick={customReportDisplay === 'table' ? exportCustomReportToExcel : exportChartToExcel}
                                  disabled={customReportLoading || customReportData.length === 0}
                                  className="custom-report-btn custom-report-btn-success"
                                >
                                  <i className="fas fa-file-excel"></i>
                                  Xuất Excel
                                </button>
                              )}
                              {customReportDisplay === 'weekly_stats' && (
                                <button
                                  onClick={exportWeeklyStatsToExcel}
                                  disabled={weeklyStatsLoading || weeklyStatsData.length === 0}
                                  className="custom-report-btn custom-report-btn-success"
                                >
                                  <i className="fas fa-file-excel"></i>
                                  Xuất Excel
                                </button>
                              )}
                            </div>
                          </Col>
                        </Row>
                      </div>
                    </div>

                    {/* Results Section */}
                    {customReportLoading ? (
                      <div className="custom-report-card">
                        <div className="custom-report-loading">
                          <div className="custom-report-loading-spinner"></div>
                          <p style={{ marginTop: '16px', color: 'var(--cr-gray-500)', fontSize: '14px' }}>Đang tải dữ liệu...</p>
                        </div>
                      </div>
                    ) : customReportDisplay === 'table' ? (
                      <>
                        {/* Table View */}
                        <div className="custom-report-card" ref={customReportSectionRef}>
                          <div className="custom-report-card-header">
                            <div className="custom-report-card-header-icon">
                              <i className="fas fa-table"></i>
                            </div>
                            <h6 className="mb-0">Kết quả tìm kiếm</h6>
                            <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <span className="custom-report-badge custom-report-badge-success">
                                {customReportData.length} dòng
                              </span>
                              <span className="custom-report-badge custom-report-badge-primary">
                                Tổng: {customReportPagination.totalItems}
                              </span>
                            </div>
                          </div>
                          <div className="custom-report-card-body">
                            <div className="table-responsive">
                              <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd}
                              >
                              <Table className="custom-report-table" striped bordered hover>
                                  <thead className="table-light">
                                    <tr>
                                      <th style={{ width: '50px' }}>#</th>
                                      <SortableContext
                                        items={customReportColumns}
                                        strategy={horizontalListSortingStrategy}
                                      >
                                        {customReportColumns.map((columnKey) => {
                                          const label = columnLabels[columnKey] || columnKey;
                                          return (
                                            <SortableHeader
                                              key={columnKey}
                                              id={columnKey}
                                              onSort={() => handleCustomReportSort(columnKey)}
                                              sortField={customReportFilters.sortField}
                                              sortOrder={customReportFilters.sortOrder}
                                            >
                                              {label}
                                            </SortableHeader>
                                          );
                                        })}
                                      </SortableContext>
                                    </tr>
                                  </thead>
                                  <tbody>
                                  {customReportData.length > 0 ? (
                                    customReportData.map((record, index) => (
                                      <tr key={`${record.id}-${record.session_id}-${record.student_id}-${index}`}>
                                        <td>{(customReportPagination.page - 1) * customReportPagination.limit + index + 1}</td>
                                        {customReportColumns.map((columnKey) => {
                                          switch (columnKey) {
                                            case 'student_name':
                                              return <td key={columnKey}>{record.student_name}</td>;
                                            case 'student_code':
                                              return <td key={columnKey}>{record.student_code}</td>;
                                            case 'student_email':
                                              return <td key={columnKey}>{record.student_email}</td>;
                                            case 'class_name':
                                              return <td key={columnKey}>{record.class_name}</td>;
                                            case 'faculty_name':
                                              return <td key={columnKey}>{record.faculty_name}</td>;
                                            case 'gender':
                                              return (
                                                <td key={columnKey}>
                                                  {(() => {
                                                    const gender = record.gender;
                                                    if (gender === null || gender === undefined || gender === '') {
                                                      return 'Chưa có';
                                                    } else if (gender === 'female' || gender === 'Female' || gender === 'Nữ') {
                                                      return 'Nam';
                                                    } else if (gender === 'male' || gender === 'Male' || gender === 'Nam') {
                                                      return 'Nữ';
                                                    } else if (gender === 'other' || gender === 'Khác') {
                                                      return 'Khác';
                                                    } else {
                                                      return gender || 'Chưa có';
                                                    }
                                                  })()}
                                                </td>
                                              );
                                            case 'session_title':
                                              return <td key={columnKey}>{record.session_title}</td>;
                                            case 'session_date':
                                              return <td key={columnKey}>{record.session_date ? formatDate(record.session_date) : ''}</td>;
                                            case 'session_location':
                                              return <td key={columnKey}>{record.session_location}</td>;
                                            case 'group_name':
                                              return <td key={columnKey}>{formatGroupName(record.group_name)}</td>;
                                            case 'attendance_type':
                                              return (
                                                <td key={columnKey}>
                                                  <Badge bg={getAttendanceTypeBadgeColor(record.attendance_type)}>
                                                    {getAttendanceTypeLabel(record.attendance_type)}
                                                  </Badge>
                                                </td>
                                              );
                                            case 'timestamp':
                                              return <td key={columnKey}>{record.timestamp ? new Date(record.timestamp).toLocaleString('vi-VN') : ''}</td>;
                                            case 'minutes_early':
                                              return <td key={columnKey}>{record.minutes_early || '-'}</td>;
                                            case 'minutes_late':
                                              return <td key={columnKey}>{record.minutes_late || '-'}</td>;
                                            case 'device_mac':
                                              return <td key={columnKey}><small>{record.device_mac || '-'}</small></td>;
                                            case 'ip_address':
                                              return <td key={columnKey}><small>{record.ip_address || '-'}</small></td>;
                                            default:
                                              return <td key={columnKey}>-</td>;
                                          }
                                        })}
                                      </tr>
                                    ))
                                  ) : (
                                    <tr>
                                      <td colSpan={customReportColumns.length + 1} className="text-center py-5">
                                        <div className="custom-report-empty">
                                          <div className="custom-report-empty-icon">
                                            <i className="fas fa-inbox"></i>
                                          </div>
                                          <p className="custom-report-empty-text">Không có dữ liệu phù hợp với bộ lọc</p>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </Table>
                            </DndContext>
                            </div>

                            {/* Pagination Controls */}
                            <div className="mt-3">
                              {customReportData.length > 0 ? (
                                <Pagination
                                  currentPage={customReportPagination.page}
                                  totalPages={customReportPagination.totalPages || 1}
                                  onPageChange={(page) => {
                                    console.log(`📄 Changing to page ${page} (Total pages: ${customReportPagination.totalPages}, Total items: ${customReportPagination.totalItems})`);
                                    setCustomReportPagination(prev => ({ ...prev, page }));
                                    // Scroll to the custom report section instead of top of page
                                    if (customReportSectionRef.current) {
                                      customReportSectionRef.current.scrollIntoView({ 
                                        behavior: 'smooth', 
                                        block: 'start' 
                                      });
                                    }
                                  }}
                                />
                              ) : (
                                <div className="text-center text-muted py-2">
                                  <small>Chưa có dữ liệu. Vui lòng áp dụng bộ lọc để xem kết quả.</small>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : customReportDisplay === 'weekly_stats' ? (
                      <>
                        {/* Weekly Statistics View */}
                        <div className="custom-report-card" ref={weeklyStatsSectionRef}>
                          <div className="custom-report-card-header">
                            <div className="custom-report-card-header-icon">
                              <i className="fas fa-calendar-week"></i>
                            </div>
                            <h6 className="mb-0">
                              Thống kê theo tuần - {
                                weeklyStatsGroupBy === 'faculty' ? 'Theo Khoa' :
                                weeklyStatsGroupBy === 'location' ? 'Theo Bệnh viện' :
                                weeklyStatsGroupBy === 'class' ? 'Theo Lớp' :
                                weeklyStatsGroupBy === 'group' ? 'Theo Nhóm' :
                                'Theo Tên buổi học'
                              }
                            </h6>
                            <span className="custom-report-badge custom-report-badge-primary" style={{ marginLeft: 'auto' }}>
                              {weeklyStatsData.length} kết quả
                            </span>
                          </div>
                          <div className="custom-report-card-body">
                            <div className="table-responsive">
                              <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleWeeklyStatsDragEnd}
                              >
                              <Table className="custom-report-table" striped bordered hover>
                                  <thead className="table-light">
                                    <tr>
                                      <th style={{ width: '50px' }}>#</th>
                                      <SortableContext
                                        items={weeklyStatsColumns}
                                        strategy={horizontalListSortingStrategy}
                                      >
                                        {weeklyStatsColumns.map((columnKey) => {
                                          const label = getWeeklyStatsColumnLabel(columnKey, weeklyStatsGroupBy);
                                          return (
                                            <SortableHeader
                                              key={columnKey}
                                              id={columnKey}
                                              onSort={() => handleWeeklyStatsSort(columnKey)}
                                              sortField={weeklyStatsSortField}
                                              sortOrder={weeklyStatsSortOrder}
                                            >
                                              {label}
                                            </SortableHeader>
                                          );
                                        })}
                                      </SortableContext>
                                    </tr>
                                  </thead>
                                <tbody>
                                  {paginatedWeeklyStatsData.length > 0 ? (
                                    paginatedWeeklyStatsData.map((stat, index) => (
                                      <tr 
                                        key={index}
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => fetchWeeklyStatisticsDetail(stat)}
                                        title="Click để xem chi tiết"
                                      >
                                        <td>{(weeklyStatsPage - 1) * weeklyStatsItemsPerPage + index + 1}</td>
                                        {weeklyStatsColumns.map((columnKey) => {
                                          switch (columnKey) {
                                            case 'group_key':
                                              return <td key={columnKey}><strong>{stat.group_key || '-'}</strong></td>;
                                            case 'sub_group':
                                              return <td key={columnKey}>{stat.sub_group || '-'}</td>;
                                            case 'week':
                                              return (
                                                <td key={columnKey}>
                                                  <small>
                                                    {new Date(stat.week_start).toLocaleDateString('vi-VN')} 
                                                    {' - '}
                                                    {new Date(stat.week_end).toLocaleDateString('vi-VN')}
                                                  </small>
                                                </td>
                                              );
                                            case 'student_count':
                                              return (
                                                <td key={columnKey} style={{ textAlign: 'center' }}>
                                                  <Badge 
                                                    bg="success" 
                                                    style={{ cursor: 'pointer', fontSize: '1rem' }}
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      fetchWeeklyStatisticsDetail(stat);
                                                    }}
                                                  >
                                                    {stat.student_count}
                                                  </Badge>
                                                </td>
                                              );
                                            case 'classes':
                                              return (
                                                <td key={columnKey} style={{ textAlign: 'center' }}>
                                                  <OverlayTrigger
                                                    placement="top"
                                                    overlay={
                                                      <Tooltip>
                                                        {stat.classes && stat.classes.length > 0 
                                                          ? stat.classes.join(', ') 
                                                          : 'Chưa có thông tin'}
                                                      </Tooltip>
                                                    }
                                                  >
                                                    <Badge bg="info" style={{ cursor: 'help' }}>
                                                      {stat.classes ? stat.classes.length : 0}
                                                    </Badge>
                                                  </OverlayTrigger>
                                                </td>
                                              );
                                            case 'session_count':
                                              return (
                                                <td key={columnKey} style={{ textAlign: 'center' }}>
                                                  <Badge bg="primary">{stat.session_count}</Badge>
                                                </td>
                                              );
                                            case 'attendance_count':
                                              return (
                                                <td key={columnKey} style={{ textAlign: 'center' }}>
                                                  <Badge bg="secondary">{stat.attendance_count}</Badge>
                                                </td>
                                              );
                                            default:
                                              return <td key={columnKey}>-</td>;
                                          }
                                        })}
                                      </tr>
                                    ))
                                  ) : (
                                    <tr>
                                      <td colSpan={weeklyStatsColumns.length + 1} className="text-center py-5">
                                        <div className="custom-report-empty">
                                          <div className="custom-report-empty-icon">
                                            <i className="fas fa-inbox"></i>
                                          </div>
                                          <p className="custom-report-empty-text">Không có dữ liệu thống kê</p>
                                          <p className="custom-report-empty-subtext">Vui lòng chọn khoảng thời gian và áp dụng bộ lọc</p>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </Table>
                            </DndContext>
                            </div>

                            {/* Pagination Controls for Weekly Statistics */}
                            {sortedWeeklyStatsData.length > 0 && (
                              <div className="mt-3">
                                <Pagination
                                  currentPage={weeklyStatsPage}
                                  totalPages={weeklyStatsTotalPages}
                                  onPageChange={(page) => {
                                    setWeeklyStatsPage(page);
                                    // Scroll to the weekly stats section instead of top of page
                                    if (weeklyStatsSectionRef.current) {
                                      weeklyStatsSectionRef.current.scrollIntoView({ 
                                        behavior: 'smooth', 
                                        block: 'start' 
                                      });
                                    }
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      /* Chart View */
                      <div className="custom-report-card">
                        <div className="custom-report-card-header">
                          <div className="custom-report-card-header-icon">
                            <i className="fas fa-chart-bar"></i>
                          </div>
                          <h6 className="mb-0">Biểu đồ phân tích</h6>
                        </div>
                        <div className="custom-report-card-body">
                          {renderCustomReportChart()}
                        </div>
                      </div>
                    )}
                  </div>
                </Tab>

              </Tabs>

              {/* Weekly Statistics Detail Modal */}
              <Modal 
                show={showWeeklyStatsDetailModal} 
                onHide={() => setShowWeeklyStatsDetailModal(false)} 
                size="xl"
                className="student-detail-modal"
              >
                <Modal.Header closeButton className="student-detail-header">
                  <Modal.Title className="student-detail-title">
                    <div className="student-avatar">
                      <i className="fas fa-list-alt"></i>
                    </div>
                    <div>
                      <h4 className="mb-0">Chi tiết thống kê</h4>
                      <p className="mb-0 student-subtitle">
                        {selectedWeeklyStat?.group_key} - {selectedWeeklyStat?.sub_group}
                        {' | '}
                        Tuần: {selectedWeeklyStat && new Date(selectedWeeklyStat.week_start).toLocaleDateString('vi-VN')}
                        {' - '}
                        {selectedWeeklyStat && new Date(selectedWeeklyStat.week_end).toLocaleDateString('vi-VN')}
                      </p>
                    </div>
                  </Modal.Title>
                </Modal.Header>
                <Modal.Body className="student-detail-body">
                  {weeklyStatsDetailLoading ? (
                    <div className="text-center py-5">
                      <Spinner animation="border" variant="primary" />
                      <p className="mt-3">Đang tải chi tiết...</p>
                    </div>
                  ) : (
                    <div className="student-detail-container">
                      <div className="session-card">
                        <div className="card-header-modern">
                          <div className="header-icon">
                            <i className="fas fa-users"></i>
                          </div>
                          <h6 className="mb-0">Danh sách sinh viên ({weeklyStatsDetailData.length})</h6>
                          <Button
                            variant="success"
                            size="sm"
                            onClick={exportWeeklyStatsDetailToExcel}
                            disabled={weeklyStatsDetailData.length === 0}
                          >
                            <i className="fas fa-file-excel me-1"></i>
                            Xuất Excel
                          </Button>
                        </div>
                        <div className="card-body-modern">
                          <div className="table-responsive" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                            <Table striped bordered hover size="sm">
                              <thead className="table-light sticky-top">
                                <tr>
                                  <th>#</th>
                                  <th>Mã SV</th>
                                  <th>Họ và tên</th>
                                  <th>Lớp</th>
                                  <th>Khoa</th>
                                  <th>Giới tính</th>
                                  <th>Tên buổi học</th>
                                  <th>Ngày học</th>
                                  <th>Địa điểm</th>
                                  <th>Loại điểm danh</th>
                                </tr>
                              </thead>
                              <tbody>
                                {weeklyStatsDetailData.map((record, index) => (
                                  <tr key={index}>
                                    <td>{index + 1}</td>
                                    <td><Badge bg="secondary">{record.student_code}</Badge></td>
                                    <td>{record.student_name}</td>
                                    <td><Badge bg="info">{record.class_name}</Badge></td>
                                    <td>{record.faculty_name}</td>
                                    <td>
                                      {record.gender === null || record.gender === undefined || record.gender === '' ? 'Chưa có' :
                                       record.gender === 'female' || record.gender === 'Female' || record.gender === 'Nữ' ? 'Nam' :
                                       record.gender === 'male' || record.gender === 'Male' || record.gender === 'Nam' ? 'Nữ' :
                                       record.gender === 'other' || record.gender === 'Khác' ? 'Khác' : 'Chưa có'}
                                    </td>
                                    <td><small>{record.session_title}</small></td>
                                    <td><small>{formatDate(record.session_date)}</small></td>
                                    <td><small>{record.session_location}</small></td>
                                    <td>
                                      <Badge bg={getAttendanceTypeBadgeColor(record.attendance_type)}>
                                        {getAttendanceTypeLabel(record.attendance_type)}
                                      </Badge>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </Table>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </Modal.Body>
                <Modal.Footer className="student-detail-footer">
                  <Button 
                    variant="outline-secondary" 
                    onClick={() => setShowWeeklyStatsDetailModal(false)}
                    className="btn-cancel"
                  >
                    <i className="fas fa-times me-2"></i>
                    Đóng
                  </Button>
                </Modal.Footer>
              </Modal>
          </div>
            )}
            
            {/* Loading state with progress */}
            {loading && (
              <div className="text-center py-5">
                <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                  <Spinner animation="border" variant="primary" style={{ width: '3rem', height: '3rem' }} />
                  <h5 className="mt-4 mb-3" style={{ color: '#2c3e50', fontWeight: '600' }}>
                    {loadingMessage}
                  </h5>
                  
                  {/* Progress Bar */}
                  <div style={{ position: 'relative', marginTop: '2rem' }}>
                    <ProgressBar 
                      now={loadingProgress} 
                      animated 
                      striped
                      variant={loadingProgress < 30 ? 'info' : loadingProgress < 70 ? 'primary' : 'success'}
                      style={{ height: '25px', borderRadius: '12px' }}
                      label={`${Math.round(loadingProgress)}%`}
                    />
                  </div>
                  

                  
                  <p className="mt-3 text-muted" style={{ fontSize: '0.85rem' }}>
                    <i className="fas fa-clock me-1"></i>
                    Vui lòng chờ trong giây lát...
                  </p>
                </div>
              </div>
            )}
      </Container>
    </>
  );
};

export default EnhancedAttendanceReports;
