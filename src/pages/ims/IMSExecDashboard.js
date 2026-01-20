import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/dashboard.css';

const IMSExecDashboard = () => {
  usePageTitle('Bảng điều khiển IMS');
  const kpis = [
    { icon: 'fas fa-ticket-alt', label: 'Ticket mở', value: '32', gradient: 'linear-gradient(135deg, #ef4444, #f97316)' },
    { icon: 'fas fa-bolt', label: 'SLA đạt', value: '98%', gradient: 'linear-gradient(135deg, #22c55e, #16a34a)' },
    { icon: 'fas fa-database', label: 'Kho dữ liệu', value: '1.2TB', gradient: 'linear-gradient(135deg, #06b6d4, #3b82f6)' },
    { icon: 'fas fa-user-shield', label: 'Sự cố bảo mật', value: '0', gradient: 'linear-gradient(135deg, #a78bfa, #7c3aed)' }
  ];

  return (
    <div className="admin-dashboard-container">
      <div className="dashboard-header">
        <h2 className="dashboard-title">IMS - Dashboard điều hành</h2>
      </div>
      <div className="dashboard-stats-grid">
        <div className="row g-4">
          {kpis.map((k, i) => (
            <div className="col-md-3 col-sm-6" key={i}>
              <div className="stat-card">
                <div className="stat-card-body">
                  <div className="icon-container" style={{ background: k.gradient }}>
                    <i className={k.icon}></i>
                  </div>
                  <div className="stat-content">
                    <div className="stat-label">{k.label}</div>
                    <div className="stat-value">{k.value}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default IMSExecDashboard;



