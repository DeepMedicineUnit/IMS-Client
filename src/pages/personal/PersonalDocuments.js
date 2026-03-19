import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Form, Alert, Badge, Dropdown, Table, Nav, Tab } from 'react-bootstrap';
import * as XLSX from 'xlsx';
import api, { getApiBaseURL } from '../../utils/api';
import Pagination from '../../components/Pagination';
import { useAlert } from '../../contexts/AlertContext';
import '../../styles/user.css';
import usePageTitle from '../../hooks/usePageTitle';

const PersonalDocuments = () => {
  usePageTitle('Giấy tờ cá nhân');
  const { showAlert } = useAlert();
  const [documents, setDocuments] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const [showSignNewDocumentModal, setShowSignNewDocumentModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [userSignature, setUserSignature] = useState(null);
  const [pendingSignatureId, setPendingSignatureId] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [totpSecret, setTotpSecret] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [signTotpCode, setSignTotpCode] = useState('');
  const [newDocumentData, setNewDocumentData] = useState(null); // Store created document before signing
  const [signaturePosition, setSignaturePosition] = useState({ x: 100, y: 100, width: 200, height: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isSignatureVerified, setIsSignatureVerified] = useState(false);
  const [filter, setFilter] = useState({ type: '', status: '', search: '' });
  const [alert, setAlert] = useState({ show: false, message: '', variant: 'success' });
  const [activeTab, setActiveTab] = useState('documents');
  const [currentUserId, setCurrentUserId] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalItems: 0,
    totalPages: 0
  });
  const [showRoutingModal, setShowRoutingModal] = useState(false);
  const [selectedDocumentRouting, setSelectedDocumentRouting] = useState(null);
  const [routingHistory, setRoutingHistory] = useState([]);
  const [loadingRouting, setLoadingRouting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    template_id: '',
    file: null
  });
  
  // Editor states
  const [editedTextContent, setEditedTextContent] = useState('');
  const [editedExcelData, setEditedExcelData] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchDocuments();
    fetchUserSignature();
    fetchTemplates();
    fetchDocumentTypes();
    // Get current user ID from token
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setCurrentUserId(payload.id);
      }
    } catch (error) {
      console.error('Error getting user ID:', error);
    }
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

  const fetchTemplates = async () => {
    try {
      const response = await api.get('/documents/templates');
      setTemplates(response.data.templates || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
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
    }
  };

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter.type) params.append('type', filter.type);
      if (filter.status) params.append('status', filter.status);
      if (filter.search) params.append('search', filter.search);

      const response = await api.get(`/documents/user?${params.toString()}`);
      setDocuments(response.data.documents || []);
    } catch (error) {
      showAlert('Lỗi khi tải danh sách giấy tờ', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserSignature = async () => {
    try {
      const response = await api.get('/documents/signatures/user');
      setUserSignature(response.data.signature);
    } catch (error) {
      console.error('Error fetching signature:', error);
    }
  };

  // Removed local showAlert - now using useAlert from AlertContext

  const handleCreateDocument = async (e) => {
    e.preventDefault();
    try {
      if (!formData.template_id) {
        showAlert('Vui lòng chọn mẫu giấy tờ', 'warning');
        return;
      }

      const formDataToSend = new FormData();
      formDataToSend.append('template_id', formData.template_id);
      if (formData.file) formDataToSend.append('file', formData.file);

      const response = await api.post('/documents/from-template', formDataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // Store document data and open sign modal instead of closing
      console.log('Document created response:', response.data);
      
      // Use response data directly (backend now returns full document details)
      const documentData = response.data.document;
      
      // If file_path is missing, try to fetch from API
      if (documentData && documentData.id && !documentData.file_path) {
        try {
          const docResponse = await api.get(`/documents/${documentData.id}`);
          if (docResponse.data.document && docResponse.data.document.file_path) {
            setNewDocumentData(docResponse.data.document);
          } else {
            setNewDocumentData(documentData);
          }
        } catch (fetchError) {
          console.error('Error fetching document details:', fetchError);
          setNewDocumentData(documentData);
        }
      } else {
        setNewDocumentData(documentData);
      }
      
      console.log('Setting newDocumentData:', documentData);
      setShowCreateModal(false);
      setShowSignNewDocumentModal(true);
      setFormData({ template_id: '', file: null });
      setSelectedTemplate(null);
      setSignTotpCode('');
    } catch (error) {
      showAlert(error.response?.data?.message || 'Lỗi khi tạo giấy tờ', 'danger');
    }
  };

  const handleVerifySignatureForNewDocument = async () => {
    // This function is no longer needed as we'll verify and sign in one step
    // Keep it for backward compatibility but it's not used anymore
  };

  const handleSignAndSubmit = async () => {
    try {
      if (!newDocumentData) {
        showAlert('Thông tin không đầy đủ', 'warning');
        return;
      }

      if (!signTotpCode || signTotpCode.length !== 6) {
        showAlert('Vui lòng nhập mã xác thực từ ứng dụng Authenticator (6 số)', 'warning');
        return;
      }

      // Refresh user signature to get latest status
      let currentSignature = userSignature;
      if (!currentSignature) {
        try {
          const sigResponse = await api.get('/documents/signatures/user');
          currentSignature = sigResponse.data.signature;
          if (currentSignature) {
            setUserSignature(currentSignature);
          }
        } catch (sigError) {
          console.error('Error fetching signature:', sigError);
        }
      }

      if (!currentSignature) {
        showAlert('Không tìm thấy chữ ký. Vui lòng đăng ký chữ ký số trước.', 'warning');
        return;
      }

      // Check if signature is active
      if (currentSignature.status !== 'active') {
        showAlert(`Chữ ký của bạn chưa được kích hoạt. Trạng thái hiện tại: ${currentSignature.status}. Vui lòng đợi quản lý phê duyệt.`, 'warning');
        return;
      }

      console.log('Signing document:', {
        document_id: newDocumentData.id,
        signature_id: currentSignature.id,
        signature_status: currentSignature.status,
        position: signaturePosition,
        totp_code_length: signTotpCode.length
      });

      // Sign the document
      console.log('Sending sign request:', {
        document_id: newDocumentData.id,
        signature_id: currentSignature.id,
        totp_code: signTotpCode,
        position_x: signaturePosition.x,
        position_y: signaturePosition.y,
        width: signaturePosition.width,
        height: signaturePosition.height,
        page_number: 1
      });
      
      const response = await api.post('/documents/signatures/sign-document', {
        document_id: newDocumentData.id,
        signature_id: currentSignature.id,
        totp_code: signTotpCode,
        position_x: signaturePosition.x,
        position_y: signaturePosition.y,
        width: signaturePosition.width,
        height: signaturePosition.height,
        page_number: 1
      });

      // If this is an approval (has routeId), update routing status to approved
      if (newDocumentData.routeId) {
        try {
          await api.put(`/documents/routing/${newDocumentData.routeId}`, {
            status: 'approved'
          });
          
          // Check if there are more pending routes, if not, mark document as approved
          const routingResponse = await api.get(`/documents/routing/${newDocumentData.id}`);
          const routes = routingResponse.data.routing_tree || [];
          const hasPendingRoutes = routes.some(route => {
            const checkRoute = (r) => {
              if (r.status === 'pending' || r.status === 'in_progress') return true;
              if (r.children && r.children.length > 0) {
                return r.children.some(checkRoute);
              }
              return false;
            };
            return checkRoute(route);
          });
          
          if (!hasPendingRoutes) {
            await api.put(`/documents/${newDocumentData.id}`, {
              status: 'approved'
            });
          }
        } catch (routeError) {
          console.error('Error updating routing after signing:', routeError);
          // Don't fail if routing update fails
        }
      }

      showAlert(response.data.message || (newDocumentData.routeId ? 'Ký và phê duyệt giấy tờ thành công' : 'Ký giấy tờ thành công. Giấy tờ đã được gửi để phân luồng duyệt.'), 'success');
      setShowSignNewDocumentModal(false);
      setSignTotpCode('');
      setNewDocumentData(null);
      setSignaturePosition({ x: 100, y: 100, width: 200, height: 100 });
      fetchDocuments();
    } catch (error) {
      console.error('Error signing document:', error);
      console.error('Error response:', error.response?.data);
      const errorMessage = error.response?.data?.message || error.response?.data?.error || 'Lỗi khi ký giấy tờ';
      showAlert(errorMessage, 'danger');
    }
  };

  const handleTemplateSelect = async (templateId) => {
    if (!templateId) {
      setSelectedTemplate(null);
      setFormData({
        ...formData,
        template_id: ''
      });
      setIsEditing(false);
      setEditedTextContent('');
      setEditedExcelData(null);
      return;
    }
    const template = templates.find(t => t.id === parseInt(templateId));
    if (template) {
      setSelectedTemplate(template);
      setFormData({
        ...formData,
        template_id: templateId
      });
      
      // Load file content for editable files
      if (template.file_path) {
        const fileExt = template.file_path.toLowerCase();
        if (fileExt.endsWith('.txt')) {
          try {
            const response = await fetch(`${getApiBaseURL()}${template.file_path}`);
            const text = await response.text();
            setEditedTextContent(text);
          } catch (error) {
            console.error('Error loading text file:', error);
          }
        } else if (fileExt.endsWith('.xlsx') || fileExt.endsWith('.xls')) {
          try {
            const response = await fetch(`${getApiBaseURL()}${template.file_path}`);
            const arrayBuffer = await response.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
            setEditedExcelData({ workbook, jsonData, sheetName: firstSheetName });
          } catch (error) {
            console.error('Error loading Excel file:', error);
          }
        }
      }
    } else {
      setSelectedTemplate(null);
    }
  };

  const handleSaveTextFile = () => {
    if (!editedTextContent) return;
    const blob = new Blob([editedTextContent], { type: 'text/plain' });
    const file = new File([blob], selectedTemplate.file_name || 'document.txt', { type: 'text/plain' });
    setFormData({ ...formData, file });
    setIsEditing(false);
    showAlert('Đã lưu file đã chỉnh sửa', 'success');
  };

  const handleSaveExcelFile = () => {
    if (!editedExcelData) return;
    try {
      const ws = XLSX.utils.aoa_to_sheet(editedExcelData.jsonData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, editedExcelData.sheetName);
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const file = new File([blob], selectedTemplate.file_name || 'document.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      setFormData({ ...formData, file });
      setIsEditing(false);
      showAlert('Đã lưu file đã chỉnh sửa', 'success');
    } catch (error) {
      console.error('Error saving Excel file:', error);
      showAlert('Lỗi khi lưu file Excel', 'danger');
    }
  };

  const handleExcelCellChange = (rowIndex, colIndex, value) => {
    if (!editedExcelData) return;
    const newData = [...editedExcelData.jsonData];
    if (!newData[rowIndex]) {
      newData[rowIndex] = [];
    }
    newData[rowIndex][colIndex] = value;
    setEditedExcelData({ ...editedExcelData, jsonData: newData });
  };

  const handleRegisterSignature = async (e) => {
    e.preventDefault();
    try {
      if (!formData.file) {
        showAlert('Vui lòng chọn file chữ ký', 'warning');
        return;
      }

      const formDataToSend = new FormData();
      formDataToSend.append('signature', formData.file);

      const response = await api.post('/documents/signatures/register', formDataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        setPendingSignatureId(response.data.signature_id);
        setQrCode(response.data.qr_code);
        setTotpSecret(response.data.manual_entry_key);
        setShowSignModal(true);
        setFormData({ ...formData, file: null });
        fetchUserSignature();
      }
    } catch (error) {
      showAlert(error.response?.data?.message || 'Lỗi khi đăng ký chữ ký', 'danger');
    }
  };

  const handleVerifyInitialSignature = async () => {
    try {
      if (!pendingSignatureId || !totpCode) {
        showAlert('Vui lòng nhập mã xác thực từ ứng dụng Authenticator', 'warning');
        return;
      }

      if (totpCode.length !== 6) {
        showAlert('Mã xác thực phải có 6 số', 'warning');
        return;
      }

      await api.post('/documents/signatures/verify-initial', {
        signature_id: pendingSignatureId,
        totp_code: totpCode
      });

      showAlert('Xác thực chữ ký thành công. Chờ quản lý chữ ký số phê duyệt.', 'success');
      setShowSignModal(false);
      setTotpCode('');
      setPendingSignatureId(null);
      setQrCode(null);
      setTotpSecret('');
      fetchUserSignature();
    } catch (error) {
      showAlert(error.response?.data?.message || 'Lỗi khi xác thực chữ ký', 'danger');
    }
  };

  const handleSignDocument = async () => {
    try {
      if (!selectedDocument || !userSignature || !signTotpCode) {
        showAlert('Vui lòng nhập mã xác thực từ ứng dụng Authenticator', 'warning');
        return;
      }

      if (signTotpCode.length !== 6) {
        showAlert('Mã xác thực phải có 6 số', 'warning');
        return;
      }

      await api.post('/documents/signatures/sign-document', {
        document_id: selectedDocument.id,
        signature_id: userSignature.id,
        totp_code: signTotpCode,
        position_x: 100,
        position_y: 100,
        width: 200,
        height: 100,
        page_number: 1
      });

      showAlert('Ký giấy tờ thành công', 'success');
      setShowSignModal(false);
      setSignTotpCode('');
      setSelectedDocument(null);
      fetchDocuments();
    } catch (error) {
      showAlert(error.response?.data?.message || 'Lỗi khi ký giấy tờ', 'danger');
    }
  };

  const handleDeleteDocument = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa giấy tờ này?')) return;

    try {
      await api.delete(`/documents/${id}`);
      showAlert('Xóa giấy tờ thành công', 'success');
      fetchDocuments();
    } catch (error) {
      showAlert(error.response?.data?.message || 'Lỗi khi xóa giấy tờ', 'danger');
    }
  };

  const getStatusBadge = (doc) => {
    // If document has routing, check routing status instead of document status
    // Document is only "approved" when ALL routes are approved
    let displayStatus = doc.status;
    
    // For documents with routing, we need to check if all routes are completed
    // This will be handled by backend, but we can also check here
    if (doc.status === 'pending' || doc.status === 'signed') {
      // Keep as is - routing will determine final status
      displayStatus = doc.status;
    }
    
    const badges = {
      draft: { variant: 'secondary', text: 'Nháp' },
      pending: { variant: 'warning', text: 'Chờ xử lý' },
      approved: { variant: 'success', text: 'Đã phê duyệt' },
      rejected: { variant: 'danger', text: 'Từ chối' },
      expired: { variant: 'dark', text: 'Hết hạn' },
      signed: { variant: 'primary', text: 'Đã ký' }
    };
    const badge = badges[displayStatus] || { variant: 'secondary', text: displayStatus };
    return <Badge bg={badge.variant}>{badge.text}</Badge>;
  };

  const getTypeText = (type) => {
    const types = {
      contract: 'Hợp đồng',
      certificate: 'Chứng chỉ',
      license: 'Giấy phép',
      agreement: 'Thỏa thuận',
      report: 'Báo cáo',
      other: 'Khác'
    };
    return types[type] || type;
  };

  const handleViewRouting = async (documentId) => {
    try {
      setLoadingRouting(true);
      setSelectedDocumentRouting(null);
      setRoutingHistory([]);
      
      // Fetch routing tree
      const routingResponse = await api.get(`/documents/routing/${documentId}`);
      const routingTree = routingResponse.data.routing_tree || [];
      
      // Debug: Log routing tree structure
      console.log('=== ROUTING DEBUG START ===');
      console.log('Document ID:', documentId);
      console.log('Routing response:', routingResponse.data);
      console.log('Routing tree array length:', routingTree.length);
      console.log('Routing tree:', routingTree);
      
      // Recursively log all routes and their children
      const logRouteTree = (routes, depth = 0) => {
        routes.forEach(route => {
          const indent = '  '.repeat(depth);
          console.log(`${indent}- Route ID: ${route.id}, Name: ${route.route_name}, Children: ${route.children?.length || 0}`);
          if (route.children && route.children.length > 0) {
            logRouteTree(route.children, depth + 1);
          }
        });
      };
      console.log('Full route tree structure:');
      logRouteTree(routingTree);
      console.log('=== ROUTING DEBUG END ===');
      
      // Recursively collect all route IDs from tree
      const getAllRouteIds = (routes) => {
        let ids = [];
        routes.forEach(route => {
          ids.push(route.id);
          if (route.children && route.children.length > 0) {
            ids = ids.concat(getAllRouteIds(route.children));
          }
        });
        return ids;
      };
      
      const allRouteIds = getAllRouteIds(routingTree);
      console.log('All route IDs collected:', allRouteIds);
      
      // Fetch history for all routes (including nested)
      const allHistoryPromises = allRouteIds.map(async (routeId) => {
        try {
          const historyResponse = await api.get(`/documents/routing/${routeId}/history`);
          return {
            routeId: routeId,
            history: historyResponse.data.history || []
          };
        } catch (error) {
          console.error(`Error fetching history for route ${routeId}:`, error);
          return { routeId: routeId, history: [] };
        }
      });
      
      const allHistory = await Promise.all(allHistoryPromises);
      const historyMap = {};
      allHistory.forEach(item => {
        historyMap[item.routeId] = item.history;
      });
      
      setSelectedDocumentRouting({
        documentId,
        routingTree,
        historyMap
      });
      setShowRoutingModal(true);
    } catch (error) {
      console.error('Error fetching routing:', error);
      showAlert(error.response?.data?.message || 'Lỗi khi tải quá trình phê duyệt', 'danger');
    } finally {
      setLoadingRouting(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'in_progress': return 'info';
      case 'approved': return 'success';
      case 'rejected': return 'danger';
      case 'completed': return 'success';
      default: return 'secondary';
    }
  };

  const getStatusText = (status) => {
    const statusMap = {
      pending: 'Chờ xử lý',
      in_progress: 'Đang xử lý',
      approved: 'Đã phê duyệt',
      rejected: 'Đã từ chối',
      completed: 'Hoàn thành'
    };
    return statusMap[status] || status;
  };

  // Helper function to safely parse JSON values
  const safeParseJSON = (value) => {
    if (!value) return null;
    if (typeof value !== 'string') return value;
    
    // Try to parse as JSON, if it fails, return the string as is
    try {
      const parsed = JSON.parse(value);
      return parsed;
    } catch (e) {
      // If it's not valid JSON, return the string value
      return value;
    }
  };

  const renderRoutingTree = (routes, level = 0) => {
    if (!routes || routes.length === 0) {
      console.log('renderRoutingTree: routes is empty or null', routes);
      return null;
    }
    
    // Debug: Log what we're rendering
    console.log(`renderRoutingTree: Rendering ${routes.length} routes at level ${level}`, routes);
    
    // If this is root level and there are multiple routes, show them as parallel routes
    const isParallelRoutes = level === 0 && routes.length > 1;
    
    return (
      <div style={{ marginLeft: `${level * 20}px`, marginTop: '10px' }}>
        {isParallelRoutes && (
          <div className="mb-3 p-2 bg-info bg-opacity-10 rounded border border-info">
            <small className="text-info">
              <i className="fas fa-info-circle"></i> Có {routes.length} bước phê duyệt song song (có thể xử lý đồng thời)
            </small>
          </div>
        )}
        {routes.map((route, index) => {
          console.log(`Rendering route ${index + 1}/${routes.length}:`, route.id, route.route_name, 'children:', route.children?.length || 0);
          // Use route status directly (no need to parse from history)
          const currentStatus = route.status || 'pending';
          
          return (
            <div key={route.id} style={{ marginBottom: '20px', position: 'relative' }}>
              {/* Parallel route indicator */}
              {isParallelRoutes && index > 0 && (
                <div className="text-center my-2">
                  <div className="badge bg-secondary">VÀ / HOẶC</div>
                </div>
              )}
              {/* Route Card */}
              <div className="card" style={{ 
                borderLeft: level > 0 ? `4px solid ${currentStatus === 'approved' ? '#28a745' : currentStatus === 'rejected' ? '#dc3545' : '#ffc107'}` : isParallelRoutes ? `4px solid ${currentStatus === 'approved' ? '#28a745' : currentStatus === 'rejected' ? '#dc3545' : '#17a2b8'}` : 'none',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                borderTop: isParallelRoutes ? `2px solid ${currentStatus === 'approved' ? '#28a745' : currentStatus === 'rejected' ? '#dc3545' : '#17a2b8'}` : 'none'
              }}>
                <div className="card-body">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <div className="d-flex align-items-center">
                      {/* Status Icon */}
                      {currentStatus === 'approved' && (
                        <div className="me-3" style={{ fontSize: '24px', color: '#28a745' }}>
                          <i className="fas fa-check-circle"></i>
                        </div>
                      )}
                      {currentStatus === 'rejected' && (
                        <div className="me-3" style={{ fontSize: '24px', color: '#dc3545' }}>
                          <i className="fas fa-times-circle"></i>
                        </div>
                      )}
                      {(currentStatus === 'pending' || currentStatus === 'in_progress') && (
                        <div className="me-3" style={{ fontSize: '24px', color: '#ffc107' }}>
                          <i className="fas fa-clock"></i>
                        </div>
                      )}
                      
                      <div>
                        <h6 className="mb-1">
                          {isParallelRoutes && (
                            <span className="badge bg-info me-2">Bước {index + 1}/{routes.length}</span>
                          )}
                          {route.route_name || `Bước ${index + 1}`}
                        </h6>
                        {route.assigned_to_name && (
                          <div className="text-muted small">
                            <i className="fas fa-user"></i> {route.assigned_to_name}
                            {route.assigned_to_username && (
                              <span className="ms-1">({route.assigned_to_username})</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <Badge bg={getStatusColor(currentStatus)} style={{ fontSize: '0.9rem' }}>
                      {getStatusText(currentStatus)}
                    </Badge>
                  </div>
                  
                  {/* Additional Info */}
                  {route.department && (
                    <div className="text-muted small mb-2">
                      <i className="fas fa-building"></i> Phòng ban: {route.department}
                    </div>
                  )}
                  
                  {route.due_date && (
                    <div className="text-muted small mb-2">
                      <i className="fas fa-calendar"></i> Hạn xử lý: {new Date(route.due_date).toLocaleDateString('vi-VN')}
                    </div>
                  )}
                  
                  {route.notes && (
                    <div className="mt-2 p-2 bg-light rounded">
                      <small className="text-muted">
                        <i className="fas fa-sticky-note"></i> Ghi chú: {route.notes}
                      </small>
                    </div>
                  )}
                  
                  {/* Status Timeline */}
                  <div className="mt-3 pt-3 border-top">
                    <div className="small text-muted">
                      {currentStatus === 'approved' && (
                        <span className="text-success">
                          <i className="fas fa-check"></i> Đã phê duyệt
                        </span>
                      )}
                      {currentStatus === 'rejected' && (
                        <span className="text-danger">
                          <i className="fas fa-times"></i> Đã từ chối
                        </span>
                      )}
                      {(currentStatus === 'pending' || currentStatus === 'in_progress') && (
                        <span className="text-warning">
                          <i className="fas fa-hourglass-half"></i> Đang chờ xử lý
                        </span>
                      )}
                      {route.completed_at && currentStatus === 'completed' && (
                        <span className="text-success ms-2">
                          - Hoàn thành: {new Date(route.completed_at).toLocaleString('vi-VN')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Render Children */}
              {route.children && route.children.length > 0 && (
                <div className="mt-3" style={{ paddingLeft: '20px', borderLeft: '2px solid #dee2e6', position: 'relative' }}>
                  <div className="mb-2">
                    <small className="text-muted">
                      <i className="fas fa-arrow-down"></i> Bước tiếp theo ({route.children.length}):
                    </small>
                  </div>
                  {renderRoutingTree(route.children, level + 1)}
                </div>
              )}
              {route.children && route.children.length === 0 && console.log(`Route ${route.id} has no children (children array exists but empty)`) || (!route.children && console.log(`Route ${route.id} has no children property`))}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Giấy tờ</h1>
            <p className="header-subtitle">Quản lý giấy tờ, hợp đồng, chứng chỉ</p>
          </div>
          <div className="header-actions">
            <Button
              variant="light"
              onClick={() => {
                setShowCreateModal(true);
                setFormData({ template_id: '', file: null });
                setSelectedTemplate(null);
              }}
              className="create-session-btn"
            >
              <i className="fas fa-plus"></i> Gửi giấy tờ mới
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
        <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k)}>
          <Nav variant="tabs" className="custom-tabs">
            <Nav.Item>
              <Nav.Link eventKey="documents">
                <div className="tab-title">
                  <i className="fas fa-file-alt"></i>
                  <span>Danh sách giấy tờ</span>
                </div>
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="signature">
                <div className="tab-title">
                  <i className="fas fa-signature"></i>
                  <span>Đăng ký chữ ký số</span>
                  {userSignature && userSignature.status === 'verified' && (
                    <Badge bg="warning" className="ms-2">Chờ phê duyệt</Badge>
                  )}
                  {userSignature && userSignature.status === 'active' && (
                    <Badge bg="success" className="ms-2">Đã kích hoạt</Badge>
                  )}
                </div>
              </Nav.Link>
            </Nav.Item>
          </Nav>

          <Tab.Content>
            <Tab.Pane eventKey="documents">
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
                <option value="contract">Hợp đồng</option>
                <option value="certificate">Chứng chỉ</option>
                <option value="license">Giấy phép</option>
                <option value="agreement">Thỏa thuận</option>
                <option value="report">Báo cáo</option>
                <option value="other">Khác</option>
              </Form.Select>
            </div>
            <div className="col-md-3">
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
          </div>
        </div>
      </div>

      {/* Documents Table */}
      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <Table className="session-table">
            <thead>
              <tr>
                <th>Loại</th>
                <th>Tên tài liệu</th>
                <th>Ngày tạo</th>
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
                  .map((doc) => {
                  const docTypeLabel = documentTypes.find(t => t.value === doc.document_type)?.label || doc.document_type;
                  return (
                  <tr key={doc.id}>
                    <td>{getTypeText(doc.document_type)}</td>
                    <td className="session-title-cell">{docTypeLabel}</td>
                    <td className="session-date">
                      {new Date(doc.created_at).toLocaleDateString('vi-VN')}
                    </td>
                    <td>{getStatusBadge(doc)}</td>
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
                        {/* Show routing status button for documents with routing */}
                        <Button
                          variant="outline-info"
                          size="sm"
                          onClick={() => handleViewRouting(doc.id)}
                          className="action-btn"
                        >
                          <i className="fas fa-route"></i> <span>Quá trình</span>
                        </Button>
                        {/* Show edit/delete only for owned documents */}
                        {(!doc.document_relation || doc.document_relation === 'owned') && doc.status === 'draft' && (
                          <>
                            <Button
                              variant="outline-warning"
                              size="sm"
                              onClick={() => {
                                setSelectedDocument(doc);
                                setShowCreateModal(true);
                              }}
                              className="action-btn"
                            >
                              <i className="fas fa-edit"></i> <span>Sửa</span>
                            </Button>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="action-btn"
                            >
                              <i className="fas fa-trash"></i> <span>Xóa</span>
                            </Button>
                          </>
                        )}
                        {/* Show sign button only for owned documents that haven't been signed */}
                        {(!doc.document_relation || doc.document_relation === 'owned') && doc.status !== 'signed' && userSignature && userSignature.status === 'active' && (
                          <Button
                            variant="outline-success"
                            size="sm"
                            onClick={() => {
                              setSelectedDocument(doc);
                              setSignTotpCode('');
                              setShowSignModal(true);
                            }}
                            className="action-btn"
                          >
                            <i className="fas fa-signature"></i> <span>Ký</span>
                          </Button>
                        )}
                        {/* Show approval buttons for assigned documents */}
                        {doc.document_relation === 'assigned' && doc.status === 'pending' && (
                          <>
                            <Button
                              variant="outline-success"
                              size="sm"
                              onClick={async () => {
                                try {
                                  // Get current user ID from token if not set
                                  let userId = currentUserId;
                                  if (!userId) {
                                    try {
                                      const token = localStorage.getItem('token');
                                      if (token) {
                                        const payload = JSON.parse(atob(token.split('.')[1]));
                                        userId = payload.id;
                                        setCurrentUserId(userId);
                                      }
                                    } catch (tokenError) {
                                      console.error('Error getting user ID:', tokenError);
                                    }
                                  }
                                  
                                  if (!userId) {
                                    showAlert('Không thể xác định người dùng', 'warning');
                                    return;
                                  }
                                  
                                  // Get routing info for this document
                                  const routingResponse = await api.get(`/documents/routing/${doc.id}`);
                                  const routes = routingResponse.data.routing_tree || [];
                                  
                                  // Find the route assigned to current user
                                  const findAssignedRoute = (routeList) => {
                                    for (const route of routeList) {
                                      if (route.assigned_to === userId && (route.status === 'pending' || route.status === 'in_progress')) {
                                        return route;
                                      }
                                      if (route.children && route.children.length > 0) {
                                        const found = findAssignedRoute(route.children);
                                        if (found) return found;
                                      }
                                    }
                                    return null;
                                  };
                                  const assignedRoute = findAssignedRoute(routes);
                                  
                                  if (assignedRoute) {
                                    // Set document data with routeId and open sign modal
                                    // Approval will happen after signing
                                    setNewDocumentData({ ...doc, routeId: assignedRoute.id });
                                    setShowSignNewDocumentModal(true);
                                    setIsSignatureVerified(false);
                                    setSignTotpCode('');
                                    setSignaturePosition({ x: 100, y: 100, width: 200, height: 100 });
                                  } else {
                                    showAlert('Không tìm thấy routing được assign cho bạn', 'warning');
                                  }
                                } catch (error) {
                                  console.error('Error getting routing:', error);
                                  // Still allow to open sign modal if routing fetch fails
                                  setNewDocumentData(doc);
                                  setShowSignNewDocumentModal(true);
                                  setIsSignatureVerified(false);
                                  setSignTotpCode('');
                                  setSignaturePosition({ x: 100, y: 100, width: 200, height: 100 });
                                }
                              }}
                              className="action-btn"
                            >
                              <i className="fas fa-check"></i> <span>Phê duyệt</span>
                            </Button>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={async () => {
                                if (!window.confirm('Bạn có chắc chắn muốn từ chối giấy tờ này?')) return;
                                
                                try {
                                  // Get routing info for this document
                                  const routingResponse = await api.get(`/documents/routing/${doc.id}`);
                                  const routes = routingResponse.data.routing_tree || [];
                                  
                                  // Find the route assigned to current user
                                  const findAssignedRoute = (routeList) => {
                                    for (const route of routeList) {
                                      if (route.assigned_to === currentUserId && (route.status === 'pending' || route.status === 'in_progress')) {
                                        return route;
                                      }
                                      if (route.children && route.children.length > 0) {
                                        const found = findAssignedRoute(route.children);
                                        if (found) return found;
                                      }
                                    }
                                    return null;
                                  };
                                  const assignedRoute = findAssignedRoute(routes);
                                  
                                  if (assignedRoute) {
                                    // Update routing status to rejected
                                    await api.put(`/documents/routing/${assignedRoute.id}`, {
                                      status: 'rejected'
                                    });
                                    
                                    // Update document status
                                    await api.put(`/documents/${doc.id}`, {
                                      status: 'rejected'
                                    });
                                    
                                    showAlert('Đã từ chối giấy tờ', 'success');
                                    fetchDocuments();
                                  } else {
                                    showAlert('Không tìm thấy routing được assign cho bạn', 'warning');
                                  }
                                } catch (error) {
                                  console.error('Error rejecting document:', error);
                                  showAlert(error.response?.data?.message || 'Lỗi khi từ chối giấy tờ', 'danger');
                                }
                              }}
                              className="action-btn"
                            >
                              <i className="fas fa-times"></i> <span>Từ chối</span>
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </Table>
        </div>
        
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
            </Tab.Pane>

            <Tab.Pane eventKey="signature">
              <div className="signature-registration-container">

                {userSignature ? (
                  <div className="signature-status-card">
                    <Alert variant={userSignature.status === 'active' ? 'success' : userSignature.status === 'verified' ? 'warning' : 'info'}>
                      <h5>
                        <i className={`fas fa-${userSignature.status === 'active' ? 'check-circle' : userSignature.status === 'verified' ? 'clock' : 'info-circle'}`}></i>
                        {' '}
                        {userSignature.status === 'active' ? 'Chữ ký đã được kích hoạt' : 
                         userSignature.status === 'verified' ? 'Chữ ký đang chờ phê duyệt' : 
                         userSignature.status === 'pending' ? 'Chữ ký đang chờ xác thực' :
                         'Trạng thái: ' + userSignature.status}
                      </h5>
                      {userSignature.status === 'verified' && (
                        <p className="mb-0">Chữ ký của bạn đã được xác thực và đang chờ quản lý phê duyệt. Vui lòng chờ thông báo.</p>
                      )}
                      {userSignature.status === 'active' && (
                        <p className="mb-0">Chữ ký của bạn đã sẵn sàng để sử dụng. Bạn có thể sử dụng chữ ký này để ký các giấy tờ.</p>
                      )}
                      {userSignature.status === 'pending' && (
                        <div>
                          <p className="mb-3">Chữ ký của bạn đã được đăng ký nhưng chưa được xác thực. Vui lòng xác thực bằng mã Authenticator.</p>
                          <Button
                            variant="primary"
                            onClick={() => {
                              setPendingSignatureId(userSignature.id);
                              setShowSignModal(true);
                            }}
                          >
                            <i className="fas fa-key"></i> Xác thực chữ ký
                          </Button>
                        </div>
                      )}
                    </Alert>
                    {userSignature.signature_image_path && (
                      <div className="signature-preview mt-3">
                        <h6>Xem trước chữ ký:</h6>
                        <img
                          src={`/api${userSignature.signature_image_path}`}
                          alt="Chữ ký"
                          style={{
                            maxWidth: '300px',
                            maxHeight: '150px',
                            backgroundColor: '#f8f9fa',
                            padding: '15px',
                            borderRadius: '8px',
                            border: '2px solid #dee2e6'
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
                        <div style={{ display: 'none', color: '#dc3545', marginTop: '10px' }}>
                          Không thể tải ảnh chữ ký
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="signature-registration-form">
                    <Alert variant="info">
                      <strong>Lưu ý:</strong> Chữ ký phải là file PNG không nền. Sau khi đăng ký, bạn cần xác thực bằng mã Authenticator.
                    </Alert>
                    <Form onSubmit={handleRegisterSignature}>
                      <Form.Group className="mb-3">
                        <Form.Label>Ảnh chữ ký (PNG không nền) *</Form.Label>
                        <Form.Control
                          type="file"
                          accept="image/png"
                          onChange={(e) => setFormData({ ...formData, file: e.target.files[0] })}
                          required
                        />
                        <Form.Text className="text-muted">
                          Chọn file PNG có nền trong suốt (transparent background)
                        </Form.Text>
                      </Form.Group>
                      <Button variant="primary" type="submit" disabled={!formData.file}>
                        <i className="fas fa-signature"></i> Đăng ký chữ ký
                      </Button>
                    </Form>
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
        setSelectedTemplate(null);
        setFormData({ template_id: '', file: null });
        setIsEditing(false);
        setEditedTextContent('');
        setEditedExcelData(null);
      }} size="xl" dialogClassName="modal-xl-custom">
        <style>
          {`
            .modal-xl-custom {
              max-width: 60%;
            }
            .modal-xl-custom .modal-content {
              max-height: 900vh;
              display: flex;
              flex-direction: column;
            }
            .modal-xl-custom .modal-body {
              overflow-y: auto;
              flex: 1;
              max-height: calc(90vh - 30px);
            }
          `}
        </style>
        <Modal.Header closeButton>
          <Modal.Title>Gửi giấy tờ mới</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="info">
            Chọn mẫu giấy tờ từ danh sách đã được tạo sẵn. Sau khi gửi, giấy tờ sẽ được phân luồng duyệt theo quy trình đã thiết lập.
          </Alert>
          <Form onSubmit={handleCreateDocument}>
            <Form.Group className="mb-3">
              <Form.Label>Chọn mẫu giấy tờ *</Form.Label>
              <div className="d-flex align-items-center gap-2">
                <Form.Select
                  value={formData.template_id}
                  onChange={(e) => handleTemplateSelect(e.target.value)}
                  required
                  className="flex-grow-1"
                >
                  <option value="">-- Chọn mẫu giấy tờ --</option>
                  {templates.length === 0 ? (
                    <option disabled>Không có mẫu giấy tờ nào</option>
                  ) : (
                    templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {documentTypes.find(t => t.value === template.document_type)?.label || template.document_type}
                      </option>
                    ))
                  )}
                </Form.Select>
                {selectedTemplate && selectedTemplate.file_path && (
                  <Button
                    variant="primary"
                    size="sm"
                    href={selectedTemplate.google_drive_url || `/api${selectedTemplate.file_path}`}
                    target="_blank"
                    download
                  >
                    <i className="fas fa-download"></i>
                  </Button>
                )}
              </div>
              {selectedTemplate && (
                <div className="mt-3">
                  <Form.Text className="text-muted d-block mb-2">
                    {selectedTemplate.purpose && <div><strong>Mục đích:</strong> {selectedTemplate.purpose}</div>}
                    {selectedTemplate.source && <div><strong>Nguồn:</strong> {selectedTemplate.source}</div>}
                  </Form.Text>
                  {selectedTemplate.file_path && (
                    <div className="mt-3"> 
                      
                      {/* File Preview */}
                        {(() => {
                          const filePath = selectedTemplate.file_path?.toLowerCase() || '';
                          const isTxt = filePath.endsWith('.txt');
                          const isXlsx = filePath.endsWith('.xlsx') || filePath.endsWith('.xls');
                          const isDocx = filePath.endsWith('.docx') || filePath.endsWith('.doc');
                          
                          if (isTxt) {
                            return (
                              <div>
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                  <small className="text-muted">
                                    <i className="fas fa-edit"></i> Chỉnh sửa file .txt trực tiếp
                                  </small>
                                  <div>
                                    {isEditing ? (
                                      <>
                                        <Button
                                          variant="success"
                                          size="sm"
                                          onClick={handleSaveTextFile}
                                          className="me-2"
                                        >
                                          <i className="fas fa-save"></i> Lưu
                                        </Button>
                                        <Button
                                          variant="secondary"
                                          size="sm"
                                          onClick={() => setIsEditing(false)}
                                        >
                                          <i className="fas fa-times"></i> Hủy
                                        </Button>
                                      </>
                                    ) : (
                                      <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={() => setIsEditing(true)}
                                      >
                                        <i className="fas fa-edit"></i> Chỉnh sửa
                                      </Button>
                                    )}
                                  </div>
                                </div>
                                {isEditing ? (
                                  <Form.Control
                                    as="textarea"
                                    rows={15}
                                    value={editedTextContent}
                                    onChange={(e) => setEditedTextContent(e.target.value)}
                                    style={{ fontFamily: 'monospace', fontSize: '13px' }}
                                  />
                                ) : (
                                  <div style={{
                                    width: '100%',
                                    height: '350px',
                                    border: '1px solid #dee2e6',
                                    borderRadius: '4px',
                                    overflow: 'auto',
                                    backgroundColor: 'white',
                                    padding: '10px',
                                    fontFamily: 'monospace',
                                    fontSize: '13px',
                                    whiteSpace: 'pre-wrap'
                                  }}>
                                    {editedTextContent || 'Đang tải...'}
                                  </div>
                                )}
                              </div>
                            );
                          } else if (isXlsx) {
                            return (
                              <div>
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                  <small className="text-muted">
                                    <i className="fas fa-table"></i> Chỉnh sửa file Excel trực tiếp
                                  </small>
                                  <div>
                                    {isEditing ? (
                                      <>
                                        <Button
                                          variant="success"
                                          size="sm"
                                          onClick={handleSaveExcelFile}
                                          className="me-2"
                                        >
                                          <i className="fas fa-save"></i> Lưu
                                        </Button>
                                        <Button
                                          variant="secondary"
                                          size="sm"
                                          onClick={() => setIsEditing(false)}
                                        >
                                          <i className="fas fa-times"></i> Hủy
                                        </Button>
                                      </>
                                    ) : (
                                      <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={() => setIsEditing(true)}
                                      >
                                        <i className="fas fa-edit"></i> Chỉnh sửa
                                      </Button>
                                    )}
                                  </div>
                                </div>
                                {editedExcelData && editedExcelData.jsonData ? (
                                  <div style={{ maxHeight: '350px', overflow: 'auto', border: '1px solid #dee2e6', borderRadius: '4px', backgroundColor: 'white' }}>
                                    <Table bordered size="sm" className="mb-0">
                                      <tbody>
                                        {editedExcelData.jsonData.map((row, rowIndex) => (
                                          <tr key={rowIndex}>
                                            {row.map((cell, colIndex) => (
                                              <td key={colIndex} style={{ padding: '4px', minWidth: '100px' }}>
                                                {isEditing ? (
                                                  <Form.Control
                                                    type="text"
                                                    value={cell || ''}
                                                    onChange={(e) => handleExcelCellChange(rowIndex, colIndex, e.target.value)}
                                                    style={{ padding: '2px 4px', fontSize: '12px', border: 'none', boxShadow: 'none' }}
                                                    onFocus={(e) => {
                                                      if (e.target && e.target.style) {
                                                        e.target.style.backgroundColor = '#fff3cd';
                                                      }
                                                    }}
                                                    onBlur={(e) => {
                                                      if (e.target && e.target.style) {
                                                        e.target.style.backgroundColor = 'white';
                                                      }
                                                    }}
                                                  />
                                                ) : (
                                                  <span>{cell || ''}</span>
                                                )}
                                              </td>
                                            ))}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </Table>
                                  </div>
                                ) : (
                                  <div className="text-center p-4">
                                    <i className="fas fa-spinner fa-spin"></i> Đang tải file Excel...
                                  </div>
                                )}
                              </div>
                            );
                          } else if (isDocx) {
                            // Use Google Drive URL if available, otherwise use local file
                            let viewerUrl;
                            let downloadUrl;
                            let editUrl;
                            
                            if (selectedTemplate.google_drive_file_id) {
                              // Use Google Drive file ID for viewer
                              const fileId = selectedTemplate.google_drive_file_id;
                              // Use published_url if available, otherwise use preview with embedded=true (like in mau.md examples)
                              if (selectedTemplate.published_url) {
                                viewerUrl = selectedTemplate.published_url;
                              } else {
                                // Use Google Docs preview with embedded=true
                                viewerUrl = `https://docs.google.com/document/d/${fileId}/preview?rm=minimal&embedded=true`;
                              }
                              editUrl = `https://docs.google.com/document/d/${fileId}/edit`;
                              downloadUrl = selectedTemplate.google_drive_url || `https://drive.google.com/uc?export=download&id=${fileId}`;
                            } else if (selectedTemplate.google_drive_url) {
                              // Extract file ID from Google Drive URL
                              const urlMatch = selectedTemplate.google_drive_url.match(/\/d\/([a-zA-Z0-9_-]+)/);
                              if (urlMatch && urlMatch[1]) {
                                const fileId = urlMatch[1];
                                // Use Google Docs preview with embedded=true
                                viewerUrl = `https://docs.google.com/document/d/${fileId}/preview?rm=minimal&embedded=true`;
                                editUrl = `https://docs.google.com/document/d/${fileId}/edit`;
                              } else {
                                // Use Google Drive URL directly - try to convert to preview mode
                                viewerUrl = selectedTemplate.google_drive_url.replace('/view?usp=sharing', '/preview?rm=minimal&embedded=true');
                                editUrl = selectedTemplate.google_drive_url.replace('/view?usp=sharing', '/edit');
                              }
                              downloadUrl = selectedTemplate.google_drive_url;
                            } else {
                              // Fallback to local file with Google Docs Viewer
                              const docxUrl = `${window.location.origin}/api${selectedTemplate.file_path}`;
                              viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(docxUrl)}&embedded=true`;
                              downloadUrl = `/api${selectedTemplate.file_path}`;
                            }
                            
                            return (
                              <div>
                                <div style={{ position: 'relative' }}>
                                  <style>
                                    {`
                                      iframe[title="Word preview"] {
                                        width: 1000%;
                                        height: 6000px;
                                      }
                                      iframe[title="Word preview"] body,
                                      iframe[title="Word preview"] .kix-appview-editor-container {
                                        zoom: 0.75 !important;
                                        transform: scale(0.75) !important;
                                        transform-origin: top left !important;
                                      }
                                    `}
                                  </style>
                                  <div style={{ 
                                    width: '100%', 
                                    height: '600px', 
                                    overflow: 'auto',
                                    border: '1px solid #dee2e6',
                                    borderRadius: '4px'
                                  }}>
                                    <iframe
                                      src={viewerUrl}
                                      style={{
                                        width: '133.33%',
                                        height: '800px',
                                        border: 'none',
                                        transform: 'scale(0.75)',
                                        transformOrigin: 'top left'
                                      }}
                                      title="Word preview"
                                      allow="fullscreen"
                                      allowFullScreen
                                      frameBorder="0"
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          } else if (selectedTemplate.mime_type?.includes('pdf') || filePath.endsWith('.pdf')) {
                            return (
                              <iframe
                                src={`/api${selectedTemplate.file_path}#toolbar=0`}
                                style={{
                                  width: '100%',
                                  height: '350px',
                                  border: '1px solid #dee2e6',
                                  borderRadius: '4px'
                                }}
                                title="File preview"
                              />
                            );
                          } else if (selectedTemplate.mime_type?.startsWith('image/')) {
                            return (
                              <div className="text-center">
                                <img
                                  src={`/api${selectedTemplate.file_path}`}
                                  alt="File preview"
                                  style={{
                                    maxWidth: '100%',
                                    maxHeight: '350px',
                                    border: '1px solid #dee2e6',
                                    borderRadius: '4px'
                                  }}
                                />
                              </div>
                            );
                          } else {
                            return (
                              <div className="text-center p-4">
                                <i className="fas fa-file-alt fa-3x text-muted mb-2"></i>
                                <p className="text-muted mb-2">
                                  <strong>{selectedTemplate.file_name || 'File mẫu'}</strong>
                                </p>
                                <p className="text-muted small mb-3">
                                  Loại file: {selectedTemplate.mime_type || 'Không xác định'}
                                </p>
                                <Button
                                  variant="outline-primary"
                                  size="sm"
                                  href={`/api${selectedTemplate.file_path}`}
                                  target="_blank"
                                >
                                  <i className="fas fa-external-link-alt"></i> Mở file để xem
                                </Button>
                              </div>
                            );
                          }
                        })()}
                    </div>
                  )}
                </div>
              )}
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>
                File đính kèm {selectedTemplate && selectedTemplate.file_path ? '(đã chỉnh sửa)' : '(nếu có)'}
              </Form.Label>
              <Form.Control
                type="file"
                accept="*/*"
                onChange={(e) => setFormData({ ...formData, file: e.target.files[0] })}
              />
              <Form.Text className="text-muted">
                {selectedTemplate && selectedTemplate.file_path ? (
                  <>Sau khi tải về và chỉnh sửa mẫu giấy tờ, hãy tải file đã chỉnh sửa lên đây. File này sẽ được gửi để duyệt.</>
                ) : (
                  <>Nếu không chọn file, hệ thống sẽ sử dụng file mẫu (nếu có)</>
                )}
              </Form.Text>
              {formData.file && (
                <div className="mt-3">
                  <Badge bg="success" className="mb-2">
                    <i className="fas fa-check"></i> Đã chọn: {formData.file.name}
                  </Badge>
                  
                </div>
              )}
            </Form.Group>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
                Hủy
              </Button>
              <Button variant="primary" type="submit">
                Ký các giấy tờ
              </Button>
            </Modal.Footer>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Sign New Document Modal */}
      <Modal show={showSignNewDocumentModal} onHide={() => {
        setShowSignNewDocumentModal(false);
        setSignTotpCode('');
        setNewDocumentData(null);
        setSignaturePosition({ x: 100, y: 100, width: 200, height: 100 });
      }} size="xl" dialogClassName="modal-xl-custom">
        <style>
          {`
            .modal-xl-custom {
              max-width: 90%;
            }
            .modal-xl-custom .modal-content {
              max-height: 90vh;
              display: flex;
              flex-direction: column;
            }
            .modal-xl-custom .modal-body {
              overflow-y: auto;
              flex: 1;
              max-height: calc(90vh - 120px);
            }
            .signature-preview-container {
              position: relative;
              border: 2px dashed #dee2e6;
              min-height: 400px;
              background: #f8f9fa;
              overflow: auto;
              margin-bottom: 20px;
            }
            .signature-overlay {
              position: absolute;
              cursor: move;
              border: 2px solid #0d6efd;
              background: rgba(13, 110, 253, 0.1);
              z-index: 10;
            }
            .signature-overlay img {
              width: 100%;
              height: 100%;
              object-fit: contain;
            }
            .signature-overlay:hover {
              border-color: #0a58ca;
              background: rgba(13, 110, 253, 0.2);
            }
            .signature-overlay.dragging {
              opacity: 0.8;
            }
            .document-preview-container {
              border: 1px solid #dee2e6;
              border-radius: 4px;
              padding: 10px;
              background: white;
              margin-top: 20px;
            }
          `}
        </style>
        <Modal.Header closeButton>
          <Modal.Title>
            {newDocumentData?.routeId ? 'Ký và phê duyệt giấy tờ' : 'Ký các giấy tờ'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="info">
            {newDocumentData?.routeId ? (
              <>Kéo thả chữ ký để điều chỉnh vị trí trên giấy tờ. Sau đó nhập mã xác thực từ ứng dụng Authenticator và nhấn "Ký và phê duyệt" để hoàn tất.</>
            ) : (
              <>Kéo thả chữ ký để điều chỉnh vị trí trên giấy tờ. Sau đó nhập mã xác thực từ ứng dụng Authenticator và nhấn "Ký và gửi để duyệt" để hoàn tất.</>
            )}
          </Alert>
          
          {!userSignature || userSignature.status !== 'active' ? (
            <Alert variant="warning">
              Bạn cần có chữ ký số đã được kích hoạt để ký giấy tờ. Vui lòng đăng ký chữ ký số trước.
            </Alert>
          ) : (
            <>
              {/* Signature Position Container - Above document */}
              {userSignature && userSignature.signature_image_path && (
                <div className="mb-3">
                  <h6>Điều chỉnh vị trí chữ ký:</h6>
                  <div className="signature-preview-container" 
                    onMouseDown={(e) => {
                      if (e.target.closest('.signature-overlay')) {
                        setIsDragging(true);
                        const overlay = e.target.closest('.signature-overlay');
                        const container = e.currentTarget.getBoundingClientRect();
                        const overlayRect = overlay.getBoundingClientRect();
                        setDragStart({
                          x: e.clientX - overlayRect.left,
                          y: e.clientY - overlayRect.top
                        });
                      }
                    }}
                    onMouseMove={(e) => {
                      if (isDragging) {
                        const container = e.currentTarget.getBoundingClientRect();
                        const newX = Math.max(0, Math.min(e.clientX - container.left - dragStart.x, container.width - signaturePosition.width));
                        const newY = Math.max(0, Math.min(e.clientY - container.top - dragStart.y, container.height - signaturePosition.height));
                        setSignaturePosition({ ...signaturePosition, x: newX, y: newY });
                      }
                    }}
                    onMouseUp={() => setIsDragging(false)}
                    onMouseLeave={() => setIsDragging(false)}
                  >
                    {/* Signature Overlay */}
                    <div
                      className={`signature-overlay ${isDragging ? 'dragging' : ''}`}
                      style={{
                        left: `${signaturePosition.x}px`,
                        top: `${signaturePosition.y}px`,
                        width: `${signaturePosition.width}px`,
                        height: `${signaturePosition.height}px`
                      }}
                    >
                      <img
                        src={`/api${userSignature.signature_image_path}`}
                        alt="Signature"
                        draggable={false}
                      />
                    </div>
                  </div>

                  {/* Signature Position Controls */}
                  <div className="p-3 border rounded bg-light">
                    <div className="row">
                      <div className="col-md-3">
                        <Form.Label>Vị trí X (px)</Form.Label>
                        <Form.Control
                          type="number"
                          value={Math.round(signaturePosition.x)}
                          onChange={(e) => setSignaturePosition({ ...signaturePosition, x: parseInt(e.target.value) || 0 })}
                          min="0"
                        />
                      </div>
                      <div className="col-md-3">
                        <Form.Label>Vị trí Y (px)</Form.Label>
                        <Form.Control
                          type="number"
                          value={Math.round(signaturePosition.y)}
                          onChange={(e) => setSignaturePosition({ ...signaturePosition, y: parseInt(e.target.value) || 0 })}
                          min="0"
                        />
                      </div>
                      <div className="col-md-3">
                        <Form.Label>Chiều rộng (px)</Form.Label>
                        <Form.Control
                          type="number"
                          value={signaturePosition.width}
                          onChange={(e) => setSignaturePosition({ ...signaturePosition, width: parseInt(e.target.value) || 100 })}
                          min="50"
                          max="500"
                        />
                      </div>
                      <div className="col-md-3">
                        <Form.Label>Chiều cao (px)</Form.Label>
                        <Form.Control
                          type="number"
                          value={signaturePosition.height}
                          onChange={(e) => setSignaturePosition({ ...signaturePosition, height: parseInt(e.target.value) || 100 })}
                          min="50"
                          max="500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Authenticator Code Input */}
              <div className="mt-3">
                <Form.Group className="mb-3">
                  <Form.Label>Mã xác thực từ ứng dụng Authenticator (6 số) *</Form.Label>
                  <Form.Control
                    type="text"
                    maxLength={6}
                    pattern="[0-9]{6}"
                    value={signTotpCode}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      setSignTotpCode(value);
                    }}
                    placeholder="000000"
                    required
                  />
                  <Form.Text className="text-muted">
                    Nhập mã 6 số hiện tại từ ứng dụng Authenticator để ký và {newDocumentData?.routeId ? 'phê duyệt' : 'gửi'} giấy tờ
                  </Form.Text>
                </Form.Group>
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => {
            setShowSignNewDocumentModal(false);
            setSignTotpCode('');
            setNewDocumentData(null);
            setSignaturePosition({ x: 100, y: 100, width: 200, height: 100 });
          }}>
            Hủy
          </Button>
          <Button
            variant="success"
            onClick={handleSignAndSubmit}
            disabled={!userSignature || userSignature.status !== 'active' || !signTotpCode || signTotpCode.length !== 6}
          >
            <i className="fas fa-paper-plane"></i> {newDocumentData?.routeId ? 'Ký và phê duyệt' : 'Ký và gửi để duyệt'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Sign Document / Verify Signature Modal */}
      <Modal show={showSignModal} onHide={() => {
        setShowSignModal(false);
        if (pendingSignatureId) {
          setPendingSignatureId(null);
          setQrCode(null);
          setTotpSecret('');
          setTotpCode('');
        } else {
          setSignTotpCode('');
        }
      }} size={pendingSignatureId ? "lg" : "md"}>
        <Modal.Header closeButton>
          <Modal.Title>
            {pendingSignatureId ? 'Xác thực chữ ký ban đầu' : 'Ký giấy tờ'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {pendingSignatureId ? (
            <>
              <Alert variant="info">
                <strong>Thiết lập ứng dụng Authenticator:</strong>
                <br />
                1. Quét QR code bên dưới bằng ứng dụng Authenticator (Google Authenticator, Microsoft Authenticator, etc.)
                <br />
                2. Hoặc nhập khóa thiết lập thủ công: <strong>{totpSecret}</strong>
                <br />
                3. Sau đó nhập mã 6 số từ ứng dụng Authenticator để xác thực
              </Alert>
              {qrCode && (
                <div className="text-center mb-3">
                  <img src={qrCode} alt="QR Code" style={{ maxWidth: '300px', border: '1px solid #ddd', padding: '10px', borderRadius: '8px' }} />
                </div>
              )}
              <Form.Group className="mb-3">
                <Form.Label>Khóa thiết lập (nếu không quét được QR)</Form.Label>
                <Form.Control
                  type="text"
                  value={totpSecret}
                  readOnly
                  style={{ fontFamily: 'monospace', fontSize: '14px' }}
                />
                <Form.Text className="text-muted">
                  Sao chép khóa này và nhập vào ứng dụng Authenticator nếu không quét được QR code
                </Form.Text>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Mã xác thực từ ứng dụng Authenticator (6 số) *</Form.Label>
                <Form.Control
                  type="text"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  value={totpCode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, ''); // Only numbers
                    setTotpCode(value);
                  }}
                  placeholder="000000"
                  required
                />
                <Form.Text className="text-muted">
                  Nhập mã 6 số hiện tại từ ứng dụng Authenticator
                </Form.Text>
              </Form.Group>
            </>
          ) : (
            <>
              <Alert variant="warning">
                Vui lòng nhập mã xác thực từ ứng dụng Authenticator để ký giấy tờ
              </Alert>
              <Form.Group className="mb-3">
                <Form.Label>Mã xác thực từ ứng dụng Authenticator (6 số) *</Form.Label>
                <Form.Control
                  type="text"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  value={signTotpCode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, ''); // Only numbers
                    setSignTotpCode(value);
                  }}
                  placeholder="000000"
                  required
                />
                <Form.Text className="text-muted">
                  Nhập mã 6 số hiện tại từ ứng dụng Authenticator
                </Form.Text>
              </Form.Group>
            </>
          )}
          <Modal.Footer>
            <Button variant="secondary" onClick={() => {
              setShowSignModal(false);
              if (pendingSignatureId) {
                setPendingSignatureId(null);
                setQrCode(null);
                setTotpSecret('');
                setTotpCode('');
              } else {
                setSignTotpCode('');
              }
            }}>
              Hủy
            </Button>
            <Button
              variant="primary"
              onClick={pendingSignatureId ? handleVerifyInitialSignature : handleSignDocument}
              disabled={(pendingSignatureId && totpCode.length !== 6) || (!pendingSignatureId && signTotpCode.length !== 6)}
            >
              {pendingSignatureId ? 'Xác thực' : 'Ký'}
            </Button>
          </Modal.Footer>
        </Modal.Body>
      </Modal>

      {/* Routing Status Modal */}
      <Modal show={showRoutingModal} onHide={() => {
        setShowRoutingModal(false);
        setSelectedDocumentRouting(null);
        setRoutingHistory([]);
      }} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="fas fa-route"></i> Quá trình phê duyệt giấy tờ
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadingRouting ? (
            <div className="text-center p-4">
              <i className="fas fa-spinner fa-spin fa-2x"></i>
              <p className="mt-2">Đang tải quá trình phê duyệt...</p>
            </div>
          ) : selectedDocumentRouting && selectedDocumentRouting.routingTree ? (
            <div>
              {selectedDocumentRouting.routingTree.length === 0 ? (
                <Alert variant="info">
                  Giấy tờ này chưa có quá trình phê duyệt nào được thiết lập.
                </Alert>
              ) : (
                <div>
                  <Alert variant="info" className="mb-3">
                    <strong>Quá trình phê duyệt:</strong> Hiển thị các tài khoản trong phân luồng giấy tờ ({selectedDocumentRouting.routingTree.length} bước{selectedDocumentRouting.routingTree.length > 1 ? ' (song song)' : ''}). 
                    <i className="fas fa-check-circle text-success ms-2"></i> = Đã phê duyệt | 
                    <i className="fas fa-times-circle text-danger ms-2"></i> = Đã từ chối | 
                    <i className="fas fa-clock text-warning ms-2"></i> = Đang chờ xử lý
                  </Alert>
                  <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                    {selectedDocumentRouting.routingTree && Array.isArray(selectedDocumentRouting.routingTree) ? (
                      renderRoutingTree(selectedDocumentRouting.routingTree)
                    ) : (
                      <Alert variant="warning">
                        Dữ liệu phân luồng không hợp lệ. Vui lòng thử lại.
                      </Alert>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Alert variant="warning">
              Không thể tải quá trình phê duyệt. Vui lòng thử lại sau.
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => {
            setShowRoutingModal(false);
            setSelectedDocumentRouting(null);
            setRoutingHistory([]);
          }}>
            Đóng
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default PersonalDocuments;
