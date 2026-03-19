import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Badge, Spinner, Alert, Modal, Form, Button } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import Pagination from '../../components/Pagination';
import '../../styles/user.css';
import usePageTitle from '../../hooks/usePageTitle';

// Phân mục cho dễ chọn – mỗi mục có thể chọn Quản lý hoặc Nhân viên
const QA_ROLE_SECTIONS = [
    {
        sectionLabel: 'Quản trị toàn bộ Đảm bảo chất lượng',
        options: [
            { value: 'qualityassurance_admin', label: 'Quản trị viên' }
        ]
    },
    {
        sectionLabel: 'Lưu trữ minh chứng',
        options: [
            { value: 'evidence_mod', label: 'Quản lý' },
            { value: 'evidence_staff', label: 'Nhân viên' }
        ]
    },
    {
        sectionLabel: 'Tiêu chuẩn – tiêu chí – chỉ báo – cải tiến',
        options: [
            { value: 'qastandard_mod', label: 'Quản lý' },
            { value: 'qastandard_staff', label: 'Nhân viên' }
        ]
    },
    {
        sectionLabel: 'Báo cáo tự đánh giá theo tiêu chí',
        options: [
            { value: 'qaselfassessment_mod', label: 'Quản lý' },
            { value: 'qaselfassessment_staff', label: 'Nhân viên' }
        ]
    },
    {
        sectionLabel: 'Chương trình đào tạo',
        options: [
            { value: 'qatrainingprogram_mod', label: 'Quản lý' },
            { value: 'qatrainingprogram_staff', label: 'Nhân viên' }
        ]
    },
    {
        sectionLabel: 'KPI chất lượng',
        options: [
            { value: 'qakpi_mod', label: 'Quản lý' },
            { value: 'qakpi_staff', label: 'Nhân viên' }
        ]
    }
];

// Danh sách phẳng: mỗi role có displayLabel (mục + vai trò) để hiển thị trong bảng
const QA_ROLE_OPTIONS = [
    { value: '', label: 'Không có quyền', displayLabel: 'Không có quyền' },
    ...QA_ROLE_SECTIONS.flatMap(s =>
        s.options.map(o => ({
            value: o.value,
            label: o.label,
            displayLabel: `${s.sectionLabel} – ${o.label}`
        }))
    )
];
const QA_ROLE_KEYS = QA_ROLE_OPTIONS.filter(o => o.value).map(o => o.value);

// Mô tả quyền theo nhóm (Đảm bảo chất lượng có nhiều mục)
const QA_ROLE_DESCRIPTIONS = {
    qualityassurance_admin: {
        label: 'Quản trị viên',
        desc: 'Toàn quyền module Đảm bảo chất lượng: quản lý người dùng, phân quyền, tất cả mục (Lưu trữ minh chứng, Tiêu chuẩn – tiêu chí, Báo cáo tự đánh giá, Chương trình đào tạo, KPI chất lượng).'
    },
    _mod: {
        label: 'Quản lý (từng mục)',
        desc: 'Quản lý nội dung và cấu hình trong mục được gán (thêm/sửa/xóa, duyệt).'
    },
    _staff: {
        label: 'Nhân viên (từng mục)',
        desc: 'Xem và thao tác theo mục được gán (nhập liệu, nộp minh chứng, không quản lý người dùng).'
    }
};

