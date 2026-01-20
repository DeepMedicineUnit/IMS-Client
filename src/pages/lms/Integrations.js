import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert, Badge, Card, Accordion, Tab, Tabs, InputGroup } from 'react-bootstrap';
import axios from 'axios';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const Integrations = () => {
  usePageTitle('Tích hợp LMS');
  const [loading, setLoading] = useState(false);
  const [integrations, setIntegrations] = useState({});
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [alert, setAlert] = useState({ show: false, message: '', variant: '' });

  // Integration configurations
  const [configs, setConfigs] = useState({
    sso: {
      enabled: false,
      provider: 'saml',
      sso_url: '',
      entity_id: '',
      certificate: '',
      name_id_format: 'email'
    },
    smtp: {
      enabled: false,
      host: '',
      port: 587,
      secure: true,
      username: '',
      password: '',
      from_email: '',
      from_name: ''
    },
    sms: {
      enabled: false,
      provider: 'webhook',
      api_url: '',
      api_key: '',
      sender_id: ''
    },
    storage: {
      enabled: false,
      provider: 'local',
      s3_bucket: '',
      s3_region: '',
      s3_access_key: '',
      s3_secret_key: ''
    },
    video_conferencing: {
      enabled: false,
      provider: 'bigbluebutton',
      bbb_url: '',
      bbb_secret: '',
      zoom_api_key: '',
      zoom_api_secret: '',
      teams_client_id: '',
      teams_client_secret: ''
    },
    scorm: {
      enabled: false,
      provider: 'scorm_cloud',
      api_url: '',
      app_id: '',
      secret_key: ''
    },
    xapi: {
      enabled: false,
      lrs_endpoint: '',
      username: '',
      password: ''
    }
  });

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // In production, fetch from real API
      // const response = await axios.get(`${API_BASE_URL}/lms/integrations`, {
      //   headers: { Authorization: `Bearer ${token}` }
      // });
      
      // Mock data for now
      setIntegrations(configs);
    } catch (error) {
      console.error('Error fetching integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async (integrationType) => {
    try {
      const token = localStorage.getItem('token');
      const config = configs[integrationType];

      // In production, save to API
      // await axios.post(`${API_BASE_URL}/lms/integrations/${integrationType}`, config, {
      //   headers: { Authorization: `Bearer ${token}` }
      // });

      showAlert(`Cấu hình ${integrationType} thành công`, 'success');
      setShowConfigModal(false);
    } catch (error) {
      console.error('Error saving integration:', error);
      showAlert('Lỗi khi lưu cấu hình', 'danger');
    }
  };

  const handleTestConnection = async (integrationType) => {
    try {
      const token = localStorage.getItem('token');
      
      // In production, test connection via API
      // const response = await axios.post(`${API_BASE_URL}/lms/integrations/${integrationType}/test`, {}, {
      //   headers: { Authorization: `Bearer ${token}` }
      // });

      showAlert('Kết nối thành công!', 'success');
    } catch (error) {
      console.error('Error testing connection:', error);
      showAlert('Kết nối thất bại. Vui lòng kiểm tra cấu hình', 'danger');
    }
  };

  const handleOpenConfig = (integrationType) => {
    setSelectedIntegration(integrationType);
    setShowConfigModal(true);
  };

  const showAlert = (message, variant) => {
    setAlert({ show: true, message, variant });
    setTimeout(() => setAlert({ show: false, message: '', variant: '' }), 5000);
  };

  const integrationTypes = [
    {
      id: 'sso',
      name: 'Single Sign-On (SSO)',
      icon: 'key',
      description: 'Tích hợp đăng nhập đơn (SAML, OAuth, LDAP)',
      color: 'primary'
    },
    {
      id: 'smtp',
      name: 'Email (SMTP)',
      icon: 'envelope',
      description: 'Cấu hình gửi email thông báo',
      color: 'info'
    },
    {
      id: 'sms',
      name: 'SMS',
      icon: 'sms',
      description: 'Tích hợp gửi SMS qua webhook hoặc provider',
      color: 'success'
    },
    {
      id: 'storage',
      name: 'Cloud Storage',
      icon: 'cloud',
      description: 'Lưu trữ file trên S3, Azure Blob, hoặc local',
      color: 'warning'
    },
    {
      id: 'video_conferencing',
      name: 'Video Conferencing',
      icon: 'video',
      description: 'BigBlueButton, Zoom, Microsoft Teams',
      color: 'danger'
    },
    {
      id: 'scorm',
      name: 'SCORM Cloud',
      icon: 'cloud-upload-alt',
      description: 'Tích hợp SCORM Cloud cho e-learning',
      color: 'secondary'
    },
    {
      id: 'xapi',
      name: 'xAPI (Tin Can)',
      icon: 'exchange-alt',
      description: 'Learning Record Store (LRS) integration',
      color: 'dark'
    }
  ];

  return (
    <div className="container-fluid session-main-container">
      {/* Header */}
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Tích hợp & Số hóa</h1>
            <p className="header-subtitle">Cấu hình tích hợp SSO, Email, SMS, Video Conferencing, SCORM/xAPI, Cloud Storage</p>
          </div>
        </div>
      </div>

      {/* Alert */}
      {alert.show && (
        <Alert variant={alert.variant} dismissible onClose={() => setAlert({ ...alert, show: false })}>
          {alert.message}
        </Alert>
      )}

      {/* Integration Cards */}
      <div className="row g-4">
        {integrationTypes.map((integration) => {
          const config = configs[integration.id];
          const isEnabled = config?.enabled || false;

          return (
            <div key={integration.id} className="col-md-6 col-lg-4">
              <Card className="h-100">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <div className="d-flex align-items-center">
                      <div className={`bg-${integration.color} text-white rounded-circle p-3 me-3`} style={{ minWidth: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className={`fas fa-${integration.icon} fa-lg`}></i>
                      </div>
                      <div>
                        <h5 className="mb-0">{integration.name}</h5>
                        <Badge bg={isEnabled ? 'success' : 'secondary'} className="mt-1">
                          {isEnabled ? 'Đã kích hoạt' : 'Chưa kích hoạt'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <p className="text-muted small mb-3">{integration.description}</p>
                  <div className="d-flex gap-2">
                    <Button
                      variant={isEnabled ? 'outline-warning' : 'outline-primary'}
                      size="sm"
                      onClick={() => handleOpenConfig(integration.id)}
                    >
                      <i className={`fas fa-${isEnabled ? 'edit' : 'cog'} me-2`}></i>
                      {isEnabled ? 'Cấu hình' : 'Thiết lập'}
                    </Button>
                    {isEnabled && (
                      <Button
                        variant="outline-info"
                        size="sm"
                        onClick={() => handleTestConnection(integration.id)}
                      >
                        <i className="fas fa-plug me-2"></i>Kiểm tra
                      </Button>
                    )}
                  </div>
                </Card.Body>
              </Card>
            </div>
          );
        })}
      </div>

      {/* Configuration Modal */}
      <Modal show={showConfigModal} onHide={() => setShowConfigModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            Cấu hình {integrationTypes.find(i => i.id === selectedIntegration)?.name}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedIntegration === 'sso' && (
            <Form>
              <Form.Check
                type="switch"
                label="Kích hoạt SSO"
                checked={configs.sso.enabled}
                onChange={(e) => setConfigs({
                  ...configs,
                  sso: { ...configs.sso, enabled: e.target.checked }
                })}
                className="mb-3"
              />
              <Form.Group className="mb-3">
                <Form.Label>Provider</Form.Label>
                <Form.Select
                  value={configs.sso.provider}
                  onChange={(e) => setConfigs({
                    ...configs,
                    sso: { ...configs.sso, provider: e.target.value }
                  })}
                >
                  <option value="saml">SAML 2.0</option>
                  <option value="oauth">OAuth 2.0</option>
                  <option value="ldap">LDAP</option>
                </Form.Select>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>SSO URL</Form.Label>
                <Form.Control
                  type="text"
                  value={configs.sso.sso_url}
                  onChange={(e) => setConfigs({
                    ...configs,
                    sso: { ...configs.sso, sso_url: e.target.value }
                  })}
                  placeholder="https://sso.example.com/saml"
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Entity ID</Form.Label>
                <Form.Control
                  type="text"
                  value={configs.sso.entity_id}
                  onChange={(e) => setConfigs({
                    ...configs,
                    sso: { ...configs.sso, entity_id: e.target.value }
                  })}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Certificate</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={5}
                  value={configs.sso.certificate}
                  onChange={(e) => setConfigs({
                    ...configs,
                    sso: { ...configs.sso, certificate: e.target.value }
                  })}
                  placeholder="Paste certificate here"
                />
              </Form.Group>
            </Form>
          )}

          {selectedIntegration === 'smtp' && (
            <Form>
              <Form.Check
                type="switch"
                label="Kích hoạt SMTP"
                checked={configs.smtp.enabled}
                onChange={(e) => setConfigs({
                  ...configs,
                  smtp: { ...configs.smtp, enabled: e.target.checked }
                })}
                className="mb-3"
              />
              <div className="row">
                <div className="col-md-6">
                  <Form.Group className="mb-3">
                    <Form.Label>SMTP Host</Form.Label>
                    <Form.Control
                      type="text"
                      value={configs.smtp.host}
                      onChange={(e) => setConfigs({
                        ...configs,
                        smtp: { ...configs.smtp, host: e.target.value }
                      })}
                      placeholder="smtp.gmail.com"
                    />
                  </Form.Group>
                </div>
                <div className="col-md-6">
                  <Form.Group className="mb-3">
                    <Form.Label>Port</Form.Label>
                    <Form.Control
                      type="number"
                      value={configs.smtp.port}
                      onChange={(e) => setConfigs({
                        ...configs,
                        smtp: { ...configs.smtp, port: parseInt(e.target.value) }
                      })}
                    />
                  </Form.Group>
                </div>
              </div>
              <Form.Check
                type="checkbox"
                label="Use SSL/TLS"
                checked={configs.smtp.secure}
                onChange={(e) => setConfigs({
                  ...configs,
                  smtp: { ...configs.smtp, secure: e.target.checked }
                })}
                className="mb-3"
              />
              <Form.Group className="mb-3">
                <Form.Label>Username</Form.Label>
                <Form.Control
                  type="text"
                  value={configs.smtp.username}
                  onChange={(e) => setConfigs({
                    ...configs,
                    smtp: { ...configs.smtp, username: e.target.value }
                  })}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Password</Form.Label>
                <Form.Control
                  type="password"
                  value={configs.smtp.password}
                  onChange={(e) => setConfigs({
                    ...configs,
                    smtp: { ...configs.smtp, password: e.target.value }
                  })}
                />
              </Form.Group>
              <div className="row">
                <div className="col-md-6">
                  <Form.Group className="mb-3">
                    <Form.Label>From Email</Form.Label>
                    <Form.Control
                      type="email"
                      value={configs.smtp.from_email}
                      onChange={(e) => setConfigs({
                        ...configs,
                        smtp: { ...configs.smtp, from_email: e.target.value }
                      })}
                    />
                  </Form.Group>
                </div>
                <div className="col-md-6">
                  <Form.Group className="mb-3">
                    <Form.Label>From Name</Form.Label>
                    <Form.Control
                      type="text"
                      value={configs.smtp.from_name}
                      onChange={(e) => setConfigs({
                        ...configs,
                        smtp: { ...configs.smtp, from_name: e.target.value }
                      })}
                    />
                  </Form.Group>
                </div>
              </div>
            </Form>
          )}

          {selectedIntegration === 'video_conferencing' && (
            <Form>
              <Form.Check
                type="switch"
                label="Kích hoạt Video Conferencing"
                checked={configs.video_conferencing.enabled}
                onChange={(e) => setConfigs({
                  ...configs,
                  video_conferencing: { ...configs.video_conferencing, enabled: e.target.checked }
                })}
                className="mb-3"
              />
              <Form.Group className="mb-3">
                <Form.Label>Provider</Form.Label>
                <Form.Select
                  value={configs.video_conferencing.provider}
                  onChange={(e) => setConfigs({
                    ...configs,
                    video_conferencing: { ...configs.video_conferencing, provider: e.target.value }
                  })}
                >
                  <option value="bigbluebutton">BigBlueButton</option>
                  <option value="zoom">Zoom</option>
                  <option value="teams">Microsoft Teams</option>
                </Form.Select>
              </Form.Group>
              {configs.video_conferencing.provider === 'bigbluebutton' && (
                <>
                  <Form.Group className="mb-3">
                    <Form.Label>BBB URL</Form.Label>
                    <Form.Control
                      type="text"
                      value={configs.video_conferencing.bbb_url}
                      onChange={(e) => setConfigs({
                        ...configs,
                        video_conferencing: { ...configs.video_conferencing, bbb_url: e.target.value }
                      })}
                      placeholder="https://bbb.example.com"
                    />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>BBB Secret</Form.Label>
                    <Form.Control
                      type="password"
                      value={configs.video_conferencing.bbb_secret}
                      onChange={(e) => setConfigs({
                        ...configs,
                        video_conferencing: { ...configs.video_conferencing, bbb_secret: e.target.value }
                      })}
                    />
                  </Form.Group>
                </>
              )}
              {configs.video_conferencing.provider === 'zoom' && (
                <>
                  <Form.Group className="mb-3">
                    <Form.Label>Zoom API Key</Form.Label>
                    <Form.Control
                      type="text"
                      value={configs.video_conferencing.zoom_api_key}
                      onChange={(e) => setConfigs({
                        ...configs,
                        video_conferencing: { ...configs.video_conferencing, zoom_api_key: e.target.value }
                      })}
                    />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>Zoom API Secret</Form.Label>
                    <Form.Control
                      type="password"
                      value={configs.video_conferencing.zoom_api_secret}
                      onChange={(e) => setConfigs({
                        ...configs,
                        video_conferencing: { ...configs.video_conferencing, zoom_api_secret: e.target.value }
                      })}
                    />
                  </Form.Group>
                </>
              )}
              {configs.video_conferencing.provider === 'teams' && (
                <>
                  <Form.Group className="mb-3">
                    <Form.Label>Teams Client ID</Form.Label>
                    <Form.Control
                      type="text"
                      value={configs.video_conferencing.teams_client_id}
                      onChange={(e) => setConfigs({
                        ...configs,
                        video_conferencing: { ...configs.video_conferencing, teams_client_id: e.target.value }
                      })}
                    />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>Teams Client Secret</Form.Label>
                    <Form.Control
                      type="password"
                      value={configs.video_conferencing.teams_client_secret}
                      onChange={(e) => setConfigs({
                        ...configs,
                        video_conferencing: { ...configs.video_conferencing, teams_client_secret: e.target.value }
                      })}
                    />
                  </Form.Group>
                </>
              )}
            </Form>
          )}

          {selectedIntegration === 'storage' && (
            <Form>
              <Form.Check
                type="switch"
                label="Kích hoạt Cloud Storage"
                checked={configs.storage.enabled}
                onChange={(e) => setConfigs({
                  ...configs,
                  storage: { ...configs.storage, enabled: e.target.checked }
                })}
                className="mb-3"
              />
              <Form.Group className="mb-3">
                <Form.Label>Provider</Form.Label>
                <Form.Select
                  value={configs.storage.provider}
                  onChange={(e) => setConfigs({
                    ...configs,
                    storage: { ...configs.storage, provider: e.target.value }
                  })}
                >
                  <option value="local">Local Storage</option>
                  <option value="s3">AWS S3</option>
                  <option value="azure">Azure Blob Storage</option>
                </Form.Select>
              </Form.Group>
              {configs.storage.provider === 's3' && (
                <>
                  <Form.Group className="mb-3">
                    <Form.Label>S3 Bucket</Form.Label>
                    <Form.Control
                      type="text"
                      value={configs.storage.s3_bucket}
                      onChange={(e) => setConfigs({
                        ...configs,
                        storage: { ...configs.storage, s3_bucket: e.target.value }
                      })}
                    />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>S3 Region</Form.Label>
                    <Form.Control
                      type="text"
                      value={configs.storage.s3_region}
                      onChange={(e) => setConfigs({
                        ...configs,
                        storage: { ...configs.storage, s3_region: e.target.value }
                      })}
                      placeholder="us-east-1"
                    />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>Access Key</Form.Label>
                    <Form.Control
                      type="text"
                      value={configs.storage.s3_access_key}
                      onChange={(e) => setConfigs({
                        ...configs,
                        storage: { ...configs.storage, s3_access_key: e.target.value }
                      })}
                    />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>Secret Key</Form.Label>
                    <Form.Control
                      type="password"
                      value={configs.storage.s3_secret_key}
                      onChange={(e) => setConfigs({
                        ...configs,
                        storage: { ...configs.storage, s3_secret_key: e.target.value }
                      })}
                    />
                  </Form.Group>
                </>
              )}
            </Form>
          )}

          {/* Add more integration configs as needed */}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowConfigModal(false)}>
            Hủy
          </Button>
          <Button variant="info" onClick={() => handleTestConnection(selectedIntegration)}>
            <i className="fas fa-plug me-2"></i>Kiểm tra kết nối
          </Button>
          <Button variant="primary" onClick={() => handleSaveConfig(selectedIntegration)}>
            <i className="fas fa-save me-2"></i>Lưu cấu hình
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Integrations;
