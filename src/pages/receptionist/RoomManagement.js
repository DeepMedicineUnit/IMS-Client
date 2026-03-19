import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import '../../styles/user.css';
import './RoomManagement.css';
import usePageTitle from '../../hooks/usePageTitle';

export default function RoomManagement() {
  usePageTitle('Quản lý phòng họp');
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', code: '', capacity: 10, description: '' });
  const [submitMessage, setSubmitMessage] = useState(null);

  const fetchRooms = async () => {
    try {
      const res = await api.get('/receptionist/rooms/all');
      if (res.data?.success) setRooms(res.data.data || []);
    } catch (e) {
      setError('Không tải được danh sách phòng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: '', code: '', capacity: 10, description: '' });
    setSubmitMessage(null);
    setModalOpen(true);
  };

  const openEdit = (room) => {
    setEditingId(room.id);
    setForm({
      name: room.name,
      code: room.code,
      capacity: room.capacity || 10,
      description: room.description || ''
    });
    setSubmitMessage(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitMessage(null);
    try {
      if (editingId) {
        const res = await api.put(`/receptionist/rooms/${editingId}`, form);
        if (res.data?.success) {
          setSubmitMessage({ type: 'success', text: 'Đã cập nhật phòng.' });
          fetchRooms();
          setTimeout(closeModal, 1000);
        } else {
          setSubmitMessage({ type: 'error', text: res.data?.message || 'Cập nhật thất bại.' });
        }
      } else {
        const res = await api.post('/receptionist/rooms', form);
        if (res.data?.success) {
          setSubmitMessage({ type: 'success', text: 'Đã thêm phòng.' });
          fetchRooms();
          setTimeout(closeModal, 1000);
        } else {
          setSubmitMessage({ type: 'error', text: res.data?.message || 'Thêm phòng thất bại.' });
        }
      }
    } catch (err) {
      setSubmitMessage({
        type: 'error',
        text: err.response?.data?.message || 'Có lỗi xảy ra.'
      });
    }
  };

  const handleDeactivate = async (id) => {
    if (!window.confirm('Bạn có chắc muốn vô hiệu hóa phòng này?')) return;
    try {
      const res = await api.delete(`/receptionist/rooms/${id}`);
      if (res.data?.success) {
        fetchRooms();
      } else {
        alert(res.data?.message || 'Thao tác thất bại.');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Có lỗi xảy ra.');
    }
  };

  const handleActivate = async (id) => {
    if (!window.confirm('Bạn có chắc muốn bật lại phòng này?')) return;
    try {
      const res = await api.put(`/receptionist/rooms/${id}`, { is_active: 1 });
      if (res.data?.success) {
        fetchRooms();
      } else {
        alert(res.data?.message || 'Thao tác thất bại.');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Có lỗi xảy ra.');
    }
  };

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
        <p className="text-danger">{error}</p>
      </div>
    );
  }

  return (
    <div className="receptionist-page receptionist-rooms-wrap gcal-theme">
      {/* Header giống UserManagement */}
      <div className="session-header receptionist-rooms-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Quản lý Phòng</h1>
            <p className="header-subtitle">Thêm, sửa và quản lý phòng họp cho đặt lịch</p>
          </div>
          <div className="header-actions">
            <button type="button" className="create-session-btn receptionist-primary-btn" onClick={openCreate}>
              <i className="fas fa-plus" aria-hidden /> Thêm phòng
            </button>
          </div>
        </div>
      </div>

      {/* Bảng giống UserManagement (session-table-container + session-table) */}
      <div className="session-table-container receptionist-rooms-table-wrap">
        <div className="table-responsive">
          <table className="table session-table receptionist-rooms-table thead-receptionist">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Tên phòng</th>
                <th>Sức chứa</th>
                <th>Mô tả</th>
                <th>Trạng thái</th>
                <th style={{ width: 140 }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rooms.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-4">Chưa có phòng nào. Thêm phòng để bắt đầu.</td>
                </tr>
              )}
              {rooms.map(r => {
                const isActive = r.is_active === 1 || r.is_active === true;
                return (
                  <tr key={r.id} className={isActive ? '' : 'table-secondary'}>
                    <td><strong>{r.code}</strong></td>
                    <td>{r.name}</td>
                    <td>{r.capacity}</td>
                    <td>{r.description || '—'}</td>
                    <td>
                      {isActive ? (
                        <span className="badge bg-success">Hoạt động</span>
                      ) : (
                        <span className="badge bg-secondary">Tắt</span>
                      )}
                    </td>
                    <td>
                      <button type="button" className="btn btn-sm btn-outline-primary me-1" onClick={() => openEdit(r)}>Sửa</button>
                      {isActive ? (
                        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => handleDeactivate(r.id)}>Tắt</button>
                      ) : (
                        <button type="button" className="btn btn-sm btn-outline-success" onClick={() => handleActivate(r.id)}>Bật</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal giống MeetingRoomBooking: nền nhạt, bo tròn, nút X, gcal-btn */}
      {modalOpen && (
        <div className="receptionist-booking-backdrop modal-backdrop gcal-modal-backdrop gcal-modal-backdrop-centered" onClick={closeModal}>
          <div className="receptionist-booking-modal modal-content receptionist-modal gcal-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="room-modal-title">
            <div className="modal-header gcal-modal-header">
              <h2 id="room-modal-title" className="modal-title gcal-modal-title">{editingId ? 'Sửa phòng' : 'Thêm phòng'}</h2>
              <button type="button" className="gcal-modal-close" onClick={closeModal} aria-label="Đóng">
                <svg focusable="false" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" /></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {submitMessage && (
                  <div className={`gcal-alert ${submitMessage.type === 'success' ? 'gcal-alert-success' : 'gcal-alert-error'}`}>
                    {submitMessage.text}
                  </div>
                )}
                <div className="mb-3">
                  <label className="form-label">Mã phòng</label>
                  <input
                    type="text"
                    className="form-control"
                    value={form.code}
                    onChange={(e) => setForm(f => ({ ...f, code: e.target.value }))}
                    placeholder="P301"
                    required
                    disabled={!!editingId}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Tên phòng</label>
                  <input
                    type="text"
                    className="form-control"
                    value={form.name}
                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Phòng họp A"
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Sức chứa (người)</label>
                  <input
                    type="number"
                    min={1}
                    className="form-control"
                    value={form.capacity}
                    onChange={(e) => setForm(f => ({ ...f, capacity: parseInt(e.target.value, 10) || 10 }))}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Mô tả</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Tầng 3, có máy chiếu"
                  />
                </div>
              </div>
              <div className="modal-footer gcal-modal-footer">
                <button type="button" className="gcal-btn gcal-btn-text" onClick={closeModal}>Hủy</button>
                <button type="submit" className="gcal-btn gcal-btn-primary">{editingId ? 'Cập nhật' : 'Thêm'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
