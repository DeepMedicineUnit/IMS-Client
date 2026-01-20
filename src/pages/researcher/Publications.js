import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Publications = () => {
  usePageTitle('Công bố khoa học');
  const mock = [
    { doi: '10.1000/abc123', journal: 'Lancet', status: 'Đã xuất bản' },
    { doi: '10.1000/xyz789', journal: 'JAMA', status: 'Đang review' }
  ];

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Công bố & Tác động</h1>
            <p className="header-subtitle">Scopus/PubMed, Turnitin, Altmetrics</p>
          </div>
        </div>
      </div>
      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <table className="session-table">
            <thead>
              <tr>
                <th>DOI</th>
                <th>Tạp chí</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {mock.map((p,i) => (
                <tr key={i}>
                  <td><code>{p.doi}</code></td>
                  <td>{p.journal}</td>
                  <td><span className={`badge ${p.status === 'Đã xuất bản' ? 'bg-success' : 'bg-warning text-dark'}`}>{p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Publications;


