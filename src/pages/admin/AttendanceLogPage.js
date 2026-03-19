import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Modal, Spinner, Badge } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import Pagination from '../../components/Pagination';
import ImageZoomModal from '../../components/ImageZoomModal';
import usePageTitle from '../../hooks/usePageTitle';
import { getUploadsBaseURL, getSocketUrl } from '../../utils/api';
import io from 'socket.io-client';
import '../../styles/user.css';

const PLACEHOLDER_SVG = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2RkZGRkZCI+PC9yZWN0Pjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBhbGlnbm1lbnQtYmFzZWxpbmU9Im1pZGRsZSIgZmlsbD0iIzk5OTk5OSI+Tm8gaW1hZ2U8L3RleHQ+PC9zdmc+';

const AttendanceLogPage = () => {
  usePageTitle('Nhật ký điểm danh');
  const { api } = useAuth();

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    totalItems: 0,
    totalPages: 0
  });

  const [filters, setFilters] = useState({
    search: '',
    class_name: '',
    faculty_name: '',
    attendanceType: '',
    deviceType: '',
    location: '',
    sessionTitle: ''
  });

  const [classes, setClasses] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [sessions, setSessions] = useState([]);

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  const socketRef = useRef(null);
  const paginationRef = useRef(pagination);
  const fetchRecordsRef = useRef(() => {});
  paginationRef.current = pagination;

  const getImageUrl = (path) => {
    if (!path) return PLACEHOLDER_SVG;
    const base = getUploadsBaseURL();
    return `${base}${path.startsWith('/uploads/') ? path : `/uploads/${path.split('/').pop()}`}`;
  };

  const formatDateTime = (value) => {
    if (!value) return '—';
    try {
      const d = new Date(value);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch { return '—'; }
  };

  const getAttendanceTypeBadge = (type) => {
    const map = {
      'before': { label: 'Trước buổi học', bg: 'info' },
      'present': { label: 'Có mặt', bg: 'success' },
      'during': { label: 'Trong buổi học', bg: 'primary' },
      'after': { label: 'Sau buổi học', bg: 'secondary' },
      'late': { label: 'Trễ', bg: 'warning' },
      'late_before': { label: 'Trễ (trước)', bg: 'warning' },
      'early': { label: 'Sớm', bg: 'info' },
      'absent': { label: 'Vắng', bg: 'danger' }
    };
    const info = map[type] || { label: type || 'Không xác định', bg: 'secondary' };
    return <Badge bg={info.bg}>{info.label}</Badge>;
  };

  const getDeviceLabel = (ua) => {
    if (!ua) return '—';
    if (/mobile|android|iphone|ipad/i.test(ua)) return 'Di động';
    if (/windows/i.test(ua)) return 'Máy tính (Windows)';
    // Mac desktop: macintosh, mac os, macos - loại trừ iPhone/iPad/Android
    if (/(?:macintosh|mac os|macos)/i.test(ua) && !/iphone|ipad|android/i.test(ua)) return 'Máy tính (Mac)';
    // Linux desktop: linux hoặc x11, loại trừ Android (Android cũng chứa "Linux")
    if ((/linux/i.test(ua) || /x11/i.test(ua)) && !/android/i.test(ua)) return 'Máy tính (Linux)';
    return 'Khác';
  };

  const fetchFilters = useCallback(async () => {
    try {
      const [classRes, hospitalRes, sessionRes] = await Promise.all([
        api.get('/attendance/classes'),
        api.get('/attendance/hospitals'),
        api.get('/attendance/sessions')
      ]);
      if (classRes.data?.success && classRes.data.data) {
        const classNames = [...new Set(classRes.data.data.map(c => c.class_name || c.name).filter(Boolean))];
        setClasses(classNames);
        const uniqueFaculties = [...new Set(classRes.data.data.map(c => c.faculty_name).filter(Boolean))];
        setFaculties(uniqueFaculties);
      }
      if (hospitalRes.data?.success && hospitalRes.data.data) {
        const items = hospitalRes.data.data.map((h) => {
          if (typeof h === 'string') return h;
          if (h && typeof h === 'object') return h.name ?? h.location ?? h.label ?? Object.values(h)[0];
          return null;
        }).filter((v) => v && String(v).trim());
        setHospitals([...new Set(items)]);
      }
      if (sessionRes.data?.success && sessionRes.data.data) {
        setSessions(sessionRes.data.data.map(s => ({ id: s.id, title: s.title || s.id })).filter(s => s.title));
      }
    } catch (err) {
      console.error('Error fetching filters:', err);
    }
  }, [api]);

  const fetchRecords = useCallback(async (page = 1, options = {}) => {
    const silent = !!options.silent;
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        sortField: 'timestamp',
        sortOrder: 'desc'
      });
      if (filters.search?.trim()) params.append('studentName', filters.search.trim());
      if (filters.class_name) params.append('className', filters.class_name);
      if (filters.faculty_name) params.append('facultyName', filters.faculty_name);
      if (filters.attendanceType) params.append('attendanceType', filters.attendanceType);
      if (filters.deviceType) params.append('deviceType', filters.deviceType);
      if (filters.location) params.append('location', filters.location);
      if (filters.sessionTitle) params.append('sessionTitle', filters.sessionTitle);

      const res = await api.get(`/attendance/custom-report?${params.toString()}`);
      if (res.data?.success) {
        setRecords(res.data.data || []);
        setPagination({
          page: res.data.pagination?.page || 1,
          limit: res.data.pagination?.limit || 20,
          totalItems: res.data.pagination?.totalItems || 0,
          totalPages: res.data.pagination?.totalPages || 0
        });
      }
    } catch (err) {
      if (!silent) console.error('Error fetching attendance log:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [api, filters]);

  fetchRecordsRef.current = fetchRecords;

  useEffect(() => { fetchFilters(); }, [fetchFilters]);
  useEffect(() => { fetchRecords(1); }, [fetchRecords]);

  // Socket: cập nhật real-time khi có điểm danh mới (event-driven)
  useEffect(() => {
    const socketUrl = getSocketUrl();
    if (!socketUrl) return;
    const socket = io(socketUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 30,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });
    socketRef.current = socket;
    const onConnect = () => {
      socket.emit('attendance_log:join');
    };
    const onAttendanceNew = () => {
      const page = paginationRef.current?.page || 1;
      const fn = fetchRecordsRef.current;
      if (typeof fn === 'function') fn(page, { silent: true });
    };
    socket.on('connect', onConnect);
    socket.on('attendance:new', onAttendanceNew);
    socket.on('reconnect', onConnect); // Rejoin room sau khi reconnect
    if (socket.connected) onConnect();
    return () => {
      socket.off('connect', onConnect);
      socket.off('reconnect', onConnect);
      socket.off('attendance:new', onAttendanceNew);
      socket.emit('attendance_log:leave');
      socket.disconnect();
    };
  }, []); // Không phụ thuộc fetchRecords để tránh ngắt kết nối khi đổi bộ lọc

  // Fallback polling: refetch mỗi 15s khi tab đang hiển thị (phòng socket lỗi)
  useEffect(() => {
    const POLL_INTERVAL = 15000;
    const poll = () => {
      if (document.visibilityState === 'visible') {
        const page = paginationRef.current?.page || 1;
        fetchRecordsRef.current?.(page, { silent: true });
      }
    };
    const id = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(id);
  }, []); // Socket ổn định, không reconnect khi đổi filter

  const handlePageChange = (page) => {
    setPagination(prev => ({ ...prev, page }));
    fetchRecords(page);
  };

  const handleRowClick = (record) => {
    setSelectedRecord(record);
    setShowDetailModal(true);
  };

  const handleImageClick = (e, imgPath) => {
    e.stopPropagation();
    if (imgPath) {
      setSelectedImage(imgPath);
      setShowImageModal(true);
    }
  };

  const handleClearFilters = () => {
    setFilters({
      search: '',
      class_name: '',
      faculty_name: '',
      attendanceType: '',
      deviceType: '',
      location: '',
      sessionTitle: ''
    });
  };

  return (
    <div className="session-list-page">
      {/* Search & Filters - thiết kế giống Exams.js */}
      <div className="session-list-controls">
        <div className="search-controls">
          <div className="search-input" style={{ minWidth: '250px', flex: '1' }}>
            <input
              type="text"
              placeholder="Tìm kiếm theo tên sinh viên..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              style={{ width: '100%' }}
            />
          </div>

          <select
            className="filter-select"
            value={filters.class_name}
            onChange={(e) => setFilters({ ...filters, class_name: e.target.value })}
          >
            <option value="">Tất cả lớp</option>
            {classes.map((c, i) => (
              <option key={i} value={c}>{c}</option>
            ))}
          </select>

          <select
            className="filter-select"
            value={filters.faculty_name}
            onChange={(e) => setFilters({ ...filters, faculty_name: e.target.value })}
          >
            <option value="">Tất cả khoa</option>
            {faculties.map((f, i) => (
              <option key={i} value={f}>{f}</option>
            ))}
          </select>

          <select
            className="filter-select"
            value={filters.attendanceType}
            onChange={(e) => setFilters({ ...filters, attendanceType: e.target.value })}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="present">Có mặt</option>
            <option value="before">Trước buổi học</option>
            <option value="during">Trong buổi học</option>
            <option value="after">Sau buổi học</option>
            <option value="late">Trễ</option>
            <option value="late_before">Trễ (trước)</option>
            <option value="early">Sớm</option>
            <option value="absent">Vắng</option>
          </select>

          <select
            className="filter-select"
            value={filters.deviceType}
            onChange={(e) => setFilters({ ...filters, deviceType: e.target.value })}
          >
            <option value="">Tất cả thiết bị</option>
            <option value="mobile">Di động</option>
            <option value="windows">Máy tính (Windows)</option>
            <option value="mac">Máy tính (Mac)</option>
            <option value="linux">Máy tính (Linux)</option>
            <option value="other">Khác</option>
          </select>

          <select
            className="filter-select"
            value={filters.location}
            onChange={(e) => setFilters({ ...filters, location: e.target.value })}
          >
            <option value="">Tất cả bệnh viện</option>
            {hospitals.map((h, i) => (
              <option key={i} value={h}>{h}</option>
            ))}
          </select>

          <select
            className="filter-select"
            value={filters.sessionTitle}
            onChange={(e) => setFilters({ ...filters, sessionTitle: e.target.value })}
          >
            <option value="">Tất cả buổi học</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.title}>{s.title}</option>
            ))}
          </select>

          <button className="filter-btn btn btn-outline-secondary" onClick={handleClearFilters}>
            <i className="fas fa-times me-1"></i>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="session-table-container">
        <div className="table-responsive-mobile">
          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" />
              <p className="mt-2 text-muted">Đang tải dữ liệu...</p>
            </div>
          ) : (
            <table className="session-table students-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Họ và tên</th>
                  <th>Lớp</th>
                  <th className="mobile-hide">Khoa</th>
                  <th>Tên buổi học</th>
                  <th className="mobile-hide">Địa điểm</th>
                  <th>Trạng thái</th>
                  <th className="mobile-hide">Thiết bị</th>
                  <th>Thời gian điểm danh</th>
                  <th className="mobile-hide">Hình ảnh</th>
                </tr>
              </thead>
              <tbody>
                {records.length > 0 ? (
                  records.map((record, index) => (
                    <tr key={`${record.id}-${record.source}-${index}`} onClick={() => handleRowClick(record)} style={{ cursor: 'pointer' }}>
                      <td>{(pagination.page - 1) * pagination.limit + index + 1}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{record.student_name || '—'}</div>
                      </td>
                      <td>{record.class_name || '—'}</td>
                      <td className="mobile-hide">{record.faculty_name || '—'}</td>
                      <td>
                        <div style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {record.session_title || '—'}
                        </div>
                      </td>
                      <td className="mobile-hide">{record.session_location || '—'}</td>
                      <td>{getAttendanceTypeBadge(record.attendance_type)}</td>
                      <td className="mobile-hide">{getDeviceLabel(record.user_agent)}</td>
                      <td>{formatDateTime(record.timestamp || record.created_at)}</td>
                      <td className="mobile-hide">
                        {record.profile_image ? (
                          <img
                            src={getImageUrl(record.profile_image)}
                            alt="Ảnh điểm danh"
                            style={{ width: 96, height: 96, borderRadius: 8, objectFit: 'cover', cursor: 'pointer', border: '2px solid #dee2e6' }}
                            onClick={(e) => handleImageClick(e, record.profile_image)}
                            onError={(e) => { if (!e.target.src.includes('data:image/svg+xml')) e.target.src = PLACEHOLDER_SVG; }}
                          />
                        ) : (
                          <span className="text-muted" style={{ fontSize: '0.85rem' }}>Không có</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="10" className="text-center py-4">
                      <i className="fas fa-inbox text-muted" style={{ fontSize: '2rem' }}></i>
                      <p className="mt-2 mb-0 text-muted">Không có dữ liệu điểm danh</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {records.length > 0 && pagination.totalPages > 1 && (
          <div className="mt-3">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={handlePageChange}
              maxVisiblePages={5}
              showFirstLast={true}
            />
          </div>
        )}

        {!loading && records.length > 0 && (
          <div className="text-muted text-center mt-2" style={{ fontSize: '0.85rem' }}>
            Hiển thị {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.totalItems)} / {pagination.totalItems} bản ghi
          </div>
        )}
      </div>

      {/* Detail Modal - thiết kế giống UserManagement.js, ảnh ở trên */}
      <Modal show={showDetailModal} onHide={() => setShowDetailModal(false)} size="xl" centered className="student-detail-modal attendance-log-detail-modal">
        <Modal.Header closeButton className="student-detail-header">
          <Modal.Title className="student-detail-title">
            <div className="student-avatar">
              <i className="fas fa-clipboard-check"></i>
            </div>
            <div>
              <h4 className="mb-0">{selectedRecord?.student_name || 'Chi tiết điểm danh'}</h4>
              <p className="mb-0 student-subtitle">
                {selectedRecord?.session_title || '—'} • {formatDateTime(selectedRecord?.timestamp || selectedRecord?.created_at)}
              </p>
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="student-detail-body">
          {selectedRecord && (
            <div className="student-detail-container">
              {/* Ảnh ở trên - luôn hiển thị (placeholder khi không có ảnh) */}
              <div className="text-center mb-4">
                <img
                  src={selectedRecord.profile_image ? getImageUrl(selectedRecord.profile_image) : PLACEHOLDER_SVG}
                  alt="Ảnh điểm danh"
                  className="img-fluid rounded-3 shadow-sm"
                  style={{
                    maxHeight: 320,
                    objectFit: 'contain',
                    border: '2px solid #e9ecef',
                    cursor: selectedRecord.profile_image ? 'pointer' : 'default'
                  }}
                  onClick={() => selectedRecord.profile_image && (setSelectedImage(selectedRecord.profile_image), setShowImageModal(true))}
                  onError={(e) => { if (!e.target.src.includes('data:image/svg+xml')) e.target.src = PLACEHOLDER_SVG; }}
                />
              </div>

              {/* Thông tin chi tiết - session-card giống UserManagement */}
              <div className="row g-3">
                <div className="col-md-6">
                  <div className="session-card">
                    <div className="card-header-modern">
                      <div className="header-icon">
                        <i className="fas fa-user-graduate"></i>
                      </div>
                      <h6 className="mb-0">Thông tin sinh viên</h6>
                    </div>
                    <div className="card-body-modern">
                      <div className="info-item">
                        <div className="info-label"><i className="fas fa-user"></i> Họ và tên</div>
                        <div className="info-value">{selectedRecord.student_name || '—'}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label"><i className="fas fa-id-card"></i> Mã sinh viên</div>
                        <div className="info-value">{selectedRecord.student_code || '—'}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label"><i className="fas fa-envelope"></i> Email</div>
                        <div className="info-value">{selectedRecord.student_email || '—'}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label"><i className="fas fa-school"></i> Lớp</div>
                        <div className="info-value">{selectedRecord.class_name || '—'}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label"><i className="fas fa-university"></i> Khoa</div>
                        <div className="info-value">{selectedRecord.faculty_name || '—'}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label"><i className="fas fa-users"></i> Nhóm</div>
                        <div className="info-value">{selectedRecord.group_name || '—'}</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="session-card">
                    <div className="card-header-modern">
                      <div className="header-icon">
                        <i className="fas fa-clipboard-list"></i>
                      </div>
                      <h6 className="mb-0">Thông tin điểm danh</h6>
                    </div>
                    <div className="card-body-modern">
                      <div className="info-item">
                        <div className="info-label"><i className="fas fa-book"></i> Tên buổi học</div>
                        <div className="info-value">{selectedRecord.session_title || '—'}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label"><i className="fas fa-map-marker-alt"></i> Địa điểm</div>
                        <div className="info-value">{selectedRecord.session_location || '—'}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label"><i className="fas fa-check-circle"></i> Trạng thái</div>
                        <div className="info-value">{getAttendanceTypeBadge(selectedRecord.attendance_type)}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label"><i className="fas fa-laptop"></i> Thiết bị</div>
                        <div className="info-value">{getDeviceLabel(selectedRecord.user_agent)}</div>
                      </div>
                      <div className="info-item">
                        <div className="info-label"><i className="fas fa-clock"></i> Thời gian điểm danh</div>
                        <div className="info-value">{formatDateTime(selectedRecord.timestamp || selectedRecord.created_at)}</div>
                      </div>
                      {(selectedRecord.minutes_early > 0 || selectedRecord.minutes_late > 0) && (
                        <div className="info-item">
                          <div className="info-label"><i className="fas fa-hourglass-half"></i> Ghi chú</div>
                          <div className="info-value">
                            {selectedRecord.minutes_early > 0 && <Badge bg="info" className="me-1">Sớm {selectedRecord.minutes_early} phút</Badge>}
                            {selectedRecord.minutes_late > 0 && <Badge bg="warning">Trễ {selectedRecord.minutes_late} phút</Badge>}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="student-detail-footer">
          <button className="btn btn-secondary" onClick={() => setShowDetailModal(false)}>Đóng</button>
        </Modal.Footer>
      </Modal>

      {/* Image Zoom Modal - cuộn chuột thu phóng, kéo di chuyển, Esc đóng */}
      <ImageZoomModal
        isOpen={showImageModal && !!selectedImage}
        imageUrl={selectedImage ? getImageUrl(selectedImage) : null}
        onClose={() => { setShowImageModal(false); setSelectedImage(null); }}
        downloadFileName="anh-diem-danh.png"
      />
    </div>
  );
};

export default AttendanceLogPage;
