import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Card, Table, Button, Badge, Form, Modal, Spinner, Alert } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import { useTranslation } from 'react-i18next';
import Pagination from '../../components/Pagination';
import usePageTitle from '../../hooks/usePageTitle';
import { getApiBaseURL } from '../../utils/api';
import RichTextEditor from '../../components/RichTextEditor';
import '../../styles/user.css';

const stripHtml = (html) => {
  if (!html) return '';
  const d = document.createElement('div');
  d.innerHTML = html;
  return (d.textContent || d.innerText || '').trim();
};

// CSS styles matching UserManagement.js + file-upload như MonitoringPage
const announcementStyles = `
  .media-preview {
    max-width: 100%;
    max-height: 300px;
    border-radius: 0.5rem;
    margin-top: 1rem;
  }
  
  .comment-section {
    max-height: 400px;
    overflow-y: auto;
  }

  .announcement-file-upload-label { display: block; margin-bottom: 0.75rem; font-weight: 600; color: #495057; }
  .announcement-file-upload-container { position: relative; width: 100%; }
  .announcement-file-upload-input { position: absolute; opacity: 0; width: 100%; height: 100%; cursor: pointer; z-index: 2; }
  .announcement-file-upload-label-custom {
    display: flex; align-items: center; width: 100%; min-height: 120px; padding: 1rem;
    border: 2px dashed #dee2e6; border-radius: 12px;
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    cursor: pointer; transition: all 0.3s ease-in-out; position: relative; overflow: hidden;
  }
  .announcement-file-upload-label-custom:hover {
    border-color: #0d6efd; background: linear-gradient(135deg, #e7f1ff 0%, #cfe2ff 100%);
    transform: translateY(-2px); box-shadow: 0 8px 25px rgba(13, 110, 253, 0.15);
  }
  .announcement-file-upload-icon {
    width: 48px; height: 48px; background: linear-gradient(135deg, #0d6efd, #0a58ca);
    border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-size: 1.5rem; margin-right: 1rem;
  }
  .announcement-file-upload-text { flex: 1; display: flex; flex-direction: column; gap: 0.25rem; }
  .announcement-file-upload-title { font-weight: 600; font-size: 1rem; color: #212529; }
  .announcement-file-upload-subtitle { font-size: 0.875rem; color: #6c757d; }
  .announcement-file-upload-remove {
    width: 36px; height: 36px; border-radius: 50%; background: #dc3545; color: white;
    display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;
  }
  .announcement-file-upload-remove:hover { background: #c82333; }
  .announcement-file-upload-input:disabled + .announcement-file-upload-label-custom { opacity: 0.7; pointer-events: none; }

  .announcement-file-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
  .announcement-file-card {
    background: #fff; border: 1px solid #e9ecef; border-radius: 12px; padding: 1rem;
    transition: all 0.3s ease; overflow: hidden;
  }
  .announcement-file-card:hover { box-shadow: 0 8px 25px rgba(0,0,0,0.08); border-color: #0d6efd; }
  .announcement-file-header { display: flex; align-items: center; justify-content: flex-end; margin-bottom: 0.75rem; }
  .announcement-file-actions { display: flex; gap: 0.5rem; }
  .announcement-file-actions .btn { width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 8px; }
  .announcement-file-name { font-weight: 600; font-size: 0.95rem; color: #2c3e50; word-break: break-all; margin-bottom: 0.5rem; }
  .announcement-file-meta { font-size: 0.8rem; color: #6c757d; }
  .announcement-file-preview { width: 100%; border-radius: 8px; overflow: hidden; background: #f8f9fa; }
  .announcement-file-preview-img { width: 100%; height: auto; max-height: 240px; object-fit: contain; display: block; }
  .announcement-selected-file-tag {
    display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.5rem;
    background: #e7f1ff; border: 1px solid #0d6efd; border-radius: 6px; font-size: 0.875rem;
  }
  .announcement-selected-file-remove {
    border: none; background: transparent; color: #0d6efd; cursor: pointer; padding: 0 0.15rem; font-size: 1.1rem; line-height: 1;
  }
  .announcement-selected-file-remove:hover { color: #dc3545; }
  .announcement-file-preview-clickable { cursor: pointer; }
  .announcement-file-preview-clickable:hover { opacity: 0.92; }
  .announcement-fullscreen-overlay {
    position: fixed; inset: 0; z-index: 9999; display: flex; align-items: center; justify-content: center;
    background: rgba(0,0,0,0.92); cursor: pointer;
  }
  .announcement-fullscreen-overlay img {
    max-width: 100vw; max-height: 100vh; width: auto; height: auto; object-fit: contain; pointer-events: none;
  }
  .announcement-row-clickable:hover { background: rgba(13, 110, 253, 0.06); }
  .announcement-detail-modal .modal-header { background: linear-gradient(135deg, #f8f9fa 0%, #fff 100%); border-bottom: 1px solid #e9ecef; padding: 1rem 1.5rem; }
  .announcement-detail-modal .modal-title { display: flex; align-items: center; color: #212529;gap: 0.75rem; font-size: 1.125rem; font-weight: 600; }
  .announcement-detail-modal .modal-body { padding: 1.5rem; max-height: calc(100vh - 180px); overflow-y: auto; }
  @media (max-width: 768px) { .announcement-detail-modal .modal-body { padding: 1rem; } }
  @media (max-width: 576px) { .announcement-detail-modal .modal-body { padding: 0.75rem; max-height: calc(100vh - 140px); } }
  .announcement-author-info { display: flex; align-items: center; gap: 0.75rem; padding: 1rem; background: linear-gradient(135deg, #f8f9fa 0%, #fff 100%); border-radius: 0.75rem; margin-bottom: 1.5rem; border: 1px solid #e9ecef; }
  .announcement-author-avatar { width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #0d6efd 100%); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 600; font-size: 1rem; flex-shrink: 0; }
  .announcement-author-details { flex: 1; }
  .announcement-author-name { font-weight: 600; color: #212529; margin-bottom: 0.25rem; }
  .announcement-author-time { font-size: 0.875rem; color: #6c757d; display: flex; align-items: center; gap: 0.5rem; }
  .announcement-modal-content {
    font-size: 1rem; line-height: 1.7; color: #495057; margin-bottom: 1.5rem; padding: 1.25rem;
    background: #f8f9fa; border-radius: 0.75rem;
    box-sizing: border-box; width: 100%; max-width: 100%; min-width: 0;
    overflow-wrap: anywhere; word-wrap: break-word; word-break: break-all;
    overflow-x: hidden; overflow-y: visible;
  }
  .announcement-modal-content * {
    max-width: 100% !important; min-width: 0 !important; box-sizing: border-box !important;
    overflow-wrap: anywhere !important; word-wrap: break-word !important; word-break: break-all !important;
    white-space: normal !important;
  }
  .announcement-modal-content pre, .announcement-modal-content code { white-space: pre-wrap !important; }
  .announcement-modal-content img, .announcement-modal-content video, .announcement-modal-content iframe { max-width: 100% !important; height: auto; display: block; }
  .announcement-modal-content table { table-layout: fixed !important; width: 100% !important; }
  .announcement-modal-content td, .announcement-modal-content th { overflow-wrap: anywhere !important; word-break: break-all !important; }
  .announcement-modal-content a { color: #0d6efd; }
  @media (max-width: 768px) { .announcement-modal-content { padding: 1rem; font-size: 0.9375rem; } }
  @media (max-width: 576px) { .announcement-modal-content { padding: 0.75rem; font-size: 0.875rem; line-height: 1.6; margin-bottom: 1rem; } }
  .announcement-bug-card { padding: 0.75rem 1rem; border-radius: 0.5rem; margin-bottom: 0.75rem; border: 1px solid; }
  .announcement-bug-card.warning { background: #fff3cd; border-color: #ffc107; color: #856404; }
  .announcement-bug-card.info { background: #cfe2ff; border-color: #0d6efd; color: #084298; }
  .announcement-action-bar { display: flex; gap: 1rem; padding: 0.75rem 0; border-top: 1px solid #e9ecef; margin-top: 1rem; }
  .announcement-action-btn { display: inline-flex; align-items: center; gap: 0.5rem; background: none; border: none; color: #6c757d; font-size: 0.875rem; cursor: pointer; padding: 0.25rem 0; }
  .announcement-action-btn:hover { color: #0d6efd; }
  .announcement-action-btn.liked { color: #dc3545; }
  .announcement-comment-form { margin: 0.75rem 0; padding: 1.25rem; background: #f8f9fa; border-radius: 0.75rem; border: 1px solid #e9ecef; }
  .announcement-reply-indicator { padding: 0.75rem 1rem; background: #e7f3ff; border-left: 4px solid #0d6efd; border-radius: 0.5rem; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center; }
  .announcement-comment-input-group { display: flex; gap: 0.75rem; align-items: flex-end; }
  .announcement-comment-textarea { flex: 1; border: 1px solid #dee2e6; border-radius: 0.75rem; padding: 0.875rem 1rem; font-size: 0.9375rem; resize: none; min-height: 70px; max-height: 200px; overflow-y: auto; line-height: 1.5; }
  .announcement-comment-textarea:focus { outline: none; border-color: #0d6efd; box-shadow: 0 0 0 3px rgba(13,110,253,0.1); }
  .announcement-comment-submit { padding: 0.875rem 1.5rem; background: linear-gradient(135deg,#667eea 0%,#0d6efd 100%); border: none; border-radius: 0.75rem; color: white; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; height: fit-content; }
  .announcement-comment-submit:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(13,110,253,0.3); }
  .announcement-comment-submit:disabled { opacity: 0.6; cursor: not-allowed; }
  .announcement-comment-section { margin-top: 1.5rem; }
  .announcement-comments-list { padding-right: 0.5rem; }
  .announcement-comment-item { background: #fff; padding: 0.5rem; border-radius: 0.75rem; margin-bottom: 0.5rem; border: 1px solid #e9ecef; }
  .announcement-comment-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem; }
  .announcement-comment-author { display: flex; align-items: center; gap: 0.75rem; }
  .announcement-comment-avatar { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg,#667eea 0%,#0d6efd 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 0.875rem; flex-shrink: 0; }
  .announcement-comment-author-info { display: flex; flex-direction: column; }
  .announcement-comment-author-name { font-weight: 600; color: #212529; font-size: 0.9375rem; }
  .announcement-comment-time { font-size: 0.8125rem; color: #6c757d; }
  .announcement-comment-actions { display: flex; gap: 0.5rem; }
  .announcement-comment-action-btn { padding: 0.25rem 0.5rem; border: none; background: transparent; color: #6c757d; cursor: pointer; border-radius: 0.375rem; font-size: 0.875rem; }
  .announcement-comment-action-btn:hover { background: #f1f3f5; color: #212529; }
  .announcement-comment-action-btn.danger:hover { background: #ffe0e0; color: #dc3545; }
  .announcement-comment-action-btn.confirm { color: #28a745; }
  .announcement-comment-action-btn.confirm:hover { background: #d4edda; }
  .announcement-comment-action-btn.cancel { color: #6c757d; }
  .announcement-comment-content { color: #495057; line-height: 1.6; margin-bottom: 0.25rem; }
  .announcement-comment-replies { margin-top: 0.5rem; margin-left: 2.5rem; padding-left: 1rem; border-left: 3px solid #e9ecef; }
  .announcement-comment-reply-form { padding: 0.75rem; background: #f8f9fa; border-radius: 0.5rem; border: 1px solid #e9ecef; }
  .announcement-comment-reply-item { background: #f8f9fa; padding: 0.5rem; border-radius: 0.5rem; margin-bottom: 0.5rem; border: 1px solid #e9ecef; }
  .announcement-empty-comments { text-align: center; padding: 3rem 1rem; color: #6c757d; }
  .announcement-empty-comments i { font-size: 3rem; color: #dee2e6; margin-bottom: 1rem; display: block; }
`;

