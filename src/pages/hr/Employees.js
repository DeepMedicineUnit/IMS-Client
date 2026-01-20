import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Employees = () => {
  usePageTitle('Quản lý nhân viên');
  const mock = [
    { id: 'NV001', name: 'Nguyễn Văn A', role: 'Bác sĩ nội trú', dept: 'Nội' },
    { id: 'NV002', name: 'Trần Thị B', role: 'Điều dưỡng', dept: 'Ngoại' },
    { id: 'NV003', name: 'Lê Văn C', role: 'Nhân sự', dept: 'Hành chính' }
  ];

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Quản lý nhân sự</h1>
            <p className="header-subtitle">Danh sách nhân sự, tìm kiếm và lọc nhanh</p>
          </div>
        </div>
      </div>

      <div className="session-list-controls">
        <div className="search-controls">
          <div className="search-input">
            <input type="text" placeholder="Tìm theo tên, mã NV, chức danh..." />
          </div>
          <select className="filter-select">
            <option value="">Tất cả khoa</option>
            <option value="Nội">Nội</option>
            <option value="Ngoại">Ngoại</option>
            <option value="Hành chính">Hành chính</option>
          </select>
          <button className="filter-btn btn btn-primary">Tìm kiếm</button>
        </div>
      </div>

      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <table className="session-table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Họ tên</th>
                <th>Chức danh</th>
                <th>Khoa</th>
              </tr>
            </thead>
            <tbody>
              {mock.map(row => (
                <tr key={row.id}>
                  <td><span className="badge bg-secondary">{row.id}</span></td>
                  <td>{row.name}</td>
                  <td>{row.role}</td>
                  <td><span className="badge bg-info">{row.dept}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Employees;


