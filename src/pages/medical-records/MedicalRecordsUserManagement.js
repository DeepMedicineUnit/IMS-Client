import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Table, Badge, Spinner, Alert, Modal, Form, Button } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import Pagination from '../../components/Pagination';
import '../../styles/user.css';
import usePageTitle from '../../hooks/usePageTitle';

// Phân quyền module Hồ sơ bệnh án: admin, mod, staff
const MR_ROLE_SECTIONS = [
    {
        sectionLabel: 'Hồ sơ bệnh án sinh viên (HSBASV)',
        options: [
            { value: 'medicalrecords_admin', label: 'Quản trị viên' },
            { value: 'medicalrecords_mod', label: 'Quản lý' },
            { value: 'medicalrecords_staff', label: 'Nhân viên' }
        ]
    }
];

const MR_ROLE_OPTIONS = [
    { value: '', label: 'Không có quyền', displayLabel: 'Không có quyền' },
    ...MR_ROLE_SECTIONS.flatMap(s =>
        s.options.map(o => ({
            value: o.value,
            label: o.label,
            displayLabel: `${s.sectionLabel} – ${o.label}`
        }))
    )
];
const MR_ROLE_KEYS = MR_ROLE_OPTIONS.filter(o => o.value).map(o => o.value);

// Mô tả quyền từng vai trò trong module Hồ sơ bệnh án
const MR_ROLE_DESCRIPTIONS = {
    medicalrecords_admin: {
        label: 'Quản trị viên',
        desc: 'Toàn quyền module: quản lý HSBA (thêm/sửa/xóa), import Excel, danh sách GVHD (thêm/sửa/xóa), quản lý người dùng và phân quyền, Dashboard, Theo dõi hồ sơ bệnh án (báo cáo), CI chưa chấm điểm.'
    },
    medicalrecords_mod: {
        label: 'Quản lý',
        desc: 'Tất cả quyền trừ quản lý người dùng: Nhập HSBA, import Excel, chỉnh sửa/xóa HSBA, danh sách GVHD (thêm/sửa/xóa), Dashboard, Theo dõi hồ sơ bệnh án, CI chưa chấm điểm.'
    },
    medicalrecords_staff: {
        label: 'Nhân viên',
        desc: 'Chỉ xem và thao tác 3 trang: Dashboard, Theo dõi hồ sơ bệnh án (báo cáo), CI chưa chấm điểm. Không truy cập Nhập HSBA, không quản lý GVHD, không quản lý người dùng.'
    }
};

