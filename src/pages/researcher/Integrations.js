import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Integrations = () => {
  usePageTitle('Tích hợp nghiên cứu');
  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Tích hợp & Hỗ trợ</h1>
            <p className="header-subtitle">API với MedSuite, SSO, Chatbot hỗ trợ</p>
          </div>
        </div>
      </div>
      <div className="session-card">
        <div className="card-header-modern">
          <div className="header-icon"><i className="fas fa-plug"></i></div>
          <h6 className="mb-0">Cấu hình API (demo)</h6>
        </div>
        <div className="card-body-modern">
          <p className="text-muted mb-0">Thiết lập khóa kết nối tới Library, Training Scopus/PubMed.</p>
        </div>
      </div>
    </div>
  );
};

export default Integrations;


