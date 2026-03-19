import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Form, Button, Alert, Spinner, OverlayTrigger, Tooltip, Modal } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import '../../styles/user.css';
import usePageTitle from '../../hooks/usePageTitle';

const SMTP_USER_TOOLTIP = (
    <Tooltip id="smtp-user-tooltip">
        Địa chỉ email dùng để gửi thư, phải khớp với tài khoản SMTP. Với Gmail/Google Workspace: dùng đúng email đã bật xác minh 2 bước và tạo Mật khẩu ứng dụng (không dùng mật khẩu đăng nhập thông thường).
    </Tooltip>
);

const ReceptionistMailSettings = () => {
    usePageTitle('Cài đặt mail Lễ tân');
    const { api } = useAuth();
    const { showAlert } = useAlert();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showAppPasswordModal, setShowAppPasswordModal] = useState(false);
    const [form, setForm] = useState({
        smtp_host: '',
        smtp_port: 587,
        smtp_user: '',
        smtp_pass: '',
        notify_new_registration: true,
        notify_approval_success: true,
        notify_rejection: true,
        notify_recurrence_updated: true,
        notify_booking_updated: true,
        notify_booking_deleted: true
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const res = await api.get('/receptionist/settings/mail');
            if (res.data?.success && res.data?.data) {
                const d = res.data.data;
                setForm({
                    smtp_host: d.smtp_host != null ? d.smtp_host : '',
                    smtp_port: d.smtp_port != null ? d.smtp_port : 587,
                    smtp_user: d.smtp_user != null ? d.smtp_user : '',
                    smtp_pass: d.smtp_pass != null ? d.smtp_pass : '',
                    notify_new_registration: !!d.notify_new_registration,
                    notify_approval_success: !!d.notify_approval_success,
                    notify_rejection: d.notify_rejection != null ? !!d.notify_rejection : true,
                    notify_recurrence_updated: !!d.notify_recurrence_updated,
                    notify_booking_updated: !!d.notify_booking_updated,
                    notify_booking_deleted: d.notify_booking_deleted != null ? !!d.notify_booking_deleted : true
                });
            }
        } catch (err) {
            console.error('Error fetching receptionist mail settings:', err);
            showAlert(err.response?.data?.message || 'Không thể tải cài đặt mail', 'danger');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.put('/receptionist/settings/mail', {
                smtp_host: form.smtp_host || null,
                smtp_port: form.smtp_port === '' ? null : form.smtp_port,
                smtp_user: form.smtp_user || null,
                smtp_pass: form.smtp_pass === '********' ? undefined : (form.smtp_pass === '' ? '' : form.smtp_pass),
                notify_new_registration: form.notify_new_registration,
                notify_approval_success: form.notify_approval_success,
                notify_rejection: form.notify_rejection,
                notify_recurrence_updated: form.notify_recurrence_updated,
                notify_booking_updated: form.notify_booking_updated,
                notify_booking_deleted: form.notify_booking_deleted
            });
            showAlert('Đã lưu cài đặt mail.', 'success');
        } catch (err) {
            showAlert(err.response?.data?.message || 'Lưu thất bại', 'danger');
        } finally {
            setSaving(false);
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

    return (
        <div>
            <div className="session-header">
                <div className="header-content">
                    <div className="header-title">
                        <h1>Cài đặt mail</h1>
                        <p className="header-subtitle">
                            Cấu hình SMTP và thông báo đặt phòng họp (đăng ký mới, duyệt, cập nhật).
                        </p>
                    </div>
                    <div className="header-actions">
                        <Button variant="outline-light" className="create-session-btn" type="submit" form="receptionist-mail-settings-form" disabled={saving}>
                            {saving ? (
                                <>
                                    <Spinner as="span" animation="border" size="sm" className="me-2" />
                                    Đang lưu...
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-save me-2"></i>
                                    Lưu cài đặt
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>

            <Container fluid className="mt-4">
                <Form id="receptionist-mail-settings-form" onSubmit={handleSubmit}>
                    <Row>
                        {/* Cột trái: Cấu hình SMTP */}
                        <Col md={6} className="mb-4">
                            <div className="session-card h-100">
                                <div className="card-header-modern">
                                    <div className="header-icon">
                                        <i className="fas fa-envelope"></i>
                                    </div>
                                    <h6 className="mb-0">Cấu hình SMTP</h6>
                                </div>
                                <div className="card-body-modern">
                                    <p className="text-muted small mb-3">Dùng để gửi thông báo đặt phòng (Duyệt thành công, Cập nhật…). Để trống thì dùng mail hệ thống (biến môi trường). <strong>Thông báo &quot;Đăng ký mới&quot;</strong> luôn gửi bằng mail hệ thống tới email receptionist_admin.</p>
                                    <Form.Group className="mb-3">
                                        <Form.Label>SMTP Host</Form.Label>
                                        <Form.Control
                                            type="text"
                                            value={form.smtp_host}
                                            onChange={(e) => setForm({ ...form, smtp_host: e.target.value })}
                                            placeholder="VD: smtp.gmail.com"
                                        />
                                    </Form.Group>
                                    <Form.Group className="mb-3">
                                        <Form.Label>SMTP Port</Form.Label>
                                        <Form.Control
                                            type="number"
                                            min={1}
                                            max={65535}
                                            value={form.smtp_port}
                                            onChange={(e) => setForm({ ...form, smtp_port: e.target.value === '' ? '' : parseInt(e.target.value, 10) || 587 })}
                                            placeholder="587"
                                        />
                                    </Form.Group>
                                    <Form.Group className="mb-3">
                                        <Form.Label className="d-flex align-items-center gap-1">
                                            SMTP User (email gửi)
                                            <OverlayTrigger placement="top" overlay={SMTP_USER_TOOLTIP}>
                                                <span className="text-primary cursor-pointer" style={{ cursor: 'help' }} role="button" tabIndex={0} aria-label="Hướng dẫn">
                                                    <i className="fas fa-question-circle ms-1" style={{ fontSize: '0.9rem' }} />
                                                </span>
                                            </OverlayTrigger>
                                        </Form.Label>
                                        <Form.Control
                                            type="email"
                                            value={form.smtp_user}
                                            onChange={(e) => setForm({ ...form, smtp_user: e.target.value })}
                                            placeholder="VD: user1@example.com"
                                        />
                                    </Form.Group>
                                    <Form.Group className="mb-0">
                                        <div className="d-flex justify-content-between align-items-center mb-1">
                                            <Form.Label className="mb-0">SMTP Password (mật khẩu ứng dụng)</Form.Label>
                                            <Button
                                                variant="link"
                                                className="p-0 text-decoration-none text-muted"
                                                style={{ fontSize: '0.75rem' }}
                                                onClick={() => setShowAppPasswordModal(true)}
                                            >
                                                Cách lấy mật khẩu ứng dụng
                                            </Button>
                                        </div>
                                        <Form.Control
                                            type="password"
                                            value={form.smtp_pass}
                                            onChange={(e) => setForm({ ...form, smtp_pass: e.target.value })}
                                            placeholder="Để trống nếu không đổi. Gmail: dùng Mật khẩu ứng dụng."
                                            autoComplete="new-password"
                                        />
                                    </Form.Group>
                                </div>
                            </div>
                        </Col>

                        {/* Cột phải: Thông báo */}
                        <Col md={6} className="mb-4">
                            <div className="session-card h-100">
                                <div className="card-header-modern">
                                    <div className="header-icon">
                                        <i className="fas fa-bell"></i>
                                    </div>
                                    <h6 className="mb-0">Thông báo</h6>
                                </div>
                                <div className="card-body-modern">
                                    <Alert variant="info" className="py-2 px-3 small mb-3">
                                        Bật/tắt gửi email cho từng loại sự kiện. &quot;Đăng ký mới&quot; gửi tới tất cả email có role receptionist_admin (dùng mail hệ thống).
                                    </Alert>
                                    <Form.Group className="mb-3">
                                        <Form.Check
                                            type="switch"
                                            id="notify_new_registration"
                                            label="Đăng ký mới"
                                            checked={form.notify_new_registration}
                                            onChange={(e) => setForm({ ...form, notify_new_registration: e.target.checked })}
                                        />
                                        <Form.Text className="text-muted d-block">Gửi email tới receptionist_admin khi có đặt phòng mới (mail hệ thống).</Form.Text>
                                    </Form.Group>
                                    <Form.Group className="mb-3">
                                        <Form.Check
                                            type="switch"
                                            id="notify_approval_success"
                                            label="Duyệt thành công"
                                            checked={form.notify_approval_success}
                                            onChange={(e) => setForm({ ...form, notify_approval_success: e.target.checked })}
                                        />
                                        <Form.Text className="text-muted d-block">Gửi email cho người đặt khi admin duyệt yêu cầu.</Form.Text>
                                    </Form.Group>
                                    <Form.Group className="mb-3">
                                        <Form.Check
                                            type="switch"
                                            id="notify_rejection"
                                            label="Từ chối đặt phòng"
                                            checked={form.notify_rejection}
                                            onChange={(e) => setForm({ ...form, notify_rejection: e.target.checked })}
                                        />
                                        <Form.Text className="text-muted d-block">Gửi email cho người đặt khi admin từ chối yêu cầu (kèm lý do nếu có).</Form.Text>
                                    </Form.Group>
                                    <Form.Group className="mb-3">
                                        <Form.Check
                                            type="switch"
                                            id="notify_recurrence_updated"
                                            label="Cập nhật quy tắc lặp và tạo lại sự kiện định kỳ"
                                            checked={form.notify_recurrence_updated}
                                            onChange={(e) => setForm({ ...form, notify_recurrence_updated: e.target.checked })}
                                        />
                                        <Form.Text className="text-muted d-block">Gửi email cho người đặt khi chuỗi định kỳ được cập nhật và tạo lại.</Form.Text>
                                    </Form.Group>
                                    <Form.Group className="mb-3">
                                        <Form.Check
                                            type="switch"
                                            id="notify_booking_updated"
                                            label="Cập nhật đặt phòng"
                                            checked={form.notify_booking_updated}
                                            onChange={(e) => setForm({ ...form, notify_booking_updated: e.target.checked })}
                                        />
                                        <Form.Text className="text-muted d-block">Gửi email cho người đặt khi đặt phòng (một lần) được cập nhật.</Form.Text>
                                    </Form.Group>
                                    <Form.Group className="mb-0">
                                        <Form.Check
                                            type="switch"
                                            id="notify_booking_deleted"
                                            label="Xóa sự kiện"
                                            checked={form.notify_booking_deleted}
                                            onChange={(e) => setForm({ ...form, notify_booking_deleted: e.target.checked })}
                                        />
                                        <Form.Text className="text-muted d-block">Gửi email cho người đặt khi đặt phòng bị xóa (một lần hoặc cả chuỗi định kỳ).</Form.Text>
                                    </Form.Group>
                                </div>
                            </div>
                        </Col>
                    </Row>
                </Form>
            </Container>

            <Modal show={showAppPasswordModal} onHide={() => setShowAppPasswordModal(false)} size="lg" centered>
                <Modal.Header closeButton>
                    <Modal.Title><i className="fas fa-key me-2" />Cách lấy mật khẩu ứng dụng</Modal.Title>
                </Modal.Header>
                <Modal.Body className="pb-4">
                    <p className="text-muted small mb-3">
                        Mật khẩu ứng dụng là mật khẩu dùng riêng cho ứng dụng/gửi mail, không phải mật khẩu đăng nhập email. Mỗi nhà cung cấp có cách tạo khác nhau.
                    </p>

                    <h6 className="fw-bold mt-4 mb-2"><i className="fab fa-google text-danger me-2" />Gmail / Google Workspace</h6>
                    <ol className="small mb-0 ps-3">
                        <li className="mb-2">Đăng nhập <a href="https://myaccount.google.com" target="_blank" rel="noopener noreferrer">Google Tài khoản</a> (myaccount.google.com).</li>
                        <li className="mb-2">Vào <strong>Bảo mật</strong> (Security) → mục <strong>Đăng nhập vào Google</strong>.</li>
                        <li className="mb-2">Bật <strong>Xác minh 2 bước</strong> nếu chưa bật (bắt buộc mới tạo được mật khẩu ứng dụng).</li>
                        <li className="mb-2">Sau khi bật xác minh 2 bước, quay lại <strong>Bảo mật</strong> → <a href="https://myaccount.google.com/apppasswords?" target="_blank" rel="noopener noreferrer">Mật khẩu ứng dụng</a> (hoặc tìm “App passwords”).</li>
                        <li className="mb-2">Đặt tên cho ứng dụng (ví dụ “PCTU Quality Assurance”).</li>
                        <li className="mb-2">Nhấn <strong>Tạo</strong> → Google hiển thị mật khẩu 16 ký tự (dạng <code>xxxx xxxx xxxx xxxx</code>).</li>
                        <li>Copy nguyên chuỗi (có thể bỏ dấu cách) và dán vào ô <strong>SMTP Password</strong>. Không dùng mật khẩu đăng nhập Gmail.</li>
                    </ol>

                    <h6 className="fw-bold mt-4 mb-2"><i className="fas fa-envelope text-primary me-2" />Outlook / Microsoft 365 (Office 365)</h6>
                    <ol className="small mb-0 ps-3">
                        <li className="mb-2">Đăng nhập <a href="https://account.microsoft.com" target="_blank" rel="noopener noreferrer">account.microsoft.com</a>.</li>
                        <li className="mb-2">Vào <strong>Bảo mật</strong> (Security) → <strong>Xác minh danh tính</strong> → bật xác minh 2 bước nếu chưa.</li>
                        <li className="mb-2">Tìm mục <strong>Mật khẩu ứng dụng</strong> (App passwords) → <strong>Tạo mật khẩu ứng dụng mới</strong>.</li>
                        <li className="mb-2">Đặt tên (ví dụ “PCTU Mail”) → tạo → copy mật khẩu hiển thị (chỉ hiện một lần).</li>
                        <li>Dán mật khẩu đó vào ô <strong>SMTP Password</strong>. SMTP Outlook thường dùng <code>smtp.office365.com</code>, port <code>587</code>.</li>
                    </ol>

                    <Alert variant="warning" className="small mt-3 mb-0 py-2">
                        <strong>Lưu ý:</strong> Nếu không thấy mục “Mật khẩu ứng dụng”, hãy kiểm tra đã bật xác minh 2 bước chưa. Một số tài khoản công ty do admin quản lý có thể cần liên hệ IT để bật hoặc cấp quyền gửi SMTP.
                    </Alert>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowAppPasswordModal(false)}>Đóng</Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default ReceptionistMailSettings;
