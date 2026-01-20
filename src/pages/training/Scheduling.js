import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Scheduling = () => {
  usePageTitle('Lập lịch đào tạo');
  const mock = [
    { room: 'Lab Sim-01', time: '08:00-10:00', trainer: 'BS. A', status: 'OK' },
    { room: 'Lab ECG', time: '10:00-12:00', trainer: 'BS. B', status: 'Xung đột' }
  ];

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Lập lịch & phân bổ</h1>
            <p className="header-subtitle">AI Scheduling, IoT cảm biến phòng lab</p>
          </div>
        </div>
      </div>

      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <table className="session-table">
            <thead>
              <tr>
                <th>Phòng</th>
                <th>Thời gian</th>
                <th>Giảng viên</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {mock.map((r, i) => (
                <tr key={i}>
                  <td>{r.room}</td>
                  <td>{r.time}</td>
                  <td>{r.trainer}</td>
                  <td><span className={`badge ${r.status === 'OK' ? 'bg-success' : 'bg-warning text-dark'}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Scheduling;


