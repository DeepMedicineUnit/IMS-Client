import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const CMETracking = () => {
  usePageTitle('Theo dõi CME');
  const mock = [
    { user: 'BS. Nguyễn Văn A', points: 22, due: 'Còn 8 điểm', status: 'Đạt tiến độ' },
    { user: 'CN. Trần Thị B', points: 10, due: 'Còn 20 điểm', status: 'Cảnh báo' }
  ];

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Theo dõi CME/CPD</h1>
            <p className="header-subtitle">Tự động tính điểm, cảnh báo 30-60-90 ngày</p>
          </div>
        </div>
      </div>

      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <table className="session-table">
            <thead>
              <tr>
                <th>Học viên</th>
                <th>Điểm hiện tại</th>
                <th>Còn thiếu</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {mock.map((r,i) => (
                <tr key={i}>
                  <td>{r.user}</td>
                  <td><span className="badge bg-info">{r.points}</span></td>
                  <td>{r.due}</td>
                  <td><span className={`badge ${r.status === 'Đạt tiến độ' ? 'bg-success' : 'bg-warning text-dark'}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CMETracking;


