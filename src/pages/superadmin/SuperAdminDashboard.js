import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Button, Spinner, Alert } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import StatisticsCard from '../../components/StatisticsCard';
import StatisticsList from '../../components/StatisticsList';
import PieChart from '../../components/charts/PieChart';
import BarChart from '../../components/charts/BarChart';
import LineChart from '../../components/charts/LineChart';

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

    // Set up auto-refresh every 30 seconds, but only when tab is visible
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchDashboardStats(false);
      }
    }, 30000);

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
    <div style={{ fontFamily: 'Inter, Arial, sans-serif', background: '#fffff', minHeight: '100vh', paddingBottom: 32 }}>
      <style>{`
        .stat-card {
          border-radius: 18px !important;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
          transition: box-shadow 0.2s, transform 0.2s;
          border: none;
        }
        .stat-card:hover {
          box-shadow: 0 8px 32px rgba(80,120,200,0.18);
          transform: translateY(-2px) scale(1.01);
        }
        .icon-box {
          border-radius: 12px;
          width: 56px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          box-shadow: 0 2px 8px rgba(80,120,200,0.08);
        }
        .dashboard-section {
          background: #fff;
          border-radius: 50px;
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.11);
          padding: 24px 20px 20px 20px;
          margin-bottom: 32px;
        }
        .dashboard-title {
          font-size: 2rem;
          font-weight: 700;
          color: #2e3a59;
          margin-bottom: 24px;
        }
        .dashboard-header {
          margin-bottom: 32px;
        }
        .auto-refresh-indicator {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: #28a745;
          color: white;
          padding: 8px 12px;
          border-radius: 20px;
          font-size: 12px;
          z-index: 1000;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.7; }
          100% { opacity: 1; }
        }
      `}</style>
      
      {/* Auto-refresh indicator */}
      <div className="auto-refresh-indicator">
        <i className={`fas ${isRefreshing ? 'fa-sync-alt fa-spin' : 'fa-sync-alt'} me-1`}></i>
        {isRefreshing ? 'Đang cập nhật...' : 'Tự động cập nhật'}
        <Button 
          variant="link" 
          size="sm" 
          className="text-white p-0 ms-2"
          onClick={() => window.location.reload()}
          style={{ textDecoration: 'none' }}
        >
          <i className="fas fa-refresh"></i>
        </Button>
      </div>

      <div className="dashboard-header">
        <div className="d-flex justify-content-between align-items-center">
          <h2 className="dashboard-title">Bảng điều khiển Quản trị viên cấp cao</h2>
        </div>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Đang tải...</span>
          </Spinner>
        </div>
      ) : (
        <>
          {/* Top stats row */}
          <Row className="mb-4 g-4">
            <Col md={3} sm={6} xs={12}>
              <Card className="stat-card">
                <Card.Body className="d-flex align-items-center">
                  <div className="icon-box bg-primary text-white me-3">
                    <i className="fas fa-user-graduate"></i>
                  </div>
                  <div>
                    <div className="text-muted small">Tổng số sinh viên đi lâm sàng</div>
                    <div className="fw-bold" style={{ fontSize: 28 }}>{stats.totalStudents}</div>
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3} sm={6} xs={12}>
              <Card className="stat-card">
                <Card.Body className="d-flex align-items-center">
                  <div className="icon-box bg-warning text-white me-3">
                    <i className="fas fa-user-clock"></i>
                  </div>
                  <div>
                    <div className="text-muted small">Sinh viên đi trễ</div>
                    <div className="fw-bold" style={{ fontSize: 28 }}>{stats.lateStudentsCount}</div>
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3} sm={6} xs={12}>
              <Card className="stat-card">
                <Card.Body className="d-flex align-items-center">
                  <div className="icon-box bg-danger text-white me-3">
                    <i className="fas fa-user-slash"></i>
                  </div>
                  <div>
                    <div className="text-muted small">Sinh viên vắng mặt</div>
                    <div className="fw-bold" style={{ fontSize: 28 }}>{stats.absentStudentsCount}</div>
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3} sm={6} xs={12}>
              <Card className="stat-card">
                <Card.Body className="d-flex align-items-center">
                  <div className="icon-box bg-info text-white me-3">
                    <i className="fas fa-chalkboard-teacher"></i>
                  </div>
                  <div>
                    <div className="text-muted small">Tổng số buổi học</div>
                    <div className="fw-bold" style={{ fontSize: 28 }}>{stats.totalSessions}</div>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Charts row */}
          <Row className="mb-4 g-4">
            <Col md={6} xs={12}>
              <div className="dashboard-section">
                <div className="fw-bold mb-3" style={{ color: '#4e73df' }}>Tổng quan điểm danh</div>
                <PieChart
                  data={attendanceData}
                  labels={attendanceLabels}
                  colors={attendanceColors}
                  height={220}
                />
              </div>
            </Col>
            <Col md={6} xs={12}>
              <div className="dashboard-section">
                <div className="fw-bold mb-3" style={{ color: '#e74a3b' }}>Sinh viên đi trễ nhiều lần</div>
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
              <div className="dashboard-section">
                <StatisticsList
                  title="Sinh viên đi trễ gần đây"
                  icon="fa-user-clock"
                  data={stats.lateStudents}
                  bgColor="warning"
                  detailPath="/superadmin/stats/late"
                  type="late"
                  maxItems={5}
                />
              </div>
            </Col>
            <Col md={6} xs={12}>
              <div className="dashboard-section">
                <StatisticsList
                  title="Sinh viên thiếu khung giờ điểm danh"
                  icon="fa-exclamation-triangle"
                  data={stats.missingTimeSlotStudents}
                  bgColor="warning"
                  detailPath="/superadmin/stats/missingTimeSlot"
                  type="missingTimeSlot"
                  maxItems={5}
                />
              </div>
            </Col>
          </Row>

          {/* Second lists row */}
          <Row className="mb-4 g-4">
            <Col md={6} xs={12}>
              <div className="dashboard-section">
                <StatisticsList
                  title="Sinh viên vắng mặt gần đây"
                  icon="fa-user-slash"
                  data={stats.absentStudents}
                  bgColor="danger"
                  detailPath="/superadmin/stats/absent"
                  type="absent"
                  maxItems={5}
                />
              </div>
            </Col>
            <Col md={6} xs={12}>
              <div className="dashboard-section">
                <StatisticsList
                  title="Sinh viên không có badge Đầy đủ"
                  icon="fa-id-badge"
                  data={stats.incompleteBadgeStudents}
                  bgColor="danger"
                  detailPath="/superadmin/stats/incompleteBadge"
                  type="incompleteBadge"
                  maxItems={5}
                />
              </div>
            </Col>
          </Row>

          {/* Account info card */}
          <div className="dashboard-section">
            <Row>
              <Col md={6}>
                <div className="fw-bold mb-2">Thông tin tài khoản</div>
                <p><strong>Tên:</strong> {currentUser?.full_name || currentUser?.name}</p>
                <p><strong>Email:</strong> {currentUser?.email}</p>
                <p><strong>Vai trò:</strong> {currentUser?.role === 'superadmin' ? 'Quản trị viên cấp cao' : ''}</p>
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