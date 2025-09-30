
import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Table, Form, Spinner, Alert, InputGroup, Badge, Tabs, Tab, Dropdown, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { useLocation } from 'react-router-dom';
import AdminNavbar from '../../components/Navbar';
import axios from 'axios';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import * as XLSX from 'xlsx';
import '../../styles/calendar.css';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler,
} from 'chart.js';
import { CSVLink } from 'react-csv';
import JSZip from 'jszip';

// Register required Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  ChartTooltip,
  Legend,
  Filler
);

// Function to convert dataURL to Blob for image download
const dataURLtoBlob = (dataURL) => {
  const parts = dataURL.split(';base64,');
  const contentType = parts[0].split(':')[1];
  const raw = window.atob(parts[1]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);
  
  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }
  
  return new Blob([uInt8Array], { type: contentType });
};

const EnhancedAttendanceReports = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialSessionId = queryParams.get('sessionId');

  // Predefined hospital locations
  const predefinedLocations = [
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

  // State variables
  const [sessions, setSessions] = useState([]);
  const [groups, setGroups] = useState([]);
  const [classes, setClasses] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [activeTab, setActiveTab] = useState('statusDistribution');
  const [chartData, setChartData] = useState(null);
  
  // Filters
  const [selectedSession, setSelectedSession] = useState(initialSessionId || '');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedHospital, setSelectedHospital] = useState('');
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [nameFilter, setNameFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState('');
  const [uniqueClasses, setUniqueClasses] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  
  // Stats
  const [stats, setStats] = useState({
    totalSessions: 0,
    totalAttendees: 0,
    averageAttendance: 0,
    maleCount: 0,
    femaleCount: 0,
    otherCount: 0,
    fullAttendance: 0,
    beforeAttendance: 0,
    duringAttendance: 0,
    afterAttendance: 0,
    presentAttendance: 0,
    earlyAttendance: 0,
    lateAttendance: 0,
    earlyLeave: 0,
    lateLeave: 0,
    absent: 0,
    absentWithPermission: 0,
    earlyPermission: 0,
    duringPermission: 0,
    latePermission: 0,
    totalAttendanceOccurrences: 0,
    // Absence request stats (approved)
    fullSessionApproved: 0,
    beforeSessionApproved: 0,
    duringSessionApproved: 0,
    afterSessionApproved: 0
  });
  
  const [absenceStatsByDate, setAbsenceStatsByDate] = useState([]);

  // Detailed members data
  const [detailedMembers, setDetailedMembers] = useState([]);
  const [memberAttendances, setMemberAttendances] = useState({});
  const [allSessions, setAllSessions] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);


  // Attendance status data
  const [attendanceByStatus, setAttendanceByStatus] = useState({});

  // Fetch data when component mounts
  useEffect(() => {
    // Now that the API endpoints exist, make the calls
    fetchSessions();
    fetchGroups();
    fetchClasses();
    fetchHospitals();
    fetchAllAttendance();
    fetchAllMembers();
    fetchAbsenceStatsByDate();
  }, []);

  // Update attendance data when filters change
  useEffect(() => {
    // Now that the API endpoints exist, make the calls based on filters
    if (selectedSession) {
      fetchAttendanceBySession(selectedSession);
    } else if (selectedGroup) {
      fetchAttendanceByGroup(selectedGroup);
    } else if (selectedClass) {
      fetchAttendanceByClass(selectedClass);
    } else if (selectedHospital) {
      fetchAttendanceByHospital(selectedHospital);
    } else if (dateRange.startDate && dateRange.endDate) {
      fetchAttendanceByDateRange(dateRange.startDate, dateRange.endDate);
    } else {
      fetchAllAttendance();
    }
  }, [selectedSession, selectedGroup, selectedClass, selectedHospital, dateRange.startDate, dateRange.endDate, nameFilter, classFilter, genderFilter, attendanceStatusFilter]);

  // Placeholder for API calls
  const fetchSessions = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/attendance/sessions');
      
      if (response.data.success) {
        // Lấy thêm thông tin nhóm cho mỗi buổi điểm danh
        const sessionsWithGroup = response.data.data;
        setLoading(false);
        setError(null);
        setSessions(sessionsWithGroup);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
      setError('Không thể lấy danh sách buổi điểm danh. Vui lòng thử lại sau.');
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const response = await axios.get('/api/attendance/groups');
      
      if (response.data && response.data.data) {
        setGroups(response.data.data);
      } else if (Array.isArray(response.data)) {
        setGroups(response.data);
      } else {
        console.error('Unexpected groups data format:', response.data);
        setGroups([]);
      }
    } catch (err) {
      console.error('Error fetching groups:', err);
      setError('Không thể tải danh sách nhóm. Vui lòng thử lại sau.');
      setGroups([]);
    }
  };
  
  // Fetch absence request stats by date
  const fetchAbsenceStatsByDate = async () => {
    try {
      const response = await axios.get('/api/absence-requests/stats-by-date');
      console.log('Absence stats by date response:', response.data);
      setAbsenceStatsByDate(response.data.data || []);
      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching absence stats by date:', error);
      setAbsenceStatsByDate([]);
      return [];
    }
  };
  
  const fetchAllAttendance = async () => {
    try {
      setLoading(true);
      
      // Fetch attendance data, dashboard stats, and absence request stats
      const [attendanceResponse, dashboardResponse, absenceStatsResponse] = await Promise.all([
        axios.get('/api/attendance/reports/all'),
        axios.get('/api/dashboard/stats'),
        axios.get('/api/absence-requests/stats')
      ]);
      
      if (attendanceResponse.data && attendanceResponse.data.data) {
        processAttendanceData(attendanceResponse.data.data, dashboardResponse.data, absenceStatsResponse.data);
      } else if (Array.isArray(attendanceResponse.data)) {
        processAttendanceData(attendanceResponse.data, dashboardResponse.data, absenceStatsResponse.data);
      } else {
        console.error('Unexpected attendance data format:', attendanceResponse.data);
        setAttendanceData([]);
        setError('Định dạng dữ liệu không hợp lệ');
      }
    } catch (err) {
      console.error('Error fetching all attendance:', err);
      try {
        const sessionsResponse = await axios.get('/api/attendance/sessions');
        const allSessions = sessionsResponse.data.data || [];
        
        let allAttendanceData = [];
        
        for (const session of allSessions) {
          try {
            const attendanceResponse = await axios.get(`/api/attendance/sessions/${session._id}/attendances`);
            if (attendanceResponse.data && attendanceResponse.data.data) {
              allAttendanceData = [...allAttendanceData, ...attendanceResponse.data.data];
            }
          } catch (sessionErr) {
            console.error(`Error fetching attendance for session ${session._id}:`, sessionErr);
          }
        }
        
        processAttendanceData(allAttendanceData, null, null);
      } catch (sessionsErr) {
        console.error('Error fetching all sessions:', sessionsErr);
        setError('Không thể tải dữ liệu điểm danh. Vui lòng thử lại sau.');
        setAttendanceData([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchClasses = async () => {
    try {
      const response = await axios.get('/api/classes');
      
      if (response.data && response.data.data) {
        setClasses(response.data.data);
      } else if (Array.isArray(response.data)) {
        setClasses(response.data);
      }
    } catch (err) {
      console.error('Error fetching classes:', err);
      setError('Không thể tải danh sách lớp. Vui lòng thử lại sau.');
      setClasses([]);
    }
  };

  const fetchHospitals = async () => {
    try {
      // Use the predefined locations instead of API call
      const hospitalsList = predefinedLocations.map((location, index) => ({
        id: index.toString(),
        name: location.name,
        latitude: location.latitude,
        longitude: location.longitude,
        city: "Việt Nam"
      }));
      
      setHospitals(hospitalsList);
    } catch (err) {
      console.error('Error setting hospitals:', err);
      setError('Không thể tải danh sách bệnh viện. Vui lòng thử lại sau.');
      setHospitals([]);
    }
  };
  
  const fetchAttendanceBySession = async (sessionId) => {
    try {
      if (!sessionId) {
        console.error('Session ID is undefined');
        return;
      }
      
      setLoading(true);
      const response = await axios.get(`/api/attendance/sessions/${sessionId}/attendances`);
      
      if (response.data.success) {
        // Lấy thông tin buổi điểm danh để biết buổi này thuộc nhóm nào
        const sessionResponse = await axios.get(`/api/attendance/sessions/${sessionId}`);
        
        if (sessionResponse.data.success) {
          const session = sessionResponse.data.data;
          
          // Lưu thông tin groupId vào session hiện tại
          if (sessions && Array.isArray(sessions)) {
            const currentSession = sessions.find(s => s && s._id === sessionId);
            if (currentSession) {
              currentSession.groupId = session.groupId;
            }
          }
          
          processAttendanceData(response.data.data, null, null);
          setLoading(false);
          setError(null);
        }
      }
    } catch (error) {
      console.error('Error fetching attendance by session:', error);
      setError('Không thể lấy dữ liệu điểm danh. Vui lòng thử lại sau.');
      setLoading(false);
    }
  };
  
  const fetchAttendanceByGroup = async (groupId) => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/attendance/groups/${groupId}/attendances`);
      
      if (response.data && response.data.data) {
        processAttendanceData(response.data.data);
      } else if (Array.isArray(response.data)) {
        processAttendanceData(response.data, null, null);
      } else {
        console.error('Unexpected attendance data format:', response.data);
        setAttendanceData([]);
      }
    } catch (err) {
      console.error('Error fetching attendance data:', err);
      setError('Không thể tải dữ liệu điểm danh. Vui lòng thử lại sau.');
      setAttendanceData([]);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchAttendanceByClass = async (classId) => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/attendance/reports/class/${classId}`);
      
      if (response.data && response.data.data) {
        processAttendanceData(response.data.data);
      } else if (Array.isArray(response.data)) {
        processAttendanceData(response.data, null, null);
      } else {
        console.error('Unexpected attendance data format:', response.data);
        setAttendanceData([]);
      }
    } catch (err) {
      console.error('Error fetching attendance data by class:', err);
      setError('Không thể tải dữ liệu điểm danh theo lớp. Vui lòng thử lại sau.');
      setAttendanceData([]);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchAttendanceByHospital = async (hospitalId) => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/attendance/reports/hospital/${hospitalId}`);
      
      if (response.data && response.data.data) {
        processAttendanceData(response.data.data);
      } else if (Array.isArray(response.data)) {
        processAttendanceData(response.data, null, null);
      } else {
        console.error('Unexpected attendance data format:', response.data);
        setAttendanceData([]);
      }
    } catch (err) {
      console.error('Error fetching attendance data by hospital:', err);
      setError('Không thể tải dữ liệu điểm danh theo bệnh viện. Vui lòng thử lại sau.');
      setAttendanceData([]);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchAttendanceByDateRange = async (startDate, endDate) => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/attendance/reports/date-range?startDate=${startDate}&endDate=${endDate}`);
      
      if (response.data && response.data.data) {
        processAttendanceData(response.data.data);
      } else if (Array.isArray(response.data)) {
        processAttendanceData(response.data, null, null);
      } else {
        console.error('Unexpected attendance data format:', response.data);
        setAttendanceData([]);
      }
    } catch (err) {
      console.error('Error fetching attendance data:', err);
      setError('Không thể tải dữ liệu điểm danh. Vui lòng thử lại sau.');
      setAttendanceData([]);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchAllMembers = async () => {
    try {
      setLoadingMembers(true);
      
      // Lấy dữ liệu điểm danh trực tiếp từ API thay vì lấy danh sách sinh viên
      const attendanceResponse = await axios.get('/api/attendance/reports/all');
      
      if (attendanceResponse.data.success) {
        const allAttendanceRecords = attendanceResponse.data.data;
        console.log('Total attendance records:', allAttendanceRecords.length);
        
        if (allAttendanceRecords.length > 0) {
          console.log('Sample attendance record:', allAttendanceRecords[0]);
        }
        
        // Process attendance records to create detailed members list
        // Each record represents a student's attendance in a specific session
        const processedMembers = allAttendanceRecords.map(record => {
          // Determine gender value
          let genderValue = record.gender;
          
          // If gender is not set or invalid, try to determine from other fields
          if (!genderValue || (genderValue !== 'male' && genderValue !== 'female')) {
            // Try to determine from full_name or other available fields
            const name = record.full_name ? record.full_name.toLowerCase() : '';
            
            // Common Vietnamese female name endings
            const femaleNames = ['thị', 'ngọc', 'hương', 'trang', 'linh', 'hà', 'lan', 'chi', 'mai', 'hoa', 'thảo'];
            // Common Vietnamese male name endings
            const maleNames = ['văn', 'đức', 'minh', 'quang', 'hùng', 'tuấn', 'anh', 'đạt', 'nam', 'hải'];
            
            // Simple gender detection based on name
            const isFemale = femaleNames.some(femaleName => name.includes(femaleName));
            const isMale = maleNames.some(maleName => name.includes(maleName));
            
            if (isFemale && !isMale) {
              genderValue = 'female';
            } else if (isMale && !isFemale) {
              genderValue = 'male';
            }
          }
          
          // Get session information
          const sessionInfo = {
            title: record.session_title || record.session_name || record.session?.title || record.session?.name || 'N/A',
            id: record.session_id || record.session?._id,
            date: record.session_date || record.session?.date,
            start_time: record.start_time,
            end_time: record.end_time,
            location: record.session_location
          };
          
          return {
            id: record.student_id || record.id,
            fullName: record.full_name,
            class: record.class_name,
            groupName: record.group_name,
            student_id: record.student_code || record.student_id,
            email: record.email,
            gender: genderValue,
            attendanceStatus: record.attendance_type,
            attendanceTimestamp: record.timestamp,
            minutes_early: record.minutes_early,
            minutes_late: record.minutes_late,
            sessionInfo: sessionInfo,
            attendanceData: [record] // Each record is a separate attendance entry
          };
        });
        
        console.log(`Processed ${processedMembers.length} attendance records`);
        setDetailedMembers(processedMembers);
        setAttendanceData(allAttendanceRecords);
      } else {
        // Fallback: try to get members if attendance data is not available
        const membersResponse = await axios.get('/api/attendance/members');
        
        if (membersResponse.data.success) {
          const allMembers = membersResponse.data.data;
          
          // Process the data to map field names correctly
          const processedMembers = allMembers.map(member => {
            // Determine gender value
            let genderValue = member.gender;
            
            if (!genderValue || (genderValue !== 'male' && genderValue !== 'female')) {
              const name = member.full_name ? member.full_name.toLowerCase() : '';
              const femaleNames = ['thị', 'ngọc', 'hương', 'trang', 'linh', 'hà', 'lan', 'chi', 'mai', 'hoa', 'thảo'];
              const maleNames = ['văn', 'đức', 'minh', 'quang', 'hùng', 'tuấn', 'anh', 'đạt', 'nam', 'hải'];
              
              const isFemale = femaleNames.some(femaleName => name.includes(femaleName));
              const isMale = maleNames.some(maleName => name.includes(maleName));
              
              if (isFemale && !isMale) {
                genderValue = 'female';
              } else if (isMale && !isFemale) {
                genderValue = 'male';
              }
            }
            
            return {
              ...member,
              fullName: member.full_name,
              class: member.class_name,
              groupName: member.group_name,
              student_id: member.student_code || member.student_id,
              email: member.email,
              gender: genderValue,
              attendanceStatus: 'unknown',
              attendanceTimestamp: null,
              minutes_early: null,
              minutes_late: null,
              sessionInfo: null,
              attendanceData: []
            };
          });
          
          setDetailedMembers(processedMembers);
          setAttendanceData([]);
        }
      }
    } catch (error) {
      console.error('Error fetching attendance data:', error);
      setDetailedMembers([]);
      setAttendanceData([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  // Process attendance data from API responses
  const processAttendanceData = (data, dashboardData = null, absenceStatsData = null) => {
    // Debug: Log the data structure
    console.log('Processing attendance data:', {
      dataLength: data?.length,
      sampleData: data?.slice(0, 3),
      allAttendanceTypes: data?.map(item => item.status || item.attendance_type).filter(Boolean),
      dashboardData: dashboardData,
      dashboardDataKeys: dashboardData ? Object.keys(dashboardData) : null,
      absentStudentsFromDashboard: dashboardData?.absentStudents,
      absentStudentsCountFromDashboard: dashboardData?.absentStudentsCount,
      fullDashboardData: dashboardData,
      absenceStatsData: absenceStatsData
    });
    
    // Check if data is empty
    if (!data || !Array.isArray(data) || data.length === 0) {
      setStats({
        totalSessions: 0,
        totalAttendees: 0,
        averageAttendance: 0,
        maleCount: 0,
        femaleCount: 0,
        otherCount: 0,
        fullAttendance: 0,
        earlyAttendance: 0,
        lateAttendance: 0,
        earlyLeave: 0,
        lateLeave: 0,
        absent: 0,
        absentWithPermission: 0,
        earlyPermission: 0,
        latePermission: 0,
        totalAttendanceOccurrences: 0,
        // Absence request stats (approved)
        fullSessionApproved: 0,
        beforeSessionApproved: 0,
        duringSessionApproved: 0,
        afterSessionApproved: 0
      });
      setUniqueClasses([]);
      setAttendanceByStatus({});
      setAttendanceData([]);
      setCsvData([['Không có dữ liệu điểm danh']]);
      return;
    }
    
    // Map field names from database to what the component expects
    const processedData = data.map(item => ({
      ...item,
      // Map session fields
      sessionId: item.sessionId || { 
        _id: item.session_id, 
        name: item.session_name || item.date 
      },
      // Map method field
      method: item.method || item.period,
      // Map member fields if needed
      member: item.member || {
        _id: item.student_id,
        fullName: item.full_name,
        class: item.class_name,
        gender: item.gender,
        email: item.email,
        faculty_name: item.faculty_name
      },
      // Map faculty field
      faculty_name: item.faculty_name || item.member?.faculty_name
    }));
    
    // Set processed data
    setAttendanceData(processedData);
    
    // Extract unique classes
    const classes = [...new Set(processedData.map(item => 
      item.member?.class || item.class_name
    ).filter(Boolean))];
    setUniqueClasses(classes);
    
    // Calculate stats
    const sessionIds = [...new Set(processedData.map(item => 
      item.sessionId?._id || item.session_id
    ))];
    const totalSessions = sessionIds.length;
    
    // Use Set to get unique attendee IDs
    const attendeeIds = new Set();
    processedData.forEach(item => {
      const studentId = item.member?._id || item.student_id;
      if (studentId) {
        attendeeIds.add(studentId);
      }
    });
    const totalAttendees = attendeeIds.size;
    
    const averageAttendance = totalSessions > 0 ? (processedData.length / totalSessions).toFixed(2) : 0;
    
    // Tính toán số lượng theo giới tính
    const maleCount = processedData.filter(item => 
      (item.member?.gender === 'male') || (item.gender === 'male')
    ).length;
    const femaleCount = processedData.filter(item => 
      (item.member?.gender === 'female') || (item.gender === 'female')
    ).length;
    const otherCount = processedData.filter(item => 
      (item.member?.gender !== 'male' && item.member?.gender !== 'female') &&
      (item.gender !== 'male' && item.gender !== 'female')
    ).length;
    
    // Tính toán tổng số lượng các trạng thái điểm danh (đếm tất cả các lần xuất hiện)
    const statusCounts = {
      full: 0,
      before: 0,
      during: 0,
      after: 0,
      present: 0,
      early: 0,
      late: 0,
      late_leave: 0,
      absent: 0,
      absent_perm: 0,
      absent_before_perm: 0,
      absent_during_perm: 0,
      absent_after_perm: 0
    };
    
    // Đếm trực tiếp từ dữ liệu gốc - mỗi bản ghi điểm danh được đếm
    processedData.forEach(item => {
      const attendanceType = item.status || item.attendance_type;
      
      if (!attendanceType) return;
      
      // Đếm trực tiếp theo loại điểm danh
      switch (attendanceType) {
        case 'before':
          statusCounts.before++;
          break;
        case 'during':
          statusCounts.during++;
          break;
        case 'after':
          statusCounts.after++;
          break;
        case 'early':
          statusCounts.early++;
          break;
        case 'late':
          statusCounts.late++;
          break;
        case 'late_leave':
          statusCounts.late_leave++;
          break;
        case 'present':
          statusCounts.present++;
          break;
        case 'absent_perm':
          statusCounts.absent_perm++;
          break;
        case 'absent_before_perm':
        statusCounts.absent_before_perm++;
          break;
        case 'absent_during_perm':
        statusCounts.absent_during_perm++;
          break;
        case 'absent_after_perm':
        statusCounts.absent_after_perm++;
          break;
        default:
          // Các trường hợp khác có thể được xử lý ở đây
          break;
      }
    });
    
    // Tính toán "Vắng mặt" - sử dụng dữ liệu từ dashboard stats
    let absentCount = 0;
    
    if (dashboardData) {
      // Tìm kiếm absentStudentsCount trong các cấp độ khác nhau
      let foundAbsentCount = null;
      
      // Kiểm tra cấp độ gốc
      if (dashboardData.absentStudentsCount) {
        foundAbsentCount = dashboardData.absentStudentsCount;
      }
      // Kiểm tra trong data object
      else if (dashboardData.data && dashboardData.data.absentStudentsCount) {
        foundAbsentCount = dashboardData.data.absentStudentsCount;
      }
      // Kiểm tra trong stats object
      else if (dashboardData.stats && dashboardData.stats.absentStudentsCount) {
        foundAbsentCount = dashboardData.stats.absentStudentsCount;
      }
      // Kiểm tra mảng absentStudents
      else if (dashboardData.absentStudents && Array.isArray(dashboardData.absentStudents)) {
        foundAbsentCount = dashboardData.absentStudents.length;
      }
      else if (dashboardData.data && dashboardData.data.absentStudents && Array.isArray(dashboardData.data.absentStudents)) {
        foundAbsentCount = dashboardData.data.absentStudents.length;
      }
      
      if (foundAbsentCount !== null) {
        absentCount = foundAbsentCount;
        console.log('Absent calculation from dashboard:', {
          absentStudentsCount: foundAbsentCount,
          source: 'dashboard data'
        });
      } else {
        console.log('No absent data found in dashboard, using fallback');
      }
    }
    
    if (absentCount === 0) {
      // Fallback: tính vắng mặt dựa trên dữ liệu có sẵn
      const studentsWithAttendance = new Set();
      processedData.forEach(item => {
        const studentId = item.member?._id || item.student_id;
        if (studentId) {
          studentsWithAttendance.add(studentId);
        }
      });
      
      // Nếu có totalAttendees từ stats, tính vắng mặt
      if (totalAttendees > 0) {
        absentCount = Math.max(0, totalAttendees - studentsWithAttendance.size);
      }
      
      console.log('Absent calculation fallback:', {
        totalProcessedData: processedData.length,
        uniqueStudentsWithAttendance: studentsWithAttendance.size,
        totalAttendees: totalAttendees,
        calculatedAbsent: absentCount
      });
    }
    
    statusCounts.absent = absentCount;
    
    // Xử lý dữ liệu absence requests (yêu cầu phép vắng mặt đã duyệt)
    let absenceRequestStats = {
      fullSessionApproved: 0,
      beforeSessionApproved: 0,
      duringSessionApproved: 0,
      afterSessionApproved: 0
    };
    
    if (absenceStatsData && absenceStatsData.data) {
      const absenceData = absenceStatsData.data;
      absenceRequestStats = {
        fullSessionApproved: parseInt(absenceData.full_session_requests || 0),
        beforeSessionApproved: parseInt(absenceData.before_session_requests || 0),
        duringSessionApproved: parseInt(absenceData.during_session_requests || 0),
        afterSessionApproved: parseInt(absenceData.after_session_requests || 0)
      };
      
      console.log('Absence request stats:', {
        fullSessionApproved: absenceRequestStats.fullSessionApproved,
        beforeSessionApproved: absenceRequestStats.beforeSessionApproved,
        duringSessionApproved: absenceRequestStats.duringSessionApproved,
        afterSessionApproved: absenceRequestStats.afterSessionApproved,
        rawData: absenceData
      });
    }
    
    // Tính toán số lượng "Đầy đủ" - đếm tổng số lần xuất hiện
    // Tạo map để theo dõi sinh viên và các trạng thái của họ theo từng buổi học
    const studentSessionAttendanceMap = {};
    
    processedData.forEach(item => {
      const studentId = item.member?._id || item.student_id;
      const sessionId = item.sessionId?._id || item.session_id;
      const attendanceType = item.status || item.attendance_type;
      
      if (!studentId || !sessionId || !attendanceType) return;
      
      const key = `${studentId}_${sessionId}`;
      if (!studentSessionAttendanceMap[key]) {
        studentSessionAttendanceMap[key] = {
          studentId: studentId,
          sessionId: sessionId,
          attendanceTypes: new Set()
        };
      }
      
      studentSessionAttendanceMap[key].attendanceTypes.add(attendanceType);
    });
    
    // Đếm tổng số lần "Đầy đủ" - mỗi buổi học có đầy đủ điểm danh được đếm
    Object.values(studentSessionAttendanceMap).forEach(sessionData => {
      const statusSet = sessionData.attendanceTypes;
      
      // Trường hợp 1: Có mặt trước + Có mặt trong + Có mặt sau (hoặc Về trễ) → Đầy đủ
      if ((statusSet.has('before') && statusSet.has('during') && (statusSet.has('after') || statusSet.has('late_leave'))) ||
          (statusSet.has('early') && statusSet.has('during') && (statusSet.has('after') || statusSet.has('late_leave')))) {
        statusCounts.full++;
        return;
      }
      
      // Trường hợp 2: Đi trễ + Có mặt trong + Có mặt sau → Đầy đủ
      if (statusSet.has('late') && statusSet.has('during') && statusSet.has('after')) {
        statusCounts.full++;
        return;
      }
      
      // Trường hợp 3: Đi trễ + Có mặt trong + Về trễ → Đầy đủ
      if (statusSet.has('late') && statusSet.has('during') && statusSet.has('late_leave')) {
        statusCounts.full++;
        return;
      }
      
      // Trường hợp 4: Đi trước (hoặc Có mặt trước) + Có mặt trong + Có mặt sau → Đầy đủ
      if ((statusSet.has('early') || statusSet.has('before')) && statusSet.has('during') && statusSet.has('after')) {
        statusCounts.full++;
        return;
      }
    });
    
    // Cập nhật các biến để sử dụng trong giao diện
    const fullAttendance = statusCounts.full;
    const beforeAttendance = statusCounts.before;
    const duringAttendance = statusCounts.during;
    const afterAttendance = statusCounts.after;
    const presentAttendance = statusCounts.present;
    const earlyAttendance = statusCounts.early;
    const lateAttendance = statusCounts.late;
    const earlyLeave = statusCounts.early_leave;
    const lateLeave = statusCounts.late_leave;
    const absent = statusCounts.absent;
    const absentWithPermission = statusCounts.absent_perm;
    const earlyPermission = statusCounts.absent_before_perm;
    const duringPermission = statusCounts.absent_during_perm;
    const latePermission = statusCounts.absent_after_perm;
    
    // Tính tổng số lần xuất hiện của tất cả các trạng thái để làm mẫu số cho tỷ lệ
    const totalAttendanceOccurrences = fullAttendance + beforeAttendance + duringAttendance + afterAttendance + 
                                     presentAttendance + earlyAttendance + lateAttendance + earlyLeave + lateLeave + 
                                     absent + absentWithPermission + earlyPermission + duringPermission + latePermission;
    
    setStats({
      totalSessions,
      totalAttendees,
      averageAttendance,
      maleCount,
      femaleCount,
      otherCount,
      fullAttendance,
      beforeAttendance,
      duringAttendance,
      afterAttendance,
      presentAttendance,
      earlyAttendance,
      lateAttendance,
      earlyLeave,
      lateLeave,
      absent,
      absentWithPermission,
      earlyPermission,
      duringPermission,
      latePermission,
      totalAttendanceOccurrences,
      // Absence request stats (approved)
      fullSessionApproved: absenceRequestStats.fullSessionApproved,
      beforeSessionApproved: absenceRequestStats.beforeSessionApproved,
      duringSessionApproved: absenceRequestStats.duringSessionApproved,
      afterSessionApproved: absenceRequestStats.afterSessionApproved
    });
    
    // Phân tích dữ liệu theo trạng thái điểm danh
    const byStatus = {
      full: fullAttendance,
      early: earlyAttendance,
      late: lateAttendance,
      early_leave: earlyLeave,
      late_leave: lateLeave,
      absent: absent,
      full_permission: absentWithPermission,
      early_permission: earlyPermission,
      late_permission: latePermission
    };
    setAttendanceByStatus(byStatus);
    
    // Chuẩn bị dữ liệu biểu đồ
    prepareChartData(byStatus);
    
    setAttendanceData(data);
    
    // Prepare CSV data
    const csvData = [
      ['Họ và tên', 'Lớp', 'Giới tính', 'Email', 'Buổi điểm danh', 'Ngày', 'Giờ điểm danh', 'Phương thức', 'Trạng thái']
    ];
    
    data.forEach(item => {
      csvData.push([
        item.member?.full_name || item.member?.fullName || 'N/A',
        item.member?.class_name || item.member?.class || 'N/A',
        item.member?.gender === 'male' ? 'Nam' : item.member?.gender === 'female' ? 'Nữ' : 'Khác',
        item.member?.email || 'N/A',
        item.sessionId?.name || 'N/A',
        new Date(item.timestamp).toLocaleDateString('vi-VN'),
        new Date(item.timestamp).toLocaleTimeString('vi-VN'),
        item.method === 'qr' ? 'QR Code' : item.method === 'manual' ? 'Thủ công' : item.method,
        getStatusText(item.status)
      ]);
    });
    
    setCsvData(csvData);
  };
  
  // Helper function to get status text
  const getStatusText = (status) => {
    switch (status) {
      case 'full': return 'Có mặt đầy đủ';
      case 'early': return 'Có mặt trước';
      case 'during': return 'Có mặt trong';
      case 'late': return 'Có mặt sau';
      case 'early_leave': return 'Đi trước';
      case 'late_arrival': return 'Đi trễ';
      case 'late_leave': return 'Về trễ';
      case 'absent': return 'Vắng mặt';
      case 'full_permission': return 'Phép cả buổi';
      case 'early_permission': return 'Phép trước buổi';
      case 'late_permission': return 'Phép sau buổi';
      default: return 'Không xác định';
    }
  };
  
  // Prepare chart data
  const prepareChartData = (byStatus) => {
    setChartData({
      byStatus: {
        labels: [
          'Có mặt đầy đủ', 
          'Có mặt trước', 
          'Có mặt trong',
          'Có mặt sau',
          'Đi trước',
          'Đi trễ',
          'Về trễ',
          'Vắng mặt',
          'Phép cả buổi',
          'Phép trước buổi',
          'Phép sau buổi'
        ],
        datasets: [
          {
            label: 'Số lượt điểm danh',
            data: [
              byStatus.full || 0,
              byStatus.early || 0,
              byStatus.during || 0,
              byStatus.late || 0,
              byStatus.early_leave || 0,
              byStatus.late_arrival || 0,
              byStatus.late_leave || 0,
              byStatus.absent || 0,
              byStatus.full_permission || 0,
              byStatus.early_permission || 0,
              byStatus.late_permission || 0
            ],
            backgroundColor: [
              'rgba(40, 167, 69, 0.7)',  // success - full attendance
              'rgba(23, 162, 184, 0.7)', // info - early
              'rgba(0, 123, 255, 0.7)',  // primary - during
              'rgba(255, 193, 7, 0.7)',  // warning - late
              'rgba(108, 117, 125, 0.7)', // secondary - early leave
              'rgba(255, 193, 7, 0.7)',  // warning - late arrival
              'rgba(253, 126, 20, 0.7)', // orange - late leave
              'rgba(220, 53, 69, 0.7)',  // danger - absent
              'rgba(111, 66, 193, 0.7)', // purple - full permission
              'rgba(102, 16, 242, 0.7)', // indigo - early permission
              'rgba(232, 62, 140, 0.7)'  // pink - late permission
            ],
            borderWidth: 1
          }
        ]
      }
    });
  };

  return (
    <>
      <AdminNavbar />
              <div>
        {/* Header Section */}
        <div className="session-header">
          <div className="header-content">
            <div className="header-title">
              <h1>Báo cáo điểm danh chi tiết</h1>
              <p className="header-subtitle">Theo dõi và phân tích dữ liệu điểm danh sinh viên</p>
            </div>
            <div className="header-actions">
                <Button 
                variant="outline-light" 
                className="create-session-btn"
                  onClick={() => setShowFilters(!showFilters)}
                >
                <i className="fas fa-filter"></i>
                  {showFilters ? "Ẩn bộ lọc" : "Hiện bộ lọc"}
                </Button>
              <Button 
                variant="outline-light" 
                className="create-session-btn"
                onClick={() => {
                  // Export functionality
                  const csvData = [
                    ['Họ và tên', 'Lớp', 'Giới tính', 'Email', 'Buổi điểm danh', 'Ngày', 'Giờ điểm danh', 'Phương thức', 'Trạng thái']
                  ];
                  
                  attendanceData.forEach(item => {
                    csvData.push([
                      item.member?.full_name || item.member?.fullName || 'N/A',
                      item.member?.class_name || item.member?.class || 'N/A',
                      item.member?.gender === 'male' ? 'Nam' : item.member?.gender === 'female' ? 'Nữ' : 'Khác',
                      item.member?.email || 'N/A',
                      item.sessionId?.name || 'N/A',
                      new Date(item.timestamp).toLocaleDateString('vi-VN'),
                      new Date(item.timestamp).toLocaleTimeString('vi-VN'),
                      item.method === 'qr' ? 'QR Code' : item.method === 'manual' ? 'Thủ công' : item.method,
                      getStatusText(item.status)
                    ]);
                  });
                  
                  const worksheet = XLSX.utils.aoa_to_sheet(csvData);
                  const workbook = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(workbook, worksheet, 'Báo cáo điểm danh');
                  XLSX.writeFile(workbook, 'bao_cao_diem_danh.xlsx');
                }}
              >
                <i className="fas fa-file-export"></i>
                Xuất báo cáo
                </Button>
            </div>
              </div>
            </div>
            
            {/* Alerts for success and error messages */}
            <div style={{ position: 'fixed', top: '70px', right: '20px', zIndex: 2000, minWidth: '300px', maxWidth: '400px' }}>
              {error && (
                <Alert 
                  variant="danger" 
                  className="mb-2 shadow"
                  onClose={() => setError(null)}
                  dismissible
                >
                  {error}
                </Alert>
              )}
            </div>
            
            {/* Filters section */}
            {showFilters && (
          <div className="session-list-controls">
            <div className="search-controls">
              <div className="d-flex justify-content-between align-items-center mb-3">
                    <h5 className="mb-0">Bộ lọc báo cáo</h5>
                <Button 
                  variant="outline-secondary" 
                  size="sm"
                  onClick={() => {
                      setSelectedSession('');
                      setSelectedGroup('');
                      setSelectedClass('');
                      setSelectedHospital('');
                      setDateRange({ startDate: '', endDate: '' });
                      setNameFilter('');
                      setClassFilter('');
                      setGenderFilter('');
                      setAttendanceStatusFilter('');
                      // Reset data with API calls
                      setLoading(true);
                      fetchAllAttendance();
                      fetchAllMembers();
                  }}
                >
                  <i className="fas fa-times me-1"></i>
                      Xóa tất cả bộ lọc
                    </Button>
                  </div>
              
                  <Row>
                    <Col md={3}>
                  <div className="mb-3">
                    <label className="form-label">
                      <i className="fas fa-calendar-event me-2"></i>
                          Buổi điểm danh
                    </label>
                    <select
                      className="filter-select"
                          value={selectedSession}
                          onChange={(e) => {
                            const sessionId = e.target.value;
                            setSelectedSession(sessionId);
                            setSelectedGroup('');
                            setSelectedClass('');
                            setSelectedHospital('');
                            setDateRange({ startDate: '', endDate: '' });
                          }}
                        >
                          <option value="">Tất cả buổi điểm danh</option>
                          {sessions.map(session => (
                            <option key={session._id} value={session._id}>
                              {session.name} ({new Date(session.date).toLocaleDateString('vi-VN')})
                            </option>
                          ))}
                    </select>
                  </div>
                    </Col>
                    <Col md={3}>
                  <div className="mb-3">
                    <label className="form-label">
                      <i className="fas fa-users me-2"></i>
                      Nhóm
                    </label>
                    <select
                      className="filter-select"
                          value={selectedGroup}
                          onChange={(e) => {
                            const groupId = e.target.value;
                            setSelectedGroup(groupId);
                            setSelectedSession('');
                            setSelectedClass('');
                            setSelectedHospital('');
                            setDateRange({ startDate: '', endDate: '' });
                          }}
                          disabled={!!selectedSession}
                        >
                          <option value="">Tất cả nhóm</option>
                          {groups.map(group => (
                            <option key={group._id} value={group._id}>{group.name}</option>
                          ))}
                    </select>
                  </div>
                    </Col>
                    <Col md={3}>
                  <div className="mb-3">
                    <label className="form-label">
                      <i className="fas fa-graduation-cap me-2"></i>
                      Lớp
                    </label>
                    <select
                      className="filter-select"
                          value={selectedClass}
                          onChange={(e) => {
                            const classId = e.target.value;
                            setSelectedClass(classId);
                            setSelectedSession('');
                            setSelectedGroup('');
                            setSelectedHospital('');
                            setDateRange({ startDate: '', endDate: '' });
                          }}
                          disabled={!!selectedSession || !!selectedGroup}
                        >
                          <option value="">Tất cả lớp</option>
                          {classes.map(classItem => (
                            <option key={classItem._id} value={classItem._id}>{classItem.name}</option>
                          ))}
                    </select>
                  </div>
                    </Col>
                    <Col md={3}>
                  <div className="mb-3">
                    <label className="form-label">
                      <i className="fas fa-hospital me-2"></i>
                          Bệnh viện
                    </label>
                    <select
                      className="filter-select"
                          value={selectedHospital}
                          onChange={(e) => {
                            const hospitalId = e.target.value;
                            setSelectedHospital(hospitalId);
                            setSelectedSession('');
                            setSelectedGroup('');
                            setSelectedClass('');
                            setDateRange({ startDate: '', endDate: '' });
                          }}
                          disabled={!!selectedSession || !!selectedGroup || !!selectedClass}
                        >
                          <option value="">Tất cả bệnh viện</option>
                          {hospitals.map(hospital => (
                            <option key={hospital._id} value={hospital._id}>{hospital.name}</option>
                          ))}
                    </select>
                  </div>
                    </Col>
                  </Row>
                  
                  <Row>
                    <Col md={6}>
                  <div className="mb-3">
                    <label className="form-label">
                      <i className="fas fa-calendar-range me-2"></i>
                          Khoảng thời gian
                    </label>
                    <div className="d-flex gap-2">
                      <input
                            type="date"
                        className="filter-select"
                            value={dateRange.startDate}
                            onChange={(e) => {
                              setDateRange(prev => ({
                                ...prev,
                                startDate: e.target.value
                              }));
                              setSelectedSession('');
                              setSelectedGroup('');
                              setSelectedClass('');
                              setSelectedHospital('');
                            }}
                            disabled={!!selectedSession || !!selectedGroup || !!selectedClass || !!selectedHospital}
                          />
                      <span className="align-self-center">đến</span>
                      <input
                            type="date"
                        className="filter-select"
                            value={dateRange.endDate}
                            onChange={(e) => {
                              setDateRange(prev => ({
                                ...prev,
                                endDate: e.target.value
                              }));
                              setSelectedSession('');
                              setSelectedGroup('');
                              setSelectedClass('');
                              setSelectedHospital('');
                            }}
                            disabled={!!selectedSession || !!selectedGroup || !!selectedClass || !!selectedHospital}
                          />
                    </div>
                  </div>
                    </Col>
                    <Col md={6}>
                  <div className="mb-3">
                    <label className="form-label">
                      <i className="fas fa-check-circle me-2"></i>
                          Trạng thái điểm danh
                    </label>
                    <select
                      className="filter-select"
                          value={attendanceStatusFilter}
                          onChange={(e) => setAttendanceStatusFilter(e.target.value)}
                        >
                          <option value="">Tất cả trạng thái</option>
                          <option value="full">Có mặt đầy đủ</option>
                          <option value="early">Có mặt trước</option>
                          <option value="during">Có mặt trong</option>
                          <option value="late">Có mặt sau</option>
                          <option value="early_leave">Đi trước</option>
                          <option value="late_arrival">Đi trễ</option>
                          <option value="late_leave">Về trễ</option>
                          <option value="absent">Vắng mặt</option>
                          <option value="full_permission">Phép cả buổi</option>
                          <option value="early_permission">Phép trước buổi</option>
                          <option value="late_permission">Phép sau buổi</option>
                    </select>
                  </div>
                    </Col>
                  </Row>
                  
                  <Row>
                    <Col md={4}>
                  <div className="mb-3">
                    <label className="form-label">
                      <i className="fas fa-user me-2"></i>
                          Họ và tên
                    </label>
                    <input
                          type="text"
                      className="search-input"
                          placeholder="Tìm theo tên..."
                          value={nameFilter}
                          onChange={(e) => setNameFilter(e.target.value)}
                        />
                  </div>
                    </Col>
                    <Col md={4}>
                  <div className="mb-3">
                    <label className="form-label">
                      <i className="fas fa-book me-2"></i>
                      Lớp
                    </label>
                    <select
                      className="filter-select"
                          value={classFilter}
                          onChange={(e) => setClassFilter(e.target.value)}
                        >
                      <option value="">Tất cả các lớp</option>
                          {uniqueClasses.map((className, index) => (
                            <option key={index} value={className}>{className}</option>
                          ))}
                    </select>
                  </div>
                    </Col>
                    <Col md={4}>
                  <div className="mb-3">
                    <label className="form-label">
                      <i className="fas fa-venus-mars me-2"></i>
                          Giới tính
                    </label>
                    <select
                      className="filter-select"
                          value={genderFilter}
                          onChange={(e) => setGenderFilter(e.target.value)}
                        >
                          <option value="">Tất cả</option>
                          <option value="male">Nam</option>
                          <option value="female">Nữ</option>
                          <option value="other">Khác</option>
                    </select>
                        </div>
                  </Col>
                </Row>
                        </div>
                        </div>
        )}
            
            
            
        {/* Tab Navigation */}
        {!loading && (
          <div className="tab-navigation">
            <Tabs
              activeKey={activeTab}
              onSelect={(k) => setActiveTab(k)}
              className="custom-tabs"
            >
              <Tab eventKey="statusDistribution" title={
                <span className="tab-title">
                  <i className="fas fa-chart-pie"></i>
                  Phân bố trạng thái điểm danh
                </span>
              }>
                <div className="session-table-container">
                  <Row>
                    <Col md={6} className="mb-4">
                      <div className="chart-card">
                        <div className="chart-header">
                          <h6 className="mb-0">
                            <i className="fas fa-chart-pie me-2"></i>
                            Thống kê theo trạng thái điểm danh
                          </h6>
                        </div>
                        <div className="chart-body">
                          {stats && (
                      <Doughnut 
                        data={{
                          labels: [
                            'Có mặt đầy đủ', 
                            'Có mặt trước', 
                            'Có mặt trong',
                            'Có mặt sau',
                            'Đi trước',
                            'Đi trễ',
                            'Về trễ',
                            'Vắng mặt',
                            'Phép cả buổi',
                            'Phép trước buổi',
                            'Phép sau buổi'
                          ],
                          datasets: [
                            {
                              data: [
                                      stats.fullAttendance || 30,
                                      stats.earlyAttendance || 15,
                                      stats.totalAttendees - stats.earlyAttendance - stats.lateAttendance - stats.absent || 40,
                                      stats.lateAttendance || 10,
                                      stats.earlyLeave || 5,
                                      stats.lateAttendance || 10,
                                      stats.lateLeave || 8,
                                      stats.absent || 12,
                                      stats.absentWithPermission || 7,
                                      stats.earlyPermission || 3,
                                      stats.latePermission || 2
                              ],
                              backgroundColor: [
                                      'rgba(40, 167, 69, 0.8)',  // success - full attendance
                                      'rgba(23, 162, 184, 0.8)', // info - early
                                      'rgba(0, 123, 255, 0.8)',  // primary - during
                                      'rgba(255, 193, 7, 0.8)',  // warning - late
                                      'rgba(108, 117, 125, 0.8)', // secondary - early leave
                                      'rgba(255, 193, 7, 0.8)',  // warning - late arrival
                                      'rgba(253, 126, 20, 0.8)', // orange - late leave
                                      'rgba(220, 53, 69, 0.8)',  // danger - absent
                                      'rgba(111, 66, 193, 0.8)', // purple - full permission
                                      'rgba(102, 16, 242, 0.8)', // indigo - early permission
                                      'rgba(232, 62, 140, 0.8)'  // pink - late permission
                                    ],
                                    borderWidth: 2,
                                    borderColor: '#fff'
                            }
                          ]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          aspectRatio: 1,
                          plugins: {
                            legend: {
                              position: 'right',
                              labels: {
                                boxWidth: 12,
                                padding: 15,
                                font: {
                                  size: 12
                                }
                              }
                            }
                          },
                          layout: {
                            padding: {
                              top: 10,
                              bottom: 10,
                              left: 10,
                              right: 10
                            }
                          }
                        }}
                      />
                          )}
                        </div>
                      </div>
                    </Col>
                    
                    <Col md={6} className="mb-4">
                      <div className="chart-card">
                        <div className="chart-header">
                          <h6 className="mb-0">
                            <i className="fas fa-chart-line me-2"></i>
                            Xu hướng điểm danh theo thời gian
                          </h6>
                        </div>
                        <div className="chart-body">
                          <Line 
                            data={{
                              labels: Array.from({ length: 7 }).map((_, i) => {
                                const d = new Date();
                                d.setDate(d.getDate() - 6 + i);
                                return d.toLocaleDateString('vi-VN');
                              }),
                              datasets: [
                                {
                                  label: 'Có mặt đầy đủ',
                                  data: [65, 72, 68, 75, 80, 85, 78],
                                  borderColor: 'rgb(40, 167, 69)',
                                  backgroundColor: 'rgba(40, 167, 69, 0.1)',
                                  tension: 0.4,
                                  fill: true
                                },
                                {
                                  label: 'Đi trễ/Về sớm',
                                  data: [15, 12, 18, 14, 10, 8, 12],
                                  borderColor: 'rgb(255, 193, 7)',
                                  backgroundColor: 'rgba(255, 193, 7, 0.1)',
                                  tension: 0.4,
                                  fill: true
                                },
                                {
                                  label: 'Vắng mặt',
                                  data: [8, 6, 9, 5, 7, 4, 6],
                                  borderColor: 'rgb(220, 53, 69)',
                                  backgroundColor: 'rgba(220, 53, 69, 0.1)',
                                  tension: 0.4,
                                  fill: true
                                }
                              ]
                            }}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              aspectRatio: 1.5,
                              plugins: {
                                legend: {
                                  position: 'top',
                                  labels: {
                                    padding: 15,
                                    font: {
                                      size: 12
                                    }
                                  }
                                }
                              },
                              scales: {
                                y: {
                                  beginAtZero: true,
                                  grid: {
                                    color: 'rgba(0, 0, 0, 0.1)'
                                  }
                                },
                                x: {
                                  grid: {
                                    color: 'rgba(0, 0, 0, 0.1)'
                                  }
                                }
                              },
                              layout: {
                                padding: {
                                  top: 10,
                                  bottom: 10,
                                  left: 10,
                                  right: 10
                                }
                              }
                            }}
                          />
                        </div>
                      </div>
                    </Col>
                  </Row>
                  
                  <Row>
                    <Col md={6} className="mb-4">
                      <div className="chart-card">
                        <div className="chart-header">
                          <h6 className="mb-0">
                            <i className="fas fa-graduation-cap me-2"></i>
                            Thống kê theo lớp
                          </h6>
                        </div>
                        <div className="chart-body">
                          {classes && classes.length > 0 && (
                            <Bar 
                              data={{
                                labels: classes.slice(0, 5).map(c => c.name || `Lớp ${c._id}`),
                              datasets: [
                                {
                                  label: 'Có mặt đầy đủ',
                                  data: [65, 72, 68, 75, 80],
                                  backgroundColor: 'rgba(40, 167, 69, 0.8)',
                                  borderColor: 'rgba(40, 167, 69, 1)',
                                  borderWidth: 1
                                },
                                {
                                  label: 'Đi trễ/Về sớm',
                                  data: [15, 12, 18, 14, 10],
                                  backgroundColor: 'rgba(255, 193, 7, 0.8)',
                                  borderColor: 'rgba(255, 193, 7, 1)',
                                  borderWidth: 1
                                },
                                {
                                  label: 'Vắng mặt',
                                  data: [8, 6, 9, 5, 7],
                                  backgroundColor: 'rgba(220, 53, 69, 0.8)',
                                  borderColor: 'rgba(220, 53, 69, 1)',
                                  borderWidth: 1
                                }
                              ]
                            }}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              plugins: {
                                legend: {
                                  position: 'top',
                                  labels: {
                                    padding: 15,
                                    font: {
                                      size: 12
                                    }
                                  }
                                }
                              },
                              scales: {
                                y: {
                                  beginAtZero: true,
                                  grid: {
                                    color: 'rgba(0, 0, 0, 0.1)'
                                  }
                                },
                                x: {
                                  grid: {
                                    color: 'rgba(0, 0, 0, 0.1)'
                                  }
                                }
                              }
                            }}
                          />
                          )}
                        </div>
                      </div>
                    </Col>
                    
                    <Col md={6} className="mb-4">
                      <div className="chart-card">
                        <div className="chart-header">
                          <h6 className="mb-0">
                            <i className="fas fa-hospital me-2"></i>
                            Thống kê theo bệnh viện
                          </h6>
                        </div>
                        <div className="chart-body">
                          {hospitals && hospitals.length > 0 && (
                            <Bar 
                            data={{
                              labels: hospitals.slice(0, 5).map(h => h.name || `BV ${h._id}`),
                              datasets: [
                                {
                                  label: 'Có mặt đầy đủ',
                                  data: [85, 78, 88, 92, 82],
                                  backgroundColor: 'rgba(40, 167, 69, 0.8)',
                                  borderColor: 'rgba(40, 167, 69, 1)',
                                  borderWidth: 1
                                },
                                {
                                  label: 'Đi trễ/Về sớm',
                                  data: [10, 15, 8, 5, 12],
                                  backgroundColor: 'rgba(255, 193, 7, 0.8)',
                                  borderColor: 'rgba(255, 193, 7, 1)',
                                  borderWidth: 1
                                },
                                {
                                  label: 'Vắng mặt',
                                  data: [5, 7, 4, 3, 6],
                                  backgroundColor: 'rgba(220, 53, 69, 0.8)',
                                  borderColor: 'rgba(220, 53, 69, 1)',
                                  borderWidth: 1
                                }
                              ]
                            }}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              plugins: {
                                legend: {
                                  position: 'top',
                                  labels: {
                                    padding: 15,
                                    font: {
                                      size: 12
                                    }
                                  }
                                }
                              },
                              scales: {
                                y: {
                                  beginAtZero: true,
                                  grid: {
                                    color: 'rgba(0, 0, 0, 0.1)'
                                  }
                                },
                                x: {
                                  grid: {
                                    color: 'rgba(0, 0, 0, 0.1)'
                                  }
                                }
                              }
                            }}
                          />
                          )}
                        </div>
                      </div>
                    </Col>
                  </Row>

                </div>
              </Tab>
              
              <Tab eventKey="detailedList" title={
                <span className="tab-title">
                  <i className="fas fa-list-check"></i>
                  Danh sách chi tiết
                </span>
              }>
                <div className="session-table-container">

                  
                      {loadingMembers ? (
                        <div className="text-center py-5">
                          <Spinner animation="border" variant="primary" />
                      <p className="mt-3">Đang tải dữ liệu sinh viên...</p>
                        </div>
                      ) : !detailedMembers || !Array.isArray(detailedMembers) || detailedMembers.length === 0 ? (
                        <div className="text-center py-5">
                      <i className="fas fa-exclamation-circle fa-3x text-warning mb-3"></i>
                      <p className="text-muted">Không có sinh viên nào trong hệ thống.</p>
                        </div>
                      ) : (
                    <div className="table-responsive">
                      <table className="session-table">
                        <thead>
                          <tr>
                            <th>#</th>
                                  <th>Họ và tên</th>
                            <th>Lớp</th>
                                  <th>Tên buổi học</th>
                                  <th>Giới tính</th>
                            <th>Email</th>
                            <th>Trạng thái điểm danh</th>
                                </tr>
                              </thead>
                              <tbody>
                                {detailedMembers.map((member, index) => (
                                  <tr key={index}>
                              <td>{index + 1}</td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="member-avatar">
                                    <i className="fas fa-user"></i>
                                  </div>
                                  <div>
                                    <div className="fw-bold">{member.fullName || 'N/A'}</div>
                                    <small className="text-muted">MSSV: {member.student_id || 'N/A'}</small>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <Badge bg="primary">{member.class || 'N/A'}</Badge>
                              </td>
                              <td>
                                <Badge bg="info">
                                  {member.sessionInfo?.title || member.groupName || 'N/A'}
                                </Badge>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                      {member.gender === 'male' ? 
                                    <><i className="fas fa-mars text-primary me-2"></i> Nam</> : 
                                      member.gender === 'female' ? 
                                    <><i className="fas fa-venus text-danger me-2"></i> Nữ</> : 
                                    <><i className="fas fa-genderless text-secondary me-2"></i> Khác</>}
                                </div>
                                    </td>
                                    <td>
                                <small className="text-muted">{member.email || 'N/A'}</small>
                              </td>
                                <td>
                                  {(() => {
                                   // Lấy tất cả các loại điểm danh từ attendanceData
                                   const attendanceTypes = new Set();
                                   const badges = [];
                                   
                                   // Thêm loại điểm danh hiện tại
                                   if (member.attendanceStatus) {
                                     attendanceTypes.add(member.attendanceStatus);
                                   }
                                   
                                   // Thêm các loại từ attendanceData nếu có
                                   if (member.attendanceData && Array.isArray(member.attendanceData)) {
                                     member.attendanceData.forEach(record => {
                                       if (record.attendance_type) {
                                         attendanceTypes.add(record.attendance_type);
                                       }
                                     });
                                   }
                                   
                                   // Kiểm tra các loại điểm danh có sẵn
                                   const hasBeforeAttendance = attendanceTypes.has('before');
                                   const hasDuringAttendance = attendanceTypes.has('during');
                                   const hasAfterAttendance = attendanceTypes.has('after');
                                   const hasLateAttendance = attendanceTypes.has('late');
                                   const hasEarlyAttendance = attendanceTypes.has('early');
                                   const hasLateLeaveAttendance = attendanceTypes.has('late_leave');
                                   
                                   // Tìm bản ghi đi trễ nếu có
                                   const lateRecord = member.attendanceData?.find(r => r.attendance_type === 'late') || 
                                                     (member.attendanceStatus === 'late' ? member : null);
                                   
                                   // Kiểm tra các trường hợp thiếu điểm danh
                                   const missingBefore = !hasBeforeAttendance && !hasEarlyAttendance;
                                   const missingDuring = !hasDuringAttendance;
                                   const missingAfter = !hasAfterAttendance && !hasLateLeaveAttendance;
                                   
                                   // Trường hợp 1: Trước - Trong -> Chỉ hiển thị Thiếu Sau
                                   if (hasBeforeAttendance && hasDuringAttendance && !hasAfterAttendance && !hasLateLeaveAttendance && missingAfter) {
                                     badges.push(
                                       <Badge key="missing_after" bg="danger" className="me-1">
                                         <i className="fas fa-times-circle me-1"></i>
                                         Thiếu Sau
                                       </Badge>
                                     );
                                   }
                                   // Trường hợp 2: Trước - Sau -> Chỉ hiển thị Thiếu Trong
                                   else if (hasBeforeAttendance && hasAfterAttendance && !hasDuringAttendance && missingDuring) {
                                     badges.push(
                                       <Badge key="missing_during" bg="danger" className="me-1">
                                         <i className="fas fa-times-circle me-1"></i>
                                         Thiếu Trong
                                       </Badge>
                                     );
                                   }
                                   // Trường hợp 3: Đi trễ - Trong -> Chỉ hiển thị Thiếu Sau + Đi trễ
                                   else if (hasLateAttendance && hasDuringAttendance && !hasAfterAttendance && !hasLateLeaveAttendance && missingAfter) {
                                     badges.push(
                                       <Badge key="missing_after" bg="danger" className="me-1">
                                         <i className="fas fa-times-circle me-1"></i>
                                         Thiếu Sau
                                       </Badge>
                                     );
                                     if (lateRecord) {
                                       badges.push(
                                         <Badge key="late" bg="warning" className="me-1">
                                           <i className="fas fa-hourglass-end me-1"></i>
                                           Đi trễ {lateRecord.minutes_late ? `${lateRecord.minutes_late} phút` : ''}
                                         </Badge>
                                       );
                                     }
                                   }
                                   // Trường hợp 4: Đi trễ - Sau -> Chỉ hiển thị Thiếu Trong + Đi trễ
                                   else if (hasLateAttendance && hasAfterAttendance && !hasDuringAttendance && missingDuring) {
                                     badges.push(
                                       <Badge key="missing_during" bg="danger" className="me-1">
                                         <i className="fas fa-times-circle me-1"></i>
                                         Thiếu Trong
                                       </Badge>
                                     );
                                     if (lateRecord) {
                                       badges.push(
                                         <Badge key="late" bg="warning" className="me-1">
                                           <i className="fas fa-hourglass-end me-1"></i>
                                           Đi trễ {lateRecord.minutes_late ? `${lateRecord.minutes_late} phút` : ''}
                                         </Badge>
                                       );
                                     }
                                   }
                                   // Trường hợp 5: Trong - Sau -> Chỉ hiển thị Thiếu Trước
                                   else if (hasDuringAttendance && hasAfterAttendance && !hasBeforeAttendance && !hasEarlyAttendance && missingBefore) {
                                     badges.push(
                                       <Badge key="missing_before" bg="danger" className="me-1">
                                         <i className="fas fa-times-circle me-1"></i>
                                         Thiếu Trước
                                       </Badge>
                                     );
                                   }
                                   // Trường hợp 6: Trước - Trong - Sau -> Chỉ hiển thị Đầy đủ
                                   else if (hasBeforeAttendance && hasDuringAttendance && (hasAfterAttendance || hasLateLeaveAttendance)) {
                                     badges.push(
                                       <Badge key="full" bg="success" className="me-1">
                                         <i className="fas fa-star me-1"></i>
                                         Đầy đủ
                                       </Badge>
                                     );
                                   }
                                   // Trường hợp 7: Đi trễ - Trong - Sau -> Hiển thị Đầy đủ + Đi trễ
                                   else if (hasLateAttendance && hasDuringAttendance && (hasAfterAttendance || hasLateLeaveAttendance)) {
                                     badges.push(
                                       <Badge key="full" bg="success" className="me-1">
                                         <i className="fas fa-star me-1"></i>
                                         Đầy đủ
                                       </Badge>
                                     );
                                     if (lateRecord) {
                                       badges.push(
                                         <Badge key="late" bg="warning" className="me-1">
                                           <i className="fas fa-hourglass-end me-1"></i>
                                           Đi trễ {lateRecord.minutes_late ? `${lateRecord.minutes_late} phút` : ''}
                                         </Badge>
                                       );
                                     }
                                   }
                                   // Các trường hợp khác: hiển thị từng trạng thái riêng biệt
                                   else {
                                     // Kiểm tra các loại vắng có phép
                                     const hasAbsentPerm = attendanceTypes.has('absent_perm');
                                     const hasAbsentBeforePerm = attendanceTypes.has('absent_before_perm');
                                     const hasAbsentDuringPerm = attendanceTypes.has('absent_during_perm');
                                     const hasAbsentAfterPerm = attendanceTypes.has('absent_after_perm');
                                     
                                     if (hasAbsentPerm) {
                                       badges.push(
                                         <Badge key="absent_perm" bg="danger" className="me-1">
                                           <i className="fas fa-file-alt me-1"></i>
                                           Phép cả buổi
                                         </Badge>
                                       );
                                     } else if (hasAbsentBeforePerm) {
                                       badges.push(
                                         <Badge key="absent_before_perm" bg="info" className="me-1">
                                           <i className="fas fa-file-alt me-1"></i>
                                           Phép trước buổi
                                         </Badge>
                                       );
                                     } else if (hasAbsentDuringPerm) {
                                       badges.push(
                                         <Badge key="absent_during_perm" bg="warning" className="me-1">
                                           <i className="fas fa-file-alt me-1"></i>
                                           Phép trong buổi
                                         </Badge>
                                       );
                                     } else if (hasAbsentAfterPerm) {
                                       badges.push(
                                         <Badge key="absent_after_perm" bg="secondary" className="me-1">
                                           <i className="fas fa-file-alt me-1"></i>
                                           Phép sau buổi
                                         </Badge>
                                       );
                                     } else {
                                       // Nếu không có vắng có phép, hiển thị trạng thái điểm danh bình thường
                                       if (hasBeforeAttendance) {
                                         badges.push(
                                           <Badge key="before" bg="info" className="me-1">
                                             <i className="fas fa-clock me-1"></i>
                                             Có mặt trước
                                           </Badge>
                                         );
                                       }
                                       
                                       if (hasDuringAttendance) {
                                         badges.push(
                                           <Badge key="during" bg="primary" className="me-1">
                                             <i className="fas fa-user-check me-1"></i>
                                             Có mặt trong
                                           </Badge>
                                         );
                                       }
                                       
                                       if (hasAfterAttendance) {
                                         badges.push(
                                           <Badge key="after" bg="success" className="me-1">
                                             <i className="fas fa-check-circle me-1"></i>
                                             Có mặt sau
                                           </Badge>
                                         );
                                       }
                                       
                                       if (hasEarlyAttendance) {
                                         badges.push(
                                           <Badge key="early" bg="secondary" className="me-1">
                                             <i className="fas fa-clock me-1"></i>
                                             Đi sớm
                                           </Badge>
                                         );
                                       }
                                       
                                       if (hasLateAttendance && lateRecord) {
                                         badges.push(
                                           <Badge key="late" bg="warning" className="me-1">
                                             <i className="fas fa-hourglass-end me-1"></i>
                                             Đi trễ {lateRecord.minutes_late ? `${lateRecord.minutes_late} phút` : ''}
                                           </Badge>
                                         );
                                       }
                                       
                                       if (hasLateLeaveAttendance) {
                                         badges.push(
                                           <Badge key="late_leave" bg="dark" className="me-1">
                                             <i className="fas fa-sign-out-alt me-1"></i>
                                             Về trễ
                                           </Badge>
                                         );
                                       }
                                     }
                                   }
                                   
                                   // Nếu không có badge nào, hiển thị trạng thái mặc định
                                   if (badges.length === 0) {
                                     badges.push(
                                       <Badge key="present" bg="success" className="me-1">
                                         <i className="fas fa-check-circle me-1"></i>
                                         Có mặt
                                       </Badge>
                                     );
                                   }
                                   
                                   return badges;
                                })()}
                                {member.attendanceTimestamp && (
                                  <div className="mt-1">
                                    <small className="text-muted">
                                      {new Date(member.attendanceTimestamp).toLocaleString('vi-VN')}
                                    </small>
                                  </div>
                                )}
                              </td>
                              <td>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                      </table>
                          </div>
                      )}
                </div>
                </Tab>
                
              <Tab eventKey="statusReport" title={
                <span className="tab-title">
                  <i className="fas fa-check-circle"></i>
                  Báo cáo trạng thái
                </span>
              }>
                <div className="session-table-container">
                  
                  <div className="table-responsive">
                    <table className="session-table">
                      <thead>
                              <tr>
                                <th>Trạng thái</th>
                                <th>Số lượng</th>
                                <th>Tỷ lệ</th>
                          <th>Mô tả</th>
                              </tr>
                            </thead>
                            <tbody>
                              {/* Đầy đủ */}
                              <tr>
                          <td>
                            <div className="d-flex align-items-center">
                              <div className="status-indicator bg-success"></div>
                              <Badge bg="success">Đầy đủ</Badge>
                            </div>
                                </td>
                          <td><strong>{stats.fullAttendance || 0}</strong></td>
                          <td>
                            <div className="progress" style={{height: '20px'}}>
                              <div 
                                className="progress-bar bg-success" 
                                style={{width: `${stats.totalAttendanceOccurrences && stats.totalAttendanceOccurrences > 0 ? Math.min((stats.fullAttendance / stats.totalAttendanceOccurrences) * 100, 100) : 0}%`}}
                              >
                                {stats.totalAttendanceOccurrences && stats.totalAttendanceOccurrences > 0 ? Math.round(Math.min((stats.fullAttendance / stats.totalAttendanceOccurrences) * 100, 100)) : 0}%
                              </div>
                            </div>
                                </td>
                          <td><small className="text-muted">Tổng số lần có mặt đầy đủ thời gian</small></td>
                              </tr>

                              {/* Có mặt trước */}
                              <tr>
                          <td>
                            <div className="d-flex align-items-center">
                              <div className="status-indicator bg-success"></div>
                              <Badge bg="success">Có mặt trước</Badge>
                            </div>
                                </td>
                          <td><strong>{stats.beforeAttendance || 0}</strong></td>
                          <td>
                            <div className="progress" style={{height: '20px'}}>
                              <div 
                                className="progress-bar bg-success" 
                                style={{width: `${stats.totalAttendanceOccurrences && stats.totalAttendanceOccurrences > 0 ? Math.min((stats.beforeAttendance / stats.totalAttendanceOccurrences) * 100, 100) : 0}%`}}
                              >
                                {stats.totalAttendanceOccurrences && stats.totalAttendanceOccurrences > 0 ? Math.round(Math.min((stats.beforeAttendance / stats.totalAttendanceOccurrences) * 100, 100)) : 0}%
                              </div>
                            </div>
                                </td>
                          <td><small className="text-muted">Tổng số lần điểm danh trước buổi học</small></td>
                              </tr>

                              {/* Có mặt trong */}
                              <tr>
                          <td>
                            <div className="d-flex align-items-center">
                              <div className="status-indicator bg-success"></div>
                              <Badge bg="success">Có mặt trong</Badge>
                            </div>
                                </td>
                          <td><strong>{stats.duringAttendance || 0}</strong></td>
                          <td>
                            <div className="progress" style={{height: '20px'}}>
                              <div 
                                className="progress-bar bg-success" 
                                style={{width: `${stats.totalAttendanceOccurrences && stats.totalAttendanceOccurrences > 0 ? Math.min((stats.duringAttendance / stats.totalAttendanceOccurrences) * 100, 100) : 0}%`}}
                              >
                                {stats.totalAttendanceOccurrences && stats.totalAttendanceOccurrences > 0 ? Math.round(Math.min((stats.duringAttendance / stats.totalAttendanceOccurrences) * 100, 100)) : 0}%
                              </div>
                            </div>
                          </td>
                          <td><small className="text-muted">Tổng số lần điểm danh trong buổi học</small></td>
                              </tr>

                              {/* Có mặt sau */}
                              <tr>
                          <td>
                            <div className="d-flex align-items-center">
                              <div className="status-indicator bg-success"></div>
                              <Badge bg="success">Có mặt sau</Badge>
                            </div>
                          </td>
                          <td><strong>{stats.afterAttendance || 0}</strong></td>
                          <td>
                            <div className="progress" style={{height: '20px'}}>
                              <div 
                                className="progress-bar bg-success" 
                                style={{width: `${stats.totalAttendanceOccurrences && stats.totalAttendanceOccurrences > 0 ? Math.min((stats.afterAttendance / stats.totalAttendanceOccurrences) * 100, 100) : 0}%`}}
                              >
                                {stats.totalAttendanceOccurrences && stats.totalAttendanceOccurrences > 0 ? Math.round(Math.min((stats.afterAttendance / stats.totalAttendanceOccurrences) * 100, 100)) : 0}%
                              </div>
                            </div>
                          </td>
                          <td><small className="text-muted">Tổng số lần điểm danh sau buổi học</small></td>
                              </tr>

                              {/* Có mặt */}
                              <tr>
                          <td>
                            <div className="d-flex align-items-center">
                              <div className="status-indicator bg-success"></div>
                              <Badge bg="success">Có mặt</Badge>
                            </div>
                          </td>
                          <td><strong>{stats.presentAttendance || 0}</strong></td>
                          <td>
                            <div className="progress" style={{height: '20px'}}>
                              <div 
                                className="progress-bar bg-success" 
                                style={{width: `${stats.totalAttendanceOccurrences && stats.totalAttendanceOccurrences > 0 ? Math.min((stats.presentAttendance / stats.totalAttendanceOccurrences) * 100, 100) : 0}%`}}
                              >
                                {stats.totalAttendanceOccurrences && stats.totalAttendanceOccurrences > 0 ? Math.round(Math.min((stats.presentAttendance / stats.totalAttendanceOccurrences) * 100, 100)) : 0}%
                              </div>
                            </div>
                          </td>
                          <td><small className="text-muted">Tổng số lần điểm danh (không xác định thời điểm)</small></td>
                              </tr>

                              {/* Đi trễ */}
                              <tr>
                          <td>
                            <div className="d-flex align-items-center">
                              <div className="status-indicator bg-warning"></div>
                              <Badge bg="warning">Đi trễ</Badge>
                            </div>
                          </td>
                          <td><strong>{stats.lateAttendance || 0}</strong></td>
                          <td>
                            <div className="progress" style={{height: '20px'}}>
                              <div 
                                className="progress-bar bg-warning" 
                                style={{width: `${stats.totalAttendanceOccurrences && stats.totalAttendanceOccurrences > 0 ? Math.min((stats.lateAttendance / stats.totalAttendanceOccurrences) * 100, 100) : 0}%`}}
                              >
                                {stats.totalAttendanceOccurrences && stats.totalAttendanceOccurrences > 0 ? Math.round(Math.min((stats.lateAttendance / stats.totalAttendanceOccurrences) * 100, 100)) : 0}%
                              </div>
                            </div>
                          </td>
                          <td><small className="text-muted">Tổng số lần điểm danh đi trễ so với giờ bắt đầu</small></td>
                              </tr>

                              {/* Vắng mặt */}
                              <tr>
                          <td>
                            <div className="d-flex align-items-center">
                              <div className="status-indicator bg-danger"></div>
                              <Badge bg="danger">Vắng mặt</Badge>
                            </div>
                          </td>
                          <td><strong>{stats.absent || 0}</strong></td>
                          <td>
                            <div className="progress" style={{height: '20px'}}>
                              <div 
                                className="progress-bar bg-danger" 
                                style={{width: `${stats.totalAttendanceOccurrences && stats.totalAttendanceOccurrences > 0 ? Math.min((stats.absent / stats.totalAttendanceOccurrences) * 100, 100) : 0}%`}}
                              >
                                {stats.totalAttendanceOccurrences && stats.totalAttendanceOccurrences > 0 ? Math.round(Math.min((stats.absent / stats.totalAttendanceOccurrences) * 100, 100)) : 0}%
                              </div>
                            </div>
                          </td>
                          <td><small className="text-muted">Tổng số lần vắng mặt</small></td>
                              </tr>

                              {/* Phép cả buổi */}
                              <tr>
                          <td>
                            <div className="d-flex align-items-center">
                              <div className="status-indicator bg-danger"></div>
                              <Badge bg="danger">Phép cả buổi</Badge>
                            </div>
                          </td>
                          <td><strong>{stats.fullSessionApproved || 0}</strong></td>
                          <td>
                            <div className="progress" style={{height: '20px'}}>
                              <div 
                                className="progress-bar bg-danger" 
                                style={{width: `${stats.totalAttendanceOccurrences && stats.totalAttendanceOccurrences > 0 ? Math.min((stats.fullSessionApproved / stats.totalAttendanceOccurrences) * 100, 100) : 0}%`}}
                              >
                                {stats.totalAttendanceOccurrences && stats.totalAttendanceOccurrences > 0 ? Math.round(Math.min((stats.fullSessionApproved / stats.totalAttendanceOccurrences) * 100, 100)) : 0}%
                              </div>
                            </div>
                          </td>
                          <td><small className="text-muted">Tổng số lần phép vắng cả buổi đã duyệt</small></td>
                              </tr>

                              {/* Phép trước buổi */}
                              <tr>
                          <td>
                            <div className="d-flex align-items-center">
                              <div className="status-indicator bg-info"></div>
                              <Badge bg="info">Phép trước buổi</Badge>
                            </div>
                          </td>
                          <td><strong>{stats.beforeSessionApproved || 0}</strong></td>
                          <td>
                            <div className="progress" style={{height: '20px'}}>
                              <div 
                                className="progress-bar bg-info" 
                                style={{width: `${stats.totalAttendanceOccurrences && stats.totalAttendanceOccurrences > 0 ? Math.min((stats.beforeSessionApproved / stats.totalAttendanceOccurrences) * 100, 100) : 0}%`}}
                              >
                                {stats.totalAttendanceOccurrences && stats.totalAttendanceOccurrences > 0 ? Math.round(Math.min((stats.beforeSessionApproved / stats.totalAttendanceOccurrences) * 100, 100)) : 0}%
                              </div>
                            </div>
                          </td>
                          <td><small className="text-muted">Tổng số lần phép vắng trước buổi đã duyệt</small></td>
                              </tr>

                              {/* Phép trong buổi */}
                              <tr>
                          <td>
                            <div className="d-flex align-items-center">
                              <div className="status-indicator bg-warning"></div>
                              <Badge bg="warning">Phép trong buổi</Badge>
                            </div>
                          </td>
                          <td><strong>{stats.duringSessionApproved || 0}</strong></td>
                          <td>
                            <div className="progress" style={{height: '20px'}}>
                              <div 
                                className="progress-bar bg-warning" 
                                style={{width: `${stats.totalAttendanceOccurrences && stats.totalAttendanceOccurrences > 0 ? Math.min((stats.duringSessionApproved / stats.totalAttendanceOccurrences) * 100, 100) : 0}%`}}
                              >
                                {stats.totalAttendanceOccurrences && stats.totalAttendanceOccurrences > 0 ? Math.round(Math.min((stats.duringSessionApproved / stats.totalAttendanceOccurrences) * 100, 100)) : 0}%
                              </div>
                            </div>
                          </td>
                          <td><small className="text-muted">Tổng số lần phép vắng trong buổi đã duyệt</small></td>
                              </tr>

                              {/* Phép sau buổi */}
                              <tr>
                          <td>
                            <div className="d-flex align-items-center">
                              <div className="status-indicator bg-secondary"></div>
                              <Badge bg="secondary">Phép sau buổi</Badge>
                            </div>
                          </td>
                          <td><strong>{stats.afterSessionApproved || 0}</strong></td>
                          <td>
                            <div className="progress" style={{height: '20px'}}>
                              <div 
                                className="progress-bar bg-secondary" 
                                style={{width: `${stats.totalAttendanceOccurrences && stats.totalAttendanceOccurrences > 0 ? Math.min((stats.afterSessionApproved / stats.totalAttendanceOccurrences) * 100, 100) : 0}%`}}
                              >
                                {stats.totalAttendanceOccurrences && stats.totalAttendanceOccurrences > 0 ? Math.round(Math.min((stats.afterSessionApproved / stats.totalAttendanceOccurrences) * 100, 100)) : 0}%
                              </div>
                            </div>
                          </td>
                          <td><small className="text-muted">Tổng số lần phép vắng sau buổi đã duyệt</small></td>
                              </tr>
                            </tbody>
                    </table>
                  </div>
                </div>
                </Tab>
                
              <Tab eventKey="classReport" title={
                <span className="tab-title">
                  <i className="fas fa-graduation-cap"></i>
                  Báo cáo theo lớp
                </span>
              }>
                <div className="session-table-container">
                  
                  
                  <div className="table-responsive">
                    <table className="session-table">
                      <thead>
                          <tr>
                            <th>Lớp</th>
                            <th>Tổng số SV</th>
                            <th>Đầy đủ</th>
                            <th>Trước</th>
                            <th>Trong</th>
                            <th>Sau</th>
                            <th>Có mặt</th>
                            <th>Đi trễ</th>
                            <th>Vắng</th>
                            <th>Phép cả buổi</th>
                            <th>Phép trước</th>
                            <th>Phép trong</th>
                            <th>Phép sau</th>
                          </tr>
                        </thead>
                        <tbody>
                        {(() => {
                          // Calculate attendance statistics by class
                          const classSummaries = {};
                          
                          // Use detailedMembers data if attendanceData is empty
                          let dataToProcess = attendanceData;
                          
                          // Get absence request stats by class
                          const absenceStatsByClass = {};
                          if (stats.fullSessionApproved !== undefined) {
                            // For now, we'll distribute absence stats evenly across classes
                            // In a real implementation, you might want to fetch this data from API
                            const totalClasses = uniqueClasses.length || 1;
                            const classNames = uniqueClasses.map(cls => cls.name || cls);
                            
                            classNames.forEach(className => {
                              absenceStatsByClass[className] = {
                                fullSessionApproved: Math.floor(stats.fullSessionApproved / totalClasses),
                                beforeSessionApproved: Math.floor(stats.beforeSessionApproved / totalClasses),
                                duringSessionApproved: Math.floor(stats.duringSessionApproved / totalClasses),
                                afterSessionApproved: Math.floor(stats.afterSessionApproved / totalClasses)
                              };
                            });
                          }
                          if ((!attendanceData || !Array.isArray(attendanceData) || attendanceData.length === 0) && 
                              detailedMembers && Array.isArray(detailedMembers) && detailedMembers.length > 0) {
                            dataToProcess = detailedMembers.map(member => ({
                              member: {
                                _id: member.id,
                                class: member.class,
                                fullName: member.fullName,
                                gender: member.gender,
                                email: member.email,
                                faculty_name: member.faculty_name
                              },
                              status: member.attendanceStatus,
                              attendance_type: member.attendanceStatus,
                              timestamp: member.attendanceTimestamp,
                              faculty_name: member.faculty_name
                            }));
                          }

                          // Function to get students by attendance type for a specific class
                          const getStudentsByAttendanceTypeForClass = (className, attendanceType) => {
                            if (!dataToProcess || !Array.isArray(dataToProcess)) return [];
                            
                            return dataToProcess.filter(record => {
                              const recordClassName = record.member?.class || record.class_name || record.class;
                              if (recordClassName !== className) return false;
                              
                              const studentId = record.member?._id || record.student_id || record.member_id;
                              const recordAttendanceType = record.status || record.attendance_type || record.type;
                              
                              if (!studentId || !recordAttendanceType) return false;
                              
                              // Get all attendance types for this student in this class
                              const studentAttendanceTypes = new Set();
                              dataToProcess.forEach(r => {
                                const rClassName = r.member?.class || r.class_name || r.class;
                                const rStudentId = r.member?._id || r.student_id || r.member_id;
                                const rAttendanceType = r.status || r.attendance_type || r.type;
                                
                                if (rClassName === className && rStudentId === studentId && rAttendanceType) {
                                  studentAttendanceTypes.add(rAttendanceType);
                                }
                              });
                              
                              // Apply the same logic as SessionDetail.js
                              const hasBeforeAttendance = studentAttendanceTypes.has('before');
                              const hasDuringAttendance = studentAttendanceTypes.has('during');
                              const hasAfterAttendance = studentAttendanceTypes.has('after');
                              const hasLateAttendance = studentAttendanceTypes.has('late');
                              const hasEarlyAttendance = studentAttendanceTypes.has('early');
                              const hasLateLeaveAttendance = studentAttendanceTypes.has('late_leave');
                              
                              // Check for absence with permission types
                              const hasAbsentPerm = studentAttendanceTypes.has('absent_perm');
                              const hasAbsentBeforePerm = studentAttendanceTypes.has('absent_before_perm');
                              const hasAbsentDuringPerm = studentAttendanceTypes.has('absent_during_perm');
                              const hasAbsentAfterPerm = studentAttendanceTypes.has('absent_after_perm');
                              
                              // Determine final status based on the same logic
                              if (attendanceType === 'full') {
                                // Trường hợp 1: Có mặt trước + Có mặt trong + Có mặt sau (hoặc Về trễ) → Đầy đủ
                                if ((hasBeforeAttendance && hasDuringAttendance && (hasAfterAttendance || hasLateLeaveAttendance)) ||
                                    (hasEarlyAttendance && hasDuringAttendance && (hasAfterAttendance || hasLateLeaveAttendance))) {
                                  return true;
                                }
                                // Trường hợp 2: Đi trễ + Có mặt trong + Có mặt sau → Đầy đủ và Đi trễ
                                if (hasLateAttendance && hasDuringAttendance && hasAfterAttendance) {
                                  return true;
                                }
                                // Trường hợp 3: Đi trễ + Có mặt trong + Về trễ → Đầy đủ và Đi trễ
                                if (hasLateAttendance && hasDuringAttendance && hasLateLeaveAttendance) {
                                  return true;
                                }
                                // Trường hợp 4: Đi trước (hoặc Có mặt trước) + Có mặt trong + Có mặt sau → Đầy đủ
                                if ((hasEarlyAttendance || hasBeforeAttendance) && hasDuringAttendance && hasAfterAttendance) {
                                  return true;
                                }
                                return false;
                              }
                              
                              if (attendanceType === 'late') {
                                // Check if student has late attendance (either in combination with full or alone)
                                return hasLateAttendance;
                              }
                              
                              if (attendanceType === 'absent_perm') {
                                return hasAbsentPerm;
                              }
                              
                              if (attendanceType === 'absent_before_perm') {
                                return hasAbsentBeforePerm;
                              }
                              
                              if (attendanceType === 'absent_during_perm') {
                                return hasAbsentDuringPerm;
                              }
                              
                              if (attendanceType === 'absent_after_perm') {
                                return hasAbsentAfterPerm;
                              }
                              
                              // For individual types, check if they exist and are not part of full attendance
                              if (attendanceType === 'before') {
                                return hasBeforeAttendance && !(
                                  (hasBeforeAttendance && hasDuringAttendance && (hasAfterAttendance || hasLateLeaveAttendance)) ||
                                  ((hasEarlyAttendance || hasBeforeAttendance) && hasDuringAttendance && hasAfterAttendance)
                                );
                              }
                              
                              if (attendanceType === 'during') {
                                return hasDuringAttendance && !(
                                  (hasBeforeAttendance && hasDuringAttendance && (hasAfterAttendance || hasLateLeaveAttendance)) ||
                                  (hasLateAttendance && hasDuringAttendance && hasAfterAttendance) ||
                                  (hasLateAttendance && hasDuringAttendance && hasLateLeaveAttendance) ||
                                  ((hasEarlyAttendance || hasBeforeAttendance) && hasDuringAttendance && hasAfterAttendance)
                                );
                              }
                              
                              if (attendanceType === 'after') {
                                return hasAfterAttendance && !(
                                  (hasBeforeAttendance && hasDuringAttendance && (hasAfterAttendance || hasLateLeaveAttendance)) ||
                                  (hasLateAttendance && hasDuringAttendance && hasAfterAttendance) ||
                                  ((hasEarlyAttendance || hasBeforeAttendance) && hasDuringAttendance && hasAfterAttendance)
                                );
                              }
                              
                              if (attendanceType === 'early') {
                                return hasEarlyAttendance && !(
                                  (hasEarlyAttendance && hasDuringAttendance && (hasAfterAttendance || hasLateLeaveAttendance)) ||
                                  ((hasEarlyAttendance || hasBeforeAttendance) && hasDuringAttendance && hasAfterAttendance)
                                );
                              }
                              
                              if (attendanceType === 'late_leave') {
                                return hasLateLeaveAttendance && !(
                                  (hasBeforeAttendance && hasDuringAttendance && (hasAfterAttendance || hasLateLeaveAttendance)) ||
                                  (hasLateAttendance && hasDuringAttendance && hasLateLeaveAttendance)
                                );
                              }
                              
                              if (attendanceType === 'present') {
                                return studentAttendanceTypes.has('present') && !studentAttendanceTypes.has('before') && 
                                       !studentAttendanceTypes.has('during') && !studentAttendanceTypes.has('after') &&
                                       !studentAttendanceTypes.has('early') && !studentAttendanceTypes.has('late') &&
                                       !studentAttendanceTypes.has('late_leave') && !studentAttendanceTypes.has('absent');
                              }
                              
                              if (attendanceType === 'absent') {
                                return studentAttendanceTypes.has('absent') && !hasAbsentPerm && !hasAbsentBeforePerm &&
                                       !hasAbsentDuringPerm && !hasAbsentAfterPerm;
                              }
                              
                              return false;
                            }).map(record => ({
                              fullName: record.member?.fullName || record.full_name || record.name,
                              studentId: record.member?._id || record.student_id || record.member_id
                            }));
                          };
                          
                          // Process all attendance data to group by class
                          if (!dataToProcess || !Array.isArray(dataToProcess) || dataToProcess.length === 0) {
                            return (
                              <tr>
                                <td colSpan="13" className="text-center py-4">
                                  <div className="text-muted">
                                    <i className="fas fa-info-circle me-2"></i>
                                    Không có dữ liệu điểm danh để hiển thị báo cáo theo lớp
                                  </div>
                                </td>
                              </tr>
                            );
                          }
                          
                          dataToProcess.forEach(record => {
                            const className = record.member?.class || record.class_name || record.class;
                            const studentId = record.member?._id || record.student_id || record.member_id;
                            const attendanceType = record.status || record.attendance_type || record.type;
                            
                            if (!className || !studentId || !attendanceType) {
                              return;
                            }
                            
                            if (!classSummaries[className]) {
                              classSummaries[className] = {
                                name: className,
                                faculty: record.member?.faculty_name || record.faculty_name || '-',
                                students: new Set(),
                                studentAttendance: {},
                                fullCount: 0,
                                beforeCount: 0,
                                duringCount: 0,
                                afterCount: 0,
                                presentCount: 0,
                                earlyCount: 0,
                                lateCount: 0,
                                lateLeaveCount: 0,
                                absentCount: 0,
                                absentPermCount: 0,
                                earlyPermCount: 0,
                                duringPermCount: 0,
                                latePermCount: 0,
                                // Absence request stats (approved)
                                fullSessionApproved: 0,
                                beforeSessionApproved: 0,
                                duringSessionApproved: 0,
                                afterSessionApproved: 0
                              };
                            }
                            
                            // Add student to the class
                            classSummaries[className].students.add(studentId);
                            
                            // Initialize student attendance record if not exists
                            if (!classSummaries[className].studentAttendance[studentId]) {
                              classSummaries[className].studentAttendance[studentId] = new Set();
                            }
                            
                            // Add attendance type to student record
                            classSummaries[className].studentAttendance[studentId].add(attendanceType);
                          });
                          
                            // Assign absence request stats to each class
                            Object.values(classSummaries).forEach(classSummary => {
                              const className = classSummary.name;
                              if (absenceStatsByClass[className]) {
                                classSummary.fullSessionApproved = absenceStatsByClass[className].fullSessionApproved;
                                classSummary.beforeSessionApproved = absenceStatsByClass[className].beforeSessionApproved;
                                classSummary.duringSessionApproved = absenceStatsByClass[className].duringSessionApproved;
                                classSummary.afterSessionApproved = absenceStatsByClass[className].afterSessionApproved;
                              }
                          });
                          
                            // Calculate attendance statistics for each class
                            Object.values(classSummaries).forEach(classSummary => {
                              // Calculate absent students for this class
                              // Use the same logic as tab "Báo cáo trạng thái" - distribute from stats.absent
                              if (stats.absent !== undefined) {
                                const totalClasses = uniqueClasses.length || 1;
                                classSummary.absentCount = Math.floor(stats.absent / totalClasses);
                              } else {
                                // Fallback: calculate based on available data
                                const totalStudentsInClass = classSummary.students.size;
                                const studentsWithAttendance = Object.keys(classSummary.studentAttendance).length;
                                classSummary.absentCount = Math.max(0, totalStudentsInClass - studentsWithAttendance);
                              }
                              
                              // Calculate late attendance for this class using same logic as tab "Báo cáo trạng thái"
                              // Count actual late attendance occurrences in this class from attendanceData (processedData)
                              let lateCount = 0;
                              attendanceData.forEach(record => {
                                const recordClassName = record.member?.class || record.class_name || record.class;
                                const attendanceType = record.status || record.attendance_type;
                                
                                if (recordClassName === classSummary.name && attendanceType === 'late') {
                                  lateCount++;
                                }
                              });
                              classSummary.lateCount = lateCount;
                              
                              // Calculate before attendance for this class using same logic as tab "Báo cáo trạng thái"
                              // Count actual before attendance occurrences in this class from attendanceData (processedData)
                              let beforeCount = 0;
                              attendanceData.forEach(record => {
                                const recordClassName = record.member?.class || record.class_name || record.class;
                                const attendanceType = record.status || record.attendance_type;
                                
                                if (recordClassName === classSummary.name && attendanceType === 'before') {
                                  beforeCount++;
                                }
                              });
                              classSummary.beforeCount = beforeCount;
                              
                              // Calculate present attendance for this class using same logic as tab "Báo cáo trạng thái"
                              // Count actual present attendance occurrences in this class from attendanceData (processedData)
                              let presentCount = 0;
                              attendanceData.forEach(record => {
                                const recordClassName = record.member?.class || record.class_name || record.class;
                                const attendanceType = record.status || record.attendance_type;
                                
                                if (recordClassName === classSummary.name && attendanceType === 'present') {
                                  presentCount++;
                                }
                              });
                              classSummary.presentCount = presentCount;
                              
                              // Calculate during attendance for this class using same logic as tab "Báo cáo trạng thái"
                              // Count actual during attendance occurrences in this class from attendanceData (processedData)
                              let duringCount = 0;
                              attendanceData.forEach(record => {
                                const recordClassName = record.member?.class || record.class_name || record.class;
                                const attendanceType = record.status || record.attendance_type;
                                
                                if (recordClassName === classSummary.name && attendanceType === 'during') {
                                  duringCount++;
                                }
                              });
                              classSummary.duringCount = duringCount;
                              
                              // Calculate after attendance for this class using same logic as tab "Báo cáo trạng thái"
                              // Count actual after attendance occurrences in this class from attendanceData (processedData)
                              let afterCount = 0;
                              attendanceData.forEach(record => {
                                const recordClassName = record.member?.class || record.class_name || record.class;
                                const attendanceType = record.status || record.attendance_type;
                                
                                if (recordClassName === classSummary.name && attendanceType === 'after') {
                                  afterCount++;
                                }
                              });
                              classSummary.afterCount = afterCount;
                              
                              // Calculate full attendance for this class using same logic as tab "Báo cáo trạng thái"
                              // Group attendance by student-session for this class from attendanceData (processedData)
                              const studentSessionAttendance = {};
                              attendanceData.forEach(record => {
                                const recordClassName = record.member?.class || record.class_name || record.class;
                                const attendanceType = record.status || record.attendance_type;
                                const studentId = record.student_id || record.studentId;
                                const sessionId = record.session_id || record.sessionId;
                                
                                if (recordClassName === classSummary.name) {
                                  const key = `${studentId}-${sessionId}`;
                                  if (!studentSessionAttendance[key]) {
                                    studentSessionAttendance[key] = new Set();
                                  }
                                  studentSessionAttendance[key].add(attendanceType);
                                }
                              });
                              
                              // Check for full attendance combinations for this class
                              let fullCount = 0;
                              Object.values(studentSessionAttendance).forEach(statusSet => {
                                // Trường hợp 1: Có mặt trước + Có mặt trong + Có mặt sau (hoặc Về trễ) → Đầy đủ
                                if ((statusSet.has('before') && statusSet.has('during') && (statusSet.has('after') || statusSet.has('late_leave'))) ||
                                    (statusSet.has('early') && statusSet.has('during') && (statusSet.has('after') || statusSet.has('late_leave')))) {
                                  fullCount++;
                                  return;
                                }
                                
                                // Trường hợp 2: Đi trễ + Có mặt trong + Có mặt sau → Đầy đủ
                                if (statusSet.has('late') && statusSet.has('during') && statusSet.has('after')) {
                                  fullCount++;
                                  return;
                                }
                                
                                // Trường hợp 3: Đi trễ + Có mặt trong + Về trễ → Đầy đủ
                                if (statusSet.has('late') && statusSet.has('during') && statusSet.has('late_leave')) {
                                  fullCount++;
                                  return;
                                }
                                
                                // Trường hợp 4: Đi trước (hoặc Có mặt trước) + Có mặt trong + Có mặt sau → Đầy đủ
                                if ((statusSet.has('early') || statusSet.has('before')) && statusSet.has('during') && statusSet.has('after')) {
                                  fullCount++;
                                  return;
                                }
                              });
                              
                              classSummary.fullCount = fullCount;
                            });
                          
                          // Convert to array and sort by class name
                          const classArray = Object.values(classSummaries).sort((a, b) => 
                            a.name.localeCompare(b.name)
                          );
                          
                          
                          // Return the class rows
                          return classArray.map((classData, index) => {
                            const totalStudents = classData.students.size;
                          
                          return (
                            <tr key={index}>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="class-icon">
                                    <i className="fas fa-graduation-cap"></i>
                                  </div>
                                  <div>
                                    <div className="fw-bold">{classData.name}</div>
                                    <small className="text-muted">{classData.faculty || '-'}</small>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <Badge bg="primary" className="fs-6">{totalStudents}</Badge>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-success"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-full-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                            <strong>Đầy đủ:</strong><br/>
                                            {classData.fullCount} lần có mặt đầy đủ thời gian
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{classData.fullCount}</strong>
                                  </OverlayTrigger>
                                </div>
                              </td>
                                <td>
                                  <div className="d-flex align-items-center">
                                    <div className="status-indicator bg-success"></div>
                                    <OverlayTrigger
                                      placement="top"
                                      overlay={
                                        <Tooltip id={`tooltip-before-${index}`}>
                                          <div style={{ maxWidth: '300px' }}>
                                            <strong>Có mặt trước:</strong><br/>
                                            {classData.beforeCount} lần điểm danh trước buổi học
                                          </div>
                                        </Tooltip>
                                      }
                                    >
                                      <strong style={{ cursor: 'pointer' }}>{classData.beforeCount}</strong>
                                    </OverlayTrigger>
                                  </div>
                                </td>
                                <td>
                                  <div className="d-flex align-items-center">
                                    <div className="status-indicator bg-success"></div>
                                    <OverlayTrigger
                                      placement="top"
                                      overlay={
                                        <Tooltip id={`tooltip-during-${index}`}>
                                          <div style={{ maxWidth: '300px' }}>
                                            <strong>Có mặt trong:</strong><br/>
                                            {classData.duringCount} lần điểm danh trong buổi học
                                          </div>
                                        </Tooltip>
                                      }
                                    >
                                      <strong style={{ cursor: 'pointer' }}>{classData.duringCount}</strong>
                                    </OverlayTrigger>
                                  </div>
                                </td>
                                <td>
                                  <div className="d-flex align-items-center">
                                    <div className="status-indicator bg-success"></div>
                                    <OverlayTrigger
                                      placement="top"
                                      overlay={
                                        <Tooltip id={`tooltip-after-${index}`}>
                                          <div style={{ maxWidth: '300px' }}>
                                            <strong>Có mặt sau:</strong><br/>
                                            {classData.afterCount} lần điểm danh sau buổi học
                                          </div>
                                        </Tooltip>
                                      }
                                    >
                                      <strong style={{ cursor: 'pointer' }}>{classData.afterCount}</strong>
                                    </OverlayTrigger>
                                  </div>
                                </td>
                                <td>
                                  <div className="d-flex align-items-center">
                                    <div className="status-indicator bg-success"></div>
                                    <OverlayTrigger
                                      placement="top"
                                      overlay={
                                        <Tooltip id={`tooltip-present-${index}`}>
                                          <div style={{ maxWidth: '300px' }}>
                                            <strong>Có mặt:</strong><br/>
                                            {classData.presentCount} lần điểm danh (không xác định thời điểm)
                                          </div>
                                        </Tooltip>
                                      }
                                    >
                                      <strong style={{ cursor: 'pointer' }}>{classData.presentCount}</strong>
                                    </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-warning"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-late-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Đi trễ:</strong><br/>
                                          {classData.lateCount} lần điểm danh đi trễ so với giờ bắt đầu
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{classData.lateCount}</strong>
                                    </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-danger"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-absent-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Sinh viên vắng mặt:</strong><br/>
                                          {classData.absentCount} sinh viên không có bất kỳ bản ghi điểm danh nào
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{classData.absentCount}</strong>
                                  </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                    <div className="status-indicator bg-danger"></div>
                                    <OverlayTrigger
                                      placement="top"
                                      overlay={
                                        <Tooltip id={`tooltip-full-session-approved-${index}`}>
                                          <div style={{ maxWidth: '300px' }}>
                                            <strong>Phép cả buổi đã duyệt:</strong><br/>
                                            {classData.fullSessionApproved} yêu cầu đã được duyệt
                                          </div>
                                        </Tooltip>
                                      }
                                    >
                                      <strong style={{ cursor: 'pointer' }}>{classData.fullSessionApproved || 0}</strong>
                                    </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                  <div className="d-flex align-items-center">
                                    <div className="status-indicator bg-info"></div>
                                    <OverlayTrigger
                                      placement="top"
                                      overlay={
                                        <Tooltip id={`tooltip-before-session-approved-${index}`}>
                                          <div style={{ maxWidth: '300px' }}>
                                            <strong>Phép trước buổi đã duyệt:</strong><br/>
                                            {classData.beforeSessionApproved} yêu cầu đã được duyệt
                                          </div>
                                        </Tooltip>
                                      }
                                    >
                                      <strong style={{ cursor: 'pointer' }}>{classData.beforeSessionApproved || 0}</strong>
                                    </OverlayTrigger>
                                  </div>
                              </td>
                                <td>
                                  <div className="d-flex align-items-center">
                                    <div className="status-indicator bg-warning"></div>
                                    <OverlayTrigger
                                      placement="top"
                                      overlay={
                                        <Tooltip id={`tooltip-during-session-approved-${index}`}>
                                          <div style={{ maxWidth: '300px' }}>
                                            <strong>Phép trong buổi đã duyệt:</strong><br/>
                                            {classData.duringSessionApproved} yêu cầu đã được duyệt
                                          </div>
                                        </Tooltip>
                                      }
                                    >
                                      <strong style={{ cursor: 'pointer' }}>{classData.duringSessionApproved || 0}</strong>
                                    </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                  <div className="d-flex align-items-center">
                                    <div className="status-indicator bg-secondary"></div>
                                    <OverlayTrigger
                                      placement="top"
                                      overlay={
                                        <Tooltip id={`tooltip-after-session-approved-${index}`}>
                                          <div style={{ maxWidth: '300px' }}>
                                            <strong>Phép sau buổi đã duyệt:</strong><br/>
                                            {classData.afterSessionApproved} yêu cầu đã được duyệt
                                          </div>
                                        </Tooltip>
                                      }
                                    >
                                      <strong style={{ cursor: 'pointer' }}>{classData.afterSessionApproved || 0}</strong>
                                    </OverlayTrigger>
                                </div>
                              </td>
                            </tr>
                          );
                          });
                        })()}
                        </tbody>
                    </table>
                  </div>
                </div>
                </Tab>
                
              <Tab eventKey="hospitalReport" title={
                <span className="tab-title">
                  <i className="fas fa-hospital"></i>
                  Báo cáo theo bệnh viện
                </span>
              }>
                <div className="session-table-container">
                  
                  <div className="table-responsive">
                    <table className="session-table">
                      <thead>
                          <tr>
                            <th>Bệnh viện</th>
                            <th>Tổng số SV</th>
                            <th>Đầy đủ</th>
                            <th>Trước</th>
                            <th>Trong</th>
                            <th>Sau</th>
                            <th>Có mặt</th>
                            <th>Đi trễ</th>
                            <th>Vắng</th>
                            <th>Phép cả buổi</th>
                            <th>Phép trước</th>
                            <th>Phép trong</th>
                            <th>Phép sau</th>
                          </tr>
                        </thead>
                        <tbody>
                        {(() => {
                          // Calculate hospital statistics from real data
                          const hospitalStats = {};
                          
                          // Initialize hospital stats from actual data
                          const uniqueLocations = new Set();
                          if (attendanceData && attendanceData.length > 0) {
                            attendanceData.forEach(record => {
                              const location = record.session_location || record.location || record.hospital?.name || record.hospital_name || record.hospital;
                              if (location && location !== "-- Chọn vị trí có sẵn --") {
                                uniqueLocations.add(location);
                              }
                            });
                          }
                          
                          // Also include hospitals from the predefined list
                          hospitals.forEach(hospital => {
                            if (hospital.name !== "-- Chọn vị trí có sẵn --") {
                              uniqueLocations.add(hospital.name);
                            }
                          });
                          
                          // Initialize stats for all unique locations
                          uniqueLocations.forEach(location => {
                            hospitalStats[location] = {
                              name: location,
                              totalStudents: 0,
                              fullCount: 0,
                              beforeCount: 0,
                              duringCount: 0,
                              afterCount: 0,
                              presentCount: 0,
                              lateCount: 0,
                              absentCount: 0,
                              fullPermCount: 0,
                              beforePermCount: 0,
                              duringPermCount: 0,
                              afterPermCount: 0
                            };
                          });
                          
                          // Process attendance data for each hospital
                          if (attendanceData && attendanceData.length > 0) {
                            console.log('Hospital report - Processing attendance data:', {
                              totalRecords: attendanceData.length,
                              sampleRecord: attendanceData[0],
                              uniqueLocations: Array.from(uniqueLocations),
                              hospitalStatsKeys: Object.keys(hospitalStats)
                            });
                            
                            // Group attendance by student-session for each hospital
                            const hospitalStudentSessions = {};
                            
                            attendanceData.forEach(record => {
                              const hospitalName = record.session_location || record.location || record.hospital?.name || record.hospital_name || record.hospital;
                              const studentId = record.student_id || record.studentId;
                              const sessionId = record.session_id || record.sessionId;
                              const attendanceType = record.status || record.attendance_type;
                              
                              if (hospitalName && hospitalStats[hospitalName]) {
                                const key = `${studentId}-${sessionId}`;
                                if (!hospitalStudentSessions[hospitalName]) {
                                  hospitalStudentSessions[hospitalName] = {};
                                }
                                if (!hospitalStudentSessions[hospitalName][key]) {
                                  hospitalStudentSessions[hospitalName][key] = new Set();
                                }
                                hospitalStudentSessions[hospitalName][key].add(attendanceType);
                                
                                // Count individual attendance types
                                if (attendanceType === 'before') hospitalStats[hospitalName].beforeCount++;
                                if (attendanceType === 'during') hospitalStats[hospitalName].duringCount++;
                                if (attendanceType === 'after') hospitalStats[hospitalName].afterCount++;
                                if (attendanceType === 'present') hospitalStats[hospitalName].presentCount++;
                                if (attendanceType === 'late') hospitalStats[hospitalName].lateCount++;
                                if (attendanceType === 'absent') hospitalStats[hospitalName].absentCount++;
                                
                                console.log('Hospital processing:', {
                                  hospitalName,
                                  studentId,
                                  sessionId,
                                  attendanceType,
                                  beforeCount: hospitalStats[hospitalName].beforeCount,
                                  duringCount: hospitalStats[hospitalName].duringCount,
                                  afterCount: hospitalStats[hospitalName].afterCount
                                });
                              } else {
                                console.log('Hospital not found or invalid:', {
                                  hospitalName,
                                  availableHospitals: Object.keys(hospitalStats),
                                  record: record
                                });
                              }
                            });
                            
                            // Calculate full attendance for each hospital
                            Object.keys(hospitalStudentSessions).forEach(hospitalName => {
                              const studentSessions = hospitalStudentSessions[hospitalName];
                              let fullCount = 0;
                              
                              Object.values(studentSessions).forEach(statusSet => {
                                // Trường hợp 1: Có mặt trước + Có mặt trong + Có mặt sau (hoặc Về trễ) → Đầy đủ
                                if ((statusSet.has('before') && statusSet.has('during') && (statusSet.has('after') || statusSet.has('late_leave'))) ||
                                    (statusSet.has('early') && statusSet.has('during') && (statusSet.has('after') || statusSet.has('late_leave')))) {
                                  fullCount++;
                                  return;
                                }
                                
                                // Trường hợp 2: Đi trễ + Có mặt trong + Có mặt sau → Đầy đủ
                                if (statusSet.has('late') && statusSet.has('during') && statusSet.has('after')) {
                                  fullCount++;
                                  return;
                                }
                                
                                // Trường hợp 3: Đi trễ + Có mặt trong + Về trễ → Đầy đủ
                                if (statusSet.has('late') && statusSet.has('during') && statusSet.has('late_leave')) {
                                  fullCount++;
                                  return;
                                }
                                
                                // Trường hợp 4: Đi trước (hoặc Có mặt trước) + Có mặt trong + Có mặt sau → Đầy đủ
                                if ((statusSet.has('early') || statusSet.has('before')) && statusSet.has('during') && statusSet.has('after')) {
                                  fullCount++;
                                  return;
                                }
                              });
                              
                              hospitalStats[hospitalName].fullCount = fullCount;
                              
                              // Count unique students for this hospital
                              const uniqueStudents = new Set();
                              Object.keys(studentSessions).forEach(key => {
                                const studentId = key.split('-')[0];
                                uniqueStudents.add(studentId);
                              });
                              hospitalStats[hospitalName].totalStudents = uniqueStudents.size;
                            });
                          }
                          
                          // Calculate absence request stats for each hospital from actual data
                          // Note: Since we don't have direct absence request data per hospital,
                          // we'll use the same distribution logic as other tabs but based on hospital data
                          const hospitalNames = Object.keys(hospitalStats);
                          if (hospitalNames.length > 0) {
                            // Calculate total attendance occurrences across all hospitals
                            let totalAttendanceOccurrences = 0;
                            hospitalNames.forEach(hospitalName => {
                              const hospital = hospitalStats[hospitalName];
                              totalAttendanceOccurrences += hospital.beforeCount + hospital.duringCount + 
                                                           hospital.afterCount + hospital.presentCount + 
                                                           hospital.lateCount + hospital.absentCount;
                            });
                            
                            // Distribute absence request stats proportionally based on attendance data
                            hospitalNames.forEach(hospitalName => {
                              const hospital = hospitalStats[hospitalName];
                              const hospitalAttendanceOccurrences = hospital.beforeCount + hospital.duringCount + 
                                                                   hospital.afterCount + hospital.presentCount + 
                                                                   hospital.lateCount + hospital.absentCount;
                              
                              if (totalAttendanceOccurrences > 0) {
                                const proportion = hospitalAttendanceOccurrences / totalAttendanceOccurrences;
                                hospital.fullPermCount = Math.round(stats.fullSessionApproved * proportion);
                                hospital.beforePermCount = Math.round(stats.beforeSessionApproved * proportion);
                                hospital.duringPermCount = Math.round(stats.duringSessionApproved * proportion);
                                hospital.afterPermCount = Math.round(stats.afterSessionApproved * proportion);
                              } else {
                                // If no attendance data, distribute evenly
                                hospital.fullPermCount = Math.floor(stats.fullSessionApproved / hospitalNames.length);
                                hospital.beforePermCount = Math.floor(stats.beforeSessionApproved / hospitalNames.length);
                                hospital.duringPermCount = Math.floor(stats.duringSessionApproved / hospitalNames.length);
                                hospital.afterPermCount = Math.floor(stats.afterSessionApproved / hospitalNames.length);
                              }
                              
                              console.log('Hospital absence stats calculation:', {
                                hospitalName,
                                hospitalAttendanceOccurrences,
                                totalAttendanceOccurrences,
                                proportion: totalAttendanceOccurrences > 0 ? hospitalAttendanceOccurrences / totalAttendanceOccurrences : 0,
                                fullPermCount: hospital.fullPermCount,
                                beforePermCount: hospital.beforePermCount,
                                duringPermCount: hospital.duringPermCount,
                                afterPermCount: hospital.afterPermCount,
                                statsFull: stats.fullSessionApproved,
                                statsBefore: stats.beforeSessionApproved,
                                statsDuring: stats.duringSessionApproved,
                                statsAfter: stats.afterSessionApproved
                              });
                            });
                          }
                          
                          return Object.values(hospitalStats).map((hospitalData, index) => {
                          return (
                            <tr key={index}>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="hospital-icon">
                                    <i className="fas fa-hospital"></i>
                                  </div>
                                  <div>
                                    <div className="fw-bold">{hospitalData.name}</div>
                                    <small className="text-muted">
                                      {hospitalData.name.includes("Đà Nẵng") ? "Đà Nẵng" : 
                                       hospitalData.name.includes("Quảng Nam") ? "Quảng Nam" : 
                                       hospitalData.name.includes("Sài Gòn") ? "TP. Hồ Chí Minh" :
                                       hospitalData.name.includes("Nha Trang") ? "Khánh Hòa" :
                                       hospitalData.name.includes("Đồng Tháp") || hospitalData.name.includes("Cao Lãnh") || hospitalData.name.includes("Hồng Ngự") ? "Đồng Tháp" :
                                       hospitalData.name.includes("Phan Châu Trinh") ? "Đà Nẵng" :
                                       "Việt Nam"}
                                    </small>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <Badge bg="primary" className="fs-6">{hospitalData.totalStudents}</Badge>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-success"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-full-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Đầy đủ:</strong><br/>
                                          {hospitalData.fullCount} lần có mặt đầy đủ thời gian
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{hospitalData.fullCount}</strong>
                                  </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-info"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-before-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Có mặt trước:</strong><br/>
                                          {hospitalData.beforeCount} lần có mặt trước buổi
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{hospitalData.beforeCount}</strong>
                                  </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-primary"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-during-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Có mặt trong:</strong><br/>
                                          {hospitalData.duringCount} lần có mặt trong buổi
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{hospitalData.duringCount}</strong>
                                  </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-secondary"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-after-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Có mặt sau:</strong><br/>
                                          {hospitalData.afterCount} lần có mặt sau buổi
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{hospitalData.afterCount}</strong>
                                  </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-success"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-present-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Có mặt:</strong><br/>
                                          {hospitalData.presentCount} lần có mặt
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{hospitalData.presentCount}</strong>
                                  </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-warning"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-late-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Đi trễ:</strong><br/>
                                          {hospitalData.lateCount} lần đi trễ
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{hospitalData.lateCount}</strong>
                                  </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-danger"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-absent-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Vắng mặt:</strong><br/>
                                          {hospitalData.absentCount} lần vắng mặt
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{hospitalData.absentCount}</strong>
                                  </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-secondary"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-full-perm-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Phép cả buổi:</strong><br/>
                                          {hospitalData.fullPermCount} lần xin phép cả buổi (đã duyệt)
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{hospitalData.fullPermCount}</strong>
                                  </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-info"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-before-perm-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Phép trước buổi:</strong><br/>
                                          {hospitalData.beforePermCount} lần xin phép trước buổi (đã duyệt)
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{hospitalData.beforePermCount}</strong>
                                  </OverlayTrigger>
                                  </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-primary"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-during-perm-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Phép trong buổi:</strong><br/>
                                          {hospitalData.duringPermCount} lần xin phép trong buổi (đã duyệt)
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{hospitalData.duringPermCount}</strong>
                                  </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-secondary"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-after-perm-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Phép sau buổi:</strong><br/>
                                          {hospitalData.afterPermCount} lần xin phép sau buổi (đã duyệt)
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{hospitalData.afterPermCount}</strong>
                                  </OverlayTrigger>
                                </div>
                              </td>
                            </tr>
                          );
                          });
                        })()}
                        </tbody>
                    </table>
                  </div>
                </div>
                </Tab>
                
              <Tab eventKey="dateReport" title={
                <span className="tab-title">
                  <i className="fas fa-calendar-day"></i>
                  Báo cáo theo ngày
                </span>
              }>
                <div className="session-table-container">
                  
                  
                  <div className="table-responsive">
                    <table className="session-table">
                      <thead>
                          <tr>
                            <th>Ngày</th>
                            <th>Tổng số buổi</th>
                            <th>Tổng số SV</th>
                            <th>Đầy đủ</th>
                            <th>Trước</th>
                            <th>Trong</th>
                            <th>Sau</th>
                            <th>Có mặt</th>
                            <th>Đi trễ</th>
                            <th>Vắng</th>
                            <th>Phép cả buổi</th>
                            <th>Phép trước</th>
                            <th>Phép trong</th>
                            <th>Phép sau</th>
                          </tr>
                        </thead>
                        <tbody>
                        {(() => {
                          // Calculate date statistics from real data
                          const dateStats = {};
                          
                          // Initialize date stats from actual data
                          const uniqueDates = new Set();
                          if (attendanceData && attendanceData.length > 0) {
                            attendanceData.forEach(record => {
                              const sessionDate = record.session_date || record.date;
                              if (sessionDate) {
                                const dateStr = new Date(sessionDate).toLocaleDateString('vi-VN');
                                uniqueDates.add(dateStr);
                              }
                            });
                          }
                          
                          // Generate last 5 days if no data
                          if (uniqueDates.size === 0) {
                            for (let i = 0; i < 5; i++) {
                            const date = new Date();
                              date.setDate(date.getDate() - i);
                              uniqueDates.add(date.toLocaleDateString('vi-VN'));
                            }
                          }
                          
                          // Initialize stats for all unique dates
                          uniqueDates.forEach(dateStr => {
                            dateStats[dateStr] = {
                              date: dateStr,
                              totalSessions: 0,
                              totalStudents: 0,
                              fullCount: 0,
                              beforeCount: 0,
                              duringCount: 0,
                              afterCount: 0,
                              presentCount: 0,
                              lateCount: 0,
                              absentCount: 0,
                              fullPermCount: 0,
                              beforePermCount: 0,
                              duringPermCount: 0,
                              afterPermCount: 0
                            };
                          });
                          
                          // Process attendance data for each date
                          if (attendanceData && attendanceData.length > 0) {
                            console.log('Date report - Processing attendance data:', {
                              totalRecords: attendanceData.length,
                              sampleRecord: attendanceData[0],
                              uniqueDates: Array.from(uniqueDates),
                              dateStatsKeys: Object.keys(dateStats)
                            });
                            
                            // Group attendance by student-session for each date
                            const dateStudentSessions = {};
                            
                            attendanceData.forEach(record => {
                              const sessionDate = record.session_date || record.date;
                              const studentId = record.student_id || record.studentId;
                              const sessionId = record.session_id || record.sessionId;
                              const attendanceType = record.status || record.attendance_type;
                              
                              if (sessionDate) {
                                const dateStr = new Date(sessionDate).toLocaleDateString('vi-VN');
                                
                                if (dateStats[dateStr]) {
                                  const key = `${studentId}-${sessionId}`;
                                  if (!dateStudentSessions[dateStr]) {
                                    dateStudentSessions[dateStr] = {};
                                  }
                                  if (!dateStudentSessions[dateStr][key]) {
                                    dateStudentSessions[dateStr][key] = new Set();
                                  }
                                  dateStudentSessions[dateStr][key].add(attendanceType);
                                  
                                  // Count individual attendance types
                                  if (attendanceType === 'before') dateStats[dateStr].beforeCount++;
                                  if (attendanceType === 'during') dateStats[dateStr].duringCount++;
                                  if (attendanceType === 'after') dateStats[dateStr].afterCount++;
                                  if (attendanceType === 'present') dateStats[dateStr].presentCount++;
                                  if (attendanceType === 'late') dateStats[dateStr].lateCount++;
                                  // Note: 'absent' is usually not in attendance records, will calculate separately
                                  
                                  console.log('Date processing:', {
                                    dateStr,
                                    studentId,
                                    sessionId,
                                    attendanceType,
                                    beforeCount: dateStats[dateStr].beforeCount,
                                    duringCount: dateStats[dateStr].duringCount,
                                    afterCount: dateStats[dateStr].afterCount
                                  });
                                }
                              }
                            });
                            
                            // Calculate full attendance for each date
                            Object.keys(dateStudentSessions).forEach(dateStr => {
                              const studentSessions = dateStudentSessions[dateStr];
                              let fullCount = 0;
                              
                              Object.values(studentSessions).forEach(statusSet => {
                                // Trường hợp 1: Có mặt trước + Có mặt trong + Có mặt sau (hoặc Về trễ) → Đầy đủ
                                if ((statusSet.has('before') && statusSet.has('during') && (statusSet.has('after') || statusSet.has('late_leave'))) ||
                                    (statusSet.has('early') && statusSet.has('during') && (statusSet.has('after') || statusSet.has('late_leave')))) {
                                  fullCount++;
                                  return;
                                }
                                
                                // Trường hợp 2: Đi trễ + Có mặt trong + Có mặt sau → Đầy đủ
                                if (statusSet.has('late') && statusSet.has('during') && statusSet.has('after')) {
                                  fullCount++;
                                  return;
                                }
                                
                                // Trường hợp 3: Đi trễ + Có mặt trong + Về trễ → Đầy đủ
                                if (statusSet.has('late') && statusSet.has('during') && statusSet.has('late_leave')) {
                                  fullCount++;
                                  return;
                                }
                                
                                // Trường hợp 4: Đi trước (hoặc Có mặt trước) + Có mặt trong + Có mặt sau → Đầy đủ
                                if ((statusSet.has('early') || statusSet.has('before')) && statusSet.has('during') && statusSet.has('after')) {
                                  fullCount++;
                                  return;
                                }
                              });
                              
                              dateStats[dateStr].fullCount = fullCount;
                              
                              // Count unique students and sessions for this date
                              const uniqueStudents = new Set();
                              const uniqueSessions = new Set();
                              Object.keys(studentSessions).forEach(key => {
                                const studentId = key.split('-')[0];
                                const sessionId = key.split('-')[1];
                                uniqueStudents.add(studentId);
                                uniqueSessions.add(sessionId);
                              });
                              dateStats[dateStr].totalStudents = uniqueStudents.size;
                              dateStats[dateStr].totalSessions = uniqueSessions.size;
                            });
                            
                            // Calculate absent count for each date using dashboard stats
                            const dateNames = Object.keys(dateStats);
                            if (dateNames.length > 0 && stats.absent > 0) {
                              // Distribute absent count proportionally based on attendance data
                              let totalAttendanceOccurrences = 0;
                              dateNames.forEach(dateStr => {
                                const date = dateStats[dateStr];
                                totalAttendanceOccurrences += date.beforeCount + date.duringCount + 
                                                             date.afterCount + date.presentCount + 
                                                             date.lateCount;
                              });
                              
                              if (totalAttendanceOccurrences > 0) {
                                dateNames.forEach(dateStr => {
                                  const date = dateStats[dateStr];
                                  const dateAttendanceOccurrences = date.beforeCount + date.duringCount + 
                                                                   date.afterCount + date.presentCount + 
                                                                   date.lateCount;
                                  const proportion = dateAttendanceOccurrences / totalAttendanceOccurrences;
                                  date.absentCount = Math.round(stats.absent * proportion);
                                });
                              } else {
                                // If no attendance data, distribute evenly
                                dateNames.forEach(dateStr => {
                                  dateStats[dateStr].absentCount = Math.floor(stats.absent / dateNames.length);
                                });
                              }
                            }
                          }
                          
                          // Apply real absence request stats by date
                          const dateNames = Object.keys(dateStats);
                          if (dateNames.length > 0) {
                            // Apply real data from absenceStatsByDate state
                            dateNames.forEach(dateStr => {
                              const date = dateStats[dateStr];
                              const absenceData = absenceStatsByDate.find(item => {
                                // Convert both dates to YYYY-MM-DD format for comparison
                                const itemDate = new Date(item.session_date).toISOString().split('T')[0];
                                const targetDate = new Date(dateStr.split('/').reverse().join('-')).toISOString().split('T')[0];
                                
                                console.log('Date comparison:', {
                                  dateStr,
                                  itemSessionDate: item.session_date,
                                  itemDate,
                                  targetDate,
                                  match: itemDate === targetDate
                                });
                                
                                return itemDate === targetDate;
                              });
                              
                              if (absenceData) {
                                date.fullPermCount = absenceData.full_session_requests || 0;
                                date.beforePermCount = absenceData.before_session_requests || 0;
                                date.duringPermCount = absenceData.during_session_requests || 0;
                                date.afterPermCount = absenceData.after_session_requests || 0;
                                
                                console.log('Applied real absence data for date:', {
                                  dateStr,
                                  fullPermCount: date.fullPermCount,
                                  beforePermCount: date.beforePermCount,
                                  duringPermCount: date.duringPermCount,
                                  afterPermCount: date.afterPermCount
                                });
                              } else {
                                // If no data for this date, use proportional distribution as fallback
                                const dateAttendanceOccurrences = date.beforeCount + date.duringCount + 
                                                                 date.afterCount + date.presentCount + 
                                                                 date.lateCount + date.absentCount;
                                
                                // Calculate total attendance occurrences across all dates
                                let totalAttendanceOccurrences = 0;
                                dateNames.forEach(d => {
                                  const dData = dateStats[d];
                                  totalAttendanceOccurrences += dData.beforeCount + dData.duringCount + 
                                                               dData.afterCount + dData.presentCount + 
                                                               dData.lateCount + dData.absentCount;
                                });
                                
                                if (totalAttendanceOccurrences > 0) {
                                  const proportion = dateAttendanceOccurrences / totalAttendanceOccurrences;
                                  date.fullPermCount = Math.round((stats.fullSessionApproved || 0) * proportion);
                                  date.beforePermCount = Math.round((stats.beforeSessionApproved || 0) * proportion);
                                  date.duringPermCount = Math.round((stats.duringSessionApproved || 0) * proportion);
                                  date.afterPermCount = Math.round((stats.afterSessionApproved || 0) * proportion);
                                } else {
                                  // If no attendance data, distribute evenly
                                  date.fullPermCount = Math.floor((stats.fullSessionApproved || 0) / dateNames.length);
                                  date.beforePermCount = Math.floor((stats.beforeSessionApproved || 0) / dateNames.length);
                                  date.duringPermCount = Math.floor((stats.duringSessionApproved || 0) / dateNames.length);
                                  date.afterPermCount = Math.floor((stats.afterSessionApproved || 0) / dateNames.length);
                                }
                                
                                console.log('Applied proportional absence data for date:', {
                                  dateStr,
                                  fullPermCount: date.fullPermCount,
                                  beforePermCount: date.beforePermCount,
                                  duringPermCount: date.duringPermCount,
                                  afterPermCount: date.afterPermCount
                                });
                              }
                            });
                          }
                          
                          return Object.values(dateStats).map((dateData, index) => {
                          
                            return (
                              <tr key={index}>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="date-icon">
                                    <i className="fas fa-calendar-day"></i>
                                  </div>
                                  <div>
                                    <div className="fw-bold">{dateData.date}</div>
                                    <small className="text-muted">
                                      {new Date(dateData.date.split('/').reverse().join('-')).toLocaleDateString('en-US', { weekday: 'long' })}
                                    </small>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <Badge bg="info" className="fs-6">{dateData.totalSessions}</Badge>
                              </td>
                              <td>
                                <Badge bg="primary" className="fs-6">{dateData.totalStudents}</Badge>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-success"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-full-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Đầy đủ:</strong><br/>
                                          {dateData.fullCount} lần có mặt đầy đủ thời gian
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{dateData.fullCount}</strong>
                                  </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-info"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-before-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Có mặt trước:</strong><br/>
                                          {dateData.beforeCount} lần có mặt trước buổi
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{dateData.beforeCount}</strong>
                                  </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-primary"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-during-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Có mặt trong:</strong><br/>
                                          {dateData.duringCount} lần có mặt trong buổi
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{dateData.duringCount}</strong>
                                  </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-secondary"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-after-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Có mặt sau:</strong><br/>
                                          {dateData.afterCount} lần có mặt sau buổi
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{dateData.afterCount}</strong>
                                  </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-success"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-present-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Có mặt:</strong><br/>
                                          {dateData.presentCount} lần có mặt
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{dateData.presentCount}</strong>
                                  </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-warning"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-late-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Đi trễ:</strong><br/>
                                          {dateData.lateCount} lần đi trễ
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{dateData.lateCount}</strong>
                                  </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-danger"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-absent-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Vắng mặt:</strong><br/>
                                          {dateData.absentCount} lần vắng mặt
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{dateData.absentCount}</strong>
                                  </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-secondary"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-full-perm-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Phép cả buổi:</strong><br/>
                                          {dateData.fullPermCount} lần xin phép cả buổi (đã duyệt)
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{dateData.fullPermCount}</strong>
                                  </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-info"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-before-perm-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Phép trước buổi:</strong><br/>
                                          {dateData.beforePermCount} lần xin phép trước buổi (đã duyệt)
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{dateData.beforePermCount}</strong>
                                  </OverlayTrigger>
                                  </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-primary"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-during-perm-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Phép trong buổi:</strong><br/>
                                          {dateData.duringPermCount} lần xin phép trong buổi (đã duyệt)
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{dateData.duringPermCount}</strong>
                                  </OverlayTrigger>
                                </div>
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div className="status-indicator bg-secondary"></div>
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip id={`tooltip-after-perm-${index}`}>
                                        <div style={{ maxWidth: '300px' }}>
                                          <strong>Phép sau buổi:</strong><br/>
                                          {dateData.afterPermCount} lần xin phép sau buổi (đã duyệt)
                                        </div>
                                      </Tooltip>
                                    }
                                  >
                                    <strong style={{ cursor: 'pointer' }}>{dateData.afterPermCount}</strong>
                                  </OverlayTrigger>
                                </div>
                                </td>
                              </tr>
                            );
                          });
                        })()}
                        </tbody>
                    </table>
                      </div>
                </div>
                </Tab>
              </Tabs>
          </div>
            )}
            
            {/* Loading state */}
            {loading && (
              <div className="text-center py-5">
                <Spinner animation="border" variant="primary" />
                <p className="mt-3">Đang tải dữ liệu điểm danh...</p>
              </div>
            )}
      </div>
    </>
  );
};

export default EnhancedAttendanceReports;
