import React from 'react';
import '../../styles/dashboard.css';
import { Link } from 'react-router-dom';
import usePageTitle from '../../hooks/usePageTitle';

const PersonalDashboard = () => {
  usePageTitle('Bảng điều khiển cá nhân');
  const kpis = [
    { icon: 'fas fa-clock', label: 'Giờ làm hôm nay', value: '8h 15m', gradient: 'linear-gradient(135deg, #667eea, #764ba2)' },
    { icon: 'fas fa-calendar-check', label: 'Ngày làm việc tháng này', value: '18/22', gradient: 'linear-gradient(135deg, #f093fb, #f5576c)' },
    { icon: 'fas fa-file-alt', label: 'Giấy tờ chờ xử lý', value: 3, gradient: 'linear-gradient(135deg, #34d399, #10b981)' },
    { icon: 'fas fa-ticket-alt', label: 'Ticket đang mở', value: 2, gradient: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }
  ];

  const shortcuts = [
    { to: '/personal/attendance', icon: 'fas fa-clock', text: 'Chấm công' },
    { to: '/personal/documents', icon: 'fas fa-file-alt', text: 'Giấy tờ' },
    { to: '/personal/requests', icon: 'fas fa-clipboard-list', text: 'Yêu cầu' },
    { to: '/personal/profile', icon: 'fas fa-user-circle', text: 'Hồ sơ nhân sự' },
    { to: '/personal/tickets', icon: 'fas fa-ticket-alt', text: 'Ticket' }
  ];

  return (
    <div className="admin-dashboard-container">
      <div className="dashboard-header">
        <h2 className="dashboard-title">Dashboard Cá nhân</h2>
      </div>
      <div className="dashboard-stats-grid">
        <div className="row g-4">
          {kpis.map((kpi, idx) => (
            <div className="col-md-3 col-sm-6" key={idx}>
              <div className="stat-card">
                <div className="stat-card-body">
                  <div className="icon-container" style={{ background: kpi.gradient }}>
                    <i className={kpi.icon}></i>
                  </div>
                  <div className="stat-content">
                    <div className="stat-label">{kpi.label}</div>
                    <div className="stat-value">{kpi.value}</div>
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

export default PersonalDashboard;


