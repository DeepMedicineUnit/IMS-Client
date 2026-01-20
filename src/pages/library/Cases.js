import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Cases = () => {
  usePageTitle('Ca bệnh');
  const mock = [
    { id: 'CASE-1001', dx: 'Viêm ruột thừa', icd: 'K35', privacy: 'Ẩn danh' },
    { id: 'CASE-2033', dx: 'Suy tim', icd: 'I50', privacy: 'Ẩn danh' }
  ];

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Ngân hàng bệnh án</h1>
            <p className="header-subtitle">Ẩn danh tự động, gắn ICD-11, tìm theo triệu chứng</p>
          </div>
        </div>
      </div>

      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <table className="session-table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Chẩn đoán</th>
                <th>ICD</th>
                <th>Bảo mật</th>
              </tr>
            </thead>
            <tbody>
              {mock.map(c => (
                <tr key={c.id}>
                  <td><span className="badge bg-secondary">{c.id}</span></td>
                  <td>{c.dx}</td>
                  <td>{c.icd}</td>
                  <td><span className="badge bg-success">{c.privacy}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Cases;


