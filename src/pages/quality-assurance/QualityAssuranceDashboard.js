import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Alert, Spinner, Badge } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import '../../styles/user.css';

const QualityAssuranceDashboard = () => {
    const { api, currentUser } = useAuth();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const moduleRoles = currentUser?.module_roles || [];
    const isAdmin = moduleRoles.includes('qualityassurance_admin') || moduleRoles.includes('evidence_mod');

    useEffect(() => {
        fetchDashboardStats();
    }, []);

    const fetchDashboardStats = async () => {
        try {
            setLoading(true);
            const response = await api.get('/quality-assurance/dashboard/stats');
            if (response.data.success) {
                setStats(response.data.data);
            }
        } catch (err) {
            console.error('Error fetching dashboard stats:', err);
            setError('Không thể tải thống kê dashboard');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <Container className="mt-4">
                <div className="text-center py-5">
                    <Spinner animation="border" variant="primary" />
                    <p className="mt-3">Đang tải...</p>
                </div>
            </Container>
        );
    }

    if (error) {
        return (
            <Container className="mt-4">
                <Alert variant="danger">{error}</Alert>
            </Container>
        );
    }

    return (
        <Container fluid className="mt-4">
            <Row className="mb-4">
                <Col>
                    <h2>
                        <i className="fas fa-chart-line me-2"></i>
                        Dashboard Lưu trữ minh chứng
                    </h2>
                </Col>
            </Row>

            {isAdmin ? (
                // Admin Dashboard
                <>
                    <Row className="mb-4">
                        <Col md={3} sm={6} className="mb-3">
                            <Card className="h-100 border-primary">
                                <Card.Body>
                                    <div className="d-flex justify-content-between align-items-center">
                                        <div>
                                            <h6 className="text-muted mb-2">Danh mục minh chứng</h6>
                                            <h2 className="mb-0">{stats?.totalCategories || 0}</h2>
                                        </div>
                                        <div className="text-primary" style={{ fontSize: '2.5rem' }}>
                                            <i className="fas fa-folder"></i>
                                        </div>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>

                        <Col md={3} sm={6} className="mb-3">
                            <Card className="h-100 border-info">
                                <Card.Body>
                                    <div className="d-flex justify-content-between align-items-center">
                                        <div>
                                            <h6 className="text-muted mb-2">Phân công</h6>
                                            <h2 className="mb-0">{stats?.totalAssignments || 0}</h2>
                                        </div>
                                        <div className="text-info" style={{ fontSize: '2.5rem' }}>
                                            <i className="fas fa-user-check"></i>
                                        </div>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>

                        <Col md={3} sm={6} className="mb-3">
                            <Card className="h-100 border-success">
                                <Card.Body>
                                    <div className="d-flex justify-content-between align-items-center">
                                        <div>
                                            <h6 className="text-muted mb-2">Tổng số bài nộp</h6>
                                            <h2 className="mb-0">{stats?.totalSubmissions || 0}</h2>
                                        </div>
                                        <div className="text-success" style={{ fontSize: '2.5rem' }}>
                                            <i className="fas fa-file-upload"></i>
                                        </div>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>

                        <Col md={3} sm={6} className="mb-3">
                            <Card className="h-100 border-warning">
                                <Card.Body>
                                    <div className="d-flex justify-content-between align-items-center">
                                        <div>
                                            <h6 className="text-muted mb-2">Chờ rà soát</h6>
                                            <h2 className="mb-0">
                                                {stats?.submissionsByStatus?.find(s => s.status === 'submitted')?.count || 0}
                                            </h2>
                                        </div>
                                        <div className="text-warning" style={{ fontSize: '2.5rem' }}>
                                            <i className="fas fa-clock"></i>
                                        </div>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>

                    <Row>
                        <Col lg={6} className="mb-4">
                            <Card>
                                <Card.Header>
                                    <h5 className="mb-0">
                                        <i className="fas fa-chart-pie me-2"></i>
                                        Thống kê theo trạng thái
                                    </h5>
                                </Card.Header>
                                <Card.Body>
                                    {stats?.submissionsByStatus?.map((item) => (
                                        <div key={item.status} className="d-flex justify-content-between align-items-center mb-3 p-2 bg-light rounded">
                                            <span className="fw-medium">
                                                {item.status === 'draft' && 'Nháp'}
                                                {item.status === 'submitted' && 'Đã gửi'}
                                                {item.status === 'approved' && 'Đáp ứng'}
                                                {item.status === 'needs_revision' && 'Chỉnh sửa'}
                                            </span>
                                            <Badge 
                                                bg={
                                                    item.status === 'draft' ? 'secondary' :
                                                    item.status === 'submitted' ? 'warning' :
                                                    item.status === 'approved' ? 'success' :
                                                    'danger'
                                                }
                                                pill
                                            >
                                                {item.count}
                                            </Badge>
                                        </div>
                                    ))}
                                </Card.Body>
                            </Card>
                        </Col>

                        <Col lg={6} className="mb-4">
                            <Card>
                                <Card.Header>
                                    <h5 className="mb-0">
                                        <i className="fas fa-clock me-2"></i>
                                        Bài nộp mới nhất
                                    </h5>
                                </Card.Header>
                                <Card.Body>
                                    {stats?.recentSubmissions?.length > 0 ? (
                                        <div>
                                            {stats.recentSubmissions.map((submission) => (
                                                <div key={submission.id} className="border-start border-primary border-3 ps-3 mb-3">
                                                    <div className="fw-bold">{submission.code}</div>
                                                    <div className="text-muted small">{submission.category_name}</div>
                                                    <div className="text-muted small">
                                                        <i className="fas fa-user me-1"></i>
                                                        {submission.submitted_by_name}
                                                    </div>
                                                    <div className="text-muted small">
                                                        <i className="fas fa-calendar me-1"></i>
                                                        {new Date(submission.submitted_at).toLocaleString('vi-VN')}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-muted text-center py-3">Chưa có bài nộp nào</div>
                                    )}
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>
                </>
            ) : (
                // Staff Dashboard
                <>
                    <Row className="mb-4">
                        <Col md={3} sm={6} className="mb-3">
                            <Card className="h-100 border-primary">
                                <Card.Body>
                                    <div className="d-flex justify-content-between align-items-center">
                                        <div>
                                            <h6 className="text-muted mb-2">Minh chứng được gán</h6>
                                            <h2 className="mb-0">{stats?.totalAssigned || 0}</h2>
                                        </div>
                                        <div className="text-primary" style={{ fontSize: '2.5rem' }}>
                                            <i className="fas fa-tasks"></i>
                                        </div>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>

                        <Col md={3} sm={6} className="mb-3">
                            <Card className="h-100 border-warning">
                                <Card.Body>
                                    <div className="d-flex justify-content-between align-items-center">
                                        <div>
                                            <h6 className="text-muted mb-2">Chưa hoàn thành</h6>
                                            <h2 className="mb-0">{stats?.pendingCount || 0}</h2>
                                        </div>
                                        <div className="text-warning" style={{ fontSize: '2.5rem' }}>
                                            <i className="fas fa-clock"></i>
                                        </div>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>

                        <Col md={3} sm={6} className="mb-3">
                            <Card className="h-100 border-success">
                                <Card.Body>
                                    <div className="d-flex justify-content-between align-items-center">
                                        <div>
                                            <h6 className="text-muted mb-2">Đã duyệt</h6>
                                            <h2 className="mb-0">
                                                {stats?.mySubmissions?.find(s => s.status === 'approved')?.count || 0}
                                            </h2>
                                        </div>
                                        <div className="text-success" style={{ fontSize: '2.5rem' }}>
                                            <i className="fas fa-check-circle"></i>
                                        </div>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>

                        <Col md={3} sm={6} className="mb-3">
                            <Card className="h-100 border-danger">
                                <Card.Body>
                                    <div className="d-flex justify-content-between align-items-center">
                                        <div>
                                            <h6 className="text-muted mb-2">Cần chỉnh sửa</h6>
                                            <h2 className="mb-0">
                                                {stats?.mySubmissions?.find(s => s.status === 'needs_revision')?.count || 0}
                                            </h2>
                                        </div>
                                        <div className="text-danger" style={{ fontSize: '2.5rem' }}>
                                            <i className="fas fa-edit"></i>
                                        </div>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>

                    <Row>
                        <Col lg={8} className="mb-4 mx-auto">
                            <Card>
                                <Card.Header>
                                    <h5 className="mb-0">
                                        <i className="fas fa-tasks me-2"></i>
                                        Trạng thái công việc
                                    </h5>
                                </Card.Header>
                                <Card.Body>
                                    {stats?.mySubmissions?.map((item) => (
                                        <div key={item.status} className="d-flex justify-content-between align-items-center mb-3 p-2 bg-light rounded">
                                            <span className="fw-medium">
                                                {item.status === 'draft' && 'Nháp'}
                                                {item.status === 'submitted' && 'Đã gửi'}
                                                {item.status === 'approved' && 'Đáp ứng'}
                                                {item.status === 'needs_revision' && 'Chỉnh sửa'}
                                            </span>
                                            <Badge 
                                                bg={
                                                    item.status === 'draft' ? 'secondary' :
                                                    item.status === 'submitted' ? 'warning' :
                                                    item.status === 'approved' ? 'success' :
                                                    'danger'
                                                }
                                                pill
                                            >
                                                {item.count}
                                            </Badge>
                                        </div>
                                    ))}
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>
                </>
            )}
        </Container>
    );
};

export default QualityAssuranceDashboard;
