import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Tab, Tabs, Alert, Badge, Accordion, ProgressBar } from 'react-bootstrap';
import axios from 'axios';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

const CoursesEnhanced = () => {
  usePageTitle('Khóa học nâng cao');
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedModule, setSelectedModule] = useState(null);
  const [expandedCourse, setExpandedCourse] = useState(null);
  const [courseModules, setCourseModules] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [alert, setAlert] = useState({ show: false, message: '', variant: '' });

  // Filters
  const [filters, setFilters] = useState({
    search: '',
    department: '',
    status: '',
    level: ''
  });

  // Form data
  const [courseForm, setCourseForm] = useState({
    course_code: '',
    course_name: '',
    description: '',
    department: '',
    credits: 0,
    total_hours: 0,
    course_level: 'undergraduate',
    course_status: 'draft'
  });

  const [moduleForm, setModuleForm] = useState({
    module_title: '',
    module_description: '',
    is_published: false
  });

  const [lessonForm, setLessonForm] = useState({
    lesson_title: '',
    lesson_type: 'lecture',
    content_html: '',
    duration_minutes: 0,
    is_mandatory: true
  });

  useEffect(() => {
    fetchCourses();
  }, [filters]);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();

      if (filters.search) params.append('search', filters.search);
      if (filters.department) params.append('department', filters.department);
      if (filters.status) params.append('status', filters.status);
      if (filters.level) params.append('level', filters.level);

      const response = await axios.get(`${API_BASE_URL}/lms/courses?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setCourses(response.data.data.courses || []);
    } catch (error) {
      console.error('Error fetching courses:', error);
      showAlert('Lỗi khi tải danh sách khóa học', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const fetchCourseModules = async (courseId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/lms/courses/${courseId}/modules`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setCourseModules(response.data.data || []);
    } catch (error) {
      console.error('Error fetching modules:', error);
      showAlert('Lỗi khi tải danh sách module', 'danger');
    }
  };

  const handleCreateCourse = () => {
    setEditMode(false);
    setCourseForm({
      course_code: '',
      course_name: '',
      description: '',
      department: '',
      credits: 0,
      total_hours: 0,
      course_level: 'undergraduate',
      course_status: 'draft'
    });
    setShowCourseModal(true);
  };

  const handleEditCourse = (course) => {
    setEditMode(true);
    setSelectedCourse(course);
    setCourseForm({
      course_code: course.course_code,
      course_name: course.course_name,
      description: course.description || '',
      department: course.department || '',
      credits: course.credits || 0,
      total_hours: course.total_hours || 0,
      course_level: course.course_level,
      course_status: course.course_status
    });
    setShowCourseModal(true);
  };

  const handleSubmitCourse = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('token');
      if (editMode && selectedCourse) {
        await axios.put(
          `${API_BASE_URL}/lms/courses/${selectedCourse.course_id}`,
          courseForm,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        showAlert('Cập nhật khóa học thành công', 'success');
      } else {
        await axios.post(
          `${API_BASE_URL}/lms/courses`,
          courseForm,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        showAlert('Tạo khóa học thành công', 'success');
      }

      setShowCourseModal(false);
      fetchCourses();
    } catch (error) {
      console.error('Error saving course:', error);
      showAlert(error.response?.data?.message || 'Lỗi khi lưu khóa học', 'danger');
    }
  };

  const handleDeleteCourse = async (courseId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa khóa học này?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE_URL}/lms/courses/${courseId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      showAlert('Xóa khóa học thành công', 'success');
      fetchCourses();
    } catch (error) {
      console.error('Error deleting course:', error);
      showAlert(error.response?.data?.message || 'Lỗi khi xóa khóa học', 'danger');
    }
  };

  const handleCloneCourse = async (courseId) => {
    const newCourseCode = prompt('Nhập mã khóa học mới:');
    const newCourseName = prompt('Nhập tên khóa học mới:');

    if (!newCourseCode || !newCourseName) return;

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_BASE_URL}/lms/courses/${courseId}/clone`,
        { new_course_code: newCourseCode, new_course_name: newCourseName },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      showAlert('Sao chép khóa học thành công', 'success');
      fetchCourses();
    } catch (error) {
      console.error('Error cloning course:', error);
      showAlert(error.response?.data?.message || 'Lỗi khi sao chép khóa học', 'danger');
    }
  };

  const handleExpandCourse = async (courseId) => {
    if (expandedCourse === courseId) {
      setExpandedCourse(null);
    } else {
      setExpandedCourse(courseId);
      await fetchCourseModules(courseId);
    }
  };

  const handleCreateModule = (courseId) => {
    setSelectedCourse({ course_id: courseId });
    setModuleForm({
      module_title: '',
      module_description: '',
      is_published: false
    });
    setShowModuleModal(true);
  };

  const handleSubmitModule = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_BASE_URL}/lms/courses/${selectedCourse.course_id}/modules`,
        moduleForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      showAlert('Tạo module thành công', 'success');
      setShowModuleModal(false);
      fetchCourseModules(selectedCourse.course_id);
    } catch (error) {
      console.error('Error creating module:', error);
      showAlert(error.response?.data?.message || 'Lỗi khi tạo module', 'danger');
    }
  };

  const handleCreateLesson = (moduleId) => {
    setSelectedModule({ module_id: moduleId });
    setLessonForm({
      lesson_title: '',
      lesson_type: 'lecture',
      content_html: '',
      duration_minutes: 0,
      is_mandatory: true
    });
    setShowLessonModal(true);
  };

  const handleSubmitLesson = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_BASE_URL}/lms/modules/${selectedModule.module_id}/lessons`,
        lessonForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      showAlert('Tạo bài học thành công', 'success');
      setShowLessonModal(false);
      fetchCourseModules(expandedCourse);
    } catch (error) {
      console.error('Error creating lesson:', error);
      showAlert(error.response?.data?.message || 'Lỗi khi tạo bài học', 'danger');
    }
  };

  const showAlert = (message, variant) => {
    setAlert({ show: true, message, variant });
    setTimeout(() => setAlert({ show: false, message: '', variant: '' }), 5000);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      draft: { bg: 'secondary', text: 'Nháp' },
      published: { bg: 'success', text: 'Đã xuất bản' },
      archived: { bg: 'warning', text: 'Đã lưu trữ' }
    };

    const config = statusConfig[status] || statusConfig.draft;
    return <Badge bg={config.bg}>{config.text}</Badge>;
  };

  const getLevelBadge = (level) => {
    const levelConfig = {
      undergraduate: { bg: 'primary', text: 'Đại học' },
      graduate: { bg: 'info', text: 'Sau đại học' },
      postgraduate: { bg: 'warning', text: 'Tiến sĩ' },
      continuing_education: { bg: 'secondary', text: 'Đào tạo liên tục' }
    };

    const config = levelConfig[level] || levelConfig.undergraduate;
    return <Badge bg={config.bg}>{config.text}</Badge>;
  };

  return (
    <div className="container-fluid session-main-container">
      {/* Header */}
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Quản lý Khóa học</h1>
            <p className="header-subtitle">Tạo, chỉnh sửa và quản lý khóa học, module, bài học</p>
          </div>
          <div className="header-actions">
            <Button variant="light" className="create-session-btn" onClick={handleCreateCourse}>
              <i className="fas fa-plus me-2"></i>Tạo khóa học mới
            </Button>
          </div>
        </div>
      </div>

      {/* Alert */}
      {alert.show && (
        <Alert variant={alert.variant} dismissible onClose={() => setAlert({ ...alert, show: false })}>
          {alert.message}
        </Alert>
      )}

      {/* Filters */}
      <div className="session-list-controls">
        <div className="search-controls">
          <div className="search-input">
            <input
              type="text"
              placeholder="Tìm theo tên khóa, mã, mô tả..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>
          <select
            className="filter-select"
            value={filters.department}
            onChange={(e) => setFilters({ ...filters, department: e.target.value })}
          >
            <option value="">Tất cả khoa</option>
            <option value="Nội">Khoa Nội</option>
            <option value="Ngoại">Khoa Ngoại</option>
            <option value="Sản">Khoa Sản</option>
            <option value="Nhi">Khoa Nhi</option>
            <option value="Kỹ năng">Kỹ năng lâm sàng</option>
          </select>
          <select
            className="filter-select"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="draft">Nháp</option>
            <option value="published">Đã xuất bản</option>
            <option value="archived">Đã lưu trữ</option>
          </select>
          <select
            className="filter-select"
            value={filters.level}
            onChange={(e) => setFilters({ ...filters, level: e.target.value })}
          >
            <option value="">Tất cả cấp độ</option>
            <option value="undergraduate">Đại học</option>
            <option value="graduate">Sau đại học</option>
            <option value="postgraduate">Tiến sĩ</option>
            <option value="continuing_education">Đào tạo liên tục</option>
          </select>
        </div>
      </div>

      {/* Courses List */}
      <div className="session-table-container">
        {loading ? (
          <div className="text-center p-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Đang tải...</span>
            </div>
          </div>
        ) : (
          <div className="table-responsive-mobile">
            <table className="session-table">
              <thead>
                <tr>
                  <th>Mã khóa</th>
                  <th>Tên khóa học</th>
                  <th>Khoa</th>
                  <th>Tín chỉ / Giờ</th>
                  <th>Cấp độ</th>
                  <th>Trạng thái</th>
                  <th>Module / Bài học</th>
                  <th>Sinh viên</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {courses.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center p-4">
                      <i className="fas fa-inbox fa-3x text-muted mb-3"></i>
                      <p className="text-muted">Chưa có khóa học nào</p>
                    </td>
                  </tr>
                ) : (
                  courses.map((course) => (
                    <React.Fragment key={course.course_id}>
                      <tr>
                        <td>
                          <span className="badge bg-secondary">{course.course_code}</span>
                        </td>
                        <td>
                          <strong>{course.course_name}</strong>
                          {course.description && (
                            <div className="text-muted small">{course.description.substring(0, 80)}...</div>
                          )}
                        </td>
                        <td>
                          <span className="badge bg-info">{course.department || 'N/A'}</span>
                        </td>
                        <td>{course.credits || 0} TC / {course.total_hours || 0}h</td>
                        <td>{getLevelBadge(course.course_level)}</td>
                        <td>{getStatusBadge(course.course_status)}</td>
                        <td>
                          <Badge bg="primary">{course.modules_count || 0} modules</Badge>
                          {' '}
                          <Badge bg="info">{course.lessons_count || 0} bài</Badge>
                        </td>
                        <td>
                          <Badge bg="success">{course.enrolled_students || 0} SV</Badge>
                        </td>
                        <td>
                          <div className="action-buttons">
                            <Button
                              size="sm"
                              variant="outline-primary"
                              onClick={() => handleExpandCourse(course.course_id)}
                              title="Xem chi tiết"
                            >
                              <i className={`fas fa-chevron-${expandedCourse === course.course_id ? 'up' : 'down'}`}></i>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline-warning"
                              onClick={() => handleEditCourse(course)}
                              title="Sửa"
                            >
                              <i className="fas fa-edit"></i>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline-info"
                              onClick={() => handleCloneCourse(course.course_id)}
                              title="Sao chép"
                            >
                              <i className="fas fa-copy"></i>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline-danger"
                              onClick={() => handleDeleteCourse(course.course_id)}
                              title="Xóa"
                            >
                              <i className="fas fa-trash"></i>
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {expandedCourse === course.course_id && (
                        <tr>
                          <td colSpan="9" style={{ padding: 0 }}>
                            <div style={{ padding: '20px', background: '#f8f9fa' }}>
                              <div className="d-flex justify-content-between align-items-center mb-3">
                                <h5>Module & Bài học</h5>
                                <Button size="sm" variant="primary" onClick={() => handleCreateModule(course.course_id)}>
                                  <i className="fas fa-plus me-2"></i>Thêm Module
                                </Button>
                              </div>

                              {courseModules.length === 0 ? (
                                <div className="text-center p-4">
                                  <p className="text-muted">Chưa có module nào</p>
                                </div>
                              ) : (
                                <Accordion>
                                  {courseModules.map((module) => (
                                    <Accordion.Item key={module.module_id} eventKey={module.module_id.toString()}>
                                      <Accordion.Header>
                                        <div className="d-flex justify-content-between align-items-center w-100 pe-3">
                                          <div>
                                            <strong>Module {module.module_order}: {module.module_title}</strong>
                                            <Badge bg="secondary" className="ms-2">
                                              {module.lessons_count || 0} bài học
                                            </Badge>
                                          </div>
                                        </div>
                                      </Accordion.Header>
                                      <Accordion.Body>
                                        <div className="mb-3">
                                          <p className="text-muted">{module.module_description}</p>
                                        </div>

                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                          <h6>Bài học</h6>
                                          <Button size="sm" variant="outline-primary" onClick={() => handleCreateLesson(module.module_id)}>
                                            <i className="fas fa-plus me-2"></i>Thêm bài học
                                          </Button>
                                        </div>

                                        {module.lessons && module.lessons.length > 0 ? (
                                          <ul className="list-group">
                                            {module.lessons.map((lesson) => (
                                              <li key={lesson.lesson_id} className="list-group-item">
                                                <div className="d-flex justify-content-between align-items-center">
                                                  <div>
                                                    <i className={`fas fa-${getLessonIcon(lesson.lesson_type)} me-2`}></i>
                                                    <strong>{lesson.lesson_title}</strong>
                                                    <Badge bg="info" className="ms-2">{lesson.lesson_type}</Badge>
                                                    {lesson.duration_minutes > 0 && (
                                                      <Badge bg="secondary" className="ms-2">{lesson.duration_minutes} phút</Badge>
                                                    )}
                                                  </div>
                                                  <div>
                                                    <Button size="sm" variant="outline-warning" className="me-2">
                                                      <i className="fas fa-edit"></i>
                                                    </Button>
                                                    <Button size="sm" variant="outline-danger">
                                                      <i className="fas fa-trash"></i>
                                                    </Button>
                                                  </div>
                                                </div>
                                              </li>
                                            ))}
                                          </ul>
                                        ) : (
                                          <p className="text-muted">Chưa có bài học nào</p>
                                        )}
                                      </Accordion.Body>
                                    </Accordion.Item>
                                  ))}
                                </Accordion>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Course Modal */}
      <Modal show={showCourseModal} onHide={() => setShowCourseModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{editMode ? 'Chỉnh sửa khóa học' : 'Tạo khóa học mới'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmitCourse}>
          <Modal.Body>
            <Tabs defaultActiveKey="basic" className="mb-3">
              <Tab eventKey="basic" title="Thông tin cơ bản">
                <Form.Group className="mb-3">
                  <Form.Label>Mã khóa học *</Form.Label>
                  <Form.Control
                    type="text"
                    value={courseForm.course_code}
                    onChange={(e) => setCourseForm({ ...courseForm, course_code: e.target.value })}
                    required
                    disabled={editMode}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Tên khóa học *</Form.Label>
                  <Form.Control
                    type="text"
                    value={courseForm.course_name}
                    onChange={(e) => setCourseForm({ ...courseForm, course_name: e.target.value })}
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Mô tả</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={courseForm.description}
                    onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                  />
                </Form.Group>

                <div className="row">
                  <div className="col-md-6">
                    <Form.Group className="mb-3">
                      <Form.Label>Khoa</Form.Label>
                      <Form.Select
                        value={courseForm.department}
                        onChange={(e) => setCourseForm({ ...courseForm, department: e.target.value })}
                      >
                        <option value="">Chọn khoa</option>
                        <option value="Nội">Khoa Nội</option>
                        <option value="Ngoại">Khoa Ngoại</option>
                        <option value="Sản">Khoa Sản</option>
                        <option value="Nhi">Khoa Nhi</option>
                        <option value="Kỹ năng">Kỹ năng lâm sàng</option>
                      </Form.Select>
                    </Form.Group>
                  </div>
                  <div className="col-md-6">
                    <Form.Group className="mb-3">
                      <Form.Label>Cấp độ</Form.Label>
                      <Form.Select
                        value={courseForm.course_level}
                        onChange={(e) => setCourseForm({ ...courseForm, course_level: e.target.value })}
                      >
                        <option value="undergraduate">Đại học</option>
                        <option value="graduate">Sau đại học</option>
                        <option value="postgraduate">Tiến sĩ</option>
                        <option value="continuing_education">Đào tạo liên tục</option>
                      </Form.Select>
                    </Form.Group>
                  </div>
                </div>

                <div className="row">
                  <div className="col-md-4">
                    <Form.Group className="mb-3">
                      <Form.Label>Số tín chỉ</Form.Label>
                      <Form.Control
                        type="number"
                        step="0.1"
                        value={courseForm.credits}
                        onChange={(e) => setCourseForm({ ...courseForm, credits: parseFloat(e.target.value) })}
                      />
                    </Form.Group>
                  </div>
                  <div className="col-md-4">
                    <Form.Group className="mb-3">
                      <Form.Label>Tổng số giờ</Form.Label>
                      <Form.Control
                        type="number"
                        value={courseForm.total_hours}
                        onChange={(e) => setCourseForm({ ...courseForm, total_hours: parseInt(e.target.value) })}
                      />
                    </Form.Group>
                  </div>
                  <div className="col-md-4">
                    <Form.Group className="mb-3">
                      <Form.Label>Trạng thái</Form.Label>
                      <Form.Select
                        value={courseForm.course_status}
                        onChange={(e) => setCourseForm({ ...courseForm, course_status: e.target.value })}
                      >
                        <option value="draft">Nháp</option>
                        <option value="published">Đã xuất bản</option>
                        <option value="archived">Đã lưu trữ</option>
                      </Form.Select>
                    </Form.Group>
                  </div>
                </div>
              </Tab>

              <Tab eventKey="syllabus" title="Đề cương">
                <Form.Group className="mb-3">
                  <Form.Label>Nội dung đề cương</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={10}
                    placeholder="Nhập nội dung đề cương khóa học..."
                  />
                </Form.Group>
              </Tab>

              <Tab eventKey="outcomes" title="CLO/PLO">
                <Alert variant="info">
                  <i className="fas fa-info-circle me-2"></i>
                  Chức năng mapping CLO/PLO sẽ được hoàn thiện trong phiên bản tiếp theo.
                </Alert>
              </Tab>
            </Tabs>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowCourseModal(false)}>
              Hủy
            </Button>
            <Button variant="primary" type="submit">
              {editMode ? 'Cập nhật' : 'Tạo mới'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Module Modal */}
      <Modal show={showModuleModal} onHide={() => setShowModuleModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Tạo Module mới</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmitModule}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Tên module *</Form.Label>
              <Form.Control
                type="text"
                value={moduleForm.module_title}
                onChange={(e) => setModuleForm({ ...moduleForm, module_title: e.target.value })}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Mô tả</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={moduleForm.module_description}
                onChange={(e) => setModuleForm({ ...moduleForm, module_description: e.target.value })}
              />
            </Form.Group>

            <Form.Check
              type="checkbox"
              label="Xuất bản ngay"
              checked={moduleForm.is_published}
              onChange={(e) => setModuleForm({ ...moduleForm, is_published: e.target.checked })}
            />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowModuleModal(false)}>
              Hủy
            </Button>
            <Button variant="primary" type="submit">
              Tạo Module
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Lesson Modal */}
      <Modal show={showLessonModal} onHide={() => setShowLessonModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Tạo Bài học mới</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmitLesson}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Tên bài học *</Form.Label>
              <Form.Control
                type="text"
                value={lessonForm.lesson_title}
                onChange={(e) => setLessonForm({ ...lessonForm, lesson_title: e.target.value })}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Loại bài học</Form.Label>
              <Form.Select
                value={lessonForm.lesson_type}
                onChange={(e) => setLessonForm({ ...lessonForm, lesson_type: e.target.value })}
              >
                <option value="lecture">Bài giảng</option>
                <option value="video">Video</option>
                <option value="quiz">Quiz</option>
                <option value="assignment">Bài tập</option>
                <option value="discussion">Thảo luận</option>
                <option value="scorm">SCORM</option>
                <option value="xapi">xAPI</option>
                <option value="external_link">Link ngoài</option>
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Nội dung</Form.Label>
              <Form.Control
                as="textarea"
                rows={5}
                value={lessonForm.content_html}
                onChange={(e) => setLessonForm({ ...lessonForm, content_html: e.target.value })}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Thời lượng (phút)</Form.Label>
              <Form.Control
                type="number"
                value={lessonForm.duration_minutes}
                onChange={(e) => setLessonForm({ ...lessonForm, duration_minutes: parseInt(e.target.value) })}
              />
            </Form.Group>

            <Form.Check
              type="checkbox"
              label="Bắt buộc"
              checked={lessonForm.is_mandatory}
              onChange={(e) => setLessonForm({ ...lessonForm, is_mandatory: e.target.checked })}
            />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowLessonModal(false)}>
              Hủy
            </Button>
            <Button variant="primary" type="submit">
              Tạo Bài học
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

const getLessonIcon = (lessonType) => {
  const icons = {
    lecture: 'book',
    video: 'video',
    quiz: 'question-circle',
    assignment: 'tasks',
    discussion: 'comments',
    scorm: 'file-archive',
    xapi: 'exchange-alt',
    external_link: 'external-link-alt'
  };
  return icons[lessonType] || 'file';
};

export default CoursesEnhanced;



