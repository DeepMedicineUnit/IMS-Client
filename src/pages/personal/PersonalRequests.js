import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const PersonalRequests = () => {
  usePageTitle('Yêu cầu cá nhân');
  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Yêu cầu</h1>
            <p className="header-subtitle">Quản lý các yêu cầu: nghỉ phép, đào tạo, hỗ trợ</p>
          </div>
        </div>
      </div>

      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <table className="session-table">
            <thead>
              <tr>
                <th>Loại</th>
                <th>Nội dung</th>
                <th>Ngày tạo</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Nghỉ phép</td>
                <td>Nghỉ phép năm 2025</td>
                <td>25/10/2025</td>
                <td><span className="status-badge active">Đã duyệt</span></td>
                <td><button className="btn btn-sm btn-primary">Xem</button></td>
              </tr>
              <tr>
                <td>Đào tạo</td>
                <td>Đăng ký khóa CME Tim mạch</td>
                <td>02/11/2025</td>
                <td><span className="status-badge ended">Chờ duyệt</span></td>
                <td><button className="btn btn-sm btn-warning">Theo dõi</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PersonalRequests;