const QualityAssuranceUserManagement = () => {
    usePageTitle('Quản lý người dùng Đảm bảo chất lượng');
    const { showAlert } = useAlert();
    const { api, currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        totalItems: 0,
        totalPages: 0
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [isMobile, setIsMobile] = useState(false);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [roleFormData, setRoleFormData] = useState(() => ({}));
    const [showAddUserModal, setShowAddUserModal] = useState(false);
    const [addUserForm, setAddUserForm] = useState({
        username: '',
        email: '',
        full_name: '',
        password: '',
        qaRolesBySection: {} // { sectionIndex: roleValue } giống roleFormData
    });
    const [addUserLoading, setAddUserLoading] = useState(false);
    const [addUserError, setAddUserError] = useState('');
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);
    const [removeLoading, setRemoveLoading] = useState(false);
    const [showEditUserModal, setShowEditUserModal] = useState(false);
    const [userToEdit, setUserToEdit] = useState(null);
    const [editUserForm, setEditUserForm] = useState({ full_name: '', email: '', password: '' });
    const [editUserLoading, setEditUserLoading] = useState(false);
    const [editUserError, setEditUserError] = useState('');
    const [approvalStatusFilter, setApprovalStatusFilter] = useState('all');
    const [approveLoading, setApproveLoading] = useState(false);
    const [approvingUserId, setApprovingUserId] = useState(null);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth <= 768);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            setError('');
            const response = await api.get('/quality-assurance/users');
            if (response.data.success) {
                const data = response.data.data || [];
                setUsers(data);
                setPagination(prev => ({
                    ...prev,
                    totalItems: data.length,
                    totalPages: Math.max(1, Math.ceil(data.length / prev.limit))
                }));
            } else {
                setError(response.data.message || 'Không thể tải danh sách');
            }
        } catch (err) {
            console.error('Error fetching QA users:', err);
            setError(err.response?.data?.message || 'Không thể tải danh sách người dùng');
            setUsers([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const formatModuleRole = (roleKey) => {
        const opt = QA_ROLE_OPTIONS.find(o => o.value === roleKey);
        return opt ? (opt.displayLabel || opt.label) : roleKey;
    };

    const getQARoleBadge = (user) => {
        const moduleRoles = user.module_roles || [];
        const qaRoles = QA_ROLE_KEYS.filter(r => moduleRoles.includes(r));
        if (qaRoles.length === 0) return <span className="text-muted">—</span>;
        return (
            <span
                className="qa-role-badges"
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.35rem',
                    maxWidth: '100%',
                    minWidth: 0
                }}
            >
                {qaRoles.map(roleKey => {
                    const isAdmin = roleKey === 'qualityassurance_admin';
                    const isMod = roleKey.endsWith('_mod');
                    return (
                        <Badge
                            key={roleKey}
                            bg={isAdmin ? 'danger' : isMod ? 'warning' : 'info'}
                            style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                            {formatModuleRole(roleKey)}
                        </Badge>
                    );
                })}
            </span>
        );
    };

    const filteredUsers = React.useMemo(() => {
        let list = users;
        if (approvalStatusFilter === 'pending') list = list.filter(u => !u.approved);
        if (debouncedSearchTerm.trim()) {
            const term = debouncedSearchTerm.toLowerCase();
            list = list.filter(u =>
                (u.full_name || '').toLowerCase().includes(term) ||
                (u.username || '').toLowerCase().includes(term) ||
                (u.email || '').toLowerCase().includes(term)
            );
        }
        return list;
    }, [users, approvalStatusFilter, debouncedSearchTerm]);

    const paginatedUsers = React.useMemo(() => {
        const start = (pagination.page - 1) * pagination.limit;
        return filteredUsers.slice(start, start + pagination.limit);
    }, [filteredUsers, pagination.page, pagination.limit]);

    const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pagination.limit));

    useEffect(() => {
        if (pagination.page > totalPages && totalPages >= 1) {
            setPagination(prev => ({ ...prev, page: 1 }));
        }
    }, [totalPages, pagination.page]);

    const hasQAAccess = () => {
        return (currentUser?.module_roles || []).includes('qualityassurance_admin');
    };

    const canAssignQARoles = () => {
        return (currentUser?.module_roles || []).includes('qualityassurance_admin');
    };

    const getBaseRoleRank = (role) => {
        if (role === 'superadmin') return 3;
        if (role === 'admin') return 2;
        if (role === 'staff') return 1;
        if (role === 'student') return 0;
        return 0;
    };

    // Chỉ cho phép "Chỉnh sửa thông tin người dùng" khi:
    // - User mục tiêu đã có ít nhất một role Đảm bảo chất lượng (QA_ROLE_KEYS)
    // - Base role (superadmin > admin > staff > student) của currentUser >= base role của user mục tiêu
    const canEditUserInfo = (user) => {
        const roles = user.module_roles || [];
        const hasQARole = QA_ROLE_KEYS.some(r => roles.includes(r));
        if (!hasQARole) return false;

        const currentBaseRank = getBaseRoleRank(currentUser?.role);
        const targetBaseRank = getBaseRoleRank(user.role);
        return currentBaseRank >= targetBaseRank;
    };

    const handleOpenRoleModal = (user) => {
        setSelectedUser(user);
        const moduleRoles = user.module_roles || [];
        const bySection = {};
        QA_ROLE_SECTIONS.forEach((section, idx) => {
            const sectionValues = section.options.map(o => o.value);
            const found = sectionValues.find(r => moduleRoles.includes(r));
            bySection[idx] = found || '';
        });
        setRoleFormData(bySection);
        setShowRoleModal(true);
    };

    const handleSaveRole = async () => {
        if (!selectedUser) return;
        try {
            setLoading(true);
            const selectedQARoles = Object.values(roleFormData).filter(Boolean);
            const moduleRoles = (selectedUser.module_roles || []).filter(r => !QA_ROLE_KEYS.includes(r));
            moduleRoles.push(...selectedQARoles);
            const response = await api.put(`/users/${selectedUser.id}`, { module_roles: moduleRoles });
            if (response.data.success) {
                showAlert('Cập nhật quyền Đảm bảo chất lượng thành công', 'success');
                setShowRoleModal(false);
                fetchUsers();
            } else {
                setError(response.data.message || 'Không thể cập nhật quyền');
            }
        } catch (err) {
            console.error('Error saving QA role:', err);
            setError(err.response?.data?.message || 'Không thể cập nhật quyền');
        } finally {
            setLoading(false);
        }
    };

    const openAddUserModal = () => {
        setAddUserError('');
        setAddUserForm({
            username: '',
            email: '',
            full_name: '',
            password: '',
            qaRolesBySection: { 1: 'evidence_staff' } // mặc định: Lưu trữ minh chứng – Nhân viên
        });
        setShowAddUserModal(true);
    };

    const handleAddUserSubmit = async (e) => {
        e.preventDefault();
        setAddUserError('');
        const { username, email, full_name, password, qaRolesBySection } = addUserForm;
        if (!username?.trim() || !email?.trim() || !full_name?.trim() || !password) {
            setAddUserError('Vui lòng điền đầy đủ tên đăng nhập, email, họ tên và mật khẩu.');
            return;
        }
        const qa_roles = Object.values(qaRolesBySection || {}).filter(Boolean);
        if (qa_roles.length === 0) {
            setAddUserError('Vui lòng chọn ít nhất một vai trò Đảm bảo chất lượng.');
            return;
        }
        try {
            setAddUserLoading(true);
            const response = await api.post('/quality-assurance/users', {
                username: username.trim(),
                email: email.trim(),
                full_name: full_name.trim(),
                password,
                qa_roles
            });
            if (response.data.success) {
                showAlert(response.data.message || 'Đã tạo người dùng thành công', 'success');
                setShowAddUserModal(false);
                fetchUsers();
            } else {
                setAddUserError(response.data.message || 'Không thể tạo người dùng');
            }
        } catch (err) {
            setAddUserError(err.response?.data?.message || 'Không thể tạo người dùng');
        } finally {
            setAddUserLoading(false);
        }
    };

    const handleApproveUser = async (e, userId) => {
        e.stopPropagation();
        try {
            setApprovingUserId(userId);
            setApproveLoading(true);
            const response = await api.post(`/quality-assurance/users/${userId}/approve`);
            if (response.data.success) {
                showAlert(response.data.message || 'Đã duyệt người dùng thành công', 'success');
                fetchUsers();
            } else {
                showAlert(response.data.message || 'Không thể duyệt', 'danger');
            }
        } catch (err) {
            showAlert(err.response?.data?.message || 'Không thể duyệt người dùng', 'danger');
        } finally {
            setApprovingUserId(null);
            setApproveLoading(false);
        }
    };

    const openDeleteModal = (e, user) => {
        e.stopPropagation();
        setUserToDelete(user);
        setShowDeleteModal(true);
    };

    const openEditUserModal = (e, user) => {
        e.stopPropagation();
        setUserToEdit(user);
        setEditUserForm({
            full_name: user.full_name || '',
            email: user.email || '',
            password: ''
        });
        setEditUserError('');
        setShowEditUserModal(true);
    };

    const handleEditUserSubmit = async (e) => {
        e.preventDefault();
        if (!userToEdit) return;
        setEditUserError('');
        const { full_name, email, password } = editUserForm;
        if (!full_name?.trim() || !email?.trim()) {
            setEditUserError('Vui lòng điền đầy đủ Họ tên và Email.');
            return;
        }
        try {
            setEditUserLoading(true);
            const payload = {
                fullName: full_name.trim(),
                email: email.trim()
            };
            if (password && password.trim()) {
                payload.password = password;
            }
            const response = await api.put(`/users/${userToEdit.id}`, payload);
            if (response.data.success) {
                showAlert('Cập nhật thông tin người dùng thành công', 'success');
                setShowEditUserModal(false);
                setUserToEdit(null);
                fetchUsers();
            } else {
                setEditUserError(response.data.message || 'Không thể cập nhật thông tin');
            }
        } catch (err) {
            setEditUserError(err.response?.data?.message || 'Không thể cập nhật thông tin người dùng');
        } finally {
            setEditUserLoading(false);
        }
    };

    const closeDeleteModal = () => {
        if (!removeLoading) {
            setShowDeleteModal(false);
            setUserToDelete(null);
        }
    };

    const handleConfirmRemove = async () => {
        if (!userToDelete) return;
        try {
            setRemoveLoading(true);
            const response = await api.delete(`/quality-assurance/users/${userToDelete.id}/list`);
            if (response.data.success) {
                showAlert(response.data.message || 'Đã xóa khỏi danh sách', 'success');
                setShowDeleteModal(false);
                setUserToDelete(null);
                fetchUsers();
            } else {
                showAlert(response.data.message || 'Không thể xóa khỏi danh sách', 'danger');
            }
        } catch (err) {
            showAlert(err.response?.data?.message || 'Không thể xóa khỏi danh sách', 'danger');
        } finally {
            setRemoveLoading(false);
        }
    };

    if (!hasQAAccess()) {
        return (
            <Container className="mt-4">
                <Alert variant="danger">Bạn không có quyền xem trang này.</Alert>
            </Container>
        );
    }

    return (
        <div>
            <div className="session-header">
                <div className="header-content d-flex flex-wrap align-items-center justify-content-between gap-3">
                    <div className="header-title">
                        <h1>Quản lý người dùng Đảm bảo chất lượng</h1>
                        <p className="header-subtitle">
                            Danh sách người dùng có quyền trong module Đảm bảo chất lượng
                        </p>
                    </div>
                    {canAssignQARoles() && (
                        <Button
                            variant="outline-light"
                            className="create-session-btn"
                            onClick={openAddUserModal}
                        >
                            <i className="fas fa-plus"></i>
                            Thêm người dùng mới
                        </Button>
                    )}
                </div>
            </div>

            {error && (
                <Alert variant="danger" onClose={() => setError('')} dismissible>
                    {error}
                </Alert>
            )}

            <div className="session-list-controls">
                <div className="search-controls w-100 d-flex flex-wrap align-items-center gap-2">
                    <div className="search-input flex-grow-1" style={{ minWidth: '200px' }}>
                        <input
                            type="text"
                            placeholder="Tìm kiếm người dùng..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input w-100"
                            style={{ width: '100%' }}
                        />
                    </div>
                    <Form.Select
                        value={approvalStatusFilter}
                        onChange={(e) => { setApprovalStatusFilter(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                        style={{ width: 'auto', minWidth: '140px' }}
                        className="form-control-modern"
                    >
                        <option value="all">Tất cả trạng thái</option>
                        <option value="pending">Chờ duyệt</option>
                    </Form.Select>
                </div>
            </div>

            <div className="session-table-container">
                <div className="table-responsive-mobile">
                    <table className="session-table staff-table">
                        <thead>
                            <tr>
                                <th className={isMobile ? 'mobile-hide' : ''}>#</th>
                                <th className="mobile-essential">Tên đăng nhập</th>
                                <th className="mobile-essential">Họ và tên</th>
                                <th className={isMobile ? 'mobile-hide' : ''}>Email</th>
                                <th className="mobile-essential">Vai trò Đảm bảo chất lượng</th>
                                <th className="mobile-essential">Trạng thái</th>
                                {canAssignQARoles() && <th className="mobile-essential">Thao tác</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={canAssignQARoles() ? 7 : 6} className="text-center py-4">
                                        <Spinner animation="border" size="sm" />
                                        <span className="ms-2">Đang tải...</span>
                                    </td>
                                </tr>
                            ) : paginatedUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={canAssignQARoles() ? 7 : 6} className="text-center text-muted py-4">
                                        Không có người dùng nào
                                    </td>
                                </tr>
                            ) : (
                                paginatedUsers.map((user, index) => (
                                    <tr
                                        key={user.id}
                                        onClick={() => handleOpenRoleModal(user)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <td className={isMobile ? 'mobile-hide' : ''}>
                                            {(pagination.page - 1) * pagination.limit + index + 1}
                                        </td>
                                        <td className="mobile-essential">
                                            <div className="user-info-mobile">
                                                <div className="user-username">{user.username}</div>
                                                {isMobile && user.email && (
                                                    <div className="user-email-mobile">{user.email}</div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="mobile-essential">{user.full_name || '—'}</td>
                                        <td className={isMobile ? 'mobile-hide' : ''}>
                                            {!isMobile && (user.email || '—')}
                                        </td>
                                        <td className="mobile-essential" style={{ maxWidth: '280px', minWidth: 0, overflow: 'hidden' }}>
                                            {getQARoleBadge(user)}
                                        </td>
                                        <td className="mobile-essential">
                                            {user.approved ? (
                                                <Badge bg="success">Đã duyệt</Badge>
                                            ) : (
                                                <Badge bg="warning">Chờ duyệt</Badge>
                                            )}
                                        </td>
                                        {canAssignQARoles() && (
                                            <td className="mobile-essential" onClick={(e) => e.stopPropagation()}>
                                                <div className="d-flex flex-wrap gap-1 align-items-center">
                                                    {!user.approved && (
                                                        <Button
                                                            variant="outline-success"
                                                            size="sm"
                                                            disabled={approveLoading}
                                                            onClick={(e) => handleApproveUser(e, user.id)}
                                                            title="Duyệt người dùng"
                                                        >
                                                            {approvingUserId === user.id ? (
                                                                <Spinner animation="border" size="sm" className="me-1" />
                                                            ) : (
                                                                <i className="fas fa-check me-1"></i>
                                                            )}
                                                            Duyệt
                                                        </Button>
                                                    )}
                                                    {canEditUserInfo(user) && (
                                                        <Button
                                                            variant="outline-primary"
                                                            size="sm"
                                                            onClick={(e) => openEditUserModal(e, user)}
                                                            title="Chỉnh sửa thông tin"
                                                        >
                                                            <i className="fas fa-edit me-1"></i>
                                                            Sửa
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="outline-danger"
                                                        size="sm"
                                                        onClick={(e) => openDeleteModal(e, user)}
                                                        title="Xóa khỏi danh sách"
                                                    >
                                                        <i className="fas fa-trash-alt me-1"></i>
                                                        Xóa
                                                    </Button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {!loading && filteredUsers.length > 0 && totalPages > 1 && (
                    <div className="mt-3">
                        <Pagination
                            currentPage={pagination.page}
                            totalPages={totalPages}
                            onPageChange={(page) => setPagination(prev => ({ ...prev, page }))}
                            maxVisiblePages={5}
                            showFirstLast={true}
                        />
                    </div>
                )}
            </div>

            {/* Modal Phân quyền Đảm bảo chất lượng */}
            <Modal show={showRoleModal} onHide={() => setShowRoleModal(false)} size="xl" className="student-detail-modal">
                <Modal.Header closeButton className="student-detail-header">
                    <Modal.Title className="student-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-shield-alt"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Phân quyền Đảm bảo chất lượng</h4>
                            <p className="mb-0 student-subtitle">
                                {selectedUser?.full_name || selectedUser?.username || 'Người dùng'}
                            </p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="student-detail-body">
                    <div className="student-detail-container">
                        {/* Mô tả quyền theo vai trò */}
                        <div className="session-card mb-4">
                            <div className="card-header-modern">
                                <div className="header-icon">
                                    <i className="fas fa-info-circle"></i>
                                </div>
                                <h6 className="mb-0">Quyền theo vai trò</h6>
                            </div>
                            <div className="card-body-modern">
                                <ul className="mb-0 ps-3" style={{ listStyle: 'none' }}>
                                    {Object.entries(QA_ROLE_DESCRIPTIONS).map(([key, { label, desc }]) => (
                                        <li key={key} className="mb-3">
                                            <strong className="text-primary">{label}:</strong>{' '}
                                            <span className="text-muted">{desc}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        <Alert variant="light" className="mb-4 border">
                            <i className="fas fa-layer-group me-2"></i>
                            <strong>Một user có thể có quyền nhiều mục.</strong> Trong mỗi mục chỉ chọn một cấp (Quản lý hoặc Nhân viên), hoặc không có quyền.
                        </Alert>

                        <div className="session-card mb-0">
                            <div className="card-header-modern">
                                <div className="header-icon">
                                    <i className="fas fa-shield-alt"></i>
                                </div>
                                <h6 className="mb-0">Chọn vai trò từng mục</h6>
                            </div>
                            <div className="card-body-modern">
                                <Row>
                                    {QA_ROLE_SECTIONS.map((section, idx) => {
                                        const selectedInThisSection = roleFormData[idx] ?? '';
                                        return (
                                            <Col key={idx} md={6} lg={4} className="mb-3">
                                                <Form.Group className="mb-0">
                                                    <Form.Label className="info-label">
                                                        <i className="fas fa-layer-group me-2"></i>
                                                        {section.sectionLabel}
                                                    </Form.Label>
                                                    <Form.Select
                                                        value={selectedInThisSection}
                                                        onChange={(e) => {
                                                            const v = e.target.value;
                                                            setRoleFormData(prev => ({ ...prev, [idx]: v }));
                                                        }}
                                                        className="form-control-modern"
                                                        disabled={!canAssignQARoles()}
                                                    >
                                                        <option value="">— Không có quyền —</option>
                                                        {section.options.map(opt => (
                                                            <option key={opt.value} value={opt.value}>
                                                                {opt.label}
                                                            </option>
                                                        ))}
                                                    </Form.Select>
                                                </Form.Group>
                                            </Col>
                                        );
                                    })}
                                </Row>
                            </div>
                        </div>
                    </div>
                </Modal.Body>
                <Modal.Footer className="student-detail-footer">
                    <Button variant="outline-secondary" onClick={() => setShowRoleModal(false)} className="btn-cancel">
                        <i className="fas fa-times me-2"></i>
                        Đóng
                    </Button>
                    {canAssignQARoles() && (
                        <Button
                            variant="primary"
                            onClick={handleSaveRole}
                            disabled={loading}
                            className="btn-edit"
                        >
                            {loading ? (
                                <>
                                    <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                                    Đang xử lý...
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-save me-2"></i>
                                    Lưu quyền
                                </>
                            )}
                        </Button>
                    )}
                </Modal.Footer>
            </Modal>

            <Modal show={showDeleteModal} onHide={closeDeleteModal} size="lg" className="student-detail-modal">
                <Modal.Header closeButton className="student-detail-header">
                    <Modal.Title className="student-detail-title">
                        <div className="student-avatar" style={{ backgroundColor: 'rgba(220, 53, 69, 0.15)', color: '#dc3545' }}>
                            <i className="fas fa-user-minus"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Xóa khỏi danh sách</h4>
                            <p className="mb-0 student-subtitle">
                                {userToDelete?.full_name || userToDelete?.username || 'Người dùng'}
                            </p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="student-detail-body">
                    <div className="student-detail-container">
                        <Alert variant="warning" className="mb-0 d-flex align-items-start">
                            <i className="fas fa-exclamation-triangle me-3 mt-1"></i>
                            <div>
                                <strong>Bạn có chắc muốn xóa người dùng này khỏi danh sách Quản lý người dùng Đảm bảo chất lượng?</strong>
                            </div>
                        </Alert>
                    </div>
                </Modal.Body>
                <Modal.Footer className="student-detail-footer">
                    <Button variant="outline-secondary" onClick={closeDeleteModal} disabled={removeLoading} className="btn-cancel">
                        <i className="fas fa-times me-2"></i>
                        Hủy
                    </Button>
                    <Button variant="danger" onClick={handleConfirmRemove} disabled={removeLoading} className="btn-edit">
                        {removeLoading ? (
                            <>
                                <Spinner as="span" animation="border" size="sm" className="me-2" />
                                Đang xử lý...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-trash-alt me-2"></i>
                                Xóa khỏi danh sách
                            </>
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>

            <Modal show={showEditUserModal} onHide={() => { if (!editUserLoading) { setShowEditUserModal(false); setUserToEdit(null); } }} size="lg" className="student-detail-modal">
                <Modal.Header closeButton className="student-detail-header">
                    <Modal.Title className="student-detail-title">
                        <div className="student-avatar" style={{ backgroundColor: 'rgba(13, 110, 253, 0.15)', color: '#0d6efd' }}>
                            <i className="fas fa-user-edit"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Chỉnh sửa thông tin người dùng</h4>
                            <p className="mb-0 student-subtitle">
                                {userToEdit?.username && <span className="text-muted">{userToEdit.username}</span>}
                            </p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="student-detail-body">
                    <div className="student-detail-container">
                        <Form id="quality-assurance-edit-user-form" onSubmit={handleEditUserSubmit}>
                            {editUserError && (
                                <Alert variant="danger" dismissible onClose={() => setEditUserError('')} className="mb-4">
                                    {editUserError}
                                </Alert>
                            )}
                            <div className="session-card mb-0">
                                <div className="card-header-modern">
                                    <div className="header-icon">
                                        <i className="fas fa-user"></i>
                                    </div>
                                    <h6 className="mb-0">Thông tin cơ bản</h6>
                                </div>
                                <div className="card-body-modern">
                                    <Form.Group className="mb-3">
                                        <Form.Label className="info-label">
                                            <i className="fas fa-user me-2"></i>
                                            Tên đăng nhập
                                        </Form.Label>
                                        <Form.Control
                                            type="text"
                                            value={userToEdit?.username || ''}
                                            disabled
                                            className="form-control-modern bg-light"
                                        />
                                        <Form.Text className="text-muted">Không thể thay đổi tên đăng nhập</Form.Text>
                                    </Form.Group>
                                    <Row>
                                        <Col md={6}>
                                            <Form.Group className="mb-3">
                                                <Form.Label className="info-label">
                                                    <i className="fas fa-id-card me-2"></i>
                                                    Họ và tên
                                                </Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    value={editUserForm.full_name}
                                                    onChange={(e) => setEditUserForm(prev => ({ ...prev, full_name: e.target.value }))}
                                                    placeholder="Nguyễn Văn A"
                                                    required
                                                    className="form-control-modern"
                                                />
                                            </Form.Group>
                                        </Col>
                                        <Col md={6}>
                                            <Form.Group className="mb-3">
                                                <Form.Label className="info-label">
                                                    <i className="fas fa-envelope me-2"></i>
                                                    Email
                                                </Form.Label>
                                                <Form.Control
                                                    type="email"
                                                    value={editUserForm.email}
                                                    onChange={(e) => setEditUserForm(prev => ({ ...prev, email: e.target.value }))}
                                                    placeholder="email@example.com"
                                                    required
                                                    className="form-control-modern"
                                                />
                                            </Form.Group>
                                        </Col>
                                    </Row>
                                    <Form.Group className="mb-0">
                                        <Form.Label className="info-label">
                                            <i className="fas fa-key me-2"></i>
                                            Mật khẩu mới
                                        </Form.Label>
                                        <Form.Control
                                            type="password"
                                            value={editUserForm.password}
                                            onChange={(e) => setEditUserForm(prev => ({ ...prev, password: e.target.value }))}
                                            placeholder="Để trống nếu không đổi mật khẩu"
                                            minLength={6}
                                            className="form-control-modern"
                                        />
                                        <Form.Text className="text-muted">Chỉ điền khi muốn đổi mật khẩu</Form.Text>
                                    </Form.Group>
                                </div>
                            </div>
                        </Form>
                    </div>
                </Modal.Body>
                <Modal.Footer className="student-detail-footer">
                    <Button variant="outline-secondary" type="button" onClick={() => { setShowEditUserModal(false); setUserToEdit(null); }} disabled={editUserLoading} className="btn-cancel">
                        <i className="fas fa-times me-2"></i>
                        Hủy
                    </Button>
                    <Button
                        variant="primary"
                        type="submit"
                        form="quality-assurance-edit-user-form"
                        disabled={editUserLoading}
                        className="btn-edit"
                    >
                        {editUserLoading ? (
                            <>
                                <Spinner as="span" animation="border" size="sm" className="me-2" />
                                Đang lưu...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-save me-2"></i>
                                Lưu thay đổi
                            </>
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>

            <Modal show={showAddUserModal} onHide={() => setShowAddUserModal(false)} size="xl" className="student-detail-modal">
                <Modal.Header closeButton className="student-detail-header">
                    <Modal.Title className="student-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-user-plus"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Thêm người dùng mới</h4>
                            <p className="mb-0 student-subtitle">Tạo tài khoản và cấp quyền truy cập module Đảm bảo chất lượng</p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="student-detail-body">
                    <div className="student-detail-container">
                        <Form id="quality-assurance-add-user-form" onSubmit={handleAddUserSubmit}>
                            {addUserError && (
                                <Alert variant="danger" dismissible onClose={() => setAddUserError('')} className="mb-4">
                                    {addUserError}
                                </Alert>
                            )}

                            <div className="session-card mb-4">
                                <div className="card-header-modern">
                                    <div className="header-icon">
                                        <i className="fas fa-user"></i>
                                    </div>
                                    <h6 className="mb-0">Thông tin cơ bản</h6>
                                </div>
                                <div className="card-body-modern">
                                    <Row>
                                        <Col md={6}>
                                            <Form.Group className="mb-3">
                                                <Form.Label className="info-label">
                                                    <i className="fas fa-user me-2"></i>
                                                    Tên đăng nhập
                                                </Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    value={addUserForm.username}
                                                    onChange={(e) => setAddUserForm(prev => ({ ...prev, username: e.target.value }))}
                                                    placeholder="username"
                                                    required
                                                    className="form-control-modern"
                                                />
                                            </Form.Group>
                                        </Col>
                                        <Col md={6}>
                                            <Form.Group className="mb-3">
                                                <Form.Label className="info-label">
                                                    <i className="fas fa-envelope me-2"></i>
                                                    Email
                                                </Form.Label>
                                                <Form.Control
                                                    type="email"
                                                    value={addUserForm.email}
                                                    onChange={(e) => setAddUserForm(prev => ({ ...prev, email: e.target.value }))}
                                                    placeholder="email@example.com"
                                                    required
                                                    className="form-control-modern"
                                                />
                                            </Form.Group>
                                        </Col>
                                    </Row>
                                    <Row>
                                        <Col md={6}>
                                            <Form.Group className="mb-3">
                                                <Form.Label className="info-label">
                                                    <i className="fas fa-id-card me-2"></i>
                                                    Họ và tên
                                                </Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    value={addUserForm.full_name}
                                                    onChange={(e) => setAddUserForm(prev => ({ ...prev, full_name: e.target.value }))}
                                                    placeholder="Nguyễn Văn A"
                                                    required
                                                    className="form-control-modern"
                                                />
                                            </Form.Group>
                                        </Col>
                                        <Col md={6}>
                                            <Form.Group className="mb-3">
                                                <Form.Label className="info-label">
                                                    <i className="fas fa-key me-2"></i>
                                                    Mật khẩu
                                                </Form.Label>
                                                <Form.Control
                                                    type="password"
                                                    value={addUserForm.password}
                                                    onChange={(e) => setAddUserForm(prev => ({ ...prev, password: e.target.value }))}
                                                    placeholder="••••••••"
                                                    required
                                                    minLength={6}
                                                    className="form-control-modern"
                                                />
                                            </Form.Group>
                                        </Col>
                                    </Row>
                                </div>
                            </div>

                            <div className="session-card mb-0">
                                <div className="card-header-modern">
                                    <div className="header-icon">
                                        <i className="fas fa-shield-alt"></i>
                                    </div>
                                    <h6 className="mb-0">Chọn vai trò từng mục</h6>
                                </div>
                                <div className="card-body-modern">
                                    <Alert variant="light" className="mb-4 border">
                                        <i className="fas fa-layer-group me-2"></i>
                                        <strong>Một user có thể có quyền nhiều mục.</strong> Trong mỗi mục chỉ chọn một cấp (Quản lý hoặc Nhân viên), hoặc không có quyền. Chọn ít nhất một vai trò.
                                    </Alert>
                                    <Row>
                                        {QA_ROLE_SECTIONS.map((section, idx) => {
                                            const selectedInThisSection = (addUserForm.qaRolesBySection || {})[idx] ?? '';
                                            return (
                                                <Col key={idx} md={6} lg={4} className="mb-3">
                                                    <Form.Group className="mb-0">
                                                        <Form.Label className="info-label">
                                                            <i className="fas fa-layer-group me-2"></i>
                                                            {section.sectionLabel}
                                                        </Form.Label>
                                                        <Form.Select
                                                            value={selectedInThisSection}
                                                            onChange={(e) => {
                                                                const v = e.target.value;
                                                                setAddUserForm(prev => ({
                                                                    ...prev,
                                                                    qaRolesBySection: { ...(prev.qaRolesBySection || {}), [idx]: v }
                                                                }));
                                                            }}
                                                            className="form-control-modern"
                                                        >
                                                            <option value="">— Không có quyền —</option>
                                                            {section.options.map(opt => (
                                                                <option key={opt.value} value={opt.value}>
                                                                    {opt.label}
                                                                </option>
                                                            ))}
                                                        </Form.Select>
                                                    </Form.Group>
                                                </Col>
                                            );
                                        })}
                                    </Row>
                                </div>
                            </div>
                        </Form>
                    </div>
                </Modal.Body>
                <Modal.Footer className="student-detail-footer">
                    <Button variant="outline-secondary" type="button" onClick={() => setShowAddUserModal(false)} className="btn-cancel">
                        <i className="fas fa-times me-2"></i>
                        Hủy
                    </Button>
                    <Button
                        variant="primary"
                        type="submit"
                        form="quality-assurance-add-user-form"
                        disabled={addUserLoading}
                        className="btn-edit"
                    >
                        {addUserLoading ? (
                            <>
                                <Spinner as="span" animation="border" size="sm" className="me-2" />
                                Đang tạo...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-plus me-2"></i>
                                Thêm
                            </>
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default QualityAssuranceUserManagement;
