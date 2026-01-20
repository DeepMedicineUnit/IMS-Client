import React, { useState, useEffect } from 'react';
import { Card, Badge, Spinner } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, addWeeks, addMonths, isSameDay, isSameMonth } from 'date-fns';
import { vi } from 'date-fns/locale';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';
import { useTranslation } from 'react-i18next';

const StudentSchedule = () => {
  const { t } = useTranslation();
  usePageTitle(t('studentSchedule.title'));
  const { currentUser, api } = useAuth();
  const [loading, setLoading] = useState(true);
  const [calendarView, setCalendarView] = useState('month'); // 'day', 'week', 'month'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [sessions, setSessions] = useState([]);
  const [exams, setExams] = useState([]);
  const [allScheduleItems, setAllScheduleItems] = useState([]);

  // Fetch schedule data
  const fetchScheduleData = async () => {
    try {
      setLoading(true);
      
      // Get sessions (lịch học)
      const sessionsResponse = await api.get('/sessions/student/attendance?all=true');
      let sessionsData = [];
      if (sessionsResponse.data.success) {
        sessionsData = sessionsResponse.data.data || [];
      }

      // Get exams (lịch thi)
      const examsResponse = await api.get('/lms/exams/student');
      let examsData = [];
      if (examsResponse.data.success) {
        examsData = examsResponse.data.data || [];
      }

      // Transform sessions to schedule items
      const sessionItems = sessionsData.map(session => ({
        id: `session-${session.id}`,
        type: 'session',
        title: session.title,
        date: session.date,
        end_date: session.end_date || session.date,
        start_time: session.start_time,
        end_time: session.end_time,
        location: session.location,
        status: session.status,
        description: session.description,
        color: '#256176'
      }));

      // Transform exams to schedule items
      const examItems = examsData
        .filter(exam => exam.available_from && exam.available_until)
        .map(exam => ({
          id: `exam-${exam.exam_id}`,
          type: 'exam',
          title: exam.exam_title || exam.exam_name,
          date: exam.available_from.split('T')[0],
          end_date: exam.available_until ? exam.available_until.split('T')[0] : exam.available_from.split('T')[0],
          start_time: exam.available_from.includes('T') ? exam.available_from.split('T')[1].substring(0, 5) : '00:00',
          end_time: exam.available_until && exam.available_until.includes('T') ? exam.available_until.split('T')[1].substring(0, 5) : '23:59',
          location: exam.location || 'Online',
          status: exam.is_published ? 'published' : 'draft',
          description: exam.exam_description,
          course_name: exam.course_name,
          exam_type: exam.exam_type,
          color: '#dc3545'
        }));

      setSessions(sessionsData);
      setExams(examsData);
      setAllScheduleItems([...sessionItems, ...examItems]);
    } catch (error) {
      console.error('Error fetching schedule data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScheduleData();
  }, []);

  // Get schedule items for a specific date
  const getScheduleItemsForDate = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return allScheduleItems.filter(item => {
      const itemDate = item.date;
      const itemEndDate = item.end_date || item.date;
      return dateStr >= itemDate && dateStr <= itemEndDate;
    });
  };

  // Navigate calendar
  const navigateCalendar = (direction) => {
    if (calendarView === 'day') {
      setCurrentDate(addDays(currentDate, direction));
    } else if (calendarView === 'week') {
      setCurrentDate(addWeeks(currentDate, direction));
    } else {
      setCurrentDate(addMonths(currentDate, direction));
    }
  };

  // Render month view
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
          {[
            t('studentSchedule.dayHeaders.monday'),
            t('studentSchedule.dayHeaders.tuesday'),
            t('studentSchedule.dayHeaders.wednesday'),
            t('studentSchedule.dayHeaders.thursday'),
            t('studentSchedule.dayHeaders.friday'),
            t('studentSchedule.dayHeaders.saturday'),
            t('studentSchedule.dayHeaders.sunday')
          ].map(day => (
            <div key={day} className="calendar-day-header">{day}</div>
          ))}
        </div>
        <div className="calendar-body">
          {days.map((day, index) => {
            const dayItems = getScheduleItemsForDate(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={index}
                className={`calendar-day ${!isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}`}
              >
                <div className="day-number">{format(day, 'd')}</div>
                <div className="day-sessions">
                  {dayItems.map((item, idx) => (
                    <div
                      key={item.id}
                      className="session-preview"
                      style={{
                        borderLeft: `3px solid ${item.type === 'exam' ? '#dc3545' : '#256176'}`
                      }}
                    >
                      <div className="session-status-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i 
                          className={`fas fa-${item.type === 'exam' ? 'file-alt' : 'book'}`}
                          style={{ 
                            color: item.type === 'exam' ? '#dc3545' : '#256176',
                            fontSize: '12px',
                            display: 'block'
                          }}
                        ></i>
                      </div>
                      <div className="session-content">
                        <div className="session-main-info">
                          <div className="session-title">{item.title}</div>
                          <div className="session-time-mobile">{item.start_time}</div>
                        </div>
                        <div className="session-details">
                          <div className="session-detail-item">
                            <i className="fas fa-clock"></i>
                            <span>{item.start_time}</span>
                          </div>
                          {item.location && (
                            <div className="session-detail-item">
                              <i className="fas fa-map-marker-alt"></i>
                              <span>{item.location}</span>
                            </div>
                          )}
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

  // Render week view
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
            const dayItems = getScheduleItemsForDate(day);
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={index}
                className={`week-day ${isToday ? 'today' : ''}`}
              >
                <div className="day-sessions">
                  {dayItems.map((item) => (
                    <div
                      key={item.id}
                      className="session-preview"
                      style={{
                        borderLeft: `3px solid ${item.type === 'exam' ? '#dc3545' : '#256176'}`
                      }}
                    >
                      <div className="session-status-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i 
                          className={`fas fa-${item.type === 'exam' ? 'file-alt' : 'book'}`}
                          style={{ 
                            color: item.type === 'exam' ? '#dc3545' : '#256176',
                            fontSize: '12px',
                            display: 'block'
                          }}
                        ></i>
                      </div>
                      <div className="session-content">
                        <div className="session-main-info">
                          <div className="session-title">{item.title}</div>
                          <div className="session-time-mobile">{item.start_time}</div>
                        </div>
                        <div className="session-details">
                          <div className="session-detail-item">
                            <i className="fas fa-clock"></i>
                            <span>{item.start_time} - {item.end_time}</span>
                          </div>
                          {item.location && (
                            <div className="session-detail-item">
                              <i className="fas fa-map-marker-alt"></i>
                              <span>{item.location}</span>
                            </div>
                          )}
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

  // Render day view
  const renderDayView = () => {
    const dayItems = getScheduleItemsForDate(currentDate);

    return (
      <div className="calendar-day-view">
        <div className="day-header">
          <h4>{format(currentDate, 'EEEE, dd/MM/yyyy', { locale: vi })}</h4>
        </div>
        <div className="day-sessions">
          {dayItems.length > 0 ? (
            dayItems.map(item => (
              <Card key={item.id} className="mb-3 session-card">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-start">
                    <div className="flex-grow-1">
                      <div className="d-flex align-items-center mb-2">
                        <Badge 
                          bg={item.type === 'exam' ? 'danger' : 'primary'} 
                          className="me-2"
                        >
                          <i className={`fas fa-${item.type === 'exam' ? 'file-alt' : 'book'} me-1`}></i>
                          {item.type === 'exam' ? t('studentSchedule.badges.exam') : t('studentSchedule.badges.session')}
                        </Badge>
                        {item.course_name && (
                          <Badge bg="secondary" className="me-2">
                            {item.course_name}
                          </Badge>
                        )}
                      </div>
                      <h6 className="mb-2">{item.title}</h6>
                      <div className="session-details1">
                        <div className="mb-1">
                          <i className="fas fa-clock me-2 text-primary"></i>
                          {item.start_time} - {item.end_time}
                        </div>
                        {item.location && (
                          <div className="mb-1">
                            <i className="fas fa-map-marker-alt me-2 text-success"></i>
                            {item.location}
                          </div>
                        )}
                        {item.description && (
                          <div className="mb-1 text-muted small">
                            {item.description}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="session-status">
                      <i className={`fas fa-${item.type === 'exam' ? 'file-alt' : 'book'} fa-2x`} 
                         style={{ color: item.color }}></i>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            ))
          ) : (
            <div className="text-center text-muted py-5">
              <i className="fas fa-calendar-times fa-3x mb-3 text-muted"></i>
              <p>{t('studentSchedule.noSchedule')}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="text-center p-5">
        <div className="modern-card">
          <div className="card-body text-center py-5">
            <Spinner animation="border" className="mb-3" />
            <p className="mb-0">{t('studentSchedule.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>{t('studentSchedule.headerTitle')}</h1>
            <p className="header-subtitle">{t('studentSchedule.headerSubtitle')}</p>
          </div>
        </div>
      </div>

      <div className="calendar-container">
        <div className="calendar-controls">
          <div className="calendar-nav">
            <button 
              className="calendar-nav-btn" 
              onClick={() => setCurrentDate(new Date())}
              title={t('studentSchedule.today')}
            >
              <i className="fas fa-home"></i>
              <span className="nav-text">{t('studentSchedule.today')}</span>
            </button>
            <button 
              className="calendar-nav-btn" 
              onClick={() => navigateCalendar(-1)}
            >
              <i className="fas fa-chevron-left"></i>
            </button>
            <button 
              className="calendar-nav-btn" 
              onClick={() => navigateCalendar(1)}
            >
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
              <span className="view-text">{t('studentSchedule.views.month')}</span>
            </button>
            <button
              className={`view-btn ${calendarView === 'week' ? 'active' : ''}`}
              onClick={() => setCalendarView('week')}
            >
              <i className="fas fa-calendar-week"></i>
              <span className="view-text">{t('studentSchedule.views.week')}</span>
            </button>
            <button
              className={`view-btn ${calendarView === 'day' ? 'active' : ''}`}
              onClick={() => setCalendarView('day')}
            >
              <i className="fas fa-calendar-day"></i>
              <span className="view-text">{t('studentSchedule.views.day')}</span>
            </button>
          </div>
        </div>

        {calendarView === 'month' && renderMonthView()}
        {calendarView === 'week' && renderWeekView()}
        {calendarView === 'day' && renderDayView()}
      </div>

    </div>
  );
};

export default StudentSchedule;

