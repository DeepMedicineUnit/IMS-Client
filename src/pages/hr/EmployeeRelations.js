import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const EmployeeRelations = () => {
  usePageTitle('Quan hệ nhân viên');
  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Quan hệ nhân viên & Văn hóa</h1>
            <p className="header-subtitle">Khảo sát NPS, khiếu nại, sự kiện nội bộ</p>
          </div>
        </div>
      </div>

      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <table className="session-table">
            <thead>
              <tr>
                <th>Mã vụ việc</th>
                <th>Loại</th>
                <th>Người liên quan</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>CASE-2025-001</td>
                <td>Khiếu nại</td>
                <td>CN. Trần Thị B</td>
                <td><span className="badge bg-warning text-dark">Đang xử lý</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default EmployeeRelations;


