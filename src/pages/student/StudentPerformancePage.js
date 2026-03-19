import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Spinner, Alert, ProgressBar, Badge } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import usePageTitle from '../../hooks/usePageTitle';
import { Calendar, Clock, AlertTriangle, CheckCircle, TrendingUp, Timer } from 'lucide-react';
import '../../styles/user.css';

ChartJS.register(ArcElement, Tooltip, Legend);

const StudentPerformancePage = () => {
  usePageTitle('Hiệu suất - PCTU IMS');
  const { api } = useAuth();
  const { showAlert } = useAlert();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  // Auto-refresh state
  const [lastStatsHash, setLastStatsHash] = useState(null);
  const pollingIntervalRef = React.useRef(null);

  // Helper function to generate hash of data for comparison
  const generateDataHash = (data) => {
    if (!data) return '';
    try {
      return JSON.stringify(data).split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0).toString();
    } catch {
      return '';
    }
  };

  // Load performance stats
  const loadPerformanceStats = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      
      const response = await api.get('/users/my/performance-stats');
      
      if (response.data.success) {
        setStats(response.data.data);
        const hash = generateDataHash(response.data.data);
        setLastStatsHash(hash);
        setError(null);
      }
    } catch (err) {
      console.error('Error loading performance stats:', err);
      if (!silent) {
        setError('Không thể tải dữ liệu hiệu suất');
        showAlert('Không thể tải dữ liệu hiệu suất', 'danger');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadPerformanceStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh polling every 10 seconds
  useEffect(() => {
    const startPolling = async () => {
      pollingIntervalRef.current = setInterval(async () => {
        try {
          const response = await api.get('/users/my/performance-stats');
          if (response.data.success) {
            const newHash = generateDataHash(response.data.data);
            if (newHash !== lastStatsHash) {
              console.log('[Auto-refresh] Performance stats updated');
              setStats(response.data.data);
              setLastStatsHash(newHash);
            }
          }
        } catch (err) {
          console.debug('[Auto-refresh] Stats polling failed:', err.message);
        }
      }, 10000); // Poll every 10 seconds
    };

    startPolling();

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastStatsHash]);

  // Format seconds to readable time
  const formatSeconds = (seconds) => {
    if (!seconds || seconds === 0) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    if (mins > 0) {
      return `${mins}p ${secs}s`;
    }
    return `${secs}s`;
  };

  // Get attendance breakdown chart data
  const getAttendanceBreakdownChart = () => {
    if (!stats?.attendance_breakdown) return null;

    const breakdown = stats.attendance_breakdown;
    const labels = [];
    const data = [];
    const colors = [];

    const typeConfig = [
      { key: 'before', label: 'Điểm danh đúng giờ', color: '#28a745' },
      { key: 'during', label: 'Điểm danh trong giờ', color: '#17a2b8' },
      { key: 'after', label: 'Điểm danh sau giờ', color: '#ffc107' },
      { key: 'early', label: 'Điểm danh sớm', color: '#20c997' },
      { key: 'late', label: 'Đi muộn', color: '#fd7e14' },
      { key: 'late_before', label: 'Đi muộn (trước giờ)', color: '#e83e8c' },
      { key: 'late_leave', label: 'Ra về sớm', color: '#6f42c1' },
      { key: 'absent', label: 'Vắng không phép', color: '#dc3545' },
      { key: 'absent_perm', label: 'Vắng có phép', color: '#6c757d' }
    ];

    typeConfig.forEach(config => {
      if (breakdown[config.key] && breakdown[config.key] > 0) {
        labels.push(config.label);
        data.push(breakdown[config.key]);
        colors.push(config.color);
      }
    });

    if (data.length === 0) return null;

    return {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: '#fff'
      }]
    };
  };

  if (loading) {
    return (
      <Container className="py-5">
        <div className="text-center">
          <Spinner animation="border" variant="primary" />
          <p className="mt-3">Đang tải dữ liệu hiệu suất...</p>
        </div>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="py-5">
        <Alert variant="danger">{error}</Alert>
      </Container>
    );
  }

  const chartData = getAttendanceBreakdownChart();

  return (
    <div>
      {/* Header Section */}
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Hiệu suất của tôi</h1>
            <p className="header-subtitle">Theo dõi và đánh giá hiệu suất điểm danh của bạn</p>
          </div>
        </div>
      </div>

      <Container fluid className="py-4">
        {/* CẢNH BÁO & ĐÁNH GIÁ */}
        {stats && (
          <Row className="mb-4">
            <Col>
              {/* Cảnh báo tỷ lệ có mặt thấp */}
              {stats.attendance.attendance_rate < 80 && (
                <Alert variant="danger" className="d-flex align-items-center">
                  <AlertTriangle size={20} className="me-2" />
                  <strong>Cảnh báo:</strong>&nbsp;Tỷ lệ có mặt của bạn đang thấp ({stats.attendance.attendance_rate}%). Vui lòng cải thiện!
                </Alert>
              )}

              {/* Cảnh báo đi muộn nhiều */}
              {stats.attendance.late_count > 5 && (
                <Alert variant="warning" className="d-flex align-items-center">
                  <AlertTriangle size={20} className="me-2" />
                  <strong>Cảnh báo:</strong>&nbsp;Bạn đã muộn {stats.attendance.late_count} lần. Hãy đến đúng giờ!
                </Alert>
              )}

              {/* Cảnh báo vắng không phép */}
              {stats.attendance.absent_no_perm_count > 3 && (
                <Alert variant="danger" className="d-flex align-items-center">
                  <AlertTriangle size={20} className="me-2" />
                  <strong>Cảnh báo:</strong>&nbsp;Bạn đã vắng không phép {stats.attendance.absent_no_perm_count} buổi. Vui lòng liên hệ giảng viên!
                </Alert>
              )}

              {/* Thông báo tốt */}
              {stats.attendance.attendance_rate >= 90 && stats.attendance.late_count <= 2 && (
                <Alert variant="success" className="d-flex align-items-center">
                  <CheckCircle size={20} className="me-2" />
                  <strong>Xuất sắc!</strong>&nbsp;Bạn có tỷ lệ có mặt tốt ({stats.attendance.attendance_rate}%) và ít muộn. Hãy tiếp tục duy trì!
                </Alert>
              )}
            </Col>
          </Row>
        )}

        {/* CARD THỐNG KÊ NHANH */}
        <Row className="mb-4">
          {/* Tỷ lệ có mặt */}
          <Col md={3} className="mb-3">
            <Card className="stat-card h-100">
              <Card.Body>
                <div className="d-flex align-items-center mb-2">
                  <div className="stat-icon bg-success">
                    <CheckCircle size={24} />
                  </div>
                  <div className="ms-3 flex-grow-1">
                    <div className="stat-label">Tỷ lệ có mặt</div>
                    <div className="stat-value">{stats?.attendance.attendance_rate || 0}%</div>
                  </div>
                </div>
                <ProgressBar 
                  now={stats?.attendance.attendance_rate || 0} 
                  variant={
                    stats?.attendance.attendance_rate >= 90 ? 'success' : 
                    stats?.attendance.attendance_rate >= 80 ? 'warning' : 'danger'
                  }
                  style={{ height: '8px' }}
                />
              </Card.Body>
            </Card>
          </Col>

          {/* Số buổi đã tham gia */}
          <Col md={3} className="mb-3">
            <Card className="stat-card h-100">
              <Card.Body>
                <div className="d-flex align-items-center">
                  <div className="stat-icon bg-primary">
                    <Calendar size={24} />
                  </div>
                  <div className="ms-3">
                    <div className="stat-label">Đã tham gia</div>
                    <div className="stat-value">{stats?.attendance.attended_sessions || 0}/{stats?.attendance.total_sessions || 0}</div>
                    <div className="stat-subtitle text-muted small">buổi</div>
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Col>

          {/* Số buổi vắng */}
          <Col md={3} className="mb-3">
            <Card className="stat-card h-100">
              <Card.Body>
                <div className="d-flex align-items-center">
                  <div className="stat-icon bg-danger">
                    <AlertTriangle size={24} />
                  </div>
                  <div className="ms-3">
                    <div className="stat-label">Số buổi vắng</div>
                    <div className="stat-value">{stats?.attendance.absent_count || 0}</div>
                    <div className="stat-subtitle text-muted small">
                      Không phép: {stats?.attendance.absent_no_perm_count || 0}
                    </div>
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Col>

          {/* Số lần gây ra lỗi */}
          <Col md={3} className="mb-3">
            <Card className="stat-card h-100">
              <Card.Body>
                <div className="d-flex align-items-center">
                  <div className="stat-icon bg-warning">
                    <AlertTriangle size={24} />
                  </div>
                  <div className="ms-3">
                    <div className="stat-label">Lỗi hệ thống</div>
                    <div className="stat-value">{stats?.errors.error_count || 0}</div>
                    <div className="stat-subtitle text-muted small">lần</div>
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* THỐNG KÊ THỜI GIAN HOÀN THÀNH */}
        <Row className="mb-4">
          <Col md={12}>
            <Card className="session-card">
              <Card.Body>
                <h5 className="mb-4">
                  <Timer size={20} className="me-2" />
                  Thống Kê Thời Gian Hoàn Thành Điểm Danh
                </h5>
                <Row>
                  <Col md={4}>
                    <div className="text-center p-3 bg-light rounded">
                      <Clock size={32} className="text-primary mb-2" />
                      <div className="stat-label">Thời gian trung bình</div>
                      <div className="stat-value text-primary">
                        {formatSeconds(stats?.completion.avg_completion_time || 0)}
                      </div>
                    </div>
                  </Col>
                  <Col md={4}>
                    <div className="text-center p-3 bg-light rounded">
                      <TrendingUp size={32} className="text-success mb-2" />
                      <div className="stat-label">Thời gian nhanh nhất</div>
                      <div className="stat-value text-success">
                        {formatSeconds(stats?.completion.min_time || 0)}
                      </div>
                    </div>
                  </Col>
                  <Col md={4}>
                    <div className="text-center p-3 bg-light rounded">
                      <Timer size={32} className="text-warning mb-2" />
                      <div className="stat-label">Thời gian chậm nhất</div>
                      <div className="stat-value text-warning">
                        {formatSeconds(stats?.completion.max_time || 0)}
                      </div>
                    </div>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* PHÂN TÍCH ĐIỂM DANH CHI TIẾT */}
        <Row>
          <Col md={6} className="mb-4">
            <Card className="session-card h-100">
              <Card.Body>
                <h5 className="mb-4">
                  <Calendar size={20} className="me-2" />
                  Phân Bố Loại Điểm Danh
                </h5>
                
                {chartData ? (
                  <div style={{ maxWidth: '400px', margin: '0 auto' }}>
                    <Doughnut 
                      data={chartData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: true,
                        plugins: {
                          legend: {
                            position: 'bottom',
                            labels: {
                              padding: 15,
                              font: {
                                size: 12
                              }
                            }
                          },
                          tooltip: {
                            callbacks: {
                              label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value} (${percentage}%)`;
                              }
                            }
                          }
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="text-center text-muted py-5">
                    <p>Chưa có dữ liệu điểm danh</p>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>

          {/* Chi tiết thống kê */}
          <Col md={6} className="mb-4">
            <Card className="session-card h-100">
              <Card.Body>
                <h5 className="mb-4">
                  <TrendingUp size={20} className="me-2" />
                  Chi Tiết Thống Kê
                </h5>

                <div className="mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span>Tổng số buổi:</span>
                    <Badge bg="primary" className="fs-6">{stats?.attendance.total_sessions || 0}</Badge>
                  </div>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span>Đã tham gia:</span>
                    <Badge bg="success" className="fs-6">{stats?.attendance.attended_sessions || 0}</Badge>
                  </div>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span>Vắng mặt:</span>
                    <Badge bg="danger" className="fs-6">{stats?.attendance.absent_count || 0}</Badge>
                  </div>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span>Đi muộn:</span>
                    <Badge bg="warning" className="fs-6">{stats?.attendance.late_count || 0}</Badge>
                  </div>
                </div>

                <hr />

                {/* Breakdown details */}
                <div>
                  <h6 className="mb-3 text-muted small">CHI TIẾT TỪNG LOẠI</h6>
                  {stats?.attendance_breakdown && Object.keys(stats.attendance_breakdown).length > 0 ? (
                    <div className="small">
                      {stats.attendance_breakdown.before > 0 && (
                        <div className="d-flex justify-content-between mb-1">
                          <span>Điểm danh trước giờ:</span>
                          <Badge bg="success">{stats.attendance_breakdown.before}</Badge>
                        </div>
                      )}
                      {stats.attendance_breakdown.during > 0 && (
                        <div className="d-flex justify-content-between mb-1">
                          <span>Điểm danh trong giờ:</span>
                          <Badge bg="info">{stats.attendance_breakdown.during}</Badge>
                        </div>
                      )}
                      {stats.attendance_breakdown.after > 0 && (
                        <div className="d-flex justify-content-between mb-1">
                          <span>Điểm danh sau giờ:</span>
                          <Badge bg="warning">{stats.attendance_breakdown.after}</Badge>
                        </div>
                      )}
                      {stats.attendance_breakdown.early > 0 && (
                        <div className="d-flex justify-content-between mb-1">
                          <span>Điểm danh sớm:</span>
                          <Badge bg="success">{stats.attendance_breakdown.early}</Badge>
                        </div>
                      )}
                      {stats.attendance_breakdown.late > 0 && (
                        <div className="d-flex justify-content-between mb-1">
                          <span>Đi muộn:</span>
                          <Badge bg="warning">{stats.attendance_breakdown.late}</Badge>
                        </div>
                      )}
                      {stats.attendance_breakdown.late_before > 0 && (
                        <div className="d-flex justify-content-between mb-1">
                          <span>Đi muộn trước giờ:</span>
                          <Badge bg="warning">{stats.attendance_breakdown.late_before}</Badge>
                        </div>
                      )}
                      {stats.attendance_breakdown.late_leave > 0 && (
                        <div className="d-flex justify-content-between mb-1">
                          <span>Ra về sớm:</span>
                          <Badge bg="secondary">{stats.attendance_breakdown.late_leave}</Badge>
                        </div>
                      )}
                      {stats.attendance_breakdown.absent > 0 && (
                        <div className="d-flex justify-content-between mb-1">
                          <span>Vắng không phép:</span>
                          <Badge bg="danger">{stats.attendance_breakdown.absent}</Badge>
                        </div>
                      )}
                      {stats.attendance_breakdown.absent_perm > 0 && (
                        <div className="d-flex justify-content-between mb-1">
                          <span>Vắng có phép:</span>
                          <Badge bg="secondary">{stats.attendance_breakdown.absent_perm}</Badge>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted small">Chưa có dữ liệu</p>
                  )}
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default StudentPerformancePage;
