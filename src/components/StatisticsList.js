import React from 'react';
import { Card, Button, ListGroup, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

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
      <ListGroup.Item key={`late-${item.id}-${item.session_id}`} className="d-flex justify-content-between align-items-center py-3">
        <div>
          <h6 className="mb-1">{item.full_name}</h6>
          <div className="text-muted small">
            <span className="me-3">
              <i className="fas fa-calendar-day me-1"></i> {item.session_title || 'Buổi học'}
            </span>
            {item.minutes_late && (
              <Badge bg="warning" text="dark">Trễ {Math.round(item.minutes_late)} phút</Badge>
            )}
          </div>
        </div>
        <Button 
          as={Link} 
          to={`/admin/sessions/${item.session_id}/students/${item.id}`} 
          variant="outline-primary" 
          size="sm"
        >
          Chi tiết
        </Button>
      </ListGroup.Item>
    ),
    
    absent: (item) => (
      <ListGroup.Item key={`absent-${item.id}-${item.session_id}`} className="d-flex justify-content-between align-items-center py-3">
        <div>
          <h6 className="mb-1">{item.full_name}</h6>
          <div className="text-muted small">
            <span className="me-3">
              <i className="fas fa-calendar-day me-1"></i> {item.session_title || 'Buổi học'}
            </span>
            {item.session_date && (
              <span className="me-3">
                <i className="fas fa-clock me-1"></i> {formatDate(item.session_date)}
              </span>
            )}
            <Badge bg="danger">Vắng mặt</Badge>
          </div>
        </div>
        <Button 
          as={Link} 
          to={`/admin/sessions/${item.session_id}/students/${item.id}`} 
          variant="outline-primary" 
          size="sm"
        >
          Chi tiết
        </Button>
      </ListGroup.Item>
    ),
    
    missingTimeSlot: (item) => (
      <ListGroup.Item key={`missing-${item.id}-${item.session_id}`} className="d-flex justify-content-between align-items-center py-3">
        <div>
          <h6 className="mb-1">{item.full_name}</h6>
          <div className="text-muted small">
            <span className="me-3">
              <i className="fas fa-calendar-day me-1"></i> {item.session_title || 'Buổi học'}
            </span>
            <Badge bg="warning" text="dark">
              {!item.check_in_time ? 'Thiếu giờ vào' : !item.check_out_time ? 'Thiếu giờ ra' : 'Lỗi điểm danh'}
            </Badge>
          </div>
        </div>
        <Button 
          as={Link} 
          to={`/admin/sessions/${item.session_id}/students/${item.id}`} 
          variant="outline-primary" 
          size="sm"
        >
          Chi tiết
        </Button>
      </ListGroup.Item>
    ),
    
    multipleLate: (item) => (
      <ListGroup.Item key={`multiple-late-${item.id}`} className="d-flex justify-content-between align-items-center py-3">
        <div>
          <h6 className="mb-1">{item.full_name}</h6>
          <div className="text-muted small">
            <Badge bg="danger">Đi trễ {item.late_count} lần</Badge>
          </div>
        </div>
        <Button 
          as={Link} 
          to={`/admin/students/${item.id}`} 
          variant="outline-primary" 
          size="sm"
        >
          Chi tiết
        </Button>
      </ListGroup.Item>
    ),
    
    incompleteBadge: (item) => (
      <ListGroup.Item key={`incomplete-${item.id}`} className="d-flex justify-content-between align-items-center py-3">
        <div>
          <h6 className="mb-1">{item.full_name}</h6>
          <div className="text-muted small">
            <Badge bg="danger">Vắng {item.missed_sessions} buổi</Badge>
          </div>
        </div>
        <Button 
          as={Link} 
          to={`/admin/students/${item.id}`} 
          variant="outline-primary" 
          size="sm"
        >
          Chi tiết
        </Button>
      </ListGroup.Item>
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
    <Card className="h-100 shadow-sm">
      <Card.Header className={`bg-${bgColor} text-white d-flex justify-content-between align-items-center`}>
        <h5 className="mb-0">
          {icon && <i className={`fas ${icon} me-2`}></i>}
          {title}
        </h5>
        {detailPath && (
          <Button 
            as={Link} 
            to={detailPath} 
            variant="light" 
            size="sm"
          >
            Xem tất cả
          </Button>
        )}
      </Card.Header>
      <Card.Body className="p-0">
        {data && data.length > 0 ? (
          <ListGroup variant="flush">
            {data.slice(0, maxItems).map(item => itemRenderer(item))}
            {data.length > maxItems && (
              <ListGroup.Item className="text-center">
                <Button 
                  as={Link} 
                  to={detailPath} 
                  variant="link" 
                  size="sm"
                >
                  Xem thêm {data.length - maxItems} mục khác
                </Button>
              </ListGroup.Item>
            )}
          </ListGroup>
        ) : (
          <div className="text-center text-muted p-4">
            <i className="fas fa-info-circle fa-2x mb-2"></i>
            <p>{emptyMessage}</p>
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

export default StatisticsList;
