import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Card, Table, Button, Badge, Tabs, Tab, Form, Modal, Spinner, Alert, ProgressBar, Dropdown, InputGroup } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import Pagination from '../../components/Pagination';
import * as XLSX from 'xlsx';
import '../../styles/user.css';
import usePageTitle from '../../hooks/usePageTitle';

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

  /* Dim entire student detail modal when stat detail is open */
  .student-detail-modal.dimmed .modal-content {
    filter: brightness(0.35);
    transition: filter 0.2s ease;
  }

`;

const UserManagement = () => {
  const { showAlert } = useAlert();
    const { api, currentUser } = useAuth();
    // Always start with students tab for better compatibility
    const [activeTab, setActiveTab] = useState('students');
    const [users, setUsers] = useState([]);
    const [students, setStudents] = useState([]);
    const [allStudents, setAllStudents] = useState([]); // Tất cả sinh viên không bị filter
    const [studentGroups, setStudentGroups] = useState([]); // Danh sách nhóm sinh viên
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        totalItems: 0,
        totalPages: 0
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importFile, setImportFile] = useState(null);
    const [importErrors, setImportErrors] = useState([]);
    const [importSuccess, setImportSuccess] = useState('');
    const [importLoading, setImportLoading] = useState(false);
    const [importProgress, setImportProgress] = useState(0);
    const [importTotal, setImportTotal] = useState(0);
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailTarget, setEmailTarget] = useState(null);
    const [emailLoading, setEmailLoading] = useState(false);
    const [showBulkEmailModal, setShowBulkEmailModal] = useState(false);
    const [bulkEmailLoading, setBulkEmailLoading] = useState(false);
    const [showBulkEmailConfirmModal, setShowBulkEmailConfirmModal] = useState(false);
    const [showBulkEmailProgressModal, setShowBulkEmailProgressModal] = useState(false);
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
    const [bulkEmailTab, setBulkEmailTab] = useState('all');
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedFaculty, setSelectedFaculty] = useState('');
    const [selectedMajor, setSelectedMajor] = useState('');
    const [visiblePasswords, setVisiblePasswords] = useState({});
    const [selectedStudentsForEmail, setSelectedStudentsForEmail] = useState([]);
    const [filteredStudentsForEmail, setFilteredStudentsForEmail] = useState([]);
    const [loadingFilteredStudents, setLoadingFilteredStudents] = useState(false);

    // States for MAC policy settings
    const [showMacPolicyModal, setShowMacPolicyModal] = useState(false);
    const [userMacPolicies, setUserMacPolicies] = useState({
        allow_multiple_accounts_per_mac: false,
        allow_multiple_macs_per_account: false
    });
    const [macPolicyLoading, setMacPolicyLoading] = useState(false);
    const [newUser, setNewUser] = useState({
        username: '',
        email: '',
        fullName: '',
        password: '',
        role: activeTab === 'students' ? 'student' : 'staff',
        // Additional fields for students
        student_id: '',
        class_name: '',
        faculty_name: '',
        major_name: '',
        birth_date: '',
        gender: '',
        address: '',
        id_number: '',
        status: '',
        phone: ''
    });
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
    const [statusStudentCounts, setStatusStudentCounts] = useState({});
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [userToEdit, setUserToEdit] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [studentStatsLoading, setStudentStatsLoading] = useState(false);
    const [studentStatsError, setStudentStatsError] = useState('');
    const [statDetailModal, setStatDetailModal] = useState({
        show: false,
        metric: null,
        data: [],
        loading: false,
        error: ''
    });
    const [editFormData, setEditFormData] = useState({
        username: '',
        email: '',
        fullName: '',
        password: '',
        role: '',
        // Additional fields for students
        student_id: '',
        class_name: '',
        faculty_name: '',
        major_name: '',
        birth_date: '',
        gender: '',
        address: '',
        id_number: '',
        status: '',
        phone: ''
    });
    const [showPasswordField, setShowPasswordField] = useState(false);
    const [originalRole, setOriginalRole] = useState('');

    // States for module roles management
    const [showModuleRolesModal, setShowModuleRolesModal] = useState(false);
    const [userModuleRoles, setUserModuleRoles] = useState({});
    const [selectedUserForModuleRoles, setSelectedUserForModuleRoles] = useState(null);

    // States for face management tab
    const [faceUsers, setFaceUsers] = useState([]);
    const [faceUsersLoading, setFaceUsersLoading] = useState(false);
    const [faceUsersPagination, setFaceUsersPagination] = useState({
        page: 1,
        limit: 20,
        totalItems: 0,
        totalPages: 0
    });
    const [faceUsersLastUpdate, setFaceUsersLastUpdate] = useState(null); // Track last update timestamp
    const faceUsersDataRef = useRef(null); // Store current data for comparison
    const [faceSearchTerm, setFaceSearchTerm] = useState('');
    const faceUsersPaginationRef = useRef(faceUsersPagination); // Store current pagination for polling
    const faceSearchTermRef = useRef(faceSearchTerm); // Store current search term for polling
    
    // Face Recognition Settings
    const [faceSettings, setFaceSettings] = useState({
        enable_face_verification: { value: true, description: '' },
        liveness_confidence_threshold: { value: 0.3, description: '' },
        liveness_motion_threshold: { value: 2.0, description: '' },
        liveness_texture_threshold: { value: 50, description: '' },
        eye_blink_ear_threshold: { value: 0.25, description: '' },
        eye_blink_drop_threshold: { value: 0.15, description: '' },
        eye_blink_sudden_drop: { value: 0.08, description: '' },
        mouth_open_mar_threshold: { value: 0.6, description: '' },
        face_match_threshold: { value: 0.65, description: '' },
        duplicate_face_threshold: { value: 0.75, description: '' }
    });
    const [showFaceSettingsModal, setShowFaceSettingsModal] = useState(false);
    const [faceSettingsLoading, setFaceSettingsLoading] = useState(false);
    const [faceSettingsTab, setFaceSettingsTab] = useState('general');
    
    // Face verification student selection states
    const [faceVerificationStudents, setFaceVerificationStudents] = useState([]);
    const [faceVerificationClasses, setFaceVerificationClasses] = useState([]);
    const [faceVerificationFaculties, setFaceVerificationFaculties] = useState([]);
    const [faceVerificationMajors, setFaceVerificationMajors] = useState([]);
    const [faceVerificationStudentGroups, setFaceVerificationStudentGroups] = useState([]);
    const [faceVerificationClassFilter, setFaceVerificationClassFilter] = useState('');
    const [faceVerificationFacultyFilter, setFaceVerificationFacultyFilter] = useState('');
    const [faceVerificationMajorFilter, setFaceVerificationMajorFilter] = useState('');
    const [faceVerificationGroupFilter, setFaceVerificationGroupFilter] = useState('');
    const [faceVerificationUseGroupMode, setFaceVerificationUseGroupMode] = useState(false);
    const [faceVerificationStatusFilter, setFaceVerificationStatusFilter] = useState('Đang học');
    
    // Exempt students (students who don't need face verification)
    const [exemptStudents, setExemptStudents] = useState([]);
    const [exemptClasses, setExemptClasses] = useState([]);
    const [exemptGroups, setExemptGroups] = useState([]);
    
    // Allowed students (only these students need face verification)
    const [allowedStudents, setAllowedStudents] = useState([]);
    const [allowedClasses, setAllowedClasses] = useState([]);
    const [allowedGroups, setAllowedGroups] = useState([]);
    const [showRequestUpdateModal, setShowRequestUpdateModal] = useState(false);
    const [showAllowUpdateModal, setShowAllowUpdateModal] = useState(false);
    const [showRevokeModal, setShowRevokeModal] = useState(false);
    const [showApproveUserRequestModal, setShowApproveUserRequestModal] = useState(false);
    const [showRejectUserRequestModal, setShowRejectUserRequestModal] = useState(false);
    const [selectedUserForUpdate, setSelectedUserForUpdate] = useState(null);
    const [selectedUserForRevoke, setSelectedUserForRevoke] = useState(null);
    const [showFaceImageModal, setShowFaceImageModal] = useState(false);
    const [selectedFaceImage, setSelectedFaceImage] = useState(null);
    const [showFaceUserDetailModal, setShowFaceUserDetailModal] = useState(false);
    const [selectedFaceUser, setSelectedFaceUser] = useState(null);
    const [updateRequestNotes, setUpdateRequestNotes] = useState('');
    const [updateType, setUpdateType] = useState('force'); // 'force' or 'allow'

    // Calculate email progress percentage for page title
    const emailProgressPercentage = bulkEmailLoading && bulkEmailProgress.total > 0
        ? Math.min(100, Math.round((bulkEmailProgress.current / bulkEmailProgress.total) * 100))
        : null;
    
    // Update page title with email progress
    usePageTitle('Quản lý người dùng', emailProgressPercentage);

    // Define all modules and their roles
    // Note: 'personal' module is excluded as it's for personal use only
    const moduleRolesConfig = {
        clinical: ['admin', 'mod', 'staff', 'view'], // Keep 'clinical' as key for backend compatibility
        ims: ['admin', 'mod', 'staff', 'view'],
        hr: ['admin', 'mod', 'staff', 'view'],
        lms: ['qa','admin', 'mod', 'staff', 'view'], // Added 'qa' for Khảo thí & Đảm bảo chất lượng
        training: ['admin', 'mod', 'staff', 'view'],
        library: ['admin', 'mod', 'staff', 'view'],
        admission: ['admin', 'mod', 'staff', 'view'],
        research: ['admin', 'mod', 'staff', 'view']
    };

    const getStudentStatValue = (student, keys, fallback = 0) => {
        for (const key of keys) {
            const val = student?.[key];
            if (typeof val === 'number' && Number.isFinite(val)) return val;
            if (typeof val === 'string' && val.trim() !== '' && !Number.isNaN(Number(val))) {
                return Number(val);
            }
        }
        return fallback;
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

    // Format time helper function
    const formatTime = (timeString) => {
        if (!timeString) return '-';
        try {
            // If it's already in HH:mm format, return as is
            if (typeof timeString === 'string' && timeString.match(/^\d{2}:\d{2}(:\d{2})?$/)) {
                return timeString.substring(0, 5); // Return HH:mm only
            }
            // If it's a timestamp, parse it
            if (timeString.includes('T') || timeString.includes('Z')) {
                const date = new Date(timeString);
                if (isNaN(date.getTime())) return timeString;
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                return `${hours}:${minutes}`;
            }
            return timeString;
        } catch (error) {
            console.error('Error formatting time:', error);
            return timeString;
        }
    };

    // Remove Vietnamese accents for filename
    const removeVietnameseAccents = (str) => {
        if (!str) return '';
        const accents = {
            'à': 'a', 'á': 'a', 'ạ': 'a', 'ả': 'a', 'ã': 'a', 'â': 'a', 'ầ': 'a', 'ấ': 'a', 'ậ': 'a', 'ẩ': 'a', 'ẫ': 'a',
            'ă': 'a', 'ằ': 'a', 'ắ': 'a', 'ặ': 'a', 'ẳ': 'a', 'ẵ': 'a',
            'è': 'e', 'é': 'e', 'ẹ': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ê': 'e', 'ề': 'e', 'ế': 'e', 'ệ': 'e', 'ể': 'e', 'ễ': 'e',
            'ì': 'i', 'í': 'i', 'ị': 'i', 'ỉ': 'i', 'ĩ': 'i',
            'ò': 'o', 'ó': 'o', 'ọ': 'o', 'ỏ': 'o', 'õ': 'o', 'ô': 'o', 'ồ': 'o', 'ố': 'o', 'ộ': 'o', 'ổ': 'o', 'ỗ': 'o',
            'ơ': 'o', 'ờ': 'o', 'ớ': 'o', 'ợ': 'o', 'ở': 'o', 'ỡ': 'o',
            'ù': 'u', 'ú': 'u', 'ụ': 'u', 'ủ': 'u', 'ũ': 'u', 'ư': 'u', 'ừ': 'u', 'ứ': 'u', 'ự': 'u', 'ử': 'u', 'ữ': 'u',
            'ỳ': 'y', 'ý': 'y', 'ỵ': 'y', 'ỷ': 'y', 'ỹ': 'y',
            'đ': 'd',
            'À': 'A', 'Á': 'A', 'Ạ': 'A', 'Ả': 'A', 'Ã': 'A', 'Â': 'A', 'Ầ': 'A', 'Ấ': 'A', 'Ậ': 'A', 'Ẩ': 'A', 'Ẫ': 'A',
            'Ă': 'A', 'Ằ': 'A', 'Ắ': 'A', 'Ặ': 'A', 'Ẳ': 'A', 'Ẵ': 'A',
            'È': 'E', 'É': 'E', 'Ẹ': 'E', 'Ẻ': 'E', 'Ẽ': 'E', 'Ê': 'E', 'Ề': 'E', 'Ế': 'E', 'Ệ': 'E', 'Ể': 'E', 'Ễ': 'E',
            'Ì': 'I', 'Í': 'I', 'Ị': 'I', 'Ỉ': 'I', 'Ĩ': 'I',
            'Ò': 'O', 'Ó': 'O', 'Ọ': 'O', 'Ỏ': 'O', 'Õ': 'O', 'Ô': 'O', 'Ồ': 'O', 'Ố': 'O', 'Ộ': 'O', 'Ổ': 'O', 'Ỗ': 'O',
            'Ơ': 'O', 'Ờ': 'O', 'Ớ': 'O', 'Ợ': 'O', 'Ở': 'O', 'Ỡ': 'O',
            'Ù': 'U', 'Ú': 'U', 'Ụ': 'U', 'Ủ': 'U', 'Ũ': 'U', 'Ư': 'U', 'Ừ': 'U', 'Ứ': 'U', 'Ự': 'U', 'Ử': 'U', 'Ữ': 'U',
            'Ỳ': 'Y', 'Ý': 'Y', 'Ỵ': 'Y', 'Ỷ': 'Y', 'Ỹ': 'Y',
            'Đ': 'D'
        };
        return str.split('').map(char => accents[char] || char).join('').replace(/[^a-zA-Z0-9_]/g, '_');
    };

    // Export statistics to Excel
    const exportToExcel = () => {
        if (!statDetailModal.data || statDetailModal.data.length === 0) {
            showAlert('Không có dữ liệu để xuất', 'warning');
            return;
        }

        try {
            // Filter data for location metric
            const filteredData = statDetailModal.metric === 'location' 
                ? statDetailModal.data.filter(item => 
                    item.location_name && item.location_name.trim() !== '' && (item.session_count || 0) > 0
                )
                : statDetailModal.data;

            // Prepare data for export
            const exportData = filteredData.map((item, index) => {
                if (statDetailModal.metric === 'location') {
                    return {
                        'STT': index + 1,
                        'Tên địa điểm': item.location_name || '-',
                        'Số buổi học': item.session_count || 0,
                        'Ngày đầu tiên': formatDate(item.first_session_date),
                        'Ngày cuối cùng': formatDate(item.last_session_date)
                    };
                }

                const row = {
                    'STT': index + 1,
                    'Buổi học': item.session_title || item.title || '-',
                    'Ngày': formatDate(item.session_date || item.date)
                };

                if (statDetailModal.metric === 'late' ||
                    statDetailModal.metric === 'sessions') {
                    row['Giờ bắt đầu'] = formatTime(item.start_time);
                }

                if (statDetailModal.metric === 'sessions') {
                    row['Giờ kết thúc'] = formatTime(item.end_time);
                    row['Địa điểm'] = item.location || '-';
                }

                if (statDetailModal.metric === 'late') {
                    row['Giờ điểm danh'] = formatTime(item.check_in_time);
                    row['Đi trễ (phút)'] = item.minutes_late != null ? item.minutes_late : '-';
                }

                if (statDetailModal.metric === 'missingTimeSlot') {
                    row['Loại thiếu'] = item.missing_type || '-';
                }

                if (statDetailModal.metric === 'sessions') {
                    row['Trạng thái'] = item.status === 'ended' ? 'Đã kết thúc' :
                        item.status === 'active' ? 'Đang diễn ra' :
                        item.status === 'scheduled' ? 'Đã lên lịch' :
                        item.status || '-';
                }

                return row;
            });

            // Create workbook and worksheet
            const ws = XLSX.utils.json_to_sheet(exportData);
            
            // Set column widths for better readability
            const colWidths = [];
            const maxWidth = 50;
            Object.keys(exportData[0] || {}).forEach((key, idx) => {
                const headerLength = key.length;
                const maxDataLength = Math.max(...exportData.map(row => String(row[key] || '').length));
                colWidths.push({ wch: Math.min(Math.max(headerLength, maxDataLength) + 2, maxWidth) });
            });
            ws['!cols'] = colWidths;
            
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Thong_ke');

            // Generate filename (remove Vietnamese accents)
            const metricNames = {
                'late': 'Di_tre',
                'missingTimeSlot': 'Thieu_gio_diem_danh',
                'absent': 'Vang_mat',
                'sessions': 'Tong_so_buoi_hoc',
                'location': 'Dia_diem'
            };
            const studentName = selectedStudent 
                ? `${selectedStudent.student_id}_${removeVietnameseAccents(selectedStudent.full_name || 'Sinh_vien')}` 
                : 'Sinh_vien';
            const filename = `Thong_ke_${metricNames[statDetailModal.metric] || 'chi_tiet'}_${studentName}_${new Date().toISOString().split('T')[0]}.xlsx`;

            // Write file
            XLSX.writeFile(wb, filename);
            showAlert('Xuất file Excel thành công!', 'success');
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            showAlert('Lỗi khi xuất file Excel', 'danger');
        }
    };

    // Export statistics to Word
    const exportToWord = () => {
        if (!statDetailModal.data || statDetailModal.data.length === 0) {
            showAlert('Không có dữ liệu để xuất', 'warning');
            return;
        }

        try {
            // Get metric title
            const metricTitles = {
                'late': 'Chi tiết: Đi trễ',
                'missingTimeSlot': 'Chi tiết: Thiếu giờ điểm danh',
                'absent': 'Chi tiết: Vắng mặt',
                'sessions': 'Chi tiết: Tổng số buổi học',
                'location': 'Chi tiết: Địa điểm'
            };
            const title = metricTitles[statDetailModal.metric] || 'Chi tiết thống kê';
            const studentInfo = selectedStudent ? `${selectedStudent.full_name} - ${selectedStudent.student_id}` : 'Sinh viên';

            // Build table HTML
            let tableHTML = '<table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%;">';
            
            // Header row
            tableHTML += '<thead><tr style="background-color: #f0f0f0; font-weight: bold;">';
            
            if (statDetailModal.metric === 'location') {
                tableHTML += '<th>STT</th>';
                tableHTML += '<th>Tên địa điểm</th>';
                tableHTML += '<th>Số buổi học</th>';
                tableHTML += '<th>Ngày đầu tiên</th>';
                tableHTML += '<th>Ngày cuối cùng</th>';
            } else {
                tableHTML += '<th>STT</th>';
                tableHTML += '<th>Buổi học</th>';
                tableHTML += '<th>Ngày</th>';
                
                if (statDetailModal.metric === 'late' ||
                    statDetailModal.metric === 'sessions') {
                    tableHTML += '<th>Giờ bắt đầu</th>';
                }
                
                if (statDetailModal.metric === 'sessions') {
                    tableHTML += '<th>Giờ kết thúc</th>';
                    tableHTML += '<th>Địa điểm</th>';
                }
                
                if (statDetailModal.metric === 'late') {
                    tableHTML += '<th>Giờ điểm danh</th>';
                    tableHTML += '<th>Đi trễ (phút)</th>';
                }
                
                if (statDetailModal.metric === 'missingTimeSlot') {
                    tableHTML += '<th>Loại thiếu</th>';
                }
                
                if (statDetailModal.metric === 'sessions') {
                    tableHTML += '<th>Trạng thái</th>';
                }
            }
            
            tableHTML += '</tr></thead><tbody>';

            // Filter data for location metric
            const filteredData = statDetailModal.metric === 'location' 
                ? statDetailModal.data.filter(item => 
                    item.location_name && item.location_name.trim() !== '' && (item.session_count || 0) > 0
                )
                : statDetailModal.data;

            // Data rows
            filteredData.forEach((item, index) => {
                tableHTML += '<tr>';
                
                if (statDetailModal.metric === 'location') {
                    tableHTML += `<td>${index + 1}</td>`;
                    tableHTML += `<td><strong>${item.location_name || '-'}</strong></td>`;
                    tableHTML += `<td>${item.session_count || 0}</td>`;
                    tableHTML += `<td>${formatDate(item.first_session_date)}</td>`;
                    tableHTML += `<td>${formatDate(item.last_session_date)}</td>`;
                } else {
                    tableHTML += `<td>${index + 1}</td>`;
                    tableHTML += `<td>${item.session_title || item.title || '-'}</td>`;
                    tableHTML += `<td>${formatDate(item.session_date || item.date)}</td>`;
                    
                    if (statDetailModal.metric === 'late' ||
                        statDetailModal.metric === 'sessions') {
                        tableHTML += `<td>${formatTime(item.start_time)}</td>`;
                    }
                    
                    if (statDetailModal.metric === 'sessions') {
                        tableHTML += `<td>${formatTime(item.end_time)}</td>`;
                        tableHTML += `<td>${item.location || '-'}</td>`;
                    }
                    
                    if (statDetailModal.metric === 'late') {
                        tableHTML += `<td>${formatTime(item.check_in_time)}</td>`;
                        tableHTML += `<td>${item.minutes_late != null ? `${item.minutes_late} phút` : '-'}</td>`;
                    }
                    
                    if (statDetailModal.metric === 'missingTimeSlot') {
                        tableHTML += `<td>${item.missing_type || '-'}</td>`;
                    }
                    
                    if (statDetailModal.metric === 'sessions') {
                        const status = item.status === 'ended' ? 'Đã kết thúc' :
                            item.status === 'active' ? 'Đang diễn ra' :
                            item.status === 'scheduled' ? 'Đã lên lịch' :
                            item.status || '-';
                        tableHTML += `<td>${status}</td>`;
                    }
                }
                
                tableHTML += '</tr>';
            });

            tableHTML += '</tbody></table>';

            // Create full HTML document with proper encoding for Vietnamese
            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
                    <meta charset="UTF-8">
                    <title>${title}</title>
                    <style>
                        body { font-family: "Times New Roman", Arial, sans-serif; margin: 20px; }
                        h1 { color: #333; }
                        h2 { color: #666; margin-top: 20px; }
                        table { margin-top: 20px; border-collapse: collapse; width: 100%; }
                        table th, table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        table th { background-color: #f0f0f0; font-weight: bold; }
                    </style>
                </head>
                <body>
                    <h1>${title}</h1>
                    <h2>${studentInfo}</h2>
                    <p>Ngày xuất: ${formatDate(new Date().toISOString())}</p>
                    ${tableHTML}
                </body>
                </html>
            `;

            // Create blob with UTF-8 BOM for proper Vietnamese character encoding
            const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            
            const metricNames = {
                'late': 'Di_tre',
                'missingTimeSlot': 'Thieu_gio_diem_danh',
                'absent': 'Vang_mat',
                'sessions': 'Tong_so_buoi_hoc',
                'location': 'Dia_diem'
            };
            const studentName = selectedStudent 
                ? `${selectedStudent.student_id}_${removeVietnameseAccents(selectedStudent.full_name || 'Sinh_vien')}` 
                : 'Sinh_vien';
            link.download = `Thong_ke_${metricNames[statDetailModal.metric] || 'chi_tiet'}_${studentName}_${new Date().toISOString().split('T')[0]}.doc`;
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            showAlert('Xuất file Word thành công!', 'success');
        } catch (error) {
            console.error('Error exporting to Word:', error);
            showAlert('Lỗi khi xuất file Word', 'danger');
        }
    };

    // Helper functions for module display
    const getModuleIcon = (module) => {
        const icons = {
            personal: 'user',
            clinical: 'clipboard-check', // Changed icon for attendance/clinical
            ims: 'tachometer-alt',
            hr: 'briefcase-medical',
            lms: 'graduation-cap',
            training: 'chalkboard-teacher',
            library: 'book-medical',
            admission: 'user-plus',
            research: 'flask'
        };
        return icons[module] || 'cog';
    };

    const getModuleName = (module) => {
        const names = {
            personal: 'Cá nhân',
            clinical: 'Điểm danh', // Display as "Điểm danh" instead of "Clinical"
            ims: 'IMS',
            hr: 'HR',
            lms: 'LMS',
            training: 'Training',
            library: 'Library',
            admission: 'Admission',
            research: 'Research'
        };
        return names[module] || module;
    };

    // Format module role for display (e.g., "clinical_admin" -> "Quản trị viên Điểm danh")
    const formatModuleRole = (roleKey) => {
        const [module, roleType] = roleKey.split('_');

        // Map role types to Vietnamese
        const roleTypeMap = {
            'qa': 'Khảo thí & Đảm bảo chất lượng',
            'admin': 'Quản trị viên',
            'mod': 'Quản lý',
            'staff': 'Nhân viên',
            'view': 'Chỉ xem'
        };

        // Map modules to Vietnamese names
        const moduleNameMap = {
            'admission': 'Tuyển sinh',
            'clinical': 'Điểm danh', // Display as "Điểm danh" instead of "Lâm sàng"
            'hr': 'Hành chính',
            'ims': 'Hệ thống',
            'library': 'Thư viện',
            'lms': 'LMS',
            'research': 'TTNC',
            'training': 'Phòng đào tạo'
        };

        // Special handling for lms_qa - display as standalone role name
        if (module === 'lms' && roleType === 'qa') {
            return 'Khảo thí & Đảm bảo chất lượng LMS';
        }

        const roleTypeName = roleTypeMap[roleType] || roleType;
        const moduleName = moduleNameMap[module] || getModuleName(module);

        return `${roleTypeName} ${moduleName}`;
    };

    // States for student groups management
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [showGroupDetailModal, setShowGroupDetailModal] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [groupFormData, setGroupFormData] = useState({
        group_name: '',
        description: '',
        selected_classes: [],
        student_ids: []
    });
    const [availableClasses, setAvailableClasses] = useState([]);
    const [studentsByClasses, setStudentsByClasses] = useState([]);
    const [showDeleteGroupModal, setShowDeleteGroupModal] = useState(false);
    const [groupToDelete, setGroupToDelete] = useState(null);

    // Update pagination when students/users/studentGroups change
    useEffect(() => {
        let dataToPaginate = [];
        if (activeTab === 'students') {
            dataToPaginate = students;
        } else if (activeTab === 'staff') {
            dataToPaginate = users;
        } else if (activeTab === 'student-groups') {
            dataToPaginate = studentGroups;
        }

        const totalItems = dataToPaginate.length;
        const totalPages = Math.ceil(totalItems / pagination.limit);
        setPagination(prev => ({
            ...prev,
            totalItems,
            totalPages,
            page: prev.page > totalPages && totalPages > 0 ? totalPages : prev.page
        }));
    }, [students, users, studentGroups, activeTab, pagination.limit]);

    useEffect(() => {

        if (activeTab === 'student-groups') {
            fetchStudentGroups();
            fetchAvailableClasses();
        } else if (activeTab === 'face-management') {
            fetchFaceUsers();
        } else {
            fetchUsers();
        }
    }, [activeTab, debouncedSearchTerm, classFilter, facultyFilter, majorFilter, statusFilter, sortField, sortOrder, faceSearchTerm, faceUsersPagination.page]);

    // Update refs when state changes
    useEffect(() => {
        faceUsersPaginationRef.current = faceUsersPagination;
    }, [faceUsersPagination]);
    
    useEffect(() => {
        faceSearchTermRef.current = faceSearchTerm;
    }, [faceSearchTerm]);

    // Background polling for face management tab - only update when data changes
    useEffect(() => {
        if (activeTab !== 'face-management') return;
        
        let pollInterval;
        let isMounted = true;
        let currentPolling = false;
        
        const pollFaceUsers = async () => {
            if (currentPolling || !isMounted) return;
            
            try {
                currentPolling = true;
                
                // Get current values from refs
                const currentPagination = faceUsersPaginationRef.current;
                const currentSearch = faceSearchTermRef.current;
                
                // Build URL with current values
                let url = `/face-management/users?page=${currentPagination.page}&limit=${currentPagination.limit}`;
                
                if (currentSearch) {
                    url += `&search=${encodeURIComponent(currentSearch)}`;
                }

                const response = await api.get(url);
                
                if (!isMounted) {
                    currentPolling = false;
                    return;
                }
                
                const usersData = response.data?.data;
                
                // Compare with current data - only update if changed
                setFaceUsers(currentFaceUsers => {
                    if (hasFaceUsersDataChanged(currentFaceUsers, usersData)) {
                        // Data changed, update silently
                        faceUsersDataRef.current = usersData;
                        setFaceUsersLastUpdate(Date.now());
                        return usersData;
                    }
                    return currentFaceUsers;
                });
                
                // Update pagination if changed
                if (response.data?.pagination) {
                    setFaceUsersPagination(prev => {
                        const newPagination = {
                            ...prev,
                            totalItems: response.data.pagination?.totalItems || 0,
                            totalPages: response.data.pagination?.totalPages || 0
                        };
                        // Only update if changed
                        if (
                            prev.totalItems !== newPagination.totalItems ||
                            prev.totalPages !== newPagination.totalPages
                        ) {
                            return newPagination;
                        }
                        return prev;
                    });
                }
            } catch (error) {
                console.debug('Background polling error (silent):', error);
            } finally {
                currentPolling = false;
            }
        };
        
        // Start polling after initial load (10 seconds delay)
        const initialDelay = setTimeout(() => {
            if (isMounted) {
                // Poll every 5 seconds (reduced frequency)
                pollInterval = setInterval(pollFaceUsers, 5000);
            }
        }, 10000);
        
        return () => {
            isMounted = false;
            clearTimeout(initialDelay);
            if (pollInterval) {
                clearInterval(pollInterval);
            }
        };
    }, [activeTab]);

    // Debounce search term to avoid too many API calls
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 500); // 500ms delay

        return () => clearTimeout(timer);
    }, [searchTerm]);

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

    // State for storing student counts
    const [totalStudentsWithPasswords, setTotalStudentsWithPasswords] = useState(0);
    const [classStudentCounts, setClassStudentCounts] = useState({});
    const [facultyStudentCounts, setFacultyStudentCounts] = useState({});
    const [majorStudentCounts, setMajorStudentCounts] = useState({});

    // Lấy danh sách các lớp, khoa, ngành duy nhất từ server để hiển thị trong bộ lọc
    useEffect(() => {
        if (activeTab === 'students') {
            const fetchFilterOptions = async () => {
                try {
                    const response = await api.get('/users/filter-options');

                    if (response.data && response.data.success) {
                        console.log('Filter options from server:', response.data);

                        // Set unique classes with counts
                        const classes = response.data.classes || [];
                        setUniqueClasses(classes.map(c => c.name));

                        // Create a map of class name to student count
                        const classCountMap = {};
                        classes.forEach(c => {
                            classCountMap[c.name] = c.count;
                        });
                        setClassStudentCounts(classCountMap);

                        // Set unique faculties with counts
                        const faculties = response.data.faculties || [];
                        setUniqueFaculties(faculties.map(f => f.name));

                        // Create a map of faculty name to student count
                        const facultyCountMap = {};
                        faculties.forEach(f => {
                            facultyCountMap[f.name] = f.count;
                        });
                        setFacultyStudentCounts(facultyCountMap);

                        // Set unique majors with counts
                        const majors = response.data.majors || [];
                        setUniqueMajors(majors.map(m => m.name));

                        // Create a map of major name to student count
                        const majorCountMap = {};
                        majors.forEach(m => {
                            majorCountMap[m.name] = m.count;
                        });
                        setMajorStudentCounts(majorCountMap);

                        // Set unique statuses with counts
                        const statuses = response.data.statuses || [];
                        if (statuses.length > 0) {
                            setUniqueStatuses(statuses.map(s => s.name));

                            // Create a map of status name to student count
                            const statusCountMap = {};
                            statuses.forEach(s => {
                                statusCountMap[s.name] = s.count;
                            });
                            setStatusStudentCounts(statusCountMap);
                        } else {
                            // Set default statuses if none returned from server
                            setUniqueStatuses(['Đang học', 'Nghỉ học', 'Tạm dừng', 'Đã tốt nghiệp']);
                        }

                        // Set total student count
                        setTotalStudentsWithPasswords(response.data.totalCount || 0);
                    } else {
                        console.error('Error in filter options response:', response.data);
                        // Set default statuses
                        setUniqueStatuses(['Đang học', 'Nghỉ học', 'Tạm dừng', 'Đã tốt nghiệp']);
                    }
                } catch (error) {
                    console.error('Error fetching filter options:', error);
                    // Fallback to client-side filtering if server request fails
                    if (students.length > 0) {
                        const classes = [...new Set(students
                            .map(student => student.class_name)
                            .filter(className => className))];
                        setUniqueClasses(classes);

                        const faculties = [...new Set(students
                            .map(student => student.faculty_name)
                            .filter(facultyName => facultyName))];
                        setUniqueFaculties(faculties);

                        const majors = [...new Set(students
                            .map(student => student.major_name)
                            .filter(majorName => majorName))];
                        setUniqueMajors(majors);

                        // Set default statuses
                        setUniqueStatuses(['Đang học', 'Nghỉ học', 'Tạm dừng', 'Đã tốt nghiệp']);
                    }
                }
            };

            fetchFilterOptions();
        }
    }, [activeTab, api]);

    // Fetch tất cả sinh viên cho modal bulk email
    const fetchAllStudents = async () => {
        try {
            const response = await api.get('/users?role=student&limit=999999'); // Lấy tất cả sinh viên
            if (response.data && response.data.success) {
                setAllStudents(response.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching all students:', error);
            setAllStudents([]);
        }
    };

    // Fetch danh sách nhóm sinh viên
    const fetchStudentGroups = async () => {
        try {
            const response = await api.get('/student-groups');
            if (response.data && response.data.success) {
                setStudentGroups(response.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching student groups:', error);
            setStudentGroups([]);
        }
    };

    // Fetch danh sách sinh viên từ API dựa trên các filter đã chọn
    const fetchFilteredStudentsForEmail = async () => {
        // Chỉ fetch khi có ít nhất một filter được chọn
        if (!selectedClass && !selectedFaculty && !selectedMajor) {
            setFilteredStudentsForEmail([]);
            return;
        }

        try {
            setLoadingFilteredStudents(true);
            let url = `/users?role=student&limit=999999`;

            if (selectedClass) {
                url += `&class_name=${encodeURIComponent(selectedClass)}`;
            }

            if (selectedFaculty) {
                url += `&faculty_name=${encodeURIComponent(selectedFaculty)}`;
            }

            if (selectedMajor) {
                url += `&major_name=${encodeURIComponent(selectedMajor)}`;
            }

            const response = await api.get(url);
            if (response.data && response.data.success) {
                setFilteredStudentsForEmail(response.data.data || []);
            } else {
                setFilteredStudentsForEmail([]);
            }
        } catch (error) {
            console.error('Error fetching filtered students for email:', error);
            setFilteredStudentsForEmail([]);
        } finally {
            setLoadingFilteredStudents(false);
        }
    };

    // Fetch danh sách sinh viên khi filter thay đổi
    useEffect(() => {
        if (selectedClass || selectedFaculty || selectedMajor) {
            fetchFilteredStudentsForEmail();
            setSelectedStudentsForEmail([]);
        } else {
            setFilteredStudentsForEmail([]);
            setSelectedStudentsForEmail([]);
        }
    }, [selectedClass, selectedFaculty, selectedMajor]);

    // Fetch danh sách các lớp duy nhất
    const fetchAvailableClasses = async () => {
        try {
            console.log('Fetching available classes...');

            // Try the student-groups API first
            try {
                const response = await api.get('/student-groups/classes/unique');
                console.log('Classes API response:', response.data);
                if (response.data && response.data.success) {
                    console.log('Classes fetched successfully:', response.data.data);
                    setAvailableClasses(response.data.data || []);
                    return;
                }
            } catch (apiError) {
                console.warn('Student-groups API failed, trying users API:', apiError);
            }

            // Fallback: fetch from users API
            try {
                const response = await api.get('/users?role=student&limit=999999');
                console.log('Users API response for classes:', response.data);
                if (response.data && response.data.success) {
                    // Extract unique classes from users data
                    const users = response.data.data || []; // Fix: use data directly, not data.users
                    console.log('Users data structure:', users.slice(0, 3)); // Debug first 3 users

                    const classMap = new Map();

                    users.forEach(user => {
                        console.log('User class_name:', user.class_name); // Debug each user's class_name
                        if (user.class_name && user.class_name.trim() !== '') {
                            if (classMap.has(user.class_name)) {
                                classMap.get(user.class_name).student_count++;
                            } else {
                                classMap.set(user.class_name, {
                                    class_name: user.class_name,
                                    student_count: 1
                                });
                            }
                        }
                    });

                    const classes = Array.from(classMap.values()).sort((a, b) => a.class_name.localeCompare(b.class_name));
                    console.log('Classes extracted from users:', classes);
                    setAvailableClasses(classes);
                    return;
                }
            } catch (usersError) {
                console.error('Users API also failed:', usersError);
            }

            // If both APIs fail, set empty array
            console.error('All APIs failed, setting empty classes');
            setAvailableClasses([]);

        } catch (error) {
            console.error('Error fetching available classes:', error);
            console.error('Error details:', error.response?.data);
            setAvailableClasses([]);
        }
    };

    // Fetch sinh viên theo lớp đã chọn
    const fetchStudentsByClasses = async (classes) => {
        if (!classes || classes.length === 0) {
            setStudentsByClasses([]);
            return;
        }

        try {
            console.log('Debug - Fetching students for classes:', classes);

            // Try the student-groups API first
            try {
                const response = await api.get(`/student-groups/students/by-classes?classes=${classes.join(',')}`);
                console.log('Students API response:', response.data);
                if (response.data && response.data.success) {
                    console.log('Debug - Students fetched:', response.data.data);
                    setStudentsByClasses(response.data.data || []);
                    return;
                }
            } catch (apiError) {
                console.warn('Student-groups students API failed, trying users API:', apiError);
            }

            // Fallback: fetch from users API
            try {
                const response = await api.get(`/users?role=student&limit=999999`);
                console.log('Users API response for students:', response.data);
                if (response.data && response.data.success) {
                    // Filter users by selected classes
                    const users = response.data.data || [];
                    const filteredUsers = users.filter(user =>
                        user.class_name && classes.includes(user.class_name)
                    );
                    console.log('Debug - Students filtered by classes:', filteredUsers);
                    setStudentsByClasses(filteredUsers);
                    return;
                }
            } catch (usersError) {
                console.error('Users API also failed:', usersError);
            }

            // If both APIs fail, set empty array
            console.error('All APIs failed, setting empty students');
            setStudentsByClasses([]);

        } catch (error) {
            console.error('Error fetching students by classes:', error);
            setStudentsByClasses([]);
        }
    };

    // Helper function to compare face users data
    const hasFaceUsersDataChanged = (oldData, newData) => {
        if (!oldData || !Array.isArray(oldData)) return true;
        if (!newData || !Array.isArray(newData)) return false;
        if (oldData.length !== newData.length) return true;
        
        // Create maps for quick comparison
        const oldMap = new Map(oldData.map(user => [user.id, {
            id: user.id,
            has_face_embedding: user.has_face_embedding,
            has_pending_update_request: user.has_pending_update_request,
            pending_request_type: user.pending_request_type,
            updated_at: user.updated_at
        }]));
        
        for (const newUser of newData) {
            const oldUser = oldMap.get(newUser.id);
            if (!oldUser) return true;
            
            // Check if any relevant field changed
            if (
                oldUser.has_face_embedding !== newUser.has_face_embedding ||
                oldUser.has_pending_update_request !== newUser.has_pending_update_request ||
                oldUser.pending_request_type !== newUser.pending_request_type ||
                oldUser.updated_at !== newUser.updated_at
            ) {
                return true;
            }
        }
        
        return false;
    };

    // Fetch users with face_embedding
    const fetchFaceUsers = async (silent = false) => {
        try {
            if (!silent) {
                setFaceUsersLoading(true);
            }
            if (!silent) {
                setError('');
            }

            let url = `/face-management/users?page=${faceUsersPagination.page}&limit=${faceUsersPagination.limit}`;
            
            if (faceSearchTerm) {
                url += `&search=${encodeURIComponent(faceSearchTerm)}`;
            }

            const response = await api.get(url);

            if (response.data && response.data.success) {
                const users = response.data.data || [];
                
                // Only update if data actually changed (for silent updates)
                if (silent) {
                    const currentData = faceUsersDataRef.current || faceUsers;
                    if (!hasFaceUsersDataChanged(currentData, users)) {
                        // No changes, skip update
                        return;
                    }
                }
                
                // Update data
                setFaceUsers(users);
                faceUsersDataRef.current = users; // Store for comparison
                setFaceUsersPagination(prev => ({
                    ...prev,
                    totalItems: response.data.pagination?.totalItems || 0,
                    totalPages: response.data.pagination?.totalPages || 0
                }));
                setFaceUsersLastUpdate(Date.now());
            } else {
                if (!silent) {
                    setError(response.data?.message || 'Lỗi khi tải danh sách người dùng có face embedding.');
                    setFaceUsers([]);
                }
            }
        } catch (error) {
            console.error('Error fetching face users:', error);
            if (!silent) {
                setError('Không thể tải danh sách người dùng có face embedding. Vui lòng thử lại sau.');
                setFaceUsers([]);
            }
        } finally {
            if (!silent) {
                setFaceUsersLoading(false);
            }
        }
    };

    const fetchUsers = async () => {
        try {
            setLoading(true);
            setError('');

            // Hiển thị tất cả danh sách luôn
            let url = `/users?page=1&limit=999999`;

            if (activeTab === 'students') {
                // Tab sinh viên: chỉ lấy role student
                url += `&role=student`;
            } else if (activeTab === 'staff') {
                // Tab nhân viên: loại trừ role student (chỉ lấy staff, admin, superadmin)
                url += `&excludeRole=student`;
            }

            if (debouncedSearchTerm) {
                url += `&search=${encodeURIComponent(debouncedSearchTerm)}`;
            }

            // Thêm các tham số lọc mới (chỉ áp dụng cho sinh viên)
            if (activeTab === 'students') {
                if (classFilter) {
                    url += `&class_name=${encodeURIComponent(classFilter)}`;
                }

                if (facultyFilter) {
                    url += `&faculty_name=${encodeURIComponent(facultyFilter)}`;
                }

                if (majorFilter) {
                    url += `&major_name=${encodeURIComponent(majorFilter)}`;
                }

                // Only add status filter if it's not empty
                if (statusFilter && statusFilter.trim() !== '') {
                    url += `&status=${encodeURIComponent(statusFilter)}`;
                }
            }

            // Add sorting parameters
            if (sortField) {
                url += `&sort_field=${encodeURIComponent(sortField)}`;
            }

            if (sortOrder) {
                url += `&sort_order=${encodeURIComponent(sortOrder)}`;
            }

            console.log('Fetching users with URL:', url);
            console.log('Current filter states:', {
                classFilter,
                facultyFilter,
                majorFilter,
                statusFilter
            });
            const response = await api.get(url);

            if (response.data && response.data.success) {
                if (activeTab === 'students') {
                    setStudents(response.data.data || []);
                } else {
                    setUsers(response.data.data || []);
                }

            } else {
                console.error('API response error:', response.data);
                setError(response.data?.message || 'Lỗi khi tải danh sách người dùng.');
            }
        } catch (error) {
            console.error('Error fetching users:', error);
            setError('Không thể tải danh sách người dùng. Vui lòng thử lại sau.');

            // Reset data to prevent UI issues
            if (activeTab === 'students') {
                setStudents([]);
            } else {
                setUsers([]);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setSearchTerm('');
        setClassFilter('');
        setFacultyFilter('');
        setMajorFilter('');
        setStatusFilter('');
        setPagination(prev => ({ ...prev, page: 1 })); // Reset to page 1 when changing tabs
        setNewUser(prev => ({
            ...prev,
            role: tab === 'students' ? 'student' : 'staff'
        }));

        // Fetch data for the new tab
        setTimeout(() => {
            if (tab === 'student-groups') {
                fetchStudentGroups();
                fetchAvailableClasses();
            } else {
                // Force fetch with the correct tab context
                fetchUsersWithTab(tab);
            }
        }, 100);
    };

    const fetchUsersWithTab = async (tab) => {
        try {
            setLoading(true);
            setError('');

            // Hiển thị tất cả danh sách luôn
            let url = `/users?page=1&limit=999999`;

            if (tab === 'students') {
                // Tab sinh viên: chỉ lấy role student
                url += `&role=student`;
            } else if (tab === 'staff') {
                // Tab nhân viên: loại trừ role student (chỉ lấy staff, admin, superadmin)
                url += `&excludeRole=student`;
            }

            if (debouncedSearchTerm) {
                url += `&search=${encodeURIComponent(debouncedSearchTerm)}`;
            }

            // Thêm các tham số lọc mới (chỉ áp dụng cho sinh viên)
            if (tab === 'students') {
                if (classFilter) {
                    url += `&class_name=${encodeURIComponent(classFilter)}`;
                }

                if (facultyFilter) {
                    url += `&faculty_name=${encodeURIComponent(facultyFilter)}`;
                }

                if (majorFilter) {
                    url += `&major_name=${encodeURIComponent(majorFilter)}`;
                }

                // Only add status filter if it's not empty
                if (statusFilter && statusFilter.trim() !== '') {
                    url += `&status=${encodeURIComponent(statusFilter)}`;
                }
            }

            // Add sorting parameters
            if (sortField) {
                url += `&sort_field=${encodeURIComponent(sortField)}`;
            }

            if (sortOrder) {
                url += `&sort_order=${encodeURIComponent(sortOrder)}`;
            }

            const response = await api.get(url);

            if (response.data.success) {
                setUsers(response.data.data);
            } else {
                setError('Không thể tải danh sách người dùng');
            }
        } catch (error) {
            console.error('Error fetching users:', error);
            setError('Không thể tải danh sách người dùng. Vui lòng thử lại sau.');
        } finally {
            setLoading(false);
        }
    };

    const handleAddUser = async (e) => {
        e.preventDefault();

        try {
            setLoading(true);
            setError('');

            const response = await api.post('/users', newUser);

            if (response.data.success) {
                setShowAddModal(false);
                await fetchUsers(); // Wait for the fetch to complete
                setNewUser({
                    username: '',
                    email: '',
                    fullName: '',
                    password: '',
                    role: activeTab === 'students' ? 'student' : 'staff',
                    student_id: '',
                    class_name: '',
                    faculty_name: '',
                    major_name: '',
                    birth_date: '',
                    gender: '',
                    address: '',
                    id_number: '',
                    status: '',
                    phone: ''
                });
            }
        } catch (error) {
            console.error('Error adding user:', error);
            setError(error.response?.data?.message || 'Không thể thêm người dùng. Vui lòng thử lại sau.');
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
                fetchUsers();
                setShowDeleteModal(false);
                setUserToDelete(null);
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            setError(error.response?.data?.message || 'Không thể xóa người dùng. Vui lòng thử lại sau.');
        } finally {
            setLoading(false);
        }
    };

    // Toggle password visibility
    const togglePasswordVisibility = (userId) => {
        setVisiblePasswords(prev => ({
            ...prev,
            [userId]: !prev[userId]
        }));
    };

    // Reset MAC address for a student
    const handleResetMac = async (userId) => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa địa chỉ MAC của thiết bị này? Sinh viên sẽ có thể đăng nhập từ một thiết bị mới.')) {
            return;
        }

        try {
            setLoading(true);
            const response = await api.post(`/auth/reset-device-mac/${userId}`);

            if (response.data.success) {
                showAlert('Đã xóa địa chỉ MAC thành công', 'success');
                fetchUsers(); // Refresh user data
            } else {
                showAlert(response.data.message || 'Có lỗi xảy ra', 'danger');
            }
        } catch (error) {
            console.error('Error resetting MAC:', error);
            showAlert(error.response?.data?.message || 'Có lỗi xảy ra khi xóa địa chỉ MAC', 'danger');
        } finally {
            setLoading(false);
        }
    };

    // Open statistics detail modal for a specific metric (per student)
    const openStatDetailModal = async (metric) => {
        if (!selectedStudent?.id) return;

        setStatDetailModal(prev => ({
            ...prev,
            show: true,
            metric,
            loading: true,
            error: '',
            data: []
        }));

        try {
            let endpointMetric;
            switch (metric) {
                case 'late':
                    endpointMetric = 'late';
                    break;
                case 'missingTimeSlot':
                    endpointMetric = 'missingTimeSlot';
                    break;
                case 'absent':
                    endpointMetric = 'absent';
                    break;
                case 'sessions':
                    endpointMetric = 'studentSessions';
                    break;
                case 'location':
                    endpointMetric = 'location';
                    break;
                default:
                    endpointMetric = metric;
            }

            // Reuse dashboard detailed stats endpoint
            let endpoint = `/dashboard/stats/${endpointMetric}/${selectedStudent.id}`;

            // Use the same stored filter as admin StatisticsDetail (if any)
            const dateFilter = 'all';
            const customDate = localStorage.getItem('dashboardCustomDate') || '';
            const customStartDate = localStorage.getItem('dashboardCustomStartDate') || '';
            const customEndDate = localStorage.getItem('dashboardCustomEndDate') || '';

            const getDateRange = (filter) => {
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

                switch (filter) {
                    case 'today':
                        return { startDate: today.toISOString().split('T')[0], endDate: null };
                    case '2days': {
                        const twoDaysAgo = new Date(today);
                        twoDaysAgo.setDate(twoDaysAgo.getDate() - 1);
                        return { startDate: twoDaysAgo.toISOString().split('T')[0], endDate: null };
                    }
                    case '3days': {
                        const threeDaysAgo = new Date(today);
                        threeDaysAgo.setDate(threeDaysAgo.getDate() - 2);
                        return { startDate: threeDaysAgo.toISOString().split('T')[0], endDate: null };
                    }
                    case '1week': {
                        const oneWeekAgo = new Date(today);
                        oneWeekAgo.setDate(oneWeekAgo.getDate() - 6);
                        return { startDate: oneWeekAgo.toISOString().split('T')[0], endDate: null };
                    }
                    case '1month': {
                        const oneMonthAgo = new Date(today);
                        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
                        return { startDate: oneMonthAgo.toISOString().split('T')[0], endDate: null };
                    }
                    case 'customDate':
                        if (customDate) {
                            return { startDate: customDate, endDate: customDate };
                        }
                        return { startDate: null, endDate: null };
                    case 'customRange':
                        if (customStartDate && customEndDate) {
                            return { startDate: customStartDate, endDate: customEndDate };
                        }
                        return { startDate: null, endDate: null };
                    case 'all':
                    default:
                        return { startDate: null, endDate: null };
                }
            };

            const dateRange = getDateRange(dateFilter);
            const params = new URLSearchParams();
            if (dateRange.startDate) params.append('startDate', dateRange.startDate);
            if (dateRange.endDate) params.append('endDate', dateRange.endDate);
            const queryString = params.toString();
            if (queryString) {
                endpoint += `?${queryString}`;
            }

            const response = await api.get(endpoint);
            if (response.data?.success) {
                setStatDetailModal(prev => ({
                    ...prev,
                    data: response.data.data || [],
                    loading: false
                }));
            } else {
                setStatDetailModal(prev => ({
                    ...prev,
                    error: response.data?.message || 'Không thể tải dữ liệu thống kê chi tiết',
                    loading: false
                }));
            }
        } catch (error) {
            console.error('Error fetching statistic detail:', error);
            setStatDetailModal(prev => ({
                ...prev,
                error: error.response?.data?.message || 'Không thể tải dữ liệu thống kê chi tiết',
                loading: false
            }));
        }
    };

    // Load statistics for a specific student when opening detail modal
    const fetchStudentStatistics = async (studentId) => {
        if (!studentId) return;
        try {
            setStudentStatsLoading(true);
            setStudentStatsError('');
            const response = await api.get(`/users/${studentId}/statistics`);
            if (response.data?.success) {
                const stats = response.data.data || {};
                setSelectedStudent(prev => prev ? { ...prev, ...stats } : { ...stats, id: studentId });
            } else {
                setStudentStatsError(response.data?.message || 'Không thể tải thống kê của sinh viên.');
            }
        } catch (error) {
            console.error('Error fetching student statistics:', error);
            setStudentStatsError(error.response?.data?.message || 'Không thể tải thống kê của sinh viên.');
        } finally {
            setStudentStatsLoading(false);
        }
    };

    const closeStatDetail = () => {
        setStatDetailModal({
            show: false,
            metric: null,
            data: [],
            loading: false,
            error: ''
        });
    };

    // Handle student row click to show details
    const handleStudentRowClick = (student) => {
        setSelectedStudent(student);
        setShowDetailModal(true);
        fetchStudentStatistics(student?.id);
    };

    const statMetricMap = {
        late: {
            label: 'Đi trễ',
            metricType: 'late'
        },
        missing: {
            label: 'Thiếu giờ điểm danh',
            metricType: 'missingTimeSlot'
        },
        absent: {
            label: 'Vắng mặt',
            metricType: 'absent'
        },
        sessions: {
            label: 'Tổng số buổi học',
            metricType: null // chưa có endpoint chi tiết riêng
        },
        locations: {
            label: 'Địa điểm',
            metricType: null // chưa có endpoint chi tiết riêng
        }
    };

    const openStatDetail = async (metricKey) => {
        if (!selectedStudent) return;
        const metricCfg = statMetricMap[metricKey];
        if (!metricCfg) return;

        // Với các metric chưa có endpoint chi tiết riêng, hiển thị thông báo
        if (!metricCfg.metricType) {
            setStatDetailModal({
                show: true,
                metric: metricCfg.label,
                data: [],
                loading: false,
                error: 'Chưa có dữ liệu chi tiết cho thống kê này.'
            });
            return;
        }

        setStatDetailModal({
            show: true,
            metric: metricCfg.label,
            data: [],
            loading: true,
            error: ''
        });

        try {
            const res = await api.get(`/dashboard/stats/${metricCfg.metricType}/${selectedStudent.id}`);
            if (res.data?.success) {
                setStatDetailModal(prev => ({
                    ...prev,
                    data: res.data.data || [],
                    loading: false
                }));
            } else {
                setStatDetailModal(prev => ({
                    ...prev,
                    loading: false,
                    error: res.data?.message || 'Không thể tải dữ liệu chi tiết.'
                }));
            }
        } catch (err) {
            console.error('Error fetching stat detail:', err);
            setStatDetailModal(prev => ({
                ...prev,
                loading: false,
                error: err.response?.data?.message || 'Không thể tải dữ liệu chi tiết.'
            }));
        }
    };

    const handleApproveUser = async (userId) => {
        try {
            setLoading(true);

            const response = await api.post(`/auth/approve-user/${userId}`);

            if (response.data.success) {
                fetchUsers();
            }
        } catch (error) {
            console.error('Error approving user:', error);
            setError(error.response?.data?.message || 'Không thể phê duyệt người dùng. Vui lòng thử lại sau.');
        } finally {
            setLoading(false);
        }
    };

    // Fetch user-specific MAC policy exceptions
    const fetchUserMacPolicyExceptions = async (userId) => {
        try {
            setMacPolicyLoading(true);

            const response = await api.get(`/mac-policies/user/${userId}`);

            if (response.data.success) {
                const { exceptions, effectivePolicies } = response.data.data;

                // If user has exceptions, use them, otherwise use effective policies
                if (exceptions) {
                    setUserMacPolicies({
                        allow_multiple_accounts_per_mac: exceptions.allow_multiple_accounts_per_mac,
                        allow_multiple_macs_per_account: exceptions.allow_multiple_macs_per_account
                    });
                } else {
                    // No exceptions exist yet, show effective policies
                    setUserMacPolicies({
                        allow_multiple_accounts_per_mac: effectivePolicies.allow_multiple_accounts_per_mac || false,
                        allow_multiple_macs_per_account: effectivePolicies.allow_multiple_macs_per_account || false
                    });
                }
            } else {
                showAlert('Không thể tải ngoại lệ chính sách MAC address của người dùng', 'danger');
            }
        } catch (error) {
            console.error('Error fetching user MAC policy exceptions:', error);
            showAlert('Không thể tải ngoại lệ chính sách MAC address của người dùng. Vui lòng thử lại sau.', 'danger');
        } finally {
            setMacPolicyLoading(false);
        }
    };

    // Set user-specific MAC policy exceptions
    const handleSetUserMacPolicyExceptions = async () => {
        try {
            setMacPolicyLoading(true);

            const response = await api.put(`/mac-policies/user/${selectedStudent.id}`, userMacPolicies);

            if (response.data.success) {
                showAlert('Cập nhật ngoại lệ chính sách MAC address thành công', 'success');
                setShowMacPolicyModal(false);
                // Refresh data to show updated values
                if (selectedStudent) {
                    fetchUserMacPolicyExceptions(selectedStudent.id);
                }
            } else {
                showAlert(response.data.message || 'Không thể cập nhật ngoại lệ chính sách MAC address', 'danger');
            }
        } catch (error) {
            console.error('Error setting user MAC policy exceptions:', error);

            // Handle specific error cases
            if (error.response && error.response.status === 400) {
                showAlert(error.response.data?.message || 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.', 'danger');
            } else if (error.response && error.response.status === 404) {
                showAlert('Không tìm thấy người dùng', 'danger');
            } else {
                showAlert('Không thể cập nhật ngoại lệ chính sách MAC address. Vui lòng thử lại sau.', 'danger');
            }
        } finally {
            setMacPolicyLoading(false);
        }
    };

    // Remove user-specific MAC policy exceptions
    const handleRemoveUserMacPolicyExceptions = async () => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa các ngoại lệ chính sách MAC address cho người dùng này?')) {
            return;
        }

        try {
            setMacPolicyLoading(true);

            const response = await api.delete(`/mac-policies/user/${selectedStudent.id}`);

            if (response.data.success) {
                showAlert('Xóa ngoại lệ chính sách MAC address thành công', 'success');
                setShowMacPolicyModal(false);
            } else {
                showAlert(response.data.message || 'Không thể xóa ngoại lệ chính sách MAC address', 'danger');
            }
        } catch (error) {
            // Handle 404 as success (no exceptions to delete)
            if (error.response && error.response.status === 404) {
                console.log('No MAC policy exceptions found for user - treating as success');
                showAlert('Không có ngoại lệ chính sách MAC address để xóa', 'success');
                setShowMacPolicyModal(false);
            } else {
                console.error('Error removing user MAC policy exceptions:', error);
                showAlert('Không thể xóa ngoại lệ chính sách MAC address. Vui lòng thử lại sau.', 'danger');
            }
        } finally {
            setMacPolicyLoading(false);
        }
    };

    // Open MAC policy modal and fetch current settings for user
    const openMacPolicyModal = (user) => {
        setSelectedStudent(user);
        fetchUserMacPolicyExceptions(user.id);
        setShowMacPolicyModal(true);
    };

    const handleSendCredentials = (student) => {
        if (!student.display_password) {
            setError('Vui lòng tạo mật khẩu trước khi gửi email');
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

    const handleBulkSendCredentials = () => {
        setShowBulkEmailModal(true);
        setBulkEmailTab('filter'); // Chuyển sang tab "Lọc theo tiêu chí" mặc định
        fetchAllStudents(); // Fetch tất cả sinh viên khi mở modal

        // Nếu đã có filter được chọn, fetch danh sách sinh viên từ API
        if (selectedClass || selectedFaculty || selectedMajor) {
            fetchFilteredStudentsForEmail();
        }
    };

    const handleBulkEmailConfirm = () => {
        setShowBulkEmailConfirmModal(true);
    };

    const sendBulkCredentialsEmail = async () => {
        setBulkEmailLoading(true);
        setShowBulkEmailConfirmModal(false); // Đóng confirmation modal
        setShowBulkEmailProgressModal(true); // Mở modal progress
        
        // Reset progress
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
                // Filter all students that have display_password
                filteredStudents = allStudents.filter(s => s.display_password);
            } else {
                // Sử dụng danh sách sinh viên đã fetch từ API
                filteredStudents = filteredStudentsForEmail.filter(s => s.display_password);

                // Nếu có checkbox được chọn, chỉ gửi đến những sinh viên đã chọn
                if (selectedStudentsForEmail.length > 0) {
                    filteredStudents = filteredStudents.filter(s => selectedStudentsForEmail.includes(s.id));
                }
            }

            if (filteredStudents.length === 0) {
                setError('Không có sinh viên nào có mật khẩu để gửi');
                setBulkEmailLoading(false);
                return;
            }

            // Always send student IDs to ensure we're sending to the correct students
            const requestData = {
                userIds: filteredStudents.map(s => s.id)
            };

            console.log('Sending bulk email request with data:', requestData);
            
            // Use SSE endpoint for progress updates with fetch API
            const token = localStorage.getItem('token');
            // Use the same base URL as the api object (from AuthContext)
            const baseURL = '/api';
            
            // Get CSRF token first
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
            
            // Add CSRF token if available
            if (csrfToken) {
                headers['x-csrf-token'] = csrfToken;
            }
            
            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                credentials: 'include', // Include cookies
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
                                console.log('SSE Progress:', data);
                                
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
                                    
                                    // Không đóng modal "Gửi thông tin đăng nhập hàng loạt", chỉ reset progress sau khi đóng modal progress
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
                                } else if (data.type === 'warning') {
                                    setBulkEmailProgress(prev => ({
                                        ...prev,
                                        message: data.message || 'Cảnh báo',
                                        errors: data.missingUsers || []
                                    }));
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

    // State for password confirmation modal
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [pendingRoleChange, setPendingRoleChange] = useState({ userId: null, newRole: '' });
    const [passwordModalAction, setPasswordModalAction] = useState('role_change'); // 'role_change' or 'module_roles'
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [passwordError, setPasswordError] = useState('');

    const handleChangeRole = async (userId, newRole) => {
        // Store the pending role change and show password modal
        setPendingRoleChange({ userId, newRole });
        setPasswordModalAction('role_change');
        setPasswordConfirm('');
        setPasswordError('');
        setShowPasswordModal(true);
    };

    // Legacy function - now uses confirmPasswordAction
    const confirmRoleChange = async () => {
        await confirmPasswordAction();
    };

    const handleFileChange = (e) => {
        setImportFile(e.target.files[0]);
        setImportErrors([]);
        setImportSuccess('');
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

                    // Validate data
                    const errors = [];
                    const validStudents = [];

                    jsonData.forEach((row, index) => {
                        // Lấy thông tin từ các cột mới trong mẫu Excel
                        let email = row['Email liên lạc'] || row.email || '';
                        const password = row.password || row['password'] || ''; // Empty password will trigger server-side generation
                        const fullName = row['Tên đầy đủ VB'] || row.fullName || '';
                        const studentId = row['Mã SV'] || '';

                        // Tự động tạo email nếu thiếu
                        if (!email) {
                            if (studentId) {
                                // Tạo email từ mã sinh viên
                                email = `${studentId.toLowerCase()}@example.com`;
                                console.log(`Dòng ${index + 2}: Tự động tạo email cho sinh viên: ${email}`);
                            } else if (fullName) {
                                // Tạo email từ tên sinh viên (loại bỏ dấu và khoảng trắng)
                                const normalizedName = fullName.toLowerCase()
                                    .normalize('NFD')
                                    .replace(/[\u0300-\u036f]/g, '')
                                    .replace(/\s+/g, '');
                                email = `${normalizedName}@example.com`;
                                console.log(`Dòng ${index + 2}: Tự động tạo email cho sinh viên: ${email}`);
                            } else {
                                // Tạo email ngẫu nhiên nếu không có thông tin
                                const randomString = Math.random().toString(36).substring(2, 10);
                                email = `student_${randomString}@example.com`;
                                console.log(`Dòng ${index + 2}: Tự động tạo email ngẫu nhiên: ${email}`);
                            }
                        }

                        // Kiểm tra và log tất cả các khóa trong đối tượng row để debug
                        console.log('Excel row keys:', Object.keys(row));

                        // Tìm khóa cho cột AV (Số điện thoại)
                        let phoneValue = '';

                        // Thử tìm cột AV bằng cách kiểm tra tất cả các khóa
                        Object.keys(row).forEach(key => {
                            // Kiểm tra xem khóa có phải là "Số điện thoại" hoặc "AV-Số điện thoại" hoặc có chứa "điện thoại" không
                            if (
                                key === 'Số điện thoại' ||
                                key === 'AV-Số điện thoại' ||
                                key === 'AV' ||
                                key.toLowerCase().includes('điện thoại') ||
                                key.toLowerCase().includes('phone')
                            ) {
                                phoneValue = row[key] || '';
                                console.log(`Tìm thấy số điện thoại ở khóa "${key}": ${phoneValue}`);
                            }
                        });

                        // Nếu không tìm thấy, thử tìm ở vị trí cột thứ 48 (0-based index)
                        if (!phoneValue && row[48]) {
                            phoneValue = row[48];
                            console.log(`Tìm thấy số điện thoại ở vị trí cột 48: ${phoneValue}`);
                        }

                        // Thêm tất cả các trường từ Excel vào đối tượng sinh viên
                        validStudents.push({
                            username: email, // Sử dụng email làm username
                            fullName: fullName,
                            email: email,
                            password: password,
                            role: 'student',
                            approved: true, // Auto-approve students
                            'Mã SV': row['Mã SV'] || '',
                            'Mã lớp': row['Mã lớp'] || '',
                            'Họ lót': row['Họ lót'] || '',
                            'Tên': row['Tên'] || '',
                            'Tên đầy đủ VB': fullName,
                            'Ngày sinh': row['Ngày sinh'] || '',
                            'Phái': row['Phái'] || '',
                            'Nơi sinh': row['Nơi sinh'] || '',
                            'Tên khoa': row['Tên khoa'] || '',
                            'Mã ngành': row['Mã ngành'] || '',
                            'Tên ngành': row['Tên ngành'] || '',
                            'Niên khóa': row['Niên khóa'] || '',
                            'Trạng thái': row['Trạng thái'] || '',
                            'Địa chỉ hộ khẩu': row['Địa chỉ hộ khẩu'] || '',
                            'Tên Tỉnh/TP': row['Tên Tỉnh/TP'] || '',
                            'Tên Quận/Huyện': row['Tên Quận/Huyện'] || '',
                            'Số CMND': row['Số CMND'] || '',
                            'Ngày cấp': row['Ngày cấp'] || '',
                            'ID SV text': row['ID SV text'] || studentId || '',
                            'Số điện thoại': phoneValue // Sử dụng giá trị đã tìm thấy
                        });
                    });

                    if (errors.length > 0) {
                        setImportErrors(errors);
                        setImportLoading(false);
                        return;
                    }

                    // Send to server in batches
                    try {
                        console.log('Sending data to server in batches:', validStudents.length);

                        // Process in batches of 50 students
                        const BATCH_SIZE = 50;
                        let totalImported = 0;
                        let allErrors = [];

                        // Initialize progress tracking
                        setImportTotal(validStudents.length);
                        setImportProgress(0);
                        setImportSuccess('Đang xử lý...');

                        // Process batches sequentially
                        for (let i = 0; i < validStudents.length; i += BATCH_SIZE) {
                            const batch = validStudents.slice(i, i + BATCH_SIZE);
                            const currentBatchSize = batch.length;
                            const startIndex = i + 1;
                            const endIndex = Math.min(i + BATCH_SIZE, validStudents.length);

                            setImportSuccess(`Đang xử lý ${startIndex} đến ${endIndex} / ${validStudents.length} sinh viên...`);

                            try {
                                const response = await api.post('/users/bulk-import', { users: batch });

                                if (response.data.success) {
                                    totalImported += response.data.imported;
                                    if (response.data.errors && response.data.errors.length > 0) {
                                        allErrors = [...allErrors, ...response.data.errors];
                                    }

                                    // If we have created users with passwords, update the students state immediately
                                    if (response.data.users && response.data.users.length > 0) {
                                        console.log(`Received ${response.data.users.length} users with passwords from server`);
                                        console.log('First user example:', response.data.users[0]);

                                        setStudents(prevStudents => {
                                            const newStudents = [...prevStudents];

                                            // Add new users that don't exist in the current state
                                            response.data.users.forEach(newUser => {
                                                const existingIndex = newStudents.findIndex(s => s.id === newUser.id);
                                                if (existingIndex >= 0) {
                                                    // Update existing user
                                                    newStudents[existingIndex] = {
                                                        ...newStudents[existingIndex],
                                                        ...newUser
                                                    };
                                                } else {
                                                    // Add new user
                                                    newStudents.push(newUser);
                                                }
                                            });

                                            return newStudents;
                                        });
                                    }

                                    // Update progress
                                    setImportProgress(prev => Math.min(prev + currentBatchSize, validStudents.length));
                                } else {
                                    allErrors.push(response.data.message || 'Lỗi không xác định');
                                    // Still update progress even if there was an error
                                    setImportProgress(prev => Math.min(prev + currentBatchSize, validStudents.length));
                                }
                            } catch (batchError) {
                                console.error(`Error processing batch ${i / BATCH_SIZE + 1}:`, batchError);
                                allErrors.push(`Lỗi xử lý lô ${i / BATCH_SIZE + 1}: ${batchError.message}`);
                                // Still update progress even if there was an error
                                setImportProgress(prev => Math.min(prev + currentBatchSize, validStudents.length));
                            }
                        }

                        // Final status update
                        setImportSuccess(`Đã nhập thành công ${totalImported} sinh viên`);
                        if (allErrors.length > 0) {
                            setImportErrors(allErrors);
                        } else {
                            setShowImportModal(false);
                        }
                        await fetchUsers(); // Wait for the fetch to complete
                    } catch (apiError) {
                        console.error('API error:', apiError);
                        setImportErrors([
                            `Lỗi kết nối đến server: ${apiError.message}`,
                            'Vui lòng kiểm tra kết nối mạng hoặc liên hệ quản trị viên'
                        ]);
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
            console.error('Error importing students:', error);
            setImportErrors([error.message || 'Lỗi không xác định']);
            setImportLoading(false);
        }
    };

    const handleExportStudents = async () => {
        try {
            setLoading(true);

            // Get all students
            const response = await api.get('/users/export?role=student');

            if (response.data.success) {
                const students = response.data.data;

                // Debug gender values
                console.log('Gender values in export:', students.map(s => ({
                    name: s.full_name,
                    gender: s.gender,
                    genderType: typeof s.gender
                })));

                // Create worksheet
                const worksheet = XLSX.utils.json_to_sheet(students.map(student => ({
                    'Mã SV': student.student_id || '',
                    'Họ lót': student.first_name || '',
                    'Tên': student.last_name || '',
                    'Họ và tên': student.full_name || '',
                    'Email': student.email || '',
                    'Mã lớp': student.class_name || '',
                    'Ngày sinh': student.birth_date ? new Date(student.birth_date).toLocaleDateString() : '',
                    'Phái': student.gender === null || student.gender === undefined ? 'Nam' :
                        student.gender === 'male' ? 'Nữ' :
                            student.gender === 'female' ? 'Nữ' :
                                student.gender === 'other' ? 'Khác' : '',
                    'Nơi sinh': student.birth_place || '',
                    'Tên khoa': student.faculty_name || '',
                    'Mã ngành': student.major_id || '',
                    'Tên ngành': student.major_name || '',
                    'Niên khóa': student.school_year || '',
                    'Trạng thái': student.approved ? 'Đã duyệt' : 'Chờ duyệt',
                    'Tình trạng': student.status || 'Đang học',
                    'Địa chỉ hộ khẩu': student.address || '',
                    'Tên Tỉnh/TP': student.province || '',
                    'Tên Quận/Huyện': student.district || '',
                    'Số CMND': student.id_number || '',
                    'Ngày cấp': student.id_issue_date ? new Date(student.id_issue_date).toLocaleDateString() : '',
                    'Số điện thoại': student.phone || ''
                })));

                // Create workbook
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');

                // Generate Excel file
                XLSX.writeFile(workbook, 'danh_sach_sinh_vien.xlsx');
            }
        } catch (error) {
            console.error('Error exporting students:', error);
            setError('Không thể xuất danh sách sinh viên. Vui lòng thử lại sau.');
        } finally {
            setLoading(false);
        }
    };

    const handleExportUsers = async () => {
        try {
            setLoading(true);

            // Get all users (staff and admin)
            const response = await api.get('/users/export?role=staff,admin');

            if (response.data.success) {
                const users = response.data.data;

                // Create worksheet
                const worksheet = XLSX.utils.json_to_sheet(users.map(user => ({
                    'Tên đăng nhập': user.username || '',
                    'Họ và tên': user.full_name || '',
                    'Email': user.email || '',
                    'Vai trò': user.role === 'staff' ? 'Nhân viên' :
                        user.role === 'admin' ? 'Quản trị viên' :
                            user.role === 'superadmin' ? 'Siêu quản trị viên' : user.role,
                    'Trạng thái': user.approved ? 'Đã duyệt' : 'Chờ duyệt',
                    'Ngày tạo': user.created_at ? new Date(user.created_at).toLocaleDateString() : '',
                    'Lần đăng nhập cuối': user.last_login ? new Date(user.last_login).toLocaleDateString() : ''
                })));

                // Create workbook
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');

                // Generate Excel file
                XLSX.writeFile(workbook, 'danh_sach_nguoi_dung.xlsx');

                showAlert('Xuất danh sách người dùng thành công!', 'success');
            }
        } catch (error) {
            console.error('Error exporting users:', error);
            setError('Không thể xuất danh sách người dùng. Vui lòng thử lại sau.');
        } finally {
            setLoading(false);
        }
    };

    // Xử lý xóa toàn bộ danh sách sinh viên
    const handleDeleteAllStudents = async () => {
        try {
            setLoading(true);

            const response = await api.delete('/users/students/all');

            if (response.data.success) {
                showAlert(response.data.message || 'Đã xóa toàn bộ danh sách sinh viên', 'success');
                fetchUsers();
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

    // Xử lý nhóm sinh viên
    const handleGroupFormChange = (e) => {
        const { name, value } = e.target;
        setGroupFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleClassSelectionChange = (e) => {
        const selectedClasses = Array.from(e.target.selectedOptions, option => option.value);
        setGroupFormData(prev => ({
            ...prev,
            selected_classes: selectedClasses
        }));

        // Fetch sinh viên theo lớp đã chọn
        if (selectedClasses.length > 0) {
            fetchStudentsByClasses(selectedClasses);
        } else {
            setStudentsByClasses([]);
        }
    };

    const handleStudentSelectionChange = (studentId, isSelected) => {
        setGroupFormData(prev => ({
            ...prev,
            student_ids: isSelected
                ? [...prev.student_ids, studentId]
                : prev.student_ids.filter(id => id !== studentId)
        }));
    };

    const handleCreateGroup = async (e) => {
        e.preventDefault();

        // Client-side validation
        if (!groupFormData.group_name.trim()) {
            setError('Vui lòng nhập tên nhóm');
            return;
        }

        if (!groupFormData.selected_classes || groupFormData.selected_classes.length === 0) {
            setError('Vui lòng chọn ít nhất một lớp');
            return;
        }

        try {
            setLoading(true);
            setError(''); // Clear any previous errors

            // Filter out any undefined or null student IDs
            const validStudentIds = groupFormData.student_ids.filter(id => id !== undefined && id !== null);

            const requestData = {
                ...groupFormData,
                student_ids: validStudentIds
            };

            console.log('Debug frontend - Sending data:', requestData);

            const response = await api.post('/student-groups', requestData);

            if (response.data.success) {
                showAlert('Tạo nhóm sinh viên thành công', 'success');
                setShowGroupModal(false);
                setGroupFormData({
                    group_name: '',
                    description: '',
                    selected_classes: [],
                    student_ids: []
                });
                setStudentsByClasses([]);
                fetchStudentGroups();
            } else {
                setError(response.data.message || 'Lỗi khi tạo nhóm sinh viên');
            }
        } catch (error) {
            console.error('Error creating group:', error);
            setError(error.response?.data?.message || 'Lỗi khi tạo nhóm sinh viên');
        } finally {
            setLoading(false);
        }
    };

    const handleEditGroup = async (group) => {
        try {
            setLoading(true);

            // Fetch chi tiết nhóm để lấy danh sách sinh viên
            const response = await api.get(`/student-groups/${group.id}`);

            if (response.data.success) {
                const groupDetails = response.data.data;
                const studentIds = groupDetails.students ? groupDetails.students.map(s => s.id) : [];

                console.log('Debug - Group details:', groupDetails);
                console.log('Debug - Student IDs from group:', studentIds);

                setSelectedGroup(groupDetails);
                setGroupFormData({
                    group_name: groupDetails.group_name,
                    description: groupDetails.description || '',
                    selected_classes: groupDetails.selected_classes || [],
                    student_ids: studentIds
                });

                // Fetch sinh viên theo lớp đã chọn
                if (groupDetails.selected_classes && groupDetails.selected_classes.length > 0) {
                    await fetchStudentsByClasses(groupDetails.selected_classes);
                }

                setShowGroupModal(true);
            } else {
                setError('Lỗi khi tải thông tin nhóm sinh viên');
            }
        } catch (error) {
            console.error('Error fetching group details:', error);
            setError('Lỗi khi tải thông tin nhóm sinh viên');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateGroup = async (e) => {
        e.preventDefault();

        // Client-side validation
        if (!groupFormData.group_name.trim()) {
            setError('Vui lòng nhập tên nhóm');
            return;
        }

        if (!groupFormData.selected_classes || groupFormData.selected_classes.length === 0) {
            setError('Vui lòng chọn ít nhất một lớp');
            return;
        }

        try {
            setLoading(true);
            setError(''); // Clear any previous errors

            // Filter out any undefined or null student IDs
            const validStudentIds = groupFormData.student_ids.filter(id => id !== undefined && id !== null);

            const requestData = {
                ...groupFormData,
                student_ids: validStudentIds
            };

            console.log('Debug frontend - Updating with data:', requestData);

            const response = await api.put(`/student-groups/${selectedGroup.id}`, requestData);

            if (response.data.success) {
                showAlert('Cập nhật nhóm sinh viên thành công', 'success');
                setShowGroupModal(false);
                setSelectedGroup(null);
                setGroupFormData({
                    group_name: '',
                    description: '',
                    selected_classes: [],
                    student_ids: []
                });
                setStudentsByClasses([]);
                fetchStudentGroups();
            } else {
                setError(response.data.message || 'Lỗi khi cập nhật nhóm sinh viên');
            }
        } catch (error) {
            console.error('Error updating group:', error);
            setError(error.response?.data?.message || 'Lỗi khi cập nhật nhóm sinh viên');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteGroup = async () => {
        if (!groupToDelete) return;

        try {
            setLoading(true);

            const response = await api.delete(`/student-groups/${groupToDelete.id}`);

            if (response.data.success) {
                showAlert('Xóa nhóm sinh viên thành công', 'success');
                setShowDeleteGroupModal(false);
                setGroupToDelete(null);
                fetchStudentGroups();
            } else {
                setError(response.data.message || 'Lỗi khi xóa nhóm sinh viên');
            }
        } catch (error) {
            console.error('Error deleting group:', error);
            setError(error.response?.data?.message || 'Lỗi khi xóa nhóm sinh viên');
        } finally {
            setLoading(false);
        }
    };

    const handleViewGroupDetails = async (group) => {
        try {
            setLoading(true);
            const response = await api.get(`/student-groups/${group.id}`);

            if (response.data.success) {
                setSelectedGroup(response.data.data);
                setShowGroupDetailModal(true);
            } else {
                setError(response.data.message || 'Lỗi khi tải thông tin nhóm');
            }
        } catch (error) {
            console.error('Error fetching group details:', error);
            setError(error.response?.data?.message || 'Lỗi khi tải thông tin nhóm');
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

    const handleEditInputChange = (e) => {
        const { name, value } = e.target;
        setEditFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleEditUser = (user) => {
        setUserToEdit(user);
        setOriginalRole(user.role);
        setEditFormData({
            username: user.username,
            email: user.email,
            fullName: user.full_name,
            password: '',
            role: user.role,
            module_roles: user.module_roles || [], // Include module roles
            // Additional fields for students
            student_id: user.student_id || '',
            class_name: user.class_name || '',
            faculty_name: user.faculty_name || '',
            major_name: user.major_name || '',
            birth_date: user.birth_date ? new Date(user.birth_date).toISOString().split('T')[0] : '',
            gender: user.gender !== undefined && user.gender !== null ? user.gender.toString() : '',
            address: user.address || '',
            id_number: user.id_number || '',
            status: user.status || 'Đang học',
            phone: user.phone || '',
            device_mac: user.device_mac || ''
        });
        setShowPasswordField(false);
        setShowEditModal(true);
    };

    // Open module roles modal
    const handleOpenModuleRolesModal = async (user) => {
        setSelectedUserForModuleRoles(user);

        // Fetch fresh user data to ensure we have the latest module_roles
        try {
            const userResponse = await api.get(`/users/${user.id}`);
            if (userResponse.data.success && userResponse.data.data) {
                const freshUser = userResponse.data.data;
                setSelectedUserForModuleRoles(freshUser);

                // Initialize module roles state from user's module_roles
                const existingRoles = freshUser.module_roles || [];
                const rolesState = {};

                // Parse existing roles into state object
                Object.keys(moduleRolesConfig).forEach(module => {
                    moduleRolesConfig[module].forEach(roleType => {
                        const roleKey = `${module}_${roleType}`;
                        rolesState[roleKey] = existingRoles.includes(roleKey);
                    });
                });

                setUserModuleRoles(rolesState);
                setShowModuleRolesModal(true);
            } else {
                // Fallback to using the user passed in
                const existingRoles = user.module_roles || [];
                const rolesState = {};
                Object.keys(moduleRolesConfig).forEach(module => {
                    moduleRolesConfig[module].forEach(roleType => {
                        const roleKey = `${module}_${roleType}`;
                        rolesState[roleKey] = existingRoles.includes(roleKey);
                    });
                });
                setUserModuleRoles(rolesState);
                setShowModuleRolesModal(true);
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
            // Fallback to using the user passed in
            const existingRoles = user.module_roles || [];
            const rolesState = {};
            Object.keys(moduleRolesConfig).forEach(module => {
                moduleRolesConfig[module].forEach(roleType => {
                    const roleKey = `${module}_${roleType}`;
                    rolesState[roleKey] = existingRoles.includes(roleKey);
                });
            });
            setUserModuleRoles(rolesState);
            setShowModuleRolesModal(true);
        }
    };

    // Toggle module role - only one role per module, but can uncheck
    const handleToggleModuleRole = (module, roleType) => {
        const roleKey = `${module}_${roleType}`;
        setUserModuleRoles(prev => {
            // Create new state object
            const newState = { ...prev };
            const currentlyChecked = prev[roleKey] || false;

            if (currentlyChecked) {
                // If this role is already checked, uncheck it
                newState[roleKey] = false;
            } else {
                // If this role is not checked, uncheck all roles in this module first
                moduleRolesConfig[module].forEach(rt => {
                    const key = `${module}_${rt}`;
                    newState[key] = false;
                });
                // Then check the selected role
                newState[roleKey] = true;
            }

            return newState;
        });
    };

    // Save module roles - show password confirmation first
    const handleSaveModuleRoles = () => {
        if (!selectedUserForModuleRoles) return;

        // Show password confirmation modal
        setPasswordModalAction('module_roles');
        setPasswordConfirm('');
        setPasswordError('');
        setShowPasswordModal(true);
    };

    // Perform module roles save after password confirmation
    const performModuleRolesSave = async () => {
        if (!selectedUserForModuleRoles) return;

        try {
            setLoading(true);

            // Build array of selected roles
            const selectedRoles = [];
            Object.keys(userModuleRoles).forEach(roleKey => {
                if (userModuleRoles[roleKey]) {
                    selectedRoles.push(roleKey);
                }
            });

            // Update user's module roles
            const response = await api.put(`/users/${selectedUserForModuleRoles.id}`, {
                module_roles: selectedRoles
            });

            if (response.data.success) {
                showAlert('Cập nhật quyền module thành công', 'success');

                // Update selectedUserForModuleRoles with new module_roles from response
                if (response.data.data && response.data.data.module_roles) {
                    const updatedUser = {
                        ...selectedUserForModuleRoles,
                        module_roles: response.data.data.module_roles
                    };
                    setSelectedUserForModuleRoles(updatedUser);

                    // Update userModuleRoles state to reflect saved values
                    const rolesState = {};
                    Object.keys(moduleRolesConfig).forEach(module => {
                        moduleRolesConfig[module].forEach(roleType => {
                            const roleKey = `${module}_${roleType}`;
                            rolesState[roleKey] = response.data.data.module_roles.includes(roleKey);
                        });
                    });
                    setUserModuleRoles(rolesState);
                }

                setShowPasswordModal(false);
                setPasswordConfirm('');
                fetchUsers(); // Refresh user list
                // Don't close the modal - keep it open to show updated state
            } else {
                setError(response.data.message || 'Không thể cập nhật quyền module');
            }
        } catch (error) {
            console.error('Error saving module roles:', error);
            setError(error.response?.data?.message || 'Không thể cập nhật quyền module. Vui lòng thử lại sau.');
        } finally {
            setLoading(false);
        }
    };

    // Confirm password action - handles both role change and module roles save
    const confirmPasswordAction = async () => {
        if (!passwordConfirm) {
            setPasswordError('Vui lòng nhập mật khẩu');
            return;
        }

        try {
            setPasswordLoading(true);
            setPasswordError('');

            // First verify the password
            const verifyResponse = await api.post('/auth/verify-password', { password: passwordConfirm });

            if (verifyResponse.data.success) {
                // Password is correct, proceed with the action
                if (passwordModalAction === 'role_change') {
                    await performUserUpdate();
                } else if (passwordModalAction === 'module_roles') {
                    await performModuleRolesSave();
                }
                setPasswordConfirm('');
            } else {
                setPasswordError('Mật khẩu không đúng');
            }
        } catch (error) {
            console.error('Error in password confirmation process:', error);
            if (passwordModalAction === 'role_change') {
                setPasswordError(error.response?.data?.message || 'Không thể thay đổi vai trò người dùng. Vui lòng thử lại sau.');
            } else {
                setPasswordError(error.response?.data?.message || 'Không thể cập nhật quyền module. Vui lòng thử lại sau.');
            }
        } finally {
            setPasswordLoading(false);
        }
    };

    const handleUpdateUser = async (e) => {
        e.preventDefault();

        // Prevent double submission
        if (loading) {
            console.log('Update already in progress, ignoring duplicate call');
            return;
        }

        // Check if role has changed
        if (editFormData.role !== originalRole) {
            // Show password confirmation modal (keep edit modal open)
            setPasswordModalAction('role_change');
            setPasswordConfirm('');
            setPasswordError('');
            setShowPasswordModal(true);
            return;
        }

        // If role hasn't changed, proceed with normal update
        await performUserUpdate();
    };

    const performUserUpdate = async () => {
        try {
            setLoading(true);
            setError('');

            const userData = {
                username: editFormData.username,
                email: editFormData.email,
                fullName: editFormData.fullName,
                role: editFormData.role // Include role in update
            };

            // Add additional fields for students
            // Use editFormData.role to check if user is student (could have changed)
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

            // Only include password if it was changed
            if (showPasswordField && editFormData.password) {
                userData.password = editFormData.password;
            }

            const response = await api.put(`/users/${userToEdit.id}`, userData);

            if (response.data.success) {
                setShowEditModal(false);
                setShowPasswordModal(false);
                fetchUsers();
                showAlert('Cập nhật thông tin người dùng thành công', 'success');
            }
        } catch (error) {
            console.error('Error updating user:', error);
            setError(error.response?.data?.message || 'Không thể cập nhật thông tin người dùng. Vui lòng thử lại sau.');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        // Search will be handled by useEffect when searchTerm changes
    };

    const handleFilterChange = (filterType, value) => {
        // Update filter state based on type
        switch (filterType) {
            case 'class':
                setClassFilter(value);
                break;
            case 'faculty':
                setFacultyFilter(value);
                break;
            case 'major':
                setMajorFilter(value);
                break;
            case 'status':
                setStatusFilter(value);
                break;
            default:
                break;
        }

        // We don't need to call fetchUsers() manually here
        // The useEffect hook will handle fetching when the filter states change
    };

    // Handle sorting when clicking on column headers
    const handleSort = (field) => {
        // If clicking the same field, toggle the sort order
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            // If clicking a new field, set it as the sort field and default to ascending order
            setSortField(field);
            setSortOrder('asc');
        }
    };


    const renderStudentsTab = () => {
        // Kiểm tra isMobile trực tiếp từ window.innerWidth để tránh lỗi state
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
                                <option key={index} value={status}>
                                    {status} {statusStudentCounts[status] ? `(${statusStudentCounts[status]})` : ''}
                                </option>
                            ))}
                        </select>

                        <Button variant="primary" onClick={handleSearch} className="filter-btn">
                            Tìm kiếm
                        </Button>

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
                                    <th className="mobile-essential">Nhóm</th>
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
                                        .slice((pagination.page - 1) * pagination.limit, pagination.page * pagination.limit)
                                        .map((student, index) => (
                                            <tr key={student.id} onClick={() => handleStudentRowClick(student)} style={{ cursor: 'pointer' }}>
                                                <td className={currentIsMobile ? "mobile-essential" : "mobile-hide"}>
                                                    {index + 1}
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
                                                        <div>
                                                            <span
                                                                onClick={() => togglePasswordVisibility(student.id)}
                                                                style={{ cursor: 'pointer' }}
                                                                title={visiblePasswords[student.id] ? "Ẩn mật khẩu" : "Hiển thị mật khẩu"}
                                                            >
                                                                {visiblePasswords[student.id] ? student.display_password : "••••••••"}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted">Đang tạo...</span>
                                                    )}
                                                </td>
                                                <td className="mobile-essential">{student.class_name || '-'}</td>
                                                <td className="mobile-essential">
                                                    {student.group_names ? (
                                                        <div>
                                                            {student.group_names.split(', ').map((groupName, idx) => (
                                                                <Badge key={idx} bg="info" className="me-1 mb-1">
                                                                    {groupName}
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    ) : '-'}
                                                </td>
                                                <td className="mobile-essential">{student.faculty_name || '-'}</td>
                                                <td className="mobile-essential">{student.birth_date ? new Date(student.birth_date).toLocaleDateString() : '-'}</td>
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
                                        <td colSpan="16" className="text-center">
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

    const renderStudentGroupsTab = () => {
        // Kiểm tra isMobile trực tiếp từ window.innerWidth để tránh lỗi state
        const currentIsMobile = window.innerWidth <= 768;

        return (
            <>
                {/* Search Controls */}
                <div className="session-list-controls">
                    <div className="search-controls">
                        <div className="search-input">
                            <input
                                type="text"
                                placeholder="Tìm kiếm nhóm sinh viên..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="search-input"
                            />
                        </div>
                    </div>
                </div>

                {/* Student Groups Table */}
                <div className="session-table-container">
                    <div className="table-responsive-mobile">
                        <table className="session-table students-table">
                            <thead>
                                <tr>
                                    <th className={currentIsMobile ? "mobile-essential" : "mobile-hide"}>#</th>
                                    <th className="mobile-essential">Tên nhóm</th>
                                    <th className="mobile-essential">Mô tả</th>
                                    <th className="mobile-essential">Lớp</th>
                                    <th className="mobile-essential">Số sinh viên</th>
                                    <th className="mobile-essential">Ngày tạo</th>
                                    <th className="mobile-essential">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {studentGroups.length > 0 ? (
                                    studentGroups
                                        .slice((pagination.page - 1) * pagination.limit, pagination.page * pagination.limit)
                                        .map((group, index) => (
                                            <tr
                                                key={group.id}
                                                onClick={() => handleViewGroupDetails(group)}
                                                style={{ cursor: 'pointer' }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
                                            >
                                                <td className={currentIsMobile ? "mobile-essential" : "mobile-hide"}>
                                                    {index + 1}
                                                </td>
                                                <td className="mobile-essential">
                                                    <div className="fw-bold">{group.group_name}</div>
                                                </td>
                                                <td className="mobile-essential">
                                                    <div className="text-muted">
                                                        {group.description ? (
                                                            group.description.length > 50 ?
                                                                `${group.description.substring(0, 50)}...` :
                                                                group.description
                                                        ) : '-'}
                                                    </div>
                                                </td>
                                                <td className="mobile-essential">
                                                    <div>
                                                        {(() => {
                                                            // Hiển thị các lớp thực tế của sinh viên trong nhóm
                                                            const actualClasses = group.actual_classes || [];
                                                            return actualClasses && actualClasses.length > 0 ? (
                                                                <div>
                                                                    {actualClasses.map((className, idx) => (
                                                                        <Badge key={idx} bg="success" className="me-1 mb-1">
                                                                            {className}
                                                                        </Badge>
                                                                    ))}
                                                                </div>
                                                            ) : '-';
                                                        })()}
                                                    </div>
                                                </td>
                                                <td className="mobile-essential">
                                                    <Badge bg="primary">{group.student_count || 0}</Badge>
                                                </td>
                                                <td className="mobile-essential">
                                                    {group.created_at ? new Date(group.created_at).toLocaleDateString('vi-VN') : '-'}
                                                </td>
                                                <td className="mobile-essential">
                                                    <div className="action-buttons" onClick={(e) => e.stopPropagation()}>
                                                        <Dropdown className="action-dropdown">
                                                            <Dropdown.Toggle variant="light" size="sm" className="btn-icon" id={`dropdown-group-${group.id}`}>
                                                                <i className="fas fa-ellipsis-v"></i>
                                                            </Dropdown.Toggle>
                                                            <Dropdown.Menu popperConfig={{ strategy: 'fixed' }}>
                                                                <Dropdown.Item onClick={() => handleViewGroupDetails(group)}>
                                                                    <i className="fas fa-eye me-2 text-info"></i>Xem chi tiết
                                                                </Dropdown.Item>
                                                                <Dropdown.Item onClick={() => handleEditGroup(group)}>
                                                                    <i className="fas fa-edit me-2 text-primary"></i>Chỉnh sửa
                                                                </Dropdown.Item>
                                                                <Dropdown.Item
                                                                    onClick={() => {
                                                                        setGroupToDelete(group);
                                                                        setShowDeleteGroupModal(true);
                                                                    }}
                                                                >
                                                                    <i className="fas fa-trash me-2 text-danger"></i>Xóa
                                                                </Dropdown.Item>
                                                            </Dropdown.Menu>
                                                        </Dropdown>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                ) : (
                                    <tr>
                                        <td colSpan="7" className="text-center">
                                            {loading ? (
                                                <Spinner animation="border" size="sm" />
                                            ) : (
                                                'Không có nhóm sinh viên nào'
                                            )}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {studentGroups.length > 0 && pagination.totalPages > 1 && (
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

    // Request face update (force - delete old)
    const handleRequestFaceUpdate = async () => {
        if (!selectedUserForUpdate) return;

        try {
            setLoading(true);
            const response = await api.post(`/face-management/request-update/${selectedUserForUpdate.id}`, {
                notes: updateRequestNotes
            });

            if (response.data.success) {
                showAlert('Yêu cầu cập nhật face embedding đã được gửi thành công', 'success');
                setShowRequestUpdateModal(false);
                setSelectedUserForUpdate(null);
                setUpdateRequestNotes('');
                // Refresh list immediately (not silent)
                fetchFaceUsers(false);
            } else {
                setError(response.data.message || 'Lỗi khi gửi yêu cầu cập nhật');
            }
        } catch (error) {
            console.error('Error requesting face update:', error);
            setError(error.response?.data?.message || 'Lỗi khi gửi yêu cầu cập nhật face embedding');
        } finally {
            setLoading(false);
        }
    };

    // Allow face update (allow - just permit without deleting old)
    const handleAllowFaceUpdate = async () => {
        if (!selectedUserForUpdate) return;

        try {
            setLoading(true);
            const response = await api.post(`/face-management/allow-update/${selectedUserForUpdate.id}`, {
                notes: updateRequestNotes
            });

            if (response.data.success) {
                showAlert('Đã cho phép người dùng cập nhật face embedding', 'success');
                setShowAllowUpdateModal(false);
                setSelectedUserForUpdate(null);
                setUpdateRequestNotes('');
                // Refresh list immediately (not silent)
                fetchFaceUsers(false);
            } else {
                setError(response.data.message || 'Lỗi khi cho phép cập nhật');
            }
        } catch (error) {
            console.error('Error allowing face update:', error);
            setError(error.response?.data?.message || 'Lỗi khi cho phép cập nhật face embedding');
        } finally {
            setLoading(false);
        }
    };

    // Revoke face update permission (cancel allow request)
    const handleRevokeFaceUpdate = async () => {
        if (!selectedUserForRevoke) return;

        try {
            setLoading(true);
            // Get pending request for this user
            const pendingRequestResponse = await api.get(`/face-management/pending-request/${selectedUserForRevoke.id}`);
            
            if (!pendingRequestResponse.data.success || !pendingRequestResponse.data.data) {
                setError('Không tìm thấy yêu cầu cập nhật cho người dùng này');
                return;
            }

            const userRequest = pendingRequestResponse.data.data;
            
            if (userRequest.update_type !== 'allow') {
                setError('Chỉ có thể thu hồi quyền cập nhật loại "Cho phép cập nhật"');
                return;
            }

            const response = await api.post(`/face-management/cancel-request/${userRequest.id}`);

            if (response.data.success) {
                showAlert('Đã thu hồi quyền cập nhật face embedding', 'success');
                setShowRevokeModal(false);
                setSelectedUserForRevoke(null);
                // Refresh list immediately (not silent)
                fetchFaceUsers(false);
            } else {
                setError(response.data.message || 'Lỗi khi thu hồi quyền cập nhật');
            }
        } catch (error) {
            console.error('Error revoking face update:', error);
            setError(error.response?.data?.message || 'Lỗi khi thu hồi quyền cập nhật face embedding');
        } finally {
            setLoading(false);
        }
    };

    // Approve user-initiated face reset request
    const handleApproveUserRequest = async () => {
        if (!selectedUserForUpdate) return;

        try {
            setLoading(true);
            // Get pending request for this user
            const pendingRequestResponse = await api.get(`/face-management/pending-request/${selectedUserForUpdate.id}`);
            
            if (!pendingRequestResponse.data.success || !pendingRequestResponse.data.data) {
                setError('Không tìm thấy yêu cầu cập nhật cho người dùng này');
                return;
            }

            const userRequest = pendingRequestResponse.data.data;
            
            if (userRequest.update_type !== 'user_request') {
                setError('Yêu cầu này không phải là yêu cầu từ người dùng');
                return;
            }

            // First, cancel the user_request
            await api.post(`/face-management/cancel-request/${userRequest.id}`);

            // Then create a force update request (which deletes old face embedding)
            const response = await api.post(`/face-management/request-update/${selectedUserForUpdate.id}`, {
                notes: 'Chấp nhận yêu cầu đặt lại từ người dùng'
            });

            if (response.data.success) {
                showAlert('Đã chấp nhận yêu cầu đặt lại khuôn mặt. Face embedding cũ đã bị xóa, người dùng có thể đăng ký lại.', 'success');
                setShowApproveUserRequestModal(false);
                setSelectedUserForUpdate(null);
                // Refresh list immediately
                fetchFaceUsers(false);
            } else {
                setError(response.data.message || 'Lỗi khi chấp nhận yêu cầu');
            }
        } catch (error) {
            console.error('Error approving user request:', error);
            setError(error.response?.data?.message || 'Lỗi khi chấp nhận yêu cầu đặt lại khuôn mặt');
        } finally {
            setLoading(false);
        }
    };

    // Reject user-initiated face reset request
    const handleRejectUserRequest = async () => {
        if (!selectedUserForRevoke) return;

        try {
            setLoading(true);
            // Get pending request for this user
            const pendingRequestResponse = await api.get(`/face-management/pending-request/${selectedUserForRevoke.id}`);
            
            if (!pendingRequestResponse.data.success || !pendingRequestResponse.data.data) {
                setError('Không tìm thấy yêu cầu cập nhật cho người dùng này');
                return;
            }

            const userRequest = pendingRequestResponse.data.data;
            
            if (userRequest.update_type !== 'user_request') {
                setError('Yêu cầu này không phải là yêu cầu từ người dùng');
                return;
            }

            // Cancel the request
            const response = await api.post(`/face-management/cancel-request/${userRequest.id}`);

            if (response.data.success) {
                showAlert('Đã từ chối yêu cầu đặt lại khuôn mặt', 'success');
                setShowRejectUserRequestModal(false);
                setSelectedUserForRevoke(null);
                // Refresh list immediately
                fetchFaceUsers(false);
            } else {
                setError(response.data.message || 'Lỗi khi từ chối yêu cầu');
            }
        } catch (error) {
            console.error('Error rejecting user request:', error);
            setError(error.response?.data?.message || 'Lỗi khi từ chối yêu cầu đặt lại khuôn mặt');
        } finally {
            setLoading(false);
        }
    };

    // Fetch face verification students
    const fetchFaceVerificationStudents = async () => {
        try {
            let url = `/users?role=student&page=1&limit=1000`;
            
            if (faceVerificationClassFilter) {
                url += `&class_name=${encodeURIComponent(faceVerificationClassFilter)}`;
            }
            if (faceVerificationFacultyFilter) {
                url += `&faculty_name=${encodeURIComponent(faceVerificationFacultyFilter)}`;
            }
            if (faceVerificationMajorFilter) {
                url += `&major_name=${encodeURIComponent(faceVerificationMajorFilter)}`;
            }
            if (faceVerificationStatusFilter) {
                url += `&status=${encodeURIComponent(faceVerificationStatusFilter)}`;
            }
            
            const response = await api.get(url);
            if (response.data.success) {
                setFaceVerificationStudents(response.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching face verification students:', error);
            setFaceVerificationStudents([]);
        }
    };
    
    // Fetch face verification filter options
    const fetchFaceVerificationFilterOptions = async () => {
        try {
            const response = await api.get('/users/filter-options');
            if (response.data.success) {
                setFaceVerificationClasses(response.data.classes?.map(c => c.name) || []);
                setFaceVerificationFaculties(response.data.faculties?.map(f => f.name) || []);
                setFaceVerificationMajors(response.data.majors?.map(m => m.name) || []);
            }
        } catch (error) {
            console.error('Error fetching face verification filter options:', error);
        }
    };
    
    // Fetch face verification student groups
    const fetchFaceVerificationStudentGroups = async () => {
        try {
            const response = await api.get('/student-groups');
            if (response.data && response.data.success) {
                setFaceVerificationStudentGroups(response.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching face verification student groups:', error);
            setFaceVerificationStudentGroups([]);
        }
    };
    
    // Fetch students by group for face verification
    const fetchFaceVerificationStudentsByGroup = async () => {
        try {
            const response = await api.get(`/student-groups/${faceVerificationGroupFilter}`);
            if (response.data && response.data.success) {
                const groupStudents = response.data.data.students || [];
                setFaceVerificationStudents(groupStudents);
            }
        } catch (error) {
            console.error('Error fetching face verification students by group:', error);
            setFaceVerificationStudents([]);
        }
    };
    
    // Fetch face recognition settings
    const fetchFaceSettings = async () => {
        try {
            const response = await api.get('/face-recognition-settings');
            if (response.data.success) {
                const settings = response.data.data;
                setFaceSettings(settings);
                
                // Helper function to extract value from setting object or use directly
                const getSettingValue = (setting) => {
                    if (!setting) return [];
                    if (Array.isArray(setting)) return setting;
                    if (typeof setting === 'object' && setting.value !== undefined) {
                        // If it's an object with value property, extract it
                        return Array.isArray(setting.value) ? setting.value : [];
                    }
                    // Try to parse if it's a string
                    if (typeof setting === 'string') {
                        try {
                            const parsed = JSON.parse(setting);
                            return Array.isArray(parsed) ? parsed : [];
                        } catch (e) {
                            return [];
                        }
                    }
                    return [];
                };
                
                // Load exempt and allowed students/classes/groups if they exist
                const exemptStudentsValue = getSettingValue(settings.exempt_students);
                if (exemptStudentsValue.length > 0) {
                    setExemptStudentIds(exemptStudentsValue);
                } else {
                    setExemptStudentIds([]);
                }
                
                const exemptClassesValue = getSettingValue(settings.exempt_classes);
                setExemptClasses(Array.isArray(exemptClassesValue) ? exemptClassesValue : []);
                
                const exemptGroupsValue = getSettingValue(settings.exempt_groups);
                if (exemptGroupsValue.length > 0) {
                    setExemptGroups(exemptGroupsValue);
                } else {
                    setExemptGroups([]);
                }
                
                const allowedStudentsValue = getSettingValue(settings.allowed_students);
                if (allowedStudentsValue.length > 0) {
                    setAllowedStudentIds(allowedStudentsValue);
                } else {
                    setAllowedStudentIds([]);
                }
                
                const allowedClassesValue = getSettingValue(settings.allowed_classes);
                setAllowedClasses(Array.isArray(allowedClassesValue) ? allowedClassesValue : []);
                
                const allowedGroupsValue = getSettingValue(settings.allowed_groups);
                if (allowedGroupsValue.length > 0) {
                    setAllowedGroups(allowedGroupsValue);
                } else {
                    setAllowedGroups([]);
                }
            }
        } catch (error) {
            console.error('Error fetching face settings:', error);
            showAlert('Lỗi khi tải cài đặt: ' + (error.response?.data?.error || error.message), 'danger');
        }
    };

    // Save face recognition settings
    const saveFaceSettings = async () => {
        setFaceSettingsLoading(true);
        try {
            const settingsToSave = {};
            Object.keys(faceSettings).forEach(key => {
                settingsToSave[key] = faceSettings[key].value;
            });
            
            // Add exempt and allowed students/classes/groups
            settingsToSave.exempt_students = exemptStudents.map(s => {
                if (typeof s === 'object' && s !== null && s.id) {
                    return s.id;
                }
                return s;
            });
            settingsToSave.exempt_classes = exemptClasses;
            settingsToSave.exempt_groups = exemptGroups.map(g => {
                if (typeof g === 'object' && g !== null && g.id) {
                    return g.id;
                }
                return g;
            });
            settingsToSave.allowed_students = allowedStudents.map(s => {
                if (typeof s === 'object' && s !== null && s.id) {
                    return s.id;
                }
                return s;
            });
            settingsToSave.allowed_classes = allowedClasses;
            settingsToSave.allowed_groups = allowedGroups.map(g => {
                if (typeof g === 'object' && g !== null && g.id) {
                    return g.id;
                }
                return g;
            });
            
            const response = await api.put('/face-recognition-settings', { settings: settingsToSave });
            if (response.data.success) {
                showAlert('Đã lưu cài đặt xác minh khuôn mặt thành công', 'success');
                setShowFaceSettingsModal(false);
            }
        } catch (error) {
            console.error('Error saving face settings:', error);
            showAlert('Lỗi khi lưu cài đặt: ' + (error.response?.data?.error || error.message), 'danger');
        } finally {
            setFaceSettingsLoading(false);
        }
    };

    // Load settings when face management tab is opened
    useEffect(() => {
        if (activeTab === 'face-management') {
            fetchFaceSettings();
        }
    }, [activeTab]);
    
    // Fetch face verification data when modal opens
    useEffect(() => {
        if (showFaceSettingsModal) {
            fetchFaceVerificationFilterOptions();
            fetchFaceVerificationStudentGroups();
            fetchFaceVerificationStudents();
        }
    }, [showFaceSettingsModal]);
    
    // Store exempt and allowed student IDs separately
    const [exemptStudentIds, setExemptStudentIds] = useState([]);
    const [allowedStudentIds, setAllowedStudentIds] = useState([]);
    
    // Fetch students when filters change
    useEffect(() => {
        if (showFaceSettingsModal) {
            if (faceVerificationUseGroupMode && faceVerificationGroupFilter) {
                fetchFaceVerificationStudentsByGroup();
            } else {
                fetchFaceVerificationStudents();
            }
        }
    }, [showFaceSettingsModal, faceVerificationClassFilter, faceVerificationFacultyFilter, faceVerificationMajorFilter, faceVerificationStatusFilter, faceVerificationGroupFilter, faceVerificationUseGroupMode]);
    
    // Match student IDs to student objects when students are loaded
    useEffect(() => {
        if (showFaceSettingsModal && faceVerificationStudents.length > 0) {
            // Match exempt students
            if (exemptStudentIds.length > 0) {
                const matchedExempt = faceVerificationStudents.filter(s => exemptStudentIds.includes(s.id));
                if (matchedExempt.length !== exemptStudents.length || 
                    !matchedExempt.every((s, i) => exemptStudents[i]?.id === s.id)) {
                    setExemptStudents(matchedExempt);
                }
            }
            // Match allowed students
            if (allowedStudentIds.length > 0) {
                const matchedAllowed = faceVerificationStudents.filter(s => allowedStudentIds.includes(s.id));
                if (matchedAllowed.length !== allowedStudents.length || 
                    !matchedAllowed.every((s, i) => allowedStudents[i]?.id === s.id)) {
                    setAllowedStudents(matchedAllowed);
                }
            }
        }
    }, [showFaceSettingsModal, faceVerificationStudents, exemptStudentIds, allowedStudentIds]);
    
    // Match group IDs to group objects when groups are loaded
    useEffect(() => {
        if (showFaceSettingsModal && faceVerificationStudentGroups.length > 0) {
            // Match exempt groups
            if (exemptGroups.length > 0) {
                // Check if first item is a number (ID) or object
                const firstItem = exemptGroups[0];
                if (typeof firstItem === 'number' || (typeof firstItem === 'object' && firstItem !== null && typeof firstItem.id === 'number')) {
                    const exemptGroupIds = exemptGroups.map(g => typeof g === 'number' ? g : (g.id || g));
                    const matchedExemptGroups = faceVerificationStudentGroups.filter(g => exemptGroupIds.includes(g.id));
                    if (matchedExemptGroups.length > 0) {
                        setExemptGroups(matchedExemptGroups);
                    } else if (exemptGroups.length > 0 && typeof exemptGroups[0] === 'number') {
                        // If no matches but we have IDs, keep empty array
                        setExemptGroups([]);
                    }
                }
            }
            // Match allowed groups
            if (allowedGroups.length > 0) {
                const firstItem = allowedGroups[0];
                if (typeof firstItem === 'number' || (typeof firstItem === 'object' && firstItem !== null && typeof firstItem.id === 'number')) {
                    const allowedGroupIds = allowedGroups.map(g => typeof g === 'number' ? g : (g.id || g));
                    const matchedAllowedGroups = faceVerificationStudentGroups.filter(g => allowedGroupIds.includes(g.id));
                    if (matchedAllowedGroups.length > 0) {
                        setAllowedGroups(matchedAllowedGroups);
                    } else if (allowedGroups.length > 0 && typeof allowedGroups[0] === 'number') {
                        // If no matches but we have IDs, keep empty array
                        setAllowedGroups([]);
                    }
                }
            }
        }
    }, [showFaceSettingsModal, faceVerificationStudentGroups]);

    const renderFaceManagementTab = () => {
        const currentIsMobile = window.innerWidth <= 768;

        return (
            <>
                {/* Search Controls */}
                <div className="session-list-controls">
                    <div className="search-controls">
                        <div className="search-input">
                            <input
                                type="text"
                                placeholder="Tìm kiếm theo tên, email, mã SV..."
                                value={faceSearchTerm}
                                onChange={(e) => setFaceSearchTerm(e.target.value)}
                                className="search-input"
                            />
                        </div>
                        <Button variant="primary" onClick={() => fetchFaceUsers()} className="filter-btn">
                            Tìm kiếm
                        </Button>
                        {faceSearchTerm && (
                            <Button
                                variant="outline-secondary"
                                onClick={() => {
                                    setFaceSearchTerm('');
                                    fetchFaceUsers();
                                }}
                                className="filter-btn"
                            >
                                Xóa bộ lọc
                            </Button>
                        )}
                        <Button 
                            variant="outline-primary" 
                            onClick={() => setShowFaceSettingsModal(true)}
                            className="filter-btn d-flex align-items-center gap-2"
                        >
                            <i className="fas fa-shield-alt me-2"></i>
                            Cài đặt xác minh khuôn mặt
                        </Button>
                    </div>
                </div>

                {/* Face Users Table */}
                <div className="session-table-container">
                    <div className="table-responsive-mobile">
                        <table className="session-table students-table">
                            <thead>
                                <tr>
                                    <th className={currentIsMobile ? "mobile-essential" : "mobile-hide"}>#</th>
                                    <th className="mobile-essential">Ảnh</th>
                                    <th className="mobile-essential">Mã SV</th>
                                    <th className="mobile-essential">Họ và tên</th>
                                    <th className="mobile-essential">Email</th>
                                    <th className="mobile-essential">Lớp</th>
                                    <th className="mobile-essential">Khoa</th>
                                    <th className="mobile-essential">Ngày đăng ký</th>
                                    <th className="mobile-essential">Yêu cầu cập nhật</th>
                                    <th className="mobile-essential">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {faceUsersLoading ? (
                                    <tr>
                                        <td colSpan="10" className="text-center">
                                            <Spinner animation="border" size="sm" />
                                        </td>
                                    </tr>
                                ) : faceUsers.length > 0 ? (
                                    faceUsers.map((user, index) => (
                                        <tr 
                                            key={user.id}
                                            onClick={() => {
                                                setSelectedFaceUser(user);
                                                setShowFaceUserDetailModal(true);
                                            }}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <td className={currentIsMobile ? "mobile-essential" : "mobile-hide"}>
                                                {(faceUsersPagination.page - 1) * faceUsersPagination.limit + index + 1}
                                            </td>
                                            <td className="mobile-essential">
                                                {user.face_sample_image ? (
                                                    <img
                                                        src={user.face_sample_image.startsWith('http') 
                                                            ? user.face_sample_image 
                                                            : `${window.location.origin}${user.face_sample_image}`}
                                                        alt="Face Sample"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedFaceImage(user.face_sample_image);
                                                            setShowFaceImageModal(true);
                                                        }}
                                                        style={{
                                                            width: '60px',
                                                            height: '60px',
                                                            objectFit: 'cover',
                                                            borderRadius: '8px',
                                                            border: '2px solid #256176',
                                                            cursor: 'pointer',
                                                            transition: 'transform 0.2s ease'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            if (e.target && e.target.style) {
                                                              e.target.style.transform = 'scale(1.1)';
                                                            }
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            if (e.target && e.target.style) {
                                                              e.target.style.transform = 'scale(1)';
                                                            }
                                                        }}
                                                        onError={(e) => {
                                                            if (e.target && e.target.style) {
                                                              e.target.style.display = 'none';
                                                            }
                                                        }}
                                                    />
                                                ) : (
                                                    <div style={{
                                                        width: '60px',
                                                        height: '60px',
                                                        borderRadius: '8px',
                                                        backgroundColor: '#f3f4f6',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}>
                                                        <i className="fas fa-user text-muted"></i>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="mobile-essential">{user.student_id || '-'}</td>
                                            <td className="mobile-essential">
                                                <div className="d-flex align-items-center">
                                                    <span>{user.full_name || '-'}</span>
                                                    <i 
                                                        className="fas fa-check-circle text-success ms-2" 
                                                        title="Đã xác thực khuôn mặt"
                                                        style={{ fontSize: '0.9rem' }}
                                                    ></i>
                                                </div>
                                            </td>
                                            <td className="mobile-essential">{user.email || '-'}</td>
                                            <td className="mobile-essential">{user.class_name || '-'}</td>
                                            <td className="mobile-essential">{user.faculty_name || '-'}</td>
                                            <td className="mobile-essential">
                                                {user.face_registered_at 
                                                    ? new Date(user.face_registered_at).toLocaleDateString('vi-VN')
                                                    : '-'}
                                            </td>
                                            <td className="mobile-essential">
                                                {user.pending_update_requests > 0 ? (
                                                    <Badge bg={
                                                        user.pending_update_type === 'allow' ? 'info' : 
                                                        user.pending_update_type === 'user_request' ? 'primary' : 
                                                        'warning'
                                                    }>
                                                        {user.pending_update_type === 'allow' ? 'Được phép' : 
                                                         user.pending_update_type === 'user_request' ? 'Yêu cầu từ người dùng' : 
                                                         'Có yêu cầu'}
                                                    </Badge>
                                                ) : (
                                                    <Badge bg="success">Không có</Badge>
                                                )}
                                            </td>
                                            <td className="mobile-essential">
                                                <div className="action-buttons" onClick={(e) => e.stopPropagation()}>
                                                    <Dropdown className="action-dropdown">
                                                        <Dropdown.Toggle variant="light" size="sm" className="btn-icon" id={`dropdown-face-${user.id}`}>
                                                            <i className="fas fa-ellipsis-v"></i>
                                                        </Dropdown.Toggle>
                                                        <Dropdown.Menu popperConfig={{ strategy: 'fixed' }}>
                                                            {user.pending_update_requests > 0 && user.pending_update_type === 'allow' ? (
                                                                <Dropdown.Item 
                                                                    onClick={() => {
                                                                        setSelectedUserForRevoke(user);
                                                                        setShowRevokeModal(true);
                                                                    }}
                                                                >
                                                                    <i className="fas fa-times-circle me-2 text-danger"></i>Thu hồi quyền cập nhật
                                                                </Dropdown.Item>
                                                            ) : user.pending_update_requests > 0 && user.pending_update_type === 'user_request' ? (
                                                                <>
                                                                    <Dropdown.Item 
                                                                        onClick={() => {
                                                                            setSelectedUserForUpdate(user);
                                                                            setUpdateRequestNotes('');
                                                                            setUpdateType('force');
                                                                            setShowApproveUserRequestModal(true);
                                                                        }}
                                                                    >
                                                                        <i className="fas fa-check-circle me-2 text-success"></i>Chấp nhận yêu cầu đặt lại
                                                                    </Dropdown.Item>
                                                                    <Dropdown.Item 
                                                                        onClick={() => {
                                                                            setSelectedUserForRevoke(user);
                                                                            setShowRejectUserRequestModal(true);
                                                                        }}
                                                                    >
                                                                        <i className="fas fa-times-circle me-2 text-danger"></i>Từ chối yêu cầu
                                                                    </Dropdown.Item>
                                                                </>
                                                            ) : user.pending_update_requests > 0 ? (
                                                                <>
                                                                    <Dropdown.Item disabled>
                                                                        <i className="fas fa-info-circle me-2 text-muted"></i>
                                                                        <small className="text-muted">Đã có yêu cầu cập nhật (Xóa cũ)</small>
                                                                    </Dropdown.Item>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Dropdown.Item 
                                                                        onClick={() => {
                                                                            setSelectedUserForUpdate(user);
                                                                            setUpdateRequestNotes('');
                                                                            setUpdateType('force');
                                                                            setShowRequestUpdateModal(true);
                                                                        }}
                                                                    >
                                                                        <i className="fas fa-sync-alt me-2 text-warning"></i>Yêu cầu cập nhật (Xóa cũ)
                                                                    </Dropdown.Item>
                                                                    <Dropdown.Item 
                                                                        onClick={() => {
                                                                            setSelectedUserForUpdate(user);
                                                                            setUpdateRequestNotes('');
                                                                            setUpdateType('allow');
                                                                            setShowAllowUpdateModal(true);
                                                                        }}
                                                                    >
                                                                        <i className="fas fa-check-circle me-2 text-success"></i>Cho phép cập nhật
                                                                    </Dropdown.Item>
                                                                </>
                                                            )}
                                                        </Dropdown.Menu>
                                                    </Dropdown>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="10" className="text-center">
                                            {faceUsersLoading ? (
                                                <Spinner animation="border" size="sm" />
                                            ) : (
                                                'Không có người dùng nào có face embedding'
                                            )}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {faceUsers.length > 0 && faceUsersPagination.totalPages > 1 && (
                        <div className="mt-3">
                            <Pagination
                                currentPage={faceUsersPagination.page}
                                totalPages={faceUsersPagination.totalPages}
                                onPageChange={(page) => setFaceUsersPagination(prev => ({ ...prev, page }))}
                                maxVisiblePages={5}
                                showFirstLast={true}
                            />
                        </div>
                    )}
                </div>

                {/* Face Recognition Settings Modal */}
                <Modal
                    show={showFaceSettingsModal}
                    onHide={() => {
                        setShowFaceSettingsModal(false);
                        setFaceSettingsTab('general'); // Reset tab khi đóng modal
                    }}
                    size="xl"
                    centered
                    className="student-detail-modal"
                >
                    <Modal.Header closeButton className="student-detail-header">
                        <Modal.Title className="student-detail-title">
                            <div className="student-avatar">
                                <i className="fas fa-shield-alt"></i>
                            </div>
                            <div>
                                <h4 className="mb-0">Cài đặt xác minh khuôn mặt</h4>
                                <p className="mb-0 student-subtitle">Cấu hình các ngưỡng và tùy chọn xác minh khuôn mặt</p>
                            </div>
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body className="student-detail-body">
                        <div className="student-detail-container">
                            <Form>
                                <Tabs
                                    activeKey={faceSettingsTab}
                                    onSelect={(k) => setFaceSettingsTab(k)}
                                    className="mb-3"
                                    fill
                                    variant="pills"
                                >
                                    {/* General Tab */}
                                    <Tab eventKey="general" title={
                                        <span>
                                            <i className="fas fa-cog me-2"></i>
                                            Tổng quan
                                        </span>
                                    }>
                                        <div className="p-3">
                                            {/* Enable Face Verification */}
                                            <div className="session-card mb-4">
                                                <div className="card-header-modern">
                                                    <div className="header-icon">
                                                        <i className="fas fa-toggle-on"></i>
                                                    </div>
                                                    <h6 className="mb-0">Bật/Tắt xác minh khuôn mặt</h6>
                                                </div>
                                                <div className="card-body-modern">
                                                    <Form.Group className="mb-0">
                                                        <Form.Check
                                                            type="switch"
                                                            id="enable-face-verification"
                                                            label="Xác minh khuôn mặt trong điểm danh"
                                                            checked={faceSettings.enable_face_verification?.value ?? true}
                                                            onChange={(e) => setFaceSettings(prev => ({
                                                                ...prev,
                                                                enable_face_verification: { ...prev.enable_face_verification, value: e.target.checked }
                                                            }))}
                                                        />
                                                        <Form.Text className="text-muted" style={{ fontSize: '13px', marginTop: '8px', display: 'block' }}>
                                                            {faceSettings.enable_face_verification?.description || 'Khi bật, sinh viên phải xác minh khuôn mặt khi điểm danh'}
                                                        </Form.Text>
                                                    </Form.Group>
                                                </div>
                                            </div>
                                            
                                            {/* Exempt and Allowed Students Sections - Only show if face verification is enabled */}
                                            {faceSettings.enable_face_verification?.value && (
                                                <Row className="g-3">
                                                    {/* Exempt Students Section - Left Column */}
                                                    <Col md={6}>
                                                        <div className="session-card mb-4 h-100">
                                                    <div className="card-header-modern">
                                                        <div className="header-icon">
                                                            <i className="fas fa-user-shield"></i>
                                                        </div>
                                                        <h6 className="mb-0">Được miễn cho các sinh viên Lớp/Nhóm</h6>
                                                    </div>
                                                    <div className="card-body-modern">
                                                        <Form.Text className="text-muted mb-3" style={{ fontSize: '12px', display: 'block' }}>
                                                            Các sinh viên được chọn ở đây sẽ không cần xác minh khuôn mặt khi điểm danh
                                                        </Form.Text>
                                                        
                                                        {/* Select Classes and Groups */}
                                                        <div className="mb-3">
                                                            <Row>
                                                                <Col md={6}>
                                                                    <Form.Group>
                                                                        <Form.Label className="info-label" style={{ fontSize: '13px', marginBottom: '8px' }}>
                                                                            <i className="fas fa-graduation-cap me-2"></i>Chọn lớp được miễn
                                                                        </Form.Label>
                                                                        <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '4px', padding: '8px' }}>
                                                                            {faceVerificationClasses.length === 0 ? (
                                                                                <div className="text-muted text-center py-2" style={{ fontSize: '12px' }}>
                                                                                    Chưa có lớp nào
                                                                                </div>
                                                                            ) : (
                                                                                faceVerificationClasses.map((className, index) => (
                                                                                    <Form.Check
                                                                                        key={index}
                                                                                        type="checkbox"
                                                                                        id={`exempt-class-${index}`}
                                                                                        label={className}
                                                                                        checked={exemptClasses.includes(className)}
                                                                                        onChange={(e) => {
                                                                                            if (e.target.checked) {
                                                                                                setExemptClasses([...exemptClasses, className]);
                                                                                            } else {
                                                                                                setExemptClasses(exemptClasses.filter(c => c !== className));
                                                                                            }
                                                                                        }}
                                                                                        className="mb-2"
                                                                                    />
                                                                                ))
                                                                            )}
                                                                        </div>
                                                                    </Form.Group>
                                                                </Col>
                                                                <Col md={6}>
                                                                    <Form.Group>
                                                                        <Form.Label className="info-label" style={{ fontSize: '13px', marginBottom: '8px' }}>
                                                                            <i className="fas fa-layer-group me-2"></i>Chọn nhóm được miễn
                                                                        </Form.Label>
                                                                        <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '4px', padding: '8px' }}>
                                                                            {faceVerificationStudentGroups.length === 0 ? (
                                                                                <div className="text-muted text-center py-2" style={{ fontSize: '12px' }}>
                                                                                    Chưa có nhóm nào
                                                                                </div>
                                                                            ) : (
                                                                                faceVerificationStudentGroups.map((group) => (
                                                                                    <Form.Check
                                                                                        key={group.id}
                                                                                        type="checkbox"
                                                                                        id={`exempt-group-${group.id}`}
                                                                                        label={`${group.group_name} (${group.student_count || 0} sinh viên)`}
                                                                                        checked={exemptGroups.some(g => (g.id || g) === group.id)}
                                                                                        onChange={(e) => {
                                                                                            if (e.target.checked) {
                                                                                                setExemptGroups([...exemptGroups, group]);
                                                                                            } else {
                                                                                                setExemptGroups(exemptGroups.filter(g => (g.id || g) !== group.id));
                                                                                            }
                                                                                        }}
                                                                                        className="mb-2"
                                                                                    />
                                                                                ))
                                                                            )}
                                                                        </div>
                                                                    </Form.Group>
                                                                </Col>
                                                            </Row>
                                                        </div>
                                                        
                                                        {/* Filters */}
                                                        <Row className="mb-3">
                                                            <Col md={12}>
                                                                <div className="d-flex flex-wrap gap-2 mb-3">
                                                                    <InputGroup style={{ width: 'auto' }}>
                                                                        <InputGroup.Text><i className="fas fa-layer-group"></i></InputGroup.Text>
                                                                        <Form.Select
                                                                            value={faceVerificationGroupFilter}
                                                                            onChange={(e) => {
                                                                                setFaceVerificationGroupFilter(e.target.value);
                                                                                setFaceVerificationUseGroupMode(!!e.target.value);
                                                                                if (!e.target.value) {
                                                                                    setFaceVerificationClassFilter('');
                                                                                    setFaceVerificationFacultyFilter('');
                                                                                    setFaceVerificationMajorFilter('');
                                                                                }
                                                                            }}
                                                                            style={{ width: '250px' }}
                                                                        >
                                                                            <option value="">Chọn nhóm sinh viên</option>
                                                                            {faceVerificationStudentGroups.map((group) => (
                                                                                <option key={group.id} value={group.id}>
                                                                                    {group.group_name} ({group.student_count || 0} sinh viên)
                                                                                </option>
                                                                            ))}
                                                                        </Form.Select>
                                                                    </InputGroup>
                                                                    <InputGroup style={{ width: 'auto' }}>
                                                                        <InputGroup.Text><i className="fas fa-graduation-cap"></i></InputGroup.Text>
                                                                        <Form.Select
                                                                            value={faceVerificationClassFilter}
                                                                            onChange={(e) => {
                                                                                setFaceVerificationClassFilter(e.target.value);
                                                                                if (e.target.value) {
                                                                                    setFaceVerificationUseGroupMode(false);
                                                                                    setFaceVerificationGroupFilter('');
                                                                                }
                                                                            }}
                                                                            style={{ width: '200px' }}
                                                                        >
                                                                            <option value="">Tất cả lớp</option>
                                                                            {faceVerificationClasses.map((className, index) => (
                                                                                <option key={index} value={className}>{className}</option>
                                                                            ))}
                                                                        </Form.Select>
                                                                    </InputGroup>
                                                                    <InputGroup style={{ width: 'auto' }}>
                                                                        <InputGroup.Text><i className="fas fa-university"></i></InputGroup.Text>
                                                                        <Form.Select
                                                                            value={faceVerificationFacultyFilter}
                                                                            onChange={(e) => setFaceVerificationFacultyFilter(e.target.value)}
                                                                            style={{ width: '200px' }}
                                                                        >
                                                                            <option value="">Tất cả khoa</option>
                                                                            {faceVerificationFaculties.map((faculty, index) => (
                                                                                <option key={index} value={faculty}>{faculty}</option>
                                                                            ))}
                                                                        </Form.Select>
                                                                    </InputGroup>
                                                                </div>
                                                            </Col>
                                                        </Row>
                                                        
                                                        {/* Student List */}
                                                        <div className="table-responsive border rounded" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                                            <Table striped hover className="mb-0">
                                                                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', zIndex: 1 }}>
                                                                    <tr>
                                                                        <th style={{ width: '50px', textAlign: 'center' }}>
                                                                            <i className="fas fa-check-square"></i>
                                                                        </th>
                                                                        <th>Mã SV</th>
                                                                        <th>Họ và tên</th>
                                                                        <th>Lớp</th>
                                                                        <th>Khoa</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {faceVerificationStudents.length > 0 ? (
                                                                        faceVerificationStudents.map(student => {
                                                                            const isSelected = exemptStudents.some(s => (s.id || s) === student.id);
                                                                            return (
                                                                                <tr 
                                                                                    key={student.id} 
                                                                                    className={isSelected ? 'table-active' : ''}
                                                                                    style={{ cursor: 'pointer' }}
                                                                                    onClick={(e) => {
                                                                                        // Don't toggle if clicking directly on checkbox
                                                                                        if (e.target.type === 'checkbox') return;
                                                                                        if (isSelected) {
                                                                                            setExemptStudents(exemptStudents.filter(s => (s.id || s) !== student.id));
                                                                                        } else {
                                                                                            setExemptStudents([...exemptStudents, student]);
                                                                                        }
                                                                                    }}
                                                                                >
                                                                                    <td className="text-center" onClick={(e) => e.stopPropagation()}>
                                                                                        <Form.Check
                                                                                            type="checkbox"
                                                                                            checked={isSelected}
                                                                                            onChange={(e) => {
                                                                                                if (e.target.checked) {
                                                                                                    setExemptStudents([...exemptStudents, student]);
                                                                                                } else {
                                                                                                    setExemptStudents(exemptStudents.filter(s => (s.id || s) !== student.id));
                                                                                                }
                                                                                            }}
                                                                                        />
                                                                                    </td>
                                                                                    <td>{student.student_id}</td>
                                                                                    <td>{student.full_name}</td>
                                                                                    <td>{student.class_name}</td>
                                                                                    <td>{student.faculty_name}</td>
                                                                                </tr>
                                                                            );
                                                                        })
                                                                    ) : (
                                                                        <tr>
                                                                            <td colSpan="5" className="text-center py-3">
                                                                                <i className="fas fa-search me-2"></i>Không tìm thấy sinh viên nào
                                                                            </td>
                                                                        </tr>
                                                                    )}
                                                                </tbody>
                                                            </Table>
                                                        </div>
                                                        
                                                        {/* Quick select buttons */}
                                                        <div className="d-flex gap-2 mt-2">
                                                            <Button
                                                                variant="outline-danger"
                                                                size="sm"
                                                                onClick={() => setExemptStudents([])}
                                                            >
                                                                <i className="fas fa-times-circle me-1"></i>Bỏ chọn tất cả
                                                            </Button>
                                                            <Button
                                                                variant="outline-success"
                                                                size="sm"
                                                                onClick={() => {
                                                                    const currentStudentIds = exemptStudents.map(s => s.id || s);
                                                                    const newExemptStudents = faceVerificationStudents.filter(s => !currentStudentIds.includes(s.id));
                                                                    setExemptStudents([...exemptStudents, ...newExemptStudents]);
                                                                }}
                                                            >
                                                                <i className="fas fa-check-circle me-1"></i>Chọn tất cả
                                                            </Button>
                                                        </div>
                                                        
                                                        {/* Selected summary */}
                                                        {(exemptStudents.length > 0 || exemptClasses.length > 0 || exemptGroups.length > 0) && (
                                                            <div className="mt-3">
                                                                <Alert variant="info" className="mb-2" style={{ fontSize: '12px' }}>
                                                                    <i className="fas fa-info-circle me-2"></i>
                                                                    <strong>Đã chọn:</strong> {exemptStudents.length} sinh viên, {exemptClasses.length} lớp, {exemptGroups.length} nhóm
                                                                </Alert>
                                                                
                                                                {/* Detailed list */}
                                                                <div className="border rounded p-2" style={{ backgroundColor: '#f8f9fa', fontSize: '12px' }}>
                                                                    {exemptStudents.length > 0 && (
                                                                        <div className="mb-2">
                                                                            <strong><i className="fas fa-user me-1"></i>Sinh viên được miễn ({exemptStudents.length}):</strong>
                                                                            <div className="mt-1 ms-3">
                                                                                {exemptStudents.map((student, index) => (
                                                                                    <div key={student.id || index} className="mb-1">
                                                                                        • {student.full_name || student.student_id} {student.class_name && `(${student.class_name})`}
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {exemptClasses.length > 0 && (
                                                                        <div className="mb-2">
                                                                            <strong><i className="fas fa-graduation-cap me-1"></i>Lớp được miễn ({exemptClasses.length}):</strong>
                                                                            <div className="mt-1 ms-3">
                                                                                {exemptClasses.map((className, index) => (
                                                                                    <span key={index} className="badge bg-secondary me-1 mb-1">{className}</span>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {exemptGroups.length > 0 && (
                                                                        <div>
                                                                            <strong><i className="fas fa-layer-group me-1"></i>Nhóm được miễn ({exemptGroups.length}):</strong>
                                                                            <div className="mt-1 ms-3">
                                                                                {exemptGroups.map((group, index) => (
                                                                                    <span key={group.id || index} className="badge bg-info me-1 mb-1">
                                                                                        {typeof group === 'object' ? group.group_name : group}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                    </Col>
                                                    
                                                    {/* Allowed Students Section - Right Column */}
                                                    <Col md={6}>
                                                        <div className="session-card mb-4 h-100">
                                                            <div className="card-header-modern">
                                                                <div className="header-icon">
                                                                    <i className="fas fa-user-check"></i>
                                                                </div>
                                                                <h6 className="mb-0">Chỉ được Lớp/Nhóm sinh viên đó chọn</h6>
                                                            </div>
                                                            <div className="card-body-modern">
                                                                <Form.Text className="text-muted mb-3" style={{ fontSize: '12px', display: 'block' }}>
                                                                    Chỉ các sinh viên được chọn ở đây mới cần xác minh khuôn mặt khi điểm danh. Tất cả sinh viên khác sẽ không cần xác minh.
                                                                </Form.Text>
                                                                
                                                                {/* Select Classes and Groups */}
                                                                <div className="mb-3">
                                                                    <Row>
                                                                        <Col md={6}>
                                                                            <Form.Group>
                                                                                <Form.Label className="info-label" style={{ fontSize: '13px', marginBottom: '8px' }}>
                                                                                    <i className="fas fa-graduation-cap me-2"></i>Chọn lớp được phép
                                                                                </Form.Label>
                                                                                <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '4px', padding: '8px' }}>
                                                                                    {faceVerificationClasses.length === 0 ? (
                                                                                        <div className="text-muted text-center py-2" style={{ fontSize: '12px' }}>
                                                                                            Chưa có lớp nào
                                                                                        </div>
                                                                                    ) : (
                                                                                        faceVerificationClasses.map((className, index) => (
                                                                                            <Form.Check
                                                                                                key={index}
                                                                                                type="checkbox"
                                                                                                id={`allowed-class-${index}`}
                                                                                                label={className}
                                                                                                checked={allowedClasses.includes(className)}
                                                                                                onChange={(e) => {
                                                                                                    if (e.target.checked) {
                                                                                                        setAllowedClasses([...allowedClasses, className]);
                                                                                                    } else {
                                                                                                        setAllowedClasses(allowedClasses.filter(c => c !== className));
                                                                                                    }
                                                                                                }}
                                                                                                className="mb-2"
                                                                                            />
                                                                                        ))
                                                                                    )}
                                                                                </div>
                                                                            </Form.Group>
                                                                        </Col>
                                                                        <Col md={6}>
                                                                            <Form.Group>
                                                                                <Form.Label className="info-label" style={{ fontSize: '13px', marginBottom: '8px' }}>
                                                                                    <i className="fas fa-layer-group me-2"></i>Chọn nhóm được phép
                                                                                </Form.Label>
                                                                                <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '4px', padding: '8px' }}>
                                                                                    {faceVerificationStudentGroups.length === 0 ? (
                                                                                        <div className="text-muted text-center py-2" style={{ fontSize: '12px' }}>
                                                                                            Chưa có nhóm nào
                                                                                        </div>
                                                                                    ) : (
                                                                                        faceVerificationStudentGroups.map((group) => (
                                                                                            <Form.Check
                                                                                                key={group.id}
                                                                                                type="checkbox"
                                                                                                id={`allowed-group-${group.id}`}
                                                                                                label={`${group.group_name} (${group.student_count || 0} sinh viên)`}
                                                                                                checked={allowedGroups.some(g => (g.id || g) === group.id)}
                                                                                                onChange={(e) => {
                                                                                                    if (e.target.checked) {
                                                                                                        setAllowedGroups([...allowedGroups, group]);
                                                                                                    } else {
                                                                                                        setAllowedGroups(allowedGroups.filter(g => (g.id || g) !== group.id));
                                                                                                    }
                                                                                                }}
                                                                                                className="mb-2"
                                                                                            />
                                                                                        ))
                                                                                    )}
                                                                                </div>
                                                                            </Form.Group>
                                                                        </Col>
                                                                    </Row>
                                                                </div>
                                                                
                                                                {/* Filters */}
                                                                <Row className="mb-3">
                                                                    <Col md={12}>
                                                                        <div className="d-flex flex-wrap gap-2 mb-3">
                                                                            <InputGroup style={{ width: 'auto' }}>
                                                                                <InputGroup.Text><i className="fas fa-layer-group"></i></InputGroup.Text>
                                                                                <Form.Select
                                                                                    value={faceVerificationGroupFilter}
                                                                                    onChange={(e) => {
                                                                                        setFaceVerificationGroupFilter(e.target.value);
                                                                                        setFaceVerificationUseGroupMode(!!e.target.value);
                                                                                        if (!e.target.value) {
                                                                                            setFaceVerificationClassFilter('');
                                                                                            setFaceVerificationFacultyFilter('');
                                                                                            setFaceVerificationMajorFilter('');
                                                                                        }
                                                                                    }}
                                                                                    style={{ width: '250px' }}
                                                                                >
                                                                                    <option value="">Chọn nhóm sinh viên</option>
                                                                                    {faceVerificationStudentGroups.map((group) => (
                                                                                        <option key={group.id} value={group.id}>
                                                                                            {group.group_name} ({group.student_count || 0} sinh viên)
                                                                                        </option>
                                                                                    ))}
                                                                                </Form.Select>
                                                                            </InputGroup>
                                                                            <InputGroup style={{ width: 'auto' }}>
                                                                                <InputGroup.Text><i className="fas fa-graduation-cap"></i></InputGroup.Text>
                                                                                <Form.Select
                                                                                    value={faceVerificationClassFilter}
                                                                                    onChange={(e) => {
                                                                                        setFaceVerificationClassFilter(e.target.value);
                                                                                        if (e.target.value) {
                                                                                            setFaceVerificationUseGroupMode(false);
                                                                                            setFaceVerificationGroupFilter('');
                                                                                        }
                                                                                    }}
                                                                                    style={{ width: '200px' }}
                                                                                >
                                                                                    <option value="">Tất cả lớp</option>
                                                                                    {faceVerificationClasses.map((className, index) => (
                                                                                        <option key={index} value={className}>{className}</option>
                                                                                    ))}
                                                                                </Form.Select>
                                                                            </InputGroup>
                                                                            <InputGroup style={{ width: 'auto' }}>
                                                                                <InputGroup.Text><i className="fas fa-university"></i></InputGroup.Text>
                                                                                <Form.Select
                                                                                    value={faceVerificationFacultyFilter}
                                                                                    onChange={(e) => setFaceVerificationFacultyFilter(e.target.value)}
                                                                                    style={{ width: '200px' }}
                                                                                >
                                                                                    <option value="">Tất cả khoa</option>
                                                                                    {faceVerificationFaculties.map((faculty, index) => (
                                                                                        <option key={index} value={faculty}>{faculty}</option>
                                                                                    ))}
                                                                                </Form.Select>
                                                                            </InputGroup>
                                                                        </div>
                                                                    </Col>
                                                                </Row>
                                                                
                                                                {/* Student List */}
                                                                <div className="table-responsive border rounded" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                                                    <Table striped hover className="mb-0">
                                                                        <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', zIndex: 1 }}>
                                                                            <tr>
                                                                                <th style={{ width: '50px', textAlign: 'center' }}>
                                                                                    <i className="fas fa-check-square"></i>
                                                                                </th>
                                                                                <th>Mã SV</th>
                                                                                <th>Họ và tên</th>
                                                                                <th>Lớp</th>
                                                                                <th>Khoa</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {faceVerificationStudents.length > 0 ? (
                                                                                faceVerificationStudents.map(student => {
                                                                                    const isSelected = allowedStudents.some(s => (s.id || s) === student.id);
                                                                                    return (
                                                                                        <tr 
                                                                                            key={student.id} 
                                                                                            className={isSelected ? 'table-active' : ''}
                                                                                            style={{ cursor: 'pointer' }}
                                                                                            onClick={(e) => {
                                                                                                // Don't toggle if clicking directly on checkbox
                                                                                                if (e.target.type === 'checkbox') return;
                                                                                                if (isSelected) {
                                                                                                    setAllowedStudents(allowedStudents.filter(s => (s.id || s) !== student.id));
                                                                                                } else {
                                                                                                    setAllowedStudents([...allowedStudents, student]);
                                                                                                }
                                                                                            }}
                                                                                        >
                                                                                            <td className="text-center" onClick={(e) => e.stopPropagation()}>
                                                                                                <Form.Check
                                                                                                    type="checkbox"
                                                                                                    checked={isSelected}
                                                                                                    onChange={(e) => {
                                                                                                        if (e.target.checked) {
                                                                                                            setAllowedStudents([...allowedStudents, student]);
                                                                                                        } else {
                                                                                                            setAllowedStudents(allowedStudents.filter(s => (s.id || s) !== student.id));
                                                                                                        }
                                                                                                    }}
                                                                                                />
                                                                                            </td>
                                                                                            <td>{student.student_id}</td>
                                                                                            <td>{student.full_name}</td>
                                                                                            <td>{student.class_name}</td>
                                                                                            <td>{student.faculty_name}</td>
                                                                                        </tr>
                                                                                    );
                                                                                })
                                                                            ) : (
                                                                                <tr>
                                                                                    <td colSpan="5" className="text-center py-3">
                                                                                        <i className="fas fa-search me-2"></i>Không tìm thấy sinh viên nào
                                                                                    </td>
                                                                                </tr>
                                                                            )}
                                                                        </tbody>
                                                                    </Table>
                                                                </div>
                                                                
                                                                {/* Quick select buttons */}
                                                                <div className="d-flex gap-2 mt-2">
                                                                    <Button
                                                                        variant="outline-danger"
                                                                        size="sm"
                                                                        onClick={() => setAllowedStudents([])}
                                                                    >
                                                                        <i className="fas fa-times-circle me-1"></i>Bỏ chọn tất cả
                                                                    </Button>
                                                                    <Button
                                                                        variant="outline-success"
                                                                        size="sm"
                                                                        onClick={() => {
                                                                            const currentStudentIds = allowedStudents.map(s => s.id || s);
                                                                            const newAllowedStudents = faceVerificationStudents.filter(s => !currentStudentIds.includes(s.id));
                                                                            setAllowedStudents([...allowedStudents, ...newAllowedStudents]);
                                                                        }}
                                                                    >
                                                                        <i className="fas fa-check-circle me-1"></i>Chọn tất cả
                                                                    </Button>
                                                                </div>
                                                                
                                                                {/* Selected summary */}
                                                                {(allowedStudents.length > 0 || allowedClasses.length > 0 || allowedGroups.length > 0) && (
                                                                    <div className="mt-3">
                                                                        <Alert variant="info" className="mb-2" style={{ fontSize: '12px' }}>
                                                                            <i className="fas fa-info-circle me-2"></i>
                                                                            <strong>Đã chọn:</strong> {allowedStudents.length} sinh viên, {allowedClasses.length} lớp, {allowedGroups.length} nhóm
                                                                        </Alert>
                                                                        
                                                                        {/* Detailed list */}
                                                                        <div className="border rounded p-2" style={{ backgroundColor: '#f8f9fa', fontSize: '12px' }}>
                                                                            {allowedStudents.length > 0 && (
                                                                                <div className="mb-2">
                                                                                    <strong><i className="fas fa-user me-1"></i>Sinh viên được phép ({allowedStudents.length}):</strong>
                                                                                    <div className="mt-1 ms-3">
                                                                                        {allowedStudents.map((student, index) => (
                                                                                            <div key={student.id || index} className="mb-1">
                                                                                                • {student.full_name || student.student_id} {student.class_name && `(${student.class_name})`}
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                            {allowedClasses.length > 0 && (
                                                                                <div className="mb-2">
                                                                                    <strong><i className="fas fa-graduation-cap me-1"></i>Lớp được phép ({allowedClasses.length}):</strong>
                                                                                    <div className="mt-1 ms-3">
                                                                                        {allowedClasses.map((className, index) => (
                                                                                            <span key={index} className="badge bg-secondary me-1 mb-1">{className}</span>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                            {allowedGroups.length > 0 && (
                                                                                <div>
                                                                                    <strong><i className="fas fa-layer-group me-1"></i>Nhóm được phép ({allowedGroups.length}):</strong>
                                                                                    <div className="mt-1 ms-3">
                                                                                        {allowedGroups.map((group, index) => (
                                                                                            <span key={group.id || index} className="badge bg-info me-1 mb-1">
                                                                                                {typeof group === 'object' ? group.group_name : group}
                                                                                            </span>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </Col>
                                                </Row>
                                            )}
                                        </div>
                                    </Tab>

                                    {/* Liveness Detection Tab */}
                                    <Tab eventKey="liveness" title={
                                        <span>
                                            <i className="fas fa-eye me-2"></i>
                                            Liveness Detection
                                        </span>
                                    }>
                                        <div className="p-3">
                                            <div className="session-card mb-4">
                                                <div className="card-header-modern">
                                                    <div className="header-icon">
                                                        <i className="fas fa-eye"></i>
                                                    </div>
                                                    <h6 className="mb-0">Ngưỡng Liveness Detection</h6>
                                                </div>
                                                <div className="card-body-modern">
                                        {/* Liveness Confidence Threshold */}
                                        <Form.Group className="mb-3">
                                            <Form.Label className="info-label" style={{ fontSize: '14px', marginBottom: '4px' }}>
                                                <i className="fas fa-chart-line me-2"></i>
                                                Confidence Threshold <small className="text-muted">(0.0 - 1.0)</small>
                                            </Form.Label>
                                            <Form.Control
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                max="1"
                                                value={faceSettings.liveness_confidence_threshold?.value ?? 0.3}
                                                onChange={(e) => setFaceSettings(prev => ({
                                                    ...prev,
                                                    liveness_confidence_threshold: { ...prev.liveness_confidence_threshold, value: parseFloat(e.target.value) || 0.3 }
                                                }))}
                                                className="form-control-modern"
                                            />
                                            <Form.Text className="text-muted" style={{ fontSize: '12px' }}>
                                                Ngưỡng độ tin cậy để phát hiện khuôn mặt thật (mặc định: 0.3)
                                            </Form.Text>
                                        </Form.Group>

                                        {/* Liveness Motion Threshold */}
                                        <Form.Group className="mb-3">
                                            <Form.Label className="info-label" style={{ fontSize: '14px', marginBottom: '4px' }}>
                                                <i className="fas fa-running me-2"></i>
                                                Motion Score Threshold
                                            </Form.Label>
                                            <Form.Control
                                                type="number"
                                                step="0.1"
                                                min="0"
                                                value={faceSettings.liveness_motion_threshold?.value ?? 2.0}
                                                onChange={(e) => setFaceSettings(prev => ({
                                                    ...prev,
                                                    liveness_motion_threshold: { ...prev.liveness_motion_threshold, value: parseFloat(e.target.value) || 2.0 }
                                                }))}
                                                className="form-control-modern"
                                            />
                                            <Form.Text className="text-muted" style={{ fontSize: '12px' }}>
                                                Ngưỡng điểm chuyển động để phát hiện khuôn mặt thật (mặc định: 2.0)
                                            </Form.Text>
                                        </Form.Group>

                                        {/* Liveness Texture Threshold */}
                                        <Form.Group className="mb-0">
                                            <Form.Label className="info-label" style={{ fontSize: '14px', marginBottom: '4px' }}>
                                                <i className="fas fa-image me-2"></i>
                                                Texture Variance Threshold
                                            </Form.Label>
                                            <Form.Control
                                                type="number"
                                                step="1"
                                                min="0"
                                                value={faceSettings.liveness_texture_threshold?.value ?? 50}
                                                onChange={(e) => setFaceSettings(prev => ({
                                                    ...prev,
                                                    liveness_texture_threshold: { ...prev.liveness_texture_threshold, value: parseFloat(e.target.value) || 50 }
                                                }))}
                                                className="form-control-modern"
                                            />
                                            <Form.Text className="text-muted" style={{ fontSize: '12px' }}>
                                                Ngưỡng phương sai kết cấu để phát hiện khuôn mặt thật (mặc định: 50)
                                            </Form.Text>
                                        </Form.Group>
                                                </div>
                                            </div>
                                        </div>
                                    </Tab>

                                    {/* Eye Blink Detection Tab */}
                                    <Tab eventKey="blink" title={
                                        <span>
                                            <i className="fas fa-eye me-2"></i>
                                            Phát hiện Nháy mắt
                                        </span>
                                    }>
                                        <div className="p-3">
                                            <div className="session-card mb-4">
                                                <div className="card-header-modern">
                                                    <div className="header-icon">
                                                        <i className="fas fa-eye"></i>
                                                    </div>
                                                    <h6 className="mb-0">Ngưỡng Phát hiện Nháy mắt</h6>
                                                </div>
                                                <div className="card-body-modern">
                                        {/* Eye Blink EAR Threshold */}
                                        <Form.Group className="mb-3">
                                            <Form.Label className="info-label" style={{ fontSize: '14px', marginBottom: '4px' }}>
                                                <i className="fas fa-eye me-2"></i>
                                                EAR Threshold <small className="text-muted">(Eye Aspect Ratio)</small>
                                            </Form.Label>
                                            <Form.Control
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                max="1"
                                                value={faceSettings.eye_blink_ear_threshold?.value ?? 0.25}
                                                onChange={(e) => setFaceSettings(prev => ({
                                                    ...prev,
                                                    eye_blink_ear_threshold: { ...prev.eye_blink_ear_threshold, value: parseFloat(e.target.value) || 0.25 }
                                                }))}
                                                className="form-control-modern"
                                            />
                                            <Form.Text className="text-muted" style={{ fontSize: '12px' }}>
                                                Ngưỡng EAR để phát hiện mắt nhắm (mặc định: 0.25)
                                            </Form.Text>
                                        </Form.Group>

                                        {/* Eye Blink Drop Threshold */}
                                        <Form.Group className="mb-3">
                                            <Form.Label className="info-label" style={{ fontSize: '14px', marginBottom: '4px' }}>
                                                <i className="fas fa-arrow-down me-2"></i>
                                                EAR Drop Threshold <small className="text-muted">(0.0 - 1.0)</small>
                                            </Form.Label>
                                            <Form.Control
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                max="1"
                                                value={faceSettings.eye_blink_drop_threshold?.value ?? 0.15}
                                                onChange={(e) => setFaceSettings(prev => ({
                                                    ...prev,
                                                    eye_blink_drop_threshold: { ...prev.eye_blink_drop_threshold, value: parseFloat(e.target.value) || 0.15 }
                                                }))}
                                                className="form-control-modern"
                                            />
                                            <Form.Text className="text-muted" style={{ fontSize: '12px' }}>
                                                Ngưỡng giảm EAR so với baseline để phát hiện nháy mắt (mặc định: 0.15 = 15%)
                                            </Form.Text>
                                        </Form.Group>

                                        {/* Eye Blink Sudden Drop */}
                                        <Form.Group className="mb-0">
                                            <Form.Label className="info-label" style={{ fontSize: '14px', marginBottom: '4px' }}>
                                                <i className="fas fa-bolt me-2"></i>
                                                EAR Sudden Drop Threshold
                                            </Form.Label>
                                            <Form.Control
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                max="1"
                                                value={faceSettings.eye_blink_sudden_drop?.value ?? 0.08}
                                                onChange={(e) => setFaceSettings(prev => ({
                                                    ...prev,
                                                    eye_blink_sudden_drop: { ...prev.eye_blink_sudden_drop, value: parseFloat(e.target.value) || 0.08 }
                                                }))}
                                                className="form-control-modern"
                                            />
                                            <Form.Text className="text-muted" style={{ fontSize: '12px' }}>
                                                Ngưỡng giảm EAR đột ngột giữa 2 frames để phát hiện nháy mắt (mặc định: 0.08)
                                            </Form.Text>
                                        </Form.Group>
                                                </div>
                                            </div>
                                        </div>
                                    </Tab>

                                    {/* Mouth Open Detection Tab */}
                                    <Tab eventKey="mouth" title={
                                        <span>
                                            <i className="fas fa-smile me-2"></i>
                                            Phát hiện Há miệng
                                        </span>
                                    }>
                                        <div className="p-3">
                                            <div className="session-card mb-4">
                                                <div className="card-header-modern">
                                                    <div className="header-icon">
                                                        <i className="fas fa-smile"></i>
                                                    </div>
                                                    <h6 className="mb-0">Ngưỡng Phát hiện Há miệng</h6>
                                                </div>
                                                <div className="card-body-modern">
                                        {/* Mouth Open MAR Threshold */}
                                        <Form.Group className="mb-0">
                                            <Form.Label className="info-label" style={{ fontSize: '14px', marginBottom: '4px' }}>
                                                <i className="fas fa-smile me-2"></i>
                                                MAR Threshold <small className="text-muted">(Mouth Aspect Ratio)</small>
                                            </Form.Label>
                                            <Form.Control
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                max="2"
                                                value={faceSettings.mouth_open_mar_threshold?.value ?? 0.6}
                                                onChange={(e) => setFaceSettings(prev => ({
                                                    ...prev,
                                                    mouth_open_mar_threshold: { ...prev.mouth_open_mar_threshold, value: parseFloat(e.target.value) || 0.6 }
                                                }))}
                                                className="form-control-modern"
                                            />
                                            <Form.Text className="text-muted" style={{ fontSize: '12px' }}>
                                                Ngưỡng MAR để phát hiện miệng mở (mặc định: 0.6)
                                            </Form.Text>
                                        </Form.Group>
                                                </div>
                                            </div>
                                        </div>
                                    </Tab>

                                    {/* Face Recognition Tab */}
                                    <Tab eventKey="recognition" title={
                                        <span>
                                            <i className="fas fa-user-check me-2"></i>
                                            Nhận diện Khuôn mặt
                                        </span>
                                    }>
                                        <div className="p-3">
                                            <div className="session-card mb-4">
                                                <div className="card-header-modern">
                                                    <div className="header-icon">
                                                        <i className="fas fa-user-check"></i>
                                                    </div>
                                                    <h6 className="mb-0">Ngưỡng Nhận diện Khuôn mặt</h6>
                                                </div>
                                                <div className="card-body-modern">
                                        {/* Face Match Threshold */}
                                        <Form.Group className="mb-3">
                                            <Form.Label className="info-label" style={{ fontSize: '14px', marginBottom: '4px' }}>
                                                <i className="fas fa-check-circle me-2"></i>
                                                Face Match Threshold <small className="text-muted">(0.0 - 1.0)</small>
                                            </Form.Label>
                                            <Form.Control
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                max="1"
                                                value={faceSettings.face_match_threshold?.value ?? 0.65}
                                                onChange={(e) => setFaceSettings(prev => ({
                                                    ...prev,
                                                    face_match_threshold: { ...prev.face_match_threshold, value: parseFloat(e.target.value) || 0.65 }
                                                }))}
                                                className="form-control-modern"
                                            />
                                            <Form.Text className="text-muted" style={{ fontSize: '12px' }}>
                                                Ngưỡng similarity để khớp khuôn mặt (mặc định: 0.65 = 65%)
                                            </Form.Text>
                                        </Form.Group>

                                        {/* Duplicate Face Threshold */}
                                        <Form.Group className="mb-0">
                                            <Form.Label className="info-label" style={{ fontSize: '14px', marginBottom: '4px' }}>
                                                <i className="fas fa-exclamation-triangle me-2"></i>
                                                Duplicate Face Threshold <small className="text-muted">(0.0 - 1.0)</small>
                                            </Form.Label>
                                            <Form.Control
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                max="1"
                                                value={faceSettings.duplicate_face_threshold?.value ?? 0.75}
                                                onChange={(e) => setFaceSettings(prev => ({
                                                    ...prev,
                                                    duplicate_face_threshold: { ...prev.duplicate_face_threshold, value: parseFloat(e.target.value) || 0.75 }
                                                }))}
                                                className="form-control-modern"
                                            />
                                            <Form.Text className="text-muted" style={{ fontSize: '12px' }}>
                                                Ngưỡng similarity để phát hiện khuôn mặt trùng lặp khi đăng ký (mặc định: 0.75 = 75%)
                                            </Form.Text>
                                        </Form.Group>
                                                </div>
                                            </div>
                                        </div>
                                    </Tab>
                                </Tabs>
                            </Form>
                        </div>
                    </Modal.Body>
                    <Modal.Footer className="student-detail-footer">
                        <Button 
                            variant="outline-secondary" 
                            onClick={() => setShowFaceSettingsModal(false)}
                            className="btn-cancel"
                        >
                            <i className="fas fa-times me-2"></i>
                            Hủy
                        </Button>
                        <Button 
                            variant="primary" 
                            onClick={saveFaceSettings}
                            disabled={faceSettingsLoading}
                            className="btn-edit"
                        >
                            {faceSettingsLoading ? (
                                <>
                                    <Spinner animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                                    Đang xử lý...
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-save me-2"></i>
                                    Lưu cài đặt
                                </>
                            )}
                        </Button>
                    </Modal.Footer>
                </Modal>
            </>
        );
    };

    const renderStaffTab = () => {
        // Kiểm tra isMobile trực tiếp từ window.innerWidth để tránh lỗi state
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

                {/* Staff Table */}
                <div className="session-table-container">
                    <div className="table-responsive-mobile">
                        <table className="session-table staff-table">
                            <thead>
                                <tr>
                                    <th className={currentIsMobile ? "mobile-hide" : "mobile-hide"}>#</th>
                                    <th className="mobile-essential">Tên đăng nhập</th>
                                    <th className="mobile-essential">Họ và tên</th>
                                    <th className={currentIsMobile ? "mobile-hide" : "mobile-hide"}>Email</th>
                                    <th className="mobile-essential">Vai trò</th>
                                    <th className="mobile-essential">Trạng thái</th>
                                    <th className="mobile-essential">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.length > 0 ? (
                                    users
                                        .slice((pagination.page - 1) * pagination.limit, pagination.page * pagination.limit)
                                        .map((user, index) => (
                                            <tr key={user.id}>
                                                <td className={currentIsMobile ? "mobile-hide" : "mobile-hide"}>
                                                    {index + 1}
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
                                                    <Badge bg={
                                                        user.role === 'superadmin' ? 'danger' :
                                                            user.role === 'admin' ? 'warning' :
                                                                user.role === 'staff' ? 'info' : 'secondary'
                                                    } className="role-badge">
                                                        {user.role === 'superadmin' ? 'Super Admin' :
                                                            user.role === 'admin' ? 'Quản trị viên' :
                                                                user.role === 'staff' ? 'Nhân viên' : user.role}
                                                    </Badge>
                                                </td>
                                                <td className="mobile-essential">
                                                    {user.approved ? (
                                                        <Badge bg="success" className="status-badge-mobile">Đã duyệt</Badge>
                                                    ) : (
                                                        <Badge bg="warning" className="status-badge-mobile">Chờ duyệt</Badge>
                                                    )}
                                                </td>
                                                <td className="mobile-essential">
                                                    <div className="action-buttons">
                                                        <Dropdown className="action-dropdown">
                                                            <Dropdown.Toggle variant="light" size="sm" className="btn-icon" id={`dropdown-${user.id}`} disabled={user.role === 'superadmin'}>
                                                                <i className="fas fa-ellipsis-v"></i>
                                                            </Dropdown.Toggle>
                                                            <Dropdown.Menu popperConfig={{ strategy: 'fixed' }}>
                                                                <Dropdown.Item
                                                                    onClick={() => handleEditUser(user)}
                                                                    disabled={user.role === 'superadmin'}
                                                                >
                                                                    <i className="fas fa-edit me-2 text-primary"></i>Chỉnh sửa
                                                                </Dropdown.Item>
                                                                <Dropdown.Item
                                                                    onClick={() => handleOpenModuleRolesModal(user)}
                                                                    disabled={user.role === 'superadmin'}
                                                                >
                                                                    <i className="fas fa-shield-alt me-2 text-info"></i>Quản lý quyền module
                                                                </Dropdown.Item>
                                                                <Dropdown.Item
                                                                    onClick={() => {
                                                                        setUserToDelete(user);
                                                                        setShowDeleteModal(true);
                                                                    }}
                                                                    disabled={user.role === 'superadmin'}
                                                                >
                                                                    <i className="fas fa-trash me-2 text-danger"></i>Xóa
                                                                </Dropdown.Item>
                                                                {!user.approved && (
                                                                    <Dropdown.Item onClick={() => handleApproveUser(user.id)}>
                                                                        <i className="fas fa-check me-2 text-success"></i>Duyệt
                                                                    </Dropdown.Item>
                                                                )}
                                                            </Dropdown.Menu>
                                                        </Dropdown>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
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
                        <h1>Quản lý người dùng</h1>
                        <p className="header-subtitle">Quản lý và theo dõi thông tin sinh viên và người dùng hệ thống</p>
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
                                <Button
                                    variant="outline-light"
                                    className="create-session-btn"
                                    onClick={() => {
                                        if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ danh sách sinh viên? Hành động này không thể hoàn tác.')) {
                                            handleDeleteAllStudents();
                                        }
                                    }}
                                >
                                    <i className="fas fa-trash-alt"></i>
                                    Xóa toàn bộ
                                </Button>
                            </>
                        ) : activeTab === 'student-groups' ? (
                            <>
                                <Button
                                    variant="outline-light"
                                    className="create-session-btn"
                                    onClick={() => {
                                        setGroupFormData({
                                            group_name: '',
                                            description: '',
                                            selected_classes: [],
                                            student_ids: []
                                        });
                                        setStudentsByClasses([]);
                                        setSelectedGroup(null);
                                        fetchAvailableClasses(); // Fetch classes when opening modal
                                        setShowGroupModal(true);
                                    }}
                                >
                                    <i className="fas fa-plus"></i>
                                    Thêm nhóm mới
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button
                                    variant="outline-light"
                                    className="create-session-btn"
                                    onClick={() => {
                                        setNewUser(prev => ({ ...prev, role: 'staff' }));
                                        setShowAddModal(true);
                                    }}
                                >
                                    <i className="fas fa-plus"></i>
                                    Thêm người dùng
                                </Button>
                                <Button
                                    variant="outline-light"
                                    className="create-session-btn"
                                    onClick={handleExportUsers}
                                >
                                    <i className="fas fa-file-export"></i>
                                    Xuất Excel
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {error && <Alert variant="danger">{error}</Alert>}
            {importSuccess && <Alert variant="success">{importSuccess}</Alert>}

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
                    <Tab eventKey="student-groups" title={
                        <span className="tab-title">
                            <i className="fas fa-layer-group"></i>
                            Nhóm sinh viên
                        </span>
                    }>
                        {renderStudentGroupsTab()}
                    </Tab>
                    {/* Face Management Tab - Only for clinical_admin or clinical_mod */}
                    {currentUser?.module_roles && currentUser.module_roles.some((role) => role === 'clinical_admin' || role === 'clinical_mod') && (
                        <Tab eventKey="face-management" title={
                            <span className="tab-title">
                                <i className="fas fa-user-check"></i>
                                Quản lý Face
                            </span>
                        }>
                            {renderFaceManagementTab()}
                        </Tab>
                    )}
                    {/* Only superadmin can see the user management tab */}
                    {currentUser?.role === 'superadmin' && (
                        <Tab eventKey="staff" title={
                            <span className="tab-title">
                                <i className="fas fa-users"></i>
                                Danh sách người dùng
                            </span>
                        }>
                            {renderStaffTab()}
                        </Tab>
                    )}
                </Tabs>
            </div>

            {/* Add User Modal */}
            <Modal show={showAddModal} onHide={() => setShowAddModal(false)} size="xl" className="student-detail-modal">
                <Modal.Header closeButton className="student-detail-header">
                    <Modal.Title className="student-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-user-plus"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">{activeTab === 'students' ? 'Thêm sinh viên mới' : 'Thêm người dùng mới'}</h4>
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

                                    {activeTab === 'staff' && (
                                        <Form.Group className="mb-3">
                                            <Form.Label className="info-label">
                                                <i className="fas fa-shield-alt me-2"></i>
                                                Vai trò
                                            </Form.Label>
                                            <Form.Select
                                                name="role"
                                                value={newUser.role}
                                                onChange={handleInputChange}
                                                className="form-control-modern"
                                            >
                                                <option value="staff">Nhân viên</option>
                                                <option value="admin">Quản trị viên</option>
                                                {currentUser?.role === 'superadmin' && (
                                                    <option value="superadmin">Siêu quản trị viên</option>
                                                )}
                                            </Form.Select>
                                        </Form.Group>
                                    )}
                                </div>
                            </div>

                            {/* Student Information Card */}
                            {activeTab === 'students' && (
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
                            )}
                        </Form>
                    </div>
                </Modal.Body>
                <Modal.Footer className="student-detail-footer">
                    <Button variant="outline-secondary" onClick={() => setShowAddModal(false)} className="btn-cancel">
                        <i className="fas fa-times me-2"></i>
                        Hủy
                    </Button>
                    <Button
                        variant="primary"
                        type="submit"
                        onClick={handleAddUser}
                        disabled={loading}
                        className="btn-edit"
                    >
                        <i className="fas fa-plus me-2"></i>
                        {loading ? 'Đang xử lý...' : 'Thêm'}
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

            {/* Bulk Email Confirmation Modal */}
            <Modal show={showBulkEmailModal} onHide={() => {
                setShowBulkEmailModal(false);
                setSelectedStudentsForEmail([]);
                setFilteredStudentsForEmail([]);
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
                                                        value={selectedClass}
                                                        onChange={(e) => setSelectedClass(e.target.value)}
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
                                                        value={selectedFaculty}
                                                        onChange={(e) => setSelectedFaculty(e.target.value)}
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
                                                        value={selectedMajor}
                                                        onChange={(e) => setSelectedMajor(e.target.value)}
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

                                        {(selectedClass || selectedFaculty || selectedMajor) && (
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
                                                                        {selectedClass && <li><strong>Lớp:</strong> {selectedClass}</li>}
                                                                        {selectedFaculty && <li><strong>Khoa:</strong> {selectedFaculty}</li>}
                                                                        {selectedMajor && <li><strong>Ngành:</strong> {selectedMajor}</li>}
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
                                                                        {selectedClass && !selectedFaculty && !selectedMajor ?
                                                                            (classStudentCounts[selectedClass] || 0) :
                                                                            selectedFaculty && !selectedClass && !selectedMajor ?
                                                                                (facultyStudentCounts[selectedFaculty] || 0) :
                                                                                selectedMajor && !selectedClass && !selectedFaculty ?
                                                                                    (majorStudentCounts[selectedMajor] || 0) :
                                                                                    selectedClass ?
                                                                                        (classStudentCounts[selectedClass] || 0) :
                                                                                        selectedFaculty ?
                                                                                            (facultyStudentCounts[selectedFaculty] || 0) :
                                                                                            selectedMajor ?
                                                                                                (majorStudentCounts[selectedMajor] || 0) :
                                                                                                0} sinh viên
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
                                                                // Sử dụng danh sách sinh viên đã fetch từ API
                                                                const filteredStudents = filteredStudentsForEmail;

                                                                if (loadingFilteredStudents) {
                                                                    return (
                                                                        <div className="text-center text-muted py-4">
                                                                            <Spinner animation="border" size="sm" className="me-2" />
                                                                            <span>Đang tải danh sách sinh viên...</span>
                                                                        </div>
                                                                    );
                                                                }

                                                                if (filteredStudents.length === 0) {
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
                                                                    if (selectedStudentsForEmail.length === filteredStudents.length) {
                                                                        setSelectedStudentsForEmail([]);
                                                                    } else {
                                                                        setSelectedStudentsForEmail(filteredStudents.map(s => s.id));
                                                                    }
                                                                };

                                                                const isAllSelected = filteredStudents.length > 0 && selectedStudentsForEmail.length === filteredStudents.length;
                                                                const isIndeterminate = selectedStudentsForEmail.length > 0 && selectedStudentsForEmail.length < filteredStudents.length;

                                                                return (
                                                                    <div
                                                                        className="table-responsive"
                                                                        style={{
                                                                            maxHeight: filteredStudents.length > 10 ? '400px' : 'auto',
                                                                            overflowY: filteredStudents.length > 10 ? 'auto' : 'visible'
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
                                                                                {filteredStudents.map((student, index) => {
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
                                                                        {filteredStudents.length > 10 && (
                                                                            <div className="text-center mt-2">
                                                                                <small className="text-muted">
                                                                                    <i className="fas fa-info-circle me-1"></i>
                                                                                    Cuộn để xem tất cả {filteredStudents.length} sinh viên
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
                        <div className="alert alert-warning" role="alert">
                            <i className="fas fa-exclamation-triangle me-2"></i>
                            <strong>Lưu ý:</strong> Hành động này sẽ gửi email thông tin đăng nhập cho nhiều sinh viên.
                            Vui lòng đảm bảo bạn đã kiểm tra kỹ danh sách người nhận trước khi tiếp tục.
                        </div>
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
                                                    // Sử dụng danh sách sinh viên đã fetch từ API
                                                    filteredStudents = filteredStudentsForEmail.filter(s => s.display_password);

                                                    // Nếu có checkbox được chọn, chỉ tính những sinh viên đã chọn
                                                    if (selectedStudentsForEmail.length > 0) {
                                                        filteredStudents = filteredStudents.filter(s => selectedStudentsForEmail.includes(s.id));
                                                    }
                                                }
                                                return filteredStudents.length;
                                            })()} sinh viên
                                        </Badge>
                                    </div>
                                </div>
                                <div className="info-item">
                                    <div className="info-value">
                                        {(() => {
                                            let filteredStudents;
                                            if (bulkEmailTab === 'all') {
                                                filteredStudents = allStudents.filter(s => s.display_password);
                                            } else {
                                                // Sử dụng danh sách sinh viên đã fetch từ API
                                                filteredStudents = filteredStudentsForEmail.filter(s => s.display_password);

                                                // Nếu có checkbox được chọn, chỉ tính những sinh viên đã chọn
                                                if (selectedStudentsForEmail.length > 0) {
                                                    filteredStudents = filteredStudents.filter(s => selectedStudentsForEmail.includes(s.id));
                                                }
                                            }

                                            if (filteredStudents.length === 0) {
                                                return <span className="text-muted">Không có sinh viên nào</span>;
                                            }

                                            return (
                                                <div
                                                    style={{
                                                        maxHeight: '300px',
                                                        overflowY: 'auto',
                                                        border: '1px solid #dee2e6',
                                                        borderRadius: '0.375rem',
                                                        padding: '0.5rem'
                                                    }}
                                                >
                                                    <table className="table table-sm table-hover mb-0">
                                                        <thead className="table-light">
                                                            <tr>
                                                                <th style={{ width: '50px' }}>STT</th>
                                                                <th>Họ tên</th>
                                                                <th>Mã SV</th>
                                                                <th>Email</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {filteredStudents.map((student, index) => (
                                                                <tr key={student.id}>
                                                                    <td className="text-muted">{index + 1}</td>
                                                                    <td>
                                                                        <div className="fw-medium">{student.full_name}</div>
                                                                    </td>
                                                                    <td>
                                                                        <span className="badge bg-secondary">{student.student_id}</span>
                                                                    </td>
                                                                    <td>
                                                                        <small className="text-muted">{student.email}</small>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            );
                                        })()}
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
                        // Reset progress when closing
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
                                // Reset progress when closing
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

            {/* Import Students Modal */}
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
                                            File Excel phải có các cột chính: Mã SV, Họ và tên, Email liên lạc, password
                                        </Form.Text>
                                    </Form.Group>

                                    <div className="d-flex justify-content-between align-items-center">
                                        <Button
                                            variant="outline-primary"
                                            onClick={() => import('../../utils/excelTemplates').then(module => module.createStudentImportTemplate())}
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

            {/* Delete Confirmation Modal */}
            <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} size="lg" className="student-detail-modal">
                <Modal.Header closeButton className="student-detail-header">
                    <Modal.Title className="student-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-exclamation-triangle"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Xác nhận xóa</h4>
                            <p className="mb-0 student-subtitle">Xóa người dùng khỏi hệ thống</p>
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
                                    <h6 className="mb-0">Thông tin người dùng sẽ bị xóa</h6>
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
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="fas fa-shield-alt me-2"></i>
                                            Vai trò
                                        </div>
                                        <div className="info-value">
                                            <Badge bg={
                                                userToDelete.role === 'superadmin' ? 'danger' :
                                                    userToDelete.role === 'admin' ? 'warning' :
                                                        userToDelete.role === 'staff' ? 'info' : 'primary'
                                            }>
                                                {userToDelete.role === 'superadmin' ? 'Siêu quản trị viên' :
                                                    userToDelete.role === 'admin' ? 'Quản trị viên' :
                                                        userToDelete.role === 'staff' ? 'Nhân viên' : 'Sinh viên'}
                                            </Badge>
                                        </div>
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
                                    <strong>Cảnh báo:</strong> Hành động này không thể hoàn tác. Tất cả dữ liệu liên quan đến người dùng này sẽ bị xóa vĩnh viễn.
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
                                Xóa người dùng
                            </>
                        )}
                    </Button>
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
                            <h4 className="mb-0">Chỉnh sửa thông tin người dùng</h4>
                            <p className="mb-0 student-subtitle">{editFormData.fullName || 'Người dùng'}</p>
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
                                        <Col md={12}>
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
                                    </Row>

                                    <Row>
                                        <Col md={6}>
                                            <Form.Group className="mb-3">
                                                <Form.Label className="info-label">
                                                    <i className="fas fa-shield-alt me-2"></i>
                                                    Vai trò chính
                                                </Form.Label>
                                                {userToEdit && (userToEdit.role !== 'superadmin' || currentUser?.role === 'superadmin') ? (
                                                    <Form.Select
                                                        name="role"
                                                        value={editFormData.role}
                                                        onChange={handleEditInputChange}
                                                        className="form-control-modern"
                                                        disabled={currentUser?.id === userToEdit.id}
                                                    >
                                                        <option value="student">Sinh viên</option>
                                                        <option value="staff">Nhân viên</option>
                                                        <option value="admin">Quản trị viên</option>
                                                        {currentUser?.role === 'superadmin' && (
                                                            <option value="superadmin">Siêu quản trị viên</option>
                                                        )}
                                                    </Form.Select>
                                                ) : (
                                                    <Form.Control
                                                        type="text"
                                                        value={editFormData.role === 'superadmin' ? 'Siêu quản trị viên' : editFormData.role}
                                                        disabled
                                                        className="form-control-modern"
                                                    />
                                                )}
                                                <Form.Text className="text-muted">
                                                    {currentUser?.id === userToEdit?.id
                                                        ? 'Bạn không thể thay đổi vai trò của chính mình'
                                                        : 'Thay đổi vai trò sẽ yêu cầu xác nhận mật khẩu'}
                                                </Form.Text>
                                            </Form.Group>
                                        </Col>
                                        <Col md={6}>
                                            <Form.Group className="mb-3">
                                                <Form.Label className="info-label">
                                                    <i className="fas fa-layer-group me-2"></i>
                                                    Quyền module trong IMS left rail
                                                </Form.Label>
                                                <div>
                                                    {editFormData.module_roles && editFormData.module_roles.length > 0 ? (
                                                        <div className="d-flex flex-wrap gap-2">
                                                            {editFormData.module_roles.map((roleKey, index) => {
                                                                // Determine badge color based on role type
                                                                const roleType = roleKey.split('_')[1];
                                                                const badgeColor = roleType === 'admin' ? 'primary' :
                                                                    roleType === 'mod' ? 'warning' : 'info';
                                                                return (
                                                                    <Badge key={index} bg={badgeColor} className="fs-6 p-2">
                                                                        {formatModuleRole(roleKey)}
                                                                    </Badge>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted">Chưa có quyền module nào</span>
                                                    )}
                                                </div>
                                                <Form.Text className="text-muted">
                                                    Sử dụng "Quản lý quyền module" để cấp quyền truy cập module.
                                                </Form.Text>
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
                            {editFormData.role === 'student' && (
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
                            )}
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
                        <i className="fas fa-save me-2"></i>
                        {loading ? 'Đang xử lý...' : 'Lưu thay đổi'}
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Student Detail Modal */}
            <Modal
                show={showDetailModal}
                onHide={() => setShowDetailModal(false)}
                size="xl"
                className={`student-detail-modal ${statDetailModal.show ? 'dimmed' : ''}`}
            >
                <Modal.Header closeButton className="student-detail-header">
                    <Modal.Title className="student-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-user-graduate"></i>
                        </div>
                        <div>
                            <h4 className="mb-0 d-flex align-items-center">
                                <span>{selectedStudent?.full_name || 'Sinh viên'}</span>
                                {selectedStudent?.face_embedding && selectedStudent.face_embedding.trim() !== '' && (
                                    <i 
                                        className="fas fa-check-circle text-white ms-2" 
                                        title="Đã xác thực khuôn mặt"
                                        style={{ fontSize: '1.5rem' }}
                                    ></i>
                                )}
                            </h4>
                            <p className="mb-0 student-subtitle">{selectedStudent?.student_id || 'Mã sinh viên'}</p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="student-detail-body">
                    {selectedStudent && (
                        <div className="student-detail-container">
                            {studentStatsLoading && (
                                <p className="text-muted small mb-2">Đang tải thống kê...</p>
                            )}
                            {studentStatsError && (
                                <p className="text-danger small mb-2">{studentStatsError}</p>
                            )}
                            {/* Statistics Cards */}
                            <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 row-cols-xl-5 g-3 mb-4">
                                <div className="col" onClick={() => openStatDetailModal('late')} style={{ cursor: 'pointer' }}>
                                    <div className="statistics-card">
                                        <div className="statistics-icon text-primary">
                                            <i className="fas fa-clock"></i>
                                        </div>
                                        <div className="statistics-content">
                                            <h3>{getStudentStatValue(selectedStudent, ['late_count', 'attendance_late', 'late_sessions'])}</h3>
                                            <p>Đi trễ</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="col" onClick={() => openStatDetailModal('missingTimeSlot')} style={{ cursor: 'pointer' }}>
                                    <div className="statistics-card">
                                        <div className="statistics-icon text-success">
                                            <i className="fas fa-hourglass-half"></i>
                                        </div>
                                        <div className="statistics-content">
                                            <h3>{getStudentStatValue(selectedStudent, ['missing_attendance_hours', 'missing_hours', 'attendance_missing_hours'])}</h3>
                                            <p>Thiếu giờ điểm danh</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="col" onClick={() => openStatDetailModal('absent')} style={{ cursor: 'pointer' }}>
                                    <div className="statistics-card">
                                        <div className="statistics-icon text-warning">
                                            <i className="fas fa-user-times"></i>
                                        </div>
                                        <div className="statistics-content">
                                            <h3>{getStudentStatValue(selectedStudent, ['absent_count', 'attendance_absent', 'absences'])}</h3>
                                            <p>Vắng mặt</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="col" onClick={() => openStatDetailModal('sessions')} style={{ cursor: 'pointer' }}>
                                    <div className="statistics-card">
                                        <div className="statistics-icon text-danger">
                                            <i className="fas fa-list-ol"></i>
                                        </div>
                                        <div className="statistics-content">
                                            <h3>{getStudentStatValue(selectedStudent, ['total_sessions', 'sessions_count', 'attendance_sessions'])}</h3>
                                            <p>Tổng số buổi học</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="col" onClick={() => openStatDetailModal('location')} style={{ cursor: 'pointer' }}>
                                    <div className="statistics-card">
                                        <div className="statistics-icon text-info">
                                            <i className="fas fa-map-marker-alt"></i>
                                        </div>
                                        <div className="statistics-content">
                                            <h3>{getStudentStatValue(selectedStudent, ['location_count', 'attendance_locations'])}</h3>
                                            <p>Địa điểm</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Main Content */}
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
                                                    <i className="fas fa-hashtag"></i>
                                                    Mã sinh viên
                                                </div>
                                                <div className="info-value">{selectedStudent.student_id || 'Chưa có'}</div>
                                            </div>
                                            <div className="info-item">
                                                <div className="info-label">
                                                    <i className="fas fa-envelope"></i>
                                                    Email
                                                </div>
                                                <div className="info-value">{selectedStudent.email || 'Chưa có'}</div>
                                            </div>
                                            <div className="info-item">
                                                <div className="info-label">
                                                    <i className="fas fa-key"></i>
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
                                                    <i className="fas fa-phone"></i>
                                                    Số điện thoại
                                                </div>
                                                <div className="info-value">{selectedStudent.phone || 'Chưa có'}</div>
                                            </div>
                                            <div className="info-item">
                                                <div className="info-label">
                                                    <i className="fas fa-birthday-cake"></i>
                                                    Ngày sinh
                                                </div>
                                                <div className="info-value">
                                                    {selectedStudent.birth_date ? new Date(selectedStudent.birth_date).toLocaleDateString('vi-VN') : 'Chưa có'}
                                                </div>
                                            </div>
                                            <div className="info-item">
                                                <div className="info-label">
                                                    <i className="fas fa-venus-mars"></i>
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
                                                    <i className="fas fa-id-card-alt"></i>
                                                    CMND/CCCD
                                                </div>
                                                <div className="info-value">{selectedStudent.id_number || 'Chưa có'}</div>
                                            </div>
                                            <div className="info-item">
                                                <div className="info-label">
                                                    <i className="fas fa-map-marker-alt"></i>
                                                    Địa chỉ
                                                </div>
                                                <div className="info-value">{selectedStudent.address || 'Chưa có'}</div>
                                            </div>
                                            <div className="info-item">
                                                <div className="info-label">
                                                    <i className="fas fa-info-circle"></i>
                                                    Tình trạng
                                                </div>
                                                <div className="info-value">
                                                    <span className={`status-badge ${selectedStudent.status === 'Đang học' ? 'active' :
                                                        selectedStudent.status === 'Nghỉ học' ? 'scheduled' :
                                                            selectedStudent.status === 'Tạm dừng' ? 'ended' :
                                                                selectedStudent.status === 'Đã tốt nghiệp' ? 'active' : 'ended'
                                                        }`}>
                                                        {selectedStudent.status || 'Chưa có'}
                                                    </span>
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
                                                    <i className="fas fa-users"></i>
                                                    Lớp học
                                                </div>
                                                <div className="info-value">{selectedStudent.class_name || 'Chưa có'}</div>
                                            </div>
                                            <div className="info-item">
                                                <div className="info-label">
                                                    <i className="fas fa-users"></i>
                                                    Nhóm
                                                </div>
                                                <div className="info-value">{selectedStudent.group_names || 'Chưa có'}</div>
                                            </div>
                                            <div className="info-item">
                                                <div className="info-label">
                                                    <i className="fas fa-university"></i>
                                                    Khoa
                                                </div>
                                                <div className="info-value">{selectedStudent.faculty_name || 'Chưa có'}</div>
                                            </div>
                                            <div className="info-item">
                                                <div className="info-label">
                                                    <i className="fas fa-book"></i>
                                                    Chuyên ngành
                                                </div>
                                                <div className="info-value">{selectedStudent.major_name || 'Chưa có'}</div>
                                            </div>
                                            <div className="info-item">
                                                <div className="info-label">
                                                    <i className="fas fa-calendar-plus"></i>
                                                    Ngày tạo tài khoản
                                                </div>
                                                <div className="info-value">
                                                    {selectedStudent.created_at ? new Date(selectedStudent.created_at).toLocaleDateString('vi-VN') : 'Chưa có'}
                                                </div>
                                            </div>
                                            <div className="info-item">
                                                <div className="info-label">
                                                    <i className="fas fa-sign-in-alt"></i>
                                                    Lần đăng nhập cuối
                                                </div>
                                                <div className="info-value">
                                                    {selectedStudent.last_login ? new Date(selectedStudent.last_login).toLocaleString('vi-VN') : 'Chưa đăng nhập'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="session-card">
                                        <div className="card-header-modern">
                                            <div className="header-icon">
                                                <i className="fas fa-laptop"></i>
                                            </div>
                                            <h6 className="mb-0">Thông tin thiết bị (Địa chỉ MAC)</h6>
                                        </div>
                                        <div className="card-body-modern">
                                            <div className="info-item">
                                                <div className="info-value">
                                                    <div className="mac-address-container">
                                                        <div className="mac-address-display">
                                                            {selectedStudent.device_mac || 'Chưa có liên kết thiết bị'}
                                                        </div>
                                                        {selectedStudent.device_mac && (
                                                            <button
                                                                className="btn-reset-mac"
                                                                onClick={() => {
                                                                    if (window.confirm('Bạn có chắc chắn muốn xóa liên kết thiết bị này?')) {
                                                                        handleResetMac(selectedStudent.id);
                                                                        setSelectedStudent({ ...selectedStudent, device_mac: null });
                                                                    }
                                                                }}
                                                                title="Xóa liên kết thiết bị"
                                                            >
                                                                <i className="fas fa-trash"></i>
                                                            </button>
                                                        )}
                                                    </div>
                                                    <small className="mac-description">
                                                        Địa chỉ MAC được sử dụng để giới hạn sinh viên chỉ đăng nhập được trên một thiết bị.
                                                    </small>
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

                            <Button
                                variant="outline-primary"
                                onClick={() => {
                                    openMacPolicyModal(selectedStudent);
                                }}
                                className="btn-send-credentials"
                            >
                                <i className="fas fa-cogs me-2"></i>
                                Chính sách MAC
                            </Button>

                            {selectedStudent?.device_mac && (
                                <Button
                                    variant="outline-warning"
                                    onClick={() => {
                                        if (window.confirm('Bạn có chắc chắn muốn xóa liên kết thiết bị này?')) {
                                            handleResetMac(selectedStudent.id);
                                            setSelectedStudent({ ...selectedStudent, device_mac: null });
                                        }
                                    }}
                                    className="btn-reset-mac"
                                >
                                    <i className="fas fa-unlink me-2"></i>
                                    Xóa liên kết thiết bị
                                </Button>
                            )}

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

            {/* Password Confirmation Modal */}
            <Modal show={showPasswordModal} onHide={() => setShowPasswordModal(false)} size="md" className="student-detail-modal">
                <Modal.Header closeButton className="student-detail-header">
                    <Modal.Title className="student-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-shield-alt"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">
                                {passwordModalAction === 'module_roles'
                                    ? 'Xác nhận cập nhật quyền module'
                                    : 'Xác nhận thay đổi vai trò'}
                            </h4>
                            <p className="mb-0 student-subtitle">
                                {passwordModalAction === 'module_roles'
                                    ? 'Nhập mật khẩu để xác thực cập nhật quyền module trong IMS left rail'
                                    : `Nhập mật khẩu để xác thực thay đổi vai trò từ ${originalRole} thành ${editFormData.role}`}
                            </p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="student-detail-body">
                    <div className="student-detail-container">
                        <Alert variant="warning" className="mb-4">
                            <div className="d-flex align-items-center">
                                <i className="fas fa-exclamation-triangle me-3"></i>
                                <div>
                                    <strong>Lưu ý:</strong> {
                                        passwordModalAction === 'module_roles'
                                            ? 'Cập nhật quyền module là một hành động quan trọng và có thể ảnh hưởng đến quyền truy cập hệ thống của người dùng.'
                                            : 'Thay đổi vai trò người dùng là một hành động quan trọng và có thể ảnh hưởng đến quyền truy cập hệ thống.'
                                    }
                                </div>
                            </div>
                        </Alert>

                        {passwordError && (
                            <Alert variant="danger" className="mb-4">
                                <div className="d-flex align-items-center">
                                    <i className="fas fa-times-circle me-2"></i>
                                    {passwordError}
                                </div>
                            </Alert>
                        )}

                        <Form>
                            <Form.Group className="mb-3">
                                <Form.Label className="info-label">
                                    <i className="fas fa-key me-2"></i>
                                    Mật khẩu của bạn
                                </Form.Label>
                                <Form.Control
                                    type="password"
                                    value={passwordConfirm}
                                    onChange={(e) => setPasswordConfirm(e.target.value)}
                                    placeholder="Nhập mật khẩu để xác thực"
                                    className="form-control-modern"
                                    autoFocus
                                />
                                <Form.Text className="text-muted">
                                    {passwordModalAction === 'module_roles'
                                        ? 'Nhập mật khẩu của bạn để xác nhận cập nhật quyền module cho người dùng.'
                                        : 'Nhập mật khẩu của bạn để xác nhận thay đổi vai trò người dùng.'}
                                </Form.Text>
                            </Form.Group>
                        </Form>
                    </div>
                </Modal.Body>
                <Modal.Footer className="student-detail-footer">
                    <Button variant="outline-secondary" onClick={() => setShowPasswordModal(false)} className="btn-cancel">
                        <i className="fas fa-times me-2"></i>
                        Hủy
                    </Button>
                    <Button
                        variant="primary"
                        onClick={confirmPasswordAction}
                        disabled={passwordLoading}
                        className="btn-edit"
                    >
                        {passwordLoading ? (
                            <>
                                <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                                Đang xử lý...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-check me-2"></i>
                                Xác nhận
                            </>
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* User MAC Policy Modal */}
            <Modal show={showMacPolicyModal} onHide={() => setShowMacPolicyModal(false)} size="lg" className="session-detail-modal">
                <Modal.Header closeButton className="student-detail-header">
                    <Modal.Title className="student-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-laptop"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Cài đặt chính sách MAC address</h4>
                            <p className="mb-0 student-subtitle">{selectedStudent?.full_name}</p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="student-detail-body">
                    <div className="student-detail-container">
                        {macPolicyLoading ? (
                            <div className="text-center p-4">
                                <Spinner animation="border" variant="primary" />
                                <p className="mt-3">Đang tải dữ liệu...</p>
                            </div>
                        ) : (
                            <Form>
                                <div className="session-card mb-4">
                                    <div className="card-header-modern">
                                        <div className="header-icon">
                                            <i className="fas fa-user"></i>
                                        </div>
                                        <h6 className="mb-0">Thông tin người dùng</h6>
                                    </div>
                                    <div className="card-body-modern">
                                        {selectedStudent && (
                                            <>
                                                <div className="info-item">
                                                    <div className="info-label">
                                                        <i className="fas fa-id-card me-2"></i>
                                                        Mã sinh viên
                                                    </div>
                                                    <div className="info-value">{selectedStudent.student_id || '-'}</div>
                                                </div>
                                                <div className="info-item">
                                                    <div className="info-label">
                                                        <i className="fas fa-user me-2"></i>
                                                        Họ và tên
                                                    </div>
                                                    <div className="info-value">{selectedStudent.full_name}</div>
                                                </div>
                                                <div className="info-item">
                                                    <div className="info-label">
                                                        <i className="fas fa-envelope me-2"></i>
                                                        Email
                                                    </div>
                                                    <div className="info-value">{selectedStudent.email}</div>
                                                </div>
                                                <div className="info-item">
                                                    <div className="info-label">
                                                        <i className="fas fa-network-wired me-2"></i>
                                                        Địa chỉ MAC
                                                    </div>
                                                    <div className="info-value">
                                                        <div className="mac-address-display">
                                                            {selectedStudent.device_mac || 'Chưa có liên kết thiết bị'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="session-card mb-4">
                                    <div className="card-header-modern">
                                        <div className="header-icon">
                                            <i className="fas fa-shield-alt"></i>
                                        </div>
                                        <h6 className="mb-0">Ngoại lệ chính sách MAC address</h6>
                                    </div>
                                    <div className="card-body-modern">
                                        <p className="text-muted mb-4">
                                            Các cài đặt dưới đây sẽ chỉ áp dụng cho người dùng này, ghi đè lên cài đặt chung
                                        </p>

                                        <Form.Group className="mb-4 d-flex align-items-center justify-content-between">
                                            <div>
                                                <Form.Label className="mb-0 fw-bold">Cho phép nhiều tài khoản trên một MAC</Form.Label>
                                                <Form.Text className="d-block text-muted">
                                                    Địa chỉ MAC của người dùng này có thể được sử dụng bởi các tài khoản khác.
                                                    <br />
                                                    <strong>NẾU TẮT:</strong> Chặn đăng nhập nếu MAC đã được sử dụng bởi tài khoản khác
                                                </Form.Text>
                                            </div>
                                            <Form.Check
                                                type="switch"
                                                checked={userMacPolicies.allow_multiple_accounts_per_mac}
                                                onChange={(e) => setUserMacPolicies({ ...userMacPolicies, allow_multiple_accounts_per_mac: e.target.checked })}
                                            />
                                        </Form.Group>

                                        <Form.Group className="mb-4 d-flex align-items-center justify-content-between">
                                            <div>
                                                <Form.Label className="mb-0 fw-bold">Cho phép nhiều MAC trên một tài khoản</Form.Label>
                                                <Form.Text className="d-block text-muted">
                                                    Tài khoản này có thể được sử dụng trên nhiều thiết bị khác nhau.
                                                    <br />
                                                    <strong>NẾU TẮT:</strong> Chặn đăng nhập nếu sử dụng thiết bị khác với thiết bị đã đăng ký
                                                </Form.Text>
                                            </div>
                                            <Form.Check
                                                type="switch"
                                                checked={userMacPolicies.allow_multiple_macs_per_account}
                                                onChange={(e) => setUserMacPolicies({ ...userMacPolicies, allow_multiple_macs_per_account: e.target.checked })}
                                            />
                                        </Form.Group>
                                    </div>
                                </div>
                            </Form>
                        )}
                    </div>
                </Modal.Body>
                <Modal.Footer className="student-detail-footer">
                    <Button variant="outline-danger" onClick={handleRemoveUserMacPolicyExceptions} disabled={macPolicyLoading} className="btn-delete">
                        <i className="fas fa-trash-alt me-2"></i>
                        Xóa ngoại lệ
                    </Button>
                    <Button variant="outline-secondary" onClick={() => setShowMacPolicyModal(false)} className="btn-cancel">
                        <i className="fas fa-times me-2"></i>
                        Đóng
                    </Button>
                    <Button variant="primary" onClick={handleSetUserMacPolicyExceptions} disabled={macPolicyLoading} className="btn-edit">
                        {macPolicyLoading ? (
                            <>
                                <Spinner animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
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

            {/* Student Group Modal */}
            <Modal show={showGroupModal} onHide={() => setShowGroupModal(false)} size="xl" className="student-detail-modal">
                <Modal.Header closeButton className="student-detail-header">
                    <Modal.Title className="student-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-layer-group"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">{selectedGroup ? 'Chỉnh sửa nhóm sinh viên' : 'Thêm nhóm sinh viên mới'}</h4>
                            <p className="mb-0 student-subtitle">Quản lý nhóm sinh viên</p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="student-detail-body">
                    <div className="student-detail-container">
                        <Form onSubmit={selectedGroup ? handleUpdateGroup : handleCreateGroup}>
                            <Row>
                                {/* Basic Information Card */}
                                <Col md={6}>
                                    <div className="session-card mb-4">
                                        <div className="card-header-modern">
                                            <div className="header-icon">
                                                <i className="fas fa-info-circle"></i>
                                            </div>
                                            <h6 className="mb-0">Thông tin nhóm</h6>
                                        </div>
                                        <div className="card-body-modern">
                                            <Form.Group className="mb-3">
                                                <Form.Label className="info-label">
                                                    <i className="fas fa-tag me-2"></i>
                                                    Tên nhóm
                                                </Form.Label>
                                                <Form.Text className="text-muted" style={{ fontSize: '0.65rem' }}>
                                                    Tạo tên nhóm theo quy tắc: <span className="fw-bold">Tên lớp</span> + <span className="fw-bold">-</span> + <span className="fw-bold">Số thứ tự nhóm</span> + <span className="fw-bold">-</span> + <span className="fw-bold">Tên bệnh viện thực tập (Viết tắt)</span>.
                                                </Form.Text>
                                                <Form.Control
                                                    type="text"
                                                    name="group_name"
                                                    value={groupFormData.group_name}
                                                    onChange={handleGroupFormChange}
                                                    required
                                                    className="form-control-modern"
                                                    placeholder="Nhập tên nhóm"
                                                />
                                                <Form.Text className="text-muted" style={{ fontSize: '0.75rem' }}>
                                                    Ví dụ: <span className="fw-bold">21YK-4-TTĐN</span>
                                                </Form.Text>
                                            </Form.Group>

                                            <Form.Group className="mb-3">
                                                <Form.Label className="info-label">
                                                    <i className="fas fa-align-left me-2"></i>
                                                    Mô tả
                                                </Form.Label>
                                                <Form.Control
                                                    as="textarea"
                                                    rows={4}
                                                    name="description"
                                                    value={groupFormData.description}
                                                    onChange={handleGroupFormChange}
                                                    className="form-control-modern"
                                                    placeholder="Nhập mô tả nhóm (tùy chọn)"
                                                />
                                            </Form.Group>
                                        </div>
                                    </div>
                                </Col>

                                {/* Class Selection Card */}
                                <Col md={6}>
                                    <div className="session-card mb-4">
                                        <div className="card-header-modern">
                                            <div className="header-icon">
                                                <i className="fas fa-users"></i>
                                            </div>
                                            <h6 className="mb-0">Chọn lớp</h6>
                                        </div>
                                        <div className="card-body-modern">
                                            <Form.Group className="mb-1">
                                                <Form.Label className="info-label">
                                                    <i className="fas fa-graduation-cap me-2"></i>
                                                    Lớp học
                                                </Form.Label>
                                                <Form.Select
                                                    multiple
                                                    name="selected_classes"
                                                    value={groupFormData.selected_classes}
                                                    onChange={handleClassSelectionChange}
                                                    required
                                                    className="form-control-modern"
                                                    size="10"
                                                    style={{ height: '230px' }}
                                                >
                                                    {availableClasses.length > 0 ? (
                                                        availableClasses.map((classItem, index) => (
                                                            <option key={index} value={classItem.class_name}>
                                                                {classItem.class_name} ({classItem.student_count} sinh viên)
                                                            </option>
                                                        ))
                                                    ) : (
                                                        <option disabled>Không có lớp nào được tìm thấy</option>
                                                    )}
                                                </Form.Select>
                                                <Form.Text className="text-muted">
                                                    {availableClasses.length > 0
                                                        ? "Giữ Ctrl (hoặc Cmd trên Mac) để chọn nhiều lớp"
                                                        : "Vui lòng kiểm tra lại dữ liệu sinh viên hoặc liên hệ quản trị viên"
                                                    }
                                                </Form.Text>
                                            </Form.Group>
                                        </div>
                                    </div>
                                </Col>
                            </Row>

                            {/* Student Selection Card */}
                            {studentsByClasses.length > 0 && (
                                <div className="session-card mb-4">
                                    <div className="card-header-modern">
                                        <div className="header-icon">
                                            <i className="fas fa-user-check"></i>
                                        </div>
                                        <h6 className="mb-0">Chọn sinh viên</h6>
                                        <Badge bg="success" className="fs-6">
                                            Đã chọn: {groupFormData.student_ids.length} sinh viên
                                        </Badge>
                                    </div>
                                    <div className="card-body-modern">
                                        <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                            <table className="table table-hover">
                                                <thead className="table-light sticky-top">
                                                    <tr>
                                                        <th>
                                                            <Form.Check
                                                                type="checkbox"
                                                                checked={studentsByClasses.length > 0 && studentsByClasses.every(s => groupFormData.student_ids.includes(s.id))}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setGroupFormData(prev => ({
                                                                            ...prev,
                                                                            student_ids: studentsByClasses.map(s => s.id)
                                                                        }));
                                                                    } else {
                                                                        setGroupFormData(prev => ({
                                                                            ...prev,
                                                                            student_ids: []
                                                                        }));
                                                                    }
                                                                }}
                                                            />
                                                        </th>
                                                        <th>Mã SV</th>
                                                        <th>Họ và tên</th>
                                                        <th>Email</th>
                                                        <th>Lớp</th>
                                                        <th>Nhóm</th>
                                                        <th>Giới tính</th>
                                                        <th>Tình trạng</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {studentsByClasses.map((student) => (
                                                        <tr 
                                                            key={student.id}
                                                            onClick={() => {
                                                                const isChecked = groupFormData.student_ids.includes(student.id);
                                                                handleStudentSelectionChange(student.id, !isChecked);
                                                            }}
                                                            style={{ cursor: 'pointer' }}
                                                        >
                                                            <td onClick={(e) => e.stopPropagation()}>
                                                                <Form.Check
                                                                    type="checkbox"
                                                                    checked={groupFormData.student_ids.includes(student.id)}
                                                                    onChange={(e) => {
                                                                        console.log('Debug - Checkbox changed for student:', student.id, 'checked:', e.target.checked);
                                                                        console.log('Debug - Current student_ids:', groupFormData.student_ids);
                                                                        e.stopPropagation();
                                                                        handleStudentSelectionChange(student.id, e.target.checked);
                                                                    }}
                                                                />
                                                            </td>
                                                            <td>
                                                                <Badge bg="secondary">{student.student_id}</Badge>
                                                            </td>
                                                            <td>{student.full_name}</td>
                                                            <td>{student.email}</td>
                                                            <td>
                                                                <Badge bg="info">{student.class_name}</Badge>
                                                            </td>
                                                            <td>
                                                                {student.group_names ? (
                                                                    <div>
                                                                        {student.group_names.split(', ').map((groupName, idx) => (
                                                                            <Badge key={idx} bg="info" className="me-1 mb-1">
                                                                                {groupName}
                                                                            </Badge>
                                                                        ))}
                                                                    </div>
                                                                ) : '-'}
                                                            </td>
                                                            <td>
                                                                {(() => {
                                                                    const gender = student.gender;

                                                                    if (gender === null || gender === undefined) {
                                                                        return 'Nam';
                                                                    } else if (gender === 'male') {
                                                                        return 'Nữ';
                                                                    } else if (gender === 'female') {
                                                                        return 'Nữ';
                                                                    } else if (gender === 'other') {
                                                                        return 'Khác';
                                                                    } else {
                                                                        return '-';
                                                                    }
                                                                })()}
                                                            </td>
                                                            <td>
                                                                <Badge bg={student.status === 'Đang học' ? 'success' :
                                                                    student.status === 'Tạm nghỉ' ? 'warning' :
                                                                        student.status === 'Thôi học' ? 'danger' : 'secondary'}>
                                                                    {student.status || 'Đang học'}
                                                                </Badge>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </Form>
                    </div>
                </Modal.Body>
                <Modal.Footer className="student-detail-footer">
                    <Button variant="outline-secondary" onClick={() => setShowGroupModal(false)} className="btn-cancel">
                        <i className="fas fa-times me-2"></i>
                        Hủy
                    </Button>
                    <Button
                        variant="primary"
                        type="submit"
                        onClick={selectedGroup ? handleUpdateGroup : handleCreateGroup}
                        disabled={loading}
                        className="btn-edit"
                    >
                        <i className="fas fa-save me-2"></i>
                        {loading ? 'Đang xử lý...' : (selectedGroup ? 'Cập nhật' : 'Tạo nhóm')}
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Student Group Detail Modal */}
            <Modal show={showGroupDetailModal} onHide={() => setShowGroupDetailModal(false)} size="xl" className="student-detail-modal">
                <Modal.Header closeButton className="student-detail-header">
                    <Modal.Title className="student-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-layer-group"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">{selectedGroup?.group_name || 'Chi tiết nhóm'}</h4>
                            <p className="mb-0 student-subtitle">Thông tin chi tiết nhóm sinh viên</p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="student-detail-body">
                    {selectedGroup && (
                        <div className="student-detail-container">
                            {/* Group Information */}
                            <div className="session-card mb-4">
                                <div className="card-header-modern">
                                    <div className="header-icon">
                                        <i className="fas fa-info-circle"></i>
                                    </div>
                                    <h6 className="mb-0">Thông tin nhóm</h6>
                                </div>
                                <div className="card-body-modern">
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="fas fa-tag me-2"></i>
                                            Tên nhóm
                                        </div>
                                        <div className="info-value">{selectedGroup.group_name}</div>
                                    </div>
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="fas fa-align-left me-2"></i>
                                            Mô tả
                                        </div>
                                        <div className="info-value">{selectedGroup.description || 'Không có mô tả'}</div>
                                    </div>
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="fas fa-graduation-cap me-2"></i>
                                            Lớp học
                                        </div>
                                        <div className="info-value">
                                            {selectedGroup.selected_classes && selectedGroup.selected_classes.length > 0 ? (
                                                selectedGroup.selected_classes.map((className, idx) => (
                                                    <Badge key={idx} bg="info" className="me-1 mb-1">
                                                        {className}
                                                    </Badge>
                                                ))
                                            ) : 'Không có lớp nào'}
                                        </div>
                                    </div>
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="fas fa-hashtag me-2"></i>
                                            Số sinh viên
                                        </div>
                                        <div className="info-value">
                                            <Badge bg="primary" className="fs-6">
                                                {selectedGroup.students ? selectedGroup.students.length : 0} sinh viên
                                            </Badge>
                                        </div>
                                    </div>
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="fas fa-calendar-plus me-2"></i>
                                            Ngày tạo
                                        </div>
                                        <div className="info-value">
                                            {selectedGroup.created_at ? new Date(selectedGroup.created_at).toLocaleString('vi-VN') : 'Không có'}
                                        </div>
                                    </div>
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="fas fa-user-plus me-2"></i>
                                            Người tạo nhóm
                                        </div>
                                        <div className="info-value">
                                            <Badge bg="primary" className="fs-6">
                                                {selectedGroup.created_by_name || 'Không có'}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Students List */}
                            {selectedGroup.students && selectedGroup.students.length > 0 && (
                                <div className="session-card">
                                    <div className="card-header-modern">
                                        <div className="header-icon">
                                            <i className="fas fa-users"></i>
                                        </div>
                                        <h6 className="mb-0">Danh sách sinh viên</h6>
                                    </div>
                                    <div className="card-body-modern">
                                        <div className="table-responsive">
                                            <table className="table table-hover">
                                                <thead className="table-light">
                                                    <tr>
                                                        <th>STT</th>
                                                        <th>Mã SV</th>
                                                        <th>Họ và tên</th>
                                                        <th>Lớp</th>
                                                        <th>Khoa</th>
                                                        <th>Ngành</th>
                                                        <th>Email</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {selectedGroup.students.map((student, index) => (
                                                        <tr key={student.id}>
                                                            <td>{index + 1}</td>
                                                            <td>
                                                                <Badge bg="secondary">{student.student_id}</Badge>
                                                            </td>
                                                            <td>{student.full_name}</td>
                                                            <td>
                                                                <Badge bg="info">{student.class_name}</Badge>
                                                            </td>
                                                            <td>{student.faculty_name}</td>
                                                            <td>{student.major_name}</td>
                                                            <td>
                                                                <small className="text-muted">{student.email}</small>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer className="student-detail-footer">
                    <Button variant="outline-secondary" onClick={() => setShowGroupDetailModal(false)} className="btn-cancel">
                        <i className="fas fa-times me-2"></i>
                        Đóng
                    </Button>
                    <Button
                        variant="primary"
                        onClick={() => {
                            if (selectedGroup) {
                                setShowGroupDetailModal(false);
                                handleEditGroup(selectedGroup);
                            }
                        }}
                        className="btn-edit"
                    >
                        <i className="fas fa-edit me-2"></i>
                        Chỉnh sửa
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Module Roles Management Modal */}
            <Modal show={showModuleRolesModal} onHide={() => {
                setShowModuleRolesModal(false);
                setShowPasswordModal(false); // Also close password modal if open
                setPasswordConfirm('');
                setPasswordError('');
            }} size="xl" className="student-detail-modal">
                <Modal.Header closeButton className="student-detail-header">
                    <Modal.Title className="student-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-shield-alt"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Quản lý quyền module</h4>
                            <p className="mb-0 student-subtitle">
                                {selectedUserForModuleRoles?.full_name || selectedUserForModuleRoles?.username || 'Người dùng'}
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
                                    <strong>Hướng dẫn:</strong> Chọn quyền module(IMS rail) cho người dùng này.
                                    Mỗi module chỉ được chọn <strong>1 cấp độ</strong>: <strong>Admin</strong> (toàn quyền), <strong>Mod</strong> (quyền điều hành), <strong>Staff</strong> (quyền nhân viên), hoặc <strong>View</strong> (chỉ xem).
                                </div>
                            </div>
                        </Alert>

                        <div className="row">
                            {Object.keys(moduleRolesConfig).map(module => (
                                <Col md={3} key={module} className="mb-2">
                                    <div className="session-card">
                                        <div className="card-header-modern">
                                            <div className="header-icon">
                                                <i className={`fas fa-${getModuleIcon(module)}`}></i>
                                            </div>
                                            <h6 className="mb-0 text-capitalize">{getModuleName(module)}</h6>
                                        </div>
                                        <div className="card-body-modern">
                                            {moduleRolesConfig[module].map(roleType => {
                                                const roleKey = `${module}_${roleType}`;
                                                const isChecked = userModuleRoles[roleKey] || false;
                                                return (
                                                    <Form.Check
                                                        key={roleKey}
                                                        type="checkbox"
                                                        id={roleKey}
                                                        label={
                                                            <span>
                                                                <strong className="text-capitalize">{roleType}</strong>
                                                                <small className="text-muted ms-2">
                                                                    {roleType === 'admin' && '(Toàn quyền)'}
                                                                    {roleType === 'mod' && '(Quyền điều hành)'}
                                                                    {roleType === 'staff' && '(Quyền nhân viên)'}
                                                                    {roleType === 'view' && '(Chỉ xem)'}
                                                                </small>
                                                            </span>
                                                        }
                                                        checked={isChecked}
                                                        onChange={() => handleToggleModuleRole(module, roleType)}
                                                        className="mb-3"
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>
                                </Col>
                            ))}
                        </div>

                        <div className="session-card mt-3">
                            <div className="card-header-modern">
                                <div className="header-icon">
                                    <i className="fas fa-list-check"></i>
                                </div>
                                <h6 className="mb-0">Tóm tắt quyền đã chọn</h6>
                            </div>
                            <div className="card-body-modern">
                                {(() => {
                                    const selectedRoles = Object.keys(userModuleRoles).filter(key => userModuleRoles[key]);
                                    if (selectedRoles.length === 0) {
                                        return <p className="text-muted mb-0">Chưa chọn quyền nào</p>;
                                    }

                                    // Format roles for display with module name and role type
                                    const formattedRoles = selectedRoles.map(roleKey => {
                                        const [module, roleType] = roleKey.split('_');
                                        return {
                                            display: formatModuleRole(roleKey),
                                            module: module,
                                            roleType: roleType,
                                            roleKey: roleKey
                                        };
                                    });

                                    // Sort by module name
                                    formattedRoles.sort((a, b) => a.module.localeCompare(b.module));

                                    // Badge colors for different role types
                                    const getRoleBadgeColor = (roleType) => {
                                        switch (roleType) {
                                            case 'admin': return 'danger';
                                            case 'mod': return 'warning';
                                            case 'staff': return 'info';
                                            case 'view': return 'secondary';
                                            default: return 'primary';
                                        }
                                    };

                                    return (
                                        <div className="d-flex align-items-center flex-wrap gap-2" style={{
                                            fontSize: '20px',
                                            lineHeight: '1.8'
                                        }}>
                                            {formattedRoles.map((item, index) => (
                                                <React.Fragment key={item.roleKey}>
                                                    <Badge bg={getRoleBadgeColor(item.roleType)} className="px-3 py-2" style={{ fontSize: '15px', fontWeight: '500' }}>
                                                        <i className={`fas fa-${getModuleIcon(item.module)} me-2`}></i>
                                                        {item.display}
                                                    </Badge>
                                                    {index < formattedRoles.length - 1 && (
                                                        <span style={{ color: '#adb5bd', margin: '0 2px' }}>•</span>
                                                    )}
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </Modal.Body>
                <Modal.Footer className="student-detail-footer">
                    <Button variant="outline-secondary" onClick={() => {
                        setShowModuleRolesModal(false);
                        setShowPasswordModal(false); // Also close password modal if open
                        setPasswordConfirm('');
                        setPasswordError('');
                    }} className="btn-cancel">
                        <i className="fas fa-times me-2"></i>
                        Hủy
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSaveModuleRoles}
                        disabled={loading}
                        className="btn-edit"
                    >
                        {loading ? (
                            <>
                                <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                                Đang lưu...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-save me-2"></i>
                                Lưu quyền module
                            </>
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Request Face Update Modal */}
            <Modal show={showRequestUpdateModal} onHide={() => {
                setShowRequestUpdateModal(false);
                setSelectedUserForUpdate(null);
                setUpdateRequestNotes('');
            }} size="lg" className="student-detail-modal">
                <Modal.Header closeButton className="student-detail-header">
                    <Modal.Title className="student-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-sync-alt"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Yêu cầu cập nhật Face Embedding</h4>
                            <p className="mb-0 student-subtitle">
                                {selectedUserForUpdate?.full_name || 'Người dùng'}
                            </p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="student-detail-body">
                    <div className="student-detail-container">
                        {selectedUserForUpdate && (
                            <div className="session-card mb-4">
                                <div className="card-header-modern">
                                    <div className="header-icon">
                                        <i className="fas fa-user"></i>
                                    </div>
                                    <h6 className="mb-0">Thông tin người dùng</h6>
                                </div>
                                <div className="card-body-modern">
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="fas fa-id-card me-2"></i>
                                            Mã sinh viên
                                        </div>
                                        <div className="info-value">{selectedUserForUpdate.student_id || '-'}</div>
                                    </div>
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="fas fa-user me-2"></i>
                                            Họ và tên
                                        </div>
                                        <div className="info-value">{selectedUserForUpdate.full_name}</div>
                                    </div>
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="fas fa-envelope me-2"></i>
                                            Email
                                        </div>
                                        <div className="info-value">{selectedUserForUpdate.email}</div>
                                    </div>
                                    {selectedUserForUpdate.face_sample_image && (
                                        <div className="info-item">
                                            <div className="info-label">
                                                <i className="fas fa-image me-2"></i>
                                                Ảnh face sample hiện tại
                                            </div>
                                            <div className="info-value">
                                                <img
                                                    src={selectedUserForUpdate.face_sample_image.startsWith('http') 
                                                        ? selectedUserForUpdate.face_sample_image 
                                                        : `${window.location.origin}${selectedUserForUpdate.face_sample_image}`}
                                                    alt="Face Sample"
                                                    style={{
                                                        width: '150px',
                                                        height: '150px',
                                                        objectFit: 'cover',
                                                        borderRadius: '8px',
                                                        border: '2px solid #256176'
                                                    }}
                                                    onError={(e) => {
                                                        if (e.target && e.target.style) {
                                                          e.target.style.display = 'none';
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="session-card">
                            <div className="card-header-modern">
                                <div className="header-icon">
                                    <i className="fas fa-comment-alt"></i>
                                </div>
                                <h6 className="mb-0">Ghi chú (tùy chọn)</h6>
                            </div>
                            <div className="card-body-modern">
                                <Form.Group>
                                    <Form.Control
                                        as="textarea"
                                        rows={4}
                                        value={updateRequestNotes}
                                        onChange={(e) => setUpdateRequestNotes(e.target.value)}
                                        placeholder="Nhập lý do yêu cầu cập nhật face embedding..."
                                        className="form-control-modern"
                                    />
                                </Form.Group>
                            </div>
                        </div>

                        <Alert variant="warning" className="mb-0">
                            <div className="d-flex align-items-center">
                                <i className="fas fa-exclamation-triangle me-3"></i>
                                <div>
                                    <strong>Lưu ý:</strong> Khi yêu cầu cập nhật, face embedding cũ sẽ bị xóa và người dùng sẽ phải đăng ký lại face embedding mới.
                                </div>
                            </div>
                        </Alert>
                    </div>
                </Modal.Body>
                <Modal.Footer className="student-detail-footer">
                    <Button variant="outline-secondary" onClick={() => {
                        setShowRequestUpdateModal(false);
                        setSelectedUserForUpdate(null);
                        setUpdateRequestNotes('');
                    }} className="btn-cancel">
                        <i className="fas fa-times me-2"></i>
                        Hủy
                    </Button>
                    <Button
                        variant="warning"
                        onClick={handleRequestFaceUpdate}
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
                                <i className="fas fa-sync-alt me-2"></i>
                                Gửi yêu cầu cập nhật
                            </>
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Allow Face Update Modal */}
            <Modal show={showAllowUpdateModal} onHide={() => {
                setShowAllowUpdateModal(false);
                setSelectedUserForUpdate(null);
                setUpdateRequestNotes('');
            }} size="lg" className="student-detail-modal">
                <Modal.Header closeButton className="student-detail-header">
                    <Modal.Title className="student-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-check-circle"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Cho phép cập nhật Face Embedding</h4>
                            <p className="mb-0 student-subtitle">
                                {selectedUserForUpdate?.full_name || 'Người dùng'}
                            </p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="student-detail-body">
                    <div className="student-detail-container">
                        {selectedUserForUpdate && (
                            <div className="session-card mb-4">
                                <div className="card-header-modern">
                                    <div className="header-icon">
                                        <i className="fas fa-user"></i>
                                    </div>
                                    <h6 className="mb-0">Thông tin người dùng</h6>
                                </div>
                                <div className="card-body-modern">
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="fas fa-id-card me-2"></i>
                                            Mã sinh viên
                                        </div>
                                        <div className="info-value">{selectedUserForUpdate.student_id || '-'}</div>
                                    </div>
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="fas fa-user me-2"></i>
                                            Họ và tên
                                        </div>
                                        <div className="info-value">{selectedUserForUpdate.full_name}</div>
                                    </div>
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="fas fa-envelope me-2"></i>
                                            Email
                                        </div>
                                        <div className="info-value">{selectedUserForUpdate.email}</div>
                                    </div>
                                    {selectedUserForUpdate.face_sample_image && (
                                        <div className="info-item">
                                            <div className="info-label">
                                                <i className="fas fa-image me-2"></i>
                                                Ảnh face sample hiện tại
                                            </div>
                                            <div className="info-value">
                                                <img
                                                    src={selectedUserForUpdate.face_sample_image.startsWith('http') 
                                                        ? selectedUserForUpdate.face_sample_image 
                                                        : `${window.location.origin}${selectedUserForUpdate.face_sample_image}`}
                                                    alt="Face Sample"
                                                    style={{
                                                        width: '150px',
                                                        height: '150px',
                                                        objectFit: 'cover',
                                                        borderRadius: '8px',
                                                        border: '2px solid #256176'
                                                    }}
                                                    onError={(e) => {
                                                        if (e.target && e.target.style) {
                                                          e.target.style.display = 'none';
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="session-card">
                            <div className="card-header-modern">
                                <div className="header-icon">
                                    <i className="fas fa-comment-alt"></i>
                                </div>
                                <h6 className="mb-0">Ghi chú (tùy chọn)</h6>
                            </div>
                            <div className="card-body-modern">
                                <Form.Group>
                                    <Form.Control
                                        as="textarea"
                                        rows={4}
                                        value={updateRequestNotes}
                                        onChange={(e) => setUpdateRequestNotes(e.target.value)}
                                        placeholder="Nhập lý do cho phép cập nhật face embedding..."
                                        className="form-control-modern"
                                    />
                                </Form.Group>
                            </div>
                        </div>

                        <Alert variant="info" className="mb-0">
                            <div className="d-flex align-items-center">
                                <i className="fas fa-info-circle me-3"></i>
                                <div>
                                    <strong>Lưu ý:</strong> Khi cho phép cập nhật, người dùng sẽ có thể tự cập nhật face embedding mà không cần xóa face embedding cũ. Face embedding cũ sẽ được thay thế bằng face embedding mới khi người dùng cập nhật.
                                </div>
                            </div>
                        </Alert>
                    </div>
                </Modal.Body>
                <Modal.Footer className="student-detail-footer">
                    <Button variant="outline-secondary" onClick={() => {
                        setShowAllowUpdateModal(false);
                        setSelectedUserForUpdate(null);
                        setUpdateRequestNotes('');
                    }} className="btn-cancel">
                        <i className="fas fa-times me-2"></i>
                        Hủy
                    </Button>
                    <Button
                        variant="success"
                        onClick={handleAllowFaceUpdate}
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
                                <i className="fas fa-check-circle me-2"></i>
                                Cho phép cập nhật
                            </>
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Revoke Face Update Permission Modal */}
            <Modal show={showRevokeModal} onHide={() => {
                setShowRevokeModal(false);
                setSelectedUserForRevoke(null);
            }} size="lg" className="student-detail-modal">
                <Modal.Header closeButton className="student-detail-header">
                    <Modal.Title className="student-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-times-circle"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Thu hồi quyền cập nhật Face Embedding</h4>
                            <p className="mb-0 student-subtitle">
                                {selectedUserForRevoke?.full_name || 'Người dùng'}
                            </p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="student-detail-body">
                    <div className="student-detail-container">
                        {selectedUserForRevoke && (
                            <div className="session-card mb-4">
                                <div className="card-header-modern">
                                    <div className="header-icon">
                                        <i className="fas fa-user"></i>
                                    </div>
                                    <h6 className="mb-0">Thông tin người dùng</h6>
                                </div>
                                <div className="card-body-modern">
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="fas fa-id-card me-2"></i>
                                            Mã sinh viên
                                        </div>
                                        <div className="info-value">{selectedUserForRevoke.student_id || '-'}</div>
                                    </div>
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="fas fa-user me-2"></i>
                                            Họ và tên
                                        </div>
                                        <div className="info-value">{selectedUserForRevoke.full_name}</div>
                                    </div>
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="fas fa-envelope me-2"></i>
                                            Email
                                        </div>
                                        <div className="info-value">{selectedUserForRevoke.email}</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <Alert variant="warning" className="mb-0">
                            <div className="d-flex align-items-center">
                                <i className="fas fa-exclamation-triangle me-3"></i>
                                <div>
                                    <strong>Lưu ý:</strong> Khi thu hồi quyền cập nhật, người dùng sẽ không thể tự cập nhật face embedding nữa. Họ sẽ phải liên hệ quản trị viên để yêu cầu cập nhật lại.
                                </div>
                            </div>
                        </Alert>
                    </div>
                </Modal.Body>
                <Modal.Footer className="student-detail-footer">
                    <Button variant="outline-secondary" onClick={() => {
                        setShowRevokeModal(false);
                        setSelectedUserForRevoke(null);
                    }} className="btn-cancel">
                        <i className="fas fa-times me-2"></i>
                        Hủy
                    </Button>
                    <Button
                        variant="danger"
                        onClick={handleRevokeFaceUpdate}
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
                                <i className="fas fa-times-circle me-2"></i>
                                Thu hồi quyền
                            </>
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Approve User Request Modal */}
            <Modal show={showApproveUserRequestModal} onHide={() => {
                setShowApproveUserRequestModal(false);
                setSelectedUserForUpdate(null);
            }} size="lg" className="student-detail-modal">
                <Modal.Header closeButton className="student-detail-header">
                    <Modal.Title className="student-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-check-circle"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Chấp nhận yêu cầu đặt lại khuôn mặt</h4>
                            <p className="mb-0 student-subtitle">
                                {selectedUserForUpdate?.full_name || 'Người dùng'}
                            </p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="student-detail-body">
                    <div className="student-detail-container">
                        {selectedUserForUpdate && (
                            <div className="session-card mb-4">
                                <div className="card-header-modern">
                                    <div className="header-icon">
                                        <i className="fas fa-user"></i>
                                    </div>
                                    <h6 className="mb-0">Thông tin người dùng</h6>
                                </div>
                                <div className="card-body-modern">
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="fas fa-id-card me-2"></i>
                                            Mã sinh viên
                                        </div>
                                        <div className="info-value">{selectedUserForUpdate.student_id || '-'}</div>
                                    </div>
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="fas fa-user me-2"></i>
                                            Họ và tên
                                        </div>
                                        <div className="info-value">{selectedUserForUpdate.full_name}</div>
                                    </div>
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="fas fa-envelope me-2"></i>
                                            Email
                                        </div>
                                        <div className="info-value">{selectedUserForUpdate.email}</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <Alert variant="warning" className="mb-0">
                            <div className="d-flex align-items-center">
                                <i className="fas fa-exclamation-triangle me-3"></i>
                                <div>
                                    <strong>Lưu ý:</strong> Khi chấp nhận yêu cầu, face embedding cũ của người dùng sẽ bị xóa và họ sẽ phải đăng ký lại mẫu khuôn mặt mới.
                                </div>
                            </div>
                        </Alert>
                    </div>
                </Modal.Body>
                <Modal.Footer className="student-detail-footer">
                    <Button variant="outline-secondary" onClick={() => {
                        setShowApproveUserRequestModal(false);
                        setSelectedUserForUpdate(null);
                    }} className="btn-cancel">
                        <i className="fas fa-times me-2"></i>
                        Hủy
                    </Button>
                    <Button
                        variant="success"
                        onClick={handleApproveUserRequest}
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
                                <i className="fas fa-check-circle me-2"></i>
                                Chấp nhận
                            </>
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Reject User Request Modal */}
            <Modal show={showRejectUserRequestModal} onHide={() => {
                setShowRejectUserRequestModal(false);
                setSelectedUserForRevoke(null);
            }} size="lg" className="student-detail-modal">
                <Modal.Header closeButton className="student-detail-header">
                    <Modal.Title className="student-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-times-circle"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Từ chối yêu cầu đặt lại khuôn mặt</h4>
                            <p className="mb-0 student-subtitle">
                                {selectedUserForRevoke?.full_name || 'Người dùng'}
                            </p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="student-detail-body">
                    <div className="student-detail-container">
                        {selectedUserForRevoke && (
                            <div className="session-card mb-4">
                                <div className="card-header-modern">
                                    <div className="header-icon">
                                        <i className="fas fa-user"></i>
                                    </div>
                                    <h6 className="mb-0">Thông tin người dùng</h6>
                                </div>
                                <div className="card-body-modern">
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="fas fa-id-card me-2"></i>
                                            Mã sinh viên
                                        </div>
                                        <div className="info-value">{selectedUserForRevoke.student_id || '-'}</div>
                                    </div>
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="fas fa-user me-2"></i>
                                            Họ và tên
                                        </div>
                                        <div className="info-value">{selectedUserForRevoke.full_name}</div>
                                    </div>
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="fas fa-envelope me-2"></i>
                                            Email
                                        </div>
                                        <div className="info-value">{selectedUserForRevoke.email}</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <Alert variant="info" className="mb-0">
                            <div className="d-flex align-items-center">
                                <i className="fas fa-info-circle me-3"></i>
                                <div>
                                    <strong>Lưu ý:</strong> Khi từ chối yêu cầu, người dùng sẽ vẫn giữ nguyên face embedding hiện tại và yêu cầu sẽ bị hủy.
                                </div>
                            </div>
                        </Alert>
                    </div>
                </Modal.Body>
                <Modal.Footer className="student-detail-footer">
                    <Button variant="outline-secondary" onClick={() => {
                        setShowRejectUserRequestModal(false);
                        setSelectedUserForRevoke(null);
                    }} className="btn-cancel">
                        <i className="fas fa-times me-2"></i>
                        Hủy
                    </Button>
                    <Button
                        variant="danger"
                        onClick={handleRejectUserRequest}
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
                                <i className="fas fa-times-circle me-2"></i>
                                Từ chối
                            </>
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Delete Group Confirmation Modal */}
            <Modal show={showDeleteGroupModal} onHide={() => setShowDeleteGroupModal(false)} size="lg" className="student-detail-modal">
                <Modal.Header closeButton className="student-detail-header">
                    <Modal.Title className="student-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-exclamation-triangle"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Xác nhận xóa nhóm</h4>
                            <p className="mb-0 student-subtitle">Xóa nhóm sinh viên khỏi hệ thống</p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="student-detail-body">
                    <div className="student-detail-container">
                        {groupToDelete && (
                            <div className="session-card">
                                <div className="card-header-modern">
                                    <div className="header-icon">
                                        <i className="fas fa-layer-group"></i>
                                    </div>
                                    <h6 className="mb-0">Thông tin nhóm sẽ bị xóa</h6>
                                </div>
                                <div className="card-body-modern">
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="fas fa-tag me-2"></i>
                                            Tên nhóm
                                        </div>
                                        <div className="info-value">{groupToDelete.group_name}</div>
                                    </div>
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="fas fa-hashtag me-2"></i>
                                            Số sinh viên
                                        </div>
                                        <div className="info-value">
                                            <Badge bg="primary">{groupToDelete.student_count || 0} sinh viên</Badge>
                                        </div>
                                    </div>
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="fas fa-graduation-cap me-2"></i>
                                            Lớp học
                                        </div>
                                        <div className="info-value">
                                            {groupToDelete.selected_classes && groupToDelete.selected_classes.length > 0 ? (
                                                groupToDelete.selected_classes.map((className, idx) => (
                                                    <Badge key={idx} bg="info" className="me-1 mb-1">
                                                        {className}
                                                    </Badge>
                                                ))
                                            ) : 'Không có lớp nào'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <Alert variant="danger" className="mb-0">
                            <div className="d-flex align-items-center">
                                <i className="fas fa-exclamation-triangle me-3"></i>
                                <div>
                                    <strong>Cảnh báo:</strong> Hành động này không thể hoàn tác. Tất cả dữ liệu liên quan đến nhóm này sẽ bị xóa vĩnh viễn.
                                </div>
                            </div>
                        </Alert>
                    </div>
                </Modal.Body>
                <Modal.Footer className="student-detail-footer">
                    <Button variant="outline-secondary" onClick={() => setShowDeleteGroupModal(false)} className="btn-cancel">
                        <i className="fas fa-times me-2"></i>
                        Hủy
                    </Button>
                    <Button
                        variant="danger"
                        onClick={handleDeleteGroup}
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
                                Xóa nhóm
                            </>
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Face Image Preview Modal */}
            <Modal 
                show={showFaceImageModal} 
                onHide={() => setShowFaceImageModal(false)}
                centered
                size="lg"
                className="image-preview-modal"
            >
                <Modal.Header closeButton style={{ border: 'none', paddingBottom: '0' }}>
                    <Modal.Title>Mẫu khuôn mặt</Modal.Title>
                </Modal.Header>
                <Modal.Body className="text-center p-4">
                    {selectedFaceImage && (
                        <img
                            src={selectedFaceImage.startsWith('http') 
                                ? selectedFaceImage 
                                : `${window.location.origin}${selectedFaceImage}`}
                            alt="Face Sample - Full Size"
                            style={{
                                maxWidth: '100%',
                                maxHeight: '70vh',
                                objectFit: 'contain',
                                borderRadius: '8px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                            }}
                            onError={(e) => {
                                if (e.target && e.target.style) {
                                  e.target.style.display = 'none';
                                }
                            }}
                        />
                    )}
                </Modal.Body>
            </Modal>

            {/* Statistics Detail Modal */}
            <Modal
                show={statDetailModal.show}
                onHide={() => setStatDetailModal(prev => ({ ...prev, show: false }))}
                size="xl"
                className="student-detail-modal"
                centered
                backdrop={true}
            >
                <Modal.Header className="student-detail-header">
                    <div className="d-flex justify-content-between align-items-center w-100">
                        <div className="d-flex align-items-center student-detail-title">
                            <div className="student-avatar">
                                <i className="fas fa-chart-bar"></i>
                            </div>
                            <div>
                                <h4 className="mb-0">
                                    {statDetailModal.metric === 'late' && 'Chi tiết: Đi trễ'}
                                    {statDetailModal.metric === 'missingTimeSlot' && 'Chi tiết: Thiếu giờ điểm danh'}
                                    {statDetailModal.metric === 'absent' && 'Chi tiết: Vắng mặt'}
                                    {statDetailModal.metric === 'sessions' && 'Chi tiết: Tổng số buổi học'}
                                    {statDetailModal.metric === 'location' && 'Chi tiết: Địa điểm'}
                                </h4>
                                {selectedStudent && (
                                    <p className="mb-0 student-subtitle">
                                        {selectedStudent.full_name} - {selectedStudent.student_id}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                            {!statDetailModal.loading && !statDetailModal.error && statDetailModal.data && statDetailModal.data.length > 0 && (
                                <>
                                    <Button
                                        variant="link"
                                        size="sm"
                                        onClick={exportToExcel}
                                        className="btn-icon text-white d-flex align-items-center justify-content-center"
                                        title="Xuất Excel"
                                        aria-label="Xuất Excel"
                                        style={{ fontSize: '1.5rem', padding: '0.5rem' }}
                                    >
                                        <i className="fas fa-file-excel"></i>
                                    </Button>
                                    <Button
                                        variant="link"
                                        size="sm"
                                        onClick={exportToWord}
                                        className="btn-icon text-white d-flex align-items-center justify-content-center"
                                        title="Xuất Word"
                                        aria-label="Xuất Word"
                                        style={{ fontSize: '1.5rem', padding: '0.5rem' }}
                                    >
                                        <i className="fas fa-file-word"></i>
                                    </Button>
                                </>
                            )}
                            <Button
                                variant="link"
                                size="sm"
                                onClick={() => setStatDetailModal(prev => ({ ...prev, show: false }))}
                                className="btn-icon text-danger d-flex align-items-center justify-content-center"
                                aria-label="Đóng"
                                style={{ fontSize: '1.5rem', padding: '0.5rem' }}
                            >
                                <i className="fas fa-times"></i>
                            </Button>
                        </div>
                    </div>
                </Modal.Header>
                <Modal.Body className="student-detail-body">
                    <div className="student-detail-container">
                        {statDetailModal.loading && (
                            <p className="text-muted text-center my-3">Đang tải dữ liệu...</p>
                        )}
                        {statDetailModal.error && (
                            <p className="text-danger text-center my-3">{statDetailModal.error}</p>
                        )}
                        {!statDetailModal.loading && !statDetailModal.error && (
                            <>
                                {(!statDetailModal.data || statDetailModal.data.length === 0) ? (
                                    <p className="text-muted text-center my-3">
                                        Không có dữ liệu thống kê cho mục này.
                                    </p>
                                ) : (
                                    <div className="table-responsive">
                                        <table className="table table-sm align-middle">
                                            <thead>
                                                <tr>
                                                    {statDetailModal.metric === 'location' ? (
                                                        <>
                                                            <th>#</th>
                                                            <th>Tên địa điểm</th>
                                                            <th>Số buổi học</th>
                                                            <th>Ngày đầu tiên</th>
                                                            <th>Ngày cuối cùng</th>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <th>#</th>
                                                            <th>Buổi học</th>
                                                            <th>Ngày</th>
                                                            {(statDetailModal.metric === 'late' ||
                                                              statDetailModal.metric === 'sessions') && (
                                                                <th>Giờ bắt đầu</th>
                                                            )}
                                                            {statDetailModal.metric === 'sessions' && (
                                                                <th>Giờ kết thúc</th>
                                                            )}
                                                            {statDetailModal.metric === 'sessions' && (
                                                                <th>Địa điểm</th>
                                                            )}
                                                            {statDetailModal.metric === 'late' && (
                                                                <>
                                                                    <th>Giờ điểm danh</th>
                                                                    <th>Đi trễ (phút)</th>
                                                                </>
                                                            )}
                                                            {statDetailModal.metric === 'missingTimeSlot' && (
                                                                <th>Loại thiếu</th>
                                                            )}
                                                            {statDetailModal.metric === 'sessions' && (
                                                                <th>Trạng thái</th>
                                                            )}
                                                        </>
                                                    )}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(statDetailModal.metric === 'location' 
                                                    ? statDetailModal.data.filter(item => {
                                                        const hasLocation = item.location_name && String(item.location_name).trim() !== '';
                                                        const hasSessions = (item.session_count || 0) > 0;
                                                        return hasLocation && hasSessions;
                                                    })
                                                    : statDetailModal.data
                                                ).map((item, index) => (
                                                    <tr key={`${statDetailModal.metric}-${index}-${item.session_id || item.id || item.location_name}`}>
                                                        {statDetailModal.metric === 'location' ? (
                                                            <>
                                                                <td>{index + 1}</td>
                                                                <td><strong>{item.location_name || '-'}</strong></td>
                                                                <td><Badge bg="primary">{item.session_count || 0}</Badge></td>
                                                                <td>{formatDate(item.first_session_date)}</td>
                                                                <td>{formatDate(item.last_session_date)}</td>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <td>{index + 1}</td>
                                                                <td>{item.session_title || item.title || '-'}</td>
                                                                <td>{formatDate(item.session_date || item.date)}</td>
                                                                {(statDetailModal.metric === 'late' ||
                                                                  statDetailModal.metric === 'sessions') && (
                                                                    <td>{formatTime(item.start_time)}</td>
                                                                )}
                                                                {statDetailModal.metric === 'sessions' && (
                                                                    <td>{formatTime(item.end_time)}</td>
                                                                )}
                                                                {statDetailModal.metric === 'sessions' && (
                                                                    <td>{item.location || '-'}</td>
                                                                )}
                                                                {statDetailModal.metric === 'late' && (
                                                                    <>
                                                                        <td>{formatTime(item.check_in_time)}</td>
                                                                        <td>{item.minutes_late != null ? `${item.minutes_late} phút` : '-'}</td>
                                                                    </>
                                                                )}
                                                                {statDetailModal.metric === 'missingTimeSlot' && (
                                                                    <td>{item.missing_type || '-'}</td>
                                                                )}
                                                                {statDetailModal.metric === 'sessions' && (
                                                                    <td>
                                                                        {item.status === 'ended' ? 'Đã kết thúc' :
                                                                         item.status === 'active' ? 'Đang diễn ra' :
                                                                         item.status === 'scheduled' ? 'Đã lên lịch' :
                                                                         item.status || '-'}
                                                                    </td>
                                                                )}
                                                            </>
                                                        )}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </Modal.Body>
            </Modal>

            {/* Face User Detail Modal */}
            <Modal 
                show={showFaceUserDetailModal} 
                onHide={() => {
                    setShowFaceUserDetailModal(false);
                    setSelectedFaceUser(null);
                }}
                size="lg"
                className="student-detail-modal"
            >
                <Modal.Header closeButton className="student-detail-header">
                    <Modal.Title className="student-detail-title">
                        <div className="d-flex align-items-center">
                            <div className="header-icon me-3">
                                <i className="fas fa-user-circle"></i>
                            </div>
                            <div>
                                <h4 className="mb-0">Chi tiết người dùng</h4>
                                <p className="mb-0 student-subtitle">
                                    {selectedFaceUser?.full_name || 'Người dùng'}
                                </p>
                            </div>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="student-detail-body">
                    {selectedFaceUser && (
                        <div className="container-fluid">
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
                                            <i className="fas fa-user me-2"></i>
                                            Họ và tên
                                        </div>
                                        <div className="info-value">
                                            {selectedFaceUser.full_name || '-'}
                                            {selectedFaceUser.face_embedding && (
                                                <i className="fas fa-check-circle text-success ms-2" title="Đã xác thực khuôn mặt"></i>
                                            )}
                                        </div>
                                    </div>
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="fas fa-id-badge me-2"></i>
                                            Mã sinh viên
                                        </div>
                                        <div className="info-value">{selectedFaceUser.student_id || '-'}</div>
                                    </div>
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="fas fa-envelope me-2"></i>
                                            Email
                                        </div>
                                        <div className="info-value">{selectedFaceUser.email || '-'}</div>
                                    </div>
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="fas fa-users me-2"></i>
                                            Lớp
                                        </div>
                                        <div className="info-value">{selectedFaceUser.class_name || '-'}</div>
                                    </div>
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="fas fa-building me-2"></i>
                                            Khoa
                                        </div>
                                        <div className="info-value">{selectedFaceUser.faculty_name || '-'}</div>
                                    </div>
                                    {selectedFaceUser.major_name && (
                                        <div className="info-item">
                                            <div className="info-label">
                                                <i className="fas fa-graduation-cap me-2"></i>
                                                Ngành
                                            </div>
                                            <div className="info-value">{selectedFaceUser.major_name}</div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="session-card">
                                <div className="card-header-modern">
                                    <div className="header-icon">
                                        <i className="fas fa-face-smile"></i>
                                    </div>
                                    <h6 className="mb-0">Thông tin Face Embedding</h6>
                                </div>
                                <div className="card-body-modern">
                                    {selectedFaceUser.face_sample_image ? (
                                        <>
                                            <div className="info-item">
                                                <div className="info-value">
                                                    <img
                                                        src={selectedFaceUser.face_sample_image.startsWith('http') 
                                                            ? selectedFaceUser.face_sample_image 
                                                            : `${window.location.origin}${selectedFaceUser.face_sample_image}`}
                                                        alt="Face Sample"
                                                        onClick={() => {
                                                            setSelectedFaceImage(selectedFaceUser.face_sample_image);
                                                            setShowFaceImageModal(true);
                                                        }}
                                                        style={{
                                                            width: '200px',
                                                            height: '200px',
                                                            objectFit: 'cover',
                                                            borderRadius: '8px',
                                                            border: '2px solid #256176',
                                                            cursor: 'pointer',
                                                            transition: 'transform 0.2s ease'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            if (e.target && e.target.style) {
                                                              e.target.style.transform = 'scale(1.05)';
                                                            }
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            if (e.target && e.target.style) {
                                                              e.target.style.transform = 'scale(1)';
                                                            }
                                                        }}
                                                        onError={(e) => {
                                                            if (e.target && e.target.style) {
                                                              e.target.style.display = 'none';
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                            <div className="info-item">
                                                <div className="info-label">
                                                    <i className="fas fa-calendar me-2"></i>
                                                    Ngày đăng ký
                                                </div>
                                                <div className="info-value">
                                                    {selectedFaceUser.face_registered_at 
                                                        ? new Date(selectedFaceUser.face_registered_at).toLocaleDateString('vi-VN', {
                                                            year: 'numeric',
                                                            month: 'long',
                                                            day: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })
                                                        : '-'}
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-muted text-center py-3">
                                            <i className="fas fa-exclamation-circle me-2"></i>
                                            Chưa có mẫu khuôn mặt
                                        </div>
                                    )}
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="fas fa-bell me-2"></i>
                                            Trạng thái yêu cầu cập nhật
                                        </div>
                                        <div className="info-value">
                                            {selectedFaceUser.pending_update_requests > 0 ? (
                                                <Badge bg={selectedFaceUser.pending_update_type === 'allow' ? 'info' : 'warning'}>
                                                    {selectedFaceUser.pending_update_type === 'allow' ? 'Được phép' : 'Có yêu cầu'}
                                                </Badge>
                                            ) : (
                                                <Badge bg="success">Không có</Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer className="student-detail-footer">
                    <Button 
                        variant="outline-secondary" 
                        onClick={() => {
                            setShowFaceUserDetailModal(false);
                            setSelectedFaceUser(null);
                        }}
                        className="btn-cancel"
                    >
                        <i className="fas fa-times me-2"></i>
                        Đóng
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default UserManagement;
