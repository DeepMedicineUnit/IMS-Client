import React, { useState, useEffect } from 'react';
import { Row, Col, Button, Form, Alert, Spinner, Badge } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/dashboard.css';
import '../../styles/user.css';

const GeminiApiKeyPage = () => {
    usePageTitle('API Key Gemini');
    const { api: authApi, currentUser } = useAuth();
    const navigate = useNavigate();
    const [keys, setKeys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newKey, setNewKey] = useState('');
    const [newGmail, setNewGmail] = useState('');
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState('');

    const hasScoreScanAccess = () => {
        if (currentUser?.role === 'superadmin') return true;
        const roles = currentUser?.module_roles || [];
        return roles.some(r => r && r.startsWith('score_scanning_'));
    };

    useEffect(() => {
        if (!hasScoreScanAccess()) {
            navigate('/score-scanning');
            return;
        }
        loadKeys();
    }, [currentUser?.role, currentUser?.module_roles, navigate]);

    const loadKeys = async () => {
        try {
            setLoading(true);
            const res = await authApi.get('/score-scanning/gemini-keys');
            setKeys(res.data?.keys || []);
        } catch (_) {
            setError('Không thể tải danh sách API keys');
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async () => {
        if (!newKey.trim()) return;
        try {
            setAdding(true);
            setError('');
            await authApi.post('/score-scanning/gemini-keys', {
                api_key: newKey.trim(),
                gmail: newGmail.trim(),
                daily_limit: 20
            });
            setNewKey('');
            setNewGmail('');
            loadKeys();
        } catch (e) {
            setError(e.response?.data?.message || 'Lỗi thêm API key');
        } finally {
            setAdding(false);
        }
    };

    const toggleKey = async (id, active) => {
        try {
            await authApi.put(`/score-scanning/gemini-keys/${id}`, { is_active: active });
            loadKeys();
        } catch (_) {}
    };

    const deleteKey = async (id) => {
        if (!window.confirm('Xóa API key này?')) return;
        try {
            await authApi.delete(`/score-scanning/gemini-keys/${id}`);
            loadKeys();
        } catch (_) {}
    };

    if (!hasScoreScanAccess()) return null;

    return (
        <div>
            <div className="session-header">
                <div className="header-content">
                    <div className="header-title">
                        <h1 className="mb-0"><i className="fas fa-key me-2"></i>Quản lý Gemini API Keys</h1>
                        <p className="header-subtitle mb-0">Cấu hình API keys cho chức năng quét điểm bằng AI</p>
                    </div>
                    <div className="header-actions">
                        <Button
                            variant="outline-light"
                            className="create-session-btn"
                            onClick={() => navigate('/score-scanning')}
                        >
                            <i className="fas fa-arrow-left"></i>
                            Quay lại
                        </Button>
                    </div>
                </div>
            </div>

            <Alert variant="info" className="mb-4">
                <i className="fas fa-info-circle me-2"></i>
                Lấy API key miễn phí tại{' '}
                <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noreferrer">
                    Google AI Studio
                </a>
            </Alert>

            {error && (
                <Alert variant="danger" onClose={() => setError('')} dismissible className="mb-4">
                    {error}
                </Alert>
            )}

            <div className="session-card mb-4">
                <div className="card-header-modern">
                    <div className="header-icon">
                        <i className="fas fa-plus"></i>
                    </div>
                    <h6 className="mb-0">Thêm API Key mới</h6>
                </div>
                <div className="card-body-modern">
                    <div className="d-flex gap-2 align-items-end flex-wrap">
                        <Form.Group className="mb-0 flex-grow-1" style={{ minWidth: 200 }}>
                            <Form.Label>API Key</Form.Label>
                            <Form.Control
                                placeholder="AIza..."
                                value={newKey}
                                onChange={e => setNewKey(e.target.value)}
                            />
                        </Form.Group>
                        <Form.Group className="mb-0 flex-grow-1" style={{ minWidth: 180 }}>
                            <Form.Label>Gmail (tùy chọn)</Form.Label>
                            <Form.Control
                                placeholder="email@gmail.com"
                                value={newGmail}
                                onChange={e => setNewGmail(e.target.value)}
                            />
                        </Form.Group>
                        <Button variant="primary" className="filter-btn" onClick={handleAdd} disabled={adding}>
                            {adding ? <Spinner size="sm" animation="border" /> : <><i className="fas fa-plus me-1"></i>Thêm</>}
                        </Button>
                    </div>
                </div>
            </div>

            <div className="session-card">
                <div className="card-header-modern">
                    <div className="header-icon">
                        <i className="fas fa-list"></i>
                    </div>
                    <h6 className="mb-0">Danh sách API Keys</h6>
                </div>
                <div className="card-body-modern">
                    {loading ? (
                        <div className="text-center py-5">
                            <Spinner animation="border" variant="primary" />
                            <p className="mt-2 mb-0">Đang tải...</p>
                        </div>
                    ) : (
                        <div className="session-table-container">
                            <div className="table-responsive-mobile">
                                <table className="table session-table students-table">
                                    <thead>
                                        <tr>
                                            <th>Gmail</th>
                                            <th>API Key</th>
                                            <th>Đã dùng</th>
                                            <th>Còn lại</th>
                                            <th>Trạng thái</th>
                                            <th>Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {keys.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" className="text-center py-4 text-muted">
                                                    Chưa có API key nào. Thêm key mới ở trên.
                                                </td>
                                            </tr>
                                        ) : (
                                            keys.map(k => (
                                                <tr key={k.id}>
                                                    <td>{k.gmail || '-'}</td>
                                                    <td><code>{k.api_key}</code></td>
                                                    <td>{k.used_today}/{k.daily_limit}</td>
                                                    <td>
                                                        <Badge bg={k.remaining > 5 ? 'success' : k.remaining > 0 ? 'warning' : 'danger'}>
                                                            {k.remaining}
                                                        </Badge>
                                                    </td>
                                                    <td>
                                                        <Badge bg={k.is_active ? 'success' : 'secondary'}>
                                                            {k.is_active ? 'Active' : 'Tắt'}
                                                        </Badge>
                                                    </td>
                                                    <td>
                                                        <div className="action-buttons d-flex gap-1">
                                                            <Button
                                                                variant="outline-secondary"
                                                                size="sm"
                                                                className="btn-icon"
                                                                onClick={() => toggleKey(k.id, !k.is_active)}
                                                                title={k.is_active ? 'Tắt' : 'Bật'}
                                                            >
                                                                <i className="fas fa-power-off"></i>
                                                            </Button>
                                                            <Button
                                                                variant="outline-danger"
                                                                size="sm"
                                                                className="btn-icon"
                                                                onClick={() => deleteKey(k.id)}
                                                                title="Xóa"
                                                            >
                                                                <i className="fas fa-trash"></i>
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GeminiApiKeyPage;
