import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Projects = () => {
  usePageTitle('Dự án nghiên cứu');
  const mock = [
    { code: 'D242508', title: 'AI chẩn đoán suy tim', status: 'Đang review' },
    { code: 'NFS-2025-01', title: 'Nghiên cứu COPD', status: 'Đã phê duyệt' }
  ];

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Đề tài nghiên cứu</h1>
            <p className="header-subtitle">Proposal → Review → Phê duyệt → Theo dõi</p>
          </div>
        </div>
      </div>
      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <table className="session-table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Tiêu đề</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {mock.map(p => (
                <tr key={p.code}>
                  <td><span className="badge bg-secondary">{p.code}</span></td>
                  <td>{p.title}</td>
                  <td><span className={`badge ${p.status === 'Đang review' ? 'bg-warning text-dark' : 'bg-success'}`}>{p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Projects;


