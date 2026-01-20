import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Alumni = () => {
  usePageTitle('Cựu sinh viên');
  const mock = [
    { name: 'BS. Lê Văn D', company: 'BV Chợ Rẫy', status: 'Đã nhận' },
    { name: 'CN. Phạm Thị E', company: 'BV Đà Nẵng', status: 'Phỏng vấn' }
  ];

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Alumni & Placement</h1>
            <p className="header-subtitle">Kết nối cựu SV, việc làm, doanh nghiệp</p>
          </div>
        </div>
      </div>

      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <table className="session-table">
            <thead>
              <tr>
                <th>Họ tên</th>
                <th>Đơn vị</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {mock.map((a,i) => (
                <tr key={i}>
                  <td>{a.name}</td>
                  <td>{a.company}</td>
                  <td><span className="badge bg-success">{a.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Alumni;


