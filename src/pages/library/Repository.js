import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Repository = () => {
  usePageTitle('Kho tài liệu');
  const mock = [
    { id: 'DOC-001', title: 'ESC 2024 Heart Failure', type: 'PDF', tags: 'MeSH:Heart Failure' },
    { id: 'VID-210', title: 'Phẫu thuật nội soi ruột thừa 4K', type: 'MP4', tags: 'MeSH:Appendectomy' }
  ];

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Kho tài liệu số</h1>
            <p className="header-subtitle">Dublin Core + MeSH, phiên bản hóa, đa định dạng</p>
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
                <th>Loại</th>
                <th>Tag</th>
              </tr>
            </thead>
            <tbody>
              {mock.map(r => (
                <tr key={r.id}>
                  <td><span className="badge bg-secondary">{r.id}</span></td>
                  <td>{r.title}</td>
                  <td>{r.type}</td>
                  <td>{r.tags}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Repository;


