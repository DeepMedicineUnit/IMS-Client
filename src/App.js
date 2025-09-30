import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { GoogleOAuthProvider } from '@react-oauth/google';
import Navbar from './components/Navbar';
import TopHeader from './components/TopHeader';
import Loader from './components/Loader';
import './styles/dark-mode.css';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import QRLogin from './pages/auth/QRLogin';
import SuperAdminDashboard from './pages/superadmin/SuperAdminDashboard';
import AdminDashboard from './pages/admin/AdminDashboard';
import StaffDashboard from './pages/staff/StaffDashboard';
import StudentDashboard from './pages/student/StudentDashboard';
import UserManagement from './pages/superadmin/UserManagement';
import ProfilePage from './pages/user/ProfilePage';
import SessionList from './pages/admin/SessionList';
import CreateSession from './pages/admin/CreateSession';
import EditSession from './pages/admin/EditSession';
import SessionDetail from './pages/admin/SessionDetail';
import QRCodePage from './pages/admin/QRCodePage';
import AttendanceSession from './pages/student/AttendanceSession';
import MonitoringPage from './pages/student/MonitoringPage';
import AbsenceRequestPage from './pages/student/AbsenceRequestPage';
import AbsenceConfirmationPreview from './pages/student/AbsenceConfirmationPreview';
import MonitoringDashboard from './pages/admin/MonitoringDashboard';
import SessionHistory from './pages/admin/SessionHistory';
import StatisticsDetail from './pages/admin/StatisticsDetail';
import AbsenceRequestManagement from './pages/admin/AbsenceRequestManagement';
import EnhancedAttendanceReports from './pages/admin/EnhancedAttendanceReports';
import DeviceManagement from './pages/admin/DeviceManagement';


// Protected route component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { currentUser, loading } = useAuth();
  
  if (loading) {
    return <Loader text="Đang tải thông tin..." />;
  }
  
  if (!currentUser) {
    return <Navigate to="/login" />;
  }
  
  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    // Redirect to appropriate dashboard based on role
    if (currentUser.role === 'superadmin') return <Navigate to="/superadmin/dashboard" />;
    if (currentUser.role === 'admin') return <Navigate to="/admin/dashboard" />;
    if (currentUser.role === 'staff') return <Navigate to="/staff/dashboard" />;
    if (currentUser.role === 'student') return <Navigate to="/student/dashboard" />;
    return <Navigate to="/login" />;
  }
  
  return children;
};

