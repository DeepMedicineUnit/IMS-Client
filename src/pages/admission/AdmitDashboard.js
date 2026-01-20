import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/dashboard.css';
import { Link } from 'react-router-dom';

const AdmitDashboard = () => {
  usePageTitle('Bảng điều khiển Tuyển sinh');
  const kpis = [
    { icon: 'fas fa-bullhorn', label: 'Leads tháng này', value: '14k', gradient: 'linear-gradient(135deg, #06b6d4, #3b82f6)' },
    { icon: 'fas fa-user-edit', label: 'Hồ sơ nộp', value: '6,200', gradient: 'linear-gradient(135deg, #22c55e, #16a34a)' },
    { icon: 'fas fa-clipboard-check', label: 'Đã xét', value: '4,800', gradient: 'linear-gradient(135deg, #f59e0b, #f97316)' },
    { icon: 'fas fa-user-graduate', label: 'Xác nhận nhập học', value: '90%', gradient: 'linear-gradient(135deg, #a78bfa, #7c3aed)' }
  ];

  const shortcuts = [
    { to: '/admission/leads', icon: 'fas fa-bullhorn', text: 'Lead & CRM' },
    { to: '/admission/applications', icon: 'fas fa-file-signature', text: 'Hồ sơ trực tuyến' },
    { to: '/admission/evaluation', icon: 'fas fa-clipboard-check', text: 'Xét tuyển' },
    { to: '/admission/results', icon: 'fas fa-list', text: 'Kết quả' }
  ];

  return (
    <div className="admin-dashboard-container">
      <div className="dashboard-header">
        <h2 className="dashboard-title">Admission Dashboard</h2>
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

      <div className="mt-4">
        <div className="chart-title mb-2">Đi đến nhanh</div>
        <div className="row g-3">
          {shortcuts.map(s => (
            <div className="col-sm-6 col-md-3" key={s.to}>
              <Link to={s.to} className="text-decoration-none">
                <div className="stat-card">
                  <div className="stat-card-body d-flex align-items-center">
                    <div className="icon-container" style={{ background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)', color: '#374151' }}>
                      <i className={s.icon}></i>
                    </div>
                    <div className="ms-2">
                      <div className="stat-label">{s.text}</div>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdmitDashboard;


