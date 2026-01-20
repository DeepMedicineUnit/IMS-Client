import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Form, Tab, Tabs, Alert, Badge, Accordion, InputGroup, Table, ProgressBar, Row, Col } from 'react-bootstrap';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import api from '../../utils/api';
import Pagination from '../../components/Pagination';
import usePageTitle from '../../hooks/usePageTitle';
import '../../styles/user.css';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend);

const QuestionBank = () => {
  usePageTitle('Ngân hàng câu hỏi');
  const { currentUser } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [topics, setTopics] = useState([]);
  const [topicsWithStats, setTopicsWithStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [showTopicManagementModal, setShowTopicManagementModal] = useState(false);
  const [showTopicQuestionsModal, setShowTopicQuestionsModal] = useState(false);
  const [showDeleteTopicConfirmModal, setShowDeleteTopicConfirmModal] = useState(false);
  const [showApproveAllModal, setShowApproveAllModal] = useState(false);
  const [showRejectAllModal, setShowRejectAllModal] = useState(false);
  const [rejectAllReason, setRejectAllReason] = useState('');
  const [showApproveQuestionModal, setShowApproveQuestionModal] = useState(false);
  const [showRejectQuestionModal, setShowRejectQuestionModal] = useState(false);
  const [questionToApprove, setQuestionToApprove] = useState(null);
  const [questionToReject, setQuestionToReject] = useState(null);
  const [rejectQuestionReason, setRejectQuestionReason] = useState('');
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [selectedTopicForView, setSelectedTopicForView] = useState(null);
  const [selectedTopicForDelete, setSelectedTopicForDelete] = useState(null);
  const [topicQuestions, setTopicQuestions] = useState([]);
  const [topicQuestionsForDelete, setTopicQuestionsForDelete] = useState([]);
  const [loadingTopicQuestions, setLoadingTopicQuestions] = useState(false);
  const [loadingTopicQuestionsForDelete, setLoadingTopicQuestionsForDelete] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editTopicMode, setEditTopicMode] = useState(false);
  const { showAlert } = useAlert();

  // Filters
  const [filters, setFilters] = useState({
    search: '',
    topic_id: '',
    question_type: '',
    difficulty: '',
    bloom_level: '',
    status: ''
  });

  // Topic filters (for Mod role)
  const [topicFilters, setTopicFilters] = useState({
    search: '',
    created_by: '',
    status: ''
  });

  // Form data
  const [questionForm, setQuestionForm] = useState({
    topic_id: '',
    question_text: '',
    question_type: 'mcq',
    difficulty: 'medium',
    bloom_level: 'understand',
    explanation: '',
    points: 1,
    options: [
      { option_text: '', is_correct: false },
      { option_text: '', is_correct: false },
      { option_text: '', is_correct: false },
      { option_text: '', is_correct: false }
    ],
    clo_tags: '',
    plo_tags: ''
  });

  const [topicForm, setTopicForm] = useState({
    topic_code: '',
    topic_name: '',
    description: ''
  });
  const [topicCodeManuallyEdited, setTopicCodeManuallyEdited] = useState(false);

  const [importFile, setImportFile] = useState(null);
  const [importFormat, setImportFormat] = useState('excel');
  const [pageSize, setPageSize] = useState(100);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    totalItems: 0,
    totalPages: 0
  });
  
  // Export modal state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState('excel');
  const [exportFilters, setExportFilters] = useState({
    topic_id: '',
    question_type: '',
    difficulty: '',
    bloom_level: '',
    points_min: '',
    points_max: ''
  });
  
  // Import template options
  const [showImportModal, setShowImportModal] = useState(false);
  const [importTemplateOptions, setImportTemplateOptions] = useState({
    topic_id: '',
    topic_name: '', // For Staff role - topic name input
    question_type: '',
    include_topic: true,
    include_type: true,
    include_difficulty: true,
    include_bloom: false,
    include_clo_plo: false,
    include_points: true
  });
  const [topicNameExists, setTopicNameExists] = useState(false);
  const [checkingTopicName, setCheckingTopicName] = useState(false);
  
  // Import workflow states
  const [showImportProgressModal, setShowImportProgressModal] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, message: '' });
  const [previewedQuestions, setPreviewedQuestions] = useState([]);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState(null);
  const [editingQuestion, setEditingQuestion] = useState(null);
  
  // Question conditions state
  const [questionConditions, setQuestionConditions] = useState(null);
  const [conditionsMet, setConditionsMet] = useState(true);
  const [conditionsStatus, setConditionsStatus] = useState(null);

  // Bulk edit state
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [bulkPoints, setBulkPoints] = useState(1);
  const [lastClickedIndex, setLastClickedIndex] = useState(null); // For Shift-Click selection
  const [bulkEditFilters, setBulkEditFilters] = useState({
    enableTypeFilter: false,
    selectedTypes: ['mcq', 'multiple_response', 'true_false', 'short_answer', 'essay'],
    enableDifficultyFilter: false,
    selectedDifficulties: ['easy', 'medium', 'hard', 'expert'],
    enableBloomFilter: false,
    selectedBlooms: ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']
  });

  // Question text visibility states (similar to Payroll.js)
  const [revealedQuestions, setRevealedQuestions] = useState(new Set());
  const [revealedColumn, setRevealedColumn] = useState(false);

  // Answer statistics state
  const [answerStatistics, setAnswerStatistics] = useState({});

  // Sorting state
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'

  // Handle column sorting
  const handleSort = (column) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to asc
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Get sort icon for column header
  const getSortIcon = (column) => {
    if (sortColumn !== column) {
      return <i className="fas fa-sort text-muted ms-2" style={{ fontSize: '12px', opacity: 0.5 }}></i>;
    }
    if (sortDirection === 'asc') {
      return <i className="fas fa-sort-up text-primary ms-2" style={{ fontSize: '12px' }}></i>;
    }
    return <i className="fas fa-sort-down text-primary ms-2" style={{ fontSize: '12px' }}></i>;
  };

  // Toggle question text visibility for a specific question
  const toggleQuestionTextVisibility = (questionId, e) => {
    e.stopPropagation(); // Prevent row click
    setRevealedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  // Toggle column visibility (all questions in the column)
  const toggleColumnVisibility = (e) => {
    e.stopPropagation();
    setRevealedColumn(prev => !prev);
  };

  // Check if question text is revealed (priority: column > individual question)
  const isQuestionTextRevealed = (questionId) => {
    // If column is revealed, all questions are revealed (highest priority)
    if (revealedColumn) {
      return true;
    }
    // Otherwise check individual question
    return revealedQuestions.has(questionId);
  };

  // Points for each category
  const [categoryPoints, setCategoryPoints] = useState({
    types: {
      mcq: 1,
      multiple_response: 1,
      true_false: 1,
      short_answer: 1,
      essay: 2
    },
    difficulties: {
      easy: 1,
      medium: 1.5,
      hard: 2,
      expert: 3
    },
    blooms: {
      remember: 1,
      understand: 1,
      apply: 1.5,
      analyze: 2,
      evaluate: 2.5,
      create: 3
    }
  });

  // Check if user has permission to access question bank (lms_qa, lms_mod, lms_staff)
  // Note: lms_admin is NOT allowed
  const hasLMSQAPermission = () => {
    if (!currentUser) return false;
    const moduleRoles = currentUser.module_roles || [];
    if (!Array.isArray(moduleRoles)) return false;
    return moduleRoles.includes('lms_qa') || moduleRoles.includes('lms_mod') || moduleRoles.includes('lms_staff');
  };

  // Helper functions to check specific roles
  const isLMSQA = () => {
    if (!currentUser) return false;
    const moduleRoles = currentUser.module_roles || [];
    if (!Array.isArray(moduleRoles)) return false;
    return moduleRoles.includes('lms_qa');
  };

  const isLMSMod = () => {
    if (!currentUser) return false;
    const moduleRoles = currentUser.module_roles || [];
    if (!Array.isArray(moduleRoles)) return false;
    return moduleRoles.includes('lms_mod');
  };

  const isLMSStaff = () => {
    if (!currentUser) return false;
    const moduleRoles = currentUser.module_roles || [];
    if (!Array.isArray(moduleRoles)) return false;
    return moduleRoles.includes('lms_staff');
  };

  // Check if user should see topic list view (Staff or Mod)
  const shouldShowTopicListView = () => {
    return isLMSStaff() || isLMSMod();
  };

  useEffect(() => {
    if (hasLMSQAPermission()) {
      fetchTopics();
      // Fetch topics with stats for Staff/Mod
      if (shouldShowTopicListView()) {
        fetchTopicsWithStats();
      }
    }
  }, [currentUser]);

  // Fetch question conditions when opening import modal
  useEffect(() => {
    if (showImportModal && isLMSStaff()) {
      fetchQuestionConditions();
    }
  }, [showImportModal]);

  // Fetch question conditions
  const fetchQuestionConditions = async () => {
    try {
      const response = await api.get('/lms/questions/my-conditions');
      if (response.data.success) {
        setQuestionConditions(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching question conditions:', error);
      setQuestionConditions(null);
    }
  };

  // Check if conditions are met based on previewed questions
  const checkConditionsMet = (questions) => {
    if (!questionConditions || !isLMSStaff()) {
      return { met: true, status: null };
    }

    const status = {
      totalQuestions: { required: questionConditions.totalQuestions, current: questions.length, met: true },
      questionTypes: {},
      difficulties: {},
      bloomLevels: {}
    };

    const allowExceed = questionConditions.allowExceed === true || questionConditions.allowExceed === 1;

    // Check total questions
    if (questionConditions.totalQuestions !== null) {
      const totalRequired = parseInt(questionConditions.totalQuestions) || 0;
      const totalCurrent = questions.length;
      status.totalQuestions.met = totalCurrent >= totalRequired;
      status.totalQuestions.exceeded = !allowExceed && totalCurrent > totalRequired;
    }

    // Check question types
    if (questionConditions.questionTypes) {
      const typeCounts = {};
      questions.forEach(q => {
        const type = q.question_type || 'mcq';
        typeCounts[type] = (typeCounts[type] || 0) + 1;
      });

      Object.keys(questionConditions.questionTypes).forEach(type => {
        const required = parseInt(questionConditions.questionTypes[type]) || 0;
        const current = typeCounts[type] || 0;
        status.questionTypes[type] = {
          required,
          current,
          met: current >= required,
          exceeded: !allowExceed && current > required
        };
      });
    }

    // Check difficulties
    if (questionConditions.difficulties) {
      const difficultyCounts = {};
      questions.forEach(q => {
        const diff = q.difficulty_level || 'medium';
        difficultyCounts[diff] = (difficultyCounts[diff] || 0) + 1;
      });

      Object.keys(questionConditions.difficulties).forEach(diff => {
        const required = parseInt(questionConditions.difficulties[diff]) || 0;
        const current = difficultyCounts[diff] || 0;
        status.difficulties[diff] = {
          required,
          current,
          met: current >= required,
          exceeded: !allowExceed && current > required
        };
      });
    }

    // Check bloom levels
    if (questionConditions.bloomLevels) {
      const bloomCounts = {};
      questions.forEach(q => {
        const bloom = q.bloom_level || null;
        if (bloom) {
          bloomCounts[bloom] = (bloomCounts[bloom] || 0) + 1;
        }
      });

      Object.keys(questionConditions.bloomLevels).forEach(bloom => {
        const required = parseInt(questionConditions.bloomLevels[bloom]) || 0;
        const current = bloomCounts[bloom] || 0;
        status.bloomLevels[bloom] = {
          required,
          current,
          met: current >= required,
          exceeded: !allowExceed && current > required
        };
      });
    }

    // Check if all conditions are met (including exceeded check)
    let allMet = true;
    if (questionConditions.totalQuestions !== null) {
      if (!status.totalQuestions.met || status.totalQuestions.exceeded) {
        allMet = false;
      }
    }
    Object.values(status.questionTypes).forEach(type => {
      if (!type.met || type.exceeded) allMet = false;
    });
    Object.values(status.difficulties).forEach(diff => {
      if (!diff.met || diff.exceeded) allMet = false;
    });
    Object.values(status.bloomLevels).forEach(bloom => {
      if (!bloom.met || bloom.exceeded) allMet = false;
    });

    return { met: allMet, status };
  };

  // Check topic name exists when Staff enters topic name
  useEffect(() => {
    const checkTopicName = async () => {
      if (!isLMSStaff() || !importTemplateOptions.topic_name?.trim()) {
        setTopicNameExists(false);
        return;
      }

      // Debounce: wait 800ms after user stops typing to avoid interrupting typing
      const timeoutId = setTimeout(async () => {
        setCheckingTopicName(true);
        try {
          const response = await api.get('/lms/question-topics/check-name', {
            params: { topic_name: importTemplateOptions.topic_name.trim() }
          });
          setTopicNameExists(response.data.exists || false);
        } catch (error) {
          console.error('Error checking topic name:', error);
          setTopicNameExists(false);
        } finally {
          setCheckingTopicName(false);
        }
      }, 800);

      return () => clearTimeout(timeoutId);
    };

    checkTopicName();
  }, [importTemplateOptions.topic_name, isLMSStaff]);

  // Fetch answer statistics for questions
  const fetchAnswerStatistics = async (questionIds) => {
    if (!questionIds || questionIds.length === 0) return;
    
    try {
      const response = await api.get('/lms/questions/answer-statistics', {
        params: { question_ids: questionIds.join(',') }
      });
      
      if (response.data?.success && response.data?.data) {
        setAnswerStatistics(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching answer statistics:', error);
      // Don't show alert, just log error silently
    }
  };

  // Initial fetch
  useEffect(() => {
    if (hasLMSQAPermission()) {
      fetchQuestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search, filters.topic_id, filters.bloom_level, currentUser]);

  // Background polling for questions - only update if data changed
  useEffect(() => {
    if (!hasLMSQAPermission()) return;
    
    let pollInterval;
    let isMounted = true;
    let currentPolling = false; // Prevent concurrent requests
    
    const pollQuestions = async () => {
      if (currentPolling || !isMounted) return;
      
      try {
        currentPolling = true;
        const params = new URLSearchParams();
        
        // Chỉ gửi search và topic_id lên API (các filter khác sẽ xử lý ở client-side)
        if (filters.search) params.append('search', filters.search);
        if (filters.topic_id) params.append('topic_id', filters.topic_id);
        if (filters.bloom_level) params.append('bloom_level', filters.bloom_level);
        
        // Gửi limit lớn để lấy tất cả câu hỏi
        params.append('limit', '10000');
        params.append('page', '1');

        const response = await api.get(`/lms/questions?${params.toString()}`);
        const questionsData = response.data?.data;
        
        let newQuestions = [];
        if (Array.isArray(questionsData)) {
          newQuestions = questionsData;
        } else if (questionsData && Array.isArray(questionsData.questions)) {
          newQuestions = questionsData.questions;
        }
        
        if (!isMounted) return;
        
        // Compare with current data - only update if changed
        setQuestions(currentQuestions => {
          if (hasQuestionsDataChanged(currentQuestions, newQuestions)) {
            // Fetch answer statistics for QA role when questions change
            if (isLMSQA() && newQuestions.length > 0) {
              fetchAnswerStatistics(newQuestions.map(q => q.question_id));
            }
            return newQuestions;
          }
          return currentQuestions; // No changes, keep current data
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
        pollInterval = setInterval(pollQuestions, 5000); // Poll every 5 seconds
      }
    }, 5000);
    
    return () => {
      isMounted = false;
      clearTimeout(initialDelay);
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [filters.search, filters.topic_id, filters.bloom_level, currentUser]);

  // Background polling for topics - only update if data changed
  useEffect(() => {
    if (!hasLMSQAPermission()) return;
    
    let pollInterval;
    let isMounted = true;
    let currentPolling = false;
    
    const pollTopics = async () => {
      if (currentPolling || !isMounted) return;
      
      try {
        currentPolling = true;
        const response = await api.get('/lms/question-topics');
        const topicsData = response.data?.data;
        
        let newTopics = [];
        if (Array.isArray(topicsData)) {
          newTopics = topicsData;
        } else if (topicsData && Array.isArray(topicsData.topics)) {
          newTopics = topicsData.topics;
        }
        
        if (!isMounted) return;
        
        // Compare with current data - only update if changed
        setTopics(currentTopics => {
          if (hasTopicsDataChanged(currentTopics, newTopics)) {
            return newTopics;
          }
          return currentTopics; // No changes, keep current data
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
        pollInterval = setInterval(pollTopics, 5000); // Poll every 5 seconds
      }
    }, 5000);
    
    return () => {
      isMounted = false;
      clearTimeout(initialDelay);
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [currentUser]);

  // Background polling for topics with statistics (for Staff and Mod) - only update if data changed
  useEffect(() => {
    // Only for Staff and Mod, not QA (QA uses regular topics polling)
    if (!isLMSStaff() && !isLMSMod()) return;
    if (isLMSQA()) return; // QA uses regular topics polling
    
    let pollInterval;
    let isMounted = true;
    let currentPolling = false;
    
    const pollTopicsWithStats = async () => {
      if (currentPolling || !isMounted) return;
      
      try {
        currentPolling = true;
        const response = await api.get('/lms/question-topics?with_statistics=true');
        const topicsData = response.data?.data || [];
        
        if (!isMounted) return;
        
        // Compare with current data - only update if changed
        setTopicsWithStats(currentTopics => {
          if (hasTopicsWithStatsDataChanged(currentTopics, topicsData)) {
            // Sort topics: pending topics first, then others
            const sortedTopics = [...topicsData].sort((a, b) => {
              const aPending = (a.pending_count || 0) > 0;
              const bPending = (b.pending_count || 0) > 0;
              
              // Topics with pending questions come first
              if (aPending && !bPending) return -1;
              if (!aPending && bPending) return 1;
              
              // If both have same status, sort by topic_code
              return (a.topic_code || '').localeCompare(b.topic_code || '');
            });
            
            return sortedTopics;
          }
          return currentTopics; // No changes, keep current data
        });
      } catch (error) {
        // Silently fail in background polling
        console.debug('Background topics with stats polling error (silent):', error);
      } finally {
        currentPolling = false;
      }
    };
    
    // Start polling after initial load (5 seconds delay)
    const initialDelay = setTimeout(() => {
      if (isMounted) {
        pollInterval = setInterval(pollTopicsWithStats, 5000); // Poll every 5 seconds
      }
    }, 5000);
    
    return () => {
      isMounted = false;
      clearTimeout(initialDelay);
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [currentUser]);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      // Chỉ gửi search và topic_id lên API (các filter khác sẽ xử lý ở client-side)
      if (filters.search) params.append('search', filters.search);
      if (filters.topic_id) params.append('topic_id', filters.topic_id);
      if (filters.bloom_level) params.append('bloom_level', filters.bloom_level);
      
      // Gửi limit lớn để lấy tất cả câu hỏi (hoặc ít nhất là 10000 để đảm bảo lấy đủ)
      // API mặc định chỉ trả về 50, nên cần gửi limit lớn
      params.append('limit', '10000');
      params.append('page', '1');

      const response = await api.get(`/lms/questions?${params.toString()}`);
      
      const questionsData = response.data?.data;
      let questionsList = [];
      
      if (Array.isArray(questionsData)) {
        questionsList = questionsData;
      } else if (questionsData && Array.isArray(questionsData.questions)) {
        questionsList = questionsData.questions;
      }
      
      // Debug: Log số lượng câu hỏi nhận được
      console.log('Questions received from API:', questionsList.length);
      
      setQuestions(questionsList);
      
      // Fetch answer statistics for QA role
      if (isLMSQA() && questionsList.length > 0) {
        fetchAnswerStatistics(questionsList.map(q => q.question_id));
      }
    } catch (error) {
      console.error('Error fetching questions:', error);
      if (error.response?.status === 403) {
        showAlertMessage('Bạn không có quyền truy cập dữ liệu này. Chỉ quyền Khảo thí & Đảm bảo chất lượng mới có quyền.', 'danger');
      } else {
        showAlertMessage('Lỗi khi tải danh sách câu hỏi', 'danger');
      }
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTopicQuestions = async (topicId) => {
    try {
      setLoadingTopicQuestions(true);
      const response = await api.get(`/lms/questions?topic_id=${topicId}&limit=999999&page=1`);
      const questionsData = response.data?.data;
      let questionsList = [];
      
      if (Array.isArray(questionsData)) {
        questionsList = questionsData;
      } else if (questionsData && Array.isArray(questionsData.questions)) {
        questionsList = questionsData.questions;
      }
      
      // Sort: Questions with "pending" status first, then others
      questionsList.sort((a, b) => {
        const aIsPending = a.approval_status === 'pending';
        const bIsPending = b.approval_status === 'pending';
        
        if (aIsPending && !bIsPending) return -1; // a comes first
        if (!aIsPending && bIsPending) return 1;  // b comes first
        return 0; // Keep original order for others
      });
      
      setTopicQuestions(questionsList);
    } catch (error) {
      console.error('Error fetching topic questions:', error);
      showAlertMessage('Lỗi khi tải câu hỏi trong chủ đề', 'danger');
    } finally {
      setLoadingTopicQuestions(false);
    }
  };

  const handleViewTopicQuestions = async (topic) => {
    setSelectedTopicForView(topic);
    setShowTopicQuestionsModal(true);
    await fetchTopicQuestions(topic.topic_id);
  };

  const fetchTopics = async () => {
    try {
      const response = await api.get('/lms/question-topics');
      
      const topicsData = response.data?.data;
      if (Array.isArray(topicsData)) {
        setTopics(topicsData);
      } else if (topicsData && Array.isArray(topicsData.topics)) {
        setTopics(topicsData.topics);
      } else {
        setTopics([]);
      }
    } catch (error) {
      console.error('Error fetching topics:', error);
      setTopics([]);
    }
  };

  const handleCreateQuestion = () => {
    setEditMode(false);
    setQuestionForm({
      topic_id: '',
      question_text: '',
      question_type: 'mcq',
      difficulty: 'medium',
      bloom_level: 'understand',
      explanation: '',
      points: 1,
      options: [
        { option_text: '', is_correct: false },
        { option_text: '', is_correct: false },
        { option_text: '', is_correct: false },
        { option_text: '', is_correct: false }
      ],
      clo_tags: '',
      plo_tags: ''
    });
    setShowQuestionModal(true);
  };

  const handleEditQuestion = async (question) => {
    setEditMode(true);
    setSelectedQuestion(question);

    try {
      const response = await api.get(`/lms/questions/${question.question_id}`);

      const fullQuestion = response.data.data;

      setQuestionForm({
        topic_id: fullQuestion.topic_id || '',
        question_text: fullQuestion.question_text || '',
        question_type: fullQuestion.question_type || 'mcq',
        difficulty: fullQuestion.difficulty_level || fullQuestion.difficulty || 'medium',
        bloom_level: fullQuestion.bloom_level || 'understand',
        explanation: fullQuestion.explanation || '',
        points: fullQuestion.points || 1,
        options: fullQuestion.options || [],
        clo_tags: fullQuestion.clo_tags || '',
        plo_tags: fullQuestion.plo_tags || ''
      });

      setShowQuestionModal(true);
    } catch (error) {
      console.error('Error fetching question details:', error);
      showAlertMessage('Lỗi khi tải chi tiết câu hỏi', 'danger');
    }
  };

  const handleSubmitQuestion = async (e) => {
    e.preventDefault();

    try {
      // Map difficulty to difficulty_level for server compatibility
      const submitData = {
        ...questionForm,
        difficulty_level: questionForm.difficulty || questionForm.difficulty_level || 'medium'
      };
      // Remove difficulty field if it exists to avoid confusion
      delete submitData.difficulty;

      if (editMode && selectedQuestion) {
        await api.put(`/lms/questions/${selectedQuestion.question_id}`, submitData);
        showAlertMessage('Cập nhật câu hỏi thành công. Câu hỏi đã được gửi lại để duyệt.', 'success');
        // Refresh topic questions if modal is open
        if (selectedTopicForView) {
          await fetchTopicQuestions(selectedTopicForView.topic_id);
        }
      } else {
        await api.post('/lms/questions', submitData);
        showAlertMessage('Tạo câu hỏi thành công', 'success');
      }

      setShowQuestionModal(false);
      setEditMode(false);
      setSelectedQuestion(null);
      fetchQuestions();
    } catch (error) {
      console.error('Error saving question:', error);
      showAlertMessage(error.response?.data?.message || 'Lỗi khi lưu câu hỏi', 'danger');
    }
  };

  const handleDeleteQuestion = async (questionId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa câu hỏi này?')) return;

    try {
      await api.delete(`/lms/questions/${questionId}`);

      showAlertMessage('Xóa câu hỏi thành công', 'success');
      fetchQuestions();
    } catch (error) {
      console.error('Error deleting question:', error);
      showAlertMessage(error.response?.data?.message || 'Lỗi khi xóa câu hỏi', 'danger');
    }
  };

  const handleAddOption = () => {
    setQuestionForm({
      ...questionForm,
      options: [...questionForm.options, { option_text: '', is_correct: false }]
    });
  };

  const handleRemoveOption = (index) => {
    const newOptions = questionForm.options.filter((_, i) => i !== index);
    setQuestionForm({ ...questionForm, options: newOptions });
  };

  const handleOptionChange = (index, field, value) => {
    const newOptions = [...questionForm.options];
    newOptions[index][field] = value;

    if (field === 'is_correct' && value && questionForm.question_type === 'mcq') {
      newOptions.forEach((opt, i) => {
        if (i !== index) opt.is_correct = false;
      });
    }

    setQuestionForm({ ...questionForm, options: newOptions });
  };

  const handleCreateTopic = async () => {
    setShowTopicManagementModal(true);
    await fetchTopicsWithStats();
  };

  const fetchTopicsWithStats = async () => {
    try {
      const response = await api.get('/lms/question-topics?with_statistics=true');
      if (response.data.success) {
        // Sort topics: pending topics first, then others
        const topics = response.data.data || [];
        const sortedTopics = topics.sort((a, b) => {
          const aPending = (a.pending_count || 0) > 0;
          const bPending = (b.pending_count || 0) > 0;
          
          // Topics with pending questions come first
          if (aPending && !bPending) return -1;
          if (!aPending && bPending) return 1;
          
          // If both have same status, sort by topic_code
          return (a.topic_code || '').localeCompare(b.topic_code || '');
        });
        
        setTopicsWithStats(sortedTopics);
      }
    } catch (error) {
      console.error('Error fetching topics with statistics:', error);
      showAlertMessage('Lỗi khi tải danh sách chủ đề', 'danger');
    }
  };

  const handleAddTopic = () => {
    setSelectedTopic(null);
    setEditTopicMode(false);
    setTopicForm({ topic_code: '', topic_name: '', description: '' });
    setTopicCodeManuallyEdited(false);
    setShowTopicModal(true);
  };

  const handleEditTopic = (topic) => {
    setSelectedTopic(topic);
    setEditTopicMode(true);
    setTopicForm({
      topic_code: topic.topic_code,
      topic_name: topic.topic_name,
      description: topic.description || ''
    });
    setShowTopicModal(true);
  };

  const handleDeleteTopic = async (topic) => {
    setSelectedTopicForDelete(topic);
    setTopicQuestionsForDelete([]);
    setLoadingTopicQuestionsForDelete(true);
    setShowDeleteTopicConfirmModal(true);

    try {
      // Fetch questions for this topic
      const response = await api.get(`/lms/question-topics/${topic.topic_id}/questions`);
      if (response.data?.success && response.data?.data?.questions) {
        setTopicQuestionsForDelete(response.data.data.questions);
      }
    } catch (error) {
      console.error('Error fetching topic questions:', error);
      showAlertMessage('Lỗi khi tải danh sách câu hỏi', 'danger');
    } finally {
      setLoadingTopicQuestionsForDelete(false);
    }
  };

  const confirmDeleteTopic = async () => {
    if (!selectedTopicForDelete) return;

    try {
      const response = await api.delete(`/lms/question-topics/${selectedTopicForDelete.topic_id}`);
      const deletedCount = response.data?.deletedQuestionsCount || 0;
      showAlertMessage(
        `Xóa chủ đề thành công${deletedCount > 0 ? ` và ${deletedCount} câu hỏi liên quan` : ''}`,
        'success'
      );
      setShowDeleteTopicConfirmModal(false);
      setSelectedTopicForDelete(null);
      setTopicQuestionsForDelete([]);
      await fetchTopicsWithStats();
      fetchTopics(); // Refresh topics in dropdown
    } catch (error) {
      console.error('Error deleting topic:', error);
      const errorMessage = error.response?.data?.message || 'Lỗi khi xóa chủ đề';
      showAlertMessage(errorMessage, 'danger');
    }
  };

  // Generate topic code from topic name
  const generateTopicCode = (topicName) => {
    if (!topicName || !topicName.trim()) return '';
    
    // Remove Vietnamese accents and convert to uppercase
    const removeAccents = (str) => {
      return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    };
    
    // Extract first letter of each word (only letters, ignore numbers and special chars)
    const words = removeAccents(topicName)
      .toUpperCase()
      .split(/[\s\-–—&]+/)
      .filter(word => word.length > 0 && /[A-Z]/.test(word[0]));
    
    // Get first letter of each word
    let prefix = words.map(word => {
      // Get first letter that is A-Z
      const firstLetter = word.match(/[A-Z]/);
      return firstLetter ? firstLetter[0] : '';
    }).filter(letter => letter).join('');
    
    // If no prefix generated, use default
    if (!prefix || prefix.length === 0) {
      prefix = 'TOPIC';
    }
    
    // Generate random number to fill remaining characters (total 12 chars)
    // Format: PREFIX_NUMBER (prefix + _ + number = 12 chars total)
    const prefixLength = prefix.length;
    const underscoreLength = 1;
    const numberLength = 12 - prefixLength - underscoreLength;
    
    // Generate random number with leading zeros if needed
    const maxNumber = Math.pow(10, numberLength) - 1;
    const randomNumber = Math.floor(Math.random() * maxNumber);
    const numberStr = randomNumber.toString().padStart(numberLength, '0');
    
    return `${prefix}_${numberStr}`;
  };

  const handleSubmitTopic = async (e) => {
    e.preventDefault();

    // Auto-generate topic_code if not provided
    let finalTopicCode = topicForm.topic_code;
    if (!finalTopicCode || finalTopicCode.trim() === '') {
      if (!topicForm.topic_name || !topicForm.topic_name.trim()) {
        showAlertMessage('Vui lòng nhập tên chủ đề', 'warning');
        return;
      }
      finalTopicCode = generateTopicCode(topicForm.topic_name);
    }

    // Client-side validation
    if (!finalTopicCode || !topicForm.topic_name) {
      showAlertMessage('Vui lòng nhập đầy đủ mã chủ đề và tên chủ đề', 'warning');
      return;
    }

    try {
      if (editTopicMode && selectedTopic) {
        await api.put(`/lms/question-topics/${selectedTopic.topic_id}`, topicForm);
        showAlertMessage('Cập nhật chủ đề thành công', 'success');
      } else {
        await api.post('/lms/question-topics', {
          ...topicForm,
          topic_code: finalTopicCode
        });
        showAlertMessage('Tạo chủ đề thành công', 'success');
      }
      
      setShowTopicModal(false);
      setTopicForm({ topic_code: '', topic_name: '', description: '' });
      setSelectedTopic(null);
      setEditTopicMode(false);
      setTopicCodeManuallyEdited(false);
      await fetchTopicsWithStats();
      fetchTopics();
    } catch (error) {
      console.error('Error saving topic:', error);
      const errorMessage = error.response?.data?.message || 'Lỗi khi lưu chủ đề';
      showAlertMessage(errorMessage, 'danger');
    }
  };

  const handleImportQuestions = async (e) => {
    e.preventDefault();

    if (!importFile) {
      showAlertMessage('Vui lòng chọn file để import', 'warning');
      return;
    }

    try {
      // Show progress modal
      setShowImportProgressModal(true);
      setImportProgress({ current: 0, total: 100, message: 'Đang đọc file...' });

      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('format', importFormat);
      
      // Gửi các giá trị từ form để áp dụng vào các câu hỏi được import
      if (isLMSStaff() && importTemplateOptions.topic_name?.trim()) {
        formData.append('topic_name', importTemplateOptions.topic_name.trim());
      } else if (importTemplateOptions.topic_id) {
        formData.append('topic_id', importTemplateOptions.topic_id);
      }
      
      if (importTemplateOptions.question_type) {
        formData.append('question_type', importTemplateOptions.question_type);
      }

      setImportProgress({ current: 30, total: 100, message: 'Đang parse file và phát hiện trùng lặp...' });

      // Call preview-import API
      const response = await api.post('/lms/questions/preview-import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setImportProgress({ 
            current: percentCompleted, 
            total: 100, 
            message: `Đang tải file... ${percentCompleted}%` 
          });
        }
      });

      setImportProgress({ current: 100, total: 100, message: 'Hoàn thành!' });

      // Wait a bit to show completion
      setTimeout(() => {
        setShowImportProgressModal(false);
        
        // Show preview modal with questions
        const questions = response.data.data.questions || [];
        setPreviewedQuestions(questions);
        
        // Check conditions
        if (isLMSStaff() && questionConditions) {
          const checkResult = checkConditionsMet(questions);
          setConditionsMet(checkResult.met);
          setConditionsStatus(checkResult.status);
        } else {
          setConditionsMet(true);
          setConditionsStatus(null);
        }
        
        setShowPreviewModal(true);
        setShowImportModal(false);
        setImportFile(null);
      }, 500);

    } catch (error) {
      console.error('Error previewing import:', error);
      setShowImportProgressModal(false);
      showAlertMessage(error.response?.data?.message || 'Lỗi khi import câu hỏi', 'danger');
    }
  };

  const handleDeletePreviewQuestion = (index) => {
    setPreviewedQuestions(prev => {
      const updated = prev.filter((_, i) => i !== index);
      
      // Re-check conditions after deleting
      if (isLMSStaff() && questionConditions) {
        const checkResult = checkConditionsMet(updated);
        setConditionsMet(checkResult.met);
        setConditionsStatus(checkResult.status);
      }
      
      return updated;
    });
  };

  const handleEditPreviewQuestion = (index) => {
    setEditingQuestionIndex(index);
    setEditingQuestion({ ...previewedQuestions[index] });
  };

  const handleSaveEditedQuestion = () => {
    if (editingQuestionIndex !== null && editingQuestion) {
      setPreviewedQuestions(prev => {
        const updated = [...prev];
        updated[editingQuestionIndex] = editingQuestion;
        
        // Re-check conditions after editing
        if (isLMSStaff() && questionConditions) {
          const checkResult = checkConditionsMet(updated);
          setConditionsMet(checkResult.met);
          setConditionsStatus(checkResult.status);
        }
        
        return updated;
      });
      setEditingQuestionIndex(null);
      setEditingQuestion(null);
    }
  };

  const handleApproveQuestion = (questionId) => {
    // Try to find question in topicQuestions first (for modal view), then in questions array (for main list)
    const question = topicQuestions.find(q => q.question_id === questionId) || 
                     questions.find(q => q.question_id === questionId);
    if (question) {
      setQuestionToApprove(question);
      setShowApproveQuestionModal(true);
    }
  };

  const handleConfirmApproveQuestion = async () => {
    if (!questionToApprove) return;

    try {
      await api.put(`/lms/questions/${questionToApprove.question_id}/approve`);
      showAlertMessage('Đã duyệt câu hỏi thành công', 'success');
      setShowApproveQuestionModal(false);
      setQuestionToApprove(null);
      // Refresh topic questions if in modal view
      if (selectedTopicForView) {
        await fetchTopicQuestions(selectedTopicForView.topic_id);
      }
      // Refresh main questions list and topics stats
      fetchQuestions();
      if (isLMSQA() || isLMSMod()) {
        await fetchTopicsWithStats();
      }
    } catch (error) {
      console.error('Error approving question:', error);
      showAlertMessage(error.response?.data?.message || 'Lỗi khi duyệt câu hỏi', 'danger');
    }
  };

  const handleRejectQuestion = (questionId) => {
    // Try to find question in topicQuestions first (for modal view), then in questions array (for main list)
    const question = topicQuestions.find(q => q.question_id === questionId) || 
                     questions.find(q => q.question_id === questionId);
    if (question) {
      setQuestionToReject(question);
      setRejectQuestionReason('');
      setShowRejectQuestionModal(true);
    }
  };

  const handleConfirmRejectQuestion = async () => {
    if (!questionToReject) return;

    try {
      await api.put(`/lms/questions/${questionToReject.question_id}/reject`, { 
        rejection_reason: rejectQuestionReason || '' 
      });
      showAlertMessage('Đã từ chối câu hỏi thành công', 'success');
      setShowRejectQuestionModal(false);
      setQuestionToReject(null);
      setRejectQuestionReason('');
      // Refresh topic questions if in modal view
      if (selectedTopicForView) {
        await fetchTopicQuestions(selectedTopicForView.topic_id);
      }
      // Refresh main questions list and topics stats
      fetchQuestions();
      if (isLMSQA() || isLMSMod()) {
        await fetchTopicsWithStats();
      }
    } catch (error) {
      console.error('Error rejecting question:', error);
      showAlertMessage(error.response?.data?.message || 'Lỗi khi từ chối câu hỏi', 'danger');
    }
  };

  // Toggle has_error flag (QA only)
  const handleToggleQuestionError = async (questionId) => {
    // Find question to get current state
    const question = questions.find(q => q.question_id === questionId) ||
                     topicQuestions.find(q => q.question_id === questionId);
    if (!question) return;

    const currentErrorState = question.has_error === true || question.has_error === 1;
    const newErrorState = !currentErrorState;
    const originalErrorState = currentErrorState; // Save original for revert
    
    try {
      // Optimistic update - update UI immediately
      setQuestions(prevQuestions => 
        prevQuestions.map(q => 
          q.question_id === questionId 
            ? { ...q, has_error: newErrorState ? 1 : 0 }
            : q
        )
      );
      
      setTopicQuestions(prevTopicQuestions => 
        prevTopicQuestions.map(q => 
          q.question_id === questionId 
            ? { ...q, has_error: newErrorState ? 1 : 0 }
            : q
        )
      );
      
      await api.put(`/lms/questions/${questionId}/toggle-error`, {
        has_error: newErrorState
      });
      
      showAlertMessage(
        newErrorState ? 'Đã đánh dấu câu hỏi có lỗi' : 'Đã bỏ đánh dấu lỗi cho câu hỏi',
        'success'
      );
    } catch (error) {
      console.error('Error toggling question error flag:', error);
      
      // Revert optimistic update on error
      setQuestions(prevQuestions => 
        prevQuestions.map(q => 
          q.question_id === questionId 
            ? { ...q, has_error: originalErrorState ? 1 : 0 }
            : q
        )
      );
      
      setTopicQuestions(prevTopicQuestions => 
        prevTopicQuestions.map(q => 
          q.question_id === questionId 
            ? { ...q, has_error: originalErrorState ? 1 : 0 }
            : q
        )
      );
      
      showAlertMessage(error.response?.data?.message || 'Lỗi khi cập nhật trạng thái lỗi', 'danger');
    }
  };

  // Toggle is_excluded flag (QA only)
  const handleToggleQuestionExclude = async (questionId) => {
    // Find question to get current state
    const question = questions.find(q => q.question_id === questionId) ||
                     topicQuestions.find(q => q.question_id === questionId);
    if (!question) return;

    const currentExcludeState = question.is_excluded === true || question.is_excluded === 1;
    const newExcludeState = !currentExcludeState;
    const originalExcludeState = currentExcludeState; // Save original for revert
    
    try {
      // Optimistic update - update UI immediately
      setQuestions(prevQuestions => 
        prevQuestions.map(q => 
          q.question_id === questionId 
            ? { ...q, is_excluded: newExcludeState ? 1 : 0 }
            : q
        )
      );
      
      setTopicQuestions(prevTopicQuestions => 
        prevTopicQuestions.map(q => 
          q.question_id === questionId 
            ? { ...q, is_excluded: newExcludeState ? 1 : 0 }
            : q
        )
      );
      
      await api.put(`/lms/questions/${questionId}/toggle-exclude`, {
        is_excluded: newExcludeState
      });
      
      showAlertMessage(
        newExcludeState ? 'Đã đánh dấu loại trừ câu hỏi khỏi đề thi' : 'Đã bỏ đánh dấu loại trừ cho câu hỏi',
        'success'
      );
    } catch (error) {
      console.error('Error toggling question exclude flag:', error);
      
      // Revert optimistic update on error
      setQuestions(prevQuestions => 
        prevQuestions.map(q => 
          q.question_id === questionId 
            ? { ...q, is_excluded: originalExcludeState ? 1 : 0 }
            : q
        )
      );
      
      setTopicQuestions(prevTopicQuestions => 
        prevTopicQuestions.map(q => 
          q.question_id === questionId 
            ? { ...q, is_excluded: originalExcludeState ? 1 : 0 }
            : q
        )
      );
      
      showAlertMessage(error.response?.data?.message || 'Lỗi khi cập nhật trạng thái loại trừ', 'danger');
    }
  };

  // Approve all pending questions in current topic (for Mod)
  const handleApproveAllClick = () => {
    if (!selectedTopicForView) return;
    
    const pendingQuestions = topicQuestions.filter(q => q.approval_status === 'pending');
    if (pendingQuestions.length === 0) {
      showAlertMessage('Không có câu hỏi nào đang chờ duyệt', 'warning');
      return;
    }

    setShowApproveAllModal(true);
  };

  const handleConfirmApproveAll = async () => {
    if (!selectedTopicForView) return;
    
    const pendingQuestions = topicQuestions.filter(q => q.approval_status === 'pending');
    if (pendingQuestions.length === 0) {
      setShowApproveAllModal(false);
      return;
    }

    try {
      setShowApproveAllModal(false);
      
      // Approve all pending questions
      const approvePromises = pendingQuestions.map(q => 
        api.put(`/lms/questions/${q.question_id}/approve`)
      );
      
      await Promise.all(approvePromises);
      showAlertMessage(`Đã duyệt thành công ${pendingQuestions.length} câu hỏi`, 'success');
      
      // Refresh topic questions and topics list
      if (selectedTopicForView) {
        await fetchTopicQuestions(selectedTopicForView.topic_id);
      }
      await fetchTopicsWithStats();
      fetchQuestions();
    } catch (error) {
      console.error('Error approving all questions:', error);
      showAlertMessage(error.response?.data?.message || 'Lỗi khi duyệt tất cả câu hỏi', 'danger');
    }
  };

  // Reject all pending questions in current topic (for Mod)
  const handleRejectAllClick = () => {
    if (!selectedTopicForView) return;
    
    const pendingQuestions = topicQuestions.filter(q => q.approval_status === 'pending');
    if (pendingQuestions.length === 0) {
      showAlertMessage('Không có câu hỏi nào đang chờ duyệt', 'warning');
      return;
    }

    setRejectAllReason('');
    setShowRejectAllModal(true);
  };

  const handleConfirmRejectAll = async () => {
    if (!selectedTopicForView) return;
    
    const pendingQuestions = topicQuestions.filter(q => q.approval_status === 'pending');
    if (pendingQuestions.length === 0) {
      setShowRejectAllModal(false);
      return;
    }

    try {
      const reason = rejectAllReason.trim();
      setShowRejectAllModal(false);
      setRejectAllReason('');
      
      // Reject all pending questions
      const rejectPromises = pendingQuestions.map(q => 
        api.put(`/lms/questions/${q.question_id}/reject`, { rejection_reason: reason || '' })
      );
      
      await Promise.all(rejectPromises);
      showAlertMessage(`Đã từ chối thành công ${pendingQuestions.length} câu hỏi`, 'success');
      
      // Refresh topic questions and topics list
      if (selectedTopicForView) {
        await fetchTopicQuestions(selectedTopicForView.topic_id);
      }
      await fetchTopicsWithStats();
      fetchQuestions();
    } catch (error) {
      console.error('Error rejecting all questions:', error);
      showAlertMessage(error.response?.data?.message || 'Lỗi khi từ chối tất cả câu hỏi', 'danger');
    }
  };

  const handleViewQuestionContent = async (question) => {
    // QA cần nhập mật khẩu để xem nội dung câu hỏi đã duyệt
    const password = window.prompt('Vui lòng nhập mật khẩu của bạn để xem nội dung câu hỏi:');
    if (!password) return;

    try {
      const response = await api.post(`/lms/questions/${question.question_id}/verify-password-and-get-content`, {
        password: password
      });

      // Hiển thị modal với nội dung đầy đủ
      setSelectedQuestion(response.data.data);
      setShowQuestionModal(true);
    } catch (error) {
      console.error('Error viewing question content:', error);
      showAlertMessage(error.response?.data?.message || 'Mật khẩu không đúng hoặc không có quyền xem', 'danger');
    }
  };

  const handleSubmitImportedQuestions = async () => {
    if (previewedQuestions.length === 0) {
      showAlertMessage('Không có câu hỏi nào để gửi lên', 'warning');
      return;
    }

    try {
      setShowImportProgressModal(true);
      setImportProgress({ current: 0, total: 100, message: 'Đang gửi câu hỏi lên hệ thống...' });

      const requestBody = {
        questions: previewedQuestions,
        format: importFormat
      };

      // For Staff: send topic_name from form if provided
      // Backend will use this topic_name for all questions
      if (isLMSStaff() && importTemplateOptions.topic_name?.trim()) {
        requestBody.topic_name = importTemplateOptions.topic_name.trim();
      }

      const response = await api.post('/lms/questions/submit-import', requestBody);

      setImportProgress({ current: 100, total: 100, message: 'Hoàn thành!' });

      setTimeout(() => {
        setShowImportProgressModal(false);
        setShowPreviewModal(false);
        setPreviewedQuestions([]);
        
        const message = response.data.data.topics_created > 0
          ? `Đã gửi ${response.data.data.imported_count} câu hỏi lên hệ thống, đã tạo ${response.data.data.topics_created} chủ đề mới`
          : `Đã gửi ${response.data.data.imported_count} câu hỏi lên hệ thống`;
        
        showAlertMessage(message, 'success');
        fetchQuestions();
        fetchTopics();
      }, 500);

    } catch (error) {
      console.error('Error submitting imported questions:', error);
      setShowImportProgressModal(false);
      showAlertMessage(error.response?.data?.message || 'Lỗi khi gửi câu hỏi lên hệ thống', 'danger');
    }
  };

  const handleExportQuestions = async () => {
    try {
      // Build filters object
      const filtersObj = {};
      if (exportFilters.topic_id) filtersObj.topic_id = exportFilters.topic_id;
      if (exportFilters.question_type) filtersObj.question_type = exportFilters.question_type;
      if (exportFilters.difficulty) filtersObj.difficulty_level = exportFilters.difficulty;
      if (exportFilters.bloom_level) filtersObj.bloom_level = exportFilters.bloom_level;
      if (exportFilters.points_min) filtersObj.points_min = exportFilters.points_min;
      if (exportFilters.points_max) filtersObj.points_max = exportFilters.points_max;

      const response = await api.post(
        '/lms/questions/export',
        {
          format: exportFormat,
          filters: filtersObj
        },
        { responseType: 'blob' }
      );

      // Determine file extension based on format
      const extensions = {
        excel: 'xlsx',
        word: 'docx',
        text: 'txt',
        json: 'json'
      };
      const extension = extensions[exportFormat] || 'xlsx';

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `questions_${Date.now()}.${extension}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      showAlertMessage('Export thành công', 'success');
      setShowExportModal(false);
    } catch (error) {
      console.error('Error exporting questions:', error);
      showAlertMessage(error.response?.data?.message || 'Lỗi khi export câu hỏi', 'danger');
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const params = new URLSearchParams();
      params.append('format', importFormat);
      params.append('template', 'true');
      
      // For Staff: use topic_name, for others: use topic_id
      if (isLMSStaff()) {
        if (importTemplateOptions.topic_name) {
          params.append('topic_name', importTemplateOptions.topic_name);
        }
      } else {
        if (importTemplateOptions.topic_id) {
          params.append('topic_id', importTemplateOptions.topic_id);
        }
      }
      
      if (importTemplateOptions.question_type) {
        params.append('question_type', importTemplateOptions.question_type);
      }
      
      // Include column options
      params.append('include_topic', importTemplateOptions.include_topic);
      params.append('include_type', importTemplateOptions.include_type);
      params.append('include_difficulty', importTemplateOptions.include_difficulty);
      params.append('include_bloom', importTemplateOptions.include_bloom);
      params.append('include_clo_plo', importTemplateOptions.include_clo_plo);
      params.append('include_points', importTemplateOptions.include_points);

      const response = await api.get(
        `/lms/questions/template?${params.toString()}`,
        { responseType: 'blob' }
      );

      const extensions = {
        excel: 'xlsx',
        word: 'docx',
        text: 'txt'
      };
      const extension = extensions[importFormat] || 'xlsx';

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `question_template_${Date.now()}.${extension}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      showAlertMessage('Tải file mẫu thành công', 'success');
    } catch (error) {
      console.error('Error downloading template:', error);
      showAlertMessage(error.response?.data?.message || 'Lỗi khi tải file mẫu', 'danger');
    }
  };

  // Helper functions to compare data changes
  const hasQuestionsDataChanged = (oldData, newData) => {
    if (!oldData || !Array.isArray(oldData)) return true; // First load
    if (!newData || !Array.isArray(newData)) return false;
    if (oldData.length !== newData.length) return true;
    
    // Compare by question_id and key fields
    const oldMap = new Map(oldData.map(question => [question.question_id, {
      question_id: question.question_id,
      question_text: question.question_text,
      topic_id: question.topic_id,
      question_type: question.question_type,
      difficulty: question.difficulty || question.difficulty_level,
      bloom_level: question.bloom_level,
      points: question.points,
      updated_at: question.updated_at
    }]));
    
    for (const newQuestion of newData) {
      const oldQuestion = oldMap.get(newQuestion.question_id);
      if (!oldQuestion) return true; // New question added
      
      // Check if key fields changed
      if (
        oldQuestion.question_text !== newQuestion.question_text ||
        oldQuestion.topic_id !== newQuestion.topic_id ||
        oldQuestion.question_type !== newQuestion.question_type ||
        oldQuestion.difficulty !== (newQuestion.difficulty || newQuestion.difficulty_level) ||
        oldQuestion.bloom_level !== newQuestion.bloom_level ||
        oldQuestion.points !== newQuestion.points ||
        oldQuestion.updated_at !== newQuestion.updated_at
      ) {
        return true;
      }
    }
    
    return false; // No changes detected
  };

  const hasTopicsDataChanged = (oldData, newData) => {
    if (!oldData || !Array.isArray(oldData)) return true; // First load
    if (!newData || !Array.isArray(newData)) return false;
    if (oldData.length !== newData.length) return true;
    
    // Compare by topic_id and key fields
    const oldMap = new Map(oldData.map(topic => [topic.topic_id, {
      topic_id: topic.topic_id,
      topic_code: topic.topic_code,
      topic_name: topic.topic_name,
      description: topic.description,
      updated_at: topic.updated_at
    }]));
    
    for (const newTopic of newData) {
      const oldTopic = oldMap.get(newTopic.topic_id);
      if (!oldTopic) return true; // New topic added
      
      // Check if key fields changed
      if (
        oldTopic.topic_code !== newTopic.topic_code ||
        oldTopic.topic_name !== newTopic.topic_name ||
        oldTopic.description !== newTopic.description ||
        oldTopic.updated_at !== newTopic.updated_at
      ) {
        return true;
      }
    }
    
    return false; // No changes detected
  };

  // Compare topics with statistics data to detect changes
  const hasTopicsWithStatsDataChanged = (oldData, newData) => {
    if (!oldData || !Array.isArray(oldData)) return true; // First load
    if (!newData || !Array.isArray(newData)) return false;
    if (oldData.length !== newData.length) return true;
    
    // Compare by topic_id and key fields including statistics
    const oldMap = new Map(oldData.map(topic => [topic.topic_id, {
      topic_id: topic.topic_id,
      topic_code: topic.topic_code,
      topic_name: topic.topic_name,
      description: topic.description,
      question_count: topic.question_count || 0,
      total_points: topic.total_points || 0,
      pending_count: topic.pending_count || 0,
      approved_count: topic.approved_count || 0,
      rejected_count: topic.rejected_count || 0,
      mcq_count: topic.mcq_count || 0,
      multiple_response_count: topic.multiple_response_count || 0,
      true_false_count: topic.true_false_count || 0,
      short_answer_count: topic.short_answer_count || 0,
      essay_count: topic.essay_count || 0,
      easy_count: topic.easy_count || 0,
      medium_count: topic.medium_count || 0,
      hard_count: topic.hard_count || 0,
      expert_count: topic.expert_count || 0,
      updated_at: topic.updated_at
    }]));
    
    for (const newTopic of newData) {
      const oldTopic = oldMap.get(newTopic.topic_id);
      if (!oldTopic) return true; // New topic added
      
      // Check if key fields or statistics changed
      if (
        oldTopic.topic_code !== (newTopic.topic_code || '') ||
        oldTopic.topic_name !== (newTopic.topic_name || '') ||
        oldTopic.description !== (newTopic.description || '') ||
        oldTopic.question_count !== (newTopic.question_count || 0) ||
        oldTopic.total_points !== (newTopic.total_points || 0) ||
        oldTopic.pending_count !== (newTopic.pending_count || 0) ||
        oldTopic.approved_count !== (newTopic.approved_count || 0) ||
        oldTopic.rejected_count !== (newTopic.rejected_count || 0) ||
        oldTopic.mcq_count !== (newTopic.mcq_count || 0) ||
        oldTopic.multiple_response_count !== (newTopic.multiple_response_count || 0) ||
        oldTopic.true_false_count !== (newTopic.true_false_count || 0) ||
        oldTopic.short_answer_count !== (newTopic.short_answer_count || 0) ||
        oldTopic.essay_count !== (newTopic.essay_count || 0) ||
        oldTopic.easy_count !== (newTopic.easy_count || 0) ||
        oldTopic.medium_count !== (newTopic.medium_count || 0) ||
        oldTopic.hard_count !== (newTopic.hard_count || 0) ||
        oldTopic.expert_count !== (newTopic.expert_count || 0) ||
        oldTopic.updated_at !== newTopic.updated_at
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

  // Handle checkbox selection with Shift-Click support
  const handleSelectQuestion = (questionId, index, event) => {
    // Check if Shift key is pressed and we have a previous selection
    if (event.shiftKey && lastClickedIndex !== null && lastClickedIndex !== index) {
      // Prevent default for shift-click to avoid text selection
      event.preventDefault();
      
      // Get the range of questions to select
      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);
      
      // Get all question IDs in the range
      const questionsInRange = displayedQuestions
        .slice(start, end + 1)
        .map(q => q.question_id);
      
      // Select all questions in range (don't toggle, just select)
      setSelectedQuestions(prev => {
        const newSelection = new Set([...prev, ...questionsInRange]);
        return Array.from(newSelection);
      });
      
      // Update last clicked index
      setLastClickedIndex(index);
    } else {
      // Normal click - toggle single selection
      setSelectedQuestions(prev => {
        if (prev.includes(questionId)) {
          return prev.filter(id => id !== questionId);
        } else {
          return [...prev, questionId];
        }
      });
      
      // Update last clicked index
      setLastClickedIndex(index);
    }
  };

  // Handle select all
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedQuestions(displayedQuestions.map(q => q.question_id));
    } else {
      setSelectedQuestions([]);
    }
    // Reset last clicked index when selecting all
    setLastClickedIndex(null);
  };

  // Handle bulk edit points
  const handleBulkEdit = () => {
    // Auto-select all filtered questions (based on current filters, not just displayed page)
    // This allows editing all questions matching filters, not just the 20 on current page
    const allFilteredQuestionIds = filteredQuestions.map(q => q.question_id);
    setSelectedQuestions(allFilteredQuestionIds);
    
    // Reset filters when opening modal
    setBulkEditFilters({
      selectedTopic: '',
      enableTypeFilter: false,
      selectedTypes: ['mcq', 'multiple_response', 'true_false', 'short_answer', 'essay'],
      enableDifficultyFilter: false,
      selectedDifficulties: ['easy', 'medium', 'hard', 'expert'],
      enableBloomFilter: false,
      selectedBlooms: ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']
    });
    // Reset default points
    setCategoryPoints({
      types: {
        mcq: 1,
        multiple_response: 1,
        true_false: 1,
        short_answer: 1,
        essay: 2
      },
      difficulties: {
        easy: 1,
        medium: 1.5,
        hard: 2,
        expert: 3
      },
      blooms: {
        remember: 1,
        understand: 1,
        apply: 1.5,
        analyze: 2,
        evaluate: 2.5,
        create: 3
      }
    });
    setShowBulkEditModal(true);
  };

  // Get filtered questions for bulk edit
  const getFilteredQuestionsForBulkEdit = () => {
    if (!questions || questions.length === 0) return [];
    
    // Start with selected questions
    let filtered = questions.filter(q => selectedQuestions.includes(q.question_id));
    
    // Apply topic filter if selected
    if (bulkEditFilters.selectedTopic) {
      filtered = filtered.filter(q => q.topic_id == bulkEditFilters.selectedTopic);
    }
    
    // Apply type filter if enabled
    if (bulkEditFilters.enableTypeFilter && bulkEditFilters.selectedTypes.length > 0) {
      filtered = filtered.filter(q => bulkEditFilters.selectedTypes.includes(q.question_type));
    }
    
    // Apply difficulty filter if enabled
    if (bulkEditFilters.enableDifficultyFilter && bulkEditFilters.selectedDifficulties.length > 0) {
      filtered = filtered.filter(q => bulkEditFilters.selectedDifficulties.includes(q.difficulty || q.difficulty_level));
    }
    
    // Apply bloom level filter if enabled
    if (bulkEditFilters.enableBloomFilter && bulkEditFilters.selectedBlooms.length > 0) {
      filtered = filtered.filter(q => bulkEditFilters.selectedBlooms.includes(q.bloom_level));
    }
    
    return filtered;
  };

  // Count questions by type/difficulty/bloom from filtered questions (all questions matching current filters, not just displayed page)
  const getQuestionCountsByCategory = () => {
    if (!filteredQuestions || filteredQuestions.length === 0) return { types: {}, difficulties: {}, blooms: {} };
    
    const counts = { types: {}, difficulties: {}, blooms: {} };
    
    filteredQuestions.forEach(q => {
      // Count by type
      if (q.question_type) {
        counts.types[q.question_type] = (counts.types[q.question_type] || 0) + 1;
      }
      
      // Count by difficulty
      const diff = q.difficulty || q.difficulty_level;
      if (diff) {
        counts.difficulties[diff] = (counts.difficulties[diff] || 0) + 1;
      }
      
      // Count by bloom
      if (q.bloom_level) {
        counts.blooms[q.bloom_level] = (counts.blooms[q.bloom_level] || 0) + 1;
      }
    });
    
    return counts;
  };

  // Toggle type checkbox
  const toggleTypeSelection = (type) => {
    setBulkEditFilters(prev => {
      const newSelected = prev.selectedTypes.includes(type)
        ? prev.selectedTypes.filter(t => t !== type)
        : [...prev.selectedTypes, type];
      return { ...prev, selectedTypes: newSelected };
    });
  };

  // Toggle difficulty checkbox
  const toggleDifficultySelection = (difficulty) => {
    setBulkEditFilters(prev => {
      const newSelected = prev.selectedDifficulties.includes(difficulty)
        ? prev.selectedDifficulties.filter(d => d !== difficulty)
        : [...prev.selectedDifficulties, difficulty];
      return { ...prev, selectedDifficulties: newSelected };
    });
  };

  // Toggle bloom checkbox
  const toggleBloomSelection = (bloom) => {
    setBulkEditFilters(prev => {
      const newSelected = prev.selectedBlooms.includes(bloom)
        ? prev.selectedBlooms.filter(b => b !== bloom)
        : [...prev.selectedBlooms, bloom];
      return { ...prev, selectedBlooms: newSelected };
    });
  };


  // Submit bulk edit with category-specific points
  const handleSubmitBulkEdit = async (e) => {
    e.preventDefault();

    // Use getFilteredQuestionsForBulkEdit() to get all questions matching filters
    // This ensures we update all questions, not just those on current page
    const filteredQs = getFilteredQuestionsForBulkEdit();
    
    if (filteredQs.length === 0) {
      showAlertMessage('Không có câu hỏi nào phù hợp với bộ lọc', 'warning');
      return;
    }

    try {
      let totalUpdated = 0;

      // Group questions by their points to minimize API calls
      const questionsByPoints = new Map();

      filteredQs.forEach(q => {
        let points = parseFloat(bulkPoints); // Default points

        // If type filter is enabled, use type-specific points
        if (bulkEditFilters.enableTypeFilter && bulkEditFilters.selectedTypes.includes(q.question_type)) {
          points = parseFloat(categoryPoints.types[q.question_type] || bulkPoints);
        }
        // If difficulty filter is enabled, use difficulty-specific points
        else if (bulkEditFilters.enableDifficultyFilter && bulkEditFilters.selectedDifficulties.includes(q.difficulty || q.difficulty_level)) {
          points = parseFloat(categoryPoints.difficulties[q.difficulty || q.difficulty_level] || bulkPoints);
        }
        // If bloom filter is enabled, use bloom-specific points
        else if (bulkEditFilters.enableBloomFilter && bulkEditFilters.selectedBlooms.includes(q.bloom_level)) {
          points = parseFloat(categoryPoints.blooms[q.bloom_level] || bulkPoints);
        }

        // Group questions by points
        if (!questionsByPoints.has(points)) {
          questionsByPoints.set(points, []);
        }
        questionsByPoints.get(points).push(q.question_id);
      });

      // Update each group
      for (const [points, questionIds] of questionsByPoints) {
        await api.put('/lms/questions/bulk-update-points', {
          question_ids: questionIds,
          points: points
        });
        totalUpdated += questionIds.length;
      }

      showAlertMessage(`Đã cập nhật điểm cho ${totalUpdated} câu hỏi`, 'success');
      setShowBulkEditModal(false);
      setSelectedQuestions([]);
      setLastClickedIndex(null);
      setBulkPoints(1);
      setBulkEditFilters({
        selectedTopic: '',
        enableTypeFilter: false,
        selectedTypes: ['mcq', 'multiple_response', 'true_false', 'short_answer', 'essay'],
        enableDifficultyFilter: false,
        selectedDifficulties: ['easy', 'medium', 'hard', 'expert'],
        enableBloomFilter: false,
        selectedBlooms: ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']
      });
      fetchQuestions();
    } catch (error) {
      console.error('Error bulk updating points:', error);
      showAlertMessage(error.response?.data?.message || 'Lỗi khi cập nhật điểm hàng loạt', 'danger');
    }
  };

  const getDifficultyBadge = (difficulty) => {
    const config = {
      easy: { bg: 'success', text: 'Dễ' },
      medium: { bg: 'warning', text: 'Trung bình' },
      hard: { bg: 'danger', text: 'Khó' },
      expert: { bg: 'dark', text: 'Chuyên gia' }
    };
    const c = config[difficulty] || config.medium;
    return <Badge bg={c.bg}>{c.text}</Badge>;
  };

  // Component for answer statistics chart with hover state - Memoized to prevent re-renders
  const AnswerStatisticsChart = React.memo(({ questionId, questionType, stats }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [hoveredSegment, setHoveredSegment] = useState(null); // 'correct' or 'incorrect'
    const [users, setUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const chartRef = useRef(null);
    
    if (!stats || stats.total_answers === 0) {
      return (
        <div style={{ width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: '#999' }}>
          Chưa có dữ liệu
        </div>
      );
    }

    const correctCount = stats.correct_count || 0;
    const incorrectCount = stats.incorrect_count || 0;
    const total = stats.total_answers || 0;

    // Use ref to track loading state to avoid dependency in useCallback
    const loadingRef = useRef(false);
    
    // Fetch users when hovering over a segment - memoized with useCallback
    const fetchUsers = React.useCallback(async (isCorrect) => {
      if (loadingRef.current) return;
      
      loadingRef.current = true;
      setLoadingUsers(true);
      setUsers([]); // Clear previous users
      
      try {
        console.log('Fetching users for question:', questionId, 'is_correct:', isCorrect);
        const response = await api.get(`/lms/questions/${questionId}/answer-users`, {
          params: { is_correct: isCorrect }
        });
        
        console.log('Answer users response:', response.data);
        
        if (response.data?.success) {
          const usersData = response.data.data || [];
          console.log('Users found:', usersData.length);
          setUsers(usersData);
        } else {
          console.warn('API response not successful:', response.data);
          setUsers([]);
        }
      } catch (error) {
        console.error('Error fetching answer users:', error);
        console.error('Error details:', error.response?.data || error.message);
        setUsers([]);
      } finally {
        loadingRef.current = false;
        setLoadingUsers(false);
      }
    }, [questionId]);

    // Memoize chart data to prevent recreation on every render
    const chartData = React.useMemo(() => ({
      labels: ['Đúng', 'Sai'],
      datasets: [
        {
          data: [correctCount, incorrectCount],
          backgroundColor: ['#28a745', '#dc3545'],
          borderColor: ['#1e7e34', '#c82333'],
          borderWidth: 1,
        },
      ],
    }), [correctCount, incorrectCount]);

    // Memoize chart options with useCallback for onHover
    const handleHover = React.useCallback((event, activeElements) => {
      if (activeElements && activeElements.length > 0) {
        const element = activeElements[0];
        const segmentIndex = element.index; // 0 = correct, 1 = incorrect
        const isCorrect = segmentIndex === 0;
        
        setIsHovered(true);
        const newSegment = isCorrect ? 'correct' : 'incorrect';
        
        // Only fetch if segment changed
        setHoveredSegment(prevSegment => {
          if (prevSegment !== newSegment) {
            setUsers([]); // Clear previous users
            
            // Fetch users if count > 0
            const shouldFetch = (isCorrect && correctCount > 0) || (!isCorrect && incorrectCount > 0);
            if (shouldFetch) {
              fetchUsers(isCorrect);
            }
            return newSegment;
          }
          return prevSegment;
        });
      } else {
        setIsHovered(false);
        setHoveredSegment(null);
        setUsers([]);
      }
    }, [correctCount, incorrectCount, fetchUsers]);

    const chartOptions = React.useMemo(() => ({
      responsive: true,
      maintainAspectRatio: true,
      layout: {
        padding: {
          top: 5,
          bottom: 5,
          left: 5,
          right: 5
        }
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          enabled: false, // Disable default tooltip
        }
      },
      onHover: handleHover
    }), [handleHover]);

    const displayCount = hoveredSegment === 'correct' ? correctCount : incorrectCount;
    const displayColor = hoveredSegment === 'correct' ? '#28a745' : '#dc3545';
    const displayLabel = hoveredSegment === 'correct' ? 'Đúng' : 'Sai';

    return (
      <div 
        style={{ width: '90px', height: '90px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onMouseLeave={() => {
          setIsHovered(false);
          setHoveredSegment(null);
          setUsers([]);
        }}
      >
        <Doughnut ref={chartRef} data={chartData} options={chartOptions} />
        <div style={{ 
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)',
          fontSize: '8px',
          fontWeight: 'bold',
          textAlign: 'center',
          pointerEvents: 'none',
          lineHeight: '1.2'
        }}>
          {isHovered && hoveredSegment ? (
            <div style={{ fontSize: '12px', color: displayColor }}>
              {displayCount}
            </div>
          ) : (
            <div style={{ fontSize: '14px' }}>{total}</div>
          )}
        </div>
        
        {/* User list popup */}
        {isHovered && hoveredSegment && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginTop: '5px',
            backgroundColor: 'white',
            border: '1px solid #ddd',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            zIndex: 1000,
            minWidth: '250px',
            maxWidth: '350px',
            maxHeight: '300px',
            overflowY: 'auto',
            padding: '8px'
          }}>
            <div style={{ 
              fontWeight: 'bold', 
              marginBottom: '8px', 
              color: displayColor,
              fontSize: '12px',
              borderBottom: '1px solid #eee',
              paddingBottom: '4px'
            }}>
              {displayLabel} ({displayCount})
            </div>
            {loadingUsers ? (
              <div style={{ fontSize: '11px', color: '#666', textAlign: 'center', padding: '10px' }}>
                Đang tải...
              </div>
            ) : !loadingUsers && users.length === 0 ? (
              <div style={{ fontSize: '11px', color: '#666', textAlign: 'center', padding: '10px' }}>
                Không có dữ liệu
              </div>
            ) : (
              <div style={{ fontSize: '11px' }}>
                {users.map((user, index) => (
                  <div key={user.id || index} style={{ 
                    padding: '4px 0',
                    borderBottom: index < users.length - 1 ? '1px solid #f0f0f0' : 'none'
                  }}>
                    <div style={{ fontWeight: 'bold' }}>{user.full_name || 'N/A'}</div>
                    <div style={{ color: '#666', fontSize: '10px' }}>
                      {user.student_id && <span>Mã SV: {user.student_id}</span>}
                      {user.student_id && user.email && <span> | </span>}
                      {user.email && <span>{user.email}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }, (prevProps, nextProps) => {
    // Custom comparison function - return true if props are equal (skip re-render)
    // Return false if props are different (re-render)
    const prevStats = prevProps.stats;
    const nextStats = nextProps.stats;
    
    // If questionId changed, re-render
    if (prevProps.questionId !== nextProps.questionId) {
      return false;
    }
    
    // If stats don't exist in either, skip re-render
    if (!prevStats && !nextStats) {
      return true;
    }
    
    // If one exists and the other doesn't, re-render
    if (!prevStats || !nextStats) {
      return false;
    }
    
    // Compare stats values - return true if equal (skip re-render)
    return (
      prevStats.total_answers === nextStats.total_answers &&
      prevStats.correct_count === nextStats.correct_count &&
      prevStats.incorrect_count === nextStats.incorrect_count
    );
  });

  // Render answer statistics chart for a question (wrapper function) - memoized
  const renderAnswerStatisticsChart = React.useCallback((questionId, questionType) => {
    const stats = answerStatistics[questionId];
    return <AnswerStatisticsChart questionId={questionId} questionType={questionType} stats={stats} />;
  }, [answerStatistics]);

  const getTypeBadge = (type) => {
    const config = {
      mcq: { bg: 'primary', text: 'Trắc nghiệm' },
      multiple_response: { bg: 'info', text: 'Nhiều đáp án' },
      true_false: { bg: 'secondary', text: 'Đúng/Sai' },
      short_answer: { bg: 'success', text: 'Trả lời ngắn' },
      essay: { bg: 'warning', text: 'Tự luận' },
      matching: { bg: 'danger', text: 'Nối đáp án' },
      fill_blank: { bg: 'dark', text: 'Điền khuyết' },
      ordering: { bg: 'light', text: 'Sắp xếp' }
    };
    const c = config[type] || config.mcq;
    return <Badge bg={c.bg}>{c.text}</Badge>;
  };

  const getBloomBadge = (level) => {
    const config = {
      remember: { bg: 'secondary', text: 'Nhớ' },
      understand: { bg: 'info', text: 'Hiểu' },
      apply: { bg: 'primary', text: 'Vận dụng' },
      analyze: { bg: 'warning', text: 'Phân tích' },
      evaluate: { bg: 'danger', text: 'Đánh giá' },
      create: { bg: 'success', text: 'Sáng tạo' }
    };
    const c = config[level] || config.understand;
    return <Badge bg={c.bg}>{c.text}</Badge>;
  };

  // Filter questions ở client-side và memoize để tránh tính toán lại không cần thiết
  const filteredQuestions = React.useMemo(() => {
    if (!Array.isArray(questions) || questions.length === 0) return [];

    let filtered = [...questions];

    // Filter theo question_type (chỉ khi có giá trị)
    if (filters.question_type && filters.question_type.trim() !== '') {
      filtered = filtered.filter(q => q.question_type === filters.question_type);
    }

    // Filter theo difficulty (chỉ khi có giá trị)
    // Kiểm tra cả difficulty và difficulty_level vì database dùng difficulty_level
    if (filters.difficulty && filters.difficulty.trim() !== '') {
      const beforeFilterCount = filtered.length;
      filtered = filtered.filter(q => {
        // Kiểm tra cả hai field name để tương thích
        const questionDifficulty = q.difficulty || q.difficulty_level;
        return questionDifficulty === filters.difficulty;
      });
      
      // Debug log
      console.log('Difficulty filter applied:', {
        filterValue: filters.difficulty,
        beforeCount: beforeFilterCount,
        afterCount: filtered.length,
        sampleQuestion: filtered.length > 0 ? {
          hasDifficulty: !!filtered[0].difficulty,
          hasDifficultyLevel: !!filtered[0].difficulty_level,
          difficulty: filtered[0].difficulty,
          difficulty_level: filtered[0].difficulty_level
        } : null
      });
    }

    // Filter theo status (chỉ khi có giá trị)
    if (filters.status && filters.status.trim() !== '') {
      filtered = filtered.filter(q => {
        switch (filters.status) {
          case 'pending':
            return q.approval_status === 'pending';
          case 'approved':
            return q.approval_status === 'approved';
          case 'rejected':
            return q.approval_status === 'rejected';
          case 'duplicate':
            return q.is_duplicate === true || q.is_duplicate === 1;
          case 'error':
            return (q.has_error === true || q.has_error === 1);
          case 'excluded':
            return (q.is_excluded === true || q.is_excluded === 1);
          default:
            return true;
        }
      });
    }

    // Sort: Questions with "pending" status first, then others
    filtered.sort((a, b) => {
      const aIsPending = a.approval_status === 'pending';
      const bIsPending = b.approval_status === 'pending';
      
      if (aIsPending && !bIsPending) return -1; // a comes first
      if (!aIsPending && bIsPending) return 1;  // b comes first
      return 0; // Keep original order for others
    });

    // Apply custom sorting if sortColumn is set
    if (sortColumn) {
      filtered.sort((a, b) => {
        let compareResult = 0;
        
        switch (sortColumn) {
          case 'id':
            compareResult = a.question_id - b.question_id;
            break;
            
          case 'question_text':
            const textA = (a.question_text || '').trim().toLowerCase();
            const textB = (b.question_text || '').trim().toLowerCase();
            compareResult = textA.localeCompare(textB, 'vi');
            break;
            
          case 'answer_stats':
            const statsA = answerStatistics[a.question_id] || { correct_count: 0, incorrect_count: 0 };
            const statsB = answerStatistics[b.question_id] || { correct_count: 0, incorrect_count: 0 };
            const incorrectA = statsA.incorrect_count || 0;
            const incorrectB = statsB.incorrect_count || 0;
            const correctA = statsA.correct_count || 0;
            const correctB = statsB.correct_count || 0;
            
            // desc: "Sai nhiều hơn" - sort by incorrect count (descending)
            // asc: "Đúng nhiều hơn" - sort by correct count (descending)
            if (sortDirection === 'desc') {
              compareResult = incorrectB - incorrectA; // More incorrect first
            } else {
              compareResult = correctB - correctA; // More correct first
            }
            break;
            
          case 'topic':
            const topicA = (a.topic_name || '').trim().toLowerCase();
            const topicB = (b.topic_name || '').trim().toLowerCase();
            compareResult = topicA.localeCompare(topicB, 'vi');
            break;
            
          case 'created_by':
            const createdByA = (a.created_by_name || '').trim().toLowerCase();
            const createdByB = (b.created_by_name || '').trim().toLowerCase();
            compareResult = createdByA.localeCompare(createdByB, 'vi');
            break;
            
          case 'points':
            const pointsA = parseFloat(a.points || 0);
            const pointsB = parseFloat(b.points || 0);
            compareResult = pointsA - pointsB;
            break;
            
          case 'usage_count':
            const usageA = parseInt(a.usage_count || 0);
            const usageB = parseInt(b.usage_count || 0);
            compareResult = usageA - usageB;
            break;
            
          default:
            return 0;
        }
        
        return sortDirection === 'asc' ? compareResult : -compareResult;
      });
    }

    return filtered;
  }, [questions, filters.question_type, filters.difficulty, filters.status, sortColumn, sortDirection, answerStatistics]);
  
  // Update pagination when filteredQuestions or pageSize changes
  useEffect(() => {
    const limit = pageSize === -1 ? filteredQuestions.length : (pageSize > 0 ? pageSize : 20);
    const totalItems = filteredQuestions.length;
    const totalPages = Math.ceil(totalItems / limit);
    setPagination(prev => ({
      ...prev,
      limit,
      totalItems,
      totalPages,
      page: prev.page > totalPages && totalPages > 0 ? totalPages : prev.page
    }));
  }, [filteredQuestions.length, pageSize]);

  // Áp dụng pagination để hiển thị câu hỏi
  const displayedQuestions = React.useMemo(() => {
    const limit = pageSize > 0 ? pageSize : filteredQuestions.length;
    if (limit === -1) {
      return filteredQuestions; // Show all
    }
    return filteredQuestions.slice(
      (pagination.page - 1) * limit,
      pagination.page * limit
    );
  }, [filteredQuestions, pagination.page, pageSize]);

  // Filter topics ở client-side (for Mod role)
  const filteredTopics = React.useMemo(() => {
    if (!Array.isArray(topicsWithStats) || topicsWithStats.length === 0) return [];

    let filtered = [...topicsWithStats];

    // Filter theo tên chủ đề (search)
    if (topicFilters.search && topicFilters.search.trim() !== '') {
      const searchTerm = topicFilters.search.toLowerCase().trim();
      filtered = filtered.filter(topic => 
        (topic.topic_name && topic.topic_name.toLowerCase().includes(searchTerm)) ||
        (topic.topic_code && topic.topic_code.toLowerCase().includes(searchTerm))
      );
    }

    // Filter theo người tạo
    if (topicFilters.created_by && topicFilters.created_by.trim() !== '') {
      filtered = filtered.filter(topic => 
        topic.created_by_name && topic.created_by_name === topicFilters.created_by
      );
    }

    // Filter theo trạng thái
    if (topicFilters.status && topicFilters.status.trim() !== '') {
      filtered = filtered.filter(topic => {
        const pendingCount = topic.pending_count || 0;
        const approvedCount = topic.approved_count || 0;
        const rejectedCount = topic.rejected_count || 0;

        if (topicFilters.status === 'pending') {
          return pendingCount > 0;
        } else if (topicFilters.status === 'approved') {
          return approvedCount > 0 && pendingCount === 0;
        } else if (topicFilters.status === 'rejected') {
          return rejectedCount > 0 && pendingCount === 0 && approvedCount === 0;
        }
        return true;
      });
    }

    return filtered;
  }, [topicsWithStats, topicFilters]);

  // Lấy danh sách unique creators từ topicsWithStats
  const uniqueCreators = React.useMemo(() => {
    if (!Array.isArray(topicsWithStats) || topicsWithStats.length === 0) return [];
    const creators = topicsWithStats
      .map(topic => topic.created_by_name)
      .filter(name => name && name.trim() !== '');
    return [...new Set(creators)].sort();
  }, [topicsWithStats]);

  // Show access denied if user doesn't have permission
  if (!hasLMSQAPermission()) {
    return (
      <div className="container-fluid session-main-container">
        <div className="session-header">
          <div className="header-content">
            <div className="header-title">
              <h1>Ngân hàng Câu hỏi</h1>
              <p className="header-subtitle">Xây dựng, phân loại, tái sử dụng câu hỏi theo CLO/PLO & Bloom Taxonomy</p>
            </div>
          </div>
        </div>
        <Alert variant="danger" className="mt-3">
          <Alert.Heading>Không có quyền truy cập</Alert.Heading>
          <p>Bạn không có quyền truy cập trang này. Chỉ các quyền <strong>Khảo thí & Đảm bảo chất lượng (lms_qa)</strong>, <strong>Quản lý LMS (lms_mod)</strong> và <strong>Nhân viên LMS (lms_staff)</strong> mới có quyền xem và quản lý ngân hàng câu hỏi.</p>
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
            <h1>Ngân hàng Câu hỏi</h1> 
            <p className="header-subtitle">Xây dựng, phân loại, tái sử dụng câu hỏi theo CLO/PLO & Bloom Taxonomy</p>
          </div>
          <div className="header-actions">
            {isLMSQA() && (
              <Button 
                variant="warning" 
                className="create-session-btn" 
                onClick={handleBulkEdit}
              >
                <i className="fas fa-edit me-2"></i>Điều chỉnh điểm
              </Button>
            )}
            <Button variant="light" className="create-session-btn" onClick={() => setShowImportModal(true)}>
              <i className="fas fa-file-import me-2"></i>Import
            </Button>
            {isLMSQA() && (
              <Button variant="light" className="create-session-btn" onClick={() => {
                setExportFilters({
                  topic_id: filters.topic_id || '',
                  question_type: filters.question_type || '',
                  difficulty: filters.difficulty || '',
                  bloom_level: filters.bloom_level || '',
                  points_min: '',
                  points_max: ''
                });
                setShowExportModal(true);
              }}>
                <i className="fas fa-file-export me-2"></i>Export
              </Button>
            )}
            <Button variant="light" className="create-session-btn" onClick={handleCreateQuestion}>
              <i className="fas fa-plus me-2"></i>Tạo câu hỏi mới
            </Button>
          </div>
        </div>
      </div>


      {/* Filters - Only show for QA */}
      {isLMSQA() && (
        <div className="session-list-controls">
          <div className="search-controls">
            <div className="search-input" style={{ minWidth: '350px', flex: '1' }}>
              <input
                type="text"
                placeholder="Tìm theo ID (Q-xxxxx) hoặc nội dung câu hỏi..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                style={{ width: '100%' }}
              />
            </div>

            <select
              className="filter-select"
              value={filters.topic_id}
              onChange={(e) => setFilters({ ...filters, topic_id: e.target.value })}
            >
              <option value="">Tất cả chủ đề</option>
              {Array.isArray(topics) && topics.map((topic) => (
                <option key={topic.topic_id} value={topic.topic_id}>
                  {topic.topic_name}
                </option>
              ))}
            </select>

            <select
              className="filter-select"
              value={filters.question_type}
              onChange={(e) => setFilters({ ...filters, question_type: e.target.value })}
            >
              <option value="">Tất cả loại</option>
              <option value="mcq">Trắc nghiệm</option>
              <option value="multiple_response">Nhiều đáp án</option>
              <option value="true_false">Đúng/Sai</option>
              <option value="short_answer">Trả lời ngắn</option>
              <option value="essay">Tự luận</option>
            </select>

            <select
              className="filter-select"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="pending">Chờ duyệt</option>
              <option value="approved">Đã duyệt</option>
              <option value="rejected">Từ chối</option>
              <option value="duplicate">Trùng lặp</option>
              <option value="error">Lỗi</option>
              <option value="excluded">Loại trừ</option>
            </select>

            <select
              className="filter-select"
              value={filters.difficulty}
              onChange={(e) => setFilters({ ...filters, difficulty: e.target.value })}
            >
              <option value="">Tất cả độ khó</option>
              <option value="easy">Dễ</option>
              <option value="medium">Trung bình</option>
              <option value="hard">Khó</option>
              <option value="expert">Chuyên gia</option>
            </select>

            <select
              className="filter-select"
              value={pageSize}
              onChange={(e) => {
                const newPageSize = e.target.value === '-1' ? -1 : Number(e.target.value);
                setPageSize(newPageSize);
              }}
            >
              <option value={100}>100 dòng</option>
              <option value={200}>200 dòng</option>
              <option value={500}>500 dòng</option>
              <option value={1000}>1000 dòng</option>
              <option value={-1}>Tất cả</option>
            </select>

            <Button variant="outline-info" onClick={handleCreateTopic}>
              <i className="fas fa-tags me-2"></i>Quản lý chủ đề
            </Button>
          </div>
        </div>
      )}

      {/* Content - Different views for QA vs Staff/Mod */}
      {isLMSQA() ? (
        /* QA View: Questions Table */
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
                      <th 
                        style={{ width: '50px', cursor: 'pointer' }}
                        onClick={() => handleSort('id')}
                        title={sortColumn === 'id' ? (sortDirection === 'asc' ? 'Nhỏ đến lớn' : 'Lớn đến nhỏ') : 'Sắp xếp theo ID'}
                      >
                        ID{getSortIcon('id')}
                      </th>
                      <th>
                        <span
                          onClick={() => handleSort('question_text')}
                          style={{ cursor: 'pointer' }}
                          title={sortColumn === 'question_text' ? (sortDirection === 'asc' ? 'A đến Z' : 'Z đến A') : 'Sắp xếp theo nội dung'}
                        >
                          Nội dung câu hỏi ({filteredQuestions.length} câu)
                          {getSortIcon('question_text')}
                        </span>
                        <i 
                          className={`fas fa-eye question-column-toggle ms-2 ${revealedColumn ? 'active' : ''}`}
                          onClick={toggleColumnVisibility}
                          title={revealedColumn ? 'Ẩn toàn bộ nội dung câu hỏi' : 'Hiển thị toàn bộ nội dung câu hỏi'}
                          style={{ cursor: 'pointer', fontSize: '14px' }}
                        ></i>
                      </th>
                      {isLMSQA() && (
                        <th 
                          style={{ width: '120px', cursor: 'pointer' }}
                          onClick={() => handleSort('answer_stats')}
                          title={sortColumn === 'answer_stats' ? (sortDirection === 'desc' ? 'Sai nhiều hơn' : 'Đúng nhiều hơn') : 'Sắp xếp theo phân tích'}
                        >
                          Phân tích{getSortIcon('answer_stats')}
                        </th>
                      )}
                      <th 
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleSort('topic')}
                        title={sortColumn === 'topic' ? (sortDirection === 'asc' ? 'A đến Z' : 'Z đến A') : 'Sắp xếp theo chủ đề'}
                      >
                        Chủ đề{getSortIcon('topic')}
                      </th>
                      <th 
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleSort('created_by')}
                        title={sortColumn === 'created_by' ? (sortDirection === 'asc' ? 'A đến Z' : 'Z đến A') : 'Sắp xếp theo người tạo'}
                      >
                        Người tạo{getSortIcon('created_by')}
                      </th>
                      <th>Loại</th>
                      <th>Độ khó</th>
                      <th>Bloom</th>
                      <th>CLO/PLO</th>
                      <th 
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleSort('points')}
                        title={sortColumn === 'points' ? (sortDirection === 'asc' ? 'Điểm nhỏ hơn' : 'Điểm lớn hơn') : 'Sắp xếp theo điểm'}
                      >
                        Điểm{getSortIcon('points')}
                      </th>
                      <th>Trạng thái</th>
                      <th 
                        style={{ width: '120px', cursor: 'pointer' }}
                        onClick={() => handleSort('usage_count')}
                        title={sortColumn === 'usage_count' ? (sortDirection === 'asc' ? 'Số ít hơn' : 'Số nhiều hơn') : 'Sắp xếp theo số lần sử dụng'}
                      >
                        Đã hiển thị{getSortIcon('usage_count')}
                      </th>
                      <th>Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!Array.isArray(questions) || questions.length === 0 ? (
                      <tr>
                        <td colSpan={isLMSQA() ? "13" : "12"} className="text-center p-4">
                          <i className="fas fa-inbox fa-3x text-muted mb-3"></i>
                          <p className="text-muted">Chưa có câu hỏi nào. Nhấn "Tạo câu hỏi mới" hoặc "Import" để bắt đầu.</p>
                        </td>
                      </tr>
                    ) : displayedQuestions.length === 0 ? (
                      <tr>
                        <td colSpan={isLMSQA() ? "13" : "12"} className="text-center p-4">
                          <i className="fas fa-filter fa-3x text-muted mb-3"></i>
                          <p className="text-muted">Không tìm thấy câu hỏi nào phù hợp với bộ lọc đã chọn.</p>
                        </td>
                      </tr>
                    ) : (
                      displayedQuestions.map((q, index) => {
                        const hasError = q.has_error === true || q.has_error === 1;
                        const isExcluded = q.is_excluded === true || q.is_excluded === 1;
                        const rowStyle = hasError 
                          ? { backgroundColor: 'rgba(220, 53, 69, 0.08)' } 
                          : isExcluded 
                            ? { backgroundColor: 'rgba(108, 117, 125, 0.08)', opacity: 0.7 } 
                            : {};
                        
                        return (
                        <tr 
                          key={q.question_id} 
                          style={{ ...rowStyle, cursor: 'pointer' }}
                          onClick={(e) => {
                            // Chỉ mở modal nếu click vào dòng, không phải vào các nút
                            if (e.target.closest('button') || e.target.closest('a') || e.target.closest('.action-buttons')) {
                              return;
                            }
                            handleEditQuestion(q);
                          }}
                        >
                          <td>
                            <span className="badge bg-secondary">Q-{q.question_id}</span>
                          </td>
                          <td>
                            <div style={{ maxWidth: '400px', position: 'relative' }}>
                              {q.question_text ? (
                                <>
                                  <span 
                                    className={`question-text-cell ${isQuestionTextRevealed(q.question_id) ? 'revealed' : 'blurred'}`}
                                    onClick={(e) => toggleQuestionTextVisibility(q.question_id, e)}
                                    style={{ cursor: 'pointer' }}
                                  >
                                    {q.question_text.substring(0, 100)}
                                    {q.question_text.length > 100 && '...'}
                                  </span>
                                </>
                              ) : (
                                <span className="text-muted">N/A</span>
                              )}
                            </div>
                          </td>
                          {isLMSQA() && (
                            <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                              {renderAnswerStatisticsChart(q.question_id, q.question_type)}
                            </td>
                          )}
                          <td>
                            <span className="badge bg-info">{q.topic_name || 'N/A'}</span>
                          </td>
                          <td>{q.created_by_name || '-'}</td>
                          <td>{getTypeBadge(q.question_type)}</td>
                          <td>{getDifficultyBadge(q.difficulty || q.difficulty_level)}</td>
                          <td>{getBloomBadge(q.bloom_level)}</td>
                          <td>
                            {q.clo_tags && (
                              <Badge bg="success" className="me-1">CLO</Badge>
                            )}
                            {q.plo_tags && (
                              <Badge bg="warning">PLO</Badge>
                            )}
                          </td>
                          <td>
                            <Badge bg="primary">{q.points || 1}</Badge>
                          </td>
                          <td>
                            <div className="d-flex flex-wrap gap-1 align-items-center">
                              {q.approval_status === 'pending' && (
                                <Badge bg="warning">Chờ duyệt</Badge>
                              )}
                              {q.approval_status === 'approved' && (
                                <Badge bg="success">Đã duyệt</Badge>
                              )}
                              {q.approval_status === 'rejected' && (
                                <Badge bg="danger">Từ chối</Badge>
                              )}
                              {!q.approval_status && (
                                <Badge bg="secondary">N/A</Badge>
                              )}
                              {q.is_duplicate && q.duplicate_info && q.duplicate_info.length > 0 && (
                                <Badge bg="warning" title={q.duplicate_info.map(d => 
                                  `Chủ đề: ${d.topic_name || 'N/A'} (${d.topic_code || 'N/A'}), Mã: Q-${d.question_id}`
                                ).join('; ')}>
                                  ⚠️ Trùng lặp
                                </Badge>
                              )}
                              {(q.has_error === true || q.has_error === 1) && (
                                <Badge bg="danger" title="Câu hỏi này đã được đánh dấu có lỗi">
                                  ❌ Lỗi
                                </Badge>
                              )}
                              {(q.is_excluded === true || q.is_excluded === 1) && (
                                <Badge bg="secondary" title="Câu hỏi này đã bị loại trừ khỏi đề thi">
                                  🚫 Loại trừ
                                </Badge>
                              )}
                            </div>
                            {q.is_duplicate && q.duplicate_info && q.duplicate_info.length > 0 && (
                              <div className="mt-1 small text-muted">
                                {q.duplicate_info.map((d, idx) => (
                                  <div key={idx} className="small">
                                    Trùng: {d.topic_name || 'N/A'} ({d.topic_code || 'N/A'}), Q-{d.question_id}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="text-center">
                            <Badge bg="info" title="Số lần câu hỏi này được hiển thị cho sinh viên trong các kỳ thi">
                              {q.usage_count || 0}
                            </Badge>
                          </td>
                          <td>
                            <div className="action-buttons">
                              {/* Approve/Reject buttons for pending questions */}
                              {q.approval_status === 'pending' && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline-success"
                                    onClick={() => handleApproveQuestion(q.question_id)}
                                    title="Duyệt"
                                  >
                                    <i className="fas fa-check"></i>
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline-danger"
                                    onClick={() => handleRejectQuestion(q.question_id)}
                                    title="Từ chối"
                                  >
                                    <i className="fas fa-times"></i>
                                  </Button>
                                </>
                              )}
                              {/* QA actions - toggle error and exclude flags */}
                              {isLMSQA() && (
                                <>
                                  <Button
                                    size="sm"
                                    variant={(q.has_error === true || q.has_error === 1) ? "danger" : "outline-danger"}
                                    onClick={() => handleToggleQuestionError(q.question_id)}
                                    title={(q.has_error === true || q.has_error === 1) ? "Bỏ đánh dấu lỗi" : "Đánh dấu có lỗi"}
                                  >
                                    <i className="fas fa-exclamation-triangle"></i>
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={(q.is_excluded === true || q.is_excluded === 1) ? "secondary" : "outline-secondary"}
                                    onClick={() => handleToggleQuestionExclude(q.question_id)}
                                    title={(q.is_excluded === true || q.is_excluded === 1) ? "Bỏ đánh dấu loại trừ" : "Đánh dấu loại trừ"}
                                  >
                                    <i className="fas fa-ban"></i>
                                  </Button>
                                </>
                              )}
                              <Button
                                size="sm"
                                variant="outline-danger"
                                onClick={() => handleDeleteQuestion(q.question_id)}
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
              {filteredQuestions.length > 0 && pagination.totalPages > 1 && (
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
      ) : (
        /* Staff/Mod View: Topics List */
        <>
          {/* Filters - Only show for Mod */}
          {isLMSMod() && (
            <div className="session-list-controls">
              <div className="search-controls">
                <div className="search-input" style={{ minWidth: '300px', flex: '1' }}>
                  <input
                    type="text"
                    placeholder="Tìm theo tên chủ đề..."
                    value={topicFilters.search}
                    onChange={(e) => setTopicFilters({ ...topicFilters, search: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>

                <select
                  className="filter-select"
                  value={topicFilters.created_by}
                  onChange={(e) => setTopicFilters({ ...topicFilters, created_by: e.target.value })}
                >
                  <option value="">Tất cả người tạo</option>
                  {uniqueCreators.map((creator) => (
                    <option key={creator} value={creator}>
                      {creator}
                    </option>
                  ))}
                </select>

                <select
                  className="filter-select"
                  value={topicFilters.status}
                  onChange={(e) => setTopicFilters({ ...topicFilters, status: e.target.value })}
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="pending">Chờ duyệt</option>
                  <option value="approved">Đã duyệt</option>
                  <option value="rejected">Đã từ chối</option>
                </select>
              </div>
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
              {topicsWithStats.length === 0 ? (
                <div className="text-center py-5">
                  <i className="fas fa-inbox fa-3x text-muted mb-3"></i>
                  <p className="text-muted fs-5">Chưa có chủ đề nào. Hãy tạo chủ đề mới.</p>
                </div>
              ) : filteredTopics.length === 0 ? (
                <div className="text-center py-5">
                  <i className="fas fa-filter fa-3x text-muted mb-3"></i>
                  <p className="text-muted fs-5">Không tìm thấy chủ đề nào phù hợp với bộ lọc đã chọn.</p>
                </div>
              ) : (
                <div className="table-responsive-mobile">
                  <table className="table session-table">
                    <thead>
                      <tr>
                        <th>Mã chủ đề</th>
                        <th>Tên chủ đề</th>
                        {isLMSMod() && <th>Người tạo</th>}
                        <th>Trạng thái</th>
                        <th>Số câu hỏi</th>
                        <th>Điểm tổng</th>
                        <th>Loại câu hỏi</th>
                        <th>Độ khó</th>
                        <th>Phân loại Bloom</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTopics.map((topic) => {
                        // Staff: chỉ cho click nếu có câu hỏi pending (chưa duyệt) hoặc rejected (đã từ chối)
                        // QA: có thể click vào bất kỳ topic nào
                        // Mod: chỉ cho click nếu có câu hỏi pending để duyệt (không được click nếu đã duyệt xong)
                        const hasPending = (topic.pending_count || 0) > 0;
                        const hasApproved = (topic.approved_count || 0) > 0;
                        const hasRejected = (topic.rejected_count || 0) > 0;
                        
                        let canClick = false;
                        if (isLMSStaff() && !isLMSQA() && !isLMSMod()) {
                          // Staff: có thể click nếu có pending hoặc rejected (để xem và chỉnh sửa câu hỏi bị từ chối)
                          canClick = hasPending || hasRejected;
                        } else if (isLMSQA()) {
                          // QA: có thể click vào bất kỳ topic nào
                          canClick = true;
                        } else if (isLMSMod()) {
                          // Mod: chỉ click được nếu có pending (không được click nếu đã duyệt xong)
                          canClick = hasPending;
                        }
                        
                        return (
                          <tr 
                            key={topic.topic_id}
                            style={{ 
                              cursor: canClick ? 'pointer' : 'default',
                              opacity: !canClick && hasApproved && (isLMSStaff() || isLMSMod()) ? 0.6 : 1
                            }}
                            onClick={canClick ? () => handleViewTopicQuestions(topic) : undefined}
                          >
                            <td><strong className="session-id">{topic.topic_code}</strong></td>
                            <td className="session-title-cell">
                              {topic.topic_name}
                            </td>
                            {isLMSMod() && <td>{topic.created_by_name || '-'}</td>}
                            <td className="text-center">
                              {(() => {
                                const pendingCount = topic.pending_count || 0;
                                const approvedCount = topic.approved_count || 0;
                                const rejectedCount = topic.rejected_count || 0;
                                
                                if (pendingCount > 0) {
                                  return <Badge bg="warning">Chờ duyệt ({pendingCount})</Badge>;
                                } else if (approvedCount > 0) {
                                  return <Badge bg="success">Đã duyệt ({approvedCount})</Badge>;
                                } else if (rejectedCount > 0) {
                                  return <Badge bg="danger">Đã từ chối ({rejectedCount})</Badge>;
                                } else {
                                  return <Badge bg="secondary">Chưa có câu hỏi</Badge>;
                                }
                              })()}
                            </td>
                            <td className="text-center">
                              <span className="badge bg-info">{topic.question_count || 0}</span>
                            </td>
                            <td className="text-center">
                              <span className="badge bg-success">{topic.total_points || 0}</span>
                            </td>
                            <td>
                              <div className="d-flex flex-column gap-1" style={{ minWidth: '140px' }}>
                                <div className="d-flex align-items-center">
                                  <span className="small" style={{ minWidth: '100px', display: 'inline-block' }}>Trắc nghiệm:</span>
                                  <span className="badge bg-secondary ms-2">{topic.mcq_count || 0}</span>
                                </div>
                                <div className="d-flex align-items-center">
                                  <span className="small" style={{ minWidth: '100px', display: 'inline-block' }}>Nhiều đáp án:</span>
                                  <span className="badge bg-secondary ms-2">{topic.multiple_response_count || 0}</span>
                                </div>
                                <div className="d-flex align-items-center">
                                  <span className="small" style={{ minWidth: '100px', display: 'inline-block' }}>Đúng/Sai:</span>
                                  <span className="badge bg-secondary ms-2">{topic.true_false_count || 0}</span>
                                </div>
                                <div className="d-flex align-items-center">
                                  <span className="small" style={{ minWidth: '100px', display: 'inline-block' }}>Trả lời ngắn:</span>
                                  <span className="badge bg-secondary ms-2">{topic.short_answer_count || 0}</span>
                                </div>
                                <div className="d-flex align-items-center">
                                  <span className="small" style={{ minWidth: '100px', display: 'inline-block' }}>Tự luận:</span>
                                  <span className="badge bg-secondary ms-2">{topic.essay_count || 0}</span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="d-flex flex-column gap-1" style={{ minWidth: '140px' }}>
                                <div className="d-flex align-items-center">
                                  <span className="small" style={{ minWidth: '90px', display: 'inline-block' }}>Dễ:</span>
                                  <span className="badge bg-success ms-2">{topic.easy_count || 0}</span>
                                </div>
                                <div className="d-flex align-items-center">
                                  <span className="small" style={{ minWidth: '90px', display: 'inline-block' }}>Trung bình:</span>
                                  <span className="badge bg-warning ms-2">{topic.medium_count || 0}</span>
                                </div>
                                <div className="d-flex align-items-center">
                                  <span className="small" style={{ minWidth: '90px', display: 'inline-block' }}>Khó:</span>
                                  <span className="badge bg-danger ms-2">{topic.hard_count || 0}</span>
                                </div>
                                <div className="d-flex align-items-center">
                                  <span className="small" style={{ minWidth: '90px', display: 'inline-block' }}>Chuyên gia:</span>
                                  <span className="badge bg-dark ms-2">{topic.expert_count || 0}</span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="d-flex flex-column gap-1" style={{ minWidth: '150px' }}>
                                <div className="d-flex align-items-center">
                                  <span className="small" style={{ minWidth: '90px', display: 'inline-block' }}>Nhớ:</span>
                                  <span className="badge bg-primary ms-2">{topic.remember_count || 0}</span>
                                </div>
                                <div className="d-flex align-items-center">
                                  <span className="small" style={{ minWidth: '90px', display: 'inline-block' }}>Hiểu:</span>
                                  <span className="badge bg-info ms-2">{topic.understand_count || 0}</span>
                                </div>
                                <div className="d-flex align-items-center">
                                  <span className="small" style={{ minWidth: '90px', display: 'inline-block' }}>Áp dụng:</span>
                                  <span className="badge bg-success ms-2">{topic.apply_count || 0}</span>
                                </div>
                                <div className="d-flex align-items-center">
                                  <span className="small" style={{ minWidth: '90px', display: 'inline-block' }}>Phân tích:</span>
                                  <span className="badge bg-warning ms-2">{topic.analyze_count || 0}</span>
                                </div>
                                <div className="d-flex align-items-center">
                                  <span className="small" style={{ minWidth: '90px', display: 'inline-block' }}>Đánh giá:</span>
                                  <span className="badge bg-danger ms-2">{topic.evaluate_count || 0}</span>
                                </div>
                                <div className="d-flex align-items-center">
                                  <span className="small" style={{ minWidth: '90px', display: 'inline-block' }}>Tạo nên:</span>
                                  <span className="badge bg-dark ms-2">{topic.create_count || 0}</span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
          </div>
        </>
      )}

      {/* Question Modal */}
      <Modal 
        show={showQuestionModal} 
        onHide={() => setShowQuestionModal(false)} 
        size="lg"
        className="session-detail-modal"
      >
        <Modal.Header closeButton className="student-detail-header">
          <Modal.Title className="student-detail-title">
            <i className="fas fa-question-circle me-2"></i>
            {editMode ? 'Chỉnh sửa câu hỏi' : 'Tạo câu hỏi mới'}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmitQuestion}>
          <Modal.Body className="student-detail-body">
            <Form.Group className="mb-3">
              <Form.Label>Nội dung câu hỏi *</Form.Label>
              <Form.Control
                as="textarea"
                className="form-control-modern"
                rows={3}
                value={questionForm.question_text}
                onChange={(e) => setQuestionForm({ ...questionForm, question_text: e.target.value })}
                required
              />
            </Form.Group>

            <div className="row">
              <div className="col-md-6">
                <Form.Group className="mb-3">
                  <Form.Label>Chủ đề</Form.Label>
                  <Form.Select
                    className="form-control-modern"
                    value={questionForm.topic_id}
                    onChange={(e) => setQuestionForm({ ...questionForm, topic_id: e.target.value })}
                  >
                    <option value="">Chọn chủ đề</option>
                    {Array.isArray(topics) && topics.map((topic) => (
                      <option key={topic.topic_id} value={topic.topic_id}>
                        {topic.topic_name}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group className="mb-3">
                  <Form.Label>Loại câu hỏi</Form.Label>
                  <Form.Select
                    className="form-control-modern"
                    value={questionForm.question_type}
                    onChange={(e) => setQuestionForm({ ...questionForm, question_type: e.target.value })}
                  >
                    <option value="mcq">Trắc nghiệm (MCQ)</option>
                    <option value="multiple_response">Nhiều đáp án đúng</option>
                    <option value="true_false">Đúng/Sai</option>
                    <option value="short_answer">Trả lời ngắn</option>
                    <option value="essay">Tự luận</option>
                    <option value="matching">Nối đáp án</option>
                    <option value="fill_blank">Điền khuyết</option>
                    <option value="ordering">Sắp xếp</option>
                  </Form.Select>
                </Form.Group>
              </div>
            </div>

            <div className="row">
              <div className="col-md-4">
                <Form.Group className="mb-3">
                  <Form.Label>Độ khó</Form.Label>
                  <Form.Select
                    className="form-control-modern"
                    value={questionForm.difficulty}
                    onChange={(e) => setQuestionForm({ ...questionForm, difficulty: e.target.value })}
                  >
                    <option value="easy">Dễ</option>
                    <option value="medium">Trung bình</option>
                    <option value="hard">Khó</option>
                    <option value="expert">Chuyên gia</option>
                  </Form.Select>
                </Form.Group>
              </div>
              <div className="col-md-4">
                <Form.Group className="mb-3">
                  <Form.Label>Bloom Level</Form.Label>
                  <Form.Select
                    className="form-control-modern"
                    value={questionForm.bloom_level}
                    onChange={(e) => setQuestionForm({ ...questionForm, bloom_level: e.target.value })}
                  >
                    <option value="remember">Remember (Nhớ)</option>
                    <option value="understand">Understand (Hiểu)</option>
                    <option value="apply">Apply (Vận dụng)</option>
                    <option value="analyze">Analyze (Phân tích)</option>
                    <option value="evaluate">Evaluate (Đánh giá)</option>
                    <option value="create">Create (Sáng tạo)</option>
                  </Form.Select>
                </Form.Group>
              </div>
              <div className="col-md-4">
                <Form.Group className="mb-3">
                  <Form.Label>Điểm</Form.Label>
                  <Form.Control
                    type="number"
                    className="form-control-modern"
                    step="0.1"
                    value={questionForm.points}
                    onChange={(e) => setQuestionForm({ ...questionForm, points: parseFloat(e.target.value) })}
                  />
                </Form.Group>
              </div>
            </div>

            {/* Options */}
            {['mcq', 'multiple_response', 'true_false'].includes(questionForm.question_type) && (
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <Form.Label>Đáp án</Form.Label>
                  {questionForm.question_type !== 'true_false' && (
                    <Button size="sm" variant="outline-primary" onClick={handleAddOption}>
                      <i className="fas fa-plus me-2"></i>Thêm đáp án
                    </Button>
                  )}
                </div>

                {questionForm.question_type === 'true_false' ? (
                  <>
                    <Form.Check
                      type="radio"
                      label="Đúng"
                      name="true_false"
                      checked={questionForm.options[0]?.is_correct}
                      onChange={() => {
                        setQuestionForm({
                          ...questionForm,
                          options: [
                            { option_text: 'True', is_correct: true },
                            { option_text: 'False', is_correct: false }
                          ]
                        });
                      }}
                    />
                    <Form.Check
                      type="radio"
                      label="Sai"
                      name="true_false"
                      checked={questionForm.options[1]?.is_correct}
                      onChange={() => {
                        setQuestionForm({
                          ...questionForm,
                          options: [
                            { option_text: 'True', is_correct: false },
                            { option_text: 'False', is_correct: true }
                          ]
                        });
                      }}
                    />
                  </>
                ) : (
                  questionForm.options.map((option, index) => (
                    <InputGroup className="mb-2" key={index}>
                      <InputGroup.Checkbox
                        checked={option.is_correct}
                        onChange={(e) => handleOptionChange(index, 'is_correct', e.target.checked)}
                      />
                      <Form.Control
                        type="text"
                        className="form-control-modern"
                        placeholder={`Đáp án ${index + 1}`}
                        value={option.option_text}
                        onChange={(e) => handleOptionChange(index, 'option_text', e.target.value)}
                      />
                      {questionForm.options.length > 2 && (
                        <Button variant="outline-danger" onClick={() => handleRemoveOption(index)}>
                          <i className="fas fa-times"></i>
                        </Button>
                      )}
                    </InputGroup>
                  ))
                )}
              </div>
            )}

            <div className="row">
              <div className="col-md-6">
                <Form.Group className="mb-3">
                  <Form.Label>CLO Tags (phân cách bởi dấu phẩy)</Form.Label>
                  <Form.Control
                    type="text"
                    className="form-control-modern"
                    placeholder="CLO1, CLO2, CLO3"
                    value={questionForm.clo_tags}
                    onChange={(e) => setQuestionForm({ ...questionForm, clo_tags: e.target.value })}
                  />
                  <Form.Text className="text-muted">
                    Ví dụ: CLO1, CLO2, CLO3
                  </Form.Text>
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group className="mb-3">
                  <Form.Label>PLO Tags (phân cách bởi dấu phẩy)</Form.Label>
                  <Form.Control
                    type="text"
                    className="form-control-modern"
                    placeholder="PLO1, PLO2, PLO3"
                    value={questionForm.plo_tags}
                    onChange={(e) => setQuestionForm({ ...questionForm, plo_tags: e.target.value })}
                  />
                  <Form.Text className="text-muted">
                    Ví dụ: PLO1, PLO2, PLO3
                  </Form.Text>
                </Form.Group>
              </div>
            </div>

            <Form.Group className="mb-3">
              <Form.Label>Giải thích đáp án</Form.Label>
              <Form.Control
                as="textarea"
                className="form-control-modern"
                rows={2}
                value={questionForm.explanation}
                onChange={(e) => setQuestionForm({ ...questionForm, explanation: e.target.value })}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer className="student-detail-footer">
            <Button variant="secondary" className="btn-cancel" onClick={() => setShowQuestionModal(false)}>
              Hủy
            </Button>
            <Button variant="primary" className="btn-edit" type="submit">
              <i className={`fas ${editMode ? 'fa-save' : 'fa-plus'} me-2`}></i>
              {editMode ? 'Cập nhật' : 'Tạo mới'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Topic Management Modal - Danh sách chủ đề với thống kê */}
      <Modal 
        show={showTopicManagementModal} 
        onHide={() => setShowTopicManagementModal(false)}
        size="xl"
        className="session-detail-modal topic-management-modal"
        dialogClassName="topic-management-dialog"
      >
        <Modal.Header closeButton className="student-detail-header">
          <Modal.Title className="student-detail-title">
            <i className="fas fa-tags me-2"></i>
            Quản lý chủ đề
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="student-detail-body">

            {topicsWithStats.length === 0 ? (
              <div className="text-center py-5">
                <i className="fas fa-inbox fa-3x text-muted mb-3"></i>
                <p className="text-muted fs-5">Chưa có chủ đề nào. Hãy tạo chủ đề mới.</p>
              </div>
            ) : (
              <div className="session-table-container">
                <table className="table session-table">
                  <thead>
                    <tr>
                      <th>Mã chủ đề</th>
                      <th>Tên chủ đề</th>
                      <th>Người tạo</th>
                      <th>Trạng thái</th>
                      <th>Số câu hỏi</th>
                      <th>Điểm tổng</th>
                      <th>Loại câu hỏi</th>
                      <th>Độ khó</th>
                      <th>Phân loại Bloom</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topicsWithStats.map((topic) => (
                      <tr key={topic.topic_id}>
                        <td><strong className="session-id">{topic.topic_code}</strong></td>
                        <td className="session-title-cell">{topic.topic_name}</td>
                        <td>{topic.created_by_name || '-'}</td>
                        <td className="text-center">
                          {(() => {
                            const pendingCount = topic.pending_count || 0;
                            const approvedCount = topic.approved_count || 0;
                            const rejectedCount = topic.rejected_count || 0;
                            
                            if (pendingCount > 0) {
                              return <Badge bg="warning">Chờ duyệt ({pendingCount})</Badge>;
                            } else if (approvedCount > 0) {
                              return <Badge bg="success">Đã duyệt ({approvedCount})</Badge>;
                            } else if (rejectedCount > 0) {
                              return <Badge bg="danger">Đã từ chối ({rejectedCount})</Badge>;
                            } else {
                              return <Badge bg="secondary">Chưa có câu hỏi</Badge>;
                            }
                          })()}
                        </td>
                        <td className="text-center">
                          <span className="badge bg-info">{topic.question_count || 0}</span>
                        </td>
                        <td className="text-center">
                          <span className="badge bg-success">{topic.total_points || 0}</span>
                        </td>
                        <td>
                          <div className="d-flex flex-column gap-1" style={{ minWidth: '140px' }}>
                            <div className="d-flex align-items-center">
                              <span className="small" style={{ minWidth: '100px', display: 'inline-block' }}>Trắc nghiệm:</span>
                              <span className="badge bg-secondary ms-2">{topic.mcq_count || 0}</span>
                            </div>
                            <div className="d-flex align-items-center">
                              <span className="small" style={{ minWidth: '100px', display: 'inline-block' }}>Nhiều đáp án:</span>
                              <span className="badge bg-secondary ms-2">{topic.multiple_response_count || 0}</span>
                            </div>
                            <div className="d-flex align-items-center">
                              <span className="small" style={{ minWidth: '100px', display: 'inline-block' }}>Đúng/Sai:</span>
                              <span className="badge bg-secondary ms-2">{topic.true_false_count || 0}</span>
                            </div>
                            <div className="d-flex align-items-center">
                              <span className="small" style={{ minWidth: '100px', display: 'inline-block' }}>Trả lời ngắn:</span>
                              <span className="badge bg-secondary ms-2">{topic.short_answer_count || 0}</span>
                            </div>
                            <div className="d-flex align-items-center">
                              <span className="small" style={{ minWidth: '100px', display: 'inline-block' }}>Tự luận:</span>
                              <span className="badge bg-secondary ms-2">{topic.essay_count || 0}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="d-flex flex-column gap-1" style={{ minWidth: '140px' }}>
                            <div className="d-flex align-items-center">
                              <span className="small" style={{ minWidth: '90px', display: 'inline-block' }}>Dễ:</span>
                              <span className="badge bg-success ms-2">{topic.easy_count || 0}</span>
                            </div>
                            <div className="d-flex align-items-center">
                              <span className="small" style={{ minWidth: '90px', display: 'inline-block' }}>Trung bình:</span>
                              <span className="badge bg-warning ms-2">{topic.medium_count || 0}</span>
                            </div>
                            <div className="d-flex align-items-center">
                              <span className="small" style={{ minWidth: '90px', display: 'inline-block' }}>Khó:</span>
                              <span className="badge bg-danger ms-2">{topic.hard_count || 0}</span>
                            </div>
                            <div className="d-flex align-items-center">
                              <span className="small" style={{ minWidth: '90px', display: 'inline-block' }}>Chuyên gia:</span>
                              <span className="badge bg-dark ms-2">{topic.expert_count || 0}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="d-flex flex-column gap-1" style={{ minWidth: '150px' }}>
                            <div className="d-flex align-items-center">
                              <span className="small" style={{ minWidth: '90px', display: 'inline-block' }}>Nhớ:</span>
                              <span className="badge bg-primary ms-2">{topic.remember_count || 0}</span>
                            </div>
                            <div className="d-flex align-items-center">
                              <span className="small" style={{ minWidth: '90px', display: 'inline-block' }}>Hiểu:</span>
                              <span className="badge bg-info ms-2">{topic.understand_count || 0}</span>
                            </div>
                            <div className="d-flex align-items-center">
                              <span className="small" style={{ minWidth: '90px', display: 'inline-block' }}>Áp dụng:</span>
                              <span className="badge bg-success ms-2">{topic.apply_count || 0}</span>
                            </div>
                            <div className="d-flex align-items-center">
                              <span className="small" style={{ minWidth: '90px', display: 'inline-block' }}>Phân tích:</span>
                              <span className="badge bg-warning ms-2">{topic.analyze_count || 0}</span>
                            </div>
                            <div className="d-flex align-items-center">
                              <span className="small" style={{ minWidth: '90px', display: 'inline-block' }}>Đánh giá:</span>
                              <span className="badge bg-danger ms-2">{topic.evaluate_count || 0}</span>
                            </div>
                            <div className="d-flex align-items-center">
                              <span className="small" style={{ minWidth: '90px', display: 'inline-block' }}>Tạo nên:</span>
                              <span className="badge bg-dark ms-2">{topic.create_count || 0}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="action-buttons">
                            {isLMSQA() && (
                              <Button
                                variant="outline-info"
                                size="sm"
                                className="action-btn me-1"
                                onClick={() => {
                                  handleViewTopicQuestions(topic);
                                  setShowTopicManagementModal(false);
                                }}
                                title="Duyệt câu hỏi"
                              >
                                <i className="fas fa-eye"></i>
                              </Button>
                            )}
                            <Button
                              variant="outline-primary"
                              size="sm"
                              className="action-btn me-1"
                              onClick={() => {
                                handleEditTopic(topic);
                                setShowTopicManagementModal(false);
                              }}
                              title="Sửa"
                            >
                              <i className="fas fa-edit"></i>
                            </Button>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              className="action-btn"
                              onClick={() => handleDeleteTopic(topic)}
                              title="Xóa"
                            >
                              <i className="fas fa-trash"></i>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </Modal.Body>
        <Modal.Footer className="student-detail-footer">
          <Button variant="primary" className="btn-edit" onClick={handleAddTopic}>
            <i className="fas fa-plus me-2"></i>Thêm chủ đề
          </Button>
          <Button variant="secondary" className="btn-cancel" onClick={() => setShowTopicManagementModal(false)}>
            <i className="fas fa-times me-2"></i>Đóng
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Topic Form Modal - Thêm/Sửa chủ đề */}
      <Modal 
        show={showTopicModal} 
        onHide={() => {
          setShowTopicModal(false);
          setEditTopicMode(false);
          setSelectedTopic(null);
          setTopicForm({ topic_code: '', topic_name: '', description: '' });
          setTopicCodeManuallyEdited(false);
        }}
        className="session-detail-modal"
      >
        <Modal.Header closeButton className="student-detail-header">
          <Modal.Title className="student-detail-title">
            <i className={`fas ${editTopicMode ? 'fa-edit' : 'fa-plus-circle'} me-2`}></i>
            {editTopicMode ? 'Sửa chủ đề' : 'Tạo chủ đề mới'}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmitTopic}>
          <Modal.Body className="student-detail-body">
            <Form.Group className="mb-3">
              <Form.Label>Tên chủ đề *</Form.Label>
              <Form.Control
                type="text"
                className="form-control-modern"
                value={topicForm.topic_name}
                onChange={(e) => {
                  const newTopicName = e.target.value;
                  setTopicForm({ 
                    ...topicForm, 
                    topic_name: newTopicName,
                    // Auto-generate topic_code when topic_name changes (only if not in edit mode and not manually edited)
                    topic_code: editTopicMode ? topicForm.topic_code : (topicCodeManuallyEdited ? topicForm.topic_code : generateTopicCode(newTopicName))
                  });
                }}
                required
              />
              <Form.Text className="text-muted">
                Mã chủ đề sẽ được tạo tự động từ tên chủ đề
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Mã chủ đề *</Form.Label>
              <Form.Control
                type="text"
                className="form-control-modern"
                placeholder="Tự động tạo từ tên chủ đề"
                value={topicForm.topic_code}
                onChange={(e) => {
                  setTopicForm({ ...topicForm, topic_code: e.target.value.toUpperCase() });
                  setTopicCodeManuallyEdited(true);
                }}
                required
                disabled={editTopicMode}
              />
              <Form.Text className="text-muted">
                {editTopicMode 
                  ? 'Không thể thay đổi mã chủ đề' 
                  : 'Mã chủ đề được tạo tự động (12 ký tự). Bạn có thể chỉnh sửa nếu cần.'}
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Mô tả</Form.Label>
              <Form.Control
                as="textarea"
                className="form-control-modern"
                rows={3}
                value={topicForm.description}
                onChange={(e) => setTopicForm({ ...topicForm, description: e.target.value })}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer className="student-detail-footer">
            <Button variant="secondary" className="btn-cancel" onClick={() => {
              setShowTopicModal(false);
              setEditTopicMode(false);
              setSelectedTopic(null);
              setTopicForm({ topic_code: '', topic_name: '', description: '' });
              setTopicCodeManuallyEdited(false);
            }}>
              Hủy
            </Button>
            <Button variant="primary" className="btn-edit" type="submit">
              <i className={`fas ${editTopicMode ? 'fa-save' : 'fa-plus'} me-2`}></i>
              {editTopicMode ? 'Cập nhật' : 'Tạo chủ đề'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Export Modal */}
      <Modal 
        show={showExportModal} 
        onHide={() => setShowExportModal(false)} 
        size="lg"
        className="session-detail-modal"
      >
        <Modal.Header closeButton className="student-detail-header">
          <Modal.Title className="student-detail-title">
            <i className="fas fa-file-export me-2"></i>
            Export câu hỏi
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="student-detail-body">
          <Form.Group className="mb-3">
            <Form.Label>Định dạng file *</Form.Label>
            <Form.Select
              className="form-control-modern"
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
            >
              <option value="excel">Excel (.xlsx)</option>
              <option value="word">Word (.docx)</option>
              <option value="text">Text (.txt)</option>
              <option value="json">JSON (.json)</option>
            </Form.Select>
          </Form.Group>

          <hr />
          <h6 className="mb-3">Lọc dữ liệu xuất</h6>

          <div className="row">
            <div className="col-md-6">
              <Form.Group className="mb-3">
                <Form.Label>Chủ đề</Form.Label>
                <Form.Select
                  className="form-control-modern"
                  value={exportFilters.topic_id}
                  onChange={(e) => setExportFilters({ ...exportFilters, topic_id: e.target.value })}
                >
                  <option value="">Tất cả chủ đề</option>
                  {Array.isArray(topics) && topics.map((topic) => (
                    <option key={topic.topic_id} value={topic.topic_id}>
                      {topic.topic_name}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </div>
            <div className="col-md-6">
              <Form.Group className="mb-3">
                <Form.Label>Loại câu hỏi</Form.Label>
                <Form.Select
                  className="form-control-modern"
                  value={exportFilters.question_type}
                  onChange={(e) => setExportFilters({ ...exportFilters, question_type: e.target.value })}
                >
                  <option value="">Tất cả loại</option>
                  <option value="mcq">Trắc nghiệm</option>
                  <option value="multiple_response">Nhiều đáp án</option>
                  <option value="true_false">Đúng/Sai</option>
                  <option value="short_answer">Trả lời ngắn</option>
                  <option value="essay">Tự luận</option>
                </Form.Select>
              </Form.Group>
            </div>
          </div>

          <div className="row">
            <div className="col-md-6">
              <Form.Group className="mb-3">
                <Form.Label>Độ khó</Form.Label>
                <Form.Select
                  className="form-control-modern"
                  value={exportFilters.difficulty}
                  onChange={(e) => setExportFilters({ ...exportFilters, difficulty: e.target.value })}
                >
                  <option value="">Tất cả độ khó</option>
                  <option value="easy">Dễ</option>
                  <option value="medium">Trung bình</option>
                  <option value="hard">Khó</option>
                  <option value="expert">Chuyên gia</option>
                </Form.Select>
              </Form.Group>
            </div>
            <div className="col-md-6">
              <Form.Group className="mb-3">
                <Form.Label>Bloom Level</Form.Label>
                <Form.Select
                  className="form-control-modern"
                  value={exportFilters.bloom_level}
                  onChange={(e) => setExportFilters({ ...exportFilters, bloom_level: e.target.value })}
                >
                  <option value="">Tất cả Bloom Level</option>
                  <option value="remember">Remember (Nhớ)</option>
                  <option value="understand">Understand (Hiểu)</option>
                  <option value="apply">Apply (Vận dụng)</option>
                  <option value="analyze">Analyze (Phân tích)</option>
                  <option value="evaluate">Evaluate (Đánh giá)</option>
                  <option value="create">Create (Sáng tạo)</option>
                </Form.Select>
              </Form.Group>
            </div>
          </div>

          <div className="row">
            <div className="col-md-6">
              <Form.Group className="mb-3">
                <Form.Label>Điểm tối thiểu</Form.Label>
                <Form.Control
                  type="number"
                  className="form-control-modern"
                  step="0.1"
                  min="0"
                  value={exportFilters.points_min}
                  onChange={(e) => setExportFilters({ ...exportFilters, points_min: e.target.value })}
                  placeholder="Không giới hạn"
                />
              </Form.Group>
            </div>
            <div className="col-md-6">
              <Form.Group className="mb-3">
                <Form.Label>Điểm tối đa</Form.Label>
                <Form.Control
                  type="number"
                  className="form-control-modern"
                  step="0.1"
                  min="0"
                  value={exportFilters.points_max}
                  onChange={(e) => setExportFilters({ ...exportFilters, points_max: e.target.value })}
                  placeholder="Không giới hạn"
                />
              </Form.Group>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer className="student-detail-footer">
          <Button variant="secondary" className="btn-cancel" onClick={() => setShowExportModal(false)}>
            Hủy
          </Button>
          <Button variant="primary" className="btn-edit" onClick={handleExportQuestions}>
            <i className="fas fa-download me-2"></i>Export
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Bulk Edit Points Modal */}
      <Modal 
        show={showBulkEditModal} 
        onHide={() => setShowBulkEditModal(false)}
        size="lg"
        className="session-detail-modal"
      >
        <Modal.Header closeButton className="student-detail-header">
          <Modal.Title className="student-detail-title">
            <i className="fas fa-edit me-2"></i>
            Điều chỉnh điểm hàng loạt
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmitBulkEdit}>
          <Modal.Body className="student-detail-body">
            <Alert variant="info">
              <i className="fas fa-info-circle me-2"></i>
              Đang điều chỉnh điểm cho <strong className="text-primary">{getFilteredQuestionsForBulkEdit().length}</strong> câu hỏi phù hợp với bộ lọc hiện tại.
              {(() => {
                const filteredCount = getFilteredQuestionsForBulkEdit().length;
                const displayedCount = displayedQuestions.length;
                if (filteredCount > displayedCount) {
                  return (
                    <span>
                      {' '}(Hiển thị {displayedCount} câu hỏi trên trang hiện tại, nhưng sẽ cập nhật tất cả {filteredCount} câu hỏi phù hợp với bộ lọc)
                    </span>
                  );
                }
                return null;
              })()}
            </Alert>

            {/* Topic Filter - Separate from 3 columns */}
            <Form.Group className="mb-4">
              <Form.Label>
                <i className="fas fa-folder me-2"></i>
                <strong>Chủ đề</strong>
              </Form.Label>
              <Form.Select
                className="form-control-modern"
                value={bulkEditFilters.selectedTopic}
                onChange={(e) => setBulkEditFilters({ ...bulkEditFilters, selectedTopic: e.target.value })}
              >
                <option value="">Tất cả chủ đề</option>
                {Array.isArray(topics) && topics.map((topic) => {
                  // Count questions in this topic from filtered questions (all questions matching current filters, not just displayed page)
                  const count = filteredQuestions.filter(q => 
                    q.topic_id == topic.topic_id
                  ).length;
                  
                  return (
                    <option key={topic.topic_id} value={topic.topic_id}>
                      {topic.topic_name} ({count} câu)
                    </option>
                  );
                })}
              </Form.Select>
              <Form.Text className="text-muted">
                Chọn chủ đề để chỉ điều chỉnh câu hỏi thuộc chủ đề đó
              </Form.Text>
            </Form.Group>

            <hr />
            <h6 className="mb-3">
              <i className="fas fa-filter me-2"></i>
              Lọc câu hỏi cần điều chỉnh (tùy chọn)
            </h6>

            {/* 3 Column Layout for Filters */}
            <div className="row">
              {/* Question Type Filter - Column 1 */}
              <div className="col-md-4 mb-4">
                <Form.Check
                  type="switch"
                  id="enable-type-filter"
                  label={<strong>Loại câu hỏi</strong>}
                  checked={bulkEditFilters.enableTypeFilter}
                  onChange={(e) => setBulkEditFilters({ ...bulkEditFilters, enableTypeFilter: e.target.checked })}
                  className="mb-3"
                />
                
                {bulkEditFilters.enableTypeFilter && (
                  <div className="p-3 bg-light rounded" style={{ minHeight: '200px' }}>
                    {(() => {
                      const counts = getQuestionCountsByCategory();
                      const types = [
                        { value: 'mcq', label: 'Trắc nghiệm' },
                        { value: 'multiple_response', label: 'Nhiều đáp án' },
                        { value: 'true_false', label: 'Đúng/Sai' },
                        { value: 'short_answer', label: 'Trả lời ngắn' },
                        { value: 'essay', label: 'Tự luận' }
                      ];
                      
                      return types.map(type => (
                        <div key={type.value} className="d-flex align-items-center mb-2">
                          <Form.Check
                            type="checkbox"
                            id={`type-${type.value}`}
                            label={`${type.label} (${counts.types[type.value] || 0})`}
                            checked={bulkEditFilters.selectedTypes.includes(type.value)}
                            onChange={() => toggleTypeSelection(type.value)}
                            disabled={!counts.types[type.value]}
                            style={{ flex: 1 }}
                          />
                          <Form.Control
                            type="number"
                            step="0.1"
                            min="0"
                            value={categoryPoints.types[type.value]}
                            onChange={(e) => setCategoryPoints({
                              ...categoryPoints,
                              types: { ...categoryPoints.types, [type.value]: e.target.value }
                            })}
                            disabled={!bulkEditFilters.selectedTypes.includes(type.value) || !counts.types[type.value]}
                            style={{ width: '70px', marginLeft: '8px' }}
                            size="sm"
                          />
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>

              {/* Difficulty Filter - Column 2 */}
              <div className="col-md-4 mb-4">
                <Form.Check
                  type="switch"
                  id="enable-difficulty-filter"
                  label={<strong>Độ khó</strong>}
                  checked={bulkEditFilters.enableDifficultyFilter}
                  onChange={(e) => setBulkEditFilters({ ...bulkEditFilters, enableDifficultyFilter: e.target.checked })}
                  className="mb-3"
                />
                
                {bulkEditFilters.enableDifficultyFilter && (
                  <div className="p-3 bg-light rounded" style={{ minHeight: '200px' }}>
                    {(() => {
                      const counts = getQuestionCountsByCategory();
                      const difficulties = [
                        { value: 'easy', label: 'Dễ' },
                        { value: 'medium', label: 'Trung bình' },
                        { value: 'hard', label: 'Khó' },
                        { value: 'expert', label: 'Chuyên gia' }
                      ];
                      
                      return difficulties.map(diff => (
                        <div key={diff.value} className="d-flex align-items-center mb-2">
                          <Form.Check
                            type="checkbox"
                            id={`diff-${diff.value}`}
                            label={`${diff.label} (${counts.difficulties[diff.value] || 0})`}
                            checked={bulkEditFilters.selectedDifficulties.includes(diff.value)}
                            onChange={() => toggleDifficultySelection(diff.value)}
                            disabled={!counts.difficulties[diff.value]}
                            style={{ flex: 1 }}
                          />
                          <Form.Control
                            type="number"
                            step="0.1"
                            min="0"
                            value={categoryPoints.difficulties[diff.value]}
                            onChange={(e) => setCategoryPoints({
                              ...categoryPoints,
                              difficulties: { ...categoryPoints.difficulties, [diff.value]: e.target.value }
                            })}
                            disabled={!bulkEditFilters.selectedDifficulties.includes(diff.value) || !counts.difficulties[diff.value]}
                            style={{ width: '70px', marginLeft: '8px' }}
                            size="sm"
                          />
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>

              {/* Bloom Level Filter - Column 3 */}
              <div className="col-md-4 mb-4">
                <Form.Check
                  type="switch"
                  id="enable-bloom-filter"
                  label={<strong>Bloom Level</strong>}
                  checked={bulkEditFilters.enableBloomFilter}
                  onChange={(e) => setBulkEditFilters({ ...bulkEditFilters, enableBloomFilter: e.target.checked })}
                  className="mb-3"
                />
                
                {bulkEditFilters.enableBloomFilter && (
                  <div className="p-3 bg-light rounded" style={{ minHeight: '200px' }}>
                    {(() => {
                      const counts = getQuestionCountsByCategory();
                      const blooms = [
                        { value: 'remember', label: 'Remember' },
                        { value: 'understand', label: 'Understand' },
                        { value: 'apply', label: 'Apply' },
                        { value: 'analyze', label: 'Analyze' },
                        { value: 'evaluate', label: 'Evaluate' },
                        { value: 'create', label: 'Create' }
                      ];
                      
                      return blooms.map(bloom => (
                        <div key={bloom.value} className="d-flex align-items-center mb-2">
                          <Form.Check
                            type="checkbox"
                            id={`bloom-${bloom.value}`}
                            label={`${bloom.label} (${counts.blooms[bloom.value] || 0})`}
                            checked={bulkEditFilters.selectedBlooms.includes(bloom.value)}
                            onChange={() => toggleBloomSelection(bloom.value)}
                            disabled={!counts.blooms[bloom.value]}
                            style={{ flex: 1 }}
                          />
                          <Form.Control
                            type="number"
                            step="0.1"
                            min="0"
                            value={categoryPoints.blooms[bloom.value]}
                            onChange={(e) => setCategoryPoints({
                              ...categoryPoints,
                              blooms: { ...categoryPoints.blooms, [bloom.value]: e.target.value }
                            })}
                            disabled={!bulkEditFilters.selectedBlooms.includes(bloom.value) || !counts.blooms[bloom.value]}
                            style={{ width: '70px', marginLeft: '8px' }}
                            size="sm"
                          />
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>
            </div>

            <hr />

            <Form.Group className="mb-3">
              <Form.Label>Điểm mới *</Form.Label>
              <Form.Control
                type="number"
                className="form-control-modern"
                step="0.1"
                min="0"
                value={bulkPoints}
                onChange={(e) => setBulkPoints(e.target.value)}
                required
              />
              <Form.Text className="text-muted">
                {(() => {
                  const filteredCount = getFilteredQuestionsForBulkEdit().length;
                  return `Điểm này sẽ được áp dụng cho ${filteredCount} câu hỏi`;
                })()}
              </Form.Text>
            </Form.Group>

            {getFilteredQuestionsForBulkEdit().length === 0 && (
              <Alert variant="warning">
                <i className="fas fa-exclamation-triangle me-2"></i>
                Không có câu hỏi nào phù hợp với bộ lọc đã chọn!
              </Alert>
            )}
          </Modal.Body>
          <Modal.Footer className="student-detail-footer">
            <Button variant="secondary" className="btn-cancel" onClick={() => setShowBulkEditModal(false)}>
              Hủy
            </Button>
            <Button 
              variant="primary" 
              className="btn-edit" 
              type="submit"
              disabled={getFilteredQuestionsForBulkEdit().length === 0}
            >
              <i className="fas fa-save me-2"></i>
              Cập nhật điểm cho {getFilteredQuestionsForBulkEdit().length} câu hỏi
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Import Modal */}
      <Modal 
        show={showImportModal} 
        onHide={() => {
          setShowImportModal(false);
          // Reset import template options when closing
          setImportTemplateOptions({
            topic_id: '',
            topic_name: '',
            question_type: '',
            include_topic: true,
            include_type: true,
            include_difficulty: true,
            include_bloom: false,
            include_clo_plo: false,
            include_points: true
          });
          setImportFile(null);
          setTopicNameExists(false);
          setCheckingTopicName(false);
          setQuestionConditions(null);
        }} 
        size="lg"
        className="session-detail-modal"
      >
        <Modal.Header closeButton className="student-detail-header">
          <Modal.Title className="student-detail-title">
            <i className="fas fa-file-import me-2"></i>
            Import câu hỏi
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleImportQuestions}>
          <Modal.Body className="student-detail-body">
            <Form.Group className="mb-3">
              <Form.Label>Định dạng file *</Form.Label>
              <Form.Select
                className="form-control-modern"
                value={importFormat}
                onChange={(e) => setImportFormat(e.target.value)}
              >
                <option value="excel">Excel (.xlsx)</option>
                <option value="word">Word (.docx)</option>
                <option value="text">Text (.txt)</option>
              </Form.Select>
            </Form.Group>

            <hr />
            <h6 className="mb-3">Tùy chọn file mẫu</h6>

            <div className="row mb-3">
              <div className="col-md-6">
                <Form.Group className="mb-3">
                  <Form.Label>Chủ đề {isLMSStaff() && <span className="text-danger">*</span>}</Form.Label>
                  {isLMSStaff() ? (
                    <>
                      <Form.Control
                        type="text"
                        className={`form-control-modern ${topicNameExists ? 'is-invalid' : (importTemplateOptions.topic_name?.trim() && !checkingTopicName && !topicNameExists ? 'is-valid' : '')}`}
                        placeholder="Nhập tên chủ đề"
                        value={importTemplateOptions.topic_name}
                        onChange={(e) => {
                          setImportTemplateOptions({ ...importTemplateOptions, topic_name: e.target.value });
                          setTopicNameExists(false); // Reset validation state
                        }}
                        required
                        autoComplete="off"
                      />
                      {checkingTopicName && (
                        <Form.Text className="text-muted">
                          <i className="fas fa-spinner fa-spin me-1"></i>Đang kiểm tra...
                        </Form.Text>
                      )}
                      {!checkingTopicName && topicNameExists && (
                        <Form.Text className="text-danger">
                          <i className="fas fa-exclamation-circle me-1"></i>Tên chủ đề đã tồn tại. Vui lòng nhập tên khác.
                        </Form.Text>
                      )}
                      {!checkingTopicName && importTemplateOptions.topic_name?.trim() && !topicNameExists && (
                        <Form.Text className="text-success">
                          <i className="fas fa-check-circle me-1"></i>Tên chủ đề có thể sử dụng.
                        </Form.Text>
                      )}
                      {!checkingTopicName && !importTemplateOptions.topic_name?.trim() && (
                        <Form.Text className="text-muted">
                          Nhập tên chủ đề mới. File mẫu sẽ có sẵn tên chủ đề này.
                        </Form.Text>
                      )}
                    </>
                  ) : (
                    <>
                      <Form.Select
                        className="form-control-modern"
                        value={importTemplateOptions.topic_id}
                        onChange={(e) => setImportTemplateOptions({ ...importTemplateOptions, topic_id: e.target.value })}
                      >
                        <option value="">Không chọn (để trống)</option>
                        {Array.isArray(topics) && topics.map((topic) => (
                          <option key={topic.topic_id} value={topic.topic_id}>
                            {topic.topic_name}
                          </option>
                        ))}
                      </Form.Select>
                      <Form.Text className="text-muted">
                        Nếu chọn, file mẫu sẽ có sẵn chủ đề này
                      </Form.Text>
                    </>
                  )}
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group className="mb-3">
                  <Form.Label>Loại câu hỏi (điền sẵn trong file mẫu)</Form.Label>
                  <Form.Select
                    className="form-control-modern"
                    value={importTemplateOptions.question_type}
                    onChange={(e) => setImportTemplateOptions({ ...importTemplateOptions, question_type: e.target.value })}
                  >
                    <option value="">Không chọn (để trống)</option>
                    <option value="mcq">Trắc nghiệm</option>
                    <option value="multiple_response">Nhiều đáp án</option>
                    <option value="true_false">Đúng/Sai</option>
                    <option value="short_answer">Trả lời ngắn</option>
                    <option value="essay">Tự luận</option>
                  </Form.Select>
                  <Form.Text className="text-muted">
                    Nếu chọn, file mẫu sẽ có sẵn loại này
                  </Form.Text>
                </Form.Group>
              </div>
            </div>

            <div className="mb-3">
              <Form.Label className="mb-2">Chọn các mục hiển thị trong file mẫu:</Form.Label>
              <Form.Text className="text-muted d-block mb-2">
                <small>Các mục được chọn sẽ xuất hiện trong file mẫu và các ví dụ. Nếu để trống trong file, hệ thống sẽ bỏ qua hoặc sử dụng giá trị mặc định.</small>
              </Form.Text>
              <div className="row">
                <div className="col-md-6">
                  <Form.Check
                    type="checkbox"
                    label={
                      <>
                        Chủ đề
                        <i className="fas fa-info-circle ms-2 text-info" title="Có thể nhập tên chủ đề hoặc để trống. Nếu để trống, hệ thống sẽ sử dụng chủ đề mặc định."></i>
                      </>
                    }
                    checked={importTemplateOptions.include_topic}
                    onChange={(e) => setImportTemplateOptions({ ...importTemplateOptions, include_topic: e.target.checked })}
                    className="mb-2"
                  />
                  <Form.Check
                    type="checkbox"
                    label={
                      <>
                        Loại
                        <i className="fas fa-info-circle ms-2 text-info" title="mcq, multiple_response, true_false, short_answer, essay. Để trống sẽ dùng giá trị mặc định."></i>
                      </>
                    }
                    checked={importTemplateOptions.include_type}
                    onChange={(e) => setImportTemplateOptions({ ...importTemplateOptions, include_type: e.target.checked })}
                    className="mb-2"
                  />
                  <Form.Check
                    type="checkbox"
                    label={
                      <>
                        Độ khó
                        <i className="fas fa-info-circle ms-2 text-info" title="easy, medium, hard, expert. Để trống sẽ dùng giá trị mặc định."></i>
                      </>
                    }
                    checked={importTemplateOptions.include_difficulty}
                    onChange={(e) => setImportTemplateOptions({ ...importTemplateOptions, include_difficulty: e.target.checked })}
                    className="mb-2"
                  />
                </div>
                <div className="col-md-6">
                  <Form.Check
                    type="checkbox"
                    label={
                      <>
                        Bloom
                        <i className="fas fa-info-circle ms-2 text-info" title="remember, understand, apply, analyze, evaluate, create. Để trống sẽ bỏ qua không thêm."></i>
                      </>
                    }
                    checked={importTemplateOptions.include_bloom}
                    onChange={(e) => setImportTemplateOptions({ ...importTemplateOptions, include_bloom: e.target.checked })}
                    className="mb-2"
                  />
                  <Form.Check
                    type="checkbox"
                    label={
                      <>
                        CLO/PLO
                        <i className="fas fa-info-circle ms-2 text-info" title="Nhập các tag cách nhau bằng dấu phẩy (VD: CLO1, CLO2). Để trống sẽ bỏ qua không thêm."></i>
                      </>
                    }
                    checked={importTemplateOptions.include_clo_plo}
                    onChange={(e) => setImportTemplateOptions({ ...importTemplateOptions, include_clo_plo: e.target.checked })}
                    className="mb-2"
                  />
                  <Form.Check
                    type="checkbox"
                    label={
                      <>
                        Điểm
                        <i className="fas fa-info-circle ms-2 text-info" title="Nhập số điểm (VD: 1, 1.5, 2). Để trống sẽ dùng giá trị mặc định (1 điểm)."></i>
                      </>
                    }
                    checked={importTemplateOptions.include_points}
                    onChange={(e) => setImportTemplateOptions({ ...importTemplateOptions, include_points: e.target.checked })}
                    className="mb-2"
                  />
                </div>
              </div>
            </div>

            <div className="d-grid gap-2 mb-3">
              <Button 
                variant="outline-info" 
                onClick={handleDownloadTemplate}
                disabled={isLMSStaff() && (!importTemplateOptions.topic_name?.trim() || topicNameExists || checkingTopicName)}
              >
                <i className="fas fa-download me-2"></i>Tải file mẫu
              </Button>
              {isLMSStaff() && !importTemplateOptions.topic_name?.trim() && (
                <Form.Text className="text-danger text-center">
                  Vui lòng nhập tên chủ đề để tải file mẫu
                </Form.Text>
              )}
              {isLMSStaff() && importTemplateOptions.topic_name?.trim() && topicNameExists && (
                <Form.Text className="text-danger text-center">
                  Tên chủ đề đã tồn tại. Vui lòng nhập tên khác để tải file mẫu.
                </Form.Text>
              )}
            </div>

            <hr />

            <Form.Group className="mb-3">
              <Form.Label>Chọn file để import *</Form.Label>
              <Form.Control
                type="file"
                className="form-control-modern"
                accept={importFormat === 'excel' ? '.xlsx,.xls' : importFormat === 'word' ? '.docx,.doc' : '.txt'}
                onChange={(e) => setImportFile(e.target.files[0])}
                required
              />
              <Form.Text className="text-muted">
                Chọn file phù hợp với định dạng đã chọn. Nếu file có chủ đề mới, hệ thống sẽ tự động tạo chủ đề đó.
              </Form.Text>
            </Form.Group>

            {/* Display question conditions for Staff */}
            {isLMSStaff() && questionConditions && (
              <Alert variant="warning" className="mt-3">
                <strong><i className="fas fa-info-circle me-2"></i>Điều kiện nhập câu hỏi:</strong>
                {questionConditions.allowExceed === false && (
                  <div className="mt-2 mb-2">
                    <i className="fas fa-exclamation-triangle text-danger me-2"></i>
                    <strong className="text-danger">Không cho phép số lượng dư, vượt quá điều kiện</strong>
                  </div>
                )}
                {questionConditions.allowExceed === true && (
                  <div className="mt-2 mb-2">
                    <i className="fas fa-check-circle text-success me-2"></i>
                    <strong className="text-success">Cho phép số lượng dư, vượt quá điều kiện</strong>
                  </div>
                )}
                <ul className="mb-0 mt-2">
                  {questionConditions.totalQuestions !== null && (
                    <li>Tổng số câu hỏi: <strong>{questionConditions.totalQuestions}</strong></li>
                  )}
                  {questionConditions.questionTypes && Object.keys(questionConditions.questionTypes).length > 0 && (
                    <li>
                      Loại câu hỏi:
                      <ul className="mb-0 mt-1">
                        {Object.keys(questionConditions.questionTypes).map(type => {
                          const count = questionConditions.questionTypes[type];
                          if (count > 0) {
                            const typeNames = {
                              'mcq': 'Trắc nghiệm',
                              'multiple_response': 'Nhiều lựa chọn',
                              'true_false': 'Đúng/Sai',
                              'short_answer': 'Trả lời ngắn',
                              'essay': 'Tự luận',
                              'matching': 'Ghép đôi',
                              'fill_blank': 'Điền vào chỗ trống',
                              'ordering': 'Sắp xếp'
                            };
                            return (
                              <li key={type}>
                                {typeNames[type] || type}: <strong>{count}</strong>
                              </li>
                            );
                          }
                          return null;
                        })}
                      </ul>
                    </li>
                  )}
                  {questionConditions.difficulties && Object.keys(questionConditions.difficulties).length > 0 && (
                    <li>
                      Độ khó:
                      <ul className="mb-0 mt-1">
                        {Object.keys(questionConditions.difficulties).map(diff => {
                          const count = questionConditions.difficulties[diff];
                          if (count > 0) {
                            const diffNames = {
                              'easy': 'Dễ',
                              'medium': 'Trung bình',
                              'hard': 'Khó',
                              'expert': 'Rất khó'
                            };
                            return (
                              <li key={diff}>
                                {diffNames[diff] || diff}: <strong>{count}</strong>
                              </li>
                            );
                          }
                          return null;
                        })}
                      </ul>
                    </li>
                  )}
                  {questionConditions.bloomLevels && Object.keys(questionConditions.bloomLevels).length > 0 && (
                    <li>
                      Phân loại Bloom:
                      <ul className="mb-0 mt-1">
                        {Object.keys(questionConditions.bloomLevels).map(bloom => {
                          const count = questionConditions.bloomLevels[bloom];
                          if (count > 0) {
                            const bloomNames = {
                              'remember': 'Nhớ',
                              'understand': 'Hiểu',
                              'apply': 'Áp dụng',
                              'analyze': 'Phân tích',
                              'evaluate': 'Đánh giá',
                              'create': 'Sáng tạo'
                            };
                            return (
                              <li key={bloom}>
                                {bloomNames[bloom] || bloom}: <strong>{count}</strong>
                              </li>
                            );
                          }
                          return null;
                        })}
                      </ul>
                    </li>
                  )}
                </ul>
              </Alert>
            )}

            <Alert variant="info">
              <small>
                <strong>Lưu ý:</strong>
                <ul className="mb-0 mt-2">
                  <li>File phải có cột "question_text" (bắt buộc)</li>
                  <li>Nếu file có "topic_name" hoặc "topic_code" mà chưa có trong hệ thống, hệ thống sẽ tự động tạo chủ đề mới</li>
                  <li>Các cột khác là tùy chọn tùy theo checkbox đã chọn</li>
                </ul>
              </small>
            </Alert>
          </Modal.Body>
          <Modal.Footer className="student-detail-footer">
            <Button variant="secondary" className="btn-cancel" onClick={() => {
              setShowImportModal(false);
              // Reset import template options when closing
              setImportTemplateOptions({
                topic_id: '',
                topic_name: '',
                question_type: '',
                include_topic: true,
                include_type: true,
                include_difficulty: true,
                include_bloom: false,
                include_clo_plo: false,
                include_points: true
              });
              setImportFile(null);
              setTopicNameExists(false);
              setCheckingTopicName(false);
            }}>
              Hủy
            </Button>
            <Button 
              variant="primary" 
              className="btn-edit" 
              type="submit"
              disabled={isLMSStaff() && (!importTemplateOptions.topic_name?.trim() || topicNameExists || checkingTopicName)}
            >
              <i className="fas fa-upload me-2"></i>Import
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Import Progress Modal */}
      <Modal 
        show={showImportProgressModal} 
        onHide={() => {}} 
        backdrop="static"
        keyboard={false}
        centered
      >
        <Modal.Header>
          <Modal.Title>
            <i className="fas fa-spinner fa-spin me-2"></i>
            Đang xử lý file...
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="text-center">
            <ProgressBar 
              now={importProgress.current} 
              label={`${importProgress.current}%`}
              className="mb-3"
            />
            <p className="mb-0">{importProgress.message}</p>
          </div>
        </Modal.Body>
      </Modal>

      {/* Preview Imported Questions Modal */}
      <Modal 
        show={showPreviewModal} 
        onHide={() => {
          setShowPreviewModal(false);
          setPreviewedQuestions([]);
          setConditionsMet(true);
          setConditionsStatus(null);
        }} 
        size="xl"
        className="session-detail-modal"
      >
        <Modal.Header closeButton className="student-detail-header">
          <Modal.Title className="student-detail-title">
            <i className="fas fa-list-check me-2"></i>
            Xem trước và chỉnh sửa câu hỏi ({previewedQuestions.length} câu hỏi)
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="student-detail-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {previewedQuestions.length === 0 ? (
            <Alert variant="info">
              Không có câu hỏi nào để hiển thị
            </Alert>
          ) : (
            <>
              <Alert variant="warning" className="mb-3">
                <i className="fas fa-exclamation-triangle me-2"></i>
                <strong>Lưu ý:</strong> Vui lòng kiểm tra và chỉnh sửa các câu hỏi trùng lặp trước khi gửi lên.
                {previewedQuestions.filter(q => q.duplicateInFile || q.duplicateInDatabase).length > 0 && (
                  <div className="mt-2">
                    <strong>Cảnh báo:</strong> Có {previewedQuestions.filter(q => q.duplicateInFile || q.duplicateInDatabase).length} câu hỏi bị trùng lặp!
                  </div>
                )}
              </Alert>

              {/* Display question conditions status for Staff */}
              {isLMSStaff() && questionConditions && conditionsStatus && (
                <Alert variant={conditionsMet ? "success" : "danger"} className="mb-3">
                  <strong><i className={`fas ${conditionsMet ? 'fa-check-circle' : 'fa-exclamation-circle'} me-2`}></i>
                    Điều kiện nhập câu hỏi:
                  </strong>
                  <ul className="mb-0 mt-2">
                    {questionConditions.totalQuestions !== null && (
                      <li>
                        Tổng số câu hỏi: <strong>{conditionsStatus.totalQuestions.current}</strong> / <strong>{conditionsStatus.totalQuestions.required}</strong>
                        {conditionsStatus.totalQuestions.exceeded ? (
                          <i className="fas fa-exclamation-triangle text-warning ms-2" title="Vượt quá điều kiện"></i>
                        ) : conditionsStatus.totalQuestions.met ? (
                          <i className="fas fa-check text-success ms-2"></i>
                        ) : (
                          <i className="fas fa-times text-danger ms-2"></i>
                        )}
                      </li>
                    )}
                    {Object.keys(conditionsStatus.questionTypes).length > 0 || Object.keys(conditionsStatus.difficulties).length > 0 || Object.keys(conditionsStatus.bloomLevels).length > 0 ? (
                      <li>
                        <Row>
                          {Object.keys(conditionsStatus.questionTypes).length > 0 && (
                            <Col md={4}>
                              <strong>Loại câu hỏi:</strong>
                              <ul className="mb-0 mt-1">
                                {Object.keys(conditionsStatus.questionTypes).map(type => {
                                  const typeStatus = conditionsStatus.questionTypes[type];
                                  const typeNames = {
                                    'mcq': 'Trắc nghiệm',
                                    'multiple_response': 'Nhiều lựa chọn',
                                    'true_false': 'Đúng/Sai',
                                    'short_answer': 'Trả lời ngắn',
                                    'essay': 'Tự luận',
                                    'matching': 'Ghép đôi',
                                    'fill_blank': 'Điền vào chỗ trống',
                                    'ordering': 'Sắp xếp'
                                  };
                                  return (
                                    <li key={type}>
                                      {typeNames[type] || type}: <strong>{typeStatus.current}</strong> / <strong>{typeStatus.required}</strong>
                                      {typeStatus.exceeded ? (
                                        <i className="fas fa-exclamation-triangle text-warning ms-2" title="Vượt quá điều kiện"></i>
                                      ) : typeStatus.met ? (
                                        <i className="fas fa-check text-success ms-2"></i>
                                      ) : (
                                        <i className="fas fa-times text-danger ms-2"></i>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            </Col>
                          )}
                          {Object.keys(conditionsStatus.difficulties).length > 0 && (
                            <Col md={4}>
                              <strong>Độ khó:</strong>
                              <ul className="mb-0 mt-1">
                                {Object.keys(conditionsStatus.difficulties).map(diff => {
                                  const diffStatus = conditionsStatus.difficulties[diff];
                                  const diffNames = {
                                    'easy': 'Dễ',
                                    'medium': 'Trung bình',
                                    'hard': 'Khó',
                                    'expert': 'Rất khó'
                                  };
                                  return (
                                    <li key={diff}>
                                      {diffNames[diff] || diff}: <strong>{diffStatus.current}</strong> / <strong>{diffStatus.required}</strong>
                                      {diffStatus.exceeded ? (
                                        <i className="fas fa-exclamation-triangle text-warning ms-2" title="Vượt quá điều kiện"></i>
                                      ) : diffStatus.met ? (
                                        <i className="fas fa-check text-success ms-2"></i>
                                      ) : (
                                        <i className="fas fa-times text-danger ms-2"></i>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            </Col>
                          )}
                          {Object.keys(conditionsStatus.bloomLevels).length > 0 && (
                            <Col md={4}>
                              <strong>Phân loại Bloom:</strong>
                              <ul className="mb-0 mt-1">
                                {Object.keys(conditionsStatus.bloomLevels).map(bloom => {
                                  const bloomStatus = conditionsStatus.bloomLevels[bloom];
                                  const bloomNames = {
                                    'remember': 'Nhớ',
                                    'understand': 'Hiểu',
                                    'apply': 'Áp dụng',
                                    'analyze': 'Phân tích',
                                    'evaluate': 'Đánh giá',
                                    'create': 'Sáng tạo'
                                  };
                                  return (
                                    <li key={bloom}>
                                      {bloomNames[bloom] || bloom}: <strong>{bloomStatus.current}</strong> / <strong>{bloomStatus.required}</strong>
                                      {bloomStatus.exceeded ? (
                                        <i className="fas fa-exclamation-triangle text-warning ms-2" title="Vượt quá điều kiện"></i>
                                      ) : bloomStatus.met ? (
                                        <i className="fas fa-check text-success ms-2"></i>
                                      ) : (
                                        <i className="fas fa-times text-danger ms-2"></i>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            </Col>
                          )}
                        </Row>
                      </li>
                    ) : null}
                  </ul>
                  {!conditionsMet && (
                    <div className="mt-2">
                      <strong className="text-danger">
                        {questionConditions.allowExceed === false 
                          ? 'Chưa đủ điều kiện hoặc vượt quá điều kiện! Vui lòng kiểm tra và điều chỉnh số lượng câu hỏi để đáp ứng các yêu cầu trên.'
                          : 'Chưa đủ điều kiện! Vui lòng thêm câu hỏi để đáp ứng các yêu cầu trên.'}
                      </strong>
                    </div>
                  )}
                </Alert>
              )}

              <Table striped bordered hover responsive>
                <thead>
                  <tr>
                    <th style={{ width: '50px' }}>STT</th>
                    <th style={{ width: '300px' }}>Nội dung câu hỏi</th>
                    <th style={{ width: '100px' }}>Loại</th>
                    <th style={{ width: '100px' }}>Độ khó</th>
                    <th style={{ width: '80px' }}>Điểm</th>
                    <th style={{ width: '150px' }}>Trạng thái</th>
                    <th style={{ width: '120px' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Create a map to group duplicate questions together
                    const duplicateGroups = new Map();
                    const nonDuplicates = [];
                    
                    previewedQuestions.forEach(q => {
                      // Only group questions that are duplicates in file (not database duplicates)
                      if (q.duplicateInFile && q.duplicateWithIndices && q.duplicateWithIndices.length > 0) {
                        // Create a unique key for duplicate group (sorted indices)
                        const groupKey = [q.index, ...q.duplicateWithIndices].sort((a, b) => a - b).join(',');
                        if (!duplicateGroups.has(groupKey)) {
                          duplicateGroups.set(groupKey, []);
                        }
                        duplicateGroups.get(groupKey).push(q);
                      } else {
                        nonDuplicates.push(q);
                      }
                    });
                    
                    // Sort duplicate groups and combine with non-duplicates
                    const sortedGroups = Array.from(duplicateGroups.values())
                      .sort((a, b) => {
                        // Sort by first index in group
                        const aFirst = Math.min(...a.map(q => q.index));
                        const bFirst = Math.min(...b.map(q => q.index));
                        return aFirst - bFirst;
                      });
                    
                    // Within each group, sort by index
                    sortedGroups.forEach(group => {
                      group.sort((a, b) => a.index - b.index);
                    });
                    
                    // Combine: duplicates first, then non-duplicates
                    const sortedQuestions = [...sortedGroups.flat(), ...nonDuplicates.sort((a, b) => a.index - b.index)];
                    
                    return sortedQuestions.map((q, index) => {
                      const isDuplicate = q.duplicateInFile || q.duplicateInDatabase;
                      return (
                      <tr 
                        key={index} 
                        style={{ 
                          backgroundColor: isDuplicate ? '#fff3cd' : 'transparent',
                          borderLeft: isDuplicate ? '4px solid #ffc107' : 'none'
                        }}
                      >
                        <td>{q.index}</td>
                        <td>
                          <div style={{ maxHeight: '100px', overflow: 'auto' }}>
                            {q.question_text}
                          </div>
                          {isDuplicate && (
                            <div className="mt-1">
                              {q.duplicateInFile && q.duplicateTitle && (
                                <Badge bg="warning" className="me-1">
                                  {q.duplicateWithIndices && q.duplicateWithIndices.length > 0
                                    ? `⚠️ Trùng nội dung với câu ${q.duplicateWithIndices.join(', ')}`
                                    : '⚠️ Trùng nội dung trong file'}
                                </Badge>
                              )}
                              {q.duplicateInDatabase && (
                                <Badge bg="danger" className="me-1">
                                  ⚠️ Trùng trong bộ câu hỏi khác
                                </Badge>
                              )}
                            </div>
                          )}
                        </td>
                        <td>{q.question_type}</td>
                        <td>{q.difficulty_level}</td>
                        <td>{q.points}</td>
                        <td>
                          {isDuplicate ? (
                            <Badge bg="warning">Trùng lặp</Badge>
                          ) : (
                            <Badge bg="success">OK</Badge>
                          )}
                        </td>
                        <td>
                          <div className="d-flex gap-1">
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => handleEditPreviewQuestion(index)}
                              title="Chỉnh sửa"
                            >
                              <i className="fas fa-edit"></i>
                            </Button>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => handleDeletePreviewQuestion(index)}
                              title="Xóa"
                            >
                              <i className="fas fa-trash"></i>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  });
                  })()}
                </tbody>
              </Table>
            </>
          )}
        </Modal.Body>
        <Modal.Footer className="student-detail-footer">
          <Button 
            variant="secondary" 
            className="btn-cancel" 
            onClick={() => {
              setShowPreviewModal(false);
              setPreviewedQuestions([]);
            }}
          >
            Hủy
          </Button>
          <Button 
            variant="primary" 
            className="btn-edit" 
            onClick={handleSubmitImportedQuestions}
            disabled={previewedQuestions.length === 0 || (isLMSStaff() && !conditionsMet)}
            title={isLMSStaff() && !conditionsMet ? 'Chưa đủ điều kiện nhập câu hỏi' : ''}
          >
            <i className="fas fa-paper-plane me-2"></i>
            Gửi lên và đợi duyệt ({previewedQuestions.length} câu hỏi)
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Edit Preview Question Modal */}
      <Modal 
        show={editingQuestion !== null} 
        onHide={() => {
          setEditingQuestion(null);
          setEditingQuestionIndex(null);
        }} 
        size="lg"
        className="session-detail-modal"
      >
        <Modal.Header closeButton className="student-detail-header">
          <Modal.Title className="student-detail-title">
            <i className="fas fa-edit me-2"></i>
            Chỉnh sửa câu hỏi
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="student-detail-body">
          {editingQuestion && (
            <>
              <Form.Group className="mb-3">
                <Form.Label>Nội dung câu hỏi *</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={editingQuestion.question_text || ''}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, question_text: e.target.value })}
                />
              </Form.Group>

              <div className="row">
                <div className="col-md-4">
                  <Form.Group className="mb-3">
                    <Form.Label>Loại câu hỏi</Form.Label>
                    <Form.Select
                      value={editingQuestion.question_type || 'mcq'}
                      onChange={(e) => setEditingQuestion({ ...editingQuestion, question_type: e.target.value })}
                    >
                      <option value="mcq">Trắc nghiệm</option>
                      <option value="multiple_response">Nhiều đáp án</option>
                      <option value="true_false">Đúng/Sai</option>
                      <option value="short_answer">Trả lời ngắn</option>
                      <option value="essay">Tự luận</option>
                    </Form.Select>
                  </Form.Group>
                </div>
                <div className="col-md-4">
                  <Form.Group className="mb-3">
                    <Form.Label>Độ khó</Form.Label>
                    <Form.Select
                      value={editingQuestion.difficulty_level || editingQuestion.difficulty || 'medium'}
                      onChange={(e) => setEditingQuestion({ ...editingQuestion, difficulty_level: e.target.value })}
                    >
                      <option value="easy">Dễ</option>
                      <option value="medium">Trung bình</option>
                      <option value="hard">Khó</option>
                      <option value="expert">Rất khó</option>
                    </Form.Select>
                  </Form.Group>
                </div>
                <div className="col-md-4">
                  <Form.Group className="mb-3">
                    <Form.Label>Điểm</Form.Label>
                    <Form.Control
                      type="number"
                      step="0.1"
                      min="0"
                      value={editingQuestion.points || 1}
                      onChange={(e) => setEditingQuestion({ ...editingQuestion, points: parseFloat(e.target.value) || 1 })}
                    />
                  </Form.Group>
                </div>
              </div>

              {editingQuestion.options && editingQuestion.options.length > 0 && (
                <Form.Group className="mb-3">
                  <Form.Label>Đáp án</Form.Label>
                  {editingQuestion.options.map((opt, optIndex) => (
                    <div key={optIndex} className="d-flex align-items-center mb-2">
                      <Form.Check
                        type="checkbox"
                        checked={opt.is_correct || false}
                        onChange={(e) => {
                          const newOptions = [...editingQuestion.options];
                          newOptions[optIndex].is_correct = e.target.checked;
                          setEditingQuestion({ ...editingQuestion, options: newOptions });
                        }}
                        className="me-2"
                      />
                      <Form.Control
                        value={opt.option_text || opt.text || ''}
                        onChange={(e) => {
                          const newOptions = [...editingQuestion.options];
                          newOptions[optIndex].option_text = e.target.value;
                          setEditingQuestion({ ...editingQuestion, options: newOptions });
                        }}
                        placeholder={`Đáp án ${optIndex + 1}`}
                      />
                    </div>
                  ))}
                </Form.Group>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer className="student-detail-footer">
          <Button 
            variant="secondary" 
            className="btn-cancel" 
            onClick={() => {
              setEditingQuestion(null);
              setEditingQuestionIndex(null);
            }}
          >
            Hủy
          </Button>
          <Button 
            variant="primary" 
            className="btn-edit" 
            onClick={handleSaveEditedQuestion}
          >
            <i className="fas fa-save me-2"></i>
            Lưu
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Topic Questions Modal - Hiển thị câu hỏi trong chủ đề */}
      <Modal 
        show={showTopicQuestionsModal} 
        onHide={() => {
          setShowTopicQuestionsModal(false);
          setSelectedTopicForView(null);
          setTopicQuestions([]);
        }} 
        size="xl"
        className="session-detail-modal"
      >
        <Modal.Header closeButton className="student-detail-header">
          <Modal.Title className="student-detail-title">
            <i className="fas fa-list me-2"></i>
            Câu hỏi trong chủ đề: {selectedTopicForView?.topic_name || 'N/A'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="student-detail-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {loadingTopicQuestions ? (
            <div className="text-center p-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Đang tải...</span>
              </div>
            </div>
          ) : topicQuestions.length === 0 ? (
            <Alert variant="info">
              Chưa có câu hỏi nào trong chủ đề này.
            </Alert>
          ) : (
            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  <th style={{ width: '50px' }}>ID</th>
                  <th>Nội dung câu hỏi</th>
                  <th style={{ width: '100px' }}>Loại</th>
                  <th style={{ width: '100px' }}>Độ khó</th>
                  <th style={{ width: '80px' }}>Điểm</th>
                  <th style={{ width: '120px' }}>Trạng thái</th>
                  {(isLMSQA() || isLMSMod() || (isLMSStaff() && !isLMSQA() && !isLMSMod())) && (
                    <th style={{ width: '150px' }}>Thao tác</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {topicQuestions.map((q) => {
                  const hasError = q.has_error === true || q.has_error === 1;
                  const isExcluded = q.is_excluded === true || q.is_excluded === 1;
                  const rowStyle = hasError 
                    ? { backgroundColor: 'rgba(220, 53, 69, 0.08)' } 
                    : isExcluded 
                      ? { backgroundColor: 'rgba(108, 117, 125, 0.08)', opacity: 0.7 } 
                      : {};
                  
                  return (
                  <React.Fragment key={q.question_id}>
                    <tr 
                      style={{ ...rowStyle, cursor: 'pointer' }}
                      onClick={(e) => {
                        // Chỉ mở modal nếu click vào dòng, không phải vào các nút
                        if (e.target.closest('button') || e.target.closest('a') || e.target.closest('.d-flex.gap-1')) {
                          return;
                        }
                        handleEditQuestion(q);
                        setShowTopicQuestionsModal(false);
                      }}
                    >
                      <td>
                        <span className="badge bg-secondary">Q-{q.question_id}</span>
                      </td>
                      <td>
                        <div style={{ maxWidth: '600px' }}>
                          {q.question_text ? (
                            <div className="mb-2">
                              {q.question_html ? (
                                <div dangerouslySetInnerHTML={{ __html: q.question_html }} />
                              ) : (
                                <div>{q.question_text}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted">N/A</span>
                          )}
                          
                          {/* Display Options */}
                          {q.options && Array.isArray(q.options) && q.options.length > 0 && (
                            <div className="mt-3">
                              <div className="mb-2">
                                <strong className="text-muted small">
                                  <i className="fas fa-list-ul me-1"></i>
                                  Các phương án:
                                </strong>
                              </div>
                              <div className="ps-3">
                                {q.options.map((option, idx) => {
                                  const isCorrect = option.is_correct === true || option.is_correct === 1;
                                  const isCorrectVisible = option.is_correct !== null && option.is_correct !== undefined;
                                  
                                  return (
                                    <div 
                                      key={option.option_id || idx} 
                                      className={`mb-2 p-2 rounded ${isCorrect ? 'bg-success bg-opacity-10 border border-success' : 'bg-light'}`}
                                      style={{ fontSize: '14px' }}
                                    >
                                      <div className="d-flex align-items-start">
                                        <span className="me-2 fw-bold">
                                          {String.fromCharCode(65 + idx)}.
                                        </span>
                                        <div className="flex-grow-1">
                                          {option.option_text || option.option_html ? (
                                            option.option_html ? (
                                              <span dangerouslySetInnerHTML={{ __html: option.option_html }} />
                                            ) : (
                                              <span>{option.option_text}</span>
                                            )
                                          ) : (
                                            <span className="text-muted">N/A</span>
                                          )}
                                        </div>
                                        {isCorrectVisible && isCorrect && (
                                          <Badge bg="success" className="ms-2">
                                            <i className="fas fa-check me-1" title="Đáp án đúng"></i>
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          
                          {/* Show message if no options for MCQ/Multiple Response/True False */}
                          {(!q.options || !Array.isArray(q.options) || q.options.length === 0) && 
                           (q.question_type === 'mcq' || q.question_type === 'multiple_response' || q.question_type === 'true_false') && (
                            <div className="mt-2">
                              <small className="text-muted">
                                <i className="fas fa-info-circle me-1"></i>
                                Chưa có phương án trả lời
                              </small>
                            </div>
                          )}
                          
                          {/* Display rejection reason for staff if question is rejected */}
                          {isLMSStaff() && !isLMSQA() && !isLMSMod() && q.approval_status === 'rejected' && (
                            <div className="mt-3">
                              <Alert variant="danger" className="mb-0">
                                <div className="d-flex align-items-start">
                                  <i className="fas fa-exclamation-triangle me-2 mt-1"></i>
                                  <div className="flex-grow-1">
                                    <strong>Trạng thái: Câu hỏi đã bị từ chối</strong>
                                    {q.rejection_reason && (
                                      <div className="mt-2">
                                        <strong>Lý do từ chối:</strong> {q.rejection_reason}
                                      </div>
                                    )}
                                    {!q.rejection_reason && (
                                      <div className="mt-2 text-muted">
                                        <i className="fas fa-info-circle me-1"></i>
                                        Không có lý do từ chối được cung cấp.
                                      </div>
                                    )}
                                    {(q.rejection_count >= 1 || q.rejection_count === 1) && (
                                      <div className="mt-2">
                                        <Badge bg="warning">
                                          <i className="fas fa-exclamation-circle me-1"></i>
                                          Đã bị từ chối {q.rejection_count || 1} lần. Nếu bị từ chối lần nữa, câu hỏi sẽ bị xóa.
                                        </Badge>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </Alert>
                            </div>
                          )}
                        </div>
                      </td>
                      <td>{getTypeBadge(q.question_type)}</td>
                      <td>{getDifficultyBadge(q.difficulty || q.difficulty_level)}</td>
                      <td>
                        <Badge bg="primary">{q.points || 1}</Badge>
                      </td>
                      <td>
                        <div className="d-flex flex-column gap-1">
                          {q.approval_status === 'pending' && (
                            <Badge bg="warning">Chờ duyệt</Badge>
                          )}
                          {q.approval_status === 'approved' && (
                            <Badge bg="success">Đã duyệt</Badge>
                          )}
                          {q.approval_status === 'rejected' && (
                            <Badge bg="danger">Từ chối</Badge>
                          )}
                          {(isLMSQA() || isLMSMod() || isLMSStaff()) && q.is_duplicate && q.duplicate_info && q.duplicate_info.length > 0 && (
                            <Badge bg="warning" title={q.duplicate_info.map(d => 
                              `Chủ đề: ${d.topic_name || 'N/A'} (${d.topic_code || 'N/A'}), Mã: Q-${d.question_id}`
                            ).join('; ')}>
                              ⚠️ Trùng lặp
                            </Badge>
                          )}
                          {(q.has_error === true || q.has_error === 1) && (
                            <Badge bg="danger" title="Câu hỏi này đã được đánh dấu có lỗi">
                              ❌ Lỗi
                            </Badge>
                          )}
                          {(q.is_excluded === true || q.is_excluded === 1) && (
                            <Badge bg="secondary" title="Câu hỏi này đã bị loại trừ khỏi đề thi">
                              🚫 Loại trừ
                            </Badge>
                          )}
                        </div>
                        {(isLMSQA() || isLMSMod()) && q.is_duplicate && q.duplicate_info && q.duplicate_info.length > 0 && (
                          <div className="mt-1 small text-muted">
                            {q.duplicate_info.map((d, idx) => (
                              <div key={idx} className="small">
                                Trùng: {d.topic_name || 'N/A'} ({d.topic_code || 'N/A'}), Q-{d.question_id}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      {(isLMSQA() || isLMSMod() || (isLMSStaff() && !isLMSQA() && !isLMSMod())) && (
                        <td>
                          <div className="d-flex gap-1">
                            {/* QA/Mod actions for pending questions */}
                            {(isLMSQA() || isLMSMod()) && q.approval_status === 'pending' && (
                              <>
                                <Button
                                  variant="outline-success"
                                  size="sm"
                                  onClick={() => handleApproveQuestion(q.question_id)}
                                  title="Duyệt"
                                >
                                  <i className="fas fa-check"></i>
                                </Button>
                                <Button
                                  variant="outline-danger"
                                  size="sm"
                                  onClick={() => handleRejectQuestion(q.question_id)}
                                  title="Từ chối"
                                >
                                  <i className="fas fa-times"></i>
                                </Button>
                              </>
                            )}
                            {/* QA actions - toggle error and exclude flags */}
                            {isLMSQA() && (
                              <>
                                <Button
                                  variant={(q.has_error === true || q.has_error === 1) ? "danger" : "outline-danger"}
                                  size="sm"
                                  onClick={() => handleToggleQuestionError(q.question_id)}
                                  title={(q.has_error === true || q.has_error === 1) ? "Bỏ đánh dấu lỗi" : "Đánh dấu có lỗi"}
                                >
                                  <i className="fas fa-exclamation-triangle"></i>
                                </Button>
                                <Button
                                  variant={(q.is_excluded === true || q.is_excluded === 1) ? "secondary" : "outline-secondary"}
                                  size="sm"
                                  onClick={() => handleToggleQuestionExclude(q.question_id)}
                                  title={(q.is_excluded === true || q.is_excluded === 1) ? "Bỏ đánh dấu loại trừ" : "Đánh dấu loại trừ"}
                                >
                                  <i className="fas fa-ban"></i>
                                </Button>
                                {q.approval_status === 'approved' && (
                                  <Button
                                    variant="outline-info"
                                    size="sm"
                                    onClick={() => handleViewQuestionContent(q)}
                                    title="Xem nội dung"
                                  >
                                    <i className="fas fa-eye"></i>
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  </React.Fragment>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Modal.Body>
        <Modal.Footer className="student-detail-footer">
          <div className="d-flex justify-content-between w-100 align-items-center">
            <div>
              {(isLMSMod() || isLMSQA()) && topicQuestions.filter(q => q.approval_status === 'pending').length > 0 && (
                <>
                  <Button 
                    variant="success" 
                    className="me-2" 
                    onClick={handleApproveAllClick}
                  >
                    <i className="fas fa-check-double me-2"></i>
                    Duyệt tất cả ({topicQuestions.filter(q => q.approval_status === 'pending').length})
                  </Button>
                  <Button 
                    variant="danger" 
                    onClick={handleRejectAllClick}
                  >
                    <i className="fas fa-times-circle me-2"></i>
                    Từ chối tất cả ({topicQuestions.filter(q => q.approval_status === 'pending').length})
                  </Button>
                </>
              )}
            </div>
            <Button 
              variant="secondary" 
              className="btn-cancel" 
              onClick={() => {
                setShowTopicQuestionsModal(false);
                setSelectedTopicForView(null);
                setTopicQuestions([]);
              }}
            >
              Đóng
            </Button>
          </div>
        </Modal.Footer>
      </Modal>

      {/* Delete Topic Confirmation Modal */}
      <Modal
        show={showDeleteTopicConfirmModal}
        onHide={() => {
          setShowDeleteTopicConfirmModal(false);
          setSelectedTopicForDelete(null);
          setTopicQuestionsForDelete([]);
        }}
        size="lg"
        centered
      >
        <Modal.Header closeButton className="bg-danger text-white">
          <Modal.Title>
            <i className="fas fa-exclamation-triangle me-2"></i>
            Xác nhận xóa chủ đề
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedTopicForDelete && (
            <>
              <Alert variant="danger" className="mb-3">
                <strong>Cảnh báo:</strong> Bạn đang xóa chủ đề <strong>"{selectedTopicForDelete.topic_name}"</strong>.
                {topicQuestionsForDelete.length > 0 && (
                  <div className="mt-2">
                    Hành động này sẽ xóa <strong>{topicQuestionsForDelete.length} câu hỏi</strong> trong chủ đề này và không thể hoàn tác!
                  </div>
                )}
              </Alert>

              {loadingTopicQuestionsForDelete ? (
                <div className="text-center py-3">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Đang tải...</span>
                  </div>
                  <p className="mt-2">Đang tải danh sách câu hỏi...</p>
                </div>
              ) : topicQuestionsForDelete.length > 0 ? (
                <>
                  <h6 className="mb-3">
                    <i className="fas fa-list me-2"></i>
                    Danh sách câu hỏi sẽ bị xóa ({topicQuestionsForDelete.length} câu):
                  </h6>
                  <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    <Table striped bordered hover size="sm">
                      <thead>
                        <tr>
                          <th style={{ width: '50px' }}>STT</th>
                          <th>Nội dung câu hỏi</th>
                          <th style={{ width: '100px' }}>Loại</th>
                          <th style={{ width: '100px' }}>Độ khó</th>
                          <th style={{ width: '100px' }}>Bloom</th>
                          <th style={{ width: '80px' }}>Điểm</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topicQuestionsForDelete.map((question, index) => (
                          <tr key={question.question_id}>
                            <td>{index + 1}</td>
                            <td>
                              <div style={{ maxHeight: '60px', overflow: 'auto', fontSize: '0.9em' }}>
                                {question.question_text || 'N/A'}
                              </div>
                            </td>
                            <td>
                              <Badge bg="info">{question.question_type || 'N/A'}</Badge>
                            </td>
                            <td>
                              <Badge bg="secondary">{question.difficulty_level || 'N/A'}</Badge>
                            </td>
                            <td>
                              {question.bloom_level ? (
                                <Badge bg="primary">{question.bloom_level}</Badge>
                              ) : (
                                <span className="text-muted">-</span>
                              )}
                            </td>
                            <td>{question.points || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </>
              ) : (
                <p className="text-muted">Chủ đề này không có câu hỏi nào.</p>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => {
              setShowDeleteTopicConfirmModal(false);
              setSelectedTopicForDelete(null);
              setTopicQuestionsForDelete([]);
            }}
          >
            <i className="fas fa-times me-2"></i>Hủy
          </Button>
          <Button variant="danger" onClick={confirmDeleteTopic}>
            <i className="fas fa-trash me-2"></i>
            Xác nhận xóa{selectedTopicForDelete && topicQuestionsForDelete.length > 0 ? ` (${topicQuestionsForDelete.length} câu hỏi)` : ''}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Approve All Questions Confirmation Modal */}
      <Modal
        show={showApproveAllModal}
        onHide={() => setShowApproveAllModal(false)}
        size="md"
        className="student-detail-modal"
        centered
      >
        <Modal.Header closeButton className="student-detail-header">
          <Modal.Title className="student-detail-title">
            <div className="student-avatar">
              <i className="fas fa-check-double text-success"></i>
            </div>
            <div>
              <h4 className="mb-0">Xác nhận duyệt tất cả</h4>
              <p className="mb-0 student-subtitle">Bạn có chắc chắn muốn duyệt tất cả câu hỏi đang chờ duyệt trong chủ đề này?</p>
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="student-detail-body">
          <div className="student-detail-container">
            {selectedTopicForView && (
              <>
                <div className="alert alert-info" role="alert">
                  <i className="fas fa-info-circle me-2"></i>
                  <strong>Lưu ý:</strong> Hành động này sẽ duyệt tất cả các câu hỏi đang chờ duyệt trong chủ đề này.
                  Vui lòng đảm bảo bạn đã kiểm tra kỹ các câu hỏi trước khi tiếp tục.
                </div>
                <div className="session-card">
                  <div className="card-header-modern">
                    <div className="header-icon">
                      <i className="fas fa-info-circle"></i>
                    </div>
                    <h6 className="mb-0">Thông tin duyệt câu hỏi</h6>
                  </div>
                  <div className="card-body-modern">
                    <div className="info-item">
                      <div className="info-label">
                        <i className="fas fa-book me-2"></i>
                        Chủ đề
                      </div>
                      <div className="info-value">
                        <Badge bg="primary" className="fs-6">
                          {selectedTopicForView.topic_name}
                        </Badge>
                      </div>
                    </div>
                    <div className="info-item">
                      <div className="info-label">
                        <i className="fas fa-question-circle me-2"></i>
                        Số lượng câu hỏi sẽ duyệt
                      </div>
                      <div className="info-value">
                        <Badge bg="success" className="fs-6">
                          {topicQuestions.filter(q => q.approval_status === 'pending').length} câu hỏi
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer className="student-detail-footer">
          <Button variant="outline-secondary" onClick={() => setShowApproveAllModal(false)} className="btn-cancel">
            <i className="fas fa-times me-2"></i>
            Hủy
          </Button>
          <Button variant="success" onClick={handleConfirmApproveAll} className="btn-edit">
            <i className="fas fa-check me-2"></i>
            Xác nhận duyệt tất cả
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Reject All Questions Modal */}
      <Modal
        show={showRejectAllModal}
        onHide={() => {
          setShowRejectAllModal(false);
          setRejectAllReason('');
        }}
        size="md"
        className="student-detail-modal"
        centered
      >
        <Modal.Header closeButton className="student-detail-header">
          <Modal.Title className="student-detail-title">
            <div className="student-avatar">
              <i className="fas fa-times-circle text-danger"></i>
            </div>
            <div>
              <h4 className="mb-0">Từ chối tất cả câu hỏi</h4>
              <p className="mb-0 student-subtitle">Nhập lý do từ chối cho tất cả câu hỏi đang chờ duyệt (tùy chọn)</p>
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="student-detail-body">
          <div className="student-detail-container">
            {selectedTopicForView && (
              <>
                <div className="alert alert-warning" role="alert">
                  <i className="fas fa-exclamation-triangle me-2"></i>
                  <strong>Lưu ý:</strong> Hành động này sẽ từ chối tất cả các câu hỏi đang chờ duyệt trong chủ đề này.
                  Vui lòng đảm bảo bạn đã kiểm tra kỹ các câu hỏi trước khi tiếp tục.
                </div>
                <div className="session-card">
                  <div className="card-header-modern">
                    <div className="header-icon">
                      <i className="fas fa-info-circle"></i>
                    </div>
                    <h6 className="mb-0">Thông tin từ chối câu hỏi</h6>
                  </div>
                  <div className="card-body-modern">
                    <div className="info-item">
                      <div className="info-label">
                        <i className="fas fa-book me-2"></i>
                        Chủ đề
                      </div>
                      <div className="info-value">
                        <Badge bg="primary" className="fs-6">
                          {selectedTopicForView.topic_name}
                        </Badge>
                      </div>
                    </div>
                    <div className="info-item">
                      <div className="info-label">
                        <i className="fas fa-question-circle me-2"></i>
                        Số lượng câu hỏi sẽ từ chối
                      </div>
                      <div className="info-value">
                        <Badge bg="danger" className="fs-6">
                          {topicQuestions.filter(q => q.approval_status === 'pending').length} câu hỏi
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="session-card mt-3">
                  <div className="card-header-modern">
                    <div className="header-icon">
                      <i className="fas fa-comment-alt"></i>
                    </div>
                    <h6 className="mb-0">Lý do từ chối</h6>
                  </div>
                  <div className="card-body-modern">
                    <Form.Group>
                      <Form.Control
                        as="textarea"
                        rows={4}
                        placeholder="Nhập lý do từ chối (có thể để trống)..."
                        value={rejectAllReason}
                        onChange={(e) => setRejectAllReason(e.target.value)}
                        className="form-control-modern"
                      />
                      <Form.Text className="text-muted mt-2">
                        <i className="fas fa-info-circle me-1"></i>
                        Lý do từ chối sẽ được áp dụng cho tất cả {topicQuestions.filter(q => q.approval_status === 'pending').length} câu hỏi đang chờ duyệt.
                      </Form.Text>
                    </Form.Group>
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
              setShowRejectAllModal(false);
              setRejectAllReason('');
            }}
            className="btn-cancel"
          >
            <i className="fas fa-times me-2"></i>
            Hủy
          </Button>
          <Button variant="danger" onClick={handleConfirmRejectAll} className="btn-edit">
            <i className="fas fa-times-circle me-2"></i>
            Xác nhận từ chối tất cả
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Approve Single Question Modal */}
      <Modal
        show={showApproveQuestionModal}
        onHide={() => {
          setShowApproveQuestionModal(false);
          setQuestionToApprove(null);
        }}
        size="md"
        className="student-detail-modal"
        centered
      >
        <Modal.Header closeButton className="student-detail-header">
          <Modal.Title className="student-detail-title">
            <div className="student-avatar">
              <i className="fas fa-check text-success"></i>
            </div>
            <div>
              <h4 className="mb-0">Xác nhận duyệt câu hỏi</h4>
              <p className="mb-0 student-subtitle">Bạn có chắc chắn muốn duyệt câu hỏi này?</p>
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="student-detail-body">
          <div className="student-detail-container">
            {questionToApprove && (
              <>
                <div className="alert alert-info" role="alert">
                  <i className="fas fa-info-circle me-2"></i>
                  <strong>Lưu ý:</strong> Hành động này sẽ duyệt câu hỏi này.
                  Vui lòng đảm bảo bạn đã kiểm tra kỹ câu hỏi trước khi tiếp tục.
                </div>
                <div className="session-card">
                  <div className="card-header-modern">
                    <div className="header-icon">
                      <i className="fas fa-info-circle"></i>
                    </div>
                    <h6 className="mb-0">Thông tin câu hỏi</h6>
                  </div>
                  <div className="card-body-modern">
                    <div className="info-item">
                      <div className="info-label">
                        <i className="fas fa-question-circle me-2"></i>
                        Nội dung câu hỏi
                      </div>
                      <div className="info-value">
                        <div style={{ maxWidth: '100%', wordWrap: 'break-word' }}>
                          {questionToApprove.question_html ? (
                            <div dangerouslySetInnerHTML={{ __html: questionToApprove.question_html }} />
                          ) : (
                            <div>{questionToApprove.question_text || 'N/A'}</div>
                          )}
                        </div>
                      </div>
                    </div>
                    {selectedTopicForView && (
                      <div className="info-item">
                        <div className="info-label">
                          <i className="fas fa-book me-2"></i>
                          Chủ đề
                        </div>
                        <div className="info-value">
                          <Badge bg="primary" className="fs-6">
                            {selectedTopicForView.topic_name}
                          </Badge>
                        </div>
                      </div>
                    )}
                    <div className="info-item">
                      <div className="info-label">
                        <i className="fas fa-tag me-2"></i>
                        Loại câu hỏi
                      </div>
                      <div className="info-value">
                        {getTypeBadge(questionToApprove.question_type)}
                      </div>
                    </div>
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
              setShowApproveQuestionModal(false);
              setQuestionToApprove(null);
            }}
            className="btn-cancel"
          >
            <i className="fas fa-times me-2"></i>
            Hủy
          </Button>
          <Button 
            variant="success" 
            onClick={handleConfirmApproveQuestion}
            className="btn-edit"
          >
            <i className="fas fa-check me-2"></i>
            Xác nhận duyệt
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Reject Single Question Modal */}
      <Modal
        show={showRejectQuestionModal}
        onHide={() => {
          setShowRejectQuestionModal(false);
          setQuestionToReject(null);
          setRejectQuestionReason('');
        }}
        size="md"
        className="student-detail-modal"
        centered
      >
        <Modal.Header closeButton className="student-detail-header">
          <Modal.Title className="student-detail-title">
            <div className="student-avatar">
              <i className="fas fa-times-circle text-danger"></i>
            </div>
            <div>
              <h4 className="mb-0">Từ chối câu hỏi</h4>
              <p className="mb-0 student-subtitle">Nhập lý do từ chối (tùy chọn)</p>
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="student-detail-body">
          <div className="student-detail-container">
            {questionToReject && (
              <>
                <div className="alert alert-warning" role="alert">
                  <i className="fas fa-exclamation-triangle me-2"></i>
                  <strong>Lưu ý:</strong> Hành động này sẽ từ chối câu hỏi này.
                  Vui lòng đảm bảo bạn đã kiểm tra kỹ câu hỏi trước khi tiếp tục.
                </div>
                <div className="session-card">
                  <div className="card-header-modern">
                    <div className="header-icon">
                      <i className="fas fa-info-circle"></i>
                    </div>
                    <h6 className="mb-0">Thông tin câu hỏi</h6>
                  </div>
                  <div className="card-body-modern">
                    <div className="info-item">
                      <div className="info-label">
                        <i className="fas fa-question-circle me-2"></i>
                        Nội dung câu hỏi
                      </div>
                      <div className="info-value">
                        <div style={{ maxWidth: '100%', wordWrap: 'break-word' }}>
                          {questionToReject.question_html ? (
                            <div dangerouslySetInnerHTML={{ __html: questionToReject.question_html }} />
                          ) : (
                            <div>{questionToReject.question_text || 'N/A'}</div>
                          )}
                        </div>
                      </div>
                    </div>
                    {selectedTopicForView && (
                      <div className="info-item">
                        <div className="info-label">
                          <i className="fas fa-book me-2"></i>
                          Chủ đề
                        </div>
                        <div className="info-value">
                          <Badge bg="primary" className="fs-6">
                            {selectedTopicForView.topic_name}
                          </Badge>
                        </div>
                      </div>
                    )}
                    <div className="info-item">
                      <div className="info-label">
                        <i className="fas fa-tag me-2"></i>
                        Loại câu hỏi
                      </div>
                      <div className="info-value">
                        {getTypeBadge(questionToReject.question_type)}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="session-card mt-3">
                  <div className="card-header-modern">
                    <div className="header-icon">
                      <i className="fas fa-comment-alt"></i>
                    </div>
                    <h6 className="mb-0">Lý do từ chối</h6>
                  </div>
                  <div className="card-body-modern">
                    <Form.Group>
                      <Form.Control
                        as="textarea"
                        rows={4}
                        placeholder="Nhập lý do từ chối (có thể để trống)..."
                        value={rejectQuestionReason}
                        onChange={(e) => setRejectQuestionReason(e.target.value)}
                        className="form-control-modern"
                      />
                      <Form.Text className="text-muted mt-2">
                        <i className="fas fa-info-circle me-1"></i>
                        Lý do từ chối sẽ được lưu cùng với câu hỏi.
                      </Form.Text>
                    </Form.Group>
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
              setShowRejectQuestionModal(false);
              setQuestionToReject(null);
              setRejectQuestionReason('');
            }}
            className="btn-cancel"
          >
            <i className="fas fa-times me-2"></i>
            Hủy
          </Button>
          <Button 
            variant="danger" 
            onClick={handleConfirmRejectQuestion}
            className="btn-edit"
          >
            <i className="fas fa-times-circle me-2"></i>
            Xác nhận từ chối
          </Button>
        </Modal.Footer>
      </Modal>

    </div>
  );
};

export default QuestionBank;
