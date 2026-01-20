import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/dashboard.css';
import { Link } from 'react-router-dom';

const HRDashboard = () => {
  usePageTitle('Bảng điều khiển HR');
  // Mock KPIs for demo UI
  const kpis = [
    { icon: 'fas fa-id-badge', label: 'Tổng nhân sự', value: 128, gradient: 'linear-gradient(135deg, #667eea, #764ba2)' },
    { icon: 'fas fa-user-plus', label: 'Đang tuyển', value: 6, gradient: 'linear-gradient(135deg, #f093fb, #f5576c)' },
    { icon: 'fas fa-user-check', label: 'Hiện diện hôm nay', value: '96%', gradient: 'linear-gradient(135deg, #34d399, #10b981)' },
    { icon: 'fas fa-certificate', label: 'CME hoàn thành', value: '78%', gradient: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }
  ];

  const shortcuts = [
    { to: '/hr/profiles', icon: 'fas fa-user-md', text: 'Hồ sơ nhân sự' },
    { to: '/hr/recruitment', icon: 'fas fa-user-plus', text: 'Tuyển dụng' },
    { to: '/hr/attendance', icon: 'fas fa-user-check', text: 'Chấm công' },
    { to: '/hr/training', icon: 'fas fa-certificate', text: 'Đào tạo & CME' },
    { to: '/hr/payroll', icon: 'fas fa-coins', text: 'Lương & phúc lợi' },
    { to: '/hr/performance', icon: 'fas fa-chart-line', text: 'Hiệu suất' },
    { to: '/hr/documents', icon: 'fas fa-file-signature', text: 'Giấy tờ' },
    { to: '/hr/analytics', icon: 'fas fa-chart-pie', text: 'Báo cáo & BI' }
  ];

  return (
    <div className="admin-dashboard-container">
      <div className="dashboard-header">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h2 className="dashboard-title">HR Dashboard</h2>
          </div>
        </div>
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

      <div className="row g-4 mt-1">
        <div className="col-lg-8">
          <div className="chart-section">
            <div className="chart-title">Tình hình tuyển dụng tháng này</div>
            <div className="p-4 text-muted">Biểu đồ sẽ tích hợp sau. Hiện là placeholder để đồng bộ layout.</div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="chart-section">
            <div className="chart-title">Cảnh báo tuân thủ</div>
            <ul className="mb-0">
              <li>03 chứng chỉ hành nghề sắp hết hạn</li>
              <li>02 hợp đồng cần ký số</li>
            </ul>
          </div>
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

export default HRDashboard;


