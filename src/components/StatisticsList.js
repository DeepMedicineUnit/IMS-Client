import React from 'react';
import { Card, Button, ListGroup, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import '../../src/styles/dashboard.css';

// Component to display statistics lists with consistent styling
const StatisticsList = ({ 
  title, 
  icon, 
  data = [], 
  emptyMessage = 'Không có dữ liệu', 
  bgColor = 'primary',
  detailPath,
  type,
  renderItem,
  maxItems = 5,
}) => {
  
  // Default renderer functions for different types of data
  const defaultRenderers = {
    late: (item) => (
      <div key={`late-${item.id}-${item.session_id}`} className="modern-list-item">
        <div className="d-flex align-items-center">
          <div className="modern-list-avatar bg-warning">
            <i className="fas fa-user-clock"></i>
          </div>
          <div className="modern-list-content">
            <h6 className="modern-list-title">{item.full_name}</h6>
            <div className="modern-list-meta">
              <span className="modern-list-meta-item">
                <i className="fas fa-calendar-day me-1"></i>
                {item.session_title || 'Buổi học'}
              </span>
              {item.minutes_late && (
                <span className="modern-badge modern-badge-warning">
                  Trễ {Math.round(item.minutes_late)} phút
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    ),
    
    absent: (item) => (
      <div key={`absent-${item.id}-${item.session_id}`} className="modern-list-item">
        <div className="d-flex align-items-center">
          <div className="modern-list-avatar bg-danger">
            <i className="fas fa-user-slash"></i>
          </div>
          <div className="modern-list-content">
            <h6 className="modern-list-title">{item.full_name}</h6>
            <div className="modern-list-meta">
              <span className="modern-list-meta-item">
                <i className="fas fa-calendar-day me-1"></i>
                {item.session_title || 'Buổi học'}
              </span>
              {item.session_date && (
                <span className="modern-list-meta-item">
                  <i className="fas fa-clock me-1"></i>
                  {formatDate(item.session_date)}
                </span>
              )}
              <span className="modern-badge modern-badge-danger">Vắng mặt</span>
            </div>
          </div>
        </div>
      </div>
    ),
    
    missingTimeSlot: (item) => (
      <div key={`missing-${item.id}-${item.session_id}`} className="modern-list-item">
        <div className="d-flex align-items-center">
          <div className="modern-list-avatar bg-warning">
            <i className="fas fa-exclamation-triangle"></i>
          </div>
          <div className="modern-list-content">
            <h6 className="modern-list-title">{item.full_name}</h6>
            <div className="modern-list-meta">
              <span className="modern-list-meta-item">
                <i className="fas fa-calendar-day me-1"></i>
                {item.session_title || 'Buổi học'}
              </span>
              <span className="modern-badge modern-badge-warning">
                {item.missing_type || 'Thiếu khung giờ điểm danh'}
              </span>
            </div>
          </div>
        </div>
      </div>
    ),
    
    multipleLate: (item) => (
      <div key={`multiple-late-${item.id}`} className="modern-list-item">
        <div className="d-flex align-items-center">
          <div className="modern-list-avatar bg-danger">
            <i className="fas fa-user-clock"></i>
          </div>
          <div className="modern-list-content">
            <h6 className="modern-list-title">{item.full_name}</h6>
            <div className="modern-list-meta">
              <span className="modern-badge modern-badge-danger">
                Đi trễ {item.late_count} lần
              </span>
            </div>
          </div>
        </div>
      </div>
    ),
    
    incompleteBadge: (item) => (
      <div key={`absence-${item.id}-${item.request_id}`} className="modern-list-item">
        <div className="d-flex align-items-center">
          <div className="modern-list-avatar bg-info">
            <i className="fas fa-id-badge"></i>
          </div>
          <div className="modern-list-content">
            <h6 className="modern-list-title">{item.full_name}</h6>
            <div className="modern-list-meta">
              <span className="modern-list-meta-item">
                <i className="fas fa-calendar-day me-1"></i>
                {item.session_title || 'Buổi học'}
              </span>
              {item.session_date && (
                <span className="modern-list-meta-item">
                  <i className="fas fa-clock me-1"></i>
                  {formatDate(item.session_date)}
                </span>
              )}
              <span className="modern-badge modern-badge-info">Chờ duyệt</span>
            </div>
          </div>
        </div>
      </div>
    ),
  };
  
  // Format date helper
  const formatDate = (dateString) => {
    try {
      if (!dateString) return '';
      const date = new Date(dateString);
      return format(date, 'dd/MM/yyyy');
    } catch (error) {
      console.error('Error formatting date:', error);
      return dateString;
    }
  };
  
  // Select the renderer to use
  const itemRenderer = renderItem || (type && defaultRenderers[type]) || defaultRenderers.late;
  
  return (
    <div className="modern-stats-list">
      <div className="modern-stats-list-header">
        <div className="modern-stats-list-title">
          {icon && <i className={`fas ${icon} me-2`}></i>}
          {title}
        </div>
        {data && data.length > 0 && (
          <div className="modern-stats-list-count">
            {data.length}
          </div>
        )}
      </div>
      
      <div className="modern-stats-list-body">
        {data && data.length > 0 ? (
          <div className="modern-stats-list-content">
            {data.slice(0, maxItems).map(item => itemRenderer(item))}
            {data.length > maxItems && (
              <div className="modern-stats-list-footer">
                <Button 
                  as={Link} 
                  to={detailPath} 
                  variant="link" 
                  className="modern-stats-list-more-btn"
                >
                  <i className="fas fa-arrow-right me-1"></i>
                  Xem thêm {data.length - maxItems} mục khác
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="modern-stats-list-empty">
            <div className="modern-stats-list-empty-icon">
              <i className="fas fa-info-circle"></i>
            </div>
            <div className="modern-stats-list-empty-text">
              {emptyMessage}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatisticsList;
