import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Researchers = () => {
  usePageTitle('Nghiên cứu viên');
  const mock = [
    { name: 'TS. Nguyễn Văn A', orcid: '0000-0002-1234-5678', hindex: 12 },
    { name: 'BS. Trần Thị B', orcid: '0000-0003-1111-2222', hindex: 8 }
  ];

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Nhân sự nghiên cứu</h1>
            <p className="header-subtitle">Profile, PDP, Talent Pool, Effort</p>
          </div>
        </div>
      </div>
      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <table className="session-table">
            <thead>
              <tr>
                <th>Họ tên</th>
                <th>ORCID</th>
                <th>h-index</th>
              </tr>
            </thead>
            <tbody>
              {mock.map((r,i) => (
                <tr key={i}>
                  <td>{r.name}</td>
                  <td><code>{r.orcid}</code></td>
                  <td><span className="badge bg-info">{r.hindex}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Researchers;


