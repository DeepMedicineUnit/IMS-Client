import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Research = () => {
  usePageTitle('Nghiên cứu');
  const mock = [
    { id: 'THS-2025-001', title: 'Ảnh hưởng beta-blocker ở suy tim', status: 'Đang duyệt' },
    { id: 'BAI-2024-112', title: 'OSCE và hiệu quả kỹ năng', status: 'Công khai' }
  ];

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Luận văn & Nghiên cứu</h1>
            <p className="header-subtitle">Zotero/EndNote, plagiarism check, DOI nội bộ</p>
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
              {mock.map(r => (
                <tr key={r.id}>
                  <td><span className="badge bg-secondary">{r.id}</span></td>
                  <td>{r.title}</td>
                  <td><span className={`badge ${r.status === 'Công khai' ? 'bg-success' : 'bg-warning text-dark'}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Research;


