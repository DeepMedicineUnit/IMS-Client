import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Procurement = () => {
  usePageTitle('Mua sắm');
  const mock = [
    { req: 'Mua mô hình xương', vendor: 'MedSim Co.', status: 'Đang duyệt' },
    { req: 'Máy ECG', vendor: 'HealthTech', status: 'Đã đặt' }
  ];

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Mua sắm</h1>
            <p className="header-subtitle">Đề xuất – duyệt – nhà cung cấp</p>
          </div>
        </div>
      </div>

      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <table className="session-table">
            <thead>
              <tr>
                <th>Đề xuất</th>
                <th>Nhà cung cấp</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {mock.map((r,i) => (
                <tr key={i}>
                  <td>{r.req}</td>
                  <td>{r.vendor}</td>
                  <td><span className={`badge ${r.status === 'Đang duyệt' ? 'bg-warning text-dark' : 'bg-success'}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Procurement;


