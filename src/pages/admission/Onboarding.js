import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Onboarding = () => {
  usePageTitle('Onboarding');
  const mock = [
    { appId: 'APP-001', payment: 'Đã thanh toán', health: 'OK', account: 'Đã cấp' }
  ];

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Nhập học & Onboarding</h1>
            <p className="header-subtitle">Thanh toán, hồ sơ y tế, cấp tài khoản</p>
          </div>
        </div>
      </div>
      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <table className="session-table">
            <thead>
              <tr>
                <th>Mã hồ sơ</th>
                <th>Thanh toán</th>
                <th>Sức khỏe</th>
                <th>Tài khoản</th>
              </tr>
            </thead>
            <tbody>
              {mock.map((r,i) => (
                <tr key={i}>
                  <td><span className="badge bg-secondary">{r.appId}</span></td>
                  <td>{r.payment}</td>
                  <td>{r.health}</td>
                  <td><span className="badge bg-success">{r.account}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;


