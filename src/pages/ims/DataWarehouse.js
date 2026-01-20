import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const DataWarehouse = () => {
  usePageTitle('Kho dữ liệu');
  const mock = [
    { dataset: 'Attendance_fact', rows: '2.1M', status: 'Ready' },
    { dataset: 'Students_dim', rows: '12k', status: 'Ready' }
  ];

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Kho dữ liệu</h1>
            <p className="header-subtitle">Data mart/datalake cho BI điều hành</p>
          </div>
        </div>
      </div>
      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <table className="session-table">
            <thead>
              <tr>
                <th>Dataset</th>
                <th>Số dòng</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {mock.map((d,i) => (
                <tr key={i}>
                  <td>{d.dataset}</td>
                  <td>{d.rows}</td>
                  <td><span className="badge bg-success">{d.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DataWarehouse;



