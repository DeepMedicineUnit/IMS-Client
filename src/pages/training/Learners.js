import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Learners = () => {
  usePageTitle('Quản lý người học');
  const mock = [
    { id: 'HR001', name: 'BS. Nguyễn Văn A', group: 'Nội', status: 'Đủ điều kiện' },
    { id: 'HR057', name: 'CN. Trần Thị B', group: 'Ngoại', status: 'Thiếu tiên quyết' }
  ];

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Đăng ký & Quản lý học viên</h1>
            <p className="header-subtitle">Tự động kiểm tra điều kiện, phân nhóm thông minh</p>
          </div>
        </div>
      </div>

      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <table className="session-table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Họ và tên</th>
                <th>Nhóm</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {mock.map((u) => (
                <tr key={u.id}>
                  <td><span className="badge bg-secondary">{u.id}</span></td>
                  <td>{u.name}</td>
                  <td><span className="badge bg-info">{u.group}</span></td>
                  <td><span className={`badge ${u.status === 'Đủ điều kiện' ? 'bg-success' : 'bg-warning text-dark'}`}>{u.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Learners;


