import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Button, Form, Modal, Badge, Spinner, Alert, Tabs, Tab, Nav } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import Pagination from '../../components/Pagination';
import RichTextEditor from '../../components/RichTextEditor';
import '../../styles/user.css';
import usePageTitle from '../../hooks/usePageTitle';

const Tickets = () => {
  usePageTitle('Quản lý yêu cầu hỗ trợ');
  const { currentUser } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    new_count: 0,
    assigned_count: 0,
    in_progress_count: 0,
    resolved_count: 0,
    closed_count: 0,
    urgent_count: 0,
    high_count: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketDetail, setTicketDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('new');
  const [filters, setFilters] = useState({
    status: 'all',
    category: 'all',
    assigned_to: 'all',
    search: ''
  });
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('DESC');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    totalItems: 0,
    totalPages: 0
  });
  const [assignForm, setAssignForm] = useState({
    assigned_to: ''
  });
  const [statusForm, setStatusForm] = useState({
    status: ''
  });
  const [commentText, setCommentText] = useState('');
  const [isInternalComment, setIsInternalComment] = useState(false);

  // Refs để lưu trữ dữ liệu hiện tại cho background polling
  const ticketsRef = useRef([]);
  const statsRef = useRef({});
  const ticketDetailRef = useRef(null);
  const showDetailModalRef = useRef(false);
  const selectedTicketRef = useRef(null);
  const filtersRef = useRef(filters);
  const sortByRef = useRef(sortBy);
  const sortOrderRef = useRef(sortOrder);
  const paginationRef = useRef(pagination);

  // Cập nhật refs khi state thay đổi
  useEffect(() => {
    ticketsRef.current = tickets;
  }, [tickets]);

  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    sortByRef.current = sortBy;
  }, [sortBy]);

  useEffect(() => {
    sortOrderRef.current = sortOrder;
  }, [sortOrder]);

  useEffect(() => {
    paginationRef.current = pagination;
  }, [pagination]);

  useEffect(() => {
    ticketDetailRef.current = ticketDetail;
  }, [ticketDetail]);

  useEffect(() => {
    showDetailModalRef.current = showDetailModal;
  }, [showDetailModal]);

  useEffect(() => {
    selectedTicketRef.current = selectedTicket;
  }, [selectedTicket]);

  // Fetch tickets
  const fetchTickets = async (isBackground = false) => {
    try {
      if (!isBackground) {
        setLoading(true);
        setError('');
      }
      
      // Sử dụng refs cho background polling để lấy giá trị mới nhất
      const currentFilters = isBackground ? filtersRef.current : filters;
      const currentSortBy = isBackground ? sortByRef.current : sortBy;
      const currentSortOrder = isBackground ? sortOrderRef.current : sortOrder;
      const currentPagination = isBackground ? paginationRef.current : pagination;
      
      const params = new URLSearchParams({
        page: currentPagination.page,
        limit: currentPagination.limit,
        status: currentFilters.status,
        category: currentFilters.category,
        assigned_to: currentFilters.assigned_to,
        search: currentFilters.search,
        sortBy: currentSortBy,
        sortOrder: currentSortOrder
      });

      const [ticketsResponse, statsResponse] = await Promise.all([
        api.get(`/tickets/all?${params}`),
        api.get('/tickets/stats')
      ]);

      if (ticketsResponse.data.success) {
        const newTickets = ticketsResponse.data.data;
        const newPagination = ticketsResponse.data.pagination;
        
        // So sánh dữ liệu để phát hiện thay đổi
        if (isBackground) {
          // Lấy dữ liệu hiện tại từ refs
          const currentTickets = ticketsRef.current;
          
          // Tạo hash để so sánh - chỉ so sánh các trường quan trọng
          const createTicketsHash = (ticketList) => {
            return JSON.stringify(ticketList.map(t => ({ 
              id: t.id, 
              status: t.status, 
              updated_at: t.updated_at,
              comment_count: t.comment_count || 0,
              assigned_to: t.assigned_to
            })).sort((a, b) => a.id - b.id));
          };
          
          const currentHash = createTicketsHash(currentTickets);
          const newHash = createTicketsHash(newTickets);
          
          if (currentHash !== newHash) {
            // Có thay đổi, cập nhật im lặng
            setTickets(newTickets);
            setPagination(newPagination);
            ticketsRef.current = newTickets;
          }
          
          // Cập nhật stats nếu có thay đổi
          if (statsResponse.data.success) {
            const newStats = statsResponse.data.data;
            const currentStats = statsRef.current;
            const currentStatsHash = JSON.stringify(currentStats);
            const newStatsHash = JSON.stringify(newStats);
            
            if (currentStatsHash !== newStatsHash) {
              setStats(newStats);
              statsRef.current = newStats;
            }
          }
        } else {
          // Lần đầu tải hoặc tải thủ công
          setTickets(newTickets);
          setPagination(newPagination);
          ticketsRef.current = newTickets;
          
          if (statsResponse.data.success) {
            setStats(statsResponse.data.data);
            statsRef.current = statsResponse.data.data;
          }
        }
      }
    } catch (err) {
      if (!isBackground) {
        console.error('Error fetching tickets:', err);
        setError('Không thể tải danh sách ticket');
      }
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  };

  // Fetch assignable users
  const fetchAssignableUsers = async () => {
    try {
      const response = await api.get('/tickets/assignable-users');
      if (response.data.success) {
        setAssignableUsers(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching assignable users:', err);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchTickets();
      fetchAssignableUsers();
    }
  }, [currentUser, filters, sortBy, sortOrder, pagination.page]);

  // Background polling - chỉ cập nhật khi có dữ liệu mới
  useEffect(() => {
    if (!currentUser) return;

    let pollInterval = null;
    let isPollingActive = true;

    const checkForUpdates = async () => {
      // Chỉ poll khi tab đang active
      if (document.hidden || !isPollingActive) return;

      try {
        await fetchTickets(true); // Background fetch
      } catch (error) {
        // Im lặng fail - không hiển thị lỗi khi polling
        if (process.env.NODE_ENV === 'development') {
          console.debug('Background ticket update check failed:', error);
        }
      }
    };

    // Bắt đầu polling sau 5 giây
    const initialTimeout = setTimeout(() => {
      if (isPollingActive) {
        checkForUpdates();
      }
    }, 5000);

    // Polling mỗi 10 giây
    pollInterval = setInterval(checkForUpdates, 10000);

    // Handle tab visibility changes
    const handleVisibilityChange = () => {
      if (!document.hidden && isPollingActive) {
        // Tab trở lại active, check ngay
        checkForUpdates();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isPollingActive = false;
      clearTimeout(initialTimeout);
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser]); // Chỉ phụ thuộc vào currentUser

  // Background polling cho comments khi modal đang mở
  useEffect(() => {
    if (!currentUser) return;

    let pollInterval = null;
    let isPollingActive = true;

    const checkForCommentUpdates = async () => {
      // Chỉ poll khi tab đang active và modal đang mở
      if (document.hidden || !isPollingActive) return;
      
      // Kiểm tra modal state từ ref
      if (!showDetailModalRef.current || !selectedTicketRef.current) return;

      try {
        await fetchTicketDetail(selectedTicketRef.current, true); // Background fetch
      } catch (error) {
        // Im lặng fail - không hiển thị lỗi khi polling
        if (process.env.NODE_ENV === 'development') {
          console.debug('Background comment update check failed:', error);
        }
      }
    };

    // Chỉ bắt đầu polling nếu modal đang mở
    if (showDetailModal && selectedTicket) {
      // Bắt đầu polling sau 3 giây khi modal mở
      const initialTimeout = setTimeout(() => {
        if (isPollingActive && showDetailModalRef.current) {
          checkForCommentUpdates();
        }
      }, 3000);

      // Polling mỗi 5 giây cho comments (nhanh hơn tickets vì comments thường xuyên hơn)
      pollInterval = setInterval(checkForCommentUpdates, 5000);

      // Handle tab visibility changes
      const handleVisibilityChange = () => {
        if (!document.hidden && isPollingActive && showDetailModalRef.current) {
          // Tab trở lại active, check ngay
          checkForCommentUpdates();
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        isPollingActive = false;
        clearTimeout(initialTimeout);
        if (pollInterval) {
          clearInterval(pollInterval);
        }
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [currentUser, showDetailModal, selectedTicket]); // Phụ thuộc vào modal state

  // Filter tickets by active tab
  useEffect(() => {
    let filtered = [...tickets];

    if (activeTab === 'new') {
      filtered = filtered.filter(t => t.status === 'new');
    } else if (activeTab === 'assigned') {
      filtered = filtered.filter(t => t.status === 'assigned');
    } else if (activeTab === 'in_progress') {
      filtered = filtered.filter(t => t.status === 'in_progress');
    } else if (activeTab === 'resolved') {
      filtered = filtered.filter(t => t.status === 'resolved');
    } else if (activeTab === 'closed') {
      filtered = filtered.filter(t => t.status === 'closed');
    } else if (activeTab === 'unassigned') {
      filtered = filtered.filter(t => !t.assigned_to);
    }

    setFilteredTickets(filtered);
  }, [tickets, activeTab]);

  // Fetch ticket detail
  const fetchTicketDetail = async (ticketId, isBackground = false) => {
    try {
      if (!isBackground) {
        setLoadingDetail(true);
        setError('');
      }

      const response = await api.get(`/tickets/${ticketId}`);

      if (response.data.success) {
        const newTicketDetail = response.data.data;
        
        if (isBackground) {
          // So sánh comments để phát hiện thay đổi
          const currentDetail = ticketDetailRef.current;
          if (currentDetail && currentDetail.id === ticketId) {
            // Tạo hash để so sánh comments
            const createCommentsHash = (comments) => {
              if (!comments || !Array.isArray(comments)) return '[]';
              return JSON.stringify(comments.map(c => ({
                id: c.id,
                comment: c.comment,
                created_at: c.created_at,
                user_id: c.user_id
              })).sort((a, b) => a.id - b.id));
            };
            
            const currentCommentsHash = createCommentsHash(currentDetail.comments);
            const newCommentsHash = createCommentsHash(newTicketDetail.comments);
            
            // So sánh toàn bộ ticket detail để phát hiện thay đổi status, assigned_to, etc.
            const currentDetailHash = JSON.stringify({
              status: currentDetail.status,
              assigned_to: currentDetail.assigned_to,
              updated_at: currentDetail.updated_at
            });
            const newDetailHash = JSON.stringify({
              status: newTicketDetail.status,
              assigned_to: newTicketDetail.assigned_to,
              updated_at: newTicketDetail.updated_at
            });
            
            // Cập nhật nếu có thay đổi
            if (currentCommentsHash !== newCommentsHash || currentDetailHash !== newDetailHash) {
              setTicketDetail(newTicketDetail);
              ticketDetailRef.current = newTicketDetail;
              // Cập nhật status form nếu status thay đổi
              if (currentDetail.status !== newTicketDetail.status) {
                setStatusForm({ status: newTicketDetail.status });
              }
            }
          }
        } else {
          // Lần đầu tải hoặc tải thủ công
          setTicketDetail(newTicketDetail);
          setSelectedTicket(ticketId);
          setStatusForm({ status: newTicketDetail.status });
          setShowDetailModal(true);
          ticketDetailRef.current = newTicketDetail;
        }
      }
    } catch (err) {
      if (!isBackground) {
        console.error('Error fetching ticket detail:', err);
        setError('Không thể tải chi tiết ticket');
      }
    } finally {
      if (!isBackground) {
        setLoadingDetail(false);
      }
    }
  };

  // Handle assign ticket
  const handleAssign = async () => {
    try {
      if (!assignForm.assigned_to) {
        setError('Vui lòng chọn người xử lý');
        return;
      }

      const response = await api.put(`/tickets/${selectedTicket}`, {
        assigned_to: assignForm.assigned_to
        // Status will be automatically set to 'in_progress' by backend
      });

      if (response.data.success) {
        setShowAssignModal(false);
        setSuccess('Phân công ticket thành công');
        fetchTickets();
        if (showDetailModal) {
          fetchTicketDetail(selectedTicket);
        }
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      console.error('Error assigning ticket:', err);
      setError(err.response?.data?.message || 'Không thể phân công ticket');
    }
  };

  // Handle update status
  const handleUpdateStatus = async () => {
    try {
      const response = await api.put(`/tickets/${selectedTicket}`, {
        status: statusForm.status
      });

      if (response.data.success) {
        setSuccess('Cập nhật trạng thái thành công');
        fetchTickets();
        fetchTicketDetail(selectedTicket);
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      console.error('Error updating status:', err);
      setError(err.response?.data?.message || 'Không thể cập nhật trạng thái');
    }
  };

  // Handle update ticket
  const handleUpdateTicket = async (updates) => {
    try {
      const response = await api.put(`/tickets/${selectedTicket}`, updates);

      if (response.data.success) {
        setSuccess('Cập nhật ticket thành công');
        fetchTickets();
        fetchTicketDetail(selectedTicket);
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      console.error('Error updating ticket:', err);
      setError(err.response?.data?.message || 'Không thể cập nhật ticket');
    }
  };

  // Add comment
  const handleAddComment = async () => {
    try {
      if (!commentText.trim()) {
        setError('Vui lòng nhập nội dung bình luận');
        return;
      }

      const response = await api.post(`/tickets/${selectedTicket}/comments`, {
        comment: commentText,
        is_internal: isInternalComment
      });

      if (response.data.success) {
        setCommentText('');
        setIsInternalComment(false);
        fetchTicketDetail(selectedTicket);
        setSuccess('Thêm bình luận thành công');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      console.error('Error adding comment:', err);
      setError(err.response?.data?.message || 'Không thể thêm bình luận');
    }
  };

  // Open assign modal
  const handleOpenAssign = (ticketId) => {
    setSelectedTicket(ticketId);
    setAssignForm({ assigned_to: '' });
    setShowAssignModal(true);
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
      case 'notification': return 'Thông báo';
      case 'discussion': return 'Thảo luận';
      case 'feature_request': return 'Yêu cầu tính năng';
      case 'bug_report': return 'Báo cáo lỗi';
      case 'how_to': return 'Làm thế nào để';
      case 'feedback': return 'Nhận xét';
      default: return category;
    }
  };

  // Get status label
  const getStatusLabel = (status) => {
    switch (status) {
      case 'new': return 'Mới';
      case 'assigned': return 'Đã phân công';
      case 'in_progress': return 'Đang xử lý';
      case 'resolved': return 'Đã giải quyết';
      case 'closed': return 'Đã đóng';
      case 'cancelled': return 'Đã hủy';
      default: return status;
    }
  };

  // Get status badge color
  const getStatusColor = (status) => {
    switch (status) {
      case 'new': return 'primary';
      case 'assigned': return 'info';
      case 'in_progress': return 'warning';
      case 'resolved': return 'success';
      case 'closed': return 'secondary';
      case 'cancelled': return 'danger';
      default: return 'secondary';
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('vi-VN');
  };

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
      status: 'all',
      category: 'all',
      assigned_to: 'all',
      search: ''
    });
    setSortBy('created_at');
    setSortOrder('DESC');
    setPagination(prev => ({ ...prev, page: 1 }));
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
            <h1>Ticket</h1>
            <p className="header-subtitle">Tiếp nhận, phân công, SLA</p>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <Row className="g-3 mb-4">
        <Col md={3}>
          <div className="statistics-card">
            <div className="statistics-icon text-primary">
              <i className="fas fa-ticket-alt"></i>
            </div>
            <div className="statistics-content">
              <h3>{stats.total}</h3>
              <p>Tổng ticket</p>
            </div>
          </div>
        </Col>
        <Col md={3}>
          <div className="statistics-card">
            <div className="statistics-icon text-primary">
              <i className="fas fa-plus-circle"></i>
            </div>
            <div className="statistics-content">
              <h3 className="text-primary">{stats.new_count}</h3>
              <p>Mới</p>
            </div>
          </div>
        </Col>
        <Col md={3}>
          <div className="statistics-card">
            <div className="statistics-icon text-warning">
              <i className="fas fa-spinner"></i>
            </div>
            <div className="statistics-content">
              <h3 className="text-warning">{stats.in_progress_count}</h3>
              <p>Đang xử lý</p>
            </div>
          </div>
        </Col>
        <Col md={3}>
          <div className="statistics-card">
            <div className="statistics-icon text-success">
              <i className="fas fa-check-circle"></i>
            </div>
            <div className="statistics-content">
              <h3 className="text-success">{stats.resolved_count}</h3>
              <p>Đã giải quyết</p>
            </div>
          </div>
        </Col>
      </Row>

      {/* Filters */}
      <div className="session1-list-controls mb-4">
        <div className="search1-controls">
          <Row className="g-2">
            <Col md={2}>
              <div className="mb-3">
                <input
                  type="text"
                  className="search-input"
                  placeholder="Mã, tiêu đề, người tạo..."
                  name="search"
                  value={filters.search}
                  onChange={handleFilterChange}
                />
              </div>
            </Col>
            <Col md={2}>
              <div className="mb-3">
                <select
                  className="filter-select"
                  name="status"
                  value={filters.status}
                  onChange={handleFilterChange}
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="new">Mới</option>
                  <option value="assigned">Đã phân công</option>
                  <option value="in_progress">Đang xử lý</option>
                  <option value="resolved">Đã giải quyết</option>
                  <option value="closed">Đã đóng</option>
                </select>
              </div>
            </Col>
            <Col md={2}>
              <div className="mb-3">
                <select
                  className="filter-select"
                  name="category"
                  value={filters.category}
                  onChange={handleFilterChange}
                >
                  <option value="all">Tất cả loại</option>
                  <option value="notification">Thông báo</option>
                  <option value="discussion">Thảo luận</option>
                  <option value="feature_request">Yêu cầu tính năng</option>
                  <option value="bug_report">Báo cáo lỗi</option>
                  <option value="how_to">Làm thế nào để</option>
                  <option value="feedback">Nhận xét</option>
                </select>
              </div>
            </Col>
            <Col md={2}>
              <div className="mb-3">
                <select
                  className="filter-select"
                  name="assigned_to"
                  value={filters.assigned_to}
                  onChange={handleFilterChange}
                >
                  <option value="all">Tất cả user</option>
                  <option value="unassigned">Chưa phân công</option>
                  {assignableUsers.map(user => (
                    <option key={user.id} value={user.id}>{user.full_name || user.username}</option>
                  ))}
                </select>
              </div>
            </Col>
            <Col md={2}>
              <div className="mb-3">
                <select
                  className="filter-select"
                  value={`${sortBy}_${sortOrder}`}
                  onChange={handleSortChange}
                >
                  <option value="created_at_DESC">Mới nhất</option>
                  <option value="created_at_ASC">Cũ nhất</option>
                  <option value="status_ASC">Trạng thái</option>
                </select>
              </div>
            </Col>
            <Col>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={handleClearFilters}
              >
                <i className="fas fa-times me-1"></i>
                Xóa bộ lọc
              </Button>
            </Col>
          </Row>
        </div>
      </div>

      {/* Tickets List */}
      <div className="session-table-container">
        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" />
            <p className="mt-3">Đang tải danh sách ticket...</p>
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
                        Tất cả
                      </span>
                    </Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link eventKey="new">
                      <span className="tab-title">
                        Mới
                      </span>
                    </Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link eventKey="unassigned">
                      <span className="tab-title">
                        Chưa phân công
                      </span>
                    </Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link eventKey="in_progress">
                      <span className="tab-title">
                        Đang xử lý
                      </span>
                    </Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link eventKey="resolved">
                      <span className="tab-title">
                        Đã giải quyết
                      </span>
                    </Nav.Link>
                  </Nav.Item>
                </Nav>
              </Tab.Container>
            </div>

            {filteredTickets.length === 0 ? (
              <div className="text-center py-5">
                <i className="fas fa-ticket-alt fa-4x text-muted mb-3"></i>
                <h5>Chưa có ticket nào</h5>
                <p className="text-muted">Không tìm thấy ticket phù hợp với bộ lọc</p>
              </div>
            ) : (
              <div style={{ padding: '20px' }}>
                {filteredTickets.map(ticket => (
                  <div 
                    key={ticket.id} 
                    className="session-card mb-3"
                    onClick={() => fetchTicketDetail(ticket.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="card-body-modern">
                      <div className="d-flex justify-content-between align-items-start">
                        <div className="flex-grow-1">
                          <div className="d-flex align-items-center mb-2">
                            <Badge bg="secondary" className="me-2">{ticket.ticket_code}</Badge>
                            <h5 className="mb-0">{ticket.title}</h5>
                          </div>
                          {ticket.description && (
                            <p className="text-muted mb-2">{ticket.description.substring(0, 150)}...</p>
                          )}
                          <div className="d-flex flex-wrap gap-2 mb-2">
                            <Badge bg={getStatusColor(ticket.status)}>
                              {getStatusLabel(ticket.status)}
                            </Badge>
                            <Badge bg="info">
                              {getCategoryLabel(ticket.category)}
                            </Badge>
                            <Badge bg="light" text="dark">
                              <i className="fas fa-user me-1"></i>
                              {ticket.creator_name || ticket.creator_email}
                            </Badge>
                            {ticket.assignee_name ? (
                              <Badge bg="light" text="dark">
                                <i className="fas fa-user-tie me-1"></i>
                                {ticket.assignee_name}
                              </Badge>
                            ) : (
                              <Badge bg="warning" text="dark">
                                <i className="fas fa-user-slash me-1"></i>
                                Chưa phân công
                              </Badge>
                            )}
                            {ticket.comment_count > 0 && (
                              <Badge bg="light" text="dark">
                                <i className="fas fa-comments me-1"></i>
                                {ticket.comment_count}
                              </Badge>
                            )}
                          </div>
                          <small className="text-muted">
                            <i className="far fa-clock me-1"></i>
                            Tạo: {formatDate(ticket.created_at)}
                            {ticket.updated_at !== ticket.created_at && (
                              <> | Cập nhật: {formatDate(ticket.updated_at)}</>
                            )}
                          </small>
                        </div>
                        <div className="d-flex gap-2">
                          {!ticket.assigned_to && (
                            <Button
                              variant="outline-warning"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenAssign(ticket.id);
                              }}
                            >
                              <i className="fas fa-user-plus"></i> Người xử lý
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

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

      {/* Ticket Detail Modal */}
      <Modal show={showDetailModal} onHide={() => setShowDetailModal(false)} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="fas fa-ticket-alt me-2"></i>
            Chi tiết ticket: {ticketDetail?.ticket_code}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadingDetail ? (
            <div className="text-center py-5">
              <Spinner animation="border" />
              <p className="mt-3">Đang tải thông tin...</p>
            </div>
          ) : ticketDetail ? (
            <div>
              {/* Ticket Info */}
              <div className="session-card mb-3">
                <div className="card-body-modern">
                  <Row>
                    <Col md={8}>
                      <h4>{ticketDetail.title}</h4>
                      {ticketDetail.description && (
                        <p className="text-muted">{ticketDetail.description}</p>
                      )}
                      <div className="d-flex flex-wrap gap-2 mb-3">
                        <Badge bg={getStatusColor(ticketDetail.status)}>
                          {getStatusLabel(ticketDetail.status)}
                        </Badge>
                        <Badge bg="info">
                          {getCategoryLabel(ticketDetail.category)}
                        </Badge>
                      </div>
                      {ticketDetail.error_location && (
                        <div className="mb-2">
                          <strong>Lỗi xuất hiện ở đâu:</strong> {ticketDetail.error_location}
                        </div>
                      )}
                      {ticketDetail.error_steps && (
                        <div className="mb-2">
                          <strong>Các bước để phát hiện lỗi:</strong>
                          <pre className="bg-light p-2 rounded" style={{ whiteSpace: 'pre-wrap' }}>{ticketDetail.error_steps}</pre>
                        </div>
                      )}
                      {ticketDetail.device_info && (
                        <div className="mb-2">
                          <small className="text-muted">
                            <i className="fas fa-desktop me-1"></i>
                            Thiết bị: {ticketDetail.device_info} | IP: {ticketDetail.ip_address}
                          </small>
                        </div>
                      )}
                      {ticketDetail.attachments && ticketDetail.attachments.length > 0 && (
                        <div className="mt-3">
                          <strong>Đính kèm:</strong>
                          <div className="d-flex flex-wrap gap-2 mt-2">
                            {ticketDetail.attachments.map(att => (
                              <div key={att.id}>
                                {att.attachment_type === 'image' ? (
                                  <img 
                                    src={`/api${att.file_path}`} 
                                    alt={att.file_name}
                                    style={{ maxWidth: '500px', maxHeight: '500px', cursor: 'pointer' }}
                                    onClick={() => window.open(`/api${att.file_path}`, '_blank')}
                                  />
                                ) : (
                                  <a href={`/api${att.file_path}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-primary">
                                    <i className="fas fa-file me-1"></i>
                                    {att.file_name}
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </Col>
                    <Col md={4}>
                      <div className="info-item-inline">
                        <div className="info-label">Mã ticket:</div>
                        <div className="info-value">{ticketDetail.ticket_code}</div>
                      </div>
                      <div className="info-item-inline">
                        <div className="info-label">Người tạo:</div>
                        <div className="info-value">{ticketDetail.creator_name || ticketDetail.creator_email}</div>
                      </div>
                      {ticketDetail.assignee_name ? (
                        <div className="info-item-inline">
                          <div className="info-label">Người xử lý:</div>
                          <div className="info-value">{ticketDetail.assignee_name}</div>
                        </div>
                      ) : (
                        <div className="info-item-inline">
                          <div className="info-label">Người xử lý:</div>
                          <div className="info-value text-warning">Chưa phân công</div>
                        </div>
                      )}
                      <div className="info-item-inline">
                        <div className="info-label">Ngày tạo:</div>
                        <div className="info-value">{formatDate(ticketDetail.created_at)}</div>
                      </div>
                      {ticketDetail.updated_at !== ticketDetail.created_at && (
                        <div className="info-item-inline">
                          <div className="info-label">Cập nhật:</div>
                          <div className="info-value">{formatDate(ticketDetail.updated_at)}</div>
                        </div>
                      )}
                    </Col>
                  </Row>

                  {/* Admin Actions */}
                  <Row className="mt-3">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Trạng thái</Form.Label>
                        <div className="d-flex gap-2">
                          <Form.Select
                            value={statusForm.status}
                            onChange={(e) => setStatusForm({ status: e.target.value })}
                            style={{ flex: 1 }}
                          >
                            <option value="new">Mới</option>
                            <option value="assigned">Đã phân công</option>
                            <option value="in_progress">Đang xử lý</option>
                            <option value="resolved">Đã giải quyết</option>
                            <option value="closed">Đã đóng</option>
                            <option value="cancelled">Đã hủy</option>
                          </Form.Select>
                          <Button variant="primary" onClick={handleUpdateStatus}>
                            Cập nhật
                          </Button>
                        </div>
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Người xử lý</Form.Label>
                        <div className="d-flex gap-2">
                          <Form.Select
                            value={ticketDetail.assigned_to || ''}
                            onChange={(e) => handleUpdateTicket({ assigned_to: e.target.value || null })}
                            style={{ flex: 1 }}
                          >
                            <option value="">Chưa phân công</option>
                            {assignableUsers.map(user => (
                              <option key={user.id} value={user.id}>{user.full_name || user.username}</option>
                            ))}
                          </Form.Select>
                        </div>
                      </Form.Group>
                    </Col>
                  </Row>
                </div>
              </div>

              {/* Comments Section */}
              <div className="session-card mb-3">
                <div className="card-header-modern">
                  <h6 className="mb-0">
                    <i className="fas fa-comments me-2"></i>
                    Bình luận ({ticketDetail.comments?.length || 0})
                  </h6>
                </div>
                <div className="card-body-modern">
                  {ticketDetail.comments && ticketDetail.comments.length > 0 ? (
                    <div className="comments-list">
                      {ticketDetail.comments.map(comment => (
                        <div key={comment.id} className={`mb-3 p-3 border rounded ${comment.is_internal ? 'bg-light' : ''}`}>
                          <div className="d-flex justify-content-between mb-2">
                            <div>
                              <strong>{comment.user_name || comment.user_email}</strong>
                              {comment.is_internal && (
                                <Badge bg="secondary" className="ms-2">Nội bộ</Badge>
                              )}
                            </div>
                            <small className="text-muted">{formatDate(comment.created_at)}</small>
                          </div>
                          <div 
                            className="mb-0"
                            dangerouslySetInnerHTML={{ __html: comment.comment || '' }}
                            style={{ 
                              wordBreak: 'break-word',
                              lineHeight: '1.6'
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted">Chưa có bình luận nào</p>
                  )}

                  {/* Add Comment */}
                  <div className="mt-3">
                    <Form.Group>
                      <Form.Label>Thêm bình luận</Form.Label>
                      <RichTextEditor
                        value={commentText}
                        onChange={setCommentText}
                        placeholder="Nhập bình luận của bạn..."
                      />
                    </Form.Group>
                    <Form.Check
                      type="checkbox"
                      label="Bình luận nội bộ (chỉ admin xem được)"
                      checked={isInternalComment}
                      onChange={(e) => setIsInternalComment(e.target.checked)}
                      className="mt-2"
                    />
                    <Button variant="primary" onClick={handleAddComment} className="mt-2">
                      <i className="fas fa-paper-plane me-2"></i>
                      Gửi bình luận
                    </Button>
                  </div>
        </div>
      </div>
    </div>
          ) : (
            <div className="text-center py-5">
              <p className="text-muted">Không tìm thấy thông tin ticket</p>
    </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
            Đóng
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Assign Ticket Modal */}
      <Modal show={showAssignModal} onHide={() => setShowAssignModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Phân công ticket</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label>Chọn người xử lý</Form.Label>
            <Form.Select
              value={assignForm.assigned_to}
              onChange={(e) => setAssignForm({ assigned_to: e.target.value })}
            >
              <option value="">Chọn người xử lý...</option>
              {assignableUsers.map(user => (
                <option key={user.id} value={user.id}>{user.full_name || user.username}</option>
              ))}
            </Form.Select>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAssignModal(false)}>
            Hủy
          </Button>
          <Button variant="primary" onClick={handleAssign}>
            Phân công
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default Tickets;
