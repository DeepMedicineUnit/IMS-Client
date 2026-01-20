import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Assessment = () => {
  usePageTitle('Đánh giá');
  const mock = [
    { type: 'OSCE', stations: 6, reliability: '0.91' },
    { type: 'Mini-CEX', stations: 3, reliability: '0.85' }
  ];

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Đánh giá năng lực</h1>
            <p className="header-subtitle">OSCE, Mini-CEX/DOPS, AI video analysis</p>
          </div>
        </div>
      </div>

      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <table className="session-table">
            <thead>
              <tr>
                <th>Loại</th>
                <th>Số trạm</th>
                <th>Độ tin cậy</th>
              </tr>
            </thead>
            <tbody>
              {mock.map((r,i) => (
                <tr key={i}>
                  <td>{r.type}</td>
                  <td>{r.stations}</td>
                  <td><span className="badge bg-success">{r.reliability}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Assessment;


