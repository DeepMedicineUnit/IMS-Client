import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const VR = () => {
  usePageTitle('Thư viện VR');
  const mock = [
    { id: 'VR-HEART', name: 'Tim 3D', mode: 'VR' },
    { id: 'VR-BRAIN', name: 'Não 3D', mode: 'VR' }
  ];

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Thư viện 3D & VR</h1>
            <p className="header-subtitle">Mô hình 3D, thực tế ảo, tích hợp Training</p>
          </div>
        </div>
      </div>

      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <table className="session-table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Tên mô hình</th>
                <th>Chế độ</th>
              </tr>
            </thead>
            <tbody>
              {mock.map(m => (
                <tr key={m.id}>
                  <td><span className="badge bg-secondary">{m.id}</span></td>
                  <td>{m.name}</td>
                  <td>{m.mode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default VR;


