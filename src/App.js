import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { AlertProvider } from './contexts/AlertContext';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { trackPageView } from './utils/analytics';
import Navbar from './components/Navbar';
import TopHeader from './components/TopHeader';
import Loader from './components/Loader';
import PageTracker from './components/PageTracker';
import ConsoleWarning from './components/ConsoleWarning';
import './styles/dark-mode.css';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import QRLogin from './pages/auth/QRLogin';
import StatusPage from './pages/public/StatusPage';
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
import StudentExams from './pages/student/StudentExams';
import StudentGrades from './pages/student/StudentGrades';
import StudentCourses from './pages/student/StudentCourses';
import StudentSchedule from './pages/student/StudentSchedule';
import MonitoringDashboard from './pages/admin/MonitoringDashboard';
// SessionHistory is now integrated into SessionDetail
import StatisticsDetail from './pages/admin/StatisticsDetail';
import AbsenceRequestManagement from './pages/admin/AbsenceRequestManagement';
import EnhancedAttendanceReports from './pages/admin/EnhancedAttendanceReports';
import DeviceManagement from './pages/admin/DeviceManagement';
import SystemPage from './pages/superadmin/SystemPage';
import HRDashboard from './pages/hr/HRDashboard';
import EmployeesDemo from './pages/hr/Employees';
import Profiles from './pages/hr/Profiles';
import Recruitment from './pages/hr/Recruitment';
import TimeAttendance from './pages/hr/TimeAttendance';
import TrainingCME from './pages/hr/TrainingCME';
import Payroll from './pages/hr/Payroll';
import PayrollSettings from './pages/hr/PayrollSettings';
import Performance from './pages/hr/Performance';
import Documents from './pages/hr/Documents';
import Analytics from './pages/hr/Analytics';
import EmployeeRelations from './pages/hr/EmployeeRelations';
import WorkforcePlanning from './pages/hr/WorkforcePlanning';
import Finance from './pages/hr/Finance';
import Procurement from './pages/hr/Procurement';
import Assets from './pages/hr/Assets';
import Facilities from './pages/hr/Facilities';
import DMS from './pages/hr/DMS';
import Alumni from './pages/hr/Alumni';
import Transport from './pages/hr/Transport';
import ClinicLab from './pages/hr/ClinicLab';
import LMSDashboard from './pages/lms/LMSDashboard';
import LMSUserManagement from './pages/lms/LMSUserManagement';
import Courses from './pages/lms/Courses';
import LiveClass from './pages/lms/LiveClass';
import Exams from './pages/lms/Exams';
import QuestionBank from './pages/lms/QuestionBank';
import Grades from './pages/lms/Grades';
import Integrations from './pages/lms/Integrations';
import SupportAnalytics from './pages/lms/SupportAnalytics';
import ExamReports from './pages/lms/ExamReports';
import TrainingDashboard from './pages/training/trainingDashboard';
import Planning from './pages/training/Planning';
import Programs from './pages/training/Programs';
import Scheduling from './pages/training/Scheduling';
import Learners from './pages/training/Learners';
import Delivery from './pages/training/Delivery';
import Assessment from './pages/training/Assessment';
import Certification from './pages/training/Certification';
import CMETracking from './pages/training/CMETracking';
import Reporting from './pages/training/Reporting';
import Trainers from './pages/training/Trainers';
import Digitization from './pages/training/Digitization';
import PDCA from './pages/training/PDCA';
import LibraryDashboard from './pages/library/LibraryDashboard';
import Repository from './pages/library/Repository';
import SearchLib from './pages/library/Search';
import Recommend from './pages/library/Recommend';
import VideosLib from './pages/library/Videos';
import Guidelines from './pages/library/Guidelines';
import Cases from './pages/library/Cases';
import Research from './pages/library/Research';
import VR from './pages/library/VR';
import Borrowing from './pages/library/Borrowing';
import Blockchain from './pages/library/Blockchain';
import LibAnalytics from './pages/library/Analytics';
import LibIntegrations from './pages/library/Integrations';
import DRM from './pages/library/DRM';
import SupportLib from './pages/library/Support';
import MobileLib from './pages/library/Mobile';
import AdmitDashboard from './pages/admission/AdmitDashboard';
import Leads from './pages/admission/Leads';
import Applications from './pages/admission/Applications';
import Evaluation from './pages/admission/Evaluation';
import Results from './pages/admission/Results';
import Onboarding from './pages/admission/Onboarding';
import Certifications from './pages/admission/Certifications';
import AdmitReporting from './pages/admission/Reporting';
import AdmitIntegrations from './pages/admission/Integrations';
import AdmitSupport from './pages/admission/Support';
import QuotaBudget from './pages/admission/QuotaBudget';
import ResearchDashboard from './pages/research/ResearchDashboard';
import Projects from './pages/research/Projects';
import Funding from './pages/research/Funding';
import Collaboration from './pages/research/Collaboration';
import Progress from './pages/research/Progress';
import DataRepo from './pages/research/DataRepo';
import Publications from './pages/research/Publications';
import ResearchReporting from './pages/research/ResearchReporting';
import Compliance from './pages/research/Compliance';
import ResearchIntegrations from './pages/research/Integrations';
import ResearchSupport from './pages/research/Support';
import Researchers from './pages/research/Researchers';
import IMSExecDashboard from './pages/ims/IMSExecDashboard';
import Tickets from './pages/ims/Tickets';
import SLA from './pages/ims/SLA';
import DataWarehouse from './pages/ims/DataWarehouse';
import PersonalDashboard from './pages/personal/PersonalDashboard';
import PersonalAttendance from './pages/personal/PersonalAttendance';
import PersonalDocuments from './pages/personal/PersonalDocuments';
import PersonalRequests from './pages/personal/PersonalRequests';
import PersonalProfile from './pages/personal/PersonalProfile';
import PersonalTickets from './pages/personal/PersonalTickets';
import PersonalTasks from './pages/personal/PersonalTasks';
import PersonalNotifications from './pages/personal/PersonalNotifications';
import ErrorPage from './pages/ErrorPage';


