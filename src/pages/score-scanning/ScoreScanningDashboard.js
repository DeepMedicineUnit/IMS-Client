import React, { useState, useEffect, useRef } from 'react';
import { Row, Col, Button, Form, Modal, Alert, Spinner, Badge, ProgressBar } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Pagination from '../../components/Pagination';
import * as XLSX from 'xlsx';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/dashboard.css';
import '../../styles/user.css';

const IMPORT_TEMPLATES = [
    { value: 'xuat_excel', label: 'Mẫu Xuất Excel', desc: 'STT, Mã SV, Họ và tên, Ngày sinh, ĐGCB, KTTX, KTGK, T1, Mã MH, ...' },
    { value: 'file1', label: 'Mẫu 1 (8 cột)', desc: 'Dòng 1+2 tiêu đề. Dữ liệu từ dòng 3: ĐGCB, KTTX, KTGK, T1, Mã SV, Mã MH, Ghi chú, Nhóm/tổ' },
    { value: 'file2', label: 'Mẫu 2 (7 cột)', desc: 'Dòng 1+2 tiêu đề. Dữ liệu từ dòng 3: ĐGCB, KTGK, T1, Mã SV, Mã MH, Ghi chú, Nhóm/tổ (không có KTTX)' }
];

const ScoreScanningDashboard = () => {
    usePageTitle('Quét điểm');
    const { api: authApi, currentUser } = useAuth();
    const navigate = useNavigate();
    const [lists, setLists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState(null);
    const [form, setForm] = useState({ name: '', ma_mh: '', description: '' });
    const [config, setConfig] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteList, setDeleteList] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [sortField, setSortField] = useState('name');
    const [sortOrder, setSortOrder] = useState('asc');
    const [pagination, setPagination] = useState({ page: 1, limit: 10 });
    // Import từ Excel (tạo danh sách mới nếu có cột Mã MH)
    const [showImportModal, setShowImportModal] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importErrors, setImportErrors] = useState([]);
    const [importSuccess, setImportSuccess] = useState('');
    const [importLoading, setImportLoading] = useState(false);
    const [importProgress, setImportProgress] = useState(0);
    const [importTotal, setImportTotal] = useState(0);
    const [importResult, setImportResult] = useState(null);
    const [importTemplate, setImportTemplate] = useState('xuat_excel');
    const importFileRef = useRef(null);

    const hasScoreScanAccess = () => {
        if (currentUser?.role === 'superadmin') return true;
        const roles = currentUser?.module_roles || [];
        return roles.some(r => r && r.startsWith('score_scanning_'));
    };

    useEffect(() => {
        loadLists();
        loadConfig();
    }, []);

    const loadLists = async () => {
        try {
            setLoading(true);
            const res = await authApi.get('/score-scanning/lists');
            setLists(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error(err);
            setError('Không thể tải danh sách');
        } finally {
            setLoading(false);
        }
    };

    const loadConfig = async () => {
        try {
            const res = await authApi.get('/score-scanning/config');
            setConfig(res.data);
        } catch (_) {}
    };

    const parseExcelFileForDashboard = (file, template) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            const parseStr = (v, max) => {
                if (v == null || v === '') return null;
                const s = String(v).trim();
                return s === '' ? null : (max ? s.slice(0, max) : s);
            };
            const parseNum = (v) => {
                if (v == null || v === '') return null;
                const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
                return isNaN(n) ? null : n;
            };
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
                    if (!rows.length) {
                        resolve({ students: [], ma_mh: null });
                        return;
                    }
                    const students = [];
                    let ma_mh = null;

                    if (template === 'file1') {
                        for (let r = 2; r < rows.length; r++) {
                            const row = rows[r] || [];
                            const ma_sv = parseStr(row[4], 50);
                            if (!ma_sv) continue;
                            if (ma_mh == null && row[5] != null && String(row[5]).trim()) ma_mh = parseStr(row[5], 50);
                            students.push({
                                ma_sv,
                                name: null,
                                ngay_sinh: null,
                                c2: parseNum(row[0]),
                                b1: parseNum(row[1]),
                                k1: parseNum(row[2]),
                                t1: parseNum(row[3]),
                                nhom_to: parseStr(row[7], 50),
                                gc_nhap_diem: parseStr(row[6], 4000)
                            });
                        }
                        resolve({ students, ma_mh });
                        return;
                    }
                    if (template === 'file2') {
                        for (let r = 2; r < rows.length; r++) {
                            const row = rows[r] || [];
                            const ma_sv = parseStr(row[3], 50);
                            if (!ma_sv) continue;
                            if (ma_mh == null && row[4] != null && String(row[4]).trim()) ma_mh = parseStr(row[4], 50);
                            students.push({
                                ma_sv,
                                name: null,
                                ngay_sinh: null,
                                c2: parseNum(row[0]),
                                b1: null,
                                k1: parseNum(row[1]),
                                t1: parseNum(row[2]),
                                nhom_to: parseStr(row[6], 50),
                                gc_nhap_diem: parseStr(row[5], 4000)
                            });
                        }
                        resolve({ students, ma_mh });
                        return;
                    }
                    const headers = rows[0].map(h => (h != null ? String(h).trim() : ''));
                    const keyMap = {};
                    headers.forEach((h, i) => {
                        if (h.includes('Mã SV')) keyMap.ma_sv = i;
                        else if (h.includes('Mã MH') || h === 'ma_mh' || h === 'MaMH') keyMap.ma_mh = i;
                        else if (h.includes('Họ') && h.includes('tên')) keyMap.name = i;
                        else if (h.includes('Ngày sinh')) keyMap.ngay_sinh = i;
                        else if (h.includes('ĐGCB')) keyMap.c2 = i;
                        else if (h.includes('KTTX')) keyMap.b1 = i;
                        else if (h.includes('KTGK')) keyMap.k1 = i;
                        else if (h === 'T1' || h.includes('T1')) keyMap.t1 = i;
                        else if (h.includes('Nhóm') || h === 'NhomTo') keyMap.nhom_to = i;
                        else if (h.includes('Ghi chú') || h === 'GcNhapDiem') keyMap.gc_nhap_diem = i;
                    });
                    if (keyMap.ma_sv === undefined) {
                        reject(new Error('File Excel phải có cột "Mã SV"'));
                        return;
                    }
                    let ma_mh_x = null;
                    for (let r = 1; r < rows.length; r++) {
                        const row = rows[r] || [];
                        const ma_sv = parseStr(row[keyMap.ma_sv], 50);
                        if (!ma_sv) continue;
                        if (ma_mh_x == null && keyMap.ma_mh !== undefined && row[keyMap.ma_mh] != null && String(row[keyMap.ma_mh]).trim()) {
                            ma_mh_x = parseStr(row[keyMap.ma_mh], 50);
                        }
                        const getNum = (idx) => (idx === undefined ? null : parseNum(row[idx]));
                        const getStr = (idx, max) => (idx === undefined ? null : parseStr(row[idx], max));
                        students.push({
                            ma_sv,
                            name: getStr(keyMap.name, 500),
                            ngay_sinh: getStr(keyMap.ngay_sinh, 50),
                            c2: getNum(keyMap.c2),
                            b1: getNum(keyMap.b1),
                            k1: getNum(keyMap.k1),
                            t1: getNum(keyMap.t1),
                            nhom_to: getStr(keyMap.nhom_to, 50),
                            gc_nhap_diem: getStr(keyMap.gc_nhap_diem, 4000)
                        });
                    }
                    resolve({ students, ma_mh: ma_mh_x });
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error('Không đọc được file'));
            reader.readAsArrayBuffer(file);
        });
    };

    const handleImportFileChange = (e) => {
        const file = e.target.files?.[0] || null;
        setImportFile(file);
        setImportErrors([]);
        setImportSuccess('');
        setImportResult(null);
    };

    const downloadImportTemplate = () => {
        const headers = ['Mã SV', 'Họ tên', 'Ngày sinh', 'ĐGCB', 'KTTX', 'KTGK', 'T1', 'Mã MH', 'Nhóm/tổ', 'Ghi chú'];
        const ws = XLSX.utils.aoa_to_sheet([headers, []]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Danh sách');
        XLSX.writeFile(wb, 'Mau_Import_Diem_Dashboard.xlsx');
    };

    const handleImportExcel = async () => {
        if (!importFile) {
            setImportErrors(['Vui lòng chọn file Excel để nhập']);
            return;
        }
        if (!importFile.name.toLowerCase().endsWith('.xlsx') && !importFile.name.toLowerCase().endsWith('.xls')) {
            setImportErrors(['Chỉ chấp nhận file Excel (.xlsx, .xls)']);
            return;
        }
        setImportLoading(true);
        setImportErrors([]);
        setImportSuccess('');
        setImportResult(null);
        setImportProgress(0);
        setImportTotal(0);
        let progressInterval = null;
        try {
            const { students, ma_mh } = await parseExcelFileForDashboard(importFile, importTemplate);
            if (students.length === 0) {
                setImportErrors(['Không tìm thấy dòng dữ liệu nào (cần có cột Mã SV và ít nhất một dòng)']);
                setImportLoading(false);
                return;
            }
            if (!ma_mh || !ma_mh.trim()) {
                setImportErrors(['File cần có cột Mã MH (mã môn học) để tạo danh sách mới từ trang tổng quan. Để import vào danh sách có sẵn, hãy mở danh sách đó và dùng nút Import.']);
                setImportLoading(false);
                return;
            }
            const total = students.length;
            setImportTotal(total);
            setImportProgress(0);
            progressInterval = setInterval(() => {
                setImportProgress(prev => Math.min(prev + Math.max(1, Math.floor(total / 25)), Math.floor(total * 0.95)));
            }, 120);
            const listRes = await authApi.post('/score-scanning/lists', {
                name: `Danh sách ${ma_mh}`,
                ma_mh: ma_mh.trim(),
                description: 'Import từ Excel'
            });
            const listId = listRes.data?.id ?? listRes.data?.listId;
            if (!listId) {
                clearInterval(progressInterval);
                setImportErrors([listRes.data?.message || 'Tạo danh sách thất bại']);
                setImportLoading(false);
                return;
            }
            const res = await authApi.post(`/score-scanning/lists/${listId}/import`, { students });
            clearInterval(progressInterval);
            setImportProgress(total);
            setImportResult(res.data);
            if (res.data.success) {
                setImportSuccess(`Đã tạo danh sách "${ma_mh}" và import: ${res.data.added || 0} thêm mới, ${res.data.updated || 0} cập nhật.`);
                if (res.data.errors?.length) {
                    setImportErrors(res.data.errors.map(e => `${e.ma_sv || ''}: ${e.message}`));
                }
                loadLists();
                if (importFileRef.current) importFileRef.current.value = '';
                setImportFile(null);
                if (!res.data.errors?.length) {
                    setShowImportModal(false);
                    navigate(`/score-scanning/lists/${listId}`);
                }
            } else {
                setImportErrors([res.data.message || 'Import thất bại']);
            }
        } catch (err) {
            if (progressInterval) clearInterval(progressInterval);
            const msg = err.response?.data?.message || err.message || 'Import thất bại';
            setImportErrors([msg]);
            setImportResult({ success: false, message: msg });
        } finally {
            setImportLoading(false);
        }
    };

    const filteredLists = lists
        .filter(l =>
            !search || (l.name && l.name.toLowerCase().includes(search.toLowerCase())) ||
            (l.ma_mh && l.ma_mh.toLowerCase().includes(search.toLowerCase()))
        )
        .sort((a, b) => {
            let va = a[sortField];
            let vb = b[sortField];
            if (sortField === 'student_count') {
                va = Number(va || 0);
                vb = Number(vb || 0);
            } else {
                va = String(va || '').toLowerCase();
                vb = String(vb || '').toLowerCase();
            }
            const cmp = va < vb ? -1 : va > vb ? 1 : 0;
            return sortOrder === 'asc' ? cmp : -cmp;
        });

    const handleSort = (field) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('asc');
        }
    };

    const totalItems = filteredLists.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pagination.limit));
    const paginatedLists = filteredLists.slice(
        (pagination.page - 1) * pagination.limit,
        pagination.page * pagination.limit
    );

    useEffect(() => {
        setPagination(prev => {
            const pages = Math.max(1, Math.ceil(totalItems / prev.limit));
            return { ...prev, page: prev.page > pages && pages > 0 ? pages : prev.page };
        });
    }, [totalItems]);

    const handleSave = async () => {
        if (!form.name || !form.ma_mh) {
            setError('Vui lòng nhập tên danh sách và mã môn học');
            return;
        }
        try {
            setSaving(true);
            setError('');
            if (editId) {
                await authApi.put(`/score-scanning/lists/${editId}`, form);
            } else {
                await authApi.post('/score-scanning/lists', form);
            }
            setShowModal(false);
            setForm({ name: '', ma_mh: '', description: '' });
            setEditId(null);
            loadLists();
        } catch (err) {
            setError(err.response?.data?.message || 'Có lỗi xảy ra');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteList) return;
        try {
            await authApi.delete(`/score-scanning/lists/${deleteList.id}`);
            setShowDeleteModal(false);
            setDeleteList(null);
            loadLists();
        } catch (err) {
            setError(err.response?.data?.message || 'Có lỗi xảy ra');
        }
    };

    const handleListRowClick = (list) => {
        navigate(`/score-scanning/lists/${list.id}`);
    };

    const currentIsMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

    if (loading) {
        return (
            <div>
                <div className="session-header">
                    <div className="header-content">
                        <div className="header-title">
                            <h1><i className="fas fa-clipboard-data me-2"></i>Quản lý Danh sách Điểm</h1>
                            <p className="header-subtitle mb-0">Chụp ảnh → Nhận diện AI → Quản lý → Xuất Excel</p>
                        </div>
                    </div>
                </div>
                <div className="text-center py-5">
                    <Spinner animation="border" variant="primary" />
                    <p className="mt-3">Đang tải...</p>
                </div>
            </div>
        );
    }

    return (
        <div>
            {/* Header Section */}
            <div className="session-header">
                <div className="header-content">
                    <div className="header-title">
                        <h1><i className="fas fa-clipboard-data me-2"></i>Quản lý Danh sách Điểm</h1>
                        <p className="header-subtitle mb-0">Chụp ảnh → Nhận diện AI → Quản lý → Xuất Excel</p>
                    </div>
                    <div className="header-actions">
                        <Button
                            variant="outline-light"
                            className="create-session-btn"
                            onClick={() => {
                                setShowImportModal(true);
                                setImportFile(null);
                                setImportErrors([]);
                                setImportSuccess('');
                                setImportResult(null);
                                setImportProgress(0);
                                setImportTotal(0);
                                if (importFileRef.current) importFileRef.current.value = '';
                            }}
                        >
                            <i className="fas fa-file-import"></i>
                            Nhập từ Excel
                        </Button>
                        <Button
                            variant="outline-light"
                            className="create-session-btn"
                            onClick={() => {
                                setEditId(null);
                                setForm({ name: '', ma_mh: '', description: '' });
                                setShowModal(true);
                                setError('');
                            }}
                        >
                            <i className="fas fa-plus"></i>
                            Tạo danh sách mới
                        </Button>
                    </div>
                </div>
            </div>

            {config && !config.gemini_configured && (
                <Alert variant="warning" className="mb-4">
                    <i className="fas fa-exclamation-triangle me-2"></i>
                    Chưa cấu hình Gemini API. Chức năng quét ảnh sẽ không hoạt động.
                    {hasScoreScanAccess() && (
                        <Link to="/score-scanning/gemini-keys" className="btn btn-outline-primary btn-sm ms-3">
                            <i className="fas fa-key me-1"></i>Cấu hình API Key
                        </Link>
                    )}
                </Alert>
            )}

            {config && config.gemini_configured && hasScoreScanAccess() && (
                <Alert variant="info" className="mb-4">
                    <i className="fas fa-key me-2"></i>
                    {config.api_keys?.length || 0} API Keys - Còn {config.api_keys?.reduce((s, k) => s + (k.remaining || 0), 0)} requests hôm nay
                    <Link to="/score-scanning/gemini-keys" className="btn btn-outline-primary btn-sm ms-3">
                        Quản lý API Key
                    </Link>
                </Alert>
            )}

            {/* Search Controls */}
            <div className="session-list-controls">
                <div className="search-controls w-100">
                    <div className="search-input w-100">
                        <input
                            type="text"
                            placeholder="Tìm theo tên danh sách, mã môn học..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="search-input w-100"
                            style={{ width: '100%' }}
                        />
                    </div>
                </div>
            </div>

            {error && <Alert variant="danger" onClose={() => setError('')} dismissible>{error}</Alert>}

            {/* Table */}
            <div className="session-table-container">
                <div className="table-responsive-mobile">
                    <table className="table session-table students-table">
                        <thead>
                            <tr>
                                <th className={currentIsMobile ? 'mobile-essential' : 'mobile-hide'}>#</th>
                                <th
                                    onClick={() => handleSort('name')}
                                    style={{ cursor: 'pointer' }}
                                    className="text-nowrap mobile-essential"
                                >
                                    Tên danh sách {sortField === 'name' && (
                                        <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                                    )}
                                </th>
                                <th
                                    onClick={() => handleSort('ma_mh')}
                                    style={{ cursor: 'pointer' }}
                                    className="text-nowrap mobile-essential"
                                >
                                    Mã môn học {sortField === 'ma_mh' && (
                                        <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                                    )}
                                </th>
                                <th className={currentIsMobile ? 'mobile-hide' : ''}>Mô tả</th>
                                <th
                                    onClick={() => handleSort('student_count')}
                                    style={{ cursor: 'pointer' }}
                                    className="text-nowrap mobile-essential"
                                >
                                    Số SV {sortField === 'student_count' && (
                                        <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                                    )}
                                </th>
                                <th className="mobile-essential">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedLists.length > 0 ? (
                                paginatedLists.map((list, index) => (
                                    <tr
                                        key={list.id}
                                        onClick={() => handleListRowClick(list)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <td className={currentIsMobile ? 'mobile-essential' : 'mobile-hide'}>
                                            {(pagination.page - 1) * pagination.limit + index + 1}
                                        </td>
                                        <td className="mobile-essential">{list.name || '-'}</td>
                                        <td className="mobile-essential">
                                            {list.ma_mh ? <Badge bg="primary">{list.ma_mh}</Badge> : '-'}
                                        </td>
                                        <td className={currentIsMobile ? 'mobile-hide' : ''}>
                                            {list.description || '-'}
                                        </td>
                                        <td className="mobile-essential">{list.student_count || 0}</td>
                                        <td className="mobile-essential">
                                            <div className="action-buttons d-flex gap-1" onClick={e => e.stopPropagation()}>
                                                <Button
                                                    variant="outline-primary"
                                                    size="sm"
                                                    className="btn-icon"
                                                    onClick={() => {
                                                        setEditId(list.id);
                                                        setForm({ name: list.name, ma_mh: list.ma_mh || '', description: list.description || '' });
                                                        setShowModal(true);
                                                        setError('');
                                                    }}
                                                    title="Chỉnh sửa"
                                                >
                                                    <i className="fas fa-edit"></i>
                                                </Button>
                                                <Button
                                                    variant="outline-danger"
                                                    size="sm"
                                                    className="btn-icon"
                                                    onClick={() => { setDeleteList(list); setShowDeleteModal(true); }}
                                                    title="Xóa"
                                                >
                                                    <i className="fas fa-trash"></i>
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" className="text-center py-4">
                                        <i className="fas fa-inbox fa-2x text-muted mb-2"></i>
                                        <p className="mb-0 text-muted">Chưa có danh sách nào</p>
                                        <p className="mb-0 text-muted small">Nhấn "Tạo danh sách mới" để bắt đầu</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {filteredLists.length > 0 && totalPages > 1 && (
                    <div className="mt-3">
                        <Pagination
                            currentPage={pagination.page}
                            totalPages={totalPages}
                            onPageChange={page => setPagination(prev => ({ ...prev, page }))}
                            maxVisiblePages={5}
                            showFirstLast={true}
                        />
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            <Modal show={showModal} onHide={() => setShowModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>{editId ? 'Sửa danh sách' : 'Tạo danh sách mới'}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form.Group className="mb-3">
                        <Form.Label>Tên danh sách *</Form.Label>
                        <Form.Control
                            value={form.name}
                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            placeholder="VD: Điểm giữa kỳ Lập trình Web"
                        />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Mã môn học *</Form.Label>
                        <Form.Control
                            value={form.ma_mh}
                            onChange={e => setForm(f => ({ ...f, ma_mh: e.target.value }))}
                            placeholder="VD: IT001"
                        />
                    </Form.Group>
                    <Form.Group>
                        <Form.Label>Mô tả</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={2}
                            value={form.description}
                            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            placeholder="Ghi chú..."
                        />
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowModal(false)}>Hủy</Button>
                    <Button variant="primary" onClick={handleSave} disabled={saving}>
                        {saving ? <Spinner size="sm" animation="border" /> : <><i className="fas fa-check me-1"></i>Lưu</>}
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Delete Modal */}
            <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Xác nhận xóa</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    Bạn có chắc muốn xóa danh sách "<strong>{deleteList?.name}</strong>"? Tất cả sinh viên trong danh sách cũng sẽ bị xóa.
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>Hủy</Button>
                    <Button variant="danger" onClick={handleDelete}><i className="fas fa-trash me-1"></i>Xóa</Button>
                </Modal.Footer>
            </Modal>

            {/* Import Excel Modal - có cột Mã MH thì tự động tạo danh sách mới */}
            <Modal show={showImportModal} onHide={() => { setShowImportModal(false); setImportResult(null); setImportErrors([]); setImportSuccess(''); }} size="lg" className="student-detail-modal">
                <Modal.Header closeButton className="student-detail-header">
                    <Modal.Title className="student-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-file-import"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Nhập danh sách điểm từ Excel</h4>
                            <p className="mb-0 student-subtitle">File có cột Mã MH sẽ tự động tạo danh sách mới (Mã môn học)</p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="student-detail-body">
                    <div className="student-detail-container">
                        {importErrors.length > 0 && (
                            <Alert variant="danger" className="mb-4">
                                <div className="d-flex align-items-center mb-2">
                                    <i className="fas fa-exclamation-triangle me-2"></i>
                                    <strong>Lỗi nhập dữ liệu</strong>
                                </div>
                                <ul className="mb-0">
                                    {importErrors.map((err, idx) => (
                                        <li key={idx}>{err}</li>
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
                                {importResult?.added != null && (
                                    <div className="mt-2 small">Thêm mới: {importResult.added}, Cập nhật: {importResult.updated}</div>
                                )}
                            </Alert>
                        )}
                        {importLoading && importTotal > 0 && (
                            <div className="session-card mb-4">
                                <div className="card-header-modern">
                                    <div className="header-icon">
                                        <i className="fas fa-spinner fa-spin"></i>
                                    </div>
                                    <h6 className="mb-0">Tiến trình nhập dữ liệu</h6>
                                </div>
                                <div className="card-body-modern">
                                    <div className="d-flex justify-content-between mb-3">
                                        <span className="info-label">
                                            <i className="fas fa-users me-2"></i>Đang xử lý
                                        </span>
                                        <span className="info-value">
                                            {importProgress} / {importTotal} sinh viên ({Math.round((importProgress / importTotal) * 100)}%)
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
                        <div className="session-card">
                            <div className="card-header-modern">
                                <div className="header-icon">
                                    <i className="fas fa-file-excel"></i>
                                </div>
                                <h6 className="mb-0">Chọn file Excel</h6>
                            </div>
                            <div className="card-body-modern">
                                <Form>
                                    <Form.Group className="mb-3">
                                        <Form.Label className="info-label">
                                            <i className="fas fa-list me-2"></i>Mẫu file Import
                                        </Form.Label>
                                        <Form.Select
                                            value={importTemplate}
                                            onChange={e => { setImportTemplate(e.target.value); setImportErrors([]); setImportSuccess(''); setImportResult(null); }}
                                            className="form-control-modern"
                                        >
                                            {IMPORT_TEMPLATES.map(t => (
                                                <option key={t.value} value={t.value}>{t.label}</option>
                                            ))}
                                        </Form.Select>
                                        <Form.Text className="text-muted mt-2 d-block">
                                            <i className="fas fa-info-circle me-1"></i>
                                            {IMPORT_TEMPLATES.find(t => t.value === importTemplate)?.desc}
                                        </Form.Text>
                                    </Form.Group>
                                    <Form.Group className="mb-4">
                                        <Form.Label className="info-label">
                                            <i className="fas fa-upload me-2"></i>File Excel
                                        </Form.Label>
                                        <Form.Control
                                            ref={importFileRef}
                                            type="file"
                                            accept=".xlsx, .xls"
                                            onChange={handleImportFileChange}
                                            className="form-control-modern"
                                        />
                                        <Form.Text className="text-muted mt-2">
                                            <i className="fas fa-info-circle me-1"></i>
                                            File phải có cột <strong>Mã MH</strong> (mã môn học). Hệ thống sẽ tạo danh sách mới theo Mã MH và nhập điểm vào đó.
                                        </Form.Text>
                                    </Form.Group>
                                    <div className="d-flex justify-content-between align-items-center">
                                        <Button
                                            variant="outline-primary"
                                            onClick={downloadImportTemplate}
                                            className="btn-download-template"
                                        >
                                            <i className="fas fa-download me-2"></i>Tải mẫu Excel
                                        </Button>
                                        <div className="d-flex gap-2">
                                            <Button
                                                variant="outline-secondary"
                                                onClick={() => setShowImportModal(false)}
                                                className="btn-cancel"
                                            >
                                                <i className="fas fa-times me-2"></i>Hủy
                                            </Button>
                                            <Button
                                                variant="primary"
                                                onClick={handleImportExcel}
                                                disabled={importLoading || !importFile}
                                                className="btn-edit"
                                            >
                                                <i className="fas fa-upload me-2"></i>
                                                {importLoading ? 'Đang xử lý...' : 'Nhập dữ liệu'}
                                            </Button>
                                        </div>
                                    </div>
                                </Form>
                            </div>
                        </div>
                    </div>
                </Modal.Body>
            </Modal>

        </div>
    );
};

export default ScoreScanningDashboard;
