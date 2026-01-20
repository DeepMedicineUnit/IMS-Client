import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Form, Modal, Badge, Spinner, Alert, Tabs, Tab, Nav } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import Pagination from '../../components/Pagination';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const PersonalTasks = () => {
  usePageTitle('Tác vụ cá nhân');
  const { currentUser } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
    urgent: 0,
    high: 0,
    overdue: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [filters, setFilters] = useState({
    status: 'all',
    category: 'all',
    priority: 'all',
    search: ''
  });
  const [sortBy, setSortBy] = useState('due_date');
  const [sortOrder, setSortOrder] = useState('ASC');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalItems: 0,
    totalPages: 0
  });
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'work',
    priority: 'medium',
    due_date: '',
    subtasks: []
  });
  const [subtaskInput, setSubtaskInput] = useState('');

  // Fetch tasks
  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError('');
      
      const params = new URLSearchParams({
        status: filters.status,
        category: filters.category,
        priority: filters.priority,
        search: filters.search,
        sortBy: sortBy,
        sortOrder: sortOrder
      });

      const [tasksResponse, statsResponse] = await Promise.all([
        api.get(`/tasks?${params}`),
        api.get('/tasks/stats')
      ]);

      if (tasksResponse.data.success) {
        setTasks(tasksResponse.data.data);
      }

      if (statsResponse.data.success) {
        setStats(statsResponse.data.data);
      }
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError('Không thể tải danh sách tác vụ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchTasks();
    }
  }, [currentUser, filters, sortBy, sortOrder]);

  // Filter tasks by active tab and update pagination
  useEffect(() => {
    let filtered = [...tasks];

    if (activeTab === 'pending') {
      filtered = filtered.filter(t => t.status === 'pending');
    } else if (activeTab === 'in_progress') {
      filtered = filtered.filter(t => t.status === 'in_progress');
    } else if (activeTab === 'completed') {
      filtered = filtered.filter(t => t.status === 'completed');
    } else if (activeTab === 'overdue') {
      filtered = filtered.filter(t => {
        if (!t.due_date) return false;
        const dueDate = new Date(t.due_date);
        const now = new Date();
        return dueDate < now && t.status !== 'completed' && t.status !== 'cancelled';
      });
    }

    setFilteredTasks(filtered);
    
    // Update pagination
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / pagination.limit);
    setPagination(prev => ({
      ...prev,
      totalItems,
      totalPages,
      page: prev.page > totalPages && totalPages > 0 ? totalPages : prev.page
    }));
  }, [tasks, activeTab, pagination.limit]);

  // Handle form input change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Add subtask
  const handleAddSubtask = () => {
    if (subtaskInput.trim()) {
      setFormData(prev => ({
        ...prev,
        subtasks: [...prev.subtasks, { title: subtaskInput.trim(), completed: false }]
      }));
      setSubtaskInput('');
    }
  };

  // Remove subtask
  const handleRemoveSubtask = (index) => {
    setFormData(prev => ({
      ...prev,
      subtasks: prev.subtasks.filter((_, i) => i !== index)
    }));
  };

  // Toggle subtask completion
  const handleToggleSubtask = (index) => {
    setFormData(prev => ({
      ...prev,
      subtasks: prev.subtasks.map((st, i) => 
        i === index ? { ...st, completed: !st.completed } : st
      )
    }));
  };

  // Open create modal
  const handleCreate = () => {
    setEditingTask(null);
    setFormData({
      title: '',
      description: '',
      category: 'work',
      priority: 'medium',
      due_date: '',
      subtasks: []
    });
    setSubtaskInput('');
    setShowModal(true);
  };

  // Open edit modal
  const handleEdit = (task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      category: task.category,
      priority: task.priority,
      due_date: task.due_date ? task.due_date.split('T')[0] + 'T' + task.due_date.split('T')[1].substring(0, 5) : '',
      subtasks: task.subtasks || []
    });
    setSubtaskInput('');
    setShowModal(true);
  };

  // Save task (create or update)
  const handleSave = async () => {
    try {
      console.log('[PersonalTasks] ===== BẮT ĐẦU TẠO/CẬP NHẬT TÁC VỤ =====');
      console.log('[PersonalTasks] Form data:', formData);
      
      if (!formData.title.trim()) {
        console.log('[PersonalTasks] ❌ Lỗi: Tiêu đề trống');
        setError('Vui lòng nhập tiêu đề tác vụ');
        return;
      }

      const taskData = {
        ...formData,
        due_date: formData.due_date ? new Date(formData.due_date).toISOString().slice(0, 16).replace('T', ' ') : null
      };

      console.log('[PersonalTasks] Task data đã chuẩn bị:', taskData);
      console.log('[PersonalTasks] Đang gửi request đến server...');
      console.log('[PersonalTasks] URL:', editingTask ? `/api/tasks/${editingTask.id}` : '/api/tasks');
      console.log('[PersonalTasks] Method:', editingTask ? 'PUT' : 'POST');

      let response;
      const startTime = Date.now();
      
      try {
        if (editingTask) {
          console.log('[PersonalTasks] 📝 Cập nhật tác vụ ID:', editingTask.id);
          response = await api.put(`/tasks/${editingTask.id}`, taskData);
        } else {
          console.log('[PersonalTasks] ➕ Tạo tác vụ mới');
          response = await api.post('/tasks', taskData);
        }
        
        const duration = Date.now() - startTime;
        console.log('[PersonalTasks] ✅ Request thành công!');
        console.log('[PersonalTasks] Thời gian phản hồi:', duration + 'ms');
        console.log('[PersonalTasks] Response status:', response.status);
        console.log('[PersonalTasks] Response data:', response.data);

        if (response.data.success) {
          console.log('[PersonalTasks] ✅ Tác vụ đã được lưu thành công');
          setShowModal(false);
          fetchTasks();
        } else {
          console.log('[PersonalTasks] ⚠️ Response success = false:', response.data);
          setError(response.data.message || 'Không thể lưu tác vụ');
        }
      } catch (requestErr) {
        const duration = Date.now() - startTime;
        console.error('[PersonalTasks] ❌ Lỗi khi gửi request:', requestErr);
        console.error('[PersonalTasks] Thời gian trước khi lỗi:', duration + 'ms');
        console.error('[PersonalTasks] Error message:', requestErr.message);
        console.error('[PersonalTasks] Error response:', requestErr.response);
        console.error('[PersonalTasks] Error status:', requestErr.response?.status);
        console.error('[PersonalTasks] Error data:', requestErr.response?.data);
        console.error('[PersonalTasks] Error config:', requestErr.config);
        
        if (requestErr.response) {
          console.error('[PersonalTasks] ❌ Server trả về lỗi:', requestErr.response.status, requestErr.response.data);
          setError(requestErr.response?.data?.message || `Lỗi server: ${requestErr.response.status}`);
        } else if (requestErr.request) {
          console.error('[PersonalTasks] ❌ Không nhận được phản hồi từ server');
          console.error('[PersonalTasks] Request đã được gửi nhưng không có response');
          setError('Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng hoặc liên hệ quản trị viên.');
        } else {
          console.error('[PersonalTasks] ❌ Lỗi khi thiết lập request');
          setError('Có lỗi xảy ra khi gửi yêu cầu. Vui lòng thử lại.');
        }
        throw requestErr;
      }
    } catch (err) {
      console.error('[PersonalTasks] ❌ Lỗi tổng thể:', err);
      // Error đã được xử lý ở trên
    }
  };

  // Delete task
  const handleDelete = async () => {
    try {
      const response = await api.delete(`/tasks/${taskToDelete.id}`);
      if (response.data.success) {
        setShowDeleteModal(false);
        setTaskToDelete(null);
        fetchTasks();
      }
    } catch (err) {
      console.error('Error deleting task:', err);
      setError(err.response?.data?.message || 'Không thể xóa tác vụ');
    }
  };

  // Update task status
  const handleStatusChange = async (taskId, newStatus) => {
    try {
      const response = await api.put(`/tasks/${taskId}`, { status: newStatus });
      if (response.data.success) {
        fetchTasks();
      }
    } catch (err) {
      console.error('Error updating task status:', err);
      setError(err.response?.data?.message || 'Không thể cập nhật trạng thái');
    }
  };

  // Toggle subtask completion
  const handleToggleSubtaskCompletion = async (taskId, subtaskId, completed) => {
    try {
      const response = await api.patch(`/tasks/${taskId}/subtasks/${subtaskId}`, { completed });
      if (response.data.success) {
        fetchTasks();
      }
    } catch (err) {
      console.error('Error toggling subtask:', err);
      setError(err.response?.data?.message || 'Không thể cập nhật subtask');
    }
  };

  // Get priority badge color
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'danger';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  // Get priority label
  const getPriorityLabel = (priority) => {
    switch (priority) {
      case 'urgent': return 'Khẩn cấp';
      case 'high': return 'Cao';
      case 'medium': return 'Trung bình';
      case 'low': return 'Thấp';
      default: return priority;
    }
  };

  // Get category label
  const getCategoryLabel = (category) => {
    switch (category) {
      case 'work': return 'Công việc';
      case 'reminder': return 'Nhắc hạn';
      case 'checklist': return 'Checklist';
      default: return category;
    }
  };

  // Get status label
  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending': return 'Chờ xử lý';
      case 'in_progress': return 'Đang làm';
      case 'completed': return 'Hoàn thành';
      case 'cancelled': return 'Đã hủy';
      default: return status;
    }
  };

  // Get status badge color
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in_progress': return 'primary';
      case 'pending': return 'warning';
      case 'cancelled': return 'secondary';
      default: return 'secondary';
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Không có hạn';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return `Quá hạn ${Math.abs(diffDays)} ngày`;
    } else if (diffDays === 0) {
      return 'Hôm nay';
    } else if (diffDays === 1) {
      return 'Ngày mai';
    } else if (diffDays <= 7) {
      return `${diffDays} ngày nữa`;
    } else {
      return date.toLocaleDateString('vi-VN');
    }
  };

  // Check if task is overdue
  const isOverdue = (task) => {
    if (!task.due_date || task.status === 'completed' || task.status === 'cancelled') {
      return false;
    }
    const dueDate = new Date(task.due_date);
    const now = new Date();
    return dueDate < now;
  };

  return (
    <Container fluid className="session-main-container">
      {error && (
        <Alert variant="danger" className="mb-3" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Header */}
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Tác vụ của tôi</h1>
            <p className="header-subtitle">Việc cần làm, nhắc hạn, checklist cá nhân</p>
          </div>
          <div className="header-actions">
            <Button variant="outline-light" className="create-session-btn" onClick={handleCreate}>
              <i className="fas fa-plus me-2"></i>
              Tạo tác vụ mới
            </Button>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <Row className="g-3 mb-4">
        <Col md={3}>
          <div className="statistics-card">
            <div className="statistics-icon text-primary">
              <i className="fas fa-tasks"></i>
            </div>
            <div className="statistics-content">
              <h3>{stats.total}</h3>
              <p>Tổng tác vụ</p>
            </div>
          </div>
        </Col>
        <Col md={3}>
          <div className="statistics-card">
            <div className="statistics-icon text-warning">
              <i className="fas fa-clock"></i>
            </div>
            <div className="statistics-content">
              <h3 className="text-warning">{stats.pending}</h3>
              <p>Chờ xử lý</p>
            </div>
          </div>
        </Col>
        <Col md={3}>
          <div className="statistics-card">
            <div className="statistics-icon text-primary">
              <i className="fas fa-spinner"></i>
            </div>
            <div className="statistics-content">
              <h3 className="text-primary">{stats.in_progress}</h3>
              <p>Đang làm</p>
            </div>
          </div>
        </Col>
        <Col md={3}>
          <div className="statistics-card">
            <div className="statistics-icon text-success">
              <i className="fas fa-check-circle"></i>
            </div>
            <div className="statistics-content">
              <h3 className="text-success">{stats.completed}</h3>
              <p>Hoàn thành</p>
            </div>
          </div>
        </Col>
      </Row>

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
                  placeholder="Tìm theo tiêu đề, mô tả..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                />
              </div>
            </Col>
            <Col md={2}>
              <div className="mb-3">
                <Form.Label>Loại</Form.Label>
                <select
                  className="filter-select"
                  value={filters.category}
                  onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                >
                  <option value="all">Tất cả</option>
                  <option value="work">Công việc</option>
                  <option value="reminder">Nhắc hạn</option>
                  <option value="checklist">Checklist</option>
                </select>
              </div>
            </Col>
            <Col md={2}>
              <div className="mb-3">
                <Form.Label>Ưu tiên</Form.Label>
                <select
                  className="filter-select"
                  value={filters.priority}
                  onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
                >
                  <option value="all">Tất cả</option>
                  <option value="urgent">Khẩn cấp</option>
                  <option value="high">Cao</option>
                  <option value="medium">Trung bình</option>
                  <option value="low">Thấp</option>
                </select>
              </div>
            </Col>
            <Col md={2}>
              <div className="mb-3">
                <Form.Label>Sắp xếp</Form.Label>
                <select
                  className="filter-select"
                  value={`${sortBy}_${sortOrder}`}
                  onChange={(e) => {
                    const [field, order] = e.target.value.split('_');
                    setSortBy(field);
                    setSortOrder(order);
                  }}
                >
                  <option value="due_date_ASC">Hạn chót (Tăng dần)</option>
                  <option value="due_date_DESC">Hạn chót (Giảm dần)</option>
                  <option value="priority_ASC">Ưu tiên (Tăng dần)</option>
                  <option value="priority_DESC">Ưu tiên (Giảm dần)</option>
                  <option value="created_at_DESC">Mới nhất</option>
                  <option value="created_at_ASC">Cũ nhất</option>
                  <option value="title_ASC">Tiêu đề (A-Z)</option>
                  <option value="title_DESC">Tiêu đề (Z-A)</option>
                </select>
              </div>
            </Col>
            <Col md={1}>
              <div className="d-flex justify-content-end align-items-center mb-3">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => {
                    setFilters({ status: 'all', category: 'all', priority: 'all', search: '' });
                    setSortBy('due_date');
                    setSortOrder('ASC');
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

      {/* Tasks List */}
      <div className="session-table-container">
        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" />
            <p className="mt-3">Đang tải tác vụ...</p>
          </div>
        ) : (
          <>
            {/* Tab Navigation */}
            <div className="tab-navigation">
              <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k)}>
                <Nav variant="tabs" className="custom-tabs">
                  <Nav.Item>
                    <Nav.Link eventKey="all">
                      <span className="tab-title">
                        <i className="fas fa-list me-2"></i>
                        Tất cả ({tasks.length})
                      </span>
                    </Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link eventKey="pending">
                      <span className="tab-title">
                        <i className="fas fa-clock me-2"></i>
                        Chờ xử lý ({stats.pending})
                      </span>
                    </Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link eventKey="in_progress">
                      <span className="tab-title">
                        <i className="fas fa-spinner me-2"></i>
                        Đang làm ({stats.in_progress})
                      </span>
                    </Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link eventKey="completed">
                      <span className="tab-title">
                        <i className="fas fa-check-circle me-2"></i>
                        Hoàn thành ({stats.completed})
                      </span>
                    </Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link eventKey="overdue">
                      <span className="tab-title">
                        <i className="fas fa-exclamation-triangle me-2"></i>
                        Quá hạn ({stats.overdue})
                      </span>
                    </Nav.Link>
                  </Nav.Item>
                </Nav>
              </Tab.Container>
            </div>

            {filteredTasks.length === 0 ? (
              <div className="text-center py-5">
                <i className="fas fa-tasks fa-4x text-muted mb-3"></i>
                <h5>Chưa có tác vụ nào</h5>
                <p className="text-muted">Tạo tác vụ mới để bắt đầu quản lý công việc của bạn</p>
              </div>
            ) : (
              <div style={{ padding: '20px' }}>
                {filteredTasks
                  .slice((pagination.page - 1) * pagination.limit, pagination.page * pagination.limit)
                  .map(task => (
                  <div key={task.id} className={`session-card mb-3 ${isOverdue(task) ? 'border-danger' : ''}`} style={{ borderLeft: isOverdue(task) ? '4px solid #dc3545' : '1px solid #e9ecef' }}>
                    <div className="card-body-modern">
                        <div className="d-flex justify-content-between align-items-start">
                          <div className="flex-grow-1">
                            <div className="d-flex align-items-center mb-2">
                              <Form.Check
                                type="checkbox"
                                checked={task.status === 'completed'}
                                onChange={() => {
                                  const newStatus = task.status === 'completed' ? 'pending' : 'completed';
                                  handleStatusChange(task.id, newStatus);
                                }}
                                className="me-3"
                              />
                              <h5 className={`mb-0 ${task.status === 'completed' ? 'text-decoration-line-through text-muted' : ''}`}>
                                {task.title}
                              </h5>
                            </div>
                            {task.description && (
                              <p className="text-muted mb-2">{task.description}</p>
                            )}
                            <div className="d-flex flex-wrap gap-2 mb-2">
                              <Badge bg={getStatusColor(task.status)}>
                                {getStatusLabel(task.status)}
                              </Badge>
                              <Badge bg={getPriorityColor(task.priority)}>
                                <i className="fas fa-flag me-1"></i>
                                {getPriorityLabel(task.priority)}
                              </Badge>
                              <Badge bg="info">
                                {getCategoryLabel(task.category)}
                              </Badge>
                              {task.due_date && (
                                <Badge bg={isOverdue(task) ? 'danger' : 'secondary'}>
                                  <i className="far fa-clock me-1"></i>
                                  {formatDate(task.due_date)}
                                </Badge>
                              )}
                            </div>
                            {task.subtasks && task.subtasks.length > 0 && (
                              <div className="subtasks mt-3">
                                <small className="text-muted d-block mb-2">Checklist:</small>
                                {task.subtasks.map((subtask, idx) => (
                                  <Form.Check
                                    key={subtask.id || idx}
                                    type="checkbox"
                                    label={subtask.title}
                                    checked={subtask.completed}
                                    onChange={() => handleToggleSubtaskCompletion(task.id, subtask.id, !subtask.completed)}
                                    className="mb-1"
                                  />
                                ))}
                                {task.subtask_count > 0 && (
                                  <small className="text-muted">
                                    ({task.completed_subtasks || 0}/{task.subtask_count} hoàn thành)
                                  </small>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="d-flex gap-2">
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => handleEdit(task)}
                            >
                              <i className="fas fa-edit"></i>
                            </Button>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => {
                                setTaskToDelete(task);
                                setShowDeleteModal(true);
                              }}
                            >
                              <i className="fas fa-trash"></i>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                
                {/* Pagination */}
                {pagination.totalPages > 1 && (
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
              )}
          </>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{editingTask ? 'Chỉnh sửa tác vụ' : 'Tạo tác vụ mới'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Tiêu đề <span className="text-danger">*</span></Form.Label>
              <Form.Control
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Nhập tiêu đề tác vụ"
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Mô tả</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Nhập mô tả chi tiết"
              />
            </Form.Group>
            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Loại</Form.Label>
                  <Form.Select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                  >
                    <option value="work">Công việc</option>
                    <option value="reminder">Nhắc hạn</option>
                    <option value="checklist">Checklist</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Ưu tiên</Form.Label>
                  <Form.Select
                    name="priority"
                    value={formData.priority}
                    onChange={handleInputChange}
                  >
                    <option value="low">Thấp</option>
                    <option value="medium">Trung bình</option>
                    <option value="high">Cao</option>
                    <option value="urgent">Khẩn cấp</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Hạn chót</Form.Label>
                  <Form.Control
                    type="datetime-local"
                    name="due_date"
                    value={formData.due_date}
                    onChange={handleInputChange}
                  />
                </Form.Group>
              </Col>
            </Row>
            {(formData.category === 'checklist' || formData.subtasks.length > 0) && (
              <Form.Group className="mb-3">
                <Form.Label>Checklist</Form.Label>
                <div className="d-flex gap-2 mb-2">
                  <Form.Control
                    type="text"
                    value={subtaskInput}
                    onChange={(e) => setSubtaskInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSubtask();
                      }
                    }}
                    placeholder="Nhập subtask và nhấn Enter"
                  />
                  <Button variant="outline-primary" onClick={handleAddSubtask}>
                    <i className="fas fa-plus"></i>
                  </Button>
                </div>
                {formData.subtasks.length > 0 && (
                  <div className="subtasks-list">
                    {formData.subtasks.map((subtask, index) => (
                      <div key={index} className="d-flex align-items-center justify-content-between mb-2 p-2 bg-light rounded">
                        <Form.Check
                          type="checkbox"
                          label={subtask.title}
                          checked={subtask.completed}
                          onChange={() => handleToggleSubtask(index)}
                        />
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => handleRemoveSubtask(index)}
                        >
                          <i className="fas fa-times"></i>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Form.Group>
            )}
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Hủy
          </Button>
          <Button variant="primary" onClick={handleSave}>
            {editingTask ? 'Cập nhật' : 'Tạo mới'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Xác nhận xóa</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Bạn có chắc chắn muốn xóa tác vụ "{taskToDelete?.title}"? Hành động này không thể hoàn tác.
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Hủy
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Xóa
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default PersonalTasks;
