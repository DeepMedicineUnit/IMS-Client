import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const TrainingCME = () => {
  usePageTitle('Đào tạo & CME');
  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Đào tạo & CME</h1>
            <p className="header-subtitle">Kế hoạch đào tạo, điểm CME, chứng nhận số</p>
          </div>
        </div>
      </div>

      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <table className="session-table">
            <thead>
              <tr>
                <th>Khóa học</th>
                <th>Đơn vị</th>
                <th>Điểm CME</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>OSCE - Kỹ năng lâm sàng</td>
                <td>Khoa Kỹ năng</td>
                <td>10</td>
                <td><span className="badge bg-success">Hoàn thành</span></td>
              </tr>
              <tr>
                <td>ATBV Người bệnh</td>
                <td>QMTT</td>
                <td>5</td>
                <td><span className="badge bg-warning text-dark">Đang học</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TrainingCME;


