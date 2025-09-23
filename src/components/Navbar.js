import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './NavbarStyles.css';

const Navbar = () => {
  const { currentUser, isLoggedIn, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [expanded, setExpanded] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleDropdown = (id) => {
    setActiveDropdown(activeDropdown === id ? null : id);
  };

  const closeMobileMenu = () => {
    setShowMobileMenu(false);
  };

  // Close mobile menu when route changes
  useEffect(() => {
    closeMobileMenu();
  }, [location.pathname]);

  const isActive = (path) => {
    return location.pathname.startsWith(path);
  };

  // Render navigation links based on user role
  const renderNavLinks = () => {
    if (!isLoggedIn) {
      return null; // Login/Register links will be in user controls for vertical navbar
    }

    switch (currentUser?.role) {
      case 'superadmin':
        return (
          <>
            <Link to="/superadmin/dashboard" className={`nav-icon-link ${isActive('/superadmin/dashboard') ? 'active' : ''}`}>
              <i className="fas fa-tachometer-alt"></i>
              <span className="nav-text">Dashboard</span>
            </Link>

            <Link to="/superadmin/users" className={`nav-icon-link ${isActive('/superadmin/users') ? 'active' : ''}`}>
              <i className="fas fa-users-cog"></i>
              <span className="nav-text">Quản lý người dùng</span>
            </Link>

            <Link to="/admin/sessions" className={`nav-icon-link ${isActive('/admin/sessions') ? 'active' : ''}`}>
              <i className="fas fa-calendar-alt"></i>
              <span className="nav-text">Quản lý buổi học</span>
            </Link>
            <Link to="/admin/absence-requests" className={`nav-icon-link ${isActive('/admin/absence-requests') ? 'active' : ''}`}>
              <i className="fas fa-calendar-alt"></i>
              <span className="nav-text">Yêu cầu vắng học</span>
            </Link>
            <Link to="/admin/network-wired" className={`nav-icon-link ${isActive('/admin/network-wired') ? 'active' : ''}`}>
            <i className="fas fa-network-wired"></i>
              <span className="nav-text">Quản lý thiết bị</span>
            </Link>
            <Link to="/admin/attendance-reports" className={`nav-icon-link ${isActive('/admin/attendance-reports') ? 'active' : ''}`}>
              <i className="fas fa-chart-bar"></i>
              <span className="nav-text">Báo cáo điểm danh</span>
            </Link>
          </>
        );

      case 'admin':
        return (
          <>
            <Link to="/admin/dashboard" className={`nav-icon-link ${isActive('/admin/dashboard') ? 'active' : ''}`}>
              <i className="fas fa-tachometer-alt"></i>
              <span className="nav-text">Dashboard</span>
            </Link>

            <Link to="/superadmin/users" className={`nav-icon-link ${isActive('/superadmin/users') ? 'active' : ''}`}>
              <i className="fas fa-users-cog"></i>
              <span className="nav-text">Quản lý người dùng</span>
            </Link>

            <Link to="/admin/sessions" className={`nav-icon-link ${isActive('/admin/sessions') ? 'active' : ''}`}>
              <i className="fas fa-calendar-alt"></i>
              <span className="nav-text">Quản lý buổi học</span>
            </Link>
            <Link to="/admin/absence-requests" className={`nav-icon-link ${isActive('/admin/absence-requests') ? 'active' : ''}`}>
              <i className="fas fa-calendar-alt"></i>
              <span className="nav-text">Yêu cầu vắng học</span>
            </Link>
            <Link to="/admin/network-wired" className={`nav-icon-link ${isActive('/admin/network-wired') ? 'active' : ''}`}>
            <i className="fas fa-network-wired"></i>
              <span className="nav-text">Quản lý thiết bị</span>
            </Link>
            <Link to="/admin/attendance-reports" className={`nav-icon-link ${isActive('/admin/attendance-reports') ? 'active' : ''}`}>
              <i className="fas fa-chart-bar"></i>
              <span className="nav-text">Báo cáo điểm danh</span>
            </Link>
          </>
        );

      case 'staff':
        return (
          <>
            {/* Staff chỉ thấy menu Quản lý buổi học */}
            <Link to="/admin/sessions" className={`nav-icon-link ${isActive('/admin/sessions') ? 'active' : ''}`}>
              <i className="fas fa-calendar-alt"></i>
              <span className="nav-text">Quản lý buổi học</span>
            </Link>
            <Link to="/admin/absence-requests" className={`nav-icon-link ${isActive('/admin/absence-requests') ? 'active' : ''}`}>
              <i className="fas fa-calendar-alt"></i>
              <span className="nav-text">Yêu cầu vắng học</span>
            </Link>
            <Link to="/admin/attendance-reports" className={`nav-icon-link ${isActive('/admin/attendance-reports') ? 'active' : ''}`}>
              <i className="fas fa-chart-bar"></i>
              <span className="nav-text">Báo cáo điểm danh</span>
            </Link>
          </>
        );

      case 'student':
        return (
          <>
            <Link to="/student/dashboard" className={`nav-icon-link ${isActive('/student/dashboard') ? 'active' : ''}`}>
              <i className="fas fa-tachometer-alt"></i>
              <span className="nav-text">Dashboard</span>
            </Link>
          </>
        );

      default:
        return null;
    }
  };

  // Render user controls (profile, logout, etc.)
  const renderUserControls = () => {
    if (!isLoggedIn) {
      return (
        <>
          <Link to="/login" className="nav-icon-link">
            <i className="fas fa-sign-in-alt"></i>
            <span className="nav-text">Đăng nhập</span>
          </Link>
          <Link to="/register" className="nav-icon-link">
            <i className="fas fa-user-plus"></i>
            <span className="nav-text">Đăng ký</span>
          </Link>
        </>
      );
    }

    return (
      <div className="nav-dropdown">
        <div 
          className={`nav-icon-link ${activeDropdown === 'user' ? 'active' : ''}`} 
          onClick={() => toggleDropdown('user')}
        >
          <i className="fas fa-user-circle"></i>
          <span className="nav-text">{currentUser.full_name || currentUser.username}</span>
        </div>
        <div className={`dropdown-menu ${activeDropdown === 'user' ? 'show' : ''}`}>
          <Link to="/profile" className="dropdown-item">
            <i className="fas fa-user-circle me-2"></i>Hồ sơ cá nhân
          </Link>
          <div className="dropdown-divider"></div>
          <div className="dropdown-item" onClick={handleLogout}>
            <i className="fas fa-sign-out-alt me-2"></i>Đăng xuất
          </div>
        </div>
      </div>
    );
  };

  // Render mobile bottom navigation
  const renderMobileNavigation = () => {
    if (!isLoggedIn) return null;

    return (
      <div className="mobile-bottom-navbar">
        {/* Chỉ hiển thị Dashboard cho các vai trò khác staff */}
        {currentUser?.role !== 'staff' && (
          <Link to={`/${currentUser?.role}/dashboard`} className="mobile-nav-item">
            <i className="fas fa-home"></i>
          </Link>
        )}
        
        {/* Chỉ hiển thị nút Sessions cho các vai trò phù hợp */}
        {(currentUser?.role === 'admin' || currentUser?.role === 'superadmin' || currentUser?.role === 'staff') && (
          <Link to="/admin/sessions" className="mobile-nav-item">
            <i className="fas fa-calendar-alt"></i>
          </Link>
        )}
        
        <Link to="/profile" className="mobile-nav-item">
          <i className="fas fa-user"></i>
        </Link>
      </div>
    );
  };

  return (
    <>
      {/* Mobile Menu Toggle Button */}
      <button 
        className="mobile-toggle d-lg-none" 
        onClick={() => setShowMobileMenu(!showMobileMenu)}
      >
        <i className={`fas ${showMobileMenu ? 'fa-times' : 'fa-bars'}`}></i>
      </button>

      {/* Vertical Navbar */}
      <div className={`vertical-navbar ${showMobileMenu ? 'show' : ''} ${expanded ? 'expanded' : ''}`}>
        {/* Logo and Brand */}
        <Link to="/" className="navbar-brand">
          <img src="/logo192.png" alt="Logo" className="logo-small" />
          <img src="/logo512.png" alt="PCTU Clinical" className="logo-large" />
          <span className="brand-text">PCTU Clinical</span>
        </Link>

        {/* Navigation Links */}
        <div className="nav-menu">
          {renderNavLinks()}
        </div>

        {/* User Controls */}
        <div className="user-controls">
          {renderUserControls()}
        </div>
      </div>

      {/* Main Content Container is now in App.js */}

      {/* Mobile Bottom Navigation */}
      {renderMobileNavigation()}
    </>
  );
};

export default Navbar;