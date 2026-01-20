import React, { useState } from 'react';
import usePageTitle from '../../hooks/usePageTitle';

const PersonalNotifications = () => {
  usePageTitle('Thông báo');
  const [notifications] = useState([
    { id: 1, type: 'system', title: 'Bảo trì hệ thống', content: 'Hệ thống sẽ bảo trì lúc 22:00 hôm nay.', time: '2 giờ trước' },
    { id: 2, type: 'policy', title: 'Quy định mới', content: 'Cập nhật quy định về xin nghỉ phép.', time: 'Hôm qua' },
    { id: 3, type: 'reminder', title: 'Nhắc việc', content: 'Nộp giấy tờ thực tập trước thứ 6.', time: '3 ngày trước' }
  ]);

  const typeBadge = (type) => {
    switch (type) {
      case 'system': return <span className="badge bg-primary">Hệ thống</span>;
      case 'policy': return <span className="badge bg-info text-dark">Quy định</span>;
      case 'reminder': return <span className="badge bg-warning text-dark">Nhắc việc</span>;
      default: return <span className="badge bg-secondary">Khác</span>;
    }
  };

  return (
    <div className="admin-dashboard-container">
      <div className="dashboard-header">
        <h2 className="dashboard-title">Thông báo</h2>
        <p className="text-muted mb-0">Hệ thống, quy định mới, nhắc việc</p>
      </div>

      <div className="session-card mt-3">
        <div className="card-header-modern">
          <div className="header-icon">
            <i className="fas fa-bell"></i>
          </div>
          <h6 className="mb-0">Danh sách thông báo</h6>
        </div>
        <div className="card-body-modern">
          {notifications.length === 0 ? (
            <div className="text-muted">Chưa có thông báo nào</div>
          ) : (
            <div className="list-group">
              {notifications.map(n => (
                <div key={n.id} className="list-group-item">
                  <div className="d-flex align-items-center justify-content-between mb-1">
                    <div className="fw-semibold">{n.title}</div>
                    <small className="text-muted">{n.time}</small>
                  </div>
                  <div className="mb-1">{n.content}</div>
                  {typeBadge(n.type)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PersonalNotifications;



