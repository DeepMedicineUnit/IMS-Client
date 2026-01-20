import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Leads = () => {
  usePageTitle('Quản lý Leads');
  const mock = [
    { name: 'Nguyễn A', source: 'Facebook', status: 'Hot' },
    { name: 'Trần B', source: 'Hội thảo', status: 'Warm' }
  ];

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Lead Generation & CRM</h1>
            <p className="header-subtitle">Chiến dịch, phân loại lead, follow-up tự động</p>
          </div>
        </div>
      </div>
      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <table className="session-table">
            <thead>
              <tr>
                <th>Họ tên</th>
                <th>Nguồn</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {mock.map((l,i) => (
                <tr key={i}>
                  <td>{l.name}</td>
                  <td>{l.source}</td>
                  <td><span className={`badge ${l.status === 'Hot' ? 'bg-danger' : 'bg-warning text-dark'}`}>{l.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Leads;


