import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Results = () => {
  usePageTitle('Kết quả tuyển sinh');
  const mock = [
    { appId: 'APP-001', name: 'Nguyễn A', status: 'Trúng tuyển' },
    { appId: 'APP-045', name: 'Trần B', status: 'Dự bị' }
  ];

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Công bố kết quả</h1>
            <p className="header-subtitle">Cập nhật Cổng Bộ, theo dõi xác nhận</p>
          </div>
        </div>
      </div>
      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <table className="session-table">
            <thead>
              <tr>
                <th>Mã hồ sơ</th>
                <th>Thí sinh</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {mock.map((r,i) => (
                <tr key={i}>
                  <td><span className="badge bg-secondary">{r.appId}</span></td>
                  <td>{r.name}</td>
                  <td><span className={`badge ${r.status === 'Trúng tuyển' ? 'bg-success' : 'bg-warning text-dark'}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Results;


