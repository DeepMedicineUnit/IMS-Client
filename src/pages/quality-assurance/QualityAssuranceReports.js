import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Table, Button, Badge, Spinner, Alert } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import '../../styles/user.css';

const QualityAssuranceReports = () => {
    const { api } = useAuth();
    const [categories, setCategories] = useState([]);
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalCategories: 0,
        totalAssignments: 0,
        totalSubmissions: 0,
        byStatus: []
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            
            // Fetch categories
            const categoriesResponse = await api.get('/quality-assurance/categories');
            if (categoriesResponse.data.success) {
                setCategories(categoriesResponse.data.data);
            }

            // Fetch submissions
            const submissionsResponse = await api.get('/quality-assurance/submissions');
            if (submissionsResponse.data.success) {
                const subs = submissionsResponse.data.data;
                setSubmissions(subs);

                // Calculate stats
                const statusCounts = subs.reduce((acc, sub) => {
                    acc[sub.status] = (acc[sub.status] || 0) + 1;
                    return acc;
                }, {});

                setStats({
                    totalCategories: categoriesResponse.data.data.length,
                    totalAssignments: categoriesResponse.data.data.reduce(
                        (sum, cat) => sum + (cat.assigned_count || 0), 
                        0
                    ),
                    totalSubmissions: subs.length,
                    byStatus: Object.entries(statusCounts).map(([status, count]) => ({
                        status,
                        count
                    }))
                });
            }
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    const exportToCSV = () => {
        const headers = ['Mã minh chứng', 'Tên minh chứng', 'Người nộp', 'Trạng thái', 'Ngày nộp', 'Số file'];
        const rows = submissions.map(sub => [
            sub.code,
            sub.category_name,
            sub.submitted_by_name,
            sub.status,
            sub.submitted_at ? new Date(sub.submitted_at).toLocaleString('vi-VN') : '-',
            sub.file_count
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `bao-cao-minh-chung-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const getStatusText = (status) => {
        const statusMap = {
            draft: 'Nháp',
            submitted: 'Đã gửi',
            approved: 'Đáp ứng',
            needs_revision: 'Chỉnh sửa'
        };
        return statusMap[status] || status;
    };

    const getCompletionRate = () => {
        if (stats.totalAssignments === 0) return 0;
        const approved = stats.byStatus.find(s => s.status === 'approved');
        return ((approved?.count || 0) / stats.totalAssignments * 100).toFixed(1);
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

    return (
        <Container fluid className="mt-4">
            <Row className="mb-4">
                <Col>
                    <div className="d-flex justify-content-between align-items-center">
                        <h2>
                            <i className="fas fa-chart-bar me-2"></i>
                            Báo cáo Lưu trữ minh chứng
                        </h2>
                        <Button variant="success" onClick={exportToCSV}>
                            <i className="fas fa-file-excel me-2"></i>
                            Xuất Excel
                        </Button>
                    </div>
                </Col>
            </Row>

            {/* Summary Stats */}
            <Row className="mb-4">
                <Col md={3} sm={6} className="mb-3">
                    <Card className="h-100 border-primary">
                        <Card.Body>
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 className="text-muted mb-2">Danh mục minh chứng</h6>
                                    <h2 className="mb-0">{stats.totalCategories}</h2>
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
                                    <h6 className="text-muted mb-2">Tổng phân công</h6>
                                    <h2 className="mb-0">{stats.totalAssignments}</h2>
                                </div>
                                <div className="text-info" style={{ fontSize: '2.5rem' }}>
                                    <i className="fas fa-tasks"></i>
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
                                    <h6 className="text-muted mb-2">Tỷ lệ hoàn thành</h6>
                                    <h2 className="mb-0">{getCompletionRate()}%</h2>
                                </div>
                                <div className="text-success" style={{ fontSize: '2.5rem' }}>
                                    <i className="fas fa-check-circle"></i>
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
                                    <h6 className="text-muted mb-2">Tổng bài nộp</h6>
                                    <h2 className="mb-0">{stats.totalSubmissions}</h2>
                                </div>
                                <div className="text-warning" style={{ fontSize: '2.5rem' }}>
                                    <i className="fas fa-file-upload"></i>
                                </div>
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* Status Breakdown */}
            <Card className="mb-4">
                <Card.Header>
                    <h5 className="mb-0">
                        <i className="fas fa-chart-pie me-2"></i>
                        Thống kê theo trạng thái
                    </h5>
                </Card.Header>
                <Card.Body>
                    {stats.byStatus.map((item) => (
                        <div key={item.status} className="d-flex justify-content-between align-items-center mb-3 p-2 bg-light rounded">
                            <span className="fw-medium">{getStatusText(item.status)}</span>
                            <div>
                                <Badge 
                                    bg={
                                        item.status === 'draft' ? 'secondary' :
                                        item.status === 'submitted' ? 'warning' :
                                        item.status === 'approved' ? 'success' :
                                        'danger'
                                    }
                                    pill
                                    className="me-2"
                                >
                                    {item.count}
                                </Badge>
                                <span className="text-muted">
                                    ({(item.count / stats.totalSubmissions * 100).toFixed(1)}%)
                                </span>
                            </div>
                        </div>
                    ))}
                </Card.Body>
            </Card>

            {/* Categories Report */}
            <Card className="mb-4">
                <Card.Header>
                    <h5 className="mb-0">
                        <i className="fas fa-folder-open me-2"></i>
                        Báo cáo theo danh mục
                    </h5>
                </Card.Header>
                <Card.Body>
                    <div className="table-responsive">
                        <Table striped hover>
                            <thead>
                                <tr>
                                    <th>Mã</th>
                                    <th>Tên minh chứng</th>
                                    <th className="text-center">Số lượng gán</th>
                                    <th className="text-center">Số bài nộp</th>
                                    <th className="text-center">Tỷ lệ hoàn thành</th>
                                </tr>
                            </thead>
                            <tbody>
                                {categories.map((cat) => {
                                    const completion = cat.assigned_count > 0 
                                        ? ((cat.submission_count / cat.assigned_count) * 100).toFixed(1)
                                        : 0;
                                    
                                    return (
                                        <tr key={cat.id}>
                                            <td><strong>{cat.code}</strong></td>
                                            <td>{cat.name}</td>
                                            <td className="text-center">
                                                <Badge bg="info">{cat.assigned_count}</Badge>
                                            </td>
                                            <td className="text-center">
                                                <Badge bg="primary">{cat.submission_count}</Badge>
                                            </td>
                                            <td className="text-center">
                                                <Badge 
                                                    bg={
                                                        completion >= 80 ? 'success' : 
                                                        completion >= 50 ? 'warning' : 
                                                        'danger'
                                                    }
                                                >
                                                    {completion}%
                                                </Badge>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </Table>
                    </div>
                </Card.Body>
            </Card>

            {/* Submissions Report */}
            <Card>
                <Card.Header>
                    <h5 className="mb-0">
                        <i className="fas fa-file-alt me-2"></i>
                        Chi tiết bài nộp
                    </h5>
                </Card.Header>
                <Card.Body>
                    <div className="table-responsive">
                        <Table striped hover>
                            <thead>
                                <tr>
                                    <th>Mã minh chứng</th>
                                    <th>Tên minh chứng</th>
                                    <th>Người nộp</th>
                                    <th>Trạng thái</th>
                                    <th>Ngày nộp</th>
                                    <th className="text-center">Số file</th>
                                </tr>
                            </thead>
                            <tbody>
                                {submissions.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="text-center text-muted py-4">
                                            Chưa có bài nộp nào
                                        </td>
                                    </tr>
                                ) : (
                                    submissions.map((sub) => (
                                        <tr key={sub.id}>
                                            <td><strong>{sub.code}</strong></td>
                                            <td>{sub.category_name}</td>
                                            <td>{sub.submitted_by_name}</td>
                                            <td>
                                                <Badge 
                                                    bg={
                                                        sub.status === 'draft' ? 'secondary' :
                                                        sub.status === 'submitted' ? 'warning' :
                                                        sub.status === 'approved' ? 'success' :
                                                        'danger'
                                                    }
                                                >
                                                    {getStatusText(sub.status)}
                                                </Badge>
                                            </td>
                                            <td>
                                                {sub.submitted_at 
                                                    ? new Date(sub.submitted_at).toLocaleString('vi-VN')
                                                    : '-'
                                                }
                                            </td>
                                            <td className="text-center">
                                                <Badge bg="primary">{sub.file_count}</Badge>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </Table>
                    </div>
                </Card.Body>
            </Card>
        </Container>
    );
};

export default QualityAssuranceReports;
