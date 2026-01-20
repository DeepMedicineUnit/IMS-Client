import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Integrations = () => {
  usePageTitle('Tích hợp tuyển sinh');
  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Tích hợp & Bảo mật</h1>
            <p className="header-subtitle">Kết nối Bộ GD&ĐT, SSO/2FA, PDPA</p>
          </div>
        </div>
      </div>
      <div className="session-card">
        <div className="card-header-modern">
          <div className="header-icon"><i className="fas fa-plug"></i></div>
          <h6 className="mb-0">Cấu hình tích hợp (demo)</h6>
        </div>
        <div className="card-body-modern">
          <p className="text-muted mb-0">Endpoint và khóa API sẽ hiển thị ở đây khi có cấu hình.</p>
        </div>
      </div>
    </div>
  );
};

export default Integrations;


