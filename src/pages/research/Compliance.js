import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Compliance = () => {
  usePageTitle('Tuân thủ nghiên cứu');
  const mock = [
    { doc: 'IRB-2025-001', status: 'Đã phê duyệt' },
    { doc: 'IRB-2025-014', status: 'Chờ bổ sung' }
  ];

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Tuân thủ & Đạo đức (IRB)</h1>
            <p className="header-subtitle">Workflow phê duyệt, checklist, audit trail</p>
          </div>
        </div>
      </div>
      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <table className="session-table">
            <thead>
              <tr>
                <th>Mã hồ sơ</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {mock.map((r,i) => (
                <tr key={i}>
                  <td><span className="badge bg-secondary">{r.doc}</span></td>
                  <td><span className={`badge ${r.status === 'Đã phê duyệt' ? 'bg-success' : 'bg-warning text-dark'}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Compliance;