const MedicalRecordsUserManagement = () => {
    usePageTitle('Quản lý người dùng Hồ sơ bệnh án');
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
        mr_role: 'medicalrecords_staff'
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
            const response = await api.get('/medical-records/users');
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
            console.error('Error fetching medical records users:', err);
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
        const opt = MR_ROLE_OPTIONS.find(o => o.value === roleKey);
        return opt ? (opt.displayLabel || opt.label) : roleKey;
    };

    const getMRRoleBadge = (user) => {
        const moduleRoles = user.module_roles || [];
        const mrRoles = MR_ROLE_KEYS.filter(r => moduleRoles.includes(r));
        if (mrRoles.length === 0) return <span className="text-muted">—</span>;
        return (
            <span
                className="mr-role-badges"
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.35rem',
                    maxWidth: '100%',
                    minWidth: 0
                }}
            >
                {mrRoles.map(roleKey => {
                    const isAdmin = roleKey === 'medicalrecords_admin';
                    const isMod = roleKey === 'medicalrecords_mod';
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

    const hasMRAccess = () => {
        return (currentUser?.module_roles || []).includes('medicalrecords_admin');
    };

    const canAssignMRRoles = () => {
        return (currentUser?.module_roles || []).includes('medicalrecords_admin');
    };

    const getBaseRoleRank = (role) => {
        if (role === 'superadmin') return 3;
        if (role === 'admin') return 2;
        if (role === 'staff') return 1;
        if (role === 'student') return 0;
        return 0;
    };

    // Chỉ cho phép "Chỉnh sửa thông tin người dùng" khi:
    // - User mục tiêu đã có ít nhất một role Hồ sơ bệnh án (medicalrecords_admin/mod/staff)
    // - Base role (superadmin > admin > staff > student) của currentUser >= base role của user mục tiêu
    const canEditUserInfo = (user) => {
        const roles = user.module_roles || [];
        const hasMRRole =
            roles.includes('medicalrecords_admin') ||
            roles.includes('medicalrecords_mod') ||
            roles.includes('medicalrecords_staff');
        if (!hasMRRole) return false;

        const currentBaseRank = getBaseRoleRank(currentUser?.role);
        const targetBaseRank = getBaseRoleRank(user.role);
        return currentBaseRank >= targetBaseRank;
    };

    const handleOpenRoleModal = (user) => {
        setSelectedUser(user);
        const moduleRoles = user.module_roles || [];
        const bySection = {};
        MR_ROLE_SECTIONS.forEach((section, idx) => {
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
            const selectedMRRoles = Object.values(roleFormData).filter(Boolean);
            const moduleRoles = (selectedUser.module_roles || []).filter(r => !MR_ROLE_KEYS.includes(r));
            moduleRoles.push(...selectedMRRoles);
            const response = await api.put(`/users/${selectedUser.id}`, { module_roles: moduleRoles });
            if (response.data.success) {
                showAlert('Cập nhật quyền Hồ sơ bệnh án thành công', 'success');
                setShowRoleModal(false);
                fetchUsers();
            } else {
                setError(response.data.message || 'Không thể cập nhật quyền');
            }
        } catch (err) {
            console.error('Error saving MR role:', err);
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
            mr_role: 'medicalrecords_staff'
        });
        setShowAddUserModal(true);
    };

    const handleAddUserSubmit = async (e) => {
        e.preventDefault();
        setAddUserError('');
        const { username, email, full_name, password, mr_role } = addUserForm;
        if (!username?.trim() || !email?.trim() || !full_name?.trim() || !password) {
            setAddUserError('Vui lòng điền đầy đủ tên đăng nhập, email, họ tên và mật khẩu.');
            return;
        }
        try {
            setAddUserLoading(true);
            const response = await api.post('/medical-records/users', {
                username: username.trim(),
                email: email.trim(),
                full_name: full_name.trim(),
                password,
                mr_role: mr_role || 'medicalrecords_staff'
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

    const handleApproveUser = async (e, userId) => {
        e.stopPropagation();
        try {
            setApprovingUserId(userId);
            setApproveLoading(true);
            const response = await api.post(`/medical-records/users/${userId}/approve`);
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
            const response = await api.delete(`/medical-records/users/${userToDelete.id}/list`);
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

    if (!hasMRAccess()) {
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
                        <h1>Quản lý người dùng Hồ sơ bệnh án</h1>
                        <p className="header-subtitle">
                            Danh sách người dùng có quyền trong module Hồ sơ bệnh án sinh viên (HSBASV)
                        </p>
                    </div>
                    {canAssignMRRoles() && (
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
                                <th className="mobile-essential">Vai trò Hồ sơ bệnh án</th>
                                <th className="mobile-essential">Trạng thái</th>
                                {canAssignMRRoles() && <th className="mobile-essential">Thao tác</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={canAssignMRRoles() ? 7 : 6} className="text-center py-4">
                                        <Spinner animation="border" size="sm" />
                                        <span className="ms-2">Đang tải...</span>
                                    </td>
                                </tr>
                            ) : paginatedUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={canAssignMRRoles() ? 7 : 6} className="text-center text-muted py-4">
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
                                            {getMRRoleBadge(user)}
                                        </td>
                                        <td className="mobile-essential">
                                            {user.approved ? (
                                                <Badge bg="success">Đã duyệt</Badge>
                                            ) : (
                                                <Badge bg="warning">Chờ duyệt</Badge>
                                            )}
                                        </td>
                                        {canAssignMRRoles() && (
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

            <Modal show={showRoleModal} onHide={() => setShowRoleModal(false)} size="xl" className="student-detail-modal">
                <Modal.Header closeButton className="student-detail-header">
                    <Modal.Title className="student-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-file-medical"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Phân quyền Hồ sơ bệnh án</h4>
                            <p className="mb-0 student-subtitle">
                                {selectedUser?.full_name || selectedUser?.username || 'Người dùng'}
                            </p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="student-detail-body">
                    <div className="student-detail-container">
                        {/* Mô tả quyền từng vai trò */}
                        <div className="session-card mb-4">
                            <div className="card-header-modern">
                                <div className="header-icon">
                                    <i className="fas fa-info-circle"></i>
                                </div>
                                <h6 className="mb-0">Quyền theo vai trò</h6>
                            </div>
                            <div className="card-body-modern">
                                <ul className="mb-0 ps-3" style={{ listStyle: 'none' }}>
                                    {Object.entries(MR_ROLE_DESCRIPTIONS).map(([key, { label, desc }]) => (
                                        <li key={key} className="mb-3">
                                            <strong className="text-primary">{label}:</strong>{' '}
                                            <span className="text-muted">{desc}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        <div className="session-card mb-0">
                            <div className="card-header-modern">
                                <div className="header-icon">
                                    <i className="fas fa-file-medical"></i>
                                </div>
                                <h6 className="mb-0">Chọn vai trò</h6>
                            </div>
                            <div className="card-body-modern">
                                <Row>
                                    {MR_ROLE_SECTIONS.map((section, idx) => {
                                        const selectedInThisSection = roleFormData[idx] ?? '';
                                        return (
                                            <Col key={idx} md={12}>
                                                <Form.Group className="mb-0">
                                                    <Form.Label className="info-label">
                                                        <i className="fas fa-shield-alt me-2"></i>
                                                        {section.sectionLabel}
                                                    </Form.Label>
                                                    <Form.Select
                                                        value={selectedInThisSection}
                                                        onChange={(e) => {
                                                            const v = e.target.value;
                                                            setRoleFormData(prev => ({ ...prev, [idx]: v }));
                                                        }}
                                                        className="form-control-modern"
                                                        disabled={!canAssignMRRoles()}
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
                    {canAssignMRRoles() && (
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
                                <strong>Bạn có chắc muốn xóa người dùng này khỏi danh sách Quản lý người dùng Hồ sơ bệnh án?</strong>
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
                        <Form id="medical-records-edit-user-form" onSubmit={handleEditUserSubmit}>
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
                        form="medical-records-edit-user-form"
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
                            <p className="mb-0 student-subtitle">Tạo tài khoản và cấp quyền truy cập module Hồ sơ bệnh án</p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="student-detail-body">
                    <div className="student-detail-container">
                        <Form id="medical-records-add-user-form" onSubmit={handleAddUserSubmit}>
                            {addUserError && (
                                <Alert variant="danger" dismissible onClose={() => setAddUserError('')} className="mb-4">
                                    {addUserError}
                                </Alert>
                            )}

                            {/* Thông tin cơ bản - giống Add User Modal */}
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

                            {/* Vai trò Hồ sơ bệnh án + mô tả quyền */}
                            <div className="session-card mb-0">
                                <div className="card-header-modern">
                                    <div className="header-icon">
                                        <i className="fas fa-file-medical"></i>
                                    </div>
                                    <h6 className="mb-0">Vai trò Hồ sơ bệnh án</h6>
                                </div>
                                <div className="card-body-modern">
                                    <Form.Group className="mb-3">
                                        <Form.Label className="info-label">
                                            <i className="fas fa-shield-alt me-2"></i>
                                            Chọn vai trò
                                        </Form.Label>
                                        <Form.Select
                                            value={addUserForm.mr_role}
                                            onChange={(e) => setAddUserForm(prev => ({ ...prev, mr_role: e.target.value }))}
                                            className="form-control-modern"
                                        >
                                            <option value="medicalrecords_admin">Quản trị viên</option>
                                            <option value="medicalrecords_mod">Quản lý</option>
                                            <option value="medicalrecords_staff">Nhân viên</option>
                                        </Form.Select>
                                    </Form.Group>
                                    {MR_ROLE_DESCRIPTIONS[addUserForm.mr_role] && (
                                        <Alert variant="light" className="mb-0 border">
                                            <strong>{MR_ROLE_DESCRIPTIONS[addUserForm.mr_role].label}:</strong>{' '}
                                            <span className="text-muted">{MR_ROLE_DESCRIPTIONS[addUserForm.mr_role].desc}</span>
                                        </Alert>
                                    )}
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
                        form="medical-records-add-user-form"
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

export default MedicalRecordsUserManagement;
