/**
 * Trả về URL redirect mặc định sau login / khi không có quyền truy cập route.
 * - Superadmin → /ims/dashboard
 * - Student → /student/attendance
 * - Có human_resources → /personal/dashboard (module Cá nhân)
 * - Không có human_resources → module đầu tiên user có quyền (clinical, ims, hr, lms, receptionist, ...)
 */
export function getDefaultDashboardRoute(currentUser) {
    if (!currentUser) return '/login';
    if (currentUser.role === 'superadmin') return '/ims/dashboard';
    if (currentUser.role === 'student') return '/student/attendance';

    const moduleRoles = currentUser.module_roles || [];
    const arr = Array.isArray(moduleRoles) ? moduleRoles : [];

    const hasHumanResources = () => currentUser.role === 'superadmin' || arr.includes('human_resources');
    const getEffectiveClinicalRole = () => {
        if (arr.includes('clinical_admin')) return 'clinical_admin';
        if (arr.includes('clinical_mod')) return 'clinical_mod';
        if (arr.includes('clinical_staff')) return 'clinical_staff';
        return null;
    };
    const hasModule = (key) => {
        if (currentUser.role === 'superadmin') return true;
        if (key === 'personal') return arr.includes('human_resources');
        if (key === 'clinical') return getEffectiveClinicalRole() !== null;
        if (key === 'evidence') {
            if (arr.includes('qualityassurance_admin')) return true;
            const qa = ['evidence_', 'qastandard_', 'qaselfassessment_', 'qatrainingprogram_', 'qakpi_'];
            return arr.some(r => qa.some(p => r.startsWith(p)));
        }
        if (key === 'medical-records') return arr.some(r => r.startsWith('medicalrecords_'));
        if (key === 'score-scanning') return currentUser.role === 'admin' || currentUser.role === 'staff' || arr.some(r => r.startsWith('score_scanning_'));
        if (key === 'receptionist') return arr.includes('receptionist_admin') || arr.includes('meeting_staff');
        return arr.some(r => r.startsWith(`${key}_`));
    };

    if (hasHumanResources()) return '/personal/dashboard';

    const order = ['clinical', 'ims', 'hr', 'lms', 'training', 'library', 'admission', 'research', 'evidence', 'medical-records', 'score-scanning', 'receptionist'];
    for (const key of order) {
        if (hasModule(key)) {
            if (key === 'clinical') {
                const role = getEffectiveClinicalRole();
                if (role === 'clinical_admin') return '/superadmin/dashboard';
                if (role === 'clinical_mod') return '/admin/dashboard';
                if (role === 'clinical_staff') return '/staff/dashboard';
                return '/admin/sessions';
            }
            if (key === 'ims') return '/ims/dashboard';
            if (key === 'hr') return '/hr/dashboard';
            if (key === 'lms') return '/lms/dashboard';
            if (key === 'training') return '/training/dashboard';
            if (key === 'library') return '/library/dashboard';
            if (key === 'admission') return '/admission/dashboard';
            if (key === 'research') return '/research/dashboard';
            if (key === 'evidence') return '/quality-assurance/dashboard';
            if (key === 'medical-records') return '/medical-records/dashboard';
            if (key === 'score-scanning') return '/score-scanning';
            if (key === 'receptionist') return arr.includes('receptionist_admin') ? '/receptionist/dashboard' : '/receptionist/booking';
        }
    }
    // User không có module nào và không có human_resources → vào trang profile
    return '/profile';
}
