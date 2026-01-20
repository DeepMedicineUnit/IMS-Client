import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Facilities = () => {
  usePageTitle('Quản lý cơ sở vật chất');
  const mock = [
    { room: 'Phòng học A1', schedule: '08:00-10:00', status: 'Sẵn sàng' },
    { room: 'Lab Sim-01', schedule: '10:00-12:00', status: 'Bảo trì' }
  ];

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>CSVC & Lịch phòng</h1>
            <p className="header-subtitle">Đặt lịch phòng học/lab, bảo trì</p>
          </div>
        </div>
      </div>

      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <table className="session-table">
            <thead>
              <tr>
                <th>Phòng</th>
                <th>Lịch</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {mock.map((r, i) => (
                <tr key={i}>
                  <td>{r.room}</td>
                  <td>{r.schedule}</td>
                  <td><span className={`badge ${r.status === 'Bảo trì' ? 'bg-warning text-dark' : 'bg-success'}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Facilities;


