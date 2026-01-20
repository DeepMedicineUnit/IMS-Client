import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/dashboard.css';
import { Link } from 'react-router-dom';

const LibraryDashboard = () => {
  usePageTitle('Bảng điều khiển Thư viện');
  const kpis = [
    { icon: 'fas fa-folder-open', label: 'Tài liệu số', value: '500k+', gradient: 'linear-gradient(135deg, #4b5563, #0ea5e9)' },
    { icon: 'fas fa-search', label: 'Tìm kiếm/Ngày', value: '12,4k', gradient: 'linear-gradient(135deg, #22c55e, #16a34a)' },
    { icon: 'fas fa-video', label: 'Video 4K', value: '10k+', gradient: 'linear-gradient(135deg, #a78bfa, #7c3aed)' },
    { icon: 'fas fa-file-medical', label: 'Guideline', value: '2k+', gradient: 'linear-gradient(135deg, #f59e0b, #f97316)' }
  ];

  const shortcuts = [
    { to: '/library/repository', icon: 'fas fa-folder-open', text: 'Kho tài liệu số' },
    { to: '/library/search', icon: 'fas fa-search', text: 'Tìm kiếm AI' },
    { to: '/library/recommend', icon: 'fas fa-magic', text: 'Gợi ý học liệu' },
    { to: '/library/videos', icon: 'fas fa-video', text: 'Video học liệu' },
    { to: '/library/guidelines', icon: 'fas fa-file-medical', text: 'Guideline & SOP' },
    { to: '/library/cases', icon: 'fas fa-procedures', text: 'Case bank' },
    { to: '/library/research', icon: 'fas fa-flask', text: 'Luận văn & Nghiên cứu' },
    { to: '/library/vr', icon: 'fas fa-vr-cardboard', text: '3D & VR' }
  ];

  return (
    <div className="admin-dashboard-container">
      <div className="dashboard-header">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h2 className="dashboard-title">Library Dashboard</h2>
            <div className="text-muted">Tổng quan kho học liệu, tìm kiếm, guideline và video</div>
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
            <div className="chart-title">Tài liệu phổ biến</div>
            <div className="p-4 text-muted">Khu vực biểu đồ tài liệu hot (placeholder).</div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="chart-section">
            <div className="chart-title">Thông báo Library</div>
            <ul className="mb-0">
              <li>Guideline ESC 2025 mới: Suy tim</li>
              <li>Thêm 200 case mới (ICD-11)</li>
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

export default LibraryDashboard;


