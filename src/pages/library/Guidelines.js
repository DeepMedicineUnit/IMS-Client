import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Guidelines = () => {
  usePageTitle('Hướng dẫn');
  const mock = [
    { id: 'GL-ESC-2024', title: 'ESC 2024: Suy tim', status: 'Mới' },
    { id: 'GL-AHA-2023', title: 'AHA 2023: Tăng huyết áp', status: 'Cập nhật' }
  ];

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Guideline & SOP</h1>
            <p className="header-subtitle">Nguồn WHO, ESC, AHA, Bộ Y tế; cảnh báo cập nhật</p>
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
              {mock.map(g => (
                <tr key={g.id}>
                  <td><span className="badge bg-secondary">{g.id}</span></td>
                  <td>{g.title}</td>
                  <td><span className={`badge ${g.status === 'Mới' ? 'bg-success' : 'bg-info'}`}>{g.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Guidelines;


