import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const DRM = () => {
  usePageTitle('Quản lý quyền số');
  const mock = [
    { role: 'Sinh viên YK1', access: 'Nội cơ bản', watermark: 'Bật' },
    { role: 'Bác sĩ', access: 'Tất cả guideline', watermark: 'Bật' }
  ];

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>DRM & Access Control</h1>
            <p className="header-subtitle">RBAC/ABAC, watermark động, chống sao chép</p>
          </div>
        </div>
      </div>

      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <table className="session-table">
            <thead>
              <tr>
                <th>Vai trò</th>
                <th>Quyền truy cập</th>
                <th>Watermark</th>
              </tr>
            </thead>
            <tbody>
              {mock.map((r,i) => (
                <tr key={i}>
                  <td>{r.role}</td>
                  <td>{r.access}</td>
                  <td><span className="badge bg-info">{r.watermark}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DRM;


