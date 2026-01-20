import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Container, Row, Col, Button, Form, Modal, Badge, Spinner, Alert, Table } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import Pagination from '../../components/Pagination';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Payroll = () => {
  usePageTitle('Quản lý lương');
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [payrolls, setPayrolls] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filters, setFilters] = useState({
    search: '',
    department: 'all',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
  });
  const [sortBy, setSortBy] = useState('full_name');
  const [sortOrder, setSortOrder] = useState('ASC');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    totalItems: 0,
    totalPages: 0
  });
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [profileDetail, setProfileDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showPayrollDetailModal, setShowPayrollDetailModal] = useState(false);
  const [selectedPayroll, setSelectedPayroll] = useState(null);
  const [payrollDetail, setPayrollDetail] = useState(null);
  const [loadingPayrollDetail, setLoadingPayrollDetail] = useState(false);
  const [deductionPercentages, setDeductionPercentages] = useState({
    social_insurance: null,
    union_fee: null
  });
  const [revealedSalaries, setRevealedSalaries] = useState(new Set());
  const [revealedColumns, setRevealedColumns] = useState({
    base_salary: false,
    contract_salary: false,
    gross_salary: false,
    net_salary: false
  });
  const [revealedRows, setRevealedRows] = useState(new Set());
  const lastUpdateTimestampRef = useRef(null);

  // Fetch payroll data
  const fetchPayrolls = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      setError('');

      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        search: filters.search,
        department: filters.department,
        month: filters.month,
        year: filters.year,
        sortBy: sortBy,
        sortOrder: sortOrder
      });

      const response = await api.get(`/payroll?${params}`);

      if (response.data.success) {
        if (response.data.data.length > 0) {
          setPayrolls(response.data.data);
          setPagination(response.data.pagination);
        } else {
          setPayrolls([]);
          setPagination({
            page: 1,
            limit: pagination.limit,
            totalItems: 0,
            totalPages: 0
          });
        }
      }
    } catch (err) {
      console.error('Error fetching payrolls:', err);
      if (!silent) {
        setError('Không thể tải danh sách lương');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [pagination.page, pagination.limit, filters.search, filters.department, filters.month, filters.year, sortBy, sortOrder]);

  // Check for updates and refresh if needed
  const checkForUpdates = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        month: filters.month,
        year: filters.year
      });

      const response = await api.get(`/payroll/last-update?${params}`);
      
      if (response.data.success) {
        const newTimestamp = response.data.data.lastUpdate;
        
        if (lastUpdateTimestampRef.current === null) {
          // First check, just store the timestamp
          lastUpdateTimestampRef.current = newTimestamp;
        } else if (newTimestamp > lastUpdateTimestampRef.current) {
          // Data has changed, refresh silently
          lastUpdateTimestampRef.current = newTimestamp;
          await fetchPayrolls(true); // Silent refresh
        }
      }
    } catch (err) {
      // Silently fail, don't show error for background checks
      console.error('Error checking for updates:', err);
    }
  }, [filters.month, filters.year, fetchPayrolls]);

  // Fetch departments
  const fetchDepartments = async () => {
    try {
      const response = await api.get('/hr-profiles/departments');
      if (response.data.success) {
        setDepartments(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching departments:', err);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchPayrolls();
      fetchDepartments();
      // Reset last update timestamp when filters change
      lastUpdateTimestampRef.current = null;
    }
  }, [currentUser, filters.search, filters.department, filters.month, filters.year, sortBy, sortOrder, pagination.page]);

  // Poll for updates - only when tab is visible and user is active
  useEffect(() => {
    if (!currentUser) return;

    let interval = null;
    let initialTimeout = null;
    let isPageVisible = true;

    // Check if page is visible
    const handleVisibilityChange = () => {
      isPageVisible = !document.hidden;
      if (isPageVisible) {
        // Page became visible, check immediately
        checkForUpdates();
        // Then continue polling
        if (interval) clearInterval(interval);
        interval = setInterval(() => {
          if (isPageVisible) {
            checkForUpdates();
          }
        }, 10000); // Check every 10 seconds (reduced frequency)
      } else {
        // Page is hidden, stop polling
        if (interval) {
          clearInterval(interval);
          interval = null;
        }
      }
    };

    // Listen to visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Initial check after 3 seconds (only if page is visible)
    initialTimeout = setTimeout(() => {
      if (isPageVisible) {
        checkForUpdates();
      }
    }, 3000);

    // Start polling every 10 seconds (reduced from 5 to reduce server load)
    interval = setInterval(() => {
      if (isPageVisible) {
        checkForUpdates();
      }
    }, 10000);

    return () => {
      if (initialTimeout) clearTimeout(initialTimeout);
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser, checkForUpdates]);

  // Handle filter change
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Handle sort change
  const handleSortChange = (e) => {
    const [field, order] = e.target.value.split('_');
    setSortBy(field);
    setSortOrder(order);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Clear filters
  const handleClearFilters = () => {
    setFilters({
      search: '',
      department: 'all',
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear()
    });
    setSortBy('full_name');
    setSortOrder('ASC');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // View profile detail
  const handleViewProfile = async (userId) => {
    try {
      setLoadingDetail(true);
      setError('');

      const response = await api.get(`/hr-profiles/staff/${userId}`);

      if (response.data.success) {
        setProfileDetail(response.data.data);
        setSelectedProfile(userId);
        setShowProfileModal(true);
      }
    } catch (err) {
      console.error('Error fetching profile detail:', err);
      setError('Không thể tải chi tiết hồ sơ');
    } finally {
      setLoadingDetail(false);
    }
  };

  // Navigate to personal profile
  const handleNavigateToProfile = (userId) => {
    navigate(`/personal/profile?userId=${userId}`);
  };

  // Navigate to HR profiles
  const handleNavigateToHRProfiles = () => {
    navigate('/hr/profiles');
  };

  // View payroll detail
  const handleViewPayrollDetail = async (payrollId, payrollData = null) => {
    try {
      setLoadingPayrollDetail(true);
      setError('');

      let response;
      
      // If payrollId is null/undefined, it means this is a calculated payroll (not saved in DB)
      // Use the user/period endpoint instead
      if (!payrollId && payrollData) {
        response = await api.get(`/payroll/user/${payrollData.user_id}/period/${payrollData.year}/${payrollData.month}`);
      } else if (!payrollId) {
        setError('Không thể tải chi tiết lương: Thiếu thông tin');
        return;
      } else {
        response = await api.get(`/payroll/${payrollId}`);
      }

      if (response.data.success) {
        const payroll = response.data.data;
        setPayrollDetail(payroll);
        setSelectedPayroll(payrollId || `${payroll.user_id}-${payroll.year}-${payroll.month}`);
        
        // Fetch deduction percentages from settings
        try {
          const settingsResponse = await api.get('/payroll-settings?item_type=deduction&is_active=true');
          if (settingsResponse.data.success) {
            const settings = settingsResponse.data.data;
            const payrollMonth = payroll.month;
            const payrollYear = payroll.year;
            
            // Filter settings by period (all, month, year)
            const filterByPeriod = (setting) => {
              if (setting.period_type === 'all') return true;
              if (setting.period_type === 'month' && setting.period_value === payrollMonth) return true;
              if (setting.period_type === 'year' && setting.period_value === payrollYear) return true;
              return false;
            };
            
            // Find social_insurance setting (prioritize: user > department > all)
            const socialInsuranceSettings = settings.filter(s => 
              s.item_name === 'social_insurance' && 
              s.amount_type === 'percentage' &&
              filterByPeriod(s)
            );
            
            // Find union_fee setting
            const unionFeeSettings = settings.filter(s => 
              s.item_name === 'union_fee' && 
              s.amount_type === 'percentage' &&
              filterByPeriod(s)
            );
            
            // Get the most specific setting (user > department > all)
            const getMostSpecificSetting = (settingsList, userId, department) => {
              if (!settingsList || settingsList.length === 0) return null;
              
              // Priority: user > department > all
              const userSetting = settingsList.find(s => 
                s.scope_type === 'user' && s.scope_value === userId?.toString()
              );
              if (userSetting) return userSetting;
              
              const deptSetting = settingsList.find(s => 
                s.scope_type === 'department' && s.scope_value === department
              );
              if (deptSetting) return deptSetting;
              
              const allSetting = settingsList.find(s => s.scope_type === 'all');
              return allSetting || settingsList[0];
            };
            
            const socialInsuranceSetting = getMostSpecificSetting(
              socialInsuranceSettings, 
              payroll.user_id, 
              payroll.department
            );
            
            const unionFeeSetting = getMostSpecificSetting(
              unionFeeSettings, 
              payroll.user_id, 
              payroll.department
            );
            
            setDeductionPercentages({
              social_insurance: socialInsuranceSetting ? parseFloat(socialInsuranceSetting.amount) : null,
              union_fee: unionFeeSetting ? parseFloat(unionFeeSetting.amount) : null
            });
          }
        } catch (settingsErr) {
          console.error('Error fetching deduction percentages:', settingsErr);
          // If settings fetch fails, set to null to use fallback
          setDeductionPercentages({
            social_insurance: null,
            union_fee: null
          });
        }
        
        setShowPayrollDetailModal(true);
      }
    } catch (err) {
      console.error('Error fetching payroll detail:', err);
      setError('Không thể tải chi tiết lương');
    } finally {
      setLoadingPayrollDetail(false);
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    if (!amount) return '0';
    return parseFloat(amount).toLocaleString('vi-VN');
  };

  // Toggle row visibility (all salary cells in a row)
  const toggleRowVisibility = (payrollId, e) => {
    e.stopPropagation(); // Prevent row click
    setRevealedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(payrollId)) {
        newSet.delete(payrollId);
      } else {
        newSet.add(payrollId);
      }
      return newSet;
    });
  };

  // Toggle column visibility (all cells in a column)
  const toggleColumnVisibility = (salaryType, e) => {
    e.stopPropagation(); // Prevent row click
    setRevealedColumns(prev => ({
      ...prev,
      [salaryType]: !prev[salaryType]
    }));
  };

  // Toggle salary visibility (individual cell)
  const toggleSalaryVisibility = (payrollId, salaryType, e) => {
    e.stopPropagation(); // Prevent row click
    const key = `${payrollId}-${salaryType}`;
    setRevealedSalaries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  // Check if salary is revealed (priority: row > column > individual cell)
  const isSalaryRevealed = (payrollId, salaryType) => {
    // If row is revealed, all salary cells in that row are revealed (highest priority)
    if (revealedRows.has(payrollId)) {
      return true;
    }
    // If column is revealed, all cells in that column are revealed
    if (revealedColumns[salaryType]) {
      return true;
    }
    // Otherwise check individual cell
    const key = `${payrollId}-${salaryType}`;
    return revealedSalaries.has(key);
  };

  // Check if row is revealed
  const isRowRevealed = (payrollId) => {
    return revealedRows.has(payrollId);
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('vi-VN');
  };

  // Format tenure (thời gian làm việc)
  const formatTenure = (tenureMonths) => {
    if (!tenureMonths && tenureMonths !== 0) return 'N/A';
    const years = Math.floor(tenureMonths / 12);
    const months = tenureMonths % 12;
    if (years > 0 && months > 0) {
      return `${years} năm ${months} tháng`;
    } else if (years > 0) {
      return `${years} năm`;
    } else {
      return `${months} tháng`;
    }
  };

  // Get employment status label
  const getEmploymentStatusLabel = (status) => {
    switch (status) {
      case 'active': return 'Đang làm việc';
      case 'probation': return 'Thử việc';
      case 'on_leave': return 'Nghỉ phép';
      case 'terminated': return 'Đã nghỉ việc';
      case 'retired': return 'Đã nghỉ hưu';
      default: return status || 'active';
    }
  };

  // Get employment status color
  const getEmploymentStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'probation': return 'warning';
      case 'on_leave': return 'info';
      case 'terminated': return 'danger';
      case 'retired': return 'secondary';
      default: return 'secondary';
    }
  };

  // Get contract type label
  const getContractTypeLabel = (type) => {
    switch (type) {
      case 'full_time': return 'Toàn thời gian';
      case 'part_time': return 'Bán thời gian';
      case 'contract': return 'Hợp đồng';
      case 'temporary': return 'Tạm thời';
      default: return type || 'N/A';
    }
  };

  return (
    <Container fluid className="session-main-container">
      {error && (
        <Alert variant="danger" className="mb-3" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" className="mb-3" dismissible onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Header */}
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Lương & phúc lợi</h1>
          </div>
          <div className="header-actions">
            <Button variant="outline-light" className="create-session-btn me-2" onClick={() => navigate('/hr/payroll-settings')}>
              <i className="fas fa-cog me-2"></i>
              Cài đặt lương
            </Button>
            <Button variant="outline-light" className="create-session-btn" onClick={handleNavigateToHRProfiles}>
              <i className="fas fa-users me-2"></i>
              Quản lý hồ sơ
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="session1-list-controls mb-4">
        <div className="search1-controls">
          <Row className="g-2">
            <Col md={3}>
              <div className="mb-3">
                <Form.Label>Tìm kiếm</Form.Label>
                <input
                  type="text"
                  className="search-input"
                  placeholder="Tìm theo tên, mã NV, email..."
                  name="search"
                  value={filters.search}
                  onChange={handleFilterChange}
                />
              </div>
            </Col>
            <Col md={2}>
              <div className="mb-3">
                <Form.Label>Khoa/Phòng ban</Form.Label>
                <select
                  className="filter-select"
                  name="department"
                  value={filters.department}
                  onChange={handleFilterChange}
                >
                  <option value="all">Tất cả</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
            </Col>
            <Col md={2}>
              <div className="mb-3">
                <Form.Label>Tháng</Form.Label>
                <select
                  className="filter-select"
                  name="month"
                  value={filters.month}
                  onChange={handleFilterChange}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>Tháng {m}</option>
                  ))}
                </select>
              </div>
            </Col>
            <Col md={2}>
              <div className="mb-3">
                <Form.Label>Năm</Form.Label>
                <select
                  className="filter-select"
                  name="year"
                  value={filters.year}
                  onChange={handleFilterChange}
                >
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </Col>
            <Col md={2}>
              <div className="mb-3">
                <Form.Label>Sắp xếp</Form.Label>
                <select
                  className="filter-select"
                  value={`${sortBy}_${sortOrder}`}
                  onChange={handleSortChange}
                >
                  <option value="full_name_ASC">Họ tên (A-Z)</option>
                  <option value="full_name_DESC">Họ tên (Z-A)</option>
                  <option value="employee_code_ASC">Mã NV (Tăng dần)</option>
                  <option value="employee_code_DESC">Mã NV (Giảm dần)</option>
                  <option value="net_salary_DESC">Lương (Cao-Thấp)</option>
                  <option value="net_salary_ASC">Lương (Thấp-Cao)</option>
                </select>
              </div>
            </Col>
            <Col md={1}>
              <div className="d-flex justify-content-end align-items-center mb-3">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={handleClearFilters}
                >
                  <i className="fas fa-times me-1"></i>
                  Xóa bộ lọc
                </Button>
              </div>
            </Col>
          </Row>
        </div>
      </div>

      {/* Payroll Table */}
      <div className="session-table-container">
        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" />
            <p className="mt-3">Đang tải danh sách lương...</p>
          </div>
        ) : payrolls.length === 0 ? (
          <div className="text-center py-5">
            <i className="fas fa-money-bill-wave fa-4x text-muted mb-3"></i>
            <h5>Chưa có dữ liệu lương nào</h5>
            <p className="text-muted">Không tìm thấy dữ liệu lương phù hợp với bộ lọc</p>
          </div>
        ) : (
          <>
            <div className="table-responsive-mobile">
              <table className="session-table">
                <thead>
                  <tr>
                    <th>Mã NV</th>
                    <th>Họ và tên</th>
                    <th>Khoa/Phòng ban</th>
                    <th>Thời gian làm việc</th>
                    <th>
                      Lương cơ bản
                      <i 
                        className={`fas fa-eye salary-column-toggle ${revealedColumns.base_salary ? 'active' : ''}`}
                        onClick={(e) => toggleColumnVisibility('base_salary', e)}
                        title={revealedColumns.base_salary ? 'Ẩn toàn bộ lương trong cột' : 'Hiển thị toàn bộ lương trong cột'}
                      ></i>
                    </th>
                    <th>
                      Lương thỏa thuận (HĐ)
                      <i 
                        className={`fas fa-eye salary-column-toggle ${revealedColumns.contract_salary ? 'active' : ''}`}
                        onClick={(e) => toggleColumnVisibility('contract_salary', e)}
                        title={revealedColumns.contract_salary ? 'Ẩn toàn bộ lương trong cột' : 'Hiển thị toàn bộ lương trong cột'}
                      ></i>
                    </th>
                    <th>
                      Lương thực tế
                      <i 
                        className={`fas fa-eye salary-column-toggle ${revealedColumns.gross_salary ? 'active' : ''}`}
                        onClick={(e) => toggleColumnVisibility('gross_salary', e)}
                        title={revealedColumns.gross_salary ? 'Ẩn toàn bộ lương trong cột' : 'Hiển thị toàn bộ lương trong cột'}
                      ></i>
                    </th>
                    <th>
                      Thực lĩnh
                      <i 
                        className={`fas fa-eye salary-column-toggle ${revealedColumns.net_salary ? 'active' : ''}`}
                        onClick={(e) => toggleColumnVisibility('net_salary', e)}
                        title={revealedColumns.net_salary ? 'Ẩn toàn bộ lương trong cột' : 'Hiển thị toàn bộ lương trong cột'}
                      ></i>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {payrolls.map(payroll => {
                    const payrollId = payroll.id || `${payroll.user_id}-${payroll.year}-${payroll.month}`;
                    return (
                      <tr 
                        key={payrollId}
                        onClick={() => handleViewPayrollDetail(payroll.id, payroll)}
                        style={{ cursor: 'pointer' }}
                        className="table-row-clickable"
                      >
                        <td>{payroll.employee_code}</td>
                        <td>
                          <span className="text-primary">
                            {payroll.full_name}
                          </span>
                          <i 
                            className={`fas fa-eye salary-row-toggle ${isRowRevealed(payrollId) ? 'active' : ''}`}
                            onClick={(e) => toggleRowVisibility(payrollId, e)}
                            title={isRowRevealed(payrollId) ? 'Ẩn toàn bộ lương trong hàng' : 'Hiển thị toàn bộ lương trong hàng'}
                          ></i>
                        </td>
                        <td>{payroll.department}</td>
                        <td>{formatTenure(payroll.employee_tenure_months)}</td>
                        <td>
                          <span 
                            className={`salary-cell ${isSalaryRevealed(payrollId, 'base_salary') ? 'revealed' : 'blurred'}`}
                            onClick={(e) => toggleSalaryVisibility(payrollId, 'base_salary', e)}
                          >
                            {formatCurrency(payroll.base_salary || 0)} VNĐ
                          </span>
                        </td>
                        <td>
                          <span 
                            className={`salary-cell ${isSalaryRevealed(payrollId, 'contract_salary') ? 'revealed' : 'blurred'}`}
                            onClick={(e) => toggleSalaryVisibility(payrollId, 'contract_salary', e)}
                          >
                            {formatCurrency(payroll.contract_salary_base || payroll.contract_salary || 0)} VNĐ
                          </span>
                        </td>
                        <td>
                          <span 
                            className={`salary-cell ${isSalaryRevealed(payrollId, 'gross_salary') ? 'revealed' : 'blurred'}`}
                            onClick={(e) => toggleSalaryVisibility(payrollId, 'gross_salary', e)}
                          >
                            {formatCurrency(payroll.gross_salary || 0)} VNĐ
                          </span>
                        </td>
                        <td>
                          <span 
                            className={`salary-cell fw-bold text-success ${isSalaryRevealed(payrollId, 'net_salary') ? 'revealed' : 'blurred'}`}
                            onClick={(e) => toggleSalaryVisibility(payrollId, 'net_salary', e)}
                          >
                            {formatCurrency(payroll.net_salary || 0)} VNĐ
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="mt-3" style={{ padding: '20px' }}>
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  onPageChange={(page) => setPagination(prev => ({ ...prev, page }))}
                  maxVisiblePages={5}
                  showFirstLast={true}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Profile Detail Modal */}
      <Modal show={showProfileModal} onHide={() => setShowProfileModal(false)} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>Chi tiết hồ sơ nhân sự</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadingDetail ? (
            <div className="text-center py-5">
              <Spinner animation="border" />
              <p className="mt-3">Đang tải thông tin...</p>
            </div>
          ) : profileDetail ? (
            <div>
              <Row className="g-3 mb-4">
                <Col md={6}>
                  <div className="session-card">
                    <div className="card-header-modern">
                      <div className="header-icon">
                        <i className="fas fa-user"></i>
                      </div>
                      <h6 className="mb-0">Thông tin cơ bản</h6>
                    </div>
                    <div className="card-body-modern">
                      <div className="info-item-inline">
                        <div className="info-label">Họ và tên:</div>
                        <div className="info-value">{profileDetail.user?.full_name || 'N/A'}</div>
                      </div>
                      <div className="info-item-inline">
                        <div className="info-label">Email:</div>
                        <div className="info-value">{profileDetail.user?.email || 'N/A'}</div>
                      </div>
                      <div className="info-item-inline">
                        <div className="info-label">Điện thoại:</div>
                        <div className="info-value">{profileDetail.user?.phone || 'N/A'}</div>
                      </div>
                      <div className="info-item-inline">
                        <div className="info-label">Mã nhân viên:</div>
                        <div className="info-value">{profileDetail.profile?.employee_code || 'N/A'}</div>
                      </div>
                      <div className="info-item-inline">
                        <div className="info-label">Chức danh:</div>
                        <div className="info-value">{profileDetail.profile?.position || 'N/A'}</div>
                      </div>
                      <div className="info-item-inline">
                        <div className="info-label">Khoa/Phòng ban:</div>
                        <div className="info-value">{profileDetail.profile?.department || 'N/A'}</div>
                      </div>
                    </div>
                  </div>
                </Col>
                <Col md={6}>
                  <div className="session-card">
                    <div className="card-header-modern">
                      <div className="header-icon">
                        <i className="fas fa-money-bill-wave"></i>
                      </div>
                      <h6 className="mb-0">Thông tin lương</h6>
                    </div>
                    <div className="card-body-modern">
                      <div className="info-item-inline">
                        <div className="info-label">Lương thỏa thuận (HĐ):</div>
                        <div className="info-value">{profileDetail.profile?.salary ? formatCurrency(profileDetail.profile.salary) + ' VNĐ' : 'N/A'}</div>
                      </div>
                      <div className="info-item-inline">
                        <div className="info-label">Trạng thái:</div>
                        <div className="info-value">
                          <Badge bg={getEmploymentStatusColor(profileDetail.profile?.employment_status || 'active')}>
                            {getEmploymentStatusLabel(profileDetail.profile?.employment_status || 'active')}
                          </Badge>
                        </div>
                      </div>
                      <div className="info-item-inline">
                        <div className="info-label">Loại hợp đồng:</div>
                        <div className="info-value">{profileDetail.profile?.contract_type ? getContractTypeLabel(profileDetail.profile.contract_type) : 'N/A'}</div>
                      </div>
                      <div className="info-item-inline">
                        <div className="info-label">Ngày bắt đầu làm việc:</div>
                        <div className="info-value">{profileDetail.profile?.start_date ? formatDate(profileDetail.profile.start_date) : 'N/A'}</div>
                      </div>
                      <div className="info-item-inline">
                        <div className="info-label">Kinh nghiệm:</div>
                        <div className="info-value">{profileDetail.profile?.work_experience ? `${profileDetail.profile.work_experience} năm` : 'N/A'}</div>
                      </div>
                    </div>
                  </div>
                </Col>
              </Row>

              {/* Contracts */}
              {profileDetail.contracts && profileDetail.contracts.length > 0 && (
                <div className="session-card mb-3">
                  <div className="card-header-modern">
                    <div className="header-icon">
                      <i className="fas fa-file-contract"></i>
                    </div>
                    <h6 className="mb-0">Hợp đồng lao động</h6>
                  </div>
                  <div className="card-body-modern">
                    <div className="row g-3">
                      {profileDetail.contracts.map(contract => (
                        <Col md={6} key={contract.id}>
                          <div className="border rounded p-3">
                            <h6>{contract.contract_number || 'Hợp đồng'}</h6>
                            <small className="text-muted">
                              {getContractTypeLabel(contract.contract_type)} - {formatDate(contract.start_date)}
                              {contract.end_date && ` đến ${formatDate(contract.end_date)}`}
                            </small>
                            {contract.salary && (
                              <div className="mt-2">
                                <strong>Lương: {formatCurrency(contract.salary)} VNĐ</strong>
                              </div>
                            )}
                          </div>
                        </Col>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-5">
              <p className="text-muted">Không tìm thấy thông tin hồ sơ</p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowProfileModal(false)}>
            Đóng
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Payroll Detail Modal */}
      <Modal show={showPayrollDetailModal} onHide={() => {
        setShowPayrollDetailModal(false);
        setDeductionPercentages({
          social_insurance: null,
          union_fee: null
        });
      }} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="fas fa-file-invoice-dollar me-2"></i>
            Phiếu lương chi tiết
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadingPayrollDetail ? (
            <div className="text-center py-5">
              <Spinner animation="border" />
              <p className="mt-3">Đang tải chi tiết lương...</p>
            </div>
          ) : payrollDetail ? (
            <div>
              {/* Header Information */}
              <div className="session-card mb-3">
                <div className="card-header-modern">
                  <div className="header-icon">
                    <i className="fas fa-user"></i>
                  </div>
                  <h6 className="mb-0">Thông tin nhân viên</h6>
                </div>
                <div className="card-body-modern">
                  <Row>
                    <Col md={6}>
                      <div className="info-item-inline">
                        <div className="info-label">Họ và tên</div>
                        <div className="info-value">{payrollDetail.full_name || 'N/A'}</div>
                      </div>
                      <div className="info-item-inline">
                        <div className="info-label">Mã nhân viên</div>
                        <div className="info-value">{payrollDetail.employee_code || 'N/A'}</div>
                      </div>
                      <div className="info-item-inline">
                        <div className="info-label">Khoa/Phòng ban:</div>
                        <div className="info-value">{payrollDetail.department || 'N/A'}</div>
                      </div>
                    </Col>
                    <Col md={6}>
                      <div className="info-item-inline">
                        <div className="info-label">Chức danh:</div>
                        <div className="info-value">{payrollDetail.position || 'N/A'}</div>
                      </div>
                      <div className="info-item-inline">
                        <div className="info-label">Thời gian làm việc:</div>
                        <div className="info-value">{formatTenure(payrollDetail.employee_tenure_months)}</div>
                      </div>
                      <div className="info-item-inline">
                        <div className="info-label">Kỳ lương:</div>
                        <div className="info-value fw-bold">{payrollDetail.payroll_period || 'N/A'}</div>
                      </div>
                    </Col>
                  </Row>
                </div>
              </div>

              {/* Working Days and Salary Information */}
              <Row className="g-3 mb-3">
                <Col md={6}>
                  {/* Working Days */}
                  <div className="session-card">
                    <div className="card-header-modern">
                      <div className="header-icon">
                        <i className="fas fa-calendar-alt"></i>
                      </div>
                      <h6 className="mb-0">Ngày công</h6>
                    </div>
                    <div className="card-body-modern">
                      <Row>
                        <Col md={12}>
                          <div className="info-item-inline">
                            <div className="info-label">Ngày làm việc thực tế chính thức:</div>
                            <div className="info-value fw-bold">{payrollDetail.actual_working_days || 0}</div>
                          </div>
                        </Col>
                        <Col md={12}>
                          <div className="info-item-inline">
                            <div className="info-label">Ngày làm việc thực tế thử việc:</div>
                            <div className="info-value fw-bold">{payrollDetail.probation_working_days || 0}</div>
                          </div>
                        </Col>
                        <Col md={12}>
                          <div className="info-item-inline">
                            <div className="info-label">Ngày công chuẩn:</div>
                            <div className="info-value fw-bold">{payrollDetail.standard_working_days || 26}</div>
                          </div>
                        </Col>
                      </Row>
                    </div>
                  </div>
                </Col>
                <Col md={6}>
                  {/* Salary Information */}
                  <div className="session-card">
                    <div className="card-header-modern">
                      <div className="header-icon">
                        <i className="fas fa-money-bill-wave"></i>
                      </div>
                      <h6 className="mb-0">Thông tin lương</h6>
                    </div>
                    <div className="card-body-modern">
                      <Row>
                        <Col md={12}>
                          <div className="info-item-inline">
                            <div className="info-label">Lương cơ bản:</div>
                            <div className="info-value fw-bold text-primary">{formatCurrency(payrollDetail.base_salary || 0)} VNĐ</div>
                          </div>
                        </Col>
                        <Col md={12}>
                          <div className="info-item-inline">
                            <div className="info-label">Lương thỏa thuận (HĐ):</div>
                            <div className="info-value fw-bold text-primary">{formatCurrency(payrollDetail.contract_salary || 0)} VNĐ</div>
                          </div>
                        </Col>
                        <Col md={12}>
                          <div className="info-item-inline">
                            <div className="info-label">Lương thực tế:</div>
                            <div className="info-value fw-bold text-primary">{formatCurrency(payrollDetail.gross_salary || 0)} VNĐ</div>
                          </div>
                        </Col>
                        <Col md={12}>
                          <div className="info-item-inline">
                            <div className="info-label">Số người phụ thuộc:</div>
                            <div className="info-value">{payrollDetail.dependents || 0}</div>
                          </div>
                        </Col>
                      </Row>
                    </div>
                  </div>
                </Col>
              </Row>

              {/* Earnings and Deductions */}
              <Row className="g-3 mb-3">
                <Col md={6}>
                  {/* Earnings */}
                  <div className="session-card">
                    <div className="card-header-modern">
                      <div className="header-icon">
                        <i className="fas fa-arrow-up"></i>
                      </div>
                      <h6 className="mb-0">Các khoản thu:</h6>
                    </div>
                    <div className="card-body-modern">
                      <Table bordered className="mb-0" size="sm">
                        <thead>
                          <tr>
                            <th>Khoản thu</th>
                            <th className="text-end">VND</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>Lương & PC thực tế {payrollDetail.payroll_period || ''}:</td>
                            <td className="text-end">{formatCurrency(payrollDetail.gross_salary || 0)}</td>
                          </tr>
                          <tr>
                            <td>Lương & PC thực tế {payrollDetail.payroll_period ? (() => {
                              const [month, year] = payrollDetail.payroll_period.split('.');
                              let prevMonth = parseInt(month) - 1;
                              let prevYear = parseInt(year);
                              if (prevMonth === 0) {
                                prevMonth = 12;
                                prevYear -= 1;
                              }
                              return `${String(prevMonth).padStart(2, '0')}.${prevYear}`;
                            })() : ''}:</td>
                            <td className="text-end">{formatCurrency(payrollDetail.salary_from_previous_month || 0)}</td>
                          </tr>
                          <tr>
                            <td>Thưởng lễ:</td>
                            <td className="text-end">{formatCurrency(payrollDetail.holiday_bonus || 0)}</td>
                          </tr>
                          <tr>
                            <td>Tiền lương Bệnh nhân chuẩn:</td>
                            <td className="text-end">{formatCurrency(payrollDetail.patient_standard_salary || 0)}</td>
                          </tr>
                          <tr>
                            <td>Lương thỉnh giảng:</td>
                            <td className="text-end">{formatCurrency(payrollDetail.teaching_salary || 0)}</td>
                          </tr>
                          <tr>
                            <td>Truy lĩnh:</td>
                            <td className="text-end">{formatCurrency(payrollDetail.back_pay || 0)}</td>
                          </tr>
                          <tr>
                            <td>Đã nhận:</td>
                            <td className="text-end text-danger">-{formatCurrency(payrollDetail.received_advance || 0)}</td>
                          </tr>
                          <tr className="table-success fw-bold">
                            <td>Tổng Thu nhập</td>
                            <td className="text-end">{formatCurrency(payrollDetail.total_earnings || 0)}</td>
                          </tr>
                        </tbody>
                      </Table>
                    </div>
                  </div>
                </Col>
                <Col md={6}>
                  {/* Deductions */}
                  <div className="session-card">
                    <div className="card-header-modern">
                      <div className="header-icon">
                        <i className="fas fa-arrow-down"></i>
                      </div>
                      <h6 className="mb-0">Các khoản khấu trừ</h6>
                    </div>
                    <div className="card-body-modern">
                      <Table bordered className="mb-0" size="sm">
                        <thead>
                          <tr>
                            <th>Khoản khấu trừ</th>
                            <th className="text-end">VND</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>Thuế TNCN:</td>
                            <td className="text-end">{formatCurrency(payrollDetail.personal_income_tax || 0)}</td>
                          </tr>
                          <tr>
                            <td>
                              Trích nộp BHXH
                              {deductionPercentages.social_insurance !== null ? (
                                ` (${deductionPercentages.social_insurance}%)`
                              ) : (
                                ''
                              )}:
                            </td>
                            <td className="text-end">{formatCurrency(payrollDetail.social_insurance || 0)}</td>
                          </tr>
                          <tr>
                            <td>
                              Trích nộp công đoàn
                              {deductionPercentages.union_fee !== null ? (
                                ` (${deductionPercentages.union_fee}%)`
                              ) : (
                                ''
                              )}:
                            </td>
                            <td className="text-end">{formatCurrency(payrollDetail.union_fee || 0)}</td>
                          </tr>
                          <tr>
                            <td>Truy thu:</td>
                            <td className="text-end">{formatCurrency(payrollDetail.back_collection || 0)}</td>
                          </tr>
                          <tr className="table-danger fw-bold">
                            <td>Tổng khoản khấu trừ:</td>
                            <td className="text-end">{formatCurrency(payrollDetail.total_deductions || 0)}</td>
                          </tr>
                        </tbody>
                      </Table>
                    </div>
                  </div>
                </Col>
              </Row>

              {/* Net Salary */}
              <div className="session-card mb-3">
                <div className="card-header-modern bg-success text-white">
                  <div className="header-icon">
                    <i className="fas fa-hand-holding-usd"></i>
                  </div>
                  <h6 className="mb-0 text-grey">Lương thực lãnh</h6>
                </div>
                <div className="card-body-modern">
                  <div className="text-center">
                    <h2 className="text-success fw-bold mb-0">
                      {formatCurrency(payrollDetail.net_salary || 0)} VNĐ
                    </h2>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-5">
              <p className="text-muted">Không tìm thấy thông tin lương</p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowPayrollDetailModal(false)}>
            Đóng
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default Payroll;
