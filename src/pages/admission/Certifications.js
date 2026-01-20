import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Certifications = () => {
  usePageTitle('Chứng chỉ');
  const mock = [
    { appId: 'APP-045', cert: 'IELTS 7.0', priority: 'Ưu tiên PT2', valid: 'Hợp lệ' }
  ];

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Chứng chỉ & ưu tiên</h1>
            <p className="header-subtitle">Xác thực chứng chỉ, áp dụng ưu tiên</p>
          </div>
        </div>
      </div>
      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <table className="session-table">
            <thead>
              <tr>
                <th>Mã hồ sơ</th>
                <th>Chứng chỉ</th>
                <th>Ưu tiên</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {mock.map((c,i) => (
                <tr key={i}>
                  <td><span className="badge bg-secondary">{c.appId}</span></td>
                  <td>{c.cert}</td>
                  <td>{c.priority}</td>
                  <td><span className="badge bg-success">{c.valid}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Certifications;


