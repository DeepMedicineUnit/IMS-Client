import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Container, Row, Col, Card, Button, Table, Form, Spinner, Alert, Tabs, Tab, Badge, Modal, Nav, InputGroup } from 'react-bootstrap';
import AdminNavbar from '../../components/Navbar';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import MapPreview from '../../components/MapPreview';
import { useHospitalLocations } from '../../hooks/useHospitalLocations';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

// Add custom styles for error display
const errorStyles = `
  .error-details {
    background-color: #fff5f5;
    border: 1px solid #fed7d7;
    border-radius: 4px;
    padding: 8px;
    margin: 4px 0;
  }
  
  .error-part {
    word-break: break-word;
    line-height: 1.4;
  }
  
  .cursor-pointer {
    cursor: pointer;
  }
  
  .error-details details summary {
    cursor: pointer;
    user-select: none;
  }
  
  .error-details details summary:hover {
    text-decoration: underline;
  }
  
  .error-details pre {
    white-space: pre-wrap;
    word-wrap: break-word;
    font-family: 'Courier New', monospace;
  }
`;

const SystemPage = () => {
  usePageTitle('Cài đặt hệ thống');
  const { api } = useAuth();
  const { showAlert } = useAlert();
  const [activeTab, setActiveTab] = useState('logs');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showThreatFilters, setShowThreatFilters] = useState(false);
  
  // IP Whitelist State
  const [ipWhitelist, setIpWhitelist] = useState([]);
  const [showWhitelistModal, setShowWhitelistModal] = useState(false);
  const [newIP, setNewIP] = useState({ ipAddress: '', description: '' });
  
  // Attendance Settings State
  const [securitySettings, setSecuritySettings] = useState([]);
  const [workSchedules, setWorkSchedules] = useState([]);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingSecurity, setEditingSecurity] = useState(null);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [securityForm, setSecurityForm] = useState({
    setting_type: 'ip_restriction',
    scope_type: 'all_employees',
    scope_value: '',
    setting_data: [],
    is_active: true
  });
  const [scheduleForm, setScheduleForm] = useState({
    scope_type: 'all_employees',
    scope_value: [],
    start_time: '07:30',
    end_time: '16:30',
    required_hours: 8.0,
    work_days: [1, 2, 3, 4, 5, 6],
    is_active: true
  });
  
  // Data for scope selection
  const [availableRoles, setAvailableRoles] = useState(['superadmin', 'admin', 'staff']);
  const [availableDepartments, setAvailableDepartments] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [loadingScopeData, setLoadingScopeData] = useState(false);
  
  // Location restriction state
  const { hospitalLocations } = useHospitalLocations();
  const [newLocation, setNewLocation] = useState({
    name: '',
    latitude: '',
    longitude: '',
    radius: 100,
    coordinatesInput: ''
  });
  const [selectedLocationForMap, setSelectedLocationForMap] = useState(null);
  
  // reCAPTCHA Settings State
  const [recaptchaSettings, setRecaptchaSettings] = useState({
    enableCaptcha: false,
    captchaType: 'recaptcha',
    recaptchaSiteKey: '6Lf5C24rAAAAAHuXMdwF9xSCDCfXGXUTKFU6Ls9d',
    recaptchaSecretKey: '6Lf5C24rAAAAAAfgHModvQqFkiAwhwV7JqmPXvTY'
  });
  const [showRecaptchaModal, setShowRecaptchaModal] = useState(false);
  
  // System Logs State
  const [systemLogs, setSystemLogs] = useState([]);
  const [logFilter, setLogFilter] = useState('');
  const [logLevel, setLogLevel] = useState('');
  const [logLimit, setLogLimit] = useState(100);
  const [logDateRange, setLogDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  
  // Security Monitoring State
  const [securityThreats, setSecurityThreats] = useState([]);
  const [threatLoading, setThreatLoading] = useState(false);
  const [threatLimit, setThreatLimit] = useState(100);
  const [threatFilters, setThreatFilters] = useState({
    level: '',
    startDate: '',
    endDate: '',
    ipAddress: ''
  });
  

  // Auto-refresh states
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const autoRefreshIntervalRef = useRef(null);

  // Fetch system logs
  const fetchSystemLogs = async () => {
    try {
      setLoading(true);
      
      console.log('🔍 DEBUG - Frontend: Fetching system logs with limit:', logLimit);
      
      const response = await api.get(`/system/logs?limit=${logLimit}`, {
        timeout: 15000 // 15 second timeout
      });
      
      console.log('🔍 DEBUG - Frontend: System logs API response:', {
        success: response.data.success,
        dataLength: response.data.data?.length,
        pagination: response.data.pagination,
        sampleData: response.data.data?.[0]
      });
      
      setSystemLogs(response.data.data || []);
      
      // If no logs found, try to fix table structure (might be missing AUTO_INCREMENT)
      if (response.data.data?.length === 0 && response.data.pagination?.total === 0) {
        console.log('🔧 No logs found, attempting to fix table structure...');
        try {
          const fixResponse = await api.post('/system/logs/fix-table');
          if (fixResponse.data.success) {
            console.log('✅ Table fixed, retrying fetch...');
            // Retry fetching logs after a short delay
            setTimeout(() => {
              fetchSystemLogs();
            }, 1000);
            return;
          }
        } catch (fixError) {
          console.error('Error fixing table:', fixError);
          // Continue anyway
        }
      }
      
      // Show warning if limit was reduced
      if (response.data.pagination?.isLimited) {
        setError(`Cảnh báo: Giới hạn tối đa là ${response.data.pagination.limit} dòng. Yêu cầu ${response.data.pagination.requestedLimit} dòng đã bị giảm xuống.`);
      } else {
        setError('');
      }
    } catch (err) {
      console.error('Error fetching system logs:', err);
      console.log('🔍 DEBUG - Frontend: System logs API error:', {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data
      });
      if (err.code === 'ECONNABORTED' || err.response?.status === 504) {
        setError('Kết nối quá chậm, vui lòng thử lại với giới hạn nhỏ hơn');
      } else {
        setError('Không thể tải nhật ký hệ thống');
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch system logs silently (without loading state)
  const fetchSystemLogsSilently = useCallback(async () => {
    try {
      setIsAutoRefreshing(true);
      setError('');
      
      const response = await api.get(`/system/logs?limit=${logLimit}`, {
        timeout: 15000 // 15 second timeout
      });
      
      setSystemLogs(response.data.data || []);
      
      // Show warning if limit was reduced
      if (response.data.pagination?.isLimited) {
        setError(`Cảnh báo: Giới hạn tối đa là ${response.data.pagination.limit} dòng. Yêu cầu ${response.data.pagination.requestedLimit} dòng đã bị giảm xuống.`);
      }
    } catch (err) {
      console.error('Error fetching system logs silently:', err);
      // Don't show error for silent refresh unless it's a timeout
      if (err.code === 'ECONNABORTED' || err.response?.status === 504) {
        setError('Kết nối quá chậm, vui lòng thử lại với giới hạn nhỏ hơn');
      }
    } finally {
      setIsAutoRefreshing(false);
    }
  }, [logLimit]);


  // Fetch security threats
  const fetchSecurityThreats = async () => {
    try {
      setThreatLoading(true);
      
      console.log('🔍 DEBUG - Frontend: Fetching security threats with limit:', threatLimit);
      
      const response = await api.get(`/system/security-threats?limit=${threatLimit}`, {
        timeout: 15000 // 15 second timeout
      });
      
      console.log('🔍 DEBUG - Frontend: Security threats API response:', {
        success: response.data.success,
        dataLength: response.data.data?.length,
        pagination: response.data.pagination,
        sampleData: response.data.data?.[0]
      });
      
      setSecurityThreats(response.data.data || []);
      
      // Show warning if limit was reduced
      if (response.data.pagination?.isLimited) {
        setError(`Cảnh báo: Giới hạn tối đa là ${response.data.pagination.limit} dòng. Yêu cầu ${response.data.pagination.requestedLimit} dòng đã bị giảm xuống.`);
      }
    } catch (err) {
      console.error('Error fetching security threats:', err);
      console.log('🔍 DEBUG - Frontend: Security threats API error:', {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data
      });
      if (err.code === 'ECONNABORTED' || err.response?.status === 504) {
        setError('Kết nối quá chậm, vui lòng thử lại với giới hạn nhỏ hơn');
      } else {
        setError('Không thể tải mối đe dọa bảo mật');
      }
      setSecurityThreats([]);
    } finally {
      setThreatLoading(false);
    }
  };

  // Fetch security threats silently (for auto-refresh)
  const fetchSecurityThreatsSilently = useCallback(async () => {
    try {
      setIsAutoRefreshing(true);
      const response = await api.get(`/system/security-threats?limit=${threatLimit}`, {
        timeout: 15000 // 15 second timeout
      });
      setSecurityThreats(response.data.data || []);
    } catch (err) {
      console.error('Error fetching security threats silently:', err);
      // Don't show error for silent refresh unless it's a timeout
      if (err.code === 'ECONNABORTED' || err.response?.status === 504) {
        setError('Kết nối quá chậm, vui lòng thử lại với giới hạn nhỏ hơn');
      }
    } finally {
      setIsAutoRefreshing(false);
    }
  }, [threatLimit]);

  // Fetch IP whitelist
  const fetchIPWhitelist = async () => {
    try {
      const response = await api.get('/system/ip-whitelist');
      setIpWhitelist(response.data.data || []);
    } catch (err) {
      console.error('Error fetching IP whitelist:', err);
    }
  };

  // Fetch attendance settings
  const fetchAttendanceSettings = async () => {
    try {
        const [securityRes, scheduleRes, securitySettingsRes] = await Promise.all([
        api.get('/employee-attendance/settings/security'),
        api.get('/employee-attendance/settings/work-schedules'),
        api.get('/system/security-settings')
      ]);
      if (securityRes.data.success) {
        setSecuritySettings(securityRes.data.data || []);
      }
      if (scheduleRes.data.success) {
        setWorkSchedules(scheduleRes.data.data || []);
      }
      if (securitySettingsRes.data.success && securitySettingsRes.data.data) {
        const settings = securitySettingsRes.data.data;
        if (settings.attendanceSettings) {
          setRecaptchaSettings({
            enableCaptcha: settings.attendanceSettings.enableCaptcha || false,
            captchaType: settings.attendanceSettings.captchaType || 'recaptcha',
            recaptchaSiteKey: settings.attendanceSettings.recaptchaSiteKey || '6Lf5C24rAAAAAHuXMdwF9xSCDCfXGXUTKFU6Ls9d',
            recaptchaSecretKey: settings.attendanceSettings.recaptchaSecretKey || '6Lf5C24rAAAAAAfgHModvQqFkiAwhwV7JqmPXvTY'
          });
        }
      }
    } catch (error) {
      console.error('Error fetching attendance settings:', error);
    }
  };

  // Fetch scope data (departments and users)
  const fetchScopeData = async () => {
    try {
      setLoadingScopeData(true);
      
      // Fetch departments
      try {
        const deptRes = await api.get('/hr-profiles/departments');
        if (deptRes.data.success && deptRes.data.data) {
          setAvailableDepartments(deptRes.data.data);
        }
      } catch (err) {
        console.error('Error fetching departments:', err);
      }
      
      // Fetch users (only employees, not students)
      try {
        const usersRes = await api.get('/users?limit=999999&approved=true');
        const allUsers = usersRes.data.data || [];
        // Filter only employees (exclude students)
        const employees = allUsers.filter(user => 
          user.role && ['superadmin', 'admin', 'staff'].includes(user.role)
        );
        // Sort by role then name
        const sortedEmployees = employees.sort((a, b) => {
          const roleOrder = { 'superadmin': 0, 'admin': 1, 'staff': 2 };
          const orderA = roleOrder[a.role] !== undefined ? roleOrder[a.role] : 3;
          const orderB = roleOrder[b.role] !== undefined ? roleOrder[b.role] : 3;
          if (orderA !== orderB) return orderA - orderB;
          return (a.full_name || a.username || '').localeCompare(b.full_name || b.username || '');
        });
        setAvailableUsers(sortedEmployees);
      } catch (err) {
        console.error('Error fetching users:', err);
      }
    } finally {
      setLoadingScopeData(false);
    }
  };

  useEffect(() => {
    fetchSystemLogs();
    fetchSecurityThreats();
    fetchIPWhitelist();
    if (activeTab === 'attendance') {
      fetchAttendanceSettings();
    }
  }, [activeTab]);

  // Refetch logs when limit changes
  useEffect(() => {
    if (activeTab === 'logs') {
      fetchSystemLogs();
    }
  }, [logLimit]);

  // Refetch threats when limit changes
  useEffect(() => {
    if (activeTab === 'threats') {
      fetchSecurityThreats();
    }
  }, [threatLimit]);

  // Auto-refresh data every 10 seconds (reduced frequency to prevent timeout)
  useEffect(() => {
    // Start auto-refresh interval
    autoRefreshIntervalRef.current = setInterval(() => {
      if (activeTab === 'logs') {
        fetchSystemLogsSilently();
      } else if (activeTab === 'threats') {
        fetchSecurityThreatsSilently();
      }
    }, 10000); // 10 seconds

    // Clean up interval on unmount
    return () => {
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current);
        autoRefreshIntervalRef.current = null;
      }
    };
  }, [activeTab, fetchSystemLogsSilently, fetchSecurityThreatsSilently]);

  // Filter threats
  const filteredThreats = (securityThreats || []).filter(threat => {
    const matchesLevel = !threatFilters.level || threat.level === threatFilters.level;
    const matchesDate = !threatFilters.startDate || !threatFilters.endDate ||
      (threat.timestamp && new Date(threat.timestamp) >= new Date(threatFilters.startDate) &&
       new Date(threat.timestamp) <= new Date(threatFilters.endDate));
    const matchesIP = !threatFilters.ipAddress || 
      (threat.ip_address || '').toLowerCase().includes(threatFilters.ipAddress.toLowerCase());
    
    return matchesLevel && matchesDate && matchesIP;
  });

  // Filter logs
  const filteredLogs = (systemLogs || []).filter(log => {
    const matchesFilter = !logFilter || 
      log.message.toLowerCase().includes(logFilter.toLowerCase()) ||
      (log.username || '').toLowerCase().includes(logFilter.toLowerCase()) ||
      log.action.toLowerCase().includes(logFilter.toLowerCase());
    
    const matchesLevel = !logLevel || (log.level || '').toUpperCase() === logLevel.toUpperCase();
    
    const matchesDate = !logDateRange.startDate || !logDateRange.endDate ||
      (log.timestamp && new Date(log.timestamp) >= new Date(logDateRange.startDate) &&
       new Date(log.timestamp) <= new Date(logDateRange.endDate));
    
    return matchesFilter && matchesLevel && matchesDate;
  });


  // Delete all system logs
  const handleDeleteAllLogs = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await api.delete('/system/logs/cleanup', {
        data: { 
          confirmDelete: true,
          deleteAll: true 
        },
        timeout: 30000 // 30 second timeout
      });
      
      if (response.data.success) {
        alert('✅ Đã xóa thành công tất cả nhật ký hệ thống!');
        // Refresh logs after deletion
        setSystemLogs([]);
        // Refetch logs to show updated state
        fetchSystemLogs();
      } else {
        setError('Không thể xóa nhật ký: ' + (response.data.message || 'Lỗi không xác định'));
      }
    } catch (err) {
      console.error('Error deleting all logs:', err);
      setError('Không thể xóa nhật ký: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Get log level badge variant (case-insensitive)
  const getLogLevelBadge = (level) => {
    const upperLevel = (level || '').toUpperCase();
    switch (upperLevel) {
      case 'ERROR': return 'danger';
      case 'WARNING': return 'warning';
      case 'INFO': return 'info';
      case 'DEBUG': return 'secondary';
      default: return 'primary';
    }
  };

  // Get threat level badge variant
  const getThreatLevelBadge = (level) => {
    switch (level) {
      case 'CRITICAL': return 'danger';
      case 'HIGH': return 'warning';
      case 'MEDIUM': return 'info';
      case 'LOW': return 'secondary';
      default: return 'primary';
    }
  };

  // Get threat type icon
  const getThreatTypeIcon = (type) => {
    switch (type) {
      case 'SUSPICIOUS_LOGIN': return 'fas fa-user-times';
      case 'API_ABUSE': return 'fas fa-bomb';
      case 'SQL_INJECTION': return 'fas fa-database';
      case 'XSS_ATTACK': return 'fas fa-code';
      case 'BRUTE_FORCE': return 'fas fa-hammer';
      case 'DDOS_ATTACK': return 'fas fa-network-wired';
      default: return 'fas fa-exclamation-triangle';
    }
  };

  // Get threat type name in Vietnamese
  const getThreatTypeName = (type) => {
    switch (type) {
      case 'SUSPICIOUS_LOGIN': return 'Đăng nhập đáng ngờ';
      case 'API_ABUSE': return 'Lạm dụng API';
      case 'SQL_INJECTION': return 'SQL Injection';
      case 'XSS_ATTACK': return 'Tấn công XSS';
      case 'BRUTE_FORCE': return 'Tấn công Brute Force';
      case 'DDOS_ATTACK': return 'Tấn công DDoS';
      default: return 'Mối đe dọa khác';
    }
  };

  return (
    <>
      <style>{errorStyles}</style>
      <AdminNavbar />
      <Container fluid className="session-main-container">
          {/* Header */}
          <div className="session-header">
            <div className="header-content">
              <div className="header-title">
                <h1>Hệ thống</h1>
                <p className="header-subtitle">Quản lý nhật ký và cài đặt bảo mật hệ thống</p>
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
                
                {/* Nhật ký Hệ thống Tab Actions */}
                {activeTab === 'logs' && (
                  <>
                    <Button 
                      variant="outline-light" 
                      className="create-session-btn"
                      onClick={() => setShowFilters(!showFilters)}
                    >
                      {showFilters ? "Ẩn bộ lọc" : "Hiện bộ lọc"}
                    </Button>
                    <Button 
                      variant="outline-light" 
                      className="create-session-btn"
                      onClick={() => {
                        // Export filtered logs to Excel
                        const excelData = [
                          ['Thời gian', 'Mức độ', 'Người dùng', 'Hành động', 'Nội dung', 'IP']
                        ];
                        
                        filteredLogs.forEach(log => {
                          // Format message for ERROR logs
                          let displayMessage = log.message;
                          if (log.level === 'ERROR' && log.message) {
                            // For ERROR logs, format the message to be more readable in Excel
                            displayMessage = log.message
                              .split(' | ')
                              .map(part => part.trim())
                              .join('\n');
                          }
                          
                          excelData.push([
                            new Date(log.timestamp).toLocaleString('vi-VN'),
                            log.level,
                            log.user_id ? `${log.username || 'N/A'} (ID: ${log.user_id})` : 'Hệ thống',
                            log.action,
                            displayMessage,
                            log.ip_address || 'N/A'
                          ]);
                        });
                        
                        // Create workbook and worksheet
                        const wb = XLSX.utils.book_new();
                        const ws = XLSX.utils.aoa_to_sheet(excelData);
                        
                        // Set column widths
                        ws['!cols'] = [
                          { width: 20 }, // Thời gian
                          { width: 10 }, // Mức độ
                          { width: 25 }, // Người dùng
                          { width: 20 }, // Hành động
                          { width: 50 }, // Nội dung
                          { width: 15 }  // IP
                        ];
                        
                        // Add worksheet to workbook
                        XLSX.utils.book_append_sheet(wb, ws, 'Nhật ký Hệ thống');
                        
                        // Generate and download Excel file
                        XLSX.writeFile(wb, `system_logs_filtered_${new Date().toISOString().split('T')[0]}.xlsx`);
                      }}
                    >
                      Xuất bộ lọc
                    </Button>
                    <Button 
                      variant="outline-light" 
                      className="create-session-btn"
                      onClick={async () => {
                        try {
                          setLoading(true);
                          const response = await api.get('/system/logs?limit=999999', {
                            timeout: 30000 // 30 second timeout for large data
                          });
                          
                          const excelData = [
                            ['Thời gian', 'Mức độ', 'Người dùng', 'Hành động', 'Nội dung', 'IP']
                          ];
                          
                          (response.data.data || []).forEach(log => {
                            // Format message for ERROR logs
                            let displayMessage = log.message;
                            if (log.level === 'ERROR' && log.message) {
                              // For ERROR logs, format the message to be more readable in Excel
                              displayMessage = log.message
                                .split(' | ')
                                .map(part => part.trim())
                                .join('\n');
                            }
                            
                            excelData.push([
                              new Date(log.timestamp).toLocaleString('vi-VN'),
                              log.level,
                              log.user_id ? `${log.username || 'N/A'} (ID: ${log.user_id})` : 'Hệ thống',
                              log.action,
                              displayMessage,
                              log.ip_address || 'N/A'
                            ]);
                          });
                          
                          // Create workbook and worksheet
                          const wb = XLSX.utils.book_new();
                          const ws = XLSX.utils.aoa_to_sheet(excelData);
                          
                          // Set column widths
                          ws['!cols'] = [
                            { width: 20 }, // Thời gian
                            { width: 10 }, // Mức độ
                            { width: 25 }, // Người dùng
                            { width: 20 }, // Hành động
                            { width: 50 }, // Nội dung
                            { width: 15 }  // IP
                          ];
                          
                          // Add worksheet to workbook
                          XLSX.utils.book_append_sheet(wb, ws, 'Nhật ký Hệ thống');
                          
                          // Generate and download Excel file
                          XLSX.writeFile(wb, `system_logs_all_${new Date().toISOString().split('T')[0]}.xlsx`);
                          
                        } catch (err) {
                          console.error('Error downloading all logs:', err);
                          setError('Không thể tải xuống toàn bộ nhật ký: ' + (err.response?.data?.message || err.message));
                        } finally {
                          setLoading(false);
                        }
                      }}
                    >
                      Tải xuống toàn bộ
                    </Button>
                    <Button 
                      variant="outline-danger" 
                      className="create-session-btn"
                      onClick={() => {
                        if (window.confirm('⚠️ CẢNH BÁO: Bạn có chắc chắn muốn xóa TẤT CẢ nhật ký hệ thống không?\n\nHành động này KHÔNG THỂ HOÀN TÁC!\n\nNhập "DELETE ALL LOGS" để xác nhận:')) {
                          const confirmation = prompt('Nhập "DELETE ALL LOGS" để xác nhận xóa tất cả nhật ký:');
                          if (confirmation === 'DELETE ALL LOGS') {
                            handleDeleteAllLogs();
                          } else {
                            alert('❌ Xác nhận không đúng. Hủy bỏ thao tác.');
                          }
                        }
                      }}
                    >
                      Xóa tất cả nhật ký
                    </Button>
                  </>
                )}
                
                {/* Giám sát Bảo mật Tab Actions */}
                {activeTab === 'threats' && (
                  <>
                    <Button 
                      variant="outline-light" 
                      className="create-session-btn"
                      onClick={() => setShowThreatFilters(!showThreatFilters)}
                    >
                      {showThreatFilters ? "Ẩn bộ lọc" : "Hiện bộ lọc"}
                    </Button>
                    <Button 
                      variant="outline-light" 
                      className="create-session-btn"
                      onClick={() => {
                        // Export filtered threats to Excel
                        const excelData = [
                          ['Thời gian', 'Mức độ', 'Loại mối đe dọa', 'IP Address', 'Mô tả', 'Số lần thử', 'Trạng thái']
                        ];
                        
                        filteredThreats.forEach(threat => {
                          excelData.push([
                            new Date(threat.timestamp).toLocaleString('vi-VN'),
                            threat.level,
                            getThreatTypeName(threat.type),
                            threat.ip_address || 'N/A',
                            threat.description || 'N/A',
                            threat.attempts || 0,
                            threat.blocked ? 'Đã chặn' : 'Đang theo dõi'
                          ]);
                        });
                        
                        // Create workbook and worksheet
                        const wb = XLSX.utils.book_new();
                        const ws = XLSX.utils.aoa_to_sheet(excelData);
                        
                        // Set column widths
                        ws['!cols'] = [
                          { width: 20 }, // Thời gian
                          { width: 12 }, // Mức độ
                          { width: 25 }, // Loại mối đe dọa
                          { width: 15 }, // IP Address
                          { width: 40 }, // Mô tả
                          { width: 12 }, // Số lần thử
                          { width: 15 }  // Trạng thái
                        ];
                        
                        // Add worksheet to workbook
                        XLSX.utils.book_append_sheet(wb, ws, 'Mối đe dọa Bảo mật');
                        
                        // Generate and download Excel file
                        XLSX.writeFile(wb, `security_threats_${new Date().toISOString().split('T')[0]}.xlsx`);
                      }}
                    >
                      Xuất mối đe dọa
                    </Button>
                    <Button 
                      variant="outline-info" 
                      className="create-session-btn"
                      onClick={() => {
                        // Refresh security threats
                        fetchSecurityThreats();
                      }}
                    >
                      Làm mới
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          {error && (
            <Alert variant="danger" className="mb-4">
              <i className="fas fa-exclamation-triangle me-2"></i>
              {error}
            </Alert>
          )}

          {/* Log Filters */}
          {showFilters && activeTab === 'logs' && (
            <div className="session-list-controls1">
              <div className="search-controls1">
                <Row className="g-2">
                  <Col md={2}>
                    <div className="mb-3">
                      <input
                        type="text"
                        className="search-input"
                        placeholder="Tìm theo nội dung..."
                        value={logFilter}
                        onChange={(e) => setLogFilter(e.target.value)}
                      />
                    </div>
                  </Col>
                  <Col md={2}>
                    <div className="mb-3">
                      <select
                        className="filter-select"
                        value={logLevel}
                        onChange={(e) => setLogLevel(e.target.value)}
                      >
                        <option value="">Tất cả mức độ</option>
                        <option value="ERROR">Lỗi</option>
                        <option value="WARNING">Cảnh báo</option>
                        <option value="INFO">Thông tin</option>
                        <option value="DEBUG">Debug</option>
                      </select>
                    </div>
                  </Col>
                  <Col md={2}>
                    <div className="mb-3">
                      <label className="form-label">
                        Từ ngày
                      </label>
                      <input
                        type="date"
                        className="filter-select"
                        value={logDateRange.startDate}
                        onChange={(e) => setLogDateRange(prev => ({
                          ...prev,
                          startDate: e.target.value
                        }))}
                      />
                    </div>
                  </Col>
                  <Col md={2}>
                    <div className="mb-3">
                      <label className="form-label">
                        Đến ngày
                      </label>
                      <input
                        type="date"
                        className="filter-select"
                        value={logDateRange.endDate}
                        onChange={(e) => setLogDateRange(prev => ({
                          ...prev,
                          endDate: e.target.value
                        }))}
                      />
                    </div>
                  </Col>
                  <Col md={2}>
                    <div className="mb-3">
                      <select
                        className="filter-select"
                        value={logLimit === 999999 ? 'all' : logLimit.toString()}
                        onChange={(e) => {
                          const newLimit = e.target.value;
                          if (newLimit === 'all') {
                            if (window.confirm('Cảnh báo: Hiển thị tất cả logs có thể làm chậm trình duyệt và tiêu tốn nhiều bộ nhớ. Bạn có chắc chắn muốn tiếp tục?')) {
                              setLogLimit(999999);
                            }
                          } else {
                            setLogLimit(parseInt(newLimit));
                          }
                        }}
                      >
                        <option value="100">100 dòng hiển thị</option>
                        <option value="200">200 dòng</option>
                        <option value="500">500 dòng</option>
                        <option value="1000">1000 dòng</option>
                        <option value="5000">5000 dòng</option>
                        <option value="all">Tất cả (Cảnh báo)</option>
                      </select>
                    </div>
                  </Col>
                  <Col md={2}>
                    <div className="d-flex justify-content-end align-items-center mb-3">
                      <Button 
                        variant="outline-secondary" 
                        size="sm"
                        onClick={() => {
                          setLogFilter('');
                          setLogLevel('');
                          setLogDateRange({ startDate: '', endDate: '' });
                        }}
                      >
                        <i className="fas fa-times me-1"></i>
                        Xóa bộ lọc
                      </Button>
                    </div>
                  </Col>
                </Row>
              </div>
            </div>
          )}

          {/* Threat Filters */}
          {activeTab === 'threats' && showThreatFilters && (
            <div className="session1-list-controls">
              <div className="search1-controls">
                <Row className="g-2">
                  <Col md={2}>
                    <div className="mb-3">
                      <label className="form-label">
                        <i className="fas fa-exclamation-triangle me-2"></i>
                        Mức độ
                      </label>
                      <select
                        className="filter-select"
                        value={threatFilters.level}
                        onChange={(e) => setThreatFilters(prev => ({
                          ...prev,
                          level: e.target.value
                        }))}
                      >
                        <option value="">Tất cả</option>
                        <option value="CRITICAL">Nghiêm trọng</option>
                        <option value="HIGH">Cao</option>
                        <option value="MEDIUM">Trung bình</option>
                        <option value="LOW">Thấp</option>
                      </select>
                    </div>
                  </Col>
                  <Col md={2}>
                    <div className="mb-3">
                      <label className="form-label">
                        <i className="fas fa-calendar me-2"></i>
                        Từ ngày
                      </label>
                      <input
                        type="date"
                        className="filter-select"
                        value={threatFilters.startDate}
                        onChange={(e) => setThreatFilters(prev => ({
                          ...prev,
                          startDate: e.target.value
                        }))}
                      />
                    </div>
                  </Col>
                  <Col md={2}>
                    <div className="mb-3">
                      <label className="form-label">
                        <i className="fas fa-calendar me-2"></i>
                        Đến ngày
                      </label>
                      <input
                        type="date"
                        className="filter-select"
                        value={threatFilters.endDate}
                        onChange={(e) => setThreatFilters(prev => ({
                          ...prev,
                          endDate: e.target.value
                        }))}
                      />
                    </div>
                  </Col>
                  <Col md={2}>
                    <div className="mb-3">
                      <label className="form-label">
                        <i className="fas fa-network-wired me-2"></i>
                        IP Address
                      </label>
                      <input
                        type="text"
                        className="filter-select"
                        placeholder="Nhập IP..."
                        value={threatFilters.ipAddress}
                        onChange={(e) => setThreatFilters(prev => ({
                          ...prev,
                          ipAddress: e.target.value
                        }))}
                      />
                    </div>
                  </Col>
                  <Col md={2}>
                    <div className="mb-3">
                      <select
                        className="filter-select"
                        value={threatLimit === 999999 ? 'all' : threatLimit.toString()}
                        onChange={(e) => {
                          const newLimit = e.target.value;
                          if (newLimit === 'all') {
                            if (window.confirm('Cảnh báo: Hiển thị tất cả mối đe dọa có thể làm chậm trình duyệt và tiêu tốn nhiều bộ nhớ. Bạn có chắc chắn muốn tiếp tục?')) {
                              setThreatLimit(999999);
                            }
                          } else {
                            setThreatLimit(parseInt(newLimit));
                          }
                        }}
                      >
                        <option value="100">100 dòng hiển thị</option>
                        <option value="200">200 dòng</option>
                        <option value="500">500 dòng</option>
                        <option value="1000">1000 dòng</option>
                        <option value="5000">5000 dòng</option>
                        <option value="all">Tất cả (Cảnh báo)</option>
                      </select>
                    </div>
                  </Col>
                  <Col md={2}>
                    <div className="d-flex justify-content-end align-items-center mb-3">
                      <Button 
                        variant="outline-secondary" 
                        size="sm"
                        onClick={() => {
                          setThreatFilters({
                            level: '',
                            startDate: '',
                            endDate: '',
                            ipAddress: ''
                          });
                          setThreatLimit(100);
                        }}
                      >
                        <i className="fas fa-times me-1"></i>
                        Xóa bộ lọc
                      </Button>
                    </div>
                  </Col>
                </Row>
              </div>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="tab-navigation">
            <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k)}>
              <Nav variant="tabs" className="custom-tabs">
                <Nav.Item>
                  <Nav.Link eventKey="logs">
                    <span className="tab-title">
                      <i className="fas fa-file-alt me-2"></i>
                      Nhật ký Hệ thống ({systemLogs?.length || 0})
                    </span>
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link eventKey="threats">
                    <span className="tab-title">
                      <i className="fas fa-exclamation-triangle me-2"></i>
                      Giám sát Bảo mật ({securityThreats?.length || 0})
                    </span>
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link eventKey="whitelist">
                    <span className="tab-title">
                      <i className="fas fa-shield-alt me-2"></i>
                      IP Whitelist ({ipWhitelist?.length || 0})
                    </span>
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link eventKey="attendance">
                    <span className="tab-title">
                      <i className="fas fa-clock me-2"></i>
                      Chấm công
                    </span>
                  </Nav.Link>
                </Nav.Item>
              </Nav>

              <Tab.Content>
                {/* System Logs Tab */}
                <Tab.Pane eventKey="logs">
                  {loading ? (
                    <div className="text-center py-4">
                      <Spinner animation="border" />
                      <p className="mt-2">Đang tải nhật ký...</p>
                    </div>
                  ) : (
                    <div className="session-table-container" style={{ overflowX: 'auto' }}>
                      <Table className="session-table" responsive>
                        <thead>
                          <tr>
                            <th>Thời gian</th>
                            <th>Mức độ</th>
                            <th>Người dùng</th>
                            <th>Hành động</th>
                            <th>Nội dung</th>
                            <th>IP</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredLogs.length > 0 ? (
                            filteredLogs.map((log, index) => (
                              <tr key={log.id || `log-${index}`}>
                                <td className="session-date">
                                  {log.timestamp ? new Date(log.timestamp).toLocaleString('vi-VN') : 'N/A'}
                                </td>
                                <td>
                                  <Badge bg={getLogLevelBadge(log.level || 'INFO')} className="status-badge">
                                    {log.level || 'INFO'}
                                  </Badge>
                                </td>
                                <td className="session-title-cell">
                                  {log.user_id ? (
                                    <div>
                                      <div className="fw-bold">{log.username || 'N/A'}</div>
                                      <small className="text-muted">ID: {log.user_id}</small>
                                    </div>
                                  ) : (
                                    'Hệ thống'
                                  )}
                                </td>
                                <td>
                                  <Badge bg="secondary" className="status-badge">{log.action || 'N/A'}</Badge>
                                </td>
                                <td className="session-location">
                                  {(log.level || '').toUpperCase() === 'ERROR' ? (
                                    <div className="error-details">
                                      <div className="error-summary mb-2">
                                        <i className="fas fa-exclamation-triangle text-danger me-2"></i>
                                        <strong className="text-danger">Lỗi hệ thống:</strong>
                                      </div>
                                      <div className="error-content">
                                        {log.message ? log.message.split(' | ').map((part, idx) => (
                                          <div key={idx} className="error-part mb-1">
                                            <small className="text-muted">
                                              {part.includes('ERROR:') ? (
                                                <span className="text-danger fw-bold">{part}</span>
                                              ) : part.includes('Chi tiết lỗi:') ? (
                                                <span className="text-warning">{part}</span>
                                              ) : part.includes('Stack trace:') ? (
                                                <details className="mt-1">
                                                  <summary className="text-info cursor-pointer">Stack trace (click để xem)</summary>
                                                  <pre className="mt-2 p-2 bg-light border rounded small text-wrap" style={{ fontSize: '10px', maxHeight: '100px', overflow: 'auto' }}>
                                                    {part.replace('Stack trace: ', '')}
                                                  </pre>
                                                </details>
                                              ) : part.includes('Request:') ? (
                                                <span className="text-primary">{part}</span>
                                              ) : part.includes('IP:') ? (
                                                <span className="text-secondary">{part}</span>
                                              ) : part.includes('User ID:') ? (
                                                <span className="text-info">{part}</span>
                                              ) : part.includes('HTTP Status:') ? (
                                                <span className="text-warning fw-bold">{part}</span>
                                              ) : (
                                                <span>{part}</span>
                                              )}
                                            </small>
                                          </div>
                                        )) : 'N/A'}
                                      </div>
                                    </div>
                                  ) : (
                                    log.message || 'N/A'
                                  )}
                                </td>
                                <td className="session-location text-start">{log.ip_address || 'N/A'}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="6" className="text-center py-5">
                                <div className="text-center p-5">
                                  <i className="fas fa-file-alt fa-4x mb-3 text-muted"></i>
                                  <h5>Chưa có nhật ký nào</h5>
                                  <p className="text-muted">Nhật ký hệ thống sẽ hiển thị khi có hoạt động trong hệ thống</p>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </Table>
                    </div>
                  )}
                </Tab.Pane>


                {/* Security Monitoring Tab */}
                <Tab.Pane eventKey="threats">

                  {/* Threats Table */}
                  {threatLoading ? (
                    <div className="text-center py-4">
                      <Spinner animation="border" />
                      <p className="mt-2">Đang tải mối đe dọa...</p>
                    </div>
                  ) : (
                    <div className="session-table-container" style={{ overflowX: 'auto' }}>
                      <Table className="session-table" responsive>
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Thời gian</th>
                            <th>Mức độ</th>
                            <th>Loại mối đe dọa</th>
                            <th>IP Address</th>
                            <th>Mô tả</th>
                            <th>Số lần thử</th>
                            <th>Trạng thái</th>
                            <th>Hành động</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredThreats.length > 0 ? (
                            filteredThreats.map((threat, index) => (
                              <tr key={threat.id || `threat-${index}`}>
                                <td>
                                  {index + 1}
                                </td>
                                <td className="session-date">
                                  {threat.timestamp ? new Date(threat.timestamp).toLocaleString('vi-VN') : 'N/A'}
                                </td>
                                <td>
                                  <Badge bg={getThreatLevelBadge(threat.level || 'LOW')} className="status-badge">
                                    {threat.level || 'LOW'}
                                  </Badge>
                                </td>
                                <td className="session-title-cell">
                                  <div className="d-flex align-items-center">
                                    <i className={`${getThreatTypeIcon(threat.type || 'UNKNOWN')} me-2`}></i>
                                    {getThreatTypeName(threat.type || 'UNKNOWN')}
                                  </div>
                                </td>
                                <td className="session-location">
                                  <code>{threat.ip_address || 'N/A'}</code>
                                </td>
                                <td className="session-class text-start">{threat.description || 'N/A'}</td>
                                <td>
                                  <Badge bg="info" className="status-badge">
                                    {threat.attempts || 0}
                                  </Badge>
                                </td>
                                <td>
                                  <Badge bg={(threat.blocked === true) ? 'danger' : 'success'} className="status-badge">
                                    {(threat.blocked === true) ? 'Đã chặn' : 'Đang theo dõi'}
                                  </Badge>
                                </td>
                                <td>
                                  <div className="d-flex gap-2">
                                    <Button 
                                      variant={(threat.blocked === true) ? 'success' : 'danger'} 
                                      size="sm"
                                      onClick={async () => {
                                        try {
                                          if (threat.blocked === true) {
                                            // Unblock IP
                                            await api.post('/system/unblock-ip', {
                                              ipAddress: threat.ip_address
                                            });
                                            alert('✅ Đã bỏ chặn IP ' + threat.ip_address);
                                            
                                            // Refresh threats data from server to get accurate state
                                            await fetchSecurityThreats();
                                          } else {
                                            // Block IP
                                            await api.post('/system/block-ip', {
                                              ipAddress: threat.ip_address,
                                              reason: `Blocked due to ${threat.type}`
                                            });
                                            alert('🔒 Đã chặn IP ' + threat.ip_address);
                                            
                                            // Refresh threats data from server to get accurate state
                                            await fetchSecurityThreats();
                                          }
                                        } catch (error) {
                                          console.error('Error toggling IP block:', error);
                                          alert('❌ Lỗi: ' + (error.response?.data?.message || error.message));
                                        }
                                      }}
                                    >
                                      <i className={`fas ${(threat.blocked === true) ? 'fa-unlock' : 'fa-lock'} me-1`}></i>
                                      {(threat.blocked === true) ? 'Bỏ chặn' : 'Chặn IP'}
                                    </Button>
                                    <Button 
                                      variant="outline-info" 
                                      size="sm"
                                      onClick={() => {
                                        // View details
                                        console.log('View threat details:', threat);
                                      }}
                                    >
                                      <i className="fas fa-eye me-1"></i>
                                      Chi tiết
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="8" className="text-center py-5">
                                <div className="text-center p-5">
                                  <i className="fas fa-shield-alt fa-4x mb-3 text-success"></i>
                                  <h5>Không có mối đe dọa nào</h5>
                                  <p className="text-muted">Hệ thống đang hoạt động an toàn</p>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </Table>
                    </div>
                    )}
                </Tab.Pane>

                {/* IP Whitelist Tab */}
                <Tab.Pane eventKey="whitelist">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <Button 
                      variant="primary"
                      onClick={() => setShowWhitelistModal(true)}
                    >
                      <i className="fas fa-plus me-2"></i>
                      Thêm IP
                    </Button>
                  </div>
                  
                  <Table className="session-table" responsive>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>IP Address</th>
                        <th>Mô tả</th>
                        <th>Ngày tạo</th>
                        <th>Trạng thái</th>
                        <th>Hành động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ipWhitelist.length > 0 ? (
                        ipWhitelist.map((ip, index) => (
                          <tr key={ip.id}>
                            <td>{index + 1}</td>
                            <td><code>{ip.ip_address}</code></td>
                            <td>{ip.description || 'N/A'}</td>
                            <td>{new Date(ip.created_at).toLocaleString('vi-VN')}</td>
                            <td>
                              <Badge bg={ip.is_active ? 'success' : 'secondary'}>
                                {ip.is_active ? 'Hoạt động' : 'Đã tắt'}
                              </Badge>
                            </td>
                            <td>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={async () => {
                                  if (window.confirm(`Bạn có chắc chắn muốn xóa IP ${ip.ip_address} khỏi whitelist?`)) {
                                    try {
                                      await api.delete(`/system/ip-whitelist/${ip.id}`);
                                      alert('✅ Đã xóa IP khỏi whitelist');
                                      fetchIPWhitelist();
                                    } catch (error) {
                                      alert('❌ Lỗi: ' + (error.response?.data?.message || error.message));
                                    }
                                  }
                                }}
                              >
                                <i className="fas fa-trash me-1"></i>
                                Xóa
                              </Button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" className="text-center py-5">
                            <div className="text-center p-5">
                              <i className="fas fa-shield-alt fa-4x mb-3 text-muted"></i>
                              <h5>Chưa có IP nào trong whitelist</h5>
                              <p className="text-muted">Thêm IP vào whitelist để cho phép truy cập các endpoint nhạy cảm</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </Tab.Pane>

                {/* Attendance Settings Tab */}
                <Tab.Pane eventKey="attendance">
                  <Row>
                    <Col md={12}>
                      <Card className="modern-card mb-4">
                        <Card.Body>
                          <div className="d-flex justify-content-between align-items-center mb-3">
                            <h6>
                              <i className="fas fa-shield-alt me-2"></i>
                              Cài đặt reCAPTCHA cho Chấm công
                            </h6>
                            <Button 
                              variant="primary" 
                              size="sm"
                              onClick={() => setShowRecaptchaModal(true)}
                            >
                              <i className="fas fa-cog me-1"></i>Cấu hình
                            </Button>
                          </div>
                          <div className="mb-3">
                            <div className="d-flex align-items-center mb-2">
                              <Badge bg={recaptchaSettings.enableCaptcha ? 'success' : 'secondary'} className="me-2">
                                {recaptchaSettings.enableCaptcha ? 'Đã bật' : 'Đã tắt'}
                              </Badge>
                              <span className="text-muted">
                                {recaptchaSettings.enableCaptcha 
                                  ? 'CAPTCHA đang được kích hoạt cho chấm công'
                                  : 'CAPTCHA chưa được kích hoạt'}
                              </span>
                            </div>
                            {recaptchaSettings.enableCaptcha && (
                              <div className="small text-muted">
                                <div>Loại: {recaptchaSettings.captchaType === 'recaptcha' ? 'Google reCAPTCHA v2' : recaptchaSettings.captchaType}</div>
                                <div>Site Key: {recaptchaSettings.recaptchaSiteKey}</div>
                              </div>
                            )}
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                  </Row>
                  <Row>
                    <Col md={6}>
                      <Card className="modern-card mb-4">
                        <Card.Body>
                          <div className="d-flex justify-content-between align-items-center mb-3">
                            <h6>Quản lý hàng rào bảo mật</h6>
                            <Button 
                              variant="primary" 
                              size="sm"
                              onClick={() => {
                                setEditingSecurity(null);
                                setSecurityForm({
                                  setting_type: 'ip_restriction',
                                  scope_type: 'all_employees',
                                  scope_value: '',
                                  setting_data: [],
                                  is_active: true
                                });
                                setShowSecurityModal(true);
                              }}
                            >
                              <i className="fas fa-plus me-1"></i>Thêm
                            </Button>
                          </div>
                          <Table className="session-table" responsive size="sm">
                            <thead>
                              <tr>
                                <th>Loại</th>
                                <th>Phạm vi</th>
                                <th>Giá trị</th>
                                <th>Trạng thái</th>
                                <th>Hành động</th>
                              </tr>
                            </thead>
                            <tbody>
                              {securitySettings.map((setting) => {
                                const settingTypeNames = {
                                  'ip_restriction': 'IP',
                                  'location_restriction': 'Vị trí',
                                  'device_restriction': 'Thiết bị'
                                };
                                const scopeTypeNames = {
                                  'all_employees': 'Tất cả',
                                  'role': 'Vai trò',
                                  'department': 'Phòng ban',
                                  'user': 'Người dùng'
                                };
                                
                                // Parse and format setting_data for display
                                let settingDataDisplay = '-';
                                try {
                                  const settingData = typeof setting.setting_data === 'string' 
                                    ? JSON.parse(setting.setting_data) 
                                    : setting.setting_data;
                                  
                                  if (Array.isArray(settingData) && settingData.length > 0) {
                                    if (setting.setting_type === 'ip_restriction') {
                                      // Display IP addresses
                                      if (settingData.length <= 3) {
                                        settingDataDisplay = settingData.join(', ');
                                      } else {
                                        settingDataDisplay = `${settingData.slice(0, 3).join(', ')}, ... (${settingData.length} IP)`;
                                      }
                                    } else if (setting.setting_type === 'location_restriction') {
                                      // Display locations
                                      if (settingData.length <= 2) {
                                        settingDataDisplay = settingData.map(loc => 
                                          loc.name || `${loc.latitude}, ${loc.longitude}`
                                        ).join(', ');
                                      } else {
                                        settingDataDisplay = `${settingData.slice(0, 2).map(loc => 
                                          loc.name || `${loc.latitude}, ${loc.longitude}`
                                        ).join(', ')}, ... (${settingData.length} địa điểm)`;
                                      }
                                    } else if (setting.setting_type === 'device_restriction') {
                                      // Display device types
                                      const deviceNames = {
                                        'pc': 'Máy tính',
                                        'mobile': 'Điện thoại',
                                        'tablet': 'Máy tính bảng'
                                      };
                                      const deviceDisplay = settingData.map(d => deviceNames[d] || d).join(', ');
                                      settingDataDisplay = deviceDisplay || '-';
                                    }
                                  }
                                } catch (e) {
                                  console.error('Error parsing setting_data:', e);
                                  settingDataDisplay = '-';
                                }
                                
                                return (
                                  <tr key={setting.id}>
                                    <td>{settingTypeNames[setting.setting_type] || setting.setting_type}</td>
                                    <td>
                                      {scopeTypeNames[setting.scope_type] || setting.scope_type}
                                      {setting.scope_value && setting.scope_type !== 'all_employees' && (
                                        <div className="small text-muted mt-1">
                                          {typeof setting.scope_value === 'string' 
                                            ? setting.scope_value.split(',').length > 3
                                              ? `${setting.scope_value.split(',').slice(0, 3).join(', ')}, ...`
                                              : setting.scope_value
                                            : Array.isArray(setting.scope_value)
                                              ? setting.scope_value.length > 3
                                                ? `${setting.scope_value.slice(0, 3).join(', ')}, ...`
                                                : setting.scope_value.join(', ')
                                              : setting.scope_value}
                                        </div>
                                      )}
                                    </td>
                                    <td>
                                      <div className="fw-medium">{settingDataDisplay}</div>
                                    </td>
                                    <td>
                                      <Badge bg={setting.is_active ? 'success' : 'secondary'}>
                                        {setting.is_active ? 'Hoạt động' : 'Tắt'}
                                      </Badge>
                                    </td>
                                    <td>
                                      <Button
                                        variant="outline-primary"
                                        size="sm"
                                        className="me-1"
                                        onClick={() => {
                                          setEditingSecurity(setting);
                                          // Parse setting_data
                                          let parsedData = setting.setting_data;
                                          if (typeof parsedData === 'string') {
                                            try {
                                              parsedData = JSON.parse(parsedData);
                                            } catch (e) {
                                              parsedData = [];
                                            }
                                          }
                                          if (!Array.isArray(parsedData)) {
                                            parsedData = [];
                                          }
                                          
                                          setSecurityForm({
                                            ...setting,
                                            setting_data: parsedData
                                          });
                                          
                                          // Reset location form if editing location restriction
                                          if (setting.setting_type === 'location_restriction' && parsedData.length > 0) {
                                            const firstLoc = parsedData[0];
                                            setNewLocation({
                                              name: firstLoc.name || '',
                                              latitude: firstLoc.latitude?.toString() || '',
                                              longitude: firstLoc.longitude?.toString() || '',
                                              radius: firstLoc.radius || 100,
                                              coordinatesInput: ''
                                            });
                                            setSelectedLocationForMap({
                                              latitude: parseFloat(firstLoc.latitude),
                                              longitude: parseFloat(firstLoc.longitude),
                                              radius: firstLoc.radius || 100
                                            });
                                          } else {
                                            setNewLocation({
                                              name: '',
                                              latitude: '',
                                              longitude: '',
                                              radius: 100,
                                              coordinatesInput: ''
                                            });
                                            setSelectedLocationForMap(null);
                                          }
                                          
                                          setShowSecurityModal(true);
                                        }}
                                      >
                                        <i className="fas fa-edit"></i>
                                      </Button>
                                      <Button
                                        variant="outline-danger"
                                        size="sm"
                                        onClick={async () => {
                                          if (window.confirm('Bạn có chắc muốn xóa cài đặt này?')) {
                                            try {
                                              await api.delete(`/employee-attendance/settings/security/${setting.id}`);
                                              showAlert('Xóa thành công', 'success', 'Thành công');
                                              fetchAttendanceSettings();
                                            } catch (error) {
                                              showAlert('Lỗi: ' + (error.response?.data?.message || error.message), 'danger', 'Lỗi');
                                            }
                                          }
                                        }}
                                      >
                                        <i className="fas fa-trash"></i>
                                      </Button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </Table>
                        </Card.Body>
                      </Card>
                    </Col>
                    <Col md={6}>
                      <Card className="modern-card mb-4">
                        <Card.Body>
                          <div className="d-flex justify-content-between align-items-center mb-3">
                            <h6>Quản lý lịch làm việc</h6>
                            <Button 
                              variant="primary" 
                              size="sm"
                              onClick={async () => {
                                setEditingSchedule(null);
                                setScheduleForm({
                                  scope_type: 'all_employees',
                                  scope_value: [],
                                  start_time: '07:30',
                                  end_time: '16:30',
                                  required_hours: 8.0,
                                  work_days: [1, 2, 3, 4, 5, 6],
                                  is_active: true
                                });
                                await fetchScopeData();
                                setShowScheduleModal(true);
                              }}
                            >
                              <i className="fas fa-plus me-1"></i>Thêm
                            </Button>
                          </div>
                          <Table className="session-table" responsive size="sm">
                            <thead>
                              <tr>
                                <th>Phạm vi</th>
                                <th>Giờ làm</th>
                                <th>Số giờ</th>
                                <th>Ngày làm</th>
                                <th>Trạng thái</th>
                                <th>Hành động</th>
                              </tr>
                            </thead>
                            <tbody>
                              {workSchedules.map((schedule) => {
                                const scopeTypeNames = {
                                  'all_employees': 'Tất cả',
                                  'role': 'Vai trò',
                                  'department': 'Phòng ban',
                                  'user': 'Người dùng'
                                };
                                const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
                                const workDays = typeof schedule.work_days === 'string' 
                                  ? JSON.parse(schedule.work_days) 
                                  : schedule.work_days;
                                // Format scope_value for display
                                let scopeValueDisplay = '-';
                                if (schedule.scope_value) {
                                  if (typeof schedule.scope_value === 'string') {
                                    const values = schedule.scope_value.split(',').map(v => v.trim());
                                    scopeValueDisplay = values.length > 3 
                                      ? `${values.slice(0, 3).join(', ')}, ...` 
                                      : schedule.scope_value;
                                  } else {
                                    scopeValueDisplay = Array.isArray(schedule.scope_value) 
                                      ? schedule.scope_value.length > 3 
                                        ? `${schedule.scope_value.slice(0, 3).join(', ')}, ...` 
                                        : schedule.scope_value.join(', ')
                                      : schedule.scope_value;
                                  }
                                }
                                
                                return (
                                  <tr key={schedule.id}>
                                    <td>
                                      {scopeTypeNames[schedule.scope_type] || schedule.scope_type}
                                      {schedule.scope_value && (
                                        <div className="small text-muted mt-1">{scopeValueDisplay}</div>
                                      )}
                                    </td>
                                    <td>{schedule.start_time} - {schedule.end_time}</td>
                                    <td>{schedule.required_hours}h</td>
                                    <td>{workDays.map(d => dayNames[d]).join(', ')}</td>
                                    <td>
                                      <Badge bg={schedule.is_active ? 'success' : 'secondary'}>
                                        {schedule.is_active ? 'Hoạt động' : 'Tắt'}
                                      </Badge>
                                    </td>
                                    <td>
                                      <Button
                                        variant="outline-primary"
                                        size="sm"
                                        className="me-1"
                                        onClick={async () => {
                                          setEditingSchedule(schedule);
                                          // Parse scope_value - could be string or array
                                          let scopeValue = schedule.scope_value;
                                          if (typeof scopeValue === 'string') {
                                            // Try to parse as JSON, if fails treat as comma-separated
                                            try {
                                              scopeValue = JSON.parse(scopeValue);
                                            } catch {
                                              scopeValue = scopeValue ? scopeValue.split(',').map(v => v.trim()).filter(v => v) : [];
                                            }
                                          }
                                          if (!Array.isArray(scopeValue)) {
                                            scopeValue = scopeValue ? [scopeValue] : [];
                                          }
                                          
                                          setScheduleForm({
                                            ...schedule,
                                            scope_value: scopeValue,
                                            work_days: typeof schedule.work_days === 'string' 
                                              ? JSON.parse(schedule.work_days) 
                                              : schedule.work_days
                                          });
                                          await fetchScopeData();
                                          setShowScheduleModal(true);
                                        }}
                                      >
                                        <i className="fas fa-edit"></i>
                                      </Button>
                                      <Button
                                        variant="outline-danger"
                                        size="sm"
                                        onClick={async () => {
                                          if (window.confirm('Bạn có chắc muốn xóa lịch này?')) {
                                            try {
                                              await api.delete(`/employee-attendance/settings/work-schedules/${schedule.id}`);
                                              showAlert('Xóa thành công', 'success', 'Thành công');
                                              fetchAttendanceSettings();
                                            } catch (error) {
                                              showAlert('Lỗi: ' + (error.response?.data?.message || error.message), 'danger', 'Lỗi');
                                            }
                                          }
                                        }}
                                      >
                                        <i className="fas fa-trash"></i>
                                      </Button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </Table>
                        </Card.Body>
                      </Card>
                    </Col>
                  </Row>
                </Tab.Pane>
              </Tab.Content>
            </Tab.Container>
          </div>

          {/* Add IP Whitelist Modal */}
          <Modal show={showWhitelistModal} onHide={() => setShowWhitelistModal(false)}>
            <Modal.Header closeButton>
              <Modal.Title>Thêm IP vào Whitelist</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>IP Address *</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="192.168.1.1"
                    value={newIP.ipAddress}
                    onChange={(e) => setNewIP({ ...newIP, ipAddress: e.target.value })}
                  />
                  <Form.Text className="text-muted">
                    Nhập địa chỉ IP hợp lệ (IPv4)
                  </Form.Text>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Mô tả</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Mô tả về IP này..."
                    value={newIP.description}
                    onChange={(e) => setNewIP({ ...newIP, description: e.target.value })}
                  />
                </Form.Group>
              </Form>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowWhitelistModal(false)}>
                Hủy
              </Button>
              <Button
                variant="primary"
                onClick={async () => {
                  try {
                    await api.post('/system/ip-whitelist', {
                      ipAddress: newIP.ipAddress,
                      description: newIP.description
                    });
                    alert('✅ Đã thêm IP vào whitelist');
                    setNewIP({ ipAddress: '', description: '' });
                    setShowWhitelistModal(false);
                    fetchIPWhitelist();
                  } catch (error) {
                    alert('❌ Lỗi: ' + (error.response?.data?.message || error.message));
                  }
                }}
              >
                Thêm
              </Button>
            </Modal.Footer>
          </Modal>

          {/* Security Setting Modal */}
          <Modal show={showSecurityModal} onHide={() => setShowSecurityModal(false)} size="lg">
            <Modal.Header closeButton>
              <Modal.Title>{editingSecurity ? 'Chỉnh sửa' : 'Thêm'} Hàng rào bảo mật</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>Loại hàng rào *</Form.Label>
                  <Form.Select
                    value={securityForm.setting_type}
                    onChange={(e) => {
                      setSecurityForm({ ...securityForm, setting_type: e.target.value, setting_data: [] });
                      // Reset location form when changing type
                      if (e.target.value !== 'location_restriction') {
                        setNewLocation({
                          name: '',
                          latitude: '',
                          longitude: '',
                          radius: 100,
                          coordinatesInput: ''
                        });
                        setSelectedLocationForMap(null);
                      }
                    }}
                  >
                    <option value="ip_restriction">Giới hạn IP</option>
                    <option value="location_restriction">Giới hạn Vị trí</option>
                    <option value="device_restriction">Giới hạn Thiết bị</option>
                  </Form.Select>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Phạm vi áp dụng *</Form.Label>
                  <Form.Select
                    value={securityForm.scope_type}
                    onChange={(e) => setSecurityForm({ ...securityForm, scope_type: e.target.value, scope_value: '' })}
                  >
                    <option value="all_employees">Tất cả nhân viên</option>
                    <option value="role">Vai trò</option>
                    <option value="department">Phòng ban</option>
                    <option value="user">Người dùng</option>
                  </Form.Select>
                </Form.Group>
                {securityForm.scope_type !== 'all_employees' && (
                  <Form.Group className="mb-3">
                    <Form.Label>Giá trị phạm vi *</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder={securityForm.scope_type === 'role' ? 'admin, staff, ...' : securityForm.scope_type === 'department' ? 'Tên phòng ban' : 'User ID'}
                      value={securityForm.scope_value}
                      onChange={(e) => setSecurityForm({ ...securityForm, scope_value: e.target.value })}
                    />
                  </Form.Group>
                )}
                <Form.Group className="mb-3">
                  <Form.Label>
                    {securityForm.setting_type === 'ip_restriction' && 'Danh sách IP (mỗi IP một dòng)'}
                    {securityForm.setting_type === 'location_restriction' && 'Danh sách vị trí (JSON)'}
                    {securityForm.setting_type === 'device_restriction' && 'Danh sách thiết bị'}
                  </Form.Label>
                  {securityForm.setting_type === 'ip_restriction' && (
                    <Form.Control
                      as="textarea"
                      rows={5}
                      placeholder="192.168.1.1&#10;192.168.1.0/24&#10;10.0.0.1"
                      value={Array.isArray(securityForm.setting_data) ? securityForm.setting_data.join('\n') : ''}
                      onChange={(e) => {
                        const ips = e.target.value.split('\n').filter(ip => ip.trim());
                        setSecurityForm({ ...securityForm, setting_data: ips });
                      }}
                    />
                  )}
                  {securityForm.setting_type === 'location_restriction' && (
                    <div>
                      {/* Form to add new location */}
                      <Card className="mb-3" style={{ border: '1px solid #dee2e6' }}>
                        <Card.Header className="bg-light">
                          <h6 className="mb-0">Thêm địa điểm mới</h6>
                        </Card.Header>
                        <Card.Body>
                          <Row>
                            <Col md={6}>
                              <Form.Group className="mb-3">
                                <Form.Label>Tên địa điểm (tùy chọn)</Form.Label>
                                <Form.Control
                                  type="text"
                                  placeholder="Ví dụ: Văn phòng chính"
                                  value={newLocation.name}
                                  onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                                />
                              </Form.Group>
                            </Col>
                            <Col md={6}>
                              <Form.Group className="mb-3">
                                <Form.Label>Bán kính (mét) *</Form.Label>
                                <Form.Control
                                  type="number"
                                  min="10"
                                  max="1000"
                                  value={newLocation.radius}
                                  onChange={(e) => {
                                    const radius = parseInt(e.target.value) || 100;
                                    setNewLocation({ ...newLocation, radius });
                                    if (newLocation.latitude && newLocation.longitude) {
                                      setSelectedLocationForMap({
                                        latitude: parseFloat(newLocation.latitude),
                                        longitude: parseFloat(newLocation.longitude),
                                        radius: radius
                                      });
                                    }
                                  }}
                                />
                                <Form.Text className="text-muted">Từ 10 đến 1000 mét</Form.Text>
                              </Form.Group>
                            </Col>
                          </Row>
                          <Row>
                            <Col md={6}>
                              <Form.Group className="mb-3">
                                <Form.Label>Vĩ độ (Latitude) *</Form.Label>
                                <Form.Control
                                  type="number"
                                  step="any"
                                  placeholder="10.762622"
                                  value={newLocation.latitude}
                                  onChange={(e) => {
                                    const lat = e.target.value;
                                    setNewLocation({ ...newLocation, latitude: lat });
                                    if (lat && newLocation.longitude) {
                                      setSelectedLocationForMap({
                                        latitude: parseFloat(lat),
                                        longitude: parseFloat(newLocation.longitude),
                                        radius: newLocation.radius
                                      });
                                    }
                                  }}
                                />
                              </Form.Group>
                            </Col>
                            <Col md={6}>
                              <Form.Group className="mb-3">
                                <Form.Label>Kinh độ (Longitude) *</Form.Label>
                                <Form.Control
                                  type="number"
                                  step="any"
                                  placeholder="106.660172"
                                  value={newLocation.longitude}
                                  onChange={(e) => {
                                    const lng = e.target.value;
                                    setNewLocation({ ...newLocation, longitude: lng });
                                    if (newLocation.latitude && lng) {
                                      setSelectedLocationForMap({
                                        latitude: parseFloat(newLocation.latitude),
                                        longitude: parseFloat(lng),
                                        radius: newLocation.radius
                                      });
                                    }
                                  }}
                                />
                              </Form.Group>
                            </Col>
                          </Row>
                          <Row>
                            <Col md={12}>
                              <Form.Group className="mb-3">
                                <Form.Label>Hoặc nhập tọa độ (Latitude, Longitude)</Form.Label>
                                <Form.Control
                                  type="text"
                                  placeholder="10.762622, 106.660172"
                                  value={newLocation.coordinatesInput}
                                  onChange={(e) => {
                                    const input = e.target.value;
                                    setNewLocation({ ...newLocation, coordinatesInput: input });
                                    const parts = input.replace(/\s+/g, '').split(',');
                                    if (parts.length === 2) {
                                      const lat = parseFloat(parts[0].trim());
                                      const lng = parseFloat(parts[1].trim());
                                      if (!isNaN(lat) && !isNaN(lng)) {
                                        setNewLocation(prev => ({
                                          ...prev,
                                          latitude: lat.toString(),
                                          longitude: lng.toString()
                                        }));
                                        setSelectedLocationForMap({
                                          latitude: lat,
                                          longitude: lng,
                                          radius: newLocation.radius
                                        });
                                      }
                                    }
                                  }}
                                />
                              </Form.Group>
                            </Col>
                          </Row>
                          <Row>
                            <Col md={12}>
                              <Form.Group className="mb-3">
                                <Form.Label>Bản đồ xem trước</Form.Label>
                                <div style={{ height: '300px', width: '100%', border: '1px solid #dee2e6', borderRadius: '4px', overflow: 'hidden' }}>
                                  <MapPreview
                                    latitude={selectedLocationForMap?.latitude || (newLocation.latitude ? parseFloat(newLocation.latitude) : null)}
                                    longitude={selectedLocationForMap?.longitude || (newLocation.longitude ? parseFloat(newLocation.longitude) : null)}
                                    radius={selectedLocationForMap?.radius || newLocation.radius || 100}
                                  />
                                </div>
                              </Form.Group>
                            </Col>
                          </Row>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              if (!newLocation.latitude || !newLocation.longitude) {
                                showAlert('Vui lòng nhập đầy đủ tọa độ', 'danger', 'Lỗi');
                                return;
                              }
                              const lat = parseFloat(newLocation.latitude);
                              const lng = parseFloat(newLocation.longitude);
                              if (isNaN(lat) || isNaN(lng)) {
                                showAlert('Tọa độ không hợp lệ', 'danger', 'Lỗi');
                                return;
                              }
                              if (newLocation.radius < 10 || newLocation.radius > 1000) {
                                showAlert('Bán kính phải từ 10 đến 1000 mét', 'danger', 'Lỗi');
                                return;
                              }
                              
                              const currentLocations = Array.isArray(securityForm.setting_data) ? securityForm.setting_data : [];
                              const newLoc = {
                                latitude: lat,
                                longitude: lng,
                                radius: newLocation.radius,
                                name: newLocation.name || `Địa điểm ${currentLocations.length + 1}`
                              };
                              
                              setSecurityForm({
                                ...securityForm,
                                setting_data: [...currentLocations, newLoc]
                              });
                              
                              // Reset form
                              setNewLocation({
                                name: '',
                                latitude: '',
                                longitude: '',
                                radius: 100,
                                coordinatesInput: ''
                              });
                              setSelectedLocationForMap(null);
                              showAlert('Đã thêm địa điểm', 'success', 'Thành công');
                            }}
                          >
                            <i className="fas fa-plus me-1"></i>Thêm địa điểm
                          </Button>
                        </Card.Body>
                      </Card>
                      
                      {/* List of added locations */}
                      {Array.isArray(securityForm.setting_data) && securityForm.setting_data.length > 0 && (
                        <div className="mb-3">
                          <Form.Label>Danh sách địa điểm đã thêm ({securityForm.setting_data.length})</Form.Label>
                          <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '4px', padding: '10px' }}>
                            {securityForm.setting_data.map((loc, index) => (
                              <Card key={index} className="mb-2" style={{ border: '1px solid #dee2e6' }}>
                                <Card.Body className="p-2">
                                  <div className="d-flex justify-content-between align-items-start">
                                    <div className="flex-grow-1">
                                      <div className="fw-medium">{loc.name || `Địa điểm ${index + 1}`}</div>
                                      <div className="small text-muted">
                                        <div>Vĩ độ: {loc.latitude}, Kinh độ: {loc.longitude}</div>
                                        <div>Bán kính: {loc.radius}m</div>
                                      </div>
                                    </div>
                                    <Button
                                      variant="outline-danger"
                                      size="sm"
                                      onClick={() => {
                                        const updated = securityForm.setting_data.filter((_, i) => i !== index);
                                        setSecurityForm({ ...securityForm, setting_data: updated });
                                        showAlert('Đã xóa địa điểm', 'success', 'Thành công');
                                      }}
                                    >
                                      <i className="fas fa-trash"></i>
                                    </Button>
                                  </div>
                                </Card.Body>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {securityForm.setting_type === 'device_restriction' && (
                    <div>
                      {['pc', 'mobile', 'tablet'].map(device => (
                        <Form.Check
                          key={device}
                          type="checkbox"
                          label={device === 'pc' ? 'Máy tính' : device === 'mobile' ? 'Điện thoại' : 'Máy tính bảng'}
                          checked={Array.isArray(securityForm.setting_data) && securityForm.setting_data.includes(device)}
                          onChange={(e) => {
                            const current = Array.isArray(securityForm.setting_data) ? securityForm.setting_data : [];
                            if (e.target.checked) {
                              setSecurityForm({ ...securityForm, setting_data: [...current, device] });
                            } else {
                              setSecurityForm({ ...securityForm, setting_data: current.filter(d => d !== device) });
                            }
                          }}
                        />
                      ))}
                    </div>
                  )}
                </Form.Group>
                <Form.Check
                  type="switch"
                  label="Kích hoạt"
                  checked={securityForm.is_active}
                  onChange={(e) => setSecurityForm({ ...securityForm, is_active: e.target.checked })}
                />
              </Form>
            </Modal.Body>
            <Modal.Footer>
              <Button 
                variant="secondary" 
                onClick={() => {
                  setShowSecurityModal(false);
                  // Reset location form
                  setNewLocation({
                    name: '',
                    latitude: '',
                    longitude: '',
                    radius: 100,
                    coordinatesInput: ''
                  });
                  setSelectedLocationForMap(null);
                }}
              >
                Hủy
              </Button>
              <Button
                variant="primary"
                onClick={async () => {
                  try {
                    // Validate location restriction
                    if (securityForm.setting_type === 'location_restriction') {
                      if (!Array.isArray(securityForm.setting_data) || securityForm.setting_data.length === 0) {
                        showAlert('Vui lòng thêm ít nhất một địa điểm', 'danger', 'Lỗi');
                        return;
                      }
                      
                      // Validate each location
                      for (const loc of securityForm.setting_data) {
                        if (!loc.latitude || !loc.longitude) {
                          showAlert('Tất cả địa điểm phải có tọa độ hợp lệ', 'danger', 'Lỗi');
                          return;
                        }
                        if (!loc.radius || loc.radius < 10 || loc.radius > 1000) {
                          showAlert('Bán kính phải từ 10 đến 1000 mét', 'danger', 'Lỗi');
                          return;
                        }
                      }
                    }
                    
                    await api.post('/employee-attendance/settings/security', {
                      ...securityForm,
                      id: editingSecurity?.id
                    });
                    showAlert(editingSecurity ? 'Cập nhật thành công' : 'Tạo mới thành công', 'success', 'Thành công');
                    setShowSecurityModal(false);
                    // Reset location form
                    setNewLocation({
                      name: '',
                      latitude: '',
                      longitude: '',
                      radius: 100,
                      coordinatesInput: ''
                    });
                    setSelectedLocationForMap(null);
                    fetchAttendanceSettings();
                  } catch (error) {
                    showAlert('Lỗi: ' + (error.response?.data?.message || error.message), 'danger', 'Lỗi');
                  }
                }}
              >
                {editingSecurity ? 'Cập nhật' : 'Tạo mới'}
              </Button>
            </Modal.Footer>
          </Modal>

          {/* Work Schedule Modal */}
          <Modal show={showScheduleModal} onHide={() => setShowScheduleModal(false)}>
            <Modal.Header closeButton>
              <Modal.Title>{editingSchedule ? 'Chỉnh sửa' : 'Thêm'} Lịch làm việc</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>Phạm vi áp dụng *</Form.Label>
                  <Form.Select
                    value={scheduleForm.scope_type}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, scope_type: e.target.value, scope_value: [] })}
                  >
                    <option value="all_employees">Tất cả nhân viên</option>
                    <option value="role">Vai trò</option>
                    <option value="department">Phòng ban</option>
                    <option value="user">Người dùng</option>
                  </Form.Select>
                </Form.Group>
                {scheduleForm.scope_type !== 'all_employees' && (
                  <Form.Group className="mb-3">
                    <Form.Label>
                      {scheduleForm.scope_type === 'role' && 'Chọn vai trò *'}
                      {scheduleForm.scope_type === 'department' && 'Chọn phòng ban *'}
                      {scheduleForm.scope_type === 'user' && 'Chọn người dùng * (tối đa 10)'}
                    </Form.Label>
                    {loadingScopeData ? (
                      <div className="text-center p-3">
                        <Spinner animation="border" size="sm" />
                        <span className="ms-2">Đang tải dữ liệu...</span>
                      </div>
                    ) : (
                      <div style={{ 
                        maxHeight: scheduleForm.scope_type === 'user' ? '200px' : '150px', 
                        overflowY: 'auto',
                        border: '1px solid #dee2e6',
                        borderRadius: '0.375rem',
                        padding: '10px'
                      }}>
                        {scheduleForm.scope_type === 'role' && (
                          availableRoles.map((role) => {
                            const roleNames = {
                              'superadmin': 'Super Admin',
                              'admin': 'Admin',
                              'staff': 'Nhân viên'
                            };
                            const isChecked = Array.isArray(scheduleForm.scope_value) && scheduleForm.scope_value.includes(role);
                            return (
                              <Form.Check
                                key={role}
                                type="checkbox"
                                label={roleNames[role] || role}
                                checked={isChecked}
                                onChange={(e) => {
                                  const current = Array.isArray(scheduleForm.scope_value) ? scheduleForm.scope_value : [];
                                  if (e.target.checked) {
                                    setScheduleForm({ ...scheduleForm, scope_value: [...current, role] });
                                  } else {
                                    setScheduleForm({ ...scheduleForm, scope_value: current.filter(v => v !== role) });
                                  }
                                }}
                              />
                            );
                          })
                        )}
                        {scheduleForm.scope_type === 'department' && (
                          availableDepartments.length > 0 ? (
                            availableDepartments.map((dept) => {
                              const deptName = typeof dept === 'string' ? dept : dept.department || dept.name;
                              const isChecked = Array.isArray(scheduleForm.scope_value) && scheduleForm.scope_value.includes(deptName);
                              return (
                                <Form.Check
                                  key={deptName}
                                  type="checkbox"
                                  label={deptName}
                                  checked={isChecked}
                                  onChange={(e) => {
                                    const current = Array.isArray(scheduleForm.scope_value) ? scheduleForm.scope_value : [];
                                    if (e.target.checked) {
                                      setScheduleForm({ ...scheduleForm, scope_value: [...current, deptName] });
                                    } else {
                                      setScheduleForm({ ...scheduleForm, scope_value: current.filter(v => v !== deptName) });
                                    }
                                  }}
                                />
                              );
                            })
                          ) : (
                            <div className="text-muted small">Chưa có phòng ban nào</div>
                          )
                        )}
                        {scheduleForm.scope_type === 'user' && (
                          availableUsers.length > 0 ? (
                            availableUsers.slice(0, 10).map((user) => {
                              const userId = user.id.toString();
                              const userName = user.full_name || user.username || `User ${user.id}`;
                              const userRole = user.role || '';
                              const isChecked = Array.isArray(scheduleForm.scope_value) && scheduleForm.scope_value.includes(userId);
                              return (
                                <Form.Check
                                  key={userId}
                                  type="checkbox"
                                  label={`${userName} (${userRole})`}
                                  checked={isChecked}
                                  onChange={(e) => {
                                    const current = Array.isArray(scheduleForm.scope_value) ? scheduleForm.scope_value : [];
                                    if (e.target.checked) {
                                      if (current.length < 10) {
                                        setScheduleForm({ ...scheduleForm, scope_value: [...current, userId] });
                                      } else {
                                        showAlert('Chỉ có thể chọn tối đa 10 người dùng', 'warning', 'Cảnh báo');
                                      }
                                    } else {
                                      setScheduleForm({ ...scheduleForm, scope_value: current.filter(v => v !== userId) });
                                    }
                                  }}
                                />
                              );
                            })
                          ) : (
                            <div className="text-muted small">Chưa có người dùng nào</div>
                          )
                        )}
                      </div>
                    )}
                    {scheduleForm.scope_type === 'user' && Array.isArray(scheduleForm.scope_value) && scheduleForm.scope_value.length > 0 && (
                      <Form.Text className="text-muted">
                        Đã chọn: {scheduleForm.scope_value.length}/10
                      </Form.Text>
                    )}
                  </Form.Group>
                )}
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Giờ bắt đầu *</Form.Label>
                      <Form.Control
                        type="time"
                        value={scheduleForm.start_time}
                        onChange={(e) => setScheduleForm({ ...scheduleForm, start_time: e.target.value })}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Giờ kết thúc *</Form.Label>
                      <Form.Control
                        type="time"
                        value={scheduleForm.end_time}
                        onChange={(e) => setScheduleForm({ ...scheduleForm, end_time: e.target.value })}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Form.Group className="mb-3">
                  <Form.Label>Số giờ làm việc yêu cầu *</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.5"
                    min="0"
                    max="24"
                    value={scheduleForm.required_hours}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, required_hours: parseFloat(e.target.value) })}
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Ngày làm việc *</Form.Label>
                  <div>
                    {['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'].map((day, index) => (
                      <Form.Check
                        key={index}
                        type="checkbox"
                        label={day}
                        checked={Array.isArray(scheduleForm.work_days) && scheduleForm.work_days.includes(index)}
                        onChange={(e) => {
                          const current = Array.isArray(scheduleForm.work_days) ? scheduleForm.work_days : [];
                          if (e.target.checked) {
                            setScheduleForm({ ...scheduleForm, work_days: [...current, index].sort() });
                          } else {
                            setScheduleForm({ ...scheduleForm, work_days: current.filter(d => d !== index) });
                          }
                        }}
                      />
                    ))}
                  </div>
                </Form.Group>
                <Form.Check
                  type="switch"
                  label="Kích hoạt"
                  checked={scheduleForm.is_active}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, is_active: e.target.checked })}
                />
              </Form>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowScheduleModal(false)}>
                Hủy
              </Button>
              <Button
                variant="primary"
                onClick={async () => {
                  try {
                    // Validate scope_value
                    if (scheduleForm.scope_type !== 'all_employees') {
                      if (!Array.isArray(scheduleForm.scope_value) || scheduleForm.scope_value.length === 0) {
                        showAlert('Vui lòng chọn ít nhất một giá trị cho phạm vi áp dụng', 'danger', 'Lỗi');
                        return;
                      }
                    }
                    
                    // Convert scope_value array to comma-separated string for backend
                    const payload = {
                      ...scheduleForm,
                      scope_value: scheduleForm.scope_type === 'all_employees' 
                        ? null 
                        : Array.isArray(scheduleForm.scope_value) 
                          ? scheduleForm.scope_value.join(',') 
                          : scheduleForm.scope_value,
                      id: editingSchedule?.id
                    };
                    
                    await api.post('/employee-attendance/settings/work-schedules', payload);
                    showAlert(editingSchedule ? 'Cập nhật thành công' : 'Tạo mới thành công', 'success', 'Thành công');
                    setShowScheduleModal(false);
                    fetchAttendanceSettings();
                  } catch (error) {
                    showAlert('Lỗi: ' + (error.response?.data?.message || error.message), 'danger', 'Lỗi');
                  }
                }}
              >
                {editingSchedule ? 'Cập nhật' : 'Tạo mới'}
              </Button>
            </Modal.Footer>
          </Modal>

          {/* reCAPTCHA Settings Modal */}
          <Modal show={showRecaptchaModal} onHide={() => setShowRecaptchaModal(false)} size="lg">
            <Modal.Header closeButton>
              <Modal.Title>Cấu hình reCAPTCHA cho Chấm công</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form>
                <Form.Check
                  type="switch"
                  label="Kích hoạt reCAPTCHA"
                  checked={recaptchaSettings.enableCaptcha}
                  onChange={(e) => setRecaptchaSettings({ ...recaptchaSettings, enableCaptcha: e.target.checked })}
                  className="mb-3"
                />
                
                    {recaptchaSettings.enableCaptcha && (
                  <>
                    <Form.Group className="mb-3">
                      <Form.Label>Loại CAPTCHA</Form.Label>
                      <Form.Select
                        value={recaptchaSettings.captchaType}
                        onChange={(e) => setRecaptchaSettings({ ...recaptchaSettings, captchaType: e.target.value })}
                      >
                        <option value="simple">CAPTCHA đơn giản (Phép tính)</option>
                        <option value="recaptcha">Google reCAPTCHA v2</option>
                      </Form.Select>
                      <Form.Text className="text-muted">
                        {recaptchaSettings.captchaType === 'simple' 
                          ? 'Sử dụng phép tính đơn giản (ví dụ: 5 + 3 = ?)'
                          : 'Sử dụng Google reCAPTCHA v2 Checkbox'}
                      </Form.Text>
                    </Form.Group>
                    
                    {recaptchaSettings.captchaType === 'recaptcha' && (
                      <>
                        <Form.Group className="mb-3">
                          <Form.Label>reCAPTCHA Site Key (Public) *</Form.Label>
                          <Form.Control
                            type="text"
                            placeholder="6Lf5C24rAAAAAHuXMdwF9xSCDCfXGXUTKFU6Ls9d"
                            value={recaptchaSettings.recaptchaSiteKey}
                            onChange={(e) => setRecaptchaSettings({ ...recaptchaSettings, recaptchaSiteKey: e.target.value })}
                          />
                          <Form.Text className="text-muted">
                            Site key được sử dụng ở client (công khai)
                          </Form.Text>
                        </Form.Group>
                        
                        <Form.Group className="mb-3">
                          <Form.Label>reCAPTCHA Secret Key (Private) *</Form.Label>
                          <Form.Control
                            type="password"
                            placeholder="6Lf5C24rAAAAAAfgHModvQqFkiAwhwV7JqmPXvTY"
                            value={recaptchaSettings.recaptchaSecretKey}
                            onChange={(e) => setRecaptchaSettings({ ...recaptchaSettings, recaptchaSecretKey: e.target.value })}
                          />
                          <Form.Text className="text-muted">
                            Secret key được sử dụng ở server (bảo mật) - Nên chuyển sang biến môi trường
                          </Form.Text>
                        </Form.Group>
                      </>
                    )}
                    
                    {recaptchaSettings.captchaType === 'simple' && (
                      <Alert variant="info" className="mb-3">
                        <i className="fas fa-info-circle me-2"></i>
                        <strong>CAPTCHA đơn giản:</strong> Sử dụng phép tính cộng, trừ, nhân đơn giản. Không cần cấu hình thêm.
                      </Alert>
                    )}
                    
                    <Alert variant="info" className="mb-3">
                      <i className="fas fa-info-circle me-2"></i>
                      <strong>Lưu ý:</strong> Khi bật CAPTCHA, người dùng sẽ phải hoàn thành challenge trước khi check-in/check-out.
                    </Alert>
                  </>
                )}
              </Form>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowRecaptchaModal(false)}>
                Hủy
              </Button>
              <Button
                variant="primary"
                onClick={async () => {
                  try {
                    // Get current security settings
                    const currentSettingsRes = await api.get('/system/security-settings');
                    const currentSettings = currentSettingsRes.data.success ? currentSettingsRes.data.data : {};
                    
                    // Update with attendance settings
                    const updatedSettings = {
                      ...currentSettings,
                      attendanceSettings: {
                        enableCaptcha: recaptchaSettings.enableCaptcha,
                        captchaType: recaptchaSettings.captchaType,
                        recaptchaSiteKey: recaptchaSettings.recaptchaSiteKey,
                        recaptchaSecretKey: recaptchaSettings.recaptchaSecretKey
                      }
                    };
                    
                    await api.put('/system/security-settings', updatedSettings);
                    showAlert('Cập nhật cài đặt reCAPTCHA thành công', 'success', 'Thành công');
                    setShowRecaptchaModal(false);
                    fetchAttendanceSettings();
                  } catch (error) {
                    showAlert('Lỗi: ' + (error.response?.data?.message || error.message), 'danger', 'Lỗi');
                  }
                }}
              >
                Lưu
              </Button>
            </Modal.Footer>
          </Modal>
      </Container>

    </>
  );
};

export default SystemPage;
