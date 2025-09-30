import React, { useState, useEffect } from 'react';
import { Form, Button, Card, Row, Col, Alert, Spinner, Table, Tabs, Tab, Badge, InputGroup } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';
import MapPreview from '../../components/MapPreview';

const EditSession = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { api } = useAuth();
  const [students, setStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [majors, setMajors] = useState([]);
  const [classFilter, setClassFilter] = useState('');
  const [facultyFilter, setFacultyFilter] = useState('');
  const [majorFilter, setMajorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('Đang học');
  const [sortField, setSortField] = useState('student_id');
  const [sortOrder, setSortOrder] = useState('asc');
  const [pageSize, setPageSize] = useState(70);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalStudents, setTotalStudents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [validated, setValidated] = useState(false);
  const [selectedLocationIndex, setSelectedLocationIndex] = useState(0);
  
  // Predefined hospital locations
  const predefinedLocations = [
    { name: "-- Chọn vị trí có sẵn --", latitude: null, longitude: null },
    { name: "Bệnh viện Tâm Trí Đà Nẵng", latitude: 16.022910377179983, longitude: 108.21418877313431 },
    { name: "Bệnh viện Tâm Trí Quảng Nam", latitude: 15.83878188925367, longitude: 108.28529005010874 },
    { name: "Bệnh viện Tâm Trí Sài Gòn", latitude: 10.831702813877188, longitude: 106.62179071788216 },
    { name: "Bệnh viện Tâm Trí Nha Trang", latitude: 12.212506709091144, longitude: 109.19488283420932 },
    { name: "Bệnh viện Tâm Trí Đồng Tháp", latitude: 10.476168701979864, longitude: 105.61251450982436 },
    { name: "Bệnh viện Tâm Trí Hồng Ngự", latitude: 10.808029003252175, longitude: 105.34998297903213 },
    { name: "Bệnh viện Tâm Trí Cao Lãnh", latitude: 10.465413477175426, longitude: 105.62900633746764 },
    { name: "Bệnh viện ĐH Y Khoa Phan Châu Trinh", latitude: 15.96252601077044, longitude: 108.25985382432913 },
    { name: "Bệnh viện TEST", latitude: 15.962683045139078, longitude: 108.25037464216163 }
  ];
  
  const [formData, setFormData] = useState({
    name: '',
    date: '',
    startTime: '',
    endTime: '',
    location: '',
    description: '',
    studentIds: [],
    status: '',
    password: '',
    monitoringOptions: {
      location: {
        enabled: true,
        interval: 120,
        accuracy: "high",
        required: true,
        enforcement: 'immediate',
        geofence: {
          enabled: true,
          radius: 100,
          coordinates: {
            latitude: null,
            longitude: null
          },
          alertOnExit: true,
          alertEmail: 'daotao1@pctu.edu.vn'
        }
      },
      file_upload: {
        enabled: true,
        max_size: 50,
        allowed_types: ["image/*", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
        required: true,
        min_files: 1
      },
      attendance: {
        before_session: {
          enabled: true,
          minutes_before: 30, // Điểm danh bắt đầu trước giờ học bao nhiêu phút
          duration: 30 // Thời gian cho phép điểm danh kéo dài bao nhiêu phút
        },
        during_session: {
          enabled: true,
          minutes_after_start: 120, // Điểm danh bắt đầu sau giờ bắt đầu buổi học bao nhiêu phút
          minutes_before_end: 120 // Điểm danh kết thúc trước giờ kết thúc buổi học bao nhiêu phút
        },
        after_session: {
          enabled: true,
          minutes_after: 0, // Điểm danh bắt đầu sau giờ kết thúc buổi học bao nhiêu phút
          duration: 30 // Thời gian cho phép điểm danh kéo dài bao nhiêu phút
        }
      }
    },
  });
  
  // Fetch students, filter options, and session data on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');
        
        // Fetch filter options
        const filterResponse = await api.get('/users/filter-options');
        if (filterResponse.data.success) {
          setClasses(filterResponse.data.classes.map(c => c.name));
          setFaculties(filterResponse.data.faculties.map(f => f.name));
          setMajors(filterResponse.data.majors.map(m => m.name));
        } else {
          toast.error('Không thể tải danh sách lớp/khoa/ngành');
        }
        
        // Fetch session data
        const sessionResponse = await api.get(`/sessions/${id}`);
        if (sessionResponse.data.success) {
          const session = sessionResponse.data.data;
          
          // The date should already be in YYYY-MM-DD format from the server
          const formatDate = (dateString) => {
            if (!dateString) return '';
            // Return the date string as is - it's already in YYYY-MM-DD format
            return dateString;
          };
          
          // Get monitoring options from the server or use defaults
          let serverMonitoringOptions = session.monitoring_options || {};
          
          // Parse monitoring_options if it's a string
          if (typeof serverMonitoringOptions === 'string') {
            try {
              serverMonitoringOptions = JSON.parse(serverMonitoringOptions);
            } catch (error) {
              console.error('Error parsing monitoring_options:', error);
              serverMonitoringOptions = {};
            }
          }
          
          // Check if the location matches any predefined hospital
          const locationIndex = predefinedLocations.findIndex(loc => 
            loc.name === session.location
          );
          
          if (locationIndex !== -1) {
            setSelectedLocationIndex(locationIndex);
          } else {
                      // Also check if coordinates match any predefined hospital
          const coordsIndex = predefinedLocations.findIndex(loc => 
            loc.latitude && 
            loc.longitude && 
            Math.abs(loc.latitude - serverMonitoringOptions.location?.geofence?.coordinates?.latitude) < 0.0001 && 
            Math.abs(loc.longitude - serverMonitoringOptions.location?.geofence?.coordinates?.longitude) < 0.0001
          );
          
          if (coordsIndex !== -1) {
            setSelectedLocationIndex(coordsIndex);
            
            // Make sure we're using the correct predefined coordinates instead of potentially wrong server ones
            serverMonitoringOptions.location = {
              ...serverMonitoringOptions.location,
              geofence: {
                ...serverMonitoringOptions.location?.geofence,
                coordinates: {
                  latitude: predefinedLocations[coordsIndex].latitude,
                  longitude: predefinedLocations[coordsIndex].longitude
                }
              }
            };
          }
          }
          
          setFormData({
            ...formData,
            name: session.title || '',
            date: formatDate(session.date),
            startTime: session.start_time || '',
            endTime: session.end_time || '',
            location: session.location || '',
            description: session.description || '',
            status: session.status || 'scheduled',
            // Don't set password as it's sensitive
            monitoringOptions: {

              location: {
                enabled: serverMonitoringOptions.location?.enabled ?? true,
                interval: serverMonitoringOptions.location?.interval ?? 120,
                accuracy: serverMonitoringOptions.location?.accuracy ?? "high",
                required: serverMonitoringOptions.location?.required ?? true,
                enforcement: serverMonitoringOptions.location?.enforcement ?? 'immediate',
                geofence: {
                  enabled: serverMonitoringOptions.location?.geofence?.enabled ?? true,
                  radius: serverMonitoringOptions.location?.geofence?.radius ?? 100,
                  coordinates: {
                    latitude: serverMonitoringOptions.location?.geofence?.coordinates?.latitude ?? null,
                    longitude: serverMonitoringOptions.location?.geofence?.coordinates?.longitude ?? null
                  },
                  alertOnExit: serverMonitoringOptions.location?.geofence?.alertOnExit ?? true,
                  alertEmail: serverMonitoringOptions.location?.geofence?.alertEmail ?? 'daotao1@pctu.edu.vn'
                }
              },
              file_upload: {
                enabled: serverMonitoringOptions.file_upload?.enabled ?? true,
                max_size: serverMonitoringOptions.file_upload?.max_size ?? 50,
                allowed_types: serverMonitoringOptions.file_upload?.allowed_types ?? ["image/*", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
                required: serverMonitoringOptions.file_upload?.required ?? true,
                min_files: serverMonitoringOptions.file_upload?.min_files ?? 1
              },
              attendance: {
                before_session: {
                  enabled: serverMonitoringOptions.attendance?.before_session?.enabled ?? true,
                  minutes_before: serverMonitoringOptions.attendance?.before_session?.minutes_before ?? 30,
                  duration: serverMonitoringOptions.attendance?.before_session?.duration ?? 30
                },
                during_session: {
                  enabled: serverMonitoringOptions.attendance?.during_session?.enabled ?? false,
                  minutes_after_start: serverMonitoringOptions.attendance?.during_session?.minutes_after_start ?? 120,
                  minutes_before_end: serverMonitoringOptions.attendance?.during_session?.minutes_before_end ?? 120
                },
                after_session: {
                  enabled: serverMonitoringOptions.attendance?.after_session?.enabled ?? false,
                  minutes_after: serverMonitoringOptions.attendance?.after_session?.minutes_after ?? 30,
                  duration: serverMonitoringOptions.attendance?.after_session?.duration ?? 30
                }
              }
            }
          });
          
          // Fetch session students
          try {
            const attendanceResponse = await api.get(`/sessions/${id}/attendance`);
            if (attendanceResponse.data.success) {
              const attendanceData = attendanceResponse.data.data;
              
              // Log the data structure for debugging
              console.log('Session students data:', attendanceData);
              
              // Map the data to our expected format
              const sessionStudents = attendanceData.map(record => ({
                id: record.student_id,
                full_name: record.full_name,
                student_id: record.username,
                class_name: record.class_name || '',
                faculty_name: record.faculty_name || '',
                major_name: record.major_name || ''
              }));
              
              console.log(`Loaded ${sessionStudents.length} students for session ${id}`);
              setSelectedStudents(sessionStudents);
              
              // Extract filters from selected students
              // Get most common class
              if (sessionStudents.length > 0 && sessionStudents[0].class_name) {
                const classes = sessionStudents.map(student => student.class_name).filter(Boolean);
                if (classes.length > 0) {
                  // Find most frequent class
                  const classCounts = {};
                  let maxCount = 0;
                  let mostFrequentClass = '';
                  
                  classes.forEach(className => {
                    if (!classCounts[className]) classCounts[className] = 0;
                    classCounts[className]++;
                    
                    if (classCounts[className] > maxCount) {
                      maxCount = classCounts[className];
                      mostFrequentClass = className;
                    }
                  });
                  
                  if (mostFrequentClass) {
                    setClassFilter(mostFrequentClass);
                  }
                }
              }
              
              // Similarly for faculty
              if (sessionStudents.length > 0 && sessionStudents[0].faculty_name) {
                const faculties = sessionStudents.map(student => student.faculty_name).filter(Boolean);
                if (faculties.length > 0) {
                  const facultyCounts = {};
                  let maxCount = 0;
                  let mostFrequentFaculty = '';
                  
                  faculties.forEach(faculty => {
                    if (!facultyCounts[faculty]) facultyCounts[faculty] = 0;
                    facultyCounts[faculty]++;
                    
                    if (facultyCounts[faculty] > maxCount) {
                      maxCount = facultyCounts[faculty];
                      mostFrequentFaculty = faculty;
                    }
                  });
                  
                  if (mostFrequentFaculty) {
                    setFacultyFilter(mostFrequentFaculty);
                  }
                }
              }
              
              // And for major
              if (sessionStudents.length > 0 && sessionStudents[0].major_name) {
                const majors = sessionStudents.map(student => student.major_name).filter(Boolean);
                if (majors.length > 0) {
                  const majorCounts = {};
                  let maxCount = 0;
                  let mostFrequentMajor = '';
                  
                  majors.forEach(major => {
                    if (!majorCounts[major]) majorCounts[major] = 0;
                    majorCounts[major]++;
                    
                    if (majorCounts[major] > maxCount) {
                      maxCount = majorCounts[major];
                      mostFrequentMajor = major;
                    }
                  });
                  
                  if (mostFrequentMajor) {
                    setMajorFilter(mostFrequentMajor);
                  }
                }
              }
            }
          } catch (err) {
            console.error('Error fetching session students:', err);
            toast.error('Không thể tải danh sách sinh viên của buổi học');
          }
        } else {
          setError('Không thể tải thông tin buổi học');
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Đã xảy ra lỗi khi tải dữ liệu. Vui lòng thử lại sau.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [id, api]);
  
  // Fetch students based on filters
  useEffect(() => {
    const fetchStudents = async () => {
      if (loading) return; // Skip if still loading session data
      
      try {
        let url = `/users?role=student&page=${currentPage}&limit=${pageSize}`;
        
        if (classFilter) {
          url += `&class_name=${encodeURIComponent(classFilter)}`;
        }
        
        if (facultyFilter) {
          url += `&faculty_name=${encodeURIComponent(facultyFilter)}`;
        }
        
        if (majorFilter) {
          url += `&major_name=${encodeURIComponent(majorFilter)}`;
        }
        
        if (sortField) {
          url += `&sort_field=${encodeURIComponent(sortField)}`;
        }
        
        if (sortOrder) {
          url += `&sort_order=${encodeURIComponent(sortOrder)}`;
        }
        
        if (statusFilter) {
          url += `&status=${encodeURIComponent(statusFilter)}`;
        }
        
        const response = await api.get(url);
        if (response.data.success) {
          // Preserve the selected students that are not in the current filtered view
          // by keeping track of their IDs
          const filteredStudents = response.data.data;
          setStudents(filteredStudents);
          setTotalStudents(response.data.pagination.totalItems);
          
          // Make sure selectedStudents that aren't in the current view are still preserved
          // First, create a map of IDs of the currently visible students
          const visibleStudentIds = new Set(filteredStudents.map(student => student.id));
          
          // Then, filter out the selectedStudents that are not in the current view
          // and make sure they have all required fields
          const invisibleSelectedStudents = selectedStudents.filter(
            student => !visibleStudentIds.has(student.id)
          );
          
          // The key part - make sure we don't lose selected students when changing filters
          if (invisibleSelectedStudents.length > 0) {
            // Update the student list to include both visible and selected students
            // This ensures that selected students from other pages/filters remain visible
            const updatedStudentsList = [
              ...filteredStudents,
              ...invisibleSelectedStudents.filter(s => 
                // Only add invisible students that are selected
                selectedStudents.some(selected => selected.id === s.id)
              )
            ];
            setStudents(updatedStudentsList);
          }
        } else {
          toast.error('Không thể tải danh sách sinh viên');
        }
      } catch (error) {
        console.error('Error fetching students:', error);
        toast.error('Đã xảy ra lỗi khi tải danh sách sinh viên');
      }
    };
    
    fetchStudents();
  }, [api, classFilter, facultyFilter, majorFilter, statusFilter, sortField, sortOrder, loading, currentPage, pageSize]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.startsWith('monitoring_')) {
      // Handle monitoring options
      const [prefix, option, property] = name.split('_');
      
      if (property) {
        // Handle nested properties (like interval, duration, etc.)
        setFormData({
          ...formData,
          monitoringOptions: {
            ...formData.monitoringOptions,
            [option]: {
              ...formData.monitoringOptions[option],
              [property]: type === 'checkbox' ? checked : value
            }
          }
        });
      } else {
        // Handle enabled/disabled toggles
        setFormData({
          ...formData,
          monitoringOptions: {
            ...formData.monitoringOptions,
            [option]: {
              ...formData.monitoringOptions[option],
              enabled: checked
            }
          }
        });
      }
    } else {
      // Handle other form fields
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    
    if (form.checkValidity() === false) {
      e.stopPropagation();
      setValidated(true);
      return;
    }
    
    setValidated(true);
    setSubmitting(true);
    setError('');
    
    try {
      // Use the date string directly from the form without any Date object conversion
      // This prevents timezone issues that can cause the date to shift
      let sessionDate = formData.date;
      
      // Just validate the format is YYYY-MM-DD
      if (sessionDate && !/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) {
        toast.error('Định dạng ngày không hợp lệ. Vui lòng sử dụng định dạng YYYY-MM-DD.');
        setSubmitting(false);
        return;
      }
      
      // Log selected students for debugging
      console.log(`Submitting session with ${selectedStudents.length} students`);
      
      // Get student IDs and ensure they are valid
      const studentIdsList = selectedStudents
        .map(student => student.id)
        .filter(id => id && typeof id === 'string' || typeof id === 'number');
      
      console.log('Student IDs to submit:', studentIdsList);
      
      // Prepare session data for API
      const sessionData = {
        title: formData.name,
        description: formData.description,
        studentIds: studentIdsList,
        date: sessionDate,
        startTime: formData.startTime,
        endTime: formData.endTime,
        location: formData.location,
        status: formData.status,
        monitoringOptions: formData.monitoringOptions
      };
      
      // Log the data being sent to help with debugging
      console.log('Sending session update data:', JSON.stringify(sessionData));
      
      // Add password if provided
      if (formData.password) {
        sessionData.password = formData.password;
      }
      
      // Call API to update session
      const response = await api.put(`/sessions/${id}`, sessionData);
      
      if (response.data.success) {
        toast.success('Cập nhật buổi học thành công');
        navigate('/admin/sessions');
      } else {
        setError(response.data.message || 'Không thể cập nhật buổi học');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Có lỗi xảy ra khi cập nhật buổi học. Vui lòng thử lại sau.');
      console.error('Error updating session:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center mt-5">
        <Spinner animation="border" role="status" variant="primary">
          <span className="visually-hidden">Đang tải...</span>
        </Spinner>
        <p className="mt-2">Đang tải thông tin buổi học...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="m-0">Chỉnh sửa buổi học lâm sàng</h2>
        <div>
          <Button 
            variant="outline-secondary" 
            className="me-2"
            onClick={() => navigate('/admin/sessions')}
            disabled={submitting}
          >
            <i className="fas fa-times me-1"></i> Hủy
          </Button>
          <Button 
            type="submit" 
            variant="primary"
            disabled={submitting}
            onClick={handleSubmit}
          >
            {submitting ? (
              <><i className="fas fa-spinner fa-spin me-1"></i> Đang cập nhật...</>
            ) : (
              <><i className="fas fa-save me-1"></i> Cập nhật buổi học</>
            )}
          </Button>
        </div>
      </div>
      
      {error && <Alert variant="danger"><i className="fas fa-exclamation-triangle me-2"></i>{error}</Alert>}
      
      <Form noValidate validated={validated} onSubmit={handleSubmit}>
        <Tabs defaultActiveKey="basic" id="session-tabs" className="mb-3">
          <Tab eventKey="basic" title={<span><i className="fas fa-info-circle me-1"></i>Thông tin cơ bản</span>}>
            <Card className="shadow-sm">
              <Card.Body>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Tên buổi học</Form.Label>
                      <InputGroup>
                        <InputGroup.Text><i className="fas fa-chalkboard-teacher"></i></InputGroup.Text>
                        <Form.Control
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          required
                          placeholder="Nhập tên buổi học"
                        />
                      </InputGroup>
                      <Form.Control.Feedback type="invalid">
                        Vui lòng nhập tên buổi học.
                      </Form.Control.Feedback>
                    </Form.Group>
                    
                    <Form.Group className="mb-3">
                      <Form.Label>Mô tả</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        placeholder="Nhập mô tả buổi học (không bắt buộc)"
                      />
                    </Form.Group>
                    
                    <Form.Group className="mb-3">
                      <Form.Label>Trạng thái</Form.Label>
                      <InputGroup>
                        <InputGroup.Text><i className="fas fa-flag"></i></InputGroup.Text>
                        <Form.Select
                          name="status"
                          value={formData.status}
                          onChange={handleChange}
                          required
                        >
                          <option value="scheduled">Sắp diễn ra</option>
                          <option value="active">Đang diễn ra</option>
                          <option value="ended">Đã kết thúc</option>
                          <option value="cancelled">Đã hủy</option>
                        </Form.Select>
                      </InputGroup>
                    </Form.Group>
                    
                    <Form.Group className="mb-3">
                      <Form.Label>Mật khẩu buổi học (để trống nếu không thay đổi)</Form.Label>
                      <InputGroup>
                        <InputGroup.Text><i className="fas fa-key"></i></InputGroup.Text>
                        <Form.Control
                          type="password"
                          name="password"
                          value={formData.password}
                          onChange={handleChange}
                          placeholder="Nhập mật khẩu mới (nếu muốn thay đổi)"
                        />
                      </InputGroup>
                      <Form.Text className="text-muted">
                        Để trống nếu không muốn thay đổi mật khẩu hiện tại
                      </Form.Text>
                    </Form.Group>
                  </Col>
                  
                  <Col md={6}>
                    <Row>
                      <Col md={12}>
                        <Form.Group className="mb-3">
                          <Form.Label>Ngày</Form.Label>
                          <InputGroup>
                            <InputGroup.Text><i className="fas fa-calendar-alt"></i></InputGroup.Text>
                            <Form.Control
                              type="date"
                              name="date"
                              value={formData.date}
                              onChange={handleChange}
                              required
                            />
                          </InputGroup>
                          <Form.Control.Feedback type="invalid">
                            Vui lòng chọn ngày.
                          </Form.Control.Feedback>
                        </Form.Group>
                      </Col>
                    </Row>
                    
                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Giờ bắt đầu</Form.Label>
                          <InputGroup>
                            <InputGroup.Text><i className="fas fa-clock"></i></InputGroup.Text>
                            <Form.Control
                              type="time"
                              name="startTime"
                              value={formData.startTime}
                              onChange={handleChange}
                              required
                            />
                          </InputGroup>
                          <Form.Control.Feedback type="invalid">
                            Vui lòng chọn giờ bắt đầu.
                          </Form.Control.Feedback>
                        </Form.Group>
                      </Col>
                      
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Giờ kết thúc</Form.Label>
                          <InputGroup>
                            <InputGroup.Text><i className="fas fa-clock"></i></InputGroup.Text>
                            <Form.Control
                              type="time"
                              name="endTime"
                              value={formData.endTime}
                              onChange={handleChange}
                              required
                            />
                          </InputGroup>
                          <Form.Control.Feedback type="invalid">
                            Vui lòng chọn giờ kết thúc.
                          </Form.Control.Feedback>
                        </Form.Group>
                      </Col>
                    </Row>
                    
                    <Form.Group className="mb-3">
                      <Form.Label>Địa điểm</Form.Label>
                      <InputGroup>
                        <InputGroup.Text><i className="fas fa-map-marker-alt"></i></InputGroup.Text>
                        <Form.Select
                          value={predefinedLocations.some(loc => loc.name === formData.location) ? formData.location : "custom"}
                          onChange={(e) => {
                            const selectedValue = e.target.value;
                            
                            if (selectedValue === "custom") {
                              setFormData({
                                ...formData,
                                location: ""
                              });
                            } else {
                              setFormData({
                                ...formData,
                                location: selectedValue
                              });
                              
                              const selectedLocation = predefinedLocations.find(loc => loc.name === selectedValue);
                              
                              if (selectedLocation && selectedLocation.latitude && selectedLocation.longitude) {
                                const locationIndex = predefinedLocations.findIndex(loc => loc.name === selectedValue);
                                if (locationIndex !== -1) {
                                  setSelectedLocationIndex(locationIndex);
                                }
                                
                                setFormData(prev => ({
                                  ...prev,
                                  location: selectedValue,
                                  monitoringOptions: {
                                    ...prev.monitoringOptions,
                                    location: {
                                      ...prev.monitoringOptions.location,
                                      geofence: {
                                        ...prev.monitoringOptions.location.geofence,
                                        enabled: true,
                                        coordinates: {
                                          latitude: selectedLocation.latitude,
                                          longitude: selectedLocation.longitude
                                        }
                                      }
                                    }
                                  }
                                }));
                              }
                            }
                          }}
                        >
                          <option value="">-- Chọn địa điểm --</option>
                          {predefinedLocations.slice(1).map((location, index) => (
                            <option key={index} value={location.name}>{location.name}</option>
                          ))}
                          <option value="custom">Địa điểm khác</option>
                        </Form.Select>
                      </InputGroup>
                      
                      {(!predefinedLocations.some(loc => loc.name === formData.location) || formData.location === "" || formData.location === "custom") && (
                        <Form.Control
                          type="text"
                          name="location"
                          value={formData.location}
                          onChange={handleChange}
                          required
                          placeholder="Nhập địa điểm buổi học"
                          className="mt-2"
                        />
                      )}
                      <Form.Control.Feedback type="invalid">
                        Vui lòng chọn hoặc nhập địa điểm buổi học.
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Tab>
          
          <Tab eventKey="students" title={<span><i className="fas fa-users me-1"></i>Sinh viên tham gia <Badge bg="primary" pill>{selectedStudents.length}</Badge></span>}>
            <Card className="shadow-sm">
              <Card.Body>
                <Row className="mb-3">
                  <Col md={12}>
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <div className="d-flex">
                        <InputGroup className="me-2" style={{ width: 'auto' }}>
                          <InputGroup.Text><i className="fas fa-graduation-cap"></i></InputGroup.Text>
                          <Form.Select
                            value={classFilter}
                            onChange={(e) => setClassFilter(e.target.value)}
                            style={{ width: '200px' }}
                          >
                            <option value="">-- Tất cả lớp --</option>
                            {classes.map((className, index) => (
                              <option key={index} value={className}>{className}</option>
                            ))}
                          </Form.Select>
                        </InputGroup>
                        
                        <InputGroup className="me-2" style={{ width: 'auto' }}>
                          <InputGroup.Text><i className="fas fa-university"></i></InputGroup.Text>
                          <Form.Select
                            value={facultyFilter}
                            onChange={(e) => setFacultyFilter(e.target.value)}
                            style={{ width: '200px' }}
                          >
                            <option value="">-- Tất cả khoa --</option>
                            {faculties.map((faculty, index) => (
                              <option key={index} value={faculty}>{faculty}</option>
                            ))}
                          </Form.Select>
                        </InputGroup>
                        
                        <InputGroup className="me-2" style={{ width: 'auto' }}>
                          <InputGroup.Text><i className="fas fa-book"></i></InputGroup.Text>
                          <Form.Select
                            value={majorFilter}
                            onChange={(e) => setMajorFilter(e.target.value)}
                            style={{ width: '200px' }}
                          >
                            <option value="">-- Tất cả ngành --</option>
                            {majors.map((major, index) => (
                              <option key={index} value={major}>{major}</option>
                            ))}
                          </Form.Select>
                        </InputGroup>

                        <InputGroup style={{ width: 'auto' }}>
                          <InputGroup.Text><i className="fas fa-user-check"></i></InputGroup.Text>
                          <Form.Select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            style={{ width: '200px' }}
                          >
                            <option value="Đang học">-- Đang học --</option>
                            <option value="">-- Tất cả trạng thái --</option>
                            <option value="Nghỉ học">Nghỉ học</option>
                            <option value="Tạm dừng">Tạm dừng</option>
                            <option value="Đã tốt nghiệp">Đã tốt nghiệp</option>
                          </Form.Select>
                        </InputGroup>
                      </div>
                      
                      <div className="d-flex">
                        <Button 
                          variant="outline-danger" 
                          size="sm"
                          className="me-2"
                          onClick={() => setSelectedStudents([])}
                        >
                          <i className="fas fa-times-circle me-1"></i>Bỏ chọn tất cả
                        </Button>
                        <Button 
                          variant="outline-success" 
                          size="sm"
                          onClick={() => setSelectedStudents(students)}
                        >
                          <i className="fas fa-check-circle me-1"></i>Chọn tất cả
                        </Button>
                      </div>
                    </div>
                  </Col>
                </Row>
                
                <div className="table-responsive border rounded shadow-sm" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                  <Table striped hover className="mb-0">
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', zIndex: 1 }}>
                      <tr>
                        <th style={{ width: '50px', textAlign: 'center' }}>
                          <i className="fas fa-check-square"></i>
                        </th>
                        <th 
                          style={{ cursor: 'pointer' }} 
                          onClick={() => {
                            setSortOrder(sortField === 'student_id' && sortOrder === 'asc' ? 'desc' : 'asc');
                            setSortField('student_id');
                            setCurrentPage(1);
                          }}
                          className="user-select-none"
                        >
                          <div className="d-flex justify-content-between align-items-center">
                            <span>Mã SV</span>
                            {sortField === 'student_id' && (
                              <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                            )}
                          </div>
                        </th>
                        <th 
                          style={{ cursor: 'pointer' }} 
                          onClick={() => {
                            setSortOrder(sortField === 'full_name' && sortOrder === 'asc' ? 'desc' : 'asc');
                            setSortField('full_name');
                            setCurrentPage(1);
                          }}
                          className="user-select-none"
                        >
                          <div className="d-flex justify-content-between align-items-center">
                            <span>Họ và tên</span>
                            {sortField === 'full_name' && (
                              <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                            )}
                          </div>
                        </th>
                        <th>Lớp</th>
                        <th>Khoa</th>
                        <th>Ngành</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.length > 0 ? (
                        students.map(student => (
                          <tr key={student.id} className={selectedStudents.some(s => s.id === student.id) ? 'table-active' : ''}>
                            <td className="text-center">
                              <Form.Check
                                type="checkbox"
                                checked={selectedStudents.some(s => s.id === student.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedStudents([...selectedStudents, student]);
                                  } else {
                                    setSelectedStudents(selectedStudents.filter(s => s.id !== student.id));
                                  }
                                }}
                              />
                            </td>
                            <td>{student.student_id}</td>
                            <td>{student.full_name}</td>
                            <td>{student.class_name}</td>
                            <td>{student.faculty_name}</td>
                            <td>{student.major_name}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" className="text-center py-3">
                            <i className="fas fa-search me-2"></i>Không tìm thấy sinh viên nào
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </div>
                
                <div className="d-flex justify-content-between align-items-center mt-3">
                  <div className="d-flex align-items-center">
                    <span className="me-2">Hiển thị:</span>
                    <Form.Select 
                      style={{ width: 'auto' }}
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="me-2"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={70}>70</option>
                      <option value={100}>100</option>
                    </Form.Select>
                    <span>sinh viên mỗi trang</span>
                  </div>
                  
                  <div className="d-flex align-items-center">
                    <Button 
                      variant="outline-primary" 
                      size="sm" 
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="me-2"
                    >
                      <i className="fas fa-chevron-left"></i> Trước
                    </Button>
                    <span className="px-2">
                      Trang <strong>{currentPage}</strong> / {Math.ceil(totalStudents / pageSize) || 1}
                    </span>
                    <Button 
                      variant="outline-primary" 
                      size="sm" 
                      onClick={() => setCurrentPage(prev => prev + 1)}
                      disabled={currentPage >= Math.ceil(totalStudents / pageSize)}
                      className="ms-2"
                    >
                      Sau <i className="fas fa-chevron-right"></i>
                    </Button>
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Tab>
          
          <Tab eventKey="monitoring" title={<span><i className="fas fa-video me-1"></i>Tùy chọn giám sát</span>}>
            <Card className="shadow-sm">
              <Card.Body>
                <Tabs defaultActiveKey="location" id="monitoring-tabs" className="mb-3">
                  
                  <Tab eventKey="location" title={<span><i className="fas fa-map-marker-alt me-1"></i>Vị trí</span>}>
                    <Card className="border-0 shadow-sm">
                      <Card.Body>
                        <div className="d-flex justify-content-between align-items-center mb-3">
                          <h5 className="mb-0">Theo dõi vị trí</h5>
                          <Form.Check 
                            type="switch"
                            id="monitoring_location"
                            name="monitoring_location"
                            checked={formData.monitoringOptions.location.enabled}
                            onChange={handleChange}
                            className="mb-0"
                            label={formData.monitoringOptions.location.enabled ? "Đã bật" : "Đã tắt"}
                          />
                        </div>
                        
                        <div className={formData.monitoringOptions.location.enabled ? '' : 'opacity-50'}>
                          <Row className="mb-3">
                            <Col md={6}>
                              <Form.Group>
                                <Form.Label>Kiểm tra vị trí mỗi (giây)</Form.Label>
                                <InputGroup>
                                  <InputGroup.Text><i className="fas fa-stopwatch"></i></InputGroup.Text>
                                  <Form.Control
                                    type="number"
                                    min="30"
                                    max="600"
                                    name="monitoring_location_interval"
                                    value={formData.monitoringOptions.location.interval}
                                    onChange={handleChange}
                                    disabled={!formData.monitoringOptions.location.enabled}
                                  />
                                </InputGroup>
                              </Form.Group>
                            </Col>
                            <Col md={6}>
                              <Form.Group>
                                <Form.Label>Độ chính xác</Form.Label>
                                <InputGroup>
                                  <InputGroup.Text><i className="fas fa-bullseye"></i></InputGroup.Text>
                                  <Form.Select
                                    name="monitoring_location_accuracy"
                                    value={formData.monitoringOptions.location.accuracy}
                                    onChange={handleChange}
                                    disabled={!formData.monitoringOptions.location.enabled}
                                  >
                                    <option value="high">Cao</option>
                                    <option value="medium">Trung bình</option>
                                    <option value="low">Thấp</option>
                                  </Form.Select>
                                </InputGroup>
                              </Form.Group>
                            </Col>
                          </Row>
                          
                          <div className="d-flex justify-content-between align-items-center mt-4 mb-3">
                            <h6 className="mb-0">Giới hạn vị trí (Geofence)</h6>
                            <Form.Check 
                              type="switch"
                              id="monitoring_location_geofence_enabled"
                              name="monitoring_location_geofence_enabled"
                              checked={formData.monitoringOptions.location.geofence?.enabled}
                              onChange={(e) => {
                                setFormData({
                                  ...formData,
                                  monitoringOptions: {
                                    ...formData.monitoringOptions,
                                    location: {
                                      ...formData.monitoringOptions.location,
                                      geofence: {
                                        ...formData.monitoringOptions.location.geofence,
                                        enabled: e.target.checked
                                      }
                                    }
                                  }
                                });
                              }}
                              disabled={!formData.monitoringOptions.location.enabled}
                              label={formData.monitoringOptions.location.geofence?.enabled ? "Đã bật" : "Đã tắt"}
                            />
                          </div>
                          
                          {formData.monitoringOptions.location.geofence?.enabled && (
                            <div className="border rounded p-3 mt-3 mb-3 bg-light">
                              <Row className="mb-3">
                                <Col md={6}>
                                  <Form.Group className="mb-3">
                                    <Form.Label>Chọn vị trí có sẵn</Form.Label>
                                    <InputGroup>
                                      <InputGroup.Text><i className="fas fa-hospital"></i></InputGroup.Text>
                                      <Form.Select
                                        value={selectedLocationIndex}
                                        onChange={(e) => {
                                          const index = parseInt(e.target.value);
                                          setSelectedLocationIndex(index);
                                          const selectedLocation = predefinedLocations[index];
                                          // Always use the predefined coordinates for the selected location
                                          if (selectedLocation) {
                                            if (index > 0) {
                                              setFormData({
                                                ...formData,
                                                location: selectedLocation.name,
                                                monitoringOptions: {
                                                  ...formData.monitoringOptions,
                                                  location: {
                                                    ...formData.monitoringOptions.location,
                                                    geofence: {
                                                      ...formData.monitoringOptions.location.geofence,
                                                      enabled: true,
                                                      coordinates: {
                                                        latitude: selectedLocation.latitude,
                                                        longitude: selectedLocation.longitude
                                                      }
                                                    }
                                                  }
                                                }
                                              });
                                            } else {
                                              setFormData({
                                                ...formData,
                                                monitoringOptions: {
                                                  ...formData.monitoringOptions,
                                                  location: {
                                                    ...formData.monitoringOptions.location,
                                                    geofence: {
                                                      ...formData.monitoringOptions.location.geofence,
                                                      coordinates: {
                                                        latitude: selectedLocation.latitude,
                                                        longitude: selectedLocation.longitude
                                                      }
                                                    }
                                                  }
                                                }
                                              });
                                            }
                                          }
                                        }}
                                      >
                                        {predefinedLocations.map((location, index) => (
                                          <option key={index} value={index}>{location.name}</option>
                                        ))}
                                      </Form.Select>
                                    </InputGroup>
                                    <Form.Text className="text-muted">
                                      Chọn một địa điểm có sẵn hoặc nhập tọa độ thủ công bên dưới
                                    </Form.Text>
                                  </Form.Group>
                                </Col>
                                <Col md={6}>
                                  <Form.Group className="mb-3">
                                    <Form.Label>Bán kính (mét)</Form.Label>
                                    <InputGroup>
                                      <InputGroup.Text><i className="fas fa-circle-notch"></i></InputGroup.Text>
                                      <Form.Control
                                        type="number"
                                        min="10"
                                        max="1000"
                                        name="monitoring_location_geofence_radius"
                                        value={formData.monitoringOptions.location.geofence.radius}
                                        onChange={(e) => {
                                          const newRadius = parseInt(e.target.value) || 100;
                                          setFormData({
                                            ...formData,
                                            monitoringOptions: {
                                              ...formData.monitoringOptions,
                                              location: {
                                                ...formData.monitoringOptions.location,
                                                geofence: {
                                                  ...formData.monitoringOptions.location.geofence,
                                                  radius: newRadius
                                                }
                                              }
                                            }
                                          });
                                        }}
                                      />
                                    </InputGroup>
                                    <Form.Text className="text-muted">
                                      Khoảng cách tối đa từ vị trí chỉ định (10-1000 mét)
                                    </Form.Text>
                                  </Form.Group>
                                </Col>
                              </Row>
                              
                              <Row>
                                <Col md={6}>
                                  <Form.Group className="mb-3">
                                    <Form.Label>Vĩ độ (Latitude)</Form.Label>
                                    <InputGroup>
                                      <InputGroup.Text><i className="fas fa-map-pin"></i></InputGroup.Text>
                                      <Form.Control
                                        type="number"
                                        step="0.000001"
                                        name="monitoring_location_geofence_latitude"
                                        value={formData.monitoringOptions.location.geofence.coordinates.latitude || ''}
                                        onChange={(e) => {
                                          const newLatitude = parseFloat(e.target.value) || null;
                                          setFormData({
                                            ...formData,
                                            monitoringOptions: {
                                              ...formData.monitoringOptions,
                                              location: {
                                                ...formData.monitoringOptions.location,
                                                geofence: {
                                                  ...formData.monitoringOptions.location.geofence,
                                                  coordinates: {
                                                    ...formData.monitoringOptions.location.geofence.coordinates,
                                                    latitude: newLatitude
                                                  }
                                                }
                                              }
                                            }
                                          });
                                          
                                          if (selectedLocationIndex !== 0) {
                                            setSelectedLocationIndex(0);
                                          }
                                        }}
                                        placeholder="Ví dụ: 10.762622"
                                      />
                                    </InputGroup>
                                  </Form.Group>
                                </Col>
                                <Col md={6}>
                                  <Form.Group className="mb-3">
                                    <Form.Label>Kinh độ (Longitude)</Form.Label>
                                    <InputGroup>
                                      <InputGroup.Text><i className="fas fa-map-pin"></i></InputGroup.Text>
                                      <Form.Control
                                        type="number"
                                        step="0.000001"
                                        name="monitoring_location_geofence_longitude"
                                        value={formData.monitoringOptions.location.geofence.coordinates.longitude || ''}
                                        onChange={(e) => {
                                          const newLongitude = parseFloat(e.target.value) || null;
                                          setFormData({
                                            ...formData,
                                            monitoringOptions: {
                                              ...formData.monitoringOptions,
                                              location: {
                                                ...formData.monitoringOptions.location,
                                                geofence: {
                                                  ...formData.monitoringOptions.location.geofence,
                                                  coordinates: {
                                                    ...formData.monitoringOptions.location.geofence.coordinates,
                                                    longitude: newLongitude
                                                  }
                                                }
                                              }
                                            }
                                          });
                                          
                                          if (selectedLocationIndex !== 0) {
                                            setSelectedLocationIndex(0);
                                          }
                                        }}
                                        placeholder="Ví dụ: 106.660172"
                                      />
                                    </InputGroup>
                                  </Form.Group>
                                </Col>
                              </Row>
                              
                              {/* Map Preview - Always show */}
                              <div className="mb-3 border rounded overflow-hidden" style={{ height: '500px' }}>
                                <MapPreview 
                                  latitude={formData.monitoringOptions.location.geofence.coordinates.latitude}
                                  longitude={formData.monitoringOptions.location.geofence.coordinates.longitude}
                                  radius={formData.monitoringOptions.location.geofence.radius}
                                />
                              </div>
                              <small className="text-muted d-block mt-2">
                                <i className="fas fa-info-circle me-1"></i>
                                Bản đồ sẽ hiển thị sau khi bạn nhập tọa độ hoặc chọn vị trí có sẵn.
                              </small>
                              
                              <div className="d-flex align-items-center">
                                <Form.Check 
                                  type="switch"
                                  id="monitoring_location_geofence_alertOnExit"
                                  name="monitoring_location_geofence_alertOnExit"
                                  label="Cảnh báo khi rời khỏi vùng"
                                  checked={formData.monitoringOptions.location.geofence.alertOnExit}
                                  onChange={(e) => {
                                    setFormData({
                                      ...formData,
                                      monitoringOptions: {
                                        ...formData.monitoringOptions,
                                        location: {
                                          ...formData.monitoringOptions.location,
                                          geofence: {
                                            ...formData.monitoringOptions.location.geofence,
                                            alertOnExit: e.target.checked
                                          }
                                        }
                                      }
                                    });
                                  }}
                                />
                              </div>
                              
                              {formData.monitoringOptions.location.geofence.alertOnExit && (
                                <Form.Group className="mt-3">
                                  <Form.Label>Email nhận thông báo</Form.Label>
                                  <InputGroup>
                                    <InputGroup.Text><i className="fas fa-envelope"></i></InputGroup.Text>
                                    <Form.Control
                                      type="email"
                                      name="monitoring_location_geofence_alertEmail"
                                      value={formData.monitoringOptions.location.geofence.alertEmail}
                                      onChange={(e) => {
                                        setFormData({
                                          ...formData,
                                          monitoringOptions: {
                                            ...formData.monitoringOptions,
                                            location: {
                                              ...formData.monitoringOptions.location,
                                              geofence: {
                                                ...formData.monitoringOptions.location.geofence,
                                                alertEmail: e.target.value
                                              }
                                            }
                                          }
                                        });
                                      }}
                                      placeholder="Nhập email để nhận thông báo"
                                    />
                                  </InputGroup>
                                  <Form.Text className="text-muted">
                                    Hệ thống sẽ gửi email thông báo khi sinh viên rời khỏi vị trí quy định
                                  </Form.Text>
                                </Form.Group>
                              )}
                            </div>
                          )}
                          
                          <hr />
                          
                          <div className="d-flex align-items-center mb-3">
                            <Form.Check 
                              type="checkbox"
                              id="monitoring_location_required"
                              name="monitoring_location_required"
                              label="Bắt buộc"
                              checked={formData.monitoringOptions.location.required}
                              onChange={(e) => {
                                setFormData({
                                  ...formData,
                                  monitoringOptions: {
                                    ...formData.monitoringOptions,
                                    location: {
                                      ...formData.monitoringOptions.location,
                                      required: e.target.checked
                                    }
                                  }
                                });
                              }}
                              disabled={!formData.monitoringOptions.location.enabled}
                              className="me-3"
                            />
                            
                            {formData.monitoringOptions.location.required && (
                              <Form.Group style={{ minWidth: '250px' }}>
                                <Form.Label className="mb-0">Thời điểm áp dụng:</Form.Label>
                                <Form.Select
                                  size="sm"
                                  name="monitoring_location_enforcement"
                                  value={formData.monitoringOptions.location.enforcement}
                                  onChange={(e) => {
                                    setFormData({
                                      ...formData,
                                      monitoringOptions: {
                                        ...formData.monitoringOptions,
                                        location: {
                                          ...formData.monitoringOptions.location,
                                          enforcement: e.target.value
                                        }
                                      }
                                    });
                                  }}
                                  disabled={!formData.monitoringOptions.location.enabled || !formData.monitoringOptions.location.required}
                                  className="ms-2"
                                >
                                  <option value="immediate">Ngay lập tức (từ chối điểm danh)</option>
                                  <option value="delayed">Sau khi điểm danh (cho phép 5 phút)</option>
                                  <option value="end-of-session">Cuối buổi học</option>
                                </Form.Select>
                              </Form.Group>
                            )}
                          </div>
                        </div>
                      </Card.Body>
                    </Card>
                  </Tab>
                  
                  <Tab eventKey="files" title={<span><i className="fas fa-file-upload me-1"></i>Tệp tin</span>}>
                    <Card className="border-0 shadow-sm">
                      <Card.Body>
                        <div className="d-flex justify-content-between align-items-center mb-3">
                          <h5 className="mb-0">Cho phép tải lên tệp tin</h5>
                          <Form.Check 
                            type="switch"
                            id="monitoring_file_upload"
                            name="monitoring_file_upload"
                            checked={formData.monitoringOptions.file_upload.enabled}
                            onChange={handleChange}
                            className="mb-0"
                            label={formData.monitoringOptions.file_upload.enabled ? "Đã bật" : "Đã tắt"}
                          />
                        </div>
                        
                        <div className={formData.monitoringOptions.file_upload.enabled ? '' : 'opacity-50'}>
                          <Row className="mb-3">
                            <Col md={6}>
                              <Form.Group>
                                <Form.Label>Kích thước tối đa (MB)</Form.Label>
                                <InputGroup>
                                  <InputGroup.Text><i className="fas fa-weight"></i></InputGroup.Text>
                                  <Form.Control
                                    type="number"
                                    min="1"
                                    max="100"
                                    name="monitoring_file_upload_max_size"
                                    value={formData.monitoringOptions.file_upload.max_size}
                                    onChange={handleChange}
                                    disabled={!formData.monitoringOptions.file_upload.enabled}
                                  />
                                </InputGroup>
                              </Form.Group>
                            </Col>
                            
                            <Col md={6}>
                              <div className="d-flex align-items-center h-100">
                                <Form.Check 
                                  type="checkbox"
                                  id="monitoring_file_upload_required"
                                  name="monitoring_file_upload_required"
                                  label="Bắt buộc tải lên tệp tin"
                                  checked={formData.monitoringOptions.file_upload.required}
                                  onChange={(e) => {
                                    setFormData({
                                      ...formData,
                                      monitoringOptions: {
                                        ...formData.monitoringOptions,
                                        file_upload: {
                                          ...formData.monitoringOptions.file_upload,
                                          required: e.target.checked
                                        }
                                      }
                                    });
                                  }}
                                  disabled={!formData.monitoringOptions.file_upload.enabled}
                                />
                              </div>
                            </Col>
                          </Row>
                          
                          {formData.monitoringOptions.file_upload.required && (
                            <Form.Group className="mb-4">
                              <Form.Label>Số lượng tệp tin tối thiểu</Form.Label>
                              <InputGroup>
                                <InputGroup.Text><i className="fas fa-list-ol"></i></InputGroup.Text>
                                <Form.Control
                                  type="number"
                                  min="1"
                                  max="10"
                                  name="monitoring_file_upload_min_files"
                                  value={formData.monitoringOptions.file_upload.min_files || 1}
                                  onChange={(e) => {
                                    setFormData({
                                      ...formData,
                                      monitoringOptions: {
                                        ...formData.monitoringOptions,
                                        file_upload: {
                                          ...formData.monitoringOptions.file_upload,
                                          min_files: parseInt(e.target.value) || 1
                                        }
                                      }
                                    });
                                  }}
                                  disabled={!formData.monitoringOptions.file_upload.enabled || !formData.monitoringOptions.file_upload.required}
                                />
                              </InputGroup>
                              <Form.Text className="text-muted">
                                Sinh viên phải tải lên ít nhất số lượng tệp tin này để hoàn thành buổi học
                              </Form.Text>
                            </Form.Group>
                          )}
                          
                          <Form.Group>
                            <Form.Label>Loại tệp tin cho phép</Form.Label>
                            <Card className="border p-3">
                              <div className="d-flex flex-wrap gap-4">
                                <Form.Check 
                                  type="switch"
                                  id="file_type_images"
                                  label={<span><i className="fas fa-image me-2"></i>Hình ảnh (JPG, PNG, GIF...)</span>}
                                  checked={formData.monitoringOptions.file_upload.allowed_types.includes("image/*")}
                                  onChange={(e) => {
                                    const types = [...formData.monitoringOptions.file_upload.allowed_types];
                                    if (e.target.checked) {
                                      if (!types.includes("image/*")) types.push("image/*");
                                    } else {
                                      const index = types.indexOf("image/*");
                                      if (index > -1) types.splice(index, 1);
                                    }
                                    setFormData({
                                      ...formData,
                                      monitoringOptions: {
                                        ...formData.monitoringOptions,
                                        file_upload: {
                                          ...formData.monitoringOptions.file_upload,
                                          allowed_types: types
                                        }
                                      }
                                    });
                                  }}
                                  disabled={!formData.monitoringOptions.file_upload.enabled}
                                />
                                
                                <Form.Check 
                                  type="switch"
                                  id="file_type_pdf"
                                  label={<span><i className="fas fa-file-pdf me-2"></i>PDF</span>}
                                  checked={formData.monitoringOptions.file_upload.allowed_types.includes("application/pdf")}
                                  onChange={(e) => {
                                    const types = [...formData.monitoringOptions.file_upload.allowed_types];
                                    if (e.target.checked) {
                                      if (!types.includes("application/pdf")) types.push("application/pdf");
                                    } else {
                                      const index = types.indexOf("application/pdf");
                                      if (index > -1) types.splice(index, 1);
                                    }
                                    setFormData({
                                      ...formData,
                                      monitoringOptions: {
                                        ...formData.monitoringOptions,
                                        file_upload: {
                                          ...formData.monitoringOptions.file_upload,
                                          allowed_types: types
                                        }
                                      }
                                    });
                                  }}
                                  disabled={!formData.monitoringOptions.file_upload.enabled}
                                />
                                
                                <Form.Check 
                                  type="switch"
                                  id="file_type_word"
                                  label={<span><i className="fas fa-file-word me-2"></i>Word (DOC, DOCX)</span>}
                                  checked={formData.monitoringOptions.file_upload.allowed_types.some(type => 
                                    type.includes("msword") || type.includes("wordprocessingml")
                                  )}
                                  onChange={(e) => {
                                    const types = [...formData.monitoringOptions.file_upload.allowed_types];
                                    const wordTypes = ["application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
                                    
                                    if (e.target.checked) {
                                      wordTypes.forEach(type => {
                                        if (!types.includes(type)) types.push(type);
                                      });
                                    } else {
                                      wordTypes.forEach(type => {
                                        const index = types.indexOf(type);
                                        if (index > -1) types.splice(index, 1);
                                      });
                                    }
                                    
                                    setFormData({
                                      ...formData,
                                      monitoringOptions: {
                                        ...formData.monitoringOptions,
                                        file_upload: {
                                          ...formData.monitoringOptions.file_upload,
                                          allowed_types: types
                                        }
                                      }
                                    });
                                  }}
                                  disabled={!formData.monitoringOptions.file_upload.enabled}
                                />
                              </div>
                            </Card>
                          </Form.Group>
                        </div>
                      </Card.Body>
                    </Card>
                  </Tab>
                  
                  <Tab eventKey="attendance" title={<span><i className="fas fa-calendar-check me-1"></i>Điểm danh</span>}>
                    <Card className="border-0 shadow-sm">
                      <Card.Body>
                        <h5 className="mb-3">Tùy chọn điểm danh nhiều lần</h5>
                        
                        <div className="mb-4">
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <div>
                              <h6 className="mb-0">Điểm danh trước buổi học</h6>
                              <small className="text-muted">Điểm danh trước giờ bắt đầu</small>
                            </div>
                            <Form.Check 
                              type="switch"
                              id="attendance_before_session"
                              name="attendance_before_session"
                              checked={formData.monitoringOptions.attendance.before_session.enabled}
                              onChange={(e) => {
                                setFormData({
                                  ...formData,
                                  monitoringOptions: {
                                    ...formData.monitoringOptions,
                                    attendance: {
                                      ...formData.monitoringOptions.attendance,
                                      before_session: {
                                        ...formData.monitoringOptions.attendance.before_session,
                                        enabled: e.target.checked
                                      }
                                    }
                                  }
                                });
                              }}
                              label={formData.monitoringOptions.attendance.before_session.enabled ? "Đã bật" : "Đã tắt"}
                            />
                          </div>
                          
                          {formData.monitoringOptions.attendance.before_session.enabled && (
                            <Card className="bg-light border mb-4">
                              <Card.Body>
                                <Row>
                                  <Col md={6}>
                                    <Form.Group className="mb-3">
                                      <Form.Label>Bắt đầu trước giờ học (phút)</Form.Label>
                                      <InputGroup>
                                        <InputGroup.Text><i className="fas fa-hourglass-start"></i></InputGroup.Text>
                                        <Form.Control
                                          type="number"
                                          min="5"
                                          max="120"
                                          value={formData.monitoringOptions.attendance.before_session.minutes_before}
                                          onChange={(e) => {
                                            setFormData({
                                              ...formData,
                                              monitoringOptions: {
                                                ...formData.monitoringOptions,
                                                attendance: {
                                                  ...formData.monitoringOptions.attendance,
                                                  before_session: {
                                                    ...formData.monitoringOptions.attendance.before_session,
                                                    minutes_before: parseInt(e.target.value) || 30
                                                  }
                                                }
                                              }
                                            });
                                          }}
                                        />
                                      </InputGroup>
                                      <Form.Text className="text-muted">
                                        Mặc định: 30 phút trước giờ bắt đầu
                                      </Form.Text>
                                    </Form.Group>
                                  </Col>
                                  <Col md={6}>
                                    <Form.Group className="mb-3">
                                      <Form.Label>Thời gian cho phép điểm danh (phút)</Form.Label>
                                      <InputGroup>
                                        <InputGroup.Text><i className="fas fa-clock"></i></InputGroup.Text>
                                        <Form.Control
                                          type="number"
                                          min="5"
                                          max="120"
                                          value={formData.monitoringOptions.attendance.before_session.duration}
                                          onChange={(e) => {
                                            setFormData({
                                              ...formData,
                                              monitoringOptions: {
                                                ...formData.monitoringOptions,
                                                attendance: {
                                                  ...formData.monitoringOptions.attendance,
                                                  before_session: {
                                                    ...formData.monitoringOptions.attendance.before_session,
                                                    duration: parseInt(e.target.value) || 30
                                                  }
                                                }
                                              }
                                            });
                                          }}
                                        />
                                      </InputGroup>
                                      <Form.Text className="text-muted">
                                        Mặc định: 30 phút
                                      </Form.Text>
                                    </Form.Group>
                                  </Col>
                                </Row>
                                <Alert variant="info" className="mb-0">
                                  <i className="fas fa-info-circle me-2"></i>
                                  <small>Ví dụ: Nếu giờ bắt đầu buổi học là 16:00, cấu hình trên sẽ cho phép điểm danh từ 15:30 - 16:00</small>
                                </Alert>
                              </Card.Body>
                            </Card>
                          )}
                        </div>
                        
                        <div className="mb-4">
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <div>
                              <h6 className="mb-0">Điểm danh trong buổi học</h6>
                              <small className="text-muted">Điểm danh giữa giờ bắt đầu và giờ kết thúc</small>
                            </div>
                            <Form.Check 
                              type="switch"
                              id="attendance_during_session"
                              name="attendance_during_session"
                              checked={formData.monitoringOptions.attendance.during_session.enabled}
                              onChange={(e) => {
                                setFormData({
                                  ...formData,
                                  monitoringOptions: {
                                    ...formData.monitoringOptions,
                                    attendance: {
                                      ...formData.monitoringOptions.attendance,
                                      during_session: {
                                        ...formData.monitoringOptions.attendance.during_session,
                                        enabled: e.target.checked
                                      }
                                    }
                                  }
                                });
                              }}
                              label={formData.monitoringOptions.attendance.during_session.enabled ? "Đã bật" : "Đã tắt"}
                            />
                          </div>
                          
                          {formData.monitoringOptions.attendance.during_session.enabled && (
                            <Card className="bg-light border mb-4">
                              <Card.Body>
                                <Row>
                                  <Col md={6}>
                                    <Form.Group className="mb-3">
                                      <Form.Label>Bắt đầu sau giờ bắt đầu (phút)</Form.Label>
                                      <InputGroup>
                                        <InputGroup.Text><i className="fas fa-hourglass-half"></i></InputGroup.Text>
                                        <Form.Control
                                          type="number"
                                          min="0"
                                          max="300"
                                          value={formData.monitoringOptions.attendance.during_session.minutes_after_start}
                                          onChange={(e) => {
                                            setFormData({
                                              ...formData,
                                              monitoringOptions: {
                                                ...formData.monitoringOptions,
                                                attendance: {
                                                  ...formData.monitoringOptions.attendance,
                                                  during_session: {
                                                    ...formData.monitoringOptions.attendance.during_session,
                                                    minutes_after_start: parseInt(e.target.value) || 120
                                                  }
                                                }
                                              }
                                            });
                                          }}
                                        />
                                      </InputGroup>
                                      <Form.Text className="text-muted">
                                        Mặc định: 120 phút sau giờ bắt đầu
                                      </Form.Text>
                                    </Form.Group>
                                  </Col>
                                  <Col md={6}>
                                    <Form.Group className="mb-3">
                                      <Form.Label>Kết thúc trước giờ kết thúc (phút)</Form.Label>
                                      <InputGroup>
                                        <InputGroup.Text><i className="fas fa-hourglass-end"></i></InputGroup.Text>
                                        <Form.Control
                                          type="number"
                                          min="0"
                                          max="300"
                                          value={formData.monitoringOptions.attendance.during_session.minutes_before_end}
                                          onChange={(e) => {
                                            setFormData({
                                              ...formData,
                                              monitoringOptions: {
                                                ...formData.monitoringOptions,
                                                attendance: {
                                                  ...formData.monitoringOptions.attendance,
                                                  during_session: {
                                                    ...formData.monitoringOptions.attendance.during_session,
                                                    minutes_before_end: parseInt(e.target.value) || 120
                                                  }
                                                }
                                              }
                                            });
                                          }}
                                        />
                                      </InputGroup>
                                      <Form.Text className="text-muted">
                                        Mặc định: 120 phút trước giờ kết thúc
                                      </Form.Text>
                                    </Form.Group>
                                  </Col>
                                </Row>
                                <Alert variant="info" className="mb-0">
                                  <i className="fas fa-info-circle me-2"></i>
                                  <small>Ví dụ: Nếu giờ bắt đầu buổi học là 07:00 và giờ kết thúc là 17:00, cấu hình trên sẽ cho phép điểm danh từ 09:00 - 15:00</small>
                                </Alert>
                              </Card.Body>
                            </Card>
                          )}
                        </div>
                        
                        <div>
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <div>
                              <h6 className="mb-0">Điểm danh sau buổi học</h6>
                              <small className="text-muted">Điểm danh sau giờ kết thúc</small>
                            </div>
                            <Form.Check 
                              type="switch"
                              id="attendance_after_session"
                              name="attendance_after_session"
                              checked={formData.monitoringOptions.attendance.after_session.enabled}
                              onChange={(e) => {
                                setFormData({
                                  ...formData,
                                  monitoringOptions: {
                                    ...formData.monitoringOptions,
                                    attendance: {
                                      ...formData.monitoringOptions.attendance,
                                      after_session: {
                                        ...formData.monitoringOptions.attendance.after_session,
                                        enabled: e.target.checked
                                      }
                                    }
                                  }
                                });
                              }}
                              label={formData.monitoringOptions.attendance.after_session.enabled ? "Đã bật" : "Đã tắt"}
                            />
                          </div>
                          
                          {formData.monitoringOptions.attendance.after_session.enabled && (
                            <Card className="bg-light border">
                              <Card.Body>
                                <Row>
                                  <Col md={6}>
                                    <Form.Group className="mb-3">
                                      <Form.Label>Bắt đầu sau giờ kết thúc (phút)</Form.Label>
                                      <InputGroup>
                                        <InputGroup.Text><i className="fas fa-hourglass-end"></i></InputGroup.Text>
                                        <Form.Control
                                          type="number"
                                          min="0"
                                          max="120"
                                          value={formData.monitoringOptions.attendance.after_session.minutes_after}
                                          onChange={(e) => {
                                            setFormData({
                                              ...formData,
                                              monitoringOptions: {
                                                ...formData.monitoringOptions,
                                                attendance: {
                                                  ...formData.monitoringOptions.attendance,
                                                  after_session: {
                                                    ...formData.monitoringOptions.attendance.after_session,
                                                    minutes_after: parseInt(e.target.value) || 0
                                                  }
                                                }
                                              }
                                            });
                                          }}
                                        />
                                      </InputGroup>
                                      <Form.Text className="text-muted">
                                        Mặc định: 0 phút (ngay sau giờ kết thúc)
                                      </Form.Text>
                                    </Form.Group>
                                  </Col>
                                  <Col md={6}>
                                    <Form.Group className="mb-3">
                                      <Form.Label>Thời gian cho phép điểm danh (phút)</Form.Label>
                                      <InputGroup>
                                        <InputGroup.Text><i className="fas fa-clock"></i></InputGroup.Text>
                                        <Form.Control
                                          type="number"
                                          min="5"
                                          max="120"
                                          value={formData.monitoringOptions.attendance.after_session.duration}
                                          onChange={(e) => {
                                            setFormData({
                                              ...formData,
                                              monitoringOptions: {
                                                ...formData.monitoringOptions,
                                                attendance: {
                                                  ...formData.monitoringOptions.attendance,
                                                  after_session: {
                                                    ...formData.monitoringOptions.attendance.after_session,
                                                    duration: parseInt(e.target.value) || 30
                                                  }
                                                }
                                              }
                                            });
                                          }}
                                        />
                                      </InputGroup>
                                      <Form.Text className="text-muted">
                                        Mặc định: 60 phút
                                      </Form.Text>
                                    </Form.Group>
                                  </Col>
                                </Row>
                                <Alert variant="info" className="mb-0">
                                  <i className="fas fa-info-circle me-2"></i>
                                  <small>Ví dụ: Nếu giờ kết thúc buổi học là 19:00, cấu hình trên sẽ cho phép điểm danh từ 19:00 - 20:00</small>
                                </Alert>
                              </Card.Body>
                            </Card>
                          )}
                        </div>
                      </Card.Body>
                    </Card>
                  </Tab>
                </Tabs>
              </Card.Body>
            </Card>
          </Tab>
        </Tabs>
      </Form>
    </div>
  );
};

export default EditSession;
