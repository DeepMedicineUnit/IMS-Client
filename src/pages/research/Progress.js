import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Progress = () => {
  usePageTitle('Tiến độ nghiên cứu');
  const mock = [
    { project: 'AI suy tim', milestone: 'M2: Thu thập dữ liệu', status: 'Đúng tiến độ' },
    { project: 'COPD', milestone: 'M1: Đề cương', status: 'Trễ 7 ngày' }
  ];

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Tiến độ & Milestone</h1>
            <p className="header-subtitle">Theo dõi timeline, cảnh báo trễ, PDCA</p>
          </div>
        </div>
      </div>
      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <table className="session-table">
            <thead>
              <tr>
                <th>Đề tài</th>
                <th>Milestone</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {mock.map((r,i) => (
                <tr key={i}>
                  <td>{r.project}</td>
                  <td>{r.milestone}</td>
                  <td><span className={`badge ${r.status.includes('Trễ') ? 'bg-warning text-dark' : 'bg-success'}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Progress;


