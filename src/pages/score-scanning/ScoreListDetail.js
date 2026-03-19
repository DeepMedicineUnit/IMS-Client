import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Row, Col, Card, Button, Form, Modal, Alert, Spinner, Badge, ProgressBar, Dropdown } from 'react-bootstrap';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import * as XLSX from 'xlsx';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/dashboard.css';
import '../../styles/user.css';

const ScoreListDetail = () => {
    usePageTitle('Chi tiết danh sách điểm');
    const { id } = useParams();
    const navigate = useNavigate();
    const { api: authApi } = useAuth();
    const [list, setList] = useState(null);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [sortField, setSortField] = useState('default');
    const [sortOrder, setSortOrder] = useState('asc');
    const [showStudentModal, setShowStudentModal] = useState(false);
    const [editStudent, setEditStudent] = useState(null);
    const [studentForm, setStudentForm] = useState({ ma_sv: '', name: '', ngay_sinh: '', c2: '', b1: '', k1: '', t1: '', nhom_to: '', gc_nhap_diem: '' });
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteStudent, setDeleteStudent] = useState(null);
    const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
    const [saving, setSaving] = useState(false);
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

    // Mẫu Import: xuat_excel (file Xuất Excel), file1 (ĐGCB,KTTX,KTGK,T1,Mã SV,Mã MH,Ghi chú,Nhóm/tổ), file2 (ĐGCB,KTGK,T1,Mã SV,... không có KTTX)
    const IMPORT_TEMPLATES = [
        { value: 'xuat_excel', label: 'Mẫu Xuất Excel', desc: 'STT, Mã SV, Họ và tên, Ngày sinh, ĐGCB, KTTX, KTGK, T1, Điểm TKHP' },
        { value: 'file1', label: 'Mẫu 1 (8 cột)', desc: 'Dòng 1+2 là tiêu đề. Dữ liệu từ dòng 3: ĐGCB(C2), KTTX(B1), KTGK(K1), T1, Mã SV, Mã MH, Ghi chú, Nhóm/tổ' },
        { value: 'file2', label: 'Mẫu 2 (7 cột)', desc: 'Dòng 1+2 là tiêu đề. Dữ liệu từ dòng 3: ĐGCB(C2), KTGK(K1), T1, Mã SV, Mã MH, Ghi chú, Nhóm/tổ (không có KTTX)' }
    ];

    const loadList = useCallback(async () => {
        try {
            const res = await authApi.get(`/score-scanning/lists/${id}`);
            setList(res.data);
        } catch (_) {
            setList(null);
        }
    }, [id, authApi]);

    const loadStudents = useCallback(async () => {
        try {
            const res = await authApi.get(`/score-scanning/lists/${id}/students?sort=default&search=${encodeURIComponent(search)}`);
            setStudents(Array.isArray(res.data) ? res.data : []);
        } catch (_) {
            setStudents([]);
        }
    }, [id, search, authApi]);

    useEffect(() => {
        loadList();
    }, [loadList]);

    useEffect(() => {
        setLoading(true);
        loadStudents().finally(() => setLoading(false));
    }, [loadStudents]);

    const stats = {
        total: students.length,
        pass: students.filter(s => s.diem_tkhp != null && s.diem_tkhp >= 5).length,
        fail: students.filter(s => s.diem_tkhp != null && s.diem_tkhp < 5).length,
        avg: students.filter(s => s.diem_tkhp != null).length
            ? (students.reduce((s, st) => s + (st.diem_tkhp || 0), 0) / students.filter(st => st.diem_tkhp != null).length).toFixed(2)
            : '-'
    };

    const handleSort = (field) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('asc');
        }
    };

    const sortedStudents = useMemo(() => {
        if (sortField === 'default') return students;
        const list = [...students];
        const numericFields = ['c2', 'b1', 'k1', 't1', 'diem_tkhp'];
        const isNumeric = numericFields.includes(sortField);
        list.sort((a, b) => {
            let va = a[sortField];
            let vb = b[sortField];
            if (isNumeric) {
                va = va != null && va !== '' ? Number(va) : null;
                vb = vb != null && vb !== '' ? Number(vb) : null;
                if (va == null && vb == null) return 0;
                if (va == null) return sortOrder === 'asc' ? 1 : -1;
                if (vb == null) return sortOrder === 'asc' ? -1 : 1;
                return sortOrder === 'asc' ? (va - vb) : (vb - va);
            }
            va = String(va || '').toLowerCase();
            vb = String(vb || '').toLowerCase();
            const cmp = va < vb ? -1 : va > vb ? 1 : 0;
            return sortOrder === 'asc' ? cmp : -cmp;
        });
        return list;
    }, [students, sortField, sortOrder]);

    const handleSaveStudent = async () => {
        if (!studentForm.ma_sv.trim()) return;
        try {
            setSaving(true);
            const payload = {
                ma_sv: studentForm.ma_sv.trim(),
                name: studentForm.name.trim() || null,
                ngay_sinh: studentForm.ngay_sinh.trim() || null,
                c2: studentForm.c2 ? parseFloat(studentForm.c2) : null,
                b1: studentForm.b1 ? parseFloat(studentForm.b1) : null,
                k1: studentForm.k1 ? parseFloat(studentForm.k1) : null,
                t1: studentForm.t1 ? parseFloat(studentForm.t1) : null,
                nhom_to: studentForm.nhom_to.trim() || null,
                gc_nhap_diem: studentForm.gc_nhap_diem.trim() || null
            };
            if (editStudent) {
                await authApi.put(`/score-scanning/students/${editStudent.id}`, payload);
            } else {
                await authApi.post(`/score-scanning/lists/${id}/students`, payload);
            }
            setShowStudentModal(false);
            setEditStudent(null);
            setStudentForm({ ma_sv: '', name: '', ngay_sinh: '', c2: '', b1: '', k1: '', t1: '', nhom_to: '', gc_nhap_diem: '' });
            loadStudents();
        } catch (e) {
            alert(e.response?.data?.message || 'Lỗi');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteStudent = async () => {
        if (!deleteStudent) return;
        try {
            await authApi.delete(`/score-scanning/students/${deleteStudent.id}`);
            setShowDeleteModal(false);
            setDeleteStudent(null);
            loadStudents();
        } catch (_) {}
    };

    const handleDeleteAll = async () => {
        try {
            await authApi.delete(`/score-scanning/lists/${id}/students/delete-all`);
            setShowDeleteAllModal(false);
            loadStudents();
        } catch (_) {}
    };

    const parseNum = (v) => {
        if (v == null || v === '') return null;
        const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
        return isNaN(n) ? null : n;
    };
    const parseStr = (v, max) => {
        if (v == null || v === '') return null;
        const s = String(v).trim();
        return s === '' ? null : (max ? s.slice(0, max) : s);
    };

    const parseExcelFile = (file, template) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
                    if (!rows.length) {
                        resolve([]);
                        return;
                    }
                    const students = [];

                    if (template === 'file1') {
                        // Dòng 0,1 = tiêu đề. Dữ liệu từ dòng 2. A=c2, B=b1, C=k1, D=t1, E=ma_sv, F=ma_mh, G=gc_nhap_diem, H=nhom_to
                        for (let r = 2; r < rows.length; r++) {
                            const row = rows[r] || [];
                            const ma_sv = parseStr(row[4], 50);
                            if (!ma_sv) continue;
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
                        resolve(students);
                        return;
                    }

                    if (template === 'file2') {
                        // Dòng 0,1 = tiêu đề. Dữ liệu từ dòng 2. A=c2, B=k1, C=t1, D=ma_sv, E=ma_mh, F=gc_nhap_diem, G=nhom_to. Không có KTTX (b1=null)
                        for (let r = 2; r < rows.length; r++) {
                            const row = rows[r] || [];
                            const ma_sv = parseStr(row[3], 50);
                            if (!ma_sv) continue;
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
                        resolve(students);
                        return;
                    }

                    // template === 'xuat_excel': dòng 0 = header, dữ liệu từ dòng 1
                    const headers = rows[0].map(h => (h != null ? String(h).trim() : ''));
                    const keyMap = {};
                    headers.forEach((h, i) => {
                        if (h.includes('Mã SV')) keyMap.ma_sv = i;
                        else if (h.includes('Họ') && h.includes('tên')) keyMap.name = i;
                        else if (h.includes('Ngày sinh')) keyMap.ngay_sinh = i;
                        else if (h.includes('ĐGCB')) keyMap.c2 = i;
                        else if (h.includes('KTTX')) keyMap.b1 = i;
                        else if (h.includes('KTGK')) keyMap.k1 = i;
                        else if (h === 'T1' || (h.includes('T1'))) keyMap.t1 = i;
                        else if (h.includes('Nhóm') || h === 'NhomTo') keyMap.nhom_to = i;
                        else if (h.includes('Ghi chú') || h === 'GcNhapDiem') keyMap.gc_nhap_diem = i;
                    });
                    if (keyMap.ma_sv === undefined) {
                        reject(new Error('File Excel phải có cột "Mã SV"'));
                        return;
                    }
                    for (let r = 1; r < rows.length; r++) {
                        const row = rows[r] || [];
                        const ma_sv = parseStr(row[keyMap.ma_sv], 50);
                        if (!ma_sv) continue;
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
                    resolve(students);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error('Không đọc được file'));
            reader.readAsArrayBuffer(file);
        });
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0] || null;
        setImportFile(file);
        setImportErrors([]);
        setImportSuccess('');
        setImportResult(null);
    };

    const downloadImportTemplate = () => {
        const headers = ['Mã SV', 'Họ tên', 'Ngày sinh', 'ĐGCB', 'KTTX', 'KTGK', 'T1', 'Nhóm/tổ', 'Ghi chú'];
        const ws = XLSX.utils.aoa_to_sheet([headers, []]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Danh sách');
        XLSX.writeFile(wb, 'Mau_Import_Diem.xlsx');
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
            const students = await parseExcelFile(importFile, importTemplate);
            if (students.length === 0) {
                setImportErrors(['Không tìm thấy dòng dữ liệu nào (cần có cột Mã SV và ít nhất một dòng)']);
                setImportLoading(false);
                return;
            }
            const total = students.length;
            setImportTotal(total);
            setImportProgress(0);
            progressInterval = setInterval(() => {
                setImportProgress(prev => {
                    const next = Math.min(prev + Math.max(1, Math.floor(total / 25)), Math.floor(total * 0.95));
                    if (next >= Math.floor(total * 0.95)) {
                        if (progressInterval) clearInterval(progressInterval);
                    }
                    return next;
                });
            }, 120);
            const res = await authApi.post(`/score-scanning/lists/${id}/import`, { students });
            if (progressInterval) clearInterval(progressInterval);
            setImportProgress(total);
            setImportResult(res.data);
            if (res.data.success) {
                setImportSuccess(res.data.message || `Đã import: ${res.data.added || 0} thêm mới, ${res.data.updated || 0} cập nhật.`);
                if (res.data.errors?.length) {
                    setImportErrors(res.data.errors.map(e => `${e.ma_sv || ''}: ${e.message}`));
                }
                loadStudents();
                if (importFileRef.current) importFileRef.current.value = '';
                setImportFile(null);
                if (!res.data.errors?.length) setShowImportModal(false);
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

    const EXPORT_TEMPLATES = [
        { value: 'xuat_excel', label: 'Mẫu Xuất Excel (đầy đủ)' },
        { value: 'file1', label: 'Mẫu 1 (8 cột)' },
        { value: 'file2', label: 'Mẫu 2 (7 cột)' }
    ];

    const exportExcel = async (template = 'xuat_excel') => {
        try {
            const exportSort = ['default', 'ma_sv', 'name'].includes(sortField) ? sortField : 'default';
            const res = await authApi.get(`/score-scanning/lists/${id}/export?sort=${exportSort}&template=${encodeURIComponent(template)}`, { responseType: 'blob' });
            const contentType = (res.headers && res.headers['content-type']) || '';
            const isExcel = contentType.includes('spreadsheet') || contentType.includes('octet-stream');
            if (res.status !== 200 || (!isExcel && res.data && res.data.size < 1000)) {
                let errMsg = 'File không hợp lệ hoặc lỗi từ server';
                try {
                    const text = await (res.data instanceof Blob ? res.data.text() : Promise.resolve(String(res.data)));
                    if (text && text.startsWith('{')) {
                        const j = JSON.parse(text);
                        if (j && j.message) errMsg = j.message;
                    }
                } catch (_) {}
                alert(errMsg);
                return;
            }
            const slug = (list?.name || 'danhsach')
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '').toLowerCase() || 'danhsach';
            const maMh = ((list?.ma_mh || list?.maMh) || '').replace(/[^a-zA-Z0-9]/g, '') || 'NONE';
            const now = new Date();
            const pad = n => String(n).padStart(2, '0');
            const ts = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getDate())}${pad(now.getMonth() + 1)}${now.getFullYear()}`;
            const filename = `Danhsachdiem_${slug}_${maMh}_${ts}.xlsx`;
            const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (e) {
            alert(e.response?.data?.message || 'Không thể xuất file');
        }
    };

    const openAddStudent = () => {
        setEditStudent(null);
        setStudentForm({ ma_sv: '', name: '', ngay_sinh: '', c2: '', b1: '', k1: '', t1: '', nhom_to: '', gc_nhap_diem: '' });
        setShowStudentModal(true);
    };

    const openEditStudent = (s) => {
        setEditStudent(s);
        setStudentForm({
            ma_sv: s.ma_sv,
            name: s.name || '',
            ngay_sinh: s.ngay_sinh || '',
            c2: s.c2 ?? '',
            b1: s.b1 ?? '',
            k1: s.k1 ?? '',
            t1: s.t1 ?? '',
            nhom_to: s.nhom_to || '',
            gc_nhap_diem: s.gc_nhap_diem || ''
        });
        setShowStudentModal(true);
    };

    const currentIsMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    const maMh = list?.ma_mh || list?.maMh;

    return (
        <div>
            {/* Header Section */}
            <div className="session-header">
                <div className="header-content">
                    <div className="header-title">
                        <h1 className="mb-0">{list?.name || 'Đang tải...'}{maMh && <Badge bg="light" text="dark" className="ms-2">{maMh}</Badge>}</h1>
                        <p className="header-subtitle mb-0">Quản lý sinh viên và điểm trong danh sách</p>
                    </div>
                    <div className="header-actions">
                        <Button
                            variant="outline-light"
                            className="create-session-btn"
                            onClick={() => navigate(`/score-scanning/capture/${id}`)}
                        >
                            <i className="fas fa-camera"></i>
                            Chụp ảnh nhận diện
                        </Button>
                        <Button
                            variant="outline-light"
                            className="create-session-btn"
                            onClick={openAddStudent}
                        >
                            <i className="fas fa-plus"></i>
                            Thêm SV
                        </Button>
                        <Dropdown className="d-inline">
                            <Dropdown.Toggle variant="outline-light" className="create-session-btn" id="export-excel-dropdown">
                                <i className="fas fa-file-excel"></i>
                                Xuất Excel
                            </Dropdown.Toggle>
                            <Dropdown.Menu align="end">
                                {EXPORT_TEMPLATES.map(t => (
                                    <Dropdown.Item key={t.value} onClick={() => exportExcel(t.value)}>
                                        {t.label}
                                    </Dropdown.Item>
                                ))}
                            </Dropdown.Menu>
                        </Dropdown>
                        <Button
                            variant="outline-light"
                            className="create-session-btn"
                            onClick={() => {
                                setShowImportModal(true);
                                setImportResult(null);
                                setImportFile(null);
                                setImportErrors([]);
                                setImportSuccess('');
                                setImportProgress(0);
                                setImportTotal(0);
                                if (importFileRef.current) importFileRef.current.value = '';
                            }}
                        >
                            <i className="fas fa-file-import"></i>
                            Import
                        </Button>
                        <Button
                            variant="outline-light"
                            className="create-session-btn"
                            onClick={() => setShowDeleteAllModal(true)}
                        >
                            <i className="fas fa-trash-alt"></i>
                            Xóa tất cả
                        </Button>
                        <Button
                            variant="outline-light"
                            className="create-session-btn"
                            onClick={() => navigate('/score-scanning')}
                        >
                            <i className="fas fa-arrow-left"></i>
                            Quay lại
                        </Button>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <Row className="mb-4">
                <Col md={3}>
                    <div className="session-card">
                        <div className="card-header-modern"><h6 className="mb-0">Tổng SV</h6></div>
                        <div className="card-body-modern"><h4 className="mb-0">{stats.total}</h4></div>
                    </div>
                </Col>
                <Col md={3}>
                    <div className="session-card">
                        <div className="card-header-modern"><h6 className="mb-0">Điểm TB TKHP</h6></div>
                        <div className="card-body-modern"><h4 className="mb-0">{stats.avg}</h4></div>
                    </div>
                </Col>
                <Col md={3}>
                    <div className="session-card">
                        <div className="card-header-modern"><h6 className="mb-0">Đạt (≥5)</h6></div>
                        <div className="card-body-modern"><h4 className="mb-0 text-success">{stats.pass}</h4></div>
                    </div>
                </Col>
                <Col md={3}>
                    <div className="session-card">
                        <div className="card-header-modern"><h6 className="mb-0">Không đạt</h6></div>
                        <div className="card-body-modern"><h4 className="mb-0 text-danger">{stats.fail}</h4></div>
                    </div>
                </Col>
            </Row>

            {/* Search and Filter Controls */}
            <div className="session-list-controls">
                <div className="search-controls w-100">
                    <div className="search-input w-100">
                        <input
                            type="text"
                            placeholder="Tìm mã SV hoặc họ tên..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="search-input w-100"
                            style={{ width: '100%' }}
                        />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="session-table-container">
                <div className="table-responsive-mobile">
                    <table className="table session-table students-table">
                        <thead>
                            <tr>
                                <th className={currentIsMobile ? 'mobile-essential' : 'mobile-hide'}>#</th>
                                <th
                                    onClick={() => handleSort('ma_sv')}
                                    style={{ cursor: 'pointer' }}
                                    className="text-nowrap mobile-essential"
                                >
                                    Mã SV {sortField === 'ma_sv' && (
                                        <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                                    )}
                                </th>
                                <th
                                    onClick={() => handleSort('name')}
                                    style={{ cursor: 'pointer' }}
                                    className="text-nowrap mobile-essential"
                                >
                                    Họ tên {sortField === 'name' && (
                                        <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                                    )}
                                </th>
                                <th
                                    onClick={() => handleSort('ngay_sinh')}
                                    style={{ cursor: 'pointer' }}
                                    className={currentIsMobile ? 'mobile-hide' : ''}
                                >
                                    Ngày sinh {sortField === 'ngay_sinh' && (
                                        <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                                    )}
                                </th>
                                <th className="text-nowrap mobile-essential">Mã MH</th>
                                <th
                                    onClick={() => handleSort('c2')}
                                    style={{ cursor: 'pointer' }}
                                    className="text-center text-nowrap mobile-essential"
                                >
                                    ĐGCB <span className="text-muted small">(C2)</span> {sortField === 'c2' && (
                                        <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                                    )}
                                </th>
                                <th
                                    onClick={() => handleSort('b1')}
                                    style={{ cursor: 'pointer' }}
                                    className="text-center text-nowrap mobile-essential"
                                >
                                    KTTX <span className="text-muted small">(B1)</span> {sortField === 'b1' && (
                                        <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                                    )}
                                </th>
                                <th
                                    onClick={() => handleSort('k1')}
                                    style={{ cursor: 'pointer' }}
                                    className="text-center text-nowrap mobile-essential"
                                >
                                    KTGK <span className="text-muted small">(K1)</span> {sortField === 'k1' && (
                                        <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                                    )}
                                </th>
                                <th
                                    onClick={() => handleSort('t1')}
                                    style={{ cursor: 'pointer' }}
                                    className="text-center text-nowrap mobile-essential"
                                >
                                    T1 {sortField === 't1' && (
                                        <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                                    )}
                                </th>
                                <th
                                    onClick={() => handleSort('diem_tkhp')}
                                    style={{ cursor: 'pointer' }}
                                    className="text-center text-nowrap mobile-essential"
                                >
                                    TKHP {sortField === 'diem_tkhp' && (
                                        <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                                    )}
                                </th>
                                <th className="mobile-essential">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="11" className="text-center py-5">
                                        <Spinner animation="border" size="sm" className="me-2" />
                                        Đang tải...
                                    </td>
                                </tr>
                            ) : sortedStudents.length === 0 ? (
                                <tr>
                                    <td colSpan="11" className="text-center py-5 text-muted">
                                        <i className="fas fa-users fa-2x mb-2"></i>
                                        <p className="mb-0">Chưa có sinh viên</p>
                                        <p className="mb-0 small">Thêm thủ công hoặc chụp ảnh để nhận diện</p>
                                    </td>
                                </tr>
                            ) : (
                                sortedStudents.map((s, i) => (
                                    <tr key={s.id}>
                                        <td className={currentIsMobile ? 'mobile-essential' : 'mobile-hide'}>
                                            {i + 1}
                                        </td>
                                        <td className="mobile-essential"><strong>{s.ma_sv}</strong></td>
                                        <td className="mobile-essential">{s.name || '-'}</td>
                                        <td className={currentIsMobile ? 'mobile-hide' : ''}>{s.ngay_sinh || '-'}</td>
                                        <td className="mobile-essential">{maMh || '-'}</td>
                                        <td className="text-center mobile-essential">{s.c2 != null ? s.c2 : '-'}</td>
                                        <td className="text-center mobile-essential">{s.b1 != null ? s.b1 : '-'}</td>
                                        <td className="text-center mobile-essential">{s.k1 != null ? s.k1 : '-'}</td>
                                        <td className="text-center mobile-essential">{s.t1 != null ? s.t1 : '-'}</td>
                                        <td className={`text-center mobile-essential ${s.diem_tkhp != null ? (s.diem_tkhp >= 5 ? 'text-success fw-bold' : 'text-danger fw-bold') : ''}`}>
                                            {s.diem_tkhp != null ? s.diem_tkhp : '-'}
                                        </td>
                                        <td className="mobile-essential">
                                            <div className="action-buttons d-flex gap-1">
                                                <Button
                                                    variant="outline-primary"
                                                    size="sm"
                                                    className="btn-icon"
                                                    onClick={() => openEditStudent(s)}
                                                    title="Chỉnh sửa"
                                                >
                                                    <i className="fas fa-edit"></i>
                                                </Button>
                                                <Button
                                                    variant="outline-danger"
                                                    size="sm"
                                                    className="btn-icon"
                                                    onClick={() => { setDeleteStudent(s); setShowDeleteModal(true); }}
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
            </div>

            {/* Student Modal */}
            <Modal show={showStudentModal} onHide={() => setShowStudentModal(false)} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>{editStudent ? 'Sửa sinh viên' : 'Thêm sinh viên'}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Row>
                        <Col md={4}>
                            <Form.Group className="mb-2">
                                <Form.Label>Mã SV *</Form.Label>
                                <Form.Control
                                    value={studentForm.ma_sv}
                                    onChange={e => setStudentForm(f => ({ ...f, ma_sv: e.target.value }))}
                                    disabled={!!editStudent}
                                />
                            </Form.Group>
                        </Col>
                        <Col md={5}>
                            <Form.Group className="mb-2">
                                <Form.Label>Họ tên</Form.Label>
                                <Form.Control
                                    value={studentForm.name}
                                    onChange={e => setStudentForm(f => ({ ...f, name: e.target.value }))}
                                />
                            </Form.Group>
                        </Col>
                        <Col md={3}>
                            <Form.Group className="mb-2">
                                <Form.Label>Ngày sinh</Form.Label>
                                <Form.Control
                                    value={studentForm.ngay_sinh}
                                    onChange={e => setStudentForm(f => ({ ...f, ngay_sinh: e.target.value }))}
                                    placeholder="DD/MM/YYYY"
                                />
                            </Form.Group>
                        </Col>
                        <Col md={3}>
                            <Form.Group className="mb-2">
                                <Form.Label>ĐGCB (10%)</Form.Label>
                                <Form.Control
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="10"
                                    value={studentForm.c2}
                                    onChange={e => setStudentForm(f => ({ ...f, c2: e.target.value }))}
                                />
                            </Form.Group>
                        </Col>
                        <Col md={3}>
                            <Form.Group className="mb-2">
                                <Form.Label>KTTX (15%)</Form.Label>
                                <Form.Control
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="10"
                                    value={studentForm.b1}
                                    onChange={e => setStudentForm(f => ({ ...f, b1: e.target.value }))}
                                />
                            </Form.Group>
                        </Col>
                        <Col md={3}>
                            <Form.Group className="mb-2">
                                <Form.Label>KTGK (25%)</Form.Label>
                                <Form.Control
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="10"
                                    value={studentForm.k1}
                                    onChange={e => setStudentForm(f => ({ ...f, k1: e.target.value }))}
                                />
                            </Form.Group>
                        </Col>
                        <Col md={3}>
                            <Form.Group className="mb-2">
                                <Form.Label>T1 (50%)</Form.Label>
                                <Form.Control
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="10"
                                    value={studentForm.t1}
                                    onChange={e => setStudentForm(f => ({ ...f, t1: e.target.value }))}
                                />
                            </Form.Group>
                        </Col>
                    </Row>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowStudentModal(false)}>Hủy</Button>
                    <Button variant="primary" onClick={handleSaveStudent} disabled={saving}>
                        {saving ? <Spinner size="sm" animation="border" /> : 'Lưu'}
                    </Button>
                </Modal.Footer>
            </Modal>

            <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Xác nhận xóa</Modal.Title>
                </Modal.Header>
                <Modal.Body>Xóa sinh viên "<strong>{deleteStudent?.ma_sv}</strong>"?</Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>Hủy</Button>
                    <Button variant="danger" onClick={handleDeleteStudent}>
                        <i className="fas fa-trash me-1"></i>Xóa
                    </Button>
                </Modal.Footer>
            </Modal>

            <Modal show={showDeleteAllModal} onHide={() => setShowDeleteAllModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Xác nhận xóa tất cả</Modal.Title>
                </Modal.Header>
                <Modal.Body>Xóa TẤT CẢ {students.length} sinh viên? Hành động không thể hoàn tác.</Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowDeleteAllModal(false)}>Hủy</Button>
                    <Button variant="danger" onClick={handleDeleteAll}>
                        <i className="fas fa-trash me-1"></i>Xóa tất cả
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Import Excel Modal - thiết kế giống UserManagement "Nhập danh sách sinh viên từ Excel" */}
            <Modal show={showImportModal} onHide={() => { setShowImportModal(false); setImportResult(null); setImportErrors([]); setImportSuccess(''); }} size="lg" className="student-detail-modal">
                <Modal.Header closeButton className="student-detail-header">
                    <Modal.Title className="student-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-file-import"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Nhập danh sách điểm từ Excel</h4>
                            <p className="mb-0 student-subtitle">Import dữ liệu điểm sinh viên hàng loạt</p>
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
                                            <i className="fas fa-users me-2"></i>
                                            Đang xử lý
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
                                            <i className="fas fa-list me-2"></i>
                                            Mẫu file Import
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
                                            <i className="fas fa-upload me-2"></i>
                                            File Excel
                                        </Form.Label>
                                        <Form.Control
                                            ref={importFileRef}
                                            type="file"
                                            accept=".xlsx, .xls"
                                            onChange={handleFileChange}
                                            className="form-control-modern"
                                        />
                                        <Form.Text className="text-muted mt-2">
                                            <i className="fas fa-info-circle me-1"></i>
                                            File Excel (.xlsx, .xls). Mẫu 1/2: chỉ cần Mã SV, hệ thống sẽ lấy Họ tên & Ngày sinh từ danh sách user.
                                        </Form.Text>
                                    </Form.Group>

                                    <div className="d-flex justify-content-between align-items-center">
                                        <Button
                                            variant="outline-primary"
                                            onClick={downloadImportTemplate}
                                            className="btn-download-template"
                                        >
                                            <i className="fas fa-download me-2"></i>
                                            Tải mẫu Excel
                                        </Button>
                                        <div className="d-flex gap-2">
                                            <Button
                                                variant="outline-secondary"
                                                onClick={() => setShowImportModal(false)}
                                                className="btn-cancel"
                                            >
                                                <i className="fas fa-times me-2"></i>
                                                Hủy
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

export default ScoreListDetail;
