import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, Row, Col, Table, Badge, Button, Alert, Spinner, Breadcrumb } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';

const StatisticsDetail = () => {
  const { metricType, studentId } = useParams();
  const { api } = useAuth();
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  useEffect(() => {
    const fetchStatistics = async () => {
      try {
        setLoading(true);
        setError('');
        
        let endpoint = `/dashboard/stats/${metricType}`;
        if (studentId) {
          endpoint += `/${studentId}`;
        }
        
        const response = await api.get(endpoint);
        if (response.data.success) {
          setStats(response.data.data);
        } else {
          setError('Không thể tải dữ liệu thống kê');
        }
      } catch (err) {
        console.error('Error fetching statistics:', err);
        setError('Lỗi khi tải dữ liệu. Vui lòng thử lại sau.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchStatistics();
  }, [api, metricType, studentId]);
  
  // Format date function
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
  
  // Format time function
  const formatTime = (timeString) => {
    if (!timeString) return '';
    return timeString;
  };
  
  // Get metric title
  const getMetricTitle = () => {
    switch (metricType) {
      case 'late':
        return 'Sinh viên đi trễ';
      case 'absent':
        return 'Sinh viên vắng mặt';
      case 'missingTimeSlot':
        return 'Sinh viên thiếu khung giờ điểm danh';
      case 'multipleLate':
        return 'Sinh viên đi trễ nhiều lần';
      case 'incompleteBadge':
        return 'Sinh viên không có badge Đầy đủ';
      default:
        return 'Thống kê chi tiết';
    }
  };
  
  // Render table content based on metric type
  const renderTableContent = () => {
    if (!stats || stats.length === 0) {
      return (
        <tr>
          <td colSpan="6" className="text-center py-4">
            Không có dữ liệu thống kê
          </td>
        </tr>
      );
    }
    
    switch (metricType) {
      case 'late':
        return stats.map((item, index) => (
          <tr key={`late-${item.id || index}-${item.session_id}`}>
            {!studentId && <td>{item.full_name}</td>}
            <td>{item.session_title}</td>
            <td>{formatDate(item.session_date)}</td>
            <td>{formatTime(item.start_time)}</td>
            <td>{formatTime(item.check_in_time)}</td>
            <td>
              <Badge bg="warning" text="dark">Trễ {Math.round(item.minutes_late)} phút</Badge>
            </td>
            <td>
              <Button 
                as={Link}
                to={`/admin/sessions/${item.session_id}/students/${item.id || studentId}`}
                variant="outline-primary"
                size="sm"
              >
                Chi tiết
              </Button>
            </td>
          </tr>
        ));
        
      case 'absent':
        return stats.map((item, index) => (
          <tr key={`absent-${item.id || index}-${item.session_id}`}>
            {!studentId && <td>{item.full_name}</td>}
            <td>{item.session_title}</td>
            <td>{formatDate(item.session_date)}</td>
            <td colSpan="2">
              <Badge bg="danger">Vắng mặt</Badge>
            </td>
            <td>
              <Button 
                as={Link}
                to={`/admin/sessions/${item.session_id}/students/${item.id || studentId}`}
                variant="outline-primary"
                size="sm"
              >
                Chi tiết
              </Button>
            </td>
          </tr>
        ));
        
      case 'missingTimeSlot':
        return stats.map((item, index) => (
          <tr key={`missing-${item.id || index}-${item.session_id}`}>
            {!studentId && <td>{item.full_name}</td>}
            <td>{item.session_title}</td>
            <td>{formatDate(item.session_date)}</td>
            <td>{formatTime(item.check_in_time) || '(Thiếu)'}</td>
            <td>{formatTime(item.check_out_time) || '(Thiếu)'}</td>
            <td>
              <Badge bg="warning" text="dark">
                {!item.check_in_time ? 'Thiếu giờ vào' : !item.check_out_time ? 'Thiếu giờ ra' : 'Lỗi điểm danh'}
              </Badge>
            </td>
            <td>
              <Button 
                as={Link}
                to={`/admin/sessions/${item.session_id}/students/${item.id || studentId}`}
                variant="outline-primary"
                size="sm"
              >
                Chi tiết
              </Button>
            </td>
          </tr>
        ));
        
      case 'multipleLate':
        if (studentId) {
          return stats.map((item, index) => (
            <tr key={`multi-late-detail-${index}-${item.session_id}`}>
              <td>{item.session_title}</td>
              <td>{formatDate(item.session_date)}</td>
              <td>{formatTime(item.start_time)}</td>
              <td>{formatTime(item.check_in_time)}</td>
              <td>
                <Badge bg="warning" text="dark">Trễ {Math.round(item.minutes_late)} phút</Badge>
              </td>
              <td>
                <Button 
                  as={Link}
                  to={`/admin/sessions/${item.session_id}/students/${studentId}`}
                  variant="outline-primary"
                  size="sm"
                >
                  Chi tiết
                </Button>
              </td>
            </tr>
          ));
        } else {
          return stats.map((item, index) => (
            <tr key={`multi-late-${item.id || index}`}>
              <td>{item.full_name}</td>
              <td colSpan="3">{item.username}</td>
              <td>
                <Badge bg="danger">Đi trễ {item.late_count} lần</Badge>
              </td>
              <td>
                <Button 
                  as={Link}
                  to={`/admin/stats/multipleLate/${item.id}`}
                  variant="outline-primary"
                  size="sm"
                >
                  Chi tiết
                </Button>
              </td>
            </tr>
          ));
        }
        
      case 'incompleteBadge':
        if (studentId) {
          return stats.map((item, index) => (
            <tr key={`incomplete-detail-${index}-${item.session_id}`}>
              <td>{item.session_title}</td>
              <td>{formatDate(item.session_date)}</td>
              <td>{formatTime(item.check_in_time) || '(Thiếu)'}</td>
              <td>{formatTime(item.check_out_time) || '(Thiếu)'}</td>
              <td>
                <Badge bg="danger">
                  {!item.check_in_time && !item.check_out_time ? 'Vắng mặt' : 
                   !item.check_in_time ? 'Thiếu giờ vào' : 'Thiếu giờ ra'}
                </Badge>
              </td>
              <td>
                <Button 
                  as={Link}
                  to={`/admin/sessions/${item.session_id}/students/${studentId}`}
                  variant="outline-primary"
                  size="sm"
                >
                  Chi tiết
                </Button>
              </td>
            </tr>
          ));
        } else {
          return stats.map((item, index) => (
            <tr key={`incomplete-${item.id || index}`}>
              <td>{item.full_name}</td>
              <td colSpan="3">{item.username}</td>
              <td>
                <Badge bg="danger">Vắng {item.missed_sessions} buổi</Badge>
              </td>
              <td>
                <Button 
                  as={Link}
                  to={`/admin/stats/incompleteBadge/${item.id}`}
                  variant="outline-primary"
                  size="sm"
                >
                  Chi tiết
                </Button>
              </td>
            </tr>
          ));
        }
      
      default:
        return (
          <tr>
            <td colSpan="6" className="text-center py-4">
              Loại thống kê không hợp lệ
            </td>
          </tr>
        );
    }
  };
  
  // Render table headers based on metric type
  const renderTableHeaders = () => {
    if (studentId) {
      // Detail view for a specific student
      switch (metricType) {
        case 'late':
          return (
            <tr>
              <th>Buổi học</th>
              <th>Ngày</th>
              <th>Giờ bắt đầu</th>
              <th>Giờ điểm danh</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          );
          
        case 'absent':
          return (
            <tr>
              <th>Buổi học</th>
              <th>Ngày</th>
              <th colSpan="2">Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          );
          
        case 'missingTimeSlot':
          return (
            <tr>
              <th>Buổi học</th>
              <th>Ngày</th>
              <th>Giờ vào</th>
              <th>Giờ ra</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          );
          
        case 'multipleLate':
          return (
            <tr>
              <th>Buổi học</th>
              <th>Ngày</th>
              <th>Giờ bắt đầu</th>
              <th>Giờ điểm danh</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          );
          
        case 'incompleteBadge':
          return (
            <tr>
              <th>Buổi học</th>
              <th>Ngày</th>
              <th>Giờ vào</th>
              <th>Giờ ra</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          );
          
        default:
          return (
            <tr>
              <th>Buổi học</th>
              <th>Ngày</th>
              <th>Thông tin</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          );
      }
    } else {
      // List view of all students
      switch (metricType) {
        case 'late':
          return (
            <tr>
              <th>Sinh viên</th>
              <th>Buổi học</th>
              <th>Ngày</th>
              <th>Giờ bắt đầu</th>
              <th>Giờ điểm danh</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          );
          
        case 'absent':
          return (
            <tr>
              <th>Sinh viên</th>
              <th>Buổi học</th>
              <th>Ngày</th>
              <th colSpan="2">Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          );
          
        case 'missingTimeSlot':
          return (
            <tr>
              <th>Sinh viên</th>
              <th>Buổi học</th>
              <th>Ngày</th>
              <th>Giờ vào</th>
              <th>Giờ ra</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          );
          
        case 'multipleLate':
        case 'incompleteBadge':
          return (
            <tr>
              <th>Sinh viên</th>
              <th colSpan="3">Mã số</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          );
          
        default:
          return (
            <tr>
              <th>Sinh viên</th>
              <th>Buổi học</th>
              <th>Ngày</th>
              <th>Thông tin</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          );
      }
    }
  };
  
  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2>{getMetricTitle()}</h2>
        <Button as={Link} to={studentId ? `/admin/stats/${metricType}` : '/admin'} variant="outline-secondary">
          <i className="fas fa-arrow-left me-2"></i>Quay lại
        </Button>
      </div>
      
      <Breadcrumb className="mb-4">
        <Breadcrumb.Item linkAs={Link} linkProps={{ to: '/admin' }}>Bảng điều khiển</Breadcrumb.Item>
        {!studentId && (
          <Breadcrumb.Item active>{getMetricTitle()}</Breadcrumb.Item>
        )}
        {studentId && (
          <>
            <Breadcrumb.Item linkAs={Link} linkProps={{ to: `/admin/stats/${metricType}` }}>{getMetricTitle()}</Breadcrumb.Item>
            <Breadcrumb.Item active>Chi tiết sinh viên</Breadcrumb.Item>
          </>
        )}
      </Breadcrumb>
      
      {error && <Alert variant="danger">{error}</Alert>}
      
      <Card className="shadow-sm">
        <Card.Header className="bg-light">
          <h5 className="mb-0">
            {studentId ? 'Chi tiết sinh viên' : 'Danh sách sinh viên'}
          </h5>
        </Card.Header>
        <Card.Body className="p-0">
          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" role="status">
                <span className="visually-hidden">Đang tải...</span>
              </Spinner>
            </div>
          ) : (
            <Table responsive hover className="mb-0">
              <thead>
                {renderTableHeaders()}
              </thead>
              <tbody>
                {renderTableContent()}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default StatisticsDetail;
