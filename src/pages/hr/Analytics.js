import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/dashboard.css';

const Analytics = () => {
  usePageTitle('Phân tích nhân sự');
  return (
    <div className="admin-dashboard-container">
      <div className="dashboard-header">
        <h2 className="dashboard-title">Báo cáo & Phân tích nhân sự</h2>
      </div>
      <div className="dashboard-stats-grid">
        <div className="row g-4">
          <div className="col-md-3 col-sm-6">
            <div className="stat-card">
              <div className="stat-card-body">
                <div className="icon-container" style={{ background: 'linear-gradient(135deg, #34d399, #10b981)' }}>
                  <i className="fas fa-user-check"></i>
                </div>
                <div className="stat-content">
                  <div className="stat-label">Tỷ lệ hiện diện</div>
                  <div className="stat-value">96%</div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-3 col-sm-6">
            <div className="stat-card">
              <div className="stat-card-body">
                <div className="icon-container" style={{ background: 'linear-gradient(135deg, #f59e0b, #fbbf24)' }}>
                  <i className="fas fa-user-clock"></i>
                </div>
                <div className="stat-content">
                  <div className="stat-label">Đi trễ</div>
                  <div className="stat-value">4%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;


