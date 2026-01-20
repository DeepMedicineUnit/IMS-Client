import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Button, Form, Modal, Badge, Spinner, Alert, Table, Tabs, Tab } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const PayrollSettings = () => {
  usePageTitle('Cài đặt lương');
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('payroll'); // 'payroll' or 'status-mapping'
  const [settings, setSettings] = useState([]);
  const [statusMappings, setStatusMappings] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({
    item_type: 'all',
    item_name: 'all',
    scope_type: 'all',
    is_active: 'all'
  });
  const [statusMappingFilters, setStatusMappingFilters] = useState({
    status_code: 'all',
    scope_type: 'all',
    is_active: 'all'
  });
  const [showModal, setShowModal] = useState(false);
  const [showStatusMappingModal, setShowStatusMappingModal] = useState(false);
  const [editingSetting, setEditingSetting] = useState(null);
  const [editingStatusMapping, setEditingStatusMapping] = useState(null);
  const [formData, setFormData] = useState({
    item_type: 'deduction',
    item_name: '',
    scope_type: 'all',
    scope_value: '',
    period_type: 'all',
    period_value: '',
    tenure_type: 'none',
    tenure_max_months: '',
    amount: '',
    amount_type: 'fixed',
    salary_type: 'base_salary',
    is_active: true,
    description: '',
    notes: ''
  });

  // Item name options
  const deductionItems = [
    { value: 'personal_income_tax', label: 'Thuế TNCN' },
    { value: 'social_insurance', label: 'Trích nộp BHXH' },
    { value: 'union_fee', label: 'Trích nộp công đoàn' },
    { value: 'back_collection', label: 'Truy thu' }
  ];

  const earningItems = [
    { value: 'holiday_bonus', label: 'Thưởng lễ' },
    { value: 'patient_standard_salary', label: 'Tiền lương Bệnh nhân chuẩn' },
    { value: 'teaching_salary', label: 'Lương thỉnh giảng' },
    { value: 'back_pay', label: 'Truy lĩnh' },
    { value: 'received_advance', label: 'Đã nhận' }
  ];

  // Vietnamese holidays
  const vietnameseHolidays = [
    { name: 'Tết Dương lịch (1/1)', month: 1, day: 1 },
    { name: 'Giỗ Tổ Hùng Vương (10/3)', month: 3, day: 10 },
    { name: 'Ngày Giải phóng miền Nam (30/4)', month: 4, day: 30 },
    { name: 'Ngày Quốc tế Lao động (1/5)', month: 5, day: 1 },
    { name: 'Ngày Quốc khánh (2/9)', month: 9, day: 2 },
    { name: 'Tết Nguyên Đán', month: null, day: null, note: 'Theo lịch âm' },
    { name: 'Tết Trung Thu', month: null, day: null, note: 'Theo lịch âm' }
  ];

  // Fetch settings
  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError('');

      const params = new URLSearchParams();
      if (filters.item_type !== 'all') params.append('item_type', filters.item_type);
      if (filters.item_name !== 'all') params.append('item_name', filters.item_name);
      if (filters.scope_type !== 'all') params.append('scope_type', filters.scope_type);
      if (filters.is_active !== 'all') params.append('is_active', filters.is_active);

      const response = await api.get(`/payroll-settings?${params}`);
      if (response.data.success) {
        setSettings(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
      setError('Không thể tải danh sách cài đặt');
    } finally {
      setLoading(false);
    }
  };

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

  // Fetch users (for user scope)
  const fetchUsers = async () => {
    try {
      const response = await api.get('/hr-profiles/staff?limit=1000');
      if (response.data.success) {
        setUsers(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchSettings();
      fetchDepartments();
      fetchUsers();
    }
  }, [currentUser, filters]);

  // Handle filter change
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Format number with dots for thousands separator
  const formatNumberInput = (value) => {
    if (!value) return '';
    // Remove all non-digit characters (including VNĐ, spaces, etc.)
    const numericValue = value.toString().replace(/\D/g, '');
    if (!numericValue) return '';
    // Add dots for thousands separator
    return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  // Parse number from formatted string (remove dots and currency units)
  const parseNumberInput = (value) => {
    if (!value) return '';
    // Remove dots, spaces, and currency units (VNĐ, vnd, etc.)
    return value.toString()
      .replace(/\./g, '')
      .replace(/\s+/g, '')
      .replace(/vnd/gi, '')
      .replace(/vnđ/gi, '')
      .replace(/đ/g, '');
  };

  // Handle form change
  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    // Special handling for amount field - format with dots for display
    if (name === 'amount' && formData.amount_type === 'fixed') {
      // Remove all non-digit characters and store as clean number string
      const numericValue = parseNumberInput(value);
      setFormData(prev => ({
        ...prev,
        [name]: numericValue || ''
      }));
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Open modal for create/edit
  const handleOpenModal = (setting = null) => {
    if (setting) {
      setEditingSetting(setting);
      // Ensure amount is properly formatted for fixed amounts
      let amountValue = setting.amount;
      if (setting.amount_type === 'fixed') {
        // Convert to number first, then to string to ensure clean value
        const numAmount = parseFloat(setting.amount) || 0;
        amountValue = numAmount.toString();
      }
      
      setFormData({
        item_type: setting.item_type,
        item_name: setting.item_name,
        scope_type: setting.scope_type,
        scope_value: setting.scope_value || '',
        period_type: setting.period_type,
        period_value: setting.period_value || '',
        tenure_type: setting.tenure_type || 'none',
        tenure_max_months: setting.tenure_max_months || '',
        amount: amountValue,
        amount_type: setting.amount_type,
        salary_type: setting.salary_type || 'base_salary',
        is_active: setting.is_active,
        description: setting.description || '',
        notes: setting.notes || ''
      });
    } else {
      setEditingSetting(null);
      setFormData({
        item_type: 'deduction',
        item_name: '',
        scope_type: 'all',
        scope_value: '',
        period_type: 'all',
        period_value: '',
        tenure_type: 'none',
        tenure_max_months: '',
        amount: '',
        amount_type: 'fixed',
        salary_type: 'base_salary',
        is_active: true,
        description: '',
        notes: ''
      });
    }
    setShowModal(true);
  };

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError('');
      setSuccess('');

      // Parse amount - remove dots if it's a fixed amount
      let amountValue = formData.amount;
      if (formData.amount_type === 'fixed') {
        // Always parse to ensure we remove any formatting
        if (typeof formData.amount === 'string') {
          amountValue = parseNumberInput(formData.amount);
        }
        // Convert to number
        amountValue = parseFloat(amountValue) || 0;
      } else {
        // For percentage, just parse as float
        amountValue = parseFloat(formData.amount) || 0;
      }
      
      const submitData = {
        ...formData,
        amount: amountValue,
        scope_value: formData.scope_type === 'all' ? null : formData.scope_value,
        period_value: formData.period_type === 'all' ? null : (formData.period_value ? parseInt(formData.period_value) : null),
        tenure_type: formData.tenure_type || 'none',
        tenure_max_months: formData.tenure_type === 'months' && formData.tenure_max_months ? parseInt(formData.tenure_max_months) : null
      };

      if (editingSetting) {
        await api.put(`/payroll-settings/${editingSetting.id}`, submitData);
        setSuccess('Cập nhật cài đặt thành công');
      } else {
        await api.post('/payroll-settings', submitData);
        setSuccess('Tạo cài đặt thành công');
      }

      setShowModal(false);
      fetchSettings();
    } catch (err) {
      console.error('Error saving setting:', err);
      setError(err.response?.data?.message || 'Không thể lưu cài đặt');
    }
  };

  // Handle delete
  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa cài đặt này?')) {
      return;
    }

    try {
      setError('');
      await api.delete(`/payroll-settings/${id}`);
      setSuccess('Xóa cài đặt thành công');
      fetchSettings();
    } catch (err) {
      console.error('Error deleting setting:', err);
      setError(err.response?.data?.message || 'Không thể xóa cài đặt');
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    if (!amount) return '0';
    return parseFloat(amount).toLocaleString('vi-VN');
  };

  // Get item label
  const getItemLabel = (itemName) => {
    const allItems = [...deductionItems, ...earningItems];
    const item = allItems.find(i => i.value === itemName);
    return item ? item.label : itemName;
  };

  // Get scope label
  const getScopeLabel = (scopeType, scopeValue) => {
    if (scopeType === 'all') return 'Tất cả';
    if (scopeType === 'user') {
      const user = users.find(u => (u.id || u.user_id)?.toString() === scopeValue);
      return user ? user.full_name : scopeValue;
    }
    if (scopeType === 'department') return scopeValue;
    return scopeValue;
  };

  // Get period label
  const getPeriodLabel = (periodType, periodValue) => {
    if (periodType === 'all') return 'Tất cả';
    if (periodType === 'month') return `Tháng ${periodValue}`;
    if (periodType === 'year') return `Năm ${periodValue}`;
    return periodValue;
  };

  // Get tenure label
  const getTenureLabel = (tenureType, tenureMaxMonths) => {
    if (tenureType === 'none' || !tenureType) return 'Không';
    if (tenureType === 'months') {
      if (!tenureMaxMonths) return 'Theo thời gian làm việc';
      const years = Math.floor(tenureMaxMonths / 12);
      const months = tenureMaxMonths % 12;
      if (years > 0 && months > 0) {
        return `Dưới ${years} năm ${months} tháng`;
      } else if (years > 0) {
        return `Dưới ${years} năm`;
      } else {
        return `Dưới ${tenureMaxMonths} tháng`;
      }
    }
    return 'Không';
  };

  // Status Working Days Mappings Functions
  const fetchStatusMappings = async () => {
    try {
      setLoading(true);
      setError('');

      const params = new URLSearchParams();
      if (statusMappingFilters.status_code !== 'all') params.append('status_code', statusMappingFilters.status_code);
      if (statusMappingFilters.scope_type !== 'all') params.append('scope_type', statusMappingFilters.scope_type);
      if (statusMappingFilters.is_active !== 'all') params.append('is_active', statusMappingFilters.is_active);

      const response = await api.get(`/payroll-settings/status-working-days?${params}`);
      if (response.data.success) {
        setStatusMappings(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching status mappings:', err);
      setError('Không thể tải danh sách mapping trạng thái');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser && activeTab === 'status-mapping') {
      fetchStatusMappings();
    }
  }, [currentUser, activeTab, statusMappingFilters]);

  const [statusMappingFormData, setStatusMappingFormData] = useState({
    status_code: '',
    working_day_value: '1',
    scope_type: 'all',
    scope_value: '',
    is_active: true,
    description: '',
    notes: ''
  });

  const handleStatusMappingFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setStatusMappingFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleOpenStatusMappingModal = (mapping = null) => {
    if (mapping) {
      setEditingStatusMapping(mapping);
      setStatusMappingFormData({
        status_code: mapping.status_code,
        working_day_value: mapping.working_day_value?.toString() || '1',
        scope_type: mapping.scope_type,
        scope_value: mapping.scope_value || '',
        is_active: mapping.is_active,
        description: mapping.description || '',
        notes: mapping.notes || ''
      });
    } else {
      setEditingStatusMapping(null);
      setStatusMappingFormData({
        status_code: '',
        working_day_value: '1',
        scope_type: 'all',
        scope_value: '',
        is_active: true,
        description: '',
        notes: ''
      });
    }
    setShowStatusMappingModal(true);
  };

  const handleStatusMappingSubmit = async (e) => {
    e.preventDefault();
    try {
      setError('');
      setSuccess('');

      const submitData = {
        ...statusMappingFormData,
        working_day_value: parseFloat(statusMappingFormData.working_day_value),
        scope_value: statusMappingFormData.scope_type === 'all' ? null : statusMappingFormData.scope_value
      };

      if (editingStatusMapping) {
        await api.put(`/payroll-settings/status-working-days/${editingStatusMapping.id}`, submitData);
        setSuccess('Cập nhật mapping trạng thái thành công');
      } else {
        await api.post('/payroll-settings/status-working-days', submitData);
        setSuccess('Tạo mapping trạng thái thành công');
      }

      setShowStatusMappingModal(false);
      fetchStatusMappings();
    } catch (err) {
      console.error('Error saving status mapping:', err);
      setError(err.response?.data?.message || 'Không thể lưu mapping trạng thái');
    }
  };

  const handleDeleteStatusMapping = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa mapping trạng thái này?')) {
      return;
    }

    try {
      setError('');
      await api.delete(`/payroll-settings/status-working-days/${id}`);
      setSuccess('Xóa mapping trạng thái thành công');
      fetchStatusMappings();
    } catch (err) {
      console.error('Error deleting status mapping:', err);
      setError(err.response?.data?.message || 'Không thể xóa mapping trạng thái');
    }
  };

  // Common status codes
  const statusCodes = ['X', 'O', 'CNX', 'LX', 'LO', 'CNO', 'CT', 'XP', 'P', 'L', 'NO', 'KL', 'CP', 'XNC', 'ML'];

  // Render Payroll Settings Tab
  const renderPayrollSettingsTab = () => {
    return (
      <>
      {/* Filters */}
      <div className="session1-list-controls mb-4">
        <div className="search1-controls">
          <Row className="g-2">
            <Col md={3}>
              <div className="mb-3">
                <Form.Label>Loại khoản</Form.Label>
                <select
                  className="filter-select"
                  name="item_type"
                  value={filters.item_type}
                  onChange={handleFilterChange}
                >
                  <option value="all">Tất cả</option>
                  <option value="deduction">Khấu trừ</option>
                  <option value="earning">Thu nhập</option>
                </select>
              </div>
            </Col>
            <Col md={3}>
              <div className="mb-3">
                <Form.Label>Khoản</Form.Label>
                <select
                  className="filter-select"
                  name="item_name"
                  value={filters.item_name}
                  onChange={handleFilterChange}
                >
                  <option value="all">Tất cả</option>
                  {filters.item_type === 'deduction' || filters.item_type === 'all' ? (
                    deductionItems.map(item => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))
                  ) : null}
                  {filters.item_type === 'earning' || filters.item_type === 'all' ? (
                    earningItems.map(item => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))
                  ) : null}
                </select>
              </div>
            </Col>
            <Col md={3}>
              <div className="mb-3">
                <Form.Label>Phạm vi</Form.Label>
                <select
                  className="filter-select"
                  name="scope_type"
                  value={filters.scope_type}
                  onChange={handleFilterChange}
                >
                  <option value="all">Tất cả</option>
                  <option value="all">Tất cả nhân viên</option>
                  <option value="user">Theo nhân viên</option>
                  <option value="department">Theo phòng ban</option>
                </select>
              </div>
            </Col>
            <Col md={3}>
              <div className="mb-3">
                <Form.Label>Trạng thái</Form.Label>
                <select
                  className="filter-select"
                  name="is_active"
                  value={filters.is_active}
                  onChange={handleFilterChange}
                >
                  <option value="all">Tất cả</option>
                  <option value="true">Đang hoạt động</option>
                  <option value="false">Đã tắt</option>
                </select>
              </div>
            </Col>
          </Row>
        </div>
      </div>

      {/* Settings Table */}
      <div className="session-table-container">
        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" />
            <p className="mt-3">Đang tải danh sách cài đặt...</p>
          </div>
        ) : settings.length === 0 ? (
          <div className="text-center py-5">
            <i className="fas fa-cog fa-4x text-muted mb-3"></i>
            <h5>Chưa có cài đặt nào</h5>
            <p className="text-muted">Nhấn "Thêm cài đặt" để tạo mới</p>
          </div>
        ) : (
          <div className="table-responsive-mobile">
            <table className="session-table">
              <thead>
                <tr>
                  <th>Loại</th>
                  <th>Khoản</th>
                  <th>Phạm vi</th>
                  <th>Kỳ</th>
                  <th>Thời gian làm việc</th>
                  <th>Số tiền</th>
                  <th>Loại số tiền</th>
                  <th>Áp dụng cho</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {settings.map(setting => (
                  <tr key={setting.id}>
                    <td>
                      <Badge bg={setting.item_type === 'deduction' ? 'danger' : 'success'}>
                        {setting.item_type === 'deduction' ? 'Khấu trừ' : 'Thu nhập'}
                      </Badge>
                    </td>
                    <td>{getItemLabel(setting.item_name)}</td>
                    <td>{getScopeLabel(setting.scope_type, setting.scope_value)}</td>
                    <td>{getPeriodLabel(setting.period_type, setting.period_value)}</td>
                    <td>{getTenureLabel(setting.tenure_type, setting.tenure_max_months)}</td>
                    <td>
                      {setting.amount_type === 'percentage' 
                        ? `${formatCurrency(setting.amount)}%`
                        : `${formatCurrency(setting.amount)} VNĐ`
                      }
                    </td>
                    <td>{setting.amount_type === 'percentage' ? 'Phần trăm' : 'Cố định'}</td>
                    <td>
                      {setting.salary_type === 'base_salary' ? 'Lương cơ bản' :
                        setting.salary_type === 'contract_salary' ? 'Lương thỏa thuận (HĐ)' :
                        setting.salary_type === 'gross_salary' ? 'Lương thực tế' :
                        setting.salary_type === 'net_salary' ? 'Thực lĩnh' : 'Lương cơ bản'}
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
                        className="me-2"
                        onClick={() => handleOpenModal(setting)}
                      >
                        <i className="fas fa-edit"></i>
                      </Button>
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => handleDelete(setting.id)}
                      >
                        <i className="fas fa-trash"></i>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {editingSetting ? 'Chỉnh sửa cài đặt' : 'Thêm cài đặt mới'}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <Row className="g-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Loại khoản <span className="text-danger">*</span></Form.Label>
                  <Form.Select
                    name="item_type"
                    value={formData.item_type}
                    onChange={handleFormChange}
                    required
                  >
                    <option value="deduction">Khấu trừ</option>
                    <option value="earning">Thu nhập</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Khoản <span className="text-danger">*</span></Form.Label>
                  <Form.Select
                    name="item_name"
                    value={formData.item_name}
                    onChange={handleFormChange}
                    required
                  >
                    <option value="">Chọn khoản</option>
                    {formData.item_type === 'deduction' ? (
                      deductionItems.map(item => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))
                    ) : (
                      earningItems.map(item => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))
                    )}
                  </Form.Select>
                </Form.Group>
              </Col>
              {formData.item_name === 'holiday_bonus' && (
                <Col md={12}>
                  <Form.Group>
                    <Form.Label>Gợi ý ngày lễ Việt Nam</Form.Label>
                    <div className="d-flex flex-wrap gap-2 mb-2">
                      {vietnameseHolidays.map((holiday, index) => (
                        <Button
                          key={index}
                          variant="outline-info"
                          size="sm"
                          onClick={() => {
                            const holidayText = holiday.month 
                              ? `${holiday.name} (${holiday.day}/${holiday.month})`
                              : holiday.name;
                            
                            // Update form data
                            const updatedData = {
                              description: holidayText,
                              notes: holiday.note ? `${holidayText} - ${holiday.note}` : holidayText
                            };
                            
                            // If holiday has a specific month, set period_type to 'month' and period_value to that month
                            if (holiday.month) {
                              updatedData.period_type = 'month';
                              updatedData.period_value = holiday.month.toString();
                            }
                            
                            setFormData(prev => ({
                              ...prev,
                              ...updatedData
                            }));
                          }}
                        >
                          {holiday.name}
                        </Button>
                      ))}
                    </div>
                    <small className="text-muted">Click vào ngày lễ để tự động điền mô tả và chọn tháng tương ứng</small>
                  </Form.Group>
                </Col>
              )}
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Phạm vi áp dụng <span className="text-danger">*</span></Form.Label>
                  <Form.Select
                    name="scope_type"
                    value={formData.scope_type}
                    onChange={handleFormChange}
                    required
                  >
                    <option value="all">Tất cả nhân viên</option>
                    <option value="user">Theo nhân viên</option>
                    <option value="department">Theo phòng ban</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              {formData.scope_type === 'user' && (
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Nhân viên <span className="text-danger">*</span></Form.Label>
                    <Form.Select
                      name="scope_value"
                      value={formData.scope_value}
                      onChange={handleFormChange}
                      required={formData.scope_type === 'user'}
                    >
                      <option value="">Chọn nhân viên</option>
                      {users.map(user => (
                        <option key={user.id || user.user_id} value={user.id || user.user_id}>
                          {user.full_name} ({user.employee_code || 'N/A'})
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
              )}
              {formData.scope_type === 'department' && (
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Phòng ban <span className="text-danger">*</span></Form.Label>
                    <Form.Select
                      name="scope_value"
                      value={formData.scope_value}
                      onChange={handleFormChange}
                      required={formData.scope_type === 'department'}
                    >
                      <option value="">Chọn phòng ban</option>
                      {departments.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
              )}
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Kỳ áp dụng <span className="text-danger">*</span></Form.Label>
                  <Form.Select
                    name="period_type"
                    value={formData.period_type}
                    onChange={handleFormChange}
                    required
                  >
                    <option value="all">Tất cả</option>
                    <option value="month">Theo tháng</option>
                    <option value="year">Theo năm</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              {formData.period_type === 'month' && (
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Tháng <span className="text-danger">*</span></Form.Label>
                    <Form.Select
                      name="period_value"
                      value={formData.period_value}
                      onChange={handleFormChange}
                      required
                    >
                      <option value="">Chọn tháng</option>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                        <option key={m} value={m}>Tháng {m}</option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
              )}
              {formData.period_type === 'year' && (
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Năm <span className="text-danger">*</span></Form.Label>
                    <Form.Control
                      type="number"
                      name="period_value"
                      value={formData.period_value}
                      onChange={handleFormChange}
                      min="2020"
                      max="2100"
                      required
                    />
                  </Form.Group>
                </Col>
              )}
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Áp dụng theo thời gian làm việc <span className="text-danger">*</span></Form.Label>
                  <Form.Select
                    name="tenure_type"
                    value={formData.tenure_type}
                    onChange={handleFormChange}
                    required
                  >
                    <option value="none">Không (áp dụng cho tất cả)</option>
                    <option value="months">Theo số tháng làm việc</option>
                  </Form.Select>
                  <Form.Text className="text-muted">
                    Chọn "Theo số tháng làm việc" để cài đặt mức thưởng/phụ cấp khác nhau theo thâm niên
                  </Form.Text>
                </Form.Group>
              </Col>
              {formData.tenure_type === 'months' && (
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Tối đa số tháng <span className="text-danger">*</span></Form.Label>
                    <Form.Control
                      type="number"
                      name="tenure_max_months"
                      value={formData.tenure_max_months}
                      onChange={handleFormChange}
                      min="1"
                      placeholder="Ví dụ: 3, 9, 12, 24"
                      required={formData.tenure_type === 'months'}
                    />
                    <Form.Text className="text-muted">
                      Nhân viên có thời gian làm việc &lt;= số tháng này sẽ áp dụng mức này. Ví dụ: nhập 3 cho "dưới 3 tháng", 9 cho "dưới 9 tháng", 12 cho "dưới 1 năm", 24 cho "dưới 2 năm"
                    </Form.Text>
                  </Form.Group>
                </Col>
              )}
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Loại số tiền <span className="text-danger">*</span></Form.Label>
                  <Form.Select
                    name="amount_type"
                    value={formData.amount_type}
                    onChange={handleFormChange}
                    required
                  >
                    <option value="fixed">Số tiền cố định</option>
                    <option value="percentage">Phần trăm (%)</option>
                  </Form.Select>
                </Form.Group>
              </Col>
               <Col md={6}>
                 <Form.Group>
                   <Form.Label>
                     {formData.amount_type === 'percentage' ? 'Phần trăm (%)' : 'Số tiền'} <span className="text-danger">*</span>
                   </Form.Label>
                   {formData.amount_type === 'percentage' && (
                     <Form.Text className="text-muted d-block mb-2">
                       Phần trăm sẽ được tính dựa trên loại lương được chọn bên dưới
                     </Form.Text>
                   )}
                   {formData.amount_type === 'fixed' ? (
                     <div className="position-relative">
                       <Form.Control
                         type="text"
                         name="amount"
                         value={formData.amount ? formatNumberInput(formData.amount) : ''}
                         onChange={handleFormChange}
                         placeholder="0"
                         required
                         style={{ paddingRight: '60px' }}
                       />
                       <span 
                         className="position-absolute"
                         style={{
                           right: '12px',
                           top: '50%',
                           transform: 'translateY(-50%)',
                           color: '#6c757d',
                           pointerEvents: 'none'
                         }}
                       >
                         VNĐ
                       </span>
                     </div>
                   ) : (
                     <Form.Control
                       type="number"
                       name="amount"
                       value={formData.amount}
                       onChange={handleFormChange}
                       min="0"
                       step="0.01"
                       required
                     />
                   )}
                 </Form.Group>
               </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Áp dụng cho <span className="text-danger">*</span></Form.Label>
                  <Form.Select
                    name="salary_type"
                    value={formData.salary_type}
                    onChange={handleFormChange}
                    required
                  >
                    <option value="base_salary">Lương cơ bản</option>
                    <option value="contract_salary">Lương thỏa thuận (HĐ)</option>
                    <option value="gross_salary">Lương thực tế</option>
                    <option value="net_salary">Thực lĩnh</option>
                  </Form.Select>
                  <Form.Text className="text-muted">
                    {formData.amount_type === 'percentage' 
                      ? 'Chọn loại lương để tính phần trăm. Mặc định: Lương cơ bản'
                      : 'Loại lương tham chiếu (chỉ áp dụng khi tính phần trăm). Mặc định: Lương cơ bản'}
                  </Form.Text>
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group>
                  <Form.Label>Mô tả</Form.Label>
                  <Form.Control
                    type="text"
                    name="description"
                    value={formData.description}
                    onChange={handleFormChange}
                    placeholder={formData.item_name === 'holiday_bonus' ? "Ví dụ: Tết Dương lịch (1/1)" : "Mô tả ngắn gọn về cài đặt này"}
                  />
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group>
                  <Form.Label>Ghi chú</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    name="notes"
                    value={formData.notes}
                    onChange={handleFormChange}
                    placeholder="Ghi chú thêm (nếu có)"
                  />
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Check
                  type="checkbox"
                  name="is_active"
                  label="Kích hoạt cài đặt này"
                  checked={formData.is_active}
                  onChange={handleFormChange}
                />
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Hủy
            </Button>
            <Button variant="primary" type="submit">
              {editingSetting ? 'Cập nhật' : 'Tạo mới'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
      </>
    );
  };

  // Render Status Mapping Tab
  const renderStatusMappingTab = () => {
    return (
      <>
          {/* Filters */}
          <div className="session1-list-controls mb-4">
            <div className="search1-controls">
              <Row className="g-2">
                <Col md={4}>
                  <div className="mb-3">
                    <Form.Label>Mã trạng thái</Form.Label>
                    <select
                      className="filter-select"
                      name="status_code"
                      value={statusMappingFilters.status_code}
                      onChange={(e) => setStatusMappingFilters(prev => ({ ...prev, status_code: e.target.value }))}
                    >
                      <option value="all">Tất cả</option>
                      {statusCodes.map(code => (
                        <option key={code} value={code}>{code}</option>
                      ))}
                    </select>
                  </div>
                </Col>
                <Col md={4}>
                  <div className="mb-3">
                    <Form.Label>Phạm vi</Form.Label>
                    <select
                      className="filter-select"
                      name="scope_type"
                      value={statusMappingFilters.scope_type}
                      onChange={(e) => setStatusMappingFilters(prev => ({ ...prev, scope_type: e.target.value }))}
                    >
                      <option value="all">Tất cả</option>
                      <option value="all">Tất cả nhân viên</option>
                      <option value="user">Theo nhân viên</option>
                      <option value="department">Theo phòng ban</option>
                    </select>
                  </div>
                </Col>
                <Col md={4}>
                  <div className="mb-3">
                    <Form.Label>Trạng thái</Form.Label>
                    <select
                      className="filter-select"
                      name="is_active"
                      value={statusMappingFilters.is_active}
                      onChange={(e) => setStatusMappingFilters(prev => ({ ...prev, is_active: e.target.value }))}
                    >
                      <option value="all">Tất cả</option>
                      <option value="true">Đang hoạt động</option>
                      <option value="false">Đã tắt</option>
                    </select>
                  </div>
                </Col>
              </Row>
            </div>
          </div>

          {/* Status Mappings Table */}
          <div className="session-table-container">
            {loading ? (
              <div className="text-center py-5">
                <Spinner animation="border" />
                <p className="mt-3">Đang tải danh sách mapping...</p>
              </div>
            ) : statusMappings.length === 0 ? (
              <div className="text-center py-5">
                <i className="fas fa-calendar-check fa-4x text-muted mb-3"></i>
                <h5>Chưa có mapping trạng thái nào</h5>
                <p className="text-muted">Nhấn "Thêm mapping" để tạo mapping mới</p>
              </div>
            ) : (
              <div className="table-responsive-mobile">
                <table className="session-table">
                  <thead>
                    <tr>
                      <th>Mã trạng thái</th>
                      <th>Giá trị ngày công</th>
                      <th>Phạm vi</th>
                      <th>Giá trị phạm vi</th>
                      <th>Mô tả</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statusMappings.map(mapping => (
                      <tr key={mapping.id}>
                        <td><Badge bg="primary">{mapping.status_code}</Badge></td>
                        <td>
                          <Badge bg={
                            parseFloat(mapping.working_day_value) === 0 ? 'secondary' :
                            parseFloat(mapping.working_day_value) > 0 && parseFloat(mapping.working_day_value) < 1 ? 'warning' :
                            parseFloat(mapping.working_day_value) >= 1 ? 'success' : 'info'
                          }>
                            {parseFloat(mapping.working_day_value).toFixed(2)} ngày
                            {parseFloat(mapping.working_day_value) === 0 && ' (không tính)'}
                            {parseFloat(mapping.working_day_value) > 0 && parseFloat(mapping.working_day_value) < 1 && ' (một phần)'}
                            {parseFloat(mapping.working_day_value) >= 1 && parseFloat(mapping.working_day_value) < 2 && ' (đầy đủ)'}
                            {parseFloat(mapping.working_day_value) >= 2 && ' (nhiều ngày)'}
                          </Badge>
                        </td>
                        <td>{mapping.scope_type === 'all' ? 'Tất cả' : mapping.scope_type === 'user' ? 'Nhân viên' : 'Phòng ban'}</td>
                        <td>{getScopeLabel(mapping.scope_type, mapping.scope_value)}</td>
                        <td>{mapping.description || '-'}</td>
                        <td>
                          <Badge bg={mapping.is_active ? 'success' : 'secondary'}>
                            {mapping.is_active ? 'Hoạt động' : 'Tắt'}
                          </Badge>
                        </td>
                        <td>
                          <Button
                            variant="link"
                            size="sm"
                            onClick={() => handleOpenStatusMappingModal(mapping)}
                          >
                            <i className="fas fa-edit"></i>
                          </Button>
                          <Button
                            variant="link"
                            size="sm"
                            className="text-danger"
                            onClick={() => handleDeleteStatusMapping(mapping.id)}
                          >
                            <i className="fas fa-trash"></i>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Status Mapping Modal */}
          <Modal show={showStatusMappingModal} onHide={() => setShowStatusMappingModal(false)} size="lg">
            <Modal.Header closeButton>
              <Modal.Title>
                {editingStatusMapping ? 'Chỉnh sửa mapping trạng thái' : 'Thêm mapping trạng thái mới'}
              </Modal.Title>
            </Modal.Header>
            <Form onSubmit={handleStatusMappingSubmit}>
              <Modal.Body>
                <Row>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Mã trạng thái <span className="text-danger">*</span></Form.Label>
                      <Form.Select
                        name="status_code"
                        value={statusMappingFormData.status_code}
                        onChange={handleStatusMappingFormChange}
                        required
                      >
                        <option value="">Chọn mã trạng thái</option>
                        {statusCodes.map(code => (
                          <option key={code} value={code}>{code}</option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Giá trị ngày công <span className="text-danger">*</span></Form.Label>
                      <Form.Control
                        type="number"
                        name="working_day_value"
                        value={statusMappingFormData.working_day_value}
                        onChange={handleStatusMappingFormChange}
                        min="0"
                        max="10"
                        step="0.25"
                        required
                        placeholder="Nhập giá trị (0-10)"
                      />
                      <Form.Text className="text-muted">
                        Ví dụ: 0 (không tính), 0.25, 0.5 (nửa ngày), 0.75, 1 (đầy đủ), 1.5, 2, etc.
                      </Form.Text>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Phạm vi <span className="text-danger">*</span></Form.Label>
                      <Form.Select
                        name="scope_type"
                        value={statusMappingFormData.scope_type}
                        onChange={handleStatusMappingFormChange}
                        required
                      >
                        <option value="all">Tất cả nhân viên</option>
                        <option value="user">Theo nhân viên</option>
                        <option value="department">Theo phòng ban</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    {statusMappingFormData.scope_type !== 'all' && (
                      <Form.Group>
                        <Form.Label>Giá trị phạm vi <span className="text-danger">*</span></Form.Label>
                        {statusMappingFormData.scope_type === 'user' ? (
                          <Form.Select
                            name="scope_value"
                            value={statusMappingFormData.scope_value}
                            onChange={handleStatusMappingFormChange}
                            required
                          >
                            <option value="">Chọn nhân viên</option>
                            {users.map(user => (
                              <option key={user.id || user.user_id} value={(user.id || user.user_id)?.toString()}>
                                {user.full_name}
                              </option>
                            ))}
                          </Form.Select>
                        ) : (
                          <Form.Select
                            name="scope_value"
                            value={statusMappingFormData.scope_value}
                            onChange={handleStatusMappingFormChange}
                            required
                          >
                            <option value="">Chọn phòng ban</option>
                            {departments.map(dept => (
                              <option key={dept} value={dept}>{dept}</option>
                            ))}
                          </Form.Select>
                        )}
                      </Form.Group>
                    )}
                  </Col>
                  <Col md={12}>
                    <Form.Group>
                      <Form.Label>Mô tả</Form.Label>
                      <Form.Control
                        type="text"
                        name="description"
                        value={statusMappingFormData.description}
                        onChange={handleStatusMappingFormChange}
                        placeholder="Mô tả trạng thái (ví dụ: Làm offline, Nghỉ phép, ...)"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={12}>
                    <Form.Group>
                      <Form.Label>Ghi chú</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        name="notes"
                        value={statusMappingFormData.notes}
                        onChange={handleStatusMappingFormChange}
                        placeholder="Ghi chú thêm (nếu có)"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={12}>
                    <Form.Check
                      type="checkbox"
                      name="is_active"
                      label="Kích hoạt mapping này"
                      checked={statusMappingFormData.is_active}
                      onChange={handleStatusMappingFormChange}
                    />
                  </Col>
                </Row>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={() => setShowStatusMappingModal(false)}>
                  Hủy
                </Button>
                <Button variant="primary" type="submit">
                  {editingStatusMapping ? 'Cập nhật' : 'Tạo mới'}
                </Button>
              </Modal.Footer>
            </Form>
          </Modal>
      </>
    );
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
            <h1>Cài đặt lương</h1>
          </div>
          <div className="header-actions">
            <Button variant="outline-light" className="create-session-btn me-2" onClick={() => navigate('/hr/payroll')}>
              <i className="fas fa-arrow-left me-2"></i>
              Quay về
            </Button>
            {activeTab === 'payroll' && (
              <Button variant="outline-light" className="create-session-btn" onClick={() => handleOpenModal()}>
                <i className="fas fa-plus me-2"></i>
                Thêm cài đặt
              </Button>
            )}
            {activeTab === 'status-mapping' && (
              <Button variant="outline-light" className="create-session-btn" onClick={() => handleOpenStatusMappingModal()}>
                <i className="fas fa-plus me-2"></i>
                Thêm mapping
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <Tabs
          activeKey={activeTab}
          onSelect={(k) => setActiveTab(k)}
          className="custom-tabs"
        >
          <Tab eventKey="payroll" title={
            <span className="tab-title">
              <i className="fas fa-cog"></i>
              Cài đặt lương
            </span>
          }>
            {renderPayrollSettingsTab()}
          </Tab>
          <Tab eventKey="status-mapping" title={
            <span className="tab-title">
              <i className="fas fa-calendar-check"></i>
              Mapping trạng thái chấm công
            </span>
          }>
            {renderStatusMappingTab()}
          </Tab>
        </Tabs>
      </div>
    </Container>
  );
};

export default PayrollSettings;

