import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Container, Row, Col, Button, Table, Form, Spinner, Alert, Badge } from 'react-bootstrap';
import Navbar from '../../components/Navbar';
import api from '../../utils/api';
import * as XLSX from 'xlsx';
import usePageTitle from '../../hooks/usePageTitle';
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
import '../../styles/user.css';
import '../../styles/custom-report-modern.css';
import Pagination from '../../components/Pagination';

const formatDate = (dateString) => {
  try {
    if (!dateString) return '';
    let dateOnly = String(dateString);
    if (dateOnly.includes('T')) dateOnly = dateOnly.split('T')[0];
    const parts = dateOnly.split('-');
    if (parts.length !== 3) return dateString;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  } catch (e) {
    return dateString;
  }
};

const getLoaiHSBALabel = (loai) => {
  if (loai === null || loai === undefined) return '-';
  if (Number(loai) === 0) return 'Điểm quá trình';
  if (Number(loai) === 1) return 'Điểm bệnh án thi';
  return String(loai);
};

/** Chuyển chuỗi sang dạng an toàn cho tên file: bỏ dấu, bỏ khoảng trắng, chỉ giữ chữ và số */
const slugifyForFilename = (str) => {
  if (str == null || str === '') return '';
  let s = String(str)
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/\p{Mc}|\p{Mn}|\p{Me}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  s = s.replace(/\s/g, '');
  return s.replace(/[^A-Za-z0-9]/g, '') || 'unknown';
};

