import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Transport = () => {
  usePageTitle('Quản lý vận chuyển');
  const mock = [
    { route: 'Cơ sở A → BV Đà Nẵng', time: '06:30', seats: 40 },
    { route: 'KTX → BV Sản Nhi', time: '07:00', seats: 30 }
  ];

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Ký túc xá & Xe tuyến</h1>
            <p className="header-subtitle">Quản lý chỗ ở, lịch xe lâm sàng</p>
          </div>
        </div>
      </div>

      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <table className="session-table">
            <thead>
              <tr>
                <th>Tuyến</th>
                <th>Giờ</th>
                <th>Số chỗ</th>
              </tr>
            </thead>
            <tbody>
              {mock.map((t,i) => (
                <tr key={i}>
                  <td>{t.route}</td>
                  <td>{t.time}</td>
                  <td><span className="badge bg-info">{t.seats}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Transport;


