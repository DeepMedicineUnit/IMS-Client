import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Mobile = () => {
  usePageTitle('Thư viện di động');
  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Di động & Offline</h1>
            <p className="header-subtitle">App iOS/Android, PWA, đồng bộ offline</p>
          </div>
        </div>
      </div>

      <div className="session-card">
        <div className="card-header-modern">
          <div className="header-icon"><i className="fas fa-mobile-alt"></i></div>
          <h6 className="mb-0">Trải nghiệm di động (demo)</h6>
        </div>
        <div className="card-body-modern">
          <p className="text-muted mb-0">Tải về và đọc offline sẽ được mô phỏng ở bản tiếp theo.</p>
        </div>
      </div>
    </div>
  );
};

export default Mobile;


