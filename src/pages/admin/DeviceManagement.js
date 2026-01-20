import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Card, Table, Button, Badge, Alert, Spinner, Form, InputGroup, Nav, Tab, Modal, Switch } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import Pagination from '../../components/Pagination';
import '../../styles/user.css';
import usePageTitle from '../../hooks/usePageTitle';

const DeviceManagement = () => {
  usePageTitle('Quản lý thiết bị');
  const { showAlert } = useAlert();
  const { api } = useAuth();
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState([]);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [totalDevices, setTotalDevices] = useState(0);
  const [linkedDevices, setLinkedDevices] = useState(0);
  const [unlinkedDevices, setUnlinkedDevices] = useState(0);
  
  // States for sorting
  const [sortBy, setSortBy] = useState('last_login');
  const [sortOrder, setSortOrder] = useState('desc'); // desc = gần nhất ở trên, asc = xa nhất ở trên
  
  // States for attendance records tab
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState('');
  const [attendanceSearchTerm, setAttendanceSearchTerm] = useState('');
  const [attendanceTotalRecords, setAttendanceTotalRecords] = useState(0);
  const [activeTab, setActiveTab] = useState('devices');
  const [devicesPagination, setDevicesPagination] = useState({
    page: 1,
    limit: 20,
    totalItems: 0,
    totalPages: 0
  });
  const [attendancePagination, setAttendancePagination] = useState({
    page: 1,
    limit: 20,
    totalItems: 0,
    totalPages: 0
  });
  
  // States for MAC policy settings
  const [showMacPolicyModal, setShowMacPolicyModal] = useState(false);
  const [macPolicies, setMacPolicies] = useState({
    allow_multiple_accounts_per_mac: false,
    allow_multiple_macs_per_account: false
  });
  const [macPolicyLoading, setMacPolicyLoading] = useState(false);
  const [macPolicyError, setMacPolicyError] = useState('');
  
  // States for user-specific MAC policy settings
  const [showUserMacPolicyModal, setShowUserMacPolicyModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userMacPolicies, setUserMacPolicies] = useState({
    allow_multiple_accounts_per_mac: false,
    allow_multiple_macs_per_account: false
  });
  const [userMacPolicyLoading, setUserMacPolicyLoading] = useState(false);
  
  // Auto-refresh states
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const autoRefreshIntervalRef = useRef(null);

  // Fetch devices with MAC addresses - only show students who have logged in and have MAC
  const fetchDevices = async (isRefresh = false, isSearch = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else if (!isSearch) {
        // Chỉ hiển thị loading khi tải trang lần đầu, không hiển thị khi tìm kiếm
        setLoading(true);
      }
      setError('');

      // Always filter for students with MAC addresses (status=active)
      const response = await api.get(`/users/devices?page=1&limit=999999&search=${searchTerm}&status=active`);
      if (response.data.success) {
        setDevices(response.data.data);
        setTotalDevices(response.data.pagination.totalItems);
        
        // All devices shown have MAC addresses
        setLinkedDevices(response.data.data.length);
        setUnlinkedDevices(0);
      } else {
        setError('Không thể tải danh sách thiết bị');
      }
    } catch (error) {
      console.error('Error fetching devices:', error);
      setError('Không thể tải danh sách thiết bị. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch devices silently (without loading state)
  const fetchDevicesSilently = async () => {
    try {
      setIsAutoRefreshing(true);
      setError('');

      const response = await api.get(`/users/devices?page=1&limit=999999&search=${searchTerm}&status=active`);
      if (response.data.success) {
        setDevices(response.data.data);
        setTotalDevices(response.data.pagination.totalItems);
        
        setLinkedDevices(response.data.data.length);
        setUnlinkedDevices(0);
      }
    } catch (error) {
      console.error('Error fetching devices silently:', error);
    } finally {
      setIsAutoRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, [filterStatus]);

  // Update pagination when devices change
  useEffect(() => {
    if (activeTab === 'devices') {
      const totalItems = devices.length;
      const totalPages = Math.ceil(totalItems / devicesPagination.limit);
      setDevicesPagination(prev => ({
        ...prev,
        totalItems,
        totalPages,
        page: prev.page > totalPages && totalPages > 0 ? totalPages : prev.page
      }));
    }
  }, [devices, activeTab, devicesPagination.limit]);

  // Update pagination when attendanceRecords change
  useEffect(() => {
    if (activeTab === 'attendance') {
      const totalItems = attendanceRecords.length;
      const totalPages = Math.ceil(totalItems / attendancePagination.limit);
      setAttendancePagination(prev => ({
        ...prev,
        totalItems,
        totalPages,
        page: prev.page > totalPages && totalPages > 0 ? totalPages : prev.page
      }));
    }
  }, [attendanceRecords, activeTab, attendancePagination.limit]);

  // Fetch attendance records when tab changes
  useEffect(() => {
    if (activeTab === 'attendance') {
      fetchAttendanceRecords();
    }
  }, [activeTab]);

  // Auto-refresh data every 10 seconds
  useEffect(() => {
    // Start auto-refresh interval
    autoRefreshIntervalRef.current = setInterval(() => {
      if (activeTab === 'devices') {
        fetchDevicesSilently();
      } else if (activeTab === 'attendance') {
        fetchAttendanceRecordsSilently();
      }
    }, 10000); // 10 seconds

    // Clean up interval on unmount
    return () => {
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current);
        autoRefreshIntervalRef.current = null;
      }
    };
  }, [activeTab, searchTerm, attendanceSearchTerm]);
  
  // Fetch MAC policy settings
  const fetchMacPolicies = async () => {
    try {
      setMacPolicyLoading(true);
      setMacPolicyError('');
      
      const response = await api.get('/mac-policies');
      
      if (response.data.success) {
        console.log('Fetched MAC policies:', response.data.data);
        setMacPolicies(response.data.data);
      } else {
        setMacPolicyError('Không thể tải chính sách MAC address');
      }
    } catch (error) {
      console.error('Error fetching MAC policies:', error);
      setMacPolicyError('Không thể tải chính sách MAC address. Vui lòng thử lại sau.');
    } finally {
      setMacPolicyLoading(false);
    }
  };
  
  // Update MAC policy settings
  const handleUpdateMacPolicies = async () => {
    try {
      setMacPolicyLoading(true);
      
      console.log('Sending MAC policies data:', macPolicies);
      const response = await api.put('/mac-policies', macPolicies);
      
      if (response.data.success) {
        showAlert('Cập nhật chính sách MAC address thành công', 'success');
        setShowMacPolicyModal(false);
      } else {
        setMacPolicyError(response.data.message || 'Không thể cập nhật chính sách MAC address');
      }
    } catch (error) {
      console.error('Error updating MAC policies:', error);
      setMacPolicyError('Không thể cập nhật chính sách MAC address. Vui lòng thử lại sau.');
    } finally {
      setMacPolicyLoading(false);
    }
  };
  
  // Fetch user-specific MAC policy exceptions
  const fetchUserMacPolicyExceptions = async (userId) => {
    try {
      setUserMacPolicyLoading(true);
      
      const response = await api.get(`/mac-policies/user/${userId}`);
      
      if (response.data.success) {
        const { exceptions, effectivePolicies } = response.data.data;
        console.log('Fetched user MAC policy exceptions:', { exceptions, effectivePolicies });
        
        // If user has exceptions, use them, otherwise use effective policies
        if (exceptions) {
          const userPolicies = {
            allow_multiple_accounts_per_mac: exceptions.allow_multiple_accounts_per_mac ?? false,
            allow_multiple_macs_per_account: exceptions.allow_multiple_macs_per_account ?? false
          };
          console.log('Setting user policies from exceptions:', userPolicies);
          setUserMacPolicies(userPolicies);
        } else {
          // No exceptions exist yet, show effective policies
          const userPolicies = {
            allow_multiple_accounts_per_mac: effectivePolicies.allow_multiple_accounts_per_mac ?? false,
            allow_multiple_macs_per_account: effectivePolicies.allow_multiple_macs_per_account ?? false
          };
          console.log('Setting user policies from effective policies:', userPolicies);
          setUserMacPolicies(userPolicies);
        }
      } else {
        showAlert('Không thể tải ngoại lệ chính sách MAC address của người dùng', 'danger');
      }
    } catch (error) {
      console.error('Error fetching user MAC policy exceptions:', error);
      showAlert('Không thể tải ngoại lệ chính sách MAC address của người dùng. Vui lòng thử lại sau.', 'danger');
    } finally {
      setUserMacPolicyLoading(false);
    }
  };
  
  // Set user-specific MAC policy exceptions
  const handleSetUserMacPolicyExceptions = async () => {
    try {
      setUserMacPolicyLoading(true);
      
      console.log('Setting user MAC policy exceptions for user:', selectedUser.id, 'with data:', userMacPolicies);
      const response = await api.put(`/mac-policies/user/${selectedUser.id}`, userMacPolicies);
      
      if (response.data.success) {
        showAlert('Cập nhật ngoại lệ chính sách MAC address thành công', 'success');
        setShowUserMacPolicyModal(false);
        // Refresh data to show updated values
        if (selectedUser) {
          fetchUserMacPolicyExceptions(selectedUser.id);
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
      setUserMacPolicyLoading(false);
    }
  };
  
  // Remove user-specific MAC policy exceptions
  const handleRemoveUserMacPolicyExceptions = async () => {
    try {
      setUserMacPolicyLoading(true);
      
      const response = await api.delete(`/mac-policies/user/${selectedUser.id}`);
      
      if (response.data.success) {
        showAlert('Xóa ngoại lệ chính sách MAC address thành công', 'success');
        setShowUserMacPolicyModal(false);
      } else {
        showAlert(response.data.message || 'Không thể xóa ngoại lệ chính sách MAC address', 'danger');
      }
    } catch (error) {
      // Handle 404 as success (no exceptions to delete)
      if (error.response && error.response.status === 404) {
        console.log('No MAC policy exceptions found for user - treating as success');
        showAlert('Không có ngoại lệ chính sách MAC address để xóa', 'success');
        setShowUserMacPolicyModal(false);
      } else {
        console.error('Error removing user MAC policy exceptions:', error);
        showAlert('Không thể xóa ngoại lệ chính sách MAC address. Vui lòng thử lại sau.', 'danger');
      }
    } finally {
      setUserMacPolicyLoading(false);
    }
  };
  
  // Open MAC policy modal and fetch current settings
  const openMacPolicyModal = () => {
    fetchMacPolicies();
    setShowMacPolicyModal(true);
  };
  
  // Open user MAC policy modal and fetch current settings
  const openUserMacPolicyModal = (user) => {
    setSelectedUser(user);
    fetchUserMacPolicyExceptions(user.id);
    setShowUserMacPolicyModal(true);
  };

  // Debounced search effect for attendance records
  useEffect(() => {
    if (activeTab === 'attendance') {
      const timeoutId = setTimeout(() => {
        if (attendanceSearchTerm.length >= 2 || attendanceSearchTerm === '') {
          fetchAttendanceRecords();
        }
      }, 500); // 500ms debounce

      return () => clearTimeout(timeoutId);
    }
  }, [attendanceSearchTerm, activeTab]);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchTerm.length >= 2 || searchTerm === '') {
        fetchDevices(false, true); // isRefresh = false, isSearch = true
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Reset device MAC
  const handleResetMac = async (userId, studentName, macAddress) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa liên kết thiết bị của sinh viên ${studentName}? Sinh viên sẽ có thể đăng nhập từ một thiết bị mới.`)) {
      return;
    }

    try {
      const response = await api.post(`/auth/reset-device-mac/${userId}`);
      if (response.data.success) {
        showAlert('Đã xóa liên kết thiết bị thành công', 'success');
        
        // Kiểm tra và cảnh báo về MAC trùng lặp
        if (macAddress) {
          const confirmRemoveAll = window.confirm(
            `Địa chỉ MAC ${macAddress} có thể còn được sử dụng trong tab "Bảng ghi điểm danh".\n\n` +
            `Bạn có muốn xóa địa chỉ MAC này khỏi tất cả bản ghi điểm danh không?`
          );
          
          if (confirmRemoveAll) {
            await handleRemoveDuplicateMac(macAddress);
          }
        }
        
        // Refresh data silently
        fetchDevicesSilently();
      } else {
        showAlert(response.data.message || 'Không thể xóa liên kết thiết bị', 'danger');
      }
    } catch (error) {
      console.error('Error resetting MAC:', error);
      showAlert('Không thể xóa liên kết thiết bị. Vui lòng thử lại sau.', 'danger');
    }
  };

  // Remove duplicate MAC from all records
  const handleRemoveDuplicateMac = async (macAddress) => {
    try {
      const response = await api.post('/users/remove-duplicate-mac', { macAddress });
      if (response.data.success) {
        showAlert(response.data.message, 'success');
        // Refresh both tabs silently
        fetchDevicesSilently();
        fetchAttendanceRecordsSilently();
      } else {
        showAlert(response.data.message || 'Không thể xóa MAC trùng lặp', 'danger');
      }
    } catch (error) {
      console.error('Error removing duplicate MAC:', error);
      showAlert('Không thể xóa MAC trùng lặp. Vui lòng thử lại sau.', 'danger');
    }
  };

  // Handle search
  const handleSearch = () => {
    fetchDevices(false, true); // isRefresh = false, isSearch = true
  };

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Sort devices by last login
  const sortDevices = (devices) => {
    return [...devices].sort((a, b) => {
      // Handle null/undefined last_login values
      const aTime = a.last_login ? new Date(a.last_login).getTime() : 0;
      const bTime = b.last_login ? new Date(b.last_login).getTime() : 0;
      
      if (sortBy === 'last_login') {
        if (sortOrder === 'desc') {
          // Gần nhất ở trên (desc): từ mới đến cũ, null/undefined ở dưới
          if (aTime === 0 && bTime === 0) return 0;
          if (aTime === 0) return 1;
          if (bTime === 0) return -1;
          return bTime - aTime;
        } else {
          // Xa nhất ở trên (asc): null/undefined ở trên, sau đó từ cũ đến mới
          if (aTime === 0 && bTime === 0) return 0;
          if (aTime === 0) return -1;
          if (bTime === 0) return 1;
          return aTime - bTime;
        }
      }
      return 0;
    });
  };

  // Handle sort
  const handleSort = (column) => {
    if (column === sortBy) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  // Remove MAC from attendance record
  const handleRemoveAttendanceMac = async (recordId, studentName, macAddress) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa địa chỉ MAC khỏi bản ghi điểm danh của sinh viên ${studentName}? Thông tin điểm danh sẽ được giữ lại.`)) {
      return;
    }

    try {
      const response = await api.delete(`/users/attendance-records/${recordId}/mac`);
      if (response.data.success) {
        showAlert('Đã xóa địa chỉ MAC khỏi bản ghi điểm danh thành công', 'success');
        
        // Kiểm tra và cảnh báo về MAC trùng lặp
        if (macAddress) {
          const confirmRemoveAll = window.confirm(
            `Địa chỉ MAC ${macAddress} có thể còn được sử dụng trong tab "Sinh viên".\n\n` +
            `Bạn có muốn xóa địa chỉ MAC này khỏi tất cả tài khoản sinh viên không?`
          );
          
          if (confirmRemoveAll) {
            await handleRemoveDuplicateMac(macAddress);
          }
        }
        
        // Refresh data silently
        fetchAttendanceRecordsSilently();
      } else {
        showAlert(response.data.message || 'Không thể xóa địa chỉ MAC', 'danger');
      }
    } catch (error) {
      console.error('Error removing attendance MAC:', error);
      showAlert('Không thể xóa địa chỉ MAC. Vui lòng thử lại sau.', 'danger');
    }
  };

  // Fetch attendance records with MAC addresses
  const fetchAttendanceRecords = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setAttendanceLoading(true);
      }
      setAttendanceError('');

      const response = await api.get(`/users/attendance-records?page=1&limit=999999&search=${attendanceSearchTerm}`);
      if (response.data.success) {
        setAttendanceRecords(response.data.data);
        setAttendanceTotalRecords(response.data.pagination.totalItems);
        
        // Update pagination
        const totalItems = response.data.data?.length || 0;
        const totalPages = Math.ceil(totalItems / attendancePagination.limit);
        setAttendancePagination(prev => ({
          ...prev,
          totalItems,
          totalPages,
          page: prev.page > totalPages && totalPages > 0 ? totalPages : prev.page
        }));
      } else {
        setAttendanceError('Không thể tải danh sách điểm danh');
      }
    } catch (error) {
      console.error('Error fetching attendance records:', error);
      setAttendanceError('Không thể tải danh sách điểm danh. Vui lòng thử lại sau.');
    } finally {
      setAttendanceLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch attendance records silently (without loading state)
  const fetchAttendanceRecordsSilently = async () => {
    try {
      setIsAutoRefreshing(true);
      setAttendanceError('');

      const response = await api.get(`/users/attendance-records?page=1&limit=999999&search=${attendanceSearchTerm}`);
      if (response.data.success) {
        setAttendanceRecords(response.data.data);
        setAttendanceTotalRecords(response.data.pagination.totalItems);
      }
    } catch (error) {
      console.error('Error fetching attendance records silently:', error);
    } finally {
      setIsAutoRefreshing(false);
    }
  };

  // Handle filter change - removed since we only show devices with MAC
  const handleFilterChange = (filter) => {
    // No longer needed since we only show devices with MAC
    setFilterStatus(filter);
    fetchDevices(false, true); // isRefresh = false, isSearch = true
  };

  if (loading) {
    return (
      <Container fluid className="session-main-container">
        <div className="d-flex justify-content-center align-items-center" style={{ height: '400px' }}>
          <Spinner animation="border" variant="primary" />
        </div>
      </Container>
    );
  }

  return (
    <Container fluid className="session-main-container">
      {/* Header */}
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Quản lý thiết bị</h1>
            <p className="header-subtitle">Theo dõi sinh viên đã đăng nhập và có địa chỉ MAC để bảo mật tài khoản</p>
          </div>
          <div className="header-actions">
            {isAutoRefreshing && (
              <div className="auto-refresh-indicator">
                <div className="spinner-border spinner-border-sm text-white" role="status">
                  <span className="visually-hidden">Đang cập nhật...</span>
                </div>
                <span className="ms-2 small">Đang cập nhật...</span>
              </div>
            )}
            <Button 
              variant="outline-light" 
              onClick={openMacPolicyModal}
              className="create-session-btn me-2"
            >
              <i className="fas fa-cogs me-2"></i>
              Chính sách MAC
            </Button>
            <Button 
              variant="outline-light" 
              onClick={() => activeTab === 'devices' ? fetchDevices(true) : fetchAttendanceRecords(true)}
              disabled={refreshing}
              className="create-session-btn"
            >
              <i className={`fas fa-sync-alt me-2 ${refreshing ? 'fa-spin' : ''}`}></i>
              {refreshing ? 'Đang tải...' : 'Làm mới'}
            </Button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k)}>
          <Nav variant="tabs" className="custom-tabs">
            <Nav.Item>
              <Nav.Link eventKey="devices">
                <span className="tab-title">
                  <i className="fas fa-users me-2"></i>
                  Sinh viên
                </span>
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="attendance">
                <span className="tab-title">
                  <i className="fas fa-check-circle me-2"></i>
                  Bảng ghi điểm danh
                </span>
              </Nav.Link>
            </Nav.Item>
          </Nav>

        <Tab.Content>
          {/* Devices Tab */}
          <Tab.Pane eventKey="devices">
            {/* Search Controls */}
            <div className="session-list-controls mb-4">
              <div className="search-controls">
                <div className="search-input" style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Tìm kiếm theo tên, mã SV, email, lớp, MAC..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className="search-input"
                  />
                </div>
              </div>
            </div>

            {/* Error Alert */}
            {error && (
              <Alert variant="danger" className="mb-4">
                {error}
              </Alert>
            )}

            {/* Devices Table */}
            <div className="session-table-container" style={{ overflowX: 'auto' }}>
              <Table className="session-table" responsive>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Mã SV</th>
                    <th>Họ và tên</th>
                    <th>Email</th>
                    <th>Lớp</th>
                    <th>Địa chỉ MAC</th>
                    <th>Trạng thái</th>
                    <th>
                      <div className="d-flex align-items-center justify-content-between">
                        <span>Lần đăng nhập cuối</span>
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => handleSort('last_login')}
                          className="p-0 ms-2 text-decoration-none"
                          title={`Sắp xếp theo lần đăng nhập cuối (${sortOrder === 'desc' ? 'Gần nhất ở trên' : 'Xa nhất ở trên'})`}
                        >
                          <i className={`fas fa-sort ${sortBy === 'last_login' ? (sortOrder === 'desc' ? 'fa-sort-down' : 'fa-sort-up') : 'fa-sort'}`}></i>
                        </Button>
                      </div>
                    </th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="9" className="text-center">
                        <Spinner animation="border" size="sm" className="me-2" /> Đang tải...
                      </td>
                    </tr>
                  ) : devices.length > 0 ? (
                    sortDevices(devices)
                      .slice((devicesPagination.page - 1) * devicesPagination.limit, devicesPagination.page * devicesPagination.limit)
                      .map((device, index) => (
                      <tr key={`device-${device.id}-${index}`}>
                        <td>{(devicesPagination.page - 1) * devicesPagination.limit + index + 1}</td>
                        <td>{device.student_id || '-'}</td>
                        <td>{device.full_name || '-'}</td>
                        <td>{device.email || '-'}</td>
                        <td>{device.class_name || '-'}</td>
                        <td className="font-monospace">{device.device_mac}</td>
                        <td>
                          <span className="status-badge active">Đã liên kết</span>
                        </td>
                        <td>{device.last_login ? new Date(device.last_login).toLocaleString('vi-VN') : 'Chưa đăng nhập'}</td>
                        <td>
                          <div className="action-buttons">
                            <Button 
                              variant="outline-primary" 
                              onClick={() => openUserMacPolicyModal(device)}
                              title="Cài đặt chính sách MAC riêng"
                              className="action-btn btn-outline-primary"
                            >
                              <i className="fas fa-cogs"></i>
                            </Button>
                            <Button 
                              variant="outline-danger" 
                              onClick={() => handleResetMac(device.id, device.full_name, device.device_mac)}
                              title="Xóa liên kết thiết bị"
                              className="action-btn btn-outline-danger"
                            >
                              <i className="fas fa-trash"></i>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="9" className="text-center py-5">
                        <div className="text-center p-5">
                          <i className="fas fa-network-wired fa-4x mb-3 text-muted"></i>
                          <h5>Chưa có sinh viên nào đăng nhập và có địa chỉ MAC</h5>
                          <p className="text-muted">Địa chỉ MAC được sử dụng để giới hạn sinh viên chỉ đăng nhập được trên một thiết bị</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>
            
            {/* Pagination for Devices */}
            {devices.length > 0 && devicesPagination.totalPages > 1 && (
              <div className="mt-3">
                <Pagination
                  currentPage={devicesPagination.page}
                  totalPages={devicesPagination.totalPages}
                  onPageChange={(page) => setDevicesPagination(prev => ({ ...prev, page }))}
                  maxVisiblePages={5}
                  showFirstLast={true}
                />
              </div>
            )}

            {/* Show total count */}
            {devices.length > 0 && (
              <div className="d-flex justify-content-center mt-3">
                <Badge bg="info" className="fs-6">
                  Tổng cộng: {totalDevices} sinh viên có địa chỉ MAC
                </Badge>
              </div>
            )}
          </Tab.Pane>

          {/* Attendance Records Tab */}
          <Tab.Pane eventKey="attendance">
            {/* Search Controls */}
            <div className="session-list-controls mb-4">
              <div className="search-controls">
                <div className="search-input" style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Tìm kiếm theo tên, mã SV, email, MAC, buổi học..."
                    value={attendanceSearchTerm}
                    onChange={(e) => setAttendanceSearchTerm(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && fetchAttendanceRecords()}
                    className="search-input"
                  />
                </div>
                <Button variant="primary" onClick={() => fetchAttendanceRecords()} className="filter-btn">
                  <i className="fas fa-search me-2"></i>
                  Tìm kiếm
                </Button>
              </div>
            </div>

            {/* Error Alert */}
            {attendanceError && (
              <Alert variant="danger" className="mb-4">
                {attendanceError}
              </Alert>
            )}

            {/* Attendance Records Table */}
            <div className="session-table-container" style={{ overflowX: 'auto' }}>
              <Table className="session-table" responsive>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Mã SV</th>
                    <th>Họ và tên</th>
                    <th>Email</th>
                    <th>Buổi học</th>
                    <th>Loại điểm danh</th>
                    <th>Địa chỉ MAC</th>
                    <th>Thời gian</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceLoading ? (
                    <tr>
                      <td colSpan="9" className="text-center">
                        <Spinner animation="border" size="sm" className="me-2" /> Đang tải...
                      </td>
                    </tr>
                  ) : attendanceRecords.length > 0 ? (
                    attendanceRecords
                      .slice((attendancePagination.page - 1) * attendancePagination.limit, attendancePagination.page * attendancePagination.limit)
                      .map((record, index) => (
                      <tr key={`attendance-${record.id}-${index}`}>
                        <td>{(attendancePagination.page - 1) * attendancePagination.limit + index + 1}</td>
                        <td>{record.student_code || '-'}</td>
                        <td>{record.full_name || '-'}</td>
                        <td>{record.email || '-'}</td>
                        <td>
                          <div>
                            <div className="fw-bold">{record.session_title}</div>
                            <small className="text-muted">
                              {format(new Date(record.session_date), 'dd/MM/yyyy', { locale: vi })} - {record.start_time} - {record.end_time}
                            </small>
                          </div>
                        </td>
                        <td>
                          <span className={`status-badge ${
                            record.attendance_type === 'full' ? 'active' :
                            record.attendance_type === 'before' ? 'scheduled' :
                            record.attendance_type === 'during' ? 'active' :
                            record.attendance_type === 'after' ? 'scheduled' :
                            record.attendance_type === 'present' ? 'active' :
                            record.attendance_type === 'early' ? 'scheduled' :
                            record.attendance_type === 'late' ? 'cancelled' :
                            record.attendance_type === 'late_leave' ? 'cancelled' :
                            record.attendance_type === 'absent' ? 'ended' :
                            record.attendance_type === 'absent_perm' ? 'ended' :
                            record.attendance_type === 'absent_before_perm' ? 'ended' :
                            record.attendance_type === 'absent_during_perm' ? 'ended' :
                            record.attendance_type === 'absent_after_perm' ? 'ended' : 'ended'
                          }`}>
                            {record.attendance_type === 'full' ? 'Đầy đủ' :
                             record.attendance_type === 'before' ? 'Trước buổi học' :
                             record.attendance_type === 'during' ? 'Trong buổi học' :
                             record.attendance_type === 'after' ? 'Sau buổi học' :
                             record.attendance_type === 'present' ? 'Có mặt' :
                             record.attendance_type === 'early' ? 'Điểm danh sớm' :
                             record.attendance_type === 'late' ? 'Điểm danh trễ' :
                             record.attendance_type === 'late_before' ? 'Điểm danh đi trễ' :
                             record.attendance_type === 'late_leave' ? 'Về trễ' :
                             record.attendance_type === 'absent' ? 'Vắng mặt' :
                             record.attendance_type === 'absent_perm' ? 'Vắng có phép' :
                             record.attendance_type === 'absent_before_perm' ? 'Vắng trước có phép' :
                             record.attendance_type === 'absent_during_perm' ? 'Vắng trong có phép' :
                             record.attendance_type === 'absent_after_perm' ? 'Vắng sau có phép' : record.attendance_type}
                          </span>
                        </td>
                         <td className="font-monospace">
                           {record.device_mac ? (
                             <span className="text-success">{record.device_mac}</span>
                           ) : (
                             <span className="text-muted">Không có</span>
                           )}
                         </td>
                         <td>{format(new Date(record.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: vi })}</td>
                         <td>
                           {record.device_mac ? (
                              <Button 
                                variant="outline-warning" 
                                onClick={() => handleRemoveAttendanceMac(record.id, record.full_name, record.device_mac)}
                                title="Xóa địa chỉ MAC khỏi bản ghi điểm danh"
                                className="action-btn btn-outline-warning"
                              >
                                <i className="fas fa-unlink"></i>
                              </Button>
                           ) : (
                             <span className="text-muted">
                               <i className="fas fa-check-circle me-1"></i>
                               Đã xóa
                             </span>
                           )}
                         </td>
                       </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="9" className="text-center py-5">
                        <div className="text-center p-5">
                          <i className="fas fa-check-circle fa-4x mb-3 text-muted"></i>
                          <h5>Chưa có bản ghi điểm danh nào</h5>
                          <p className="text-muted">Bảng ghi điểm danh sẽ hiển thị khi sinh viên thực hiện điểm danh</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>

            {/* Pagination for Attendance Records */}
            {attendanceRecords.length > 0 && attendancePagination.totalPages > 1 && (
              <div className="mt-3">
                <Pagination
                  currentPage={attendancePagination.page}
                  totalPages={attendancePagination.totalPages}
                  onPageChange={(page) => setAttendancePagination(prev => ({ ...prev, page }))}
                  maxVisiblePages={5}
                  showFirstLast={true}
                />
              </div>
            )}

            {/* Show total count */}
            {attendanceRecords.length > 0 && (
              <div className="d-flex justify-content-center mt-3">
                <Badge bg="info" className="fs-6">
                  Tổng cộng: {attendanceTotalRecords} bản ghi điểm danh
                </Badge>
              </div>
            )}
          </Tab.Pane>
        </Tab.Content>
        </Tab.Container>
      </div>

      {/* Global MAC Policy Settings Modal */}
      <Modal show={showMacPolicyModal} onHide={() => setShowMacPolicyModal(false)} size="lg" className="session-detail-modal">
        <Modal.Header closeButton className="student-detail-header">
          <Modal.Title className="student-detail-title">
            <div className="student-avatar">
              <i className="fas fa-cogs"></i>
            </div>
            <div>
              <h4 className="mb-0">Cài đặt chính sách MAC address</h4>
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="student-detail-body">
            {macPolicyError && (
              <Alert variant="danger" className="mb-4">
                <div className="d-flex align-items-center">
                  <i className="fas fa-exclamation-circle me-2"></i>
                  {macPolicyError}
                </div>
              </Alert>
            )}
            
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
                      <i className="fas fa-shield-alt"></i>
                    </div>
                    <h6 className="mb-0">Cài đặt chung</h6>
                  </div>
                  <div className="card-body-modern">
                    <p className="text-muted mb-4">
                      Những cài đặt này áp dụng cho tất cả sinh viên, trừ khi có ngoại lệ riêng
                    </p>
                    
                    <Form.Group className="mb-4 d-flex align-items-center justify-content-between">
                      <div>
                        <Form.Label className="mb-0 fw-bold">Cho phép nhiều tài khoản trên một MAC</Form.Label>
                        <Form.Text className="d-block text-muted">
                          Một địa chỉ MAC có thể được sử dụng bởi nhiều tài khoản khác nhau.
                          <br />
                          <strong>NẾU TẮT:</strong> Chặn đăng nhập nếu MAC đã được sử dụng bởi tài khoản khác
                        </Form.Text>
                      </div>
                      <Form.Check 
                        type="switch"
                        checked={macPolicies.allow_multiple_accounts_per_mac}
                        onChange={(e) => setMacPolicies({...macPolicies, allow_multiple_accounts_per_mac: e.target.checked})}
                      />
                    </Form.Group>
                    
                    <Form.Group className="mb-4 d-flex align-items-center justify-content-between">
                      <div>
                        <Form.Label className="mb-0 fw-bold">Cho phép nhiều MAC trên một tài khoản</Form.Label>
                        <Form.Text className="d-block text-muted">
                          Một tài khoản có thể được sử dụng trên nhiều thiết bị khác nhau.
                          <br />
                          <strong>NẾU TẮT:</strong> Chặn đăng nhập nếu sử dụng thiết bị khác với thiết bị đã đăng ký
                        </Form.Text>
                      </div>
                      <Form.Check 
                        type="switch"
                        checked={macPolicies.allow_multiple_macs_per_account}
                        onChange={(e) => setMacPolicies({...macPolicies, allow_multiple_macs_per_account: e.target.checked})}
                      />
                    </Form.Group>
                  </div>
                </div>
                
                <div className="session-card">
                  <div className="card-header-modern">
                    <div className="header-icon">
                      <i className="fas fa-info-circle"></i>
                    </div>
                    <h6 className="mb-0">Thông tin bổ sung</h6>
                  </div>
                  <div className="card-body-modern">
                    <Alert variant="info" className="mb-0">
                      <div className="d-flex align-items-center">
                        <i className="fas fa-lightbulb me-3"></i>
                        <div>
                          <p className="mb-0"><strong>Lưu ý:</strong> Các cài đặt này ảnh hưởng đến cách hệ thống xác thực người dùng dựa trên địa chỉ MAC của thiết bị.</p>
                          <p className="mb-0 mt-2">Bạn có thể thiết lập ngoại lệ riêng cho từng sinh viên trong tab "Sinh viên".</p>
                        </div>
                      </div>
                    </Alert>
                  </div>
                </div>
              </Form>
            )}
        </Modal.Body>
        <Modal.Footer className="student-detail-footer">
          <Button variant="outline-secondary" onClick={() => setShowMacPolicyModal(false)} className="btn-cancel">
            <i className="fas fa-times me-2"></i>
            Đóng
          </Button>
          <Button variant="primary" onClick={handleUpdateMacPolicies} disabled={macPolicyLoading} className="btn-edit">
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

      {/* User-specific MAC Policy Settings Modal */}
      <Modal show={showUserMacPolicyModal} onHide={() => setShowUserMacPolicyModal(false)} size="lg" className="session-detail-modal">
        <Modal.Header closeButton className="student-detail-header">
          <Modal.Title className="student-detail-title">
            <div className="student-avatar">
              <i className="fas fa-laptop"></i>
            </div>
            <div>
              <h4 className="mb-0">Cài đặt chính sách MAC address</h4>
              <p className="mb-0 student-subtitle">{selectedUser?.full_name}</p>
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="student-detail-body">
            {userMacPolicyLoading ? (
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
                    {selectedUser && (
                      <>
                        <div className="info-item">
                          <div className="info-label">
                            <i className="fas fa-id-card me-2"></i>
                            Mã sinh viên
                          </div>
                          <div className="info-value">{selectedUser.student_id || '-'}</div>
                        </div>
                        <div className="info-item">
                          <div className="info-label">
                            <i className="fas fa-user me-2"></i>
                            Họ và tên
                          </div>
                          <div className="info-value">{selectedUser.full_name}</div>
                        </div>
                        <div className="info-item">
                          <div className="info-label">
                            <i className="fas fa-envelope me-2"></i>
                            Email
                          </div>
                          <div className="info-value">{selectedUser.email}</div>
                        </div>
                        <div className="info-item">
                          <div className="info-label">
                            <i className="fas fa-network-wired me-2"></i>
                            Địa chỉ MAC
                          </div>
                          <div className="info-value">
                            <div className="mac-address-display">
                              {selectedUser.device_mac || 'Chưa có liên kết thiết bị'}
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
        </Modal.Body>
        <Modal.Footer className="student-detail-footer">
          <Button variant="outline-danger" onClick={handleRemoveUserMacPolicyExceptions} disabled={userMacPolicyLoading} className="btn-delete">
            <i className="fas fa-trash-alt me-2"></i>
            Xóa ngoại lệ
          </Button>
          <Button variant="outline-secondary" onClick={() => setShowUserMacPolicyModal(false)} className="btn-cancel">
            <i className="fas fa-times me-2"></i>
            Đóng
          </Button>
          <Button variant="primary" onClick={handleSetUserMacPolicyExceptions} disabled={userMacPolicyLoading} className="btn-edit">
            {userMacPolicyLoading ? (
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
    </Container>
  );
};

export default DeviceManagement;
