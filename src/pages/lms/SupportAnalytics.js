import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Table, Badge, Button, Form, Tab, Tabs, Alert, ProgressBar } from 'react-bootstrap';
import axios from 'axios';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/dashboard.css';
import '../../styles/user.css';

const SupportAnalytics = () => {
  usePageTitle('Phân tích hỗ trợ');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [alert, setAlert] = useState({ show: false, message: '', variant: '' });
  const [dateRange, setDateRange] = useState({
    start_date: '',
    end_date: ''
  });

  // Overview Statistics
  const [overviewStats, setOverviewStats] = useState({
    total_courses: 24,
    active_students: 820,
    upcoming_exams: 5,
    total_questions: 5240,
    completion_rate: 72.5,
    average_score: 78.3,
    total_enrollments: 1250,
    active_instructors: 45
  });

  // Engagement Data
  const [engagementData, setEngagementData] = useState({
    daily_active_users: [120, 145, 130, 165, 142, 158, 175],
    forum_posts: 45,
    chat_messages: 320,
    avg_session_duration: '32 phút',
    bounce_rate: '15.3%'
  });

  // Grade Distribution
  const [gradeDistribution, setGradeDistribution] = useState([
    { grade: 'A', count: 250, percentage: 30 },
    { grade: 'B', count: 280, percentage: 34 },
    { grade: 'C', count: 190, percentage: 23 },
    { grade: 'D', count: 80, percentage: 10 },
    { grade: 'F', count: 25, percentage: 3 }
  ]);

  // Top Courses
  const [topCourses, setTopCourses] = useState([
    { course_name: 'Tim mạch lâm sàng', enrollments: 245, avg_score: 8.2, completion_rate: 85 },
    { course_name: 'OSCE Kỹ năng', enrollments: 198, avg_score: 7.9, completion_rate: 78 },
    { course_name: 'Ngoại khoa tổng quát', enrollments: 156, avg_score: 8.5, completion_rate: 92 },
    { course_name: 'Nội khoa', enrollments: 142, avg_score: 7.6, completion_rate: 73 },
    { course_name: 'Sản phụ khoa', enrollments: 128, avg_score: 8.0, completion_rate: 80 }
  ]);

  // Recent Activities
  const [recentActivities, setRecentActivities] = useState([
    { type: 'exam', message: '45 học viên đã hoàn thành kỳ thi Tim mạch', time: '5 phút trước' },
    { type: 'enrollment', message: '12 học viên mới đăng ký khóa OSCE', time: '15 phút trước' },
    { type: 'grade', message: 'Giảng viên đã chấm điểm cho 28 bài tập', time: '30 phút trước' },
    { type: 'forum', message: '8 bài viết mới trong diễn đàn Ngoại khoa', time: '1 giờ trước' },
    { type: 'resource', message: 'Tài liệu mới được upload cho khóa Nội khoa', time: '2 giờ trước' }
  ]);

  useEffect(() => {
    fetchOverviewData();
  }, [dateRange]);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  const fetchOverviewData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // In production, fetch from real API
      const response = await axios.get(`${API_BASE_URL}/lms/analytics/overview`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Mock data is already set in state
      // setOverviewStats(response.data.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      // Using mock data on error
    } finally {
      setLoading(false);
    }
  };

  const handleExportReport = async (format) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE_URL}/lms/analytics/export`,
        { format, ...dateRange },
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `analytics_report_${Date.now()}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      showAlert(`Export ${format.toUpperCase()} thành công`, 'success');
    } catch (error) {
      console.error('Error exporting report:', error);
      showAlert('Lỗi khi export báo cáo', 'danger');
    }
  };

  const showAlert = (message, variant) => {
    setAlert({ show: true, message, variant });
    setTimeout(() => setAlert({ show: false, message: '', variant: '' }), 5000);
  };

  const getActivityIcon = (type) => {
    const icons = {
      exam: 'file-alt',
      enrollment: 'user-plus',
      grade: 'star',
      forum: 'comments',
      resource: 'upload'
    };
    return icons[type] || 'info-circle';
  };

  const getActivityColor = (type) => {
    const colors = {
      exam: 'primary',
      enrollment: 'success',
      grade: 'warning',
      forum: 'info',
      resource: 'secondary'
    };
    return colors[type] || 'secondary';
  };

  return (
    <div className="admin-dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1>Analytics & Báo cáo</h1>
          <p className="dashboard-subtitle">Phân tích dữ liệu, thống kê, báo cáo chi tiết về hệ thống LMS</p>
        </div>
        <div className="header-actions">
          <Button variant="outline-success" className="me-2" onClick={() => handleExportReport('excel')}>
            <i className="fas fa-file-excel me-2"></i>Export Excel
          </Button>
          <Button variant="outline-danger" onClick={() => handleExportReport('pdf')}>
            <i className="fas fa-file-pdf me-2"></i>Export PDF
          </Button>
        </div>
      </div>

      {/* Alert */}
      {alert.show && (
        <Alert variant={alert.variant} dismissible onClose={() => setAlert({ ...alert, show: false })}>
          {alert.message}
        </Alert>
      )}

      {/* Date Range Filter */}
      <Card className="mb-4">
        <Card.Body>
          <Row className="align-items-end">
            <Col md={4}>
              <Form.Group>
                <Form.Label>Từ ngày</Form.Label>
                <Form.Control
                  type="date"
                  value={dateRange.start_date}
                  onChange={(e) => setDateRange({ ...dateRange, start_date: e.target.value })}
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>Đến ngày</Form.Label>
                <Form.Control
                  type="date"
                  value={dateRange.end_date}
                  onChange={(e) => setDateRange({ ...dateRange, end_date: e.target.value })}
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Button variant="primary" onClick={fetchOverviewData}>
                <i className="fas fa-search me-2"></i>Áp dụng
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Tabs */}
      <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="mb-4">
        {/* Overview Tab */}
        <Tab eventKey="overview" title={<span><i className="fas fa-chart-pie me-2"></i>Tổng quan</span>}>
          {/* KPI Cards */}
          <Row className="dashboard-stats-grid mb-4">
            <Col md={3}>
              <Card className="stat-card" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                <Card.Body>
                  <div className="d-flex align-items-center">
                    <div className="icon-box">
                      <i className="fas fa-book fa-2x text-white"></i>
                    </div>
                    <div className="ms-3 text-white">
                      <div className="stat-value">{overviewStats.total_courses}</div>
                      <div className="stat-label">Khóa học</div>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="stat-card" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
                <Card.Body>
                  <div className="d-flex align-items-center">
                    <div className="icon-box">
                      <i className="fas fa-users fa-2x text-white"></i>
                    </div>
                    <div className="ms-3 text-white">
                      <div className="stat-value">{overviewStats.active_students}</div>
                      <div className="stat-label">Học viên hoạt động</div>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="stat-card" style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
                <Card.Body>
                  <div className="d-flex align-items-center">
                    <div className="icon-box">
                      <i className="fas fa-file-alt fa-2x text-white"></i>
                    </div>
                    <div className="ms-3 text-white">
                      <div className="stat-value">{overviewStats.upcoming_exams}</div>
                      <div className="stat-label">Kỳ thi sắp tới</div>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="stat-card" style={{ background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' }}>
                <Card.Body>
                  <div className="d-flex align-items-center">
                    <div className="icon-box">
                      <i className="fas fa-question-circle fa-2x text-white"></i>
                    </div>
                    <div className="ms-3 text-white">
                      <div className="stat-value">{overviewStats.total_questions}</div>
                      <div className="stat-label">Câu hỏi</div>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Performance Metrics */}
          <Row className="mb-4">
            <Col md={6}>
              <Card className="chart-card">
                <Card.Body>
                  <h5>Tỷ lệ Hoàn thành</h5>
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
                          strokeDasharray={`${overviewStats.completion_rate * 5.65} 565`}
                          transform="rotate(-90 100 100)"
                        />
                        <text x="100" y="100" textAnchor="middle" dy=".3em" fontSize="36" fontWeight="bold" fill="#28a745">
                          {overviewStats.completion_rate}%
                        </text>
                      </svg>
                    </div>
                  </div>
                  <p className="text-center text-muted">Tỷ lệ học viên hoàn thành khóa học</p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6}>
              <Card className="chart-card">
                <Card.Body>
                  <h5>Điểm Trung bình</h5>
                  <div className="text-center my-4">
                    <div style={{ fontSize: '4rem', fontWeight: 'bold', color: '#0d6efd' }}>
                      {overviewStats.average_score}
                    </div>
                    <div style={{ fontSize: '1.5rem', color: '#6c757d' }}>/ 10</div>
                  </div>
                  <ProgressBar now={overviewStats.average_score * 10} variant="info" style={{ height: '10px' }} />
                  <p className="text-center text-muted mt-3">Điểm trung bình của tất cả học viên</p>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Grade Distribution */}
          <Card className="chart-card mb-4">
            <Card.Body>
              <h5>Phân bố Điểm</h5>
              <Table striped bordered hover className="mt-3">
                <thead>
                  <tr>
                    <th>Xếp loại</th>
                    <th>Số lượng</th>
                    <th>Tỷ lệ</th>
                    <th>Biểu đồ</th>
                  </tr>
                </thead>
                <tbody>
                  {gradeDistribution.map((item) => (
                    <tr key={item.grade}>
                      <td>
                        <Badge bg={
                          item.grade === 'A' ? 'success' :
                          item.grade === 'B' ? 'info' :
                          item.grade === 'C' ? 'warning' :
                          item.grade === 'D' ? 'secondary' : 'danger'
                        } style={{ fontSize: '1rem' }}>
                          {item.grade}
                        </Badge>
                      </td>
                      <td><strong>{item.count}</strong></td>
                      <td>{item.percentage}%</td>
                      <td>
                        <ProgressBar
                          now={item.percentage}
                          variant={
                            item.grade === 'A' ? 'success' :
                            item.grade === 'B' ? 'info' :
                            item.grade === 'C' ? 'warning' :
                            item.grade === 'D' ? 'secondary' : 'danger'
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Tab>

        {/* Engagement Tab */}
        <Tab eventKey="engagement" title={<span><i className="fas fa-chart-line me-2"></i>Tương tác</span>}>
          <Row>
            <Col md={3}>
              <Card className="stat-card mb-3" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                <Card.Body>
                  <div className="text-white">
                    <div className="stat-label mb-2">Forum Posts</div>
                    <div className="stat-value">{engagementData.forum_posts}</div>
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="stat-card mb-3" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
                <Card.Body>
                  <div className="text-white">
                    <div className="stat-label mb-2">Chat Messages</div>
                    <div className="stat-value">{engagementData.chat_messages}</div>
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="stat-card mb-3" style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
                <Card.Body>
                  <div className="text-white">
                    <div className="stat-label mb-2">Thời gian TB / Session</div>
                    <div className="stat-value">{engagementData.avg_session_duration}</div>
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="stat-card mb-3" style={{ background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' }}>
                <Card.Body>
                  <div className="text-white">
                    <div className="stat-label mb-2">Bounce Rate</div>
                    <div className="stat-value">{engagementData.bounce_rate}</div>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <Card className="chart-card">
            <Card.Body>
              <h5>Người dùng Hoạt động Hàng ngày (7 ngày qua)</h5>
              <div className="mt-4">
                {engagementData.daily_active_users.map((count, index) => (
                  <div key={index} className="mb-3">
                    <div className="d-flex justify-content-between mb-1">
                      <span>Ngày {index + 1}</span>
                      <strong>{count} users</strong>
                    </div>
                    <ProgressBar now={(count / 200) * 100} variant="info" />
                  </div>
                ))}
              </div>
            </Card.Body>
          </Card>
        </Tab>

        {/* Top Courses Tab */}
        <Tab eventKey="courses" title={<span><i className="fas fa-trophy me-2"></i>Top Khóa học</span>}>
          <Card className="chart-card">
            <Card.Body>
              <h5>Top 5 Khóa học Phổ biến</h5>
              <Table striped hover className="mt-3">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Tên khóa học</th>
                    <th>Đăng ký</th>
                    <th>Điểm TB</th>
                    <th>Tỷ lệ Hoàn thành</th>
                  </tr>
                </thead>
                <tbody>
                  {topCourses.map((course, index) => (
                    <tr key={index}>
                      <td>
                        <Badge bg={index < 3 ? 'warning' : 'secondary'}>#{index + 1}</Badge>
                      </td>
                      <td><strong>{course.course_name}</strong></td>
                      <td>{course.enrollments}</td>
                      <td>
                        <Badge bg="success">{course.avg_score}</Badge>
                      </td>
                      <td>
                        <ProgressBar now={course.completion_rate} label={`${course.completion_rate}%`} variant="info" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Tab>

        {/* Activities Tab */}
        <Tab eventKey="activities" title={<span><i className="fas fa-history me-2"></i>Hoạt động</span>}>
          <Card className="chart-card">
            <Card.Body>
              <h5>Hoạt động Gần đây</h5>
              <div className="activity-timeline mt-4">
                {recentActivities.map((activity, index) => (
                  <div key={index} className="activity-item mb-3 p-3 border-start border-4" style={{ borderColor: `var(--bs-${getActivityColor(activity.type)})` }}>
                    <div className="d-flex align-items-start">
                      <div className={`activity-icon bg-${getActivityColor(activity.type)} text-white rounded-circle p-2 me-3`}>
                        <i className={`fas fa-${getActivityIcon(activity.type)}`}></i>
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
        </Tab>
      </Tabs>
    </div>
  );
};

export default SupportAnalytics;