const AnnouncementManagement = () => {
    const { t } = useTranslation();
    const { currentUser } = useAuth();
    const { showAlert } = useAlert();
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [filterType, setFilterType] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    
    // Modal states
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
    // Detail modal: comments, like, reply (giống AnnouncementView)
    const [comments, setComments] = useState([]);
    const [loadingComments, setLoadingComments] = useState(false);
    const [commentText, setCommentText] = useState('');
    const [replyToComment, setReplyToComment] = useState(null);
    const [submittingComment, setSubmittingComment] = useState(false);
    const [commentIdToDelete, setCommentIdToDelete] = useState(null);
    const detailTextareaRef = useRef(null);
    
    // Form states
    const [formData, setFormData] = useState({
        type: 'emergency',
        title: '',
        content: '',
        bug_page: '',
        bug_description: '',
        media_type: 'none',
        media_url: '',
        media_list: [], // [{ url, type }, ...]
        is_emergency_visible: false,
        status: 'active'
    });
    
    const [submitting, setSubmitting] = useState(false);

    // Media upload – hỗ trợ nhiều file
    const [selectedMediaFiles, setSelectedMediaFiles] = useState([]);
    const [mediaUploading, setMediaUploading] = useState(false);
    // Object URLs cho xem trước ảnh (revoke khi đổi/remove để tránh leak)
    const [selectedPreviewUrls, setSelectedPreviewUrls] = useState([]);
    const selectedPreviewUrlsRef = useRef([]);
    // Fullscreen: click ảnh → chỉ hiển thị ảnh toàn màn hình, click đóng
    const [fullscreenImageUrl, setFullscreenImageUrl] = useState(null);

    usePageTitle('Quản lý Thông báo');

    useEffect(() => {
        selectedPreviewUrlsRef.current.forEach((u) => { try { URL.revokeObjectURL(u); } catch (_) {} });
        const urls = selectedMediaFiles.map((f) =>
            f && f.type && f.type.startsWith('image/') ? URL.createObjectURL(f) : null
        );
        selectedPreviewUrlsRef.current = urls;
        setSelectedPreviewUrls(urls);
        return () => {
            selectedPreviewUrlsRef.current.forEach((u) => { try { URL.revokeObjectURL(u); } catch (_) {} });
        };
    }, [selectedMediaFiles]);

    useEffect(() => {
        loadAnnouncements();
    }, [page, filterType, filterStatus]);

    const loadAnnouncements = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page,
                limit: 10,
                ...(filterType && { type: filterType }),
                ...(filterStatus && { status: filterStatus })
            });

            const response = await fetch(`${getApiBaseURL()}/announcements?${params}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) throw new Error('Failed to load announcements');

            const data = await response.json();
            setAnnouncements(data.data);
            setTotalPages(data.pagination.totalPages);
        } catch (error) {
            console.error('Load announcements error:', error);
            showAlert('Lỗi khi tải danh sách thông báo', 'danger');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateAnnouncement = async (e) => {
        e.preventDefault();
        
        if (!formData.title || !formData.content) {
            showAlert('Vui lòng điền đầy đủ thông tin bắt buộc', 'warning');
            return;
        }

        try {
            setSubmitting(true);
            let payload = { ...formData };
            const hasNew = selectedMediaFiles && selectedMediaFiles.length > 0;
            if (hasNew) {
                setMediaUploading(true);
                try {
                    const uploaded = await uploadSelectedMedia();
                    const existing = Array.isArray(formData.media_list) ? formData.media_list : (formData.media_url ? [{ url: formData.media_url, type: formData.media_type || 'image' }] : []);
                    const media_list = [...existing, ...uploaded];
                    const first = media_list[0];
                    payload = {
                        ...payload,
                        media_list,
                        media_url: first ? first.url : '',
                        media_type: first ? first.type : 'none'
                    };
                    showAlert(`Đã tải ${uploaded.length} file lên thành công`, 'success');
                } finally {
                    setMediaUploading(false);
                }
            }
            const response = await fetch(`${getApiBaseURL()}/announcements`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('Failed to create announcement');

            showAlert('Tạo thông báo thành công', 'success');
            setShowCreateModal(false);
            resetForm();
            loadAnnouncements();
            if (payload.is_emergency_visible) window.dispatchEvent(new CustomEvent('announcements-banner-updated'));
        } catch (error) {
            console.error('Create announcement error:', error);
            showAlert(error.message || 'Lỗi khi tạo thông báo', 'danger');
        } finally {
            setSubmitting(false);
            setMediaUploading(false);
        }
    };

    const handleUpdateAnnouncement = async (e) => {
        e.preventDefault();
        
        if (!selectedAnnouncement) return;

        try {
            setSubmitting(true);
            let payload = { ...formData };
            const hasNew = selectedMediaFiles && selectedMediaFiles.length > 0;
            if (hasNew) {
                setMediaUploading(true);
                try {
                    const uploaded = await uploadSelectedMedia();
                    const existing = Array.isArray(formData.media_list) ? formData.media_list : (formData.media_url ? [{ url: formData.media_url, type: formData.media_type || 'image' }] : []);
                    const media_list = [...existing, ...uploaded];
                    const first = media_list[0];
                    payload = {
                        ...payload,
                        media_list,
                        media_url: first ? first.url : '',
                        media_type: first ? first.type : 'none'
                    };
                    showAlert(`Đã tải ${uploaded.length} file lên thành công`, 'success');
                } finally {
                    setMediaUploading(false);
                }
            }
            const response = await fetch(`${getApiBaseURL()}/announcements/${selectedAnnouncement.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('Failed to update announcement');

            showAlert('Cập nhật thông báo thành công', 'success');
            setShowEditModal(false);
            resetForm();
            loadAnnouncements();
            if (payload.is_emergency_visible) window.dispatchEvent(new CustomEvent('announcements-banner-updated'));
        } catch (error) {
            console.error('Update announcement error:', error);
            showAlert(error.message || 'Lỗi khi cập nhật thông báo', 'danger');
        } finally {
            setSubmitting(false);
            setMediaUploading(false);
        }
    };

    const handleDeleteAnnouncement = async () => {
        if (!selectedAnnouncement) return;

        try {
            setSubmitting(true);
            const response = await fetch(`${getApiBaseURL()}/announcements/${selectedAnnouncement.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) throw new Error('Failed to delete announcement');

            showAlert('Xóa thông báo thành công', 'success');
            setShowDeleteModal(false);
            setSelectedAnnouncement(null);
            loadAnnouncements();
        } catch (error) {
            console.error('Delete announcement error:', error);
            showAlert('Lỗi khi xóa thông báo', 'danger');
        } finally {
            setSubmitting(false);
        }
    };

    const openEditModal = (announcement) => {
        setSelectedAnnouncement(announcement);
        setSelectedMediaFiles([]);
        const media_list = Array.isArray(announcement.media_list) && announcement.media_list.length > 0
            ? announcement.media_list
            : (announcement.media_url ? [{ url: announcement.media_url, type: announcement.media_type || 'image' }] : []);
        setFormData({
            type: announcement.type,
            title: announcement.title,
            content: announcement.content,
            bug_page: announcement.bug_page || '',
            bug_description: announcement.bug_description || '',
            media_type: announcement.media_type || 'none',
            media_url: announcement.media_url || '',
            media_list,
            is_emergency_visible: announcement.is_emergency_visible || false,
            status: announcement.status
        });
        setShowEditModal(true);
    };

    const openDeleteModal = (announcement) => {
        setSelectedAnnouncement(announcement);
        setShowDeleteModal(true);
    };

    const loadComments = async (announcementId) => {
        try {
            setLoadingComments(true);
            const response = await fetch(`${getApiBaseURL()}/announcements/${announcementId}/comments`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (!response.ok) throw new Error('Failed to load comments');
            const data = await response.json();
            setComments(data.data || []);
        } catch (error) {
            console.error('Load comments error:', error);
            showAlert('Lỗi khi tải bình luận', 'danger');
        } finally {
            setLoadingComments(false);
        }
    };

    const handleLike = async (announcementId) => {
        try {
            const response = await fetch(`${getApiBaseURL()}/announcements/${announcementId}/like`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (!response.ok) throw new Error('Failed to like');
            const data = await response.json();
            setAnnouncements(prev => prev.map(a =>
                a.id === announcementId
                    ? { ...a, user_liked: data.liked ? 1 : 0, likes_count: data.liked ? a.likes_count + 1 : (a.likes_count - 1) }
                    : a
            ));
            if (selectedAnnouncement && selectedAnnouncement.id === announcementId) {
                setSelectedAnnouncement(prev => ({
                    ...prev,
                    user_liked: data.liked ? 1 : 0,
                    likes_count: data.liked ? prev.likes_count + 1 : (prev.likes_count - 1)
                }));
            }
        } catch (error) {
            console.error('Like error:', error);
            showAlert('Lỗi khi thích bài viết', 'danger');
        }
    };

    const autoResizeDetailTextarea = () => {
        const ta = detailTextareaRef.current;
        if (!ta) return;
        ta.style.height = 'auto';
        if (!commentText.trim()) ta.style.height = '70px';
        else ta.style.height = `${Math.min(Math.max(ta.scrollHeight, 70), 200)}px`;
    };

    const handleDetailAddComment = async (e) => {
        e.preventDefault();
        if (!commentText.trim() || !selectedAnnouncement) return;
        const previousComments = [...comments];
        const commentTextBackup = commentText;
        const replyToCommentBackup = replyToComment;
        const tempComment = {
            id: `temp-${Date.now()}`,
            content: commentText.trim(),
            user_id: currentUser?.id,
            user_name: currentUser?.full_name || currentUser?.username || 'Bạn',
            username: currentUser?.username,
            created_at: new Date().toISOString(),
            parent_comment_id: replyToComment?.id || null,
            replies: []
        };
        if (replyToComment) {
            setComments(prev => prev.map(c =>
                c.id === replyToComment.id ? { ...c, replies: [...(c.replies || []), tempComment] } : c
            ));
        } else {
            setComments(prev => [tempComment, ...prev]);
        }
        setSelectedAnnouncement(prev => ({ ...prev, comments_count: (prev.comments_count || 0) + 1 }));
        setCommentText('');
        setReplyToComment(null);
        setTimeout(() => { if (detailTextareaRef.current) detailTextareaRef.current.style.height = '70px'; }, 0);
        try {
            setSubmittingComment(true);
            const res = await fetch(`${getApiBaseURL()}/announcements/${selectedAnnouncement.id}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ content: commentTextBackup, parent_comment_id: replyToCommentBackup?.id || null })
            });
            if (!res.ok) throw new Error('Failed to add comment');
            const json = await res.json();
            const newComment = json.data;
            if (replyToCommentBackup) {
                setComments(prev => prev.map(c =>
                    c.id === replyToCommentBackup.id
                        ? { ...c, replies: (c.replies || []).map(r => (r.id === tempComment.id ? newComment : r)) }
                        : c
                ));
            } else {
                setComments(prev => prev.map(c => (c.id === tempComment.id ? newComment : c)));
            }
        } catch (err) {
            console.error(err);
            setComments(previousComments);
            setCommentText(commentTextBackup);
            setReplyToComment(replyToCommentBackup);
            setSelectedAnnouncement(prev => ({ ...prev, comments_count: Math.max(0, (prev.comments_count || 0) - 1) }));
            showAlert('Lỗi khi thêm bình luận', 'danger');
        } finally {
            setSubmittingComment(false);
        }
    };

    const handleDetailDeleteComment = async (commentId) => {
        if (!selectedAnnouncement) return;
        const previousComments = [...comments];
        const remove = (list, id) =>
            list.filter(c => c.id !== id).map(c => ({
                ...c,
                replies: (c.replies || []).filter(r => r.id !== id)
            }));
        setComments(remove(comments, commentId));
        setSelectedAnnouncement(prev => ({ ...prev, comments_count: Math.max(0, (prev.comments_count || 0) - 1) }));
        setCommentIdToDelete(null);
        try {
            const res = await fetch(`${getApiBaseURL()}/announcements/${selectedAnnouncement.id}/comments/${commentId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (!res.ok) throw new Error('Failed to delete');
            showAlert('Đã xóa bình luận', 'success');
        } catch (err) {
            console.error(err);
            setComments(previousComments);
            setSelectedAnnouncement(prev => ({ ...prev, comments_count: (prev.comments_count || 0) + 1 }));
            showAlert('Lỗi khi xóa bình luận', 'danger');
        }
    };

    useEffect(() => {
        if (detailTextareaRef.current) {
            detailTextareaRef.current.style.height = 'auto';
            if (!commentText.trim()) detailTextareaRef.current.style.height = '70px';
            else detailTextareaRef.current.style.height = `${Math.min(Math.max(detailTextareaRef.current.scrollHeight, 70), 200)}px`;
        }
    }, [commentText]);

    const renderDetailReplyForm = (comment) => {
        if (replyToComment?.id !== comment.id) return null;
        return (
            <div className="announcement-comment-reply-form" style={{ marginTop: '0.75rem', marginLeft: '2.5rem' }}>
                <div className="announcement-reply-indicator" style={{ marginBottom: '0.75rem' }}>
                    <small><i className="bi bi-reply me-2"></i>Đang trả lời <strong>{replyToComment.user_name || replyToComment.username}</strong></small>
                    <button type="button" className="btn-close" onClick={() => setReplyToComment(null)} style={{ fontSize: '0.75rem' }} aria-label="Hủy"></button>
                </div>
                <Form onSubmit={handleDetailAddComment}>
                    <div className="announcement-comment-input-group">
                        <Form.Control
                            ref={detailTextareaRef}
                            as="textarea"
                            placeholder="Viết bình luận..."
                            value={commentText}
                            onChange={(e) => { setCommentText(e.target.value); requestAnimationFrame(autoResizeDetailTextarea); }}
                            onInput={() => requestAnimationFrame(autoResizeDetailTextarea)}
                            onFocus={() => setTimeout(() => { if (detailTextareaRef.current) detailTextareaRef.current.style.height = commentText.trim() ? 'auto' : '70px'; autoResizeDetailTextarea(); }, 0)}
                            disabled={submittingComment}
                            className="announcement-comment-textarea"
                        />
                        <button type="submit" className="announcement-comment-submit" disabled={!commentText.trim() || submittingComment}>
                            {submittingComment ? <Spinner as="span" animation="border" size="sm" /> : <><i className="bi bi-send"></i><span>Gửi</span></>}
                        </button>
                    </div>
                </Form>
            </div>
        );
    };

    const renderDetailComments = () => {
        if (loadingComments) return <div className="text-center py-4"><Spinner animation="border" size="sm" /><p className="text-muted mt-2 mb-0">Đang tải bình luận...</p></div>;
        if (comments.length === 0) return <div className="announcement-empty-comments"><i className="bi bi-chat-left-text"></i><p>Chưa có bình luận nào</p></div>;
        return (
            <div className="announcement-comment-section">
                <div className="announcement-comments-list">
                    {comments.map((comment) => (
                        <div key={comment.id} className="announcement-comment-item">
                            <div className="announcement-comment-header">
                                <div className="announcement-comment-author">
                                    <div className="announcement-comment-avatar">{getInitials(comment.user_name || comment.username)}</div>
                                    <div className="announcement-comment-author-info">
                                        <div className="announcement-comment-author-name">{comment.user_name || comment.username}</div>
                                        <div className="announcement-comment-time">{new Date(comment.created_at).toLocaleString('vi-VN')}</div>
                                    </div>
                                </div>
                                <div className="announcement-comment-actions">
                                    {commentIdToDelete === comment.id ? (
                                        <><button type="button" className="announcement-comment-action-btn confirm" onClick={() => handleDetailDeleteComment(comment.id)} title="Xác nhận xóa"><i className="bi bi-check-lg"></i></button><button type="button" className="announcement-comment-action-btn cancel" onClick={() => setCommentIdToDelete(null)} title="Hủy"><i className="bi bi-x-lg"></i></button></>
                                    ) : (
                                        <><button type="button" className="announcement-comment-action-btn" onClick={() => setReplyToComment(comment)} title="Trả lời"><i className="bi bi-reply"></i></button>{(currentUser?.id === comment.user_id || currentUser?.role === 'superadmin') && <button type="button" className="announcement-comment-action-btn danger" onClick={() => setCommentIdToDelete(comment.id)} title="Xóa"><i className="bi bi-trash"></i></button>}</>
                                    )}
                                </div>
                            </div>
                            <div className="announcement-comment-content" dangerouslySetInnerHTML={{ __html: comment.content || '' }} />
                            {renderDetailReplyForm(comment)}
                            {comment.replies?.length > 0 && (
                                <div className="announcement-comment-replies">
                                    {comment.replies.map((reply) => (
                                        <div key={reply.id} className="announcement-comment-reply-item">
                                            <div className="announcement-comment-header">
                                                <div className="announcement-comment-author">
                                                    <div className="announcement-comment-avatar" style={{ width: 32, height: 32, fontSize: '0.75rem' }}>{getInitials(reply.user_name || reply.username)}</div>
                                                    <div className="announcement-comment-author-info">
                                                        <div className="announcement-comment-author-name" style={{ fontSize: '0.875rem' }}>{reply.user_name || reply.username}</div>
                                                        <div className="announcement-comment-time" style={{ fontSize: '0.75rem' }}>{new Date(reply.created_at).toLocaleString('vi-VN')}</div>
                                                    </div>
                                                </div>
                                                {(currentUser?.id === reply.user_id || currentUser?.role === 'superadmin') && (
                                                    <div className="announcement-comment-actions">
                                                        {commentIdToDelete === reply.id ? <><button type="button" className="announcement-comment-action-btn confirm" onClick={() => handleDetailDeleteComment(reply.id)}><i className="bi bi-check-lg"></i></button><button type="button" className="announcement-comment-action-btn cancel" onClick={() => setCommentIdToDelete(null)}><i className="bi bi-x-lg"></i></button></> : <button type="button" className="announcement-comment-action-btn danger" onClick={() => setCommentIdToDelete(reply.id)}><i className="bi bi-trash"></i></button>}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="announcement-comment-content" style={{ fontSize: '0.9375rem' }} dangerouslySetInnerHTML={{ __html: reply.content || '' }} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const resetForm = () => {
        setFormData({
            type: 'emergency',
            title: '',
            content: '',
            bug_page: '',
            bug_description: '',
            media_type: 'none',
            media_url: '',
            media_list: [],
            is_emergency_visible: false,
            status: 'active'
        });
        setSelectedAnnouncement(null);
        setSelectedMediaFiles([]);
    };

    const handleMediaFileChange = (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        const newFiles = Array.from(files);
        setSelectedMediaFiles(prev => [...(prev || []), ...newFiles]);
        e.target.value = ''; // Cho phép chọn lại cùng file hoặc thêm đợt mới
    };

    const handleMediaFileRemove = (index, e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        setSelectedMediaFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleMediaRemoveUploaded = (index) => {
        setFormData(prev => {
            const list = Array.isArray(prev.media_list) ? [...prev.media_list] : [];
            const next = list.filter((_, i) => i !== index);
            const first = next[0];
            return {
                ...prev,
                media_list: next,
                media_url: first ? first.url : '',
                media_type: first ? first.type : 'none'
            };
        });
    };

    /** Tải tất cả file đã chọn lên server, trả về [{ url, type }, ...]. Gọi khi nhấn Tạo/Cập nhật. */
    const uploadSelectedMedia = async () => {
        if (!selectedMediaFiles || selectedMediaFiles.length === 0) {
            return Array.isArray(formData.media_list) ? formData.media_list : (formData.media_url ? [{ url: formData.media_url, type: formData.media_type || 'image' }] : []);
        }
        const token = localStorage.getItem('token');
        const base = getApiBaseURL();
        const list = [];
        for (const file of selectedMediaFiles) {
            const form = new FormData();
            form.append('file', file);
            const res = await fetch(`${base}/announcements/upload-media`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: form
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Upload thất bại');
            if (data.success && data.media_url != null) {
                list.push({ url: data.media_url, type: data.media_type || 'image' });
            } else {
                throw new Error(data.message || 'Upload thất bại');
            }
        }
        return list;
    };

    const getMediaDisplayUrl = (url) => {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        const base = getApiBaseURL();
        const baseRoot = (base && base.startsWith('http')) ? base.replace(/\/api\/?$/, '') : (typeof window !== 'undefined' ? window.location.origin : '');
        return `${baseRoot}${url.startsWith('/') ? '' : '/'}${url}`;
    };

    const getMediaFileIcon = (mediaType) => {
        return mediaType === 'video' ? 'bi bi-file-earmark-play-fill' : 'bi bi-file-earmark-image-fill';
    };

    const getTypeBadge = (type) => {
        const badges = {
            emergency: { bg: 'danger', text: 'Khẩn cấp', icon: 'exclamation-triangle-fill' },
            bug_fix: { bg: 'warning', text: 'Sửa lỗi', icon: 'bug-fill' },
            news: { bg: 'info', text: 'Tin tức', icon: 'newspaper' },
            maintenance: { bg: 'secondary', text: 'Bảo trì', icon: 'tools' }
        };
        const typeOrder = ['emergency', 'bug_fix', 'news', 'maintenance'];
        const normalized = (type === null || type === undefined)
            ? 'news'
            : typeof type === 'number' && type >= 0 && type < typeOrder.length
                ? typeOrder[type]
                : String(type);
        return badges[normalized] || { ...badges.news, icon: 'newspaper' };
    };

    const getInitials = (name) => {
        if (!name) return 'A';
        return name.split(' ').map((n) => n[0]).join('').toUpperCase().substring(0, 2);
    };

    /** Render media cho modal chi tiết (hỗ trợ media_list hoặc media_url/media_type) */
    const renderDetailMedia = (announcement) => {
        const list = Array.isArray(announcement.media_list) && announcement.media_list.length > 0
            ? announcement.media_list
            : (announcement.media_url ? [{ url: announcement.media_url, type: announcement.media_type || 'image' }] : []);
        if (list.length === 0) return null;
        return (
            <div className="announcement-detail-media mt-3">
                {list.map((item, idx) => (
                    <div key={idx} className="mb-3">
                        {item.type === 'image' ? (
                            <img
                                src={getMediaDisplayUrl(item.url)}
                                alt=""
                                className="media-preview"
                                style={{ maxWidth: '100%', maxHeight: 320, objectFit: 'contain', borderRadius: 8 }}
                            />
                        ) : (
                            <video
                                src={getMediaDisplayUrl(item.url)}
                                controls
                                className="media-preview"
                                style={{ maxWidth: '100%', maxHeight: 320, borderRadius: 8 }}
                            />
                        )}
                    </div>
                ))}
            </div>
        );
    };

    const getStatusBadge = (status) => {
        const badges = {
            active: { bg: 'success', text: 'Hoạt động' },
            archived: { bg: 'secondary', text: 'Lưu trữ' },
            draft: { bg: 'warning', text: 'Nháp' }
        };
        return badges[status] || badges.active;
    };

    const renderAnnouncementForm = (isEdit = false) => (
        <Form onSubmit={(e) => {
            e.preventDefault();
            if (isEdit) {
                handleUpdateAnnouncement(e);
            } else {
                handleCreateAnnouncement(e);
            }
        }}>
            <div className="session-card mb-4">
                <div className="card-header-modern">
                    <div className="header-icon">
                        <i className="bi bi-bullhorn"></i>
                    </div>
                    <h6 className="mb-0">Thông tin cơ bản</h6>
                </div>
                <div className="card-body-modern">
                    <Row>
                        <Col md={4}>
                            <Form.Group className="mb-3">
                                <Form.Label className="info-label">
                                    <i className="bi bi-tag me-2"></i>
                                    Loại thông báo <span className="text-danger">*</span>
                                </Form.Label>
                                <Form.Select
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                    required
                                    className="form-control-modern"
                                >
                                    <option value="emergency">Khẩn cấp</option>
                                    <option value="bug_fix">Sửa lỗi</option>
                                    <option value="news">Tin tức</option>
                                    <option value="maintenance">Bảo trì</option>
                                </Form.Select>
                            </Form.Group>
                        </Col>
                        <Col md={4}>
                            <Form.Group className="mb-3">
                                <Form.Label className="info-label">
                                    <i className="bi bi-flag me-2"></i>
                                    Trạng thái
                                </Form.Label>
                                <Form.Select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className="form-control-modern"
                                >
                                    <option value="active">Hoạt động</option>
                                    <option value="draft">Nháp</option>
                                    <option value="archived">Lưu trữ</option>
                                </Form.Select>
                            </Form.Group>
                        </Col>
                        <Col md={4}>
                            <Form.Group className="mb-3">
                                <Form.Label className="info-label">
                                    <i className="bi bi-exclamation-triangle me-2"></i>
                                    Hiển thị banner trên header
                                </Form.Label>
                                <div className="d-flex flex-column gap-1 pt-2">
                                    {(formData.type === 'emergency' || formData.type === 'news' || formData.type === 'maintenance') ? (
                                        <>
                                            <Form.Check
                                                type="checkbox"
                                                label="Bật hiển thị"
                                                checked={formData.is_emergency_visible}
                                                onChange={(e) => setFormData({ ...formData, is_emergency_visible: e.target.checked })}
                                                className="form-check-modern mb-0"
                                            />
                                            <span className="text-muted small">Chỉ 1 bài được hiển thị trên header. Bật bài này sẽ tắt bài cũ.</span>
                                        </>
                                    ) : (
                                        <span className="text-muted small">Chỉ áp dụng cho Khẩn cấp, Tin tức, Bảo trì</span>
                                    )}
                                </div>
                            </Form.Group>
                        </Col>
                    </Row>

                    <Form.Group className="mb-3">
                        <Form.Label className="info-label">
                            <i className="bi bi-type me-2"></i>
                            Tiêu đề <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Control
                            type="text"
                            placeholder="Nhập tiêu đề thông báo"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            required
                            className="form-control-modern"
                        />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label className="info-label">
                            <i className="bi bi-file-text me-2"></i>
                            Nội dung <span className="text-danger">*</span>
                        </Form.Label>
                        <RichTextEditor
                            value={formData.content}
                            onChange={(val) => setFormData({ ...formData, content: val })}
                            placeholder="Nhập nội dung thông báo"
                        />
                    </Form.Group>
                </div>
            </div>

            {formData.type === 'bug_fix' && (
                <div className="session-card mb-4">
                    <div className="card-header-modern">
                        <div className="header-icon">
                            <i className="bi bi-bug"></i>
                        </div>
                        <h6 className="mb-0">Thông tin lỗi</h6>
                    </div>
                    <div className="card-body-modern">
                        <Form.Group className="mb-3">
                            <Form.Label className="info-label">
                                <i className="bi bi-window me-2"></i>
                                Lỗi xuất hiện ở trang
                            </Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="VD: Trang điểm danh"
                                value={formData.bug_page}
                                onChange={(e) => setFormData({ ...formData, bug_page: e.target.value })}
                                className="form-control-modern"
                            />
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label className="info-label">
                                <i className="bi bi-exclamation-triangle me-2"></i>
                                Mô tả lỗi
                            </Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={3}
                                placeholder="Mô tả chi tiết lỗi"
                                value={formData.bug_description}
                                onChange={(e) => setFormData({ ...formData, bug_description: e.target.value })}
                                className="form-control-modern"
                            />
                        </Form.Group>
                    </div>
                </div>
            )}

            <div className="session-card mb-4 announcement-media-card">
                <div className="card-header-modern">
                    <div className="header-icon">
                        <i className="bi bi-image"></i>
                    </div>
                    <h6 className="mb-0">Media</h6>
                </div>
                <div className="card-body-modern">
                    <div className="mb-3">
                        <label className="announcement-file-upload-label">
                            <i className="bi bi-cloud-upload me-2"></i>
                            Ảnh hoặc video (tùy chọn, có thể chọn nhiều)
                        </label>
                        <div className="announcement-file-upload-container">
                            <input
                                type="file"
                                id="announcement-media-upload"
                                className="announcement-file-upload-input"
                                onChange={handleMediaFileChange}
                                disabled={submitting}
                                accept="image/*,video/*"
                                multiple
                            />
                            <label htmlFor="announcement-media-upload" className="announcement-file-upload-label-custom">
                                <div className="announcement-file-upload-icon">
                                    <i className="bi bi-cloud-upload-alt"></i>
                                </div>
                                <div className="announcement-file-upload-text">
                                    <span className="announcement-file-upload-title">
                                        {selectedMediaFiles.length > 0
                                            ? `Đã chọn ${selectedMediaFiles.length} file`
                                            : 'Chọn một hoặc nhiều file ảnh/video'}
                                    </span>
                                    <span className="announcement-file-upload-subtitle">
                                        {selectedMediaFiles.length > 0
                                            ? 'Sẽ tải lên khi nhấn Tạo/Cập nhật. Có thể chọn thêm file nhiều lần.'
                                            : 'Chọn nhiều file trong một lần (Ctrl/Shift) hoặc chọn thêm từng đợt. JPG, PNG, GIF, WebP, MP4, WebM, ...'}
                                    </span>
                                </div>
                            </label>
                        </div>
                        {selectedMediaFiles.length > 0 && (
                            <div className="mt-3 announcement-selected-preview">
                                <div className="d-flex align-items-center justify-content-between mb-2">
                                    <h6 className="fw-bold mb-0 text-primary">
                                        <i className="bi bi-images me-2"></i>
                                        Xem trước file đã chọn ({selectedMediaFiles.length})
                                    </h6>
                                    <Badge bg="primary">{selectedMediaFiles.length} file</Badge>
                                </div>
                                <div className="announcement-file-grid">
                                    {selectedMediaFiles.map((file, i) => {
                                        const isImage = file.type && file.type.startsWith('image/');
                                        const previewUrl = selectedPreviewUrls[i] || null;
                                        return (
                                            <div key={i} className="announcement-file-card">
                                                <div className="announcement-file-header">
                                                    <div className="announcement-file-actions">
                                                        <Button
                                                            size="sm"
                                                            variant="outline-danger"
                                                            onClick={(e) => handleMediaFileRemove(i, e)}
                                                            title="Bỏ chọn file"
                                                        >
                                                            <i className="bi bi-trash"></i>
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div className="announcement-file-info">
                                                    <div className="announcement-file-name">{file.name}</div>
                                                    <div className="announcement-file-meta">
                                                        <span className="badge bg-secondary">{isImage ? 'Ảnh' : 'Video'}</span>
                                                    </div>
                                                </div>
                                                {isImage && previewUrl ? (
                                                    <div
                                                        className="announcement-file-preview announcement-file-preview-clickable mt-2"
                                                        onClick={() => setFullscreenImageUrl(previewUrl)}
                                                        role="button"
                                                        tabIndex={0}
                                                        onKeyDown={(e) => e.key === 'Enter' && setFullscreenImageUrl(previewUrl)}
                                                        title="Click xem toàn màn hình"
                                                    >
                                                        <img
                                                            src={previewUrl}
                                                            alt={`Xem trước ${file.name}`}
                                                            className="announcement-file-preview-img"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="announcement-file-preview mt-2 d-flex align-items-center justify-content-center bg-secondary bg-opacity-10 rounded overflow-hidden" style={{ minHeight: 120 }}>
                                                        <i className="bi bi-file-earmark-play-fill text-secondary" style={{ fontSize: '3rem' }}></i>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {(() => {
                        const mediaList = Array.isArray(formData.media_list) && formData.media_list.length > 0
                            ? formData.media_list
                            : (formData.media_url ? [{ url: formData.media_url, type: formData.media_type || 'image' }] : []);
                        return mediaList.length > 0 ? (
                            <div className="announcement-media-uploaded">
                                <div className="d-flex align-items-center justify-content-between mb-2">
                                    <h6 className="fw-bold mb-0">
                                        <i className="bi bi-folder2-open me-2 text-primary"></i>
                                        Media đã tải
                                    </h6>
                                    <Badge bg="primary">{mediaList.length} file</Badge>
                                </div>
                                <div className="announcement-file-grid">
                                    {mediaList.map((item, idx) => (
                                        <div key={idx} className="announcement-file-card">
                                            <div className="announcement-file-header">
                                                <div className="announcement-file-actions">
                                                    <Button
                                                        size="sm"
                                                        variant="outline-danger"
                                                        onClick={() => handleMediaRemoveUploaded(idx)}
                                                        title="Xóa media"
                                                    >
                                                        <i className="bi bi-trash"></i>
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="announcement-file-info">
                                                <div className="announcement-file-name">
                                                    {(item.url || '').split('/').pop() || 'Media'}
                                                </div>
                                                <div className="announcement-file-meta">
                                                    <span className="badge bg-secondary">{item.type === 'video' ? 'Video' : 'Ảnh'}</span>
                                                </div>
                                            </div>
                                            {item.type === 'image' && item.url && (
                                                <div
                                                    className="announcement-file-preview announcement-file-preview-clickable mt-2"
                                                    onClick={() => setFullscreenImageUrl(getMediaDisplayUrl(item.url))}
                                                    role="button"
                                                    tabIndex={0}
                                                    onKeyDown={(e) => e.key === 'Enter' && setFullscreenImageUrl(getMediaDisplayUrl(item.url))}
                                                    title="Click xem toàn màn hình"
                                                >
                                                    <img
                                                        src={getMediaDisplayUrl(item.url)}
                                                        alt="Xem trước"
                                                        className="announcement-file-preview-img"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : selectedMediaFiles.length > 0 ? (
                            <div className="text-center text-muted py-3">
                                <i className="bi bi-file-earmark-plus fa-2x d-block mb-2 text-primary"></i>
                                <span className="small">Đã chọn <strong>{selectedMediaFiles.length} file</strong>. Sẽ tải lên khi nhấn Tạo thông báo hoặc Cập nhật.</span>
                            </div>
                        ) : (
                            <div className="text-center text-muted py-3">
                                <i className="bi bi-image fa-2x d-block mb-2"></i>
                                <span className="small">Chưa có media. Chọn file – file sẽ được tải lên khi nhấn Tạo thông báo hoặc Cập nhật.</span>
                            </div>
                        );
                    })()}
                </div>
            </div>

        </Form>
    );

    if (currentUser?.role !== 'superadmin') {
        return (
            <Container className="mt-4">
                <Alert variant="danger">
                    Bạn không có quyền truy cập trang này
                </Alert>
            </Container>
        );
    }

    return (
        <>
            <style>{announcementStyles}</style>
            {fullscreenImageUrl && (
                <div
                    className="announcement-fullscreen-overlay"
                    onClick={() => setFullscreenImageUrl(null)}
                    onKeyDown={(e) => e.key === 'Escape' && setFullscreenImageUrl(null)}
                    role="button"
                    tabIndex={0}
                    aria-label="Đóng xem ảnh"
                >
                    <img src={fullscreenImageUrl} alt="" />
                </div>
            )}
            <Container fluid className="py-4">
                <Row className="mb-4">
                    <Col>
                        <h2 className="mb-0">Quản lý Thông báo</h2>
                        <p className="text-muted">Tạo và quản lý thông báo hệ thống</p>
                    </Col>
                    <Col xs="auto">
                        <Button
                            variant="primary"
                            onClick={() => { resetForm(); setShowCreateModal(true); }}
                            className="filter-btn"
                        >
                            <i className="bi bi-plus-circle me-2"></i>
                            Tạo thông báo mới
                        </Button>
                    </Col>
                </Row>

                {/* Search and Filter Controls */}
                <div className="session-list-controls">
                    <div className="search-controls">
                        <select
                            className="filter-select"
                            value={filterType}
                            onChange={(e) => {
                                setFilterType(e.target.value);
                                setPage(1);
                            }}
                        >
                            <option value="">Tất cả loại</option>
                            <option value="emergency">Khẩn cấp</option>
                            <option value="bug_fix">Sửa lỗi</option>
                            <option value="news">Tin tức</option>
                            <option value="maintenance">Bảo trì</option>
                        </select>

                        <select
                            className="filter-select"
                            value={filterStatus}
                            onChange={(e) => {
                                setFilterStatus(e.target.value);
                                setPage(1);
                            }}
                        >
                            <option value="">Tất cả trạng thái</option>
                            <option value="active">Hoạt động</option>
                            <option value="draft">Nháp</option>
                            <option value="archived">Lưu trữ</option>
                        </select>

                        {(filterType || filterStatus) && (
                            <Button
                                variant="outline-secondary"
                                onClick={() => {
                                    setFilterType('');
                                    setFilterStatus('');
                                    setPage(1);
                                }}
                                className="filter-btn"
                            >
                                Xóa bộ lọc
                            </Button>
                        )}
                    </div>
                </div>

                {/* Announcements Table */}
                <div className="session-table-container">
                    <div className="table-responsive-mobile">
                        <table className="session-table">
                            <thead>
                                <tr>
                                    <th className="mobile-essential">Loại</th>
                                    <th className="mobile-essential">Tiêu đề</th>
                                    <th className="mobile-essential">Trạng thái</th>
                                    <th className="mobile-essential">Lượt xem</th>
                                    <th className="mobile-essential">Lượt thích</th>
                                    <th className="mobile-essential">Bình luận</th>
                                    <th className="mobile-essential">Ngày tạo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="7" className="text-center">
                                            <Spinner animation="border" size="sm" />
                                        </td>
                                    </tr>
                                ) : announcements.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="text-center">
                                            Chưa có thông báo nào
                                        </td>
                                    </tr>
                                ) : (
                                    announcements.map((announcement) => (
                                        <tr
                                            key={announcement.id}
                                            className="announcement-row-clickable"
                                            onClick={() => {
                                                setSelectedAnnouncement(announcement);
                                                setComments([]);
                                                setReplyToComment(null);
                                                setCommentText('');
                                                setCommentIdToDelete(null);
                                                setShowDetailModal(true);
                                                loadComments(announcement.id);
                                            }}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <td className="mobile-essential">
                                                <Badge bg={getTypeBadge(announcement.type).bg}>
                                                    {getTypeBadge(announcement.type).text}
                                                </Badge>
                                                {announcement.is_emergency_visible ? (
                                                    <Badge bg="danger" className="ms-1">
                                                        <i className="bi bi-exclamation-triangle"></i>
                                                    </Badge>
                                                ) : null}
                                            </td>
                                            <td className="mobile-essential">
                                                <div className="fw-bold">{announcement.title}</div>
                                                <small className="text-muted">
                                                    {stripHtml(announcement.content || '').substring(0, 50)}...
                                                </small>
                                            </td>
                                            <td className="mobile-essential">
                                                <Badge bg={getStatusBadge(announcement.status).bg}>
                                                    {getStatusBadge(announcement.status).text}
                                                </Badge>
                                            </td>
                                            <td className="mobile-essential">{announcement.views_count}</td>
                                            <td className="mobile-essential">{announcement.likes_count}</td>
                                            <td className="mobile-essential">{announcement.comments_count}</td>
                                            <td className="mobile-essential">
                                                {new Date(announcement.created_at).toLocaleDateString('vi-VN')}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {!loading && announcements.length > 0 && (
                        <Pagination
                            currentPage={page}
                            totalPages={totalPages}
                            onPageChange={setPage}
                        />
                    )}
                </div>
            </Container>

            {/* Detail Modal - đầy đủ giống AnnouncementView: like, bình luận, trả lời, xóa; thêm Chỉnh sửa/Xóa */}
            <Modal
                show={showDetailModal}
                onHide={() => {
                    setShowDetailModal(false);
                    setSelectedAnnouncement(null);
                    setComments([]);
                    setReplyToComment(null);
                    setCommentText('');
                    setCommentIdToDelete(null);
                    setTimeout(() => {
                        if (detailTextareaRef.current) {
                            detailTextareaRef.current.style.height = '70px';
                            detailTextareaRef.current.style.minHeight = '70px';
                        }
                    }, 0);
                }}
                size="lg"
                className="announcement-detail-modal"
                centered
            >
                <Modal.Header closeButton>
                    <Modal.Title>
                        {selectedAnnouncement && (
                            <>
                                <Badge bg={getTypeBadge(selectedAnnouncement.type).bg}>
                                    <i className={`bi bi-${getTypeBadge(selectedAnnouncement.type).icon || 'newspaper'} me-1`}></i>
                                    {getTypeBadge(selectedAnnouncement.type).text}
                                </Badge>
                                <span>{selectedAnnouncement.title}</span>
                            </>
                        )}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {selectedAnnouncement && (
                        <>
                            <div className="announcement-author-info">
                                <div className="announcement-author-avatar">
                                    {getInitials(selectedAnnouncement.creator_name)}
                                </div>
                                <div className="announcement-author-details">
                                    <div className="announcement-author-name">
                                        {selectedAnnouncement.creator_name || 'Admin'}
                                    </div>
                                    <div className="announcement-author-time">
                                        <i className="bi bi-clock"></i>
                                        {new Date(selectedAnnouncement.created_at).toLocaleString('vi-VN')}
                                    </div>
                                </div>
                            </div>
                            <div
                                className="announcement-modal-content"
                                dangerouslySetInnerHTML={{ __html: selectedAnnouncement.content || '' }}
                            />
                            {selectedAnnouncement.bug_page && (
                                <div className="announcement-bug-card warning">
                                    <strong><i className="bi bi-exclamation-triangle me-2"></i>Trang xuất hiện lỗi:</strong>
                                    <div className="mt-2">{selectedAnnouncement.bug_page}</div>
                                </div>
                            )}
                            {selectedAnnouncement.bug_description && (
                                <div className="announcement-bug-card info">
                                    <strong><i className="bi bi-info-circle me-2"></i>Mô tả lỗi:</strong>
                                    <div className="mt-2">{selectedAnnouncement.bug_description}</div>
                                </div>
                            )}
                            {renderDetailMedia(selectedAnnouncement)}
                            <div className="announcement-action-bar">
                                <button
                                    type="button"
                                    className={`announcement-action-btn ${selectedAnnouncement.user_liked ? 'liked' : ''}`}
                                    onClick={() => handleLike(selectedAnnouncement.id)}
                                >
                                    <i className={`bi bi-heart${selectedAnnouncement.user_liked ? '-fill' : ''}`}></i>
                                    <span>{selectedAnnouncement.likes_count ?? 0} Thích</span>
                                </button>
                                <div className="announcement-action-btn" style={{ cursor: 'default' }}>
                                    <i className="bi bi-chat"></i>
                                    <span>{selectedAnnouncement.comments_count ?? 0} Bình luận</span>
                                </div>
                                <div className="announcement-action-btn" style={{ cursor: 'default' }}>
                                    <i className="bi bi-eye"></i>
                                    <span>{selectedAnnouncement.views_count ?? 0} Lượt xem</span>
                                </div>
                            </div>
                            {!replyToComment && (
                                <div className="announcement-comment-form">
                                    <Form onSubmit={handleDetailAddComment}>
                                        <div className="announcement-comment-input-group">
                                            <Form.Control
                                                ref={detailTextareaRef}
                                                as="textarea"
                                                placeholder="Viết bình luận..."
                                                value={commentText}
                                                onChange={(e) => {
                                                    setCommentText(e.target.value);
                                                    requestAnimationFrame(autoResizeDetailTextarea);
                                                }}
                                                onInput={() => requestAnimationFrame(autoResizeDetailTextarea)}
                                                onFocus={() => {
                                                    if (!commentText.trim()) setTimeout(() => { if (detailTextareaRef.current) detailTextareaRef.current.style.height = '70px'; }, 0);
                                                    else setTimeout(autoResizeDetailTextarea, 0);
                                                }}
                                                disabled={submittingComment}
                                                className="announcement-comment-textarea"
                                            />
                                            <button
                                                type="submit"
                                                className="announcement-comment-submit"
                                                disabled={!commentText.trim() || submittingComment}
                                            >
                                                {submittingComment ? <Spinner as="span" animation="border" size="sm" /> : <><i className="bi bi-send"></i><span>Gửi</span></>}
                                            </button>
                                        </div>
                                    </Form>
                                </div>
                            )}
                            {renderDetailComments()}
                        </>
                    )}
                </Modal.Body>
                <Modal.Footer className="d-flex justify-content-between">
                    <div></div>
                    <div className="d-flex gap-2">
                        <Button
                            variant="outline-primary"
                            onClick={() => {
                                if (selectedAnnouncement) {
                                    setShowDetailModal(false);
                                    openEditModal(selectedAnnouncement);
                                    setShowEditModal(true);
                                }
                            }}
                        >
                            <i className="bi bi-pencil me-2"></i>
                            Chỉnh sửa
                        </Button>
                        <Button
                            variant="outline-danger"
                            onClick={() => {
                                if (selectedAnnouncement) {
                                    setShowDetailModal(false);
                                    openDeleteModal(selectedAnnouncement);
                                    setShowDeleteModal(true);
                                }
                            }}
                        >
                            <i className="bi bi-trash me-2"></i>
                            Xóa
                        </Button>
                    </div>
                </Modal.Footer>
            </Modal>

            {/* Create Modal */}
            <Modal
                show={showCreateModal}
                onHide={() => {
                    setShowCreateModal(false);
                    resetForm();
                }}
                size="xl"
                className="student-detail-modal"
            >
                <Modal.Header closeButton className="student-detail-header">
                    <Modal.Title className="student-detail-title">
                        <div className="student-avatar">
                            <i className="bi bi-plus-circle"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Tạo thông báo mới</h4>
                            <p className="mb-0 student-subtitle">Thêm thông báo mới vào hệ thống</p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="student-detail-body">
                    <div className="student-detail-container">
                        {renderAnnouncementForm(false)}
                    </div>
                </Modal.Body>
                <Modal.Footer className="student-detail-footer">
                    <Button
                        variant="outline-secondary"
                        onClick={() => {
                            setShowCreateModal(false);
                            resetForm();
                        }}
                        disabled={submitting}
                        className="btn-cancel"
                    >
                        <i className="bi bi-x-lg me-2"></i>
                        Hủy
                    </Button>
                    <Button
                        variant="primary"
                        onClick={(e) => {
                            e.preventDefault();
                            handleCreateAnnouncement(e);
                        }}
                        disabled={submitting}
                    >
                        {submitting ? (
                            <>
                                <Spinner as="span" animation="border" size="sm" className="me-2" />
                                Đang tạo...
                            </>
                        ) : (
                            <>
                                <i className="bi bi-check-lg me-2"></i>
                                Tạo thông báo
                            </>
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Edit Modal */}
            <Modal
                show={showEditModal}
                onHide={() => {
                    setShowEditModal(false);
                    resetForm();
                }}
                size="xl"
                className="student-detail-modal"
            >
                <Modal.Header closeButton className="student-detail-header">
                    <Modal.Title className="student-detail-title">
                        <div className="student-avatar">
                            <i className="bi bi-pencil-square"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Chỉnh sửa thông báo</h4>
                            <p className="mb-0 student-subtitle">{selectedAnnouncement?.title || 'Thông báo'}</p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="student-detail-body">
                    <div className="student-detail-container">
                        {renderAnnouncementForm(true)}
                    </div>
                </Modal.Body>
                <Modal.Footer className="student-detail-footer">
                    <Button
                        variant="outline-secondary"
                        onClick={() => {
                            setShowEditModal(false);
                            resetForm();
                        }}
                        disabled={submitting}
                        className="btn-cancel"
                    >
                        <i className="bi bi-x-lg me-2"></i>
                        Hủy
                    </Button>
                    <Button
                        variant="primary"
                        onClick={(e) => {
                            e.preventDefault();
                            handleUpdateAnnouncement(e);
                        }}
                        disabled={submitting}
                    >
                        {submitting ? (
                            <>
                                <Spinner as="span" animation="border" size="sm" className="me-2" />
                                Đang cập nhật...
                            </>
                        ) : (
                            <>
                                <i className="bi bi-check-lg me-2"></i>
                                Cập nhật
                            </>
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Delete Modal */}
            <Modal
                show={showDeleteModal}
                onHide={() => {
                    setShowDeleteModal(false);
                    setSelectedAnnouncement(null);
                }}
                className="student-detail-modal"
            >
                <Modal.Header closeButton className="student-detail-header">
                    <Modal.Title className="student-detail-title">
                        <div className="student-avatar">
                            <i className="bi bi-trash"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Xác nhận xóa</h4>
                            <p className="mb-0 student-subtitle">Xóa thông báo</p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="student-detail-body">
                    <div className="student-detail-container">
                        {selectedAnnouncement && (
                            <div className="session-card mb-4">
                                <div className="card-header-modern">
                                    <div className="header-icon">
                                        <i className="bi bi-info-circle"></i>
                                    </div>
                                    <h6 className="mb-0">Thông tin thông báo</h6>
                                </div>
                                <div className="card-body-modern">
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="bi bi-type me-2"></i>
                                            Tiêu đề
                                        </div>
                                        <div className="info-value">{selectedAnnouncement.title}</div>
                                    </div>
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="bi bi-tag me-2"></i>
                                            Loại
                                        </div>
                                        <div className="info-value">
                                            <Badge bg={getTypeBadge(selectedAnnouncement.type).bg}>
                                                {getTypeBadge(selectedAnnouncement.type).text}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div className="info-item">
                                        <div className="info-label">
                                            <i className="bi bi-calendar me-2"></i>
                                            Ngày tạo
                                        </div>
                                        <div className="info-value">
                                            {new Date(selectedAnnouncement.created_at).toLocaleString('vi-VN')}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <Alert variant="danger" className="mb-0">
                            <div className="d-flex align-items-center">
                                <i className="bi bi-exclamation-triangle me-3"></i>
                                <div>
                                    <strong>Cảnh báo:</strong> Hành động này không thể hoàn tác. Tất cả bình luận và lượt thích cũng sẽ bị xóa.
                                </div>
                            </div>
                        </Alert>
                    </div>
                </Modal.Body>
                <Modal.Footer className="student-detail-footer">
                    <Button
                        variant="outline-secondary"
                        onClick={() => {
                            setShowDeleteModal(false);
                            setSelectedAnnouncement(null);
                        }}
                        disabled={submitting}
                        className="btn-cancel"
                    >
                        <i className="bi bi-x-lg me-2"></i>
                        Hủy
                    </Button>
                    <Button
                        variant="danger"
                        onClick={handleDeleteAnnouncement}
                        disabled={submitting}
                        className="btn-delete"
                    >
                        {submitting ? (
                            <>
                                <Spinner as="span" animation="border" size="sm" className="me-2" />
                                Đang xóa...
                            </>
                        ) : (
                            <>
                                <i className="bi bi-trash me-2"></i>
                                Xóa thông báo
                            </>
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>
        </>
    );
};

export default AnnouncementManagement;
