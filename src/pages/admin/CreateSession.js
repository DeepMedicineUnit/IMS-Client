import React, { useState, useEffect } from 'react';
import { Form, Button, Card, Row, Col, Alert, Table, Tabs, Tab, Badge, InputGroup, ListGroup, OverlayTrigger, Tooltip, Modal } from 'react-bootstrap';
import { v4 as uuidv4 } from 'uuid';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';
import MapPreview from '../../components/MapPreview';

// Helper to format date as YYYY-MM-DD
const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Function to get the next Monday (or today if it's Monday)
const getNextMonday = () => {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  
  if (dayOfWeek === 1) {
    // Today is Monday, return today
    return formatDate(today);
  } else {
    // Calculate days until next Monday
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek; // If Sunday (0), next Monday is tomorrow (1 day)
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilMonday);
    return formatDate(nextMonday);
  }
};
const today = new Date().toISOString().split('T')[0];

const CreateSession = () => {
  const navigate = useNavigate();
  const location = useLocation();
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
    { name: "Bệnh viện Tâm Trí Cao Lãnh", latitude: 10.465413477175426, longitude: 10.465413477175426 },
    { name: "Bệnh viện ĐH Y Khoa Phan Châu Trinh", latitude: 15.96252601077044, longitude: 108.25985382432913 },
    { name: "Bệnh viện TEST", latitude: 15.962683045139078, longitude: 108.25037464216163 }
  ];
  
  // Fetch students and filter options on component mount
  useEffect(() => {
    const fetchStudents = async () => {
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
          setStudents(response.data.data);
          setTotalStudents(response.data.pagination.totalItems);
        } else {
          toast.error('Không thể tải danh sách sinh viên');
        }
      } catch (error) {
        console.error('Error fetching students:', error);
        toast.error('Đã xảy ra lỗi khi tải danh sách sinh viên');
      }
    };
    
    const fetchFilterOptions = async () => {
      try {
        const response = await api.get('/users/filter-options');
        if (response.data.success) {
          setClasses(response.data.classes.map(c => c.name));
          setFaculties(response.data.faculties.map(f => f.name));
          setMajors(response.data.majors.map(m => m.name));
        } else {
          toast.error('Không thể tải danh sách lớp/khoa/ngành');
        }
      } catch (error) {
        console.error('Error fetching filter options:', error);
        toast.error('Đã xảy ra lỗi khi tải danh sách lớp/khoa/ngành');
      }
    };
    
    fetchStudents();
    fetchFilterOptions();
  }, [api, classFilter, facultyFilter, majorFilter, statusFilter, sortField, sortOrder, currentPage, pageSize]);
  
  const [batchMode, setBatchMode] = useState(false);
  const [bulkAddMode, setBulkAddMode] = useState(false);
  const [sessionBatch, setSessionBatch] = useState([]);
  const [customSettings, setCustomSettings] = useState({});  // Tracks which sessions have custom settings
  const [previewDates, setPreviewDates] = useState([]);
  const [currentEditSessionId, setCurrentEditSessionId] = useState(null);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [tempSelectedStudents, setTempSelectedStudents] = useState([]);
  const [tempTimeSettings, setTempTimeSettings] = useState({
    startTime: '',
    endTime: ''
  });
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);
  const [tempDescription, setTempDescription] = useState('');
  const [showNameModal, setShowNameModal] = useState(false);
  const [tempName, setTempName] = useState('');
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [tempLocation, setTempLocation] = useState('');
  const [tempLocationIndex, setTempLocationIndex] = useState(0);
  const [showMonitoringModal, setShowMonitoringModal] = useState(false);
  const [tempMonitoringOptions, setTempMonitoringOptions] = useState(null);
  const [sharedSettings, setSharedSettings] = useState({
    name: true,
    description: true,
    time: true,
    location: true,
    students: true, // Default is shared student participation
    monitoring: true
  });
  
  // Recurring session settings
  const [recurringSettings, setRecurringSettings] = useState({
    selectedDays: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: true,
      sunday: false
    },
    weeks: 1,
    startDate: getNextMonday() // Automatically set to next Monday
  });
  
  // Get date from URL parameter
  const getDateFromURL = () => {
    const searchParams = new URLSearchParams(location.search);
    const dateParam = searchParams.get('date');
    return dateParam || today;
  };

  const [formData, setFormData] = useState({
    name: '',
    date: getDateFromURL(),
    startTime: '07:00',
    endTime: '17:00',
    location: '',
    description: '',
    studentIds: [],
    monitoringOptions: {
      location: {
        enabled: true,
        interval: 120,
        accuracy: "high",
        required: true,
        enforcement: 'immediate',
        geofence: {
          enabled: true, // Mặc định bật giới hạn vị trí
          radius: 50,
          coordinates: {
            latitude: null,
            longitude: null
          },
          alertOnExit: true, // Mặc định bật cảnh báo
          alertEmail: 'daotao1@pctu.edu.vn' // Mặc định email nhận thông báo
        }
      },
      file_upload: {
        enabled: true,
        max_size: 50,
        allowed_types: ["image/*", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
        required: true, // Mặc định bắt buộc tải lên tệp tin
        min_files: 1 // Mặc định bắt buộc tải lên ít nhất 1 tệp tin
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
  
  const [validated, setValidated] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    } else if (name.startsWith('shared_')) {
      // Handle shared settings toggles
      const setting = name.split('_')[1];
      
      // Update shared settings
      setSharedSettings({
        ...sharedSettings,
        [setting]: checked
      });
      
      // Special handling for shared students toggle
      if (setting === 'students' && !checked) {
        // When turning off shared students, initialize custom settings for all sessions
        // This ensures each session will use its own student list
        const updatedCustomSettings = { ...customSettings };
        
        sessionBatch.forEach(session => {
          if (!updatedCustomSettings[session.id]) {
            updatedCustomSettings[session.id] = {};
          }
          // Mark each session to use its own students (not shared)
          updatedCustomSettings[session.id].students = true;
        });
        
        setCustomSettings(updatedCustomSettings);
      }
    } else {
      // Handle other form fields
      setFormData({
        ...formData,
        [name]: value
      });
      
      // Automatically add session to batch when date is selected and not in bulk mode
      if (name === 'date' && value && formData.name && !bulkAddMode && batchMode) {
        // Use setTimeout to ensure formData is updated before calling addSessionToBatch
        setTimeout(() => {
          addSessionToBatch();
        }, 100);
      }
    }
  };

  const addSessionToBatch = () => {
    // Validate required fields for a session
    if (!formData.name || !formData.date) {
      toast.error('Vui lòng nhập tên và ngày cho buổi học');
      return;
    }

    const newSession = {
      id: uuidv4(), // Generate unique ID for the session in the batch
      name: formData.name,
      date: formData.date,
      description: formData.description,
      startTime: formData.startTime,
      endTime: formData.endTime,
      location: formData.location,
      students: sharedSettings.students ? [...selectedStudents] : [],
      monitoringOptions: {...formData.monitoringOptions}
    };
    
    // If shared students is turned off, mark this session to use its own students
    if (!sharedSettings.students) {
      setCustomSettings(prev => ({
        ...prev,
        [newSession.id]: {
          ...(prev[newSession.id] || {}),
          students: true
        }
      }));
    }

    setSessionBatch([...sessionBatch, newSession]);
    
    // Clear name and date fields for next session
    setFormData({
      ...formData,
      name: '',
      date: ''
    });
    
    toast.success(`Đã thêm buổi học "${newSession.name}" vào danh sách`);
  };

  const removeSessionFromBatch = (sessionId) => {
    setSessionBatch(sessionBatch.filter(session => session.id !== sessionId));
    toast.info('Đã xóa buổi học khỏi danh sách');
  };

  const editSessionInBatch = (session) => {
    // Set form data to the selected session for editing
    setFormData({
      name: session.name,
      date: session.date,
      description: session.description || '',
      startTime: session.startTime || '',
      endTime: session.endTime || '',
      location: session.location || '',
      monitoringOptions: session.monitoringOptions || formData.monitoringOptions
    });
    
    // If session has custom students, set them
    if (session.students && session.students.length > 0) {
      setSelectedStudents(session.students);
    }
    
    // Create a copy of the session for editing without removing it
    const sessionToEdit = { ...session };
    toast.info(`Đang chỉnh sửa buổi học ngày ${session.date}`);
  };
  
  // Function to edit students for a specific session
  const editStudentsForSession = (session) => {
    setCurrentEditSessionId(session.id);
    setTempSelectedStudents(session.students || []);
    setShowStudentModal(true);
  };
  
  // Function to save edited students for a session
  const saveSessionStudents = () => {
    if (!currentEditSessionId) return;
    
    // Update the session in the batch with new students
    const updatedBatch = sessionBatch.map(session => {
      if (session.id === currentEditSessionId) {
        return {
          ...session,
          students: [...tempSelectedStudents]
        };
      }
      return session;
    });
    
    setSessionBatch(updatedBatch);
    setShowStudentModal(false);
    setCurrentEditSessionId(null);
    toast.success('Đã cập nhật danh sách sinh viên cho buổi học');
  };
  
  // Function to edit time settings for a specific session
  const editSessionTime = (session) => {
    setCurrentEditSessionId(session.id);
    setTempTimeSettings({
      startTime: session.startTime || '',
      endTime: session.endTime || ''
    });
    setShowTimeModal(true);
  };
  
  // Function to save edited time settings for a session
  const saveSessionTime = () => {
    if (!currentEditSessionId) return;
    
    // Validate time settings
    if (!tempTimeSettings.startTime || !tempTimeSettings.endTime) {
      toast.error('Vui lòng nhập đầy đủ giờ bắt đầu và giờ kết thúc');
      return;
    }
    
    // Update the session in the batch with new time settings
    const updatedBatch = sessionBatch.map(session => {
      if (session.id === currentEditSessionId) {
        return {
          ...session,
          startTime: tempTimeSettings.startTime,
          endTime: tempTimeSettings.endTime
        };
      }
      return session;
    });
    
    setSessionBatch(updatedBatch);
    setShowTimeModal(false);
    setCurrentEditSessionId(null);
    toast.success('Đã cập nhật thời gian cho buổi học');
  };
  
  // Function to edit description for a specific session
  // Function to handle editing session name
  const handleEditSessionName = (session) => {
    setCurrentEditSessionId(session.id);
    setTempName(session.name || '');
    setShowNameModal(true);
  };
  
  // Function to save edited session name
  const saveSessionName = () => {
    if (!currentEditSessionId || !tempName.trim()) return;
    
    // Update the session in the batch with new name
    const updatedBatch = sessionBatch.map(session => {
      if (session.id === currentEditSessionId) {
        return {
          ...session,
          name: tempName.trim()
        };
      }
      return session;
    });
    
    setSessionBatch(updatedBatch);
    setShowNameModal(false);
    setCurrentEditSessionId(null);
    toast.success('Đã cập nhật tên buổi học');
  };

  const editSessionDescription = (session) => {
    setCurrentEditSessionId(session.id);
    setTempDescription(session.description || '');
    setShowDescriptionModal(true);
  };
  
  // Function to save edited description for a session
  const saveSessionDescription = () => {
    if (!currentEditSessionId) return;
    
    // Update the session in the batch with new description
    const updatedBatch = sessionBatch.map(session => {
      if (session.id === currentEditSessionId) {
        return {
          ...session,
          description: tempDescription
        };
      }
      return session;
    });
    
    setSessionBatch(updatedBatch);
    setShowDescriptionModal(false);
    setCurrentEditSessionId(null);
    toast.success('Đã cập nhật mô tả cho buổi học');
  };
  
  // Function to edit location for a specific session
  const editSessionLocation = (session) => {
    setCurrentEditSessionId(session.id);
    setTempLocation(session.location || '');
    
    // Find location index if it's a predefined location
    const locationIndex = predefinedLocations.findIndex(loc => loc.name === session.location);
    setTempLocationIndex(locationIndex !== -1 ? locationIndex : 0);
    
    setShowLocationModal(true);
  };
  
  // Function to save edited location for a session
  const saveSessionLocation = () => {
    if (!currentEditSessionId) return;
    
    // Update the session in the batch with new location
    const updatedBatch = sessionBatch.map(session => {
      if (session.id === currentEditSessionId) {
        // If a predefined location is selected, also update geofence coordinates
        if (tempLocationIndex > 0) {
          const selectedLocation = predefinedLocations[tempLocationIndex];
          return {
            ...session,
            location: selectedLocation.name,
            monitoringOptions: {
              ...session.monitoringOptions,
              location: {
                ...session.monitoringOptions.location,
                geofence: {
                  ...session.monitoringOptions.location.geofence,
                  coordinates: {
                    latitude: selectedLocation.latitude,
                    longitude: selectedLocation.longitude
                  }
                }
              }
            }
          };
        } else {
          // Custom location
          return {
            ...session,
            location: tempLocation
          };
        }
      }
      return session;
    });
    
    setSessionBatch(updatedBatch);
    setShowLocationModal(false);
    setCurrentEditSessionId(null);
    toast.success('Đã cập nhật địa điểm cho buổi học');
  };
  
  // Function to edit monitoring options for a specific session
  const editSessionMonitoring = (session) => {
    setCurrentEditSessionId(session.id);
    
    // Ensure default values for coordinates in location monitoring
    const monitoringOptions = JSON.parse(JSON.stringify(session.monitoringOptions || formData.monitoringOptions));
    
    // Set default coordinates if not present
    if (!monitoringOptions.location) {
      monitoringOptions.location = {};
    }
    
    if (!monitoringOptions.location.coordinates) {
      // Use location from session if available, otherwise use default coordinates
      if (session.location && predefinedLocations) {
        // Try to find the location in predefined locations
        const foundLocation = predefinedLocations.find(loc => loc.name === session.location);
        if (foundLocation) {
          monitoringOptions.location.coordinates = {
            latitude: foundLocation.latitude,
            longitude: foundLocation.longitude
          };
          monitoringOptions.location.predefinedLocationIndex = predefinedLocations.indexOf(foundLocation);
        }
      }
      
      // If still no coordinates, use default
      if (!monitoringOptions.location.coordinates) {
        monitoringOptions.location.coordinates = {
          latitude: 10.762622,
          longitude: 106.660172
        };
      }
    }
    
    // Ensure geofence has coordinates too
    if (!monitoringOptions.location.geofence) {
      monitoringOptions.location.geofence = {};
    }
    
    if (!monitoringOptions.location.geofence.coordinates) {
      monitoringOptions.location.geofence.coordinates = {...monitoringOptions.location.coordinates};
    }
    
    setTempMonitoringOptions(monitoringOptions);
    setShowMonitoringModal(true);
    
    // Force modal to recalculate map size after a short delay
    setTimeout(() => {
      const mapContainers = document.querySelectorAll('.map-container');
      if (mapContainers.length > 0) {
        const event = new Event('resize');
        window.dispatchEvent(event);
      }
    }, 500);
  };
  
  // Function to save edited monitoring options for a session
  const saveSessionMonitoring = () => {
    if (!currentEditSessionId) return;
    
    // Update the session in the batch with new monitoring options
    const updatedBatch = sessionBatch.map(session => {
      if (session.id === currentEditSessionId) {
        return {
          ...session,
          monitoringOptions: tempMonitoringOptions
        };
      }
      return session;
    });
    
    setSessionBatch(updatedBatch);
    setShowMonitoringModal(false);
    setCurrentEditSessionId(null);
    toast.success('Đã cập nhật tùy chọn giám sát cho buổi học');
  };
  
  // Handle monitoring options changes in modal
  const handleMonitoringChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.startsWith('monitoring_')) {
      // Handle monitoring options
      const [prefix, option, property] = name.split('_');
      
      if (property) {
        // Handle nested properties (like interval, duration, etc.)
        setTempMonitoringOptions({
          ...tempMonitoringOptions,
          [option]: {
            ...tempMonitoringOptions[option],
            [property]: type === 'checkbox' ? checked : value
          }
        });
      } else {
        // Handle enabled/disabled toggles
        setTempMonitoringOptions({
          ...tempMonitoringOptions,
          [option]: {
            ...tempMonitoringOptions[option],
            enabled: checked
          }
        });
      }
    }
  };
  
  // Handler for recurring settings changes
  const handleRecurringChange = (e) => {
    const { name, value, checked, type } = e.target;
    
    if (name.startsWith('day_')) {
      // Handle day selection changes
      const day = name.split('_')[1];
      setRecurringSettings({
        ...recurringSettings,
        selectedDays: {
          ...recurringSettings.selectedDays,
          [day]: checked
        }
      });
    } else {
      // Handle other recurring settings
      setRecurringSettings({
        ...recurringSettings,
        [name]: type === 'checkbox' ? checked : value
      });
    }
  };
  
  // Function to get all dates for selected days in the specified weeks
  const generateDates = (updatePreview = false) => {
    if (!recurringSettings.startDate) {
      if (!updatePreview) toast.error('Vui lòng chọn ngày bắt đầu');
      return [];
    }
    
    const startDate = new Date(recurringSettings.startDate);
    const weeks = parseInt(recurringSettings.weeks) || 1;
    const selectedDays = recurringSettings.selectedDays;
    
    // Map day names to their corresponding numbers (0 = Sunday, 1 = Monday, etc.)
    const dayMapping = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6
    };
    
    // Get all selected days as numbers
    const selectedDayNumbers = Object.entries(selectedDays)
      .filter(([day, isSelected]) => isSelected)
      .map(([day]) => dayMapping[day]);
    
    if (selectedDayNumbers.length === 0) {
      if (!updatePreview) toast.error('Vui lòng chọn ít nhất một ngày trong tuần');
      return [];
    }
    
    // Validate that start date is one of the selected days
    const startDayOfWeek = startDate.getDay();
    if (!selectedDayNumbers.includes(startDayOfWeek)) {
      if (!updatePreview) toast.error('Ngày bắt đầu phải trùng với một trong các ngày được chọn trong tuần');
      return [];
    }
    
    // Generate all dates
    const dates = [];
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + (weeks * 7) - 1); // -1 because we include the start date
    
    const currentDate = new Date(startDate);
    
    // Add start date if it's one of the selected days
    if (selectedDayNumbers.includes(currentDate.getDay())) {
      dates.push(formatDate(currentDate));
    }
    
    // Loop through days until we reach end date
    while (currentDate < endDate) {
      currentDate.setDate(currentDate.getDate() + 1);
      if (selectedDayNumbers.includes(currentDate.getDay())) {
        dates.push(formatDate(currentDate));
      }
    }
    
    if (updatePreview) {
      setPreviewDates(dates);
    }
    
    return dates;
  };
  
  // Update preview dates whenever recurring settings change
  useEffect(() => {
    if (bulkAddMode) {
      generateDates(true);
    }
  }, [recurringSettings.startDate, recurringSettings.weeks, 
      recurringSettings.selectedDays.monday, recurringSettings.selectedDays.tuesday,
      recurringSettings.selectedDays.wednesday, recurringSettings.selectedDays.thursday,
      recurringSettings.selectedDays.friday, recurringSettings.selectedDays.saturday,
      recurringSettings.selectedDays.sunday, bulkAddMode]);
      
  // Auto-update the start date when bulk add mode is enabled
  useEffect(() => {
    if (bulkAddMode) {
      setRecurringSettings(prev => ({
        ...prev,
        startDate: getNextMonday()
      }));
    }
  }, [bulkAddMode]);
  

  
  // Function to add recurring sessions
  const addRecurringSessions = () => {
    if (!formData.name) {
      toast.error('Vui lòng nhập tên buổi học');
      return;
    }
    
    // Generate dates based on recurring settings
    const dates = generateDates();
    
    if (dates.length === 0) {
      return; // Error messages shown in generateDates
    }
    
    // Create a session for each date
    const newSessions = dates.map(date => ({
      id: uuidv4(),
      name: formData.name,
      date,
      description: formData.description,
      startTime: formData.startTime,
      endTime: formData.endTime,
      location: formData.location,
      students: sharedSettings.students ? selectedStudents.map(student => ({ ...student })) : [], // Use shared students only if enabled
      monitoringOptions: {...formData.monitoringOptions}
    }));
    
    // If shared students is turned off, mark all new sessions to use their own students
    if (!sharedSettings.students) {
      const updatedCustomSettings = { ...customSettings };
      newSessions.forEach(session => {
        updatedCustomSettings[session.id] = {
          ...(updatedCustomSettings[session.id] || {}),
          students: true
        };
      });
      setCustomSettings(updatedCustomSettings);
    }
    
    // Add all sessions to batch
    setSessionBatch([...sessionBatch, ...newSessions]);
    
    toast.success(`Đã thêm ${newSessions.length} buổi học vào danh sách`);
    
    // Reset name for next batch
    setFormData({
      ...formData,
      name: ''
    });
    
    // Close bulk add mode
    setBulkAddMode(false);
  };

  // Function to update an existing session in the batch
  const updateSessionInBatch = () => {
    // Check if we have the necessary information
    if (!formData.name || !formData.date) {
      toast.error('Vui lòng nhập đầy đủ thông tin cần thiết');
      return;
    }
    
    // Find the session with the same date as the current formData
    const sessionIndex = sessionBatch.findIndex(session => session.date === formData.date);
    
    if (sessionIndex === -1) {
      // If no session with this date exists, add a new one
      addSessionToBatch();
      return;
    }
    
    // Update the existing session
    const updatedBatch = [...sessionBatch];
    updatedBatch[sessionIndex] = {
      ...updatedBatch[sessionIndex],
      name: formData.name,
      description: formData.description,
      startTime: formData.startTime,
      endTime: formData.endTime,
      location: formData.location,
      monitoringOptions: formData.monitoringOptions
    };
    
    // If shared students is enabled, update the students as well
    if (sharedSettings.students) {
      updatedBatch[sessionIndex].students = selectedStudents.map(student => ({ ...student }));
    }
    
    setSessionBatch(updatedBatch);
    toast.success(`Đã cập nhật buổi học ngày ${formData.date}`);
    
    // Reset form for next session
    setFormData({
      ...formData,
      name: '',
      date: ''
    });
  };

  // Function to toggle custom setting for an individual session
  const toggleCustomSetting = (sessionId, settingType) => {
    setCustomSettings(prevSettings => {
      const sessionSettings = prevSettings[sessionId] || {};
      
      // Create updated settings object
      const updatedSettings = {
        ...prevSettings,
        [sessionId]: {
          ...sessionSettings,
          [settingType]: !sessionSettings[settingType]
        }
      };
      
      return updatedSettings;
    });
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
    setLoading(true);
    setError('');
    
    try {
      if (batchMode && sessionBatch.length === 0) {
        toast.error('Vui lòng thêm ít nhất một buổi học vào danh sách');
        setLoading(false);
        return;
      }
      
      if (batchMode) {
        // Validate time values for all sessions before submitting
        const invalidTimeSessions = sessionBatch.filter(session => {
          const useSharedTime = sharedSettings.time && !(customSettings[session.id]?.time);
          const startTime = useSharedTime ? formData.startTime : session.startTime;
          const endTime = useSharedTime ? formData.endTime : session.endTime;
          
          return !startTime || !endTime || startTime === "" || endTime === "";
        });
        
        if (invalidTimeSessions.length > 0) {
          const dates = invalidTimeSessions.map(s => s.date).join(", ");
          toast.error(`Một số buổi học chưa có thời gian bắt đầu hoặc kết thúc: ${dates}`);
          setLoading(false);
          return;
        }
        
        // Prepare batch data for API
        const batchData = {
          sessions: sessionBatch.map(session => {
            const title = sharedSettings.name && !(customSettings[session.id]?.name) && formData.name && formData.name.trim()
              ? formData.name
              : session.name;
            
            console.log('Frontend Debug - session.id:', session.id);
            console.log('Frontend Debug - sharedSettings.name:', sharedSettings.name);
            console.log('Frontend Debug - customSettings[session.id]?.name:', customSettings[session.id]?.name);
            console.log('Frontend Debug - formData.name:', formData.name);
            console.log('Frontend Debug - session.name:', session.name);
            console.log('Frontend Debug - final title:', title);
            
            return {
              title: title,
              description: sharedSettings.description && !(customSettings[session.id]?.description) 
                ? formData.description 
                : session.description || '',
              date: session.date,
              startTime: sharedSettings.time && !(customSettings[session.id]?.time)
                ? formData.startTime 
                : session.startTime,
              endTime: sharedSettings.time && !(customSettings[session.id]?.time)
                ? formData.endTime 
                : session.endTime,
              location: sharedSettings.location && !(customSettings[session.id]?.location)
                ? formData.location 
                : session.location,
              studentIds: sharedSettings.students && !(customSettings[session.id]?.students)
                ? selectedStudents.map(student => student.id).filter(id => id)
                : (session.students || []).map(student => student.id).filter(id => id),
              monitoringOptions: sharedSettings.monitoring && !(customSettings[session.id]?.monitoring)
                ? formData.monitoringOptions 
                : session.monitoringOptions
            };
          }),
          sharedSettings
        };
        
        // Log the data being sent to help with debugging
        console.log('Sending batch data:', JSON.stringify(batchData));
        
        // Call API to create batch sessions
        const response = await api.post('/sessions/batch', batchData);
        
        if (response.data.success) {
          // Get the newly created session IDs if available
          const newSessionIds = response.data.data?.sessions?.map(s => s.id) || [];
          
          if (newSessionIds.length > 0) {
            // Generate shared QR codes for each session in the background
            // We don't wait for these to complete to avoid delaying the user
            Promise.allSettled(
              newSessionIds.map(sessionId => 
                api.post(`/sessions/${sessionId}/shared-qr-code`)
                  .catch(err => console.error(`Error generating QR code for session ${sessionId}:`, err))
              )
            ).then(results => {
              const successCount = results.filter(r => r.status === 'fulfilled').length;
              console.log(`Generated ${successCount}/${newSessionIds.length} shared QR codes`);
            });
            
            toast.success(`Tạo ${batchData.sessions.length} buổi học thành công với mã QR dùng chung`);
          } else {
            toast.success(`Tạo ${batchData.sessions.length} buổi học thành công`);
          }
          
          navigate('/admin/sessions');
        } else {
          setError(response.data.message || 'Không thể tạo buổi học');
        }
      } else {
        // Single session creation (original logic)
        // Validate date format (YYYY-MM-DD)
        if (formData.date && !/^\d{4}-\d{2}-\d{2}$/.test(formData.date)) {
          toast.error('Định dạng ngày không hợp lệ. Vui lòng sử dụng định dạng YYYY-MM-DD.');
          setLoading(false);
          return;
        }
        
        // Prepare session data for API
        const sessionData = {
          title: formData.name,
          description: formData.description,
          studentIds: selectedStudents.map(student => student.id).filter(id => id), // Filter out any null or undefined IDs
          date: formData.date, // Use date directly without any Date object conversion
          startTime: formData.startTime,
          endTime: formData.endTime,
          location: formData.location,
          monitoringOptions: formData.monitoringOptions
        };
        
        // Log the data being sent to help with debugging
        console.log('Sending session data:', JSON.stringify(sessionData));
        
        // Add password if provided
        if (formData.password) {
          sessionData.password = formData.password;
        }
        
        // Call API to create session
        const response = await api.post('/sessions', sessionData);
        
        if (response.data.success) {
          // Get the newly created session ID
          const newSessionId = response.data.data.id;
          
          try {
            // Generate shared QR code automatically
            await api.post(`/sessions/${newSessionId}/shared-qr-code`);
            toast.success('Tạo buổi học và mã QR dùng chung thành công');
          } catch (qrError) {
            console.error('Error generating shared QR code:', qrError);
            toast.success('Tạo buổi học thành công, nhưng không thể tạo mã QR dùng chung');
          }
          
          navigate('/admin/sessions');
        } else {
          setError(response.data.message || 'Không thể tạo buổi học');
        }
      }
          } catch (err) {
      const errorMessage = err.response?.data?.message || 'Có lỗi xảy ra khi tạo buổi học. Vui lòng thử lại sau.';
      const serverError = err.response?.data?.error || '';
      setError(`${errorMessage}${serverError ? '\n\nLỗi chi tiết: ' + serverError : ''}`);
      console.error('Error creating session:', err);
      console.error('Error details:', err.response?.data);
    } finally {
      setLoading(false);
    }
  };

      return (
      <>
        <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="m-0 fw-bold">Tạo buổi học lâm sàng mới</h2>
          <div className="form-check form-switch mt-1">
            <input
              className="form-check-input"
              type="checkbox"
              id="batchModeToggle"
              checked={batchMode}
              onChange={() => {
                setBatchMode(!batchMode);
                if (!batchMode) {
                  // Automatically activate bulk add mode when batch mode is enabled
                  setBulkAddMode(true);
                  // Set default values for batch creation if needed
                  if (!recurringSettings.startDate) {
                    setRecurringSettings(prev => ({
                      ...prev,
                      startDate: getNextMonday()
                    }));
                  }
                }
              }}
            />
            <label className="form-check-label fw-medium" htmlFor="batchModeToggle">
              Tạo hàng loạt buổi học
            </label>
          </div>
        </div>
        <div>
          <button 
            className="btn-modern me-2"
            style={{ backgroundColor: '#6c757d' }}
            onClick={() => navigate('/admin/sessions')}
            disabled={loading}
          >
            <i className="fas fa-times me-1"></i> Hủy
          </button>
          {batchMode ? (
            <>
              {!bulkAddMode && (
                <button 
                  className="btn-modern me-2"
                  style={{ backgroundColor: '#17a2b8' }}
                  onClick={updateSessionInBatch}
                  disabled={loading || !formData.name || !formData.date}
                >
                  <i className="fas fa-sync me-1"></i> Cập nhật buổi học
                </button>
              )}
              
              <button 
                type="submit" 
                className="btn-modern"
                disabled={loading || sessionBatch.length === 0}
                onClick={handleSubmit}
              >
                {loading ? <><i className="fas fa-spinner fa-spin me-1"></i> Đang tạo...</> : <><i className="fas fa-save me-1"></i> Tạo {sessionBatch.length} buổi học</>}
              </button>
            </>
          ) : (
            <button 
              type="submit" 
              className="btn-modern"
              disabled={loading}
              onClick={handleSubmit}
            >
              {loading ? <><i className="fas fa-spinner fa-spin me-1"></i> Đang tạo...</> : <><i className="fas fa-save me-1"></i> Tạo buổi học</>}
            </button>
          )}
        </div>
      </div>
      
      {error && <div className="modern-alert modern-alert-danger"><i className="fas fa-exclamation-triangle me-2"></i>{error}</div>}
      
      {batchMode && bulkAddMode && (
        <div className="modern-card mb-4 shadow-sm">
          <div className="card-header bg-info text-white d-flex justify-content-between align-items-center">
            <h5 className="m-0 fw-bold"><i className="fas fa-calendar-alt me-2"></i>Tạo hàng loạt buổi học</h5>
            <button 
              className="btn-modern" 
              onClick={addRecurringSessions}
              disabled={loading || !formData.name}
            >
              <i className="fas fa-plus me-1"></i> Tạo nhiều buổi học
            </button>
          </div>
          <div className="card-body">
            <Tabs defaultActiveKey="basic" id="batch-session-tabs" className="custom-tabs mb-3">
              <Tab eventKey="basic" title={
                <span className="tab-title">
                  <i className="fas fa-info-circle"></i>
                  Thông tin cơ bản
                </span>
              }>
                <Row className="mb-3">
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="modern-form-label fw-bold">Tên buổi học</Form.Label>
                      <InputGroup>
                        <InputGroup.Text><i className="fas fa-chalkboard-teacher"></i></InputGroup.Text>
                        <Form.Control
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          required
                          placeholder="Nhập tên buổi học"
                          className="modern-form-control"
                        />
                      </InputGroup>
                      <Form.Text className="text-muted">
                        Tên sẽ được áp dụng cho tất cả các buổi học trong chuỗi
                      </Form.Text>
                    </Form.Group>
                    </Col>

                    <Col md={6}>
                    <Form.Group className="mb-3">
                    <Form.Label className="modern-form-label fw-bold">Mô tả</Form.Label>
                     <Form.Control
                    as="textarea"
                    rows={3}
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Nhập mô tả buổi học (không bắt buộc)"
                    className="modern-form-control"
                    />
                   </Form.Group>
                   </Col>
                </Row>

            <Row className="mb-3">
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label className="modern-form-label fw-bold">Giờ bắt đầu</Form.Label>
                  <InputGroup>
                    <InputGroup.Text><i className="fas fa-clock"></i></InputGroup.Text>
                    <Form.Control
                      type="time"
                      name="startTime"
                      value={formData.startTime}
                      onChange={handleChange}
                      required
                      className="modern-form-control"
                    />
                  </InputGroup>
                  <Form.Control.Feedback type="invalid">
                    Vui lòng chọn giờ bắt đầu.
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
              
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label className="modern-form-label fw-bold">Giờ kết thúc</Form.Label>
                  <InputGroup>
                    <InputGroup.Text><i className="fas fa-clock"></i></InputGroup.Text>
                    <Form.Control
                      type="time"
                      name="endTime"
                      value={formData.endTime}
                      onChange={handleChange}
                      required
                      className="modern-form-control"
                    />
                  </InputGroup>
                  <Form.Control.Feedback type="invalid">
                    Vui lòng chọn giờ kết thúc.
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
            </Row>
            <Form.Group className="mb-3">
                  <Form.Label className="modern-form-label fw-bold">Địa điểm</Form.Label>
                  <InputGroup>
                    <InputGroup.Text><i className="fas fa-map-marker-alt"></i></InputGroup.Text>
                    <Form.Select
                      value={formData.location}
                      className="modern-form-control"
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
                  
                  {(formData.location === "" || formData.location === "custom") && (
                    <Form.Control
                      type="text"
                      name="location"
                      value={formData.location}
                      onChange={handleChange}
                      required
                      placeholder="Nhập địa điểm buổi học"
                      className="mt-2 modern-form-control"
                    />
                  )}
                  

                  
                  <Form.Control.Feedback type="invalid">
                    Vui lòng chọn hoặc nhập địa điểm buổi học.
                  </Form.Control.Feedback>
                </Form.Group>

                <Row className="mb-3">
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="modern-form-label fw-bold">Ngày bắt đầu</Form.Label>
                      <InputGroup>
                        <InputGroup.Text><i className="fas fa-calendar-day"></i></InputGroup.Text>
                        <Form.Control
                          type="date"
                          name="startDate"
                          value={recurringSettings.startDate}
                          onChange={handleRecurringChange}
                          required
                        />
                      </InputGroup>
                      <Form.Text className="text-muted">
                        Phải trùng với một trong các ngày được chọn bên dưới.
                        <span className="text-success ms-1">
                          <i className="fas fa-info-circle me-1"></i>
                          Đã tự động thiết lập thành thứ Hai tiếp theo
                        </span>
                      </Form.Text>
                    </Form.Group>
                  </Col>
                  
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label className="modern-form-label fw-bold">Số tuần</Form.Label>
                      <InputGroup>
                        <InputGroup.Text><i className="fas fa-calendar-week"></i></InputGroup.Text>
                        <Form.Control
                          type="number"
                          name="weeks"
                          value={recurringSettings.weeks}
                          onChange={handleRecurringChange}
                          min="1"
                          max="52"
                          required
                        />
                      </InputGroup>
                    </Form.Group>
                  </Col>
                </Row>
                
                <Form.Group className="mb-3">
                  <Form.Label className="modern-form-label fw-bold">Chọn các ngày trong tuần</Form.Label>
                  <div className="d-flex flex-wrap">
                <Form.Check
                  type="checkbox"
                  id="day_monday"
                  name="day_monday"
                  label="Thứ 2"
                  className="me-4 mb-2"
                  checked={recurringSettings.selectedDays.monday}
                  onChange={handleRecurringChange}
                />
                <Form.Check
                  type="checkbox"
                  id="day_tuesday"
                  name="day_tuesday"
                  label="Thứ 3"
                  className="me-4 mb-2"
                  checked={recurringSettings.selectedDays.tuesday}
                  onChange={handleRecurringChange}
                />
                <Form.Check
                  type="checkbox"
                  id="day_wednesday"
                  name="day_wednesday"
                  label="Thứ 4"
                  className="me-4 mb-2"
                  checked={recurringSettings.selectedDays.wednesday}
                  onChange={handleRecurringChange}
                />
                <Form.Check
                  type="checkbox"
                  id="day_thursday"
                  name="day_thursday"
                  label="Thứ 5"
                  className="me-4 mb-2"
                  checked={recurringSettings.selectedDays.thursday}
                  onChange={handleRecurringChange}
                />
                <Form.Check
                  type="checkbox"
                  id="day_friday"
                  name="day_friday"
                  label="Thứ 6"
                  className="me-4 mb-2"
                  checked={recurringSettings.selectedDays.friday}
                  onChange={handleRecurringChange}
                />
                <Form.Check
                  type="checkbox"
                  id="day_saturday"
                  name="day_saturday"
                  label="Thứ 7"
                  className="me-4 mb-2"
                  checked={recurringSettings.selectedDays.saturday}
                  onChange={handleRecurringChange}
                />
                <Form.Check
                  type="checkbox"
                  id="day_sunday"
                  name="day_sunday"
                  label="Chủ nhật"
                  className="mb-2"
                  checked={recurringSettings.selectedDays.sunday}
                  onChange={handleRecurringChange}
                />
              </div>
              <Alert variant="info" className="mt-3 mb-0">
                <i className="fas fa-info-circle me-2"></i>
                Buổi học sẽ được tạo cho tất cả các ngày được chọn, trong số tuần đã chỉ định, bắt đầu từ ngày đã chọn.
                Ngày bắt đầu phải trùng với một trong các ngày đã chọn.
              </Alert>
              
              {previewDates.length > 0 && (
                <div className="modern-card mt-3 border-primary">
                  <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
                    <div>
                      <i className="fas fa-calendar-check me-2"></i>
                      Các ngày sẽ được tạo ({previewDates.length} ngày)
                    </div>
                    {!sharedSettings.students && (
                      <Badge bg="light" text="dark" className="py-1 px-2">
                        <i className="fas fa-info-circle me-1"></i>
                        Nhấp vào ngày để chọn sinh viên
                      </Badge>
                    )}
                  </div>
                  <div className="card-body p-0" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    <ListGroup variant="flush">
                      {previewDates.map((date, index) => {
                        // Convert to Date object for formatting
                        const dateObj = new Date(date);
                        const dayOfWeek = new Intl.DateTimeFormat('vi-VN', { weekday: 'long' }).format(dateObj);
                        
                        // Find if there's already a session created for this date
                        const existingSession = sessionBatch.find(session => session.date === date);
                        const studentCount = existingSession ? existingSession.students.length : 0;
                        
                        // Get unique class names
                        const classNames = existingSession ? 
                          [...new Set(existingSession.students
                            .filter(s => s.class_name)
                            .map(s => s.class_name))]
                          : [];
                        
                        return (
                          <ListGroup.Item 
                            key={index} 
                            className={`py-2 d-flex justify-content-between align-items-center ${!sharedSettings.students ? 'list-group-item-action' : ''}`}
                            action={!sharedSettings.students}
                            onClick={() => {
                              if (!sharedSettings.students) {
                                // If session exists, edit it, otherwise create a new one for this date
                                if (existingSession) {
                                  editStudentsForSession(existingSession);
                                } else {
                                  // Create temporary session for this date and open student selection
                                  const tempSession = {
                                    id: uuidv4(),
                                    name: formData.name || `Buổi học ngày ${date}`,
                                    date,
                                    description: formData.description,
                                    startTime: formData.startTime,
                                    endTime: formData.endTime,
                                    location: formData.location,
                                    students: sharedSettings.students ? selectedStudents.map(s => ({...s})) : [...selectedStudents], // Always include students
                                    monitoringOptions: {...formData.monitoringOptions}
                                  };
                                  
                                  // If shared students is turned off, mark this session to use its own students
                                  if (!sharedSettings.students) {
                                    setCustomSettings(prev => ({
                                      ...prev,
                                      [tempSession.id]: {
                                        ...(prev[tempSession.id] || {}),
                                        students: true
                                      }
                                    }));
                                  }
                                  
                                  // Add to batch and open student selection
                                  setSessionBatch([...sessionBatch, tempSession]);
                                  editStudentsForSession(tempSession);
                                }
                              }
                            }}
                          >
                                                      <div>
                            <i className="fas fa-calendar-day me-2 text-primary"></i>
                            {date} <span className="text-muted">({dayOfWeek})</span>
                            
                            {studentCount > 0 && (
                              <Badge bg="success" className="ms-2">
                                <i className="fas fa-users me-1"></i>
                                {studentCount} sinh viên
                              </Badge>
                            )}
                            
                            {classNames.length > 0 && (
                              <Badge bg="info" className="ms-2">
                                <i className="fas fa-graduation-cap me-1"></i>
                                {classNames.length > 2 
                                  ? `${classNames.slice(0, 2).join(', ')}... +${classNames.length - 2}` 
                                  : classNames.join(', ')}
                              </Badge>
                            )}
                            
                            {existingSession && !sharedSettings.name && (
                              <Badge bg="primary" className="ms-2">
                                {existingSession.name}
                              </Badge>
                            )}
                          </div>
                            
                            <div className="d-flex">
                              {!sharedSettings.name && (
                                <Button 
                                  variant="outline-primary" 
                                  size="sm" 
                                  className="me-1"
                                  title="Chỉnh sửa tên buổi học"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (existingSession) {
                                      handleEditSessionName(existingSession);
                                    } else {
                                      // Create temporary session for this date and open name editor
                                      const tempSession = {
                                        id: uuidv4(),
                                        name: formData.name || `Buổi học ngày ${date}`,
                                        date,
                                        description: formData.description,
                                        startTime: formData.startTime,
                                        endTime: formData.endTime,
                                        location: formData.location,
                                        students: sharedSettings.students ? selectedStudents.map(s => ({...s})) : [...selectedStudents], // Always include students
                                        monitoringOptions: {...formData.monitoringOptions}
                                      };
                                      
                                      // If shared students is turned off, mark this session to use its own students
                                      if (!sharedSettings.students) {
                                        setCustomSettings(prev => ({
                                          ...prev,
                                          [tempSession.id]: {
                                            ...(prev[tempSession.id] || {}),
                                            students: true
                                          }
                                        }));
                                      }
                                      
                                      // Add to batch and open name editor
                                      setSessionBatch([...sessionBatch, tempSession]);
                                      handleEditSessionName(tempSession);
                                    }
                                  }}
                                >
                                  <i className="fas fa-heading"></i>
                                </Button>
                              )}
                              {!sharedSettings.description && (
                                <Button 
                                  variant="outline-secondary" 
                                  size="sm" 
                                  className="me-1"
                                  title="Chỉnh sửa mô tả"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (existingSession) {
                                      editSessionDescription(existingSession);
                                    } else {
                                      // Create temporary session for this date and open description editor
                                      const tempSession = {
                                        id: uuidv4(),
                                        name: formData.name || `Buổi học ngày ${date}`,
                                        date,
                                        description: '',
                                        startTime: formData.startTime,
                                        endTime: formData.endTime,
                                        location: formData.location,
                                        students: sharedSettings.students ? selectedStudents.map(s => ({...s})) : [...selectedStudents], // Always include students
                                        monitoringOptions: {...formData.monitoringOptions}
                                      };
                                      
                                      // If shared students is turned off, mark this session to use its own students
                                      if (!sharedSettings.students) {
                                        setCustomSettings(prev => ({
                                          ...prev,
                                          [tempSession.id]: {
                                            ...(prev[tempSession.id] || {}),
                                            students: true
                                          }
                                        }));
                                      }
                                      
                                      // Add to batch and open description editor
                                      setSessionBatch([...sessionBatch, tempSession]);
                                      editSessionDescription(tempSession);
                                    }
                                  }}
                                >
                                  <i className="fas fa-file-alt"></i>
                                </Button>
                              )}
                              
                              {!sharedSettings.time && (
                                <Button 
                                  variant="outline-warning" 
                                  size="sm" 
                                  className="me-1"
                                  title="Chỉnh sửa thời gian"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (existingSession) {
                                      editSessionTime(existingSession);
                                    } else {
                                      // Create temporary session for this date and open time settings
                                      const tempSession = {
                                        id: uuidv4(),
                                        name: formData.name || `Buổi học ngày ${date}`,
                                        date,
                                        description: formData.description,
                                        startTime: formData.startTime,
                                        endTime: formData.endTime,
                                        location: formData.location,
                                        students: sharedSettings.students ? selectedStudents.map(s => ({...s})) : [...selectedStudents], // Always include students
                                        monitoringOptions: {...formData.monitoringOptions}
                                      };
                                      
                                      // If shared students is turned off, mark this session to use its own students
                                      if (!sharedSettings.students) {
                                        setCustomSettings(prev => ({
                                          ...prev,
                                          [tempSession.id]: {
                                            ...(prev[tempSession.id] || {}),
                                            students: true
                                          }
                                        }));
                                      }
                                      
                                      // Add to batch and open time settings
                                      setSessionBatch([...sessionBatch, tempSession]);
                                      editSessionTime(tempSession);
                                    }
                                  }}
                                >
                                  <i className="fas fa-clock"></i>
                                </Button>
                              )}
                              
                              {!sharedSettings.location && (
                                <Button 
                                  variant="outline-success" 
                                  size="sm" 
                                  className="me-1"
                                  title="Chỉnh sửa địa điểm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (existingSession) {
                                      editSessionLocation(existingSession);
                                    } else {
                                      // Create temporary session for this date and open location settings
                                      const tempSession = {
                                        id: uuidv4(),
                                        name: formData.name || `Buổi học ngày ${date}`,
                                        date,
                                        description: formData.description,
                                        startTime: formData.startTime,
                                        endTime: formData.endTime,
                                        location: '',
                                        students: sharedSettings.students ? selectedStudents.map(s => ({...s})) : [...selectedStudents], // Always include students
                                        monitoringOptions: {...formData.monitoringOptions}
                                      };
                                      
                                      // If shared students is turned off, mark this session to use its own students
                                      if (!sharedSettings.students) {
                                        setCustomSettings(prev => ({
                                          ...prev,
                                          [tempSession.id]: {
                                            ...(prev[tempSession.id] || {}),
                                            students: true
                                          }
                                        }));
                                      }
                                      
                                      // Add to batch and open location settings
                                      setSessionBatch([...sessionBatch, tempSession]);
                                      editSessionLocation(tempSession);
                                    }
                                  }}
                                >
                                  <i className="fas fa-map-marker-alt"></i>
                                </Button>
                              )}
                              
                              {!sharedSettings.monitoring && (
                                <Button 
                                  variant="outline-danger" 
                                  size="sm" 
                                  className="me-1"
                                  title="Tùy chọn giám sát"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (existingSession) {
                                      editSessionMonitoring(existingSession);
                                    } else {
                                      // Create temporary session for this date and open monitoring settings
                                      const tempSession = {
                                        id: uuidv4(),
                                        name: formData.name || `Buổi học ngày ${date}`,
                                        date,
                                        description: formData.description,
                                        startTime: formData.startTime,
                                        endTime: formData.endTime,
                                        location: formData.location,
                                        students: sharedSettings.students ? selectedStudents.map(s => ({...s})) : [...selectedStudents], // Always include students
                                        monitoringOptions: {...formData.monitoringOptions}
                                      };
                                      
                                      // If shared students is turned off, mark this session to use its own students
                                      if (!sharedSettings.students) {
                                        setCustomSettings(prev => ({
                                          ...prev,
                                          [tempSession.id]: {
                                            ...(prev[tempSession.id] || {}),
                                            students: true
                                          }
                                        }));
                                      }
                                      
                                      // Add to batch and open monitoring settings
                                      setSessionBatch([...sessionBatch, tempSession]);
                                      editSessionMonitoring(tempSession);
                                    }
                                  }}
                                >
                                  <i className="fas fa-video"></i>
                                </Button>
                              )}
                              
                              {!sharedSettings.students && (
                                <Button 
                                  variant="outline-primary" 
                                  size="sm" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (existingSession) {
                                      editStudentsForSession(existingSession);
                                    } else {
                                      // Create temporary session for this date and open student selection
                                      const tempSession = {
                                        id: uuidv4(),
                                        name: formData.name || `Buổi học ngày ${date}`,
                                        date,
                                        description: formData.description,
                                        startTime: formData.startTime,
                                        endTime: formData.endTime,
                                        location: formData.location,
                                        students: sharedSettings.students ? selectedStudents.map(s => ({...s})) : [...selectedStudents], // Always include students
                                        monitoringOptions: {...formData.monitoringOptions}
                                      };
                                      
                                      // If shared students is turned off, mark this session to use its own students
                                      if (!sharedSettings.students) {
                                        setCustomSettings(prev => ({
                                          ...prev,
                                          [tempSession.id]: {
                                            ...(prev[tempSession.id] || {}),
                                            students: true
                                          }
                                        }));
                                      }
                                      
                                      // Add to batch and open student selection
                                      setSessionBatch([...sessionBatch, tempSession]);
                                      editStudentsForSession(tempSession);
                                    }
                                  }}
                                >
                                  <i className="fas fa-user-edit"></i>
                                </Button>
                              )}
                            </div>
                          </ListGroup.Item>
                        );
                      })}
                    </ListGroup>
                  </div>
                </div>
              )}
            </Form.Group>
            
              </Tab>
              <Tab eventKey="students" title={
                <span className="tab-title">
                  <i className="fas fa-users"></i>
                  Sinh viên tham gia <Badge bg="primary" pill>{selectedStudents.length}</Badge>
                </span>
              }>
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
              </Tab>
              <Tab eventKey="monitoring" title={
                <span className="tab-title">
                  <i className="fas fa-video"></i>
                  Tùy chọn giám sát
                </span>
              }>
                <Tabs defaultActiveKey="location" id="monitoring-tabs" className="custom-tabs mb-3">
                  
                 <Tab eventKey="location" title={
                   <span className="tab-title">
                     <i className="fas fa-map-marker-alt"></i>
                     Vị trí
                   </span>
                 }>
                    <div className="modern-card border-0 shadow-sm">
                      <div className="card-body">
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
                      </div>
                    </div>
                  </Tab>
                  
                  <Tab eventKey="files" title={
                    <span className="tab-title">
                      <i className="fas fa-file-upload"></i>
                      Tệp tin
                    </span>
                  }>
                    <div className="modern-card border-0 shadow-sm">
                      <div className="card-body">
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
                            <div className="modern-card border p-3">
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
                            </div>
                          </Form.Group>
                        </div>
                      </div>
                    </div>
                  </Tab>
                  
                  <Tab eventKey="attendance" title={
                    <span className="tab-title">
                      <i className="fas fa-calendar-check"></i>
                      Điểm danh
                    </span>
                  }>
                    <div className="modern-card border-0 shadow-sm">
                      <div className="card-body">
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
                              name="monitoring_attendance_before_session_enabled"
                              checked={formData.monitoringOptions.attendance.before_session.enabled}
                              onChange={handleChange}
                              label={formData.monitoringOptions.attendance.before_session.enabled ? "Đã bật" : "Đã tắt"}
                            />
                          </div>
                          
                          {formData.monitoringOptions.attendance.before_session.enabled && (
                            <div className="modern-card bg-light border mb-4">
                              <div className="card-body">
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
                                          name="monitoring_attendance_before_session_minutes_before"
                                          value={formData.monitoringOptions.attendance.before_session.minutes_before || 30}
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
                                          name="monitoring_attendance_before_session_duration"
                                          value={formData.monitoringOptions.attendance.before_session.duration || 30}
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
                              </div>
                            </div>
                          )}
                        </div>
                        <hr className="my-4" />
                        
                        <div className="mb-4">
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <div>
                              <h6 className="mb-0">Điểm danh trong buổi học</h6>
                              <small className="text-muted">Điểm danh giữa giờ bắt đầu và giờ kết thúc</small>
                            </div>
                            <Form.Check 
                              type="switch"
                              id="attendance_during_session"
                              name="monitoring_attendance_during_session_enabled"
                              checked={formData.monitoringOptions.attendance.during_session.enabled}
                              onChange={handleChange}
                              label={formData.monitoringOptions.attendance.during_session.enabled ? "Đã bật" : "Đã tắt"}
                            />
                          </div>
                          
                          {formData.monitoringOptions.attendance.during_session.enabled && (
                            <div className="modern-card bg-light border mb-4">
                              <div className="card-body">
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
                                          name="monitoring_attendance_during_session_minutes_after_start"
                                          value={formData.monitoringOptions.attendance.during_session.minutes_after_start || 120}
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
                                          name="monitoring_attendance_during_session_minutes_before_end"
                                          value={formData.monitoringOptions.attendance.during_session.minutes_before_end || 120}
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
                              </div>
                            </div>
                          )}
                        </div>
                        <hr className="my-4" />

                        <div>
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <div>
                              <h6 className="mb-0">Điểm danh sau buổi học</h6>
                              <small className="text-muted">Điểm danh sau giờ kết thúc</small>
                            </div>
                            <Form.Check 
                              type="switch"
                              id="attendance_after_session"
                              name="monitoring_attendance_after_session_enabled"
                              checked={formData.monitoringOptions.attendance.after_session.enabled}
                              onChange={handleChange}
                              label={formData.monitoringOptions.attendance.after_session.enabled ? "Đã bật" : "Đã tắt"}
                            />
                          </div>
                          
                          {formData.monitoringOptions.attendance.after_session.enabled && (
                            <div className="modern-card bg-light border">
                              <div className="card-body">
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
                                          name="monitoring_attendance_after_session_minutes_after"
                                          value={formData.monitoringOptions.attendance.after_session.minutes_after || 0}
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
                                          name="monitoring_attendance_after_session_duration"
                                          value={formData.monitoringOptions.attendance.after_session.duration || 30}
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
                                        Mặc định: 30 phút
                                      </Form.Text>
                                    </Form.Group>
                                  </Col>
                                </Row>
                                <Alert variant="info" className="mb-0">
                                  <i className="fas fa-info-circle me-2"></i>
                                  <small>Ví dụ: Nếu giờ kết thúc buổi học là 19:00, cấu hình trên sẽ cho phép điểm danh từ 19:00 - 19:30</small>
                                </Alert>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Tab>
                </Tabs>
              </Tab>
            </Tabs>
          </div>
        </div>
      )}
      
      {batchMode && sessionBatch.length > 0 && (
        <div className="modern-card mb-4 shadow-sm">
          <div className="card-header bg-primary text-white">
            <div className="d-flex justify-content-between align-items-center">
              <h5 className="m-0"><i className="fas fa-list me-2"></i>Danh sách buổi học ({sessionBatch.length})</h5>
              <button className="btn-modern" style={{ backgroundColor: '#f8f9fa', color: '#000', border: '1px solid #dee2e6' }} onClick={() => setSessionBatch([])}>Xóa tất cả</button>
            </div>
          </div>
          <div className="card-body p-0">
            <ListGroup variant="flush">
              {sessionBatch.map((session, index) => (
                <ListGroup.Item key={session.id} className="py-3">
                  <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="mb-1">
                      <Badge bg="secondary" className="me-2">{index + 1}</Badge>
                      {session.name}
                    </h6>
                    {session.description && !sharedSettings.description && (
                      <small className="text-muted d-block mb-1 fst-italic">
                        <i className="fas fa-quote-left me-1 fa-xs"></i>
                        {session.description.length > 100 ? `${session.description.substring(0, 100)}...` : session.description}
                      </small>
                    )}
                    <small className="text-muted">
                      <i className="fas fa-calendar me-1"></i> {session.date} 
                      {session.startTime && session.endTime && (
                        <span className={!sharedSettings.time ? 'text-warning fw-bold' : ''}>
                          <i className="fas fa-clock ms-2 me-1"></i> {session.startTime} - {session.endTime}
                        </span>
                      )}
                      {session.location && (
                        <span className={!sharedSettings.location ? 'text-success fw-bold' : ''}>
                          <i className="fas fa-map-marker-alt ms-2 me-1"></i> {session.location}
                        </span>
                      )}
                      <span className="ms-2">
                        <i className="fas fa-users me-1"></i> {session.students?.length || 0} sinh viên
                      </span>
                      
                      {/* Display class information */}
                      {session.students && session.students.length > 0 && (
                        <>
                          {(() => {
                            // Get unique class names
                            const classNames = [...new Set(session.students
                              .filter(s => s.class_name)
                              .map(s => s.class_name))];
                              
                            if (classNames.length > 0) {
                              return (
                                <span className="ms-2">
                                  <i className="fas fa-graduation-cap me-1"></i> 
                                  {classNames.length > 2 
                                    ? `${classNames.slice(0, 2).join(', ')}... +${classNames.length - 2}` 
                                    : classNames.join(', ')}
                                </span>
                              );
                            }
                            return null;
                          })()} 
                        </>
                      )}
                    </small>
                  </div>
                  <div>
                    <button className="btn-modern me-2" style={{ backgroundColor: '#0d6efd', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} onClick={() => editSessionInBatch(session)}>
                      <i className="fas fa-edit"></i>
                    </button>
                    {(!sharedSettings.name || customSettings[session.id]?.name) && (
                      <Button 
                        variant="outline-primary" 
                        size="sm" 
                        className="me-2" 
                        onClick={() => handleEditSessionName(session)}
                        title="Chỉnh sửa tên buổi học"
                      >
                        <i className="fas fa-heading"></i>
                      </Button>
                    )}
                    {(!sharedSettings.description || customSettings[session.id]?.description) && (
                      <Button 
                        variant="outline-secondary" 
                        size="sm" 
                        className="me-2" 
                        onClick={() => editSessionDescription(session)}
                        title="Chỉnh sửa mô tả"
                      >
                        <i className="fas fa-file-alt"></i>
                      </Button>
                    )}
                    {(!sharedSettings.time || customSettings[session.id]?.time) && (
                      <Button 
                        variant="outline-warning" 
                        size="sm" 
                        className="me-2" 
                        onClick={() => editSessionTime(session)}
                        title="Thiết lập thời gian"
                      >
                        <i className="fas fa-clock"></i>
                      </Button>
                    )}
                    {(!sharedSettings.location || customSettings[session.id]?.location) && (
                      <Button 
                        variant="outline-success" 
                        size="sm" 
                        className="me-2" 
                        onClick={() => editSessionLocation(session)}
                        title="Chỉnh sửa địa điểm"
                      >
                        <i className="fas fa-map-marker-alt"></i>
                      </Button>
                    )}
                    {(!sharedSettings.monitoring || customSettings[session.id]?.monitoring) && (
                      <Button 
                        variant="outline-danger" 
                        size="sm" 
                        className="me-2" 
                        onClick={() => editSessionMonitoring(session)}
                        title="Tùy chọn giám sát"
                      >
                        <i className="fas fa-video"></i>
                      </Button>
                    )}
                    {(!sharedSettings.students || customSettings[session.id]?.students) && (
                      <Button 
                        variant="outline-info" 
                        size="sm" 
                        className="me-2" 
                        onClick={() => editStudentsForSession(session)}
                        title="Chọn sinh viên tham gia"
                      >
                        <i className="fas fa-user-edit"></i>
                      </Button>
                    )}
                    <button className="btn-modern" style={{ backgroundColor: '#dc3545', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} onClick={() => removeSessionFromBatch(session.id)}>
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                  </div>
                  
                  {/* Custom settings toggles */}
                  <div className="mt-2 border-top">
                    <div className="d-flex flex-wrap gap-2">
                      {sharedSettings.name && (
                        <Badge 
                          bg={customSettings[session.id]?.name ? "primary" : "light"} 
                          text={customSettings[session.id]?.name ? "white" : "secondary"}
                          onClick={() => toggleCustomSetting(session.id, 'name')}
                          style={{cursor: 'pointer'}}
                          className="me-1"
                        >
                          <i className={`fas ${customSettings[session.id]?.name ? 'fa-toggle-on' : 'fa-toggle-off'} me-1`}></i>
                          Tên riêng
                        </Badge>
                      )}
                      {sharedSettings.description && (
                        <Badge 
                          bg={customSettings[session.id]?.description ? "warning" : "light"} 
                          text={customSettings[session.id]?.description ? "dark" : "secondary"}
                          onClick={() => toggleCustomSetting(session.id, 'description')}
                          style={{cursor: 'pointer'}}
                          className="me-1"
                        >
                          <i className={`fas ${customSettings[session.id]?.description ? 'fa-toggle-on' : 'fa-toggle-off'} me-1`}></i>
                          Mô tả riêng
                        </Badge>
                      )}
                      {sharedSettings.time && (
                        <Badge 
                          bg={customSettings[session.id]?.time ? "warning" : "light"} 
                          text={customSettings[session.id]?.time ? "dark" : "secondary"}
                          onClick={() => toggleCustomSetting(session.id, 'time')}
                          style={{cursor: 'pointer'}}
                          className="me-1"
                        >
                          <i className={`fas ${customSettings[session.id]?.time ? 'fa-toggle-on' : 'fa-toggle-off'} me-1`}></i>
                          Giờ học riêng
                        </Badge>
                      )}
                      {sharedSettings.location && (
                        <Badge 
                          bg={customSettings[session.id]?.location ? "success" : "light"} 
                          text={customSettings[session.id]?.location ? "white" : "secondary"}
                          onClick={() => toggleCustomSetting(session.id, 'location')}
                          style={{cursor: 'pointer'}}
                          className="me-1"
                        >
                          <i className={`fas ${customSettings[session.id]?.location ? 'fa-toggle-on' : 'fa-toggle-off'} me-1`}></i>
                          Địa điểm riêng
                        </Badge>
                      )}
                      {sharedSettings.students && (
                        <Badge 
                          bg={customSettings[session.id]?.students ? "info" : "light"} 
                          text={customSettings[session.id]?.students ? "white" : "secondary"}
                          onClick={() => toggleCustomSetting(session.id, 'students')}
                          style={{cursor: 'pointer'}}
                          className="me-1"
                        >
                          <i className={`fas ${customSettings[session.id]?.students ? 'fa-toggle-on' : 'fa-toggle-off'} me-1`}></i>
                          Sinh viên riêng
                        </Badge>
                      )}
                      {sharedSettings.monitoring && (
                        <Badge 
                          bg={customSettings[session.id]?.monitoring ? "primary" : "light"} 
                          text={customSettings[session.id]?.monitoring ? "white" : "secondary"}
                          onClick={() => toggleCustomSetting(session.id, 'monitoring')}
                          style={{cursor: 'pointer'}}
                          className="me-1"
                        >
                          <i className={`fas ${customSettings[session.id]?.monitoring ? 'fa-toggle-on' : 'fa-toggle-off'} me-1`}></i>
                          Giám sát riêng
                        </Badge>
                      )}
                    </div>
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>
          </div>
        </div>
      )}
      
      {batchMode && (
        <div className="modern-card mb-4 shadow-sm">
          <div className="card-header bg-light">
            <h5 className="m-0">Tùy chọn cộng chung cho tất cả buổi học</h5>
          </div>
          <div className="card-body bg-light">
            <Row>
              <Col md={6} xl={4}>
                <Form.Check 
                  type="switch"
                  id="shared_name"
                  name="shared_name"
                  label="Tên buổi học chung"
                  checked={sharedSettings.name}
                  onChange={handleChange}
                  className="mb-2"
                />
              </Col>
              <Col md={6} xl={4}>
                <Form.Check 
                  type="switch"
                  id="shared_description"
                  name="shared_description"
                  label="Mô tả chung"
                  checked={sharedSettings.description}
                  onChange={handleChange}
                  className="mb-2"
                />
              </Col>
              <Col md={6} xl={4}>
                <Form.Check 
                  type="switch"
                  id="shared_time"
                  name="shared_time"
                  label="Giờ bắt đầu/kết thúc chung"
                  checked={sharedSettings.time}
                  onChange={handleChange}
                  className="mb-2"
                />
              </Col>
              <Col md={6} xl={4}>
                <Form.Check 
                  type="switch"
                  id="shared_location"
                  name="shared_location"
                  label="Địa điểm chung"
                  checked={sharedSettings.location}
                  onChange={handleChange}
                  className="mb-2"
                />
              </Col>
              <Col md={6} xl={4}>
                <Form.Check 
                  type="switch"
                  id="shared_students"
                  name="shared_students"
                  label="Sinh viên tham gia chung"
                  checked={sharedSettings.students}
                  onChange={handleChange}
                  className="mb-2"
                />
              </Col>
              <Col md={6} xl={4}>
                <Form.Check 
                  type="switch"
                  id="shared_monitoring"
                  name="shared_monitoring"
                  label="Tùy chọn giám sát chung"
                  checked={sharedSettings.monitoring}
                  onChange={handleChange}
                  className="mb-2"
                />
              </Col>
            </Row>
          </div>
        </div>
      )}
      
      <Form noValidate validated={validated} onSubmit={handleSubmit}>
        {!batchMode && (
          <Tabs defaultActiveKey="basic" id="session-tabs" className="custom-tabs mb-3">
            <Tab eventKey="basic" title={
              <span className="tab-title">
                <i className="fas fa-info-circle"></i>
                Thông tin cơ bản
              </span>
            }>
              <div className="modern-card shadow-sm">
                <div className="card-body">
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
                              className="modern-form-control"
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
                          value={formData.location}
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
                      
                      {(formData.location === "" || formData.location === "custom") && (
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
              </div>
            </div>
          </Tab>
          <Tab eventKey="students" title={
            <span className="tab-title">
              <i className="fas fa-users"></i>
              Sinh viên tham gia <Badge bg="primary" pill>{selectedStudents.length}</Badge>
            </span>
          }>
            <div className="modern-card shadow-sm">
              <div className="card-body">
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
              </div>
            </div>
          </Tab>
          <Tab eventKey="monitoring" title={
            <span className="tab-title">
              <i className="fas fa-video"></i>
              Tùy chọn giám sát
            </span>
          }>
            <div className="modern-card shadow-sm">
              <div className="card-body">
                <Tabs defaultActiveKey="location" id="monitoring-tabs" className="custom-tabs mb-3">
                  <Tab eventKey="location" title={
                    <span className="tab-title">
                      <i className="fas fa-map-marker-alt"></i>
                      Vị trí
                    </span>
                  }>
                    <div className="modern-card border-0 shadow-sm">
                      <div className="card-body">
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
                      </div>
                    </div>
                  </Tab>
                  
                  <Tab eventKey="files" title={
                    <span className="tab-title">
                      <i className="fas fa-file-upload"></i>
                      Tệp tin
                    </span>
                  }>
                    <div className="modern-card border-0 shadow-sm">
                      <div className="card-body">
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
                            <div className="modern-card border p-3">
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
                            </div>
                          </Form.Group>
                        </div>
                      </div>
                    </div>
                  </Tab>
                  
                  <Tab eventKey="attendance" title={
                    <span className="tab-title">
                      <i className="fas fa-calendar-check"></i>
                      Điểm danh
                    </span>
                  }>
                    <div className="modern-card border-0 shadow-sm">
                      <div className="card-body">
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
                            <div className="modern-card bg-light border mb-4">
                              <div className="card-body">
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
                              </div>
                            </div>
                          )}
                        </div>
                        <hr className="my-4" />
                        
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
                            <div className="modern-card bg-light border mb-4">
                              <div className="card-body">
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
                              </div>
                            </div>
                          )}
                        </div>
                        <hr className="my-4" />

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
                            <div className="modern-card bg-light border">
                              <div className="card-body">
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
                                        Mặc định: 30 phút
                                      </Form.Text>
                                    </Form.Group>
                                  </Col>
                                </Row>
                                <Alert variant="info" className="mb-0">
                                  <i className="fas fa-info-circle me-2"></i>
                                  <small>Ví dụ: Nếu giờ kết thúc buổi học là 19:00, cấu hình trên sẽ cho phép điểm danh từ 19:00 - 19:30</small>
                                </Alert>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Tab>
                </Tabs>
              </div>
            </div>
          </Tab>
          </Tabs>
        )}
        </Form>
        
        {/* Modal for selecting students for individual sessions */}
        <Modal 
          show={showStudentModal} 
          onHide={() => setShowStudentModal(false)} 
          size="lg" 
          backdrop="static"
          keyboard={false}
        >
          <Modal.Header closeButton>
            <Modal.Title>
              <i className="fas fa-users me-2"></i>
              Chọn sinh viên tham gia buổi học
            </Modal.Title>
          </Modal.Header>
          <Modal.Body style={{ maxHeight: '70vh', overflow: 'auto' }}>
            <Alert variant="info">
              <i className="fas fa-info-circle me-2"></i>
              Chọn sinh viên tham gia buổi học này. Các sinh viên được gán riêng cho buổi học này mà thôi.
            </Alert>
            
            <div className="mb-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div>
                  <Badge bg="primary" className="me-2">{tempSelectedStudents.length}</Badge>
                  sinh viên được chọn
                </div>
                <div className="d-flex">
                  <Button 
                    variant="outline-danger" 
                    size="sm"
                    className="me-2"
                    onClick={() => setTempSelectedStudents([])}
                  >
                    <i className="fas fa-times-circle me-1"></i>Bỏ chọn tất cả
                  </Button>
                  <Button 
                    variant="outline-success" 
                    size="sm"
                    onClick={() => setTempSelectedStudents(students)}
                  >
                    <i className="fas fa-check-circle me-1"></i>Chọn tất cả
                  </Button>
                </div>
              </div>
              
              {/* Class filter */}
              <div className="d-flex gap-2 mb-2">
                <InputGroup style={{ width: 'auto' }}>
                  <InputGroup.Text><i className="fas fa-graduation-cap"></i></InputGroup.Text>
                  <Form.Select
                    value={classFilter}
                    onChange={(e) => {
                      setClassFilter(e.target.value);
                      // If a class is selected, auto-select all students from that class
                      if (e.target.value) {
                        const classStudents = students.filter(s => s.class_name === e.target.value);
                        if (classStudents.length > 0) {
                          // Add these students to selection if not already selected
                          const newSelection = [...tempSelectedStudents];
                          classStudents.forEach(student => {
                            if (!newSelection.some(s => s.id === student.id)) {
                              newSelection.push(student);
                            }
                          });
                          setTempSelectedStudents(newSelection);
                        }
                      }
                    }}
                    style={{ width: '200px' }}
                  >
                    <option value="">-- Tất cả lớp --</option>
                    {classes.map((className, index) => (
                      <option key={index} value={className}>{className}</option>
                    ))}
                  </Form.Select>
                </InputGroup>
                
                {classFilter && (
                  <Button 
                    variant="outline-info" 
                    size="sm"
                    onClick={() => {
                      // Select all students from the filtered class
                      const classStudents = students.filter(s => s.class_name === classFilter);
                      setTempSelectedStudents(classStudents);
                    }}
                  >
                    <i className="fas fa-users me-1"></i>Chọn cả lớp {classFilter}
                  </Button>
                )}
              </div>
            </div>
            
            <Table striped hover responsive className="border">
              <thead className="bg-light">
                <tr>
                  <th style={{ width: '50px', textAlign: 'center' }}>
                    <i className="fas fa-check-square"></i>
                  </th>
                  <th>Mã SV</th>
                  <th>Họ và tên</th>
                  <th>Lớp</th>
                  <th>Khoa</th>
                </tr>
              </thead>
              <tbody>
                {students.length > 0 ? (
                  students.map(student => (
                    <tr key={student.id} className={tempSelectedStudents.some(s => s.id === student.id) ? 'table-active' : ''}>
                      <td className="text-center">
                        <Form.Check
                          type="checkbox"
                          checked={tempSelectedStudents.some(s => s.id === student.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setTempSelectedStudents([...tempSelectedStudents, student]);
                            } else {
                              setTempSelectedStudents(tempSelectedStudents.filter(s => s.id !== student.id));
                            }
                          }}
                        />
                      </td>
                      <td>{student.student_id}</td>
                      <td>{student.full_name}</td>
                      <td>{student.class_name}</td>
                      <td>{student.faculty_name}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="text-center py-3">
                      <i className="fas fa-search me-2"></i>Không tìm thấy sinh viên nào
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </Modal.Body>
          <Modal.Footer>
            <button className="btn-modern" style={{ backgroundColor: '#6c757d' }} onClick={() => setShowStudentModal(false)}>
              <i className="fas fa-times me-1"></i>Hủy
            </button>
            <button className="btn-modern" onClick={saveSessionStudents}>
              <i className="fas fa-save me-1"></i>Lưu thay đổi
            </button>
          </Modal.Footer>
        </Modal>
        
        {/* Modal for setting time for individual sessions */}
        <Modal 
          show={showTimeModal} 
          onHide={() => setShowTimeModal(false)} 
          size="md" 
          backdrop="static"
          keyboard={false}
          centered
        >
          <Modal.Header closeButton>
            <Modal.Title>
              <i className="fas fa-clock me-2"></i>
              Thiết lập thời gian cho buổi học
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Alert variant="info">
              <i className="fas fa-info-circle me-2"></i>
              Thiết lập giờ bắt đầu và giờ kết thúc riêng cho buổi học này.
            </Alert>
            
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label className="modern-form-label fw-bold">Giờ bắt đầu</Form.Label>
                  <InputGroup>
                    <InputGroup.Text><i className="fas fa-hourglass-start"></i></InputGroup.Text>
                    <Form.Control
                      type="time"
                      value={tempTimeSettings.startTime}
                      onChange={(e) => setTempTimeSettings({
                        ...tempTimeSettings,
                        startTime: e.target.value
                      })}
                      required
                    />
                  </InputGroup>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label className="modern-form-label fw-bold">Giờ kết thúc</Form.Label>
                  <InputGroup>
                    <InputGroup.Text><i className="fas fa-hourglass-end"></i></InputGroup.Text>
                    <Form.Control
                      type="time"
                      value={tempTimeSettings.endTime}
                      onChange={(e) => setTempTimeSettings({
                        ...tempTimeSettings,
                        endTime: e.target.value
                      })}
                      required
                    />
                  </InputGroup>
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <button className="btn-modern" style={{ backgroundColor: '#6c757d' }} onClick={() => setShowTimeModal(false)}>
              <i className="fas fa-times me-1"></i>Hủy
            </button>
            <button className="btn-modern" onClick={saveSessionTime}>
              <i className="fas fa-save me-1"></i>Lưu thay đổi
            </button>
          </Modal.Footer>
        </Modal>
        
        {/* Modal for editing description for individual sessions */}
        <Modal 
          show={showDescriptionModal} 
          onHide={() => setShowDescriptionModal(false)} 
          size="lg" 
          backdrop="static"
          keyboard={false}
          centered
        >
          <Modal.Header closeButton>
            <Modal.Title>
              <i className="fas fa-file-alt me-2"></i>
              Chỉnh sửa mô tả cho buổi học
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Alert variant="info">
              <i className="fas fa-info-circle me-2"></i>
              Thêm mô tả riêng cho buổi học này.
            </Alert>
            
            <Form.Group className="mb-3">
              <Form.Label className="modern-form-label fw-bold">Mô tả</Form.Label>
              <Form.Control
                as="textarea"
                rows={5}
                value={tempDescription}
                onChange={(e) => setTempDescription(e.target.value)}
                placeholder="Nhập mô tả cho buổi học này"
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <button className="btn-modern" style={{ backgroundColor: '#6c757d' }} onClick={() => setShowDescriptionModal(false)}>
              <i className="fas fa-times me-1"></i>Hủy
            </button>
            <button className="btn-modern" onClick={saveSessionDescription}>
              <i className="fas fa-save me-1"></i>Lưu thay đổi
            </button>
          </Modal.Footer>
        </Modal>
        
        {/* Modal for editing location for individual sessions */}
        <Modal 
          show={showLocationModal} 
          onHide={() => setShowLocationModal(false)} 
          size="lg" 
          backdrop="static"
          keyboard={false}
          centered
        >
          <Modal.Header closeButton>
            <Modal.Title>
              <i className="fas fa-map-marker-alt me-2"></i>
              Chỉnh sửa địa điểm cho buổi học
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Alert variant="info">
              <i className="fas fa-info-circle me-2"></i>
              Chọn địa điểm riêng cho buổi học này.
            </Alert>
            
            <Form.Group className="mb-3">
              <Form.Label className="modern-form-label fw-bold">Địa điểm</Form.Label>
              <InputGroup>
                <InputGroup.Text><i className="fas fa-map-marker-alt"></i></InputGroup.Text>
                <Form.Select
                  value={tempLocationIndex}
                  onChange={(e) => {
                    const selectedValue = parseInt(e.target.value);
                    setTempLocationIndex(selectedValue);
                    
                    if (selectedValue === 0) {
                      // Custom location
                      setTempLocation("");
                    } else {
                      // Predefined location
                      setTempLocation(predefinedLocations[selectedValue].name);
                    }
                  }}
                >
                  <option value="0">-- Chọn địa điểm --</option>
                  {predefinedLocations.slice(1).map((location, index) => (
                    <option key={index + 1} value={index + 1}>{location.name}</option>
                  ))}
                  <option value="custom">Địa điểm khác</option>
                </Form.Select>
              </InputGroup>
              
              {(tempLocationIndex === 0 || tempLocationIndex === 'custom') && (
                <Form.Control
                  type="text"
                  value={tempLocation}
                  onChange={(e) => setTempLocation(e.target.value)}
                  placeholder="Nhập địa điểm buổi học"
                  className="mt-2"
                />
              )}
            </Form.Group>
            
            {tempLocationIndex > 0 && predefinedLocations[tempLocationIndex] && (
              <>
                <div className="border rounded overflow-hidden mt-3" style={{ height: '300px' }}>
                  <MapPreview 
                    latitude={predefinedLocations[tempLocationIndex].latitude}
                    longitude={predefinedLocations[tempLocationIndex].longitude}
                    radius={100}
                  />
                </div>
                <small className="text-muted d-block mt-2">
                  <i className="fas fa-info-circle me-1"></i>
                  Bản đồ hiển thị vị trí đã chọn với bán kính 100m.
                </small>
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <button className="btn-modern" style={{ backgroundColor: '#6c757d' }} onClick={() => setShowLocationModal(false)}>
              <i className="fas fa-times me-1"></i>Hủy
            </button>
            <button className="btn-modern" onClick={saveSessionLocation}>
              <i className="fas fa-save me-1"></i>Lưu thay đổi
            </button>
          </Modal.Footer>
        </Modal>
        
        {/* Modal for editing session name */}
        <Modal 
          show={showNameModal} 
          onHide={() => setShowNameModal(false)} 
          size="md" 
          backdrop="static"
          keyboard={false}
          centered
        >
          <Modal.Header closeButton>
            <Modal.Title>
              <i className="fas fa-heading me-2"></i>
              Chỉnh sửa tên buổi học
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Alert variant="info">
              <i className="fas fa-info-circle me-2"></i>
              Thay đổi tên riêng cho buổi học này.
            </Alert>
            
            <Form.Group className="mb-3">
              <Form.Label>Tên buổi học</Form.Label>
              <InputGroup>
                <InputGroup.Text><i className="fas fa-chalkboard-teacher"></i></InputGroup.Text>
                <Form.Control
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  placeholder="Nhập tên cho buổi học này"
                />
              </InputGroup>
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <button className="btn-modern" style={{ backgroundColor: '#6c757d' }} onClick={() => setShowNameModal(false)}>
              <i className="fas fa-times me-1"></i>Hủy
            </button>
            <button className="btn-modern" onClick={saveSessionName}>
              <i className="fas fa-save me-1"></i>Lưu thay đổi
            </button>
          </Modal.Footer>
        </Modal>
        
        {/* Modal for editing monitoring options for individual sessions */}
        <Modal 
          show={showMonitoringModal} 
          onHide={() => setShowMonitoringModal(false)} 
          size="xl" 
          backdrop="static"
          keyboard={false}
        >
          <Modal.Header closeButton>
            <Modal.Title>
              <i className="fas fa-video me-2"></i>
              Tùy chọn giám sát cho buổi học
            </Modal.Title>
          </Modal.Header>
          <Modal.Body style={{ maxHeight: '70vh', overflow: 'auto' }}>
            <Alert variant="info">
              <i className="fas fa-info-circle me-2"></i>
              Thiết lập tùy chọn giám sát riêng cho buổi học này.
            </Alert>
            
            {tempMonitoringOptions && (
              <Tabs defaultActiveKey="files" id="monitoring-modal-tabs" className="custom-tabs mb-3">
                
                <Tab eventKey="files" title={
                  <span className="tab-title">
                    <i className="fas fa-file-upload"></i>
                    Tệp tin
                  </span>
                }>
                  <div className="modern-card border-0 shadow-sm">
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <h5 className="mb-0">Cho phép tải lên tệp tin</h5>
                        <Form.Check 
                          type="switch"
                          id="monitoring_modal_file_upload"
                          name="monitoring_file_upload"
                          checked={tempMonitoringOptions.file_upload?.enabled}
                          onChange={handleMonitoringChange}
                          className="mb-0"
                          label={tempMonitoringOptions.file_upload?.enabled ? "Đã bật" : "Đã tắt"}
                        />
                      </div>
                      
                      <div className={tempMonitoringOptions.file_upload?.enabled ? '' : 'opacity-50'}>
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
                                  value={tempMonitoringOptions.file_upload?.max_size || 50}
                                  onChange={handleMonitoringChange}
                                  disabled={!tempMonitoringOptions.file_upload?.enabled}
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
                                checked={tempMonitoringOptions.file_upload?.required}
                                onChange={(e) => {
                                  setTempMonitoringOptions({
                                    ...tempMonitoringOptions,
                                    file_upload: {
                                      ...tempMonitoringOptions.file_upload,
                                      required: e.target.checked
                                    }
                                  });
                                }}
                                disabled={!tempMonitoringOptions.file_upload?.enabled}
                              />
                            </div>
                          </Col>
                        </Row>
                        
                        {tempMonitoringOptions.file_upload?.required && (
                          <Form.Group className="mb-4">
                            <Form.Label>Số lượng tệp tin tối thiểu</Form.Label>
                            <InputGroup>
                              <InputGroup.Text><i className="fas fa-list-ol"></i></InputGroup.Text>
                              <Form.Control
                                type="number"
                                min="1"
                                max="10"
                                name="monitoring_file_upload_min_files"
                                value={tempMonitoringOptions.file_upload?.min_files || 1}
                                onChange={(e) => {
                                  setTempMonitoringOptions({
                                    ...tempMonitoringOptions,
                                    file_upload: {
                                      ...tempMonitoringOptions.file_upload,
                                      min_files: parseInt(e.target.value) || 1
                                    }
                                  });
                                }}
                                disabled={!tempMonitoringOptions.file_upload?.enabled || !tempMonitoringOptions.file_upload?.required}
                              />
                            </InputGroup>
                            <Form.Text className="text-muted">
                              Sinh viên phải tải lên ít nhất số lượng tệp tin này để hoàn thành buổi học
                            </Form.Text>
                          </Form.Group>
                        )}
                        
                        <Form.Group>
                          <Form.Label>Loại tệp tin cho phép</Form.Label>
                          <div className="modern-card border p-3">
                            <div className="d-flex flex-wrap gap-4">
                              <Form.Check 
                                type="switch"
                                id="file_type_images"
                                label={<span><i className="fas fa-image me-2"></i>Hình ảnh (JPG, PNG, GIF...)</span>}
                                checked={tempMonitoringOptions.file_upload?.allowed_types?.includes("image/*")}
                                onChange={(e) => {
                                  const types = [...(tempMonitoringOptions.file_upload?.allowed_types || [])];
                                  if (e.target.checked) {
                                    if (!types.includes("image/*")) types.push("image/*");
                                  } else {
                                    const index = types.indexOf("image/*");
                                    if (index > -1) types.splice(index, 1);
                                  }
                                  setTempMonitoringOptions({
                                    ...tempMonitoringOptions,
                                    file_upload: {
                                      ...tempMonitoringOptions.file_upload,
                                      allowed_types: types
                                    }
                                  });
                                }}
                                disabled={!tempMonitoringOptions.file_upload?.enabled}
                              />
                              
                              <Form.Check 
                                type="switch"
                                id="file_type_pdf"
                                label={<span><i className="fas fa-file-pdf me-2"></i>PDF</span>}
                                checked={tempMonitoringOptions.file_upload?.allowed_types?.includes("application/pdf")}
                                onChange={(e) => {
                                  const types = [...(tempMonitoringOptions.file_upload?.allowed_types || [])];
                                  if (e.target.checked) {
                                    if (!types.includes("application/pdf")) types.push("application/pdf");
                                  } else {
                                    const index = types.indexOf("application/pdf");
                                    if (index > -1) types.splice(index, 1);
                                  }
                                  setTempMonitoringOptions({
                                    ...tempMonitoringOptions,
                                    file_upload: {
                                      ...tempMonitoringOptions.file_upload,
                                      allowed_types: types
                                    }
                                  });
                                }}
                                disabled={!tempMonitoringOptions.file_upload?.enabled}
                              />
                              
                              <Form.Check 
                                type="switch"
                                id="file_type_word"
                                label={<span><i className="fas fa-file-word me-2"></i>Word (DOC, DOCX)</span>}
                                checked={tempMonitoringOptions.file_upload?.allowed_types?.some(type => 
                                  type?.includes("msword") || type?.includes("wordprocessingml")
                                )}
                                onChange={(e) => {
                                  const types = [...(tempMonitoringOptions.file_upload?.allowed_types || [])];
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
                                  
                                  setTempMonitoringOptions({
                                    ...tempMonitoringOptions,
                                    file_upload: {
                                      ...tempMonitoringOptions.file_upload,
                                      allowed_types: types
                                    }
                                  });
                                }}
                                disabled={!tempMonitoringOptions.file_upload?.enabled}
                              />
                            </div>
                          </div>
                        </Form.Group>
                      </div>
                    </div>
                  </div>
                </Tab>
                
                  <Tab eventKey="location" title={
                    <span className="tab-title">
                      <i className="fas fa-map-marker-alt"></i>
                      Vị trí
                    </span>
                  }>
                    <div className="modern-card border-0 shadow-sm">
                      <div className="card-body">
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
                      </div>
                    </div>
                  </Tab>
                
                <Tab eventKey="attendance" title={<span><i className="fas fa-calendar-check me-1"></i>Điểm danh</span>}>
                  <div className="modern-card border-0 shadow-sm">
                    <div className="card-body">
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
                            name="monitoring_attendance_before_session_enabled"
                            checked={tempMonitoringOptions.attendance?.before_session?.enabled}
                            onChange={handleMonitoringChange}
                            label={tempMonitoringOptions.attendance?.before_session?.enabled ? "Đã bật" : "Đã tắt"}
                          />
                        </div>
                        
                        {tempMonitoringOptions.attendance?.before_session?.enabled && (
                          <div className="modern-card bg-light border mb-4">
                            <div className="card-body">
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
                                        name="monitoring_attendance_before_session_minutes_before"
                                        value={tempMonitoringOptions.attendance?.before_session?.minutes_before || 30}
                                        onChange={(e) => {
                                          setTempMonitoringOptions({
                                            ...tempMonitoringOptions,
                                            attendance: {
                                              ...tempMonitoringOptions.attendance,
                                              before_session: {
                                                ...tempMonitoringOptions.attendance?.before_session,
                                                minutes_before: parseInt(e.target.value) || 30
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
                                        name="monitoring_attendance_before_session_duration"
                                        value={tempMonitoringOptions.attendance?.before_session?.duration || 30}
                                        onChange={(e) => {
                                          setTempMonitoringOptions({
                                            ...tempMonitoringOptions,
                                            attendance: {
                                              ...tempMonitoringOptions.attendance,
                                              before_session: {
                                                ...tempMonitoringOptions.attendance?.before_session,
                                                duration: parseInt(e.target.value) || 30
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
                            </div>
                          </div>
                        )}
                      </div>
                      <hr className="my-4" />
                      
                      <div className="mb-4">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <div>
                            <h6 className="mb-0">Điểm danh trong buổi học</h6>
                            <small className="text-muted">Điểm danh giữa giờ bắt đầu và giờ kết thúc</small>
                          </div>
                          <Form.Check 
                            type="switch"
                            id="attendance_during_session"
                            name="monitoring_attendance_during_session_enabled"
                            checked={tempMonitoringOptions.attendance?.during_session?.enabled}
                            onChange={handleMonitoringChange}
                            label={tempMonitoringOptions.attendance?.during_session?.enabled ? "Đã bật" : "Đã tắt"}
                          />
                        </div>
                        
                        {tempMonitoringOptions.attendance?.during_session?.enabled && (
                          <div className="modern-card bg-light border mb-4">
                            <div className="card-body">
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
                                        name="monitoring_attendance_during_session_minutes_after_start"
                                        value={tempMonitoringOptions.attendance?.during_session?.minutes_after_start || 120}
                                        onChange={(e) => {
                                          setTempMonitoringOptions({
                                            ...tempMonitoringOptions,
                                            attendance: {
                                              ...tempMonitoringOptions.attendance,
                                              during_session: {
                                                ...tempMonitoringOptions.attendance?.during_session,
                                                minutes_after_start: parseInt(e.target.value) || 120
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
                                        name="monitoring_attendance_during_session_minutes_before_end"
                                        value={tempMonitoringOptions.attendance?.during_session?.minutes_before_end || 120}
                                        onChange={(e) => {
                                          setTempMonitoringOptions({
                                            ...tempMonitoringOptions,
                                            attendance: {
                                              ...tempMonitoringOptions.attendance,
                                              during_session: {
                                                ...tempMonitoringOptions.attendance?.during_session,
                                                minutes_before_end: parseInt(e.target.value) || 120
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
                            </div>
                          </div>
                        )}
                      </div>
                      <hr className="my-4" />
                      
                      <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <div>
                            <h6 className="mb-0">Điểm danh sau buổi học</h6>
                            <small className="text-muted">Điểm danh sau giờ kết thúc</small>
                          </div>
                          <Form.Check 
                            type="switch"
                            id="attendance_after_session"
                            name="monitoring_attendance_after_session_enabled"
                            checked={tempMonitoringOptions.attendance?.after_session?.enabled}
                            onChange={handleMonitoringChange}
                            label={tempMonitoringOptions.attendance?.after_session?.enabled ? "Đã bật" : "Đã tắt"}
                          />
                        </div>
                        
                        {tempMonitoringOptions.attendance?.after_session?.enabled && (
                          <div className="modern-card bg-light border">
                            <div className="card-body">
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
                                        name="monitoring_attendance_after_session_minutes_after"
                                        value={tempMonitoringOptions.attendance?.after_session?.minutes_after || 0}
                                        onChange={(e) => {
                                          setTempMonitoringOptions({
                                            ...tempMonitoringOptions,
                                            attendance: {
                                              ...tempMonitoringOptions.attendance,
                                              after_session: {
                                                ...tempMonitoringOptions.attendance?.after_session,
                                                minutes_after: parseInt(e.target.value) || 0
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
                                        name="monitoring_attendance_after_session_duration"
                                        value={tempMonitoringOptions.attendance?.after_session?.duration || 30}
                                        onChange={(e) => {
                                          setTempMonitoringOptions({
                                            ...tempMonitoringOptions,
                                            attendance: {
                                              ...tempMonitoringOptions.attendance,
                                              after_session: {
                                                ...tempMonitoringOptions.attendance?.after_session,
                                                duration: parseInt(e.target.value) || 30
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
                                <small>Ví dụ: Nếu giờ kết thúc buổi học là 19:00, cấu hình trên sẽ cho phép điểm danh từ 19:00 - 19:30</small>
                              </Alert>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Tab>
              </Tabs>
            )}
          </Modal.Body>
          <Modal.Footer>
            <button className="btn-modern" style={{ backgroundColor: '#6c757d' }} onClick={() => setShowMonitoringModal(false)}>
              <i className="fas fa-times me-1"></i>Hủy
            </button>
            <button className="btn-modern" onClick={saveSessionMonitoring}>
              <i className="fas fa-save me-1"></i>Lưu thay đổi
            </button>
          </Modal.Footer>
        </Modal>
      </>
    );
};

export default CreateSession;