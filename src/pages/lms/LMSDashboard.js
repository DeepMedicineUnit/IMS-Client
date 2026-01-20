import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, Row, Col, ProgressBar, Badge, Alert, Spinner } from 'react-bootstrap';
import axios from 'axios';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/dashboard.css';
import '../../styles/user.css';

const LMSDashboard = () => {
  usePageTitle('Bảng điều khiển LMS');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total_courses: 0,
    active_students: 0,
    upcoming_exams: 0,
    total_questions: 0,
    completion_rate: 0,
    average_score: 0
  });
  const [recentActivities, setRecentActivities] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [upcomingExams, setUpcomingExams] = useState([]);
  const [alert, setAlert] = useState({ show: false, message: '', variant: '' });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      // Fetch analytics overview
      const analyticsResponse = await axios.get(`${API_BASE_URL}/lms/analytics/overview`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (analyticsResponse.data.success) {
        setStats(analyticsResponse.data.data);
      }

      // Fetch upcoming exams
      try {
        const examsResponse = await axios.get(`${API_BASE_URL}/lms/exams?status=upcoming&limit=5`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (examsResponse.data.success) {
          setUpcomingExams(examsResponse.data.data || []);
        }
      } catch (error) {
        console.error('Error fetching exams:', error);
      }

      // Fetch notifications
      try {
        const notifResponse = await axios.get(`${API_BASE_URL}/lms/notifications?limit=5`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (notifResponse.data.success) {
          setNotifications(notifResponse.data.data || []);
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }

      // Mock recent activities (replace with real API later)
      setRecentActivities([
        { type: 'exam', message: '45 học viên đã hoàn thành kỳ thi Tim mạch', time: '5 phút trước', icon: 'file-alt', color: 'primary' },
        { type: 'enrollment', message: '12 học viên mới đăng ký khóa OSCE', time: '15 phút trước', icon: 'user-plus', color: 'success' },
        { type: 'grade', message: 'Giảng viên đã chấm điểm cho 28 bài tập', time: '30 phút trước', icon: 'star', color: 'warning' },
        { type: 'forum', message: '8 bài viết mới trong diễn đàn Ngoại khoa', time: '1 giờ trước', icon: 'comments', color: 'info' }
      ]);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Use mock data on error
      setStats({
        total_courses: 24,
        active_students: 820,
        upcoming_exams: 5,
        total_questions: 5240,
        completion_rate: 72.5,
        average_score: 78.3
      });
    } finally {
      setLoading(false);
    }
  };

  const kpis = [
    {
      icon: 'fas fa-book',
      label: 'Khóa học đang mở',
      value: stats.total_courses,
      gradient: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
      link: '/lms/courses'
    },
    {
      icon: 'fas fa-clipboard-check',
      label: 'Kỳ thi sắp diễn ra',
      value: stats.upcoming_exams,
      gradient: 'linear-gradient(135deg, #f59e0b, #f97316)',
      link: '/lms/exams'
    },
    {
      icon: 'fas fa-database',
      label: 'Câu hỏi trong ngân hàng',
      value: stats.total_questions.toLocaleString(),
      gradient: 'linear-gradient(135deg, #a78bfa, #7c3aed)',
      link: '/lms/question-bank'
    }
  ];

  const shortcuts = [
    { to: '/lms/courses', icon: 'fas fa-book', text: 'Khóa học & Nội dung', color: '#3b82f6' },
    { to: '/lms/live-class', icon: 'fas fa-video', text: 'Lớp học trực tuyến', color: '#ef4444' },
    { to: '/lms/exams', icon: 'fas fa-clipboard-check', text: 'Kỳ thi', color: '#f59e0b' },
    { to: '/lms/question-bank', icon: 'fas fa-database', text: 'Ngân hàng câu hỏi', color: '#8b5cf6' },
    { to: '/lms/grades', icon: 'fas fa-chart-line', text: 'Điểm & Báo cáo', color: '#ec4899' },
    { to: '/lms/integrations', icon: 'fas fa-plug', text: 'Tích hợp', color: '#14b8a6' },
    { to: '/lms/support-analytics', icon: 'fas fa-headset', text: 'Hỗ trợ & Analytics', color: '#6366f1' }
  ];

  if (loading) {
    return (
      <div className="admin-dashboard-container">
        <div className="text-center p-5">
          <Spinner animation="border" role="status" className="text-primary">
            <span className="visually-hidden">Đang tải...</span>
          </Spinner>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-container">
      <div className="dashboard-header">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h2 className="dashboard-title">LMS Dashboard</h2>
            <div className="text-muted">Tổng quan khóa học, học viên, kỳ thi và ngân hàng câu hỏi</div>
          </div>
          <div>
            <button className="btn btn-outline-primary" onClick={fetchDashboardData}>
              <i className="fas fa-sync-alt me-2"></i>Làm mới
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="dashboard-stats-grid">
        <Row className="g-4">
          {kpis.map((kpi, idx) => (
            <Col md={3} sm={6} key={idx}>
              <Link to={kpi.link} className="text-decoration-none">
                <Card className="stat-card h-100" style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                  <Card.Body>
                    <div className="d-flex align-items-center">
                      <div className="icon-container" style={{ background: kpi.gradient, minWidth: '60px', height: '60px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className={`${kpi.icon} text-white fa-2x`}></i>
                      </div>
                      <div className="ms-3 flex-grow-1">
                        <div className="stat-label text-muted small">{kpi.label}</div>
                        <div className="stat-value" style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1f2937' }}>{kpi.value}</div>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </Link>
            </Col>
          ))}
        </Row>
      </div>

      {/* Performance Metrics */}
      <Row className="g-4 mt-2">
        <Col md={6}>
          <Card className="chart-card h-100">
            <Card.Body>
              <h5 className="mb-3">Tỷ lệ Hoàn thành</h5>
              <div className="text-center my-4">
                <div style={{ position: 'relative', width: '200px', height: '200px', margin: '0 auto' }}>
                  <svg width="200" height="200" viewBox="0 0 200 200">
                    <circle cx="100" cy="100" r="90" fill="none" stroke="#e9ecef" strokeWidth="20" />
                    <circle
                      cx="100"
                      cy="100"
                      r="90"
                      fill="none"
                      stroke="#28a745"
                      strokeWidth="20"
                      strokeDasharray={`${stats.completion_rate * 5.65} 565`}
                      transform="rotate(-90 100 100)"
                    />
                    <text x="100" y="100" textAnchor="middle" dy=".3em" fontSize="36" fontWeight="bold" fill="#28a745">
                      {stats.completion_rate.toFixed(1)}%
                    </text>
                  </svg>
                </div>
              </div>
              <p className="text-center text-muted mb-0">Tỷ lệ học viên hoàn thành khóa học</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="chart-card h-100">
            <Card.Body>
              <h5 className="mb-3">Điểm Trung bình</h5>
              <div className="text-center my-4">
                <div style={{ fontSize: '4rem', fontWeight: 'bold', color: '#0d6efd' }}>
                  {stats.average_score.toFixed(1)}
                </div>
                <div style={{ fontSize: '1.5rem', color: '#6c757d' }}>/ 10</div>
              </div>
              <ProgressBar now={stats.average_score * 10} variant="info" style={{ height: '10px' }} />
              <p className="text-center text-muted mt-3 mb-0">Điểm trung bình của tất cả học viên</p>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Main Content Row */}
      <Row className="g-4 mt-1">
        <Col lg={8}>
          <Card className="chart-card">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="mb-0">Hoạt động Gần đây</h5>
                <Link to="/lms/support-analytics" className="text-decoration-none">
                  <small>Xem tất cả <i className="fas fa-arrow-right"></i></small>
                </Link>
              </div>
              <div className="activity-timeline">
                {recentActivities.map((activity, index) => (
                  <div key={index} className="activity-item mb-3 p-3 border-start border-4"
                    style={{ borderColor: `var(--bs-${activity.color})` }}>
                    <div className="d-flex align-items-start">
                      <div className={`bg-${activity.color} text-white rounded-circle p-2 me-3`} style={{ minWidth: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className={`fas fa-${activity.icon}`}></i>
                      </div>
                      <div className="flex-grow-1">
                        <p className="mb-1">{activity.message}</p>
                        <small className="text-muted">
                          <i className="fas fa-clock me-1"></i>{activity.time}
                        </small>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={4}>
          <Card className="chart-card">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="mb-0">Kỳ thi Sắp tới</h5>
                <Link to="/lms/exams" className="text-decoration-none">
                  <small>Xem tất cả <i className="fas fa-arrow-right"></i></small>
                </Link>
              </div>
              {upcomingExams.length > 0 ? (
                <div>
                  {upcomingExams.slice(0, 3).map((exam) => (
                    <div key={exam.exam_id} className="mb-3 p-2 border rounded">
                      <div className="d-flex justify-content-between align-items-start mb-1">
                        <strong className="small">{exam.exam_title}</strong>
                        <Badge bg="warning" className="ms-2">Sắp diễn ra</Badge>
                      </div>
                      <small className="text-muted">
                        {exam.scheduled_start ? new Date(exam.scheduled_start).toLocaleDateString('vi-VN') : 'Chưa có lịch'}
                      </small>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted py-3">
                  <i className="fas fa-clipboard-check fa-2x mb-2"></i>
                  <p className="mb-0">Không có kỳ thi sắp tới</p>
                </div>
              )}
            </Card.Body>
          </Card>

          <Card className="chart-card mt-3">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="mb-0">Thông báo</h5>
                <Link to="/lms/notifications" className="text-decoration-none">
                  <small>Xem tất cả <i className="fas fa-arrow-right"></i></small>
                </Link>
              </div>
              {notifications.length > 0 ? (
                <div>
                  {notifications.slice(0, 3).map((notif) => (
                    <div key={notif.notification_id} className="mb-2 p-2 border rounded">
                      <div className="d-flex align-items-start">
                        <i className={`fas fa-${notif.notification_type === 'exam' ? 'file-alt' : 'bell'} me-2 mt-1 text-primary`}></i>
                        <div className="flex-grow-1">
                          <strong className="small">{notif.notification_title}</strong>
                          <p className="mb-0 small text-muted">{notif.notification_message}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted py-3">
                  <i className="fas fa-bell fa-2x mb-2"></i>
                  <p className="mb-0">Không có thông báo mới</p>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Quick Access */}
      <Card className="mt-4">
        <Card.Body>
          <h5 className="mb-3">Đi đến nhanh</h5>
          <Row className="g-3">
            {shortcuts.map((shortcut, idx) => (
              <Col sm={6} md={3} key={idx}>
                <Link to={shortcut.to} className="text-decoration-none">
                  <Card className="h-100" style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-3px)';
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}>
                    <Card.Body className="d-flex align-items-center">
                      <div className="icon-container me-3" style={{
                        background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)',
                        color: shortcut.color,
                        minWidth: '50px',
                        height: '50px',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <i className={`${shortcut.icon} fa-lg`}></i>
                      </div>
                      <div className="stat-label" style={{ color: '#374151', fontWeight: '500' }}>{shortcut.text}</div>
                    </Card.Body>
                  </Card>
                </Link>
              </Col>
            ))}
          </Row>
        </Card.Body>
      </Card>
    </div>
  );
};

export default LMSDashboard;
