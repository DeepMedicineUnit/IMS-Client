import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/dashboard.css';

const ResearchReporting = () => {
  usePageTitle('Báo cáo nghiên cứu');
  return (
    <div className="admin-dashboard-container">
      <div className="dashboard-header">
        <h2 className="dashboard-title">Báo cáo & Phân tích nghiên cứu</h2>
      </div>
      <div className="dashboard-stats-grid">
        <div className="row g-4">
          <div className="col-md-3 col-sm-6">
            <div className="stat-card">
              <div className="stat-card-body">
                <div className="icon-container" style={{ background: 'linear-gradient(135deg, #16a34a, #22c55e)' }}>
                  <i className="fas fa-chart-line"></i>
                </div>
                <div className="stat-content">
                  <div className="stat-label">Quyết định dựa dữ liệu</div>
                  <div className="stat-value">70%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResearchReporting;


