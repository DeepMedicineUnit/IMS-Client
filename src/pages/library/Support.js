import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/dashboard.css';

const Support = () => {
  usePageTitle('Hỗ trợ thư viện');
  return (
    <div className="admin-dashboard-container">
      <div className="dashboard-header">
        <h2 className="dashboard-title">Hỗ trợ người dùng & Chatbot</h2>
      </div>
      <div className="dashboard-stats-grid">
        <div className="row g-4">
          <div className="col-md-3 col-sm-6">
            <div className="stat-card">
              <div className="stat-card-body">
                <div className="icon-container" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
                  <i className="fas fa-robot"></i>
                </div>
                <div className="stat-content">
                  <div className="stat-label">Tỷ lệ giải quyết tự động</div>
                  <div className="stat-value">85%</div>
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


