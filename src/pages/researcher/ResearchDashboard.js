import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/dashboard.css';
import { Link } from 'react-router-dom';

const ResearchDashboard = () => {
  usePageTitle('Bảng điều khiển Nghiên cứu');
  const kpis = [
    { icon: 'fas fa-project-diagram', label: 'Đề tài đang chạy', value: '58', gradient: 'linear-gradient(135deg, #06b6d4, #3b82f6)' },
    { icon: 'fas fa-hand-holding-usd', label: 'Tỷ lệ trúng quỹ', value: '42%', gradient: 'linear-gradient(135deg, #22c55e, #16a34a)' },
    { icon: 'fas fa-book', label: 'Công bố quốc tế/năm', value: '120', gradient: 'linear-gradient(135deg, #f59e0b, #f97316)' },
    { icon: 'fas fa-user-tie', label: 'Nhà nghiên cứu', value: '230', gradient: 'linear-gradient(135deg, #a78bfa, #7c3aed)' }
  ];

  const shortcuts = [
    { to: '/researcher/projects', icon: 'fas fa-project-diagram', text: 'Đề tài' },
    { to: '/researcher/funding', icon: 'fas fa-hand-holding-usd', text: 'Quỹ & tài trợ' },
    { to: '/researcher/publications', icon: 'fas fa-book', text: 'Công bố' },
    { to: '/researcher/reporting', icon: 'fas fa-chart-line', text: 'Báo cáo' }
  ];

  return (
    <div className="admin-dashboard-container">
      <div className="dashboard-header">
        <h2 className="dashboard-title">Researcher Dashboard</h2>
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

export default ResearchDashboard;


