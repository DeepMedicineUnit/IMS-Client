import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Finance = () => {
  usePageTitle('Tài chính');
  const mock = [
    { item: 'Học phí HK1/2025', amount: '2.5B', status: 'Đã thu 90%' },
    { item: 'Dự toán thiết bị Lab', amount: '1.2B', status: 'Đang duyệt' }
  ];

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Tài chính</h1>
            <p className="header-subtitle">Học phí, công nợ, dự toán – quyết toán</p>
          </div>
        </div>
      </div>

      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <table className="session-table">
            <thead>
              <tr>
                <th>Khoản mục</th>
                <th>Số tiền</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {mock.map((r,i) => (
                <tr key={i}>
                  <td>{r.item}</td>
                  <td>{r.amount}</td>
                  <td><span className={`badge ${r.status.includes('duyệt') ? 'bg-warning text-dark' : 'bg-success'}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Finance;


