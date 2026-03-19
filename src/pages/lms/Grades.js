import React, { useState, useEffect, useRef } from 'react';

// Styles for PDF Export Options Popup
const pdfExportPopupStyles = `
  .pdf-export-options-popup {
    animation: pdfExportPopupScale 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    transform-origin: bottom center;
  }
  
  @keyframes pdfExportPopupScale {
    from {
      transform: scale(0.8) translateY(10px);
      opacity: 0;
    }
    to {
      transform: scale(1) translateY(0);
      opacity: 1;
    }
  }
`;
import { Modal, Button, Form, Alert, Badge, Tab, Tabs, Table, ProgressBar, Spinner, Row, Col } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import api, { getApiBaseURL } from '../../utils/api';
import Pagination from '../../components/Pagination';
import usePageTitle from '../../hooks/usePageTitle';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import '../../styles/user.css';

const Grades = () => {
  usePageTitle('Quản lý điểm số');
  
  // Inject PDF export popup styles
  useEffect(() => {
    const styleId = 'pdf-export-popup-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = pdfExportPopupStyles;
      document.head.appendChild(style);
    }
    return () => {
      const style = document.getElementById(styleId);
      if (style) {
        style.remove();
      }
    };
  }, []);
  
  // PDF Export Options - Define before use in useState
  const defaultPDFOptions = {
    showStudentInfo: true,
    showExamInfo: true,
    showExamInfoItems: {
      examTitle: true,
      examType: true,
      duration: true,
      questionsCount: true,
      startTime: true,
      submitTime: true,
      availableFrom: true,
      availableUntil: true
    },
    showResults: true,
    showQuestionsList: true,
    showQuestionItems: {
      questionContent: true,
      questionOptions: true,
      selectedAnswer: true,
      answerTime: true,
      thinkingTime: true,
      questionResult: true
    }
  };
  
  const { currentUser } = useAuth();
  const [grades, setGrades] = useState([]);
  const [rubrics, setRubrics] = useState([]);
  const [gradeItems, setGradeItems] = useState([]);
  const [gradeAppeals, setGradeAppeals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('gradebook');
  
  // Exam Results Tab states
  const [examAttempts, setExamAttempts] = useState([]);
  const [loadingExamAttempts, setLoadingExamAttempts] = useState(false);
  const [examResults, setExamResults] = useState(null);
  const [loadingExamResults, setLoadingExamResults] = useState(false);
  const [showExamResultsModal, setShowExamResultsModal] = useState(false);
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const questionRefs = useRef({});
  const modalBodyRef = useRef(null);
  const sidebarRef = useRef(null);
  const pdfExportButtonRef = useRef(null);
  const pdfExportButtonFromListRef = useRef(null);
  const excelExportButtonRef = useRef(null);
  const excelExportButtonFromListRef = useRef(null);
  const [pdfModalPosition, setPdfModalPosition] = useState({ top: 0, left: 0 });
  const [excelModalPosition, setExcelModalPosition] = useState({ top: 0, left: 0 });
  const [selectedAttemptForPDF, setSelectedAttemptForPDF] = useState(null);
  const [selectedAttemptForExcel, setSelectedAttemptForExcel] = useState(null);
  const [examFilters, setExamFilters] = useState({
    search: '',
    exam_id: '',
    class_name: '',
    result: ''
  });
  const [examAttemptsPagination, setExamAttemptsPagination] = useState({
    page: 1,
    limit: 20,
    totalItems: 0,
    totalPages: 0
  });
  
  // Data for filters
  const [classes, setClasses] = useState([]);
  const [exams, setExams] = useState([]);
  
  // Modals
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [showRubricModal, setShowRubricModal] = useState(false);
  const [showAppealModal, setShowAppealModal] = useState(false);
  const [showAppealResponseModal, setShowAppealResponseModal] = useState(false);
  const [showPDFExportOptionsModal, setShowPDFExportOptionsModal] = useState(false);
  const [showBulkPDFOptionsModal, setShowBulkPDFOptionsModal] = useState(false);
  const [showExcelExportOptionsModal, setShowExcelExportOptionsModal] = useState(false);
  const [showBulkExcelOptionsModal, setShowBulkExcelOptionsModal] = useState(false);
  const [showExportGradebookModal, setShowExportGradebookModal] = useState(false);
  const [exportGradebookOptions, setExportGradebookOptions] = useState({
    dateType: 'range', // 'specific' or 'range'
    dateSpecific: '',
    dateFrom: '',
    dateTo: '',
    class_name: '',
    user_id: '',
    exam_id: '',
    format: 'excel' // 'excel', 'pdf', 'word'
  });
  const [bulkPDFExportOptions, setBulkPDFExportOptions] = useState(() => {
    try {
      const saved = localStorage.getItem('bulkPDFExportOptions');
      if (saved) {
        return JSON.parse(saved);
      }
      // If no bulk options saved, try to use regular PDF options as default
      const regularSaved = localStorage.getItem('pdfExportOptions');
      if (regularSaved) {
        return JSON.parse(regularSaved);
      }
    } catch (e) {
      console.error('Error loading bulk PDF export options:', e);
    }
    return defaultPDFOptions;
  });
  const [showBulkPDFProgressModal, setShowBulkPDFProgressModal] = useState(false);
  const [bulkPDFProgress, setBulkPDFProgress] = useState({
    current: 0,
    total: 0,
    currentAttempt: null,
    message: '',
    exported: 0,
    failed: 0,
    errors: [],
    isComplete: false
  });
  const [showBulkExcelProgressModal, setShowBulkExcelProgressModal] = useState(false);
  const [bulkExcelProgress, setBulkExcelProgress] = useState({
    current: 0,
    total: 0,
    currentAttempt: null,
    message: '',
    exported: 0,
    failed: 0,
    errors: [],
    isComplete: false
  });
  
  const [selectedGrade, setSelectedGrade] = useState(null);
  const [selectedRubric, setSelectedRubric] = useState(null);
  const [selectedAppeal, setSelectedAppeal] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const { showAlert } = useAlert();

  const [pdfExportOptions, setPdfExportOptions] = useState(() => {
    try {
      const saved = localStorage.getItem('pdfExportOptions');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error loading PDF export options:', e);
    }
    return defaultPDFOptions;
  });
  
  // Excel Export Options - Same structure as PDF
  const [excelExportOptions, setExcelExportOptions] = useState(() => {
    try {
      const saved = localStorage.getItem('excelExportOptions');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error loading Excel export options:', e);
    }
    return defaultPDFOptions; // Use same default as PDF
  });
  
  const [bulkExcelExportOptions, setBulkExcelExportOptions] = useState(() => {
    try {
      const saved = localStorage.getItem('bulkExcelExportOptions');
      if (saved) {
        return JSON.parse(saved);
      }
      // If no bulk options saved, try to use regular Excel options as default
      const regularSaved = localStorage.getItem('excelExportOptions');
      if (regularSaved) {
        return JSON.parse(regularSaved);
      }
    } catch (e) {
      console.error('Error loading bulk Excel export options:', e);
    }
    return defaultPDFOptions; // Use same default as PDF
  });

  // Filters
  const [filters, setFilters] = useState({
    course_id: '',
    class_id: '',
    user_id: ''
  });
  
  // Gradebook filters (similar to exam-results tab)
  const [gradebookFilters, setGradebookFilters] = useState({
    search: '',
    exam_id: '',
    class_name: '',
    letterGrade: '',
    scoreFrom: '',
    scoreTo: '',
    dateSpecific: '',
    dateFrom: '',
    dateTo: ''
  });
  
  // Data for gradebook filters
  const [gradebookExams, setGradebookExams] = useState([]);
  const [gradebookClasses, setGradebookClasses] = useState([]);
  const [gradebookUsers, setGradebookUsers] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    totalItems: 0,
    totalPages: 0
  });
  const [rubricsPagination, setRubricsPagination] = useState({
    page: 1,
    limit: 10,
    totalItems: 0,
    totalPages: 0
  });
  const [appealsPagination, setAppealsPagination] = useState({
    page: 1,
    limit: 10,
    totalItems: 0,
    totalPages: 0
  });

  // Form data
  const [gradeForm, setGradeForm] = useState({
    enrollment_id: '',
    item_id: '',
    score: 0,
    max_score: 100,
    feedback: '',
    is_excused: false
  });

  const [rubricForm, setRubricForm] = useState({
    rubric_name: '',
    description: '',
    criteria: [
      { criteria_name: '', description: '', max_points: 10, weight: 1 }
    ]
  });

  const [appealForm, setAppealForm] = useState({
    grade_id: '',
    reason: ''
  });

  const [appealResponseForm, setAppealResponseForm] = useState({
    status: 'approved',
    response: ''
  });

  // Check if user has lms_qa permission for gradebook tab
  const hasLMSQAPermission = () => {
    if (!currentUser) return false;
    const moduleRoles = currentUser.module_roles || [];
    if (!Array.isArray(moduleRoles)) return false;
    return moduleRoles.includes('lms_qa');
  };

  // Check if user has lms_qa or lms_mod permission
  const hasLMSQAModPermission = () => {
    if (!currentUser) return false;
    const moduleRoles = currentUser.module_roles || [];
    if (!Array.isArray(moduleRoles)) return false;
    return moduleRoles.includes('lms_qa') || moduleRoles.includes('lms_mod');
  };

  // Set default tab based on permission
  useEffect(() => {
    if (!hasLMSQAPermission() && activeTab === 'gradebook') {
      setActiveTab('rubrics'); // Switch to rubrics if no permission for gradebook
    }
  }, [currentUser]);

  // Extract unique classes from attempts data
  const extractClassesFromAttempts = (attempts) => {
    if (!Array.isArray(attempts) || attempts.length === 0) return [];
    
    const classSet = new Set();
    attempts.forEach(attempt => {
      if (attempt.class_name && attempt.class_name.trim() !== '') {
        classSet.add(attempt.class_name.trim());
      }
    });
    
    const classesList = Array.from(classSet)
      .sort()
      .map((name, index) => ({
        id: (index + 1).toString(),
        name: name
      }));
    
    return classesList;
  };

  // Extract unique classes and exams from grades data
  const extractClassesFromGrades = (gradesData) => {
    if (!Array.isArray(gradesData) || gradesData.length === 0) return [];
    
    const classSet = new Set();
    gradesData.forEach(grade => {
      // Exclude 'N/A' and empty values
      if (grade.class_name && grade.class_name.trim() !== '' && grade.class_name.trim() !== 'N/A') {
        classSet.add(grade.class_name.trim());
      }
    });
    
    const classesList = Array.from(classSet)
      .sort()
      .map((name, index) => ({
        id: (index + 1).toString(),
        name: name
      }));
    
    return classesList;
  };

  const extractExamsFromGrades = (gradesData) => {
    if (!Array.isArray(gradesData) || gradesData.length === 0) return [];
    
    const examMap = new Map();
    gradesData.forEach(grade => {
      // Use exam_id for filtering, item_name or exam_title for display
      if (grade.exam_id) {
        const examTitle = grade.item_name || grade.exam_title || grade.course_name || 'N/A';
        if (!examMap.has(grade.exam_id)) {
          examMap.set(grade.exam_id, {
            exam_id: grade.exam_id,
            exam_title: examTitle
          });
        }
      } else if (grade.item_name) {
        // For grades without exam_id, use item_id or item_name as key
        const itemKey = grade.item_id || grade.item_name;
        if (itemKey && !examMap.has(itemKey)) {
          examMap.set(itemKey, {
            exam_id: itemKey, // Use item_id as exam_id for filtering
            exam_title: grade.item_name
          });
        }
      }
    });
    
    return Array.from(examMap.values()).sort((a, b) => 
      (a.exam_title || '').localeCompare(b.exam_title || '')
    );
  };


  const fetchExamsForFilter = async () => {
    try {
      const response = await api.get('/lms/exams');
      const examsData = response.data?.data;
      let examsList = [];
      
      if (Array.isArray(examsData)) {
        examsList = examsData;
      } else if (examsData && Array.isArray(examsData.exams)) {
        examsList = examsData.exams;
      }
      
      setExams(examsList);
    } catch (error) {
      console.error('Error fetching exams:', error);
    }
  };

  // Initial fetch
  useEffect(() => {
    if (activeTab === 'gradebook' && hasLMSQAPermission()) {
      fetchGrades();
    } else if (activeTab === 'rubrics') {
      fetchRubrics();
    } else if (activeTab === 'appeals') {
      fetchGradeAppeals();
    } else if (activeTab === 'exam-results' && hasLMSQAPermission()) {
      fetchExamAttempts();
      fetchExamsForFilter();
    }
  }, [activeTab, filters, examFilters, currentUser]);

  // Extract unique users from grades data
  const extractUsersFromGrades = (gradesData) => {
    if (!Array.isArray(gradesData) || gradesData.length === 0) return [];
    
    const userMap = new Map();
    gradesData.forEach(grade => {
      if (grade.user_id && grade.student_name) {
        if (!userMap.has(grade.user_id)) {
          userMap.set(grade.user_id, {
            user_id: grade.user_id,
            student_name: grade.student_name,
            student_code: grade.student_code || grade.student_id || ''
          });
        }
      }
    });
    
    return Array.from(userMap.values()).sort((a, b) => 
      (a.student_name || '').localeCompare(b.student_name || '')
    );
  };

  // Extract classes, exams, and users from grades when grades data changes
  useEffect(() => {
    if (activeTab === 'gradebook' && grades.length > 0) {
      const extractedClasses = extractClassesFromGrades(grades);
      const extractedExams = extractExamsFromGrades(grades);
      const extractedUsers = extractUsersFromGrades(grades);
      setGradebookClasses(extractedClasses);
      setGradebookExams(extractedExams);
      setGradebookUsers(extractedUsers);
    }
  }, [grades, activeTab]);

  // Background polling for grades - only update if data changed
  useEffect(() => {
    if (activeTab !== 'gradebook' || !hasLMSQAPermission()) return;
    
    let pollInterval;
    let isMounted = true;
    let currentPolling = false; // Prevent concurrent requests
    
    const pollGrades = async () => {
      if (currentPolling || !isMounted) return;
      
      try {
        currentPolling = true;
        // Fetch all grades without filters (filtering is done client-side)
        const response = await api.get('/lms/grades');
        const gradesData = response.data?.data;
        
        let newGrades = [];
        if (Array.isArray(gradesData)) {
          newGrades = gradesData;
        } else if (gradesData && Array.isArray(gradesData.grades)) {
          newGrades = gradesData.grades;
        }
        
        if (!isMounted) return;
        
        // Compare with current data - only update if changed
        setGrades(currentGrades => {
          if (hasGradesDataChanged(currentGrades, newGrades)) {
            return newGrades;
          }
          return currentGrades; // No changes, keep current data
        });
      } catch (error) {
        // Silently fail in background polling
        console.debug('Background polling error (silent):', error);
      } finally {
        currentPolling = false;
      }
    };
    
    // Start polling after initial load (5 seconds delay)
    const initialDelay = setTimeout(() => {
      if (isMounted) {
        pollInterval = setInterval(pollGrades, 5000); // Poll every 5 seconds
      }
    }, 5000);
    
    return () => {
      isMounted = false;
      clearTimeout(initialDelay);
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [activeTab, currentUser]);

  // Reset pagination when filters change
  useEffect(() => {
    if (activeTab === 'gradebook') {
      setPagination(prev => ({ ...prev, page: 1 }));
    }
  }, [gradebookFilters, activeTab]);

  // Background polling for rubrics - only update if data changed
  useEffect(() => {
    if (activeTab !== 'rubrics') return;
    
    let pollInterval;
    let isMounted = true;
    let currentPolling = false;
    
    const pollRubrics = async () => {
      if (currentPolling || !isMounted) return;
      
      try {
        currentPolling = true;
        const response = await api.get('/lms/rubrics');
        const rubricsData = response.data?.data;
        
        let newRubrics = [];
        if (Array.isArray(rubricsData)) {
          newRubrics = rubricsData;
        } else if (rubricsData && Array.isArray(rubricsData.rubrics)) {
          newRubrics = rubricsData.rubrics;
        }
        
        if (!isMounted) return;
        
        // Compare with current data - only update if changed
        setRubrics(currentRubrics => {
          if (hasRubricsDataChanged(currentRubrics, newRubrics)) {
            return newRubrics;
          }
          return currentRubrics; // No changes, keep current data
        });
      } catch (error) {
        // Silently fail in background polling
        console.debug('Background polling error (silent):', error);
      } finally {
        currentPolling = false;
      }
    };
    
    // Start polling after initial load (5 seconds delay)
    const initialDelay = setTimeout(() => {
      if (isMounted) {
        pollInterval = setInterval(pollRubrics, 5000); // Poll every 5 seconds
      }
    }, 5000);
    
    return () => {
      isMounted = false;
      clearTimeout(initialDelay);
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [activeTab]);

  // Background polling for grade appeals - only update if data changed
  useEffect(() => {
    if (activeTab !== 'appeals') return;
    
    let pollInterval;
    let isMounted = true;
    let currentPolling = false;
    
    const pollGradeAppeals = async () => {
      if (currentPolling || !isMounted) return;
      
      try {
        currentPolling = true;
        const response = await api.get('/lms/grade-appeals');
        const appealsData = response.data?.data;
        
        let newAppeals = [];
        if (Array.isArray(appealsData)) {
          newAppeals = appealsData;
        } else if (appealsData && Array.isArray(appealsData.appeals)) {
          newAppeals = appealsData.appeals;
        }
        
        if (!isMounted) return;
        
        // Compare with current data - only update if changed
        setGradeAppeals(currentAppeals => {
          if (hasGradeAppealsDataChanged(currentAppeals, newAppeals)) {
            return newAppeals;
          }
          return currentAppeals; // No changes, keep current data
        });
      } catch (error) {
        // Silently fail in background polling
        console.debug('Background polling error (silent):', error);
      } finally {
        currentPolling = false;
      }
    };
    
    // Start polling after initial load (5 seconds delay)
    const initialDelay = setTimeout(() => {
      if (isMounted) {
        pollInterval = setInterval(pollGradeAppeals, 5000); // Poll every 5 seconds
      }
    }, 5000);
    
    return () => {
      isMounted = false;
      clearTimeout(initialDelay);
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [activeTab]);

  const fetchGrades = async () => {
    try {
      setLoading(true);
      // Fetch all grades without filters (filtering will be done client-side)
      const response = await api.get('/lms/grades');
      
      const gradesData = response.data?.data;
      if (Array.isArray(gradesData)) {
        setGrades(gradesData);
      } else if (gradesData && Array.isArray(gradesData.grades)) {
        setGrades(gradesData.grades);
      } else {
        setGrades([]);
      }
    } catch (error) {
      console.error('Error fetching grades:', error);
      if (error.response?.status === 403) {
        showAlertMessage('Bạn không có quyền truy cập dữ liệu này.', 'danger');
      } else {
        showAlertMessage('Lỗi khi tải danh sách điểm', 'danger');
      }
      setGrades([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchRubrics = async () => {
    try {
      setLoading(true);
      const response = await api.get('/lms/rubrics');
      
      const rubricsData = response.data?.data;
      if (Array.isArray(rubricsData)) {
        setRubrics(rubricsData);
      } else if (rubricsData && Array.isArray(rubricsData.rubrics)) {
        setRubrics(rubricsData.rubrics);
      } else {
        setRubrics([]);
      }
    } catch (error) {
      console.error('Error fetching rubrics:', error);
      if (error.response?.status === 403) {
        showAlertMessage('Bạn không có quyền truy cập dữ liệu này.', 'danger');
      } else {
        showAlertMessage('Lỗi khi tải danh sách rubric', 'danger');
      }
      setRubrics([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchGradeAppeals = async () => {
    try {
      setLoading(true);
      const response = await api.get('/lms/grade-appeals');
      
      const appealsData = response.data?.data;
      if (Array.isArray(appealsData)) {
        setGradeAppeals(appealsData);
      } else if (appealsData && Array.isArray(appealsData.appeals)) {
        setGradeAppeals(appealsData.appeals);
      } else {
        setGradeAppeals([]);
      }
    } catch (error) {
      console.error('Error fetching grade appeals:', error);
      if (error.response?.status === 403) {
        showAlertMessage('Bạn không có quyền truy cập dữ liệu này.', 'danger');
      } else {
        showAlertMessage('Lỗi khi tải danh sách phúc khảo', 'danger');
      }
      setGradeAppeals([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGrade = () => {
    setEditMode(false);
    setGradeForm({
      enrollment_id: '',
      item_id: '',
      score: 0,
      max_score: 100,
      feedback: '',
      is_excused: false
    });
    setShowGradeModal(true);
  };

  const handleSubmitGrade = async (e) => {
    e.preventDefault();

    try {
      await api.post('/lms/grades', gradeForm);

      showAlertMessage('Lưu điểm thành công', 'success');
      setShowGradeModal(false);
      fetchGrades();
    } catch (error) {
      console.error('Error saving grade:', error);
      if (error.response?.status === 403) {
        showAlertMessage('Bạn không có quyền thực hiện thao tác này.', 'danger');
      } else {
        showAlertMessage(error.response?.data?.message || 'Lỗi khi lưu điểm', 'danger');
      }
    }
  };

  const handleDeleteGrade = async (gradeId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa điểm này?')) return;

    try {
      await api.delete(`/lms/grades/${gradeId}`);

      showAlertMessage('Xóa điểm thành công', 'success');
      fetchGrades();
    } catch (error) {
      console.error('Error deleting grade:', error);
      if (error.response?.status === 403) {
        showAlertMessage('Bạn không có quyền thực hiện thao tác này.', 'danger');
      } else {
        showAlertMessage(error.response?.data?.message || 'Lỗi khi xóa điểm', 'danger');
      }
    }
  };

  // Rubric functions
  const handleCreateRubric = () => {
    setEditMode(false);
    setRubricForm({
      rubric_name: '',
      description: '',
      criteria: [
        { criteria_name: '', description: '', max_points: 10, weight: 1 }
      ]
    });
    setShowRubricModal(true);
  };

  const handleEditRubric = async (rubric) => {
    setEditMode(true);
    setSelectedRubric(rubric);

    try {
      const response = await api.get(`/lms/rubrics/${rubric.rubric_id}`);
      const fullRubric = response.data.data;

      setRubricForm({
        rubric_name: fullRubric.rubric_name,
        description: fullRubric.description || '',
        criteria: fullRubric.criteria || []
      });

      setShowRubricModal(true);
    } catch (error) {
      console.error('Error fetching rubric details:', error);
      if (error.response?.status === 403) {
        showAlertMessage('Bạn không có quyền truy cập dữ liệu này.', 'danger');
      } else {
        showAlertMessage('Lỗi khi tải chi tiết rubric', 'danger');
      }
    }
  };

  const handleSubmitRubric = async (e) => {
    e.preventDefault();

    try {
      if (editMode && selectedRubric) {
        await api.put(`/lms/rubrics/${selectedRubric.rubric_id}`, rubricForm);
        showAlertMessage('Cập nhật rubric thành công', 'success');
      } else {
        await api.post('/lms/rubrics', rubricForm);
        showAlertMessage('Tạo rubric thành công', 'success');
      }

      setShowRubricModal(false);
      fetchRubrics();
    } catch (error) {
      console.error('Error saving rubric:', error);
      if (error.response?.status === 403) {
        showAlertMessage('Bạn không có quyền thực hiện thao tác này.', 'danger');
      } else {
        showAlertMessage(error.response?.data?.message || 'Lỗi khi lưu rubric', 'danger');
      }
    }
  };

  const handleDeleteRubric = async (rubricId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa rubric này?')) return;

    try {
      await api.delete(`/lms/rubrics/${rubricId}`);

      showAlertMessage('Xóa rubric thành công', 'success');
      fetchRubrics();
    } catch (error) {
      console.error('Error deleting rubric:', error);
      if (error.response?.status === 403) {
        showAlertMessage('Bạn không có quyền thực hiện thao tác này.', 'danger');
      } else {
        showAlertMessage(error.response?.data?.message || 'Lỗi khi xóa rubric', 'danger');
      }
    }
  };

  const handleAddCriterion = () => {
    setRubricForm({
      ...rubricForm,
      criteria: [
        ...rubricForm.criteria,
        { criteria_name: '', description: '', max_points: 10, weight: 1 }
      ]
    });
  };

  const handleRemoveCriterion = (index) => {
    const newCriteria = rubricForm.criteria.filter((_, i) => i !== index);
    setRubricForm({ ...rubricForm, criteria: newCriteria });
  };

  const handleCriterionChange = (index, field, value) => {
    const newCriteria = [...rubricForm.criteria];
    newCriteria[index][field] = value;
    setRubricForm({ ...rubricForm, criteria: newCriteria });
  };

  // Grade Appeal functions
  const handleCreateAppeal = (grade) => {
    setSelectedGrade(grade);
    setAppealForm({
      grade_id: grade.grade_id,
      reason: ''
    });
    setShowAppealModal(true);
  };

  const handleSubmitAppeal = async (e) => {
    e.preventDefault();

    try {
      await api.post('/lms/grade-appeals', appealForm);

      showAlertMessage('Gửi yêu cầu phúc khảo thành công', 'success');
      setShowAppealModal(false);
      fetchGradeAppeals();
    } catch (error) {
      console.error('Error creating appeal:', error);
      if (error.response?.status === 403) {
        showAlertMessage('Bạn không có quyền thực hiện thao tác này.', 'danger');
      } else {
        showAlertMessage(error.response?.data?.message || 'Lỗi khi gửi yêu cầu phúc khảo', 'danger');
      }
    }
  };

  const handleRespondToAppeal = (appeal) => {
    setSelectedAppeal(appeal);
    setAppealResponseForm({
      status: 'approved',
      response: ''
    });
    setShowAppealResponseModal(true);
  };

  const handleSubmitAppealResponse = async (e) => {
    e.preventDefault();

    try {
      await api.put(
        `/lms/grade-appeals/${selectedAppeal.appeal_id}/respond`,
        appealResponseForm
      );

      showAlertMessage('Phản hồi phúc khảo thành công', 'success');
      setShowAppealResponseModal(false);
      fetchGradeAppeals();
    } catch (error) {
      console.error('Error responding to appeal:', error);
      if (error.response?.status === 403) {
        showAlertMessage('Bạn không có quyền thực hiện thao tác này.', 'danger');
      } else {
        showAlertMessage(error.response?.data?.message || 'Lỗi khi phản hồi phúc khảo', 'danger');
      }
    }
  };

  // Helper functions to compare data changes
  const hasGradesDataChanged = (oldData, newData) => {
    if (!oldData || !Array.isArray(oldData)) return true; // First load
    if (!newData || !Array.isArray(newData)) return false;
    if (oldData.length !== newData.length) return true;
    
    // Compare by grade_id and key fields
    const oldMap = new Map(oldData.map(grade => {
      const key = grade.grade_id || `${grade.source_type || 'exam'}-${grade.exam_id || 'none'}-${grade.user_id || 'none'}`;
      return [key, {
        grade_id: grade.grade_id,
        score: grade.score,
        max_score: grade.max_score,
        status: grade.status,
        updated_at: grade.updated_at
      }];
    }));
    
    for (const newGrade of newData) {
      const key = newGrade.grade_id || `${newGrade.source_type || 'exam'}-${newGrade.exam_id || 'none'}-${newGrade.user_id || 'none'}`;
      const oldGrade = oldMap.get(key);
      if (!oldGrade) return true; // New grade added
      
      // Check if key fields changed
      if (
        oldGrade.score !== newGrade.score ||
        oldGrade.max_score !== newGrade.max_score ||
        oldGrade.status !== newGrade.status ||
        oldGrade.updated_at !== newGrade.updated_at
      ) {
        return true;
      }
    }
    
    return false; // No changes detected
  };

  const hasRubricsDataChanged = (oldData, newData) => {
    if (!oldData || !Array.isArray(oldData)) return true; // First load
    if (!newData || !Array.isArray(newData)) return false;
    if (oldData.length !== newData.length) return true;
    
    // Compare by rubric_id and key fields
    const oldMap = new Map(oldData.map(rubric => [rubric.rubric_id, {
      rubric_id: rubric.rubric_id,
      rubric_name: rubric.rubric_name,
      description: rubric.description,
      criteria_count: rubric.criteria_count,
      total_points: rubric.total_points,
      updated_at: rubric.updated_at
    }]));
    
    for (const newRubric of newData) {
      const oldRubric = oldMap.get(newRubric.rubric_id);
      if (!oldRubric) return true; // New rubric added
      
      // Check if key fields changed
      if (
        oldRubric.rubric_name !== newRubric.rubric_name ||
        oldRubric.description !== newRubric.description ||
        oldRubric.criteria_count !== newRubric.criteria_count ||
        oldRubric.total_points !== newRubric.total_points ||
        oldRubric.updated_at !== newRubric.updated_at
      ) {
        return true;
      }
    }
    
    return false; // No changes detected
  };

  const hasGradeAppealsDataChanged = (oldData, newData) => {
    if (!oldData || !Array.isArray(oldData)) return true; // First load
    if (!newData || !Array.isArray(newData)) return false;
    if (oldData.length !== newData.length) return true;
    
    // Compare by appeal_id and key fields
    const oldMap = new Map(oldData.map(appeal => [appeal.appeal_id, {
      appeal_id: appeal.appeal_id,
      status: appeal.status,
      response: appeal.response,
      updated_at: appeal.updated_at
    }]));
    
    for (const newAppeal of newData) {
      const oldAppeal = oldMap.get(newAppeal.appeal_id);
      if (!oldAppeal) return true; // New appeal added
      
      // Check if key fields changed
      if (
        oldAppeal.status !== newAppeal.status ||
        oldAppeal.response !== newAppeal.response ||
        oldAppeal.updated_at !== newAppeal.updated_at
      ) {
        return true;
      }
    }
    
    return false; // No changes detected
  };

  const showAlertMessage = (message, variant = 'info') => {
    const titles = {
      success: 'Thành công',
      info: 'Thông tin',
      warning: 'Cảnh báo',
      danger: 'Lỗi'
    };
    showAlert(message, variant, titles[variant] || 'Thông báo');
  };

  const getLetterGrade = (percentage) => {
    if (percentage >= 90) return { grade: 'A', color: 'success' };
    if (percentage >= 80) return { grade: 'B', color: 'info' };
    if (percentage >= 70) return { grade: 'C', color: 'warning' };
    if (percentage >= 60) return { grade: 'D', color: 'secondary' };
    return { grade: 'F', color: 'danger' };
  };

  const getAppealStatusBadge = (status) => {
    const config = {
      pending: { bg: 'warning', text: 'Chờ xử lý' },
      under_review: { bg: 'info', text: 'Đang xem xét' },
      approved: { bg: 'success', text: 'Chấp nhận' },
      rejected: { bg: 'danger', text: 'Từ chối' }
    };
    const c = config[status] || config.pending;
    return <Badge bg={c.bg}>{c.text}</Badge>;
  };

  // Exam Results Tab functions
  const fetchExamAttempts = async () => {
    try {
      setLoadingExamAttempts(true);

      // Get all exams first to get attempts
      const examsResponse = await api.get('/lms/exams');
      const examsData = examsResponse.data?.data;
      let exams = [];
      
      if (Array.isArray(examsData)) {
        exams = examsData;
      } else if (examsData && Array.isArray(examsData.exams)) {
        exams = examsData.exams;
      }

      // Get attempts for each exam
      const allAttempts = [];
      const userIdsSet = new Set(); // Collect unique user IDs
      
      for (const exam of exams) {
        try {
          const attemptsResponse = await api.get(`/lms/exams/${exam.exam_id}/attempts`);
          const attemptsData = attemptsResponse.data?.data;
          
          if (Array.isArray(attemptsData)) {
            // Filter only submitted attempts
            const submittedAttempts = attemptsData
              .filter(attempt => attempt.status === 'submitted')
              .map(attempt => {
                if (attempt.user_id) {
                  userIdsSet.add(attempt.user_id);
                }
                return {
                  ...attempt,
                  exam_title: exam.exam_title,
                  exam_id: exam.exam_id
                };
              });
            allAttempts.push(...submittedAttempts);
          }
        } catch (error) {
          console.error(`Error fetching attempts for exam ${exam.exam_id}:`, error);
        }
      }

      // class_name is now included in API response (updated in examController.js)
      setExamAttempts(allAttempts);
      
      // Extract and set classes from attempts data
      const extractedClasses = extractClassesFromAttempts(allAttempts);
      if (extractedClasses.length > 0) {
        setClasses(extractedClasses);
      }
    } catch (error) {
      console.error('Error fetching exam attempts:', error);
      showAlertMessage('Lỗi khi tải danh sách bài thi', 'danger');
      setExamAttempts([]);
      setClasses([]);
    } finally {
      setLoadingExamAttempts(false);
    }
  };

  const handleViewExamResults = async (attempt) => {
    try {
      setLoadingExamResults(true);
      setSelectedAttempt(attempt);
      
      // Fetch detailed results
      const response = await api.get(`/lms/attempts/${attempt.attempt_id}/results`);
      
      if (response.data.success) {
        console.log('[FRONTEND] Exam results data:', response.data.data);
        console.log('[FRONTEND] Answers count:', response.data.data?.answers?.length || 0);
        setExamResults(response.data.data);
        setShowExamResultsModal(true);
        setActiveQuestionIndex(0);
        questionRefs.current = {};
      } else {
        showAlertMessage('Không thể tải kết quả thi', 'danger');
      }
    } catch (error) {
      console.error('Error fetching exam results:', error);
      showAlertMessage('Lỗi khi tải kết quả thi', 'danger');
    } finally {
      setLoadingExamResults(false);
    }
  };

  // Setup Intersection Observer for question navigation
  useEffect(() => {
    if (!showExamResultsModal || !examResults || !examResults.answers || examResults.answers.length === 0) {
      return;
    }

    const observerOptions = {
      root: modalBodyRef.current,
      rootMargin: '-20% 0px -60% 0px',
      threshold: 0.3
    };

    const observerCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const questionIndex = parseInt(entry.target.getAttribute('data-question-index') || '0', 10);
          setActiveQuestionIndex(questionIndex);
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    // Observe all question items
    Object.values(questionRefs.current).forEach((ref) => {
      if (ref) {
        observer.observe(ref);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [showExamResultsModal, examResults]);

  // Auto-scroll sidebar when active question changes
  useEffect(() => {
    if (!sidebarRef.current || !examResults || !examResults.answers) return;

    const totalQuestions = examResults.answers.length;
    const visibleCount = 11; // Show 11 numbers (5 on each side + 1 center)
    const halfVisible = Math.floor(visibleCount / 2);
    
    // Calculate which buttons should be visible
    let startIndex = activeQuestionIndex - halfVisible;
    let endIndex = activeQuestionIndex + halfVisible;
    
    // Adjust if near the beginning
    if (startIndex < 0) {
      startIndex = 0;
      endIndex = Math.min(visibleCount - 1, totalQuestions - 1);
    }
    
    // Adjust if near the end
    if (endIndex >= totalQuestions) {
      endIndex = totalQuestions - 1;
      startIndex = Math.max(0, totalQuestions - visibleCount);
    }

    // Find the active button element
    const activeButton = sidebarRef.current.querySelector(`[data-question-index="${activeQuestionIndex}"]`);
    if (activeButton) {
      // Calculate scroll position to center the active button
      const sidebarHeight = sidebarRef.current.clientHeight;
      const buttonTop = activeButton.offsetTop;
      const buttonHeight = activeButton.offsetHeight;
      const gap = 8; // gap between buttons
      const scrollPosition = buttonTop - (sidebarHeight / 2) + (buttonHeight / 2) - (gap * halfVisible);
      
      sidebarRef.current.scrollTo({
        top: Math.max(0, scrollPosition),
        behavior: 'smooth'
      });
    }
  }, [activeQuestionIndex, examResults]);

  const formatTime = (seconds) => {
    if (!seconds || seconds === 0) return '0 giây';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours} giờ ${minutes} phút ${secs} giây`;
    } else if (minutes > 0) {
      return `${minutes} phút ${secs} giây`;
    } else {
      return `${secs} giây`;
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const removeVietnameseAccents = (str) => {
    if (!str) return '';
    return str.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[^a-zA-Z0-9]/g, '_');
  };

  const calculateThinkingTime = (questionDisplayTime, answerTimestamp) => {
    if (!questionDisplayTime || !answerTimestamp) return null;
    const displayTime = new Date(questionDisplayTime);
    const answerTime = new Date(answerTimestamp);
    const diffSeconds = Math.floor((answerTime - displayTime) / 1000);
    return diffSeconds >= 0 ? diffSeconds : null;
  };

  const formatNumber = (num) => {
    if (num === null || num === undefined || isNaN(num)) return '0';
    const formatted = parseFloat(num).toFixed(2);
    return formatted.replace(/\.00$/, '');
  };

  const formatExamType = (examType) => {
    if (!examType) return 'N/A';
    const typeMap = {
      'quiz': 'Quiz',
      'exam': 'Kỳ thi',
      'assignment': 'Bài tập',
      'test': 'Kiểm tra',
      'midterm': 'Giữa kỳ',
      'final': 'Cuối kỳ'
    };
    return typeMap[examType.toLowerCase()] || examType;
  };

  // Save PDF export options to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('pdfExportOptions', JSON.stringify(pdfExportOptions));
    } catch (e) {
      console.error('Error saving PDF export options:', e);
    }
  }, [pdfExportOptions]);

  // Save bulk PDF export options to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('bulkPDFExportOptions', JSON.stringify(bulkPDFExportOptions));
    } catch (e) {
      console.error('Error saving bulk PDF export options:', e);
    }
  }, [bulkPDFExportOptions]);
  
  // Save Excel export options to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('excelExportOptions', JSON.stringify(excelExportOptions));
    } catch (e) {
      console.error('Error saving Excel export options:', e);
    }
  }, [excelExportOptions]);
  
  // Save bulk Excel export options to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('bulkExcelExportOptions', JSON.stringify(bulkExcelExportOptions));
    } catch (e) {
      console.error('Error saving bulk Excel export options:', e);
    }
  }, [bulkExcelExportOptions]);

  const exportToPDF = async (options = null) => {
    // Use selectedAttemptForPDF if available (from list), otherwise use selectedAttempt (from modal)
    const attemptToExport = selectedAttemptForPDF || selectedAttempt;
    if (!attemptToExport) return;

    const exportOptions = options || pdfExportOptions;

    try {
      setLoadingExamResults(true);
      
      // Build query params from options
      const params = new URLSearchParams();
      params.append('showStudentInfo', exportOptions.showStudentInfo ? '1' : '0');
      params.append('showExamInfo', exportOptions.showExamInfo ? '1' : '0');
      if (exportOptions.showExamInfo) {
        params.append('examTitle', exportOptions.showExamInfoItems.examTitle ? '1' : '0');
        params.append('examType', exportOptions.showExamInfoItems.examType ? '1' : '0');
        params.append('duration', exportOptions.showExamInfoItems.duration ? '1' : '0');
        params.append('questionsCount', exportOptions.showExamInfoItems.questionsCount ? '1' : '0');
        params.append('startTime', exportOptions.showExamInfoItems.startTime ? '1' : '0');
        params.append('submitTime', exportOptions.showExamInfoItems.submitTime ? '1' : '0');
        params.append('availableFrom', exportOptions.showExamInfoItems.availableFrom ? '1' : '0');
        params.append('availableUntil', exportOptions.showExamInfoItems.availableUntil ? '1' : '0');
      }
      params.append('showResults', exportOptions.showResults ? '1' : '0');
      params.append('showQuestionsList', exportOptions.showQuestionsList ? '1' : '0');
      if (exportOptions.showQuestionsList) {
        params.append('questionContent', exportOptions.showQuestionItems.questionContent ? '1' : '0');
        params.append('questionOptions', exportOptions.showQuestionItems.questionOptions ? '1' : '0');
        params.append('selectedAnswer', exportOptions.showQuestionItems.selectedAnswer ? '1' : '0');
        params.append('answerTime', exportOptions.showQuestionItems.answerTime ? '1' : '0');
        params.append('thinkingTime', exportOptions.showQuestionItems.thinkingTime ? '1' : '0');
        params.append('questionResult', exportOptions.showQuestionItems.questionResult ? '1' : '0');
      }

      const response = await api.get(`/lms/attempts/${attemptToExport.attempt_id}/results/pdf?${params.toString()}`, {
        responseType: 'blob'
      });

      // Extract filename from Content-Disposition header
      let filename = `ket-qua-thi-${attemptToExport.attempt_id}.pdf`; // fallback
      const contentDisposition = response.headers['content-disposition'] || response.headers['Content-Disposition'];
      if (contentDisposition) {
        // Try to match filename= or filename*= (for encoded filenames)
        let filenameMatch = contentDisposition.match(/filename\*?=['"]?([^'";\n]+)['"]?/i);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
          // Decode if it's URL encoded (for filename*=UTF-8''...)
          if (filename.startsWith("UTF-8''")) {
            filename = decodeURIComponent(filename.substring(7));
          } else if (filename.includes('%')) {
            try {
              filename = decodeURIComponent(filename);
            } catch (e) {
              // If decode fails, use as is
            }
          }
        }
      }

      // Create blob URL and download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      showAlertMessage('Tải file PDF thành công', 'success');
      setShowPDFExportOptionsModal(false);
      setSelectedAttemptForPDF(null); // Clear after export
    } catch (error) {
      console.error('Error downloading PDF:', error);
      showAlertMessage('Lỗi khi tải file PDF', 'danger');
    } finally {
      setLoadingExamResults(false);
    }
  };

  const handleBulkExportPDF = () => {
    // Get all filtered attempts
    const attemptsToExport = filteredExamAttempts;
    
    if (attemptsToExport.length === 0) {
      showAlertMessage('Không có bài thi nào để xuất PDF', 'warning');
      return;
    }

    // Show options modal first (bulkPDFExportOptions is already loaded from localStorage)
    setShowBulkPDFOptionsModal(true);
  };

  const handleBulkPDFExportConfirm = async () => {
    // Get all filtered attempts
    const attemptsToExport = filteredExamAttempts;
    
    if (attemptsToExport.length === 0) {
      showAlertMessage('Không có bài thi nào để xuất PDF', 'warning');
      return;
    }

    // Close options modal
    setShowBulkPDFOptionsModal(false);

    // Show progress modal
    setShowBulkPDFProgressModal(true);
    setBulkPDFProgress({
      current: 0,
      total: attemptsToExport.length,
      currentAttempt: null,
      message: 'Đang khởi tạo...',
      exported: 0,
      failed: 0,
      errors: [],
      isComplete: false
    });

    try {
      const zip = new JSZip();
      const exportOptions = bulkPDFExportOptions;
      let exportedCount = 0;
      let failedCount = 0;
      const errors = [];
      let singlePDFBlob = null;
      let singlePDFFilename = null;

      // Build query params from options (same as exportToPDF)
      const params = new URLSearchParams();
      params.append('showStudentInfo', exportOptions.showStudentInfo ? '1' : '0');
      params.append('showExamInfo', exportOptions.showExamInfo ? '1' : '0');
      if (exportOptions.showExamInfo) {
        params.append('examTitle', exportOptions.showExamInfoItems.examTitle ? '1' : '0');
        params.append('examType', exportOptions.showExamInfoItems.examType ? '1' : '0');
        params.append('duration', exportOptions.showExamInfoItems.duration ? '1' : '0');
        params.append('questionsCount', exportOptions.showExamInfoItems.questionsCount ? '1' : '0');
        params.append('startTime', exportOptions.showExamInfoItems.startTime ? '1' : '0');
        params.append('submitTime', exportOptions.showExamInfoItems.submitTime ? '1' : '0');
        params.append('availableFrom', exportOptions.showExamInfoItems.availableFrom ? '1' : '0');
        params.append('availableUntil', exportOptions.showExamInfoItems.availableUntil ? '1' : '0');
      }
      params.append('showResults', exportOptions.showResults ? '1' : '0');
      params.append('showQuestionsList', exportOptions.showQuestionsList ? '1' : '0');
      if (exportOptions.showQuestionsList) {
        params.append('questionContent', exportOptions.showQuestionItems.questionContent ? '1' : '0');
        params.append('questionOptions', exportOptions.showQuestionItems.questionOptions ? '1' : '0');
        params.append('selectedAnswer', exportOptions.showQuestionItems.selectedAnswer ? '1' : '0');
        params.append('answerTime', exportOptions.showQuestionItems.answerTime ? '1' : '0');
        params.append('thinkingTime', exportOptions.showQuestionItems.thinkingTime ? '1' : '0');
        params.append('questionResult', exportOptions.showQuestionItems.questionResult ? '1' : '0');
      }

      const queryString = params.toString();

      // Export each PDF
      for (let i = 0; i < attemptsToExport.length; i++) {
        const attempt = attemptsToExport[i];
        
        setBulkPDFProgress(prev => ({
          ...prev,
          current: i + 1,
          currentAttempt: attempt,
          message: `Đang xuất PDF cho ${attempt.student_name || attempt.student_id || 'N/A'}...`
        }));

        try {
          // Use fetch API directly to ensure blob data integrity
          const token = localStorage.getItem('token');
          const fetchResponse = await fetch(`${getApiBaseURL()}/lms/attempts/${attempt.attempt_id}/results/pdf?${queryString}`, {
            headers: {
              'x-auth-token': token
            }
          });
          
          if (!fetchResponse.ok) {
            throw new Error(`HTTP ${fetchResponse.status}: ${fetchResponse.statusText}`);
          }
          
          // Get blob from fetch response
          const blob = await fetchResponse.blob();
          
          // Create axios-like response object for compatibility
          const response = {
            data: blob,
            headers: {
              'content-disposition': fetchResponse.headers.get('content-disposition') || '',
              'Content-Disposition': fetchResponse.headers.get('content-disposition') || ''
            }
          };

          // Extract filename from Content-Disposition header
          let filename = `ket-qua-thi-${attempt.attempt_id}.pdf`;
          const contentDisposition = response.headers['content-disposition'] || response.headers['Content-Disposition'];
          if (contentDisposition) {
            let filenameMatch = contentDisposition.match(/filename\*?=['"]?([^'";\n]+)['"]?/i);
            if (filenameMatch && filenameMatch[1]) {
              filename = filenameMatch[1];
              if (filename.startsWith("UTF-8''")) {
                filename = decodeURIComponent(filename.substring(7));
              } else if (filename.includes('%')) {
                try {
                  filename = decodeURIComponent(filename);
                } catch (e) {
                  // If decode fails, use as is
                }
              }
            }
          }

          // Store single PDF if only one will be exported
          if (attemptsToExport.length === 1) {
            // Use blob directly from fetch API
            singlePDFBlob = blob;
            singlePDFFilename = filename;
          } else {
            // For multiple PDFs, convert Blob to ArrayBuffer for JSZip
            // blob is a real Blob from fetch API, so we can use arrayBuffer() method
            const arrayBuffer = await blob.arrayBuffer();
            
            // Add PDF to zip
            zip.file(filename, arrayBuffer);
          }
          
          exportedCount++;

          setBulkPDFProgress(prev => ({
            ...prev,
            exported: exportedCount,
            message: `Đã xuất ${exportedCount}/${attemptsToExport.length} PDF...`
          }));

          // Small delay to prevent overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Error exporting PDF for attempt ${attempt.attempt_id}:`, error);
          failedCount++;
          const errorMsg = `Lỗi khi xuất PDF cho ${attempt.student_name || attempt.student_id || 'N/A'}: ${error.response?.data?.message || error.message}`;
          errors.push(errorMsg);

          setBulkPDFProgress(prev => ({
            ...prev,
            failed: failedCount,
            errors: [...prev.errors, errorMsg]
          }));
        }
      }

      // Download file(s)
      if (exportedCount === 1 && singlePDFBlob) {
        // Download single PDF directly
        const url = window.URL.createObjectURL(singlePDFBlob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', singlePDFFilename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } else if (exportedCount > 1) {
        // Generate and download zip file
        setBulkPDFProgress(prev => ({
          ...prev,
          message: 'Đang nén các file PDF...'
        }));

        const zipBlob = await zip.generateAsync({ type: 'blob' });

        // Download zip file
        const url = window.URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        link.setAttribute('download', `ket-qua-thi-hang-loat-${timestamp}.zip`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      }

      // Complete
      setBulkPDFProgress(prev => ({
        ...prev,
        isComplete: true,
        message: `Hoàn thành! Đã xuất ${exportedCount} PDF${exportedCount > 1 ? ' (đã nén thành file ZIP)' : ''}`
      }));

      if (exportedCount > 0) {
        showAlertMessage(`Đã xuất thành công ${exportedCount}/${attemptsToExport.length} PDF`, 'success');
      }
      if (failedCount > 0) {
        showAlertMessage(`${failedCount} PDF xuất thất bại`, 'warning');
      }
    } catch (error) {
      console.error('Error in bulk PDF export:', error);
      setBulkPDFProgress(prev => ({
        ...prev,
        isComplete: true,
        message: `Lỗi: ${error.message || 'Không thể xuất PDF hàng loạt'}`,
        errors: [...prev.errors, error.message || 'Lỗi không xác định']
      }));
      showAlertMessage('Lỗi khi xuất PDF hàng loạt', 'danger');
    }
  };

  // Excel Export Functions
  const exportToExcel = async (options = null) => {
    // Use selectedAttemptForExcel if available (from list), otherwise use selectedAttempt (from modal)
    const attemptToExport = selectedAttemptForExcel || selectedAttempt;
    if (!attemptToExport) return;

    const exportOptions = options || excelExportOptions;

    try {
      setLoadingExamResults(true);
      
      // Build query params from options
      const params = new URLSearchParams();
      params.append('showStudentInfo', exportOptions.showStudentInfo ? '1' : '0');
      params.append('showExamInfo', exportOptions.showExamInfo ? '1' : '0');
      if (exportOptions.showExamInfo) {
        params.append('examTitle', exportOptions.showExamInfoItems.examTitle ? '1' : '0');
        params.append('examType', exportOptions.showExamInfoItems.examType ? '1' : '0');
        params.append('duration', exportOptions.showExamInfoItems.duration ? '1' : '0');
        params.append('questionsCount', exportOptions.showExamInfoItems.questionsCount ? '1' : '0');
        params.append('startTime', exportOptions.showExamInfoItems.startTime ? '1' : '0');
        params.append('submitTime', exportOptions.showExamInfoItems.submitTime ? '1' : '0');
        params.append('availableFrom', exportOptions.showExamInfoItems.availableFrom ? '1' : '0');
        params.append('availableUntil', exportOptions.showExamInfoItems.availableUntil ? '1' : '0');
      }
      params.append('showResults', exportOptions.showResults ? '1' : '0');
      params.append('showQuestionsList', exportOptions.showQuestionsList ? '1' : '0');
      if (exportOptions.showQuestionsList) {
        params.append('questionContent', exportOptions.showQuestionItems.questionContent ? '1' : '0');
        params.append('questionOptions', exportOptions.showQuestionItems.questionOptions ? '1' : '0');
        params.append('selectedAnswer', exportOptions.showQuestionItems.selectedAnswer ? '1' : '0');
        params.append('answerTime', exportOptions.showQuestionItems.answerTime ? '1' : '0');
        params.append('thinkingTime', exportOptions.showQuestionItems.thinkingTime ? '1' : '0');
        params.append('questionResult', exportOptions.showQuestionItems.questionResult ? '1' : '0');
      }

      const response = await api.get(`/lms/attempts/${attemptToExport.attempt_id}/results/excel?${params.toString()}`, {
        responseType: 'blob'
      });

      // Extract filename from Content-Disposition header
      let filename = `ket-qua-thi-${attemptToExport.attempt_id}.xlsx`; // fallback
      const contentDisposition = response.headers['content-disposition'] || response.headers['Content-Disposition'];
      if (contentDisposition) {
        // Try to match filename= or filename*= (for encoded filenames)
        let filenameMatch = contentDisposition.match(/filename\*?=['"]?([^'";\n]+)['"]?/i);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
          // Decode if it's URL encoded (for filename*=UTF-8''...)
          if (filename.startsWith("UTF-8''")) {
            filename = decodeURIComponent(filename.substring(7));
          } else if (filename.includes('%')) {
            try {
              filename = decodeURIComponent(filename);
            } catch (e) {
              // If decode fails, use as is
            }
          }
        }
      }

      // Create blob URL and download
      // Ensure response.data is a Blob
      const blob = response.data instanceof Blob 
        ? response.data 
        : new Blob([response.data], { 
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
          });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      showAlertMessage('Tải file Excel thành công', 'success');
      setShowExcelExportOptionsModal(false);
      setSelectedAttemptForExcel(null); // Clear after export
    } catch (error) {
      console.error('Error downloading Excel:', error);
      showAlertMessage('Lỗi khi tải file Excel', 'danger');
    } finally {
      setLoadingExamResults(false);
    }
  };

  const handleBulkExportExcel = () => {
    // Get all filtered attempts
    const attemptsToExport = filteredExamAttempts;
    
    if (attemptsToExport.length === 0) {
      showAlertMessage('Không có bài thi nào để xuất Excel', 'warning');
      return;
    }

    // Show options modal first (bulkExcelExportOptions is already loaded from localStorage)
    setShowBulkExcelOptionsModal(true);
  };

  const handleBulkExcelExportConfirm = async () => {
    // Get all filtered attempts
    const attemptsToExport = filteredExamAttempts;
    
    if (attemptsToExport.length === 0) {
      showAlertMessage('Không có bài thi nào để xuất Excel', 'warning');
      return;
    }

    // Close options modal
    setShowBulkExcelOptionsModal(false);

    // Show progress modal
    setShowBulkExcelProgressModal(true);
    setBulkExcelProgress({
      current: 0,
      total: attemptsToExport.length,
      currentAttempt: null,
      message: 'Đang khởi tạo...',
      exported: 0,
      failed: 0,
      errors: [],
      isComplete: false
    });

    try {
      const zip = new JSZip();
      const exportOptions = bulkExcelExportOptions;
      let exportedCount = 0;
      let failedCount = 0;
      const errors = [];
      let singleExcelBlob = null;
      let singleExcelFilename = null;

      // Build query params from options (same as exportToExcel)
      const params = new URLSearchParams();
      params.append('showStudentInfo', exportOptions.showStudentInfo ? '1' : '0');
      params.append('showExamInfo', exportOptions.showExamInfo ? '1' : '0');
      if (exportOptions.showExamInfo) {
        params.append('examTitle', exportOptions.showExamInfoItems.examTitle ? '1' : '0');
        params.append('examType', exportOptions.showExamInfoItems.examType ? '1' : '0');
        params.append('duration', exportOptions.showExamInfoItems.duration ? '1' : '0');
        params.append('questionsCount', exportOptions.showExamInfoItems.questionsCount ? '1' : '0');
        params.append('startTime', exportOptions.showExamInfoItems.startTime ? '1' : '0');
        params.append('submitTime', exportOptions.showExamInfoItems.submitTime ? '1' : '0');
        params.append('availableFrom', exportOptions.showExamInfoItems.availableFrom ? '1' : '0');
        params.append('availableUntil', exportOptions.showExamInfoItems.availableUntil ? '1' : '0');
      }
      params.append('showResults', exportOptions.showResults ? '1' : '0');
      params.append('showQuestionsList', exportOptions.showQuestionsList ? '1' : '0');
      if (exportOptions.showQuestionsList) {
        params.append('questionContent', exportOptions.showQuestionItems.questionContent ? '1' : '0');
        params.append('questionOptions', exportOptions.showQuestionItems.questionOptions ? '1' : '0');
        params.append('selectedAnswer', exportOptions.showQuestionItems.selectedAnswer ? '1' : '0');
        params.append('answerTime', exportOptions.showQuestionItems.answerTime ? '1' : '0');
        params.append('thinkingTime', exportOptions.showQuestionItems.thinkingTime ? '1' : '0');
        params.append('questionResult', exportOptions.showQuestionItems.questionResult ? '1' : '0');
      }

      const queryString = params.toString();

      // Export each Excel file
      for (let i = 0; i < attemptsToExport.length; i++) {
        const attempt = attemptsToExport[i];
        
        setBulkExcelProgress(prev => ({
          ...prev,
          current: i + 1,
          currentAttempt: attempt,
          message: `Đang xuất Excel cho ${attempt.student_name || attempt.student_id || 'N/A'}...`
        }));

        try {
          // Use fetch API directly to ensure blob data integrity
          const token = localStorage.getItem('token');
          const fetchResponse = await fetch(`${getApiBaseURL()}/lms/attempts/${attempt.attempt_id}/results/excel?${queryString}`, {
            headers: {
              'x-auth-token': token
            }
          });
          
          if (!fetchResponse.ok) {
            throw new Error(`HTTP ${fetchResponse.status}: ${fetchResponse.statusText}`);
          }
          
          // Get blob from fetch response
          const blob = await fetchResponse.blob();
          
          // Create axios-like response object for compatibility
          const response = {
            data: blob,
            headers: {
              'content-disposition': fetchResponse.headers.get('content-disposition') || '',
              'Content-Disposition': fetchResponse.headers.get('content-disposition') || ''
            }
          };

          // Extract filename from Content-Disposition header
          let filename = `ket-qua-thi-${attempt.attempt_id}.xlsx`;
          const contentDisposition = response.headers['content-disposition'] || response.headers['Content-Disposition'];
          if (contentDisposition) {
            let filenameMatch = contentDisposition.match(/filename\*?=['"]?([^'";\n]+)['"]?/i);
            if (filenameMatch && filenameMatch[1]) {
              filename = filenameMatch[1];
              if (filename.startsWith("UTF-8''")) {
                filename = decodeURIComponent(filename.substring(7));
              } else if (filename.includes('%')) {
                try {
                  filename = decodeURIComponent(filename);
                } catch (e) {
                  // If decode fails, use as is
                }
              }
            }
          }

          // Store single Excel if only one will be exported
          if (attemptsToExport.length === 1) {
            // Use blob directly from fetch API
            singleExcelBlob = blob;
            singleExcelFilename = filename;
          } else {
            // For multiple Excel files, convert Blob to ArrayBuffer for JSZip
            const arrayBuffer = await blob.arrayBuffer();
            
            // Add Excel to zip
            zip.file(filename, arrayBuffer);
          }
          
          exportedCount++;

          setBulkExcelProgress(prev => ({
            ...prev,
            exported: exportedCount,
            message: `Đã xuất ${exportedCount}/${attemptsToExport.length} Excel...`
          }));

          // Small delay to prevent overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Error exporting Excel for attempt ${attempt.attempt_id}:`, error);
          failedCount++;
          const errorMsg = `Lỗi khi xuất Excel cho ${attempt.student_name || attempt.student_id || 'N/A'}: ${error.response?.data?.message || error.message}`;
          errors.push(errorMsg);

          setBulkExcelProgress(prev => ({
            ...prev,
            failed: failedCount,
            errors: [...prev.errors, errorMsg]
          }));
        }
      }

      // Download file(s)
      if (exportedCount === 1 && singleExcelBlob) {
        // Download single Excel directly
        const url = window.URL.createObjectURL(singleExcelBlob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', singleExcelFilename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } else if (exportedCount > 1) {
        // Generate and download zip file
        setBulkExcelProgress(prev => ({
          ...prev,
          message: 'Đang nén các file Excel...'
        }));

        const zipBlob = await zip.generateAsync({ type: 'blob' });

        // Download zip file
        const url = window.URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        link.setAttribute('download', `ket-qua-thi-hang-loat-${timestamp}.zip`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      }

      // Complete
      setBulkExcelProgress(prev => ({
        ...prev,
        isComplete: true,
        message: `Hoàn thành! Đã xuất ${exportedCount} Excel${exportedCount > 1 ? ' (đã nén thành file ZIP)' : ''}`
      }));

      if (exportedCount > 0) {
        showAlertMessage(`Đã xuất thành công ${exportedCount}/${attemptsToExport.length} Excel`, 'success');
      }
      if (failedCount > 0) {
        showAlertMessage(`${failedCount} Excel xuất thất bại`, 'warning');
      }
    } catch (error) {
      console.error('Error in bulk Excel export:', error);
      setBulkExcelProgress(prev => ({
        ...prev,
        isComplete: true,
        message: `Lỗi: ${error.message || 'Không thể xuất Excel hàng loạt'}`,
        errors: [...prev.errors, error.message || 'Lỗi không xác định']
      }));
      showAlertMessage('Lỗi khi xuất Excel hàng loạt', 'danger');
    }
  };

  const handleExportExcelFromAttempt = async (attempt, e) => {
    e.stopPropagation(); // Prevent row click from triggering
    
    // Store attempt for Excel export
    setSelectedAttemptForExcel(attempt);
    
    // Find the button element to position modal
    const buttonElement = e.currentTarget;
    if (buttonElement) {
      const rect = buttonElement.getBoundingClientRect();
      const modalWidth = 320;
      const modalHeight = 500; // Approximate max height
      const gap = 8;
      
      // Position modal to the left of the button
      let left = rect.left - modalWidth - gap;
      
      // Align modal vertically with button (top aligned)
      let top = rect.top;
      
      // Ensure modal doesn't go off screen horizontally - if not enough space on left, show on right
      if (left < 10) {
        // Not enough space on left, show on right side of button
        left = rect.right + gap;
        // If still off screen, adjust to fit
        if (left + modalWidth > window.innerWidth - 10) {
          left = window.innerWidth - modalWidth - 10;
        }
      }
      
      // Ensure modal doesn't go off screen vertically
      const minTop = 10; // Minimum distance from top of screen
      const maxTop = window.innerHeight - modalHeight - 10; // Maximum top to keep modal fully visible
      
      if (top < minTop) {
        top = minTop;
      } else if (top + modalHeight > window.innerHeight - 10) {
        // If modal would go off bottom, adjust to fit
        top = Math.max(minTop, window.innerHeight - modalHeight - 10);
      }
      
      setExcelModalPosition({ top, left });
      setShowExcelExportOptionsModal(true);
    }
  };

  const handleExcelExportConfirm = () => {
    exportToExcel();
  };

  // Filter grades based on export options
  const getFilteredGradesForExport = () => {
    let filtered = [...grades];

    // Filter by date
    if (exportGradebookOptions.dateType === 'specific' && exportGradebookOptions.dateSpecific) {
      const specificDate = new Date(exportGradebookOptions.dateSpecific);
      specificDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(grade => {
        if (!grade.created_at && !grade.updated_at) return false;
        const gradeDate = new Date(grade.updated_at || grade.created_at);
        gradeDate.setHours(0, 0, 0, 0);
        return gradeDate.getTime() === specificDate.getTime();
      });
    } else if (exportGradebookOptions.dateType === 'range') {
      if (exportGradebookOptions.dateFrom) {
        const dateFrom = new Date(exportGradebookOptions.dateFrom);
        dateFrom.setHours(0, 0, 0, 0);
        filtered = filtered.filter(grade => {
          if (!grade.created_at && !grade.updated_at) return false;
          const gradeDate = new Date(grade.updated_at || grade.created_at);
          gradeDate.setHours(0, 0, 0, 0);
          return gradeDate >= dateFrom;
        });
      }
      if (exportGradebookOptions.dateTo) {
        const dateTo = new Date(exportGradebookOptions.dateTo);
        dateTo.setHours(23, 59, 59, 999);
        filtered = filtered.filter(grade => {
          if (!grade.created_at && !grade.updated_at) return false;
          const gradeDate = new Date(grade.updated_at || grade.created_at);
          return gradeDate <= dateTo;
        });
      }
    }

    // Filter by class
    if (exportGradebookOptions.class_name) {
      filtered = filtered.filter(grade => {
        const gradeClass = grade.class_name || '';
        return gradeClass.trim() === exportGradebookOptions.class_name.trim();
      });
    }

    // Filter by user
    if (exportGradebookOptions.user_id) {
      filtered = filtered.filter(grade => String(grade.user_id || '') === String(exportGradebookOptions.user_id));
    }

    // Filter by exam
    if (exportGradebookOptions.exam_id) {
      filtered = filtered.filter(grade => {
        return String(grade.exam_id || '') === String(exportGradebookOptions.exam_id) || 
               String(grade.item_id || '') === String(exportGradebookOptions.exam_id);
      });
    }

    return filtered;
  };

  // Export gradebook to Excel
  const exportGradebookToExcel = () => {
    const filteredGrades = getFilteredGradesForExport();
    
    if (filteredGrades.length === 0) {
      showAlertMessage('Không có dữ liệu để xuất', 'warning');
      return;
    }

    try {
      const exportData = filteredGrades.map((grade, index) => {
        const percentage = grade.max_score > 0 ? (grade.score / grade.max_score) * 100 : 0;
        const letterGrade = getLetterGrade(percentage);
        
        return {
          'STT': index + 1,
          'Học viên': grade.student_name || 'N/A',
          'Mã sinh viên': grade.student_code || grade.student_id || 'N/A',
          'Lớp': grade.class_name || 'N/A',
          'Kỳ thi': grade.item_name || grade.exam_title || grade.course_name || 'N/A',
          'Điểm': formatNumber(grade.score || 0),
          'Điểm tối đa': formatNumber(grade.max_score || 0),
          'Tỷ lệ %': formatNumber(percentage),
          'Xếp loại': letterGrade.grade,
          'Người chấm': grade.graded_by_name || 'N/A',
          'Ngày chấm': formatDate(grade.updated_at || grade.created_at)
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      
      // Set column widths
      const colWidths = [
        { wch: 5 },   // STT
        { wch: 25 },  // Học viên
        { wch: 15 },  // Mã sinh viên
        { wch: 20 },  // Lớp
        { wch: 30 },  // Kỳ thi
        { wch: 10 },  // Điểm
        { wch: 12 },  // Điểm tối đa
        { wch: 10 },  // Tỷ lệ %
        { wch: 10 },  // Xếp loại
        { wch: 20 },  // Người chấm
        { wch: 15 }   // Ngày chấm
      ];
      ws['!cols'] = colWidths;
      
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Bang_Diem');

      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `Bang_Diem_${timestamp}.xlsx`;

      XLSX.writeFile(wb, filename);
      showAlertMessage('Xuất file Excel thành công!', 'success');
      setShowExportGradebookModal(false);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      showAlertMessage('Lỗi khi xuất file Excel', 'danger');
    }
  };

  // Export gradebook to Word (using backend endpoint)
  const exportGradebookToWord = async () => {
    try {
      setLoading(true);
      
      // Build query params from export options
      const params = new URLSearchParams();
      
      // Date filter
      params.append('dateType', exportGradebookOptions.dateType);
      if (exportGradebookOptions.dateType === 'specific' && exportGradebookOptions.dateSpecific) {
        params.append('dateSpecific', exportGradebookOptions.dateSpecific);
      } else if (exportGradebookOptions.dateType === 'range') {
        if (exportGradebookOptions.dateFrom) {
          params.append('dateFrom', exportGradebookOptions.dateFrom);
        }
        if (exportGradebookOptions.dateTo) {
          params.append('dateTo', exportGradebookOptions.dateTo);
        }
      }
      
      // Other filters
      if (exportGradebookOptions.class_name) {
        params.append('class_name', exportGradebookOptions.class_name);
      }
      if (exportGradebookOptions.user_id) {
        params.append('user_id', exportGradebookOptions.user_id);
      }
      if (exportGradebookOptions.exam_id) {
        params.append('exam_id', exportGradebookOptions.exam_id);
      }
      
      const response = await api.get(`/lms/grades/export/word?${params.toString()}`, {
        responseType: 'blob'
      });
      
      // Extract filename from Content-Disposition header
      let filename = `bang-diem-${Date.now()}.doc`;
      const contentDisposition = response.headers['content-disposition'] || response.headers['Content-Disposition'];
      if (contentDisposition) {
        let filenameMatch = contentDisposition.match(/filename\*?=['"]?([^'";\n]+)['"]?/i);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
          if (filename.startsWith("UTF-8''")) {
            filename = decodeURIComponent(filename.substring(7));
          } else if (filename.includes('%')) {
            try {
              filename = decodeURIComponent(filename);
            } catch (e) {
              // If decode fails, use as is
            }
          }
        }
      }
      
      // Create blob URL and download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      showAlertMessage('Tải file Word thành công', 'success');
      setShowExportGradebookModal(false);
    } catch (error) {
      console.error('Error downloading Word:', error);
      showAlertMessage(error.response?.data?.message || 'Lỗi khi tải file Word', 'danger');
    } finally {
      setLoading(false);
    }
  };

  // Export gradebook to PDF (using backend endpoint)
  const exportGradebookToPDF = async () => {
    try {
      setLoading(true);
      
      // Build query params from export options
      const params = new URLSearchParams();
      
      // Date filter
      params.append('dateType', exportGradebookOptions.dateType);
      if (exportGradebookOptions.dateType === 'specific' && exportGradebookOptions.dateSpecific) {
        params.append('dateSpecific', exportGradebookOptions.dateSpecific);
      } else if (exportGradebookOptions.dateType === 'range') {
        if (exportGradebookOptions.dateFrom) {
          params.append('dateFrom', exportGradebookOptions.dateFrom);
        }
        if (exportGradebookOptions.dateTo) {
          params.append('dateTo', exportGradebookOptions.dateTo);
        }
      }
      
      // Other filters
      if (exportGradebookOptions.class_name) {
        params.append('class_name', exportGradebookOptions.class_name);
      }
      if (exportGradebookOptions.user_id) {
        params.append('user_id', exportGradebookOptions.user_id);
      }
      if (exportGradebookOptions.exam_id) {
        params.append('exam_id', exportGradebookOptions.exam_id);
      }
      
      const response = await api.get(`/lms/grades/export/pdf?${params.toString()}`, {
        responseType: 'blob'
      });
      
      // Extract filename from Content-Disposition header
      let filename = `bang-diem-${Date.now()}.pdf`;
      const contentDisposition = response.headers['content-disposition'] || response.headers['Content-Disposition'];
      if (contentDisposition) {
        let filenameMatch = contentDisposition.match(/filename\*?=['"]?([^'";\n]+)['"]?/i);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
          if (filename.startsWith("UTF-8''")) {
            filename = decodeURIComponent(filename.substring(7));
          } else if (filename.includes('%')) {
            try {
              filename = decodeURIComponent(filename);
            } catch (e) {
              // If decode fails, use as is
            }
          }
        }
      }
      
      // Create blob URL and download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      showAlertMessage('Tải file PDF thành công', 'success');
      setShowExportGradebookModal(false);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      showAlertMessage(error.response?.data?.message || 'Lỗi khi tải file PDF', 'danger');
    } finally {
      setLoading(false);
    }
  };

  // Handle export gradebook
  const handleExportGradebook = async () => {
    if (exportGradebookOptions.format === 'excel') {
      exportGradebookToExcel();
    } else if (exportGradebookOptions.format === 'word') {
      await exportGradebookToWord();
    } else if (exportGradebookOptions.format === 'pdf') {
      await exportGradebookToPDF();
    }
  };

  const handleExportPDFClick = () => {
    if (pdfExportButtonRef.current) {
      // Clear selectedAttemptForPDF when opening from modal (use selectedAttempt instead)
      setSelectedAttemptForPDF(null);
      
      const rect = pdfExportButtonRef.current.getBoundingClientRect();
      const modalWidth = 320;
      const modalHeight = 500; // Approximate max height
      const gap = 8;
      
      // Calculate position - center horizontally on button, above it
      let left = rect.left + (rect.width / 2) - (modalWidth / 2);
      let top = rect.top - modalHeight - gap;
      
      // Ensure modal doesn't go off screen
      if (left < 10) left = 10;
      if (left + modalWidth > window.innerWidth - 10) {
        left = window.innerWidth - modalWidth - 10;
      }
      if (top < 10) {
        // If not enough space above, show below button
        top = rect.bottom + gap;
      }
      
      setPdfModalPosition({ top, left });
      setShowPDFExportOptionsModal(true);
    }
  };

  const handlePDFExportConfirm = () => {
    exportToPDF();
  };

  const handleExportExcelClick = () => {
    if (excelExportButtonRef.current) {
      // Clear selectedAttemptForExcel when opening from modal (use selectedAttempt instead)
      setSelectedAttemptForExcel(null);
      
      const rect = excelExportButtonRef.current.getBoundingClientRect();
      const modalWidth = 320;
      const modalHeight = 500; // Approximate max height
      const gap = 8;
      
      // Calculate position - center horizontally on button, above it
      let left = rect.left + (rect.width / 2) - (modalWidth / 2);
      let top = rect.top - modalHeight - gap;
      
      // Ensure modal doesn't go off screen
      if (left < 10) left = 10;
      if (left + modalWidth > window.innerWidth - 10) {
        left = window.innerWidth - modalWidth - 10;
      }
      if (top < 10) {
        // If not enough space above, show below button
        top = rect.bottom + gap;
      }
      
      setExcelModalPosition({ top, left });
      setShowExcelExportOptionsModal(true);
    }
  };

  // Filter exam attempts based on filters (client-side filtering)
  const filteredExamAttempts = React.useMemo(() => {
    if (!Array.isArray(examAttempts) || examAttempts.length === 0) return [];

    let filtered = [...examAttempts];

    // Filter by search (student name or student ID)
    if (examFilters.search && examFilters.search.trim() !== '') {
      const searchTerm = examFilters.search.toLowerCase().trim();
      filtered = filtered.filter(attempt => 
        attempt.student_name?.toLowerCase().includes(searchTerm) ||
        attempt.student_id?.toLowerCase().includes(searchTerm)
      );
    }

    // Filter by exam_id
    if (examFilters.exam_id && examFilters.exam_id.trim() !== '') {
      filtered = filtered.filter(attempt => attempt.exam_id == examFilters.exam_id);
    }

    // Filter by class_name
    if (examFilters.class_name && examFilters.class_name.trim() !== '') {
      filtered = filtered.filter(attempt => {
        const attemptClass = attempt.class_name || '';
        return attemptClass.trim() === examFilters.class_name.trim();
      });
    }


    // Filter by result (passed/failed)
    if (examFilters.result && examFilters.result.trim() !== '') {
      filtered = filtered.filter(attempt => {
        const score = parseFloat(attempt.score || 0);
        const totalPoints = parseFloat(attempt.total_points || 0);
        const percentage = totalPoints > 0 ? (score / totalPoints) * 100 : 0;
        const passingScore = parseFloat(attempt.passing_score || 60);
        const passed = percentage >= passingScore;
        
        if (examFilters.result === 'passed') {
          return passed;
        } else if (examFilters.result === 'failed') {
          return !passed;
        }
        return true;
      });
    }

    // Sort by submit time descending
    filtered.sort((a, b) => {
      const timeA = new Date(a.submit_time || a.end_time || 0);
      const timeB = new Date(b.submit_time || b.end_time || 0);
      return timeB - timeA;
    });

    return filtered;
  }, [examAttempts, examFilters]);

  // Update pagination when filtered attempts change
  useEffect(() => {
    const totalItems = filteredExamAttempts.length;
    const totalPages = Math.ceil(totalItems / examAttemptsPagination.limit);
    setExamAttemptsPagination(prev => ({
      ...prev,
      totalItems,
      totalPages,
      page: prev.page > totalPages && totalPages > 0 ? totalPages : prev.page
    }));
  }, [filteredExamAttempts.length, examAttemptsPagination.limit]);

  // Apply pagination
  const displayedAttempts = React.useMemo(() => {
    return filteredExamAttempts.slice(
      (examAttemptsPagination.page - 1) * examAttemptsPagination.limit,
      examAttemptsPagination.page * examAttemptsPagination.limit
    );
  }, [filteredExamAttempts, examAttemptsPagination.page, examAttemptsPagination.limit]);

  // Filter grades based on gradebookFilters (client-side filtering)
  const filteredGrades = React.useMemo(() => {
    if (!Array.isArray(grades) || grades.length === 0) return [];

    let filtered = [...grades];

    // Filter by search (student name or student code)
    if (gradebookFilters.search && gradebookFilters.search.trim() !== '') {
      const searchTerm = gradebookFilters.search.toLowerCase().trim();
      filtered = filtered.filter(grade => 
        grade.student_name?.toLowerCase().includes(searchTerm) ||
        grade.student_code?.toLowerCase().includes(searchTerm) ||
        grade.student_id?.toLowerCase().includes(searchTerm)
      );
    }

    // Filter by exam_id (or item_id for non-exam grades)
    if (gradebookFilters.exam_id && gradebookFilters.exam_id.trim() !== '') {
      filtered = filtered.filter(grade => {
        // Match by exam_id if available, otherwise match by item_id
        return String(grade.exam_id || '') === String(gradebookFilters.exam_id) || 
               String(grade.item_id || '') === String(gradebookFilters.exam_id);
      });
    }

    // Filter by class_name
    if (gradebookFilters.class_name && gradebookFilters.class_name.trim() !== '') {
      filtered = filtered.filter(grade => {
        const gradeClass = grade.class_name || '';
        return gradeClass.trim() === gradebookFilters.class_name.trim();
      });
    }

    // Filter by letter grade (A, B, C, D, F)
    if (gradebookFilters.letterGrade && gradebookFilters.letterGrade.trim() !== '') {
      filtered = filtered.filter(grade => {
        const percentage = grade.max_score > 0 ? (grade.score / grade.max_score) * 100 : 0;
        const letterGrade = getLetterGrade(percentage);
        return letterGrade.grade === gradebookFilters.letterGrade;
      });
    }

    // Filter by score range
    if (gradebookFilters.scoreFrom && gradebookFilters.scoreFrom.trim() !== '') {
      const scoreFrom = parseFloat(gradebookFilters.scoreFrom);
      if (!isNaN(scoreFrom)) {
        filtered = filtered.filter(grade => {
          const percentage = grade.max_score > 0 ? (grade.score / grade.max_score) * 100 : 0;
          return percentage >= scoreFrom;
        });
      }
    }
    if (gradebookFilters.scoreTo && gradebookFilters.scoreTo.trim() !== '') {
      const scoreTo = parseFloat(gradebookFilters.scoreTo);
      if (!isNaN(scoreTo)) {
        filtered = filtered.filter(grade => {
          const percentage = grade.max_score > 0 ? (grade.score / grade.max_score) * 100 : 0;
          return percentage <= scoreTo;
        });
      }
    }

    // Filter by date - prioritize specific date over date range
    if (gradebookFilters.dateSpecific && gradebookFilters.dateSpecific.trim() !== '') {
      // If specific date is set, use it and ignore date range
      const specificDate = new Date(gradebookFilters.dateSpecific);
      specificDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(grade => {
        if (!grade.created_at && !grade.updated_at) return false;
        const gradeDate = new Date(grade.updated_at || grade.created_at);
        gradeDate.setHours(0, 0, 0, 0);
        return gradeDate.getTime() === specificDate.getTime();
      });
    } else {
      // Filter by date range (only if specific date is not set)
      if (gradebookFilters.dateFrom && gradebookFilters.dateFrom.trim() !== '') {
        const dateFrom = new Date(gradebookFilters.dateFrom);
        dateFrom.setHours(0, 0, 0, 0);
        filtered = filtered.filter(grade => {
          if (!grade.created_at && !grade.updated_at) return false;
          const gradeDate = new Date(grade.updated_at || grade.created_at);
          gradeDate.setHours(0, 0, 0, 0);
          return gradeDate >= dateFrom;
        });
      }
      if (gradebookFilters.dateTo && gradebookFilters.dateTo.trim() !== '') {
        const dateTo = new Date(gradebookFilters.dateTo);
        dateTo.setHours(23, 59, 59, 999);
        filtered = filtered.filter(grade => {
          if (!grade.created_at && !grade.updated_at) return false;
          const gradeDate = new Date(grade.updated_at || grade.created_at);
          return gradeDate <= dateTo;
        });
      }
    }

    // Sort by updated_at descending (most recent first)
    filtered.sort((a, b) => {
      const timeA = new Date(a.updated_at || a.created_at || 0);
      const timeB = new Date(b.updated_at || b.created_at || 0);
      return timeB - timeA;
    });

    return filtered;
  }, [grades, gradebookFilters]);

  // Update pagination when filtered grades change
  useEffect(() => {
    if (activeTab === 'gradebook') {
      const totalItems = filteredGrades.length;
      const totalPages = Math.ceil(totalItems / pagination.limit);
      setPagination(prev => ({
        ...prev,
        totalItems,
        totalPages,
        page: prev.page > totalPages && totalPages > 0 ? totalPages : prev.page
      }));
    }
  }, [filteredGrades.length, pagination.limit, activeTab]);

  const handleExportPDFFromAttempt = async (attempt, e) => {
    e.stopPropagation(); // Prevent row click from triggering
    
    // Store attempt for PDF export
    setSelectedAttemptForPDF(attempt);
    
    // Find the button element to position modal
    const buttonElement = e.currentTarget;
    if (buttonElement) {
      const rect = buttonElement.getBoundingClientRect();
      const modalWidth = 320;
      const modalHeight = 500; // Approximate max height
      const gap = 8;
      
      // Position modal to the left of the button
      let left = rect.left - modalWidth - gap;
      
      // Align modal vertically with button (top aligned)
      let top = rect.top;
      
      // Ensure modal doesn't go off screen horizontally - if not enough space on left, show on right
      if (left < 10) {
        // Not enough space on left, show on right side of button
        left = rect.right + gap;
        // If still off screen, adjust to fit
        if (left + modalWidth > window.innerWidth - 10) {
          left = window.innerWidth - modalWidth - 10;
        }
      }
      
      // Ensure modal doesn't go off screen vertically
      const minTop = 10; // Minimum distance from top of screen
      const maxTop = window.innerHeight - modalHeight - 10; // Maximum top to keep modal fully visible
      
      if (top < minTop) {
        top = minTop;
      } else if (top + modalHeight > window.innerHeight - 10) {
        // If modal would go off bottom, adjust to fit
        top = Math.max(minTop, window.innerHeight - modalHeight - 10);
      }
      
      setPdfModalPosition({ top, left });
      setShowPDFExportOptionsModal(true);
    }
  };

  return (
    <div className="container-fluid session-main-container">
      {/* Header */}
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Đánh giá & Điểm số</h1>
            <p className="header-subtitle">Quản lý điểm, rubric, phúc khảo</p>
          </div>
          <div className="header-actions">
            {activeTab === 'gradebook' && hasLMSQAPermission() && (
              <Button variant="outline-light" className="create-session-btn" onClick={() => setShowExportGradebookModal(true)}>
                <i className="fas fa-file-export me-2"></i>Xuất bảng điểm
              </Button>
            )}
            {activeTab === 'rubrics' && hasLMSQAPermission() && (
              <Button variant="outline-light" className="create-session-btn" onClick={handleCreateRubric}>
                <i className="fas fa-plus me-2"></i>Tạo Rubric mới
              </Button>
            )}
            {activeTab === 'exam-results' && hasLMSQAPermission() && (
              <>
                <Button variant="outline-light" className="create-session-btn" onClick={handleBulkExportPDF}>
                  <i className="fas fa-file-pdf me-2"></i>Xuất PDF hàng loạt
                </Button>
                <Button variant="outline-light" className="create-session-btn" onClick={handleBulkExportExcel} style={{ marginLeft: '8px' }}>
                  <i className="fas fa-file-excel me-2"></i>Xuất Excel hàng loạt
                </Button>
              </>
            )}
          </div>
        </div>
      </div>


      {/* Tabs */}
      <div className="tab-navigation">
        <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="custom-tabs">
        {/* Gradebook Tab - Chỉ lms_qa mới có quyền xem */}
        {hasLMSQAPermission() && (
        <Tab eventKey="gradebook" title={<span><i className="fas fa-table me-2"></i>Sổ điểm</span>}>
          {/* Filters - Similar to Exam Results tab */}
          <div className="session-list-controls mb-3">
            <div className="search-controls" style={{ flexWrap: 'wrap', gap: '8px' }}>
              <div className="search-input" style={{ minWidth: '300px', flex: '1' }}>
                <input
                  type="text"
                  placeholder="Tìm theo tên học viên hoặc mã sinh viên..."
                  value={gradebookFilters.search}
                  onChange={(e) => setGradebookFilters({ ...gradebookFilters, search: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>

              <select
                className="filter-select"
                value={gradebookFilters.exam_id}
                onChange={(e) => setGradebookFilters({ ...gradebookFilters, exam_id: e.target.value })}
              >
                <option value="">Tất cả kỳ thi</option>
                {Array.isArray(gradebookExams) && gradebookExams.map((exam) => (
                  <option key={exam.exam_id} value={exam.exam_id}>
                    {exam.exam_title}
                  </option>
                ))}
              </select>

              <select
                className="filter-select"
                value={gradebookFilters.class_name}
                onChange={(e) => setGradebookFilters({ ...gradebookFilters, class_name: e.target.value })}
              >
                <option value="">Tất cả lớp</option>
                {Array.isArray(gradebookClasses) && gradebookClasses.length > 0 ? (
                  gradebookClasses.map((cls, index) => (
                    <option key={cls.id || index} value={cls.name}>
                      {cls.name}
                    </option>
                  ))
                ) : (
                  <option disabled>Đang tải lớp...</option>
                )}
              </select>

              <select
                className="filter-select"
                value={gradebookFilters.letterGrade}
                onChange={(e) => setGradebookFilters({ ...gradebookFilters, letterGrade: e.target.value })}
              >
                <option value="">Tất cả xếp loại</option>
                <option value="A">A (90-100%)</option>
                <option value="B">B (80-89%)</option>
                <option value="C">C (70-79%)</option>
                <option value="D">D (60-69%)</option>
                <option value="F">F (&lt;60%)</option>
              </select>

              <input
                type="number"
                className="filter-select"
                placeholder="Điểm từ (%)"
                value={gradebookFilters.scoreFrom}
                onChange={(e) => setGradebookFilters({ ...gradebookFilters, scoreFrom: e.target.value })}
                min="0"
                max="100"
                style={{ width: '120px' }}
              />

              <input
                type="number"
                className="filter-select"
                placeholder="Điểm đến (%)"
                value={gradebookFilters.scoreTo}
                onChange={(e) => setGradebookFilters({ ...gradebookFilters, scoreTo: e.target.value })}
                min="0"
                max="100"
                style={{ width: '120px' }}
              />

              <input
                type="date"
                className="filter-select"
                placeholder="Ngày cụ thể"
                value={gradebookFilters.dateSpecific}
                onChange={(e) => setGradebookFilters({ ...gradebookFilters, dateSpecific: e.target.value })}
                style={{ width: '160px' }}
              />

              <input
                type="date"
                className="filter-select"
                placeholder="Từ ngày"
                value={gradebookFilters.dateFrom}
                onChange={(e) => setGradebookFilters({ ...gradebookFilters, dateFrom: e.target.value })}
                style={{ width: '160px' }}
              />

              <input
                type="date"
                className="filter-select"
                placeholder="Đến ngày"
                value={gradebookFilters.dateTo}
                onChange={(e) => setGradebookFilters({ ...gradebookFilters, dateTo: e.target.value })}
                style={{ width: '160px' }}
              />
            </div>
          </div>

          {/* Results count */}
          {!loading && grades.length > 0 && (
            <div className="mb-2" style={{ fontSize: '14px', color: '#6c757d' }}>
              <i className="fas fa-info-circle me-1"></i>
              Hiển thị <strong>{filteredGrades.length}</strong> / <strong>{grades.length}</strong> điểm
              {(gradebookFilters.search || gradebookFilters.exam_id || gradebookFilters.class_name || 
                gradebookFilters.letterGrade || gradebookFilters.scoreFrom || gradebookFilters.scoreTo ||
                gradebookFilters.dateSpecific || gradebookFilters.dateFrom || gradebookFilters.dateTo) && (
                <span className="ms-2">
                  (đã lọc)
                </span>
              )}
            </div>
          )}

          <div className="session-table-container">
            {loading ? (
              <div className="text-center p-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Đang tải...</span>
                </div>
              </div>
            ) : (
              <>
                <div className="table-responsive-mobile">
                  <table className="session-table">
                    <thead>
                      <tr>
                        <th>Học viên</th>
                        <th>Kỳ thi</th>
                        <th>Điểm</th>
                        <th>Tỷ lệ %</th>
                        <th>Xếp loại</th>
                        <th>Người chấm</th>
                        <th>Hành động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredGrades.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="text-center p-4">
                            <i className="fas fa-inbox fa-3x text-muted mb-3"></i>
                            <p className="text-muted">
                              {grades.length === 0 
                                ? 'Chưa có điểm nào'
                                : 'Không tìm thấy điểm nào phù hợp với bộ lọc đã chọn'}
                            </p>
                          </td>
                        </tr>
                      ) : (
                        filteredGrades
                          .slice((pagination.page - 1) * pagination.limit, pagination.page * pagination.limit)
                          .map((grade, index) => {
                          const percentage = grade.max_score > 0 ? (grade.score / grade.max_score) * 100 : 0;
                          const letterGrade = getLetterGrade(percentage);
                          // Use grade_id if available, otherwise use a combination of source_type and other fields
                          const uniqueKey = grade.grade_id || `${grade.source_type || 'exam'}-${grade.exam_id || 'none'}-${grade.user_id || 'none'}-${index}`;
                          return (
                            <tr key={uniqueKey}>
                              <td>
                                <strong>{grade.student_name}</strong>
                                {grade.student_code && (
                                  <div className="text-muted small">{grade.student_code}</div>
                                )}
                              </td>
                              <td>
                                <Badge bg="info">{grade.item_name || grade.exam_title || grade.course_name || 'N/A'}</Badge>
                              </td>
                              <td>
                                <strong>{formatNumber(grade.score)}</strong> / {formatNumber(grade.max_score)}
                              </td>
                              <td>
                                <ProgressBar 
                                  now={percentage} 
                                  label={`${formatNumber(percentage)}%`}
                                  variant={letterGrade.color}
                                  style={{ minWidth: '100px' }}
                                />
                              </td>
                              <td>
                                <Badge bg={letterGrade.color} style={{ fontSize: '1rem' }}>
                                  {letterGrade.grade}
                                </Badge>
                              </td>
                              <td>{grade.graded_by_name || 'N/A'}</td>
                              <td>
                                <div className="action-buttons">
                                  <Button
                                    size="sm"
                                    variant="outline-info"
                                    onClick={() => handleCreateAppeal(grade)}
                                    title="Phúc khảo"
                                  >
                                    <i className="fas fa-gavel"></i>
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline-danger"
                                    onClick={() => handleDeleteGrade(grade.grade_id)}
                                    title="Xóa"
                                  >
                                    <i className="fas fa-trash"></i>
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                
                {/* Pagination */}
                {filteredGrades.length > 0 && pagination.totalPages > 1 && (
                  <div className="mt-3">
                    <Pagination
                      currentPage={pagination.page}
                      totalPages={pagination.totalPages}
                      onPageChange={(page) => setPagination(prev => ({ ...prev, page }))}
                      maxVisiblePages={5}
                      showFirstLast={true}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </Tab>
        )}

        {/* Rubrics Tab */}
        <Tab eventKey="rubrics" title={<span><i className="fas fa-list-check me-2"></i>Rubrics</span>}>
          <div className="session-table-container">
            {loading ? (
              <div className="text-center p-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Đang tải...</span>
                </div>
              </div>
            ) : (
              <>
                <div className="table-responsive-mobile">
                  <table className="session-table">
                    <thead>
                      <tr>
                        <th>Tên Rubric</th>
                        <th>Mô tả</th>
                        <th>Số tiêu chí</th>
                        <th>Tổng điểm</th>
                        <th>Người tạo</th>
                        <th>Hành động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rubrics.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="text-center p-4">
                            <i className="fas fa-inbox fa-3x text-muted mb-3"></i>
                            <p className="text-muted">Chưa có rubric nào. Nhấn "Tạo Rubric mới" để bắt đầu.</p>
                          </td>
                        </tr>
                      ) : (
                        rubrics
                          .slice((rubricsPagination.page - 1) * rubricsPagination.limit, rubricsPagination.page * rubricsPagination.limit)
                          .map((rubric) => (
                          <tr key={rubric.rubric_id}>
                            <td>
                              <strong>{rubric.rubric_name}</strong>
                            </td>
                            <td>{rubric.description || 'N/A'}</td>
                            <td>
                              <Badge bg="primary">{rubric.criteria_count || 0}</Badge>
                            </td>
                            <td>
                              <Badge bg="success">{rubric.total_points || 0}</Badge>
                            </td>
                            <td>{rubric.created_by_name || 'N/A'}</td>
                            <td>
                              {hasLMSQAPermission() && (
                              <div className="action-buttons">
                                <Button
                                  size="sm"
                                  variant="outline-warning"
                                  onClick={() => handleEditRubric(rubric)}
                                  title="Sửa"
                                >
                                  <i className="fas fa-edit"></i>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline-danger"
                                  onClick={() => handleDeleteRubric(rubric.rubric_id)}
                                  title="Xóa"
                                >
                                  <i className="fas fa-trash"></i>
                                </Button>
                              </div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                
                {/* Pagination for Rubrics */}
                {rubrics.length > 0 && rubricsPagination.totalPages > 1 && (
                  <div className="mt-3">
                    <Pagination
                      currentPage={rubricsPagination.page}
                      totalPages={rubricsPagination.totalPages}
                      onPageChange={(page) => setRubricsPagination(prev => ({ ...prev, page }))}
                      maxVisiblePages={5}
                      showFirstLast={true}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </Tab>

        {/* Grade Appeals Tab */}
        <Tab eventKey="appeals" title={<span><i className="fas fa-gavel me-2"></i>Phúc khảo</span>}>
          <div className="session-table-container">
            {loading ? (
              <div className="text-center p-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Đang tải...</span>
                </div>
              </div>
            ) : (
              <>
                <div className="table-responsive-mobile">
                  <table className="session-table">
                    <thead>
                      <tr>
                        <th>Học viên</th>
                        <th>Kỳ thi</th>
                        <th>Điểm hiện tại</th>
                        <th>Lý do</th>
                        <th>Trạng thái</th>
                        <th>Ngày gửi</th>
                        <th>Hành động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gradeAppeals.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="text-center p-4">
                            <i className="fas fa-inbox fa-3x text-muted mb-3"></i>
                            <p className="text-muted">Chưa có yêu cầu phúc khảo nào</p>
                          </td>
                        </tr>
                      ) : (
                        gradeAppeals
                          .slice((appealsPagination.page - 1) * appealsPagination.limit, appealsPagination.page * appealsPagination.limit)
                          .map((appeal) => (
                          <tr key={appeal.appeal_id}>
                            <td>
                              <strong>{appeal.student_name}</strong>
                            </td>
                            <td>{appeal.item_name || 'N/A'}</td>
                            <td>
                              {(() => {
                                // Ensure max_score is valid
                                const maxScore = appeal.max_score > 0 ? appeal.max_score : (appeal.score > 0 ? 100 : 0);
                                const percentage = maxScore > 0 ? (appeal.score / maxScore) * 100 : 0;
                                // For exams, use passing_score from exam, for other grades, use default 60%
                                const passingScore = appeal.passing_score !== undefined && appeal.passing_score !== null 
                                  ? parseFloat(appeal.passing_score) 
                                  : 60;
                                const passed = percentage >= passingScore;
                                
                                if (maxScore === 0) {
                                  return <span className="text-muted">N/A</span>;
                                }
                                
                                return (
                                  <span 
                                    title={passed ? 'Đạt' : 'Không đạt'}
                                    style={{ cursor: 'help' }}
                                  >
                                    <strong>{formatNumber(appeal.score)}</strong> / {formatNumber(maxScore)}
                                  </span>
                                );
                              })()}
                            </td>
                            <td>
                              <div style={{ maxWidth: '300px' }}>
                                {appeal.reason.substring(0, 100)}
                                {appeal.reason.length > 100 && '...'}
                              </div>
                            </td>
                            <td>{getAppealStatusBadge(appeal.status)}</td>
                            <td>
                              {new Date(appeal.created_at).toLocaleDateString('vi-VN')}
                            </td>
                            <td>
                              {appeal.status === 'pending' && (
                                <Button
                                  size="sm"
                                  variant="outline-primary"
                                  onClick={() => handleRespondToAppeal(appeal)}
                                  title="Phản hồi"
                                >
                                  <i className="fas fa-reply"></i>
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                
                {/* Pagination for Appeals */}
                {gradeAppeals.length > 0 && appealsPagination.totalPages > 1 && (
                  <div className="mt-3">
                    <Pagination
                      currentPage={appealsPagination.page}
                      totalPages={appealsPagination.totalPages}
                      onPageChange={(page) => setAppealsPagination(prev => ({ ...prev, page }))}
                      maxVisiblePages={5}
                      showFirstLast={true}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </Tab>
        </Tabs>
      </div>

      {/* Grade Modal */}
      <Modal show={showGradeModal} onHide={() => setShowGradeModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Nhập điểm</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmitGrade}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Điểm *</Form.Label>
              <Form.Control
                type="number"
                step="0.1"
                value={gradeForm.score}
                onChange={(e) => setGradeForm({ ...gradeForm, score: parseFloat(e.target.value) })}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Điểm tối đa</Form.Label>
              <Form.Control
                type="number"
                value={gradeForm.max_score}
                onChange={(e) => setGradeForm({ ...gradeForm, max_score: parseFloat(e.target.value) })}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Nhận xét</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={gradeForm.feedback}
                onChange={(e) => setGradeForm({ ...gradeForm, feedback: e.target.value })}
              />
            </Form.Group>

            <Form.Check
              type="checkbox"
              label="Miễn điểm (Excused)"
              checked={gradeForm.is_excused}
              onChange={(e) => setGradeForm({ ...gradeForm, is_excused: e.target.checked })}
            />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowGradeModal(false)}>
              Hủy
            </Button>
            <Button variant="primary" type="submit">
              Lưu điểm
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Rubric Modal */}
      <Modal show={showRubricModal} onHide={() => setShowRubricModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{editMode ? 'Chỉnh sửa Rubric' : 'Tạo Rubric mới'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmitRubric}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Tên Rubric *</Form.Label>
              <Form.Control
                type="text"
                value={rubricForm.rubric_name}
                onChange={(e) => setRubricForm({ ...rubricForm, rubric_name: e.target.value })}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Mô tả</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={rubricForm.description}
                onChange={(e) => setRubricForm({ ...rubricForm, description: e.target.value })}
              />
            </Form.Group>

            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6>Tiêu chí đánh giá</h6>
              <Button size="sm" variant="outline-primary" onClick={handleAddCriterion}>
                <i className="fas fa-plus me-2"></i>Thêm tiêu chí
              </Button>
            </div>

            {rubricForm.criteria.map((criterion, index) => (
              <div key={index} className="border p-3 mb-3 rounded">
                <div className="d-flex justify-content-between mb-2">
                  <strong>Tiêu chí {index + 1}</strong>
                  {rubricForm.criteria.length > 1 && (
                    <Button
                      size="sm"
                      variant="outline-danger"
                      onClick={() => handleRemoveCriterion(index)}
                    >
                      <i className="fas fa-times"></i>
                    </Button>
                  )}
                </div>

                <Form.Group className="mb-2">
                  <Form.Label>Tên tiêu chí</Form.Label>
                  <Form.Control
                    type="text"
                    value={criterion.criteria_name}
                    onChange={(e) => handleCriterionChange(index, 'criteria_name', e.target.value)}
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-2">
                  <Form.Label>Mô tả</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={criterion.description}
                    onChange={(e) => handleCriterionChange(index, 'description', e.target.value)}
                  />
                </Form.Group>

                <div className="row">
                  <div className="col-6">
                    <Form.Group>
                      <Form.Label>Điểm tối đa</Form.Label>
                      <Form.Control
                        type="number"
                        value={criterion.max_points}
                        onChange={(e) => handleCriterionChange(index, 'max_points', parseFloat(e.target.value))}
                      />
                    </Form.Group>
                  </div>
                  <div className="col-6">
                    <Form.Group>
                      <Form.Label>Trọng số</Form.Label>
                      <Form.Control
                        type="number"
                        step="0.1"
                        value={criterion.weight}
                        onChange={(e) => handleCriterionChange(index, 'weight', parseFloat(e.target.value))}
                      />
                    </Form.Group>
                  </div>
                </div>
              </div>
            ))}

            <Alert variant="info">
              <strong>Tổng điểm:</strong>{' '}
              {rubricForm.criteria.reduce((sum, c) => sum + (c.max_points || 0), 0)}
            </Alert>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowRubricModal(false)}>
              Hủy
            </Button>
            <Button variant="primary" type="submit">
              {editMode ? 'Cập nhật' : 'Tạo mới'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Appeal Modal */}
      <Modal show={showAppealModal} onHide={() => setShowAppealModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Yêu cầu phúc khảo</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmitAppeal}>
          <Modal.Body>
            <Alert variant="info">
              <strong>Điểm hiện tại:</strong> {formatNumber(selectedGrade?.score || 0)} / {formatNumber(selectedGrade?.max_score || 0)}
            </Alert>

            <Form.Group className="mb-3">
              <Form.Label>Lý do phúc khảo *</Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                value={appealForm.reason}
                onChange={(e) => setAppealForm({ ...appealForm, reason: e.target.value })}
                placeholder="Vui lòng nêu rõ lý do yêu cầu phúc khảo..."
                required
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowAppealModal(false)}>
              Hủy
            </Button>
            <Button variant="primary" type="submit">
              Gửi yêu cầu
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Appeal Response Modal */}
      <Modal show={showAppealResponseModal} onHide={() => setShowAppealResponseModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Phản hồi phúc khảo</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmitAppealResponse}>
          <Modal.Body>
            {selectedAppeal && (
              <>
                <Alert variant="secondary">
                  <strong>Học viên:</strong> {selectedAppeal.student_name}<br />
                  <strong>Lý do:</strong> {selectedAppeal.reason}
                </Alert>

                <Form.Group className="mb-3">
                  <Form.Label>Quyết định</Form.Label>
                  <Form.Select
                    value={appealResponseForm.status}
                    onChange={(e) => setAppealResponseForm({ ...appealResponseForm, status: e.target.value })}
                  >
                    <option value="approved">Chấp nhận</option>
                    <option value="rejected">Từ chối</option>
                  </Form.Select>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Phản hồi *</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={4}
                    value={appealResponseForm.response}
                    onChange={(e) => setAppealResponseForm({ ...appealResponseForm, response: e.target.value })}
                    placeholder="Nhập phản hồi chi tiết..."
                    required
                  />
                </Form.Group>
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowAppealResponseModal(false)}>
              Hủy
            </Button>
            <Button variant="primary" type="submit">
              Gửi phản hồi
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Question Navigation Sidebar - Outside Modal */}
      {showExamResultsModal && examResults && examResults.answers && examResults.answers.length > 0 && (
        <div className="question-nav-sidebar-external" ref={sidebarRef}>
          {examResults.answers.map((answer, index) => {
            const isActive = activeQuestionIndex === index;
            
            return (
              <button
                key={answer.answer_id || index}
                className={`question-nav-item ${isActive ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  const questionElement = questionRefs.current[`question-${index}`];
                  if (questionElement && modalBodyRef.current) {
                    // Simple scroll to element
                    const elementTop = questionElement.offsetTop;
                    const containerHeight = modalBodyRef.current.clientHeight;
                    const elementHeight = questionElement.offsetHeight;
                    
                    // Scroll to center the question in viewport
                    const scrollPosition = elementTop - (containerHeight / 2) + (elementHeight / 2) - 20;
                    
                    modalBodyRef.current.scrollTo({
                      top: Math.max(0, scrollPosition),
                      behavior: 'smooth'
                    });
                    
                    // Update active index immediately for better UX
                    setActiveQuestionIndex(index);
                  }
                }}
                title={`Câu ${index + 1}`}
                data-question-index={index}
              >
                <span className="question-nav-number">{index + 1}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Exam Results Detail Modal */}
      <Modal 
        show={showExamResultsModal} 
        onHide={() => {
          setShowExamResultsModal(false);
          setExamResults(null);
          setSelectedAttempt(null);
        }} 
        size="xl"
        className="student-detail-modal"
      >
        <Modal.Header closeButton className="student-detail-header">
          <Modal.Title className="student-detail-title">
            <div className="student-avatar">
              <i className="fas fa-clipboard-check"></i>
            </div>
            <div>
              <h4 className="mb-0">Chi tiết kết quả thi</h4>
              <p className="mb-0 student-subtitle">{examResults?.attempt?.exam_title || 'Kỳ thi'}</p>
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body 
          ref={modalBodyRef}
          className="student-detail-body" 
          style={{ maxHeight: '80vh', overflowY: 'auto' }}
        >
          {loadingExamResults ? (
            <div className="text-center p-5">
              <Spinner animation="border" variant="primary" />
              <p className="mt-3">Đang tải kết quả thi...</p>
            </div>
          ) : examResults ? (
            <div className="student-detail-container">
              {/* Student Information Card */}
              <div className="session-card mb-4">
                <div className="card-header-modern">
                  <div className="header-icon">
                    <i className="fas fa-user"></i>
                  </div>
                  <h6>Thông tin sinh viên</h6>
                </div>
                <div className="card-body-modern">
                  <div className="info-item">
                    <div className="info-label">
                      <i className="fas fa-user me-2"></i>
                      Họ và tên:
                    </div>
                    <div className="info-value">
                      <strong>{selectedAttempt?.student_name || 'N/A'}</strong>
                    </div>
                  </div>
                  {selectedAttempt?.student_id && (
                    <div className="info-item">
                      <div className="info-label">
                        <i className="fas fa-id-card me-2"></i>
                        Mã sinh viên:
                      </div>
                      <div className="info-value">{selectedAttempt.student_id}</div>
                    </div>
                  )}
                  {selectedAttempt?.email && (
                    <div className="info-item">
                      <div className="info-label">
                        <i className="fas fa-envelope me-2"></i>
                        Email:
                      </div>
                      <div className="info-value">{selectedAttempt.email}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Exam Information Card */}
              <div className="session-card mb-4">
                <div className="card-header-modern">
                  <div className="header-icon">
                    <i className="fas fa-clipboard-list"></i>
                  </div>
                  <h6>Thông tin kỳ thi</h6>
                </div>
                <div className="card-body-modern">
                  <Row>
                    <Col md={6}>
                      <div className="info-item">
                        <div className="info-label">
                          <i className="fas fa-book me-2"></i>
                          Tên kỳ thi:
                        </div>
                        <div className="info-value">
                          <strong>{examResults.attempt.exam_title || 'N/A'}</strong>
                        </div>
                      </div>
                      {examResults.attempt.exam_type && (
                        <div className="info-item">
                          <div className="info-label">
                            <i className="fas fa-tag me-2"></i>
                            Loại:
                          </div>
                          <div className="info-value">{formatExamType(examResults.attempt.exam_type)}</div>
                        </div>
                      )}
                      {examResults.attempt.duration_minutes && (
                        <div className="info-item">
                          <div className="info-label">
                            <i className="fas fa-hourglass-half me-2"></i>
                            Thời gian:
                          </div>
                          <div className="info-value">{examResults.attempt.duration_minutes} phút</div>
                        </div>
                      )}
                      {examResults.answers && examResults.answers.length > 0 && (
                        <div className="info-item">
                          <div className="info-label">
                            <i className="fas fa-list-ol me-2"></i>
                            Số câu hỏi:
                          </div>
                          <div className="info-value">
                            <strong>{examResults.answers.length} câu</strong>
                          </div>
                        </div>
                      )}
                    </Col>
                    <Col md={6}>
                      <div className="info-item">
                        <div className="info-label">
                          <i className="fas fa-clock me-2"></i>
                          Thời gian bắt đầu:
                        </div>
                        <div className="info-value">{formatDateTime(examResults.attempt.start_time)}</div>
                      </div>
                      {examResults.attempt.submit_time && (
                        <div className="info-item">
                          <div className="info-label">
                            <i className="fas fa-check-circle me-2"></i>
                            Thời gian nộp bài:
                          </div>
                          <div className="info-value">{formatDateTime(examResults.attempt.submit_time)}</div>
                        </div>
                      )}
                      {examResults.attempt.available_from && (
                        <div className="info-item">
                          <div className="info-label">
                            <i className="fas fa-calendar-alt me-2"></i>
                            Thời gian mở bài thi:
                          </div>
                          <div className="info-value">{formatDateTime(examResults.attempt.available_from)}</div>
                        </div>
                      )}
                      {examResults.attempt.available_until && (
                        <div className="info-item">
                          <div className="info-label">
                            <i className="fas fa-calendar-times me-2"></i>
                            Thời gian đóng bài thi:
                          </div>
                          <div className="info-value">{formatDateTime(examResults.attempt.available_until)}</div>
                        </div>
                      )}
                    </Col>
                  </Row>
                </div>
              </div>

              {/* Results Summary Card */}
              <div className="session-card mb-4">
                <div className="card-header-modern">
                  <div className="header-icon">
                    <i className="fas fa-chart-line"></i>
                  </div>
                  <h6>Kết quả thi</h6>
                </div>
                <div className="card-body-modern">
                  <Row>
                    <Col md={3} className="mb-3">
                      <div className="statistics-card">
                        <div className="statistics-icon text-warning">
                          <i className="fas fa-star"></i>
                        </div>
                        <div className="statistics-content">
                          <h3>{formatNumber(examResults.attempt.score || 0)}</h3>
                          <p>Điểm đạt được / {formatNumber(examResults.attempt.total_points || 0)} điểm</p>
                        </div>
                      </div>
                    </Col>
                    <Col md={3} className="mb-3">
                      <div className="statistics-card">
                        <div className="statistics-icon text-info">
                          <i className="fas fa-percentage"></i>
                        </div>
                        <div className="statistics-content">
                          <h3>{formatNumber((examResults.attempt.total_points > 0 ? (examResults.attempt.score / examResults.attempt.total_points) * 100 : 0))}%</h3>
                          <p>Tỷ lệ đạt được / {Math.round(examResults.attempt.passing_score || 60)}% yêu cầu</p>
                        </div>
                      </div>
                    </Col>
                    <Col md={3} className="mb-3">
                      <div className="statistics-card">
                        <div className="statistics-icon text-success">
                          <i className="fas fa-flag-checkered"></i>
                        </div>
                        <div className="statistics-content">
                          <h3>{formatNumber((examResults.attempt.total_points * (examResults.attempt.passing_score || 60)) / 100)}</h3>
                          <p>Điểm tối thiểu ({Math.round(examResults.attempt.passing_score || 60)}%)</p>
                        </div>
                      </div>
                    </Col>
                    <Col md={3} className="mb-3">
                      <div className="statistics-card">
                        <div className={`statistics-icon ${(examResults.attempt.total_points > 0 ? (examResults.attempt.score / examResults.attempt.total_points) * 100 : 0) >= (examResults.attempt.passing_score || 60) ? 'text-success' : 'text-danger'}`}>
                          <i className={`fas ${(examResults.attempt.total_points > 0 ? (examResults.attempt.score / examResults.attempt.total_points) * 100 : 0) >= (examResults.attempt.passing_score || 60) ? 'fa-check-circle' : 'fa-times-circle'}`}></i>
                        </div>
                        <div className="statistics-content">
                          <h3>
                            {(examResults.attempt.total_points > 0 ? (examResults.attempt.score / examResults.attempt.total_points) * 100 : 0) >= (examResults.attempt.passing_score || 60) ? (
                              <span className="status-badge active">Đạt</span>
                            ) : (
                              <span className="status-badge cancelled">Không đạt</span>
                            )}
                          </h3>
                          <p>Kết quả</p>
                        </div>
                      </div>
                    </Col>
                  </Row>
                </div>
              </div>

              {/* Questions List */}
              {examResults.answers && examResults.answers.length > 0 ? (
                <div className="session-card mb-4">
                  <div className="card-header-modern">
                    <div className="header-icon">
                      <i className="fas fa-list"></i>
                    </div>
                    <h6>Danh sách câu hỏi đã làm</h6>
                  </div>
                  <div className="card-body-modern">
                    <div className="questions-list-container">
                      {examResults.answers.map((answer, index) => {
                        const answerTimestamp = answer.answer_timestamp || answer.created_at;
                        
                        // Calculate thinking time: from previous question's answer time (or start_time for first question)
                        let questionDisplayTime = null;
                        if (index === 0) {
                          // First question: use attempt start_time
                          questionDisplayTime = examResults.attempt.start_time;
                        } else {
                          // Other questions: use previous question's answer timestamp
                          const previousAnswer = examResults.answers[index - 1];
                          questionDisplayTime = previousAnswer.answer_timestamp || previousAnswer.created_at;
                        }
                        
                        const thinkingTime = questionDisplayTime && answerTimestamp 
                          ? calculateThinkingTime(questionDisplayTime, answerTimestamp)
                          : null;

                        return (
                          <div 
                            key={answer.answer_id || index} 
                            className="question-item"
                            ref={(el) => {
                              if (el) {
                                questionRefs.current[`question-${index}`] = el;
                              }
                            }}
                            data-question-index={index}
                          >
                            {/* Question Header */}
                            <div className="question-header">
                              <div className="question-number">Câu {index + 1}</div>
                              <div className="question-content">
                                <div className="question-text">{answer.question_text || 'N/A'}</div>
                                {(hasLMSQAModPermission() || examResults.show_results_after?.show_question_result) && (
                                  <div className="question-result">
                                    <span className={`result-badge ${answer.is_correct ? 'result-correct' : 'result-incorrect'}`}>
                                      {answer.is_correct ? 'Đúng' : 'Sai'}
                                    </span>
                                    <span className="result-score">
                                      {formatNumber(answer.score || 0)}/{formatNumber(answer.max_points || 0)} điểm
                                    </span>
                                  </div>
                                )}
                                {answer.max_points && (
                                  <div className="question-points">{answer.max_points} điểm</div>
                                )}
                              </div>
                            </div>

                            {/* Question Options */}
                            {answer.options && answer.options.length > 0 && (
                              <div className="question-options-section">
                                <div className="options-list">
                                  {answer.options.map((option, optIndex) => (
                                    <div key={option.option_id || optIndex} className="option-item">
                                      {String.fromCharCode(65 + optIndex)}. {option.option_text || 'N/A'}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Student's Answer */}
                            <div className="student-answer-section">
                              <div className="answer-content-inline">
                                <span className="section-label-inline">Đáp án đã chọn:</span>
                                <span className="answer-value">
                                  {(() => {
                                    let parsedSelectedOptions = answer.selected_options;
                                    if (parsedSelectedOptions && typeof parsedSelectedOptions === 'string') {
                                      try {
                                        parsedSelectedOptions = JSON.parse(parsedSelectedOptions);
                                      } catch (e) {
                                        // Keep as is
                                      }
                                    }

                                    if (parsedSelectedOptions && typeof parsedSelectedOptions === 'object' && !Array.isArray(parsedSelectedOptions)) {
                                      if (parsedSelectedOptions.options) {
                                        parsedSelectedOptions = parsedSelectedOptions.options;
                                      }
                                    }

                                    const hasAnswer = parsedSelectedOptions || (answer.answer_text && answer.answer_text.trim() !== '');
                                    if (!hasAnswer) {
                                      return <span className="answer-empty">Chưa trả lời</span>;
                                    }

                                    if (answer.question_type === 'mcq' || answer.question_type === 'multiple_choice' || answer.question_type === 'multiple_response') {
                                      if (!parsedSelectedOptions || (Array.isArray(parsedSelectedOptions) && parsedSelectedOptions.length === 0)) {
                                        return <span className="answer-empty">Chưa trả lời</span>;
                                      }

                                      const selectedOptionIds = Array.isArray(parsedSelectedOptions)
                                        ? parsedSelectedOptions.map(id => String(id))
                                        : [String(parsedSelectedOptions)];

                                      if (answer.options && answer.options.length > 0) {
                                        const selectedOptions = selectedOptionIds
                                          .map(selectedId => answer.options.find(opt => String(opt.option_id) === selectedId))
                                          .filter(opt => opt !== undefined);

                                        if (selectedOptions.length > 0) {
                                          return (
                                            <>
                                              {selectedOptions.map((opt, idx) => (
                                                <span key={idx} className="answer-option-selected">
                                                  {opt.option_text || 'N/A'}
                                                  {idx < selectedOptions.length - 1 && <span className="answer-separator">, </span>}
                                                </span>
                                              ))}
                                            </>
                                          );
                                        }
                                      }

                                      const displayValue = Array.isArray(parsedSelectedOptions)
                                        ? parsedSelectedOptions.join(', ')
                                        : (parsedSelectedOptions && typeof parsedSelectedOptions !== 'object' ? String(parsedSelectedOptions) : 'Chưa trả lời');
                                      return <span className="answer-option-selected">{displayValue}</span>;
                                    } else if (answer.question_type === 'true_false') {
                                      if (answer.answer_text === 'true') {
                                        return <span className="answer-option-selected">Đúng</span>;
                                      } else if (answer.answer_text === 'false') {
                                        return <span className="answer-option-selected">Sai</span>;
                                      } else {
                                        return <span className="answer-empty">Chưa trả lời</span>;
                                      }
                                    } else {
                                      return <span className="answer-option-selected">{answer.answer_text || 'Chưa trả lời'}</span>;
                                    }
                                  })()}
                                </span>
                              </div>
                            </div>

                            {/* Timestamp and Thinking Time */}
                            {answerTimestamp && (
                              <div className="answer-timestamp">
                                <i className="fas fa-clock"></i>
                                <span>Thời gian chọn: {formatDateTime(answerTimestamp)}</span>
                                {thinkingTime !== null && thinkingTime >= 0 && (
                                  <span className="ms-3">
                                    <i className="fas fa-hourglass-half"></i>
                                    Thời gian suy nghĩ: {formatTime(thinkingTime)}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="session-card mb-4">
                  <div className="card-body-modern">
                    <Alert variant="info" className="mb-0">
                      <i className="fas fa-info-circle me-2"></i>
                      Chưa có câu hỏi nào được trả lời trong bài thi này.
                    </Alert>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Alert variant="warning">Không có dữ liệu kết quả thi</Alert>
          )}
        </Modal.Body>
        <Modal.Footer className="student-detail-footer">
          <Button
            variant="outline-secondary"
            onClick={() => {
              setShowExamResultsModal(false);
              setExamResults(null);
              setSelectedAttempt(null);
            }}
          >
            <i className="fas fa-times me-2"></i>
            Đóng
          </Button>
          {examResults && (
            <>
              <Button
                ref={excelExportButtonRef}
                variant="success"
                onClick={handleExportExcelClick}
              >
                <i className="fas fa-file-excel me-2"></i>
                Xuất Excel
              </Button>
              <Button
                ref={pdfExportButtonRef}
                variant="primary"
                onClick={handleExportPDFClick}
              >
                <i className="fas fa-file-pdf me-2"></i>
                Xuất PDF
              </Button>
            </>
          )}
        </Modal.Footer>
      </Modal>

      {/* PDF Export Options Modal */}
      {showPDFExportOptionsModal && (pdfExportButtonRef.current || selectedAttemptForPDF) && (
        <>
          <div
            style={{
              position: 'fixed',
              top: '-15px',
              left: 0,
              right: '15px',
              bottom: 0,
              zIndex: 1060,
              backgroundColor: 'rgba(0, 0, 0, 0.3)'
            }}
            onClick={() => {
              setShowPDFExportOptionsModal(false);
              setSelectedAttemptForPDF(null);
            }}
          />
          <div
            className="pdf-export-options-popup"
            style={{
              position: 'fixed',
              zIndex: 1070,
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              width: '320px',
              maxHeight: '500px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              top: `${pdfModalPosition.top}px`,
              left: `${pdfModalPosition.left}px`
            }}
          >
            <div style={{ padding: '12px', borderBottom: '1px solid #dee2e6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '14px', fontWeight: 600 }}>Tùy chọn PDF</span>
              <button
                type="button"
                onClick={() => {
              setShowPDFExportOptionsModal(false);
              setSelectedAttemptForPDF(null);
            }}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', padding: '0', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: '12px', overflowY: 'auto', flex: 1 }}>
              <Form>
                {/* Student Info Section */}
                <div style={{ marginBottom: '12px' }}>
                  <Form.Check
                    type="switch"
                    id="showStudentInfo"
                    label={<span style={{ fontSize: '13px' }}>Thông tin sinh viên</span>}
                    checked={pdfExportOptions.showStudentInfo}
                    onChange={(e) => setPdfExportOptions({ ...pdfExportOptions, showStudentInfo: e.target.checked })}
                  />
                </div>

                {/* Exam Info Section */}
                <div style={{ marginBottom: '12px' }}>
                  <Form.Check
                    type="switch"
                    id="showExamInfo"
                    label={<span style={{ fontSize: '13px' }}>Thông tin kỳ thi</span>}
                    checked={pdfExportOptions.showExamInfo}
                    onChange={(e) => setPdfExportOptions({ ...pdfExportOptions, showExamInfo: e.target.checked })}
                  />
                  {pdfExportOptions.showExamInfo && (
                    <div style={{ marginLeft: '20px', marginTop: '8px' }}>
                  <Form.Check
                    type="checkbox"
                    id="examTitle"
                    label={<span style={{ fontSize: '12px' }}>Tên kỳ thi</span>}
                    checked={pdfExportOptions.showExamInfoItems.examTitle}
                    onChange={(e) => setPdfExportOptions({
                      ...pdfExportOptions,
                      showExamInfoItems: {
                        ...pdfExportOptions.showExamInfoItems,
                        examTitle: e.target.checked
                      }
                    })}
                    style={{ marginBottom: '6px' }}
                  />
                  <Form.Check
                    type="checkbox"
                    id="examType"
                    label={<span style={{ fontSize: '12px' }}>Loại</span>}
                    checked={pdfExportOptions.showExamInfoItems.examType}
                    onChange={(e) => setPdfExportOptions({
                      ...pdfExportOptions,
                      showExamInfoItems: {
                        ...pdfExportOptions.showExamInfoItems,
                        examType: e.target.checked
                      }
                    })}
                    style={{ marginBottom: '6px' }}
                  />
                  <Form.Check
                    type="checkbox"
                    id="duration"
                    label={<span style={{ fontSize: '12px' }}>Thời gian</span>}
                    checked={pdfExportOptions.showExamInfoItems.duration}
                    onChange={(e) => setPdfExportOptions({
                      ...pdfExportOptions,
                      showExamInfoItems: {
                        ...pdfExportOptions.showExamInfoItems,
                        duration: e.target.checked
                      }
                    })}
                    style={{ marginBottom: '6px' }}
                  />
                  <Form.Check
                    type="checkbox"
                    id="questionsCount"
                    label={<span style={{ fontSize: '12px' }}>Số câu hỏi</span>}
                    checked={pdfExportOptions.showExamInfoItems.questionsCount}
                    onChange={(e) => setPdfExportOptions({
                      ...pdfExportOptions,
                      showExamInfoItems: {
                        ...pdfExportOptions.showExamInfoItems,
                        questionsCount: e.target.checked
                      }
                    })}
                    style={{ marginBottom: '6px' }}
                  />
                  <Form.Check
                    type="checkbox"
                    id="startTime"
                    label={<span style={{ fontSize: '12px' }}>Thời gian bắt đầu</span>}
                    checked={pdfExportOptions.showExamInfoItems.startTime}
                    onChange={(e) => setPdfExportOptions({
                      ...pdfExportOptions,
                      showExamInfoItems: {
                        ...pdfExportOptions.showExamInfoItems,
                        startTime: e.target.checked
                      }
                    })}
                    style={{ marginBottom: '6px' }}
                  />
                  <Form.Check
                    type="checkbox"
                    id="submitTime"
                    label={<span style={{ fontSize: '12px' }}>Thời gian nộp bài</span>}
                    checked={pdfExportOptions.showExamInfoItems.submitTime}
                    onChange={(e) => setPdfExportOptions({
                      ...pdfExportOptions,
                      showExamInfoItems: {
                        ...pdfExportOptions.showExamInfoItems,
                        submitTime: e.target.checked
                      }
                    })}
                    style={{ marginBottom: '6px' }}
                  />
                  <Form.Check
                    type="checkbox"
                    id="availableFrom"
                    label={<span style={{ fontSize: '12px' }}>Thời gian mở bài thi</span>}
                    checked={pdfExportOptions.showExamInfoItems.availableFrom}
                    onChange={(e) => setPdfExportOptions({
                      ...pdfExportOptions,
                      showExamInfoItems: {
                        ...pdfExportOptions.showExamInfoItems,
                        availableFrom: e.target.checked
                      }
                    })}
                    style={{ marginBottom: '6px' }}
                  />
                  <Form.Check
                    type="checkbox"
                    id="availableUntil"
                    label={<span style={{ fontSize: '12px' }}>Thời gian đóng bài thi</span>}
                    checked={pdfExportOptions.showExamInfoItems.availableUntil}
                    onChange={(e) => setPdfExportOptions({
                      ...pdfExportOptions,
                      showExamInfoItems: {
                        ...pdfExportOptions.showExamInfoItems,
                        availableUntil: e.target.checked
                      }
                    })}
                    style={{ marginBottom: '6px' }}
                  />
                    </div>
                  )}
                </div>

                {/* Results Section */}
                <div style={{ marginBottom: '12px' }}>
                  <Form.Check
                    type="switch"
                    id="showResults"
                    label={<span style={{ fontSize: '13px' }}>Kết quả thi</span>}
                    checked={pdfExportOptions.showResults}
                    onChange={(e) => setPdfExportOptions({ ...pdfExportOptions, showResults: e.target.checked })}
                  />
                </div>

                {/* Questions List Section */}
                <div style={{ marginBottom: '12px' }}>
                  <Form.Check
                    type="switch"
                    id="showQuestionsList"
                    label={<span style={{ fontSize: '13px' }}>Danh sách câu hỏi</span>}
                    checked={pdfExportOptions.showQuestionsList}
                    onChange={(e) => setPdfExportOptions({ ...pdfExportOptions, showQuestionsList: e.target.checked })}
                  />
                  {pdfExportOptions.showQuestionsList && (
                    <div style={{ marginLeft: '20px', marginTop: '8px' }}>
                      <Form.Check
                        type="checkbox"
                        id="questionContent"
                        label={<span style={{ fontSize: '12px' }}>Nội dung câu hỏi</span>}
                    checked={pdfExportOptions.showQuestionItems.questionContent}
                    onChange={(e) => setPdfExportOptions({
                      ...pdfExportOptions,
                      showQuestionItems: {
                        ...pdfExportOptions.showQuestionItems,
                        questionContent: e.target.checked
                      }
                    })}
                    style={{ marginBottom: '6px' }}
                  />
                  <Form.Check
                    type="checkbox"
                    id="questionOptions"
                    label={<span style={{ fontSize: '12px' }}>Các option</span>}
                    checked={pdfExportOptions.showQuestionItems.questionOptions}
                    onChange={(e) => setPdfExportOptions({
                      ...pdfExportOptions,
                      showQuestionItems: {
                        ...pdfExportOptions.showQuestionItems,
                        questionOptions: e.target.checked
                      }
                    })}
                    style={{ marginBottom: '6px' }}
                  />
                  <Form.Check
                    type="checkbox"
                    id="selectedAnswer"
                    label={<span style={{ fontSize: '12px' }}>Đáp án đã chọn</span>}
                    checked={pdfExportOptions.showQuestionItems.selectedAnswer}
                    onChange={(e) => setPdfExportOptions({
                      ...pdfExportOptions,
                      showQuestionItems: {
                        ...pdfExportOptions.showQuestionItems,
                        selectedAnswer: e.target.checked
                      }
                    })}
                    style={{ marginBottom: '6px' }}
                  />
                  <Form.Check
                    type="checkbox"
                    id="answerTime"
                    label={<span style={{ fontSize: '12px' }}>Thời gian chọn</span>}
                    checked={pdfExportOptions.showQuestionItems.answerTime}
                    onChange={(e) => setPdfExportOptions({
                      ...pdfExportOptions,
                      showQuestionItems: {
                        ...pdfExportOptions.showQuestionItems,
                        answerTime: e.target.checked
                      }
                    })}
                    style={{ marginBottom: '6px' }}
                  />
                  <Form.Check
                    type="checkbox"
                    id="thinkingTime"
                    label={<span style={{ fontSize: '12px' }}>Thời gian suy nghĩ</span>}
                    checked={pdfExportOptions.showQuestionItems.thinkingTime}
                    onChange={(e) => setPdfExportOptions({
                      ...pdfExportOptions,
                      showQuestionItems: {
                        ...pdfExportOptions.showQuestionItems,
                        thinkingTime: e.target.checked
                      }
                    })}
                    style={{ marginBottom: '6px' }}
                  />
                  <Form.Check
                    type="checkbox"
                    id="questionResult"
                    label={<span style={{ fontSize: '12px' }}>Kết quả</span>}
                    checked={pdfExportOptions.showQuestionItems.questionResult}
                    onChange={(e) => setPdfExportOptions({
                      ...pdfExportOptions,
                      showQuestionItems: {
                        ...pdfExportOptions.showQuestionItems,
                        questionResult: e.target.checked
                      }
                    })}
                        style={{ marginBottom: '6px' }}
                      />
                    </div>
                  )}
                </div>
              </Form>
            </div>
              <div style={{ padding: '10px 12px', borderTop: '1px solid #dee2e6', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => {
              setShowPDFExportOptionsModal(false);
              setSelectedAttemptForPDF(null);
            }}
                  style={{ fontSize: '12px', padding: '4px 12px' }}
                >
                  Hủy
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handlePDFExportConfirm}
                  disabled={loadingExamResults}
                  style={{ fontSize: '12px', padding: '4px 12px' }}
                >
                  {loadingExamResults ? (
                    <>
                      <Spinner animation="border" size="sm" style={{ marginRight: '6px' }} />
                      Đang xử lý...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-file-pdf" style={{ marginRight: '6px' }}></i>
                      Xuất PDF
                    </>
                  )}
                </Button>
              </div>
            </div>
          </>
      )}

      {/* Bulk PDF Export Options Modal */}
      <Modal
        show={showBulkPDFOptionsModal}
        onHide={() => setShowBulkPDFOptionsModal(false)}
        size="md"
      >
        <Modal.Header closeButton>
          <Modal.Title>Tùy chọn PDF hàng loạt</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <Form>
            {/* Student Info Section */}
            <div style={{ marginBottom: '16px' }}>
              <Form.Check
                type="switch"
                id="bulk-showStudentInfo"
                label={<span style={{ fontSize: '14px', fontWeight: 500 }}>Thông tin sinh viên</span>}
                checked={bulkPDFExportOptions.showStudentInfo}
                onChange={(e) => setBulkPDFExportOptions({ ...bulkPDFExportOptions, showStudentInfo: e.target.checked })}
              />
            </div>

            {/* Exam Info Section */}
            <div style={{ marginBottom: '16px' }}>
              <Form.Check
                type="switch"
                id="bulk-showExamInfo"
                label={<span style={{ fontSize: '14px', fontWeight: 500 }}>Thông tin kỳ thi</span>}
                checked={bulkPDFExportOptions.showExamInfo}
                onChange={(e) => setBulkPDFExportOptions({ ...bulkPDFExportOptions, showExamInfo: e.target.checked })}
              />
              {bulkPDFExportOptions.showExamInfo && (
                <div style={{ marginLeft: '24px', marginTop: '10px' }}>
                  <Form.Check
                    type="checkbox"
                    id="bulk-examTitle"
                    label={<span style={{ fontSize: '13px' }}>Tên kỳ thi</span>}
                    checked={bulkPDFExportOptions.showExamInfoItems.examTitle}
                    onChange={(e) => setBulkPDFExportOptions({
                      ...bulkPDFExportOptions,
                      showExamInfoItems: {
                        ...bulkPDFExportOptions.showExamInfoItems,
                        examTitle: e.target.checked
                      }
                    })}
                    style={{ marginBottom: '8px' }}
                  />
                  <Form.Check
                    type="checkbox"
                    id="bulk-examType"
                    label={<span style={{ fontSize: '13px' }}>Loại</span>}
                    checked={bulkPDFExportOptions.showExamInfoItems.examType}
                    onChange={(e) => setBulkPDFExportOptions({
                      ...bulkPDFExportOptions,
                      showExamInfoItems: {
                        ...bulkPDFExportOptions.showExamInfoItems,
                        examType: e.target.checked
                      }
                    })}
                    style={{ marginBottom: '8px' }}
                  />
                  <Form.Check
                    type="checkbox"
                    id="bulk-duration"
                    label={<span style={{ fontSize: '13px' }}>Thời gian</span>}
                    checked={bulkPDFExportOptions.showExamInfoItems.duration}
                    onChange={(e) => setBulkPDFExportOptions({
                      ...bulkPDFExportOptions,
                      showExamInfoItems: {
                        ...bulkPDFExportOptions.showExamInfoItems,
                        duration: e.target.checked
                      }
                    })}
                    style={{ marginBottom: '8px' }}
                  />
                  <Form.Check
                    type="checkbox"
                    id="bulk-questionsCount"
                    label={<span style={{ fontSize: '13px' }}>Số câu hỏi</span>}
                    checked={bulkPDFExportOptions.showExamInfoItems.questionsCount}
                    onChange={(e) => setBulkPDFExportOptions({
                      ...bulkPDFExportOptions,
                      showExamInfoItems: {
                        ...bulkPDFExportOptions.showExamInfoItems,
                        questionsCount: e.target.checked
                      }
                    })}
                    style={{ marginBottom: '8px' }}
                  />
                  <Form.Check
                    type="checkbox"
                    id="bulk-startTime"
                    label={<span style={{ fontSize: '13px' }}>Thời gian bắt đầu</span>}
                    checked={bulkPDFExportOptions.showExamInfoItems.startTime}
                    onChange={(e) => setBulkPDFExportOptions({
                      ...bulkPDFExportOptions,
                      showExamInfoItems: {
                        ...bulkPDFExportOptions.showExamInfoItems,
                        startTime: e.target.checked
                      }
                    })}
                    style={{ marginBottom: '8px' }}
                  />
                  <Form.Check
                    type="checkbox"
                    id="bulk-submitTime"
                    label={<span style={{ fontSize: '13px' }}>Thời gian nộp bài</span>}
                    checked={bulkPDFExportOptions.showExamInfoItems.submitTime}
                    onChange={(e) => setBulkPDFExportOptions({
                      ...bulkPDFExportOptions,
                      showExamInfoItems: {
                        ...bulkPDFExportOptions.showExamInfoItems,
                        submitTime: e.target.checked
                      }
                    })}
                    style={{ marginBottom: '8px' }}
                  />
                  <Form.Check
                    type="checkbox"
                    id="bulk-availableFrom"
                    label={<span style={{ fontSize: '13px' }}>Thời gian mở bài thi</span>}
                    checked={bulkPDFExportOptions.showExamInfoItems.availableFrom}
                    onChange={(e) => setBulkPDFExportOptions({
                      ...bulkPDFExportOptions,
                      showExamInfoItems: {
                        ...bulkPDFExportOptions.showExamInfoItems,
                        availableFrom: e.target.checked
                      }
                    })}
                    style={{ marginBottom: '8px' }}
                  />
                  <Form.Check
                    type="checkbox"
                    id="bulk-availableUntil"
                    label={<span style={{ fontSize: '13px' }}>Thời gian đóng bài thi</span>}
                    checked={bulkPDFExportOptions.showExamInfoItems.availableUntil}
                    onChange={(e) => setBulkPDFExportOptions({
                      ...bulkPDFExportOptions,
                      showExamInfoItems: {
                        ...bulkPDFExportOptions.showExamInfoItems,
                        availableUntil: e.target.checked
                      }
                    })}
                    style={{ marginBottom: '8px' }}
                  />
                </div>
              )}
            </div>

            {/* Results Section */}
            <div style={{ marginBottom: '16px' }}>
              <Form.Check
                type="switch"
                id="bulk-showResults"
                label={<span style={{ fontSize: '14px', fontWeight: 500 }}>Kết quả thi</span>}
                checked={bulkPDFExportOptions.showResults}
                onChange={(e) => setBulkPDFExportOptions({ ...bulkPDFExportOptions, showResults: e.target.checked })}
              />
            </div>

            {/* Questions List Section */}
            <div style={{ marginBottom: '16px' }}>
              <Form.Check
                type="switch"
                id="bulk-showQuestionsList"
                label={<span style={{ fontSize: '14px', fontWeight: 500 }}>Danh sách câu hỏi</span>}
                checked={bulkPDFExportOptions.showQuestionsList}
                onChange={(e) => setBulkPDFExportOptions({ ...bulkPDFExportOptions, showQuestionsList: e.target.checked })}
              />
              {bulkPDFExportOptions.showQuestionsList && (
                <div style={{ marginLeft: '24px', marginTop: '10px' }}>
                  <Form.Check
                    type="checkbox"
                    id="bulk-questionContent"
                    label={<span style={{ fontSize: '13px' }}>Nội dung câu hỏi</span>}
                    checked={bulkPDFExportOptions.showQuestionItems.questionContent}
                    onChange={(e) => setBulkPDFExportOptions({
                      ...bulkPDFExportOptions,
                      showQuestionItems: {
                        ...bulkPDFExportOptions.showQuestionItems,
                        questionContent: e.target.checked
                      }
                    })}
                    style={{ marginBottom: '8px' }}
                  />
                  <Form.Check
                    type="checkbox"
                    id="bulk-questionOptions"
                    label={<span style={{ fontSize: '13px' }}>Các option</span>}
                    checked={bulkPDFExportOptions.showQuestionItems.questionOptions}
                    onChange={(e) => setBulkPDFExportOptions({
                      ...bulkPDFExportOptions,
                      showQuestionItems: {
                        ...bulkPDFExportOptions.showQuestionItems,
                        questionOptions: e.target.checked
                      }
                    })}
                    style={{ marginBottom: '8px' }}
                  />
                  <Form.Check
                    type="checkbox"
                    id="bulk-selectedAnswer"
                    label={<span style={{ fontSize: '13px' }}>Đáp án đã chọn</span>}
                    checked={bulkPDFExportOptions.showQuestionItems.selectedAnswer}
                    onChange={(e) => setBulkPDFExportOptions({
                      ...bulkPDFExportOptions,
                      showQuestionItems: {
                        ...bulkPDFExportOptions.showQuestionItems,
                        selectedAnswer: e.target.checked
                      }
                    })}
                    style={{ marginBottom: '8px' }}
                  />
                  <Form.Check
                    type="checkbox"
                    id="bulk-answerTime"
                    label={<span style={{ fontSize: '13px' }}>Thời gian chọn</span>}
                    checked={bulkPDFExportOptions.showQuestionItems.answerTime}
                    onChange={(e) => setBulkPDFExportOptions({
                      ...bulkPDFExportOptions,
                      showQuestionItems: {
                        ...bulkPDFExportOptions.showQuestionItems,
                        answerTime: e.target.checked
                      }
                    })}
                    style={{ marginBottom: '8px' }}
                  />
                  <Form.Check
                    type="checkbox"
                    id="bulk-thinkingTime"
                    label={<span style={{ fontSize: '13px' }}>Thời gian suy nghĩ</span>}
                    checked={bulkPDFExportOptions.showQuestionItems.thinkingTime}
                    onChange={(e) => setBulkPDFExportOptions({
                      ...bulkPDFExportOptions,
                      showQuestionItems: {
                        ...bulkPDFExportOptions.showQuestionItems,
                        thinkingTime: e.target.checked
                      }
                    })}
                    style={{ marginBottom: '8px' }}
                  />
                  <Form.Check
                    type="checkbox"
                    id="bulk-questionResult"
                    label={<span style={{ fontSize: '13px' }}>Kết quả</span>}
                    checked={bulkPDFExportOptions.showQuestionItems.questionResult}
                    onChange={(e) => setBulkPDFExportOptions({
                      ...bulkPDFExportOptions,
                      showQuestionItems: {
                        ...bulkPDFExportOptions.showQuestionItems,
                        questionResult: e.target.checked
                      }
                    })}
                    style={{ marginBottom: '8px' }}
                  />
                </div>
              )}
            </div>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowBulkPDFOptionsModal(false)}>
            Hủy
          </Button>
          <Button variant="primary" onClick={handleBulkPDFExportConfirm}>
            <i className="fas fa-file-pdf me-2"></i>
            Xuất PDF hàng loạt
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Bulk PDF Export Progress Modal */}
      <Modal 
        show={showBulkPDFProgressModal} 
        onHide={() => {
          if (bulkPDFProgress.isComplete) {
            setShowBulkPDFProgressModal(false);
            // Reset progress when closing
            setBulkPDFProgress({
              current: 0,
              total: 0,
              currentAttempt: null,
              message: '',
              exported: 0,
              failed: 0,
              errors: [],
              isComplete: false
            });
          }
        }} 
        size="lg" 
        className="student-detail-modal"
        backdrop={bulkPDFProgress.isComplete ? true : 'static'}
        keyboard={bulkPDFProgress.isComplete}
      >
        <Modal.Body className="student-detail-body">
          <div className="student-detail-container">
            <div className="session-card">
              <div className="card-header-modern">
                <div className="header-icon">
                  <i className={`fas ${bulkPDFProgress.isComplete ? 'fa-check-circle text-success' : 'fa-spinner fa-spin'}`}></i>
                </div>
                <h6 className="mb-0">Tiến độ xuất PDF hàng loạt</h6>
              </div>
              <div className="card-body-modern">
                <div className="mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="text-muted">
                      <i className="fas fa-file-pdf me-2"></i>
                      {bulkPDFProgress.message || 'Đang xử lý...'}
                    </span>
                    <Badge bg={bulkPDFProgress.isComplete ? 'success' : 'primary'} className="fs-6">
                      {bulkPDFProgress.current}/{bulkPDFProgress.total}
                    </Badge>
                  </div>
                  {bulkPDFProgress.total > 0 && (
                    <ProgressBar 
                      now={(bulkPDFProgress.current / bulkPDFProgress.total) * 100} 
                      label={`${Math.round((bulkPDFProgress.current / bulkPDFProgress.total) * 100)}%`}
                      variant={bulkPDFProgress.isComplete ? 'success' : 'primary'}
                      animated={!bulkPDFProgress.isComplete}
                      className="mb-2"
                    />
                  )}
                </div>
                
                {bulkPDFProgress.currentAttempt && (
                  <div className="info-item mb-2">
                    <div className="info-label">
                      <i className="fas fa-user me-2"></i>
                      {bulkPDFProgress.isComplete ? 'PDF cuối cùng' : 'Đang xuất PDF cho'}
                    </div>
                    <div className="info-value">
                      <div className="fw-medium">{bulkPDFProgress.currentAttempt.student_name || 'N/A'}</div>
                      <small className="text-muted">{bulkPDFProgress.currentAttempt.student_id || 'N/A'}</small>
                    </div>
                  </div>
                )}
                
                <div className="row mt-3">
                  <div className="col-md-6">
                    <div className="info-item">
                      <div className="info-label">
                        <i className="fas fa-check-circle text-success me-2"></i>
                        Đã xuất thành công
                      </div>
                      <div className="info-value">
                        <Badge bg="success" className="fs-6">
                          {bulkPDFProgress.exported}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="info-item">
                      <div className="info-label">
                        <i className="fas fa-times-circle text-danger me-2"></i>
                        Xuất thất bại
                      </div>
                      <div className="info-value">
                        <Badge bg="danger" className="fs-6">
                          {bulkPDFProgress.failed}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
                
                {bulkPDFProgress.errors && bulkPDFProgress.errors.length > 0 && (
                  <Alert variant="danger" className="mt-3 mb-0">
                    <div className="d-flex align-items-center mb-2">
                      <i className="fas fa-exclamation-triangle me-2"></i>
                      <strong>Lỗi:</strong>
                    </div>
                    <ul className="mb-0" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                      {bulkPDFProgress.errors.slice(0, 10).map((error, index) => (
                        <li key={index}><small>{error}</small></li>
                      ))}
                      {bulkPDFProgress.errors.length > 10 && (
                        <li><small className="text-muted">... và {bulkPDFProgress.errors.length - 10} lỗi khác</small></li>
                      )}
                    </ul>
                  </Alert>
                )}
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer className="student-detail-footer">
          {bulkPDFProgress.isComplete ? (
            <Button 
              variant="primary" 
              onClick={() => {
                setShowBulkPDFProgressModal(false);
                // Reset progress when closing
                setBulkPDFProgress({
                  current: 0,
                  total: 0,
                  currentAttempt: null,
                  message: '',
                  exported: 0,
                  failed: 0,
                  errors: [],
                  isComplete: false
                });
              }}
              className="btn-edit"
            >
              <i className="fas fa-check me-2"></i>
              Đóng
            </Button>
          ) : (
            <div className="text-muted">
              <i className="fas fa-info-circle me-2"></i>
              Đang xử lý, vui lòng đợi...
            </div>
          )}
        </Modal.Footer>
      </Modal>

      {/* Excel Export Options Modal */}
      {showExcelExportOptionsModal && (excelExportButtonRef.current || selectedAttemptForExcel) && (
        <>
          <div
            style={{
              position: 'fixed',
              top: '-15px',
              left: 0,
              right: '15px',
              bottom: 0,
              zIndex: 1060,
              backgroundColor: 'rgba(0, 0, 0, 0.3)'
            }}
            onClick={() => {
              setShowExcelExportOptionsModal(false);
              setSelectedAttemptForExcel(null);
            }}
          />
          <div
            className="pdf-export-options-popup"
            style={{
              position: 'fixed',
              zIndex: 1070,
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              width: '320px',
              maxHeight: '500px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              top: `${excelModalPosition.top}px`,
              left: `${excelModalPosition.left}px`
            }}
          >
            <div style={{ padding: '12px', borderBottom: '1px solid #dee2e6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '14px', fontWeight: 600 }}>Tùy chọn Excel</span>
              <button
                type="button"
                onClick={() => {
                  setShowExcelExportOptionsModal(false);
                  setSelectedAttemptForExcel(null);
                }}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', padding: '0', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ×
              </button>
            </div>
            <div style={{ padding: '12px', overflowY: 'auto', flex: 1 }}>
              <Form>
                {/* Student Info Section */}
                <div style={{ marginBottom: '12px' }}>
                  <Form.Check
                    type="switch"
                    id="excel-showStudentInfo"
                    label={<span style={{ fontSize: '13px' }}>Thông tin sinh viên</span>}
                    checked={excelExportOptions.showStudentInfo}
                    onChange={(e) => setExcelExportOptions({ ...excelExportOptions, showStudentInfo: e.target.checked })}
                  />
                </div>

                {/* Exam Info Section */}
                <div style={{ marginBottom: '12px' }}>
                  <Form.Check
                    type="switch"
                    id="excel-showExamInfo"
                    label={<span style={{ fontSize: '13px' }}>Thông tin kỳ thi</span>}
                    checked={excelExportOptions.showExamInfo}
                    onChange={(e) => setExcelExportOptions({ ...excelExportOptions, showExamInfo: e.target.checked })}
                  />
                  {excelExportOptions.showExamInfo && (
                    <div style={{ marginLeft: '20px', marginTop: '8px' }}>
                      <Form.Check
                        type="checkbox"
                        id="excel-examTitle"
                        label={<span style={{ fontSize: '12px' }}>Tên kỳ thi</span>}
                        checked={excelExportOptions.showExamInfoItems.examTitle}
                        onChange={(e) => setExcelExportOptions({
                          ...excelExportOptions,
                          showExamInfoItems: {
                            ...excelExportOptions.showExamInfoItems,
                            examTitle: e.target.checked
                          }
                        })}
                        style={{ marginBottom: '6px' }}
                      />
                      <Form.Check
                        type="checkbox"
                        id="excel-examType"
                        label={<span style={{ fontSize: '12px' }}>Loại</span>}
                        checked={excelExportOptions.showExamInfoItems.examType}
                        onChange={(e) => setExcelExportOptions({
                          ...excelExportOptions,
                          showExamInfoItems: {
                            ...excelExportOptions.showExamInfoItems,
                            examType: e.target.checked
                          }
                        })}
                        style={{ marginBottom: '6px' }}
                      />
                      <Form.Check
                        type="checkbox"
                        id="excel-duration"
                        label={<span style={{ fontSize: '12px' }}>Thời gian</span>}
                        checked={excelExportOptions.showExamInfoItems.duration}
                        onChange={(e) => setExcelExportOptions({
                          ...excelExportOptions,
                          showExamInfoItems: {
                            ...excelExportOptions.showExamInfoItems,
                            duration: e.target.checked
                          }
                        })}
                        style={{ marginBottom: '6px' }}
                      />
                      <Form.Check
                        type="checkbox"
                        id="excel-questionsCount"
                        label={<span style={{ fontSize: '12px' }}>Số câu hỏi</span>}
                        checked={excelExportOptions.showExamInfoItems.questionsCount}
                        onChange={(e) => setExcelExportOptions({
                          ...excelExportOptions,
                          showExamInfoItems: {
                            ...excelExportOptions.showExamInfoItems,
                            questionsCount: e.target.checked
                          }
                        })}
                        style={{ marginBottom: '6px' }}
                      />
                      <Form.Check
                        type="checkbox"
                        id="excel-startTime"
                        label={<span style={{ fontSize: '12px' }}>Thời gian bắt đầu</span>}
                        checked={excelExportOptions.showExamInfoItems.startTime}
                        onChange={(e) => setExcelExportOptions({
                          ...excelExportOptions,
                          showExamInfoItems: {
                            ...excelExportOptions.showExamInfoItems,
                            startTime: e.target.checked
                          }
                        })}
                        style={{ marginBottom: '6px' }}
                      />
                      <Form.Check
                        type="checkbox"
                        id="excel-submitTime"
                        label={<span style={{ fontSize: '12px' }}>Thời gian nộp bài</span>}
                        checked={excelExportOptions.showExamInfoItems.submitTime}
                        onChange={(e) => setExcelExportOptions({
                          ...excelExportOptions,
                          showExamInfoItems: {
                            ...excelExportOptions.showExamInfoItems,
                            submitTime: e.target.checked
                          }
                        })}
                        style={{ marginBottom: '6px' }}
                      />
                      <Form.Check
                        type="checkbox"
                        id="excel-availableFrom"
                        label={<span style={{ fontSize: '12px' }}>Thời gian mở bài thi</span>}
                        checked={excelExportOptions.showExamInfoItems.availableFrom}
                        onChange={(e) => setExcelExportOptions({
                          ...excelExportOptions,
                          showExamInfoItems: {
                            ...excelExportOptions.showExamInfoItems,
                            availableFrom: e.target.checked
                          }
                        })}
                        style={{ marginBottom: '6px' }}
                      />
                      <Form.Check
                        type="checkbox"
                        id="excel-availableUntil"
                        label={<span style={{ fontSize: '12px' }}>Thời gian đóng bài thi</span>}
                        checked={excelExportOptions.showExamInfoItems.availableUntil}
                        onChange={(e) => setExcelExportOptions({
                          ...excelExportOptions,
                          showExamInfoItems: {
                            ...excelExportOptions.showExamInfoItems,
                            availableUntil: e.target.checked
                          }
                        })}
                        style={{ marginBottom: '6px' }}
                      />
                    </div>
                  )}
                </div>

                {/* Results Section */}
                <div style={{ marginBottom: '12px' }}>
                  <Form.Check
                    type="switch"
                    id="excel-showResults"
                    label={<span style={{ fontSize: '13px' }}>Kết quả thi</span>}
                    checked={excelExportOptions.showResults}
                    onChange={(e) => setExcelExportOptions({ ...excelExportOptions, showResults: e.target.checked })}
                  />
                </div>

                {/* Questions List Section */}
                <div style={{ marginBottom: '12px' }}>
                  <Form.Check
                    type="switch"
                    id="excel-showQuestionsList"
                    label={<span style={{ fontSize: '13px' }}>Danh sách câu hỏi</span>}
                    checked={excelExportOptions.showQuestionsList}
                    onChange={(e) => setExcelExportOptions({ ...excelExportOptions, showQuestionsList: e.target.checked })}
                  />
                  {excelExportOptions.showQuestionsList && (
                    <div style={{ marginLeft: '20px', marginTop: '8px' }}>
                      <Form.Check
                        type="checkbox"
                        id="excel-questionContent"
                        label={<span style={{ fontSize: '12px' }}>Nội dung câu hỏi</span>}
                        checked={excelExportOptions.showQuestionItems.questionContent}
                        onChange={(e) => setExcelExportOptions({
                          ...excelExportOptions,
                          showQuestionItems: {
                            ...excelExportOptions.showQuestionItems,
                            questionContent: e.target.checked
                          }
                        })}
                        style={{ marginBottom: '6px' }}
                      />
                      <Form.Check
                        type="checkbox"
                        id="excel-questionOptions"
                        label={<span style={{ fontSize: '12px' }}>Các option</span>}
                        checked={excelExportOptions.showQuestionItems.questionOptions}
                        onChange={(e) => setExcelExportOptions({
                          ...excelExportOptions,
                          showQuestionItems: {
                            ...excelExportOptions.showQuestionItems,
                            questionOptions: e.target.checked
                          }
                        })}
                        style={{ marginBottom: '6px' }}
                      />
                      <Form.Check
                        type="checkbox"
                        id="excel-selectedAnswer"
                        label={<span style={{ fontSize: '12px' }}>Đáp án đã chọn</span>}
                        checked={excelExportOptions.showQuestionItems.selectedAnswer}
                        onChange={(e) => setExcelExportOptions({
                          ...excelExportOptions,
                          showQuestionItems: {
                            ...excelExportOptions.showQuestionItems,
                            selectedAnswer: e.target.checked
                          }
                        })}
                        style={{ marginBottom: '6px' }}
                      />
                      <Form.Check
                        type="checkbox"
                        id="excel-answerTime"
                        label={<span style={{ fontSize: '12px' }}>Thời gian chọn</span>}
                        checked={excelExportOptions.showQuestionItems.answerTime}
                        onChange={(e) => setExcelExportOptions({
                          ...excelExportOptions,
                          showQuestionItems: {
                            ...excelExportOptions.showQuestionItems,
                            answerTime: e.target.checked
                          }
                        })}
                        style={{ marginBottom: '6px' }}
                      />
                      <Form.Check
                        type="checkbox"
                        id="excel-thinkingTime"
                        label={<span style={{ fontSize: '12px' }}>Thời gian suy nghĩ</span>}
                        checked={excelExportOptions.showQuestionItems.thinkingTime}
                        onChange={(e) => setExcelExportOptions({
                          ...excelExportOptions,
                          showQuestionItems: {
                            ...excelExportOptions.showQuestionItems,
                            thinkingTime: e.target.checked
                          }
                        })}
                        style={{ marginBottom: '6px' }}
                      />
                      <Form.Check
                        type="checkbox"
                        id="excel-questionResult"
                        label={<span style={{ fontSize: '12px' }}>Kết quả</span>}
                        checked={excelExportOptions.showQuestionItems.questionResult}
                        onChange={(e) => setExcelExportOptions({
                          ...excelExportOptions,
                          showQuestionItems: {
                            ...excelExportOptions.showQuestionItems,
                            questionResult: e.target.checked
                          }
                        })}
                        style={{ marginBottom: '6px' }}
                      />
                    </div>
                  )}
                </div>
              </Form>
            </div>
            <div style={{ padding: '10px 12px', borderTop: '1px solid #dee2e6', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => {
                  setShowExcelExportOptionsModal(false);
                  setSelectedAttemptForExcel(null);
                }}
                style={{ fontSize: '12px', padding: '4px 12px' }}
              >
                Hủy
              </Button>
              <Button
                variant="success"
                size="sm"
                onClick={handleExcelExportConfirm}
                disabled={loadingExamResults}
                style={{ fontSize: '12px', padding: '4px 12px' }}
              >
                {loadingExamResults ? (
                  <>
                    <Spinner animation="border" size="sm" style={{ marginRight: '6px' }} />
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    <i className="fas fa-file-excel" style={{ marginRight: '6px' }}></i>
                    Xuất Excel
                  </>
                )}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Bulk Excel Export Options Modal */}
      <Modal
        show={showBulkExcelOptionsModal}
        onHide={() => setShowBulkExcelOptionsModal(false)}
        size="md"
      >
        <Modal.Header closeButton>
          <Modal.Title>Tùy chọn Excel hàng loạt</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <Form>
            {/* Student Info Section */}
            <div style={{ marginBottom: '16px' }}>
              <Form.Check
                type="switch"
                id="bulk-excel-showStudentInfo"
                label={<span style={{ fontSize: '14px', fontWeight: 500 }}>Thông tin sinh viên</span>}
                checked={bulkExcelExportOptions.showStudentInfo}
                onChange={(e) => setBulkExcelExportOptions({ ...bulkExcelExportOptions, showStudentInfo: e.target.checked })}
              />
            </div>

            {/* Exam Info Section */}
            <div style={{ marginBottom: '16px' }}>
              <Form.Check
                type="switch"
                id="bulk-excel-showExamInfo"
                label={<span style={{ fontSize: '14px', fontWeight: 500 }}>Thông tin kỳ thi</span>}
                checked={bulkExcelExportOptions.showExamInfo}
                onChange={(e) => setBulkExcelExportOptions({ ...bulkExcelExportOptions, showExamInfo: e.target.checked })}
              />
              {bulkExcelExportOptions.showExamInfo && (
                <div style={{ marginLeft: '24px', marginTop: '10px' }}>
                  <Form.Check
                    type="checkbox"
                    id="bulk-excel-examTitle"
                    label={<span style={{ fontSize: '13px' }}>Tên kỳ thi</span>}
                    checked={bulkExcelExportOptions.showExamInfoItems.examTitle}
                    onChange={(e) => setBulkExcelExportOptions({
                      ...bulkExcelExportOptions,
                      showExamInfoItems: {
                        ...bulkExcelExportOptions.showExamInfoItems,
                        examTitle: e.target.checked
                      }
                    })}
                    style={{ marginBottom: '8px' }}
                  />
                  <Form.Check
                    type="checkbox"
                    id="bulk-excel-examType"
                    label={<span style={{ fontSize: '13px' }}>Loại</span>}
                    checked={bulkExcelExportOptions.showExamInfoItems.examType}
                    onChange={(e) => setBulkExcelExportOptions({
                      ...bulkExcelExportOptions,
                      showExamInfoItems: {
                        ...bulkExcelExportOptions.showExamInfoItems,
                        examType: e.target.checked
                      }
                    })}
                    style={{ marginBottom: '8px' }}
                  />
                  <Form.Check
                    type="checkbox"
                    id="bulk-excel-duration"
                    label={<span style={{ fontSize: '13px' }}>Thời gian</span>}
                    checked={bulkExcelExportOptions.showExamInfoItems.duration}
                    onChange={(e) => setBulkExcelExportOptions({
                      ...bulkExcelExportOptions,
                      showExamInfoItems: {
                        ...bulkExcelExportOptions.showExamInfoItems,
                        duration: e.target.checked
                      }
                    })}
                    style={{ marginBottom: '8px' }}
                  />
                  <Form.Check
                    type="checkbox"
                    id="bulk-excel-questionsCount"
                    label={<span style={{ fontSize: '13px' }}>Số câu hỏi</span>}
                    checked={bulkExcelExportOptions.showExamInfoItems.questionsCount}
                    onChange={(e) => setBulkExcelExportOptions({
                      ...bulkExcelExportOptions,
                      showExamInfoItems: {
                        ...bulkExcelExportOptions.showExamInfoItems,
                        questionsCount: e.target.checked
                      }
                    })}
                    style={{ marginBottom: '8px' }}
                  />
                  <Form.Check
                    type="checkbox"
                    id="bulk-excel-startTime"
                    label={<span style={{ fontSize: '13px' }}>Thời gian bắt đầu</span>}
                    checked={bulkExcelExportOptions.showExamInfoItems.startTime}
                    onChange={(e) => setBulkExcelExportOptions({
                      ...bulkExcelExportOptions,
                      showExamInfoItems: {
                        ...bulkExcelExportOptions.showExamInfoItems,
                        startTime: e.target.checked
                      }
                    })}
                    style={{ marginBottom: '8px' }}
                  />
                  <Form.Check
                    type="checkbox"
                    id="bulk-excel-submitTime"
                    label={<span style={{ fontSize: '13px' }}>Thời gian nộp bài</span>}
                    checked={bulkExcelExportOptions.showExamInfoItems.submitTime}
                    onChange={(e) => setBulkExcelExportOptions({
                      ...bulkExcelExportOptions,
                      showExamInfoItems: {
                        ...bulkExcelExportOptions.showExamInfoItems,
                        submitTime: e.target.checked
                      }
                    })}
                    style={{ marginBottom: '8px' }}
                  />
                  <Form.Check
                    type="checkbox"
                    id="bulk-excel-availableFrom"
                    label={<span style={{ fontSize: '13px' }}>Thời gian mở bài thi</span>}
                    checked={bulkExcelExportOptions.showExamInfoItems.availableFrom}
                    onChange={(e) => setBulkExcelExportOptions({
                      ...bulkExcelExportOptions,
                      showExamInfoItems: {
                        ...bulkExcelExportOptions.showExamInfoItems,
                        availableFrom: e.target.checked
                      }
                    })}
                    style={{ marginBottom: '8px' }}
                  />
                  <Form.Check
                    type="checkbox"
                    id="bulk-excel-availableUntil"
                    label={<span style={{ fontSize: '13px' }}>Thời gian đóng bài thi</span>}
                    checked={bulkExcelExportOptions.showExamInfoItems.availableUntil}
                    onChange={(e) => setBulkExcelExportOptions({
                      ...bulkExcelExportOptions,
                      showExamInfoItems: {
                        ...bulkExcelExportOptions.showExamInfoItems,
                        availableUntil: e.target.checked
                      }
                    })}
                    style={{ marginBottom: '8px' }}
                  />
                </div>
              )}
            </div>

            {/* Results Section */}
            <div style={{ marginBottom: '16px' }}>
              <Form.Check
                type="switch"
                id="bulk-excel-showResults"
                label={<span style={{ fontSize: '14px', fontWeight: 500 }}>Kết quả thi</span>}
                checked={bulkExcelExportOptions.showResults}
                onChange={(e) => setBulkExcelExportOptions({ ...bulkExcelExportOptions, showResults: e.target.checked })}
              />
            </div>

            {/* Questions List Section */}
            <div style={{ marginBottom: '16px' }}>
              <Form.Check
                type="switch"
                id="bulk-excel-showQuestionsList"
                label={<span style={{ fontSize: '14px', fontWeight: 500 }}>Danh sách câu hỏi</span>}
                checked={bulkExcelExportOptions.showQuestionsList}
                onChange={(e) => setBulkExcelExportOptions({ ...bulkExcelExportOptions, showQuestionsList: e.target.checked })}
              />
              {bulkExcelExportOptions.showQuestionsList && (
                <div style={{ marginLeft: '24px', marginTop: '10px' }}>
                  <Form.Check
                    type="checkbox"
                    id="bulk-excel-questionContent"
                    label={<span style={{ fontSize: '13px' }}>Nội dung câu hỏi</span>}
                    checked={bulkExcelExportOptions.showQuestionItems.questionContent}
                    onChange={(e) => setBulkExcelExportOptions({
                      ...bulkExcelExportOptions,
                      showQuestionItems: {
                        ...bulkExcelExportOptions.showQuestionItems,
                        questionContent: e.target.checked
                      }
                    })}
                    style={{ marginBottom: '8px' }}
                  />
                  <Form.Check
                    type="checkbox"
                    id="bulk-excel-questionOptions"
                    label={<span style={{ fontSize: '13px' }}>Các option</span>}
                    checked={bulkExcelExportOptions.showQuestionItems.questionOptions}
                    onChange={(e) => setBulkExcelExportOptions({
                      ...bulkExcelExportOptions,
                      showQuestionItems: {
                        ...bulkExcelExportOptions.showQuestionItems,
                        questionOptions: e.target.checked
                      }
                    })}
                    style={{ marginBottom: '8px' }}
                  />
                  <Form.Check
                    type="checkbox"
                    id="bulk-excel-selectedAnswer"
                    label={<span style={{ fontSize: '13px' }}>Đáp án đã chọn</span>}
                    checked={bulkExcelExportOptions.showQuestionItems.selectedAnswer}
                    onChange={(e) => setBulkExcelExportOptions({
                      ...bulkExcelExportOptions,
                      showQuestionItems: {
                        ...bulkExcelExportOptions.showQuestionItems,
                        selectedAnswer: e.target.checked
                      }
                    })}
                    style={{ marginBottom: '8px' }}
                  />
                  <Form.Check
                    type="checkbox"
                    id="bulk-excel-answerTime"
                    label={<span style={{ fontSize: '13px' }}>Thời gian chọn</span>}
                    checked={bulkExcelExportOptions.showQuestionItems.answerTime}
                    onChange={(e) => setBulkExcelExportOptions({
                      ...bulkExcelExportOptions,
                      showQuestionItems: {
                        ...bulkExcelExportOptions.showQuestionItems,
                        answerTime: e.target.checked
                      }
                    })}
                    style={{ marginBottom: '8px' }}
                  />
                  <Form.Check
                    type="checkbox"
                    id="bulk-excel-thinkingTime"
                    label={<span style={{ fontSize: '13px' }}>Thời gian suy nghĩ</span>}
                    checked={bulkExcelExportOptions.showQuestionItems.thinkingTime}
                    onChange={(e) => setBulkExcelExportOptions({
                      ...bulkExcelExportOptions,
                      showQuestionItems: {
                        ...bulkExcelExportOptions.showQuestionItems,
                        thinkingTime: e.target.checked
                      }
                    })}
                    style={{ marginBottom: '8px' }}
                  />
                  <Form.Check
                    type="checkbox"
                    id="bulk-excel-questionResult"
                    label={<span style={{ fontSize: '13px' }}>Kết quả</span>}
                    checked={bulkExcelExportOptions.showQuestionItems.questionResult}
                    onChange={(e) => setBulkExcelExportOptions({
                      ...bulkExcelExportOptions,
                      showQuestionItems: {
                        ...bulkExcelExportOptions.showQuestionItems,
                        questionResult: e.target.checked
                      }
                    })}
                    style={{ marginBottom: '8px' }}
                  />
                </div>
              )}
            </div>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowBulkExcelOptionsModal(false)}>
            Hủy
          </Button>
          <Button variant="success" onClick={handleBulkExcelExportConfirm}>
            <i className="fas fa-file-excel me-2"></i>
            Xuất Excel hàng loạt
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Bulk Excel Progress Modal */}
      <Modal
        show={showBulkExcelProgressModal}
        onHide={() => {
          if (bulkExcelProgress.isComplete) {
            setShowBulkExcelProgressModal(false);
            // Reset progress when closing
            setBulkExcelProgress({
              current: 0,
              total: 0,
              currentAttempt: null,
              message: '',
              exported: 0,
              failed: 0,
              errors: [],
              isComplete: false
            });
          }
        }} 
        size="lg" 
        className="student-detail-modal"
        backdrop={bulkExcelProgress.isComplete ? true : 'static'}
        keyboard={bulkExcelProgress.isComplete}
      >
        <Modal.Body className="student-detail-body">
          <div className="student-detail-container">
            <div className="session-card">
              <div className="card-header-modern">
                <div className="header-icon">
                  <i className={`fas ${bulkExcelProgress.isComplete ? 'fa-check-circle text-success' : 'fa-spinner fa-spin'}`}></i>
                </div>
                <h6 className="mb-0">Tiến độ xuất Excel hàng loạt</h6>
              </div>
              <div className="card-body-modern">
                <div className="mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="text-muted">
                      <i className="fas fa-file-excel me-2"></i>
                      {bulkExcelProgress.message || 'Đang xử lý...'}
                    </span>
                    <Badge bg={bulkExcelProgress.isComplete ? 'success' : 'success'} className="fs-6">
                      {bulkExcelProgress.current}/{bulkExcelProgress.total}
                    </Badge>
                  </div>
                  {bulkExcelProgress.total > 0 && (
                    <ProgressBar 
                      now={(bulkExcelProgress.current / bulkExcelProgress.total) * 100} 
                      label={`${Math.round((bulkExcelProgress.current / bulkExcelProgress.total) * 100)}%`}
                      variant={bulkExcelProgress.isComplete ? 'success' : 'success'}
                      animated={!bulkExcelProgress.isComplete}
                      className="mb-2"
                    />
                  )}
                </div>
                
                {bulkExcelProgress.currentAttempt && (
                  <div className="info-item mb-2">
                    <div className="info-label">
                      <i className="fas fa-user me-2"></i>
                      {bulkExcelProgress.isComplete ? 'Excel cuối cùng' : 'Đang xuất Excel cho'}
                    </div>
                    <div className="info-value">
                      <div className="fw-medium">{bulkExcelProgress.currentAttempt.student_name || 'N/A'}</div>
                      <small className="text-muted">{bulkExcelProgress.currentAttempt.student_id || 'N/A'}</small>
                    </div>
                  </div>
                )}
                
                <div className="row mt-3">
                  <div className="col-md-6">
                    <div className="info-item">
                      <div className="info-label">
                        <i className="fas fa-check-circle text-success me-2"></i>
                        Đã xuất thành công
                      </div>
                      <div className="info-value">
                        <Badge bg="success" className="fs-6">
                          {bulkExcelProgress.exported}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="info-item">
                      <div className="info-label">
                        <i className="fas fa-times-circle text-danger me-2"></i>
                        Xuất thất bại
                      </div>
                      <div className="info-value">
                        <Badge bg="danger" className="fs-6">
                          {bulkExcelProgress.failed}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
                
                {bulkExcelProgress.errors && bulkExcelProgress.errors.length > 0 && (
                  <Alert variant="danger" className="mt-3 mb-0">
                    <div className="d-flex align-items-center mb-2">
                      <i className="fas fa-exclamation-triangle me-2"></i>
                      <strong>Lỗi:</strong>
                    </div>
                    <ul className="mb-0" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                      {bulkExcelProgress.errors.slice(0, 10).map((error, index) => (
                        <li key={index}><small>{error}</small></li>
                      ))}
                      {bulkExcelProgress.errors.length > 10 && (
                        <li><small className="text-muted">... và {bulkExcelProgress.errors.length - 10} lỗi khác</small></li>
                      )}
                    </ul>
                  </Alert>
                )}
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer className="student-detail-footer">
          {bulkExcelProgress.isComplete ? (
            <Button 
              variant="success" 
              onClick={() => {
                setShowBulkExcelProgressModal(false);
                // Reset progress when closing
                setBulkExcelProgress({
                  current: 0,
                  total: 0,
                  currentAttempt: null,
                  message: '',
                  exported: 0,
                  failed: 0,
                  errors: [],
                  isComplete: false
                });
              }}
              className="btn-edit"
            >
              <i className="fas fa-check me-2"></i>
              Đóng
            </Button>
          ) : (
            <div className="text-muted">
              <i className="fas fa-info-circle me-2"></i>
              Đang xử lý, vui lòng đợi...
            </div>
          )}
        </Modal.Footer>
      </Modal>

      {/* Export Gradebook Modal */}
      <Modal
        show={showExportGradebookModal}
        onHide={() => setShowExportGradebookModal(false)}
        size="lg"
        className="student-detail-modal"
      >
        <Modal.Header closeButton className="student-detail-header">
          <Modal.Title className="student-detail-title">
            <div className="student-avatar">
              <i className="fas fa-file-export"></i>
            </div>
            <div>
              <h4 className="mb-0">Xuất bảng điểm</h4>
              <p className="mb-0 student-subtitle">Chọn các tùy chọn để xuất bảng điểm</p>
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="student-detail-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <Form>
            <Row>
              {/* Left Column */}
              <Col md={6}>
                {/* Format Selection */}
                <Form.Group className="mb-3">
                  <Form.Label>
                    <i className="fas fa-file me-2"></i>
                    Định dạng file
                  </Form.Label>
                  <Form.Select
                    value={exportGradebookOptions.format}
                    onChange={(e) => setExportGradebookOptions({ ...exportGradebookOptions, format: e.target.value })}
                  >
                    <option value="excel">Excel (.xlsx)</option>
                    <option value="pdf">PDF (.pdf)</option>
                    <option value="word">Word (.doc)</option>
                  </Form.Select>
                </Form.Group>

                {/* Date Type Selection */}
                <Form.Group className="mb-3">
                  <Form.Label>
                    <i className="fas fa-calendar-alt me-2"></i>
                    Loại ngày
                  </Form.Label>
                  <Form.Select
                    value={exportGradebookOptions.dateType}
                    onChange={(e) => setExportGradebookOptions({ ...exportGradebookOptions, dateType: e.target.value })}
                  >
                    <option value="range">Từ ngày đến ngày</option>
                    <option value="specific">Ngày cụ thể</option>
                  </Form.Select>
                </Form.Group>

                {/* Date Filters */}
                {exportGradebookOptions.dateType === 'specific' ? (
                  <Form.Group className="mb-3">
                    <Form.Label>Ngày cụ thể</Form.Label>
                    <Form.Control
                      type="date"
                      value={exportGradebookOptions.dateSpecific}
                      onChange={(e) => setExportGradebookOptions({ ...exportGradebookOptions, dateSpecific: e.target.value })}
                    />
                  </Form.Group>
                ) : (
                  <>
                    <Form.Group className="mb-3">
                      <Form.Label>Từ ngày</Form.Label>
                      <Form.Control
                        type="date"
                        value={exportGradebookOptions.dateFrom}
                        onChange={(e) => setExportGradebookOptions({ ...exportGradebookOptions, dateFrom: e.target.value })}
                      />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label>Đến ngày</Form.Label>
                      <Form.Control
                        type="date"
                        value={exportGradebookOptions.dateTo}
                        onChange={(e) => setExportGradebookOptions({ ...exportGradebookOptions, dateTo: e.target.value })}
                      />
                    </Form.Group>
                  </>
                )}
              </Col>

              {/* Right Column */}
              <Col md={6}>
                {/* Class Filter */}
                <Form.Group className="mb-3">
                  <Form.Label>
                    <i className="fas fa-users me-2"></i>
                    Lớp
                  </Form.Label>
                  <Form.Select
                    value={exportGradebookOptions.class_name}
                    onChange={(e) => setExportGradebookOptions({ ...exportGradebookOptions, class_name: e.target.value })}
                  >
                    <option value="">Tất cả lớp</option>
                    {Array.isArray(gradebookClasses) && gradebookClasses.map((cls, index) => (
                      <option key={cls.id || index} value={cls.name}>
                        {cls.name}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>

                {/* User Filter */}
                <Form.Group className="mb-3">
                  <Form.Label>
                    <i className="fas fa-user me-2"></i>
                    Học viên
                  </Form.Label>
                  <Form.Select
                    value={exportGradebookOptions.user_id}
                    onChange={(e) => setExportGradebookOptions({ ...exportGradebookOptions, user_id: e.target.value })}
                  >
                    <option value="">Tất cả học viên</option>
                    {Array.isArray(gradebookUsers) && gradebookUsers.map((user) => (
                      <option key={user.user_id} value={user.user_id}>
                        {user.student_name} {user.student_code ? `(${user.student_code})` : ''}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>

                {/* Exam Filter */}
                <Form.Group className="mb-3">
                  <Form.Label>
                    <i className="fas fa-clipboard-list me-2"></i>
                    Kỳ thi
                  </Form.Label>
                  <Form.Select
                    value={exportGradebookOptions.exam_id}
                    onChange={(e) => setExportGradebookOptions({ ...exportGradebookOptions, exam_id: e.target.value })}
                  >
                    <option value="">Tất cả kỳ thi</option>
                    {Array.isArray(gradebookExams) && gradebookExams.map((exam) => (
                      <option key={exam.exam_id} value={exam.exam_id}>
                        {exam.exam_title}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
          </Form>
        </Modal.Body>
        <Modal.Footer className="student-detail-footer">
          <Button 
            variant="outline-secondary" 
            onClick={() => setShowExportGradebookModal(false)}
          >
            <i className="fas fa-times me-2"></i>
            Hủy
          </Button>
          <Button 
            variant="primary" 
            onClick={handleExportGradebook} 
            disabled={loading}
            className="btn-edit"
          >
            {loading ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Đang xuất...
              </>
            ) : (
              <>
                <i className="fas fa-file-export me-2"></i>
                Xuất bảng điểm
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Grades;
