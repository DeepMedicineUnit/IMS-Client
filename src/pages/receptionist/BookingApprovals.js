import React, { useState, useEffect, useMemo } from 'react';
import api from '../../utils/api';
import '../../styles/user.css';
import './RoomManagement.css';
import usePageTitle from '../../hooks/usePageTitle';

export default function BookingApprovals() {
  usePageTitle('Duyệt đặt phòng');
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rejectReason, setRejectReason] = useState({});
  const [processingId, setProcessingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roomFilter, setRoomFilter] = useState(''); // '' | room_id

  const fetchPending = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/receptionist/bookings/pending');
      if (res.data?.success) setList(res.data.data || []);
    } catch (e) {
      setError('Không tải được danh sách yêu cầu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const formatDateTime = (str) => {
    if (!str) return '—';
    const d = new Date(str);
    return d.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleReview = async (id, action, applyToSeries = false) => {
    setProcessingId(applyToSeries ? `series-${id}` : id);
    try {
      const body = action === 'reject'
        ? { action: 'reject', rejection_reason: rejectReason[id] || '', applyToSeries: !!applyToSeries }
        : { action: 'approve', applyToSeries: !!applyToSeries };
      const res = await api.post(`/receptionist/bookings/${id}/review`, body);
      if (res.data?.success) {
        const booking = list.find(b => b.id === id);
        const idsToRemove = applyToSeries && booking?.recurrence_rule_id != null
          ? list.filter(b => b.recurrence_rule_id === booking.recurrence_rule_id).map(b => b.id)
          : [id];
        setList(prev => prev.filter(b => !idsToRemove.includes(b.id)));
        setRejectReason(prev => {
          const next = { ...prev };
          idsToRemove.forEach(i => delete next[i]);
          return next;
        });
      } else {
        alert(res.data?.message || 'Thao tác thất bại.');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Có lỗi xảy ra.');
    } finally {
      setProcessingId(null);
    }
  };

  // Nhóm theo recurrence_rule_id; lọc theo search + room
  const singleBookings = useMemo(() => {
    let items = list.filter(b => b.recurrence_rule_id == null);
    const term = (searchTerm || '').toLowerCase().trim();
    if (term) {
      items = items.filter(b =>
        [b.room_name, b.room_code, b.title, b.user_name, b.user_email].some(s => (s || '').toLowerCase().includes(term))
      );
    }
    if (roomFilter !== '') {
      const rid = Number(roomFilter);
      items = items.filter(b => Number(b.room_id) === rid);
    }
    return items;
  }, [list, searchTerm, roomFilter]);

  const seriesGroups = useMemo(() => {
    const term = (searchTerm || '').toLowerCase().trim();
    const groups = [];
    list.forEach(b => {
      if (b.recurrence_rule_id == null) return;
      let g = groups.find(x => x.recurrence_rule_id === b.recurrence_rule_id);
      if (!g) {
        g = { recurrence_rule_id: b.recurrence_rule_id, bookings: [] };
        groups.push(g);
      }
      g.bookings.push(b);
    });
    return groups.filter(g => {
      const first = g.bookings[0];
      if (term && ![first.room_name, first.room_code, first.title, first.user_name, first.user_email].some(s => (s || '').toLowerCase().includes(term)))
        return false;
      if (roomFilter !== '' && Number(first.room_id) !== Number(roomFilter))
        return false;
      return true;
    });
  }, [list, searchTerm, roomFilter]);

  const uniqueRooms = useMemo(() => {
    const byId = new Map();
    list.forEach(b => {
      if (b.room_id != null && !byId.has(b.room_id))
        byId.set(b.room_id, { id: b.room_id, code: b.room_code, name: b.room_name });
    });
    return [...byId.values()].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [list]);

  if (loading) {
    return (
      <div className="receptionist-page receptionist-rooms-wrap">
        <div className="receptionist-rooms-loading">
          <p>Đang tải...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="receptionist-page receptionist-rooms-wrap">
        <div className="session-header receptionist-rooms-header">
          <div className="header-content">
            <div className="header-title">
              <h1>Duyệt đặt phòng</h1>
            </div>
          </div>
        </div>
        <div className="px-3 py-4">
          <p className="text-danger">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="receptionist-page receptionist-rooms-wrap gcal-theme">
      {/* Header giống UserManagement / RoomManagement */}
      <div className="session-header receptionist-rooms-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Duyệt đặt phòng</h1>
            <p className="header-subtitle">Các yêu cầu đặt phòng chờ duyệt. Chuỗi định kỳ gộp một dòng, có thể duyệt hoặc từ chối cả chuỗi.</p>
          </div>
          <div className="header-actions">
            <button type="button" className="create-session-btn receptionist-primary-btn" onClick={fetchPending}>
              <i className="fas fa-sync-alt" aria-hidden /> Làm mới
            </button>
          </div>
        </div>
      </div>

      {/* Thanh tìm kiếm và lọc giống UserManagement */}
      <div className="session-list-controls">
        <div className="search-controls">
          <div className="search-input">
            <input
              type="text"
              placeholder="Tìm theo phòng, tiêu đề, người đặt, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          <select
            className="filter-select"
            value={roomFilter}
            onChange={(e) => setRoomFilter(e.target.value)}
          >
            <option value="">Tất cả phòng</option>
            {uniqueRooms.map(r => (
              <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
            ))}
          </select>
          {(searchTerm || roomFilter) && (
            <button
              type="button"
              className="btn btn-outline-secondary filter-btn"
              onClick={() => { setSearchTerm(''); setRoomFilter(''); }}
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* Bảng giống UserManagement (session-table-container + thead gradient) */}
      <div className="session-table-container receptionist-rooms-table-wrap">
        <div className="table-responsive">
          <table className="table session-table receptionist-rooms-table thead-receptionist">
            <thead>
              <tr>
                <th>Phòng</th>
                <th>Tiêu đề</th>
                <th>Người đặt</th>
                <th>Thời gian</th>
                <th style={{ width: 280 }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {seriesGroups.map((g) => {
                const first = g.bookings[0];
                const isSeries = g.bookings.length > 1;
                const processing = processingId === first.id || String(processingId).startsWith('series-');
                return (
                  <tr key={g.recurrence_rule_id ?? first.id}>
                    <td><strong>{first.room_code}</strong> — {first.room_name}</td>
                    <td>
                      {first.title}
                      {isSeries && <span className="badge bg-secondary ms-1">{g.bookings.length} sự kiện định kỳ</span>}
                    </td>
                    <td>{first.user_name} <small className="text-muted">({first.user_email})</small></td>
                    <td>
                      {isSeries ? (
                        <span className="small">{formatDateTime(g.bookings[0].start_at)} … {formatDateTime(g.bookings[g.bookings.length - 1].end_at)}</span>
                      ) : (
                        formatDateTime(first.start_at) + ' → ' + formatDateTime(first.end_at)
                      )}
                    </td>
                    <td>
                      <div className="d-flex flex-column gap-2">
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Lý do từ chối (nếu có)"
                          value={rejectReason[first.id] || ''}
                          onChange={(e) => setRejectReason(prev => ({ ...prev, [first.id]: e.target.value }))}
                        />
                        <div className="d-flex flex-wrap gap-1">
                          {isSeries && (
                            <>
                              <button
                                type="button"
                                className="btn btn-sm btn-success"
                                disabled={processing}
                                onClick={() => handleReview(first.id, 'approve', true)}
                              >
                                {processing ? '...' : 'Duyệt tất cả'}
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-danger"
                                disabled={processing}
                                onClick={() => handleReview(first.id, 'reject', true)}
                              >
                                Từ chối tất cả
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-success"
                            disabled={processing}
                            onClick={() => handleReview(first.id, 'approve', false)}
                          >
                            {processing ? '...' : 'Duyệt 1'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            disabled={processing}
                            onClick={() => handleReview(first.id, 'reject', false)}
                          >
                            Từ chối 1
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {singleBookings.map(b => (
                <tr key={b.id}>
                  <td><strong>{b.room_code}</strong> — {b.room_name}</td>
                  <td>{b.title}</td>
                  <td>{b.user_name} <small className="text-muted">({b.user_email})</small></td>
                  <td>{formatDateTime(b.start_at)} → {formatDateTime(b.end_at)}</td>
                  <td>
                    <div className="d-flex flex-column gap-2">
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Lý do từ chối (nếu có)"
                        value={rejectReason[b.id] || ''}
                        onChange={(e) => setRejectReason(prev => ({ ...prev, [b.id]: e.target.value }))}
                      />
                      <div className="d-flex gap-1">
                        <button
                          type="button"
                          className="btn btn-sm btn-success"
                          disabled={processingId === b.id}
                          onClick={() => handleReview(b.id, 'approve')}
                        >
                          {processingId === b.id ? '...' : 'Duyệt'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          disabled={processingId === b.id}
                          onClick={() => handleReview(b.id, 'reject')}
                        >
                          Từ chối
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {seriesGroups.length === 0 && singleBookings.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-5">
                    {list.length === 0
                      ? 'Không có yêu cầu nào chờ duyệt.'
                      : 'Không có kết quả nào phù hợp bộ lọc.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
