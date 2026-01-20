import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Evaluation = () => {
  usePageTitle('Đánh giá hồ sơ');
  const mock = [
    { appId: 'APP-001', score: 26.5, status: 'Đề xuất trúng tuyển' },
    { appId: 'APP-045', score: 22.0, status: 'Chờ bổ sung' }
  ];

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Xét tuyển</h1>
            <p className="header-subtitle">AI scoring, xét thẳng, dashboard hội đồng</p>
          </div>
        </div>
      </div>
      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <table className="session-table">
            <thead>
              <tr>
                <th>Mã hồ sơ</th>
                <th>Điểm</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {mock.map((e,i) => (
                <tr key={i}>
                  <td><span className="badge bg-secondary">{e.appId}</span></td>
                  <td><span className="badge bg-info">{e.score}</span></td>
                  <td><span className={`badge ${e.status.includes('trúng') ? 'bg-success' : 'bg-warning text-dark'}`}>{e.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Evaluation;


