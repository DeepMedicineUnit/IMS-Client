import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import QRCode from 'qrcode.react';
import api from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import usePageTitle from '../../hooks/usePageTitle';
import './MeetingRoomBooking.css';

const VIEW_MODE = { DAY: 'day', WEEK: 'week', MONTH: 'month', YEAR: 'year' };
/* Khung giờ 24h: 06:00 – 23:00 (dễ chọn theo giờ) */
const HOURS_24 = Array.from({ length: 18 }, (_, i) => i + 6);

const formatHour = (h) => `${String(h).padStart(2, '0')}:00`;

const timeToParts = (timeStr) => {
  if (!timeStr) return [8, 0];
  const [h, m] = timeStr.split(':').map(Number);
  const hour = isNaN(h) ? 8 : Math.min(22, Math.max(5, h));
  return [hour, isNaN(m) ? 0 : m];
};
const partsToTime = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
/** Giờ cho dropdown chỉ từ 5 đến 22 */
const HOUR_OPTIONS = Array.from({ length: 18 }, (_, i) => i + 5);
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => i);

const formatDateKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

const getWeekStart = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
};

const getMonthStart = (date) => {
  const d = new Date(date);
  d.setDate(1);
  return d;
};

const RECEPTIONIST_ADMIN = 'receptionist_admin';
const RECEPTIONIST_STAFF_ROLES = ['receptionist_staff', 'meeting_staff'];
const VIEW_MODE_OPTIONS = [
  { value: VIEW_MODE.DAY, label: 'Ngày', icon: 'fas fa-calendar-day' },
  { value: VIEW_MODE.WEEK, label: 'Tuần', icon: 'fas fa-calendar-week' },
  { value: VIEW_MODE.MONTH, label: 'Tháng', icon: 'fas fa-calendar-alt' },
  { value: VIEW_MODE.YEAR, label: 'Năm', icon: 'fas fa-calendar' }
];

