import React, { useState, useEffect } from 'react';
import { Table, Button, Badge, Form, Modal, Alert, Spinner } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import '../../styles/calendar.css';

const UserList = () => {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    // In a real application, you would fetch users from your API
    // For now, we'll use placeholder data
    const mockUsers = [
      { id: 1, name: 'Nguyễn Văn A', email: 'nguyenvana@example.com', role: 'admin', status: 'active' },
      { id: 2, name: 'Trần Thị B', email: 'tranthib@example.com', role: 'staff', status: 'active' },
      { id: 3, name: 'Lê Văn C', email: 'levanc@example.com', role: 'student', status: 'active' },
      { id: 4, name: 'Phạm Thị D', email: 'phamthid@example.com', role: 'student', status: 'pending' },
      { id: 5, name: 'Hoàng Văn E', email: 'hoangvane@example.com', role: 'staff', status: 'pending' }
    ];
    
    setUsers(mockUsers);
    setLoading(false);
  }, []);

  const handleApprove = (user) => {
    setSelectedUser(user);
    setShowApproveModal(true);
  };

  const confirmApprove = () => {
    // In a real application, you would call your API to approve the user
    setUsers(users.map(u => 
      u.id === selectedUser.id ? { ...u, status: 'active' } : u
    ));
    setShowApproveModal(false);
  };

  const handleReject = (user) => {
    // In a real application, you would call your API to reject the user
    if (window.confirm(`Bạn có chắc chắn muốn từ chối người dùng ${user.name}?`)) {
      setUsers(users.filter(u => u.id !== user.id));
    }
  };

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleName = (role) => {
    switch (role) {
      case 'superadmin': return 'Quản trị viên cấp cao';
      case 'admin': return 'Quản trị viên';
      case 'staff': return 'Nhân viên';
      case 'student': return 'Sinh viên';
      default: return role;
    }
  };

  if (loading) {
    return (
      <div className="text-center mt-5">
        <Spinner animation="border" variant="primary" />
        <p className="mt-3">Đang tải dữ liệu...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header Section */}
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Danh sách người dùng</h1>
            <p className="header-subtitle">Quản lý và theo dõi thông tin người dùng hệ thống</p>
          </div>
          <div className="header-actions">
            <Button variant="outline-light" className="create-session-btn">
              <i className="fas fa-plus"></i>
              Thêm người dùng
            </Button>
          </div>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="session-list-controls">
        <div className="search-controls">
          <div className="search-input">
            <i className="fas fa-search"></i>
            <input
              type="text"
              placeholder="Tìm kiếm theo tên, email hoặc vai trò..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="session-table-container">
        <table className="session-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Tên</th>
            <th>Email</th>
            <th>Vai trò</th>
            <th>Trạng thái</th>
            <th>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {filteredUsers.map(user => (
            <tr key={user.id}>
              <td>{user.id}</td>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>{getRoleName(user.role)}</td>
              <td>
                {user.status === 'active' ? (
                  <Badge bg="success">Đã kích hoạt</Badge>
                ) : (
                  <Badge bg="warning">Chờ phê duyệt</Badge>
                )}
              </td>
              <td>
                {user.status === 'pending' ? (
                  <>
                    <Button 
                      variant="success" 
                      size="sm" 
                      className="me-2"
                      onClick={() => handleApprove(user)}
                    >
                      Phê duyệt
                    </Button>
                    <Button 
                      variant="danger" 
                      size="sm"
                      onClick={() => handleReject(user)}
                    >
                      Từ chối
                    </Button>
                  </>
                ) : (
                  <Button 
                    variant="primary" 
                    size="sm"
                  >
                    Chi tiết
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>

      {/* Approve Modal */}
      <Modal show={showApproveModal} onHide={() => setShowApproveModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Phê duyệt người dùng</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedUser && (
            <>
              <p>Bạn có chắc chắn muốn phê duyệt người dùng này?</p>
              <p><strong>Tên:</strong> {selectedUser.name}</p>
              <p><strong>Email:</strong> {selectedUser.email}</p>
              <p><strong>Vai trò:</strong> {getRoleName(selectedUser.role)}</p>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowApproveModal(false)}>
            Hủy
          </Button>
          <Button variant="success" onClick={confirmApprove}>
            Phê duyệt
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default UserList;