// Protected route component
const ProtectedRoute = ({ children, allowedRoles }) => {
    const { currentUser, loading } = useAuth();

    if (loading) {
        return <Loader text="Đang tải thông tin..." />;
    }

    if (!currentUser) {
        return <Navigate to="/login" />;
    }

    // Helper function to get effective role for clinical module based on module_roles
    const getEffectiveClinicalRole = () => {
        const moduleRoles = currentUser.module_roles || [];
        if (moduleRoles.includes('clinical_admin')) return 'clinical_admin';
        if (moduleRoles.includes('clinical_mod')) return 'clinical_mod';
        if (moduleRoles.includes('clinical_staff')) return 'clinical_staff';
        return null;
    };

    // Check if user has access based on role or module_roles
    const hasAccess = () => {
        if (!allowedRoles) return true; // No restriction
        
        // Check direct role match first
        if (allowedRoles.includes(currentUser.role)) {
            return true;
        }
        
        // Check clinical module roles for clinical routes
        // Clinical routes are: /admin/*, /superadmin/* (for clinical module), /staff/dashboard
        const path = window.location.pathname;
        const isClinicalRoute = path.startsWith('/admin/') || 
                                path.startsWith('/superadmin/') || 
                                path.startsWith('/staff/dashboard');
        
        if (isClinicalRoute) {
            const effectiveClinicalRole = getEffectiveClinicalRole();
            
            // Map clinical roles to standard roles for access check
            // clinical_admin is equivalent to superadmin for clinical routes
            if (effectiveClinicalRole === 'clinical_admin') {
                // clinical_admin can access routes that require superadmin, admin, or staff
                if (allowedRoles.includes('superadmin') || 
                    allowedRoles.includes('admin') || 
                    allowedRoles.includes('staff')) {
                    return true;
                }
            }
            // clinical_mod is equivalent to admin for clinical routes
            if (effectiveClinicalRole === 'clinical_mod') {
                // clinical_mod can access routes that require admin or staff (but not superadmin-only routes)
                if (allowedRoles.includes('admin') || 
                    allowedRoles.includes('staff')) {
                    return true;
                }
            }
            // clinical_staff is equivalent to staff for clinical routes
            if (effectiveClinicalRole === 'clinical_staff') {
                // clinical_staff can access routes that require staff
                if (allowedRoles.includes('staff')) {
                    return true;
                }
            }
        }
        
        return false;
    };

    if (allowedRoles && !hasAccess()) {
        // Redirect to appropriate dashboard based on role
        if (currentUser.role === 'superadmin') {
            return <Navigate to="/ims/dashboard" />;
        }
        if (currentUser.role === 'student') {
            return <Navigate to="/student/attendance" />;
        }
        // All other users (admin, staff, clinical_admin, clinical_mod, clinical_staff, etc.) go to personal dashboard
        return <Navigate to="/personal/dashboard" />;
    }

    return children;
};

