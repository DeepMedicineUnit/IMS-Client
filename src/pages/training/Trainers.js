import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Trainers = () => {
  usePageTitle('Quản lý giảng viên');
  const mock = [
    { name: 'BS. Nguyễn Văn A', dept: 'Nội', rating: '4.7/5' },
    { name: 'ThS. Trần Thị B', dept: 'Kỹ năng', rating: '4.5/5' }
  ];

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Quản lý giảng viên & chuyên gia</h1>
            <p className="header-subtitle">Hồ sơ, năng lực giảng dạy, gợi ý phân công</p>
          </div>
        </div>
      </div>

      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <table className="session-table">
            <thead>
              <tr>
                <th>Họ và tên</th>
                <th>Khoa</th>
                <th>Đánh giá</th>
              </tr>
            </thead>
            <tbody>
              {mock.map((t, i) => (
                <tr key={i}>
                  <td>{t.name}</td>
                  <td><span className="badge bg-info">{t.dept}</span></td>
                  <td><span className="badge bg-success">{t.rating}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Trainers;


