import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const DMS = () => {
  usePageTitle('Quản lý tài liệu số');
  const mock = [
    { doc: 'Quyết định 123/QD', signer: 'Hiệu trưởng', status: 'Đã ký số' },
    { doc: 'Quy trình mua sắm 2025', signer: 'Phòng TC-KT', status: 'Chờ duyệt' }
  ];

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>E-Office/DMS</h1>
            <p className="header-subtitle">Văn bản, ký số, quy trình nội bộ</p>
          </div>
        </div>
      </div>

      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <table className="session-table">
            <thead>
              <tr>
                <th>Văn bản</th>
                <th>Người ký</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {mock.map((d,i) => (
                <tr key={i}>
                  <td>{d.doc}</td>
                  <td>{d.signer}</td>
                  <td><span className={`badge ${d.status === 'Chờ duyệt' ? 'bg-warning text-dark' : 'bg-success'}`}>{d.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DMS;


