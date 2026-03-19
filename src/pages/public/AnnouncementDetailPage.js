import React, { useState, useEffect, useRef } from 'react';
import { Container, Button, Badge, Form, Spinner } from 'react-bootstrap';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import usePageTitle from '../../hooks/usePageTitle';
import { getApiBaseURL } from '../../utils/api';

const announcementDetailStyles = `
  .announcement-detail-page { background: #fff; min-height: 100vh; padding: 1rem; max-width: 900px; margin: 0 auto; width: 100%; box-sizing: border-box; overflow-x: hidden; }
  .announcement-detail-page .container { max-width: 100%; width: 100%; box-sizing: border-box; }
  @media (max-width: 768px) { .announcement-detail-page { padding: 1rem 0.5rem; } .announcement-detail-page .container { padding-left: 0.5rem; padding-right: 0.5rem; } }
  @media (max-width: 576px) {
    .announcement-detail-page { padding: 0.5rem 0.375rem; margin-left: -0.5rem; margin-right: -0.5rem; width: calc(100% + 1rem); }
    .announcement-detail-page .container { padding-left: 0.375rem; padding-right: 0.375rem; }
  }
  @media (max-width: 400px) {
    .announcement-detail-page { padding: 0.375rem 0.25rem; margin-left: -0.5rem; margin-right: -0.5rem; width: calc(100% + 1rem); }
    .announcement-detail-page .container { padding-left: 0.25rem; padding-right: 0.25rem; }
  }
  .back-button {
    display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem;
    background: #0d6efd; border: 1px solid #e9ecef; border-radius: 0.5rem; color: #fff;
    text-decoration: none; font-size: 0.875rem; transition: all 0.2s; cursor: pointer; margin-bottom: 1.5rem;
  }
  .back-button:hover { background: #0f5ac9; border-color: #dee2e6; color: #fff; }
  .announcement-detail-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
  .announcement-author-info { display: flex; align-items: center; gap: 0.75rem; padding: 1rem; background: linear-gradient(135deg, #f8f9fa 0%, #fff 100%); border-radius: 0.75rem; margin-bottom: 1.5rem; border: 1px solid #e9ecef; }
  .announcement-author-avatar { width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #0d6efd 100%); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 600; font-size: 1rem; flex-shrink: 0; }
  .announcement-author-details { flex: 1; }
  .announcement-author-name { font-weight: 600; color: #212529; margin-bottom: 0.25rem; }
  .announcement-author-time { font-size: 0.875rem; color: #6c757d; display: flex; align-items: center; gap: 0.5rem; }
  .announcement-modal-content {
    font-size: 1rem; line-height: 1.7; color: #495057; margin-bottom: 1.5rem; padding: 1.25rem;
    background: #ffffff; border-radius: 0.75rem;
    box-sizing: border-box; width: 100% !important; max-width: 100% !important; min-width: 0;
    overflow-wrap: anywhere; word-wrap: break-word; word-break: break-all;
    overflow-x: hidden; overflow-y: visible;
  }
  /* Con trực tiếp (thường là 1 div từ HTML lưu) bắt buộc full width và wrap */
  .announcement-modal-content > * {
    width: 100% !important; max-width: 100% !important; min-width: 0 !important; box-sizing: border-box !important;
    overflow-wrap: anywhere !important; word-wrap: break-word !important; word-break: break-all !important;
    white-space: normal !important;
  }
  .announcement-modal-content * {
    max-width: 100% !important; min-width: 0 !important; box-sizing: border-box !important;
    overflow-wrap: anywhere !important; word-wrap: break-word !important; word-break: break-all !important;
    white-space: normal !important;
  }
  .announcement-modal-content pre,
  .announcement-modal-content code {
    white-space: pre-wrap !important; word-break: break-all !important; overflow-wrap: anywhere !important;
  }
  .announcement-modal-content img, .announcement-modal-content video, .announcement-modal-content iframe { max-width: 100% !important; height: auto; display: block; }
  .announcement-modal-content table { table-layout: fixed !important; width: 100% !important; }
  .announcement-modal-content td, .announcement-modal-content th { overflow-wrap: anywhere !important; word-break: break-all !important; }
  .announcement-modal-content a { color: #0d6efd; }
  @media (max-width: 768px) {
    .announcement-modal-content { padding: 1rem; font-size: 0.9375rem; }
  }
  @media (max-width: 576px) {
    .announcement-modal-content { padding: 0.75rem; font-size: 0.875rem; line-height: 1.6; margin-bottom: 1rem; }
  }
  .announcement-bug-card { padding: 1rem; border-radius: 0.75rem; margin-bottom: 1rem; }
  .announcement-bug-card.warning { background: #fff8e0; color: #856404; }
  .announcement-bug-card.info { background: #e7f3ff; color: #004085; }
  .media-preview { max-width: 100%; max-height: 400px; border-radius: 0.5rem; margin-top: 1rem; }
  .media-preview-wrapper { margin-top: 0.5rem; }
  .announcement-detail-media .media-preview { margin-top: 0.5rem; }
  .announcement-action-bar { display: flex; gap: 1rem; padding: 0.75rem 0; border-top: 1px solid #e9ecef; margin-top: 1rem; }
  .announcement-action-btn { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; border: none; background: transparent; color: #6c757d; font-size: 0.9375rem; border-radius: 0.5rem; cursor: pointer; transition: all 0.2s; }
  .announcement-action-btn.liked { color: #ff6b6b; }
  .announcement-action-btn i { font-size: 1.125rem; }
  .announcement-comment-form { margin: 0.75rem 0; padding: 1.25rem; background: #f8f9fa; border-radius: 0.75rem; border: 1px solid #e9ecef; }
  .announcement-reply-indicator { padding: 0.75rem 1rem; background: #e7f3ff; border-left: 4px solid #0d6efd; border-radius: 0.5rem; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; }
  .announcement-comment-input-group { display: flex; gap: 0.75rem; align-items: flex-end; }
  .announcement-comment-textarea { flex: 1; border: 1px solid #dee2e6; border-radius: 0.75rem; padding: 0.875rem 1rem; font-size: 0.9375rem; resize: none; background: #fff; min-height: 70px; max-height: 200px; overflow-y: auto; line-height: 1.5; }
  .announcement-comment-textarea:focus { outline: none; border-color: #0d6efd; box-shadow: 0 0 0 3px rgba(13,110,253,0.1); }
  .announcement-comment-submit { padding: 0.875rem 1.5rem; background: linear-gradient(135deg, #667eea 0%, #0d6efd 100%); border: none; border-radius: 0.75rem; color: #fff; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; height: fit-content; }
  .announcement-comment-submit:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(13,110,253,0.3); }
  .announcement-comment-submit:disabled { opacity: 0.6; cursor: not-allowed; }
  .announcement-comment-section { margin-top: 1.5rem; }
  .announcement-comments-list { padding-right: 0.5rem; }
  .announcement-comment-item { background: #fff; padding: 0.5rem; border-radius: 0.75rem; margin-bottom: 0.5rem; border: 1px solid #e9ecef; }
  .announcement-comment-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem; }
  .announcement-comment-author { display: flex; align-items: center; gap: 0.75rem; }
  .announcement-comment-avatar { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #0d6efd 100%); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 600; font-size: 0.875rem; flex-shrink: 0; }
  .announcement-comment-author-info { display: flex; flex-direction: column; }
  .announcement-comment-author-name { font-weight: 600; color: #212529; font-size: 0.9375rem; }
  .announcement-comment-time { font-size: 0.8125rem; color: #6c757d; }
  .announcement-comment-actions { display: flex; gap: 0.5rem; }
  .announcement-comment-action-btn { padding: 0.25rem 0.5rem; border: none; background: transparent; color: #6c757d; cursor: pointer; border-radius: 0.375rem; font-size: 0.875rem; }
  .announcement-comment-action-btn:hover { background: #f1f3f5; color: #212529; }
  .announcement-comment-action-btn.danger:hover { background: #ffe0e0; color: #dc3545; }
  .announcement-comment-action-btn.confirm { color: #28a745; }
  .announcement-comment-action-btn.confirm:hover { background: #d4edda; color: #155724; }
  .announcement-comment-action-btn.cancel { color: #6c757d; }
  .announcement-comment-action-btn.cancel:hover { background: #e9ecef; color: #212529; }
  .announcement-comment-content { color: #495057; line-height: 1.6; margin-bottom: 0.25rem; }
  .announcement-comment-replies { margin-top: 0.5rem; margin-left: 2.5rem; padding-left: 1rem; border-left: 3px solid #e9ecef; }
  .announcement-comment-reply-form { padding: 0.75rem; background: #f8f9fa; border-radius: 0.5rem; border: 1px solid #e9ecef; }
  .announcement-comment-reply-item { background: #f8f9fa; padding: 0.5rem; border-radius: 0.5rem; margin-bottom: 0.5rem; border: 1px solid #e9ecef; }
  .announcement-empty-comments { text-align: center; padding: 3rem 1rem; color: #6c757d; }
  .announcement-empty-comments i { font-size: 3rem; color: #dee2e6; margin-bottom: 1rem; }
  .announcement-media-preview-clickable { cursor: pointer; }
  .announcement-media-preview-clickable:hover { opacity: 0.92; }
  .announcement-fullscreen-overlay { position: fixed; inset: 0; z-index: 9999; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.92); cursor: pointer; }
  .announcement-fullscreen-overlay img { max-width: 100vw; max-height: 100vh; width: auto; height: auto; object-fit: contain; pointer-events: none; }
`;

const AnnouncementDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const { showAlert } = useAlert();
    const [announcement, setAnnouncement] = useState(null);
    const [loading, setLoading] = useState(true);
    const [comments, setComments] = useState([]);
    const [loadingComments, setLoadingComments] = useState(false);
    const [commentText, setCommentText] = useState('');
    const [replyToComment, setReplyToComment] = useState(null);
    const [submittingComment, setSubmittingComment] = useState(false);
    const [commentIdToDelete, setCommentIdToDelete] = useState(null);
    const [fullscreenImageUrl, setFullscreenImageUrl] = useState(null);
    const textareaRef = useRef(null);

    usePageTitle(announcement ? announcement.title : 'Chi tiết thông báo');

    // Add/remove body class for announcement page layout (no Navbar, TopHeader left:0, main margin-left:0)
    useEffect(() => {
        document.body.classList.add('announcement-page');
        return () => {
            document.body.classList.remove('announcement-page');
        };
    }, []);

    const autoResizeTextarea = () => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = 'auto';
        if (!commentText.trim()) ta.style.height = '70px';
        else ta.style.height = `${Math.min(Math.max(ta.scrollHeight, 70), 200)}px`;
    };

    useEffect(() => {
        autoResizeTextarea();
    }, [commentText]);

    useEffect(() => {
        if (!id) return;
        const load = async () => {
            setLoading(true);
            try {
                const res = await fetch(`${getApiBaseURL()}/announcements/${id}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                if (!res.ok) throw new Error('Không tải được thông báo');
                const data = await res.json();
                setAnnouncement(data.data);
                loadComments(id);
            } catch (e) {
                console.error(e);
                showAlert('Lỗi khi tải thông báo', 'danger');
                navigate('/announcements');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id]);

    const loadComments = async (announcementId) => {
        try {
            setLoadingComments(true);
            const res = await fetch(`${getApiBaseURL()}/announcements/${announcementId}/comments`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (!res.ok) throw new Error('Failed to load comments');
            const data = await res.json();
            setComments(data.data);
        } catch (e) {
            console.error(e);
            showAlert('Lỗi khi tải bình luận', 'danger');
        } finally {
            setLoadingComments(false);
        }
    };

    const handleLike = async () => {
        if (!announcement) return;
        try {
            const res = await fetch(`${getApiBaseURL()}/announcements/${announcement.id}/like`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (!res.ok) throw new Error('Failed to like');
            const data = await res.json();
            setAnnouncement(prev => ({
                ...prev,
                user_liked: data.liked ? 1 : 0,
                likes_count: data.liked ? prev.likes_count + 1 : prev.likes_count - 1
            }));
        } catch (e) {
            console.error(e);
            showAlert('Lỗi khi thích bài viết', 'danger');
        }
    };

    const handleAddComment = async (e) => {
        e.preventDefault();
        if (!commentText.trim() || !announcement) return;
        const previousComments = [...comments];
        const commentTextBackup = commentText;
        const replyToCommentBackup = replyToComment;
        const currentUserInfo = currentUser;
        const tempComment = {
            id: `temp-${Date.now()}`,
            content: commentText.trim(),
            user_id: currentUserInfo?.id,
            user_name: currentUserInfo?.full_name || currentUserInfo?.username || 'Bạn',
            username: currentUserInfo?.username,
            created_at: new Date().toISOString(),
            parent_comment_id: replyToComment?.id || null,
            replies: []
        };
        if (replyToComment) {
            setComments(prev => prev.map(c => c.id === replyToComment.id ? { ...c, replies: [...(c.replies || []), tempComment] } : c));
        } else {
            setComments([tempComment, ...comments]);
        }
        setAnnouncement(prev => ({ ...prev, comments_count: prev.comments_count + 1 }));
        setCommentText('');
        setReplyToComment(null);
        if (textareaRef.current) {
            textareaRef.current.style.height = '70px';
        }
        try {
            setSubmittingComment(true);
            const res = await fetch(`${getApiBaseURL()}/announcements/${announcement.id}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: JSON.stringify({ content: commentTextBackup, parent_comment_id: replyToCommentBackup?.id || null })
            });
            if (!res.ok) throw new Error('Failed to add comment');
            const data = await res.json();
            const newComment = data.data;
            if (replyToCommentBackup) {
                setComments(prev => prev.map(c => c.id === replyToCommentBackup.id ? { ...c, replies: (c.replies || []).map(r => r.id === tempComment.id ? newComment : r) } : c));
            } else {
                setComments(prev => prev.map(c => c.id === tempComment.id ? newComment : c));
            }
        } catch (e) {
            console.error(e);
            setComments(previousComments);
            setCommentText(commentTextBackup);
            setReplyToComment(replyToCommentBackup);
            setAnnouncement(prev => ({ ...prev, comments_count: Math.max(0, prev.comments_count - 1) }));
            showAlert('Lỗi khi thêm bình luận', 'danger');
        } finally {
            setSubmittingComment(false);
        }
    };

    const handleDeleteComment = async (commentId) => {
        if (!announcement) return;
        const previousComments = [...comments];
        const removeComment = (list, idToRemove) =>
            list.filter(c => c.id !== idToRemove).map(c => ({ ...c, replies: (c.replies || []).filter(r => r.id !== idToRemove) }));
        setComments(removeComment(comments, commentId));
        setAnnouncement(prev => ({ ...prev, comments_count: Math.max(0, prev.comments_count - 1) }));
        setCommentIdToDelete(null);
        try {
            const res = await fetch(`${getApiBaseURL()}/announcements/${announcement.id}/comments/${commentId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (!res.ok) throw new Error('Failed to delete comment');
            showAlert('Đã xóa bình luận', 'success');
        } catch (e) {
            console.error(e);
            setComments(previousComments);
            setAnnouncement(prev => ({ ...prev, comments_count: prev.comments_count + 1 }));
            showAlert('Lỗi khi xóa bình luận', 'danger');
        }
    };

    const getTypeBadge = (type) => {
        const badges = {
            emergency: { bg: 'danger', text: 'Khẩn cấp', icon: 'exclamation-triangle-fill' },
            bug_fix: { bg: 'warning', text: 'Sửa lỗi', icon: 'bug-fill' },
            news: { bg: 'info', text: 'Tin tức', icon: 'newspaper' },
            maintenance: { bg: 'secondary', text: 'Bảo trì', icon: 'tools' }
        };
        return badges[type] || badges.news;
    };

    const getInitials = (name) => {
        if (!name) return 'A';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    };

    const getMediaDisplayUrl = (url) => {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        const base = getApiBaseURL();
        const baseRoot = (base && base.startsWith('http')) ? base.replace(/\/api\/?$/, '') : (typeof window !== 'undefined' ? window.location.origin : '');
        return `${baseRoot}${url.startsWith('/') ? '' : '/'}${url}`;
    };

    const renderSingleMedia = (item, title, index) => {
        const src = getMediaDisplayUrl(item.url);
        if (!src) return null;
        if (item.type === 'image') {
            return (
                <div
                    key={index}
                    className="announcement-media-preview-clickable media-preview-wrapper"
                    onClick={() => setFullscreenImageUrl(src)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setFullscreenImageUrl(src)}
                    title="Click xem toàn màn hình"
                >
                    <img src={src} alt={title} className="media-preview" />
                </div>
            );
        }
        if (item.type === 'video') {
            if (item.url && (item.url.includes('youtube.com') || item.url.includes('youtu.be'))) {
                let videoId = '';
                if (item.url.includes('youtube.com')) {
                    try {
                        const u = new URL(item.url);
                        videoId = u.searchParams.get('v') || '';
                    } catch (_) { videoId = (item.url.split('youtu.be/')[1] || '').split('?')[0]; }
                } else videoId = (item.url.split('youtu.be/')[1] || '').split('?')[0];
                if (!videoId) return null;
                return (
                    <div key={index} className="ratio ratio-16x9 mt-3">
                        <iframe src={`https://www.youtube.com/embed/${videoId}`} title={title} allowFullScreen></iframe>
                    </div>
                );
            }
            return <video key={index} src={src} controls className="media-preview" />;
        }
        return null;
    };

    const renderMedia = () => {
        if (!announcement) return null;
        const list = Array.isArray(announcement.media_list) && announcement.media_list.length > 0
            ? announcement.media_list
            : (announcement.media_url ? [{ url: announcement.media_url, type: announcement.media_type || 'image' }] : []);
        if (list.length === 0) return null;
        return (
            <div className="announcement-detail-media mt-3">
                {list.map((item, idx) => renderSingleMedia(item, announcement.title, idx))}
            </div>
        );
    };

    const renderReplyForm = (comment) => {
        if (replyToComment?.id !== comment.id) return null;
        return (
            <div className="announcement-comment-reply-form" style={{ marginTop: '0.75rem', marginLeft: '2.5rem' }}>
                <div className="announcement-reply-indicator" style={{ marginBottom: '0.75rem' }}>
                    <small><i className="bi bi-reply me-2"></i>Đang trả lời <strong>{replyToComment.user_name || replyToComment.username}</strong></small>
                    <button type="button" className="btn-close" onClick={() => setReplyToComment(null)} style={{ fontSize: '0.75rem' }}></button>
                </div>
                <Form onSubmit={handleAddComment}>
                    <div className="announcement-comment-input-group">
                        <Form.Control ref={textareaRef} as="textarea" placeholder="Viết bình luận..." value={commentText}
                            onChange={(e) => { setCommentText(e.target.value); requestAnimationFrame(autoResizeTextarea); }}
                            disabled={submittingComment} className="announcement-comment-textarea" />
                        <button type="submit" className="announcement-comment-submit" disabled={!commentText.trim() || submittingComment}>
                            {submittingComment ? <Spinner as="span" animation="border" size="sm" /> : <><i className="bi bi-send"></i><span>Gửi</span></>}
                        </button>
                    </div>
                </Form>
            </div>
        );
    };

    const renderComments = () => {
        if (loadingComments) {
            return (
                <div className="text-center py-4">
                    <Spinner animation="border" size="sm" />
                    <p className="text-muted mt-2 mb-0">Đang tải bình luận...</p>
                </div>
            );
        }
        if (comments.length === 0) {
            return (
                <div className="announcement-empty-comments">
                    <i className="bi bi-chat-left-text"></i>
                    <p>Chưa có bình luận nào</p>
                </div>
            );
        }
        return (
            <div className="announcement-comment-section">
                <div className="announcement-comments-list">
                    {comments.map(comment => (
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
                                        <>
                                            <button type="button" className="announcement-comment-action-btn confirm" onClick={() => handleDeleteComment(comment.id)} title="Xác nhận xóa"><i className="bi bi-check-lg"></i></button>
                                            <button type="button" className="announcement-comment-action-btn cancel" onClick={() => setCommentIdToDelete(null)} title="Hủy"><i className="bi bi-x-lg"></i></button>
                                        </>
                                    ) : (
                                        <>
                                            <button type="button" className="announcement-comment-action-btn" onClick={() => setReplyToComment(comment)} title="Trả lời"><i className="bi bi-reply"></i></button>
                                            {(currentUser?.id === comment.user_id || currentUser?.role === 'superadmin') && (
                                                <button type="button" className="announcement-comment-action-btn danger" onClick={() => setCommentIdToDelete(comment.id)} title="Xóa"><i className="bi bi-trash"></i></button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="announcement-comment-content" dangerouslySetInnerHTML={{ __html: comment.content || '' }} />
                            {renderReplyForm(comment)}
                            {comment.replies && comment.replies.length > 0 && (
                                <div className="announcement-comment-replies">
                                    {comment.replies.map(reply => (
                                        <div key={reply.id} className="announcement-comment-reply-item">
                                            <div className="announcement-comment-header">
                                                <div className="announcement-comment-author">
                                                    <div className="announcement-comment-avatar" style={{ width: '32px', height: '32px', fontSize: '0.75rem' }}>{getInitials(reply.user_name || reply.username)}</div>
                                                    <div className="announcement-comment-author-info">
                                                        <div className="announcement-comment-author-name" style={{ fontSize: '0.875rem' }}>{reply.user_name || reply.username}</div>
                                                        <div className="announcement-comment-time" style={{ fontSize: '0.75rem' }}>{new Date(reply.created_at).toLocaleString('vi-VN')}</div>
                                                    </div>
                                                </div>
                                                {(currentUser?.id === reply.user_id || currentUser?.role === 'superadmin') && (
                                                    <div className="announcement-comment-actions">
                                                        {commentIdToDelete === reply.id ? (
                                                            <>
                                                                <button type="button" className="announcement-comment-action-btn confirm" onClick={() => handleDeleteComment(reply.id)} title="Xác nhận xóa"><i className="bi bi-check-lg"></i></button>
                                                                <button type="button" className="announcement-comment-action-btn cancel" onClick={() => setCommentIdToDelete(null)} title="Hủy"><i className="bi bi-x-lg"></i></button>
                                                            </>
                                                        ) : (
                                                            <button type="button" className="announcement-comment-action-btn danger" onClick={() => setCommentIdToDelete(reply.id)} title="Xóa"><i className="bi bi-trash"></i></button>
                                                        )}
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

    if (loading) {
        return (
            <>
                <style>{announcementDetailStyles}</style>
                <div className="announcement-detail-page">
                    <button type="button" className="back-button" onClick={() => navigate('/announcements')}>
                        <i className="bi bi-arrow-left"></i> Quay lại
                    </button>
                    <div className="text-center py-5">
                        <Spinner animation="border" />
                        <p className="mt-2 text-muted">Đang tải...</p>
                    </div>
                </div>
            </>
        );
    }

    if (!announcement) return null;

    return (
        <>
            <style>{announcementDetailStyles}</style>
            {fullscreenImageUrl && (
                <div className="announcement-fullscreen-overlay" onClick={() => setFullscreenImageUrl(null)} onKeyDown={(e) => e.key === 'Escape' && setFullscreenImageUrl(null)} role="button" tabIndex={0} aria-label="Đóng xem ảnh">
                    <img src={fullscreenImageUrl} alt="" />
                </div>
            )}
            <div className="announcement-detail-page">
                <Container>
                    <button type="button" className="back-button" onClick={() => navigate('/announcements')}>
                        <i className="bi bi-arrow-left"></i> Quay lại
                    </button>
                    <div className="announcement-detail-header">
                        <Badge bg={getTypeBadge(announcement.type).bg}>
                            <i className={`bi bi-${getTypeBadge(announcement.type).icon} me-1`}></i>
                            {getTypeBadge(announcement.type).text}
                        </Badge>
                        <span style={{ fontSize: '1.25rem', fontWeight: 600 }}>{announcement.title}</span>
                    </div>
                    <div className="announcement-author-info">
                        <div className="announcement-author-avatar">{getInitials(announcement.creator_name)}</div>
                        <div className="announcement-author-details">
                            <div className="announcement-author-name">{announcement.creator_name || 'Admin'}</div>
                            <div className="announcement-author-time"><i className="bi bi-clock"></i> {new Date(announcement.created_at).toLocaleString('vi-VN')}</div>
                        </div>
                    </div>
                    <div className="announcement-modal-content" style={{ width: '100%', maxWidth: '100%' }}>
                        <div
                            style={{
                                width: '100%',
                                maxWidth: '100%',
                                overflowWrap: 'anywhere',
                                wordBreak: 'break-all',
                                whiteSpace: 'normal',
                                boxSizing: 'border-box'
                            }}
                            dangerouslySetInnerHTML={{ __html: announcement.content || '' }}
                        />
                    </div>
                    {announcement.bug_page && (
                        <div className="announcement-bug-card warning">
                            <strong><i className="bi bi-exclamation-triangle me-2"></i>Trang xuất hiện lỗi:</strong>
                            <div className="mt-2">{announcement.bug_page}</div>
                        </div>
                    )}
                    {announcement.bug_description && (
                        <div className="announcement-bug-card info">
                            <strong><i className="bi bi-info-circle me-2"></i>Mô tả lỗi:</strong>
                            <div className="mt-2">{announcement.bug_description}</div>
                        </div>
                    )}
                    {renderMedia()}
                    <div className="announcement-action-bar">
                        <button type="button" className={`announcement-action-btn ${announcement.user_liked ? 'liked' : ''}`} onClick={handleLike}>
                            <i className={`bi bi-heart${announcement.user_liked ? '-fill' : ''}`}></i>
                            <span>{announcement.likes_count}<span className="d-none d-md-inline"> Thích</span></span>
                        </button>
                        <div className="announcement-action-btn" style={{ cursor: 'default' }}>
                            <i className="bi bi-chat"></i>
                            <span>{announcement.comments_count}<span className="d-none d-md-inline"> Bình luận</span></span>
                        </div>
                        <div className="announcement-action-btn" style={{ cursor: 'default' }}>
                            <i className="bi bi-eye"></i>
                            <span>{announcement.views_count}<span className="d-none d-md-inline"> Lượt xem</span></span>
                        </div>
                    </div>
                    {!replyToComment && (
                        <div className="announcement-comment-form">
                            <Form onSubmit={handleAddComment}>
                                <div className="announcement-comment-input-group">
                                    <Form.Control ref={textareaRef} as="textarea" placeholder="Viết bình luận..." value={commentText}
                                        onChange={(e) => { setCommentText(e.target.value); requestAnimationFrame(autoResizeTextarea); }}
                                        onFocus={() => requestAnimationFrame(autoResizeTextarea)}
                                        disabled={submittingComment} className="announcement-comment-textarea" />
                                    <button type="submit" className="announcement-comment-submit" disabled={!commentText.trim() || submittingComment}>
                                        {submittingComment ? <Spinner as="span" animation="border" size="sm" /> : <><i className="bi bi-send"></i><span>Gửi</span></>}
                                    </button>
                                </div>
                            </Form>
                        </div>
                    )}
                    {renderComments()}
                </Container>
            </div>
        </>
    );
};

export default AnnouncementDetailPage;
