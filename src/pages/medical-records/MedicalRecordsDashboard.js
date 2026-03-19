import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, Row, Col, Spinner, Alert, Form, Modal, Table, Badge, Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import usePageTitle from '../../hooks/usePageTitle';
import BarChart from '../../components/charts/BarChart';
import Pagination from '../../components/Pagination';
import { getApiBaseURL } from '../../utils/api';
import '../../styles/dashboard.css';

const MedicalRecordsDashboard = () => {
  usePageTitle('Dashboard - Theo dõi HSBASV');
  const { api } = useAuth();
  const navigate = useNavigate();
  
  // Initial empty state
  const initialStats = {
    total: 0,
    totalStudents: 0,
    byStatus: [],
    byKhoa: [],
    byLop: [],
    byBenhVien: [],
    byNgayBD: [],
    byNgayNop: [],
    ciChuaChamDiem: {
      total: 0,
      byGVHD: []
    }
  };
  
  const [stats, setStats] = useState(initialStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const eventSourceRef = useRef(null);
  const fetchDashboardStatsRef = useRef(null);
  
  // Shared filter keys for sync with CIChuaChamDiemPage
  const MR_FILTER_KEYS = {
    dateFilter: 'medicalRecordsFilters_dateFilter',
    customDate: 'medicalRecordsFilters_customDate',
    customStartDate: 'medicalRecordsFilters_customStartDate',
    customEndDate: 'medicalRecordsFilters_customEndDate',
    dateFilterNgayBD: 'medicalRecordsFilters_dateFilterNgayBD',
    customDateNgayBD: 'medicalRecordsFilters_customDateNgayBD',
    customStartDateNgayBD: 'medicalRecordsFilters_customStartDateNgayBD',
    customEndDateNgayBD: 'medicalRecordsFilters_customEndDateNgayBD',
    dateFilterNgayNop: 'medicalRecordsFilters_dateFilterNgayNop',
    customDateNgayNop: 'medicalRecordsFilters_customDateNgayNop',
    customStartDateNgayNop: 'medicalRecordsFilters_customStartDateNgayNop',
    customEndDateNgayNop: 'medicalRecordsFilters_customEndDateNgayNop',
    selectedKhoa: 'medicalRecordsFilters_selectedKhoa',
    selectedLop: 'medicalRecordsFilters_selectedLop',
    selectedBenhVien: 'medicalRecordsFilters_selectedBenhVien',
    selectedGVHD: 'medicalRecordsFilters_selectedGVHD'
  };

  const [dateFilter, setDateFilter] = useState(() => localStorage.getItem(MR_FILTER_KEYS.dateFilter) || 'all');
  const [customDate, setCustomDate] = useState(() => localStorage.getItem(MR_FILTER_KEYS.customDate) || '');
  const [customStartDate, setCustomStartDate] = useState(() => localStorage.getItem(MR_FILTER_KEYS.customStartDate) || '');
  const [customEndDate, setCustomEndDate] = useState(() => localStorage.getItem(MR_FILTER_KEYS.customEndDate) || '');
  
  const [dateFilterNgayBD, setDateFilterNgayBD] = useState(() => localStorage.getItem(MR_FILTER_KEYS.dateFilterNgayBD) || 'all');
  const [customDateNgayBD, setCustomDateNgayBD] = useState(() => localStorage.getItem(MR_FILTER_KEYS.customDateNgayBD) || '');
  const [customStartDateNgayBD, setCustomStartDateNgayBD] = useState(() => localStorage.getItem(MR_FILTER_KEYS.customStartDateNgayBD) || '');
  const [customEndDateNgayBD, setCustomEndDateNgayBD] = useState(() => localStorage.getItem(MR_FILTER_KEYS.customEndDateNgayBD) || '');
  
  const [dateFilterNgayNop, setDateFilterNgayNop] = useState(() => localStorage.getItem(MR_FILTER_KEYS.dateFilterNgayNop) || 'all');
  const [customDateNgayNop, setCustomDateNgayNop] = useState(() => localStorage.getItem(MR_FILTER_KEYS.customDateNgayNop) || '');
  const [customStartDateNgayNop, setCustomStartDateNgayNop] = useState(() => localStorage.getItem(MR_FILTER_KEYS.customStartDateNgayNop) || '');
  const [customEndDateNgayNop, setCustomEndDateNgayNop] = useState(() => localStorage.getItem(MR_FILTER_KEYS.customEndDateNgayNop) || '');
  
  const [selectedKhoa, setSelectedKhoa] = useState(() => localStorage.getItem(MR_FILTER_KEYS.selectedKhoa) || '');
  const [selectedLop, setSelectedLop] = useState(() => localStorage.getItem(MR_FILTER_KEYS.selectedLop) || '');
  const [selectedBenhVien, setSelectedBenhVien] = useState(() => localStorage.getItem(MR_FILTER_KEYS.selectedBenhVien) || '');
  const [khoaList, setKhoaList] = useState([]);
  const [lopList, setLopList] = useState([]);
  const [benhVienList, setBenhVienList] = useState([]);
  const [loadingFilters, setLoadingFilters] = useState(false);
  
  const [showGVHDModal, setShowGVHDModal] = useState(false);
  const [selectedGVHD, setSelectedGVHD] = useState(null);
  const [gvhdRecords, setGvhdRecords] = useState([]);
  const [gvhdLoading, setGvhdLoading] = useState(false);
  const [gvhdPagination, setGvhdPagination] = useState({
    page: 1,
    limit: 50,
    totalItems: 0,
    totalPages: 1
  });
  
  // Persist all filters to localStorage (sync with CIChuaChamDiemPage)
  useEffect(() => {
    localStorage.setItem(MR_FILTER_KEYS.dateFilter, dateFilter);
    localStorage.setItem(MR_FILTER_KEYS.customDate, customDate || '');
    localStorage.setItem(MR_FILTER_KEYS.customStartDate, customStartDate || '');
    localStorage.setItem(MR_FILTER_KEYS.customEndDate, customEndDate || '');
    localStorage.setItem(MR_FILTER_KEYS.dateFilterNgayBD, dateFilterNgayBD);
    localStorage.setItem(MR_FILTER_KEYS.customDateNgayBD, customDateNgayBD || '');
    localStorage.setItem(MR_FILTER_KEYS.customStartDateNgayBD, customStartDateNgayBD || '');
    localStorage.setItem(MR_FILTER_KEYS.customEndDateNgayBD, customEndDateNgayBD || '');
    localStorage.setItem(MR_FILTER_KEYS.dateFilterNgayNop, dateFilterNgayNop);
    localStorage.setItem(MR_FILTER_KEYS.customDateNgayNop, customDateNgayNop || '');
    localStorage.setItem(MR_FILTER_KEYS.customStartDateNgayNop, customStartDateNgayNop || '');
    localStorage.setItem(MR_FILTER_KEYS.customEndDateNgayNop, customEndDateNgayNop || '');
    localStorage.setItem(MR_FILTER_KEYS.selectedKhoa, selectedKhoa || '');
    localStorage.setItem(MR_FILTER_KEYS.selectedLop, selectedLop || '');
    localStorage.setItem(MR_FILTER_KEYS.selectedBenhVien, selectedBenhVien || '');
  }, [dateFilter, customDate, customStartDate, customEndDate, dateFilterNgayBD, customDateNgayBD, customStartDateNgayBD, customEndDateNgayBD, dateFilterNgayNop, customDateNgayNop, customStartDateNgayNop, customEndDateNgayNop, selectedKhoa, selectedLop, selectedBenhVien]);

  // Helper function to calculate date range based on filter
  const toLocalDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getDateRange = (filter, customDateVal, customStartDateVal, customEndDateVal) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (filter) {
      case 'today':
        return {
          startDate: toLocalDateString(today),
          endDate: toLocalDateString(today)
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
        if (customDateVal) {
          return {
            startDate: customDateVal,
            endDate: customDateVal
          };
        }
        return { startDate: null, endDate: null };
      case 'customRange':
        if (customStartDateVal && customEndDateVal) {
          return {
            startDate: customStartDateVal,
            endDate: customEndDateVal
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

  // Fetch dashboard stats (silent = true: cập nhật dưới nền, không bật loading)
  const fetchDashboardStats = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      setError('');
      
      const dateRange = getDateRange(dateFilter, customDate, customStartDate, customEndDate);
      const dateRangeNgayBD = getDateRange(dateFilterNgayBD, customDateNgayBD, customStartDateNgayBD, customEndDateNgayBD);
      const dateRangeNgayNop = getDateRange(dateFilterNgayNop, customDateNgayNop, customStartDateNgayNop, customEndDateNgayNop);
      
      const params = new URLSearchParams();
      
      // Filter by Thời gian Nhập (created_at)
      if (dateRange.startDate) {
        params.append('startDate', dateRange.startDate);
      }
      if (dateRange.endDate) {
        params.append('endDate', dateRange.endDate);
      }
      
      // Filter by Ngày BD
      if (dateRangeNgayBD.startDate) {
        params.append('startDateNgayBD', dateRangeNgayBD.startDate);
      }
      if (dateRangeNgayBD.endDate) {
        params.append('endDateNgayBD', dateRangeNgayBD.endDate);
      }
      
      // Filter by Ngày nộp
      if (dateRangeNgayNop.startDate) {
        params.append('startDateNgayNop', dateRangeNgayNop.startDate);
      }
      if (dateRangeNgayNop.endDate) {
        params.append('endDateNgayNop', dateRangeNgayNop.endDate);
      }
      
      if (selectedKhoa) {
        params.append('khoa', selectedKhoa);
      }
      if (selectedLop) {
        params.append('ten_lop', selectedLop);
      }
      if (selectedBenhVien) {
        params.append('benh_vien', selectedBenhVien);
      }

      const response = await api.get(`/medical-records/stats/dashboard?${params.toString()}`);
      
      if (response.data?.success) {
        setStats(response.data.data);
        if (response.data.data.filterOptions) {
          setKhoaList(response.data.data.filterOptions.khoas || []);
          setLopList(response.data.data.filterOptions.lops || []);
          setBenhVienList(response.data.data.filterOptions.benhViens || []);
        }
      } else {
        if (!silent) setError(response.data?.message || 'Lỗi khi tải dữ liệu dashboard');
      }
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      if (!silent) setError('Lỗi khi tải dữ liệu dashboard');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [api, dateFilter, customDate, customStartDate, customEndDate, dateFilterNgayBD, customDateNgayBD, customStartDateNgayBD, customEndDateNgayBD, dateFilterNgayNop, customDateNgayNop, customStartDateNgayNop, customEndDateNgayNop, selectedKhoa, selectedLop, selectedBenhVien]);
  fetchDashboardStatsRef.current = fetchDashboardStats;

  // Load dashboard stats on mount and when filters change
  useEffect(() => {
    fetchDashboardStats(false);
  }, [fetchDashboardStats]);

  // SSE: chỉ cập nhật khi API có dữ liệu mới (import/update/delete), tải dưới nền
  useEffect(() => {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;
    const baseURL = getApiBaseURL();
    const url = `${baseURL}/medical-records/stats/events?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;
    es.onmessage = (event) => {
      if (event.data === 'refresh' && fetchDashboardStatsRef.current) {
        fetchDashboardStatsRef.current(true);
      }
    };
    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
    };
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  // Handle khoa change
  const handleKhoaChange = (khoa) => {
    setSelectedKhoa(khoa);
    setSelectedLop(''); // Reset lop when khoa changes
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (error) {
      return dateString || '-';
    }
  };

  // Format date cho nhãn biểu đồ - tiếng Việt dd/mm/yyyy (không dùng tiếng Anh)
  const formatDateChartLabel = (dateString) => {
    if (!dateString) return '-';
    const str = String(dateString).trim();
    if (!str) return '-';
    // Đã là YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const [y, m, d] = str.split('-');
      return `${d}/${m}/${y}`;
    }
    // ISO: 2025-09-22T00:00:00.000Z
    if (str.includes('T')) {
      const dateOnly = str.split('T')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
        const [y, m, d] = dateOnly.split('-');
        return `${d}/${m}/${y}`;
      }
    }
    // Chuỗi kiểu "Mon Sep 22 2025 00:00:00 GM" hoặc "Mon Sep 22 2025 00:00:00 GMT+0700"
    const match = str.match(/(\w{3})\s+(\w{3})\s+(\d{1,2})\s+(\d{4})/);
    if (match) {
      const months = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
      const month = months[match[2]];
      const day = String(parseInt(match[3], 10)).padStart(2, '0');
      const year = match[4];
      if (month) {
        const m = String(month).padStart(2, '0');
        return `${day}/${m}/${year}`;
      }
    }
    try {
      const d = new Date(str.replace(/\sGM\s/, ' GMT '));
      if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
      }
    } catch (e) { /* fallback */ }
    return str;
  };

  // Format score
  const formatScore = (score) => {
    if (score === null || score === undefined || score === '') return '-';
    const parsed = parseFloat(score);
    if (isNaN(parsed)) return '-';
    return parsed.toFixed(2);
  };

  // Get LoaiHSBA label
  const getLoaiHSBALabel = (loai) => {
    if (loai === 0 || loai === '0') return 'Điểm quá trình';
    if (loai === 1 || loai === '1') return 'Điểm bệnh án thi';
    return '-';
  };

  // Fetch GVHD records
  const fetchGVHDRecords = useCallback(async () => {
    if (!selectedGVHD || !selectedGVHD.ten_gvhd) return;
    
    setGvhdLoading(true);
    try {
      const dateRange = getDateRange(dateFilter, customDate, customStartDate, customEndDate);
      const dateRangeNgayBD = getDateRange(dateFilterNgayBD, customDateNgayBD, customStartDateNgayBD, customEndDateNgayBD);
      const dateRangeNgayNop = getDateRange(dateFilterNgayNop, customDateNgayNop, customStartDateNgayNop, customEndDateNgayNop);
      
      const params = new URLSearchParams();
      
      params.append('page', gvhdPagination.page);
      params.append('limit', gvhdPagination.limit);
      
      // Filter by Thời gian Nhập (created_at)
      if (dateRange.startDate) {
        params.append('startDate', dateRange.startDate);
      }
      if (dateRange.endDate) {
        params.append('endDate', dateRange.endDate);
      }
      
      // Filter by Ngày BD
      if (dateRangeNgayBD.startDate) {
        params.append('startDateNgayBD', dateRangeNgayBD.startDate);
      }
      if (dateRangeNgayBD.endDate) {
        params.append('endDateNgayBD', dateRangeNgayBD.endDate);
      }
      
      // Filter by Ngày nộp
      if (dateRangeNgayNop.startDate) {
        params.append('startDateNgayNop', dateRangeNgayNop.startDate);
      }
      if (dateRangeNgayNop.endDate) {
        params.append('endDateNgayNop', dateRangeNgayNop.endDate);
      }
      
      if (selectedKhoa) {
        params.append('khoa', selectedKhoa);
      }
      if (selectedLop) {
        params.append('ten_lop', selectedLop);
      }
      if (selectedBenhVien) {
        params.append('benh_vien', selectedBenhVien);
      }
      params.append('ten_gvhd', selectedGVHD.ten_gvhd);

      const response = await api.get(`/medical-records/ci-chua-cham-diem?${params.toString()}`);
      
      if (response.data?.success) {
        setGvhdRecords(response.data.data || []);
        setGvhdPagination(prev => ({
          ...prev,
          totalItems: response.data.pagination?.total || 0,
          totalPages: response.data.pagination?.totalPages || 1
        }));
      }
    } catch (error) {
      console.error('Error fetching GVHD records:', error);
    } finally {
      setGvhdLoading(false);
    }
  }, [selectedGVHD, gvhdPagination.page, dateFilter, customDate, customStartDate, customEndDate, dateFilterNgayBD, customDateNgayBD, customStartDateNgayBD, customEndDateNgayBD, dateFilterNgayNop, customDateNgayNop, customStartDateNgayNop, customEndDateNgayNop, selectedKhoa, selectedLop, selectedBenhVien, api]);

  // Fetch GVHD records when modal opens or pagination changes
  useEffect(() => {
    if (showGVHDModal && selectedGVHD) {
      fetchGVHDRecords();
    }
  }, [showGVHDModal, selectedGVHD, fetchGVHDRecords]);

  // Get status count
  const getStatusCount = (statusText) => {
    const statusItem = stats.byStatus?.find(s => s.trang_thai_text === statusText);
    return statusItem?.count || 0;
  };

  return (
    <div className="admin-dashboard-container">
      <div className="dashboard-header">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h2 className="dashboard-title">Dashboard</h2>
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            {/* Filter Thời gian Nhập */}
            <div className="d-flex align-items-center gap-2">
              <span className="text-muted small">Thời gian Nhập:</span>
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

            {/* Filter Ngày BD */}
            <div className="d-flex align-items-center gap-2">
              <span className="text-muted small">Ngày BD:</span>
              <Form.Select
                value={dateFilterNgayBD}
                onChange={(e) => setDateFilterNgayBD(e.target.value)}
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
              
              {dateFilterNgayBD === 'customDate' && (
                <Form.Control
                  type="date"
                  value={customDateNgayBD}
                  onChange={(e) => setCustomDateNgayBD(e.target.value)}
                  style={{ width: '180px' }}
                  className="form-control-modern"
                />
              )}
              
              {dateFilterNgayBD === 'customRange' && (
                <>
                  <Form.Control
                    type="date"
                    value={customStartDateNgayBD}
                    onChange={(e) => setCustomStartDateNgayBD(e.target.value)}
                    placeholder="Từ ngày"
                    style={{ width: '180px' }}
                    className="form-control-modern"
                  />
                  <span className="mx-2">đến</span>
                  <Form.Control
                    type="date"
                    value={customEndDateNgayBD}
                    onChange={(e) => setCustomEndDateNgayBD(e.target.value)}
                    placeholder="Đến ngày"
                    style={{ width: '180px' }}
                    className="form-control-modern"
                  />
                </>
              )}
            </div>

            {/* Filter Ngày nộp */}
            <div className="d-flex align-items-center gap-2">
              <span className="text-muted small">Ngày nộp:</span>
              <Form.Select
                value={dateFilterNgayNop}
                onChange={(e) => setDateFilterNgayNop(e.target.value)}
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
              
              {dateFilterNgayNop === 'customDate' && (
                <Form.Control
                  type="date"
                  value={customDateNgayNop}
                  onChange={(e) => setCustomDateNgayNop(e.target.value)}
                  style={{ width: '180px' }}
                  className="form-control-modern"
                />
              )}
              
              {dateFilterNgayNop === 'customRange' && (
                <>
                  <Form.Control
                    type="date"
                    value={customStartDateNgayNop}
                    onChange={(e) => setCustomStartDateNgayNop(e.target.value)}
                    placeholder="Từ ngày"
                    style={{ width: '180px' }}
                    className="form-control-modern"
                  />
                  <span className="mx-2">đến</span>
                  <Form.Control
                    type="date"
                    value={customEndDateNgayNop}
                    onChange={(e) => setCustomEndDateNgayNop(e.target.value)}
                    placeholder="Đến ngày"
                    style={{ width: '180px' }}
                    className="form-control-modern"
                  />
                </>
              )}
            </div>

            <Form.Select
              value={selectedKhoa}
              onChange={(e) => handleKhoaChange(e.target.value)}
              style={{ width: '200px' }}
              className="form-select-modern"
            >
              <option value="">Tất cả khoa</option>
              {khoaList.map((item, index) => {
                const value = typeof item === 'string' ? item : (item?.khoa ?? '');
                const label = typeof item === 'string' ? item : (item?.count != null ? `${item.khoa} (${item.count})` : (item?.khoa ?? ''));
                return (
                  <option key={index} value={value}>
                    {label}
                  </option>
                );
              })}
            </Form.Select>

            <Form.Select
              value={selectedLop}
              onChange={(e) => setSelectedLop(e.target.value)}
              style={{ width: '180px' }}
              className="form-select-modern"
            >
              <option value="">Tất cả lớp</option>
              {lopList.map((item, index) => {
                const value = typeof item === 'string' ? item : (item?.lop ?? '');
                const label = typeof item === 'string' ? item : (item?.count != null ? `${item.lop} (${item.count})` : (item?.lop ?? ''));
                return (
                  <option key={index} value={value}>
                    {label}
                  </option>
                );
              })}
            </Form.Select>

            <Form.Select
              value={selectedBenhVien}
              onChange={(e) => setSelectedBenhVien(e.target.value)}
              style={{ width: '200px' }}
              className="form-select-modern"
            >
              <option value="">Tất cả bệnh viện</option>
              {benhVienList.map((bv, index) => {
                const value = typeof bv === 'string' ? bv : bv.benh_vien;
                const label = typeof bv === 'string' ? bv : (bv.count != null ? `${bv.benh_vien} (${bv.count})` : bv.benh_vien);
                return (
                  <option key={index} value={value}>
                    {label}
                  </option>
                );
              })}
            </Form.Select>
          </div>
        </div>
      </div>
      
      {error && <Alert className="error-alert">{error}</Alert>}
      
      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Đang tải dữ liệu...</p>
        </div>
      ) : (
        <>
          {/* Top stats row - 3 columns x 2 rows */}
          <div className="dashboard-stats-grid">
            <Row className="g-4">
              {/* Hàng 1 */}
              <Col md={4} sm={6} xs={12}>
                <Card className="stat-card">
                  <Card.Body className="stat-card-body">
                    <div className="icon-container" style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}>
                      <i className="fas fa-file-medical"></i>
                    </div>
                    <div className="stat-content">
                      <div className="stat-label">Tổng số HSBA</div>
                      <div className="stat-value">{stats.total || 0}</div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={4} sm={6} xs={12}>
                <Card className="stat-card">
                  <Card.Body className="stat-card-body">
                    <div className="icon-container" style={{ background: 'linear-gradient(135deg, #4facfe, #00f2fe)' }}>
                      <i className="fas fa-users"></i>
                    </div>
                    <div className="stat-content">
                      <div className="stat-label">Tổng số sinh viên</div>
                      <div className="stat-value">{stats.totalStudents || 0}</div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={4} sm={6} xs={12}>
                <Card className="stat-card">
                  <Card.Body className="stat-card-body">
                    <div className="icon-container" style={{ background: 'linear-gradient(135deg, #f093fb, #f5576c)' }}>
                      <i className="fas fa-user-clock"></i>
                    </div>
                    <div className="stat-content">
                      <div className="stat-label">HSBA đang thực hiện</div>
                      <div className="stat-value">{getStatusCount('SV đang thực hiện')}</div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
              {/* Hàng 2 */}
              <Col md={4} sm={6} xs={12}>
                <Card className="stat-card">
                  <Card.Body className="stat-card-body">
                    <div className="icon-container" style={{ background: 'linear-gradient(135deg, #ff9a9e, #fecfef)' }}>
                      <i className="fas fa-file-upload"></i>
                    </div>
                    <div className="stat-content">
                      <div className="stat-label">HSBA SV đã nộp</div>
                      <div className="stat-value">{getStatusCount('SV đã nộp bài')}</div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={4} sm={6} xs={12}>
                <Card className="stat-card">
                  <Card.Body className="stat-card-body">
                    <div className="icon-container" style={{ background: 'linear-gradient(135deg, #a8edea, #fed6e3)' }}>
                      <i className="fas fa-check-circle"></i>
                    </div>
                    <div className="stat-content">
                      <div className="stat-label">HSBA CI đã chấm</div>
                      <div className="stat-value">{getStatusCount('CI đã chấm điểm')}</div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={4} sm={6} xs={12}>
                <Card 
                  className="stat-card" 
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate('/medical-records/ci-chua-cham-diem')}
                >
                  <Card.Body className="stat-card-body">
                    <div className="icon-container" style={{ background: 'linear-gradient(135deg, #ffecd2, #fcb69f)' }}>
                      <i className="fas fa-exclamation-circle"></i>
                    </div>
                    <div className="stat-content">
                      <div className="stat-label">HSBA CI chưa chấm</div>
                      <div className="stat-value">{stats.ciChuaChamDiem?.total || 0}</div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </div>

          {/* 3 cột: Thống kê theo khoa, theo lớp, theo bệnh viện (cùng chiều rộng) */}
          <Row className="mt-4 g-4" style={{ display: 'flex', flexWrap: 'wrap' }}>
            <Col md={4} xs={12} style={{ flex: '1 1 0', minWidth: '280px' }}>
              <div className="chart-section" style={{ width: '100%' }}>
                <div className="chart-title">Thống kê theo khoa</div>
                {stats.byKhoa && stats.byKhoa.length > 0 ? (
                  <BarChart
                    data={stats.byKhoa.map(item => item.count)}
                    labels={stats.byKhoa.map(item => item.khoa || '(Không xác định)')}
                    yAxisLabel="Số lượng"
                    colors={['#36b9cc']}
                    height={220}
                    showDataLabels={true}
                  />
                ) : (
                  <div className="text-center text-muted py-5">Chưa có dữ liệu</div>
                )}
              </div>
            </Col>
            <Col md={4} xs={12} style={{ flex: '1 1 0', minWidth: '280px' }}>
              <div className="chart-section" style={{ width: '100%' }}>
                <div className="chart-title">Thống kê theo lớp</div>
                {stats.byLop && stats.byLop.length > 0 ? (
                  <BarChart
                    data={stats.byLop.map(item => item.count)}
                    labels={stats.byLop.map(item => item.lop || '(Không xác định)')}
                    yAxisLabel="Số lượng"
                    colors={['#4e73df']}
                    height={220}
                    showDataLabels={true}
                  />
                ) : (
                  <div className="text-center text-muted py-5">Chưa có dữ liệu</div>
                )}
              </div>
            </Col>
          </Row>

          {/* Chart: Tổng HSBA bệnh viện / HSBA đã chấm / HSBA chưa chấm (mỗi bệnh viện 3 cột) - full width */}
          {stats.byBenhVien && stats.byBenhVien.length > 0 && (
            <Row className="mt-4">
              <Col xs={12}>
                <div className="chart-section">
                  <div className="chart-title">HSBA theo bệnh viện: Tổng, Đã chấm, Chưa chấm</div>
                  <BarChart
                    data={[
                      stats.byBenhVien.map(item => item.count),
                      stats.byBenhVien.map(item => item.da_cham ?? 0),
                      stats.byBenhVien.map(item => item.chua_cham ?? Math.max(0, (item.count || 0) - (item.da_cham || 0)))
                    ]}
                    labels={stats.byBenhVien.map(item => item.benh_vien || '(Không xác định)')}
                    title={['Tổng HSBA bệnh viện', 'HSBA đã chấm', 'HSBA chưa chấm']}
                    yAxisLabel="Số lượng"
                    colors={['#1cc88a', '#36b9cc', '#e74a3b']}
                    height={280}
                    showDataLabels={true}
                  />
                </div>
              </Col>
            </Row>
          )}

          {/* CI chưa chấm điểm theo GVHD - BarChart */}
          {stats.ciChuaChamDiem && stats.ciChuaChamDiem.byGVHD && stats.ciChuaChamDiem.byGVHD.length > 0 && (
            <Row className="mt-4">
              <Col md={12} xs={12}>
                <div className="chart-section">
                  <div className="chart-title">HSBA CI chưa chấm điểm</div>
                  <BarChart
                    data={stats.ciChuaChamDiem.byGVHD.map(item => item.count)}
                    labels={stats.ciChuaChamDiem.byGVHD.map(item => `${item.ma_gvhd || ''} - ${item.ten_gvhd || '(Không xác định)'}`)}
                    yAxisLabel="Số lượng"
                    colors={['#e74a3b']}
                    height={220}
                    showDataLabels={true}
                    onBarClick={(index, label, value) => {
                      const gvhdItem = stats.ciChuaChamDiem.byGVHD[index];
                      if (gvhdItem) {
                        setSelectedGVHD({
                          ma_gvhd: gvhdItem.ma_gvhd,
                          ten_gvhd: gvhdItem.ten_gvhd,
                          count: gvhdItem.count
                        });
                        setShowGVHDModal(true);
                        setGvhdPagination(prev => ({ ...prev, page: 1 }));
                      }
                    }}
                  />
                </div>
              </Col>
            </Row>
          )}

          {/* 2 chart dưới cùng: Ngày BD (Ngày bắt đầu HSBA) và Ngày nộp (Ngày sinh viên nộp bài) */}
          <Row className="mt-4 g-4">
            <Col md={6} xs={12}>
              <div className="chart-section" style={{ width: '100%' }}>
                <div className="chart-title">Ngày bắt đầu HSBA</div>
                {stats.byNgayBD && stats.byNgayBD.length > 0 ? (
                  <BarChart
                    data={stats.byNgayBD.map(item => item.count)}
                    labels={stats.byNgayBD.map(item => formatDateChartLabel(item.date))}
                    yAxisLabel="Số lượng HSBA"
                    colors={['#667eea']}
                    height={220}
                    showDataLabels={true}
                  />
                ) : (
                  <div className="text-center text-muted py-5">Chưa có dữ liệu</div>
                )}
              </div>
            </Col>
            <Col md={6} xs={12}>
              <div className="chart-section" style={{ width: '100%' }}>
                <div className="chart-title">Ngày sinh viên nộp bài</div>
                {stats.byNgayNop && stats.byNgayNop.length > 0 ? (
                  <BarChart
                    data={stats.byNgayNop.map(item => item.count)}
                    labels={stats.byNgayNop.map(item => formatDateChartLabel(item.date))}
                    yAxisLabel="Số lượng HSBA"
                    colors={['#4facfe']}
                    height={220}
                    showDataLabels={true}
                  />
                ) : (
                  <div className="text-center text-muted py-5">Chưa có dữ liệu</div>
                )}
              </div>
            </Col>
          </Row>

        </>
      )}

      {/* GVHD Detail Modal */}
      <Modal
        show={showGVHDModal}
        onHide={() => setShowGVHDModal(false)}
        fullscreen={true}
        className="mr-detail-modal"
        dialogClassName="fullscreen-modal"
        contentClassName="d-flex flex-column h-100"
      >
        <Modal.Header closeButton className="mr-detail-header flex-shrink-0">
          <Modal.Title className="mr-detail-title d-flex align-items-center flex-wrap gap-2">
            <div className="mr-detail-avatar">
              <i className="fas fa-user-md"></i>
            </div>
            <div>
              <h4 className="mb-0">HSBA CI chưa chấm điểm</h4>
              <p className="mb-0 mr-detail-subtitle">
                {selectedGVHD ? `${selectedGVHD.ma_gvhd || ''} - ${selectedGVHD.ten_gvhd || '(Không xác định)'}` : ''}
              </p>
            </div>
            <Badge bg="info" className="ms-2">
              Tổng số HSBA: {gvhdPagination.totalItems}
            </Badge>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body
          className="mr-detail-body d-flex flex-column p-0"
          style={{
            overflow: 'hidden',
            minHeight: 0,
            flex: '1 1 auto'
          }}
        >
          {gvhdLoading ? (
            <div className="text-center py-5">
              <Spinner animation="border" role="status" className="text-primary">
                <span className="visually-hidden">Đang tải...</span>
              </Spinner>
              <p className="mt-3 text-muted">Đang tải dữ liệu...</p>
            </div>
          ) : (
            <>
              <div className="mr-session-card flex-grow-1 d-flex flex-column m-3 mb-0" style={{ minHeight: 0 }}>
                <div className="mr-card-body-modern p-0 d-flex flex-column flex-grow-1" style={{ minHeight: 0 }}>
                  <div
                    className="table-responsive mr-session-table-container flex-grow-1"
                    style={{
                      overflowX: 'auto',
                      overflowY: 'auto',
                      minHeight: 0,
                      WebkitOverflowScrolling: 'touch'
                    }}
                  >
                    <Table striped bordered hover className="mr-session-table mb-0">
                      <thead className="table-light" style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                        <tr>
                          <th>STT</th>
                          <th>Trạng thái</th>
                          <th>Mã SV</th>
                          <th>Tên SV</th>
                          <th>Khoa</th>
                          <th>Năm học</th>
                          <th>Mã MH</th>
                          <th>Tên MH</th>
                          <th>Tên BN</th>
                          <th>Ngày BD</th>
                          <th>Ngày nộp</th>
                          <th>Loại HSBA</th>
                          <th>Tên lớp</th>
                          <th>Điểm thi miệng</th>
                          <th>Điểm quá trình</th>
                          <th>Điểm khám bệnh</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gvhdRecords.length === 0 ? (
                          <tr>
                            <td colSpan="16" className="text-center py-5">
                              <div className="d-flex flex-column align-items-center">
                                <h5 className="text-muted mb-2">Không có dữ liệu</h5>
                                <p className="text-muted mb-0">Chưa có HSBA nào chưa được CI chấm điểm</p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          gvhdRecords.map((record, index) => (
                            <tr key={record.id}>
                              <td>{(gvhdPagination.page - 1) * gvhdPagination.limit + index + 1}</td>
                              <td>
                                <Badge bg="warning">{record.trang_thai_text || '-'}</Badge>
                              </td>
                              <td>{record.ma_sv || '-'}</td>
                              <td>{record.ten_day_du || '-'}</td>
                              <td>{record.ten_ng_chng || '-'}</td>
                              <td>{record.nam_thu || '-'}</td>
                              <td>{record.ma_mh || '-'}</td>
                              <td>{record.ten_mh || '-'}</td>
                              <td>{record.ten_day_du_bn || '-'}</td>
                              <td>{formatDate(record.ngay_bd_hsbasv)}</td>
                              <td>{formatDate(record.ngay_sv_nop_bai)}</td>
                              <td>{getLoaiHSBALabel(record.loai_hsba)}</td>
                              <td>{record.ten_lop || '-'}</td>
                              <td>{formatScore(record.diem_thi_mieng)}</td>
                              <td>{formatScore(record.diem_qua_trinh)}</td>
                              <td>{formatScore(record.diem_kham_benh)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </Table>
                  </div>

                  {gvhdRecords.length > 0 && gvhdPagination.totalPages > 1 && (
                    <div className="mt-3 px-3 pb-3 d-flex justify-content-center flex-shrink-0">
                      <Pagination
                        currentPage={gvhdPagination.page}
                        totalPages={gvhdPagination.totalPages}
                        onPageChange={(page) => setGvhdPagination(prev => ({ ...prev, page }))}
                        maxVisiblePages={5}
                        showFirstLast={true}
                      />
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default MedicalRecordsDashboard;
