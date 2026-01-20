import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const ClinicLab = () => {
  usePageTitle('Quản lý phòng khám & Lab');
  const mock = [
    { test: 'ECG mô phỏng', lab: 'Lab ECG', stock: 'Điện cực 120' },
    { test: 'DOPS – khâu da', lab: 'Lab Kỹ năng', stock: 'Chỉ khâu 50' }
  ];

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Clinic/Lab Management</h1>
            <p className="header-subtitle">Labo, xét nghiệm mô phỏng, tồn kho</p>
          </div>
        </div>
      </div>

      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <table className="session-table">
            <thead>
              <tr>
                <th>Dịch vụ/mô phỏng</th>
                <th>Phòng Lab</th>
                <th>Tồn kho</th>
              </tr>
            </thead>
            <tbody>
              {mock.map((r,i) => (
                <tr key={i}>
                  <td>{r.test}</td>
                  <td>{r.lab}</td>
                  <td>{r.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ClinicLab;


