import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Row, Col, Card, Button, Form, Alert, Spinner, Modal, Badge, ProgressBar, Dropdown, Tabs, Tab, Table } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import Pagination from '../../components/Pagination';
import * as XLSX from 'xlsx';
import '../../styles/dashboard.css';
import usePageTitle from '../../hooks/usePageTitle';
import { getApiBaseURL } from '../../utils/api';

// CSS cho dropdown menu và mobile optimization
const dropdownStyles = `
  .btn-icon {
    width: 32px;
    height: 32px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: all 0.2s;
    border: none !important;
    background: transparent !important;
    box-shadow: none !important;
  }
  
  .btn-icon:hover {
    background-color: transparent;
  }
  
  .dropdown-toggle::after {
    display: none;
  }
  
  .dropdown-menu {
    min-width: 200px;
    box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
    border: none;
    border-radius: 0.5rem;
    z-index: 99999 !important;
    position: fixed !important;
  }
  
  .action-dropdown {
    position: relative !important;
    z-index: 1000 !important;
  }
  
  .action-dropdown .dropdown-menu {
    left: auto !important;
    right: 0 !important;
    top: auto !important;
    bottom: 100% !important;
    transform: none !important;
    margin-bottom: 5px !important;
    z-index: 99999 !important;
    position: absolute !important;
  }
  
  .action-dropdown.show .dropdown-menu {
    display: block !important;
    z-index: 99999 !important;
  }
  
  .dropdown-item {
    padding: 0.5rem 1rem;
    transition: all 0.2s;
  }
  
  .dropdown-item:hover {
    background-color: #f8f9fa;
  }
  
  .dropdown-item:active {
    background-color: #e9ecef;
    color: #212529;
  }
  
  .dropdown-item.disabled {
    color: #adb5bd;
    pointer-events: none;
  }
  
  .table tbody tr:hover {
    background-color: #f8f9fa;
    cursor: pointer;
  }
  
  .table tbody tr:hover td {
    background-color: transparent;
  }

  .mr-session-table-container {
    overflow-x: auto;
    width: 100%;
  }

  .mr-session-table {
    width: 100%;
    min-width: 100%;
    table-layout: auto;
  }

  .mr-session-table th,
  .mr-session-table td {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: 0.75rem;
  }

  .mr-session-table tbody tr {
    white-space: nowrap;
  }

`;

