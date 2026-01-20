import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Collaboration = () => {
  usePageTitle('Hợp tác nghiên cứu');
  const mock = [
    { partner: 'NAFOSTED - Hàn Quốc', type: 'Quốc tế', status: 'Đang triển khai' },
    { partner: 'ORCID Integration', type: 'Hệ thống', status: 'Sẵn sàng' }
  ];

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Hợp tác & Mạng lưới</h1>
            <p className="header-subtitle">Kết nối đối tác, chia sẻ dữ liệu an toàn</p>
          </div>
        </div>
      </div>
      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <table className="session-table">
            <thead>
              <tr>
                <th>Đối tác</th>
                <th>Loại</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {mock.map((r,i) => (
                <tr key={i}>
                  <td>{r.partner}</td>
                  <td>{r.type}</td>
                  <td><span className={`badge ${r.status === 'Đang triển khai' ? 'bg-warning text-dark' : 'bg-success'}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Collaboration;


