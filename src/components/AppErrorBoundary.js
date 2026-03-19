import React from 'react';

/**
 * Error Boundary để tránh trang trắng khi có lỗi JS (vd. tải lại /login).
 * Hiển thị thông báo và nút tải lại.
 */
class AppErrorBoundary extends React.Component {
    state = { hasError: false, error: null };

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('[AppErrorBoundary]', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    padding: '2rem',
                    textAlign: 'center',
                    fontFamily: 'sans-serif',
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#f5f5f5'
                }}>
                    <h2 style={{ marginBottom: '1rem', color: '#333' }}>Đã xảy ra lỗi</h2>
                    <p style={{ color: '#666', marginBottom: '1.5rem' }}>
                        Vui lòng tải lại trang hoặc thử đăng nhập lại.
                    </p>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        style={{
                            padding: '0.5rem 1.5rem',
                            fontSize: '1rem',
                            cursor: 'pointer',
                            background: '#0d6efd',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px'
                        }}
                    >
                        Tải lại trang
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

export default AppErrorBoundary;
