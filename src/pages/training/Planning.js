import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Planning = () => {
  usePageTitle('Lập kế hoạch đào tạo');
  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Lập kế hoạch đào tạo chiến lược</h1>
            <p className="header-subtitle">Dự báo nhu cầu, ánh xạ HPET, ngân sách thông minh</p>
          </div>
        </div>
      </div>

      <div className="session-card">
        <div className="card-header-modern">
          <div className="header-icon"><i className="fas fa-bullseye"></i></div>
          <h6 className="mb-0">Mô hình dự báo (demo)</h6>
        </div>
        <div className="card-body-modern">
          <p className="text-muted mb-0">AI Demand Forecasting sẽ được tích hợp sau. Hiện là placeholder để đồng bộ giao diện.</p>
        </div>
      </div>
    </div>
  );
};

export default Planning;