function App() {
    const { currentUser } = useAuth();
    const location = useLocation();
    const isStatusPage = location.pathname === '/status';
    const [isTakingExam, setIsTakingExam] = useState(false);

    // Check if student is taking exam by checking body class
    useEffect(() => {
        const checkExamStatus = () => {
            setIsTakingExam(document.body.classList.contains('exam-taking'));
        };

        // Check initially
        checkExamStatus();

        // Watch for class changes using MutationObserver
        const observer = new MutationObserver(checkExamStatus);
        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['class']
        });

        return () => {
            observer.disconnect();
        };
    }, [location.pathname]);

    // Helper function to get effective clinical role based on module_roles
    const getEffectiveClinicalRole = () => {
        if (!currentUser) return null;
        const moduleRoles = currentUser.module_roles || [];
        if (moduleRoles.includes('clinical_admin')) return 'clinical_admin';
        if (moduleRoles.includes('clinical_mod')) return 'clinical_mod';
        if (moduleRoles.includes('clinical_staff')) return 'clinical_staff';
        return null;
    };

    // Function to redirect to appropriate dashboard based on user role
    const getDashboardRoute = () => {
        if (!currentUser) return '/login';

        // Only superadmin goes to IMS dashboard
        if (currentUser.role === 'superadmin') {
            return '/ims/dashboard';
        }
        
        // Students go to student dashboard
        if (currentUser.role === 'student') {
            return '/student/attendance';
        }
        
        // All other users (admin, staff, clinical_admin, clinical_mod, clinical_staff, etc.) go to personal dashboard
        return '/personal/dashboard';
    };

    return (
        <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID || "477031696759-08e98kj8h2slc25g9qkr6vfrh9bgmqku.apps.googleusercontent.com"}>
            <AlertProvider>
                <ConsoleWarning />
                <PageTracker />
                {!isTakingExam && !isStatusPage && <Navbar />}
                {currentUser && !isTakingExam && !isStatusPage && <TopHeader />}
                <div className={currentUser && !isStatusPage ? "main-content-with-header" : "main-content"}>
                <div className={isStatusPage ? "" : "container-fluid px-2"}>
                    <Routes>
                        {/* Public routes - redirect if already logged in */}
                        <Route 
                            path="/login" 
                            element={
                                currentUser ? (
                                    <Navigate to={getDashboardRoute()} replace />
                                ) : (
                                    <Login />
                                )
                            } 
                        />
                        <Route path="/register" element={<Register />} />
                        <Route path="/forgot-password" element={<ForgotPassword />} />
                        <Route path="/reset-password" element={<ResetPassword />} />
                        <Route path="/qr-login" element={<QRLogin />} />
                        {/* Public Status Page - No authentication required */}
                        <Route path="/status" element={<StatusPage />} />

                        {/* Default route - redirects to appropriate dashboard */}
                        <Route 
                            path="/" 
                            element={
                                currentUser ? (
                                    <Navigate to={getDashboardRoute()} replace />
                                ) : (
                                    <Navigate to="/login" replace />
                                )
                            } 
                        />

                        {/* SuperAdmin routes */}
                        <Route
                            path="/superadmin/dashboard"
                            element={<ProtectedRoute allowedRoles={['superadmin']}><SuperAdminDashboard /></ProtectedRoute>}
                        />
                        <Route
                            path="/superadmin/users"
                            element={<TrainingUsersRoute />}
                        />
                        <Route
                            path="/superadmin/stats/:metricType"
                            element={<ProtectedRoute allowedRoles={['superadmin']}><StatisticsDetail /></ProtectedRoute>}
                        />
                        <Route
                            path="/superadmin/stats/:metricType/:studentId"
                            element={<ProtectedRoute allowedRoles={['superadmin']}><StatisticsDetail /></ProtectedRoute>}
                        />
                        <Route
                            path="/superadmin/systempage"
                            element={<ProtectedRoute allowedRoles={['superadmin']}><SystemPage /></ProtectedRoute>}
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
                        {/* Redirect old history route to session detail */}
                        <Route
                            path="/admin/sessions/:id/history"
                            element={<Navigate to="../" replace />}
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
                            path="/student/attendance"
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
                        <Route
                            path="/student/exams"
                            element={<ProtectedRoute allowedRoles={['student']}><StudentExams /></ProtectedRoute>}
                        />
                        <Route
                            path="/student/grades"
                            element={<ProtectedRoute allowedRoles={['student']}><StudentGrades /></ProtectedRoute>}
                        />
                        <Route
                            path="/student/courses"
                            element={<ProtectedRoute allowedRoles={['student']}><StudentCourses /></ProtectedRoute>}
                        />
                        <Route
                            path="/student/schedule"
                            element={<ProtectedRoute allowedRoles={['student']}><StudentSchedule /></ProtectedRoute>}
                        />

                        {/* Profile route - accessible by all authenticated users */}
                        <Route
                            path="/profile"
                            element={<ProtectedRoute allowedRoles={['superadmin', 'admin', 'staff', 'student']}><ProfilePage /></ProtectedRoute>}
                        />

                        {/* IMS: HR demo routes */}
                        <Route
                            path="/hr/dashboard"
                            element={<ProtectedRoute allowedRoles={['superadmin', 'admin', 'staff', 'student']}><HRDashboard /></ProtectedRoute>}
                        />
                        <Route path="/hr/employees" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><EmployeesDemo /></ProtectedRoute>} />
                        <Route path="/hr/profiles" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Profiles /></ProtectedRoute>} />
                        <Route path="/hr/recruitment" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Recruitment /></ProtectedRoute>} />
                        <Route path="/hr/attendance" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><TimeAttendance /></ProtectedRoute>} />
                        <Route path="/hr/training" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><TrainingCME /></ProtectedRoute>} />
                        <Route path="/hr/payroll" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Payroll /></ProtectedRoute>} />
                        <Route path="/hr/payroll-settings" element={<ProtectedRoute allowedRoles={['superadmin','admin']}><PayrollSettings /></ProtectedRoute>} />
                        <Route path="/hr/performance" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Performance /></ProtectedRoute>} />
                        <Route path="/hr/documents" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Documents /></ProtectedRoute>} />
                        <Route path="/hr/analytics" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Analytics /></ProtectedRoute>} />
                        <Route path="/hr/relations" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><EmployeeRelations /></ProtectedRoute>} />
                        <Route path="/hr/workforce" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><WorkforcePlanning /></ProtectedRoute>} />
                        <Route path="/hr/finance" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Finance /></ProtectedRoute>} />
                        <Route path="/hr/procurement" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Procurement /></ProtectedRoute>} />
                        <Route path="/hr/assets" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Assets /></ProtectedRoute>} />
                        <Route path="/hr/facilities" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Facilities /></ProtectedRoute>} />
                        <Route path="/hr/dms" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><DMS /></ProtectedRoute>} />
                        <Route path="/hr/alumni" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Alumni /></ProtectedRoute>} />
                        <Route path="/hr/transport" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Transport /></ProtectedRoute>} />
                        <Route path="/hr/cliniclab" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><ClinicLab /></ProtectedRoute>} />

                        {/* IMS: LMS routes */}
                        <Route
                            path="/lms/dashboard"
                            element={<ProtectedRoute allowedRoles={['superadmin', 'admin', 'staff', 'student']}><LMSDashboard /></ProtectedRoute>}
                        />
                        <Route path="/lms/users" element={<LMSUserManagementRoute />} />
                        <Route
                            path="/lms/courses"
                            element={<ProtectedRoute allowedRoles={['superadmin', 'admin', 'staff', 'student']}><Courses /></ProtectedRoute>}
                        />
                        <Route path="/lms/live" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><LiveClass /></ProtectedRoute>} />
                        <Route path="/lms/exams" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Exams /></ProtectedRoute>} />
                        <Route path="/lms/questions" element={<LMSQuestionsRoute />} />
                        <Route path="/lms/grades" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Grades /></ProtectedRoute>} />
                        <Route path="/lms/reports" element={<LMSReportsRoute />} />
                        <Route path="/lms/integrations" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Integrations /></ProtectedRoute>} />
                        <Route path="/lms/support" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><SupportAnalytics /></ProtectedRoute>} />

                        {/* IMS: Training routes */}
                        <Route
                            path="/training/dashboard"
                            element={<ProtectedRoute allowedRoles={['superadmin', 'admin', 'staff', 'student']}><TrainingDashboard /></ProtectedRoute>}
                        />
                        <Route path="/training/planning" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Planning /></ProtectedRoute>} />
                        <Route path="/training/programs" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Programs /></ProtectedRoute>} />
                        <Route path="/training/scheduling" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Scheduling /></ProtectedRoute>} />
                        <Route path="/training/learners" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Learners /></ProtectedRoute>} />
                        <Route path="/training/delivery" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Delivery /></ProtectedRoute>} />
                        <Route path="/training/assessment" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Assessment /></ProtectedRoute>} />
                        <Route path="/training/certification" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Certification /></ProtectedRoute>} />
                        <Route path="/training/cme" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><CMETracking /></ProtectedRoute>} />
                        <Route path="/training/reporting" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Reporting /></ProtectedRoute>} />
                        <Route path="/training/trainers" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Trainers /></ProtectedRoute>} />
                        <Route path="/training/digitization" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Digitization /></ProtectedRoute>} />
                        <Route path="/training/pdca" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><PDCA /></ProtectedRoute>} />

                        {/* IMS: Library routes */}
                        <Route
                            path="/library/dashboard"
                            element={<ProtectedRoute allowedRoles={['superadmin', 'admin', 'staff', 'student']}><LibraryDashboard /></ProtectedRoute>}
                        />
                        <Route path="/library/repository" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Repository /></ProtectedRoute>} />
                        <Route path="/library/search" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><SearchLib /></ProtectedRoute>} />
                        <Route path="/library/recommend" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Recommend /></ProtectedRoute>} />
                        <Route path="/library/videos" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><VideosLib /></ProtectedRoute>} />
                        <Route path="/library/guidelines" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Guidelines /></ProtectedRoute>} />
                        <Route path="/library/cases" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Cases /></ProtectedRoute>} />
                        <Route path="/library/research" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Research /></ProtectedRoute>} />
                        <Route path="/library/vr" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><VR /></ProtectedRoute>} />
                        <Route path="/library/borrowing" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Borrowing /></ProtectedRoute>} />
                        <Route path="/library/blockchain" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Blockchain /></ProtectedRoute>} />
                        <Route path="/library/analytics" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><LibAnalytics /></ProtectedRoute>} />
                        <Route path="/library/integrations" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><LibIntegrations /></ProtectedRoute>} />
                        <Route path="/library/drm" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><DRM /></ProtectedRoute>} />
                        <Route path="/library/support" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><SupportLib /></ProtectedRoute>} />
                        <Route path="/library/mobile" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><MobileLib /></ProtectedRoute>} />

                        {/* IMS: Admission routes */}
                        <Route path="/admission/dashboard" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><AdmitDashboard /></ProtectedRoute>} />
                        <Route path="/admission/leads" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Leads /></ProtectedRoute>} />
                        <Route path="/admission/applications" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Applications /></ProtectedRoute>} />
                        <Route path="/admission/evaluation" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Evaluation /></ProtectedRoute>} />
                        <Route path="/admission/results" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Results /></ProtectedRoute>} />
                        <Route path="/admission/onboarding" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Onboarding /></ProtectedRoute>} />
                        <Route path="/admission/certifications" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Certifications /></ProtectedRoute>} />
                        <Route path="/admission/reporting" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><AdmitReporting /></ProtectedRoute>} />
                        <Route path="/admission/integrations" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><AdmitIntegrations /></ProtectedRoute>} />
                        <Route path="/admission/support" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><AdmitSupport /></ProtectedRoute>} />
                        <Route path="/admission/quota" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><QuotaBudget /></ProtectedRoute>} />

                        {/* IMS: Research routes */}
                        <Route path="/research/dashboard" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><ResearchDashboard /></ProtectedRoute>} />
                        <Route path="/research/projects" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Projects /></ProtectedRoute>} />
                        <Route path="/research/funding" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Funding /></ProtectedRoute>} />
                        <Route path="/research/collaboration" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Collaboration /></ProtectedRoute>} />
                        <Route path="/research/progress" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Progress /></ProtectedRoute>} />
                        <Route path="/research/data" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><DataRepo /></ProtectedRoute>} />
                        <Route path="/research/publications" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Publications /></ProtectedRoute>} />
                        <Route path="/research/reporting" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><ResearchReporting /></ProtectedRoute>} />
                        <Route path="/research/compliance" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Compliance /></ProtectedRoute>} />
                        <Route path="/research/integrations" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><ResearchIntegrations /></ProtectedRoute>} />
                        <Route path="/research/support" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><ResearchSupport /></ProtectedRoute>} />
                        <Route path="/research/researchers" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Researchers /></ProtectedRoute>} />

                        {/* Personal routes */}
                        <Route path="/personal/dashboard" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><PersonalDashboard /></ProtectedRoute>} />
                        <Route path="/personal/attendance" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><PersonalAttendance /></ProtectedRoute>} />
                        <Route path="/personal/documents" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><PersonalDocuments /></ProtectedRoute>} />
                        <Route path="/personal/requests" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><PersonalRequests /></ProtectedRoute>} />
                        <Route path="/personal/profile" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><PersonalProfile /></ProtectedRoute>} />
                        <Route path="/personal/tickets" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><PersonalTickets /></ProtectedRoute>} />
                        <Route path="/personal/tasks" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><PersonalTasks /></ProtectedRoute>} />
                        <Route path="/personal/notifications" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><PersonalNotifications /></ProtectedRoute>} />

                        {/* IMS ops routes */}
                        <Route path="/ims/dashboard" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><IMSExecDashboard /></ProtectedRoute>} />
                        <Route path="/ims/tickets" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><Tickets /></ProtectedRoute>} />
                        <Route path="/ims/sla" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><SLA /></ProtectedRoute>} />
                        <Route path="/ims/dwh" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><DataWarehouse /></ProtectedRoute>} />

                        {/* Fallback route - Error page for invalid routes */}
                        <Route path="*" element={<ErrorPage />} />
                    </Routes>
                </div>
            </div>
            </AlertProvider>
        </GoogleOAuthProvider>
    );
}

