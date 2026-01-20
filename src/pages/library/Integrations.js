import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Integrations = () => {
  usePageTitle('Tích hợp thư viện');
  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Tích hợp & API</h1>
            <p className="header-subtitle">REST/GraphQL, SSO, Webhook</p>
          </div>
        </div>
      </div>

      <div className="session-card">
        <div className="card-header-modern">
          <div className="header-icon"><i className="fas fa-plug"></i></div>
          <h6 className="mb-0">Kết nối (demo)</h6>
        </div>
        <div className="card-body-modern">
          <p className="text-muted mb-0">Các endpoint cấu hình sẽ hiển thị tại đây.</p>
        </div>
      </div>
    </div>
  );
};

export default Integrations;


