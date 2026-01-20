import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Applications = () => {
  usePageTitle('Hồ sơ ứng tuyển');
  const mock = [
    { appId: 'APP-001', name: 'Nguyễn A', method: 'THPT', status: 'Hợp lệ' },
    { appId: 'APP-045', name: 'Trần B', method: 'Kết hợp CC', status: 'Thiếu giấy tờ' }
  ];

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Hồ sơ trực tuyến</h1>
            <p className="header-subtitle">Form động, OCR, xác thực Bộ GD&ĐT</p>
          </div>
        </div>
      </div>
      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <table className="session-table">
            <thead>
              <tr>
                <th>Mã hồ sơ</th>
                <th>Thí sinh</th>
                <th>Phương thức</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {mock.map((a,i) => (
                <tr key={i}>
                  <td><span className="badge bg-secondary">{a.appId}</span></td>
                  <td>{a.name}</td>
                  <td>{a.method}</td>
                  <td><span className={`badge ${a.status === 'Hợp lệ' ? 'bg-success' : 'bg-warning text-dark'}`}>{a.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Applications;


