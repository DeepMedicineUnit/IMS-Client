import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './styles/loaders.css';
import StatusPage from './pages/public/StatusPage';
import './pages/public/StatusPage.css';
import './i18n/config'; // Khởi tạo i18n

// Tự động phát hiện port để quyết định render component nào
// Port 3001: Chỉ render StatusPage (standalone)
// Port khác (3000): Render App với routing đầy đủ
const getCurrentPort = () => {
    // Lấy port từ URL hiện tại
    const port = window.location.port;
    // Nếu không có port trong URL (có thể là default port), kiểm tra protocol
    if (!port || port === '') {
        return window.location.protocol === 'https:' ? '443' : '80';
    }
    return port;
};

const currentPort = getCurrentPort();
const isStatusPagePort = currentPort === '3001';

const root = ReactDOM.createRoot(document.getElementById('root'));

if (isStatusPagePort) {
    // Port 3001: Chỉ render StatusPage standalone
    root.render(
        <React.StrictMode>
            <StatusPage />
        </React.StrictMode>
    );
} else {
    // Port khác (3000): Render App với routing đầy đủ
    root.render(
        <React.StrictMode>
            <BrowserRouter>
                <AuthProvider>
                    <App />
                    <ToastContainer position="top-right" autoClose={3000} />
                </AuthProvider>
            </BrowserRouter>
        </React.StrictMode>
    );
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
 