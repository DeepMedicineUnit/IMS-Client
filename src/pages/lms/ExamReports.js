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

import { Row, Col, Card, Table, Button, Badge, Tabs, Tab, Spinner, Alert, Modal, ProgressBar, Form } from 'react-bootstrap';
import { Doughnut, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import api, { getApiBaseURL } from '../../utils/api';
import Pagination from '../../components/Pagination';
import usePageTitle from '../../hooks/usePageTitle';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import '../../styles/user.css';

// Register Chart.js components
ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// Lưu trạng thái tab + breadcrumb (Kết quả thi) khi reload
const LS_EXAM_REPORTS_ACTIVE_TAB = 'lms_exam_reports_active_tab';
const LS_EXAM_REPORTS_RESULTS_VIEW = 'lms_exam_reports_results_view';
const LS_EXAM_REPORTS_PERIOD_ID = 'lms_exam_reports_period_id';
const LS_EXAM_REPORTS_PERIOD_NAME = 'lms_exam_reports_period_name';
const LS_EXAM_REPORTS_DEPARTMENT = 'lms_exam_reports_department';
const LS_EXAM_REPORTS_EXAM_ID = 'lms_exam_reports_exam_id';
const LS_EXAM_REPORTS_EXAM_TITLE = 'lms_exam_reports_exam_title';

function loadExamReportsNavPersistence() {
    try {
        const activeTab = localStorage.getItem(LS_EXAM_REPORTS_ACTIVE_TAB) || 'exam-statistics';
        const view = localStorage.getItem(LS_EXAM_REPORTS_RESULTS_VIEW) || 'periods';
        const pidRaw = localStorage.getItem(LS_EXAM_REPORTS_PERIOD_ID);
        const periodId = pidRaw ? parseInt(pidRaw, 10) : null;
        const periodName = localStorage.getItem(LS_EXAM_REPORTS_PERIOD_NAME) || '';
        const dept = localStorage.getItem(LS_EXAM_REPORTS_DEPARTMENT) || null;
        const eidRaw = localStorage.getItem(LS_EXAM_REPORTS_EXAM_ID);
        const examId = eidRaw ? parseInt(eidRaw, 10) : null;
        const examTitle = localStorage.getItem(LS_EXAM_REPORTS_EXAM_TITLE) || '';

        const selectedPeriod = periodId && !Number.isNaN(periodId) ? { exam_period_id: periodId, period_name: periodName } : null;
        const selectedExam = examId && !Number.isNaN(examId) ? { exam_id: examId, exam_title: examTitle } : null;

        // Chỉ cho phép view sâu khi có đủ dữ liệu
        let resultsViewMode = view;
        if (resultsViewMode === 'departments' && !selectedPeriod) resultsViewMode = 'periods';
        if (resultsViewMode === 'exams' && (!selectedPeriod || !dept)) resultsViewMode = selectedPeriod ? 'departments' : 'periods';
        if (resultsViewMode === 'results' && (!selectedPeriod || !dept || !selectedExam)) resultsViewMode = (!selectedPeriod ? 'periods' : !dept ? 'departments' : 'exams');

        return {
            activeTab,
            resultsViewMode,
            selectedResultsPeriod: selectedPeriod,
            selectedResultsDepartment: dept,
            selectedResultsExam: selectedExam
        };
    } catch {
        return {
            activeTab: 'exam-statistics',
            resultsViewMode: 'periods',
            selectedResultsPeriod: null,
            selectedResultsDepartment: null,
            selectedResultsExam: null
        };
    }
}

function saveExamReportsNavPersistence(activeTab, resultsViewMode, selectedResultsPeriod, selectedResultsDepartment, selectedResultsExam) {
    try {
        localStorage.setItem(LS_EXAM_REPORTS_ACTIVE_TAB, activeTab || 'exam-statistics');

        // Chỉ lưu breadcrumb khi đang ở tab Kết quả thi
        if (activeTab !== 'exam-results') {
            localStorage.removeItem(LS_EXAM_REPORTS_RESULTS_VIEW);
            localStorage.removeItem(LS_EXAM_REPORTS_PERIOD_ID);
            localStorage.removeItem(LS_EXAM_REPORTS_PERIOD_NAME);
            localStorage.removeItem(LS_EXAM_REPORTS_DEPARTMENT);
            localStorage.removeItem(LS_EXAM_REPORTS_EXAM_ID);
            localStorage.removeItem(LS_EXAM_REPORTS_EXAM_TITLE);
            return;
        }

        localStorage.setItem(LS_EXAM_REPORTS_RESULTS_VIEW, resultsViewMode || 'periods');
        if (selectedResultsPeriod?.exam_period_id) {
            localStorage.setItem(LS_EXAM_REPORTS_PERIOD_ID, String(selectedResultsPeriod.exam_period_id));
            localStorage.setItem(LS_EXAM_REPORTS_PERIOD_NAME, selectedResultsPeriod.period_name || '');
        } else {
            localStorage.removeItem(LS_EXAM_REPORTS_PERIOD_ID);
            localStorage.removeItem(LS_EXAM_REPORTS_PERIOD_NAME);
        }

        if (selectedResultsDepartment) localStorage.setItem(LS_EXAM_REPORTS_DEPARTMENT, selectedResultsDepartment);
        else localStorage.removeItem(LS_EXAM_REPORTS_DEPARTMENT);

        if (selectedResultsExam?.exam_id) {
            localStorage.setItem(LS_EXAM_REPORTS_EXAM_ID, String(selectedResultsExam.exam_id));
            localStorage.setItem(LS_EXAM_REPORTS_EXAM_TITLE, selectedResultsExam.exam_title || '');
        } else {
            localStorage.removeItem(LS_EXAM_REPORTS_EXAM_ID);
            localStorage.removeItem(LS_EXAM_REPORTS_EXAM_TITLE);
        }
    } catch (_) { /* ignore */ }
}

const ExamReports = () => {
    usePageTitle('Báo cáo QA');
    const { currentUser } = useAuth();
    const { showAlert } = useAlert();

    const initialNavRef = useRef(null);
    if (initialNavRef.current === null) {
        initialNavRef.current = loadExamReportsNavPersistence();
    }
    const initNav = initialNavRef.current;
    
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
    
    // Load score range settings on component mount
    useEffect(() => {
        loadScoreRangeSettings();
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
    
    const [loading, setLoading] = useState(false);
    const [examStats, setExamStats] = useState([]);
    const [selectedExam, setSelectedExam] = useState(null);
    const [questionStats, setQuestionStats] = useState([]);
    const [showQuestionModal, setShowQuestionModal] = useState(false);
    const [loadingQuestions, setLoadingQuestions] = useState(false);
    const [expandedQuestion, setExpandedQuestion] = useState(null);
    const [studentsGrouped, setStudentsGrouped] = useState(null);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [questionGroupStats, setQuestionGroupStats] = useState({});
    const [loadingQuestionGroupStats, setLoadingQuestionGroupStats] = useState({});
    
    // Pagination
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        totalItems: 0,
        totalPages: 0
    });
    
    // Filters
    const [filters, setFilters] = useState({
        search: '',
        exam_type: '',
        difficulty: ''
    });
    
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

    // Phân cấp Học kỳ -> Khoa -> Danh sách kỳ thi (Tab "Kết quả thi") (ghi nhớ khi reload)
    const [resultsViewMode, setResultsViewMode] = useState(initNav.resultsViewMode || 'periods'); // 'periods' | 'departments' | 'exams' | 'results'
    const [resultsExamPeriods, setResultsExamPeriods] = useState([]);
    const [resultsDepartments, setResultsDepartments] = useState([]);
    const [resultsExams, setResultsExams] = useState([]);
    const [selectedResultsPeriod, setSelectedResultsPeriod] = useState(initNav.selectedResultsPeriod);
    const [selectedResultsDepartment, setSelectedResultsDepartment] = useState(initNav.selectedResultsDepartment);
    const [selectedResultsExam, setSelectedResultsExam] = useState(initNav.selectedResultsExam);
    const [resultsPeriodsPagination, setResultsPeriodsPagination] = useState({ page: 1, limit: 10, totalItems: 0, totalPages: 0 });
    const [resultsExamsPagination, setResultsExamsPagination] = useState({ page: 1, limit: 10, totalItems: 0, totalPages: 0 });
    /** Đang xuất file nhập điểm (Excel) cho kỳ thi nào */
    const [exportingNhapDiemExamId, setExportingNhapDiemExamId] = useState(null);

    // Auto-refresh state
    const [lastExamStatsHash, setLastExamStatsHash] = useState(null);
    const [lastExamAttemptsHash, setLastExamAttemptsHash] = useState(null);
    const [lastQuestionStatsHash, setLastQuestionStatsHash] = useState(null);
    const pollingIntervalRef = useRef(null);
    const pollingAttemptsRef = useRef(null);
    const pollingQuestionRef = useRef(null);

    // Helper function to generate hash of data for comparison
    const generateDataHash = (data) => {
      if (!data) return '';
      try {
        return JSON.stringify(data).split('').reduce((a, b) => {
          a = ((a << 5) - a) + b.charCodeAt(0);
          return a & a; // Convert to 32-bit integer
        }, 0).toString();
      } catch {
        return '';
      }
    };
    const [exams, setExams] = useState([]);
    
    // Reliability Data Tab states
    const [reliabilityData, setReliabilityData] = useState(null);
    const [loadingReliabilityData, setLoadingReliabilityData] = useState(false);
    const [reliabilityFilters, setReliabilityFilters] = useState({
        exam_id: ''
    });
    
    // Score Distribution Tab states
    const [scoreDistributionData, setScoreDistributionData] = useState(null);
    const [loadingScoreDistribution, setLoadingScoreDistribution] = useState(false);
    const [scoreDistributionFilters, setScoreDistributionFilters] = useState({
        exam_id: ''
    });
    const defaultScoreRanges = [
        { min: 0, max: 4.0, label: '< 4.0', color: '#ef4444' },
        { min: 4.0, max: 4.9, label: '4.0 – 4.9', color: '#f97316' },
        { min: 5.0, max: 6.4, label: '5.0 – 6.4', color: '#eab308' },
        { min: 6.5, max: 7.9, label: '6.5 – 7.9', color: '#22c55e' },
        { min: 8.0, max: 10, label: '≥ 8.0', color: '#3b82f6' }
    ];
    const [scoreRanges, setScoreRanges] = useState(defaultScoreRanges);
    const [tempScoreRanges, setTempScoreRanges] = useState(defaultScoreRanges);
    const [showScoreRangeModal, setShowScoreRangeModal] = useState(false);
    const [scoreRangeMetadata, setScoreRangeMetadata] = useState({
        updated_at: null,
        updated_by_name: null
    });
    const [loadingScoreRangeSettings, setLoadingScoreRangeSettings] = useState(false);
    
    // Bộ câu hỏi theo kỳ thi tab (lms_exam_topic_question_sets + lms_attempt_questions)
    const [questionSetsData, setQuestionSetsData] = useState(null);
    const [attemptQuestionsData, setAttemptQuestionsData] = useState(null);
    const [loadingQuestionSets, setLoadingQuestionSets] = useState(false);
    const [loadingAttemptQuestions, setLoadingAttemptQuestions] = useState(false);
    const [questionSetsFilters, setQuestionSetsFilters] = useState({ exam_id: '' });
    const [attemptQuestionsPagination, setAttemptQuestionsPagination] = useState({
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 0
    });
    
    // Active Tab state (ghi nhớ khi reload)
    const [activeTab, setActiveTab] = useState(initNav.activeTab || 'exam-statistics');
    
    // PDF/Excel Export Options
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
    
    const [excelExportOptions, setExcelExportOptions] = useState(() => {
        try {
            const saved = localStorage.getItem('excelExportOptions');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {
            console.error('Error loading Excel export options:', e);
        }
        return defaultPDFOptions; // Same structure as PDF
    });
    
    const [bulkPDFExportOptions, setBulkPDFExportOptions] = useState(() => {
        try {
            const saved = localStorage.getItem('bulkPDFExportOptions');
            if (saved) {
                return JSON.parse(saved);
            }
            const regularSaved = localStorage.getItem('pdfExportOptions');
            if (regularSaved) {
                return JSON.parse(regularSaved);
            }
        } catch (e) {
            console.error('Error loading bulk PDF export options:', e);
        }
        return defaultPDFOptions;
    });
    
    const [bulkExcelExportOptions, setBulkExcelExportOptions] = useState(() => {
        try {
            const saved = localStorage.getItem('bulkExcelExportOptions');
            if (saved) {
                return JSON.parse(saved);
            }
            const regularSaved = localStorage.getItem('excelExportOptions');
            if (regularSaved) {
                return JSON.parse(regularSaved);
            }
        } catch (e) {
            console.error('Error loading bulk Excel export options:', e);
        }
        return defaultPDFOptions; // Same structure as PDF
    });
    
    // Modals
    const [showPDFExportOptionsModal, setShowPDFExportOptionsModal] = useState(false);
    const [showBulkPDFOptionsModal, setShowBulkPDFOptionsModal] = useState(false);
    const [showExcelExportOptionsModal, setShowExcelExportOptionsModal] = useState(false);
    const [showBulkExcelOptionsModal, setShowBulkExcelOptionsModal] = useState(false);
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
    
    // Item Difficulty Index Settings
    const defaultDifficultyThresholds = {
        tooEasy: 0.8,
        easy: 0.6,
        medium: 0.4,
        hard: 0.2
    };
    
    // Discrimination Index Settings
    const defaultDiscriminationThresholds = {
        excellent: 0.4,
        good: 0.3,
        acceptable: 0.2,
        needsImprovement: 0.1
    };
    
    const [difficultyThresholds, setDifficultyThresholds] = useState(defaultDifficultyThresholds);
    const [discriminationThresholds, setDiscriminationThresholds] = useState(defaultDiscriminationThresholds);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [settingsModalTab, setSettingsModalTab] = useState('difficulty');
    const [tempDifficultyThresholds, setTempDifficultyThresholds] = useState(defaultDifficultyThresholds);
    const [tempDiscriminationThresholds, setTempDiscriminationThresholds] = useState(defaultDiscriminationThresholds);
    const [loadingSettings, setLoadingSettings] = useState(false);
    const [settingsMetadata, setSettingsMetadata] = useState({
        updated_at: null,
        updated_by_name: null
    });

    // Load exam statistics
    useEffect(() => {
        loadExamStatistics();
    }, []);

    // Load QA settings (difficulty thresholds)
    useEffect(() => {
        if (hasLMSQAPermission()) {
            loadQASettings();
        }
    }, [currentUser]);

    // Auto-refresh exam statistics when on statistics tab - polling every 5 seconds
    useEffect(() => {
        if (activeTab !== 'statistics') {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
            return;
        }

        const startPolling = async () => {
            pollingIntervalRef.current = setInterval(async () => {
                try {
                    const response = await api.get('/lms/exam-reports/statistics');
                    if (response.data.success) {
                        const newHash = generateDataHash(response.data.data);
                        if (newHash !== lastExamStatsHash) {
                            console.log('[Auto-refresh] Exam statistics updated');
                            setExamStats(response.data.data);
                            setPagination(prev => ({
                                ...prev,
                                totalItems: response.data.data.length,
                                totalPages: Math.ceil(response.data.data.length / prev.limit)
                            }));
                            setLastExamStatsHash(newHash);
                        }
                    }
                } catch (err) {
                    console.debug('[Auto-refresh] Statistics polling failed:', err.message);
                }
            }, 5000); // Poll every 5 seconds
        };

        startPolling();

        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, lastExamStatsHash]);

    // Auto-refresh exam attempts when on attempts tab - polling every 5 seconds
    useEffect(() => {
        if (activeTab !== 'attempts') {
            if (pollingAttemptsRef.current) {
                clearInterval(pollingAttemptsRef.current);
                pollingAttemptsRef.current = null;
            }
            return;
        }

        const startAttemptsPolling = async () => {
            pollingAttemptsRef.current = setInterval(async () => {
                try {
                    const examsResponse = await api.get('/lms/exams');
                    const examsData = examsResponse.data?.data;
                    let exams = [];
                    
                    if (Array.isArray(examsData)) {
                        exams = examsData;
                    } else if (examsData && Array.isArray(examsData.exams)) {
                        exams = examsData.exams;
                    }

                    const allAttempts = [];
                    for (const exam of exams) {
                        try {
                            const attemptsResponse = await api.get(`/lms/exams/${exam.exam_id}/attempts`);
                            const attemptsData = attemptsResponse.data?.data;
                            
                            if (Array.isArray(attemptsData)) {
                                const submittedAttempts = attemptsData
                                    .filter(attempt => attempt.status === 'submitted')
                                    .map(attempt => ({
                                        ...attempt,
                                        exam_title: exam.exam_title,
                                        exam_id: exam.exam_id
                                    }));
                                allAttempts.push(...submittedAttempts);
                            }
                        } catch (error) {
                            console.debug(`[Auto-refresh] Error fetching attempts for exam ${exam.exam_id}:`, error.message);
                        }
                    }

                    const newHash = generateDataHash(allAttempts);
                    if (newHash !== lastExamAttemptsHash) {
                        console.log('[Auto-refresh] Exam attempts updated');
                        setExamAttempts(allAttempts);
                        const extractedClasses = extractClassesFromAttempts(allAttempts);
                        if (extractedClasses.length > 0) {
                            setClasses(extractedClasses);
                        }
                        setLastExamAttemptsHash(newHash);
                    }
                } catch (err) {
                    console.debug('[Auto-refresh] Attempts polling failed:', err.message);
                }
            }, 5000); // Poll every 5 seconds
        };

        startAttemptsPolling();

        return () => {
            if (pollingAttemptsRef.current) {
                clearInterval(pollingAttemptsRef.current);
                pollingAttemptsRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, lastExamAttemptsHash]);

    // Auto-refresh question statistics when modal is open
    useEffect(() => {
        if (!showQuestionModal || !selectedExam?.exam_id) {
            if (pollingQuestionRef.current) {
                clearInterval(pollingQuestionRef.current);
                pollingQuestionRef.current = null;
            }
            return;
        }

        const startQuestionPolling = async () => {
            pollingQuestionRef.current = setInterval(async () => {
                try {
                    const response = await api.get(`/lms/exam-reports/${selectedExam.exam_id}/questions`);
                    if (response.data.success) {
                        const newHash = generateDataHash(response.data.data);
                        if (newHash !== lastQuestionStatsHash) {
                            console.log('[Auto-refresh] Question statistics updated');
                            setQuestionStats(response.data.data);
                            setLastQuestionStatsHash(newHash);
                        }
                    }
                } catch (err) {
                    console.debug('[Auto-refresh] Question polling failed:', err.message);
                }
            }, 5000); // Poll every 5 seconds
        };

        startQuestionPolling();

        return () => {
            if (pollingQuestionRef.current) {
                clearInterval(pollingQuestionRef.current);
                pollingQuestionRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showQuestionModal, selectedExam?.exam_id, lastQuestionStatsHash]);

    const loadQASettings = async () => {
        try {
            setLoadingSettings(true);
            // Load Item Difficulty Index settings
            const difficultyResponse = await api.get('/lms/exam-reports/settings?type=difficulty');
            if (difficultyResponse.data.success && difficultyResponse.data.data) {
                const { updated_at, updated_by_name, ...thresholds } = difficultyResponse.data.data;
                setDifficultyThresholds(thresholds);
                setTempDifficultyThresholds(thresholds);
                setSettingsMetadata({
                    updated_at: updated_at || null,
                    updated_by_name: updated_by_name || null
                });
            }
            
            // Load Discrimination Index settings
            const discriminationResponse = await api.get('/lms/exam-reports/settings?type=discrimination');
            if (discriminationResponse.data.success && discriminationResponse.data.data) {
                const { updated_at: disc_updated_at, updated_by_name: disc_updated_by_name, ...discThresholds } = discriminationResponse.data.data;
                setDiscriminationThresholds(discThresholds);
                setTempDiscriminationThresholds(discThresholds);
            }
        } catch (error) {
            console.error('Error loading QA settings:', error);
            // Use default values on error
            setDifficultyThresholds(defaultDifficultyThresholds);
            setTempDifficultyThresholds(defaultDifficultyThresholds);
            setDiscriminationThresholds(defaultDiscriminationThresholds);
            setTempDiscriminationThresholds(defaultDiscriminationThresholds);
            setSettingsMetadata({
                updated_at: null,
                updated_by_name: null
            });
        } finally {
            setLoadingSettings(false);
        }
    };

    const saveQASettings = async (thresholds, type = 'difficulty') => {
        try {
            setLoadingSettings(true);
            const response = await api.put(`/lms/exam-reports/settings?type=${type}`, thresholds);
            if (response.data.success) {
                if (type === 'difficulty') {
                    setDifficultyThresholds(thresholds);
                } else if (type === 'discrimination') {
                    setDiscriminationThresholds(thresholds);
                }
                // Reload settings to get updated metadata
                await loadQASettings();
                showAlertMessage('Đã lưu cài đặt thang đánh giá thành công', 'success');
                return true;
            } else {
                showAlertMessage(response.data.message || 'Lỗi khi lưu cài đặt', 'danger');
                return false;
            }
        } catch (error) {
            console.error('Error saving QA settings:', error);
            const errorMessage = error.response?.data?.message || 'Lỗi khi lưu cài đặt thang đánh giá';
            showAlertMessage(errorMessage, 'danger');
            return false;
        } finally {
            setLoadingSettings(false);
        }
    };

    const loadExamStatistics = async () => {
        try {
            setLoading(true);
            const response = await api.get('/lms/exam-reports/statistics');
            if (response.data.success) {
                setExamStats(response.data.data);
                const hash = generateDataHash(response.data.data);
                setLastExamStatsHash(hash);
                setPagination(prev => ({
                    ...prev,
                    totalItems: response.data.data.length,
                    totalPages: Math.ceil(response.data.data.length / prev.limit)
                }));
            }
        } catch (error) {
            console.error('Error loading exam statistics:', error);
            showAlert('Lỗi khi tải thống kê kỳ thi', 'danger');
        } finally {
            setLoading(false);
        }
    };

    const loadQuestionStatistics = async (examId) => {
        try {
            setLoadingQuestions(true);
            const response = await api.get(`/lms/exam-reports/${examId}/questions`);
            if (response.data.success) {
                setQuestionStats(response.data.data);
                const hash = generateDataHash(response.data.data);
                setLastQuestionStatsHash(hash);
            }
        } catch (error) {
            console.error('Error loading question statistics:', error);
            showAlert('Lỗi khi tải thống kê câu hỏi', 'danger');
        } finally {
            setLoadingQuestions(false);
        }
    };

    const loadStudentsGrouped = async (examId) => {
        try {
            setLoadingStudents(true);
            const response = await api.get(`/lms/exam-reports/${examId}/students-grouped`);
            if (response.data.success) {
                const students = response.data.data.students || [];
                const totalPoints = response.data.data.exam.total_points || 1;
                
                // Group students based on Discrimination Index thresholds (converted to percentage)
                // Convert thresholds from 0-1 scale to 0-100% scale
                const thresholds = {
                    excellent: discriminationThresholds.excellent * 100,
                    good: discriminationThresholds.good * 100,
                    acceptable: discriminationThresholds.acceptable * 100,
                    needsImprovement: discriminationThresholds.needsImprovement * 100
                };

                const grouped = {
                    excellent: [],
                    good: [],
                    acceptable: [],
                    needsImprovement: [],
                    poor: []
                };

                students.forEach(student => {
                    const percentage = student.percentage;
                    if (percentage >= thresholds.excellent) {
                        grouped.excellent.push(student);
                    } else if (percentage >= thresholds.good) {
                        grouped.good.push(student);
                    } else if (percentage >= thresholds.acceptable) {
                        grouped.acceptable.push(student);
                    } else if (percentage >= thresholds.needsImprovement) {
                        grouped.needsImprovement.push(student);
                    } else {
                        grouped.poor.push(student);
                    }
                });

                setStudentsGrouped({
                    groups: grouped,
                    total: students.length,
                    exam: response.data.data.exam
                });
            }
        } catch (error) {
            console.error('Error loading students grouped:', error);
            showAlert('Lỗi khi tải danh sách sinh viên', 'danger');
        } finally {
            setLoadingStudents(false);
        }
    };

    const loadQuestionGroupStats = async (examId, questionId) => {
        try {
            setLoadingQuestionGroupStats(prev => ({ ...prev, [questionId]: true }));
            const response = await api.get(`/lms/exam-reports/${examId}/questions/${questionId}/group-stats`);
            if (response.data.success) {
                setQuestionGroupStats(prev => ({
                    ...prev,
                    [questionId]: response.data.data
                }));
            }
        } catch (error) {
            console.error('Error loading question group stats:', error);
            showAlert('Lỗi khi tải thống kê câu hỏi theo nhóm', 'danger');
        } finally {
            setLoadingQuestionGroupStats(prev => ({ ...prev, [questionId]: false }));
        }
    };

    const handleExamClick = async (exam) => {
        setSelectedExam(exam);
        setShowQuestionModal(true);
        setExpandedQuestion(null); // Reset expanded state
        await loadQuestionStatistics(exam.exam_id);
        await loadStudentsGrouped(exam.exam_id);
    };

    const toggleQuestion = (questionId) => {
        setExpandedQuestion(expandedQuestion === questionId ? null : questionId);
    };
    
    // Permission check functions
    const hasLMSQAPermission = () => {
        if (!currentUser) return false;
        const moduleRoles = currentUser.module_roles || [];
        if (!Array.isArray(moduleRoles)) return false;
        return moduleRoles.includes('lms_qa');
    };

    const hasLMSQAModPermission = () => {
        if (!currentUser) return false;
        const moduleRoles = currentUser.module_roles || [];
        if (!Array.isArray(moduleRoles)) return false;
        return moduleRoles.includes('lms_qa') || moduleRoles.includes('lms_mod');
    };
    
    // Helper functions for exam results
    const showAlertMessage = (message, variant = 'info') => {
        const titles = {
            success: 'Thành công',
            info: 'Thông tin',
            warning: 'Cảnh báo',
            danger: 'Lỗi'
        };
        showAlert(message, variant);
    };
    
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
    
    // Exam Results Tab functions
    const fetchResultsExamPeriods = async () => {
        try {
            const res = await api.get('/lms/exam-periods'); // hiển thị tất cả
            const list = Array.isArray(res.data?.data) ? res.data.data : [];
            setResultsExamPeriods(list);
            const total = list.length;
            setResultsPeriodsPagination(prev => ({
                ...prev,
                totalItems: total,
                totalPages: Math.max(1, Math.ceil(total / prev.limit))
            }));

            // Đồng bộ tên học kỳ từ API; nếu học kỳ đã xóa/ẩn thì quay về danh sách học kỳ
            if (selectedResultsPeriod?.exam_period_id) {
                const pid = Number(selectedResultsPeriod.exam_period_id);
                const found = list.find((p) => Number(p.exam_period_id) === pid);
                if (!found) {
                    setSelectedResultsPeriod(null);
                    setSelectedResultsDepartment(null);
                    setSelectedResultsExam(null);
                    setResultsViewMode('periods');
                } else if ((found.period_name || '') !== (selectedResultsPeriod.period_name || '')) {
                    setSelectedResultsPeriod(found);
                }
            }
        } catch (err) {
            console.error('fetchResultsExamPeriods:', err);
            setResultsExamPeriods([]);
            setResultsPeriodsPagination(prev => ({ ...prev, totalItems: 0, totalPages: 0 }));
        }
    };

    const fetchResultsDepartmentsByPeriod = async (periodId) => {
        try {
            const res = await api.get(`/lms/exam-periods/${periodId}/departments`);
            setResultsDepartments(Array.isArray(res.data?.data) ? res.data.data : []);
        } catch (err) {
            console.error('fetchResultsDepartmentsByPeriod:', err);
            setResultsDepartments([]);
        }
    };

    const fetchResultsExams = async () => {
        try {
            setLoadingExamAttempts(true);
            const params = new URLSearchParams();
            if (selectedResultsPeriod?.exam_period_id) params.append('exam_period_id', selectedResultsPeriod.exam_period_id);
            if (selectedResultsDepartment) params.append('department_name', selectedResultsDepartment);
            params.append('page', resultsExamsPagination.page);
            params.append('limit', resultsExamsPagination.limit);
            const res = await api.get(`/lms/exams?${params.toString()}`);
            const data = res.data?.data;
            let list = [];
            let pag = null;
            if (data && Array.isArray(data.exams)) {
                list = data.exams;
                pag = data.pagination;
            } else if (Array.isArray(data)) {
                list = data;
            }
            setResultsExams(list);
            if (pag) {
                setResultsExamsPagination(prev => ({
                    ...prev,
                    totalItems: pag.total || list.length,
                    totalPages: pag.pages || Math.max(1, Math.ceil((pag.total || list.length) / prev.limit))
                }));
            } else {
                setResultsExamsPagination(prev => ({
                    ...prev,
                    totalItems: list.length,
                    totalPages: Math.max(1, Math.ceil(list.length / prev.limit))
                }));
            }

            // Nếu đang chọn 1 kỳ thi -> đồng bộ lại object theo danh sách mới (giữ title/type/class nếu có)
            if (selectedResultsExam?.exam_id) {
                const eid = Number(selectedResultsExam.exam_id);
                const foundExam = list.find((e) => Number(e.exam_id) === eid);
                if (foundExam) setSelectedResultsExam(foundExam);
            }
        } catch (err) {
            console.error('fetchResultsExams:', err);
            setResultsExams([]);
            setResultsExamsPagination(prev => ({ ...prev, totalItems: 0, totalPages: 0 }));
        } finally {
            setLoadingExamAttempts(false);
        }
    };

    const fetchExamAttempts = async (exam) => {
        try {
            setLoadingExamAttempts(true);
            if (!exam?.exam_id) {
                setExamAttempts([]);
                setClasses([]);
                setLastExamAttemptsHash(generateDataHash([]));
                return;
            }

            const attemptsResponse = await api.get(`/lms/exams/${exam.exam_id}/attempts`);
            const attemptsData = attemptsResponse.data?.data;
            const submittedAttempts = Array.isArray(attemptsData)
                ? attemptsData
                    .filter(a => a.status === 'submitted')
                    .map(a => ({
                        ...a,
                        exam_title: exam.exam_title,
                        exam_id: exam.exam_id
                    }))
                : [];

            setExamAttempts(submittedAttempts);
            const hash = generateDataHash(submittedAttempts);
            setLastExamAttemptsHash(hash);
            
            // Extract and set classes from attempts data
            const extractedClasses = extractClassesFromAttempts(submittedAttempts);
            if (extractedClasses.length > 0) {
                setClasses(extractedClasses);
            } else {
                setClasses([]);
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

    /** Độ rộng cột Excel (wch) theo nội dung để chữ không bị cắt */
    const buildSheetColWidths = (aoa, { minWch = 14, maxWch = 52, pad = 3 } = {}) => {
        const colCount = Math.max(5, ...aoa.map((r) => (Array.isArray(r) ? r.length : 0)));
        const widths = Array(colCount).fill(minWch);
        for (const row of aoa) {
            if (!Array.isArray(row)) continue;
            row.forEach((cell, i) => {
                const s = String(cell ?? '');
                let units = 0;
                for (let k = 0; k < s.length; k++) {
                    units += s.charCodeAt(k) > 255 ? 1.35 : 1;
                }
                const w = Math.min(maxWch, Math.max(widths[i], Math.ceil(units) + pad));
                widths[i] = w;
            });
        }
        return widths.map((wch) => ({ wch }));
    };

    /** Excel mẫu nhập điểm: 2 dòng tiêu đề + dữ liệu T1/MaSV/MaMH theo từng SV (điểm khớp mã SV) */
    const exportNhapDiemExcelForExam = async (exam, e) => {
        e?.stopPropagation?.();
        e?.preventDefault?.();
        if (!exam?.exam_id) return;
        setExportingNhapDiemExamId(exam.exam_id);
        try {
            const attemptsResponse = await api.get(`/lms/exams/${exam.exam_id}/attempts`);
            const attemptsData = attemptsResponse.data?.data;
            const submitted = Array.isArray(attemptsData)
                ? attemptsData.filter((a) => a.status === 'submitted' && String(a.student_id || '').trim() !== '')
                : [];

            const byStudent = new Map();
            for (const a of submitted) {
                const sid = String(a.student_id).trim();
                const sc = parseFloat(a.score);
                const prev = byStudent.get(sid);
                const prevSc = prev ? parseFloat(prev.score) : -Infinity;
                const tNew = a.submit_time || a.end_time || 0;
                const tPrev = prev ? (prev.submit_time || prev.end_time || 0) : 0;
                if (!prev || sc > prevSc || (sc === prevSc && new Date(tNew) > new Date(tPrev))) {
                    byStudent.set(sid, a);
                }
            }

            const maMh = String(exam.ma_mh || '').trim();
            const rows = Array.from(byStudent.entries())
                .map(([maSv, a]) => {
                    const scoreStr = a.score != null && a.score !== ''
                        ? String(formatNumber(parseFloat(a.score)))
                        : '';
                    return [scoreStr, maSv, maMh, '', ''];
                })
                .sort((r1, r2) => String(r1[1]).localeCompare(String(r2[1]), 'vi'));

            const header1 = [
                'Điểm thi lần 1 (Kiểu chuỗi/500)',
                'Mã SV (Kiểu chuỗi/50)',
                'Mã môn học (Kiểu chuỗi/50)',
                'Ghi chú điểm (Kiểu chuỗi/4000)',
                'Nhóm/tổ (Kiểu chuỗi/50)'
            ];
            const header2 = ['T1', 'MaSV', 'MaMH', 'GcNhapDiem', 'NhomTo'];
            const aoa = [header1, header2, ...rows];

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(aoa);
            ws['!cols'] = buildSheetColWidths(aoa, {
                minWch: 16,
                maxWch: 60,
                pad: 4
            });
            ws['!rows'] = [{ hpt: 40 }, { hpt: 24 }];
            XLSX.utils.book_append_sheet(wb, ws, 'NhapDiem');

            const safeTitle = String(exam.exam_title || 'ky_thi').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
            XLSX.writeFile(wb, `NhapDiem_exam${exam.exam_id}_${safeTitle}.xlsx`);

            if (rows.length === 0) {
                showAlertMessage('Đã tạo file (chưa có bài nộp). Kiểm tra mã môn học (MaMH) trên kỳ thi.', 'warning');
            } else if (!maMh) {
                showAlertMessage('Đã xuất Excel. Kỳ thi chưa có Mã môn học (ma_mh) — cột MaMH đang trống.', 'warning');
            } else {
                showAlertMessage(`Đã xuất ${rows.length} dòng điểm.`, 'success');
            }
        } catch (err) {
            console.error('exportNhapDiemExcelForExam:', err);
            showAlertMessage(err.response?.data?.message || 'Lỗi khi xuất file Excel nhập điểm', 'danger');
        } finally {
            setExportingNhapDiemExamId(null);
        }
    };

    // Fetch reliability data (matrix data for Cronbach's Alpha, KR-20, KR-21)
    const fetchReliabilityData = async (examId) => {
        try {
            setLoadingReliabilityData(true);
            const response = await api.get(`/lms/exam-reports/${examId}/reliability-matrix`);
            
            if (response.data.success) {
                setReliabilityData(response.data.data);
            } else {
                showAlertMessage('Không thể tải dữ liệu độ tin cậy', 'danger');
            }
        } catch (error) {
            console.error('Error fetching reliability data:', error);
            showAlertMessage('Lỗi khi tải dữ liệu độ tin cậy', 'danger');
            setReliabilityData(null);
        } finally {
            setLoadingReliabilityData(false);
        }
    };
    
    // Export reliability data as CSV
    const exportReliabilityCSV = () => {
        if (!reliabilityData || !reliabilityData.matrix || reliabilityData.matrix.length === 0) {
            showAlertMessage('Không có dữ liệu để xuất', 'warning');
            return;
        }
        
        try {
            // Create CSV content
            let csv = '';
            
            // Header row
            csv += 'Mã SV,Họ tên';
            reliabilityData.question_metadata.forEach((q, index) => {
                csv += `,Câu ${index + 1}`;
            });
            csv += ',Tổng điểm\n';
            
            // Data rows
            reliabilityData.matrix.forEach(student => {
                csv += `"${student.student_code || ''}","${student.student_name || ''}"`;
                student.scores.forEach(score => {
                    csv += `,${score !== null && score !== undefined ? score : 'N/A'}`;
                });
                csv += `,${student.total_score || 0}\n`;
            });
            
            // Download CSV
            const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `reliability_data_${reliabilityData.exam_title || 'exam'}_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            showAlertMessage('Đã xuất dữ liệu CSV thành công', 'success');
        } catch (error) {
            console.error('Error exporting CSV:', error);
            showAlertMessage('Lỗi khi xuất file CSV', 'danger');
        }
    };
    
    // Export reliability data as Excel
    const exportReliabilityExcel = () => {
        if (!reliabilityData || !reliabilityData.matrix || reliabilityData.matrix.length === 0) {
            showAlertMessage('Không có dữ liệu để xuất', 'warning');
            return;
        }
        
        try {
            // Prepare data for Excel
            const wsData = [];
            
            // Header row
            const headerRow = ['Mã SV', 'Họ tên'];
            reliabilityData.question_metadata.forEach((q, index) => {
                headerRow.push(`Câu ${index + 1}`);
            });
            headerRow.push('Tổng điểm');
            wsData.push(headerRow);
            
            // Data rows
            reliabilityData.matrix.forEach(student => {
                const row = [
                    student.student_code || '',
                    student.student_name || ''
                ];
                student.scores.forEach(score => {
                    row.push(score !== null && score !== undefined ? score : '');
                });
                row.push(student.total_score || 0);
                wsData.push(row);
            });
            
            // Create workbook and worksheet
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            
            // Set column widths
            const colWidths = [
                { wch: 12 }, // Mã SV
                { wch: 25 }  // Họ tên
            ];
            reliabilityData.question_metadata.forEach(() => {
                colWidths.push({ wch: 8 }); // Question columns
            });
            colWidths.push({ wch: 12 }); // Tổng điểm
            ws['!cols'] = colWidths;
            
            // Add worksheet to workbook
            XLSX.utils.book_append_sheet(wb, ws, 'Dữ liệu độ tin cậy');
            
            // Save file
            XLSX.writeFile(wb, `reliability_data_${reliabilityData.exam_title || 'exam'}_${new Date().toISOString().split('T')[0]}.xlsx`);
            
            showAlertMessage('Đã xuất dữ liệu Excel thành công', 'success');
        } catch (error) {
            console.error('Error exporting Excel:', error);
            showAlertMessage('Lỗi khi xuất file Excel', 'danger');
        }
    };
    
    // Fetch score distribution data
    const fetchScoreDistribution = async (examId) => {
        try {
            setLoadingScoreDistribution(true);
            const response = await api.get(`/lms/exam-reports/${examId}/score-distribution`, {
                params: { ranges: JSON.stringify(scoreRanges) }
            });
            
            if (response.data.success) {
                setScoreDistributionData(response.data.data);
            } else {
                showAlertMessage('Không thể tải dữ liệu phổ điểm', 'danger');
            }
        } catch (error) {
            console.error('Error fetching score distribution:', error);
            showAlertMessage('Lỗi khi tải dữ liệu phổ điểm', 'danger');
            setScoreDistributionData(null);
        } finally {
            setLoadingScoreDistribution(false);
        }
    };
    
    const fetchQuestionSetsData = async (examId) => {
        if (!examId) {
            setQuestionSetsData(null);
            return;
        }
        try {
            setLoadingQuestionSets(true);
            const response = await api.get(`/lms/exam-reports/${examId}/question-sets`);
            if (response.data.success) {
                setQuestionSetsData(response.data.data);
            } else {
                setQuestionSetsData([]);
            }
        } catch (error) {
            console.error('Error fetching question sets:', error);
            showAlertMessage('Lỗi khi tải bộ câu hỏi theo kỳ thi', 'danger');
            setQuestionSetsData(null);
        } finally {
            setLoadingQuestionSets(false);
        }
    };
    
    const fetchAttemptQuestionsData = async (examId, page = 1) => {
        if (!examId) {
            setAttemptQuestionsData(null);
            setAttemptQuestionsPagination(p => ({ ...p, total: 0, totalPages: 0 }));
            return;
        }
        try {
            setLoadingAttemptQuestions(true);
            const response = await api.get(`/lms/exam-reports/${examId}/attempt-questions`, {
                params: { page, limit: 50 }
            });
            if (response.data.success && response.data.data) {
                setAttemptQuestionsData(response.data.data.items);
                setAttemptQuestionsPagination(prev => ({
                    ...prev,
                    page: response.data.data.pagination.page,
                    limit: response.data.data.pagination.limit,
                    total: response.data.data.pagination.total,
                    totalPages: response.data.data.pagination.totalPages
                }));
            } else {
                setAttemptQuestionsData([]);
            }
        } catch (error) {
            console.error('Error fetching attempt questions:', error);
            showAlertMessage('Lỗi khi tải câu hỏi theo lần làm bài', 'danger');
            setAttemptQuestionsData(null);
        } finally {
            setLoadingAttemptQuestions(false);
        }
    };
    
    const loadQuestionSetsTabData = (examId) => {
        setQuestionSetsFilters(prev => ({ ...prev, exam_id: examId }));
        if (examId) {
            fetchQuestionSetsData(examId);
            fetchAttemptQuestionsData(examId, 1);
        } else {
            setQuestionSetsData(null);
            setAttemptQuestionsData(null);
            setAttemptQuestionsPagination(p => ({ ...p, total: 0, totalPages: 0 }));
        }
    };
    
    // Load score range settings from database
    const loadScoreRangeSettings = async () => {
        try {
            const response = await api.get('/lms/exam-reports/score-range-settings');
            
            if (response.data.success && response.data.data) {
                const settings = response.data.data;
                if (settings.ranges && Array.isArray(settings.ranges)) {
                    setScoreRanges(settings.ranges);
                    setTempScoreRanges(settings.ranges);
                }
                setScoreRangeMetadata({
                    updated_at: settings.updated_at,
                    updated_by_name: settings.updated_by_name
                });
            }
        } catch (error) {
            console.error('Error loading score range settings:', error);
            // Use default ranges if loading fails
        }
    };
    
    // Save score range settings to database
    const saveScoreRangeSettings = async () => {
        try {
            setLoadingScoreRangeSettings(true);
            const response = await api.post('/lms/exam-reports/score-range-settings', {
                ranges: tempScoreRanges
            });
            
            if (response.data.success) {
                setScoreRanges(tempScoreRanges);
                setScoreRangeMetadata({
                    updated_at: response.data.data.updated_at,
                    updated_by_name: response.data.data.updated_by_name
                });
                setShowScoreRangeModal(false);
                showAlertMessage('Đã lưu cài đặt khoảng điểm', 'success');
                
                // Refresh chart if an exam is selected
                if (scoreDistributionFilters.exam_id) {
                    fetchScoreDistribution(scoreDistributionFilters.exam_id);
                }
            } else {
                showAlertMessage('Không thể lưu cài đặt', 'danger');
            }
        } catch (error) {
            console.error('Error saving score range settings:', error);
            showAlertMessage('Lỗi khi lưu cài đặt', 'danger');
        } finally {
            setLoadingScoreRangeSettings(false);
        }
    };
    
    // Auto-generate label based on min/max values
    const generateLabel = (min, max) => {
        if (min === 0 && max < 4) {
            return `< ${max}`;
        } else if (max === 10) {
            return `≥ ${min}`;
        } else {
            return `${min} – ${max}`;
        }
    };
    
    // Update range with auto-generated label
    const updateRangeValue = (index, field, value) => {
        const newRanges = [...tempScoreRanges];
        const numValue = parseFloat(value) || 0;
        
        // Clamp value between 0 and 10
        const clampedValue = Math.max(0, Math.min(10, numValue));
        
        newRanges[index][field] = clampedValue;
        
        // Auto-generate label when min or max changes
        if (field === 'min' || field === 'max') {
            newRanges[index].label = generateLabel(newRanges[index].min, newRanges[index].max);
        }
        
        setTempScoreRanges(newRanges);
    };
    
    // Open score range modal
    const openScoreRangeModal = () => {
        setTempScoreRanges([...scoreRanges]);
        setShowScoreRangeModal(true);
    };

    const handleViewExamResults = async (attempt) => {
        try {
            setLoadingExamResults(true);
            setSelectedAttempt(attempt);
            
            // Fetch detailed results
            const response = await api.get(`/lms/attempts/${attempt.attempt_id}/results`);
            
            if (response.data.success) {
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
        if (activeButton && sidebarRef.current) {
            activeButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [activeQuestionIndex, examResults]);
    
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
    
    // Load data cho Tab "Kết quả thi"
    useEffect(() => {
        if (!hasLMSQAPermission()) return;
        if (activeTab !== 'exam-results') return;

        // Load học kỳ ngay khi vào tab
        if (resultsViewMode === 'periods') {
            fetchResultsExamPeriods();
            return;
        }
        // Load khoa khi đã chọn học kỳ
        if (resultsViewMode === 'departments' && selectedResultsPeriod?.exam_period_id) {
            fetchResultsDepartmentsByPeriod(selectedResultsPeriod.exam_period_id);
            return;
        }
        // Load danh sách kỳ thi khi đã chọn khoa
        if (resultsViewMode === 'exams') {
            fetchResultsExams();
            return;
        }
        // Load kết quả thi khi đã chọn kỳ thi
        if (resultsViewMode === 'results' && selectedResultsExam?.exam_id) {
            fetchExamAttempts(selectedResultsExam);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        activeTab,
        currentUser,
        resultsViewMode,
        selectedResultsPeriod?.exam_period_id,
        selectedResultsDepartment,
        selectedResultsExam?.exam_id,
        resultsExamsPagination.page,
        resultsExamsPagination.limit
    ]);
    
    // Load exams when opening "Bộ câu hỏi theo kỳ thi" tab if list is empty
    useEffect(() => {
        if (activeTab === 'question-sets' && hasLMSQAPermission() && (!exams || exams.length === 0)) {
            fetchExamsForFilter();
        }
    }, [activeTab, exams]);

    // Đảm bảo danh sách kỳ thi phục vụ các tab cần dropdown chọn kỳ thi
    useEffect(() => {
        if (!hasLMSQAPermission()) return;
        const needsExamList = ['reliability-data', 'score-distribution', 'question-sets'].includes(activeTab);
        if (!needsExamList) return;
        if (!exams || exams.length === 0) fetchExamsForFilter();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, currentUser]);

    // Ghi nhớ tab + breadcrumb khi reload
    useEffect(() => {
        if (!hasLMSQAPermission()) return;
        saveExamReportsNavPersistence(activeTab, resultsViewMode, selectedResultsPeriod, selectedResultsDepartment, selectedResultsExam);
    }, [activeTab, resultsViewMode, selectedResultsPeriod, selectedResultsDepartment, selectedResultsExam, currentUser]);
    
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
    
    // Export Functions - PDF
    const exportToPDF = async (options = null) => {
        const attemptToExport = selectedAttemptForPDF || selectedAttempt;
        if (!attemptToExport) return;

        const exportOptions = options || pdfExportOptions;

        try {
            setLoadingExamResults(true);
            
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

            let filename = `ket-qua-thi-${attemptToExport.attempt_id}.pdf`;
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
            setSelectedAttemptForPDF(null);
        } catch (error) {
            console.error('Error downloading PDF:', error);
            showAlertMessage('Lỗi khi tải file PDF', 'danger');
        } finally {
            setLoadingExamResults(false);
        }
    };
    
    const handleExportPDFClick = () => {
        if (pdfExportButtonRef.current) {
            setSelectedAttemptForPDF(null);
            const rect = pdfExportButtonRef.current.getBoundingClientRect();
            const modalWidth = 320;
            const modalHeight = 500;
            const gap = 8;
            let left = rect.left + (rect.width / 2) - (modalWidth / 2);
            let top = rect.top - modalHeight - gap;
            if (left < 10) left = 10;
            if (left + modalWidth > window.innerWidth - 10) {
                left = window.innerWidth - modalWidth - 10;
            }
            if (top < 10) {
                top = rect.bottom + gap;
            }
            setPdfModalPosition({ top, left });
            setShowPDFExportOptionsModal(true);
        }
    };

    const handlePDFExportConfirm = () => {
        exportToPDF();
    };
    
    const handleExportPDFFromAttempt = async (attempt, e) => {
        e.stopPropagation();
        setSelectedAttemptForPDF(attempt);
        const buttonElement = e.currentTarget;
        if (buttonElement) {
            const rect = buttonElement.getBoundingClientRect();
            const modalWidth = 320;
            const modalHeight = 500;
            const gap = 8;
            let left = rect.left - modalWidth - gap;
            let top = rect.top;
            if (left < 10) {
                left = rect.right + gap;
                if (left + modalWidth > window.innerWidth - 10) {
                    left = window.innerWidth - modalWidth - 10;
                }
            }
            const minTop = 10;
            if (top < minTop) {
                top = minTop;
            } else if (top + modalHeight > window.innerHeight - 10) {
                top = Math.max(minTop, window.innerHeight - modalHeight - 10);
            }
            setPdfModalPosition({ top, left });
            setShowPDFExportOptionsModal(true);
        }
    };
    
    const handleBulkExportPDF = () => {
        const attemptsToExport = filteredExamAttempts;
        if (attemptsToExport.length === 0) {
            showAlertMessage('Không có bài thi nào để xuất PDF', 'warning');
            return;
        }
        setShowBulkPDFOptionsModal(true);
    };
    
    const handleBulkPDFExportConfirm = async () => {
        const attemptsToExport = filteredExamAttempts;
        if (attemptsToExport.length === 0) {
            showAlertMessage('Không có bài thi nào để xuất PDF', 'warning');
            return;
        }
        setShowBulkPDFOptionsModal(false);
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

            for (let i = 0; i < attemptsToExport.length; i++) {
                const attempt = attemptsToExport[i];
                setBulkPDFProgress(prev => ({
                    ...prev,
                    current: i + 1,
                    currentAttempt: attempt,
                    message: `Đang xuất PDF cho ${attempt.student_name || attempt.student_id || 'N/A'}...`
                }));

                try {
                    const token = localStorage.getItem('token');
                    const fetchResponse = await fetch(`${getApiBaseURL()}/lms/attempts/${attempt.attempt_id}/results/pdf?${queryString}`, {
                        headers: {
                            'x-auth-token': token
                        }
                    });
                    
                    if (!fetchResponse.ok) {
                        throw new Error(`HTTP ${fetchResponse.status}: ${fetchResponse.statusText}`);
                    }
                    
                    const blob = await fetchResponse.blob();
                    let filename = `ket-qua-thi-${attempt.attempt_id}.pdf`;
                    const contentDisposition = fetchResponse.headers.get('content-disposition') || '';
                    if (contentDisposition) {
                        let filenameMatch = contentDisposition.match(/filename\*?=['"]?([^'";\n]+)['"]?/i);
                        if (filenameMatch && filenameMatch[1]) {
                            filename = filenameMatch[1];
                            if (filename.startsWith("UTF-8''")) {
                                filename = decodeURIComponent(filename.substring(7));
                            } else if (filename.includes('%')) {
                                try {
                                    filename = decodeURIComponent(filename);
                                } catch (e) {}
                            }
                        }
                    }

                    if (attemptsToExport.length === 1) {
                        singlePDFBlob = blob;
                        singlePDFFilename = filename;
                    } else {
                        const arrayBuffer = await blob.arrayBuffer();
                        zip.file(filename, arrayBuffer);
                    }
                    
                    exportedCount++;
                    setBulkPDFProgress(prev => ({
                        ...prev,
                        exported: exportedCount,
                        message: `Đã xuất ${exportedCount}/${attemptsToExport.length} PDF...`
                    }));

                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (error) {
                    console.error(`Error exporting PDF for attempt ${attempt.attempt_id}:`, error);
                    failedCount++;
                    const errorMsg = `Lỗi khi xuất PDF cho ${attempt.student_name || attempt.student_id || 'N/A'}: ${error.message}`;
                    errors.push(errorMsg);
                    setBulkPDFProgress(prev => ({
                        ...prev,
                        failed: failedCount,
                        errors: [...prev.errors, errorMsg]
                    }));
                }
            }

            if (exportedCount === 1 && singlePDFBlob) {
                const url = window.URL.createObjectURL(singlePDFBlob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', singlePDFFilename);
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(url);
            } else if (exportedCount > 1) {
                setBulkPDFProgress(prev => ({
                    ...prev,
                    message: 'Đang nén các file PDF...'
                }));
                const zipBlob = await zip.generateAsync({ type: 'blob' });
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
    
    // Export Functions - Excel
    const exportToExcel = async (options = null) => {
        const attemptToExport = selectedAttemptForExcel || selectedAttempt;
        if (!attemptToExport) return;

        const exportOptions = options || excelExportOptions;

        try {
            setLoadingExamResults(true);
            
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

            let filename = `ket-qua-thi-${attemptToExport.attempt_id}.xlsx`;
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
                        } catch (e) {}
                    }
                }
            }

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
            setSelectedAttemptForExcel(null);
        } catch (error) {
            console.error('Error downloading Excel:', error);
            showAlertMessage('Lỗi khi tải file Excel', 'danger');
        } finally {
            setLoadingExamResults(false);
        }
    };
    
    const handleExportExcelClick = () => {
        if (excelExportButtonRef.current) {
            setSelectedAttemptForExcel(null);
            const rect = excelExportButtonRef.current.getBoundingClientRect();
            const modalWidth = 320;
            const modalHeight = 500;
            const gap = 8;
            let left = rect.left + (rect.width / 2) - (modalWidth / 2);
            let top = rect.top - modalHeight - gap;
            if (left < 10) left = 10;
            if (left + modalWidth > window.innerWidth - 10) {
                left = window.innerWidth - modalWidth - 10;
            }
            if (top < 10) {
                top = rect.bottom + gap;
            }
            setExcelModalPosition({ top, left });
            setShowExcelExportOptionsModal(true);
        }
    };

    const handleExcelExportConfirm = () => {
        exportToExcel();
    };
    
    const handleExportExcelFromAttempt = async (attempt, e) => {
        e.stopPropagation();
        setSelectedAttemptForExcel(attempt);
        const buttonElement = e.currentTarget;
        if (buttonElement) {
            const rect = buttonElement.getBoundingClientRect();
            const modalWidth = 320;
            const modalHeight = 500;
            const gap = 8;
            let left = rect.left - modalWidth - gap;
            let top = rect.top;
            if (left < 10) {
                left = rect.right + gap;
                if (left + modalWidth > window.innerWidth - 10) {
                    left = window.innerWidth - modalWidth - 10;
                }
            }
            const minTop = 10;
            if (top < minTop) {
                top = minTop;
            } else if (top + modalHeight > window.innerHeight - 10) {
                top = Math.max(minTop, window.innerHeight - modalHeight - 10);
            }
            setExcelModalPosition({ top, left });
            setShowExcelExportOptionsModal(true);
        }
    };
    
    const handleBulkExportExcel = () => {
        const attemptsToExport = filteredExamAttempts;
        if (attemptsToExport.length === 0) {
            showAlertMessage('Không có bài thi nào để xuất Excel', 'warning');
            return;
        }
        setShowBulkExcelOptionsModal(true);
    };
    
    const handleBulkExcelExportConfirm = async () => {
        const attemptsToExport = filteredExamAttempts;
        if (attemptsToExport.length === 0) {
            showAlertMessage('Không có bài thi nào để xuất Excel', 'warning');
            return;
        }
        setShowBulkExcelOptionsModal(false);
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

            for (let i = 0; i < attemptsToExport.length; i++) {
                const attempt = attemptsToExport[i];
                setBulkExcelProgress(prev => ({
                    ...prev,
                    current: i + 1,
                    currentAttempt: attempt,
                    message: `Đang xuất Excel cho ${attempt.student_name || attempt.student_id || 'N/A'}...`
                }));

                try {
                    const token = localStorage.getItem('token');
                    const fetchResponse = await fetch(`${getApiBaseURL()}/lms/attempts/${attempt.attempt_id}/results/excel?${queryString}`, {
                        headers: {
                            'x-auth-token': token
                        }
                    });
                    
                    if (!fetchResponse.ok) {
                        throw new Error(`HTTP ${fetchResponse.status}: ${fetchResponse.statusText}`);
                    }
                    
                    const blob = await fetchResponse.blob();
                    let filename = `ket-qua-thi-${attempt.attempt_id}.xlsx`;
                    const contentDisposition = fetchResponse.headers.get('content-disposition') || '';
                    if (contentDisposition) {
                        let filenameMatch = contentDisposition.match(/filename\*?=['"]?([^'";\n]+)['"]?/i);
                        if (filenameMatch && filenameMatch[1]) {
                            filename = filenameMatch[1];
                            if (filename.startsWith("UTF-8''")) {
                                filename = decodeURIComponent(filename.substring(7));
                            } else if (filename.includes('%')) {
                                try {
                                    filename = decodeURIComponent(filename);
                                } catch (e) {}
                            }
                        }
                    }

                    if (attemptsToExport.length === 1) {
                        singleExcelBlob = blob;
                        singleExcelFilename = filename;
                    } else {
                        const arrayBuffer = await blob.arrayBuffer();
                        zip.file(filename, arrayBuffer);
                    }
                    
                    exportedCount++;
                    setBulkExcelProgress(prev => ({
                        ...prev,
                        exported: exportedCount,
                        message: `Đã xuất ${exportedCount}/${attemptsToExport.length} Excel...`
                    }));

                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (error) {
                    console.error(`Error exporting Excel for attempt ${attempt.attempt_id}:`, error);
                    failedCount++;
                    const errorMsg = `Lỗi khi xuất Excel cho ${attempt.student_name || attempt.student_id || 'N/A'}: ${error.message}`;
                    errors.push(errorMsg);
                    setBulkExcelProgress(prev => ({
                        ...prev,
                        failed: failedCount,
                        errors: [...prev.errors, errorMsg]
                    }));
                }
            }

            if (exportedCount === 1 && singleExcelBlob) {
                const url = window.URL.createObjectURL(singleExcelBlob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', singleExcelFilename);
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(url);
            } else if (exportedCount > 1) {
                setBulkExcelProgress(prev => ({
                    ...prev,
                    message: 'Đang nén các file Excel...'
                }));
                const zipBlob = await zip.generateAsync({ type: 'blob' });
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

    const formatDuration = (minutes) => {
        const num = Number(minutes);
        if (!num || isNaN(num) || num <= 0) return '-';
        const hrs = Math.floor(num / 60);
        const mins = Math.round(num % 60);
        if (hrs > 0) {
            return `${hrs}h ${mins}m`;
        }
        return `${mins}m`;
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getExamTypeLabel = (type) => {
        const types = {
            'quiz': 'Kiểm tra',
            'midterm': 'Giữa kỳ',
            'final': 'Cuối kỳ',
            'practice': 'Luyện tập',
            'osce': 'OSCE',
            'assessment': 'Đánh giá'
        };
        return types[type] || type;
    };

    const getExamTypeBadge = (type) => {
        const variants = {
            'quiz': 'info',
            'midterm': 'warning',
            'final': 'danger',
            'practice': 'success',
            'osce': 'primary',
            'assessment': 'secondary'
        };
        return variants[type] || 'secondary';
    };

    const getDifficultyColor = (difficulty) => {
        const colors = {
            'Dễ': 'success',
            'Trung bình': 'info',
            'Khó': 'warning',
            'Rất khó': 'danger',
            'Không đủ dữ liệu': 'secondary'
        };
        return colors[difficulty] || 'secondary';
    };

    const getQuestionTypeLabel = (type) => {
        const types = {
            'mcq': 'Trắc nghiệm',
            'multiple_response': 'Nhiều đáp án',
            'true_false': 'Đúng/Sai',
            'short_answer': 'Trả lời ngắn',
            'essay': 'Tự luận',
            'matching': 'Nối',
            'fill_blank': 'Điền khuyết',
            'ordering': 'Sắp xếp'
        };
        return types[type] || type;
    };

    const getDifficultyLabel = (difficulty) => {
        const levels = {
            'easy': 'Dễ',
            'medium': 'Trung bình',
            'hard': 'Khó',
            'expert': 'Chuyên gia'
        };
        return levels[difficulty] || difficulty;
    };
    
    // Function to assess difficulty based on custom thresholds
    const assessDifficulty = (itemDifficultyIndex) => {
        if (itemDifficultyIndex === null || itemDifficultyIndex === undefined) {
            return 'Không đủ dữ liệu';
        }
        
        const index = parseFloat(itemDifficultyIndex);
        if (isNaN(index)) {
            return 'Không đủ dữ liệu';
        }
        
        const thresholds = {
            tooEasy: difficultyThresholds.tooEasy,
            easy: difficultyThresholds.easy,
            medium: difficultyThresholds.medium,
            hard: difficultyThresholds.hard
        };
        
        if (index >= thresholds.tooEasy) {
            return 'Quá dễ';
        } else if (index >= thresholds.easy) {
            return 'Dễ';
        } else if (index >= thresholds.medium) {
            return 'Trung bình (Lý tưởng)';
        } else if (index >= thresholds.hard) {
            return 'Khó';
        } else {
            return 'Quá khó';
        }
    };

    // Function to assess discrimination based on custom thresholds
    const assessDiscrimination = (discriminationIndex) => {
        if (discriminationIndex === null || discriminationIndex === undefined) {
            return 'Không đủ dữ liệu';
        }
        
        const index = parseFloat(discriminationIndex);
        if (isNaN(index)) {
            return 'Không đủ dữ liệu';
        }
        
        const thresholds = {
            excellent: discriminationThresholds.excellent,
            good: discriminationThresholds.good,
            acceptable: discriminationThresholds.acceptable,
            needsImprovement: discriminationThresholds.needsImprovement
        };
        
        if (index >= thresholds.excellent) {
            return 'Xuất sắc';
        } else if (index >= thresholds.good) {
            return 'Tốt';
        } else if (index >= thresholds.acceptable) {
            return 'Chấp nhận được';
        } else if (index >= thresholds.needsImprovement) {
            return 'Cần cải thiện';
        } else {
            return 'Kém';
        }
    };
    

    const getBloomLabel = (level) => {
        const blooms = {
            'remember': 'Nhớ',
            'understand': 'Hiểu',
            'apply': 'Áp dụng',
            'analyze': 'Phân tích',
            'evaluate': 'Đánh giá',
            'create': 'Tạo mới'
        };
        return blooms[level] || level;
    };

    const getQuestionSelectionModeLabel = (mode, randomizeMode) => {
        const modes = {
            'first_on_create': 'Đầu tiên khi tạo',
            'random_on_create': 'Random khi tạo',
            'first_on_exam': 'Đầu tiên khi thi',
            'random_on_exam': 'Random khi thi'
        };
        
        let label = modes[mode] || mode;
        
        // If random_on_exam, add randomize_mode info
        if (mode === 'random_on_exam' && randomizeMode) {
            if (randomizeMode === 'all') {
                label += ' (Tất cả)';
            } else if (randomizeMode === 'fixed') {
                label += ' (Cố định)';
            }
        }
        
        return label;
    };

    // Render answer distribution chart for MCQ questions
    const renderAnswerDistribution = (question) => {
        try {
            // Parse answer_distribution safely
            let distribution = [];
            try {
                if (typeof question.answer_distribution === 'string') {
                    distribution = JSON.parse(question.answer_distribution);
                } else if (Array.isArray(question.answer_distribution)) {
                    distribution = question.answer_distribution;
                }
            } catch (e) {
                console.error('Error parsing answer_distribution:', e);
                distribution = [];
            }
            
            if (!distribution || distribution.length === 0) {
                return <div className="text-muted">Không có dữ liệu</div>;
            }

            // Parse options safely
            let options = [];
            try {
                if (typeof question.options === 'string') {
                    options = JSON.parse(question.options);
                } else if (Array.isArray(question.options)) {
                    options = question.options;
                }
                console.log('Parsed options:', options);
            } catch (e) {
                console.error('Error parsing options:', e);
                return <div className="text-danger">Lỗi phân tích đáp án</div>;
            }

            if (!Array.isArray(options) || options.length === 0) {
                return <div className="text-muted">Không có đáp án</div>;
            }

            console.log('Parsed distribution:', distribution);
            console.log('Distribution length:', distribution.length);
            console.log('Options length:', options.length);
            
            // Log all option IDs and distribution IDs for debugging
            console.log('Option IDs:', options.map(opt => opt.option_id));
            console.log('Distribution selected_option_ids:', distribution.map(d => d.selected_option_id));

            // Create chart data
            const labels = options.map((opt, idx) => {
                const letter = String.fromCharCode(65 + idx); // A, B, C, D...
                return letter;
            });

            const data = options.map(opt => {
                const dist = distribution.find(d => {
                    // Handle both string and number types
                    const selectedId = d.selected_option_id != null ? parseInt(d.selected_option_id) : null;
                    const optionId = opt.option_id != null ? parseInt(opt.option_id) : null;
                    
                    // Also try string comparison as fallback
                    const match = (selectedId !== null && optionId !== null && selectedId === optionId) ||
                                  (String(d.selected_option_id) === String(opt.option_id));
                    return match;
                });
                const count = dist ? (parseInt(dist.selection_count) || 0) : 0;
                return count;
            });

            const backgroundColors = options.map(opt => {
                const isCorrect = opt.is_correct === 1 || opt.is_correct === true;
                return isCorrect ? 'rgba(40, 167, 69, 0.6)' : 'rgba(220, 53, 69, 0.6)';
            });

            const chartData = {
                labels,
                datasets: [{
                    label: 'Số sinh viên chọn',
                    data,
                    backgroundColor: backgroundColors,
                    borderColor: backgroundColors.map(color => color.replace('0.6', '1')),
                    borderWidth: 1
                }]
            };

            const chartOptions = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    title: {
                        display: true,
                        text: 'Phân bố lựa chọn đáp án'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? ((context.parsed.y / total) * 100).toFixed(1) : 0;
                                return `${context.parsed.y} SV (${percentage}%)`;
                            }
                        }
                    },
                    datalabels: {
                        display: true,
                        anchor: 'end',
                        align: 'top',
                        formatter: (value) => value > 0 ? value : ''
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            callback: function(value) {
                                if (Number.isInteger(value)) {
                                    return value;
                                }
                            }
                        },
                        title: {
                            display: true,
                            text: 'Số sinh viên'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Đáp án'
                        }
                    }
                }
            };

            // Check if all data is zero
            const totalSelections = data.reduce((a, b) => a + b, 0);
            if (totalSelections === 0) {
                // If we have distribution data but no matches, it might be a data mismatch
                const totalDistributionCount = distribution.reduce((sum, d) => sum + (parseInt(d.selection_count) || 0), 0);
                
                if (totalDistributionCount > 0) {
                    // We have distribution data but it doesn't match options
                    return (
                        <div className="text-warning">
                            <i className="fas fa-exclamation-triangle me-2"></i>
                            Không thể khớp dữ liệu phân bố với các đáp án. 
                            <br />
                            <small className="text-muted">
                                Có {totalDistributionCount} lựa chọn trong dữ liệu nhưng không khớp với các đáp án hiện có.
                                <br />
                                Distribution IDs: {distribution.map(d => d.selected_option_id).join(', ')}
                                <br />
                                Option IDs: {options.map(opt => opt.option_id).join(', ')}
                            </small>
                        </div>
                    );
                }
                
                return (
                    <div className="text-warning">
                        <i className="fas fa-exclamation-triangle me-2"></i>
                        Không có sinh viên nào chọn đáp án (có thể là câu hỏi tự luận hoặc chưa có dữ liệu)
                    </div>
                );
            }

            return (
                <div style={{ height: '250px', width: '100%' }}>
                    <Bar data={chartData} options={chartOptions} />
                </div>
            );
        } catch (error) {
            console.error('Error rendering answer distribution:', error);
            return <div className="text-danger">Lỗi hiển thị biểu đồ</div>;
        }
    };

    // Filter and paginate exams
    const filteredExams = examStats.filter(exam => {
        if (filters.search && !exam.exam_title.toLowerCase().includes(filters.search.toLowerCase()) &&
            !exam.exam_code?.toLowerCase().includes(filters.search.toLowerCase())) {
            return false;
        }
        if (filters.exam_type && exam.exam_type !== filters.exam_type) {
            return false;
        }
        if (filters.difficulty && exam.difficulty !== filters.difficulty) {
            return false;
        }
        return true;
    });

    const paginatedExams = filteredExams.slice(
        (pagination.page - 1) * pagination.limit,
        pagination.page * pagination.limit
    );

    return (
        <div>
            {/* Header Section */}
            <div className="session-header">
                <div className="header-content">
                    <div className="header-title d-flex flex-wrap align-items-center gap-2">
                        <div>
                            <h1>Báo cáo QA</h1>
                            <p className="header-subtitle">Phân tích chi tiết về kỳ thi và câu hỏi</p>
                        </div>

                        {/* Breadcrumb phân cấp - chỉ khi tab Kết quả thi và đã chọn học kỳ */}
                        {activeTab === 'exam-results' && hasLMSQAPermission() && (resultsViewMode === 'departments' || resultsViewMode === 'exams' || resultsViewMode === 'results') && (
                            <div className="d-flex align-items-center flex-wrap gap-2 ms-3 ps-3 border-start">
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-light"
                                    onClick={() => {
                                        setResultsViewMode('periods');
                                        setSelectedResultsPeriod(null);
                                        setSelectedResultsDepartment(null);
                                        setSelectedResultsExam(null);
                                        setResultsDepartments([]);
                                        setResultsExams([]);
                                        setExamAttempts([]);
                                        setExamFilters(prev => ({ ...prev, exam_id: '' }));
                                        setExamAttemptsPagination(prev => ({ ...prev, page: 1 }));
                                    }}
                                >
                                    <i className="fas fa-folder me-1"></i>Học kỳ thi
                                </button>

                                {selectedResultsPeriod && (
                                    <>
                                        <span className="text-muted">/</span>
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-light"
                                            onClick={() => {
                                                setResultsViewMode('departments');
                                                setSelectedResultsDepartment(null);
                                                setSelectedResultsExam(null);
                                                setResultsExams([]);
                                                setExamAttempts([]);
                                                setExamFilters(prev => ({ ...prev, exam_id: '' }));
                                                setExamAttemptsPagination(prev => ({ ...prev, page: 1 }));
                                            }}
                                        >
                                            {selectedResultsPeriod.period_name || selectedResultsPeriod.period_code || 'Học kỳ'}
                                        </button>
                                    </>
                                )}

                                {selectedResultsDepartment && (resultsViewMode === 'exams' || resultsViewMode === 'results') && (
                                    <>
                                        <span className="text-muted">/</span>
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-light"
                                            onClick={() => {
                                                setResultsViewMode('exams');
                                                setSelectedResultsExam(null);
                                                setExamAttempts([]);
                                                setExamFilters(prev => ({ ...prev, exam_id: '' }));
                                                setExamAttemptsPagination(prev => ({ ...prev, page: 1 }));
                                            }}
                                        >
                                            {selectedResultsDepartment}
                                        </button>
                                    </>
                                )}

                                {resultsViewMode === 'results' && selectedResultsExam && (
                                    <>
                                        <span className="text-muted">/</span>
                                        <span className="badge bg-primary">
                                            {selectedResultsExam.exam_title || `Kỳ thi #${selectedResultsExam.exam_id}`}
                                        </span>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="header-actions">
                        {hasLMSQAPermission() && (
                            <>
                                {/* Cài đặt - chỉ hiển thị ở tab "Báo cáo Exam" */}
                                {activeTab === 'exam-statistics' && (
                                    <Button variant="outline-light" className="create-session-btn" onClick={async () => {
                                        // Reload settings from database before opening modal
                                        await loadQASettings();
                                        setSettingsModalTab('difficulty');
                                        setShowSettingsModal(true);
                                    }}>
                                        <i className="fas fa-cog me-2"></i>Cài đặt
                                    </Button>
                                )}
                                
                                {/* Xuất PDF/Excel hàng loạt - chỉ hiển thị ở tab "Kết quả thi" */}
                                {activeTab === 'exam-results' && (
                                    <>
                                        <Button variant="outline-light" className="create-session-btn" onClick={handleBulkExportPDF} style={{ marginLeft: '8px' }}>
                                            <i className="fas fa-file-pdf me-2"></i>Xuất PDF hàng loạt
                                        </Button>
                                        <Button variant="outline-light" className="create-session-btn" onClick={handleBulkExportExcel} style={{ marginLeft: '8px' }}>
                                            <i className="fas fa-file-excel me-2"></i>Xuất Excel hàng loạt
                                        </Button>
                                    </>
                                )}
                                
                                {/* Xuất Excel/CSV - chỉ hiển thị ở tab "Dữ liệu độ tin cậy" */}
                                {activeTab === 'reliability-data' && reliabilityData && (
                                    <>
                                        <Button variant="outline-light" className="create-session-btn" onClick={exportReliabilityExcel} disabled={loadingReliabilityData} style={{ marginLeft: '8px' }}>
                                            <i className="fas fa-file-excel me-2"></i>Xuất Excel
                                        </Button>
                                        <Button variant="outline-light" className="create-session-btn" onClick={exportReliabilityCSV} disabled={loadingReliabilityData} style={{ marginLeft: '8px' }}>
                                            <i className="fas fa-file-csv me-2"></i>Xuất CSV
                                        </Button>
                                    </>
                                )}
                                
                                {/* Điều chỉnh khoảng điểm - chỉ hiển thị ở tab "Biểu đồ phổ điểm" */}
                                {activeTab === 'score-distribution' && (
                                    <Button variant="outline-light" className="create-session-btn" onClick={openScoreRangeModal} style={{ marginLeft: '8px' }}>
                                        <i className="fas fa-sliders-h me-2"></i>Điều chỉnh khoảng điểm
                                    </Button>
                                )}
                            </>
                        )}
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
                    <Tab eventKey="exam-statistics" title={
                        <span className="tab-title">
                            <i className="fas fa-chart-line me-2"></i>
                            Báo cáo Exam
                        </span>
                    }>
                        {/* Summary Cards inside tab */}
                        {!loading && examStats.length > 0 && (() => {
                            // Calculate additional statistics
                            const examsWithStudents = examStats.filter(e => e.student_count > 0);
                            const totalAttempts = examStats.reduce((sum, e) => sum + (e.student_count || 0), 0);
                            
                            // Calculate average score (from exams with data)
                            const validScores = examStats.filter(e => e.avg_score != null && !isNaN(e.avg_score));
                            const avgScoreOverall = validScores.length > 0 
                                ? validScores.reduce((sum, e) => sum + parseFloat(e.avg_score), 0) / validScores.length 
                                : null;
                            
                            // Calculate average time (from exams with data)
                            const validTimes = examStats.filter(e => e.avg_time_minutes != null && e.avg_time_minutes > 0);
                            const avgTimeOverall = validTimes.length > 0 
                                ? validTimes.reduce((sum, e) => sum + parseFloat(e.avg_time_minutes), 0) / validTimes.length 
                                : null;
                            
                            // Calculate average pass rate (from exams with data)
                            const validPassRates = examStats.filter(e => e.pass_rate != null && !isNaN(e.pass_rate));
                            const avgPassRate = validPassRates.length > 0 
                                ? validPassRates.reduce((sum, e) => sum + parseFloat(e.pass_rate), 0) / validPassRates.length 
                                : null;
                            
                            // Calculate average success rate from all exams
                            // This is an approximation since we don't have question-level data for all exams
                            // We can use a weighted average based on attempts
                            let totalSuccessRate = 0;
                            let totalWeight = 0;
                            examStats.forEach(e => {
                                if (e.avg_score != null && e.total_points != null && e.total_points > 0 && e.student_count > 0) {
                                    const successRate = (parseFloat(e.avg_score) / parseFloat(e.total_points)) * 100;
                                    const weight = e.student_count;
                                    totalSuccessRate += successRate * weight;
                                    totalWeight += weight;
                                }
                            });
                            const avgSuccessRate = totalWeight > 0 ? totalSuccessRate / totalWeight : null;
                            
                            return (
                                <div className="session-card mb-4">
                                    <div className="card-body-modern">
                                        <Row>
                                            <Col md={3}>
                                                <div className="stat-card text-center p-3">
                                                    <div className="stat-value text-primary">{examStats.length}</div>
                                                    <div className="stat-label">Tổng số kỳ thi</div>
                                                </div>
                                            </Col>
                                            <Col md={3}>
                                                <div className="stat-card text-center p-3">
                                                    <div className="stat-value text-success">
                                                        {examsWithStudents.length}
                                                    </div>
                                                    <div className="stat-label">Kỳ thi có sinh viên</div>
                                                </div>
                                            </Col>
                                            <Col md={3}>
                                                <div className="stat-card text-center p-3">
                                                    <div className="stat-value text-info">
                                                        {totalAttempts}
                                                    </div>
                                                    <div className="stat-label">Lượt làm bài</div>
                                                </div>
                                            </Col>
                                            <Col md={3}>
                                                <div className="stat-card text-center p-3">
                                                    <div className="stat-value text-warning">
                                                        {examStats.reduce((sum, e) => sum + (e.total_questions || 0), 0)}
                                                    </div>
                                                    <div className="stat-label">Tổng câu hỏi</div>
                                                </div>
                                            </Col>
                                        </Row>
                                        <Row className="mt-3">
                                            <Col md={3}>
                                                <div className="stat-card text-center p-3">
                                                    <div className="stat-value text-info">
                                                        {avgScoreOverall != null ? avgScoreOverall.toFixed(2) : 'N/A'}
                                                    </div>
                                                    <div className="stat-label">Điểm trung bình</div>
                                                </div>
                                            </Col>
                                            <Col md={3}>
                                                <div className="stat-card text-center p-3">
                                                    <div className="stat-value text-warning">
                                                        {avgTimeOverall != null ? formatDuration(avgTimeOverall) : 'N/A'}
                                                    </div>
                                                    <div className="stat-label">Thời gian TB</div>
                                                </div>
                                            </Col>
                                            <Col md={3}>
                                                <div className="stat-card text-center p-3">
                                                    <div className="stat-value text-success">
                                                        {avgSuccessRate != null ? `${avgSuccessRate.toFixed(1)}%` : 'N/A'}
                                                    </div>
                                                    <div className="stat-label">% Tỷ lệ đúng</div>
                                                </div>
                                            </Col>
                                            <Col md={3}>
                                                <div className="stat-card text-center p-3">
                                                    <div className="stat-value text-danger">
                                                        {avgPassRate != null ? `${avgPassRate.toFixed(1)}%` : 'N/A'}
                                                    </div>
                                                    <div className="stat-label">Tỷ lệ đạt</div>
                                                </div>
                                            </Col>
                                        </Row>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Filters Card */}
                        <div className="session-card mb-4">
                            <div className="card-body-modern">
                                <Row>
                                    <Col md={4}>
                                        <Form.Group>
                                            <Form.Label className="info-label">
                                                <i className="fas fa-search me-2"></i>
                                                Tìm kiếm
                                            </Form.Label>
                                            <Form.Control
                                                type="text"
                                                placeholder="Tìm kiếm theo tên hoặc mã kỳ thi..."
                                                value={filters.search}
                                                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                                                className="form-control-modern"
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={3}>
                                        <Form.Group>
                                            <Form.Label className="info-label">
                                                <i className="fas fa-list me-2"></i>
                                                Loại kỳ thi
                                            </Form.Label>
                                            <Form.Select
                                                value={filters.exam_type}
                                                onChange={(e) => setFilters({ ...filters, exam_type: e.target.value })}
                                                className="form-control-modern"
                                            >
                                                <option value="">Tất cả loại kỳ thi</option>
                                                <option value="quiz">Kiểm tra</option>
                                                <option value="midterm">Giữa kỳ</option>
                                                <option value="final">Cuối kỳ</option>
                                                <option value="practice">Luyện tập</option>
                                                <option value="osce">OSCE</option>
                                                <option value="assessment">Đánh giá</option>
                                            </Form.Select>
                                        </Form.Group>
                                    </Col>
                                    <Col md={3}>
                                        <Form.Group>
                                            <Form.Label className="info-label">
                                                <i className="fas fa-chart-bar me-2"></i>
                                                Độ khó
                                            </Form.Label>
                                            <Form.Select
                                                value={filters.difficulty}
                                                onChange={(e) => setFilters({ ...filters, difficulty: e.target.value })}
                                                className="form-control-modern"
                                            >
                                                <option value="">Tất cả độ khó</option>
                                                <option value="Dễ">Dễ</option>
                                                <option value="Trung bình">Trung bình</option>
                                                <option value="Khó">Khó</option>
                                                <option value="Rất khó">Rất khó</option>
                                            </Form.Select>
                                        </Form.Group>
                                    </Col>
                                    <Col md={2} className="d-flex align-items-end">
                                        <Button
                                            variant="outline-secondary"
                                            className="w-100"
                                            onClick={() => setFilters({ search: '', exam_type: '', difficulty: '' })}
                                        >
                                            <i className="fas fa-redo me-2"></i>
                                            Đặt lại
                                        </Button>
                                    </Col>
                                </Row>
                            </div>
                        </div>

                            <div className="card-body-modern p-0">
                                {loading ? (
                                    <div className="text-center py-5">
                                        <Spinner animation="border" role="status">
                                            <span className="visually-hidden">Đang tải...</span>
                                        </Spinner>
                                    </div>
                                ) : examStats.length === 0 ? (
                                    <div className="p-4">
                                        <Alert variant="info" className="mb-0">
                                            <i className="fas fa-info-circle me-2"></i>
                                            Chưa có kỳ thi nào trong hệ thống
                                        </Alert>
                                    </div>
                                ) : paginatedExams.length === 0 ? (
                                    <div className="p-4">
                                        <Alert variant="warning" className="mb-0">
                                            <i className="fas fa-filter me-2"></i>
                                            Không tìm thấy kỳ thi phù hợp với bộ lọc. Hãy thử điều chỉnh bộ lọc.
                                        </Alert>
                                    </div>
                                ) : (
                                    <>
                                        <div className="table-responsive">
                                            <Table hover className="session-table mb-0">
                                                <thead>
                                                    <tr>
                                                        <th>Mã kỳ thi</th>
                                                        <th>Tên kỳ thi</th>
                                                        <th>Lớp</th>
                                                        <th>Loại</th>
                                                        <th>Chế độ</th>
                                                        <th>Thời gian tạo</th>
                                                        <th className="text-center">Số SV làm</th>
                                                        <th className="text-center">Số câu hỏi</th>
                                                        <th className="text-center">Số chủ đề</th>
                                                        <th className="text-center">Điểm TB</th>
                                                        <th className="text-center">Tỷ lệ đạt</th>
                                                        <th className="text-center">Thời gian TB</th>
                                                        <th className="text-center">Độ khó</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {paginatedExams.map((exam) => (
                                                        <tr 
                                                            key={exam.exam_id}
                                                            onClick={() => {
                                                                if (exam.student_count > 0) {
                                                                    handleExamClick(exam);
                                                                }
                                                            }}
                                                            style={{ 
                                                                cursor: exam.student_count > 0 ? 'pointer' : 'default',
                                                                opacity: exam.student_count === 0 ? 0.6 : 1
                                                            }}
                                                            title={
                                                                exam.student_count === 0 ? 'Chưa có sinh viên làm bài' : 
                                                                'Click để xem chi tiết'
                                                            }
                                                        >
                                                            <td>{exam.exam_id}</td>
                                                            <td>
                                                                <div className="fw-bold">{exam.exam_title}</div>
                                                            </td>
                                                            <td>
                                                                {exam.class_name ? (
                                                                    <Badge bg="secondary">{exam.class_name}</Badge>
                                                                ) : (
                                                                    <span className="text-muted">-</span>
                                                                )}
                                                            </td>
                                                            <td>
                                                                <Badge bg={getExamTypeBadge(exam.exam_type)}>
                                                                    {getExamTypeLabel(exam.exam_type)}
                                                                </Badge>
                                                            </td>
                                                            <td>
                                                                <small>
                                                                    {getQuestionSelectionModeLabel(exam.question_selection_mode, exam.randomize_mode)}
                                                                </small>
                                                            </td>
                                                            <td>
                                                                <small>{formatDate(exam.created_at)}</small>
                                                            </td>
                                                            <td className="text-center">
                                                                <Badge bg="primary" pill>{exam.student_count || 0}</Badge>
                                                            </td>
                                                            <td className="text-center">
                                                                <Badge bg="info" pill>{exam.total_questions || 0}</Badge>
                                                            </td>
                                                            <td className="text-center">
                                                                <Badge bg="secondary" pill>{exam.total_topics || 0}</Badge>
                                                            </td>
                                                            <td className="text-center">
                                                                {exam.avg_score !== null && exam.avg_score !== undefined ? (
                                                                    <>
                                                                        <div className="fw-bold">{parseFloat(exam.avg_score).toFixed(2)}</div>
                                                                        {exam.avg_percentage !== null && exam.avg_percentage !== undefined ? (
                                                                            <small className="text-muted">({exam.avg_percentage}%)</small>
                                                                        ) : null}
                                                                    </>
                                                                ) : (
                                                                    <span className="text-muted">N/A</span>
                                                                )}
                                                            </td>
                                                            <td className="text-center">
                                                                {exam.pass_rate !== null && exam.pass_rate !== undefined && !isNaN(exam.pass_rate) ? (
                                                                    <div>
                                                                        <div className="fw-bold">{Number(exam.pass_rate).toFixed(1)}%</div>
                                                                        <ProgressBar 
                                                                            now={Number(exam.pass_rate)} 
                                                                            variant={Number(exam.pass_rate) >= 70 ? 'success' : Number(exam.pass_rate) >= 50 ? 'warning' : 'danger'}
                                                                            style={{ height: '5px' }}
                                                                        />
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-muted">-</span>
                                                                )}
                                                            </td>
                                                            <td className="text-center">
                                                                {exam.avg_time_minutes != null && !isNaN(Number(exam.avg_time_minutes)) && Number(exam.avg_time_minutes) > 0 ? (
                                                                    <>
                                                                        <div className="fw-bold">{formatDuration(Number(exam.avg_time_minutes))}</div>
                                                                        {exam.duration_minutes && (
                                                                            <small className="text-muted">
                                                                                / {exam.duration_minutes}m
                                                                            </small>
                                                                        )}
                                                                    </>
                                                                ) : (
                                                                    <span className="text-muted">-</span>
                                                                )}
                                                            </td>
                                                            <td className="text-center">
                                                                <Badge bg={getDifficultyColor(exam.difficulty)}>
                                                                    {exam.difficulty}
                                                                </Badge>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </Table>
                                        </div>
                                        
                                        {filteredExams.length > pagination.limit && (
                                            <div className="p-3">
                                                <Pagination
                                                    currentPage={pagination.page}
                                                    totalPages={Math.ceil(filteredExams.length / pagination.limit)}
                                                    onPageChange={(page) => setPagination({ ...pagination, page })}
                                                />
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                    </Tab>
                    {hasLMSQAPermission() && (
                        <Tab eventKey="exam-results" title={<span><i className="fas fa-clipboard-check me-2"></i>Kết quả thi</span>}>
                            <div className="session-table-container">
                                {loadingExamAttempts ? (
                                    <div className="text-center p-5">
                                        <Spinner animation="border" variant="primary" />
                                        <p className="mt-3">Đang tải dữ liệu...</p>
                                    </div>
                                ) : resultsViewMode === 'periods' ? (
                                    <>
                                        <div className="table-responsive-mobile">
                                            <table className="session-table">
                                                <thead>
                                                    <tr>
                                                        <th>Mã</th>
                                                        <th>Tên học kỳ thi</th>
                                                        <th>Thời gian</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {resultsExamPeriods.length === 0 ? (
                                                        <tr>
                                                            <td colSpan="3" className="text-center p-4">
                                                                <i className="fas fa-folder-open fa-3x text-muted mb-3"></i>
                                                                <p className="text-muted">Chưa có học kỳ thi.</p>
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        resultsExamPeriods
                                                            .slice((resultsPeriodsPagination.page - 1) * resultsPeriodsPagination.limit, resultsPeriodsPagination.page * resultsPeriodsPagination.limit)
                                                            .map((p) => (
                                                                <tr
                                                                    key={p.exam_period_id}
                                                                    onClick={() => {
                                                                        setSelectedResultsPeriod(p);
                                                                        setResultsViewMode('departments');
                                                                        setSelectedResultsDepartment(null);
                                                                        setSelectedResultsExam(null);
                                                                        setResultsDepartments([]);
                                                                        setResultsExams([]);
                                                                        setExamAttempts([]);
                                                                        setExamFilters(prev => ({ ...prev, exam_id: '' }));
                                                                        setExamAttemptsPagination(prev => ({ ...prev, page: 1 }));
                                                                    }}
                                                                    style={{ cursor: 'pointer' }}
                                                                    className="table-row-hover"
                                                                >
                                                                    <td><strong>{p.period_code}</strong></td>
                                                                    <td>{p.period_name}</td>
                                                                    <td>
                                                                        {p.start_date && p.end_date
                                                                            ? `${new Date(p.start_date).toLocaleDateString('vi-VN')} - ${new Date(p.end_date).toLocaleDateString('vi-VN')}`
                                                                            : '-'}
                                                                    </td>
                                                                </tr>
                                                            ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                        {resultsExamPeriods.length > 0 && resultsPeriodsPagination.totalPages > 1 && (
                                            <div className="mt-3">
                                                <Pagination
                                                    currentPage={resultsPeriodsPagination.page}
                                                    totalPages={resultsPeriodsPagination.totalPages}
                                                    onPageChange={(page) => setResultsPeriodsPagination(prev => ({ ...prev, page }))}
                                                    maxVisiblePages={5}
                                                    showFirstLast={true}
                                                />
                                            </div>
                                        )}
                                    </>
                                ) : resultsViewMode === 'departments' ? (
                                    <>
                                        <div className="table-responsive-mobile">
                                            <table className="session-table">
                                                <thead>
                                                    <tr>
                                                        <th>Khoa</th>
                                                        <th>Số kỳ thi</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {resultsDepartments.length === 0 ? (
                                                        <tr>
                                                            <td colSpan="2" className="text-center p-4">
                                                                <i className="fas fa-inbox fa-3x text-muted mb-3"></i>
                                                                <p className="text-muted">Chưa có khoa/kỳ thi trong học kỳ này.</p>
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        resultsDepartments.map((d, idx) => (
                                                            <tr
                                                                key={idx}
                                                                onClick={() => {
                                                                    setSelectedResultsDepartment(d.department_name);
                                                                    setResultsViewMode('exams');
                                                                    setSelectedResultsExam(null);
                                                                    setResultsExamsPagination(prev => ({ ...prev, page: 1 }));
                                                                    setExamAttempts([]);
                                                                    setExamFilters(prev => ({ ...prev, exam_id: '' }));
                                                                    setExamAttemptsPagination(prev => ({ ...prev, page: 1 }));
                                                                }}
                                                                style={{ cursor: 'pointer' }}
                                                                className="table-row-hover"
                                                            >
                                                                <td><strong>{d.department_name}</strong></td>
                                                                <td><Badge bg="primary">{d.exams_count || 0}</Badge></td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                ) : resultsViewMode === 'exams' ? (
                                    <>
                                        <div className="table-responsive-mobile">
                                            <table className="session-table">
                                                <thead>
                                                    <tr>
                                                        <th>Tên kỳ thi</th>
                                                        <th>Loại</th>
                                                        <th>Lớp</th>
                                                        <th>Thời gian</th>
                                                        <th style={{ width: 120 }}>Hành động</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {resultsExams.length === 0 ? (
                                                        <tr>
                                                            <td colSpan="5" className="text-center p-4">
                                                                <i className="fas fa-inbox fa-3x text-muted mb-3"></i>
                                                                <p className="text-muted">Chưa có kỳ thi nào.</p>
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        resultsExams.map((exam) => (
                                                            <tr
                                                                key={exam.exam_id}
                                                                onClick={() => {
                                                                    setSelectedResultsExam(exam);
                                                                    setResultsViewMode('results');
                                                                    setExamFilters(prev => ({ ...prev, exam_id: String(exam.exam_id) }));
                                                                    setExamAttemptsPagination(prev => ({ ...prev, page: 1 }));
                                                                }}
                                                                style={{ cursor: 'pointer' }}
                                                                className="table-row-hover"
                                                            >
                                                                <td><strong>{exam.exam_title}</strong></td>
                                                                <td>{formatExamType(exam.exam_type)}</td>
                                                                <td>{(exam.participant_class_name || exam.class_name) ? <Badge bg="info">{exam.participant_class_name || exam.class_name}</Badge> : <span className="text-muted">-</span>}</td>
                                                                <td>
                                                                    {exam.available_from ? (
                                                                        exam.available_until
                                                                            ? `${new Date(exam.available_from).toLocaleString('vi-VN')} – ${new Date(exam.available_until).toLocaleString('vi-VN')}`
                                                                            : new Date(exam.available_from).toLocaleString('vi-VN')
                                                                    ) : '-'}
                                                                </td>
                                                                <td onClick={(ev) => ev.stopPropagation()}>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline-success"
                                                                        title="Tải Excel nhập điểm (T1, MaSV, MaMH...)"
                                                                        disabled={exportingNhapDiemExamId === exam.exam_id}
                                                                        onClick={(ev) => exportNhapDiemExcelForExam(exam, ev)}
                                                                    >
                                                                        {exportingNhapDiemExamId === exam.exam_id ? (
                                                                            <Spinner animation="border" size="sm" />
                                                                        ) : (
                                                                            <><i className="fas fa-file-excel me-1"></i>Excel</>
                                                                        )}
                                                                    </Button>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                        {resultsExamsPagination.totalPages > 1 && (
                                            <div className="mt-3">
                                                <Pagination
                                                    currentPage={resultsExamsPagination.page}
                                                    totalPages={resultsExamsPagination.totalPages}
                                                    onPageChange={(page) => setResultsExamsPagination(prev => ({ ...prev, page }))}
                                                    maxVisiblePages={5}
                                                    showFirstLast={true}
                                                />
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        {/* Filters (khi đã chọn kỳ thi) */}
                                        <div className="session-list-controls mb-3">
                                            <div className="search-controls">
                                                <div className="search-input" style={{ minWidth: '350px', flex: '1' }}>
                                                    <input
                                                        type="text"
                                                        placeholder="Tìm theo tên sinh viên hoặc mã sinh viên..."
                                                        value={examFilters.search}
                                                        onChange={(e) => {
                                                            setExamFilters({ ...examFilters, search: e.target.value });
                                                            setExamAttemptsPagination(prev => ({ ...prev, page: 1 }));
                                                        }}
                                                        style={{ width: '100%' }}
                                                    />
                                                </div>

                                                <select
                                                    className="filter-select"
                                                    value={examFilters.class_name}
                                                    onChange={(e) => {
                                                        setExamFilters({ ...examFilters, class_name: e.target.value });
                                                        setExamAttemptsPagination(prev => ({ ...prev, page: 1 }));
                                                    }}
                                                >
                                                    <option value="">Tất cả lớp</option>
                                                    {Array.isArray(classes) && classes.length > 0 ? (
                                                        classes.map((cls, index) => (
                                                            <option key={cls.id || index} value={cls.name}>
                                                                {cls.name}
                                                            </option>
                                                        ))
                                                    ) : (
                                                        <option disabled>Chưa có dữ liệu lớp</option>
                                                    )}
                                                </select>

                                                <select
                                                    className="filter-select"
                                                    value={examFilters.result}
                                                    onChange={(e) => {
                                                        setExamFilters({ ...examFilters, result: e.target.value });
                                                        setExamAttemptsPagination(prev => ({ ...prev, page: 1 }));
                                                    }}
                                                >
                                                    <option value="">Tất cả kết quả</option>
                                                    <option value="passed">Đạt</option>
                                                    <option value="failed">Không đạt</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="table-responsive-mobile">
                                            <table className="session-table">
                                                <thead>
                                                    <tr>
                                                        <th>Sinh viên</th>
                                                        <th>Lớp</th>
                                                        <th>Kỳ thi</th>
                                                        <th>Thời gian bắt đầu</th>
                                                        <th>Thời gian nộp</th>
                                                        <th>Điểm</th>
                                                        <th>Kết quả</th>
                                                        <th>Hành động</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredExamAttempts.length === 0 ? (
                                                        <tr>
                                                            <td colSpan="8" className="text-center p-4">
                                                                <i className="fas fa-inbox fa-3x text-muted mb-3"></i>
                                                                <p className="text-muted">
                                                                    {examAttempts.length === 0
                                                                        ? 'Chưa có bài thi nào đã nộp'
                                                                        : 'Không tìm thấy bài thi nào phù hợp với bộ lọc đã chọn'}
                                                                </p>
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        displayedAttempts.map((attempt) => {
                                                            const score = parseFloat(attempt.score || 0);
                                                            const totalPoints = parseFloat(attempt.total_points || 0);
                                                            const percentage = totalPoints > 0 ? (score / totalPoints) * 100 : 0;
                                                            const passingScore = parseFloat(attempt.passing_score || 60);
                                                            const passed = percentage >= passingScore;

                                                            return (
                                                                <tr
                                                                    key={attempt.attempt_id}
                                                                    onClick={() => handleViewExamResults(attempt)}
                                                                    style={{ cursor: 'pointer' }}
                                                                    className="table-row-hover"
                                                                >
                                                                    <td>
                                                                        <strong>{attempt.student_name || 'N/A'}</strong>
                                                                        {attempt.student_id && (
                                                                            <div className="text-muted small">{attempt.student_id}</div>
                                                                        )}
                                                                    </td>
                                                                    <td>
                                                                        {attempt.class_name ? (
                                                                            <Badge bg="info">{attempt.class_name}</Badge>
                                                                        ) : (
                                                                            <span className="text-muted">-</span>
                                                                        )}
                                                                    </td>
                                                                    <td>{attempt.exam_title || selectedResultsExam?.exam_title || 'N/A'}</td>
                                                                    <td>{formatDateTime(attempt.start_time)}</td>
                                                                    <td>{formatDateTime(attempt.submit_time || attempt.end_time)}</td>
                                                                    <td>
                                                                        <Badge bg={passed ? 'success' : 'danger'}>
                                                                            {formatNumber(score)} / {formatNumber(totalPoints)}
                                                                        </Badge>
                                                                        <div className="text-muted small mt-1">{formatNumber(percentage)}%</div>
                                                                    </td>
                                                                    <td>
                                                                        <Badge bg={passed ? 'success' : 'danger'}>
                                                                            {passed ? 'Đạt' : 'Không đạt'}
                                                                        </Badge>
                                                                    </td>
                                                                    <td onClick={(e) => e.stopPropagation()}>
                                                                        <div style={{ display: 'flex', gap: '4px' }}>
                                                                            <Button
                                                                                ref={pdfExportButtonFromListRef}
                                                                                size="sm"
                                                                                variant="outline-danger"
                                                                                onClick={(e) => handleExportPDFFromAttempt(attempt, e)}
                                                                                title="Xuất PDF"
                                                                            >
                                                                                <i className="fas fa-file-pdf"></i>
                                                                            </Button>
                                                                            <Button
                                                                                ref={excelExportButtonFromListRef}
                                                                                size="sm"
                                                                                variant="outline-success"
                                                                                onClick={(e) => handleExportExcelFromAttempt(attempt, e)}
                                                                                title="Xuất Excel"
                                                                            >
                                                                                <i className="fas fa-file-excel"></i>
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

                                        {filteredExamAttempts.length > 0 && examAttemptsPagination.totalPages > 1 && (
                                            <div className="mt-3">
                                                <Pagination
                                                    currentPage={examAttemptsPagination.page}
                                                    totalPages={examAttemptsPagination.totalPages}
                                                    onPageChange={(page) => setExamAttemptsPagination(prev => ({ ...prev, page }))}
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
                    
                    {/* Reliability Data Tab */}
                    {hasLMSQAPermission() && (
                        <Tab eventKey="reliability-data" title={<span><i className="fas fa-calculator me-2"></i>Dữ liệu độ tin cậy</span>}>
                            {/* Filters */}
                            <div className="mb-3" style={{ 
                                display: 'flex', 
                                justifyContent: 'center', 
                                alignItems: 'center',
                                gap: '20px',
                                padding: '16px 0'
                            }}>
                                <select
                                    value={reliabilityFilters.exam_id}
                                    onChange={(e) => {
                                        setReliabilityFilters({ ...reliabilityFilters, exam_id: e.target.value });
                                        if (e.target.value) {
                                            fetchReliabilityData(e.target.value);
                                        } else {
                                            setReliabilityData(null);
                                        }
                                    }}
                                    style={{
                                        minWidth: '500px',
                                        padding: '16px 24px',
                                        fontSize: '17px',
                                        border: '2px solid #e3e8ef',
                                        borderRadius: '14px',
                                        backgroundColor: '#ffffff',
                                        color: '#2c3e50',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s ease',
                                        outline: 'none',
                                        fontWeight: '600',
                                        boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                                        height: '58px',
                                        lineHeight: '1.8',
                                        display: 'flex',
                                        alignItems: 'center',
                                        verticalAlign: 'middle'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.target.style.borderColor = '#d1d5db';
                                        e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.08)';
                                    }}
                                    onMouseLeave={(e) => {
                                        if (document.activeElement !== e.target) {
                                            e.target.style.borderColor = '#e3e8ef';
                                            e.target.style.boxShadow = '0 2px 6px rgba(0,0,0,0.06)';
                                        }
                                    }}
                                    onFocus={(e) => {
                                        e.target.style.borderColor = '#4f46e5';
                                        e.target.style.boxShadow = '0 0 0 4px rgba(79, 70, 229, 0.12)';
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.borderColor = '#e3e8ef';
                                        e.target.style.boxShadow = '0 2px 6px rgba(0,0,0,0.06)';
                                    }}
                                >
                                    <option value="" style={{ fontSize: '17px', padding: '12px' }}>
                                        Chọn kỳ thi để xem dữ liệu...
                                    </option>
                                    {Array.isArray(exams) && exams.map((exam) => (
                                        <option 
                                            key={exam.exam_id} 
                                            value={exam.exam_id}
                                            style={{ fontSize: '16px', padding: '12px' }}
                                        >
                                            {exam.exam_title}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            
                            {/* Content */}
                            <div className="session-table-container">
                                {loadingReliabilityData ? (
                                    <div className="text-center p-5">
                                        <Spinner animation="border" variant="primary" />
                                        <p className="mt-3">Đang tải dữ liệu độ tin cậy...</p>
                                    </div>
                                ) : !reliabilityData ? (
                                    <div className="text-center p-5">
                                        <i className="fas fa-calculator fa-3x text-muted mb-3"></i>
                                        <p className="text-muted">Vui lòng chọn kỳ thi để xem dữ liệu độ tin cậy</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Summary Card */}
                                        <div className="session-card mb-4">
                                            <div className="card-header-modern">
                                                <div className="header-icon">
                                                    <i className="fas fa-info-circle"></i>
                                                </div>
                                                <h6>Thông tin tổng quan</h6>
                                            </div>
                                            <div className="card-body-modern">
                                                <Row>
                                                    <Col md={3}>
                                                        <div className="stat-card text-center p-3">
                                                            <div className="stat-value text-primary">{reliabilityData.total_students || 0}</div>
                                                            <div className="stat-label">Sinh viên</div>
                                                        </div>
                                                    </Col>
                                                    <Col md={3}>
                                                        <div className="stat-card text-center p-3">
                                                            <div className="stat-value text-info">{reliabilityData.total_questions || 0}</div>
                                                            <div className="stat-label">Câu hỏi</div>
                                                        </div>
                                                    </Col>
                                                    <Col md={6}>
                                                        <Alert variant="info" className="mb-0">
                                                            <i className="fas fa-lightbulb me-2"></i>
                                                            <strong>Hướng dẫn:</strong> Dữ liệu này có thể được sử dụng để tính toán độ tin cậy (Cronbach's Alpha, KR-20, KR-21) bằng các phần mềm thống kê như SPSS, R, hoặc Excel.
                                                        </Alert>
                                                    </Col>
                                                </Row>
                                            </div>
                                        </div>
                                        
                                        {/* Matrix Preview */}
                                        <div className="session-card mb-4">
                                            <div className="card-header-modern">
                                                <div className="header-icon">
                                                    <i className="fas fa-table"></i>
                                                </div>
                                                <h6>Ma trận điểm (Preview)</h6>
                                            </div>
                                            <div className="card-body-modern">
                                                <div className="table-responsive" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                                                    <Table striped bordered hover size="sm">
                                                        <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', zIndex: 1 }}>
                                                            <tr>
                                                                <th style={{ minWidth: '100px' }}>Mã SV</th>
                                                                <th style={{ minWidth: '200px' }}>Họ tên</th>
                                                                {reliabilityData.question_metadata && reliabilityData.question_metadata.map((q, index) => (
                                                                    <th key={index} className="text-center" style={{ minWidth: '60px' }}>
                                                                        <div>Câu {index + 1}</div>
                                                                        <small className="text-muted">({q.max_points}đ)</small>
                                                                    </th>
                                                                ))}
                                                                <th className="text-center" style={{ minWidth: '80px' }}>Tổng</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {reliabilityData.matrix && reliabilityData.matrix.map((student, idx) => (
                                                                <tr key={idx}>
                                                                    <td>{student.student_code || 'N/A'}</td>
                                                                    <td>{student.student_name || 'N/A'}</td>
                                                                    {student.scores && student.scores.map((score, qIdx) => (
                                                                        <td key={qIdx} className="text-center">
                                                                            {score !== null && score !== undefined ? score : '-'}
                                                                        </td>
                                                                    ))}
                                                                    <td className="text-center">
                                                                        <strong>{student.total_score || 0}</strong>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </Table>
                                                </div>
                                                
                                                {reliabilityData.matrix && reliabilityData.matrix.length > 10 && (
                                                    <div className="mt-3">
                                                        <Alert variant="secondary" className="mb-0">
                                                            <i className="fas fa-info-circle me-2"></i>
                                                            Hiển thị {reliabilityData.matrix.length} sinh viên. Sử dụng nút <strong>Xuất Excel</strong> hoặc <strong>Xuất CSV</strong> để tải toàn bộ dữ liệu.
                                                        </Alert>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {/* Question Metadata */}
                                        <div className="session-card">
                                            <div className="card-header-modern">
                                                <div className="header-icon">
                                                    <i className="fas fa-list"></i>
                                                </div>
                                                <h6>Thông tin câu hỏi</h6>
                                            </div>
                                            <div className="card-body-modern">
                                                <div className="table-responsive">
                                                    <Table striped bordered hover size="sm">
                                                        <thead>
                                                            <tr>
                                                                <th style={{ width: '80px' }}>Câu</th>
                                                                <th style={{ minWidth: '400px' }}>Nội dung</th>
                                                                <th style={{ width: '150px' }}>Loại</th>
                                                                <th className="text-center" style={{ width: '120px' }}>Điểm tối đa</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {reliabilityData.question_metadata && reliabilityData.question_metadata.map((q, index) => (
                                                                <tr key={index}>
                                                                    <td>Câu {index + 1}</td>
                                                                    <td>
                                                                        {q.question_text ? (
                                                                            <div 
                                                                                dangerouslySetInnerHTML={{ __html: q.question_text }}
                                                                                style={{ 
                                                                                    maxHeight: '120px',
                                                                                    overflow: 'auto',
                                                                                    lineHeight: '1.5',
                                                                                    wordBreak: 'break-word'
                                                                                }}
                                                                            />
                                                                        ) : (
                                                                            <span className="text-muted">Không có nội dung</span>
                                                                        )}
                                                                    </td>
                                                                    <td>
                                                                        <Badge bg="info">
                                                                            {q.question_type === 'mcq' ? 'Trắc nghiệm' :
                                                                             q.question_type === 'true_false' ? 'Đúng/Sai' :
                                                                             q.question_type === 'essay' ? 'Tự luận' :
                                                                             q.question_type === 'short_answer' ? 'Câu ngắn' :
                                                                             q.question_type}
                                                                        </Badge>
                                                                    </td>
                                                                    <td className="text-center">{q.max_points}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </Table>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </Tab>
                    )}
                    
                    {/* Score Distribution Tab */}
                    {hasLMSQAPermission() && (
                        <Tab eventKey="score-distribution" title={<span><i className="fas fa-chart-bar me-2"></i>Biểu đồ phổ điểm</span>}>
                            {/* Filters */}
                            <div className="mb-3" style={{ 
                                display: 'flex', 
                                justifyContent: 'center', 
                                alignItems: 'center',
                                gap: '20px',
                                padding: '16px 0'
                            }}>
                                <select
                                    value={scoreDistributionFilters.exam_id}
                                    onChange={(e) => {
                                        setScoreDistributionFilters({ ...scoreDistributionFilters, exam_id: e.target.value });
                                        if (e.target.value) {
                                            fetchScoreDistribution(e.target.value);
                                        } else {
                                            setScoreDistributionData(null);
                                        }
                                    }}
                                    style={{
                                        minWidth: '500px',
                                        padding: '16px 24px',
                                        fontSize: '17px',
                                        border: '2px solid #e3e8ef',
                                        borderRadius: '14px',
                                        backgroundColor: '#ffffff',
                                        color: '#2c3e50',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s ease',
                                        outline: 'none',
                                        fontWeight: '600',
                                        boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                                        height: '58px',
                                        lineHeight: '1.8',
                                        display: 'flex',
                                        alignItems: 'center',
                                        verticalAlign: 'middle'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.target.style.borderColor = '#d1d5db';
                                        e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.08)';
                                    }}
                                    onMouseLeave={(e) => {
                                        if (document.activeElement !== e.target) {
                                            e.target.style.borderColor = '#e3e8ef';
                                            e.target.style.boxShadow = '0 2px 6px rgba(0,0,0,0.06)';
                                        }
                                    }}
                                    onFocus={(e) => {
                                        e.target.style.borderColor = '#4f46e5';
                                        e.target.style.boxShadow = '0 0 0 4px rgba(79, 70, 229, 0.12)';
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.borderColor = '#e3e8ef';
                                        e.target.style.boxShadow = '0 2px 6px rgba(0,0,0,0.06)';
                                    }}
                                >
                                    <option value="" style={{ fontSize: '17px', padding: '12px' }}>
                                        Chọn kỳ thi để xem biểu đồ...
                                    </option>
                                    {Array.isArray(exams) && exams.map((exam) => (
                                        <option 
                                            key={exam.exam_id} 
                                            value={exam.exam_id}
                                            style={{ fontSize: '16px', padding: '12px' }}
                                        >
                                            {exam.exam_title}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            
                            {/* Content */}
                            <div className="session-table-container">
                                {loadingScoreDistribution ? (
                                    <div className="text-center p-5">
                                        <Spinner animation="border" variant="primary" />
                                        <p className="mt-3">Đang tải dữ liệu phổ điểm...</p>
                                    </div>
                                ) : !scoreDistributionData ? (
                                    <div className="text-center p-5">
                                        <i className="fas fa-chart-bar fa-3x text-muted mb-3"></i>
                                        <p className="text-muted">Vui lòng chọn kỳ thi để xem biểu đồ phổ điểm</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Summary Card */}
                                        <div className="session-card mb-4">
                                            <div className="card-header-modern">
                                                <div className="header-icon">
                                                    <i className="fas fa-info-circle"></i>
                                                </div>
                                                <h6>Thông tin phân phối</h6>
                                            </div>
                                            <div className="card-body-modern">
                                                <Row>
                                                    <Col md={3}>
                                                        <div className="stat-card text-center p-3">
                                                            <div className="stat-value text-primary">{scoreDistributionData.total_students || 0}</div>
                                                            <div className="stat-label">Tổng sinh viên</div>
                                                        </div>
                                                    </Col>
                                                    <Col md={3}>
                                                        <div className="stat-card text-center p-3">
                                                            <div className="stat-value text-success">{scoreDistributionData.average_score || 0}</div>
                                                            <div className="stat-label">Điểm trung bình</div>
                                                        </div>
                                                    </Col>
                                                    <Col md={3}>
                                                        <div className="stat-card text-center p-3">
                                                            <div className="stat-value text-info">{scoreDistributionData.max_score || 0}</div>
                                                            <div className="stat-label">Điểm cao nhất</div>
                                                        </div>
                                                    </Col>
                                                    <Col md={3}>
                                                        <div className="stat-card text-center p-3">
                                                            <div className="stat-value text-warning">{scoreDistributionData.min_score || 0}</div>
                                                            <div className="stat-label">Điểm thấp nhất</div>
                                                        </div>
                                                    </Col>
                                                </Row>
                                            </div>
                                        </div>
                                        
                                        {/* Chart */}
                                        <div className="session-card mb-4">
                                            <div className="card-header-modern">
                                                <div className="header-icon">
                                                    <i className="fas fa-chart-bar"></i>
                                                </div>
                                                <h6>Biểu đồ phân phối điểm</h6>
                                            </div>
                                            <div className="card-body-modern" style={{ padding: '32px' }}>
                                                <div style={{ height: '400px' }}>
                                                    <Bar
                                                        data={{
                                                            labels: scoreDistributionData.distribution.map(d => d.label),
                                                            datasets: [{
                                                                label: 'Số lượng sinh viên',
                                                                data: scoreDistributionData.distribution.map(d => d.count),
                                                                backgroundColor: scoreDistributionData.distribution.map(d => d.color + '40'),
                                                                borderColor: scoreDistributionData.distribution.map(d => d.color),
                                                                borderWidth: 2,
                                                                borderRadius: 8,
                                                                barThickness: 60
                                                            }]
                                                        }}
                                                        options={{
                                                            responsive: true,
                                                            maintainAspectRatio: false,
                                                            animation: {
                                                                duration: 1000,
                                                                easing: 'easeInOutQuart'
                                                            },
                                                            plugins: {
                                                                legend: {
                                                                    display: false
                                                                },
                                                                tooltip: {
                                                                    backgroundColor: 'rgba(0,0,0,0.8)',
                                                                    padding: 12,
                                                                    titleFont: { size: 14, weight: 'bold' },
                                                                    bodyFont: { size: 13 },
                                                                    callbacks: {
                                                                        label: function(context) {
                                                                            const count = context.parsed.y;
                                                                            const percentage = ((count / scoreDistributionData.total_students) * 100).toFixed(1);
                                                                            return `Số lượng: ${count} sinh viên (${percentage}%)`;
                                                                        }
                                                                    }
                                                                }
                                                            },
                                                            scales: {
                                                                y: {
                                                                    beginAtZero: true,
                                                                    ticks: {
                                                                        stepSize: 1,
                                                                        font: { size: 13 }
                                                                    },
                                                                    grid: {
                                                                        color: 'rgba(0,0,0,0.05)'
                                                                    }
                                                                },
                                                                x: {
                                                                    ticks: {
                                                                        font: { size: 14, weight: 'bold' }
                                                                    },
                                                                    grid: {
                                                                        display: false
                                                                    }
                                                                }
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* Distribution Table */}
                                        <div className="session-card">
                                            <div className="card-header-modern">
                                                <div className="header-icon">
                                                    <i className="fas fa-table"></i>
                                                </div>
                                                <h6>Chi tiết phân phối</h6>
                                            </div>
                                            <div className="card-body-modern">
                                                <Table striped bordered hover>
                                                    <thead>
                                                        <tr>
                                                            <th style={{ width: '30%' }}>Khoảng điểm</th>
                                                            <th className="text-center" style={{ width: '20%' }}>Số lượng</th>
                                                            <th className="text-center" style={{ width: '20%' }}>Tỷ lệ</th>
                                                            <th style={{ width: '30%' }}>Biểu đồ</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {scoreDistributionData.distribution.map((dist, index) => (
                                                            <tr key={index}>
                                                                <td>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                                        <div style={{
                                                                            width: '20px',
                                                                            height: '20px',
                                                                            borderRadius: '4px',
                                                                            backgroundColor: dist.color
                                                                        }}></div>
                                                                        <strong>{dist.label}</strong>
                                                                    </div>
                                                                </td>
                                                                <td className="text-center">
                                                                    <strong style={{ fontSize: '16px' }}>{dist.count}</strong> sinh viên
                                                                </td>
                                                                <td className="text-center">
                                                                    <Badge 
                                                                        bg="primary" 
                                                                        style={{ 
                                                                            fontSize: '14px', 
                                                                            padding: '6px 12px',
                                                                            backgroundColor: dist.color,
                                                                            border: 'none'
                                                                        }}
                                                                    >
                                                                        {dist.percentage}%
                                                                    </Badge>
                                                                </td>
                                                                <td>
                                                                    <div style={{ 
                                                                        width: '100%', 
                                                                        height: '24px', 
                                                                        backgroundColor: '#f0f0f0',
                                                                        borderRadius: '12px',
                                                                        overflow: 'hidden'
                                                                    }}>
                                                                        <div style={{
                                                                            width: `${dist.percentage}%`,
                                                                            height: '100%',
                                                                            backgroundColor: dist.color,
                                                                            transition: 'width 0.8s ease',
                                                                            borderRadius: '12px'
                                                                        }}></div>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </Table>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </Tab>
                    )}
                    
                    {/* Bộ câu hỏi theo kỳ thi - lms_exam_topic_question_sets + lms_attempt_questions */}
                    {hasLMSQAPermission() && (
                        <Tab eventKey="question-sets" title={<span><i className="fas fa-layer-group me-2"></i>Bộ câu hỏi theo kỳ thi</span>}>
                            <div className="mb-3" style={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: '20px',
                                padding: '16px 0'
                            }}>
                                <select
                                    value={questionSetsFilters.exam_id}
                                    onChange={(e) => {
                                        const examId = e.target.value || '';
                                        loadQuestionSetsTabData(examId);
                                    }}
                                    style={{
                                        minWidth: '500px',
                                        padding: '16px 24px',
                                        fontSize: '17px',
                                        border: '2px solid #e3e8ef',
                                        borderRadius: '14px',
                                        backgroundColor: '#ffffff',
                                        color: '#2c3e50',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s ease',
                                        outline: 'none',
                                        fontWeight: '600',
                                        boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                                        height: '58px'
                                    }}
                                >
                                    <option value="">Chọn kỳ thi để xem bộ câu hỏi...</option>
                                    {Array.isArray(exams) && exams.map((exam) => (
                                        <option key={exam.exam_id} value={exam.exam_id}>
                                            {exam.exam_title}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="session-table-container">
                                {!questionSetsFilters.exam_id ? (
                                    <div className="text-center p-5">
                                        <i className="fas fa-layer-group fa-3x text-muted mb-3"></i>
                                        <p className="text-muted">Vui lòng chọn kỳ thi để xem bộ câu hỏi và câu hỏi theo lần làm bài</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* 1. Bộ câu hỏi cố định theo chủ đề - mỗi dòng là một câu hỏi */}
                                        <div className="session-card mb-4">
                                            <div className="card-header-modern">
                                                <div className="header-icon"><i className="fas fa-database"></i></div>
                                                <h6>Bộ câu hỏi cố định theo chủ đề (mỗi dòng = một câu hỏi)</h6>
                                            </div>
                                            <div className="card-body-modern">
                                                {loadingQuestionSets ? (
                                                    <div className="text-center p-4">
                                                        <Spinner animation="border" variant="primary" />
                                                        <p className="mt-2">Đang tải...</p>
                                                    </div>
                                                ) : !questionSetsData || questionSetsData.length === 0 ? (
                                                    <p className="text-muted mb-0">Không có bộ câu hỏi cố định (kỳ thi không dùng Random cố định hoặc chưa tạo bộ).</p>
                                                ) : (
                                                    <Table striped bordered hover responsive>
                                                        <thead>
                                                            <tr>
                                                                <th style={{ width: '60px' }}>Mã bộ</th>
                                                                <th>Tên kỳ thi</th>
                                                                <th>Chủ đề</th>
                                                                <th style={{ width: '90px' }}>Mã chủ đề</th>
                                                                <th style={{ width: '70px' }} className="text-center">STT câu</th>
                                                                <th>Nội dung câu hỏi</th>
                                                                <th style={{ width: '130px' }}>Ngày tạo bộ</th>
                                                                <th style={{ width: '130px' }}>Ngày cập nhật</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {questionSetsData.map((row, idx) => (
                                                                <tr key={`${row.set_id}-${row.question_id}-${idx}`}>
                                                                    <td>{row.set_id}</td>
                                                                    <td>{row.exam_title || '—'}</td>
                                                                    <td>{row.topic_name || '—'}</td>
                                                                    <td>{row.topic_code ?? '—'}</td>
                                                                    <td className="text-center">{row.question_order}</td>
                                                                    <td style={{ maxWidth: '400px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }} title={row.question_text}>
                                                                        {(row.question_text || '').length > 200 ? `${(row.question_text || '').slice(0, 200)}...` : (row.question_text || '—')}
                                                                    </td>
                                                                    <td>{row.set_created_at ? new Date(row.set_created_at).toLocaleString() : '—'}</td>
                                                                    <td>{row.set_updated_at ? new Date(row.set_updated_at).toLocaleString() : '—'}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </Table>
                                                )}
                                            </div>
                                        </div>
                                        {/* 2. Câu hỏi theo từng lần làm bài */}
                                        <div className="session-card mb-4">
                                            <div className="card-header-modern">
                                                <div className="header-icon"><i className="fas fa-list-ol"></i></div>
                                                <h6>Câu hỏi theo từng lần làm bài (mỗi dòng = một câu trong một lượt thi)</h6>
                                            </div>
                                            <div className="card-body-modern">
                                                {loadingAttemptQuestions ? (
                                                    <div className="text-center p-4">
                                                        <Spinner animation="border" variant="primary" />
                                                        <p className="mt-2">Đang tải...</p>
                                                    </div>
                                                ) : !attemptQuestionsData || attemptQuestionsData.length === 0 ? (
                                                    <p className="text-muted mb-0">Chưa có lần làm bài nào hoặc không có dữ liệu.</p>
                                                ) : (
                                                    <>
                                                        <p className="text-muted small mb-2">
                                                            Tổng {attemptQuestionsPagination.total} bản ghi (trang {attemptQuestionsPagination.page}/{attemptQuestionsPagination.totalPages || 1}).
                                                        </p>
                                                        <Table striped bordered hover responsive>
                                                            <thead>
                                                                <tr>
                                                                    <th style={{ width: '70px' }}>Mã bản ghi</th>
                                                                    <th style={{ width: '80px' }}>Lần làm bài</th>
                                                                    <th>Tên kỳ thi</th>
                                                                    <th>Thí sinh</th>
                                                                    <th style={{ width: '60px' }} className="text-center">STT câu</th>
                                                                    <th>Nội dung câu hỏi</th>
                                                                    <th style={{ width: '70px' }} className="text-center">Điểm</th>
                                                                    <th style={{ width: '60px' }} className="text-center">Bonus</th>
                                                                    <th style={{ width: '100px' }}>Trạng thái</th>
                                                                    <th style={{ width: '130px' }}>Thời gian</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {attemptQuestionsData.map((row) => (
                                                                    <tr key={row.attempt_question_id}>
                                                                        <td>{row.attempt_question_id}</td>
                                                                        <td>{row.attempt_id}</td>
                                                                        <td>{row.exam_title || '—'}</td>
                                                                        <td>{row.user_full_name || row.user_email || '—'}</td>
                                                                        <td className="text-center">{row.question_order}</td>
                                                                        <td style={{ maxWidth: '350px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }} title={row.question_content}>
                                                                            {(row.question_content || '').length > 180 ? `${(row.question_content || '').slice(0, 180)}...` : (row.question_content || '—')}
                                                                        </td>
                                                                        <td className="text-center">{row.points != null ? row.points : '—'}</td>
                                                                        <td className="text-center">{row.is_bonus ? 'Có' : 'Không'}</td>
                                                                        <td>{row.attempt_status || '—'}</td>
                                                                        <td>{row.created_at ? new Date(row.created_at).toLocaleString() : '—'}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </Table>
                                                        {attemptQuestionsPagination.totalPages > 1 && (
                                                            <div className="d-flex justify-content-between align-items-center mt-3">
                                                                <span className="text-muted">
                                                                    Trang {attemptQuestionsPagination.page} / {attemptQuestionsPagination.totalPages}
                                                                </span>
                                                                <div className="d-flex gap-2">
                                                                    <Button
                                                                        variant="outline-primary"
                                                                        size="sm"
                                                                        disabled={attemptQuestionsPagination.page <= 1}
                                                                        onClick={() => fetchAttemptQuestionsData(questionSetsFilters.exam_id, attemptQuestionsPagination.page - 1)}
                                                                    >
                                                                        Trước
                                                                    </Button>
                                                                    <Button
                                                                        variant="outline-primary"
                                                                        size="sm"
                                                                        disabled={attemptQuestionsPagination.page >= attemptQuestionsPagination.totalPages}
                                                                        onClick={() => fetchAttemptQuestionsData(questionSetsFilters.exam_id, attemptQuestionsPagination.page + 1)}
                                                                    >
                                                                        Sau
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </Tab>
                    )}
                </Tabs>
            </div>

            {/* Question Statistics Modal */}
            <Modal
                show={showQuestionModal}
                onHide={() => {
                    setShowQuestionModal(false);
                    setExpandedQuestion(null);
                    setStudentsGrouped(null);
                }}
                fullscreen={true}
                className="student-detail-modal"
                dialogClassName="fullscreen-modal"
            >
                <Modal.Header closeButton className="student-detail-header">
                    <Modal.Title className="student-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-question-circle"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Chi tiết Câu hỏi</h4>
                            <p className="mb-0 student-subtitle">{selectedExam?.exam_title}</p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="student-detail-body" style={{ flex: 1, overflowY: 'auto', padding: '20px', minHeight: 0 }}>
                    {loadingQuestions ? (
                        <div className="text-center py-5">
                            <Spinner animation="border" role="status">
                                <span className="visually-hidden">Đang tải...</span>
                            </Spinner>
                        </div>
                    ) : (
                        <>
                            {/* Phân nhóm sinh viên theo kết quả bài thi */}
                            {studentsGrouped && (
                                <div className="mb-4">
                                    <div className="session-card">
                                        <div className="card-header-modern">
                                            <div className="header-icon">
                                                <i className="fas fa-users"></i>
                                            </div>
                                            <h6 className="mb-0">Phân nhóm sinh viên theo kết quả bài thi</h6>
                                        </div>
                                        <div className="card-body-modern">
                                            {loadingStudents ? (
                                                <div className="text-center py-3">
                                                    <Spinner animation="border" size="sm" />
                                                    <span className="ms-2">Đang tải danh sách sinh viên...</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="mb-3">
                                                        <small className="text-muted">
                                                            Tổng số sinh viên: <strong>{studentsGrouped.total}</strong> | 
                                                            Tổng điểm: <strong>{studentsGrouped.exam.total_points}</strong>
                                                        </small>
                                                    </div>
                                                    
                                                    {(() => {
                                                        // Tạo mảng các nhóm có dữ liệu
                                                        const activeGroups = [];
                                                        if (studentsGrouped.groups.excellent.length > 0) {
                                                            activeGroups.push({
                                                                key: 'excellent',
                                                                label: 'Xuất sắc',
                                                                badge: 'success',
                                                                icon: 'fa-star',
                                                                threshold: `≥ ${discriminationThresholds.excellent * 100}% điểm`,
                                                                students: studentsGrouped.groups.excellent
                                                            });
                                                        }
                                                        if (studentsGrouped.groups.good.length > 0) {
                                                            activeGroups.push({
                                                                key: 'good',
                                                                label: 'Tốt',
                                                                badge: 'primary',
                                                                icon: 'fa-check-circle',
                                                                threshold: `${discriminationThresholds.good * 100}% - ${discriminationThresholds.excellent * 100}% điểm`,
                                                                students: studentsGrouped.groups.good
                                                            });
                                                        }
                                                        if (studentsGrouped.groups.acceptable.length > 0) {
                                                            activeGroups.push({
                                                                key: 'acceptable',
                                                                label: 'Chấp nhận được',
                                                                badge: 'info',
                                                                icon: 'fa-check',
                                                                threshold: `${discriminationThresholds.acceptable * 100}% - ${discriminationThresholds.good * 100}% điểm`,
                                                                students: studentsGrouped.groups.acceptable
                                                            });
                                                        }
                                                        if (studentsGrouped.groups.needsImprovement.length > 0) {
                                                            activeGroups.push({
                                                                key: 'needsImprovement',
                                                                label: 'Cần cải thiện',
                                                                badge: 'warning',
                                                                icon: 'fa-exclamation-circle',
                                                                threshold: `${discriminationThresholds.needsImprovement * 100}% - ${discriminationThresholds.acceptable * 100}% điểm`,
                                                                students: studentsGrouped.groups.needsImprovement
                                                            });
                                                        }
                                                        if (studentsGrouped.groups.poor.length > 0) {
                                                            activeGroups.push({
                                                                key: 'poor',
                                                                label: 'Kém',
                                                                badge: 'danger',
                                                                icon: 'fa-times-circle',
                                                                threshold: `< ${discriminationThresholds.needsImprovement * 100}% điểm`,
                                                                students: studentsGrouped.groups.poor
                                                            });
                                                        }

                                                        const groupCount = activeGroups.length;
                                                        // Xác định số cột: 1 nhóm = 1 cột, 2-4 nhóm = 2 cột
                                                        const colSize = groupCount === 1 ? 12 : 6;

                                                        return (
                                                            <Row>
                                                                {activeGroups.map((group, index) => (
                                                                    <Col key={group.key} md={colSize} className="mb-3">
                                                                        <div className="h-100">
                                                                            <div className="d-flex align-items-center mb-2">
                                                                                <Badge bg={group.badge} className="me-2">
                                                                                    <i className={`fas ${group.icon} me-1`}></i>
                                                                                    {group.label}
                                                                                </Badge>
                                                                                <span className="text-muted small">
                                                                                    ({group.threshold})
                                                                                </span>
                                                                                <span className="ms-auto text-muted small">
                                                                                    {group.students.length} sinh viên
                                                                                </span>
                                                                            </div>
                                                                            <div className="table-responsive">
                                                                                <Table striped bordered hover size="sm">
                                                                                    <thead>
                                                                                        <tr>
                                                                                            <th>STT</th>
                                                                                            <th>Mã SV</th>
                                                                                            <th>Họ tên</th>
                                                                                            <th>Lớp</th>
                                                                                            <th>Điểm</th>
                                                                                            <th>Tỷ lệ %</th>
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody>
                                                                                        {group.students.map((student, idx) => (
                                                                                            <tr key={student.user_id}>
                                                                                                <td>{idx + 1}</td>
                                                                                                <td>{student.student_id || 'N/A'}</td>
                                                                                                <td>{student.full_name || 'N/A'}</td>
                                                                                                <td>{student.class_name || 'N/A'}</td>
                                                                                                <td>{formatNumber(student.score)}</td>
                                                                                                <td>
                                                                                                    <Badge bg={group.badge}>
                                                                                                        {student.percentage.toFixed(2)}%
                                                                                                    </Badge>
                                                                                                </td>
                                                                                            </tr>
                                                                                        ))}
                                                                                    </tbody>
                                                                                </Table>
                                                                            </div>
                                                                        </div>
                                                                    </Col>
                                                                ))}
                                                            </Row>
                                                        );
                                                    })()}

                                                    {studentsGrouped.total === 0 && (
                                                        <Alert variant="info" className="mb-0">
                                                            <i className="fas fa-info-circle me-2"></i>
                                                            Chưa có sinh viên nào làm bài thi này.
                                                        </Alert>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {questionStats.length === 0 ? (
                                <Alert variant="info">
                                    <i className="fas fa-info-circle me-2"></i>
                                    Không có dữ liệu câu hỏi cho kỳ thi này
                                </Alert>
                            ) : (
                                <div className="accordion" id="questionAccordion">
                            {questionStats.map((question, index) => (
                                <div className="accordion-item mb-3" key={question.question_id}>
                                    <h2 className="accordion-header">
                                        <button
                                            className={`accordion-button ${expandedQuestion === question.question_id ? '' : 'collapsed'}`}
                                            type="button"
                                            onClick={() => toggleQuestion(question.question_id)}
                                            aria-expanded={expandedQuestion === question.question_id}
                                        >
                                            <div className="w-100">
                                                <Row className="align-items-center">
                                                    <Col md={1}>
                                                        <Badge bg="secondary">#{index + 1}</Badge>
                                                    </Col>
                                                    <Col md={5}>
                                                        <div 
                                                            dangerouslySetInnerHTML={{ __html: question.question_text }}
                                                            style={{ 
                                                                maxHeight: '50px', 
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis'
                                                            }}
                                                        />
                                                    </Col>
                                                    <Col md={2}>
                                                        <Badge bg="info">{getQuestionTypeLabel(question.question_type)}</Badge>
                                                    </Col>
                                                    <Col md={2} className="text-center">
                                                        <Badge bg={question.success_rate !== null && parseFloat(question.success_rate) >= 70 ? 'success' : 
                                                                 question.success_rate !== null && parseFloat(question.success_rate) >= 50 ? 'warning' : 
                                                                 question.success_rate !== null ? 'danger' : 'secondary'}>
                                                            <i className="fas fa-percent me-1"></i>
                                                            {question.success_rate !== null ? `${parseFloat(question.success_rate).toFixed(1)}%` : 'N/A'}
                                                        </Badge>
                                                        <div className="text-muted small mt-1">Tỷ lệ đúng</div>
                                                    </Col>
                                                    <Col md={2} className="text-end">
                                                        <Badge bg="primary">
                                                            <i className="fas fa-user me-1"></i>
                                                            {question.students_answered || 0} SV
                                                        </Badge>
                                                    </Col>
                                                </Row>
                                            </div>
                                        </button>
                                    </h2>
                                    <div
                                        id={`collapse${index}`}
                                        className={`accordion-collapse collapse ${expandedQuestion === question.question_id ? 'show' : ''}`}
                                    >
                                        <div className="accordion-body card-body-modern">
                                            {/* Question Details - 2 Columns Layout */}
                                            <Row className="mb-3">
                                                {/* Column 1: Question Content and Options */}
                                                <Col md={6}>
                                                    <Row className="mb-3">
                                                        <Col md={12}>
                                                            <h6 className="fw-bold">Nội dung câu hỏi:</h6>
                                                            <div 
                                                                dangerouslySetInnerHTML={{ __html: question.question_text }}
                                                                className="p-3 bg-light rounded"
                                                            />
                                                        </Col>
                                                    </Row>

                                                    {/* Question Options and Correct Answer */}
                                                    {(() => {
                                                        let options = [];
                                                        try {
                                                            if (typeof question.options === 'string') {
                                                                options = JSON.parse(question.options);
                                                            } else if (Array.isArray(question.options)) {
                                                                options = question.options;
                                                            }
                                                        } catch (e) {
                                                            console.error('Error parsing options:', e);
                                                        }
                                                        
                                                        if (options && options.length > 0) {
                                                            const correctOptions = options.filter(opt => opt.is_correct === 1 || opt.is_correct === true);
                                                            
                                                            // Parse answer_distribution to get selection counts
                                                            let answerDistribution = [];
                                                            try {
                                                                if (typeof question.answer_distribution === 'string') {
                                                                    answerDistribution = JSON.parse(question.answer_distribution);
                                                                } else if (Array.isArray(question.answer_distribution)) {
                                                                    answerDistribution = question.answer_distribution;
                                                                }
                                                            } catch (e) {
                                                                console.error('Error parsing answer_distribution:', e);
                                                            }
                                                            
                                                            // Create a map of option_id to selection_count
                                                            // Use both numeric and string keys for matching
                                                            const selectionCountMap = {};
                                                            answerDistribution.forEach(dist => {
                                                                const selectedId = dist.selected_option_id;
                                                                if (selectedId != null) {
                                                                    // Try both numeric and string keys
                                                                    const numId = parseInt(selectedId);
                                                                    const strId = String(selectedId);
                                                                    const count = parseInt(dist.selection_count) || 0;
                                                                    
                                                                    if (!isNaN(numId) && numId > 0) {
                                                                        selectionCountMap[numId] = count;
                                                                        selectionCountMap[strId] = count; // Also store as string for matching
                                                                    }
                                                                }
                                                            });
                                                            
                                                            return (
                                                                <Row className="mb-3">
                                                                    <Col md={12}>
                                                                        <h6 className="fw-bold">Các lựa chọn:</h6>
                                                                        <div className="p-3 bg-light rounded">
                                                                            {options.map((opt, idx) => {
                                                                                const letter = String.fromCharCode(65 + idx);
                                                                                const isCorrect = opt.is_correct === 1 || opt.is_correct === true;
                                                                                
                                                                                // Try multiple ways to match option_id
                                                                                const optionId = opt.option_id != null ? parseInt(opt.option_id) : null;
                                                                                const optionIdStr = opt.option_id != null ? String(opt.option_id) : null;
                                                                                
                                                                                // Try to find selection count with multiple matching strategies
                                                                                let selectionCount = 0;
                                                                                if (optionId !== null && !isNaN(optionId)) {
                                                                                    // Try numeric key first
                                                                                    selectionCount = selectionCountMap[optionId] || 0;
                                                                                    // If not found, try string key
                                                                                    if (selectionCount === 0 && optionIdStr) {
                                                                                        selectionCount = selectionCountMap[optionIdStr] || 0;
                                                                                    }
                                                                                    // If still not found, try direct matching with distribution
                                                                                    if (selectionCount === 0 && answerDistribution.length > 0) {
                                                                                        const dist = answerDistribution.find(d => {
                                                                                            const selectedId = d.selected_option_id != null ? parseInt(d.selected_option_id) : null;
                                                                                            return (selectedId !== null && selectedId === optionId) ||
                                                                                                   (String(d.selected_option_id) === optionIdStr);
                                                                                        });
                                                                                        if (dist) {
                                                                                            selectionCount = parseInt(dist.selection_count) || 0;
                                                                                        }
                                                                                    }
                                                                                }
                                                                                
                                                                                return (
                                                                                    <div key={opt.option_id || idx} className="mb-2">
                                                                                        <div className="d-flex align-items-start">
                                                                                            <span className="fw-bold me-2" style={{ minWidth: '30px' }}>
                                                                                                {letter}.
                                                                                            </span>
                                                                                            <div className="flex-grow-1 d-flex align-items-center flex-wrap">
                                                                                                <span dangerouslySetInnerHTML={{ __html: opt.option_text || 'N/A' }}></span>
                                                                                                {isCorrect && (
                                                                                                    <Badge bg="success" className="ms-2">
                                                                                                        <i className="fas fa-check me-1"></i>Đúng
                                                                                                    </Badge>
                                                                                                )}
                                                                                                {selectionCount > 0 && (
                                                                                                    <span className="text-muted ms-2" style={{ fontSize: '0.9em' }}>
                                                                                                        {selectionCount}sv
                                                                                                    </span>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </Col>
                                                                </Row>
                                                            );
                                                        }
                                                        return null;
                                                    })()}
                                                </Col>

                                                {/* Column 2: Question Metadata */}
                                                <Col md={6}>
                                                    <Row className="mb-3">
                                                        <Col md={12}>
                                                            <strong>Loại:</strong> {getQuestionTypeLabel(question.question_type)}
                                                        </Col>
                                                    </Row>
                                                    <Row className="mb-3">
                                                        <Col md={12}>
                                                            <strong>Độ khó:</strong> <Badge bg="warning">{getDifficultyLabel(question.difficulty_level)}</Badge>
                                                        </Col>
                                                    </Row>
                                                    <Row className="mb-3">
                                                        <Col md={12}>
                                                            <strong>Bloom:</strong> <Badge bg="info">{getBloomLabel(question.bloom_level)}</Badge>
                                                        </Col>
                                                    </Row>
                                                    <Row className="mb-3">
                                                        <Col md={12}>
                                                            <strong>Điểm:</strong> <Badge bg="primary">{question.points}</Badge>
                                                        </Col>
                                                    </Row>
                                                    <Row className="mb-3">
                                                        <Col md={12}>
                                                            <strong>Chủ đề:</strong> <Badge bg="secondary">{question.topic_name || 'N/A'}</Badge>
                                                        </Col>
                                                    </Row>
                                                </Col>
                                            </Row>

                                            <hr />

                                            {/* Statistics */}
                                            <h6 className="fw-bold mb-3">Phân tích trả lời:</h6>
                                            <Row className="mb-3" style={{ display: 'flex', flexWrap: 'nowrap' }}>
                                                <Col xs={6} sm={4} md={12} style={{ flex: '1 1 0', minWidth: 0 }}>
                                                    <div className="stat-card text-center p-3">
                                                        <div className="stat-value text-primary">{question.students_answered || 0}</div>
                                                        <div className="stat-label">SV đã trả lời</div>
                                                    </div>
                                                </Col>
                                                <Col xs={6} sm={4} md={12} style={{ flex: '1 1 0', minWidth: 0 }}>
                                                    <div className="stat-card text-center p-3">
                                                        <div className="stat-value text-secondary">
                                                            {question.total_students && question.students_answered !== undefined
                                                                ? (question.total_students - (question.students_answered || 0))
                                                                : 'N/A'}
                                                        </div>
                                                        <div className="stat-label">SV không trả lời</div>
                                                    </div>
                                                </Col>
                                                <Col xs={6} sm={4} md={12} style={{ flex: '1 1 0', minWidth: 0 }}>
                                                    <div className="stat-card text-center p-3">
                                                        <div className="stat-value text-success">
                                                            {question.success_rate !== null ? `${parseFloat(question.success_rate).toFixed(1)}%` : 'N/A'}
                                                        </div>
                                                        <div className="stat-label">Tỷ lệ đúng</div>
                                                    </div>
                                                </Col>
                                                <Col xs={6} sm={4} md={12} style={{ flex: '1 1 0', minWidth: 0 }}>
                                                    <div className="stat-card text-center p-3">
                                                        <div className="stat-value text-info">
                                                            {question.avg_score !== null ? parseFloat(question.avg_score).toFixed(2) : 'N/A'}
                                                        </div>
                                                        <div className="stat-label">Điểm trung bình</div>
                                                    </div>
                                                </Col>
                                                <Col xs={6} sm={4} md={12} style={{ flex: '1 1 0', minWidth: 0 }}>
                                                    <div className="stat-card text-center p-3">
                                                        <div className="stat-value text-warning">
                                                            {question.avg_time_seconds != null && question.avg_time_seconds > 0 
                                                                ? `${Math.round(question.avg_time_seconds)}s` 
                                                                : 'N/A'}
                                                        </div>
                                                        <div className="stat-label">Thời gian TB</div>
                                                    </div>
                                                </Col>
                                                <Col xs={6} sm={4} md={12} style={{ flex: '1 1 0', minWidth: 0 }}>
                                                    <div className="stat-card text-center p-3">
                                                        <div className="d-flex justify-content-center align-items-center gap-2 mb-2">
                                                            <div className="stat-value text-primary" style={{ margin: 0, fontSize: '1.5rem' }}>
                                                                {question.discrimination_index !== null ? question.discrimination_index : 'N/A'}
                                                            </div>
                                                            <Badge 
                                                                bg={
                                                                    (() => {
                                                                        const assessment = assessDiscrimination(question.discrimination_index);
                                                                        return assessment === 'Xuất sắc' ? 'success' :
                                                                               assessment === 'Tốt' ? 'primary' :
                                                                               assessment === 'Chấp nhận được' ? 'info' :
                                                                               assessment === 'Cần cải thiện' ? 'warning' :
                                                                               'danger';
                                                                    })()
                                                                }
                                                            >
                                                                {assessDiscrimination(question.discrimination_index)}
                                                            </Badge>
                                                        </div>
                                                        <div className="stat-label" style={{ fontSize: '0.85rem' }}>Đánh giá phân biệt giỏi/yếu</div>
                                                    </div>
                                                </Col>
                                                <Col xs={6} sm={4} md={12} style={{ flex: '1 1 0', minWidth: 0 }}>
                                                    <div className="stat-card text-center p-3">
                                                        <div className="d-flex justify-content-center align-items-center gap-2 mb-2">
                                                            <div className="stat-value text-info" style={{ margin: 0, fontSize: '1.5rem' }}>
                                                                {question.item_difficulty_index !== null ? question.item_difficulty_index : 'N/A'}
                                                            </div>
                                                            <Badge 
                                                                bg={
                                                                    (() => {
                                                                        const assessment = assessDifficulty(question.item_difficulty_index);
                                                                        return assessment === 'Trung bình (Lý tưởng)' ? 'success' :
                                                                               assessment === 'Dễ' || assessment === 'Khó' ? 'warning' :
                                                                               'danger';
                                                                    })()
                                                                }
                                                            >
                                                                {assessDifficulty(question.item_difficulty_index)}
                                                            </Badge>
                                                        </div>
                                                        <div className="stat-label" style={{ fontSize: '0.85rem' }}>Đánh giá độ khó</div>
                                                    </div>
                                                </Col>
                                            </Row>

                                            {/* Answer Distribution for MCQ */}
                                            {['mcq', 'multiple_response', 'true_false'].includes(question.question_type) && (
                                                <>
                                                    <hr />
                                                    <h6 className="fw-bold mb-3">Phân bố đáp án:</h6>
                                                    <Row>
                                                        <Col md={12}>
                                                            {renderAnswerDistribution(question)}
                                                        </Col>
                                                    </Row>
                                                </>
                                            )}


                                            {/* Phân nhóm sinh viên và thống kê theo nhóm cho câu hỏi này */}
                                            <hr />
                                            <div className="mb-3">
                                                <h6 className="fw-bold mb-3">
                                                    <i className="fas fa-users me-2"></i>
                                                    Phân nhóm sinh viên theo kết quả bài thi (cho câu hỏi này)
                                                </h6>
                                                {(() => {
                                                    const stats = questionGroupStats[question.question_id];
                                                    const loading = loadingQuestionGroupStats[question.question_id];
                                                    
                                                    // Load stats when question is expanded
                                                    if (expandedQuestion === question.question_id && !stats && !loading && selectedExam) {
                                                        loadQuestionGroupStats(selectedExam.exam_id, question.question_id);
                                                    }

                                                    if (loading) {
                                                        return (
                                                            <div className="text-center py-3">
                                                                <Spinner animation="border" size="sm" />
                                                                <span className="ms-2">Đang tải thống kê...</span>
                                                            </div>
                                                        );
                                                    }

                                                    if (!stats || !stats.groups) {
                                                        return (
                                                            <Alert variant="info" className="mb-0">
                                                                <i className="fas fa-info-circle me-2"></i>
                                                                Chưa có dữ liệu thống kê cho câu hỏi này.
                                                            </Alert>
                                                        );
                                                    }

                                                    const groups = stats.groups;
                                                    const thresholds = stats.thresholds || discriminationThresholds;

                                                    // Tạo mảng các nhóm có dữ liệu
                                                    const activeGroups = [];
                                                    if (groups.excellent && groups.excellent.total_students > 0) {
                                                        activeGroups.push({
                                                            key: 'excellent',
                                                            label: 'Xuất sắc',
                                                            badge: 'success',
                                                            icon: 'fa-star',
                                                            threshold: `≥ ${thresholds.excellent * 100}% điểm`,
                                                            stats: groups.excellent
                                                        });
                                                    }
                                                    if (groups.good && groups.good.total_students > 0) {
                                                        activeGroups.push({
                                                            key: 'good',
                                                            label: 'Tốt',
                                                            badge: 'primary',
                                                            icon: 'fa-check-circle',
                                                            threshold: `${thresholds.good * 100}% - ${thresholds.excellent * 100}% điểm`,
                                                            stats: groups.good
                                                        });
                                                    }
                                                    if (groups.acceptable && groups.acceptable.total_students > 0) {
                                                        activeGroups.push({
                                                            key: 'acceptable',
                                                            label: 'Chấp nhận được',
                                                            badge: 'info',
                                                            icon: 'fa-check',
                                                            threshold: `${thresholds.acceptable * 100}% - ${thresholds.good * 100}% điểm`,
                                                            stats: groups.acceptable
                                                        });
                                                    }
                                                    if (groups.needsImprovement && groups.needsImprovement.total_students > 0) {
                                                        activeGroups.push({
                                                            key: 'needsImprovement',
                                                            label: 'Cần cải thiện',
                                                            badge: 'warning',
                                                            icon: 'fa-exclamation-circle',
                                                            threshold: `${thresholds.needsImprovement * 100}% - ${thresholds.acceptable * 100}% điểm`,
                                                            stats: groups.needsImprovement
                                                        });
                                                    }
                                                    if (groups.poor && groups.poor.total_students > 0) {
                                                        activeGroups.push({
                                                            key: 'poor',
                                                            label: 'Kém',
                                                            badge: 'danger',
                                                            icon: 'fa-times-circle',
                                                            threshold: `< ${thresholds.needsImprovement * 100}% điểm`,
                                                            stats: groups.poor
                                                        });
                                                    }

                                                    const groupCount = activeGroups.length;
                                                    const colSize = groupCount === 1 ? 12 : 6;

                                                    return (
                                                        <>
                                                            {/* Phân nhóm sinh viên */}
                                                            <div className="mb-4">
                                                                <Row>
                                                                    {activeGroups.map((group) => (
                                                                        <Col key={group.key} md={colSize} className="mb-3">
                                                                            <div className="session-card h-100">
                                                                                <div className="card-header-modern">
                                                                                    <div className="header-icon">
                                                                                        <i className={`fas ${group.icon}`}></i>
                                                                                    </div>
                                                                                    <h6 className="mb-0">{group.label}</h6>
                                                                                </div>
                                                                                <div className="card-body-modern">
                                                                                    <div className="mb-2">
                                                                                        <small className="text-muted">
                                                                                            ({group.threshold})
                                                                                        </small>
                                                                                        <div className="mt-2">
                                                                                            <strong>Tổng số SV:</strong> {group.stats.total_students} | 
                                                                                            <strong className="ms-2">Đã trả lời:</strong> {group.stats.answered} | 
                                                                                            <strong className="ms-2">Trả lời đúng:</strong> {group.stats.correct}
                                                                                        </div>
                                                                                        <div className="mt-2">
                                                                                            <Badge bg={group.badge} className="fs-6">
                                                                                                Tỷ lệ đúng: {group.stats.correct_rate.toFixed(1)}%
                                                                                            </Badge>
                                                                                        </div>
                                                                                    </div>
                                                                                    {group.stats.students && group.stats.students.length > 0 && (
                                                                                        <div className="table-responsive" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                                                                            <Table striped bordered hover size="sm">
                                                                                                <thead>
                                                                                                    <tr>
                                                                                                        <th>STT</th>
                                                                                                        <th>Mã SV</th>
                                                                                                        <th>Họ tên</th>
                                                                                                        <th>Kết quả</th>
                                                                                                    </tr>
                                                                                                </thead>
                                                                                                <tbody>
                                                                                                    {group.stats.students.map((student, idx) => (
                                                                                                        <tr key={student.user_id}>
                                                                                                            <td>{idx + 1}</td>
                                                                                                            <td>{student.student_id || 'N/A'}</td>
                                                                                                            <td>{student.full_name || 'N/A'}</td>
                                                                                                            <td>
                                                                                                                {student.is_correct !== null && student.is_correct !== undefined ? (
                                                                                                                    <Badge bg={student.is_correct ? 'success' : 'danger'}>
                                                                                                                        {student.is_correct ? 'Đúng' : 'Sai'}
                                                                                                                    </Badge>
                                                                                                                ) : (
                                                                                                                    <span className="text-muted">Chưa trả lời</span>
                                                                                                                )}
                                                                                                            </td>
                                                                                                        </tr>
                                                                                                    ))}
                                                                                                </tbody>
                                                                                            </Table>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </Col>
                                                                    ))}
                                                                </Row>
                                                            </div>

                                                            {/* Thống kê kết quả câu hỏi theo nhóm */}
                                                            <div className="mb-4">
                                                                <div className="session-card">
                                                                    <div className="card-header-modern">
                                                                        <div className="header-icon">
                                                                            <i className="fas fa-chart-bar"></i>
                                                                        </div>
                                                                        <h6 className="mb-0">Thống kê kết quả câu hỏi theo nhóm</h6>
                                                                    </div>
                                                                    <div className="card-body-modern">
                                                                        <div className="table-responsive">
                                                                            <Table striped bordered hover size="sm">
                                                                                <thead>
                                                                                    <tr>
                                                                                        <th rowSpan="2" className="align-middle">Nhóm</th>
                                                                                        <th colSpan="3" className="text-center">Thống kê</th>
                                                                                        <th colSpan="4" className="text-center">Chênh lệch tỷ lệ đúng</th>
                                                                                    </tr>
                                                                                    <tr>
                                                                                        <th className="text-center">Tổng SV</th>
                                                                                        <th className="text-center">Đã trả lời</th>
                                                                                        <th className="text-center">Tỷ lệ đúng</th>
                                                                                        <th className="text-center">Xuất sắc - Kém</th>
                                                                                        <th className="text-center">Tốt - Kém</th>
                                                                                        <th className="text-center">Xuất sắc - Cần cải thiện</th>
                                                                                        <th className="text-center">Tốt - Cần cải thiện</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody>
                                                                                    {activeGroups.map((group) => {
                                                                                        const excellent = groups.excellent?.correct_rate || 0;
                                                                                        const good = groups.good?.correct_rate || 0;
                                                                                        const acceptable = groups.acceptable?.correct_rate || 0;
                                                                                        const needsImprovement = groups.needsImprovement?.correct_rate || 0;
                                                                                        const poor = groups.poor?.correct_rate || 0;

                                                                                        const diffExcellentPoor = excellent - poor;
                                                                                        const diffGoodPoor = good - poor;
                                                                                        const diffExcellentNeeds = excellent - needsImprovement;
                                                                                        const diffGoodNeeds = good - needsImprovement;

                                                                                        return (
                                                                                            <tr key={group.key}>
                                                                                                <td>
                                                                                                    <Badge bg={group.badge}>
                                                                                                        <i className={`fas ${group.icon} me-1`}></i>
                                                                                                        {group.label}
                                                                                                    </Badge>
                                                                                                </td>
                                                                                                <td className="text-center">{group.stats.total_students}</td>
                                                                                                <td className="text-center">
                                                                                                    {group.stats.answered > 0 ? (
                                                                                                        <>
                                                                                                            {group.stats.answered}
                                                                                                            <div className="small text-muted">
                                                                                                                ({group.stats.correct} đúng)
                                                                                                            </div>
                                                                                                        </>
                                                                                                    ) : (
                                                                                                        <span className="text-muted">-</span>
                                                                                                    )}
                                                                                                </td>
                                                                                                <td className="text-center">
                                                                                                    {group.stats.answered > 0 ? (
                                                                                                        <Badge bg={group.badge}>
                                                                                                            {group.stats.correct_rate.toFixed(1)}%
                                                                                                        </Badge>
                                                                                                    ) : (
                                                                                                        <span className="text-muted">-</span>
                                                                                                    )}
                                                                                                </td>
                                                                                                <td className="text-center">
                                                                                                    {groups.excellent?.total_students > 0 && groups.poor?.total_students > 0 ? (
                                                                                                        <Badge bg={diffExcellentPoor >= 0 ? 'success' : 'danger'}>
                                                                                                            {diffExcellentPoor >= 0 ? '+' : ''}{diffExcellentPoor.toFixed(1)}%
                                                                                                        </Badge>
                                                                                                    ) : (
                                                                                                        <span className="text-muted">-</span>
                                                                                                    )}
                                                                                                </td>
                                                                                                <td className="text-center">
                                                                                                    {groups.good?.total_students > 0 && groups.poor?.total_students > 0 ? (
                                                                                                        <Badge bg={diffGoodPoor >= 0 ? 'primary' : 'danger'}>
                                                                                                            {diffGoodPoor >= 0 ? '+' : ''}{diffGoodPoor.toFixed(1)}%
                                                                                                        </Badge>
                                                                                                    ) : (
                                                                                                        <span className="text-muted">-</span>
                                                                                                    )}
                                                                                                </td>
                                                                                                <td className="text-center">
                                                                                                    {groups.excellent?.total_students > 0 && groups.needsImprovement?.total_students > 0 ? (
                                                                                                        <Badge bg={diffExcellentNeeds >= 0 ? 'success' : 'warning'}>
                                                                                                            {diffExcellentNeeds >= 0 ? '+' : ''}{diffExcellentNeeds.toFixed(1)}%
                                                                                                        </Badge>
                                                                                                    ) : (
                                                                                                        <span className="text-muted">-</span>
                                                                                                    )}
                                                                                                </td>
                                                                                                <td className="text-center">
                                                                                                    {groups.good?.total_students > 0 && groups.needsImprovement?.total_students > 0 ? (
                                                                                                        <Badge bg={diffGoodNeeds >= 0 ? 'primary' : 'warning'}>
                                                                                                            {diffGoodNeeds >= 0 ? '+' : ''}{diffGoodNeeds.toFixed(1)}%
                                                                                                        </Badge>
                                                                                                    ) : (
                                                                                                        <span className="text-muted">-</span>
                                                                                                    )}
                                                                                                </td>
                                                                                            </tr>
                                                                                        );
                                                                                    })}
                                                                                </tbody>
                                                                            </Table>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                        </>
                    )}
                </Modal.Body>
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
                                        const elementTop = questionElement.offsetTop;
                                        const containerHeight = modalBodyRef.current.clientHeight;
                                        const elementHeight = questionElement.offsetHeight;
                                        const scrollPosition = elementTop - (containerHeight / 2) + (elementHeight / 2) - 20;
                                        
                                        modalBodyRef.current.scrollTo({
                                            top: Math.max(0, scrollPosition),
                                            behavior: 'smooth'
                                        });
                                        
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
                                                
                                                let questionDisplayTime = null;
                                                if (index === 0) {
                                                    questionDisplayTime = examResults.attempt.start_time;
                                                } else {
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
                                                        <div className="question-header">
                                                            <div className="question-number">Câu {index + 1}</div>
                                                            <div className="question-content">
                                                                <div className="question-text" dangerouslySetInnerHTML={{ __html: answer.question_text || 'N/A' }}></div>
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

                                                        {answer.options && answer.options.length > 0 && (
                                                            <div className="question-options-section">
                                                                <div className="options-list">
                                                                    {answer.options.map((option, optIndex) => (
                                                                        <div key={option.option_id || optIndex} className="option-item">
                                                                            {String.fromCharCode(65 + optIndex)}. <span dangerouslySetInnerHTML={{ __html: option.option_text || 'N/A' }}></span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="student-answer-section">
                                                            <div className="answer-content-inline">
                                                                <span className="section-label-inline">Đáp án đã chọn:</span>
                                                                <span className="answer-value">
                                                                    {(() => {
                                                                        let parsedSelectedOptions = answer.selected_options;
                                                                        if (parsedSelectedOptions && typeof parsedSelectedOptions === 'string') {
                                                                            try {
                                                                                parsedSelectedOptions = JSON.parse(parsedSelectedOptions);
                                                                            } catch (e) {}
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
                                                                                                    <span dangerouslySetInnerHTML={{ __html: opt.option_text || 'N/A' }}></span>
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
                                                                            return <span className="answer-option-selected" dangerouslySetInnerHTML={{ __html: answer.answer_text || 'Chưa trả lời' }}></span>;
                                                                        }
                                                                    })()}
                                                                </span>
                                                            </div>
                                                        </div>

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

            {/* Settings Modal - QA Index Thresholds */}
            <Modal
                show={showSettingsModal}
                onHide={() => setShowSettingsModal(false)}
                size="xl"
                className="student-detail-modal"
                centered
            >
                <Modal.Header closeButton className="student-detail-header">
                    <Modal.Title className="student-detail-title">
                        <div className="student-avatar">
                            <i className="fas fa-cog"></i>
                        </div>
                        <div>
                            <h4 className="mb-0">Cài đặt các chỉ số</h4>
                            <p className="mb-0 student-subtitle">Điều chỉnh các ngưỡng để đánh giá chất lượng câu hỏi</p>
                        </div>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="student-detail-body" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
                    <div className="student-detail-container">
                        <Tabs
                            activeKey={settingsModalTab}
                            onSelect={(k) => setSettingsModalTab(k)}
                            className="mb-3"
                            fill
                            variant="pills"
                        >
                            {/* Item Difficulty Index Tab */}
                            <Tab eventKey="difficulty" title={
                                <span>
                                    <i className="fas fa-chart-line me-2"></i>
                                    Item Difficulty Index
                                </span>
                            }>
                                <div className="p-3">
                                    {/* Information Card */}
                        <div className="session-card mb-4">
                            <div className="card-header-modern">
                                <div className="header-icon">
                                    <i className="fas fa-info-circle"></i>
                                </div>
                                <h6 className="mb-0">Thông tin về Item Difficulty Index</h6>
                            </div>
                            <div className="card-body-modern">
                                <Row>
                                    <Col md={6}>
                                        <Alert variant="info" className="mb-0 h-100">
                                            <div className="mb-2">
                                                <i className="fas fa-info-circle me-2"></i>
                                                <strong>Item Difficulty Index là gì?</strong>
                                            </div>
                                            <div className="small">
                                                <p className="mb-2">
                                                    <strong>Item Difficulty Index (P-value)</strong> là chỉ số đo độ khó của câu hỏi, được tính bằng:
                                                </p>
                                                <p className="mb-2 text-center bg-light p-2 rounded">
                                                    <strong>Item Difficulty Index = Tỷ lệ đúng (%) / 100</strong>
                                                </p>
                                                <p className="mb-2">
                                                    <strong>Ý nghĩa:</strong>
                                                </p>
                                                <ul className="mb-0">
                                                    <li><strong>Giá trị càng cao (gần 1.0)</strong> → Câu hỏi càng <strong>DỄ</strong> (nhiều sinh viên trả lời đúng)</li>
                                                    <li><strong>Giá trị càng thấp (gần 0.0)</strong> → Câu hỏi càng <strong>KHÓ</strong> (ít sinh viên trả lời đúng)</li>
                                                    <li><strong>Giá trị lý tưởng: 0.4 - 0.6</strong> → Câu hỏi có độ khó phù hợp, phân biệt tốt giữa sinh viên giỏi và yếu</li>
                                                </ul>
                                            </div>
                                        </Alert>
                                    </Col>
                                    <Col md={6}>
                                        <Alert variant="warning" className="mb-0 h-100">
                                            <div className="mb-2">
                                                <i className="fas fa-question-circle me-2"></i>
                                                <strong>Tại sao cần điều chỉnh các ngưỡng?</strong>
                                            </div>
                                            <div className="small">
                                                <p className="mb-2">
                                                    Mỗi môn học, mỗi loại kỳ thi có đặc thù riêng. Ví dụ:
                                                </p>
                                                <ul className="mb-0">
                                                    <li><strong>Kỳ thi sàng lọc:</strong> Cần câu hỏi khó hơn (ngưỡng thấp hơn)</li>
                                                    <li><strong>Kỳ thi đánh giá kiến thức cơ bản:</strong> Cần câu hỏi dễ hơn (ngưỡng cao hơn)</li>
                                                    <li><strong>Kỳ thi chuyên ngành:</strong> Có thể chấp nhận tỷ lệ đúng thấp hơn</li>
                                                </ul>
                                                <p className="mb-0 mt-2">
                                                    <strong>→</strong> Điều chỉnh ngưỡng giúp đánh giá phù hợp với từng bối cảnh cụ thể.
                                                </p>
                                            </div>
                                        </Alert>
                                    </Col>
                                </Row>
                            </div>
                        </div>

                        {/* Thresholds Settings Card */}
                        <div className="session-card mb-4">
                            <div className="card-header-modern">
                                <div className="header-icon">
                                    <i className="fas fa-sliders-h"></i>
                                </div>
                                <div className="d-flex justify-content-between align-items-center w-100">
                                    <h6 className="mb-0">Cài đặt các ngưỡng đánh giá</h6>
                                    <div className="text-muted small">
                                        {settingsMetadata.updated_by_name ? (
                                            <>
                                                <i className="fas fa-user-edit me-1"></i>
                                                Lưu bởi: <strong>{settingsMetadata.updated_by_name}</strong>
                                                {settingsMetadata.updated_at && (
                                                    <>
                                                        {' • '}
                                                        <i className="fas fa-clock me-1"></i>
                                                        {formatDateTime(settingsMetadata.updated_at)}
                                                    </>
                                                )}
                                            </>
                                        ) : (
                                            <span className="text-muted">
                                                <i className="fas fa-info-circle me-1"></i>
                                                Chưa có thông tin lưu
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="card-body-modern">
                                <Form>
                                    <Row>
                                        <Col md={6}>
                                            <Form.Group className="mb-4">
                                                <Form.Label className="info-label">
                                                    <i className="fas fa-arrow-up me-2"></i>
                                                    Quá dễ (Too Easy)
                                                    <br />
                                                    <small className="text-muted">Ngưỡng: ≥ {tempDifficultyThresholds.tooEasy.toFixed(2)}</small>
                                                </Form.Label>
                                                <Form.Range
                                                    min="0.5"
                                                    max="1.0"
                                                    step="0.05"
                                                    value={tempDifficultyThresholds.tooEasy}
                                                    onChange={(e) => setTempDifficultyThresholds({
                                                        ...tempDifficultyThresholds,
                                                        tooEasy: parseFloat(e.target.value)
                                                    })}
                                                    className="mb-2"
                                                />
                                                <div className="d-flex justify-content-between mb-2">
                                                    <small>0.5</small>
                                                    <small className="fw-bold">{tempDifficultyThresholds.tooEasy.toFixed(2)}</small>
                                                    <small>1.0</small>
                                                </div>
                                                <div className="bg-light p-2 rounded small">
                                                    <strong>Giải thích:</strong> Câu hỏi có Item Difficulty Index <strong>≥ {tempDifficultyThresholds.tooEasy.toFixed(2)}</strong> được đánh giá là <strong>Quá dễ</strong>.
                                                    <br />
                                                    <strong>Ví dụ:</strong> Nếu đặt ngưỡng = <strong>0.50</strong>, thì:
                                                    <ul className="mb-0 mt-1">
                                                        <li>Câu hỏi có tỷ lệ đúng <strong>≥ 50%</strong> sẽ được xếp vào "Quá dễ"</li>
                                                        <li>Nghĩa là: <strong>50% trở lên</strong> sinh viên trả lời đúng → Câu hỏi quá dễ, không phân biệt được trình độ</li>
                                                        <li>Nếu đặt <strong>0.80</strong> (mặc định): ≥ 80% sinh viên đúng → Quá dễ</li>
                                                    </ul>
                                                    <strong className="text-danger">Lưu ý:</strong> Ngưỡng càng thấp → Tiêu chuẩn "Quá dễ" càng nghiêm ngặt (ít câu hỏi bị đánh giá là quá dễ)
                                                </div>
                                            </Form.Group>
                                        </Col>
                                        <Col md={6}>
                                            <Form.Group className="mb-4">
                                                <Form.Label className="info-label">
                                                    <i className="fas fa-check-circle me-2"></i>
                                                    Dễ (Easy)
                                                    <br />
                                                    <small className="text-muted">Ngưỡng: {tempDifficultyThresholds.easy.toFixed(2)} - {tempDifficultyThresholds.tooEasy.toFixed(2)}</small>
                                                </Form.Label>
                                                <Form.Range
                                                    min="0.3"
                                                    max={tempDifficultyThresholds.tooEasy}
                                                    step="0.05"
                                                    value={tempDifficultyThresholds.easy}
                                                    onChange={(e) => {
                                                        const value = parseFloat(e.target.value);
                                                        setTempDifficultyThresholds({
                                                            ...tempDifficultyThresholds,
                                                            easy: value
                                                        });
                                                    }}
                                                    className="mb-2"
                                                />
                                                <div className="d-flex justify-content-between mb-2">
                                                    <small>0.3</small>
                                                    <small className="fw-bold">{tempDifficultyThresholds.easy.toFixed(2)}</small>
                                                    <small>{tempDifficultyThresholds.tooEasy.toFixed(2)}</small>
                                                </div>
                                                <div className="bg-light p-2 rounded small">
                                                    <strong>Giải thích:</strong> Câu hỏi có Item Difficulty Index từ <strong>{tempDifficultyThresholds.easy.toFixed(2)}</strong> đến <strong>{tempDifficultyThresholds.tooEasy.toFixed(2)}</strong> được đánh giá là <strong>Dễ</strong>.
                                                    <br />
                                                    <strong>Ví dụ:</strong> Nếu đặt ngưỡng = <strong>0.40</strong> (với Quá dễ = 0.50), thì:
                                                    <ul className="mb-0 mt-1">
                                                        <li>Câu hỏi có tỷ lệ đúng từ <strong>40% - 50%</strong> sẽ được xếp vào "Dễ"</li>
                                                        <li>Nghĩa là: <strong>40-50%</strong> sinh viên trả lời đúng → Câu hỏi dễ nhưng vẫn có giá trị đánh giá</li>
                                                        <li>Nếu đặt <strong>0.60</strong> (mặc định): 60-80% sinh viên đúng → Dễ</li>
                                                    </ul>
                                                </div>
                                            </Form.Group>
                                        </Col>
                                    </Row>

                                    <Row>
                                        <Col md={6}>
                                            <Form.Group className="mb-4">
                                                <Form.Label className="info-label">
                                                    <i className="fas fa-star me-2"></i>
                                                    Trung bình (Lý tưởng) - Ideal Range
                                                    <br />
                                                    <small className="text-muted">Ngưỡng: {tempDifficultyThresholds.medium.toFixed(2)} - {tempDifficultyThresholds.easy.toFixed(2)}</small>
                                                </Form.Label>
                                                <Form.Range
                                                    min="0.1"
                                                    max={tempDifficultyThresholds.easy}
                                                    step="0.05"
                                                    value={tempDifficultyThresholds.medium}
                                                    onChange={(e) => {
                                                        const value = parseFloat(e.target.value);
                                                        setTempDifficultyThresholds({
                                                            ...tempDifficultyThresholds,
                                                            medium: value
                                                        });
                                                    }}
                                                    className="mb-2"
                                                />
                                                <div className="d-flex justify-content-between mb-2">
                                                    <small>0.1</small>
                                                    <small className="fw-bold">{tempDifficultyThresholds.medium.toFixed(2)}</small>
                                                    <small>{tempDifficultyThresholds.easy.toFixed(2)}</small>
                                                </div>
                                                <div className="bg-light p-2 rounded small">
                                                    <strong>Giải thích:</strong> Câu hỏi có Item Difficulty Index từ <strong>{tempDifficultyThresholds.medium.toFixed(2)}</strong> đến <strong>{tempDifficultyThresholds.easy.toFixed(2)}</strong> được đánh giá là <strong>Trung bình (Lý tưởng)</strong>.
                                                    <br />
                                                    <strong>Ví dụ:</strong> Nếu đặt ngưỡng = <strong>0.30</strong> (với Dễ = 0.40), thì:
                                                    <ul className="mb-0 mt-1">
                                                        <li>Câu hỏi có tỷ lệ đúng từ <strong>30% - 40%</strong> sẽ được xếp vào "Trung bình (Lý tưởng)"</li>
                                                        <li>Nghĩa là: <strong>30-40%</strong> sinh viên trả lời đúng → Câu hỏi có độ khó phù hợp, phân biệt tốt giữa sinh viên giỏi và yếu</li>
                                                        <li>Nếu đặt <strong>0.40</strong> (mặc định): 40-60% sinh viên đúng → Lý tưởng (theo tiêu chuẩn giáo dục)</li>
                                                    </ul>
                                                    <strong className="text-success">Đây là khoảng giá trị được khuyến nghị cho hầu hết các câu hỏi!</strong>
                                                </div>
                                            </Form.Group>
                                        </Col>
                                        <Col md={6}>
                                            <Form.Group className="mb-4">
                                                <Form.Label className="info-label">
                                                    <i className="fas fa-exclamation-triangle me-2"></i>
                                                    Khó (Hard)
                                                    <br />
                                                    <small className="text-muted">Ngưỡng: {tempDifficultyThresholds.hard.toFixed(2)} - {tempDifficultyThresholds.medium.toFixed(2)}</small>
                                                </Form.Label>
                                                <Form.Range
                                                    min="0"
                                                    max={tempDifficultyThresholds.medium}
                                                    step="0.05"
                                                    value={tempDifficultyThresholds.hard}
                                                    onChange={(e) => {
                                                        const value = parseFloat(e.target.value);
                                                        setTempDifficultyThresholds({
                                                            ...tempDifficultyThresholds,
                                                            hard: value
                                                        });
                                                    }}
                                                    className="mb-2"
                                                />
                                                <div className="d-flex justify-content-between mb-2">
                                                    <small>0</small>
                                                    <small className="fw-bold">{tempDifficultyThresholds.hard.toFixed(2)}</small>
                                                    <small>{tempDifficultyThresholds.medium.toFixed(2)}</small>
                                                </div>
                                                <div className="bg-light p-2 rounded small">
                                                    <strong>Giải thích:</strong> Câu hỏi có Item Difficulty Index từ <strong>{tempDifficultyThresholds.hard.toFixed(2)}</strong> đến <strong>{tempDifficultyThresholds.medium.toFixed(2)}</strong> được đánh giá là <strong>Khó</strong>.
                                                    <br />
                                                    <strong>Ví dụ:</strong> Nếu đặt ngưỡng = <strong>0.20</strong> (với Trung bình = 0.30), thì:
                                                    <ul className="mb-0 mt-1">
                                                        <li>Câu hỏi có tỷ lệ đúng từ <strong>20% - 30%</strong> sẽ được xếp vào "Khó"</li>
                                                        <li>Nghĩa là: Chỉ có <strong>20-30%</strong> sinh viên trả lời đúng → Câu hỏi khó, phù hợp cho kỳ thi nâng cao</li>
                                                        <li>Nếu đặt <strong>0.20</strong> (mặc định): 20-40% sinh viên đúng → Khó</li>
                                                    </ul>
                                                </div>
                                            </Form.Group>
                                        </Col>
                                    </Row>

                                    <Form.Group className="mb-4">
                                        <Form.Label className="info-label">
                                            <i className="fas fa-times-circle me-2"></i>
                                            Quá khó (Too Hard)
                                            <br />
                                            <small className="text-muted">Ngưỡng: &lt; {tempDifficultyThresholds.hard.toFixed(2)}</small>
                                        </Form.Label>
                                        <div className="p-3 bg-light rounded">
                                            <div className="small">
                                                <strong>Giải thích:</strong> Câu hỏi có Item Difficulty Index <strong>&lt; {tempDifficultyThresholds.hard.toFixed(2)}</strong> được đánh giá là <strong>Quá khó</strong>.
                                                <br />
                                                <strong>Ví dụ:</strong> Nếu đặt ngưỡng Khó = <strong>0.20</strong>, thì:
                                                <ul className="mb-2 mt-1">
                                                    <li>Câu hỏi có tỷ lệ đúng <strong>&lt; 20%</strong> sẽ được xếp vào "Quá khó"</li>
                                                    <li>Nghĩa là: Chỉ có <strong>dưới 20%</strong> sinh viên trả lời đúng → Câu hỏi quá khó, có thể không phù hợp</li>
                                                    <li>Nếu đặt <strong>0.20</strong> (mặc định): &lt; 20% sinh viên đúng → Quá khó</li>
                                                </ul>
                                                <strong className="text-danger">Lưu ý:</strong> Câu hỏi quá khó có thể không phân biệt được trình độ (vì hầu hết sinh viên đều sai), hoặc có thể có vấn đề về nội dung/đáp án.
                                            </div>
                                        </div>
                                    </Form.Group>
                                </Form>
                            </div>
                        </div>

                        {/* Notes and Suggestions Card */}
                        <div className="session-card mb-4">
                            <div className="card-header-modern">
                                <div className="header-icon">
                                    <i className="fas fa-exclamation-triangle"></i>
                                </div>
                                <h6 className="mb-0">Lưu ý và gợi ý</h6>
                            </div>
                            <div className="card-body-modern">
                                <Row>
                                    <Col md={6}>
                                        <Alert variant="warning" className="mb-0 h-100">
                                            <div className="mb-2">
                                                <i className="fas fa-exclamation-triangle me-2"></i>
                                                <strong>Lưu ý quan trọng:</strong>
                                            </div>
                                            <ul className="mb-2 small">
                                                <li>Đảm bảo các ngưỡng được sắp xếp theo thứ tự giảm dần:
                                                    <br />
                                                    <strong>Quá dễ ({tempDifficultyThresholds.tooEasy.toFixed(2)}) &gt; Dễ ({tempDifficultyThresholds.easy.toFixed(2)}) &gt; Trung bình ({tempDifficultyThresholds.medium.toFixed(2)}) &gt; Khó ({tempDifficultyThresholds.hard.toFixed(2)})</strong>
                                                </li>
                                                <li>Khi thay đổi ngưỡng, hệ thống sẽ tự động đánh giá lại tất cả các câu hỏi dựa trên tiêu chuẩn mới</li>
                                                <li>Cài đặt sẽ được lưu vào database và áp dụng cho tất cả các kỳ thi</li>
                                            </ul>
                                        </Alert>
                                    </Col>
                                    <Col md={6}>
                                        <Alert variant="success" className="mb-0 h-100">
                                            <div className="mb-2">
                                                <i className="fas fa-lightbulb me-2"></i>
                                                <strong>Gợi ý sử dụng:</strong>
                                            </div>
                                            <div className="small">
                                                <p className="mb-1"><strong>• Kỳ thi cơ bản:</strong> Tăng các ngưỡng (ví dụ: Quá dễ = 0.70, Dễ = 0.50, Trung bình = 0.30)</p>
                                                <p className="mb-1"><strong>• Kỳ thi nâng cao:</strong> Giảm các ngưỡng (ví dụ: Quá dễ = 0.60, Dễ = 0.40, Trung bình = 0.25, Khó = 0.15)</p>
                                                <p className="mb-0"><strong>• Kỳ thi sàng lọc:</strong> Giảm mạnh ngưỡng "Trung bình" và "Khó" để tìm câu hỏi phân biệt tốt</p>
                                            </div>
                                        </Alert>
                                    </Col>
                                </Row>
                            </div>
                        </div>
                                </div>
                            </Tab>

                            {/* Discrimination Index Tab */}
                            <Tab eventKey="discrimination" title={
                                <span>
                                    <i className="fas fa-chart-bar me-2"></i>
                                    Discrimination Index
                                </span>
                            }>
                                <div className="p-3">
                                    {/* Information Card */}
                                    <div className="session-card mb-4">
                                        <div className="card-header-modern">
                                            <div className="header-icon">
                                                <i className="fas fa-info-circle"></i>
                                            </div>
                                            <h6 className="mb-0">Thông tin về Discrimination Index</h6>
                                        </div>
                                        <div className="card-body-modern">
                                            <Row>
                                                <Col md={6}>
                                                    <Alert variant="info" className="mb-0 h-100">
                                                        <div className="mb-2">
                                                            <i className="fas fa-info-circle me-2"></i>
                                                            <strong>Discrimination Index là gì?</strong>
                                                        </div>
                                                        <div className="small">
                                                            <p className="mb-2">
                                                                <strong>Discrimination Index</strong> là chỉ số đo khả năng phân biệt của câu hỏi, được tính bằng:
                                                            </p>
                                                            <p className="mb-2 text-center bg-light p-2 rounded">
                                                                <strong>Discrimination Index = Tỷ lệ đúng nhóm trên - Tỷ lệ đúng nhóm dưới</strong>
                                                            </p>
                                                            <p className="mb-2">
                                                                <strong>Ý nghĩa:</strong>
                                                            </p>
                                                            <ul className="mb-0">
                                                                <li><strong>Giá trị càng cao (gần 1.0)</strong> → Câu hỏi phân biệt tốt giữa sinh viên giỏi và yếu</li>
                                                                <li><strong>Giá trị thấp hoặc âm</strong> → Câu hỏi không phân biệt được trình độ hoặc có vấn đề</li>
                                                                <li><strong>Giá trị lý tưởng: ≥ 0.3</strong> → Câu hỏi có khả năng phân biệt tốt</li>
                                                            </ul>
                                                        </div>
                                                    </Alert>
                                                </Col>
                                                <Col md={6}>
                                                    <Alert variant="warning" className="mb-0 h-100">
                                                        <div className="mb-2">
                                                            <i className="fas fa-question-circle me-2"></i>
                                                            <strong>Tại sao cần điều chỉnh các ngưỡng?</strong>
                                                        </div>
                                                        <div className="small">
                                                            <p className="mb-2">
                                                                Mỗi môn học, mỗi loại kỳ thi có đặc thù riêng. Ví dụ:
                                                            </p>
                                                            <ul className="mb-0">
                                                                <li><strong>Kỳ thi sàng lọc:</strong> Cần câu hỏi có khả năng phân biệt cao (ngưỡng cao hơn)</li>
                                                                <li><strong>Kỳ thi đánh giá kiến thức cơ bản:</strong> Có thể chấp nhận khả năng phân biệt thấp hơn</li>
                                                                <li><strong>Kỳ thi chuyên ngành:</strong> Cần câu hỏi phân biệt tốt giữa các mức độ</li>
                                                            </ul>
                                                            <p className="mb-0 mt-2">
                                                                <strong>→</strong> Điều chỉnh ngưỡng giúp đánh giá phù hợp với từng bối cảnh cụ thể.
                                                            </p>
                                                        </div>
                                                    </Alert>
                                                </Col>
                                            </Row>
                                        </div>
                                    </div>

                                    {/* Thresholds Settings Card */}
                                    <div className="session-card mb-4">
                                        <div className="card-header-modern">
                                            <div className="header-icon">
                                                <i className="fas fa-sliders-h"></i>
                                            </div>
                                            <h6 className="mb-0">Cài đặt các ngưỡng đánh giá</h6>
                                        </div>
                                        <div className="card-body-modern">
                                            <Form>
                                                <Row>
                                                    <Col md={6}>
                                                        <Form.Group className="mb-4">
                                                            <Form.Label className="info-label">
                                                                <i className="fas fa-star me-2"></i>
                                                                Xuất sắc (Excellent)
                                                                <br />
                                                                <small className="text-muted">Ngưỡng: ≥ {tempDiscriminationThresholds.excellent.toFixed(2)}</small>
                                                            </Form.Label>
                                                            <Form.Range
                                                                min="0.3"
                                                                max="1.0"
                                                                step="0.05"
                                                                value={tempDiscriminationThresholds.excellent}
                                                                onChange={(e) => setTempDiscriminationThresholds({
                                                                    ...tempDiscriminationThresholds,
                                                                    excellent: parseFloat(e.target.value)
                                                                })}
                                                                className="mb-2"
                                                            />
                                                            <div className="d-flex justify-content-between mb-2">
                                                                <small>0.3</small>
                                                                <small className="fw-bold">{tempDiscriminationThresholds.excellent.toFixed(2)}</small>
                                                                <small>1.0</small>
                                                            </div>
                                                            <div className="bg-light p-2 rounded small">
                                                                <strong>Giải thích:</strong> Câu hỏi có Discrimination Index <strong>≥ {tempDiscriminationThresholds.excellent.toFixed(2)}</strong> được đánh giá là <strong>Xuất sắc</strong>.
                                                                <br />
                                                                <strong>Ví dụ:</strong> Nếu đặt ngưỡng = <strong>0.40</strong>, thì:
                                                                <ul className="mb-0 mt-1">
                                                                    <li>Câu hỏi có Discrimination Index <strong>≥ 0.40</strong> sẽ được xếp vào "Xuất sắc"</li>
                                                                    <li>Nghĩa là: Câu hỏi phân biệt rất tốt giữa sinh viên giỏi và yếu</li>
                                                                    <li>Nếu đặt <strong>0.40</strong> (mặc định): ≥ 0.40 → Xuất sắc</li>
                                                                </ul>
                                                            </div>
                                                        </Form.Group>
                                                    </Col>
                                                    <Col md={6}>
                                                        <Form.Group className="mb-4">
                                                            <Form.Label className="info-label">
                                                                <i className="fas fa-check-circle me-2"></i>
                                                                Tốt (Good)
                                                                <br />
                                                                <small className="text-muted">Ngưỡng: {tempDiscriminationThresholds.good.toFixed(2)} - {tempDiscriminationThresholds.excellent.toFixed(2)}</small>
                                                            </Form.Label>
                                                            <Form.Range
                                                                min="0.2"
                                                                max={tempDiscriminationThresholds.excellent}
                                                                step="0.05"
                                                                value={tempDiscriminationThresholds.good}
                                                                onChange={(e) => {
                                                                    const value = parseFloat(e.target.value);
                                                                    setTempDiscriminationThresholds({
                                                                        ...tempDiscriminationThresholds,
                                                                        good: value
                                                                    });
                                                                }}
                                                                className="mb-2"
                                                            />
                                                            <div className="d-flex justify-content-between mb-2">
                                                                <small>0.2</small>
                                                                <small className="fw-bold">{tempDiscriminationThresholds.good.toFixed(2)}</small>
                                                                <small>{tempDiscriminationThresholds.excellent.toFixed(2)}</small>
                                                            </div>
                                                            <div className="bg-light p-2 rounded small">
                                                                <strong>Giải thích:</strong> Câu hỏi có Discrimination Index từ <strong>{tempDiscriminationThresholds.good.toFixed(2)}</strong> đến <strong>{tempDiscriminationThresholds.excellent.toFixed(2)}</strong> được đánh giá là <strong>Tốt</strong>.
                                                                <br />
                                                                <strong>Ví dụ:</strong> Nếu đặt ngưỡng = <strong>0.30</strong> (với Xuất sắc = 0.40), thì:
                                                                <ul className="mb-0 mt-1">
                                                                    <li>Câu hỏi có Discrimination Index từ <strong>0.30 - 0.40</strong> sẽ được xếp vào "Tốt"</li>
                                                                    <li>Nghĩa là: Câu hỏi phân biệt tốt giữa sinh viên giỏi và yếu</li>
                                                                    <li>Nếu đặt <strong>0.30</strong> (mặc định): 0.30 - 0.40 → Tốt</li>
                                                                </ul>
                                                            </div>
                                                        </Form.Group>
                                                    </Col>
                                                </Row>

                                                <Row>
                                                    <Col md={6}>
                                                        <Form.Group className="mb-4">
                                                            <Form.Label className="info-label">
                                                                <i className="fas fa-check me-2"></i>
                                                                Chấp nhận được (Acceptable)
                                                                <br />
                                                                <small className="text-muted">Ngưỡng: {tempDiscriminationThresholds.acceptable.toFixed(2)} - {tempDiscriminationThresholds.good.toFixed(2)}</small>
                                                            </Form.Label>
                                                            <Form.Range
                                                                min="0.1"
                                                                max={tempDiscriminationThresholds.good}
                                                                step="0.05"
                                                                value={tempDiscriminationThresholds.acceptable}
                                                                onChange={(e) => {
                                                                    const value = parseFloat(e.target.value);
                                                                    setTempDiscriminationThresholds({
                                                                        ...tempDiscriminationThresholds,
                                                                        acceptable: value
                                                                    });
                                                                }}
                                                                className="mb-2"
                                                            />
                                                            <div className="d-flex justify-content-between mb-2">
                                                                <small>0.1</small>
                                                                <small className="fw-bold">{tempDiscriminationThresholds.acceptable.toFixed(2)}</small>
                                                                <small>{tempDiscriminationThresholds.good.toFixed(2)}</small>
                                                            </div>
                                                            <div className="bg-light p-2 rounded small">
                                                                <strong>Giải thích:</strong> Câu hỏi có Discrimination Index từ <strong>{tempDiscriminationThresholds.acceptable.toFixed(2)}</strong> đến <strong>{tempDiscriminationThresholds.good.toFixed(2)}</strong> được đánh giá là <strong>Chấp nhận được</strong>.
                                                                <br />
                                                                <strong>Ví dụ:</strong> Nếu đặt ngưỡng = <strong>0.20</strong> (với Tốt = 0.30), thì:
                                                                <ul className="mb-0 mt-1">
                                                                    <li>Câu hỏi có Discrimination Index từ <strong>0.20 - 0.30</strong> sẽ được xếp vào "Chấp nhận được"</li>
                                                                    <li>Nghĩa là: Câu hỏi có khả năng phân biệt ở mức chấp nhận được</li>
                                                                    <li>Nếu đặt <strong>0.20</strong> (mặc định): 0.20 - 0.30 → Chấp nhận được</li>
                                                                </ul>
                                                            </div>
                                                        </Form.Group>
                                                    </Col>
                                                    <Col md={6}>
                                                        <Form.Group className="mb-4">
                                                            <Form.Label className="info-label">
                                                                <i className="fas fa-exclamation-circle me-2"></i>
                                                                Cần cải thiện (Needs Improvement)
                                                                <br />
                                                                <small className="text-muted">Ngưỡng: {tempDiscriminationThresholds.needsImprovement.toFixed(2)} - {tempDiscriminationThresholds.acceptable.toFixed(2)}</small>
                                                            </Form.Label>
                                                            <Form.Range
                                                                min="0"
                                                                max={tempDiscriminationThresholds.acceptable}
                                                                step="0.05"
                                                                value={tempDiscriminationThresholds.needsImprovement}
                                                                onChange={(e) => {
                                                                    const value = parseFloat(e.target.value);
                                                                    setTempDiscriminationThresholds({
                                                                        ...tempDiscriminationThresholds,
                                                                        needsImprovement: value
                                                                    });
                                                                }}
                                                                className="mb-2"
                                                            />
                                                            <div className="d-flex justify-content-between mb-2">
                                                                <small>0</small>
                                                                <small className="fw-bold">{tempDiscriminationThresholds.needsImprovement.toFixed(2)}</small>
                                                                <small>{tempDiscriminationThresholds.acceptable.toFixed(2)}</small>
                                                            </div>
                                                            <div className="bg-light p-2 rounded small">
                                                                <strong>Giải thích:</strong> Câu hỏi có Discrimination Index từ <strong>{tempDiscriminationThresholds.needsImprovement.toFixed(2)}</strong> đến <strong>{tempDiscriminationThresholds.acceptable.toFixed(2)}</strong> được đánh giá là <strong>Cần cải thiện</strong>.
                                                                <br />
                                                                <strong>Ví dụ:</strong> Nếu đặt ngưỡng = <strong>0.10</strong> (với Chấp nhận được = 0.20), thì:
                                                                <ul className="mb-0 mt-1">
                                                                    <li>Câu hỏi có Discrimination Index từ <strong>0.10 - 0.20</strong> sẽ được xếp vào "Cần cải thiện"</li>
                                                                    <li>Nghĩa là: Câu hỏi có khả năng phân biệt thấp, cần xem xét lại</li>
                                                                    <li>Nếu đặt <strong>0.10</strong> (mặc định): 0.10 - 0.20 → Cần cải thiện</li>
                                                                </ul>
                                                            </div>
                                                        </Form.Group>
                                                    </Col>
                                                </Row>

                                                <Form.Group className="mb-4">
                                                    <Form.Label className="info-label">
                                                        <i className="fas fa-times-circle me-2"></i>
                                                        Kém (Poor)
                                                        <br />
                                                        <small className="text-muted">Ngưỡng: &lt; {tempDiscriminationThresholds.needsImprovement.toFixed(2)}</small>
                                                    </Form.Label>
                                                    <div className="p-3 bg-light rounded">
                                                        <div className="small">
                                                            <strong>Giải thích:</strong> Câu hỏi có Discrimination Index <strong>&lt; {tempDiscriminationThresholds.needsImprovement.toFixed(2)}</strong> được đánh giá là <strong>Kém</strong>.
                                                            <br />
                                                            <strong>Ví dụ:</strong> Nếu đặt ngưỡng Cần cải thiện = <strong>0.10</strong>, thì:
                                                            <ul className="mb-0 mt-1">
                                                                <li>Câu hỏi có Discrimination Index <strong>&lt; 0.10</strong> sẽ được xếp vào "Kém"</li>
                                                                <li>Nghĩa là: Câu hỏi không phân biệt được trình độ hoặc có vấn đề</li>
                                                                <li>Nếu đặt <strong>0.10</strong> (mặc định): &lt; 0.10 → Kém</li>
                                                            </ul>
                                                            <strong className="text-danger">Lưu ý:</strong> Câu hỏi kém có thể không phân biệt được trình độ (vì sinh viên giỏi và yếu trả lời tương tự), hoặc có thể có vấn đề về nội dung/đáp án.
                                                        </div>
                                                    </div>
                                                </Form.Group>
                                            </Form>
                                        </div>
                                    </div>

                                    {/* Notes and Suggestions Card */}
                                    <div className="session-card mb-4">
                                        <div className="card-header-modern">
                                            <div className="header-icon">
                                                <i className="fas fa-exclamation-triangle"></i>
                                            </div>
                                            <h6 className="mb-0">Lưu ý và gợi ý</h6>
                                        </div>
                                        <div className="card-body-modern">
                                            <Row>
                                                <Col md={6}>
                                                    <Alert variant="warning" className="mb-0 h-100">
                                                        <div className="mb-2">
                                                            <i className="fas fa-exclamation-triangle me-2"></i>
                                                            <strong>Lưu ý quan trọng:</strong>
                                                        </div>
                                                        <ul className="mb-2 small">
                                                            <li>Đảm bảo các ngưỡng được sắp xếp theo thứ tự giảm dần:
                                                                <br />
                                                                <strong>Xuất sắc ({tempDiscriminationThresholds.excellent.toFixed(2)}) &gt; Tốt ({tempDiscriminationThresholds.good.toFixed(2)}) &gt; Chấp nhận được ({tempDiscriminationThresholds.acceptable.toFixed(2)}) &gt; Cần cải thiện ({tempDiscriminationThresholds.needsImprovement.toFixed(2)})</strong>
                                                            </li>
                                                            <li>Khi thay đổi ngưỡng, hệ thống sẽ tự động đánh giá lại tất cả các câu hỏi dựa trên tiêu chuẩn mới</li>
                                                            <li>Cài đặt sẽ được lưu vào database và áp dụng cho tất cả các kỳ thi</li>
                                                        </ul>
                                                    </Alert>
                                                </Col>
                                                <Col md={6}>
                                                    <Alert variant="success" className="mb-0 h-100">
                                                        <div className="mb-2">
                                                            <i className="fas fa-lightbulb me-2"></i>
                                                            <strong>Gợi ý sử dụng:</strong>
                                                        </div>
                                                        <div className="small">
                                                            <p className="mb-1"><strong>• Kỳ thi sàng lọc:</strong> Tăng các ngưỡng (ví dụ: Xuất sắc = 0.50, Tốt = 0.40, Chấp nhận được = 0.30)</p>
                                                            <p className="mb-1"><strong>• Kỳ thi đánh giá cơ bản:</strong> Giảm các ngưỡng (ví dụ: Xuất sắc = 0.35, Tốt = 0.25, Chấp nhận được = 0.15)</p>
                                                            <p className="mb-0"><strong>• Kỳ thi chuyên ngành:</strong> Giữ ngưỡng ở mức trung bình để đánh giá công bằng</p>
                                                        </div>
                                                    </Alert>
                                                </Col>
                                            </Row>
                                        </div>
                                    </div>
                                </div>
                            </Tab>
                        </Tabs>
                    </div>
                </Modal.Body>
                <Modal.Footer className="student-detail-footer">
                    <Button 
                        variant="outline-secondary" 
                        onClick={() => {
                            if (settingsModalTab === 'difficulty') {
                                setTempDifficultyThresholds(defaultDifficultyThresholds);
                            } else if (settingsModalTab === 'discrimination') {
                                setTempDiscriminationThresholds(defaultDiscriminationThresholds);
                            }
                        }}
                        className="btn-cancel"
                    >
                        <i className="fas fa-undo me-2"></i>
                        Khôi phục mặc định
                    </Button>
                    <Button 
                        variant="outline-secondary" 
                        onClick={() => {
                            setShowSettingsModal(false);
                            setTempDifficultyThresholds(difficultyThresholds);
                            setTempDiscriminationThresholds(discriminationThresholds);
                        }}
                        className="btn-cancel"
                    >
                        <i className="fas fa-times me-2"></i>
                        Hủy
                    </Button>
                    <Button 
                        variant="primary" 
                        onClick={async () => {
                            if (settingsModalTab === 'difficulty') {
                                // Validate difficulty thresholds
                                if (tempDifficultyThresholds.tooEasy > tempDifficultyThresholds.easy && 
                                    tempDifficultyThresholds.easy > tempDifficultyThresholds.medium && 
                                    tempDifficultyThresholds.medium > tempDifficultyThresholds.hard) {
                                    const success = await saveQASettings(tempDifficultyThresholds, 'difficulty');
                                    if (success) {
                                        setShowSettingsModal(false);
                                    }
                                } else {
                                    showAlertMessage('Các ngưỡng phải được sắp xếp theo thứ tự giảm dần', 'danger');
                                }
                            } else if (settingsModalTab === 'discrimination') {
                                // Validate discrimination thresholds
                                if (tempDiscriminationThresholds.excellent > tempDiscriminationThresholds.good && 
                                    tempDiscriminationThresholds.good > tempDiscriminationThresholds.acceptable && 
                                    tempDiscriminationThresholds.acceptable > tempDiscriminationThresholds.needsImprovement) {
                                    const success = await saveQASettings(tempDiscriminationThresholds, 'discrimination');
                                    if (success) {
                                        setShowSettingsModal(false);
                                    }
                                } else {
                                    showAlertMessage('Các ngưỡng phải được sắp xếp theo thứ tự giảm dần', 'danger');
                                }
                            }
                        }}
                        disabled={loadingSettings}
                        className="btn-edit"
                    >
                        {loadingSettings ? (
                            <>
                                <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                                Đang lưu...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-save me-2"></i>
                                Lưu
                            </>
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>
            
            {/* Score Range Settings Modal */}
            <Modal 
                show={showScoreRangeModal} 
                onHide={() => {
                    setShowScoreRangeModal(false);
                    setTempScoreRanges([...scoreRanges]); // Reset temp
                }}
                size="xl"
                centered
            >
                <Modal.Header closeButton style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #667eea 100%)',
                    color: 'white',
                    borderBottom: 'none',
                    padding: '20px 32px'
                }}>
                    <Modal.Title style={{ fontSize: '22px', fontWeight: '700' }}>
                        Điều chỉnh khoảng điểm
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body style={{ padding: '24px 32px' }}>
                    {/* Last Updated Info */}
                    {scoreRangeMetadata.updated_at && (
                        <Alert variant="info" className="mb-4">
                            <i className="fas fa-info-circle me-2"></i>
                            Cập nhật lần cuối: <strong>{new Date(scoreRangeMetadata.updated_at).toLocaleString('vi-VN')}</strong>
                            {scoreRangeMetadata.updated_by_name && (
                                <> bởi <strong>{scoreRangeMetadata.updated_by_name}</strong></>
                            )}
                        </Alert>
                    )}
                    
                    <Row>
                        {tempScoreRanges.map((range, index) => (
                            <Col key={index} className="mb-3">
                                <div className="p-3" style={{ 
                                    border: '2px solid #e3e8ef',
                                    borderRadius: '12px',
                                    backgroundColor: '#ffffff',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                                    transition: 'all 0.3s ease',
                                    height: '100%'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }}>
                                    {/* Header */}
                                    <div style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '8px', 
                                        marginBottom: '12px',
                                        paddingBottom: '12px',
                                        borderBottom: '2px solid #f0f0f0'
                                    }}>
                                        <div style={{
                                            width: '28px',
                                            height: '28px',
                                            borderRadius: '8px',
                                            backgroundColor: range.color,
                                            border: '2px solid #fff',
                                            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#fff',
                                            fontSize: '14px',
                                            fontWeight: '700',
                                            flexShrink: 0
                                        }}>{index + 1}</div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ 
                                                fontSize: '17px', 
                                                color: '#7f8c8d',
                                                fontWeight: '600',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis'
                                            }}>
                                                {range.label}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Min Input */}
                                    <div className="mb-2" style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '8px' 
                                    }}>
                                        <div style={{ 
                                            fontSize: '14px', 
                                            fontWeight: '700',
                                            color: '#7f8c8d',
                                            width: '35px',
                                            flexShrink: 0
                                        }}>
                                            Min
                                        </div>
                                        <Form.Control
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            max="10"
                                            value={range.min}
                                            onChange={(e) => updateRangeValue(index, 'min', e.target.value)}
                                            style={{ 
                                                fontSize: '16px',
                                                fontWeight: '700',
                                                padding: '8px 10px',
                                                borderRadius: '8px',
                                                border: '2px solid #e3e8ef',
                                                textAlign: 'center',
                                                color: '#2c3e50'
                                            }}
                                        />
                                    </div>
                                    
                                    {/* Max Input */}
                                    <div className="mb-2" style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '8px' 
                                    }}>
                                        <div style={{ 
                                            fontSize: '14px', 
                                            fontWeight: '700',
                                            color: '#7f8c8d',
                                            width: '35px',
                                            flexShrink: 0
                                        }}>
                                            Max
                                        </div>
                                        <Form.Control
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            max="10"
                                            value={range.max}
                                            onChange={(e) => updateRangeValue(index, 'max', e.target.value)}
                                            style={{ 
                                                fontSize: '16px',
                                                fontWeight: '700',
                                                padding: '8px 10px',
                                                borderRadius: '8px',
                                                border: '2px solid #e3e8ef',
                                                textAlign: 'center',
                                                color: '#2c3e50'
                                            }}
                                        />
                                    </div>
                                    
                                    {/* Color Picker */}
                                    <div style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '8px' 
                                    }}>
                                        <div style={{ 
                                            fontSize: '14px', 
                                            fontWeight: '700',
                                            color: '#7f8c8d',
                                            width: '35px',
                                            flexShrink: 0
                                        }}>
                                            Màu
                                        </div>
                                        <Form.Control
                                            type="color"
                                            value={range.color}
                                            onChange={(e) => {
                                                const newRanges = [...tempScoreRanges];
                                                newRanges[index].color = e.target.value;
                                                setTempScoreRanges(newRanges);
                                            }}
                                            style={{ 
                                                width: '100%',
                                                height: '38px',
                                                cursor: 'pointer',
                                                borderRadius: '8px',
                                                border: '2px solid #e3e8ef',
                                                padding: '4px'
                                            }}
                                        />
                                    </div>
                                </div>
                            </Col>
                        ))}
                    </Row>
                    
                    {/* Preview Section */}
                    <div className="mt-3 p-3" style={{
                        border: '2px dashed #667eea',
                        borderRadius: '12px',
                        backgroundColor: '#f8f9ff'
                    }}>

                        
                        {/* Bar Chart Preview */}
                        <div style={{ 
                            display: 'flex', 
                            gap: '10px', 
                            alignItems: 'flex-end',
                            minHeight: '160px',
                            padding: '20px',
                            backgroundColor: '#fff',
                            borderRadius: '10px',
                            border: '2px solid #e3e8ef'
                        }}>
                            {tempScoreRanges.map((range, index) => {
                                // Generate random height for preview (20% - 100%)
                                const height = 20 + (index * 15) % 80;
                                return (
                                    <div key={index} style={{ 
                                        flex: 1, 
                                        display: 'flex', 
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}>
                                        <div style={{
                                            fontSize: '15px',
                                            fontWeight: '700',
                                            color: range.color
                                        }}>
                                            {height}%
                                        </div>
                                        <div style={{
                                            width: '100%',
                                            height: `${height * 1.2}px`,
                                            backgroundColor: range.color + '40',
                                            borderRadius: '6px 6px 0 0',
                                            border: `2px solid ${range.color}`,
                                            borderBottom: 'none',
                                            transition: 'all 0.3s ease',
                                            position: 'relative',
                                            overflow: 'hidden'
                                        }}>
                                            <div style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                right: 0,
                                                height: '30%',
                                                background: `linear-gradient(180deg, ${range.color}60 0%, transparent 100%)`
                                            }}></div>
                                        </div>
                                        <div style={{
                                            fontSize: '12px',
                                            fontWeight: '700',
                                            color: '#2c3e50',
                                            textAlign: 'center',
                                            padding: '6px 8px',
                                            backgroundColor: range.color + '15',
                                            borderRadius: '6px',
                                            border: `2px solid ${range.color}40`,
                                            width: '100%',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        }}>
                                            {range.label}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        
                        {/* Labels Preview */}
                        <div className="mt-3" style={{ 
                            display: 'flex', 
                            gap: '8px', 
                            flexWrap: 'wrap',
                            justifyContent: 'center'
                        }}>
                            {tempScoreRanges.map((range, index) => (
                                <div key={index} style={{
                                    padding: '8px 16px',
                                    borderRadius: '8px',
                                    backgroundColor: range.color + '20',
                                    border: `2px solid ${range.color}`,
                                    fontSize: '13px',
                                    fontWeight: '700',
                                    color: range.color,
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.08)'
                                }}>
                                    {range.label}
                                </div>
                            ))}
                        </div>
                    </div>
                </Modal.Body>
                <Modal.Footer style={{ 
                    padding: '16px 32px',
                    borderTop: '2px solid #e3e8ef',
                    backgroundColor: '#f8f9fa'
                }}>
                    <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        width: '100%',
                        alignItems: 'center'
                    }}>
                        <div style={{ 
                            fontSize: '13px', 
                            color: '#7f8c8d',
                            fontWeight: '600'
                        }}>
                            Thay đổi sẽ áp dụng cho tất cả biểu đồ phân phối điểm
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <Button 
                                variant="light"
                                onClick={() => {
                                    setShowScoreRangeModal(false);
                                    setTempScoreRanges([...scoreRanges]);
                                }}
                                style={{
                                    padding: '10px 24px',
                                    fontSize: '15px',
                                    fontWeight: '600',
                                    borderRadius: '10px',
                                    border: '2px solid #e3e8ef',
                                    transition: 'all 0.3s ease'
                                }}
                            >
                                Hủy
                            </Button>
                            <Button 
                                onClick={saveScoreRangeSettings}
                                disabled={loadingScoreRangeSettings}
                                style={{
                                    padding: '10px 32px',
                                    fontSize: '15px',
                                    fontWeight: '700',
                                    borderRadius: '10px',
                                    background: 'linear-gradient(135deg, #667eea 0%, #667eea 100%)',
                                    border: 'none',
                                    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
                                    transition: 'all 0.3s ease'
                                }}
                                onMouseEnter={(e) => {
                                    if (!loadingScoreRangeSettings) {
                                        e.target.style.transform = 'translateY(-2px)';
                                        e.target.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.5)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    e.target.style.transform = 'translateY(0)';
                                    e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
                                }}
                            >
                                {loadingScoreRangeSettings ? (
                                    <>
                                        <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                                        Đang lưu...
                                    </>
                                ) : (
                                    'Lưu cài đặt'
                                )}
                            </Button>
                        </div>
                    </div>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default ExamReports;
