import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';

const ResourcesDemo = () => {
  usePageTitle('Tài nguyên thư viện');
  const mock = [
    { id: 'DOC-001', title: 'Hướng dẫn xử trí sốc phản vệ', type: 'PDF' },
    { id: 'VID-014', title: 'Video kỹ thuật đặt nội khí quản', type: 'Video' },
  ];

  return (
    <div className="container py-3">
      <h5 className="mb-3">Tài nguyên số</h5>
      <div className="row">
        {mock.map(item => (
          <div className="col-md-6 mb-3" key={item.id}>
            <div className="card h-100">
              <div className="card-body">
                <div className="d-flex align-items-center mb-2">
                  <i className={`me-2 ${item.type === 'PDF' ? 'fas fa-file-pdf text-danger' : 'fas fa-video text-primary'}`}></i>
                  <h6 className="mb-0">{item.title}</h6>
                </div>
                <small className="text-muted">ID: {item.id} • Loại: {item.type}</small>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ResourcesDemo;


