import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/dashboard.css';

const Reporting = () => {
  usePageTitle('Báo cáo đào tạo');
  return (
    <div className="admin-dashboard-container">
      <div className="dashboard-header">
        <h2 className="dashboard-title">Báo cáo & Phân tích nâng cao</h2>
      </div>
      <div className="dashboard-stats-grid">
        <div className="row g-4">
          <div className="col-md-3 col-sm-6">
            <div className="stat-card">
              <div className="stat-card-body">
                <div className="icon-container" style={{ background: 'linear-gradient(135deg, #4f46e5, #06b6d4)' }}>
                  <i className="fas fa-level-up-alt"></i>
                </div>
                <div className="stat-content">
                  <div className="stat-label">Kirkpatrick L2 cải thiện</div>
                  <div className="stat-value">+15%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reporting;