export default App;

// Custom route for /superadmin/users to permit Training Admin module role (even if base role is staff)
function TrainingUsersRoute() {
    const { currentUser, loading } = useAuth();

    if (loading) return <Loader text="Đang tải thông tin..." />;
    if (!currentUser) return <Navigate to="/login" />;

    // Helper to get effective clinical role
    const getEffectiveClinicalRole = () => {
        const moduleRoles = currentUser.module_roles || [];
        if (moduleRoles.includes('clinical_admin')) return 'clinical_admin';
        if (moduleRoles.includes('clinical_mod')) return 'clinical_mod';
        if (moduleRoles.includes('clinical_staff')) return 'clinical_staff';
        return null;
    };

    const effectiveClinicalRole = getEffectiveClinicalRole();
    const hasTrainingAdminModule = Array.isArray(currentUser.module_roles) && currentUser.module_roles.includes('training_admin');
    
    // Allow access if:
    // 1. User is superadmin
    // 2. User is admin
    // 3. User is staff with training_admin module role
    // 4. User has clinical_admin (equivalent to superadmin for clinical module)
    // 5. User has clinical_mod (equivalent to admin for clinical module)
    const isAllowed = currentUser.role === 'superadmin' || 
                     currentUser.role === 'admin' || 
                     (currentUser.role === 'staff' && hasTrainingAdminModule) ||
                     effectiveClinicalRole === 'clinical_admin' ||
                     effectiveClinicalRole === 'clinical_mod';

    if (!isAllowed) {
        // Redirect based on role
        if (currentUser.role === 'superadmin') {
            return <Navigate to="/ims/dashboard" />;
        }
        if (currentUser.role === 'student') {
            return <Navigate to="/student/attendance" />;
        }
        // All other users (admin, staff, clinical_admin, clinical_mod, clinical_staff, etc.) go to personal dashboard
        return <Navigate to="/personal/dashboard" />;
    }

    return <UserManagement />;
}

