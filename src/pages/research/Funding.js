import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Funding = () => {
  usePageTitle('Tài trợ nghiên cứu');
  const mock = [
    { grant: 'NAFOSTED 2025', amount: '1.0B', status: 'Nộp hồ sơ' },
    { grant: 'KC-4.0/19-30', amount: '2.0B', status: 'Đang xét' }
  ];

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Quỹ & Tài trợ</h1>
            <p className="header-subtitle">Theo dõi nộp đơn, phân bổ quỹ, báo cáo tài chính</p>
          </div>
        </div>
      </div>
      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <table className="session-table">
            <thead>
              <tr>
                <th>Chương trình</th>
                <th>Ngân sách</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {mock.map((g,i) => (
                <tr key={i}>
                  <td>{g.grant}</td>
                  <td>{g.amount}</td>
                  <td><span className={`badge ${g.status === 'Nộp hồ sơ' ? 'bg-info' : 'bg-warning text-dark'}`}>{g.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Funding;


