import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Recruitment = () => {
  usePageTitle('Tuyển dụng');
  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Tuyển dụng</h1>
            <p className="header-subtitle">Kế hoạch tuyển dụng, sàng lọc, phỏng vấn và onboarding</p>
          </div>
        </div>
      </div>

      <div className="session-list-controls">
        <div className="search-controls">
          <div className="search-input">
            <input type="text" placeholder="Tìm vị trí, ứng viên..." />
          </div>
          <select className="filter-select">
            <option value="">Tất cả trạng thái</option>
            <option value="open">Đang tuyển</option>
            <option value="closed">Đã đóng</option>
          </select>
          <button className="filter-btn btn btn-primary">Tìm kiếm</button>
        </div>
      </div>

      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <table className="session-table">
            <thead>
              <tr>
                <th>Vị trí</th>
                <th>Khoa</th>
                <th>Ứng viên</th>
                <th>Trạng thái</th>
                <th>Ngày đóng</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Bác sĩ Hồi sức</td>
                <td>ICU</td>
                <td>12</td>
                <td><span className="badge bg-primary">Đang tuyển</span></td>
                <td>31/12/2025</td>
              </tr>
              <tr>
                <td>Chuyên viên HR</td>
                <td>Hành chính</td>
                <td>5</td>
                <td><span className="badge bg-secondary">Đã đóng</span></td>
                <td>15/10/2025</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Recruitment;


