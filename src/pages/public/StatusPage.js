import React, { useState, useEffect } from 'react';
import axios from 'axios';
import usePageTitle from '../../hooks/usePageTitle';
import './StatusPage.css';

// Tạo axios instance dựa trên port hiện tại
// Trong Docker, sử dụng proxy qua setupProxy.js (relative URL)
// Outside Docker, kết nối trực tiếp đến API Gateway
const getApiBaseURL = () => {
    // Luôn sử dụng relative URL để proxy hoạt động (setupProxy.js sẽ xử lý)
    // Proxy sẽ forward requests đến gateway service trong Docker network
    return '/api';
};

const statusApi = axios.create({
    baseURL: getApiBaseURL(),
    timeout: 5000,
    headers: {
        'Content-Type': 'application/json'
    }
});

const StatusPage = () => {
    usePageTitle('Trạng thái hệ thống');
    const [status, setStatus] = useState(null);
    const [incidents, setIncidents] = useState([]);
    const [uptime, setUptime] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedPeriod, setSelectedPeriod] = useState(90);
    const [displayedIncidentsCount, setDisplayedIncidentsCount] = useState(5);

    useEffect(() => {
        loadStatus();
        loadIncidents();
        loadUptime();
        
        // Auto-refresh every 30 seconds
        const interval = setInterval(() => {
            loadStatus();
        }, 30000);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        loadUptime();
    }, [selectedPeriod]);

    const loadStatus = async () => {
        try {
            const response = await statusApi.get('/status');
            setStatus(response.data);
        } catch (error) {
            console.error('Error loading status:', error);
            // Set default status if error
            setStatus({
                success: false,
                status: 'unknown',
                modules: {},
                timestamp: new Date().toISOString()
            });
        } finally {
            setLoading(false);
        }
    };

    const loadIncidents = async () => {
        try {
            const response = await statusApi.get('/incidents?limit=20');
            const newIncidents = response.data.incidents || [];
            setIncidents(newIncidents);
            // Reset số lượng hiển thị về 5 khi có dữ liệu mới
            if (newIncidents.length > 0) {
                setDisplayedIncidentsCount(5);
            }
        } catch (error) {
            console.error('Error loading incidents:', error);
            setIncidents([]);
            setDisplayedIncidentsCount(5);
        }
    };

    const loadUptime = async () => {
        try {
            const response = await statusApi.get(`/uptime?days=${selectedPeriod}`);
            setUptime(response.data);
        } catch (error) {
            console.error('Error loading uptime:', error);
            setUptime({ success: false, uptime: [], period: `${selectedPeriod} days` });
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'operational':
                return '#10b981'; // green
            case 'degraded':
                return '#f59e0b'; // yellow
            case 'partial_outage':
                return '#ef4444'; // red
            case 'major_outage':
                return '#dc2626'; // dark red
            default:
                return '#6b7280'; // gray
        }
    };

    const getStatusText = (status) => {
        switch (status) {
            case 'operational':
                return 'Hoạt động bình thường';
            case 'degraded':
                return 'Hiệu suất giảm';
            case 'partial_outage':
                return 'Sự cố một phần';
            case 'major_outage':
                return 'Sự cố nghiêm trọng';
            default:
                return 'Không xác định';
        }
    };

    const getModuleStatusColor = (moduleStatus) => {
        switch (moduleStatus) {
            case 'operational':
                return '#10b981';
            case 'degraded':
                return '#f59e0b';
            case 'down':
                return '#ef4444';
            default:
                return '#6b7280';
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString('vi-VN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="status-page">
            <div className="status-container">
                {/* Header */}
                <header className="status-header">
                    <h1>Trạng thái hệ thống PCTU IMS</h1>
                    <p className="status-subtitle">
                        Theo dõi trạng thái của tất cả các module và dịch vụ
                    </p>
                </header>

                {/* Loading State */}
                {loading && !status && (
                    <div className="loading-section">
                        <div className="loading">Đang tải dữ liệu...</div>
                    </div>
                )}

                {/* Overall Status */}
                {status && (
                    <div className="overall-status">
                        <div className="status-info">
                            <h2>{getStatusText(status.status)}</h2>
                            <p className="status-timestamp">
                                Cập nhật lần cuối: {formatDate(status.timestamp)}
                            </p>
                        </div>
                    </div>
                )}

                {/* Modules Status */}
                {status && status.modules && (
                    <div className="modules-section">
                        <h3>Tất cả các module</h3>
                        <div className="modules-grid">
                            {Object.entries(status.modules).map(([key, module]) => (
                                <div key={key} className="module-card">
                                    <div className="module-header">
                                        <span 
                                            className="module-status-dot"
                                            style={{ backgroundColor: getModuleStatusColor(module.status) }}
                                        ></span>
                                        <h4>{module.name}</h4>
                                    </div>
                                    <div className="module-details">
                                        <p className="module-status">
                                            {module.status === 'operational' ? 'Hoạt động bình thường' :
                                             module.status === 'degraded' ? 'Hiệu suất giảm' :
                                             module.status === 'down' ? 'Không hoạt động' : 'Không xác định'}
                                        </p>
                                        {module.lastChecked && (
                                            <p className="module-last-checked">
                                                Kiểm tra: {formatDate(module.lastChecked)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Uptime Statistics */}
                <div className="uptime-section">
                    <h3>Thống kê Uptime</h3>
                    <div className="uptime-controls">
                        <button 
                            className={selectedPeriod === 7 ? 'active' : ''}
                            onClick={() => setSelectedPeriod(7)}
                        >
                            7 ngày
                        </button>
                        <button 
                            className={selectedPeriod === 30 ? 'active' : ''}
                            onClick={() => setSelectedPeriod(30)}
                        >
                            30 ngày
                        </button>
                        <button 
                            className={selectedPeriod === 90 ? 'active' : ''}
                            onClick={() => setSelectedPeriod(90)}
                        >
                            90 ngày
                        </button>
                    </div>
                    {uptime && uptime.uptime && uptime.uptime.length > 0 ? (
                        <div className="uptime-chart">
                            <p>Uptime trung bình: {calculateAverageUptime(uptime.uptime)}%</p>
                        </div>
                    ) : (
                        <p className="no-data">Chưa có dữ liệu uptime</p>
                    )}
                </div>

                {/* Incidents History */}
                <div className="incidents-section">
                    <h3>Lịch sử sự cố</h3>
                    {incidents.length > 0 ? (
                        <>
                            <div className="incidents-list">
                                {incidents.slice(0, displayedIncidentsCount).map((incident) => (
                                    <div key={incident.id} className="incident-card">
                                        <div className="incident-header">
                                            <h4>{incident.title}</h4>
                                            <span className={`incident-status ${incident.status}`}>
                                                {incident.status === 'resolved' ? 'Đã giải quyết' :
                                                 incident.status === 'investigating' ? 'Đang điều tra' :
                                                 incident.status === 'identified' ? 'Đã xác định' :
                                                 'Đang giám sát'}
                                            </span>
                                        </div>
                                        {incident.description && (
                                            <p className="incident-description">{incident.description}</p>
                                        )}
                                        <div className="incident-meta">
                                            <span>Bắt đầu: {formatDate(incident.created_at)}</span>
                                            {incident.resolved_at && (
                                                <span>Giải quyết: {formatDate(incident.resolved_at)}</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {displayedIncidentsCount < incidents.length && (
                                <div style={{ textAlign: 'center', marginTop: '20px' }}>
                                    <button
                                        onClick={() => setDisplayedIncidentsCount(prev => prev + 5)}
                                        style={{
                                            padding: '10px 30px',
                                            fontSize: '16px',
                                            cursor: 'pointer',
                                            backgroundColor: 'transparent',
                                            color: '#007bff',
                                            border: '1px solid #007bff',
                                            borderRadius: '5px',
                                            transition: 'all 0.3s'
                                        }}
                                        onMouseOver={(e) => {
                                            e.target.style.backgroundColor = '#007bff';
                                            e.target.style.color = 'white';
                                        }}
                                        onMouseOut={(e) => {
                                            e.target.style.backgroundColor = 'transparent';
                                            e.target.style.color = '#007bff';
                                        }}
                                    >
                                        Xem thêm
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <p className="no-data">Không có sự cố nào được ghi nhận</p>
                    )}
                </div>

                {/* Footer */}
                <footer className="status-footer">
                    <p>
                        Trang này tự động cập nhật mỗi 30 giây. 
                        Để nhận thông báo về sự cố, vui lòng liên hệ quản trị viên.
                    </p>
                </footer>
            </div>
        </div>
    );
};

const calculateAverageUptime = (uptimeData) => {
    if (!uptimeData || !Array.isArray(uptimeData) || uptimeData.length === 0) {
        return '0.00';
    }
    
    // Lọc và chuyển đổi các giá trị hợp lệ
    const validValues = uptimeData
        .map(item => {
            const value = item.uptime_percentage;
            // Chuyển đổi string thành number, xử lý null/undefined
            if (value === null || value === undefined || value === '') {
                return null;
            }
            const numValue = typeof value === 'string' ? parseFloat(value) : Number(value);
            // Chỉ lấy giá trị hợp lệ (không phải NaN)
            return isNaN(numValue) ? null : numValue;
        })
        .filter(value => value !== null);
    
    if (validValues.length === 0) {
        return '0.00';
    }
    
    const total = validValues.reduce((sum, value) => sum + value, 0);
    const average = total / validValues.length;
    
    // Trả về với 2 chữ số thập phân
    return isNaN(average) ? '0.00' : average.toFixed(2);
};

export default StatusPage;






