import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/dashboard.css';

const Recommend = () => {
  usePageTitle('Gợi ý học liệu');
  return (
    <div className="admin-dashboard-container">
      <div className="dashboard-header">
        <h2 className="dashboard-title">Gợi ý học liệu cá nhân hóa</h2>
      </div>
      <div className="dashboard-stats-grid">
        <div className="row g-4">
          <div className="col-md-3 col-sm-6">
            <div className="stat-card">
              <div className="stat-card-body">
                <div className="icon-container" style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }}>
                  <i className="fas fa-magic"></i>
                </div>
                <div className="stat-content">
                  <div className="stat-label">CTR gợi ý</div>
                  <div className="stat-value">40%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Recommend;


