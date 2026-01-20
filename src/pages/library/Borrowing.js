import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Borrowing = () => {
  usePageTitle('Mượn trả');
  const mock = [
    { id: 'BK-0001', title: 'Harrison Nội khoa', due: '10/11/2025', status: 'Đang mượn' }
  ];

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Mượn – Trả tài liệu vật lý</h1>
            <p className="header-subtitle">RFID tracking, tự động gia hạn, phạt trễ hạn</p>
          </div>
        </div>
      </div>

      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <table className="session-table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Tiêu đề</th>
                <th>Hạn trả</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {mock.map(b => (
                <tr key={b.id}>
                  <td><span className="badge bg-secondary">{b.id}</span></td>
                  <td>{b.title}</td>
                  <td>{b.due}</td>
                  <td><span className="badge bg-info">{b.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Borrowing;


