import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Certification = () => {
  usePageTitle('Chứng chỉ');
  const mock = [
    { user: 'BS. Nguyễn Văn A', cert: 'CME Nội khoa 2025', status: 'Đã cấp' },
    { user: 'CN. Trần Thị B', cert: 'OSCE Kỹ năng', status: 'Chờ duyệt' }
  ];

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Quản lý điểm số & chứng nhận</h1>
            <p className="header-subtitle">Tính điểm, cấp chứng nhận blockchain, báo Bộ Y tế</p>
          </div>
        </div>
      </div>

      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <table className="session-table">
            <thead>
              <tr>
                <th>Học viên</th>
                <th>Chứng nhận</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {mock.map((r,i) => (
                <tr key={i}>
                  <td>{r.user}</td>
                  <td>{r.cert}</td>
                  <td><span className={`badge ${r.status === 'Đã cấp' ? 'bg-success' : 'bg-warning text-dark'}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Certification;


