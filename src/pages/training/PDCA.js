import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/dashboard.css';

const PDCA = () => {
  usePageTitle('Cải tiến liên tục (PDCA)');
  return (
    <div className="admin-dashboard-container">
      <div className="dashboard-header">
        <h2 className="dashboard-title">Cải tiến liên tục (PDCA)</h2>
      </div>
      <div className="dashboard-stats-grid">
        <div className="row g-4">
          <div className="col-md-3 col-sm-6">
            <div className="stat-card">
              <div className="stat-card-body">
                <div className="icon-container" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
                  <i className="fas fa-lightbulb"></i>
                </div>
                <div className="stat-content">
                  <div className="stat-label">Số ý tưởng</div>
                  <div className="stat-value">20+</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PDCA;


