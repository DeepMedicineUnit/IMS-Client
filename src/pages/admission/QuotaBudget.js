import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const QuotaBudget = () => {
  usePageTitle('Chỉ tiêu & Ngân sách');
  const mock = [
    { major: 'Y khoa', quota: 1000, filled: 820 },
    { major: 'Điều dưỡng', quota: 400, filled: 350 }
  ];

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Chỉ tiêu & Ngân sách</h1>
            <p className="header-subtitle">Phân bổ chỉ tiêu, theo dõi chi phí tuyển sinh</p>
          </div>
        </div>
      </div>
      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <table className="session-table">
            <thead>
              <tr>
                <th>Ngành</th>
                <th>Chỉ tiêu</th>
                <th>Đã đạt</th>
              </tr>
            </thead>
            <tbody>
              {mock.map((r,i) => (
                <tr key={i}>
                  <td>{r.major}</td>
                  <td>{r.quota}</td>
                  <td><span className="badge bg-info">{r.filled}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default QuotaBudget;


