import React, { useState, useEffect } from 'react';
import { Table, Button, Badge, Form, InputGroup, Modal, Spinner, Tabs, Tab, Card, Row, Col } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';
import { format, parseISO, isAfter, isBefore, isEqual, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameDay, isSameMonth, isSameWeek } from 'date-fns';
import { vi } from 'date-fns/locale';
import '../../styles/calendar.css';
import Loader from '../../components/Loader';

const SessionList = () => {
  const { currentUser, api } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  
  // Calendar state
  const [activeTab, setActiveTab] = useState(() => {
    const savedTab = localStorage.getItem('sessionListActiveTab');
    return savedTab || 'list';
  });
  const [calendarView, setCalendarView] = useState(() => {
    const savedView = localStorage.getItem('sessionListCalendarView');
    return savedView || 'month';
  }); // month, week, day
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [showSessionDetailModal, setShowSessionDetailModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  
  // Modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState(null);
  const [sessionNameConfirm, setSessionNameConfirm] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Định dạng ngày tháng
  const formatDate = (dateString) => {
    try {
      if (!dateString) return '';
      
      // The date is in YYYY-MM-DD format from the server
      // Parse it and convert to DD/MM/YYYY format
      const parts = dateString.split('-');
      if (parts.length !== 3) {
        console.error('Invalid date format:', dateString);
        return dateString;
      }
      
      const year = parts[0];
      const month = parts[1];
      const day = parts[2];
      
      return `${day}/${month}/${year}`;
    } catch (error) {
      console.error('Error formatting date:', error);
      return dateString;
    }
  };

  // Lấy thời gian hiện tại thực
  const getMockCurrentDate = () => {
    // Sử dụng thời gian thực tế, không còn giả lập
    return new Date();
  };

  // Tính toán trạng thái dựa trên ngày và thời gian
  const calculateSessionStatus = (session) => {
    try {
      // Sử dụng thời gian hiện tại thực
      const currentDate = getMockCurrentDate();
      const sessionDate = parseISO(session.date);
      
      // Chuẩn hóa ngày hiện tại để so sánh chỉ ngày
      const currentDateOnly = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
      const sessionDateOnly = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate());
      
      // Kiểm tra nếu buổi học bị hủy
      if (session.status === 'cancelled') {
        return 'cancelled';
      }
      
      // Buổi học trong tương lai
      if (isAfter(sessionDateOnly, currentDateOnly)) {
        return 'scheduled';
      }
      
      // Buổi học trong quá khứ
      if (isBefore(sessionDateOnly, currentDateOnly)) {
        return 'ended';
      }
      
      // Buổi học ngày hôm nay - cần kiểm tra thời gian
      if (isEqual(sessionDateOnly, currentDateOnly)) {
        // Chuyển đổi thời gian thành đối tượng Date để so sánh
        const startTimeParts = session.start_time.split(':');
        const endTimeParts = session.end_time.split(':');
        
        // Tạo đối tượng Date cho thời gian bắt đầu và kết thúc
        const startTime = new Date(currentDate);
        startTime.setHours(parseInt(startTimeParts[0]), parseInt(startTimeParts[1]), 0);
        
        const endTime = new Date(currentDate);
        endTime.setHours(parseInt(endTimeParts[0]), parseInt(endTimeParts[1]), 0);
        
        // Xử lý trường hợp thời gian kết thúc nhỏ hơn thời gian bắt đầu (qua ngày)
        if (parseInt(endTimeParts[0]) < parseInt(startTimeParts[0]) || 
            (parseInt(endTimeParts[0]) === parseInt(startTimeParts[0]) && 
             parseInt(endTimeParts[1]) < parseInt(startTimeParts[1]))) {
          endTime.setDate(endTime.getDate() + 1); // Tăng thêm 1 ngày cho thời gian kết thúc
        }
        
        // Đang diễn ra
        if (currentDate >= startTime && currentDate <= endTime) {
          return 'active';
        }
        
        // Đã kết thúc
        if (currentDate > endTime) {
          return 'ended';
        }
        
        // Sắp diễn ra
        if (currentDate < startTime) {
          return 'scheduled';
        }
      }
      
      // Mặc định giữ nguyên trạng thái
      return session.status;
    } catch (error) {
      console.error('Error calculating session status:', error);
      return session.status;
    }
  };

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoading(true);
        const response = await api.get('/sessions');
        if (response.data.success) {
          console.log('Sessions data:', response.data.data);
          // Cập nhật trạng thái dựa trên ngày và thời gian và parse monitoring_options
          const updatedSessions = response.data.data.map(session => {
            // Parse monitoring_options if it's a string
            let parsedMonitoringOptions = session.monitoring_options;
            if (typeof session.monitoring_options === 'string') {
              try {
                parsedMonitoringOptions = JSON.parse(session.monitoring_options);
              } catch (error) {
                console.error('Error parsing monitoring_options for session', session.id, ':', error);
                parsedMonitoringOptions = null;
              }
            }
            
            return {
              ...session,
              monitoring_options: parsedMonitoringOptions,
              calculatedStatus: calculateSessionStatus(session)
            };
          });
          setSessions(updatedSessions);
        } else {
          toast.error('Không thể tải danh sách buổi học');
        }
      } catch (error) {
        console.error('Error fetching sessions:', error);
        toast.error('Đã xảy ra lỗi khi tải danh sách buổi học');
      } finally {
        setLoading(false);
      }
    };
    
    fetchSessions();
    
    // Cập nhật trạng thái mỗi 10 giây (để demo nhanh hơn)
    const intervalId = setInterval(() => {
      setSessions(currentSessions => 
        currentSessions.map(session => ({
          ...session,
          calculatedStatus: calculateSessionStatus(session)
        }))
      );
    }, 10000);
    
    return () => clearInterval(intervalId);
  }, [api]);

  // Lưu trạng thái tab khi thay đổi
  useEffect(() => {
    localStorage.setItem('sessionListActiveTab', activeTab);
  }, [activeTab]);

  // Lưu trạng thái calendar view khi thay đổi
  useEffect(() => {
    localStorage.setItem('sessionListCalendarView', calendarView);
  }, [calendarView]);
  
  // Handle delete session
  const handleDeleteClick = (session) => {
    setSessionToDelete(session);
    setSessionNameConfirm('');
    setDeleteError('');
    setShowDeleteModal(true);
  };
  
  const handleDeleteConfirm = async () => {
    const sessionName = sessionToDelete?.title || sessionToDelete?.name;
    if (!sessionNameConfirm) {
      setDeleteError('Vui lòng nhập tên buổi học để xác nhận');
      return;
    }
    
    if (sessionNameConfirm !== sessionName) {
      setDeleteError('Tên buổi học không khớp. Vui lòng nhập lại chính xác.');
      return;
    }
    
    try {
      setDeleteLoading(true);
      setDeleteError('');
      
      const response = await api.delete(`/sessions/${sessionToDelete.id}`, {
        data: { sessionName: sessionNameConfirm }
      });
      
      if (response.data.success) {
        toast.success('Xóa buổi học thành công');
        setShowDeleteModal(false);
        setSessionNameConfirm('');
        
        // Refresh sessions list
        setSessions(sessions.filter(s => s.id !== sessionToDelete.id));
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      setDeleteError(error.response?.data?.message || 'Không thể xóa buổi học. Vui lòng thử lại sau.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <Badge bg="success">Đang diễn ra</Badge>;
      case 'scheduled':
        return <Badge bg="primary">Sắp diễn ra</Badge>;
      case 'ended':
        return <Badge bg="secondary">Đã kết thúc</Badge>;
      case 'cancelled':
        return <Badge bg="danger">Đã hủy</Badge>;
      default:
        return <Badge bg="info">{status}</Badge>;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'active':
        return 'Đang diễn ra';
      case 'scheduled':
        return 'Sắp diễn ra';
      case 'ended':
        return 'Đã kết thúc';
      case 'cancelled':
        return 'Đã hủy';
      default:
        return status;
    }
  };

  // Calendar functions
  const getSessionsForDate = (date) => {
    return sessions.filter(session => {
      const sessionDate = parseISO(session.date);
      return isSameDay(sessionDate, date);
    });
  };

  const handleDateClick = (date) => {
    setSelectedDate(date);
    const dateStr = format(date, 'yyyy-MM-dd');
    navigate(`/admin/sessions/create?date=${dateStr}`);
  };

  const handleSessionClick = (session) => {
    setSelectedSession(session);
    setShowSessionDetailModal(true);
  };

  const navigateCalendar = (direction) => {
    if (calendarView === 'month') {
      setCurrentDate(addMonths(currentDate, direction));
    } else if (calendarView === 'week') {
      setCurrentDate(addDays(currentDate, direction * 7));
    } else if (calendarView === 'day') {
      setCurrentDate(addDays(currentDate, direction));
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return <i className="fas fa-play-circle text-success" title="Đang diễn ra"></i>;
      case 'scheduled':
        return <i className="fas fa-clock text-primary" title="Sắp diễn ra"></i>;
      case 'ended':
        return <i className="fas fa-check-circle" style={{color: '#6c757d'}} title="Đã kết thúc"></i>;
      case 'cancelled':
        return <i className="fas fa-times-circle text-danger" title="Đã hủy"></i>;
      default:
        return <i className="fas fa-question-circle text-info" title={status}></i>;
    }
  };

  // Calendar View Component
  const CalendarView = () => {
    const renderMonthView = () => {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
      const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

      const days = [];
      let day = startDate;

      while (day <= endDate) {
        days.push(day);
        day = addDays(day, 1);
      }

      return (
        <div className="calendar-month">
          <div className="calendar-header">
            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(day => (
              <div key={day} className="calendar-day-header">{day}</div>
            ))}
          </div>
          <div className="calendar-body">
            {days.map((day, index) => {
              const daySessions = getSessionsForDate(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isToday = isSameDay(day, new Date());
              
              return (
                <div
                  key={index}
                  className={`calendar-day ${!isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}`}
                  onClick={() => handleDateClick(day)}
                >
                  <div className="day-number">{format(day, 'd')}</div>
                  <div className="day-sessions">
                    {daySessions.map((session, index) => (
                      <div
                        key={session.id}
                        className="session-preview"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSessionClick(session);
                        }}
                      >
                        <div className="session-status-overlay">
                          {getStatusIcon(session.calculatedStatus || session.status)}
                        </div>
                        <div className="session-content">
                          <div className="session-main-info">
                            <div className="session-title">{session.title || session.name}</div>
                            <div className="session-class">{session.class_names || '-'}</div>
                          </div>
                          <div className="session-details">
                            <div className="session-detail-item">
                              <i className="fas fa-clock"></i>
                              <span>{session.start_time}</span>
                            </div>
                            <div className="session-detail-item">
                              <i className="fas fa-map-marker-alt"></i>
                              <span>{session.location}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    const renderWeekView = () => {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const days = [];
      
      for (let i = 0; i < 7; i++) {
        days.push(addDays(weekStart, i));
      }

      return (
        <div className="calendar-week">
          <div className="week-header">
            {days.map((day, index) => (
              <div key={index} className="week-day-header">
                <div className="day-name">{format(day, 'EEE', { locale: vi })}</div>
                <div className="day-number">{format(day, 'd')}</div>
              </div>
            ))}
          </div>
          <div className="week-body">
            {days.map((day, index) => {
              const daySessions = getSessionsForDate(day);
              const isToday = isSameDay(day, new Date());
              
              return (
                <div
                  key={index}
                  className={`week-day ${isToday ? 'today' : ''}`}
                  onClick={() => handleDateClick(day)}
                >
                  <div className="day-sessions">
                    {daySessions.map((session, index) => (
                      <div
                        key={session.id}
                        className="session-preview"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSessionClick(session);
                        }}
                      >
                        <div className="session-status-overlay">
                          {getStatusIcon(session.calculatedStatus || session.status)}
                        </div>
                        <div className="session-content">
                          <div className="session-main-info">
                            <div className="session-title">{session.title || session.name}</div>
                            <div className="session-class">{session.class_names || '-'}</div>
                          </div>
                          <div className="session-details">
                            <div className="session-detail-item">
                              <i className="fas fa-clock"></i>
                              <span>{session.start_time}</span>
                            </div>
                            <div className="session-detail-item">
                              <i className="fas fa-map-marker-alt"></i>
                              <span>{session.location}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    const renderDayView = () => {
      const daySessions = getSessionsForDate(currentDate);
      
      return (
        <div className="calendar-day-view">
          <div className="day-header">
            <h4>{format(currentDate, 'EEEE, dd/MM/yyyy', { locale: vi })}</h4>
            <Button variant="outline-primary" onClick={() => handleDateClick(currentDate)}>
              <i className="fas fa-plus me-1"></i>Tạo buổi học mới
            </Button>
          </div>
          <div className="day-sessions">
            {daySessions.length > 0 ? (
              daySessions.map(session => (
                <Card key={session.id} className="mb-3 session-card" onClick={() => handleSessionClick(session)}>
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <h6 className="mb-2">{session.title || session.name}</h6>
                        <div className="session-details1">
                          <div className="mb-1">
                            <i className="fas fa-clock me-2 text-primary"></i>
                            {session.start_time} - {session.end_time}
                          </div>
                          <div className="mb-1">
                            <i className="fas fa-map-marker-alt me-2 text-success"></i>
                            {session.location}
                          </div>
                          <div className="mb-1">
                            <i className="fas fa-users me-2 text-info"></i>
                            {session.class_names || '-'}
                          </div>
                        </div>
                      </div>
                      <div className="session-status">
                        {getStatusIcon(session.calculatedStatus || session.status)}
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              ))
            ) : (
              <div className="text-center text-muted py-4">
                <i className="fas fa-calendar-times fa-3x mb-3"></i>
                <p>Không có buổi học nào trong ngày này</p>
                <Button variant="primary" onClick={() => handleDateClick(currentDate)}>
                  <i className="fas fa-plus me-1"></i>Tạo buổi học mới
                </Button>
              </div>
            )}
          </div>
        </div>
      );
    };

    return (
      <div className="calendar-container">
        <div className="calendar-controls">
          <div className="calendar-nav">
            <button className="calendar-nav-btn" onClick={() => setCurrentDate(new Date())}>
              <i className="fas fa-home"></i>
              <span className="nav-text">Hôm nay</span>
            </button>
            <button className="calendar-nav-btn" onClick={() => navigateCalendar(-1)}>
              <i className="fas fa-chevron-left"></i>
            </button>
            <button className="calendar-nav-btn" onClick={() => navigateCalendar(1)}>
              <i className="fas fa-chevron-right"></i>
            </button>
          </div>
          
          <div className="calendar-title">
            {calendarView === 'month' && format(currentDate, 'MMMM yyyy', { locale: vi })}
            {calendarView === 'week' && `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'dd/MM')} - ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'dd/MM/yyyy')}`}
            {calendarView === 'day' && format(currentDate, 'dd/MM/yyyy')}
          </div>
          
          <div className="calendar-view-buttons">
            <button
              className={`view-btn ${calendarView === 'month' ? 'active' : ''}`}
              onClick={() => setCalendarView('month')}
            >
              <i className="fas fa-calendar-alt"></i>
              <span className="view-text">Tháng</span>
            </button>
            <button
              className={`view-btn ${calendarView === 'week' ? 'active' : ''}`}
              onClick={() => setCalendarView('week')}
            >
              <i className="fas fa-calendar-week"></i>
              <span className="view-text">Tuần</span>
            </button>
            <button
              className={`view-btn ${calendarView === 'day' ? 'active' : ''}`}
              onClick={() => setCalendarView('day')}
            >
              <i className="fas fa-calendar-day"></i>
              <span className="view-text">Ngày</span>
            </button>
          </div>
        </div>
        
        {calendarView === 'month' && renderMonthView()}
        {calendarView === 'week' && renderWeekView()}
        {calendarView === 'day' && renderDayView()}
      </div>
    );
  };

  const filteredSessions = sessions
    .filter(session => 
      (filter === 'all' || session.calculatedStatus === filter) &&
      ((session.title || session.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
       (session.location || '').toLowerCase().includes(searchTerm.toLowerCase()))
    );

  if (loading) {
    return <Loader text="Đang tải danh sách buổi học..." />;
  }

  return (
    <div>
      {/* Header Section */}
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Danh sách buổi học lâm sàng</h1>
            <p className="header-subtitle">Quản lý và theo dõi các buổi học lâm sàng</p>
          </div>
          <div className="header-actions">
            <Button as={Link} to="/admin/sessions/create" variant="outline-light" className="create-session-btn">
              <i className="fas fa-plus"></i>
              Tạo buổi học mới
            </Button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="custom-tabs">
          <Tab eventKey="list" title={
            <span className="tab-title">
              <i className="fas fa-list"></i>
              Danh sách
            </span>
          }>
          <div className="session-list-container">
            <div className="session-list-controls">
              <div className="search-controls">
                <Form.Control
                  type="text"
                  placeholder="Tìm kiếm theo tên hoặc địa điểm..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
                
                <Form.Select 
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="active">Đang diễn ra</option>
                  <option value="scheduled">Sắp diễn ra</option>
                  <option value="ended">Đã kết thúc</option>
                  <option value="cancelled">Đã hủy</option>
                </Form.Select>
              </div>
            </div>
            
            <div className="session-table-container">
              <div className="table-responsive-mobile">
                <table className="session-table">
                <thead>
                  <tr>
                    <th className="mobile-essential">ID</th>
                    <th className="mobile-essential">Tên buổi học</th>
                    <th className="mobile-essential">Ngày</th>
                    <th className="mobile-essential">Thời gian</th>
                    <th className="mobile-essential">Địa điểm</th>
                    <th className="mobile-essential">Lớp</th>
                    <th className="mobile-essential">Số sinh viên</th>
                    <th className="mobile-essential">Trạng thái</th>
                    <th className="mobile-hide">Giám sát</th>
                    <th className="mobile-essential">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.map(session => (
                    <tr key={session.id}>
                      <td className="mobile-essential"><span className="session-id">{session.id}</span></td>
                      <td className="mobile-essential"><span className="session-title-cell">{session.title || session.name}</span></td>
                      <td className="mobile-essential"><span className="session-date">{formatDate(session.date)}</span></td>
                      <td className="mobile-essential"><span className="session-time">{session.start_time && session.end_time ? 
                          `${session.start_time} - ${session.end_time}` : 
                          session.time}</span></td>
                      <td className="mobile-essential"><span className="session-location">{session.location}</span></td>
                      <td className="mobile-essential"><span className="session-class">{session.class_names || '-'}</span></td>
                       <td className="mobile-essential"><span className="session-student-count">{session.student_count || session.studentCount || '-'}</span></td>
                      <td className="mobile-essential">
                        <span className={`status-badge ${session.calculatedStatus || session.status}`}>
                          {getStatusText(session.calculatedStatus || session.status)}
                        </span>
                      </td>
                      <td className="mobile-hide">
                        <div className="monitoring-icons">
                          {session.monitoring_options?.location?.enabled && (
                            <div className="monitoring-icon location" title="Theo dõi vị trí">
                              <i className="fas fa-map-marker-alt"></i>
                            </div>
                          )}
                          {session.monitoring_options?.file_upload?.enabled && (
                            <div className="monitoring-icon file" title="Tải lên tệp tin">
                              <i className="fas fa-file-upload"></i>
                            </div>
                          )}
                          {session.monitoring_options?.webcam?.enabled && (
                            <div className="monitoring-icon webcam" title="Theo dõi webcam">
                              <i className="fas fa-video"></i>
                            </div>
                          )}
                          {session.monitoring_options?.audio?.enabled && (
                            <div className="monitoring-icon audio" title="Theo dõi âm thanh">
                              <i className="fas fa-microphone"></i>
                            </div>
                          )}
                          {session.monitoring_options?.attendance?.before_session?.enabled && (
                            <div className="monitoring-icon attendance" title="Điểm danh trước buổi học">
                              <i className="fas fa-clock"></i>
                            </div>
                          )}
                          {session.monitoring_options?.attendance?.during_session?.enabled && (
                            <div className="monitoring-icon attendance" title="Điểm danh trong buổi học">
                              <i className="fas fa-user-check"></i>
                            </div>
                          )}
                          {session.monitoring_options?.attendance?.after_session?.enabled && (
                            <div className="monitoring-icon attendance" title="Điểm danh sau buổi học">
                              <i className="fas fa-user-times"></i>
                            </div>
                          )}
                          {!session.monitoring_options?.webcam?.enabled && 
                           !session.monitoring_options?.audio?.enabled && 
                           !session.monitoring_options?.location?.enabled && 
                           !session.monitoring_options?.file_upload?.enabled &&
                           !session.monitoring_options?.attendance?.before_session?.enabled &&
                           !session.monitoring_options?.attendance?.during_session?.enabled &&
                           !session.monitoring_options?.attendance?.after_session?.enabled && (
                            <span className="no-monitoring">Không có</span>
                          )}
                        </div>
                      </td>
                       <td className="mobile-essential">
                         <div className="action-buttons">
                           <Link
                             to={`/admin/sessions/${session.id}`}
                             className="action-btn btn-outline-primary"
                             title="Xem chi tiết buổi học"
                           >
                             <i className="fas fa-eye"></i>
                             <span>Chi tiết</span>
                           </Link>
                           
                           <Link
                             to={`/admin/sessions/${session.id}/edit`}
                             className="action-btn btn-outline-warning"
                             title="Chỉnh sửa buổi học"
                           >
                             <i className="fas fa-edit"></i>
                             <span>Sửa</span>
                           </Link>

                           {session.calculatedStatus !== 'cancelled' && session.calculatedStatus !== 'ended' && (
                             <Link
                               to={`/admin/sessions/${session.id}/qr-code`}
                               className="action-btn btn-outline-success"
                               title="Xem mã QR Code"
                             >
                               <i className="fas fa-qrcode"></i>
                               <span>QR</span>
                             </Link>
                           )}
                           
                           <Link
                             to={`/admin/sessions/${session.id}/history`}
                             className="action-btn btn-outline-info"
                             title="Xem lịch sử buổi học"
                           >
                             <i className="fas fa-history"></i>
                             <span>Lịch sử</span>
                           </Link>
                           
                           <button
                             className="action-btn btn-outline-danger"
                             onClick={() => handleDeleteClick(session)}
                             title="Xóa buổi học"
                           >
                             <i className="fas fa-trash"></i>
                             <span>Xóa</span>
                           </button>
                         </div>
                       </td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            </div>
          </div>
        </Tab>
        
        <Tab eventKey="calendar" title={
          <span className="tab-title">
            <i className="fas fa-calendar-alt"></i>
            Lịch
          </span>
        }>
          <CalendarView />
        </Tab>
      </Tabs>
      </div>
      
      {/* Session Detail Modal */}
      <Modal 
        show={showSessionDetailModal} 
        onHide={() => setShowSessionDetailModal(false)} 
        size="lg"
        className="session-detail-modal"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Chi tiết buổi học</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedSession && (
            <div>
              <Row className="mb-3">
                <Col md={6}>
                  <h6><i className="fas fa-calendar me-2"></i>Thông tin cơ bản</h6>
                  <div className="ms-3">
                    <p><strong>Tên buổi học:</strong> {selectedSession.title || selectedSession.name}</p>
                    <p><strong>Ngày:</strong> {formatDate(selectedSession.date)}</p>
                    <p><strong>Thời gian:</strong> {selectedSession.start_time} - {selectedSession.end_time}</p>
                    <p><strong>Địa điểm:</strong> {selectedSession.location}</p>
                    <p><strong>Lớp:</strong> {selectedSession.class_names || '-'}</p>
                    <p><strong>Số sinh viên:</strong> {selectedSession.student_count || selectedSession.studentCount || '-'}</p>
                    <p><strong>Trạng thái:</strong> {getStatusBadge(selectedSession.calculatedStatus || selectedSession.status)}</p>
                  </div>
                </Col>
                <Col md={6}>
                  <h6><i className="fas fa-cog me-2"></i>Tùy chọn giám sát</h6>
                  <div className="ms-3">
                    {selectedSession.monitoring_options?.location?.enabled && (
                      <div className="mb-2">
                        <i className="fas fa-map-marker-alt text-success me-2"></i>
                        Theo dõi vị trí
                        {selectedSession.monitoring_options.location.geofence?.enabled && (
                          <span className="text-muted"> (Giới hạn: {selectedSession.monitoring_options.location.geofence.radius}m)</span>
                        )}
                      </div>
                    )}
                    {selectedSession.monitoring_options?.file_upload?.enabled && (
                      <div className="mb-2">
                        <i className="fas fa-file-upload text-success me-2"></i>
                        Tải lên tệp tin
                      </div>
                    )}
                    {selectedSession.monitoring_options?.webcam?.enabled && (
                      <div className="mb-2">
                        <i className="fas fa-video text-success me-2"></i>
                        Theo dõi webcam
                      </div>
                    )}
                    {selectedSession.monitoring_options?.audio?.enabled && (
                      <div className="mb-2">
                        <i className="fas fa-microphone text-success me-2"></i>
                        Theo dõi âm thanh
                      </div>
                    )}
                    {!selectedSession.monitoring_options?.webcam?.enabled && 
                     !selectedSession.monitoring_options?.audio?.enabled && 
                     !selectedSession.monitoring_options?.location?.enabled && 
                     !selectedSession.monitoring_options?.file_upload?.enabled && (
                      <div className="text-muted">Không có tùy chọn giám sát</div>
                    )}
                  </div>
                </Col>
              </Row>
              
              {selectedSession.description && (
                <div className="mb-3">
                  <h6><i className="fas fa-align-left me-2"></i>Mô tả</h6>
                  <div className="ms-3">
                    <p>{selectedSession.description}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowSessionDetailModal(false)}>
            Đóng
          </Button>
          <Button 
            as={Link}
            to={`/admin/sessions/${selectedSession?.id}`}
            variant="primary"
            onClick={() => setShowSessionDetailModal(false)}
          >
            Xem chi tiết đầy đủ
          </Button>
        </Modal.Footer>
      </Modal>
      
      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Xác nhận xóa buổi học</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {sessionToDelete && (
            <>
              <p>Bạn có chắc chắn muốn xóa buổi học: <strong>{sessionToDelete.title || sessionToDelete.name}</strong>?</p>
              <p>Hành động này không thể khôi phục. Vui lòng nhập lại tên buổi học để xác nhận.</p>
              
              <Form.Group className="mb-3">
                <Form.Label>Tên buổi học</Form.Label>
                <Form.Control
                  type="text"
                  placeholder={`Nhập "${sessionToDelete.title || sessionToDelete.name}" để xác nhận`}
                  value={sessionNameConfirm}
                  onChange={(e) => setSessionNameConfirm(e.target.value)}
                  isInvalid={!!deleteError}
                />
                <Form.Control.Feedback type="invalid">
                  {deleteError}
                </Form.Control.Feedback>
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Hủy
          </Button>
          <Button 
            variant="danger" 
            onClick={handleDeleteConfirm}
            disabled={deleteLoading}
          >
            {deleteLoading ? (
              <>
                <div className="blob-loaders-blob-alt-7" style={{ width: '24px', height: '24px', padding: '2.4px', display: 'inline-block', marginRight: '8px' }}>
                </div>
                Đang xử lý...
              </>
            ) : 'Xác nhận xóa'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default SessionList;