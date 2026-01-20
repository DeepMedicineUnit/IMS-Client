import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/dashboard.css';

const Analytics = () => {
  usePageTitle('Phân tích thư viện');
  return (
    <div className="admin-dashboard-container">
      <div className="dashboard-header">
        <h2 className="dashboard-title">Library Analytics</h2>
      </div>
      <div className="dashboard-stats-grid">
        <div className="row g-4">
          <div className="col-md-3 col-sm-6">
            <div className="stat-card">
              <div className="stat-card-body">
                <div className="icon-container" style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)' }}>
                  <i className="fas fa-fire"></i>
                </div>
                <div className="stat-content">
                  <div className="stat-label">Tài liệu hot</div>
                  <div className="stat-value">30%</div>
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


