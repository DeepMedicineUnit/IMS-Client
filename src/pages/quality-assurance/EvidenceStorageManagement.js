import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Container, Row, Col, Card, Table, Button, Badge, Modal, Form, Alert, Spinner, ListGroup, Tabs, Tab } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import '../../styles/user.css';
import { getApiBaseURL } from '../../utils/api';

const EvidenceStorageManagement = () => {
    const { api, currentUser } = useAuth();
    const { showAlert } = useAlert();
    const [categories, setCategories] = useState([]);
    const [submissions, setSubmissions] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [showFilePreview, setShowFilePreview] = useState(false);
    const [previewFile, setPreviewFile] = useState(null);
    const [previewError, setPreviewError] = useState('');
    const [pdfState, setPdfState] = useState({ loading: false });
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const EVIDENCE_TAB_STORAGE_KEY = 'evidence-management-active-tab';
    const [activeTab, setActiveTab] = useState(() => {
        try {
            const saved = localStorage.getItem(EVIDENCE_TAB_STORAGE_KEY);
            if (saved === 'categories' || saved === 'submissions') return saved;
        } catch (_) {}
        return 'categories';
    });
    
    const [form, setForm] = useState({
        code: '',
        name: '',
        description: '',
        template_url: ''
    });

    const [templateFiles, setTemplateFiles] = useState([]); // Array of File objects
    const [templateUrls, setTemplateUrls] = useState([]); // Array of existing template URLs
    const [templateUploading, setTemplateUploading] = useState(false);
    const [categorySaving, setCategorySaving] = useState(false);

    // Assignment UI inside Create/Edit Category modal
    const [evidenceStaffUsers, setEvidenceStaffUsers] = useState([]);
    const [staffSearch, setStaffSearch] = useState('');
    const [selectedStaffIds, setSelectedStaffIds] = useState([]); // user ids
    const [currentAssignments, setCurrentAssignments] = useState([]); // assignments for selectedCategory
    const [assignNotes, setAssignNotes] = useState(''); // note applied to newly added staff
    const [assignDueAt, setAssignDueAt] = useState(''); // hạn nộp (datetime-local string), áp dụng khi gán/cập nhật

    const [reviewForm, setReviewForm] = useState({
        status: 'approved',
        reviewNotes: ''
    });

    const [selectedSubmission, setSelectedSubmission] = useState(null);
    const [files, setFiles] = useState([]);
    const [reviewSaving, setReviewSaving] = useState(false);

    // Filters for Categories tab
    const [categoryFilters, setCategoryFilters] = useState({
        searchCode: '',
        searchName: '',
        assignedTo: ''
    });

    // Filters for Submissions tab
    const [submissionFilters, setSubmissionFilters] = useState({
        searchCode: '',
        searchName: '',
        submittedBy: '',
        status: '',
        dateFrom: '',
        dateTo: ''
    });

    const isMountedRef = useRef(true);
    const filterRef = useRef(filter);
    filterRef.current = filter;

    useEffect(() => {
        isMountedRef.current = true;
        fetchCategories();
        fetchSubmissions();
        return () => { isMountedRef.current = false; };
    }, [filter]);

    // Refetch dưới nền khi có dữ liệu mới (không bật loading, không toast)
    const fetchCategoriesSilent = async () => {
        try {
            const response = await api.get('/quality-assurance/categories');
            if (isMountedRef.current && response.data?.success && Array.isArray(response.data.data)) {
                setCategories(response.data.data);
            }
        } catch (err) {
            if (process.env.NODE_ENV === 'development') {
                console.warn('EvidenceStorageManagement fetchCategoriesSilent:', err?.message);
            }
        }
    };

    const fetchSubmissionsSilent = async () => {
        try {
            const params = filterRef.current !== 'all' ? { status: filterRef.current } : {};
            const response = await api.get('/quality-assurance/submissions', { params });
            if (isMountedRef.current && response.data?.success && Array.isArray(response.data.data)) {
                setSubmissions(response.data.data);
            }
        } catch (err) {
            if (process.env.NODE_ENV === 'development') {
                console.warn('EvidenceStorageManagement fetchSubmissionsSilent:', err?.message);
            }
        }
    };

    // Khi user quay lại tab → refetch danh mục + bài nộp một lần
    useEffect(() => {
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchCategoriesSilent();
                fetchSubmissionsSilent();
            }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    }, []);

    const fetchEvidenceStaffUsers = async () => {
        try {
            // Reuse evidence users endpoint then filter by evidence_staff role
            const res = await api.get('/quality-assurance/users');
            if (res.data?.success) {
                const allUsers = res.data.data || [];
                const staffUsers = allUsers.filter(u => Array.isArray(u.module_roles) && u.module_roles.includes('evidence_staff'));
                setEvidenceStaffUsers(staffUsers);
            }
        } catch (err) {
            console.error('Error fetching evidence staff users:', err);
        }
    };

    const fetchAssignmentsForCategory = async (categoryId) => {
        try {
            const res = await api.get(`/quality-assurance/assignments/${categoryId}`);
            if (res.data?.success) {
                const assignments = res.data.data || [];
                setCurrentAssignments(assignments);
                setSelectedStaffIds(assignments.map(a => a.assigned_to));
            }
        } catch (err) {
            console.error('Error fetching assignments:', err);
        }
    };

    const toggleStaffSelection = (userId) => {
        setSelectedStaffIds(prev => (prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]));
    };

    const syncAssignments = async (categoryId) => {
        const before = currentAssignments || [];
        const beforeByUser = new Map(before.map(a => [a.assigned_to, a]));

        const toAdd = selectedStaffIds.filter(uid => !beforeByUser.has(uid));
        const toRemove = before.filter(a => !selectedStaffIds.includes(a.assigned_to));
        const dueAtValue = assignDueAt && assignDueAt.trim() ? assignDueAt.trim() : null;

        for (const uid of toAdd) {
            await api.post('/quality-assurance/assignments', {
                categoryId,
                assignedTo: uid,
                notes: assignNotes || '',
                due_at: dueAtValue
            });
        }

        for (const a of toRemove) {
            await api.delete(`/quality-assurance/assignments/${a.id}`);
        }

        // Cập nhật hạn nộp cho tất cả phân công còn lại (đã có từ trước)
        const toKeep = before.filter(a => selectedStaffIds.includes(a.assigned_to));
        if (dueAtValue !== null && toKeep.length > 0) {
            for (const a of toKeep) {
                await api.put(`/quality-assurance/assignments/${a.id}`, { due_at: dueAtValue });
            }
        }
    };

    const fetchCategories = async () => {
        try {
            setLoading(true);
            const response = await api.get('/quality-assurance/categories');
            if (response.data.success) {
                setCategories(response.data.data);
            }
        } catch (err) {
            console.error('Error fetching categories:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchSubmissions = async () => {
        try {
            const params = filter !== 'all' ? { status: filter } : {};
            const response = await api.get('/quality-assurance/submissions', { params });
            if (response.data.success) {
                setSubmissions(response.data.data);
            }
        } catch (err) {
            console.error('Error fetching submissions:', err);
        }
    };

    const handleCreateCategory = () => {
        setForm({ code: '', name: '', description: '', template_url: '' });
        setSelectedCategory(null);
        setTemplateFiles([]);
        setTemplateUrls([]);
        setStaffSearch('');
        setSelectedStaffIds([]);
        setCurrentAssignments([]);
        setAssignNotes('');
        setAssignDueAt('');
        fetchEvidenceStaffUsers();
        setShowModal(true);
    };

    const handleEditCategory = async (category) => {
        setForm({
            code: category.code,
            name: category.name,
            description: category.description || '',
            template_url: category.template_url || ''
        });
        setSelectedCategory(category);
        setTemplateFiles([]);
        // If category has template_url, convert to array format (support single URL or JSON array)
        let urls = [];
        if (category.template_url) {
            const raw = category.template_url.trim();
            if (raw.startsWith('[')) {
                try {
                    urls = JSON.parse(raw);
                } catch (_) {
                    urls = [category.template_url];
                }
            } else {
                urls = [category.template_url];
            }
        }
        setTemplateUrls(Array.isArray(urls) ? urls : []);
        setStaffSearch('');
        setAssignNotes('');
        let assignments = [];
        try {
            const res = await api.get(`/quality-assurance/assignments/${category.id}`);
            if (res.data?.success && Array.isArray(res.data.data)) assignments = res.data.data;
        } catch (_) {}
        const firstDueAt = assignments.length > 0 && assignments[0].due_at
            ? String(assignments[0].due_at).slice(0, 16)
            : '';
        setAssignDueAt(firstDueAt);
        fetchEvidenceStaffUsers();
        setCurrentAssignments(assignments);
        setSelectedStaffIds(assignments.map(a => a.assigned_to));
        setShowModal(true);
    };

    const handleTemplateFileSelect = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            setTemplateFiles(prev => [...prev, ...files]);
        }
        // Reset input to allow selecting same file again
        e.target.value = '';
    };

    const removeTemplateFile = (index) => {
        setTemplateFiles(prev => prev.filter((_, i) => i !== index));
    };

    const removeTemplateUrl = (index) => {
        setTemplateUrls(prev => prev.filter((_, i) => i !== index));
    };

    const uploadTemplatesIfNeeded = async () => {
        const uploadedUrls = [...templateUrls]; // Keep existing URLs
        
        // Upload new files
        if (templateFiles.length > 0) {
            setTemplateUploading(true);
            try {
                for (const file of templateFiles) {
                    const fd = new FormData();
                    fd.append('code', form.code || ''); // Gửi code trước để server có req.body.code khi đặt tên file
                    fd.append('file', file);
                    const res = await api.post('/quality-assurance/categories/template-upload', fd, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
                    if (res.data?.success && res.data?.data?.file_url) {
                        uploadedUrls.push(res.data.data.file_url);
                    } else {
                        throw new Error(res.data?.message || 'Upload thất bại');
                    }
                }
            } catch (err) {
                showAlert(err.response?.data?.message || 'Lỗi khi upload file mẫu!', 'danger');
                throw err;
            } finally {
                setTemplateUploading(false);
            }
        }
        
        // Return all URLs: single string for one URL, JSON array string for multiple (backend stores as template_url)
        if (uploadedUrls.length === 0) return '';
        if (uploadedUrls.length === 1) return uploadedUrls[0];
        return JSON.stringify(uploadedUrls);
    };

    const handleSaveCategory = async () => {
        setCategorySaving(true);
        try {
            let categoryId = selectedCategory?.id;
            const templateUrl = await uploadTemplatesIfNeeded();
            const payload = { ...form, template_url: templateUrl };
            if (selectedCategory) {
                await api.put(`/quality-assurance/categories/${selectedCategory.id}`, payload);
                showAlert('Cập nhật danh mục thành công!', 'success');
            } else {
                const res = await api.post('/quality-assurance/categories', payload);
                categoryId = res.data?.data?.id;
                showAlert('Tạo danh mục thành công!', 'success');
            }
            if (categoryId) {
                await syncAssignments(categoryId);
            }
            setShowModal(false);
            await fetchCategoriesSilent();
            setTimeout(() => fetchCategoriesSilent(), 500);
            setTimeout(() => fetchCategoriesSilent(), 1200);
        } catch (err) {
            showAlert(err.response?.data?.message || 'Có lỗi xảy ra!', 'danger');
        } finally {
            setCategorySaving(false);
        }
    };

    const handleDeleteCategory = async (id) => {
        if (!window.confirm('Bạn có chắc muốn xóa danh mục này?')) return;
        
        try {
            await api.delete(`/quality-assurance/categories/${id}`);
            showAlert('Xóa danh mục thành công!', 'success');
            await fetchCategoriesSilent();
            setTimeout(() => fetchCategoriesSilent(), 500);
            setTimeout(() => fetchCategoriesSilent(), 1200);
        } catch (err) {
            showAlert(err.response?.data?.message || 'Có lỗi xảy ra!', 'danger');
        }
    };

    const handleReview = async (submission) => {
        setSelectedSubmission(submission);
        setReviewForm({ status: 'approved', reviewNotes: '' });
        
        // Fetch files for this submission
        try {
            const response = await api.get(`/quality-assurance/submissions/${submission.id}/files`);
            if (response.data.success) {
                setFiles(response.data.data);
            }
        } catch (err) {
            console.error('Error fetching files:', err);
        }
        
        setShowReviewModal(true);
    };

    const handleSaveReview = async () => {
        setReviewSaving(true);
        try {
            await api.put(`/quality-assurance/submissions/${selectedSubmission.id}/review`, reviewForm);
            showAlert('Rà soát minh chứng thành công!', 'success');
            setShowReviewModal(false);
            await fetchSubmissionsSilent();
            setTimeout(() => fetchSubmissionsSilent(), 500);
            setTimeout(() => fetchSubmissionsSilent(), 1200);
        } catch (err) {
            showAlert(err.response?.data?.message || 'Có lỗi xảy ra!', 'danger');
        } finally {
            setReviewSaving(false);
        }
    };

    const getUploadsBaseURL = () => {
        // getApiBaseURL() returns something like http(s)://host:8043/api (production)
        // We need http(s)://host:8043 for /uploads/*
        const apiBase = getApiBaseURL();
        return apiBase.endsWith('/api') ? apiBase.slice(0, -4) : apiBase;
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
            console.error('Error constructing file URL:', e, 'filePath:', filePath);
            // Fallback: simple concatenation (manual encoding for safety)
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

        // Pre-check to provide clearer error
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
            console.error('[EvidenceStorageManagement] Pre-check fetch error:', e);
            setPdfState({ loading: false });
            // Let embed handle it
        }
    };

    const getStatusBadge = (status, submitted_at = null, reviewed_at = null) => {
        const badges = {
            draft: { variant: 'secondary', text: 'Nháp' },
            submitted: { variant: 'warning', text: 'Đã gửi' },
            approved: { variant: 'success', text: 'Đáp ứng' },
            needs_revision: { variant: 'danger', text: 'Chỉnh sửa' }
        };
        const badge = badges[status] || badges.draft;
        
        // Add time info for submitted and approved statuses
        let timeText = '';
        if (status === 'submitted' && submitted_at) {
            const date = new Date(submitted_at);
            const timeStr = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
            const dateStr = date.toISOString().slice(0, 10);
            timeText = ` lúc ${timeStr} ${dateStr}`;
        } else if (status === 'approved' && reviewed_at) {
            const date = new Date(reviewed_at);
            const timeStr = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
            const dateStr = date.toISOString().slice(0, 10);
            timeText = ` lúc ${timeStr} ${dateStr}`;
        }
        
        return (
            <div className="d-flex align-items-center gap-2">
                <Badge bg={badge.variant}>{badge.text}</Badge>
                {timeText && (
                    <span className="text-muted small" style={{ fontSize: '0.75rem' }}>
                        {timeText}
                    </span>
                )}
            </div>
        );
    };

    // Get unique assigned users for Categories filter
    const uniqueAssignedUsers = useMemo(() => {
        if (!Array.isArray(categories) || categories.length === 0) return [];
        const users = new Set();
        categories.forEach(cat => {
            if (cat.assigned_to_names) {
                const names = cat.assigned_to_names.split(', ').filter(n => n.trim());
                names.forEach(name => users.add(name.trim()));
            }
        });
        return Array.from(users).sort();
    }, [categories]);

    // Get unique submitted users for Submissions filter
    const uniqueSubmittedUsers = useMemo(() => {
        if (!Array.isArray(submissions) || submissions.length === 0) return [];
        const users = submissions
            .map(s => s.submitted_by_name)
            .filter(name => name && name.trim() !== '');
        return [...new Set(users)].sort();
    }, [submissions]);

    // Filter categories
    const filteredCategories = useMemo(() => {
        let filtered = categories;

        // Filter by code
        if (categoryFilters.searchCode.trim()) {
            const codeTerm = categoryFilters.searchCode.toLowerCase();
            filtered = filtered.filter(cat => 
                (cat.code || '').toLowerCase().includes(codeTerm)
            );
        }

        // Filter by name
        if (categoryFilters.searchName.trim()) {
            const nameTerm = categoryFilters.searchName.toLowerCase();
            filtered = filtered.filter(cat => 
                (cat.name || '').toLowerCase().includes(nameTerm)
            );
        }

        // Filter by assigned to
        if (categoryFilters.assignedTo) {
            filtered = filtered.filter(cat => {
                if (!cat.assigned_to_names) return false;
                const names = cat.assigned_to_names.split(', ').map(n => n.trim());
                return names.includes(categoryFilters.assignedTo);
            });
        }

        return filtered;
    }, [categories, categoryFilters]);

    // Filter submissions
    const filteredSubmissions = useMemo(() => {
        let filtered = submissions;

        // Filter by code
        if (submissionFilters.searchCode.trim()) {
            const codeTerm = submissionFilters.searchCode.toLowerCase();
            filtered = filtered.filter(sub => 
                (sub.code || '').toLowerCase().includes(codeTerm)
            );
        }

        // Filter by name
        if (submissionFilters.searchName.trim()) {
            const nameTerm = submissionFilters.searchName.toLowerCase();
            filtered = filtered.filter(sub => 
                (sub.category_name || '').toLowerCase().includes(nameTerm)
            );
        }

        // Filter by submitted by
        if (submissionFilters.submittedBy) {
            filtered = filtered.filter(sub => 
                sub.submitted_by_name === submissionFilters.submittedBy
            );
        }

        // Filter by status
        if (submissionFilters.status) {
            filtered = filtered.filter(sub => {
                if (submissionFilters.status === 'none') {
                    return !sub.status;
                }
                return sub.status === submissionFilters.status;
            });
        }

        // Filter by date range (submitted_at or reviewed_at based on status)
        if (submissionFilters.dateFrom) {
            const fromDate = new Date(submissionFilters.dateFrom);
            fromDate.setHours(0, 0, 0, 0);
            filtered = filtered.filter(sub => {
                // Use submitted_at for submitted/approved, reviewed_at for approved
                const dateToCheck = sub.status === 'approved' && sub.reviewed_at 
                    ? sub.reviewed_at 
                    : sub.submitted_at;
                if (!dateToCheck) return false;
                const checkDate = new Date(dateToCheck);
                checkDate.setHours(0, 0, 0, 0);
                return checkDate >= fromDate;
            });
        }

        if (submissionFilters.dateTo) {
            const toDate = new Date(submissionFilters.dateTo);
            toDate.setHours(23, 59, 59, 999);
            filtered = filtered.filter(sub => {
                const dateToCheck = sub.status === 'approved' && sub.reviewed_at 
                    ? sub.reviewed_at 
                    : sub.submitted_at;
                if (!dateToCheck) return false;
                const checkDate = new Date(dateToCheck);
                checkDate.setHours(0, 0, 0, 0);
                return checkDate <= toDate;
            });
        }

        return filtered;
    }, [submissions, submissionFilters]);

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
                <div className="header-content">
                    <div className="header-title">
                        <h1>Quản lý minh chứng CSGD</h1>
                        <p className="header-subtitle">Thiết lập danh mục, gán staff, rà soát và phản hồi minh chứng</p>
                    </div>
                    <div className="header-actions">
                        <Button variant="outline-light" className="create-session-btn" onClick={handleCreateCategory}>
                            <i className="fas fa-plus"></i>
                            Tạo danh mục mới
                        </Button>
                    </div>
                </div>
            </div>

        <Container fluid className="mt-4">

            {/* Tab Navigation */}
            <div className="tab-navigation">
                <Tabs
                    activeKey={activeTab}
                    onSelect={(key) => {
                        if (key === 'categories' || key === 'submissions') {
                            setActiveTab(key);
                            try {
                                localStorage.setItem(EVIDENCE_TAB_STORAGE_KEY, key);
                            } catch (_) {}
                        }
                    }}
                    className="custom-tabs"
                >
                    <Tab eventKey="categories" title={
                        <span className="tab-title">
                            <i className="fas fa-list"></i>
                            Danh mục minh chứng
                        </span>
                    }>
                                {/* Filters for Categories */}
                                <div className="session-list-controls">
                                    <div className="search-controls">
                                        <div className="search-input" style={{ minWidth: '200px', flex: '1' }}>
                                            <input
                                                type="text"
                                                placeholder="Tìm theo mã..."
                                                value={categoryFilters.searchCode}
                                                onChange={(e) => setCategoryFilters({ ...categoryFilters, searchCode: e.target.value })}
                                                style={{ width: '100%' }}
                                            />
                                        </div>

                                        <div className="search-input" style={{ minWidth: '200px', flex: '1' }}>
                                            <input
                                                type="text"
                                                placeholder="Tìm theo tên minh chứng..."
                                                value={categoryFilters.searchName}
                                                onChange={(e) => setCategoryFilters({ ...categoryFilters, searchName: e.target.value })}
                                                style={{ width: '100%' }}
                                            />
                                        </div>

                                        <select
                                            className="filter-select"
                                            value={categoryFilters.assignedTo}
                                            onChange={(e) => setCategoryFilters({ ...categoryFilters, assignedTo: e.target.value })}
                                        >
                                            <option value="">Tất cả người được gán</option>
                                            {uniqueAssignedUsers.map((user) => (
                                                <option key={user} value={user}>
                                                    {user}
                                                </option>
                                            ))}
                                        </select>

                                    </div>
                                </div>

                                <div className="session-table-container">
                                    <div className="table-responsive-mobile">
                                        <table className="session-table staff-table">
                                            <thead>
                                                <tr>
                                                    <th>Mã</th>
                                                    <th>Tên minh chứng</th>
                                                    <th>Mô tả</th>
                                                    <th>Thời gian tạo</th>
                                                    <th>Người tạo</th>
                                                    <th>Người được gán</th>
                                                    <th>Hạn nộp</th>
                                                    <th className="text-center">Số file mẫu</th>
                                                    <th className="text-center">Thao tác</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredCategories.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="9" className="text-center text-muted py-4">
                                                            {categories.length === 0 
                                                                ? 'Chưa có danh mục nào'
                                                                : 'Không có kết quả phù hợp với bộ lọc'}
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    filteredCategories.map((cat) => (
                                                        <tr 
                                                            key={cat.id}
                                                            onClick={() => handleEditCategory(cat)}
                                                            style={{ cursor: 'pointer' }}
                                                            onMouseEnter={(e) => {
                                                                e.currentTarget.style.backgroundColor = '#f8f9fa';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.currentTarget.style.backgroundColor = '';
                                                            }}
                                                        >
                                                            <td><strong>{cat.code}</strong></td>
                                                            <td>{cat.name}</td>
                                                            <td>{cat.description ? cat.description.substring(0, 50) + '...' : '-'}</td>
                                                            <td>
                                                                {cat.created_at ? new Date(cat.created_at).toLocaleString('vi-VN') : <span className="text-muted">—</span>}
                                                            </td>
                                                            <td>
                                                                {cat.created_by_name ? cat.created_by_name : <span className="text-muted">—</span>}
                                                            </td>
                                                            <td style={{ maxWidth: '200px', wordWrap: 'break-word' }}>
                                                                {cat.assigned_to_names ? cat.assigned_to_names : <span className="text-muted">—</span>}
                                                            </td>
                                                            <td style={{ whiteSpace: 'nowrap', fontSize: '0.9rem' }}>
                                                                {cat.earliest_due_at ? new Date(cat.earliest_due_at).toLocaleString('vi-VN') : <span className="text-muted">—</span>}
                                                            </td>
                                                            <td className="text-center">
                                                                <Badge bg="secondary">{cat.template_file_count != null ? cat.template_file_count : 0}</Badge>
                                                            </td>
                                                            <td className="text-center">
                                                                <Button 
                                                                    size="sm" 
                                                                    variant="outline-danger"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDeleteCategory(cat.id);
                                                                    }}
                                                                >
                                                                    <i className="fas fa-trash"></i>
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                    </Tab>

                    <Tab eventKey="submissions" title={
                        <span className="tab-title">
                            <i className="fas fa-file-alt"></i>
                            Bài nộp minh chứng
                        </span>
                    }>
                                {/* Filters for Submissions */}
                                <div className="session-list-controls">
                                    <div className="search-controls">
                                        <div className="search-input" style={{ minWidth: '200px', flex: '1' }}>
                                            <input
                                                type="text"
                                                placeholder="Tìm theo mã..."
                                                value={submissionFilters.searchCode}
                                                onChange={(e) => setSubmissionFilters({ ...submissionFilters, searchCode: e.target.value })}
                                                style={{ width: '100%' }}
                                            />
                                        </div>

                                        <div className="search-input" style={{ minWidth: '200px', flex: '1' }}>
                                            <input
                                                type="text"
                                                placeholder="Tìm theo tên minh chứng..."
                                                value={submissionFilters.searchName}
                                                onChange={(e) => setSubmissionFilters({ ...submissionFilters, searchName: e.target.value })}
                                                style={{ width: '100%' }}
                                            />
                                        </div>

                                        <select
                                            className="filter-select"
                                            value={submissionFilters.submittedBy}
                                            onChange={(e) => setSubmissionFilters({ ...submissionFilters, submittedBy: e.target.value })}
                                        >
                                            <option value="">Tất cả người nộp</option>
                                            {uniqueSubmittedUsers.map((user) => (
                                                <option key={user} value={user}>
                                                    {user}
                                                </option>
                                            ))}
                                        </select>

                                        <select
                                            className="filter-select"
                                            value={submissionFilters.status}
                                            onChange={(e) => setSubmissionFilters({ ...submissionFilters, status: e.target.value })}
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
                                            value={submissionFilters.dateFrom}
                                            onChange={(e) => setSubmissionFilters({ ...submissionFilters, dateFrom: e.target.value })}
                                            style={{ minWidth: '180px' }}
                                        />

                                        <input
                                            type="datetime-local"
                                            className="filter-select"
                                            placeholder="Đến ngày giờ"
                                            value={submissionFilters.dateTo}
                                            onChange={(e) => setSubmissionFilters({ ...submissionFilters, dateTo: e.target.value })}
                                            style={{ minWidth: '180px' }}
                                        />
                                    </div>
                                </div>

                                <div className="session-table-container">
                                    <div className="table-responsive-mobile">
                                        <table className="session-table staff-table">
                                            <thead>
                                                <tr>
                                                    <th>Mã minh chứng</th>
                                                    <th>Tên minh chứng</th>
                                                    <th>Người nộp</th>
                                                    <th>Trạng thái</th>
                                                    <th className="text-center">Số file</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredSubmissions.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="5" className="text-center text-muted py-4">
                                                            {submissions.length === 0 
                                                                ? 'Chưa có bài nộp nào'
                                                                : 'Không có kết quả phù hợp với bộ lọc'}
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    filteredSubmissions.map((sub) => (
                                                        <tr 
                                                            key={sub.id}
                                                            onClick={() => handleReview(sub)}
                                                            style={{ cursor: 'pointer' }}
                                                            onMouseEnter={(e) => {
                                                                e.currentTarget.style.backgroundColor = '#f8f9fa';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.currentTarget.style.backgroundColor = '';
                                                            }}
                                                        >
                                                            <td><strong>{sub.code}</strong></td>
                                                            <td>{sub.category_name}</td>
                                                            <td>{sub.submitted_by_name}</td>
                                                            <td>{getStatusBadge(sub.status, sub.submitted_at, sub.reviewed_at)}</td>
                                                            <td className="text-center">
                                                                <Badge bg="primary">{sub.file_count}</Badge>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                    </Tab>
                </Tabs>
            </div>

            {/* Create/Edit Category Modal */}
            <Modal 
                show={showModal} 
                onHide={() => setShowModal(false)}
                size="lg"
                className="student-detail-modal"
            >
                <Modal.Header closeButton className="student-detail-header">
                    <Modal.Title className="student-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-folder"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">{selectedCategory ? 'Chỉnh sửa danh mục' : 'Tạo danh mục mới'}</h4>
                            <p className="mb-0 student-subtitle">Thiết lập danh mục minh chứng và gán staff phụ trách</p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="student-detail-body">
                    <div className="student-detail-container">
                    <Form>
                        <Row className="mb-3">
                            {/* Thông tin cơ bản */}
                            <Col md={6}>
                                <div className="info-section h-100">
                                    <h6 className="fw-bold text-primary mb-3">
                                        <i className="fas fa-info-circle me-2"></i>
                                        Thông tin cơ bản
                                    </h6>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Mã minh chứng <span className="text-danger">*</span></Form.Label>
                                        <Form.Control
                                            type="text"
                                            value={form.code}
                                            onChange={(e) => setForm({ ...form, code: e.target.value })}
                                            placeholder="VD: MC-01"
                                        />
                                    </Form.Group>

                                    <Form.Group className="mb-3">
                                        <Form.Label>Tên minh chứng <span className="text-danger">*</span></Form.Label>
                                        <Form.Control
                                            type="text"
                                            value={form.name}
                                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                                            placeholder="Nhập tên minh chứng"
                                        />
                                    </Form.Group>

                                    <Form.Group className="mb-0">
                                        <Form.Label>Mô tả</Form.Label>
                                        <Form.Control
                                            as="textarea"
                                            rows={3}
                                            value={form.description}
                                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                                            placeholder="Mô tả chi tiết về minh chứng"
                                        />
                                    </Form.Group>
                                </div>
                            </Col>

                            {/* Gán minh chứng cho Staff */}
                            <Col md={6}>
                                <div className="info-section h-100">
                                    <h6 className="fw-bold text-primary mb-3">
                                        <i className="fas fa-user-plus me-2"></i>
                                        Gán minh chứng cho Staff
                                    </h6>

                                    <Form.Group className="mb-3">
                                        <Form.Label>Tìm staff</Form.Label>
                                        <Form.Control
                                            type="text"
                                            value={staffSearch}
                                            onChange={(e) => setStaffSearch(e.target.value)}
                                            placeholder="Tìm theo tên / username / email..."
                                        />
                                    </Form.Group>

                                    <Form.Group className="mb-3">
                                        <Form.Label>Ghi chú (tùy chọn)</Form.Label>
                                        <Form.Control
                                            type="text"
                                            value={assignNotes}
                                            onChange={(e) => setAssignNotes(e.target.value)}
                                            placeholder="Áp dụng cho staff mới được gán"
                                        />
                                    </Form.Group>

                                    <Form.Group className="mb-3">
                                        <Form.Label>Hạn nộp (tùy chọn)</Form.Label>
                                        <Form.Control
                                            type="datetime-local"
                                            value={assignDueAt}
                                            onChange={(e) => setAssignDueAt(e.target.value)}
                                            placeholder="Chọn ngày giờ hạn nộp"
                                        />
                                        <Form.Text className="text-muted">Áp dụng cho tất cả người được gán trong danh mục khi lưu</Form.Text>
                                    </Form.Group>

                                    <div style={{ maxHeight: 200, overflowY: 'auto' }} className="border rounded p-2">
                                        {evidenceStaffUsers
                                            .filter(u => {
                                                const term = staffSearch.trim().toLowerCase();
                                                if (!term) return true;
                                                return (
                                                    (u.full_name || '').toLowerCase().includes(term) ||
                                                    (u.username || '').toLowerCase().includes(term) ||
                                                    (u.email || '').toLowerCase().includes(term)
                                                );
                                            })
                                            .map(u => (
                                                <Form.Check
                                                    key={u.id}
                                                    type="checkbox"
                                                    id={`assign-staff-${u.id}`}
                                                    checked={selectedStaffIds.includes(u.id)}
                                                    onChange={() => toggleStaffSelection(u.id)}
                                                    label={
                                                        <span>
                                                            <strong>{u.full_name || u.username}</strong>
                                                            <small className="text-muted ms-2">
                                                                {u.username}{u.email ? ` • ${u.email}` : ''}
                                                            </small>
                                                        </span>
                                                    }
                                                    className="mb-2"
                                                />
                                            ))}

                                        {evidenceStaffUsers.length === 0 && (
                                            <div className="text-muted">
                                                Không có user nào có role <code>evidence_staff</code>.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Col>
                        </Row>

                        {/* File Template Section */}
                        <div className="session-card mb-3">
                            <div className="card-header-modern">
                                <div className="header-icon">
                                    <i className="fas fa-file"></i>
                                </div>
                                <h6 className="mb-0">File mẫu</h6>
                            </div>
                            <div className="card-body-modern">
                                <Row>
                                    {/* Upload Area */}
                                    <Col md={4}>
                                        <div className="file-upload-container">
                                            <input 
                                                type="file" 
                                                id="template-file-upload"
                                                className="file-upload-input" 
                                                onChange={handleTemplateFileSelect}
                                                disabled={templateUploading}
                                                multiple
                                                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.zip,.rar"
                                            />
                                            <label htmlFor="template-file-upload" className="file-upload-label-custom">
                                                <div className="file-upload-icon">
                                                    <i className="fas fa-cloud-upload-alt"></i>
                                                </div>
                                                <div className="file-upload-text">
                                                    <span className="file-upload-title">
                                                        {templateFiles.length > 0 ? `Đã chọn ${templateFiles.length} file` : 'Chọn file mẫu để upload'}
                                                    </span>
                                                    <span className="file-upload-subtitle">
                                                        {templateFiles.length > 0 ? 'Click để chọn thêm file' : 'Tối đa 100MB/file. Hỗ trợ: PDF, Word, Excel, PowerPoint, Image, ZIP'}
                                                    </span>
                                                </div>
                                            </label>
                                        </div>
                                    </Col>

                                    {/* File List */}
                                    <Col md={8}>
                                        {(templateUrls.length > 0 || templateFiles.length > 0) && (
                                            <div className="file-grid">
                                                {/* Existing template URLs */}
                                                {templateUrls.map((url, index) => {
                                                    const fileName = url.split('/').pop() || 'File mẫu';
                                                    const fileType = fileName.split('.').pop()?.toLowerCase() || '';
                                                    const isPdf = fileType === 'pdf';
                                                    const templateFile = {
                                                        file_name: fileName,
                                                        file_path: url,
                                                        file_type: fileType
                                                    };
                                                    return (
                                                        <div 
                                                            key={`url-${index}`} 
                                                            className="file-card"
                                                            onClick={isPdf ? () => handlePreviewFile(templateFile) : undefined}
                                                            style={{ 
                                                                border: '1px solid #e9ecef', 
                                                                borderRadius: '12px', 
                                                                padding: '1rem',
                                                                cursor: isPdf ? 'pointer' : 'default'
                                                            }}
                                                        >
                                                            <div className="file-header">
                                                                <div className="file-icon">
                                                                    <i className={getFileIcon(fileType)}></i>
                                                                </div>
                                                                <div className="file-actions">
                                                                    {!isPdf && (
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline-primary"
                                                                            href={getAbsoluteFileUrl(url)}
                                                                            download
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            title="Tải về"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}
                                                                        >
                                                                            <i className="fas fa-download"></i>
                                                                        </Button>
                                                                    )}
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline-danger"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            removeTemplateUrl(index);
                                                                        }}
                                                                        title="Gỡ file mẫu"
                                                                        style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}
                                                                    >
                                                                        <i className="fas fa-times"></i>
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                            <div className="file-info-container file-info-visible">
                                                                <div className="file-info">
                                                                    <div className="file-name">{fileName}</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                
                                                {/* New template files */}
                                                {templateFiles.map((file, index) => {
                                                    const fileType = file.name.split('.').pop()?.toLowerCase() || '';
                                                    const isPdf = fileType === 'pdf';
                                                    const templateFile = {
                                                        file_name: file.name,
                                                        file_path: URL.createObjectURL(file),
                                                        file_type: fileType
                                                    };
                                                    return (
                                                        <div 
                                                            key={`file-${index}`} 
                                                            className="file-card"
                                                            onClick={isPdf ? () => handlePreviewFile(templateFile) : undefined}
                                                            style={{ 
                                                                border: '1px solid #e9ecef', 
                                                                borderRadius: '12px', 
                                                                padding: '1rem',
                                                                cursor: isPdf ? 'pointer' : 'default'
                                                            }}
                                                        >
                                                            <div className="file-header">
                                                                <div className="file-icon">
                                                                    <i className={getFileIcon(fileType)}></i>
                                                                </div>
                                                                <div className="file-actions">
                                                                    {!isPdf && (
                                                                        <a
                                                                            href={URL.createObjectURL(file)}
                                                                            download={file.name}
                                                                            className="btn btn-sm btn-outline-primary"
                                                                            title="Tải về"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}
                                                                        >
                                                                            <i className="fas fa-download"></i>
                                                                        </a>
                                                                    )}
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline-danger"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            removeTemplateFile(index);
                                                                        }}
                                                                        title="Gỡ file"
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
                    <Button variant="outline-secondary" onClick={() => setShowModal(false)} className="btn-cancel">
                        <i className="fas fa-times me-2"></i>
                        Hủy
                    </Button>
                    <Button variant="primary" onClick={handleSaveCategory} className="btn-edit" disabled={templateUploading || categorySaving}>
                        {templateUploading ? (
                            <>
                                <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                                Đang upload...
                            </>
                        ) : categorySaving ? (
                            <>
                                <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                                Đang gửi
                            </>
                        ) : (
                            <>
                                <i className="fas fa-save me-2"></i>
                                Lưu
                            </>
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Review Modal */}
            <Modal 
                show={showReviewModal} 
                onHide={() => setShowReviewModal(false)}
                size="lg"
                className="student-detail-modal"
            >
                <Modal.Header closeButton className="student-detail-header">
                    <Modal.Title className="student-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-clipboard-check"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Rà soát minh chứng</h4>
                            <p className="mb-0 student-subtitle">Xem file và phản hồi trạng thái</p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="student-detail-body">
                    <div className="student-detail-container">
                    {selectedSubmission && (
                        <>
                            <Row className="mb-3">
                                {/* Thông tin minh chứng */}
                                <Col md={6}>
                                    <div className="info-section h-100">
                                        <h6 className="fw-bold text-primary mb-3">
                                            <i className="fas fa-info-circle me-2"></i>
                                            Thông tin minh chứng
                                        </h6>
                                        <div className="info-item1 mb-2">
                                            <strong>Mã:</strong> {selectedSubmission.code}
                                        </div>
                                        <div className="info-item1 mb-2">
                                            <strong>Tên:</strong> {selectedSubmission.category_name}
                                        </div>
                                        <div className="info-item1 mb-2">
                                            <strong>Người nộp:</strong> {selectedSubmission.submitted_by_name}
                                        </div>
                                        <div className="info-item1 mb-2 d-flex align-items-center gap-2">
                                            <strong>Trạng thái:</strong> {getStatusBadge(selectedSubmission.status)}
                                        </div>
                                        {selectedSubmission.submitted_at && (
                                            <div className="info-item1 mb-2">
                                                <strong>Thời gian gửi:</strong>{' '}
                                                {new Date(selectedSubmission.submitted_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, day: '2-digit', month: '2-digit', year: 'numeric' })}
                                            </div>
                                        )}
                                        {selectedSubmission.status === 'approved' && selectedSubmission.reviewed_at && (
                                            <div className="info-item1 mb-2">
                                                <strong>Thời gian đáp ứng:</strong>{' '}
                                                {new Date(selectedSubmission.reviewed_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, day: '2-digit', month: '2-digit', year: 'numeric' })}
                                            </div>
                                        )}
                                        <div className="info-item1 mb-0">
                                            <strong>Mô tả:</strong> {selectedSubmission.category_description || '—'}
                                        </div>
                                    </div>
                                </Col>

                                {/* Rà soát và phản hồi */}
                                <Col md={6}>
                                    {selectedSubmission.status === 'submitted' ? (
                                        <div className="info-section h-100">
                                            <h6 className="fw-bold text-primary mb-3">
                                                <i className="fas fa-edit me-2"></i>
                                                Rà soát và phản hồi
                                            </h6>
                                            <Form>
                                                <Form.Group className="mb-3">
                                                    <Form.Label className="d-block">Trạng thái rà soát <span className="text-danger">*</span></Form.Label>
                                                    <div className="d-flex gap-2 flex-wrap">
                                                        <Button
                                                            type="button"
                                                            variant={reviewForm.status === 'approved' ? 'success' : 'outline-success'}
                                                            onClick={() => setReviewForm({ ...reviewForm, status: 'approved' })}
                                                            className="d-flex align-items-center"
                                                        >
                                                            <i className="fas fa-check-circle me-2"></i>
                                                            Đáp ứng
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant={reviewForm.status === 'needs_revision' ? 'danger' : 'outline-danger'}
                                                            onClick={() => setReviewForm({ ...reviewForm, status: 'needs_revision' })}
                                                            className="d-flex align-items-center"
                                                        >
                                                            <i className="fas fa-edit me-2"></i>
                                                            Chỉnh sửa
                                                        </Button>
                                                    </div>
                                                </Form.Group>

                                                <Form.Group className="mb-0">
                                                    <Form.Control
                                                        as="textarea"
                                                        rows={5}
                                                        value={reviewForm.reviewNotes}
                                                        onChange={(e) => setReviewForm({ ...reviewForm, reviewNotes: e.target.value })}
                                                        placeholder="Nhập phản hồi cho staff"
                                                    />
                                                </Form.Group>
                                            </Form>
                                        </div>
                                    ) : selectedSubmission.review_notes ? (
                                        <div className="info-section h-100">
                                            <h6 className="fw-bold text-primary mb-3">
                                                <i className="fas fa-comment-dots me-2"></i>
                                                Phản hồi
                                            </h6>
                                            <div className="info-item1">
                                                <p className="mb-0">{selectedSubmission.review_notes}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="info-section h-100">
                                            <h6 className="fw-bold text-primary mb-3">
                                                <i className="fas fa-comment-dots me-2"></i>
                                                Phản hồi
                                            </h6>
                                            <div className="info-item1">
                                                <p className="mb-0 text-muted">Chưa có phản hồi</p>
                                            </div>
                                        </div>
                                    )}
                                </Col>
                            </Row>

                            {/* Files Section */}
                            <div className="session-card mb-3">
                                <div className="card-header-modern">
                                    <div className="header-icon">
                                        <i className="fas fa-paperclip"></i>
                                    </div>
                                    <h6 className="mb-0">Danh sách file</h6>
                                    <span className="badge bg-primary bg-opacity-10 text-primary px-3 py-2">
                                        {files.length} {files.length === 1 ? 'file' : 'files'}
                                    </span>
                                </div>
                                <div className="card-body-modern">
                                    {files.length === 0 ? (
                                        <div className="text-center text-muted p-4">
                                            <div className="rounded-circle bg-light d-inline-flex align-items-center justify-content-center mb-3" style={{width: '60px', height: '60px'}}>
                                                <i className="fas fa-file-upload fa-2x text-muted"></i>
                                            </div>
                                            <p className="mb-0">Chưa có file nào</p>
                                        </div>
                                    ) : (
                                        <div className="file-grid">
                                            {files.map((file) => (
                                                <div 
                                                    key={file.id} 
                                                    className="file-card"
                                                    onClick={() => handlePreviewFile(file)}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    {/* File header */}
                                                    <div className="file-header">
                                                        <div className="file-icon">
                                                            <i className={getFileIcon(file.file_type)}></i>
                                                        </div>
                                                        <div className="file-actions">
                                                            <Button 
                                                                size="sm"
                                                                variant="outline-primary"
                                                                href={getAbsoluteFileUrl(file.file_path)}
                                                                download
                                                                title="Tải về"
                                                                onClick={(e) => {
                                                                    e.stopPropagation(); // Prevent opening preview when clicking download
                                                                }}
                                                                style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}
                                                            >
                                                                <i className="fas fa-download"></i>
                                                            </Button>
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
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                    </div>
                </Modal.Body>
                <Modal.Footer className="student-detail-footer">
                    <Button variant="outline-secondary" onClick={() => setShowReviewModal(false)} className="btn-cancel">
                        <i className="fas fa-times me-2"></i>
                        Đóng
                    </Button>
                    {selectedSubmission?.status === 'submitted' && (
                        <Button variant="primary" onClick={handleSaveReview} className="btn-edit" disabled={reviewSaving}>
                            {reviewSaving ? (
                                <>
                                    <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                                    Đang gửi
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-check me-2"></i>
                                    Gửi phản hồi
                                </>
                            )}
                        </Button>
                    )}
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
                                <a
                                    href={getAbsoluteFileUrl(previewFile.file_path)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: 'inherit', textDecoration: 'none', fontSize: '16px' }}
                                    title="Mở file ở tab mới"
                                >
                                    <i className="fas fa-external-link-alt"></i>
                                </a>
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
        </Container>
        </div>
    );
};

export default EvidenceStorageManagement;

// Add CSS for file grid layout and info sections (same style as MonitoringPage)
const fileGridStyle = document.createElement('style');
fileGridStyle.textContent = `
  /* Info Sections */
  .info-section {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 1rem;
    border-left: 4px solid #007bff;
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  
  .info-item1 {
    display: block;
    padding: 0.5rem 0;
  }
  
  .info-item1 strong {
    color: #495057;
    margin-right: 0.5rem;
  }
  
  .session-card {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  
  .session-card .card-body-modern {
    flex: 1;
  }
  
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
  
  .file-upload-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: #dc3545;
    border-radius: 50%;
    color: white;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease-in-out;
    flex-shrink: 0;
  }
  
  .file-upload-remove:hover {
    background: #c82333;
    transform: scale(1.1);
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
    
    .info-section {
      padding: 0.75rem;
    }
    
    .info-item1 {
      padding: 0.375rem 0;
      font-size: 0.9rem;
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
    
    .file-upload-remove {
      width: 28px;
      height: 28px;
      font-size: 12px;
    }
  }
`;
if (!document.head.querySelector('style[data-evidence-file-grid]')) {
    fileGridStyle.setAttribute('data-evidence-file-grid', 'true');
    document.head.appendChild(fileGridStyle);
}
