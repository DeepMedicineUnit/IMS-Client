import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Table, Button, Badge, Tabs, Tab, Form, Modal, Spinner, Alert, ProgressBar, Dropdown } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import '../../styles/calendar.css';

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
    border: 1px solid #dee2e6;
  }
  
  .btn-icon:hover {
    background-color: #f0f0f0;
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

  /* Hide pagination on mobile */
  @media (max-width: 768px) {
    .pagination-container {
      display: none !important;
    }
  }
`;

const UserManagement = () => {
  const { api, currentUser } = useAuth();
  // Always start with students tab for better compatibility
  const [activeTab, setActiveTab] = useState('students');
  const [users, setUsers] = useState([]);
  const [students, setStudents] = useState([]);
  const [allStudents, setAllStudents] = useState([]); // Tất cả sinh viên không bị filter
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
  const [bulkEmailTab, setBulkEmailTab] = useState('all');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState('');
  const [selectedMajor, setSelectedMajor] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState({});
  
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
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
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

  useEffect(() => {
    // Log current filter values for debugging
    console.log('Filters changed. Current values:', {
      activeTab,
      currentPage,
      searchTerm,
      classFilter,
      facultyFilter,
      majorFilter,
      statusFilter,
      sortField,
      sortOrder
    });
    
    fetchUsers();
  }, [activeTab, currentPage, searchTerm, classFilter, facultyFilter, majorFilter, statusFilter, sortField, sortOrder]);

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
      const response = await api.get('/users?role=student&limit=1000'); // Lấy tất cả sinh viên
      if (response.data && response.data.success) {
        setAllStudents(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching all students:', error);
      setAllStudents([]);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');

      const role = activeTab === 'students' ? 'student' : '';
      const excludeRole = activeTab === 'staff' ? 'student' : '';
      
      // Kiểm tra isMobile trực tiếp từ window.innerWidth để tránh lỗi state
      const currentIsMobile = window.innerWidth <= 768;
      
      // Trên di động hiển thị tất cả danh sách, desktop có pagination
      const limit = currentIsMobile ? 10000 : 10;
      const page = currentIsMobile ? 1 : currentPage; // Trên di động luôn dùng trang 1
      let url = `/users?page=${page}&limit=${limit}`;
      
      if (role) {
        url += `&role=${role}`;
      }
      
      if (excludeRole) {
        url += `&excludeRole=${excludeRole}`;
      }
      
      if (searchTerm) {
        url += `&search=${encodeURIComponent(searchTerm)}`;
      }
      
      // Thêm các tham số lọc mới
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
        
        setTotalPages(response.data.pagination?.totalPages || 1);
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
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    // Chỉ reset currentPage trên desktop, di động luôn dùng trang 1
    const currentIsMobile = window.innerWidth <= 768;
    if (!currentIsMobile) {
      setCurrentPage(1);
    }
    setSearchTerm('');
    setClassFilter('');
    setFacultyFilter('');
    setMajorFilter('');
    setNewUser(prev => ({
      ...prev,
      role: tab === 'students' ? 'student' : 'staff'
    }));
    
    // Fetch data for the new tab
    setTimeout(() => {
      fetchUsers();
    }, 100);
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
        toast.success('Đã xóa địa chỉ MAC thành công');
        fetchUsers(); // Refresh user data
      } else {
        toast.error(response.data.message || 'Có lỗi xảy ra');
      }
    } catch (error) {
      console.error('Error resetting MAC:', error);
      toast.error(error.response?.data?.message || 'Có lỗi xảy ra khi xóa địa chỉ MAC');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle student row click to show details
  const handleStudentRowClick = (student) => {
    setSelectedStudent(student);
    setShowDetailModal(true);
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
        toast.error('Không thể tải ngoại lệ chính sách MAC address của người dùng');
      }
    } catch (error) {
      console.error('Error fetching user MAC policy exceptions:', error);
      toast.error('Không thể tải ngoại lệ chính sách MAC address của người dùng. Vui lòng thử lại sau.');
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
        toast.success('Cập nhật ngoại lệ chính sách MAC address thành công');
        setShowMacPolicyModal(false);
        // Refresh data to show updated values
        if (selectedStudent) {
          fetchUserMacPolicyExceptions(selectedStudent.id);
        }
      } else {
        toast.error(response.data.message || 'Không thể cập nhật ngoại lệ chính sách MAC address');
      }
    } catch (error) {
      console.error('Error setting user MAC policy exceptions:', error);
      
      // Handle specific error cases
      if (error.response && error.response.status === 400) {
        toast.error(error.response.data?.message || 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.');
      } else if (error.response && error.response.status === 404) {
        toast.error('Không tìm thấy người dùng');
      } else {
        toast.error('Không thể cập nhật ngoại lệ chính sách MAC address. Vui lòng thử lại sau.');
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
        toast.success('Xóa ngoại lệ chính sách MAC address thành công');
        setShowMacPolicyModal(false);
      } else {
        toast.error(response.data.message || 'Không thể xóa ngoại lệ chính sách MAC address');
      }
    } catch (error) {
      // Handle 404 as success (no exceptions to delete)
      if (error.response && error.response.status === 404) {
        console.log('No MAC policy exceptions found for user - treating as success');
        toast.success('Không có ngoại lệ chính sách MAC address để xóa');
        setShowMacPolicyModal(false);
      } else {
        console.error('Error removing user MAC policy exceptions:', error);
        toast.error('Không thể xóa ngoại lệ chính sách MAC address. Vui lòng thử lại sau.');
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
        toast.success('Đã gửi thông tin đăng nhập thành công');
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
    fetchAllStudents(); // Fetch tất cả sinh viên khi mở modal
  };
  
  const sendBulkCredentialsEmail = async () => {
    setBulkEmailLoading(true);
    
    try {
      let filteredStudents;
      
      if (bulkEmailTab === 'all') {
        // Filter all students that have display_password
        filteredStudents = allStudents.filter(s => s.display_password);
      } else {
        // Filter students based on selected class, faculty, or major
        filteredStudents = allStudents.filter(s => 
          s.display_password && 
          (!selectedClass || s.class_name === selectedClass) &&
          (!selectedFaculty || s.faculty_name === selectedFaculty) &&
          (!selectedMajor || s.major_name === selectedMajor)
        );
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
      const response = await api.post('/users/credentials/bulk-send-credentials', requestData);
      
      if (response.data.success) {
        toast.success(`Đã gửi ${response.data.sent} email thành công`);
        setShowBulkEmailModal(false);
        
        // Reset filters
        setSelectedClass('');
        setSelectedFaculty('');
        setSelectedMajor('');
        setBulkEmailTab('all');
      } else {
        setError(response.data.message || 'Lỗi khi gửi email hàng loạt');
      }
    } catch (error) {
      console.error('Error sending bulk credentials:', error);
      setError(error.response?.data?.message || 'Lỗi khi gửi email hàng loạt');
    } finally {
      setBulkEmailLoading(false);
    }
  };

  // State for password confirmation modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [pendingRoleChange, setPendingRoleChange] = useState({ userId: null, newRole: '' });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const handleChangeRole = async (userId, newRole) => {
    // Store the pending role change and show password modal
    setPendingRoleChange({ userId, newRole });
    setPasswordConfirm('');
    setPasswordError('');
    setShowPasswordModal(true);
  };
  
  const confirmRoleChange = async () => {
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
        // Password is correct, proceed with role change
        const response = await api.patch(
          `/auth/change-role/${pendingRoleChange.userId}`, 
          { role: pendingRoleChange.newRole }
        );
        
        if (response.data.success) {
          setShowPasswordModal(false);
          fetchUsers();
          toast.success('Đã thay đổi vai trò người dùng thành công');
        }
      } else {
        setPasswordError('Xác thực mật khẩu thất bại');
      }
    } catch (error) {
      console.error('Error in role change process:', error);
      setPasswordError(error.response?.data?.message || 'Không thể thay đổi vai trò người dùng. Vui lòng thử lại sau.');
    } finally {
      setPasswordLoading(false);
    }
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
          'Phái': student.gender === 0 || student.gender === '0' || student.gender === null ? 'Nam' : 
                 student.gender === 1 || student.gender === '1' ? 'Nữ' : 
                 student.gender === 2 || student.gender === '2' ? 'Khác' : '',
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
        
        toast.success('Xuất danh sách người dùng thành công!');
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
        toast.success(response.data.message || 'Đã xóa toàn bộ danh sách sinh viên');
        fetchUsers();
      } else {
        toast.error(response.data.message || 'Lỗi khi xóa danh sách sinh viên');
      }
    } catch (error) {
      console.error('Delete all students error:', error);
      toast.error(error.response?.data?.message || 'Lỗi khi xóa danh sách sinh viên');
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
    setEditFormData({
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      password: '',
      role: user.role,
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
  
  const handleUpdateUser = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError('');
      
      const userData = {
        username: editFormData.username,
        email: editFormData.email,
        fullName: editFormData.fullName,
        role: editFormData.role
      };
      
      // Add additional fields for students
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
        fetchUsers();
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
    setCurrentPage(1);
    fetchUsers();
  };
  
  const handleFilterChange = (filterType, value) => {
    setCurrentPage(1);
    
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
    setCurrentPage(1);
    
    // If clicking the same field, toggle the sort order
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // If clicking a new field, set it as the sort field and default to ascending order
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const renderPagination = () => {
    // Không hiển thị pagination trên di động
    const currentIsMobile = window.innerWidth <= 768;
    if (currentIsMobile) return null;
    
    // Tối ưu hiển thị phân trang, chỉ hiển thị trang hiện tại và các trang lân cận
    const maxPagesToShow = 5;
    const pages = [];
    
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    
    // Điều chỉnh lại startPage nếu endPage đã đạt giới hạn
    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    
    // Thêm nút trang đầu tiên nếu cần
    if (startPage > 1) {
      pages.push(
        <Button 
          key={1} 
          variant="outline-primary" 
          size="sm" 
          onClick={() => setCurrentPage(1)}
          className="mx-1"
        >
          1
        </Button>
      );
      
      // Thêm dấu "..." nếu cần
      if (startPage > 2) {
        pages.push(<span key="ellipsis1" className="mx-1">...</span>);
      }
    }
    
    // Thêm các trang giữa
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <Button 
          key={i} 
          variant={currentPage === i ? 'primary' : 'outline-primary'} 
          size="sm" 
          onClick={() => setCurrentPage(i)}
          className="mx-1"
        >
          {i}
        </Button>
      );
    }
    
    // Thêm nút trang cuối cùng nếu cần
    if (endPage < totalPages) {
      // Thêm dấu "..." nếu cần
      if (endPage < totalPages - 1) {
        pages.push(<span key="ellipsis2" className="mx-1">...</span>);
      }
      
      pages.push(
        <Button 
          key={totalPages} 
          variant="outline-primary" 
          size="sm" 
          onClick={() => setCurrentPage(totalPages)}
          className="mx-1"
        >
          {totalPages}
        </Button>
      );
    }
    
    return (
      <div className="d-flex justify-content-center mt-3">
        <Button 
          variant="outline-secondary" 
          size="sm" 
          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          className="me-2"
        >
          &laquo; Trước
        </Button>
        
        {pages}
        
        <Button 
          variant="outline-secondary" 
          size="sm" 
          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="ms-2"
        >
          Sau &raquo;
        </Button>
      </div>
    );
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
                <th className="mobile-essential">Khoa</th>
                <th className={currentIsMobile ? "mobile-essential" : "mobile-hide"}>Ngành</th>
                <th className="mobile-essential">Ngày sinh</th>
                <th className="mobile-essential">Giới tính</th>
                <th className="mobile-essential">Địa chỉ</th>
                <th className="mobile-essential">CMND/CCCD</th>
                <th className="mobile-essential">SĐT</th>
                <th className={currentIsMobile ? "mobile-essential" : "mobile-hide"}>Phê duyệt</th>
                <th className="mobile-essential">Tình trạng</th>
              </tr>
            </thead>
            <tbody>
              {students.length > 0 ? (
                students.map((student, index) => (
                  <tr key={student.id} onClick={() => handleStudentRowClick(student)} style={{ cursor: 'pointer' }}>
                    <td className={currentIsMobile ? "mobile-essential" : "mobile-hide"}>
                      {currentIsMobile ? index + 1 : (currentPage - 1) * 10 + index + 1}
                    </td>
                    <td className="mobile-essential">{student.student_id || '-'}</td>
                    <td className="mobile-essential">{student.full_name || '-'}</td>
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
                    <td className="mobile-essential">{student.faculty_name || '-'}</td>
                    <td className={currentIsMobile ? "mobile-essential" : "mobile-hide"}>{student.major_name || '-'}</td>
                    <td className="mobile-essential">{student.birth_date ? new Date(student.birth_date).toLocaleDateString() : '-'}</td>
                    <td className="mobile-essential">
                      {student.gender === 0 || student.gender === '0' || student.gender === null ? 'Nam' : 
                       student.gender === 1 || student.gender === '1' ? 'Nữ' : 
                       student.gender === 2 || student.gender === '2' ? 'Khác' : '-'}
                    </td>
                    <td className="mobile-essential">
                      {student.address ? 
                        `${student.address}${student.district ? `, ${student.district}` : ''}${student.province ? `, ${student.province}` : ''}` 
                        : '-'}
                    </td>
                    <td className="mobile-essential">{student.id_number || '-'}</td>
                    <td className="mobile-essential">{student.phone || '-'}</td>
                    <td className={currentIsMobile ? "mobile-essential" : "mobile-hide"}>
                      {student.approved ? (
                        <Badge bg="success">Đã duyệt</Badge>
                      ) : (
                        <Badge bg="warning">Chờ duyệt</Badge>
                      )}
                    </td>
                    <td className="mobile-essential">
                      {student.status === 'Đang học' ? (
                        <Badge bg="success">Đang học</Badge>
                      ) : student.status === 'Nghỉ học' ? (
                        <Badge bg="danger">Nghỉ học</Badge>
                      ) : student.status === 'Tạm dừng' ? (
                        <Badge bg="warning">Tạm dừng</Badge>
                      ) : student.status === 'Tốt nghiệp' ? (
                        <Badge bg="primary">Tốt nghiệp</Badge>
                      ) : student.status === 'Không có' ? (
                        <Badge bg="secondary">Không có</Badge>
                      ) : (
                        <Badge bg="secondary">Không có</Badge>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="15" className="text-center">
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
        </div>

        <div className="pagination-container">
          {totalPages > 1 && renderPagination()}
        </div>
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
              <i className="fas fa-search"></i>
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
                users.map((user, index) => (
                  <tr key={user.id}>
                    <td className={currentIsMobile ? "mobile-hide" : "mobile-hide"}>
                      {currentIsMobile ? index + 1 : (currentPage - 1) * 10 + index + 1}
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
                      <Form.Select
                        size="sm"
                        value={user.role}
                        onChange={(e) => handleChangeRole(user.id, e.target.value)}
                        disabled={user.role === 'superadmin' || currentUser?.id === user.id}
                        className="role-select-mobile"
                      >
                        <option value="staff">Nhân viên</option>
                        <option value="admin">Quản trị viên</option>
                        <option value="superadmin">Super Admin</option>
                      </Form.Select>
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
        </div>

        <div className="pagination-container">
          {totalPages > 1 && renderPagination()}
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
                      <i className="fas fa-key me-2"></i>
                      Mật khẩu
                    </div>
                    <div className="info-value">
                      <div className="password-container">
                        <span className="password-display">
                          {emailTarget.display_password}
                        </span>
                        <button
                          type="button"
                          className="btn-toggle-password"
                          onClick={() => {
                            const passwordElement = document.querySelector('.password-display');
                            if (passwordElement) {
                              passwordElement.style.filter = passwordElement.style.filter === 'blur(4px)' ? 'none' : 'blur(4px)';
                            }
                          }}
                          title="Ẩn/Hiện mật khẩu"
                        >
                          <i className="fas fa-eye"></i>
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
          <Button variant="outline-secondary" onClick={() => {setShowEmailModal(false); setShowDetailModal(true);}} className="btn-cancel">
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
      <Modal show={showBulkEmailModal} onHide={() => setShowBulkEmailModal(false)} size="xl" className="student-detail-modal">
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
                                // Lọc sinh viên dựa trên tiêu chí đã chọn
                                const filteredStudents = allStudents.filter(s => 
                                  s.display_password && 
                                  (!selectedClass || s.class_name === selectedClass) &&
                                  (!selectedFaculty || s.faculty_name === selectedFaculty) &&
                                  (!selectedMajor || s.major_name === selectedMajor)
                                );
                                
                                if (filteredStudents.length === 0) {
                                  return (
                                    <div className="text-center text-muted py-4">
                                      <i className="fas fa-users fa-3x mb-3"></i>
                                      <p className="mb-0">Không có sinh viên nào phù hợp với tiêu chí đã chọn</p>
                                    </div>
                                  );
                                }
                                
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
                                          <th>STT</th>
                                          <th>Họ tên</th>
                                          <th>Mã SV</th>
                                          <th>Lớp</th>
                                          <th>Khoa</th>
                                          <th>Ngành</th>
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
                                              <span className="badge bg-info">{student.class_name}</span>
                                            </td>
                                            <td>
                                              <span className="badge bg-warning text-dark">{student.faculty_name}</span>
                                            </td>
                                            <td>
                                              <span className="badge bg-success">{student.major_name}</span>
                                            </td>
                                            <td>
                                              <small className="text-muted">{student.email}</small>
                                            </td>
                                          </tr>
                                        ))}
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
          <Button variant="outline-secondary" onClick={() => setShowBulkEmailModal(false)} className="btn-cancel">
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
                Gửi email hàng loạt
              </>
            )}
          </Button>
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
                        {userToEdit && userToEdit.role !== 'superadmin' ? (
                          <Form.Select
                            name="role"
                            value={editFormData.role}
                            onChange={handleEditInputChange}
                            className="form-control-modern"
                          >
                            <option value="student">Sinh viên</option>
                            <option value="staff">Nhân viên</option>
                            <option value="admin">Quản trị viên</option>
                          </Form.Select>
                        ) : (
                          <Form.Control
                            type="text"
                            value={editFormData.role === 'superadmin' ? 'Siêu quản trị viên' : editFormData.role}
                            disabled
                            className="form-control-modern"
                          />
                        )}
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
        <Button variant="outline-secondary" onClick={() => {setShowEmailModal(false); setShowDetailModal(true);}} className="btn-cancel">
            <i className="fas fa-arrow-left me-2"></i>
            Quay lại thông tin sinh viên
          </Button>
          <Button 
            variant="primary" 
            type="submit" 
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
      <Modal show={showDetailModal} onHide={() => setShowDetailModal(false)} size="xl" className="student-detail-modal">
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
              {/* Statistics Cards */}
              <div className="row mb-4">
                <div className="col-md-3">
                  <div className="statistics-card">
                    <div className="statistics-icon text-primary">
                      <i className="fas fa-graduation-cap"></i>
                    </div>
                    <div className="statistics-content">
                      <h3>{selectedStudent.class_name || 'N/A'}</h3>
                      <p>Lớp học</p>
                    </div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="statistics-card">
                    <div className="statistics-icon text-success">
                      <i className="fas fa-university"></i>
                    </div>
                    <div className="statistics-content">
                      <h3>{selectedStudent.faculty_name || 'N/A'}</h3>
                      <p>Khoa</p>
                    </div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="statistics-card">
                    <div className="statistics-icon text-warning">
                      <i className="fas fa-book"></i>
                    </div>
                    <div className="statistics-content">
                      <h3>{selectedStudent.major_name || 'N/A'}</h3>
                      <p>Chuyên ngành</p>
                    </div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="statistics-card">
                    <div className="statistics-icon text-danger">
                      <i className="fas fa-laptop"></i>
                    </div>
                    <div className="statistics-content">
                      <h3>{selectedStudent.device_mac ? 'Đã liên kết' : 'Chưa liên kết'}</h3>
                      <p>Thiết bị</p>
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
                          {selectedStudent.gender === 0 || selectedStudent.gender === '0' || selectedStudent.gender === null ? 'Nam' : 
                           selectedStudent.gender === 1 || selectedStudent.gender === '1' ? 'Nữ' : 
                           selectedStudent.gender === 2 || selectedStudent.gender === '2' ? 'Khác' : 'Chưa có'}
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
                          <span className={`status-badge ${
                            selectedStudent.status === 'Đang học' ? 'active' :
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
                      <h6 className="mb-0">Thông tin thiết bị</h6>
                    </div>
                    <div className="card-body-modern">
                      <div className="info-item">
                        <div className="info-label">
                          <i className="fas fa-network-wired"></i>
                          Địa chỉ MAC
                        </div>
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
                                    setSelectedStudent({...selectedStudent, device_mac: null});
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
                      setSelectedStudent({...selectedStudent, device_mac: null});
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
              <h4 className="mb-0">Xác nhận thay đổi vai trò</h4>
              <p className="mb-0 student-subtitle">Nhập mật khẩu để xác thực</p>
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="student-detail-body">
          <div className="student-detail-container">
            <Alert variant="warning" className="mb-4">
              <div className="d-flex align-items-center">
                <i className="fas fa-exclamation-triangle me-3"></i>
                <div>
                  <strong>Lưu ý:</strong> Thay đổi vai trò người dùng là một hành động quan trọng và có thể ảnh hưởng đến quyền truy cập hệ thống.
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
                  Nhập mật khẩu của bạn để xác nhận thay đổi vai trò người dùng.
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
            onClick={confirmRoleChange} 
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
                        onChange={(e) => setUserMacPolicies({...userMacPolicies, allow_multiple_accounts_per_mac: e.target.checked})}
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
                        onChange={(e) => setUserMacPolicies({...userMacPolicies, allow_multiple_macs_per_account: e.target.checked})}
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
    </div>
  );
};

export default UserManagement;