const MedicalRecordsManagement = () => {
    const { api, currentUser } = useAuth();
    const { showAlert } = useAlert();
    const navigate = useNavigate();
    usePageTitle('Nhập hồ sơ bệnh án sinh viên');

    const moduleRoles = currentUser?.module_roles || [];
    const isMRStaffOnly = moduleRoles.includes('medicalrecords_staff') && !moduleRoles.includes('medicalrecords_admin') && !moduleRoles.includes('medicalrecords_mod');
    useEffect(() => {
        if (currentUser && isMRStaffOnly) {
            navigate('/medical-records/dashboard', { replace: true });
        }
    }, [currentUser, isMRStaffOnly, navigate]);
    
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const eventSourceRef = useRef(null);
    const fetchRecordsRef = useRef(null);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importErrors, setImportErrors] = useState([]);
    const [importSuccess, setImportSuccess] = useState('');
    const [importLoading, setImportLoading] = useState(false);
    const [importProgress, setImportProgress] = useState(0);
    const [importTotal, setImportTotal] = useState(0);
    const [importDetails, setImportDetails] = useState(null); // Thông tin chi tiết import
    const [skippedSelections, setSkippedSelections] = useState([]); // true = thêm vào DB, false = không thêm (cho skippedRecords)
    const [duplicateSelections, setDuplicateSelections] = useState([]); // cho duplicateInFileRecords
    const [importSkippedLoading, setImportSkippedLoading] = useState(false);
    const [showImportModeModal, setShowImportModeModal] = useState(false);
    const [showReplaceConfirmModal, setShowReplaceConfirmModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [recordToDelete, setRecordToDelete] = useState(null);
    const [formData, setFormData] = useState({});
    const [isMobile, setIsMobile] = useState(false);
    
    // Pagination
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 10,
        totalItems: 0,
        totalPages: 0
    });
    
    // Filters
    const [searchTenSV, setSearchTenSV] = useState('');
    const [searchTenGVHD, setSearchTenGVHD] = useState('');
    const [searchTenMH, setSearchTenMH] = useState('');
    const [searchTenBN, setSearchTenBN] = useState('');
    const [filterTrangThai, setFilterTrangThai] = useState('');
    const [filterKhoa, setFilterKhoa] = useState('');
    const [filterNamThu, setFilterNamThu] = useState('');
    const [filterLoaiHSBA, setFilterLoaiHSBA] = useState('');
    const [filterTenLop, setFilterTenLop] = useState('');
    const [dateRangeBD, setDateRangeBD] = useState({ startDate: '', endDate: '' });
    const [dateRangeNop, setDateRangeNop] = useState({ startDate: '', endDate: '' });
    
    // Debounced search terms
    const [debouncedSearchTenSV, setDebouncedSearchTenSV] = useState('');
    const [debouncedSearchTenGVHD, setDebouncedSearchTenGVHD] = useState('');
    const [debouncedSearchTenMH, setDebouncedSearchTenMH] = useState('');
    const [debouncedSearchTenBN, setDebouncedSearchTenBN] = useState('');
    
    // Statistics
    const [statistics, setStatistics] = useState(null);
    
    // Sorting
    const [sortField, setSortField] = useState('id');
    const [sortOrder, setSortOrder] = useState('desc');
    
    // Tab: 'benh-an' | 'gvhd'
    const [activeTab, setActiveTab] = useState('benh-an');
    // GVHD list
    const [gvhdList, setGvhdList] = useState([]);
    const [hospitals, setHospitals] = useState([]);
    const [gvhdLoading, setGvhdLoading] = useState(false);
    const [gvhdPagination, setGvhdPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
    const [gvhdSearch, setGvhdSearch] = useState('');
    const [gvhdSearchDebounced, setGvhdSearchDebounced] = useState('');
    const [showGvhdImportModal, setShowGvhdImportModal] = useState(false);
    const [showGvhdImportModeModal, setShowGvhdImportModeModal] = useState(false);
    const [showGvhdReplaceConfirmModal, setShowGvhdReplaceConfirmModal] = useState(false);
    const [importGvhdFile, setImportGvhdFile] = useState(null);
    const [importGvhdLoading, setImportGvhdLoading] = useState(false);
    const [importGvhdErrors, setImportGvhdErrors] = useState([]);
    const [importGvhdSuccess, setImportGvhdSuccess] = useState('');
    const [showGvhdFormModal, setShowGvhdFormModal] = useState(false);
    const [gvhdFormData, setGvhdFormData] = useState({});
    const [gvhdEditingId, setGvhdEditingId] = useState(null);
    const [gvhdFormLoading, setGvhdFormLoading] = useState(false);
    const [showGvhdDeleteModal, setShowGvhdDeleteModal] = useState(false);
    const [gvhdToDelete, setGvhdToDelete] = useState(null);
    const [gvhdSortField, setGvhdSortField] = useState('id');
    const [gvhdSortOrder, setGvhdSortOrder] = useState('desc');
    const [showHospitalModal, setShowHospitalModal] = useState(false);
    const [hospitalFormData, setHospitalFormData] = useState({ ten_benh_vien: '' });
    const [hospitalEditingId, setHospitalEditingId] = useState(null);
    const [hospitalFormLoading, setHospitalFormLoading] = useState(false);
    const [showHospitalDeleteModal, setShowHospitalDeleteModal] = useState(false);
    const [hospitalToDelete, setHospitalToDelete] = useState(null);
    const [showHospitalFormModal, setShowHospitalFormModal] = useState(false);

    // Get unique values for filters from records
    const uniqueKhoas = [...new Set(records.map(r => r.ten_ng_chng).filter(Boolean))].sort();
    const uniqueNamThus = [...new Set(records.map(r => r.nam_thu).filter(Boolean))].sort();
    const uniqueTenLops = [...new Set(records.map(r => r.ten_lop).filter(Boolean))].sort();

    // Check mobile view
    useEffect(() => {
        if (importDetails?.skippedRecords?.length != null) {
            setSkippedSelections(Array(importDetails.skippedRecords.length).fill(false));
        }
        if (importDetails?.duplicateInFileRecords?.length != null) {
            setDuplicateSelections(Array(importDetails.duplicateInFileRecords.length).fill(false));
        }
    }, [importDetails]);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Inject CSS styles
    useEffect(() => {
        const styleElement = document.createElement('style');
        styleElement.textContent = dropdownStyles;
        document.head.appendChild(styleElement);
        return () => {
            document.head.removeChild(styleElement);
        };
    }, []);

    // Debounce search terms
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTenSV(searchTenSV);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTenSV]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTenGVHD(searchTenGVHD);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTenGVHD]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTenMH(searchTenMH);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTenMH]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTenBN(searchTenBN);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTenBN]);

    useEffect(() => {
        const timer = setTimeout(() => setGvhdSearchDebounced(gvhdSearch), 500);
        return () => clearTimeout(timer);
    }, [gvhdSearch]);

    useEffect(() => {
        fetchRecords();
        fetchStatistics();
    }, [
        pagination.page,
        debouncedSearchTenSV,
        debouncedSearchTenGVHD,
        debouncedSearchTenMH,
        debouncedSearchTenBN,
        filterTrangThai,
        filterKhoa,
        filterNamThu,
        filterLoaiHSBA,
        filterTenLop,
        dateRangeBD.startDate,
        dateRangeBD.endDate,
        dateRangeNop.startDate,
        dateRangeNop.endDate,
        sortField,
        sortOrder
    ]);

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

    // silent = true: cập nhật dưới nền khi có dữ liệu mới từ API (SSE), không bật loading
    const fetchRecords = async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            setError('');
            const params = {
                page: pagination.page,
                limit: pagination.limit,
                ten_sv: debouncedSearchTenSV,
                ten_gvhd: debouncedSearchTenGVHD,
                ten_mh: debouncedSearchTenMH,
                ten_bn: debouncedSearchTenBN,
                trang_thai: filterTrangThai,
                khoa: filterKhoa,
                nam_thu: filterNamThu,
                loai_hsba: filterLoaiHSBA,
                ten_lop: filterTenLop,
                ngay_bd_from: dateRangeBD.startDate || null,
                ngay_bd_to: dateRangeBD.endDate || null,
                ngay_nop_from: dateRangeNop.startDate || null,
                ngay_nop_to: dateRangeNop.endDate || null,
                sortBy: sortField,
                sortOrder: sortOrder
            };
            
            const response = await api.get('/medical-records', { params });
            
            if (response.data?.success) {
                setRecords(response.data.data || []);
                setPagination(prev => ({
                    ...prev,
                    totalItems: response.data.pagination?.total || 0,
                    totalPages: response.data.pagination?.totalPages || 1
                }));
            } else {
                if (!silent) setError(response.data?.message || 'Lỗi khi tải danh sách hồ sơ bệnh án');
            }
        } catch (err) {
            console.error('Error fetching medical records:', err);
            if (!silent) {
                setError('Lỗi khi tải danh sách hồ sơ bệnh án');
                showAlert('Lỗi khi tải danh sách hồ sơ bệnh án', 'danger');
            }
        } finally {
            if (!silent) setLoading(false);
        }
    };
    fetchRecordsRef.current = fetchRecords;

    const fetchStatistics = async () => {
        try {
            const response = await api.get('/medical-records/stats/summary');
            if (response.data?.success) {
                setStatistics(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching statistics:', error);
        }
    };

    const fetchGvhdList = async () => {
        try {
            setGvhdLoading(true);
            const params = {
                page: gvhdPagination.page,
                limit: gvhdPagination.limit,
                search: gvhdSearchDebounced || undefined,
                sortBy: gvhdSortField,
                sortOrder: gvhdSortOrder
            };
            const response = await api.get('/medical-records/gvhd', { params });
            if (response.data?.success) {
                setGvhdList(response.data.data || []);
                setGvhdPagination(prev => ({
                    ...prev,
                    total: response.data.pagination?.total ?? 0,
                    totalPages: response.data.pagination?.totalPages ?? 1
                }));
            }
        } catch (err) {
            console.error('Error fetching GVHD list:', err);
            showAlert('Lỗi khi tải danh sách GVHD', 'danger');
            setGvhdList([]);
        } finally {
            setGvhdLoading(false);
        }
    };

    const fetchHospitals = async () => {
        try {
            const res = await api.get('/medical-records/hospitals');
            setHospitals(res.data?.data || []);
        } catch (e) {
            setHospitals([]);
        }
    };

    const openHospitalModal = () => {
        setHospitalFormData({ ten_benh_vien: '' });
        setHospitalEditingId(null);
        setShowHospitalFormModal(false);
        setShowHospitalDeleteModal(false);
        setHospitalToDelete(null);
        fetchHospitals();
        setShowHospitalModal(true);
    };

    const saveHospitalForm = async () => {
        const ten = (hospitalFormData.ten_benh_vien || '').trim();
        if (!ten) {
            showAlert('Vui lòng nhập tên bệnh viện', 'warning');
            return;
        }
        setHospitalFormLoading(true);
        try {
            if (hospitalEditingId) {
                await api.put(`/medical-records/hospitals/${hospitalEditingId}`, { ten_benh_vien: ten });
                showAlert('Đã cập nhật bệnh viện thành công', 'success');
            } else {
                await api.post('/medical-records/hospitals', { ten_benh_vien: ten });
                showAlert('Đã thêm bệnh viện thành công', 'success');
            }
            setHospitalFormData({ ten_benh_vien: '' });
            setHospitalEditingId(null);
            setShowHospitalFormModal(false);
            fetchHospitals();
        } catch (err) {
            showAlert(err.response?.data?.message || 'Có lỗi khi lưu bệnh viện', 'danger');
        } finally {
            setHospitalFormLoading(false);
        }
    };

    const cancelHospitalForm = () => {
        setHospitalFormData({ ten_benh_vien: '' });
        setHospitalEditingId(null);
        setShowHospitalFormModal(false);
    };

    const handleEditHospital = (row) => {
        setHospitalEditingId(row.id);
        setHospitalFormData({ ten_benh_vien: row.ten_benh_vien || '' });
        setShowHospitalFormModal(true);
    };

    const handleDeleteHospitalClick = (row) => {
        setHospitalToDelete(row);
        setShowHospitalDeleteModal(true);
    };

    const confirmDeleteHospital = async () => {
        if (!hospitalToDelete) return;
        try {
            await api.delete(`/medical-records/hospitals/${hospitalToDelete.id}`);
            showAlert('Đã xóa bệnh viện thành công', 'success');
            setShowHospitalDeleteModal(false);
            setHospitalToDelete(null);
            fetchHospitals();
        } catch (err) {
            showAlert(err.response?.data?.message || 'Không thể xóa bệnh viện', 'danger');
        }
    };

    const openAddGvhd = () => {
        setGvhdEditingId(null);
        setGvhdFormData({
            ma_gv: '', ho_ten: '', ngay_sinh: '', sdt: '', email: '', hoc_ham_hoc_vi: '',
            chuyen_nganh_khoa: '', benh_vien: '', chung_chi_nghiep_vu_su_pham: '',
            chung_chi_hanh_nghe: '', chung_chi_ngoai_ngu: '', ghi_chu: '', lop: ''
        });
        fetchHospitals();
        setShowGvhdFormModal(true);
    };

    /** Mở modal Thêm GVHD với Mã GV và Họ tên điền sẵn (từ cảnh báo import) */
    const openAddGvhdFromImport = (item) => {
        setGvhdEditingId(null);
        setGvhdFormData({
            ma_gv: item.ma_gvhd || '',
            ho_ten: item.ten_gvhd || '',
            ngay_sinh: '', sdt: '', email: '', hoc_ham_hoc_vi: '',
            chuyen_nganh_khoa: '', benh_vien: '', chung_chi_nghiep_vu_su_pham: '',
            chung_chi_hanh_nghe: '', chung_chi_ngoai_ngu: '', ghi_chu: '', lop: ''
        });
        fetchHospitals();
        setShowGvhdFormModal(true);
    };

    const openEditGvhd = (row) => {
        fetchHospitals();
        setGvhdEditingId(row.id);
        setGvhdFormData({
            ma_gv: row.ma_gv ?? '',
            ho_ten: row.ho_ten ?? '',
            ngay_sinh: row.ngay_sinh ? (row.ngay_sinh.split && row.ngay_sinh.split('T')[0]) : '',
            sdt: row.sdt ?? '',
            email: row.email ?? '',
            hoc_ham_hoc_vi: row.hoc_ham_hoc_vi ?? '',
            chuyen_nganh_khoa: row.chuyen_nganh_khoa ?? '',
            benh_vien: row.benh_vien != null ? String(row.benh_vien) : '',
            chung_chi_nghiep_vu_su_pham: row.chung_chi_nghiep_vu_su_pham ?? '',
            chung_chi_hanh_nghe: row.chung_chi_hanh_nghe ?? '',
            chung_chi_ngoai_ngu: row.chung_chi_ngoai_ngu ?? '',
            ghi_chu: row.ghi_chu ?? '',
            lop: row.lop ?? ''
        });
        setShowGvhdFormModal(true);
    };

    const saveGvhdForm = async () => {
        setGvhdFormLoading(true);
        try {
            if (gvhdEditingId) {
                await api.put(`/medical-records/gvhd/${gvhdEditingId}`, gvhdFormData);
                showAlert('Đã cập nhật GVHD thành công', 'success');
            } else {
                await api.post('/medical-records/gvhd', gvhdFormData);
                showAlert('Đã thêm GVHD thành công', 'success');
            }
            setShowGvhdFormModal(false);
            fetchGvhdList();
        } catch (err) {
            showAlert(err.response?.data?.message || err.message || 'Lỗi khi lưu GVHD', 'danger');
        } finally {
            setGvhdFormLoading(false);
        }
    };

    const handleDeleteGvhdClick = (row) => {
        setGvhdToDelete(row);
        setShowGvhdDeleteModal(true);
    };

    const confirmDeleteGvhd = async () => {
        if (!gvhdToDelete) return;
        try {
            await api.delete(`/medical-records/gvhd/${gvhdToDelete.id}`);
            showAlert('Đã xóa GVHD thành công', 'success');
            setShowGvhdDeleteModal(false);
            setGvhdToDelete(null);
            fetchGvhdList();
        } catch (err) {
            showAlert(err.response?.data?.message || err.message || 'Lỗi khi xóa GVHD', 'danger');
        }
    };

    const handleGvhdSort = (field) => {
        if (gvhdSortField === field) {
            setGvhdSortOrder(gvhdSortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setGvhdSortField(field);
            setGvhdSortOrder('asc');
        }
        setGvhdPagination(prev => ({ ...prev, page: 1 }));
    };

    useEffect(() => {
        if (activeTab === 'gvhd') {
            fetchGvhdList();
        }
    }, [activeTab, gvhdPagination.page, gvhdSearchDebounced, gvhdSortField, gvhdSortOrder]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const allowedTypes = [
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            ];
            
            if (!allowedTypes.includes(file.type)) {
                showAlert('Vui lòng chọn file Excel (.xls hoặc .xlsx)', 'danger');
                return;
            }
            
            setImportFile(file);
            setImportErrors([]);
            setImportSuccess('');
        }
    };

    /** Căn độ rộng cột theo nội dung (aoa = array of arrays) */
    const setExcelColWidths = (ws, aoa, minW = 8, maxW = 50) => {
        if (!aoa?.length) return;
        const numCols = Math.max(...aoa.map(row => (row || []).length));
        const widths = [];
        for (let c = 0; c < numCols; c++) {
            let maxLen = minW;
            for (let r = 0; r < aoa.length; r++) {
                const cell = aoa[r]?.[c];
                const len = cell != null ? String(cell).length : 0;
                maxLen = Math.max(maxLen, len);
            }
            widths.push({ wch: Math.min(maxLen + 1, maxW) });
        }
        ws['!cols'] = widths;
    };

    /** Tải file Excel mẫu cho nhập HSBA (cột A–W, khớp với server: M=TenDayDuBN, N=NgayBDHSBASV, O=NgaySVNopBai, P=LoaiHSBA, R=TenLop, U,V,W=Điểm) */
    const downloadHsbaSampleExcel = () => {
        const headers = [
            'TrangThaiText', 'MaGVHD', 'TenGVHD', 'IsDaChamDiem', 'DSLoaiTP', 'MaSV', 'TenDayDu', 'TenNgChng', 'NamThu', 'MaMH', 'TenMH', 'NhomTo', 'TenDayDuBN', 'NgayBDHSBASV', 'NgaySVNopBai', 'LoaiHSBA', 'MaIDHSBA', 'TenLop', 'MaNVKD', 'TenNVKD', 'DiemThiMieng', 'DiemQuaTrinh', 'DiemKhamBenh'
        ];
        const exampleRows = [
            ['', 'GV001', 'Nguyễn Văn A', '', '', 'SV001', 'Trần Thị B', 'Nội khoa', '2024-2025', 'MH01', 'Lâm sàng', '', 'Nguyễn Văn BN', '01/01/2025', '15/01/2025', 0, '', 'Lớp A', '', '', 8, 7, 8],
            ['', 'GV001', 'Nguyễn Văn A', '', '', 'SV002', 'Lê Thị C', 'Nội khoa', '2024-2025', 'MH01', 'Lâm sàng', '', 'Trần Văn BN', '05/01/2025', '18/01/2025', 0, '', 'Lớp A', '', '', 7, 8, 7],
            ['', 'GV002', 'Trần Văn B', '', '', 'SV003', 'Phạm Văn D', 'Ngoại khoa', '2024-2025', 'MH02', 'Ngoại lâm sàng', '', 'Lê Thị BN', '10/01/2025', '20/01/2025', 1, '', 'Lớp B', '', '', 9, 8, 9],
            ['', 'GV002', 'Trần Văn B', '', '', 'SV004', 'Hoàng Thị E', 'Ngoại khoa', '2024-2025', 'MH02', 'Ngoại lâm sàng', '', 'Phạm Văn BN', '12/01/2025', '22/01/2025', 1, '', 'Lớp B', '', '', 8, 7, 8],
            ['', 'GV003', 'Lê Văn C', '', '', 'SV005', 'Nguyễn Văn F', 'Nhi khoa', '2024-2025', 'MH03', 'Nhi lâm sàng', '', 'Hoàng Thị BN', '15/01/2025', '25/01/2025', 0, '', 'Lớp C', '', '', 7, 9, 8]
        ];
        const aoa = [headers, ...exampleRows];
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        setExcelColWidths(ws, aoa);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'HSBA');
        XLSX.writeFile(wb, 'Mau_nhap_HSBA.xlsx');
    };

    /** Tải file Excel mẫu cho nhập danh sách GVHD (cột A–N theo quy định nhập) */
    const downloadGvhdSampleExcel = () => {
        const headers = [
            'STT', 'Mã GV', 'Họ tên', 'Ngày sinh', 'SĐT', 'Email', 'Học hàm/học vị',
            'Chuyên ngành/Khoa', 'Bệnh viện', 'Chứng chỉ NVSP', 'Chứng chỉ hành nghề', 'Chứng chỉ NN', 'Ghi chú', 'Lớp'
        ];
        const exampleRows = [
            [1, 'GV001', 'Nguyễn Văn A', '1980-01-15', '0901234567', 'nguyenvana@email.com', 'ThS', 'Nội khoa', 'Bệnh viện A', 'Có', 'Có', 'B2', '', 'Lớp A'],
            [2, 'GV002', 'Trần Văn B', '1978-05-20', '0912345678', 'tranvanb@email.com', 'TS', 'Ngoại khoa', 'Bệnh viện B', 'Có', 'Có', 'C1', '', 'Lớp B'],
            [3, 'GV003', 'Lê Thị C', '1982-08-10', '0923456789', 'lethic@email.com', 'ThS', 'Nhi khoa', 'Bệnh viện C', 'Có', 'Có', 'B2', '', 'Lớp C'],
            [4, 'GV004', 'Phạm Văn D', '1975-12-01', '0934567890', 'phamvand@email.com', 'PGS.TS', 'Nội tổng hợp', 'Bệnh viện A', 'Có', 'Có', 'A2', '', 'Lớp A'],
            [5, 'GV005', 'Hoàng Thị E', '1985-03-25', '0945678901', 'hoangthie@email.com', 'ThS', 'Da liễu', 'Bệnh viện D', 'Có', 'Có', 'B2', '', 'Lớp D']
        ];
        const aoa = [headers, ...exampleRows];
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        setExcelColWidths(ws, aoa);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'GVHD');
        XLSX.writeFile(wb, 'Mau_nhap_GVHD.xlsx');
    };

    const handleImportExcel = async (replaceAll = false) => {
        if (!importFile) {
            setImportErrors(['Vui lòng chọn file Excel để nhập']);
            return;
        }

        setImportLoading(true);
        setImportErrors([]);
        setImportSuccess('');
        setImportProgress(0);
        setImportTotal(0);
        setImportDetails(null);

        try {
            const reader = new FileReader();

            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    
                    // Read Excel with column letters A-W
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                        header: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W'],
                        defval: null,
                        raw: false
                    });

                    if (jsonData.length === 0) {
                        setImportErrors(['File không chứa dữ liệu']);
                        setImportLoading(false);
                        return;
                    }

                    // Skip header row if exists
                    const records = jsonData.filter((row, index) => {
                        if (index === 0) {
                            const firstCell = row.A;
                            if (typeof firstCell === 'string' && (
                                firstCell.toLowerCase().includes('trạng thái') ||
                                firstCell.toLowerCase().includes('trangthai') ||
                                firstCell.toLowerCase() === 'trangthaitext' ||
                                firstCell.toLowerCase().includes('status')
                            )) {
                                return false; // Skip header row
                            }
                        }
                        return true;
                    });

                    if (records.length === 0) {
                        setImportErrors(['Không có dữ liệu hợp lệ trong file Excel']);
                        setImportLoading(false);
                        return;
                    }

                    // Initialize progress tracking
                    setImportTotal(records.length);
                    setImportProgress(0);
                    setImportSuccess('Đang tải file lên server...');

                    // Prepare data for upload
                    const formData = new FormData();
                    formData.append('excelFile', importFile);

                    // Use fetch API for SSE support
                    const token = localStorage.getItem('token');
                    const baseURL = getApiBaseURL();
                    
                    // Get CSRF token
                    let csrfToken = null;
                    try {
                        const csrfResponse = await fetch(`${baseURL}/csrf-token`, {
                            method: 'GET',
                            credentials: 'include'
                        });
                        if (csrfResponse.ok) {
                            const csrfData = await csrfResponse.json();
                            if (csrfData.success && csrfData.csrfToken) {
                                csrfToken = csrfData.csrfToken;
                            }
                        }
                    } catch (csrfError) {
                        console.warn('Failed to fetch CSRF token:', csrfError);
                    }

                    // Upload file and receive SSE progress
                    setImportSuccess('Đang tải file lên server...');
                    const url = `${baseURL}/medical-records/import?progress=true${replaceAll ? '&replaceAll=true' : ''}`;
                    const headers = {
                        'x-auth-token': token || ''
                    };
                    
                    if (csrfToken) {
                        headers['x-csrf-token'] = csrfToken;
                    }

                    const response = await fetch(url, {
                        method: 'POST',
                        headers: headers,
                        credentials: 'include',
                        body: formData
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        let errorMessage = `HTTP error! status: ${response.status}`;
                        try {
                            const errorData = JSON.parse(errorText);
                            errorMessage = errorData.message || errorMessage;
                        } catch (e) {
                            // If not JSON, use text as error message
                            if (errorText) errorMessage = errorText;
                        }
                        setImportErrors([errorMessage]);
                        setImportLoading(false);
                        return;
                    }

                    // Read SSE stream
                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();
                    let buffer = '';
                    let finalResult = null;

                    try {
                        while (true) {
                            const { done, value } = await reader.read();
                            
                            if (done) {
                                break;
                            }

                            buffer += decoder.decode(value, { stream: true });
                            const lines = buffer.split('\n');
                            buffer = lines.pop() || ''; // Keep incomplete line in buffer

                            for (const line of lines) {
                                if (line.startsWith('data: ')) {
                                    try {
                                        const data = JSON.parse(line.substring(6));
                                        
                                        if (data.type === 'start') {
                                            setImportSuccess('Bắt đầu xử lý file Excel...');
                                        } else if (data.type === 'parsed') {
                                            setImportSuccess(`Đã đọc ${data.total} bản ghi, bắt đầu xử lý...`);
                                            setImportTotal(data.total);
                                        } else if (data.type === 'processing') {
                                            setImportProgress(data.current);
                                            // Không hiển thị message chi tiết, chỉ cập nhật progress
                                        } else if (data.type === 'complete') {
                                            setImportProgress(data.total);
                                            setImportSuccess(data.message || 'Hoàn thành!');
                                            finalResult = data.data;
                                        } else if (data.type === 'error') {
                                            setImportErrors([data.message || 'Lỗi khi xử lý file Excel']);
                                            setImportLoading(false);
                                            return;
                                        }
                                    } catch (parseError) {
                                        console.error('Error parsing SSE data:', parseError);
                                    }
                                }
                            }
                        }

                        if (finalResult) {
                            // Lưu thông tin chi tiết
                            setImportDetails({
                                total: finalResult.total || 0,
                                success: finalResult.success || 0,
                                updated: finalResult.updated || 0,
                                skipped: finalResult.skipped || 0,
                                duplicateInFile: finalResult.duplicateInFile || 0,
                                failed: finalResult.failed || 0,
                                skippedRecords: finalResult.skippedRecords || [],
                                updatedRecords: finalResult.updatedRecords || [],
                                duplicateInFileRecords: finalResult.duplicateInFileRecords || [],
                                errors: finalResult.errors || [],
                                gvhdWithoutBenhVien: finalResult.gvhdWithoutBenhVien || []
                            });
                            
                            if (finalResult.errors && finalResult.errors.length > 0) {
                                const errorMessages = finalResult.errors.map(err => `Dòng ${err.row}: ${err.error}`).slice(0, 10);
                                setImportErrors(errorMessages);
                            }
                            
                            // Refresh data nhưng không đóng modal
                            fetchRecords();
                            fetchStatistics();
                        }
                        
                        setImportLoading(false);
                    } catch (streamError) {
                        console.error('Error reading SSE stream:', streamError);
                        setImportErrors([streamError.message || 'Lỗi khi đọc dữ liệu từ server']);
                        setImportLoading(false);
                    }
                } catch (error) {
                    console.error('Error processing Excel file:', error);
                    setImportErrors(['Lỗi xử lý file Excel. Vui lòng kiểm tra định dạng file.']);
                } finally {
                    setImportLoading(false);
                }
            };

            reader.readAsArrayBuffer(importFile);
        } catch (error) {
            console.error('Error importing Excel:', error);
            setImportErrors([error.message || 'Lỗi không xác định']);
            setImportLoading(false);
        }
    };

    const RECORD_FIELDS = [
        { key: 'trang_thai_text', label: 'Trạng thái' },
        { key: 'ma_gvhd', label: 'Mã GVHD' },
        { key: 'ten_gvhd', label: 'Tên GVHD' },
        { key: 'benh_vien', label: 'Bệnh viện' },
        { key: 'ma_sv', label: 'Mã SV' },
        { key: 'ten_day_du', label: 'Tên SV' },
        { key: 'ten_ng_chng', label: 'Khoa' },
        { key: 'nam_thu', label: 'Năm học' },
        { key: 'ma_mh', label: 'Mã MH' },
        { key: 'ten_mh', label: 'Tên MH' },
        { key: 'ten_day_du_bn', label: 'Tên BN' },
        { key: 'ngay_bd_hsbasv', label: 'Ngày BD' },
        { key: 'ngay_sv_nop_bai', label: 'Ngày nộp' },
        { key: 'loai_hsba', label: 'Loại HSBA' },
        { key: 'ten_lop', label: 'Tên lớp' },
        { key: 'diem_thi_mieng', label: 'Điểm thi miệng' },
        { key: 'diem_qua_trinh', label: 'Điểm quá trình' },
        { key: 'diem_kham_benh', label: 'Điểm khám bệnh' }
    ];

    const toInsertPayload = (record) => ({
        trang_thai_text: record.trang_thai_text ?? null,
        ma_gvhd: record.ma_gvhd ?? null,
        ten_gvhd: record.ten_gvhd ?? null,
        benh_vien: record.benh_vien ?? null,
        ma_sv: record.ma_sv ?? null,
        ten_day_du: record.ten_day_du ?? null,
        ten_ng_chng: record.ten_ng_chng ?? null,
        nam_thu: record.nam_thu ?? null,
        ma_mh: record.ma_mh ?? null,
        ten_mh: record.ten_mh ?? null,
        ten_day_du_bn: record.ten_day_du_bn ?? null,
        ngay_bd_hsbasv: record.ngay_bd_hsbasv ?? null,
        ngay_sv_nop_bai: record.ngay_sv_nop_bai ?? null,
        loai_hsba: record.loai_hsba ?? null,
        ten_lop: record.ten_lop ?? null,
        diem_thi_mieng: record.diem_thi_mieng ?? null,
        diem_qua_trinh: record.diem_qua_trinh ?? null,
        diem_kham_benh: record.diem_kham_benh ?? null
    });

    const handleImportSkippedSelected = async () => {
        const skipped = (importDetails?.skippedRecords || []).filter((_, i) => skippedSelections[i]);
        const duplicate = (importDetails?.duplicateInFileRecords || []).filter((_, i) => duplicateSelections[i]);
        const records = [...skipped.map(toInsertPayload), ...duplicate.map(toInsertPayload)];
        if (records.length === 0) {
            showAlert('Vui lòng chọn ít nhất một bản ghi (tick ✓) để thêm vào database.', 'warning');
            return;
        }
        setImportSkippedLoading(true);
        try {
            const response = await api.post('/medical-records/import-skipped', { records });
            if (response.data?.success) {
                showAlert(response.data.message || `Đã thêm ${response.data.data?.inserted ?? 0} bản ghi vào database.`, 'success');
                fetchRecords();
                fetchStatistics();
                setImportDetails(prev => prev ? {
                    ...prev,
                    skippedRecords: (prev.skippedRecords || []).filter((_, i) => !skippedSelections[i]),
                    duplicateInFileRecords: (prev.duplicateInFileRecords || []).filter((_, i) => !duplicateSelections[i]),
                    skipped: (prev.skipped || 0) - skipped.length,
                    duplicateInFile: (prev.duplicateInFile || 0) - duplicate.length,
                    success: (prev.success || 0) + (response.data.data?.inserted ?? 0)
                } : null);
            } else {
                showAlert(response.data?.message || 'Thêm bản ghi thất bại.', 'danger');
            }
        } catch (err) {
            showAlert(err.response?.data?.message || err.message || 'Lỗi khi thêm bản ghi.', 'danger');
        } finally {
            setImportSkippedLoading(false);
        }
    };

    const handleEdit = (record) => {
        setSelectedRecord(record);
        setFormData({
            trang_thai_text: record.trang_thai_text || '',
            ma_gvhd: record.ma_gvhd || '',
            ten_gvhd: record.ten_gvhd || '',
            benh_vien: record.benh_vien || '',
            ma_sv: record.ma_sv || '',
            ten_day_du: record.ten_day_du || '',
            ten_ng_chng: record.ten_ng_chng || '',
            nam_thu: record.nam_thu || '',
            ma_mh: record.ma_mh || '',
            ten_mh: record.ten_mh || '',
            ten_day_du_bn: record.ten_day_du_bn || '',
            ngay_bd_hsbasv: record.ngay_bd_hsbasv || '',
            ngay_sv_nop_bai: record.ngay_sv_nop_bai || '',
            loai_hsba: record.loai_hsba !== null ? record.loai_hsba : '',
            ten_lop: record.ten_lop || '',
            diem_thi_mieng: record.diem_thi_mieng || '',
            diem_qua_trinh: record.diem_qua_trinh || '',
            diem_kham_benh: record.diem_kham_benh || ''
        });
        setShowEditModal(true);
    };

    const handleUpdate = async () => {
        try {
            const response = await api.put(`/medical-records/${selectedRecord.id}`, formData);
            
            if (response.data?.success) {
                showAlert('Cập nhật hồ sơ bệnh án thành công', 'success');
                setShowEditModal(false);
                fetchRecords();
            } else {
                showAlert(response.data?.message || 'Lỗi khi cập nhật', 'danger');
            }
        } catch (error) {
            console.error('Error updating record:', error);
            showAlert('Lỗi khi cập nhật hồ sơ bệnh án', 'danger');
        }
    };

    const handleDeleteClick = (record) => {
        setRecordToDelete(record);
        setShowDeleteModal(true);
    };

    const handleDelete = async () => {
        if (!recordToDelete) return;

        try {
            const response = await api.delete(`/medical-records/${recordToDelete.id}`);
            
            if (response.data?.success) {
                showAlert('Xóa hồ sơ bệnh án thành công', 'success');
                setShowDeleteModal(false);
                setRecordToDelete(null);
                fetchRecords();
                fetchStatistics();
            } else {
                showAlert(response.data?.message || 'Lỗi khi xóa', 'danger');
            }
        } catch (error) {
            console.error('Error deleting record:', error);
            showAlert('Lỗi khi xóa hồ sơ bệnh án', 'danger');
        }
    };

    const handleGvhdFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const allowedTypes = [
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            ];
            if (!allowedTypes.includes(file.type)) {
                showAlert('Vui lòng chọn file Excel (.xls hoặc .xlsx)', 'danger');
                return;
            }
            setImportGvhdFile(file);
            setImportGvhdErrors([]);
            setImportGvhdSuccess('');
        }
    };

    const handleGvhdImportExcel = async (replaceAll = false) => {
        if (!importGvhdFile) {
            setImportGvhdErrors(['Vui lòng chọn file Excel để nhập']);
            return;
        }
        setImportGvhdLoading(true);
        setImportGvhdErrors([]);
        setImportGvhdSuccess('');
        try {
            const formData = new FormData();
            formData.append('excelFile', importGvhdFile);
            const url = `/medical-records/gvhd/import${replaceAll ? '?replaceAll=true' : ''}`;
            const response = await api.post(url, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (response.data?.success) {
                const data = response.data.data || {};
                setImportGvhdSuccess(response.data.message || `Đã nhập ${data.success || 0} bản ghi GVHD thành công`);
                if (response.data.data?.errors?.length) {
                    setImportGvhdErrors(response.data.data.errors.slice(0, 10).map(e => `Dòng ${e.row}: ${e.error}`));
                }
                fetchGvhdList();
            } else {
                setImportGvhdErrors([response.data?.message || 'Nhập dữ liệu thất bại']);
            }
        } catch (err) {
            console.error('Error importing GVHD Excel:', err);
            const msg = err.response?.data?.message || err.message || 'Lỗi khi nhập file Excel GVHD';
            setImportGvhdErrors([msg]);
        } finally {
            setImportGvhdLoading(false);
        }
    };

    // Format date helper function
    const formatDate = (dateString) => {
        if (!dateString) return '-';
        try {
            // If it's already in dd/MM/yyyy format, return as is
            if (typeof dateString === 'string' && dateString.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
                return dateString;
            }
            // Parse date string (could be YYYY-MM-DD or ISO format)
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return dateString;
            // Format as dd/MM/yyyy
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
        } catch (error) {
            console.error('Error formatting date:', error);
            return dateString;
        }
    };

    // Format datetime helper function (for created_at)
    const formatDateTime = (dateString) => {
        if (!dateString) return '-';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return dateString;
            // Format as dd/MM/yyyy HH:mm:ss
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
        } catch (error) {
            console.error('Error formatting datetime:', error);
            return dateString;
        }
    };

    const formatScore = (score) => {
        // Hiển thị "-" nếu không có điểm (null, undefined, empty string)
        if (score === null || score === undefined || score === '') return '-';
        const parsed = parseFloat(score);
        // Nếu không phải số hợp lệ thì hiển thị "-"
        if (isNaN(parsed)) return '-';
        // Nếu là số hợp lệ (kể cả 0) thì hiển thị với 2 chữ số thập phân
        return parsed.toFixed(2);
    };

    const getTrangThaiBadge = (trangThai) => {
        if (!trangThai) return <Badge bg="secondary">-</Badge>;
        
        const lower = trangThai.toLowerCase();
        if (lower.includes('đang thực hiện')) {
            return <Badge bg="warning">Đang thực hiện</Badge>;
        } else if (lower.includes('đã nộp bài')) {
            return <Badge bg="info">Đã nộp bài</Badge>;
        } else if (lower.includes('đã chấm điểm')) {
            return <Badge bg="success">Đã chấm điểm</Badge>;
        }
        return <Badge bg="secondary">{trangThai}</Badge>;
    };

    const getLoaiHSBALabel = (loai) => {
        // 0 = Điểm quá trình, 1 = Điểm bệnh án thi. Không hiển thị "-" khi có giá trị hợp lệ.
        if (loai === 0 || loai === '0') return 'Điểm quá trình';
        if (loai === 1 || loai === '1') return 'Điểm bệnh án thi';
        return '-';
    };

    const handleSort = (field) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('asc');
        }
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        if (tab === 'gvhd') setGvhdPagination(prev => ({ ...prev, page: 1 }));
    };

    const renderBenhAnTab = () => (
        <>
            {/* Filters */}
            <div className="mr-filters">
                {/* Hàng 1: Search inputs + Date range Ngày BD */}
                <div className="mr-filters-row">
                    <input
                        type="text"
                        className="mr-filter-input"
                        placeholder="Tìm kiếm Tên SV..."
                        value={searchTenSV}
                        onChange={(e) => {
                            setSearchTenSV(e.target.value);
                            setPagination(prev => ({ ...prev, page: 1 }));
                        }}
                    />
                    <input
                        type="text"
                        className="mr-filter-input"
                        placeholder="Tìm kiếm Tên GVHD..."
                        value={searchTenGVHD}
                        onChange={(e) => {
                            setSearchTenGVHD(e.target.value);
                            setPagination(prev => ({ ...prev, page: 1 }));
                        }}
                    />
                    <input
                        type="text"
                        className="mr-filter-input"
                        placeholder="Tìm kiếm Tên MH..."
                        value={searchTenMH}
                        onChange={(e) => {
                            setSearchTenMH(e.target.value);
                            setPagination(prev => ({ ...prev, page: 1 }));
                        }}
                    />
                    <input
                        type="text"
                        className="mr-filter-input"
                        placeholder="Tìm kiếm Tên BN..."
                        value={searchTenBN}
                        onChange={(e) => {
                            setSearchTenBN(e.target.value);
                            setPagination(prev => ({ ...prev, page: 1 }));
                        }}
                    />
                    <div className="mr-date-range-filter">
                        <label>Ngày BD:</label>
                        <input
                            type="date"
                            value={dateRangeBD.startDate}
                            onChange={(e) => {
                                setDateRangeBD(prev => ({ ...prev, startDate: e.target.value }));
                                setPagination(prev => ({ ...prev, page: 1 }));
                            }}
                        />
                        <span>đến</span>
                        <input
                            type="date"
                            value={dateRangeBD.endDate}
                            onChange={(e) => {
                                setDateRangeBD(prev => ({ ...prev, endDate: e.target.value }));
                                setPagination(prev => ({ ...prev, page: 1 }));
                            }}
                        />
                    </div>
                </div>

                {/* Hàng 2: Select options + Date range Ngày nộp */}
                <div className="mr-filters-row">
                    <select
                        className="mr-filter-select"
                        value={filterTrangThai}
                        onChange={(e) => {
                            setFilterTrangThai(e.target.value);
                            setPagination(prev => ({ ...prev, page: 1 }));
                        }}
                    >
                        <option value="">Tất cả trạng thái</option>
                        <option value="SV đang thực hiện">SV đang thực hiện</option>
                        <option value="SV đã nộp bài">SV đã nộp bài</option>
                        <option value="CI đã chấm điểm">CI đã chấm điểm</option>
                    </select>

                    <select
                        className="mr-filter-select"
                        value={filterKhoa}
                        onChange={(e) => {
                            setFilterKhoa(e.target.value);
                            setPagination(prev => ({ ...prev, page: 1 }));
                        }}
                    >
                        <option value="">Tất cả khoa</option>
                        {uniqueKhoas.map((khoa, idx) => (
                            <option key={idx} value={khoa}>{khoa}</option>
                        ))}
                    </select>

                    <select
                        className="mr-filter-select"
                        value={filterNamThu}
                        onChange={(e) => {
                            setFilterNamThu(e.target.value);
                            setPagination(prev => ({ ...prev, page: 1 }));
                        }}
                    >
                        <option value="">Tất cả năm học</option>
                        {uniqueNamThus.map((namThu, idx) => (
                            <option key={idx} value={namThu}>{namThu}</option>
                        ))}
                    </select>

                    <select
                        className="mr-filter-select"
                        value={filterLoaiHSBA}
                        onChange={(e) => {
                            setFilterLoaiHSBA(e.target.value);
                            setPagination(prev => ({ ...prev, page: 1 }));
                        }}
                    >
                        <option value="">Tất cả loại HSBA</option>
                        <option value="0">Điểm quá trình</option>
                        <option value="1">Điểm bệnh án thi</option>
                    </select>

                    <select
                        className="mr-filter-select"
                        value={filterTenLop}
                        onChange={(e) => {
                            setFilterTenLop(e.target.value);
                            setPagination(prev => ({ ...prev, page: 1 }));
                        }}
                    >
                        <option value="">Tất cả lớp</option>
                        {uniqueTenLops.map((tenLop, idx) => (
                            <option key={idx} value={tenLop}>{tenLop}</option>
                        ))}
                    </select>

                    <div className="mr-date-range-filter">
                        <label>Ngày nộp:</label>
                        <input
                            type="date"
                            value={dateRangeNop.startDate}
                            onChange={(e) => {
                                setDateRangeNop(prev => ({ ...prev, startDate: e.target.value }));
                                setPagination(prev => ({ ...prev, page: 1 }));
                            }}
                        />
                        <span>đến</span>
                        <input
                            type="date"
                            value={dateRangeNop.endDate}
                            onChange={(e) => {
                                setDateRangeNop(prev => ({ ...prev, endDate: e.target.value }));
                                setPagination(prev => ({ ...prev, page: 1 }));
                            }}
                        />
                    </div>
                </div>
            </div>

            <Container fluid className="py-4">
                <div className="user-management-container">

                    {/* Table */}
                    <div className="mr-session-table-container">
                        {loading ? (
                            <div className="text-center p-5">
                                <Spinner animation="border" variant="primary" />
                                <p className="mt-3 text-muted">Đang tải dữ liệu...</p>
                            </div>
                        ) : (
                            <>
                                <div className="mr-table-responsive" style={{ overflowX: 'auto', width: '100%' }}>
                                    <table className="mr-session-table" style={{ width: '100%', minWidth: 'max-content', tableLayout: 'auto' }}>
                                        <thead>
                                            <tr>
                                                <th className={isMobile ? "mobile-hide" : ""} style={{ whiteSpace: 'nowrap' }}>STT</th>
                                                <th 
                                                    className={isMobile ? "mobile-hide" : ""} 
                                                    style={{ whiteSpace: 'nowrap', cursor: 'pointer' }}
                                                    onClick={() => handleSort('created_at')}
                                                >
                                                    Thời gian Nhập {sortField === 'created_at' && (
                                                        <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                                                    )}
                                                </th>
                                                <th 
                                                    className="mobile-essential" 
                                                    style={{ whiteSpace: 'nowrap', cursor: 'pointer' }}
                                                    onClick={() => handleSort('trang_thai_text')}
                                                >
                                                    Trạng thái {sortField === 'trang_thai_text' && (
                                                        <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                                                    )}
                                                </th>
                                                <th 
                                                    className="mobile-essential" 
                                                    style={{ whiteSpace: 'nowrap', cursor: 'pointer' }}
                                                    onClick={() => handleSort('ma_sv')}
                                                >
                                                    Mã SV {sortField === 'ma_sv' && (
                                                        <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                                                    )}
                                                </th>
                                                <th 
                                                    className="mobile-essential" 
                                                    style={{ whiteSpace: 'nowrap', cursor: 'pointer' }}
                                                    onClick={() => handleSort('ten_day_du')}
                                                >
                                                    Tên SV {sortField === 'ten_day_du' && (
                                                        <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                                                    )}
                                                </th>
                                                <th 
                                                    className={isMobile ? "mobile-hide" : ""} 
                                                    style={{ whiteSpace: 'nowrap', cursor: 'pointer' }}
                                                    onClick={() => handleSort('ma_gvhd')}
                                                >
                                                    Mã GVHD {sortField === 'ma_gvhd' && (
                                                        <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                                                    )}
                                                </th>
                                                <th 
                                                    className={isMobile ? "mobile-hide" : ""} 
                                                    style={{ whiteSpace: 'nowrap', cursor: 'pointer' }}
                                                    onClick={() => handleSort('ten_gvhd')}
                                                >
                                                    Tên GVHD {sortField === 'ten_gvhd' && (
                                                        <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                                                    )}
                                                </th>
                                                <th 
                                                    className={isMobile ? "mobile-hide" : ""} 
                                                    style={{ whiteSpace: 'nowrap', cursor: 'pointer' }}
                                                    onClick={() => handleSort('benh_vien')}
                                                >
                                                    Bệnh viện {sortField === 'benh_vien' && (
                                                        <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                                                    )}
                                                </th>
                                                <th 
                                                    className={isMobile ? "mobile-hide" : ""} 
                                                    style={{ whiteSpace: 'nowrap', cursor: 'pointer' }}
                                                    onClick={() => handleSort('ten_ng_chng')}
                                                >
                                                    Khoa {sortField === 'ten_ng_chng' && (
                                                        <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                                                    )}
                                                </th>
                                                <th 
                                                    className={isMobile ? "mobile-hide" : ""} 
                                                    style={{ whiteSpace: 'nowrap', cursor: 'pointer' }}
                                                    onClick={() => handleSort('nam_thu')}
                                                >
                                                    Năm học {sortField === 'nam_thu' && (
                                                        <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                                                    )}
                                                </th>
                                                <th 
                                                    className={isMobile ? "mobile-hide" : ""} 
                                                    style={{ whiteSpace: 'nowrap', cursor: 'pointer' }}
                                                    onClick={() => handleSort('ma_mh')}
                                                >
                                                    Mã MH {sortField === 'ma_mh' && (
                                                        <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                                                    )}
                                                </th>
                                                <th 
                                                    className={isMobile ? "mobile-hide" : ""} 
                                                    style={{ whiteSpace: 'nowrap', cursor: 'pointer' }}
                                                    onClick={() => handleSort('ten_mh')}
                                                >
                                                    Tên MH {sortField === 'ten_mh' && (
                                                        <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                                                    )}
                                                </th>
                                                <th 
                                                    className={isMobile ? "mobile-hide" : ""} 
                                                    style={{ whiteSpace: 'nowrap', cursor: 'pointer' }}
                                                    onClick={() => handleSort('ten_day_du_bn')}
                                                >
                                                    Tên BN {sortField === 'ten_day_du_bn' && (
                                                        <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                                                    )}
                                                </th>
                                                <th 
                                                    className={isMobile ? "mobile-hide" : ""} 
                                                    style={{ whiteSpace: 'nowrap', cursor: 'pointer' }}
                                                    onClick={() => handleSort('ngay_bd_hsbasv')}
                                                >
                                                    Ngày BD {sortField === 'ngay_bd_hsbasv' && (
                                                        <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                                                    )}
                                                </th>
                                                <th 
                                                    className={isMobile ? "mobile-hide" : ""} 
                                                    style={{ whiteSpace: 'nowrap', cursor: 'pointer' }}
                                                    onClick={() => handleSort('ngay_sv_nop_bai')}
                                                >
                                                    Ngày nộp {sortField === 'ngay_sv_nop_bai' && (
                                                        <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                                                    )}
                                                </th>
                                                <th 
                                                    className={isMobile ? "mobile-hide" : ""} 
                                                    style={{ whiteSpace: 'nowrap', cursor: 'pointer' }}
                                                    onClick={() => handleSort('loai_hsba')}
                                                >
                                                    Loại HSBA {sortField === 'loai_hsba' && (
                                                        <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                                                    )}
                                                </th>
                                                <th 
                                                    className={isMobile ? "mobile-hide" : ""} 
                                                    style={{ whiteSpace: 'nowrap', cursor: 'pointer' }}
                                                    onClick={() => handleSort('ten_lop')}
                                                >
                                                    Tên lớp {sortField === 'ten_lop' && (
                                                        <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                                                    )}
                                                </th>
                                                <th 
                                                    className={isMobile ? "mobile-hide" : ""} 
                                                    style={{ whiteSpace: 'nowrap', cursor: 'pointer' }}
                                                    onClick={() => handleSort('diem_thi_mieng')}
                                                >
                                                    Điểm thi miệng {sortField === 'diem_thi_mieng' && (
                                                        <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                                                    )}
                                                </th>
                                                <th 
                                                    className={isMobile ? "mobile-hide" : ""} 
                                                    style={{ whiteSpace: 'nowrap', cursor: 'pointer' }}
                                                    onClick={() => handleSort('diem_qua_trinh')}
                                                >
                                                    Điểm quá trình {sortField === 'diem_qua_trinh' && (
                                                        <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                                                    )}
                                                </th>
                                                <th 
                                                    className={isMobile ? "mobile-hide" : ""} 
                                                    style={{ whiteSpace: 'nowrap', cursor: 'pointer' }}
                                                    onClick={() => handleSort('diem_kham_benh')}
                                                >
                                                    Điểm khám bệnh {sortField === 'diem_kham_benh' && (
                                                        <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                                                    )}
                                                </th>
                                                <th className="mobile-essential" style={{ whiteSpace: 'nowrap' }}>Thao tác</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {records.length === 0 ? (
                                                <tr>
                                                    <td colSpan="21" className="text-center">
                                                        {loading ? (
                                                            <Spinner animation="border" size="sm" />
                                                        ) : (
                                                            'Không có dữ liệu'
                                                        )}
                                                    </td>
                                                </tr>
                                            ) : (
                                                records.map((record, index) => (
                                                    <tr
                                                        key={record.id}
                                                        onClick={() => handleEdit(record)}
                                                        role="button"
                                                        tabIndex={0}
                                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleEdit(record); } }}
                                                        style={{ cursor: 'pointer' }}
                                                    >
                                                        <td className={isMobile ? "mobile-hide" : ""} style={{ whiteSpace: 'nowrap' }}>
                                                            {(pagination.page - 1) * pagination.limit + index + 1}
                                                        </td>
                                                        <td className={isMobile ? "mobile-hide" : ""} style={{ whiteSpace: 'nowrap' }}>
                                                            {formatDateTime(record.created_at)}
                                                        </td>
                                                        <td className="mobile-essential" style={{ whiteSpace: 'nowrap' }}>
                                                            {getTrangThaiBadge(record.trang_thai_text)}
                                                        </td>
                                                        <td className="mobile-essential" style={{ whiteSpace: 'nowrap' }}>
                                                            <Badge bg="secondary">{record.ma_sv || '-'}</Badge>
                                                        </td>
                                                        <td className="mobile-essential" style={{ whiteSpace: 'nowrap' }}>{record.ten_day_du || '-'}</td>
                                                        <td className={isMobile ? "mobile-hide" : ""} style={{ whiteSpace: 'nowrap' }}>{record.ma_gvhd || '-'}</td>
                                                        <td className={isMobile ? "mobile-hide" : ""} style={{ whiteSpace: 'nowrap' }}>{record.ten_gvhd || '-'}</td>
                                                        <td className={isMobile ? "mobile-hide" : ""} style={{ whiteSpace: 'nowrap' }}>{record.benh_vien || '-'}</td>
                                                        <td className={isMobile ? "mobile-hide" : ""} style={{ whiteSpace: 'nowrap' }}>{record.ten_ng_chng || '-'}</td>
                                                        <td className={isMobile ? "mobile-hide" : ""} style={{ whiteSpace: 'nowrap' }}>{record.nam_thu || '-'}</td>
                                                        <td className={isMobile ? "mobile-hide" : ""} style={{ whiteSpace: 'nowrap' }}>{record.ma_mh || '-'}</td>
                                                        <td className={isMobile ? "mobile-hide" : ""} style={{ whiteSpace: 'nowrap' }}>{record.ten_mh || '-'}</td>
                                                        <td className={isMobile ? "mobile-hide" : ""} style={{ whiteSpace: 'nowrap' }}>{record.ten_day_du_bn || '-'}</td>
                                                        <td className={isMobile ? "mobile-hide" : ""} style={{ whiteSpace: 'nowrap' }}>{formatDate(record.ngay_bd_hsbasv)}</td>
                                                        <td className={isMobile ? "mobile-hide" : ""} style={{ whiteSpace: 'nowrap' }}>{formatDate(record.ngay_sv_nop_bai)}</td>
                                                        <td className={isMobile ? "mobile-hide" : ""} style={{ whiteSpace: 'nowrap' }}>
                                                            {getLoaiHSBALabel(record.loai_hsba)}
                                                        </td>
                                                        <td className={isMobile ? "mobile-hide" : ""} style={{ whiteSpace: 'nowrap' }}>{record.ten_lop || '-'}</td>
                                                        <td className={isMobile ? "mobile-hide" : ""} style={{ whiteSpace: 'nowrap' }}>{formatScore(record.diem_thi_mieng)}</td>
                                                        <td className={isMobile ? "mobile-hide" : ""} style={{ whiteSpace: 'nowrap' }}>{formatScore(record.diem_qua_trinh)}</td>
                                                        <td className={isMobile ? "mobile-hide" : ""} style={{ whiteSpace: 'nowrap' }}>{formatScore(record.diem_kham_benh)}</td>
                                                        <td className="mobile-essential" style={{ whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                                                            <div className="d-flex align-items-center gap-1 justify-content-start">
                                                                <Button
                                                                    variant="light"
                                                                    size="sm"
                                                                    className="btn-icon text-primary"
                                                                    onClick={() => handleEdit(record)}
                                                                    title="Chỉnh sửa"
                                                                >
                                                                    <i className="fas fa-edit"></i>
                                                                </Button>
                                                                <Button
                                                                    variant="light"
                                                                    size="sm"
                                                                    className="btn-icon text-danger"
                                                                    onClick={() => handleDeleteClick(record)}
                                                                    title="Xóa"
                                                                >
                                                                    <i className="fas fa-trash"></i>
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination */}
                                {records.length > 0 && pagination.totalPages > 1 && (
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
                            </>
                        )}
                    </div>
                </div>
            </Container>
        </>
    );

    const renderGvhdTab = () => (
        <Container fluid className="py-4">
            <div className="mr-filters-row mb-3">
                <input
                    type="text"
                    className="mr-filter-input"
                    placeholder="Tìm kiếm Mã GV, Họ tên, Email, Khoa, Lớp..."
                    value={gvhdSearch}
                    onChange={(e) => {
                        setGvhdSearch(e.target.value);
                        setGvhdPagination(prev => ({ ...prev, page: 1 }));
                    }}
                    style={{ maxWidth: '400px' }}
                />
            </div>
            <div className="mr-session-table-container">
                {gvhdLoading ? (
                    <div className="text-center p-5">
                        <Spinner animation="border" variant="primary" />
                        <p className="mt-3 text-muted">Đang tải danh sách GVHD...</p>
                    </div>
                ) : (
                    <>
                        <div className="mr-table-responsive" style={{ overflowX: 'auto' }}>
                            <table className="mr-session-table table table-bordered table-hover">
                                <thead className="table-light">
                                    <tr>
                                        <th style={{ whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => handleGvhdSort('id')}>
                                            STT {gvhdSortField === 'id' && (<i className={`fas fa-sort-${gvhdSortOrder === 'asc' ? 'up' : 'down'}`}></i>)}
                                        </th>
                                        <th style={{ whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => handleGvhdSort('ma_gv')}>
                                            Mã GV {gvhdSortField === 'ma_gv' && (<i className={`fas fa-sort-${gvhdSortOrder === 'asc' ? 'up' : 'down'}`}></i>)}
                                        </th>
                                        <th style={{ whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => handleGvhdSort('ho_ten')}>
                                            Họ và tên {gvhdSortField === 'ho_ten' && (<i className={`fas fa-sort-${gvhdSortOrder === 'asc' ? 'up' : 'down'}`}></i>)}
                                        </th>
                                        <th style={{ whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => handleGvhdSort('ngay_sinh')}>
                                            Ngày sinh {gvhdSortField === 'ngay_sinh' && (<i className={`fas fa-sort-${gvhdSortOrder === 'asc' ? 'up' : 'down'}`}></i>)}
                                        </th>
                                        <th style={{ whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => handleGvhdSort('sdt')}>
                                            SĐT {gvhdSortField === 'sdt' && (<i className={`fas fa-sort-${gvhdSortOrder === 'asc' ? 'up' : 'down'}`}></i>)}
                                        </th>
                                        <th style={{ whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => handleGvhdSort('email')}>
                                            Email {gvhdSortField === 'email' && (<i className={`fas fa-sort-${gvhdSortOrder === 'asc' ? 'up' : 'down'}`}></i>)}
                                        </th>
                                        <th style={{ whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => handleGvhdSort('hoc_ham_hoc_vi')}>
                                            Học hàm/học vị {gvhdSortField === 'hoc_ham_hoc_vi' && (<i className={`fas fa-sort-${gvhdSortOrder === 'asc' ? 'up' : 'down'}`}></i>)}
                                        </th>
                                        <th style={{ whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => handleGvhdSort('chuyen_nganh_khoa')}>
                                            Chuyên ngành/Khoa {gvhdSortField === 'chuyen_nganh_khoa' && (<i className={`fas fa-sort-${gvhdSortOrder === 'asc' ? 'up' : 'down'}`}></i>)}
                                        </th>
                                        <th style={{ whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => handleGvhdSort('benh_vien')}>
                                            Bệnh viện {gvhdSortField === 'benh_vien' && (<i className={`fas fa-sort-${gvhdSortOrder === 'asc' ? 'up' : 'down'}`}></i>)}
                                        </th>
                                        <th>Chứng chỉ NVSP</th>
                                        <th>Chứng chỉ hành nghề</th>
                                        <th>Chứng chỉ Ngoại ngữ</th>
                                        <th>Ghi chú</th>
                                        <th style={{ whiteSpace: 'nowrap', cursor: 'pointer' }} onClick={() => handleGvhdSort('lop')}>
                                            Lớp {gvhdSortField === 'lop' && (<i className={`fas fa-sort-${gvhdSortOrder === 'asc' ? 'up' : 'down'}`}></i>)}
                                        </th>
                                        <th style={{ whiteSpace: 'nowrap' }}>Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {gvhdList.length === 0 ? (
                                        <tr>
                                            <td colSpan="15" className="text-center text-muted py-4">
                                                Chưa có dữ liệu. Vui lòng nhập file Excel ở nút &quot;Nhập từ Excel&quot; hoặc thêm GVHD bằng nút &quot;Thêm GVHD&quot;.
                                            </td>
                                        </tr>
                                    ) : (
                                        gvhdList.map((row, idx) => (
                                            <tr
                                                key={row.id || idx}
                                                onClick={() => openEditGvhd(row)}
                                                role="button"
                                                tabIndex={0}
                                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEditGvhd(row); } }}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <td>{(gvhdPagination.page - 1) * gvhdPagination.limit + idx + 1}</td>
                                                <td>{row.ma_gv ?? '-'}</td>
                                                <td>{row.ho_ten ?? '-'}</td>
                                                <td>{row.ngay_sinh ? formatDate(row.ngay_sinh) : '-'}</td>
                                                <td>{row.sdt ?? '-'}</td>
                                                <td>{row.email ?? '-'}</td>
                                                <td>{row.hoc_ham_hoc_vi ?? '-'}</td>
                                                <td>{row.chuyen_nganh_khoa ?? '-'}</td>
                                                <td>{row.ten_benh_vien ?? row.benh_vien ?? '-'}</td>
                                                <td>{row.chung_chi_nghiep_vu_su_pham ?? '-'}</td>
                                                <td>{row.chung_chi_hanh_nghe ?? '-'}</td>
                                                <td>{row.chung_chi_ngoai_ngu ?? '-'}</td>
                                                <td title={row.ghi_chu}>{row.ghi_chu ? String(row.ghi_chu).slice(0, 50) + (String(row.ghi_chu).length > 50 ? '...' : '') : '-'}</td>
                                                <td>{row.lop ?? '-'}</td>
                                                <td style={{ whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                                                    <div className="d-flex align-items-center gap-1 justify-content-start">
                                                        <Button
                                                            variant="light"
                                                            size="sm"
                                                            className="btn-icon text-primary"
                                                            onClick={() => openEditGvhd(row)}
                                                            title="Chỉnh sửa"
                                                        >
                                                            <i className="fas fa-edit"></i>
                                                        </Button>
                                                        <Button
                                                            variant="light"
                                                            size="sm"
                                                            className="btn-icon text-danger"
                                                            onClick={() => handleDeleteGvhdClick(row)}
                                                            title="Xóa"
                                                        >
                                                            <i className="fas fa-trash"></i>
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {gvhdList.length > 0 && gvhdPagination.totalPages > 1 && (
                            <div className="mt-3">
                                <Pagination
                                    currentPage={gvhdPagination.page}
                                    totalPages={gvhdPagination.totalPages}
                                    onPageChange={(page) => setGvhdPagination(prev => ({ ...prev, page }))}
                                    maxVisiblePages={5}
                                    showFirstLast={true}
                                />
                            </div>
                        )}
                    </>
                )}
            </div>
        </Container>
    );

    return (
        <div className="container-fluid session-main-container admin-dashboard-container">
            <style>{dropdownStyles}</style>

            {/* Header Section - style riêng MR */}
            <div className="mr-page-header">
                <div className="mr-header-content">
                    <div className="mr-header-title">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                            <h1 className="mr-header-h1">Nhập hồ sơ bệnh án sinh viên</h1>
                            <Badge bg="primary" className="fs-6">
                                {activeTab === 'benh-an' ? `${pagination.totalItems} bản ghi` : `${gvhdPagination.total} GVHD`}
                            </Badge>
                        </div>
                        <p className="mr-header-subtitle">
                            {activeTab === 'benh-an' ? 'Nhập hồ sơ bệnh án sinh viên' : 'Danh sách Giảng viên hướng dẫn'}
                        </p>
                    </div>
                    <div className="mr-header-actions">
                        <Button
                            variant="outline-light"
                            className="create-session-btn me-2"
                            onClick={openHospitalModal}
                        >
                            <i className="fas fa-hospital"></i>
                            Bệnh viện
                        </Button>
                        {activeTab === 'benh-an' && (
                            <Button
                                variant="outline-light"
                                className="create-session-btn"
                                onClick={() => setShowImportModal(true)}
                            >
                                <i className="fas fa-file-import"></i>
                                Nhập từ Excel
                            </Button>
                        )}
                        {activeTab === 'gvhd' && (
                            <>
                                <Button
                                    variant="outline-light"
                                    className="create-session-btn me-2"
                                    onClick={openAddGvhd}
                                >
                                    <i className="fas fa-plus"></i>
                                    Thêm GVHD
                                </Button>
                                <Button
                                    variant="outline-light"
                                    className="create-session-btn"
                                    onClick={() => setShowGvhdImportModal(true)}
                                >
                                    <i className="fas fa-file-import"></i>
                                    Nhập từ Excel
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {error && <Alert variant="danger" className="mx-3 mt-3">{error}</Alert>}
            {importSuccess && <Alert variant="success" className="mx-3 mt-3">{importSuccess}</Alert>}

            {/* Tab Navigation - style riêng MR trong dashboard.css */}
            <div className="mr-tab-navigation">
                <Tabs
                    activeKey={activeTab}
                    onSelect={handleTabChange}
                    className="mr-custom-tabs"
                >
                    <Tab
                        eventKey="benh-an"
                        title={
                            <span className="mr-tab-title">
                                <i className="fas fa-folder-open"></i>
                                Bệnh án sinh viên
                            </span>
                        }
                    >
                        {renderBenhAnTab()}
                    </Tab>
                    <Tab
                        eventKey="gvhd"
                        title={
                            <span className="mr-tab-title">
                                <i className="fas fa-user-tie"></i>
                                Danh sách GVHD
                            </span>
                        }
                    >
                        {renderGvhdTab()}
                    </Tab>
                </Tabs>
            </div>

            {/* Import Excel Modal */}
            <Modal show={showImportModal} onHide={() => {
                setShowImportModal(false);
                setImportFile(null);
                setImportErrors([]);
                setImportSuccess('');
                setImportDetails(null);
                setImportProgress(0);
                setImportTotal(0);
            }} size="xl" className="mr-detail-modal">
                <Modal.Header closeButton className="mr-detail-header">
                    <Modal.Title className="mr-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-file-import"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Nhập dữ liệu từ file Excel</h4>
                            <p className="mb-0 student-subtitle">Import dữ liệu hồ sơ bệnh án hàng loạt</p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="mr-detail-body">
                    <div className="mr-detail-container">
                        {importErrors.length > 0 && (
                            <Alert variant="danger" className="mb-4">
                                <div className="d-flex align-items-center mb-2">
                                    <i className="fas fa-exclamation-triangle me-2"></i>
                                    <strong>Lỗi nhập dữ liệu</strong>
                                </div>
                                <ul className="mb-0">
                                    {importErrors.map((error, index) => (
                                        <li key={index}>{error}</li>
                                    ))}
                                </ul>
                            </Alert>
                        )}

                        {importSuccess && (
                            <Alert variant="success" className="mb-4">
                                <div className="d-flex align-items-center">
                                    <i className="fas fa-check-circle me-2"></i>
                                    {importSuccess}
                                </div>
                            </Alert>
                        )}

                        {/* Hiển thị thông tin chi tiết */}
                        {importDetails && !importLoading && (
                            <>
                                {/* Thông tin tổng quan */}
                                <div className="mr-session-card mb-4">
                                    <div className="mr-card-header-modern">
                                        <div className="header-icon">
                                            <i className="fas fa-info-circle"></i>
                                        </div>
                                        <h6 className="mb-0">Thông tin chi tiết nhập dữ liệu</h6>
                                    </div>
                                    <div className="mr-card-body-modern">
                                        <Row>
                                            <Col xs={6} md={2}>
                                                <div className="text-center p-3 border rounded">
                                                    <div className="h4 mb-1 text-primary">{importDetails.total}</div>
                                                    <div className="text-muted small">Tổng số bản ghi</div>
                                                </div>
                                            </Col>
                                            <Col xs={6} md={2}>
                                                <div className="text-center p-3 border rounded">
                                                    <div className="h4 mb-1 text-success">{importDetails.success}</div>
                                                    <div className="text-muted small">Thành công</div>
                                                </div>
                                            </Col>
                                            <Col xs={6} md={2}>
                                                <div className="text-center p-3 border rounded">
                                                    <div className="h4 mb-1 text-warning">{importDetails.updated}</div>
                                                    <div className="text-muted small">Đã cập nhật</div>
                                                </div>
                                            </Col>
                                            <Col xs={6} md={2}>
                                                <div className="text-center p-3 border rounded">
                                                    <div className="h4 mb-1 text-info">{importDetails.skipped ?? 0}</div>
                                                    <div className="text-muted small">Đã bỏ qua</div>
                                                </div>
                                            </Col>
                                            <Col xs={6} md={2}>
                                                <div className="text-center p-3 border rounded">
                                                    <div className="h4 mb-1 text-secondary">{importDetails.duplicateInFile ?? 0}</div>
                                                    <div className="text-muted small">Trùng trong file</div>
                                                </div>
                                            </Col>
                                        </Row>
                                    </div>
                                </div>

                                {/* Cảnh báo GVHD chưa có bệnh viện */}
                                {importDetails.gvhdWithoutBenhVien && importDetails.gvhdWithoutBenhVien.length > 0 && (
                                    <div className="mr-session-card mb-4 border-warning">
                                        <div className="mr-card-header-modern bg-warning bg-opacity-10">
                                            <div className="header-icon text-warning">
                                                <i className="fas fa-exclamation-triangle"></i>
                                            </div>
                                            <h6 className="mb-0 text-warning">GVHD chưa có bệnh viện</h6>
                                        </div>
                                        <div className="mr-card-body-modern">
                                            <p className="text-muted small mb-3">
                                                Các GVHD dưới đây xuất hiện trong file nhưng chưa có trong Danh sách GVHD hoặc chưa có bệnh viện. Bạn có thể thêm vào Danh sách GVHD để lần sau bệnh viện sẽ được điền tự động.
                                            </p>
                                            <div className="table-responsive">
                                                <table className="table table-sm table-bordered">
                                                    <thead className="table-light">
                                                        <tr>
                                                            <th>Mã GVHD</th>
                                                            <th>Tên GVHD</th>
                                                            <th style={{ width: '100px' }}>Thao tác</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {importDetails.gvhdWithoutBenhVien.map((item, idx) => (
                                                            <tr key={idx}>
                                                                <td>{item.ma_gvhd || '-'}</td>
                                                                <td>{item.ten_gvhd || '-'}</td>
                                                                <td>
                                                                    <Button
                                                                        variant="outline-primary"
                                                                        size="sm"
                                                                        onClick={() => openAddGvhdFromImport(item)}
                                                                        title="Thêm vào Danh sách GVHD"
                                                                    >
                                                                        <i className="fas fa-plus me-1"></i>Thêm
                                                                    </Button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Tick/Nhân tất cả hai mục + Nút thêm bản ghi đã chọn */}
                                {(importDetails.skippedRecords?.length > 0 || importDetails.duplicateInFileRecords?.length > 0) && (
                                    <div className="mr-session-card mb-3">
                                        <div className="mr-card-body-modern d-flex flex-wrap align-items-center gap-3">
                                            <span className="text-muted small">Chọn thêm vào database:</span>
                                            <Button
                                                variant="outline-success"
                                                size="sm"
                                                onClick={() => {
                                                    setSkippedSelections(Array(importDetails.skippedRecords?.length || 0).fill(true));
                                                    setDuplicateSelections(Array(importDetails.duplicateInFileRecords?.length || 0).fill(true));
                                                }}
                                                title="Tick tất cả"
                                            >
                                                <i className="fas fa-check me-1"></i> Tick tất cả
                                            </Button>
                                            <Button
                                                variant="outline-danger"
                                                size="sm"
                                                onClick={() => {
                                                    setSkippedSelections(Array(importDetails.skippedRecords?.length || 0).fill(false));
                                                    setDuplicateSelections(Array(importDetails.duplicateInFileRecords?.length || 0).fill(false));
                                                }}
                                                title="Nhân tất cả"
                                            >
                                                <i className="fas fa-times me-1"></i> Nhân tất cả
                                            </Button>
                                            <span className="text-muted small ms-2">
                                                (Đã chọn: {(skippedSelections.filter(Boolean).length + duplicateSelections.filter(Boolean).length)})
                                            </span>
                                            <Button
                                                variant="primary"
                                                size="sm"
                                                disabled={importSkippedLoading || (skippedSelections.filter(Boolean).length + duplicateSelections.filter(Boolean).length) === 0}
                                                onClick={handleImportSkippedSelected}
                                            >
                                                {importSkippedLoading ? <Spinner animation="border" size="sm" className="me-1" /> : <i className="fas fa-database me-1"></i>}
                                                Thêm các bản ghi đã chọn vào database
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* Danh sách bản ghi trùng trong file — đủ cột + tick/nhân */}
                                {importDetails.duplicateInFileRecords && importDetails.duplicateInFileRecords.length > 0 && (
                                    <div className="mr-session-card mb-4">
                                        <div className="mr-card-header-modern d-flex justify-content-between align-items-center flex-wrap gap-2">
                                            <div className="d-flex align-items-center gap-2">
                                                <div className="header-icon">
                                                    <i className="fas fa-copy text-secondary"></i>
                                                </div>
                                                <h6 className="mb-0">Trùng trong file ({importDetails.duplicateInFileRecords.length})</h6>
                                                <Button variant="outline-success" size="sm" onClick={() => setDuplicateSelections(Array(importDetails.duplicateInFileRecords.length).fill(true))} title="Tick tất cả mục này"><i className="fas fa-check"></i></Button>
                                                <Button variant="outline-danger" size="sm" onClick={() => setDuplicateSelections(Array(importDetails.duplicateInFileRecords.length).fill(false))} title="Nhân tất cả mục này"><i className="fas fa-times"></i></Button>
                                            </div>
                                        </div>
                                        <div className="mr-card-body-modern">
                                            <p className="text-muted small mb-2">✓ = thêm vào DB, ✗ = không thêm. Chọn bản ghi muốn thêm rồi bấm &quot;Thêm các bản ghi đã chọn vào database&quot;.</p>
                                            <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                                <table className="table table-sm table-hover">
                                                    <thead className="table-light sticky-top">
                                                        <tr>
                                                            <th style={{ width: '70px' }}>Thêm?</th>
                                                            <th>Dòng</th>
                                                            {RECORD_FIELDS.map(f => <th key={f.key}>{f.label}</th>)}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {importDetails.duplicateInFileRecords.map((record, index) => (
                                                            <tr key={index}>
                                                                <td>
                                                                    <Button variant={duplicateSelections[index] ? 'success' : 'outline-secondary'} size="sm" className="me-1" onClick={() => setDuplicateSelections(prev => { const n = [...prev]; n[index] = true; return n; })} title="Tick — thêm vào DB"><i className="fas fa-check"></i></Button>
                                                                    <Button variant={!duplicateSelections[index] ? 'danger' : 'outline-secondary'} size="sm" onClick={() => setDuplicateSelections(prev => { const n = [...prev]; n[index] = false; return n; })} title="Nhân — không thêm"><i className="fas fa-times"></i></Button>
                                                                </td>
                                                                <td>{record.row}</td>
                                                                {RECORD_FIELDS.map(f => <td key={f.key} className="small">{(record[f.key] ?? '-') === '' ? '-' : String(record[f.key])}</td>)}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Danh sách bản ghi đã bỏ qua — đủ cột + tick/nhân */}
                                {importDetails.skippedRecords && importDetails.skippedRecords.length > 0 && (
                                    <div className="mr-session-card mb-4">
                                        <div className="mr-card-header-modern d-flex justify-content-between align-items-center flex-wrap gap-2">
                                            <div className="d-flex align-items-center gap-2">
                                                <div className="header-icon">
                                                    <i className="fas fa-ban text-warning"></i>
                                                </div>
                                                <h6 className="mb-0">Bản ghi đã bỏ qua ({importDetails.skippedRecords.length})</h6>
                                                <Button variant="outline-success" size="sm" onClick={() => setSkippedSelections(Array(importDetails.skippedRecords.length).fill(true))} title="Tick tất cả mục này"><i className="fas fa-check"></i></Button>
                                                <Button variant="outline-danger" size="sm" onClick={() => setSkippedSelections(Array(importDetails.skippedRecords.length).fill(false))} title="Nhân tất cả mục này"><i className="fas fa-times"></i></Button>
                                            </div>
                                        </div>
                                        <div className="mr-card-body-modern">
                                            <p className="text-muted small mb-2">✓ = thêm vào DB, ✗ = không thêm.</p>
                                            <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                                <table className="table table-sm table-hover">
                                                    <thead className="table-light sticky-top">
                                                        <tr>
                                                            <th style={{ width: '70px' }}>Thêm?</th>
                                                            <th>Dòng</th>
                                                            {RECORD_FIELDS.map(f => <th key={f.key}>{f.label}</th>)}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {importDetails.skippedRecords.map((record, index) => (
                                                            <tr key={index}>
                                                                <td>
                                                                    <Button variant={skippedSelections[index] ? 'success' : 'outline-secondary'} size="sm" className="me-1" onClick={() => setSkippedSelections(prev => { const n = [...prev]; n[index] = true; return n; })} title="Tick — thêm vào DB"><i className="fas fa-check"></i></Button>
                                                                    <Button variant={!skippedSelections[index] ? 'danger' : 'outline-secondary'} size="sm" onClick={() => setSkippedSelections(prev => { const n = [...prev]; n[index] = false; return n; })} title="Nhân — không thêm"><i className="fas fa-times"></i></Button>
                                                                </td>
                                                                <td>{record.row}</td>
                                                                {RECORD_FIELDS.map(f => <td key={f.key} className="small">{(record[f.key] ?? '-') === '' ? '-' : String(record[f.key])}</td>)}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Danh sách bản ghi đã cập nhật */}
                                {importDetails.updatedRecords && importDetails.updatedRecords.length > 0 && (
                                    <div className="mr-session-card mb-4">
                                        <div className="mr-card-header-modern">
                                            <div className="header-icon">
                                                <i className="fas fa-edit text-warning"></i>
                                            </div>
                                            <h6 className="mb-0">Bản ghi đã cập nhật ({importDetails.updatedRecords.length})</h6>
                                        </div>
                                        <div className="mr-card-body-modern">
                                            <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                                <table className="table table-sm table-hover">
                                                    <thead className="table-light sticky-top">
                                                        <tr>
                                                            <th>Dòng</th>
                                                            <th>Mã SV</th>
                                                            <th>Tên SV</th>
                                                            <th>Trạng thái cũ</th>
                                                            <th>Trạng thái mới</th>
                                                            <th>Các thay đổi</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {importDetails.updatedRecords.map((record, index) => (
                                                            <tr key={index}>
                                                                <td>{record.row}</td>
                                                                <td>{record.ma_sv || '-'}</td>
                                                                <td>{record.ten_day_du || '-'}</td>
                                                                <td><Badge bg="secondary">{record.trang_thai_cu || '-'}</Badge></td>
                                                                <td><Badge bg="success">{record.trang_thai_moi || '-'}</Badge></td>
                                                                <td>
                                                                    {record.changes && record.changes.length > 0 ? (
                                                                        <div className="small">
                                                                            {record.changes.map((change, idx) => (
                                                                                <div key={idx} className="mb-1">
                                                                                    <strong>{change.field}:</strong> 
                                                                                    <span className="text-danger ms-1">{change.old}</span>
                                                                                    <span className="mx-1">→</span>
                                                                                    <span className="text-success">{change.new}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-muted">Không có thay đổi</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {importLoading && importTotal > 0 && (
                            <div className="mr-session-card mb-4">
                                <div className="mr-card-header-modern">
                                    <div className="header-icon">
                                        <i className="fas fa-spinner fa-spin"></i>
                                    </div>
                                    <h6 className="mb-0">Tiến trình nhập dữ liệu</h6>
                                </div>
                                <div className="mr-card-body-modern">
                                    <div className="d-flex justify-content-between mb-3">
                                        <span className="info-label">
                                            <i className="fas fa-file-medical me-2"></i>
                                            Đang xử lý
                                        </span>
                                        <span className="info-value">
                                            {importProgress} / {importTotal} bản ghi ({Math.round((importProgress / importTotal) * 100)}%)
                                        </span>
                                    </div>
                                    <ProgressBar
                                        animated
                                        now={Math.round((importProgress / importTotal) * 100)}
                                        label={`${Math.round((importProgress / importTotal) * 100)}%`}
                                        className="progress-modern"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="mr-session-card">
                            <div className="mr-card-header-modern">
                                <div className="header-icon">
                                    <i className="fas fa-file-excel"></i>
                                </div>
                                <h6 className="mb-0">Chọn file Excel</h6>
                            </div>
                            <div className="mr-card-body-modern">
                                <Form>
                                    <Form.Group className="mb-3">
                                        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                                            <Form.Label className="info-label mb-0">
                                                <i className="fas fa-upload me-2"></i>
                                                File Excel
                                            </Form.Label>
                                            <Button variant="outline-primary" size="sm" onClick={downloadHsbaSampleExcel}>
                                                <i className="fas fa-download me-1"></i>Tải file mẫu
                                            </Button>
                                        </div>
                                        <Form.Control
                                            type="file"
                                            accept=".xlsx, .xls"
                                            onChange={handleFileChange}
                                            className="form-control-modern"
                                        />
                                        <Form.Text className="text-muted mt-2">
                                            <i className="fas fa-info-circle me-1"></i>
                                            File Excel phải có các cột: A (Trạng thái), B (Mã GVHD), C (Tên GVHD), F (Mã SV), G (Tên SV), H (Khoa), I (Năm học), J (Mã MH), K (Tên MH), M (Tên BN), N (Ngày BD), O (Ngày nộp), P (Loại HSBA), R (Tên lớp), U (Điểm thi miệng), V (Điểm quá trình), W (Điểm khám bệnh)
                                        </Form.Text>
                                    </Form.Group>

                                    <div className="d-flex justify-content-end gap-2">
                                        <Button
                                            variant="outline-secondary"
                                            onClick={() => {
                                                setShowImportModal(false);
                                                setImportFile(null);
                                                setImportErrors([]);
                                                setImportSuccess('');
                                                setImportDetails(null);
                                                setImportProgress(0);
                                                setImportTotal(0);
                                            }}
                                            className="btn-cancel"
                                        >
                                            <i className="fas fa-times me-2"></i>
                                            {importDetails ? 'Đóng' : 'Hủy'}
                                        </Button>
                                        <Button
                                            variant="primary"
                                            onClick={() => {
                                                setShowImportModeModal(true);
                                            }}
                                            disabled={importLoading || !importFile}
                                            className="btn-edit"
                                        >
                                            {importLoading ? (
                                                <>
                                                    <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                                                    Đang xử lý...
                                                </>
                                            ) : (
                                                <>
                                                    <i className="fas fa-upload me-2"></i>
                                                    Nhập dữ liệu
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </Form>
                            </div>
                        </div>
                    </div>
                </Modal.Body>
            </Modal>

            {/* Modal chọn phương thức nhập */}
            <Modal show={showImportModeModal} onHide={() => setShowImportModeModal(false)} size="xl" className="mr-detail-modal">
                <Modal.Header closeButton className="mr-detail-header">
                    <Modal.Title className="mr-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-list-alt"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Chọn phương thức nhập</h4>
                            <p className="mb-0 student-subtitle">Chọn cách xử lý dữ liệu từ file Excel</p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="mr-detail-body">
                    <div className="mr-detail-container">
                        <div className="mr-session-card mb-4">
                            <div className="mr-card-header-modern">
                                <div className="header-icon">
                                    <i className="fas fa-cogs"></i>
                                </div>
                                <h6 className="mb-0">Phương thức nhập dữ liệu</h6>
                            </div>
                            <div className="mr-card-body-modern">
                                <p className="text-muted small mb-4">Chọn một trong hai cách sau để xử lý file Excel đã chọn:</p>
                                <Row>
                                    <Col md={6} className="mb-3 mb-md-0">
                                        <div
                                            className="p-4 border rounded h-100"
                                            style={{ cursor: 'pointer', borderWidth: '2px', borderColor: 'var(--bs-primary)' }}
                                            onClick={() => {
                                                setShowImportModeModal(false);
                                                handleImportExcel(false);
                                            }}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setShowImportModeModal(false); handleImportExcel(false); } }}
                                        >
                                            <div className="d-flex align-items-start mb-2">
                                                <div className="rounded-circle bg-primary bg-opacity-10 p-2 me-3">
                                                    <i className="fas fa-plus-circle text-primary"></i>
                                                </div>
                                                <div>
                                                    <h6 className="mb-1">Nhập bình thường</h6>
                                                    <p className="small text-muted mb-0">Thêm mới và cập nhật theo file. Giữ dữ liệu cũ, bỏ qua hoặc cập nhật theo quy tắc trùng.</p>
                                                </div>
                                            </div>
                                            <div className="text-end">
                                                <Button variant="primary" size="sm">Chọn</Button>
                                            </div>
                                        </div>
                                    </Col>
                                    <Col md={6}>
                                        <div
                                            className="p-4 border rounded h-100"
                                            style={{ cursor: 'pointer', borderWidth: '2px', borderColor: 'var(--bs-warning)' }}
                                            onClick={() => {
                                                setShowImportModeModal(false);
                                                setShowReplaceConfirmModal(true);
                                            }}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setShowImportModeModal(false); setShowReplaceConfirmModal(true); } }}
                                        >
                                            <div className="d-flex align-items-start mb-2">
                                                <div className="rounded-circle bg-warning bg-opacity-10 p-2 me-3">
                                                    <i className="fas fa-sync-alt text-warning"></i>
                                                </div>
                                                <div>
                                                    <h6 className="mb-1">Thay thế toàn bộ</h6>
                                                    <p className="small text-muted mb-0">Xóa hết dữ liệu cũ trong hệ thống, sau đó nhập toàn bộ từ file (không bỏ qua, không cập nhật).</p>
                                                </div>
                                            </div>
                                            <div className="text-end">
                                                <Button variant="warning" size="sm">Chọn</Button>
                                            </div>
                                        </div>
                                    </Col>
                                </Row>
                            </div>
                        </div>
                        <div className="d-flex justify-content-end">
                            <Button variant="outline-secondary" onClick={() => setShowImportModeModal(false)} className="btn-cancel">
                                <i className="fas fa-times me-2"></i>Hủy
                            </Button>
                        </div>
                    </div>
                </Modal.Body>
            </Modal>

            {/* Modal xác nhận thay thế toàn bộ */}
            <Modal show={showReplaceConfirmModal} onHide={() => setShowReplaceConfirmModal(false)} size="lg" className="mr-detail-modal">
                <Modal.Header closeButton className="mr-detail-header">
                    <Modal.Title className="mr-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-exclamation-triangle text-warning"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Xác nhận thay thế toàn bộ</h4>
                            <p className="mb-0 student-subtitle">Hành động này sẽ xóa toàn bộ dữ liệu cũ</p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="mr-detail-body">
                    <div className="mr-detail-container">
                        <div className="mr-session-card mb-4">
                            <div className="mr-card-header-modern">
                                <div className="header-icon">
                                    <i className="fas fa-info-circle text-warning"></i>
                                </div>
                                <h6 className="mb-0">Cảnh báo</h6>
                            </div>
                            <div className="mr-card-body-modern">
                                <p className="mb-2">
                                    Khi nhập dữ liệu mới này sẽ <strong className="text-danger">xóa toàn bộ dữ liệu cũ</strong> trong hệ thống (bảng Bệnh án sinh viên).
                                </p>
                                <p className="mb-0 text-muted small">
                                    Toàn bộ bản ghi trong file Excel sẽ được thêm mới, không bỏ qua hoặc cập nhật bản ghi nào.
                                </p>
                                <p className="mb-0 mt-3 fw-medium">Bạn có chắc chắn muốn tiếp tục?</p>
                            </div>
                        </div>
                        <div className="d-flex justify-content-end gap-2">
                            <Button variant="outline-secondary" onClick={() => setShowReplaceConfirmModal(false)} className="btn-cancel">
                                <i className="fas fa-times me-2"></i>Hủy
                            </Button>
                            <Button
                                variant="primary"
                                onClick={() => {
                                    setShowReplaceConfirmModal(false);
                                    handleImportExcel(true);
                                }}
                                className="btn-edit"
                            >
                                <i className="fas fa-check me-2"></i>Đồng ý
                            </Button>
                        </div>
                    </div>
                </Modal.Body>
            </Modal>

            {/* GVHD Import Excel Modal */}
            <Modal show={showGvhdImportModal} onHide={() => {
                setShowGvhdImportModal(false);
                setImportGvhdFile(null);
                setImportGvhdErrors([]);
                setImportGvhdSuccess('');
            }} size="xl" className="mr-detail-modal">
                <Modal.Header closeButton className="mr-detail-header">
                    <Modal.Title className="mr-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-file-import"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Nhập danh sách GVHD từ Excel</h4>
                            <p className="mb-0 student-subtitle">Import danh sách Giảng viên hướng dẫn hàng loạt</p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="mr-detail-body">
                    <div className="mr-detail-container">
                        {importGvhdErrors.length > 0 && (
                            <Alert variant="danger" className="mb-4">
                                <div className="d-flex align-items-center mb-2">
                                    <i className="fas fa-exclamation-triangle me-2"></i>
                                    <strong>Lỗi nhập dữ liệu</strong>
                                </div>
                                <ul className="mb-0">
                                    {importGvhdErrors.map((err, i) => <li key={i}>{err}</li>)}
                                </ul>
                            </Alert>
                        )}
                        {importGvhdSuccess && (
                            <Alert variant="success" className="mb-4">
                                <div className="d-flex align-items-center">
                                    <i className="fas fa-check-circle me-2"></i>
                                    {importGvhdSuccess}
                                </div>
                            </Alert>
                        )}
                        <div className="mr-session-card mb-4">
                            <div className="mr-card-header-modern">
                                <div className="header-icon">
                                    <i className="fas fa-file-excel"></i>
                                </div>
                                <h6 className="mb-0">Chọn file Excel</h6>
                            </div>
                            <div className="mr-card-body-modern">
                                <Form.Group className="mb-4">
                                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                                        <Form.Label className="info-label mb-0">
                                            <i className="fas fa-upload me-2"></i>
                                            File Excel
                                        </Form.Label>
                                        <Button variant="outline-primary" size="sm" onClick={downloadGvhdSampleExcel}>
                                            <i className="fas fa-download me-1"></i>Tải file mẫu
                                        </Button>
                                    </div>
                                    <Form.Control
                                        type="file"
                                        accept=".xlsx,.xls"
                                        onChange={handleGvhdFileChange}
                                        className="form-control-modern"
                                    />
                                    <Form.Text className="text-muted mt-2 d-block">
                                        <i className="fas fa-info-circle me-1"></i>
                                        Cột: A=STT (bỏ qua), B=Mã GV, C=Họ và tên, D=Ngày sinh, E=SĐT, F=Email, G=Học hàm/học vị, H=Chuyên ngành/Khoa, I=Bệnh viện, J=Chứng chỉ NVSP, K=Chứng chỉ hành nghề, L=Chứng chỉ Ngoại ngữ, M=Ghi chú, N=Lớp
                                    </Form.Text>
                                </Form.Group>
                                <div className="d-flex justify-content-end gap-2">
                                    <Button
                                        variant="outline-secondary"
                                        onClick={() => {
                                            setShowGvhdImportModal(false);
                                            setImportGvhdFile(null);
                                            setImportGvhdErrors([]);
                                            setImportGvhdSuccess('');
                                        }}
                                        className="btn-cancel"
                                    >
                                        <i className="fas fa-times me-2"></i>Đóng
                                    </Button>
                                    <Button
                                        variant="primary"
                                        onClick={() => setShowGvhdImportModeModal(true)}
                                        disabled={importGvhdLoading || !importGvhdFile}
                                        className="btn-edit"
                                    >
                                        {importGvhdLoading ? (
                                            <>
                                                <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                                                Đang xử lý...
                                            </>
                                        ) : (
                                            <>
                                                <i className="fas fa-upload me-2"></i>Nhập dữ liệu
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </Modal.Body>
            </Modal>

            {/* Modal chọn phương thức nhập GVHD */}
            <Modal show={showGvhdImportModeModal} onHide={() => setShowGvhdImportModeModal(false)} size="xl" className="mr-detail-modal">
                <Modal.Header closeButton className="mr-detail-header">
                    <Modal.Title className="mr-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-list-alt"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Chọn phương thức nhập</h4>
                            <p className="mb-0 student-subtitle">Chọn cách xử lý danh sách GVHD từ file Excel</p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="mr-detail-body">
                    <div className="mr-detail-container">
                        <div className="mr-session-card mb-4">
                            <div className="mr-card-header-modern">
                                <div className="header-icon">
                                    <i className="fas fa-cogs"></i>
                                </div>
                                <h6 className="mb-0">Phương thức nhập danh sách GVHD</h6>
                            </div>
                            <div className="mr-card-body-modern">
                                <p className="text-muted small mb-4">Chọn một trong hai cách sau để xử lý file Excel đã chọn:</p>
                                <Row>
                                    <Col md={6} className="mb-3 mb-md-0">
                                        <div
                                            className="p-4 border rounded h-100"
                                            style={{ cursor: 'pointer', borderWidth: '2px', borderColor: 'var(--bs-primary)' }}
                                            onClick={() => {
                                                setShowGvhdImportModeModal(false);
                                                handleGvhdImportExcel(false);
                                            }}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setShowGvhdImportModeModal(false); handleGvhdImportExcel(false); } }}
                                        >
                                            <div className="d-flex align-items-start mb-2">
                                                <div className="rounded-circle bg-primary bg-opacity-10 p-2 me-3">
                                                    <i className="fas fa-plus-circle text-primary"></i>
                                                </div>
                                                <div>
                                                    <h6 className="mb-1">Nhập bình thường</h6>
                                                    <p className="small text-muted mb-0">Thêm mới theo file. Giữ nguyên dữ liệu GVHD hiện có, thêm các bản ghi từ file.</p>
                                                </div>
                                            </div>
                                            <div className="text-end">
                                                <Button variant="primary" size="sm">Chọn</Button>
                                            </div>
                                        </div>
                                    </Col>
                                    <Col md={6}>
                                        <div
                                            className="p-4 border rounded h-100"
                                            style={{ cursor: 'pointer', borderWidth: '2px', borderColor: 'var(--bs-warning)' }}
                                            onClick={() => {
                                                setShowGvhdImportModeModal(false);
                                                setShowGvhdReplaceConfirmModal(true);
                                            }}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setShowGvhdImportModeModal(false); setShowGvhdReplaceConfirmModal(true); } }}
                                        >
                                            <div className="d-flex align-items-start mb-2">
                                                <div className="rounded-circle bg-warning bg-opacity-10 p-2 me-3">
                                                    <i className="fas fa-sync-alt text-warning"></i>
                                                </div>
                                                <div>
                                                    <h6 className="mb-1">Thay thế toàn bộ</h6>
                                                    <p className="small text-muted mb-0">Xóa hết danh sách GVHD cũ trong hệ thống, sau đó nhập toàn bộ từ file.</p>
                                                </div>
                                            </div>
                                            <div className="text-end">
                                                <Button variant="warning" size="sm">Chọn</Button>
                                            </div>
                                        </div>
                                    </Col>
                                </Row>
                            </div>
                        </div>
                        <div className="d-flex justify-content-end">
                            <Button variant="outline-secondary" onClick={() => setShowGvhdImportModeModal(false)} className="btn-cancel">
                                <i className="fas fa-times me-2"></i>Hủy
                            </Button>
                        </div>
                    </div>
                </Modal.Body>
            </Modal>

            {/* Modal xác nhận thay thế toàn bộ GVHD */}
            <Modal show={showGvhdReplaceConfirmModal} onHide={() => setShowGvhdReplaceConfirmModal(false)} size="lg" className="mr-detail-modal">
                <Modal.Header closeButton className="mr-detail-header">
                    <Modal.Title className="mr-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-exclamation-triangle text-warning"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Xác nhận thay thế toàn bộ</h4>
                            <p className="mb-0 student-subtitle">Hành động này sẽ xóa toàn bộ danh sách GVHD</p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="mr-detail-body">
                    <div className="mr-detail-container">
                        <div className="mr-session-card mb-4">
                            <div className="mr-card-header-modern">
                                <div className="header-icon">
                                    <i className="fas fa-info-circle text-warning"></i>
                                </div>
                                <h6 className="mb-0">Cảnh báo</h6>
                            </div>
                            <div className="mr-card-body-modern">
                                <p className="mb-2">
                                    Khi nhập dữ liệu mới này sẽ <strong className="text-danger">xóa toàn bộ danh sách GVHD</strong> trong hệ thống.
                                </p>
                                <p className="mb-0 text-muted small">
                                    Toàn bộ bản ghi trong file Excel sẽ được thêm mới.
                                </p>
                                <p className="mb-0 mt-3 fw-medium">Bạn có chắc chắn muốn tiếp tục?</p>
                            </div>
                        </div>
                        <div className="d-flex justify-content-end gap-2">
                            <Button variant="outline-secondary" onClick={() => setShowGvhdReplaceConfirmModal(false)} className="btn-cancel">
                                <i className="fas fa-times me-2"></i>Hủy
                            </Button>
                            <Button
                                variant="warning"
                                onClick={() => {
                                    setShowGvhdReplaceConfirmModal(false);
                                    handleGvhdImportExcel(true);
                                }}
                                className="btn-edit"
                            >
                                <i className="fas fa-check me-2"></i>Đồng ý
                            </Button>
                        </div>
                    </div>
                </Modal.Body>
            </Modal>

            {/* Modal Thêm/Chỉnh sửa GVHD */}
            <Modal show={showGvhdFormModal} onHide={() => setShowGvhdFormModal(false)} size="lg" className="mr-detail-modal">
                <Modal.Header closeButton className="mr-detail-header">
                    <Modal.Title className="mr-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-user-tie"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">{gvhdEditingId ? 'Chỉnh sửa GVHD' : 'Thêm GVHD'}</h4>
                            <p className="mb-0 student-subtitle">{gvhdEditingId ? 'Cập nhật thông tin giảng viên hướng dẫn' : 'Thêm mới giảng viên hướng dẫn'}</p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="mr-detail-body">
                    <div className="mr-detail-container">
                        <Row>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Mã GV</Form.Label>
                                    <Form.Control value={gvhdFormData.ma_gv || ''} onChange={(e) => setGvhdFormData({ ...gvhdFormData, ma_gv: e.target.value })} className="form-control-modern" />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Họ và tên</Form.Label>
                                    <Form.Control value={gvhdFormData.ho_ten || ''} onChange={(e) => setGvhdFormData({ ...gvhdFormData, ho_ten: e.target.value })} className="form-control-modern" />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Ngày sinh</Form.Label>
                                    <Form.Control type="date" value={gvhdFormData.ngay_sinh || ''} onChange={(e) => setGvhdFormData({ ...gvhdFormData, ngay_sinh: e.target.value })} className="form-control-modern" />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>SĐT</Form.Label>
                                    <Form.Control value={gvhdFormData.sdt || ''} onChange={(e) => setGvhdFormData({ ...gvhdFormData, sdt: e.target.value })} className="form-control-modern" />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Email</Form.Label>
                                    <Form.Control type="email" value={gvhdFormData.email || ''} onChange={(e) => setGvhdFormData({ ...gvhdFormData, email: e.target.value })} className="form-control-modern" />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Học hàm/học vị</Form.Label>
                                    <Form.Control value={gvhdFormData.hoc_ham_hoc_vi || ''} onChange={(e) => setGvhdFormData({ ...gvhdFormData, hoc_ham_hoc_vi: e.target.value })} className="form-control-modern" />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Chuyên ngành/Khoa</Form.Label>
                                    <Form.Control value={gvhdFormData.chuyen_nganh_khoa || ''} onChange={(e) => setGvhdFormData({ ...gvhdFormData, chuyen_nganh_khoa: e.target.value })} className="form-control-modern" />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Bệnh viện</Form.Label>
                                    <Form.Select
                                        value={gvhdFormData.benh_vien ?? ''}
                                        onChange={(e) => setGvhdFormData({ ...gvhdFormData, benh_vien: e.target.value || '' })}
                                        className="form-control-modern"
                                    >
                                        <option value="">-- Chọn bệnh viện --</option>
                                        {hospitals.map((h) => (
                                            <option key={h.id} value={String(h.id)}>{h.ten_benh_vien}</option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Chứng chỉ NVSP</Form.Label>
                                    <Form.Control value={gvhdFormData.chung_chi_nghiep_vu_su_pham || ''} onChange={(e) => setGvhdFormData({ ...gvhdFormData, chung_chi_nghiep_vu_su_pham: e.target.value })} className="form-control-modern" />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Chứng chỉ hành nghề</Form.Label>
                                    <Form.Control value={gvhdFormData.chung_chi_hanh_nghe || ''} onChange={(e) => setGvhdFormData({ ...gvhdFormData, chung_chi_hanh_nghe: e.target.value })} className="form-control-modern" />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Chứng chỉ Ngoại ngữ</Form.Label>
                                    <Form.Control value={gvhdFormData.chung_chi_ngoai_ngu || ''} onChange={(e) => setGvhdFormData({ ...gvhdFormData, chung_chi_ngoai_ngu: e.target.value })} className="form-control-modern" />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Lớp</Form.Label>
                                    <Form.Control value={gvhdFormData.lop || ''} onChange={(e) => setGvhdFormData({ ...gvhdFormData, lop: e.target.value })} className="form-control-modern" />
                                </Form.Group>
                            </Col>
                            <Col md={12}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Ghi chú</Form.Label>
                                    <Form.Control as="textarea" rows={2} value={gvhdFormData.ghi_chu || ''} onChange={(e) => setGvhdFormData({ ...gvhdFormData, ghi_chu: e.target.value })} className="form-control-modern" />
                                </Form.Group>
                            </Col>
                        </Row>
                        <div className="d-flex justify-content-end gap-2 mt-3">
                            <Button variant="outline-secondary" onClick={() => setShowGvhdFormModal(false)}>Hủy</Button>
                            <Button variant="primary" onClick={saveGvhdForm} disabled={gvhdFormLoading}>
                                {gvhdFormLoading ? <><Spinner animation="border" size="sm" className="me-2" />Đang lưu...</> : <><i className="fas fa-save me-2"></i>Lưu</>}
                            </Button>
                        </div>
                    </div>
                </Modal.Body>
            </Modal>

            {/* Modal xác nhận xóa GVHD */}
            <Modal show={showGvhdDeleteModal} onHide={() => { setShowGvhdDeleteModal(false); setGvhdToDelete(null); }} size="sm" className="mr-detail-modal">
                <Modal.Header closeButton className="mr-detail-header">
                    <Modal.Title className="mr-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-trash-alt text-danger"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Xóa GVHD</h4>
                            <p className="mb-0 student-subtitle">Xác nhận xóa giảng viên hướng dẫn</p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {gvhdToDelete && (
                        <p className="mb-0">Bạn có chắc muốn xóa GVHD <strong>{gvhdToDelete.ho_ten || gvhdToDelete.ma_gv || 'này'}</strong>?</p>
                    )}
                    <div className="d-flex justify-content-end gap-2 mt-3">
                        <Button variant="outline-secondary" onClick={() => { setShowGvhdDeleteModal(false); setGvhdToDelete(null); }}>Hủy</Button>
                        <Button variant="danger" onClick={confirmDeleteGvhd}>Xóa</Button>
                    </div>
                </Modal.Body>
            </Modal>

            {/* Modal Danh sách bệnh viện */}
            <Modal show={showHospitalModal} onHide={() => { setShowHospitalModal(false); cancelHospitalForm(); }} size="lg" className="mr-detail-modal">
                <Modal.Header closeButton className="mr-detail-header">
                    <Modal.Title className="mr-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-hospital"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Danh sách bệnh viện</h4>
                            <p className="mb-0 student-subtitle">Quản lý danh mục bệnh viện</p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="mr-detail-body">
                    <div className="mr-detail-container">
                        <div className="mr-session-card">
                            <div className="mr-card-body-modern p-0">
                                <div className="table-responsive">
                                    <Table className="mb-0 mr-session-table" bordered hover>
                                        <thead>
                                            <tr>
                                                <th style={{ width: 70 }} className="text-center">STT</th>
                                                <th>Tên bệnh viện</th>
                                                <th style={{ width: 140 }} className="text-center">Thao tác</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {hospitals.length === 0 ? (
                                                <tr>
                                                    <td colSpan="3" className="text-center py-5 text-muted">
                                                        <i className="fas fa-hospital fa-2x mb-2 opacity-25"></i>
                                                        <p className="mb-0">Chưa có bệnh viện nào. Nhấn &quot;Thêm bệnh viện&quot; ở chân trang để tạo mới.</p>
                                                    </td>
                                                </tr>
                                            ) : (
                                                hospitals.map((row, idx) => (
                                                    <tr key={row.id}>
                                                        <td className="text-center">{idx + 1}</td>
                                                        <td>{row.ten_benh_vien}</td>
                                                        <td className="text-center">
                                                            <div className="d-flex align-items-center justify-content-center gap-1">
                                                                <Button variant="light" size="sm" className="btn-icon text-primary" onClick={() => handleEditHospital(row)} title="Sửa">
                                                                    <i className="fas fa-edit"></i>
                                                                </Button>
                                                                <Button variant="light" size="sm" className="btn-icon text-danger" onClick={() => handleDeleteHospitalClick(row)} title="Xóa">
                                                                    <i className="fas fa-trash"></i>
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </Table>
                                </div>
                            </div>
                        </div>
                    </div>
                </Modal.Body>
                <Modal.Footer className="mr-detail-footer border-top bg-light">
                    <Button variant="primary" onClick={() => { setHospitalEditingId(null); setHospitalFormData({ ten_benh_vien: '' }); setShowHospitalFormModal(true); }} className="btn-edit">
                        <i className="fas fa-plus me-2"></i>Thêm bệnh viện
                    </Button>
                    <Button variant="outline-secondary" onClick={() => { setShowHospitalModal(false); cancelHospitalForm(); }} className="btn-cancel">Đóng</Button>
                </Modal.Footer>
            </Modal>

            {/* Modal nhỏ Thêm/Sửa bệnh viện */}
            <Modal show={showHospitalFormModal} onHide={cancelHospitalForm} size="sm" className="mr-detail-modal" centered>
                <Modal.Header closeButton>
                    <Modal.Title>{hospitalEditingId ? 'Sửa bệnh viện' : 'Thêm bệnh viện'}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form.Group>
                        <Form.Label>Tên bệnh viện</Form.Label>
                        <Form.Control
                            value={hospitalFormData.ten_benh_vien || ''}
                            onChange={(e) => setHospitalFormData({ ten_benh_vien: e.target.value })}
                            placeholder="Nhập tên bệnh viện"
                        />
                    </Form.Group>
                    <div className="d-flex justify-content-end gap-2 mt-3">
                        <Button variant="outline-secondary" onClick={cancelHospitalForm} size="sm">Hủy</Button>
                        <Button variant="primary" onClick={saveHospitalForm} disabled={hospitalFormLoading} size="sm">
                            {hospitalFormLoading ? <><Spinner animation="border" size="sm" className="me-1" />Đang lưu...</> : <><i className="fas fa-save me-1"></i>Lưu</>}
                        </Button>
                    </div>
                </Modal.Body>
            </Modal>

            {/* Modal xác nhận xóa bệnh viện */}
            <Modal show={showHospitalDeleteModal} onHide={() => { setShowHospitalDeleteModal(false); setHospitalToDelete(null); }} size="sm" className="mr-detail-modal" centered>
                <Modal.Header closeButton className="mr-detail-header">
                    <Modal.Title className="mr-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-trash-alt text-danger"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Xóa bệnh viện</h4>
                            <p className="mb-0 student-subtitle">Xác nhận xóa bệnh viện khỏi danh mục</p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="mr-detail-body">
                    {hospitalToDelete && (
                        <>
                            <p className="mb-3">Bạn có chắc muốn xóa bệnh viện <strong className="text-primary">{hospitalToDelete.ten_benh_vien}</strong>?</p>
                            <p className="mb-0 small text-muted">Không thể xóa nếu bệnh viện đang được sử dụng bởi GVHD hoặc hồ sơ bệnh án.</p>
                        </>
                    )}
                    <div className="d-flex justify-content-end gap-2 mt-4">
                        <Button variant="outline-secondary" onClick={() => { setShowHospitalDeleteModal(false); setHospitalToDelete(null); }} className="btn-cancel">
                            <i className="fas fa-times me-2"></i>Hủy
                        </Button>
                        <Button variant="danger" onClick={confirmDeleteHospital}>
                            <i className="fas fa-trash me-2"></i>Xóa
                        </Button>
                    </div>
                </Modal.Body>
            </Modal>

            {/* Edit Modal */}
            <Modal show={showEditModal} onHide={() => setShowEditModal(false)} size="xl" className="mr-detail-modal">
                <Modal.Header closeButton className="mr-detail-header">
                    <Modal.Title className="mr-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-edit"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Chỉnh sửa hồ sơ bệnh án</h4>
                            <p className="mb-0 student-subtitle">Cập nhật thông tin hồ sơ bệnh án</p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="mr-detail-body">
                    <div className="mr-detail-container">
                        <div className="mr-session-card mb-4">
                            <div className="mr-card-header-modern">
                                <div className="header-icon">
                                    <i className="fas fa-info-circle"></i>
                                </div>
                                <h6 className="mb-0">Thông tin cơ bản</h6>
                            </div>
                            <div className="mr-card-body-modern">
                                <Row>
                                    <Col md={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="info-label">
                                                <i className="fas fa-info-circle me-2"></i>
                                                Trạng thái
                                            </Form.Label>
                                            <Form.Select
                                                value={formData.trang_thai_text || ''}
                                                onChange={(e) => setFormData({ ...formData, trang_thai_text: e.target.value })}
                                                className="form-control-modern"
                                            >
                                                <option value="">Chọn trạng thái</option>
                                                <option value="SV đang thực hiện">SV đang thực hiện</option>
                                                <option value="SV đã nộp bài">SV đã nộp bài</option>
                                                <option value="CI đã chấm điểm">CI đã chấm điểm</option>
                                            </Form.Select>
                                        </Form.Group>
                                    </Col>
                                    <Col md={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="info-label">
                                                <i className="fas fa-id-card me-2"></i>
                                                Mã SV
                                            </Form.Label>
                                            <Form.Control
                                                type="text"
                                                value={formData.ma_sv || ''}
                                                onChange={(e) => setFormData({ ...formData, ma_sv: e.target.value })}
                                                className="form-control-modern"
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="info-label">
                                                <i className="fas fa-user me-2"></i>
                                                Tên SV
                                            </Form.Label>
                                            <Form.Control
                                                type="text"
                                                value={formData.ten_day_du || ''}
                                                onChange={(e) => setFormData({ ...formData, ten_day_du: e.target.value })}
                                                className="form-control-modern"
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="info-label">
                                                <i className="fas fa-user-tie me-2"></i>
                                                Mã GVHD
                                            </Form.Label>
                                            <Form.Control
                                                type="text"
                                                value={formData.ma_gvhd || ''}
                                                onChange={(e) => setFormData({ ...formData, ma_gvhd: e.target.value })}
                                                className="form-control-modern"
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="info-label">
                                                <i className="fas fa-chalkboard-teacher me-2"></i>
                                                Tên GVHD
                                            </Form.Label>
                                            <Form.Control
                                                type="text"
                                                value={formData.ten_gvhd || ''}
                                                onChange={(e) => setFormData({ ...formData, ten_gvhd: e.target.value })}
                                                className="form-control-modern"
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="info-label">
                                                <i className="fas fa-hospital me-2"></i>
                                                Bệnh viện
                                            </Form.Label>
                                            <Form.Control
                                                type="text"
                                                value={formData.benh_vien || ''}
                                                onChange={(e) => setFormData({ ...formData, benh_vien: e.target.value })}
                                                placeholder="Từ Danh sách GVHD hoặc nhập tay"
                                                className="form-control-modern"
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="info-label">
                                                <i className="fas fa-university me-2"></i>
                                                Khoa
                                            </Form.Label>
                                            <Form.Control
                                                type="text"
                                                value={formData.ten_ng_chng || ''}
                                                onChange={(e) => setFormData({ ...formData, ten_ng_chng: e.target.value })}
                                                className="form-control-modern"
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="info-label">
                                                <i className="fas fa-calendar-alt me-2"></i>
                                                Năm học
                                            </Form.Label>
                                            <Form.Control
                                                type="text"
                                                value={formData.nam_thu || ''}
                                                onChange={(e) => setFormData({ ...formData, nam_thu: e.target.value })}
                                                className="form-control-modern"
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="info-label">
                                                <i className="fas fa-book me-2"></i>
                                                Mã môn học
                                            </Form.Label>
                                            <Form.Control
                                                type="text"
                                                value={formData.ma_mh || ''}
                                                onChange={(e) => setFormData({ ...formData, ma_mh: e.target.value })}
                                                className="form-control-modern"
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="info-label">
                                                <i className="fas fa-book-open me-2"></i>
                                                Tên môn học
                                            </Form.Label>
                                            <Form.Control
                                                type="text"
                                                value={formData.ten_mh || ''}
                                                onChange={(e) => setFormData({ ...formData, ten_mh: e.target.value })}
                                                className="form-control-modern"
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="info-label">
                                                <i className="fas fa-user-injured me-2"></i>
                                                Tên BN
                                            </Form.Label>
                                            <Form.Control
                                                type="text"
                                                value={formData.ten_day_du_bn || ''}
                                                onChange={(e) => setFormData({ ...formData, ten_day_du_bn: e.target.value })}
                                                className="form-control-modern"
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="info-label">
                                                <i className="fas fa-calendar me-2"></i>
                                                Ngày BDHSBASV
                                            </Form.Label>
                                            <Form.Control
                                                type="date"
                                                value={formData.ngay_bd_hsbasv || ''}
                                                onChange={(e) => setFormData({ ...formData, ngay_bd_hsbasv: e.target.value })}
                                                className="form-control-modern"
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="info-label">
                                                <i className="fas fa-calendar-check me-2"></i>
                                                Ngày SV nộp bài
                                            </Form.Label>
                                            <Form.Control
                                                type="date"
                                                value={formData.ngay_sv_nop_bai || ''}
                                                onChange={(e) => setFormData({ ...formData, ngay_sv_nop_bai: e.target.value })}
                                                className="form-control-modern"
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="info-label">
                                                <i className="fas fa-tag me-2"></i>
                                                Loại HSBA
                                            </Form.Label>
                                            <Form.Select
                                                value={formData.loai_hsba !== null && formData.loai_hsba !== '' ? formData.loai_hsba : ''}
                                                onChange={(e) => setFormData({ ...formData, loai_hsba: e.target.value === '' ? null : parseInt(e.target.value) })}
                                                className="form-control-modern"
                                            >
                                                <option value="">Chọn loại</option>
                                                <option value="0">Điểm quá trình</option>
                                                <option value="1">Điểm bệnh án thi</option>
                                            </Form.Select>
                                        </Form.Group>
                                    </Col>
                                    <Col md={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="info-label">
                                                <i className="fas fa-users me-2"></i>
                                                Tên lớp
                                            </Form.Label>
                                            <Form.Control
                                                type="text"
                                                value={formData.ten_lop || ''}
                                                onChange={(e) => setFormData({ ...formData, ten_lop: e.target.value })}
                                                className="form-control-modern"
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={4}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="info-label">
                                                <i className="fas fa-star me-2"></i>
                                                Điểm thi miệng
                                            </Form.Label>
                                            <Form.Control
                                                type="number"
                                                step="0.01"
                                                value={formData.diem_thi_mieng || ''}
                                                onChange={(e) => setFormData({ ...formData, diem_thi_mieng: e.target.value ? parseFloat(e.target.value) : null })}
                                                className="form-control-modern"
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={4}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="info-label">
                                                <i className="fas fa-star me-2"></i>
                                                Điểm quá trình
                                            </Form.Label>
                                            <Form.Control
                                                type="number"
                                                step="0.01"
                                                value={formData.diem_qua_trinh || ''}
                                                onChange={(e) => setFormData({ ...formData, diem_qua_trinh: e.target.value ? parseFloat(e.target.value) : null })}
                                                className="form-control-modern"
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={4}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="info-label">
                                                <i className="fas fa-star me-2"></i>
                                                Điểm khám bệnh
                                            </Form.Label>
                                            <Form.Control
                                                type="number"
                                                step="0.01"
                                                value={formData.diem_kham_benh || ''}
                                                onChange={(e) => setFormData({ ...formData, diem_kham_benh: e.target.value ? parseFloat(e.target.value) : null })}
                                                className="form-control-modern"
                                            />
                                        </Form.Group>
                                    </Col>
                                </Row>
                            </div>
                        </div>
                    </div>
                </Modal.Body>
                <Modal.Footer className="mr-detail-footer">
                    <Button variant="outline-secondary" onClick={() => setShowEditModal(false)} className="btn-cancel">
                        <i className="fas fa-times me-2"></i>
                        Hủy
                    </Button>
                    <Button variant="primary" onClick={handleUpdate} className="btn-edit">
                        <i className="fas fa-save me-2"></i>
                        Lưu
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} size="lg" className="mr-detail-modal">
                <Modal.Header closeButton className="mr-detail-header">
                    <Modal.Title className="mr-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-exclamation-triangle"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Xác nhận xóa</h4>
                            <p className="mb-0 student-subtitle">Xóa hồ sơ bệnh án khỏi hệ thống</p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="mr-detail-body">
                    <div className="mr-detail-container">
                        {recordToDelete && (
                            <div className="mr-session-card">
                                <div className="mr-card-header-modern">
                                    <div className="header-icon">
                                        <i className="fas fa-file-medical"></i>
                                    </div>
                                    <h6 className="mb-0">Thông tin hồ sơ sẽ bị xóa</h6>
                                </div>
                                <div className="mr-card-body-modern">
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="fas fa-id-card me-2"></i>
                                            Mã SV
                                        </div>
                                        <div className="info-value">{recordToDelete.ma_sv || '-'}</div>
                                    </div>
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="fas fa-user me-2"></i>
                                            Tên SV
                                        </div>
                                        <div className="info-value">{recordToDelete.ten_day_du || '-'}</div>
                                    </div>
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="fas fa-book me-2"></i>
                                            Môn học
                                        </div>
                                        <div className="info-value">{recordToDelete.ten_mh || '-'}</div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <Alert variant="warning" className="mb-0">
                            <div className="d-flex align-items-center">
                                <i className="fas fa-exclamation-triangle me-3"></i>
                                <div>
                                    <strong>Lưu ý:</strong> Hành động này không thể hoàn tác. Bạn có chắc chắn muốn xóa hồ sơ bệnh án này?
                                </div>
                            </div>
                        </Alert>
                    </div>
                </Modal.Body>
                <Modal.Footer className="mr-detail-footer">
                    <Button variant="outline-secondary" onClick={() => setShowDeleteModal(false)} className="btn-cancel">
                        <i className="fas fa-times me-2"></i>
                        Hủy
                    </Button>
                    <Button variant="danger" onClick={handleDelete} className="btn-delete">
                        <i className="fas fa-trash me-2"></i>
                        Xóa
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default MedicalRecordsManagement;
