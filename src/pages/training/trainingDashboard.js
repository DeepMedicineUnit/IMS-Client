import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';

const TrainingDashboard = () => {
  usePageTitle('Bảng điều khiển Đào tạo');
  return (
    <div className="container py-3">
      <h4 className="mb-3">PCTU IMS - Training Dashboard</h4>
      <p className="text-muted mb-0">Quản lý đào tạo nội bộ, kế hoạch, đánh giá năng lực...</p>
    </div>
  );
};

export default TrainingDashboard;


