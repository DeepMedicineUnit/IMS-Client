import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import usePageTitle from '../hooks/usePageTitle';
import './ErrorPage.css';

const ErrorPage = () => {
    usePageTitle('Trang không tìm thấy');
    const navigate = useNavigate();
    const location = useLocation();
    const { currentUser } = useAuth();

    useEffect(() => {
        // Prevent scrolling - check if document.body and document.documentElement exist
        if (typeof document !== 'undefined' && document.body) {
            document.body.classList.add('error-page-active');
        }
        if (typeof document !== 'undefined' && document.documentElement) {
            document.documentElement.classList.add('error-page-active');
        }
        
        return () => {
            // Cleanup on unmount
            if (typeof document !== 'undefined' && document.body) {
                document.body.classList.remove('error-page-active');
            }
            if (typeof document !== 'undefined' && document.documentElement) {
                document.documentElement.classList.remove('error-page-active');
            }
        };
    }, []);

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

    const handleGoHome = () => {
        navigate(getDashboardRoute());
    };

    const handleGoBack = () => {
        navigate(-1);
    };

    return (
        <div className="error-page-container">
            <div className="error-content">
                <div className="error-icon mb-4">
                    <i className="fas fa-exclamation-triangle"></i>
                </div>
                
                <h1 className="error-code mb-3">404</h1>
                
                <h2 className="error-title mb-3">
                    Trang không tìm thấy
                </h2>
                
                <p className="error-message mb-4">
                    Đường dẫn <strong>"{location.pathname}"</strong> không tồn tại hoặc đã bị xóa.
                </p>
                
                <p className="error-description mb-4">
                    Vui lòng kiểm tra lại đường dẫn hoặc quay lại trang chủ.
                </p>
                
                <div className="error-actions d-flex gap-3 justify-content-center flex-wrap">
                    <Button 
                        variant="primary" 
                        size="lg"
                        onClick={handleGoHome}
                        className="px-4"
                    >
                        <i className="fas fa-home me-2"></i>
                        Về trang chủ
                    </Button>
                    
                    <Button 
                        variant="outline-secondary" 
                        size="lg"
                        onClick={handleGoBack}
                        className="px-4"
                    >
                        <i className="fas fa-arrow-left me-2"></i>
                        Quay lại
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ErrorPage;
