function App() {
  const { currentUser } = useAuth();

  // Function to redirect to appropriate dashboard based on user role
  const getDashboardRoute = () => {
    if (!currentUser) return '/login';
    
    switch (currentUser.role) {
      case 'superadmin': return '/superadmin/dashboard';
      case 'admin': return '/admin/dashboard';
      case 'staff': return '/staff/dashboard';
      case 'student': return '/student/dashboard';
      default: return '/login';
    }
  };

  return (
    <GoogleOAuthProvider clientId="477031696759-08e98kj8h2slc25g9qkr6vfrh9bgmqku.apps.googleusercontent.com">
      <Navbar />
      {currentUser && <TopHeader />}
      <div className={currentUser ? "main-content-with-header" : "main-content"}>
        <div className="container-fluid px-4">
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/qr-login" element={<QRLogin />} />
            
            {/* Default route - redirects to appropriate dashboard */}
            <Route path="/" element={<Navigate to={getDashboardRoute()} />} />
          
          {/* SuperAdmin routes */}
          <Route 
            path="/superadmin/dashboard" 
            element={<ProtectedRoute allowedRoles={['superadmin']}><SuperAdminDashboard /></ProtectedRoute>} 
          />
          <Route 
            path="/superadmin/users" 
            element={<ProtectedRoute allowedRoles={['superadmin', 'admin']}><UserManagement /></ProtectedRoute>} 
          />
          <Route 
            path="/superadmin/stats/:metricType" 
            element={<ProtectedRoute allowedRoles={['superadmin']}><StatisticsDetail /></ProtectedRoute>} 
          />
          <Route 
            path="/superadmin/stats/:metricType/:studentId" 
            element={<ProtectedRoute allowedRoles={['superadmin']}><StatisticsDetail /></ProtectedRoute>} 
          />
          
          {/* Admin routes */}
          <Route 
            path="/admin/dashboard" 
            element={<ProtectedRoute allowedRoles={['admin', 'superadmin']}><AdminDashboard /></ProtectedRoute>} 
          />
          <Route 
            path="/admin/sessions" 
            element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'staff']}><SessionList /></ProtectedRoute>} 
          />
          <Route 
            path="/admin/sessions/create" 
            element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'staff']}><CreateSession /></ProtectedRoute>} 
          />
          <Route 
            path="/admin/sessions/:id" 
            element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'staff']}><SessionDetail /></ProtectedRoute>} 
          />
          <Route 
            path="/admin/sessions/:id/edit" 
            element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'staff']}><EditSession /></ProtectedRoute>} 
          />
          <Route 
            path="/admin/sessions/:id/qr-code" 
            element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'staff']}><QRCodePage /></ProtectedRoute>} 
          />
          <Route 
            path="/admin/sessions/:id/monitoring" 
            element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'staff']}><MonitoringDashboard /></ProtectedRoute>} 
          />
          <Route 
            path="/admin/sessions/:id/history" 
            element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'staff']}><SessionHistory /></ProtectedRoute>} 
          />
          <Route 
            path="/admin/stats/:metricType" 
            element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'staff']}><StatisticsDetail /></ProtectedRoute>} 
          />
          <Route 
            path="/admin/stats/:metricType/:studentId" 
            element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'staff']}><StatisticsDetail /></ProtectedRoute>} 
          />
          <Route 
            path="/admin/absence-requests" 
            element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'staff']}><AbsenceRequestManagement /></ProtectedRoute>} 
          />
          <Route 
            path="/admin/attendance-reports" 
            element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'staff']}><EnhancedAttendanceReports /></ProtectedRoute>} 
          />
          <Route 
            path="/admin/network-wired" 
            element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'staff']}><DeviceManagement /></ProtectedRoute>} 
          />
          
          {/* Staff routes */}
          <Route 
            path="/staff/dashboard" 
            element={<ProtectedRoute allowedRoles={['staff', 'admin', 'superadmin']}><StaffDashboard /></ProtectedRoute>} 
          />
          
          {/* Student routes */}
          <Route 
            path="/student/dashboard" 
            element={<ProtectedRoute allowedRoles={['student']}><StudentDashboard /></ProtectedRoute>} 
          />
          <Route 
            path="/session/:id/attend" 
            element={<AttendanceSession />} 
          />
          <Route 
            path="/session/:id/attend-shared" 
            element={<AttendanceSession shared={true} />} 
          />
          <Route 
            path="/session/:id/monitor" 
            element={<ProtectedRoute allowedRoles={['student']}><MonitoringPage /></ProtectedRoute>} 
          />
          <Route 
            path="/student/absence-requests" 
            element={<ProtectedRoute allowedRoles={['student']}><AbsenceRequestPage /></ProtectedRoute>} 
          />
          <Route 
            path="/student/absence-requests/:id/preview" 
            element={<AbsenceConfirmationPreview />} 
          />
          
          {/* Profile route - accessible by all authenticated users */}
          <Route 
            path="/profile" 
            element={<ProtectedRoute allowedRoles={['superadmin', 'admin', 'staff', 'student']}><ProfilePage /></ProtectedRoute>} 
          />
          
          {/* Fallback route */}
          <Route path="*" element={<Navigate to={getDashboardRoute()} />} />
        </Routes>
        </div>
      </div>
    </GoogleOAuthProvider>
  );
}

export default App;