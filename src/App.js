import { getStatusPageRedirect } from './utils/systemStatus';
import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { AlertProvider } from './contexts/AlertContext';
import { getDefaultDashboardRoute } from './utils/dashboardRedirect';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { trackPageView } from './utils/analytics';
import activityTracker from './utils/activityTracker';
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
import StudentPerformancePage from './pages/student/StudentPerformancePage';
import MonitoringDashboard from './pages/admin/MonitoringDashboard';
// SessionHistory is now integrated into SessionDetail
import StatisticsDetail from './pages/admin/StatisticsDetail';
import AbsenceRequestManagement from './pages/admin/AbsenceRequestManagement';
import EnhancedAttendanceReports from './pages/admin/EnhancedAttendanceReports';
import DeviceManagement from './pages/admin/DeviceManagement';
import FaceIDEvaluationPage from './pages/admin/FaceIDEvaluationPage';
import AttendanceLogPage from './pages/admin/AttendanceLogPage';
import SystemPage from './pages/superadmin/SystemPage';
import AnnouncementManagement from './pages/superadmin/AnnouncementManagement';
import AnnouncementView from './pages/public/AnnouncementView';
import AnnouncementDetailPage from './pages/public/AnnouncementDetailPage';
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
import LMSActivityLogsPage from './pages/lms/LMSActivityLogsPage';
import LMSMailSettings from './pages/lms/LMSMailSettings';
import Courses from './pages/lms/Courses';
import LiveClass from './pages/lms/LiveClass';
import Exams from './pages/lms/Exams';
import QuestionBank from './pages/lms/QuestionBank';
import Grades from './pages/lms/Grades';
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
// Đảm bảo chất lượng - Lưu trữ minh chứng
import QualityAssuranceDashboard from './pages/quality-assurance/QualityAssuranceDashboard';
import EvidenceStorageManagement from './pages/quality-assurance/EvidenceStorageManagement';
import EvidenceStorageStaffView from './pages/quality-assurance/EvidenceStorageStaffView';
import QualityAssuranceReports from './pages/quality-assurance/QualityAssuranceReports';
import EvidenceMailSettings from './pages/quality-assurance/EvidenceMailSettings';
import QualityAssuranceUserManagement from './pages/quality-assurance/QualityAssuranceUserManagement';

