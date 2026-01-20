import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const DataRepo = () => {
  usePageTitle('Kho dữ liệu nghiên cứu');
  const mock = [
    { id: 'DATA-001', type: 'DICOM', size: '50GB' },
    { id: 'DATA-014', type: 'CSV', size: '5GB' }
  ];

  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Kho dữ liệu nghiên cứu</h1>
            <p className="header-subtitle">DICOM/3D, OCR, ẩn danh, Open Access</p>
          </div>
        </div>
      </div>
      <div className="session-table-container">
        <div className="table-responsive-mobile">
          <table className="session-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Loại</th>
                <th>Kích thước</th>
              </tr>
            </thead>
            <tbody>
              {mock.map(d => (
                <tr key={d.id}>
                  <td><span className="badge bg-secondary">{d.id}</span></td>
                  <td>{d.type}</td>
                  <td>{d.size}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DataRepo;


