import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const WorkforcePlanning = () => {
  usePageTitle('Lập kế hoạch nhân sự');
  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Lập kế hoạch nhân sự chiến lược</h1>
            <p className="header-subtitle">Dự báo nhu cầu, kế hoạch kế thừa, đa dạng hóa</p>
          </div>
        </div>
      </div>

      <div className="session-card">
        <div className="card-header-modern">
          <div className="header-icon"><i className="fas fa-project-diagram"></i></div>
          <h6 className="mb-0">Kịch bản nhu cầu nhân sự 3-5 năm</h6>
        </div>
        <div className="card-body-modern">
          <p className="text-muted mb-0">Tính năng AI dự báo sẽ được tích hợp ở bản sau. Hiện hiển thị dữ liệu mô phỏng để demo UI.</p>
        </div>
      </div>
    </div>
  );
};

export default WorkforcePlanning;