/** Tạo phần tên file từ bộ lọc đã chọn + ngày giờ xuất (HH-MM-SS-DD-MM-YYYY) */
const buildExportFilename = (filters, filterOptions) => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const timePart = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}-${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}`;
  const parts = [];

  if (filters.trang_thai_filter === 'ci_chua_cham') parts.push('CI_chua_cham_diem');
  else if (filters.trang_thai_filter === 'ci_da_cham') parts.push('CI_da_cham_diem');
  else if (filters.trang_thai_filter === 'sv_dang_thuc_hien') parts.push('SV_dang_thuc_hien');

  if (filters.benh_vien) {
    const bv = filterOptions.benhViens?.find(b => String(b.id) === String(filters.benh_vien) || b.benh_vien === filters.benh_vien);
    const label = bv?.benh_vien ?? (filters.benh_vien === '(Không xác định)' ? 'KhongXacDinh' : filters.benh_vien);
    parts.push(`BV-${slugifyForFilename(label)}`);
  }
  if (filters.ten_gvhd) parts.push(`GVHD-${slugifyForFilename(filters.ten_gvhd)}`);
  if (filters.ten_lop) parts.push(`Lop-${slugifyForFilename(filters.ten_lop)}`);
  if (filters.ten_sv) parts.push(`TenSV-${slugifyForFilename(filters.ten_sv)}`);
  if (filters.ten_mh) parts.push(`TenMH-${slugifyForFilename(filters.ten_mh)}`);
  if (filters.loai_hsba !== '' && filters.loai_hsba != null) {
    const label = Number(filters.loai_hsba) === 0 ? 'Diemquatrinh' : Number(filters.loai_hsba) === 1 ? 'Diembenhanthi' : slugifyForFilename(filters.loai_hsba);
    parts.push(`LoaiHSBA-${label}`);
  }
  if (filters.khoa) parts.push(`Khoa-${slugifyForFilename(filters.khoa)}`);
  if (filters.nam_thu) parts.push(`Namhoc-${slugifyForFilename(filters.nam_thu)}`);
  if (filters.ngay_bd_from) {
    const d = String(filters.ngay_bd_from).split('T')[0].replace(/-/g, '');
    if (d.length >= 8) parts.push(`NgayBDtu-${d.slice(6, 8)}${d.slice(4, 6)}${d.slice(0, 4)}`);
  }
  if (filters.ngay_bd_to) {
    const d = String(filters.ngay_bd_to).split('T')[0].replace(/-/g, '');
    if (d.length >= 8) parts.push(`NgayBDden-${d.slice(6, 8)}${d.slice(4, 6)}${d.slice(0, 4)}`);
  }
  if (filters.ngay_nop_from) {
    const d = String(filters.ngay_nop_from).split('T')[0].replace(/-/g, '');
    if (d.length >= 8) parts.push(`NgayNoptu-${d.slice(6, 8)}${d.slice(4, 6)}${d.slice(0, 4)}`);
  }
  if (filters.ngay_nop_to) {
    const d = String(filters.ngay_nop_to).split('T')[0].replace(/-/g, '');
    if (d.length >= 8) parts.push(`NgayNopden-${d.slice(6, 8)}${d.slice(4, 6)}${d.slice(0, 4)}`);
  }

  const prefix = parts.length > 0 ? parts.join('_') + '_' : 'theo-doi-ho-so-benh-an_';
  return `${prefix}${timePart}`;
};

const EnhancedMedicalRecordsReports = () => {
  usePageTitle('Theo dõi hồ sơ bệnh án');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, totalItems: 0, totalPages: 0 });
  const [filterOptions, setFilterOptions] = useState({
    khoas: [], lops: [], loaiHsba: [], gvhds: [], benhViens: [], namThu: [], monHocs: [],
    trangThaiOptions: []
  });

  const [filters, setFilters] = useState({
    ten_sv: '',
    ten_gvhd: '',
    /** Trạng thái: '' = tất cả, 'sv_dang_thuc_hien' | 'ci_chua_cham' | 'ci_da_cham' */
    trang_thai_filter: '',
    ten_mh: '',
    loai_hsba: '',
    ten_lop: '',
    khoa: '',
    benh_vien: '',
    nam_thu: '',
    ngay_bd_from: '',
    ngay_bd_to: '',
    ngay_nop_from: '',
    ngay_nop_to: '',
    sortBy: 'id',
    sortOrder: 'DESC'
  });

  const [isFilterSectionOpen, setIsFilterSectionOpen] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [columns, setColumns] = useState([
    'trang_thai_text', 'ma_sv', 'ten_day_du', 'ma_gvhd', 'ten_gvhd', 'benh_vien', 'ten_ng_chng', 'nam_thu',
    'ma_mh', 'ten_mh', 'ten_day_du_bn', 'ngay_bd_hsbasv', 'ngay_sv_nop_bai', 'loai_hsba', 'ten_lop',
    'diem_thi_mieng', 'diem_qua_trinh', 'diem_kham_benh'
  ]);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const resultSectionRef = useRef(null);

  const availableColumns = [
    { key: 'trang_thai_text', label: 'Trạng thái' },
    { key: 'ma_sv', label: 'Mã SV' },
    { key: 'ten_day_du', label: 'Tên SV' },
    { key: 'ma_gvhd', label: 'Mã GVHD' },
    { key: 'ten_gvhd', label: 'Tên GVHD' },
    { key: 'benh_vien', label: 'Bệnh viện' },
    { key: 'ten_ng_chng', label: 'Khoa' },
    { key: 'nam_thu', label: 'Năm học' },
    { key: 'ma_mh', label: 'Mã MH' },
    { key: 'ten_mh', label: 'Tên MH' },
    { key: 'ten_day_du_bn', label: 'Tên BN' },
    { key: 'ngay_bd_hsbasv', label: 'Ngày BD' },
    { key: 'ngay_sv_nop_bai', label: 'Ngày nộp' },
    { key: 'loai_hsba', label: 'Loại HSBA' },
    { key: 'ten_lop', label: 'Lớp' },
    { key: 'diem_thi_mieng', label: 'Điểm thi miệng' },
    { key: 'diem_qua_trinh', label: 'Điểm quá trình' },
    { key: 'diem_kham_benh', label: 'Điểm khám bệnh' }
  ];

  const columnLabels = Object.fromEntries(availableColumns.map(c => [c.key, c.label]));

  // Ref để tránh race: chỉ áp dụng response nếu đúng với bộ lọc hiện tại khi request được gửi
  const filterOptionsRequestRef = useRef(0);

  // Cascading: mỗi khi bộ lọc đổi thì gọi lại API để lấy danh sách option còn khả dĩ (tất cả bộ lọc đều cascade lên nhau)
  useEffect(() => {
    const requestId = ++filterOptionsRequestRef.current;
    const fetchOptions = async () => {
      try {
        const params = {};
        if (filters.ten_sv) params.ten_sv = filters.ten_sv;
        if (filters.ten_gvhd) params.ten_gvhd = filters.ten_gvhd;
        if (filters.trang_thai_filter) params.trang_thai_filter = filters.trang_thai_filter;
        if (filters.ten_mh) params.ten_mh = filters.ten_mh;
        if (filters.loai_hsba !== '') params.loai_hsba = filters.loai_hsba;
        if (filters.ten_lop) params.ten_lop = filters.ten_lop;
        if (filters.khoa) params.khoa = filters.khoa;
        if (filters.benh_vien) params.benh_vien = filters.benh_vien;
        if (filters.nam_thu) params.nam_thu = filters.nam_thu;
        if (filters.ngay_bd_from) params.ngay_bd_from = filters.ngay_bd_from;
        if (filters.ngay_bd_to) params.ngay_bd_to = filters.ngay_bd_to;
        if (filters.ngay_nop_from) params.ngay_nop_from = filters.ngay_nop_from;
        if (filters.ngay_nop_to) params.ngay_nop_to = filters.ngay_nop_to;
        const res = await api.get('/medical-records/stats/dashboard', { params });
        // Chỉ cập nhật state nếu đây vẫn là request mới nhất (tránh response cũ ghi đè cascade)
        if (requestId !== filterOptionsRequestRef.current) return;
        if (res.data?.data?.filterOptions) {
          const opts = res.data.data.filterOptions;
          let monHocs = opts.monHocs && Array.isArray(opts.monHocs) ? opts.monHocs : [];
          if (monHocs.length === 0) {
            try {
              const listRes = await api.get('/medical-records', { params: { page: 1, limit: 2000 } });
              const list = listRes.data?.data || [];
              const byTenMh = {};
              list.forEach((row) => {
                const t = row.ten_mh != null ? String(row.ten_mh) : '';
                byTenMh[t] = (byTenMh[t] || 0) + 1;
              });
              monHocs = Object.entries(byTenMh).map(([ten_mh, count]) => ({ ten_mh, count }));
            } catch (_) { /* keep monHocs [] */ }
          }
          if (requestId !== filterOptionsRequestRef.current) return;
          setFilterOptions({
            khoas: opts.khoas || [],
            lops: opts.lops || [],
            loaiHsba: opts.loaiHsba || [],
            gvhds: opts.gvhds || [],
            benhViens: opts.benhViens || [],
            namThu: opts.namThu || [],
            monHocs,
            trangThaiOptions: opts.trangThaiOptions && Array.isArray(opts.trangThaiOptions) ? opts.trangThaiOptions : []
          });
        }
      } catch (e) {
        if (requestId === filterOptionsRequestRef.current) console.warn('Could not load filter options', e);
      } finally {
        if (requestId === filterOptionsRequestRef.current) setLoading(false);
      }
    };
    fetchOptions();
  }, [
    filters.ten_sv,
    filters.ten_gvhd,
    filters.trang_thai_filter,
    filters.ten_mh,
    filters.loai_hsba,
    filters.ten_lop,
    filters.khoa,
    filters.benh_vien,
    filters.nam_thu,
    filters.ngay_bd_from,
    filters.ngay_bd_to,
    filters.ngay_nop_from,
    filters.ngay_nop_to
  ]);

  // Giá trị option "Bệnh viện" = không xác định (backend trả về chuỗi này cho NULL/rỗng)
  const BENH_VIEN_KHONG_XAC_DINH = '(Không xác định)';

  // Chỉ hiển thị option Trạng thái có count > 0 (hoặc "Tất cả"), ẩn option (0)
  const visibleTrangThaiOptions = useMemo(() => {
    const opts = filterOptions.trangThaiOptions || [];
    return opts.filter(opt => (opt.value ?? '') === '' || (Number(opt.count) || 0) > 0);
  }, [filterOptions.trangThaiOptions]);

  // Khi option cascading đổi, bỏ chọn những giá trị không còn trong list (với Trạng thái: không còn trong danh sách hiển thị)
  useEffect(() => {
    setFilters(f => {
      let next = { ...f };
      if (f.ten_lop && !filterOptions.lops.some(l => l.lop === f.ten_lop)) next = { ...next, ten_lop: '' };
      if (f.khoa && !filterOptions.khoas.some(k => k.khoa === f.khoa)) next = { ...next, khoa: '' };
      if (f.ten_gvhd && !filterOptions.gvhds.some(g => g.ten_gvhd === f.ten_gvhd)) next = { ...next, ten_gvhd: '' };
      // Không reset "Không xác định"; so sánh theo id (backend trả benhViens có id + benh_vien)
      if (f.benh_vien && f.benh_vien !== BENH_VIEN_KHONG_XAC_DINH && !filterOptions.benhViens.some(b => (b.id != null && String(b.id) === String(f.benh_vien)) || b.benh_vien === f.benh_vien)) next = { ...next, benh_vien: '' };
      if (f.nam_thu && !filterOptions.namThu.some(n => n.nam_thu === f.nam_thu)) next = { ...next, nam_thu: '' };
      if (f.loai_hsba !== '' && f.loai_hsba != null && !filterOptions.loaiHsba.some(l => String(l.loai_hsba) === String(f.loai_hsba))) next = { ...next, loai_hsba: '' };
      if (f.ten_mh && !filterOptions.monHocs.some(m => (m.ten_mh || '') === f.ten_mh)) next = { ...next, ten_mh: '' };
      if (f.trang_thai_filter && !visibleTrangThaiOptions.some(o => (o.value || '') === f.trang_thai_filter)) next = { ...next, trang_thai_filter: '' };
      return next;
    });
  }, [filterOptions.khoas, filterOptions.lops, filterOptions.loaiHsba, filterOptions.gvhds, filterOptions.benhViens, filterOptions.namThu, filterOptions.monHocs, filterOptions.trangThaiOptions, visibleTrangThaiOptions]);

  useEffect(() => {
    fetchReport(pagination.page);
  }, [filters.sortBy, filters.sortOrder, filters.ten_sv, filters.ten_gvhd, filters.trang_thai_filter, filters.ten_mh, filters.loai_hsba, filters.ten_lop, filters.khoa, filters.benh_vien, filters.nam_thu, filters.ngay_bd_from, filters.ngay_bd_to, filters.ngay_nop_from, filters.ngay_nop_to, pagination.page]);

  const buildParams = (page = 1) => {
    const p = {
      page,
      limit: pagination.limit,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder
    };
    if (filters.ten_sv) p.ten_sv = filters.ten_sv;
    if (filters.ten_gvhd) p.ten_gvhd = filters.ten_gvhd;
    if (filters.trang_thai_filter) p.trang_thai_filter = filters.trang_thai_filter;
    if (filters.ten_mh) p.ten_mh = filters.ten_mh;
    if (filters.loai_hsba !== '') p.loai_hsba = filters.loai_hsba;
    if (filters.ten_lop) p.ten_lop = filters.ten_lop;
    if (filters.khoa) p.khoa = filters.khoa;
    if (filters.benh_vien) p.benh_vien = filters.benh_vien;
    if (filters.nam_thu) p.nam_thu = filters.nam_thu;
    if (filters.ngay_bd_from) p.ngay_bd_from = filters.ngay_bd_from;
    if (filters.ngay_bd_to) p.ngay_bd_to = filters.ngay_bd_to;
    if (filters.ngay_nop_from) p.ngay_nop_from = filters.ngay_nop_from;
    if (filters.ngay_nop_to) p.ngay_nop_to = filters.ngay_nop_to;
    return p;
  };

  const fetchReport = async (page = 1) => {
    setReportLoading(true);
    setError(null);
    try {
      const params = buildParams(page);
      const res = await api.get('/medical-records', { params });
      const list = res.data?.data || [];
      const total = res.data?.pagination?.total ?? list.length;
      const totalPages = res.data?.pagination?.totalPages ?? Math.ceil(total / pagination.limit);
      setData(list);
      setPagination(prev => ({ ...prev, page, totalItems: total, totalPages }));
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Lỗi tải dữ liệu');
      setData([]);
    } finally {
      setReportLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleSort = (columnKey) => {
    setFilters(prev => ({
      ...prev,
      sortBy: columnKey,
      sortOrder: prev.sortBy === columnKey && prev.sortOrder === 'DESC' ? 'ASC' : 'DESC'
    }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setColumns((items) => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const SortableHeader = ({ id, children, onSort, sortField, sortOrder }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };
    return (
      <th ref={setNodeRef} style={style}>
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
              <i className={`fas fa-sort-${sortOrder === 'DESC' ? 'down' : 'up'} ms-1`}></i>
            )}
          </span>
        </div>
      </th>
    );
  };

  const toggleColumn = (key) => {
    setColumns(prev =>
      prev.includes(key) ? (prev.length > 1 ? prev.filter(c => c !== key) : prev) : [...prev, key]
    );
  };

  // Đảm bảo sortBy luôn trỏ tới cột còn hiển thị (tránh lỗi khi bỏ cột đang sắp xếp)
  useEffect(() => {
    if (columns.length > 0 && !columns.includes(filters.sortBy)) {
      setFilters(f => ({ ...f, sortBy: columns[0] }));
      setPagination(p => ({ ...p, page: 1 }));
    }
  }, [columns]);

  const getCellExportValue = (col, v) => {
    if (col === 'trang_thai_text') return v != null ? String(v) : '-';
    if (col === 'ngay_bd_hsbasv' || col === 'ngay_sv_nop_bai') return formatDate(v);
    if (col === 'loai_hsba') return getLoaiHSBALabel(v);
    return v != null ? String(v) : '-';
  };

  const exportToExcel = async () => {
    const exportBtn = document.getElementById('medical-records-export-btn');
    if (exportBtn) {
      exportBtn.disabled = true;
      exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Đang xuất...';
    }
    try {
      const params = { ...buildParams(1), limit: 100000 };
      const res = await api.get('/medical-records', { params });
      const allData = res.data?.data || [];
      if (!allData.length) {
        alert('Không có dữ liệu để xuất');
        return;
      }
      const headers = columns.map(c => columnLabels[c] || c);
      const rows = allData.map(r => columns.map(col => getCellExportValue(col, r[col])));
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

      // Căn chỉnh độ rộng cột theo nội dung (tối thiểu 10, tối đa 45 ký tự)
      const colWidths = columns.map((col, j) => {
        const headerLen = (headers[j] || '').length;
        let maxCell = headerLen;
        for (let i = 0; i < rows.length; i++) {
          const cellVal = rows[i][j] != null ? String(rows[i][j]) : '';
          maxCell = Math.max(maxCell, Math.min(cellVal.length, 50));
        }
        const wch = Math.min(Math.max(maxCell + 1, 10), 45);
        return { wch };
      });
      ws['!cols'] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Hồ sơ bệnh án');
      const fileName = `${buildExportFilename(filters, filterOptions)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      alert(`Đã xuất thành công ${allData.length} dòng dữ liệu!`);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Có lỗi khi xuất Excel.');
    } finally {
      if (exportBtn) {
        exportBtn.disabled = false;
        exportBtn.innerHTML = '<i class="fas fa-file-excel me-1"></i>Xuất Excel';
      }
    }
  };

  return (
    <>
      <Navbar />
      <Container fluid className="mt-2 mb-4">
        <div className="custom-report-container">
          {error && (
            <Alert variant="danger" dismissible onClose={() => setError(null)} className="mb-3">
              {error}
            </Alert>
          )}

          <div className={`custom-report-card mb-4 ${!isFilterSectionOpen ? 'custom-report-card--filter-collapsed' : ''}`}>
            <div
              className="custom-report-card-header"
              style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              onClick={() => setIsFilterSectionOpen(!isFilterSectionOpen)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="custom-report-card-header-icon">
                  <i className="fas fa-cog"></i>
                </div>
                <h6 className="mb-0 text-white">Tùy chọn theo dõi</h6>
              </div>
              <i className={`fas fa-chevron-${isFilterSectionOpen ? 'up' : 'down'}`} style={{ color: 'rgba(255,255,255,0.9)' }}></i>
            </div>
            <div
              className="custom-report-card-body"
              style={{
                maxHeight: isFilterSectionOpen ? '5000px' : '0',
                overflow: 'hidden',
                transition: 'all 0.4s ease-in-out',
                opacity: isFilterSectionOpen ? 1 : 0,
                padding: isFilterSectionOpen ? undefined : 0,
                border: 'none',
                background: isFilterSectionOpen ? undefined : 'transparent'
              }}
            >
              <h6 className="mb-3 mt-2"><i className="fas fa-filter me-2"></i>Tùy chọn hiển thị và lọc dữ liệu</h6>

              {/* Hàng 1: 5 cột — Trạng thái, Bệnh viện, Tên GVHD, Lớp, Tên SV */}
              <Row className="mb-3 row-cols-1 row-cols-md-5 g-2">
                <Col>
                  <Form.Label className="custom-report-form-label">
                    Trạng thái <span className="text-muted fw-normal">({visibleTrangThaiOptions.length})</span>
                  </Form.Label>
                  <Form.Select
                    className="custom-report-form-control"
                    value={filters.trang_thai_filter}
                    onChange={(e) => handleFilterChange('trang_thai_filter', e.target.value)}
                  >
                    {visibleTrangThaiOptions.length === 0 && <option value="">Tất cả</option>}
                    {visibleTrangThaiOptions.map((opt, i) => (
                      <option key={i} value={opt.value ?? ''}>
                        {opt.label} ({opt.count ?? 0})
                      </option>
                    ))}
                  </Form.Select>
                </Col>
                <Col>
                  <Form.Label className="custom-report-form-label">
                    Bệnh viện <span className="text-muted fw-normal">({filterOptions.benhViens.length})</span>
                  </Form.Label>
                  <Form.Select
                    className="custom-report-form-control"
                    value={filters.benh_vien}
                    onChange={(e) => handleFilterChange('benh_vien', e.target.value)}
                  >
                    <option value="">Tất cả bệnh viện</option>
                    {filterOptions.benhViens.map((b, i) => (
                      <option key={i} value={b.id != null ? String(b.id) : BENH_VIEN_KHONG_XAC_DINH}>
                        {b.benh_vien} ({b.count})
                      </option>
                    ))}
                  </Form.Select>
                </Col>
                <Col>
                  <Form.Label className="custom-report-form-label">
                    Tên GVHD <span className="text-muted fw-normal">({filterOptions.gvhds.length})</span>
                  </Form.Label>
                  <Form.Select
                    className="custom-report-form-control"
                    value={filters.ten_gvhd}
                    onChange={(e) => handleFilterChange('ten_gvhd', e.target.value)}
                  >
                    <option value="">Tất cả GVHD</option>
                    {filterOptions.gvhds.map((g, i) => (
                      <option key={i} value={g.ten_gvhd}>
                        {g.ten_gvhd} ({g.count})
                      </option>
                    ))}
                  </Form.Select>
                </Col>
                <Col>
                  <Form.Label className="custom-report-form-label">
                    Lớp <span className="text-muted fw-normal">({filterOptions.lops.length})</span>
                  </Form.Label>
                  <Form.Select
                    className="custom-report-form-control"
                    value={filters.ten_lop}
                    onChange={(e) => handleFilterChange('ten_lop', e.target.value)}
                  >
                    <option value="">Tất cả lớp</option>
                    {filterOptions.lops.map((l, i) => (
                      <option key={i} value={l.lop}>{l.lop} ({l.count})</option>
                    ))}
                  </Form.Select>
                </Col>
                <Col>
                  <Form.Label className="custom-report-form-label">Tên SV</Form.Label>
                  <Form.Control
                    className="custom-report-form-control"
                    placeholder="Tìm theo tên SV..."
                    value={filters.ten_sv}
                    onChange={(e) => handleFilterChange('ten_sv', e.target.value)}
                  />
                </Col>
              </Row>

              {/* Hàng 2: 4 cột — Tên môn học, Loại HSBA, Khoa, Năm học */}
              <Row className="mb-3 row-cols-1 row-cols-md-4 g-2">
                <Col>
                  <Form.Label className="custom-report-form-label">
                    Tên môn học <span className="text-muted fw-normal">({filterOptions.monHocs.length})</span>
                  </Form.Label>
                  <Form.Select
                    className="custom-report-form-control"
                    value={filters.ten_mh}
                    onChange={(e) => handleFilterChange('ten_mh', e.target.value)}
                  >
                    <option value="">Tất cả môn học</option>
                    {filterOptions.monHocs.map((m, i) => (
                      <option key={i} value={m.ten_mh || ''}>
                        {(m.ten_mh || '(Không xác định)')} ({m.count})
                      </option>
                    ))}
                  </Form.Select>
                </Col>
                <Col>
                  <Form.Label className="custom-report-form-label">
                    Loại HSBA <span className="text-muted fw-normal">({filterOptions.loaiHsba.length})</span>
                  </Form.Label>
                  <Form.Select
                    className="custom-report-form-control"
                    value={filters.loai_hsba}
                    onChange={(e) => handleFilterChange('loai_hsba', e.target.value)}
                  >
                    <option value="">Tất cả</option>
                    {filterOptions.loaiHsba.map((item, i) => (
                      <option key={i} value={item.loai_hsba == null ? '' : String(item.loai_hsba)}>
                        {item.loai_hsba === 0 ? 'Điểm quá trình' : item.loai_hsba === 1 ? 'Điểm bệnh án thi' : `Loại ${item.loai_hsba}`} ({item.count})
                      </option>
                    ))}
                  </Form.Select>
                </Col>
                <Col>
                  <Form.Label className="custom-report-form-label">
                    Khoa <span className="text-muted fw-normal">({filterOptions.khoas.length})</span>
                  </Form.Label>
                  <Form.Select
                    className="custom-report-form-control"
                    value={filters.khoa}
                    onChange={(e) => handleFilterChange('khoa', e.target.value)}
                  >
                    <option value="">Tất cả khoa</option>
                    {filterOptions.khoas.map((k, i) => (
                      <option key={i} value={k.khoa}>{k.khoa} ({k.count})</option>
                    ))}
                  </Form.Select>
                </Col>
                <Col>
                  <Form.Label className="custom-report-form-label">
                    Năm học <span className="text-muted fw-normal">({filterOptions.namThu.length})</span>
                  </Form.Label>
                  <Form.Select
                    className="custom-report-form-control"
                    value={filters.nam_thu}
                    onChange={(e) => handleFilterChange('nam_thu', e.target.value)}
                  >
                    <option value="">Tất cả năm học</option>
                    {filterOptions.namThu.map((n, i) => (
                      <option key={i} value={n.nam_thu}>
                        {n.nam_thu} ({n.count})
                      </option>
                    ))}
                  </Form.Select>
                </Col>
              </Row>

              {/* Hàng 3: 4 cột — Ngày BD từ, Ngày BD đến, Ngày nộp từ, Ngày nộp đến */}
              <Row className="mb-3 row-cols-1 row-cols-md-4 g-2">
                <Col>
                  <Form.Label className="custom-report-form-label">Ngày BD từ</Form.Label>
                  <Form.Control
                    type="date"
                    className="custom-report-form-control"
                    value={filters.ngay_bd_from}
                    onChange={(e) => handleFilterChange('ngay_bd_from', e.target.value)}
                  />
                </Col>
                <Col>
                  <Form.Label className="custom-report-form-label">Ngày BD đến</Form.Label>
                  <Form.Control
                    type="date"
                    className="custom-report-form-control"
                    value={filters.ngay_bd_to}
                    onChange={(e) => handleFilterChange('ngay_bd_to', e.target.value)}
                  />
                </Col>
                <Col>
                  <Form.Label className="custom-report-form-label">Ngày nộp từ</Form.Label>
                  <Form.Control
                    type="date"
                    className="custom-report-form-control"
                    value={filters.ngay_nop_from}
                    onChange={(e) => handleFilterChange('ngay_nop_from', e.target.value)}
                  />
                </Col>
                <Col>
                  <Form.Label className="custom-report-form-label">Ngày nộp đến</Form.Label>
                  <Form.Control
                    type="date"
                    className="custom-report-form-control"
                    value={filters.ngay_nop_to}
                    onChange={(e) => handleFilterChange('ngay_nop_to', e.target.value)}
                  />
                </Col>
              </Row>

              <Row className="mb-3">
                <Col md={12}>
                  <Form.Label className="custom-report-section-label"><i className="fas fa-columns me-2"></i>Cột hiển thị</Form.Label>
                  <div className="d-flex gap-2 align-items-center mb-2">
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => setShowColumnSelector(!showColumnSelector)}
                    >
                      <i className={`fas fa-${showColumnSelector ? 'eye-slash' : 'eye'} me-1`}></i>
                      {showColumnSelector ? 'Ẩn' : 'Hiện'} tùy chọn cột
                    </Button>
                    <span className="custom-report-badge custom-report-badge-info">{columns.length} cột</span>
                  </div>
                  {showColumnSelector && (
                    <Row>
                      {availableColumns.map(col => (
                        <Col md={3} sm={6} key={col.key} className="mb-2">
                          <Form.Check
                            type="checkbox"
                            id={`col-${col.key}`}
                            label={col.label}
                            checked={columns.includes(col.key)}
                            onChange={() => toggleColumn(col.key)}
                          />
                        </Col>
                      ))}
                    </Row>
                  )}
                </Col>
              </Row>

              <div className="d-flex justify-content-end">
                <Button
                  className="custom-report-btn custom-report-btn-success"
                  onClick={() => fetchReport(1)}
                  disabled={reportLoading}
                >
                  <i className="fas fa-search me-1"></i>Áp dụng bộ lọc
                </Button>
              </div>
            </div>
          </div>

          <div className="custom-report-card" ref={resultSectionRef}>
            <div className="custom-report-card-header">
              <div className="custom-report-card-header-icon">
                <i className="fas fa-table"></i>
              </div>
              <h6 className="mb-0 text-white">Kết quả tìm kiếm</h6>
              <div className="ms-auto d-flex align-items-center gap-2">
                <span className="custom-report-badge custom-report-badge-success">{data.length} dòng</span>
                <span className="custom-report-badge custom-report-badge-primary">Tổng: {pagination.totalItems}</span>
                <Button
                  id="medical-records-export-btn"
                  variant="outline-light"
                  size="sm"
                  className="custom-report-btn custom-report-btn-success"
                  onClick={exportToExcel}
                  disabled={reportLoading || data.length === 0}
                >
                  <i className="fas fa-file-excel me-1"></i>Xuất Excel
                </Button>
              </div>
            </div>
            <div className="custom-report-card-body">
              {reportLoading ? (
                <div className="custom-report-loading py-5">
                  <Spinner animation="border" />
                  <p className="mt-2 text-muted">Đang tải dữ liệu...</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <DndContext
                    key={`dnd-${columns.length}-${columns.join(',')}`}
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <Table className="custom-report-table" striped bordered hover>
                      <thead className="table-light">
                        <tr>
                          <th style={{ width: '50px' }}>#</th>
                          <SortableContext
                            items={columns}
                            strategy={horizontalListSortingStrategy}
                          >
                            {columns.map((col) => (
                              <SortableHeader
                                key={col}
                                id={col}
                                onSort={() => handleSort(col)}
                                sortField={filters.sortBy}
                                sortOrder={filters.sortOrder}
                              >
                                {columnLabels[col] || col}
                              </SortableHeader>
                            ))}
                          </SortableContext>
                        </tr>
                      </thead>
                      <tbody>
                      {data.length > 0 ? (
                        data.map((row, idx) => (
                          <tr key={row.id || idx}>
                            <td>{(pagination.page - 1) * pagination.limit + idx + 1}</td>
                            {columns.map(col => {
                              const v = row[col];
                              if (col === 'trang_thai_text') {
                                return (
                                  <td key={col}>
                                    <Badge bg={v && v.includes('đã chấm điểm') ? 'success' : v ? 'warning' : 'secondary'}>
                                      {v || '-'}
                                    </Badge>
                                  </td>
                                );
                              }
                              if (col === 'ngay_bd_hsbasv' || col === 'ngay_sv_nop_bai') return <td key={col}>{formatDate(v)}</td>;
                              if (col === 'loai_hsba') return <td key={col}>{getLoaiHSBALabel(v)}</td>;
                              return <td key={col}>{v != null ? String(v) : '-'}</td>;
                            })}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={columns.length + 1} className="text-center py-5">
                            <div className="custom-report-empty">
                              <i className="fas fa-inbox fa-2x text-muted mb-2"></i>
                              <p className="text-muted mb-0">Không có dữ liệu phù hợp với bộ lọc</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </DndContext>
                </div>
              )}

              {data.length > 0 && (
                <div className="mt-3">
                  <Pagination
                    currentPage={pagination.page}
                    totalPages={pagination.totalPages || 1}
                    onPageChange={(page) => {
                      setPagination(prev => ({ ...prev, page }));
                      if (resultSectionRef.current) {
                        resultSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </Container>
    </>
  );
};

export default EnhancedMedicalRecordsReports;
