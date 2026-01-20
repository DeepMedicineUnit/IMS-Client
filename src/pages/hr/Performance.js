import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Performance = () => {
  usePageTitle('Đánh giá hiệu suất');
  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Đánh giá hiệu suất</h1>
            <p className="header-subtitle">KPI y khoa, phản hồi 360°, kế hoạch phát triển cá nhân</p>
          </div>
        </div>
      </div>

      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <table className="session-table">
            <thead>
              <tr>
                <th>Mã NV</th>
                <th>Họ và tên</th>
                <th>KPI Quý</th>
                <th>Điểm 360°</th>
                <th>Xếp loại</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>HR001</td>
                <td>BS. Nguyễn Văn A</td>
                <td>92</td>
                <td>4.6/5</td>
                <td><span className="badge bg-success">A</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Performance;


