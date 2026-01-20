import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Modal, Button, Form, Alert, Badge, Accordion, Table, ProgressBar, Tab, Tabs, Nav, Row, Col, InputGroup, Spinner } from 'react-bootstrap';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import api, { refreshCSRFToken } from '../../utils/api';
import io from 'socket.io-client';
import Pagination from '../../components/Pagination';
import usePageTitle from '../../hooks/usePageTitle';
import RichTextEditor from '../../components/RichTextEditor';
import '../../styles/user.css';

// Component to display realtime time remaining
const TimeRemainingDisplay = ({ attempt, examDuration }) => {
  const [timeRemaining, setTimeRemaining] = useState(null);
  const intervalRef = useRef(null);
  const lastSavedTimeRef = useRef(null); // Track last saved time_remaining_seconds from database
  const isActiveRef = useRef(true); // Track if student is active (updating time in database)
  const lastCheckTimeRef = useRef(null); // Track when we last checked database value

  useEffect(() => {
    // Initialize time remaining from database or calculate from start_time
    const initializeTime = () => {
      if (attempt.time_remaining_seconds !== null && attempt.time_remaining_seconds !== undefined) {
        // Use saved time_remaining_seconds (preserves time from when issue occurred)
        const savedTime = Math.max(0, attempt.time_remaining_seconds);
        setTimeRemaining(savedTime);
        lastSavedTimeRef.current = savedTime;
        lastCheckTimeRef.current = Date.now();
        isActiveRef.current = true;
      } else if (attempt.start_time && examDuration) {
        // Calculate from start_time (fallback)
        const startTime = new Date(attempt.start_time);
        const now = new Date();
        const elapsedSeconds = Math.floor((now - startTime) / 1000);
        const durationSeconds = examDuration * 60;
        const calculatedTime = Math.max(0, durationSeconds - elapsedSeconds);
        setTimeRemaining(calculatedTime);
        lastSavedTimeRef.current = calculatedTime;
        lastCheckTimeRef.current = Date.now();
        isActiveRef.current = true;
      } else {
        setTimeRemaining(null);
      }
    };

    initializeTime();

    // Update every second for in_progress attempts
    // But stop if student encountered an issue (time_remaining_seconds not updating)
    if (attempt.status === 'in_progress') {
      intervalRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev === null || prev <= 0) {
            return 0;
          }
          
          // If student is not active (time stopped due to issue), keep the last saved value
          if (!isActiveRef.current) {
            return lastSavedTimeRef.current !== null ? lastSavedTimeRef.current : prev;
          }
          
          // Normal countdown
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [attempt.start_time, attempt.status, examDuration]);
  
  // Monitor for database updates to detect if student is active or encountered an issue
  useEffect(() => {
    if (attempt.time_remaining_seconds !== null && attempt.time_remaining_seconds !== undefined) {
      const savedTime = Math.max(0, attempt.time_remaining_seconds);
      const now = Date.now();
      
      // Check if this is the first time we're seeing this value
      if (lastSavedTimeRef.current === null) {
        setTimeRemaining(savedTime);
        lastSavedTimeRef.current = savedTime;
        lastCheckTimeRef.current = now;
        isActiveRef.current = true;
        return;
      }
      
      // If saved time changed, student is active and updating
      if (savedTime !== lastSavedTimeRef.current) {
        // Student is active - update time and continue countdown
        setTimeRemaining(savedTime);
        lastSavedTimeRef.current = savedTime;
        lastCheckTimeRef.current = now;
        isActiveRef.current = true;
      } else {
        // Saved time hasn't changed - check if student encountered an issue
        // If we've been counting down but database value hasn't changed, student encountered an issue
        const timeSinceLastCheck = lastCheckTimeRef.current ? Math.floor((now - lastCheckTimeRef.current) / 1000) : 0;
        const currentDisplayTime = timeRemaining;
        
        // Calculate expected time: what the database value should be if student is active
        // (current display time minus seconds that have passed)
        const expectedTime = currentDisplayTime !== null ? Math.max(0, currentDisplayTime - timeSinceLastCheck) : savedTime;
        
        // If database value is significantly different from expected (more than 3 seconds),
        // it means time has stopped due to issue (student is not updating database)
        if (Math.abs(savedTime - expectedTime) > 3) {
          // Time has stopped - use saved value and stop countdown
          setTimeRemaining(savedTime);
          isActiveRef.current = false;
        } else {
          // Time matches expected - student is active
          isActiveRef.current = true;
        }
        
        lastCheckTimeRef.current = now;
      }
    }
  }, [attempt.time_remaining_seconds, timeRemaining]);

  const formatTime = (seconds) => {
    if (seconds === null || seconds === undefined) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (timeRemaining === null) return null;

  return (
    <div className="text-muted small mt-1" style={{ fontSize: '0.85rem' }}>
      <i className="fas fa-clock me-1"></i>
      <span className={timeRemaining < 300 ? 'text-danger fw-bold' : ''}>
        Còn lại: {formatTime(timeRemaining)}
      </span>
    </div>
  );
};

const Exams = () => {
  usePageTitle('Quản lý thi cử');
  const { currentUser } = useAuth();
  const [exams, setExams] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [topics, setTopics] = useState([]);
  const [monitoringData, setMonitoringData] = useState([]);
  const [cheatingLogs, setCheatingLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showExamModal, setShowExamModal] = useState(false);
  const [showBlueprintModal, setShowBlueprintModal] = useState(false);
  const [showMonitoringModal, setShowMonitoringModal] = useState(false);
  const [showWebcamModal, setShowWebcamModal] = useState(false);
  const [selectedExam, setSelectedExam] = useState(null);
  const [selectedAttemptForVideo, setSelectedAttemptForVideo] = useState(null);
  const [webcamVideoUrl, setWebcamVideoUrl] = useState(null);
  const [loadingVideo, setLoadingVideo] = useState(false);

  // Live webcam streaming states
  const socketRef = useRef(null);
  const liveWebcamStreams = useRef({}); // { attemptId: imageData }
  const [liveWebcamData, setLiveWebcamData] = useState({}); // { attemptId: imageData }

  // Live webcam fullscreen modal
  const [showLiveWebcamModal, setShowLiveWebcamModal] = useState(false);
  const [selectedAttemptForLiveView, setSelectedAttemptForLiveView] = useState(null);
  const [showAnswersDetailModal, setShowAnswersDetailModal] = useState(false);
  const [answersDetailData, setAnswersDetailData] = useState(null);
  const [loadingAnswersDetail, setLoadingAnswersDetail] = useState(false);
  const [currentViewingAttemptId, setCurrentViewingAttemptId] = useState(null);
  const [showBanModal, setShowBanModal] = useState(false);
  const [selectedAttemptForBan, setSelectedAttemptForBan] = useState(null);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [examToDelete, setExamToDelete] = useState(null);
  const [showGrantResumeModal, setShowGrantResumeModal] = useState(false);
  const [attemptForGrantResume, setAttemptForGrantResume] = useState(null);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [attemptForReset, setAttemptForReset] = useState(null);
  const [showUnbanConfirmModal, setShowUnbanConfirmModal] = useState(false);
  const [attemptForUnban, setAttemptForUnban] = useState(null);
  const lastAnsweredCountRef = useRef(null); // Track last answered_questions_count
  const lastUpdateTimeRef = useRef(null); // Track last update time to prevent too frequent updates
  const isUpdatingRef = useRef(false); // Prevent concurrent updates

  // Exam Regulation states
  const [showRegulationModal, setShowRegulationModal] = useState(false);
  const [regulationModalTab, setRegulationModalTab] = useState('basic');
  const [regulationForm, setRegulationForm] = useState({
    title: '',
    description: '',
    is_active: false,
    reading_time_seconds: 30,
    display_from: '',
    display_until: '',
    require_read_each_time: false
  });
  const [loadingRegulation, setLoadingRegulation] = useState(false);
  const [regulationId, setRegulationId] = useState(null);
  const [confirmations, setConfirmations] = useState([]);
  const [loadingConfirmations, setLoadingConfirmations] = useState(false);
  const [confirmationsPagination, setConfirmationsPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  const [confirmationsSearch, setConfirmationsSearch] = useState('');
  const [confirmationsClassFilter, setConfirmationsClassFilter] = useState('');
  const [confirmationsGroupFilter, setConfirmationsGroupFilter] = useState('');
  const [confirmationClasses, setConfirmationClasses] = useState([]);
  const [confirmationGroups, setConfirmationGroups] = useState([]);
  const [confirmationsToDelete, setConfirmationsToDelete] = useState(null);

  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [originalQuestionPoints, setOriginalQuestionPoints] = useState([]); // Lưu điểm cũ để revert
  const [hasRedistributedPoints, setHasRedistributedPoints] = useState(false); // Đánh dấu đã phân bố lại điểm
  const [originalQuestionPointsOnLoad, setOriginalQuestionPointsOnLoad] = useState([]); // Lưu điểm ban đầu khi load exam để so sánh
  const [editMode, setEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState('exams');
  const [examModalTab, setExamModalTab] = useState('basic'); // Tab trong modal tạo kỳ thi
  const { showAlert } = useAlert();

  // Student selection states
  const [students, setStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [faculties, setFaculties] = useState([]);
  const [majors, setMajors] = useState([]);
  const [studentGroups, setStudentGroups] = useState([]);
  const [classFilter, setClassFilter] = useState('');
  const [facultyFilter, setFacultyFilter] = useState('');
  const [majorFilter, setMajorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('Đang học');
  const [groupFilter, setGroupFilter] = useState('');
  const [useGroupMode, setUseGroupMode] = useState(false);
  const [sortField, setSortField] = useState('student_id');
  const [sortOrder, setSortOrder] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(70);
  const [totalStudents, setTotalStudents] = useState(0);

  // Filters
  const [filters, setFilters] = useState({
    search: '',
    exam_type: '',
    status: '',
    class_name: '',
    date_from: '',
    date_to: ''
  });
  
  // Filter options
  const [filterClasses, setFilterClasses] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    totalItems: 0,
    totalPages: 0
  });
  const [monitoringPagination, setMonitoringPagination] = useState({
    page: 1,
    limit: 20,
    totalItems: 0,
    totalPages: 0
  });

  // Form data
  const [examForm, setExamForm] = useState({
    exam_title: '',
    exam_description: '',
    exam_type: 'quiz',
    course_id: null,
    total_points: 10,
    duration_minutes: 60,
    passing_score: 60,
    max_attempts: 1,
    shuffle_questions: true,
    shuffle_options: true,
    show_results_after: {
      hide_results: false,
      show_results_only: true,
      show_questions_list: false,
      show_question_result: false,
      show_question_options: false,
      show_answers: false,
      show_timestamps: false
    },
    scheduled_start: '',
    scheduled_end: '',
    time_limit_type: 'fixed',
    proctoring_enabled: true,
    proctoring_type: 'none',
    ip_restrictions: '',
    lockdown_browser_required: false,
    ims_exam_pctu_required: true,
    ims_exam_pctu_config: {
      exempt_type: 'none', // 'none', 'students', 'classes', 'groups'
      exempt_students: [], // List of student IDs to exempt
      exempt_classes: [], // List of class names to exempt
      exempt_groups: [] // List of group IDs to exempt
    },
    webcam_required: true,
    webcam_config: {
      exempt_type: 'none', // 'none', 'students', 'classes', 'groups'
      exempt_students: [], // List of student IDs to exempt
      exempt_classes: [], // List of class names to exempt
      exempt_groups: [] // List of group IDs to exempt
    },
    allow_backtrack: false,
    questions_per_page: '1', // '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'all'
    show_points_per_question: false, // Hiển thị điểm của mỗi câu
    show_progress_bar: true, // Thanh tiến độ câu đã làm
    show_answered_count: true, // Số câu đã làm (Hiển thị trong thanh tiến độ)
    show_page_number: true, // Hiển thị "Trang n/n"
    instructions_title: 'Hướng dẫn', // Tiêu đề
    instructions_list: [ // Danh sách
      'Đọc kỹ từng câu hỏi trước khi trả lời',
      'Bài thi sẽ tự động nộp khi hết thời gian',
      'Không được mở tab khác hoặc thoát trình duyệt'
    ],
    exam_password: '', // Mật khẩu để tham gia thi
    question_selection_mode: 'random_on_exam', // 'first_on_create', 'random_on_create', 'first_on_exam', 'random_on_exam'
    face_verification_enabled: false,
    face_verification_config: {
      exempt_type: 'none', // 'none', 'students', 'classes', 'groups'
      exempt_students: [], // List of student IDs to exempt
      exempt_classes: [], // List of class names to exempt
      exempt_groups: [] // List of group IDs to exempt
    },
    email_notification_config: {
      send_on_approval: false,
      send_before_start: false,
      before_start_duration: 60 // minutes
    },
    email_results_config: {
      enabled: false,
      include_results: false,
      include_questions_list: false,
      include_question_result: false,
      include_question_options: false,
      include_selected_answers: false,
      include_timestamps: false
    }
  });

  // Blueprint configuration
  const [blueprint, setBlueprint] = useState({
    // Cũ (backward compatibility)
    selected_topic_id: '', // Deprecated: chỉ dùng nếu topics array rỗng
    use_difficulty_distribution: true, // Deprecated: chỉ dùng nếu topics array rỗng
    use_bloom_distribution: false, // Deprecated: chỉ dùng nếu topics array rỗng
    easy: 0,
    medium: 0,
    hard: 0,
    expert: 0,
    remember: 0,
    understand: 0,
    apply: 0,
    analyze: 0,
    evaluate: 0,
    create: 0,
    easy_points: 0,
    medium_points: 0,
    hard_points: 0,
    expert_points: 0,
    remember_points: 0,
    understand_points: 0,
    apply_points: 0,
    analyze_points: 0,
    evaluate_points: 0,
    create_points: 0,
    // Mới (chính)
    topics: [] // Array of topic configurations
  });

  // Initial fetch
  useEffect(() => {
    if (activeTab === 'exams') {
      fetchExams();
    } else if (activeTab === 'monitoring' && selectedExam) {
      fetchMonitoringData();
    }
  }, [filters, activeTab, selectedExam]);

  // Auto-update total_points when selectedQuestions change (but not when redistributing)
  // Tự động tính tổng điểm từ các mức độ khi blueprint thay đổi (chỉ cho mode on_exam)
  useEffect(() => {
    if ((examForm.question_selection_mode === 'first_on_exam' || examForm.question_selection_mode === 'random_on_exam') && showExamModal) {
      let calculatedTotal = 0;
      
      // Nếu có topics array, tính từ tất cả topics
      if (blueprint.topics && Array.isArray(blueprint.topics) && blueprint.topics.length > 0) {
        blueprint.topics.forEach(topicConfig => {
          if (topicConfig.distribution_type === 'difficulty') {
            calculatedTotal += (topicConfig.difficulty_distribution?.easy_points || 0) +
                              (topicConfig.difficulty_distribution?.medium_points || 0) +
                              (topicConfig.difficulty_distribution?.hard_points || 0) +
                              (topicConfig.difficulty_distribution?.expert_points || 0);
          } else if (topicConfig.distribution_type === 'bloom') {
            calculatedTotal += (topicConfig.bloom_distribution?.remember_points || 0) +
                              (topicConfig.bloom_distribution?.understand_points || 0) +
                              (topicConfig.bloom_distribution?.apply_points || 0) +
                              (topicConfig.bloom_distribution?.analyze_points || 0) +
                              (topicConfig.bloom_distribution?.evaluate_points || 0) +
                              (topicConfig.bloom_distribution?.create_points || 0);
          }
        });
      } else {
        // Backward compatibility: tính từ blueprint cũ
        if (blueprint.use_difficulty_distribution) {
          calculatedTotal = (blueprint.easy_points || 0) + 
                            (blueprint.medium_points || 0) + 
                            (blueprint.hard_points || 0) + 
                            (blueprint.expert_points || 0);
        } else if (blueprint.use_bloom_distribution) {
          calculatedTotal = (blueprint.remember_points || 0) + 
                            (blueprint.understand_points || 0) + 
                            (blueprint.apply_points || 0) + 
                            (blueprint.analyze_points || 0) + 
                            (blueprint.evaluate_points || 0) + 
                            (blueprint.create_points || 0);
        }
      }
      
      setExamForm(prev => ({
        ...prev,
        total_points: parseFloat(calculatedTotal.toFixed(2))
      }));
    }
  }, [
    blueprint.easy_points, blueprint.medium_points, blueprint.hard_points, blueprint.expert_points,
    blueprint.remember_points, blueprint.understand_points, blueprint.apply_points,
    blueprint.analyze_points, blueprint.evaluate_points, blueprint.create_points,
    blueprint.use_difficulty_distribution, blueprint.use_bloom_distribution,
    JSON.stringify(blueprint.topics), // Stringify để theo dõi tất cả thay đổi bên trong topics array
    examForm.question_selection_mode, showExamModal
  ]);

  useEffect(() => {
    // Chỉ tính từ selectedQuestions nếu không phải mode on_exam
    if (showExamModal && selectedQuestions.length > 0 && !hasRedistributedPoints &&
        examForm.question_selection_mode !== 'first_on_exam' && 
        examForm.question_selection_mode !== 'random_on_exam') {
      const totalPoints = selectedQuestions.reduce((sum, q) => sum + (parseFloat(q.points) || 0), 0);
      setExamForm(prev => {
        // Chỉ cập nhật nếu tổng điểm thực sự thay đổi (tránh vòng lặp)
        const currentTotal = prev.total_points || 0;
        const newTotal = parseFloat(totalPoints.toFixed(2));
        if (Math.abs(currentTotal - newTotal) > 0.01) {
          return {
            ...prev,
            total_points: newTotal
          };
        }
        return prev;
      });
    }
  }, [selectedQuestions, showExamModal, hasRedistributedPoints, examForm.question_selection_mode]);

  // Fetch filter classes when exams tab is active
  useEffect(() => {
    if (activeTab === 'exams' && hasLMSQAPermission()) {
      fetchFilterClasses();
    }
  }, [activeTab, currentUser]);

  // Fetch exams when filters change
  useEffect(() => {
    if (activeTab === 'exams' && hasLMSQAPermission()) {
      fetchExams();
    }
  }, [filters, activeTab, currentUser]);

  // Background polling for exams list - only update if data changed
  useEffect(() => {
    if (activeTab !== 'exams') return; // Only poll for exams list

    let pollInterval;
    let isMounted = true;
    let currentPolling = false; // Prevent concurrent requests

    const pollExams = async () => {
      if (currentPolling || !isMounted) return;

      try {
        currentPolling = true;
        const params = new URLSearchParams();
        if (filters.search) params.append('search', filters.search);
        if (filters.exam_type) params.append('exam_type', filters.exam_type);
        if (filters.status) params.append('status', filters.status);
        if (filters.class_name) params.append('class_name', filters.class_name);
        if (filters.date_from) params.append('date_from', filters.date_from);
        if (filters.date_to) params.append('date_to', filters.date_to);

        const response = await api.get(`/lms/exams?${params.toString()}`);
        const examsData = response.data?.data;

        let newExams = [];
        if (examsData && Array.isArray(examsData.exams)) {
          newExams = examsData.exams;
        } else if (Array.isArray(examsData)) {
          newExams = examsData;
        }

        // Map attempts_allowed to max_attempts for consistency with form
        const mappedNewExams = newExams.map(exam => ({
          ...exam,
          max_attempts: exam.max_attempts || exam.attempts_allowed || 1
        }));

        if (!isMounted) return;

        // Compare with current data - only update if changed
        setExams(currentExams => {
          if (hasExamsDataChanged(currentExams, mappedNewExams)) {
            return mappedNewExams;
          }
          return currentExams; // No changes, keep current data
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
        pollInterval = setInterval(pollExams, 5000); // Poll every 5 seconds
      }
    }, 5000);

    return () => {
      isMounted = false;
      clearTimeout(initialDelay);
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [activeTab, filters.search, filters.exam_type, filters.status, filters.class_name, filters.date_from, filters.date_to]);

  // Update pagination when exams change
  useEffect(() => {
    if (activeTab === 'exams') {
      const totalItems = exams.length;
      const totalPages = Math.ceil(totalItems / pagination.limit);
      setPagination(prev => ({
        ...prev,
        totalItems,
        totalPages,
        page: prev.page > totalPages && totalPages > 0 ? totalPages : prev.page
      }));
    }
  }, [exams, activeTab, pagination.limit]);

  // Update pagination when monitoringData change
  useEffect(() => {
    if (activeTab === 'monitoring') {
      const totalItems = monitoringData.length;
      const totalPages = Math.ceil(totalItems / monitoringPagination.limit);
      setMonitoringPagination(prev => ({
        ...prev,
        totalItems,
        totalPages,
        page: prev.page > totalPages && totalPages > 0 ? totalPages : prev.page
      }));
    }
  }, [monitoringData, activeTab, monitoringPagination.limit]);

  // Background polling for monitoring data - only update if data changed
  useEffect(() => {
    if (activeTab !== 'monitoring' || !selectedExam) return;

    let pollInterval;
    let isMounted = true;
    let currentPolling = false;

    const pollMonitoring = async () => {
      if (currentPolling || !isMounted) return;

      try {
        currentPolling = true;
        const response = await api.get(`/lms/exams/${selectedExam.exam_id}/monitoring`);
        const attempts = response.data.data || [];

        if (!isMounted) return;

        // Compare with current data - only update if changed
        setMonitoringData(currentData => {
          if (hasMonitoringDataChanged(currentData, attempts)) {
            // Fetch cheating logs for new attempts
            fetchCheatingLogsForAttempts(attempts);

            // Note: Watching attempts is handled by separate useEffect when monitoringData changes

            return attempts;
          }
          return currentData; // No changes, keep current data
        });
      } catch (error) {
        // Silently fail in background polling
        console.debug('Background monitoring polling error (silent):', error);
      } finally {
        currentPolling = false;
      }
    };

    // Start polling after initial load (5 seconds delay)
    const initialDelay = setTimeout(() => {
      if (isMounted) {
        pollInterval = setInterval(pollMonitoring, 5000); // Poll every 5 seconds
      }
    }, 5000);

    return () => {
      isMounted = false;
      clearTimeout(initialDelay);
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [activeTab, selectedExam?.exam_id]);

  // Auto-update answers detail modal when monitoring data changes
  useEffect(() => {
    // Only update if modal is open and we're viewing a specific attempt
    if (!showAnswersDetailModal || !currentViewingAttemptId || !monitoringData.length) {
      return;
    }

    // Prevent concurrent updates
    if (isUpdatingRef.current) {
      return;
    }

    // Find the current attempt in monitoring data
    const currentAttempt = monitoringData.find(a => a.attempt_id === currentViewingAttemptId);
    if (!currentAttempt) {
      return;
    }

    // Check if answered_questions_count has changed
    const currentAnsweredCount = currentAttempt.answered_questions_count || 0;
    const lastAnsweredCount = lastAnsweredCountRef.current;

    // Only update if count has changed (increased or decreased - student might have changed answers)
    // Also check if enough time has passed since last update (throttle to prevent too frequent updates)
    const now = Date.now();
    const timeSinceLastUpdate = lastUpdateTimeRef.current ? now - lastUpdateTimeRef.current : Infinity;
    const shouldUpdate = lastAnsweredCount !== null && 
                        currentAnsweredCount !== lastAnsweredCount && 
                        timeSinceLastUpdate > 1000; // At least 1 second between updates

    if (shouldUpdate) {
      // Silently fetch new data in background
      const fetchUpdatedAnswers = async () => {
        if (isUpdatingRef.current) return;
        
        isUpdatingRef.current = true;
        try {
          const response = await api.get(`/lms/attempts/${currentViewingAttemptId}/answers-detail`);
          if (response.data.success) {
            setAnswersDetailData(response.data.data);
            lastAnsweredCountRef.current = currentAnsweredCount;
            lastUpdateTimeRef.current = Date.now();
          }
        } catch (error) {
          // Silently fail - don't show error to user
          console.debug('Background update of answers detail failed:', error);
        } finally {
          isUpdatingRef.current = false;
        }
      };

      fetchUpdatedAnswers();
    } else if (lastAnsweredCount === null) {
      // First time, just update the ref
      lastAnsweredCountRef.current = currentAnsweredCount;
      lastUpdateTimeRef.current = Date.now();
    }
  }, [monitoringData, showAnswersDetailModal, currentViewingAttemptId]);

  // Track which attempts are being watched to avoid duplicate watching
  const watchedAttemptsRef = useRef(new Set());

  // WebSocket connection for live webcam streaming (only connect/disconnect based on tab)
  useEffect(() => {
    if (activeTab !== 'monitoring' || !selectedExam) {
      // Disconnect when leaving monitoring tab
      if (socketRef.current) {
        Object.keys(liveWebcamStreams.current).forEach(attemptId => {
          if (socketRef.current.connected) {
            socketRef.current.emit('exam:stop_watching', attemptId);
          }
        });
        socketRef.current.disconnect();
        socketRef.current = null;
        liveWebcamStreams.current = {};
        setLiveWebcamData({});
        watchedAttemptsRef.current.clear();
      }
      return;
    }

    // Only create socket if it doesn't exist
    if (socketRef.current) {
      return; // Socket already exists, don't recreate
    }

    // Connect to WebSocket server
    const socketUrl = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';
    socketRef.current = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    socketRef.current.on('connect', () => {
      console.log('👁️ WebSocket connected for live webcam monitoring');
      console.log('👁️ Current monitoringData:', monitoringData.length, 'attempts');

      // Watch all active attempts that are already in monitoringData
      // Watch all active attempts (not submitted) - if exam requires webcam, student will stream
      monitoringData.forEach(attempt => {
        const shouldWatch = attempt.attempt_id && !attempt.submit_time;
        console.log('👁️ Checking attempt:', {
          attempt_id: attempt.attempt_id,
          submit_time: attempt.submit_time,
          webcam_video_path: attempt.webcam_video_path,
          shouldWatch
        });
        if (shouldWatch) {
          watchAttemptWebcam(attempt.attempt_id);
        }
      });
    });

    socketRef.current.on('exam:webcam_frame', (data) => {
      const { attemptId, frame } = data;
      if (attemptId && frame) {
        // Update live webcam stream
        liveWebcamStreams.current[attemptId] = frame;
        setLiveWebcamData(prev => ({
          ...prev,
          [attemptId]: frame
        }));
      }
    });

    socketRef.current.on('disconnect', () => {
      console.log('👁️ WebSocket disconnected');
    });

    socketRef.current.on('error', (error) => {
      console.error('👁️ WebSocket error:', error);
    });

    return () => {
      // Cleanup: stop watching all attempts and disconnect
      if (socketRef.current) {
        Object.keys(liveWebcamStreams.current).forEach(attemptId => {
          if (socketRef.current.connected) {
            socketRef.current.emit('exam:stop_watching', attemptId);
          }
        });
        socketRef.current.disconnect();
        socketRef.current = null;
        liveWebcamStreams.current = {};
        setLiveWebcamData({});
        watchedAttemptsRef.current.clear();
      }
    };
  }, [activeTab, selectedExam?.exam_id]); // Removed monitoringData from dependencies

  // Watch new attempts when monitoringData changes (but don't recreate socket)
  useEffect(() => {
    if (activeTab !== 'monitoring' || !selectedExam || !socketRef.current) {
      console.log('👁️ Skipping watch attempts:', {
        activeTab,
        hasSelectedExam: !!selectedExam,
        hasSocket: !!socketRef.current,
        socketConnected: socketRef.current?.connected
      });
      return;
    }

    if (!socketRef.current.connected) {
      console.log('👁️ Socket not connected yet, waiting for connection...');
      return;
    }

    console.log('👁️ Processing monitoringData for watching:', monitoringData.length, 'attempts');

    // Only watch attempts that are new (not already being watched)
    // Watch all active attempts (not submitted) - if exam requires webcam, student will stream
    monitoringData.forEach(attempt => {
      const shouldWatch = attempt.attempt_id &&
        !attempt.submit_time &&
        !watchedAttemptsRef.current.has(attempt.attempt_id);

      console.log('👁️ Attempt check:', {
        attempt_id: attempt.attempt_id,
        submit_time: attempt.submit_time,
        has_webcam_path: !!attempt.webcam_video_path,
        already_watched: watchedAttemptsRef.current.has(attempt.attempt_id),
        shouldWatch
      });

      if (shouldWatch) {
        watchAttemptWebcam(attempt.attempt_id);
      }
    });

    // Stop watching attempts that are no longer active or have been submitted
    const activeAttemptIds = new Set(
      monitoringData
        .filter(a => a.attempt_id && !a.submit_time)
        .map(a => a.attempt_id)
    );

    // Remove attempts that are no longer active
    watchedAttemptsRef.current.forEach(attemptId => {
      if (!activeAttemptIds.has(attemptId)) {
        if (socketRef.current && socketRef.current.connected) {
          socketRef.current.emit('exam:stop_watching', attemptId);
        }
        watchedAttemptsRef.current.delete(attemptId);
        delete liveWebcamStreams.current[attemptId];
        setLiveWebcamData(prev => {
          const newData = { ...prev };
          delete newData[attemptId];
          return newData;
        });
      }
    });
  }, [monitoringData, activeTab, selectedExam?.exam_id]);

  const watchAttemptWebcam = (attemptId) => {
    if (!socketRef.current) {
      console.warn(`👁️ Cannot watch attempt ${attemptId}: socket not initialized`);
      return;
    }

    if (!socketRef.current.connected) {
      console.warn(`👁️ Cannot watch attempt ${attemptId}: socket not connected`);
      return;
    }

    if (watchedAttemptsRef.current.has(attemptId)) {
      console.log(`👁️ Already watching attempt: ${attemptId}`);
      return;
    }

    socketRef.current.emit('exam:watch_attempt', attemptId);
    watchedAttemptsRef.current.add(attemptId);
    console.log(`👁️ Watching attempt: ${attemptId} (socket connected: ${socketRef.current.connected})`);
  };

  // Fetch students and filter options
  useEffect(() => {
    if (showExamModal) {
      fetchStudents();
      fetchFilterOptions();
      fetchStudentGroups();
      // Fetch topics and questions when exam modal opens
      fetchTopics();
      fetchQuestions();
    }
  }, [showExamModal, classFilter, facultyFilter, majorFilter, statusFilter, sortField, sortOrder, currentPage, pageSize]);

  // Fetch topics and questions when questions tab is selected
  useEffect(() => {
    if (showExamModal && examModalTab === 'questions') {
      fetchTopics();
      fetchQuestions();
    }
  }, [showExamModal, examModalTab]);

  // Fetch students by group when group filter changes
  useEffect(() => {
    if (useGroupMode && groupFilter && showExamModal) {
      if (editMode) {
        // In edit mode, fetch but preserve selected students
        fetchStudentsByGroup(true);
      } else {
        // In create mode, fetch and auto-select
        fetchStudentsByGroup(false);
      }
    } else if (!useGroupMode || !groupFilter) {
      // Only clear if not in edit mode (edit mode will set selectedStudents from participants)
      if (!editMode) {
        setSelectedStudents([]);
      }
    }
  }, [groupFilter, useGroupMode, showExamModal, editMode]);

  const fetchExams = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (filters.search) params.append('search', filters.search);
      if (filters.exam_type) params.append('exam_type', filters.exam_type);
      if (filters.status) params.append('status', filters.status);
      if (filters.class_name) params.append('class_name', filters.class_name);
      if (filters.date_from) params.append('date_from', filters.date_from);
      if (filters.date_to) params.append('date_to', filters.date_to);

      const response = await api.get(`/lms/exams?${params.toString()}`);

      const examsData = response.data?.data;
      let examsList = [];
      if (examsData && Array.isArray(examsData.exams)) {
        examsList = examsData.exams;
      } else if (Array.isArray(examsData)) {
        examsList = examsData;
      }

      // Map attempts_allowed to max_attempts for consistency with form
      const mappedExams = examsList.map(exam => ({
        ...exam,
        max_attempts: exam.max_attempts || exam.attempts_allowed || 1
      }));

      setExams(mappedExams);
    } catch (error) {
      console.error('Error fetching exams:', error);
      if (error.response?.status === 403) {
        showAlertMessage('Bạn không có quyền truy cập dữ liệu này. Chỉ quyền Khảo thí & Đảm bảo chất lượng (lms_qa) và Quản lý LMS (lms_mod) mới có quyền.', 'danger');
      } else {
        showAlertMessage('Lỗi khi tải danh sách kỳ thi', 'danger');
      }
      setExams([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchQuestions = async () => {
    try {
      // Only fetch approved questions for exam creation/editing
      const response = await api.get('/lms/questions', {
        params: {
          approval_status: 'approved'
        }
      });

      const questionsData = response.data?.data;
      if (Array.isArray(questionsData)) {
        setQuestions(questionsData);
      } else if (questionsData && Array.isArray(questionsData.questions)) {
        setQuestions(questionsData.questions);
      } else {
        setQuestions([]);
      }
    } catch (error) {
      console.error('Error fetching questions:', error);
      setQuestions([]);
    }
  };

  const fetchTopics = async () => {
    try {
      // Only fetch topics that have at least one approved question for exam creation/editing
      // Include statistics to get question_count for each topic
      const response = await api.get('/lms/question-topics', {
        params: {
          only_with_approved_questions: true,
          with_statistics: true
        }
      });

      const topicsData = response.data?.data;
      let topicsList = [];
      if (Array.isArray(topicsData)) {
        topicsList = topicsData;
      } else if (topicsData && Array.isArray(topicsData.topics)) {
        topicsList = topicsData.topics;
      }

      // Fetch remaining questions from question sets usage API
      if (topicsList.length > 0) {
        try {
          const topicIds = topicsList.map(t => t.topic_id).join(',');
          const usageResponse = await api.get('/lms/question-sets/usage', {
            params: {
              topic_ids: topicIds
            }
          });

          const usageStats = usageResponse.data?.data || [];
          // Merge remaining_questions into topics
          const topicsWithRemaining = topicsList.map(topic => {
            const usageStat = usageStats.find(s => s.topic_id === topic.topic_id || s.topic_id === parseInt(topic.topic_id));
            return {
              ...topic,
              remaining_questions: usageStat ? (usageStat.remaining_questions || 0) : (topic.approved_count || 0)
            };
          });
          setTopics(topicsWithRemaining);
        } catch (usageError) {
          console.error('Error fetching question sets usage:', usageError);
          // Fallback to topics without remaining_questions
          setTopics(topicsList);
        }
      } else {
        setTopics([]);
      }
    } catch (error) {
      console.error('Error fetching topics:', error);
      setTopics([]);
    }
  };

  // Fetch exam regulation for management
  const fetchExamRegulation = async () => {
    try {
      const response = await api.get('/lms/exam-regulation/manage');
      if (response.data.success) {
        if (response.data.data) {
          const regulation = response.data.data;
          
          // Helper function to format datetime for datetime-local input
          const formatDateTimeLocal = (datetime) => {
            if (!datetime) return '';
            try {
              // Handle different datetime formats from database
              let date = null;
              if (typeof datetime === 'string') {
                // Try parsing different formats
                if (datetime.includes('T')) {
                  // ISO format: 2024-01-01T10:30:00 or 2024-01-01T10:30:00.000Z
                  date = new Date(datetime);
                } else if (datetime.includes(' ')) {
                  // MySQL format: 2024-01-01 10:30:00
                  date = new Date(datetime.replace(' ', 'T'));
                } else {
                  date = new Date(datetime);
                }
              } else if (datetime instanceof Date) {
                date = datetime;
              }
              
              if (date && !isNaN(date.getTime())) {
                // Format as YYYY-MM-DDTHH:mm for datetime-local input
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                return `${year}-${month}-${day}T${hours}:${minutes}`;
              }
            } catch (e) {
              console.error('Error formatting datetime:', e);
            }
            return '';
          };
          
          setRegulationForm({
            title: regulation.title || '',
            description: regulation.description || '',
            is_active: regulation.is_active === 1 || regulation.is_active === true,
            reading_time_seconds: regulation.reading_time_seconds || 30,
            display_from: formatDateTimeLocal(regulation.display_from),
            display_until: formatDateTimeLocal(regulation.display_until),
            require_read_each_time: regulation.require_read_each_time === 1 || regulation.require_read_each_time === true
          });
          setRegulationId(regulation.regulation_id);
        } else {
          // No regulation exists, reset to default
          setRegulationForm({
            title: '',
            description: '',
            is_active: false,
            reading_time_seconds: 30,
            display_from: '',
            display_until: '',
            require_read_each_time: false
          });
          setRegulationId(null);
        }
      }
    } catch (error) {
      console.error('Error fetching exam regulation:', error);
      showAlert('Lỗi khi tải quy chế thi', 'danger');
    }
  };

  // Save exam regulation
  const handleSaveRegulation = async () => {
    try {
      setLoadingRegulation(true);
      const response = await api.post('/lms/exam-regulation', regulationForm);
      if (response.data.success) {
        showAlert('Lưu quy chế thi thành công', 'success');
        // Fetch updated data from server to ensure consistency
        await fetchExamRegulation();
        if (response.data.data?.regulation_id) {
          setRegulationId(response.data.data.regulation_id);
        }
      }
    } catch (error) {
      console.error('Error saving exam regulation:', error);
      showAlert(error.response?.data?.message || 'Lỗi khi lưu quy chế thi', 'danger');
    } finally {
      setLoadingRegulation(false);
    }
  };

  // Fetch confirmations filter options (classes and groups)
  const fetchConfirmationFilterOptions = async () => {
    try {
      // Get current regulationId first
      let currentRegulationId = regulationId;
      if (!currentRegulationId) {
        try {
          const regResponse = await api.get('/lms/exam-regulation/manage');
          if (regResponse.data.success && regResponse.data.data) {
            currentRegulationId = regResponse.data.data.regulation_id;
            setRegulationId(currentRegulationId);
          } else {
            return;
          }
        } catch (error) {
          console.error('Error fetching regulation for filter options:', error);
          return;
        }
      }

      // Fetch classes from confirmations (get all to extract unique classes)
      try {
        const confirmResponse = await api.get('/lms/exam-regulation/confirmations', {
          params: {
            regulation_id: currentRegulationId,
            limit: 10000
          }
        });
        
        if (confirmResponse.data.success && Array.isArray(confirmResponse.data.data)) {
          const allConfirmations = confirmResponse.data.data;
          // Extract unique classes
          const uniqueClasses = [...new Set(allConfirmations
            .map(c => c.class_name)
            .filter(c => c))].sort();
          setConfirmationClasses(uniqueClasses);
        }
      } catch (error) {
        console.error('Error fetching confirmations for classes:', error);
        setConfirmationClasses([]);
      }
      
      // Fetch groups
      try {
        const groupsResponse = await api.get('/student-groups');
        if (groupsResponse.data && groupsResponse.data.success && Array.isArray(groupsResponse.data.data)) {
          setConfirmationGroups(groupsResponse.data.data);
        } else if (Array.isArray(groupsResponse.data)) {
          setConfirmationGroups(groupsResponse.data);
        } else if (groupsResponse.data && Array.isArray(groupsResponse.data.data)) {
          setConfirmationGroups(groupsResponse.data.data);
        } else {
          setConfirmationGroups([]);
        }
      } catch (error) {
        console.error('Error fetching groups:', error);
        setConfirmationGroups([]);
      }
    } catch (error) {
      console.error('Error fetching confirmation filter options:', error);
    }
  };

  // Fetch confirmations
  const fetchConfirmations = async (page = 1) => {
    // Use current regulationId or fetch the latest regulation first
    let currentRegulationId = regulationId;
    if (!currentRegulationId) {
      try {
        const regResponse = await api.get('/lms/exam-regulation/manage');
        if (regResponse.data.success && regResponse.data.data) {
          currentRegulationId = regResponse.data.data.regulation_id;
          setRegulationId(currentRegulationId);
        } else {
          // No regulation exists yet
          return;
        }
      } catch (error) {
        console.error('Error fetching regulation for confirmations:', error);
        return;
      }
    }
    
    if (!currentRegulationId) return;
    
    try {
      setLoadingConfirmations(true);
      const params = {
        regulation_id: currentRegulationId,
        page,
        limit: confirmationsPagination.limit
      };
      if (confirmationsSearch) {
        params.search = confirmationsSearch;
      }
      if (confirmationsClassFilter) {
        params.class_name = confirmationsClassFilter;
      }
      if (confirmationsGroupFilter) {
        params.group_id = confirmationsGroupFilter;
      }
      
      const response = await api.get('/lms/exam-regulation/confirmations', { params });
      if (response.data.success) {
        setConfirmations(response.data.data);
        setConfirmationsPagination({
          ...confirmationsPagination,
          page: response.data.pagination.page,
          total: response.data.pagination.total,
          totalPages: response.data.pagination.totalPages
        });
      }
    } catch (error) {
      console.error('Error fetching confirmations:', error);
      showAlert('Lỗi khi tải danh sách xác nhận', 'danger');
    } finally {
      setLoadingConfirmations(false);
    }
  };

  // Handle delete confirmation
  const handleDeleteConfirmation = async (confirmation) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa bản xác nhận của ${confirmation.full_name || confirmation.student_id || 'sinh viên này'}?`)) {
      return;
    }

    try {
      await api.delete(`/lms/exam-regulation/confirmations/${confirmation.confirmation_id}`);
      showAlert('Xóa bản xác nhận thành công', 'success');
      fetchConfirmations(confirmationsPagination.page);
    } catch (error) {
      console.error('Error deleting confirmation:', error);
      showAlert(error.response?.data?.message || 'Lỗi khi xóa bản xác nhận', 'danger');
    }
  };

  // Handle open regulation modal
  const handleOpenRegulationModal = async () => {
    await fetchExamRegulation();
    setShowRegulationModal(true);
    setRegulationModalTab('basic');
    // Fetch confirmations will be triggered when switching to confirmations tab
  };


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
        const fetchedStudents = response.data.data;
        setStudents(fetchedStudents);
        setTotalStudents(response.data.pagination?.totalItems || fetchedStudents.length);
        return fetchedStudents;
      }
      return [];
    } catch (error) {
      console.error('Error fetching students:', error);
      setStudents([]);
      return [];
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const response = await api.get('/users/filter-options');
      if (response.data.success) {
        setClasses(response.data.classes?.map(c => c.name) || []);
        setFaculties(response.data.faculties?.map(f => f.name) || []);
        setMajors(response.data.majors?.map(m => m.name) || []);
      }
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  const fetchFilterClasses = async () => {
    try {
      // Fetch unique classes from exams
      const response = await api.get('/lms/exams');
      const examsData = response.data?.data;
      let examsList = [];
      if (examsData && Array.isArray(examsData.exams)) {
        examsList = examsData.exams;
      } else if (Array.isArray(examsData)) {
        examsList = examsData;
      }
      
      // Extract unique class names from exams
      const uniqueClasses = [...new Set(
        examsList
          .map(exam => exam.participant_class_name || exam.class_name)
          .filter(Boolean)
          .flatMap(classNames => classNames.split(', '))
      )].sort();
      
      setFilterClasses(uniqueClasses);
    } catch (error) {
      console.error('Error fetching filter classes:', error);
      setFilterClasses([]);
    }
  };

  const fetchStudentGroups = async () => {
    try {
      const response = await api.get('/student-groups');
      if (response.data && response.data.success) {
        setStudentGroups(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching student groups:', error);
    }
  };

  const fetchStudentsByGroup = async (preserveSelected = false) => {
    try {
      const response = await api.get(`/student-groups/${groupFilter}`);
      if (response.data && response.data.success) {
        const groupStudents = response.data.data.students || [];
        setStudents(groupStudents);
        setTotalStudents(groupStudents.length);
        // Only auto-select if not preserving (i.e., not in edit mode)
        if (!preserveSelected) {
          setSelectedStudents(groupStudents);
        }
        return groupStudents;
      }
      return [];
    } catch (error) {
      console.error('Error fetching students by group:', error);
      return [];
    }
  };

  // Helper function to fetch cheating logs for attempts
  const fetchCheatingLogsForAttempts = async (attempts) => {
    const allCheatingLogs = [];
    for (const attempt of attempts) {
      if (attempt.attempt_id && attempt.cheating_events_count > 0) {
        try {
          const logsResponse = await api.get(`/lms/attempts/${attempt.attempt_id}/cheating-logs`);
          const logs = logsResponse.data.data || [];
          // Add student info to each log
          logs.forEach(log => {
            allCheatingLogs.push({
              ...log,
              student_name: attempt.student_name,
              student_id: attempt.student_id,
              attempt_id: attempt.attempt_id
            });
          });
        } catch (error) {
          console.debug(`Error fetching cheating logs for attempt ${attempt.attempt_id}:`, error);
        }
      }
    }

    // Sort by event_time descending
    allCheatingLogs.sort((a, b) => new Date(b.event_time) - new Date(a.event_time));

    // Only update if cheating logs changed
    setCheatingLogs(currentLogs => {
      if (hasCheatingLogsChanged(currentLogs, allCheatingLogs)) {
        return allCheatingLogs;
      }
      return currentLogs;
    });
  };

  const fetchMonitoringData = async () => {
    if (!selectedExam) return;

    try {
      setLoading(true);
      const response = await api.get(`/lms/exams/${selectedExam.exam_id}/monitoring`);

      const attempts = response.data.data || [];
      setMonitoringData(attempts);

      // Fetch all cheating logs for all attempts
      await fetchCheatingLogsForAttempts(attempts);
    } catch (error) {
      console.error('Error fetching monitoring data:', error);
      if (error.response?.status === 403) {
        showAlertMessage('Bạn không có quyền truy cập dữ liệu giám sát. Chỉ quyền Khảo thí & Đảm bảo chất lượng (lms_qa) và Quản lý LMS (lms_mod) mới có quyền.', 'danger');
      } else {
        showAlertMessage('Lỗi khi tải dữ liệu giám sát', 'danger');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchCheatingLogs = async (attemptId) => {
    try {
      const response = await api.get(`/lms/attempts/${attemptId}/cheating-logs`);

      const logs = response.data.data || [];

      // Find the attempt in monitoringData to get student info
      const attempt = monitoringData.find(a => a.attempt_id === attemptId);

      // Add student info to each log
      const logsWithStudentInfo = logs.map(log => ({
        ...log,
        student_name: attempt?.student_name || log.student_name || 'N/A',
        student_id: attempt?.student_id || log.student_id || 'N/A'
      }));

      setCheatingLogs(logsWithStudentInfo);
    } catch (error) {
      console.error('Error fetching cheating logs:', error);
      if (error.response?.status === 403) {
        showAlertMessage('Bạn không có quyền truy cập log gian lận. Chỉ quyền Khảo thí & Đảm bảo chất lượng (lms_qa) và Quản lý LMS (lms_mod) mới có quyền.', 'danger');
      } else {
        showAlertMessage('Lỗi khi tải log gian lận', 'danger');
      }
    }
  };

  const fetchWebcamVideo = async (attemptId) => {
    try {
      setLoadingVideo(true);
      setWebcamVideoUrl(null);

      const response = await api.get(`/lms/attempts/${attemptId}/webcam-video-url`);

      if (response.data.success && response.data.data) {
        const videoData = response.data.data;

        // If it's a local file, construct full URL
        if (videoData.type === 'local') {
          // Use the API endpoint directly
          const baseUrl = window.location.origin;
          setWebcamVideoUrl(`${baseUrl}${videoData.video_url}`);
        } else {
          // Google Drive link - use as is or convert to embed format
          setWebcamVideoUrl(videoData.video_url);
        }
      } else {
        showAlertMessage('Không tìm thấy video webcam', 'warning');
      }
    } catch (error) {
      console.error('Error fetching webcam video:', error);
      if (error.response?.status === 404) {
        showAlertMessage('Không tìm thấy video webcam cho bài làm này', 'warning');
      } else if (error.response?.status === 403) {
        showAlertMessage('Bạn không có quyền truy cập video webcam. Chỉ quyền Khảo thí & Đảm bảo chất lượng (lms_qa) và Quản lý LMS (lms_mod) mới có quyền.', 'danger');
      } else {
        showAlertMessage('Lỗi khi tải video webcam', 'danger');
      }
    } finally {
      setLoadingVideo(false);
    }
  };

  const handleCreateExam = () => {
    setEditMode(false);
    setExamForm({
      exam_title: '',
      exam_description: '',
      exam_type: 'quiz',
      course_id: null,
      total_points: 10,
      duration_minutes: 60,
      passing_score: 60,
      max_attempts: 1,
      shuffle_questions: true,
      shuffle_options: true,
      show_results_after: {
        hide_results: false,
        show_results_only: true,
        show_questions_list: false,
        show_question_result: false,
        show_question_options: false,
        show_answers: false,
        show_timestamps: false
      },
      scheduled_start: '',
      scheduled_end: '',
      appeal_deadline_days: 3,
      time_limit_type: 'fixed',
      proctoring_enabled: true,
      proctoring_type: 'none',
      ip_restrictions: '',
      lockdown_browser_required: false,
      ims_exam_pctu_required: true,
      webcam_required: true,
      webcam_config: {
        exempt_type: 'none',
        exempt_students: [],
        exempt_classes: [],
        exempt_groups: []
      },
      allow_backtrack: false,
      questions_per_page: '1',
      show_points_per_question: false,
      show_progress_bar: true,
      show_answered_count: true,
      show_page_number: true,
      instructions_title: 'Hướng dẫn',
      instructions_list: [
        'Đọc kỹ từng câu hỏi trước khi trả lời',
        'Bài thi sẽ tự động nộp khi hết thời gian',
        'Không được mở tab khác hoặc thoát trình duyệt'
      ],
      exam_password: '',
      question_selection_mode: 'random_on_exam',
      face_verification_enabled: false,
      face_verification_config: {
        exempt_type: 'none',
        exempt_students: [],
        exempt_classes: [],
        exempt_groups: []
      }
    });
    setSelectedQuestions([]);
    setSelectedStudents([]);
    setOriginalQuestionPoints([]);
    setHasRedistributedPoints(false);
    setOriginalQuestionPointsOnLoad([]);
    setClassFilter('');
    setFacultyFilter('');
    setMajorFilter('');
    setGroupFilter('');
    setUseGroupMode(false);
    // Reset blueprint
    setBlueprint({
      selected_topic_id: '',
      use_difficulty_distribution: true,
      use_bloom_distribution: false,
      easy: 0,
      medium: 0,
      hard: 0,
      expert: 0,
      remember: 0,
      understand: 0,
      apply: 0,
      analyze: 0,
      evaluate: 0,
      create: 0,
      easy_points: 0,
      medium_points: 0,
      hard_points: 0,
      expert_points: 0,
      remember_points: 0,
      understand_points: 0,
      apply_points: 0,
      analyze_points: 0,
      evaluate_points: 0,
      create_points: 0,
      topics: []
    });
    setExamModalTab('basic'); // Reset về tab đầu tiên
    setShowExamModal(true);
  };

  const handleEditExam = async (exam) => {
    setEditMode(true);
    setSelectedExam(exam);

    try {
      const response = await api.get(`/lms/exams/${exam.exam_id}`);

      const fullExam = response.data.data;

      // Map available_from/available_until to scheduled_start/scheduled_end for frontend
      // Format datetime for datetime-local input (YYYY-MM-DDTHH:mm)
      // IMPORTANT: Parse string directly without using new Date() to avoid timezone conversion
      const formatDateTimeForInput = (datetime) => {
        if (!datetime) return '';
        
        // If it's already in datetime-local format (YYYY-MM-DDTHH:mm), return as is
        if (typeof datetime === 'string' && datetime.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
          return datetime;
        }
        
        // If it's a string in ISO format (YYYY-MM-DDTHH:mm:ss), extract date and time parts
        if (typeof datetime === 'string') {
          // Handle ISO format: "2025-12-23T08:06:00" or "2025-12-23T08:06:00.000Z"
          const match = datetime.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
          if (match) {
            const [, year, month, day, hours, minutes] = match;
            return `${year}-${month}-${day}T${hours}:${minutes}`;
          }
          
          // Handle MySQL format: "2025-12-23 08:06:00"
          const mysqlMatch = datetime.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/);
          if (mysqlMatch) {
            const [, year, month, day, hours, minutes] = mysqlMatch;
            return `${year}-${month}-${day}T${hours}:${minutes}`;
          }
        }
        
        // Fallback: use Date object (may cause timezone issues, but handles edge cases)
        const date = new Date(datetime);
        if (isNaN(date.getTime())) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
      };

      // Chỉ load questions nếu mode không phải "on_exam"
      const questionSelectionMode = fullExam.question_selection_mode || 'first_on_create';
      const examQuestions = fullExam.questions || [];

      // Calculate total_points from questions if mode is "on_create" and questions exist
      // This ensures accurate total_points even if backend value is outdated
      let calculatedTotalPoints = parseFloat(fullExam.total_points) || 100;
      if ((questionSelectionMode === 'first_on_create' || questionSelectionMode === 'random_on_create') &&
        examQuestions.length > 0) {
        calculatedTotalPoints = examQuestions.reduce((sum, q) => sum + (parseFloat(q.points) || 0), 0);
      }

      // Ensure calculatedTotalPoints is a valid number
      if (isNaN(calculatedTotalPoints) || !isFinite(calculatedTotalPoints)) {
        calculatedTotalPoints = 100;
      }

      setExamForm({
        exam_title: fullExam.exam_title || '',
        exam_description: fullExam.description || fullExam.exam_description || '', // Map description to exam_description
        exam_type: fullExam.exam_type || 'quiz',
        course_id: fullExam.course_id || null,
        total_points: parseFloat(calculatedTotalPoints.toFixed(2)),
        duration_minutes: fullExam.duration_minutes || 60,
        passing_score: fullExam.passing_score || 60,
        max_attempts: fullExam.attempts_allowed || fullExam.max_attempts || 1, // Map attempts_allowed to max_attempts
        shuffle_questions: Boolean(fullExam.shuffle_questions === 1 || fullExam.shuffle_questions === true),
        shuffle_options: Boolean(fullExam.shuffle_options === 1 || fullExam.shuffle_options === true),
        show_results_after: (() => {
          // Parse JSON if it's a string, otherwise use as is
          if (typeof fullExam.show_results_after === 'string') {
            try {
              const parsed = JSON.parse(fullExam.show_results_after);
              return parsed;
            } catch (e) {
              // If parsing fails, check if it's an old ENUM value
              if (fullExam.show_results_after === 'never') {
                return {
                  hide_results: true,
                  show_results_only: false,
                  show_questions_list: false,
                  show_question_result: false,
                  show_question_options: false,
                  show_answers: false,
                  show_timestamps: false
                };
              } else if (fullExam.show_results_after === 'questions_list') {
                return {
                  hide_results: false,
                  show_results_only: true,
                  show_questions_list: true,
                  show_question_result: false,
                  show_question_options: false,
                  show_answers: true,
                  show_timestamps: false
                };
              } else if (fullExam.show_results_after === 'questions_list_with_timestamps') {
                return {
                  hide_results: false,
                  show_results_only: true,
                  show_questions_list: true,
                  show_question_result: false,
                  show_question_options: false,
                  show_answers: true,
                  show_timestamps: true
                };
              } else {
                // Default: show_results_only
                return {
                  hide_results: false,
                  show_results_only: true,
                  show_questions_list: false,
                  show_question_result: false,
                  show_question_options: false,
                  show_answers: false,
                  show_timestamps: false
                };
              }
            }
          }
          // If it's already an object, use it
          if (typeof fullExam.show_results_after === 'object' && fullExam.show_results_after !== null) {
            return fullExam.show_results_after;
          }
          // Default fallback
          return {
            hide_results: false,
            show_results_only: true,
            show_questions_list: false,
            show_question_result: false,
            show_question_options: false,
            show_answers: false,
            show_timestamps: false
          };
        })(),
        scheduled_start: formatDateTimeForInput(fullExam.available_from || fullExam.scheduled_start),
        scheduled_end: formatDateTimeForInput(fullExam.available_until || fullExam.scheduled_end),
        appeal_deadline_days: fullExam.appeal_deadline_days !== undefined && fullExam.appeal_deadline_days !== null ? fullExam.appeal_deadline_days : 3,
        time_limit_type: fullExam.time_limit_type || 'fixed',
        proctoring_enabled: fullExam.proctoring_enabled || true,
        proctoring_type: fullExam.proctoring_type || 'none',
        ip_restrictions: fullExam.ip_restrictions || '',
        lockdown_browser_required: fullExam.lockdown_browser_required || false,
        ims_exam_pctu_required: Boolean(fullExam.ims_exam_pctu_required === 1 || fullExam.ims_exam_pctu_required === true),
        ims_exam_pctu_config: (() => {
          if (fullExam.ims_exam_pctu_config) {
            if (typeof fullExam.ims_exam_pctu_config === 'string') {
              try {
                return JSON.parse(fullExam.ims_exam_pctu_config);
              } catch (e) {
                return {
                  exempt_type: 'none',
                  exempt_students: [],
                  exempt_classes: [],
                  exempt_groups: []
                };
              }
            }
            return fullExam.ims_exam_pctu_config;
          }
          return {
            exempt_type: 'none',
            exempt_students: [],
            exempt_classes: [],
            exempt_groups: []
          };
        })(),
        webcam_required: Boolean(fullExam.webcam_required === 1 || fullExam.webcam_required === true),
        webcam_config: (() => {
          if (fullExam.webcam_config) {
            if (typeof fullExam.webcam_config === 'string') {
              try {
                return JSON.parse(fullExam.webcam_config);
              } catch (e) {
                return {
                  exempt_type: 'none',
                  exempt_students: [],
                  exempt_classes: [],
                  exempt_groups: []
                };
              }
            }
            return fullExam.webcam_config;
          }
          return {
            exempt_type: 'none',
            exempt_students: [],
            exempt_classes: [],
            exempt_groups: []
          };
        })(),
        allow_backtrack: Boolean(fullExam.allow_backtrack === 1 || fullExam.allow_backtrack === false),
        questions_per_page: fullExam.questions_per_page || '1',
        show_points_per_question: fullExam.show_points_per_question || false,
        show_progress_bar: fullExam.show_progress_bar !== undefined ? Boolean(fullExam.show_progress_bar === 1 || fullExam.show_progress_bar === true) : true,
        show_answered_count: fullExam.show_answered_count !== undefined ? Boolean(fullExam.show_answered_count === 1 || fullExam.show_answered_count === true) : true,
        show_page_number: fullExam.show_page_number !== undefined ? Boolean(fullExam.show_page_number === 1 || fullExam.show_page_number === true) : true,
        instructions_title: fullExam.instructions_title || 'Hướng dẫn',
        instructions_list: (() => {
          if (fullExam.instructions_list) {
            if (typeof fullExam.instructions_list === 'string') {
              try {
                const parsed = JSON.parse(fullExam.instructions_list);
                return Array.isArray(parsed) && parsed.length > 0 ? parsed : [
                  'Đọc kỹ từng câu hỏi trước khi trả lời',
                  'Bài thi sẽ tự động nộp khi hết thời gian',
                  'Không được mở tab khác hoặc thoát trình duyệt'
                ];
              } catch (e) {
                return [
                  'Đọc kỹ từng câu hỏi trước khi trả lời',
                  'Bài thi sẽ tự động nộp khi hết thời gian',
                  'Không được mở tab khác hoặc thoát trình duyệt'
                ];
              }
            } else if (Array.isArray(fullExam.instructions_list) && fullExam.instructions_list.length > 0) {
              return fullExam.instructions_list;
            }
          }
          // Default fallback
          return [
            'Đọc kỹ từng câu hỏi trước khi trả lời',
            'Bài thi sẽ tự động nộp khi hết thời gian',
            'Không được mở tab khác hoặc thoát trình duyệt'
          ];
        })(),
        exam_password: fullExam.exam_password || '',
        question_selection_mode: questionSelectionMode,
        face_verification_enabled: fullExam.face_verification_enabled || false,
        face_verification_config: fullExam.face_verification_config || {
          exempt_type: 'none',
          exempt_students: [],
          exempt_classes: [],
          exempt_groups: []
        },
        email_notification_config: (() => {
          if (fullExam.email_notification_config) {
            if (typeof fullExam.email_notification_config === 'string') {
              try {
                const parsed = JSON.parse(fullExam.email_notification_config);
                // Migrate old format (send_when) to new format (checkboxes)
                if (parsed.send_when) {
                  return {
                    send_on_approval: parsed.send_when === 'on_approval',
                    send_before_start: parsed.send_when === 'before_start',
                    before_start_duration: parsed.before_start_duration || 60
                  };
                }
                return parsed;
              } catch (e) {
                return {
                  send_on_approval: false,
                  send_before_start: false,
                  before_start_duration: 60
                };
              }
            }
            // Migrate old format if it's an object
            if (fullExam.email_notification_config.send_when) {
              return {
                send_on_approval: fullExam.email_notification_config.send_when === 'on_approval',
                send_before_start: fullExam.email_notification_config.send_when === 'before_start',
                before_start_duration: fullExam.email_notification_config.before_start_duration || 60
              };
            }
            return fullExam.email_notification_config;
          }
          return {
            send_on_approval: false,
            send_before_start: false,
            before_start_duration: 60
          };
        })(),
        email_results_config: (() => {
          if (fullExam.email_results_config) {
            if (typeof fullExam.email_results_config === 'string') {
              try {
                return JSON.parse(fullExam.email_results_config);
              } catch (e) {
                return {
                  enabled: false,
                  include_results: false,
                  include_questions_list: false,
                  include_question_result: false,
                  include_question_options: false,
                  include_selected_answers: false,
                  include_timestamps: false
                };
              }
            }
            return fullExam.email_results_config;
          }
          return {
            enabled: false,
            include_results: false,
            include_questions_list: false,
            include_question_result: false,
            include_question_options: false,
            include_selected_answers: false,
            include_timestamps: false
          };
        })()
      });

      // Load blueprint_config if exists
      if (fullExam.blueprint_config) {
        try {
          const blueprintConfig = typeof fullExam.blueprint_config === 'string'
            ? JSON.parse(fullExam.blueprint_config)
            : fullExam.blueprint_config;
          
          // Check if new format (has topics array) or old format
          if (blueprintConfig.topics && Array.isArray(blueprintConfig.topics) && blueprintConfig.topics.length > 0) {
            // New format - use topics array
            setBlueprint({
              selected_topic_id: blueprintConfig.selected_topic_id || '',
              use_difficulty_distribution: blueprintConfig.use_difficulty_distribution !== false,
              use_bloom_distribution: blueprintConfig.use_bloom_distribution || false,
              easy: blueprintConfig.easy || 0,
              medium: blueprintConfig.medium || 0,
              hard: blueprintConfig.hard || 0,
              expert: blueprintConfig.expert || 0,
              remember: blueprintConfig.remember || 0,
              understand: blueprintConfig.understand || 0,
              apply: blueprintConfig.apply || 0,
              analyze: blueprintConfig.analyze || 0,
              evaluate: blueprintConfig.evaluate || 0,
              create: blueprintConfig.create || 0,
              easy_points: blueprintConfig.easy_points || 0,
              medium_points: blueprintConfig.medium_points || 0,
              hard_points: blueprintConfig.hard_points || 0,
              expert_points: blueprintConfig.expert_points || 0,
              remember_points: blueprintConfig.remember_points || 0,
              understand_points: blueprintConfig.understand_points || 0,
              apply_points: blueprintConfig.apply_points || 0,
              analyze_points: blueprintConfig.analyze_points || 0,
              evaluate_points: blueprintConfig.evaluate_points || 0,
              create_points: blueprintConfig.create_points || 0,
              topics: blueprintConfig.topics
            });
          } else {
            // Old format - convert to new format and keep backward compatibility
            const converted = convertOldBlueprintToNew(blueprintConfig);
            setBlueprint({
              selected_topic_id: blueprintConfig.selected_topic_id || '',
              use_difficulty_distribution: blueprintConfig.use_difficulty_distribution !== false,
              use_bloom_distribution: blueprintConfig.use_bloom_distribution || false,
              easy: blueprintConfig.easy || 0,
              medium: blueprintConfig.medium || 0,
              hard: blueprintConfig.hard || 0,
              expert: blueprintConfig.expert || 0,
              remember: blueprintConfig.remember || 0,
              understand: blueprintConfig.understand || 0,
              apply: blueprintConfig.apply || 0,
              analyze: blueprintConfig.analyze || 0,
              evaluate: blueprintConfig.evaluate || 0,
              create: blueprintConfig.create || 0,
              easy_points: blueprintConfig.easy_points || 0,
              medium_points: blueprintConfig.medium_points || 0,
              hard_points: blueprintConfig.hard_points || 0,
              expert_points: blueprintConfig.expert_points || 0,
              remember_points: blueprintConfig.remember_points || 0,
              understand_points: blueprintConfig.understand_points || 0,
              apply_points: blueprintConfig.apply_points || 0,
              analyze_points: blueprintConfig.analyze_points || 0,
              evaluate_points: blueprintConfig.evaluate_points || 0,
              create_points: blueprintConfig.create_points || 0,
              topics: converted.topics || []
            });
          }
        } catch (e) {
          console.error('Error parsing blueprint_config:', e);
          // Set default if error
          setBlueprint({
            selected_topic_id: '',
            use_difficulty_distribution: true,
            use_bloom_distribution: false,
            easy: 0,
            medium: 0,
            hard: 0,
            expert: 0,
            remember: 0,
            understand: 0,
            apply: 0,
            analyze: 0,
            evaluate: 0,
            create: 0,
            easy_points: 0,
            medium_points: 0,
            hard_points: 0,
            expert_points: 0,
            remember_points: 0,
            understand_points: 0,
            apply_points: 0,
            analyze_points: 0,
            evaluate_points: 0,
            create_points: 0,
            topics: []
          });
        }
      } else {
        // No blueprint config - set default
        setBlueprint({
          selected_topic_id: '',
          use_difficulty_distribution: true,
          use_bloom_distribution: false,
          easy: 0,
          medium: 0,
          hard: 0,
          expert: 0,
          remember: 0,
          understand: 0,
          apply: 0,
          analyze: 0,
          evaluate: 0,
          create: 0,
          easy_points: 0,
          medium_points: 0,
          hard_points: 0,
          expert_points: 0,
          remember_points: 0,
          understand_points: 0,
          apply_points: 0,
          analyze_points: 0,
          evaluate_points: 0,
          create_points: 0,
          topics: []
        });
      }

      if (questionSelectionMode === 'first_on_exam' || questionSelectionMode === 'random_on_exam') {
        setSelectedQuestions([]);
        setOriginalQuestionPointsOnLoad([]);
      } else {
        setSelectedQuestions(examQuestions);
        // Lưu điểm ban đầu để so sánh khi submit
        setOriginalQuestionPointsOnLoad(examQuestions.map(q => ({
          question_id: q.question_id,
          points: q.points
        })));
      }
      setOriginalQuestionPoints([]);
      setHasRedistributedPoints(false);

      // Load participants (students) if they exist
      if (fullExam.participants && fullExam.participants.length > 0) {
        // Normalize participant data to match student format
        const normalizedParticipants = fullExam.participants.map(p => ({
          id: p.id || p.user_id,
          user_id: p.user_id || p.id,
          student_id: p.student_id,
          full_name: p.full_name,
          email: p.email,
          class_name: p.class_name,
          faculty_name: p.faculty_name,
          major_name: p.major_name
        }));
        setSelectedStudents(normalizedParticipants);

        // Set group mode if enrollment type is group
        if (fullExam.useGroupMode && fullExam.selectedGroupId) {
          setUseGroupMode(true);
          setGroupFilter(fullExam.selectedGroupId.toString());
          setClassFilter(''); // Clear class filter when using group mode
          // useEffect will automatically fetch students when groupFilter changes
        } else {
          setUseGroupMode(false);
          setGroupFilter('');
          
          // Check if all participants have the same class_name, then set classFilter
          const uniqueClassNames = [...new Set(normalizedParticipants.map(p => p.class_name).filter(Boolean))];
          if (uniqueClassNames.length === 1) {
            // All participants are from the same class, set classFilter
            // useEffect will automatically fetch students when classFilter changes
            setClassFilter(uniqueClassNames[0]);
          } else {
            // Participants from different classes or no class
            setClassFilter('');
            // useEffect will automatically fetch all students
          }
        }
        
        // Ensure participants are in the students list after fetching
        // This will be handled by useEffect, but we also need to merge participants
        // Use a separate useEffect or do it after a delay
        setTimeout(() => {
          setStudents(prev => {
            const participantIds = new Set(normalizedParticipants.map(p => p.id));
            const existingIds = new Set(prev.map(s => s.id));
            const missingParticipants = normalizedParticipants.filter(p => !existingIds.has(p.id));
            return [...prev, ...missingParticipants];
          });
        }, 200); // Wait for fetch to complete
      } else {
        setSelectedStudents([]);
        setUseGroupMode(false);
        setGroupFilter('');
        // Fetch students normally
        fetchStudents();
      }

      // Fetch all classes and groups when editing to show all options (not just from selectedStudents)
      // This ensures exempt_classes and exempt_groups checkboxes are visible even if no students selected
      await fetchFilterOptions();
      await fetchStudentGroups();

      setExamModalTab('basic'); // Reset về tab đầu tiên
      setShowExamModal(true);
    } catch (error) {
      console.error('Error fetching exam details:', error);
      showAlertMessage('Lỗi khi tải chi tiết kỳ thi', 'danger');
    }
  };

  const handleSubmitExam = async (e) => {
    e.preventDefault();

    try {
      // If class or group filter is set, ensure students are fetched with the current filter
      // This ensures that when filter is changed, we use the correct students list
      if (useGroupMode && groupFilter) {
        // Fetch students from group to ensure we have the latest list
        await fetchStudentsByGroup(true);
      } else if (classFilter) {
        // Fetch students from class to ensure we have the latest list
        await fetchStudents();
      }
      
      // Calculate total_points based on selection mode
      let calculatedTotalPoints = 0;

      if (examForm.question_selection_mode === 'first_on_exam' || examForm.question_selection_mode === 'random_on_exam') {
        // For "on_exam" modes, calculate from blueprint points distribution
        if (blueprint.topics && Array.isArray(blueprint.topics) && blueprint.topics.length > 0) {
          // New format: Sum points from all topics
          blueprint.topics.forEach(topicConfig => {
            if (topicConfig.distribution_type === 'difficulty') {
              calculatedTotalPoints += (topicConfig.difficulty_distribution?.easy_points || 0) +
                                      (topicConfig.difficulty_distribution?.medium_points || 0) +
                                      (topicConfig.difficulty_distribution?.hard_points || 0) +
                                      (topicConfig.difficulty_distribution?.expert_points || 0);
            } else if (topicConfig.distribution_type === 'bloom') {
              calculatedTotalPoints += (topicConfig.bloom_distribution?.remember_points || 0) +
                                      (topicConfig.bloom_distribution?.understand_points || 0) +
                                      (topicConfig.bloom_distribution?.apply_points || 0) +
                                      (topicConfig.bloom_distribution?.analyze_points || 0) +
                                      (topicConfig.bloom_distribution?.evaluate_points || 0) +
                                      (topicConfig.bloom_distribution?.create_points || 0);
            }
          });
        } else {
          // Old format: Backward compatibility
          if (blueprint.use_difficulty_distribution) {
            calculatedTotalPoints = (blueprint.easy_points || 0) + 
                                    (blueprint.medium_points || 0) + 
                                    (blueprint.hard_points || 0) + 
                                    (blueprint.expert_points || 0);
          } else if (blueprint.use_bloom_distribution) {
            calculatedTotalPoints = (blueprint.remember_points || 0) + 
                                    (blueprint.understand_points || 0) + 
                                    (blueprint.apply_points || 0) + 
                                    (blueprint.analyze_points || 0) + 
                                    (blueprint.evaluate_points || 0) + 
                                    (blueprint.create_points || 0);
          }
        }
      } else {
        // For "on_create" modes, calculate from selectedQuestions
        calculatedTotalPoints = selectedQuestions.length > 0
          ? selectedQuestions.reduce((sum, q) => sum + (parseFloat(q.points) || 0), 0)
          : 0;
      }

      // Update examForm with calculated total_points
      const finalExamForm = {
        ...examForm,
        total_points: parseFloat(calculatedTotalPoints.toFixed(2))
      };

      // Get student IDs based on selection mode
      let studentIds = [];
      if (useGroupMode && groupFilter) {
        // If using group mode, use all students currently displayed (from the group filter)
        // This ensures that when group is changed, all students from the new group are included
        studentIds = students.map(s => s.id).filter(id => id);
      } else if (classFilter) {
        // If class filter is set, use all students currently displayed (from the class filter)
        // This ensures that when class is changed, all students from the new class are included
        studentIds = students.map(s => s.id).filter(id => id);
      } else {
        // Otherwise use selected students (manual selection, no filter)
        studentIds = selectedStudents.map(s => s.id).filter(id => id);
      }

      // Map scheduled_start/scheduled_end to available_from/available_until for backend
      const formatDateTimeForBackend = (datetimeLocal) => {
        if (!datetimeLocal) return null;
        // datetime-local format: YYYY-MM-DDTHH:mm
        // Convert to ISO string: YYYY-MM-DDTHH:mm:ss
        return datetimeLocal ? `${datetimeLocal}:00` : null;
      };

      const examData = {
        exam_title: finalExamForm.exam_title,
        description: finalExamForm.exam_description, // Map exam_description to description
        exam_type: finalExamForm.exam_type,
        course_id: finalExamForm.course_id,
        total_points: finalExamForm.total_points,
        duration_minutes: finalExamForm.duration_minutes,
        passing_score: finalExamForm.passing_score,
        attempts_allowed: finalExamForm.max_attempts, // Map max_attempts to attempts_allowed
        shuffle_questions: finalExamForm.shuffle_questions,
        shuffle_options: finalExamForm.shuffle_options,
        show_results_after: finalExamForm.show_results_after,
        available_from: formatDateTimeForBackend(finalExamForm.scheduled_start),
        available_until: formatDateTimeForBackend(finalExamForm.scheduled_end),
        appeal_deadline_days: finalExamForm.appeal_deadline_days !== undefined && finalExamForm.appeal_deadline_days !== null ? parseInt(finalExamForm.appeal_deadline_days) : 3,
        proctoring_enabled: finalExamForm.proctoring_enabled,
        proctoring_type: finalExamForm.proctoring_type,
        ip_restrictions: finalExamForm.ip_restrictions || null,
        lockdown_browser_required: finalExamForm.lockdown_browser_required,
        ims_exam_pctu_required: finalExamForm.ims_exam_pctu_required,
        ims_exam_pctu_config: JSON.stringify(finalExamForm.ims_exam_pctu_config || {
          exempt_type: 'none',
          exempt_students: [],
          exempt_classes: [],
          exempt_groups: []
        }),
        webcam_required: finalExamForm.webcam_required,
        webcam_config: JSON.stringify(finalExamForm.webcam_config || {
          exempt_type: 'none',
          exempt_students: [],
          exempt_classes: [],
          exempt_groups: []
        }),
        allow_backtrack: finalExamForm.allow_backtrack,
        questions_per_page: finalExamForm.questions_per_page || 'all',
        show_points_per_question: finalExamForm.show_points_per_question || false,
        show_progress_bar: finalExamForm.show_progress_bar !== undefined ? finalExamForm.show_progress_bar : true,
        show_answered_count: finalExamForm.show_answered_count !== undefined ? finalExamForm.show_answered_count : true,
        show_page_number: finalExamForm.show_page_number !== undefined ? finalExamForm.show_page_number : true,
        instructions_title: finalExamForm.instructions_title || 'Hướng dẫn',
        instructions_list: JSON.stringify(finalExamForm.instructions_list || []),
        exam_password: finalExamForm.exam_password || null,
        question_selection_mode: finalExamForm.question_selection_mode || 'first_on_create',
        face_verification_enabled: finalExamForm.face_verification_enabled || false,
        face_verification_config: finalExamForm.face_verification_config || null,
        email_notification_config: JSON.stringify(finalExamForm.email_notification_config || {
          send_on_approval: false,
          send_before_start: false,
          before_start_duration: 60
        }),
        email_results_config: (() => {
          const config = {
            enabled: finalExamForm.email_results_config?.enabled || false,
            include_results: finalExamForm.email_results_config?.include_results || false,
            include_questions_list: finalExamForm.email_results_config?.include_questions_list || false,
            include_question_result: finalExamForm.email_results_config?.include_question_result || false,
            include_question_options: finalExamForm.email_results_config?.include_question_options || false,
            include_selected_answers: finalExamForm.email_results_config?.include_selected_answers || false,
            include_timestamps: finalExamForm.email_results_config?.include_timestamps || false
          };
          console.log('Submitting email_results_config:', config);
          return JSON.stringify(config);
        })(),
        // Nếu mode là "on_exam", không gửi danh sách câu hỏi (sẽ được chọn khi thi)
        // Nhưng cần gửi blueprint_config để backend biết cách chọn câu hỏi
        questions: (finalExamForm.question_selection_mode === 'first_on_exam' || finalExamForm.question_selection_mode === 'random_on_exam') ? [] : selectedQuestions,
        blueprint_config: (finalExamForm.question_selection_mode === 'first_on_exam' || finalExamForm.question_selection_mode === 'random_on_exam') ? (() => {
          // Check if using new multi-topic format
          if (blueprint.topics && Array.isArray(blueprint.topics) && blueprint.topics.length > 0) {
            // New format: Send topics array
            return {
              topics: blueprint.topics,
              // Keep old fields for backward compatibility (but they will be ignored if topics array exists)
              selected_topic_id: null,
              use_difficulty_distribution: false,
              use_bloom_distribution: false
            };
          } else {
            // Old format: Backward compatibility
            return {
              selected_topic_id: blueprint.selected_topic_id || '',
              use_difficulty_distribution: blueprint.use_difficulty_distribution,
              use_bloom_distribution: blueprint.use_bloom_distribution,
              easy: blueprint.easy || 0,
              medium: blueprint.medium || 0,
              hard: blueprint.hard || 0,
              expert: blueprint.expert || 0,
              remember: blueprint.remember || 0,
              understand: blueprint.understand || 0,
              apply: blueprint.apply || 0,
              analyze: blueprint.analyze || 0,
              evaluate: blueprint.evaluate || 0,
              create: blueprint.create || 0,
              easy_points: blueprint.easy_points || 0,
              medium_points: blueprint.medium_points || 0,
              hard_points: blueprint.hard_points || 0,
              expert_points: blueprint.expert_points || 0,
              remember_points: blueprint.remember_points || 0,
              understand_points: blueprint.understand_points || 0,
              apply_points: blueprint.apply_points || 0,
              analyze_points: blueprint.analyze_points || 0,
              evaluate_points: blueprint.evaluate_points || 0,
              create_points: blueprint.create_points || 0,
              topics: []
            };
          }
        })() : null,
        studentIds: studentIds,
        useGroupMode: useGroupMode,
        selectedGroupId: groupFilter || null
      };

      // Refresh CSRF token before making the request
      await refreshCSRFToken();

      if (editMode && selectedExam) {
        await api.put(`/lms/exams/${selectedExam.exam_id}`, examData);
        showAlertMessage('Cập nhật kỳ thi thành công', 'success');
      } else {
        await api.post('/lms/exams', examData);
        showAlertMessage('Tạo kỳ thi thành công', 'success');
      }

      // Cập nhật điểm vào database cho các câu hỏi đã thay đổi (chỉ khi submit)
      if (selectedQuestions.length > 0) {
        // Chỉ cập nhật những câu hỏi có điểm thay đổi
        const questionsToUpdate = selectedQuestions.filter(q => {
          if (!q.question_id) return false;
          // So sánh với điểm ban đầu (nếu có) hoặc luôn cập nhật nếu là exam mới
          if (editMode && originalQuestionPointsOnLoad.length > 0) {
            const original = originalQuestionPointsOnLoad.find(op => op.question_id === q.question_id);
            return !original || original.points !== q.points;
          }
          // Nếu là exam mới, luôn cập nhật
          return true;
        });

        if (questionsToUpdate.length > 0) {
          const updatePromises = questionsToUpdate.map(async (q) => {
            try {
              // Chỉ cập nhật điểm vào bảng lms_questions
              await api.put(`/lms/questions/${q.question_id}`, {
                points: q.points
              });
              return { success: true, question_id: q.question_id };
            } catch (error) {
              console.error(`Error updating question ${q.question_id} points:`, error);
              return { success: false, question_id: q.question_id, error };
            }
          });

          // Chạy song song nhưng không chặn UI
          Promise.all(updatePromises).then(results => {
            const failedUpdates = results.filter(r => !r.success);
            if (failedUpdates.length > 0) {
              console.warn('Some questions failed to update points:', failedUpdates);
              // Không hiển thị alert để không làm phiền user
            } else {
              // Cập nhật danh sách questions để đồng bộ với QuestionBank
              setQuestions(prevQuestions => {
                return prevQuestions.map(prevQ => {
                  const updated = questionsToUpdate.find(q => q.question_id === prevQ.question_id);
                  return updated ? { ...prevQ, points: updated.points } : prevQ;
                });
              });
            }
          }).catch(error => {
            console.error('Error updating questions points:', error);
          });
        }
      }

      setShowExamModal(false);
      fetchExams();
    } catch (error) {
      console.error('Error saving exam:', error);
      showAlertMessage(error.response?.data?.message || 'Lỗi khi lưu kỳ thi', 'danger');
    }
  };

  const handleDeleteExam = (examId) => {
    const lmsRole = getLMSRole();

    // lms_qa và lms_mod có quyền xóa
    if (lmsRole === 'lms_qa' || lmsRole === 'lms_mod') {
      const exam = exams.find(e => e.exam_id === examId);
      setExamToDelete(exam);
      setShowDeleteConfirmModal(true);
    }
  };

  const confirmDeleteExam = async () => {
    if (!examToDelete) return;

    try {
      await api.delete(`/lms/exams/${examToDelete.exam_id}`);
      showAlertMessage('Xóa kỳ thi thành công', 'success');
      setShowDeleteConfirmModal(false);
      setExamToDelete(null);
      fetchExams();
    } catch (error) {
      console.error('Error deleting exam:', error);
      showAlertMessage(error.response?.data?.message || 'Lỗi khi xóa kỳ thi', 'danger');
    }
  };

  const handleApproveExam = async (examId) => {
    try {
      // Refresh CSRF token before making the request
      await refreshCSRFToken();
      await api.put(`/lms/exams/${examId}/approve`, {});
      showAlertMessage('Duyệt đề thi thành công', 'success');
      fetchExams();
    } catch (error) {
      console.error('Error approving exam:', error);
      showAlertMessage('Lỗi khi duyệt đề thi', 'danger');
    }
  };


  const handleShowMonitoring = async (exam) => {
    setSelectedExam(exam);
    setActiveTab('monitoring');
    await fetchMonitoringData();
    setShowMonitoringModal(true);
  };

  const handleShowBlueprint = async (exam) => {
    setSelectedExam(exam);
    await fetchQuestions();
    await fetchTopics();

    // If editing an existing exam, load current questions and calculate distribution
    if (exam.exam_id) {
      try {
        const response = await api.get(`/lms/exams/${exam.exam_id}`);
        const fullExam = response.data.data;
        const examQuestions = fullExam.questions || [];

        if (examQuestions.length > 0) {
          // Calculate distribution from existing questions
          const distribution = {
            selected_topic_id: '',
            use_difficulty_distribution: true,
            use_bloom_distribution: false,
            easy: 0,
            medium: 0,
            hard: 0,
            expert: 0,
            remember: 0,
            understand: 0,
            apply: 0,
            analyze: 0,
            evaluate: 0,
            create: 0
          };

          // Count by difficulty
          let difficultyCount = 0;
          examQuestions.forEach(q => {
            if (q.difficulty_level === 'easy') { distribution.easy++; difficultyCount++; }
            else if (q.difficulty_level === 'medium') { distribution.medium++; difficultyCount++; }
            else if (q.difficulty_level === 'hard') { distribution.hard++; difficultyCount++; }
            else if (q.difficulty_level === 'expert') { distribution.expert++; difficultyCount++; }

            // Count by Bloom's Taxonomy
            if (q.bloom_level === 'remember') distribution.remember++;
            else if (q.bloom_level === 'understand') distribution.understand++;
            else if (q.bloom_level === 'apply') distribution.apply++;
            else if (q.bloom_level === 'analyze') distribution.analyze++;
            else if (q.bloom_level === 'evaluate') distribution.evaluate++;
            else if (q.bloom_level === 'create') distribution.create++;
          });

          // Determine which distribution method is being used
          const bloomCount = distribution.remember + distribution.understand + distribution.apply +
            distribution.analyze + distribution.evaluate + distribution.create;

          // If both have counts, prefer difficulty (default). If only Bloom has counts, use Bloom
          if (difficultyCount === 0 && bloomCount > 0) {
            distribution.use_difficulty_distribution = false;
            distribution.use_bloom_distribution = true;
          }

          // Set topic if all questions are from the same topic
          if (examQuestions.length > 0) {
            const firstTopicId = examQuestions[0].topic_id;
            const allSameTopic = examQuestions.every(q => q.topic_id === firstTopicId);
            if (allSameTopic && firstTopicId) {
              distribution.selected_topic_id = firstTopicId;
            }
          }

          setBlueprint(distribution);
        } else {
          // Reset blueprint if no questions
          setBlueprint({
            selected_topic_id: '',
            use_difficulty_distribution: true,
            use_bloom_distribution: false,
            easy: 0,
            medium: 0,
            hard: 0,
            expert: 0,
            remember: 0,
            understand: 0,
            apply: 0,
            analyze: 0,
            evaluate: 0,
            create: 0,
            easy_points: 0,
            medium_points: 0,
            hard_points: 0,
            expert_points: 0,
            remember_points: 0,
            understand_points: 0,
            apply_points: 0,
            analyze_points: 0,
            evaluate_points: 0,
            create_points: 0
          });
        }
      } catch (error) {
        console.error('Error loading exam questions:', error);
        // Reset blueprint on error
        setBlueprint({
          selected_topic_id: '',
          use_difficulty_distribution: true,
          use_bloom_distribution: false,
          easy: 0,
          medium: 0,
          hard: 0,
          expert: 0,
          remember: 0,
          understand: 0,
          apply: 0,
          analyze: 0,
          evaluate: 0,
          create: 0,
          easy_points: 0,
          medium_points: 0,
          hard_points: 0,
          expert_points: 0,
          remember_points: 0,
          understand_points: 0,
          apply_points: 0,
          analyze_points: 0,
          evaluate_points: 0,
          create_points: 0
        });
      }
    } else {
      // Reset blueprint for new exam
      setBlueprint({
        selected_topic_id: '',
        use_difficulty_distribution: true,
        use_bloom_distribution: false,
        easy: 0,
        medium: 0,
        hard: 0,
        expert: 0,
        remember: 0,
        understand: 0,
        apply: 0,
        analyze: 0,
        evaluate: 0,
        create: 0,
        easy_points: 0,
        medium_points: 0,
        hard_points: 0,
        expert_points: 0,
        remember_points: 0,
        understand_points: 0,
        apply_points: 0,
        analyze_points: 0,
        evaluate_points: 0,
        create_points: 0,
        topics: []
      });
    }

    setShowBlueprintModal(true);
  };

  // Helper functions for multi-topic blueprint
  
  // Create default topic configuration
  const createDefaultTopicConfig = (topicId, topicName) => {
    return {
      topic_id: topicId,
      topic_name: topicName,
      total_questions: 0,
      distribution_type: 'difficulty', // 'difficulty' or 'bloom'
      random_type: 'all', // 'all' (Random tất cả) or 'fixed' (Random cố định)
      difficulty_distribution: {
        easy: 0,
        medium: 0,
        hard: 0,
        expert: 0,
        easy_points: 0,
        medium_points: 0,
        hard_points: 0,
        expert_points: 0
      },
      bloom_distribution: {
        remember: 0,
        understand: 0,
        apply: 0,
        analyze: 0,
        evaluate: 0,
        create: 0,
        remember_points: 0,
        understand_points: 0,
        apply_points: 0,
        analyze_points: 0,
        evaluate_points: 0,
        create_points: 0
      }
    };
  };

  // Add topic to blueprint
  const addTopicToBlueprint = (topicId) => {
    const topic = topics.find(t => t.topic_id === topicId);
    if (!topic) return;

    const topicConfig = createDefaultTopicConfig(topicId, topic.topic_name || topic.topic_code);
    
    setBlueprint(prev => {
      // Check if topic already exists
      if (prev.topics && prev.topics.find(t => t.topic_id === topicId)) {
        return prev;
      }
      
      return {
        ...prev,
        topics: [...(prev.topics || []), topicConfig]
      };
    });
  };

  // Remove topic from blueprint
  const removeTopicFromBlueprint = (topicId) => {
    setBlueprint(prev => ({
      ...prev,
      topics: (prev.topics || []).filter(t => t.topic_id !== topicId)
    }));
  };

  // Update topic configuration
  const updateTopicConfig = (topicId, updates) => {
    setBlueprint(prev => ({
      ...prev,
      topics: (prev.topics || []).map(topic => 
        topic.topic_id === topicId ? { ...topic, ...updates } : topic
      )
    }));
  };

  // Calculate average points for a specific topic and filter
  const calculateAveragePointsForTopic = (topicId, filterType, filterValue) => {
    let filteredQuestions = questions.filter(q => 
      q.topic_id === parseInt(topicId) || q.topic_id === topicId
    );

    let matchingQuestions = [];
    if (filterType === 'difficulty') {
      matchingQuestions = filteredQuestions.filter(q => {
        const questionDifficulty = q.difficulty_level || q.difficulty;
        return questionDifficulty === filterValue;
      });
    } else if (filterType === 'bloom') {
      matchingQuestions = filteredQuestions.filter(q => q.bloom_level === filterValue);
    }

    if (matchingQuestions.length === 0) {
      return 1;
    }

    const totalPoints = matchingQuestions.reduce((sum, q) => {
      const points = parseFloat(q.points) || parseFloat(q.default_points) || 1;
      return sum + points;
    }, 0);

    return totalPoints / matchingQuestions.length;
  };

  // Validate topic configuration
  const validateTopicConfig = (topicConfig) => {
    let errors = [];
    
    // Check total questions matches distribution
    let totalFromDistribution = 0;
    if (topicConfig.distribution_type === 'difficulty') {
      totalFromDistribution = 
        (topicConfig.difficulty_distribution?.easy || 0) +
        (topicConfig.difficulty_distribution?.medium || 0) +
        (topicConfig.difficulty_distribution?.hard || 0) +
        (topicConfig.difficulty_distribution?.expert || 0);
    } else if (topicConfig.distribution_type === 'bloom') {
      totalFromDistribution = 
        (topicConfig.bloom_distribution?.remember || 0) +
        (topicConfig.bloom_distribution?.understand || 0) +
        (topicConfig.bloom_distribution?.apply || 0) +
        (topicConfig.bloom_distribution?.analyze || 0) +
        (topicConfig.bloom_distribution?.evaluate || 0) +
        (topicConfig.bloom_distribution?.create || 0);
    }

    if (topicConfig.total_questions !== totalFromDistribution) {
      errors.push(`Tổng số câu hỏi (${topicConfig.total_questions}) không khớp với phân bố (${totalFromDistribution})`);
    }

    return errors;
  };

  // Calculate missing questions by category for a topic
  const calculateMissingQuestionsByCategory = (topicConfig, topic) => {
    if (!topicConfig || !topic) return [];
    
    const topicIdNum = parseInt(topicConfig.topic_id);
    const topicQuestions = questions.filter(q => {
      const qTopicId = parseInt(q.topic_id);
      return !isNaN(qTopicId) && !isNaN(topicIdNum) && qTopicId === topicIdNum;
    });

    const missing = [];
    
    if (topicConfig.distribution_type === 'difficulty') {
      const difficultyLabels = { easy: 'Dễ', medium: 'Trung bình', hard: 'Khó', expert: 'Chuyên gia' };
      ['easy', 'medium', 'hard', 'expert'].forEach(difficulty => {
        const required = topicConfig.difficulty_distribution?.[difficulty] || 0;
        if (required > 0) {
          const available = topicQuestions.filter(q => {
            const questionDifficulty = q.difficulty_level || q.difficulty;
            return questionDifficulty === difficulty;
          }).length;
          const missingCount = Math.max(0, required - available);
          if (missingCount > 0) {
            missing.push(`${difficultyLabels[difficulty]}: thiếu ${missingCount}/${required}`);
          }
        }
      });
    } else if (topicConfig.distribution_type === 'bloom') {
      const bloomLabels = {
        remember: 'Nhớ',
        understand: 'Hiểu',
        apply: 'Vận dụng',
        analyze: 'Phân tích',
        evaluate: 'Đánh giá',
        create: 'Sáng tạo'
      };
      ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'].forEach(bloomLevel => {
        const required = topicConfig.bloom_distribution?.[bloomLevel] || 0;
        if (required > 0) {
          const available = topicQuestions.filter(q => q.bloom_level === bloomLevel).length;
          const missingCount = Math.max(0, required - available);
          if (missingCount > 0) {
            missing.push(`${bloomLabels[bloomLevel]}: thiếu ${missingCount}/${required}`);
          }
        }
      });
    }
    
    return missing;
  };

  // Convert old blueprint format to new format (backward compatibility)
  const convertOldBlueprintToNew = (oldBlueprint) => {
    if (!oldBlueprint.selected_topic_id) {
      return { topics: [] };
    }

    const topic = topics.find(t => 
      t.topic_id === parseInt(oldBlueprint.selected_topic_id) || 
      t.topic_id === oldBlueprint.selected_topic_id
    );
    
    if (!topic) {
      return { topics: [] };
    }

    const topicConfig = createDefaultTopicConfig(
      topic.topic_id, 
      topic.topic_name || topic.topic_code
    );

    if (oldBlueprint.use_difficulty_distribution) {
      topicConfig.distribution_type = 'difficulty';
      topicConfig.difficulty_distribution = {
        easy: oldBlueprint.easy || 0,
        medium: oldBlueprint.medium || 0,
        hard: oldBlueprint.hard || 0,
        expert: oldBlueprint.expert || 0,
        easy_points: oldBlueprint.easy_points || 0,
        medium_points: oldBlueprint.medium_points || 0,
        hard_points: oldBlueprint.hard_points || 0,
        expert_points: oldBlueprint.expert_points || 0
      };
      topicConfig.total_questions = 
        (oldBlueprint.easy || 0) + 
        (oldBlueprint.medium || 0) + 
        (oldBlueprint.hard || 0) + 
        (oldBlueprint.expert || 0);
    } else if (oldBlueprint.use_bloom_distribution) {
      topicConfig.distribution_type = 'bloom';
      topicConfig.bloom_distribution = {
        remember: oldBlueprint.remember || 0,
        understand: oldBlueprint.understand || 0,
        apply: oldBlueprint.apply || 0,
        analyze: oldBlueprint.analyze || 0,
        evaluate: oldBlueprint.evaluate || 0,
        create: oldBlueprint.create || 0,
        remember_points: oldBlueprint.remember_points || 0,
        understand_points: oldBlueprint.understand_points || 0,
        apply_points: oldBlueprint.apply_points || 0,
        analyze_points: oldBlueprint.analyze_points || 0,
        evaluate_points: oldBlueprint.evaluate_points || 0,
        create_points: oldBlueprint.create_points || 0
      };
      topicConfig.total_questions = 
        (oldBlueprint.remember || 0) + 
        (oldBlueprint.understand || 0) + 
        (oldBlueprint.apply || 0) + 
        (oldBlueprint.analyze || 0) + 
        (oldBlueprint.evaluate || 0) + 
        (oldBlueprint.create || 0);
    }

    return { topics: [topicConfig] };
  };

  // Hàm tính điểm trung bình của câu hỏi theo difficulty_level hoặc bloom_level
  const calculateAveragePoints = (filterType, filterValue) => {
    // Lọc câu hỏi theo chủ đề nếu có
    let filteredQuestions = [...questions];
    if (blueprint.selected_topic_id) {
      filteredQuestions = filteredQuestions.filter(q =>
        q.topic_id === parseInt(blueprint.selected_topic_id) || q.topic_id === blueprint.selected_topic_id
      );
    }

    // Lọc theo difficulty_level hoặc bloom_level
    let matchingQuestions = [];
    if (filterType === 'difficulty') {
      matchingQuestions = filteredQuestions.filter(q => {
        const questionDifficulty = q.difficulty_level || q.difficulty;
        return questionDifficulty === filterValue;
      });
    } else if (filterType === 'bloom') {
      matchingQuestions = filteredQuestions.filter(q => q.bloom_level === filterValue);
    }

    if (matchingQuestions.length === 0) {
      return 1; // Mặc định 1 điểm nếu không có câu hỏi nào
    }

    // Tính điểm trung bình
    const totalPoints = matchingQuestions.reduce((sum, q) => {
      const points = parseFloat(q.points) || parseFloat(q.default_points) || 1;
      return sum + points;
    }, 0);

    return totalPoints / matchingQuestions.length;
  };

  // Hàm preview câu hỏi sẽ được chọn (dùng chung logic với handleAddQuestionsByBlueprint)
  const getPreviewQuestions = () => {
    const selected = [];
    let currentPoints = 0;

    // Lấy question_selection_mode từ examForm
    const selectionMode = examForm.question_selection_mode || 'first_on_create';
    const isRandomMode = selectionMode === 'random_on_create' || selectionMode === 'random_on_exam';

    // Helper function to shuffle array (Fisher-Yates algorithm)
    const shuffleArray = (array) => {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };

    // Check if using new multi-topic format
    if (blueprint.topics && Array.isArray(blueprint.topics) && blueprint.topics.length > 0) {
      // New format: Process each topic separately
      blueprint.topics.forEach(topicConfig => {
        // Filter questions by this topic
        let topicFilteredQuestions = questions.filter(q =>
          q.topic_id === parseInt(topicConfig.topic_id) || q.topic_id === topicConfig.topic_id
        );

        if (topicConfig.distribution_type === 'difficulty') {
          // Filter by difficulty
          ['easy', 'medium', 'hard', 'expert'].forEach(difficulty => {
            const count = topicConfig.difficulty_distribution?.[difficulty] || 0;
            if (count > 0) {
              let difficultyFiltered = topicFilteredQuestions.filter(q => {
                const questionDifficulty = q.difficulty_level || q.difficulty;
                return questionDifficulty === difficulty &&
                  !selected.find(s => s.question_id === q.question_id);
              });

              if (isRandomMode) {
                difficultyFiltered = shuffleArray(difficultyFiltered);
              }

              // Calculate points per question
              const totalPoints = topicConfig.difficulty_distribution[`${difficulty}_points`] || 0;
              const pointsPerQuestion = count > 0 ? totalPoints / count : 0;

              for (let i = 0; i < count && i < difficultyFiltered.length; i++) {
                const question = difficultyFiltered[i];
                const points = pointsPerQuestion > 0 ? pointsPerQuestion : (parseFloat(question.points) || 1);
                selected.push({
                  question_id: question.question_id,
                  question_text: question.question_text,
                  points: points,
                  difficulty_level: question.difficulty_level || question.difficulty,
                  bloom_level: question.bloom_level,
                  topic_id: topicConfig.topic_id,
                  topic_name: topicConfig.topic_name,
                  order_number: selected.length + 1
                });
                currentPoints = Number(currentPoints) + Number(points);
              }
            }
          });
        } else if (topicConfig.distribution_type === 'bloom') {
          // Filter by Bloom's Taxonomy
          ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'].forEach(bloomLevel => {
            const count = topicConfig.bloom_distribution?.[bloomLevel] || 0;
            if (count > 0) {
              let bloomFiltered = topicFilteredQuestions.filter(q =>
                q.bloom_level === bloomLevel &&
                !selected.find(s => s.question_id === q.question_id)
              );

              if (isRandomMode) {
                bloomFiltered = shuffleArray(bloomFiltered);
              }

              // Calculate points per question
              const totalPoints = topicConfig.bloom_distribution[`${bloomLevel}_points`] || 0;
              const pointsPerQuestion = count > 0 ? totalPoints / count : 0;

              for (let i = 0; i < count && i < bloomFiltered.length; i++) {
                const question = bloomFiltered[i];
                const points = pointsPerQuestion > 0 ? pointsPerQuestion : (parseFloat(question.points) || 1);
                selected.push({
                  question_id: question.question_id,
                  question_text: question.question_text,
                  points: points,
                  difficulty_level: question.difficulty_level || question.difficulty,
                  bloom_level: question.bloom_level,
                  topic_id: topicConfig.topic_id,
                  topic_name: topicConfig.topic_name,
                  order_number: selected.length + 1
                });
                currentPoints = Number(currentPoints) + Number(points);
              }
            }
          });
        }
      });
    } else {
      // Old format: Single topic (backward compatibility)
      let filteredQuestions = [...questions];
      if (blueprint.selected_topic_id) {
        filteredQuestions = filteredQuestions.filter(q =>
          q.topic_id === parseInt(blueprint.selected_topic_id) || q.topic_id === blueprint.selected_topic_id
        );
      }

      // Use only one distribution method based on toggle state
      if (blueprint.use_difficulty_distribution) {
        // Filter by difficulty only - KHÔNG sử dụng Bloom's Taxonomy
        ['easy', 'medium', 'hard', 'expert'].forEach(difficulty => {
          const count = blueprint[difficulty];
          if (count > 0) {
            // Chỉ lọc theo difficulty_level, không quan tâm đến bloom_level
            let difficultyFiltered = filteredQuestions.filter(q => {
              const questionDifficulty = q.difficulty_level || q.difficulty; // Support both field names
              return questionDifficulty === difficulty &&
                !selected.find(s => s.question_id === q.question_id);
            });

            // Shuffle nếu là random mode
            if (isRandomMode) {
              difficultyFiltered = shuffleArray(difficultyFiltered);
            }

            // Lấy câu hỏi theo số lượng yêu cầu
            for (let i = 0; i < count && i < difficultyFiltered.length; i++) {
              const question = difficultyFiltered[i];
              const points = parseFloat(question.points) || 1;
              selected.push({
                question_id: question.question_id,
                question_text: question.question_text,
                points: points,
                difficulty_level: question.difficulty_level || question.difficulty,
                bloom_level: question.bloom_level,
                order_number: selected.length + 1
              });
              currentPoints = Number(currentPoints) + Number(points);
            }
          }
        });
      } else if (blueprint.use_bloom_distribution) {
        // Filter by Bloom's Taxonomy only - KHÔNG sử dụng difficulty
        ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'].forEach(bloomLevel => {
          const count = blueprint[bloomLevel];
          if (count > 0) {
            // Chỉ lọc theo bloom_level, không quan tâm đến difficulty_level
            let bloomFiltered = filteredQuestions.filter(q =>
              q.bloom_level === bloomLevel &&
              !selected.find(s => s.question_id === q.question_id)
            );

            // Shuffle nếu là random mode
            if (isRandomMode) {
              bloomFiltered = shuffleArray(bloomFiltered);
            }

            // Lấy câu hỏi theo số lượng yêu cầu
            for (let i = 0; i < count && i < bloomFiltered.length; i++) {
              const question = bloomFiltered[i];
              const points = parseFloat(question.points) || 1;
              selected.push({
                question_id: question.question_id,
                question_text: question.question_text,
                points: points,
                difficulty_level: question.difficulty_level || question.difficulty,
                bloom_level: question.bloom_level,
                order_number: selected.length + 1
              });
              currentPoints = Number(currentPoints) + Number(points);
            }
          }
        });
      }
    }

    return { selected, currentPoints: Number(currentPoints) };
  };

  // Cache kết quả preview questions để tránh tính toán lại nhiều lần
  const previewQuestions = useMemo(() => {
    return getPreviewQuestions();
  }, [blueprint, questions, examForm.question_selection_mode]);

  const handleAddQuestionsByBlueprint = () => {
    const { selected, currentPoints } = getPreviewQuestions();

    // Chỉ set selectedQuestions nếu không phải mode "on_exam"
    if (examForm.question_selection_mode !== 'first_on_exam' && examForm.question_selection_mode !== 'random_on_exam') {
      setSelectedQuestions(selected);
      setExamForm({ ...examForm, total_points: currentPoints });
      setOriginalQuestionPoints([]); // Reset khi thêm câu hỏi mới
      setHasRedistributedPoints(false); // Reset khi thêm câu hỏi mới
      const distributionMethod = blueprint.use_difficulty_distribution ? 'độ khó' : 'Bloom\'s Taxonomy';
      showAlertMessage(`Đã chọn ${selected.length} câu hỏi theo ma trận (${distributionMethod})${blueprint.selected_topic_id ? ' và chủ đề đã chọn' : ''}`, 'success');
    } else {
      // Nếu là mode "on_exam", total_points sẽ được tính tự động bởi useEffect từ các điểm của các mức độ
      // Không cần set total_points ở đây nữa vì useEffect đã xử lý
      const distributionMethod = blueprint.use_difficulty_distribution ? 'độ khó' : 'Bloom\'s Taxonomy';
      showAlertMessage(`Đã cấu hình ma trận đề thi (${distributionMethod})${blueprint.selected_topic_id ? ' và chủ đề đã chọn' : ''}. Câu hỏi sẽ được chọn tự động khi sinh viên làm bài.`, 'success');
    }
    setShowBlueprintModal(false);
  };

  const handleToggleQuestion = (question) => {
    const exists = selectedQuestions.find(q => q.question_id === question.question_id);

    if (exists) {
      setSelectedQuestions(selectedQuestions.filter(q => q.question_id !== question.question_id));
    } else {
      setSelectedQuestions([
        ...selectedQuestions,
        {
          question_id: question.question_id,
          points: question.points || 1,
          order_number: selectedQuestions.length + 1
        }
      ]);
    }
    // Reset state khi thêm/xóa câu hỏi
    setOriginalQuestionPoints([]);
    setHasRedistributedPoints(false);
  };

  // Helper functions to compare data changes
  const hasExamsDataChanged = (oldData, newData) => {
    if (!oldData || !Array.isArray(oldData)) return true; // First load
    if (!newData || !Array.isArray(newData)) return false;
    if (oldData.length !== newData.length) return true;

    // Compare by exam_id and all relevant fields for display
    const oldMap = new Map(oldData.map(exam => [exam.exam_id, {
      exam_id: exam.exam_id,
      // Basic info
      exam_title: exam.exam_title,
      exam_type: exam.exam_type,
      // Time fields
      duration_minutes: exam.duration_minutes,
      max_attempts: exam.max_attempts,
      available_from: exam.available_from,
      available_until: exam.available_until,
      scheduled_start: exam.scheduled_start,
      scheduled_end: exam.scheduled_end,
      // Status fields
      is_approved: exam.is_approved,
      // Security fields
      proctoring_enabled: exam.proctoring_enabled,
      shuffle_questions: exam.shuffle_questions,
      ip_restrictions: exam.ip_restrictions,
      // Other display fields
      questions_count: exam.questions_count,
      total_points: exam.total_points,
      passing_score: exam.passing_score
    }]));

    for (const newExam of newData) {
      const oldExam = oldMap.get(newExam.exam_id);
      if (!oldExam) return true; // New exam added

      // Check if any relevant field changed
      if (
        oldExam.exam_title !== newExam.exam_title ||
        oldExam.exam_type !== newExam.exam_type ||
        oldExam.duration_minutes !== newExam.duration_minutes ||
        oldExam.max_attempts !== newExam.max_attempts ||
        oldExam.available_from !== newExam.available_from ||
        oldExam.available_until !== newExam.available_until ||
        oldExam.scheduled_start !== newExam.scheduled_start ||
        oldExam.scheduled_end !== newExam.scheduled_end ||
        oldExam.is_approved !== newExam.is_approved ||
        oldExam.proctoring_enabled !== newExam.proctoring_enabled ||
        oldExam.shuffle_questions !== newExam.shuffle_questions ||
        oldExam.ip_restrictions !== newExam.ip_restrictions ||
        oldExam.questions_count !== newExam.questions_count ||
        oldExam.total_points !== newExam.total_points ||
        oldExam.passing_score !== newExam.passing_score
      ) {
        return true;
      }
    }

    return false; // No changes detected
  };

  const hasMonitoringDataChanged = (oldData, newData) => {
    if (!oldData || !Array.isArray(oldData)) return true; // First load
    if (!newData || !Array.isArray(newData)) return false;
    if (oldData.length !== newData.length) return true;

    // Compare by attempt_id and key fields
    const oldMap = new Map(oldData.map(attempt => [attempt.attempt_id, {
      attempt_id: attempt.attempt_id,
      cheating_events_count: attempt.cheating_events_count,
      high_severity_count: attempt.high_severity_count,
      has_cheating_flag: attempt.has_cheating_flag,
      submitted_at: attempt.submitted_at,
      score: attempt.score,
      answered_questions_count: attempt.answered_questions_count,
      time_remaining_seconds: attempt.time_remaining_seconds
    }]));

    for (const newAttempt of newData) {
      const oldAttempt = oldMap.get(newAttempt.attempt_id);
      if (!oldAttempt) return true; // New attempt added

      // Check if key fields changed
      if (
        oldAttempt.cheating_events_count !== newAttempt.cheating_events_count ||
        oldAttempt.high_severity_count !== newAttempt.high_severity_count ||
        oldAttempt.has_cheating_flag !== newAttempt.has_cheating_flag ||
        oldAttempt.submitted_at !== newAttempt.submitted_at ||
        oldAttempt.score !== newAttempt.score ||
        oldAttempt.answered_questions_count !== newAttempt.answered_questions_count ||
        oldAttempt.time_remaining_seconds !== newAttempt.time_remaining_seconds
      ) {
        return true;
      }
    }

    return false; // No changes detected
  };

  const hasCheatingLogsChanged = (oldLogs, newLogs) => {
    if (!oldLogs || !Array.isArray(oldLogs)) return true; // First load
    if (!newLogs || !Array.isArray(newLogs)) return false;
    if (oldLogs.length !== newLogs.length) return true;

    // Compare by log_id and event_time
    const oldMap = new Map(oldLogs.map(log => [log.log_id, {
      log_id: log.log_id,
      event_time: log.event_time,
      event_type: log.event_type
    }]));

    for (const newLog of newLogs) {
      const oldLog = oldMap.get(newLog.log_id);
      if (!oldLog) return true; // New log added

      // Check if key fields changed
      if (
        oldLog.event_time !== newLog.event_time ||
        oldLog.event_type !== newLog.event_type
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

  // Hàm phân bố lại điểm đều cho các câu hỏi (chỉ cập nhật local state, KHÔNG cập nhật database)
  const redistributePoints = (newTotalPoints) => {
    if (selectedQuestions.length === 0) return;

    // Lưu điểm cũ trước khi phân bố lại (chỉ lưu lần đầu)
    if (!hasRedistributedPoints && originalQuestionPoints.length === 0) {
      const originalPoints = selectedQuestions.map(q => ({
        question_id: q.question_id,
        points: q.points
      }));
      setOriginalQuestionPoints(originalPoints);
    }

    // Tính điểm đều cho mỗi câu hỏi
    const pointsPerQuestion = newTotalPoints / selectedQuestions.length;
    let currentSum = 0;

    // Phân bố điểm đều, làm tròn đến 2 chữ số thập phân
    const finalDistributed = selectedQuestions.map((q, index) => {
      if (index === selectedQuestions.length - 1) {
        // Câu cuối cùng nhận phần còn lại để đảm bảo tổng điểm chính xác
        const remainingPoints = parseFloat((newTotalPoints - currentSum).toFixed(2));
        return { ...q, points: remainingPoints };
      } else {
        // Làm tròn đến 2 chữ số thập phân
        const points = Math.round(pointsPerQuestion * 100) / 100;
        currentSum = parseFloat((currentSum + points).toFixed(2));
        return { ...q, points: parseFloat(points.toFixed(2)) };
      }
    });

    // Chỉ cập nhật local state, KHÔNG cập nhật database
    setSelectedQuestions(finalDistributed);
    setHasRedistributedPoints(true);

    // Cập nhật tổng điểm trong form
    setExamForm(prev => ({ ...prev, total_points: parseFloat(newTotalPoints.toFixed(2)) }));
  };

  // Hàm revert lại điểm cũ (chỉ cập nhật local state, KHÔNG cập nhật database)
  const revertPoints = () => {
    if (originalQuestionPoints.length === 0) return;

    // Khôi phục điểm cũ
    const revertedQuestions = selectedQuestions.map(q => {
      const original = originalQuestionPoints.find(op => op.question_id === q.question_id);
      return original ? { ...q, points: original.points } : q;
    });

    // Chỉ cập nhật local state, KHÔNG cập nhật database
    setSelectedQuestions(revertedQuestions);
    setHasRedistributedPoints(false);
    setOriginalQuestionPoints([]);

    // Tính lại tổng điểm từ điểm cũ
    const revertedTotalPoints = revertedQuestions.reduce((sum, q) => sum + (parseFloat(q.points) || 0), 0);
    setExamForm(prev => ({ ...prev, total_points: parseFloat(revertedTotalPoints.toFixed(2)) }));
  };

  const getTypeBadge = (type) => {
    const config = {
      quiz: { bg: 'primary', text: 'Quiz' },
      midterm: { bg: 'warning', text: 'Giữa kỳ' },
      final: { bg: 'danger', text: 'Cuối kỳ' },
      practice: { bg: 'info', text: 'Luyện tập' },
      osce: { bg: 'success', text: 'OSCE' }
    };
    const c = config[type] || config.quiz;
    return <Badge bg={c.bg}>{c.text}</Badge>;
  };

  // Helper function to check LMS role - lms_qa và lms_mod có quyền
  const getLMSRole = () => {
    if (!currentUser) return null;

    const moduleRoles = currentUser.module_roles || [];
    if (!Array.isArray(moduleRoles)) return null;

    // lms_qa có quyền cao nhất
    if (moduleRoles.includes('lms_qa')) return 'lms_qa';
    // lms_mod cũng có quyền cấm thi
    if (moduleRoles.includes('lms_mod')) return 'lms_mod';

    return null;
  };

  // Check if user has lms_qa or lms_mod permission (for accessing the page)
  const hasLMSQAPermission = () => {
    const role = getLMSRole();
    return role === 'lms_qa' || role === 'lms_mod';
  };
  
  // Check if user has lms_qa permission (for approve action only)
  const hasLMSQAOnlyPermission = () => {
    return getLMSRole() === 'lms_qa';
  };

  // Check if user has permission to ban (QA or Mod)
  const canBanStudent = () => {
    const role = getLMSRole();
    return role === 'lms_qa' || role === 'lms_mod';
  };

  const getStatusBadge = (exam) => {
    const now = new Date();
    const start = (exam.available_from || exam.scheduled_start) ? new Date(exam.available_from || exam.scheduled_start) : null;
    const end = (exam.available_until || exam.scheduled_end) ? new Date(exam.available_until || exam.scheduled_end) : null;

    if (start && now < start) {
      return <Badge bg="secondary">Chưa mở</Badge>;
    } else if (end && now > end) {
      return <Badge bg="dark">Đã đóng</Badge>;
    } else if (start && now >= start && (!end || now <= end)) {
      return <Badge bg="success">Đang mở</Badge>;
    } else {
      return <Badge bg="info">Sẵn sàng</Badge>;
    }
  };

  // Show access denied if user doesn't have permission
  if (!hasLMSQAPermission()) {
    return (
      <div className="container-fluid session-main-container">
        <div className="session-header">
          <div className="header-content">
            <div className="header-title">
              <h1>Quản lý Kỳ thi & Kiểm tra</h1>
              <p className="header-subtitle">Tạo đề thi theo ma trận, chống gian lận, chấm tự động</p>
            </div>
          </div>
        </div>
        <Alert variant="danger" className="mt-3">
          <Alert.Heading>Không có quyền truy cập</Alert.Heading>
          <p>Bạn không có quyền truy cập trang này. Chỉ quyền <strong>Khảo thí & Đảm bảo chất lượng (lms_qa)</strong> và <strong>Quản lý LMS (lms_mod)</strong> mới có quyền xem và quản lý kỳ thi.</p>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container-fluid session-main-container">
      {/* Header */}
      <div className="session-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Quản lý Kỳ thi & Kiểm tra</h1>
            <p className="header-subtitle">Tạo đề thi theo ma trận, chống gian lận, chấm tự động</p>
          </div>
          <div className="header-actions">
            {hasLMSQAPermission() && (
              <Button variant="light" className="me-2" onClick={handleOpenRegulationModal}>
                <i className="fas fa-gavel me-2"></i>Quy chế thi
              </Button>
            )}
            <Button variant="light" className="create-session-btn" onClick={handleCreateExam}>
              <i className="fas fa-plus me-2"></i>Tạo kỳ thi mới
            </Button>
          </div>
        </div>
      </div>


      {/* Tabs */}
      <div className="tab-navigation">
        <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="custom-tabs">
          <Tab eventKey="exams" title={
            <span className="tab-title">
              <i className="fas fa-clipboard-list"></i>
              Danh sách kỳ thi
            </span>
          }>
            {/* Filters */}
            <div className="session-list-controls">
              <div className="search-controls">
                <div className="search-input" style={{ minWidth: '250px', flex: '1' }}>
                  <input
                    type="text"
                    placeholder="Tìm theo tên kỳ thi..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>

                <select
                  className="filter-select"
                  value={filters.exam_type}
                  onChange={(e) => setFilters({ ...filters, exam_type: e.target.value })}
                >
                  <option value="">Tất cả loại</option>
                  <option value="quiz">Quiz</option>
                  <option value="midterm">Giữa kỳ</option>
                  <option value="final">Cuối kỳ</option>
                  <option value="practice">Luyện tập</option>
                  <option value="osce">OSCE</option>
                </select>

                <select
                  className="filter-select"
                  value={filters.class_name}
                  onChange={(e) => setFilters({ ...filters, class_name: e.target.value })}
                >
                  <option value="">Tất cả lớp</option>
                  {filterClasses.map((className, index) => (
                    <option key={index} value={className}>{className}</option>
                  ))}
                </select>

                <select
                  className="filter-select"
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="approved">Đã duyệt</option>
                  <option value="not_approved">Chưa duyệt</option>
                  <option value="upcoming">Sắp diễn ra</option>
                  <option value="ongoing">Đang diễn ra</option>
                  <option value="ended">Đã kết thúc</option>
                </select>

                <input
                  type="date"
                  className="filter-select"
                  placeholder="Từ ngày"
                  value={filters.date_from}
                  onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
                  style={{ minWidth: '150px' }}
                />

                <input
                  type="date"
                  className="filter-select"
                  placeholder="Đến ngày"
                  value={filters.date_to}
                  onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
                  style={{ minWidth: '150px' }}
                />
              </div>
            </div>

            {/* Exams Table */}
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
                          <th>Tên</th>
                          <th>Loại</th>
                          <th>Lớp</th>
                          <th>Thời gian</th>
                          <th>Thời gian Mở và Đóng bài thi</th>
                          <th>Câu hỏi</th>
                          <th>Điểm</th>
                          <th>Trạng thái</th>
                          {getLMSRole() !== null && <th>Hành động</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {!Array.isArray(exams) || exams.length === 0 ? (
                          <tr>
                            <td colSpan={getLMSRole() !== null ? 8 : 7} className="text-center p-4">
                              <i className="fas fa-inbox fa-3x text-muted mb-3"></i>
                              <p className="text-muted">Chưa có kỳ thi nào. Nhấn "Tạo kỳ thi mới" để bắt đầu.</p>
                            </td>
                          </tr>
                        ) : (
                          exams
                            .slice((pagination.page - 1) * pagination.limit, pagination.page * pagination.limit)
                            .map((exam) => {
                              const lmsRole = getLMSRole();
                              const showActionsColumn = lmsRole !== null;
                              
                              // Get class/group info
                              // Priority: participant_class_name (from participants) > class_name (from lms_classes) > group_name (from participants)
                              const classInfo = exam.participant_class_name || exam.class_name || null;
                              const groupInfo = exam.group_name || (exam.enrollment_type === 'group' && exam.enrollment_reference ? exam.enrollment_reference : null);

                              return (
                                <tr key={exam.exam_id}>
                                  <td>
                                    <strong>
                                      {exam.exam_title}
                                      {exam.is_approved === 1 || exam.is_approved === true ? (
                                        <i className="fas fa-check-circle text-success ms-2" title="Đã được duyệt"></i>
                                      ) : null}
                                    </strong>
                                    {exam.exam_description && (
                                      <div className="text-muted small">{exam.exam_description.substring(0, 60)}...</div>
                                    )}
                                  </td>
                                  <td>{getTypeBadge(exam.exam_type)}</td>
                                  <td>
                                    {classInfo ? (
                                      <Badge bg="info">{classInfo}</Badge>
                                    ) : groupInfo ? (
                                      <Badge bg="secondary">Nhóm: {groupInfo}</Badge>
                                    ) : (
                                      <span className="text-muted">-</span>
                                    )}
                                  </td>
                                  <td>
                                    <Badge bg="secondary">{exam.duration_minutes || 0} phút</Badge>
                                    <div className="text-muted small">
                                      Tối đa {exam.max_attempts || 1} lần
                                    </div>
                                  </td>
                                  <td>
                                    {exam.available_from ? (
                                      <div>
                                        <div>
                                          <i className="fas fa-play-circle me-1 text-success"></i>
                                          <strong></strong> {new Date(exam.available_from).toLocaleString('vi-VN', {
                                            year: 'numeric',
                                            month: '2-digit',
                                            day: '2-digit',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          })}
                                        </div>
                                        {exam.available_until && (
                                          <div className="text-muted small mt-1">
                                            <i className="fas fa-stop-circle me-1 text-danger"></i>
                                            <strong></strong> {new Date(exam.available_until).toLocaleString('vi-VN', {
                                              year: 'numeric',
                                              month: '2-digit',
                                              day: '2-digit',
                                              hour: '2-digit',
                                              minute: '2-digit'
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-muted">-</span>
                                    )}
                                  </td>
                                  <td>
                                    <Badge bg="primary">{exam.questions_count || 0} câu</Badge>
                                  </td>
                                  <td>
                                    <Badge bg="success">{exam.total_points || 0} điểm</Badge>
                                    <div className="text-muted small">
                                      Đạt: {Math.round(exam.passing_score || 0)}%
                                    </div>
                                  </td>
                                  <td>{getStatusBadge(exam)}</td>
                                  {showActionsColumn && (
                                    <td>
                                      <div className="action-buttons">
                                        {/* Giám sát - Hiển thị cho tất cả role LMS */}
                                        <Button
                                          size="sm"
                                          variant="outline-info"
                                          onClick={() => handleShowMonitoring(exam)}
                                          title="Giám sát"
                                        >
                                          <i className="fas fa-eye"></i>
                                        </Button>

                                        {/* Ma trận đề - Chỉ hiển thị nếu không phải mode "on_exam" */}
                                        {exam.question_selection_mode !== 'first_on_exam' && exam.question_selection_mode !== 'random_on_exam' && (
                                          <Button
                                            size="sm"
                                            variant="outline-primary"
                                            onClick={() => handleShowBlueprint(exam)}
                                            title="Ma trận đề"
                                          >
                                            <i className="fas fa-th"></i>
                                          </Button>
                                        )}

                                        {/* Duyệt - Chỉ hiển thị cho lms_qa và chưa được duyệt */}
                                        {lmsRole === 'lms_qa' && !(exam.is_approved === 1 || exam.is_approved === true) && (
                                          <Button
                                            size="sm"
                                            variant="outline-success"
                                            onClick={() => handleApproveExam(exam.exam_id)}
                                            title="Duyệt"
                                          >
                                            <i className="fas fa-check"></i>
                                          </Button>
                                        )}

                                        {/* Sửa - lms_qa và lms_mod */}
                                        {(lmsRole === 'lms_qa' || lmsRole === 'lms_mod') && (
                                          <Button
                                            size="sm"
                                            variant="outline-warning"
                                            onClick={() => handleEditExam(exam)}
                                            title="Sửa"
                                          >
                                            <i className="fas fa-edit"></i>
                                          </Button>
                                        )}

                                        {/* Xóa - lms_qa và lms_mod */}
                                        {(lmsRole === 'lms_qa' || lmsRole === 'lms_mod') && (
                                          <Button
                                            size="sm"
                                            variant="outline-danger"
                                            onClick={() => handleDeleteExam(exam.exam_id)}
                                            title="Xóa"
                                          >
                                            <i className="fas fa-trash"></i>
                                          </Button>
                                        )}
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              );
                            })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {exams.length > 0 && pagination.totalPages > 1 && (
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

          <Tab eventKey="monitoring" title={
            <span className="tab-title">
              <i className="fas fa-eye"></i>
              Giám sát thi
            </span>
          }>
            {selectedExam ? (
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
                            <th>Sinh viên</th>
                            <th>Thời gian bắt đầu/Còn lại</th>
                            <th>Thời gian nộp</th>
                            <th>Điểm</th>
                            <th>Câu đã làm</th>
                            <th>Sự kiện</th>
                            <th>Mức độ gian lận</th>
                            <th>Live Webcam</th>
                            <th>Hành động</th>
                          </tr>
                        </thead>
                        <tbody>
                          {monitoringData.length === 0 ? (
                            <tr>
                              <td colSpan="9" className="text-center p-4">
                                <i className="fas fa-inbox fa-3x text-muted mb-3"></i>
                                <p className="text-muted">Chưa có dữ liệu giám sát</p>
                              </td>
                            </tr>
                          ) : (
                            monitoringData
                              .slice((monitoringPagination.page - 1) * monitoringPagination.limit, monitoringPagination.page * monitoringPagination.limit)
                              .map((attempt) => (
                                <tr 
                                  key={attempt.attempt_id}
                                  onClick={async (e) => {
                                    // Don't trigger if clicking on buttons or interactive elements
                                    if (e.target.closest('button') || e.target.closest('a') || e.target.closest('.badge')) {
                                      return;
                                    }
                                    await fetchCheatingLogs(attempt.attempt_id);
                                    setShowMonitoringModal(true);
                                  }}
                                  style={{ cursor: 'pointer' }}
                                  onMouseEnter={(e) => {
                                    if (!e.target.closest('button') && !e.target.closest('a') && !e.target.closest('.badge')) {
                                      e.currentTarget.style.backgroundColor = '#f8f9fa';
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = '';
                                  }}
                                >
                                  <td>
                                    <strong>{attempt.student_name}</strong>
                                    <div className="text-muted small">{attempt.student_id}</div>
                                  </td>
                                  <td>
                                    <div>
                                      <div>{new Date(attempt.start_time).toLocaleString('vi-VN')}</div>
                                      {attempt.status === 'in_progress' && selectedExam?.duration_minutes ? (
                                        <TimeRemainingDisplay
                                          attempt={attempt}
                                          examDuration={selectedExam.duration_minutes}
                                        />
                                      ) : null}
                                    </div>
                                  </td>
                                  <td>{attempt.submit_time ? new Date(attempt.submit_time).toLocaleString('vi-VN') : 'Chưa nộp'}</td>
                                  <td>
                                    {(() => {
                                      const totalPoints = selectedExam?.total_points || 100;
                                      const score = parseFloat(attempt.score) || 0;
                                      const passingScore = (totalPoints * (selectedExam?.passing_score || 60)) / 100;
                                      return (
                                        <Badge bg={score >= passingScore ? 'success' : 'danger'}>
                                          {score.toFixed(2)} / {totalPoints}
                                        </Badge>
                                      );
                                    })()}
                                  </td>
                                  <td>
                                    {(() => {
                                      const answeredCount = attempt.answered_questions_count || 0;
                                      const totalQuestions = attempt.total_questions || 0;
                                      const percentage = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;
                                      return (
                                        <div
                                          onClick={async (e) => {
                                            e.stopPropagation(); // Prevent row click
                                            if (answeredCount > 0) {
                                              setLoadingAnswersDetail(true);
                                              setCurrentViewingAttemptId(attempt.attempt_id);
                                              lastAnsweredCountRef.current = answeredCount;
                                              lastUpdateTimeRef.current = Date.now();
                                              try {
                                                const response = await api.get(`/lms/attempts/${attempt.attempt_id}/answers-detail`);
                                                if (response.data.success) {
                                                  setAnswersDetailData(response.data.data);
                                                  setShowAnswersDetailModal(true);
                                                }
                                              } catch (error) {
                                                console.error('Error fetching answers detail:', error);
                                                showAlertMessage('Lỗi khi lấy chi tiết đáp án', 'danger');
                                              } finally {
                                                setLoadingAnswersDetail(false);
                                              }
                                            }
                                          }}
                                          style={{ cursor: answeredCount > 0 ? 'pointer' : 'default' }}
                                          title={answeredCount > 0 ? 'Click để xem chi tiết câu hỏi đã làm' : ''}
                                        >
                                          <div className="fw-bold mb-1">
                                            {answeredCount} / {totalQuestions}
                                          </div>
                                          <ProgressBar 
                                            now={percentage} 
                                            label={`${percentage}%`}
                                            variant="success"
                                            style={{ height: '20px', fontSize: '11px' }}
                                          />
                                        </div>
                                      );
                                    })()}
                                  </td>
                                  <td>
                                    <Badge bg={attempt.cheating_events_count > 0 ? 'danger' : 'success'}>
                                      {attempt.cheating_events_count || 0}
                                    </Badge>
                                  </td>
                                  <td>
                                    {attempt.high_severity_count > 0 && (
                                      <Badge bg="danger">{attempt.high_severity_count} cảnh báo</Badge>
                                    )}
                                  </td>
                                  <td>
                                    {(() => {
                                      const isActive = !attempt.submit_time;
                                      const liveFrame = liveWebcamData[attempt.attempt_id];
                                      const isWatching = watchedAttemptsRef.current.has(attempt.attempt_id);

                                      if (!isActive) {
                                        return (
                                          <div className="d-flex flex-column align-items-center gap-2">
                                            <div className="text-muted small">
                                              <i className="fas fa-check-circle"></i> Đã nộp
                                            </div>
                                            <Button
                                              size="sm"
                                              variant="outline-primary"
                                              onClick={async () => {
                                                try {
                                                  setSelectedAttemptForVideo(attempt);
                                                  await fetchWebcamVideo(attempt.attempt_id);
                                                  setShowWebcamModal(true);
                                                } catch (error) {
                                                  console.error('Error fetching webcam video:', error);
                                                  // Error đã được xử lý trong fetchWebcamVideo (showAlertMessage)
                                                }
                                              }}
                                              title="Xem video webcam đã ghi"
                                              style={{ fontSize: '11px', padding: '2px 8px' }}
                                              disabled={loadingVideo}
                                            >
                                              {loadingVideo ? (
                                                <>
                                                  <Spinner size="sm" animation="border" variant="primary" className="me-1" style={{ width: '10px', height: '10px' }} />
                                                  Đang tải...
                                                </>
                                              ) : (
                                                <>
                                                  <i className="fas fa-video me-1"></i>
                                                  Xem video
                                                </>
                                              )}
                                            </Button>
                                          </div>
                                        );
                                      }

                                      if (liveFrame) {
                                        return (
                                          <div
                                            style={{
                                              width: '120px',
                                              height: '90px',
                                              border: '2px solid #dc3545',
                                              borderRadius: '4px',
                                              overflow: 'hidden',
                                              backgroundColor: '#000',
                                              position: 'relative',
                                              cursor: 'pointer',
                                              transition: 'transform 0.2s',
                                            }}
                                            onClick={() => {
                                              setSelectedAttemptForLiveView(attempt);
                                              setShowLiveWebcamModal(true);
                                            }}
                                            onMouseEnter={(e) => {
                                              e.currentTarget.style.transform = 'scale(1.05)';
                                              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
                                            }}
                                            onMouseLeave={(e) => {
                                              e.currentTarget.style.transform = 'scale(1)';
                                              e.currentTarget.style.boxShadow = 'none';
                                            }}
                                            title="Click để xem toàn màn hình"
                                          >
                                            <img
                                              src={liveFrame}
                                              alt="Live webcam"
                                              style={{
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover'
                                              }}
                                            />
                                            <Badge
                                              bg="danger"
                                              style={{
                                                position: 'absolute',
                                                top: '2px',
                                                right: '2px',
                                                fontSize: '8px',
                                                padding: '2px 4px'
                                              }}
                                            >
                                              LIVE
                                            </Badge>
                                          </div>
                                        );
                                      }

                                      if (isWatching) {
                                        return (
                                          <div className="text-muted small">
                                            <Spinner size="sm" animation="border" variant="primary" />
                                            <span className="ms-1">Đang chờ stream...</span>
                                          </div>
                                        );
                                      }

                                      return (
                                        <div className="text-muted small">
                                          <i className="fas fa-video-slash"></i> Chưa kết nối
                                        </div>
                                      );
                                    })()}
                                  </td>
                                  <td>
                                    <div className="d-flex gap-1">
                                      {attempt.webcam_video_path && (
                                        <Button
                                          size="sm"
                                          variant="outline-danger"
                                          onClick={async () => {
                                            setSelectedAttemptForVideo(attempt);
                                            await fetchWebcamVideo(attempt.attempt_id);
                                            setShowWebcamModal(true);
                                          }}
                                          title="Xem video webcam đã ghi"
                                        >
                                          <i className="fas fa-video"></i>
                                        </Button>
                                      )}
                                      {attempt.status === 'in_progress' && (attempt.resume_allowed === 0 || attempt.resume_allowed === false || !attempt.resume_allowed) ? (
                                        <Button
                                          size="sm"
                                          variant="outline-success"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setAttemptForGrantResume(attempt);
                                            setShowGrantResumeModal(true);
                                          }}
                                          title="Cấp quyền tiếp tục làm bài (nếu gặp sự cố)"
                                        >
                                          <i className="fas fa-redo"></i>
                                        </Button>
                                      ) : null}
                                      {attempt.status === 'in_progress' && (attempt.resume_allowed === 1 || attempt.resume_allowed === true) ? (
                                        <Badge bg="success" title="Đã cấp quyền tiếp tục làm bài">
                                          <i className="fas fa-check"></i> Đã cấp quyền
                                        </Badge>
                                      ) : null}
                                      {(attempt.status === 'in_progress' || attempt.status === 'submitted') && (
                                        <Button
                                          size="sm"
                                          variant="outline-warning"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setAttemptForReset(attempt);
                                            setShowResetConfirmModal(true);
                                          }}
                                          title="Thi lại từ đầu - Reset toàn bộ: đáp án, thời gian, trang, quyền tiếp tục, điểm số"
                                        >
                                          <i className="fas fa-undo"></i>
                                        </Button>
                                      )}
                                      {canBanStudent() && !(attempt.is_banned === 1 || attempt.is_banned === true) && (
                                        <Button
                                          size="sm"
                                          variant="outline-danger"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedAttemptForBan(attempt);
                                            setShowBanModal(true);
                                          }}
                                          title="Cấm thi sinh viên"
                                        >
                                          <i className="fas fa-ban"></i>
                                        </Button>
                                      )}
                                      {canBanStudent() && (attempt.is_banned === 1 || attempt.is_banned === true) && (
                                        <>
                                          <Badge bg="danger" className="me-1" title="Sinh viên đã bị cấm thi">
                                            <i className="fas fa-ban"></i>
                                          </Badge>
                                          <Button
                                            size="sm"
                                            variant="outline-success"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setAttemptForUnban(attempt);
                                              setShowUnbanConfirmModal(true);
                                            }}
                                            title="Thu hồi cấm thi - Cho phép sinh viên tiếp tục làm bài"
                                          >
                                            <i className="fas fa-check-circle"></i>
                                          </Button>
                                        </>
                                      )}
                                      {!canBanStudent() && (attempt.is_banned === 1 || attempt.is_banned === true) && (
                                        <Badge bg="danger" title="Sinh viên đã bị cấm thi">
                                          <i className="fas fa-ban"></i> Đã cấm
                                        </Badge>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination for Monitoring */}
                    {monitoringData.length > 0 && monitoringPagination.totalPages > 1 && (
                      <div className="mt-3">
                        <Pagination
                          currentPage={monitoringPagination.page}
                          totalPages={monitoringPagination.totalPages}
                          onPageChange={(page) => setMonitoringPagination(prev => ({ ...prev, page }))}
                          maxVisiblePages={5}
                          showFirstLast={true}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="text-center p-5">
                <i className="fas fa-info-circle fa-3x text-muted mb-3"></i>
                <p className="text-muted">Vui lòng chọn một kỳ thi từ danh sách để xem giám sát</p>
              </div>
            )}
          </Tab>
        </Tabs>
      </div>

      {/* Exam Modal */}
      <Modal show={showExamModal} onHide={() => {
        setShowExamModal(false);
        setExamModalTab('basic'); // Reset tab khi đóng modal
      }} size="xl" className="student-detail-modal" style={{ maxWidth: '95%', width: '95%' }}>
        <Modal.Header closeButton className="student-detail-header">
          <Modal.Title className="student-detail-title">
            <div className="student-avatar">
              <i className={editMode ? "fas fa-edit" : "fas fa-plus"}></i>
            </div>
            <div>
              <h4 className="mb-0">{editMode ? 'Chỉnh sửa kỳ thi' : 'Tạo kỳ thi mới'}</h4>
            </div>
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmitExam}>
          <Modal.Body className="student-detail-body">
            <div className="student-detail-container">
              <Tabs
                activeKey={examModalTab}
                onSelect={(k) => setExamModalTab(k)}
                className="mb-3"
                fill
                variant="pills"
              >
                {/* Basic Info Tab */}
                <Tab eventKey="basic" title={
                  <span>
                    <i className="fas fa-info-circle me-2"></i>
                    Cơ bản
                  </span>
                }>
                  <div className="p-3">
                    <Form.Group className="mb-3">
                      <Form.Label>Tên *</Form.Label>
                      <Form.Control
                        type="text"
                        value={examForm.exam_title}
                        onChange={(e) => setExamForm({ ...examForm, exam_title: e.target.value })}
                        required
                      />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>Mô tả</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={2}
                        value={examForm.exam_description}
                        onChange={(e) => setExamForm({ ...examForm, exam_description: e.target.value })}
                      />
                    </Form.Group>

                    <div className="row">
                      <div className="col-md-6">
                        <Form.Group className="mb-3">
                          <Form.Label>Loại kỳ thi</Form.Label>
                          <Form.Select
                            value={examForm.exam_type}
                            onChange={(e) => setExamForm({ ...examForm, exam_type: e.target.value })}
                          >
                            <option value="quiz">Quiz</option>
                            <option value="midterm">Giữa kỳ</option>
                            <option value="final">Cuối kỳ</option>
                            <option value="practice">Luyện tập</option>
                            <option value="osce">OSCE</option>
                          </Form.Select>
                        </Form.Group>
                      </div>
                      <div className="col-md-6">
                        <Form.Group className="mb-3">
                          <Form.Label>Thời gian làm bài (phút)</Form.Label>
                          <Form.Control
                            type="number"
                            value={examForm.duration_minutes}
                            onChange={(e) => setExamForm({ ...examForm, duration_minutes: parseInt(e.target.value) })}
                          />
                        </Form.Group>
                      </div>
                    </div>

                    <div className="row">
                      <div className="col-md-4">
                        <Form.Group className="mb-3">
                          <Form.Label>
                            Tổng điểm
                            {(examForm.question_selection_mode === 'first_on_exam' || examForm.question_selection_mode === 'random_on_exam') && (
                              <Badge bg="info" className="ms-2">Tự động tính</Badge>
                            )}
                          </Form.Label>
                          <Form.Control
                            type="number"
                            step="0.01"
                            value={examForm.total_points}
                            onChange={(e) => {
                              const newTotalPoints = parseFloat(e.target.value) || 0;
                              setExamForm({ ...examForm, total_points: newTotalPoints });

                              // Nếu có câu hỏi đã chọn, phân bố lại điểm đều (chỉ local state)
                              if (selectedQuestions.length > 0 && newTotalPoints >= 0) {
                                redistributePoints(newTotalPoints);
                              }
                            }}
                            disabled={examForm.question_selection_mode === 'first_on_exam' || examForm.question_selection_mode === 'random_on_exam'}
                            readOnly={examForm.question_selection_mode === 'first_on_exam' || examForm.question_selection_mode === 'random_on_exam'}
                          />
                          {examForm.question_selection_mode === 'first_on_exam' || examForm.question_selection_mode === 'random_on_exam' ? (
                            <Form.Text className="text-muted">
                              Tổng điểm được tính tự động từ ma trận đề thi (Phân bố theo độ khó hoặc Bloom's Taxonomy)
                            </Form.Text>
                          ) : selectedQuestions.length > 0 ? (
                            <Form.Text className="text-muted">
                              Thay đổi tổng điểm sẽ phân bố lại điểm đều cho {selectedQuestions.length} câu hỏi
                            </Form.Text>
                          ) : null}
                        </Form.Group>
                      </div>
                      <div className="col-md-4">
                        <Form.Group className="mb-3">
                          <Form.Label>Điểm đạt (%)</Form.Label>
                          <Form.Control
                            type="number"
                            value={examForm.passing_score}
                            onChange={(e) => setExamForm({ ...examForm, passing_score: parseInt(e.target.value) })}
                          />
                        </Form.Group>
                      </div>
                      <div className="col-md-4">
                        <Form.Group className="mb-3">
                          <Form.Label>Số lần làm tối đa</Form.Label>
                          <Form.Control
                            type="number"
                            value={examForm.max_attempts}
                            onChange={(e) => setExamForm({ ...examForm, max_attempts: parseInt(e.target.value) })}
                          />
                        </Form.Group>
                      </div>
                    </div>

                    <div className="row">
                      <div className="col-md-4">
                        <Form.Group className="mb-3">
                          <Form.Label>Thời gian mở</Form.Label>
                          <Form.Control
                            type="datetime-local"
                            value={examForm.scheduled_start}
                            onChange={(e) => setExamForm({ ...examForm, scheduled_start: e.target.value })}
                          />
                        </Form.Group>
                      </div>
                      <div className="col-md-4">
                        <Form.Group className="mb-3">
                          <Form.Label>Thời gian đóng</Form.Label>
                          <Form.Control
                            type="datetime-local"
                            value={examForm.scheduled_end}
                            onChange={(e) => setExamForm({ ...examForm, scheduled_end: e.target.value })}
                          />
                        </Form.Group>
                      </div>
                      <div className="col-md-4">
                        <Form.Group className="mb-3">
                          <Form.Label>
                            Thời gian hết hạn phúc khảo (ngày)
                            <i className="fas fa-info-circle ms-2 text-muted" 
                               title="Số ngày kể từ 'Thời gian mở' mà sinh viên có thể phúc khảo điểm thi. Mặc định 3 ngày."></i>
                          </Form.Label>
                          <Form.Control
                            type="number"
                            min="0"
                            value={examForm.appeal_deadline_days}
                            onChange={(e) => setExamForm({ ...examForm, appeal_deadline_days: parseInt(e.target.value) || 3 })}
                            placeholder="3"
                          />
                          <Form.Text className="text-muted">
                            Ví dụ: Nếu "Thời gian mở" là 05/01 và đặt 5 ngày, thì hết hạn phúc khảo là 10/01
                          </Form.Text>
                        </Form.Group>
                      </div>
                    </div>
                  </div>
                </Tab>

                {/* Anti-Cheating Tab */}
                <Tab eventKey="security" title={
                  <span>
                    <i className="fas fa-shield-alt me-2 text-danger"></i>
                    Gian lận
                  </span>
                }>
                  <div className="p-3">
                    <Form.Check
                      type="switch"
                      label="Xáo trộn câu hỏi"
                      checked={examForm.shuffle_questions}
                      onChange={(e) => setExamForm({ ...examForm, shuffle_questions: e.target.checked })}
                      className="mb-3"
                    />

                    <Form.Check
                      type="switch"
                      label="Xáo trộn đáp án"
                      checked={examForm.shuffle_options}
                      onChange={(e) => setExamForm({ ...examForm, shuffle_options: e.target.checked })}
                      className="mb-3"
                    />


                    <hr />

                    <Form.Check
                      type="switch"
                      label="Bật giám sát (Proctoring)"
                      checked={examForm.proctoring_enabled}
                      onChange={(e) => setExamForm({ ...examForm, proctoring_enabled: e.target.checked })}
                      className="mb-3"
                    />
                    <Form.Text className="text-muted mb-3 d-block">
                      Khi bật, hệ thống sẽ tự động phát hiện các hành vi gian lận như: chuyển tab, mất focus cửa sổ, cố gắng thoát trang.
                    </Form.Text>

                    <hr />

                    <Form.Check
                      type="switch"
                      label={
                        <span>
                          <i className="fas fa-lock me-2 text-warning"></i>
                          Sử dụng hệ thống an toàn IMS EXAM PCTU
                        </span>
                      }
                      checked={examForm.ims_exam_pctu_required}
                      onChange={(e) => setExamForm({ ...examForm, ims_exam_pctu_required: e.target.checked })}
                      className="mb-3"
                    />
                    <Form.Text className="text-muted mb-3 d-block">
                      Khi bật, sinh viên bắt buộc phải mở phần mềm IMS EXAM PCTU mới được vào thi. Phần mềm sẽ khóa các tính năng hệ thống để đảm bảo môi trường thi an toàn.
                    </Form.Text>

                    {examForm.ims_exam_pctu_required && (
                      <div className="bg-light rounded-lg p-3 mb-3">
                        <Form.Group className="mb-3">
                          <Form.Label>Miễn sử dụng IMS EXAM PCTU cho</Form.Label>
                          <Form.Select
                            value={examForm.ims_exam_pctu_config?.exempt_type || 'none'}
                            onChange={(e) => {
                              const newExemptType = e.target.value;
                              setExamForm({
                                ...examForm,
                                ims_exam_pctu_config: {
                                  ...examForm.ims_exam_pctu_config,
                                  exempt_type: newExemptType,
                                  // Reset exempt lists when changing type
                                  exempt_students: newExemptType === 'students' ? examForm.ims_exam_pctu_config?.exempt_students || [] : [],
                                  exempt_classes: newExemptType === 'classes' ? examForm.ims_exam_pctu_config?.exempt_classes || [] : [],
                                  exempt_groups: newExemptType === 'groups' ? examForm.ims_exam_pctu_config?.exempt_groups || [] : []
                                }
                              });
                            }}
                          >
                            <option value="none">Không miễn (tất cả đều phải sử dụng IMS EXAM PCTU)</option>
                            <option value="students">Chọn sinh viên được miễn</option>
                            <option value="classes">Chọn lớp được miễn</option>
                            <option value="groups">Chọn nhóm được miễn</option>
                          </Form.Select>
                          <Form.Text className="text-muted">
                            {examForm.ims_exam_pctu_config?.exempt_type === 'none'
                              ? 'Tất cả sinh viên đều phải sử dụng IMS EXAM PCTU để tham gia thi'
                              : examForm.ims_exam_pctu_config?.exempt_type === 'students'
                                ? 'Chọn các sinh viên được miễn sử dụng IMS EXAM PCTU. Các sinh viên khác vẫn phải sử dụng phần mềm.'
                                : examForm.ims_exam_pctu_config?.exempt_type === 'classes'
                                  ? 'Chọn các lớp được miễn sử dụng IMS EXAM PCTU. Các lớp khác vẫn phải sử dụng phần mềm.'
                                  : 'Chọn các nhóm được miễn sử dụng IMS EXAM PCTU. Các nhóm khác vẫn phải sử dụng phần mềm.'}
                          </Form.Text>
                        </Form.Group>

                        {/* Show exempt students selection */}
                        {examForm.ims_exam_pctu_config?.exempt_type === 'students' && (
                          <div className="mt-3">
                            <Form.Label className="fw-bold">Danh sách sinh viên được miễn:</Form.Label>
                            <div className="border rounded p-2" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                              {selectedStudents.length === 0 ? (
                                <Alert variant="warning" className="mb-0">
                                  <i className="fas fa-exclamation-triangle me-2"></i>
                                  Vui lòng chọn sinh viên trong tab "Sinh viên" trước, sau đó chọn những người được miễn ở đây.
                                </Alert>
                              ) : (
                                <div>
                                  {selectedStudents.map(student => {
                                    const isExempt = examForm.ims_exam_pctu_config?.exempt_students?.includes(student.id);
                                    return (
                                      <div key={student.id} className="d-flex align-items-center mb-2 p-2 border-bottom">
                                        <Form.Check
                                          type="checkbox"
                                          id={`ims-exempt-student-${student.id}`}
                                          checked={isExempt || false}
                                          onChange={(e) => {
                                            const currentExempt = examForm.ims_exam_pctu_config?.exempt_students || [];
                                            if (e.target.checked) {
                                              setExamForm({
                                                ...examForm,
                                                ims_exam_pctu_config: {
                                                  ...examForm.ims_exam_pctu_config,
                                                  exempt_students: [...currentExempt, student.id]
                                                }
                                              });
                                            } else {
                                              setExamForm({
                                                ...examForm,
                                                ims_exam_pctu_config: {
                                                  ...examForm.ims_exam_pctu_config,
                                                  exempt_students: currentExempt.filter(id => id !== student.id)
                                                }
                                              });
                                            }
                                          }}
                                        />
                                        <label htmlFor={`ims-exempt-student-${student.id}`} className="ms-2 mb-0" style={{ cursor: 'pointer', flex: 1 }}>
                                          Mã SV: <strong>{student.student_id}</strong> - Họ và tên: <strong>{student.full_name}</strong>
                                          <span className="text-muted ms-2">- Lớp: <strong>{student.class_name}</strong></span>
                                        </label>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            {examForm.ims_exam_pctu_config?.exempt_students?.length > 0 && (
                              <Alert variant="success" className="mt-2 mb-0">
                                <i className="fas fa-check-circle me-2"></i>
                                Đã chọn {examForm.ims_exam_pctu_config.exempt_students.length} sinh viên được miễn sử dụng IMS EXAM PCTU
                              </Alert>
                            )}
                          </div>
                        )}

                        {/* Show exempt classes selection */}
                        {examForm.ims_exam_pctu_config?.exempt_type === 'classes' && (
                          <div className="mt-3">
                            <Form.Label className="fw-bold">Danh sách lớp được miễn:</Form.Label>
                            <div className="border rounded p-2" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                              {classes.length === 0 ? (
                                <Alert variant="warning" className="mb-0">
                                  <i className="fas fa-exclamation-triangle me-2"></i>
                                  Đang tải danh sách lớp...
                                </Alert>
                              ) : (
                                <div>
                                  {classes.map(className => {
                                    const isExempt = examForm.ims_exam_pctu_config?.exempt_classes?.includes(className);
                                    const studentCount = selectedStudents.filter(s => s.class_name === className).length;
                                    return (
                                      <div key={className} className="d-flex align-items-center mb-2 p-2 border-bottom">
                                        <Form.Check
                                          type="checkbox"
                                          id={`ims-exempt-class-${className}`}
                                          checked={isExempt || false}
                                          onChange={(e) => {
                                            const currentExempt = examForm.ims_exam_pctu_config?.exempt_classes || [];
                                            if (e.target.checked) {
                                              setExamForm({
                                                ...examForm,
                                                ims_exam_pctu_config: {
                                                  ...examForm.ims_exam_pctu_config,
                                                  exempt_classes: [...currentExempt, className]
                                                }
                                              });
                                            } else {
                                              setExamForm({
                                                ...examForm,
                                                ims_exam_pctu_config: {
                                                  ...examForm.ims_exam_pctu_config,
                                                  exempt_classes: currentExempt.filter(c => c !== className)
                                                }
                                              });
                                            }
                                          }}
                                        />
                                        <label htmlFor={`ims-exempt-class-${className}`} className="ms-2 mb-0" style={{ cursor: 'pointer', flex: 1 }}>
                                          <strong>{className}</strong>
                                          {studentCount > 0 && (
                                            <span className="text-muted ms-2">
                                              ({studentCount} sinh viên)
                                            </span>
                                          )}
                                        </label>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            {examForm.ims_exam_pctu_config?.exempt_classes?.length > 0 && (
                              <Alert variant="success" className="mt-2 mb-0">
                                <i className="fas fa-check-circle me-2"></i>
                                Đã chọn {examForm.ims_exam_pctu_config.exempt_classes.length} lớp được miễn sử dụng IMS EXAM PCTU
                              </Alert>
                            )}
                          </div>
                        )}

                        {/* Show exempt groups selection */}
                        {examForm.ims_exam_pctu_config?.exempt_type === 'groups' && (
                          <div className="mt-3">
                            <Form.Label className="fw-bold">Danh sách nhóm được miễn:</Form.Label>
                            <div className="border rounded p-2" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                              {studentGroups.length === 0 ? (
                                <Alert variant="warning" className="mb-0">
                                  <i className="fas fa-exclamation-triangle me-2"></i>
                                  Không có nhóm nào trong danh sách. Vui lòng chọn nhóm trong tab "Sinh viên".
                                </Alert>
                              ) : (
                                <div>
                                  {studentGroups.map(group => {
                                    const isExempt = examForm.ims_exam_pctu_config?.exempt_groups?.includes(group.id || group.group_id);
                                    return (
                                      <div key={group.id || group.group_id} className="d-flex align-items-center mb-2 p-2 border-bottom">
                                        <Form.Check
                                          type="checkbox"
                                          id={`ims-exempt-group-${group.id || group.group_id}`}
                                          checked={isExempt || false}
                                          onChange={(e) => {
                                            const groupId = group.id || group.group_id;
                                            const currentExempt = examForm.ims_exam_pctu_config?.exempt_groups || [];
                                            if (e.target.checked) {
                                              setExamForm({
                                                ...examForm,
                                                ims_exam_pctu_config: {
                                                  ...examForm.ims_exam_pctu_config,
                                                  exempt_groups: [...currentExempt, groupId]
                                                }
                                              });
                                            } else {
                                              setExamForm({
                                                ...examForm,
                                                ims_exam_pctu_config: {
                                                  ...examForm.ims_exam_pctu_config,
                                                  exempt_groups: currentExempt.filter(g => g !== groupId)
                                                }
                                              });
                                            }
                                          }}
                                        />
                                        <label htmlFor={`ims-exempt-group-${group.id || group.group_id}`} className="ms-2 mb-0" style={{ cursor: 'pointer', flex: 1 }}>
                                          <strong>{group.group_name || group.name}</strong>
                                          {group.description && <span className="text-muted ms-2">({group.description})</span>}
                                        </label>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            {examForm.ims_exam_pctu_config?.exempt_groups?.length > 0 && (
                              <Alert variant="success" className="mt-2 mb-0">
                                <i className="fas fa-check-circle me-2"></i>
                                Đã chọn {examForm.ims_exam_pctu_config.exempt_groups.length} nhóm được miễn sử dụng IMS EXAM PCTU
                              </Alert>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <hr />

                    <Form.Check
                      type="switch"
                      label="Hiển thị và Ghi lại webcam"
                      checked={examForm.webcam_required}
                      onChange={(e) => setExamForm({ ...examForm, webcam_required: e.target.checked })}
                      className="mb-3"
                    />
                    <Form.Text className="text-muted mb-3 d-block">
                      Khi bật, sinh viên bắt buộc phải mở webcam để tham gia thi. Webcam sẽ được ghi lại trong suốt quá trình thi.
                    </Form.Text>

                    {examForm.webcam_required && (
                      <div className="bg-light rounded-lg p-3 mb-3">
                        <Form.Group className="mb-3">
                          <Form.Label>Miễn webcam cho</Form.Label>
                          <Form.Select
                            value={examForm.webcam_config?.exempt_type || 'none'}
                            onChange={(e) => {
                              const newExemptType = e.target.value;
                              setExamForm({
                                ...examForm,
                                webcam_config: {
                                  ...examForm.webcam_config,
                                  exempt_type: newExemptType,
                                  // Reset exempt lists when changing type
                                  exempt_students: newExemptType === 'students' ? examForm.webcam_config?.exempt_students || [] : [],
                                  exempt_classes: newExemptType === 'classes' ? examForm.webcam_config?.exempt_classes || [] : [],
                                  exempt_groups: newExemptType === 'groups' ? examForm.webcam_config?.exempt_groups || [] : []
                                }
                              });
                            }}
                          >
                            <option value="none">Không miễn (tất cả đều phải bật webcam)</option>
                            <option value="students">Chọn sinh viên được miễn</option>
                            <option value="classes">Chọn lớp được miễn</option>
                            <option value="groups">Chọn nhóm được miễn</option>
                          </Form.Select>
                          <Form.Text className="text-muted">
                            {examForm.webcam_config?.exempt_type === 'none'
                              ? 'Tất cả sinh viên đều phải bật webcam để tham gia thi'
                              : examForm.webcam_config?.exempt_type === 'students'
                                ? 'Chọn các sinh viên được miễn webcam. Các sinh viên khác vẫn phải bật webcam.'
                                : examForm.webcam_config?.exempt_type === 'classes'
                                  ? 'Chọn các lớp được miễn webcam. Các lớp khác vẫn phải bật webcam.'
                                  : 'Chọn các nhóm được miễn webcam. Các nhóm khác vẫn phải bật webcam.'}
                          </Form.Text>
                        </Form.Group>

                        {/* Show exempt students selection */}
                        {examForm.webcam_config?.exempt_type === 'students' && (
                          <div className="mt-3">
                            <Form.Label className="fw-bold">Danh sách sinh viên được miễn:</Form.Label>
                            <div className="border rounded p-2" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                              {selectedStudents.length === 0 ? (
                                <Alert variant="warning" className="mb-0">
                                  <i className="fas fa-exclamation-triangle me-2"></i>
                                  Vui lòng chọn sinh viên trong tab "Sinh viên" trước, sau đó chọn những người được miễn ở đây.
                                </Alert>
                              ) : (
                                <div>
                                  {selectedStudents.map(student => {
                                    const isExempt = examForm.webcam_config?.exempt_students?.includes(student.id);
                                    return (
                                      <div key={student.id} className="d-flex align-items-center mb-2 p-2 border-bottom">
                                        <Form.Check
                                          type="checkbox"
                                          id={`webcam-exempt-student-${student.id}`}
                                          checked={isExempt || false}
                                          onChange={(e) => {
                                            const currentExempt = examForm.webcam_config?.exempt_students || [];
                                            if (e.target.checked) {
                                              setExamForm({
                                                ...examForm,
                                                webcam_config: {
                                                  ...examForm.webcam_config,
                                                  exempt_students: [...currentExempt, student.id]
                                                }
                                              });
                                            } else {
                                              setExamForm({
                                                ...examForm,
                                                webcam_config: {
                                                  ...examForm.webcam_config,
                                                  exempt_students: currentExempt.filter(id => id !== student.id)
                                                }
                                              });
                                            }
                                          }}
                                        />
                                        <label htmlFor={`webcam-exempt-student-${student.id}`} className="ms-2 mb-0" style={{ cursor: 'pointer', flex: 1 }}>
                                          Mã SV: <strong>{student.student_id}</strong> - Họ và tên: <strong>{student.full_name}</strong>
                                          <span className="text-muted ms-2">- Lớp: <strong>{student.class_name}</strong></span>
                                        </label>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            {examForm.webcam_config?.exempt_students?.length > 0 && (
                              <Alert variant="success" className="mt-2 mb-0">
                                <i className="fas fa-check-circle me-2"></i>
                                Đã chọn {examForm.webcam_config.exempt_students.length} sinh viên được miễn webcam
                              </Alert>
                            )}
                          </div>
                        )}

                        {/* Show exempt classes selection */}
                        {examForm.webcam_config?.exempt_type === 'classes' && (
                          <div className="mt-3">
                            <Form.Label className="fw-bold">Danh sách lớp được miễn:</Form.Label>
                            <div className="border rounded p-2" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                              {classes.length === 0 ? (
                                <Alert variant="warning" className="mb-0">
                                  <i className="fas fa-exclamation-triangle me-2"></i>
                                  Đang tải danh sách lớp...
                                </Alert>
                              ) : (
                                <div>
                                  {classes.map(className => {
                                    const isExempt = examForm.webcam_config?.exempt_classes?.includes(className);
                                    const studentCount = selectedStudents.filter(s => s.class_name === className).length;
                                    return (
                                      <div key={className} className="d-flex align-items-center mb-2 p-2 border-bottom">
                                        <Form.Check
                                          type="checkbox"
                                          id={`webcam-exempt-class-${className}`}
                                          checked={isExempt || false}
                                          onChange={(e) => {
                                            const currentExempt = examForm.webcam_config?.exempt_classes || [];
                                            if (e.target.checked) {
                                              setExamForm({
                                                ...examForm,
                                                webcam_config: {
                                                  ...examForm.webcam_config,
                                                  exempt_classes: [...currentExempt, className]
                                                }
                                              });
                                            } else {
                                              setExamForm({
                                                ...examForm,
                                                webcam_config: {
                                                  ...examForm.webcam_config,
                                                  exempt_classes: currentExempt.filter(c => c !== className)
                                                }
                                              });
                                            }
                                          }}
                                        />
                                        <label htmlFor={`webcam-exempt-class-${className}`} className="ms-2 mb-0" style={{ cursor: 'pointer', flex: 1 }}>
                                          <strong>{className}</strong>
                                          {studentCount > 0 && (
                                            <span className="text-muted ms-2">
                                              ({studentCount} sinh viên)
                                            </span>
                                          )}
                                        </label>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            {examForm.webcam_config?.exempt_classes?.length > 0 && (
                              <Alert variant="success" className="mt-2 mb-0">
                                <i className="fas fa-check-circle me-2"></i>
                                Đã chọn {examForm.webcam_config.exempt_classes.length} lớp được miễn webcam
                              </Alert>
                            )}
                          </div>
                        )}

                        {/* Show exempt groups selection */}
                        {examForm.webcam_config?.exempt_type === 'groups' && (
                          <div className="mt-3">
                            <Form.Label className="fw-bold">Danh sách nhóm được miễn:</Form.Label>
                            <div className="border rounded p-2" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                              {studentGroups.length === 0 ? (
                                <Alert variant="warning" className="mb-0">
                                  <i className="fas fa-exclamation-triangle me-2"></i>
                                  Không có nhóm nào trong danh sách. Vui lòng chọn nhóm trong tab "Sinh viên".
                                </Alert>
                              ) : (
                                <div>
                                  {studentGroups.map(group => {
                                    const isExempt = examForm.webcam_config?.exempt_groups?.includes(group.id || group.group_id);
                                    return (
                                      <div key={group.id || group.group_id} className="d-flex align-items-center mb-2 p-2 border-bottom">
                                        <Form.Check
                                          type="checkbox"
                                          id={`webcam-exempt-group-${group.id || group.group_id}`}
                                          checked={isExempt || false}
                                          onChange={(e) => {
                                            const groupId = group.id || group.group_id;
                                            const currentExempt = examForm.webcam_config?.exempt_groups || [];
                                            if (e.target.checked) {
                                              setExamForm({
                                                ...examForm,
                                                webcam_config: {
                                                  ...examForm.webcam_config,
                                                  exempt_groups: [...currentExempt, groupId]
                                                }
                                              });
                                            } else {
                                              setExamForm({
                                                ...examForm,
                                                webcam_config: {
                                                  ...examForm.webcam_config,
                                                  exempt_groups: currentExempt.filter(g => g !== groupId)
                                                }
                                              });
                                            }
                                          }}
                                        />
                                        <label htmlFor={`webcam-exempt-group-${group.id || group.group_id}`} className="ms-2 mb-0" style={{ cursor: 'pointer', flex: 1 }}>
                                          <strong>{group.group_name || group.name}</strong>
                                          {group.description && <span className="text-muted ms-2">({group.description})</span>}
                                        </label>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            {examForm.webcam_config?.exempt_groups?.length > 0 && (
                              <Alert variant="success" className="mt-2 mb-0">
                                <i className="fas fa-check-circle me-2"></i>
                                Đã chọn {examForm.webcam_config.exempt_groups.length} nhóm được miễn webcam
                              </Alert>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <hr />

                    <Form.Group className="mb-3">
                      <Form.Label>Giới hạn IP (phân cách bởi dấu phẩy)</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="192.168.1.0/24, 10.0.0.0/8"
                        value={examForm.ip_restrictions}
                        onChange={(e) => setExamForm({ ...examForm, ip_restrictions: e.target.value })}
                      />
                      <Form.Text className="text-muted">
                        Để trống nếu không giới hạn IP
                      </Form.Text>
                    </Form.Group>

                    <hr />

                    <Form.Group className="mb-3">
                      <Form.Label>Mật khẩu kỳ thi</Form.Label>
                      <Form.Control
                        type="password"
                        placeholder="Nhập mật khẩu (để trống nếu không yêu cầu)"
                        value={examForm.exam_password}
                        onChange={(e) => setExamForm({ ...examForm, exam_password: e.target.value })}
                      />
                      <Form.Text className="text-muted">
                        Nếu có mật khẩu, sinh viên phải nhập đúng mật khẩu mới được tham gia thi
                      </Form.Text>
                    </Form.Group>

                    <hr />

                    <Form.Check
                      type="switch"
                      label="Bật nhận diện khuôn mặt trước khi vào thi"
                      checked={examForm.face_verification_enabled}
                      onChange={(e) => setExamForm({ ...examForm, face_verification_enabled: e.target.checked })}
                      className="mb-3"
                    />
                    <Form.Text className="text-muted mb-3 d-block">
                      Khi bật, sinh viên phải xác minh khuôn mặt trước khi được phép vào thi. Nếu khuôn mặt không khớp hoặc chưa đăng ký mẫu khuôn mặt, sinh viên sẽ không được vào thi.
                    </Form.Text>

                    {examForm.face_verification_enabled && (
                      <div className="bg-light rounded-lg p-3 mb-3">
                        <Form.Group className="mb-3">
                          <Form.Label>Miễn nhận diện khuôn mặt cho</Form.Label>
                          <Form.Select
                            value={examForm.face_verification_config?.exempt_type || 'none'}
                            onChange={(e) => {
                              const newExemptType = e.target.value;
                              setExamForm({
                                ...examForm,
                                face_verification_config: {
                                  ...examForm.face_verification_config,
                                  exempt_type: newExemptType,
                                  // Reset exempt lists when changing type
                                  exempt_students: newExemptType === 'students' ? examForm.face_verification_config?.exempt_students || [] : [],
                                  exempt_classes: newExemptType === 'classes' ? examForm.face_verification_config?.exempt_classes || [] : [],
                                  exempt_groups: newExemptType === 'groups' ? examForm.face_verification_config?.exempt_groups || [] : []
                                }
                              });
                            }}
                          >
                            <option value="none">Không miễn (tất cả đều phải nhận diện)</option>
                            <option value="students">Chọn sinh viên được miễn</option>
                            <option value="classes">Chọn lớp được miễn</option>
                            <option value="groups">Chọn nhóm được miễn</option>
                          </Form.Select>
                          <Form.Text className="text-muted">
                            {examForm.face_verification_config?.exempt_type === 'none'
                              ? 'Tất cả sinh viên đều phải nhận diện khuôn mặt trước khi vào thi'
                              : examForm.face_verification_config?.exempt_type === 'students'
                                ? 'Chọn các sinh viên được miễn nhận diện khuôn mặt. Các sinh viên khác vẫn phải nhận diện.'
                                : examForm.face_verification_config?.exempt_type === 'classes'
                                  ? 'Chọn các lớp được miễn nhận diện khuôn mặt. Các lớp khác vẫn phải nhận diện.'
                                  : 'Chọn các nhóm được miễn nhận diện khuôn mặt. Các nhóm khác vẫn phải nhận diện.'}
                          </Form.Text>
                        </Form.Group>

                        {/* Show exempt students selection */}
                        {examForm.face_verification_config?.exempt_type === 'students' && (
                          <div className="mt-3">
                            <Form.Label className="fw-bold">Danh sách sinh viên được miễn:</Form.Label>
                            <div className="border rounded p-2" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                              {selectedStudents.length === 0 ? (
                                <Alert variant="warning" className="mb-0">
                                  <i className="fas fa-exclamation-triangle me-2"></i>
                                  Vui lòng chọn sinh viên trong tab "Sinh viên" trước, sau đó chọn những người được miễn ở đây.
                                </Alert>
                              ) : (
                                <div>
                                  {selectedStudents.map(student => {
                                    const isExempt = examForm.face_verification_config?.exempt_students?.includes(student.id);
                                    return (
                                      <div key={student.id} className="d-flex align-items-center mb-2 p-2 border-bottom">
                                        <Form.Check
                                          type="checkbox"
                                          id={`exempt-student-${student.id}`}
                                          checked={isExempt || false}
                                          onChange={(e) => {
                                            const currentExempt = examForm.face_verification_config?.exempt_students || [];
                                            if (e.target.checked) {
                                              setExamForm({
                                                ...examForm,
                                                face_verification_config: {
                                                  ...examForm.face_verification_config,
                                                  exempt_students: [...currentExempt, student.id]
                                                }
                                              });
                                            } else {
                                              setExamForm({
                                                ...examForm,
                                                face_verification_config: {
                                                  ...examForm.face_verification_config,
                                                  exempt_students: currentExempt.filter(id => id !== student.id)
                                                }
                                              });
                                            }
                                          }}
                                        />
                                        <label htmlFor={`exempt-student-${student.id}`} className="ms-2 mb-0" style={{ cursor: 'pointer', flex: 1 }}>
                                          Mã SV: <strong>{student.student_id}</strong> - Họ và tên: <strong>{student.full_name}</strong>
                                          <span className="text-muted ms-2">- Lớp: <strong>{student.class_name}</strong></span>
                                        </label>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            {examForm.face_verification_config?.exempt_students?.length > 0 && (
                              <Alert variant="success" className="mt-2 mb-0">
                                <i className="fas fa-check-circle me-2"></i>
                                Đã chọn {examForm.face_verification_config.exempt_students.length} sinh viên được miễn nhận diện khuôn mặt
                              </Alert>
                            )}
                          </div>
                        )}

                        {/* Show exempt classes selection */}
                        {examForm.face_verification_config?.exempt_type === 'classes' && (
                          <div className="mt-3">
                            <Form.Label className="fw-bold">Danh sách lớp được miễn:</Form.Label>
                            <div className="border rounded p-2" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                              {classes.length === 0 ? (
                                <Alert variant="warning" className="mb-0">
                                  <i className="fas fa-exclamation-triangle me-2"></i>
                                  Đang tải danh sách lớp...
                                </Alert>
                              ) : (
                                <div>
                                  {classes.map(className => {
                                    const isExempt = examForm.face_verification_config?.exempt_classes?.includes(className);
                                    const studentCount = selectedStudents.filter(s => s.class_name === className).length;
                                    return (
                                      <div key={className} className="d-flex align-items-center mb-2 p-2 border-bottom">
                                        <Form.Check
                                          type="checkbox"
                                          id={`exempt-class-${className}`}
                                          checked={isExempt || false}
                                          onChange={(e) => {
                                            const currentExempt = examForm.face_verification_config?.exempt_classes || [];
                                            if (e.target.checked) {
                                              setExamForm({
                                                ...examForm,
                                                face_verification_config: {
                                                  ...examForm.face_verification_config,
                                                  exempt_classes: [...currentExempt, className]
                                                }
                                              });
                                            } else {
                                              setExamForm({
                                                ...examForm,
                                                face_verification_config: {
                                                  ...examForm.face_verification_config,
                                                  exempt_classes: currentExempt.filter(c => c !== className)
                                                }
                                              });
                                            }
                                          }}
                                        />
                                        <label htmlFor={`exempt-class-${className}`} className="ms-2 mb-0" style={{ cursor: 'pointer', flex: 1 }}>
                                          <strong>{className}</strong>
                                          {studentCount > 0 && (
                                            <span className="text-muted ms-2">
                                              ({studentCount} sinh viên)
                                            </span>
                                          )}
                                        </label>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            {examForm.face_verification_config?.exempt_classes?.length > 0 && (
                              <Alert variant="success" className="mt-2 mb-0">
                                <i className="fas fa-check-circle me-2"></i>
                                Đã chọn {examForm.face_verification_config.exempt_classes.length} lớp được miễn nhận diện khuôn mặt
                              </Alert>
                            )}
                          </div>
                        )}

                        {/* Show exempt groups selection */}
                        {examForm.face_verification_config?.exempt_type === 'groups' && (
                          <div className="mt-3">
                            <Form.Label className="fw-bold">Danh sách nhóm được miễn:</Form.Label>
                            <div className="border rounded p-2" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                              {studentGroups.length === 0 ? (
                                <Alert variant="warning" className="mb-0">
                                  <i className="fas fa-exclamation-triangle me-2"></i>
                                  Không có nhóm nào trong danh sách. Vui lòng chọn nhóm trong tab "Sinh viên".
                                </Alert>
                              ) : (
                                <div>
                                  {studentGroups.map(group => {
                                    const isExempt = examForm.face_verification_config?.exempt_groups?.includes(group.id || group.group_id);
                                    return (
                                      <div key={group.id || group.group_id} className="d-flex align-items-center mb-2 p-2 border-bottom">
                                        <Form.Check
                                          type="checkbox"
                                          id={`exempt-group-${group.id || group.group_id}`}
                                          checked={isExempt || false}
                                          onChange={(e) => {
                                            const groupId = group.id || group.group_id;
                                            const currentExempt = examForm.face_verification_config?.exempt_groups || [];
                                            if (e.target.checked) {
                                              setExamForm({
                                                ...examForm,
                                                face_verification_config: {
                                                  ...examForm.face_verification_config,
                                                  exempt_groups: [...currentExempt, groupId]
                                                }
                                              });
                                            } else {
                                              setExamForm({
                                                ...examForm,
                                                face_verification_config: {
                                                  ...examForm.face_verification_config,
                                                  exempt_groups: currentExempt.filter(g => g !== groupId)
                                                }
                                              });
                                            }
                                          }}
                                        />
                                        <label htmlFor={`exempt-group-${group.id || group.group_id}`} className="ms-2 mb-0" style={{ cursor: 'pointer', flex: 1 }}>
                                          <strong>{group.group_name || group.name}</strong>
                                          {group.description && <span className="text-muted ms-2">({group.description})</span>}
                                        </label>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            {examForm.face_verification_config?.exempt_groups?.length > 0 && (
                              <Alert variant="success" className="mt-2 mb-0">
                                <i className="fas fa-check-circle me-2"></i>
                                Đã chọn {examForm.face_verification_config.exempt_groups.length} nhóm được miễn nhận diện khuôn mặt
                              </Alert>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Tab>

                {/* Settings Tab */}
                <Tab eventKey="settings" title={
                  <span>
                    <i className="fas fa-cog me-2"></i>
                    Hiển thị
                  </span>
                }>
                  <div className="p-3">


                    {/* Màn hình lúc thi */}
                    <div className="mb-4">
                      <h6 className="mb-3">
                        <i className="fas fa-desktop me-2"></i>
                        Màn hình lúc thi
                      </h6>

                      {/* Chỉnh sửa tiêu đề và danh sách */}
                      <Form.Group className="mb-3">
                        <Form.Label>Tiêu đề</Form.Label>
                        <Form.Control
                          type="text"
                          value={examForm.instructions_title || 'Hướng dẫn'}
                          onChange={(e) => setExamForm({ ...examForm, instructions_title: e.target.value })}
                          placeholder="Nhập tiêu đề"
                        />
                        <Form.Text className="text-muted">
                          Tiêu đề hiển thị khi sinh viên làm bài
                        </Form.Text>
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>Mô tả</Form.Label>
                        <div className="border rounded p-3" style={{ backgroundColor: '#f8f9fa' }}>
                          {(examForm.instructions_list || []).map((instruction, index) => (
                            <div key={index} className="d-flex align-items-center mb-2">
                              <Form.Control
                                type="text"
                                value={instruction}
                                onChange={(e) => {
                                  const newList = [...(examForm.instructions_list || [])];
                                  newList[index] = e.target.value;
                                  setExamForm({ ...examForm, instructions_list: newList });
                                }}
                                placeholder={`Mô tả ${index + 1}`}
                                className="me-2"
                              />
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => {
                                  const newList = [...(examForm.instructions_list || [])];
                                  newList.splice(index, 1);
                                  setExamForm({ ...examForm, instructions_list: newList });
                                }}
                                disabled={(examForm.instructions_list || []).length <= 1}
                              >
                                <i className="fas fa-times"></i>
                              </Button>
                            </div>
                          ))}
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => {
                              const newList = [...(examForm.instructions_list || []), ''];
                              setExamForm({ ...examForm, instructions_list: newList });
                            }}
                          >
                            <i className="fas fa-plus me-1"></i>
                            Thêm mô tả
                          </Button>
                        </div>
                        <Form.Text className="text-muted">
                          Danh sách các mô tả hiển thị cho sinh viên khi làm bài
                        </Form.Text>
                      </Form.Group>

                      {/* Hiển thị điểm của mỗi câu */}
                      <Form.Group className="mb-3">
                        <Form.Check
                          type="checkbox"
                          id="show_points_per_question"
                          label="Hiển thị điểm của mỗi câu"
                          checked={examForm.show_points_per_question || false}
                          onChange={(e) => setExamForm({ ...examForm, show_points_per_question: e.target.checked })}
                        />
                        <Form.Text className="text-muted">
                          Nếu bật, sinh viên sẽ thấy điểm số của từng câu hỏi khi làm bài
                        </Form.Text>
                      </Form.Group>

                      {/* Hiển thị câu hỏi trên mỗi trang */}
                      <Form.Group className="mb-3">
                        <Form.Label>Hiển thị câu hỏi trên mỗi trang</Form.Label>
                        <Form.Select
                          value={examForm.questions_per_page || 'all'}
                          onChange={(e) => setExamForm({ ...examForm, questions_per_page: e.target.value })}
                        >
                          <option value="1">1 câu trên trang</option>
                          <option value="2">2 câu trên trang</option>
                          <option value="3">3 câu trên trang</option>
                          <option value="4">4 câu trên trang</option>
                          <option value="5">5 câu trên trang</option>
                          <option value="6">6 câu trên trang</option>
                          <option value="7">7 câu trên trang</option>
                          <option value="8">8 câu trên trang</option>
                          <option value="9">9 câu trên trang</option>
                          <option value="10">10 câu trên trang</option>
                          <option value="all">Tất cả câu hỏi</option>
                        </Form.Select>
                        <Form.Text className="text-muted">
                          Chọn số câu hỏi hiển thị trên mỗi trang khi sinh viên làm bài
                        </Form.Text>
                      </Form.Group>

                      {/* Cho phép xem lại câu trước */}
                      <Form.Group className="mb-3">
                        <Form.Check
                          type="checkbox"
                          id="allow_backtrack"
                          label="Cho phép xem lại câu trước"
                          checked={examForm.allow_backtrack !== false}
                          onChange={(e) => setExamForm({ ...examForm, allow_backtrack: e.target.checked })}
                        />
                        <Form.Text className="text-muted">
                          Nếu tắt, sinh viên sẽ nhận cảnh báo xác nhận khi chuyển câu hỏi nếu chưa trả lời
                        </Form.Text>
                      </Form.Group>

                      {/* Thanh tiến độ câu đã làm */}
                      <Form.Group className="mb-3">
                        <Form.Check
                          type="checkbox"
                          id="show_progress_bar"
                          label="Thanh tiến độ câu đã làm"
                          checked={examForm.show_progress_bar !== false}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setExamForm({
                              ...examForm,
                              show_progress_bar: checked,
                              // Nếu bỏ tick "Thanh tiến độ", tự động bỏ tick "Số câu đã làm"
                              show_answered_count: checked ? examForm.show_answered_count : false
                            });
                          }}
                        />
                      </Form.Group>

                      {/* Số câu đã làm (Hiển thị trong thanh tiến độ) - Chỉ hiển thị khi "Thanh tiến độ" được tick */}
                      {examForm.show_progress_bar !== false && (
                        <Form.Group className="mb-3">
                          <Form.Check
                            type="checkbox"
                            id="show_answered_count"
                            label="Số câu đã làm (Hiển thị trong thanh tiến độ)"
                            checked={examForm.show_answered_count !== false}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setExamForm({
                                ...examForm,
                                show_answered_count: checked,
                                // Nếu tick "Số câu đã làm", tự động tick "Thanh tiến độ"
                                show_progress_bar: checked ? true : examForm.show_progress_bar
                              });
                            }}
                          />
                        </Form.Group>
                      )}

                      {/* Hiển thị "Trang n/n" */}
                      <Form.Group className="mb-3">
                        <Form.Check
                          type="checkbox"
                          id="show_page_number"
                          label={<>Hiển thị &quot;Trang n/n&quot;</>}
                          checked={examForm.show_page_number !== false}
                          onChange={(e) => setExamForm({ ...examForm, show_page_number: e.target.checked })}
                        />
                      </Form.Group>
                    </div>
                    <hr />

                    {/* Hiển thị kết quả sau khi */}
                    <Form.Group className="mb-3">
                      <Form.Label>Hiển thị kết quả sau khi</Form.Label>
                      <div className="border rounded p-3" style={{ backgroundColor: '#f8f9fa' }}>
                        <Form.Check
                          type="checkbox"
                          id="hide_results"
                          label="Không hiển thị"
                          checked={examForm.show_results_after?.hide_results || false}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setExamForm({
                              ...examForm,
                              show_results_after: {
                                ...examForm.show_results_after,
                                hide_results: checked,
                                // Nếu chọn "Không hiển thị", bỏ chọn tất cả options khác
                                ...(checked ? {
                                  show_results_only: false,
                                  show_questions_list: false,
                                  show_question_result: false,
                                  show_question_options: false,
                                  show_answers: false,
                                  show_timestamps: false
                                } : {})
                              }
                            });
                          }}
                          className="mb-2"
                        />
                        <Form.Check
                          type="checkbox"
                          id="show_results_only"
                          label="Hiển thị kết quả thi"
                          checked={examForm.show_results_after?.show_results_only || false}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setExamForm({
                              ...examForm,
                              show_results_after: {
                                ...examForm.show_results_after,
                                show_results_only: checked,
                                hide_results: checked ? false : examForm.show_results_after?.hide_results || false
                              }
                            });
                          }}
                          className="mb-2"
                        />
                        <Form.Check
                          type="checkbox"
                          id="show_questions_list"
                          label="Hiển thị danh sách các câu hỏi mà sinh viên đã làm trước đó"
                          checked={examForm.show_results_after?.show_questions_list || false}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setExamForm({
                              ...examForm,
                              show_results_after: {
                                ...examForm.show_results_after,
                                show_questions_list: checked,
                                // Nếu chọn hiển thị danh sách câu hỏi, tự động chọn hiển thị kết quả thi
                                show_results_only: checked ? true : examForm.show_results_after?.show_results_only || false,
                                hide_results: checked ? false : examForm.show_results_after?.hide_results || false
                              }
                            });
                          }}
                          className="mb-2"
                        />
                        <Form.Check
                          type="checkbox"
                          id="show_question_result"
                          label="Hiển thị kết quả của câu hỏi đó"
                          checked={examForm.show_results_after?.show_question_result || false}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setExamForm({
                              ...examForm,
                              show_results_after: {
                                ...examForm.show_results_after,
                                show_question_result: checked,
                                // Nếu chọn hiển thị kết quả câu hỏi, tự động chọn hiển thị danh sách câu hỏi và hiển thị kết quả thi
                                show_questions_list: checked ? true : examForm.show_results_after?.show_questions_list || false,
                                show_results_only: checked ? true : examForm.show_results_after?.show_results_only || false,
                                hide_results: checked ? false : examForm.show_results_after?.hide_results || false
                              }
                            });
                          }}
                          className="mb-2"
                        />
                        <Form.Check
                          type="checkbox"
                          id="show_question_options"
                          label="Các option của câu hỏi"
                          checked={examForm.show_results_after?.show_question_options || false}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setExamForm({
                              ...examForm,
                              show_results_after: {
                                ...examForm.show_results_after,
                                show_question_options: checked,
                                // Nếu chọn hiển thị đáp án câu hỏi, tự động chọn hiển thị danh sách câu hỏi và hiển thị kết quả thi
                                show_questions_list: checked ? true : examForm.show_results_after?.show_questions_list || false,
                                show_results_only: checked ? true : examForm.show_results_after?.show_results_only || false,
                                hide_results: checked ? false : examForm.show_results_after?.hide_results || false
                              }
                            });
                          }}
                          className="mb-2"
                        />
                        <Form.Check
                          type="checkbox"
                          id="show_answers"
                          label="Hiển thị đáp án mà sinh viên đã chọn"
                          checked={examForm.show_results_after?.show_answers || false}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setExamForm({
                              ...examForm,
                              show_results_after: {
                                ...examForm.show_results_after,
                                show_answers: checked,
                                // Nếu chọn hiển thị đáp án, tự động chọn các option của câu hỏi, hiển thị danh sách câu hỏi và hiển thị kết quả thi
                                show_question_options: checked ? true : examForm.show_results_after?.show_question_options || false,
                                show_questions_list: checked ? true : examForm.show_results_after?.show_questions_list || false,
                                show_results_only: checked ? true : examForm.show_results_after?.show_results_only || false,
                                hide_results: checked ? false : examForm.show_results_after?.hide_results || false
                              }
                            });
                          }}
                          className="mb-2"
                        />
                        <Form.Check
                          type="checkbox"
                          id="show_timestamps"
                          label="Hiển thị thời gian thực lúc chọn đáp án"
                          checked={examForm.show_results_after?.show_timestamps || false}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setExamForm({
                              ...examForm,
                              show_results_after: {
                                ...examForm.show_results_after,
                                show_timestamps: checked,
                                // Nếu chọn hiển thị timestamp, tự động chọn hiển thị đáp án, các option của câu hỏi và danh sách câu hỏi
                                show_answers: checked ? true : examForm.show_results_after?.show_answers || false,
                                show_question_options: checked ? true : examForm.show_results_after?.show_question_options || false,
                                show_questions_list: checked ? true : examForm.show_results_after?.show_questions_list || false,
                                hide_results: checked ? false : examForm.show_results_after?.hide_results || false
                              }
                            });
                          }}
                          className="mb-2"
                        />
                      </div>
                      <Form.Text className="text-muted">
                        Chọn các tùy chọn hiển thị kết quả sau khi sinh viên nộp bài (có thể chọn nhiều)
                      </Form.Text>
                    </Form.Group>

                  </div>
                </Tab>


                {/* Mail Notification Tab */}
                <Tab eventKey="mail" title={
                  <span>
                    <i className="fas fa-envelope me-2"></i>
                    Thông báo
                  </span>
                }>
                  <div className="p-3">
                    {/* Thông báo sẽ gửi khi nào */}
                    <div className="mb-4">
                      <h6 className="mb-3">
                        <i className="fas fa-clock me-2"></i>
                        Thông báo sẽ gửi khi nào
                      </h6>

                      <div className="border rounded p-3" style={{ backgroundColor: '#f8f9fa' }}>
                        <Form.Check
                          type="checkbox"
                          id="email_send_on_approval"
                          label="Lúc duyệt xong"
                          checked={examForm.email_notification_config?.send_on_approval || false}
                          onChange={(e) => setExamForm({
                            ...examForm,
                            email_notification_config: {
                              ...examForm.email_notification_config,
                              send_on_approval: e.target.checked
                            }
                          })}
                          className="mb-2"
                        />

                        <div className="d-flex align-items-center mb-2">
                          <Form.Check
                            type="checkbox"
                            id="email_send_before_start"
                            label="Trước lúc &quot;Thời gian Mở&quot;"
                            checked={examForm.email_notification_config?.send_before_start || false}
                            onChange={(e) => setExamForm({
                              ...examForm,
                              email_notification_config: {
                                ...examForm.email_notification_config,
                                send_before_start: e.target.checked
                              }
                            })}
                            className="me-3"
                          />

                          {examForm.email_notification_config?.send_before_start && (
                            <>
                              <Form.Control
                                type="number"
                                min="1"
                                value={examForm.email_notification_config?.before_start_duration || 60}
                                onChange={(e) => setExamForm({
                                  ...examForm,
                                  email_notification_config: {
                                    ...examForm.email_notification_config,
                                    before_start_duration: parseInt(e.target.value) || 60
                                  }
                                })}
                                style={{ width: '100px' }}
                                className="me-2"
                              />
                              <Form.Label className="mb-0">phút</Form.Label>
                            </>
                          )}
                        </div>

                        <Form.Text className="text-muted">
                          Chọn một hoặc nhiều thời điểm để gửi thông báo kỳ thi đến sinh viên (có thể chọn nhiều)
                        </Form.Text>
                      </div>
                    </div>

                    <hr />

                    {/* Gửi kết quả sau khi thi */}
                    <div className="mb-3">
                      <h6 className="mb-3">
                        <i className="fas fa-chart-line me-2"></i>
                        Gửi kết quả sau khi thi đến cho sinh viên
                      </h6>

                      <Form.Check
                        type="switch"
                        id="email_results_enabled"
                        label="Bật/Tắt gửi kết quả qua email"
                        checked={examForm.email_results_config?.enabled || false}
                        onChange={(e) => setExamForm({
                          ...examForm,
                          email_results_config: {
                            ...examForm.email_results_config,
                            enabled: e.target.checked
                          }
                        })}
                        className="mb-3"
                      />

                      {examForm.email_results_config?.enabled && (
                        <div className="border rounded p-3" style={{ backgroundColor: '#f8f9fa' }}>
                          <Form.Text className="text-muted mb-2 d-block">
                            Chọn các thông tin sẽ được gửi trong email kết quả:
                          </Form.Text>

                          <Form.Check
                            type="checkbox"
                            id="email_results_include_results"
                            label="Kết quả thi"
                            checked={examForm.email_results_config?.include_results || false}
                            onChange={(e) => setExamForm({
                              ...examForm,
                              email_results_config: {
                                ...examForm.email_results_config,
                                include_results: e.target.checked
                              }
                            })}
                            className="mb-2"
                          />

                          <Form.Check
                            type="checkbox"
                            id="email_results_include_questions_list"
                            label="Danh sách các câu hỏi mà sinh viên đã làm trước đó"
                            checked={examForm.email_results_config?.include_questions_list || false}
                            onChange={(e) => setExamForm({
                              ...examForm,
                              email_results_config: {
                                ...examForm.email_results_config,
                                include_questions_list: e.target.checked
                              }
                            })}
                            className="mb-2"
                          />

                          <Form.Check
                            type="checkbox"
                            id="email_results_include_question_result"
                            label="Kết quả của câu hỏi đó"
                            checked={examForm.email_results_config?.include_question_result || false}
                            onChange={(e) => setExamForm({
                              ...examForm,
                              email_results_config: {
                                ...examForm.email_results_config,
                                include_question_result: e.target.checked
                              }
                            })}
                            className="mb-2"
                          />

                          <Form.Check
                            type="checkbox"
                            id="email_results_include_question_options"
                            label="Các option của câu hỏi"
                            checked={examForm.email_results_config?.include_question_options || false}
                            onChange={(e) => setExamForm({
                              ...examForm,
                              email_results_config: {
                                ...examForm.email_results_config,
                                include_question_options: e.target.checked
                              }
                            })}
                            className="mb-2"
                          />

                          <Form.Check
                            type="checkbox"
                            id="email_results_include_selected_answers"
                            label="Đáp án mà sinh viên đã chọn"
                            checked={examForm.email_results_config?.include_selected_answers || false}
                            onChange={(e) => setExamForm({
                              ...examForm,
                              email_results_config: {
                                ...examForm.email_results_config,
                                include_selected_answers: e.target.checked
                              }
                            })}
                            className="mb-2"
                          />

                          <Form.Check
                            type="checkbox"
                            id="email_results_include_timestamps"
                            label="Thời gian thực lúc chọn đáp án"
                            checked={examForm.email_results_config?.include_timestamps || false}
                            onChange={(e) => setExamForm({
                              ...examForm,
                              email_results_config: {
                                ...examForm.email_results_config,
                                include_timestamps: e.target.checked
                              }
                            })}
                            className="mb-2"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </Tab>

                {/* Students Tab */}
                <Tab eventKey="students" title={
                  <span>
                    <i className="fas fa-users me-2"></i>
                    Sinh viên
                    {selectedStudents.length > 0 && (
                      <Badge bg="primary" pill className="ms-2">{selectedStudents.length}</Badge>
                    )}
                  </span>
                }>
                  <div className="p-3">
                    <Row className="mb-3">
                      <Col md={12}>
                        <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                          <div className="d-flex flex-wrap gap-2">
                            <InputGroup style={{ width: 'auto' }}>
                              <InputGroup.Text><i className="fas fa-layer-group"></i></InputGroup.Text>
                              <Form.Select
                                value={groupFilter}
                                onChange={(e) => {
                                  setGroupFilter(e.target.value);
                                  setUseGroupMode(!!e.target.value);
                                  if (!e.target.value) {
                                    setClassFilter('');
                                    setFacultyFilter('');
                                    setMajorFilter('');
                                  }
                                }}
                                style={{ width: '250px' }}
                              >
                                <option value="">-- Chọn nhóm sinh viên --</option>
                                {studentGroups.map((group) => (
                                  <option key={group.id} value={group.id}>
                                    {group.group_name} ({group.student_count || 0} sinh viên)
                                  </option>
                                ))}
                              </Form.Select>
                            </InputGroup>
                            <InputGroup style={{ width: 'auto' }}>
                              <InputGroup.Text><i className="fas fa-graduation-cap"></i></InputGroup.Text>
                              <Form.Select
                                value={classFilter}
                                onChange={(e) => {
                                  setClassFilter(e.target.value);
                                  if (e.target.value) {
                                    setUseGroupMode(false);
                                    setGroupFilter('');
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
                            <InputGroup style={{ width: 'auto' }}>
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
                          </div>
                          <div className="d-flex gap-2">
                            <Button
                              variant="outline-danger"
                              size="sm"
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

                    <div className="table-responsive border rounded" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                      <Table striped hover className="mb-0">
                        <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', zIndex: 1 }}>
                          <tr>
                            <th style={{ width: '50px', textAlign: 'center' }}>
                              <i className="fas fa-check-square"></i>
                            </th>
                            <th>Mã SV</th>
                            <th>Họ và tên</th>
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
                  </div>
                </Tab>

                {/* Questions Tab */}
                <Tab eventKey="questions" title={
                  <span>
                    <i className="fas fa-question-circle me-2"></i>
                    Câu hỏi
                    {/* Chỉ hiển thị số câu hỏi nếu mode không phải "on_exam" */}
                    {selectedQuestions.length > 0 &&
                      examForm.question_selection_mode !== 'first_on_exam' &&
                      examForm.question_selection_mode !== 'random_on_exam' && (
                        <Badge bg="success" pill className="ms-2">{selectedQuestions.length}</Badge>
                      )}
                  </span>
                }>
                  <div className="p-3">
                    {/* Chế độ lấy câu hỏi */}
                    <div className="session-card mb-3">
                      <div className="card-body-modern">
                        <Form.Group className="mb-2">
                          <Form.Label className="info-label" style={{ fontSize: '14px', marginBottom: '4px' }}>
                            <i className="fas fa-question-circle me-2"></i>
                            Chế độ lấy câu hỏi
                          </Form.Label>
                          <Form.Select
                            value={examForm.question_selection_mode}
                            onChange={(e) => {
                              const newMode = e.target.value;
                              setExamForm({ ...examForm, question_selection_mode: newMode });
                              // Nếu chọn mode "on_exam", xóa danh sách câu hỏi đã chọn và reset các state liên quan
                              if (newMode === 'first_on_exam' || newMode === 'random_on_exam') {
                                setSelectedQuestions([]);
                                setOriginalQuestionPoints([]);
                                setHasRedistributedPoints(false);
                              }
                            }}
                            className="form-control-modern"
                            size="sm"
                          >
                            <option value="first_on_create">1. Lúc tạo: Lấy câu hỏi đầu tiên của chủ đề</option>
                            <option value="random_on_create">2. Lúc tạo: Lấy câu hỏi random của chủ đề</option>
                            <option value="first_on_exam">3. Lúc thi: Lấy câu hỏi đầu tiên của chủ đề</option>
                            <option value="random_on_exam">4. Lúc thi: Lấy câu hỏi random của chủ đề</option>
                          </Form.Select>
                          <Form.Text className="text-muted" style={{ fontSize: '12px' }}>
                            {examForm.question_selection_mode === 'first_on_exam' || examForm.question_selection_mode === 'random_on_exam'
                              ? 'Câu hỏi sẽ được chọn tự động khi sinh viên bắt đầu làm bài. Danh sách câu hỏi sẽ không hiển thị.'
                              : 'Câu hỏi sẽ được chọn ngay khi áp dụng ma trận và hiển thị trong danh sách.'}
                          </Form.Text>
                        </Form.Group>
                      </div>
                    </div>

                    {/* Ma trận đề thi (Blueprint) */}
                    <div className="session-card mb-3">
                      <div className="card-header-modern">
                        <div className="header-icon">
                          <i className="fas fa-th"></i>
                        </div>
                        <h6 className="mb-0">Ma trận đề thi (Blueprint)</h6>
                        <div className="ms-auto">
                          <Badge bg="primary">{(blueprint.topics || []).length} chủ đề đã chọn</Badge>
                        </div>
                      </div>
                      <div className="card-body-modern">
                        {/* Chọn chủ đề - Multi-select */}
                        <div className="mb-3">
                          <Form.Group className="mb-3">
                            <Form.Label className="info-label" style={{ fontSize: '14px', marginBottom: '8px' }}>
                              <i className="fas fa-folder me-2"></i>
                              Danh sách chủ đề
                            </Form.Label>
                            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '4px', padding: '8px' }}>
                              {topics.length === 0 ? (
                                <div className="text-muted text-center py-3">
                                  <i className="fas fa-info-circle me-2"></i>
                                  Chưa có chủ đề nào. Vui lòng tạo chủ đề trước.
                                </div>
                              ) : (
                                topics.map((topic) => {
                                  const isSelected = (blueprint.topics || []).some(t => 
                                    t.topic_id === topic.topic_id || t.topic_id === parseInt(topic.topic_id)
                                  );
                                  // Sử dụng approved_count từ API (số câu hỏi đã duyệt) nếu có, nếu không thì đếm từ mảng questions (chỉ lấy approved)
                                  const approvedCount = topic.approved_count !== undefined 
                                    ? (topic.approved_count || 0)
                                    : (() => {
                                        const topicIdNum = parseInt(topic.topic_id);
                                        return questions.filter(q => {
                                          const qTopicId = parseInt(q.topic_id);
                                          return !isNaN(qTopicId) && !isNaN(topicIdNum) && qTopicId === topicIdNum;
                                        }).length;
                                      })();
                                  // Lấy số lượng chưa duyệt nếu có
                                  const unapprovedCount = topic.unapproved_count !== undefined 
                                    ? (topic.unapproved_count || 0)
                                    : (topic.total_count !== undefined && topic.approved_count !== undefined
                                      ? Math.max(0, (topic.total_count || 0) - (topic.approved_count || 0))
                                      : 0);
                                  // Tính số câu hỏi còn lại nếu đã chọn
                                  const topicConfig = isSelected ? (blueprint.topics || []).find(t => 
                                    t.topic_id === topic.topic_id || t.topic_id === parseInt(topic.topic_id)
                                  ) : null;
                                  const requiredCount = topicConfig ? (topicConfig.total_questions || 0) : 0;
                                  const remainingCount = requiredCount > 0 ? Math.max(0, requiredCount - approvedCount) : 0;
                                  const missingByCategory = topicConfig ? calculateMissingQuestionsByCategory(topicConfig, topic) : [];
                                  return (
                                    <div key={topic.topic_id} className="mb-2">
                                      <Form.Check
                                        type="checkbox"
                                        id={`exam-topic-${topic.topic_id}`}
                                        label={
                                          <span>
                                            <strong>{topic.topic_code ? `${topic.topic_code} - ` : ''}{topic.topic_name}</strong>
                                            <Badge bg="secondary" className="ms-2" style={{ fontSize: '11px' }}>
                                              {approvedCount} câu hỏi
                                              {unapprovedCount > 0 && (
                                                <span className="ms-1" style={{ color: '#ffc107', fontWeight: 'bold' }}>
                                                  ({unapprovedCount} chưa duyệt)
                                                </span>
                                              )}
                                            </Badge>
                                            {topic.remaining_questions !== undefined && requiredCount !== topic.remaining_questions && (
                                              <span className="ms-2" style={{ color: '#198754', fontSize: '11px', fontWeight: 'bold' }}>
                                                (Còn lại: {topic.remaining_questions})
                                              </span>
                                            )}
                                            {topic.topic_description && (
                                              <span className="text-muted ms-2" style={{ fontSize: '12px' }}>
                                                {topic.topic_description}
                                              </span>
                                            )}
                                          </span>
                                        }
                                        checked={isSelected}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            addTopicToBlueprint(topic.topic_id);
                                          } else {
                                            removeTopicFromBlueprint(topic.topic_id);
                                          }
                                        }}
                                      />
                                      {isSelected && missingByCategory.length > 0 && (
                                        <div className="ms-4 mt-1" style={{ fontSize: '11px', color: '#dc3545' }}>
                                          <i className="fas fa-exclamation-circle me-1"></i>
                                          <strong>Thiếu:</strong> {missingByCategory.join(', ')}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                            <Form.Text className="text-muted" style={{ fontSize: '12px', marginTop: '4px' }}>
                              <i className="fas fa-info-circle me-1"></i>
                              Chọn một hoặc nhiều chủ đề. Mỗi chủ đề có thể được cấu hình phân bố riêng ở phía dưới.
                            </Form.Text>
                          </Form.Group>

                          {/* Hiển thị các chủ đề đã chọn với cấu hình */}
                          {(blueprint.topics || []).length > 0 && (
                            <div className="mt-3">
                              <h6 className="mb-3" style={{ fontSize: '14px', fontWeight: '600' }}>
                                <i className="fas fa-cogs me-2"></i>
                                Cấu hình từng chủ đề
                              </h6>
                              <Accordion className="mb-3" defaultActiveKey="0">
                                {(blueprint.topics || []).map((topicConfig, topicIndex) => {
                                  const topic = topics.find(t => 
                                    t.topic_id === topicConfig.topic_id || t.topic_id === parseInt(topicConfig.topic_id)
                                  );
                                  if (!topic) return null;

                                  return (
                                    <Accordion.Item key={topicConfig.topic_id || topicIndex} eventKey={topicIndex.toString()}>
                                      <Accordion.Header>
                                        <div className="d-flex justify-content-between align-items-center w-100 me-3">
                                          <div>
                                            <strong>
                                              <i className="fas fa-folder-open me-2"></i>
                                              {topicConfig.topic_name || topic.topic_name || topic.topic_code}
                                            </strong>
                                            {topicConfig.total_questions > 0 && (
                                              <Badge bg="info" className="ms-2">
                                                {topicConfig.total_questions} câu
                                              </Badge>
                                            )}
                                          </div>
                                          <Button
                                            size="sm"
                                            variant="outline-danger"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              removeTopicFromBlueprint(topicConfig.topic_id);
                                            }}
                                            className="me-2"
                                          >
                                            <i className="fas fa-times"></i> Xóa
                                          </Button>
                                        </div>
                                      </Accordion.Header>
                                      <Accordion.Body>
                                        {/* Số lượng câu hỏi */}
                                        <Form.Group className="mb-3">
                                          <Form.Label className="info-label" style={{ fontSize: '13px', marginBottom: '4px' }}>
                                            <i className="fas fa-list-ol me-2"></i>
                                            Số lượng câu hỏi
                                          </Form.Label>
                                          <Form.Control
                                            type="number"
                                            size="sm"
                                            min="0"
                                            value={topicConfig.total_questions || 0}
                                            onChange={(e) => {
                                              const total = parseInt(e.target.value) || 0;
                                              updateTopicConfig(topicConfig.topic_id, { total_questions: total });
                                            }}
                                            className="form-control-modern"
                                          />
                                          <Form.Text className="text-muted" style={{ fontSize: '12px' }}>
                                            Tổng số câu hỏi sẽ được lấy từ chủ đề này. Phân bố chi tiết ở dưới phải bằng với số này.
                                          </Form.Text>
                                        </Form.Group>

                                        {/* Phương thức phân bố */}
                                        <Form.Group className="mb-3">
                                          <Form.Label className="info-label" style={{ fontSize: '13px', marginBottom: '8px' }}>
                                            <i className="fas fa-sliders-h me-2"></i>
                                            Phương thức phân bố
                                          </Form.Label>
                                          <div>
                                            <Form.Check
                                              type="radio"
                                              id={`exam-dist-difficulty-${topicConfig.topic_id}`}
                                              label="Phân bố theo độ khó"
                                              checked={topicConfig.distribution_type === 'difficulty'}
                                              onChange={() => updateTopicConfig(topicConfig.topic_id, { distribution_type: 'difficulty' })}
                                              className="mb-2"
                                            />
                                            <Form.Check
                                              type="radio"
                                              id={`exam-dist-bloom-${topicConfig.topic_id}`}
                                              label="Phân bố theo Bloom's Taxonomy"
                                              checked={topicConfig.distribution_type === 'bloom'}
                                              onChange={() => updateTopicConfig(topicConfig.topic_id, { distribution_type: 'bloom' })}
                                            />
                                          </div>
                                        </Form.Group>

                                        {/* Kiểu Random - Chỉ hiển thị khi random_on_exam */}
                                        {examForm.question_selection_mode === 'random_on_exam' && (
                                          <Form.Group className="mb-3">
                                            <Form.Label className="info-label" style={{ fontSize: '13px', marginBottom: '8px' }}>
                                              <i className="fas fa-random me-2"></i>
                                              Kiểu Random
                                            </Form.Label>
                                            <div>
                                              <Form.Check
                                                type="radio"
                                                id={`exam-random-all-${topicConfig.topic_id}`}
                                                label="Random tất cả - Mỗi lần thi sẽ random lại câu hỏi từ chủ đề"
                                                checked={(topicConfig.random_type || 'all') === 'all'}
                                                onChange={() => updateTopicConfig(topicConfig.topic_id, { random_type: 'all' })}
                                                className="mb-2"
                                              />
                                              <Form.Check
                                                type="radio"
                                                id={`exam-random-fixed-${topicConfig.topic_id}`}
                                                label="Random cố định - Random một lần khi tạo đề, sau đó giữ nguyên cho tất cả thí sinh"
                                                checked={topicConfig.random_type === 'fixed'}
                                                onChange={() => updateTopicConfig(topicConfig.topic_id, { random_type: 'fixed' })}
                                              />
                                            </div>
                                            <Form.Text className="text-muted" style={{ fontSize: '12px' }}>
                                              <i className="fas fa-info-circle me-1"></i>
                                              Random tất cả: Mỗi thí sinh sẽ nhận bộ câu hỏi khác nhau. Random cố định: Tất cả thí sinh cùng một bộ câu hỏi đã được random trước.
                                            </Form.Text>
                                          </Form.Group>
                                        )}

                                        {/* Phân bố theo độ khó */}
                                        {topicConfig.distribution_type === 'difficulty' && (
                                          <div className="mb-3">
                                            <h6 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '12px' }}>
                                              <i className="fas fa-chart-bar me-2"></i>
                                              Phân bố theo độ khó
                                            </h6>
                                            <Row className="g-2">
                                              {['easy', 'medium', 'hard', 'expert'].map((difficulty) => {
                                                const difficultyLabels = {
                                                  easy: 'Dễ',
                                                  medium: 'Trung bình',
                                                  hard: 'Khó',
                                                  expert: 'Chuyên gia'
                                                };
                                                const count = topicConfig.difficulty_distribution?.[difficulty] || 0;
                                                const points = topicConfig.difficulty_distribution?.[`${difficulty}_points`] || 0;
                                                const avgPoints = calculateAveragePointsForTopic(topicConfig.topic_id, 'difficulty', difficulty);

                                                return (
                                                  <Col md={3} xs={6} key={difficulty}>
                                                    <div className="border rounded p-2 mb-2">
                                                      <Form.Label className="info-label" style={{ fontSize: '12px', marginBottom: '4px', fontWeight: '600' }}>
                                                        {difficultyLabels[difficulty]}
                                                      </Form.Label>
                                                      <Form.Control
                                                        type="number"
                                                        size="sm"
                                                        min="0"
                                                        placeholder="Số câu"
                                                        value={count}
                                                        onChange={(e) => {
                                                          const numQuestions = parseInt(e.target.value) || 0;
                                                          const calculatedPoints = numQuestions > 0 ? numQuestions * avgPoints : 0;
                                                          updateTopicConfig(topicConfig.topic_id, {
                                                            difficulty_distribution: {
                                                              ...topicConfig.difficulty_distribution,
                                                              [difficulty]: numQuestions,
                                                              [`${difficulty}_points`]: calculatedPoints
                                                            }
                                                          });
                                                        }}
                                                        className="mb-2"
                                                      />
                                                      {(examForm.question_selection_mode === 'first_on_exam' || examForm.question_selection_mode === 'random_on_exam') && (
                                                        <Form.Control
                                                          type="number"
                                                          size="sm"
                                                          step="0.01"
                                                          min="0"
                                                          placeholder="Điểm mỗi câu"
                                                          value={points > 0 && count > 0 ? (points / count).toFixed(2) : ''}
                                                          onChange={(e) => {
                                                            const pointsPerQuestion = parseFloat(e.target.value) || 0;
                                                            const totalPoints = pointsPerQuestion * count;
                                                            updateTopicConfig(topicConfig.topic_id, {
                                                              difficulty_distribution: {
                                                                ...topicConfig.difficulty_distribution,
                                                                [`${difficulty}_points`]: totalPoints
                                                              }
                                                            });
                                                          }}
                                                        />
                                                      )}
                                                      {count > 0 && points > 0 && (examForm.question_selection_mode !== 'first_on_exam' && examForm.question_selection_mode !== 'random_on_exam') && (
                                                        <div style={{ fontSize: '11px', color: '#6c757d', marginTop: '4px' }}>
                                                          <i className="fas fa-calculator me-1"></i>
                                                          Điểm/câu: {(points / count).toFixed(3)}
                                                        </div>
                                                      )}
                                                    </div>
                                                  </Col>
                                                );
                                              })}
                                            </Row>
                                          </div>
                                        )}

                                        {/* Phân bố theo Bloom's Taxonomy */}
                                        {topicConfig.distribution_type === 'bloom' && (
                                          <div className="mb-3">
                                            <h6 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '12px' }}>
                                              <i className="fas fa-brain me-2"></i>
                                              Phân bố theo Bloom's Taxonomy
                                            </h6>
                                            <Row className="g-2">
                                              {['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'].map((bloomLevel) => {
                                                const bloomLabels = {
                                                  remember: 'Nhớ (Remember)',
                                                  understand: 'Hiểu (Understand)',
                                                  apply: 'Vận dụng (Apply)',
                                                  analyze: 'Phân tích (Analyze)',
                                                  evaluate: 'Đánh giá (Evaluate)',
                                                  create: 'Sáng tạo (Create)'
                                                };
                                                const count = topicConfig.bloom_distribution?.[bloomLevel] || 0;
                                                const points = topicConfig.bloom_distribution?.[`${bloomLevel}_points`] || 0;
                                                const avgPoints = calculateAveragePointsForTopic(topicConfig.topic_id, 'bloom', bloomLevel);

                                                return (
                                                  <Col md={2} xs={6} key={bloomLevel}>
                                                    <div className="border rounded p-2 mb-2">
                                                      <Form.Label className="info-label" style={{ fontSize: '12px', marginBottom: '4px', fontWeight: '600' }}>
                                                        {bloomLabels[bloomLevel]}
                                                      </Form.Label>
                                                      <Form.Control
                                                        type="number"
                                                        size="sm"
                                                        min="0"
                                                        placeholder="Số câu"
                                                        value={count}
                                                        onChange={(e) => {
                                                          const numQuestions = parseInt(e.target.value) || 0;
                                                          const calculatedPoints = numQuestions > 0 ? numQuestions * avgPoints : 0;
                                                          updateTopicConfig(topicConfig.topic_id, {
                                                            bloom_distribution: {
                                                              ...topicConfig.bloom_distribution,
                                                              [bloomLevel]: numQuestions,
                                                              [`${bloomLevel}_points`]: calculatedPoints
                                                            }
                                                          });
                                                        }}
                                                        className="mb-2"
                                                      />
                                                      {(examForm.question_selection_mode === 'first_on_exam' || examForm.question_selection_mode === 'random_on_exam') && (
                                                        <Form.Control
                                                          type="number"
                                                          size="sm"
                                                          step="0.01"
                                                          min="0"
                                                          placeholder="Điểm mỗi câu"
                                                          value={points > 0 && count > 0 ? (points / count).toFixed(2) : ''}
                                                          onChange={(e) => {
                                                            const pointsPerQuestion = parseFloat(e.target.value) || 0;
                                                            const totalPoints = pointsPerQuestion * count;
                                                            updateTopicConfig(topicConfig.topic_id, {
                                                              bloom_distribution: {
                                                                ...topicConfig.bloom_distribution,
                                                                [`${bloomLevel}_points`]: totalPoints
                                                              }
                                                            });
                                                          }}
                                                        />
                                                      )}
                                                      {count > 0 && points > 0 && (examForm.question_selection_mode !== 'first_on_exam' && examForm.question_selection_mode !== 'random_on_exam') && (
                                                        <div style={{ fontSize: '11px', color: '#6c757d', marginTop: '4px' }}>
                                                          <i className="fas fa-calculator me-1"></i>
                                                          Điểm/câu: {(points / count).toFixed(3)}
                                                        </div>
                                                      )}
                                                    </div>
                                                  </Col>
                                                );
                                              })}
                                            </Row>
                                          </div>
                                        )}

                                        {/* Validation summary */}
                                        <Alert variant={(() => {
                                          const errors = validateTopicConfig(topicConfig);
                                          const missingDetails = calculateMissingQuestionsByCategory(topicConfig, topic);
                                          return errors.length > 0 || missingDetails.length > 0 ? 'warning' : 'success';
                                        })()} className="mt-2 mb-0" style={{ fontSize: '12px' }}>
                                          {(() => {
                                            const errors = validateTopicConfig(topicConfig);
                                            const missingDetails = calculateMissingQuestionsByCategory(topicConfig, topic);
                                            if (errors.length > 0) {
                                              return (
                                                <div>
                                                  <i className="fas fa-exclamation-triangle me-2"></i>
                                                  {errors.join(', ')}
                                                </div>
                                              );
                                            }
                                            const totalQuestions = topicConfig.distribution_type === 'difficulty'
                                              ? (topicConfig.difficulty_distribution?.easy || 0) +
                                                (topicConfig.difficulty_distribution?.medium || 0) +
                                                (topicConfig.difficulty_distribution?.hard || 0) +
                                                (topicConfig.difficulty_distribution?.expert || 0)
                                              : (topicConfig.bloom_distribution?.remember || 0) +
                                                (topicConfig.bloom_distribution?.understand || 0) +
                                                (topicConfig.bloom_distribution?.apply || 0) +
                                                (topicConfig.bloom_distribution?.analyze || 0) +
                                                (topicConfig.bloom_distribution?.evaluate || 0) +
                                                (topicConfig.bloom_distribution?.create || 0);
                                            const totalPoints = topicConfig.distribution_type === 'difficulty'
                                              ? (topicConfig.difficulty_distribution?.easy_points || 0) +
                                                (topicConfig.difficulty_distribution?.medium_points || 0) +
                                                (topicConfig.difficulty_distribution?.hard_points || 0) +
                                                (topicConfig.difficulty_distribution?.expert_points || 0)
                                              : (topicConfig.bloom_distribution?.remember_points || 0) +
                                                (topicConfig.bloom_distribution?.understand_points || 0) +
                                                (topicConfig.bloom_distribution?.apply_points || 0) +
                                                (topicConfig.bloom_distribution?.analyze_points || 0) +
                                                (topicConfig.bloom_distribution?.evaluate_points || 0) +
                                                (topicConfig.bloom_distribution?.create_points || 0);
                                            
                                            const remainingQuestions = topic?.remaining_questions !== undefined ? topic.remaining_questions : approvedCount;
                                            
                                            return (
                                              <div>
                                                <div className="mb-1">
                                                  <i className="fas fa-check-circle me-2"></i>
                                                  <strong>Tổng kết:</strong> {totalQuestions} câu hỏi - {totalPoints.toFixed(2)} điểm
                                                </div>
                                                {remainingQuestions !== undefined && (
                                                  <div className="mb-1">
                                                    <i className="fas fa-info-circle me-2"></i>
                                                    <strong>Còn lại:</strong> {remainingQuestions} câu hỏi
                                                  </div>
                                                )}
                                                {missingDetails.length > 0 && (
                                                  <div style={{ color: '#dc3545', marginTop: '4px' }}>
                                                    <i className="fas fa-exclamation-triangle me-2"></i>
                                                    <strong>Thiếu câu hỏi:</strong> {missingDetails.join(', ')}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })()}
                                        </Alert>
                                      </Accordion.Body>
                                    </Accordion.Item>
                                  );
                                })}
                              </Accordion>
                            </div>
                          )}
                        </div>

                        {/* Toggle switches - Chỉ hiển thị khi không có topics array (backward compatibility) */}
                        {(!blueprint.topics || blueprint.topics.length === 0) && (
                          <div className="mb-3">
                            <Form.Group className="mb-2">
                              <Form.Check
                                type="switch"
                                id="difficulty-distribution-switch"
                                label="Phân bố theo độ khó"
                                checked={blueprint.use_difficulty_distribution}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setBlueprint({
                                    ...blueprint,
                                    use_difficulty_distribution: checked,
                                    use_bloom_distribution: checked ? false : blueprint.use_bloom_distribution
                                  });
                                }}
                              />
                            </Form.Group>
                            <Form.Group className="mb-0">
                              <Form.Check
                                type="switch"
                                id="bloom-distribution-switch"
                                label="Phân bố theo Bloom's Taxonomy"
                                checked={blueprint.use_bloom_distribution}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setBlueprint({
                                    ...blueprint,
                                    use_bloom_distribution: checked,
                                    use_difficulty_distribution: checked ? false : blueprint.use_difficulty_distribution
                                  });
                                }}
                                disabled={blueprint.use_difficulty_distribution}
                              />
                              {blueprint.use_difficulty_distribution && (
                                <Form.Text className="text-muted" style={{ fontSize: '12px' }}>
                                  Tắt "Phân bố theo độ khó" để sử dụng "Phân bố theo Bloom's Taxonomy"
                                </Form.Text>
                              )}
                            </Form.Group>
                          </div>
                        )}

                        {/* Phân bố theo độ khó - Chỉ hiển thị khi không có topics array (backward compatibility) */}
                        {(!blueprint.topics || blueprint.topics.length === 0) && blueprint.use_difficulty_distribution && (
                          <div className="mb-3">
                            <h6 className="mb-2" style={{ fontSize: '14px' }}>Phân bố theo độ khó</h6>
                            <Row className="g-2">
                              <Col md={3}>
                                <div className="border rounded p-2 mb-2">
                                  <Form.Label className="info-label" style={{ fontSize: '12px', marginBottom: '4px', fontWeight: '600' }}>Dễ</Form.Label>
                                  <Form.Control
                                    type="number"
                                    size="sm"
                                    min="0"
                                    placeholder="Số câu"
                                    value={blueprint.easy || 0}
                                    onChange={(e) => {
                                      const numQuestions = parseInt(e.target.value) || 0;
                                      const avgPoints = calculateAveragePoints('difficulty', 'easy');
                                      const calculatedPoints = numQuestions > 0 ? numQuestions * avgPoints : 0;
                                      setBlueprint({ 
                                        ...blueprint, 
                                        easy: numQuestions,
                                        easy_points: calculatedPoints
                                      });
                                    }}
                                    className="mb-2"
                                  />
                                  {(examForm.question_selection_mode === 'first_on_exam' || examForm.question_selection_mode === 'random_on_exam') && (
                                    <Form.Control
                                      type="number"
                                      size="sm"
                                      step="0.01"
                                      min="0"
                                      placeholder="Điểm mỗi câu"
                                      value={blueprint.easy > 0 && blueprint.easy_points > 0 ? (blueprint.easy_points / blueprint.easy).toFixed(2) : ''}
                                      onChange={(e) => {
                                        const pointsPerQuestion = parseFloat(e.target.value) || 0;
                                        const totalPoints = pointsPerQuestion * (blueprint.easy || 0);
                                        setBlueprint({ ...blueprint, easy_points: totalPoints });
                                      }}
                                    />
                                  )}
                                </div>
                              </Col>
                              <Col md={3}>
                                <div className="border rounded p-2 mb-2">
                                  <Form.Label className="info-label" style={{ fontSize: '12px', marginBottom: '4px', fontWeight: '600' }}>Trung bình</Form.Label>
                                  <Form.Control
                                    type="number"
                                    size="sm"
                                    min="0"
                                    placeholder="Số câu"
                                    value={blueprint.medium || 0}
                                    onChange={(e) => {
                                      const numQuestions = parseInt(e.target.value) || 0;
                                      const avgPoints = calculateAveragePoints('difficulty', 'medium');
                                      const calculatedPoints = numQuestions > 0 ? numQuestions * avgPoints : 0;
                                      setBlueprint({ 
                                        ...blueprint, 
                                        medium: numQuestions,
                                        medium_points: calculatedPoints
                                      });
                                    }}
                                    className="mb-2"
                                  />
                                  {(examForm.question_selection_mode === 'first_on_exam' || examForm.question_selection_mode === 'random_on_exam') && (
                                    <Form.Control
                                      type="number"
                                      size="sm"
                                      step="0.01"
                                      min="0"
                                      placeholder="Điểm mỗi câu"
                                      value={blueprint.medium > 0 && blueprint.medium_points > 0 ? (blueprint.medium_points / blueprint.medium).toFixed(2) : ''}
                                      onChange={(e) => {
                                        const pointsPerQuestion = parseFloat(e.target.value) || 0;
                                        const totalPoints = pointsPerQuestion * (blueprint.medium || 0);
                                        setBlueprint({ ...blueprint, medium_points: totalPoints });
                                      }}
                                    />
                                  )}
                                </div>
                              </Col>
                              <Col md={3}>
                                <div className="border rounded p-2 mb-2">
                                  <Form.Label className="info-label" style={{ fontSize: '12px', marginBottom: '4px', fontWeight: '600' }}>Khó</Form.Label>
                                  <Form.Control
                                    type="number"
                                    size="sm"
                                    min="0"
                                    placeholder="Số câu"
                                    value={blueprint.hard || 0}
                                    onChange={(e) => {
                                      const numQuestions = parseInt(e.target.value) || 0;
                                      const avgPoints = calculateAveragePoints('difficulty', 'hard');
                                      const calculatedPoints = numQuestions > 0 ? numQuestions * avgPoints : 0;
                                      setBlueprint({ 
                                        ...blueprint, 
                                        hard: numQuestions,
                                        hard_points: calculatedPoints
                                      });
                                    }}
                                    className="mb-2"
                                  />
                                  {(examForm.question_selection_mode === 'first_on_exam' || examForm.question_selection_mode === 'random_on_exam') && (
                                    <Form.Control
                                      type="number"
                                      size="sm"
                                      step="0.01"
                                      min="0"
                                      placeholder="Điểm mỗi câu"
                                      value={blueprint.hard > 0 && blueprint.hard_points > 0 ? (blueprint.hard_points / blueprint.hard).toFixed(2) : ''}
                                      onChange={(e) => {
                                        const pointsPerQuestion = parseFloat(e.target.value) || 0;
                                        const totalPoints = pointsPerQuestion * (blueprint.hard || 0);
                                        setBlueprint({ ...blueprint, hard_points: totalPoints });
                                      }}
                                    />
                                  )}
                                </div>
                              </Col>
                              <Col md={3}>
                                <div className="border rounded p-2 mb-2">
                                  <Form.Label className="info-label" style={{ fontSize: '12px', marginBottom: '4px', fontWeight: '600' }}>Chuyên gia</Form.Label>
                                  <Form.Control
                                    type="number"
                                    size="sm"
                                    min="0"
                                    placeholder="Số câu"
                                    value={blueprint.expert || 0}
                                    onChange={(e) => {
                                      const numQuestions = parseInt(e.target.value) || 0;
                                      const avgPoints = calculateAveragePoints('difficulty', 'expert');
                                      const calculatedPoints = numQuestions > 0 ? numQuestions * avgPoints : 0;
                                      setBlueprint({ 
                                        ...blueprint, 
                                        expert: numQuestions,
                                        expert_points: calculatedPoints
                                      });
                                    }}
                                    className="mb-2"
                                  />
                                  {(examForm.question_selection_mode === 'first_on_exam' || examForm.question_selection_mode === 'random_on_exam') && (
                                    <Form.Control
                                      type="number"
                                      size="sm"
                                      step="0.01"
                                      min="0"
                                      placeholder="Điểm mỗi câu"
                                      value={blueprint.expert > 0 && blueprint.expert_points > 0 ? (blueprint.expert_points / blueprint.expert).toFixed(2) : ''}
                                      onChange={(e) => {
                                        const pointsPerQuestion = parseFloat(e.target.value) || 0;
                                        const totalPoints = pointsPerQuestion * (blueprint.expert || 0);
                                        setBlueprint({ ...blueprint, expert_points: totalPoints });
                                      }}
                                    />
                                  )}
                                </div>
                              </Col>
                            </Row>
                          </div>
                        )}

                        {/* Phân bố theo Bloom's Taxonomy - Chỉ hiển thị khi không có topics array (backward compatibility) */}
                        {(!blueprint.topics || blueprint.topics.length === 0) && blueprint.use_bloom_distribution && (
                          <div className="mb-3">
                            <h6 className="mb-2" style={{ fontSize: '14px' }}>Phân bố theo Bloom's Taxonomy</h6>
                            <Row className="g-2">
                              {[
                                { key: 'remember', label: 'Nhớ (Remember)' },
                                { key: 'understand', label: 'Hiểu (Understand)' },
                                { key: 'apply', label: 'Vận dụng (Apply)' },
                                { key: 'analyze', label: 'Phân tích (Analyze)' },
                                { key: 'evaluate', label: 'Đánh giá (Evaluate)' },
                                { key: 'create', label: 'Sáng tạo (Create)' }
                              ].map(({ key, label }) => (
                                <Col md={2} xs={6} key={key}>
                                  <div className="border rounded p-2 mb-2">
                                    <Form.Label className="info-label" style={{ fontSize: '12px', marginBottom: '4px', fontWeight: '600' }}>
                                      {label}
                                    </Form.Label>
                                    <Form.Control
                                      type="number"
                                      size="sm"
                                      min="0"
                                      placeholder="Số câu"
                                      value={blueprint[key] || 0}
                                      onChange={(e) => {
                                        const numQuestions = parseInt(e.target.value) || 0;
                                        const avgPoints = calculateAveragePoints('bloom', key);
                                        const calculatedPoints = numQuestions > 0 ? numQuestions * avgPoints : 0;
                                        setBlueprint({ 
                                          ...blueprint, 
                                          [key]: numQuestions,
                                          [`${key}_points`]: calculatedPoints
                                        });
                                      }}
                                      className="mb-2"
                                    />
                                    {(examForm.question_selection_mode === 'first_on_exam' || examForm.question_selection_mode === 'random_on_exam') && (
                                      <Form.Control
                                        type="number"
                                        size="sm"
                                        step="0.01"
                                        min="0"
                                        placeholder="Điểm mỗi câu"
                                        value={blueprint[key] > 0 && blueprint[`${key}_points`] > 0 ? (blueprint[`${key}_points`] / blueprint[key]).toFixed(2) : ''}
                                        onChange={(e) => {
                                          const pointsPerQuestion = parseFloat(e.target.value) || 0;
                                          const totalPoints = pointsPerQuestion * (blueprint[key] || 0);
                                          setBlueprint({ ...blueprint, [`${key}_points`]: totalPoints });
                                        }}
                                      />
                                    )}
                                  </div>
                                </Col>
                              ))}
                            </Row>
                          </div>
                        )}

                        {/* Nút áp dụng ma trận */}
                        {(examForm.question_selection_mode !== 'first_on_exam' && examForm.question_selection_mode !== 'random_on_exam') && (
                          <div className="mt-3">
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={handleAddQuestionsByBlueprint}
                              className="w-100"
                            >
                              <i className="fas fa-check me-2"></i>Áp dụng ma trận
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Hiển thị thông báo nếu mode là "on_exam" */}
                    {(examForm.question_selection_mode === 'first_on_exam' || examForm.question_selection_mode === 'random_on_exam') ? (
                      <Alert variant="info" className="mb-3">
                        <div className="d-flex align-items-center">
                          <i className="fas fa-info-circle me-3"></i>
                          <div>
                            <strong>Chế độ tự động:</strong> Câu hỏi sẽ được chọn tự động khi sinh viên bắt đầu làm bài dựa trên ma trận đề thi.
                            Vui lòng cấu hình ma trận đề thi ở trên.
                          </div>
                        </div>
                      </Alert>
                    ) : null}

                    <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                      <div className="d-flex align-items-center gap-2">
                        <div className="d-flex align-items-center gap-2">
                          <strong>Tổng điểm:</strong>
                          <Form.Control
                            type="number"
                            size="sm"
                            step="0.01"
                            min="0"
                            style={{ width: '90px' }}
                            value={examForm.total_points}
                            onChange={(e) => {
                              const newTotalPoints = parseFloat(e.target.value) || 0;
                              if (newTotalPoints < 0) {
                                showAlertMessage('Tổng điểm phải là số dương', 'warning');
                                return;
                              }
                              if (selectedQuestions.length > 0) {
                                redistributePoints(newTotalPoints);
                              } else {
                                setExamForm(prev => ({ ...prev, total_points: newTotalPoints }));
                              }
                            }}
                            disabled={examForm.question_selection_mode === 'first_on_exam' || examForm.question_selection_mode === 'random_on_exam'}
                            readOnly={examForm.question_selection_mode === 'first_on_exam' || examForm.question_selection_mode === 'random_on_exam'}
                          />
                          {(examForm.question_selection_mode === 'first_on_exam' || examForm.question_selection_mode === 'random_on_exam') && (
                            <Badge bg="info" className="ms-2">Tự động tính</Badge>
                          )}
                        </div>
                        {hasRedistributedPoints && originalQuestionPoints.length > 0 && (
                          <Button
                            size="sm"
                            variant="outline-secondary"
                            onClick={revertPoints}
                            title="Khôi phục điểm cũ"
                          >
                            <i className="fas fa-undo me-1"></i>
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="mb-3">
                      <strong>Tổng số câu hỏi:</strong> {
                        (examForm.question_selection_mode === 'first_on_exam' || examForm.question_selection_mode === 'random_on_exam')
                          ? (() => {
                              // Nếu có topics array, tính tổng từ tất cả topics
                              if (blueprint.topics && Array.isArray(blueprint.topics) && blueprint.topics.length > 0) {
                                return blueprint.topics.reduce((total, topicConfig) => {
                                  if (topicConfig.distribution_type === 'difficulty') {
                                    return total + 
                                      (topicConfig.difficulty_distribution?.easy || 0) +
                                      (topicConfig.difficulty_distribution?.medium || 0) +
                                      (topicConfig.difficulty_distribution?.hard || 0) +
                                      (topicConfig.difficulty_distribution?.expert || 0);
                                  } else if (topicConfig.distribution_type === 'bloom') {
                                    return total + 
                                      (topicConfig.bloom_distribution?.remember || 0) +
                                      (topicConfig.bloom_distribution?.understand || 0) +
                                      (topicConfig.bloom_distribution?.apply || 0) +
                                      (topicConfig.bloom_distribution?.analyze || 0) +
                                      (topicConfig.bloom_distribution?.evaluate || 0) +
                                      (topicConfig.bloom_distribution?.create || 0);
                                  }
                                  return total;
                                }, 0);
                              }
                              // Backward compatibility: tính từ blueprint cũ
                              return (blueprint.easy || 0) + (blueprint.medium || 0) + (blueprint.hard || 0) + (blueprint.expert || 0) +
                                     (blueprint.remember || 0) + (blueprint.understand || 0) + (blueprint.apply || 0) +
                                     (blueprint.analyze || 0) + (blueprint.evaluate || 0) + (blueprint.create || 0);
                            })()
                          : selectedQuestions.length
                      }
                    </div>

                    {/* Chỉ hiển thị danh sách câu hỏi nếu mode không phải "on_exam" */}
                    {(examForm.question_selection_mode !== 'first_on_exam' && examForm.question_selection_mode !== 'random_on_exam') ? (
                      selectedQuestions.length > 0 ? (
                        <Table striped bordered hover size="sm">
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Câu hỏi</th>
                              <th>Điểm</th>
                              <th>Thao tác</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedQuestions.map((q, index) => (
                              <tr key={index}>
                                <td>{index + 1}</td>
                                <td>
                                  {q.question_text || questions.find(qu => qu.question_id === q.question_id)?.question_text || 'N/A'}
                                </td>
                                <td>
                                  <Form.Control
                                    type="number"
                                    size="sm"
                                    step="0.01"
                                    min="0"
                                    value={q.points}
                                    onChange={(e) => {
                                      const newPoints = parseFloat(e.target.value) || 0;

                                      // Validate points
                                      if (isNaN(newPoints) || newPoints < 0) {
                                        return;
                                      }

                                      // Chỉ cập nhật local state, KHÔNG cập nhật database
                                      const newSelected = [...selectedQuestions];
                                      newSelected[index].points = newPoints;
                                      setSelectedQuestions(newSelected);
                                    }}
                                    style={{ width: '80px' }}
                                  />
                                </td>
                                <td>
                                  <Button
                                    size="sm"
                                    variant="outline-danger"
                                    onClick={() => {
                                      setSelectedQuestions(selectedQuestions.filter((_, i) => i !== index));
                                      // Reset state khi xóa câu hỏi
                                      setOriginalQuestionPoints([]);
                                      setHasRedistributedPoints(false);
                                    }}
                                  >
                                    <i className="fas fa-times"></i>
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      ) : (
                        <div className="text-center text-muted p-4">
                          Chưa có câu hỏi nào. Vui lòng cấu hình ma trận đề thi ở trên và nhấn "Áp dụng ma trận" để thêm câu hỏi.
                        </div>
                      )
                    ) : (
                      <div className="text-center text-muted p-4">
                        <i className="fas fa-info-circle me-2"></i>
                        Câu hỏi sẽ được chọn tự động khi sinh viên bắt đầu làm bài dựa trên ma trận đề thi.
                      </div>
                    )}
                  </div>
                </Tab>
              </Tabs>
            </div>
          </Modal.Body>
          <Modal.Footer className="student-detail-footer">
            <Button variant="outline-secondary" onClick={() => {
              setShowExamModal(false);
              setExamModalTab('basic'); // Reset tab khi đóng modal
            }} className="btn-cancel">
              <i className="fas fa-times me-2"></i>
              Hủy
            </Button>
            <Button variant="primary" type="submit" disabled={loading} className="btn-edit">
              {loading ? (
                <>
                  <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                  Đang xử lý...
                </>
              ) : (
                <>
                  <i className={`fas ${editMode ? 'fa-save' : 'fa-plus'} me-2`}></i>
                  {editMode ? 'Cập nhật' : 'Tạo mới'}
                </>
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Blueprint Modal */}
      <Modal show={showBlueprintModal} onHide={() => setShowBlueprintModal(false)} size="lg" className="student-detail-modal">
        <Modal.Header closeButton className="student-detail-header">
          <Modal.Title className="student-detail-title">
            <div className="student-avatar">
              <i className="fas fa-th"></i>
            </div>
            <div>
              <h4 className="mb-0">Ma trận đề thi (Blueprint)</h4>
              <p className="mb-0 student-subtitle">Tạo đề thi theo ma trận phân bố câu hỏi</p>
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="student-detail-body">
          <div className="student-detail-container">
            {/* Chọn chủ đề - Multi-select */}
            <div className="session-card mb-3">
              <div className="card-header-modern">
                <div className="header-icon">
                  <i className="fas fa-folder"></i>
                </div>
                <h6 className="mb-0">Chọn chủ đề</h6>
                <div className="ms-auto">
                  <Badge bg="primary">{(blueprint.topics || []).length} chủ đề đã chọn</Badge>
                </div>
              </div>
              <div className="card-body-modern">
                <Form.Group className="mb-3">
                  <Form.Label className="info-label" style={{ fontSize: '14px', marginBottom: '8px' }}>
                    <i className="fas fa-folder me-2"></i>
                    Danh sách chủ đề
                  </Form.Label>
                  <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '4px', padding: '8px' }}>
                    {topics.length === 0 ? (
                      <div className="text-muted text-center py-3">
                        <i className="fas fa-info-circle me-2"></i>
                        Chưa có chủ đề nào. Vui lòng tạo chủ đề trước.
                      </div>
                    ) : (
                      topics.map((topic) => {
                        const isSelected = (blueprint.topics || []).some(t => 
                          t.topic_id === topic.topic_id || t.topic_id === parseInt(topic.topic_id)
                        );
                        // Sử dụng approved_count từ API (số câu hỏi đã duyệt) nếu có, nếu không thì đếm từ mảng questions (chỉ lấy approved)
                        const approvedCount = topic.approved_count !== undefined 
                          ? (topic.approved_count || 0)
                          : (() => {
                              const topicIdNum = parseInt(topic.topic_id);
                              return questions.filter(q => {
                                const qTopicId = parseInt(q.topic_id);
                                return !isNaN(qTopicId) && !isNaN(topicIdNum) && qTopicId === topicIdNum;
                              }).length;
                            })();
                        // Lấy số lượng chưa duyệt nếu có
                        const unapprovedCount = topic.unapproved_count !== undefined 
                          ? (topic.unapproved_count || 0)
                          : (topic.total_count !== undefined && topic.approved_count !== undefined
                            ? Math.max(0, (topic.total_count || 0) - (topic.approved_count || 0))
                            : 0);
                        // Tính số câu hỏi còn lại nếu đã chọn
                        const topicConfig = isSelected ? (blueprint.topics || []).find(t => 
                          t.topic_id === topic.topic_id || t.topic_id === parseInt(topic.topic_id)
                        ) : null;
                        const requiredCount = topicConfig ? (topicConfig.total_questions || 0) : 0;
                        const remainingCount = requiredCount > 0 ? Math.max(0, requiredCount - approvedCount) : 0;
                        const missingByCategory = topicConfig ? calculateMissingQuestionsByCategory(topicConfig, topic) : [];
                        return (
                          <div key={topic.topic_id} className="mb-2">
                            <Form.Check
                              type="checkbox"
                              id={`topic-${topic.topic_id}`}
                              label={
                                <span>
                                  <strong>{topic.topic_code ? `${topic.topic_code} - ` : ''}{topic.topic_name}</strong>
                                  <Badge bg="secondary" className="ms-2" style={{ fontSize: '11px' }}>
                                    {approvedCount} câu hỏi
                                    {unapprovedCount > 0 && (
                                      <span className="ms-1" style={{ color: '#ffc107', fontWeight: 'bold' }}>
                                        ({unapprovedCount} chưa duyệt)
                                      </span>
                                    )}
                                  </Badge>
                                  {topic.remaining_questions !== undefined && requiredCount !== topic.remaining_questions && (
                                    <span className="ms-2" style={{ color: '#198754', fontSize: '11px', fontWeight: 'bold' }}>
                                      (Còn lại: {topic.remaining_questions})
                                    </span>
                                  )}
                                  {topic.topic_description && (
                                    <span className="text-muted ms-2" style={{ fontSize: '12px' }}>
                                      {topic.topic_description}
                                    </span>
                                  )}
                                </span>
                              }
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  addTopicToBlueprint(topic.topic_id);
                                } else {
                                  removeTopicFromBlueprint(topic.topic_id);
                                }
                              }}
                            />
                            {isSelected && missingByCategory.length > 0 && (
                              <div className="ms-4 mt-1" style={{ fontSize: '11px', color: '#dc3545' }}>
                                <i className="fas fa-exclamation-circle me-1"></i>
                                <strong>Thiếu:</strong> {missingByCategory.join(', ')}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                  <Form.Text className="text-muted" style={{ fontSize: '12px', marginTop: '4px' }}>
                    <i className="fas fa-info-circle me-1"></i>
                    Chọn một hoặc nhiều chủ đề. Mỗi chủ đề có thể được cấu hình phân bố riêng ở phía dưới.
                  </Form.Text>
                </Form.Group>

                {/* Hiển thị các chủ đề đã chọn với cấu hình */}
                {(blueprint.topics || []).length > 0 && (
                  <div className="mt-3">
                    <h6 className="mb-3" style={{ fontSize: '14px', fontWeight: '600' }}>
                      <i className="fas fa-cogs me-2"></i>
                      Cấu hình từng chủ đề
                    </h6>
                    <Accordion className="mb-3" defaultActiveKey="0">
                      {(blueprint.topics || []).map((topicConfig, topicIndex) => {
                        const topic = topics.find(t => 
                          t.topic_id === topicConfig.topic_id || t.topic_id === parseInt(topicConfig.topic_id)
                        );
                        if (!topic) return null;

                        return (
                          <Accordion.Item key={topicConfig.topic_id || topicIndex} eventKey={topicIndex.toString()}>
                            <Accordion.Header>
                              <div className="d-flex justify-content-between align-items-center w-100 me-3">
                                <div>
                                  <strong>
                                    <i className="fas fa-folder-open me-2"></i>
                                    {topicConfig.topic_name || topic.topic_name || topic.topic_code}
                                  </strong>
                                  {topicConfig.total_questions > 0 && (
                                    <Badge bg="info" className="ms-2">
                                      {topicConfig.total_questions} câu
                                    </Badge>
                                  )}
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline-danger"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeTopicFromBlueprint(topicConfig.topic_id);
                                  }}
                                  className="me-2"
                                >
                                  <i className="fas fa-times"></i> Xóa
                                </Button>
                              </div>
                            </Accordion.Header>
                            <Accordion.Body>
                              {/* Số lượng câu hỏi */}
                              <Form.Group className="mb-3">
                                <Form.Label className="info-label" style={{ fontSize: '13px', marginBottom: '4px' }}>
                                  <i className="fas fa-list-ol me-2"></i>
                                  Số lượng câu hỏi
                                </Form.Label>
                                <Form.Control
                                  type="number"
                                  size="sm"
                                  min="0"
                                  value={topicConfig.total_questions || 0}
                                  onChange={(e) => {
                                    const total = parseInt(e.target.value) || 0;
                                    updateTopicConfig(topicConfig.topic_id, { total_questions: total });
                                  }}
                                  className="form-control-modern"
                                />
                                <Form.Text className="text-muted" style={{ fontSize: '12px' }}>
                                  Tổng số câu hỏi sẽ được lấy từ chủ đề này. Phân bố chi tiết ở dưới phải bằng với số này.
                                </Form.Text>
                              </Form.Group>

                              {/* Phương thức phân bố */}
                              <Form.Group className="mb-3">
                                <Form.Label className="info-label" style={{ fontSize: '13px', marginBottom: '8px' }}>
                                  <i className="fas fa-sliders-h me-2"></i>
                                  Phương thức phân bố
                                </Form.Label>
                                <div>
                                  <Form.Check
                                    type="radio"
                                    id={`dist-difficulty-${topicConfig.topic_id}`}
                                    label="Phân bố theo độ khó"
                                    checked={topicConfig.distribution_type === 'difficulty'}
                                    onChange={() => updateTopicConfig(topicConfig.topic_id, { distribution_type: 'difficulty' })}
                                    className="mb-2"
                                  />
                                  <Form.Check
                                    type="radio"
                                    id={`dist-bloom-${topicConfig.topic_id}`}
                                    label="Phân bố theo Bloom's Taxonomy"
                                    checked={topicConfig.distribution_type === 'bloom'}
                                    onChange={() => updateTopicConfig(topicConfig.topic_id, { distribution_type: 'bloom' })}
                                  />
                                </div>
                              </Form.Group>

                              {/* Kiểu Random - Chỉ hiển thị khi random_on_exam */}
                              {examForm.question_selection_mode === 'random_on_exam' && (
                                <Form.Group className="mb-3">
                                  <Form.Label className="info-label" style={{ fontSize: '13px', marginBottom: '8px' }}>
                                    <i className="fas fa-random me-2"></i>
                                    Kiểu Random
                                  </Form.Label>
                                  <div>
                                    <Form.Check
                                      type="radio"
                                      id={`modal-random-all-${topicConfig.topic_id}`}
                                      label="Random tất cả - Mỗi lần thi sẽ random lại câu hỏi từ chủ đề"
                                      checked={(topicConfig.random_type || 'all') === 'all'}
                                      onChange={() => updateTopicConfig(topicConfig.topic_id, { random_type: 'all' })}
                                      className="mb-2"
                                    />
                                    <Form.Check
                                      type="radio"
                                      id={`modal-random-fixed-${topicConfig.topic_id}`}
                                      label="Random cố định - Random một lần khi tạo đề, sau đó giữ nguyên cho tất cả thí sinh"
                                      checked={topicConfig.random_type === 'fixed'}
                                      onChange={() => updateTopicConfig(topicConfig.topic_id, { random_type: 'fixed' })}
                                    />
                                  </div>
                                  <Form.Text className="text-muted" style={{ fontSize: '12px' }}>
                                    <i className="fas fa-info-circle me-1"></i>
                                    Random tất cả: Mỗi thí sinh sẽ nhận bộ câu hỏi khác nhau. Random cố định: Tất cả thí sinh cùng một bộ câu hỏi đã được random trước.
                                  </Form.Text>
                                </Form.Group>
                              )}

                              {/* Phân bố theo độ khó */}
                              {topicConfig.distribution_type === 'difficulty' && (
                                <div className="mb-3">
                                  <h6 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '12px' }}>
                                    <i className="fas fa-chart-bar me-2"></i>
                                    Phân bố theo độ khó
                                  </h6>
                                  <Row className="g-2">
                                    {['easy', 'medium', 'hard', 'expert'].map((difficulty) => {
                                      const difficultyLabels = {
                                        easy: 'Dễ',
                                        medium: 'Trung bình',
                                        hard: 'Khó',
                                        expert: 'Chuyên gia'
                                      };
                                      const count = topicConfig.difficulty_distribution?.[difficulty] || 0;
                                      const points = topicConfig.difficulty_distribution?.[`${difficulty}_points`] || 0;
                                      const avgPoints = calculateAveragePointsForTopic(topicConfig.topic_id, 'difficulty', difficulty);

                                      return (
                                        <Col md={3} xs={6} key={difficulty}>
                                          <div className="border rounded p-2 mb-2">
                                            <Form.Label className="info-label" style={{ fontSize: '12px', marginBottom: '4px', fontWeight: '600' }}>
                                              {difficultyLabels[difficulty]}
                                            </Form.Label>
                                            <Form.Control
                                              type="number"
                                              size="sm"
                                              min="0"
                                              placeholder="Số câu"
                                              value={count}
                                              onChange={(e) => {
                                                const numQuestions = parseInt(e.target.value) || 0;
                                                const calculatedPoints = numQuestions > 0 ? numQuestions * avgPoints : 0;
                                                updateTopicConfig(topicConfig.topic_id, {
                                                  difficulty_distribution: {
                                                    ...topicConfig.difficulty_distribution,
                                                    [difficulty]: numQuestions,
                                                    [`${difficulty}_points`]: calculatedPoints
                                                  }
                                                });
                                              }}
                                              className="mb-2"
                                            />
                                            {(examForm.question_selection_mode === 'first_on_exam' || examForm.question_selection_mode === 'random_on_exam') && (
                                              <Form.Control
                                                type="number"
                                                size="sm"
                                                step="0.01"
                                                min="0"
                                                placeholder="Điểm mỗi câu"
                                                value={points > 0 && count > 0 ? (points / count).toFixed(2) : ''}
                                                onChange={(e) => {
                                                  const pointsPerQuestion = parseFloat(e.target.value) || 0;
                                                  const totalPoints = pointsPerQuestion * count;
                                                  updateTopicConfig(topicConfig.topic_id, {
                                                    difficulty_distribution: {
                                                      ...topicConfig.difficulty_distribution,
                                                      [`${difficulty}_points`]: totalPoints
                                                    }
                                                  });
                                                }}
                                              />
                                            )}
                                            {count > 0 && points > 0 && (examForm.question_selection_mode !== 'first_on_exam' && examForm.question_selection_mode !== 'random_on_exam') && (
                                              <div style={{ fontSize: '11px', color: '#6c757d', marginTop: '4px' }}>
                                                <i className="fas fa-calculator me-1"></i>
                                                Điểm/câu: {(points / count).toFixed(3)}
                                              </div>
                                            )}
                                          </div>
                                        </Col>
                                      );
                                    })}
                                  </Row>
                                </div>
                              )}

                              {/* Phân bố theo Bloom's Taxonomy */}
                              {topicConfig.distribution_type === 'bloom' && (
                                <div className="mb-3">
                                  <h6 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '12px' }}>
                                    <i className="fas fa-brain me-2"></i>
                                    Phân bố theo Bloom's Taxonomy
                                  </h6>
                                  <Row className="g-2">
                                    {['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'].map((bloomLevel) => {
                                      const bloomLabels = {
                                        remember: 'Nhớ (Remember)',
                                        understand: 'Hiểu (Understand)',
                                        apply: 'Vận dụng (Apply)',
                                        analyze: 'Phân tích (Analyze)',
                                        evaluate: 'Đánh giá (Evaluate)',
                                        create: 'Sáng tạo (Create)'
                                      };
                                      const count = topicConfig.bloom_distribution?.[bloomLevel] || 0;
                                      const points = topicConfig.bloom_distribution?.[`${bloomLevel}_points`] || 0;
                                      const avgPoints = calculateAveragePointsForTopic(topicConfig.topic_id, 'bloom', bloomLevel);

                                      return (
                                        <Col md={2} xs={6} key={bloomLevel}>
                                          <div className="border rounded p-2 mb-2">
                                            <Form.Label className="info-label" style={{ fontSize: '12px', marginBottom: '4px', fontWeight: '600' }}>
                                              {bloomLabels[bloomLevel]}
                                            </Form.Label>
                                            <Form.Control
                                              type="number"
                                              size="sm"
                                              min="0"
                                              placeholder="Số câu"
                                              value={count}
                                              onChange={(e) => {
                                                const numQuestions = parseInt(e.target.value) || 0;
                                                const calculatedPoints = numQuestions > 0 ? numQuestions * avgPoints : 0;
                                                updateTopicConfig(topicConfig.topic_id, {
                                                  bloom_distribution: {
                                                    ...topicConfig.bloom_distribution,
                                                    [bloomLevel]: numQuestions,
                                                    [`${bloomLevel}_points`]: calculatedPoints
                                                  }
                                                });
                                              }}
                                              className="mb-2"
                                            />
                                            {(examForm.question_selection_mode === 'first_on_exam' || examForm.question_selection_mode === 'random_on_exam') && (
                                              <Form.Control
                                                type="number"
                                                size="sm"
                                                step="0.01"
                                                min="0"
                                                placeholder="Điểm mỗi câu"
                                                value={points > 0 && count > 0 ? (points / count).toFixed(2) : ''}
                                                onChange={(e) => {
                                                  const pointsPerQuestion = parseFloat(e.target.value) || 0;
                                                  const totalPoints = pointsPerQuestion * count;
                                                  updateTopicConfig(topicConfig.topic_id, {
                                                    bloom_distribution: {
                                                      ...topicConfig.bloom_distribution,
                                                      [`${bloomLevel}_points`]: totalPoints
                                                    }
                                                  });
                                                }}
                                              />
                                            )}
                                            {count > 0 && points > 0 && (examForm.question_selection_mode !== 'first_on_exam' && examForm.question_selection_mode !== 'random_on_exam') && (
                                              <div style={{ fontSize: '11px', color: '#6c757d', marginTop: '4px' }}>
                                                <i className="fas fa-calculator me-1"></i>
                                                Điểm/câu: {(points / count).toFixed(3)}
                                              </div>
                                            )}
                                          </div>
                                        </Col>
                                      );
                                    })}
                                  </Row>
                                </div>
                              )}

                              {/* Validation summary */}
                              <Alert variant={(() => {
                                const errors = validateTopicConfig(topicConfig);
                                const missingDetails = calculateMissingQuestionsByCategory(topicConfig, topic);
                                return errors.length > 0 || missingDetails.length > 0 ? 'warning' : 'success';
                              })()} className="mt-2 mb-0" style={{ fontSize: '12px' }}>
                                {(() => {
                                  const errors = validateTopicConfig(topicConfig);
                                  const missingDetails = calculateMissingQuestionsByCategory(topicConfig, topic);
                                  if (errors.length > 0) {
                                    return (
                                      <div>
                                        <i className="fas fa-exclamation-triangle me-2"></i>
                                        {errors.join(', ')}
                                      </div>
                                    );
                                  }
                                  const totalQuestions = topicConfig.distribution_type === 'difficulty'
                                    ? (topicConfig.difficulty_distribution?.easy || 0) +
                                      (topicConfig.difficulty_distribution?.medium || 0) +
                                      (topicConfig.difficulty_distribution?.hard || 0) +
                                      (topicConfig.difficulty_distribution?.expert || 0)
                                    : (topicConfig.bloom_distribution?.remember || 0) +
                                      (topicConfig.bloom_distribution?.understand || 0) +
                                      (topicConfig.bloom_distribution?.apply || 0) +
                                      (topicConfig.bloom_distribution?.analyze || 0) +
                                      (topicConfig.bloom_distribution?.evaluate || 0) +
                                      (topicConfig.bloom_distribution?.create || 0);
                                  const totalPoints = topicConfig.distribution_type === 'difficulty'
                                    ? (topicConfig.difficulty_distribution?.easy_points || 0) +
                                      (topicConfig.difficulty_distribution?.medium_points || 0) +
                                      (topicConfig.difficulty_distribution?.hard_points || 0) +
                                      (topicConfig.difficulty_distribution?.expert_points || 0)
                                    : (topicConfig.bloom_distribution?.remember_points || 0) +
                                      (topicConfig.bloom_distribution?.understand_points || 0) +
                                      (topicConfig.bloom_distribution?.apply_points || 0) +
                                      (topicConfig.bloom_distribution?.analyze_points || 0) +
                                      (topicConfig.bloom_distribution?.evaluate_points || 0) +
                                      (topicConfig.bloom_distribution?.create_points || 0);
                                  
                                  const approvedCount = topic.approved_count !== undefined 
                                    ? (topic.approved_count || 0)
                                    : (() => {
                                        const topicIdNum = parseInt(topic.topic_id);
                                        return questions.filter(q => {
                                          const qTopicId = parseInt(q.topic_id);
                                          return !isNaN(qTopicId) && !isNaN(topicIdNum) && qTopicId === topicIdNum;
                                        }).length;
                                      })();
                                  const remainingQuestions = topic?.remaining_questions !== undefined ? topic.remaining_questions : approvedCount;
                                  
                                  return (
                                    <div>
                                      <div className="mb-1">
                                        <i className="fas fa-check-circle me-2"></i>
                                        <strong>Tổng kết:</strong> {totalQuestions} câu hỏi - {totalPoints.toFixed(2)} điểm
                                      </div>
                                      {remainingQuestions !== undefined && (
                                        <div className="mb-1">
                                          <i className="fas fa-info-circle me-2"></i>
                                          <strong>Còn lại:</strong> {remainingQuestions} câu hỏi
                                        </div>
                                      )}
                                      {missingDetails.length > 0 && (
                                        <div style={{ color: '#dc3545', marginTop: '4px' }}>
                                          <i className="fas fa-exclamation-triangle me-2"></i>
                                          <strong>Thiếu câu hỏi:</strong> {missingDetails.join(', ')}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </Alert>
                            </Accordion.Body>
                          </Accordion.Item>
                        );
                      })}
                    </Accordion>
                  </div>
                )}
              </div>
            </div>

            {/* Cách lấy câu hỏi - Chỉ hiển thị trong Blueprint modal */}
            <div className="session-card mb-3">
              <div className="card-header-modern">
                <div className="header-icon">
                  <i className="fas fa-cog"></i>
                </div>
                <h6 className="mb-0">Cách lấy câu hỏi</h6>
              </div>
              <div className="card-body-modern">
                <Form.Group className="mb-2">
                  <Form.Label className="info-label" style={{ fontSize: '14px', marginBottom: '4px' }}>
                    <i className="fas fa-question-circle me-2"></i>
                    Chế độ lấy câu hỏi
                  </Form.Label>
                  <Form.Select
                    value={examForm.question_selection_mode}
                    onChange={(e) => {
                      const newMode = e.target.value;
                      setExamForm({ ...examForm, question_selection_mode: newMode });
                      // Nếu chọn mode "on_exam", xóa danh sách câu hỏi đã chọn và reset các state liên quan
                      if (newMode === 'first_on_exam' || newMode === 'random_on_exam') {
                        setSelectedQuestions([]);
                        setOriginalQuestionPoints([]);
                        setHasRedistributedPoints(false);
                      }
                    }}
                    className="form-control-modern"
                    size="sm"
                  >
                    <option value="first_on_create">1. Lúc tạo: Lấy câu hỏi đầu tiên của chủ đề</option>
                    <option value="random_on_create">2. Lúc tạo: Lấy câu hỏi random của chủ đề</option>
                    <option value="first_on_exam">3. Lúc thi: Lấy câu hỏi đầu tiên của chủ đề</option>
                    <option value="random_on_exam">4. Lúc thi: Lấy câu hỏi random của chủ đề</option>
                  </Form.Select>
                  <Form.Text className="text-muted" style={{ fontSize: '12px' }}>
                    {examForm.question_selection_mode === 'first_on_exam' || examForm.question_selection_mode === 'random_on_exam'
                      ? 'Câu hỏi sẽ được chọn tự động khi sinh viên bắt đầu làm bài. Danh sách câu hỏi sẽ không hiển thị.'
                      : 'Câu hỏi sẽ được chọn ngay khi áp dụng ma trận và hiển thị trong danh sách.'}
                  </Form.Text>
                </Form.Group>
              </div>
            </div>

            {/* Toggle switches */}
            <div className="session-card mb-3">
              <div className="card-header-modern">
                <div className="header-icon">
                  <i className="fas fa-sliders-h"></i>
                </div>
                <h6 className="mb-0">Phương thức phân bố</h6>
              </div>
              <div className="card-body-modern">
                <Form.Group className="mb-2">
                  <Form.Check
                    type="switch"
                    id="difficulty-distribution-switch"
                    label="Phân bố theo độ khó"
                    checked={blueprint.use_difficulty_distribution}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setBlueprint({
                        ...blueprint,
                        use_difficulty_distribution: checked,
                        use_bloom_distribution: checked ? false : blueprint.use_bloom_distribution
                      });
                    }}
                  />
                </Form.Group>
                <Form.Group className="mb-0">
                  <Form.Check
                    type="switch"
                    id="bloom-distribution-switch"
                    label="Phân bố theo Bloom's Taxonomy"
                    checked={blueprint.use_bloom_distribution}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setBlueprint({
                        ...blueprint,
                        use_bloom_distribution: checked,
                        use_difficulty_distribution: checked ? false : blueprint.use_difficulty_distribution
                      });
                    }}
                    disabled={blueprint.use_difficulty_distribution}
                  />
                  {blueprint.use_difficulty_distribution && (
                    <Form.Text className="text-muted" style={{ fontSize: '12px' }}>
                      Tắt "Phân bố theo độ khó" để sử dụng "Phân bố theo Bloom's Taxonomy"
                    </Form.Text>
                  )}
                </Form.Group>
              </div>
            </div>

            {/* Phân bố theo độ khó */}
            {blueprint.use_difficulty_distribution && (
              <div className="session-card mb-3">
                <div className="card-header-modern">
                  <div className="header-icon">
                    <i className="fas fa-chart-bar"></i>
                  </div>
                  <h6 className="mb-0">Phân bố theo độ khó</h6>
                </div>
                <div className="card-body-modern">
                  <Row className="g-2">
                    <Col md={3}>
                      <Form.Group className="mb-2">
                        <Form.Label className="info-label" style={{ fontSize: '13px', marginBottom: '4px' }}>Dễ</Form.Label>
                        <Form.Control
                          type="number"
                          size="sm"
                          value={blueprint.easy}
                          onChange={(e) => setBlueprint({ ...blueprint, easy: parseInt(e.target.value) || 0 })}
                          className="form-control-modern"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={3}>
                      <Form.Group className="mb-2">
                        <Form.Label className="info-label" style={{ fontSize: '13px', marginBottom: '4px' }}>Trung bình</Form.Label>
                        <Form.Control
                          type="number"
                          size="sm"
                          value={blueprint.medium}
                          onChange={(e) => setBlueprint({ ...blueprint, medium: parseInt(e.target.value) || 0 })}
                          className="form-control-modern"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={3}>
                      <Form.Group className="mb-2">
                        <Form.Label className="info-label" style={{ fontSize: '13px', marginBottom: '4px' }}>Khó</Form.Label>
                        <Form.Control
                          type="number"
                          size="sm"
                          value={blueprint.hard}
                          onChange={(e) => setBlueprint({ ...blueprint, hard: parseInt(e.target.value) || 0 })}
                          className="form-control-modern"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={3}>
                      <Form.Group className="mb-2">
                        <Form.Label className="info-label" style={{ fontSize: '13px', marginBottom: '4px' }}>Chuyên gia</Form.Label>
                        <Form.Control
                          type="number"
                          size="sm"
                          value={blueprint.expert}
                          onChange={(e) => setBlueprint({ ...blueprint, expert: parseInt(e.target.value) || 0 })}
                          className="form-control-modern"
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                </div>
              </div>
            )}

            {/* Phân bố theo Bloom's Taxonomy */}
            {blueprint.use_bloom_distribution && (
              <div className="session-card mb-3">
                <div className="card-header-modern">
                  <div className="header-icon">
                    <i className="fas fa-brain"></i>
                  </div>
                  <h6 className="mb-0">Phân bố theo Bloom's Taxonomy</h6>
                </div>
                <div className="card-body-modern">
                  <Row className="g-2">
                    <Col md={4}>
                      <Form.Group className="mb-2">
                        <Form.Label className="info-label" style={{ fontSize: '13px', marginBottom: '4px' }}>Remember (Nhớ)</Form.Label>
                        <Form.Control
                          type="number"
                          size="sm"
                          value={blueprint.remember}
                          onChange={(e) => setBlueprint({ ...blueprint, remember: parseInt(e.target.value) || 0 })}
                          className="form-control-modern"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group className="mb-2">
                        <Form.Label className="info-label" style={{ fontSize: '13px', marginBottom: '4px' }}>Understand (Hiểu)</Form.Label>
                        <Form.Control
                          type="number"
                          size="sm"
                          value={blueprint.understand}
                          onChange={(e) => setBlueprint({ ...blueprint, understand: parseInt(e.target.value) || 0 })}
                          className="form-control-modern"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group className="mb-2">
                        <Form.Label className="info-label" style={{ fontSize: '13px', marginBottom: '4px' }}>Apply (Vận dụng)</Form.Label>
                        <Form.Control
                          type="number"
                          size="sm"
                          value={blueprint.apply}
                          onChange={(e) => setBlueprint({ ...blueprint, apply: parseInt(e.target.value) || 0 })}
                          className="form-control-modern"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group className="mb-2">
                        <Form.Label className="info-label" style={{ fontSize: '13px', marginBottom: '4px' }}>Analyze (Phân tích)</Form.Label>
                        <Form.Control
                          type="number"
                          size="sm"
                          value={blueprint.analyze}
                          onChange={(e) => setBlueprint({ ...blueprint, analyze: parseInt(e.target.value) || 0 })}
                          className="form-control-modern"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group className="mb-2">
                        <Form.Label className="info-label" style={{ fontSize: '13px', marginBottom: '4px' }}>Evaluate (Đánh giá)</Form.Label>
                        <Form.Control
                          type="number"
                          size="sm"
                          value={blueprint.evaluate}
                          onChange={(e) => setBlueprint({ ...blueprint, evaluate: parseInt(e.target.value) || 0 })}
                          className="form-control-modern"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group className="mb-2">
                        <Form.Label className="info-label" style={{ fontSize: '13px', marginBottom: '4px' }}>Create (Sáng tạo)</Form.Label>
                        <Form.Control
                          type="number"
                          size="sm"
                          value={blueprint.create}
                          onChange={(e) => setBlueprint({ ...blueprint, create: parseInt(e.target.value) || 0 })}
                          className="form-control-modern"
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                </div>
              </div>
            )}

            {/* Danh sách câu hỏi sẽ được chọn - Chỉ hiển thị nếu không phải mode "on_exam" */}
            {(examForm.question_selection_mode !== 'first_on_exam' && examForm.question_selection_mode !== 'random_on_exam') ? (
              <div className="session-card mt-3">
                <div className="card-header-modern">
                  <div className="header-icon">
                    <i className="fas fa-list"></i>
                  </div>
                  <h6 className="mb-0">
                    Danh sách câu hỏi sẽ được chọn
                    {previewQuestions.selected.length > 0 && (
                      <Badge bg="primary" className="ms-2">{previewQuestions.selected.length} câu</Badge>
                    )}
                  </h6>
                </div>
                <div className="card-body-modern">
                  {(() => {
                    const { selected, currentPoints } = previewQuestions;
                    if (selected.length === 0) {
                      return (
                        <div className="text-center text-muted py-3">
                          <i className="fas fa-info-circle me-2"></i>
                          Chưa có câu hỏi nào. Vui lòng cấu hình ma trận ở trên.
                        </div>
                      );
                    }
                    return (
                      <div className="table-responsive" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        <Table striped bordered hover size="sm" className="mb-0">
                          <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', zIndex: 1 }}>
                            <tr>
                              <th style={{ width: '50px' }}>#</th>
                              <th>Câu hỏi</th>
                              <th style={{ width: '100px' }}>Độ khó</th>
                              <th style={{ width: '120px' }}>Bloom</th>
                              <th style={{ width: '80px' }}>Điểm</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selected.map((q, index) => {
                              const fullQuestion = questions.find(qu => qu.question_id === q.question_id) || q;
                              return (
                                <tr key={q.question_id}>
                                  <td className="text-center">{index + 1}</td>
                                  <td>
                                    <div style={{
                                      maxWidth: '400px',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap'
                                    }} title={fullQuestion.question_text || q.question_text || 'N/A'}>
                                      {fullQuestion.question_text || q.question_text || 'N/A'}
                                    </div>
                                  </td>
                                  <td className="text-center">
                                    {q.difficulty_level && (
                                      <Badge bg={
                                        q.difficulty_level === 'easy' ? 'success' :
                                          q.difficulty_level === 'medium' ? 'warning' :
                                            q.difficulty_level === 'hard' ? 'danger' : 'dark'
                                      }>
                                        {q.difficulty_level === 'easy' ? 'Dễ' :
                                          q.difficulty_level === 'medium' ? 'TB' :
                                            q.difficulty_level === 'hard' ? 'Khó' : 'Chuyên gia'}
                                      </Badge>
                                    )}
                                  </td>
                                  <td className="text-center">
                                    {q.bloom_level && (
                                      <Badge bg="info">{q.bloom_level}</Badge>
                                    )}
                                  </td>
                                  <td className="text-center">
                                    <strong>{q.points || 1}</strong>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot style={{ position: 'sticky', bottom: 0, backgroundColor: '#f8f9fa', zIndex: 1 }}>
                            <tr>
                              <td colSpan="4" className="text-end"><strong>Tổng điểm:</strong></td>
                              <td className="text-center"><strong>{parseFloat(currentPoints).toFixed(2)}</strong></td>
                            </tr>
                          </tfoot>
                        </Table>
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div className="session-card mt-3">
                <div className="card-header-modern">
                  <div className="header-icon">
                    <i className="fas fa-info-circle"></i>
                  </div>
                  <h6 className="mb-0">Thông tin</h6>
                </div>
                <div className="card-body-modern">
                  <Alert variant="info" className="mb-0">
                    <div className="d-flex align-items-center">
                      <i className="fas fa-info-circle me-3"></i>
                      <div>
                        <strong>Chế độ tự động:</strong> Câu hỏi sẽ được chọn tự động khi sinh viên bắt đầu làm bài dựa trên ma trận đề thi.
                        Danh sách câu hỏi sẽ không hiển thị ở đây.
                      </div>
                    </div>
                  </Alert>
                </div>
              </div>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer className="student-detail-footer">
          <Button variant="outline-secondary" onClick={() => setShowBlueprintModal(false)} className="btn-cancel">
            <i className="fas fa-times me-2"></i>
            Hủy
          </Button>
          <Button variant="primary" onClick={handleAddQuestionsByBlueprint} className="btn-edit">
            <i className="fas fa-check me-2"></i>Áp dụng ma trận
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Monitoring Modal */}
      <Modal show={showMonitoringModal} onHide={() => setShowMonitoringModal(false)} size="xl" className="student-detail-modal">
        <Modal.Header closeButton className="student-detail-header">
          <Modal.Title className="student-detail-title">
            <div className="student-avatar">
              <i className="fas fa-eye"></i>
            </div>
            <div>
              <h4 className="mb-0">Chi tiết giám sát & Phát hiện gian lận</h4>
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="student-detail-body">
          {/* Chi tiết sự kiện gian lận */}
          {loading ? (
            <div className="text-center p-4">
              <Spinner animation="border" variant="primary" />
              <p className="mt-3">Đang tải dữ liệu...</p>
            </div>
          ) : cheatingLogs.length === 0 ? (
            <div className="session-card">
              <div className="card-body-modern text-center p-5">
                <i className="fas fa-check-circle fa-4x text-success mb-3"></i>
                <h5>Không có sự kiện gian lận</h5>
                <p className="text-muted mb-0">Không có sự kiện gian lận nào được phát hiện</p>
              </div>
            </div>
          ) : (
            <div className="session-card">
              <Table striped bordered hover size="sm" className="session-table">
                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1 }}>
                  <tr>
                    <th>Thời gian</th>
                    <th>Sinh viên</th>
                    <th>Loại sự kiện</th>
                    <th>Mức độ</th>
                    <th>Mô tả</th>
                    <th>Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {cheatingLogs.map((log, index) => (
                    <tr key={index}>
                      <td>{new Date(log.event_time).toLocaleString('vi-VN')}</td>
                      <td>
                        <div>
                          <strong>{log.student_name || 'N/A'}</strong>
                          <br />
                          <small className="text-muted">{log.student_id || 'N/A'}</small>
                        </div>
                      </td>
                      <td>
                        <Badge bg={
                          log.event_type === 'page_visibility_hidden' ? 'danger' :
                            log.event_type === 'page_visibility_visible' ? 'warning' :
                              log.event_type === 'window_blur' ? 'info' :
                                log.event_type === 'window_focus' ? 'secondary' :
                                  log.event_type === 'before_unload' ? 'danger' :
                                    log.event_type === 'exam_started' ? 'success' :
                                      log.event_type === 'exam_ended' ? 'success' : 'secondary'
                        }>
                          {log.event_type}
                        </Badge>
                      </td>
                      <td>
                        <Badge bg={
                          log.severity === 'high' ? 'danger' :
                            log.severity === 'medium' ? 'warning' : 'info'
                        }>
                          {log.severity}
                        </Badge>
                      </td>
                      <td>{log.description}</td>
                      <td>
                        {log.event_data && typeof log.event_data === 'object' ? (
                          <details>
                            <summary className="text-primary" style={{ cursor: 'pointer' }}>
                              Xem chi tiết
                            </summary>
                            <pre style={{ fontSize: '0.85em', marginTop: '5px', whiteSpace: 'pre-wrap' }}>
                              {JSON.stringify(log.event_data, null, 2)}
                            </pre>
                          </details>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="student-detail-footer">
          <Button variant="outline-secondary" onClick={() => setShowMonitoringModal(false)} className="btn-cancel">
            <i className="fas fa-times me-2"></i>
            Đóng
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Webcam Video Modal */}
      <Modal show={showWebcamModal} onHide={() => {
        setShowWebcamModal(false);
        setWebcamVideoUrl(null);
        setSelectedAttemptForVideo(null);
      }} size="xl" className="student-detail-modal">
        <Modal.Header closeButton className="student-detail-header">
          <Modal.Title className="student-detail-title">
            <div className="student-avatar">
              <i className="fas fa-video"></i>
            </div>
            <div>
              <h4 className="mb-0">Video Webcam Giám sát</h4>
              {selectedAttemptForVideo && (
                <p className="mb-0 student-subtitle">
                  {selectedAttemptForVideo.student_name} ({selectedAttemptForVideo.student_id})
                </p>
              )}
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="student-detail-body">
          <div className="student-detail-container">
            {loadingVideo ? (
              <div className="text-center p-5">
                <Spinner animation="border" variant="primary" />
                <p className="mt-3">Đang tải video...</p>
              </div>
            ) : webcamVideoUrl ? (
              <div className="session-card">
                <div className="card-header-modern mb-3">
                  <div className="header-icon">
                    <i className="fas fa-video"></i>
                  </div>
                  <h6 className="mb-0">Video ghi lại từ webcam</h6>
                </div>
                <div className="card-body-modern">
                  {selectedAttemptForVideo && (
                    <div className="mb-3">
                      <div className="info-item">
                        <div className="info-label">
                          <i className="fas fa-user me-2"></i>
                          <span>Sinh viên:</span>
                        </div>
                        <div className="info-value">
                          <strong>{selectedAttemptForVideo.student_name}</strong> ({selectedAttemptForVideo.student_id})
                        </div>
                      </div>
                      <div className="info-item">
                        <div className="info-label">
                          <i className="fas fa-clock me-2"></i>
                          <span>Thời gian bắt đầu:</span>
                        </div>
                        <div className="info-value">
                          {new Date(selectedAttemptForVideo.start_time).toLocaleString('vi-VN')}
                        </div>
                      </div>
                      {selectedAttemptForVideo.submit_time && (
                        <div className="info-item">
                          <div className="info-label">
                            <i className="fas fa-check-circle me-2"></i>
                            <span>Thời gian nộp:</span>
                          </div>
                          <div className="info-value">
                            {new Date(selectedAttemptForVideo.submit_time).toLocaleString('vi-VN')}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="video-container" style={{
                    position: 'relative',
                    width: '100%',
                    paddingBottom: '56.25%', // 16:9 aspect ratio
                    height: 0,
                    backgroundColor: '#000',
                    borderRadius: '8px',
                    overflow: 'hidden'
                  }}>
                    {webcamVideoUrl.startsWith('https://drive.google.com') || webcamVideoUrl.startsWith('http://drive.google.com') ? (
                      // Google Drive video - embed using iframe
                      (() => {
                        // Extract file ID from Google Drive URL
                        // Format: https://drive.google.com/file/d/{FILE_ID}/view?usp=sharing
                        const fileIdMatch = webcamVideoUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
                        const fileId = fileIdMatch ? fileIdMatch[1] : null;

                        if (fileId) {
                          // Use Google Drive embed URL
                          const embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
                          return (
                            <iframe
                              src={embedUrl}
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                border: 'none'
                              }}
                              allow="autoplay"
                              allowFullScreen
                              title="Video webcam giám sát"
                            />
                          );
                        } else {
                          // Fallback if file ID cannot be extracted
                          return (
                            <div className="text-center p-5">
                              <Alert variant="warning">
                                <Alert.Heading>Không thể embed video</Alert.Heading>
                                <p>Không thể trích xuất file ID từ Google Drive URL. Vui lòng mở video bằng liên kết bên dưới:</p>
                                <Button
                                  variant="primary"
                                  href={webcamVideoUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <i className="fas fa-external-link-alt me-2"></i>
                                  Mở video trên Google Drive
                                </Button>
                              </Alert>
                            </div>
                          );
                        }
                      })()
                    ) : (
                      // Local video - use HTML5 video player
                      <video
                        controls
                        autoPlay
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain'
                        }}
                        src={webcamVideoUrl}
                      >
                        Trình duyệt của bạn không hỗ trợ video HTML5.
                      </video>
                    )}
                  </div>

                  {!webcamVideoUrl.startsWith('https://drive.google.com') && !webcamVideoUrl.startsWith('http://drive.google.com') && (
                    <div className="mt-3 text-center">
                      <Button
                        variant="outline-primary"
                        href={webcamVideoUrl}
                        target="_blank"
                        download
                      >
                        <i className="fas fa-download me-2"></i>
                        Tải video về
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="session-card">
                <div className="card-body-modern text-center p-5">
                  <i className="fas fa-video-slash fa-4x text-muted mb-3"></i>
                  <h5>Không có video</h5>
                  <p className="text-muted mb-0">Không tìm thấy video webcam cho bài làm này</p>
                </div>
              </div>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer className="student-detail-footer">
          <Button variant="outline-secondary" onClick={() => {
            setShowWebcamModal(false);
            setWebcamVideoUrl(null);
            setSelectedAttemptForVideo(null);
          }} className="btn-cancel">
            <i className="fas fa-times me-2"></i>
            Đóng
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Ban Student Modal */}
      <Modal show={showBanModal} onHide={() => {
        setShowBanModal(false);
        setSelectedAttemptForBan(null);
      }} className="student-detail-modal">
        <Modal.Header closeButton className="student-detail-header">
          <Modal.Title className="student-detail-title">
            <div className="student-avatar">
              <i className="fas fa-ban"></i>
            </div>
            <div>
              <h4 className="mb-0">Xác nhận cấm thi</h4>
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="student-detail-body">
          {selectedAttemptForBan && (
            <div className="student-detail-container">
              <Alert variant="danger" className="mb-4">
                <div className="d-flex align-items-center">
                  <i className="fas fa-exclamation-triangle fa-2x me-3"></i>
                  <div>
                    <strong>Bạn có chắc chắn muốn cấm thi sinh viên này?</strong>
                    <p className="mb-0 mt-2">Sinh viên sẽ không thể tiếp tục làm bài và sẽ bị đưa ra khỏi màn hình thi ngay lập tức nếu đang trong quá trình thi.</p>
                  </div>
                </div>
              </Alert>

              <div className="session-card">
                <div className="card-header-modern mb-3">
                  <div className="header-icon">
                    <i className="fas fa-user"></i>
                  </div>
                  <h6 className="mb-0">Thông tin sinh viên</h6>
                </div>
                <div className="card-body-modern">
                  <div className="info-item">
                    <div className="info-label">
                      <i className="fas fa-user me-2"></i>
                      <span>Họ và tên:</span>
                    </div>
                    <div className="info-value">
                      <strong>{selectedAttemptForBan.student_name}</strong>
                    </div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">
                      <i className="fas fa-id-card me-2"></i>
                      <span>Mã sinh viên:</span>
                    </div>
                    <div className="info-value">
                      {selectedAttemptForBan.student_id}
                    </div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">
                      <i className="fas fa-clock me-2"></i>
                      <span>Thời gian bắt đầu:</span>
                    </div>
                    <div className="info-value">
                      {new Date(selectedAttemptForBan.start_time).toLocaleString('vi-VN')}
                    </div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">
                      <i className="fas fa-info-circle me-2"></i>
                      <span>Trạng thái:</span>
                    </div>
                    <div className="info-value">
                      <Badge bg={selectedAttemptForBan.status === 'in_progress' ? 'warning' : selectedAttemptForBan.status === 'submitted' ? 'success' : 'secondary'}>
                        {selectedAttemptForBan.status === 'in_progress' ? 'Đang làm bài' : 
                         selectedAttemptForBan.status === 'submitted' ? 'Đã nộp' : 
                         selectedAttemptForBan.status}
                      </Badge>
                    </div>
                  </div>
                  {selectedAttemptForBan.submit_time && (
                    <div className="info-item">
                      <div className="info-label">
                        <i className="fas fa-check-circle me-2"></i>
                        <span>Thời gian nộp:</span>
                      </div>
                      <div className="info-value">
                        {new Date(selectedAttemptForBan.submit_time).toLocaleString('vi-VN')}
                      </div>
                    </div>
                  )}
                  {selectedAttemptForBan.score !== null && selectedAttemptForBan.score !== undefined && (
                    <div className="info-item">
                      <div className="info-label">
                        <i className="fas fa-star me-2"></i>
                        <span>Điểm số:</span>
                      </div>
                      <div className="info-value">
                        <strong>{parseFloat(selectedAttemptForBan.score).toFixed(2)}</strong> / {selectedExam?.total_points || 100}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="student-detail-footer">
          <Button variant="outline-secondary" onClick={() => {
            setShowBanModal(false);
            setSelectedAttemptForBan(null);
          }} className="btn-cancel">
            <i className="fas fa-times me-2"></i>
            Hủy
          </Button>
          <Button variant="danger" onClick={async () => {
            if (!selectedAttemptForBan) return;
            
            try {
              await refreshCSRFToken();
              const response = await api.put(`/lms/attempts/${selectedAttemptForBan.attempt_id}/ban`);
              if (response.data.success) {
                showAlertMessage(`Đã cấm thi sinh viên ${selectedAttemptForBan.student_name} thành công`, 'success');
                setShowBanModal(false);
                setSelectedAttemptForBan(null);
                fetchMonitoringData(); // Refresh data
              }
            } catch (error) {
              console.error('Error banning attempt:', error);
              showAlertMessage(error.response?.data?.message || 'Lỗi khi cấm thi sinh viên', 'danger');
            }
          }} className="btn-danger">
            <i className="fas fa-ban me-2"></i>
            Xác nhận cấm thi
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Live Webcam Fullscreen Modal */}
      <Modal
        show={showLiveWebcamModal}
        onHide={() => {
          setShowLiveWebcamModal(false);
          setSelectedAttemptForLiveView(null);
        }}
        size="xl"
        fullscreen="lg-down"
        className="student-detail-modal"
      >
        <Modal.Header closeButton className="student-detail-header">
          <Modal.Title className="student-detail-title">
            <div className="student-avatar">
              <i className="fas fa-video"></i>
            </div>
            <div>
              <h4 className="mb-0">
                Live Webcam Giám sát
                {selectedAttemptForLiveView && (
                  <Badge bg="danger" className="ms-2">
                    LIVE
                  </Badge>
                )}
              </h4>
              {selectedAttemptForLiveView && (
                <p className="mb-0 student-subtitle">
                  {selectedAttemptForLiveView.student_name} ({selectedAttemptForLiveView.student_id})
                </p>
              )}
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="student-detail-body" style={{ padding: 0 }}>
          <div className="student-detail-container" style={{ padding: '20px' }}>
            {selectedAttemptForLiveView && (
              <>
                <div className="session-card mb-3">
                  <div className="card-body-modern">
                    <Row>
                      <Col md={6}>
                        <div className="info-item">
                          <div className="info-label">
                            <i className="fas fa-user me-2"></i>
                            <span>Sinh viên:</span>
                          </div>
                          <div className="info-value">
                            <strong>{selectedAttemptForLiveView.student_name}</strong> ({selectedAttemptForLiveView.student_id})
                          </div>
                        </div>
                      </Col>
                      <Col md={6}>
                        <div className="info-item">
                          <div className="info-label">
                            <i className="fas fa-clock me-2"></i>
                            <span>Thời gian bắt đầu:</span>
                          </div>
                          <div className="info-value">
                            {new Date(selectedAttemptForLiveView.start_time).toLocaleString('vi-VN')}
                          </div>
                        </div>
                      </Col>
                    </Row>
                  </div>
                </div>

                <div className="session-card">
                  <div className="card-header-modern mb-3">
                    <div className="header-icon">
                      <i className="fas fa-video"></i>
                    </div>
                    <h6 className="mb-0">Live Webcam Stream</h6>
                  </div>
                  <div className="card-body-modern">
                    {(() => {
                      const liveFrame = liveWebcamData[selectedAttemptForLiveView.attempt_id];

                      if (liveFrame) {
                        return (
                          <div style={{
                            position: 'relative',
                            width: '100%',
                            paddingBottom: '56.25%', // 16:9 aspect ratio
                            height: 0,
                            backgroundColor: '#000',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            border: '3px solid #dc3545'
                          }}>
                            <img
                              src={liveFrame}
                              alt="Live webcam stream"
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
                                imageRendering: 'auto'
                              }}
                            />
                            <Badge
                              bg="danger"
                              style={{
                                position: 'absolute',
                                top: '10px',
                                right: '10px',
                                fontSize: '14px',
                                padding: '6px 12px',
                                animation: 'pulse 2s infinite'
                              }}
                            >
                              <i className="fas fa-circle me-1" style={{ fontSize: '8px' }}></i>
                              LIVE
                            </Badge>
                          </div>
                        );
                      }

                      return (
                        <div className="text-center p-5">
                          <Spinner animation="border" variant="primary" size="lg" />
                          <p className="mt-3">Đang chờ stream từ sinh viên...</p>
                          <p className="text-muted small">
                            Nếu không có video sau vài giây, có thể sinh viên chưa bật webcam hoặc đã ngắt kết nối.
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer className="student-detail-footer">
          <Button
            variant="outline-secondary"
            onClick={() => {
              setShowLiveWebcamModal(false);
              setSelectedAttemptForLiveView(null);
            }}
            className="btn-cancel"
          >
            <i className="fas fa-times me-2"></i>
            Đóng
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Answers Detail Modal */}
      <Modal
        show={showAnswersDetailModal}
        onHide={() => {
          setShowAnswersDetailModal(false);
          setAnswersDetailData(null);
          setCurrentViewingAttemptId(null);
          lastAnsweredCountRef.current = null;
        }}
        size="xl"
        className="student-detail-modal"
      >
        <Modal.Header closeButton className="student-detail-header">
          <Modal.Title className="student-detail-title">
            <div className="student-avatar">
              <i className="fas fa-list-check"></i>
            </div>
            <div>
              <h4 className="mb-0">Chi tiết câu hỏi đã làm</h4>
              {answersDetailData && (
                <p className="mb-0 student-subtitle">
                  {answersDetailData.student_name}
                </p>
              )}
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="student-detail-body">
          <div className="student-detail-container">
            {loadingAnswersDetail ? (
              <div className="text-center p-5">
                <Spinner animation="border" variant="primary" />
                <p className="mt-3">Đang tải chi tiết đáp án...</p>
              </div>
            ) : answersDetailData && answersDetailData.questions && answersDetailData.questions.length > 0 ? (
              <div>
                {answersDetailData.questions.map((question, index) => (
                  <div key={question.question_id} className="card mb-3" style={{ border: '1px solid #e9ecef', borderRadius: '8px' }}>
                    <div className="card-header" style={{ background: '#f8f9fa', borderBottom: '1px solid #e9ecef' }}>
                      <div className="d-flex justify-content-between align-items-center">
                        <h6 className="mb-0">
                          <Badge bg="primary" className="me-2">Câu {question.question_order || index + 1}</Badge>
                          <span style={{ textTransform: 'capitalize' }}>
                            {question.question_type === 'mcq' ? 'Trắc nghiệm' :
                             question.question_type === 'multiple_choice' ? 'Trắc nghiệm' :
                             question.question_type === 'multiple_response' ? 'Nhiều đáp án' :
                             question.question_type === 'true_false' ? 'Đúng/Sai' :
                             question.question_type === 'essay' ? 'Tự luận' :
                             question.question_type === 'short_answer' ? 'Câu trả lời ngắn' :
                             question.question_type}
                          </span>
                          {question.points && (
                            <Badge bg="info" className="ms-2">{question.points} điểm</Badge>
                          )}
                        </h6>
                        {question.answer_timestamp && (
                          <small className="text-muted">
                            <i className="fas fa-clock me-1"></i>
                            {new Date(question.answer_timestamp).toLocaleString('vi-VN')}
                          </small>
                        )}
                      </div>
                    </div>
                    <div className="card-body">
                      {/* Question Text */}
                      <div className="mb-3">
                        <div 
                          dangerouslySetInnerHTML={{ __html: question.question_html || question.question_text || 'N/A' }}
                          style={{ fontSize: '15px', lineHeight: '1.6' }}
                        />
                      </div>

                      {/* Options */}
                      {question.options && question.options.length > 0 && (
                        <div className="mb-3">
                          <strong className="text-muted small">Các lựa chọn:</strong>
                          <div className="mt-2">
                            {question.options.map((option, optIndex) => {
                              const isSelected = Array.isArray(question.answer) 
                                ? question.answer.includes(String(option.option_id))
                                : String(question.answer) === String(option.option_id);
                              
                              return (
                                <div
                                  key={option.option_id || optIndex}
                                  className={`p-2 mb-2 rounded ${isSelected ? 'bg-success bg-opacity-10 border border-success' : 'bg-light'}`}
                                  style={{ borderLeft: isSelected ? '4px solid #28a745' : '4px solid transparent' }}
                                >
                                  <div className="d-flex align-items-start">
                                    <div className="me-2">
                                      {isSelected ? (
                                        <i className="fas fa-check-circle text-success"></i>
                                      ) : (
                                        <i className="far fa-circle text-muted"></i>
                                      )}
                                    </div>
                                    <div className="flex-grow-1">
                                      <span>{option.option_text || 'N/A'}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Answer for text-based questions */}
                      {(!question.options || question.options.length === 0) && question.answer && (
                        <div className="mb-3">
                          <strong className="text-muted small">Đáp án đã chọn:</strong>
                          <div className="mt-2 p-3 bg-light rounded border">
                            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                              {typeof question.answer === 'string' ? question.answer : JSON.stringify(question.answer)}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-5">
                <i className="fas fa-inbox fa-3x text-muted mb-3"></i>
                <p className="text-muted">Chưa có câu hỏi nào đã được làm</p>
              </div>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer className="student-detail-footer">
          <Button
            variant="outline-secondary"
            onClick={() => {
              setShowAnswersDetailModal(false);
              setAnswersDetailData(null);
              setCurrentViewingAttemptId(null);
              lastAnsweredCountRef.current = null;
              lastUpdateTimeRef.current = null;
              isUpdatingRef.current = false;
            }}
            className="btn-cancel"
          >
            <i className="fas fa-times me-2"></i>
            Đóng
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Delete Exam Confirmation Modal */}
      <Modal show={showDeleteConfirmModal} onHide={() => {
        setShowDeleteConfirmModal(false);
        setExamToDelete(null);
      }} className="student-detail-modal">
        <Modal.Header closeButton className="student-detail-header">
          <Modal.Title className="student-detail-title">
            <div className="student-avatar">
              <i className="fas fa-trash"></i>
            </div>
            <div>
              <h4 className="mb-0">Xác nhận xóa kỳ thi</h4>
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="student-detail-body">
          {examToDelete && (
            <div className="student-detail-container">
              <Alert variant="danger" className="mb-4">
                <div className="d-flex align-items-center">
                  <i className="fas fa-exclamation-triangle fa-2x me-3"></i>
                  <div>
                    <strong>Bạn có chắc chắn muốn xóa kỳ thi này?</strong>
                    <p className="mb-0 mt-2">Hành động này không thể hoàn tác. Tất cả dữ liệu liên quan đến kỳ thi sẽ bị xóa vĩnh viễn.</p>
                  </div>
                </div>
              </Alert>

              <div className="session-card">
                <div className="card-header-modern mb-3">
                  <div className="header-icon">
                    <i className="fas fa-clipboard-list"></i>
                  </div>
                  <h6 className="mb-0">Thông tin kỳ thi</h6>
                </div>
                <div className="card-body-modern">
                  <div className="info-item">
                    <div className="info-label">
                      <i className="fas fa-heading me-2"></i>
                      <span>Tên kỳ thi:</span>
                    </div>
                    <div className="info-value">
                      <strong>{examToDelete.exam_title}</strong>
                    </div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">
                      <i className="fas fa-tag me-2"></i>
                      <span>Loại:</span>
                    </div>
                    <div className="info-value">
                      {getTypeBadge(examToDelete.exam_type)}
                    </div>
                  </div>
                  {examToDelete.exam_description && (
                    <div className="info-item">
                      <div className="info-label">
                        <i className="fas fa-align-left me-2"></i>
                        <span>Mô tả:</span>
                      </div>
                      <div className="info-value">
                        {examToDelete.exam_description}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="student-detail-footer">
          <Button variant="outline-secondary" onClick={() => {
            setShowDeleteConfirmModal(false);
            setExamToDelete(null);
          }} className="btn-cancel">
            <i className="fas fa-times me-2"></i>
            Hủy
          </Button>
          <Button variant="danger" onClick={confirmDeleteExam} className="btn-danger">
            <i className="fas fa-trash me-2"></i>
            Xác nhận xóa
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Grant Resume Permission Confirmation Modal */}
      <Modal show={showGrantResumeModal} onHide={() => {
        setShowGrantResumeModal(false);
        setAttemptForGrantResume(null);
      }} className="student-detail-modal">
        <Modal.Header closeButton className="student-detail-header">
          <Modal.Title className="student-detail-title">
            <div className="student-avatar">
              <i className="fas fa-redo"></i>
            </div>
            <div>
              <h4 className="mb-0">Xác nhận cấp quyền tiếp tục làm bài</h4>
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="student-detail-body">
          {attemptForGrantResume && (
            <div className="student-detail-container">
              <Alert variant="info" className="mb-4">
                <div className="d-flex align-items-center">
                  <i className="fas fa-info-circle fa-2x me-3"></i>
                  <div>
                    <strong>Bạn có chắc chắn muốn cấp quyền tiếp tục làm bài cho sinh viên này?</strong>
                    <p className="mb-0 mt-2">Sinh viên sẽ có thể tiếp tục làm bài thi sau khi gặp sự cố.</p>
                  </div>
                </div>
              </Alert>

              <div className="session-card">
                <div className="card-header-modern mb-3">
                  <div className="header-icon">
                    <i className="fas fa-user"></i>
                  </div>
                  <h6 className="mb-0">Thông tin sinh viên</h6>
                </div>
                <div className="card-body-modern">
                  <div className="info-item">
                    <div className="info-label">
                      <i className="fas fa-user me-2"></i>
                      <span>Họ và tên:</span>
                    </div>
                    <div className="info-value">
                      <strong>{attemptForGrantResume.student_name}</strong>
                    </div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">
                      <i className="fas fa-id-card me-2"></i>
                      <span>Mã sinh viên:</span>
                    </div>
                    <div className="info-value">
                      {attemptForGrantResume.student_id}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="student-detail-footer">
          <Button variant="outline-secondary" onClick={() => {
            setShowGrantResumeModal(false);
            setAttemptForGrantResume(null);
          }} className="btn-cancel">
            <i className="fas fa-times me-2"></i>
            Hủy
          </Button>
          <Button variant="success" onClick={async () => {
            if (!attemptForGrantResume) return;
            
            try {
              await api.put(`/lms/attempts/${attemptForGrantResume.attempt_id}/grant-resume`);
              showAlertMessage('Đã cấp quyền tiếp tục làm bài cho sinh viên', 'success');
              setShowGrantResumeModal(false);
              setAttemptForGrantResume(null);
              fetchMonitoringData(); // Refresh data
            } catch (error) {
              console.error('Error granting resume permission:', error);
              showAlertMessage(error.response?.data?.message || 'Lỗi khi cấp quyền tiếp tục làm bài', 'danger');
            }
          }} className="btn-success">
            <i className="fas fa-check me-2"></i>
            Xác nhận cấp quyền
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Reset Attempt Confirmation Modal */}
      <Modal show={showResetConfirmModal} onHide={() => {
        setShowResetConfirmModal(false);
        setAttemptForReset(null);
      }} className="student-detail-modal">
        <Modal.Header closeButton className="student-detail-header">
          <Modal.Title className="student-detail-title">
            <div className="student-avatar">
              <i className="fas fa-undo"></i>
            </div>
            <div>
              <h4 className="mb-0">Xác nhận thi lại từ đầu</h4>
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="student-detail-body">
          {attemptForReset && (
            <div className="student-detail-container">
              <Alert variant="warning" className="mb-4">
                <div className="d-flex align-items-center">
                  <i className="fas fa-exclamation-triangle fa-2x me-3"></i>
                  <div>
                    <strong>Bạn có chắc chắn muốn cho sinh viên thi lại từ đầu?</strong>
                    <p className="mb-0 mt-2">Tất cả dữ liệu của bài thi hiện tại sẽ bị reset và sinh viên sẽ bắt đầu lại từ đầu.</p>
                  </div>
                </div>
              </Alert>

              <div className="session-card">
                <div className="card-header-modern mb-3">
                  <div className="header-icon">
                    <i className="fas fa-user"></i>
                  </div>
                  <h6 className="mb-0">Thông tin sinh viên</h6>
                </div>
                <div className="card-body-modern">
                  <div className="info-item">
                    <div className="info-label">
                      <i className="fas fa-user me-2"></i>
                      <span>Họ và tên:</span>
                    </div>
                    <div className="info-value">
                      <strong>{attemptForReset.student_name}</strong>
                    </div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">
                      <i className="fas fa-id-card me-2"></i>
                      <span>Mã sinh viên:</span>
                    </div>
                    <div className="info-value">
                      {attemptForReset.student_id}
                    </div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">
                      <i className="fas fa-info-circle me-2"></i>
                      <span>Trạng thái hiện tại:</span>
                    </div>
                    <div className="info-value">
                      <Badge bg={attemptForReset.status === 'in_progress' ? 'warning' : attemptForReset.status === 'submitted' ? 'success' : 'secondary'}>
                        {attemptForReset.status === 'in_progress' ? 'Đang làm bài' : 
                         attemptForReset.status === 'submitted' ? 'Đã nộp' : 
                         attemptForReset.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="session-card mt-3">
                <div className="card-header-modern mb-3">
                  <div className="header-icon">
                    <i className="fas fa-list"></i>
                  </div>
                  <h6 className="mb-0">Những gì sẽ bị reset</h6>
                </div>
                <div className="card-body-modern">
                  <ul className="mb-0">
                    <li>Đáp án đã chọn</li>
                    <li>Thời gian còn lại (về ban đầu)</li>
                    <li>Trang hiện tại (về trang 1)</li>
                    <li>Quyền tiếp tục làm bài</li>
                    <li>Điểm số và thời gian nộp (nếu đã nộp)</li>
                  </ul>
                  <Alert variant="info" className="mt-3 mb-0">
                    <i className="fas fa-info-circle me-2"></i>
                    Sinh viên sẽ bắt đầu lại bài thi từ đầu.
                  </Alert>
                </div>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="student-detail-footer">
          <Button variant="outline-secondary" onClick={() => {
            setShowResetConfirmModal(false);
            setAttemptForReset(null);
          }} className="btn-cancel">
            <i className="fas fa-times me-2"></i>
            Hủy
          </Button>
          <Button variant="warning" onClick={async () => {
            if (!attemptForReset) return;
            
            try {
              await refreshCSRFToken();
              const response = await api.post(`/lms/attempts/${attemptForReset.attempt_id}/reset`);
              if (response.data.success) {
                showAlertMessage('Đã reset bài thi thành công. Sinh viên sẽ bắt đầu lại từ đầu.', 'success');
                setShowResetConfirmModal(false);
                setAttemptForReset(null);
                fetchMonitoringData(); // Refresh data
              }
            } catch (error) {
              console.error('Error resetting attempt:', error);
              showAlertMessage(error.response?.data?.message || 'Lỗi khi reset bài thi', 'danger');
            }
          }} className="btn-warning">
            <i className="fas fa-undo me-2"></i>
            Xác nhận reset
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Unban Confirmation Modal */}
      <Modal show={showUnbanConfirmModal} onHide={() => {
        setShowUnbanConfirmModal(false);
        setAttemptForUnban(null);
      }} className="student-detail-modal">
        <Modal.Header closeButton className="student-detail-header">
          <Modal.Title className="student-detail-title">
            <div className="student-avatar">
              <i className="fas fa-check-circle"></i>
            </div>
            <div>
              <h4 className="mb-0">Xác nhận thu hồi cấm thi</h4>
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="student-detail-body">
          {attemptForUnban && (
            <div className="student-detail-container">
              <Alert variant="success" className="mb-4">
                <div className="d-flex align-items-center">
                  <i className="fas fa-check-circle fa-2x me-3"></i>
                  <div>
                    <strong>Bạn có chắc chắn muốn thu hồi cấm thi cho sinh viên này?</strong>
                    <p className="mb-0 mt-2">Sinh viên sẽ có thể tiếp tục làm bài thi.</p>
                  </div>
                </div>
              </Alert>

              <div className="session-card">
                <div className="card-header-modern mb-3">
                  <div className="header-icon">
                    <i className="fas fa-user"></i>
                  </div>
                  <h6 className="mb-0">Thông tin sinh viên</h6>
                </div>
                <div className="card-body-modern">
                  <div className="info-item">
                    <div className="info-label">
                      <i className="fas fa-user me-2"></i>
                      <span>Họ và tên:</span>
                    </div>
                    <div className="info-value">
                      <strong>{attemptForUnban.student_name}</strong>
                    </div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">
                      <i className="fas fa-id-card me-2"></i>
                      <span>Mã sinh viên:</span>
                    </div>
                    <div className="info-value">
                      {attemptForUnban.student_id}
                    </div>
                  </div>
                  <div className="info-item">
                    <div className="info-label">
                      <i className="fas fa-ban me-2"></i>
                      <span>Trạng thái:</span>
                    </div>
                    <div className="info-value">
                      <Badge bg="danger">Đã bị cấm thi</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="student-detail-footer">
          <Button variant="outline-secondary" onClick={() => {
            setShowUnbanConfirmModal(false);
            setAttemptForUnban(null);
          }} className="btn-cancel">
            <i className="fas fa-times me-2"></i>
            Hủy
          </Button>
          <Button variant="success" onClick={async () => {
            if (!attemptForUnban) return;
            
            try {
              await refreshCSRFToken();
              const response = await api.put(`/lms/attempts/${attemptForUnban.attempt_id}/unban`);
              if (response.data.success) {
                showAlertMessage(`Đã thu hồi cấm thi cho sinh viên ${attemptForUnban.student_name} thành công`, 'success');
                setShowUnbanConfirmModal(false);
                setAttemptForUnban(null);
                fetchMonitoringData(); // Refresh data
              }
            } catch (error) {
              console.error('Error unbanning attempt:', error);
              showAlertMessage(error.response?.data?.message || 'Lỗi khi thu hồi cấm thi', 'danger');
            }
          }} className="btn-success">
            <i className="fas fa-check-circle me-2"></i>
            Xác nhận thu hồi cấm
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Exam Regulation Modal */}
      <Modal 
        show={showRegulationModal} 
        onHide={() => setShowRegulationModal(false)} 
        size="xl"
        className="student-detail-modal"
        centered
      >
        <Modal.Header closeButton className="student-detail-header">
          <Modal.Title className="student-detail-title">
            <div className="student-avatar">
              <i className="fas fa-gavel"></i>
            </div>
            <div>
              <h4 className="mb-0">Quản lý Quy chế thi</h4>
              <p className="mb-0 student-subtitle">Tạo và quản lý quy chế thi cho sinh viên</p>
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="student-detail-body">
          <div className="student-detail-container">
            <Tabs
              activeKey={regulationModalTab}
              onSelect={(k) => {
                setRegulationModalTab(k);
                if (k === 'confirmations' && regulationId) {
                  fetchConfirmations(1);
                  fetchConfirmationFilterOptions();
                }
              }}
              className="mb-3"
              fill
              variant="pills"
            >
              {/* Basic Information Tab */}
              <Tab eventKey="basic" title={
                <span>
                  <i className="fas fa-info-circle me-2"></i>
                  Thông tin cơ bản
                </span>
              }>
                <div className="p-3">
                  <Form>
                    <div className="session-card mb-4">
                      <div className="card-header-modern">
                        <div className="header-icon">
                          <i className="fas fa-info-circle"></i>
                        </div>
                        <h6 className="mb-0">Thông tin cơ bản</h6>
                      </div>
                      <div className="card-body-modern">
                        <Form.Group className="mb-3">
                          <Form.Label className="info-label">
                            <i className="fas fa-heading me-2"></i>
                            Tiêu đề <span className="text-danger">*</span>
                          </Form.Label>
                          <Form.Control
                            type="text"
                            value={regulationForm.title}
                            onChange={(e) => setRegulationForm({ ...regulationForm, title: e.target.value })}
                            placeholder="Nhập tiêu đề quy chế thi..."
                            className="form-control-modern"
                          />
                        </Form.Group>

                        <Form.Group className="mb-3">
                          <Form.Label className="info-label">
                            <i className="fas fa-align-left me-2"></i>
                            Mô tả <span className="text-danger">*</span>
                          </Form.Label>
                          <RichTextEditor
                            value={regulationForm.description}
                            onChange={(value) => setRegulationForm({ ...regulationForm, description: value })}
                            placeholder="Nhập mô tả quy chế thi..."
                          />
                        </Form.Group>
                      </div>
                    </div>
                  </Form>
                </div>
              </Tab>

              {/* Settings Tab */}
              <Tab eventKey="settings" title={
                <span>
                  <i className="fas fa-cog me-2"></i>
                  Cài đặt
                </span>
              }>
                <div className="p-3">
                  <Form>
                    {/* Display Settings Card */}
                    <div className="session-card mb-4">
                      <div className="card-header-modern">
                        <div className="header-icon">
                          <i className="fas fa-calendar-alt"></i>
                        </div>
                        <h6 className="mb-0">Thời gian hiển thị</h6>
                      </div>
                      <div className="card-body-modern">
                        <Row>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label className="info-label">
                                <i className="fas fa-play-circle me-2"></i>
                                Thời gian bắt đầu hiển thị
                              </Form.Label>
                              <Form.Control
                                type="datetime-local"
                                value={regulationForm.display_from}
                                onChange={(e) => setRegulationForm({ ...regulationForm, display_from: e.target.value })}
                                className="form-control-modern"
                              />
                              <Form.Text className="text-muted" style={{ fontSize: '12px' }}>
                                Để trống nếu muốn hiển thị ngay lập tức
                              </Form.Text>
                            </Form.Group>
                          </Col>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label className="info-label">
                                <i className="fas fa-stop-circle me-2"></i>
                                Thời gian kết thúc hiển thị
                              </Form.Label>
                              <Form.Control
                                type="datetime-local"
                                value={regulationForm.display_until}
                                onChange={(e) => setRegulationForm({ ...regulationForm, display_until: e.target.value })}
                                className="form-control-modern"
                              />
                              <Form.Text className="text-muted" style={{ fontSize: '12px' }}>
                                Để trống nếu muốn hiển thị vô thời hạn
                              </Form.Text>
                            </Form.Group>
                          </Col>
                        </Row>
                      </div>
                    </div>

                    {/* Reading Settings Card */}
                    <div className="session-card mb-4">
                      <div className="card-header-modern">
                        <div className="header-icon">
                          <i className="fas fa-clock"></i>
                        </div>
                        <h6 className="mb-0">Cài đặt đọc</h6>
                      </div>
                      <div className="card-body-modern">
                        <Row>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label className="info-label">
                                <i className="fas fa-hourglass-half me-2"></i>
                                Thời gian đọc tối thiểu (giây)
                              </Form.Label>
                              <Form.Control
                                type="number"
                                min="0"
                                value={regulationForm.reading_time_seconds}
                                onChange={(e) => setRegulationForm({ ...regulationForm, reading_time_seconds: parseInt(e.target.value) || 30 })}
                                className="form-control-modern"
                              />
                              <Form.Text className="text-muted" style={{ fontSize: '12px' }}>
                                Sinh viên phải đọc ít nhất số giây này trước khi có thể xác nhận
                              </Form.Text>
                            </Form.Group>
                          </Col>
                          <Col md={6}>
                            <Form.Group className="mb-3">
                              <Form.Label className="info-label">
                                <i className="fas fa-toggle-on me-2"></i>
                                Trạng thái
                              </Form.Label>
                              <div className="mt-2">
                                <Form.Check
                                  type="switch"
                                  id="is-active-switch"
                                  label="Bật quy chế thi"
                                  checked={regulationForm.is_active}
                                  onChange={(e) => setRegulationForm({ ...regulationForm, is_active: e.target.checked })}
                                />
                                <Form.Text className="text-muted" style={{ fontSize: '12px', display: 'block', marginTop: '8px' }}>
                                  Khi bật, quy chế thi sẽ hiển thị cho tất cả sinh viên
                                </Form.Text>
                              </div>
                            </Form.Group>
                          </Col>
                        </Row>
                        <Row>
                          <Col md={12}>
                            <Form.Group className="mb-3">
                              <Form.Label className="info-label">
                                <i className="fas fa-repeat me-2"></i>
                                Cài đặt đọc quy chế
                              </Form.Label>
                              <div className="mt-2">
                                <Form.Check
                                  type="switch"
                                  id="require-read-each-time-switch"
                                  label="Yêu cầu đọc quy chế mỗi lần vào thi"
                                  checked={regulationForm.require_read_each_time}
                                  onChange={(e) => setRegulationForm({ ...regulationForm, require_read_each_time: e.target.checked })}
                                />
                                <Form.Text className="text-muted" style={{ fontSize: '12px', display: 'block', marginTop: '8px' }}>
                                  {regulationForm.require_read_each_time 
                                    ? 'Sinh viên phải đọc và xác nhận quy chế mỗi lần vào trang thi. Mỗi lần xác nhận sẽ được ghi lại vào lịch sử.'
                                    : 'Sinh viên chỉ cần đọc và xác nhận quy chế một lần. Sau khi xác nhận, lần sau vào thi sẽ không cần đọc lại.'}
                                </Form.Text>
                              </div>
                            </Form.Group>
                          </Col>
                        </Row>
                      </div>
                    </div>
                  </Form>
                </div>
              </Tab>

              <Tab eventKey="confirmations" title={
                <span>
                  <i className="fas fa-users-check me-2"></i>
                  Người đã xác nhận
                  {confirmationsPagination.total > 0 && (
                    <Badge bg="primary" className="ms-2">{confirmationsPagination.total}</Badge>
                  )}
                </span>
              }>
                <div className="p-3">
                  {!regulationId ? (
                    <Alert variant="info">
                      <i className="fas fa-info-circle me-2"></i>
                      Vui lòng lưu quy chế thi trước khi xem danh sách xác nhận.
                    </Alert>
                  ) : (
                    <>
                      {/* Filters - Similar to QuestionBank.js */}
                      <div className="session-list-controls mb-3">
                        <div className="search-controls">
                          <div className="search-input" style={{ minWidth: '300px', flex: '1' }}>
                            <input
                              type="text"
                              placeholder="Tìm kiếm theo tên, mã sinh viên, email..."
                              value={confirmationsSearch}
                              onChange={(e) => setConfirmationsSearch(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  fetchConfirmations(1);
                                }
                              }}
                              style={{ width: '100%' }}
                            />
                          </div>

                          <select
                            className="filter-select"
                            value={confirmationsClassFilter}
                            onChange={(e) => {
                              setConfirmationsClassFilter(e.target.value);
                              fetchConfirmations(1);
                            }}
                          >
                            <option value="">Tất cả lớp</option>
                            {confirmationClasses.map((className) => (
                              <option key={className} value={className}>
                                {className}
                              </option>
                            ))}
                          </select>

                          <select
                            className="filter-select"
                            value={confirmationsGroupFilter}
                            onChange={(e) => {
                              setConfirmationsGroupFilter(e.target.value);
                              fetchConfirmations(1);
                            }}
                          >
                            <option value="">Tất cả nhóm</option>
                            {confirmationGroups.map((group) => (
                              <option key={group.id} value={group.id}>
                                {group.group_name} ({group.student_count || 0})
                              </option>
                            ))}
                          </select>

                          <Button variant="outline-info" onClick={() => fetchConfirmations(1)}>
                            <i className="fas fa-search me-2"></i>
                            Tìm kiếm
                          </Button>
                        </div>
                      </div>

                      {loadingConfirmations ? (
                        <div className="text-center py-5">
                          <Spinner animation="border" variant="primary" />
                          <p className="mt-2">Đang tải...</p>
                        </div>
                      ) : confirmations.length === 0 ? (
                        <Alert variant="info">
                          <i className="fas fa-info-circle me-2"></i>
                          Chưa có ai xác nhận quy chế thi.
                        </Alert>
                      ) : (
                        <>
                          <div className="session-table-container">
                            <div className="table-responsive-mobile">
                              <table className="session-table">
                                <thead>
                                  <tr>
                                    <th style={{ width: '50px' }}>STT</th>
                                    <th>Mã sinh viên</th>
                                    <th>Họ và tên</th>
                                    <th>Email</th>
                                    <th>Lớp</th>
                                    <th>Thời gian bắt đầu đọc</th>
                                    <th>Thời gian xác nhận</th>
                                    <th>Trạng thái</th>
                                    <th style={{ width: '100px' }}>Hành động</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {confirmations.map((confirmation, index) => {
                                    const startTime = confirmation.reading_start_time 
                                      ? new Date(confirmation.reading_start_time).toLocaleString('vi-VN')
                                      : '-';
                                    const confirmTime = confirmation.confirmed_at
                                      ? new Date(confirmation.confirmed_at).toLocaleString('vi-VN')
                                      : '-';
                                    
                                    return (
                                      <tr key={confirmation.confirmation_id}>
                                        <td>{(confirmationsPagination.page - 1) * confirmationsPagination.limit + index + 1}</td>
                                        <td>
                                          <span className="badge bg-secondary">{confirmation.student_id || '-'}</span>
                                        </td>
                                        <td className="session-title-cell">{confirmation.full_name || '-'}</td>
                                        <td>{confirmation.email || '-'}</td>
                                        <td>
                                          <span className="badge bg-info">{confirmation.class_name || '-'}</span>
                                        </td>
                                        <td>{startTime}</td>
                                        <td>{confirmTime}</td>
                                        <td>
                                          {confirmation.is_confirmed === 1 || confirmation.is_confirmed === true ? (
                                            <Badge bg="success">
                                              <i className="fas fa-check-circle me-1"></i>
                                              Đã xác nhận
                                            </Badge>
                                          ) : (
                                            <Badge bg="warning">
                                              <i className="fas fa-clock me-1"></i>
                                              Đang đọc và chưa xác nhận
                                            </Badge>
                                          )}
                                        </td>
                                        <td>
                                          <div className="action-buttons">
                                            <Button
                                              size="sm"
                                              variant="outline-danger"
                                              onClick={() => handleDeleteConfirmation(confirmation)}
                                              title="Xóa"
                                            >
                                              <i className="fas fa-trash"></i>
                                            </Button>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {confirmationsPagination.totalPages > 1 && (
                            <div className="mt-3">
                              <Pagination
                                currentPage={confirmationsPagination.page}
                                totalPages={confirmationsPagination.totalPages}
                                onPageChange={(page) => fetchConfirmations(page)}
                                maxVisiblePages={5}
                                showFirstLast={true}
                              />
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              </Tab>
            </Tabs>
          </div>
        </Modal.Body>
        <Modal.Footer className="student-detail-footer">
          <Button 
            variant="outline-secondary" 
            onClick={() => setShowRegulationModal(false)}
            className="btn-cancel"
          >
            <i className="fas fa-times me-2"></i>
            Đóng
          </Button>
          {(regulationModalTab === 'basic' || regulationModalTab === 'settings') && (
            <Button 
              variant="primary" 
              onClick={async () => {
                await handleSaveRegulation();
                if (regulationId) {
                  fetchConfirmations(1);
                }
              }}
              disabled={loadingRegulation || !regulationForm.title || !regulationForm.description}
              className="btn-primary"
            >
              {loadingRegulation ? (
                <>
                  <Spinner size="sm" animation="border" className="me-2" />
                  Đang lưu...
                </>
              ) : (
                <>
                  <i className="fas fa-save me-2"></i>
                  Lưu
                </>
              )}
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Exams;


