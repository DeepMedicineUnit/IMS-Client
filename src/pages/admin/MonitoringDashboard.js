import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, Button, Alert } from 'react-bootstrap';

const MonitoringDashboard = () => {
  const { id } = useParams();

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Giám sát buổi học</h2>
        <Button 
          as={Link}
          to={`/admin/sessions/${id}`}
          variant="outline-primary"
        >
          Quay lại chi tiết
        </Button>
      </div>
      
      <Card>
        <Card.Body className="text-center">
          <Alert variant="info">
            <Alert.Heading>Tính năng đã bị loại bỏ</Alert.Heading>
            <p>Tính năng giám sát buổi học đã được loại bỏ khỏi hệ thống.</p>
            <p>Vui lòng sử dụng tính năng "Lịch sử hoạt động" để xem thông tin về buổi học.</p>
            <Button 
              as={Link}
              to={`/admin/sessions/${id}/history`}
              variant="outline-primary"
              className="mt-3"
            >
              <i className="fas fa-history me-2"></i>
              Xem lịch sử hoạt động
            </Button>
          </Alert>
        </Card.Body>
      </Card>
    </div>
  );
};

export default MonitoringDashboard;