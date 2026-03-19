import React, { useState, useEffect } from 'react';
import axios from 'axios';
import usePageTitle from '../../hooks/usePageTitle';
import './StatusPage.css';
import { getApiBaseURL } from '../../utils/api';

// Tạo axios instance dựa trên port hiện tại
// Sử dụng getApiBaseURL() từ utils/api.js để đảm bảo đúng port trong production (8043)
const statusApi = axios.create({
    baseURL: getApiBaseURL(),
    timeout: 15000,
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
    const [uptimeTooltip, setUptimeTooltip] = useState({ visible: false, date: null, pct: null, x: 0, y: 0, moduleName: '' });

    useEffect(() => {
        loadStatus();
        loadIncidents();
        
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
                externalServices: {},
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

    // Lấy dữ liệu uptime 90 ngày cho module
    const getUptimeBarsForModule = (moduleKey) => {
        if (!uptime?.uptime?.length) return Array(90).fill(null);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const bars = [];
        for (let i = 89; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().slice(0, 10);
            const row = uptime.uptime.find(
                (r) => String(r.module_name) === String(moduleKey) && 
                String(r.date).slice(0, 10) === dateStr
            );
            const pct = row ? parseFloat(row.uptime_percentage) : null;
            bars.push(pct);
        }
        return bars;
    };

    const getUptimePercentForModule = (moduleKey) => {
        const bars = getUptimeBarsForModule(moduleKey);
        const withData = bars.filter((b) => b !== null);
        if (withData.length === 0) return 100;
        return (withData.reduce((s, v) => s + v, 0) / withData.length).toFixed(2);
    };

    const getStatusIcon = (status) => {
        if (status === 'operational') return '✓';
        if (status === 'down') return '✗';
        return '!';
    };

    const getDateForBarIndex = (idx) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const d = new Date(today);
        d.setDate(d.getDate() - (89 - idx));
        return d;
    };

    const formatTooltipDate = (date) => {
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    return (
        <div className="status-page">
            {/* Uptime Tooltip */}
            <div id="uptime-tooltip" className={`uptime-tooltip ${uptimeTooltip.visible ? 'visible' : ''}`} style={{ display: uptimeTooltip.visible ? 'block' : 'none' }} role="tooltip">
                <div className="uptime-tooltip-pointer" style={{ left: uptimeTooltip.x, top: uptimeTooltip.y }} />
                <div className="uptime-tooltip-box" style={{ left: uptimeTooltip.x - 80, top: (uptimeTooltip.y || 0) + 10 }}>
                    <div className="uptime-tooltip-content">
                        {uptimeTooltip.date && (
                            <>
                                <div className="uptime-tooltip-date">{formatTooltipDate(uptimeTooltip.date)}</div>
                                <div className="uptime-tooltip-outages">
                                    {uptimeTooltip.pct === null && (
                                        <div className="no-data-msg">Không có dữ liệu cho ngày này.</div>
                                    )}
                                    {uptimeTooltip.pct !== null && uptimeTooltip.pct >= 100 && (
                                        <div className="no-outages-msg">Không có downtime được ghi nhận trong ngày này.</div>
                                    )}
                                    {uptimeTooltip.pct !== null && uptimeTooltip.pct > 0 && uptimeTooltip.pct < 100 && (
                                        <div className="outage-field partial">
                                            <span className="label">Sự cố một phần</span>
                                            <span className="value">Uptime {uptimeTooltip.pct}%</span>
                                        </div>
                                    )}
                                    {uptimeTooltip.pct !== null && uptimeTooltip.pct === 0 && (
                                        <div className="outage-field major">
                                            <span className="label">Sự cố nghiêm trọng</span>
                                            <span className="value">Không hoạt động</span>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="status-container">
                {/* Header */}
                <header className="status-header">
                    <h1>Trạng thái hệ thống PCTU IMS</h1>
                    <p className="status-subtitle">
                        Theo dõi trạng thái của tất cả các module và dịch vụ
                    </p>
                </header>

                {/* Skeleton khi đang tải - hiển thị layout ngay, không đợi vài giây trống */}
                {loading && !status && (
                    <>
                        <div className="overall-status status-skeleton">
                            <div className="status-info">
                                <div className="skeleton-line skeleton-title" style={{ width: '180px' }} aria-hidden="true" />
                                <div className="skeleton-line skeleton-timestamp" style={{ width: '220px' }} aria-hidden="true" />
                            </div>
                        </div>
                        <div className="modules-section">
                            <h3>Modules nội bộ</h3>
                            <div className="components-container one-column">
                                {[...Array(12)].map((_, i) => (
                                    <div key={i} className="component-container border-color status-module-skeleton">
                                        <div className="component-inner-container status-green showcased">
                                            <span className="skeleton-line skeleton-name" style={{ width: `${160 + (i % 3) * 40}px` }} aria-hidden="true" />
                                            <span className="skeleton-line skeleton-status" style={{ width: '120px' }} aria-hidden="true" />
                                            <span className="skeleton-icon" aria-hidden="true" />
                                            <div className="uptime-90-days-wrapper">
                                                <div className="skeleton-uptime-bars" aria-hidden="true" />
                                                <div className="legend">
                                                    <span className="skeleton-line" style={{ width: '80px' }} aria-hidden="true" />
                                                    <div className="spacer" />
                                                    <span className="skeleton-line" style={{ width: '70px' }} aria-hidden="true" />
                                                    <div className="spacer" />
                                                    <span className="skeleton-line" style={{ width: '60px' }} aria-hidden="true" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
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

                {/* Modules Status - Layout theo status-container-example */}
                {status && status.modules && (
                    <div className="modules-section">
                        <h3>Modules nội bộ</h3>
                        <div className="components-container one-column">
                            {Object.entries(status.modules).map(([key, module]) => {
                                const statusClass = module.status === 'operational' ? 'status-green' : 
                                    module.status === 'down' ? 'status-red' : 'status-yellow';
                                const bars = getUptimeBarsForModule(key);
                                const uptimePercent = getUptimePercentForModule(key);
                                const statusText = module.status === 'operational' ? 'Hoạt động bình thường' :
                                    module.status === 'degraded' ? 'Hiệu suất giảm' :
                                    module.status === 'down' ? 'Không hoạt động' : 'Không xác định';
                                return (
                                    <div key={key} className="component-container border-color">
                                        <div className={`component-inner-container ${statusClass} showcased`} data-component-status={module.status}>
                                            <span className="name">{module.name}</span>
                                            <span className="component-status">{statusText}</span>
                                            <span className={`status-icon-button status-icon-${module.status}`} aria-label={statusText} title={statusText}>
                                                {getStatusIcon(module.status)}
                                            </span>
                                            <div className="uptime-90-days-wrapper">
                                                <svg className="availability-time-line-graphic" preserveAspectRatio="none" height="34" viewBox="0 0 448 34">
                                                    {bars.map((pct, idx) => {
                                                        const fill = pct === null ? '#e5e7eb' :
                                                            pct >= 100 ? '#1e8542' : pct > 0 ? '#cd8812' : '#ef4444';
                                                        const dateForBar = getDateForBarIndex(idx);
                                                        return (
                                                            <rect
                                                                key={idx}
                                                                height="34"
                                                                width="3"
                                                                x={idx * 5}
                                                                y="0"
                                                                fill={fill}
                                                                className={`uptime-day day-${idx}`}
                                                                role="tab"
                                                                tabIndex={idx === 0 ? 0 : -1}
                                                                aria-describedby="uptime-tooltip"
                                                                onMouseEnter={(e) => {
                                                                    const rect = e.target.getBoundingClientRect();
                                                                    setUptimeTooltip({
                                                                        visible: true,
                                                                        date: dateForBar,
                                                                        pct,
                                                                        x: rect.left + rect.width / 2,
                                                                        y: rect.bottom,
                                                                        moduleName: module.name
                                                                    });
                                                                }}
                                                                onMouseLeave={() => setUptimeTooltip({ visible: false, date: null, pct: null, x: 0, y: 0, moduleName: '' })}
                                                            />
                                                        );
                                                    })}
                                                </svg>
                                                <div className="legend">
                                                    <div className="legend-item light legend-item-date-range">
                                                        <span className="availability-time-line-legend-day-count">90</span> ngày trước
                                                    </div>
                                                    <div className="spacer"></div>
                                                    <div className="legend-item legend-item-uptime-value">
                                                        <span>Uptime {uptimePercent}%</span>
                                                    </div>
                                                    <div className="spacer"></div>
                                                    <div className="legend-item light legend-item-date-range">Hôm nay</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* External Services (Third-party) */}
                {status && status.externalServices && Object.keys(status.externalServices).length > 0 && (
                    <div className="modules-section external-services-section">
                        <h3>Dịch vụ bên thứ 3</h3>
                        <p className="section-description">
                            Các API và dịch vụ ngoài hệ thống được sử dụng (Google, email, geocoding, v.v.)
                        </p>
                        <div className="components-container one-column">
                            {Object.entries(status.externalServices).map(([key, svc]) => {
                                const statusClass = svc.status === 'optional' ? 'status-optional' :
                                    svc.status === 'operational' ? 'status-green' : 
                                    svc.status === 'down' ? 'status-red' : 'status-yellow';
                                const statusText = svc.status === 'operational' ? 'Hoạt động bình thường' :
                                    svc.status === 'degraded' ? 'Hiệu suất giảm' :
                                    svc.status === 'down' ? 'Không hoạt động' :
                                    svc.status === 'optional' ? (svc.note || 'Tùy chọn') : 'Không xác định';
                                return (
                                    <div key={key} className="component-container border-color">
                                        <div className={`component-inner-container ${statusClass} showcased external-service-inner`}>
                                            <div className="component-name-block">
                                                <span className="name">{svc.name}</span>
                                                {svc.description && (
                                                    <span className="component-description">{svc.description}</span>
                                                )}
                                            </div>
                                            <span className="component-status">{statusText}</span>
                                            <span className={`status-icon-button status-icon-${svc.status}`} aria-label={statusText}>
                                                {svc.status === 'optional' ? '○' : getStatusIcon(svc.status)}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
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






