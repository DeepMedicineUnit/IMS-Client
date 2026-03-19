import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Form, Alert, Badge, Table, ProgressBar, Tabs, Tab, Spinner } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import api from '../../utils/api';
import Pagination from '../../components/Pagination';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';
import { useTranslation } from 'react-i18next';

const StudentGrades = () => {
  const { t } = useTranslation();
  usePageTitle(t('studentGrades.title'));
  const { currentUser } = useAuth();
  const [grades, setGrades] = useState([]);
  const [gradeAppeals, setGradeAppeals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('grades');
  
  // Modals
  const [showAppealModal, setShowAppealModal] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState(null);
  const [appealForm, setAppealForm] = useState({
    grade_id: '',
    reason: ''
  });
  const { showAlert } = useAlert();

  // Exam Regulation states
  const [showRegulationModal, setShowRegulationModal] = useState(false);
  const [examRegulation, setExamRegulation] = useState(null);
  const [readingStartTime, setReadingStartTime] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [canConfirm, setCanConfirm] = useState(false);
  const readingIntervalRef = useRef(null);

  // Filters
  const [filters, setFilters] = useState({
    course_id: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    totalItems: 0,
    totalPages: 0
  });
  const [appealsPagination, setAppealsPagination] = useState({
    page: 1,
    limit: 10,
    totalItems: 0,
    totalPages: 0
  });

  const currentDataRef = useRef({ grades: null, appeals: null });

  // Initial fetch
  useEffect(() => {
    if (activeTab === 'grades') {
      fetchGrades();
    } else if (activeTab === 'appeals') {
      fetchGradeAppeals();
    }
  }, [activeTab, filters]);

  // Check exam regulation on component mount
  useEffect(() => {
    checkExamRegulation();
  }, []);

  // Background polling for grades - only update if data changed
  useEffect(() => {
    if (activeTab !== 'grades') return;
    
    let pollInterval;
    let isMounted = true;
    let currentPolling = false;
    
    const pollGrades = async () => {
      if (currentPolling || !isMounted) return;
      
      try {
        currentPolling = true;
        const params = new URLSearchParams();
        if (filters.course_id) params.append('course_id', filters.course_id);

        const response = await api.get(`/lms/grades/my?${params.toString()}`);
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
          return currentGrades;
        });
      } catch (error) {
        console.debug('Background polling error (silent):', error);
      } finally {
        currentPolling = false;
      }
    };
    
    const initialDelay = setTimeout(() => {
      if (isMounted) {
        pollInterval = setInterval(pollGrades, 10000); // Poll every 10 seconds
      }
    }, 5000);
    
    return () => {
      isMounted = false;
      clearTimeout(initialDelay);
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [activeTab, filters.course_id]);

  // Background polling for grade appeals
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
        
        setGradeAppeals(currentAppeals => {
          if (hasGradeAppealsDataChanged(currentAppeals, newAppeals)) {
            return newAppeals;
          }
          return currentAppeals;
        });
      } catch (error) {
        console.debug('Background polling error (silent):', error);
      } finally {
        currentPolling = false;
      }
    };
    
    const initialDelay = setTimeout(() => {
      if (isMounted) {
        pollInterval = setInterval(pollGradeAppeals, 10000);
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
      const params = new URLSearchParams();
      if (filters.course_id) params.append('course_id', filters.course_id);

      const response = await api.get(`/lms/grades/my?${params.toString()}`);
      
      const gradesData = response.data?.data;
      if (Array.isArray(gradesData)) {
        setGrades(gradesData);
        setPagination(prev => ({
          ...prev,
          totalItems: gradesData.length,
          totalPages: Math.ceil(gradesData.length / prev.limit)
        }));
      } else {
        setGrades([]);
        setPagination(prev => ({ ...prev, totalItems: 0, totalPages: 0 }));
      }
    } catch (error) {
      console.error('Error fetching grades:', error);
      showAlertMessage(t('studentGrades.errors.loadGrades'), 'danger');
      setGrades([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchGradeAppeals = async () => {
    try {
      setLoading(true);
      const response = await api.get('/lms/grade-appeals');
      
      const appealsData = response.data?.data;
      let myAppeals = [];
      if (Array.isArray(appealsData)) {
        myAppeals = appealsData.filter(appeal => appeal.user_id === currentUser?.id);
      } else if (appealsData && Array.isArray(appealsData.appeals)) {
        myAppeals = appealsData.appeals.filter(appeal => appeal.user_id === currentUser?.id);
      }
      
      setGradeAppeals(myAppeals);
      setAppealsPagination(prev => ({
        ...prev,
        totalItems: myAppeals.length,
        totalPages: Math.ceil(myAppeals.length / prev.limit)
      }));
    } catch (error) {
      console.error('Error fetching grade appeals:', error);
      showAlertMessage(t('studentGrades.errors.loadAppeals'), 'danger');
      setGradeAppeals([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAppeal = (grade) => {
    setSelectedGrade(grade);
    setAppealForm({
      grade_id: grade.grade_id || `exam-${grade.exam_id}`,
      reason: ''
    });
    setShowAppealModal(true);
  };

  const handleSubmitAppeal = async (e) => {
    e.preventDefault();

    try {
      await api.post('/lms/grade-appeals', appealForm);

      showAlertMessage(t('studentGrades.success.appealSubmitted'), 'success');
      setShowAppealModal(false);
      fetchGradeAppeals();
    } catch (error) {
      console.error('Error creating appeal:', error);
      showAlertMessage(error.response?.data?.message || t('studentGrades.errors.submitAppeal'), 'danger');
    }
  };

  // Check exam regulation on component load
  // Note: If require_read_each_time is true, skip checking here because it will be checked when clicking "Làm bài" button
  const checkExamRegulation = async () => {
    try {
      const response = await api.get('/lms/exam-regulation');
      if (response.data.success && response.data.data) {
        const regulation = response.data.data;
        setExamRegulation(regulation);
        
        // If require_read_each_time is true, skip checking here
        // The regulation will be checked when student clicks "Làm bài" button in StudentExams page
        const requireReadEachTime = regulation.require_read_each_time === 1 || regulation.require_read_each_time === true;
        if (requireReadEachTime) {
          // Don't show modal here, it will be checked when clicking "Làm bài"
          return;
        }
        
        // Only check if require_read_each_time is false (read once only)
        // Check confirmation status
        const confirmationResponse = await api.get('/lms/exam-regulation/confirmation');
        if (confirmationResponse.data.success) {
          const confirmationData = confirmationResponse.data.data;
          
          if (confirmationData.hasActiveRegulation && !confirmationData.isConfirmed) {
            // Get reading start time - prioritize server time, fallback to localStorage
            let startTime = null;
            
            if (confirmationData.readingStartTime) {
              // Use server time (most accurate)
              startTime = new Date(confirmationData.readingStartTime);
              localStorage.setItem(`regulation_reading_start_${regulation.regulation_id}`, confirmationData.readingStartTime);
            } else {
              // Check localStorage
              const storedStartTime = localStorage.getItem(`regulation_reading_start_${regulation.regulation_id}`);
              if (storedStartTime) {
                startTime = new Date(storedStartTime);
                // Sync with server
                try {
                  await api.post('/lms/exam-regulation/start-reading');
                } catch (e) {
                  // Ignore error, use localStorage time
                }
              } else {
                // Start reading
                const startResponse = await api.post('/lms/exam-regulation/start-reading');
                if (startResponse.data.success) {
                  startTime = new Date(startResponse.data.data.readingStartTime);
                  localStorage.setItem(`regulation_reading_start_${regulation.regulation_id}`, startResponse.data.data.readingStartTime);
                }
              }
            }
            
            if (startTime) {
              setReadingStartTime(startTime);
              setShowRegulationModal(true);
              // Hide navbar and topheader
              document.body.classList.add('exam-regulation-viewing');
            }
          }
        }
      }
    } catch (error) {
      console.error('Error checking exam regulation:', error);
    }
  };

  // Update elapsed time for reading regulation
  useEffect(() => {
    if (showRegulationModal && examRegulation && readingStartTime) {
      const updateElapsed = () => {
        const now = new Date();
        const elapsed = Math.floor((now - readingStartTime) / 1000);
        setElapsedSeconds(elapsed);
        setCanConfirm(elapsed >= (examRegulation.reading_time_seconds || 30));
      };
      
      updateElapsed();
      readingIntervalRef.current = setInterval(updateElapsed, 1000);
      
      return () => {
        if (readingIntervalRef.current) {
          clearInterval(readingIntervalRef.current);
        }
      };
    }
  }, [showRegulationModal, examRegulation, readingStartTime]);

  // Confirm exam regulation
  const handleConfirmRegulation = async () => {
    if (!canConfirm) {
      showAlert(t('studentGrades.regulation.needReadTime', { 
        seconds: examRegulation.reading_time_seconds || 30, 
        remaining: (examRegulation.reading_time_seconds || 30) - elapsedSeconds 
      }), 'warning');
      return;
    }

    try {
      const response = await api.post('/lms/exam-regulation/confirm');
      if (response.data.success) {
        setShowRegulationModal(false);
        document.body.classList.remove('exam-regulation-viewing');
        // Clear localStorage
        if (examRegulation) {
          localStorage.removeItem(`regulation_reading_start_${examRegulation.regulation_id}`);
        }
        showAlert(t('studentGrades.regulation.confirmSuccess'), 'success');
      }
    } catch (error) {
      console.error('Error confirming regulation:', error);
      if (error.response?.data?.message) {
        showAlert(error.response.data.message, 'danger');
      } else {
        showAlert(t('studentGrades.regulation.confirmError'), 'danger');
      }
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (readingIntervalRef.current) {
        clearInterval(readingIntervalRef.current);
      }
      document.body.classList.remove('exam-regulation-viewing');
    };
  }, []);

  // Helper functions to compare data changes
  const hasGradesDataChanged = (oldData, newData) => {
    if (!oldData || !Array.isArray(oldData)) return true;
    if (!newData || !Array.isArray(newData)) return false;
    if (oldData.length !== newData.length) return true;
    
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
      if (!oldGrade) return true;
      
      if (
        oldGrade.score !== newGrade.score ||
        oldGrade.max_score !== newGrade.max_score ||
        oldGrade.status !== newGrade.status ||
        oldGrade.updated_at !== newGrade.updated_at
      ) {
        return true;
      }
    }
    
    return false;
  };

  const hasGradeAppealsDataChanged = (oldData, newData) => {
    if (!oldData || !Array.isArray(oldData)) return true;
    if (!newData || !Array.isArray(newData)) return false;
    if (oldData.length !== newData.length) return true;
    
    const oldMap = new Map(oldData.map(appeal => [appeal.appeal_id, {
      appeal_id: appeal.appeal_id,
      status: appeal.status,
      response: appeal.response,
      updated_at: appeal.updated_at
    }]));
    
    for (const newAppeal of newData) {
      const oldAppeal = oldMap.get(newAppeal.appeal_id);
      if (!oldAppeal) return true;
      
      if (
        oldAppeal.status !== newAppeal.status ||
        oldAppeal.response !== newAppeal.response ||
        oldAppeal.updated_at !== newAppeal.updated_at
      ) {
        return true;
      }
    }
    
    return false;
  };

  const showAlertMessage = (message, variant = 'info') => {
    const titles = {
      success: t('common.success'),
      info: t('common.info'),
      warning: t('common.warning'),
      danger: t('common.error')
    };
    showAlert(message, variant, titles[variant] || t('common.notification'));
  };

  // Helper function to format number: remove .00 but keep other decimals like .40
  const formatNumber = (num) => {
    if (num === null || num === undefined || isNaN(num)) return '0';
    const formatted = parseFloat(num).toFixed(2);
    // Remove only .00 at the end, keep other decimals like .40, .50, etc.
    // Example: 4.00 -> "4", 2.40 -> "2.40", 2.41 -> "2.41", 100.00 -> "100"
    return formatted.replace(/\.00$/, '');
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
      pending: { bg: 'warning', text: t('studentGrades.appealStatus.pending') },
      under_review: { bg: 'info', text: t('studentGrades.appealStatus.underReview') },
      approved: { bg: 'success', text: t('studentGrades.appealStatus.approved') },
      rejected: { bg: 'danger', text: t('studentGrades.appealStatus.rejected') }
    };
    const c = config[status] || config.pending;
    return <Badge bg={c.bg}>{c.text}</Badge>;
  };

  // Get grade type from database fields
  const getGradeType = (grade) => {
    // Check exam_type first (if it's an exam)
    if (grade.exam_type) {
      const examTypeMap = {
        'quiz': t('studentGrades.gradeTypes.quiz'),
        'midterm': t('studentGrades.gradeTypes.midterm'),
        'final': t('studentGrades.gradeTypes.final'),
        'practice': t('studentGrades.gradeTypes.practice'),
        'osce': t('studentGrades.gradeTypes.osce'),
        'assessment': t('studentGrades.gradeTypes.assessment')
      };
      return examTypeMap[grade.exam_type] || grade.exam_type;
    }
    // Check if it's an exam but no exam_type (fallback)
    if (grade.exam_id || grade.source_type === 'exam') {
      return t('studentGrades.gradeTypes.exam');
    }
    // Check assignment_id
    if (grade.assignment_id) {
      return t('studentGrades.gradeTypes.assignment');
    }
    // Check item_id (regular grade item)
    if (grade.item_id) {
      return t('studentGrades.gradeTypes.regular');
    }
    return t('studentGrades.gradeTypes.regular');
  };

  // Get badge color for grade type
  const getGradeTypeBadgeColor = (grade) => {
    if (grade.exam_type) {
      const colorMap = {
        'quiz': 'info',
        'midterm': 'warning',
        'final': 'danger',
        'practice': 'secondary',
        'osce': 'primary',
        'assessment': 'success'
      };
      return colorMap[grade.exam_type] || 'primary';
    }
    if (grade.exam_id || grade.source_type === 'exam') {
      return 'primary';
    }
    if (grade.assignment_id) {
      return 'success';
    }
    return 'secondary';
  };

  // Format exam time
  const formatExamTime = (examTime) => {
    if (!examTime) return t('studentGrades.na');
    try {
      const date = new Date(examTime);
      return date.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return t('studentGrades.na');
    }
  };

  // Check if appeal deadline has passed
  const isAppealDeadlinePassed = (grade) => {
    // Only check for exam grades
    if (!grade.exam_time || (!grade.exam_id && grade.source_type !== 'exam')) {
      return false; // Not an exam grade, no deadline check
    }

    try {
      const availableFrom = new Date(grade.exam_time);
      const appealDeadlineDays = grade.appeal_deadline_days !== undefined && grade.appeal_deadline_days !== null 
        ? parseInt(grade.appeal_deadline_days) 
        : 3; // Default 3 days
      
      // Calculate deadline: available_from + appeal_deadline_days
      const deadline = new Date(availableFrom);
      deadline.setDate(deadline.getDate() + appealDeadlineDays);
      
      // Check if current time exceeds deadline
      const now = new Date();
      return now > deadline;
    } catch (error) {
      console.error('Error checking appeal deadline:', error);
      return false;
    }
  };

  // Get appeal deadline date string
  const getAppealDeadlineStr = (grade) => {
    if (!grade.exam_time || (!grade.exam_id && grade.source_type !== 'exam')) {
      return null;
    }

    try {
      const availableFrom = new Date(grade.exam_time);
      const appealDeadlineDays = grade.appeal_deadline_days !== undefined && grade.appeal_deadline_days !== null 
        ? parseInt(grade.appeal_deadline_days) 
        : 3;
      
      const deadline = new Date(availableFrom);
      deadline.setDate(deadline.getDate() + appealDeadlineDays);
      
      return deadline.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return null;
    }
  };

  // Render Grades Tab
  const renderGradesTab = () => {
    return (
      <>
        {/* Search and Filter Controls */}
        <div className="session-list-controls">
          <div className="search-controls">
            <div className="search-input">
              <input
                type="text"
                placeholder={t('studentGrades.searchPlaceholder')}
                value={filters.course_id}
                onChange={(e) => setFilters({ ...filters, course_id: e.target.value })}
                className="search-input"
              />
            </div>
            <Button variant="outline-primary" onClick={fetchGrades} className="filter-btn">
              <i className="fas fa-sync me-2"></i>{t('studentGrades.refresh')}
            </Button>
          </div>
        </div>

        {/* Grades Table */}
        <div className="session-table-container">
          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" />
              <p className="mt-3">{t('studentGrades.loading')}</p>
            </div>
          ) : (
            <>
              <div className="table-responsive-mobile">
                <table className="session-table">
                  <thead>
                    <tr>
                      <th className="mobile-essential">{t('studentGrades.tableHeaders.name')}</th>
                      <th className="mobile-essential">{t('studentGrades.tableHeaders.type')}</th>
                      <th className="mobile-essential">{t('studentGrades.tableHeaders.gradedDate')}</th>
                      <th className="mobile-essential">{t('studentGrades.tableHeaders.score')}</th>
                      <th className="mobile-essential">{t('studentGrades.tableHeaders.percentage')}</th>
                      <th className="mobile-essential">{t('studentGrades.tableHeaders.letterGrade')}</th>
                      <th className="mobile-essential">{t('studentGrades.tableHeaders.gradedBy')}</th>
                      <th className="mobile-essential">{t('studentGrades.tableHeaders.appealDeadline')}</th>
                      <th className="mobile-essential">{t('studentGrades.tableHeaders.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grades.length === 0 ? (
                      <tr>
                        <td colSpan="10" className="text-center p-4">
                          <i className="fas fa-inbox fa-3x text-muted mb-3"></i>
                          <p className="text-muted">{t('studentGrades.noGrades')}</p>
                        </td>
                      </tr>
                    ) : (
                      grades
                        .slice((pagination.page - 1) * pagination.limit, pagination.page * pagination.limit)
                        .map((grade, index) => {
                          const percentage = grade.max_score > 0 ? (grade.score / grade.max_score) * 100 : 0;
                          const letterGrade = getLetterGrade(percentage);
                          const uniqueKey = grade.grade_id || `${grade.source_type || 'exam'}-${grade.exam_id || 'none'}-${grade.user_id || 'none'}-${index}`;
                          return (
                            <tr key={uniqueKey}>
                              <td className="mobile-essential">
                                <Badge bg="info">{grade.course_name || grade.item_name || t('studentGrades.na')}</Badge>
                              </td>
                              <td className="mobile-essential">
                                <Badge bg={getGradeTypeBadgeColor(grade)}>
                                  {getGradeType(grade)}
                                </Badge>
                              </td>
                              <td className="mobile-essential">{formatExamTime(grade.exam_time)}</td>
                              <td className="mobile-essential">
                                {(() => {
                                  const percentage = grade.max_score > 0 ? (grade.score / grade.max_score) * 100 : 0;
                                  // For exams, use passing_score from exam, for other grades, use default 60%
                                  const passingScore = grade.passing_score !== undefined && grade.passing_score !== null 
                                    ? parseFloat(grade.passing_score) 
                                    : 60;
                                  const passed = percentage >= passingScore;
                                  return (
                                    <span 
                                      title={passed ? t('studentGrades.passed') : t('studentGrades.failed')}
                                      style={{ cursor: 'help' }}
                                    >
                                      <strong>{formatNumber(grade.score)}</strong> / {formatNumber(grade.max_score)}
                                    </span>
                                  );
                                })()}
                              </td>
                              <td className="mobile-essential">
                                <ProgressBar 
                                  now={percentage} 
                                  label={`${formatNumber(percentage)}%`}
                                  variant={letterGrade.color}
                                  style={{ minWidth: '100px' }}
                                />
                              </td>
                              <td className="mobile-essential">
                                <Badge bg={letterGrade.color} style={{ fontSize: '1rem' }}>
                                  {letterGrade.grade}
                                </Badge>
                              </td>
                              <td className="mobile-essential">{grade.graded_by_name || t('studentGrades.na')}</td>
                              <td className="mobile-essential">
                                {(() => {
                                  const deadlineStr = getAppealDeadlineStr(grade);
                                  const deadlinePassed = isAppealDeadlinePassed(grade);
                                  if (!deadlineStr) {
                                    return <span className="text-muted">{t('studentGrades.na')}</span>;
                                  }
                                  return (
                                    <span 
                                      className={deadlinePassed ? 'text-danger' : 'text-success'}
                                      title={deadlinePassed ? t('studentGrades.deadlinePassed') : t('studentGrades.deadlineValid')}
                                    >
                                      {deadlineStr}
                                      {deadlinePassed && <i className="fas fa-exclamation-triangle ms-1"></i>}
                                    </span>
                                  );
                                })()}
                              </td>
                              <td className="mobile-essential">
                                <div className="action-buttons">
                                  {(() => {
                                    const deadlinePassed = isAppealDeadlinePassed(grade);
                                    const deadlineStr = getAppealDeadlineStr(grade);
                                    const tooltipText = deadlinePassed 
                                      ? t('studentGrades.appealDeadlinePassedTooltip', { deadline: deadlineStr || t('studentGrades.na') })
                                      : deadlineStr 
                                        ? t('studentGrades.appealWithDeadline', { deadline: deadlineStr })
                                        : t('studentGrades.appeal');
                                    
                                    return (
                                      <Button
                                        size="sm"
                                        variant="outline-info"
                                        onClick={() => handleCreateAppeal(grade)}
                                        disabled={deadlinePassed}
                                        title={tooltipText}
                                        style={deadlinePassed ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                                      >
                                        <i className="fas fa-gavel"></i>
                                      </Button>
                                    );
                                  })()}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>
              
              {grades.length > 0 && pagination.totalPages > 1 && (
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
      </>
    );
  };

  // Render Appeals Tab
  const renderAppealsTab = () => {
    return (
      <div className="session-table-container">
        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" />
              <p className="mt-3">{t('studentGrades.loadingAppeals')}</p>
          </div>
        ) : (
          <>
            <div className="table-responsive-mobile">
              <table className="session-table">
                <thead>
                  <tr>
                    <th className="mobile-essential">{t('studentGrades.tableHeaders.item')}</th>
                    <th className="mobile-essential">{t('studentGrades.tableHeaders.currentScore')}</th>
                    <th className="mobile-essential">{t('studentGrades.tableHeaders.reason')}</th>
                    <th className="mobile-essential">{t('studentGrades.tableHeaders.status')}</th>
                    <th className="mobile-essential">{t('studentGrades.tableHeaders.sentDate')}</th>
                    <th className="mobile-essential">{t('studentGrades.tableHeaders.response')}</th>
                  </tr>
                </thead>
                <tbody>
                  {gradeAppeals.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center p-4">
                        <i className="fas fa-inbox fa-3x text-muted mb-3"></i>
                        <p className="text-muted">{t('studentGrades.noAppeals')}</p>
                      </td>
                    </tr>
                  ) : (
                    gradeAppeals
                      .slice((appealsPagination.page - 1) * appealsPagination.limit, appealsPagination.page * appealsPagination.limit)
                      .map((appeal) => (
                        <tr key={appeal.appeal_id}>
                          <td className="mobile-essential">{appeal.item_name || t('studentGrades.na')}</td>
                          <td className="mobile-essential">
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
                                return <span className="text-muted">{t('studentGrades.na')}</span>;
                              }
                              
                              return (
                                <span 
                                  title={passed ? t('studentGrades.passed') : t('studentGrades.failed')}
                                  style={{ cursor: 'help' }}
                                >
                                  <strong>{formatNumber(appeal.score)}</strong> / {formatNumber(maxScore)}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="mobile-essential">
                            <div style={{ maxWidth: '300px' }}>
                              {appeal.reason.substring(0, 100)}
                              {appeal.reason.length > 100 && '...'}
                            </div>
                          </td>
                          <td className="mobile-essential">{getAppealStatusBadge(appeal.status)}</td>
                          <td className="mobile-essential">
                            {new Date(appeal.created_at).toLocaleDateString('vi-VN')}
                          </td>
                          <td className="mobile-essential">
                            {appeal.response ? (
                              <div style={{ maxWidth: '300px' }}>
                                {appeal.response.substring(0, 100)}
                                {appeal.response.length > 100 && '...'}
                              </div>
                            ) : (
                              <span className="text-muted">{t('studentGrades.noResponse')}</span>
                            )}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
            
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
    );
  };

  return (
    <div className="container-fluid session-main-container">
      {/* Header */}
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>{t('studentGrades.headerTitle')}</h1>
            <p className="header-subtitle">{t('studentGrades.headerSubtitle')}</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <Tabs
          activeKey={activeTab}
          onSelect={(k) => setActiveTab(k)}
          className="custom-tabs"
        >
          <Tab eventKey="grades" title={
            <span className="tab-title">
              <i className="fas fa-table me-2"></i>
              {t('studentGrades.tabs.myGrades')}
            </span>
          }>
            {renderGradesTab()}
          </Tab>
          <Tab eventKey="appeals" title={
            <span className="tab-title">
              <i className="fas fa-gavel me-2"></i>
              {t('studentGrades.tabs.appeals')}
            </span>
          }>
            {renderAppealsTab()}
          </Tab>
        </Tabs>
      </div>

      {/* Appeal Modal */}
      <Modal show={showAppealModal} onHide={() => setShowAppealModal(false)} size="lg" className="student-detail-modal">
        <Modal.Header closeButton className="student-detail-header">
          <Modal.Title className="student-detail-title">
            <div className="student-avatar">
              <i className="fas fa-gavel"></i>
            </div>
            <div>
              <h4 className="mb-0">{t('studentGrades.appealModal.title')}</h4>
              <p className="mb-0 student-subtitle">{t('studentGrades.appealModal.subtitle')}</p>
            </div>
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmitAppeal}>
          <Modal.Body className="student-detail-body">
            <div className="student-detail-container">
              {/* Grade Information Card */}
              <div className="session-card mb-4">
                <div className="card-header-modern">
                  <div className="header-icon">
                    <i className="fas fa-info-circle"></i>
                  </div>
                  <h6 className="mb-0">{t('studentGrades.appealModal.gradeInfoTitle')}</h6>
                </div>
                <div className="card-body-modern">
                  <div className="info-item">
                    <div className="info-label">
                      <i className="fas fa-chart-line me-2"></i>
                      {t('studentGrades.appealModal.currentScore')}
                    </div>
                    <div className="info-value">
                      <strong>{formatNumber(selectedGrade?.score || 0)}</strong> / {formatNumber(selectedGrade?.max_score || 0)}
                    </div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">
                      <i className="fas fa-book me-2"></i>
                      {t('studentGrades.appealModal.item')}
                    </div>
                    <div className="info-value">{selectedGrade?.item_name || t('studentGrades.na')}</div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">
                      <i className="fas fa-graduation-cap me-2"></i>
                      {t('studentGrades.appealModal.course')}
                    </div>
                    <div className="info-value">{selectedGrade?.course_name || t('studentGrades.na')}</div>
                  </div>
                  {selectedGrade?.class_name && (
                    <div className="info-item">
                      <div className="info-label">
                        <i className="fas fa-users me-2"></i>
                        {t('studentGrades.appealModal.class')}
                      </div>
                      <div className="info-value">{selectedGrade.class_name}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Appeal Form Card */}
              <div className="session-card">
                <div className="card-header-modern">
                  <div className="header-icon">
                    <i className="fas fa-edit"></i>
                  </div>
                  <h6 className="mb-0">{t('studentGrades.appealModal.reasonTitle')}</h6>
                </div>
                <div className="card-body-modern">
                  <Form.Group className="mb-3">
                    <Form.Label className="info-label">
                      <i className="fas fa-comment-alt me-2"></i>
                      {t('studentGrades.appealModal.reasonLabel')} <span className="text-danger">{t('studentGrades.appealModal.reasonRequired')}</span>
                    </Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={6}
                      value={appealForm.reason}
                      onChange={(e) => setAppealForm({ ...appealForm, reason: e.target.value })}
                      placeholder={t('studentGrades.appealModal.reasonPlaceholder')}
                      required
                      className="form-control-modern"
                    />
                    <Form.Text className="text-muted">
                      {t('studentGrades.appealModal.reasonHelp')}
                    </Form.Text>
                  </Form.Group>
                </div>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer className="student-detail-footer">
            <Button variant="outline-secondary" onClick={() => setShowAppealModal(false)} className="btn-cancel">
              <i className="fas fa-times me-2"></i>
              {t('studentGrades.appealModal.cancel')}
            </Button>
            <Button variant="primary" type="submit" className="btn-edit">
              <i className="fas fa-paper-plane me-2"></i>
              {t('studentGrades.appealModal.submit')}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Exam Regulation Fullscreen Modal */}
      <Modal 
        show={showRegulationModal} 
        onHide={() => {}} 
        backdrop="static"
        keyboard={false}
        fullscreen
        className="student-detail-modal exam-regulation-fullscreen-modal"
      >
        <Modal.Header className="student-detail-header" style={{ border: 'none', textAlign: 'center' }}>
          <Modal.Title className="student-detail-title" style={{ width: '100%', justifyContent: 'center' }}>
            <h4 className="mb-0">{examRegulation?.title || t('studentGrades.regulation.title')}</h4>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ 
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          margin: 0,
          height: 'calc(100vh - 120px)',
          maxHeight: 'calc(100vh - 120px)',
          overflow: 'hidden',
          backgroundColor: 'transparent',
          flex: 1,
          position: 'relative'
        }}>
          {examRegulation && (
            <>
              {/* Regulation Content - Scrollable */}
              <div style={{ 
                flex: 1,
                overflowY: 'auto',
                padding: '2rem',
                paddingBottom: 'calc(1.5rem + 2rem + 3.5rem)', // Padding bottom = button height + padding
                fontSize: '1.1rem',
                lineHeight: '1.8',
                color: '#495057',
                minHeight: 0,
                boxSizing: 'border-box'
              }}>
                <div 
                  dangerouslySetInnerHTML={{ __html: examRegulation.description }}
                />
              </div>

              {/* Confirm Button at bottom - Fixed */}
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '1.5rem 2rem',
                backgroundColor: '#f8f9fa',
                borderTop: '1px solid #e9ecef',
                zIndex: 10
              }}>
                <Button
                  variant={canConfirm ? "success" : "secondary"}
                  size="lg"
                  className="w-100"
                  onClick={handleConfirmRegulation}
                  disabled={!canConfirm}
                  style={{ 
                    fontSize: '1.2rem',
                    padding: '1rem',
                    fontWeight: 'bold',
                    borderRadius: '12px'
                  }}
                >
                  {canConfirm ? (
                    <>
                      <i className="fas fa-check-circle me-2"></i>
                      {t('studentGrades.regulation.confirm')}
                    </>
                  ) : (
                    <>
                      <i className="fas fa-clock me-2"></i>
                      {t('studentGrades.regulation.pleaseRead')}
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default StudentGrades;




