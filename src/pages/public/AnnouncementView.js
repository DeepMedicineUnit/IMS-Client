import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Button, Badge, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import { useTranslation } from 'react-i18next';
import Pagination from '../../components/Pagination';
import usePageTitle from '../../hooks/usePageTitle';
import { getApiBaseURL } from '../../utils/api';

const stripHtml = (html) => {
  if (!html) return '';
  const d = document.createElement('div');
  d.innerHTML = html;
  return (d.textContent || d.innerText || '').trim();
};

const announcementViewStyles = `
  /* Forum-style Layout with White Background and Soft Colors */
  .announcement-forum-layout {
    background: #ffffff;
    min-height: 100vh;
    padding: 0;
  }


  /* Main Content Area */
  .announcement-main-content {
    background: #ffffff;
    padding: 1.5rem;
  }

  /* Featured Posts Section */
  .featured-posts-section {
    margin-bottom: 2rem;
  }

  .featured-posts-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .featured-posts-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #212529;
    margin: 0;
  }

  .back-button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: #0d6efd;
    border: 1px solid #e9ecef;
    border-radius: 0.5rem;
    color:rgb(255, 255, 255);
    text-decoration: none;
    font-size: 0.875rem;
    transition: all 0.2s;
    cursor: pointer;
  }

  .back-button:hover {
    background:rgb(15, 90, 201);
    border-color: #dee2e6;
    color:rgb(255, 255, 255);
  }

  .back-button i {
    font-size: 0.875rem;
  }

  .featured-post-card {
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 0.75rem;
    padding: 1.25rem;
    height: 100%;
    transition: all 0.2s;
    cursor: pointer;
  }

  .featured-post-card:hover {
    background: #ffffff;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    transform: translateY(-2px);
  }

  .featured-post-title {
    font-size: 1rem;
    font-weight: 600;
    color: #212529;
    margin-bottom: 0.75rem;
    line-height: 1.4;
  }

  .featured-post-author {
    display: flex;
    align-items: center;
    margin-top: 0.75rem;
  }

  .featured-post-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #0d6efd 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 600;
    font-size: 0.875rem;
    margin-right: 0.5rem;
  }

  .featured-post-author-name {
    font-size: 0.875rem;
    color: #6c757d;
  }

  /* Tabs Section */
  .announcement-tabs {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 2px solid #e9ecef;
  }

  .tab-button {
    background: none;
    border: none;
    padding: 0.5rem 1rem;
    font-size: 0.9375rem;
    color: #6c757d;
    cursor: pointer;
    position: relative;
    transition: all 0.2s;
  }

  .tab-button:hover {
    color: #212529;
  }

  .tab-button.active {
    color: #0d6efd;
    font-weight: 500;
  }

  .tab-button.active::after {
    content: '';
    position: absolute;
    bottom: -1rem;
    left: 0;
    right: 0;
    height: 2px;
    background: #0d6efd;
  }

  .filter-dropdown {
    display: flex;
    gap: 0.5rem;
    margin-left: auto;
  }

  .filter-dropdown-btn {
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 0.5rem;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    color: #495057;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s;
  }

  .filter-dropdown-btn:hover {
    background: #e9ecef;
    border-color: #dee2e6;
  }

  /* Two Column Layout */
  .categories-column, .recent-column {
    background: #ffffff;
  }

  .column-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 1rem;
    font-weight: 600;
    color: #212529;
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #e9ecef;
  }

  .column-header h4 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
  }

  /* Category Card */
  .category-card {
    background: #ffffff;
    border: 1px solid #e9ecef;
    border-radius: 0.75rem;
    padding: 1.25rem;
    margin-bottom: 1rem;
    transition: all 0.2s;
  }

  .category-card:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    border-color: #dee2e6;
  }

  .category-header {
    display: flex;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .category-icon-large {
    width: 40px;
    height: 40px;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 1rem;
    font-size: 1.25rem;
  }

  .category-icon-large.emergency { background: #ffe0e0; color: #ff6b6b; }
  .category-icon-large.bug_fix { background: #fff8e0; color: #ffd93d; }
  .category-icon-large.news { background: #e0f5e6; color: #6bcf7f; }
  .category-icon-large.maintenance { background: #e9ecef; color: #95a5a6; }

  .category-info h4 {
    font-size: 1rem;
    font-weight: 600;
    color: #212529;
    margin: 0 0 0.25rem 0;
  }

  .category-info p {
    font-size: 0.875rem;
    color: #6c757d;
    margin: 0;
    line-height: 1.4;
  }

  .category-stats {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid #f1f3f5;
  }

  .category-stat {
    font-size: 0.875rem;
    color: #6c757d;
  }

  .category-stat strong {
    color: #212529;
    font-weight: 600;
  }

  /* Recent Post Item */
  .recent-post-item {
    display: flex;
    align-items: flex-start;
    padding: 1rem;
    border-bottom: 1px solid #f1f3f5;
    transition: all 0.2s;
    cursor: pointer;
  }

  .recent-post-item:hover {
    background: #f8f9fa;
  }

  .recent-post-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #0d6efd 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 600;
    font-size: 0.875rem;
    margin-right: 0.75rem;
    flex-shrink: 0;
  }

  .recent-post-content {
    flex: 1;
    min-width: 0;
  }

  .recent-post-title {
    font-size: 0.9375rem;
    font-weight: 500;
    color: #212529;
    margin-bottom: 0.5rem;
    line-height: 1.4;
  }

  .recent-post-title:hover {
    color: #0d6efd;
  }

  .recent-post-excerpt {
    font-size: 0.875rem;
    color: #6c757d;
    line-height: 1.5;
    margin-bottom: 0.5rem;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .recent-post-meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-top: 0.5rem;
  }

  .recent-post-author {
    font-size: 0.8125rem;
    color: #6c757d;
  }

  .recent-post-tags {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .recent-post-tag {
    font-size: 0.75rem;
    padding: 0.125rem 0.5rem;
    background: #e7f3ff;
    color: #0d6efd;
    border-radius: 0.25rem;
  }

  .recent-post-stats {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-left: auto;
    font-size: 0.8125rem;
    color: #6c757d;
  }

  .recent-post-time {
    font-size: 0.8125rem;
    color: #adb5bd;
    white-space: nowrap;
  }


  /* Empty State */
  .empty-state {
    text-align: center;
    padding: 3rem 1rem;
    color: #6c757d;
  }

  .empty-state i {
    font-size: 3rem;
    color: #dee2e6;
    margin-bottom: 1rem;
  }

  /* Media Preview */
  .media-preview {
    max-width: 100%;
    max-height: 400px;
    border-radius: 0.5rem;
    margin-top: 1rem;
  }

  /* Comment Section */
  .comment-section {
    max-height: 400px;
    overflow-y: auto;
    padding: 1rem;
    background-color: #f8f9fa;
    border-radius: 0.5rem;
  }

  .comment-item {
    background: white;
    padding: 0.75rem;
    border-radius: 0.5rem;
    margin-bottom: 0.75rem;
    border: 1px solid #e9ecef;
  }

  .comment-reply {
    margin-left: 2rem;
    margin-top: 0.5rem;
    padding-left: 1rem;
    border-left: 3px solid #0d6efd;
  }

  .like-button {
    transition: all 0.2s;
  }

  .like-button.liked {
    color: #ff6b6b;
  }

  .announcement-content {
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  /* Modal Styles */
  .announcement-modal .modal-content {
    border: none;
    border-radius: 1rem;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    animation: modalSlideIn 0.3s ease-out;
  }

  @keyframes modalSlideIn {
    from {
      opacity: 0;
      transform: translateY(-20px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .announcement-modal .modal-header {
    background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
    border-bottom: 1px solid #e9ecef;
    padding: 1.5rem;
    border-radius: 1rem 1rem 0 0;
  }

  .announcement-modal .modal-title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 1.125rem;
    font-weight: 600;
    color: #212529;
    line-height: 1.5;
  }

  .announcement-modal .modal-title .badge {
    font-size: 0.75rem;
    padding: 0.375rem 0.75rem;
    border-radius: 0.5rem;
    font-weight: 500;
  }

  .announcement-modal .btn-close {
    opacity: 0.6;
    transition: all 0.2s;
  }

  .announcement-modal .btn-close:hover {
    opacity: 1;
    transform: rotate(90deg);
  }

  .announcement-modal .modal-body {
    padding: 1.5rem;
    background: #ffffff;
    max-height: calc(100vh - 120px);
    overflow-y: auto;
  }

  .announcement-modal .modal-body::-webkit-scrollbar {
    width: 6px;
  }

  .announcement-modal .modal-body::-webkit-scrollbar-track {
    background: #f1f3f5;
    border-radius: 10px;
  }

  .announcement-modal .modal-body::-webkit-scrollbar-thumb {
    background: #dee2e6;
    border-radius: 10px;
  }

  .announcement-modal .modal-body::-webkit-scrollbar-thumb:hover {
    background: #adb5bd;
  }

  /* Author Info */
  .announcement-author-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
    border-radius: 0.75rem;
    margin-bottom: 1.5rem;
    border: 1px solid #e9ecef;
  }

  .announcement-author-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #0d6efd 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 600;
    font-size: 1rem;
    flex-shrink: 0;
  }

  .announcement-author-details {
    flex: 1;
  }

  .announcement-author-name {
    font-weight: 600;
    color: #212529;
    margin-bottom: 0.25rem;
  }

  .announcement-author-time {
    font-size: 0.875rem;
    color: #6c757d;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  /* Content Section - ép xuống dòng, không cắt nội dung */
  .announcement-modal-content {
    font-size: 1rem;
    line-height: 1.7;
    color: #495057;
    margin-bottom: 1.5rem;
    padding: 1.25rem;
    background: #f8f9fa;
    border-radius: 0.75rem;
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    overflow-wrap: anywhere;
    word-wrap: break-word;
    word-break: break-all;
    overflow-x: hidden;
    overflow-y: visible;
  }
  .announcement-modal-content * {
    max-width: 100% !important;
    min-width: 0 !important;
    box-sizing: border-box !important;
    overflow-wrap: anywhere !important;
    word-wrap: break-word !important;
    word-break: break-all !important;
    white-space: normal !important;
  }
  .announcement-modal-content pre,
  .announcement-modal-content code {
    white-space: pre-wrap !important;
  }
  .announcement-modal-content img,
  .announcement-modal-content video,
  .announcement-modal-content iframe {
    max-width: 100% !important;
    height: auto;
    display: block;
  }
  .announcement-modal-content table { table-layout: fixed !important; width: 100% !important; }
  .announcement-modal-content td,
  .announcement-modal-content th { overflow-wrap: anywhere !important; word-break: break-all !important; }
  .announcement-modal-content a { color: #0d6efd; }
  @media (max-width: 768px) {
    .announcement-modal-content { padding: 1rem; font-size: 0.9375rem; }
  }
  @media (max-width: 576px) {
    .announcement-modal-content { padding: 0.75rem; font-size: 0.875rem; line-height: 1.6; margin-bottom: 1rem; }
  }

  /* Bug Info Cards */
  .announcement-bug-card {
    padding: 1rem;
    border-radius: 0.75rem;
    margin-bottom: 1rem;
    animation: fadeInUp 0.4s ease-out;
  }

  .announcement-bug-card.warning {
    background: #fff8e0;
    color: #856404;
  }

  .announcement-bug-card.info {
    background: #e7f3ff;
    color: #004085;
  }

  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Action Bar */
  .announcement-action-bar {
    display: flex; 
    gap: 1rem; 
    padding: 0.75rem 0; 
    border-top: 1px 
    solid #e9ecef; 
    margin-top: 1rem;
  }

  .announcement-action-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: none;
    background: transparent;
    color: #6c757d;
    font-size: 0.9375rem;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.2s;
  }


  .announcement-action-btn.liked {
    color: #ff6b6b;
  }


  .announcement-action-btn i {
    font-size: 1.125rem;
  }

  /* Comment Form */
  .announcement-comment-form {
    margin: 0.75rem 0;
    padding: 1.25rem;
    background: #f8f9fa;
    border-radius: 0.75rem;
    border: 1px solid #e9ecef;
  }

  .announcement-reply-indicator {
    padding: 0.75rem 1rem;
    background: #e7f3ff;
    border-left: 4px solid #0d6efd;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    animation: fadeInUp 0.3s ease-out;
  }

  .announcement-comment-input-group {
    display: flex;
    gap: 0.75rem;
    align-items: flex-end;
  }

  .announcement-comment-textarea {
    flex: 1;
    border: 1px solid #dee2e6;
    border-radius: 0.75rem;
    padding: 0.875rem 1rem;
    font-size: 0.9375rem;
    resize: none;
    transition: height 0.2s;
    background: #ffffff;
    min-height: 70px;
    max-height: 200px;
    overflow-y: auto;
    line-height: 1.5;
  }

  .announcement-comment-textarea:focus {
    outline: none;
    border-color: #0d6efd;
    box-shadow: 0 0 0 3px rgba(13, 110, 253, 0.1);
  }

  .announcement-comment-submit {
    padding: 0.875rem 1.5rem;
    background: linear-gradient(135deg, #667eea 0%, #0d6efd 100%);
    border: none;
    border-radius: 0.75rem;
    color: white;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    height: fit-content;
  }

  .announcement-comment-submit:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(13, 110, 253, 0.3);
  }

  .announcement-comment-submit:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Comment Section */
  .announcement-comment-section {
    margin-top: 1.5rem;
  }

  .announcement-comment-section-title {
    font-size: 1rem;
    font-weight: 600;
    color: #212529;
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 2px solid #e9ecef;
  }

  .announcement-comments-list {
    padding-right: 0.5rem;
  }

  .announcement-comment-item {
    background: #ffffff;
    padding: 0.5rem;
    border-radius: 0.75rem;
    margin-bottom: 0.5rem;
    border: 1px solid #e9ecef;
    transition: all 0.2s;
    animation: fadeInUp 0.3s ease-out;
  }

  .announcement-comment-item:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    border-color: #dee2e6;
  }

  .announcement-comment-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.5rem;
  }

  .announcement-comment-author {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .announcement-comment-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #0d6efd 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 600;
    font-size: 0.875rem;
    flex-shrink: 0;
  }

  .announcement-comment-author-info {
    display: flex;
    flex-direction: column;
  }

  .announcement-comment-author-name {
    font-weight: 600;
    color: #212529;
    font-size: 0.9375rem;
  }

  .announcement-comment-time {
    font-size: 0.8125rem;
    color: #6c757d;
  }

  .announcement-comment-actions {
    display: flex;
    gap: 0.5rem;
  }

  .announcement-comment-action-btn {
    padding: 0.25rem 0.5rem;
    border: none;
    background: transparent;
    color: #6c757d;
    cursor: pointer;
    border-radius: 0.375rem;
    transition: all 0.2s;
    font-size: 0.875rem;
  }

  .announcement-comment-action-btn:hover {
    background: #f1f3f5;
    color: #212529;
  }

  .announcement-comment-action-btn.danger:hover {
    background: #ffe0e0;
    color: #dc3545;
  }

  .announcement-comment-action-btn.confirm {
    color: #28a745;
  }

  .announcement-comment-action-btn.confirm:hover {
    background: #d4edda;
    color: #155724;
  }

  .announcement-comment-action-btn.cancel {
    color: #6c757d;
  }

  .announcement-comment-action-btn.cancel:hover {
    background: #e9ecef;
    color: #212529;
  }

  .announcement-comment-content {
    color: #495057;
    line-height: 1.6;
    margin-bottom: 0.25rem;
  }

  .announcement-comment-replies {
    margin-top: 0.5rem;
    margin-left: 2.5rem;
    padding-left: 1rem;
    border-left: 3px solid #e9ecef;
  }

  .announcement-comment-reply-form {
    padding: 0.75rem;
    background: #f8f9fa;
    border-radius: 0.5rem;
    border: 1px solid #e9ecef;
  }

  .announcement-comment-reply-form .announcement-reply-indicator {
    margin-bottom: 0.75rem;
    padding: 0.5rem 0.75rem;
  }

  .announcement-comment-reply-item {
    background: #f8f9fa;
    padding: 0.5rem;
    border-radius: 0.5rem;
    margin-bottom: 0.5rem;
    border: 1px solid #e9ecef;
    animation: fadeInUp 0.3s ease-out;
  }

  .announcement-empty-comments {
    text-align: center;
    padding: 3rem 1rem;
    color: #6c757d;
  }

  .announcement-empty-comments i {
    font-size: 3rem;
    color: #dee2e6;
    margin-bottom: 1rem;
  }

  .announcement-media-preview-clickable { cursor: pointer; }
  .announcement-media-preview-clickable:hover { opacity: 0.92; }
  .announcement-fullscreen-overlay {
    position: fixed; inset: 0; z-index: 9999; display: flex; align-items: center; justify-content: center;
    background: rgba(0,0,0,0.92); cursor: pointer;
  }
  .announcement-fullscreen-overlay img {
    max-width: 100vw; max-height: 100vh; width: auto; height: auto; object-fit: contain; pointer-events: none;
  }

`;

