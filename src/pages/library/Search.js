import React from 'react';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Search = () => {
  usePageTitle('Tìm kiếm thư viện');
  return (
    <div className="container-fluid session-main-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Tìm kiếm thông minh</h1>
            <p className="header-subtitle">Full-text, ngữ nghĩa, hình ảnh, giọng nói</p>
          </div>
        </div>
      </div>

      <div className="session-list-controls">
        <div className="search-controls">
          <div className="search-input">
            <input type="text" placeholder="Ví dụ: suy tim ESC 2024..." />
          </div>
          <button className="filter-btn btn btn-primary">Tìm kiếm</button>
        </div>
      </div>

      <div className="session-card">
        <div className="card-header-modern">
          <div className="header-icon"><i className="fas fa-search"></i></div>
          <h6 className="mb-0">Kết quả (demo)</h6>
        </div>
        <div className="card-body-modern">
          <p className="text-muted mb-0">Kết quả tìm kiếm AI sẽ hiển thị tại đây.</p>
        </div>
      </div>
    </div>
  );
};

export default Search;


