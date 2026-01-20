import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Assets = () => {
  usePageTitle('Quản lý tài sản');
  const mock = [
    { code: 'AST-001', name: 'Máy siêu âm', location: 'Lab Sim-01', status: 'Đang sử dụng' },
    { code: 'AST-024', name: 'Máy ECG', location: 'Lab ECG', status: 'Bảo trì' }
  ];

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Tài sản & Kiểm kê</h1>
            <p className="header-subtitle">Thiết bị y tế, kiểm kê, khấu hao</p>
          </div>
        </div>
      </div>

      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <table className="session-table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Tên tài sản</th>
                <th>Vị trí</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {mock.map(a => (
                <tr key={a.code}>
                  <td><span className="badge bg-secondary">{a.code}</span></td>
                  <td>{a.name}</td>
                  <td>{a.location}</td>
                  <td><span className={`badge ${a.status === 'Bảo trì' ? 'bg-warning text-dark' : 'bg-success'}`}>{a.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Assets;