// Custom route for /lms/questions - chỉ cho phép lms_qa, lms_mod, lms_staff
// Không cho phép lms_admin, superadmin, admin, staff, student nếu không có module_roles phù hợp
function LMSQuestionsRoute() {
    const { currentUser, loading } = useAuth();

    if (loading) return <Loader text="Đang tải thông tin..." />;
    if (!currentUser) return <Navigate to="/login" />;

    // Kiểm tra module_roles: chỉ cho phép lms_qa, lms_mod, lms_staff (không cho lms_admin)
    const moduleRoles = currentUser.module_roles || [];
    const hasLMSAccess = Array.isArray(moduleRoles) && (
        moduleRoles.includes('lms_qa') || moduleRoles.includes('lms_mod') || moduleRoles.includes('lms_staff')
    );

    if (!hasLMSAccess) {
        // Redirect based on base role
        if (currentUser.role === 'superadmin') return <Navigate to="/ims/dashboard" />;
        if (currentUser.role === 'student') return <Navigate to="/student/attendance" />;
        // All other users (admin, staff, etc.) go to personal dashboard
        return <Navigate to="/personal/dashboard" />;
    }

    return <QuestionBank />;
}

// Custom route for /lms/users - chỉ cho phép lms_qa và lms_mod
function LMSUserManagementRoute() {
    const { currentUser, loading } = useAuth();

    if (loading) return <Loader text="Đang tải thông tin..." />;
    if (!currentUser) return <Navigate to="/login" />;

    // Kiểm tra module_roles: chỉ cho phép lms_qa và lms_mod
    const moduleRoles = currentUser.module_roles || [];
    const hasLMSUserManagementAccess = Array.isArray(moduleRoles) && (
        moduleRoles.includes('lms_qa') || moduleRoles.includes('lms_mod')
    );

    if (!hasLMSUserManagementAccess) {
        // Redirect based on base role
        if (currentUser.role === 'superadmin') return <Navigate to="/ims/dashboard" />;
        if (currentUser.role === 'student') return <Navigate to="/student/attendance" />;
        // All other users (admin, staff, etc.) go to personal dashboard
        return <Navigate to="/personal/dashboard" />;
    }

    return <LMSUserManagement />;
}

// Custom route for /lms/reports - chỉ cho phép lms_qa
// Không cho phép lms_admin, lms_mod, lms_staff, superadmin, admin, staff, student
function LMSReportsRoute() {
    const { currentUser, loading } = useAuth();

    if (loading) return <Loader text="Đang tải thông tin..." />;
    if (!currentUser) return <Navigate to="/login" />;

    // Kiểm tra module_roles: chỉ cho phép lms_qa (không cho lms_admin, lms_mod, lms_staff)
    const moduleRoles = currentUser.module_roles || [];
    const hasLMSQAAccess = Array.isArray(moduleRoles) && moduleRoles.includes('lms_qa');

    if (!hasLMSQAAccess) {
        // Redirect based on base role
        if (currentUser.role === 'superadmin') return <Navigate to="/ims/dashboard" />;
        if (currentUser.role === 'student') return <Navigate to="/student/attendance" />;
        // All other users (admin, staff, etc.) go to personal dashboard
        return <Navigate to="/personal/dashboard" />;
    }

    return <ExamReports />;
}