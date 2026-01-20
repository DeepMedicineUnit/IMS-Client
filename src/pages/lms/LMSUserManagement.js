import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Card, Table, Button, Badge, Tabs, Tab, Form, Modal, Spinner, Alert, Dropdown, ProgressBar } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import Pagination from '../../components/Pagination';
import * as XLSX from 'xlsx';
import '../../styles/user.css';
import usePageTitle from '../../hooks/usePageTitle';

// CSS cho dropdown menu
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
  
  .table tbody tr:hover {
    background-color: #f8f9fa;
    cursor: pointer;
  }
`;

const LMSUserManagement = () => {
  usePageTitle('Quản lý người dùng LMS');
  const { showAlert } = useAlert();
    const { api, currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState('students');
    const [users, setUsers] = useState([]);
    const [students, setStudents] = useState([]);
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
    const [classFilter, setClassFilter] = useState('');
    const [facultyFilter, setFacultyFilter] = useState('');
    const [majorFilter, setMajorFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('Đang học');
    const [sortField, setSortField] = useState('student_id');
    const [sortOrder, setSortOrder] = useState('asc');
    const [uniqueClasses, setUniqueClasses] = useState([]);
    const [uniqueFaculties, setUniqueFaculties] = useState([]);
    const [uniqueMajors, setUniqueMajors] = useState([]);
    const [uniqueStatuses, setUniqueStatuses] = useState(['Đang học', 'Nghỉ học', 'Tạm dừng', 'Đã tốt nghiệp']);
    const [visiblePasswords, setVisiblePasswords] = useState({});
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [roleFormData, setRoleFormData] = useState({
        role: '',
        expirationDate: '',
        totalQuestions: '',
        allowExceed: false,
        questionTypeCounts: {
            mcq: '', multiple_response: '', true_false: '', matching: '',
            short_answer: '', essay: '', fill_blank: '', ordering: ''
        },
        difficultyCounts: {
            easy: '', medium: '', hard: '', expert: ''
        },
        bloomCounts: {
            remember: '', understand: '', apply: '', analyze: '', evaluate: '', create: ''
        }
    });
    
    // States for student management modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [userToDelete, setUserToDelete] = useState(null);
    const [userToEdit, setUserToEdit] = useState(null);
    const [emailTarget, setEmailTarget] = useState(null);
    const [emailLoading, setEmailLoading] = useState(false);
    const [editFormData, setEditFormData] = useState({
        username: '',
        email: '',
        fullName: '',
        password: '',
        role: 'student',
        student_id: '',
        class_name: '',
        faculty_name: '',
        major_name: '',
        birth_date: '',
        gender: '',
        address: '',
        id_number: '',
        status: 'Đang học',
        phone: ''
    });
    const [showPasswordField, setShowPasswordField] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importErrors, setImportErrors] = useState([]);
    const [importSuccess, setImportSuccess] = useState('');
    const [importLoading, setImportLoading] = useState(false);
    const [importProgress, setImportProgress] = useState(0);
    const [importTotal, setImportTotal] = useState(0);
    const [newUser, setNewUser] = useState({
        username: '',
        email: '',
        fullName: '',
        password: '',
        role: 'student',
        student_id: '',
        class_name: '',
        faculty_name: '',
        major_name: '',
        birth_date: '',
        gender: '',
        address: '',
        id_number: '',
        status: 'Đang học',
        phone: ''
    });
    
    // States for bulk email modal
    const [showBulkEmailModal, setShowBulkEmailModal] = useState(false);
    const [showBulkEmailConfirmModal, setShowBulkEmailConfirmModal] = useState(false);
    const [showBulkEmailProgressModal, setShowBulkEmailProgressModal] = useState(false);
    const [bulkEmailLoading, setBulkEmailLoading] = useState(false);
    const [bulkEmailTab, setBulkEmailTab] = useState('all');
    const [selectedClassForEmail, setSelectedClassForEmail] = useState('');
    const [selectedFacultyForEmail, setSelectedFacultyForEmail] = useState('');
    const [selectedMajorForEmail, setSelectedMajorForEmail] = useState('');
    const [allStudents, setAllStudents] = useState([]);
    const [selectedStudentsForEmail, setSelectedStudentsForEmail] = useState([]);
    const [filteredStudentsForEmail, setFilteredStudentsForEmail] = useState([]);
    const [loadingFilteredStudents, setLoadingFilteredStudents] = useState(false);
    const [classStudentCounts, setClassStudentCounts] = useState({});
    const [facultyStudentCounts, setFacultyStudentCounts] = useState({});
    const [majorStudentCounts, setMajorStudentCounts] = useState({});
    const [bulkEmailProgress, setBulkEmailProgress] = useState({
        current: 0,
        total: 0,
        currentEmail: '',
        currentName: '',
        message: '',
        sent: 0,
        failed: 0,
        errors: [],
        isComplete: false
    });

    // LMS roles hierarchy: QA (highest) => lms_admin => mod => staff => view
    const lmsRoles = ['mod', 'staff', 'view']; // Cannot assign lms_admin
    const questionTypes = ['mcq', 'multiple_response', 'true_false', 'matching', 'short_answer', 'essay', 'fill_blank', 'ordering'];
    const difficultyLevels = ['easy', 'medium', 'hard', 'expert'];
    const bloomLevels = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];

    // Inject CSS styles
    useEffect(() => {
        const style = document.createElement('style');
        style.textContent = dropdownStyles;
        document.head.appendChild(style);
        return () => {
            document.head.removeChild(style);
        };
    }, []);

    // Detect mobile device
    useEffect(() => {
        const checkIsMobile = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        checkIsMobile();
        window.addEventListener('resize', checkIsMobile);
        return () => window.removeEventListener('resize', checkIsMobile);
    }, []);

    // Debounce search term
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Fetch data based on active tab
    useEffect(() => {
        if (activeTab === 'students') {
            fetchStudents();
        } else if (activeTab === 'users') {
            fetchUsers();
        }
    }, [activeTab, pagination.page, debouncedSearchTerm, classFilter, facultyFilter, majorFilter, statusFilter, sortField, sortOrder]);

    // Auto-check for expired roles every 5 minutes when on users tab
    useEffect(() => {
        if (activeTab !== 'users') return;

        const checkExpiredRoles = () => {
            // Check if any user has expired role
            const now = new Date();
            const hasExpired = users.some(user => {
                if (!user.lms_role_expiration) return false;
                const expirationDate = new Date(user.lms_role_expiration);
                expirationDate.setHours(0, 0, 0, 0);
                now.setHours(0, 0, 0, 0);
                return expirationDate < now;
            });

            if (hasExpired) {
                console.log('🔄 Auto-refreshing users list due to expired roles...');
                fetchUsers();
            }
        };

        // Check immediately
        checkExpiredRoles();

        // Set up interval to check every 5 minutes
        const interval = setInterval(checkExpiredRoles, 5 * 60 * 1000);

        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, users.length]);

    // Fetch filter options for students tab
    useEffect(() => {
        if (activeTab === 'students') {
            fetchFilterOptions();
        }
    }, [activeTab]);

    // Fetch filtered students for email when filters change
    useEffect(() => {
        if (showBulkEmailModal && (selectedClassForEmail || selectedFacultyForEmail || selectedMajorForEmail)) {
            fetchFilteredStudentsForEmail();
            setSelectedStudentsForEmail([]);
        } else if (showBulkEmailModal) {
            setFilteredStudentsForEmail([]);
            setSelectedStudentsForEmail([]);
        }
    }, [selectedClassForEmail, selectedFacultyForEmail, selectedMajorForEmail, showBulkEmailModal]);

    const fetchFilterOptions = async () => {
        try {
            const response = await api.get('/users/filter-options');
            if (response.data && response.data.success) {
                const classes = response.data.classes || [];
                setUniqueClasses(classes.map(c => c.name));
                const classCountMap = {};
                classes.forEach(c => {
                    classCountMap[c.name] = c.count;
                });
                setClassStudentCounts(classCountMap);

                const faculties = response.data.faculties || [];
                setUniqueFaculties(faculties.map(f => f.name));
                const facultyCountMap = {};
                faculties.forEach(f => {
                    facultyCountMap[f.name] = f.count;
                });
                setFacultyStudentCounts(facultyCountMap);

                const majors = response.data.majors || [];
                setUniqueMajors(majors.map(m => m.name));
                const majorCountMap = {};
                majors.forEach(m => {
                    majorCountMap[m.name] = m.count;
                });
                setMajorStudentCounts(majorCountMap);

                const statuses = response.data.statuses || [];
                if (statuses.length > 0) {
                    setUniqueStatuses(statuses.map(s => s.name));
                }
            }
        } catch (error) {
            console.error('Error fetching filter options:', error);
        }
    };

    const fetchFilteredStudentsForEmail = async () => {
        if (!selectedClassForEmail && !selectedFacultyForEmail && !selectedMajorForEmail) {
            setFilteredStudentsForEmail([]);
            return;
        }

        try {
            setLoadingFilteredStudents(true);
            let url = `/users?role=student&limit=999999`;

            if (selectedClassForEmail) {
                url += `&class_name=${encodeURIComponent(selectedClassForEmail)}`;
            }
            if (selectedFacultyForEmail) {
                url += `&faculty_name=${encodeURIComponent(selectedFacultyForEmail)}`;
            }
            if (selectedMajorForEmail) {
                url += `&major_name=${encodeURIComponent(selectedMajorForEmail)}`;
            }

            const response = await api.get(url);
            if (response.data.success) {
                setFilteredStudentsForEmail(response.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching filtered students:', error);
            setError('Không thể tải danh sách sinh viên');
        } finally {
            setLoadingFilteredStudents(false);
        }
    };

    const fetchStudents = async () => {
        try {
            setLoading(true);
            let url = `/users?role=student&page=${pagination.page}&limit=${pagination.limit}`;
            
            if (debouncedSearchTerm) {
                url += `&search=${encodeURIComponent(debouncedSearchTerm)}`;
            }
            if (classFilter) {
                url += `&class_name=${encodeURIComponent(classFilter)}`;
            }
            if (facultyFilter) {
                url += `&faculty_name=${encodeURIComponent(facultyFilter)}`;
            }
            if (majorFilter) {
                url += `&major_name=${encodeURIComponent(majorFilter)}`;
            }
            if (statusFilter) {
                url += `&status=${encodeURIComponent(statusFilter)}`;
            }
            if (sortField) {
                url += `&sort_field=${sortField}&sort_order=${sortOrder}`;
            }

            const response = await api.get(url);
            if (response.data.success) {
                const studentsData = response.data.data || [];
                setStudents(studentsData);
                setPagination(prev => ({
                    ...prev,
                    totalItems: response.data.pagination?.totalItems || studentsData.length,
                    totalPages: response.data.pagination?.totalPages || Math.ceil(studentsData.length / prev.limit)
                }));
            }
        } catch (error) {
            console.error('Error fetching students:', error);
            setError('Không thể tải danh sách sinh viên');
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            setLoading(true);
            // Fetch all users by calling multiple times if needed
            // Then filter and paginate on client side because we need to filter out lms_admin and lms_qa
            let allUsers = [];
            let page = 1;
            let hasMore = true;
            const limit = 1000; // Fetch 1000 at a time

            while (hasMore) {
                const response = await api.get('/users', {
                    params: {
                        search: debouncedSearchTerm,
                        excludeRole: 'student',
                        page: page,
                        limit: limit
                    }
                });

                if (response.data.success) {
                    const users = response.data.data || [];
                    allUsers = [...allUsers, ...users];
                    
                    // Check if there are more pages
                    const pagination = response.data.pagination || {};
                    if (pagination.totalPages && page >= pagination.totalPages) {
                        hasMore = false;
                    } else if (users.length < limit) {
                        hasMore = false;
                    } else {
                        page++;
                    }
                } else {
                    hasMore = false;
                }
            }

            // Filter users that have or can have LMS roles (exclude lms_admin and lms_qa)
            const lmsUsers = allUsers.filter(user => {
                const moduleRoles = user.module_roles || [];
                return !moduleRoles.includes('lms_admin') && !moduleRoles.includes('lms_qa');
            });

            // Note: Expired roles are now automatically revoked by backend middleware
            // when user authenticates or uses API, so we don't need to manually refresh here

            setUsers(lmsUsers);
            setPagination(prev => ({
                ...prev,
                totalItems: lmsUsers.length,
                totalPages: Math.ceil(lmsUsers.length / prev.limit)
            }));
        } catch (error) {
            console.error('Error fetching users:', error);
            setError('Không thể tải danh sách người dùng');
        } finally {
            setLoading(false);
        }
    };

    const handleTabChange = (key) => {
        setActiveTab(key);
        setPagination(prev => ({ ...prev, page: 1 }));
        setSearchTerm('');
        setClassFilter('');
        setFacultyFilter('');
        setMajorFilter('');
        setStatusFilter('Đang học');
    };

    const handleFilterChange = (type, value) => {
        if (type === 'class') setClassFilter(value);
        else if (type === 'faculty') setFacultyFilter(value);
        else if (type === 'major') setMajorFilter(value);
        else if (type === 'status') setStatusFilter(value);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const handleSort = (field) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('asc');
        }
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    const togglePasswordVisibility = (userId) => {
        setVisiblePasswords(prev => ({
            ...prev,
            [userId]: !prev[userId]
        }));
    };

    const handleStudentRowClick = (student) => {
        setSelectedStudent(student);
        setShowDetailModal(true);
    };

    const handleEditUser = (user) => {
        setUserToEdit(user);
        setEditFormData({
            username: user.username,
            email: user.email,
            fullName: user.full_name,
            password: '',
            role: user.role,
            student_id: user.student_id || '',
            class_name: user.class_name || '',
            faculty_name: user.faculty_name || '',
            major_name: user.major_name || '',
            birth_date: user.birth_date ? new Date(user.birth_date).toISOString().split('T')[0] : '',
            gender: user.gender !== undefined && user.gender !== null ? user.gender.toString() : '',
            address: user.address || '',
            id_number: user.id_number || '',
            status: user.status || 'Đang học',
            phone: user.phone || ''
        });
        setShowPasswordField(false);
        setShowEditModal(true);
    };

    const handleEditInputChange = (e) => {
        const { name, value } = e.target;
        setEditFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleUpdateUser = async (e) => {
        e.preventDefault();
        
        // Prevent double submission
        if (loading) {
            console.log('Update already in progress, ignoring duplicate call');
            return;
        }
        
        try {
            setLoading(true);
            setError('');

            const userData = {
                username: editFormData.username,
                email: editFormData.email,
                fullName: editFormData.fullName,
                role: editFormData.role
            };

            if (editFormData.role === 'student') {
                userData.student_id = editFormData.student_id;
                userData.class_name = editFormData.class_name;
                userData.faculty_name = editFormData.faculty_name;
                userData.major_name = editFormData.major_name;
                userData.birth_date = editFormData.birth_date;
                userData.gender = editFormData.gender !== '' ? parseInt(editFormData.gender) : null;
                userData.address = editFormData.address;
                userData.id_number = editFormData.id_number;
                userData.status = editFormData.status;
                userData.phone = editFormData.phone;
            }

            if (showPasswordField && editFormData.password) {
                userData.password = editFormData.password;
            }

            const response = await api.put(`/users/${userToEdit.id}`, userData);

            if (response.data.success) {
                showAlert('Cập nhật thông tin sinh viên thành công', 'success');
                setShowEditModal(false);
                setShowDetailModal(false);
                fetchStudents();
            } else {
                setError(response.data.message || 'Không thể cập nhật thông tin');
            }
        } catch (error) {
            console.error('Error updating user:', error);
            setError(error.response?.data?.message || 'Không thể cập nhật thông tin');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async () => {
        if (!userToDelete) return;

        try {
            setLoading(true);
            const response = await api.delete(`/users/${userToDelete.id}`);

            if (response.data.success) {
                showAlert('Xóa sinh viên thành công', 'success');
                setShowDeleteModal(false);
                setShowDetailModal(false);
                setUserToDelete(null);
                fetchStudents();
            } else {
                setError(response.data.message || 'Không thể xóa sinh viên');
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            setError(error.response?.data?.message || 'Không thể xóa sinh viên');
        } finally {
            setLoading(false);
        }
    };

    const handleSendCredentials = (student) => {
        if (!student.display_password) {
            showAlert('Vui lòng tạo mật khẩu trước khi gửi email', 'danger');
            return;
        }
        setEmailTarget(student);
        setShowEmailModal(true);
    };

    const sendCredentialsEmail = async () => {
        if (!emailTarget) return;

        setEmailLoading(true);
        try {
            const response = await api.post(`/users/credentials/${emailTarget.id}/send-credentials`);
            if (response.data.success) {
                showAlert('Đã gửi thông tin đăng nhập thành công', 'success');
                setShowEmailModal(false);
                setShowDetailModal(false);
            } else {
                setError(response.data.message || 'Lỗi khi gửi email');
            }
        } catch (error) {
            console.error('Error sending credentials:', error);
            setError(error.response?.data?.message || 'Lỗi khi gửi email');
        } finally {
            setEmailLoading(false);
        }
    };

    const handleApproveUser = async (userId) => {
        try {
            setLoading(true);
            const response = await api.post(`/auth/approve-user/${userId}`);
            if (response.data.success) {
                showAlert('Đã duyệt sinh viên thành công', 'success');
                fetchStudents();
                if (selectedStudent && selectedStudent.id === userId) {
                    setSelectedStudent({ ...selectedStudent, approved: true });
                }
            } else {
                setError(response.data.message || 'Không thể duyệt sinh viên');
            }
        } catch (error) {
            console.error('Error approving user:', error);
            setError(error.response?.data?.message || 'Không thể duyệt sinh viên');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewUser(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImportFile(file);
            setImportErrors([]);
            setImportSuccess('');
        }
    };

    const handleAddUser = async (e) => {
        e.preventDefault();
        
        // Prevent double submission
        if (loading) {
            console.log('Add user already in progress, ignoring duplicate call');
            return;
        }
        
        try {
            setLoading(true);
            setError('');
            const response = await api.post('/users', newUser);
            if (response.data.success) {
                showAlert('Thêm sinh viên thành công', 'success');
                setShowAddModal(false);
                setNewUser({
                    username: '',
                    email: '',
                    fullName: '',
                    password: '',
                    role: 'student',
                    student_id: '',
                    class_name: '',
                    faculty_name: '',
                    major_name: '',
                    birth_date: '',
                    gender: '',
                    address: '',
                    id_number: '',
                    status: 'Đang học',
                    phone: ''
                });
                fetchStudents();
            } else {
                setError(response.data.message || 'Không thể thêm sinh viên');
            }
        } catch (error) {
            console.error('Error adding user:', error);
            setError(error.response?.data?.message || 'Không thể thêm sinh viên');
        } finally {
            setLoading(false);
        }
    };

    const handleImportStudents = async () => {
        if (!importFile) {
            setImportErrors(['Vui lòng chọn file Excel để nhập']);
            return;
        }

        setImportLoading(true);
        setImportErrors([]);
        setImportSuccess('');
        setImportProgress(0);
        setImportTotal(0);

        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);

                    if (jsonData.length === 0) {
                        setImportErrors(['File không chứa dữ liệu']);
                        setImportLoading(false);
                        return;
                    }

                    setImportTotal(jsonData.length);
                    const errors = [];
                    let successCount = 0;

                    for (let i = 0; i < jsonData.length; i++) {
                        const row = jsonData[i];
                        setImportProgress(i + 1);

                        try {
                            const studentData = {
                                username: row['Mã SV'] || row['username'] || '',
                                email: row['Email'] || row['email'] || '',
                                fullName: row['Họ và tên'] || row['full_name'] || '',
                                password: row['password'] || row['Mật khẩu'] || '',
                                role: 'student',
                                student_id: row['Mã SV'] || row['student_id'] || '',
                                class_name: row['Mã lớp'] || row['class_name'] || '',
                                faculty_name: row['Khoa'] || row['faculty_name'] || '',
                                major_name: row['Ngành'] || row['major_name'] || '',
                                birth_date: row['Ngày sinh'] || row['birth_date'] || '',
                                gender: row['Phái'] || row['gender'] || '',
                                status: 'Đang học'
                            };

                            await api.post('/users', studentData);
                            successCount++;
                        } catch (error) {
                            errors.push(`Dòng ${i + 2}: ${error.response?.data?.message || 'Lỗi không xác định'}`);
                        }
                    }

                    setImportLoading(false);
                    if (errors.length > 0) {
                        setImportErrors(errors);
                    }
                    if (successCount > 0) {
                        setImportSuccess(`Đã nhập thành công ${successCount} sinh viên`);
                        fetchStudents();
                    }
                } catch (error) {
                    setImportErrors(['Lỗi khi đọc file Excel']);
                    setImportLoading(false);
                }
            };
            reader.readAsArrayBuffer(importFile);
        } catch (error) {
            setImportErrors(['Lỗi khi xử lý file']);
            setImportLoading(false);
        }
    };

    const handleExportStudents = async () => {
        try {
            setLoading(true);
            const response = await api.get('/users/export?role=student');
            if (response.data.success) {
                const students = response.data.data;
                const worksheet = XLSX.utils.json_to_sheet(students.map(student => ({
                    'Mã SV': student.student_id || '',
                    'Họ và tên': student.full_name || '',
                    'Email': student.email || '',
                    'Mã lớp': student.class_name || '',
                    'Khoa': student.faculty_name || '',
                    'Ngành': student.major_name || '',
                    'Ngày sinh': student.birth_date ? new Date(student.birth_date).toLocaleDateString() : '',
                    'Phái': student.gender || '',
                    'SĐT': student.phone || '',
                    'Tình trạng': student.status || ''
                })));
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, 'Danh sách sinh viên');
                XLSX.writeFile(workbook, `Danh_sach_sinh_vien_${new Date().toISOString().split('T')[0]}.xlsx`);
                showAlert('Xuất Excel thành công', 'success');
            }
        } catch (error) {
            console.error('Error exporting students:', error);
            showAlert('Lỗi khi xuất Excel', 'danger');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAllStudents = async () => {
        try {
            setLoading(true);
            const response = await api.delete('/users/students/all');
            if (response.data.success) {
                showAlert(response.data.message || 'Đã xóa toàn bộ danh sách sinh viên', 'success');
                fetchStudents();
            } else {
                showAlert(response.data.message || 'Lỗi khi xóa danh sách sinh viên', 'danger');
            }
        } catch (error) {
            console.error('Delete all students error:', error);
            showAlert(error.response?.data?.message || 'Lỗi khi xóa danh sách sinh viên', 'danger');
        } finally {
            setLoading(false);
        }
    };

    const fetchAllStudents = async () => {
        try {
            const response = await api.get('/users?role=student');
            if (response.data.success) {
                setAllStudents(response.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching all students:', error);
        }
    };

    const handleBulkSendCredentials = () => {
        setShowBulkEmailModal(true);
        setBulkEmailTab('filter');
        fetchAllStudents();
        
        if (selectedClassForEmail || selectedFacultyForEmail || selectedMajorForEmail) {
            fetchFilteredStudentsForEmail();
        }
    };

    const handleBulkEmailConfirm = () => {
        setShowBulkEmailConfirmModal(true);
    };

    const sendBulkCredentialsEmail = async () => {
        setBulkEmailLoading(true);
        setShowBulkEmailConfirmModal(false);
        setShowBulkEmailProgressModal(true);
        
        setBulkEmailProgress({
            current: 0,
            total: 0,
            currentEmail: '',
            currentName: '',
            message: 'Đang khởi tạo...',
            sent: 0,
            failed: 0,
            errors: [],
            isComplete: false
        });

        try {
            let filteredStudents;

            if (bulkEmailTab === 'all') {
                filteredStudents = allStudents.filter(s => s.display_password);
            } else {
                filteredStudents = filteredStudentsForEmail.filter(s => s.display_password);
                if (selectedStudentsForEmail.length > 0) {
                    filteredStudents = filteredStudents.filter(s => selectedStudentsForEmail.includes(s.id));
                }
            }

            if (filteredStudents.length === 0) {
                setError('Không có sinh viên nào có mật khẩu để gửi');
                setBulkEmailLoading(false);
                return;
            }

            const requestData = {
                userIds: filteredStudents.map(s => s.id)
            };

            const token = localStorage.getItem('token');
            const baseURL = '/api';
            
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
            
            const url = `${baseURL}/users/credentials/bulk-send-credentials-progress`;
            const headers = {
                'Content-Type': 'application/json',
                'x-auth-token': token || '',
                'Authorization': `Bearer ${token}`
            };
            
            if (csrfToken) {
                headers['x-csrf-token'] = csrfToken;
            }
            
            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                credentials: 'include',
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.substring(6));
                                
                                if (data.type === 'progress') {
                                    setBulkEmailProgress(prev => ({
                                        ...prev,
                                        current: data.current || 0,
                                        total: data.total || 0,
                                        message: data.message || ''
                                    }));
                                } else if (data.type === 'sending') {
                                    setBulkEmailProgress(prev => ({
                                        ...prev,
                                        current: data.current || 0,
                                        total: data.total || 0,
                                        currentEmail: data.currentEmail || '',
                                        currentName: data.currentName || '',
                                        message: data.message || `Đang gửi đến ${data.currentEmail}...`
                                    }));
                                } else if (data.type === 'sent') {
                                    setBulkEmailProgress(prev => ({
                                        ...prev,
                                        current: data.current || 0,
                                        total: data.total || 0,
                                        currentEmail: data.currentEmail || '',
                                        currentName: data.currentName || '',
                                        sent: data.sent || 0,
                                        failed: data.failed || 0,
                                        message: data.message || `Đã gửi đến ${data.currentEmail}`
                                    }));
                                } else if (data.type === 'failed') {
                                    setBulkEmailProgress(prev => ({
                                        ...prev,
                                        current: data.current || 0,
                                        total: data.total || 0,
                                        currentEmail: data.currentEmail || '',
                                        currentName: data.currentName || '',
                                        sent: data.sent || 0,
                                        failed: data.failed || 0,
                                        message: data.message || `Lỗi khi gửi đến ${data.currentEmail}`,
                                        errors: [...(prev.errors || []), data.message || `Lỗi: ${data.currentEmail}`]
                                    }));
                                } else if (data.type === 'complete') {
                                    setBulkEmailProgress(prev => ({
                                        ...prev,
                                        current: data.total || prev.total,
                                        total: data.total || prev.total,
                                        sent: data.sent || 0,
                                        failed: data.failed || 0,
                                        message: data.message || 'Hoàn thành!',
                                        errors: data.errors || [],
                                        isComplete: true
                                    }));
                                    
                                    setBulkEmailLoading(false);
                                    
                                    if (data.sent > 0) {
                                        showAlert(`Đã gửi ${data.sent}/${data.total} email thành công`, 'success');
                                    }
                                    
                                    if (data.failed > 0) {
                                        showAlert(`${data.failed} email gửi thất bại`, 'warning');
                                    }
                                } else if (data.type === 'error') {
                                    setBulkEmailProgress(prev => ({
                                        ...prev,
                                        message: data.message || 'Đã xảy ra lỗi',
                                        isComplete: true
                                    }));
                                    setError(data.message || 'Lỗi khi gửi email hàng loạt');
                                    setBulkEmailLoading(false);
                                    showAlert(data.message || 'Lỗi khi gửi email hàng loạt', 'danger');
                                    break;
                                }
                            } catch (err) {
                                console.error('Error parsing SSE data:', err);
                            }
                        }
                    }
                }
            } catch (streamError) {
                console.error('Error reading stream:', streamError);
                setError('Lỗi khi đọc dữ liệu từ server');
                setBulkEmailLoading(false);
                setBulkEmailProgress(prev => ({
                    ...prev,
                    message: 'Lỗi khi đọc dữ liệu từ server',
                    isComplete: true
                }));
                showAlert('Lỗi khi đọc dữ liệu từ server', 'danger');
            }
            
        } catch (error) {
            console.error('Error sending bulk credentials:', error);
            setError(error.message || 'Lỗi khi gửi email hàng loạt');
            setBulkEmailLoading(false);
            setBulkEmailProgress(prev => ({
                ...prev,
                message: error.message || 'Lỗi khi gửi email hàng loạt',
                isComplete: true
            }));
            showAlert(error.message || 'Lỗi khi gửi email hàng loạt', 'danger');
        }
    };

    const handleOpenRoleModal = (user) => {
        setSelectedUser(user);
        const moduleRoles = user.module_roles || [];
        const currentLmsRole = moduleRoles.find(role => role.startsWith('lms_'));
        
        // Parse JSON fields safely
        let questionTypes = {};
        let difficulties = {};
        let bloomLevels = {};
        
        try {
            questionTypes = user.lms_staff_question_types 
                ? (typeof user.lms_staff_question_types === 'string' 
                    ? JSON.parse(user.lms_staff_question_types) 
                    : user.lms_staff_question_types)
                : {};
        } catch (e) {
            console.error('Error parsing question types:', e);
        }
        
        try {
            difficulties = user.lms_staff_difficulties 
                ? (typeof user.lms_staff_difficulties === 'string' 
                    ? JSON.parse(user.lms_staff_difficulties) 
                    : user.lms_staff_difficulties)
                : {};
        } catch (e) {
            console.error('Error parsing difficulties:', e);
        }
        
        try {
            bloomLevels = user.lms_staff_bloom_levels 
                ? (typeof user.lms_staff_bloom_levels === 'string' 
                    ? JSON.parse(user.lms_staff_bloom_levels) 
                    : user.lms_staff_bloom_levels)
                : {};
        } catch (e) {
            console.error('Error parsing bloom levels:', e);
        }
        
        // Format expiration date for date input (YYYY-MM-DD)
        // IMPORTANT: Use local date components to avoid timezone issues
        let formattedExpirationDate = '';
        if (user.lms_role_expiration) {
            try {
                const dateStr = String(user.lms_role_expiration).trim();
                // If it's already in YYYY-MM-DD format, use it directly
                if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                    formattedExpirationDate = dateStr;
                } else {
                    // Otherwise, parse and format using local date components
                    // This avoids timezone conversion issues
                    const date = new Date(dateStr + 'T12:00:00'); // Use noon to avoid timezone edge cases
                    if (!isNaN(date.getTime())) {
                        // Get local date components (not UTC) to preserve the intended date
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        formattedExpirationDate = `${year}-${month}-${day}`;
                    }
                }
            } catch (e) {
                console.error('Error formatting expiration date:', e);
                formattedExpirationDate = '';
            }
        }

        setRoleFormData({
            role: currentLmsRole ? currentLmsRole.replace('lms_', '') : '',
            expirationDate: formattedExpirationDate,
            totalQuestions: user.lms_staff_total_questions || '',
            allowExceed: user.lms_staff_allow_exceed === true || user.lms_staff_allow_exceed === 1 || false,
            questionTypeCounts: {
                mcq: questionTypes.mcq || '',
                multiple_response: questionTypes.multiple_response || '',
                true_false: questionTypes.true_false || '',
                matching: questionTypes.matching || '',
                short_answer: questionTypes.short_answer || '',
                essay: questionTypes.essay || '',
                fill_blank: questionTypes.fill_blank || '',
                ordering: questionTypes.ordering || ''
            },
            difficultyCounts: {
                easy: difficulties.easy || '',
                medium: difficulties.medium || '',
                hard: difficulties.hard || '',
                expert: difficulties.expert || ''
            },
            bloomCounts: {
                remember: bloomLevels.remember || '',
                understand: bloomLevels.understand || '',
                apply: bloomLevels.apply || '',
                analyze: bloomLevels.analyze || '',
                evaluate: bloomLevels.evaluate || '',
                create: bloomLevels.create || ''
            }
        });
        setShowRoleModal(true);
    };

    const handleSaveRole = async () => {
        if (!selectedUser) return;

        try {
            setLoading(true);
            const moduleRoles = selectedUser.module_roles || [];
            
            // Remove existing LMS roles
            const updatedRoles = moduleRoles.filter(role => !role.startsWith('lms_'));
            
            // Add new role if selected
            if (roleFormData.role) {
                updatedRoles.push(`lms_${roleFormData.role}`);
            }

            const updateData = {
                module_roles: updatedRoles,
                lms_role_expiration: roleFormData.expirationDate || null
            };

            // Add staff conditions if role is staff
            if (roleFormData.role === 'staff') {
                updateData.lms_staff_total_questions = roleFormData.totalQuestions || null;
                updateData.lms_staff_question_types = JSON.stringify(roleFormData.questionTypeCounts);
                updateData.lms_staff_difficulties = JSON.stringify(roleFormData.difficultyCounts);
                updateData.lms_staff_bloom_levels = JSON.stringify(roleFormData.bloomCounts);
                updateData.lms_staff_allow_exceed = roleFormData.allowExceed || false;
            } else {
                // Clear staff conditions if role is not staff
                updateData.lms_staff_total_questions = null;
                updateData.lms_staff_question_types = null;
                updateData.lms_staff_difficulties = null;
                updateData.lms_staff_bloom_levels = null;
                updateData.lms_staff_allow_exceed = false;
            }

            const response = await api.put(`/users/${selectedUser.id}`, updateData);

            if (response.data.success) {
                showAlert('Cập nhật quyền LMS thành công', 'success');
                setShowRoleModal(false);
                fetchUsers();
            } else {
                setError(response.data.message || 'Không thể cập nhật quyền');
            }
        } catch (error) {
            console.error('Error saving role:', error);
            setError(error.response?.data?.message || 'Không thể cập nhật quyền');
        } finally {
            setLoading(false);
        }
    };

    const formatModuleRole = (roleKey) => {
        const roleMap = {
            'lms_mod': 'Quản lý LMS',
            'lms_staff': 'Nhân viên LMS',
            'lms_view': 'Chỉ xem LMS'
        };
        return roleMap[roleKey] || roleKey;
    };

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

    const isRoleExpired = (expirationDate) => {
        if (!expirationDate) return false;
        return new Date(expirationDate) < new Date();
    };

    const renderStudentsTab = () => {
        const currentIsMobile = window.innerWidth <= 768;

        return (
            <>
                {/* Search and Filter Controls */}
                <div className="session-list-controls">
                    <div className="search-controls">
                        <div className="search-input">
                            <input
                                type="text"
                                placeholder="Tìm kiếm theo tên, email, mã SV..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="search-input"
                            />
                        </div>

                        <select
                            className="filter-select"
                            value={classFilter}
                            onChange={(e) => handleFilterChange('class', e.target.value)}
                        >
                            <option value="">Tất cả lớp</option>
                            {uniqueClasses.map((className, index) => (
                                <option key={index} value={className}>{className}</option>
                            ))}
                        </select>

                        <select
                            className="filter-select"
                            value={facultyFilter}
                            onChange={(e) => handleFilterChange('faculty', e.target.value)}
                        >
                            <option value="">Tất cả khoa</option>
                            {uniqueFaculties.map((facultyName, index) => (
                                <option key={index} value={facultyName}>{facultyName}</option>
                            ))}
                        </select>

                        <select
                            className="filter-select"
                            value={majorFilter}
                            onChange={(e) => handleFilterChange('major', e.target.value)}
                        >
                            <option value="">Tất cả ngành</option>
                            {uniqueMajors.map((majorName, index) => (
                                <option key={index} value={majorName}>{majorName}</option>
                            ))}
                        </select>

                        <select
                            className="filter-select"
                            value={statusFilter}
                            onChange={(e) => handleFilterChange('status', e.target.value)}
                        >
                            <option value="">Tất cả tình trạng</option>
                            {uniqueStatuses.map((status, index) => (
                                <option key={index} value={status}>{status}</option>
                            ))}
                        </select>

                        {(classFilter || facultyFilter || majorFilter || statusFilter) && (
                            <Button
                                variant="outline-secondary"
                                onClick={() => {
                                    setClassFilter('');
                                    setFacultyFilter('');
                                    setMajorFilter('');
                                    setStatusFilter('');
                                }}
                                className="filter-btn"
                            >
                                Xóa bộ lọc
                            </Button>
                        )}
                    </div>
                </div>

                {/* Students Table */}
                <div className="session-table-container">
                    <div className="table-responsive-mobile">
                        <table className="session-table students-table">
                            <thead>
                                <tr>
                                    <th className={currentIsMobile ? "mobile-essential" : "mobile-hide"}>#</th>
                                    <th
                                        onClick={() => handleSort('student_id')}
                                        style={{ cursor: 'pointer' }}
                                        className="text-nowrap mobile-essential"
                                    >
                                        Mã SV {sortField === 'student_id' && (
                                            <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                                        )}
                                    </th>
                                    <th
                                        onClick={() => handleSort('full_name')}
                                        style={{ cursor: 'pointer' }}
                                        className="text-nowrap mobile-essential"
                                    >
                                        Họ và tên {sortField === 'full_name' && (
                                            <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                                        )}
                                    </th>
                                    <th className="mobile-essential">Email</th>
                                    <th className={currentIsMobile ? "mobile-essential" : "mobile-hide"}>Mật khẩu</th>
                                    <th className="mobile-essential">Lớp</th>
                                    <th className="mobile-essential">Khoa</th>
                                    <th className="mobile-essential">Ngày sinh</th>
                                    <th className="mobile-essential">Giới tính</th>
                                    <th className="mobile-essential">SĐT</th>
                                    <th className="mobile-essential">Tình trạng</th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.length > 0 ? (
                                    students
                                        .map((student, index) => (
                                            <tr key={student.id} onClick={() => handleStudentRowClick(student)} style={{ cursor: 'pointer' }}>
                                                <td className={currentIsMobile ? "mobile-essential" : "mobile-hide"}>
                                                    {(pagination.page - 1) * pagination.limit + index + 1}
                                                </td>
                                                <td className="mobile-essential">{student.student_id || '-'}</td>
                                                <td className="mobile-essential">
                                                    <div className="d-flex align-items-center">
                                                        <span>{student.full_name || '-'}</span>
                                                        {student.face_embedding && student.face_embedding.trim() !== '' && (
                                                            <i 
                                                                className="fas fa-check-circle text-success ms-2" 
                                                                title="Đã xác thực khuôn mặt"
                                                                style={{ fontSize: '0.9rem' }}
                                                            ></i>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="mobile-essential">{student.email || '-'}</td>
                                                <td className={currentIsMobile ? "mobile-essential" : "mobile-hide"}>
                                                    {student.display_password ? (
                                                        <span
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                togglePasswordVisibility(student.id);
                                                            }}
                                                            style={{ cursor: 'pointer' }}
                                                            title={visiblePasswords[student.id] ? "Ẩn mật khẩu" : "Hiển thị mật khẩu"}
                                                        >
                                                            {visiblePasswords[student.id] ? student.display_password : "••••••••"}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted">Đang tạo...</span>
                                                    )}
                                                </td>
                                                <td className="mobile-essential">{student.class_name || '-'}</td>
                                                <td className="mobile-essential">{student.faculty_name || '-'}</td>
                                                <td className="mobile-essential">{student.birth_date ? new Date(student.birth_date).toLocaleDateString('vi-VN') : '-'}</td>
                                                <td className="mobile-essential">
                                                    {student.gender === null || student.gender === undefined ? 'Nam' :
                                                        student.gender === 'male' ? 'Nữ' :
                                                            student.gender === 'female' ? 'Nữ' :
                                                                student.gender === 'other' ? 'Khác' : '-'}
                                                </td>
                                                <td className="mobile-essential">{student.phone || '-'}</td>
                                                <td className="mobile-essential">
                                                    <Badge bg={student.status === 'Đang học' ? 'success' :
                                                        student.status === 'Tạm nghỉ' ? 'warning' :
                                                            student.status === 'Thôi học' ? 'danger' : 'secondary'}>
                                                        {student.status || 'Đang học'}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        ))
                                ) : (
                                    <tr>
                                        <td colSpan="11" className="text-center">
                                            {loading ? (
                                                <Spinner animation="border" size="sm" />
                                            ) : (
                                                'Không có sinh viên nào'
                                            )}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {students.length > 0 && pagination.totalPages > 1 && (
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
                </div>
            </>
        );
    };

    const renderUsersTab = () => {
        const currentIsMobile = window.innerWidth <= 768;

        return (
            <>
                {/* Search Controls */}
                <div className="session-list-controls">
                    <div className="search-controls">
                        <div className="search-input">
                            <input
                                type="text"
                                placeholder="Tìm kiếm người dùng..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="search-input"
                            />
                        </div>
                    </div>
                </div>

                {/* Users Table */}
                <div className="session-table-container">
                    <div className="table-responsive-mobile">
                        <table className="session-table staff-table">
                            <thead>
                                <tr>
                                    <th className={currentIsMobile ? "mobile-hide" : "mobile-hide"}>#</th>
                                    <th className="mobile-essential">Tên đăng nhập</th>
                                    <th className="mobile-essential">Họ và tên</th>
                                    <th className={currentIsMobile ? "mobile-hide" : "mobile-hide"}>Email</th>
                                    <th className="mobile-essential">Vai trò LMS</th>
                                    <th className="mobile-essential">Thời hạn</th>
                                    <th className="mobile-essential">Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.length > 0 ? (
                                    users
                                        .slice((pagination.page - 1) * pagination.limit, pagination.page * pagination.limit)
                                        .map((user, index) => {
                                            const moduleRoles = user.module_roles || [];
                                            const lmsRole = moduleRoles.find(role => role.startsWith('lms_'));
                                            const expired = isRoleExpired(user.lms_role_expiration);
                                            
                                            return (
                                                <tr 
                                                    key={user.id}
                                                    onClick={() => handleOpenRoleModal(user)}
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    <td className={currentIsMobile ? "mobile-hide" : "mobile-hide"}>
                                                        {(pagination.page - 1) * pagination.limit + index + 1}
                                                    </td>
                                                    <td className="mobile-essential">
                                                        <div className="user-info-mobile">
                                                            <div className="user-username">{user.username}</div>
                                                            {currentIsMobile && (
                                                                <div className="user-email-mobile">{user.email}</div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="mobile-essential">{user.full_name}</td>
                                                    <td className={currentIsMobile ? "mobile-hide" : "mobile-hide"}>
                                                        {!currentIsMobile && user.email}
                                                    </td>
                                                    <td className="mobile-essential">
                                                        {lmsRole ? (
                                                            <Badge bg={
                                                                lmsRole === 'lms_mod' ? 'warning' :
                                                                lmsRole === 'lms_staff' ? 'info' : 'secondary'
                                                            }>
                                                                {formatModuleRole(lmsRole)}
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-muted">Chưa có</span>
                                                        )}
                                                    </td>
                                                    <td className="mobile-essential">
                                                        {user.lms_role_expiration ? (
                                                            <span className={expired ? 'text-danger' : ''}>
                                                                {formatDate(user.lms_role_expiration)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted">-</span>
                                                        )}
                                                    </td>
                                                    <td className="mobile-essential">
                                                        {expired && lmsRole ? (
                                                            <Badge bg="danger">Hết hạn</Badge>
                                                        ) : lmsRole ? (
                                                            <Badge bg="success">Hoạt động</Badge>
                                                        ) : (
                                                            <Badge bg="secondary">Chưa cấp</Badge>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                ) : (
                                    <tr>
                                        <td colSpan="7" className="text-center">
                                            {loading ? (
                                                <Spinner animation="border" size="sm" />
                                            ) : (
                                                'Không có người dùng nào'
                                            )}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {users.length > 0 && pagination.totalPages > 1 && (
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
                </div>
            </>
        );
    };

    return (
        <div>
            {/* Header Section */}
            <div className="session-header">
                <div className="header-content">
                    <div className="header-title">
                        <h1>Quản lý người dùng LMS</h1>
                        <p className="header-subtitle">Quản lý và phân quyền người dùng trong hệ thống LMS</p>
                    </div>
                    <div className="header-actions">
                        {activeTab === 'students' ? (
                            <>
                                <Button
                                    variant="outline-light"
                                    className="create-session-btn"
                                    onClick={() => {
                                        setNewUser(prev => ({ ...prev, role: 'student' }));
                                        setShowAddModal(true);
                                    }}
                                >
                                    <i className="fas fa-plus"></i>
                                    Thêm sinh viên
                                </Button>
                                <Button
                                    variant="outline-light"
                                    className="create-session-btn"
                                    onClick={() => setShowImportModal(true)}
                                >
                                    <i className="fas fa-file-import"></i>
                                    Nhập từ Excel
                                </Button>
                                <Button
                                    variant="outline-light"
                                    className="create-session-btn"
                                    onClick={handleBulkSendCredentials}
                                >
                                    <i className="fas fa-envelope"></i>
                                    Gửi thông tin đăng nhập
                                </Button>
                                <Button
                                    variant="outline-light"
                                    className="create-session-btn"
                                    onClick={handleExportStudents}
                                >
                                    <i className="fas fa-file-export"></i>
                                    Xuất Excel
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button
                                    variant="outline-light"
                                    className="create-session-btn"
                                    onClick={() => {
                                        showAlert('Tính năng xuất Excel sẽ được thêm sau', 'info');
                                    }}
                                >
                                    <i className="fas fa-file-export"></i>
                                    Xuất Excel
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {error && <Alert variant="danger" onClose={() => setError('')} dismissible>{error}</Alert>}

            {/* Tab Navigation */}
            <div className="tab-navigation">
                <Tabs
                    activeKey={activeTab}
                    onSelect={handleTabChange}
                    className="custom-tabs"
                >
                    <Tab eventKey="students" title={
                        <span className="tab-title">
                            <i className="fas fa-user-graduate"></i>
                            Danh sách sinh viên
                        </span>
                    }>
                        {renderStudentsTab()}
                    </Tab>
                    <Tab eventKey="users" title={
                        <span className="tab-title">
                            <i className="fas fa-users-cog"></i>
                            Danh sách người dùng
                        </span>
                    }>
                        {renderUsersTab()}
                    </Tab>
                </Tabs>
            </div>

            {/* Role Assignment Modal */}
            <Modal show={showRoleModal} onHide={() => setShowRoleModal(false)} size="xl" className="student-detail-modal">
                <Modal.Header closeButton className="student-detail-header">
                    <Modal.Title className="student-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-shield-alt"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Phân quyền LMS</h4>
                            <p className="mb-0 student-subtitle">
                                {selectedUser?.full_name || selectedUser?.username || 'Người dùng'}
                            </p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="student-detail-body">
                    <div className="student-detail-container">
                        <Alert variant="info" className="mb-4">
                            <div className="d-flex align-items-center">
                                <i className="fas fa-info-circle me-3"></i>
                                <div>
                                    <strong>Hướng dẫn:</strong> Chọn quyền LMS cho người dùng này.
                                    Có thể đặt thời hạn cho các role mod, staff, view.
                                    Với role staff, có thể thiết lập điều kiện nhập câu hỏi.
                                </div>
                            </div>
                        </Alert>

                        <div className="session-card mb-4">
                            <div className="card-header-modern">
                                <div className="header-icon">
                                    <i className="fas fa-user-shield"></i>
                                </div>
                                <h6 className="mb-0">Vai trò LMS</h6>
                            </div>
                            <div className="card-body-modern">
                                <Row>
                                    <Col md={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="info-label">
                                                <i className="fas fa-layer-group me-2"></i>
                                                Vai trò
                                            </Form.Label>
                                            <Form.Select
                                                value={roleFormData.role}
                                                onChange={(e) => setRoleFormData(prev => ({ ...prev, role: e.target.value }))}
                                                className="form-control-modern"
                                            >
                                                <option value="">Không có quyền</option>
                                                {lmsRoles.map(role => (
                                                    <option key={role} value={role}>
                                                        {role === 'mod' ? 'Quản lý' : role === 'staff' ? 'Nhân viên' : 'Chỉ xem'}
                                                    </option>
                                                ))}
                                            </Form.Select>
                                        </Form.Group>
                                    </Col>
                                    {(roleFormData.role === 'mod' || roleFormData.role === 'staff' || roleFormData.role === 'view') && (
                                        <Col md={6}>
                                            <Form.Group className="mb-3">
                                                <Form.Label className="info-label">
                                                    <i className="fas fa-calendar-alt me-2"></i>
                                                    Thời hạn (tùy chọn)
                                                </Form.Label>
                                                <Form.Control
                                                    type="date"
                                                    value={roleFormData.expirationDate}
                                                    onChange={(e) => setRoleFormData(prev => ({ ...prev, expirationDate: e.target.value }))}
                                                    className="form-control-modern"
                                                />
                                                <Form.Text className="text-muted">
                                                    Để trống nếu không giới hạn thời gian
                                                </Form.Text>
                                            </Form.Group>
                                        </Col>
                                    )}
                                </Row>
                            </div>
                        </div>

                        {roleFormData.role === 'staff' && (
                            <div className="session-card">
                                <div className="card-header-modern">
                                    <div className="header-icon">
                                        <i className="fas fa-question-circle"></i>
                                    </div>
                                    <h6 className="mb-0">Điều kiện nhập câu hỏi (cho role Staff)</h6>
                                </div>
                                <div className="card-body-modern">
                                    <Form.Group className="mb-3">
                                        <Form.Label className="info-label">
                                            <i className="fas fa-list-ol me-2"></i>
                                            Tổng số câu hỏi
                                        </Form.Label>
                                        <Form.Control
                                            type="number"
                                            min="0"
                                            value={roleFormData.totalQuestions}
                                            onChange={(e) => setRoleFormData(prev => ({ ...prev, totalQuestions: e.target.value }))}
                                            placeholder="Nhập tổng số câu hỏi được phép"
                                            className="form-control-modern"
                                        />
                                    </Form.Group>

                                    <Form.Group className="mb-3">
                                        <div>
                                            <Form.Check
                                                type="radio"
                                                id="allowExceedNo"
                                                label="Không cho phép số lượng dư, vượt quá điều kiện"
                                                checked={!roleFormData.allowExceed}
                                                onChange={() => setRoleFormData(prev => ({ ...prev, allowExceed: false }))}
                                                className="mb-2"
                                            />
                                            <Form.Check
                                                type="radio"
                                                id="allowExceedYes"
                                                label="Cho phép số lượng dư, vượt quá điều kiện"
                                                checked={roleFormData.allowExceed}
                                                onChange={() => setRoleFormData(prev => ({ ...prev, allowExceed: true }))}
                                            />
                                        </div>
                                        <Form.Text className="text-muted">
                                            Nếu chọn "Không cho phép", hệ thống sẽ chặn khi số lượng câu hỏi vượt quá điều kiện đã set. Nếu chọn "Cho phép", hệ thống sẽ cho phép số lượng vượt quá.
                                        </Form.Text>
                                    </Form.Group>

                                    <Row>
                                        <Col md={4}>
                                            <div className="session-card mb-3">
                                                <div className="card-header-modern">
                                                    <div className="header-icon">
                                                        <i className="fas fa-tags"></i>
                                                    </div>
                                                    <h6 className="mb-0">Loại câu hỏi</h6>
                                                </div>
                                                <div className="card-body-modern">
                                                    {questionTypes.map(type => (
                                                        <Form.Group key={type} className="mb-3 d-flex align-items-center">
                                                            <Form.Label className="info-label mb-0 flex-grow-1">
                                                                <i className="fas fa-tag me-2"></i>
                                                                {type === 'mcq' ? 'Trắc nghiệm' :
                                                                 type === 'multiple_response' ? 'Nhiều lựa chọn' :
                                                                 type === 'true_false' ? 'Đúng/Sai' :
                                                                 type === 'matching' ? 'Ghép đôi' :
                                                                 type === 'short_answer' ? 'Trả lời ngắn' :
                                                                 type === 'essay' ? 'Tự luận' :
                                                                 type === 'fill_blank' ? 'Điền vào chỗ trống' :
                                                                 'Sắp xếp'}
                                                            </Form.Label>
                                                            <Form.Control
                                                                type="number"
                                                                min="0"
                                                                value={roleFormData.questionTypeCounts[type]}
                                                                onChange={(e) => setRoleFormData(prev => ({
                                                                    ...prev,
                                                                    questionTypeCounts: {
                                                                        ...prev.questionTypeCounts,
                                                                        [type]: e.target.value
                                                                    }
                                                                }))}
                                                                placeholder="0"
                                                                className="form-control-modern"
                                                                style={{ width: '80px', marginLeft: '10px' }}
                                                            />
                                                        </Form.Group>
                                                    ))}
                                                </div>
                                            </div>
                                        </Col>
                                        <Col md={4}>
                                            <div className="session-card mb-3">
                                                <div className="card-header-modern">
                                                    <div className="header-icon">
                                                        <i className="fas fa-signal"></i>
                                                    </div>
                                                    <h6 className="mb-0">Độ khó</h6>
                                                </div>
                                                <div className="card-body-modern">
                                                    {difficultyLevels.map(level => (
                                                        <Form.Group key={level} className="mb-3 d-flex align-items-center">
                                                            <Form.Label className="info-label mb-0 flex-grow-1">
                                                                <i className="fas fa-chart-line me-2"></i>
                                                                {level === 'easy' ? 'Dễ' :
                                                                 level === 'medium' ? 'Trung bình' :
                                                                 level === 'hard' ? 'Khó' : 'Rất khó'}
                                                            </Form.Label>
                                                            <Form.Control
                                                                type="number"
                                                                min="0"
                                                                value={roleFormData.difficultyCounts[level]}
                                                                onChange={(e) => setRoleFormData(prev => ({
                                                                    ...prev,
                                                                    difficultyCounts: {
                                                                        ...prev.difficultyCounts,
                                                                        [level]: e.target.value
                                                                    }
                                                                }))}
                                                                placeholder="0"
                                                                className="form-control-modern"
                                                                style={{ width: '80px', marginLeft: '10px' }}
                                                            />
                                                        </Form.Group>
                                                    ))}
                                                </div>
                                            </div>
                                        </Col>
                                        <Col md={4}>
                                            <div className="session-card mb-3">
                                                <div className="card-header-modern">
                                                    <div className="header-icon">
                                                        <i className="fas fa-graduation-cap"></i>
                                                    </div>
                                                    <h6 className="mb-0">Phân loại Bloom</h6>
                                                </div>
                                                <div className="card-body-modern">
                                                    {bloomLevels.map(level => (
                                                        <Form.Group key={level} className="mb-3 d-flex align-items-center">
                                                            <Form.Label className="info-label mb-0 flex-grow-1">
                                                                <i className="fas fa-brain me-2"></i>
                                                                {level === 'remember' ? 'Nhớ' :
                                                                 level === 'understand' ? 'Hiểu' :
                                                                 level === 'apply' ? 'Áp dụng' :
                                                                 level === 'analyze' ? 'Phân tích' :
                                                                 level === 'evaluate' ? 'Đánh giá' : 'Sáng tạo'}
                                                            </Form.Label>
                                                            <Form.Control
                                                                type="number"
                                                                min="0"
                                                                value={roleFormData.bloomCounts[level]}
                                                                onChange={(e) => setRoleFormData(prev => ({
                                                                    ...prev,
                                                                    bloomCounts: {
                                                                        ...prev.bloomCounts,
                                                                        [level]: e.target.value
                                                                    }
                                                                }))}
                                                                placeholder="0"
                                                                className="form-control-modern"
                                                                style={{ width: '80px', marginLeft: '10px' }}
                                                            />
                                                        </Form.Group>
                                                    ))}
                                                </div>
                                            </div>
                                        </Col>
                                    </Row>
                                </div>
                            </div>
                        )}
                    </div>
                </Modal.Body>
                <Modal.Footer className="student-detail-footer">
                    <Button variant="outline-secondary" onClick={() => setShowRoleModal(false)} className="btn-cancel">
                        <i className="fas fa-times me-2"></i>
                        Hủy
                    </Button>
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
                                Lưu quyền LMS
                            </>
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Add User Modal */}
            <Modal show={showAddModal} onHide={() => setShowAddModal(false)} size="xl" className="student-detail-modal">
                <Modal.Header closeButton className="student-detail-header">
                    <Modal.Title className="student-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-user-plus"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Thêm sinh viên mới</h4>
                            <p className="mb-0 student-subtitle">Tạo tài khoản mới trong hệ thống</p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="student-detail-body">
                    <div className="student-detail-container">
                        <Form onSubmit={handleAddUser}>
                            {/* Basic Information Card */}
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
                                                    name="username"
                                                    value={newUser.username}
                                                    onChange={handleInputChange}
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
                                                    name="email"
                                                    value={newUser.email}
                                                    onChange={handleInputChange}
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
                                                    name="fullName"
                                                    value={newUser.fullName}
                                                    onChange={handleInputChange}
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
                                                    name="password"
                                                    value={newUser.password}
                                                    onChange={handleInputChange}
                                                    required
                                                    className="form-control-modern"
                                                />
                                            </Form.Group>
                                        </Col>
                                    </Row>
                                </div>
                            </div>

                            {/* Student Information Card */}
                            <div className="session-card mb-4">
                                <div className="card-header-modern">
                                    <div className="header-icon">
                                        <i className="fas fa-graduation-cap"></i>
                                    </div>
                                    <h6 className="mb-0">Thông tin sinh viên</h6>
                                </div>
                                <div className="card-body-modern">
                                    <Row>
                                        <Col md={6}>
                                            <Form.Group className="mb-3">
                                                <Form.Label className="info-label">
                                                    <i className="fas fa-hashtag me-2"></i>
                                                    Mã SV
                                                </Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    name="student_id"
                                                    value={newUser.student_id}
                                                    onChange={handleInputChange}
                                                    required
                                                    className="form-control-modern"
                                                />
                                            </Form.Group>
                                        </Col>
                                        <Col md={6}>
                                            <Form.Group className="mb-3">
                                                <Form.Label className="info-label">
                                                    <i className="fas fa-users me-2"></i>
                                                    Lớp
                                                </Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    name="class_name"
                                                    value={newUser.class_name}
                                                    onChange={handleInputChange}
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
                                                    <i className="fas fa-university me-2"></i>
                                                    Khoa
                                                </Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    name="faculty_name"
                                                    value={newUser.faculty_name}
                                                    onChange={handleInputChange}
                                                    required
                                                    className="form-control-modern"
                                                />
                                            </Form.Group>
                                        </Col>
                                        <Col md={6}>
                                            <Form.Group className="mb-3">
                                                <Form.Label className="info-label">
                                                    <i className="fas fa-book me-2"></i>
                                                    Ngành
                                                </Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    name="major_name"
                                                    value={newUser.major_name}
                                                    onChange={handleInputChange}
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
                                                    <i className="fas fa-birthday-cake me-2"></i>
                                                    Ngày sinh
                                                </Form.Label>
                                                <Form.Control
                                                    type="date"
                                                    name="birth_date"
                                                    value={newUser.birth_date}
                                                    onChange={handleInputChange}
                                                    required
                                                    className="form-control-modern"
                                                />
                                            </Form.Group>
                                        </Col>
                                        <Col md={6}>
                                            <Form.Group className="mb-3">
                                                <Form.Label className="info-label">
                                                    <i className="fas fa-venus-mars me-2"></i>
                                                    Giới tính
                                                </Form.Label>
                                                <Form.Select
                                                    name="gender"
                                                    value={newUser.gender}
                                                    onChange={handleInputChange}
                                                    required
                                                    className="form-control-modern"
                                                >
                                                    <option value="">Chọn giới tính</option>
                                                    <option value="0">Nam</option>
                                                    <option value="1">Nữ</option>
                                                    <option value="2">Khác</option>
                                                </Form.Select>
                                            </Form.Group>
                                        </Col>
                                    </Row>

                                    <Form.Group className="mb-3">
                                        <Form.Label className="info-label">
                                            <i className="fas fa-map-marker-alt me-2"></i>
                                            Địa chỉ
                                        </Form.Label>
                                        <Form.Control
                                            type="text"
                                            name="address"
                                            value={newUser.address}
                                            onChange={handleInputChange}
                                            required
                                            className="form-control-modern"
                                        />
                                    </Form.Group>

                                    <Row>
                                        <Col md={6}>
                                            <Form.Group className="mb-3">
                                                <Form.Label className="info-label">
                                                    <i className="fas fa-id-card-alt me-2"></i>
                                                    CMND/CCCD
                                                </Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    name="id_number"
                                                    value={newUser.id_number}
                                                    onChange={handleInputChange}
                                                    required
                                                    className="form-control-modern"
                                                />
                                            </Form.Group>
                                        </Col>
                                        <Col md={6}>
                                            <Form.Group className="mb-3">
                                                <Form.Label className="info-label">
                                                    <i className="fas fa-phone me-2"></i>
                                                    Số điện thoại
                                                </Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    name="phone"
                                                    value={newUser.phone}
                                                    onChange={handleInputChange}
                                                    placeholder="Nhập số điện thoại"
                                                    className="form-control-modern"
                                                />
                                            </Form.Group>
                                        </Col>
                                    </Row>

                                    <Form.Group className="mb-3">
                                        <Form.Label className="info-label">
                                            <i className="fas fa-info-circle me-2"></i>
                                            Tình trạng
                                        </Form.Label>
                                        <Form.Select
                                            name="status"
                                            value={newUser.status}
                                            onChange={handleInputChange}
                                            required
                                            className="form-control-modern"
                                        >
                                            <option value="Đang học">Đang học</option>
                                            <option value="Nghỉ học">Nghỉ học</option>
                                            <option value="Tạm dừng">Tạm dừng</option>
                                            <option value="Đã tốt nghiệp">Đã tốt nghiệp</option>
                                        </Form.Select>
                                    </Form.Group>
                                </div>
                            </div>
                        </Form>
                    </div>
                </Modal.Body>
                <Modal.Footer className="student-detail-footer">
                    <Button variant="outline-secondary" onClick={() => setShowAddModal(false)} className="btn-cancel" disabled={loading}>
                        <i className="fas fa-times me-2"></i>
                        Hủy
                    </Button>
                    <Button
                        variant="primary"
                        type="button"
                        onClick={handleAddUser}
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
                                <i className="fas fa-plus me-2"></i>
                                Thêm
                            </>
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Import Modal */}
            <Modal show={showImportModal} onHide={() => setShowImportModal(false)} size="lg" className="student-detail-modal">
                <Modal.Header closeButton className="student-detail-header">
                    <Modal.Title className="student-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-file-import"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Nhập danh sách sinh viên từ Excel</h4>
                            <p className="mb-0 student-subtitle">Import dữ liệu sinh viên hàng loạt</p>
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
                                    <Form.Group className="mb-4">
                                        <Form.Label className="info-label">
                                            <i className="fas fa-upload me-2"></i>
                                            File Excel
                                        </Form.Label>
                                        <Form.Control
                                            type="file"
                                            accept=".xlsx, .xls"
                                            onChange={handleFileChange}
                                            className="form-control-modern"
                                        />
                                        <Form.Text className="text-muted mt-2">
                                            <i className="fas fa-info-circle me-1"></i>
                                            File Excel phải có các cột chính: Mã SV, Họ và tên, Email, password
                                        </Form.Text>
                                    </Form.Group>

                                    <div className="d-flex justify-content-between align-items-center">
                                        <Button
                                            variant="outline-primary"
                                            onClick={() => {
                                                showAlert('Tính năng tải mẫu Excel sẽ được thêm sau', 'info');
                                            }}
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
                                                onClick={handleImportStudents}
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
                                    </div>
                                </Form>
                            </div>
                        </div>
                    </div>
                </Modal.Body>
            </Modal>

            {/* Bulk Email Modal */}
            <Modal show={showBulkEmailModal} onHide={() => {
                setShowBulkEmailModal(false);
                setSelectedClassForEmail('');
                setSelectedFacultyForEmail('');
                setSelectedMajorForEmail('');
            }} size="xl" className="student-detail-modal">
                <Modal.Header closeButton className="student-detail-header">
                    <Modal.Title className="student-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-envelope-open-text"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Gửi thông tin đăng nhập hàng loạt</h4>
                            <p className="mb-0 student-subtitle">Gửi email thông tin đăng nhập cho nhiều sinh viên</p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="student-detail-body">
                    <div className="student-detail-container">
                        <Tabs
                            activeKey={bulkEmailTab}
                            onSelect={(key) => setBulkEmailTab(key)}
                            id="bulk-email-tabs"
                            className="mb-4 custom-tabs"
                        >
                            <Tab eventKey="all" title={
                                <span className="tab-title">
                                    <i className="fas fa-users"></i>
                                    Tất cả sinh viên
                                </span>
                            }>
                                <div className="session-card">
                                    <div className="card-header-modern">
                                        <div className="header-icon">
                                            <i className="fas fa-globe"></i>
                                        </div>
                                        <h6 className="mb-0">Gửi đến tất cả sinh viên</h6>
                                    </div>
                                    <div className="card-body-modern">
                                        <div className="info-item">
                                            <div className="info-label">
                                                <i className="fas fa-info-circle me-2"></i>
                                                Mô tả
                                            </div>
                                            <div className="info-value">
                                                Gửi thông tin đăng nhập đến tất cả sinh viên có mật khẩu trong hệ thống.
                                            </div>
                                        </div>
                                        <div className="info-item">
                                            <div className="info-label">
                                                <i className="fas fa-hashtag me-2"></i>
                                                Số lượng email
                                            </div>
                                            <div className="info-value">
                                                <Badge bg="primary" className="fs-6">
                                                    {allStudents.filter(s => s.display_password).length} sinh viên
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Tab>

                            <Tab eventKey="filter" title={
                                <span className="tab-title">
                                    <i className="fas fa-filter"></i>
                                    Lọc theo tiêu chí
                                </span>
                            }>
                                <div className="session-card">
                                    <div className="card-header-modern">
                                        <div className="header-icon">
                                            <i className="fas fa-search"></i>
                                        </div>
                                        <h6 className="mb-0">Lọc theo lớp/khoa/ngành</h6>
                                    </div>
                                    <div className="card-body-modern">
                                        <Row>
                                            <Col md={4}>
                                                <Form.Group className="mb-3">
                                                    <Form.Label className="info-label">
                                                        <i className="fas fa-users me-2"></i>
                                                        Chọn lớp
                                                    </Form.Label>
                                                    <Form.Select
                                                        value={selectedClassForEmail}
                                                        onChange={(e) => setSelectedClassForEmail(e.target.value)}
                                                        className="form-control-modern"
                                                    >
                                                        <option value="">-- Chọn lớp --</option>
                                                        {uniqueClasses.map((className, index) => (
                                                            <option key={index} value={className}>
                                                                {className} ({classStudentCounts[className] || 0} SV)
                                                            </option>
                                                        ))}
                                                    </Form.Select>
                                                </Form.Group>
                                            </Col>

                                            <Col md={4}>
                                                <Form.Group className="mb-3">
                                                    <Form.Label className="info-label">
                                                        <i className="fas fa-university me-2"></i>
                                                        Chọn khoa
                                                    </Form.Label>
                                                    <Form.Select
                                                        value={selectedFacultyForEmail}
                                                        onChange={(e) => setSelectedFacultyForEmail(e.target.value)}
                                                        className="form-control-modern"
                                                    >
                                                        <option value="">-- Chọn khoa --</option>
                                                        {uniqueFaculties.map((facultyName, index) => (
                                                            <option key={index} value={facultyName}>
                                                                {facultyName} ({facultyStudentCounts[facultyName] || 0} SV)
                                                            </option>
                                                        ))}
                                                    </Form.Select>
                                                </Form.Group>
                                            </Col>

                                            <Col md={4}>
                                                <Form.Group className="mb-3">
                                                    <Form.Label className="info-label">
                                                        <i className="fas fa-book me-2"></i>
                                                        Chọn ngành
                                                    </Form.Label>
                                                    <Form.Select
                                                        value={selectedMajorForEmail}
                                                        onChange={(e) => setSelectedMajorForEmail(e.target.value)}
                                                        className="form-control-modern"
                                                    >
                                                        <option value="">-- Chọn ngành --</option>
                                                        {uniqueMajors.map((majorName, index) => (
                                                            <option key={index} value={majorName}>
                                                                {majorName} ({majorStudentCounts[majorName] || 0} SV)
                                                            </option>
                                                        ))}
                                                    </Form.Select>
                                                </Form.Group>
                                            </Col>
                                        </Row>

                                        {(selectedClassForEmail || selectedFacultyForEmail || selectedMajorForEmail) && (
                                            <div className="session-card mt-3">
                                                <div className="card-header-modern">
                                                    <div className="header-icon">
                                                        <i className="fas fa-list-check"></i>
                                                    </div>
                                                    <h6 className="mb-0">Tóm tắt lựa chọn</h6>
                                                </div>
                                                <div className="card-body-modern">
                                                    <div className="row">
                                                        <div className="col-md-6">
                                                            <div className="info-item">
                                                                <div className="info-label">
                                                                    <i className="fas fa-list me-2"></i>
                                                                    Tiêu chí đã chọn
                                                                </div>
                                                                <div className="info-value">
                                                                    <ul className="mb-0">
                                                                        {selectedClassForEmail && <li><strong>Lớp:</strong> {selectedClassForEmail}</li>}
                                                                        {selectedFacultyForEmail && <li><strong>Khoa:</strong> {selectedFacultyForEmail}</li>}
                                                                        {selectedMajorForEmail && <li><strong>Ngành:</strong> {selectedMajorForEmail}</li>}
                                                                    </ul>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="col-md-6">
                                                            <div className="info-item">
                                                                <div className="info-label">
                                                                    <i className="fas fa-hashtag me-2"></i>
                                                                    Số lượng sinh viên
                                                                </div>
                                                                <div className="info-value">
                                                                    <Badge bg="success" className="fs-6">
                                                                        {filteredStudentsForEmail.length} sinh viên
                                                                    </Badge>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Danh sách sinh viên chi tiết */}
                                                    <div className="session-card mt-3">
                                                        <div className="card-header-modern">
                                                            <div className="header-icon">
                                                                <i className="fas fa-users"></i>
                                                            </div>
                                                            <h6 className="mb-0">Danh sách sinh viên sẽ nhận email</h6>
                                                        </div>
                                                        <div className="card-body-modern">
                                                            {(() => {
                                                                if (loadingFilteredStudents) {
                                                                    return (
                                                                        <div className="text-center text-muted py-4">
                                                                            <Spinner animation="border" size="sm" className="me-2" />
                                                                            <span>Đang tải danh sách sinh viên...</span>
                                                                        </div>
                                                                    );
                                                                }

                                                                if (filteredStudentsForEmail.length === 0) {
                                                                    return (
                                                                        <div className="text-center text-muted py-4">
                                                                            <i className="fas fa-users fa-3x mb-3"></i>
                                                                            <p className="mb-0">Không có sinh viên nào phù hợp với tiêu chí đã chọn</p>
                                                                        </div>
                                                                    );
                                                                }

                                                                const handleSelectStudent = (studentId) => {
                                                                    setSelectedStudentsForEmail(prev => {
                                                                        if (prev.includes(studentId)) {
                                                                            return prev.filter(id => id !== studentId);
                                                                        } else {
                                                                            return [...prev, studentId];
                                                                        }
                                                                    });
                                                                };

                                                                const handleSelectAll = () => {
                                                                    if (selectedStudentsForEmail.length === filteredStudentsForEmail.length) {
                                                                        setSelectedStudentsForEmail([]);
                                                                    } else {
                                                                        setSelectedStudentsForEmail(filteredStudentsForEmail.map(s => s.id));
                                                                    }
                                                                };

                                                                const isAllSelected = filteredStudentsForEmail.length > 0 && selectedStudentsForEmail.length === filteredStudentsForEmail.length;
                                                                const isIndeterminate = selectedStudentsForEmail.length > 0 && selectedStudentsForEmail.length < filteredStudentsForEmail.length;

                                                                return (
                                                                    <div
                                                                        className="table-responsive"
                                                                        style={{
                                                                            maxHeight: filteredStudentsForEmail.length > 10 ? '400px' : 'auto',
                                                                            overflowY: filteredStudentsForEmail.length > 10 ? 'auto' : 'visible'
                                                                        }}
                                                                    >
                                                                        <table className="table table-hover mb-0">
                                                                            <thead className="table-light sticky-top">
                                                                                <tr>
                                                                                    <th style={{ width: '50px' }}>
                                                                                        <Form.Check
                                                                                            type="checkbox"
                                                                                            checked={isAllSelected}
                                                                                            ref={input => {
                                                                                                if (input) input.indeterminate = isIndeterminate;
                                                                                            }}
                                                                                            onChange={handleSelectAll}
                                                                                        />
                                                                                    </th>
                                                                                    <th>STT</th>
                                                                                    <th>Email</th>
                                                                                    <th>Họ tên</th>
                                                                                    <th>Mã SV</th>
                                                                                    <th>Lớp</th>
                                                                                    <th>Khoa</th>
                                                                                    <th>Tình trạng</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                {filteredStudentsForEmail.map((student, index) => {
                                                                                    const getStatusBadgeColor = (status) => {
                                                                                        if (!status) return 'secondary';
                                                                                        const statusLower = status.toLowerCase();
                                                                                        if (statusLower === 'đang học') return 'success';
                                                                                        if (statusLower === 'nghỉ học') return 'danger';
                                                                                        if (statusLower === 'tạm dừng') return 'warning';
                                                                                        if (statusLower === 'đã tốt nghiệp' || statusLower === 'tốt nghiệp') return 'info';
                                                                                        return 'secondary';
                                                                                    };

                                                                                    return (
                                                                                        <tr
                                                                                            key={student.id}
                                                                                            onClick={() => handleSelectStudent(student.id)}
                                                                                            style={{ cursor: 'pointer' }}
                                                                                        >
                                                                                            <td onClick={(e) => e.stopPropagation()}>
                                                                                                <Form.Check
                                                                                                    type="checkbox"
                                                                                                    checked={selectedStudentsForEmail.includes(student.id)}
                                                                                                    onChange={() => handleSelectStudent(student.id)}
                                                                                                />
                                                                                            </td>
                                                                                            <td className="text-muted">{index + 1}</td>
                                                                                            <td>
                                                                                                <small className="text-muted">{student.email}</small>
                                                                                            </td>
                                                                                            <td>
                                                                                                <div className="fw-medium">{student.full_name}</div>
                                                                                            </td>
                                                                                            <td>
                                                                                                <span className="badge bg-secondary">{student.student_id}</span>
                                                                                            </td>
                                                                                            <td>
                                                                                                <span className="badge bg-info">{student.class_name}</span>
                                                                                            </td>
                                                                                            <td>
                                                                                                <span className="badge bg-warning text-dark">{student.faculty_name}</span>
                                                                                            </td>
                                                                                            <td>
                                                                                                <Badge bg={getStatusBadgeColor(student.status)}>
                                                                                                    {student.status || 'Đang học'}
                                                                                                </Badge>
                                                                                            </td>
                                                                                        </tr>
                                                                                    );
                                                                                })}
                                                                            </tbody>
                                                                        </table>
                                                                        {filteredStudentsForEmail.length > 10 && (
                                                                            <div className="text-center mt-2">
                                                                                <small className="text-muted">
                                                                                    <i className="fas fa-info-circle me-1"></i>
                                                                                    Cuộn để xem tất cả {filteredStudentsForEmail.length} sinh viên
                                                                                </small>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Tab>
                        </Tabs>

                        <Alert variant="warning" className="mb-0">
                            <div className="d-flex align-items-center">
                                <i className="fas fa-exclamation-triangle me-3"></i>
                                <div>
                                    <strong>Lưu ý quan trọng:</strong> Quá trình này có thể mất một chút thời gian. Vui lòng không đóng trình duyệt trong khi đang gửi email.
                                </div>
                            </div>
                        </Alert>
                    </div>
                </Modal.Body>
                <Modal.Footer className="student-detail-footer">
                    <Button 
                        variant="outline-secondary" 
                        onClick={() => {
                            if (!bulkEmailLoading) {
                                setShowBulkEmailModal(false);
                                setSelectedClassForEmail('');
                                setSelectedFacultyForEmail('');
                                setSelectedMajorForEmail('');
                                setSelectedStudentsForEmail([]);
                                setFilteredStudentsForEmail([]);
                                setBulkEmailProgress({
                                    current: 0,
                                    total: 0,
                                    currentEmail: '',
                                    currentName: '',
                                    message: '',
                                    sent: 0,
                                    failed: 0,
                                    errors: [],
                                    isComplete: false
                                });
                            }
                        }} 
                        className="btn-cancel"
                        disabled={bulkEmailLoading}
                    >
                        <i className="fas fa-times me-2"></i>
                        {bulkEmailLoading ? 'Đang gửi...' : 'Hủy'}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleBulkEmailConfirm}
                        disabled={bulkEmailLoading}
                        className="btn-edit"
                    >
                        {bulkEmailLoading ? (
                            <>
                                <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                                Đang gửi...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-paper-plane me-2"></i>
                                Gửi email hàng loạt
                            </>
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Bulk Email Confirmation Modal */}
            <Modal show={showBulkEmailConfirmModal} onHide={() => setShowBulkEmailConfirmModal(false)} size="md" className="student-detail-modal">
                <Modal.Header closeButton className="student-detail-header">
                    <Modal.Title className="student-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-exclamation-triangle text-warning"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Xác nhận gửi email</h4>
                            <p className="mb-0 student-subtitle">Bạn có chắc chắn muốn gửi thông tin đăng nhập hàng loạt?</p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="student-detail-body">
                    <div className="student-detail-container">
                        <Alert variant="warning" className="mb-4">
                            <div className="d-flex align-items-center">
                                <i className="fas fa-exclamation-triangle me-2"></i>
                                <div>
                                    <strong>Lưu ý:</strong> Hành động này sẽ gửi email thông tin đăng nhập cho nhiều sinh viên.
                                    Vui lòng đảm bảo bạn đã kiểm tra kỹ danh sách người nhận trước khi tiếp tục.
                                </div>
                            </div>
                        </Alert>
                        <div className="session-card">
                            <div className="card-header-modern">
                                <div className="header-icon">
                                    <i className="fas fa-info-circle"></i>
                                </div>
                                <h6 className="mb-0">Thông tin gửi email</h6>
                            </div>
                            <div className="card-body-modern">
                                <div className="info-item">
                                    <div className="info-label">
                                        <i className="fas fa-users me-2"></i>
                                        Số lượng email sẽ gửi
                                    </div>
                                    <div className="info-value">
                                        <Badge bg="primary" className="fs-6">
                                            {(() => {
                                                let filteredStudents;
                                                if (bulkEmailTab === 'all') {
                                                    filteredStudents = allStudents.filter(s => s.display_password);
                                                } else {
                                                    filteredStudents = filteredStudentsForEmail.filter(s => s.display_password);
                                                    if (selectedStudentsForEmail.length > 0) {
                                                        filteredStudents = filteredStudents.filter(s => selectedStudentsForEmail.includes(s.id));
                                                    }
                                                }
                                                return filteredStudents.length;
                                            })()} sinh viên
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </Modal.Body>
                <Modal.Footer className="student-detail-footer">
                    <Button variant="outline-secondary" onClick={() => setShowBulkEmailConfirmModal(false)} className="btn-cancel">
                        <i className="fas fa-times me-2"></i>
                        Hủy
                    </Button>
                    <Button
                        variant="primary"
                        onClick={sendBulkCredentialsEmail}
                        disabled={bulkEmailLoading}
                        className="btn-edit"
                    >
                        {bulkEmailLoading ? (
                            <>
                                <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                                Đang gửi...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-paper-plane me-2"></i>
                                Xác nhận gửi email
                            </>
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Bulk Email Progress Modal */}
            <Modal 
                show={showBulkEmailProgressModal} 
                onHide={() => {
                    if (bulkEmailProgress.isComplete) {
                        setShowBulkEmailProgressModal(false);
                        setBulkEmailProgress({
                            current: 0,
                            total: 0,
                            currentEmail: '',
                            currentName: '',
                            message: '',
                            sent: 0,
                            failed: 0,
                            errors: [],
                            isComplete: false
                        });
                    }
                }} 
                size="lg" 
                className="student-detail-modal"
                backdrop={bulkEmailProgress.isComplete ? true : 'static'}
                keyboard={bulkEmailProgress.isComplete}
            >
                <Modal.Body className="student-detail-body">
                    <div className="student-detail-container">
                        <div className="session-card">
                            <div className="card-header-modern">
                                <div className="header-icon">
                                    <i className={`fas ${bulkEmailProgress.isComplete ? 'fa-check-circle text-success' : 'fa-spinner fa-spin'}`}></i>
                                </div>
                                <h6 className="mb-0">Tiến độ gửi email</h6>
                            </div>
                            <div className="card-body-modern">
                                <div className="mb-3">
                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                        <span className="text-muted">
                                            <i className="fas fa-envelope me-2"></i>
                                            {bulkEmailProgress.message || 'Đang xử lý...'}
                                        </span>
                                        <Badge bg={bulkEmailProgress.isComplete ? 'success' : 'primary'} className="fs-6">
                                            {bulkEmailProgress.current}/{bulkEmailProgress.total}
                                        </Badge>
                                    </div>
                                    {bulkEmailProgress.total > 0 && (
                                        <ProgressBar 
                                            now={(bulkEmailProgress.current / bulkEmailProgress.total) * 100} 
                                            label={`${Math.round((bulkEmailProgress.current / bulkEmailProgress.total) * 100)}%`}
                                            variant={bulkEmailProgress.isComplete ? 'success' : 'primary'}
                                            animated={!bulkEmailProgress.isComplete}
                                            className="mb-2"
                                        />
                                    )}
                                </div>
                                
                                {bulkEmailProgress.currentEmail && (
                                    <div className="info-item mb-2">
                                        <div className="info-label">
                                            <i className="fas fa-user me-2"></i>
                                            {bulkEmailProgress.isComplete ? 'Email cuối cùng' : 'Đang gửi đến'}
                                        </div>
                                        <div className="info-value">
                                            <div className="fw-medium">{bulkEmailProgress.currentName || 'N/A'}</div>
                                            <small className="text-muted">{bulkEmailProgress.currentEmail}</small>
                                        </div>
                                    </div>
                                )}
                                
                                <div className="row mt-3">
                                    <div className="col-md-6">
                                        <div className="info-item">
                                            <div className="info-label">
                                                <i className="fas fa-check-circle text-success me-2"></i>
                                                Đã gửi thành công
                                            </div>
                                            <div className="info-value">
                                                <Badge bg="success" className="fs-6">
                                                    {bulkEmailProgress.sent}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-md-6">
                                        <div className="info-item">
                                            <div className="info-label">
                                                <i className="fas fa-times-circle text-danger me-2"></i>
                                                Gửi thất bại
                                            </div>
                                            <div className="info-value">
                                                <Badge bg="danger" className="fs-6">
                                                    {bulkEmailProgress.failed}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {bulkEmailProgress.errors && bulkEmailProgress.errors.length > 0 && (
                                    <Alert variant="danger" className="mt-3 mb-0">
                                        <div className="d-flex align-items-center mb-2">
                                            <i className="fas fa-exclamation-triangle me-2"></i>
                                            <strong>Lỗi:</strong>
                                        </div>
                                        <ul className="mb-0" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                                            {bulkEmailProgress.errors.slice(0, 10).map((error, index) => (
                                                <li key={index}><small>{error}</small></li>
                                            ))}
                                            {bulkEmailProgress.errors.length > 10 && (
                                                <li><small className="text-muted">... và {bulkEmailProgress.errors.length - 10} lỗi khác</small></li>
                                            )}
                                        </ul>
                                    </Alert>
                                )}
                            </div>
                        </div>
                    </div>
                </Modal.Body>
                <Modal.Footer className="student-detail-footer">
                    {bulkEmailProgress.isComplete ? (
                        <Button 
                            variant="primary" 
                            onClick={() => {
                                setShowBulkEmailProgressModal(false);
                                setBulkEmailProgress({
                                    current: 0,
                                    total: 0,
                                    currentEmail: '',
                                    currentName: '',
                                    message: '',
                                    sent: 0,
                                    failed: 0,
                                    errors: [],
                                    isComplete: false
                                });
                            }}
                            className="btn-edit"
                        >
                            <i className="fas fa-check me-2"></i>
                            Đóng
                        </Button>
                    ) : (
                        <div className="text-muted">
                            <i className="fas fa-info-circle me-2"></i>
                            Đang xử lý, vui lòng đợi...
                        </div>
                    )}
                </Modal.Footer>
            </Modal>

            {/* Student Detail Modal */}
            <Modal
                show={showDetailModal}
                onHide={() => setShowDetailModal(false)}
                size="xl"
                className="student-detail-modal"
            >
                <Modal.Header closeButton className="student-detail-header">
                    <Modal.Title className="student-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-user-graduate"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">{selectedStudent?.full_name || 'Sinh viên'}</h4>
                            <p className="mb-0 student-subtitle">{selectedStudent?.student_id || 'Mã sinh viên'}</p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="student-detail-body">
                    {selectedStudent && (
                        <div className="student-detail-container">
                            <div className="row">
                                <div className="col-md-6">
                                    <div className="session-card">
                                        <div className="card-header-modern">
                                            <div className="header-icon">
                                                <i className="fas fa-id-card"></i>
                                            </div>
                                            <h6 className="mb-0">Thông tin cá nhân</h6>
                                        </div>
                                        <div className="card-body-modern">
                                            <div className="info-item">
                                                <div className="info-label">
                                                    <i className="fas fa-hashtag me-2"></i>
                                                    Mã sinh viên
                                                </div>
                                                <div className="info-value">{selectedStudent.student_id || 'Chưa có'}</div>
                                            </div>
                                            <div className="info-item">
                                                <div className="info-label">
                                                    <i className="fas fa-envelope me-2"></i>
                                                    Email
                                                </div>
                                                <div className="info-value">{selectedStudent.email || 'Chưa có'}</div>
                                            </div>
                                            <div className="info-item">
                                                <div className="info-label">
                                                    <i className="fas fa-key me-2"></i>
                                                    Password
                                                </div>
                                                <div className="info-value">
                                                    {selectedStudent.display_password ? (
                                                        <div className="password-container">
                                                            <span className="password-display">
                                                                {visiblePasswords[selectedStudent.id] ? selectedStudent.display_password : "••••••••"}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                className="btn-toggle-password"
                                                                onClick={() => togglePasswordVisibility(selectedStudent.id)}
                                                                title={visiblePasswords[selectedStudent.id] ? "Ẩn mật khẩu" : "Hiển thị mật khẩu"}
                                                            >
                                                                <i className={`fas ${visiblePasswords[selectedStudent.id] ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        'Chưa có'
                                                    )}
                                                </div>
                                            </div>
                                            <div className="info-item">
                                                <div className="info-label">
                                                    <i className="fas fa-phone me-2"></i>
                                                    Số điện thoại
                                                </div>
                                                <div className="info-value">{selectedStudent.phone || 'Chưa có'}</div>
                                            </div>
                                            <div className="info-item">
                                                <div className="info-label">
                                                    <i className="fas fa-birthday-cake me-2"></i>
                                                    Ngày sinh
                                                </div>
                                                <div className="info-value">
                                                    {selectedStudent.birth_date ? new Date(selectedStudent.birth_date).toLocaleDateString('vi-VN') : 'Chưa có'}
                                                </div>
                                            </div>
                                            <div className="info-item">
                                                <div className="info-label">
                                                    <i className="fas fa-venus-mars me-2"></i>
                                                    Giới tính
                                                </div>
                                                <div className="info-value">
                                                    {selectedStudent.gender === null || selectedStudent.gender === undefined ? 'Nam' :
                                                        selectedStudent.gender === 'male' ? 'Nữ' :
                                                            selectedStudent.gender === 'female' ? 'Nữ' :
                                                                selectedStudent.gender === 'other' ? 'Khác' : 'Chưa có'}
                                                </div>
                                            </div>
                                            <div className="info-item">
                                                <div className="info-label">
                                                    <i className="fas fa-id-card-alt me-2"></i>
                                                    CMND/CCCD
                                                </div>
                                                <div className="info-value">{selectedStudent.id_number || 'Chưa có'}</div>
                                            </div>
                                            <div className="info-item">
                                                <div className="info-label">
                                                    <i className="fas fa-map-marker-alt me-2"></i>
                                                    Địa chỉ
                                                </div>
                                                <div className="info-value">{selectedStudent.address || 'Chưa có'}</div>
                                            </div>
                                            <div className="info-item">
                                                <div className="info-label">
                                                    <i className="fas fa-info-circle me-2"></i>
                                                    Tình trạng
                                                </div>
                                                <div className="info-value">
                                                    <Badge bg={selectedStudent.status === 'Đang học' ? 'success' :
                                                        selectedStudent.status === 'Nghỉ học' ? 'danger' :
                                                            selectedStudent.status === 'Tạm dừng' ? 'warning' : 'secondary'}>
                                                        {selectedStudent.status || 'Đang học'}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="col-md-6">
                                    <div className="session-card">
                                        <div className="card-header-modern">
                                            <div className="header-icon">
                                                <i className="fas fa-graduation-cap"></i>
                                            </div>
                                            <h6 className="mb-0">Thông tin học tập</h6>
                                        </div>
                                        <div className="card-body-modern">
                                            <div className="info-item">
                                                <div className="info-label">
                                                    <i className="fas fa-users me-2"></i>
                                                    Lớp học
                                                </div>
                                                <div className="info-value">{selectedStudent.class_name || 'Chưa có'}</div>
                                            </div>
                                            <div className="info-item">
                                                <div className="info-label">
                                                    <i className="fas fa-university me-2"></i>
                                                    Khoa
                                                </div>
                                                <div className="info-value">{selectedStudent.faculty_name || 'Chưa có'}</div>
                                            </div>
                                            <div className="info-item">
                                                <div className="info-label">
                                                    <i className="fas fa-book me-2"></i>
                                                    Chuyên ngành
                                                </div>
                                                <div className="info-value">{selectedStudent.major_name || 'Chưa có'}</div>
                                            </div>
                                            <div className="info-item">
                                                <div className="info-label">
                                                    <i className="fas fa-calendar-plus me-2"></i>
                                                    Ngày tạo tài khoản
                                                </div>
                                                <div className="info-value">
                                                    {selectedStudent.created_at ? new Date(selectedStudent.created_at).toLocaleDateString('vi-VN') : 'Chưa có'}
                                                </div>
                                            </div>
                                            <div className="info-item">
                                                <div className="info-label">
                                                    <i className="fas fa-sign-in-alt me-2"></i>
                                                    Lần đăng nhập cuối
                                                </div>
                                                <div className="info-value">
                                                    {selectedStudent.last_login ? new Date(selectedStudent.last_login).toLocaleString('vi-VN') : 'Chưa đăng nhập'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer className="student-detail-footer">
                    <div className="d-flex justify-content-between w-100">
                        <div className="d-flex gap-2">
                            <Button
                                variant="primary"
                                onClick={() => {
                                    setShowDetailModal(false);
                                    handleEditUser(selectedStudent);
                                }}
                                className="btn-edit"
                            >
                                <i className="fas fa-edit me-2"></i>
                                Chỉnh sửa
                            </Button>

                            <Button
                                variant="outline-primary"
                                onClick={() => {
                                    setShowDetailModal(false);
                                    setUserToDelete(selectedStudent);
                                    setShowDeleteModal(true);
                                }}
                                className="btn-delete"
                            >
                                <i className="fas fa-trash me-2"></i>
                                Xóa
                            </Button>

                            <Button
                                variant="outline-success"
                                onClick={() => {
                                    setShowDetailModal(false);
                                    handleSendCredentials(selectedStudent);
                                }}
                                disabled={!selectedStudent?.display_password}
                                className="btn-send-credentials"
                            >
                                <i className="fas fa-envelope me-2"></i>
                                Gửi thông tin đăng nhập
                            </Button>

                            {!selectedStudent?.approved && (
                                <Button
                                    variant="outline-info"
                                    onClick={() => {
                                        setShowDetailModal(false);
                                        handleApproveUser(selectedStudent.id);
                                    }}
                                    className="btn-approve"
                                >
                                    <i className="fas fa-check me-2"></i>
                                    Duyệt
                                </Button>
                            )}
                        </div>

                        <Button variant="outline-secondary" onClick={() => setShowDetailModal(false)} className="btn-cancel">
                            <i className="fas fa-times me-2"></i>
                            Đóng
                        </Button>
                    </div>
                </Modal.Footer>
            </Modal>

            {/* Edit User Modal */}
            <Modal show={showEditModal} onHide={() => setShowEditModal(false)} size="xl" className="student-detail-modal">
                <Modal.Header closeButton className="student-detail-header">
                    <Modal.Title className="student-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-user-edit"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Chỉnh sửa sinh viên</h4>
                            <p className="mb-0 student-subtitle">Cập nhật thông tin sinh viên</p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="student-detail-body">
                    <div className="student-detail-container">
                        <Form onSubmit={handleUpdateUser}>
                            {/* Basic Information Card */}
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
                                                    name="username"
                                                    value={editFormData.username}
                                                    onChange={handleEditInputChange}
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
                                                    name="email"
                                                    value={editFormData.email}
                                                    onChange={handleEditInputChange}
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
                                                    name="fullName"
                                                    value={editFormData.fullName}
                                                    onChange={handleEditInputChange}
                                                    required
                                                    className="form-control-modern"
                                                />
                                            </Form.Group>
                                        </Col>
                                        <Col md={6}>
                                            <Form.Group className="mb-3">
                                                <Form.Label className="info-label">
                                                    <i className="fas fa-shield-alt me-2"></i>
                                                    Vai trò
                                                </Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    value="Sinh viên"
                                                    disabled
                                                    className="form-control-modern"
                                                />
                                            </Form.Group>
                                        </Col>
                                    </Row>

                                    <Form.Group className="mb-3">
                                        <Form.Check
                                            type="checkbox"
                                            label="Đổi mật khẩu"
                                            checked={showPasswordField}
                                            onChange={() => setShowPasswordField(!showPasswordField)}
                                            className="form-check-modern"
                                        />
                                    </Form.Group>

                                    {showPasswordField && (
                                        <Form.Group className="mb-3">
                                            <Form.Label className="info-label">
                                                <i className="fas fa-key me-2"></i>
                                                Mật khẩu mới
                                            </Form.Label>
                                            <Form.Control
                                                type="password"
                                                name="password"
                                                value={editFormData.password}
                                                onChange={handleEditInputChange}
                                                required={showPasswordField}
                                                className="form-control-modern"
                                            />
                                        </Form.Group>
                                    )}
                                </div>
                            </div>

                            {/* Student Information Card */}
                            <div className="session-card mb-4">
                                <div className="card-header-modern">
                                    <div className="header-icon">
                                        <i className="fas fa-graduation-cap"></i>
                                    </div>
                                    <h6 className="mb-0">Thông tin sinh viên</h6>
                                </div>
                                <div className="card-body-modern">
                                    <Row>
                                        <Col md={6}>
                                            <Form.Group className="mb-3">
                                                <Form.Label className="info-label">
                                                    <i className="fas fa-hashtag me-2"></i>
                                                    Mã SV
                                                </Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    name="student_id"
                                                    value={editFormData.student_id}
                                                    onChange={handleEditInputChange}
                                                    required
                                                    className="form-control-modern"
                                                />
                                            </Form.Group>
                                        </Col>
                                        <Col md={6}>
                                            <Form.Group className="mb-3">
                                                <Form.Label className="info-label">
                                                    <i className="fas fa-users me-2"></i>
                                                    Lớp
                                                </Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    name="class_name"
                                                    value={editFormData.class_name}
                                                    onChange={handleEditInputChange}
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
                                                    <i className="fas fa-university me-2"></i>
                                                    Khoa
                                                </Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    name="faculty_name"
                                                    value={editFormData.faculty_name}
                                                    onChange={handleEditInputChange}
                                                    required
                                                    className="form-control-modern"
                                                />
                                            </Form.Group>
                                        </Col>
                                        <Col md={6}>
                                            <Form.Group className="mb-3">
                                                <Form.Label className="info-label">
                                                    <i className="fas fa-book me-2"></i>
                                                    Ngành
                                                </Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    name="major_name"
                                                    value={editFormData.major_name}
                                                    onChange={handleEditInputChange}
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
                                                    <i className="fas fa-birthday-cake me-2"></i>
                                                    Ngày sinh
                                                </Form.Label>
                                                <Form.Control
                                                    type="date"
                                                    name="birth_date"
                                                    value={editFormData.birth_date}
                                                    onChange={handleEditInputChange}
                                                    required
                                                    className="form-control-modern"
                                                />
                                            </Form.Group>
                                        </Col>
                                        <Col md={6}>
                                            <Form.Group className="mb-3">
                                                <Form.Label className="info-label">
                                                    <i className="fas fa-venus-mars me-2"></i>
                                                    Giới tính
                                                </Form.Label>
                                                <Form.Select
                                                    name="gender"
                                                    value={editFormData.gender}
                                                    onChange={handleEditInputChange}
                                                    required
                                                    className="form-control-modern"
                                                >
                                                    <option value="">Chọn giới tính</option>
                                                    <option value="0">Nam</option>
                                                    <option value="1">Nữ</option>
                                                    <option value="2">Khác</option>
                                                </Form.Select>
                                            </Form.Group>
                                        </Col>
                                    </Row>

                                    <Form.Group className="mb-3">
                                        <Form.Label className="info-label">
                                            <i className="fas fa-map-marker-alt me-2"></i>
                                            Địa chỉ
                                        </Form.Label>
                                        <Form.Control
                                            type="text"
                                            name="address"
                                            value={editFormData.address}
                                            onChange={handleEditInputChange}
                                            required
                                            className="form-control-modern"
                                        />
                                    </Form.Group>

                                    <Row>
                                        <Col md={6}>
                                            <Form.Group className="mb-3">
                                                <Form.Label className="info-label">
                                                    <i className="fas fa-id-card-alt me-2"></i>
                                                    CMND/CCCD
                                                </Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    name="id_number"
                                                    value={editFormData.id_number}
                                                    onChange={handleEditInputChange}
                                                    required
                                                    className="form-control-modern"
                                                />
                                            </Form.Group>
                                        </Col>
                                        <Col md={6}>
                                            <Form.Group className="mb-3">
                                                <Form.Label className="info-label">
                                                    <i className="fas fa-phone me-2"></i>
                                                    Số điện thoại
                                                </Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    name="phone"
                                                    value={editFormData.phone}
                                                    onChange={handleEditInputChange}
                                                    placeholder="Nhập số điện thoại"
                                                    className="form-control-modern"
                                                />
                                            </Form.Group>
                                        </Col>
                                    </Row>

                                    <Form.Group className="mb-3">
                                        <Form.Label className="info-label">
                                            <i className="fas fa-info-circle me-2"></i>
                                            Tình trạng
                                        </Form.Label>
                                        <Form.Select
                                            name="status"
                                            value={editFormData.status}
                                            onChange={handleEditInputChange}
                                            required
                                            className="form-control-modern"
                                        >
                                            <option value="Đang học">Đang học</option>
                                            <option value="Nghỉ học">Nghỉ học</option>
                                            <option value="Tạm dừng">Tạm dừng</option>
                                            <option value="Đã tốt nghiệp">Đã tốt nghiệp</option>
                                        </Form.Select>
                                    </Form.Group>
                                </div>
                            </div>
                        </Form>
                    </div>
                </Modal.Body>
                <Modal.Footer className="student-detail-footer">
                    <Button variant="outline-secondary" onClick={() => setShowEditModal(false)} className="btn-cancel" disabled={loading}>
                        <i className="fas fa-times me-2"></i>
                        Hủy
                    </Button>
                    <Button
                        variant="primary"
                        type="button"
                        onClick={handleUpdateUser}
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
                                Lưu thay đổi
                            </>
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} size="lg" className="student-detail-modal">
                <Modal.Header closeButton className="student-detail-header">
                    <Modal.Title className="student-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-exclamation-triangle"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Xác nhận xóa</h4>
                            <p className="mb-0 student-subtitle">Xóa sinh viên khỏi hệ thống</p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="student-detail-body">
                    <div className="student-detail-container">
                        {userToDelete && (
                            <div className="session-card">
                                <div className="card-header-modern">
                                    <div className="header-icon">
                                        <i className="fas fa-user-times"></i>
                                    </div>
                                    <h6 className="mb-0">Thông tin sinh viên sẽ bị xóa</h6>
                                </div>
                                <div className="card-body-modern">
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="fas fa-user me-2"></i>
                                            Tên đăng nhập
                                        </div>
                                        <div className="info-value">{userToDelete.username}</div>
                                    </div>
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="fas fa-id-card me-2"></i>
                                            Họ và tên
                                        </div>
                                        <div className="info-value">{userToDelete.full_name || 'Chưa có'}</div>
                                    </div>
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="fas fa-envelope me-2"></i>
                                            Email
                                        </div>
                                        <div className="info-value">{userToDelete.email}</div>
                                    </div>
                                    {userToDelete.student_id && (
                                        <div className="info-item">
                                            <div className="info-label">
                                                <i className="fas fa-hashtag me-2"></i>
                                                Mã sinh viên
                                            </div>
                                            <div className="info-value">{userToDelete.student_id}</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <Alert variant="danger" className="mb-0">
                            <div className="d-flex align-items-center">
                                <i className="fas fa-exclamation-triangle me-3"></i>
                                <div>
                                    <strong>Cảnh báo:</strong> Hành động này không thể hoàn tác. Tất cả dữ liệu liên quan đến sinh viên này sẽ bị xóa vĩnh viễn.
                                </div>
                            </div>
                        </Alert>
                    </div>
                </Modal.Body>
                <Modal.Footer className="student-detail-footer">
                    <Button variant="outline-secondary" onClick={() => setShowDeleteModal(false)} className="btn-cancel">
                        <i className="fas fa-times me-2"></i>
                        Hủy
                    </Button>
                    <Button
                        variant="danger"
                        onClick={handleDeleteUser}
                        disabled={loading}
                        className="btn-delete"
                    >
                        {loading ? (
                            <>
                                <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                                Đang xử lý...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-trash me-2"></i>
                                Xóa sinh viên
                            </>
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Email Confirmation Modal */}
            <Modal show={showEmailModal} onHide={() => setShowEmailModal(false)} size="lg" className="student-detail-modal">
                <Modal.Header closeButton className="student-detail-header">
                    <Modal.Title className="student-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-envelope"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Gửi thông tin đăng nhập</h4>
                            <p className="mb-0 student-subtitle">Xác nhận gửi thông tin đăng nhập cho sinh viên</p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="student-detail-body">
                    <div className="student-detail-container">
                        {emailTarget && (
                            <div className="session-card">
                                <div className="card-header-modern">
                                    <div className="header-icon">
                                        <i className="fas fa-user-check"></i>
                                    </div>
                                    <h6 className="mb-0">Thông tin sinh viên</h6>
                                </div>
                                <div className="card-body-modern">
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="fas fa-user me-2"></i>
                                            Họ và tên
                                        </div>
                                        <div className="info-value">{emailTarget.full_name}</div>
                                    </div>
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="fas fa-envelope me-2"></i>
                                            Email
                                        </div>
                                        <div className="info-value">{emailTarget.email}</div>
                                    </div>
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="fas fa-user me-2"></i>
                                            Tên đăng nhập
                                        </div>
                                        <div className="info-value">{emailTarget.username}</div>
                                    </div>
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="fas fa-key me-2"></i>
                                            Mật khẩu
                                        </div>
                                        <div className="info-value">
                                            <div className="password-container">
                                                <span className="password-display">
                                                    {visiblePasswords[emailTarget.id] ? emailTarget.display_password : "••••••••"}
                                                </span>
                                                <button
                                                    type="button"
                                                    className="btn-toggle-password"
                                                    onClick={() => togglePasswordVisibility(emailTarget.id)}
                                                    title={visiblePasswords[emailTarget.id] ? "Ẩn mật khẩu" : "Hiển thị mật khẩu"}
                                                >
                                                    <i className={`fas ${visiblePasswords[emailTarget.id] ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <Alert variant="info" className="mb-0">
                            <div className="d-flex align-items-center">
                                <i className="fas fa-info-circle me-3"></i>
                                <div>
                                    <strong>Xác nhận:</strong> Bạn có chắc chắn muốn gửi thông tin đăng nhập này đến sinh viên?
                                </div>
                            </div>
                        </Alert>
                    </div>
                </Modal.Body>
                <Modal.Footer className="student-detail-footer">
                    <Button variant="outline-secondary" onClick={() => { setShowEmailModal(false); setShowDetailModal(true); }} className="btn-cancel">
                        <i className="fas fa-arrow-left me-2"></i>
                        Quay lại thông tin sinh viên
                    </Button>
                    <Button
                        variant="primary"
                        onClick={sendCredentialsEmail}
                        disabled={emailLoading}
                        className="btn-edit"
                    >
                        {emailLoading ? (
                            <>
                                <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                                Đang gửi...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-paper-plane me-2"></i>
                                Gửi email
                            </>
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default LMSUserManagement;







