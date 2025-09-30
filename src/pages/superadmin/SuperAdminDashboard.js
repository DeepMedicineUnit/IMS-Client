import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Button, Spinner, Alert } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import StatisticsCard from '../../components/StatisticsCard';
import StatisticsList from '../../components/StatisticsList';
import PieChart from '../../components/charts/PieChart';
import BarChart from '../../components/charts/BarChart';
import LineChart from '../../components/charts/LineChart';
import '../../styles/dashboard.css';

const pastelColors = [
  '#4e73df', '#36b9cc', '#1cc88a', '#f6c23e', '#e74a3b', '#858796'
];

const SuperAdminDashboard = () => {
  const { currentUser, api } = useAuth();
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalSessions: 0,
    activeSessions: 0,
    lateStudentsCount: 0,
    absentStudentsCount: 0,
    missingTimeSlotCount: 0,
    multipleLateCount: 0,
    incompleteBadgeCount: 0,
    lateStudents: [],
    absentStudents: [],
    missingTimeSlotStudents: [],
    multipleLateStudents: [],
    incompleteBadgeStudents: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const fetchDashboardStats = async (isInitialLoad = false) => {
      try {
        if (isInitialLoad) {
          setLoading(true);
        } else {
          setIsRefreshing(true);
        }
        
        const response = await api.get('/dashboard/stats');
        if (response.data.success) {
          setStats(response.data.data);
          setError(''); // Clear any previous errors
          setLastUpdate(new Date());
        } else {
          setError('Không thể tải dữ liệu thống kê');
        }
      } catch (err) {
        setError('Lỗi khi tải dữ liệu thống kê. Vui lòng thử lại sau.');
      } finally {
        if (isInitialLoad) {
          setLoading(false);
        } else {
          setIsRefreshing(false);
        }
      }
    };

    // Initial fetch
    fetchDashboardStats(true);

    // Set up auto-refresh every 10 seconds, but only when tab is visible
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchDashboardStats(false);
      }
    }, 10000);

    // Handle visibility change to refresh when tab becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchDashboardStats(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup interval and event listener on component unmount
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [api]);

  // Chart data prep for attendance overview
  const attendanceData = [
    stats.totalStudents - stats.absentStudentsCount - stats.lateStudentsCount,
    stats.lateStudentsCount,
    stats.absentStudentsCount
  ];
  const attendanceLabels = ['Đúng giờ', 'Đi trễ', 'Vắng mặt'];
  const attendanceColors = ['#1cc88a', '#f6c23e', '#e74a3b'];

  // Chart data for multiple late students
  const lateStudentsData = stats.multipleLateStudents
    ? stats.multipleLateStudents.slice(0, 10).map(student => student.late_count)
    : [];
  const lateStudentsLabels = stats.multipleLateStudents
    ? stats.multipleLateStudents.slice(0, 10).map(student => student.full_name)
    : [];

  return (
    <div className="admin-dashboard-container">
      
      {/* Auto-refresh indicator */}
      <div className="auto-refresh-indicator">
        <i className={`fas ${isRefreshing ? 'fa-sync-alt fa-spin' : 'fa-sync-alt'} me-1`}></i>
        {isRefreshing ? 'Đang cập nhật...' : 'Tự động cập nhật'}
      </div>

      <div className="dashboard-header">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h2 className="dashboard-title">Bảng điều khiển Quản trị viên cấp cao</h2>
          </div>
        </div>
      </div>
      {error && <Alert className="error-alert">{error}</Alert>}
      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Đang tải dữ liệu...</p>
        </div>
      ) : (
        <>
          {/* Top stats row */}
          <div className="stats-grid">
            <Row className="g-4">
              <Col md={3} sm={6} xs={12}>
                <Card className="stat-card">
                  <Card.Body className="stat-card-body">
                    <div className="icon-container" style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}>
                      <i className="fas fa-user-graduate"></i>
                    </div>
                    <div className="stat-content">
                      <div className="stat-label">Sinh viên đi lâm sàng</div>
                      <div className="stat-value">{stats.totalStudents}</div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3} sm={6} xs={12}>
                <Card className="stat-card">
                  <Card.Body className="stat-card-body">
                    <div className="icon-container" style={{ background: 'linear-gradient(135deg, #f093fb, #f5576c)' }}>
                      <i className="fas fa-user-clock"></i>
                    </div>
                    <div className="stat-content">
                      <div className="stat-label">Sinh viên đi trễ</div>
                      <div className="stat-value">{stats.lateStudentsCount}</div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3} sm={6} xs={12}>
                <Card className="stat-card">
                  <Card.Body className="stat-card-body">
                    <div className="icon-container" style={{ background: 'linear-gradient(135deg, #ff9a9e, #fecfef)' }}>
                      <i className="fas fa-user-slash"></i>
                    </div>
                    <div className="stat-content">
                      <div className="stat-label">Sinh viên vắng mặt</div>
                      <div className="stat-value">{stats.absentStudentsCount}</div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={3} sm={6} xs={12}>
                <Card className="stat-card">
                  <Card.Body className="stat-card-body">
                    <div className="icon-container" style={{ background: 'linear-gradient(135deg, #a8edea, #fed6e3)' }}>
                      <i className="fas fa-chalkboard-teacher"></i>
                    </div>
                    <div className="stat-content">
                      <div className="stat-label">Tổng số buổi học</div>
                      <div className="stat-value">{stats.totalSessions}</div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </div>

          {/* Charts row */}
          <Row className="mb-4 g-4">
            <Col md={6} xs={12}>
              <div className="chart-section">
                <div className="chart-title">Tổng quan điểm danh</div>
                <PieChart
                  data={attendanceData}
                  labels={attendanceLabels}
                  colors={attendanceColors}
                  height={220}
                />
              </div>
            </Col>
            <Col md={6} xs={12}>
              <div className="chart-section">
                <div className="chart-title">Sinh viên đi trễ nhiều lần</div>
                <BarChart
                  data={lateStudentsData}
                  labels={lateStudentsLabels}
                  yAxisLabel="Số lần đi trễ"
                  colors={['#e74a3b']}
                  height={220}
                />
              </div>
            </Col>
          </Row>

          {/* Lists row */}
          <Row className="mb-4 g-4">
            <Col md={6} xs={12}>
              <StatisticsList
                title="Tất cả sinh viên đi trễ"
                icon="fa-user-clock"
                data={stats.lateStudents}
                bgColor="warning"
                detailPath="/superadmin/stats/late"
                type="late"
                maxItems={5}
              />
            </Col>
            <Col md={6} xs={12}>
              <StatisticsList
                title="Sinh viên thiếu khung giờ điểm danh"
                icon="fa-exclamation-triangle"
                data={stats.missingTimeSlotStudents}
                bgColor="warning"
                detailPath="/superadmin/stats/missingTimeSlot"
                type="missingTimeSlot"
                maxItems={5}
              />
            </Col>
          </Row>

          {/* Second lists row */}
          <Row className="mb-4 g-4">
            <Col md={6} xs={12}>
              <StatisticsList
                title="Tất cả Sinh viên vắng mặt"
                icon="fa-user-slash"
                data={stats.absentStudents}
                bgColor="danger"
                detailPath="/superadmin/stats/absent"
                type="absent"
                maxItems={5}
              />
            </Col>
            <Col md={6} xs={12}>
              <StatisticsList
                title="Yêu cầu vắng học"
                icon="fa-id-badge"
                data={stats.incompleteBadgeStudents}
                bgColor="danger"
                detailPath="/superadmin/stats/incompleteBadge"
                type="incompleteBadge"
                maxItems={5}
              />
            </Col>
          </Row>

          {/* Account info card */}
          <div className="account-info-section">
            <Row>
              <Col md={6}>
                <div className="account-title">Thông tin tài khoản</div>
                <div className="account-info-item">
                  <span className="account-info-label">Tên:</span> {currentUser?.full_name || currentUser?.name}
                </div>
                <div className="account-info-item">
                  <span className="account-info-label">Email:</span> {currentUser?.email}
                </div>
                <div className="account-info-item">
                  <span className="account-info-label">Vai trò:</span> {currentUser?.role === 'superadmin' ? 'Quản trị viên cấp cao' : ''}
                </div>
              </Col>
              <Col md={6} className="text-md-end">
                <Button as={Link} to="/profile" variant="outline-primary" style={{ borderRadius: 12 }}>
                  <i className="fas fa-user-edit me-2"></i>Cập nhật thông tin
                </Button>
              </Col>
            </Row>
          </div>
        </>
      )}
    </div>
  );
};

export default SuperAdminDashboard;