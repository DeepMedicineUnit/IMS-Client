import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Videos = () => {
  usePageTitle('Thư viện Video');
  const mock = [
    { id: 'VID-001', title: 'OSCE: Rửa tay phẫu thuật', quality: '4K' },
    { id: 'VID-032', title: 'Phẫu thuật nội soi ruột thừa', quality: '4K/360°' }
  ];

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Video học liệu</h1>
            <p className="header-subtitle">Sub tự động, annotation, adaptive bitrate</p>
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
                <th>Chất lượng</th>
              </tr>
            </thead>
            <tbody>
              {mock.map(v => (
                <tr key={v.id}>
                  <td><span className="badge bg-secondary">{v.id}</span></td>
                  <td>{v.title}</td>
                  <td>{v.quality}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Videos;


