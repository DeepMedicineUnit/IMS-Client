import React, { useState, useEffect, useRef } from 'react';
import IconAnimation, { IconAnimation2 } from './icon_animation';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './NavbarStyles.css';

const Navbar = () => {
  const { currentUser, isLoggedIn, logout, refreshUser, api } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [expanded, setExpanded] = useState(false);
  // IMS module switcher state: 'personal' | 'clinical' | 'ims' | 'mhr' | 'lms' | 'training' | 'library' | 'admission' | 'research'
  const [activeModule, setActiveModule] = useState(() => {
    const savedModule = localStorage.getItem('imsModule');
    // Migrate old 'medadmit' to 'admission'
    if (savedModule === 'medadmit') {
      localStorage.setItem('imsModule', 'admission');
      return 'admission';
    }
    return savedModule || 'clinical';
  });
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [isRailCollapsed, setIsRailCollapsed] = useState(() => {
    const saved = localStorage.getItem('imsRailCollapsed');
    return saved === 'true';
  });
  const [hasApprovedExams, setHasApprovedExams] = useState(false);
  const navbarRef = useRef(null);
  const mobileToggleRef = useRef(null);

  // Helper function to get effective clinical role based on module_roles (prioritized over role)
  const getEffectiveClinicalRole = () => {
    if (!currentUser) {
      return null;
    }

    const moduleRoles = currentUser.module_roles || [];

    if (moduleRoles.includes('clinical_admin')) {
      return 'clinical_admin';
    }
    if (moduleRoles.includes('clinical_mod')) {
      return 'clinical_mod';
    }
    if (moduleRoles.includes('clinical_staff')) {
      return 'clinical_staff';
    }

    // Fallback to role for backward compatibility
    if (currentUser.role === 'superadmin') {
      return 'clinical_admin';
    }
    if (currentUser.role === 'admin') {
      return 'clinical_mod';
    }
    if (currentUser.role === 'staff') {
      return 'clinical_staff';
    }

    return null;
  };

  // Helper function to check if user has access to a module
  const hasModuleAccess = (moduleKey) => {
    if (!currentUser) return false;

    // Hide everything for students at rail-level (handled outside), but
    // allow logic here to still work for other consumers
    if (moduleKey === 'personal') {
      // Personal is visible for all non-student roles
      return currentUser.role !== 'student';
    }

    // Students have access to LMS by default (for learning purposes)
    if (moduleKey === 'lms' && currentUser.role === 'student') {
      return true;
    }

    // Superadmin has access to all modules
    if (currentUser.role === 'superadmin') return true;

    // Check module_roles array
    const moduleRoles = currentUser.module_roles || [];
    if (!Array.isArray(moduleRoles)) return false;

    // Check if user has any role for this module (admin, mod, or staff)
    return moduleRoles.some(role => {
      const rolePrefix = `${moduleKey}_`;
      return role.startsWith(rolePrefix);
    });
  };

  // Helper function to check if user has access to LMS Questions (only lms_admin, lms_qa, lms_mod, lms_staff)
  const hasLMSQuestionsAccess = () => {
    if (!currentUser) return false;

    const moduleRoles = currentUser.module_roles || [];
    if (!Array.isArray(moduleRoles)) return false;

    // Cho phép lms_qa, lms_mod, lms_staff (KHÔNG cho phép lms_admin)
    return moduleRoles.includes('lms_qa') || moduleRoles.includes('lms_mod') || moduleRoles.includes('lms_staff');
  };

  // Helper function to check if user has access to LMS Reports (only lms_qa)
  const hasLMSQAAccess = () => {
    if (!currentUser) return false;

    const moduleRoles = currentUser.module_roles || [];
    if (!Array.isArray(moduleRoles)) return false;

    // Chỉ cho phép lms_qa
    return moduleRoles.includes('lms_qa');
  };

  // Get all accessible modules
  const getAccessibleModules = () => {
    if (!currentUser) return [];

    const modules = ['personal', 'clinical', 'ims', 'hr', 'lms', 'training', 'library', 'admission', 'research'];

    // Superadmin has access to all modules
    if (currentUser.role === 'superadmin') return modules;

    // Filter modules based on module_roles
    const moduleRoles = currentUser.module_roles || [];
    if (!Array.isArray(moduleRoles)) return [];

    return modules.filter(module => {
      return moduleRoles.some(role => role.startsWith(`${module}_`));
    });
  };

  const handleLogout = async () => {
    await logout();
    // Small delay to ensure state is cleared before navigation
    setTimeout(() => {
      navigate('/login', { replace: true });
    }, 100);
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

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Only handle on mobile (screen width <= 992px)
      if (window.innerWidth > 992) return;

      // If menu is not open, do nothing
      if (!showMobileMenu) return;

      // Check if click is outside navbar and toggle button
      if (
        navbarRef.current &&
        !navbarRef.current.contains(event.target) &&
        mobileToggleRef.current &&
        !mobileToggleRef.current.contains(event.target)
      ) {
        closeMobileMenu();
      }
    };

    // Add event listener when menu is open
    if (showMobileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      // Prevent body scroll when menu is open
      document.body.style.overflow = 'hidden';
    }

    // Cleanup
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.body.style.overflow = '';
    };
  }, [showMobileMenu]);

  // Sync activeModule with current route
  useEffect(() => {
    if (!currentUser || !isLoggedIn) return;

    const path = location.pathname;

    // Determine module based on route
    let newModule = null;

    // Check IMS-specific routes first
    // But preserve clinical module if user is already in clinical module
    if (path.startsWith('/ims/')) {
      // If currently in clinical module, keep it (for Dashboard in attendance module)
      if (activeModule === 'clinical') {
        newModule = 'clinical';
      } else {
        newModule = 'ims';
      }
    } else if (path.startsWith('/personal/')) {
      // Always switch to personal module when on /personal/ routes
      newModule = 'personal';
    } else if (path === '/profile') {
      // /profile route - preserve current module or default to personal
      // This allows menu to work correctly regardless of which module user came from
      if (activeModule) {
        newModule = activeModule; // Keep current module
      } else {
        // If no active module, default to personal if user has access
        newModule = hasModuleAccess('personal') ? 'personal' :
          (hasModuleAccess('clinical') ? 'clinical' :
            (hasModuleAccess('ims') ? 'ims' : null));
      }
    } else if (path.startsWith('/hr/')) {
      newModule = 'hr';
    } else if (path.startsWith('/lms/')) {
      newModule = 'lms';
    } else if (path.startsWith('/training/')) {
      newModule = 'training';
    } else if (path.startsWith('/library/')) {
      newModule = 'library';
    } else if (path.startsWith('/admission/')) {
      newModule = 'admission';
    } else if (path.startsWith('/research/')) {
      newModule = 'research';
      console.log('[useEffect Route Sync] /research/ route detected, newModule: research');
    } else if (path.startsWith('/superadmin/users') || path.startsWith('/superadmin/systempage')) {
      // For /superadmin/users and /superadmin/system, preserve current module if it's clinical
      // Otherwise, set to ims (for backward compatibility when coming from ims module)
      if (activeModule === 'clinical') {
        newModule = 'clinical'; // Keep clinical module when clicking from attendance menu
      } else {
        newModule = 'ims'; // Default to ims for other cases
      }
    } else if (path.startsWith('/superadmin/') || path.startsWith('/admin/') || path.startsWith('/student/') || path.startsWith('/session/')) {
      // Clinical/attendance routes (other superadmin routes not covered above)
      newModule = 'clinical';
    }

    // For students, always use clinical module
    if (currentUser.role === 'student') {
      newModule = 'clinical';
    }

    // If module detected and different from current, update it
    // For /profile route, ensure module is set if not already set
    if (path === '/profile' && newModule && newModule !== activeModule) {
      // For /profile route, set module if not already set
      const hasAccess = hasModuleAccess(newModule);
      if (hasAccess) {
        setActiveModule(newModule);
        localStorage.setItem('imsModule', newModule);
      }
    } else if (newModule && newModule !== activeModule && path !== '/profile') {
      // Check if user has access to this module
      const hasAccess = hasModuleAccess(newModule);
      if (hasAccess) {
        setActiveModule(newModule);
        localStorage.setItem('imsModule', newModule);
      }
    } else if (!newModule && currentUser.role !== 'student' && path !== '/profile') {
      // Default module based on role when route doesn't match any module
      const effectiveClinicalRole = getEffectiveClinicalRole();
      const hasClinicalAccess = effectiveClinicalRole !== null;

      console.log('[Module Switch] No newModule detected. Current activeModule:', activeModule);
      console.log('[Module Switch] Effective clinical role:', effectiveClinicalRole, 'Has clinical access:', hasClinicalAccess);
      console.log('[Module Switch] User role:', currentUser.role);

      // Check if user has clinical_admin (equivalent to superadmin for clinical module)
      if (effectiveClinicalRole === 'clinical_admin' || currentUser.role === 'superadmin') {
        console.log('[Module Switch] User has clinical_admin or superadmin');
        // clinical_admin or superadmin defaults to IMS module when on root or unknown routes
        // But if they have clinical access, prefer clinical module
        if (hasClinicalAccess && activeModule !== 'clinical') {
          console.log('[Module Switch] Setting module to clinical (has clinical access)');
          setActiveModule('clinical');
          localStorage.setItem('imsModule', 'clinical');
        } else if (activeModule !== 'ims' && hasModuleAccess('ims')) {
          console.log('[Module Switch] Setting module to ims');
          setActiveModule('ims');
          localStorage.setItem('imsModule', 'ims');
        }
      } else if (hasClinicalAccess) {
        console.log('[Module Switch] User has clinical access but not clinical_admin');
        // Users with clinical roles should stay in clinical module or default to it
        if (activeModule !== 'clinical') {
          console.log('[Module Switch] Setting module to clinical (user has clinical access)');
          setActiveModule('clinical');
          localStorage.setItem('imsModule', 'clinical');
        } else {
          console.log('[Module Switch] Already in clinical module, keeping it');
        }
        // Don't change to personal if user has clinical access
      } else if (activeModule !== 'personal' && hasModuleAccess('personal')) {
        console.log('[Module Switch] No clinical access, setting to personal');
        // Other roles default to personal module when on root or unknown routes
        setActiveModule('personal');
        localStorage.setItem('imsModule', 'personal');
      } else {
        console.log('[Module Switch] No action taken - activeModule:', activeModule, 'hasPersonalAccess:', hasModuleAccess('personal'));
      }
    }
  }, [location.pathname, currentUser, isLoggedIn, activeModule]);

  // Ensure students always use 'clinical' (attendance) module and set activeModule accordingly
  useEffect(() => {
    if (currentUser?.role === 'student') {
      // Students always use 'clinical' (attendance) module view
      if (activeModule !== 'clinical') {
        setActiveModule('clinical');
      }
    }
  }, [currentUser?.role, activeModule]);

  // Check if student has approved exams
  useEffect(() => {
    const checkApprovedExams = async () => {
      if (currentUser?.role === 'student' && isLoggedIn) {
        try {
          const response = await api.get('/lms/exams/student');
          if (response.data?.success && response.data?.data) {
            const exams = Array.isArray(response.data.data)
              ? response.data.data
              : (response.data.data.exams || []);
            // Check if there's at least one approved exam
            const hasApproved = exams.some(exam =>
              (exam.is_approved === 1 || exam.is_approved === true)
            );
            setHasApprovedExams(hasApproved);
          } else {
            setHasApprovedExams(false);
          }
        } catch (error) {
          console.error('Error checking approved exams:', error);
          setHasApprovedExams(false);
        }
      } else {
        setHasApprovedExams(false);
      }
    };

    checkApprovedExams();
    // Refresh every 30 seconds to check for new approved exams
    const interval = setInterval(checkApprovedExams, 30000);
    return () => clearInterval(interval);
  }, [currentUser?.role, isLoggedIn, api]);

  // Toggle body class to adjust layout when IMS rail is hidden (students or collapsed)
  useEffect(() => {
    const isStudent = currentUser?.role === 'student';
    const cls = 'no-ims-rail';
    const shouldHide = isStudent || isRailCollapsed;
    if (shouldHide) {
      document.body.classList.add(cls);
    } else {
      document.body.classList.remove(cls);
    }
    return () => {
      document.body.classList.remove(cls);
    };
  }, [currentUser?.role, isRailCollapsed]);

  // Background polling to check for user data updates (smart polling - only when tab is visible)
  // Only polls when user is logged in and tab is visible
  // Automatically updates Navbar when user data changes (module_roles, role, etc.)
  useEffect(() => {
    if (!isLoggedIn || !currentUser) return;

    let pollInterval = null;
    let isPollingActive = true;

    const checkForUpdates = async () => {
      // Only poll when tab is visible
      if (document.hidden || !isPollingActive) return;

      try {
        // Use refreshUser which already has smart comparison logic
        // It will only update state if there are actual changes
        await refreshUser();
        // No need to handle return value - refreshUser handles updates silently
      } catch (error) {
        // Silently fail - don't interrupt user experience
        // Only log in development
        if (process.env.NODE_ENV === 'development') {
          console.debug('Background user update check failed:', error);
        }
      }
    };

    // Initial check after a short delay (2 seconds)
    const initialTimeout = setTimeout(checkForUpdates, 2000);

    // Set up polling interval (check every 5 seconds)
    pollInterval = setInterval(checkForUpdates, 5000);

    // Handle tab visibility changes
    const handleVisibilityChange = () => {
      if (!document.hidden && isPollingActive) {
        // Tab became visible, check immediately for updates
        checkForUpdates();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isPollingActive = false;
      clearTimeout(initialTimeout);
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLoggedIn, currentUser?.id, refreshUser]);

  const collapseRail = () => {
    setIsRailCollapsed(true);
    localStorage.setItem('imsRailCollapsed', 'true');
  };

  const expandRail = () => {
    setIsRailCollapsed(false);
    localStorage.setItem('imsRailCollapsed', 'false');
  };

  const isActive = (path) => {
    return location.pathname.startsWith(path);
  };

  const switchModule = (moduleKey) => {
    console.log('[switchModule] Called with moduleKey:', moduleKey);
    console.log('[switchModule] Current activeModule:', activeModule);
    console.log('[switchModule] Current user:', currentUser?.role, 'Module roles:', currentUser?.module_roles);

    // Students don't use module switching - they only see their attendance/student view
    if (currentUser?.role === 'student') {
      console.log('[switchModule] User is student, returning early');
      return;
    }

    setActiveModule(moduleKey);
    localStorage.setItem('imsModule', moduleKey);
    console.log('[switchModule] Set activeModule to:', moduleKey);

    // Navigate to a sensible landing route when module switches
    if (moduleKey === 'personal') {
      console.log('[switchModule] Navigating to personal dashboard');
      navigate('/personal/dashboard');
    } else if (moduleKey === 'clinical') {
      // Navigate to clinical/attendance routes based on effective clinical role
      const effectiveClinicalRole = getEffectiveClinicalRole();
      console.log('[switchModule] Switching to clinical, effective role:', effectiveClinicalRole);

      if (effectiveClinicalRole === 'clinical_admin') {
        console.log('[switchModule] Navigating to /superadmin/dashboard');
        navigate('/superadmin/dashboard');
      } else if (effectiveClinicalRole === 'clinical_mod') {
        console.log('[switchModule] Navigating to /admin/dashboard');
        navigate('/admin/dashboard');
      } else if (effectiveClinicalRole === 'clinical_staff') {
        console.log('[switchModule] Navigating to /staff/dashboard');
        navigate('/staff/dashboard');
      } else {
        console.log('[switchModule] No effective clinical role, navigating to /admin/sessions');
        // Fallback for other roles
        navigate('/admin/sessions');
      }
    } else if (moduleKey === 'ims') {
      navigate('/ims/dashboard');
    } else if (moduleKey === 'hr') {
      navigate('/hr/dashboard');
    } else if (moduleKey === 'lms') {
      navigate('/lms/dashboard');
    } else if (moduleKey === 'training') {
      navigate('/training/dashboard');
    } else if (moduleKey === 'library') {
      navigate('/library/dashboard');
    } else if (moduleKey === 'admission') {
      navigate('/admission/dashboard');
    } else if (moduleKey === 'research') {
      navigate('/research/dashboard');
    }
  };

  // Personal: render navigation links
  const renderPersonalLinks = () => {
    if (!isLoggedIn) return null;
    return (
      <>
        <Link to="/personal/dashboard" className={`nav-icon-link ${isActive('/personal/dashboard') ? 'active' : ''}`}>
          <i className="fas fa-tachometer-alt"></i>
          <span className="nav-text">Dashboard</span>
        </Link>
        <Link to="/personal/tasks" className={`nav-icon-link ${isActive('/personal/tasks') ? 'active' : ''}`}>
          <i className="fas fa-tasks"></i>
          <span className="nav-text">Tác vụ của tôi</span>
        </Link>
        <Link to="/personal/notifications" className={`nav-icon-link ${isActive('/personal/notifications') ? 'active' : ''}`}>
          <i className="fas fa-bell"></i>
          <span className="nav-text">Thông báo</span>
        </Link>
        <Link to="/personal/attendance" className={`nav-icon-link ${isActive('/personal/attendance') ? 'active' : ''}`}>
          <i className="fas fa-clock"></i>
          <span className="nav-text">Chấm công</span>
        </Link>
        <Link to="/personal/documents" className={`nav-icon-link ${isActive('/personal/documents') ? 'active' : ''}`}>
          <i className="fas fa-file-alt"></i>
          <span className="nav-text">Giấy tờ</span>
        </Link>
        <Link to="/personal/requests" className={`nav-icon-link ${isActive('/personal/requests') ? 'active' : ''}`}>
          <i className="fas fa-clipboard-list"></i>
          <span className="nav-text">Yêu cầu</span>
        </Link>
        <Link to="/personal/profile" className={`nav-icon-link ${isActive('/personal/profile') ? 'active' : ''}`}>
          <i className="fas fa-user-circle"></i>
          <span className="nav-text">Hồ sơ nhân sự</span>
        </Link>
        <Link to="/personal/tickets" className={`nav-icon-link ${isActive('/personal/tickets') ? 'active' : ''}`}>
          <i className="fas fa-ticket-alt"></i>
          <span className="nav-text">Ticket</span>
        </Link>
      </>
    );
  };

  // Clinical/Attendance: render navigation links based on user role
  const renderClinicalLinks = () => {
    if (!isLoggedIn) {
      return null; // Login/Register links will be in user controls for vertical navbar
    }

    // Get effective clinical role (prioritizes module_roles over role)
    const effectiveClinicalRole = getEffectiveClinicalRole();

    // Check if user has clinical_admin role (or superadmin as fallback)
    if (effectiveClinicalRole === 'clinical_admin') {
      return (
        <>
          <Link to="/superadmin/dashboard" className={`nav-icon-link ${isActive('/superadmin/dashboard') ? 'active' : ''}`}>
            <i className="fas fa-tachometer-alt"></i>
            <span className="nav-text">Dashboard</span>
          </Link>

          {/* Đã chuyển 'Quản lý người dùng' sang module IMS */}

          <Link to="/admin/sessions" className={`nav-icon-link ${isActive('/admin/sessions') ? 'active' : ''}`}>
            <i className="fas fa-calendar-alt"></i>
            <span className="nav-text">Quản lý buổi học</span>
          </Link>
          <Link to="/superadmin/users" className={`nav-icon-link ${isActive('/superadmin/users') ? 'active' : ''}`}>
            <i className="fas fa-users-cog"></i>
            <span className="nav-text">Quản lý người dùng</span>
          </Link>
          <Link to="/admin/absence-requests" className={`nav-icon-link ${isActive('/admin/absence-requests') ? 'active' : ''}`}>
            <i className="fas fa-calendar-times"></i>
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

          {/* Đã chuyển 'Hệ thống' sang module IMS */}
        </>
      );
    }

    // Check if user has clinical_mod role (or admin as fallback)
    if (effectiveClinicalRole === 'clinical_mod') {
      return (
        <>
          <Link to="/admin/dashboard" className={`nav-icon-link ${isActive('/admin/dashboard') ? 'active' : ''}`}>
            <i className="fas fa-tachometer-alt"></i>
            <span className="nav-text">Dashboard</span>
          </Link>

          {/* Đã chuyển 'Quản lý người dùng' sang module IMS */}

          <Link to="/admin/sessions" className={`nav-icon-link ${isActive('/admin/sessions') ? 'active' : ''}`}>
            <i className="fas fa-calendar-alt"></i>
            <span className="nav-text">Quản lý buổi học</span>
          </Link>
          <Link to="/superadmin/users" className={`nav-icon-link ${isActive('/superadmin/users') ? 'active' : ''}`}>
            <i className="fas fa-users-cog"></i>
            <span className="nav-text">Quản lý người dùng</span>
          </Link>
          <Link to="/admin/absence-requests" className={`nav-icon-link ${isActive('/admin/absence-requests') ? 'active' : ''}`}>
            <i className="fas fa-calendar-times"></i>
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
    }

    // Check if user has clinical_staff role (or staff as fallback)
    if (effectiveClinicalRole === 'clinical_staff') {
      return (
        <>
          <Link to="/staff/dashboard" className={`nav-icon-link ${isActive('/staff/dashboard') ? 'active' : ''}`}>
            <i className="fas fa-tachometer-alt"></i>
            <span className="nav-text">Dashboard</span>
          </Link>
          {/* Staff chỉ thấy menu Quản lý buổi học - yêu cầu vắng học - báo cáo điểm danh */}
          <Link to="/admin/sessions" className={`nav-icon-link ${isActive('/admin/sessions') ? 'active' : ''}`}>
            <i className="fas fa-calendar-alt"></i>
            <span className="nav-text">Quản lý buổi học</span>
          </Link>
          <Link to="/admin/absence-requests" className={`nav-icon-link ${isActive('/admin/absence-requests') ? 'active' : ''}`}>
            <i className="fas fa-calendar-times"></i>
            <span className="nav-text">Yêu cầu vắng học</span>
          </Link>
          <Link to="/admin/attendance-reports" className={`nav-icon-link ${isActive('/admin/attendance-reports') ? 'active' : ''}`}>
            <i className="fas fa-chart-bar"></i>
            <span className="nav-text">Báo cáo điểm danh</span>
          </Link>
        </>
      );
    }

    // Fallback to old role-based check for backward compatibility
    switch (currentUser?.role) {

      case 'student':
        return (
          <>
            <Link to="/student/attendance" className={`nav-icon-link ${isActive('/student/attendance') ? 'active' : ''}`}>
              <i className="fas fa-clipboard-check"></i>
              <span className="nav-text">Điểm danh</span>
            </Link>
            <Link to="/student/absence-requests" className={`nav-icon-link ${isActive('/student/absence-requests') ? 'active' : ''}`}>
              <i className="fas fa-calendar-times"></i>
              <span className="nav-text">Xin phép vắng học</span>
            </Link>
            {hasApprovedExams && (
              <Link to="/student/exams" className={`nav-icon-link ${isActive('/student/exams') ? 'active' : ''}`}>
                <i className="fas fa-clipboard-check"></i>
                <span className="nav-text">Thi & Kiểm tra</span>
              </Link>
            )}
            <Link to="/student/grades" className={`nav-icon-link ${isActive('/student/grades') ? 'active' : ''}`}>
              <i className="fas fa-graduation-cap"></i>
              <span className="nav-text">Điểm số</span>
            </Link>
            <Link to="/student/courses" className={`nav-icon-link ${isActive('/student/courses') ? 'active' : ''}`}>
              <i className="fas fa-book"></i>
              <span className="nav-text">Khóa học & Nội dung</span>
            </Link>
            <Link to="/personal/tickets" className={`nav-icon-link ${isActive('/personal/tickets') ? 'active' : ''}`}>
              <i className="fas fa-ticket-alt"></i>
              <span className="nav-text">Ticket</span>
            </Link>
          </>
        );

      default:
        return null;
    }
  };

  // HR demo links
  const renderHRLinks = () => {
    if (!isLoggedIn) return null;
    return (
      <>
        <Link to="/hr/dashboard" className={`nav-icon-link ${isActive('/hr/dashboard') ? 'active' : ''}`}>
          <i className="fas fa-briefcase-medical"></i>
          <span className="nav-text">HR Dashboard</span>
        </Link>
        <Link to="/hr/profiles" className={`nav-icon-link ${isActive('/hr/profiles') ? 'active' : ''}`}>
          <i className="fas fa-user-md"></i>
          <span className="nav-text">Hồ sơ nhân sự</span>
        </Link>
        <Link to="/hr/recruitment" className={`nav-icon-link ${isActive('/hr/recruitment') ? 'active' : ''}`}>
          <i className="fas fa-user-plus"></i>
          <span className="nav-text">Tuyển dụng</span>
        </Link>
        <Link to="/hr/attendance" className={`nav-icon-link ${isActive('/hr/attendance') ? 'active' : ''}`}>
          <i className="fas fa-user-check"></i>
          <span className="nav-text">Chấm công</span>
        </Link>
        <Link to="/hr/training" className={`nav-icon-link ${isActive('/hr/training') ? 'active' : ''}`}>
          <i className="fas fa-certificate"></i>
          <span className="nav-text">Đào tạo & CME</span>
        </Link>
        <Link to="/hr/payroll" className={`nav-icon-link ${isActive('/hr/payroll') ? 'active' : ''}`}>
          <i className="fas fa-coins"></i>
          <span className="nav-text">Lương & phúc lợi</span>
        </Link>
        <Link to="/hr/performance" className={`nav-icon-link ${isActive('/hr/performance') ? 'active' : ''}`}>
          <i className="fas fa-chart-line"></i>
          <span className="nav-text">Hiệu suất</span>
        </Link>
        <Link to="/hr/documents" className={`nav-icon-link ${isActive('/hr/documents') ? 'active' : ''}`}>
          <i className="fas fa-file-signature"></i>
          <span className="nav-text">Giấy tờ</span>
        </Link>
        <Link to="/hr/analytics" className={`nav-icon-link ${isActive('/hr/analytics') ? 'active' : ''}`}>
          <i className="fas fa-chart-pie"></i>
          <span className="nav-text">Báo cáo & BI</span>
        </Link>
        <Link to="/hr/relations" className={`nav-icon-link ${isActive('/hr/relations') ? 'active' : ''}`}>
          <i className="fas fa-heart"></i>
          <span className="nav-text">Quan hệ & Văn hoá</span>
        </Link>
        <Link to="/hr/workforce" className={`nav-icon-link ${isActive('/hr/workforce') ? 'active' : ''}`}>
          <i className="fas fa-project-diagram"></i>
          <span className="nav-text">Kế hoạch nhân sự</span>
        </Link>
        <Link to="/hr/finance" className={`nav-icon-link ${isActive('/hr/finance') ? 'active' : ''}`}>
          <i className="fas fa-coins"></i>
          <span className="nav-text">Tài chính</span>
        </Link>
        <Link to="/hr/procurement" className={`nav-icon-link ${isActive('/hr/procurement') ? 'active' : ''}`}>
          <i className="fas fa-shopping-cart"></i>
          <span className="nav-text">Mua sắm</span>
        </Link>
        <Link to="/hr/assets" className={`nav-icon-link ${isActive('/hr/assets') ? 'active' : ''}`}>
          <i className="fas fa-boxes"></i>
          <span className="nav-text">Tài sản</span>
        </Link>
        <Link to="/hr/facilities" className={`nav-icon-link ${isActive('/hr/facilities') ? 'active' : ''}`}>
          <i className="fas fa-building"></i>
          <span className="nav-text">CSVC & Lịch phòng</span>
        </Link>
        <Link to="/hr/dms" className={`nav-icon-link ${isActive('/hr/dms') ? 'active' : ''}`}>
          <i className="fas fa-file-alt"></i>
          <span className="nav-text">E-Office/DMS</span>
        </Link>
        <Link to="/hr/alumni" className={`nav-icon-link ${isActive('/hr/alumni') ? 'active' : ''}`}>
          <i className="fas fa-user-friends"></i>
          <span className="nav-text">Alumni & Placement</span>
        </Link>
        <Link to="/hr/transport" className={`nav-icon-link ${isActive('/hr/transport') ? 'active' : ''}`}>
          <i className="fas fa-bus"></i>
          <span className="nav-text">KTX & Xe tuyến</span>
        </Link>
        <Link to="/hr/cliniclab" className={`nav-icon-link ${isActive('/hr/cliniclab') ? 'active' : ''}`}>
          <i className="fas fa-vials"></i>
          <span className="nav-text">Clinic/Lab</span>
        </Link>
      </>
    );
  };

  // LMS links
  const renderLMSLinks = () => {
    if (!isLoggedIn) return null;

    // Check if user has lms_qa or lms_mod role
    const moduleRoles = currentUser?.module_roles || [];
    const hasLMSUserManagementAccess = Array.isArray(moduleRoles) && (
      moduleRoles.includes('lms_qa') || moduleRoles.includes('lms_mod')
    );

    return (
      <>
        <Link to="/lms/dashboard" className={`nav-icon-link ${isActive('/lms/dashboard') ? 'active' : ''}`}>
          <i className="fas fa-graduation-cap"></i>
          <span className="nav-text">LMS Dashboard</span>
        </Link>
        {hasLMSUserManagementAccess && (
          <Link to="/lms/users" className={`nav-icon-link ${isActive('/lms/users') ? 'active' : ''}`}>
            <i className="fas fa-users-cog"></i>
            <span className="nav-text">Quản lý người dùng LMS</span>
          </Link>
        )}
        <Link to="/lms/courses" className={`nav-icon-link ${isActive('/lms/courses') ? 'active' : ''}`}>
          <i className="fas fa-book"></i>
          <span className="nav-text">Khóa học & Nội dung</span>
        </Link>
        <Link to="/lms/live" className={`nav-icon-link ${isActive('/lms/live') ? 'active' : ''}`}>
          <i className="fas fa-video"></i>
          <span className="nav-text">Lớp học trực tuyến</span>
        </Link>
        {hasLMSQuestionsAccess() && (
          <>
            <Link to="/lms/exams" className={`nav-icon-link ${isActive('/lms/exams') ? 'active' : ''}`}>
              <i className="fas fa-clipboard-check"></i>
              <span className="nav-text">Kỳ thi & Kiểm tra</span>
            </Link>
            <Link to="/lms/questions" className={`nav-icon-link ${isActive('/lms/questions') ? 'active' : ''}`}>
              <i className="fas fa-database"></i>
              <span className="nav-text">Ngân hàng câu hỏi</span>
            </Link>
            <Link to="/lms/grades" className={`nav-icon-link ${isActive('/lms/grades') ? 'active' : ''}`}>
              <i className="fas fa-list-check"></i>
              <span className="nav-text">Đánh giá & Điểm số</span>
            </Link>
          </>
        )}
        {hasLMSQAAccess() && (
          <Link to="/lms/reports" className={`nav-icon-link ${isActive('/lms/reports') ? 'active' : ''}`}>
            <i className="fas fa-chart-bar"></i>
            <span className="nav-text">Báo cáo QA</span>
          </Link>
        )}
        <Link to="/lms/integrations" className={`nav-icon-link ${isActive('/lms/integrations') ? 'active' : ''}`}>
          <i className="fas fa-plug"></i>
          <span className="nav-text">Tích hợp</span>
        </Link>
        <Link to="/lms/support" className={`nav-icon-link ${isActive('/lms/support') ? 'active' : ''}`}>
          <i className="fas fa-headset"></i>
          <span className="nav-text">Hỗ trợ & Analytics</span>
        </Link>
      </>
    );
  };

  // Training demo links
  const renderTrainingLinks = () => {
    if (!isLoggedIn) return null;
    return (
      <>
        <Link to="/training/dashboard" className={`nav-icon-link ${isActive('/training/dashboard') ? 'active' : ''}`}>
          <i className="fas fa-chalkboard-teacher"></i>
          <span className="nav-text">Training Dashboard</span>
        </Link>
        <Link to="/training/planning" className={`nav-icon-link ${isActive('/training/planning') ? 'active' : ''}`}>
          <i className="fas fa-bullseye"></i>
          <span className="nav-text">Kế hoạch chiến lược</span>
        </Link>
        <Link to="/training/programs" className={`nav-icon-link ${isActive('/training/programs') ? 'active' : ''}`}>
          <i className="fas fa-tasks"></i>
          <span className="nav-text">Chương trình đào tạo</span>
        </Link>
        <Link to="/training/scheduling" className={`nav-icon-link ${isActive('/training/scheduling') ? 'active' : ''}`}>
          <i className="fas fa-calendar-check"></i>
          <span className="nav-text">Lập lịch & tài nguyên</span>
        </Link>
        <Link to="/superadmin/users" className={`nav-icon-link ${isActive('/superadmin/users') ? 'active' : ''}`}>
          <i className="fas fa-users"></i>
          <span className="nav-text">Sinh viên</span>
        </Link>
        <Link to="/training/delivery" className={`nav-icon-link ${isActive('/training/delivery') ? 'active' : ''}`}>
          <i className="fas fa-chalkboard"></i>
          <span className="nav-text">Thực hiện đào tạo</span>
        </Link>
        <Link to="/training/assessment" className={`nav-icon-link ${isActive('/training/assessment') ? 'active' : ''}`}>
          <i className="fas fa-notes-medical"></i>
          <span className="nav-text">Đánh giá năng lực</span>
        </Link>
        <Link to="/training/certification" className={`nav-icon-link ${isActive('/training/certification') ? 'active' : ''}`}>
          <i className="fas fa-award"></i>
          <span className="nav-text">Chứng nhận</span>
        </Link>
        <Link to="/training/cme" className={`nav-icon-link ${isActive('/training/cme') ? 'active' : ''}`}>
          <i className="fas fa-graduation-cap"></i>
          <span className="nav-text">Theo dõi CME</span>
        </Link>
        <Link to="/training/reporting" className={`nav-icon-link ${isActive('/training/reporting') ? 'active' : ''}`}>
          <i className="fas fa-chart-pie"></i>
          <span className="nav-text">Báo cáo</span>
        </Link>
        <Link to="/training/trainers" className={`nav-icon-link ${isActive('/training/trainers') ? 'active' : ''}`}>
          <i className="fas fa-user-tie"></i>
          <span className="nav-text">Giảng viên</span>
        </Link>
        <Link to="/training/digitization" className={`nav-icon-link ${isActive('/training/digitization') ? 'active' : ''}`}>
          <i className="fas fa-file-signature"></i>
          <span className="nav-text">Số hóa</span>
        </Link>
        <Link to="/training/pdca" className={`nav-icon-link ${isActive('/training/pdca') ? 'active' : ''}`}>
          <i className="fas fa-sync-alt"></i>
          <span className="nav-text">PDCA</span>
        </Link>
      </>
    );
  };

  // Library demo links
  const renderLibraryLinks = () => {
    if (!isLoggedIn) return null;
    return (
      <>
        <Link to="/library/dashboard" className={`nav-icon-link ${isActive('/library/dashboard') ? 'active' : ''}`}>
          <i className="fas fa-book-medical"></i>
          <span className="nav-text">Library Dashboard</span>
        </Link>
        <Link to="/library/repository" className={`nav-icon-link ${isActive('/library/repository') ? 'active' : ''}`}>
          <i className="fas fa-folder-open"></i>
          <span className="nav-text">Kho tài liệu số</span>
        </Link>
        <Link to="/library/search" className={`nav-icon-link ${isActive('/library/search') ? 'active' : ''}`}>
          <i className="fas fa-search"></i>
          <span className="nav-text">Tìm kiếm AI</span>
        </Link>
        <Link to="/library/recommend" className={`nav-icon-link ${isActive('/library/recommend') ? 'active' : ''}`}>
          <i className="fas fa-magic"></i>
          <span className="nav-text">Gợi ý học liệu</span>
        </Link>
        <Link to="/library/videos" className={`nav-icon-link ${isActive('/library/videos') ? 'active' : ''}`}>
          <i className="fas fa-video"></i>
          <span className="nav-text">Video học liệu</span>
        </Link>
        <Link to="/library/guidelines" className={`nav-icon-link ${isActive('/library/guidelines') ? 'active' : ''}`}>
          <i className="fas fa-file-medical"></i>
          <span className="nav-text">Guideline & SOP</span>
        </Link>
        <Link to="/library/cases" className={`nav-icon-link ${isActive('/library/cases') ? 'active' : ''}`}>
          <i className="fas fa-procedures"></i>
          <span className="nav-text">Case bank</span>
        </Link>
        <Link to="/library/research" className={`nav-icon-link ${isActive('/library/research') ? 'active' : ''}`}>
          <i className="fas fa-flask"></i>
          <span className="nav-text">Luận văn & Nghiên cứu</span>
        </Link>
        <Link to="/library/vr" className={`nav-icon-link ${isActive('/library/vr') ? 'active' : ''}`}>
          <i className="fas fa-vr-cardboard"></i>
          <span className="nav-text">3D & VR</span>
        </Link>
        <Link to="/library/borrowing" className={`nav-icon-link ${isActive('/library/borrowing') ? 'active' : ''}`}>
          <i className="fas fa-book"></i>
          <span className="nav-text">Mượn – Trả</span>
        </Link>
        <Link to="/library/blockchain" className={`nav-icon-link ${isActive('/library/blockchain') ? 'active' : ''}`}>
          <i className="fas fa-link"></i>
          <span className="nav-text">Blockchain</span>
        </Link>
        <Link to="/library/analytics" className={`nav-icon-link ${isActive('/library/analytics') ? 'active' : ''}`}>
          <i className="fas fa-chart-line"></i>
          <span className="nav-text">Analytics</span>
        </Link>
        <Link to="/library/integrations" className={`nav-icon-link ${isActive('/library/integrations') ? 'active' : ''}`}>
          <i className="fas fa-plug"></i>
          <span className="nav-text">Tích hợp & API</span>
        </Link>
        <Link to="/library/drm" className={`nav-icon-link ${isActive('/library/drm') ? 'active' : ''}`}>
          <i className="fas fa-shield-alt"></i>
          <span className="nav-text">DRM & Quyền truy cập</span>
        </Link>
        <Link to="/library/support" className={`nav-icon-link ${isActive('/library/support') ? 'active' : ''}`}>
          <i className="fas fa-headset"></i>
          <span className="nav-text">Hỗ trợ</span>
        </Link>
        <Link to="/library/mobile" className={`nav-icon-link ${isActive('/library/mobile') ? 'active' : ''}`}>
          <i className="fas fa-mobile-alt"></i>
          <span className="nav-text">Mobile & Offline</span>
        </Link>
      </>
    );
  };

  // Admission links
  const renderAdmissionLinks = () => {
    if (!isLoggedIn) return null;
    return (
      <>
        <Link to="/admission/dashboard" className={`nav-icon-link ${isActive('/admission/dashboard') ? 'active' : ''}`}>
          <i className="fas fa-user-plus"></i>
          <span className="nav-text">Admission Dashboard</span>
        </Link>
        <Link to="/admission/leads" className={`nav-icon-link ${isActive('/admission/leads') ? 'active' : ''}`}>
          <i className="fas fa-bullhorn"></i>
          <span className="nav-text">Lead & CRM</span>
        </Link>
        <Link to="/admission/applications" className={`nav-icon-link ${isActive('/admission/applications') ? 'active' : ''}`}>
          <i className="fas fa-file-signature"></i>
          <span className="nav-text">Hồ sơ trực tuyến</span>
        </Link>
        <Link to="/admission/evaluation" className={`nav-icon-link ${isActive('/admission/evaluation') ? 'active' : ''}`}>
          <i className="fas fa-clipboard-check"></i>
          <span className="nav-text">Xét tuyển</span>
        </Link>
        <Link to="/admission/results" className={`nav-icon-link ${isActive('/admission/results') ? 'active' : ''}`}>
          <i className="fas fa-list"></i>
          <span className="nav-text">Kết quả</span>
        </Link>
        <Link to="/admission/onboarding" className={`nav-icon-link ${isActive('/admission/onboarding') ? 'active' : ''}`}>
          <i className="fas fa-user-graduate"></i>
          <span className="nav-text">Nhập học</span>
        </Link>
        <Link to="/admission/certifications" className={`nav-icon-link ${isActive('/admission/certifications') ? 'active' : ''}`}>
          <i className="fas fa-certificate"></i>
          <span className="nav-text">Chứng chỉ & ưu tiên</span>
        </Link>
        <Link to="/admission/reporting" className={`nav-icon-link ${isActive('/admission/reporting') ? 'active' : ''}`}>
          <i className="fas fa-chart-line"></i>
          <span className="nav-text">Báo cáo</span>
        </Link>
        <Link to="/admission/integrations" className={`nav-icon-link ${isActive('/admission/integrations') ? 'active' : ''}`}>
          <i className="fas fa-plug"></i>
          <span className="nav-text">Tích hợp</span>
        </Link>
        <Link to="/admission/support" className={`nav-icon-link ${isActive('/admission/support') ? 'active' : ''}`}>
          <i className="fas fa-headset"></i>
          <span className="nav-text">Hỗ trợ</span>
        </Link>
        <Link to="/admission/quota" className={`nav-icon-link ${isActive('/admission/quota') ? 'active' : ''}`}>
          <i className="fas fa-balance-scale"></i>
          <span className="nav-text">Chỉ tiêu & ngân sách</span>
        </Link>
      </>
    );
  };

  // Research links
  const renderResearchLinks = () => {
    if (!isLoggedIn) return null;
    return (
      <>
        <Link to="/research/dashboard" className={`nav-icon-link ${isActive('/research/dashboard') ? 'active' : ''}`}>
          <i className="fas fa-flask"></i>
          <span className="nav-text">Research Dashboard</span>
        </Link>
        <Link to="/research/projects" className={`nav-icon-link ${isActive('/research/projects') ? 'active' : ''}`}>
          <i className="fas fa-project-diagram"></i>
          <span className="nav-text">Đề tài</span>
        </Link>
        <Link to="/research/funding" className={`nav-icon-link ${isActive('/research/funding') ? 'active' : ''}`}>
          <i className="fas fa-hand-holding-usd"></i>
          <span className="nav-text">Quỹ & tài trợ</span>
        </Link>
        <Link to="/research/collaboration" className={`nav-icon-link ${isActive('/research/collaboration') ? 'active' : ''}`}>
          <i className="fas fa-network-wired"></i>
          <span className="nav-text">Hợp tác</span>
        </Link>
        <Link to="/research/progress" className={`nav-icon-link ${isActive('/research/progress') ? 'active' : ''}`}>
          <i className="fas fa-tasks"></i>
          <span className="nav-text">Tiến độ</span>
        </Link>
        <Link to="/research/data" className={`nav-icon-link ${isActive('/research/data') ? 'active' : ''}`}>
          <i className="fas fa-database"></i>
          <span className="nav-text">Dữ liệu</span>
        </Link>
        <Link to="/research/publications" className={`nav-icon-link ${isActive('/research/publications') ? 'active' : ''}`}>
          <i className="fas fa-book"></i>
          <span className="nav-text">Công bố</span>
        </Link>
        <Link to="/research/reporting" className={`nav-icon-link ${isActive('/research/reporting') ? 'active' : ''}`}>
          <i className="fas fa-chart-line"></i>
          <span className="nav-text">Báo cáo</span>
        </Link>
        <Link to="/research/compliance" className={`nav-icon-link ${isActive('/research/compliance') ? 'active' : ''}`}>
          <i className="fas fa-shield-alt"></i>
          <span className="nav-text">Tuân thủ & IRB</span>
        </Link>
        <Link to="/research/integrations" className={`nav-icon-link ${isActive('/research/integrations') ? 'active' : ''}`}>
          <i className="fas fa-plug"></i>
          <span className="nav-text">Tích hợp</span>
        </Link>
        <Link to="/research/support" className={`nav-icon-link ${isActive('/research/support') ? 'active' : ''}`}>
          <i className="fas fa-headset"></i>
          <span className="nav-text">Hỗ trợ</span>
        </Link>
        <Link to="/research/researchers" className={`nav-icon-link ${isActive('/research/researchers') ? 'active' : ''}`}>
          <i className="fas fa-user-tie"></i>
          <span className="nav-text">Nhân sự nghiên cứu</span>
        </Link>
      </>
    );
  };

  // IMS Ops links (exec dashboard, tickets, SLA, DWH, System, User Management)
  const renderIMSLinks = () => {
    if (!isLoggedIn) return null;
    return (
      <>
        <Link to="/ims/dashboard" className={`nav-icon-link ${isActive('/ims/dashboard') ? 'active' : ''}`}>
          <i className="fas fa-tachometer-alt"></i>
          <span className="nav-text">Dashboard điều hành</span>
        </Link>
        <Link to="/superadmin/users" className={`nav-icon-link ${isActive('/superadmin/users') ? 'active' : ''}`}>
          <i className="fas fa-users-cog"></i>
          <span className="nav-text">Quản lý người dùng</span>
        </Link>
        <Link to="/superadmin/systempage" className={`nav-icon-link ${isActive('/superadmin/systempage') ? 'active' : ''}`}>
          <i className="fas fa-cogs"></i>
          <span className="nav-text">Hệ thống</span>
        </Link>
        <Link to="/ims/tickets" className={`nav-icon-link ${isActive('/ims/tickets') ? 'active' : ''}`}>
          <i className="fas fa-ticket-alt"></i>
          <span className="nav-text">Ticket</span>
        </Link>
        <Link to="/ims/sla" className={`nav-icon-link ${isActive('/ims/sla') ? 'active' : ''}`}>
          <i className="fas fa-bolt"></i>
          <span className="nav-text">SLA</span>
        </Link>
        <Link to="/ims/dwh" className={`nav-icon-link ${isActive('/ims/dwh') ? 'active' : ''}`}>
          <i className="fas fa-database"></i>
          <span className="nav-text">Kho dữ liệu</span>
        </Link>
      </>
    );
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

    // Ẩn mobile bottom navbar khi đang ở trang AttendanceSession
    if (location.pathname.includes('/session/') && location.pathname.includes('/attend')) {
      return null;
    }

    // Student mobile navigation - simplified and focused
    if (currentUser?.role === 'student') {
      return (
        <div className="mobile-bottom-navbar">
          <Link to="/student/attendance" className={`mobile-nav-item ${isActive('/student/attendance') ? 'active' : ''}`}>
            <i className="fas fa-home"></i>
          </Link>
          <Link to="/student/absence-requests" className={`mobile-nav-item ${isActive('/student/absence-requests') ? 'active' : ''}`}>
            <i className="fas fa-calendar-times"></i>
          </Link>
          {hasApprovedExams && (
            <Link to="/student/exams" className={`mobile-nav-item ${isActive('/student/exams') ? 'active' : ''}`}>
              <i className="fas fa-clipboard-check"></i>
            </Link>
          )}
          <Link to="/student/grades" className={`mobile-nav-item ${isActive('/student/grades') ? 'active' : ''}`}>
            <i className="fas fa-graduation-cap"></i>
          </Link>
          <Link to="/student/courses" className={`mobile-nav-item ${isActive('/student/courses') ? 'active' : ''}`}>
            <i className="fas fa-book"></i>
          </Link>
          <Link to="/personal/tickets" className={`mobile-nav-item ${isActive('/personal/tickets') ? 'active' : ''}`}>
            <i className="fas fa-ticket-alt"></i>
          </Link>
        </div>
      );
    }

    // Non-student mobile navigation - changes based on active module
    const renderModuleBottomNav = () => {
      switch (activeModule) {
        case 'personal':
          return (
            <>
              <Link to="/personal/dashboard" className={`mobile-nav-item ${isActive('/personal/dashboard') ? 'active' : ''}`}>
                <i className="fas fa-tachometer-alt"></i>
              </Link>
              <Link to="/personal/tasks" className={`mobile-nav-item ${isActive('/personal/tasks') ? 'active' : ''}`}>
                <i className="fas fa-tasks"></i>
              </Link>
              <Link to="/personal/notifications" className={`mobile-nav-item ${isActive('/personal/notifications') ? 'active' : ''}`}>
                <i className="fas fa-bell"></i>
              </Link>
              <Link to="/personal/attendance" className={`mobile-nav-item ${isActive('/personal/attendance') ? 'active' : ''}`}>
                <i className="fas fa-clock"></i>
              </Link>
              <Link to="/personal/documents" className={`mobile-nav-item ${isActive('/personal/documents') ? 'active' : ''}`}>
                <i className="fas fa-file-alt"></i>
              </Link>
              <Link to="/profile" className={`mobile-nav-item ${isActive('/profile') ? 'active' : ''}`}>
                <i className="fas fa-user"></i>
              </Link>
              <Link to="/personal/tickets" className={`mobile-nav-item ${isActive('/personal/tickets') ? 'active' : ''}`}>
                <i className="fas fa-ticket-alt"></i>
              </Link>
            </>
          );

        case 'clinical':
          // Get effective clinical role (prioritizes module_roles over role)
          const effectiveClinicalRole = getEffectiveClinicalRole();

          if (effectiveClinicalRole === 'clinical_admin') {
            return (
              <>
                <Link to="/superadmin/dashboard" className={`mobile-nav-item ${isActive('/superadmin/dashboard') ? 'active' : ''}`}>
                  <i className="fas fa-tachometer-alt"></i>
                </Link>
                <Link to="/admin/sessions" className={`mobile-nav-item ${isActive('/admin/sessions') ? 'active' : ''}`}>
                  <i className="fas fa-calendar-alt"></i>
                </Link>
                <Link to="/superadmin/users" className={`mobile-nav-item ${isActive('/superadmin/users') ? 'active' : ''}`}>
                  <i className="fas fa-users-cog"></i>
                </Link>
                <Link to="/admin/absence-requests" className={`mobile-nav-item ${isActive('/admin/absence-requests') ? 'active' : ''}`}>
                  <i className="fas fa-calendar-times"></i>
                </Link>
                <Link to="/admin/network-wired" className={`mobile-nav-item ${isActive('/admin/network-wired') ? 'active' : ''}`}>
                  <i className="fas fa-network-wired"></i>
                </Link>
                <Link to="/admin/attendance-reports" className={`mobile-nav-item ${isActive('/admin/attendance-reports') ? 'active' : ''}`}>
                  <i className="fas fa-chart-bar"></i>
                </Link>
              </>
            );
          } else if (effectiveClinicalRole === 'clinical_mod') {
            return (
              <>
                <Link to="/admin/dashboard" className={`mobile-nav-item ${isActive('/admin/dashboard') ? 'active' : ''}`}>
                  <i className="fas fa-tachometer-alt"></i>
                </Link>
                <Link to="/admin/sessions" className={`mobile-nav-item ${isActive('/admin/sessions') ? 'active' : ''}`}>
                  <i className="fas fa-calendar-alt"></i>
                </Link>
                <Link to="/superadmin/users" className={`mobile-nav-item ${isActive('/superadmin/users') ? 'active' : ''}`}>
                  <i className="fas fa-users-cog"></i>
                </Link>
                <Link to="/admin/absence-requests" className={`mobile-nav-item ${isActive('/admin/absence-requests') ? 'active' : ''}`}>
                  <i className="fas fa-calendar-times"></i>
                </Link>
                <Link to="/admin/network-wired" className={`mobile-nav-item ${isActive('/admin/network-wired') ? 'active' : ''}`}>
                  <i className="fas fa-network-wired"></i>
                </Link>
                <Link to="/admin/attendance-reports" className={`mobile-nav-item ${isActive('/admin/attendance-reports') ? 'active' : ''}`}>
                  <i className="fas fa-chart-bar"></i>
                </Link>
              </>
            );
          } else if (effectiveClinicalRole === 'clinical_staff') {
            return (
              <>
                <Link to="/staff/dashboard" className={`mobile-nav-item ${isActive('/staff/dashboard') ? 'active' : ''}`}>
                  <i className="fas fa-tachometer-alt"></i>
                </Link>
                <Link to="/admin/sessions" className={`mobile-nav-item ${isActive('/admin/sessions') ? 'active' : ''}`}>
                  <i className="fas fa-calendar-alt"></i>
                </Link>
                <Link to="/admin/absence-requests" className={`mobile-nav-item ${isActive('/admin/absence-requests') ? 'active' : ''}`}>
                  <i className="fas fa-calendar-times"></i>
                </Link>
                <Link to="/admin/attendance-reports" className={`mobile-nav-item ${isActive('/admin/attendance-reports') ? 'active' : ''}`}>
                  <i className="fas fa-chart-bar"></i>
                </Link>
              </>
            );
          }
          break;

        case 'ims':
          return (
            <>
              <Link to="/ims/dashboard" className={`mobile-nav-item ${isActive('/ims/dashboard') ? 'active' : ''}`}>
                <i className="fas fa-tachometer-alt"></i>
              </Link>
              <Link to="/superadmin/users" className={`mobile-nav-item ${isActive('/superadmin/users') ? 'active' : ''}`}>
                <i className="fas fa-users-cog"></i>
              </Link>
              <Link to="/superadmin/systempage" className={`mobile-nav-item ${isActive('/superadmin/systempage') ? 'active' : ''}`}>
                <i className="fas fa-cogs"></i>
              </Link>
              <Link to="/ims/tickets" className={`mobile-nav-item ${isActive('/ims/tickets') ? 'active' : ''}`}>
                <i className="fas fa-ticket-alt"></i>
              </Link>
              <Link to="/ims/sla" className={`mobile-nav-item ${isActive('/ims/sla') ? 'active' : ''}`}>
                <i className="fas fa-bolt"></i>
              </Link>
              <Link to="/ims/dwh" className={`mobile-nav-item ${isActive('/ims/dwh') ? 'active' : ''}`}>
                <i className="fas fa-database"></i>
              </Link>
            </>
          );

        case 'hr':
          return (
            <>
              <Link to="/hr/dashboard" className={`mobile-nav-item ${isActive('/hr/dashboard') ? 'active' : ''}`}>
                <i className="fas fa-briefcase-medical"></i>
              </Link>
              <Link to="/hr/profiles" className={`mobile-nav-item ${isActive('/hr/profiles') ? 'active' : ''}`}>
                <i className="fas fa-user-md"></i>
              </Link>
              <Link to="/hr/recruitment" className={`mobile-nav-item ${isActive('/hr/recruitment') ? 'active' : ''}`}>
                <i className="fas fa-user-plus"></i>
              </Link>
              <Link to="/hr/attendance" className={`mobile-nav-item ${isActive('/hr/attendance') ? 'active' : ''}`}>
                <i className="fas fa-user-check"></i>
              </Link>
              <Link to="/hr/payroll" className={`mobile-nav-item ${isActive('/hr/payroll') ? 'active' : ''}`}>
                <i className="fas fa-coins"></i>
              </Link>
              <Link to="/hr/performance" className={`mobile-nav-item ${isActive('/hr/performance') ? 'active' : ''}`}>
                <i className="fas fa-chart-line"></i>
              </Link>
              <Link to="/profile" className={`mobile-nav-item ${isActive('/profile') ? 'active' : ''}`}>
                <i className="fas fa-user"></i>
              </Link>
            </>
          );

        case 'lms':
          // Check if user has lms_qa or lms_mod role
          const moduleRoles = currentUser?.module_roles || [];
          const hasLMSUserManagementAccess = Array.isArray(moduleRoles) && (
            moduleRoles.includes('lms_qa') || moduleRoles.includes('lms_mod')
          );
          return (
            <>
              <Link to="/lms/dashboard" className={`mobile-nav-item ${isActive('/lms/dashboard') ? 'active' : ''}`}>
                <i className="fas fa-graduation-cap"></i>
              </Link>
              {hasLMSUserManagementAccess && (
                <Link to="/lms/users" className={`mobile-nav-item ${isActive('/lms/users') ? 'active' : ''}`}>
                  <i className="fas fa-users-cog"></i>
                </Link>
              )}
              <Link to="/lms/courses" className={`mobile-nav-item ${isActive('/lms/courses') ? 'active' : ''}`}>
                <i className="fas fa-book"></i>
              </Link>
              <Link to="/lms/live" className={`mobile-nav-item ${isActive('/lms/live') ? 'active' : ''}`}>
                <i className="fas fa-video"></i>
              </Link>
              {hasLMSQuestionsAccess() && (
                <>
                  <Link to="/lms/exams" className={`mobile-nav-item ${isActive('/lms/exams') ? 'active' : ''}`}>
                    <i className="fas fa-clipboard-check"></i>
                  </Link>
                  <Link to="/lms/questions" className={`mobile-nav-item ${isActive('/lms/questions') ? 'active' : ''}`}>
                    <i className="fas fa-database"></i>
                  </Link>
                  <Link to="/lms/grades" className={`mobile-nav-item ${isActive('/lms/grades') ? 'active' : ''}`}>
                    <i className="fas fa-list-check"></i>
                  </Link>
                </>
              )}
              {hasLMSQAAccess() && (
                <Link to="/lms/reports" className={`mobile-nav-item ${isActive('/lms/reports') ? 'active' : ''}`}>
                  <i className="fas fa-chart-bar"></i>
                </Link>
              )}
              <Link to="/profile" className={`mobile-nav-item ${isActive('/profile') ? 'active' : ''}`}>
                <i className="fas fa-user"></i>
              </Link>
            </>
          );

        case 'training':
          return (
            <>
              <Link to="/training/dashboard" className={`mobile-nav-item ${isActive('/training/dashboard') ? 'active' : ''}`}>
                <i className="fas fa-chalkboard-teacher"></i>
              </Link>
              <Link to="/training/planning" className={`mobile-nav-item ${isActive('/training/planning') ? 'active' : ''}`}>
                <i className="fas fa-bullseye"></i>
              </Link>
              <Link to="/training/programs" className={`mobile-nav-item ${isActive('/training/programs') ? 'active' : ''}`}>
                <i className="fas fa-tasks"></i>
              </Link>
              <Link to="/training/scheduling" className={`mobile-nav-item ${isActive('/training/scheduling') ? 'active' : ''}`}>
                <i className="fas fa-calendar-check"></i>
              </Link>
              <Link to="/superadmin/users" className={`mobile-nav-item ${isActive('/superadmin/users') ? 'active' : ''}`}>
                <i className="fas fa-users"></i>
              </Link>
              <Link to="/training/assessment" className={`mobile-nav-item ${isActive('/training/assessment') ? 'active' : ''}`}>
                <i className="fas fa-notes-medical"></i>
              </Link>
              <Link to="/profile" className={`mobile-nav-item ${isActive('/profile') ? 'active' : ''}`}>
                <i className="fas fa-user"></i>
              </Link>
            </>
          );

        case 'library':
          return (
            <>
              <Link to="/library/dashboard" className={`mobile-nav-item ${isActive('/library/dashboard') ? 'active' : ''}`}>
                <i className="fas fa-book-medical"></i>
              </Link>
              <Link to="/library/repository" className={`mobile-nav-item ${isActive('/library/repository') ? 'active' : ''}`}>
                <i className="fas fa-folder-open"></i>
              </Link>
              <Link to="/library/search" className={`mobile-nav-item ${isActive('/library/search') ? 'active' : ''}`}>
                <i className="fas fa-search"></i>
              </Link>
              <Link to="/library/recommend" className={`mobile-nav-item ${isActive('/library/recommend') ? 'active' : ''}`}>
                <i className="fas fa-magic"></i>
              </Link>
              <Link to="/library/videos" className={`mobile-nav-item ${isActive('/library/videos') ? 'active' : ''}`}>
                <i className="fas fa-video"></i>
              </Link>
              <Link to="/library/borrowing" className={`mobile-nav-item ${isActive('/library/borrowing') ? 'active' : ''}`}>
                <i className="fas fa-book"></i>
              </Link>
              <Link to="/profile" className={`mobile-nav-item ${isActive('/profile') ? 'active' : ''}`}>
                <i className="fas fa-user"></i>
              </Link>
            </>
          );

        case 'admission':
          return (
            <>
              <Link to="/admission/dashboard" className={`mobile-nav-item ${isActive('/admission/dashboard') ? 'active' : ''}`}>
                <i className="fas fa-user-plus"></i>
              </Link>
              <Link to="/admission/leads" className={`mobile-nav-item ${isActive('/admission/leads') ? 'active' : ''}`}>
                <i className="fas fa-bullhorn"></i>
              </Link>
              <Link to="/admission/applications" className={`mobile-nav-item ${isActive('/admission/applications') ? 'active' : ''}`}>
                <i className="fas fa-file-signature"></i>
              </Link>
              <Link to="/admission/evaluation" className={`mobile-nav-item ${isActive('/admission/evaluation') ? 'active' : ''}`}>
                <i className="fas fa-clipboard-check"></i>
              </Link>
              <Link to="/admission/results" className={`mobile-nav-item ${isActive('/admission/results') ? 'active' : ''}`}>
                <i className="fas fa-list"></i>
              </Link>
              <Link to="/admission/onboarding" className={`mobile-nav-item ${isActive('/admission/onboarding') ? 'active' : ''}`}>
                <i className="fas fa-user-graduate"></i>
              </Link>
              <Link to="/profile" className={`mobile-nav-item ${isActive('/profile') ? 'active' : ''}`}>
                <i className="fas fa-user"></i>
              </Link>
            </>
          );

        case 'research':
          return (
            <>
              <Link to="/research/dashboard" className={`mobile-nav-item ${isActive('/research/dashboard') ? 'active' : ''}`}>
                <i className="fas fa-flask"></i>
              </Link>
              <Link to="/research/projects" className={`mobile-nav-item ${isActive('/research/projects') ? 'active' : ''}`}>
                <i className="fas fa-project-diagram"></i>
              </Link>
              <Link to="/research/funding" className={`mobile-nav-item ${isActive('/research/funding') ? 'active' : ''}`}>
                <i className="fas fa-hand-holding-usd"></i>
              </Link>
              <Link to="/research/collaboration" className={`mobile-nav-item ${isActive('/research/collaboration') ? 'active' : ''}`}>
                <i className="fas fa-network-wired"></i>
              </Link>
              <Link to="/research/progress" className={`mobile-nav-item ${isActive('/research/progress') ? 'active' : ''}`}>
                <i className="fas fa-tasks"></i>
              </Link>
              <Link to="/research/publications" className={`mobile-nav-item ${isActive('/research/publications') ? 'active' : ''}`}>
                <i className="fas fa-book"></i>
              </Link>
              <Link to="/profile" className={`mobile-nav-item ${isActive('/profile') ? 'active' : ''}`}>
                <i className="fas fa-user"></i>
              </Link>
            </>
          );

        default:
          // Fallback to clinical module navigation
          if (currentUser?.role === 'superadmin') {
            return (
              <>
                <Link to="/superadmin/dashboard" className={`mobile-nav-item ${isActive('/superadmin/dashboard') ? 'active' : ''}`}>
                  <i className="fas fa-tachometer-alt"></i>
                </Link>
                <Link to="/admin/sessions" className={`mobile-nav-item ${isActive('/admin/sessions') ? 'active' : ''}`}>
                  <i className="fas fa-calendar-alt"></i>
                </Link>
                <Link to="/admin/absence-requests" className={`mobile-nav-item ${isActive('/admin/absence-requests') ? 'active' : ''}`}>
                  <i className="fas fa-calendar-times"></i>
                </Link>
                <Link to="/admin/attendance-reports" className={`mobile-nav-item ${isActive('/admin/attendance-reports') ? 'active' : ''}`}>
                  <i className="fas fa-chart-bar"></i>
                </Link>
                <Link to="/profile" className={`mobile-nav-item ${isActive('/profile') ? 'active' : ''}`}>
                  <i className="fas fa-user"></i>
                </Link>
              </>
            );
          } else if (currentUser?.role === 'admin') {
            return (
              <>
                <Link to="/admin/dashboard" className={`mobile-nav-item ${isActive('/admin/dashboard') ? 'active' : ''}`}>
                  <i className="fas fa-tachometer-alt"></i>
                </Link>
                <Link to="/admin/sessions" className={`mobile-nav-item ${isActive('/admin/sessions') ? 'active' : ''}`}>
                  <i className="fas fa-calendar-alt"></i>
                </Link>
                <Link to="/admin/absence-requests" className={`mobile-nav-item ${isActive('/admin/absence-requests') ? 'active' : ''}`}>
                  <i className="fas fa-calendar-times"></i>
                </Link>
                <Link to="/admin/attendance-reports" className={`mobile-nav-item ${isActive('/admin/attendance-reports') ? 'active' : ''}`}>
                  <i className="fas fa-chart-bar"></i>
                </Link>
              </>
            );
          } else if (currentUser?.role === 'staff') {
            return (
              <>
                <Link to="/staff/dashboard" className={`mobile-nav-item ${isActive('/staff/dashboard') ? 'active' : ''}`}>
                  <i className="fas fa-tachometer-alt"></i>
                </Link>
                <Link to="/admin/sessions" className={`mobile-nav-item ${isActive('/admin/sessions') ? 'active' : ''}`}>
                  <i className="fas fa-calendar-alt"></i>
                </Link>
                <Link to="/admin/absence-requests" className={`mobile-nav-item ${isActive('/admin/absence-requests') ? 'active' : ''}`}>
                  <i className="fas fa-calendar-times"></i>
                </Link>
                <Link to="/admin/attendance-reports" className={`mobile-nav-item ${isActive('/admin/attendance-reports') ? 'active' : ''}`}>
                  <i className="fas fa-chart-bar"></i>
                </Link>
              </>
            );
          }
          return null;
      }
    };

    return (
      <div className="mobile-bottom-navbar">
        {renderModuleBottomNav()}
      </div>
    );
  };

  return (
    <>
      {/* Mobile Menu Overlay/Backdrop */}
      {showMobileMenu && (
        <div
          className="mobile-navbar-overlay"
          onClick={closeMobileMenu}
        />
      )}

      {/* Mobile Menu Toggle Button */}
      <button
        ref={mobileToggleRef}
        className="mobile-toggle d-lg-none"
        onClick={() => setShowMobileMenu(!showMobileMenu)}
      >
        <i className={`fas ${showMobileMenu ? 'fa-times' : 'fa-bars'}`}></i>
      </button>

      {/* IMS left rail - show for all non-student roles; hide entirely for students */}
      {isLoggedIn && currentUser?.role !== 'student' && (
        <div className={`ims-rail d-none d-lg-flex ${isRailCollapsed ? 'collapsed' : ''}`}>
          {hasModuleAccess('personal') && (
            <div className={`ims-icon ims-icon-personal ${activeModule === 'personal' ? 'active' : ''}`} onClick={() => switchModule('personal')}>
              <IconAnimation width={50} height={50} />
              <span className="ims-tooltip">Cá nhân</span>
            </div>
          )}
          {hasModuleAccess('ims') && (
            <div className={`ims-icon ${activeModule === 'ims' ? 'active' : ''}`} onClick={() => switchModule('ims')}>
              <i className="fas fa-tachometer-alt"></i>
              <span className="ims-tooltip">Hệ thống</span>
            </div>
          )}
          {hasModuleAccess('hr') && (
            <div className={`ims-icon ${activeModule === 'hr' ? 'active' : ''}`} onClick={() => switchModule('hr')}>
              <i className="fas fa-briefcase-medical"></i>
              <span className="ims-tooltip">Hành chính</span>
            </div>
          )}
          {hasModuleAccess('training') && (
            <div className={`ims-icon ${activeModule === 'training' ? 'active' : ''}`} onClick={() => switchModule('training')}>
              <i className="fas fa-chalkboard-teacher"></i>
              <span className="ims-tooltip">Phòng đào tạo</span>
            </div>
          )}
          {hasModuleAccess('library') && (
            <div className={`ims-icon ${activeModule === 'library' ? 'active' : ''}`} onClick={() => switchModule('library')}>
              <i className="fas fa-book-medical"></i>
              <span className="ims-tooltip">Thư viện</span>
            </div>
          )}
          {hasModuleAccess('admission') && (
            <div className={`ims-icon ${activeModule === 'admission' ? 'active' : ''}`} onClick={() => switchModule('admission')}>
              <i className="fas fa-user-plus"></i>
              <span className="ims-tooltip">Tuyển sinh</span>
            </div>
          )}
          {hasModuleAccess('research') && (
            <div className={`ims-icon ${activeModule === 'research' ? 'active' : ''}`} onClick={() => switchModule('research')}>
              <i className="fas fa-flask"></i>
              <span className="ims-tooltip">Trung tâm nghiên cứu</span>
            </div>
          )}
          {hasModuleAccess('clinical') && (
            <div className={`ims-icon ${activeModule === 'clinical' ? 'active' : ''}`} onClick={() => switchModule('clinical')}>
              <i className="fas fa-clipboard-check"></i>
              <span className="ims-tooltip">Điểm danh</span>
            </div>
          )}
          {hasModuleAccess('lms') && (
            <div className={`ims-icon ${activeModule === 'lms' ? 'active' : ''}`} onClick={() => switchModule('lms')}>
              <i className="fas fa-graduation-cap"></i>
              <span className="ims-tooltip">LMS</span>
            </div>
          )}
          {/* Collapse control at bottom */}
          <div className="ims-icon ims-icon-toggle" onClick={collapseRail}>
            <IconAnimation2 width={34} height={34} />
            <span className="ims-tooltip">Ẩn IMS rail</span>
          </div>
        </div>
      )}

      {/* Vertical Navbar */}
      <div
        ref={navbarRef}
        className={`vertical-navbar ${showMobileMenu ? 'show' : ''} ${expanded ? 'expanded' : ''} ${currentUser?.role === 'student' ? 'student-navbar' : ''}`}
      >
        {/* Logo and Brand */}
        <Link to="/" className="navbar-brand">
          <img src="/logo192.png" alt="Logo" className="logo-small" />
          <img src="/logo512.png" alt="PCTU IMS" className="logo-large" />
          <span className="brand-text">MedManage IMS</span>
        </Link>

        {/* Navigation Links */}
        <div className="nav-menu">
          {/* For students, always show attendance/clinical links (which includes student-specific links) */}
          {currentUser?.role === 'student' ? (
            renderClinicalLinks()
          ) : (
            <>
              {/* IMS Module Switcher for Mobile - show for clinical_admin, clinical_mod, clinical_staff */}
              {(() => {
                const moduleRoles = currentUser?.module_roles || [];
                return moduleRoles.some(role => ['clinical_admin', 'clinical_mod', 'clinical_staff'].includes(role));
              })() && (
                  <div className="mobile-ims-module-switcher d-lg-none">
                    <div className="nav-section-title">Chọn Module</div>
                    <div className="ims-module-grid">
                      {hasModuleAccess('personal') && (
                        <div
                          className={`ims-module-item ${activeModule === 'personal' ? 'active' : ''}`}
                          onClick={() => {
                            switchModule('personal');
                            closeMobileMenu();
                          }}
                        >
                          <IconAnimation width={40} height={40} />
                          <span>Cá nhân</span>
                        </div>
                      )}
                      {hasModuleAccess('clinical') && (
                        <div
                          className={`ims-module-item ${activeModule === 'clinical' ? 'active' : ''}`}
                          onClick={() => {
                            switchModule('clinical');
                            closeMobileMenu();
                          }}
                        >
                          <i className="fas fa-clipboard-check"></i>
                          <span>Điểm danh</span>
                        </div>
                      )}
                      {hasModuleAccess('ims') && (
                        <div
                          className={`ims-module-item ${activeModule === 'ims' ? 'active' : ''}`}
                          onClick={() => {
                            switchModule('ims');
                            closeMobileMenu();
                          }}
                        >
                          <i className="fas fa-tachometer-alt"></i>
                          <span>Hệ thống</span>
                        </div>
                      )}
                      {hasModuleAccess('hr') && (
                        <div
                          className={`ims-module-item ${activeModule === 'hr' ? 'active' : ''}`}
                          onClick={() => {
                            switchModule('hr');
                            closeMobileMenu();
                          }}
                        >
                          <i className="fas fa-briefcase-medical"></i>
                          <span>Hành chính</span>
                        </div>
                      )}
                      {hasModuleAccess('training') && (
                        <div
                          className={`ims-module-item ${activeModule === 'training' ? 'active' : ''}`}
                          onClick={() => {
                            switchModule('training');
                            closeMobileMenu();
                          }}
                        >
                          <i className="fas fa-chalkboard-teacher"></i>
                          <span>Phòng đào tạo</span>
                        </div>
                      )}
                      {hasModuleAccess('library') && (
                        <div
                          className={`ims-module-item ${activeModule === 'library' ? 'active' : ''}`}
                          onClick={() => {
                            switchModule('library');
                            closeMobileMenu();
                          }}
                        >
                          <i className="fas fa-book-medical"></i>
                          <span>Thư viện</span>
                        </div>
                      )}
                      {hasModuleAccess('admission') && (
                        <div
                          className={`ims-module-item ${activeModule === 'admission' ? 'active' : ''}`}
                          onClick={() => {
                            switchModule('admission');
                            closeMobileMenu();
                          }}
                        >
                          <i className="fas fa-user-plus"></i>
                          <span>Tuyển sinh</span>
                        </div>
                      )}
                      {hasModuleAccess('research') && (
                        <div
                          className={`ims-module-item ${activeModule === 'research' ? 'active' : ''}`}
                          onClick={() => {
                            switchModule('research');
                            closeMobileMenu();
                          }}
                        >
                          <i className="fas fa-flask"></i>
                          <span>Trung tâm nghiên cứu</span>
                        </div>
                      )}
                      {hasModuleAccess('lms') && (
                        <div
                          className={`ims-module-item ${activeModule === 'lms' ? 'active' : ''}`}
                          onClick={() => {
                            switchModule('lms');
                            closeMobileMenu();
                          }}
                        >
                          <i className="fas fa-graduation-cap"></i>
                          <span>LMS</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              {/* Module-specific navigation links */}
              {activeModule === 'personal' && renderPersonalLinks()}
              {activeModule === 'clinical' && renderClinicalLinks()}
              {activeModule === 'hr' && renderHRLinks()}
              {activeModule === 'lms' && renderLMSLinks()}
              {activeModule === 'ims' && renderIMSLinks()}
              {activeModule === 'training' && renderTrainingLinks()}
              {activeModule === 'library' && renderLibraryLinks()}
              {activeModule === 'admission' && renderAdmissionLinks()}
              {activeModule === 'research' && renderResearchLinks()}
              {/* Fallback: if no activeModule or on /profile without module, show personal links as default */}
              {(!activeModule || (location.pathname === '/profile' && !activeModule)) && hasModuleAccess('personal') && renderPersonalLinks()}
            </>
          )}
        </div>

        {/* User Controls */}
        <div className="user-controls">
          {renderUserControls()}
        </div>
        {isLoggedIn && currentUser?.role !== 'student' && isRailCollapsed && (
          <div className="ims-rail-expander" onClick={expandRail}>
            <IconAnimation2 width={36} height={36} />
          </div>
        )}
      </div>

      {/* Main Content Container is now in App.js */}

      {/* Mobile Bottom Navigation */}
      {renderMobileNavigation()}
    </>
  );
};

export default Navbar;