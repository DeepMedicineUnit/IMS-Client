import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import usePageTitle from '../../hooks/usePageTitle';
import api from '../../utils/api';
import BarChart from '../../components/charts/BarChart';
import PieChart from '../../components/charts/PieChart';
import LineChart from '../../components/charts/LineChart';
import './MeetingRoomBooking.css';
import './ReceptionistDashboard.css';

const MONTH_SHORT = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
const WEEKDAY_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];

const STATUS_CONFIG = {
  pending: { label: 'Chờ duyệt', color: '#f5a524' },
  approved: { label: 'Đã duyệt', color: '#22b07d' },
  rejected: { label: 'Từ chối', color: '#e6493a' }
};
const HOUR_OPTIONS = Array.from({ length: 18 }, (_, i) => i + 5);
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => i);

const formatDateKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

const timeToParts = (timeStr) => {
  if (!timeStr) return [8, 0];
  const [h, m] = timeStr.split(':').map(Number);
  const hour = isNaN(h) ? 8 : Math.min(22, Math.max(5, h));
  return [hour, isNaN(m) ? 0 : m];
};

const partsToTime = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

const formatDateTime = (iso) => {
  if (!iso) return '---';
  const d = new Date(iso);
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getWeekdayIndex = (d) => {
  const day = d.getDay();
  return day === 0 ? 6 : day - 1;
};

export default function ReceptionistDashboard() {
  usePageTitle('Dashboard Lễ tân');
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rooms, setRooms] = useState([]);
  const [users, setUsers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [pendingBookings, setPendingBookings] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null);
  const [submitStatus, setSubmitStatus] = useState({ type: null, message: null });
  const [approveLoading, setApproveLoading] = useState(false);
  const [form, setForm] = useState({
    roomId: '',
    title: '',
    startDate: '',
    startTime: '08:00',
    endDate: '',
    endTime: '09:00'
  });
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFreq, setRecurrenceFreq] = useState('week');
  const [recurrenceWeekdays, setRecurrenceWeekdays] = useState([]);
  const [recurrenceMonthDays, setRecurrenceMonthDays] = useState([]);
  const [recurrenceEndType, setRecurrenceEndType] = useState('date');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [recurrenceCount, setRecurrenceCount] = useState(10);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const now = new Date();
      const yearStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0).toISOString();
      const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999).toISOString();

      const [roomsRes, usersRes, bookingsRes, pendingRes] = await Promise.all([
        api.get('/receptionist/rooms/all'),
        api.get('/receptionist/users'),
        api.get('/receptionist/bookings', { params: { start: yearStart, end: yearEnd } }),
        api.get('/receptionist/bookings/pending')
      ]);

      setRooms(roomsRes.data?.data || []);
      setUsers(usersRes.data?.data || []);
      setBookings(bookingsRes.data?.data || []);
      setPendingBookings(pendingRes.data?.data || []);
    } catch (e) {
      setError(e?.response?.data?.message || 'Không thể tải dữ liệu dashboard lễ tân.');
      setRooms([]);
      setUsers([]);
      setBookings([]);
      setPendingBookings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const dashboardData = useMemo(() => {
    const now = new Date();
    const activeRooms = rooms.filter((r) => Number(r.is_active) === 1);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const monthBookings = bookings.filter((b) => {
      const t = new Date(b.start_at).getTime();
      return t >= monthStart.getTime() && t <= monthEnd.getTime();
    });

    const todayBookings = bookings.filter((b) => {
      const s = new Date(b.start_at);
      const e = new Date(b.end_at);
      return s <= todayEnd && e >= todayStart;
    });

    const statusCount = bookings.reduce(
      (acc, b) => {
        const key = b.status || 'pending';
        if (acc[key] == null) acc[key] = 0;
        acc[key] += 1;
        return acc;
      },
      { pending: 0, approved: 0, rejected: 0 }
    );

    const monthlyCounts = Array.from({ length: 12 }, () => 0);
    bookings.forEach((b) => {
      const d = new Date(b.start_at);
      monthlyCounts[d.getMonth()] += 1;
    });

    const weekDayCounts = Array.from({ length: 7 }, () => 0);
    bookings.forEach((b) => {
      const d = new Date(b.start_at);
      weekDayCounts[getWeekdayIndex(d)] += 1;
    });

    const roomMap = {};
    bookings.forEach((b) => {
      const key = `${b.room_id}-${b.room_name || 'Phòng'}`;
      if (!roomMap[key]) {
        roomMap[key] = { label: b.room_name || b.room_code || `Phòng ${b.room_id}`, count: 0 };
      }
      roomMap[key].count += 1;
    });
    const roomUsage = Object.values(roomMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const groupRecurringEvents = (items, pickRepresentative, finalSorter) => {
      const grouped = new Map();
      items.forEach((item) => {
        const isRecurring = item.recurrence_rule_id != null;
        const key = isRecurring ? `series-${item.recurrence_rule_id}` : `single-${item.id}`;
        if (!grouped.has(key)) {
          grouped.set(key, { ...item, seriesCount: 1, isRecurringGroup: isRecurring });
          return;
        }
        const current = grouped.get(key);
        current.seriesCount += 1;
        if (pickRepresentative(item, current)) {
          grouped.set(key, { ...item, seriesCount: current.seriesCount, isRecurringGroup: isRecurring });
        } else {
          grouped.set(key, current);
        }
      });
      return Array.from(grouped.values()).sort(finalSorter).slice(0, 15);
    };

    const upcomingEvents = groupRecurringEvents(
      bookings.filter((b) => new Date(b.end_at) >= now),
      (incoming, current) => new Date(incoming.start_at) < new Date(current.start_at),
      (a, b) => new Date(a.start_at) - new Date(b.start_at)
    );

    const latestEvents = groupRecurringEvents(
      [...bookings],
      (incoming, current) => new Date(incoming.created_at || incoming.start_at) > new Date(current.created_at || current.start_at),
      (a, b) => new Date(b.created_at || b.start_at) - new Date(a.created_at || a.start_at)
    );

    const roomsUsedToday = new Set(todayBookings.map((b) => b.room_id)).size;
    const occupancyToday = activeRooms.length ? Math.round((roomsUsedToday / activeRooms.length) * 100) : 0;
    const approvalRateBase = statusCount.approved + statusCount.rejected;
    const approvalRate = approvalRateBase > 0 ? Math.round((statusCount.approved / approvalRateBase) * 100) : 0;

    return {
      activeRooms,
      monthBookings,
      todayBookings,
      statusCount,
      monthlyCounts,
      weekDayCounts,
      roomUsage,
      upcomingEvents,
      latestEvents,
      occupancyToday,
      approvalRate
    };
  }, [bookings, rooms]);

  const receptionistAdmin = currentUser?.role === 'superadmin' || (currentUser?.module_roles || []).includes('receptionist_admin');

  const openEditModal = (booking) => {
    const start = new Date(booking.start_at);
    const end = new Date(booking.end_at);
    let sh = Math.min(22, Math.max(5, start.getHours()));
    let eh = Math.min(22, Math.max(5, end.getHours()));
    if (eh <= sh) eh = Math.min(22, sh + 1);
    setForm({
      roomId: String(booking.room_id),
      title: booking.title || '',
      startDate: formatDateKey(start),
      startTime: `${String(sh).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`,
      endDate: formatDateKey(end),
      endTime: `${String(eh).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`
    });
    const rule = booking.recurrence_rule;
    const isRecurringSeries = rule || booking.recurrence_rule_id != null;
    if (isRecurringSeries) {
      setIsRecurring(true);
      setRecurrenceFreq(rule?.frequency || 'week');
      setRecurrenceWeekdays(Array.isArray(rule?.weekdays) ? rule.weekdays : []);
      setRecurrenceMonthDays(Array.isArray(rule?.month_days) ? rule.month_days : []);
      setRecurrenceEndType(rule?.end_type || 'date');
      setRecurrenceEndDate(rule?.end_date ? String(rule.end_date).slice(0, 10) : '');
      setRecurrenceCount(rule?.end_count != null ? Number(rule.end_count) : 10);
    } else {
      setIsRecurring(false);
      setRecurrenceFreq('week');
      setRecurrenceWeekdays([]);
      setRecurrenceMonthDays([]);
      setRecurrenceEndType('date');
      setRecurrenceEndDate('');
      setRecurrenceCount(10);
    }
    setEditingBooking(booking);
    setSubmitStatus({ type: null, message: null });
    setModalOpen(true);
  };

  const closeEditModal = () => {
    setModalOpen(false);
    setEditingBooking(null);
    setSubmitStatus({ type: null, message: null });
  };

  const canSaveEdit = () => receptionistAdmin;

  const handleDeleteBooking = async () => {
    if (!editingBooking) return;
    const isSeries = editingBooking.recurrence_rule_id != null || editingBooking.recurrence_rule;
    const msg = isSeries
      ? 'Sự kiện định kỳ sẽ xóa toàn bộ các ngày trong chuỗi. Bạn có chắc muốn xóa?'
      : 'Bạn có chắc muốn xóa sự kiện này?';
    if (!window.confirm(msg)) return;
    setSubmitStatus({ type: null, message: null });
    try {
      const res = await api.delete(`/receptionist/bookings/${editingBooking.id}`);
      if (res.data?.success) {
        setSubmitStatus({ type: 'success', message: res.data.message || 'Đã xóa.' });
        fetchDashboardData();
        setTimeout(() => closeEditModal(), 1200);
      } else {
        setSubmitStatus({ type: 'error', message: res.data?.message || 'Xóa thất bại.' });
      }
    } catch (err) {
      setSubmitStatus({ type: 'error', message: err.response?.data?.message || 'Lỗi xóa đặt phòng.' });
    }
  };

  const handleDeleteSingleOccurrence = async () => {
    if (!editingBooking || (editingBooking.recurrence_rule_id == null && !editingBooking.recurrence_rule)) return;
    const dateToDelete = form.startDate || (editingBooking.start_at ? formatDateKey(new Date(editingBooking.start_at)) : '');
    const dateLabel = dateToDelete ? new Date(dateToDelete + 'T12:00:00').toLocaleDateString('vi-VN') : '';
    if (!window.confirm(`Xóa đặt phòng chỉ ngày ${dateLabel} trong chuỗi định kỳ? Các ngày khác vẫn giữ nguyên.`)) return;
    try {
      const res = await api.delete(`/receptionist/bookings/${editingBooking.id}`, {
        params: { singleOccurrence: 'true', date: dateToDelete }
      });
      if (res.data?.success) {
        setSubmitStatus({ type: 'success', message: res.data.message || 'Đã xóa ngày đã chọn.' });
        fetchDashboardData();
        setTimeout(() => closeEditModal(), 1200);
      } else {
        setSubmitStatus({ type: 'error', message: res.data?.message || 'Xóa thất bại.' });
      }
    } catch (err) {
      setSubmitStatus({ type: 'error', message: err.response?.data?.message || 'Lỗi xóa đặt phòng.' });
    }
  };

  const handleApproveBooking = async (applyToSeries = false) => {
    if (!editingBooking || editingBooking.status !== 'pending' || !receptionistAdmin) return;
    setSubmitStatus({ type: null, message: null });
    setApproveLoading(true);
    try {
      const res = await api.post(`/receptionist/bookings/${editingBooking.id}/review`, {
        action: 'approve',
        ...(applyToSeries && editingBooking.recurrence_rule_id != null ? { applyToSeries: true } : {})
      });
      if (res.data?.success) {
        setSubmitStatus({ type: 'success', message: res.data.message || (applyToSeries ? 'Đã duyệt tất cả.' : 'Đã duyệt đặt phòng.') });
        fetchDashboardData();
        setTimeout(() => { closeEditModal(); setApproveLoading(false); }, 1200);
      } else {
        setSubmitStatus({ type: 'error', message: res.data?.message || 'Duyệt thất bại.' });
        setApproveLoading(false);
      }
    } catch (err) {
      setSubmitStatus({ type: 'error', message: err.response?.data?.message || 'Lỗi duyệt đặt phòng.' });
      setApproveLoading(false);
    }
  };

  const handleRejectBooking = async (applyToSeries = false) => {
    if (!editingBooking || editingBooking.status !== 'pending' || !receptionistAdmin) return;
    const reason = window.prompt('Lý do từ chối (có thể để trống):');
    if (reason === null) return;
    setSubmitStatus({ type: null, message: null });
    setApproveLoading(true);
    try {
      const res = await api.post(`/receptionist/bookings/${editingBooking.id}/review`, {
        action: 'reject',
        rejection_reason: (reason && reason.trim()) ? reason.trim() : null,
        ...(applyToSeries && editingBooking.recurrence_rule_id != null ? { applyToSeries: true } : {})
      });
      if (res.data?.success) {
        setSubmitStatus({ type: 'success', message: res.data.message || (applyToSeries ? 'Đã từ chối tất cả.' : 'Đã từ chối đặt phòng.') });
        fetchDashboardData();
        setTimeout(() => { closeEditModal(); setApproveLoading(false); }, 1200);
      } else {
        setSubmitStatus({ type: 'error', message: res.data?.message || 'Từ chối thất bại.' });
        setApproveLoading(false);
      }
    } catch (err) {
      setSubmitStatus({ type: 'error', message: err.response?.data?.message || 'Lỗi từ chối đặt phòng.' });
      setApproveLoading(false);
    }
  };

  const handleSubmitEdit = async (e) => {
    e.preventDefault();
    if (!editingBooking) return;
    const { roomId, title, startDate, startTime, endTime } = form;
    if (!roomId || !title || !startDate || !startTime || !endTime) {
      setSubmitStatus({ type: 'error', message: 'Vui lòng điền đủ thông tin.' });
      return;
    }

    const startAt = new Date(`${startDate}T${startTime}:00`);
    const endAt = new Date(`${startDate}T${endTime}:00`);
    if (endAt <= startAt) {
      setSubmitStatus({ type: 'error', message: 'Giờ kết thúc phải sau giờ bắt đầu.' });
      return;
    }
    if (isRecurring) {
      if (recurrenceEndType === 'date' && !recurrenceEndDate) {
        setSubmitStatus({ type: 'error', message: 'Chọn ngày kết thúc chuỗi lặp.' });
        return;
      }
      if (recurrenceEndType === 'count' && (recurrenceCount < 1 || recurrenceCount > 200)) {
        setSubmitStatus({ type: 'error', message: 'Số lần lặp từ 1 đến 200.' });
        return;
      }
      if (recurrenceFreq === 'week' && !recurrenceWeekdays.length) {
        setSubmitStatus({ type: 'error', message: 'Chọn ít nhất một ngày trong tuần.' });
        return;
      }
      if (recurrenceFreq === 'month' && !recurrenceMonthDays.length) {
        setSubmitStatus({ type: 'error', message: 'Chọn ít nhất một ngày trong tháng.' });
        return;
      }
    }

    try {
      const payload = {
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        roomId: Number(roomId),
        title: title.trim()
      };
      if (editingBooking.recurrence_rule_id != null && isRecurring) {
        payload.recurrence = {
          frequency: recurrenceFreq,
          weekdays: recurrenceFreq === 'week' ? recurrenceWeekdays : null,
          month_days: recurrenceFreq === 'month' ? recurrenceMonthDays : null,
          end_type: recurrenceEndType,
          end_date: recurrenceEndType === 'date' ? recurrenceEndDate : null,
          end_count: recurrenceEndType === 'count' ? recurrenceCount : null
        };
      }
      const res = await api.put(`/receptionist/bookings/${editingBooking.id}`, payload);
      if (res.data?.success) {
        setSubmitStatus({ type: 'success', message: res.data.message || 'Đã cập nhật đặt phòng.' });
        fetchDashboardData();
        setTimeout(() => closeEditModal(), 1200);
      } else {
        setSubmitStatus({ type: 'error', message: res.data?.message || 'Cập nhật thất bại.' });
      }
    } catch (err) {
      setSubmitStatus({ type: 'error', message: err.response?.data?.message || 'Lỗi cập nhật.' });
    }
  };

  if (!receptionistAdmin) {
    return (
      <div className="receptionist-dashboard-page">
        <div className="receptionist-dashboard-empty">
          <h2>Không có quyền truy cập</h2>
          <p>Trang Dashboard chỉ dành cho quản trị viên Lễ tân.</p>
          <Link to="/receptionist/booking" className="dashboard-link-btn">Về lịch đặt phòng</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="receptionist-dashboard-page">
      <section className="receptionist-dashboard-hero">
        <div>
          <h1>Dashboard Lễ tân</h1>
          <p>Trung tâm theo dõi tình trạng đặt phòng, xử lý yêu cầu và hiệu suất vận hành theo thời gian thực.</p>
        </div>
        <button type="button" className="dashboard-refresh-btn" onClick={fetchDashboardData} disabled={loading}>
          <i className="fas fa-rotate" aria-hidden /> {loading ? 'Đang tải...' : 'Làm mới dữ liệu'}
        </button>
      </section>

      {error && (
        <div className="receptionist-dashboard-error">
          <i className="fas fa-triangle-exclamation" aria-hidden /> {error}
        </div>
      )}

      <section className="receptionist-dashboard-kpi-grid">
        <article className="kpi-card">
          <span className="kpi-title">Phòng đang hoạt động</span>
          <strong>{dashboardData.activeRooms.length}</strong>
          <small>Tổng: {rooms.length} phòng</small>
        </article>
        <article className="kpi-card">
          <span className="kpi-title">Yêu cầu chờ duyệt</span>
          <strong>{pendingBookings.length}</strong>
          <small>Cần xử lý sớm</small>
        </article>
        <article className="kpi-card">
          <span className="kpi-title">Sự kiện tháng này</span>
          <strong>{dashboardData.monthBookings.length}</strong>
          <small>Trong tháng hiện tại</small>
        </article>
        <article className="kpi-card">
          <span className="kpi-title">Lịch diễn ra hôm nay</span>
          <strong>{dashboardData.todayBookings.length}</strong>
          <small>Mức sử dụng: {dashboardData.occupancyToday}%</small>
        </article>
        <article className="kpi-card">
          <span className="kpi-title">Tỉ lệ duyệt</span>
          <strong>{dashboardData.approvalRate}%</strong>
          <small>Trong các yêu cầu đã xử lý</small>
        </article>
        <article className="kpi-card">
          <span className="kpi-title">Người dùng trong module</span>
          <strong>{users.length}</strong>
          <small>Tài khoản không phải sinh viên</small>
        </article>
      </section>
      <section className="receptionist-dashboard-lists">
        <article className="dashboard-panel list-panel">
          <header>
            <h3>Sự kiện sắp diễn ra</h3>
            <Link to="/receptionist/booking">Mở lịch</Link>
          </header>
          <div className="event-list">
            {dashboardData.upcomingEvents.length === 0 ? (
              <p className="empty-text">Không có sự kiện sắp tới.</p>
            ) : dashboardData.upcomingEvents.map((event) => (
              <div
                key={`upcoming-${event.id}`}
                className="event-row event-row-clickable"
                role="button"
                tabIndex={0}
                onClick={() => openEditModal(event)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openEditModal(event);
                  }
                }}
              >
                <div>
                  <strong>{event.title || 'Không có tiêu đề'}</strong>
                  <span>
                    {event.room_name && event.room_code
                      ? `${event.room_name} ${event.room_code}`
                      : (event.room_name || event.room_code || `Phòng ${event.room_id}`)}
                    {event.isRecurringGroup && event.seriesCount > 1 ? ` • Định kỳ (${event.seriesCount} lịch)` : ''}
                  </span>
                </div>
                <div>
                  <small>{formatDateTime(event.start_at)}</small>
                  <span className={`status-badge ${event.status || 'pending'}`}>{STATUS_CONFIG[event.status]?.label || event.status}</span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="dashboard-panel list-panel">
          <header>
            <h3>Sự kiện mới tạo nhất</h3>
            <Link to="/receptionist/approvals">Xem duyệt</Link>
          </header>
          <div className="event-list">
            {dashboardData.latestEvents.length === 0 ? (
              <p className="empty-text">Chưa có dữ liệu sự kiện.</p>
            ) : dashboardData.latestEvents.map((event) => (
              <div
                key={`latest-${event.id}`}
                className="event-row event-row-clickable"
                role="button"
                tabIndex={0}
                onClick={() => openEditModal(event)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openEditModal(event);
                  }
                }}
              >
                <div>
                  <strong>{event.title || 'Không có tiêu đề'}</strong>
                  <span>
                    Người tạo: {event.user_name || event.user_email || 'Không rõ người đặt'}
                    {event.isRecurringGroup && event.seriesCount > 1 ? ` • Định kỳ (${event.seriesCount} lịch)` : ''}
                  </span>
                </div>
                <div>
                  <small>Tạo lúc: {formatDateTime(event.created_at || event.start_at)}</small>
                  <span className={`status-badge ${event.status || 'pending'}`}>{STATUS_CONFIG[event.status]?.label || event.status}</span>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
      <section className="receptionist-dashboard-chart-grid">
        <article className="dashboard-panel">
          <header>
            <h3>Số lượng sự kiện theo tháng</h3>
          </header>
          <BarChart
            labels={MONTH_SHORT}
            data={dashboardData.monthlyCounts}
            title=""
            yAxisLabel="Sự kiện"
            colors={['#2f80ed']}
            height={290}
            showDataLabels
          />
        </article>

        <article className="dashboard-panel">
          <header>
            <h3>Tỷ trọng trạng thái đặt phòng</h3>
          </header>
          <PieChart
            labels={Object.keys(STATUS_CONFIG).map((k) => STATUS_CONFIG[k].label)}
            data={Object.keys(STATUS_CONFIG).map((k) => dashboardData.statusCount[k] || 0)}
            colors={Object.keys(STATUS_CONFIG).map((k) => STATUS_CONFIG[k].color)}
            height={290}
          />
        </article>

        <article className="dashboard-panel">
          <header>
            <h3>Top phòng được sử dụng nhiều nhất</h3>
          </header>
          <BarChart
            labels={dashboardData.roomUsage.map((r) => r.label)}
            data={dashboardData.roomUsage.map((r) => r.count)}
            title=""
            yAxisLabel="Sự kiện"
            colors={['#3cb179']}
            height={280}
            showDataLabels
          />
        </article>

        <article className="dashboard-panel">
          <header>
            <h3>Phân bổ sự kiện theo ngày trong tuần</h3>
          </header>
          <LineChart
            labels={WEEKDAY_LABELS}
            data={dashboardData.weekDayCounts}
            title=""
            yAxisLabel="Số sự kiện"
            colors={['#9b51e0']}
            fill
            height={280}
          />
        </article>
      </section>

      {modalOpen && editingBooking && (
        <div className="receptionist-booking-backdrop modal-backdrop gcal-modal-backdrop booking-modal-no-blur" onClick={closeEditModal}>
          <div className="receptionist-booking-modal modal-content receptionist-modal gcal-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="dashboard-edit-booking-title">
            <div className="modal-header gcal-modal-header">
              <h2 id="dashboard-edit-booking-title" className="modal-title gcal-modal-title">Chỉnh sửa đặt phòng</h2>
              <button type="button" className="gcal-modal-close" onClick={closeEditModal} aria-label="Đóng">
                <svg focusable="false" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" /></svg>
              </button>
            </div>
            <form onSubmit={handleSubmitEdit}>
              <div className="modal-body">
                {submitStatus.message && (
                  <div className={`gcal-alert ${submitStatus.type === 'success' ? 'gcal-alert-success' : 'gcal-alert-error'}`}>
                    {submitStatus.message}
                  </div>
                )}
                <div className="mb-3">
                  <label className="form-label">Phòng</label>
                  <select className="form-select" value={form.roomId} onChange={(e) => setForm((f) => ({ ...f, roomId: e.target.value }))} required>
                    <option value="">-- Chọn phòng --</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Tiêu đề / Nội dung</label>
                  <input type="text" className="form-control" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
                </div>
                <div className="row g-2">
                  <div className="col-6">
                    <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
                      <label className="form-label mb-0">Ngày bắt đầu</label>
                      {(editingBooking.recurrence_rule_id != null || editingBooking.recurrence_rule) && isRecurring && (
                        <button type="button" className="gcal-btn gcal-btn-text text-danger btn-sm" onClick={handleDeleteSingleOccurrence} title="Xóa chỉ ngày này trong chuỗi định kỳ">
                          Xóa ngày này
                        </button>
                      )}
                    </div>
                    <input type="date" className="form-control" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} required />
                  </div>
                  <div className="col-6">
                    <label className="form-label">Giờ bắt đầu</label>
                    <div className="d-flex gap-1 align-items-center">
                      <select className="form-select form-select-sm" value={timeToParts(form.startTime)[0]} onChange={(e) => { const [, m] = timeToParts(form.startTime); setForm((f) => ({ ...f, startTime: partsToTime(Number(e.target.value), m) })); }}>
                        {HOUR_OPTIONS.map((h) => <option key={h} value={h}>{String(h).padStart(2, '0')} giờ</option>)}
                      </select>
                      <span className="text-muted">:</span>
                      <select className="form-select form-select-sm" value={timeToParts(form.startTime)[1]} onChange={(e) => { const [h] = timeToParts(form.startTime); setForm((f) => ({ ...f, startTime: partsToTime(h, Number(e.target.value)) })); }}>
                        {MINUTE_OPTIONS.map((m) => <option key={m} value={m}>{String(m).padStart(2, '0')} phút</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="form-check mb-2 mt-2">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="dashboard-recurrence-toggle"
                    checked={isRecurring}
                    disabled={!!editingBooking && !editingBooking?.recurrence_rule && editingBooking?.recurrence_rule_id == null}
                    onChange={(e) => {
                      if (editingBooking && !editingBooking?.recurrence_rule && editingBooking?.recurrence_rule_id == null) return;
                      setIsRecurring(e.target.checked);
                    }}
                  />
                  <label className="form-check-label" htmlFor="dashboard-recurrence-toggle">
                    Đăng ký định kỳ{(editingBooking?.recurrence_rule || editingBooking?.recurrence_rule_id != null) ? ' (chỉnh sửa quy tắc lặp)' : ''}
                  </label>
                </div>
                <div className="row g-2 mt-1">
                  <div className="col-6">
                    <label className="form-label">Giờ kết thúc</label>
                    <div className="d-flex gap-1 align-items-center">
                      <select className="form-select form-select-sm" value={timeToParts(form.endTime)[0]} onChange={(e) => { const [, m] = timeToParts(form.endTime); setForm((f) => ({ ...f, endTime: partsToTime(Number(e.target.value), m) })); }}>
                        {HOUR_OPTIONS.map((h) => <option key={h} value={h}>{String(h).padStart(2, '0')} giờ</option>)}
                      </select>
                      <span className="text-muted">:</span>
                      <select className="form-select form-select-sm" value={timeToParts(form.endTime)[1]} onChange={(e) => { const [h] = timeToParts(form.endTime); setForm((f) => ({ ...f, endTime: partsToTime(h, Number(e.target.value)) })); }}>
                        {MINUTE_OPTIONS.map((m) => <option key={m} value={m}>{String(m).padStart(2, '0')} phút</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                {isRecurring && (
                  <div className="recurrence-block mt-3 p-3 border rounded">
                    <div className="mb-3">
                      <label className="form-label small">Lặp theo</label>
                      <div className="d-flex flex-wrap gap-2">
                        {['week', 'month', 'quarter', 'year'].map((freq) => (
                          <label key={freq} className="d-flex align-items-center gap-1">
                            <input type="radio" name="dashboardRecurrenceFreq" checked={recurrenceFreq === freq} onChange={() => setRecurrenceFreq(freq)} />
                            <span>{freq === 'week' ? 'Tuần' : freq === 'month' ? 'Tháng' : freq === 'quarter' ? 'Quý' : 'Năm'}</span>
                          </label>
                        ))}
                      </div>
                      {recurrenceFreq === 'week' && (
                        <div className="mt-2">
                          <span className="small text-muted me-2">Chọn ngày trong tuần:</span>
                          <div className="d-flex flex-wrap gap-2 mt-1">
                            {[[1, 'Thứ 2'], [2, 'Thứ 3'], [3, 'Thứ 4'], [4, 'Thứ 5'], [5, 'Thứ 6'], [6, 'Thứ 7'], [7, 'Chủ nhật']].map(([n, label]) => (
                              <label key={n} className="d-flex align-items-center gap-1 small">
                                <input
                                  type="checkbox"
                                  checked={recurrenceWeekdays.includes(n)}
                                  onChange={(e) => {
                                    if (e.target.checked) setRecurrenceWeekdays((w) => [...w, n].sort((a, b) => a - b));
                                    else setRecurrenceWeekdays((w) => w.filter((x) => x !== n));
                                  }}
                                />
                                {label}
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                      {recurrenceFreq === 'month' && (
                        <div className="mt-2 d-flex flex-wrap align-items-center gap-2">
                          <select
                            className="form-select form-select-sm"
                            style={{ width: 'auto' }}
                            value=""
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              if (v && !recurrenceMonthDays.includes(v)) setRecurrenceMonthDays((d) => [...d, v].sort((a, b) => a - b));
                              e.target.value = '';
                            }}
                          >
                            <option value="">-- Chọn ngày --</option>
                            {Array.from({ length: 31 }, (_, i) => i + 1).filter((d) => !recurrenceMonthDays.includes(d)).map((d) => (
                              <option key={d} value={d}>Ngày {d}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="form-label small">Chuỗi lặp kết thúc</label>
                      <div className="d-flex flex-wrap gap-3 align-items-center">
                        <label className="d-flex align-items-center gap-1 small">
                          <input type="radio" name="dashboardRecurrenceEnd" checked={recurrenceEndType === 'date'} onChange={() => setRecurrenceEndType('date')} />
                          Vào ngày
                        </label>
                        {recurrenceEndType === 'date' && (
                          <input type="date" className="form-control form-control-sm" value={recurrenceEndDate} onChange={(e) => setRecurrenceEndDate(e.target.value)} style={{ width: 'auto' }} />
                        )}
                        <label className="d-flex align-items-center gap-1 small">
                          <input type="radio" name="dashboardRecurrenceEnd" checked={recurrenceEndType === 'count'} onChange={() => setRecurrenceEndType('count')} />
                          Số lần
                        </label>
                        {recurrenceEndType === 'count' && (
                          <input type="number" className="form-control form-control-sm" min={1} max={200} value={recurrenceCount} onChange={(e) => setRecurrenceCount(Number(e.target.value) || 1)} style={{ width: '80px' }} />
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer gcal-modal-footer">
                {editingBooking?.status === 'pending' && receptionistAdmin && (
                  <>
                    <button type="button" className="gcal-btn gcal-btn-success" onClick={() => handleApproveBooking(false)} disabled={approveLoading}>
                      {approveLoading ? 'Đang xử lý...' : 'Duyệt'}
                    </button>
                    {editingBooking.recurrence_rule_id != null && (
                      <button type="button" className="gcal-btn gcal-btn-success" onClick={() => handleApproveBooking(true)} disabled={approveLoading}>
                        Duyệt tất cả
                      </button>
                    )}
                    <button type="button" className="gcal-btn gcal-btn-text text-danger" onClick={() => handleRejectBooking(false)} disabled={approveLoading}>
                      Từ chối
                    </button>
                    {editingBooking.recurrence_rule_id != null && (
                      <button type="button" className="gcal-btn gcal-btn-text text-danger" onClick={() => handleRejectBooking(true)} disabled={approveLoading}>
                        Từ chối tất cả
                      </button>
                    )}
                  </>
                )}
                <button type="button" className="gcal-btn gcal-btn-text text-danger" onClick={handleDeleteBooking} title={editingBooking?.recurrence_rule_id != null ? 'Xóa toàn bộ chuỗi định kỳ' : 'Xóa sự kiện'}>
                  Xóa
                </button>
                <button type="button" className="gcal-btn gcal-btn-text" onClick={closeEditModal}>Hủy</button>
                <button type="submit" className="gcal-btn gcal-btn-primary" disabled={!canSaveEdit()}>Cập nhật</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