// Medical Records Module
import MedicalRecordsManagement from './pages/medical-records/MedicalRecordsManagement';
import MedicalRecordsDashboard from './pages/medical-records/MedicalRecordsDashboard';
import CIChuaChamDiemPage from './pages/medical-records/CIChuaChamDiemPage';
import ScoreScanningDashboard from './pages/score-scanning/ScoreScanningDashboard';
import ScoreListDetail from './pages/score-scanning/ScoreListDetail';
import ScoreCapturePage from './pages/score-scanning/ScoreCapturePage';
import GeminiApiKeyPage from './pages/score-scanning/GeminiApiKeyPage';
import ScoreScanningUserManagement from './pages/score-scanning/ScoreScanningUserManagement';
import MedicalRecordsUserManagement from './pages/medical-records/MedicalRecordsUserManagement';
import EnhancedMedicalRecordsReports from './pages/medical-records/EnhancedMedicalRecordsReports';
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
import MeetingRoomBooking from './pages/receptionist/MeetingRoomBooking';
import RoomManagement from './pages/receptionist/RoomManagement';
import BookingApprovals from './pages/receptionist/BookingApprovals';
import ReceptionistUserManagement from './pages/receptionist/ReceptionistUserManagement';
import ReceptionistMailSettings from './pages/receptionist/ReceptionistMailSettings';
import ReceptionistDashboard from './pages/receptionist/ReceptionistDashboard';


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
        const path = window.location.pathname;

        // Medical Records: admin toàn quyền, mod trừ quản lý người dùng, staff chỉ Dashboard / Reports / CI chưa chấm
        if (path.startsWith('/medical-records')) {
            if (currentUser.role === 'superadmin') return true;
            const moduleRoles = currentUser.module_roles || [];
            if (path === '/medical-records/users' || path.startsWith('/medical-records/users/'))
                return moduleRoles.includes('medicalrecords_admin');
            if (path === '/medical-records' || path === '/medical-records/')
                return moduleRoles.includes('medicalrecords_admin') || moduleRoles.includes('medicalrecords_mod');
            return moduleRoles.includes('medicalrecords_admin') || moduleRoles.includes('medicalrecords_mod') || moduleRoles.includes('medicalrecords_staff');
        }

        // Score Scanning: admin (toàn quyền + quản lý người dùng), mod (xem tất cả + API keys), staff (chỉ dữ liệu của mình)
        if (path.startsWith('/score-scanning')) {
            if (currentUser.role === 'superadmin') return true;
            const moduleRoles = currentUser.module_roles || [];
            const hasSS = moduleRoles.some(r => r && r.startsWith('score_scanning_'));
            if (!hasSS) return false;
            if (path === '/score-scanning/users' || path.startsWith('/score-scanning/users/'))
                return moduleRoles.includes('score_scanning_admin');
            return true;
        }

        // Lễ tân (Receptionist): receptionist_admin hoặc meeting_staff
        if (path.startsWith('/receptionist')) {
            if (currentUser.role === 'superadmin') return true;
            const moduleRoles = currentUser.module_roles || [];
            return moduleRoles.includes('receptionist_admin') || moduleRoles.includes('meeting_staff');
        }

        // Đảm bảo chất lượng: bắt buộc module_roles (qualityassurance_admin hoặc evidence_*, qastandard_*, ...), không cho vào chỉ vì role admin/staff
        if (path.startsWith('/quality-assurance/')) {
            if (currentUser.role === 'superadmin') return true;
            const moduleRoles = currentUser.module_roles || [];
            if (!Array.isArray(moduleRoles)) return false;
            if (moduleRoles.includes('qualityassurance_admin')) return true;
            const qaPrefixes = ['evidence_', 'qastandard_', 'qaselfassessment_', 'qatrainingprogram_', 'qakpi_'];
            if (moduleRoles.some(r => qaPrefixes.some(p => r.startsWith(p)))) return true;
            return false;
        }

        // IMS: chỉ superadmin hoặc có module_roles ims_*
        if (path.startsWith('/ims/')) {
            if (currentUser.role === 'superadmin') return true;
            const moduleRoles = currentUser.module_roles || [];
            return moduleRoles.some(r => r && r.startsWith('ims_'));
        }

        // HR: chỉ superadmin hoặc có module_roles hr_*
        if (path.startsWith('/hr/')) {
            if (currentUser.role === 'superadmin') return true;
            const moduleRoles = currentUser.module_roles || [];
            return moduleRoles.some(r => r && r.startsWith('hr_'));
        }

        // Admin / Staff (clinical): chỉ superadmin hoặc có clinical_* (không cho vào chỉ vì role admin/staff)
        const isClinicalRoute = path.startsWith('/admin/') || path.startsWith('/staff/');
        if (isClinicalRoute) {
            if (currentUser.role === 'superadmin') return true;
            const effectiveClinicalRole = getEffectiveClinicalRole();
            if (!effectiveClinicalRole) return false;
            if (effectiveClinicalRole === 'clinical_admin') {
                if (allowedRoles && (allowedRoles.includes('superadmin') || allowedRoles.includes('admin') || allowedRoles.includes('staff')))
                    return true;
            }
            if (effectiveClinicalRole === 'clinical_mod') {
                if (allowedRoles && (allowedRoles.includes('admin') || allowedRoles.includes('staff')))
                    return true;
            }
            if (effectiveClinicalRole === 'clinical_staff') {
                if (allowedRoles && allowedRoles.includes('staff'))
                    return true;
            }
            return false;
        }

        if (!allowedRoles) return true; // No restriction

        // Check direct role match (chỉ cho các route không thuộc module trên)
        if (allowedRoles.includes(currentUser.role)) {
            return true;
        }

        return false;
    };

    if (allowedRoles && !hasAccess()) {
        const path = window.location.pathname;
        if (path.startsWith('/medical-records')) {
            return <Navigate to="/medical-records/dashboard" replace />;
        }
        if (path.startsWith('/score-scanning')) {
            return <Navigate to={getDefaultDashboardRoute(currentUser)} replace />;
        }
        if (path.startsWith('/receptionist')) {
            return <Navigate to="/receptionist/booking" replace />;
        }
        return <Navigate to={getDefaultDashboardRoute(currentUser)} replace />;
    }

    return children;
};