const AnnouncementView = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const { showAlert } = useAlert();
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalAnnouncements, setTotalAnnouncements] = useState(0);
    const [filterType, setFilterType] = useState('');
    const [activeTab, setActiveTab] = useState('categories'); // categories, recent
    
    usePageTitle('Thông báo');

    // Add/remove body class for announcement page layout
    useEffect(() => {
        document.body.classList.add('announcement-page');
        return () => {
            document.body.classList.remove('announcement-page');
        };
    }, []);

    useEffect(() => {
        loadAnnouncements();
    }, [page, filterType]);

    const loadAnnouncements = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page,
                limit: 10,
                ...(filterType && { type: filterType })
            });

            const response = await fetch(`${getApiBaseURL()}/announcements/public?${params}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) throw new Error('Failed to load announcements');

            const data = await response.json();
            setAnnouncements(data.data);
            setTotalPages(data.pagination.totalPages);
            // Only update totalAnnouncements when there's no filter (to show "Thêm nữa" button)
            if (!filterType && data.pagination.total !== undefined) {
                setTotalAnnouncements(data.pagination.total);
            }
        } catch (error) {
            console.error('Load announcements error:', error);
            showAlert('Lỗi khi tải danh sách thông báo', 'danger');
        } finally {
            setLoading(false);
        }
    };

    const getTypeBadge = (type) => {
        const badges = {
            emergency: { bg: 'danger', text: 'Khẩn cấp', icon: 'exclamation-triangle-fill', color: '#ff6b6b' },
            bug_fix: { bg: 'warning', text: 'Sửa lỗi', icon: 'bug-fill', color: '#ffd93d' },
            news: { bg: 'info', text: 'Tin tức', icon: 'newspaper', color: '#6bcf7f' },
            maintenance: { bg: 'secondary', text: 'Bảo trì', icon: 'tools', color: '#95a5a6' }
        };
        return badges[type] || badges.news;
    };

    const getTypeIcon = (type) => {
        const icons = {
            emergency: 'exclamation-triangle-fill',
            bug_fix: 'bug-fill',
            news: 'newspaper',
            maintenance: 'tools'
        };
        return icons[type] || 'newspaper';
    };

    const getInitials = (name) => {
        if (!name) return 'A';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    };

    // Group announcements by type for categories view
    const getAnnouncementsByType = () => {
        const grouped = {
            emergency: [],
            bug_fix: [],
            news: [],
            maintenance: []
        };
        
        announcements.forEach(ann => {
            if (grouped[ann.type]) {
                grouped[ann.type].push(ann);
            }
        });
        
        return grouped;
    };

    // Get featured announcements (most liked/viewed)
    const getFeaturedAnnouncements = () => {
        return [...announcements]
            .sort((a, b) => (b.likes_count + b.views_count) - (a.likes_count + a.views_count))
            .slice(0, 3);
    };

    // Get all recent announcements (for counting)
    const getAllRecentAnnouncements = () => {
        return [...announcements]
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    };

    // Get recent announcements (limited to 10)
    const getRecentAnnouncements = () => {
        return getAllRecentAnnouncements().slice(0, 10);
    };

    const groupedAnnouncements = getAnnouncementsByType();
    const featuredAnnouncements = getFeaturedAnnouncements();
    const recentAnnouncements = getRecentAnnouncements();

    const getDisplayAnnouncements = () => {
        switch (activeTab) {
            case 'recent':
                return recentAnnouncements;
            default:
                return announcements;
        }
    };

    const getCategoryStats = (type) => {
        const typeAnnouncements = groupedAnnouncements[type] || [];
        const total = typeAnnouncements.length;
        const thisWeek = typeAnnouncements.filter(a => {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return new Date(a.created_at) > weekAgo;
        }).length;
        return { total, thisWeek };
    };

    return (
        <>
            <style>{announcementViewStyles}</style>
            <div className="announcement-forum-layout">
                <Container fluid className="px-0">
                    <Row className="g-0">
                        {/* Main Content */}
                        <Col>
                            <div className="announcement-main-content">
                                {/* Featured Posts */}
                                {featuredAnnouncements.length > 0 && (
                                    <div className="featured-posts-section">
                                        <div className="featured-posts-header">
                                            <h3 className="featured-posts-title">Bài viết nổi bật</h3>
                                            <button 
                                                className="back-button"
                                                onClick={() => navigate(-1)}
                                                title="Quay lại trang trước"
                                            >
                                                <i className="bi bi-arrow-left"></i>
                                                Quay lại
                                            </button>
                                        </div>
                                        <Row>
                                            {featuredAnnouncements.map((announcement) => (
                                                <Col md={4} key={announcement.id}>
                                                    <div className="featured-post-card" onClick={() => navigate(`/announcements/${announcement.id}`)}>
                                                        <div className="featured-post-title">{announcement.title}</div>
                                                        <div className="featured-post-author">
                                                            <div className="featured-post-avatar">
                                                                {getInitials(announcement.creator_name)}
                                                            </div>
                                                            <div className="featured-post-author-name">
                                                                {announcement.creator_name || 'Admin'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </Col>
                                            ))}
                                        </Row>
                                    </div>
                                )}

                                {/* Tabs */}
                                <div className="announcement-tabs">
                                    <button 
                                        className={`tab-button ${activeTab === 'categories' ? 'active' : ''}`}
                                        onClick={() => setActiveTab('categories')}
                                    >
                                        Chuyên mục
                                    </button>
                                    <button 
                                        className={`tab-button ${activeTab === 'recent' ? 'active' : ''}`}
                                        onClick={() => setActiveTab('recent')}
                                    >
                                        Gần đây
                                    </button>
                                </div>

                                {/* Content based on active tab */}
                                {loading ? (
                                    <div className="text-center py-5">
                                        <Spinner animation="border" />
                                        <p className="mt-2">Đang tải...</p>
                                    </div>
                                ) : activeTab === 'categories' ? (
                                    /* Categories View - Two Column Layout */
                                    <Row>
                                        <Col lg={5}>
                                            <div className="categories-column">
                                                <div className="column-header">
                                                    <h4>Chuyên mục</h4>
                                                    {filterType && (
                                                        <button 
                                                            className="back-button"
                                                            onClick={() => {
                                                                setFilterType('');
                                                                setPage(1);
                                                            }}
                                                            title="Quay lại tất cả chuyên mục"
                                                        >
                                                            <i className="bi bi-arrow-left"></i>
                                                            Quay lại
                                                        </button>
                                                    )}
                                                </div>
                                                
                                                {Object.entries(groupedAnnouncements).map(([type, typeAnnouncements]) => {
                                                    if (typeAnnouncements.length === 0) return null;
                                                    const stats = getCategoryStats(type);
                                                    const badge = getTypeBadge(type);
                                                    
                                                    return (
                                                        <div key={type} className="category-card" onClick={() => setFilterType(type)}>
                                                            <div className="category-header">
                                                                <div className={`category-icon-large ${type}`}>
                                                                    <i className={`bi bi-${getTypeIcon(type)}`}></i>
                                                                </div>
                                                                <div className="category-info">
                                                                    <h4>{badge.text}</h4>
                                                                    <p>
                                                                        {type === 'emergency' && 'Thông báo khẩn cấp từ hệ thống'}
                                                                        {type === 'bug_fix' && 'Các lỗi đã được sửa và cập nhật'}
                                                                        {type === 'news' && 'Tin tức và cập nhật mới nhất'}
                                                                        {type === 'maintenance' && 'Lịch bảo trì và nâng cấp hệ thống'}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="category-stats">
                                                                <div className="category-stat">
                                                                    <strong>{stats.thisWeek}</strong> / tuần
                                                                </div>
                                                                <div className="category-stat">
                                                                    Tổng: <strong>{stats.total}</strong>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}

                                                {announcements.length === 0 && (
                                                    <div className="empty-state">
                                                        <i className="bi bi-inbox"></i>
                                                        <p>Chưa có thông báo nào</p>
                                                    </div>
                                                )}
                                            </div>
                                        </Col>
                                        <Col lg={7}>
                                            <div className="recent-column">
                                                <h4 className="column-header">Gần đây</h4>
                                                
                                                {recentAnnouncements.length > 0 ? (
                                                    <>
                                                        {recentAnnouncements.map((announcement) => (
                                                            <div key={announcement.id} className="recent-post-item" onClick={() => navigate(`/announcements/${announcement.id}`)}>
                                                                <div className="recent-post-avatar">
                                                                    {getInitials(announcement.creator_name)}
                                                                </div>
                                                                <div className="recent-post-content">
                                                                    <div className="recent-post-title">{announcement.title}</div>
                                                                    {announcement.content && (
                                                                        <div className="recent-post-excerpt">
                                                                            {(() => {
                                                                                const plain = stripHtml(announcement.content);
                                                                                return plain.length > 150 ? `${plain.substring(0, 150)}...` : plain;
                                                                            })()}
                                                                        </div>
                                                                    )}
                                                                    <div className="recent-post-meta">
                                                                        <span className="recent-post-author">{announcement.creator_name || 'Admin'}</span>
                                                                        <div className="recent-post-tags">
                                                                            <span className="recent-post-tag">{getTypeBadge(announcement.type).text}</span>
                                                                        </div>
                                                                        <div className="recent-post-stats">
                                                                            <span><i className="bi bi-chat me-1"></i>{announcement.comments_count}</span>
                                                                            <span><i className="bi bi-heart me-1"></i>{announcement.likes_count}</span>
                                                                        </div>
                                                                        <span className="recent-post-time">
                                                                            {new Date(announcement.created_at).toLocaleDateString('vi-VN', { 
                                                                                day: 'numeric', 
                                                                                month: 'short' 
                                                                            })}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {totalAnnouncements > 10 && (
                                                            <div className="text-center mt-3">
                                                                <Button 
                                                                    variant="outline-primary" 
                                                                    onClick={() => setActiveTab('recent')}
                                                                    style={{ width: '100%' }}
                                                                >
                                                                    Thêm nữa
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </>
                                                ) : (
                                                    <div className="empty-state">
                                                        <i className="bi bi-inbox"></i>
                                                        <p>Chưa có bài viết nào</p>
                                                    </div>
                                                )}
                                            </div>
                                        </Col>
                                    </Row>
                                ) : (
                                    /* Recent View - List Layout */
                                    <div>
                                        {getDisplayAnnouncements().length > 0 ? (
                                            getDisplayAnnouncements().map((announcement) => (
                                                <div key={announcement.id} className="recent-post-item" onClick={() => navigate(`/announcements/${announcement.id}`)}>
                                                    <div className="recent-post-avatar">
                                                        {getInitials(announcement.creator_name)}
                                                    </div>
                                                    <div className="recent-post-content">
                                                        <div className="recent-post-title">{announcement.title}</div>
                                                        {announcement.content && (
                                                            <div className="recent-post-excerpt">
                                                                {(() => {
                                                                    const plain = stripHtml(announcement.content);
                                                                    return plain.length > 150 ? `${plain.substring(0, 150)}...` : plain;
                                                                })()}
                                                            </div>
                                                        )}
                                                        <div className="recent-post-meta">
                                                            <span className="recent-post-author">{announcement.creator_name || 'Admin'}</span>
                                                            <div className="recent-post-tags">
                                                                <span className="recent-post-tag">{getTypeBadge(announcement.type).text}</span>
                                                            </div>
                                                            <div className="recent-post-stats">
                                                                <span><i className="bi bi-chat me-1"></i>{announcement.comments_count}</span>
                                                                <span><i className="bi bi-heart me-1"></i>{announcement.likes_count}</span>
                                                                <span><i className="bi bi-eye me-1"></i>{announcement.views_count}</span>
                                                            </div>
                                                            <span className="recent-post-time">
                                                                {new Date(announcement.created_at).toLocaleDateString('vi-VN', { 
                                                                    day: 'numeric', 
                                                                    month: 'short' 
                                                                })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="empty-state">
                                                <i className="bi bi-inbox"></i>
                                                <p>Chưa có thông báo nào</p>
                                            </div>
                                        )}

                                        {totalPages > 1 && (
                                            <div className="mt-4">
                                                <Pagination
                                                    currentPage={page}
                                                    totalPages={totalPages}
                                                    onPageChange={setPage}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </Col>
                    </Row>
                </Container>
            </div>
        </>
    );
};

export default AnnouncementView;
