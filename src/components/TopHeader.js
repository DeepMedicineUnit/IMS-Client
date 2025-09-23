import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Bell, Moon, Sun, User, Settings, LogOut, ChevronDown, CreditCard, FileText, Shield } from 'lucide-react';
import './TopHeader.css';

const TopHeader = () => {
  const { currentUser, isLoggedIn, logout } = useAuth();
  const navigate = useNavigate();
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [notifications, setNotifications] = useState(0); // Mock notification count
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [invoiceCount, setInvoiceCount] = useState(5); // Mock invoice count

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleProfileDropdown = () => {
    setShowProfileDropdown(!showProfileDropdown);
  };

  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    
    // Apply dark mode to document
    if (newDarkMode) {
      document.documentElement.classList.add('dark-mode');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark-mode');
      localStorage.setItem('darkMode', 'false');
    }
  };

  // Initialize dark mode from localStorage
  useEffect(() => {
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode === 'true') {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark-mode');
    } else {
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark-mode');
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showProfileDropdown && !event.target.closest('.profile-dropdown')) {
        setShowProfileDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileDropdown]);

  // Don't render if user is not logged in
  if (!isLoggedIn) {
    return null;
  }

  return (
    <header className="top-header">
      <div className="header-left">
        {/* Logo or title can go here */}
      </div>
      
      <div className="header-right">
        {/* Language Selector */}
        <div className="header-item">
          <button className="header-icon-btn" title="Language">
            <img 
              src="https://flagcdn.com/w40/vn.png" 
              alt="Vietnam Flag" 
              className="flag-icon"
              onError={(e) => {
                // Fallback to SVG if API fails
                e.target.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjRkY0NDQ0Ii8+CjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjMiIGZpbGw9IiNGRkZGRkYiLz4KPHN0YXIgaWQ9InN0YXIiIGN4PSIxMiIgY3k9IjEyIiByPSIyLjUiIGZpbGw9IiNGRkZGRkYiLz4KPC9zdmc+Cg==";
              }}
            />
          </button>
        </div>

        {/* Dark Mode Toggle */}
        <div className="header-item">
          <button 
            className="header-icon-btn" 
            onClick={toggleDarkMode}
            title={isDarkMode ? "Light Mode" : "Dark Mode"}
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>

        {/* Notifications */}
        <div className="header-item">
          <button className="header-icon-btn notification-btn" title="Notifications">
            <Bell size={20} />
            {notifications > 0 && (
              <span className="notification-badge">{notifications}</span>
            )}
          </button>
        </div>

        {/* Profile Dropdown */}
        <div className="header-item profile-dropdown">
          <button 
            className="profile-btn" 
            onClick={toggleProfileDropdown}
            title="Profile"
          >
            <div className="profile-avatar">
              {currentUser?.profile_picture ? (
                <img 
                  src={currentUser.profile_picture} 
                  alt="Profile" 
                  className="avatar-img"
                />
              ) : (
                <User size={20} />
              )}
            </div>
            <span className="profile-name">
              {currentUser?.full_name || currentUser?.username || 'User'}
            </span>
            <ChevronDown size={16} className={`chevron ${showProfileDropdown ? 'rotated' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {showProfileDropdown && (
            <div className="profile-dropdown-menu">
              <div className="dropdown-header">
                <div className="user-info">
                  <div className="user-avatar">
                    {currentUser?.profile_picture ? (
                      <img 
                        src={currentUser.profile_picture} 
                        alt="Profile" 
                        className="avatar-img"
                      />
                    ) : (
                      <div className="avatar-placeholder">
                        <User size={32} />
                      </div>
                    )}
                  </div>
                  <div className="user-details">
                    <div className="user-name">
                      {currentUser?.full_name || currentUser?.username || 'User'}
                    </div>
                    <div className="user-email">
                      {currentUser?.email || 'user@example.com'}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="dropdown-divider"></div>
              
              <div className="dropdown-items">
                <Link to="/profile" className="dropdown-item">
                  <User size={16} />
                  <span>Hồ sơ cá nhân</span>
                </Link>
                <div className="dropdown-divider"></div>
                <button className="dropdown-item logout-item" onClick={handleLogout}>
                  <LogOut size={16} />
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default TopHeader;