function App() {
    const { currentUser } = useAuth();
    const location = useLocation();
    useEffect(() => {
        const redirect = getStatusPageRedirect(window.location);
        if (redirect) window.location.replace(redirect);
    }, [location.pathname]);
    const isAnnouncementPage = location.pathname === '/announcements' || location.pathname.startsWith('/announcements/');
    const isPublicBookingPage = location.pathname === '/dat-phong-cong-khai';
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

    // Initialize activity tracker when user is logged in
    useEffect(() => {
        if (currentUser) {
            // Luôn cập nhật user info khi currentUser thay đổi
            // initialize() sẽ tự kiểm tra và chỉ add listeners một lần
            activityTracker.initialize(currentUser);
        } else {
            activityTracker.stop();
        }

        return () => {
            // Không stop khi component unmount, chỉ stop khi logout
            // activityTracker.stop();
        };
    }, [currentUser]);

    // Track page views - chỉ track khi pathname thay đổi, không track khi currentUser thay đổi
    useEffect(() => {
        if (currentUser) {
            activityTracker.trackPageView(location.pathname);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname]); // Chỉ track khi pathname thay đổi, không track khi currentUser thay đổi

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
    const getDashboardRoute = () => getDefaultDashboardRoute(currentUser);

    return (
        <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID || "477031696759-08e98kj8h2slc25g9qkr6vfrh9bgmqku.apps.googleusercontent.com"}>
            <AlertProvider>
                <ConsoleWarning />
                <PageTracker />
                {!isTakingExam && !isAnnouncementPage && !isPublicBookingPage && <Navbar />}
                {currentUser && !isTakingExam && <TopHeader />}
                <div className={`${currentUser ? "main-content-with-header" : "main-content"} ${isAnnouncementPage ? "announcement-page-layout" : ""} ${isPublicBookingPage ? "public-booking-page-layout" : ""}`}>
                <div className={isPublicBookingPage ? "" : "container-fluid px-2"}>
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
                        {/* Lịch đặt phòng họp công khai - chỉ xem, không cần đăng nhập; đã login thì chuyển sang lịch nội bộ */}
                        <Route path="/dat-phong-cong-khai" element={currentUser ? <Navigate to="/receptionist/booking" replace /> : <MeetingRoomBooking isPublic />} />

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
                        <Route
                            path="/superadmin/announcements"
                            element={<ProtectedRoute allowedRoles={['superadmin']}><AnnouncementManagement /></ProtectedRoute>}
                        />
                        <Route
                            path="/announcements"
                            element={<ProtectedRoute allowedRoles={['superadmin', 'admin', 'staff', 'student']}><AnnouncementView /></ProtectedRoute>}
                        />
                        <Route
                            path="/announcements/:id"
                            element={<ProtectedRoute allowedRoles={['superadmin', 'admin', 'staff', 'student']}><AnnouncementDetailPage /></ProtectedRoute>}
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
                            path="/admin/attendance-log"
                            element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'staff']}><AttendanceLogPage /></ProtectedRoute>}
                        />
                        <Route
                            path="/admin/network-wired"
                            element={<ProtectedRoute allowedRoles={['admin', 'superadmin', 'staff']}><DeviceManagement /></ProtectedRoute>}
                        />
                        <Route
                            path="/admin/faceid-evaluation"
                            element={<ProtectedRoute allowedRoles={['superadmin']}><FaceIDEvaluationPage /></ProtectedRoute>}
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
                        <Route
                            path="/student/performance"
                            element={<ProtectedRoute allowedRoles={['student']}><StudentPerformancePage /></ProtectedRoute>}
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
                            element={<LMSDashboardRoute />}
                        />
                        <Route path="/lms/users" element={<LMSUserManagementRoute />} />
                        <Route path="/lms/activity-logs" element={<LMSActivityLogsRoute />} />
                        <Route path="/lms/mail-settings" element={<LMSMailSettingsRoute />} />
                        <Route path="/lms/courses" element={<LMSCoursesRoute />} />
                        <Route path="/lms/live" element={<LMSLiveRoute />} />
                        <Route path="/lms/exams" element={<LMSExamsRoute />} />
                        <Route path="/lms/questions" element={<LMSQuestionsRoute />} />
                        <Route path="/lms/grades" element={<LMSGradesRoute />} />
                        <Route path="/lms/reports" element={<LMSReportsRoute />} />

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

                        {/* Đảm bảo chất lượng - Lưu trữ minh chứng */}
                        <Route path="/quality-assurance/dashboard" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff']}><QualityAssuranceDashboard /></ProtectedRoute>} />
                        <Route path="/quality-assurance/users" element={<ProtectedRoute allowedRoles={['superadmin','admin']}><QualityAssuranceUserManagement /></ProtectedRoute>} />
                        <Route path="/quality-assurance/evidence-storage" element={<ProtectedRoute allowedRoles={['superadmin','admin']}><EvidenceStorageManagement /></ProtectedRoute>} />
                        <Route path="/quality-assurance/staff" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff']}><EvidenceStorageStaffView /></ProtectedRoute>} />
                        <Route path="/quality-assurance/reports" element={<ProtectedRoute allowedRoles={['superadmin','admin']}><QualityAssuranceReports /></ProtectedRoute>} />
                        <Route path="/quality-assurance/mail-settings" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff']}><EvidenceMailSettings /></ProtectedRoute>} />

                        {/* Medical Records Module routes */}
                        <Route path="/medical-records/dashboard" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff']}><MedicalRecordsDashboard /></ProtectedRoute>} />
                        <Route path="/medical-records/users" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff']}><MedicalRecordsUserManagement /></ProtectedRoute>} />
                        <Route path="/medical-records/ci-chua-cham-diem" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff']}><CIChuaChamDiemPage /></ProtectedRoute>} />
                        <Route path="/medical-records/reports" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff']}><EnhancedMedicalRecordsReports /></ProtectedRoute>} />
                        <Route path="/medical-records" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff']}><MedicalRecordsManagement /></ProtectedRoute>} />

                        {/* Score Scanning Module - Quét điểm sinh viên bằng Gemini AI */}
                        <Route path="/score-scanning" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff']}><ScoreScanningDashboard /></ProtectedRoute>} />
                        <Route path="/score-scanning/users" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff']}><ScoreScanningUserManagement /></ProtectedRoute>} />
                        <Route path="/score-scanning/lists/:id" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff']}><ScoreListDetail /></ProtectedRoute>} />
                        <Route path="/score-scanning/capture/:id" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff']}><ScoreCapturePage /></ProtectedRoute>} />
                        <Route path="/score-scanning/gemini-keys" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff']}><GeminiApiKeyPage /></ProtectedRoute>} />

                        {/* Lễ tân - Receptionist: Đăng ký phòng họp, Quản lý Phòng, Duyệt đặt phòng */}
                        <Route path="/receptionist/dashboard" element={<ReceptionistAdminDashboardRoute />} />
                        <Route path="/receptionist/booking" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><MeetingRoomBooking /></ProtectedRoute>} />
                        <Route path="/receptionist/rooms" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff','student']}><RoomManagement /></ProtectedRoute>} />
                        <Route path="/receptionist/approvals" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff']}><BookingApprovals /></ProtectedRoute>} />
                        <Route path="/receptionist/users" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff']}><ReceptionistUserManagement /></ProtectedRoute>} />
                        <Route path="/receptionist/settings/mail" element={<ProtectedRoute allowedRoles={['superadmin','admin','staff']}><ReceptionistMailSettings /></ProtectedRoute>} />

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

    // Chỉ cho phép khi có quyền module: superadmin, staff/admin + training_admin, clinical_admin, clinical_mod
    const isAllowed = currentUser.role === 'superadmin' ||
                     (currentUser.role === 'staff' && hasTrainingAdminModule) ||
                     (currentUser.role === 'admin' && hasTrainingAdminModule) ||
                     effectiveClinicalRole === 'clinical_admin' ||
                     effectiveClinicalRole === 'clinical_mod';

    if (!isAllowed) {
        return <Navigate to={getDefaultDashboardRoute(currentUser)} replace />;
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
        return <Navigate to={getLMSRedirectPath(currentUser)} />;
    }

    return <QuestionBank />;
}

