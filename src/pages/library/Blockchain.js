import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Blockchain = () => {
  usePageTitle('Blockchain');
  const mock = [
    { id: 'HASH-001', doc: 'CME Nội khoa 2025', hash: '0xA1B2...E9', status: 'Xác thực' }
  ];

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Blockchain xác thực tài liệu</h1>
            <p className="header-subtitle">Hash không thể sửa, QR xác minh, Hyperledger</p>
          </div>
        </div>
      </div>

      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <table className="session-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Tài liệu</th>
                <th>Hash</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {mock.map(r => (
                <tr key={r.id}>
                  <td><span className="badge bg-secondary">{r.id}</span></td>
                  <td>{r.doc}</td>
                  <td><code>{r.hash}</code></td>
                  <td><span className="badge bg-success">{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Blockchain;


