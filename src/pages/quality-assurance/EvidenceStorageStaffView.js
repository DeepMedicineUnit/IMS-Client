import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Container, Row, Col, Card, Table, Button, Badge, Alert, Spinner, Modal, Form } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import '../../styles/user.css';
import { getApiBaseURL } from '../../utils/api';

const EvidenceStorageStaffView = () => {
    const { api } = useAuth();
    const { showAlert } = useAlert();
    const [assignments, setAssignments] = useState([]);
    const [selectedAssignment, setSelectedAssignment] = useState(null);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [files, setFiles] = useState([]);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [showFilePreview, setShowFilePreview] = useState(false);
    const [previewFile, setPreviewFile] = useState(null);
    const [previewError, setPreviewError] = useState('');
    const [pdfState, setPdfState] = useState({ loading: false });
    const [showConfirmSubmitModal, setShowConfirmSubmitModal] = useState(false);

    // Tạo danh mục mới (tự gán + có thể nộp file luôn)
    const [showCreateCategoryModal, setShowCreateCategoryModal] = useState(false);
    const [createCategoryForm, setCreateCategoryForm] = useState({ code: '', name: '', description: '' });
    const [createCategoryFiles, setCreateCategoryFiles] = useState([]);
    const [createCategoryLoading, setCreateCategoryLoading] = useState(false);
    const [createCategoryError, setCreateCategoryError] = useState('');

    // Filters
    const [filters, setFilters] = useState({
        searchCode: '',
        searchName: '',
        createdBy: '',
        status: '',
        dateFrom: '',
        dateTo: ''
    });

    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        fetchMyAssignments();
        return () => { isMountedRef.current = false; };
    }, []);

    // Refetch dưới nền khi có dữ liệu mới (không bật loading, không toast) — dùng sau mutation hoặc khi quay lại tab
    const fetchMyAssignmentsSilent = async () => {
        try {
            const response = await api.get('/quality-assurance/my-assignments');
            if (isMountedRef.current && response.data?.success && Array.isArray(response.data.data)) {
                setAssignments(response.data.data);
            }
        } catch (err) {
            if (process.env.NODE_ENV === 'development') {
                console.warn('EvidenceStorageStaffView fetchMyAssignmentsSilent:', err?.message);
            }
        }
    };

    const fetchMyAssignments = async () => {
        try {
            setLoading(true);
            const response = await api.get('/quality-assurance/my-assignments');
            if (response.data?.success && Array.isArray(response.data.data)) {
                setAssignments(response.data.data);
            }
        } catch (err) {
            console.error('Error fetching assignments:', err);
        } finally {
            setLoading(false);
        }
    };

    // Khi user quay lại tab → refetch một lần để lấy dữ liệu mới từ API (không theo chu kỳ giây/phút)
    useEffect(() => {
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchMyAssignmentsSilent();
            }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    }, []);

    const fetchSubmissionFiles = async (submissionId) => {
        try {
            const response = await api.get(`/quality-assurance/submissions/${submissionId}/files`);
            if (response.data.success) {
                setFiles(response.data.data);
            }
        } catch (err) {
            console.error('Error fetching files:', err);
        }
    };

    const handleOpenUpload = async (assignment) => {
        setSelectedAssignment(assignment);
        
        // If submission exists, fetch files
        if (assignment.submission_id) {
            await fetchSubmissionFiles(assignment.submission_id);
        } else {
            setFiles([]);
        }
        
        setShowUploadModal(true);
    };

    const handleFileSelect = (e) => {
        const newFiles = Array.from(e.target.files || []);
        setSelectedFiles(prev => [...prev, ...newFiles]);
        e.target.value = '';
    };

    const removeSelectedFile = (index) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const uploadSelectedFilesToServer = async () => {
        if (selectedFiles.length === 0) return true;
        let submissionId = selectedAssignment.submission_id;
        if (!submissionId) {
            const response = await api.post('/quality-assurance/submissions', {
                categoryId: selectedAssignment.category_id,
                status: 'draft'
            });
            if (response.data.success) submissionId = response.data.data.submissionId;
        }
        const formData = new FormData();
        formData.append('submissionId', submissionId);
        selectedFiles.forEach(file => formData.append('files', file));
        const uploadResponse = await api.post('/quality-assurance/submissions/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        if (!uploadResponse.data.success) throw new Error(uploadResponse.data?.message || 'Upload thất bại');
        setSelectedFiles([]);
        await fetchSubmissionFiles(submissionId);
        await fetchMyAssignmentsSilent();
        setTimeout(() => fetchMyAssignmentsSilent(), 500);
        setTimeout(() => fetchMyAssignmentsSilent(), 1200);
        return true;
    };

    const handleDeleteFile = async (fileId) => {
        if (!window.confirm('Bạn có chắc muốn xóa file này?')) return;

        try {
            await api.delete(`/quality-assurance/files/${fileId}`);
            showAlert('Xóa file thành công!', 'success');
            await fetchSubmissionFiles(selectedAssignment.submission_id);
            await fetchMyAssignmentsSilent();
            setTimeout(() => fetchMyAssignmentsSilent(), 500);
            setTimeout(() => fetchMyAssignmentsSilent(), 1200);
        } catch (err) {
            showAlert(err.response?.data?.message || 'Có lỗi khi xóa file', 'danger');
        }
    };

    const handleSubmitClick = () => {
        const totalFiles = files.length + selectedFiles.length;
        if (totalFiles === 0) {
            showAlert('Vui lòng chọn ít nhất một file trước khi gửi', 'warning');
            return;
        }
        setShowConfirmSubmitModal(true);
    };

    const doSubmitEvidence = async () => {
        setShowConfirmSubmitModal(false);
        try {
            setUploading(true);
            if (selectedFiles.length > 0) await uploadSelectedFilesToServer();
            await api.post('/quality-assurance/submissions', {
                categoryId: selectedAssignment.category_id,
                status: 'submitted'
            });
            showAlert('Gửi minh chứng thành công!', 'success');
            setShowUploadModal(false);
            await fetchMyAssignmentsSilent();
            setTimeout(() => fetchMyAssignmentsSilent(), 500);
            setTimeout(() => fetchMyAssignmentsSilent(), 1200);
        } catch (err) {
            showAlert(err.response?.data?.message || err.message || 'Có lỗi khi gửi minh chứng', 'danger');
        } finally {
            setUploading(false);
        }
    };

    const getStatusBadge = (status) => {
        if (!status) return <Badge bg="secondary">Chưa nộp</Badge>;
        
        const badges = {
            draft: { variant: 'secondary', text: 'Nháp' },
            submitted: { variant: 'warning', text: 'Đã gửi' },
            approved: { variant: 'success', text: 'Đáp ứng' },
            needs_revision: { variant: 'danger', text: 'Chỉnh sửa' }
        };
        const badge = badges[status] || badges.draft;
        return <Badge bg={badge.variant}>{badge.text}</Badge>;
    };

    // Helper function to determine file icon
    const getFileIcon = (fileType) => {
        if (!fileType) return 'fas fa-file';
        
        const type = fileType.toLowerCase();
        if (type === 'pdf') return 'fas fa-file-pdf';
        if (['doc', 'docx'].includes(type)) return 'fas fa-file-word';
        if (['xls', 'xlsx'].includes(type)) return 'fas fa-file-excel';
        if (['ppt', 'pptx'].includes(type)) return 'fas fa-file-powerpoint';
        if (['jpg', 'jpeg', 'png', 'gif'].includes(type)) return 'fas fa-file-image';
        if (['zip', 'rar'].includes(type)) return 'fas fa-file-archive';
        
        return 'fas fa-file';
    };

    // Helper function to format bytes
    const formatBytes = (bytes, decimals = 2) => {
        if (!bytes || bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    const getUploadsBaseURL = () => {
        // getApiBaseURL() returns something like http(s)://host:8043/api (production)
        // We need http(s)://host:8043 for /uploads/*
        const apiBase = getApiBaseURL();
        return apiBase.endsWith('/api') ? apiBase.slice(0, -4) : apiBase;
    };

    const getAbsoluteFileUrl = (filePath) => {
        try {
            // filePath should be like "/uploads/evidence/evidence-1234567890-123456789.pdf"
            // Normalize the path
            const cleanPath = filePath.startsWith('/') ? filePath : `/${filePath}`;
            const baseUrl = getUploadsBaseURL();
            
            // Remove trailing slash from base if present
            const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
            
            // Check if path contains already-encoded characters (double-encoding issue)
            // If it does, decode first, then let URL constructor encode properly
            let normalizedPath = cleanPath;
            if (cleanPath.includes('%')) {
                try {
                    // Try to decode - if it succeeds, we had double-encoding
                    const decoded = decodeURIComponent(cleanPath);
                    // Only use decoded if it's different and doesn't contain invalid characters
                    if (decoded !== cleanPath && !decoded.includes('%')) {
                        normalizedPath = decoded;
                    }
                } catch (e) {
                    // Decode failed, use original path
                    normalizedPath = cleanPath;
                }
            }
            
            // Use URL constructor - it will properly encode the path components
            // For paths starting with /, URL constructor treats them as absolute paths relative to base origin
            const url = new URL(normalizedPath, base);
            return url.toString();
        } catch (e) {
            console.error('[EvidenceStorageStaffView] Error constructing file URL:', e, 'filePath:', filePath);
            // Fallback: manual encoding
            const base = getUploadsBaseURL().endsWith('/') ? getUploadsBaseURL().slice(0, -1) : getUploadsBaseURL();
            const path = filePath.startsWith('/') ? filePath : `/${filePath}`;
            // Manually encode path segments to avoid double-encoding
            const encodedPath = path.split('/').map(segment => {
                // Don't encode slashes, but encode each segment
                if (!segment) return '';
                try {
                    // If segment is already encoded, decode first
                    if (segment.includes('%')) {
                        segment = decodeURIComponent(segment);
                    }
                    return encodeURIComponent(segment);
                } catch {
                    return segment;
                }
            }).join('/');
            return `${base}${encodedPath}`;
        }
    };

    const handlePreviewFile = async (file) => {
        setPreviewError('');
        setPreviewFile(file);
        setShowFilePreview(true);
        setPdfState({ loading: true });

        // Pre-check file existence for PDFs
        if (file.file_type === 'pdf') {
            try {
                const absoluteUrl = getAbsoluteFileUrl(file.file_path);
                const res = await fetch(absoluteUrl, { 
                    method: 'HEAD',
                    mode: 'cors'
                });
                if (!res.ok) {
                    setPreviewError(`Đường dẫn "${absoluteUrl}" không tồn tại hoặc đã bị xóa (HTTP ${res.status}).`);
                    setPdfState({ loading: false });
                    return;
                }
                setPdfState({ loading: false });
            } catch (e) {
                console.error('[EvidenceStorageStaffView] Pre-check fetch error:', e);
                setPdfState({ loading: false });
                // Let embed handle it
            }
        } else {
            setPdfState({ loading: false });
        }
    };

    // Parse template_url: may be single URL string or JSON array string
    const getTemplateUrls = (assignment) => {
        const raw = assignment?.template_url;
        if (!raw) return [];
        const s = String(raw).trim();
        if (s.startsWith('[')) {
            try {
                const arr = JSON.parse(s);
                return Array.isArray(arr) ? arr : [raw];
            } catch (_) {
                return [raw];
            }
        }
        return [raw];
    };

    const getFirstTemplateUrl = (assignment) => {
        const urls = getTemplateUrls(assignment);
        return urls.length > 0 ? urls[0] : null;
    };

    const templateUrlToFile = (url) => {
        const fileName = url.split('/').pop() || 'File mẫu';
        const fileType = fileName.split('.').pop()?.toLowerCase() || '';
        return { file_name: fileName, file_path: url, file_type: fileType };
    };

    const handlePreviewTemplateFile = (fileObj) => {
        if (!fileObj?.file_path) return;
        handlePreviewFile(fileObj);
    };

    const handlePreviewTemplateFileFromAssignment = (assignment) => {
        const url = getFirstTemplateUrl(assignment);
        if (!url) return;
        
        // Extract file name from URL
        const fileName = url.split('/').pop() || 'File mẫu';
        const fileType = fileName.split('.').pop()?.toLowerCase() || '';
        
        // Create a file-like object for preview
        const templateFile = {
            file_name: fileName,
            file_path: url,
            file_type: fileType
        };
        
        handlePreviewFile(templateFile);
    };

    const openCreateCategoryModal = () => {
        setCreateCategoryError('');
        setCreateCategoryForm({ code: '', name: '', description: '' });
        setCreateCategoryFiles([]);
        setShowCreateCategoryModal(true);
    };

    const handleCreateCategoryFileSelect = (e) => {
        const newFiles = Array.from(e.target.files || []);
        setCreateCategoryFiles(prev => [...prev, ...newFiles]);
        e.target.value = '';
    };

    const removeCreateCategoryFile = (index) => {
        setCreateCategoryFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleCreateCategorySubmit = async (e) => {
        e.preventDefault();
        setCreateCategoryError('');
        const { code, name, description } = createCategoryForm;
        if (!code?.trim() || !name?.trim()) {
            setCreateCategoryError('Mã và tên danh mục là bắt buộc.');
            return;
        }
        try {
            setCreateCategoryLoading(true);
            const res = await api.post('/quality-assurance/categories/propose', {
                code: code.trim(),
                name: name.trim(),
                description: description?.trim() || ''
            });
            if (!res.data?.success) {
                setCreateCategoryError(res.data?.message || 'Không thể tạo danh mục.');
                return;
            }
            const categoryId = res.data.data?.id;
            if (createCategoryFiles.length > 0 && categoryId) {
                const subRes = await api.post('/quality-assurance/submissions', {
                    categoryId,
                    status: 'submitted'
                });
                const submissionId = subRes.data?.data?.submissionId;
                if (submissionId) {
                    const formData = new FormData();
                    formData.append('submissionId', submissionId);
                    createCategoryFiles.forEach(file => formData.append('files', file));
                    await api.post('/quality-assurance/submissions/upload', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
                }
            }
            showAlert(res.data.message || 'Đã tạo danh mục và gán bạn phụ trách!' + (createCategoryFiles.length > 0 ? ' Bài nộp đã gửi tới Admin/Mod.' : ''), 'success');
            setShowCreateCategoryModal(false);
            await fetchMyAssignmentsSilent();
            setTimeout(() => fetchMyAssignmentsSilent(), 500);
            setTimeout(() => fetchMyAssignmentsSilent(), 1200);
        } catch (err) {
            setCreateCategoryError(err.response?.data?.message || 'Có lỗi khi tạo danh mục hoặc nộp file.');
        } finally {
            setCreateCategoryLoading(false);
        }
    };

    // Get unique creators for filter dropdown
    const uniqueCreators = useMemo(() => {
        if (!Array.isArray(assignments) || assignments.length === 0) return [];
        const creators = assignments
            .map(a => a.category_created_by_name)
            .filter(name => name && name.trim() !== '');
        return [...new Set(creators)].sort();
    }, [assignments]);

    // Filter assignments
    const filteredAssignments = useMemo(() => {
        let filtered = assignments;

        // Filter by code
        if (filters.searchCode.trim()) {
            const codeTerm = filters.searchCode.toLowerCase();
            filtered = filtered.filter(a => 
                (a.code || '').toLowerCase().includes(codeTerm)
            );
        }

        // Filter by name
        if (filters.searchName.trim()) {
            const nameTerm = filters.searchName.toLowerCase();
            filtered = filtered.filter(a => 
                (a.name || '').toLowerCase().includes(nameTerm)
            );
        }

        // Filter by creator
        if (filters.createdBy) {
            filtered = filtered.filter(a => 
                a.category_created_by_name === filters.createdBy
            );
        }

        // Filter by status
        if (filters.status) {
            filtered = filtered.filter(a => {
                if (filters.status === 'none') {
                    return !a.submission_status;
                }
                return a.submission_status === filters.status;
            });
        }

        // Filter by date range (category_created_at)
        if (filters.dateFrom) {
            const fromDate = new Date(filters.dateFrom);
            fromDate.setHours(0, 0, 0, 0);
            filtered = filtered.filter(a => {
                if (!a.category_created_at) return false;
                const createdDate = new Date(a.category_created_at);
                createdDate.setHours(0, 0, 0, 0);
                return createdDate >= fromDate;
            });
        }

        if (filters.dateTo) {
            const toDate = new Date(filters.dateTo);
            toDate.setHours(23, 59, 59, 999);
            filtered = filtered.filter(a => {
                if (!a.category_created_at) return false;
                const createdDate = new Date(a.category_created_at);
                createdDate.setHours(0, 0, 0, 0);
                return createdDate <= toDate;
            });
        }

        return filtered;
    }, [assignments, filters]);

    if (loading) {
        return (
            <Container className="mt-4">
                <div className="text-center py-5">
                    <Spinner animation="border" variant="primary" />
                    <p className="mt-3">Đang tải...</p>
                </div>
            </Container>
        );
    }

    return (
        <div>
            <div className="session-header">
                <div className="header-content d-flex flex-wrap align-items-center justify-content-between gap-3">
                    <div className="header-title">
                        <h1>Lưu trữ minh chứng CSGD</h1>
                        <p className="header-subtitle">Cập nhật file minh chứng và gửi minh chứng theo phân công</p>
                    </div>
                    <Button
                        variant="outline-light"
                        className="create-session-btn"
                        onClick={openCreateCategoryModal}
                    >
                        <i className="fas fa-plus me-2"></i>
                        Tạo danh mục mới
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div className="session-list-controls">
                <div className="search-controls">
                    <div className="search-input" style={{ minWidth: '200px', flex: '1' }}>
                        <input
                            type="text"
                            placeholder="Tìm theo mã..."
                            value={filters.searchCode}
                            onChange={(e) => setFilters({ ...filters, searchCode: e.target.value })}
                            style={{ width: '100%' }}
                        />
                    </div>

                    <div className="search-input" style={{ minWidth: '200px', flex: '1' }}>
                        <input
                            type="text"
                            placeholder="Tìm theo tên minh chứng..."
                            value={filters.searchName}
                            onChange={(e) => setFilters({ ...filters, searchName: e.target.value })}
                            style={{ width: '100%' }}
                        />
                    </div>

                    <select
                        className="filter-select"
                        value={filters.createdBy}
                        onChange={(e) => setFilters({ ...filters, createdBy: e.target.value })}
                    >
                        <option value="">Tất cả người tạo</option>
                        {uniqueCreators.map((creator) => (
                            <option key={creator} value={creator}>
                                {creator}
                            </option>
                        ))}
                    </select>

                    <select
                        className="filter-select"
                        value={filters.status}
                        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    >
                        <option value="">Tất cả trạng thái</option>
                        <option value="none">Chưa nộp</option>
                        <option value="draft">Nháp</option>
                        <option value="submitted">Đã gửi</option>
                        <option value="approved">Đáp ứng</option>
                        <option value="needs_revision">Chỉnh sửa</option>
                    </select>
                    
                    <input
                        type="datetime-local"
                        className="filter-select"
                        placeholder="Từ ngày giờ"
                        value={filters.dateFrom}
                        onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                        style={{ minWidth: '180px' }}
                    />

                    <input
                        type="datetime-local"
                        className="filter-select"
                        placeholder="Đến ngày giờ"
                        value={filters.dateTo}
                        onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                        style={{ minWidth: '180px' }}
                    />
                </div>
            </div>

        <Container fluid className="mt-4">
                    <div className="session-table-container">
                        <div className="table-responsive-mobile">
                            <table className="session-table staff-table">
                                <thead>
                                    <tr>
                                        <th>Mã</th>
                                        <th>Tên minh chứng</th>
                                        <th>Mô tả</th>
                                        <th>Người tạo</th>
                                        <th>Thời gian tạo</th>
                                        <th>Hạn nộp</th>
                                        <th className="text-center">File mẫu</th>
                                        <th style={{ minWidth: '200px', width: '25%' }}>Phản hồi</th>
                                        <th>Trạng thái</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAssignments.length === 0 ? (
                                        <tr>
                                            <td colSpan="9" className="text-center text-muted py-4">
                                                {assignments.length === 0 
                                                    ? 'Chưa có minh chứng nào được gán cho bạn'
                                                    : 'Không có kết quả phù hợp với bộ lọc'}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredAssignments.map((assignment) => {
                                            const canEdit = !assignment.submission_status || 
                                                          assignment.submission_status === 'draft' || 
                                                          assignment.submission_status === 'needs_revision';
                                            const isNotSubmitted = !assignment.submission_status;
                                            const dueAt = assignment.due_at ? new Date(assignment.due_at) : null;
                                            const isOverdue = dueAt && new Date() > dueAt && assignment.submission_status !== 'approved';
                                            
                                            return (
                                                <tr 
                                                    key={assignment.id}
                                                    className={isNotSubmitted ? 'not-submitted-row' : ''}
                                                    onClick={() => handleOpenUpload(assignment)}
                                                    style={{ cursor: 'pointer' }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.backgroundColor = '#f8f9fa';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.backgroundColor = '';
                                                    }}
                                                >
                                                    <td><strong>{assignment.code}</strong></td>
                                                    <td>{assignment.name}</td>
                                                    <td>
                                                        {assignment.description || '-'}
                                                    </td>
                                                    <td>{assignment.category_created_by_name || <span className="text-muted">—</span>}</td>
                                                    <td>
                                                        {assignment.category_created_at ? (
                                                            <div style={{ fontSize: '0.9rem', color: '#495057' }}>
                                                                {new Date(assignment.category_created_at).toLocaleString('vi-VN')}
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted">-</span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        {dueAt ? (
                                                            <div>
                                                                <span style={{ fontSize: '0.9rem', color: isOverdue ? '#dc3545' : '#495057' }}>
                                                                    {dueAt.toLocaleString('vi-VN')}
                                                                </span>
                                                                {isOverdue && (
                                                                    <Badge bg="danger" className="ms-1">Quá hạn</Badge>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted">—</span>
                                                        )}
                                                    </td>
                                                    <td className="text-center">
                                                        {getTemplateUrls(assignment).length > 0 ? (
                                                            <Badge bg="secondary">{getTemplateUrls(assignment).length}</Badge>
                                                        ) : (
                                                            <span className="text-muted">-</span>
                                                        )}
                                                    </td>
                                                    <td style={{ wordWrap: 'break-word', maxWidth: '300px' }}>
                                                        {assignment.review_notes ? (
                                                            <div 
                                                                style={{ 
                                                                    fontSize: '0.9rem',
                                                                    color: '#495057',
                                                                    lineHeight: '1.5'
                                                                }}
                                                            >
                                                                {assignment.review_notes}
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted">-</span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        {getStatusBadge(assignment.submission_status)}
                                                        {assignment.submission_status === 'submitted' && assignment.submitted_at && (
                                                            <div className="text-muted small mt-1" style={{ fontSize: '0.75rem' }}>
                                                                lúc {new Date(assignment.submitted_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} {new Date(assignment.submitted_at).toISOString().slice(0, 10)}
                                                            </div>
                                                        )}
                                                        {assignment.submission_status === 'approved' && assignment.reviewed_at && (
                                                            <div className="text-muted small mt-1" style={{ fontSize: '0.75rem' }}>
                                                                lúc {new Date(assignment.reviewed_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} {new Date(assignment.reviewed_at).toISOString().slice(0, 10)}
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

            {/* Upload Modal / Chi tiết minh chứng (khi Đã gửi hoặc Đáp ứng) */}
            <Modal 
                show={showUploadModal} 
                onHide={() => setShowUploadModal(false)} 
                size="lg"
                className="student-detail-modal"
            >
                <Modal.Header closeButton className="student-detail-header">
                    <Modal.Title className="student-detail-title">
                        <div className="student-avatar">
                            <i className={selectedAssignment && (selectedAssignment.submission_status === 'submitted' || selectedAssignment.submission_status === 'approved') ? 'fas fa-info-circle' : 'fas fa-upload'}></i>
                        </div>
                        <div>
                            <h4 className="mb-0">
                                {selectedAssignment && (selectedAssignment.submission_status === 'submitted' || selectedAssignment.submission_status === 'approved')
                                    ? 'Chi tiết minh chứng'
                                    : 'Cập nhật minh chứng'}
                            </h4>
                            <p className="mb-0 student-subtitle">{selectedAssignment?.code} - {selectedAssignment?.name}</p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="student-detail-body">
                    <div className="student-detail-container">
                    {selectedAssignment && (() => {
                        const isDetailView = selectedAssignment.submission_status === 'submitted' || selectedAssignment.submission_status === 'approved';
                        if (isDetailView) {
                            return (
                                <>
                                    {/* Thông tin minh chứng + Phản hồi: 2 cột */}
                                    <Row className="mb-3">
                                        <Col md={6}>
                                            <div className="session-card h-100">
                                                <div className="card-header-modern">
                                                    <div className="header-icon">
                                                        <i className="fas fa-info-circle"></i>
                                                    </div>
                                                    <h6 className="mb-0">Thông tin minh chứng</h6>
                                                </div>
                                                <div className="card-body-modern">
                                                    <p className="mb-2"><strong>Mã:</strong> {selectedAssignment.code}</p>
                                                    <p className="mb-2"><strong>Tên minh chứng:</strong> {selectedAssignment.name}</p>
                                                    <p className="mb-2"><strong>Người tạo:</strong> {selectedAssignment.category_created_by_name || '—'}</p>
                                                    <p className="mb-2">
                                                        <strong>Thời gian tạo:</strong>{' '}
                                                        {selectedAssignment.category_created_at
                                                            ? new Date(selectedAssignment.category_created_at).toLocaleString('vi-VN')
                                                            : '—'}
                                                    </p>
                                                    {selectedAssignment.due_at && (
                                                        <p className="mb-2">
                                                            <strong>Hạn nộp:</strong>{' '}
                                                            {new Date(selectedAssignment.due_at).toLocaleString('vi-VN')}
                                                        </p>
                                                    )}
                                                    <p className="mb-2"><strong>Trạng thái:</strong> {getStatusBadge(selectedAssignment.submission_status)}</p>
                                                    {selectedAssignment.submitted_at && (
                                                        <p className="mb-2">
                                                            <strong>Thời gian gửi:</strong>{' '}
                                                            {new Date(selectedAssignment.submitted_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                        </p>
                                                    )}
                                                    {selectedAssignment.submission_status === 'approved' && selectedAssignment.reviewed_at && (
                                                        <p className="mb-2">
                                                            <strong>Thời gian đáp ứng:</strong>{' '}
                                                            {new Date(selectedAssignment.reviewed_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                        </p>
                                                    )}
                                                    <p className="mb-0"><strong>Mô tả:</strong> {selectedAssignment.description || '—'}</p>
                                                </div>
                                            </div>
                                        </Col>
                                        <Col md={6}>
                                            <div className="session-card h-100">
                                                <div className="card-header-modern">
                                                    <div className="header-icon">
                                                        <i className="fas fa-comment-dots"></i>
                                                    </div>
                                                    <h6 className="mb-0">Phản hồi</h6>
                                                </div>
                                                <div className="card-body-modern">
                                                    {selectedAssignment.review_notes ? (
                                                        <div style={{ fontSize: '0.95rem', lineHeight: '1.6', color: '#495057' }}>
                                                            {selectedAssignment.review_notes}
                                                        </div>
                                                    ) : (
                                                        <div className="text-muted">Chưa có phản hồi</div>
                                                    )}
                                                </div>
                                            </div>
                                        </Col>
                                    </Row>
                                    {/* File mẫu */}
                                    <div className="session-card mb-3">
                                        <div className="card-header-modern">
                                            <div className="header-icon">
                                                <i className="fas fa-copy"></i>
                                            </div>
                                            <h6 className="mb-0">File mẫu</h6>
                                        </div>
                                        <div className="card-body-modern">
                                            {getTemplateUrls(selectedAssignment).length === 0 ? (
                                                <div className="text-center text-muted py-3">Chưa có file mẫu</div>
                                            ) : (
                                                <div className="file-grid">
                                                    {getTemplateUrls(selectedAssignment).map((url, index) => {
                                                        const fileObj = templateUrlToFile(url);
                                                        const fileType = fileObj.file_type?.toLowerCase() || '';
                                                        const isPdf = fileType === 'pdf';
                                                        return (
                                                            <div
                                                                key={`detail-template-${index}`}
                                                                className="file-card"
                                                                onClick={isPdf ? () => handlePreviewTemplateFile(fileObj) : undefined}
                                                                style={{
                                                                    cursor: isPdf ? 'pointer' : 'default',
                                                                    border: '1px solid #e9ecef',
                                                                    borderRadius: '12px',
                                                                    padding: '1rem'
                                                                }}
                                                            >
                                                                <div className="file-header">
                                                                    <div className="file-icon">
                                                                        <i className={getFileIcon(fileType)}></i>
                                                                    </div>
                                                                    <div className="file-actions">
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline-primary"
                                                                            href={getAbsoluteFileUrl(fileObj.file_path)}
                                                                            download
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            title="Tải về"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}
                                                                        >
                                                                            <i className="fas fa-download"></i>
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                                <div className="file-info-container file-info-visible">
                                                                    <div className="file-info">
                                                                        <div className="file-name">{fileObj.file_name}</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {/* File đã nộp */}
                                    <div className="session-card mb-3">
                                        <div className="card-header-modern">
                                            <div className="header-icon">
                                                <i className="fas fa-file-upload"></i>
                                            </div>
                                            <h6 className="mb-0">File đã nộp</h6>
                                        </div>
                                        <div className="card-body-modern">
                                            {files.length === 0 ? (
                                                <div className="text-center text-muted py-3">Chưa có file nào được nộp</div>
                                            ) : (
                                                <div className="file-grid">
                                                    {files.map((file) => {
                                                        const fileType = file.file_type?.toLowerCase() || '';
                                                        return (
                                                            <div
                                                                key={file.id}
                                                                className="file-card"
                                                                role="button"
                                                                tabIndex={0}
                                                                onClick={() => handlePreviewFile(file)}
                                                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handlePreviewFile(file); } }}
                                                                style={{ border: '1px solid #e9ecef', borderRadius: '12px', padding: '1rem', cursor: 'pointer' }}
                                                            >
                                                                <div className="file-header">
                                                                    <div className="file-icon">
                                                                        <i className={getFileIcon(fileType)}></i>
                                                                    </div>
                                                                </div>
                                                                <div className="file-info-container file-info-visible">
                                                                    <div className="file-info">
                                                                        <div className="file-name">{file.file_name}</div>
                                                                        <div className="file-meta">
                                                                            <span className="file-size">
                                                                                <i className="fas fa-weight me-1"></i>
                                                                                {formatBytes(file.file_size)}
                                                                            </span>
                                                                            <span className="file-date">
                                                                                <i className="fas fa-clock me-1"></i>
                                                                                {new Date(file.uploaded_at).toLocaleDateString('vi-VN')}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            );
                        }
                        const modalDueAt = selectedAssignment.due_at ? new Date(selectedAssignment.due_at) : null;
                        const modalIsOverdue = modalDueAt && new Date() > modalDueAt && selectedAssignment.submission_status !== 'approved';
                        return (
                        <>

                            {modalIsOverdue && (
                                <Alert variant="danger" className="mb-3">
                                    <strong><i className="fas fa-clock me-2"></i>Đã quá hạn nộp</strong>
                                    <p className="mb-0 mt-2">Hạn nộp: {modalDueAt.toLocaleString('vi-VN')}. Vui lòng nộp minh chứng sớm.</p>
                                </Alert>
                            )}

                            {selectedAssignment.submission_status === 'needs_revision' && selectedAssignment.review_notes && (
                                <Alert variant="warning">
                                    <strong>
                                        <i className="fas fa-exclamation-triangle me-2"></i>
                                        Yêu cầu chỉnh sửa:
                                    </strong>
                                    <p className="mb-0 mt-2">{selectedAssignment.review_notes}</p>
                                </Alert>
                            )}

                            {/* File mẫu - luôn hiển thị mục, có file thì hiển thị file-grid */}
                            <div className="session-card mb-3">
                                <div className="card-header-modern">
                                    <div className="header-icon">
                                        <i className="fas fa-copy"></i>
                                    </div>
                                    <h6 className="mb-0">File mẫu</h6>
                                </div>
                                <div className="card-body-modern">
                                    {getTemplateUrls(selectedAssignment).length === 0 ? (
                                        <div className="text-center text-muted py-3">Chưa có file mẫu</div>
                                    ) : (
                                        <div className="file-grid">
                                            {getTemplateUrls(selectedAssignment).map((url, index) => {
                                                const fileObj = templateUrlToFile(url);
                                                const fileType = fileObj.file_type?.toLowerCase() || '';
                                                const isPdf = fileType === 'pdf';
                                                return (
                                                    <div
                                                        key={`template-${index}`}
                                                        className="file-card"
                                                        onClick={isPdf ? () => handlePreviewTemplateFile(fileObj) : undefined}
                                                        style={{
                                                            cursor: isPdf ? 'pointer' : 'default',
                                                            border: '1px solid #e9ecef',
                                                            borderRadius: '12px',
                                                            padding: '1rem'
                                                        }}
                                                    >
                                                        <div className="file-header">
                                                            <div className="file-icon">
                                                                <i className={getFileIcon(fileType)}></i>
                                                            </div>
                                                            <div className="file-actions">
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline-primary"
                                                                    href={getAbsoluteFileUrl(fileObj.file_path)}
                                                                    download
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    title="Tải về"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}
                                                                >
                                                                    <i className="fas fa-download"></i>
                                                                </Button>
                                                            </div>
                                                        </div>
                                                        <div className="file-info-container file-info-visible">
                                                            <div className="file-info">
                                                                <div className="file-name">{fileObj.file_name}</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="session-card mb-3">
                                <div className="card-header-modern">
                                    <div className="header-icon">
                                        <i className="fas fa-file"></i>
                                    </div>
                                    <h6 className="mb-0">File minh chứng</h6>
                                </div>
                                <div className="card-body-modern">
                                    <Row>
                                        {/* Upload Area */}
                                        {selectedAssignment.submission_status !== 'submitted' && 
                                         selectedAssignment.submission_status !== 'approved' && (
                                            <Col md={4}>
                                                <div className="file-upload-container">
                                                    <input 
                                                        type="file" 
                                                        id="file-upload"
                                                        className="file-upload-input" 
                                                        onChange={handleFileSelect}
                                                        disabled={uploading}
                                                        multiple
                                                        accept=".pdf,application/pdf"
                                                    />
                                                    <label htmlFor="file-upload" className="file-upload-label-custom">
                                                        <div className="file-upload-icon">
                                                            <i className="fas fa-cloud-upload-alt"></i>
                                                        </div>
                                                        <div className="file-upload-text">
                                                            <span className="file-upload-title">
                                                                {selectedFiles.length > 0 ? `Đã chọn ${selectedFiles.length} file` : 'Chọn file để upload'}
                                                            </span>
                                                            <span className="file-upload-subtitle">
                                                                {selectedFiles.length > 0 ? 'Click để chọn thêm file' : 'Tối đa 100MB/file. Chỉ hỗ trợ PDF'}
                                                            </span>
                                                        </div>
                                                    </label>
                                                </div>
                                            </Col>
                                        )}

                                        {/* File List: file đã có trên server + file vừa chọn (chưa gửi) */}
                                        <Col md={selectedAssignment.submission_status !== 'submitted' && 
                                                selectedAssignment.submission_status !== 'approved' ? 8 : 12}>
                                            {files.length === 0 && selectedFiles.length === 0 ? (
                                                <div className="text-center text-muted p-4">
                                                    <div className="rounded-circle bg-light d-inline-flex align-items-center justify-content-center mb-3" style={{width: '60px', height: '60px'}}>
                                                        <i className="fas fa-file-upload fa-2x text-muted"></i>
                                                    </div>
                                                    <p className="mb-0">Chưa có file nào. Chọn file ở bên trái để thêm.</p>
                                                </div>
                                            ) : (
                                                <div className="file-grid">
                                                    {/* File đã chọn, chưa gửi - hiển thị dạng file-card, có nút gỡ */}
                                                    {selectedFiles.map((file, index) => {
                                                        const fileType = (file.name || '').split('.').pop()?.toLowerCase() || '';
                                                        return (
                                                            <div key={`pending-${index}`} className="file-card" style={{ border: '1px solid #e9ecef', borderRadius: '12px', padding: '1rem' }}>
                                                                <div className="file-header">
                                                                    <div className="file-icon">
                                                                        <i className={getFileIcon(fileType)}></i>
                                                                    </div>
                                                                    <div className="file-actions">
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline-danger"
                                                                            onClick={() => removeSelectedFile(index)}
                                                                            title="Gỡ"
                                                                            style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}
                                                                        >
                                                                            <i className="fas fa-times"></i>
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                                <div className="file-info-container file-info-visible">
                                                                    <div className="file-info">
                                                                        <div className="file-name">{file.name}</div>
                                                                        <div className="file-meta">
                                                                            <span className="file-size">
                                                                                <i className="fas fa-weight me-1"></i>
                                                                                {formatBytes(file.size)}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <small className="text-muted">(Chưa gửi - sẽ tải lên khi nhấn &quot;Gửi minh chứng&quot;)</small>
                                                            </div>
                                                        );
                                                    })}
                                                    {files.map((file) => {
                                                        const fileType = file.file_type?.toLowerCase() || '';
                                                        return (
                                                            <div 
                                                                key={file.id} 
                                                                className="file-card"
                                                            >
                                                                {/* File header */}
                                                                <div className="file-header">
                                                                    <div className="file-icon">
                                                                        <i className={getFileIcon(fileType)}></i>
                                                                    </div>
                                                                    <div className="file-actions">
                                                                        <Button 
                                                                            size="sm"
                                                                            variant="outline-primary"
                                                                            href={getAbsoluteFileUrl(file.file_path)}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            title="Xem/Tải"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                            }}
                                                                            style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}
                                                                        >
                                                                            <i className="fas fa-external-link-alt"></i>
                                                                        </Button>
                                                                        {selectedAssignment.submission_status !== 'submitted' && 
                                                                         selectedAssignment.submission_status !== 'approved' && (
                                                                            <Button
                                                                                size="sm"
                                                                                variant="outline-danger"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleDeleteFile(file.id);
                                                                                }}
                                                                                title="Xóa"
                                                                                style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}
                                                                            >
                                                                                <i className="fas fa-times"></i>
                                                                            </Button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                
                                                                {/* File info */}
                                                                <div className="file-info-container file-info-visible">
                                                                    <div className="file-info">
                                                                        <div className="file-name">
                                                                            {file.file_name}
                                                                        </div>
                                                                        
                                                                        <div className="file-meta">
                                                                            <span className="file-size">
                                                                                <i className="fas fa-weight me-1"></i>
                                                                                {formatBytes(file.file_size)}
                                                                            </span>
                                                                            <span className="file-date">
                                                                                <i className="fas fa-clock me-1"></i>
                                                                                {new Date(file.uploaded_at).toLocaleDateString('vi-VN')}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </Col>
                                    </Row>
                                </div>
                            </div>
                        </>
                        );
                    })()}
                    </div>
                </Modal.Body>
                <Modal.Footer className="student-detail-footer">
                    <Button variant="outline-secondary" onClick={() => setShowUploadModal(false)} className="btn-cancel">
                        <i className="fas fa-times me-2"></i>
                        Đóng
                    </Button>
                    {selectedAssignment && 
                     selectedAssignment.submission_status !== 'submitted' && 
                     selectedAssignment.submission_status !== 'approved' && 
                     (files.length + selectedFiles.length) > 0 && (
                        <Button variant="primary" onClick={handleSubmitClick} className="btn-edit" disabled={uploading}>
                            {uploading ? (
                                <>
                                    <Spinner as="span" animation="border" size="sm" className="me-2" />
                                    Đang tải lên và gửi...
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-paper-plane me-2"></i>
                                    Gửi minh chứng
                                </>
                            )}
                        </Button>
                    )}
                </Modal.Footer>
            </Modal>

            {/* Modal xác nhận gửi minh chứng - theo thiết kế UserManagement */}
            <Modal
                show={showConfirmSubmitModal}
                onHide={() => !uploading && setShowConfirmSubmitModal(false)}
                size="lg"
                className="student-detail-modal"
                backdrop="static"
            >
                <Modal.Header closeButton={!uploading} className="student-detail-header">
                    <Modal.Title className="student-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-paper-plane"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Xác nhận gửi minh chứng</h4>
                            <p className="mb-0 student-subtitle">Gửi minh chứng để rà soát</p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="student-detail-body">
                    <div className="student-detail-container">
                        <div className="session-card">
                            <div className="card-body-modern">
                                <p className="mb-0">
                                    <i className="fas fa-info-circle me-2 text-primary"></i>
                                    Bạn có chắc muốn gửi minh chứng này? Sau khi gửi, minh chứng sẽ được chuyển cho người quản lý để rà soát.
                                </p>
                            </div>
                        </div>
                    </div>
                </Modal.Body>
                <Modal.Footer className="student-detail-footer">
                    <Button
                        variant="outline-secondary"
                        onClick={() => setShowConfirmSubmitModal(false)}
                        disabled={uploading}
                        className="btn-cancel"
                    >
                        <i className="fas fa-times me-2"></i>
                        Hủy
                    </Button>
                    <Button
                        variant="primary"
                        onClick={doSubmitEvidence}
                        disabled={uploading}
                        className="btn-edit"
                    >
                        {uploading ? (
                            <>
                                <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                                Đang xử lý...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-paper-plane me-2"></i>
                                Xác nhận gửi
                            </>
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* File Preview Modal */}
            <Modal 
                show={showFilePreview} 
                onHide={() => setShowFilePreview(false)}
                fullscreen={true}
                className="student-detail-modal"
                dialogClassName="fullscreen-modal"
            >
                <Modal.Header closeButton className="student-detail-header">
                    <Modal.Title className="student-detail-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <p className="mb-0 student-subtitle">{previewFile?.file_name}</p>
                            {previewFile && !previewError && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <a
                                        href={getAbsoluteFileUrl(previewFile.file_path)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ color: 'inherit', textDecoration: 'none', fontSize: '16px' }}
                                        title="Mở file ở tab mới"
                                    >
                                        <i className="fas fa-external-link-alt"></i>
                                    </a>
                                </div>
                            )}
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="student-detail-body" style={{ flex: 1, overflow: 'hidden', padding: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    {previewFile && (
                        <>
                            {previewError ? (
                                <Alert variant="danger" className="m-3">
                                    <i className="fas fa-times-circle me-2"></i>
                                    {previewError}
                                    <div className="mt-3">
                                        <Button
                                            variant="primary"
                                            href={getAbsoluteFileUrl(previewFile.file_path)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <i className="fas fa-external-link-alt me-2"></i>
                                            Mở file ở tab mới
                                        </Button>
                                    </div>
                                </Alert>
                            ) : previewFile.file_type === 'pdf' ? (
                                <div style={{ 
                                    height: '100%', 
                                    width: '100%', 
                                    overflow: 'hidden', 
                                    margin: 0, 
                                    backgroundColor: 'rgb(40, 40, 40)',
                                    position: 'relative'
                                }}>
                                    {pdfState.loading ? (
                                        <div className="py-4 text-center" style={{ color: '#fff', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                                            <Spinner animation="border" size="sm" variant="light" />
                                            <span className="ms-2">Đang tải PDF...</span>
                                        </div>
                                    ) : previewFile && !previewError ? (
                                        <embed
                                            name="pdf-viewer"
                                            style={{
                                                position: 'absolute',
                                                left: 0,
                                                top: 0,
                                                width: '100%',
                                                height: '100%'
                                            }}
                                            src={getAbsoluteFileUrl(previewFile.file_path)}
                                            type="application/pdf"
                                        />
                                    ) : null}
                                </div>
                            ) : ['doc', 'docx'].includes(previewFile.file_type) ? (
                                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                                    <iframe
                                        src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(getAbsoluteFileUrl(previewFile.file_path))}`}
                                        style={{ width: '100%', flex: 1, border: 'none', minHeight: 0 }}
                                        title="Office Preview"
                                    />
                                </div>
                            ) : ['jpg', 'jpeg', 'png', 'gif'].includes(previewFile.file_type) ? (
                                <div className="text-center" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
                                    <img 
                                        src={getAbsoluteFileUrl(previewFile.file_path)}
                                        alt={previewFile.file_name}
                                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                    />
                                </div>
                            ) : (
                                <Alert variant="info" className="text-center">
                                    <i className="fas fa-info-circle me-2"></i>
                                    <p>Không thể xem trực tuyến file loại này. Vui lòng tải về để xem.</p>
                                    <Button 
                                        variant="primary"
                                        href={getAbsoluteFileUrl(previewFile.file_path)}
                                        download
                                    >
                                        <i className="fas fa-download me-2"></i>
                                        Tải về
                                    </Button>
                                </Alert>
                            )}
                        </>
                    )}
                </Modal.Body>
            </Modal>

            {/* Modal Tạo danh mục mới (đề xuất cho Admin/Mod) */}
            <Modal
                show={showCreateCategoryModal}
                onHide={() => !createCategoryLoading && setShowCreateCategoryModal(false)}
                size="lg"
                className="student-detail-modal"
            >
                <Modal.Header closeButton={!createCategoryLoading} className="student-detail-header">
                    <Modal.Title className="student-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-folder-plus"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Tạo danh mục mới</h4>
                            <p className="mb-0 student-subtitle">Tạo danh mục, bạn được gán phụ trách và có thể nộp file minh chứng ngay đến Admin/Mod để rà soát</p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="student-detail-body">
                    <div className="student-detail-container">
                        <Form id="evidence-create-category-form" onSubmit={handleCreateCategorySubmit}>
                            {createCategoryError && (
                                <Alert variant="danger" dismissible onClose={() => setCreateCategoryError('')} className="mb-3">
                                    {createCategoryError}
                                </Alert>
                            )}
                            <div className="session-card mb-0">
                                <div className="card-header-modern">
                                    <div className="header-icon">
                                        <i className="fas fa-list-alt"></i>
                                    </div>
                                    <h6 className="mb-0">Thông tin danh mục</h6>
                                </div>
                                <div className="card-body-modern">
                                    <Form.Group className="mb-3">
                                        <Form.Label className="info-label">
                                            <i className="fas fa-barcode me-2"></i>
                                            Mã minh chứng <span className="text-danger">*</span>
                                        </Form.Label>
                                        <Form.Control
                                            type="text"
                                            value={createCategoryForm.code}
                                            onChange={(e) => setCreateCategoryForm(prev => ({ ...prev, code: e.target.value }))}
                                            placeholder="VD: MC-01"
                                            required
                                            className="form-control-modern"
                                        />
                                    </Form.Group>
                                    <Form.Group className="mb-3">
                                        <Form.Label className="info-label">
                                            <i className="fas fa-heading me-2"></i>
                                            Tên minh chứng <span className="text-danger">*</span>
                                        </Form.Label>
                                        <Form.Control
                                            type="text"
                                            value={createCategoryForm.name}
                                            onChange={(e) => setCreateCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                                            placeholder="VD: Báo cáo tổng kết năm"
                                            required
                                            className="form-control-modern"
                                        />
                                    </Form.Group>
                                    <Form.Group className="mb-0">
                                        <Form.Label className="info-label">
                                            <i className="fas fa-align-left me-2"></i>
                                            Mô tả
                                        </Form.Label>
                                        <Form.Control
                                            as="textarea"
                                            rows={3}
                                            value={createCategoryForm.description}
                                            onChange={(e) => setCreateCategoryForm(prev => ({ ...prev, description: e.target.value }))}
                                            placeholder="Mô tả ngắn gọn về minh chứng (tùy chọn)"
                                            className="form-control-modern"
                                        />
                                    </Form.Group>
                                </div>
                            </div>

                            <div className="session-card mb-0 mt-3">
                                <div className="card-header-modern">
                                    <div className="header-icon">
                                        <i className="fas fa-file"></i>
                                    </div>
                                    <h6 className="mb-0">File minh chứng</h6>
                                </div>
                                <div className="card-body-modern">
                                    <p className="text-muted small mb-3">
                                        Chọn file để nộp minh chứng ngay khi tạo danh mục. Bài nộp sẽ được gửi cho Admin/Mod để rà soát.
                                    </p>
                                    <Row>
                                        <Col md={4}>
                                            <div className="file-upload-container">
                                                <input
                                                    type="file"
                                                    id="file-upload-create-category"
                                                    className="file-upload-input"
                                                    onChange={handleCreateCategoryFileSelect}
                                                    disabled={createCategoryLoading}
                                                    multiple
                                                />
                                                <label htmlFor="file-upload-create-category" className="file-upload-label-custom">
                                                    <div className="file-upload-icon">
                                                        <i className="fas fa-cloud-upload-alt"></i>
                                                    </div>
                                                    <div className="file-upload-text">
                                                        <span className="file-upload-title">
                                                            {createCategoryFiles.length > 0 ? `Đã chọn ${createCategoryFiles.length} file` : 'Chọn file để upload'}
                                                        </span>
                                                        <span className="file-upload-subtitle">
                                                            {createCategoryFiles.length > 0 ? 'Click để chọn thêm file' : 'Chọn file (tùy chọn)'}
                                                        </span>
                                                    </div>
                                                </label>
                                            </div>
                                        </Col>
                                        <Col md={8}>
                                            {createCategoryFiles.length === 0 ? (
                                                <div className="text-center text-muted p-4">
                                                    <div className="rounded-circle bg-light d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '60px', height: '60px' }}>
                                                        <i className="fas fa-file-upload fa-2x text-muted"></i>
                                                    </div>
                                                    <p className="mb-0">Chưa có file nào. Chọn file ở bên trái để thêm.</p>
                                                </div>
                                            ) : (
                                                <div className="file-grid">
                                                    {createCategoryFiles.map((file, index) => {
                                                        const fileType = (file.name || '').split('.').pop()?.toLowerCase() || '';
                                                        return (
                                                            <div key={`create-cat-file-${index}`} className="file-card" style={{ border: '1px solid #e9ecef', borderRadius: '12px', padding: '1rem' }}>
                                                                <div className="file-header">
                                                                    <div className="file-icon">
                                                                        <i className={getFileIcon(fileType)}></i>
                                                                    </div>
                                                                    <div className="file-actions">
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline-danger"
                                                                            onClick={() => removeCreateCategoryFile(index)}
                                                                            title="Gỡ"
                                                                            style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}
                                                                        >
                                                                            <i className="fas fa-times"></i>
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                                <div className="file-info-container file-info-visible">
                                                                    <div className="file-info">
                                                                        <div className="file-name">{file.name}</div>
                                                                        <div className="file-meta">
                                                                            <span className="file-size">
                                                                                <i className="fas fa-weight me-1"></i>
                                                                                {formatBytes(file.size)}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <small className="text-muted">(Sẽ nộp khi nhấn &quot;Tạo danh mục&quot;)</small>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </Col>
                                    </Row>
                                </div>
                            </div>
                        </Form>
                    </div>
                </Modal.Body>
                <Modal.Footer className="student-detail-footer">
                    <Button
                        variant="outline-secondary"
                        onClick={() => setShowCreateCategoryModal(false)}
                        disabled={createCategoryLoading}
                        className="btn-cancel"
                    >
                        <i className="fas fa-times me-2"></i>
                        Hủy
                    </Button>
                    <Button
                        variant="primary"
                        type="submit"
                        form="evidence-create-category-form"
                        disabled={createCategoryLoading}
                        className="btn-edit"
                    >
                        {createCategoryLoading ? (
                            <>
                                <Spinner as="span" animation="border" size="sm" className="me-2" />
                                Đang tạo...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-plus me-2"></i>
                                Tạo danh mục
                            </>
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>
        </Container>
        </div>
    );
};

export default EvidenceStorageStaffView;

// Add CSS for file grid layout (same style as MonitoringPage)
const fileGridStyle = document.createElement('style');
fileGridStyle.textContent = `
  /* File Grid Layout */
  .file-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
    margin-bottom: 1rem;
  }
  
  .file-card {
    background: white;
    border: 1px solid #e9ecef;
    border-radius: 12px;
    padding: 1rem;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
  }
  
  .file-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0,0,0,0.1);
    border-color: #007bff;
  }
  
  .file-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }
  
  .file-icon {
    width: 40px;
    height: 40px;
    background: linear-gradient(135deg, #007bff, #0056b3);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 1.2rem;
  }
  
  .file-actions {
    display: flex;
    gap: 0.5rem;
  }
  
  .file-actions .btn {
    width: 32px;
    height: 32px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
  }
  
  .file-info {
    space-y: 0.5rem;
  }
  
  .file-name {
    font-weight: 600;
    font-size: 0.95rem;
    color: #2c3e50;
    margin-bottom: 0.5rem;
    word-break: break-word;
  }
  
  .file-meta {
    display: flex;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }
  
  .file-size, .file-date {
    font-size: 0.8rem;
    color: #6c757d;
    display: flex;
    align-items: center;
  }
  
  .file-info-container {
    overflow: hidden;
    transition: all 0.3s ease-in-out;
  }
  
  .file-info-container.file-info-visible {
    max-height: 200px;
    opacity: 1;
    transform: translateY(0);
  }
  
  /* File upload styles */
  .file-upload-label {
    display: block;
    margin-bottom: 0.75rem;
    font-weight: 600;
    color: #495057;
    transition: all 0.2s ease-in-out;
  }
  
  .file-upload-container {
    position: relative;
    width: 100%;
  }
  
  .file-upload-input {
    position: absolute;
    opacity: 0;
    width: 100%;
    height: 100%;
    cursor: pointer;
    z-index: 2;
  }
  
  .file-upload-label-custom {
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 120px;
    padding: 1rem;
    border: 2px dashed #dee2e6;
    border-radius: 12px;
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    cursor: pointer;
    transition: all 0.3s ease-in-out;
    position: relative;
    overflow: hidden;
  }
  
  .file-upload-label-custom::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
    transition: left 0.5s;
  }
  
  .file-upload-label-custom:hover {
    border-color: #007bff;
    background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 123, 255, 0.15);
  }
  
  .file-upload-label-custom:hover::before {
    left: 100%;
  }
  
  .file-upload-label-custom:active {
    transform: translateY(0);
    box-shadow: 0 4px 15px rgba(0, 123, 255, 0.2);
  }
  
  .file-upload-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 60px;
    height: 60px;
    background: linear-gradient(135deg, #007bff, #0056b3);
    border-radius: 50%;
    color: white;
    font-size: 24px;
    margin-right: 1rem;
    flex-shrink: 0;
    transition: all 0.3s ease-in-out;
  }
  
  .file-upload-label-custom:hover .file-upload-icon {
    transform: scale(1.1) rotate(5deg);
    box-shadow: 0 4px 15px rgba(0, 123, 255, 0.3);
  }
  
  .file-upload-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 0;
  }
  
  .file-upload-title {
    font-size: 16px;
    font-weight: 600;
    color: #2c3e50;
    margin-bottom: 0.25rem;
    word-break: break-word;
    transition: all 0.2s ease-in-out;
  }
  
  .file-upload-subtitle {
    font-size: 14px;
    color: #6c757d;
    transition: all 0.2s ease-in-out;
  }
  
  .file-upload-label-custom:hover .file-upload-title {
    color: #007bff;
  }
  
  .file-upload-label-custom:hover .file-upload-subtitle {
    color: #495057;
  }
  
  .file-upload-input:disabled + .file-upload-label-custom {
    opacity: 0.6;
    cursor: not-allowed;
    background: #e9ecef;
  }
  
  .file-upload-input:disabled + .file-upload-label-custom:hover {
    transform: none;
    box-shadow: none;
  }
  
  /* Responsive */
  @media (max-width: 768px) {
    .file-grid {
      grid-template-columns: 1fr;
    }
    
    .file-meta {
      flex-direction: column;
      gap: 0.25rem;
    }
    
    .file-upload-label {
      font-size: 14px;
      margin-bottom: 0.5rem;
    }
    
    .file-upload-label-custom {
      min-height: 100px;
      padding: 1rem;
    }
    
    .file-upload-icon {
      width: 50px;
      height: 50px;
      font-size: 20px;
      margin-right: 0.75rem;
    }
    
    .file-upload-title {
      font-size: 15px;
    }
    
    .file-upload-subtitle {
      font-size: 13px;
    }
  }
  
  @media (max-width: 576px) {
    .file-upload-label {
      font-size: 13px;
      margin-bottom: 0.375rem;
    }
    
    .file-upload-label-custom {
      min-height: 80px;
      padding: 0.75rem;
      flex-direction: column;
      text-align: center;
    }
    
    .file-upload-icon {
      width: 40px;
      height: 40px;
      font-size: 18px;
      margin-right: 0;
      margin-bottom: 0.5rem;
    }
    
    .file-upload-text {
      margin-bottom: 0.5rem;
    }
    
    .file-upload-title {
      font-size: 14px;
    }
    
    .file-upload-subtitle {
      font-size: 12px;
    }
  }
`;
if (!document.head.querySelector('style[data-evidence-staff-file-grid]')) {
    fileGridStyle.setAttribute('data-evidence-staff-file-grid', 'true');
    document.head.appendChild(fileGridStyle);
}

// Add CSS for not-submitted row animation (similar to live-exam-row)
const notSubmittedRowStyle = document.createElement('style');
notSubmittedRowStyle.textContent = `
  .session-table tbody tr.not-submitted-row {
    position: relative;
    background: linear-gradient(90deg, 
      rgba(108, 117, 125, 0.03) 0%, 
      rgba(108, 117, 125, 0.06) 50%, 
      rgba(108, 117, 125, 0.03) 100%);
    background-size: 200% 100%;
    animation: notSubmittedRowShimmer 3s ease-in-out infinite, notSubmittedRowPulse 2s ease-in-out infinite;
    border-left: 3px solid #6c757d;
    box-shadow: 0 0 0 rgba(108, 117, 125, 0.1);
  }

  @keyframes notSubmittedRowShimmer {
    0%, 100% {
      background-position: -200% 0;
    }
    50% {
      background-position: 200% 0;
    }
  }

  @keyframes notSubmittedRowPulse {
    0%, 100% {
      box-shadow: 0 0 0 rgba(108, 117, 125, 0.1);
      border-left-color: #6c757d;
    }
    50% {
      box-shadow: 0 0 15px rgba(108, 117, 125, 0.2);
      border-left-color: #adb5bd;
    }
  }

  .session-table tbody tr.not-submitted-row:hover {
    background: linear-gradient(90deg, 
      rgba(108, 117, 125, 0.05) 0%, 
      rgba(108, 117, 125, 0.1) 50%, 
      rgba(173, 181, 189, 0.089) 100%);
    background-size: 200% 100%;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(108, 117, 125, 0.15);
  }

  /* Badge Animation for Not Submitted Status */
  .session-table tbody tr.not-submitted-row .badge.bg-secondary {
    position: relative;
    overflow: visible;
    animation: notSubmittedBadgePulse 2s ease-in-out infinite;
    padding-left: 20px;
  }

  .session-table tbody tr.not-submitted-row .badge.bg-secondary::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, 
      transparent, 
      rgba(255, 255, 255, 0.4), 
      transparent);
    animation: notSubmittedBadgeShine 2.5s ease-in-out infinite;
    z-index: 1;
  }

  .session-table tbody tr.not-submitted-row .badge.bg-secondary::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 6px;
    width: 6px;
    height: 6px;
    background: #fff;
    border-radius: 50%;
    transform: translateY(-50%);
    animation: notSubmittedBadgeDot 1.5s ease-in-out infinite;
    box-shadow: 0 0 6px rgba(255, 255, 255, 0.8);
    z-index: 2;
  }

  @keyframes notSubmittedBadgePulse {
    0%, 100% {
      transform: scale(1);
      box-shadow: 0 0 0 rgba(108, 117, 125, 0.4);
    }
    50% {
      transform: scale(1.02);
      box-shadow: 0 0 8px rgba(108, 117, 125, 0.6);
    }
  }

  @keyframes notSubmittedBadgeShine {
    0% {
      left: -100%;
    }
    100% {
      left: 100%;
    }
  }

  @keyframes notSubmittedBadgeDot {
    0%, 100% {
      opacity: 1;
      transform: translateY(-50%) scale(1);
    }
    50% {
      opacity: 0.6;
      transform: translateY(-50%) scale(0.8);
    }
  }

  /* Ensure smooth performance - use will-change and GPU acceleration */
  .session-table tbody tr.not-submitted-row {
    will-change: background-position, box-shadow, border-color;
    transform: translateZ(0);
    backface-visibility: hidden;
  }

  .session-table tbody tr.not-submitted-row .badge.bg-secondary {
    will-change: transform, box-shadow;
    transform: translateZ(0);
    backface-visibility: hidden;
  }
`;
if (!document.head.querySelector('style[data-not-submitted-row]')) {
    notSubmittedRowStyle.setAttribute('data-not-submitted-row', 'true');
    document.head.appendChild(notSubmittedRowStyle);
}