// Custom route for /lms/users - chỉ cho phép lms_qa và lms_mod
function LMSUserManagementRoute() {
    const { currentUser, loading } = useAuth();

    if (loading) return <Loader text="Đang tải thông tin..." />;
    if (!currentUser) return <Navigate to="/login" />;

    // Kiểm tra module_roles: chỉ cho phép lms_qa
    const moduleRoles = currentUser.module_roles || [];
    const hasLMSUserManagementAccess = Array.isArray(moduleRoles) && (
        moduleRoles.includes('lms_qa')
    );

    if (!hasLMSUserManagementAccess) {
        return <Navigate to={getLMSRedirectPath(currentUser)} />;
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
        return <Navigate to={getLMSRedirectPath(currentUser)} />;
    }

    return <ExamReports />;
}

// Custom route cho /lms/activity-logs - chỉ cho phép lms_qa và lms_admin (QA & Admin LMS)
function LMSActivityLogsRoute() {
    const { currentUser, loading } = useAuth();

    if (loading) return <Loader text="Đang tải thông tin..." />;
    if (!currentUser) return <Navigate to="/login" />;

    const moduleRoles = currentUser.module_roles || [];
    const hasLMSActivityAccess = Array.isArray(moduleRoles) && (
        moduleRoles.includes('lms_qa') || moduleRoles.includes('lms_admin')
    );

    if (!hasLMSActivityAccess) {
        return <Navigate to={getLMSRedirectPath(currentUser)} />;
    }

    return <LMSActivityLogsPage />;
}

