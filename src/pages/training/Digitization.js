import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Digitization = () => {
  usePageTitle('Số hóa tài liệu');
  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Số hóa tài liệu & quy trình</h1>
            <p className="header-subtitle">OCR, phê duyệt 3 cấp, ký số hàng loạt</p>
          </div>
        </div>
      </div>

      <div className="session-card">
        <div className="card-header-modern">
          <div className="header-icon"><i className="fas fa-file-signature"></i></div>
          <h6 className="mb-0">Kho tài liệu đào tạo (demo)</h6>
        </div>
        <div className="card-body-modern">
          <p className="text-muted mb-0">Module số hóa sẽ kết nối Library/DMS ở bản chính thức.</p>
        </div>
      </div>
    </div>
  );
};

export default Digitization;


