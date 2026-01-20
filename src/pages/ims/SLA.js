import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const SLA = () => {
  usePageTitle('SLA - Thỏa thuận mức dịch vụ');
  const mock = [
    { service: 'Đăng nhập', target: '99.9%', achieved: '99.95%' },
    { service: 'Email', target: '99.0%', achieved: '99.1%' }
  ];

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>SLA</h1>
            <p className="header-subtitle">Cam kết dịch vụ và kết quả đạt được</p>
          </div>
        </div>
      </div>
      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <table className="session-table">
            <thead>
              <tr>
                <th>Dịch vụ</th>
                <th>Mục tiêu</th>
                <th>Đạt được</th>
              </tr>
            </thead>
            <tbody>
              {mock.map((r,i) => (
                <tr key={i}>
                  <td>{r.service}</td>
                  <td>{r.target}</td>
                  <td><span className="badge bg-success">{r.achieved}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SLA;