// Chỉ lms_qa mới được xem/cấu hình Cài đặt mail LMS (thông báo kỳ thi)
function LMSMailSettingsRoute() {
    const { currentUser, loading } = useAuth();

    if (loading) return <Loader text="Đang tải thông tin..." />;
    if (!currentUser) return <Navigate to="/login" />;

    const moduleRoles = currentUser.module_roles || [];
    const hasLMSMailAccess = Array.isArray(moduleRoles) && moduleRoles.includes('lms_qa');

    if (!hasLMSMailAccess) {
        return <Navigate to={getLMSRedirectPath(currentUser)} />;
    }

    return <LMSMailSettings />;
}

// =====================================================
// LMS ROUTE HELPERS (theo module_roles + student)
// =====================================================
function getLMSRedirectPath(currentUser) {
    if (!currentUser) return '/login';
    const moduleRoles = currentUser.module_roles || [];
    const hasAnyLMSRole = Array.isArray(moduleRoles) && moduleRoles.some(r => typeof r === 'string' && r.startsWith('lms_'));

    // Nếu user có quyền vào LMS module (lms_* hoặc student) nhưng bị chặn trang cụ thể
    // thì điều hướng về LMS dashboard để UX rõ ràng.
    if (hasAnyLMSRole || currentUser.role === 'student') return '/lms/dashboard';

    if (currentUser.role === 'superadmin') return '/ims/dashboard';
    if (currentUser.role === 'student') return '/student/attendance';
    return '/personal/dashboard';
}

