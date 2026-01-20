import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert, Badge, Table, Nav, Tab } from 'react-bootstrap';
import { useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import Pagination from '../../components/Pagination';
import '../../styles/user.css';
import './Documents.css';
import usePageTitle from '../../hooks/usePageTitle';

const Documents = () => {
  usePageTitle('Quản lý giấy tờ');
  const [searchParams, setSearchParams] = useSearchParams();
  const [documents, setDocuments] = useState([]);
  const [routingSteps, setRoutingSteps] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'list');
  const [filter, setFilter] = useState({ type: '', status: '', search: '', owner_id: '' });
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [jobTitles, setJobTitles] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRoutingModal, setShowRoutingModal] = useState(false);
  const [showCreateRoutingForm, setShowCreateRoutingForm] = useState(false);
  const [documentForm, setDocumentForm] = useState({
    document_type: '',
    custom_document_type: '',
    purpose: '',
    source: '',
    file: null
  });
  const [showCustomTypeInput, setShowCustomTypeInput] = useState(false);
  const [routingForm, setRoutingForm] = useState({
    route_name: '',
    assignment_type: 'user', // 'user' or 'job_title'
    assigned_to: '',
    assigned_by_job_title: '',
    department: '',
    due_date: '',
    notes: '',
    parent_route_id: null
  });
  const [alert, setAlert] = useState({ show: false, message: '', variant: 'success' });
  const [pendingSignatures, setPendingSignatures] = useState([]);
  const [allSignatures, setAllSignatures] = useState([]); // All signatures for approval tab
  const [loadingSignatures, setLoadingSignatures] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalItems: 0,
    totalPages: 0
  });

  // Update activeTab when URL parameter changes
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['list', 'signatures'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchDocuments();
    fetchUsers();
    fetchDepartments();
    fetchDocumentTypes();
    fetchJobTitles();
  }, [filter]);

  // Update pagination when documents change
  useEffect(() => {
    const totalItems = documents.length;
    const totalPages = Math.ceil(totalItems / pagination.limit);
    setPagination(prev => ({
      ...prev,
      totalItems,
      totalPages,
      page: prev.page > totalPages && totalPages > 0 ? totalPages : prev.page
    }));
  }, [documents, pagination.limit]);

  useEffect(() => {
    if (activeTab === 'signatures') {
      fetchAllSignatures(); // Fetch all signatures instead of only pending
    }
  }, [activeTab]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter.type) params.append('type', filter.type);
      if (filter.status) params.append('status', filter.status);
      if (filter.search) params.append('search', filter.search);
      if (filter.owner_id) params.append('owner_id', filter.owner_id);

      const response = await api.get(`/documents/all?${params.toString()}`);
      setDocuments(response.data.documents || []);
    } catch (error) {
      showAlert('Lỗi khi tải danh sách giấy tờ', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      // Lấy tất cả users, KHÔNG bao gồm sinh viên
      // Chỉ lấy admin, staff, superadmin
      const response = await api.get('/users?limit=10000&approved=true');
      console.log('Users API response:', response.data);
      
      // Response structure từ userController.getUsers là { success: true, data: [...], pagination: {...} }
      const allUsers = response.data.data || response.data.users || [];
      
      // Lọc bỏ sinh viên, chỉ giữ lại admin, staff, superadmin
      const users = allUsers.filter(user => 
        user.role && 
        ['superadmin', 'admin', 'staff'].includes(user.role)
      );
      
      console.log('Total users:', allUsers.length);
      console.log('Filtered users (excluding students):', users.length);
      
      // Sắp xếp: superadmin, admin, staff
      const sortedUsers = [...users].sort((a, b) => {
        const roleOrder = { 'superadmin': 0, 'admin': 1, 'staff': 2 };
        const orderA = roleOrder[a.role] !== undefined ? roleOrder[a.role] : 3;
        const orderB = roleOrder[b.role] !== undefined ? roleOrder[b.role] : 3;
        if (orderA !== orderB) return orderA - orderB;
        // Nếu cùng role, sắp xếp theo tên
        return (a.full_name || a.username || '').localeCompare(b.full_name || b.username || '');
      });
      
      setUsers(sortedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      showAlert('Lỗi khi tải danh sách người dùng', 'danger');
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/hr-profiles/departments');
      if (response.data.success && response.data.data) {
        setDepartments(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
      // Không hiển thị alert vì đây không phải lỗi nghiêm trọng
    }
  };

  const fetchDocumentTypes = async () => {
    try {
      const response = await api.get('/documents/types');
      if (response.data.success) {
        // Backend returns document_types, not documentTypes
        setDocumentTypes(response.data.documentTypes || response.data.document_types || []);
      }
    } catch (error) {
      console.error('Error fetching document types:', error);
      showAlert('Lỗi khi tải danh sách loại giấy tờ', 'danger');
    }
  };

  const fetchJobTitles = async () => {
    try {
      const response = await api.get('/hr-profiles/job-titles');
      if (response.data.success && response.data.data) {
        setJobTitles(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching job titles:', error);
      // Không hiển thị alert vì đây không phải lỗi nghiêm trọng
    }
  };

  const fetchDocumentRouting = async (documentId) => {
    try {
      const response = await api.get(`/documents/routing/${documentId}`);
      const tree = response.data.routing_tree || [];
      // Flatten tree to sequential steps for timeline view
      const flattenedSteps = flattenRoutingTree(tree);
      setRoutingSteps(flattenedSteps);
    } catch (error) {
      showAlert('Lỗi khi tải phân luồng giấy tờ', 'danger');
    }
  };

  // Flatten tree structure to sequential steps
  const flattenRoutingTree = (tree) => {
    const steps = [];
    
    const traverse = (nodes, parentStep = null) => {
      nodes.forEach((node, index) => {
        const step = {
          ...node,
          stepNumber: steps.length + 1,
          parentStep: parentStep,
          isFirst: index === 0,
          isLast: index === nodes.length - 1
        };
        steps.push(step);
        
        if (node.children && node.children.length > 0) {
          traverse(node.children, step.stepNumber);
        }
      });
    };
    
    traverse(tree);
    return steps;
  };

  const showAlert = (message, variant = 'success') => {
    setAlert({ show: true, message, variant });
    setTimeout(() => setAlert({ show: false, message: '', variant: 'success' }), 5000);
  };

  const handleCreateRouting = async (e) => {
    e.preventDefault();
    try {
      await api.post('/documents/routing', {
        document_id: selectedDocument.id,
        ...routingForm
      });

      showAlert('Tạo phân luồng thành công', 'success');
      setShowCreateRoutingForm(false);
      setRoutingForm({
        route_name: '',
        assignment_type: 'user',
        assigned_to: '',
        assigned_by_job_title: '',
        department: '',
        due_date: '',
        notes: '',
        parent_route_id: null
      });
      fetchDocumentRouting(selectedDocument.id);
    } catch (error) {
      showAlert(error.response?.data?.message || 'Lỗi khi tạo phân luồng', 'danger');
    }
  };

  const handleUpdateRoutingStatus = async (routeId, status, progress) => {
    try {
      await api.put(`/documents/routing/${routeId}`, {
        status,
        progress_percentage: progress
      });

      showAlert('Cập nhật phân luồng thành công', 'success');
      fetchDocumentRouting(selectedDocument.id);
    } catch (error) {
      showAlert(error.response?.data?.message || 'Lỗi khi cập nhật phân luồng', 'danger');
    }
  };

  const handleDeleteRoutingStep = async (routeId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bước phân luồng này? Nếu bước này có bước con, bạn cần xóa các bước con trước.')) {
      return;
    }

    try {
      await api.delete(`/documents/routing/${routeId}`);
      showAlert('Xóa bước phân luồng thành công', 'success');
      fetchDocumentRouting(selectedDocument.id);
    } catch (error) {
      showAlert(error.response?.data?.message || 'Lỗi khi xóa bước phân luồng', 'danger');
    }
  };

  const fetchPendingSignatures = async () => {
    try {
      setLoadingSignatures(true);
      const response = await api.get('/documents/signatures/pending');
      if (response.data.success) {
        setPendingSignatures(response.data.signatures || []);
      }
    } catch (error) {
      console.error('Error fetching pending signatures:', error);
      if (error.response?.status === 403) {
        showAlert('Bạn không có quyền truy cập tính năng này', 'danger');
      } else {
        showAlert('Lỗi khi tải danh sách chữ ký chờ phê duyệt', 'danger');
      }
    } finally {
      setLoadingSignatures(false);
    }
  };

  const fetchAllSignatures = async () => {
    try {
      setLoadingSignatures(true);
      const response = await api.get('/documents/signatures/all');
      if (response.data.success) {
        setAllSignatures(response.data.signatures || []);
      }
    } catch (error) {
      console.error('Error fetching all signatures:', error);
      if (error.response?.status === 403) {
        showAlert('Bạn không có quyền truy cập tính năng này', 'danger');
      } else {
        showAlert('Lỗi khi tải danh sách chữ ký', 'danger');
      }
    } finally {
      setLoadingSignatures(false);
    }
  };

  const handleApproveSignature = async (signatureId, action) => {
    const actionText = action === 'approve' ? 'phê duyệt' : 'từ chối';
    if (!window.confirm(`Bạn có chắc chắn muốn ${actionText} chữ ký này?`)) {
      return;
    }

    try {
      await api.post('/documents/signatures/approve', {
        signature_id: signatureId,
        action: action
      });
      showAlert(
        action === 'approve' ? 'Phê duyệt chữ ký thành công' : 'Từ chối chữ ký thành công',
        'success'
      );
      fetchAllSignatures(); // Refresh all signatures after approval
    } catch (error) {
      showAlert(error.response?.data?.message || `Lỗi khi ${actionText} chữ ký`, 'danger');
    }
  };

  const getSignatureStatusBadge = (status) => {
    const badges = {
      'pending': { variant: 'warning', text: 'Chờ xác thực', color: '#ffc107' },
      'verified': { variant: 'info', text: 'Chờ phê duyệt', color: '#0dcaf0' },
      'active': { variant: 'success', text: 'Đã kích hoạt', color: '#198754' },
      'rejected': { variant: 'danger', text: 'Đã từ chối', color: '#dc3545' }
    };
    const badge = badges[status] || { variant: 'secondary', text: status, color: '#6c757d' };
    return (
      <Badge bg={badge.variant} style={{ backgroundColor: badge.color }}>
        {badge.text}
      </Badge>
    );
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { variant: 'warning', text: 'Chờ xử lý', color: '#ffc107' },
      in_progress: { variant: 'info', text: 'Đang xử lý', color: '#0dcaf0' },
      approved: { variant: 'success', text: 'Đã phê duyệt', color: '#198754' },
      rejected: { variant: 'danger', text: 'Từ chối', color: '#dc3545' },
      completed: { variant: 'primary', text: 'Hoàn thành', color: '#0d6efd' }
    };
    const badge = badges[status] || { variant: 'secondary', text: status, color: '#6c757d' };
    return <Badge bg={badge.variant} style={{ backgroundColor: badge.color }}>{badge.text}</Badge>;
  };

  const getTypeText = (type) => {
    const docType = documentTypes.find(t => t.value === type);
    return docType ? docType.label : type;
  };

  const handleCreateDocument = async (e) => {
    e.preventDefault();
    try {
      const formDataToSend = new FormData();
      // Use custom type if provided, otherwise use selected type
      const finalDocumentType = showCustomTypeInput && documentForm.custom_document_type 
        ? documentForm.custom_document_type.trim() 
        : documentForm.document_type;
      
      if (!finalDocumentType) {
        showAlert('Vui lòng chọn hoặc nhập loại giấy tờ', 'warning');
        return;
      }
      
      formDataToSend.append('document_type', finalDocumentType);
      formDataToSend.append('purpose', documentForm.purpose);
      formDataToSend.append('source', documentForm.source);
      formDataToSend.append('is_template', 'true'); // Mark as template
      if (documentForm.file) formDataToSend.append('file', documentForm.file);

      const response = await api.post('/documents', formDataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      showAlert('Tạo giấy tờ thành công', 'success');
      setShowCreateModal(false);
      setDocumentForm({
        document_type: '',
        custom_document_type: '',
        purpose: '',
        source: '',
        file: null
      });
      setShowCustomTypeInput(false);
      fetchDocuments();
      
      // Tự động chuyển sang tab phân luồng và chọn giấy tờ vừa tạo
      if (response.data.document) {
        setSelectedDocument({ id: response.data.document.id });
        setActiveTab('routing');
      }
    } catch (error) {
      showAlert(error.response?.data?.message || 'Lỗi khi tạo giấy tờ', 'danger');
    }
  };

  // Group document types by category
  const groupedDocumentTypes = documentTypes.reduce((acc, docType) => {
    if (!acc[docType.category]) {
      acc[docType.category] = [];
    }
    acc[docType.category].push(docType);
    return acc;
  }, {});

  // Get category label
  const getCategoryLabel = (category) => {
    const categoryMap = {
      'hoc_sinh_sinh_vien': 'Học sinh/Sinh viên',
      'doanh_nghiep': 'Doanh nghiệp',
      'van_ban_hanh_chinh': 'Văn bản hành chính',
      'other': 'Khác'
    };
    return categoryMap[category] || category;
  };

  // Render routing step in timeline (modern design)
  const renderRoutingStep = (step, index) => {
    return (
      <div 
        key={step.id} 
        className="routing-timeline-step"
        data-step-number={step.stepNumber || index + 1}
      >
        <div className="routing-step-card">
          <div className="step-header">
            <div className="step-title-section">
              <h5 className="step-name">
                {step.route_name}
              </h5>
              {step.department && (
                <div className="step-meta">
                  <span className="step-department">
                    <i className="fas fa-building"></i> {step.department}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="step-body">
            <div className="step-info-list">
              <div className="step-info-item">
                <i className="fas fa-user"></i>
                <span>
                  {step.assigned_to_name || step.assigned_to_username 
                    ? (step.assigned_to_name || step.assigned_to_username)
                    : step.assigned_by_job_title 
                      ? `Chức vụ: ${step.assigned_by_job_title}`
                      : 'Chưa phân công'}
                </span>
              </div>
              {step.notes && (
                <div className="step-info-item">
                  <i className="fas fa-info-circle"></i>
                  <span>{step.notes}</span>
                </div>
              )}
            </div>
          </div>
          <div className="step-actions">
            <Button
              variant="outline-primary"
              size="sm"
              onClick={() => {
                  setRoutingForm({
                    route_name: '',
                    assignment_type: 'user',
                    assigned_to: '',
                    assigned_by_job_title: '',
                    department: '',
                    due_date: '',
                    notes: '',
                    parent_route_id: step.id
                  });
                  setShowCreateRoutingForm(true);
              }}
            >
              <i className="fas fa-plus"></i> Thêm bước tiếp theo
            </Button>
            <Button
              variant="outline-danger"
              size="sm"
              onClick={() => handleDeleteRoutingStep(step.id)}
            >
              <i className="fas fa-trash"></i> Xóa
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Mẫu giấy tờ & Phân luồng</h1>
            <p className="header-subtitle">Tạo mẫu giấy tờ và thiết lập phân luồng duyệt</p>
          </div>
          <div className="header-actions">
            <Button
              variant="light"
              onClick={() => setShowCreateModal(true)}
              className="create-session-btn"
            >
              <i className="fas fa-plus"></i> Tạo mẫu giấy tờ mới
            </Button>
          </div>
        </div>
      </div>

      {alert.show && (
        <Alert variant={alert.variant} dismissible onClose={() => setAlert({ show: false })}>
          {alert.message}
        </Alert>
      )}

      {/* Tabs */}
      <div className="tab-navigation">
        <Tab.Container activeKey={activeTab} onSelect={(k) => {
          setActiveTab(k);
          // Update URL parameter
          if (k) {
            setSearchParams({ tab: k });
          } else {
            setSearchParams({});
          }
        }}>
          <Nav variant="tabs" className="custom-tabs">
            <Nav.Item>
              <Nav.Link eventKey="list">
                <div className="tab-title">
                  <i className="fas fa-list"></i>
                  <span>Danh sách giấy tờ</span>
                </div>
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="signatures">
                <div className="tab-title">
                  <i className="fas fa-signature"></i>
                  <span>Phê duyệt chữ ký</span>
                  {allSignatures.filter(sig => sig.status === 'verified').length > 0 && (
                    <Badge bg="warning" className="ms-2">
                      {allSignatures.filter(sig => sig.status === 'verified').length}
                    </Badge>
                  )}
                </div>
              </Nav.Link>
            </Nav.Item>
          </Nav>

          <Tab.Content>
            <Tab.Pane eventKey="list">
              {/* Filters */}
              <div className="session1-list-controls">
                <div className="search1-controls">
                  <div className="row">
                    <div className="col-md-3">
                      <Form.Control
                        type="text"
                        placeholder="Tìm kiếm..."
                        value={filter.search}
                        onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                        className="search-input"
                      />
                    </div>
                    <div className="col-md-3">
                      <Form.Select
                        value={filter.type}
                        onChange={(e) => setFilter({ ...filter, type: e.target.value })}
                        className="filter-select"
                      >
                        <option value="">Tất cả loại</option>
                        {documentTypes.length === 0 ? (
                          <option disabled>Đang tải danh sách loại giấy tờ...</option>
                        ) : (
                          Object.entries(groupedDocumentTypes).map(([category, types]) => (
                            <optgroup key={category} label={getCategoryLabel(category)}>
                              {types.map((type) => (
                                <option key={type.value} value={type.value}>
                                  {type.label}
                                </option>
                              ))}
                            </optgroup>
                          ))
                        )}
                      </Form.Select>
                    </div>
                    <div className="col-md-2">
                      <Form.Select
                        value={filter.status}
                        onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                        className="filter-select"
                      >
                        <option value="">Tất cả trạng thái</option>
                        <option value="draft">Nháp</option>
                        <option value="pending">Chờ xử lý</option>
                        <option value="approved">Đã phê duyệt</option>
                        <option value="rejected">Từ chối</option>
                        <option value="expired">Hết hạn</option>
                        <option value="signed">Đã ký</option>
                      </Form.Select>
                    </div>
                    <div className="col-md-2">
                      <Form.Select
                        value={filter.owner_id}
                        onChange={(e) => setFilter({ ...filter, owner_id: e.target.value })}
                        className="filter-select"
                      >
                        <option value="">Tất cả người dùng</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.full_name || user.username}
                          </option>
                        ))}
                      </Form.Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Documents Table */}
              <div className="session-table-container">
                <div className="table-responsive-mobile">
                  <Table className="session-table">
                    <thead>
                      <tr>
                        <th>Tài liệu</th>
                        <th>Loại</th>
                        <th>Người tạo</th>
                        <th>Hạn</th>
                        <th>Trạng thái</th>
                        <th>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan="6" className="text-center">Đang tải...</td>
                        </tr>
                      ) : documents.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="text-center">Không có giấy tờ nào</td>
                        </tr>
                      ) : (
                        documents
                          .slice((pagination.page - 1) * pagination.limit, pagination.page * pagination.limit)
                          .map((doc) => (
                          <tr key={doc.id}>
                            <td className="session-title-cell">
                              <div>
                                <strong>{getTypeText(doc.document_type)}</strong>
                                {doc.source && (
                                  <div className="text-muted" style={{ fontSize: '12px', marginTop: '4px' }}>
                                    <i className="fas fa-map-marker-alt"></i> {doc.source}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td>{getTypeText(doc.document_type)}</td>
                            <td>{doc.owner_name || doc.owner_username}</td>
                            <td>
                              {doc.expiry_date
                                ? new Date(doc.expiry_date).toLocaleDateString('vi-VN')
                                : 'Không có'}
                            </td>
                            <td>{getStatusBadge(doc.status)}</td>
                            <td>
                              <div className="action-buttons">
                                {doc.file_path && (
                                  <Button
                                    variant="outline-primary"
                                    size="sm"
                                    href={`/api${doc.file_path}`}
                                    target="_blank"
                                    className="action-btn"
                                  >
                                    <i className="fas fa-eye"></i> <span>Xem</span>
                                  </Button>
                                )}
                                <Button
                                  variant="outline-info"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedDocument(doc);
                                    fetchDocumentRouting(doc.id);
                                    setShowRoutingModal(true);
                                  }}
                                  className="action-btn"
                                >
                                  <i className="fas fa-sitemap"></i> <span>Phân luồng</span>
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </Table>
                </div>
                
                {/* Pagination */}
                {documents.length > 0 && pagination.totalPages > 1 && (
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
            </Tab.Pane>

            <Tab.Pane eventKey="signatures">
              <div className="signatures-approval-container">

                {loadingSignatures ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Đang tải...</span>
                    </div>
                  </div>
                ) : allSignatures.length === 0 ? (
                  <Alert variant="info">Không có chữ ký nào.</Alert>
                ) : (
                  <div className="table-responsive-mobile">
                    <Table className="session-table">
                      <thead>
                        <tr>
                          <th>Người đăng ký</th>
                          <th>Email</th>
                          <th>Chữ ký</th>
                          <th>Trạng thái</th>
                          <th>Ngày đăng ký</th>
                          <th>Người xác thực</th>
                          <th>Ngày phê duyệt</th>
                          <th>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allSignatures.map((signature) => (
                          <tr key={signature.id}>
                            <td>
                              <div>
                                <strong>{signature.user_name || signature.username}</strong>
                                {signature.username && signature.user_name && (
                                  <div className="text-muted" style={{ fontSize: '12px' }}>
                                    @{signature.username}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td>{signature.email || 'N/A'}</td>
                            <td>
                              {signature.signature_image_path ? (
                                <div className="signature-preview">
                                  <img
                                    src={`/api${signature.signature_image_path}`}
                                    alt="Chữ ký"
                                    style={{
                                      maxWidth: '150px',
                                      maxHeight: '80px',
                                      backgroundColor: '#f8f9fa',
                                      padding: '8px',
                                      borderRadius: '4px',
                                      border: '1px solid #dee2e6'
                                    }}
                                    onError={(e) => {
                                      if (e.target && e.target.style) {
                                        e.target.style.display = 'none';
                                      }
                                      if (e.target && e.target.nextSibling && e.target.nextSibling.style) {
                                        e.target.nextSibling.style.display = 'block';
                                      }
                                    }}
                                  />
                                  <div style={{ display: 'none', color: '#dc3545' }}>
                                    Không thể tải ảnh
                                  </div>
                                </div>
                              ) : (
                                <span className="text-muted">Không có ảnh</span>
                              )}
                            </td>
                            <td>
                              {getSignatureStatusBadge(signature.status)}
                            </td>
                            <td>
                              {signature.created_at
                                ? new Date(signature.created_at).toLocaleString('vi-VN')
                                : 'N/A'}
                            </td>
                            <td>
                              {signature.verifier_name ? (
                                <span>{signature.verifier_name}</span>
                              ) : (
                                <span className="text-muted">Chưa có</span>
                              )}
                            </td>
                            <td>
                              {signature.verified_at
                                ? new Date(signature.verified_at).toLocaleString('vi-VN')
                                : <span className="text-muted">Chưa có</span>}
                            </td>
                            <td>
                              {signature.status === 'verified' ? (
                                <div className="action-buttons">
                                  <Button
                                    variant="success"
                                    size="sm"
                                    onClick={() => handleApproveSignature(signature.id, 'approve')}
                                    className="me-2"
                                  >
                                    <i className="fas fa-check"></i> Phê duyệt
                                  </Button>
                                  <Button
                                    variant="danger"
                                    size="sm"
                                    onClick={() => handleApproveSignature(signature.id, 'reject')}
                                  >
                                    <i className="fas fa-times"></i> Từ chối
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-muted">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                )}
              </div>
            </Tab.Pane>
          </Tab.Content>
        </Tab.Container>
      </div>

      {/* Create Document Modal */}
      <Modal show={showCreateModal} onHide={() => {
        setShowCreateModal(false);
        setShowCustomTypeInput(false);
        setDocumentForm({ document_type: '', custom_document_type: '', purpose: '', source: '', file: null });
      }} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Tạo mẫu giấy tờ mới</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleCreateDocument}>
            <Form.Group className="mb-3">
              <Form.Label>Loại Giấy Tờ *</Form.Label>
              <div className="mb-2">
                <Form.Check
                  type="checkbox"
                  label="Thêm loại giấy tờ mới (không có trong danh sách)"
                  checked={showCustomTypeInput}
                  onChange={(e) => {
                    setShowCustomTypeInput(e.target.checked);
                    if (e.target.checked) {
                      setDocumentForm({ ...documentForm, document_type: '', custom_document_type: '' });
                    } else {
                      setDocumentForm({ ...documentForm, custom_document_type: '' });
                    }
                  }}
                />
              </div>
              {showCustomTypeInput ? (
                <Form.Control
                  type="text"
                  value={documentForm.custom_document_type}
                  onChange={(e) => setDocumentForm({ ...documentForm, custom_document_type: e.target.value })}
                  placeholder="Nhập tên loại giấy tờ mới"
                  required
                />
              ) : (
                <Form.Select
                  value={documentForm.document_type}
                  onChange={(e) => setDocumentForm({ ...documentForm, document_type: e.target.value })}
                  required
                >
                  <option value="">Chọn loại giấy tờ</option>
                  {documentTypes.length === 0 ? (
                    <option disabled>Đang tải danh sách loại giấy tờ...</option>
                  ) : (
                    Object.entries(groupedDocumentTypes).map(([category, types]) => (
                      <optgroup key={category} label={getCategoryLabel(category)}>
                        {types.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </optgroup>
                    ))
                  )}
                </Form.Select>
              )}
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Mục đích</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={documentForm.purpose}
                onChange={(e) => setDocumentForm({ ...documentForm, purpose: e.target.value })}
                placeholder="Mục đích sử dụng giấy tờ"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Nguồn</Form.Label>
              <Form.Control
                type="text"
                value={documentForm.source}
                onChange={(e) => setDocumentForm({ ...documentForm, source: e.target.value })}
                placeholder="Nguồn của giấy tờ (ví dụ: Phòng Đào tạo, Sở GD&ĐT...)"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>File đính kèm</Form.Label>
              <Form.Control
                type="file"
                onChange={(e) => setDocumentForm({ ...documentForm, file: e.target.files[0] })}
                accept="*/*"
              />
              <Form.Text className="text-muted">
                Cho phép tất cả các loại file (tối đa 50MB)
              </Form.Text>
            </Form.Group>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => {
                setShowCreateModal(false);
                setShowCustomTypeInput(false);
                setDocumentForm({ document_type: '', custom_document_type: '', purpose: '', source: '', file: null });
              }}>
                Hủy
              </Button>
              <Button variant="primary" type="submit">
                Tạo mẫu
              </Button>
            </Modal.Footer>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Routing Modal - View and Manage Routing */}
      <Modal show={showRoutingModal} onHide={() => {
        setShowRoutingModal(false);
        setShowCreateRoutingForm(false);
        setSelectedDocument(null);
        setRoutingSteps([]);
      }} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>
            Phân luồng: {selectedDocument ? getTypeText(selectedDocument.document_type) : ''}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {!showCreateRoutingForm ? (
            <>
              <div className="routing-header mb-3" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h5>Danh sách phân luồng</h5>
                </div>
                <Button
                  variant="primary"
                  onClick={() => {
                    setRoutingForm({
                      route_name: '',
                      assignment_type: 'user',
                      assigned_to: '',
                      assigned_by_job_title: '',
                      department: '',
                      due_date: '',
                      notes: '',
                      parent_route_id: null
                    });
                    setShowCreateRoutingForm(true);
                  }}
                >
                  <i className="fas fa-plus"></i> Tạo phân luồng mới
                </Button>
              </div>
              <div className="routing-timeline">
                {routingSteps.length === 0 ? (
                  <Alert variant="info">Chưa có phân luồng nào. Hãy tạo phân luồng đầu tiên.</Alert>
                ) : (
                  <div className="timeline-container">
                    {routingSteps.map((step, index) => renderRoutingStep(step, index))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <Form onSubmit={handleCreateRouting}>
              <h5 className="mb-3">Tạo phân luồng mới</h5>
              <Form.Group className="mb-3">
                <Form.Label>Tên phân luồng *</Form.Label>
                <Form.Control
                  type="text"
                  value={routingForm.route_name}
                  onChange={(e) => setRoutingForm({ ...routingForm, route_name: e.target.value })}
                  required
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Phân công *</Form.Label>
                <div className="mb-2">
                  <Form.Check
                    type="radio"
                    id="assignment-type-user"
                    label="Theo người dùng"
                    name="assignment_type"
                    value="user"
                    checked={routingForm.assignment_type === 'user'}
                    onChange={(e) => setRoutingForm({ 
                      ...routingForm, 
                      assignment_type: 'user',
                      assigned_by_job_title: '' // Clear job title when switching to user
                    })}
                    className="mb-2"
                  />
                  <Form.Check
                    type="radio"
                    id="assignment-type-job-title"
                    label="Theo chức vụ"
                    name="assignment_type"
                    value="job_title"
                    checked={routingForm.assignment_type === 'job_title'}
                    onChange={(e) => setRoutingForm({ 
                      ...routingForm, 
                      assignment_type: 'job_title',
                      assigned_to: '' // Clear user when switching to job title
                    })}
                  />
                </div>
                {routingForm.assignment_type === 'user' ? (
                  <>
                    <Form.Select
                      value={routingForm.assigned_to}
                      onChange={(e) => setRoutingForm({ ...routingForm, assigned_to: e.target.value })}
                      required
                    >
                      <option value="">Chọn người dùng</option>
                      {users.length === 0 ? (
                        <option disabled>Đang tải danh sách người dùng...</option>
                      ) : (
                        users.map((user) => {
                          const roleLabel = user.role === 'superadmin' ? 'Super Admin' : 
                                           user.role === 'admin' ? 'Admin' : 
                                           user.role === 'staff' ? 'Nhân viên' : user.role;
                          return (
                            <option key={user.id} value={user.id}>
                              {user.full_name || user.username} ({roleLabel})
                            </option>
                          );
                        })
                      )}
                    </Form.Select>
                    {users.length > 0 && (
                      <Form.Text className="text-muted">
                        Tổng số người dùng: {users.length}
                      </Form.Text>
                    )}
                  </>
                ) : (
                  <>
                    <Form.Select
                      value={routingForm.assigned_by_job_title}
                      onChange={(e) => setRoutingForm({ ...routingForm, assigned_by_job_title: e.target.value })}
                      required
                    >
                      <option value="">Chọn chức vụ</option>
                      {jobTitles.length === 0 ? (
                        <option disabled>Đang tải danh sách chức vụ...</option>
                      ) : (
                        jobTitles.map((jobTitle, index) => (
                          <option key={index} value={jobTitle}>
                            {jobTitle}
                          </option>
                        ))
                      )}
                    </Form.Select>
                    {jobTitles.length > 0 && (
                      <Form.Text className="text-muted">
                        Tổng số chức vụ: {jobTitles.length}
                      </Form.Text>
                    )}
                  </>
                )}
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Phòng ban</Form.Label>
                <Form.Select
                  value={routingForm.department}
                  onChange={(e) => setRoutingForm({ ...routingForm, department: e.target.value })}
                >
                  <option value="">Chọn phòng ban</option>
                  {departments.length === 0 ? (
                    <option disabled>Đang tải danh sách phòng ban...</option>
                  ) : (
                    departments.map((dept, index) => (
                      <option key={index} value={dept}>
                        {dept}
                      </option>
                    ))
                  )}
                </Form.Select>
                {departments.length === 0 && (
                  <Form.Text className="text-muted">
                    Không có phòng ban nào trong database
                  </Form.Text>
                )}
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Ghi chú</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={routingForm.notes}
                  onChange={(e) => setRoutingForm({ ...routingForm, notes: e.target.value })}
                />
              </Form.Group>
              <Modal.Footer style={{ borderTop: 'none', paddingTop: '1rem' }}>
                <Button variant="secondary" onClick={() => setShowCreateRoutingForm(false)}>
                  Hủy
                </Button>
                <Button variant="primary" type="submit">
                  Tạo
                </Button>
              </Modal.Footer>
            </Form>
          )}
        </Modal.Body>
        {!showCreateRoutingForm && (
          <Modal.Footer>
            <Button variant="secondary" onClick={() => {
              setShowRoutingModal(false);
              setSelectedDocument(null);
              setRoutingSteps([]);
            }}>
              Đóng
            </Button>
          </Modal.Footer>
        )}
      </Modal>
    </div>
  );
};

export default Documents;
