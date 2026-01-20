import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Delivery = () => {
  usePageTitle('Thực hiện đào tạo');
  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Thực hiện đào tạo</h1>
            <p className="header-subtitle">Hybrid classroom, ghi hình, offline sync</p>
          </div>
        </div>
      </div>

      <div className="session-card">
        <div className="card-header-modern">
          <div className="header-icon"><i className="fas fa-chalkboard-teacher"></i></div>
          <h6 className="mb-0">Phiên đào tạo mẫu</h6>
        </div>
        <div className="card-body-modern">
          <p className="text-muted mb-0">Tích hợp BBB/Zoom và ghi hình sẽ hiển thị tại đây.</p>
        </div>
      </div>
    </div>
  );
};

export default Delivery;