export default function MeetingRoomBooking({ isPublic = false }) {
  usePageTitle(isPublic ? 'Đặt phòng họp' : 'Đặt phòng họp');
  const { currentUser } = useAuth();
  const [viewMode, setViewMode] = useState(VIEW_MODE.MONTH);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  /** Khi set: modal đặt bên cạnh ô đã click. Khi null: modal ở giữa (mở từ nút Đặt phòng). */
  const [modalAnchor, setModalAnchor] = useState(null);
  const [slotDate, setSlotDate] = useState(null);
  const [slotPart, setSlotPart] = useState(null);
  const [draggedBookingId, setDraggedBookingId] = useState(null);
  const [dropTargetDateKey, setDropTargetDateKey] = useState(null);
  const [moveBookingStatus, setMoveBookingStatus] = useState({ type: null, message: null });
  const [form, setForm] = useState({
    roomId: '',
    title: '',
    startDate: '',
    startTime: '08:00',
    endDate: '',
    endTime: '09:00'
  });
  const [submitStatus, setSubmitStatus] = useState({ type: null, message: null });
  /** Đang chỉnh sửa booking (admin/staff click vào sự kiện) — null = modal tạo mới */
  const [editingBooking, setEditingBooking] = useState(null);
  /** Xem thông tin read-only khi click sự kiện không được chỉnh sửa */
  const [viewingBooking, setViewingBooking] = useState(null);
  /** Đăng ký định kỳ: tạo mới hoặc chỉnh sửa sự kiện thuộc chuỗi (recurrence_rule / recurrence_rule_id). */
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFreq, setRecurrenceFreq] = useState('week'); // 'week' | 'month' | 'quarter' | 'year'
  const [recurrenceWeekdays, setRecurrenceWeekdays] = useState([]); // 1=Thứ 2, ..., 7=Chủ nhật
  const [recurrenceMonthDays, setRecurrenceMonthDays] = useState([]); // [1..31] đã chọn
  const [recurrenceEndType, setRecurrenceEndType] = useState('date'); // 'date' | 'count'
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [recurrenceCount, setRecurrenceCount] = useState(10);
  /** Vị trí modal khi kéo (null = dùng vị trí mặc định/anchored) */
  const [modalPosition, setModalPosition] = useState(null);
  const [isDraggingModal, setIsDraggingModal] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);
  const [showMonthYearPicker, setShowMonthYearPicker] = useState(false);
  /** Tháng/năm đang hiển thị trong modal chọn ngày (để lật tháng mà chưa áp dụng). */
  const [pickerViewDate, setPickerViewDate] = useState(() => new Date());
  const [showPublicLinkModal, setShowPublicLinkModal] = useState(false);
  const [publicLinkCopied, setPublicLinkCopied] = useState(false);
  const [showImportExcelModal, setShowImportExcelModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const modalRef = useRef(null);
  const dragStartRef = useRef(null);
  const toolbarTitleRef = useRef(null);

  const fetchRooms = useCallback(async () => {
    try {
      const url = isPublic ? '/receptionist/public/rooms' : '/receptionist/rooms';
      const res = await api.get(url);
      if (res.data?.success) setRooms(res.data.data || []);
    } catch (e) {
      setError('Không tải được danh sách phòng');
    }
  }, [isPublic]);

  const fetchBookings = useCallback(async () => {
    let start, end;
    const d = new Date(currentDate);
    if (viewMode === VIEW_MODE.DAY) {
      start = new Date(d);
      start.setHours(0, 0, 0, 0);
      end = new Date(d);
      end.setHours(23, 59, 59, 999);
    } else if (viewMode === VIEW_MODE.WEEK) {
      const weekStart = getWeekStart(d);
      start = new Date(weekStart);
      start.setHours(0, 0, 0, 0);
      end = new Date(weekStart);
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (viewMode === VIEW_MODE.YEAR) {
      start = new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
      end = new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);
    } else {
      const monthStart = getMonthStart(d);
      const firstDay = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1);
      const dow = firstDay.getDay();
      const offset = dow === 0 ? 6 : dow - 1;
      start = new Date(firstDay);
      start.setDate(start.getDate() - offset);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(end.getDate() + 6 * 7 - 1);
      end.setHours(23, 59, 59, 999);
    }
    try {
      const url = isPublic ? '/receptionist/public/bookings' : '/receptionist/bookings';
      const res = await api.get(url, {
        params: { start: start.toISOString(), end: end.toISOString() }
      });
      if (res.data?.success) setBookings(res.data.data || []);
    } catch (e) {
      setBookings([]);
    }
  }, [currentDate, viewMode, isPublic]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchRooms().finally(() => setLoading(false));
  }, [fetchRooms]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const openModal = (date, hourOrPart, anchorEvent) => {
    const d = date ? new Date(date) : new Date(currentDate);
    const dateStr = formatDateKey(d);
    setSlotDate(d);
    setSlotPart(hourOrPart);
    const isHour = typeof hourOrPart === 'number';
    const startH = isHour ? (hourOrPart >= 22 ? 21 : Math.min(22, Math.max(5, hourOrPart))) : (hourOrPart === 'morning' ? 8 : 13);
    const endH = isHour ? (hourOrPart >= 22 ? 22 : Math.min(22, hourOrPart + 1)) : (hourOrPart === 'morning' ? 9 : 14);
    const endTimeStr = formatHour(endH);
    setForm(prev => ({
      ...prev,
      roomId: rooms[0]?.id ? String(rooms[0].id) : '',
      startDate: dateStr,
      endDate: dateStr,
      startTime: formatHour(startH),
      endTime: endTimeStr
    }));
    setSubmitStatus({ type: null, message: null });
    setIsRecurring(false);
    setRecurrenceWeekdays([]);
    setRecurrenceMonthDays([]);
    setRecurrenceEndType('date');
    setRecurrenceEndDate('');
    setRecurrenceCount(10);
    setEditingBooking(null);
    setViewingBooking(null);
    if (anchorEvent && anchorEvent.currentTarget) {
      setModalAnchor(anchorEvent.currentTarget.getBoundingClientRect());
    } else {
      setModalAnchor(null);
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalAnchor(null);
    setSlotDate(null);
    setSlotPart(null);
    setEditingBooking(null);
    setViewingBooking(null);
    setModalPosition(null);
  };

  const handleModalDragStart = (e) => {
    if (e.button !== 0 || !modalRef.current) return;
    const rect = modalRef.current.getBoundingClientRect();
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      left: rect.left,
      top: rect.top
    };
    setIsDraggingModal(true);
  };

  useEffect(() => {
    if (!isDraggingModal) return;
    const MODAL_W = 600;
    const GAP = 8;
    const winW = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const winH = typeof window !== 'undefined' ? window.innerHeight : 768;
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    const onMove = (e) => {
      const start = dragStartRef.current;
      if (!start) return;
      const left = Math.max(GAP, Math.min(winW - MODAL_W - GAP, start.left + (e.clientX - start.mouseX)));
      const top = Math.max(GAP, Math.min(winH - GAP, start.top + (e.clientY - start.mouseY)));
      setModalPosition({ left, top });
    };
    const onUp = () => {
      setIsDraggingModal(false);
      dragStartRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDraggingModal]);

  useEffect(() => {
    if (!modalOpen || !modalAnchor || modalPosition) return;
    const GAP = 8;
    const rafId = window.requestAnimationFrame(() => {
      const el = modalRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const winW = typeof window !== 'undefined' ? window.innerWidth : 1024;
      const winH = typeof window !== 'undefined' ? window.innerHeight : 768;

      let nextTop = rect.top;
      let nextLeft = rect.left;

      if (rect.bottom > winH - GAP) {
        nextTop -= (rect.bottom - (winH - GAP));
      }
      if (rect.top < GAP) {
        nextTop = GAP;
      }
      if (rect.right > winW - GAP) {
        nextLeft -= (rect.right - (winW - GAP));
      }
      if (rect.left < GAP) {
        nextLeft = GAP;
      }

      if (Math.abs(nextTop - rect.top) > 1 || Math.abs(nextLeft - rect.left) > 1) {
        setModalPosition({ left: nextLeft, top: nextTop });
      }
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [modalOpen, modalAnchor, modalPosition]);

  const roles = currentUser?.module_roles || [];
  const isReceptionistAdmin = currentUser?.role === 'superadmin' || roles.includes(RECEPTIONIST_ADMIN);
  const canUseExcelImport = roles.includes(RECEPTIONIST_ADMIN);
  const isReceptionistStaff = RECEPTIONIST_STAFF_ROLES.some(r => roles.includes(r));
  const canDragBooking = (b) => {
    if (isPublic) return false;
    if (isReceptionistAdmin) return true;
    if (isReceptionistStaff && (b.status === 'pending')) return true;
    return false;
  };
  /** receptionist_admin: mọi sự kiện (kể cả định kỳ); receptionist_staff: chỉ sự kiện pending — mở modal chỉnh sửa giống "Đăng ký phòng họp". */
  const canEditBooking = (b) => canDragBooking(b);
  /** Staff chỉ được lưu chỉnh sửa khi là người tạo sự kiện; admin luôn được lưu. */
  const canSaveEdit = (booking) => !booking ? true : isReceptionistAdmin ? true : Number(booking.user_id) === Number(currentUser?.id);

  const openModalForEdit = (booking, anchorEvent) => {
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
    setEditingBooking(booking);
    setSubmitStatus({ type: null, message: null });
    const rule = booking.recurrence_rule;
    const isRecurringSeries = rule || booking.recurrence_rule_id != null;
    if (isRecurringSeries) {
      setIsRecurring(true);
      setRecurrenceFreq(rule?.frequency || 'week');
      setRecurrenceWeekdays(Array.isArray(rule?.weekdays) ? rule.weekdays : []);
      setRecurrenceMonthDays(Array.isArray(rule?.month_days) ? rule.month_days : []);
      setRecurrenceEndType(rule?.end_type || 'date');
      const savedEndDate = rule?.end_date;
      setRecurrenceEndDate(savedEndDate ? String(savedEndDate).slice(0, 10) : '');
      setRecurrenceCount(rule?.end_count != null ? Number(rule.end_count) : 10);
    } else {
      setIsRecurring(false);
      setRecurrenceWeekdays([]);
      setRecurrenceMonthDays([]);
    }
    if (anchorEvent?.currentTarget) {
      setModalAnchor(anchorEvent.currentTarget.getBoundingClientRect());
    } else {
      setModalAnchor(null);
    }
    setModalOpen(true);
  };

  const openModalForView = (booking, anchorEvent) => {
    setViewingBooking(booking);
    setEditingBooking(null);
    setSubmitStatus({ type: null, message: null });
    if (anchorEvent?.currentTarget) {
      setModalAnchor(anchorEvent.currentTarget.getBoundingClientRect());
    } else {
      setModalAnchor(null);
    }
    setModalOpen(true);
  };

  const handleEventClick = (booking, date, hourOrPart, e) => {
    e.stopPropagation();
    if (isPublic) {
      openModalForView(booking, e);
      return;
    }
    if (canEditBooking(booking)) {
      openModalForEdit(booking, e);
    } else {
      openModalForView(booking, e);
    }
  };

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
        fetchBookings();
        setTimeout(() => { closeModal(); setSubmitStatus({ type: null, message: null }); }, 1200);
      } else {
        setSubmitStatus({ type: 'error', message: res.data?.message || 'Xóa thất bại.' });
      }
    } catch (err) {
      setSubmitStatus({ type: 'error', message: err.response?.data?.message || 'Lỗi xóa đặt phòng.' });
    }
  };

  /** Xóa chỉ 1 ngày (1 occurrence) trong chuỗi định kỳ — ngày đang chọn ở ô "Ngày bắt đầu". */
  const handleDeleteSingleOccurrence = async () => {
    if (!editingBooking || (editingBooking.recurrence_rule_id == null && !editingBooking.recurrence_rule)) return;
    const dateToDelete = form.startDate || (editingBooking.start_at ? formatDateKey(new Date(editingBooking.start_at)) : '');
    const dateLabel = dateToDelete ? new Date(dateToDelete + 'T12:00:00').toLocaleDateString('vi-VN') : '';
    if (!window.confirm(`Xóa đặt phòng chỉ ngày ${dateLabel} trong chuỗi định kỳ? Các ngày khác vẫn giữ nguyên.`)) return;
    setSubmitStatus({ type: null, message: null });
    try {
      const res = await api.delete(`/receptionist/bookings/${editingBooking.id}`, {
        params: { singleOccurrence: 'true', date: dateToDelete }
      });
      if (res.data?.success) {
        setSubmitStatus({ type: 'success', message: res.data.message || 'Đã xóa ngày đã chọn.' });
        fetchBookings();
        setTimeout(() => { closeModal(); setSubmitStatus({ type: null, message: null }); }, 1200);
      } else {
        setSubmitStatus({ type: 'error', message: res.data?.message || 'Xóa thất bại.' });
      }
    } catch (err) {
      setSubmitStatus({ type: 'error', message: err.response?.data?.message || 'Lỗi xóa đặt phòng.' });
    }
  };

  /** Duyệt một sự kiện hoặc duyệt tất cả chuỗi (chỉ receptionist_admin, sự kiện pending). */
  const handleApproveBooking = async (applyToSeries = false) => {
    if (!editingBooking || editingBooking.status !== 'pending' || !isReceptionistAdmin) return;
    setSubmitStatus({ type: null, message: null });
    setApproveLoading(true);
    try {
      const res = await api.post(`/receptionist/bookings/${editingBooking.id}/review`, {
        action: 'approve',
        ...(applyToSeries && editingBooking.recurrence_rule_id != null ? { applyToSeries: true } : {})
      });
      if (res.data?.success) {
        setSubmitStatus({ type: 'success', message: res.data.message || (applyToSeries ? 'Đã duyệt tất cả.' : 'Đã duyệt đặt phòng.') });
        fetchBookings();
        setTimeout(() => { closeModal(); setSubmitStatus({ type: null, message: null }); setApproveLoading(false); }, 1200);
      } else {
        setSubmitStatus({ type: 'error', message: res.data?.message || 'Duyệt thất bại.' });
        setApproveLoading(false);
      }
    } catch (err) {
      setSubmitStatus({ type: 'error', message: err.response?.data?.message || 'Lỗi duyệt đặt phòng.' });
      setApproveLoading(false);
    }
  };

  /** Từ chối một sự kiện hoặc từ chối tất cả chuỗi (chỉ receptionist_admin, sự kiện pending). */
  const handleRejectBooking = async (applyToSeries = false) => {
    if (!editingBooking || editingBooking.status !== 'pending' || !isReceptionistAdmin) return;
    const reason = window.prompt('Lý do từ chối (có thể để trống):');
    if (reason === null) return; // User bấm Hủy
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
        fetchBookings();
        setTimeout(() => { closeModal(); setSubmitStatus({ type: null, message: null }); setApproveLoading(false); }, 1200);
      } else {
        setSubmitStatus({ type: 'error', message: res.data?.message || 'Từ chối thất bại.' });
        setApproveLoading(false);
      }
    } catch (err) {
      setSubmitStatus({ type: 'error', message: err.response?.data?.message || 'Lỗi từ chối đặt phòng.' });
      setApproveLoading(false);
    }
  };

  const moveBookingToDate = useCallback(async (booking, targetDate) => {
    setMoveBookingStatus({ type: null, message: null });
    const oldStart = new Date(booking.start_at);
    const oldEnd = new Date(booking.end_at);
    const d = new Date(targetDate);
    d.setHours(0, 0, 0, 0);
    const newStart = new Date(d);
    newStart.setHours(oldStart.getHours(), oldStart.getMinutes(), oldStart.getSeconds(), 0);
    const durationMs = oldEnd.getTime() - oldStart.getTime();
    const newEnd = new Date(newStart.getTime() + durationMs);
    try {
      const res = await api.put(`/receptionist/bookings/${booking.id}`, {
        startAt: newStart.toISOString(),
        endAt: newEnd.toISOString()
      });
      if (res.data?.success) {
        setMoveBookingStatus({ type: 'success', message: res.data.message || 'Đã đổi ngày sự kiện.' });
        fetchBookings();
        setTimeout(() => setMoveBookingStatus({ type: null, message: null }), 2500);
      } else {
        setMoveBookingStatus({ type: 'error', message: res.data?.message || 'Không đổi được ngày.' });
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Lỗi đổi ngày sự kiện.';
      setMoveBookingStatus({ type: 'error', message: msg });
    }
  }, [fetchBookings]);

  const handleDragStart = (e, booking) => {
    if (!canDragBooking(booking)) return;
    e.dataTransfer.setData('application/json', JSON.stringify({ id: booking.id }));
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', booking.title);
    setDraggedBookingId(booking.id);
  };
  const handleDragEnd = () => { setDraggedBookingId(null); setDropTargetDateKey(null); };
  const handleDropOnDay = (e, targetDate) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/json');
    if (!raw) return;
    try {
      const { id } = JSON.parse(raw);
      const booking = bookings.find(b => b.id === id);
      if (booking && targetDate && canDragBooking(booking)) {
        moveBookingToDate(booking, targetDate);
      }
    } catch (_) { /* ignore */ }
    setDraggedBookingId(null);
  };
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  const handleDragEnterDay = (dateKey) => {
    if (draggedBookingId) setDropTargetDateKey(dateKey);
  };
  const handleDragLeaveDay = () => setDropTargetDateKey(null);

  const checkAvailability = async (roomId, startAt, endAt) => {
    const res = await api.get('/receptionist/availability', {
      params: { roomId, startAt: startAt.toISOString(), endAt: endAt.toISOString() }
    });
    return res.data?.available === true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitStatus({ type: null, message: null });
    const { roomId, title, startDate, startTime, endDate, endTime } = form;
    const useEndDate = !editingBooking && !isRecurring;
    if (!roomId || !title || !startDate || !startTime || !endTime) {
      setSubmitStatus({ type: 'error', message: 'Vui lòng điền đủ thông tin.' });
      return;
    }
    if (useEndDate && !endDate) {
      setSubmitStatus({ type: 'error', message: 'Vui lòng chọn ngày kết thúc.' });
      return;
    }
    const startAt = new Date(`${startDate}T${startTime}:00`);
    const endAt = useEndDate
      ? new Date(`${endDate}T${endTime}:00`)
      : new Date(`${startDate}T${endTime}:00`);
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
    const isEdit = Boolean(editingBooking);
    if (isEdit && !canSaveEdit(editingBooking)) {
      setSubmitStatus({ type: 'error', message: 'Chỉ người tạo sự kiện mới được chỉnh sửa.' });
      return;
    }
    if (!isEdit) {
    const available = await checkAvailability(roomId, startAt, endAt);
    if (!available) {
      setSubmitStatus({ type: 'error', message: 'Phòng không trống trong khung giờ này.' });
        return;
      }
    }
    try {
        if (isEdit) {
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
          fetchBookings();
          setTimeout(() => closeModal(), 1500);
        } else {
          setSubmitStatus({ type: 'error', message: res.data?.message || 'Cập nhật thất bại.' });
        }
      } else {
        if (isRecurring) {
          const occurrences = getRecurrenceOccurrences();
          if (!occurrences.length) {
            setSubmitStatus({ type: 'error', message: 'Chuỗi lặp không tạo ra lịch nào. Kiểm tra Lặp theo và Chuỗi lặp kết thúc.' });
      return;
    }
    try {
            const res = await api.post('/receptionist/bookings', {
              roomId: Number(roomId),
              title: title.trim(),
              recurrence: {
                frequency: recurrenceFreq,
                weekdays: recurrenceFreq === 'week' ? recurrenceWeekdays : null,
                month_days: recurrenceFreq === 'month' ? recurrenceMonthDays : null,
                end_type: recurrenceEndType,
                end_date: recurrenceEndType === 'date' ? recurrenceEndDate : null,
                end_count: recurrenceEndType === 'count' ? recurrenceCount : null
              },
              occurrences: occurrences.map(({ startAt: s, endAt: e }) => ({ startAt: s.toISOString(), endAt: e.toISOString() }))
            });
            if (res.data?.success) {
              setSubmitStatus({ type: 'success', message: res.data.message || `Đã tạo ${res.data.data?.count ?? occurrences.length} đặt phòng định kỳ.` });
              fetchBookings();
              setTimeout(() => closeModal(), 2500);
            } else {
              setSubmitStatus({ type: 'error', message: res.data?.message || 'Tạo đặt phòng thất bại.' });
            }
          } catch (err) {
            setSubmitStatus({ type: 'error', message: err.response?.data?.message || 'Lỗi tạo đặt phòng định kỳ.' });
          }
        } else {
      const res = await api.post('/receptionist/bookings', {
        roomId: Number(roomId),
        title: title.trim(),
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString()
      });
      if (res.data?.success) {
        setSubmitStatus({ type: 'success', message: res.data.message || 'Đã gửi yêu cầu đặt phòng, chờ admin duyệt.' });
        fetchBookings();
            setTimeout(() => closeModal(), 1500);
      } else {
            setSubmitStatus({ type: 'error', message: res.data?.message || 'Tạo đặt phòng thất bại.' });
          }
        }
      }
    } catch (err) {
      const msg = err.response?.data?.message || (isEdit ? 'Lỗi cập nhật.' : 'Lỗi gửi yêu cầu.');
      setSubmitStatus({ type: 'error', message: msg });
    }
  };

  const goToday = () => setCurrentDate(new Date());
  const goPrev = () => {
    const d = new Date(currentDate);
    if (viewMode === VIEW_MODE.DAY) d.setDate(d.getDate() - 1);
    else if (viewMode === VIEW_MODE.WEEK) d.setDate(d.getDate() - 7);
    else if (viewMode === VIEW_MODE.YEAR) d.setFullYear(d.getFullYear() - 1);
    else d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };
  const goNext = () => {
    const d = new Date(currentDate);
    if (viewMode === VIEW_MODE.DAY) d.setDate(d.getDate() + 1);
    else if (viewMode === VIEW_MODE.WEEK) d.setDate(d.getDate() + 7);
    else if (viewMode === VIEW_MODE.YEAR) d.setFullYear(d.getFullYear() + 1);
    else d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  };

  const applyMonthYear = (month1Based, year) => {
    const d = new Date(year, month1Based - 1, 1);
    if (viewMode === VIEW_MODE.WEEK) {
      const weekStart = getWeekStart(d);
      setCurrentDate(weekStart);
    } else {
      setCurrentDate(d);
    }
    setShowMonthYearPicker(false);
  };

  /** Khi mở modal chọn ngày, đồng bộ tháng/năm hiển thị với currentDate */
  useEffect(() => {
    if (showMonthYearPicker) setPickerViewDate(new Date(currentDate));
  }, [showMonthYearPicker]); // eslint-disable-line react-hooks/exhaustive-deps -- chỉ cần khi mở

  useEffect(() => {
    if (!showPublicLinkModal) setPublicLinkCopied(false);
  }, [showPublicLinkModal]);

  useEffect(() => {
    if (!showImportExcelModal) {
      setImportFile(null);
      setImportLoading(false);
      setImportResult(null);
    }
  }, [showImportExcelModal]);

  const handleImportExcelSubmit = async () => {
    if (!canUseExcelImport) {
      setImportResult({
        type: 'error',
        message: 'Chỉ receptionist_admin mới được sử dụng chức năng Import Excel.',
        errors: []
      });
      return;
    }
    if (!importFile) {
      setImportResult({ type: 'error', message: 'Vui lòng chọn file Excel (.xlsx, .xls).', errors: [] });
      return;
    }
    const name = importFile.name?.toLowerCase() || '';
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      setImportResult({ type: 'error', message: 'Định dạng file không hợp lệ. Chỉ chấp nhận .xlsx hoặc .xls.', errors: [] });
      return;
    }

    setImportLoading(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('excelFile', importFile);
      const res = await api.post('/receptionist/bookings/import-excel', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const data = res.data || {};
      const errors = data?.data?.errors || [];
      const isOk = data.success === true;
      setImportResult({
        type: isOk ? 'success' : 'error',
        message: data.message || (isOk ? 'Import thành công.' : 'Import có lỗi.'),
        created: data?.data?.created ?? 0,
        failed: data?.data?.failed ?? errors.length,
        errors: Array.isArray(errors) ? errors : []
      });
      fetchBookings();
    } catch (err) {
      const payload = err.response?.data || {};
      const errors = payload?.data?.errors || payload?.details?.errors || [];
      setImportResult({
        type: 'error',
        message: payload.message || 'Lỗi import Excel.',
        created: payload?.data?.created ?? 0,
        failed: payload?.data?.failed ?? (Array.isArray(errors) ? errors.length : 0),
        errors: Array.isArray(errors) ? errors : []
      });
    } finally {
      setImportLoading(false);
    }
  };

  /** Chọn ngày trong modal: áp dụng và đóng modal */
  const applyPickerDate = (year, month0, day) => {
    const d = new Date(year, month0, day);
    if (viewMode === VIEW_MODE.WEEK) {
      setCurrentDate(getWeekStart(d));
    } else {
      setCurrentDate(d);
    }
    setShowMonthYearPicker(false);
  };

  /** Lịch trong modal: lưới 6x7 cho tháng pickerViewDate (Thứ 2 = 1 .. Chủ nhật = 7) */
  const getPickerCalendarGrid = () => {
    const d = new Date(pickerViewDate.getFullYear(), pickerViewDate.getMonth(), 1);
    const firstDow = d.getDay();
    const startOffset = firstDow === 0 ? 6 : firstDow - 1;
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const grid = [];
    let dayNum = 1 - startOffset;
    for (let row = 0; row < 6; row++) {
      const rowDays = [];
      for (let col = 0; col < 7; col++) {
        const date = new Date(d.getFullYear(), d.getMonth(), dayNum);
        const isCurrentMonth = date.getMonth() === d.getMonth();
        rowDays.push({ date, dayNum: date.getDate(), isCurrentMonth, month: date.getMonth(), year: date.getFullYear() });
        dayNum++;
      }
      grid.push(rowDays);
    }
    return grid;
  };

  useEffect(() => {
    if (!showMonthYearPicker) return;
    const onMouseDown = (e) => {
      const el = toolbarTitleRef.current;
      const pickerEl = document.querySelector('.gcal-date-picker-modal');
      if (el && !el.contains(e.target) && pickerEl && !pickerEl.contains(e.target)) setShowMonthYearPicker(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [showMonthYearPicker]);

  const MONTH_NAMES = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
  const currentYear = new Date().getFullYear();
  const YEAR_OPTIONS = Array.from({ length: 16 }, (_, i) => currentYear - 2 + i);

  const WEEKDAY_LABELS = ['Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy', 'Chủ nhật'];
  const WEEKDAY_SHORT = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Cn'];

  const publicCalendarUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}${process.env.PUBLIC_URL || ''}/dat-phong-cong-khai`;

  const getTitleLabel = () => {
    const d = currentDate;
    if (viewMode === VIEW_MODE.DAY) return d.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (viewMode === VIEW_MODE.WEEK) {
      const start = getWeekStart(d);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return `Tuần ${start.getDate()}/${start.getMonth() + 1} - ${end.getDate()}/${end.getMonth() + 1}/${end.getFullYear()}`;
    }
    if (viewMode === VIEW_MODE.YEAR) {
      const yStart = new Date(d.getFullYear(), 0, 1);
      const yEnd = new Date(d.getFullYear(), 11, 31, 23, 59, 59);
      const totalYear = bookings.filter((b) => {
        const t = new Date(b.start_at).getTime();
        return t >= yStart.getTime() && t <= yEnd.getTime();
      }).length;
      return totalYear > 0 ? `Năm ${d.getFullYear()}, ${totalYear} sự kiện` : `Năm ${d.getFullYear()}`;
    }
    const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    const total = bookings.filter(b => {
      const t = new Date(b.start_at).getTime();
      return t >= mStart.getTime() && t <= mEnd.getTime();
    }).length;
    return total > 0 ? `Tháng ${d.getMonth() + 1}, ${d.getFullYear()}, ${total} sự kiện` : `Tháng ${d.getMonth() + 1}, ${d.getFullYear()}`;
  };

  const isToday = (d) => {
    const a = new Date(d);
    const b = new Date();
    return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  };

  const formatEventTime = (iso) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  const formatEventTimeRange = (startIso, endIso) => {
    if (!startIso || !endIso) return formatEventTime(startIso || endIso);
    return `${formatEventTime(startIso)} → ${formatEventTime(endIso)}`;
  };

  const dashboardStats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);
    const todayKey = formatDateKey(now);
    const monthBookings = bookings.filter((b) => {
      const t = new Date(b.start_at).getTime();
      return t >= monthStart.getTime() && t <= monthEnd.getTime();
    });
    const todayBookings = bookings.filter((b) => formatDateKey(new Date(b.start_at)) === todayKey);
    const pending = bookings.filter((b) => b.status === 'pending').length;
    const approved = bookings.filter((b) => b.status === 'approved').length;
    const uniqueRoomsToday = new Set(todayBookings.map((b) => b.room_id)).size;
    const occupancyRate = rooms.length ? Math.round((uniqueRoomsToday / rooms.length) * 100) : 0;
    const nextBooking = bookings
      .filter((b) => new Date(b.end_at) > now)
      .sort((a, b) => new Date(a.start_at) - new Date(b.start_at))[0] || null;
    return {
      monthTotal: monthBookings.length,
      todayTotal: todayBookings.length,
      pending,
      approved,
      occupancyRate,
      nextBooking
    };
  }, [bookings, currentDate, rooms.length]);

  /** Trả về các booking trùng với ngày `date` (kể cả sự kiện nhiều ngày: chỉ cần overlap). */
  const getBookingsForDate = (date) => {
    const d = new Date(date);
    const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    return bookings.filter(b => {
      const start = new Date(b.start_at);
      const end = new Date(b.end_at);
      return start <= endOfDay && end >= startOfDay;
    });
  };

  const getBookingsForHour = (date, hour) => {
    const list = getBookingsForDate(date);
    const hourStart = new Date(date);
    hourStart.setHours(hour, 0, 0, 0);
    const hourEnd = new Date(date);
    hourEnd.setHours(hour + 1, 0, 0, 0);
    return list.filter(b => {
      const start = new Date(b.start_at);
      const end = new Date(b.end_at);
      return start < hourEnd && end > hourStart;
    });
  };

  /** getDay(): 0=Chủ nhật, 1=Thứ 2, ..., 6=Thứ 7. recurrenceWeekdays: 1=Thứ 2, ..., 7=Chủ nhật */
  const dayMatchesWeekdays = (d, weekdays) => {
    if (!weekdays.length) return false;
    const jsDay = d.getDay(); // 0 Sun, 1 Mon, ...
    const n = jsDay === 0 ? 7 : jsDay;
    return weekdays.includes(n);
  };

  /** Sinh danh sách { startAt, endAt } cho đăng ký định kỳ. */
  const getRecurrenceOccurrences = useCallback(() => {
    const { startDate, startTime, endTime } = form;
    const [sh, sm] = timeToParts(startTime);
    const [eh, em] = timeToParts(endTime);
    const occurrences = [];
    const maxOccurrences = 200;

    if (recurrenceEndType === 'count' && recurrenceCount <= 0) return occurrences;
    const endDateLimit = recurrenceEndType === 'date' && recurrenceEndDate
      ? new Date(recurrenceEndDate + 'T23:59:59')
      : null;

    const firstStart = new Date(`${startDate}T${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}:00`);
    const firstEnd = new Date(`${startDate}T${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}:00`);
    if (firstEnd <= firstStart) return occurrences;

    const addOne = (date) => {
      const d = new Date(date);
      const startAt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), sh, sm, 0, 0);
      const endAt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), eh, em, 0, 0);
      if (endDateLimit && startAt > endDateLimit) return false;
      occurrences.push({ startAt, endAt });
      return recurrenceEndType === 'count' && occurrences.length >= recurrenceCount;
    };

    if (recurrenceFreq === 'week') {
      const weekdays = recurrenceWeekdays.length ? [...recurrenceWeekdays] : [firstStart.getDay() || 7];
      let cur = new Date(firstStart);
      cur.setHours(0, 0, 0, 0);
      const endAtLimit = endDateLimit || new Date(cur.getFullYear() + 2, cur.getMonth(), cur.getDate());
      while (cur <= endAtLimit && occurrences.length < maxOccurrences) {
        if (dayMatchesWeekdays(cur, weekdays)) {
          const stop = addOne(cur);
          if (stop) break;
        }
        cur.setDate(cur.getDate() + 1);
      }
    } else if (recurrenceFreq === 'month') {
      const days = recurrenceMonthDays.length ? [...recurrenceMonthDays] : [firstStart.getDate()];
      let cur = new Date(firstStart.getFullYear(), firstStart.getMonth(), 1);
      const endAtLimit = endDateLimit || new Date(cur.getFullYear() + 2, cur.getMonth(), 1);
      while (cur <= endAtLimit && occurrences.length < maxOccurrences) {
        const lastDay = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate();
        for (const day of days) {
          if (day > lastDay) continue;
          const d = new Date(cur.getFullYear(), cur.getMonth(), day);
          if (d < firstStart) continue;
          const stop = addOne(d);
          if (stop) return occurrences;
        }
        cur.setMonth(cur.getMonth() + 1);
      }
    } else if (recurrenceFreq === 'quarter') {
      const startMonth = firstStart.getMonth();
      const startDay = firstStart.getDate();
      let y = firstStart.getFullYear();
      let m = startMonth;
      const endAtLimit = endDateLimit || new Date(y + 2, startMonth, 1);
      while (occurrences.length < maxOccurrences) {
        const d = new Date(y, m, Math.min(startDay, new Date(y, m + 1, 0).getDate()));
        if (d >= firstStart) {
          const stop = addOne(d);
          if (stop) return occurrences;
        }
        m += 3;
        if (m > 11) { m -= 12; y += 1; }
        if (new Date(y, m, 1) > endAtLimit) break;
      }
    } else {
      const startDay = firstStart.getDate();
      const startMonth = firstStart.getMonth();
      let y = firstStart.getFullYear();
      const endAtLimit = endDateLimit || new Date(y + 5, startMonth, 1);
      while (occurrences.length < maxOccurrences) {
        const d = new Date(y, startMonth, Math.min(startDay, new Date(y, startMonth + 1, 0).getDate()));
        if (d >= firstStart) {
          const stop = addOne(d);
          if (stop) return occurrences;
        }
        y += 1;
        if (new Date(y, startMonth, 1) > endAtLimit) break;
      }
    }
    return occurrences;
  }, [form, recurrenceFreq, recurrenceWeekdays, recurrenceMonthDays, recurrenceEndType, recurrenceEndDate, recurrenceCount]);


  /* Xem ngày: cột dọc = 24h (06:00 – 23:00), mỗi hàng 1 giờ */
  const renderDayView = () => {
    const d = new Date(currentDate);
    const dayLabel = d.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' });
    return (
      <div className="receptionist-day-view">
        <table className="calendar-table day-table day-table-24h">
          <thead>
            <tr>
              <th className="col-day">Ngày</th>
              <th className="col-time">Giờ</th>
            </tr>
          </thead>
          <tbody>
            {HOURS_24.map((h, idx) => (
              <tr key={h}>
                {idx === 0 && (
                  <td className="col-day" rowSpan={HOURS_24.length}>{dayLabel}</td>
                )}
                <td
                  className="col-slot col-slot-24h"
                  onClick={(e) => { if (!isPublic) openModal(d, h, e); }}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDropOnDay(e, d)}
                >
                  <span className="slot-time-24h">{formatHour(h)} – {formatHour(h + 1)}</span>
                  {getBookingsForHour(d, h).map(b => (
                    <div
                      key={b.id}
                      className={`event-bar calendar-event-modern ${b.status || 'approved'} ${canDragBooking(b) ? 'draggable' : ''} ${draggedBookingId === b.id ? 'dragging' : ''}`}
                      draggable={canDragBooking(b)}
                      onDragStart={(e) => handleDragStart(e, b)}
                      onDragEnd={handleDragEnd}
                      onClick={(e) => handleEventClick(b, d, h, e)}
                    >
                      <span className="event-time">{formatEventTimeRange(b.start_at, b.end_at)}</span> {b.title}
                    </div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  /* Xem tuần: cột dọc = 24h (06:00 – 23:00), cột ngang = 7 ngày */
  const renderWeekView = () => {
    const weekStart = getWeekStart(currentDate);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    const dayNames = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
    return (
      <div className="receptionist-week-view">
        <table className="calendar-table week-table week-table-24h">
          <thead>
            <tr>
              <th className="col-hour-label">Giờ</th>
              {days.map((d, i) => (
                <th key={i} className={`col-day ${isToday(d) ? 'today' : ''}`}>
                  {dayNames[i]} {d.getDate()}/{d.getMonth() + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HOURS_24.map((h) => (
              <tr key={h}>
                <td className="col-hour-label">{formatHour(h)}</td>
                {days.map((d, i) => (
                  <td
                    key={i}
                    className={`col-slot col-slot-24h drop-target ${dropTargetDateKey === formatDateKey(d) ? 'drag-over' : ''}`}
                    onClick={(e) => { if (!isPublic) openModal(d, h, e); }}
                    onDragOver={handleDragOver}
                    onDragEnter={() => handleDragEnterDay(formatDateKey(d))}
                    onDragLeave={handleDragLeaveDay}
                    onDrop={(e) => { handleDropOnDay(e, d); setDropTargetDateKey(null); }}
                  >
                    {getBookingsForHour(d, h).map(b => (
                      <div
                        key={b.id}
                        className={`event-bar small calendar-event-modern ${b.status || 'approved'} ${canDragBooking(b) ? 'draggable' : ''} ${draggedBookingId === b.id ? 'dragging' : ''}`}
                        draggable={canDragBooking(b)}
                        onDragStart={(e) => handleDragStart(e, b)}
                        onDragEnd={handleDragEnd}
                        onClick={(e) => handleEventClick(b, d, h, e)}
                      >
                        <span className="event-time">{formatEventTimeRange(b.start_at, b.end_at)}</span> {b.title}
                      </div>
                    ))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  /* Lưới tháng giống mẫu Google Calendar: Thứ hai...Chủ nhật, số ngày, chip sự kiện (cả ngày + có giờ), hôm nay đánh dấu */
  const renderMonthView = () => {
    const monthStart = getMonthStart(currentDate);
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();
    const firstDay = new Date(year, month, 1);
    let start = new Date(firstDay);
    const dow = firstDay.getDay();
    const offset = dow === 0 ? 6 : dow - 1;
    start.setDate(start.getDate() - offset);
    const grid = [];
    for (let row = 0; row < 6; row++) {
      const rowDays = [];
      for (let col = 0; col < 7; col++) {
        const d = new Date(start);
        d.setDate(d.getDate() + row * 7 + col);
        rowDays.push(d);
      }
      grid.push(rowDays);
    }
    const dayNumLabel = (d) => {
      if (d.getMonth() === month) return String(d.getDate());
      return `${d.getDate()} thg ${d.getMonth() + 1}`;
    };
    return (
      <div className="receptionist-month-view gcal-style">
        <table className="calendar-table month-table" role="grid">
          <thead>
            <tr role="row">
              {WEEKDAY_LABELS.map((label, i) => (
                <th key={i} role="columnheader" className="month-th">
                  <span className="month-th-full">{label}</span>
                  <span className="month-th-short" aria-hidden="true">{WEEKDAY_SHORT[i]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, ri) => (
              <tr key={ri} role="row" className="month-week-row">
                {row.map((d, ci) => {
                  const isCurrentMonth = d.getMonth() === month;
                  const dayBookings = getBookingsForDate(d);
                  const wd = WEEKDAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1];
                  const dayAria = isToday(d)
                    ? `Hôm nay, ${wd}, ${d.getDate()} tháng ${d.getMonth() + 1}`
                    : (dayBookings.length === 0 ? `Không có sự kiện, ${wd}, ${d.getDate()} tháng ${d.getMonth() + 1}` : `${dayBookings.length} sự kiện, ${wd}, ${d.getDate()} tháng ${d.getMonth() + 1}`);
                  return (
                    <td
                      key={ci}
                      role="gridcell"
                      className={`month-td ${isCurrentMonth ? '' : 'other-month'} ${isToday(d) ? 'today' : ''} drop-target ${dropTargetDateKey === formatDateKey(d) ? 'drag-over' : ''}`}
                      onClick={(e) => { if (!isPublic) openModal(d, 'morning', e); }}
                      onDragOver={handleDragOver}
                      onDragEnter={() => handleDragEnterDay(formatDateKey(d))}
                      onDragLeave={handleDragLeaveDay}
                      onDrop={(e) => { handleDropOnDay(e, d); setDropTargetDateKey(null); }}
                      aria-label={dayAria}
                    >
                      <div className="month-date-row">
                        <h2 className={`month-day-num ${!isCurrentMonth ? 'other-month-num' : ''}`} aria-hidden>
                          {dayNumLabel(d)}
                        </h2>
                      </div>
                      <div className="month-event-strip">
                        {dayBookings.slice(0, 7).map((b, bi) => {
                          const isTimed = (() => {
                            const start = new Date(b.start_at);
                            return start.getHours() !== 0 || start.getMinutes() !== 0;
                          })();
                          const draggable = canDragBooking(b);
                          return (
                            <div
                              key={b.id}
                              className={`month-event-chip calendar-event-chip-modern ${isTimed ? 'timed' : 'allday'} ${b.status || 'approved'} ${draggable ? 'draggable' : ''} ${draggedBookingId === b.id ? 'dragging' : ''} ${!isCurrentMonth ? 'other-month-chip' : ''}`}
                              draggable={draggable}
                              onDragStart={(e) => handleDragStart(e, b)}
                              onDragEnd={handleDragEnd}
                              onClick={(e) => handleEventClick(b, d, 8, e)}
                            >
                              {isTimed && (
                                <div className="event-chip-time">{formatEventTimeRange(b.start_at, b.end_at)}</div>
                              )}
                              <span className="event-chip-title">{b.title}</span>
                            </div>
                          );
                        })}
                        {dayBookings.length > 7 && (
                          <div className={`month-more ${!isCurrentMonth ? 'other-month-chip' : ''}`}>+{dayBookings.length - 7}</div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderYearView = () => {
    const year = currentDate.getFullYear();
    const getYearMonthGrid = (y, monthIndex) => {
      const firstDay = new Date(y, monthIndex, 1);
      const dow = firstDay.getDay();
      const offset = dow === 0 ? 6 : dow - 1;
      const start = new Date(y, monthIndex, 1 - offset);
      return Array.from({ length: 42 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return d;
      });
    };
    const monthCards = Array.from({ length: 12 }, (_, monthIndex) => {
      const monthStart = new Date(year, monthIndex, 1, 0, 0, 0, 0);
      const monthEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
      const monthBookings = bookings.filter((b) => {
        const t = new Date(b.start_at).getTime();
        return t >= monthStart.getTime() && t <= monthEnd.getTime();
      });
      const pending = monthBookings.filter((b) => b.status === 'pending').length;
      const approved = monthBookings.filter((b) => b.status === 'approved').length;
      return {
        monthIndex,
        label: `Tháng ${monthIndex + 1}`,
        total: monthBookings.length,
        pending,
        approved,
        gridDays: getYearMonthGrid(year, monthIndex)
      };
    });

    return (
      <div className="receptionist-year-view">
        <div className="year-grid">
          {monthCards.map((item) => (
            <button
              key={item.monthIndex}
              type="button"
              className="year-month-card"
              onClick={() => {
                setCurrentDate(new Date(year, item.monthIndex, 1));
                setViewMode(VIEW_MODE.MONTH);
              }}
            >
              <div className="year-month-card-header">
                <h3>{item.label}</h3>
                <span>{item.total} sự kiện</span>
              </div>
              <div className="year-month-weekdays" aria-hidden="true">
                {WEEKDAY_SHORT.map((label, idx) => (
                  <span key={`${item.monthIndex}-w-${idx}`}>{label}</span>
                ))}
              </div>
              <div className="year-month-days-grid" aria-hidden="true">
                {item.gridDays.map((d, idx) => {
                  const inMonth = d.getMonth() === item.monthIndex;
                  const todayCell = isToday(d);
                  return (
                    <span
                      key={`${item.monthIndex}-d-${idx}`}
                      className={`year-month-day ${inMonth ? '' : 'other'} ${todayCell ? 'today' : ''}`}
                    >
                      {d.getDate()}
                    </span>
                  );
                })}
              </div>
              <div className="year-month-card-stats">
                <span className="year-chip approved">Duyệt: {item.approved}</span>
                <span className="year-chip pending">Chờ: {item.pending}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="receptionist-page receptionist-calendar-wrap">
        <div className="meeting-room-loading-card">
          <span className="meeting-room-spinner" />
          <p>Đang tải dữ liệu lịch phòng họp...</p>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="receptionist-page receptionist-calendar-wrap">
        <div className="meeting-room-loading-card is-error">
          <i className="fas fa-triangle-exclamation" aria-hidden />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const getTitleAriaLabel = () => {
    const d = currentDate;
    if (viewMode === VIEW_MODE.YEAR) {
      const yStart = new Date(d.getFullYear(), 0, 1);
      const yEnd = new Date(d.getFullYear(), 11, 31, 23, 59, 59);
      const total = bookings.filter((b) => {
        const t = new Date(b.start_at).getTime();
        return t >= yStart.getTime() && t <= yEnd.getTime();
      }).length;
      return total > 0 ? `Năm ${d.getFullYear()}, ${total} sự kiện` : `Năm ${d.getFullYear()}`;
    }
    if (viewMode === VIEW_MODE.MONTH) {
      const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const total = bookings.filter(b => {
        const t = new Date(b.start_at).getTime();
        return t >= mStart.getTime() && t <= mEnd.getTime();
      }).length;
      return total > 0 ? `Tháng ${d.getMonth() + 1}, ${d.getFullYear()}, ${total} sự kiện` : `Tháng ${d.getMonth() + 1}, ${d.getFullYear()}`;
    }
    return getTitleLabel();
  };

  const viewModeLabel = VIEW_MODE_OPTIONS.find((opt) => opt.value === viewMode)?.label || 'Lịch';

  return (
    <div className={`receptionist-page receptionist-calendar-wrap gcal-theme${isPublic ? ' is-public' : ''}`}>
      <div className="calendar-redesign-shell">
        <div className="receptionist-toolbar gcal-toolbar">
          <div className="toolbar-main-group">
            <button type="button" className="toolbar-btn today" onClick={goToday}>Hôm nay</button>
            <div className="meeting-room-view-switch" role="tablist" aria-label="Chế độ xem">
              {VIEW_MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`view-switch-btn ${viewMode === opt.value ? 'active' : ''}`}
                  onClick={() => setViewMode(opt.value)}
                  aria-label={`Xem theo ${opt.label.toLowerCase()}`}
                  aria-selected={viewMode === opt.value}
                >
                  <i className={opt.icon} aria-hidden />
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
            <div className="toolbar-nav-title-row">
              <button type="button" className="toolbar-btn nav" onClick={goPrev} aria-label="Trước">&lsaquo;</button>
              <div ref={toolbarTitleRef} className="toolbar-title-wrap">
                <h1
                  className="toolbar-title gcal-title"
                  id="receptionist-view-heading"
                  aria-label={getTitleAriaLabel()}
                  onClick={() => setShowMonthYearPicker(v => !v)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowMonthYearPicker(v => !v); } }}
                >
                  {getTitleLabel()}
                </h1>
                {showMonthYearPicker && (
                <div
                  className="gcal-date-picker-modal month-year-picker-dropdown"
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-label="Chọn ngày tháng năm"
                >
                  <div className="gcal-date-picker-header">
                    <button
                      type="button"
                      className="gcal-date-picker-nav"
                      onClick={() => setPickerViewDate(new Date(pickerViewDate.getFullYear(), pickerViewDate.getMonth() - 1, 1))}
                      aria-label="Tháng trước"
                    >
                      &lsaquo;
                    </button>
                    <div className="gcal-date-picker-title-row">
                      <select
                        className="form-select form-select-sm gcal-date-picker-month"
                        value={pickerViewDate.getMonth() + 1}
                        onChange={(e) => setPickerViewDate(new Date(pickerViewDate.getFullYear(), Number(e.target.value) - 1, 1))}
                        aria-label="Chọn tháng"
                      >
                        {MONTH_NAMES.map((name, i) => (
                          <option key={i} value={i + 1}>{name}</option>
                        ))}
                      </select>
                      <select
                        className="form-select form-select-sm gcal-date-picker-year"
                        value={pickerViewDate.getFullYear()}
                        onChange={(e) => setPickerViewDate(new Date(Number(e.target.value), pickerViewDate.getMonth(), 1))}
                        aria-label="Chọn năm"
                      >
                        {YEAR_OPTIONS.map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      className="gcal-date-picker-nav"
                      onClick={() => setPickerViewDate(new Date(pickerViewDate.getFullYear(), pickerViewDate.getMonth() + 1, 1))}
                      aria-label="Tháng sau"
                    >
                      &rsaquo;
                    </button>
                  </div>
                  <div className="gcal-date-picker-weekdays">
                    {WEEKDAY_SHORT.map((label, i) => (
                      <span key={i} className="gcal-date-picker-weekday">{label}</span>
                    ))}
                  </div>
                  <div className="gcal-date-picker-grid">
                    {getPickerCalendarGrid().map((row, ri) =>
                      row.map((cell, ci) => {
                        const { date, dayNum, isCurrentMonth, month, year } = cell;
                        const isTodayCell = isToday(date);
                        return (
                          <button
                            key={`${ri}-${ci}`}
                            type="button"
                            className={`gcal-date-picker-day ${!isCurrentMonth ? 'other-month' : ''} ${isTodayCell ? 'today' : ''}`}
                            onClick={() => applyPickerDate(year, month, dayNum)}
                            aria-label={date.toLocaleDateString('vi-VN')}
                          >
                            {dayNum}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
                )}
              </div>
              <button type="button" className="toolbar-btn nav" onClick={goNext} aria-label="Sau">&rsaquo;</button>
            </div>
          </div>
          <div className="toolbar-action-group">
            <span className="toolbar-mode-pill">
              <i className="fas fa-layer-group" aria-hidden /> Chế độ: {viewModeLabel}
            </span>
            {!isPublic && canUseExcelImport && (
              <button
                type="button"
                className="toolbar-btn"
                onClick={() => setShowImportExcelModal(true)}
                aria-label="Import Excel"
              >
                <i className="fas fa-file-import" aria-hidden /> <span className="toolbar-btn-label">Import Excel</span>
              </button>
            )}
            {!isPublic && (
              <button
                type="button"
                className="toolbar-btn gcal-public-link-btn"
                onClick={() => setShowPublicLinkModal(true)}
                aria-label="Lịch công khai"
              >
                <i className="fas fa-calendar-alt" aria-hidden /> <span className="toolbar-btn-label">Lịch công khai</span>
              </button>
            )}
            {!isPublic && (
            <button type="button" className="toolbar-btn primary gcal-primary-btn" onClick={() => openModal(null, 'morning', null)}>
              <i className="fas fa-plus" aria-hidden /> Đăng ký phòng họp
            </button>
            )}
          </div>
        </div>

      {showPublicLinkModal && (
        <div className="receptionist-booking-backdrop gcal-modal-backdrop public-link-modal-backdrop" onClick={() => setShowPublicLinkModal(false)}>
          <div className="receptionist-booking-modal gcal-public-link-modal public-link-modal-modern" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="public-link-modal-title">
            <div className="modal-header gcal-modal-header">
              <h2 id="public-link-modal-title" className="modal-title gcal-modal-title">Link công khai</h2>
              <button type="button" className="gcal-modal-close" onClick={() => setShowPublicLinkModal(false)} aria-label="Đóng">
                <svg focusable="false" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" /></svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="gcal-public-link-row">
                <label className="form-label text-muted small">Link lịch công khai</label>
                <div className="gcal-public-link-input-wrap">
                  <input
                    type="text"
                    className="form-control gcal-public-link-input"
                    value={publicCalendarUrl}
                    readOnly
                    aria-label="Link công khai"
                  />
                  <button
                    type="button"
                    className="gcal-public-link-icon-btn"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(publicCalendarUrl);
                        setPublicLinkCopied(true);
                        setTimeout(() => setPublicLinkCopied(false), 1800);
                      } catch (_) {
                        setPublicLinkCopied(false);
                      }
                    }}
                    title={publicLinkCopied ? 'Đã sao chép' : 'Sao chép link'}
                    aria-label={publicLinkCopied ? 'Đã sao chép' : 'Sao chép link'}
                  >
                    <i className={`fas ${publicLinkCopied ? 'fa-check' : 'fa-copy'}`} aria-hidden />
                  </button>
                  <a
                    href={publicCalendarUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="gcal-public-link-icon-btn"
                    title="Mở trong tab mới"
                    aria-label="Mở trong tab mới"
                  >
                    <i className="fas fa-external-link-alt" aria-hidden />
                  </a>
                </div>
              </div>
              <div className="gcal-public-qr-section">
                <label className="form-label text-muted small">Mã QR</label>
                <div className="gcal-public-qr-wrap">
                  <QRCode
                    id="publicCalendarQRCode"
                    value={publicCalendarUrl}
                    size={180}
                    level="H"
                    renderAs="canvas"
                    includeMargin={true}
                    className="gcal-public-qr-code"
                  />
                  <button
                    type="button"
                    className="toolbar-btn primary gcal-primary-btn gcal-public-qr-download gcal-public-qr-download-modern"
                    onClick={() => {
                      const el = document.getElementById('publicCalendarQRCode');
                      const canvas = el && el.tagName === 'CANVAS' ? el : (el && el.querySelector ? el.querySelector('canvas') : null);
                      if (canvas && typeof canvas.toDataURL === 'function') {
                        const url = canvas.toDataURL('image/png').replace('image/png', 'image/octet-stream');
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'lich-dat-phong-cong-khai.png';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                      }
                    }}
                  >
                    <i className="fas fa-download" aria-hidden />
                    <span>Tải về</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showImportExcelModal && (
        <div className="receptionist-booking-backdrop gcal-modal-backdrop" onClick={() => setShowImportExcelModal(false)}>
          <div className="receptionist-booking-modal gcal-public-link-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="import-excel-modal-title">
            <div className="modal-header gcal-modal-header">
              <h2 id="import-excel-modal-title" className="modal-title gcal-modal-title">Import Excel</h2>
              <button type="button" className="gcal-modal-close" onClick={() => setShowImportExcelModal(false)} aria-label="Đóng">
                <svg focusable="false" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" /></svg>
              </button>
            </div>
            <div className="modal-body">
              {!canUseExcelImport ? (
                <div className="gcal-alert gcal-alert-error">Chỉ receptionist_admin mới được sử dụng chức năng này.</div>
              ) : (
                <>
                  <p className="small text-muted mb-2">
                    File cần có các sheet `T1` đến `T12`. Mỗi sheet: tháng ở A4, thứ ở hàng 5, dữ liệu bắt đầu từ hàng 6 theo block 5 dòng.
                  </p>
                  <input
                    type="file"
                    className="form-control"
                    accept=".xlsx,.xls"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  />
                  {importFile && (
                    <div className="small text-muted mt-2">
                      Đã chọn: <strong>{importFile.name}</strong>
                    </div>
                  )}
                  {importResult?.message && (
                    <div className={`gcal-alert mt-3 ${importResult.type === 'success' ? 'gcal-alert-success' : 'gcal-alert-error'}`}>
                      <div>{importResult.message}</div>
                      {typeof importResult.created === 'number' && typeof importResult.failed === 'number' && (
                        <div className="small mt-1">
                          Thành công: {importResult.created} | Lỗi: {importResult.failed}
                        </div>
                      )}
                    </div>
                  )}
                  {Array.isArray(importResult?.errors) && importResult.errors.length > 0 && (
                    <div className="mt-2" style={{ maxHeight: '220px', overflow: 'auto', border: '1px solid #eee', borderRadius: '8px', padding: '8px' }}>
                      {importResult.errors.slice(0, 100).map((errItem, idx) => (
                        <div key={idx} className="small mb-2">
                          <strong>
                            [{errItem.sheet || 'N/A'}] {errItem.cell || `${errItem.column || ''}${errItem.row || ''}`}
                          </strong>
                          : {errItem.message}
                          {errItem.value ? ` (giá trị: ${errItem.value})` : ''}
                        </div>
                      ))}
                      {importResult.errors.length > 100 && (
                        <div className="small text-muted">... còn {importResult.errors.length - 100} lỗi khác</div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="modal-footer gcal-modal-footer">
              <button type="button" className="gcal-btn gcal-btn-text" onClick={() => setShowImportExcelModal(false)}>Đóng</button>
              {canUseExcelImport && (
                <button type="button" className="gcal-btn gcal-btn-primary" onClick={handleImportExcelSubmit} disabled={importLoading}>
                  {importLoading ? 'Đang import...' : 'Bắt đầu import'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {moveBookingStatus.message && (
        <div className={`gcal-alert ${moveBookingStatus.type === 'success' ? 'gcal-alert-success' : 'gcal-alert-error'}`} style={{ marginBottom: '0.5rem' }}>
          {moveBookingStatus.message}
        </div>
      )}

      <div className="meeting-room-status-row">
        <div className="meeting-room-status-strip">
          <span className="status-pill approved"><i className="fas fa-circle-check" aria-hidden /> Đã duyệt: {dashboardStats.approved}</span>
          {!isPublic && <span className="status-pill pending"><i className="fas fa-clock" aria-hidden /> Chờ duyệt: {dashboardStats.pending}</span>}
          <span className="status-pill neutral"><i className="fas fa-building" aria-hidden /> Tổng phòng: {rooms.length}</span>
          <span className="status-pill neutral"><i className="fas fa-chart-line" aria-hidden /> Công suất hôm nay: {dashboardStats.occupancyRate}%</span>
        </div>

        <div className="meeting-room-legend" aria-label="Chú thích trạng thái sự kiện">
          <span className="legend-item legend-approved"><em /> Đã duyệt</span>
          <span className="legend-item legend-pending"><em /> Chờ duyệt</span>
          <span className="legend-item legend-rejected"><em /> Từ chối</span>
          <span className="legend-item legend-note"><i className="fas fa-circle-info" aria-hidden /> Kéo thả ô sự kiện để đổi ngày</span>
        </div>
      </div>

      <div className={`receptionist-calendar meeting-room-calendar-surface view-${viewMode}`}>
        <div key={`${viewMode}-${currentDate.getFullYear()}-${currentDate.getMonth()}-${currentDate.getDate()}`} className="calendar-view-stage">
          {viewMode === VIEW_MODE.DAY && renderDayView()}
          {viewMode === VIEW_MODE.WEEK && renderWeekView()}
          {viewMode === VIEW_MODE.MONTH && renderMonthView()}
          {viewMode === VIEW_MODE.YEAR && renderYearView()}
        </div>
      </div>
      </div>

      {modalOpen && (() => {
        const MODAL_W = 600;
        const GAP = 8;
        const winW = (typeof window !== 'undefined' ? window.innerWidth : 1024);
        const winH = (typeof window !== 'undefined' ? window.innerHeight : 768);
        const maxH = winH * 0.85;
        const isAnchored = modalAnchor && typeof modalAnchor.right === 'number';
        let modalStyle = { position: 'fixed', maxHeight: `${maxH}px` };
        if (modalPosition) {
          modalStyle.left = `${modalPosition.left}px`;
          modalStyle.top = `${modalPosition.top}px`;
        } else if (isAnchored) {
          const measuredH = modalRef.current?.offsetHeight;
          const effectiveModalH = Math.min(maxH, (typeof measuredH === 'number' && measuredH > 0) ? measuredH : 520);
          let left = modalAnchor.right + GAP;
          let top = modalAnchor.top;
          if (left + MODAL_W > winW) left = modalAnchor.left - MODAL_W - GAP;
          if (top + effectiveModalH > winH - GAP) top = winH - GAP - effectiveModalH;
          if (left < GAP) left = GAP;
          if (top < GAP) top = GAP;
          modalStyle.left = `${left}px`;
          modalStyle.top = `${top}px`;
        }
        const modalTitle = viewingBooking ? 'Thông tin đăng ký phòng họp' : (editingBooking ? 'Chỉnh sửa đặt phòng' : 'Đăng ký phòng họp');
        const statusLabel = (s) => ({ pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Đã từ chối' }[s] || s);

        return (
        <div className={`receptionist-booking-backdrop modal-backdrop gcal-modal-backdrop booking-modal-no-blur ${isAnchored && !modalPosition ? 'gcal-modal-backdrop-anchored' : 'gcal-modal-backdrop-centered'}`} onClick={closeModal}>
          <div ref={modalRef} className={`receptionist-booking-modal modal-content receptionist-modal gcal-modal ${isAnchored && !modalPosition ? 'gcal-modal-anchored' : ''}`} style={modalStyle} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="gcal-modal-title">
            <div className="modal-header gcal-modal-header modal-drag-handle" onMouseDown={handleModalDragStart} style={{ cursor: 'grab', userSelect: 'none' }}>
              <h2 id="gcal-modal-title" className="modal-title gcal-modal-title">{modalTitle}</h2>
              <button type="button" className="gcal-modal-close" onClick={closeModal} onMouseDown={(e) => e.stopPropagation()} aria-label="Đóng">
                <svg focusable="false" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" /></svg>
              </button>
            </div>
            {viewingBooking ? (
              <>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label text-muted small">Phòng</label>
                  <p className="mb-0">{viewingBooking.room_name || ''} {viewingBooking.room_code ? `(${viewingBooking.room_code})` : ''}</p>
                </div>
                <div className="mb-3">
                  <label className="form-label text-muted small">Tiêu đề / Nội dung</label>
                  <p className="mb-0">{viewingBooking.title || '—'}</p>
                </div>
                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <label className="form-label text-muted small">Bắt đầu</label>
                    <p className="mb-0">{viewingBooking.start_at ? new Date(viewingBooking.start_at).toLocaleString('vi-VN') : '—'}</p>
                  </div>
                  <div className="col-6">
                    <label className="form-label text-muted small">Kết thúc</label>
                    <p className="mb-0">{viewingBooking.end_at ? new Date(viewingBooking.end_at).toLocaleString('vi-VN') : '—'}</p>
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label text-muted small">Trạng thái</label>
                  <p className="mb-0">{statusLabel(viewingBooking.status)}</p>
                </div>
                {viewingBooking.user_name && (
                  <div className="mb-3">
                    <label className="form-label text-muted small">Người đặt</label>
                    <p className="mb-0">{viewingBooking.user_name}{viewingBooking.user_email ? ` (${viewingBooking.user_email})` : ''}</p>
                  </div>
                )}
                {(viewingBooking.recurrence_rule || viewingBooking.recurrence_rule_id != null) && (() => {
                  const r = viewingBooking.recurrence_rule || {};
                  const freq = r.frequency || 'week';
                  const freqLabel = { week: 'Tuần', month: 'Tháng', quarter: 'Quý', year: 'Năm' }[freq] || freq;
                  const weekdays = Array.isArray(r.weekdays) ? r.weekdays : (typeof r.weekdays === 'string' ? (() => { try { return JSON.parse(r.weekdays); } catch (_) { return []; } })() : []);
                  const monthDays = Array.isArray(r.month_days) ? r.month_days : (typeof r.month_days === 'string' ? (() => { try { return JSON.parse(r.month_days); } catch (_) { return []; } })() : []);
                  const endType = r.end_type || 'date';
                  const endDate = r.end_date ? (() => { const x = new Date(r.end_date); return isNaN(x.getTime()) ? r.end_date : x.toLocaleDateString('vi-VN'); })() : null;
                  const endCount = r.end_count != null ? Number(r.end_count) : null;
                  const weekdayLabels = ['Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy', 'Chủ nhật'];
                  const dayLabels = weekdays.map(n => weekdayLabels[Number(n) - 1] || n).filter(Boolean);
                  const monthDaysSorted = [...monthDays].map(Number).filter(n => n >= 1 && n <= 31).sort((a, b) => a - b);
                  return (
                    <div className="mb-3">
                      <label className="form-label text-muted small">Định kỳ</label>
                      <div className="recurrence-view-detail small">
                        <div className="recurrence-view-row">
                          <span className="text-muted">Lặp theo:</span>
                          <span className="fw-medium">{freqLabel}</span>
                        </div>
                        {freq === 'week' && dayLabels.length > 0 && (
                          <div className="recurrence-view-row">
                            <span className="text-muted">Các ngày trong tuần:</span>
                            <span>{dayLabels.join(', ')}</span>
                          </div>
                        )}
                        {freq === 'month' && monthDaysSorted.length > 0 && (
                          <div className="recurrence-view-row">
                            <span className="text-muted">Các ngày trong tháng:</span>
                            <span>{monthDaysSorted.join(', ')}</span>
                          </div>
                        )}
                        <div className="recurrence-view-row">
                          <span className="text-muted">Chuỗi lặp kết thúc:</span>
                          <span>
                            {endType === 'date' && endDate ? `Vào ngày ${endDate}` : endType === 'count' && endCount != null ? `Sau ${endCount} lần` : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="modal-footer gcal-modal-footer modal-drag-handle" onMouseDown={handleModalDragStart} style={{ cursor: 'grab', userSelect: 'none' }}>
                <button type="button" className="gcal-btn gcal-btn-primary" onClick={closeModal} onMouseDown={(e) => e.stopPropagation()}>Đóng</button>
              </div>
              </>
            ) : (
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {submitStatus.message && (
                  <div className={`gcal-alert ${submitStatus.type === 'success' ? 'gcal-alert-success' : 'gcal-alert-error'}`}>
                    {submitStatus.message}
                  </div>
                )}
                <div className="mb-3">
                  <label className="form-label">Phòng</label>
                  <select
                    className="form-select"
                    value={form.roomId}
                    onChange={(e) => setForm(f => ({ ...f, roomId: e.target.value }))}
                    required
                  >
                    <option value="">-- Chọn phòng --</option>
                    {rooms.map(r => (
                      <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Tiêu đề / Nội dung</label>
                  <input
                    type="text"
                    className="form-control"
                    value={form.title}
                    onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Ví dụ: Họp PĐT"
                    required
                  />
                </div>
                <div className="row g-2">
                  <div className="col-6">
                    <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
                      <label className="form-label mb-0">Ngày bắt đầu</label>
                      {editingBooking && (editingBooking.recurrence_rule_id != null || editingBooking.recurrence_rule) && isRecurring && (
                        <button
                          type="button"
                          className="gcal-btn gcal-btn-text text-danger btn-sm"
                          onClick={handleDeleteSingleOccurrence}
                          onMouseDown={(e) => e.stopPropagation()}
                          disabled={!canSaveEdit(editingBooking)}
                          title="Xóa chỉ ngày này trong chuỗi định kỳ"
                        >
                          Xóa ngày này
                        </button>
                      )}
                    </div>
                    <input
                      type="date"
                      className="form-control"
                      value={form.startDate}
                      onChange={(e) => setForm(f => ({ ...f, startDate: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label">Giờ bắt đầu</label>
                    <div className="d-flex gap-1 align-items-center">
                      <select
                        className="form-select form-select-sm"
                        value={timeToParts(form.startTime)[0]}
                        onChange={(e) => {
                          const [_, m] = timeToParts(form.startTime);
                          setForm(f => ({ ...f, startTime: partsToTime(Number(e.target.value), m) }));
                        }}
                      >
                        {HOUR_OPTIONS.map(h => (
                          <option key={h} value={h}>{String(h).padStart(2, '0')} giờ</option>
                        ))}
                      </select>
                      <span className="text-muted">:</span>
                      <select
                        className="form-select form-select-sm"
                        value={timeToParts(form.startTime)[1]}
                        onChange={(e) => {
                          const [h] = timeToParts(form.startTime);
                          setForm(f => ({ ...f, startTime: partsToTime(h, Number(e.target.value)) }));
                        }}
                      >
                        {MINUTE_OPTIONS.map(m => (
                          <option key={m} value={m}>{String(m).padStart(2, '0')} phút</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="form-check mb-2">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="recurrence-toggle"
                    checked={isRecurring}
                    disabled={!!editingBooking && !editingBooking?.recurrence_rule && editingBooking?.recurrence_rule_id == null}
                    onChange={(e) => {
                      if (editingBooking && !editingBooking?.recurrence_rule && editingBooking?.recurrence_rule_id == null) return;
                      const on = e.target.checked;
                      setIsRecurring(on);
                      if (on && recurrenceEndType === 'date' && !recurrenceEndDate && form.startDate) {
                        const d = new Date(form.startDate + 'T12:00:00');
                        d.setMonth(d.getMonth() + 3);
                        setRecurrenceEndDate(formatDateKey(d));
                      }
                    }}
                  />
                  <label className="form-check-label" htmlFor="recurrence-toggle">
                    Đăng ký định kỳ{(editingBooking?.recurrence_rule || editingBooking?.recurrence_rule_id != null) ? ' (chỉnh sửa quy tắc lặp)' : ''}
                  </label>
                </div>
                <div className="row g-2 mt-1">
                  {!isRecurring && (
                        <>
                  <div className="col-6">
                    <label className="form-label">Ngày kết thúc</label>
                    <input
                      type="date"
                      className="form-control"
                      value={form.endDate}
                      onChange={(e) => setForm(f => ({ ...f, endDate: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label">Giờ kết thúc</label>
                    <div className="d-flex gap-1 align-items-center">
                      <select
                        className="form-select form-select-sm"
                        value={timeToParts(form.endTime)[0]}
                        onChange={(e) => {
                          const [_, m] = timeToParts(form.endTime);
                          setForm(f => ({ ...f, endTime: partsToTime(Number(e.target.value), m) }));
                        }}
                      >
                        {HOUR_OPTIONS.map(h => (
                          <option key={h} value={h}>{String(h).padStart(2, '0')} giờ</option>
                        ))}
                      </select>
                      <span className="text-muted">:</span>
                      <select
                        className="form-select form-select-sm"
                        value={timeToParts(form.endTime)[1]}
                        onChange={(e) => {
                          const [h] = timeToParts(form.endTime);
                          setForm(f => ({ ...f, endTime: partsToTime(h, Number(e.target.value)) }));
                        }}
                      >
                        {MINUTE_OPTIONS.map(m => (
                          <option key={m} value={m}>{String(m).padStart(2, '0')} phút</option>
                        ))}
                      </select>
                    </div>
                  </div>
                        </>
                      )}
                      {isRecurring && (
                        <div className="col-12">
                          <label className="form-label">Giờ kết thúc (mỗi lần)</label>
                          <div className="d-flex gap-1 align-items-center">
                            <select
                              className="form-select form-select-sm"
                              value={timeToParts(form.endTime)[0]}
                              onChange={(e) => {
                                const [_, m] = timeToParts(form.endTime);
                                setForm(f => ({ ...f, endTime: partsToTime(Number(e.target.value), m) }));
                              }}
                            >
                              {HOUR_OPTIONS.map(h => (
                                <option key={h} value={h}>{String(h).padStart(2, '0')} giờ</option>
                              ))}
                            </select>
                            <span className="text-muted">:</span>
                            <select
                              className="form-select form-select-sm"
                              value={timeToParts(form.endTime)[1]}
                              onChange={(e) => {
                                const [h] = timeToParts(form.endTime);
                                setForm(f => ({ ...f, endTime: partsToTime(h, Number(e.target.value)) }));
                              }}
                            >
                              {MINUTE_OPTIONS.map(m => (
                                <option key={m} value={m}>{String(m).padStart(2, '0')} phút</option>
                              ))}
                            </select>
                </div>
              </div>
                      )}
                    </div>
                    {isRecurring && (
                      <div className="recurrence-block mt-3 p-3 border rounded">
                        <div className="mb-3">
                          <label className="form-label small">Lặp theo</label>
                          <div className="d-flex flex-wrap gap-2">
                            {['week', 'month', 'quarter', 'year'].map((freq) => (
                              <label key={freq} className="d-flex align-items-center gap-1">
                                <input
                                  type="radio"
                                  name="recurrenceFreq"
                                  checked={recurrenceFreq === freq}
                                  onChange={() => setRecurrenceFreq(freq)}
                                />
                                <span>{freq === 'week' ? 'Tuần' : freq === 'month' ? 'Tháng' : freq === 'quarter' ? 'Quý' : 'Năm'}</span>
                              </label>
                            ))}
                          </div>
                          {recurrenceFreq === 'week' && (
                            <div className="mt-2">
                              <span className="small text-muted me-2">Chọn ngày trong tuần:</span>
                              <div className="d-flex flex-wrap gap-2 mt-1">
                                {[
                                  [1, 'Thứ 2'],
                                  [2, 'Thứ 3'],
                                  [3, 'Thứ 4'],
                                  [4, 'Thứ 5'],
                                  [5, 'Thứ 6'],
                                  [6, 'Thứ 7'],
                                  [7, 'Chủ nhật']
                                ].map(([n, label]) => (
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
                                {Array.from({ length: 31 }, (_, i) => i + 1)
                                  .filter((d) => !recurrenceMonthDays.includes(d))
                                  .map((d) => (
                                    <option key={d} value={d}>Ngày {d}</option>
                                  ))}
                              </select>
                              {recurrenceMonthDays.length > 0 && (
                                <span className="d-flex flex-wrap gap-1 align-items-center small">
                                  {recurrenceMonthDays.map((d) => (
                                    <span key={d} className="badge bg-secondary d-inline-flex align-items-center gap-1">
                                      Ngày {d}
                                      <button
                                        type="button"
                                        className="btn btn-link p-0 border-0 bg-transparent text-white small"
                                        style={{ lineHeight: 1 }}
                                        onClick={() => setRecurrenceMonthDays((arr) => arr.filter((x) => x !== d))}
                                        aria-label={`Bỏ ngày ${d}`}
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ))}
                                </span>
                              )}
                            </div>
                          )}
                          {(recurrenceFreq === 'quarter' || recurrenceFreq === 'year') && (
                            <p className="small text-muted mt-2 mb-0">
                              {recurrenceFreq === 'quarter'
                                ? 'Lặp vào cùng ngày trong tháng mỗi 3 tháng (từ ngày bắt đầu).'
                                : 'Lặp vào cùng ngày mỗi năm.'}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="form-label small">Chuỗi lặp kết thúc</label>
                          <div className="d-flex flex-wrap gap-3 align-items-center">
                            <label className="d-flex align-items-center gap-1 small">
                              <input
                                type="radio"
                                name="recurrenceEnd"
                                checked={recurrenceEndType === 'date'}
                                onChange={() => setRecurrenceEndType('date')}
                              />
                              Vào ngày
                            </label>
                            {recurrenceEndType === 'date' && (
                              <input
                                type="date"
                                className="form-control form-control-sm"
                                value={recurrenceEndDate}
                                onChange={(e) => setRecurrenceEndDate(e.target.value)}
                                style={{ width: 'auto' }}
                              />
                            )}
                            <label className="d-flex align-items-center gap-1 small">
                              <input
                                type="radio"
                                name="recurrenceEnd"
                                checked={recurrenceEndType === 'count'}
                                onChange={() => setRecurrenceEndType('count')}
                              />
                              Số lần
                            </label>
                            {recurrenceEndType === 'count' && (
                              <input
                                type="number"
                                className="form-control form-control-sm"
                                min={1}
                                max={200}
                                value={recurrenceCount}
                                onChange={(e) => setRecurrenceCount(Number(e.target.value) || 1)}
                                style={{ width: '80px' }}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                <p className="small text-muted mt-2">Hệ thống sẽ kiểm tra lịch trống. Yêu cầu sẽ chờ Lễ tân duyệt.</p>
              </div>
              <div className="modal-footer gcal-modal-footer modal-drag-handle" onMouseDown={handleModalDragStart} style={{ cursor: 'grab', userSelect: 'none' }}>
                {editingBooking && !canSaveEdit(editingBooking) && (
                  <span className="small text-muted me-auto">Chỉ người tạo sự kiện mới được chỉnh sửa.</span>
                )}
                {editingBooking?.status === 'pending' && isReceptionistAdmin && (
                  <>
                    <button type="button" className="gcal-btn gcal-btn-success" onClick={() => handleApproveBooking(false)} onMouseDown={(e) => e.stopPropagation()} disabled={approveLoading} title="Duyệt sự kiện này">
                      {approveLoading ? 'Đang xử lý...' : 'Duyệt'}
                    </button>
                    {editingBooking.recurrence_rule_id != null && (
                      <button type="button" className="gcal-btn gcal-btn-success" onClick={() => handleApproveBooking(true)} onMouseDown={(e) => e.stopPropagation()} disabled={approveLoading} title="Duyệt tất cả sự kiện trong chuỗi định kỳ">
                        Duyệt tất cả
                      </button>
                    )}
                    <button type="button" className="gcal-btn gcal-btn-text text-danger" onClick={() => handleRejectBooking(false)} onMouseDown={(e) => e.stopPropagation()} disabled={approveLoading} title="Từ chối sự kiện này">
                      Từ chối
                    </button>
                    {editingBooking.recurrence_rule_id != null && (
                      <button type="button" className="gcal-btn gcal-btn-text text-danger" onClick={() => handleRejectBooking(true)} onMouseDown={(e) => e.stopPropagation()} disabled={approveLoading} title="Từ chối tất cả sự kiện trong chuỗi định kỳ">
                        Từ chối tất cả
                      </button>
                    )}
                  </>
                )}
                {editingBooking && (
                  <button type="button" className="gcal-btn gcal-btn-text text-danger" onClick={handleDeleteBooking} onMouseDown={(e) => e.stopPropagation()} disabled={!canSaveEdit(editingBooking)} title={editingBooking?.recurrence_rule_id != null ? 'Xóa toàn bộ chuỗi định kỳ' : 'Xóa sự kiện'}>
                    Xóa
                  </button>
                )}
                <button type="button" className="gcal-btn gcal-btn-text" onClick={closeModal} onMouseDown={(e) => e.stopPropagation()}>Hủy</button>
                <button type="submit" className="gcal-btn gcal-btn-primary" onMouseDown={(e) => e.stopPropagation()} disabled={!!editingBooking && !canSaveEdit(editingBooking)}>{editingBooking ? 'Cập nhật' : 'Gửi yêu cầu'}</button>
              </div>
            </form>
            )}
          </div>
        </div>
        );
      })()}
    </div>
  );
}
