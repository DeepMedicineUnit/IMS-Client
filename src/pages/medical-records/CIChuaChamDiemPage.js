import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, Row, Col, Table, Badge, Button, Alert, Spinner, Container, Form } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import usePageTitle from '../../hooks/usePageTitle';
import Pagination from '../../components/Pagination';
import { getApiBaseURL } from '../../utils/api';
import '../../styles/dashboard.css';

const CIChuaChamDiemPage = () => {
  usePageTitle('CI chưa chấm điểm');
  const { api } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const eventSourceRef = useRef(null);
  const fetchRecordsRef = useRef(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    totalItems: 0,
    totalPages: 0
  });
  
  // Shared filter keys for sync with MedicalRecordsDashboard
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

  const [dateFilter, setDateFilter] = useState(() => localStorage.getItem(MR_FILTER_KEYS.dateFilter) || 'today');
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
  const [selectedGVHD, setSelectedGVHD] = useState(() => localStorage.getItem(MR_FILTER_KEYS.selectedGVHD) || '');
  const [khoaList, setKhoaList] = useState([]);
  const [lopList, setLopList] = useState([]);
  const [benhVienList, setBenhVienList] = useState([]);
  const [gvhdList, setGvhdList] = useState([]);

  // Persist all filters to localStorage (sync with MedicalRecordsDashboard)
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
    localStorage.setItem(MR_FILTER_KEYS.selectedGVHD, selectedGVHD || '');
  }, [dateFilter, customDate, customStartDate, customEndDate, dateFilterNgayBD, customDateNgayBD, customStartDateNgayBD, customEndDateNgayBD, dateFilterNgayNop, customDateNgayNop, customStartDateNgayNop, customEndDateNgayNop, selectedKhoa, selectedLop, selectedBenhVien, selectedGVHD]);

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

  // Fetch records (silent = true: cập nhật dưới nền, không bật loading)
  const fetchRecords = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError('');
      
      const dateRange = getDateRange(dateFilter, customDate, customStartDate, customEndDate);
      const dateRangeNgayBD = getDateRange(dateFilterNgayBD, customDateNgayBD, customStartDateNgayBD, customEndDateNgayBD);
      const dateRangeNgayNop = getDateRange(dateFilterNgayNop, customDateNgayNop, customStartDateNgayNop, customEndDateNgayNop);
      
      const params = new URLSearchParams();
      
      params.append('page', pagination.page);
      params.append('limit', pagination.limit);
      
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
      if (selectedGVHD) {
        params.append('ten_gvhd', selectedGVHD);
      }

      const response = await api.get(`/medical-records/ci-chua-cham-diem?${params.toString()}`);
      
      if (response.data?.success) {
        setRecords(response.data.data || []);
        setPagination(prev => ({
          ...prev,
          totalItems: response.data.pagination?.total || 0,
          totalPages: response.data.pagination?.totalPages || 1
        }));
      } else {
        if (!silent) setError(response.data?.message || 'Lỗi khi tải dữ liệu');
      }
    } catch (err) {
      console.error('Error fetching CI chua cham diem:', err);
      if (!silent) setError('Lỗi khi tải dữ liệu');
    } finally {
      if (!silent) setLoading(false);
    }
  };
  fetchRecordsRef.current = fetchRecords;

  // Fetch filter options từ API ci-chua-cham-diem (số lượng mỗi option = chỉ CI chưa chấm điểm)
  const fetchFilterOptions = async () => {
    try {
      const dateRange = getDateRange(dateFilter, customDate, customStartDate, customEndDate);
      const dateRangeNgayBD = getDateRange(dateFilterNgayBD, customDateNgayBD, customStartDateNgayBD, customEndDateNgayBD);
      const dateRangeNgayNop = getDateRange(dateFilterNgayNop, customDateNgayNop, customStartDateNgayNop, customEndDateNgayNop);

      const params = new URLSearchParams();
      params.append('page', '1');
      params.append('limit', '1');

      if (dateRange.startDate) params.append('startDate', dateRange.startDate);
      if (dateRange.endDate) params.append('endDate', dateRange.endDate);
      if (dateRangeNgayBD.startDate) params.append('startDateNgayBD', dateRangeNgayBD.startDate);
      if (dateRangeNgayBD.endDate) params.append('endDateNgayBD', dateRangeNgayBD.endDate);
      if (dateRangeNgayNop.startDate) params.append('startDateNgayNop', dateRangeNgayNop.startDate);
      if (dateRangeNgayNop.endDate) params.append('endDateNgayNop', dateRangeNgayNop.endDate);
      if (selectedKhoa) params.append('khoa', selectedKhoa);
      if (selectedLop) params.append('ten_lop', selectedLop);
      if (selectedBenhVien) params.append('benh_vien', selectedBenhVien);
      if (selectedGVHD) params.append('ten_gvhd', selectedGVHD);

      const response = await api.get(`/medical-records/ci-chua-cham-diem?${params.toString()}`);

      if (response.data?.success && response.data.filterOptions) {
        const opts = response.data.filterOptions;
        setKhoaList(opts.khoas || []);
        setLopList(opts.lops || []);
        setBenhVienList(opts.benhViens || []);
        setGvhdList(opts.gvhds || []);
      }
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [pagination.page, dateFilter, customDate, customStartDate, customEndDate, dateFilterNgayBD, customDateNgayBD, customStartDateNgayBD, customEndDateNgayBD, dateFilterNgayNop, customDateNgayNop, customStartDateNgayNop, customEndDateNgayNop, selectedKhoa, selectedLop, selectedBenhVien, selectedGVHD]);

  useEffect(() => {
    fetchFilterOptions();
  }, [dateFilter, customDate, customStartDate, customEndDate, dateFilterNgayBD, customDateNgayBD, customStartDateNgayBD, customEndDateNgayBD, dateFilterNgayNop, customDateNgayNop, customStartDateNgayNop, customEndDateNgayNop, selectedKhoa, selectedLop, selectedBenhVien, selectedGVHD]);

  // SSE: chỉ cập nhật khi API có dữ liệu mới (import/update/delete), tải dưới nền
  useEffect(() => {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;
    const baseURL = getApiBaseURL();
    const url = `${baseURL}/medical-records/stats/events?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;
    es.onmessage = (event) => {
      if (event.data === 'refresh' && fetchRecordsRef.current) {
        fetchRecordsRef.current(true);
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

  // Format date
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
      return dateString;
    }
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

  return (
    <Container fluid className="px-4 py-3">
      {/* Header Section */}
      <div className="session-header mb-4">
        <div className="header-content">
          <div className="header-title">
            <h1 className="mb-1">CI chưa chấm điểm</h1>
            <p className="header-subtitle mb-0">Danh sách các hồ sơ bệnh án chưa được CI chấm điểm</p>
          </div>
          <div className="header-actions">
            <div className="d-flex align-items-center gap-2 flex-wrap">
              {/* Filter Thời gian Nhập */}
              <div className="d-flex align-items-center gap-2">
                <span className="text-white small">Thời gian Nhập:</span>
                <Form.Select
                  value={dateFilter}
                  onChange={(e) => {
                    setDateFilter(e.target.value);
                    setPagination(prev => ({ ...prev, page: 1 }));
                  }}
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
                    onChange={(e) => {
                      setCustomDate(e.target.value);
                      setPagination(prev => ({ ...prev, page: 1 }));
                    }}
                    style={{ width: '180px' }}
                    className="form-control-modern"
                  />
                )}
                
                {dateFilter === 'customRange' && (
                  <>
                    <Form.Control
                      type="date"
                      value={customStartDate}
                      onChange={(e) => {
                        setCustomStartDate(e.target.value);
                        setPagination(prev => ({ ...prev, page: 1 }));
                      }}
                      placeholder="Từ ngày"
                      style={{ width: '180px' }}
                      className="form-control-modern"
                    />
                    <span className="mx-2 text-white">đến</span>
                    <Form.Control
                      type="date"
                      value={customEndDate}
                      onChange={(e) => {
                        setCustomEndDate(e.target.value);
                        setPagination(prev => ({ ...prev, page: 1 }));
                      }}
                      placeholder="Đến ngày"
                      style={{ width: '180px' }}
                      className="form-control-modern"
                    />
                  </>
                )}
              </div>

              {/* Filter Ngày BD */}
              <div className="d-flex align-items-center gap-2">
                <span className="text-white small">Ngày BD:</span>
                <Form.Select
                  value={dateFilterNgayBD}
                  onChange={(e) => {
                    setDateFilterNgayBD(e.target.value);
                    setPagination(prev => ({ ...prev, page: 1 }));
                  }}
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
                    onChange={(e) => {
                      setCustomDateNgayBD(e.target.value);
                      setPagination(prev => ({ ...prev, page: 1 }));
                    }}
                    style={{ width: '180px' }}
                    className="form-control-modern"
                  />
                )}
                
                {dateFilterNgayBD === 'customRange' && (
                  <>
                    <Form.Control
                      type="date"
                      value={customStartDateNgayBD}
                      onChange={(e) => {
                        setCustomStartDateNgayBD(e.target.value);
                        setPagination(prev => ({ ...prev, page: 1 }));
                      }}
                      placeholder="Từ ngày"
                      style={{ width: '180px' }}
                      className="form-control-modern"
                    />
                    <span className="mx-2 text-white">đến</span>
                    <Form.Control
                      type="date"
                      value={customEndDateNgayBD}
                      onChange={(e) => {
                        setCustomEndDateNgayBD(e.target.value);
                        setPagination(prev => ({ ...prev, page: 1 }));
                      }}
                      placeholder="Đến ngày"
                      style={{ width: '180px' }}
                      className="form-control-modern"
                    />
                  </>
                )}
              </div>

              {/* Filter Ngày nộp */}
              <div className="d-flex align-items-center gap-2">
                <span className="text-white small">Ngày nộp:</span>
                <Form.Select
                  value={dateFilterNgayNop}
                  onChange={(e) => {
                    setDateFilterNgayNop(e.target.value);
                    setPagination(prev => ({ ...prev, page: 1 }));
                  }}
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
                    onChange={(e) => {
                      setCustomDateNgayNop(e.target.value);
                      setPagination(prev => ({ ...prev, page: 1 }));
                    }}
                    style={{ width: '180px' }}
                    className="form-control-modern"
                  />
                )}
                
                {dateFilterNgayNop === 'customRange' && (
                  <>
                    <Form.Control
                      type="date"
                      value={customStartDateNgayNop}
                      onChange={(e) => {
                        setCustomStartDateNgayNop(e.target.value);
                        setPagination(prev => ({ ...prev, page: 1 }));
                      }}
                      placeholder="Từ ngày"
                      style={{ width: '180px' }}
                      className="form-control-modern"
                    />
                    <span className="mx-2 text-white">đến</span>
                    <Form.Control
                      type="date"
                      value={customEndDateNgayNop}
                      onChange={(e) => {
                        setCustomEndDateNgayNop(e.target.value);
                        setPagination(prev => ({ ...prev, page: 1 }));
                      }}
                      placeholder="Đến ngày"
                      style={{ width: '180px' }}
                      className="form-control-modern"
                    />
                  </>
                )}
              </div>

              <Form.Select
                value={selectedKhoa}
                onChange={(e) => {
                  setSelectedKhoa(e.target.value);
                  setSelectedLop('');
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
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
                onChange={(e) => {
                  setSelectedLop(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
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
                onChange={(e) => {
                  setSelectedBenhVien(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                style={{ width: '200px' }}
                className="form-select-modern"
              >
                <option value="">Tất cả bệnh viện</option>
                {benhVienList.map((bv, index) => {
                  const value = typeof bv === 'string' ? bv : (bv.id != null ? String(bv.id) : '(Không xác định)');
                  const label = typeof bv === 'string' ? bv : (bv.count != null ? `${bv.benh_vien} (${bv.count})` : bv.benh_vien);
                  return (
                    <option key={index} value={value}>
                      {label}
                    </option>
                  );
                })}
              </Form.Select>

              <Form.Select
                value={selectedGVHD}
                onChange={(e) => {
                  const gvhd = e.target.value;
                  setSelectedGVHD(gvhd);
                  setSelectedKhoa('');
                  setSelectedLop('');
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                style={{ width: '250px' }}
                className="form-select-modern"
              >
                <option value="">Tất cả GVHD</option>
                {gvhdList.map((gvhd, index) => (
                  <option key={index} value={gvhd.ten_gvhd}>
                    {gvhd.ten_gvhd || '(Không xác định)'} ({gvhd.count})
                  </option>
                ))}
              </Form.Select>
            </div>
            <Button 
              onClick={() => navigate('/medical-records/dashboard')}
              variant="outline-light"
              className="px-3 py-2 ms-2"
              style={{ minWidth: '120px', height: '40px' }}
            >
              <i className="fas fa-arrow-left me-2"></i>
              Quay lại
            </Button>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="danger" className="mb-4">
          <i className="fas fa-exclamation-triangle me-2"></i>
          {error}
        </Alert>
      )}

      {/* Records Table */}
      <Card className="mr-session-card">
        <Card.Body className="mr-card-body-modern p-0">
          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" role="status" className="text-primary">
                <span className="visually-hidden">Đang tải...</span>
              </Spinner>
              <p className="mt-3 text-muted">Đang tải dữ liệu...</p>
            </div>
          ) : (
            <>
              <div className="mr-session-table-container">
                <Table responsive hover className="mr-session-table mb-0">
                  <thead>
                    <tr>
                      <th>STT</th>
                      <th>Trạng thái</th>
                      <th>Mã SV</th>
                      <th>Tên SV</th>
                      <th>Mã GVHD</th>
                      <th>Tên GVHD</th>
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
                    {records.length === 0 ? (
                      <tr>
                        <td colSpan="18" className="text-center py-5">
                          <div className="d-flex flex-column align-items-center">
                            <h5 className="text-muted mb-2">Không có dữ liệu</h5>
                            <p className="text-muted mb-0">Chưa có hồ sơ nào chưa được CI chấm điểm</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      records.map((record, index) => (
                        <tr key={record.id}>
                          <td>{(pagination.page - 1) * pagination.limit + index + 1}</td>
                          <td>
                            <Badge bg="warning">{record.trang_thai_text || '-'}</Badge>
                          </td>
                          <td>{record.ma_sv || '-'}</td>
                          <td>{record.ten_day_du || '-'}</td>
                          <td>{record.ma_gvhd || '-'}</td>
                          <td>{record.ten_gvhd || '-'}</td>
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

              {/* Pagination */}
              {records.length > 0 && pagination.totalPages > 1 && (
                <div className="mt-3 px-3 pb-3">
                  <Pagination
                    currentPage={pagination.page}
                    totalPages={pagination.totalPages}
                    onPageChange={(page) => setPagination(prev => ({ ...prev, page }))}
                    maxVisiblePages={5}
                    showFirstLast={true}
                  />
                </div>
              )}
            </>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default CIChuaChamDiemPage;
