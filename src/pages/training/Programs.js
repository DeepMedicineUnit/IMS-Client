import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Programs = () => {
  usePageTitle('Chương trình đào tạo');
  const mock = [
    { code: 'TRN101', name: 'Định hướng nhân viên mới', duration: '2 tuần' },
    { code: 'CPD205', name: 'Cập nhật CME về Nội khoa', duration: '1 tuần' },
  ];

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Chương trình đào tạo</h1>
            <p className="header-subtitle">CBME, SCORM/xAPI, version control</p>
          </div>
        </div>
      </div>
      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <table className="session-table">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Tên chương trình</th>
                  <th>Thời lượng</th>
                </tr>
              </thead>
              <tbody>
                {mock.map(item => (
                  <tr key={item.code}>
                    <td>{item.code}</td>
                    <td>{item.name}</td>
                    <td>{item.duration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
  );
};

export default Programs;


