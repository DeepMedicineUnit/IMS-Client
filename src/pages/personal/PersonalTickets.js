import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Button, Form, Modal, Badge, Spinner, Alert, Tabs, Tab, Nav } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import Pagination from '../../components/Pagination';
import RichTextEditor from '../../components/RichTextEditor';
import '../../styles/user.css';
import usePageTitle from '../../hooks/usePageTitle';
import { useTranslation } from 'react-i18next';

const PersonalTickets = () => {
  const { t } = useTranslation();
  usePageTitle(t('personalTickets.title'));
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
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketDetail, setTicketDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [filters, setFilters] = useState({
    status: 'all',
    category: 'all',
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
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'notification',
    error_location: '',
    error_steps: ''
  });
  const [commentText, setCommentText] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);

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
        search: currentFilters.search,
        sortBy: currentSortBy,
        sortOrder: currentSortOrder
      });

      const [ticketsResponse, statsResponse] = await Promise.all([
        api.get(`/tickets/my?${params}`),
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
        setError(t('personalTickets.errors.loadTickets'));
      }
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
    setIsCreating(false);
  };

  useEffect(() => {
    if (currentUser) {
      fetchTickets();
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
    } else if (activeTab === 'in_progress') {
      filtered = filtered.filter(t => t.status === 'in_progress' || t.status === 'assigned');
    } else if (activeTab === 'resolved') {
      filtered = filtered.filter(t => t.status === 'resolved');
    } else if (activeTab === 'closed') {
      filtered = filtered.filter(t => t.status === 'closed');
    } else if (activeTab === 'assigned_to_me') {
      filtered = filtered.filter(t => t.user_id !== currentUser?.id && t.assigned_to === currentUser?.id);
    }

    setFilteredTickets(filtered);
  }, [tickets, activeTab, currentUser]);

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
            }
          }
        } else {
          // Lần đầu tải hoặc tải thủ công
          setTicketDetail(newTicketDetail);
          setSelectedTicket(ticketId);
          setShowDetailModal(true);
          ticketDetailRef.current = newTicketDetail;
        }
      }
    } catch (err) {
      if (!isBackground) {
        console.error('Error fetching ticket detail:', err);
        setError(t('personalTickets.errors.loadDetail'));
      }
    } finally {
      if (!isBackground) {
        setLoadingDetail(false);
      }
    }
  };

  // Handle form input change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Open create modal
  const handleCreate = () => {
    setFormData({
      title: '',
      description: '',
      category: 'notification',
      error_location: '',
      error_steps: ''
    });
    setSelectedImages([]);
    setSelectedFiles([]);
    setShowModal(true);
  };

  // Handle image selection
  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    setSelectedImages(prev => [...prev, ...files]);
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  // Remove image
  const removeImage = (index) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  // Remove file
  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Save ticket (create)
  const handleSave = async () => {
    try {
      if (!formData.title.trim()) {
        setError(t('personalTickets.errors.titleRequired'));
        return;
      }

      if (!formData.category) {
        setError(t('personalTickets.errors.categoryRequired'));
        return;
      }

      setIsCreating(true);

      // Create FormData for file upload
      const formDataToSend = new FormData();
      formDataToSend.append('title', formData.title);
      formDataToSend.append('description', formData.description || '');
      formDataToSend.append('category', formData.category);
      if (formData.error_location) {
        formDataToSend.append('error_location', formData.error_location);
      }
      if (formData.error_steps) {
        formDataToSend.append('error_steps', formData.error_steps);
      }

      // Add all images and files
      [...selectedImages, ...selectedFiles].forEach((file) => {
        formDataToSend.append('attachments', file);
      });

      const response = await api.post('/tickets', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        setShowModal(false);
        setSuccess(t('personalTickets.success.ticketCreated'));
        fetchTickets();
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      console.error('Error saving ticket:', err);
      setError(err.response?.data?.message || t('personalTickets.errors.createTicket'));
    }
    setIsCreating(false);
  };

  // Add comment
  const handleAddComment = async () => {
    try {
      if (!commentText.trim()) {
        setError(t('personalTickets.errors.commentRequired'));
        return;
      }

      const response = await api.post(`/tickets/${selectedTicket}/comments`, {
        comment: commentText
      });

      if (response.data.success) {
        setCommentText('');
        fetchTicketDetail(selectedTicket);
        setSuccess(t('personalTickets.success.commentAdded'));
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      console.error('Error adding comment:', err);
      setError(err.response?.data?.message || t('personalTickets.errors.createTicket'));
    }
  };

  // Handle resolve ticket (for assigned users)
  const handleResolveTicket = async () => {
    try {
      if (!selectedTicket) return;

      const response = await api.put(`/tickets/${selectedTicket}`, {
        status: 'resolved'
      });

      if (response.data.success) {
        setSuccess(t('personalTickets.success.ticketResolved'));
        fetchTickets();
        fetchTicketDetail(selectedTicket);
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      console.error('Error resolving ticket:', err);
      setError(err.response?.data?.message || t('personalTickets.errors.createTicket'));
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
      case 'urgent': return t('personalTickets.priority.urgent');
      case 'high': return t('personalTickets.priority.high');
      case 'medium': return t('personalTickets.priority.medium');
      case 'low': return t('personalTickets.priority.low');
      default: return priority;
    }
  };

  // Get category label
  const getCategoryLabel = (category) => {
    switch (category) {
      case 'notification': return t('personalTickets.category.notification');
      case 'discussion': return t('personalTickets.category.discussion');
      case 'feature_request': return t('personalTickets.category.featureRequest');
      case 'bug_report': return t('personalTickets.category.bugReport');
      case 'how_to': return t('personalTickets.category.howTo');
      case 'feedback': return t('personalTickets.category.feedback');
      default: return category;
    }
  };

  // Render form fields based on category
  const renderFormFields = () => {
    const { category } = formData;

    switch (category) {
      case 'notification':
      case 'discussion':
        return (
          <div className="session-card mb-4">
            <div className="card-header-modern">
              <div className="header-icon">
                <i className="fas fa-align-left"></i>
              </div>
              <h6 className="mb-0">{t('personalTickets.createModal.content')}</h6>
            </div>
            <div className="card-body-modern">
              <Form.Group className="mb-3">
                <Form.Label className="info-label">
                  <i className="fas fa-file-alt me-2"></i>
                  {t('personalTickets.createModal.content')} <span className="text-danger">{t('personalTickets.createModal.categoryRequired')}</span>
                </Form.Label>
                <Form.Control
                  as="textarea"
                  rows={5}
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder={t('personalTickets.createModal.contentPlaceholder')}
                  required
                  className="form-control-modern"
                />
              </Form.Group>
            </div>
          </div>
        );

      case 'feature_request':
        return (
          <div className="session-card mb-4">
            <div className="card-header-modern">
              <div className="header-icon">
                <i className="fas fa-lightbulb"></i>
              </div>
              <h6 className="mb-0">{t('personalTickets.createModal.requestDetails')}</h6>
            </div>
            <div className="card-body-modern">
              <Form.Group className="mb-3">
                <Form.Label className="info-label">
                  <i className="fas fa-file-alt me-2"></i>
                  {t('personalTickets.createModal.content')} <span className="text-danger">{t('personalTickets.createModal.categoryRequired')}</span>
                </Form.Label>
                <Form.Control
                  as="textarea"
                  rows={5}
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder={t('personalTickets.createModal.requestDescriptionPlaceholder')}
                  required
                  className="form-control-modern"
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="info-label">
                  <i className="fas fa-image me-2"></i>
                  {t('personalTickets.createModal.illustrationImages')}
                </Form.Label>
                <Form.Control
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  className="form-control-modern"
                />
                {selectedImages.length > 0 && (
                  <div className="mt-2">
                    {selectedImages.map((img, idx) => (
                      <div key={idx} className="d-flex align-items-center mb-2">
                        <span className="me-2">{img.name}</span>
                        <Button variant="outline-danger" size="sm" onClick={() => removeImage(idx)}>
                          <i className="fas fa-times"></i>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="info-label">
                  <i className="fas fa-paperclip me-2"></i>
                  {t('personalTickets.createModal.attachments')}
                </Form.Label>
                <Form.Control
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="form-control-modern"
                />
                {selectedFiles.length > 0 && (
                  <div className="mt-2">
                    {selectedFiles.map((file, idx) => (
                      <div key={idx} className="d-flex align-items-center mb-2">
                        <span className="me-2">{file.name}</span>
                        <Button variant="outline-danger" size="sm" onClick={() => removeFile(idx)}>
                          <i className="fas fa-times"></i>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Form.Group>
            </div>
          </div>
        );

      case 'bug_report':
        return (
          <div className="session-card mb-4">
            <div className="card-header-modern">
              <div className="header-icon">
                <i className="fas fa-bug"></i>
              </div>
              <h6 className="mb-0">{t('personalTickets.createModal.bugDetails')}</h6>
            </div>
            <div className="card-body-modern">
              <Form.Group className="mb-3">
                <Form.Label className="info-label">
                  <i className="fas fa-map-marker-alt me-2"></i>
                  {t('personalTickets.createModal.errorLocation')} <span className="text-danger">{t('personalTickets.createModal.errorLocationRequired')}</span>
                </Form.Label>
                <Form.Control
                  type="text"
                  name="error_location"
                  value={formData.error_location}
                  onChange={handleInputChange}
                  placeholder={t('personalTickets.createModal.errorLocationPlaceholder')}
                  required
                  className="form-control-modern"
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="info-label">
                  <i className="fas fa-file-alt me-2"></i>
                  {t('personalTickets.createModal.errorDescription')} <span className="text-danger">{t('personalTickets.createModal.errorDescriptionRequired')}</span>
                </Form.Label>
                <Form.Control
                  as="textarea"
                  rows={4}
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder={t('personalTickets.createModal.errorDescriptionPlaceholder')}
                  required
                  className="form-control-modern"
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="info-label">
                  <i className="fas fa-list-ol me-2"></i>
                  {t('personalTickets.createModal.errorSteps')} <span className="text-danger">{t('personalTickets.createModal.errorStepsRequired')}</span>
                </Form.Label>
                <Form.Control
                  as="textarea"
                  rows={4}
                  name="error_steps"
                  value={formData.error_steps}
                  onChange={handleInputChange}
                  placeholder={t('personalTickets.createModal.errorStepsPlaceholder')}
                  required
                  className="form-control-modern"
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="info-label">
                  <i className="fas fa-camera me-2"></i>
                  {t('personalTickets.createModal.screenshots')}
                </Form.Label>
                <Form.Control
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files);
                    setSelectedImages(prev => [...prev, ...files.filter(f => f.type.startsWith('image/'))]);
                    setSelectedFiles(prev => [...prev, ...files.filter(f => f.type.startsWith('video/'))]);
                  }}
                  className="form-control-modern"
                />
                {selectedImages.length > 0 && (
                  <div className="mt-2">
                    <small className="text-muted">{t('personalTickets.createModal.images')}</small>
                    {selectedImages.map((img, idx) => (
                      <div key={idx} className="d-flex align-items-center mb-2">
                        <span className="me-2">{img.name}</span>
                        <Button variant="outline-danger" size="sm" onClick={() => removeImage(idx)}>
                          <i className="fas fa-times"></i>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {selectedFiles.length > 0 && (
                  <div className="mt-2">
                    <small className="text-muted">{t('personalTickets.createModal.videos')}</small>
                    {selectedFiles.map((file, idx) => (
                      <div key={idx} className="d-flex align-items-center mb-2">
                        <span className="me-2">{file.name}</span>
                        <Button variant="outline-danger" size="sm" onClick={() => removeFile(idx)}>
                          <i className="fas fa-times"></i>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Form.Group>
            </div>
          </div>
        );

      case 'how_to':
      case 'feedback':
        return (
          <div className="session-card mb-4">
            <div className="card-header-modern">
              <div className="header-icon">
                <i className={category === 'how_to' ? 'fas fa-question-circle' : 'fas fa-comment-dots'}></i>
              </div>
              <h6 className="mb-0">{category === 'how_to' ? t('personalTickets.createModal.questionDetails') : t('personalTickets.createModal.feedbackDetails')}</h6>
            </div>
            <div className="card-body-modern">
              <Form.Group className="mb-3">
                <Form.Label className="info-label">
                  <i className="fas fa-file-alt me-2"></i>
                  {t('personalTickets.createModal.content')} <span className="text-danger">{t('personalTickets.createModal.categoryRequired')}</span>
                </Form.Label>
                <Form.Control
                  as="textarea"
                  rows={5}
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder={t('personalTickets.createModal.contentPlaceholder')}
                  required
                  className="form-control-modern"
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="info-label">
                  <i className="fas fa-image me-2"></i>
                  {t('personalTickets.createModal.imagesOptional')}
                </Form.Label>
                <Form.Control
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  className="form-control-modern"
                />
                {selectedImages.length > 0 && (
                  <div className="mt-2">
                    {selectedImages.map((img, idx) => (
                      <div key={idx} className="d-flex align-items-center mb-2">
                        <span className="me-2">{img.name}</span>
                        <Button variant="outline-danger" size="sm" onClick={() => removeImage(idx)}>
                          <i className="fas fa-times"></i>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Form.Group>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Get status label
  const getStatusLabel = (status) => {
    switch (status) {
      case 'new': return t('personalTickets.status.new');
      case 'assigned': return t('personalTickets.status.assigned');
      case 'in_progress': return t('personalTickets.status.inProgress');
      case 'resolved': return t('personalTickets.status.resolved');
      case 'closed': return t('personalTickets.status.closed');
      case 'cancelled': return t('personalTickets.status.cancelled');
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
    if (!dateString) return t('personalTickets.na');
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
            <h1>{t('personalTickets.headerTitle')}</h1>
            <p className="header-subtitle">{t('personalTickets.headerSubtitle')}</p>
          </div>
          <div className="header-actions">
            <Button variant="outline-light" className="create-session-btn" onClick={handleCreate}>
              <i className="fas fa-plus me-2"></i>
              {t('personalTickets.createNew')}
            </Button>
          </div>
        </div>
      </div>


      {/* Filters */}
      <div className="session1-list-controls mb-4">
        <div className="search1-controls">
          <Row className="g-2">
            <Col md={2}>
              <div className="mb-2">
                <Form.Label>{t('personalTickets.filters.search')}</Form.Label>
                <input
                  type="text"
                  className="search-input"
                  placeholder={t('personalTickets.filters.searchPlaceholder')}
                  name="search"
                  value={filters.search}
                  onChange={handleFilterChange}
                />
              </div>
            </Col>
            <Col md={2}>
              <div className="mb-2">
                <Form.Label>{t('personalTickets.filters.category')}</Form.Label>
                <select
                  className="filter-select"
                  name="category"
                  value={filters.category}
                  onChange={handleFilterChange}
                >
                  <option value="all">{t('personalTickets.filters.all')}</option>
                  <option value="notification">{t('personalTickets.category.notification')}</option>
                  <option value="discussion">{t('personalTickets.category.discussion')}</option>
                  <option value="feature_request">{t('personalTickets.category.featureRequest')}</option>
                  <option value="bug_report">{t('personalTickets.category.bugReport')}</option>
                  <option value="how_to">{t('personalTickets.category.howTo')}</option>
                  <option value="feedback">{t('personalTickets.category.feedback')}</option>
                </select>
              </div>
            </Col>
            <Col md={2}>
              <div className="mb-2">
                <Form.Label>{t('personalTickets.filters.sort')}</Form.Label>
                <select
                  className="filter-select"
                  value={`${sortBy}_${sortOrder}`}
                  onChange={handleSortChange}
                >
                  <option value="created_at_DESC">{t('personalTickets.filters.newest')}</option>
                  <option value="created_at_ASC">{t('personalTickets.filters.oldest')}</option>
                  <option value="status_ASC">{t('personalTickets.filters.byStatus')}</option>
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
                  {t('personalTickets.filters.clearFilters')}
                </Button>
              </div>
            </Col>
          </Row>
        </div>
      </div>

      {/* Tickets List */}
      <div className="session-table-container">
        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" />
            <p className="mt-3">{t('personalTickets.loading')}</p>
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
                        {t('personalTickets.tabs.all')} ({tickets.length})
                      </span>
                    </Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link eventKey="new">
                      <span className="tab-title">
                        {t('personalTickets.tabs.new')} ({stats.new_count || 0})
                      </span>
                    </Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link eventKey="in_progress">
                      <span className="tab-title">
                        {t('personalTickets.tabs.inProgress')} ({Number(stats.in_progress_count || 0) + Number(stats.assigned_count || 0)})
                      </span>
                    </Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link eventKey="resolved">
                      <span className="tab-title">
                        {t('personalTickets.tabs.resolved')} ({stats.resolved_count || 0})
                      </span>
                    </Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link eventKey="closed">
                      <span className="tab-title">
                        {t('personalTickets.tabs.closed')} ({stats.closed_count || 0})
                      </span>
                    </Nav.Link>
                  </Nav.Item>
                  <Nav.Item>
                    <Nav.Link eventKey="assigned_to_me">
                      <span className="tab-title">
                        {t('personalTickets.tabs.assignedToMe')} ({tickets.filter(t => t.user_id !== currentUser?.id && t.assigned_to === currentUser?.id).length})
                      </span>
                    </Nav.Link>
                  </Nav.Item>
                </Nav>
              </Tab.Container>
            </div>

            {filteredTickets.length === 0 ? (
              <div className="text-center py-5">
                <i className="fas fa-ticket-alt fa-4x text-muted mb-3"></i>
                <h5>{t('personalTickets.noTickets')}</h5>
                <p className="text-muted">{t('personalTickets.noTicketsDescription')}</p>
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
                            {ticket.user_id !== currentUser?.id && ticket.assigned_to === currentUser?.id && (
                              <Badge bg="warning" text="dark">
                                <i className="fas fa-hand-paper me-1"></i>
                                {t('personalTickets.badges.assigned')}
                              </Badge>
                            )}
                            {ticket.user_id === currentUser?.id && (
                              <Badge bg="primary">
                                <i className="fas fa-user me-1"></i>
                                {t('personalTickets.badges.createdByMe')}
                              </Badge>
                            )}
                            {ticket.assigned_to === currentUser?.id && ticket.user_id !== currentUser?.id ? (
                              <Badge bg="light" text="dark">
                                <i className="fas fa-user me-1"></i>
                                {ticket.creator_name || ticket.creator_email}
                              </Badge>
                            ) : ticket.assignee_name && ticket.assigned_to !== currentUser?.id ? (
                              <Badge bg="light" text="dark">
                                <i className="fas fa-user-tie me-1"></i>
                                {ticket.assignee_name}
                              </Badge>
                            ) : null}
                            {ticket.comment_count > 0 && (
                              <Badge bg="light" text="dark">
                                <i className="fas fa-comments me-1"></i>
                                {ticket.comment_count}
                              </Badge>
                            )}
                          </div>
                          <small className="text-muted">
                            <i className="far fa-clock me-1"></i>
                            {t('personalTickets.labels.created')}: {formatDate(ticket.created_at)}
                            {ticket.updated_at !== ticket.created_at && (
                              <> | {t('personalTickets.labels.updated')}: {formatDate(ticket.updated_at)}</>
                            )}
                          </small>
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

      {/* Create Ticket Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="xl" className="student-detail-modal">
        <Modal.Header closeButton className="student-detail-header">
          <Modal.Title className="student-detail-title">
            <div className="student-avatar">
              <i className="fas fa-ticket-alt"></i>
            </div>
            <div>
              <h4 className="mb-0">{t('personalTickets.createModal.title')}</h4>
              <p className="mb-0 student-subtitle">{t('personalTickets.createModal.subtitle')}</p>
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="student-detail-body">
          <div className="student-detail-container">
            <Form>
              {/* Basic Information Card */}
              <div className="session-card mb-4">
                <div className="card-header-modern">
                  <div className="header-icon">
                    <i className="fas fa-info-circle"></i>
                  </div>
                  <h6 className="mb-0">{t('personalTickets.createModal.basicInfo')}</h6>
                </div>
                <div className="card-body-modern">
                  <Row>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label className="info-label">
                          <i className="fas fa-tag me-2"></i>
                          {t('personalTickets.createModal.categoryLabel')} <span className="text-danger">{t('personalTickets.createModal.categoryRequired')}</span>
                        </Form.Label>
                        <Form.Select
                          name="category"
                          value={formData.category}
                          onChange={(e) => {
                            handleInputChange(e);
                            // Reset form fields when category changes
                            setFormData(prev => ({
                              ...prev,
                              category: e.target.value,
                              error_location: '',
                              error_steps: '',
                              description: ''
                            }));
                            setSelectedImages([]);
                            setSelectedFiles([]);
                          }}
                          required
                          className="form-control-modern"
                        >
                          <option value="notification">{t('personalTickets.category.notification')}</option>
                          <option value="discussion">{t('personalTickets.category.discussion')}</option>
                          <option value="feature_request">{t('personalTickets.category.featureRequest')}</option>
                          <option value="bug_report">{t('personalTickets.category.bugReport')}</option>
                          <option value="how_to">{t('personalTickets.category.howTo')}</option>
                          <option value="feedback">{t('personalTickets.category.feedback')}</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                    <Col md={12}>
                      <Form.Group className="mb-3">
                        <Form.Label className="info-label">
                          <i className="fas fa-heading me-2"></i>
                          {t('personalTickets.createModal.titleLabel')} <span className="text-danger">{t('personalTickets.createModal.titleRequired')}</span>
                        </Form.Label>
                        <Form.Control
                          type="text"
                          name="title"
                          value={formData.title}
                          onChange={handleInputChange}
                          placeholder={t('personalTickets.createModal.titlePlaceholder')}
                          required
                          className="form-control-modern"
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                </div>
              </div>

              {/* Category-specific fields */}
              {renderFormFields()}
            </Form>
          </div>
        </Modal.Body>
        <Modal.Footer className="student-detail-footer">
          <Button variant="outline-secondary" onClick={() => setShowModal(false)} className="btn-cancel">
            <i className="fas fa-times me-2"></i>
            {t('personalTickets.createModal.cancel')}
          </Button>
          <Button variant="primary" onClick={handleSave} className="btn-edit" disabled={isCreating}>
            {isCreating ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                {t('personalTickets.createModal.creating')}
              </>
            ) : (
              <>
                <i className="fas fa-plus me-2"></i>
                {t('personalTickets.createModal.create')}
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Ticket Detail Modal */}
      <Modal show={showDetailModal} onHide={() => setShowDetailModal(false)} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="fas fa-ticket-alt me-2"></i>
            {t('personalTickets.detailModal.title')}: {ticketDetail?.ticket_code}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadingDetail ? (
            <div className="text-center py-5">
              <Spinner animation="border" />
              <p className="mt-3">{t('personalTickets.loadingDetail')}</p>
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
                          <strong>{t('personalTickets.detailModal.errorLocation')}</strong> {ticketDetail.error_location}
                        </div>
                      )}
                      {ticketDetail.error_steps && (
                        <div className="mb-2">
                          <strong>{t('personalTickets.detailModal.errorSteps')}</strong>
                          <pre className="bg-light p-2 rounded" style={{ whiteSpace: 'pre-wrap' }}>{ticketDetail.error_steps}</pre>
                        </div>
                      )}
                      {ticketDetail.device_info && (
                        <div className="mb-2">
                          <small className="text-muted">
                            <i className="fas fa-desktop me-1"></i>
                            {t('personalTickets.detailModal.deviceInfo')}: {ticketDetail.device_info} | IP: {ticketDetail.ip_address}
                          </small>
                        </div>
                      )}
                      {ticketDetail.attachments && ticketDetail.attachments.length > 0 && (
                        <div className="mt-3">
                          <strong>{t('personalTickets.detailModal.attachments')}</strong>
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
                        <div className="info-label">{t('personalTickets.labels.ticketCode')}:</div>
                        <div className="info-value">{ticketDetail.ticket_code}</div>
                      </div>
                      <div className="info-item-inline">
                        <div className="info-label">{t('personalTickets.labels.creator')}:</div>
                        <div className="info-value">{ticketDetail.creator_name || ticketDetail.creator_email}</div>
                      </div>
                      {ticketDetail.assigned_to === currentUser?.id && ticketDetail.user_id !== currentUser?.id ? (
                        <div className="info-item-inline">
                          <div className="info-label">{t('personalTickets.labels.assignee')}:</div>
                          <div className="info-value text-success">{t('personalTickets.labels.me')}</div>
                        </div>
                      ) : ticketDetail.assignee_name && ticketDetail.assigned_to !== currentUser?.id ? (
                        <div className="info-item-inline">
                          <div className="info-label">{t('personalTickets.labels.assignee')}:</div>
                          <div className="info-value">{ticketDetail.assignee_name}</div>
                        </div>
                      ) : null}
                      <div className="info-item-inline">
                        <div className="info-label">{t('personalTickets.labels.createdAt')}:</div>
                        <div className="info-value">{formatDate(ticketDetail.created_at)}</div>
                      </div>
                      {ticketDetail.updated_at !== ticketDetail.created_at && (
                        <div className="info-item-inline">
                          <div className="info-label">{t('personalTickets.labels.updatedAt')}:</div>
                          <div className="info-value">{formatDate(ticketDetail.updated_at)}</div>
                        </div>
                      )}
                    </Col>
                  </Row>
                </div>
              </div>

              {/* Comments Section */}
              <div className="session-card mb-3">
                <div className="card-header-modern">
                  <h6 className="mb-0">
                    <i className="fas fa-comments me-2"></i>
                    {t('personalTickets.detailModal.comments')} ({ticketDetail.comments?.length || 0})
                  </h6>
                </div>
                <div className="card-body-modern">
                  {ticketDetail.comments && ticketDetail.comments.length > 0 ? (
                    <div className="comments-list">
                      {ticketDetail.comments.map(comment => (
                        <div key={comment.id} className="mb-3 p-3 border rounded">
                          <div className="d-flex justify-content-between mb-2">
                            <strong>{comment.user_name || comment.user_email}</strong>
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
                    <p className="text-muted">{t('personalTickets.detailModal.noComments')}</p>
                  )}

                  {/* Add Comment */}
                  <div className="mt-3">
                    <Form.Group>
                      <Form.Label>{t('personalTickets.detailModal.addComment')}</Form.Label>
                      <RichTextEditor
                        value={commentText}
                        onChange={setCommentText}
                        placeholder={t('personalTickets.detailModal.commentPlaceholder')}
                      />
                    </Form.Group>
                    <Button variant="primary" onClick={handleAddComment} className="mt-2">
                      <i className="fas fa-paper-plane me-2"></i>
                      {t('personalTickets.detailModal.sendComment')}
                    </Button>
                  </div>
        </div>
      </div>
    </div>
          ) : (
            <div className="text-center py-5">
              <p className="text-muted">{t('personalTickets.detailModal.notFound')}</p>
    </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          {ticketDetail && 
            ticketDetail.assigned_to === currentUser?.id && 
            ticketDetail.user_id !== currentUser?.id && 
            ticketDetail.status !== 'resolved' && 
            ticketDetail.status !== 'closed' && (
              <Button 
                variant="success" 
                onClick={handleResolveTicket}
              >
                <i className="fas fa-check-circle me-2"></i>
                {t('personalTickets.detailModal.resolve')}
              </Button>
            )}
          <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
            {t('personalTickets.detailModal.close')}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default PersonalTickets;





