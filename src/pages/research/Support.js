import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/dashboard.css';

const Support = () => {
  usePageTitle('Hỗ trợ nghiên cứu');
  return (
    <div className="admin-dashboard-container">
      <div className="dashboard-header">
        <h2 className="dashboard-title">Hỗ trợ người dùng</h2>
      </div>
      <div className="dashboard-stats-grid">
        <div className="row g-4">
          <div className="col-md-3 col-sm-6">
            <div className="stat-card">
              <div className="stat-card-body">
                <div className="icon-container" style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }}>
                  <i className="fas fa-headset"></i>
                </div>
                <div className="stat-content">
                  <div className="stat-label">Hài lòng</div>
                  <div className="stat-value">90%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Support;