// /lms/dashboard: lms_admin, lms_qa, lms_mod, lms_staff, student
function LMSDashboardRoute() {
    const { currentUser, loading } = useAuth();
    if (loading) return <Loader text="Đang tải thông tin..." />;
    if (!currentUser) return <Navigate to="/login" />;

    const moduleRoles = currentUser.module_roles || [];
    const hasAccess = currentUser.role === 'student' || (Array.isArray(moduleRoles) && (
        moduleRoles.includes('lms_admin') || moduleRoles.includes('lms_qa') || moduleRoles.includes('lms_mod') || moduleRoles.includes('lms_staff')
    ));

    if (!hasAccess) return <Navigate to={getLMSRedirectPath(currentUser)} />;
    return <LMSDashboard />;
}

// /lms/courses: lms_admin, lms_qa, lms_mod, lms_staff, student
function LMSCoursesRoute() {
    const { currentUser, loading } = useAuth();
    if (loading) return <Loader text="Đang tải thông tin..." />;
    if (!currentUser) return <Navigate to="/login" />;

    const moduleRoles = currentUser.module_roles || [];
    const hasAccess = currentUser.role === 'student' || (Array.isArray(moduleRoles) && (
        moduleRoles.includes('lms_admin') || moduleRoles.includes('lms_qa') || moduleRoles.includes('lms_mod') || moduleRoles.includes('lms_staff')
    ));

    if (!hasAccess) return <Navigate to={getLMSRedirectPath(currentUser)} />;
    return <Courses />;
}

// /lms/live: lms_admin, lms_qa, lms_mod, lms_staff, student
function LMSLiveRoute() {
    const { currentUser, loading } = useAuth();
    if (loading) return <Loader text="Đang tải thông tin..." />;
    if (!currentUser) return <Navigate to="/login" />;

    const moduleRoles = currentUser.module_roles || [];
    const hasAccess = currentUser.role === 'student' || (Array.isArray(moduleRoles) && (
        moduleRoles.includes('lms_admin') || moduleRoles.includes('lms_qa') || moduleRoles.includes('lms_mod') || moduleRoles.includes('lms_staff')
    ));

    if (!hasAccess) return <Navigate to={getLMSRedirectPath(currentUser)} />;
    return <LiveClass />;
}

// /lms/exams: lms_qa, lms_mod
function LMSExamsRoute() {
    const { currentUser, loading } = useAuth();
    if (loading) return <Loader text="Đang tải thông tin..." />;
    if (!currentUser) return <Navigate to="/login" />;

    const moduleRoles = currentUser.module_roles || [];
    const hasAccess = Array.isArray(moduleRoles) && (moduleRoles.includes('lms_qa') || moduleRoles.includes('lms_mod'));
    if (!hasAccess) return <Navigate to={getLMSRedirectPath(currentUser)} />;
    return <Exams />;
}

// /lms/grades: chỉ lms_qa
function LMSGradesRoute() {
    const { currentUser, loading } = useAuth();
    if (loading) return <Loader text="Đang tải thông tin..." />;
    if (!currentUser) return <Navigate to="/login" />;

    const moduleRoles = currentUser.module_roles || [];
    const hasAccess = Array.isArray(moduleRoles) && moduleRoles.includes('lms_qa');
    if (!hasAccess) return <Navigate to={getLMSRedirectPath(currentUser)} />;
    return <Grades />;
}

// /receptionist/dashboard: chỉ receptionist_admin (hoặc superadmin)
function ReceptionistAdminDashboardRoute() {
    const { currentUser, loading } = useAuth();
    if (loading) return <Loader text="Đang tải thông tin..." />;
    if (!currentUser) return <Navigate to="/login" />;

    const moduleRoles = currentUser.module_roles || [];
    const hasAccess = currentUser.role === 'superadmin' || (Array.isArray(moduleRoles) && moduleRoles.includes('receptionist_admin'));
    if (!hasAccess) return <Navigate to="/receptionist/booking" replace />;

    return <ReceptionistDashboard />;
}